/**
 * EventPulse — Full Platform Setup Script
 * Does everything:
 *  1. Adds cover image to demo event (HackIMTech 2026)
 *  2. Creates a second demo event (pending approval, to test HOD/Dean/VC flow)
 *  3. Creates a test student registration (approved) → QR pass ready
 *  4. Creates a campus notice/announcement from Admin
 *  5. Prints a full platform health summary
 */

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
  console.log('\n🚀 EventPulse Platform Setup — Starting...\n');

  // ─────────────────────────────────────────────────────────────────────
  // STEP 1: Update demo event with cover image
  // ─────────────────────────────────────────────────────────────────────
  console.log('📸 Step 1: Adding cover image to HackIMTech 2026...');
  await db.collection('events').doc('demo_event_hackimtech_2026').update({
    coverImage: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&q=80',
    bannerColor: '#6c63ff',
    updatedAt: now.toISOString()
  });
  console.log('   ✅ Cover image added.\n');

  // ─────────────────────────────────────────────────────────────────────
  // STEP 2: Create a second demo event (pending HOD approval)
  // ─────────────────────────────────────────────────────────────────────
  console.log('📋 Step 2: Creating a pending-approval event for workflow test...');
  const event2Date = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days from now
  const event2DeadlineDate = new Date(now.getTime() + 12 * 24 * 60 * 60 * 1000);

  const event2Description = [
    '### 🌟 Event Overview',
    'Join us for **CricketFest 2026** — the Annual Inter-Batch Cricket Tournament organized by IMTech Students Council at Sanjivani University.',
    '',
    '### 🏏 Tournament Format',
    '- **T10 Format**: 10 overs per side, fast-paced matches',
    '- **Teams**: 4 teams (1st Year A, 1st Year B, 2nd Year A, 2nd Year B)',
    '- **Venue**: Sanjivani University Sports Ground',
    '',
    '### 📋 Participation Guidelines',
    '1. Register as Player or Volunteer (match coordinator, scorer, umpire)',
    '2. Show your **EventPulse QR Pass** at the sports ground entry.',
    '3. Each team max 11 players + 4 substitutes.',
    '',
    '### 🏆 Prizes',
    '- 🥇 **Winning Team**: Trophy + Individual Medals',
    '- 🎖️ **Best Batter & Best Bowler** special awards',
    '- ⭐ **All Participants**: Participation Certificate'
  ].join('\n');

  await db.collection('events').doc('demo_event_cricket_2026').set({
    id: 'demo_event_cricket_2026',
    title: 'CricketFest 2026 — IMTech Annual Cricket Tournament',
    description: event2Description,
    category: 'Sports',
    department: 'Integrated M.Tech (AIML)',
    eligibleDepartments: ['Integrated M.Tech (AIML)'],
    eligibleYears: ['1st Year', '2nd Year'],
    date: event2Date.toISOString().split('T')[0],
    time: '08:00 AM – 06:00 PM',
    venue: 'Sanjivani University Sports Ground',
    maxParticipants: 60,
    registrationDeadline: event2DeadlineDate.toISOString().split('T')[0],
    status: 'pending_approval',
    approvalStatus: 'pending_hod',
    hodApproved: false,
    deanApproved: false,
    vcApproved: false,
    isFeatured: false,
    tags: ['cricket', 'sports', 'tournament', 'imtech'],
    organizerId: 'demo_organizer',
    organizerName: 'Pratik Thorat (Event Lead)',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    totalRegistrations: 0,
    coverImage: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=800&q=80',
    prizes: 'Trophy + Medals + Certificates',
    teamSize: '11 players per team',
    entryFee: 'Free',
    refreshments: 'Complimentary water & snacks at sports ground'
  });
  console.log('   ✅ Pending event "CricketFest 2026" created (awaiting HOD approval).\n');

  // ─────────────────────────────────────────────────────────────────────
  // STEP 3: Find the demo student user to create a registration
  // ─────────────────────────────────────────────────────────────────────
  console.log('🎫 Step 3: Creating a test student registration for HackIMTech 2026...');

  // Find student user by email
  const usersSnap = await db.collection('users').where('email', '==', 'student@college.edu').get();
  let studentUser = null;
  if (!usersSnap.empty) {
    studentUser = { id: usersSnap.docs[0].id, ...usersSnap.docs[0].data() };
    console.log(`   Found student: ${studentUser.name} (uid: ${studentUser.id})`);
  } else {
    // fallback: just look for first student
    const fallbackSnap = await db.collection('users').where('role', '==', 'student').limit(1).get();
    if (!fallbackSnap.empty) {
      studentUser = { id: fallbackSnap.docs[0].id, ...fallbackSnap.docs[0].data() };
      console.log(`   Found fallback student: ${studentUser.name} (uid: ${studentUser.id})`);
    }
  }

  if (studentUser) {
    const eventId = 'demo_event_hackimtech_2026';
    const regId = `${eventId}_${studentUser.id}`;
    await db.collection('registrations').doc(regId).set({
      id: regId,
      eventId,
      eventTitle: 'HackIMTech 2026 — Sanjivani University Internal Hackathon',
      eventDate: `${new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]} at 09:00 AM – 06:00 PM`,
      venue: 'Main Auditorium, Sanjivani University',
      userId: studentUser.id,
      studentName: studentUser.name || 'Student',
      prn: studentUser.prn || 'SU-2024-001',
      department: studentUser.department || 'Integrated M.Tech (AIML)',
      year: studentUser.year || '1st Year',
      status: 'approved',
      registeredAt: new Date(now.getTime() - 30 * 60 * 1000).toISOString(), // 30 min ago
      decidedAt: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
      decidedBy: 'demo_organizer',
      attendance: null,
      certificateId: null
    });
    console.log(`   ✅ Registration created: ${regId} (status: approved → QR pass ready!)\n`);
  } else {
    console.log('   ⚠️  No student user found, skipping registration.\n');
  }

  // ─────────────────────────────────────────────────────────────────────
  // STEP 4: Create a campus announcement
  // ─────────────────────────────────────────────────────────────────────
  console.log('📢 Step 4: Adding a campus announcement...');
  const noticeId = 'notice_hackimtech_launch_2026';
  await db.collection('announcements').doc(noticeId).set({
    id: noticeId,
    title: '🚀 HackIMTech 2026 Registration Now Open!',
    content: 'Registrations for HackIMTech 2026 — Sanjivani University\'s annual internal hackathon — are now LIVE! Open to all departments. Date: 7th October 2026. Venue: Main Auditorium. Prizes worth ₹9,500+. Free entry. Register now on EventPulse before 5th October!',
    shortContent: 'HackIMTech 2026 registrations are open! Date: Oct 7th. Free entry. Prizes ₹9,500+.',
    category: 'Academic',
    targetAudience: 'All Students',
    priority: 'high',
    publishedBy: 'Central Administration',
    publishedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(), // expires in 5 days
    isActive: true,
    linkedEventId: 'demo_event_hackimtech_2026'
  });
  console.log('   ✅ Campus notice posted: "HackIMTech 2026 Registration Now Open!"\n');

  // ─────────────────────────────────────────────────────────────────────
  // STEP 5: Platform Health Summary
  // ─────────────────────────────────────────────────────────────────────
  console.log('📊 Step 5: Platform Health Summary...\n');
  const [eventsSnap, regsSnap, certsSnap, noticesSnap, usersSnap2] = await Promise.all([
    db.collection('events').get(),
    db.collection('registrations').get(),
    db.collection('certificates').get(),
    db.collection('announcements').get(),
    db.collection('users').get()
  ]);

  const events = eventsSnap.docs.map(d => d.data());
  const approved = events.filter(e => e.status === 'approved');
  const pending = events.filter(e => e.status === 'pending_approval');

  console.log('══════════════════════════════════════════');
  console.log('  EVENTPULSE PLATFORM STATUS');
  console.log('══════════════════════════════════════════');
  console.log(`  👥 Users           : ${usersSnap2.size}`);
  console.log(`  🎉 Events (total)  : ${eventsSnap.size}`);
  console.log(`     ✅ Approved     : ${approved.length}`);
  console.log(`     ⏳ Pending HOD  : ${pending.length}`);
  console.log(`  🎫 Registrations   : ${regsSnap.size}`);
  console.log(`  📜 Certificates    : ${certsSnap.size}`);
  console.log(`  📢 Announcements   : ${noticesSnap.size}`);
  console.log('══════════════════════════════════════════');
  console.log('\n✅ All steps completed successfully!');
  console.log('🌐 Live at: https://eventpulse-su-34a42.web.app\n');

  process.exit(0);
}

run().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
