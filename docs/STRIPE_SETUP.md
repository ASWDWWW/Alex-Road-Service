# Stripe Setup — Alex Road Service

All invoice payments are collected through **Stripe Checkout**. Payments are recorded server-side via webhook — staff cannot manually enter payments in the ops platform.

---

## 1. Create a Stripe account

1. Sign up at [https://dashboard.stripe.com](https://dashboard.stripe.com)
2. Complete business verification for live payments
3. Use **Test mode** keys while validating the integration

---

## 2. Configure Firebase secrets

From the project root:

```bash
firebase functions:secrets:set STRIPE_SECRET_KEY
# Paste your Stripe secret key (sk_test_... or sk_live_...)

firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
# Paste webhook signing secret (whsec_...) — see step 3
```

---

## 3. Create the Stripe webhook

1. Stripe Dashboard → **Developers → Webhooks → Add endpoint**
2. Endpoint URL (after deploying functions):

   ```
   https://us-central1-launchpage-alex-roadservice.cloudfunctions.net/stripeWebhook
   ```

3. Events to listen for:
   - `checkout.session.completed`

4. Copy the **Signing secret** (`whsec_...`) and set `STRIPE_WEBHOOK_SECRET` above

---

## 4. Deploy

```bash
cd functions && npm install && cd ..
firebase deploy --only functions,firestore:rules,hosting
```

---

## 5. Test flow

1. Log in to the ops platform as office/admin
2. Open an unpaid invoice → **Pay with Stripe**
3. Use Stripe test card: `4242 4242 4242 4242`, any future expiry, any CVC (see [`Development Docs/STRIPE_TEST_CARDS.md`](../Development%20Docs/STRIPE_TEST_CARDS.md))
4. After redirect to `/app/payment-success.html`, confirm:
   - Payment appears in **Payments**
   - Invoice `amountPaid` and status update
   - Firestore `payments` document has `method: "Stripe"`

---

## Security notes

- Card data never touches your servers (Stripe Checkout — SAQ A)
- `payments` collection is **write-denied** in Firestore rules; only the webhook creates records
- Webhook signatures are verified on every request
- Duplicate events are ignored via `stripe_events` idempotency collection
