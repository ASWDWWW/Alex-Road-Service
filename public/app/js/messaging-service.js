/* Secure internal messaging — E2EE DMs, groups, shop channel */
window.ARS = window.ARS || {};

const SHOP_ID = 'shop_all_staff';

ARS.Messaging = {
  _ready: false,
  _uid: null,
  _identity: null,
  _roster: [],
  _conversations: [],
  _convoUnsub: null,
  _msgUnsub: null,
  _activeConvoId: null,
  _convoKeys: {}, // id -> CryptoKey
  _listenersBound: false,

  isDemo() {
    return !!ARS.isDemoMode?.();
  },

  async init() {
    const user = ARS.Auth?.getUser?.();
    if (!user?.uid && !this.isDemo()) return false;
    this._uid = user?.uid || 'demo_user';
    if (this.isDemo()) {
      this._ensureDemoState();
      this._identity = await ARS.MsgCrypto.ensureIdentity(this._uid);
      this._ready = true;
      this._emit();
      return true;
    }

    await this._waitFirebase();
    this._identity = await ARS.MsgCrypto.ensureIdentity(this._uid);
    try {
      await ARS.FirestoreSync.ensureMessaging?.();
    } catch (e) {
      console.warn('ensureMessaging:', e.message);
    }
    await this._publishPublicKey();
    await this._loadRoster();
    this._listenConversations();
    this._ready = true;
    this._emit();
    return true;
  },

  async _waitFirebase(maxMs = 5000) {
    const step = 50;
    let n = 0;
    const max = Math.ceil(maxMs / step);
    while (n++ < max) {
      if (window.ARSFirebase?.db && window.ARSFirebase?.auth) return;
      await new Promise((r) => setTimeout(r, step));
    }
  },

  async _mods() {
    const cached = window.ARSFirebase?._mods?.firestore;
    if (cached) return cached;
    const v = '10.7.1';
    return import(`https://www.gstatic.com/firebasejs/${v}/firebase-firestore.js`);
  },

  async _publishPublicKey() {
    const jwk = this._identity.publicJwk;
    const now = new Date().toISOString();
    try {
      await ARS.FirestoreSync.updateEmployee?.(this._uid, {
        messagingPublicKey: jwk,
        messagingKeyUpdatedAt: now,
      });
    } catch (_) {
      /* self-update may fail for some roles — write roster directly */
    }
    try {
      const { doc, setDoc } = await this._mods();
      const db = window.ARSFirebase.db;
      await setDoc(doc(db, 'messagingRoster', this._uid), {
        uid: this._uid,
        messagingPublicKey: jwk,
        messagingKeyUpdatedAt: now,
        updatedAt: now,
        name: this.myName(),
      }, { merge: true });
    } catch (e) {
      console.warn('publish public key:', e.message);
    }
  },

  async _loadRoster() {
    if (this.isDemo()) {
      this._roster = (ARS.Data.listEmployees?.() || [])
        .filter((e) => e.status !== 'Archived' && e.status !== 'Terminated')
        .map((e) => ({
          uid: e.uid,
          name: e.name,
          email: e.email,
          role: e.role,
          jobTitle: e.jobTitle || '',
          active: true,
          messagingPublicKey: e.messagingPublicKey || null,
        }));
      return;
    }
    const { collection, getDocs } = await this._mods();
    const snap = await getDocs(collection(window.ARSFirebase.db, 'messagingRoster'));
    this._roster = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .filter((r) => r.active !== false);
  },

  getRoster() {
    return this._roster.filter((r) => r.uid !== this._uid && r.active !== false);
  },

  getAllRoster() {
    return this._roster.slice();
  },

  /** Prefer employee/profile name — never show email as the primary label */
  _looksLikeEmail(s) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
  },

  myName() {
    const u = ARS.Auth?.getUser?.();
    const fromRoster = this._roster.find((r) => r.uid === this._uid)?.name;
    const candidates = [fromRoster, u?.name, u?.displayName];
    for (const c of candidates) {
      const t = String(c || '').trim();
      if (t && !this._looksLikeEmail(t)) return t;
    }
    return 'Me';
  },

  staffName(uid, fallback = 'Staff') {
    if (!uid) return fallback;
    if (uid === this._uid) return this.myName();
    const fromRoster = this._roster.find((r) => r.uid === uid)?.name;
    const fromEmployees = ARS.Data?.getEmployee?.(uid)?.name;
    for (const c of [fromRoster, fromEmployees]) {
      const t = String(c || '').trim();
      if (t && !this._looksLikeEmail(t)) return t;
    }
    return fallback;
  },

  labelFromRoster(entry) {
    if (!entry) return 'Staff';
    const t = String(entry.name || '').trim();
    if (t && !this._looksLikeEmail(t)) return t;
    return this.staffName(entry.uid, 'Staff');
  },

  getConversations() {
    return this._conversations.slice().sort((a, b) => {
      const ta = new Date(a.lastMessageAt || a.updatedAt || 0).getTime();
      const tb = new Date(b.lastMessageAt || b.updatedAt || 0).getTime();
      return tb - ta;
    });
  },

  unreadCount() {
    return this.getConversations().filter((c) => this.isUnread(c)).length;
  },

  isUnread(convo) {
    if (!convo?.lastMessageAt) return false;
    if (convo.lastMessageBy === this._uid) return false;
    const readAt = convo.lastReadAt?.[this._uid];
    if (!readAt) return true;
    return new Date(convo.lastMessageAt).getTime() > new Date(readAt).getTime();
  },

  titleFor(convo) {
    if (!convo) return 'Messages';
    if (convo.type === 'shop') return convo.title || 'Shop Channel';
    if (convo.type === 'group') return convo.title || 'Group';
    const otherId = (convo.participantIds || []).find((id) => id !== this._uid);
    const stored = convo.participantNames?.[otherId];
    if (stored && !this._looksLikeEmail(stored)) return stored;
    return this.staffName(otherId, 'Direct message');
  },

  _listenConversations() {
    if (this.isDemo()) {
      this._conversations = ARS.Store.load().conversations || [];
      return;
    }
    if (this._convoUnsub) this._convoUnsub();
    this._mods().then((mod) => {
      const { collection, query, where, onSnapshot } = mod;
      const q = query(
        collection(window.ARSFirebase.db, 'conversations'),
        where('participantIds', 'array-contains', this._uid),
      );
      this._convoUnsub = onSnapshot(q, (snap) => {
        this._conversations = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            lastMessageAt: data.lastMessageAt?.toDate?.()?.toISOString?.() || data.lastMessageAt,
            createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt,
            updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || data.updatedAt,
          };
        });
        this._emit();
      }, (err) => console.warn('conversations listener:', err.message));
    });
  },

  _emit() {
    document.dispatchEvent(new CustomEvent('ars:messages-changed'));
  },

  async _getConversationKey(convo) {
    if (this._convoKeys[convo.id]) return this._convoKeys[convo.id];
    const wrapped = convo.wrappedKeys?.[this._uid];
    if (!wrapped?.ciphertext) return null;

    const wrapperId = wrapped.wrappedBy;
    let wrapperPub = null;
    if (wrapperId === this._uid) {
      wrapperPub = this._identity.publicJwk;
    } else {
      wrapperPub = this._roster.find((r) => r.uid === wrapperId)?.messagingPublicKey
        || convo.participantPublicKeys?.[wrapperId];
    }
    if (!wrapperPub) {
      // Try any peer public key — won't work unless wrappedBy matches; fetch roster refresh
      await this._loadRoster();
      wrapperPub = this._roster.find((r) => r.uid === wrapperId)?.messagingPublicKey;
    }
    if (!wrapperPub) throw new Error('Missing peer key to unlock this conversation');

    const key = await ARS.MsgCrypto.unwrapForMe(
      wrapped,
      this._identity.keyPair.privateKey,
      wrapperPub,
      convo.id,
    );
    this._convoKeys[convo.id] = key;
    return key;
  },

  async _ensureConversationKey(convo) {
    try {
      const existing = await this._getConversationKey(convo);
      if (existing) {
        await this._rewrapMissingParticipants(convo, existing);
        return existing;
      }
    } catch (e) {
      console.warn('unwrap failed:', e.message);
    }

    const hasAnyWrap = Object.values(convo.wrappedKeys || {}).some((w) => w?.ciphertext);
    if (hasAnyWrap) {
      throw new Error('Waiting for key share — ask a teammate who can read this chat to open it once.');
    }

    const key = await ARS.MsgCrypto.generateConversationKey();
    await this._writeWrappedKeys(convo, key);
    this._convoKeys[convo.id] = key;
    return key;
  },

  async _writeWrappedKeys(convo, conversationKey, onlyUids = null) {
    const targets = (convo.participantIds || []).filter((id) => !onlyUids || onlyUids.includes(id));
    const wrappedKeys = { ...(convo.wrappedKeys || {}) };
    const participantPublicKeys = { ...(convo.participantPublicKeys || {}) };
    participantPublicKeys[this._uid] = this._identity.publicJwk;

    for (const uid of targets) {
      let pub = uid === this._uid
        ? this._identity.publicJwk
        : (this._roster.find((r) => r.uid === uid)?.messagingPublicKey || participantPublicKeys[uid]);
      if (!pub) continue;
      participantPublicKeys[uid] = pub;
      const packet = await ARS.MsgCrypto.wrapConversationKey(
        conversationKey,
        this._identity.keyPair.privateKey,
        pub,
        convo.id,
      );
      wrappedKeys[uid] = { ...packet, wrappedBy: this._uid };
    }

    if (this.isDemo()) {
      const s = ARS.Store.load();
      const i = (s.conversations || []).findIndex((c) => c.id === convo.id);
      if (i >= 0) {
        s.conversations[i] = { ...s.conversations[i], wrappedKeys, participantPublicKeys, e2ee: true };
        ARS.Store.save(s);
        this._conversations = s.conversations;
      }
      return;
    }

    const { doc, updateDoc } = await this._mods();
    await updateDoc(doc(window.ARSFirebase.db, 'conversations', convo.id), {
      wrappedKeys,
      participantPublicKeys,
      e2ee: true,
      updatedAt: new Date().toISOString(),
    });
    Object.assign(convo, { wrappedKeys, participantPublicKeys, e2ee: true });
  },

  async _rewrapMissingParticipants(convo, conversationKey) {
    const missing = (convo.participantIds || []).filter((uid) => !convo.wrappedKeys?.[uid]?.ciphertext);
    if (!missing.length) return;
    await this._writeWrappedKeys(convo, conversationKey, missing);
  },

  dmKey(a, b) {
    return [a, b].sort().join('_');
  },

  async openOrCreateDm(otherUid) {
    if (!otherUid || otherUid === this._uid) throw new Error('Invalid recipient');
    const key = this.dmKey(this._uid, otherUid);
    const id = `dm_${key}`;

    let existing = this._conversations.find((c) => c.type === 'dm' && (c.dmKey === key || c.id === id));
    if (existing) return existing;

    if (this.isDemo()) {
      const other = this._roster.find((r) => r.uid === otherUid);
      const convo = {
        id,
        type: 'dm',
        dmKey: key,
        participantIds: [this._uid, otherUid].sort(),
        participantNames: {
          [this._uid]: this.myName(),
          [otherUid]: other?.name && !this._looksLikeEmail(other.name) ? other.name : 'Teammate',
        },
        createdBy: this._uid,
        createdAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString(),
        lastMessagePreview: '',
        lastMessageBy: '',
        wrappedKeys: {},
        lastReadAt: {},
        e2ee: true,
      };
      const s = ARS.Store.load();
      s.conversations = [...(s.conversations || []).filter((c) => c.id !== id), convo];
      s.messages = s.messages || {};
      s.messages[convo.id] = s.messages[convo.id] || [];
      ARS.Store.save(s);
      this._conversations = s.conversations;
      await this._ensureConversationKey(convo);
      this._emit();
      return convo;
    }

    const { doc, getDoc, setDoc } = await this._mods();
    const db = window.ARSFirebase.db;
    const ref = doc(db, 'conversations', id);

    // Deterministic id — getDoc is allowed for missing docs; avoids illegal dmKey list queries
    const prior = await getDoc(ref);
    if (prior.exists()) {
      const data = { id: prior.id, ...prior.data() };
      if (!(data.participantIds || []).includes(this._uid)) {
        throw new Error('Permission denied for this conversation');
      }
      return data;
    }

    await this._loadRoster();
    const other = this._roster.find((r) => r.uid === otherUid);
    if (!other) throw new Error('Recipient not found in staff directory');

    const convo = {
      id,
      type: 'dm',
      dmKey: key,
      participantIds: [this._uid, otherUid].sort(),
      participantNames: {
        [this._uid]: this.myName(),
        [otherUid]: this.labelFromRoster(other),
      },
      createdBy: this._uid,
      createdAt: new Date().toISOString(),
      lastMessageAt: new Date().toISOString(),
      lastMessagePreview: '',
      lastMessageBy: '',
      wrappedKeys: {},
      participantPublicKeys: {
        [this._uid]: this._identity.publicJwk,
      },
      lastReadAt: {},
      e2ee: true,
    };
    if (other.messagingPublicKey) {
      convo.participantPublicKeys[otherUid] = other.messagingPublicKey;
    }
    await setDoc(ref, convo);
    await this._ensureConversationKey(convo);
    return convo;
  },

  async createGroup(title, memberUids) {
    const groupTitle = String(title || '').trim();
    if (!groupTitle) throw new Error('Group title is required');
    if (groupTitle.length > 60) throw new Error('Group title must be 60 characters or less');
    const ids = Array.from(new Set([this._uid, ...memberUids])).filter(Boolean);
    if (ids.length < 2) throw new Error('Pick at least one teammate');
    await this._loadRoster();
    const names = {};
    const pubs = {};
    ids.forEach((uid) => {
      if (uid === this._uid) {
        names[uid] = this.myName();
        pubs[uid] = this._identity.publicJwk;
      } else {
        const r = this._roster.find((x) => x.uid === uid);
        names[uid] = this.labelFromRoster(r) || this.staffName(uid);
        if (r?.messagingPublicKey) pubs[uid] = r.messagingPublicKey;
      }
    });

    if (this.isDemo()) {
      const convo = {
        id: 'grp_' + Date.now().toString(36),
        type: 'group',
        title: groupTitle,
        participantIds: ids.sort(),
        participantNames: names,
        participantPublicKeys: pubs,
        createdBy: this._uid,
        createdAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString(),
        lastMessagePreview: '',
        lastMessageBy: '',
        wrappedKeys: {},
        lastReadAt: {},
        e2ee: true,
      };
      const s = ARS.Store.load();
      s.conversations = [...(s.conversations || []), convo];
      s.messages = s.messages || {};
      s.messages[convo.id] = [];
      ARS.Store.save(s);
      this._conversations = s.conversations;
      await this._ensureConversationKey(convo);
      this._emit();
      return convo;
    }

    const { collection, doc, setDoc } = await this._mods();
    const db = window.ARSFirebase.db;
    const id = doc(collection(db, 'conversations')).id;
    const convo = {
      id,
      type: 'group',
      title: groupTitle,
      participantIds: ids.sort(),
      participantNames: names,
      participantPublicKeys: pubs,
      createdBy: this._uid,
      createdAt: new Date().toISOString(),
      lastMessageAt: new Date().toISOString(),
      lastMessagePreview: '',
      lastMessageBy: '',
      wrappedKeys: {},
      lastReadAt: {},
      e2ee: true,
    };
    await setDoc(doc(db, 'conversations', id), convo);
    await this._ensureConversationKey(convo);
    return convo;
  },

  async renameGroup(convoId, title) {
    const groupTitle = String(title || '').trim();
    if (!groupTitle) throw new Error('Group title is required');
    if (groupTitle.length > 60) throw new Error('Group title must be 60 characters or less');
    const convo = this._conversations.find((c) => c.id === convoId);
    if (!convo) throw new Error('Conversation not found');
    if (convo.type !== 'group') throw new Error('Only group chats can be renamed');

    if (this.isDemo()) {
      const s = ARS.Store.load();
      const i = (s.conversations || []).findIndex((c) => c.id === convoId);
      if (i < 0) throw new Error('Conversation not found');
      s.conversations[i] = { ...s.conversations[i], title: groupTitle, updatedAt: new Date().toISOString() };
      ARS.Store.save(s);
      this._conversations = s.conversations;
      this._emit();
      return s.conversations[i];
    }

    const { doc, updateDoc } = await this._mods();
    await updateDoc(doc(window.ARSFirebase.db, 'conversations', convoId), {
      title: groupTitle,
      updatedAt: new Date().toISOString(),
    });
    convo.title = groupTitle;
    this._emit();
    return convo;
  },

  listenMessages(convoId, onMessages) {
    this._activeConvoId = convoId;
    if (this._msgUnsub) {
      this._msgUnsub();
      this._msgUnsub = null;
    }

    if (this.isDemo()) {
      const render = async () => {
        const s = ARS.Store.load();
        const rows = (s.messages?.[convoId] || []).slice().sort((a, b) =>
          new Date(a.createdAt) - new Date(b.createdAt));
        const convo = this._conversations.find((c) => c.id === convoId);
        const decoded = await this._decodeMessages(convo, rows);
        onMessages(decoded);
      };
      render();
      const handler = () => { if (this._activeConvoId === convoId) render(); };
      document.addEventListener('ars:messages-changed', handler);
      this._msgUnsub = () => document.removeEventListener('ars:messages-changed', handler);
      return;
    }

    this._mods().then((mod) => {
      const { collection, query, orderBy, limit, onSnapshot } = mod;
      const q = query(
        collection(window.ARSFirebase.db, 'conversations', convoId, 'messages'),
        orderBy('createdAt', 'asc'),
        limit(200),
      );
      this._msgUnsub = onSnapshot(q, async (snap) => {
        const rows = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            createdAt: data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt,
          };
        });
        const convo = this._conversations.find((c) => c.id === convoId)
          || { id: convoId, wrappedKeys: {}, participantIds: [] };
        // Refresh convo meta for keys
        try {
          const { doc, getDoc } = mod;
          const fresh = await getDoc(doc(window.ARSFirebase.db, 'conversations', convoId));
          if (fresh.exists()) Object.assign(convo, { id: fresh.id, ...fresh.data() });
        } catch (_) { /* use cache */ }
        const decoded = await this._decodeMessages(convo, rows);
        onMessages(decoded);
      }, (err) => console.warn('messages listener:', err.message));
    });
  },

  async _decodeMessages(convo, rows) {
    let key = null;
    try {
      key = await this._ensureConversationKey(convo);
    } catch (e) {
      console.warn(e.message);
    }
    const out = [];
    for (const m of rows) {
      if (m.deleted) {
        out.push({ ...m, text: '(message removed)', decrypted: true });
        continue;
      }
      if (!key) {
        out.push({ ...m, text: '[Unable to decrypt — missing keys on this device]', decrypted: false });
        continue;
      }
      try {
        const text = await ARS.MsgCrypto.decryptText(key, m);
        out.push({ ...m, text, decrypted: true });
      } catch {
        out.push({ ...m, text: '[Encrypted message — cannot decrypt]', decrypted: false });
      }
    }
    return out;
  },

  async sendMessage(convoId, text, attachmentMeta = null) {
    const body = String(text || '').trim();
    if (!body && !attachmentMeta) throw new Error('Message is empty');
    let convo = this._conversations.find((c) => c.id === convoId);
    if (!convo && !this.isDemo()) {
      const { doc, getDoc } = await this._mods();
      const snap = await getDoc(doc(window.ARSFirebase.db, 'conversations', convoId));
      if (!snap.exists()) throw new Error('Conversation not found');
      convo = { id: snap.id, ...snap.data() };
    }
    if (!convo) throw new Error('Conversation not found');

    const key = await this._ensureConversationKey(convo);
    const packet = await ARS.MsgCrypto.encryptText(key, body || (attachmentMeta ? '📎 Attachment' : ''));
    const preview = body ? (body.length > 80 ? body.slice(0, 80) + '…' : body) : 'Attachment';
    const msg = {
      senderId: this._uid,
      senderName: this.myName(),
      ciphertext: packet.ciphertext,
      iv: packet.iv,
      createdAt: new Date().toISOString(),
      attachment: attachmentMeta || null,
    };

    if (this.isDemo()) {
      const s = ARS.Store.load();
      s.messages = s.messages || {};
      s.messages[convoId] = [...(s.messages[convoId] || []), { id: 'm_' + Date.now(), ...msg }];
      const i = (s.conversations || []).findIndex((c) => c.id === convoId);
      if (i >= 0) {
        s.conversations[i] = {
          ...s.conversations[i],
          lastMessageAt: msg.createdAt,
          lastMessagePreview: preview,
          lastMessageBy: this._uid,
        };
      }
      ARS.Store.save(s);
      this._conversations = s.conversations;
      this._emit();
      return msg;
    }

    const { collection, addDoc, doc, updateDoc } = await this._mods();
    const db = window.ARSFirebase.db;
    await addDoc(collection(db, 'conversations', convoId, 'messages'), msg);
    await updateDoc(doc(db, 'conversations', convoId), {
      lastMessageAt: msg.createdAt,
      lastMessagePreview: preview,
      lastMessageBy: this._uid,
      updatedAt: msg.createdAt,
    });
    return msg;
  },

  async markRead(convoId) {
    const now = new Date().toISOString();
    if (this.isDemo()) {
      const s = ARS.Store.load();
      const i = (s.conversations || []).findIndex((c) => c.id === convoId);
      if (i >= 0) {
        const lastReadAt = { ...(s.conversations[i].lastReadAt || {}), [this._uid]: now };
        s.conversations[i] = { ...s.conversations[i], lastReadAt };
        ARS.Store.save(s);
        this._conversations = s.conversations;
        this._emit();
      }
      return;
    }
    const { doc, updateDoc } = await this._mods();
    await updateDoc(doc(window.ARSFirebase.db, 'conversations', convoId), {
      [`lastReadAt.${this._uid}`]: now,
    });
  },

  async uploadAttachment(convoId, file) {
    if (!file) return null;
    if (this.isDemo()) {
      return { name: file.name, contentType: file.type, size: file.size, demo: true };
    }
    const storage = window.ARSFirebase?.storage;
    if (!storage) throw new Error('Storage unavailable');
    const v = '10.7.1';
    const { ref, uploadBytes, getDownloadURL } = await import(
      `https://www.gstatic.com/firebasejs/${v}/firebase-storage.js`
    );
    const safe = String(file.name || 'file').replace(/[^\w.\-]+/g, '_').slice(0, 80);
    const path = `media/messages/${convoId}/${Date.now()}_${safe}`;
    const r = ref(storage, path);
    await uploadBytes(r, file, { contentType: file.type || 'application/octet-stream' });
    const url = await getDownloadURL(r);
    return { name: file.name, contentType: file.type, size: file.size, path, url };
  },

  _ensureDemoState() {
    const s = ARS.Store.load();
    if (!s.conversations) {
      s.conversations = [];
      s.messages = {};
      ARS.Store.save(s);
    }
  },

  destroy() {
    if (this._convoUnsub) this._convoUnsub();
    if (this._msgUnsub) this._msgUnsub();
    this._convoUnsub = null;
    this._msgUnsub = null;
  },
};
