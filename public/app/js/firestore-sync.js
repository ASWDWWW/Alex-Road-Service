/* Firestore sync — real-time listeners + write-through to cloud */
window.ARS = window.ARS || {};

const SYNC_COLLECTIONS = [
  'customers', 'trucks', 'workOrders', 'estimates', 'invoices',
  'payments', 'inventory', 'inventoryTransactions', 'contactSubmissions',
];

ARS.FirestoreSync = {
  _db: null,
  _fns: null,
  _unsubs: [],
  _pushTimer: null,
  _ready: false,
  _applyingRemote: false,

  isActive() {
    return this._ready && !!this._db;
  },

  async _loadModules() {
    const firestore = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const functions = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js');
    return { ...firestore, getFunctions: functions.getFunctions, httpsCallable: functions.httpsCallable };
  },

  async init() {
    if (!window.ARSFirebase?.configured || !window.ARSFirebase.db) return false;
    try {
      const mods = await this._loadModules();
      this._db = window.ARSFirebase.db;
      this._mods = mods;
      const { getFunctions, httpsCallable } = mods;
      this._fns = getFunctions(window.ARSFirebase.app, 'us-central1');
      this._callable = (name) => httpsCallable(this._fns, name);

      await this._pullSettings();
      const store = ARS.Store.load();
      if (!store.demoPurged && !store.demoPurgeSkipped) {
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
      }
      await this._startListeners();
      await this._startContactSubmissionsListener();
      this._startNotificationListener();

      ARS.Store.subscribe(() => this._schedulePush());
      this._ready = true;
      return true;
    } catch (e) {
      console.warn('Firestore sync unavailable:', e);
      return false;
    }
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

  async _startListeners() {
    const { collection, onSnapshot } = this._mods;
    for (const name of SYNC_COLLECTIONS) {
      const unsub = onSnapshot(collection(this._db, name), (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        this._applyRemoteCollection(name, items);
      }, (err) => console.warn(`Listener error (${name}):`, err));
      this._unsubs.push(unsub);
    }
  },

  async _startContactSubmissionsListener() {
    const { collection, onSnapshot } = this._mods;
    const unsub = onSnapshot(collection(this._db, 'contact_submissions'), (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      this._applyRemoteCollection('contactSubmissions', items);
    }, (err) => console.warn('Contact submissions listener error:', err));
    this._unsubs.push(unsub);
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
      this._applyRemoteCollection('notifications', items);
      document.dispatchEvent(new CustomEvent('ars:notifications-changed'));
    }, (err) => console.warn('Notification listener error:', err));
    this._unsubs.push(unsub);
  },

  _applyRemoteCollection(name, items) {
    this._applyingRemote = true;
    const s = ARS.Store.load();
    s[name] = items;
    if (items.length) s.seeded = true;
    ARS.Store.save(s, { silent: true });
    this._applyingRemote = false;
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
    for (const name of SYNC_COLLECTIONS) {
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
      return res.data.id;
    } catch (e) {
      console.warn('nextSequentialId failed, using local counter:', e.message);
      const key = prefix.toLowerCase().replace(/[^a-z]/g, '') || 'id';
      const { num, year } = ARS.Store.bumpCounter(key);
      return ARS.nextId(prefix, year, num);
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

  async listTechs() {
    if (!this._db) return [];
    const { collection, query, where, getDocs } = this._mods;
    try {
      const snap = await getDocs(query(collection(this._db, 'users'), where('role', '==', 'technician')));
      return snap.docs
        .map((d) => ({ uid: d.id, ...d.data() }))
        .filter((u) => u.active !== false)
        .map((u) => u.name || u.email);
    } catch {
      return [];
    }
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

  async markNotificationRead(id) {
    if (!this._db) return;
    const uid = ARS.Auth?.getUser?.()?.uid;
    if (!uid) return;
    const { doc, updateDoc } = this._mods;
    try {
      await updateDoc(doc(this._db, 'notifications', id), { read: true, readAt: new Date().toISOString() });
    } catch (e) {
      console.warn('markNotificationRead failed:', e.message);
    }
  },

  destroy() {
    this._unsubs.forEach((fn) => fn());
    this._unsubs = [];
    this._ready = false;
  },
};
