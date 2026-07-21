const { applicationDefault, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');

function argument(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : '';
}

async function main() {
  const projectId = argument('project');
  const confirmation = argument('confirm-project');
  const email = argument('email').trim().toLowerCase();
  if (!projectId || confirmation !== projectId || !email) {
    throw new Error(
      'Usage: npm run provision:initial-admin -- '
      + '--project <project-id> --confirm-project <same-project-id> --email <existing-auth-email>',
    );
  }

  initializeApp({ credential: applicationDefault(), projectId });
  const auth = getAuth();
  const db = getFirestore();
  const user = await auth.getUserByEmail(email);
  const existingProfile = await db.collection('users').doc(user.uid).get();
  if (existingProfile.exists && existingProfile.data().role
    && existingProfile.data().role !== 'developer') {
    throw new Error('A non-developer profile already exists. Use the in-app role workflow.');
  }

  await auth.setCustomUserClaims(user.uid, {
    ...(user.customClaims || {}),
    role: 'developer',
  });
  await db.collection('users').doc(user.uid).set({
    uid: user.uid,
    email,
    name: user.displayName || email,
    role: 'developer',
    active: true,
    archived: false,
    status: 'Active',
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  process.stdout.write(`Provisioned developer access for ${email} in ${projectId}.\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
