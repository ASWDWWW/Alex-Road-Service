const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const Stripe = require('stripe');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();
const auth = getAuth();

const HOSTING_URL = 'https://launchpage-alex-roadservice.web.app';

const STAFF_SEED = [
  { email: 'admin@alexroadservice.com', password: 'password', name: 'Alex Rodriguez', role: 'admin' },
  { email: 'office@alexroadservice.com', password: 'password', name: 'Sarah Torres', role: 'office' },
  { email: 'tech@alexroadservice.com', password: 'password', name: 'Mike Santos', role: 'technician' },
  { email: 'developer@alexroadservice.com', password: 'ChangeMe-Dev-2026!', name: 'Platform Developer', role: 'developer' },
];

function assertAdminOrDev(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');
  const role = request.auth.token.role;
  if (role !== 'admin' && role !== 'developer') {
    throw new HttpsError('permission-denied', 'Admin or developer role required');
  }
}

function assertPaymentRole(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');
  const role = request.auth.token.role;
  if (!['admin', 'office', 'developer'].includes(role)) {
    throw new HttpsError('permission-denied', 'Office or admin role required');
  }
}

async function nextPaymentId() {
  const year = new Date().getFullYear();
  const counterRef = db.collection('counters').doc(`PAY_${year}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const num = (snap.exists ? snap.data().value : 0) + 1;
    tx.set(counterRef, { value: num, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return `PAY-${year}-${String(num).padStart(4, '0')}`;
  });
}

async function recordStripePayment({ invoiceId, amount, sessionId, paymentIntentId, customerName, eventId }) {
  const processedRef = db.collection('stripe_events').doc(eventId);
  if ((await processedRef.get()).exists) return { duplicate: true };

  const invRef = db.collection('invoices').doc(invoiceId);
  const invSnap = await invRef.get();
  if (!invSnap.exists) throw new Error(`Invoice ${invoiceId} not found`);

  const payId = await nextPaymentId();
  const paymentRef = db.collection('payments').doc(payId);
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  await db.runTransaction(async (tx) => {
    if ((await tx.get(processedRef)).exists) return;

    const inv = (await tx.get(invRef)).data();
    const newPaid = (inv.amountPaid || 0) + amount;
    const balance = (inv.total || 0) - newPaid;
    const status = balance <= 0.01 ? 'Paid' : 'Partially Paid';

    tx.set(paymentRef, {
      id: payId,
      date: dateStr,
      customerName: customerName || inv.customerName || '',
      customerId: inv.customerId || null,
      invoiceId,
      amount,
      method: 'Stripe',
      status: 'Completed',
      refundedAmount: 0,
      stripeSessionId: sessionId,
      stripePaymentIntentId: paymentIntentId || null,
      idempotencyKey: sessionId,
      createdAt: now.toISOString(),
      createdBy: 'stripe_webhook',
    });

    tx.update(invRef, {
      amountPaid: newPaid,
      status,
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.set(processedRef, {
      type: 'checkout.session.completed',
      invoiceId,
      paymentId: payId,
      amount,
      sessionId,
      processedAt: FieldValue.serverTimestamp(),
    });
  });

  await db.collection('audit_log').add({
    action: 'payment.stripe',
    entityType: 'payment',
    entityId: payId,
    invoiceId,
    amount,
    userId: 'stripe_webhook',
    at: FieldValue.serverTimestamp(),
  });

  return { paymentId: payId };
}

/**
 * Apply a refund against a stored payment + invoice.
 * Idempotent by Stripe refund id (stripe_events + payment.stripeRefundIds).
 * amountRefundedTotal: absolute cents/dollars already refunded on the charge (webhook).
 * amountDelta: incremental dollars to add (callable path).
 */
async function applyStripeRefund({
  paymentId,
  paymentIntentId,
  refundId,
  amountDelta,
  amountRefundedTotal,
  reason,
  eventId,
  refundedBy,
}) {
  const eventKey = eventId || (refundId ? `refund_${refundId}` : null);
  if (!eventKey) throw new Error('Refund event id required');

  const processedRef = db.collection('stripe_events').doc(eventKey);
  if ((await processedRef.get()).exists) return { duplicate: true };

  let payRef;
  let paySnap;
  if (paymentId) {
    payRef = db.collection('payments').doc(paymentId);
    paySnap = await payRef.get();
  } else if (paymentIntentId) {
    const q = await db.collection('payments')
      .where('stripePaymentIntentId', '==', paymentIntentId)
      .limit(1)
      .get();
    if (q.empty) throw new Error(`Payment not found for PI ${paymentIntentId}`);
    paySnap = q.docs[0];
    payRef = paySnap.ref;
    paymentId = paySnap.id;
  } else {
    throw new Error('paymentId or paymentIntentId required');
  }

  if (!paySnap.exists) throw new Error(`Payment ${paymentId} not found`);

  const result = await db.runTransaction(async (tx) => {
    // All reads must complete before any writes (Firestore transaction rule)
    const processedSnap = await tx.get(processedRef);
    if (processedSnap.exists) return { duplicate: true };

    const payFresh = (await tx.get(payRef)).data();
    if (!payFresh) throw new Error(`Payment ${paymentId} missing in transaction`);

    const invRef = payFresh.invoiceId
      ? db.collection('invoices').doc(payFresh.invoiceId)
      : null;
    const invSnap = invRef ? await tx.get(invRef) : null;

    const refundIds = payFresh.stripeRefundIds || [];
    if (refundId && refundIds.includes(refundId)) {
      tx.set(processedRef, {
        type: 'refund.duplicate',
        paymentId,
        refundId,
        processedAt: FieldValue.serverTimestamp(),
      });
      return { duplicate: true };
    }

    const paid = Number(payFresh.amount) || 0;
    const prevRefunded = Number(payFresh.refundedAmount) || 0;
    let nextRefunded = prevRefunded;

    if (amountRefundedTotal != null) {
      nextRefunded = Math.max(prevRefunded, Number(amountRefundedTotal) || 0);
    } else if (amountDelta != null) {
      nextRefunded = prevRefunded + Number(amountDelta);
    }

    nextRefunded = Math.min(paid, Math.round(nextRefunded * 100) / 100);
    const delta = Math.round((nextRefunded - prevRefunded) * 100) / 100;
    if (delta <= 0.001) {
      tx.set(processedRef, {
        type: 'refund.noop',
        paymentId,
        refundId: refundId || null,
        processedAt: FieldValue.serverTimestamp(),
      });
      return { duplicate: true, paymentId };
    }

    const remaining = Math.round((paid - nextRefunded) * 100) / 100;
    const payStatus = remaining <= 0.01 ? 'Refunded' : 'Partially Refunded';
    const nextRefundIds = refundId ? [...refundIds, refundId] : refundIds;

    tx.update(payRef, {
      refundedAmount: nextRefunded,
      refundableAmount: remaining,
      status: payStatus,
      stripeRefundIds: nextRefundIds,
      lastRefundAt: new Date().toISOString(),
      lastRefundReason: reason || null,
      lastRefundId: refundId || null,
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (invSnap?.exists) {
      const inv = invSnap.data();
      if (inv.status !== 'Written Off') {
        const newPaid = Math.max(0, Math.round(((inv.amountPaid || 0) - delta) * 100) / 100);
        const balance = Math.round(((inv.total || 0) - newPaid) * 100) / 100;
        let status = inv.status;
        if (newPaid <= 0.01) {
          const due = inv.due ? new Date(inv.due) : null;
          status = (due && !isNaN(due) && due < new Date()) ? 'Overdue' : 'Sent';
        } else if (balance > 0.01) {
          status = 'Partially Paid';
        } else {
          status = 'Paid';
        }
        tx.update(invRef, {
          amountPaid: newPaid,
          status,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    tx.set(processedRef, {
      type: 'refund.applied',
      paymentId,
      invoiceId: payFresh.invoiceId,
      refundId: refundId || null,
      amount: delta,
      refundedBy: refundedBy || 'stripe_webhook',
      processedAt: FieldValue.serverTimestamp(),
    });

    return {
      paymentId,
      invoiceId: payFresh.invoiceId,
      amount: delta,
      refundedAmount: nextRefunded,
      status: payStatus,
    };
  });

  if (!result?.duplicate) {
    await db.collection('audit_log').add({
      action: 'payment.refund',
      entityType: 'payment',
      entityId: result.paymentId,
      invoiceId: result.invoiceId,
      amount: result.amount,
      refundId: refundId || null,
      reason: reason || null,
      userId: refundedBy || 'stripe_webhook',
      at: FieldValue.serverTimestamp(),
    });
  }

  return result;
}

async function upsertUserProfile(uid, profile) {
  await db.collection('users').doc(uid).set({
    ...profile,
    uid,
    active: true,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function setRole(uid, role) {
  await auth.setCustomUserClaims(uid, { role });
}

const SHOP_CONVERSATION_ID = 'shop_all_staff';

async function upsertMessagingRoster(uid, data = {}) {
  const status = data.status || 'Active';
  const active = data.active !== false && status !== 'Archived' && status !== 'Terminated';
  await db.collection('messagingRoster').doc(uid).set({
    uid,
    name: data.name || '',
    email: data.email || '',
    role: data.role || '',
    jobTitle: data.jobTitle || '',
    photoURL: data.photoURL || '',
    messagingPublicKey: data.messagingPublicKey || null,
    active,
    status,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function removeMessagingRoster(uid) {
  await db.collection('messagingRoster').doc(uid).delete().catch(() => {});
}

async function syncShopConversationParticipants() {
  const snap = await db.collection('messagingRoster').where('active', '==', true).get();
  const members = snap.docs.map((d) => d.data());
  const participantIds = members.map((m) => m.uid).filter(Boolean).sort();
  if (participantIds.length < 2) return { ok: false, reason: 'need_two_staff' };

  const names = {};
  members.forEach((m) => {
    const n = String(m.name || '').trim();
    names[m.uid] = n && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(n) ? n : 'Staff';
  });

  const ref = db.collection('conversations').doc(SHOP_CONVERSATION_ID);
  const existing = await ref.get();
  const payload = {
    id: SHOP_CONVERSATION_ID,
    type: 'shop',
    title: 'Shop Channel',
    participantIds,
    participantNames: names,
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (!existing.exists) {
    payload.createdBy = 'system';
    payload.createdAt = FieldValue.serverTimestamp();
    payload.lastMessageAt = FieldValue.serverTimestamp();
    payload.lastMessagePreview = 'Welcome to shop messaging';
    payload.lastMessageBy = 'system';
    payload.wrappedKeys = {};
    payload.e2ee = true;
  }
  await ref.set(payload, { merge: true });
  return { ok: true, id: SHOP_CONVERSATION_ID, participantIds };
}

async function getNotifyUserIds(roles) {
  const snap = await db.collection('users').where('role', 'in', roles).get();
  return snap.docs.filter((d) => d.data().active !== false).map((d) => d.id);
}

async function notifyUsers(userIds, docKey, data) {
  if (!userIds.length) return;
  const batch = db.batch();
  userIds.forEach((uid) => {
    const ref = db.collection('notifications').doc(`${docKey}_${uid}`);
    batch.set(ref, {
      ...data,
      userId: uid,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
  await batch.commit();
}

function inventoryLevel(qty, min) {
  if (qty <= 0) return 'Out of Stock';
  if (qty < min) return 'Low';
  return 'In Stock';
}

exports.onInvoiceWrite = onDocumentWritten({ document: 'invoices/{invoiceId}', region: 'us-central1' }, async (event) => {
  const after = event.data?.after?.data();
  const before = event.data?.before?.data();
  if (!after || after.status !== 'Overdue' || before?.status === 'Overdue') return;

  const users = await getNotifyUserIds(['admin', 'office']);
  await notifyUsers(users, `overdue_${event.params.invoiceId}`, {
    type: 'warning',
    message: `Invoice ${event.params.invoiceId} overdue — ${after.customerName || 'Customer'}`,
    entityType: 'invoice',
    entityId: event.params.invoiceId,
    href: `/app/invoice-detail.html?id=${event.params.invoiceId}`,
  });
});

exports.onInventoryWrite = onDocumentWritten({ document: 'inventory/{partId}', region: 'us-central1' }, async (event) => {
  const after = event.data?.after?.data();
  const before = event.data?.before?.data();
  if (!after) return;

  const afterLevel = inventoryLevel(after.qty || 0, after.min || 1);
  const beforeLevel = before ? inventoryLevel(before.qty || 0, before.min || 1) : 'In Stock';
  if (afterLevel === 'In Stock' || afterLevel === beforeLevel) return;

  const users = await getNotifyUserIds(['admin', 'office']);
  await notifyUsers(users, `stock_${event.params.partId}`, {
    type: 'warning',
    message: `${after.desc || after.partNo} is ${afterLevel.toLowerCase()} (${after.qty} on hand)`,
    entityType: 'inventory',
    entityId: event.params.partId,
    href: '/app/inventory.html',
  });
});

exports.onWorkOrderWrite = onDocumentWritten({ document: 'workOrders/{woId}', region: 'us-central1' }, async (event) => {
  const after = event.data?.after?.data();
  const before = event.data?.before?.data();
  if (!after) return;

  const openStatuses = ['Open', 'In Progress', 'Waiting Parts'];
  const isOpen = openStatuses.includes(after.status);
  const wasOpen = before ? openStatuses.includes(before.status) : false;
  const isNew = !before;
  const statusChanged = before && before.status !== after.status;

  if (!isOpen) return;
  if (!isNew && !statusChanged) return;

  const officeUsers = await getNotifyUserIds(['admin', 'office']);
  await notifyUsers(officeUsers, `wo_${event.params.woId}`, {
    type: 'info',
    message: `Work order ${event.params.woId} — ${after.status} (${after.customerName || 'Customer'})`,
    entityType: 'workOrder',
    entityId: event.params.woId,
    href: `/app/work-order-detail.html?id=${event.params.woId}`,
  });

  if (after.techId) {
    await notifyUsers([after.techId], `wo_assign_${event.params.woId}`, {
      type: 'info',
      message: `Assigned to you: ${event.params.woId} — ${after.desc || after.customerName}`,
      entityType: 'workOrder',
      entityId: event.params.woId,
      href: `/app/work-order-detail.html?id=${event.params.woId}`,
    });
  }
});

exports.onEstimateWrite = onDocumentWritten({ document: 'estimates/{estId}', region: 'us-central1' }, async (event) => {
  const after = event.data?.after?.data();
  const before = event.data?.before?.data();
  if (!after) return;

  const pending = ['Pending', 'Sent'].includes(after.status);
  const wasPending = before ? ['Pending', 'Sent'].includes(before.status) : false;
  if (!pending || wasPending) return;

  const users = await getNotifyUserIds(['admin', 'office']);
  await notifyUsers(users, `est_${event.params.estId}`, {
    type: 'info',
    message: `Estimate ${event.params.estId} awaiting response — ${after.customerName || 'Customer'}`,
    entityType: 'estimate',
    entityId: event.params.estId,
    href: '/app/estimates.html',
  });
});

exports.nextSequentialId = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');
  const { prefix, year } = request.data;
  if (!prefix || !year) throw new HttpsError('invalid-argument', 'prefix and year required');
  const counterRef = db.collection('counters').doc(`${prefix}_${year}`);
  const id = await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const num = (snap.exists ? snap.data().value : 0) + 1;
    tx.set(counterRef, { value: num, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return `${prefix}-${year}-${String(num).padStart(4, '0')}`;
  });
  return { id };
});

exports.markOverdueInvoices = onSchedule('every 24 hours', async () => {
  const now = new Date();
  const snap = await db.collection('invoices')
    .where('status', 'in', ['Sent', 'Partially Paid'])
    .get();
  const batch = db.batch();
  snap.docs.forEach((docSnap) => {
    const inv = docSnap.data();
    const due = inv.due?.toDate?.() || new Date(inv.due);
    const balance = (inv.total || 0) - (inv.amountPaid || 0);
    if (due < now && balance > 0) {
      batch.update(docSnap.ref, { status: 'Overdue', updatedAt: FieldValue.serverTimestamp() });
    }
  });
  await batch.commit();
});

exports.auditLog = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');
  const { action, entityType, entityId, before, after } = request.data;
  await db.collection('audit_log').add({
    action,
    entityType: entityType || null,
    entityId: entityId || null,
    before: before || null,
    after: after || null,
    userId: request.auth.uid,
    at: FieldValue.serverTimestamp(),
  });
  return { ok: true };
});

const LEGACY_CUSTOMER_ID = /^C00[1-8]$/;
const LEGACY_TRUCK_ID = /^T0(0[1-9]|10)$/;
const LEGACY_NAMES = ['washex', 'james construction'];
const PURGE_COLLECTIONS = [
  'customers', 'trucks', 'workOrders', 'estimates', 'invoices',
  'payments', 'inventory', 'inventoryTransactions',
];

function isLegacyDemoDoc(collection, id, data = {}) {
  if (collection === 'customers' && LEGACY_CUSTOMER_ID.test(id)) return true;
  if (collection === 'trucks' && LEGACY_TRUCK_ID.test(id)) return true;
  const name = `${data.name || ''} ${data.customerName || ''} ${data.company || ''}`.toLowerCase();
  return LEGACY_NAMES.some((n) => name.includes(n));
}

async function firestoreHasLegacyDemo() {
  const snap = await db.collection('customers').limit(25).get();
  return snap.docs.some((d) => isLegacyDemoDoc('customers', d.id, d.data()));
}

async function deleteAllInCollection(colName) {
  const snap = await db.collection(colName).get();
  if (snap.empty) return 0;
  let deleted = 0;
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = db.batch();
    snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += Math.min(400, snap.docs.length - i);
  }
  return deleted;
}

/** Remove seeded demo records from Firestore (any staff role). */
exports.purgeLegacyDemoData = onCall({
  region: 'us-central1',
  cors: [
    'https://launchpage-alex-roadservice.web.app',
    /^https:\/\/launchpage-alex-roadservice--.*\.web\.app$/,
  ],
}, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');
  const role = request.auth.token.role;
  if (!['admin', 'office', 'developer'].includes(role)) {
    throw new HttpsError('permission-denied', 'Staff login required');
  }
  const hasLegacy = await firestoreHasLegacyDemo();
  if (!hasLegacy && !request.data?.force) {
    return { purged: false, reason: 'no_legacy_detected' };
  }
  const counts = {};
  for (const col of PURGE_COLLECTIONS) {
    counts[col] = await deleteAllInCollection(col);
  }
  return { purged: true, counts, total: Object.values(counts).reduce((s, n) => s + n, 0) };
});

/** Set role custom claim + Firestore profile (admin/developer only) */
exports.setUserRole = onCall({ region: 'us-central1' }, async (request) => {
  assertAdminOrDev(request);
  const { uid, email, name, role } = request.data;
  if (!uid && !email) throw new HttpsError('invalid-argument', 'uid or email required');
  if (!role || !['admin', 'office', 'technician', 'developer'].includes(role)) {
    throw new HttpsError('invalid-argument', 'Invalid role');
  }
  let userRecord;
  if (uid) {
    userRecord = await auth.getUser(uid);
  } else {
    userRecord = await auth.getUserByEmail(email.toLowerCase());
  }
  await setRole(userRecord.uid, role);
  await upsertUserProfile(userRecord.uid, {
    email: userRecord.email,
    name: name || userRecord.displayName || userRecord.email,
    role,
  });
  return { ok: true, uid: userRecord.uid, role };
});

const HIRABLE_ROLES = ['admin', 'office', 'technician'];
const EMPLOYEE_STATUSES = ['Active', 'On Leave', 'Terminated', 'Archived'];
const SELF_UPDATE_FIELDS = [
  'phone', 'address', 'emergencyContact', 'photoURL', 'certifications', 'media',
  'messagingPublicKey', 'messagingKeyUpdatedAt',
];

function defaultOnboarding(doneAtIso) {
  return [
    { id: 'account', label: 'Platform account created', done: true, doneAt: doneAtIso },
    { id: 'i9', label: 'I-9 employment eligibility', done: false },
    { id: 'w4', label: 'W-4 tax withholding', done: false },
    { id: 'handbook', label: 'Employee handbook acknowledged', done: false },
    { id: 'safety', label: 'Shop safety orientation', done: false },
    { id: 'tools', label: 'Tools / PPE issued', done: false },
    { id: 'access', label: 'Shop keys / access', done: false },
    { id: 'training', label: 'Role training complete', done: false },
  ];
}

function defaultSchedule() {
  return {
    mon: '7:00 AM – 3:30 PM',
    tue: '7:00 AM – 3:30 PM',
    wed: '7:00 AM – 3:30 PM',
    thu: '7:00 AM – 3:30 PM',
    fri: '7:00 AM – 3:30 PM',
    sat: 'Off',
    sun: 'Off',
    notes: '',
  };
}

/** Shared starter password for every new hire — they must change it via email link */
const DEFAULT_HIRE_PASSWORD = process.env.DEFAULT_HIRE_PASSWORD || 'AlexRoadHire!';

/** Public Web API key (same as client firebase-config) — used to trigger Firebase Auth emails */
const FIREBASE_WEB_API_KEY =
  process.env.FIREBASE_WEB_API_KEY || 'AIzaSyCUkj9Np2l-jiT1D0dxAxQBp9jxn1KbSFg';

/**
 * Trigger Firebase Auth's built-in password-reset email via Identity Toolkit.
 * Admin SDK only generates links; this REST call is what actually sends the email.
 */
async function sendFirebasePasswordResetEmail(email) {
  const em = String(email || '').trim().toLowerCase();
  if (!em) throw new Error('email required');
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_WEB_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestType: 'PASSWORD_RESET',
        email: em,
      }),
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || `sendOobCode failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

/** Create an employee: Auth user + custom claims + Firestore HR profile (admin/developer only) */
exports.createEmployee = onCall({ region: 'us-central1' }, async (request) => {
  assertAdminOrDev(request);
  const callerRole = request.auth.token.role;
  const { name, email, role, phone, jobTitle, hireDate, department } = request.data || {};
  if (!name || !email) throw new HttpsError('invalid-argument', 'name and email required');
  const allowedRoles = callerRole === 'developer' ? [...HIRABLE_ROLES, 'developer'] : HIRABLE_ROLES;
  if (!role || !allowedRoles.includes(role)) {
    throw new HttpsError('invalid-argument', `Invalid role. Allowed: ${allowedRoles.join(', ')}`);
  }

  const em = String(email).trim().toLowerCase();
  const defaultPassword = DEFAULT_HIRE_PASSWORD;
  let userRecord;
  try {
    userRecord = await auth.createUser({
      email: em,
      password: defaultPassword,
      displayName: name,
      emailVerified: false,
    });
  } catch (e) {
    if (e.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'An account with this email already exists');
    }
    throw new HttpsError('internal', e.message || 'Could not create Auth user');
  }

  await setRole(userRecord.uid, role);

  const now = new Date();
  const nowIso = now.toISOString();
  await db.collection('users').doc(userRecord.uid).set({
    uid: userRecord.uid,
    name,
    email: em,
    phone: phone || '',
    role,
    jobTitle: jobTitle || '',
    hireDate: hireDate || '',
    department: department || '',
    status: 'Active',
    employmentType: 'Full-time',
    emergencyContact: { name: '', phone: '' },
    address: '',
    certifications: [],
    schedule: defaultSchedule(),
    onboarding: defaultOnboarding(nowIso),
    media: [],
    active: true,
    archived: false,
    mustChangePassword: true,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: request.auth.uid,
  });

  await db.collection('audit_log').add({
    action: 'employee.create',
    entityType: 'employee',
    entityId: userRecord.uid,
    userId: request.auth.uid,
    at: FieldValue.serverTimestamp(),
  });

  await upsertMessagingRoster(userRecord.uid, {
    name, email: em, role, jobTitle: jobTitle || '', active: true, status: 'Active',
  });
  await syncShopConversationParticipants().catch((e) => console.warn('shop sync:', e.message));

  let passwordResetSent = false;
  let passwordResetError = null;
  try {
    await sendFirebasePasswordResetEmail(em);
    passwordResetSent = true;
  } catch (e) {
    passwordResetError = e.message || 'Failed to send password reset email';
    console.warn('sendFirebasePasswordResetEmail failed:', passwordResetError);
  }

  return {
    ok: true,
    uid: userRecord.uid,
    email: em,
    defaultPassword,
    role,
    passwordResetSent,
    passwordResetError,
  };
});

/** Resend Firebase password-reset email for an employee */
exports.sendEmployeePasswordReset = onCall({ region: 'us-central1' }, async (request) => {
  assertAdminOrDev(request);
  const { uid, email } = request.data || {};
  let em = email ? String(email).trim().toLowerCase() : '';
  if (uid) {
    const snap = await db.collection('users').doc(uid).get();
    if (!snap.exists) throw new HttpsError('not-found', 'Employee not found');
    em = em || String(snap.data().email || '').trim().toLowerCase();
  }
  if (!em) throw new HttpsError('invalid-argument', 'uid or email required');
  try {
    await sendFirebasePasswordResetEmail(em);
  } catch (e) {
    throw new HttpsError('internal', e.message || 'Could not send password reset email');
  }
  await db.collection('audit_log').add({
    action: 'employee.password_reset',
    entityType: 'employee',
    entityId: uid || em,
    userId: request.auth.uid,
    at: FieldValue.serverTimestamp(),
  });
  return { ok: true, email: em, passwordResetSent: true };
});

/** Archive employee: disable login, keep HR record */
exports.archiveEmployee = onCall({ region: 'us-central1' }, async (request) => {
  assertAdminOrDev(request);
  const { uid } = request.data || {};
  if (!uid) throw new HttpsError('invalid-argument', 'uid required');
  if (uid === request.auth.uid) {
    throw new HttpsError('failed-precondition', 'You cannot archive your own account');
  }

  const userRef = db.collection('users').doc(uid);
  const snap = await userRef.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Employee not found');

  try {
    await auth.updateUser(uid, { disabled: true });
  } catch (e) {
    if (e.code !== 'auth/user-not-found') {
      throw new HttpsError('internal', e.message || 'Could not disable Auth user');
    }
  }

  await userRef.set({
    status: 'Archived',
    active: false,
    archived: true,
    archivedAt: FieldValue.serverTimestamp(),
    archivedBy: request.auth.uid,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  await upsertMessagingRoster(uid, { ...(snap.data() || {}), status: 'Archived', active: false });
  await syncShopConversationParticipants().catch((e) => console.warn('shop sync:', e.message));

  await db.collection('audit_log').add({
    action: 'employee.archive',
    entityType: 'employee',
    entityId: uid,
    userId: request.auth.uid,
    at: FieldValue.serverTimestamp(),
  });

  return { ok: true, uid, status: 'Archived' };
});

/** Restore archived employee */
exports.unarchiveEmployee = onCall({ region: 'us-central1' }, async (request) => {
  assertAdminOrDev(request);
  const { uid } = request.data || {};
  if (!uid) throw new HttpsError('invalid-argument', 'uid required');

  const userRef = db.collection('users').doc(uid);
  const snap = await userRef.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Employee not found');

  try {
    await auth.updateUser(uid, { disabled: false });
  } catch (e) {
    if (e.code !== 'auth/user-not-found') {
      throw new HttpsError('internal', e.message || 'Could not enable Auth user');
    }
  }

  await userRef.set({
    status: 'Active',
    active: true,
    archived: false,
    archivedAt: FieldValue.delete(),
    archivedBy: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  await upsertMessagingRoster(uid, { ...(snap.data() || {}), status: 'Active', active: true });
  await syncShopConversationParticipants().catch((e) => console.warn('shop sync:', e.message));

  await db.collection('audit_log').add({
    action: 'employee.unarchive',
    entityType: 'employee',
    entityId: uid,
    userId: request.auth.uid,
    at: FieldValue.serverTimestamp(),
  });

  return { ok: true, uid, status: 'Active' };
});

/** Permanently delete employee Auth account + HR profile */
exports.deleteEmployee = onCall({ region: 'us-central1' }, async (request) => {
  assertAdminOrDev(request);
  const { uid } = request.data || {};
  if (!uid) throw new HttpsError('invalid-argument', 'uid required');
  if (uid === request.auth.uid) {
    throw new HttpsError('failed-precondition', 'You cannot delete your own account');
  }

  const userRef = db.collection('users').doc(uid);
  const snap = await userRef.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Employee not found');
  const data = snap.data() || {};

  try {
    await auth.deleteUser(uid);
  } catch (e) {
    if (e.code !== 'auth/user-not-found') {
      throw new HttpsError('internal', e.message || 'Could not delete Auth user');
    }
  }

  await userRef.delete();
  await removeMessagingRoster(uid);
  await syncShopConversationParticipants().catch((e) => console.warn('shop sync:', e.message));

  await db.collection('audit_log').add({
    action: 'employee.delete',
    entityType: 'employee',
    entityId: uid,
    userId: request.auth.uid,
    meta: { email: data.email || '', name: data.name || '' },
    at: FieldValue.serverTimestamp(),
  });

  return { ok: true, uid, deleted: true };
});

/** Update an employee profile: admin/developer (any field) or self (limited fields) */
exports.updateEmployee = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');
  const { uid, patch } = request.data || {};
  if (!uid || !patch || typeof patch !== 'object') {
    throw new HttpsError('invalid-argument', 'uid and patch required');
  }

  const callerRole = request.auth.token.role;
  const isAdminOrDev = callerRole === 'admin' || callerRole === 'developer';
  const isSelf = request.auth.uid === uid;
  if (!isAdminOrDev && !isSelf) {
    throw new HttpsError('permission-denied', 'Admin or developer role required');
  }

  const userRef = db.collection('users').doc(uid);
  const snap = await userRef.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Employee not found');

  let fields = { ...patch };
  if (!isAdminOrDev) {
    fields = Object.fromEntries(
      Object.entries(fields).filter(([k]) => SELF_UPDATE_FIELDS.includes(k)),
    );
    if (!Object.keys(fields).length) {
      throw new HttpsError('invalid-argument', 'No editable fields provided');
    }
  } else if (fields.role && fields.role !== snap.data().role) {
    if (fields.role === 'developer' && callerRole !== 'developer') {
      throw new HttpsError('permission-denied', 'Only a developer can grant the developer role');
    }
    await setRole(uid, fields.role);
  }

  if (isAdminOrDev && fields.status === 'Terminated') {
    fields.active = false;
  } else if (isAdminOrDev && fields.status && EMPLOYEE_STATUSES.includes(fields.status)) {
    fields.active = true;
  }

  fields.updatedAt = FieldValue.serverTimestamp();
  await userRef.set(fields, { merge: true });

  const merged = { ...(snap.data() || {}), ...fields };
  await upsertMessagingRoster(uid, merged);
  if (fields.status || fields.role || fields.name || fields.active !== undefined) {
    await syncShopConversationParticipants().catch((e) => console.warn('shop sync:', e.message));
  }

  await db.collection('audit_log').add({
    action: 'employee.update',
    entityType: 'employee',
    entityId: uid,
    userId: request.auth.uid,
    at: FieldValue.serverTimestamp(),
  });

  return { ok: true, uid };
});

/** Bootstrap messaging roster + shop channel for all active staff */
exports.ensureMessaging = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');
  const role = request.auth.token.role;
  if (!['admin', 'office', 'technician', 'developer'].includes(role)) {
    throw new HttpsError('permission-denied', 'Staff only');
  }

  const usersSnap = await db.collection('users').get();
  let synced = 0;
  for (const doc of usersSnap.docs) {
    const d = doc.data() || {};
    if (!d.email && !d.name) continue;
    await upsertMessagingRoster(doc.id, d);
    synced += 1;
  }
  const shop = await syncShopConversationParticipants();
  return { ok: true, synced, shop };
});

/** List recent audit log entries (admin/developer only) — used for audit export */
exports.listAuditLog = onCall({ region: 'us-central1' }, async (request) => {
  assertAdminOrDev(request);
  const snap = await db.collection('audit_log').orderBy('at', 'desc').limit(500).get();
  const items = snap.docs.map((d) => {
    const data = d.data();
    const at = data.at?.toDate?.() ? data.at.toDate().toISOString() : (data.at || null);
    return { id: d.id, ...data, at };
  });
  return { ok: true, items };
});

/**
 * One-time bootstrap: creates staff Auth users, custom claims, and Firestore profiles.
 * Call after deploy with bootstrap secret (set via firebase functions:secrets:set BOOTSTRAP_SECRET)
 * or pass secret in request during first setup.
 */
exports.bootstrapStaff = onCall({ region: 'us-central1' }, async (request) => {
  const { secret, overwritePasswords } = request.data || {};
  const expected = process.env.BOOTSTRAP_SECRET || 'alex-road-bootstrap-2026';
  if (secret !== expected) {
    throw new HttpsError('permission-denied', 'Invalid bootstrap secret');
  }

  const existing = await db.collection('users').limit(1).get();
  if (!existing.empty && !request.auth?.token?.role?.match(/admin|developer/)) {
    const meta = await db.collection('settings').doc('platform').get();
    if (meta.exists && meta.data().bootstrapped) {
      throw new HttpsError('already-exists', 'Already bootstrapped. Use setUserRole as admin/developer.');
    }
  }

  const results = [];
  for (const staff of STAFF_SEED) {
    const email = staff.email.toLowerCase();
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(email);
      if (overwritePasswords) {
        await auth.updateUser(userRecord.uid, { password: staff.password, displayName: staff.name });
      }
    } catch (e) {
      if (e.code === 'auth/user-not-found') {
        userRecord = await auth.createUser({
          email,
          password: staff.password,
          displayName: staff.name,
          emailVerified: true,
        });
      } else {
        throw e;
      }
    }
    await setRole(userRecord.uid, staff.role);
    await upsertUserProfile(userRecord.uid, {
      email,
      name: staff.name,
      role: staff.role,
    });
    results.push({ email, uid: userRecord.uid, role: staff.role });
  }

  await db.collection('settings').doc('platform').set({
    bootstrapped: true,
    bootstrappedAt: FieldValue.serverTimestamp(),
    shopName: 'Alex Road Service',
    laborRate: 95,
    partsMarkup: 0.4,
    taxRate: 0.06625,
    paymentTermsDays: 14,
  }, { merge: true });

  await db.collection('settings').doc('shop').set({
    shopName: 'Alex Road Service',
    shopAddress: '406 Smith St, Keasbey, NJ 08832',
    shopPhone: '(732) 938-0713',
    shopEmail: 'info@alexroadservice.com',
    laborRate: 95,
    partsMarkup: 0.4,
    taxRate: 0.06625,
    paymentTermsDays: 14,
  }, { merge: true });

  return { ok: true, users: results, message: 'Change default passwords in Firebase Console immediately.' };
});

/** Create Stripe Checkout session for an invoice payment */
exports.createStripeCheckout = onCall(
  { region: 'us-central1', secrets: ['STRIPE_SECRET_KEY'] },
  async (request) => {
    assertPaymentRole(request);
    const { invoiceId, amount } = request.data || {};
    if (!invoiceId) throw new HttpsError('invalid-argument', 'invoiceId required');

    const invSnap = await db.collection('invoices').doc(invoiceId).get();
    if (!invSnap.exists) throw new HttpsError('not-found', 'Invoice not found');
    const inv = invSnap.data();
    if (['Paid', 'Written Off'].includes(inv.status)) {
      throw new HttpsError('failed-precondition', 'Invoice is already closed');
    }

    const balance = (inv.total || 0) - (inv.amountPaid || 0);
    const payAmount = amount != null ? Number(amount) : balance;
    if (!payAmount || payAmount <= 0) throw new HttpsError('invalid-argument', 'Invalid amount');
    if (payAmount > balance + 0.01) throw new HttpsError('invalid-argument', 'Amount exceeds invoice balance');

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Invoice ${invoiceId}`,
            description: `${inv.customerName || 'Customer'} — Alex Road Service`,
          },
          unit_amount: Math.round(payAmount * 100),
        },
        quantity: 1,
      }],
      metadata: {
        invoiceId,
        customerName: inv.customerName || '',
        initiatedBy: request.auth.uid,
      },
      success_url: `${HOSTING_URL}/app/payment-success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${HOSTING_URL}/app/invoice-detail.html?id=${invoiceId}&cancelled=1`,
    });

    return { url: session.url, sessionId: session.id };
  },
);

/** Admin/developer: refund a Stripe payment (full or partial) */
exports.createStripeRefund = onCall(
  { region: 'us-central1', secrets: ['STRIPE_SECRET_KEY'] },
  async (request) => {
    assertAdminOrDev(request);
    const { paymentId, amount, reason } = request.data || {};
    if (!paymentId) throw new HttpsError('invalid-argument', 'paymentId required');

    const payRef = db.collection('payments').doc(paymentId);
    const paySnap = await payRef.get();
    if (!paySnap.exists) throw new HttpsError('not-found', 'Payment not found');
    const pay = paySnap.data();

    if (!pay.stripePaymentIntentId) {
      throw new HttpsError(
        'failed-precondition',
        'This payment has no Stripe payment intent and cannot be refunded through Stripe',
      );
    }

    const paid = Number(pay.amount) || 0;
    const alreadyRefunded = Number(pay.refundedAmount) || 0;
    const refundable = Math.round((paid - alreadyRefunded) * 100) / 100;

    // Ledger already fully refunded — treat as success so the UI can refresh
    if (pay.status === 'Refunded' || refundable <= 0.01) {
      return {
        ok: true,
        alreadyRefunded: true,
        paymentId,
        amount: 0,
        refundedAmount: alreadyRefunded || paid,
        status: 'Refunded',
      };
    }

    const refundAmount = amount != null ? Number(amount) : refundable;
    if (!refundAmount || refundAmount <= 0) {
      throw new HttpsError('invalid-argument', 'Invalid refund amount');
    }
    if (refundAmount > refundable + 0.01) {
      throw new HttpsError('invalid-argument', `Amount exceeds refundable balance (${refundable.toFixed(2)})`);
    }

    const stripeReason = ['duplicate', 'fraudulent', 'requested_by_customer'].includes(reason)
      ? reason
      : 'requested_by_customer';

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    let refund;
    try {
      refund = await stripe.refunds.create(
        {
          payment_intent: pay.stripePaymentIntentId,
          amount: Math.round(refundAmount * 100),
          reason: stripeReason,
          metadata: {
            paymentId,
            invoiceId: pay.invoiceId || '',
            refundedBy: request.auth.uid,
            note: typeof reason === 'string' && !['duplicate', 'fraudulent', 'requested_by_customer'].includes(reason)
              ? reason.slice(0, 400)
              : '',
          },
        },
        { idempotencyKey: `refund_${paymentId}_${Math.round(refundAmount * 100)}_${alreadyRefunded}` },
      );
    } catch (err) {
      console.error('Stripe refund failed:', err);
      const msg = err?.raw?.message || err?.message || 'Stripe refund failed';
      const code = err?.code || err?.raw?.code || '';
      // Stripe already refunded (earlier attempt) — sync absolute refunded amount into our ledger
      if (/already been refunded|charge_already_refunded/i.test(msg) || code === 'charge_already_refunded') {
        try {
          const pi = await stripe.paymentIntents.retrieve(pay.stripePaymentIntentId, {
            expand: ['latest_charge', 'latest_charge.refunds'],
          });
          const charge = typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
          const amountRefundedTotal = ((charge?.amount_refunded != null
            ? charge.amount_refunded
            : (pi.amount_received || paid * 100)) / 100);
          const latestRefund = charge?.refunds?.data?.[0];
          const applied = await applyStripeRefund({
            paymentId,
            paymentIntentId: pay.stripePaymentIntentId,
            refundId: latestRefund?.id || `sync_${paymentId}`,
            amountRefundedTotal,
            reason: reason || 'sync_already_refunded',
            eventId: `sync_refund_${paymentId}_${latestRefund?.id || Math.round(amountRefundedTotal * 100)}`,
            refundedBy: request.auth.uid,
          });
          return {
            ok: true,
            synced: true,
            paymentId,
            amount: applied?.amount || amountRefundedTotal,
            refundedAmount: applied?.refundedAmount || amountRefundedTotal,
            status: applied?.status || 'Refunded',
            refundId: latestRefund?.id || null,
          };
        } catch (syncErr) {
          console.error('Sync after already-refunded failed:', syncErr);
          throw new HttpsError('internal', syncErr.message || msg);
        }
      }
      if (/exceeds|insufficient|No such payment/i.test(msg)) {
        throw new HttpsError('failed-precondition', msg);
      }
      throw new HttpsError('internal', msg);
    }

    try {
      const applied = await applyStripeRefund({
        paymentId,
        refundId: refund.id,
        amountDelta: refundAmount,
        reason: reason || stripeReason,
        eventId: `refund_${refund.id}`,
        refundedBy: request.auth.uid,
      });

      return {
        ok: true,
        refundId: refund.id,
        paymentId,
        amount: refundAmount,
        refundedAmount: applied?.refundedAmount,
        status: applied?.status || null,
        stripeStatus: refund.status,
      };
    } catch (err) {
      console.error('applyStripeRefund failed after Stripe refund:', err);
      throw new HttpsError(
        'internal',
        `Stripe refund ${refund.id} succeeded but ledger update failed: ${err.message}. Retry the same refund or refresh payments.`,
      );
    }
  },
);

/** Stripe webhook — records payments and refunds (server-side only) */
exports.stripeWebhook = onRequest(
  { region: 'us-central1', secrets: ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'] },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed');
      return;
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const sig = req.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      console.error('Stripe webhook signature failed:', err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    try {
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        if (session.payment_status === 'paid' && session.metadata?.invoiceId) {
          await recordStripePayment({
            invoiceId: session.metadata.invoiceId,
            amount: (session.amount_total || 0) / 100,
            sessionId: session.id,
            paymentIntentId: session.payment_intent,
            customerName: session.metadata.customerName,
            eventId: event.id,
          });
        }
      } else if (event.type === 'charge.refunded') {
        const charge = event.data.object;
        const paymentIntentId = typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : charge.payment_intent?.id;
        if (paymentIntentId) {
          const refunds = charge.refunds?.data || [];
          const latest = refunds[0];
          await applyStripeRefund({
            paymentIntentId,
            refundId: latest?.id || null,
            amountRefundedTotal: (charge.amount_refunded || 0) / 100,
            reason: latest?.reason || 'stripe_dashboard',
            eventId: event.id,
            refundedBy: 'stripe_webhook',
          });
        }
      } else if (event.type === 'refund.updated' || event.type === 'refund.created') {
        const refund = event.data.object;
        if (refund.status === 'succeeded' || refund.status === 'pending') {
          const paymentIntentId = typeof refund.payment_intent === 'string'
            ? refund.payment_intent
            : refund.payment_intent?.id;
          if (paymentIntentId && refund.id) {
            await applyStripeRefund({
              paymentIntentId,
              refundId: refund.id,
              amountDelta: (refund.amount || 0) / 100,
              reason: refund.reason || refund.metadata?.note || 'stripe_refund',
              eventId: `refund_${refund.id}`,
              refundedBy: refund.metadata?.refundedBy || 'stripe_webhook',
            });
          }
        }
      }
      res.json({ received: true });
    } catch (err) {
      console.error('Stripe webhook handler error:', err);
      res.status(500).send('Webhook handler failed');
    }
  },
);
