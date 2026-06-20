# Alex Road Service — Website & Operations Platform

Public marketing website and **production-ready internal operations platform** for Alex Road Service: 24/7 emergency roadside repair and commercial truck repair (Keasbey, NJ).

---

## What's included

| Layer | Status |
|-------|--------|
| Public marketing site (9 pages) | Live UI + contact form persistence |
| Ops platform (9 modules + 4 detail pages) | Full CRUD with localStorage persistence |
| Auth | Firebase Authentication only (token re-validated each session) |
| Payments | Stripe Checkout + webhook (no manual entry) |
| RBAC | Admin / Office / Technician permissions |
| Dashboard & reports | Live KPIs from stored data |
| Firebase | Rules, functions, hosting config (wire credentials to go live) |

**Full implementation plan:** [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md)  
**Ops runbook:** [`docs/RUNBOOK.md`](docs/RUNBOOK.md)

---

## Quick start (local)

```bash
cd public
python -m http.server 3000
```

Open **http://localhost:3000**

Ops platform: **http://localhost:3000/login.html**

### Staff login

Firebase Authentication is **required** for production staff. Bootstrap accounts once via `/setup.html` or `npm run bootstrap`, then sign in at `/login.html`.

**Demo sandbox:** `demo@alexroadservice.com` / `Demo2026!` — full platform preview with sample data (see [`Development Docs/STAFF_CREDENTIALS.md`](Development%20Docs/STAFF_CREDENTIALS.md)).

See [`docs/FIREBASE_SETUP.md`](docs/FIREBASE_SETUP.md) and [`docs/STRIPE_SETUP.md`](docs/STRIPE_SETUP.md).

---

## Ops platform modules

| Module | Route | Features |
|--------|-------|----------|
| Dashboard | `/app/dashboard.html` | Live KPIs, alerts, schedule, recent WOs |
| Customers | `/app/customers.html` | CRUD, search, export, detail view |
| Trucks | `/app/trucks.html` | Fleet registry, PM alerts, detail view |
| Work Orders | `/app/work-orders.html` | Create, status workflow, invoice generation |
| Estimates | `/app/estimates.html` | Create, send, approve, convert to WO |
| Invoices | `/app/invoices.html` | Track AR, record payments, overdue detection |
| Payments | `/app/payments.html` | Stripe payment history, collect via Checkout |
| Inventory | `/app/inventory.html` | Stock levels, adjust, reorder export |
| Reports | `/app/reports.html` | Revenue charts, tech performance, CSV export |
| Settings | `/app/settings.html` | Labor rate, tax, shop info (Admin) |

Operational data syncs to **Firestore** in real time. localStorage is used only as a local cache.

---

## Firebase deployment

1. Install CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Set project in `.firebaserc`
4. Add real config to `public/js/firebase-config.js`
5. Deploy:

```bash
cd functions && npm install && cd ..
firebase deploy
```

Deploys: Hosting, Firestore rules, Cloud Functions.

### GitHub Actions

Configure secrets: `FIREBASE_TOKEN`, `FIREBASE_STAGING_PROJECT`, `FIREBASE_PROD_PROJECT`

- Push to `staging` → deploy staging
- Push to `main` → deploy production (with environment approval)

---

## Project structure

```
Alex-Road-Service/
├── docs/
│   ├── IMPLEMENTATION_PLAN.md
│   └── RUNBOOK.md
├── functions/                 # Cloud Functions (IDs, overdue job, audit)
├── public/
│   ├── app/                   # Ops platform
│   │   ├── js/
│   │   │   ├── auth.js        # Login, RBAC, sessions
│   │   │   ├── data-store.js  # localStorage persistence
│   │   │   ├── data-service.js# Business logic / CRUD
│   │   │   ├── utils.js
│   │   │   ├── page-scripts.js
│   │   │   └── app-components.js
│   │   └── *.html
│   ├── js/
│   │   ├── firebase-config.js
│   │   ├── components.js
│   │   └── main.js
│   └── ...
├── firestore.rules
├── firestore.indexes.json
└── firebase.json
```

---

## Before production go-live

- [ ] Replace `YOUR_*` in `firebase-config.js` with real Firebase credentials
- [ ] Create Firebase Auth users with custom claims (`admin`, `office`, `technician`)
- [ ] Enable Firestore PITR and daily backups
- [ ] Remove demo credentials from production README
- [ ] Accountant review of tax settings in Settings page
- [ ] Complete go-live checklist in `docs/IMPLEMENTATION_PLAN.md` §16
