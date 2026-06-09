/* Alex Road Service — Firebase Authentication (production only) */
window.ARS = window.ARS || {};

const SESSION_KEY = 'ars_session';
const AUTH_MODULE = 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

ARS.Auth = {
  _user: null,
  _initPromise: null,
  _ready: false,

  async _waitForFirebase() {
    let attempts = 0;
    while (!window.ARSFirebase?.auth && attempts < 50) {
      await new Promise((r) => setTimeout(r, 100));
      attempts += 1;
    }
    if (!window.ARSFirebase?.configured || !window.ARSFirebase?.auth) {
      throw new Error('Firebase Authentication is not configured. Contact your administrator.');
    }
  },

  async init() {
    if (this._initPromise) return this._initPromise;
    this._initPromise = this._doInit();
    return this._initPromise;
  },

  async _doInit() {
    await this._waitForFirebase();
    const { onAuthStateChanged } = await import(AUTH_MODULE);
    return new Promise((resolve) => {
      let settled = false;
      onAuthStateChanged(window.ARSFirebase.auth, async (firebaseUser) => {
        if (firebaseUser) {
          try {
            await this._syncFromFirebaseUser(firebaseUser);
          } catch {
            await this._signOutFirebase();
            this._clearLocalSession();
          }
        } else {
          this._clearLocalSession();
        }
        this._ready = true;
        if (!settled) {
          settled = true;
          resolve();
        }
      });
    });
  },

  async _syncFromFirebaseUser(firebaseUser) {
    await firebaseUser.getIdToken(true);
    const token = await firebaseUser.getIdTokenResult(true);
    const role = token.claims.role;
    if (!role) {
      throw new Error('Account has no assigned role. Contact your administrator.');
    }
    const profile = await window.ARSFirebase.getUserProfile?.(firebaseUser.uid);
    this._user = {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      name: profile?.name || firebaseUser.displayName || firebaseUser.email,
      role,
    };
    this._writeSessionCache(this._user);
    return this._user;
  },

  _writeSessionCache(user) {
    const data = JSON.stringify(user);
    sessionStorage.setItem(SESSION_KEY, data);
    sessionStorage.setItem('appLoggedIn', '1');
    sessionStorage.setItem('appUser', JSON.stringify({
      name: user.name,
      role: ARS.ROLE_LABELS[user.role] || user.role,
    }));
  },

  _clearLocalSession() {
    this._user = null;
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem('appLoggedIn');
    sessionStorage.removeItem('appUser');
    localStorage.removeItem(SESSION_KEY);
  },

  async _signOutFirebase() {
    try {
      const { signOut } = await import(AUTH_MODULE);
      await signOut(window.ARSFirebase.auth);
    } catch { /* ignore */ }
  },

  getUser() {
    return this._user;
  },

  getRole() {
    return this._user?.role || null;
  },

  isLoggedIn() {
    return !!this._user && !!window.ARSFirebase?.auth?.currentUser;
  },

  async validateSession() {
    await this.init();
    const fbUser = window.ARSFirebase.auth.currentUser;
    if (!fbUser) {
      this._clearLocalSession();
      return null;
    }
    try {
      return await this._syncFromFirebaseUser(fbUser);
    } catch {
      await this.logout();
      return null;
    }
  },

  async login(email, password, remember = false) {
    await this._waitForFirebase();
    const em = email.trim().toLowerCase();
    const { signInWithEmailAndPassword } = await import(AUTH_MODULE);
    try {
      const cred = await signInWithEmailAndPassword(window.ARSFirebase.auth, em, password);
      const user = await this._syncFromFirebaseUser(cred.user);
      if (remember) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(SESSION_KEY);
      }
      return user;
    } catch (err) {
      const code = err?.code || '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        throw new Error('Invalid email or password.');
      }
      if (code === 'auth/too-many-requests') {
        throw new Error('Too many attempts. Try again later or reset your password.');
      }
      throw new Error(err.message || 'Sign in failed.');
    }
  },

  async logout() {
    await this._signOutFirebase();
    this._clearLocalSession();
  },

  async resetPassword(email) {
    await this._waitForFirebase();
    const { sendPasswordResetEmail } = await import(AUTH_MODULE);
    await sendPasswordResetEmail(window.ARSFirebase.auth, email.trim());
  },

  async requireAuth() {
    if (!window.ARSFirebase?.configured) {
      window.location.href = '/login.html?error=firebase';
      return false;
    }
    const user = await this.validateSession();
    if (!user) {
      window.location.href = '/login.html';
      return false;
    }
    return true;
  },

  displayRole() {
    const r = this.getRole();
    return ARS.ROLE_LABELS[r] || r || 'Staff';
  },
};
