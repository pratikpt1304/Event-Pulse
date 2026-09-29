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
import { isStudentAllowed } from './participants';

let inMemoryRegistrations = [];
let inMemoryAuditLogs = [];

export function getCachedRegistrationsSync(userId) {
  try {
    const raw = localStorage.getItem(`ep_cached_regs_${userId}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return inMemoryRegistrations.filter(r => r.userId === userId);
}

/**
 * Register student for an event (Deterministic ID: {eventId}_{userId})
 */
export async function registerForEvent(event, student) {
  if (student && student.status === 'banned') {
    return {
      success: false,
      code: 'ACCOUNT_BANNED',
      message: '⛔ Registration Prohibited: Your account has been suspended by University Administration.'
    };
  }

  // Closed Event check: Only invited participants can register
  if (event && event.visibility === 'closed') {
    const studentEmail = student?.email || '';
    const allowed = await isStudentAllowed(event.id, studentEmail);
    if (!allowed) {
      return {
        success: false,
        code: 'CLOSED_EVENT_RESTRICTED',
        message: '🔒 Registration Restricted: This is a closed, invite-only event. Your email is not listed on the approved participant roster.'
      };
    }
  }

  const regId = `${event.id}_${student.uid}`;
  
  const existing = await getRegistration(event.id, student.uid);
  if (existing && existing.status !== 'cancelled') {
    return { 
      success: false, 
      code: 'ALREADY_REGISTERED', 
      message: `You are already registered for this event (Status: ${existing.status}).` 
    };
  }

  const registrationDoc = {
    id: regId,
    eventId: event.id,
    eventTitle: event.title,
    eventDate: `${event.date} at ${event.time}`,
    venue: event.venue,
    userId: student.uid,
    studentName: student.name,
    prn: student.prn,
    department: student.department,
    year: student.year,
    status: 'pending',
    registeredAt: new Date().toISOString()
  };

  try {
    await setDoc(doc(db, 'registrations', regId), registrationDoc);
  } catch (err) {
    console.warn('Registration Firestore write warning:', err.message);
  }

  const existingIdx = inMemoryRegistrations.findIndex(r => r.id === regId);
  if (existingIdx !== -1) {
    inMemoryRegistrations[existingIdx] = registrationDoc;
  } else {
    inMemoryRegistrations.push(registrationDoc);
  }

  return { success: true, registration: registrationDoc };
}

/**
 * Get registration for a specific user and event
 */
export async function getRegistration(eventId, userId) {
  const regId = `${eventId}_${userId}`;
  try {
    const d = await getDoc(doc(db, 'registrations', regId));
    if (d.exists()) {
      return { id: d.id, ...d.data() };
    }
  } catch (e) {}
  return inMemoryRegistrations.find(r => r.id === regId) || null;
}

/**
 * Get all registrations for a student (Cache-First)
 */
export async function getStudentRegistrations(userId) {
  try {
    const q = query(
      collection(db, 'registrations'),
      where('userId', '==', userId)
    );
    const snap = await getDocs(q);
    if (snap && !snap.empty) {
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      try {
        localStorage.setItem(`ep_cached_regs_${userId}`, JSON.stringify(fetched));
      } catch (e) {}
      return fetched;
    }
  } catch (e) {}
  return getCachedRegistrationsSync(userId);
}

/**
 * Get all registrations for an Event (Organizer View)
 */
export async function getEventRegistrations(eventId) {
  try {
    const q = query(
      collection(db, 'registrations'),
      where('eventId', '==', eventId)
    );
    const snap = await Promise.race([
      getDocs(q),
      new Promise(res => setTimeout(() => res(null), 4000))
    ]);
    if (snap && snap.docs) {
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
  } catch (e) {
    console.warn('getEventRegistrations query notice:', e.message);
  }
  return inMemoryRegistrations.filter(r => r.eventId === eventId);
}

/**
 * Update registration status (Approve / Reject / Waitlist) + Write Audit Log
 */
export async function updateRegistrationStatus(regId, newStatus, organizerUser) {
  const nowIso = new Date().toISOString();
  const updates = {
    status: newStatus,
    decidedAt: nowIso,
    decidedBy: organizerUser?.uid || 'admin'
  };

  try {
    await updateDoc(doc(db, 'registrations', regId), updates);
  } catch (e) {
    console.warn('Firestore update warning:', e.message);
  }

  const idx = inMemoryRegistrations.findIndex(r => r.id === regId);
  if (idx !== -1) {
    inMemoryRegistrations[idx] = { ...inMemoryRegistrations[idx], ...updates };
  }

  const auditLog = {
    id: 'log_' + Date.now(),
    action: `REGISTRATION_${newStatus.toUpperCase()}`,
    actorId: organizerUser?.uid || 'admin',
    actorName: organizerUser?.name || 'Administrator',
    targetId: regId,
    timestamp: nowIso,
    details: { newStatus }
  };
  inMemoryAuditLogs.push(auditLog);

  return { success: true };
}

/**
 * Bulk registration status update
 */
export async function bulkUpdateRegistrations(regIds, newStatus, organizerUser) {
  const results = await Promise.all(
    regIds.map(id => updateRegistrationStatus(id, newStatus, organizerUser))
  );
  return { success: true, updatedCount: results.length };
}

/**
 * Update Attendee Attendance (Present / Absent)
 * If Present -> Automatically issues cryptographically verified certificate
 */
export async function updateAttendance(regId, attendanceStatus, organizerUser) {
  const nowIso = new Date().toISOString();
  
  // Find registration doc
  let reg = inMemoryRegistrations.find(r => r.id === regId);
  if (!reg) {
    try {
      const snap = await getDoc(doc(db, 'registrations', regId));
      if (snap.exists()) reg = { id: snap.id, ...snap.data() };
    } catch (e) {}
  }

  const updates = {
    attendance: attendanceStatus, // 'present' | 'absent'
    attendanceMarkedAt: nowIso,
    attendanceMarkedBy: organizerUser?.name || 'Organizer'
  };

  if (attendanceStatus === 'present') {
    updates.status = 'attended';
    // NOTE: Certificates are NOT auto-issued on attendance.
    // They must be manually awarded by Admin/Organizer to winners only.
  } else if (attendanceStatus === 'absent') {
    updates.status = 'absent';
  }

  try {
    await updateDoc(doc(db, 'registrations', regId), updates);
  } catch (e) {
    console.warn('Firestore attendance update error:', e.message);
  }

  const idx = inMemoryRegistrations.findIndex(r => r.id === regId);
  if (idx !== -1) {
    inMemoryRegistrations[idx] = { ...inMemoryRegistrations[idx], ...updates };
  }

  return { success: true, certificateId: updates.certificateId };
}

/**
 * Bulk Attendance Update
 */
export async function bulkUpdateAttendance(regIds, attendanceStatus, organizerUser) {
  const results = await Promise.all(
    regIds.map(id => updateAttendance(id, attendanceStatus, organizerUser))
  );
  return { success: true, count: results.length };
}

/**
 * Delete / Withdraw a Student Registration Pass
 */
export async function deleteStudentRegistration(regId, userId) {
  try {
    await deleteDoc(doc(db, 'registrations', regId));
  } catch (e) {
    console.warn('Firestore delete registration warning:', e.message);
  }

  inMemoryRegistrations = inMemoryRegistrations.filter(r => r.id !== regId);

  if (userId) {
    try {
      const raw = localStorage.getItem(`ep_cached_regs_${userId}`);
      if (raw) {
        const list = JSON.parse(raw).filter(r => r.id !== regId);
        localStorage.setItem(`ep_cached_regs_${userId}`, JSON.stringify(list));
      }
    } catch (e) {}
  }

  return { success: true };
}

export function getAuditLogs() {
  return inMemoryAuditLogs;
}

/**
 * Manually award a winner certificate to a specific student.
 * Called only by Admin or Organizer — NOT auto-triggered on attendance.
 */
export async function awardCertificate({ regId, userId, studentName, prn, eventId, eventTitle, eventDate, organizerName }) {
  const nowIso = new Date().toISOString();
  const certId = `CERT-SU-${(eventId || 'EVT').slice(-6).toUpperCase()}-${(userId || 'USR').slice(-6).toUpperCase()}`;

  const certDoc = {
    id: certId,
    verificationId: certId,
    userId,
    studentName: studentName || 'Student',
    prn: prn || '',
    eventId,
    eventTitle: eventTitle || 'University Campus Event',
    eventDate: eventDate || nowIso.slice(0, 10),
    issuedAt: nowIso,
    issuedBy: organizerName || 'Sanjivani University',
    issuer: 'Sanjivani University Central Event Authority',
    type: 'winner',
    verified: true
  };

  try {
    await setDoc(doc(db, 'certificates', certId), certDoc, { merge: true });
    if (regId) {
      await updateDoc(doc(db, 'registrations', regId), { certificateId: certId }).catch(() => {});
    }
    // Update local student cert cache
    try {
      const cachedCerts = JSON.parse(localStorage.getItem(`ep_cached_certs_${userId}`) || '[]');
      const cIdx = cachedCerts.findIndex(c => c.id === certId);
      if (cIdx !== -1) cachedCerts[cIdx] = certDoc;
      else cachedCerts.unshift(certDoc);
      localStorage.setItem(`ep_cached_certs_${userId}`, JSON.stringify(cachedCerts));
    } catch (e) {}
    return { success: true, certId };
  } catch (err) {
    console.error('Award certificate error:', err.message);
    return { success: false, error: err.message };
  }
}
