/* Alex Road Service — Firebase Authentication + demo sandbox login */
window.ARS = window.ARS || {};

const SESSION_KEY = 'ars_session';
const AUTH_MODULE = 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

function demoUser() {
  return {
    uid: 'demo_user',
    email: ARS.Demo?.EMAIL || 'demo@alexroadservice.com',
    name: 'Demo User',
    role: 'demo',
    photoURL: '',
  };
}

ARS.Auth = {
  _user: null,
  _initPromise: null,
  _ready: false,

  _isDemoSession() {
    return ARS.isDemoMode?.();
  },

  _isDemoCredentials(email, password) {
    return ARS.Demo?.isCredential?.(email, password) || false;
  },

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
    if (this._isDemoSession()) {
      this._user = demoUser();
      this._writeSessionCache(this._user);
      this._ready = true;
      return;
    }

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
            if (!this._isDemoSession()) this._clearLocalSession();
          }
        } else if (!this._isDemoSession()) {
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
    if (role === 'demo') {
      ARS.markDemoSession?.();
      ARS.Demo?.getState?.();
      this._user = demoUser();
      this._writeSessionCache(this._user);
      return this._user;
    }
    const profile = await window.ARSFirebase.getUserProfile?.(firebaseUser.uid);
    this._user = {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      name: profile?.name || firebaseUser.displayName || firebaseUser.email,
      role,
      photoURL: profile?.photoURL || '',
      phone: profile?.phone || '',
      jobTitle: profile?.jobTitle || '',
      hireDate: profile?.hireDate || '',
      department: profile?.department || '',
      status: profile?.status || 'Active',
      employmentType: profile?.employmentType || '',
      schedule: profile?.schedule || null,
      emergencyContact: profile?.emergencyContact || { name: '', phone: '' },
      address: profile?.address || '',
      certifications: profile?.certifications || [],
    };
    this._writeSessionCache(this._user);
    return this._user;
  },

  async setPhotoURL(url) {
    if (!this._user) return;
    this._user = { ...this._user, photoURL: url || '' };
    this._writeSessionCache(this._user);
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
    ARS.clearDemoSession?.();
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

  async _startDemoSession() {
    if (!window.ARS?.Demo?.resetAndSeed) {
      throw new Error('Demo mode is unavailable. Reload the page and try again.');
    }
    await this._signOutFirebase();
    ARS.markDemoSession?.();
    ARS.Demo.seedForLogin();
    this._user = demoUser();
    this._writeSessionCache(this._user);
    this._ready = true;
    return this._user;
  },

  getUser() {
    return this._user;
  },

  getRole() {
    return this._user?.role || null;
  },

  isLoggedIn() {
    if (this._isDemoSession() && this._user) return true;
    return !!this._user && !!window.ARSFirebase?.auth?.currentUser;
  },

  async validateSession() {
    await this.init();
    if (this._isDemoSession()) {
      this._user = demoUser();
      this._writeSessionCache(this._user);
      ARS.Demo?.getState?.();
      return this._user;
    }
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
    if (this._isDemoCredentials(email, password)) {
      localStorage.removeItem(SESSION_KEY);
      return this._startDemoSession();
    }

    ARS.clearDemoSession?.();
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
    if (this._isDemoSession()) {
      this._clearLocalSession();
      return;
    }
    await this._signOutFirebase();
    this._clearLocalSession();
  },

  async resetPassword(email) {
    if (String(email || '').trim().toLowerCase() === ARS.Demo?.EMAIL) {
      throw new Error('Demo account has no password reset. Use the demo sign-in button.');
    }
    await this._waitForFirebase();
    const { sendPasswordResetEmail } = await import(AUTH_MODULE);
    await sendPasswordResetEmail(window.ARSFirebase.auth, email.trim());
  },

  async requireAuth() {
    await this.init();
    if (this._isDemoSession()) {
      if (!this._user) this._user = demoUser();
      return true;
    }

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
