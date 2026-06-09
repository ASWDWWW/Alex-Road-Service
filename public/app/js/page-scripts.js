/* Shared page helpers — loaded after data-service */
window.ARS = window.ARS || {};

ARS.Pages = {
  waitReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        document.addEventListener('ars:ready', fn, { once: true });
      });
    } else {
      document.addEventListener('ars:ready', fn, { once: true });
    }
  },

  bindFilters(tabsId, searchId, countId, onChange) {
    document.getElementById(tabsId)?.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-tab');
      if (!btn) return;
      document.querySelectorAll(`#${tabsId} .filter-tab`).forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      onChange({ filter: btn.dataset.filter });
    });
    document.getElementById(searchId)?.addEventListener('input', (e) => {
      onChange({ q: e.target.value });
    });
  },

  populateCustomerSelect(sel, selectedId) {
    if (!sel) return;
    const customers = ARS.Data.listCustomers({ status: 'Active' });
    sel.innerHTML = '<option value="">Select customer…</option>' +
      customers.map((c) => `<option value="${c.id}" data-name="${c.company !== '—' ? c.company : c.name}">${c.company !== '—' ? c.company : c.name}</option>`).join('');
    if (selectedId) sel.value = selectedId;
  },

  populateTruckSelect(sel, customerId, selectedId) {
    if (!sel) return;
    const trucks = customerId ? ARS.Data.listTrucks({ customerId }) : [];
    sel.innerHTML = '<option value="">Select truck…</option>' +
      trucks.map((t) => `<option value="${t.id}" data-label="Unit ${t.unit} · ${t.make} ${t.model}">${`Unit ${t.unit} · ${t.make} ${t.model}`}</option>`).join('');
    if (selectedId) sel.value = selectedId;
  },

  populateTechSelect(sel, selected) {
    if (!sel) return;
    sel.innerHTML = ARS.Data.getTechs().map((t) => `<option value="${t}"${t === selected ? ' selected' : ''}>${t}</option>`).join('');
  },

  populateServiceSelect(sel) {
    if (!sel) return;
    sel.innerHTML = '<option value="">Select service…</option>' +
      ARS.Data.getServiceTypes().map((s) => `<option>${s}</option>`).join('');
  },
};
