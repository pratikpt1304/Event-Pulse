import { auth, db } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  sendEmailVerification
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc,
  collection, 
  query, 
  where, 
  getDocs,
  writeBatch
} from 'firebase/firestore';

let currentUserProfile = null;
let inFlightRegistration = null;
const listeners = new Set();

export const VALID_ROLES = ['student', 'organizer', 'hod', 'dean', 'vc', 'admin'];
export const STAFF_ROLES = ['organizer', 'hod', 'dean', 'vc', 'admin'];

export const SUPER_ADMIN_EMAILS = [
  'eventpulsesupport@gmail.com',
  'piyushsahuset@sanjivani.edu.in',
  'admin@college.edu',
  'admin@univ.edu'
];

export const SUPER_ADMIN_EMAIL = 'eventpulsesupport@gmail.com';

export function isDemoModeEnabled() {
  return import.meta.env.VITE_DEMO_MODE === 'true';
}

export const DEMO_ACCOUNTS = {
  'student@college.edu': {
    uid: 'demo_student',
    email: 'student@college.edu',
    name: 'Pratik Thorat (Student)',
    role: 'student',
    department: 'Computer Science & Engineering',
    year: '3rd Year',
    division: 'A',
    prn: 'SU2024CS0142'
  },
  'organizer@college.edu': {
    uid: 'demo_organizer',
    email: 'organizer@college.edu',
    name: 'Hariprasath Sir (Event Lead)',
    role: 'organizer',
    department: 'Technology Council',
    year: 'Lead Organizer',
    division: 'TECH',
    prn: 'ORG-TECH-2026'
  },
  'hod@college.edu': {
    uid: 'demo_hod',
    email: 'hod@college.edu',
    name: 'Prof. Anwar Sheikh (HOD)',
    role: 'hod',
    department: 'Integrated M.Tech',
    year: 'HOD',
    division: 'IMtech',
    prn: 'HOD-IMTECH-01'
  },
  'dean@college.edu': {
    uid: 'demo_dean',
    email: 'dean@college.edu',
    name: 'Dr. Kavita Verma (Dean)',
    role: 'dean',
    department: 'Faculty of Engineering & Technology',
    year: 'Dean',
    division: 'HQ',
    prn: 'DEAN-ACAD-02'
  },
  'vc@college.edu': {
    uid: 'demo_vc',
    email: 'vc@college.edu',
    name: 'VC Sir',
    role: 'vc',
    department: 'University Executive Office',
    year: 'Vice Chancellor',
    division: 'HQ',
    prn: 'VC-EXEC-01'
  },
  'admin@college.edu': {
    uid: 'demo_admin',
    email: 'admin@college.edu',
    name: 'Central Administration',
    role: 'admin',
    department: 'Central Administration',
    year: 'Admin',
    division: 'HQ',
    prn: 'ADM-CENTRAL-01'
  }
};

export function isUserAdmin(userOrEmail) {
  if (!userOrEmail) return false;
  const email = typeof userOrEmail === 'string' ? userOrEmail : (userOrEmail.email || '');
  const role = typeof userOrEmail === 'object' ? userOrEmail.role : null;
  const clean = email.toLowerCase().trim();
  return SUPER_ADMIN_EMAILS.some(adminEmail => adminEmail.toLowerCase() === clean) || role === 'admin' || role === 'vc';
}

export function isUserStaff(userOrEmail) {
  if (!userOrEmail) return false;
  const role = typeof userOrEmail === 'object' ? userOrEmail.role : null;
  return isUserAdmin(userOrEmail) || STAFF_ROLES.includes(role);
}

export function resolveUserRole(email, currentRole = 'student') {
  const clean = (email || '').toLowerCase().trim();
  if (SUPER_ADMIN_EMAILS.some(adminEmail => adminEmail.toLowerCase() === clean)) {
    return 'admin';
  }
  if (VALID_ROLES.includes(currentRole)) {
    return currentRole;
  }
  return 'student';
}

// Active session caching
function saveLocalProfile(profile) {
  if (!profile) {
    localStorage.removeItem('ep_user_profile');
  } else {
    profile.role = resolveUserRole(profile.email, profile.role);
    if (profile.role === 'vc' || (profile.email && profile.email.toLowerCase().trim() === 'vc@college.edu')) {
      profile.name = 'VC Sir';
    }
    localStorage.setItem('ep_user_profile', JSON.stringify(profile));
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
    if (profile.role === 'vc' || (profile.email && profile.email.toLowerCase().trim() === 'vc@college.edu')) {
      profile.name = 'VC Sir';
    }
  }
  return profile;
}

function withTimeout(promise, ms = 3500, fallback = null) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms))
  ]);
}

/**
 * Checks staffInvites collection for an active invite. If present, applies role and department.
 */
async function applyStaffInviteIfPending(uid, email, currentProfile) {
  if (!email) return currentProfile;
  const cleanEmail = email.toLowerCase().trim();
  try {
    const inviteRef = doc(db, 'staffInvites', cleanEmail);
    const inviteSnap = await withTimeout(getDoc(inviteRef), 2500);
    if (inviteSnap && inviteSnap.exists()) {
      const inv = inviteSnap.data();
      if (inv && inv.role && STAFF_ROLES.includes(inv.role)) {
        const updated = {
          ...currentProfile,
          role: inv.role,
          department: inv.department || currentProfile.department || ''
        };
        // Persist to users/{uid}
        await withTimeout(setDoc(doc(db, 'users', uid), { 
          role: inv.role, 
          department: inv.department || '' 
        }, { merge: true }), 3000);

        // Mark staff invite as redeemed
        setDoc(inviteRef, { 
          redeemed: true, 
          redeemedBy: uid, 
          redeemedAt: new Date().toISOString() 
        }, { merge: true }).catch(() => {});

        return updated;
      }
    }
  } catch (err) {
    console.warn('Staff invite lookup notice:', err.message);
  }
  return currentProfile;
}

export function initAuthListener() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
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
          emailVerified: user.emailVerified || false,
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

      let profile = getLocalProfile();
      if (!profile || profile.uid !== user.uid) {
        profile = getSavedProfileByUidOrEmail(user.uid, user.email);
      }

      if (profile && profile.name) {
        currentUserProfile = profile;
        notifyListeners();
      }

      try {
        const userDoc = await withTimeout(getDoc(doc(db, 'users', user.uid)), 3500);
        if (userDoc && userDoc.exists()) {
          currentUserProfile = { uid: user.uid, email: user.email, emailVerified: user.emailVerified, ...userDoc.data() };
        } else {
          const emailQuery = query(collection(db, 'users'), where('email', '==', user.email));
          const snap = await withTimeout(getDocs(emailQuery), 3000);
          if (snap && !snap.empty) {
            currentUserProfile = { uid: user.uid, emailVerified: user.emailVerified, ...snap.docs[0].data() };
            setDoc(doc(db, 'users', user.uid), currentUserProfile, { merge: true }).catch(() => {});
          } else if (profile && profile.name) {
            setDoc(doc(db, 'users', user.uid), profile, { merge: true }).catch(() => {});
            currentUserProfile = profile;
          }
        }

        // Apply staff invite if this is first login or pending invite exists
        currentUserProfile = await applyStaffInviteIfPending(user.uid, user.email, currentUserProfile || {
          uid: user.uid,
          email: user.email,
          name: user.displayName || user.email.split('@')[0],
          role: 'student',
          department: '',
          prn: ''
        });

        saveLocalProfile(currentUserProfile);

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

export async function updateUserProfile({ name, department, year, division }) {
  if (!currentUserProfile) return { success: false, error: 'Not logged in' };
  
  const updates = {
    name: name.trim(),
    department,
    year,
    division: division.trim()
  };

  currentUserProfile = { ...currentUserProfile, ...updates };
  saveLocalProfile(currentUserProfile);
  notifyListeners();

  try {
    await withTimeout(setDoc(doc(db, 'users', currentUserProfile.uid), updates, { merge: true }), 3500);
  } catch (err) {
    console.warn('Background profile update notice:', err.message);
  }

  return { success: true, user: currentUserProfile };
}

export async function sendPasswordReset(email) {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) {
    return { success: false, error: 'Please enter your registered email address.' };
  }
  try {
    await sendPasswordResetEmail(auth, cleanEmail);
    return { success: true };
  } catch (err) {
    let msg = 'Failed to send password reset email.';
    if (err.code === 'auth/user-not-found') {
      msg = 'No user account found with this email.';
    } else if (err.code === 'auth/invalid-email') {
      msg = 'Please enter a valid email address.';
    } else if (err.code === 'auth/too-many-requests') {
      msg = 'Too many requests. Please try again after a few minutes.';
    }
    return { success: false, error: msg };
  }
}

export async function sendStudentEmailVerification() {
  if (auth.currentUser) {
    try {
      await sendEmailVerification(auth.currentUser);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
  return { success: false, error: 'No active user session found.' };
}

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

    let profile = {
      uid: u.uid,
      name: existingData.name || u.displayName || u.email.split('@')[0],
      email: u.email,
      prn: existingData.prn || ('SU2026CS' + Math.floor(1000 + Math.random() * 9000)),
      department: existingData.department || 'Integrated M.Tech (IMtech)',
      year: existingData.year || '1st Year',
      division: existingData.division || 'A',
      role: existingData.role || resolveUserRole(u.email, 'student'),
      emailVerified: u.emailVerified || false,
      createdAt: existingData.createdAt || new Date().toISOString()
    };

    profile = await applyStaffInviteIfPending(u.uid, u.email, profile);

    setDoc(userRef, profile, { merge: true }).catch(e => console.warn(e));
    currentUserProfile = profile;
    saveLocalProfile(profile);
    notifyListeners();
    return { success: true, user: profile };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function loginUser(email, password) {
  const cleanEmail = (email || '').toLowerCase().trim();
  
  // Demo Mode check: instant local sign-in only if VITE_DEMO_MODE is true
  if (isDemoModeEnabled() && DEMO_ACCOUNTS[cleanEmail]) {
    const demoProfile = { ...DEMO_ACCOUNTS[cleanEmail] };
    currentUserProfile = demoProfile;
    saveLocalProfile(demoProfile);
    notifyListeners();
    return { success: true, user: currentUserProfile };
  }

  // Authentic Firebase Login
  try {
    const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
    const u = cred.user;

    let savedProfile = getSavedProfileByUidOrEmail(u.uid, cleanEmail);
    let userProfileData = savedProfile || null;

    try {
      const userDoc = await withTimeout(getDoc(doc(db, 'users', u.uid)), 3500);
      if (userDoc && userDoc.exists()) {
        userProfileData = { uid: u.uid, email: u.email, ...userDoc.data() };
      } else {
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
        role: resolveUserRole(u.email, 'student'),
        department: '',
        year: '',
        division: '',
        prn: ''
      };
    }

    // Apply any pending staff invite (organizer, hod, dean, vc, admin)
    userProfileData = await applyStaffInviteIfPending(u.uid, cleanEmail, userProfileData);

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
      msg = 'Invalid email or password. If you are a student, please sign up using the Student Sign Up tab.';
    } else if (err.code === 'auth/too-many-requests') {
      msg = 'Access temporarily disabled due to many failed attempts. Try again later or reset password.';
    }
    return { success: false, error: msg };
  }
}

export async function registerStudent({ email, password, name, prn, department, year, division }) {
  const cleanPrn = (prn || '').trim().toUpperCase();
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanName = (name || '').trim();

  // 1. Optional Allowed Domain Check
  const allowedDomain = (import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN || '').trim().toLowerCase();
  if (allowedDomain && !cleanEmail.endsWith('@' + allowedDomain)) {
    return {
      success: false,
      error: `Student registration is restricted to official college email addresses ending with @${allowedDomain}`
    };
  }

  // 2. PRN validation
  if (cleanPrn.length < 6 || cleanPrn.length > 16) {
    return {
      success: false,
      error: `Please enter a valid student PRN / Roll Number (6-16 characters).`
    };
  }

  // 3. PRN Uniqueness check
  try {
    const q = query(collection(db, 'users'), where('prn', '==', cleanPrn));
    const snap = await withTimeout(getDocs(q), 2000);
    if (snap && !snap.empty) {
      return {
        success: false,
        error: `PRN "${cleanPrn}" is already registered. Please enter your own PRN or sign in.`
      };
    }
  } catch (err) {
    console.warn('PRN uniqueness check notice:', err.message);
  }

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

  try {
    const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    const uid = cred.user.uid;

    // Send verification email
    try {
      await sendEmailVerification(cred.user);
    } catch (e) {
      console.warn('Email verification send notice:', e.message);
    }

    const profile = {
      uid,
      name: cleanName,
      email: cleanEmail,
      prn: cleanPrn,
      department,
      year,
      division: division.trim(),
      role: 'student', // Students strictly receive 'student' role
      emailVerified: cred.user.emailVerified || false,
      createdAt: new Date().toISOString()
    };

    currentUserProfile = profile;
    saveLocalProfile(profile);

    try {
      await withTimeout(setDoc(doc(db, 'users', uid), profile, { merge: true }), 3500);
    } catch (e) {
      console.warn('Firestore user write warning:', e.message);
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
      friendlyMessage = 'This email is already registered. Please switch to the Sign In tab.';
    } else if (err.code === 'auth/weak-password') {
      friendlyMessage = 'Password should be at least 6 characters.';
    } else if (err.code === 'auth/invalid-email') {
      friendlyMessage = 'Please enter a valid email address.';
    }
    return { success: false, error: friendlyMessage };
  }
}

/**
 * Admin: Create single staff invite in staffInvites/{email}
 */
export async function createStaffInvite({ email, role, department }, adminUser) {
  if (!isUserAdmin(adminUser)) {
    return { success: false, error: 'Unauthorized: Only administrators can invite staff.' };
  }
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, error: 'Invalid email address.' };
  }
  if (!STAFF_ROLES.includes(role)) {
    return { success: false, error: `Invalid staff role. Must be one of: ${STAFF_ROLES.join(', ')}` };
  }

  const inviteDoc = {
    email: cleanEmail,
    role,
    department: (department || '').trim(),
    invitedBy: adminUser.email,
    createdAt: new Date().toISOString(),
    redeemed: false
  };

  try {
    await setDoc(doc(db, 'staffInvites', cleanEmail), inviteDoc, { merge: true });
    return { success: true, invite: inviteDoc };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Admin: Fetch all staff invites
 */
export async function getStaffInvites() {
  if (!auth.currentUser) return [];
  try {
    const snap = await getDocs(collection(db, 'staffInvites'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    return [];
  }
}

/**
 * Admin: Delete a staff invite
 */
export async function deleteStaffInvite(email) {
  try {
    await deleteDoc(doc(db, 'staffInvites', email.toLowerCase().trim()));
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Admin: Batch create staff invites from CSV import
 */
export async function batchCreateStaffInvites(invitesList, adminUser) {
  if (!isUserAdmin(adminUser)) {
    return { success: false, error: 'Unauthorized: Admin privileges required.' };
  }
  if (!Array.isArray(invitesList) || invitesList.length === 0) {
    return { success: false, error: 'No invites to process.' };
  }

  try {
    const batch = writeBatch(db);
    invitesList.forEach(item => {
      const cleanEmail = item.email.toLowerCase().trim();
      const ref = doc(db, 'staffInvites', cleanEmail);
      batch.set(ref, {
        email: cleanEmail,
        role: item.role,
        department: item.department || '',
        invitedBy: adminUser.email,
        createdAt: new Date().toISOString(),
        redeemed: false
      }, { merge: true });
    });
    await batch.commit();
    return { success: true, count: invitesList.length };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Admin: Change role of an existing user
 */
export async function updateUserRoleByAdmin(targetUid, newRole, adminUser) {
  if (!isUserAdmin(adminUser)) {
    return { success: false, error: 'Unauthorized: Admin privileges required.' };
  }
  if (!VALID_ROLES.includes(newRole)) {
    return { success: false, error: `Invalid role: ${newRole}` };
  }

  try {
    await setDoc(doc(db, 'users', targetUid), { role: newRole }, { merge: true });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
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
