import { db } from '../firebase';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  doc, 
  setDoc,
  deleteDoc,
  orderBy 
} from 'firebase/firestore';

const LOCAL_COMPLAINTS_KEY = 'ep_cached_complaints';

function getLocalComplaints() {
  try {
    const raw = localStorage.getItem(LOCAL_COMPLAINTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalComplaints(list) {
  try {
    localStorage.setItem(LOCAL_COMPLAINTS_KEY, JSON.stringify(list));
  } catch (e) {}
}

export function getCachedComplaintsSync() {
  return getLocalComplaints();
}

/**
 * File a Complaint or Incident Grievance
 */
export async function fileGrievance({ 
  eventId, 
  eventTitle, 
  category, 
  description, 
  isAnonymous, 
  user, 
  contactPhone 
}) {
  const ticketId = 'GRV-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  
  const complaintData = {
    id: ticketId,
    ticketId,
    eventId: eventId || 'general_campus',
    eventTitle: eventTitle || 'General Campus Event Inquiry',
    category: category || 'Misbehavior / Harassment',
    description: (description || '').trim(),
    isAnonymous: !!isAnonymous,
    ownerUid: user ? user.uid : 'guest', // Private owner UID for student wallet
    userId: isAnonymous ? 'anonymous' : (user ? (user.uid || 'guest') : 'guest'),
    authorName: isAnonymous ? 'Anonymous Student' : (user ? (user.name || user.displayName || 'Student') : 'Student'),
    reporterName: isAnonymous ? 'Anonymous Student' : (user ? (user.name || user.displayName || 'Student') : 'Student'),
    authorEmail: isAnonymous ? 'Hidden' : (user ? (user.email || 'N/A') : 'N/A'),
    reporterEmail: isAnonymous ? 'Hidden' : (user ? (user.email || 'N/A') : 'N/A'),
    reporterPrn: isAnonymous ? 'Hidden' : (user ? (user.prn || 'N/A') : 'N/A'),
    reporterDept: isAnonymous ? 'Hidden' : (user ? (user.department || 'General') : 'General'),
    contactPhone: (contactPhone || '').trim(),
    status: 'pending', // 'pending' | 'investigating' | 'resolved' | 'dismissed'
    resolutionNote: '',
    createdAt: new Date().toISOString()
  };

  // Immediate local cache
  recordMyTicketId(ticketId);
  const current = getLocalComplaints();
  current.unshift(complaintData);
  saveLocalComplaints(current);

  // Persist to Firestore
  try {
    await setDoc(doc(db, 'complaints', ticketId), complaintData);
    return { success: true, ticketId, complaint: complaintData };
  } catch (err) {
    console.warn('Complaint submit notice:', err.message);
    return { success: true, ticketId, complaint: complaintData };
  }
}

const MY_FILED_TICKETS_KEY = 'ep_my_filed_ticket_ids';

export function recordMyTicketId(ticketId) {
  try {
    const raw = localStorage.getItem(MY_FILED_TICKETS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    if (!list.includes(ticketId)) {
      list.unshift(ticketId);
      localStorage.setItem(MY_FILED_TICKETS_KEY, JSON.stringify(list));
    }
  } catch (e) {}
}

export function getMyFiledTicketIds() {
  try {
    const raw = localStorage.getItem(MY_FILED_TICKETS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Get all complaints filed by the current student (including anonymous)
 */
export async function getStudentComplaints(user) {
  const all = await getComplaints();
  if (!user) return [];
  const myTicketIds = getMyFiledTicketIds();
  
  return all.filter(c => 
    (c.ownerUid && c.ownerUid === user.uid) ||
    (c.userId && c.userId === user.uid) ||
    (c.reporterEmail && c.reporterEmail !== 'Hidden' && c.reporterEmail.toLowerCase() === (user.email || '').toLowerCase()) ||
    (c.authorEmail && c.authorEmail !== 'Hidden' && c.authorEmail.toLowerCase() === (user.email || '').toLowerCase()) ||
    myTicketIds.includes(c.id) ||
    myTicketIds.includes(c.ticketId)
  );
}

export function getCachedStudentComplaintsSync(user) {
  const all = getLocalComplaints();
  if (!user) return [];
  const myTicketIds = getMyFiledTicketIds();
  
  return all.filter(c => 
    (c.ownerUid && c.ownerUid === user.uid) ||
    (c.userId && c.userId === user.uid) ||
    (c.reporterEmail && c.reporterEmail !== 'Hidden' && c.reporterEmail.toLowerCase() === (user.email || '').toLowerCase()) ||
    (c.authorEmail && c.authorEmail !== 'Hidden' && c.authorEmail.toLowerCase() === (user.email || '').toLowerCase()) ||
    myTicketIds.includes(c.id) ||
    myTicketIds.includes(c.ticketId)
  );
}

/**
 * Get Complaints for an Event or All Complaints (Organizer / Admin)
 */
export async function getComplaints(eventId = null) {
  try {
    let q;
    if (eventId) {
      q = query(collection(db, 'complaints'), where('eventId', '==', eventId));
    } else {
      q = query(collection(db, 'complaints'));
    }

    const snap = await Promise.race([
      getDocs(q),
      new Promise(res => setTimeout(() => res(null), 10000))
    ]);

    if (snap && snap.docs) {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      if (!eventId) {
        saveLocalComplaints(list);
      }
      return list;
    }
    return getLocalComplaints().filter(c => !eventId || c.eventId === eventId);
  } catch (err) {
    return getLocalComplaints().filter(c => !eventId || c.eventId === eventId);
  }
}

/**
 * Update Complaint Status and Resolution Note
 */
export async function updateComplaintStatus(ticketId, newStatus, resolutionNote = '') {
  try {
    await setDoc(doc(db, 'complaints', ticketId), { 
      status: newStatus, 
      resolutionNote: resolutionNote,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    const current = getLocalComplaints();
    const item = current.find(c => c.id === ticketId || c.ticketId === ticketId);
    if (item) {
      item.status = newStatus;
      item.resolutionNote = resolutionNote;
    }
    saveLocalComplaints(current);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function deleteComplaint(ticketId, user = null) {
  // 1. Immediately remove from local cache and my tickets list
  const current = getLocalComplaints();
  const updated = current.filter(c => c.id !== ticketId && c.ticketId !== ticketId);
  saveLocalComplaints(updated);

  try {
    const myTickets = getMyFiledTicketIds().filter(tid => tid !== ticketId);
    localStorage.setItem(MY_FILED_TICKETS_KEY, JSON.stringify(myTickets));
  } catch (e) {}

  // 2. Delete from Firestore
  try {
    await deleteDoc(doc(db, 'complaints', ticketId));
  } catch (err) {
    console.warn('Firestore complaint deletion notice:', err);
  }
  return { success: true };
}

export const getAllComplaints = getComplaints;

