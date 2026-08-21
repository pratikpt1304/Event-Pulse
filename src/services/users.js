import { db } from '../firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc,
  setDoc,
  deleteDoc
} from 'firebase/firestore';

// Purge any stale cache from old sessions
try {
  localStorage.removeItem('ep_cached_users_dir');
  localStorage.removeItem('ep_cached_users_dir_v2');
  localStorage.removeItem('ep_users_cache');
  localStorage.removeItem('ep_real_users_v5');
} catch (e) {}

const LOCAL_USERS_KEY = 'ep_real_users_v6';

// Purged / Deleted fake & test accounts list
export const PURGED_USER_EMAILS = [
  'sera@gmail.com'
];

// 100% Authentic Accounts from Firebase Authentication
export const AUTH_REGISTERED_USERS = [
  { uid: "ZdlIMAApOePJan3I1Z0z49dzh7C3", email: "eventpulsesupport@gmail.com", name: "EventPulse Support", prn: "", department: "", year: "", role: "admin" },
  { uid: "piyushsahuset_faculty_admin", email: "piyushsahuset@sanjivani.edu.in", name: "Piyush Sahu", prn: "FACULTY", department: "Central Administration", year: "Faculty", role: "admin" },
  { uid: "yW9IwayF8Ue5zHcgWyNaF5pOYCk1", email: "thoratpratik2323@gmail.com", name: "Pratik Thorat", prn: "", department: "", year: "", role: "student" },
  { uid: "39tsEIo3pZZBVHn33KA3zZaxa4C3", email: "swarajhalnor19@gmail.com", name: "Swaraj Halnor", prn: "", department: "", year: "", role: "student" },
  { uid: "3hrNDuM2EBfm4s19wq5ufAXps0x1", email: "abhirajbadakh28@gmail.com", name: "Abhiraj Badakh", prn: "", department: "", year: "", role: "student" },
  { uid: "3rwHrNpCg7gWa4pKWoqPtdxOeZu1", email: "adityasadaphal611@gmail.com", name: "Aditya Sadaphal", prn: "", department: "", year: "", role: "student" },
  { uid: "5kaInct053SqJnc5rxMMPyjPvws1", email: "nagpureharshada9@gmail.com", name: "Harshada Nagpure", prn: "", department: "", year: "", role: "student" },
  { uid: "8dOicQQApZQxn4OSPDxHjWfmDcJ3", email: "nihalattarde2008@gmail.com", name: "Nihal Attarde", prn: "", department: "", year: "", role: "student" },
  { uid: "9rqlVAafMrbROq6P20sNY0pLBt02", email: "dev108@gmail.com", name: "Dev", prn: "", department: "", year: "", role: "student" },
  { uid: "CoyivxHhDgU4bHea5ng5Wqt14T22", email: "omsalunkepatil@gmail.com", name: "Om Salunke Patil", prn: "", department: "", year: "", role: "student" },
  { uid: "F27FRnphYiVyDanfiWbs38gxvmo1", email: "akankshalandge26@gmail.com", name: "Akanksha Landge", prn: "", department: "", year: "", role: "student" },
  { uid: "FJAJPN2MyyWhMI3PE5In5RD9sym2", email: "atharvgholap12345@gmail.com", name: "Atharva Gholap", prn: "", department: "", year: "", role: "student" },
  { uid: "GbxPQsTDvphYivJ3E68HroVrhD73", email: "ghogarerugved81@gmail.com", name: "Rugved Ghogare", prn: "", department: "", year: "", role: "student" },
  { uid: "HFQutvgndcbxL520IcUwDW2nDFt1", email: "vedikahon@gmail.com", name: "Vedika Hon", prn: "", department: "", year: "", role: "student" },
  { uid: "JLflGnGhG6NQLaBK0xUuZG97zGF3", email: "bonganevaishnavi7@gmail.com", name: "Vaishnavi Bongane", prn: "", department: "", year: "", role: "student" },
  { uid: "Kb5XGiRFvXUuoXRF3iVcBUFH2up1", email: "velgudesatyam@gmail.com", name: "Satyam Velgude", prn: "", department: "", year: "", role: "student" },
  { uid: "M95VrjA8vrSLny8HROhwVdiuz7Z2", email: "prapawar24012007@gmail.com", name: "Prajwal Pawar", prn: "", department: "", year: "", role: "student" },
  { uid: "QUIAQa5jWRPXk4ds1R0wIIw8PCB3", email: "sm4995666@gmail.com", name: "S. M. Patil", prn: "", department: "", year: "", role: "student" },
  { uid: "TJKmWjoJYVfokQfWLiuahTNQAal1", email: "sadafalshweta93@gmail.com", name: "Shweta Sadafal", prn: "", department: "", year: "", role: "student" },
  { uid: "WAHlSRLAVUUZgkzgggpUMGou9k53", email: "samarthnashikkar78@gmail.com", name: "Samarth Nashikkar", prn: "", department: "", year: "", role: "student" },
  { uid: "WyRYa5wm2kU0rgt3ciiOInCSMw43", email: "vasisthadhokane13@gmail.com", name: "Vasistha Dhokane", prn: "", department: "", year: "", role: "student" },
  { uid: "a1nAboMpWWNlG7s8uus9ch4O7uI2", email: "samarthshisode5@gmail.com", name: "Samarth Shisode", prn: "", department: "", year: "", role: "student" },
  { uid: "arc4iNN0bYaNXAhmvAFKszaKSwp1", email: "shreyas.shinde619@gmail.com", name: "Shreyas Shinde", prn: "", department: "", year: "", role: "student" },
  { uid: "ccrcYutyJHXIfmPWrHZLQVzKJlj1", email: "omlabhade2009@gmail.com", name: "Om Labhade", prn: "", department: "", year: "", role: "student" },
  { uid: "YBZ7OZCC1KZPx9QRTtSxRUbJtH3", email: "yashkarad1578@gmail.com", name: "Yash Karad", prn: "", department: "IMtech", year: "1st Year", role: "student" },
  { uid: "MG7pnrCVMwfZj0MK4VusltgH2", email: "goreaditya270@gmail.com", name: "Aditya Gore", prn: "", department: "IMtech", year: "1st Year", role: "student" },
  { uid: "apSIXJMPa8dKYkjki4qbM09X3", email: "namratashejul473@gmail.com", name: "Namrata Shejul", prn: "", department: "IMtech", year: "1st Year", role: "student" },
  { uid: "RW2NSV1doOUMqvJvO7Gen4", email: "priyaudmale298@gmail.com", name: "Priya Udmale", prn: "", department: "IMtech", year: "1st Year", role: "student" },
  { uid: "d5MZbmzOlLXJQ5WPamMSO5", email: "kirtihonde1769@gmail.com", name: "Kirti Honde", prn: "", department: "IMtech", year: "1st Year", role: "student" },
  { uid: "my4FP5LrPDfDpACFMYG6m8tSC5Y2", email: "pratikshadhamale108@gmail.com", name: "Pratiksha Dhamale", prn: "", department: "", year: "", role: "student" },
  { uid: "n0nUcsDXZbb6qlDB0VcvLv2d1Ki2", email: "kadamgauri234@gmail.com", name: "Gauri Kadam", prn: "", department: "", year: "", role: "student" },
  { uid: "pjuEIYEIJSWn2SYvVohJGQMfSOG2", email: "vedantmate82@gmail.com", name: "Vedant Mate", prn: "", department: "", year: "", role: "student" },
  { uid: "plAciTqJNSOxqPupK27CYlcy5wh1", email: "honshraddha57@gmail.co", name: "Shraddha Hon", prn: "", department: "", year: "", role: "student" },
  { uid: "quQzrO5yFcacLj3hoy7NkPRZJGm1", email: "atharvmagar49@gmail.com", name: "Atharva Magar", prn: "", department: "", year: "", role: "student" },
  { uid: "uiZ76WjpcgXde6wWk3OC0hhcZzW2", email: "sonawanedivya2008@gmail.com", name: "Divya Sonawane", prn: "", department: "", year: "", role: "student" },
  { uid: "xQZ8NIV2JUYi1g5TEo9jaWJZubv2", email: "samugangad@gmail.com", name: "Samruddhi Gangad", prn: "", department: "", year: "", role: "student" },
  { uid: "zwSd6MW6JIVH9Qzu2bOTgg8Cf8o1", email: "princepothiwal@gmail.com", name: "Prince Pothiwal", prn: "", department: "", year: "", role: "student" }
];

function getLocalUsers() {
  const map = new Map();
  AUTH_REGISTERED_USERS.forEach(u => {
    const email = u.email.toLowerCase().trim();
    if (!PURGED_USER_EMAILS.includes(email)) {
      map.set(email, { ...u });
    }
  });

  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach(u => {
          if (u && u.email) {
            const key = u.email.toLowerCase().trim();
            const name = (u.name || '').toLowerCase().trim();
            if (!PURGED_USER_EMAILS.includes(key) && name !== 'sera') {
              map.set(key, { ...(map.get(key) || {}), ...u });
            }
          }
        });
      }
    }
  } catch (e) {}

  return Array.from(map.values()).filter(u => {
    const email = (u.email || '').toLowerCase().trim();
    const name = (u.name || '').toLowerCase().trim();
    return !PURGED_USER_EMAILS.includes(email) && name !== 'sera';
  });
}

function saveLocalUsers(list) {
  try {
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(list));
  } catch (e) {}
}

export function getCachedUsersSync() {
  return getLocalUsers();
}

/**
 * Fetch all registered users directly from Firebase Cloud Firestore
 */
export async function getAllUsers() {
  const userMap = new Map();

  // 1. Initialize with authentic Firebase Auth list (PRNs default to empty)
  AUTH_REGISTERED_USERS.forEach(u => {
    const email = u.email.toLowerCase().trim();
    if (!PURGED_USER_EMAILS.includes(email)) {
      userMap.set(email, { ...u });
    }
  });

  try {
    // 2. Fetch live data from Cloud Firestore 'users' collection
    const snap = await getDocs(collection(db, 'users'));
    if (snap && !snap.empty) {
      snap.docs.forEach(d => {
        const data = d.data();
        const key = (data.email || d.id).toLowerCase().trim();
        const name = (data.name || '').toLowerCase().trim();

        if (PURGED_USER_EMAILS.includes(key) || name === 'sera') {
          // Permanently purge from Firestore
          try {
            deleteDoc(doc(db, 'users', d.id));
          } catch (e) {}
          return;
        }

        const existing = userMap.get(key) || {};
        userMap.set(key, { ...existing, uid: d.id, ...data });
      });
    }
  } catch (err) {
    console.warn('Firestore users collection fetch warning:', err.message);
  }

  const list = Array.from(userMap.values()).filter(u => {
    const email = (u.email || '').toLowerCase().trim();
    const name = (u.name || '').toLowerCase().trim();
    return !PURGED_USER_EMAILS.includes(email) && name !== 'sera';
  });

  saveLocalUsers(list);
  return list;
}

/**
 * Update full user profile details (PRN, Dept, Year, Name, etc.)
 */
export async function updateUserProfileData(userId, updatedFields, adminUser) {
  if (!adminUser || adminUser.role !== 'admin') {
    return { success: false, error: 'Only administrators can modify student profile records.' };
  }

  const current = getLocalUsers();
  const targetStudent = current.find(u => u.uid === userId || u.email === userId);
  const targetUid = targetStudent?.uid || userId;

  if (targetStudent) {
    Object.assign(targetStudent, updatedFields);
    saveLocalUsers(current);
  }

  try {
    await setDoc(doc(db, 'users', targetUid), {
      ...updatedFields,
      updatedAt: new Date().toISOString(),
      updatedBy: adminUser.email || 'admin'
    }, { merge: true });
    return { success: true };
  } catch (err) {
    console.warn('Firestore update profile warning:', err.message);
    return { success: true }; // Local optimistic update
  }
}

export async function updateUserRole(userId, newRole, adminUser) {
  return updateUserProfileData(userId, { role: newRole }, adminUser);
}

/**
 * Ban or unban a student/user
 */
export async function toggleUserBan(userId, isBanned, reason = 'Administrative Action', adminUser) {
  const updates = {
    status: isBanned ? 'banned' : 'active',
    bannedReason: isBanned ? reason : null,
    bannedAt: isBanned ? new Date().toISOString() : null,
    bannedBy: isBanned ? (adminUser?.email || 'admin') : null
  };
  return updateUserProfileData(userId, updates, adminUser);
}

/**
 * Permanently remove a user from the directory
 * Deletes from Firestore 'users' collection and purges local cache
 */
export async function deleteDirectoryUser(userId, userEmail) {
  // Remove from localStorage cache immediately
  try {
    const raw = localStorage.getItem('ep_real_users_v5');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter(u => {
          const ue = (u.email || '').toLowerCase().trim();
          return ue !== (userEmail || '').toLowerCase().trim() && u.uid !== userId;
        });
        localStorage.setItem('ep_real_users_v5', JSON.stringify(filtered));
      }
    }
  } catch (e) {}

  // Delete from Firestore
  try {
    if (userId) await deleteDoc(doc(db, 'users', userId));
    // Also try deleting by email as doc ID
    if (userEmail) await deleteDoc(doc(db, 'users', userEmail)).catch(() => {});
  } catch (err) {
    console.warn('Firestore delete user warning:', err.message);
  }

  return { success: true };
}
