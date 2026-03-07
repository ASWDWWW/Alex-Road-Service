/* =====================================================
   ALEX ROAD SERVICE — Firebase Configuration
   
   SETUP INSTRUCTIONS:
   1. Go to Firebase Console → Project Settings → General → Your Apps
   2. Select or create a Web App
   3. Copy the firebaseConfig object values below
   4. Replace each "YOUR_*" placeholder with your actual values
   ===================================================== */

import { initializeApp }                   from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAnalytics }                    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";

const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId:             "YOUR_APP_ID",
  measurementId:     "YOUR_MEASUREMENT_ID",
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

let analytics;
try {
  analytics = getAnalytics(app);
} catch (_) {
  // Analytics unavailable in some environments
}

/**
 * Submit a contact/service request form to Firestore.
 * @param {Object} formData
 * @returns {Promise<DocumentReference>}
 */
window.submitContactForm = async (formData) => {
  const ref = await addDoc(collection(db, 'contact_submissions'), {
    ...formData,
    createdAt: new Date(),
  });
  console.log('Submission saved:', ref.id);
  return ref;
};

export { app, db, analytics };
