import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sa = JSON.parse(fs.readFileSync(path.join(__dirname, '../functions/serviceAccountKey.json'), 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const db = admin.firestore();

async function seedCertificate() {
  console.log('🌟 Seeding Completed Event & Verified Certificate for Mihika Joshi...');

  // 1. Completed Event: Sanjivani National AI Summit 2025
  const completedEventId = 'demo_event_ai_summit_2025';
  const completedEvent = {
    id: completedEventId,
    title: 'Sanjivani National AI Summit 2025',
    category: 'Technical',
    department: 'Integrated M.Tech (AIML)',
    eligibleDepartments: ['All Departments'],
    eligibleYears: ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Post Graduate'],
    date: '2025-12-15',
    time: '09:30 AM – 05:30 PM',
    venue: 'APJ Abdul Kalam Convention Center, Sanjivani University',
    maxParticipants: 500,
    status: 'completed',
    approvalStatus: 'approved',
    hodApproved: true,
    deanApproved: true,
    vcApproved: true,
    organizerId: 'demo_organizer',
    organizerName: 'Hariprasath (Lead Organizer)',
    completedAt: '2025-12-16T18:00:00.000Z',
    completedBy: 'Hariprasath (Lead Organizer)',
    createdAt: '2025-11-20T10:00:00.000Z',
    updatedAt: '2025-12-16T18:00:00.000Z'
  };
  await db.collection('events').doc(completedEventId).set(completedEvent, { merge: true });
  console.log('✓ Completed event seeded:', completedEvent.title);

  // 2. Verified Certificate
  const certId = 'CERT-SU-2025-0091';
  const certDoc = {
    id: certId,
    verificationId: certId,
    userId: 'demo_student',
    studentName: 'Mihika Joshi',
    prn: 'SU2024IMT0091',
    department: 'Integrated M.Tech (AIML)',
    year: '1st Year',
    division: 'IMT-A',
    eventId: completedEventId,
    eventTitle: 'Sanjivani National AI Summit 2025',
    eventDate: '15 Dec 2025',
    organizerName: 'Hariprasath (Lead Organizer)',
    issuedAt: '2025-12-16T12:00:00.000Z',
    status: 'issued',
    valid: true
  };
  await db.collection('certificates').doc(certId).set(certDoc, { merge: true });
  console.log('✓ Verified Certificate seeded:', certId);

  // 3. Attended Registration record linking the certificate
  const regId = 'reg_mihika_summit_2025';
  const regDoc = {
    id: regId,
    userId: 'demo_student',
    eventId: completedEventId,
    eventTitle: 'Sanjivani National AI Summit 2025',
    studentName: 'Mihika Joshi',
    prn: 'SU2024IMT0091',
    department: 'Integrated M.Tech (AIML)',
    year: '1st Year',
    division: 'IMT-A',
    status: 'attended',
    attendance: 'present',
    certificateId: certId,
    registeredAt: '2025-11-25T14:30:00.000Z',
    attendedAt: '2025-12-15T09:45:00.000Z',
    decidedBy: 'Hariprasath (Organizer)'
  };
  await db.collection('registrations').doc(regId).set(regDoc, { merge: true });
  console.log('✓ Attended registration record seeded:', regId);

  console.log('\n🎉 Done! Mihika Joshi now has a verified certificate ready to download.');
}

seedCertificate().catch(console.error);
