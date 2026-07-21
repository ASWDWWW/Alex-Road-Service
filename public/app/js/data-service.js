/* Alex Road Service — Business Logic & CRUD */
window.ARS = window.ARS || {};

const DEFAULT_ONBOARDING_STEPS = [
  { id: 'account', label: 'Platform account created' },
  { id: 'i9', label: 'I-9 employment eligibility' },
  { id: 'w4', label: 'W-4 tax withholding' },
  { id: 'handbook', label: 'Employee handbook acknowledged' },
  { id: 'safety', label: 'Shop safety orientation' },
  { id: 'tools', label: 'Tools / PPE issued' },
  { id: 'access', label: 'Shop keys / access' },
  { id: 'training', label: 'Role training complete' },
];

ARS.Data = {
  _techs: [],

  async init() {
    if (ARS.isDemoMode?.()) {
      ARS.Demo?.getState?.();
      this._techs = [
        { uid: 'demo-mike', name: 'Mike Santos' },
        { uid: 'demo-alex', name: 'Alex Rodriguez' },
        { uid: 'demo-sarah', name: 'Sarah Torres' },
      ];
      this.refreshTruckPMStatus();
      this.refreshOverdueInvoices();
      this.refreshNotifications();
      return;
    }
    this.refreshTruckPMStatus();
    this.refreshOverdueInvoices();
    this.refreshNotifications();
    // Keep tech list in sync with employee directory (and cloud query as backup)
    this.refreshTechs().catch(() => {});
    document.addEventListener('ars:data-changed', () => {
      this.refreshTechsFromEmployees();
    });
  },

  async _nextId(prefix, localKey) {
    if (ARS.FirestoreSync?.isActive?.()) {
      return ARS.FirestoreSync.nextSequentialId(prefix);
    }
    if (!ARS.isDemoMode?.()) {
      throw new Error('Cloud data service is unavailable. Reconnect before creating records.');
    }
    const { year, num } = ARS.Store.bumpCounter(localKey || prefix.toLowerCase());
    return ARS.nextId(prefix, year, num);
  },

  async _persist(collection, item) {
    if (!item?.id) throw new Error('Cannot save a record without an ID.');
    if (ARS.isDemoMode?.()) return item;
    if (!ARS.FirestoreSync?.isActive?.()) {
      throw new Error('Cloud data service is unavailable. Your change was not saved.');
    }
    await ARS.FirestoreSync.pushItem(collection, item);
    return item;
  },

  _audit(entry) {
    if (ARS.FirestoreSync?.isActive?.()) {
      ARS.FirestoreSync.audit(entry);
    } else {
      ARS.Store.audit(entry);
    }
  },

  refreshTruckPMStatus() {
    const s = ARS.Store.load();
    const now = Date.now();
    let changed = false;
    s.trucks.forEach((t, i) => {
      const next = new Date(t.nextPM);
      if (!isNaN(next) && next.getTime() <= now + 30 * 86400000 && t.status === 'Active') {
        if (s.trucks[i].status !== 'PM Due') { s.trucks[i].status = 'PM Due'; changed = true; }
      }
    });
    if (changed) ARS.Store.save(s);
  },

  listWorkOrdersReadyToInvoice() {
    return ARS.Store.getCollection('workOrders').filter(
      (w) => w.status === 'Completed' && !w.invoiced
    );
  },

  listContactSubmissions(filters = {}) {
    let items = ARS.Store.getCollection('contactSubmissions');
    if (filters.status) {
      if (filters.status === 'New') {
        items = items.filter((l) => !l.status || l.status === 'New');
      } else {
        items = items.filter((l) => l.status === filters.status);
      }
    }
    return items;
  },

  async updateContactSubmission(id, patch) {
    const s = ARS.Store.load();
    const i = s.contactSubmissions.findIndex((l) => l.id === id);
    if (i < 0) throw new Error('Lead not found');
    s.contactSubmissions[i] = {
      ...s.contactSubmissions[i],
      ...patch,
      version: Number(s.contactSubmissions[i].version || 1) + 1,
      updatedAt: new Date().toISOString(),
    };
    ARS.Store.save(s);
    const updated = s.contactSubmissions[i];
    try {
      await this._persist('contact_submissions', updated);
    } catch (e) {
      throw new Error(e.message || 'Could not save lead status to cloud');
    }
    return updated;
  },

  /* ─── CUSTOMERS ─── */
  listCustomers(filters = {}) {
    let items = ARS.Store.getCollection('customers');
    if (filters.status) items = items.filter((c) => c.status === filters.status);
    if (filters.type) items = items.filter((c) => c.type === filters.type);
    if (filters.q) {
      const q = filters.q.toLowerCase();
      items = items.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        (c.company || '').toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.id.toLowerCase().includes(q)
      );
    }
    return items.map((c) => this.enrichCustomer(c));
  },

  enrichCustomer(c) {
    const trucks = ARS.Store.getCollection('trucks').filter((t) => t.customerId === c.id);
    const wos = ARS.Store.getCollection('workOrders').filter((w) => w.customerId === c.id);
    const lastWo = wos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    const matchedPayments = ARS.Store.getCollection('payments').filter((p) =>
      (p.customerId && p.customerId === c.id)
      || p.customerName === c.name
      || (c.company && c.company !== '—' && p.customerName === c.company)
    );
    // Always use net payment sum when any payments match — including $0 after full refunds
    const spent = matchedPayments.length
      ? matchedPayments.reduce((s, p) => s + this.paymentNetAmount(p), 0)
      : (Number(c.spentAmount) || 0);
    return {
      ...c,
      trucks: trucks.length,
      lastService: lastWo ? lastWo.date : c.lastService || '—',
      spent: ARS.fmtMoney(spent),
      spentAmount: spent,
    };
  },

  getCustomer(id) {
    const c = ARS.Store.getCollection('customers').find((x) => x.id === id);
    return c ? this.enrichCustomer(c) : null;
  },

  async createCustomer(data) {
    const s = ARS.Store.load();
    const id = await this._nextId('C', 'cust');
    const customer = {
      id,
      name: `${data.firstName} ${data.lastName}`.trim(),
      company: data.company || '—',
      phone: data.phone,
      email: data.email || '',
      type: data.type || 'Fleet',
      trucks: Number(data.truckCount) || 1,
      status: 'Active',
      notes: data.notes || '',
      spentAmount: 0,
      version: 1,
      createdAt: new Date().toISOString(),
    };
    s.customers.push(customer);
    ARS.Store.save(s);
    this._audit({ action: 'customer.create', entityId: id, entityType: 'customer' });
    await this._persist('customers', customer);
    this.refreshNotifications();
    return customer;
  },

  async updateCustomer(id, patch) {
    const s = ARS.Store.load();
    const i = s.customers.findIndex((c) => c.id === id);
    if (i < 0) throw new Error('Customer not found');
    s.customers[i] = { ...s.customers[i], ...patch, version: (s.customers[i].version || 1) + 1, updatedAt: new Date().toISOString() };
    ARS.Store.save(s);
    await this._persist('customers', s.customers[i]);
    return s.customers[i];
  },

  async deactivateCustomer(id) {
    return this.updateCustomer(id, { status: 'Inactive' });
  },

  /* ─── TRUCKS ─── */
  listTrucks(filters = {}) {
    let items = ARS.Store.getCollection('trucks');
    if (filters.customerId) items = items.filter((t) => t.customerId === filters.customerId);
    if (filters.status) items = items.filter((t) => t.status === filters.status);
    if (filters.q) {
      const q = filters.q.toLowerCase();
      items = items.filter((t) =>
        t.unit.toLowerCase().includes(q) ||
        t.make.toLowerCase().includes(q) ||
        t.model.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q)
      );
    }
    return items.map((t) => this.enrichTruck(t));
  },

  enrichTruck(t) {
    const cust = ARS.Store.getCollection('customers').find((c) => c.id === t.customerId);
    return { ...t, owner: cust ? (cust.company !== '—' ? cust.company : cust.name) : t.owner };
  },

  getTruck(id) {
    const t = ARS.Store.getCollection('trucks').find((x) => x.id === id);
    return t ? this.enrichTruck(t) : null;
  },

  async createTruck(data) {
    const s = ARS.Store.load();
    const id = await this._nextId('T', 'truck');
    const truck = {
      id,
      unit: data.unit,
      year: Number(data.year),
      make: data.make,
      model: data.model,
      vin: data.vin || '',
      customerId: data.customerId,
      mileage: data.mileage || '0',
      lastPM: data.lastPM || ARS.fmtDate(new Date()),
      nextPM: data.nextPM || ARS.fmtDate(new Date(Date.now() + 180 * 86400000)),
      status: 'Active',
      version: 1,
      createdAt: new Date().toISOString(),
    };
    s.trucks.push(truck);
    ARS.Store.save(s);
    this._audit({ action: 'truck.create', entityId: id, entityType: 'truck' });
    await this._persist('trucks', truck);
    return this.enrichTruck(truck);
  },

  async updateTruck(id, patch) {
    const s = ARS.Store.load();
    const i = s.trucks.findIndex((t) => t.id === id);
    if (i < 0) throw new Error('Truck not found');
    s.trucks[i] = {
      ...s.trucks[i],
      ...patch,
      version: (s.trucks[i].version || 1) + 1,
      updatedAt: new Date().toISOString(),
    };
    ARS.Store.save(s);
    await this._persist('trucks', s.trucks[i]);
    return this.enrichTruck(s.trucks[i]);
  },

  trucksPMDue(withinDays = 30) {
    const cutoff = Date.now() + withinDays * 86400000;
    return this.listTrucks().filter((t) => {
      const d = new Date(t.nextPM);
      return !isNaN(d) && d.getTime() <= cutoff;
    });
  },

  /* ─── WORK ORDERS ─── */

  /** Normalize tech assignment to multi-tech shape (backward compatible with single tech/techId) */
  getWoTechs(wo) {
    if (!wo) return [];
    if (Array.isArray(wo.techs) && wo.techs.length) {
      return wo.techs
        .map((t) => {
          if (typeof t === 'string') return { uid: '', name: t.trim() };
          return { uid: t.uid || '', name: String(t.name || '').trim() };
        })
        .filter((t) => t.name);
    }
    if (Array.isArray(wo.techIds) && wo.techIds.length && wo.tech) {
      const names = String(wo.tech).split(/\s*,\s*/).filter(Boolean);
      return wo.techIds.map((uid, i) => ({
        uid,
        name: names[i] || this.getTechs().find((t) => t.uid === uid)?.name || uid,
      })).filter((t) => t.name);
    }
    if (wo.tech) {
      const names = String(wo.tech).split(/\s*,\s*/).filter(Boolean);
      if (names.length > 1) {
        return names.map((name) => ({ uid: '', name }));
      }
      return [{ uid: wo.techId || '', name: names[0] }];
    }
    return [];
  },

  formatWoTechs(wo, empty = '—') {
    const techs = this.getWoTechs(wo);
    return techs.length ? techs.map((t) => t.name).join(', ') : empty;
  },

  normalizeTechAssignment(input = {}) {
    let list = [];
    if (Array.isArray(input.techs)) {
      list = input.techs.map((t) => {
        if (typeof t === 'string') return { uid: '', name: t.trim() };
        return { uid: t.uid || '', name: String(t.name || '').trim() };
      });
    } else if (input.tech) {
      const names = String(input.tech).split(/\s*,\s*/).filter(Boolean);
      const ids = Array.isArray(input.techIds)
        ? input.techIds
        : (input.techId ? [input.techId] : []);
      list = names.map((name, i) => ({ uid: ids[i] || '', name }));
    }
    list = list.filter((t) => t.name);
    // de-dupe by uid or name
    const seen = new Set();
    list = list.filter((t) => {
      const key = t.uid || t.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return {
      techs: list,
      techIds: list.map((t) => t.uid).filter(Boolean),
      tech: list.map((t) => t.name).join(', '),
      techId: list[0]?.uid || '',
    };
  },

  woAssignedToUser(wo, user = ARS.Auth?.getUser?.()) {
    if (!wo || !user) return false;
    return this.getWoTechs(wo).some((t) =>
      (t.uid && t.uid === user.uid) || (t.name && t.name === user.name));
  },

  listWorkOrders(filters = {}) {
    let items = ARS.Store.getCollection('workOrders');
    const role = ARS.Auth?.getRole?.();
    const user = ARS.Auth?.getUser?.();
    if (role === 'technician' && user) {
      items = items.filter((w) => this.woAssignedToUser(w, user));
    }
    if (filters.status) items = items.filter((w) => w.status === filters.status);
    if (filters.q) {
      const q = filters.q.toLowerCase();
      items = items.filter((w) =>
        w.id.toLowerCase().includes(q) ||
        (w.customerName || '').toLowerCase().includes(q) ||
        this.formatWoTechs(w, '').toLowerCase().includes(q)
      );
    }
    return items;
  },

  getWorkOrder(id) {
    return ARS.Store.getCollection('workOrders').find((w) => w.id === id) || null;
  },

  async createWorkOrder(data) {
    const settings = ARS.Store.getSettings();
    const id = await this._nextId('WO', 'wo');
    const totals = ARS.calcTotals(data.labor, data.parts, settings);
    const techFields = this.normalizeTechAssignment(data);
    const s = ARS.Store.load();
    const wo = {
      id,
      date: data.date ? ARS.fmtDate(data.date) : ARS.fmtDate(new Date()),
      customerId: data.customerId,
      customerName: data.customerName,
      truckId: data.truckId || '',
      truckLabel: data.truckLabel,
      ...techFields,
      serviceType: data.serviceType || '',
      status: data.status || 'Open',
      desc: data.desc,
      labor: totals.labor,
      parts: totals.parts,
      tax: totals.tax,
      total: totals.total,
      invoiced: false,
      estimateId: data.estimateId || null,
      media: Array.isArray(data.media) ? data.media : [],
      version: 1,
      createdAt: new Date().toISOString(),
    };
    s.workOrders.unshift(wo);
    ARS.Store.save(s);
    this._audit({ action: 'workOrder.create', entityId: id, entityType: 'workOrder' });
    await this._persist('workOrders', wo);
    this.refreshNotifications();
    return wo;
  },

  async updateWorkOrder(id, patch) {
    const s = ARS.Store.load();
    const i = s.workOrders.findIndex((w) => w.id === id);
    if (i < 0) throw new Error('Work order not found');
    const cur = s.workOrders[i];
    if (patch.version && patch.version !== cur.version) throw new Error('Conflict: record was modified by another user');
    if (!ARS.isDemoMode?.()
      && patch.status === 'Completed'
      && !['Completed', 'Invoiced'].includes(cur.status)) {
      const result = await ARS.FirestoreSync.completeWorkOrder(id, cur.version || 1);
      s.workOrders[i] = result.workOrder;
      ARS.Store.save(s);
      this.refreshNotifications();
      return result.workOrder;
    }
    if (patch.status === 'Invoiced' && !cur.invoiced && !patch.invoiced) {
      throw new Error('Use Generate Invoice to mark a work order as invoiced');
    }
    const settings = ARS.Store.getSettings();
    const labor = patch.labor ?? cur.labor;
    const parts = patch.parts ?? cur.parts;
    const totals = ARS.calcTotals(labor, parts, settings);
    let nextPatch = { ...patch };
    if (patch.techs !== undefined || patch.tech !== undefined || patch.techIds !== undefined || patch.techId !== undefined) {
      nextPatch = { ...nextPatch, ...this.normalizeTechAssignment(patch) };
    }
    s.workOrders[i] = {
      ...cur,
      ...nextPatch,
      labor: totals.labor,
      parts: totals.parts,
      tax: totals.tax,
      total: totals.total,
      version: (cur.version || 1) + 1,
      updatedAt: new Date().toISOString(),
    };
    ARS.Store.save(s);
    if (ARS.isDemoMode?.()
      && patch.status === 'Completed'
      && !['Completed', 'Invoiced'].includes(cur.status)) {
      this.deductInventoryForWO(s.workOrders[i]);
    }
    await this._persist('workOrders', s.workOrders[i]);
    this.refreshNotifications();
    return s.workOrders[i];
  },

  deductInventoryForWO(wo) {
    if (!wo?.lineItems?.length) return;
    const s = ARS.Store.load();
    wo.lineItems.forEach((line) => {
      if (!line.partId || !line.qty) return;
      const i = s.inventory.findIndex((p) => p.id === line.partId);
      if (i < 0) return;
      s.inventory[i].qty = Math.max(0, s.inventory[i].qty - Number(line.qty));
      s.inventory[i].status = ARS.inventoryStatus(s.inventory[i].qty, s.inventory[i].min);
      if (!s.inventoryTransactions) s.inventoryTransactions = [];
      s.inventoryTransactions.unshift({
        id: ARS.uid(),
        partId: line.partId,
        delta: -Number(line.qty),
        reason: `workOrder:${wo.id}`,
        at: new Date().toISOString(),
      });
    });
    ARS.Store.save(s);
  },

  async createInvoiceFromWO(woId) {
    const wo = this.getWorkOrder(woId);
    if (!wo) throw new Error('Work order not found');
    if (wo.invoiced) throw new Error('Already invoiced');
    if (!ARS.isDemoMode?.()) {
      const invoice = await ARS.FirestoreSync.createInvoiceFromWorkOrder(woId);
      const s = ARS.Store.load();
      s.invoices = [invoice, ...(s.invoices || []).filter((item) => item.id !== invoice.id)];
      const wi = s.workOrders.findIndex((w) => w.id === woId);
      if (wi >= 0) {
        s.workOrders[wi] = {
          ...s.workOrders[wi],
          invoiced: true,
          invoiceId: invoice.id,
          status: 'Invoiced',
          version: Number(s.workOrders[wi].version || 1) + 1,
          updatedAt: new Date().toISOString(),
        };
      }
      ARS.Store.save(s);
      this.refreshNotifications();
      return invoice;
    }
    const settings = ARS.Store.getSettings();
    const id = await this._nextId('INV', 'inv');
    const due = new Date();
    due.setDate(due.getDate() + (settings.paymentTermsDays || 14));
    const s = ARS.Store.load();
    const invoice = {
      id,
      date: ARS.fmtDate(new Date()),
      due: ARS.fmtDate(due),
      customerName: wo.customerName,
      customerId: wo.customerId,
      workOrderId: wo.id,
      total: wo.total,
      amountPaid: 0,
      status: 'Sent',
      version: 1,
      createdAt: new Date().toISOString(),
    };
    s.invoices.unshift(invoice);
    const wi = s.workOrders.findIndex((w) => w.id === woId);
    let updatedWo = null;
    if (wi >= 0) {
      s.workOrders[wi].invoiced = true;
      s.workOrders[wi].status = 'Invoiced';
      s.workOrders[wi].updatedAt = new Date().toISOString();
      updatedWo = s.workOrders[wi];
    }
    ARS.Store.save(s);
    this._audit({ action: 'invoice.create', entityId: id, entityType: 'invoice', workOrderId: woId });
    await this._persist('invoices', invoice);
    if (updatedWo) await this._persist('workOrders', updatedWo);
    this.refreshNotifications();
    return invoice;
  },

  /* ─── ESTIMATES ─── */
  listEstimates(filters = {}) {
    let items = ARS.Store.getCollection('estimates');
    if (filters.status) items = items.filter((e) => e.status === filters.status);
    if (filters.customerId) items = items.filter((e) => e.customerId === filters.customerId);
    if (filters.q) {
      const q = filters.q.toLowerCase();
      items = items.filter((e) =>
        e.id.toLowerCase().includes(q) ||
        (e.customerName || '').toLowerCase().includes(q)
      );
    }
    return items;
  },

  getEstimate(id) {
    return ARS.Store.getCollection('estimates').find((e) => e.id === id) || null;
  },

  async createEstimate(data) {
    const id = await this._nextId('EST', 'est');
    const settings = ARS.Store.getSettings();
    const totals = ARS.calcTotals(data.labor, data.parts, settings);
    const s = ARS.Store.load();
    const est = {
      id,
      date: ARS.fmtDate(new Date()),
      customerName: data.customerName,
      customerId: data.customerId || '',
      truckLabel: data.truckLabel,
      desc: data.desc,
      notes: data.notes || '',
      labor: totals.labor,
      parts: totals.parts,
      total: totals.total,
      status: 'Pending',
      version: 1,
      createdAt: new Date().toISOString(),
    };
    s.estimates.unshift(est);
    ARS.Store.save(s);
    await this._persist('estimates', est);
    this.refreshNotifications();
    return est;
  },

  async updateEstimate(id, patch) {
    const s = ARS.Store.load();
    const i = s.estimates.findIndex((e) => e.id === id);
    if (i < 0) throw new Error('Estimate not found');
    s.estimates[i] = {
      ...s.estimates[i],
      ...patch,
      version: (s.estimates[i].version || 1) + 1,
      updatedAt: new Date().toISOString(),
    };
    ARS.Store.save(s);
    await this._persist('estimates', s.estimates[i]);
    this.refreshNotifications();
    return s.estimates[i];
  },

  async convertEstimateToWO(estId) {
    const est = ARS.Store.getCollection('estimates').find((e) => e.id === estId);
    if (!est || est.status !== 'Approved') throw new Error('Estimate must be approved');
    const wo = await this.createWorkOrder({
      customerName: est.customerName,
      customerId: est.customerId,
      truckLabel: est.truckLabel,
      truckId: est.truckId,
      desc: est.desc,
      labor: est.labor,
      parts: est.parts,
      status: 'Open',
      estimateId: estId,
      media: (est.media || []).map((m) => ({
        ...m,
        id: ARS.uid().replace(/^id_/, ''),
        copiedFrom: `estimates/${estId}`,
        uploadedAt: new Date().toISOString(),
      })),
    });
    await this.updateEstimate(estId, { status: 'Converted', workOrderId: wo.id });
    return wo;
  },

  /* ─── INVOICES ─── */
  listInvoices(filters = {}) {
    let items = ARS.Store.getCollection('invoices');
    if (filters.status) items = items.filter((inv) => inv.status === filters.status);
    if (filters.q) {
      const q = filters.q.toLowerCase();
      items = items.filter((inv) =>
        inv.id.toLowerCase().includes(q) ||
        (inv.customerName || '').toLowerCase().includes(q)
      );
    }
    return items.map((inv) => ({
      ...inv,
      totalDisplay: ARS.fmtMoney(inv.total),
      balance: inv.total - (inv.amountPaid || 0),
    }));
  },

  getInvoice(id) {
    return this.listInvoices().find((inv) => inv.id === id) || null;
  },

  refreshOverdueInvoices() {
    const s = ARS.Store.load();
    const now = Date.now();
    let changed = false;
    s.invoices.forEach((inv, i) => {
      if (inv.status === 'Paid' || inv.status === 'Written Off') return;
      const due = new Date(inv.due);
      const balance = inv.total - (inv.amountPaid || 0);
      if (!isNaN(due) && due < now && balance > 0 && inv.status !== 'Overdue') {
        s.invoices[i].status = 'Overdue';
        changed = true;
      }
    });
    if (changed) ARS.Store.save(s);
  },

  async writeOffInvoice(id, reason) {
    if (!ARS.can('invoices.writeOff')) throw new Error('Permission denied');
    const s = ARS.Store.load();
    const i = s.invoices.findIndex((inv) => inv.id === id);
    if (i < 0) throw new Error('Invoice not found');
    s.invoices[i].status = 'Written Off';
    s.invoices[i].writeOffReason = reason;
    s.invoices[i].version = Number(s.invoices[i].version || 1) + 1;
    s.invoices[i].updatedAt = new Date().toISOString();
    ARS.Store.save(s);
    this._audit({ action: 'invoice.writeOff', entityId: id, entityType: 'invoice', reason });
    await this._persist('invoices', s.invoices[i]);
    this.refreshNotifications();
    return s.invoices[i];
  },

  async updateInvoice(id, patch) {
    const s = ARS.Store.load();
    const i = s.invoices.findIndex((inv) => inv.id === id);
    if (i < 0) throw new Error('Invoice not found');
    s.invoices[i] = {
      ...s.invoices[i],
      ...patch,
      version: (s.invoices[i].version || 1) + 1,
      updatedAt: new Date().toISOString(),
    };
    ARS.Store.save(s);
    await this._persist('invoices', s.invoices[i]);
    return s.invoices[i];
  },

  /* ─── PAYMENTS ─── */
  listPayments(filters = {}) {
    let items = ARS.Store.getCollection('payments');
    if (filters.q) {
      const q = filters.q.toLowerCase();
      items = items.filter((p) =>
        p.id.toLowerCase().includes(q) ||
        (p.customerName || '').toLowerCase().includes(q) ||
        (p.invoiceId || '').toLowerCase().includes(q)
      );
    }
    if (filters.status) items = items.filter((p) => p.status === filters.status);
    return items.map((p) => this.enrichPayment(p));
  },

  paymentNetAmount(p) {
    const amount = Number(p?.amount) || 0;
    const refunded = Number(p?.refundedAmount) || 0;
    return Math.max(0, Math.round((amount - refunded) * 100) / 100);
  },

  /** Shared payment KPIs — always net of refunds; matches Payments page tables */
  getPaymentKPIs() {
    const payments = this.listPayments();
    const now = new Date();
    const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const inMtd = (p) => {
      const d = new Date(p.createdAt || p.date);
      return !isNaN(d) && d >= mtdStart;
    };
    const mtd = payments.filter(inMtd);
    const net = (p) => this.paymentNetAmount(p);
    const isActiveCharge = (p) => net(p) > 0.01;
    const isFullyRefunded = (p) => {
      const refunded = Number(p.refundedAmount) || 0;
      return refunded > 0.01 && net(p) <= 0.01;
    };
    const isPartialRefund = (p) => (Number(p.refundedAmount) || 0) > 0.01 && net(p) > 0.01;

    const receivedMTD = mtd.reduce((s, p) => s + net(p), 0);
    const stripeMtd = mtd.filter((p) => /stripe/i.test(p.method || ''));
    const stripeReceivedMTD = stripeMtd.reduce((s, p) => s + net(p), 0);
    const successful = mtd.filter(isActiveCharge);
    const fullyRefunded = mtd.filter(isFullyRefunded);
    const partialRefunded = mtd.filter(isPartialRefund);

    return {
      receivedMTD,
      stripeReceivedMTD,
      stripeChargeCount: stripeMtd.filter(isActiveCharge).length,
      successfulChargeCount: successful.length,
      fullyRefundedCount: fullyRefunded.length,
      partialRefundedCount: partialRefunded.length,
      mtdPaymentCount: mtd.length,
      avgPayment: successful.length ? receivedMTD / successful.length : 0,
      refundedMTD: mtd.reduce((s, p) => s + (Number(p.refundedAmount) || 0), 0),
    };
  },

  /** Invoice KPIs aligned with invoice list balances / amountPaid */
  getInvoiceKPIs() {
    this.refreshOverdueInvoices();
    const invoices = this.listInvoices();
    const now = new Date();
    const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const inMtd = (inv) => {
      const d = new Date(inv.createdAt || inv.date);
      return !isNaN(d) && d >= mtdStart;
    };
    const mtdInvoices = invoices.filter(inMtd);
    const invoicedMTD = mtdInvoices.reduce((s, inv) => s + (Number(inv.total) || 0), 0);
    // Cash collected on invoices (all-time amountPaid — reflects refunds)
    const collectedTotal = invoices
      .filter((inv) => inv.status !== 'Written Off')
      .reduce((s, inv) => s + (Number(inv.amountPaid) || 0), 0);
    const collectedMTD = mtdInvoices
      .filter((inv) => inv.status !== 'Written Off')
      .reduce((s, inv) => s + (Number(inv.amountPaid) || 0), 0);
    const paidInFull = invoices
      .filter((inv) => inv.status === 'Paid')
      .reduce((s, inv) => s + (Number(inv.amountPaid) || inv.total || 0), 0);
    const awaiting = invoices
      .filter((inv) => ['Sent', 'Partially Paid'].includes(inv.status))
      .reduce((s, inv) => s + (inv.balance || 0), 0);
    const overdueTotal = invoices
      .filter((inv) => inv.status === 'Overdue')
      .reduce((s, inv) => s + (inv.balance || 0), 0);
    const overdueCount = invoices.filter((inv) => inv.status === 'Overdue').length;

    return {
      invoicedMTD,
      collectedTotal,
      collectedMTD,
      paidInFull,
      awaiting,
      overdueTotal,
      overdueCount,
      invoiceCount: invoices.length,
    };
  },

  enrichPayment(p) {
    const refundedAmount = Number(p.refundedAmount) || 0;
    const amount = Number(p.amount) || 0;
    const refundable = Math.max(0, Math.round((amount - refundedAmount) * 100) / 100);
    let status = p.status || 'Completed';
    if (refundedAmount > 0.01 && refundable <= 0.01) status = 'Refunded';
    else if (refundedAmount > 0.01 && status === 'Completed') status = 'Partially Refunded';
    const statusLabel = status === 'Refunded' ? 'Refund Complete' : status;
    return {
      ...p,
      status,
      statusLabel,
      refundedAmount,
      refundable,
      amountDisplay: ARS.fmtMoney(amount),
      refundedDisplay: ARS.fmtMoney(refundedAmount),
      netDisplay: ARS.fmtMoney(amount - refundedAmount),
      isRefunded: status === 'Refunded' || status === 'Partially Refunded' || refundedAmount > 0.01,
      canRefund: refundable > 0.01 && ['Completed', 'Partially Refunded'].includes(status),
    };
  },

  /** Optimistic local update after a successful Stripe/demo refund */
  applyLocalRefundResult(paymentId, result = {}) {
    const s = ARS.Store.load();
    const i = s.payments.findIndex((p) => p.id === paymentId);
    if (i < 0) return null;
    const pay = s.payments[i];
    const delta = Number(result.amount) || 0;
    const nextRefunded = result.refundedAmount != null
      ? Number(result.refundedAmount)
      : Math.round(((Number(pay.refundedAmount) || 0) + delta) * 100) / 100;
    const remaining = Math.max(0, Math.round(((Number(pay.amount) || 0) - nextRefunded) * 100) / 100);
    const status = result.status
      || (remaining <= 0.01 ? 'Refunded' : 'Partially Refunded');
    s.payments[i] = {
      ...pay,
      refundedAmount: nextRefunded,
      refundableAmount: remaining,
      status,
      lastRefundAt: new Date().toISOString(),
      lastRefundId: result.refundId || pay.lastRefundId || null,
      stripeRefundIds: result.refundId
        ? [...new Set([...(pay.stripeRefundIds || []), result.refundId])]
        : (pay.stripeRefundIds || []),
    };

    if (pay.invoiceId && delta > 0) {
      const invIdx = s.invoices.findIndex((inv) => inv.id === pay.invoiceId);
      if (invIdx >= 0 && s.invoices[invIdx].status !== 'Written Off') {
        const inv = s.invoices[invIdx];
        const newPaid = Math.max(0, Math.round(((inv.amountPaid || 0) - delta) * 100) / 100);
        const bal = Math.round(((inv.total || 0) - newPaid) * 100) / 100;
        let invStatus = inv.status;
        if (newPaid <= 0.01) {
          const due = inv.due ? new Date(inv.due) : null;
          invStatus = (due && !isNaN(due) && due < new Date()) ? 'Overdue' : 'Sent';
        } else if (bal > 0.01) {
          invStatus = 'Partially Paid';
        } else {
          invStatus = 'Paid';
        }
        s.invoices[invIdx] = { ...inv, amountPaid: newPaid, status: invStatus };
      }
    }

    ARS.Store.save(s);
    return this.enrichPayment(s.payments[i]);
  },

  getPayment(id) {
    const p = ARS.Store.getCollection('payments').find((x) => x.id === id);
    return p ? this.enrichPayment(p) : null;
  },

  paymentRefundable(payment) {
    const p = typeof payment === 'string' ? this.getPayment(payment) : this.enrichPayment(payment);
    return p?.refundable || 0;
  },

  async recordPayment() {
    throw new Error('Manual payments are disabled. Use Stripe Checkout to collect payment.');
  },

  async recordDemoPayment(invoiceId, amount) {
    if (!ARS.isDemoMode?.()) throw new Error('Demo payments are only available in demo mode.');
    const payAmount = Number(amount);
    if (!payAmount || payAmount <= 0) throw new Error('Invalid payment amount.');

    const s = ARS.Store.load();
    const invIdx = s.invoices.findIndex((inv) => inv.id === invoiceId);
    if (invIdx < 0) throw new Error('Invoice not found');

    const inv = s.invoices[invIdx];
    if (['Paid', 'Written Off'].includes(inv.status)) throw new Error('Invoice is already closed.');

    const balance = inv.total - (inv.amountPaid || 0);
    if (payAmount > balance + 0.01) throw new Error(`Amount cannot exceed balance (${ARS.fmtMoney(balance)}).`);

    const { num, year } = ARS.Store.bumpCounter('pay');
    const payId = ARS.nextId('PAY', year, num);
    const now = new Date();

    s.payments.unshift({
      id: payId,
      date: ARS.fmtDate(now),
      customerName: inv.customerName || '',
      invoiceId,
      amount: payAmount,
      method: 'Demo Stripe',
      status: 'Completed',
      refundedAmount: 0,
      stripeSessionId: `demo_cs_${ARS.uid()}`,
      stripePaymentIntentId: `demo_pi_${ARS.uid()}`,
      createdAt: now.toISOString(),
      createdBy: ARS.Demo?.EMAIL || 'demo',
    });

    const newPaid = (inv.amountPaid || 0) + payAmount;
    const newBalance = inv.total - newPaid;
    s.invoices[invIdx] = {
      ...inv,
      amountPaid: newPaid,
      status: newBalance <= 0.01 ? 'Paid' : 'Partially Paid',
      version: (inv.version || 1) + 1,
    };

    ARS.Store.save(s);
    this._audit({ action: 'payment.demo', entityId: payId, entityType: 'payment', invoiceId, amount: payAmount });
    this.refreshNotifications();
    return { paymentId: payId, invoice: s.invoices[invIdx] };
  },

  async recordDemoRefund(paymentId, amount, reason) {
    if (!ARS.isDemoMode?.()) throw new Error('Demo refunds are only available in demo mode.');
    if (!ARS.can('payments.refund')) throw new Error('Permission denied');

    const refundAmount = Number(amount);
    if (!refundAmount || refundAmount <= 0) throw new Error('Invalid refund amount');

    const s = ARS.Store.load();
    const payIdx = s.payments.findIndex((p) => p.id === paymentId);
    if (payIdx < 0) throw new Error('Payment not found');

    const pay = s.payments[payIdx];
    const already = Number(pay.refundedAmount) || 0;
    const refundable = Math.round(((Number(pay.amount) || 0) - already) * 100) / 100;
    if (refundAmount > refundable + 0.01) {
      throw new Error(`Amount cannot exceed refundable balance (${ARS.fmtMoney(refundable)})`);
    }

    const nextRefunded = Math.round((already + refundAmount) * 100) / 100;
    const remaining = Math.round(((Number(pay.amount) || 0) - nextRefunded) * 100) / 100;
    const refundId = `demo_re_${ARS.uid()}`;

    s.payments[payIdx] = {
      ...pay,
      refundedAmount: nextRefunded,
      refundableAmount: remaining,
      status: remaining <= 0.01 ? 'Refunded' : 'Partially Refunded',
      stripeRefundIds: [...(pay.stripeRefundIds || []), refundId],
      lastRefundAt: new Date().toISOString(),
      lastRefundReason: reason || 'demo_refund',
      lastRefundId: refundId,
    };

    const invIdx = s.invoices.findIndex((inv) => inv.id === pay.invoiceId);
    if (invIdx >= 0 && s.invoices[invIdx].status !== 'Written Off') {
      const inv = s.invoices[invIdx];
      const newPaid = Math.max(0, Math.round(((inv.amountPaid || 0) - refundAmount) * 100) / 100);
      const bal = Math.round(((inv.total || 0) - newPaid) * 100) / 100;
      let status = inv.status;
      if (newPaid <= 0.01) {
        const due = inv.due ? new Date(inv.due) : null;
        status = (due && !isNaN(due) && due < new Date()) ? 'Overdue' : 'Sent';
      } else if (bal > 0.01) {
        status = 'Partially Paid';
      } else {
        status = 'Paid';
      }
      s.invoices[invIdx] = { ...inv, amountPaid: newPaid, status, version: (inv.version || 1) + 1 };
    }

    ARS.Store.save(s);
    this._audit({
      action: 'payment.refund',
      entityId: paymentId,
      entityType: 'payment',
      invoiceId: pay.invoiceId,
      amount: refundAmount,
      reason,
    });
    this.refreshNotifications();
    return {
      ok: true,
      refundId,
      paymentId,
      amount: refundAmount,
      status: s.payments[payIdx].status,
    };
  },

  /* ─── INVENTORY ─── */
  listInventory(filters = {}) {
    let items = ARS.Store.getCollection('inventory');
    if (filters.status) items = items.filter((p) => p.status === filters.status);
    if (filters.cat) items = items.filter((p) => p.cat === filters.cat);
    if (filters.q) {
      const q = filters.q.toLowerCase();
      items = items.filter((p) =>
        String(p.partNo || '').toLowerCase().includes(q) ||
        String(p.desc || '').toLowerCase().includes(q)
      );
    }
    return items.map((p) => ({
      ...p,
      status: ARS.inventoryStatus(p.qty, p.min),
    }));
  },

  async createPart(data) {
    const s = ARS.Store.load();
    const id = await this._nextId('P', 'part');
    const part = {
      id,
      partNo: data.partNo,
      desc: data.desc,
      cat: data.cat || 'Other',
      qty: Number(data.qty) || 0,
      min: Number(data.min) || 1,
      cost: Number(data.cost) || 0,
      price: Number(data.price) || 0,
      supplier: data.supplier || '',
      status: ARS.inventoryStatus(Number(data.qty) || 0, Number(data.min) || 1),
      version: 1,
      createdAt: new Date().toISOString(),
    };
    s.inventory.push(part);
    ARS.Store.save(s);
    await this._persist('inventory', part);
    this.refreshNotifications();
    return part;
  },

  async updatePart(id, patch) {
    const s = ARS.Store.load();
    const i = s.inventory.findIndex((p) => p.id === id);
    if (i < 0) throw new Error('Part not found');
    const next = {
      ...s.inventory[i],
      ...patch,
      version: (s.inventory[i].version || 1) + 1,
      updatedAt: new Date().toISOString(),
    };
    if (next.qty != null || next.min != null) {
      next.status = ARS.inventoryStatus(Number(next.qty) || 0, Number(next.min) || 1);
    }
    s.inventory[i] = next;
    ARS.Store.save(s);
    await this._persist('inventory', s.inventory[i]);
    return s.inventory[i];
  },

  async adjustStock(partId, delta, reason) {
    if (!ARS.isDemoMode?.()) {
      const result = await ARS.FirestoreSync.adjustInventory(partId, delta, reason);
      const s = ARS.Store.load();
      const index = s.inventory.findIndex((part) => part.id === partId);
      if (index >= 0) s.inventory[index] = result.part;
      else s.inventory.push(result.part);
      ARS.Store.save(s);
      this.refreshNotifications();
      return result.part;
    }
    const s = ARS.Store.load();
    const i = s.inventory.findIndex((p) => p.id === partId);
    if (i < 0) throw new Error('Part not found');
    s.inventory[i].qty = Math.max(0, s.inventory[i].qty + Number(delta));
    s.inventory[i].status = ARS.inventoryStatus(s.inventory[i].qty, s.inventory[i].min);
    s.inventory[i].updatedAt = new Date().toISOString();
    if (!s.inventoryTransactions) s.inventoryTransactions = [];
    const tx = {
      id: ARS.uid(),
      partId,
      delta: Number(delta),
      reason: reason || 'adjustment',
      at: new Date().toISOString(),
    };
    s.inventoryTransactions.unshift(tx);
    ARS.Store.save(s);
    await this._persist('inventory', s.inventory[i]);
    await this._persist('inventoryTransactions', tx);
    this.refreshNotifications();
    return s.inventory[i];
  },

  getLowStock() {
    return this.listInventory().filter((p) => p.status === 'Low' || p.status === 'Out of Stock');
  },

  /* ─── NOTIFICATIONS ─── */
  _isDerivedNotificationId(id) {
    return /^(overdue_|stock_|wo_|est_)/.test(String(id || ''));
  },

  listNotifications() {
    return ARS.Store.getCollection('notifications')
      .slice()
      .sort((a, b) => {
        if (!!a.read !== !!b.read) return a.read ? 1 : -1;
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
  },

  refreshNotifications() {
    const s = ARS.Store.load();
    const uid = ARS.Auth?.getUser?.()?.uid || 'local';
    const reads = { ...(s.notificationReads || {}) };
    (s.notifications || []).forEach((n) => {
      if (n?.id && n.read) reads[n.id] = n.readAt || reads[n.id] || true;
    });
    const notes = [];
    const now = new Date().toISOString();

    (s.invoices || []).filter((inv) => inv.status === 'Overdue').forEach((inv) => {
      const id = `overdue_${inv.id}_${uid}`;
      notes.push({
        id,
        userId: uid,
        type: 'warning',
        message: `Invoice ${inv.id} overdue — ${inv.customerName}`,
        entityType: 'invoice',
        entityId: inv.id,
        href: `/app/invoice-detail.html?id=${inv.id}`,
        read: !!reads[id],
        readAt: reads[id] || null,
        createdAt: inv.due || inv.updatedAt || now,
        source: 'derived',
      });
    });

    (s.inventory || []).filter((p) => ARS.inventoryStatus(p.qty, p.min) !== 'In Stock').forEach((p) => {
      const status = ARS.inventoryStatus(p.qty, p.min);
      const statusParam = status === 'Out of Stock' ? 'Out%20of%20Stock' : 'attention';
      const id = `stock_${p.id}_${uid}`;
      notes.push({
        id,
        userId: uid,
        type: 'warning',
        message: `${p.desc} is ${status.toLowerCase()} (${p.qty} on hand)`,
        entityType: 'inventory',
        entityId: p.id,
        href: `/app/inventory.html?status=${statusParam}&highlight=${encodeURIComponent(p.id)}`,
        read: !!reads[id],
        readAt: reads[id] || null,
        createdAt: p.updatedAt || now,
        source: 'derived',
      });
    });

    (s.workOrders || []).filter((w) => ['Open', 'In Progress', 'Waiting Parts'].includes(w.status)).forEach((w) => {
      const id = `wo_${w.id}_${uid}`;
      notes.push({
        id,
        userId: uid,
        type: 'info',
        message: `Work order ${w.id} — ${w.status} (${w.customerName})`,
        entityType: 'workOrder',
        entityId: w.id,
        href: `/app/work-order-detail.html?id=${w.id}`,
        read: !!reads[id],
        readAt: reads[id] || null,
        createdAt: w.updatedAt || w.createdAt || now,
        source: 'derived',
      });
    });

    (s.estimates || []).filter((e) => e.status === 'Pending' || e.status === 'Sent').forEach((e) => {
      const id = `est_${e.id}_${uid}`;
      notes.push({
        id,
        userId: uid,
        type: 'info',
        message: `Estimate ${e.id} awaiting response — ${e.customerName}`,
        entityType: 'estimate',
        entityId: e.id,
        href: `/app/estimate-detail.html?id=${e.id}`,
        read: !!reads[id],
        readAt: reads[id] || null,
        createdAt: e.updatedAt || e.createdAt || now,
        source: 'derived',
      });
    });

    const remote = (s.notifications || []).filter((n) => n?.id && !this._isDerivedNotificationId(n.id));
    remote.forEach((n) => {
      if (reads[n.id]) {
        n.read = true;
        n.readAt = n.readAt || reads[n.id];
      }
    });

    const next = [...notes, ...remote].sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );

    const prevSig = JSON.stringify((s.notifications || []).map((n) => [n.id, !!n.read, n.message]));
    const nextSig = JSON.stringify(next.map((n) => [n.id, !!n.read, n.message]));
    if (prevSig === nextSig && JSON.stringify(s.notificationReads || {}) === JSON.stringify(reads)) {
      return;
    }

    s.notifications = next;
    s.notificationReads = reads;
    ARS.Store.save(s, { silent: true });
    document.dispatchEvent(new CustomEvent('ars:notifications-changed'));
  },

  async markNotificationRead(id) {
    if (!id) return;
    const s = ARS.Store.load();
    const readAt = new Date().toISOString();
    s.notificationReads = { ...(s.notificationReads || {}), [id]: readAt };
    const n = (s.notifications || []).find((x) => x.id === id);
    if (n) {
      n.read = true;
      n.readAt = readAt;
    }
    ARS.Store.save(s, { silent: true });
    document.dispatchEvent(new CustomEvent('ars:notifications-changed'));

    if (ARS.FirestoreSync?.isActive?.() && !this._isDerivedNotificationId(id)) {
      await ARS.FirestoreSync.markNotificationRead(id);
    }
  },

  async markAllNotificationsRead() {
    const notes = this.listNotifications().filter((n) => !n.read);
    for (const n of notes) {
      await this.markNotificationRead(n.id);
    }
  },

  /* ─── SETTINGS ─── */
  async saveShopSettings(patch) {
    if (!ARS.isDemoMode?.()) {
      if (!ARS.FirestoreSync?.isActive?.()) {
        throw new Error('Cloud settings service is unavailable.');
      }
      const saved = await ARS.FirestoreSync.saveShopSettings(patch);
      ARS.Store.setSettings(saved);
      return ARS.Store.getSettings();
    }
    ARS.Store.setSettings(patch);
    const s = ARS.Store.getSettings();
    this._audit({ action: 'settings.update', entityType: 'settings' });
    return s;
  },

  /* ─── CONTACT ─── */
  submitContact(data) {
    const s = ARS.Store.load();
    const sub = { id: ARS.uid(), ...data, createdAt: new Date().toISOString() };
    s.contactSubmissions.unshift(sub);
    ARS.Store.save(s);
    return sub;
  },

  /* ─── EMPLOYEES ─── */
  defaultOnboarding() {
    return DEFAULT_ONBOARDING_STEPS.map((s) => ({ ...s, done: false }));
  },

  enrichEmployee(e) {
    const onboarding = (e.onboarding && e.onboarding.length) ? e.onboarding : this.defaultOnboarding();
    const defaultSchedule = {
      mon: '7:00 AM – 3:30 PM', tue: '7:00 AM – 3:30 PM', wed: '7:00 AM – 3:30 PM',
      thu: '7:00 AM – 3:30 PM', fri: '7:00 AM – 3:30 PM', sat: 'Off', sun: 'Off', notes: '',
    };
    const total = onboarding.length;
    const done = onboarding.filter((o) => o.done).length;
    return {
      ...e,
      onboarding,
      onboardingDone: done,
      onboardingTotal: total,
      onboardingPct: total ? Math.round((done / total) * 100) : 0,
      status: e.status || 'Active',
      employmentType: e.employmentType || 'Full-time',
      emergencyContact: e.emergencyContact || { name: '', phone: '' },
      certifications: e.certifications || [],
      media: e.media || [],
      schedule: e.schedule || defaultSchedule,
    };
  },

  listEmployees(filters = {}) {
    let items = ARS.Store.getCollection('employees').map((e) => this.enrichEmployee(e));
    if (filters.status) items = items.filter((e) => e.status === filters.status);
    if (filters.role) items = items.filter((e) => e.role === filters.role);
    if (filters.onboarding === 'incomplete') items = items.filter((e) => e.onboardingPct < 100);
    if (filters.q) {
      const q = filters.q.toLowerCase();
      items = items.filter((e) =>
        (e.name || '').toLowerCase().includes(q) ||
        (e.email || '').toLowerCase().includes(q) ||
        (e.jobTitle || '').toLowerCase().includes(q) ||
        (e.department || '').toLowerCase().includes(q) ||
        (e.phone || '').includes(q)
      );
    }
    return items;
  },

  getEmployee(uid) {
    const e = ARS.Store.getCollection('employees').find((x) => x.uid === uid || x.id === uid);
    return e ? this.enrichEmployee(e) : null;
  },

  async createEmployee(payload) {
    if (ARS.isDemoMode?.()) {
      const res = this._createDemoEmployee(payload);
      this.refreshTechsFromEmployees();
      return res;
    }
    const res = await ARS.FirestoreSync.createEmployee(payload);
    // Optimistic local insert so tech dropdowns update immediately
    const s = ARS.Store.load();
    const now = new Date().toISOString();
    const employee = {
      uid: res.uid,
      id: res.uid,
      name: payload.name,
      email: payload.email,
      phone: payload.phone || '',
      role: payload.role || 'technician',
      jobTitle: payload.jobTitle || '',
      hireDate: payload.hireDate || '',
      department: payload.department || '',
      status: 'Active',
      active: true,
      archived: false,
      employmentType: 'Full-time',
      emergencyContact: { name: '', phone: '' },
      address: '',
      certifications: [],
      media: [],
      schedule: {
        mon: '7:00 AM – 3:30 PM', tue: '7:00 AM – 3:30 PM', wed: '7:00 AM – 3:30 PM',
        thu: '7:00 AM – 3:30 PM', fri: '7:00 AM – 3:30 PM', sat: 'Off', sun: 'Off', notes: '',
      },
      createdAt: now,
      updatedAt: now,
    };
    s.employees = [...(s.employees || []).filter((e) => e.uid !== res.uid && e.id !== res.uid), employee];
    ARS.Store.save(s);
    this._audit({ action: 'employee.create', entityId: res.uid, entityType: 'employee' });
    await this.refreshTechs();
    document.dispatchEvent(new CustomEvent('ars:data-changed'));
    return res;
  },

  async updateEmployee(uid, patch) {
    if (ARS.isDemoMode?.()) {
      const res = this._updateDemoEmployee(uid, patch);
      this.refreshTechsFromEmployees();
      return res;
    }
    const res = await ARS.FirestoreSync.updateEmployee(uid, patch);
    this._audit({ action: 'employee.update', entityId: uid, entityType: 'employee' });
    await this.refreshTechs();
    return this.getEmployee(uid) || res;
  },

  async sendEmployeePasswordReset(uid) {
    const e = this.getEmployee(uid);
    if (ARS.isDemoMode?.()) {
      return { ok: true, email: e?.email || '', passwordResetSent: true, demo: true };
    }
    const res = await ARS.FirestoreSync.sendEmployeePasswordReset(uid, e?.email);
    this._audit({ action: 'employee.password_reset', entityId: uid, entityType: 'employee' });
    return res;
  },

  async archiveEmployee(uid) {
    if (ARS.isDemoMode?.()) {
      const res = this._updateDemoEmployee(uid, {
        status: 'Archived', active: false, archived: true,
        archivedAt: new Date().toISOString(),
      });
      this.refreshTechsFromEmployees();
      return res;
    }
    const res = await ARS.FirestoreSync.archiveEmployee(uid);
    this._audit({ action: 'employee.archive', entityId: uid, entityType: 'employee' });
    await this.refreshTechs();
    return res;
  },

  async unarchiveEmployee(uid) {
    if (ARS.isDemoMode?.()) {
      const res = this._updateDemoEmployee(uid, {
        status: 'Active', active: true, archived: false,
        archivedAt: null, archivedBy: null,
      });
      this.refreshTechsFromEmployees();
      return res;
    }
    const res = await ARS.FirestoreSync.unarchiveEmployee(uid);
    this._audit({ action: 'employee.unarchive', entityId: uid, entityType: 'employee' });
    await this.refreshTechs();
    return res;
  },

  async deleteEmployee(uid) {
    if (ARS.isDemoMode?.()) {
      const s = ARS.Store.load();
      s.employees = (s.employees || []).filter((e) => e.uid !== uid && e.id !== uid);
      ARS.Store.save(s);
      this._audit({ action: 'employee.delete', entityId: uid, entityType: 'employee' });
      return { ok: true, uid, deleted: true };
    }
    const res = await ARS.FirestoreSync.deleteEmployee(uid);
    const s = ARS.Store.load();
    s.employees = (s.employees || []).filter((e) => e.uid !== uid && e.id !== uid);
    ARS.Store.save(s);
    this._audit({ action: 'employee.delete', entityId: uid, entityType: 'employee' });
    return res;
  },

  _createDemoEmployee(payload) {
    const s = ARS.Store.load();
    const uid = `demo_emp_${ARS.uid().replace(/^id_/, '')}`;
    const now = new Date().toISOString();
    const employee = {
      uid,
      id: uid,
      name: payload.name,
      email: payload.email,
      phone: payload.phone || '',
      role: payload.role || 'technician',
      jobTitle: payload.jobTitle || '',
      hireDate: payload.hireDate || '',
      department: payload.department || '',
      status: 'Active',
      employmentType: 'Full-time',
      emergencyContact: { name: '', phone: '' },
      address: '',
      certifications: [],
      schedule: {
        mon: '7:00 AM – 3:30 PM', tue: '7:00 AM – 3:30 PM', wed: '7:00 AM – 3:30 PM',
        thu: '7:00 AM – 3:30 PM', fri: '7:00 AM – 3:30 PM', sat: 'Off', sun: 'Off', notes: '',
      },
      onboarding: [{ id: 'account', label: 'Platform account created', done: true, doneAt: now }, ...this.defaultOnboarding().slice(1)],
      media: [],
      active: true,
      archived: false,
      createdAt: now,
      updatedAt: now,
      createdBy: ARS.Auth?.getUser?.()?.uid || 'demo',
    };
    s.employees = [...(s.employees || []), employee];
    ARS.Store.save(s);
    this._audit({ action: 'employee.create', entityId: uid, entityType: 'employee' });
    return { ok: true, uid, email: employee.email, role: employee.role, passwordResetSent: true };
  },

  _updateDemoEmployee(uid, patch) {
    const s = ARS.Store.load();
    const i = (s.employees || []).findIndex((e) => e.uid === uid || e.id === uid);
    if (i < 0) throw new Error('Employee not found');
    const next = { ...s.employees[i], ...patch, updatedAt: new Date().toISOString() };
    if (next.status === 'Terminated' || next.status === 'Archived') next.active = false;
    else if (patch.status) next.active = true;
    s.employees[i] = next;
    ARS.Store.save(s);
    this._audit({ action: 'employee.update', entityId: uid, entityType: 'employee' });
    return this.enrichEmployee(next);
  },

  /** Merge local + cloud audit log for CSV export, normalized to shared columns */
  async fetchAuditLogForExport() {
    const empByUid = {};
    this.listEmployees().forEach((e) => { empByUid[e.uid] = e.email; });

    const normalize = (a) => ({
      at: a.at || '',
      action: a.action || '',
      entityType: a.entityType || (a.action || '').split('.')[0] || '',
      entityId: a.entityId || '',
      userId: a.userId || '',
      by: a.by || empByUid[a.userId] || a.userId || 'system',
      notes: a.reason || a.notes || '',
    });

    const local = ARS.Store.getCollection('auditLog').map(normalize);
    if (ARS.isDemoMode?.() || !ARS.FirestoreSync?.isActive?.()) return local;

    try {
      const cloud = (await ARS.FirestoreSync.listAuditLog()).map(normalize);
      const seen = new Set();
      const merged = [];
      [...cloud, ...local].forEach((row) => {
        const key = `${row.at}_${row.action}_${row.entityId}_${row.userId}`;
        if (seen.has(key)) return;
        seen.add(key);
        merged.push(row);
      });
      return merged.sort((a, b) => new Date(b.at) - new Date(a.at));
    } catch (e) {
      console.warn('listAuditLog failed, using local audit log only:', e.message);
      return local;
    }
  },

  /* ─── DASHBOARD & REPORTS ─── */
  getDashboardKPIs() {
    const wos = ARS.Store.getCollection('workOrders');
    const invoices = this.listInvoices();
    const inventory = this.listInventory();
    const payKpis = this.getPaymentKPIs();
    const invKpis = this.getInvoiceKPIs();
    const now = new Date();
    const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const openStatuses = ['Open', 'In Progress', 'Waiting Parts'];
    const openWOs = wos.filter((w) => openStatuses.includes(w.status));

    // Completed MTD = currently Completed or Invoiced, dated by update/completion when available
    const completedMTD = wos.filter((w) => {
      if (!['Completed', 'Invoiced'].includes(w.status)) return false;
      const d = new Date(w.completedAt || w.updatedAt || w.createdAt || w.date);
      return !isNaN(d) && d >= mtdStart;
    }).length;

    const invoicesSentMTD = invoices.filter((inv) => {
      const d = new Date(inv.createdAt || inv.date);
      return !isNaN(d) && d >= mtdStart;
    }).length;

    return {
      openWOs: openWOs.length,
      openByStatus: {
        Open: wos.filter((w) => w.status === 'Open').length,
        'In Progress': wos.filter((w) => w.status === 'In Progress').length,
        'Waiting Parts': wos.filter((w) => w.status === 'Waiting Parts').length,
      },
      revenueMTD: payKpis.receivedMTD,
      outstanding: invKpis.awaiting + invKpis.overdueTotal,
      overdueCount: invKpis.overdueCount,
      lowStockCount: inventory.filter((p) => p.status !== 'In Stock').length,
      outOfStockCount: inventory.filter((p) => p.status === 'Out of Stock').length,
      completedMTD,
      invoicesSentMTD,
      paymentsMTD: payKpis.receivedMTD,
      refundedMTD: payKpis.refundedMTD,
      successfulChargeCount: payKpis.successfulChargeCount,
    };
  },

  getAlerts() {
    const alerts = [];
    const invoices = ARS.Store.getCollection('invoices').filter((inv) => inv.status === 'Overdue');
    if (invoices.length) {
      alerts.push({
        type: 'red',
        icon: 'fa-exclamation-circle',
        title: `${invoices.length} Overdue Invoice${invoices.length > 1 ? 's' : ''}`,
        desc: invoices.map((i) => `${i.id} · ${i.customerName} (${ARS.fmtMoney(i.total - (i.amountPaid || 0))})`).join(' & '),
        href: '/app/invoices.html?status=Overdue',
      });
    }
    const oos = this.listInventory().filter((p) => p.status === 'Out of Stock');
    oos.forEach((p) => {
      alerts.push({
        type: 'red',
        icon: 'fa-boxes',
        title: `${p.desc} Out of Stock`,
        desc: `${p.id} · ${p.partNo} — reorder immediately`,
        href: `/app/inventory.html?status=Out%20of%20Stock&highlight=${encodeURIComponent(p.id)}`,
      });
    });
    const low = this.listInventory().filter((p) => p.status === 'Low');
    if (low.length) {
      alerts.push({
        type: 'amber',
        icon: 'fa-tools',
        title: `${low.length} Parts at Low Inventory`,
        desc: low.map((p) => p.desc).slice(0, 3).join(', ') + (low.length > 3 ? '…' : ''),
        href: '/app/inventory.html?status=attention',
      });
    }
    const pmDue = this.trucksPMDue(30);
    if (pmDue.length) {
      alerts.push({
        type: 'amber',
        icon: 'fa-truck',
        title: `${pmDue.length} Truck${pmDue.length > 1 ? 's' : ''} PM Due`,
        desc: pmDue.map((t) => `Unit ${t.unit} · ${t.make} ${t.model}`).join(' & '),
        href: '/app/trucks.html?status=PM%20Due',
      });
    }
    const pendingEst = ARS.Store.getCollection('estimates').filter((e) => ['Pending', 'Sent'].includes(e.status));
    if (pendingEst.length) {
      alerts.push({
        type: 'blue',
        icon: 'fa-file-alt',
        title: `${pendingEst.length} Estimates Awaiting Response`,
        desc: pendingEst.map((e) => `${e.id} · ${e.customerName}`).join(' & '),
        href: '/app/estimates.html?status=awaiting',
      });
    }
    return alerts;
  },

  getRevenueByMonth(months = 6) {
    const payments = ARS.Store.getCollection('payments');
    const result = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString('en-US', { month: 'short' });
      const total = payments
        .filter((p) => {
          const pd = new Date(p.createdAt || p.date);
          return pd.getMonth() === d.getMonth() && pd.getFullYear() === d.getFullYear();
        })
        .reduce((s, p) => s + this.paymentNetAmount(p), 0);
      result.push({ label, total });
    }
    return result;
  },

  getTechPerformance(filters = {}) {
    const { start, end } = filters;
    let wos = ARS.Store.getCollection('workOrders');
    if (start && end) {
      wos = wos.filter((w) => this._inDateRange(w.createdAt || w.date, start, end));
    }
    const byTech = new Map();
    wos.forEach((w) => {
      const assigned = this.getWoTechs(w);
      if (!assigned.length) return;
      const share = assigned.length;
      assigned.forEach((t) => {
        const key = t.name;
        if (!byTech.has(key)) byTech.set(key, { tech: key, jobs: 0, completed: 0, revenue: 0 });
        const row = byTech.get(key);
        row.jobs += 1;
        if (['Completed', 'Invoiced'].includes(w.status)) {
          row.completed += 1;
          row.revenue += (w.total || 0) / share;
        }
      });
    });
    return [...byTech.values()].sort((a, b) => b.revenue - a.revenue);
  },

  _inDateRange(d, start, end) {
    const dt = new Date(d);
    if (isNaN(dt)) return false;
    return dt >= start && dt <= end;
  },

  _startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  },

  _endOfDay(d) {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  },

  getReportRangeDates(range = 'quarter', customStart = null, customEnd = null) {
    const now = new Date();
    const endNow = this._endOfDay(now);

    if (range === 'custom' && customStart && customEnd) {
      const start = this._startOfDay(customStart);
      const end = this._endOfDay(customEnd);
      const label = `${ARS.fmtDate(start)} – ${ARS.fmtDate(end)}`;
      return { start, end, label };
    }

    if (range === '7') {
      return { start: new Date(now.getTime() - 7 * 86400000), end: endNow, label: 'Last 7 Days' };
    }
    if (range === '30') {
      return { start: new Date(now.getTime() - 30 * 86400000), end: endNow, label: 'Last 30 Days' };
    }
    if (range === '90') {
      return { start: new Date(now.getTime() - 90 * 86400000), end: endNow, label: 'Last 90 Days' };
    }
    if (range === 'mtd') {
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: endNow,
        label: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) + ' (MTD)',
      };
    }
    if (range === 'last_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = this._endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
      return {
        start,
        end,
        label: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      };
    }
    if (range === 'last_quarter') {
      const q = Math.floor(now.getMonth() / 3);
      const prevQ = q === 0 ? 3 : q - 1;
      const year = q === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const start = new Date(year, prevQ * 3, 1);
      const end = this._endOfDay(new Date(year, prevQ * 3 + 3, 0));
      return { start, end, label: `Q${prevQ + 1} ${year}` };
    }
    if (range === 'ytd') {
      return {
        start: new Date(now.getFullYear(), 0, 1),
        end: endNow,
        label: `Year to Date ${now.getFullYear()}`,
      };
    }
    if (range === 'last_year') {
      const y = now.getFullYear() - 1;
      return {
        start: new Date(y, 0, 1),
        end: this._endOfDay(new Date(y, 11, 31)),
        label: String(y),
      };
    }
    if (range === 'all') {
      return {
        start: new Date(2000, 0, 1),
        end: endNow,
        label: 'All Time',
      };
    }
    // default: current quarter
    const q = Math.floor(now.getMonth() / 3);
    return {
      start: new Date(now.getFullYear(), q * 3, 1),
      end: endNow,
      label: `Q${q + 1} ${now.getFullYear()}`,
    };
  },

  getReportData(range = 'quarter', opts = {}) {
    const { start, end, label } = this.getReportRangeDates(range, opts.start, opts.end);
    const payments = ARS.Store.getCollection('payments').filter((p) => this._inDateRange(p.createdAt || p.date, start, end));
    const wos = ARS.Store.getCollection('workOrders').filter((w) => this._inDateRange(w.createdAt || w.date, start, end));
    const completed = wos.filter((w) => ['Completed', 'Invoiced'].includes(w.status));
    const invoices = ARS.Store.getCollection('invoices').filter((inv) => this._inDateRange(inv.createdAt || inv.date, start, end));

    const monthMap = {};
    payments.forEach((p) => {
      const d = new Date(p.createdAt || p.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const monthLabel = d.toLocaleDateString('en-US', {
        month: 'short',
        year: ['7', '30'].includes(range) ? undefined : 'numeric',
      });
      if (!monthMap[key]) monthMap[key] = { label: monthLabel, total: 0, key };
      monthMap[key].total += this.paymentNetAmount(p);
    });
    const revenue = Object.values(monthMap).sort((a, b) => a.key.localeCompare(b.key));

    const totalRevenue = payments.reduce((s, p) => s + this.paymentNetAmount(p), 0);
    const openInvoices = invoices.filter((inv) => inv.status !== 'Written Off');
    const invoicedTotal = openInvoices.reduce((s, inv) => s + (Number(inv.total) || 0), 0);
    const collectedOnInvoices = openInvoices.reduce((s, inv) => s + (Number(inv.amountPaid) || 0), 0);
    const collectionRate = invoicedTotal
      ? Math.min(100, Math.round((collectedOnInvoices / invoicedTotal) * 100))
      : (payments.length ? 100 : 0);
    const avgLabor = completed.length ? completed.reduce((s, w) => s + (w.labor || 0), 0) / completed.length : 0;
    const avgParts = completed.length ? completed.reduce((s, w) => s + (w.parts || 0), 0) / completed.length : 0;

    const serviceMap = {};
    completed.forEach((w) => {
      const cat = w.serviceType || 'Other';
      if (!serviceMap[cat]) serviceMap[cat] = 0;
      serviceMap[cat] += w.total || 0;
    });
    const serviceCategories = Object.entries(serviceMap)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total);

    const customerMap = {};
    payments.forEach((p) => {
      const name = p.customerName || 'Unknown';
      customerMap[name] = (customerMap[name] || 0) + this.paymentNetAmount(p);
    });
    const topCustomers = Object.entries(customerMap)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    const woMonthMap = {};
    completed.forEach((w) => {
      const d = new Date(w.createdAt || w.date);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
      const monthName = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (!woMonthMap[key]) {
        woMonthMap[key] = { month: monthName, jobs: 0, labor: 0, parts: 0, total: 0, key };
      }
      woMonthMap[key].jobs += 1;
      woMonthMap[key].labor += w.labor || 0;
      woMonthMap[key].parts += w.parts || 0;
      woMonthMap[key].total += w.total || 0;
    });
    const woSummary = Object.values(woMonthMap).sort((a, b) => a.key.localeCompare(b.key));
    const woTotals = woSummary.reduce(
      (acc, row) => {
        acc.jobs += row.jobs;
        acc.labor += row.labor;
        acc.parts += row.parts;
        acc.total += row.total;
        return acc;
      },
      { jobs: 0, labor: 0, parts: 0, total: 0 }
    );

    const tech = this.getTechPerformance({ start, end });
    const aging = this.getARAging();
    const outstanding = this.getInvoiceKPIs().outstanding;

    return {
      range,
      rangeLabel: label,
      start: start.toISOString(),
      end: end.toISOString(),
      revenue,
      totalRevenue,
      completedJobs: completed.length,
      avgJob: completed.length ? completed.reduce((s, w) => s + (w.total || 0), 0) / completed.length : 0,
      avgLabor,
      avgParts,
      collectionRate,
      collectedOnInvoices,
      invoicedTotal,
      outstanding,
      serviceCategories,
      topCustomers,
      tech,
      aging,
      woSummary,
      woTotals,
    };
  },

  getARAging() {
    const now = Date.now();
    const aging = {
      current: { label: 'Current (not overdue)', total: 0, items: [] },
      days30: { label: '1–30 Days Overdue', total: 0, items: [] },
      days60: { label: '31–60 Days Overdue', total: 0, items: [] },
      days90: { label: '60+ Days Overdue', total: 0, items: [] },
    };
    ARS.Store.getCollection('invoices')
      .filter((inv) => !['Paid', 'Written Off'].includes(inv.status))
      .forEach((inv) => {
        const balance = inv.total - (inv.amountPaid || 0);
        if (balance <= 0) return;
        const due = new Date(inv.due);
        const daysPast = !isNaN(due) ? Math.floor((now - due.getTime()) / 86400000) : 0;
        const item = { id: inv.id, customerName: inv.customerName, balance };
        if (daysPast <= 0) aging.current.items.push(item);
        else if (daysPast <= 30) aging.days30.items.push(item);
        else if (daysPast <= 60) aging.days60.items.push(item);
        else aging.days90.items.push(item);
      });
    Object.values(aging).forEach((bucket) => {
      bucket.total = bucket.items.reduce((s, i) => s + i.balance, 0);
    });
    return aging;
  },

  globalSearch(q) {
    if (!q || q.length < 2) return [];
    const ql = q.toLowerCase();
    const results = [];
    ARS.Store.getCollection('customers').forEach((c) => {
      if (
        (c.name || '').toLowerCase().includes(ql) ||
        (c.company || '').toLowerCase().includes(ql) ||
        (c.email || '').toLowerCase().includes(ql) ||
        (c.phone || '').includes(ql) ||
        String(c.id || '').toLowerCase().includes(ql)
      ) {
        results.push({
          type: 'Customer',
          label: c.name,
          sub: c.company || c.email || c.phone || '',
          href: `/app/customer-detail.html?id=${c.id}`,
        });
      }
    });
    ARS.Store.getCollection('trucks').forEach((t) => {
      const owner = ARS.Store.getCollection('customers').find((c) => c.id === t.customerId);
      const ownerLabel = owner ? (owner.company !== '—' ? owner.company : owner.name) : t.owner || '';
      if (
        t.id.toLowerCase().includes(ql) ||
        String(t.unit).toLowerCase().includes(ql) ||
        (t.make || '').toLowerCase().includes(ql) ||
        (t.model || '').toLowerCase().includes(ql) ||
        (t.vin || '').toLowerCase().includes(ql) ||
        (t.plate || '').toLowerCase().includes(ql) ||
        ownerLabel.toLowerCase().includes(ql)
      ) {
        results.push({
          type: 'Truck',
          label: `Unit ${t.unit} · ${t.make} ${t.model}`,
          sub: ownerLabel || t.vin || '',
          href: `/app/truck-detail.html?id=${t.id}`,
        });
      }
    });
    ARS.Store.getCollection('workOrders').forEach((w) => {
      if (
        w.id.toLowerCase().includes(ql) ||
        (w.customerName || '').toLowerCase().includes(ql) ||
        (w.truckLabel || '').toLowerCase().includes(ql) ||
        (w.desc || '').toLowerCase().includes(ql) ||
        (w.serviceType || '').toLowerCase().includes(ql)
      ) {
        results.push({ type: 'Work Order', label: w.id, sub: w.customerName, href: `/app/work-order-detail.html?id=${w.id}` });
      }
    });
    ARS.Store.getCollection('estimates').forEach((e) => {
      if (
        e.id.toLowerCase().includes(ql) ||
        (e.customerName || '').toLowerCase().includes(ql) ||
        (e.desc || '').toLowerCase().includes(ql)
      ) {
        results.push({ type: 'Estimate', label: e.id, sub: e.customerName, href: `/app/estimate-detail.html?id=${e.id}` });
      }
    });
    ARS.Store.getCollection('invoices').forEach((inv) => {
      if (
        inv.id.toLowerCase().includes(ql) ||
        (inv.customerName || '').toLowerCase().includes(ql)
      ) {
        results.push({ type: 'Invoice', label: inv.id, sub: inv.customerName, href: `/app/invoice-detail.html?id=${inv.id}` });
      }
    });
    this.listPayments().forEach((p) => {
      if (
        p.id.toLowerCase().includes(ql) ||
        (p.invoiceId || '').toLowerCase().includes(ql) ||
        (p.customerName || '').toLowerCase().includes(ql)
      ) {
        results.push({
          type: 'Payment',
          label: p.id,
          sub: `${p.customerName} · ${p.invoiceId}`,
          href: `/app/payments.html?q=${encodeURIComponent(p.id)}`,
        });
      }
    });
    this.listInventory().forEach((p) => {
      if (
        p.id.toLowerCase().includes(ql) ||
        (p.partNo || '').toLowerCase().includes(ql) ||
        (p.desc || '').toLowerCase().includes(ql)
      ) {
        results.push({
          type: 'Inventory',
          label: p.desc,
          sub: `${p.partNo} · ${p.id}`,
          href: `/app/inventory.html?highlight=${encodeURIComponent(p.id)}`,
        });
      }
    });
    this.listContactSubmissions().forEach((l) => {
      const name = l.name || l.company || 'Lead';
      if (
        (l.name || '').toLowerCase().includes(ql) ||
        (l.company || '').toLowerCase().includes(ql) ||
        (l.email || '').toLowerCase().includes(ql) ||
        (l.phone || '').includes(ql)
      ) {
        results.push({
          type: 'Lead',
          label: name,
          sub: l.email || l.phone || l.status || 'New',
          href: `/app/leads.html?highlight=${encodeURIComponent(l.id)}`,
        });
      }
    });
    return results.slice(0, 12);
  },

  getServiceTypes() {
    return ARS.SERVICE_TYPES || [];
  },

  _isAssignableTech(e) {
    if (!e) return false;
    if (e.role !== 'technician') return false;
    if (e.active === false) return false;
    const status = e.status || 'Active';
    if (status === 'Archived' || status === 'Terminated') return false;
    const name = String(e.name || '').trim();
    return !!name && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(name);
  },

  /** Live tech list from synced employees (preferred source of truth) */
  refreshTechsFromEmployees() {
    const live = this.listEmployees()
      .filter((e) => this._isAssignableTech(e))
      .map((e) => ({ uid: e.uid, name: e.name.trim() }))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!live.length) return this._techs || [];
    const prev = JSON.stringify(this._techs || []);
    const next = JSON.stringify(live);
    this._techs = live;
    if (prev !== next) {
      document.dispatchEvent(new CustomEvent('ars:techs-changed'));
    }
    return live;
  },

  async refreshTechs() {
    if (ARS.isDemoMode?.()) {
      return this._techs || [];
    }
    const fromEmployees = this.refreshTechsFromEmployees();
    if (ARS.FirestoreSync?.listTechs) {
      try {
        const remote = await ARS.FirestoreSync.listTechs();
        const byKey = new Map();
        [...(remote || []), ...fromEmployees].forEach((t) => {
          const name = String(t?.name || '').trim();
          if (!name || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(name)) return;
          byKey.set(t.uid || name, { uid: t.uid || '', name });
        });
        const merged = [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
        const prev = JSON.stringify(this._techs || []);
        this._techs = merged;
        if (prev !== JSON.stringify(merged)) {
          document.dispatchEvent(new CustomEvent('ars:techs-changed'));
        }
      } catch (_) { /* keep employee-derived list */ }
    }
    return this._techs || [];
  },

  getTechs() {
    const live = this.listEmployees()
      .filter((e) => this._isAssignableTech(e))
      .map((e) => ({ uid: e.uid, name: e.name.trim() }))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (live.length) {
      this._techs = live;
      return live;
    }
    if (this._techs?.length) return this._techs;
    const fromWos = [...new Set(ARS.Store.getCollection('workOrders').map((w) => w.tech).filter(Boolean))];
    return fromWos.map((name) => ({ uid: '', name }));
  },
};
