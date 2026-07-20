# Stripe Test Cards — Alex Road Service

Use these cards only in **Stripe Test mode** (`sk_test_…` keys). They do not charge real money.

**For every card below:**
- Expiry: any future date (e.g. `12/34`)
- CVC: any 3 digits (Amex: any **4** digits)
- ZIP / postal code: any value (e.g. `08832`)

---

## Success cards

| Brand | Number |
|--------|--------|
| Visa (main) | `4242 4242 4242 4242` |
| Mastercard | `5555 5555 5555 4444` |
| Amex | `3782 822463 10005` (4-digit CVC) |

**Recommended for invoice UAT:** Visa `4242 4242 4242 4242`

---

## How to test in this platform

1. Sign in as admin or office at https://launchpage-alex-roadservice.web.app/login.html  
2. Open **Invoices** → unpaid invoice → **Pay with Stripe**  
3. On Stripe Checkout, enter a success card from the table above  
4. Confirm:
   - Redirect to payment success page  
   - Invoice status becomes **Paid** or **Partially Paid**  
   - New row appears under **Payments** (`method: Stripe`)  
   - Stripe Dashboard → Webhooks → delivery **200** for `checkout.session.completed`

5. As **admin**, open **Payments** → **Refund** on that payment (full or partial)  
6. Confirm:
   - Payment status → **Refunded** or **Partially Refunded**  
   - Invoice **Paid** amount decreases / status reopens if fully refunded  
   - Stripe Dashboard → the Payment shows a refund  
   - Webhook delivery **200** for `charge.refunded` (after you add that event to the endpoint)

---

## Optional decline cards

| Scenario | Number |
|----------|--------|
| Generic decline | `4000 0000 0000 0002` |
| Insufficient funds | `4000 0000 0000 9995` |
| Incorrect CVC | `4000 0000 0000 0127` |
| Expired card | `4000 0000 0000 0069` |

Full official list: [Stripe testing docs](https://docs.stripe.com/testing#cards)

---

## Go live (only after test passes)

1. Stripe Dashboard → **Live mode**
2. Complete business verification if prompted
3. Set `STRIPE_SECRET_KEY` to `sk_live_...`:

   ```bash
   firebase functions:secrets:set STRIPE_SECRET_KEY
   # Paste: sk_live_...
   ```

4. Add a **new live** webhook (same URL + `checkout.session.completed`) and set `STRIPE_WEBHOOK_SECRET` to that live `whsec_...`:

   ```
   https://us-central1-launchpage-alex-roadservice.cloudfunctions.net/stripeWebhook
   ```

   ```bash
   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
   # Paste: live whsec_...
   ```

5. Redeploy functions:

   ```bash
   firebase deploy --only functions
   ```

6. Run one small real charge and verify the same checks as above:
   - Redirect to payment success page
   - Invoice status → **Paid** or **Partially Paid**
   - New **Payments** row (`method: Stripe`)
   - Stripe Live webhook delivery **200** for `checkout.session.completed`

---

## Related docs

- [`STRIPE_PAYMENTS_SETUP.md`](STRIPE_PAYMENTS_SETUP.md) — full payments setup checklist  
- [`docs/STRIPE_SETUP.md`](../docs/STRIPE_SETUP.md) — technical setup  
