# Alex Road Service — Operations Runbook

## Environments

| Env | Firebase Project | URL |
|-----|------------------|-----|
| Staging | `alex-road-staging` (configure) | TBD |
| Production | `launchpage-alex-roadservice` | Custom domain |

## Deploy

```bash
firebase deploy --only hosting,firestore:rules,functions
```

## Local development

```bash
cd public && python -m http.server 3000
```

Open http://localhost:3000 — ops platform requires Firebase Authentication (no mock login).

## Staff login

Bootstrap accounts via `/setup.html` or `npm run bootstrap`, then sign in at `/login.html` with Firebase credentials.

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
