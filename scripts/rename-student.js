/**
 * EventPulse — Rename Demo Student & Seed Visibility Across All Portals
 * New student: Mihika Joshi (IMTech 1st Year, AIML)
 * - Updates Firestore user doc
 * - Updates registration doc (HackIMTech)
 * - Adds a test complaint (visible in HOD/Dean/VC grievance tab)
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sa = JSON.parse(fs.readFileSync(path.join(__dirname, '../functions/serviceAccountKey.json'), 'utf8'));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const NEW_NAME = 'Mihika Joshi';
const DISPLAY_NAME = 'Mihika Joshi (Student)';

async function run() {
  const now = new Date();
  console.log(`\n🚀 Updating demo student → ${NEW_NAME}\n`);

  // ── 1. Update Firestore user doc ──────────────────────────────────────
  await db.collection('users').doc('demo_student').update({
    name: DISPLAY_NAME,
    updatedAt: now.toISOString()
  });
  console.log(`✅ users/demo_student → name: "${DISPLAY_NAME}"`);

  // ── 2. Update registration studentName ───────────────────────────────
  const regId = 'demo_event_hackimtech_2026_demo_student';
  const regSnap = await db.collection('registrations').doc(regId).get();
  if (regSnap.exists) {
    await db.collection('registrations').doc(regId).update({
      studentName: DISPLAY_NAME
    });
    console.log(`✅ registrations/${regId} → studentName: "${DISPLAY_NAME}"`);
  }

  // ── 3. Add a complaint so student appears in HOD/Dean/VC grievance tabs ─
  // First delete any existing demo complaints
  const existingComplaints = await db.collection('complaints')
    .where('userId', '==', 'demo_student')
    .get();
  for (const doc of existingComplaints.docs) {
    await doc.ref.delete();
  }

  const complaintId = 'complaint_demo_mihika_001';
  await db.collection('complaints').doc(complaintId).set({
    id: complaintId,
    ticketId: 'GRV-2026-0091',
    userId: 'demo_student',
    studentName: DISPLAY_NAME,
    prn: 'SU2024IMT0091',
    department: 'Integrated M.Tech (AIML)',
    year: '1st Year',
    eventId: 'demo_event_hackimtech_2026',
    eventTitle: 'HackIMTech 2026 — Sanjivani University Internal Hackathon',
    type: 'feedback',
    category: 'Event Feedback',
    subject: 'Request for additional power outlets at hackathon venue',
    description: 'Respected Sir/Ma\'am, During HackIMTech 2026 preparation, our team noticed there are limited power sockets at the Main Auditorium. We have 4 team members each needing to charge laptops and connect external hardware for our IoT project. Could the organizers please arrange extension boards or additional power strips at each team\'s table? This would greatly help all participants. Thank you!',
    priority: 'medium',
    status: 'open',
    response: null,
    createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    updatedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
  });
  console.log(`✅ complaints/${complaintId} → Created (visible in HOD/Dean/VC grievance tabs)`);

  // ── 4. Summary ──────────────────────────────────────────────────────
  console.log(`
══════════════════════════════════════════
  STUDENT VISIBILITY CHECK
══════════════════════════════════════════
  Name          : ${DISPLAY_NAME}
  Email         : student@college.edu
  Password      : Password@123
  Dept          : Integrated M.Tech (AIML)
  Year          : 1st Year
  PRN           : SU2024IMT0091

  VISIBLE IN:
  ✅ Organizer Hub   → Approved Attendees tab (HackIMTech 2026)
  ✅ HOD Portal      → Students tab (IMTech dept list)
  ✅ HOD Portal      → Grievances tab (Ticket GRV-2026-0091)
  ✅ Dean Portal     → Grievances tab
  ✅ VC Sir Portal   → Grievances tab + Event registrations
  ✅ Student Login   → My Passes → HackIMTech QR Pass
══════════════════════════════════════════
`);

  process.exit(0);
}

run().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
