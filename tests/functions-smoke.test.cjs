const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');

const requireFunctions = createRequire(path.resolve(__dirname, '../functions/package.json'));
const { initializeApp } = requireFunctions('firebase-admin/app');
const { getAuth } = requireFunctions('firebase-admin/auth');
const { getFirestore } = requireFunctions('firebase-admin/firestore');

const PROJECT_ID = 'alex-road-service-rules-test';
const BASE_URL = `http://127.0.0.1:5001/${PROJECT_ID}/us-central1`;
let officeToken;

async function getOfficeToken() {
  if (officeToken) return officeToken;
  const app = initializeApp({ projectId: PROJECT_ID }, 'functions-smoke-admin');
  const auth = getAuth(app);
  const db = getFirestore(app);
  const user = await auth.createUser({
    email: 'office-smoke@example.com',
    password: 'Local-Smoke-Only-2026!',
  });
  await auth.setCustomUserClaims(user.uid, { role: 'office' });
  await db.collection('users').doc(user.uid).set({
    uid: user.uid,
    role: 'office',
    active: true,
    status: 'Active',
  });
  const response = await fetch(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'office-smoke@example.com',
        password: 'Local-Smoke-Only-2026!',
        returnSecureToken: true,
      }),
    },
  );
  assert.equal(response.status, 200);
  officeToken = (await response.json()).idToken;
  return officeToken;
}

async function call(name, data, token) {
  return fetch(`${BASE_URL}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ data }),
  });
}

test('health check verifies the function and Firestore runtimes', async () => {
  const response = await fetch(`${BASE_URL}/healthCheck`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.service, 'alex-road-service');
});

test('privileged callable rejects unauthenticated requests', async () => {
  const response = await call('completeWorkOrder', { workOrderId: 'WO-1' });
  assert.equal(response.status, 401);
  const body = await response.json();
  assert.equal(body.error.status, 'UNAUTHENTICATED');
});

test('server entity writes enforce optimistic concurrency', async () => {
  const token = await getOfficeToken();
  const customer = {
    id: 'C-2026-0001',
    name: 'Smoke Customer',
    phone: '732-555-0100',
    email: 'smoke@example.com',
    company: 'Smoke Fleet',
    status: 'Active',
    notes: '',
    version: 1,
    createdAt: '2026-07-21T16:00:00.000Z',
  };
  const created = await call('saveEntity', { collectionName: 'customers', item: customer }, token);
  assert.equal(created.status, 200);

  const updated = await call('saveEntity', {
    collectionName: 'customers',
    item: { ...customer, name: 'Updated Customer', version: 2 },
  }, token);
  assert.equal(updated.status, 200);

  const stale = await call('saveEntity', {
    collectionName: 'customers',
    item: { ...customer, name: 'Stale Customer', version: 2 },
  }, token);
  assert.equal(stale.status, 409);
  const staleBody = await stale.json();
  assert.equal(staleBody.error.status, 'ABORTED');
});
