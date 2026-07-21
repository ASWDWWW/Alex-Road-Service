const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const logger = require('firebase-functions/logger');
const { createHash, randomBytes } = require('crypto');
const Stripe = require('stripe');
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();
const auth = getAuth();

const HOSTING_URL = 'https://launchpage-alex-roadservice.web.app';

function cleanText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

exports.healthCheck = onRequest({ region: 'us-central1', cors: false }, async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).send('Method not allowed');
    return;
  }
  res.set('Cache-Control', 'no-store');
  try {
    await db.collection('settings').doc('shop').get();
    res.status(200).json({ ok: true, service: 'alex-road-service', checkedAt: new Date().toISOString() });
  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(503).json({ ok: false, service: 'alex-road-service' });
  }
});

async function assertActiveStaff(request, allowedRoles) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Login required');
  const role = request.auth.token.role;
  if (!allowedRoles.includes(role)) {
    throw new HttpsError('permission-denied', 'Role is not authorized for this operation');
  }
  const profile = await db.collection('users').doc(request.auth.uid).get();
  const data = profile.data();
  if (!profile.exists || data.active !== true || ['Archived', 'Terminated'].includes(data.status)) {
    throw new HttpsError('permission-denied', 'Staff account is inactive');
  }
  return data;
}

async function assertAdminOrDev(request) {
  return assertActiveStaff(request, ['admin', 'developer']);
}

async function assertPaymentRole(request) {
  return assertActiveStaff(request, ['admin', 'office', 'developer']);
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
    const creditBalance = Math.max(0, Math.round((newPaid - (inv.total || 0)) * 100) / 100);

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
      creditBalance,
      checkoutReservation: FieldValue.delete(),
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

exports.onScheduleBlockWrite = onDocumentWritten(
  { document: 'scheduleBlocks/{blockId}', region: 'us-central1' },
  async (event) => {
    const after = event.data?.after?.data();
    const before = event.data?.before?.data();
    if (!after || before) return;

    const employeeIds = [...new Set(
      (Array.isArray(after.employeeIds) ? after.employeeIds : []).filter(Boolean),
    )];
    if (!employeeIds.length) return;

    const start = new Date(after.startAt);
    const dateKey = Number.isNaN(start.getTime())
      ? ''
      : new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(start);
    const dateLabel = Number.isNaN(start.getTime())
      ? 'your schedule'
      : new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }).format(start);

    await Promise.all(employeeIds.map(async (uid) => {
      const ref = db.collection('notifications').doc(`schedule_${event.params.blockId}_${uid}`);
      try {
        await ref.create({
          userId: uid,
          read: false,
          type: 'info',
          message: `New schedule block: ${after.title || 'Schedule update'} · ${dateLabel}`,
          entityType: 'schedule',
          entityId: event.params.blockId,
          href: `/app/schedule.html?employeeId=${encodeURIComponent(uid)}&view=day${dateKey ? `&date=${dateKey}` : ''}`,
          createdAt: FieldValue.serverTimestamp(),
        });
      } catch (error) {
        // Firestore triggers are at-least-once; preserve an existing read receipt on retry.
        if (error.code !== 6 && error.code !== 'already-exists') throw error;
      }
    }));
  },
);

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

exports.submitContact = onCall({
  region: 'us-central1',
  cors: [
    HOSTING_URL,
    'https://alexroadservice.com',
    'https://www.alexroadservice.com',
  ],
}, async (request) => {
  const data = request.data || {};
  const name = cleanText(data.name, 120);
  const email = cleanText(data.email, 254).toLowerCase();
  const message = cleanText(data.message, 4000);
  if (!name || !email || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError('invalid-argument', 'Name, a valid email, and message are required');
  }

  const rawIp = request.rawRequest?.ip
    || request.rawRequest?.headers?.['x-forwarded-for']
    || 'unknown';
  const ipHash = createHash('sha256').update(String(rawIp).split(',')[0].trim()).digest('hex');
  const limitRef = db.collection('rate_limits').doc(`contact_${ipHash}`);
  const nowMs = Date.now();
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(limitRef);
    const previous = snap.data() || {};
    const activeWindow = nowMs - Number(previous.windowStartedAt || 0) < 10 * 60 * 1000;
    const count = activeWindow ? Number(previous.count || 0) : 0;
    if (count >= 5) throw new HttpsError('resource-exhausted', 'Too many requests. Please call the shop.');
    tx.set(limitRef, {
      windowStartedAt: activeWindow ? previous.windowStartedAt : nowMs,
      count: count + 1,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  const submission = {
    name,
    company: cleanText(data.company, 160),
    email,
    phone: cleanText(data.phone, 40),
    service: cleanText(data.service, 100),
    truck: cleanText(data.truck, 160),
    location: cleanText(data.location, 300),
    message,
    source: 'website-contact-form',
    media: [],
    status: 'New',
    version: 1,
    createdAt: new Date().toISOString(),
  };
  const ref = await db.collection('contact_submissions').add(submission);
  return { id: ref.id };
});

exports.nextSequentialId = onCall({ region: 'us-central1' }, async (request) => {
  await assertActiveStaff(request, ['admin', 'office', 'technician', 'developer']);
  const { prefix, year } = request.data;
  if (!prefix || !year) throw new HttpsError('invalid-argument', 'prefix and year required');
  if (!['C', 'T', 'WO', 'EST', 'INV', 'P'].includes(prefix)) {
    throw new HttpsError('invalid-argument', 'Unsupported record prefix');
  }
  if (Number(year) !== new Date().getFullYear()) {
    throw new HttpsError('invalid-argument', 'Invalid record year');
  }
  const counterRef = db.collection('counters').doc(`${prefix}_${year}`);
  const id = await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const num = (snap.exists ? snap.data().value : 0) + 1;
    tx.set(counterRef, { value: num, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return `${prefix}-${year}-${String(num).padStart(4, '0')}`;
  });
  return { id };
});

const CLIENT_ENTITY_COLLECTIONS = new Set([
  'customers',
  'trucks',
  'workOrders',
  'estimates',
  'invoices',
  'inventory',
  'contact_submissions',
]);

function changedEntityKeys(before, after) {
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
}

function validateEntityValue(value, depth = 0) {
  if (depth > 6) return false;
  if (value == null || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') return value.length <= 10000;
  if (Array.isArray(value)) {
    return value.length <= 100 && value.every((entry) => validateEntityValue(entry, depth + 1));
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    return keys.length <= 100
      && keys.every((key) => !key.startsWith('__') && validateEntityValue(value[key], depth + 1));
  }
  return false;
}

function validateEntityShape(collectionName, item) {
  const required = {
    customers: ['id', 'name', 'phone', 'status', 'version', 'createdAt'],
    trucks: ['id', 'unit', 'year', 'make', 'model', 'customerId', 'status', 'version', 'createdAt'],
    workOrders: [
      'id', 'customerId', 'customerName', 'techIds', 'status', 'desc',
      'labor', 'parts', 'tax', 'total', 'invoiced', 'media', 'version', 'createdAt',
    ],
    estimates: [
      'id', 'customerName', 'desc', 'labor', 'parts', 'total', 'status', 'version', 'createdAt',
    ],
    invoices: [
      'id', 'customerName', 'workOrderId', 'total', 'amountPaid', 'status', 'version', 'createdAt',
    ],
    inventory: [
      'id', 'partNo', 'desc', 'qty', 'min', 'cost', 'price', 'status', 'version', 'createdAt',
    ],
    contact_submissions: ['id', 'name', 'email', 'message', 'status', 'version', 'createdAt'],
  }[collectionName] || [];
  if (!required.every((key) => Object.prototype.hasOwnProperty.call(item, key))) return false;
  if (!Number.isInteger(Number(item.version)) || Number(item.version) < 1) return false;
  return validateEntityValue(item);
}

exports.saveEntity = onCall({ region: 'us-central1' }, async (request) => {
  await assertActiveStaff(request, ['admin', 'office', 'technician', 'developer']);
  const { collectionName, item } = request.data || {};
  if (!CLIENT_ENTITY_COLLECTIONS.has(collectionName) || !item || typeof item !== 'object') {
    throw new HttpsError('invalid-argument', 'Unsupported entity payload');
  }
  const id = cleanText(item.id, 100);
  if (!id || id !== item.id || JSON.stringify(item).length > 100000
    || !validateEntityShape(collectionName, item)) {
    throw new HttpsError('invalid-argument', 'Invalid entity ID or payload size');
  }

  const role = request.auth.token.role;
  const isOfficeRole = ['admin', 'office', 'developer'].includes(role);
  if (!isOfficeRole && collectionName !== 'workOrders') {
    throw new HttpsError('permission-denied', 'Office role required');
  }

  const ref = db.collection(collectionName).doc(id);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      if (!isOfficeRole || ['invoices', 'contact_submissions'].includes(collectionName)) {
        throw new HttpsError('permission-denied', 'This entity must be created by a server workflow');
      }
      const created = {
        ...item,
        id,
        version: 1,
        createdAt: item.createdAt || new Date().toISOString(),
      };
      tx.create(ref, created);
      return created;
    }

    const current = snap.data();
    const expectedVersion = Number(item.version) - 1;
    if (!Number.isInteger(expectedVersion)
      || expectedVersion !== Number(current.version || 1)) {
      throw new HttpsError('aborted', 'Record changed. Refresh and try again.');
    }
    if (item.createdAt !== current.createdAt || item.id !== current.id) {
      throw new HttpsError('invalid-argument', 'Immutable entity fields cannot be changed');
    }

    const changed = changedEntityKeys(current, item)
      .filter((key) => !['version', 'updatedAt'].includes(key));
    if (collectionName === 'workOrders') {
      if (role === 'technician') {
        if (!(current.techIds || []).includes(request.auth.uid)
          || ['Completed', 'Invoiced'].includes(current.status)
          || !changed.every((key) => ['status', 'desc', 'notes', 'media'].includes(key))
          || ['Completed', 'Invoiced'].includes(item.status)) {
          throw new HttpsError('permission-denied', 'Technician update is not allowed');
        }
      } else if (['Completed', 'Invoiced'].includes(item.status)
        && item.status !== current.status) {
        throw new HttpsError('failed-precondition', 'Use the completion or invoicing workflow');
      }
    }
    if (collectionName === 'inventory' && Number(item.qty) !== Number(current.qty)) {
      throw new HttpsError('failed-precondition', 'Use the inventory adjustment workflow');
    }
    if (collectionName === 'invoices') {
      const protectedKeys = [
        'amountPaid', 'total', 'workOrderId', 'customerId', 'createdAt',
        'creditBalance', 'checkoutReservation',
      ];
      if (changed.some((key) => protectedKeys.includes(key))) {
        throw new HttpsError('permission-denied', 'Protected invoice fields cannot be changed');
      }
      if (item.status === 'Written Off' && !['admin', 'developer'].includes(role)) {
        throw new HttpsError('permission-denied', 'Admin role required to write off an invoice');
      }
    }
    if (collectionName === 'contact_submissions'
      && !changed.every((key) => ['status', 'notes', 'assignedTo'].includes(key))) {
      throw new HttpsError('permission-denied', 'Only lead workflow fields can be changed');
    }

    const saved = {
      ...item,
      version: Number(current.version || 1) + 1,
      updatedAt: new Date().toISOString(),
    };
    tx.set(ref, saved);
    return saved;
  });
});

exports.saveShopSettings = onCall({ region: 'us-central1' }, async (request) => {
  await assertAdminOrDev(request);
  const patch = request.data?.patch;
  if (!patch || typeof patch !== 'object') {
    throw new HttpsError('invalid-argument', 'Settings patch required');
  }
  const allowed = new Set([
    'shopName', 'shopAddress', 'shopPhone', 'shopEmail',
    'laborRate', 'partsMarkup', 'taxRate', 'paymentTermsDays',
    'shopLogoUrl', 'shopLogoPath',
  ]);
  if (!Object.keys(patch).every((key) => allowed.has(key))) {
    throw new HttpsError('invalid-argument', 'Unsupported settings field');
  }
  const numericBounds = {
    laborRate: [0, 1000],
    partsMarkup: [0, 10],
    taxRate: [0, 0.25],
    paymentTermsDays: [0, 365],
  };
  for (const [key, [min, max]] of Object.entries(numericBounds)) {
    if (patch[key] != null
      && (!Number.isFinite(Number(patch[key])) || Number(patch[key]) < min || Number(patch[key]) > max)) {
      throw new HttpsError('invalid-argument', `Invalid ${key}`);
    }
  }
  for (const key of ['shopName', 'shopAddress', 'shopPhone', 'shopEmail', 'shopLogoUrl', 'shopLogoPath']) {
    if (patch[key] != null && (typeof patch[key] !== 'string' || patch[key].length > 1000)) {
      throw new HttpsError('invalid-argument', `Invalid ${key}`);
    }
  }
  const saved = { ...patch, updatedAt: FieldValue.serverTimestamp(), updatedBy: request.auth.uid };
  await db.collection('settings').doc('shop').set(saved, { merge: true });
  await db.collection('audit_log').add({
    action: 'settings.update',
    entityType: 'settings',
    entityId: 'shop',
    userId: request.auth.uid,
    at: FieldValue.serverTimestamp(),
  });
  return { ...patch };
});

exports.completeWorkOrder = onCall({ region: 'us-central1' }, async (request) => {
  await assertActiveStaff(request, ['admin', 'office', 'technician', 'developer']);
  const role = request.auth.token.role;
  const { workOrderId, expectedVersion } = request.data || {};
  if (!workOrderId) throw new HttpsError('invalid-argument', 'workOrderId required');

  const woRef = db.collection('workOrders').doc(workOrderId);
  const result = await db.runTransaction(async (tx) => {
    const woSnap = await tx.get(woRef);
    if (!woSnap.exists) throw new HttpsError('not-found', 'Work order not found');
    const wo = woSnap.data();
    if (role === 'technician' && !(wo.techIds || []).includes(request.auth.uid)) {
      throw new HttpsError('permission-denied', 'Work order is not assigned to this technician');
    }
    if (wo.status === 'Completed' || wo.status === 'Invoiced') {
      return { alreadyCompleted: true, workOrder: { id: woSnap.id, ...wo } };
    }
    if (expectedVersion != null && Number(wo.version || 1) !== Number(expectedVersion)) {
      throw new HttpsError('aborted', 'Work order changed. Refresh and try again.');
    }

    const deductions = new Map();
    (Array.isArray(wo.lineItems) ? wo.lineItems : []).forEach((line) => {
      if (!line?.partId || !(Number(line.qty) > 0)) return;
      deductions.set(line.partId, (deductions.get(line.partId) || 0) + Number(line.qty));
    });
    const inventoryRows = [];
    for (const [partId, quantity] of deductions) {
      const partRef = db.collection('inventory').doc(partId);
      const partSnap = await tx.get(partRef);
      if (!partSnap.exists) {
        throw new HttpsError('failed-precondition', `Inventory part ${partId} was not found`);
      }
      inventoryRows.push({ partId, quantity, partRef, part: partSnap.data() });
    }

    const now = new Date().toISOString();
    for (const { partId, quantity, partRef, part } of inventoryRows) {
      const currentQty = Number(part.qty) || 0;
      if (currentQty < quantity) {
        throw new HttpsError('failed-precondition', `Insufficient stock for ${partId}`);
      }
      const nextQty = currentQty - quantity;
      const min = Number(part.min) || 0;
      const status = nextQty <= 0 ? 'Out of Stock' : nextQty <= min ? 'Low' : 'In Stock';
      tx.update(partRef, {
        qty: nextQty,
        status,
        version: Number(part.version || 1) + 1,
        updatedAt: now,
      });
      const txId = `wo_${String(workOrderId).replace(/[^a-zA-Z0-9_-]/g, '_')}_${String(partId).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
      tx.set(db.collection('inventoryTransactions').doc(txId), {
        id: txId,
        partId,
        delta: -quantity,
        reason: `workOrder:${workOrderId}`,
        workOrderId,
        at: now,
        createdBy: request.auth.uid,
      });
    }

    const updated = {
      status: 'Completed',
      inventoryDeductedAt: now,
      inventoryDeductedBy: request.auth.uid,
      version: Number(wo.version || 1) + 1,
      updatedAt: now,
    };
    tx.update(woRef, updated);
    return { alreadyCompleted: false, workOrder: { id: woSnap.id, ...wo, ...updated } };
  });

  return result;
});

exports.adjustInventory = onCall({ region: 'us-central1' }, async (request) => {
  await assertPaymentRole(request);
  const { partId, delta, reason } = request.data || {};
  const quantityDelta = Number(delta);
  if (!partId || !Number.isFinite(quantityDelta) || quantityDelta === 0) {
    throw new HttpsError('invalid-argument', 'partId and a non-zero numeric delta are required');
  }
  if (Math.abs(quantityDelta) > 100000) {
    throw new HttpsError('invalid-argument', 'Inventory adjustment is too large');
  }
  const safeReason = String(reason || 'adjustment').trim().slice(0, 300);
  const partRef = db.collection('inventory').doc(partId);
  const transactionId = `adj_${Date.now()}_${randomBytes(8).toString('hex')}`;

  return db.runTransaction(async (tx) => {
    const partSnap = await tx.get(partRef);
    if (!partSnap.exists) throw new HttpsError('not-found', 'Inventory part not found');
    const part = partSnap.data();
    const nextQty = (Number(part.qty) || 0) + quantityDelta;
    if (nextQty < 0) throw new HttpsError('failed-precondition', 'Adjustment would make stock negative');
    const min = Number(part.min) || 0;
    const status = nextQty <= 0 ? 'Out of Stock' : nextQty <= min ? 'Low' : 'In Stock';
    const now = new Date().toISOString();
    const updated = {
      qty: nextQty,
      status,
      version: Number(part.version || 1) + 1,
      updatedAt: now,
    };
    tx.update(partRef, updated);
    tx.create(db.collection('inventoryTransactions').doc(transactionId), {
      id: transactionId,
      partId,
      delta: quantityDelta,
      reason: safeReason,
      at: now,
      createdBy: request.auth.uid,
    });
    return { part: { id: partSnap.id, ...part, ...updated }, transactionId };
  });
});

exports.createInvoiceFromWorkOrder = onCall({ region: 'us-central1' }, async (request) => {
  await assertPaymentRole(request);
  const { workOrderId } = request.data || {};
  if (!workOrderId) throw new HttpsError('invalid-argument', 'workOrderId required');

  const year = new Date().getFullYear();
  const woRef = db.collection('workOrders').doc(workOrderId);
  const settingsRef = db.collection('settings').doc('shop');
  const counterRef = db.collection('counters').doc(`INV_${year}`);

  return db.runTransaction(async (tx) => {
    const [woSnap, settingsSnap, counterSnap] = await Promise.all([
      tx.get(woRef),
      tx.get(settingsRef),
      tx.get(counterRef),
    ]);
    if (!woSnap.exists) throw new HttpsError('not-found', 'Work order not found');
    const wo = woSnap.data();
    if (wo.invoiced || wo.status === 'Invoiced') {
      throw new HttpsError('already-exists', 'Work order has already been invoiced');
    }
    if (wo.status !== 'Completed') {
      throw new HttpsError('failed-precondition', 'Work order must be completed before invoicing');
    }

    const next = Number(counterSnap.data()?.value || 0) + 1;
    const invoiceId = `INV-${year}-${String(next).padStart(4, '0')}`;
    const now = new Date();
    const due = new Date(now);
    due.setDate(due.getDate() + Number(settingsSnap.data()?.paymentTermsDays || 14));
    const invoice = {
      id: invoiceId,
      date: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      due: due.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      customerName: wo.customerName || '',
      customerId: wo.customerId || null,
      workOrderId,
      total: Number(wo.total) || 0,
      amountPaid: 0,
      status: 'Sent',
      version: 1,
      createdAt: now.toISOString(),
      createdBy: request.auth.uid,
    };

    tx.set(counterRef, { value: next, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.create(db.collection('invoices').doc(invoiceId), invoice);
    tx.update(woRef, {
      invoiced: true,
      invoiceId,
      status: 'Invoiced',
      version: Number(wo.version || 1) + 1,
      updatedAt: now.toISOString(),
    });
    return invoice;
  });
});

exports.markOverdueInvoices = onSchedule('every 24 hours', async () => {
  const now = new Date();
  const snap = await db.collection('invoices')
    .where('status', 'in', ['Sent', 'Partially Paid'])
    .get();
  const overdue = snap.docs.filter((docSnap) => {
    const inv = docSnap.data();
    const due = inv.due?.toDate?.() || new Date(inv.due);
    const balance = (inv.total || 0) - (inv.amountPaid || 0);
    return due < now && balance > 0;
  });
  for (let i = 0; i < overdue.length; i += 400) {
    const batch = db.batch();
    overdue.slice(i, i + 400).forEach((docSnap) => {
      batch.update(docSnap.ref, { status: 'Overdue', updatedAt: FieldValue.serverTimestamp() });
    });
    await batch.commit();
  }
});

exports.deleteExpiredContactSubmissions = onSchedule('every 24 hours', async () => {
  const cutoff = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString();
  let deleted = 0;
  while (true) {
    const snap = await db.collection('contact_submissions')
      .where('createdAt', '<', cutoff)
      .limit(400)
      .get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
    deleted += snap.size;
    if (snap.size < 400) break;
  }
  logger.info('Expired contact submissions deleted', { deleted });
});

exports.auditLog = onCall({ region: 'us-central1' }, async (request) => {
  await assertActiveStaff(request, ['admin', 'office', 'technician', 'developer']);
  const { action, entityType, entityId, before, after } = request.data || {};
  if (typeof action !== 'string' || !/^[a-zA-Z][a-zA-Z0-9_.-]{1,79}$/.test(action)) {
    throw new HttpsError('invalid-argument', 'Invalid audit action');
  }
  const serialized = JSON.stringify({ entityType, entityId, before, after });
  if (serialized.length > 20000) throw new HttpsError('invalid-argument', 'Audit payload too large');
  await db.collection('audit_log').add({
    action,
    entityType: entityType || null,
    entityId: entityId || null,
    before: before || null,
    after: after || null,
    userId: request.auth.uid,
    source: 'client_claim',
    at: FieldValue.serverTimestamp(),
  });
  return { ok: true };
});

/** Set role custom claim + Firestore profile (admin/developer only) */
exports.setUserRole = onCall({ region: 'us-central1' }, async (request) => {
  await assertAdminOrDev(request);
  const { uid, email, name, role } = request.data;
  if (!uid && !email) throw new HttpsError('invalid-argument', 'uid or email required');
  if (!role || !['admin', 'office', 'technician', 'developer'].includes(role)) {
    throw new HttpsError('invalid-argument', 'Invalid role');
  }
  if (role === 'developer' && request.auth.token.role !== 'developer') {
    throw new HttpsError('permission-denied', 'Only a developer can grant the developer role');
  }
  let userRecord;
  if (uid) {
    userRecord = await auth.getUser(uid);
  } else {
    userRecord = await auth.getUserByEmail(email.toLowerCase());
  }
  if (request.auth.token.role !== 'developer') {
    const target = await db.collection('users').doc(userRecord.uid).get();
    if (target.data()?.role === 'developer') {
      throw new HttpsError('permission-denied', 'Only a developer can modify a developer account');
    }
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

function generateTemporaryPassword() {
  return `${randomBytes(32).toString('base64url')}Aa1!`;
}

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
  await assertAdminOrDev(request);
  const callerRole = request.auth.token.role;
  const { name, email, role, phone, jobTitle, hireDate, department } = request.data || {};
  if (!name || !email) throw new HttpsError('invalid-argument', 'name and email required');
  const allowedRoles = callerRole === 'developer' ? [...HIRABLE_ROLES, 'developer'] : HIRABLE_ROLES;
  if (!role || !allowedRoles.includes(role)) {
    throw new HttpsError('invalid-argument', `Invalid role. Allowed: ${allowedRoles.join(', ')}`);
  }

  const em = String(email).trim().toLowerCase();
  const temporaryPassword = generateTemporaryPassword();
  let userRecord;
  try {
    userRecord = await auth.createUser({
      email: em,
      password: temporaryPassword,
      displayName: name,
      emailVerified: false,
    });
  } catch (e) {
    if (e.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'An account with this email already exists');
    }
    throw new HttpsError('internal', e.message || 'Could not create Auth user');
  }

  try {
    await sendFirebasePasswordResetEmail(em);
  } catch (e) {
    await auth.deleteUser(userRecord.uid).catch(() => {});
    throw new HttpsError(
      'unavailable',
      'The employee account was not created because the password setup email could not be sent. Try again.',
    );
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

  return {
    ok: true,
    uid: userRecord.uid,
    email: em,
    role,
    passwordResetSent: true,
  };
});

/** Resend Firebase password-reset email for an employee */
exports.sendEmployeePasswordReset = onCall({ region: 'us-central1' }, async (request) => {
  await assertAdminOrDev(request);
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
  await assertAdminOrDev(request);
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
    await auth.revokeRefreshTokens(uid);
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
  await assertAdminOrDev(request);
  const { uid } = request.data || {};
  if (!uid) throw new HttpsError('invalid-argument', 'uid required');

  const userRef = db.collection('users').doc(uid);
  const snap = await userRef.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Employee not found');

  try {
    await auth.updateUser(uid, { disabled: false });
    await setRole(uid, snap.data().role);
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
  await assertAdminOrDev(request);
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
  await assertActiveStaff(request, ['admin', 'office', 'technician', 'developer']);
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
    await auth.updateUser(uid, { disabled: true });
    await auth.revokeRefreshTokens(uid);
  } else if (isAdminOrDev && fields.status && EMPLOYEE_STATUSES.includes(fields.status)) {
    fields.active = true;
    if (snap.data().status === 'Terminated') {
      await auth.updateUser(uid, { disabled: false });
      await setRole(uid, fields.role || snap.data().role);
    }
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
  await assertActiveStaff(request, ['admin', 'office', 'technician', 'developer']);

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
  await assertAdminOrDev(request);
  const snap = await db.collection('audit_log').orderBy('at', 'desc').limit(500).get();
  const items = snap.docs.map((d) => {
    const data = d.data();
    const at = data.at?.toDate?.() ? data.at.toDate().toISOString() : (data.at || null);
    return { id: d.id, ...data, at };
  });
  return { ok: true, items };
});

/** Create Stripe Checkout session for an invoice payment */
exports.createStripeCheckout = onCall(
  { region: 'us-central1', secrets: ['STRIPE_SECRET_KEY'] },
  async (request) => {
    await assertPaymentRole(request);
    const { invoiceId, amount } = request.data || {};
    if (!invoiceId) throw new HttpsError('invalid-argument', 'invoiceId required');

    const invRef = db.collection('invoices').doc(invoiceId);
    const reservationId = randomBytes(18).toString('base64url');
    const reservation = await db.runTransaction(async (tx) => {
      const invSnap = await tx.get(invRef);
      if (!invSnap.exists) throw new HttpsError('not-found', 'Invoice not found');
      const inv = invSnap.data();
      if (['Paid', 'Written Off'].includes(inv.status)) {
        throw new HttpsError('failed-precondition', 'Invoice is already closed');
      }

      const existing = inv.checkoutReservation;
      const existingAt = existing?.createdAt ? new Date(existing.createdAt).getTime() : 0;
      if (existing?.id && Number.isFinite(existingAt) && Date.now() - existingAt < 30 * 60 * 1000) {
        throw new HttpsError('already-exists', 'A checkout is already active for this invoice');
      }

      const balance = Math.round(((inv.total || 0) - (inv.amountPaid || 0)) * 100) / 100;
      const payAmount = amount != null ? Number(amount) : balance;
      if (!payAmount || payAmount <= 0) throw new HttpsError('invalid-argument', 'Invalid amount');
      if (payAmount > balance + 0.01) {
        throw new HttpsError('invalid-argument', 'Amount exceeds invoice balance');
      }

      tx.update(invRef, {
        checkoutReservation: {
          id: reservationId,
          amount: payAmount,
          createdAt: new Date().toISOString(),
          createdBy: request.auth.uid,
        },
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { inv, payAmount };
    });

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    let session;
    try {
      session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Invoice ${invoiceId}`,
              description: `${reservation.inv.customerName || 'Customer'} — Alex Road Service`,
            },
            unit_amount: Math.round(reservation.payAmount * 100),
          },
          quantity: 1,
        }],
        metadata: {
          invoiceId,
          customerName: reservation.inv.customerName || '',
          initiatedBy: request.auth.uid,
          reservationId,
        },
        success_url: `${HOSTING_URL}/app/payment-success.html?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${HOSTING_URL}/app/invoice-detail.html?id=${invoiceId}&cancelled=1`,
      }, { idempotencyKey: `checkout_${invoiceId}_${reservationId}` });
      await invRef.update({
        'checkoutReservation.sessionId': session.id,
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch (error) {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(invRef);
        if (snap.data()?.checkoutReservation?.id === reservationId) {
          tx.update(invRef, {
            checkoutReservation: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }).catch(() => {});
      throw new HttpsError('internal', error.message || 'Could not create Stripe checkout');
    }

    return { url: session.url, sessionId: session.id };
  },
);

/** Admin/developer: refund a Stripe payment (full or partial) */
exports.createStripeRefund = onCall(
  { region: 'us-central1', secrets: ['STRIPE_SECRET_KEY'] },
  async (request) => {
    await assertAdminOrDev(request);
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

    if (refund.status === 'pending') {
      return {
        ok: true,
        pending: true,
        refundId: refund.id,
        paymentId,
        amount: refundAmount,
        stripeStatus: refund.status,
      };
    }
    if (refund.status !== 'succeeded') {
      throw new HttpsError('failed-precondition', `Stripe refund status is ${refund.status}`);
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
        if (refund.status === 'succeeded') {
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
