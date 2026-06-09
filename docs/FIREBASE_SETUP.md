# Firebase Setup — Alex Road Service

Project: **launchpage-alex-roadservice**

---

## Already done in code

- Firebase config in `public/js/firebase-config.js`
- Google Analytics (`G-743F7YVS18`) via gtag + Firebase Analytics
- Firestore security rules (`firestore.rules`) with **developer** role
- Cloud Functions: `bootstrapStaff`, `setUserRole`, `nextSequentialId`, `markOverdueInvoices`, `auditLog`, `createStripeCheckout`, `stripeWebhook`
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
- Required for `bootstrapStaff` and scheduled jobs

### 4. Analytics
- **Build → Analytics** — should show **G-743F7YVS18** (already linked to web app)

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
firebase deploy --only functions
```

---

## Bootstrap staff (creates users + roles + profiles)

After **functions** are deployed, run **once** from Firebase Console or locally:

### Option A — Firebase Console (no code)

Not available for custom claims — use Option B or C.

### Option B — Callable from browser (after first manual dev user)

1. In **Authentication → Users → Add user**:
   - `developer@alexroadservice.com` + strong password
2. In **Firestore**, collection `users`, doc ID = that user's **UID**:

```json
{
  "email": "developer@alexroadservice.com",
  "name": "Platform Developer",
  "role": "developer",
  "active": true
}
```

3. Use Firebase Admin locally OR call `bootstrapStaff` with secret (see Option C).

### Option C — bootstrapStaff function (recommended)

After deploy, open **/setup.html** on your live site OR use Settings (admin/dev):

**First call** (no auth required if not bootstrapped yet):

Secret default: `alex-road-bootstrap-2026`

Creates these users:

| Email | Role | Password |
|-------|------|----------|
| admin@alexroadservice.com | admin | password |
| office@alexroadservice.com | office | password |
| tech@alexroadservice.com | technician | password |
| developer@alexroadservice.com | developer | ChangeMe-Dev-2026! |

**Change all passwords** in Firebase Console → Authentication before going to production.

---

## Roles

| Role | Access |
|------|--------|
| **developer** | Everything (superuser) |
| **admin** | Full shop ops + settings |
| **office** | Customers, WOs, invoices, payments |
| **technician** | Assigned WOs, read customers/trucks/inventory |

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
