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
      invoiceId,
      amount,
      method: 'Stripe',
      status: 'Completed',
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
const LEGACY_NAMES = ['washex', 'james construction', 'reid trucking', 'lopez distribution', 'kim brothers'];
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

/** Stripe webhook — records payments and updates invoices (server-side only) */
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
      }
      res.json({ received: true });
    } catch (err) {
      console.error('Stripe webhook handler error:', err);
      res.status(500).send('Webhook handler failed');
    }
  },
);
