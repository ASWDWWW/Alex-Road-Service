/* Alex Road Service — Persistence Layer (localStorage + optional Firestore) */
window.ARS = window.ARS || {};

const STORE_KEY = 'ars_platform_v1';
const listeners = new Set();

function emit() {
  listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
}

function defaultState() {
  return {
    customers: [],
    trucks: [],
    workOrders: [],
    estimates: [],
    invoices: [],
    payments: [],
    inventory: [],
    notifications: [],
    contactSubmissions: [],
    auditLog: [],
    settings: {
      laborRate: 95,
      partsMarkup: 0.4,
      taxRate: 0.06625,
      paymentTermsDays: 14,
      shopName: 'Alex Road Service',
      shopAddress: '406 Smith St, Keasbey, NJ 08832',
      shopPhone: '(732) 938-0713',
      shopEmail: 'info@alexroadservice.com',
    },
    counters: { wo: 0, est: 0, inv: 0, pay: 0, cust: 0, truck: 0, part: 0 },
    seeded: false,
    demoPurged: false,
    demoPurgeSkipped: false,
  };
}

ARS.Store = {
  load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return defaultState();
      return { ...defaultState(), ...JSON.parse(raw) };
    } catch {
      return defaultState();
    }
  },

  save(state, opts = {}) {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    if (!opts.silent) emit();
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  getCollection(name) {
    const s = this.load();
    return [...(s[name] || [])];
  },

  setCollection(name, items) {
    const s = this.load();
    s[name] = items;
    this.save(s);
  },

  getSettings() {
    return { ...this.load().settings };
  },

  setSettings(patch) {
    const s = this.load();
    s.settings = { ...s.settings, ...patch };
    this.save(s);
  },

  getCounters() {
    return { ...this.load().counters };
  },

  bumpCounter(key) {
    const s = this.load();
    const year = new Date().getFullYear();
    const ck = `${key}_${year}`;
    if (!s.counters[ck]) s.counters[ck] = s.counters[key] || 0;
    s.counters[ck] += 1;
    s.counters[key] = s.counters[ck];
    this.save(s);
    return { num: s.counters[ck], year };
  },

  audit(entry) {
    const s = this.load();
    s.auditLog.unshift({
      id: ARS.uid(),
      ...entry,
      at: new Date().toISOString(),
      by: ARS.Auth?.getUser?.()?.email || 'system',
    });
    s.auditLog = s.auditLog.slice(0, 500);
    this.save(s);
  },

};
