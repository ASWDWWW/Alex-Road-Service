const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('production source contains no legacy bootstrap or shared staff credentials', () => {
  const files = [
    'functions/index.js',
    'public/app/settings.html',
    'docs/FIREBASE_SETUP.md',
    'Development Docs/STAFF_CREDENTIALS.md',
  ];
  const combined = files.map(read).join('\n');
  assert.doesNotMatch(combined, /alex-road-bootstrap-2026/);
  assert.doesNotMatch(combined, /ChangeMe-Dev-2026!/);
  assert.doesNotMatch(combined, /bootstrapStaff/);
  assert.doesNotMatch(combined, /password:\s*['"]password['"]/);
});

test('production has no remotely callable bulk purge', () => {
  const functions = read('functions/index.js');
  const sync = read('public/app/js/firestore-sync.js');
  assert.doesNotMatch(functions, /purgeLegacyDemoData|deleteAllInCollection|PURGE_COLLECTIONS/);
  assert.doesNotMatch(sync, /purgeLegacyDemoData/);
});

test('operational cache is scoped to the authenticated user', () => {
  const store = read('public/app/js/data-store.js');
  const auth = read('public/app/js/auth.js');
  assert.match(store, /ars_platform_v2/);
  assert.match(store, /PROD_STORE_PREFIX.*uid/s);
  assert.match(auth, /clearCurrentUserCache/);
});

test('client no longer falls back to local production identifiers or whole-cache writes', () => {
  const sync = read('public/app/js/firestore-sync.js');
  const data = read('public/app/js/data-service.js');
  assert.doesNotMatch(sync, /_pushAll|using local counter/);
  assert.match(sync, /Cloud ID service is unavailable/);
  assert.match(data, /Cloud data service is unavailable/);
});

test('production deployment includes both database and storage rules', () => {
  const packageJson = JSON.parse(read('package.json'));
  assert.match(packageJson.scripts.deploy, /firestore:rules/);
  assert.match(packageJson.scripts.deploy, /storage/);
});
