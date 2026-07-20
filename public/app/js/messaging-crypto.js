/* End-to-end messaging crypto — ECDH P-256 + AES-GCM conversation keys */
window.ARS = window.ARS || {};

const MSG_PRIV_PREFIX = 'ars_msg_priv_v1_';
const WRAP_INFO = 'ars-msg-wrap-v1';
const MSG_INFO = 'ars-msg-body-v1';

function b64encode(buf) {
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
  let s = '';
  bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s);
}

function b64decode(str) {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

ARS.MsgCrypto = {
  async generateKeyPair() {
    return crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits'],
    );
  },

  async exportPublicJwk(publicKey) {
    return crypto.subtle.exportKey('jwk', publicKey);
  },

  async exportPrivateJwk(privateKey) {
    return crypto.subtle.exportKey('jwk', privateKey);
  },

  async importPublicJwk(jwk) {
    return crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
  },

  async importPrivateJwk(jwk) {
    return crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  },

  storageKey(uid) {
    return MSG_PRIV_PREFIX + uid;
  },

  loadPrivateJwk(uid) {
    try {
      const raw = localStorage.getItem(this.storageKey(uid));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  savePrivateJwk(uid, jwk) {
    localStorage.setItem(this.storageKey(uid), JSON.stringify(jwk));
  },

  async ensureIdentity(uid) {
    let privJwk = this.loadPrivateJwk(uid);
    let keyPair;
    if (privJwk) {
      const privateKey = await this.importPrivateJwk(privJwk);
      const publicKey = await crypto.subtle.importKey(
        'jwk',
        { kty: privJwk.kty, crv: privJwk.crv, x: privJwk.x, y: privJwk.y, ext: true },
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        [],
      );
      keyPair = { privateKey, publicKey };
    } else {
      keyPair = await this.generateKeyPair();
      privJwk = await this.exportPrivateJwk(keyPair.privateKey);
      this.savePrivateJwk(uid, privJwk);
    }
    const publicJwk = await this.exportPublicJwk(keyPair.publicKey);
    return { keyPair, publicJwk, privateJwk: privJwk };
  },

  async deriveWrapKey(privateKey, theirPublicJwk, conversationId) {
    const theirKey = await this.importPublicJwk(theirPublicJwk);
    const bits = await crypto.subtle.deriveBits(
      { name: 'ECDH', public: theirKey },
      privateKey,
      256,
    );
    const baseKey = await crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
    const salt = new TextEncoder().encode(String(conversationId));
    return crypto.subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt, info: new TextEncoder().encode(WRAP_INFO) },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
  },

  async generateConversationKey() {
    return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  },

  async exportRawKey(key) {
    return crypto.subtle.exportKey('raw', key);
  },

  async importRawKey(raw) {
    return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  },

  async wrapConversationKey(conversationKey, myPrivateKey, theirPublicJwk, conversationId) {
    const wrapKey = await this.deriveWrapKey(myPrivateKey, theirPublicJwk, conversationId);
    const raw = await this.exportRawKey(conversationKey);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, wrapKey, raw);
    return { iv: b64encode(iv), ciphertext: b64encode(cipher) };
  },

  async unwrapConversationKey(wrapped, myPrivateKey, theirPublicJwk, conversationId) {
    const wrapKey = await this.deriveWrapKey(myPrivateKey, theirPublicJwk, conversationId);
    const raw = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(b64decode(wrapped.iv)) },
      wrapKey,
      b64decode(wrapped.ciphertext),
    );
    return this.importRawKey(raw);
  },

  /**
   * Unwrap using any peer whose wrap was created with our identity.
   * Wraps are always produced as: encrypt(convKey) under ECDH(me, them).
   * To unwrap my blob, I need the public key of whoever wrapped for me.
   * We store wrappedKeys[uid] = { iv, ciphertext, wrappedBy }.
   */
  async unwrapForMe(wrappedEntry, myPrivateKey, wrapperPublicJwk, conversationId) {
    return this.unwrapConversationKey(wrappedEntry, myPrivateKey, wrapperPublicJwk, conversationId);
  },

  async encryptText(conversationKey, plaintext) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    // Bind AAD so ciphertext can't be moved across conversations silently
    const aad = new TextEncoder().encode(MSG_INFO);
    const cipher = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, additionalData: aad },
      conversationKey,
      encoded,
    );
    return { iv: b64encode(iv), ciphertext: b64encode(cipher) };
  },

  async decryptText(conversationKey, packet) {
    const aad = new TextEncoder().encode(MSG_INFO);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(b64decode(packet.iv)), additionalData: aad },
      conversationKey,
      b64decode(packet.ciphertext),
    );
    return new TextDecoder().decode(plain);
  },
};
