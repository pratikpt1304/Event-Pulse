import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  doc, 
  updateDoc, 
  setDoc,
  deleteDoc,
  orderBy 
} from 'firebase/firestore';

const LOCAL_VOLUNTEERS_KEY = 'ep_cached_volunteers';

function getLocalVolunteers(userId = null) {
  try {
    const raw = localStorage.getItem(LOCAL_VOLUNTEERS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (userId) return list.filter(v => v.userId === userId);
    return list;
  } catch (e) {
    return [];
  }
}

function saveLocalVolunteers(list) {
  try {
    localStorage.setItem(LOCAL_VOLUNTEERS_KEY, JSON.stringify(list));
  } catch (e) {}
}

export function getCachedVolunteersSync(userId = null) {
  return getLocalVolunteers(userId);
}

/**
 * Apply as Volunteer for an Event
 */
export async function applyForVolunteer({ eventId, eventTitle, user, preferredRole, reason, phone }) {
  if (!user) return { success: false, error: 'Please sign in to apply as a volunteer.' };

  const appId = `${eventId}_${user.uid}`;
  const appData = {
    id: appId,
    eventId,
    eventTitle,
    userId: user.uid,
    studentName: user.name,
    studentEmail: user.email,
    prn: user.prn || 'N/A',
    department: user.department,
    year: user.year,
    division: user.division || 'A',
    preferredRole: preferredRole || 'General Volunteering',
    reason: (reason || '').trim(),
    phone: (phone || '').trim(),
    status: 'pending', // 'pending' | 'accepted' | 'rejected' | 'completed'
    appliedAt: new Date().toISOString()
  };

  // Immediate local cache update
  const current = getLocalVolunteers();
  const existingIdx = current.findIndex(v => v.id === appId);
  if (existingIdx >= 0) {
    current[existingIdx] = appData;
  } else {
    current.unshift(appData);
  }
  saveLocalVolunteers(current);

  // Persist to Firestore
  try {
    await setDoc(doc(db, 'volunteers', appId), appData, { merge: true });
    return { success: true, application: appData };
  } catch (err) {
    console.warn('Volunteer apply notice:', err.message);
    return { success: true, application: appData };
  }
}

/**
 * Get all volunteer applications for a specific event (Organizer view)
 */
export async function getEventVolunteers(eventId) {
  try {
    const q = query(collection(db, 'volunteers'), where('eventId', '==', eventId));
    const snap = await Promise.race([
      getDocs(q),
      new Promise(res => setTimeout(() => res(null), 3000))
    ]);

    if (snap) {
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    return getLocalVolunteers().filter(v => v.eventId === eventId);
  } catch (err) {
    console.warn('Volunteer list fetch notice:', err.message);
    return getLocalVolunteers().filter(v => v.eventId === eventId);
  }
}

/**
 * Get student's volunteer applications (Student wallet view)
 */
export async function getStudentVolunteering(userId) {
  try {
    const q = query(collection(db, 'volunteers'), where('userId', '==', userId));
    const snap = await Promise.race([
      getDocs(q),
      new Promise(res => setTimeout(() => res(null), 3000))
    ]);

    if (snap) {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      saveLocalVolunteers(list);
      return list;
    }
    return getLocalVolunteers(userId);
  } catch (err) {
    return getLocalVolunteers(userId);
  }
}

/**
 * Update volunteer status by Organizer ('accepted' | 'rejected' | 'completed')
 */
export async function updateVolunteerStatus(appId, newStatus) {
  try {
    await setDoc(doc(db, 'volunteers', appId), { status: newStatus }, { merge: true });
    const current = getLocalVolunteers();
    const item = current.find(v => v.id === appId);
    if (item) item.status = newStatus;
    saveLocalVolunteers(current);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Delete / Withdraw Volunteer Application
 */
export async function deleteVolunteerApplication(appId) {
  try {
    await deleteDoc(doc(db, 'volunteers', appId));
    const current = getLocalVolunteers().filter(v => v.id !== appId);
    saveLocalVolunteers(current);
    return { success: true };
  } catch (err) {
    const current = getLocalVolunteers().filter(v => v.id !== appId);
    saveLocalVolunteers(current);
    return { success: true };
  }
}
