/* Alex Road Service — Firebase Configuration */
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyCUkj9Np2l-jiT1D0dxAxQBp9jxn1KbSFg",
  authDomain:        "launchpage-alex-roadservice.firebaseapp.com",
  projectId:         "launchpage-alex-roadservice",
  storageBucket:     "launchpage-alex-roadservice.firebasestorage.app",
  messagingSenderId: "350488747448",
  appId:             "1:350488747448:web:e5e7d9f48a62627058c34d",
  measurementId:     "G-743F7YVS18",
  appCheckSiteKey:   "6LeQM14tAAAAAC0ZPwX6wHbCvOvBkgi60SMFb0OB",
};

const FB_VERSION = '10.7.1';

window.ARSFirebase = window.ARSFirebase || { configured: false };

function isFirebaseConfigured() {
  return FIREBASE_CONFIG.projectId && !FIREBASE_CONFIG.projectId.includes('YOUR_');
}

function isOpsAppPath() {
  return typeof location !== 'undefined' && location.pathname.startsWith('/app');
}

function loadGoogleAnalytics(measurementId) {
  if (!measurementId || window.gtag) return;
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', measurementId, { send_page_view: true });
}

async function initFirebase() {
  if (!isFirebaseConfigured()) return null;
  try {
    const ops = isOpsAppPath();
    const [{ initializeApp }, firestoreMod, { getAuth }, storageMod, functionsMod] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-firestore.js`),
      import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-storage.js`),
      import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-functions.js`),
    ]);

    const { getFirestore, collection, addDoc, doc, getDoc } = firestoreMod;
    const { getStorage } = storageMod;
    const app = initializeApp(FIREBASE_CONFIG);
    let appCheck = null;
    if (FIREBASE_CONFIG.appCheckSiteKey) {
      const { initializeAppCheck, ReCaptchaEnterpriseProvider } = await import(
        `https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-app-check.js`
      );
      appCheck = initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(FIREBASE_CONFIG.appCheckSiteKey),
        isTokenAutoRefreshEnabled: true,
      });
    }
    const db = getFirestore(app);
    const auth = getAuth(app);
    const storage = getStorage(app);
    const functions = functionsMod.getFunctions(app, 'us-central1');

    let analytics = null;
    // Skip Analytics on ops pages — saves a network round-trip on every navigation
    if (!ops) {
      loadGoogleAnalytics(FIREBASE_CONFIG.measurementId);
      try {
        const { getAnalytics, isSupported } = await import(
          `https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-analytics.js`
        );
        if (await isSupported()) analytics = getAnalytics(app);
      } catch (_) {}
    }

    window.ARSFirebase = {
      configured: true,
      app, appCheck, db, auth, storage, functions, analytics,
      _mods: {
        firestore: firestoreMod,
        storage: storageMod,
        getFunctions: functionsMod.getFunctions,
        httpsCallable: functionsMod.httpsCallable,
      },
      async getUserProfile(uid) {
        const snap = await getDoc(doc(db, 'users', uid));
        return snap.exists() ? snap.data() : null;
      },
      async updateUserProfile(uid, patch) {
        const { setDoc } = firestoreMod;
        await setDoc(doc(db, 'users', uid), { ...patch, updatedAt: new Date().toISOString() }, { merge: true });
      },
      /** Send Firebase Auth password-reset email (uses project email template) */
      async sendPasswordResetEmail(email) {
        const { sendPasswordResetEmail } = await import(
          `https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-auth.js`
        );
        await sendPasswordResetEmail(auth, String(email).trim().toLowerCase());
      },
    };
    return window.ARSFirebase;
  } catch (err) {
    console.warn('Firebase init failed:', err);
    return null;
  }
}

window.submitContactForm = async (formData) => {
  const media = Array.isArray(formData.media) ? formData.media : [];
  const payload = { ...formData };
  delete payload.media;
  if (window.ARSFirebase?.configured && window.ARSFirebase.functions) {
    const submitContact = window.ARSFirebase._mods.httpsCallable(
      window.ARSFirebase.functions,
      'submitContact',
    );
    const result = await submitContact({ ...payload, media });
    return result.data;
  }
  throw new Error('Online request service is unavailable. Please call the shop directly.');
};

initFirebase();
