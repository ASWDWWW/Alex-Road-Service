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

/** First paint waits only on these; the rest sync in the background */
const CRITICAL_LISTEN = new Set(['customers', 'trucks', 'workOrders', 'invoices']);

/** Roles that may see the employee directory — matches employees.view permission */
const EMPLOYEE_DIRECTORY_ROLES = ['admin', 'office', 'developer'];

const HYDRATE_TIMEOUT_MS = 8000;
const PENDING_LOCAL_MS = 120000;
/* Unique names — firebase-config.js also declares FB_VERSION in the same global scope */
const ARS_SYNC_FB_VERSION = '10.7.1';
const ARS_SYNC_FB_FIRESTORE = `https://www.gstatic.com/firebasejs/${ARS_SYNC_FB_VERSION}/firebase-firestore.js`;
const ARS_SYNC_FB_FUNCTIONS = `https://www.gstatic.com/firebasejs/${ARS_SYNC_FB_VERSION}/firebase-functions.js`;

ARS.FirestoreSync = {
  _db: null,
  _fns: null,
  _unsubs: [],
  _pushTimer: null,
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

      // Settings + purge before listeners so we never race-clear after remote apply
      await this._prepLocalStore();

      const critical = [];
      const secondary = [];
      LISTEN_COLLECTIONS.forEach((c) => {
        const p = this._listenCollection(c.firestore, c.store);
        if (CRITICAL_LISTEN.has(c.firestore)) critical.push(p);
        else secondary.push(p);
      });
      if (EMPLOYEE_DIRECTORY_ROLES.includes(ARS.Auth?.getRole?.())) {
        secondary.push(this._listenCollection('users', 'employees'));
      }

      await Promise.race([
        Promise.all(critical),
        new Promise((resolve) => setTimeout(resolve, HYDRATE_TIMEOUT_MS)),
      ]);

      this._startNotificationListener();
      ARS.Store.subscribe(() => this._schedulePush());

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
    const settingsP = this._pullSettings().catch((e) => console.warn('Settings pull failed:', e));
    const store = ARS.Store.load();
    if (store.demoPurged || store.demoPurgeSkipped) {
      await settingsP;
      return;
    }
    const needsLocalPurge = ARS.Data?.needsLegacyPurge?.(store);
    const result = await this.purgeLegacyDemoData();
    if (result.purged || needsLocalPurge) {
      ARS.Data?.clearLocalOperationalData?.();
    } else if (result.skipped) {
      const s = ARS.Store.load();
      s.demoPurgeSkipped = true;
      if (!needsLocalPurge) s.demoPurged = true;
      ARS.Store.save(s, { silent: true });
    } else {
      const s = ARS.Store.load();
      s.demoPurged = true;
      ARS.Store.save(s, { silent: true });
    }
    await settingsP;
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
    const { collection, onSnapshot } = this._mods;
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      const unsub = onSnapshot(
        collection(this._db, firestoreName),
        (snap) => {
          const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          this._applyRemoteCollection(storeName, items, { silent: !this._hydrated });
          finish();
        },
        (err) => {
          console.warn(`Listener error (${firestoreName}):`, err);
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
        .map((d) => ({ id: d.id, ...d.data() }))
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
      const loc = local.find((l) => l.id === rem.id);
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

  _schedulePush() {
    if (!this._db || this._applyingRemote) return;
    clearTimeout(this._pushTimer);
    this._pushTimer = setTimeout(() => this._pushAll(), 800);
  },

  async _pushAll() {
    if (!this._db || this._applyingRemote) return;
    const { doc, setDoc } = this._mods;
    const s = ARS.Store.load();
    for (const name of WRITABLE_COLLECTIONS) {
      for (const item of s[name] || []) {
        if (!item.id) continue;
        try {
          await setDoc(doc(this._db, name, item.id), item, { merge: true });
        } catch (e) {
          console.warn(`Push failed (${name}/${item.id}):`, e.message);
        }
      }
    }
  },

  async pushItem(collectionName, item) {
    if (!this._db || !item?.id) return;
    const { doc, setDoc } = this._mods;
    try {
      await setDoc(doc(this._db, collectionName, item.id), item, { merge: true });
    } catch (e) {
      console.warn(`Push failed (${collectionName}/${item.id}):`, e.message);
      throw e;
    }
  },

  async nextSequentialId(prefix) {
    if (!this._callable) {
      const { num, year } = ARS.Store.bumpCounter(prefix.toLowerCase().replace(/[^a-z]/g, '') || 'id');
      return ARS.nextId(prefix, year, num);
    }
    try {
      const year = new Date().getFullYear();
      const res = await this._callable('nextSequentialId')({ prefix, year });
      return res.data?.id || res.data;
    } catch (e) {
      console.warn('nextSequentialId failed, using local counter:', e.message);
      const key = prefix.toLowerCase().replace(/[^a-z]/g, '') || 'id';
      const { num, year } = ARS.Store.bumpCounter(key);
      return ARS.nextId(prefix, year, num);
    }
  },

  async listTechs() {
    if (!this._db) return [];
    const { collection, query, where, getDocs } = this._mods;
    try {
      const snap = await getDocs(query(collection(this._db, 'users'), where('role', '==', 'technician')));
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

  async purgeLegacyDemoData() {
    if (!this._callable || !ARS.Auth?.getUser?.()) return { purged: false, skipped: true };
    try {
      const user = ARS.Auth.getUser();
      if (user?.getIdToken) await user.getIdToken(true);
      const res = await this._callable('purgeLegacyDemoData')({});
      return res.data || { purged: false };
    } catch (e) {
      const code = e?.code || '';
      if (code !== 'functions/not-found') {
        console.warn('purgeLegacyDemoData unavailable:', code || e.message);
      }
      return { purged: false, skipped: true };
    }
  },

  destroy() {
    this._unsubs.forEach((fn) => { try { fn(); } catch (_) {} });
    this._unsubs = [];
    this._ready = false;
    this._hydrated = false;
    this._fullySynced = false;
  },
};
