/* Firebase sync — real-time listeners + write-through to cloud */
window.ARS = window.ARS || {};

/** Collections the client may write (payments are webhook-only) */
const WRITABLE_COLLECTIONS = [
  'customers', 'trucks', 'workOrders', 'estimates', 'invoices', 'inventory',
];

/** Listen map: Firestore name → local store key */
const LISTEN_COLLECTIONS = [
  ...WRITABLE_COLLECTIONS.map((name) => ({ firestore: name, store: name })),
  { firestore: 'payments', store: 'payments' },
  { firestore: 'inventoryTransactions', store: 'inventoryTransactions' },
  { firestore: 'contact_submissions', store: 'contactSubmissions' },
];

/** Default first-paint data for cross-functional pages such as Dashboard. */
const CRITICAL_LISTEN = new Set(['customers', 'trucks', 'workOrders', 'invoices']);

/** Roles that may see the employee directory — matches employees.view permission */
const EMPLOYEE_DIRECTORY_ROLES = ['admin', 'developer'];

const HYDRATE_TIMEOUT_MS = 8000;
const PENDING_LOCAL_MS = 120000;
/* Unique names — firebase-config.js also declares FB_VERSION in the same global scope */
const ARS_SYNC_FB_VERSION = '10.7.1';
const ARS_SYNC_FB_FIRESTORE = `https://www.gstatic.com/firebasejs/${ARS_SYNC_FB_VERSION}/firebase-firestore.js`;
const ARS_SYNC_FB_FUNCTIONS = `https://www.gstatic.com/firebasejs/${ARS_SYNC_FB_VERSION}/firebase-functions.js`;

function isCriticalForCurrentPage(collectionName) {
  if (location.pathname.endsWith('/inventory.html')) return collectionName === 'inventory';
  return CRITICAL_LISTEN.has(collectionName);
}

ARS.FirestoreSync = {
  _db: null,
  _fns: null,
  _unsubs: [],
  _collectionErrors: {},
  _dataChangedTimer: null,
  _ready: false,
  _hydrated: false,
  _fullySynced: false,
  _applyingRemote: false,

  isActive() {
    return this._ready && !!this._db;
  },

  isHydrated() {
    return this._hydrated;
  },

  isFullySynced() {
    return this._fullySynced;
  },

  getCollectionError(collectionName) {
    return this._collectionErrors[collectionName] || null;
  },

  async _loadModules() {
    const cached = window.ARSFirebase?._mods;
    if (cached?.firestore && cached?.getFunctions) {
      return { ...cached.firestore, getFunctions: cached.getFunctions, httpsCallable: cached.httpsCallable };
    }
    const [firestore, functions] = await Promise.all([
      cached?.firestore || import(ARS_SYNC_FB_FIRESTORE),
      import(ARS_SYNC_FB_FUNCTIONS),
    ]);
    const mods = {
      ...firestore,
      getFunctions: functions.getFunctions,
      httpsCallable: functions.httpsCallable,
    };
    if (window.ARSFirebase) {
      window.ARSFirebase._mods = {
        firestore,
        getFunctions: functions.getFunctions,
        httpsCallable: functions.httpsCallable,
      };
    }
    return mods;
  },

  async init() {
    if (ARS.isDemoMode?.()) {
      this._hydrated = true;
      this._fullySynced = true;
      return false;
    }
    if (!window.ARSFirebase?.configured || !window.ARSFirebase.db) return false;
    try {
      const mods = await this._loadModules();
      this._db = window.ARSFirebase.db;
      this._mods = mods;
      const { getFunctions, httpsCallable } = mods;
      this._fns = getFunctions(window.ARSFirebase.app, 'us-central1');
      this._callable = (name) => httpsCallable(this._fns, name);

      // Load settings before listeners to avoid painting stale configuration.
      await this._prepLocalStore();

      const critical = [];
      const secondary = [];
      const role = ARS.Auth?.getRole?.();
      const technicianCollections = new Set(['customers', 'trucks', 'workOrders', 'inventory']);
      LISTEN_COLLECTIONS.forEach((c) => {
        if (role === 'technician' && !technicianCollections.has(c.firestore)) return;
        const p = this._listenCollection(c.firestore, c.store);
        if (isCriticalForCurrentPage(c.firestore)) critical.push(p);
        else secondary.push(p);
      });
      if (EMPLOYEE_DIRECTORY_ROLES.includes(ARS.Auth?.getRole?.())) {
        secondary.push(this._listenCollection('users', 'employees'));
      } else if (ARS.Auth?.getRole?.() === 'office') {
        secondary.push(this._listenCollection('messagingRoster', 'employees'));
      }

      await Promise.race([
        Promise.all(critical),
        new Promise((resolve) => setTimeout(resolve, HYDRATE_TIMEOUT_MS)),
      ]);

      this._startNotificationListener();

      this._hydrated = true;
      this._ready = true;
      document.dispatchEvent(new CustomEvent('ars:data-hydrated'));
      this._emitDataChanged();

      // Background: remaining collections
      Promise.all(secondary).then(() => {
        this._fullySynced = true;
        document.dispatchEvent(new CustomEvent('ars:data-synced'));
        this._emitDataChanged();
      }).catch(() => {
        this._fullySynced = true;
      });

      return true;
    } catch (e) {
      console.warn('Firestore sync unavailable:', e);
      this._hydrated = true;
      this._fullySynced = true;
      return false;
    }
  },

  async _prepLocalStore() {
    await this._pullSettings().catch((e) => console.warn('Settings pull failed:', e));
  },

  async _pullSettings() {
    const { doc, getDoc } = this._mods;
    const shopSnap = await getDoc(doc(this._db, 'settings', 'shop'));
    if (shopSnap.exists()) {
      const s = ARS.Store.load();
      s.settings = { ...s.settings, ...shopSnap.data() };
      ARS.Store.save(s, { silent: true });
    }
  },

  _listenCollection(firestoreName, storeName) {
    const { collection, onSnapshot, query, where } = this._mods;
    const base = collection(this._db, firestoreName);
    const source = firestoreName === 'workOrders' && ARS.Auth?.getRole?.() === 'technician'
      ? query(base, where('techIds', 'array-contains', ARS.Auth.getUser().uid))
      : base;
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const unsub = onSnapshot(
        source,
        (snap) => {
          delete this._collectionErrors[firestoreName];
          const items = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
          this._applyRemoteCollection(storeName, items, { silent: !this._hydrated });
          finish();
        },
        (err) => {
          console.warn(`Listener error (${firestoreName}):`, err);
          this._collectionErrors[firestoreName] = err;
          if (this._hydrated) this._scheduleDataChanged();
          finish();
        },
      );
      this._unsubs.push(unsub);
    });
  },

  _startNotificationListener() {
    const uid = ARS.Auth?.getUser?.()?.uid;
    if (!uid) return;
    const { collection, query, where, onSnapshot } = this._mods;
    const q = query(collection(this._db, 'notifications'), where('userId', '==', uid));
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs
        .map((d) => ({ ...d.data(), id: d.id }))
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      this._applyRemoteCollection('notifications', items, { silent: true });
      ARS.Data?.refreshNotifications?.();
      document.dispatchEvent(new CustomEvent('ars:notifications-changed'));
    }, (err) => console.warn('Notification listener error:', err));
    this._unsubs.push(unsub);
  },

  _toIso(v) {
    if (v == null || v === '') return v;
    if (typeof v === 'string') return v;
    if (typeof v?.toDate === 'function') return v.toDate().toISOString();
    if (typeof v?.seconds === 'number') return new Date(v.seconds * 1000).toISOString();
    const t = new Date(v).getTime();
    return Number.isFinite(t) ? new Date(t).toISOString() : v;
  },

  _ts(item) {
    const raw = item?.updatedAt || item?.createdAt || 0;
    const iso = this._toIso(raw);
    const t = new Date(iso || 0).getTime();
    return Number.isFinite(t) ? t : 0;
  },

  _normalizeItem(item) {
    if (!item || typeof item !== 'object') return item;
    const out = { ...item };
    ['updatedAt', 'createdAt', 'lastRefundAt', 'processedAt', 'readAt'].forEach((key) => {
      if (out[key] != null) out[key] = this._toIso(out[key]);
    });
    return out;
  },

  _isDerivedNotificationId(id) {
    return /^(overdue_|stock_|wo_|est_)/.test(String(id || ''));
  },

  _applyRemoteCollection(name, items, opts = {}) {
    this._applyingRemote = true;
    const s = ARS.Store.load();
    const local = s[name] || [];
    const remote = items.map((i) => this._normalizeItem(i));
    const remoteIds = new Set(remote.map((i) => i.id).filter(Boolean));
    const localById = new Map(local.map((item) => [item.id, item]));

    // Keep client-derived operational alerts; merge only server-pushed notifications.
    if (name === 'notifications') {
      const derived = local.filter((l) => this._isDerivedNotificationId(l?.id));
      const remoteOnly = remote.filter((r) => r?.id && !this._isDerivedNotificationId(r.id));
      const reads = { ...(s.notificationReads || {}) };
      remoteOnly.forEach((n) => {
        if (n.read) reads[n.id] = n.readAt || reads[n.id] || true;
        else if (reads[n.id]) {
          n.read = true;
          n.readAt = n.readAt || reads[n.id];
        }
      });
      s.notificationReads = reads;
      s.notifications = [...derived, ...remoteOnly];
      ARS.Store.save(s, { silent: true });
      this._applyingRemote = false;
      if (!opts.silent) this._scheduleDataChanged();
      return;
    }

    const preferRemote = ['payments', 'inventoryTransactions', 'contactSubmissions', 'employees'].includes(name);

    const merged = remote.map((rem) => {
      const loc = localById.get(rem.id);
      if (!loc || preferRemote) return rem;
      const lv = loc.version || 0;
      const rv = rem.version || 0;
      if (lv > rv) return loc;
      if (lv === rv && this._ts(loc) > this._ts(rem)) return loc;
      return rem;
    });

    const pendingLocal = local.filter((loc) => {
      if (!loc?.id || remoteIds.has(loc.id)) return false;
      return (Date.now() - this._ts(loc)) < PENDING_LOCAL_MS;
    });

    s[name] = [...merged, ...pendingLocal];
    if (remote.length) s.seeded = true;
    ARS.Store.save(s, { silent: true });
    this._applyingRemote = false;
    if (!opts.silent) this._scheduleDataChanged();
  },

  _scheduleDataChanged() {
    clearTimeout(this._dataChangedTimer);
    this._dataChangedTimer = setTimeout(() => this._emitDataChanged(), 50);
  },

  _emitDataChanged() {
    document.dispatchEvent(new CustomEvent('ars:data-changed'));
  },

  async pushItem(collectionName, item) {
    if (!this._callable || !item?.id) throw new Error('Cloud save service is unavailable');
    try {
      const result = await this._callable('saveEntity')({ collectionName, item });
      return result.data;
    } catch (e) {
      console.warn(`Push failed (${collectionName}/${item.id}):`, e.message);
      await this._restoreRemoteItem(collectionName, item.id).catch((restoreError) => {
        console.warn(`Rollback failed (${collectionName}/${item.id}):`, restoreError.message);
      });
      throw e;
    }
  },

  async _restoreRemoteItem(collectionName, id) {
    const { doc, getDoc } = this._mods;
    const snapshot = await getDoc(doc(this._db, collectionName, id));
    const state = ARS.Store.load();
    const items = state[collectionName];
    if (!Array.isArray(items)) return;
    const index = items.findIndex((entry) => entry.id === id);
    if (snapshot.exists()) {
      const remote = { id: snapshot.id, ...snapshot.data() };
      if (index >= 0) items[index] = remote;
      else items.push(remote);
    } else if (index >= 0) {
      items.splice(index, 1);
    }
    ARS.Store.save(state);
  },

  async nextSequentialId(prefix) {
    if (!this._callable) throw new Error('Cloud ID service is unavailable. Reconnect before creating records.');
    try {
      const year = new Date().getFullYear();
      const res = await this._callable('nextSequentialId')({ prefix, year });
      return res.data?.id || res.data;
    } catch (e) {
      throw new Error(`Could not reserve a record number: ${e.message || 'service unavailable'}`);
    }
  },

  async listTechs() {
    if (!this._db) return [];
    const { collection, query, where, getDocs } = this._mods;
    try {
      const snap = await getDocs(query(collection(this._db, 'messagingRoster'), where('role', '==', 'technician')));
      return snap.docs
        .map((d) => ({ uid: d.id, ...d.data() }))
        .filter((u) => u.active !== false && u.status !== 'Archived' && u.status !== 'Terminated')
        .map((u) => ({ uid: u.uid || u.id, name: u.name || '' }))
        .filter((u) => u.name && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u.name));
    } catch (e) {
      console.warn('listTechs failed:', e.message);
      return [];
    }
  },

  async markNotificationRead(id) {
    if (!this._db || !id) return;
    const { doc, updateDoc } = this._mods;
    try {
      await updateDoc(doc(this._db, 'notifications', id), { read: true, readAt: new Date().toISOString() });
    } catch (e) {
      console.warn('markNotificationRead failed:', e.message);
    }
  },

  async audit(entry) {
    ARS.Store.audit(entry);
    if (!this._callable || !ARS.Auth?.getUser?.()?.uid) return;
    try {
      await this._callable('auditLog')({
        action: entry.action,
        entityType: entry.entityType || entry.action?.split('.')[0] || null,
        entityId: entry.entityId || null,
        before: entry.before || null,
        after: entry.after || null,
      });
    } catch (e) {
      console.warn('auditLog cloud call failed:', e.message);
    }
  },

  async completeWorkOrder(workOrderId, expectedVersion) {
    if (!this._callable) throw new Error('Cloud functions unavailable');
    const res = await this._callable('completeWorkOrder')({ workOrderId, expectedVersion });
    return res.data;
  },

  async adjustInventory(partId, delta, reason) {
    if (!this._callable) throw new Error('Cloud functions unavailable');
    const res = await this._callable('adjustInventory')({ partId, delta, reason });
    return res.data;
  },

  async createInvoiceFromWorkOrder(workOrderId) {
    if (!this._callable) throw new Error('Cloud functions unavailable');
    const res = await this._callable('createInvoiceFromWorkOrder')({ workOrderId });
    return res.data;
  },

  async saveShopSettings(patch) {
    if (!this._callable) throw new Error('Cloud functions unavailable');
    const res = await this._callable('saveShopSettings')({ patch });
    return res.data;
  },

  async createEmployee(payload) {
    if (!this._callable) throw new Error('Cloud functions unavailable');
    const res = await this._callable('createEmployee')(payload);
    return res.data;
  },

  async updateEmployee(uid, patch) {
    if (!this._callable) throw new Error('Cloud functions unavailable');
    const res = await this._callable('updateEmployee')({ uid, patch });
    return res.data;
  },

  async sendEmployeePasswordReset(uid, email) {
    if (!this._callable) throw new Error('Cloud functions unavailable');
    const res = await this._callable('sendEmployeePasswordReset')({ uid, email });
    return res.data;
  },

  async archiveEmployee(uid) {
    if (!this._callable) throw new Error('Cloud functions unavailable');
    const res = await this._callable('archiveEmployee')({ uid });
    return res.data;
  },

  async unarchiveEmployee(uid) {
    if (!this._callable) throw new Error('Cloud functions unavailable');
    const res = await this._callable('unarchiveEmployee')({ uid });
    return res.data;
  },

  async deleteEmployee(uid) {
    if (!this._callable) throw new Error('Cloud functions unavailable');
    const res = await this._callable('deleteEmployee')({ uid });
    return res.data;
  },

  async ensureMessaging() {
    if (!this._callable) throw new Error('Cloud functions unavailable');
    const res = await this._callable('ensureMessaging')({});
    return res.data;
  },

  async listAuditLog() {
    if (!this._callable) throw new Error('Cloud functions unavailable');
    const res = await this._callable('listAuditLog')({});
    return res.data?.items || [];
  },

  destroy() {
    this._unsubs.forEach((fn) => { try { fn(); } catch (_) {} });
    this._unsubs = [];
    this._collectionErrors = {};
    this._ready = false;
    this._hydrated = false;
    this._fullySynced = false;
  },
};
