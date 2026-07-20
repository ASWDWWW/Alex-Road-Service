/* Stripe Checkout + Refunds — live via Cloud Functions; simulated in demo mode */
window.ARS = window.ARS || {};

ARS.Payments = {
  async _callable(name, data) {
    if (!window.ARSFirebase?.app) throw new Error('Firebase is required for payments.');
    const { getFunctions, httpsCallable } = await import(
      'https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js'
    );
    const fn = httpsCallable(getFunctions(window.ARSFirebase.app, 'us-central1'), name);
    return fn(data);
  },

  async startCheckout(invoiceId, amount) {
    if (!ARS.can('payments.record')) throw new Error('Permission denied');

    const inv = ARS.Data.getInvoice(invoiceId);
    if (!inv) throw new Error('Invoice not found');
    if (['Paid', 'Written Off'].includes(inv.status)) throw new Error('Invoice is already closed.');

    const payAmount = amount != null ? Number(amount) : inv.balance;
    if (!payAmount || payAmount <= 0) throw new Error('Invalid payment amount.');
    if (payAmount > inv.balance + 0.01) {
      throw new Error(`Amount cannot exceed balance (${ARS.fmtMoney(inv.balance)}).`);
    }

    if (ARS.isDemoMode?.()) {
      const result = await ARS.Data.recordDemoPayment(invoiceId, payAmount);
      const params = new URLSearchParams({
        demo: '1',
        invoiceId,
        amount: String(payAmount),
        paymentId: result.paymentId,
      });
      window.location.href = `/app/payment-success.html?${params.toString()}`;
      return;
    }

    const res = await this._callable('createStripeCheckout', { invoiceId, amount: payAmount });
    if (!res.data?.url) throw new Error('Stripe checkout could not be started.');
    window.location.href = res.data.url;
  },

  /**
   * Refund a completed Stripe payment (full or partial). Admin only.
   * @param {string} paymentId
   * @param {{ amount?: number, reason?: string }} [opts]
   */
  async refundPayment(paymentId, opts = {}) {
    if (!ARS.can('payments.refund')) throw new Error('Permission denied — admin only');

    const payment = ARS.Data.getPayment(paymentId);
    if (!payment) throw new Error('Payment not found');
    if (payment.status === 'Refunded') throw new Error('Payment is already fully refunded');

    const refundable = ARS.Data.paymentRefundable(payment);
    if (refundable <= 0.01) throw new Error('No refundable balance left on this payment');

    const amount = opts.amount != null ? Number(opts.amount) : refundable;
    if (!amount || amount <= 0) throw new Error('Invalid refund amount');
    if (amount > refundable + 0.01) {
      throw new Error(`Amount cannot exceed refundable balance (${ARS.fmtMoney(refundable)})`);
    }

    const reason = (opts.reason || '').trim() || 'requested_by_customer';

    let result;
    if (ARS.isDemoMode?.()) {
      result = await ARS.Data.recordDemoRefund(paymentId, amount, reason);
    } else {
      const res = await this._callable('createStripeRefund', {
        paymentId,
        amount,
        reason,
      });
      result = res.data || {};
      ARS.Data.applyLocalRefundResult(paymentId, {
        amount: result.alreadyRefunded ? 0 : (result.amount || amount),
        refundedAmount: result.refundedAmount,
        status: result.status || 'Refunded',
        refundId: result.refundId,
      });
    }

    return result;
  },
};
