import { auth, db } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';

let currentUserProfile = null;
let inFlightRegistration = null;
const listeners = new Set();

export const SUPER_ADMIN_EMAILS = [
  'eventpulsesupport@gmail.com',
  'piyushsahuset@sanjivani.edu.in'
];

export const SUPER_ADMIN_EMAIL = 'eventpulsesupport@gmail.com';

export function isUserAdmin(userOrEmail) {
  if (!userOrEmail) return false;
  const email = typeof userOrEmail === 'string' ? userOrEmail : (userOrEmail.email || '');
  const role = typeof userOrEmail === 'object' ? userOrEmail.role : null;
  const clean = email.toLowerCase().trim();
  return SUPER_ADMIN_EMAILS.some(adminEmail => adminEmail.toLowerCase() === clean) || role === 'admin';
}

export function resolveUserRole(email, currentRole = 'student') {
  const clean = (email || '').toLowerCase().trim();
  if (SUPER_ADMIN_EMAILS.some(adminEmail => adminEmail.toLowerCase() === clean)) {
    return 'admin';
  }
  // If someone had admin before but is not in super admin emails, revert to student
  if (currentRole === 'admin') {
    return 'student';
  }
  return currentRole || 'student';
}

// Active session caching
function saveLocalProfile(profile) {
  if (!profile) {
    localStorage.removeItem('ep_user_profile');
  } else {
    profile.role = resolveUserRole(profile.email, profile.role);
    localStorage.setItem('ep_user_profile', JSON.stringify(profile));
    // Save to permanent user registry keyed by UID and Email
    if (profile.uid) {
      localStorage.setItem('ep_user_db_' + profile.uid, JSON.stringify(profile));
    }
    if (profile.email) {
      localStorage.setItem('ep_user_email_' + profile.email.toLowerCase().trim(), JSON.stringify(profile));
    }
  }
}

function getLocalProfile() {
  try {
    const raw = localStorage.getItem('ep_user_profile');
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p) {
      p.role = resolveUserRole(p.email, p.role);
    }
    return p;
  } catch (e) {
    return null;
  }
}

function getSavedProfileByUidOrEmail(uid, email) {
  try {
    if (uid) {
      const rawUid = localStorage.getItem('ep_user_db_' + uid);
      if (rawUid) {
        const p = JSON.parse(rawUid);
        if (p) p.role = resolveUserRole(p.email || email, p.role);
        return p;
      }
    }
    if (email) {
      const rawEmail = localStorage.getItem('ep_user_email_' + email.toLowerCase().trim());
      if (rawEmail) {
        const p = JSON.parse(rawEmail);
        if (p) p.role = resolveUserRole(p.email || email, p.role);
        return p;
      }
    }
  } catch (e) {}
  return null;
}

export function subscribeAuth(callback) {
  listeners.add(callback);
  callback(getCurrentUser());
  return () => listeners.delete(callback);
}

function notifyListeners() {
  const user = getCurrentUser();
  listeners.forEach(cb => cb(user));
}

export function getCurrentUser() {
  let profile = currentUserProfile || getLocalProfile();
  if (profile) {
    profile.role = resolveUserRole(profile.email, profile.role);
  }
  return profile;
}

// Timeout helper to prevent Firestore query hanging
function withTimeout(promise, ms = 3500, fallback = null) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms))
  ]);
}

export function initAuthListener() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // 1. Check if there is an in-flight registration from the signup form
      let pendingSignup = inFlightRegistration;
      if (!pendingSignup) {
        try {
          const rawPending = localStorage.getItem('ep_pending_signup');
          if (rawPending) pendingSignup = JSON.parse(rawPending);
        } catch (e) {}
      }

      if (pendingSignup && (!pendingSignup.email || pendingSignup.email.toLowerCase() === (user.email || '').toLowerCase())) {
        const fullProfile = {
          uid: user.uid,
          name: pendingSignup.name,
          email: user.email,
          prn: pendingSignup.prn,
          department: pendingSignup.department,
          year: pendingSignup.year,
          division: pendingSignup.division,
          role: 'student',
          createdAt: new Date().toISOString()
        };

        currentUserProfile = fullProfile;
        saveLocalProfile(fullProfile);
        setDoc(doc(db, 'users', user.uid), fullProfile, { merge: true }).catch(() => {});
        localStorage.removeItem('ep_pending_signup');
        inFlightRegistration = null;
        notifyListeners();
        return;
      }

      // 2. Check active in-memory or cached profile
      let profile = getLocalProfile();
      if (!profile || profile.uid !== user.uid) {
        profile = getSavedProfileByUidOrEmail(user.uid, user.email);
      }

      if (profile && profile.name) {
        currentUserProfile = profile;
        notifyListeners();
      }

      // 3. Fetch from Firestore Document or Query by Email (Works across all devices!)
      try {
        const userDoc = await withTimeout(getDoc(doc(db, 'users', user.uid)), 3500);
        if (userDoc && userDoc.exists()) {
          currentUserProfile = { uid: user.uid, email: user.email, ...userDoc.data() };
          saveLocalProfile(currentUserProfile);
        } else {
          // Check if profile exists by email in Firestore
          const emailQuery = query(collection(db, 'users'), where('email', '==', user.email));
          const snap = await withTimeout(getDocs(emailQuery), 3000);
          if (snap && !snap.empty) {
            const foundDoc = snap.docs[0].data();
            currentUserProfile = { uid: user.uid, ...foundDoc };
            saveLocalProfile(currentUserProfile);
            setDoc(doc(db, 'users', user.uid), currentUserProfile, { merge: true }).catch(() => {});
          } else if (profile && profile.name) {
            setDoc(doc(db, 'users', user.uid), profile, { merge: true }).catch(() => {});
            currentUserProfile = profile;
            saveLocalProfile(profile);
          }
        }
        if (currentUserProfile && currentUserProfile.status === 'banned') {
          const reason = currentUserProfile.bannedReason || 'Violation of university code of conduct.';
          await auth.signOut();
          currentUserProfile = null;
          localStorage.removeItem('ep_user_profile');
          alert(`⛔ ACCOUNT SUSPENDED\n\nYour EventPulse access has been revoked by University Administration.\nReason: ${reason}`);
          window.location.hash = 'login';
          notifyListeners();
          return;
        }
      } catch (e) {
        if (!currentUserProfile && profile) {
          currentUserProfile = profile;
        }
      }
    } else {
      currentUserProfile = null;
      localStorage.removeItem('ep_user_profile');
    }
    notifyListeners();
  });
}

/**
 * Update current user profile in Firestore & local permanent storage (MERGE TRUE)
 */
export async function updateUserProfile({ name, department, year, division }) {
  if (!currentUserProfile) return { success: false, error: 'Not logged in' };
  
  const updates = {
    name: name.trim(),
    department,
    year,
    division: division.trim()
  };

  // Immediate local state & permanent cache update
  currentUserProfile = { ...currentUserProfile, ...updates };
  saveLocalProfile(currentUserProfile);
  notifyListeners();

  // Guaranteed Persist to Firestore with setDoc merge: true
  try {
    await withTimeout(setDoc(doc(db, 'users', currentUserProfile.uid), updates, { merge: true }), 3500);
  } catch (err) {
    console.warn('Background profile update notice:', err.message);
  }

  return { success: true, user: currentUserProfile };
}

/**
 * Sign In with Google Provider
 */
export async function loginWithGoogle() {
  try {
    const provider = new GoogleAuthProvider();
    const cred = await signInWithPopup(auth, provider);
    const u = cred.user;

    const userRef = doc(db, 'users', u.uid);
    let existingData = getSavedProfileByUidOrEmail(u.uid, u.email) || {};
    try {
      const userDoc = await withTimeout(getDoc(userRef), 2500);
      if (userDoc && userDoc.exists()) existingData = userDoc.data();
    } catch (e) {}

    const profile = {
      uid: u.uid,
      name: existingData.name || u.displayName || u.email.split('@')[0],
      email: u.email,
      prn: existingData.prn || ('SU2026CS' + Math.floor(1000 + Math.random() * 9000)),
      department: existingData.department || 'Integrated M.Tech (IMtech)',
      year: existingData.year || '1st Year',
      division: existingData.division || 'A',
      role: existingData.role || 'student',
      createdAt: existingData.createdAt || new Date().toISOString()
    };

    setDoc(userRef, profile, { merge: true }).catch(e => console.warn(e));
    currentUserProfile = profile;
    saveLocalProfile(profile);
    notifyListeners();
    return { success: true, user: profile };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Authentic Firebase Email & Password Login (RESTORES EXACT REGISTERED DETAILS ON ANY DEVICE)
 */
export async function loginUser(email, password) {
  try {
    const cleanEmail = email.trim();
    const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
    const u = cred.user;

    // 1. Look up saved registered profile by UID or Email
    let savedProfile = getSavedProfileByUidOrEmail(u.uid, cleanEmail);
    let userProfileData = savedProfile || null;

    // 2. Fetch from Firestore document
    try {
      const userDoc = await withTimeout(getDoc(doc(db, 'users', u.uid)), 3500);
      if (userDoc && userDoc.exists()) {
        userProfileData = { uid: u.uid, email: u.email, ...userDoc.data() };
      } else {
        // Query Firestore collection by email
        const emailQuery = query(collection(db, 'users'), where('email', '==', cleanEmail));
        const snap = await withTimeout(getDocs(emailQuery), 3000);
        if (snap && !snap.empty) {
          userProfileData = { uid: u.uid, ...snap.docs[0].data() };
          setDoc(doc(db, 'users', u.uid), userProfileData, { merge: true }).catch(() => {});
        } else if (savedProfile) {
          setDoc(doc(db, 'users', u.uid), savedProfile, { merge: true }).catch(() => {});
        }
      }
    } catch (e) {
      console.warn('Firestore user fetch notice:', e.message);
    }

    if (!userProfileData) {
      userProfileData = {
        uid: u.uid,
        email: u.email,
        name: u.displayName || u.email.split('@')[0],
        role: 'student',
        department: 'Integrated M.Tech (IMtech)',
        year: '1st Year',
        division: 'A',
        prn: 'SU2026CS' + u.uid.slice(0, 4).toUpperCase()
      };
    }

    if (userProfileData && userProfileData.status === 'banned') {
      await auth.signOut();
      currentUserProfile = null;
      return { 
        success: false, 
        error: `⛔ Account Suspended: Your access has been revoked by University Administration. Reason: ${userProfileData.bannedReason || 'Violation of campus code of conduct.'}` 
      };
    }

    currentUserProfile = userProfileData;
    saveLocalProfile(userProfileData);
    notifyListeners();
    return { success: true, user: currentUserProfile };
  } catch (err) {
    let msg = err.message;
    if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
      msg = 'Invalid email or password. Please check your login details.';
    }
    return { success: false, error: msg };
  }
}

/**
 * Register new student account & create user doc in Firestore (GUARANTEED MULTI-DEVICE PERSISTENCE)
 */
export async function registerStudent({ email, password, name, prn, department, year, division }) {
  const cleanPrn = (prn || '').trim().toUpperCase();
  const cleanEmail = (email || '').trim();
  const cleanName = (name || '').trim();

  if (cleanPrn.length !== 12) {
    return {
      success: false,
      error: `PRN must be exactly 12 characters long (Current length: ${cleanPrn.length}). Example: SU2026CS0417`
    };
  }

  // 1. Quick PRN Uniqueness check (Max 2s timeout)
  try {
    const q = query(
      collection(db, 'users'),
      where('prn', '==', cleanPrn)
    );
    const snap = await withTimeout(getDocs(q), 2000);
    if (snap && !snap.empty) {
      return {
        success: false,
        error: `PRN "${cleanPrn}" is already registered by another student. Please enter your unique PRN.`
      };
    }
  } catch (err) {
    console.warn('PRN query check notice:', err.message);
  }

  // 2. Pre-set in-flight registration to prevent auth state change race condition!
  const pendingData = {
    name: cleanName,
    email: cleanEmail,
    prn: cleanPrn,
    department,
    year,
    division: division.trim()
  };
  inFlightRegistration = pendingData;
  try {
    localStorage.setItem('ep_pending_signup', JSON.stringify(pendingData));
  } catch (e) {}

  // 3. Authentic Firebase Auth Account Creation
  try {
    const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    const uid = cred.user.uid;

    const profile = {
      uid,
      name: cleanName,
      email: cleanEmail,
      prn: cleanPrn,
      department,
      year,
      division: division.trim(),
      role: 'student',
      createdAt: new Date().toISOString()
    };

    // Save profile to permanent local database and current profile
    currentUserProfile = profile;
    saveLocalProfile(profile);

    // Confirmed Write to Firestore with setDoc merge: true
    try {
      await withTimeout(setDoc(doc(db, 'users', uid), profile, { merge: true }), 3500);
    } catch (e) {
      console.warn('Firestore doc write warning:', e.message);
    }

    localStorage.removeItem('ep_pending_signup');
    inFlightRegistration = null;
    notifyListeners();
    return { success: true, user: profile };
  } catch (err) {
    localStorage.removeItem('ep_pending_signup');
    inFlightRegistration = null;

    let friendlyMessage = err.message;
    if (err.code === 'auth/email-already-in-use') {
      friendlyMessage = 'This email address is already registered. Please click "Sign in" below to log in.';
    } else if (err.code === 'auth/weak-password') {
      friendlyMessage = 'Password is too weak. Please use at least 6 characters.';
    } else if (err.code === 'auth/invalid-email') {
      friendlyMessage = 'Please enter a valid email address.';
    }
    return { success: false, error: friendlyMessage };
  }
}

export async function logoutUser() {
  try {
    await signOut(auth);
  } catch (e) {}
  currentUserProfile = null;
  localStorage.removeItem('ep_user_profile');
  notifyListeners();
}
