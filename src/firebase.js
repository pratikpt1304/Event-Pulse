import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getStorage } from 'firebase/storage';
import { getMessaging, isSupported } from 'firebase/messaging';

// Authentic Firebase Client Config for Project: eventpulse-su-34a42
export const firebaseConfig = {
  apiKey: "AIzaSyCOCFGsYq_-sBMij5tS3P4qFal-NxmClFM",
  authDomain: "eventpulse-su-34a42.firebaseapp.com",
  projectId: "eventpulse-su-34a42",
  storageBucket: "eventpulse-su-34a42.firebasestorage.app",
  messagingSenderId: "190541768232",
  appId: "1:190541768232:web:08e403f458f7bbc91cf71d",
  measurementId: "G-NJW2ENJCV3"
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
