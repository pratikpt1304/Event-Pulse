import { db } from '../firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  query, 
  where 
} from 'firebase/firestore';

let inMemoryEvents = [];

function saveCachedEvents(events) {
  try {
    localStorage.setItem('ep_cached_events', JSON.stringify(events));
  } catch (e) {}
}

export function getCachedEventsSync() {
  try {
    const raw = localStorage.getItem('ep_cached_events');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return inMemoryEvents.filter(e => e.status === 'approved');
}

/**
 * Fetch all approved upcoming events for Student Discovery from Firestore (Cache-First)
 */
export async function getApprovedEvents() {
  try {
    const q = query(
      collection(db, 'events'), 
      where('status', '==', 'approved')
    );
    const snap = await getDocs(q);
    if (snap) {
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      saveCachedEvents(fetched);
      return fetched;
    }
  } catch (err) {
    console.warn('Firestore fetch notice:', err.message);
  }
  return getCachedEventsSync();
}

/**
 * Fetch pending events for Admin Approval Screen from Firestore
 */
export async function getPendingEvents() {
  try {
    const q = query(
      collection(db, 'events'), 
      where('status', '==', 'pending_approval')
    );
    const snap = await getDocs(q);
    if (snap) {
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
  } catch (err) {
    console.warn('Firestore fetch notice:', err.message);
  }
  return inMemoryEvents.filter(e => e.status === 'pending_approval');
}

/**
 * Fetch events owned by an Organizer
 */
export async function getOrganizerEvents(organizerId) {
  try {
    const q = query(
      collection(db, 'events'), 
      where('organizerId', '==', organizerId)
    );
    const snap = await getDocs(q);
    if (snap) {
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
  } catch (err) {
    console.warn('Firestore fetch notice:', err.message);
  }
  return inMemoryEvents.filter(e => e.organizerId === organizerId);
}

/**
 * Fetch single event details by ID
 */
export async function getEventById(eventId) {
  try {
    const d = await getDoc(doc(db, 'events', eventId));
    if (d.exists()) {
      return { id: d.id, ...d.data() };
    }
  } catch (e) {}
  return inMemoryEvents.find(e => e.id === eventId) || null;
}

/**
 * Create a new event (saved to Firestore with status 'pending_approval' or custom status)
 */
export async function createEvent(eventPayload, user) {
  const eventId = eventPayload.id || 'evt_' + Date.now();
  const orgId = eventPayload.organizerId || user?.uid || 'admin';
  const orgName = eventPayload.organizerName || user?.name || user?.displayName || 'Faculty / Admin';
  const finalStatus = eventPayload.status || 'pending_approval';

  const newEvent = {
    id: eventId,
    ...eventPayload,
    organizerId: orgId,
    organizerName: orgName,
    status: finalStatus,
    createdAt: eventPayload.createdAt || new Date().toISOString()
  };

  try {
    await Promise.race([
      setDoc(doc(db, 'events', eventId), newEvent),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))
    ]);
  } catch (err) {
    console.warn('Firestore write notice:', err.message);
  }
  
  inMemoryEvents.unshift(newEvent);
  try {
    const raw = localStorage.getItem('ep_cached_events');
    const list = raw ? JSON.parse(raw) : [];
    list.unshift(newEvent);
    saveCachedEvents(list);
  } catch (e) {}

  return { success: true, event: newEvent };
}

/**
 * Fetch all events (including approved and completed)
 */
export async function getAllEvents() {
  try {
    const snap = await getDocs(collection(db, 'events'));
    if (snap && !snap.empty) {
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      saveCachedEvents(fetched);
      return fetched;
    }
  } catch (err) {
    console.warn('Firestore fetch notice:', err.message);
  }
  return inMemoryEvents;
}

/**
 * Fetch completed / archived events
 */
export async function getCompletedEvents() {
  try {
    const q = query(
      collection(db, 'events'), 
      where('status', '==', 'completed')
    );
    const snap = await getDocs(q);
    if (snap && !snap.empty) {
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
  } catch (err) {
    console.warn('Firestore fetch notice:', err.message);
  }
  return inMemoryEvents.filter(e => e.status === 'completed');
}

/**
 * Admin / Organizer: Mark event as Completed (moves to History Archive)
 */
export async function markEventCompleted(eventId, user) {
  const updates = {
    status: 'completed',
    completedAt: new Date().toISOString(),
    completedBy: user?.name || 'Administrator'
  };

  try {
    await updateDoc(doc(db, 'events', eventId), updates);
  } catch (e) {
    console.warn('Firestore complete event error:', e.message);
  }

  const idx = inMemoryEvents.findIndex(e => e.id === eventId);
  if (idx !== -1) {
    inMemoryEvents[idx] = { ...inMemoryEvents[idx], ...updates };
  }
  return { success: true };
}

/**
 * Admin / Organizer: Reopen completed event back to Approved
 */
export async function reopenEvent(eventId, user) {
  const updates = {
    status: 'approved',
    reopenedAt: new Date().toISOString(),
    reopenedBy: user?.name || 'Administrator'
  };

  try {
    await updateDoc(doc(db, 'events', eventId), updates);
  } catch (e) {
    console.warn('Firestore reopen event error:', e.message);
  }

  const idx = inMemoryEvents.findIndex(e => e.id === eventId);
  if (idx !== -1) {
    inMemoryEvents[idx] = { ...inMemoryEvents[idx], ...updates };
  }
  return { success: true };
}

/**
 * Admin action: Approve or Reject event
 */
export async function updateEventStatus(eventId, newStatus, adminUser) {
  try {
    await updateDoc(doc(db, 'events', eventId), {
      status: newStatus,
      reviewedBy: adminUser.uid,
      reviewedAt: new Date().toISOString()
    });
  } catch (e) {
    console.warn('Firestore update notice:', e.message);
  }

  const idx = inMemoryEvents.findIndex(e => e.id === eventId);
  if (idx !== -1) {
    inMemoryEvents[idx].status = newStatus;
  }
  return { success: true };
}

/**
 * Admin action: Permanently Delete Event
 */
export async function deleteEvent(eventId) {
  try {
    await deleteDoc(doc(db, 'events', eventId));
  } catch (e) {
    console.warn('Firestore deleteEvent warning:', e.message);
  }

  inMemoryEvents = inMemoryEvents.filter(e => e.id !== eventId);
  try {
    const raw = localStorage.getItem('ep_cached_events');
    if (raw) {
      const list = JSON.parse(raw).filter(e => e.id !== eventId);
      saveCachedEvents(list);
    }
  } catch (e) {}

  return { success: true };
}
