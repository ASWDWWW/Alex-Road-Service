/* Alex Road Service — Firebase Configuration */
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyCUkj9Np2l-jiT1D0dxAxQBp9jxn1KbSFg",
  authDomain:        "launchpage-alex-roadservice.firebaseapp.com",
  projectId:         "launchpage-alex-roadservice",
  storageBucket:     "launchpage-alex-roadservice.firebasestorage.app",
  messagingSenderId: "350488747448",
  appId:             "1:350488747448:web:e5e7d9f48a62627058c34d",
  measurementId:     "G-743F7YVS18",
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
    const [{ initializeApp }, firestoreMod, { getAuth }, storageMod] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-firestore.js`),
      import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-storage.js`),
    ]);

    const { getFirestore, collection, addDoc, doc, getDoc } = firestoreMod;
    const { getStorage } = storageMod;
    const app = initializeApp(FIREBASE_CONFIG);
    const db = getFirestore(app);
    const auth = getAuth(app);
    const storage = getStorage(app);

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
      app, db, auth, storage, analytics,
      _mods: { firestore: firestoreMod, storage: storageMod },
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
  if (window.ARSFirebase?.configured && window.ARSFirebase.db) {
    const { collection, addDoc } = await import(`https://www.gstatic.com/firebasejs/${FB_VERSION}/firebase-firestore.js`);
    const ref = await addDoc(collection(window.ARSFirebase.db, 'contact_submissions'), {
      ...payload,
      media,
      status: 'New',
      createdAt: new Date().toISOString(),
    });
    return ref;
  }
  if (window.ARS?.Store) {
    const s = window.ARS.Store.load();
    s.contactSubmissions = s.contactSubmissions || [];
    s.contactSubmissions.unshift({
      id: 'sub_' + Date.now(),
      ...payload,
      media,
      status: 'New',
      createdAt: new Date().toISOString(),
    });
    window.ARS.Store.save(s);
    return { id: 'local' };
  }
  await new Promise((r) => setTimeout(r, 400));
  return { id: 'local' };
};

initFirebase();
