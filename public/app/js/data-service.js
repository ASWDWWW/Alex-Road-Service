/* Alex Road Service — Business Logic & CRUD */
window.ARS = window.ARS || {};

const LEGACY_CUSTOMER_ID = /^C00[1-8]$/;
const LEGACY_TRUCK_ID = /^T0(0[1-9]|10)$/;
const LEGACY_NAMES = ['washex', 'james construction', 'reid trucking', 'lopez distribution', 'kim brothers'];
const OPERATIONAL_COLLECTIONS = [
  'customers', 'trucks', 'workOrders', 'estimates', 'invoices',
  'payments', 'inventory', 'inventoryTransactions',
];

ARS.Data = {
  _techs: [],

  needsLegacyPurge(state = ARS.Store.load()) {
    if (state.demoPurged) return false;
    const customers = state.customers || [];
    if (customers.some((c) => LEGACY_CUSTOMER_ID.test(c.id))) return true;
    if ((state.trucks || []).some((t) => LEGACY_TRUCK_ID.test(t.id))) return true;
    return customers.some((c) => {
      const text = `${c.name || ''} ${c.company || ''}`.toLowerCase();
      return LEGACY_NAMES.some((n) => text.includes(n));
    });
  },

  clearLocalOperationalData() {
    const s = ARS.Store.load();
    OPERATIONAL_COLLECTIONS.forEach((name) => { s[name] = []; });
    s.counters = { wo: 0, est: 0, inv: 0, pay: 0, cust: 0, truck: 0, part: 0 };
    s.seeded = false;
    s.demoPurged = true;
    ARS.Store.save(s);
  },

  async purgeLegacyDemoData() {
    const s = ARS.Store.load();
    if (s.demoPurged) return false;
    const needsPurge = this.needsLegacyPurge(s);
    if (!needsPurge) {
      s.demoPurged = true;
      ARS.Store.save(s, { silent: true });
      return false;
    }
    if (ARS.FirestoreSync?.purgeLegacyDemoData) {
      try {
        await ARS.FirestoreSync.purgeLegacyDemoData();
      } catch (e) {
        console.warn('Cloud legacy purge failed:', e.message);
      }
    }
    this.clearLocalOperationalData();
    return true;
  },

  async init() {
    if (ARS.FirestoreSync?.listTechs) {
      this._techs = await ARS.FirestoreSync.listTechs();
    }
    this.refreshTruckPMStatus();
    this.refreshOverdueInvoices();
    if (!ARS.FirestoreSync?.isActive?.()) {
      this.refreshNotifications();
    }
  },

  async _nextId(prefix, localKey) {
    if (ARS.FirestoreSync?.isActive?.()) {
      return ARS.FirestoreSync.nextSequentialId(prefix);
    }
    const { year, num } = ARS.Store.bumpCounter(localKey || prefix.toLowerCase());
    return ARS.nextId(prefix, year, num);
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

  listContactSubmissions() {
    return ARS.Store.getCollection('contactSubmissions');
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
    const spent = ARS.Store.getCollection('payments')
      .filter((p) => p.customerName === c.name || p.customerName === c.company)
      .reduce((s, p) => s + p.amount, 0) || c.spentAmount || 0;
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
    const { num } = ARS.Store.bumpCounter('cust');
    const id = `C${String(num).padStart(3, '0')}`;
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
    if (!ARS.FirestoreSync?.isActive?.()) this.refreshNotifications();
    return customer;
  },

  updateCustomer(id, patch) {
    const s = ARS.Store.load();
    const i = s.customers.findIndex((c) => c.id === id);
    if (i < 0) throw new Error('Customer not found');
    s.customers[i] = { ...s.customers[i], ...patch, version: (s.customers[i].version || 1) + 1 };
    ARS.Store.save(s);
    return s.customers[i];
  },

  deactivateCustomer(id) {
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
    const { num } = ARS.Store.bumpCounter('truck');
    const id = `T${String(num).padStart(3, '0')}`;
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
    return this.enrichTruck(truck);
  },

  updateTruck(id, patch) {
    const s = ARS.Store.load();
    const i = s.trucks.findIndex((t) => t.id === id);
    if (i < 0) throw new Error('Truck not found');
    s.trucks[i] = { ...s.trucks[i], ...patch, version: (s.trucks[i].version || 1) + 1 };
    ARS.Store.save(s);
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
  listWorkOrders(filters = {}) {
    let items = ARS.Store.getCollection('workOrders');
    const role = ARS.Auth?.getRole?.();
    const user = ARS.Auth?.getUser?.();
    if (role === 'technician' && user) {
      items = items.filter((w) => w.tech === user.name);
    }
    if (filters.status) items = items.filter((w) => w.status === filters.status);
    if (filters.q) {
      const q = filters.q.toLowerCase();
      items = items.filter((w) =>
        w.id.toLowerCase().includes(q) ||
        (w.customerName || '').toLowerCase().includes(q) ||
        (w.tech || '').toLowerCase().includes(q)
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
    const s = ARS.Store.load();
    const wo = {
      id,
      date: data.date ? ARS.fmtDate(data.date) : ARS.fmtDate(new Date()),
      customerId: data.customerId,
      customerName: data.customerName,
      truckId: data.truckId || '',
      truckLabel: data.truckLabel,
      tech: data.tech,
      techId: data.techId || '',
      serviceType: data.serviceType || '',
      status: data.status || 'Open',
      desc: data.desc,
      labor: totals.labor,
      parts: totals.parts,
      tax: totals.tax,
      total: totals.total,
      invoiced: false,
      estimateId: data.estimateId || null,
      version: 1,
      createdAt: new Date().toISOString(),
    };
    s.workOrders.unshift(wo);
    ARS.Store.save(s);
    this._audit({ action: 'workOrder.create', entityId: id, entityType: 'workOrder' });
    if (!ARS.FirestoreSync?.isActive?.()) this.refreshNotifications();
    return wo;
  },

  updateWorkOrder(id, patch) {
    const s = ARS.Store.load();
    const i = s.workOrders.findIndex((w) => w.id === id);
    if (i < 0) throw new Error('Work order not found');
    const cur = s.workOrders[i];
    if (patch.version && patch.version !== cur.version) throw new Error('Conflict: record was modified by another user');
    const settings = ARS.Store.getSettings();
    const labor = patch.labor ?? cur.labor;
    const parts = patch.parts ?? cur.parts;
    const totals = ARS.calcTotals(labor, parts, settings);
    s.workOrders[i] = {
      ...cur,
      ...patch,
      labor: totals.labor,
      parts: totals.parts,
      tax: totals.tax,
      total: totals.total,
      version: (cur.version || 1) + 1,
      updatedAt: new Date().toISOString(),
    };
    ARS.Store.save(s);
    if (patch.status === 'Completed') this.deductInventoryForWO(s.workOrders[i]);
    if (!ARS.FirestoreSync?.isActive?.()) this.refreshNotifications();
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
    if (wi >= 0) {
      s.workOrders[wi].invoiced = true;
      s.workOrders[wi].status = 'Invoiced';
    }
    ARS.Store.save(s);
    this._audit({ action: 'invoice.create', entityId: id, entityType: 'invoice', workOrderId: woId });
    if (!ARS.FirestoreSync?.isActive?.()) this.refreshNotifications();
    return invoice;
  },

  /* ─── ESTIMATES ─── */
  listEstimates(filters = {}) {
    let items = ARS.Store.getCollection('estimates');
    if (filters.status) items = items.filter((e) => e.status === filters.status);
    if (filters.q) {
      const q = filters.q.toLowerCase();
      items = items.filter((e) =>
        e.id.toLowerCase().includes(q) ||
        (e.customerName || '').toLowerCase().includes(q)
      );
    }
    return items;
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
      labor: totals.labor,
      parts: totals.parts,
      total: totals.total,
      status: 'Pending',
      version: 1,
      createdAt: new Date().toISOString(),
    };
    s.estimates.unshift(est);
    ARS.Store.save(s);
    if (!ARS.FirestoreSync?.isActive?.()) this.refreshNotifications();
    return est;
  },

  updateEstimate(id, patch) {
    const s = ARS.Store.load();
    const i = s.estimates.findIndex((e) => e.id === id);
    if (i < 0) throw new Error('Estimate not found');
    s.estimates[i] = { ...s.estimates[i], ...patch, version: (s.estimates[i].version || 1) + 1 };
    ARS.Store.save(s);
    if (!ARS.FirestoreSync?.isActive?.()) this.refreshNotifications();
    return s.estimates[i];
  },

  async convertEstimateToWO(estId) {
    const est = ARS.Store.getCollection('estimates').find((e) => e.id === estId);
    if (!est || est.status !== 'Approved') throw new Error('Estimate must be approved');
    const wo = await this.createWorkOrder({
      customerName: est.customerName,
      customerId: est.customerId,
      truckLabel: est.truckLabel,
      desc: est.desc,
      labor: est.labor,
      parts: est.parts,
      status: 'Open',
      estimateId: estId,
    });
    this.updateEstimate(estId, { status: 'Converted', workOrderId: wo.id });
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

  writeOffInvoice(id, reason) {
    if (!ARS.can('invoices.writeOff')) throw new Error('Permission denied');
    const s = ARS.Store.load();
    const i = s.invoices.findIndex((inv) => inv.id === id);
    if (i < 0) throw new Error('Invoice not found');
    s.invoices[i].status = 'Written Off';
    s.invoices[i].writeOffReason = reason;
    ARS.Store.save(s);
    this._audit({ action: 'invoice.writeOff', entityId: id, entityType: 'invoice', reason });
    if (!ARS.FirestoreSync?.isActive?.()) this.refreshNotifications();
    return s.invoices[i];
  },

  /* ─── PAYMENTS ─── */
  listPayments(filters = {}) {
    let items = ARS.Store.getCollection('payments');
    if (filters.q) {
      const q = filters.q.toLowerCase();
      items = items.filter((p) =>
        p.id.toLowerCase().includes(q) ||
        (p.customerName || '').toLowerCase().includes(q)
      );
    }
    return items.map((p) => ({ ...p, amountDisplay: ARS.fmtMoney(p.amount) }));
  },

  async recordPayment() {
    throw new Error('Manual payments are disabled. Use Stripe Checkout to collect payment.');
  },

  /* ─── INVENTORY ─── */
  listInventory(filters = {}) {
    let items = ARS.Store.getCollection('inventory');
    if (filters.status) items = items.filter((p) => p.status === filters.status);
    if (filters.cat) items = items.filter((p) => p.cat === filters.cat);
    if (filters.q) {
      const q = filters.q.toLowerCase();
      items = items.filter((p) =>
        p.partNo.toLowerCase().includes(q) ||
        p.desc.toLowerCase().includes(q)
      );
    }
    return items.map((p) => ({
      ...p,
      status: ARS.inventoryStatus(p.qty, p.min),
    }));
  },

  async createPart(data) {
    const s = ARS.Store.load();
    const { num } = ARS.Store.bumpCounter('part');
    const id = `P${String(num).padStart(3, '0')}`;
    const part = {
      id,
      partNo: data.partNo,
      desc: data.desc,
      cat: data.cat || 'Other',
      qty: Number(data.qty) || 0,
      min: Number(data.min) || 1,
      cost: Number(data.cost) || 0,
      price: Number(data.price) || 0,
      status: ARS.inventoryStatus(Number(data.qty) || 0, Number(data.min) || 1),
      version: 1,
      createdAt: new Date().toISOString(),
    };
    s.inventory.push(part);
    ARS.Store.save(s);
    if (!ARS.FirestoreSync?.isActive?.()) this.refreshNotifications();
    return part;
  },

  adjustStock(partId, delta, reason) {
    const s = ARS.Store.load();
    const i = s.inventory.findIndex((p) => p.id === partId);
    if (i < 0) throw new Error('Part not found');
    s.inventory[i].qty = Math.max(0, s.inventory[i].qty + delta);
    s.inventory[i].status = ARS.inventoryStatus(s.inventory[i].qty, s.inventory[i].min);
    if (!s.inventoryTransactions) s.inventoryTransactions = [];
    s.inventoryTransactions.unshift({
      id: ARS.uid(),
      partId,
      delta,
      reason: reason || 'adjustment',
      at: new Date().toISOString(),
    });
    ARS.Store.save(s);
    if (!ARS.FirestoreSync?.isActive?.()) this.refreshNotifications();
    return s.inventory[i];
  },

  getLowStock() {
    return this.listInventory().filter((p) => p.status === 'Low' || p.status === 'Out of Stock');
  },

  /* ─── NOTIFICATIONS ─── */
  listNotifications() {
    return ARS.Store.getCollection('notifications');
  },

  refreshNotifications() {
    const s = ARS.Store.load();
    const uid = ARS.Auth?.getUser?.()?.uid || 'local';
    const notes = [];
    const now = new Date().toISOString();

    s.invoices.filter((inv) => inv.status === 'Overdue').forEach((inv) => {
      notes.push({
        id: `overdue_${inv.id}_${uid}`,
        userId: uid,
        type: 'warning',
        message: `Invoice ${inv.id} overdue — ${inv.customerName}`,
        entityType: 'invoice',
        entityId: inv.id,
        href: `/app/invoice-detail.html?id=${inv.id}`,
        read: false,
        createdAt: now,
      });
    });

    s.inventory.filter((p) => ARS.inventoryStatus(p.qty, p.min) !== 'In Stock').forEach((p) => {
      const status = ARS.inventoryStatus(p.qty, p.min);
      notes.push({
        id: `stock_${p.id}_${uid}`,
        userId: uid,
        type: 'warning',
        message: `${p.desc} is ${status.toLowerCase()} (${p.qty} on hand)`,
        entityType: 'inventory',
        entityId: p.id,
        href: '/app/inventory.html',
        read: false,
        createdAt: now,
      });
    });

    s.workOrders.filter((w) => ['Open', 'In Progress', 'Waiting Parts'].includes(w.status)).forEach((w) => {
      notes.push({
        id: `wo_${w.id}_${uid}`,
        userId: uid,
        type: 'info',
        message: `Work order ${w.id} — ${w.status} (${w.customerName})`,
        entityType: 'workOrder',
        entityId: w.id,
        href: `/app/work-order-detail.html?id=${w.id}`,
        read: false,
        createdAt: now,
      });
    });

    s.estimates.filter((e) => e.status === 'Pending' || e.status === 'Sent').forEach((e) => {
      notes.push({
        id: `est_${e.id}_${uid}`,
        userId: uid,
        type: 'info',
        message: `Estimate ${e.id} awaiting response — ${e.customerName}`,
        entityType: 'estimate',
        entityId: e.id,
        href: '/app/estimates.html',
        read: false,
        createdAt: now,
      });
    });

    s.notifications = notes;
    ARS.Store.save(s);
  },

  async markNotificationRead(id) {
    if (ARS.FirestoreSync?.isActive?.()) {
      await ARS.FirestoreSync.markNotificationRead(id);
      return;
    }
    const s = ARS.Store.load();
    const n = s.notifications.find((x) => x.id === id);
    if (n) n.read = true;
    ARS.Store.save(s);
  },

  async markAllNotificationsRead() {
    const notes = this.listNotifications().filter((n) => !n.read);
    await Promise.all(notes.map((n) => this.markNotificationRead(n.id)));
  },

  /* ─── CONTACT ─── */
  submitContact(data) {
    const s = ARS.Store.load();
    const sub = { id: ARS.uid(), ...data, createdAt: new Date().toISOString() };
    s.contactSubmissions.unshift(sub);
    ARS.Store.save(s);
    return sub;
  },

  /* ─── DASHBOARD & REPORTS ─── */
  getDashboardKPIs() {
    const wos = ARS.Store.getCollection('workOrders');
    const invoices = ARS.Store.getCollection('invoices');
    const payments = ARS.Store.getCollection('payments');
    const inventory = this.listInventory();
    const now = new Date();
    const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const openStatuses = ['Open', 'In Progress', 'Waiting Parts'];
    const openWOs = wos.filter((w) => openStatuses.includes(w.status));

    const mtdPayments = payments.filter((p) => new Date(p.createdAt || p.date) >= mtdStart);
    const revenueMTD = mtdPayments.reduce((s, p) => s + p.amount, 0);

    const outstanding = invoices
      .filter((inv) => !['Paid', 'Written Off'].includes(inv.status))
      .reduce((s, inv) => s + (inv.total - (inv.amountPaid || 0)), 0);

    const overdueCount = invoices.filter((inv) => inv.status === 'Overdue').length;
    const lowStock = inventory.filter((p) => p.status !== 'In Stock');

    const completedMTD = wos.filter((w) => {
      if (w.status !== 'Completed' && w.status !== 'Invoiced') return false;
      return new Date(w.createdAt) >= mtdStart;
    });

    return {
      openWOs: openWOs.length,
      openByStatus: {
        Open: wos.filter((w) => w.status === 'Open').length,
        'In Progress': wos.filter((w) => w.status === 'In Progress').length,
        'Waiting Parts': wos.filter((w) => w.status === 'Waiting Parts').length,
      },
      revenueMTD,
      outstanding,
      overdueCount,
      lowStockCount: lowStock.length,
      outOfStockCount: lowStock.filter((p) => p.status === 'Out of Stock').length,
      completedMTD: completedMTD.length,
      invoicesSentMTD: invoices.filter((inv) => new Date(inv.createdAt) >= mtdStart).length,
      paymentsMTD: revenueMTD,
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
      });
    }
    const oos = this.listInventory().filter((p) => p.status === 'Out of Stock');
    oos.forEach((p) => {
      alerts.push({
        type: 'red',
        icon: 'fa-boxes',
        title: `${p.desc} Out of Stock`,
        desc: `${p.id} · ${p.partNo} — reorder immediately`,
      });
    });
    const low = this.listInventory().filter((p) => p.status === 'Low');
    if (low.length) {
      alerts.push({
        type: 'amber',
        icon: 'fa-tools',
        title: `${low.length} Parts at Low Inventory`,
        desc: low.map((p) => p.desc).slice(0, 3).join(', ') + (low.length > 3 ? '…' : ''),
      });
    }
    const pmDue = this.trucksPMDue(30);
    if (pmDue.length) {
      alerts.push({
        type: 'amber',
        icon: 'fa-truck',
        title: `${pmDue.length} Truck${pmDue.length > 1 ? 's' : ''} PM Due`,
        desc: pmDue.map((t) => `Unit ${t.unit} · ${t.make} ${t.model}`).join(' & '),
      });
    }
    const pendingEst = ARS.Store.getCollection('estimates').filter((e) => ['Pending', 'Sent'].includes(e.status));
    if (pendingEst.length) {
      alerts.push({
        type: 'blue',
        icon: 'fa-file-alt',
        title: `${pendingEst.length} Estimates Awaiting Response`,
        desc: pendingEst.map((e) => `${e.id} · ${e.customerName}`).join(' & '),
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
        .reduce((s, p) => s + p.amount, 0);
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
    const techs = [...new Set(wos.map((w) => w.tech).filter(Boolean))];
    return techs
      .map((tech) => {
        const jobs = wos.filter((w) => w.tech === tech);
        const completed = jobs.filter((w) => ['Completed', 'Invoiced'].includes(w.status));
        const revenue = completed.reduce((s, w) => s + (w.total || 0), 0);
        return { tech, jobs: jobs.length, completed: completed.length, revenue };
      })
      .sort((a, b) => b.revenue - a.revenue);
  },

  _inDateRange(d, start, end) {
    const dt = new Date(d);
    return !isNaN(dt) && dt >= start && dt <= end;
  },

  getReportRangeDates(range) {
    const now = new Date();
    if (range === '30') {
      return {
        start: new Date(now.getTime() - 30 * 86400000),
        end: now,
        label: 'Last 30 Days',
      };
    }
    if (range === 'ytd') {
      return {
        start: new Date(now.getFullYear(), 0, 1),
        end: now,
        label: `Year to Date ${now.getFullYear()}`,
      };
    }
    const q = Math.floor(now.getMonth() / 3);
    return {
      start: new Date(now.getFullYear(), q * 3, 1),
      end: now,
      label: `Q${q + 1} ${now.getFullYear()}`,
    };
  },

  getReportData(range = 'quarter') {
    const { start, end, label } = this.getReportRangeDates(range);
    const payments = ARS.Store.getCollection('payments').filter((p) => this._inDateRange(p.createdAt || p.date, start, end));
    const wos = ARS.Store.getCollection('workOrders').filter((w) => this._inDateRange(w.createdAt || w.date, start, end));
    const completed = wos.filter((w) => ['Completed', 'Invoiced'].includes(w.status));
    const invoices = ARS.Store.getCollection('invoices').filter((inv) => this._inDateRange(inv.createdAt || inv.date, start, end));

    const monthMap = {};
    payments.forEach((p) => {
      const d = new Date(p.createdAt || p.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const monthLabel = d.toLocaleDateString('en-US', { month: 'short', year: range === '30' ? undefined : 'numeric' });
      if (!monthMap[key]) monthMap[key] = { label: monthLabel, total: 0, key };
      monthMap[key].total += p.amount;
    });
    const revenue = Object.values(monthMap).sort((a, b) => a.key.localeCompare(b.key));

    const totalRevenue = payments.reduce((s, p) => s + p.amount, 0);
    const invoicedTotal = invoices.reduce((s, inv) => s + inv.total, 0);
    const collectionRate = invoicedTotal ? Math.round((totalRevenue / invoicedTotal) * 100) : (payments.length ? 100 : 0);
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
      customerMap[name] = (customerMap[name] || 0) + p.amount;
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
      (acc, row) => ({
        jobs: acc.jobs + row.jobs,
        labor: acc.labor + row.labor,
        parts: acc.parts + row.parts,
        total: acc.total + row.total,
      }),
      { jobs: 0, labor: 0, parts: 0, total: 0 },
    );

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
    const outstanding = Object.values(aging).reduce((s, b) => s + b.total, 0);

    return {
      rangeLabel: label,
      revenue,
      totalRevenue,
      completedJobs: completed.length,
      collectionRate,
      avgLabor,
      avgParts,
      avgJob: completed.length ? totalRevenue / completed.length : 0,
      outstanding,
      serviceCategories,
      topCustomers,
      tech: this.getTechPerformance({ start, end }),
      woSummary,
      woTotals,
      aging,
    };
  },

  globalSearch(q) {
    if (!q || q.length < 2) return [];
    const ql = q.toLowerCase();
    const results = [];
    ARS.Store.getCollection('customers').forEach((c) => {
      if (c.name.toLowerCase().includes(ql) || (c.company || '').toLowerCase().includes(ql)) {
        results.push({ type: 'Customer', label: c.name, sub: c.company, href: `/app/customer-detail.html?id=${c.id}` });
      }
    });
    ARS.Store.getCollection('workOrders').forEach((w) => {
      if (w.id.toLowerCase().includes(ql) || (w.customerName || '').toLowerCase().includes(ql)) {
        results.push({ type: 'Work Order', label: w.id, sub: w.customerName, href: `/app/work-order-detail.html?id=${w.id}` });
      }
    });
    ARS.Store.getCollection('invoices').forEach((inv) => {
      if (inv.id.toLowerCase().includes(ql) || (inv.customerName || '').toLowerCase().includes(ql)) {
        results.push({ type: 'Invoice', label: inv.id, sub: inv.customerName, href: `/app/invoice-detail.html?id=${inv.id}` });
      }
    });
    return results.slice(0, 12);
  },

  getServiceTypes() {
    return ARS.SERVICE_TYPES || [];
  },

  getTechs() {
    if (this._techs?.length) return this._techs;
    const fromWos = [...new Set(ARS.Store.getCollection('workOrders').map((w) => w.tech).filter(Boolean))];
    return fromWos;
  },
};
