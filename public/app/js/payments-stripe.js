/* Stripe Checkout — all platform payments go through Stripe */
window.ARS = window.ARS || {};

ARS.Payments = {
  async startCheckout(invoiceId, amount) {
    if (!ARS.can('payments.record')) throw new Error('Permission denied');
    if (!window.ARSFirebase?.app) throw new Error('Firebase is required for payments.');

    const inv = ARS.Data.getInvoice(invoiceId);
    if (!inv) throw new Error('Invoice not found');
    if (['Paid', 'Written Off'].includes(inv.status)) throw new Error('Invoice is already closed.');

    const payAmount = amount != null ? Number(amount) : inv.balance;
    if (!payAmount || payAmount <= 0) throw new Error('Invalid payment amount.');
    if (payAmount > inv.balance + 0.01) throw new Error(`Amount cannot exceed balance (${ARS.fmtMoney(inv.balance)}).`);

    const { getFunctions, httpsCallable } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js');
    const fn = httpsCallable(getFunctions(window.ARSFirebase.app, 'us-central1'), 'createStripeCheckout');
    const res = await fn({ invoiceId, amount: payAmount });
    if (!res.data?.url) throw new Error('Stripe checkout could not be started.');
    window.location.href = res.data.url;
  },
};
