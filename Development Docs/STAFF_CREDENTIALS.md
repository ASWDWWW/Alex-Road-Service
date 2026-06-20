# Staff Login Credentials

**Project:** Alex Road Service Ops Platform  
**Firebase project:** `launchpage-alex-roadservice`  
**Login URL:** https://launchpage-alex-roadservice.web.app/login.html  
**Bootstrap URL (one-time):** https://launchpage-alex-roadservice.web.app/setup.html

---

## Staff accounts

| Email | Password | Role | Access |
|-------|----------|------|--------|
| developer@alexroadservice.com | `ChangeMe-Dev-2026!` | developer | Full access (superuser) |
| admin@alexroadservice.com | `password` | admin | Full shop ops + settings |
| office@alexroadservice.com | `password` | office | Customers, work orders, invoices, payments, leads |
| tech@alexroadservice.com | `password` | technician | Assigned work orders, read customers/trucks/inventory |
| demo@alexroadservice.com | `Demo2026!` | demo | Full sandbox — sample data only; resets on each demo sign-in (no Firebase) |

**Demo account:** Use **Try Demo Account** on `/login.html` or sign in with the credentials above. Data is isolated in the browser and does not sync to Firestore. Payments are simulated (no Stripe charge).

---

## Bootstrap secret

Used once on `/setup.html` to create Auth users, custom claims, and Firestore `users` profiles:

```
alex-road-bootstrap-2026
```

Check **Reset passwords for existing users** only if you need to re-apply bootstrap passwords.

---

## After login

1. Sign out and sign back in once so custom role claims refresh.
2. Change all passwords in **Firebase Console → Authentication** before production use.
3. Developer and admin accounts can manage roles via the `setUserRole` Cloud Function or Settings → Bootstrap Firebase Staff.

---

## Related docs

- [`docs/FIREBASE_SETUP.md`](../docs/FIREBASE_SETUP.md) — Firebase Console and deploy steps
- [`STRIPE_PAYMENTS_SETUP.md`](STRIPE_PAYMENTS_SETUP.md) — Stripe setup (requires staff login first)

---

**Security:** Keep this file out of public repos or redact passwords before sharing externally. Firebase web API keys are public by design; security relies on Auth, Firestore rules, and strong passwords.
