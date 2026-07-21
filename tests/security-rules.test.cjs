const fs = require('node:fs');
const path = require('node:path');
const { after, afterEach, before, describe, test } = require('node:test');
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require('@firebase/rules-unit-testing');
const {
  doc,
  getDoc,
  setDoc,
  updateDoc,
} = require('firebase/firestore');
const {
  getBytes,
  ref,
  uploadString,
} = require('firebase/storage');

const PROJECT_ID = 'alex-road-service-rules-test';
const ROOT = path.resolve(__dirname, '..');
let env;

function auth(uid, role) {
  return env.authenticatedContext(uid, { role });
}

async function seed() {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const users = [
      ['admin-1', 'admin', true, 'Active'],
      ['office-1', 'office', true, 'Active'],
      ['tech-1', 'technician', true, 'Active'],
      ['tech-2', 'technician', true, 'Active'],
      ['terminated-1', 'technician', false, 'Terminated'],
    ];
    for (const [uid, role, active, status] of users) {
      await setDoc(doc(db, 'users', uid), { uid, role, active, status });
    }
    await setDoc(doc(db, 'workOrders', 'WO-1'), {
      id: 'WO-1',
      customerId: 'C-1',
      customerName: 'Test Customer',
      techIds: ['tech-1'],
      status: 'Open',
      desc: 'Road call',
      notes: '',
      labor: 100,
      parts: 20,
      tax: 1.33,
      total: 121.33,
      invoiced: false,
      media: [],
      version: 1,
      createdAt: '2026-07-21T12:00:00.000Z',
      updatedAt: '2026-07-21T12:00:00.000Z',
    });
    await setDoc(doc(db, 'conversations', 'conversation-1'), {
      type: 'dm',
      participantIds: ['tech-1', 'tech-2'],
      createdBy: 'tech-1',
      createdAt: '2026-07-21T12:00:00.000Z',
      lastReadAt: {},
    });
  });
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8'),
    },
    storage: {
      rules: fs.readFileSync(path.join(ROOT, 'storage.rules'), 'utf8'),
    },
  });
  await seed();
});

afterEach(async () => {
  if (!env) return;
  await env.clearFirestore();
  await env.clearStorage();
  await seed();
});

after(async () => {
  if (env) await env.cleanup();
});

describe('Firestore production authorization', () => {
  test('public contact documents are server-only', async () => {
    const db = env.unauthenticatedContext().firestore();
    const valid = {
      name: 'Roadside Customer',
      company: '',
      email: 'customer@example.com',
      phone: '732-555-0100',
      service: 'Roadside repair',
      truck: 'Unit 12',
      location: 'Keasbey, NJ',
      message: 'Air line leak',
      timestamp: '2026-07-21T12:00:00.000Z',
      source: 'website-contact-form',
      media: [],
      status: 'New',
      createdAt: '2026-07-21T12:00:00.000Z',
    };
    await assertFails(setDoc(doc(db, 'contact_submissions', 'valid'), valid));
    await assertFails(setDoc(doc(db, 'contact_submissions', 'polluted'), {
      ...valid,
      arbitraryAdminField: true,
    }));
  });

  test('technicians can access only assigned work orders', async () => {
    const assigned = auth('tech-1', 'technician').firestore();
    const unassigned = auth('tech-2', 'technician').firestore();
    await assertSucceeds(getDoc(doc(assigned, 'workOrders', 'WO-1')));
    await assertFails(getDoc(doc(unassigned, 'workOrders', 'WO-1')));
  });

  test('work order writes are server-only', async () => {
    const db = auth('tech-1', 'technician').firestore();
    await assertFails(updateDoc(doc(db, 'workOrders', 'WO-1'), {
      status: 'Completed',
      version: 2,
      updatedAt: '2026-07-21T12:05:00.000Z',
    }));
    await assertFails(updateDoc(doc(db, 'workOrders', 'WO-1'), {
      techIds: ['tech-1', 'tech-2'],
      version: 2,
      updatedAt: '2026-07-21T12:05:00.000Z',
    }));
    await assertFails(updateDoc(doc(db, 'workOrders', 'WO-1'), {
      status: 'In Progress',
      version: 2,
      updatedAt: '2026-07-21T12:05:00.000Z',
    }));
  });

  test('terminated users are denied even with a stale role claim', async () => {
    const db = auth('terminated-1', 'technician').firestore();
    await assertFails(getDoc(doc(db, 'customers', 'customer-1')));
  });

  test('invoice creation is server-only', async () => {
    const db = auth('office-1', 'office').firestore();
    await assertFails(setDoc(doc(db, 'invoices', 'INV-1'), {
      id: 'INV-1',
      total: 100,
      amountPaid: 0,
      status: 'Sent',
    }));
  });

  test('conversation participants cannot change membership', async () => {
    const db = auth('tech-1', 'technician').firestore();
    await assertFails(updateDoc(doc(db, 'conversations', 'conversation-1'), {
      participantIds: ['tech-1', 'tech-2', 'terminated-1'],
    }));
    await assertSucceeds(updateDoc(doc(db, 'conversations', 'conversation-1'), {
      'lastReadAt.tech-1': '2026-07-21T12:10:00.000Z',
    }));
  });
});

describe('Storage production authorization', () => {
  test('anonymous public uploads are denied', async () => {
    const storage = env.unauthenticatedContext().storage();
    await assertFails(uploadString(
      ref(storage, 'media/public_leads/lead-1/photo.jpg'),
      'not-an-image',
      'raw',
      { contentType: 'image/jpeg' },
    ));
  });

  test('message attachments require conversation membership', async () => {
    const participantStorage = auth('tech-1', 'technician').storage();
    const outsiderStorage = auth('office-1', 'office').storage();
    const fileRef = ref(participantStorage, 'media/messages/conversation-1/photo.jpg');
    await assertSucceeds(uploadString(fileRef, 'image-data', 'raw', { contentType: 'image/jpeg' }));
    await assertSucceeds(getBytes(fileRef));
    await assertFails(getBytes(ref(outsiderStorage, 'media/messages/conversation-1/photo.jpg')));
  });
});
