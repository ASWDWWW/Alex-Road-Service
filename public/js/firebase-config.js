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

window.ARSFirebase = window.ARSFirebase || { configured: false };

function isFirebaseConfigured() {
  return FIREBASE_CONFIG.projectId && !FIREBASE_CONFIG.projectId.includes('YOUR_');
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
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
    const { getFirestore, collection, addDoc, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js');
    const { getAnalytics, isSupported } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js');

    const app = initializeApp(FIREBASE_CONFIG);
    const db = getFirestore(app);
    const auth = getAuth(app);

    loadGoogleAnalytics(FIREBASE_CONFIG.measurementId);

    let analytics = null;
    try {
      if (await isSupported()) analytics = getAnalytics(app);
    } catch (_) {}

    window.ARSFirebase = {
      configured: true,
      app, db, auth, analytics,
      async getUserProfile(uid) {
        const snap = await getDoc(doc(db, 'users', uid));
        return snap.exists() ? snap.data() : null;
      },
    };
    return window.ARSFirebase;
  } catch (err) {
    console.warn('Firebase init failed:', err);
    return null;
  }
}

window.submitContactForm = async (formData) => {
  if (window.ARSFirebase?.configured && window.ARSFirebase.db) {
    const { collection, addDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const ref = await addDoc(collection(window.ARSFirebase.db, 'contact_submissions'), {
      ...formData,
      createdAt: new Date().toISOString(),
    });
    return ref;
  }
  if (window.ARS?.Store) {
    const s = window.ARS.Store.load();
    s.contactSubmissions = s.contactSubmissions || [];
    s.contactSubmissions.unshift({ id: 'sub_' + Date.now(), ...formData, createdAt: new Date().toISOString() });
    window.ARS.Store.save(s);
    return { id: 'local' };
  }
  await new Promise((r) => setTimeout(r, 400));
  return { id: 'local' };
};

initFirebase();
