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

export const DEFAULT_TIERED_EVENTS = [
  {
    id: 'evt_vc_conclave',
    title: 'National AI & Autonomous Systems Conclave 2026',
    description: 'Flagship university-wide summit featuring keynote addresses from global AI leaders, research paper tracks, and autonomous agent demonstrations. Final university charter approval.',
    organizerId: 'demo_user_organizer',
    organizerName: 'Pratik Thorat (Lead Organizer)',
    department: 'IMTech (AIML)',
    school: 'School of Computing & Engineering',
    date: '2026-10-15',
    time: '10:00 AM',
    venue: 'Sanjivani Central Convention Auditorium',
    eligibleDepartments: ['All Departments', 'IMTech (AIML)', 'Computer Engineering', 'Information Technology'],
    eligibleYears: ['All Years'],
    maxParticipants: 500,
    registrationDeadline: '2026-10-10',
    status: 'pending_vc',
    createdAt: '2026-09-27T10:00:00.000Z',
    hodApproval: {
      approvedBy: 'Prof. Anwar Shaikh (HOD)',
      role: 'HOD',
      department: 'IMTech (AIML)',
      date: '2026-09-27T14:30:00.000Z',
      comments: 'Recommended with highest priority. Lab resources and student volunteers provisioned.'
    },
    deanApproval: {
      approvedBy: 'Dr. Kavita (Dean)',
      role: 'Dean',
      school: 'School of Computing & Engineering',
      date: '2026-09-28T11:15:00.000Z',
      comments: 'School-level budget and inter-departmental logistics verified. Escalated to Hon. Vice Chancellor for final university authorization.'
    }
  },
  {
    id: 'evt_dean_hackathon',
    title: 'State-Level Inter-Collegiate Hackathon 4.0',
    description: '36-hour non-stop hackathon tackling smart agriculture, healthcare diagnostics, and fintech solutions with cash rewards of ₹1,50,000.',
    organizerId: 'demo_user_organizer',
    organizerName: 'Pratik Thorat (Lead Organizer)',
    department: 'IMTech (AIML)',
    school: 'School of Computing & Engineering',
    date: '2026-10-22',
    time: '09:00 AM',
    venue: 'Design Thinking & Innovation Lab (DTIL)',
    eligibleDepartments: ['IMTech (AIML)', 'Computer Engineering', 'Information Technology'],
    eligibleYears: ['1st Year', '2nd Year', '3rd Year', '4th Year'],
    maxParticipants: 200,
    registrationDeadline: '2026-10-18',
    status: 'pending_dean',
    createdAt: '2026-09-28T09:00:00.000Z',
    hodApproval: {
      approvedBy: 'Prof. Anwar Shaikh (HOD)',
      role: 'HOD',
      department: 'IMTech (AIML)',
      date: '2026-09-28T16:00:00.000Z',
      comments: 'Curriculum alignment verified. Sponsorship committee formed.'
    }
  },
  {
    id: 'evt_hod_drone_championship',
    title: 'Autonomous Drone Racing & Robotics Championship',
    description: 'FPV and autonomous obstacle avoidance drone tournament hosted at the university sports complex. Open to all engineering innovators.',
    organizerId: 'demo_user_organizer',
    organizerName: 'Pratik Thorat (Lead Organizer)',
    department: 'IMTech (AIML)',
    school: 'School of Computing & Engineering',
    date: '2026-11-05',
    time: '09:30 AM',
    venue: 'University Sports Arena & Flying Grounds',
    eligibleDepartments: ['IMTech (AIML)', 'Computer Engineering', 'Electronics & Telecom', 'Mechanical'],
    eligibleYears: ['All Years'],
    maxParticipants: 120,
    registrationDeadline: '2026-11-01',
    status: 'pending_hod',
    createdAt: '2026-09-29T15:00:00.000Z'
  },
  {
    id: 'evt_hackathon_2026',
    title: 'Hackathon 2026: AI & Cloud Systems',
    description: 'Annual 24-hour inter-departmental hackathon focused on building intelligent web and cloud applications. Cash prizes, certificates, and mentor sessions provided.',
    organizerId: 'demo_user_organizer',
    organizerName: 'Prof. Anwar Shaikh / Pratik Thorat',
    department: 'IMTech (AIML)',
    school: 'School of Computing & Engineering',
    date: '2026-09-10',
    time: '09:00 AM',
    venue: 'Main University Auditorium & Lab 4',
    eligibleDepartments: ['Computer Science', 'Information Technology', 'IMTech (AIML)'],
    eligibleYears: ['1st Year', '2nd Year', '3rd Year', '4th Year'],
    maxParticipants: 150,
    registrationDeadline: '2026-09-08',
    status: 'approved',
    createdAt: '2026-08-20T10:00:00.000Z',
    hodApproval: { approvedBy: 'Prof. Anwar Shaikh (HOD)', role: 'HOD', date: '2026-08-21T10:00:00.000Z', comments: 'Approved' },
    deanApproval: { approvedBy: 'Dr. Kavita (Dean)', role: 'Dean', date: '2026-08-22T10:00:00.000Z', comments: 'Approved' },
    vcApproval: { approvedBy: 'Prof. (Dr.) S. B. Patil (VC)', role: 'VC', date: '2026-08-23T10:00:00.000Z', comments: 'Sanctioned' }
  },
  {
    id: 'evt_tech_symposium',
    title: 'National Tech & Innovation Symposium',
    description: 'Inter-disciplinary symposium showcasing student research papers, industry patents, and hardware prototypes.',
    organizerId: 'demo_user_organizer',
    organizerName: 'School of Computing & Engineering',
    department: 'Computer Engineering',
    school: 'School of Computing & Engineering',
    date: '2026-08-25',
    time: '10:00 AM',
    venue: 'Seminar Hall B, Central Block',
    eligibleDepartments: ['All Departments'],
    eligibleYears: ['All Years'],
    maxParticipants: 250,
    registrationDeadline: '2026-08-20',
    status: 'approved',
    createdAt: '2026-08-10T10:00:00.000Z',
    vcApproval: { approvedBy: 'Prof. (Dr.) S. B. Patil (VC)', role: 'VC', date: '2026-08-15T10:00:00.000Z', comments: 'Sanctioned' }
  },
  {
    id: 'evt_ai_robotics',
    title: 'Hands-on AI & Autonomous Robotics BootCamp',
    description: 'Intensive 3-day bootcamp covering ROS2, computer vision, kinematics, and real-time edge AI deployment on robotic arms.',
    organizerId: 'demo_user_organizer',
    organizerName: 'Prof. Anwar Shaikh (HOD)',
    department: 'IMTech (AIML)',
    school: 'School of Computing & Engineering',
    date: '2026-08-14',
    time: '09:00 AM',
    venue: 'Robotics Research Centre (Lab 707)',
    eligibleDepartments: ['IMTech (AIML)', 'Computer Engineering'],
    eligibleYears: ['1st Year', '2nd Year'],
    maxParticipants: 80,
    registrationDeadline: '2026-08-10',
    status: 'approved',
    createdAt: '2026-08-01T10:00:00.000Z',
    vcApproval: { approvedBy: 'Prof. (Dr.) S. B. Patil (VC)', role: 'VC', date: '2026-08-05T10:00:00.000Z', comments: 'Sanctioned' }
  },
  {
    id: 'evt_esports_fest',
    title: 'Campus Esports & Coding League 2026',
    description: 'Fast-paced algorithmic battle rounds mixed with LAN gaming tournament. High energy campus engagement weekend.',
    organizerId: 'demo_user_organizer',
    organizerName: 'Pratik Thorat',
    department: 'IMTech (AIML)',
    school: 'School of Computing & Engineering',
    date: '2026-08-05',
    time: '11:00 AM',
    venue: 'Indoor Sports Complex',
    eligibleDepartments: ['All Departments'],
    eligibleYears: ['All Years'],
    maxParticipants: 300,
    registrationDeadline: '2026-08-02',
    status: 'approved',
    createdAt: '2026-07-25T10:00:00.000Z',
    vcApproval: { approvedBy: 'Prof. (Dr.) S. B. Patil (VC)', role: 'VC', date: '2026-07-28T10:00:00.000Z', comments: 'Sanctioned' }
  },
  {
    id: 'evt_cybersec_workshop',
    title: 'Ethical Hacking & Zero-Trust Defense',
    description: 'Hands-on practical sessions in cybersecurity, web vulnerabilities, CTF challenges, and industry certificate credentials.',
    organizerId: 'demo_user_organizer',
    organizerName: 'Prof. Anwar Shaikh',
    department: 'IMTech (AIML)',
    school: 'School of Computing & Engineering',
    date: '2026-07-22',
    time: '10:00 AM',
    venue: 'CSE Supercomputing Lab',
    eligibleDepartments: ['IMTech (AIML)', 'Computer Engineering', 'Information Technology'],
    eligibleYears: ['All Years'],
    maxParticipants: 100,
    registrationDeadline: '2026-07-18',
    status: 'approved',
    createdAt: '2026-07-10T10:00:00.000Z',
    vcApproval: { approvedBy: 'Prof. (Dr.) S. B. Patil (VC)', role: 'VC', date: '2026-07-14T10:00:00.000Z', comments: 'Sanctioned' }
  }
];

function getStoredEvents() {
  try {
    const raw = localStorage.getItem('ep_cached_events');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Ensure default tiered events are merged if not present
        const merged = [...parsed];
        DEFAULT_TIERED_EVENTS.forEach(de => {
          if (!merged.some(e => e.id === de.id)) {
            merged.push(de);
          }
        });
        return merged;
      }
    }
  } catch (e) {}
  return [...DEFAULT_TIERED_EVENTS];
}

let inMemoryEvents = getStoredEvents();

function saveCachedEvents(events) {
  try {
    localStorage.setItem('ep_cached_events', JSON.stringify(events));
  } catch (e) {}
}

export function getCachedEventsSync() {
  return inMemoryEvents;
}

export async function approveEventTier(eventId, tier, approverUser, comments = '') {
  let newStatus = 'approved';
  const approvalRecord = {
    approvedBy: approverUser?.name || 'Executive Authority',
    approvedByEmail: approverUser?.email || '',
    role: tier.toUpperCase(),
    date: new Date().toISOString(),
    comments: comments || `Approved by ${tier.toUpperCase()}`
  };

  const updates = { reviewedAt: new Date().toISOString() };

  if (tier === 'hod') {
    newStatus = 'pending_dean';
    updates.status = newStatus;
    updates.hodApproval = approvalRecord;
  } else if (tier === 'dean') {
    newStatus = 'pending_vc';
    updates.status = newStatus;
    updates.deanApproval = approvalRecord;
  } else if (tier === 'vc') {
    newStatus = 'approved';
    updates.status = newStatus;
    updates.vcApproval = approvalRecord;
  } else if (tier === 'fast_track_admin') {
    newStatus = 'approved';
    updates.status = 'approved';
    updates.vcApproval = approvalRecord;
    updates.deanApproval = approvalRecord;
    updates.hodApproval = approvalRecord;
  } else if (tier === 'reject') {
    newStatus = 'rejected';
    updates.status = 'rejected';
    updates.rejection = {
      rejectedBy: approverUser?.name || 'Executive Authority',
      reason: comments || 'Revision requested before authorization',
      date: new Date().toISOString()
    };
  }

  try {
    await updateDoc(doc(db, 'events', eventId), updates);
  } catch (e) {
    console.warn('Firestore tier approval notice:', e.message);
  }

  const idx = inMemoryEvents.findIndex(e => e.id === eventId);
  if (idx !== -1) {
    inMemoryEvents[idx] = { ...inMemoryEvents[idx], ...updates };
  } else {
    inMemoryEvents.unshift({ id: eventId, ...updates });
  }

  saveCachedEvents(inMemoryEvents);
  return { success: true, newStatus, event: inMemoryEvents.find(e => e.id === eventId) };
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
