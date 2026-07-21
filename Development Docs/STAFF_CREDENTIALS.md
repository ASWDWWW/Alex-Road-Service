# Staff Account Provisioning

**Project:** Alex Road Service Ops Platform  
**Firebase project:** `launchpage-alex-roadservice`  
**Login URL:** https://launchpage-alex-roadservice.web.app/login.html  
Staff credentials must never be committed to this repository. Every Firebase Authentication account must have a unique password established through Firebase's password-setup/reset email flow.

## Demo account

The public demo account is shown on `/login.html`. It is implemented entirely in the browser, uses isolated sample data, never authenticates with Firebase, and never charges Stripe.

---

## Staff provisioning

1. Provision the initial administrator from a trusted Firebase Admin environment as documented in `docs/FIREBASE_SETUP.md`.
2. Create subsequent employees from the Employees screen.
3. The employee must use the emailed setup link before signing in.
4. Archive or terminate access immediately when employment ends.

## July 21, 2026 credential rotation

The legacy `developer@`, `admin@`, `office@`, and `tech@alexroadservice.com` Firebase accounts were disabled after their former shared passwords were found in repository history. Password-reset emails were requested for all four accounts. Keep each account disabled until its owner confirms a unique new password, then re-enable it from Firebase Authentication.

---

## Related docs

- [`docs/FIREBASE_SETUP.md`](../docs/FIREBASE_SETUP.md) — Firebase Console and deploy steps
- [`STRIPE_PAYMENTS_SETUP.md`](STRIPE_PAYMENTS_SETUP.md) — Stripe setup (requires staff login first)

---

**Security:** Firebase web API keys are public identifiers. Security depends on Authentication, App Check, least-privilege rules, unique credentials, and server-side authorization.
