/* Alex Road Service — Persistence Layer (localStorage + optional Firestore) */
window.ARS = window.ARS || {};

const PROD_STORE_PREFIX = 'ars_platform_v2';
const LEGACY_SHARED_STORE_KEY = 'ars_platform_v1';
const listeners = new Set();

function storeKey() {
  if (ARS.isDemoMode?.()) return ARS.DEMO_STORE_KEY || 'ars_platform_demo_v1';
  const uid = ARS.Auth?.getUser?.()?.uid || window.ARSFirebase?.auth?.currentUser?.uid;
  return uid ? `${PROD_STORE_PREFIX}:${uid}` : null;
}

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
    notificationReads: {},
    contactSubmissions: [],
    employees: [],
    conversations: [],
    messages: {},
    scheduleBlocks: [],
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

function loadDemoState() {
  if (ARS.Demo?.getState) {
    return { ...defaultState(), ...ARS.Demo.getState() };
  }
  ARS.Demo?.resetAndSeed?.();
  return { ...defaultState(), ...(ARS.Demo?.getState?.() || {}) };
}

ARS.Store = {
  load() {
    if (ARS.isDemoMode?.()) return loadDemoState();

    try {
      const key = storeKey();
      if (!key) return defaultState();
      localStorage.removeItem(LEGACY_SHARED_STORE_KEY);
      const raw = localStorage.getItem(key);
      if (!raw) return defaultState();
      return { ...defaultState(), ...JSON.parse(raw) };
    } catch {
      return defaultState();
    }
  },

  save(state, opts = {}) {
    if (ARS.isDemoMode?.()) {
      ARS.Demo?.setState?.(state);
      if (!opts.silent) emit();
      return;
    }
    const key = storeKey();
    if (key) localStorage.setItem(key, JSON.stringify(state));
    if (!opts.silent) emit();
  },

  clearCurrentUserCache() {
    if (ARS.isDemoMode?.()) return;
    const key = storeKey();
    if (key) localStorage.removeItem(key);
    localStorage.removeItem(LEGACY_SHARED_STORE_KEY);
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  /** True when localStorage already has ops data we can paint from (stale-while-revalidate). */
  hasLocalCache() {
    if (ARS.isDemoMode?.()) return true;
    try {
      const s = this.load();
      const keys = ['customers', 'trucks', 'workOrders', 'estimates', 'invoices', 'inventory', 'payments'];
      return keys.some((k) => (s[k] || []).length > 0);
    } catch {
      return false;
    }
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
