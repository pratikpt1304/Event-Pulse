import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getStorage } from 'firebase/storage';
import { getMessaging, isSupported } from 'firebase/messaging';

// Firebase Client Configuration (Environment variables with production fallback)
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCOCFGsYq_-sBMij5tS3P4qFal-NxmClFM",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "eventpulse-su-34a42.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "eventpulse-su-34a42",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "eventpulse-su-34a42.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "190541768232",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:190541768232:web:08e403f458f7bbc91cf71d",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-NJW2ENJCV3"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const storage = getStorage(app);

// Safe Messaging Initialization
export let messaging = null;
export const messagingReady = isSupported().then((supported) => {
  if (supported) {
    messaging = getMessaging(app);
    return messaging;
  }
  return null;
}).catch(() => {
  console.log('ℹ️ Firebase Messaging not supported in current environment.');
  return null;
});

// NOTE: Emulator connections disabled — using live Firebase production project.
// Uncomment below ONLY for local development with emulators:
// const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
// if (isLocalhost && !window._firebaseEmulatorsInitialized) {
//   connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
//   connectFirestoreEmulator(db, '127.0.0.1', 8080);
//   connectFunctionsEmulator(functions, '127.0.0.1', 5001);
//   window._firebaseEmulatorsInitialized = true;
// }
