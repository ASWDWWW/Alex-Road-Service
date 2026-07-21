# Firebase Setup — Alex Road Service

Project: **launchpage-alex-roadservice**

---

## Already done in code

- Firebase config in `public/js/firebase-config.js`
- Google Analytics (`G-743F7YVS18`) via gtag + Firebase Analytics
- Firestore security rules (`firestore.rules`) with **developer** role
- Cloud Functions: `setUserRole`, employee administration, sequential IDs, scheduled maintenance, audit export, Stripe checkout/refunds, and Stripe webhooks
- Firebase Authentication only (mock login removed; sessions re-validated on every page load)
- Hosting site: `launchpage-alex-roadservice`

---

## You must do in Firebase Console (one time)

### 1. Authentication
- **Build → Authentication → Sign-in method**
- Enable **Email/Password**

### 2. Firestore
- **Build → Firestore Database → Create database**
- Production mode, region **us-east1** or **nam5**
- Optional: enable **Point-in-time recovery**

### 3. Upgrade to Blaze (for Cloud Functions)
- **Project settings → Usage and billing → Upgrade**
- Required for Cloud Functions and scheduled jobs

### 4. Analytics
- **Build → Analytics** — should show **G-743F7YVS18** (already linked to web app)

### 5. App Check

1. Create a score-based reCAPTCHA Enterprise website key for:
   - `alexroadservice.com`
   - `www.alexroadservice.com`
   - `launchpage-alex-roadservice.web.app`
2. Register the production web app in Firebase **App Check** with that key.
3. Set `FIREBASE_CONFIG.appCheckSiteKey` in `public/js/firebase-config.js`.
4. Deploy and verify App Check metrics before enabling enforcement for Firestore, Storage, Authentication, and callable Functions.

---

## Deploy from your machine

```bash
cd "c:\Users\Zakiy Manigo\Documents\GitHub\Alex-Road-Service"
npm install
cd functions && npm install && cd ..
firebase login
firebase deploy
```

Or step by step:

```bash
firebase deploy --only hosting:launchpage-alex-roadservice
firebase deploy --only firestore:rules
firebase deploy --only storage
firebase deploy --only functions
```

---

## Initial administrator

There is no public bootstrap endpoint and no shared staff password.

1. Create the first administrator in Firebase Authentication with a unique strong password.
2. Authenticate Application Default Credentials on a trusted administrator workstation.
3. From `functions/`, run:

```bash
npm run provision:initial-admin -- --project launchpage-alex-roadservice --confirm-project launchpage-alex-roadservice --email <existing-auth-email>
```

The command refuses to run without an exact project confirmation and only provisions an existing Firebase Authentication user.

4. Sign out and back in so the custom claim refreshes.
5. Create subsequent employees from the Employees screen. Each employee receives a password-setup email; no password is shown to staff.

The public **demo** account remains client-side only. It cannot access Firebase or Stripe.

---

## Roles

| Role | Access |
|------|--------|
| **developer** | Everything (superuser) |
| **admin** | Full shop ops + settings |
| **office** | Customers, WOs, invoices, payments |
| **technician** | Assigned WOs, read customers/trucks/inventory |
| **demo** | Full sandbox with sample data (no Firestore/Stripe) |

---

## Live URLs

- https://launchpage-alex-roadservice.web.app
- https://launchpage-alex-roadservice.firebaseapp.com
- Staff login: `/login.html`

---

## Security note

Your Firebase web API key is public by design. Security comes from **Firestore rules** and **Auth**, not hiding the key.

Rotate bootstrap secret in production:

```bash
firebase functions:secrets:set BOOTSTRAP_SECRET
```

Then redeploy functions.
