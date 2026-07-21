# Alex Road Service — Operations Runbook

## Production

| Firebase Project | URL |
|------------------|-----|
| `launchpage-alex-roadservice` | Custom domain / Firebase Hosting |

This platform currently operates a single production environment. Validation must run locally and in pull-request CI before deployment.

## Deploy

```bash
npm run check
firebase deploy --only hosting,functions,firestore:rules,firestore:indexes,storage
```

## Local development

```bash
cd public && python -m http.server 3000
```

Open http://localhost:3000 — ops platform requires Firebase Authentication (no mock login).

## Staff login

Provision the initial administrator from a trusted Firebase Admin environment. Create subsequent staff from the Employees screen; each employee establishes a unique password through the emailed setup link.

The public demo sandbox is client-only and has no access to Firebase or Stripe.

Payments are collected only through Stripe Checkout — see `docs/STRIPE_SETUP.md`.

## Incident response

| Severity | Action |
|----------|--------|
| P0 — Site down | Check Firebase status; redeploy hosting; restore Firestore PITR |
| P1 — Ops data issue | Export localStorage backup from affected browser; contact dev lead |
| P2 — Module bug | Roll back hosting to previous release in Firebase Console |

## Backup

- **Firestore:** Enable PITR + daily export to Cloud Storage
- **Local demo data:** Settings → Export Audit Log; avoid Reset Seed in production

## Contacts

- Business owner: (configure)
- Dev lead: (configure)
