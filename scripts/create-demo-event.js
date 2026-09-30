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

async function run() {
  const now = new Date();
  // Event 7 days from now
  const eventDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const deadlineDate = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

  const dateStr = eventDate.toISOString().split('T')[0];
  const deadlineStr = deadlineDate.toISOString().split('T')[0];

  const eventId = 'demo_event_hackimtech_2026';

  const description = [
    '### 🌟 Event Overview',
    'Join us for **HackIMTech 2026**, an official **TECHNICAL** hackathon hosted by the Department of **Integrated M.Tech (AIML)** at Sanjivani University.',
    '',
    '### 🎯 What to Build?',
    '- AI/ML solutions for real campus problems',
    '- Web/Mobile apps for student productivity',
    '- IoT or automation projects for smart campus',
    '',
    '### 📋 Participation Guidelines',
    '1. Teams of 2–4 members allowed. Solo participation also welcome!',
    '2. All participants must present their **EventPulse Digital QR Pass** at the registration desk.',
    '3. Bring your laptop, charger, and student ID card.',
    '4. Attendance will be verified digitally for certificate issuance.',
    '',
    '### 🏆 Prizes & Recognition',
    '- 🥇 **Winner**: ₹5,000 Cash + Trophy + Merit Certificate',
    '- 🥈 **Runner-Up**: ₹3,000 Cash + Certificate',
    '- 🥉 **2nd Runner-Up**: ₹1,500 Cash + Certificate',
    '- ⭐ **All Participants**: Official Participation Certificate'
  ].join('\n');

  const eventDoc = {
    id: eventId,
    title: 'HackIMTech 2026 — Sanjivani University Internal Hackathon',
    description,
    category: 'Technical',
    department: 'Integrated M.Tech (AIML)',
    eligibleDepartments: ['All Departments'],
    eligibleYears: ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Post Graduate'],
    date: dateStr,
    time: '09:00 AM – 06:00 PM',
    venue: 'Main Auditorium, Sanjivani University',
    maxParticipants: 200,
    registrationDeadline: deadlineStr,
    status: 'approved',
    approvalStatus: 'approved',
    hodApproved: true,
    deanApproved: true,
    vcApproved: true,
    isFeatured: true,
    tags: ['hackathon', 'aiml', 'coding', 'technical', 'prize'],
    organizerId: 'demo_organizer',
    organizerName: 'Pratik Thorat (Event Lead)',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    totalRegistrations: 0,
    coverImage: null,
    prizes: '₹5,000 + ₹3,000 + ₹1,500',
    teamSize: '1–4 members',
    entryFee: 'Free',
    refreshments: 'Complimentary lunch & snacks for all registered participants'
  };

  await db.collection('events').doc(eventId).set(eventDoc);
  console.log('✅ Demo event created successfully!');
  console.log('   ID    :', eventId);
  console.log('   Title :', eventDoc.title);
  console.log('   Date  :', eventDoc.date);
  console.log('   Status:', eventDoc.status);

  const snap = await db.collection('events').get();
  console.log('   Total events in DB now:', snap.size);
  process.exit(0);
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
