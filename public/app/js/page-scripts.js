/* Shared page helpers — loaded after data-service */
window.ARS = window.ARS || {};

ARS.Pages = {
  escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[char]));
  },

  isDataReady() {
    if (ARS.isDemoMode?.()) return true;
    if (!window.ARSFirebase?.configured) return true;
    if (ARS.FirestoreSync?.isHydrated?.()) return true;
    // Stale-while-revalidate: paint from localStorage while cloud sync catches up
    if (ARS.Store?.hasLocalCache?.()) return true;
    if (window.__ARS_APP_READY && !ARS.FirestoreSync?.isActive?.()) return true;
    return false;
  },

  waitReady(fn) {
    const run = () => {
      if (this.isDataReady()) {
        fn();
        return;
      }
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        document.removeEventListener('ars:data-hydrated', onHydrated);
        fn();
      };
      const onHydrated = () => finish();
      document.addEventListener('ars:data-hydrated', onHydrated, { once: true });
      setTimeout(finish, 8000);
    };
    if (window.__ARS_APP_READY) {
      run();
      return;
    }
    window.addEventListener('ars:ready', run, { once: true });
  },

  query() {
    return new URLSearchParams(window.location.search);
  },

  getParam(name, fallback = '') {
    return this.query().get(name) ?? fallback;
  },

  appHref(path) {
    if (!ARS.isDemoMode?.()) return path;
    const sep = path.includes('?') ? '&' : '?';
    return `${path}${sep}demo=1`;
  },

  loadingRow(colspan, message = 'Loading…') {
    return `<tr><td colspan="${Number(colspan) || 1}"><div class="loading-state"><div class="loading-state__spinner"></div><div class="loading-state__text">${this.escapeHtml(message)}</div></td></tr>`;
  },

  emptyRow(colspan, title, icon = 'fa-inbox') {
    const safeIcon = /^fa-[a-z0-9-]+$/i.test(icon) ? icon : 'fa-inbox';
    return `<tr><td colspan="${Number(colspan) || 1}"><div class="empty-state"><div class="empty-state__icon"><i class="fas ${safeIcon}"></i></div><div class="empty-state__title">${this.escapeHtml(title)}</div></div></td></tr>`;
  },

  tablePlaceholder(colspan, emptyTitle, icon = 'fa-inbox') {
    if (!this.isDataReady()) return this.loadingRow(colspan);
    return this.emptyRow(colspan, emptyTitle, icon);
  },

  entityLink(label, href, extraStyle = '') {
    const safeLabel = this.escapeHtml(label || '—');
    if (!href) return safeLabel;
    const safeHref = String(href).startsWith('/') || String(href).startsWith('#') ? this.appHref(href) : '#';
    return `<a href="${this.escapeHtml(safeHref)}" style="color:inherit;text-decoration:none;font-weight:600;${this.escapeHtml(extraStyle)}">${safeLabel}</a>`;
  },

  setActiveFilterTab(tabsId, filter) {
    const root = document.getElementById(tabsId);
    if (!root) return filter;
    const tabs = [...root.querySelectorAll('.filter-tab')];
    let match = tabs.find((t) => t.dataset.filter === filter);
    if (!match && filter === 'awaiting') match = tabs.find((t) => t.dataset.filter === 'Pending');
    if (!match && (filter === 'unpaid' || filter === 'actionable' || filter === 'attention' || filter === 'mtd')) {
      match = tabs.find((t) => t.dataset.filter === 'all') || tabs[0];
    }
    if (!match) match = tabs.find((t) => t.dataset.filter === 'all') || tabs[0];
    tabs.forEach((t) => t.classList.remove('active'));
    if (match) match.classList.add('active');
    return match?.dataset.filter || filter;
  },

  /**
   * Read URL params and apply to list pages.
   * Returns { filter, q, customerId, truckId, period, highlight, openCreate }
   */
  readListQuery(opts = {}) {
    const q = this.query();
    const filter = q.get('status') || q.get('filter') || opts.defaultFilter || 'all';
    return {
      filter,
      q: q.get('q') || '',
      customerId: q.get('customerId') || '',
      truckId: q.get('truckId') || '',
      period: q.get('period') || '',
      highlight: q.get('highlight') || q.get('partId') || '',
      openCreate: q.get('open') === 'create',
      invoiceId: q.get('invoiceId') || '',
    };
  },

  applyListQuery({ tabsId, searchId, defaultFilter = 'all' } = {}) {
    const state = this.readListQuery({ defaultFilter });
    if (tabsId) this.setActiveFilterTab(tabsId, state.filter);
    if (searchId && state.q) {
      const input = document.getElementById(searchId);
      if (input) input.value = state.q;
    }
    if (state.highlight) {
      setTimeout(() => this.highlightRow(state.highlight), 250);
    }
    return state;
  },

  highlightRow(id) {
    if (!id) return;
    const row = document.querySelector(`[data-row-id="${CSS.escape(id)}"]`)
      || document.querySelector(`tr[data-id="${CSS.escape(id)}"]`);
    if (!row) return;
    row.classList.add('row--highlight');
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => row.classList.remove('row--highlight'), 2600);
  },

  openModalIfRequested(modalId) {
    if (this.getParam('open') !== 'create' || !modalId) return false;
    setTimeout(() => {
      if (typeof openModal === 'function') openModal(modalId);
    }, 80);
    return true;
  },

  bindKpiFilter(elOrId, hrefOrFn) {
    const el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
    if (!el) return;
    const card = el.closest('.kpi-card') || el;
    card.classList.add('kpi-card--clickable');
    card.title = card.title || 'Click to view';
    card.addEventListener('click', (e) => {
      if (e.target.closest('a,button')) return;
      if (typeof hrefOrFn === 'function') hrefOrFn();
      else window.location.href = this.appHref(hrefOrFn);
    });
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

  /** Toast + optional View CTA modal after create/convert */
  successWithView({ title, message, href, viewLabel = 'View', stayLabel = 'Stay here' }) {
    showToast(message || title, 'success');
    if (!href) return;
    this.ensureActionModal();
    document.getElementById('arsActionTitle').textContent = title || 'Success';
    document.getElementById('arsActionMsg').textContent = message || '';
    const viewBtn = document.getElementById('arsActionView');
    viewBtn.textContent = viewLabel;
    viewBtn.onclick = () => { window.location.href = this.appHref(href); };
    document.getElementById('arsActionStay').textContent = stayLabel;
    openModal('arsActionModal');
  },

  ensureActionModal() {
    if (document.getElementById('arsActionModal')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="arsActionModal">
        <div class="modal" style="max-width:420px">
          <div class="modal__header">
            <div class="modal__title" id="arsActionTitle">Success</div>
            <button class="modal__close" data-close-modal><i class="fas fa-times"></i></button>
          </div>
          <div class="modal__body">
            <p id="arsActionMsg" style="margin:0;color:var(--steel);font-size:.9rem"></p>
          </div>
          <div class="modal__footer">
            <button class="btn btn--secondary" data-close-modal id="arsActionStay">Stay here</button>
            <button class="btn btn--primary" id="arsActionView">View</button>
          </div>
        </div>
      </div>`);
    document.getElementById('arsActionModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'arsActionModal') closeModal('arsActionModal');
    });
    document.querySelector('#arsActionModal [data-close-modal]')?.addEventListener('click', () => closeModal('arsActionModal'));
    document.getElementById('arsActionStay')?.addEventListener('click', () => closeModal('arsActionModal'));
  },

  ensureConfirmModal() {
    if (document.getElementById('arsConfirmModal')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="arsConfirmModal">
        <div class="modal" style="max-width:420px">
          <div class="modal__header">
            <div class="modal__title" id="arsConfirmTitle">Confirm</div>
            <button class="modal__close" data-close-modal><i class="fas fa-times"></i></button>
          </div>
          <div class="modal__body">
            <p id="arsConfirmMsg" style="margin:0;color:var(--steel);font-size:.9rem"></p>
          </div>
          <div class="modal__footer">
            <button class="btn btn--secondary" data-close-modal id="arsConfirmCancel">Cancel</button>
            <button class="btn btn--primary" id="arsConfirmOk">Confirm</button>
          </div>
        </div>
      </div>`);
  },

  confirmAsync({ title = 'Confirm', message = 'Are you sure?', okLabel = 'Confirm' } = {}) {
    this.ensureConfirmModal();
    return new Promise((resolve) => {
      document.getElementById('arsConfirmTitle').textContent = title;
      document.getElementById('arsConfirmMsg').textContent = message;
      const ok = document.getElementById('arsConfirmOk');
      ok.textContent = okLabel;
      const finish = (val) => {
        closeModal('arsConfirmModal');
        ok.onclick = null;
        resolve(val);
      };
      ok.onclick = () => finish(true);
      document.getElementById('arsConfirmCancel').onclick = () => finish(false);
      document.querySelector('#arsConfirmModal [data-close-modal]').onclick = () => finish(false);
      openModal('arsConfirmModal');
    });
  },

  ensurePromptModal() {
    if (document.getElementById('arsPromptModal')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="modal-overlay" id="arsPromptModal">
        <div class="modal" style="max-width:440px">
          <div class="modal__header">
            <div class="modal__title" id="arsPromptTitle">Input</div>
            <button class="modal__close" data-close-modal><i class="fas fa-times"></i></button>
          </div>
          <div class="modal__body">
            <p id="arsPromptMsg" style="margin:0 0 12px;color:var(--steel);font-size:.88rem"></p>
            <div class="form-row" id="arsPromptFieldWrap">
              <label class="form-label" id="arsPromptLabel">Value</label>
              <input class="form-input" id="arsPromptInput">
            </div>
            <div class="form-row" id="arsPromptAreaWrap" hidden>
              <label class="form-label" id="arsPromptAreaLabel">Notes</label>
              <textarea class="form-textarea" id="arsPromptArea" rows="3"></textarea>
            </div>
          </div>
          <div class="modal__footer">
            <button class="btn btn--secondary" data-close-modal id="arsPromptCancel">Cancel</button>
            <button class="btn btn--primary" id="arsPromptOk">Save</button>
          </div>
        </div>
      </div>`);
  },

  promptAsync({
    title = 'Input',
    message = '',
    label = 'Value',
    defaultValue = '',
    okLabel = 'Save',
    multiline = false,
    inputType = 'text',
  } = {}) {
    this.ensurePromptModal();
    return new Promise((resolve) => {
      document.getElementById('arsPromptTitle').textContent = title;
      document.getElementById('arsPromptMsg').textContent = message;
      const input = document.getElementById('arsPromptInput');
      const area = document.getElementById('arsPromptArea');
      const fieldWrap = document.getElementById('arsPromptFieldWrap');
      const areaWrap = document.getElementById('arsPromptAreaWrap');
      fieldWrap.hidden = multiline;
      areaWrap.hidden = !multiline;
      if (multiline) {
        document.getElementById('arsPromptAreaLabel').textContent = label;
        area.value = defaultValue;
      } else {
        document.getElementById('arsPromptLabel').textContent = label;
        input.type = inputType;
        input.value = defaultValue;
      }
      const ok = document.getElementById('arsPromptOk');
      ok.textContent = okLabel;
      const finish = (val) => {
        closeModal('arsPromptModal');
        ok.onclick = null;
        resolve(val);
      };
      ok.onclick = () => finish(multiline ? area.value : input.value);
      document.getElementById('arsPromptCancel').onclick = () => finish(null);
      document.querySelector('#arsPromptModal [data-close-modal]').onclick = () => finish(null);
      openModal('arsPromptModal');
      setTimeout(() => (multiline ? area : input).focus(), 50);
    });
  },

  populateCustomerSelect(sel, selectedId) {
    if (!sel) return;
    const customers = ARS.Data.listCustomers({ status: 'Active' });
    const placeholder = new Option('Select customer…', '');
    const options = customers.map((c) => {
      const name = c.company !== '—' ? c.company : c.name;
      const option = new Option(name, c.id);
      option.dataset.name = name;
      return option;
    });
    sel.replaceChildren(placeholder, ...options);
    if (selectedId) sel.value = selectedId;
  },

  populateTruckSelect(sel, customerId, selectedId) {
    if (!sel) return;
    const trucks = customerId ? ARS.Data.listTrucks({ customerId }) : [];
    const placeholder = new Option('Select truck…', '');
    const options = trucks.map((t) => {
      const label = `Unit ${t.unit} · ${t.make} ${t.model}`;
      const option = new Option(label, t.id);
      option.dataset.label = label;
      return option;
    });
    sel.replaceChildren(placeholder, ...options);
    if (selectedId) sel.value = selectedId;
  },

  populateTechSelect(sel, selected) {
    if (!sel) return;
    const current = selected ?? sel.value;
    const techs = ARS.Data.getTechs();
    const options = techs.map((t) => {
      const name = typeof t === 'string' ? t : (t.name || '');
      const uid = typeof t === 'string' ? '' : (t.uid || '');
      const isSelected = current === name || current === uid;
      const option = new Option(name, name, false, isSelected);
      option.dataset.uid = uid;
      return option;
    });
    if (current && !techs.some((t) => (typeof t === 'string' ? t : t.name) === current || t.uid === current)) {
      options.unshift(new Option(current, current, false, true));
    }
    sel.replaceChildren(new Option('Unassigned', ''), ...options);
    if (current) sel.value = current;
  },

  /**
   * Multi-select technician picker (checkbox list).
   * @param {HTMLElement} el container
   * @param {Array<string|{uid?:string,name?:string}>} selected
   * @param {{ disabled?: boolean }} opts
   */
  populateTechMultiSelect(el, selected = [], opts = {}) {
    if (!el) return;
    const disabled = !!opts.disabled;
    const selectedKeys = new Set(
      (selected || []).map((t) => {
        if (typeof t === 'string') return t.toLowerCase();
        return String(t.uid || t.name || '').toLowerCase();
      }).filter(Boolean),
    );
    const techs = ARS.Data.getTechs();
    if (!techs.length) {
      el.innerHTML = '<div class="td-muted" style="padding:10px;font-size:.85rem">No active technicians yet. Hire technicians on the Employees page.</div>';
      return;
    }
    el.replaceChildren(...techs.map((t) => {
      const name = typeof t === 'string' ? t : (t.name || '');
      const uid = typeof t === 'string' ? '' : (t.uid || '');
      const checked = selectedKeys.has(uid.toLowerCase()) || selectedKeys.has(name.toLowerCase());
      const label = document.createElement('label');
      label.className = 'tech-picker__row';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = name;
      input.dataset.uid = uid;
      input.checked = checked;
      input.disabled = disabled;
      const text = document.createElement('span');
      text.textContent = name;
      label.append(input, text);
      return label;
    }));
  },

  getSelectedTechs(el) {
    if (!el) return [];
    return [...el.querySelectorAll('input[type=checkbox]:checked')].map((cb) => ({
      uid: cb.dataset.uid || '',
      name: cb.value,
    }));
  },

  populateServiceSelect(sel) {
    if (!sel) return;
    sel.replaceChildren(
      new Option('Select service…', ''),
      ...ARS.Data.getServiceTypes().map((service) => new Option(service, service)),
    );
  },

  /** Shared status filter helpers used by list pages */
  matchesStatusFilter(itemStatus, filter, kind) {
    if (!filter || filter === 'all') return true;
    if (filter === 'awaiting' && kind === 'estimates') return ['Pending', 'Sent'].includes(itemStatus);
    if (filter === 'unpaid' && kind === 'invoices') return !['Paid', 'Written Off'].includes(itemStatus);
    if (filter === 'actionable' && kind === 'workOrders') {
      return ['Open', 'In Progress', 'Waiting Parts'].includes(itemStatus)
        || itemStatus === 'Completed';
    }
    if (filter === 'attention' && kind === 'inventory') return ['Low', 'Out of Stock'].includes(itemStatus);
    if (filter === 'mtd') return true;
    return itemStatus === filter;
  },

  isMtd(dateLike) {
    const d = new Date(dateLike);
    if (isNaN(d)) return false;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return d >= start;
  },
};
