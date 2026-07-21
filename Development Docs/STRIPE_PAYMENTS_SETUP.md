# Required Setup Before Payments Work

**Project:** Alex Road Service Ops Platform  
**Firebase project:** `launchpage-alex-roadservice`  
**Status:** Do later — complete this checklist before accepting real payments

This document is the single checklist for enabling Stripe payments. Manual payment entry is disabled; all payments flow through **Stripe Checkout** and are recorded by the **`stripeWebhook`** Cloud Function.

---

## Prerequisites (must be done first)

- [ ] Firebase project on **Blaze** plan (required for Cloud Functions)
- [ ] **Email/Password** authentication enabled (Firebase Console → Authentication)
- [ ] **Firestore** database created (production mode)
- [ ] Cloud Functions deployed at least once (`createStripeCheckout`, `createStripeRefund`, `stripeWebhook`)
- [ ] Staff accounts bootstrapped via `/setup.html` or `npm run bootstrap`
- [ ] All default passwords changed in Firebase Console → Authentication
- [ ] Staff can sign in at `/login.html` (Firebase Auth only — no mock login)
- [ ] At least one **unpaid invoice** exists in Firestore for testing

**Related docs:** [`docs/FIREBASE_SETUP.md`](../docs/FIREBASE_SETUP.md)

---

## Step 1 — Stripe account

- [ ] Create account at [https://dashboard.stripe.com](https://dashboard.stripe.com)
- [ ] Complete business verification (required for **live** payments)
- [ ] Stay in **Test mode** until UAT is complete
- [ ] Note your keys:
  - **Publishable key** (`pk_test_...` / `pk_live_...`) — not stored in this app (Checkout is server-initiated)
  - **Secret key** (`sk_test_...` / `sk_live_...`) — goes into Firebase secret `STRIPE_SECRET_KEY`

---

## Step 2 — Deploy latest code

From the project root:

```bash
cd functions && npm install && cd ..
firebase deploy --only functions,firestore:rules,hosting
```

Confirm these functions exist in Firebase Console → Functions:

| Function | Purpose |
|----------|---------|
| `createStripeCheckout` | Starts Stripe Checkout for an invoice |
| `createStripeRefund` | Admin refunds (full/partial) via Stripe |
| `stripeWebhook` | Records payment/refund + updates invoice |

- [ ] Deploy completed without errors
- [ ] `stripeWebhook` URL is live (see Step 3)

---

## Step 3 — Stripe webhook endpoint

1. Stripe Dashboard → **Developers → Webhooks → Add endpoint**
2. Endpoint URL:

   ```
   https://us-central1-launchpage-alex-roadservice.cloudfunctions.net/stripeWebhook
   ```

3. Select events:
   - [ ] `checkout.session.completed` (required for payments)
   - [ ] `charge.refunded` (required for Dashboard + in-app refund sync)
   - [ ] `refund.created` (recommended)
4. Copy the **Signing secret** (`whsec_...`)

- [ ] Webhook endpoint created
- [ ] Signing secret saved securely (not committed to git)

---

## Step 4 — Firebase secrets

Run from project root (you will be prompted to paste values):

```bash
firebase functions:secrets:set STRIPE_SECRET_KEY
# Paste: sk_test_... (or sk_live_... for production)

firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
# Paste: whsec_... from Step 3
```

- [ ] `STRIPE_SECRET_KEY` set
- [ ] `STRIPE_WEBHOOK_SECRET` set
- [ ] Redeploy functions after setting secrets:

```bash
firebase deploy --only functions
```

---

## Step 5 — Verify auth & permissions

Payments require a logged-in user with role **admin**, **office**, or **developer**.

- [ ] Sign in at `https://launchpage-alex-roadservice.web.app/login.html`
- [ ] Session re-validates on each ops page load (Firebase token + `role` claim)
- [ ] User with `payments.record` permission can see **Pay with Stripe** on invoices

---

## Step 6 — Test payment (Stripe test mode)

Use Stripe test card: **`4242 4242 4242 4242`** — any future expiry, any CVC.  
Full card list: [`STRIPE_TEST_CARDS.md`](STRIPE_TEST_CARDS.md)

1. [ ] Log in as office or admin
2. [ ] Open **Invoices** → unpaid invoice → **Pay with Stripe**
3. [ ] Complete Checkout on Stripe-hosted page
4. [ ] Redirected to `/app/payment-success.html`
5. [ ] Within ~30 seconds, confirm in ops platform:
   - [ ] New row in **Payments** (`method: Stripe`, `status: Completed`)
   - [ ] Invoice `amountPaid` increased and status → `Paid` or `Partially Paid`
6. [ ] In Stripe Dashboard → **Webhooks**, confirm `checkout.session.completed` delivered **200**
7. [ ] In Firestore, confirm:
   - [ ] `payments/{id}` document created
   - [ ] `stripe_events/{eventId}` document created (idempotency)
   - [ ] `invoices/{id}` updated

**Also test from:** Payments page → **Collect Payment** → select invoice → Stripe Checkout.

---

## Step 7 — Go live (production)

Only after test mode UAT passes:

- [ ] Switch Stripe Dashboard to **Live mode**
- [ ] Update `STRIPE_SECRET_KEY` to `sk_live_...`
- [ ] Create a **live** webhook endpoint (same URL) and update `STRIPE_WEBHOOK_SECRET`
- [ ] Redeploy functions
- [ ] Run one small real charge and verify end-to-end
- [ ] Accountant confirms invoice/payment records match expectations

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|----------------|-----|
| "Stripe checkout could not be started" | `STRIPE_SECRET_KEY` missing or functions not deployed | Set secret, redeploy `createStripeCheckout` |
| Payment succeeds in Stripe but invoice unchanged | Webhook not configured or wrong secret | Check webhook URL, `STRIPE_WEBHOOK_SECRET`, Stripe webhook logs |
| Webhook returns 400 | Signature mismatch | Re-copy `whsec_...` from the correct webhook endpoint |
| Pay button missing | Wrong role or invoice already Paid/Written Off | Use office/admin; check invoice status |
| Permission denied on login | No `role` custom claim | Re-bootstrap or use `setUserRole` as admin/dev |

**Webhook logs:** Stripe Dashboard → Developers → Webhooks → select endpoint → Recent deliveries  
**Function logs:** Firebase Console → Functions → `stripeWebhook` → Logs

---

## Security summary

- Card data never touches Alex Road Service servers (Stripe Checkout — **SAQ A**)
- Firestore rules block client writes to `payments` and `stripe_events`
- Webhook verifies `stripe-signature` on every request
- Duplicate Stripe events are ignored via `stripe_events` collection

---

## Reference

| Item | Location |
|------|----------|
| Stripe client helper | `public/app/js/payments-stripe.js` |
| Checkout Cloud Function | `functions/index.js` → `createStripeCheckout` |
| Webhook Cloud Function | `functions/index.js` → `stripeWebhook` |
| Firestore rules | `firestore.rules` → `payments`, `stripe_events` |
| Success page | `public/app/payment-success.html` |
| Detailed Stripe guide | [`docs/STRIPE_SETUP.md`](../docs/STRIPE_SETUP.md) |

---

## Sign-off (complete before client handoff)

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | | | |
| Office / Admin | | | |
| Client owner | | | |
