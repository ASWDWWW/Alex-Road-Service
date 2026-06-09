/**
 * Call bootstrapStaff Cloud Function after deploy.
 * Usage: node scripts/call-bootstrap.js [secret]
 * Default secret: alex-road-bootstrap-2026
 */
const secret = process.argv[2] || 'alex-road-bootstrap-2026';
const projectId = 'launchpage-alex-roadservice';
const url = `https://us-central1-${projectId}.cloudfunctions.net/bootstrapStaff`;

async function main() {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { secret, overwritePasswords: true } }),
  });
  const json = await res.json();
  if (json.error) {
    console.error('Bootstrap failed:', json.error);
    process.exit(1);
  }
  console.log('Bootstrap success:', JSON.stringify(json.result || json, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
