/* Printable documents — invoice, estimate, receipt, work order */
window.ARS = window.ARS || {};

ARS.Documents = {
  _print(html, title) {
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) {
      showToast('Allow popups to print documents', 'warning');
      return;
    }
    w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:40px;color:#111;max-width:720px;margin:0 auto}
        h1{font-size:22px;margin:0 0 4px}
        .sub{color:#555;font-size:13px;margin-bottom:24px}
        table{width:100%;border-collapse:collapse;margin:16px 0}
        th,td{border-bottom:1px solid #ddd;padding:8px 4px;text-align:left;font-size:13px}
        .right{text-align:right}
        .total{font-size:18px;font-weight:bold;margin-top:12px}
        .footer{margin-top:40px;font-size:11px;color:#666;border-top:1px solid #ddd;padding-top:12px}
        @media print{body{padding:20px}}
      </style></head><body>${html}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 400);
  },

  shopHeader() {
    const s = ARS.Store.getSettings();
    return `<h1>${s.shopName || 'Alex Road Service'}</h1>
      <div class="sub">${s.shopAddress || ''}<br>${s.shopPhone || ''} · ${s.shopEmail || ''}</div>`;
  },

  printInvoice(invoiceId) {
    const inv = ARS.Data.getInvoice(invoiceId);
    if (!inv) return showToast('Invoice not found', 'error');
    const wo = inv.workOrderId ? ARS.Data.getWorkOrder(inv.workOrderId) : null;
    const s = ARS.Store.getSettings();
    const tax = wo?.tax || 0;
    const html = `${this.shopHeader()}
      <h2 style="margin-top:20px">INVOICE ${inv.id}</h2>
      <div class="sub">Date: ${inv.date} · Due: ${inv.due} · Status: ${inv.status}</div>
      <p><strong>Bill To:</strong> ${inv.customerName}</p>
      ${wo ? `<p><strong>Work Order:</strong> ${wo.id}<br><strong>Description:</strong> ${wo.desc}</p>` : ''}
      <table>
        <tr><th>Description</th><th class="right">Amount</th></tr>
        ${wo ? `<tr><td>Labor</td><td class="right">${ARS.fmtMoney(wo.labor)}</td></tr>
               <tr><td>Parts</td><td class="right">${ARS.fmtMoney(wo.parts)}</td></tr>` : ''}
        ${tax ? `<tr><td>Tax (${((s.taxRate || 0) * 100).toFixed(3)}%)</td><td class="right">${ARS.fmtMoney(tax)}</td></tr>` : ''}
        <tr><td><strong>Total</strong></td><td class="right"><strong>${ARS.fmtMoney(inv.total)}</strong></td></tr>
        <tr><td>Amount Paid</td><td class="right">${ARS.fmtMoney(inv.amountPaid || 0)}</td></tr>
        <tr><td>Balance Due</td><td class="right">${ARS.fmtMoney(inv.balance)}</td></tr>
      </table>
      <div class="footer">Payment terms: Net ${s.paymentTermsDays || 14} days. Thank you for your business.</div>`;
    this._print(html, inv.id);
  },

  printEstimate(estimateId) {
    const est = ARS.Data.listEstimates().find((e) => e.id === estimateId);
    if (!est) return showToast('Estimate not found', 'error');
    const html = `${this.shopHeader()}
      <h2 style="margin-top:20px">ESTIMATE ${est.id}</h2>
      <div class="sub">Date: ${est.date} · Status: ${est.status}</div>
      <p><strong>Customer:</strong> ${est.customerName}<br><strong>Truck:</strong> ${est.truckLabel || '—'}</p>
      <p>${est.desc}</p>
      <table>
        <tr><th>Item</th><th class="right">Amount</th></tr>
        <tr><td>Labor</td><td class="right">${ARS.fmtMoney(est.labor)}</td></tr>
        <tr><td>Parts</td><td class="right">${ARS.fmtMoney(est.parts)}</td></tr>
        <tr><td><strong>Total</strong></td><td class="right"><strong>${ARS.fmtMoney(est.total)}</strong></td></tr>
      </table>
      <div class="footer">This estimate is valid for 30 days. Approval required before work begins.</div>`;
    this._print(html, est.id);
  },

  printReceipt(paymentId) {
    const pay = ARS.Data.listPayments().find((p) => p.id === paymentId);
    if (!pay) return showToast('Payment not found', 'error');
    const html = `${this.shopHeader()}
      <h2 style="margin-top:20px">PAYMENT RECEIPT</h2>
      <div class="sub">${pay.id} · ${pay.date}</div>
      <table>
        <tr><td>Customer</td><td class="right">${pay.customerName}</td></tr>
        <tr><td>Invoice</td><td class="right">${pay.invoiceId}</td></tr>
        <tr><td>Method</td><td class="right">${pay.method}</td></tr>
        <tr><td><strong>Amount</strong></td><td class="right"><strong>${ARS.fmtMoney(pay.amount)}</strong></td></tr>
      </table>
      <div class="footer">Payment received. Thank you.</div>`;
    this._print(html, pay.id);
  },

  printWorkOrder(woId) {
    const wo = ARS.Data.getWorkOrder(woId);
    if (!wo) return showToast('Work order not found', 'error');
    const html = `${this.shopHeader()}
      <h2 style="margin-top:20px">WORK ORDER ${wo.id}</h2>
      <div class="sub">${wo.date} · ${wo.status} · Tech: ${wo.tech || 'Unassigned'}</div>
      <p><strong>Customer:</strong> ${wo.customerName}<br><strong>Truck:</strong> ${wo.truckLabel || '—'}</p>
      <p><strong>Service:</strong> ${wo.serviceType || '—'}<br>${wo.desc}</p>
      <table>
        <tr><th>Item</th><th class="right">Amount</th></tr>
        <tr><td>Labor</td><td class="right">${ARS.fmtMoney(wo.labor)}</td></tr>
        <tr><td>Parts</td><td class="right">${ARS.fmtMoney(wo.parts)}</td></tr>
        <tr><td><strong>Total</strong></td><td class="right"><strong>${ARS.fmtMoney(wo.total)}</strong></td></tr>
      </table>`;
    this._print(html, wo.id);
  },
};
