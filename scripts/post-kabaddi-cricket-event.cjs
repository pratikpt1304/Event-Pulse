const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.join(__dirname, '..', 'functions', 'serviceAccountKey.json');
const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function postTournament() {
  console.log('🚀 Publishing Kabaddi & Girls Cricket Tournament to Firestore...');

  const posterFilePath = path.join(__dirname, '..', 'public', 'kabaddi_cricket_poster.jpg');
  let posterDataUrl = '/kabaddi_cricket_poster.jpg';
  let posterSize = 0;

  if (fs.existsSync(posterFilePath)) {
    const fileBuffer = fs.readFileSync(posterFilePath);
    posterSize = fileBuffer.length;
    posterDataUrl = `data:image/jpeg;base64,${fileBuffer.toString('base64')}`;
  }

  const formUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSckYpgQXDmY2DwGDPYBFWSDrw4jKtehdpN88VnWw87wyE_ZPA/viewform';

  // 1. Post into Events collection
  const eventId = 'evt_kabaddi_girls_cricket_2026';
  const eventData = {
    id: eventId,
    title: 'Le-Panga Kabaddi League & Girls Cricket Tournament',
    description: '🔥 READY TO ROAR? THE ARENA IS CALLING! Sanjivani University × Revenue Royals proudly presents LE-PANGA KABADDI LEAGUE & GIRLS CRICKET TOURNAMENT. Open for all college and university teams!',
    category: 'sports',
    department: 'Revenue Royals × Sports',
    eligibleDepartments: ['All Departments'],
    eligibleYears: ['All Years & Open for All Teams'],
    date: '2026-08-29',
    time: '09:30 AM onwards',
    venue: 'Sanjivani University Campus, Kopargaon',
    entryFee: '🤼 Kabaddi: ₹3,000 | 🏏 Girls Cricket: ₹1,100',
    prizePool: '🥇 Kabaddi: ₹15,000 | 🏏 Girls Cricket: ₹5,000',
    contacts: 'Kabaddi: 9511984101 | Girls Cricket: 9021773849',
    registrationDeadline: '2026-08-23',
    status: 'approved',
    isExternal: true,
    disableVolunteer: true,
    externalRegistrationUrl: formUrl,
    organizerId: 'revenue_royals_org',
    organizerName: 'Sanjivani University × Revenue Royals',
    posterUrl: '/kabaddi_cricket_poster.jpg',
    createdAt: new Date().toISOString()
  };

  await db.collection('events').doc(eventId).set(eventData, { merge: true });
  console.log('✅ Event successfully published to "events" collection!');

  // 2. Post into Announcements / Notice Board
  const noticeId = 'notice_kabaddi_cricket_2026';
  const noticeData = {
    id: noticeId,
    title: '🔥🏆 Le-Panga Kabaddi League & Girls Cricket Tournament (Revenue Royals)',
    message: `🔥🏆 READY TO ROAR? THE ARENA IS CALLING! 🏆🔥\n⚡ ONE GROUND. ONE TEAM. ONE CHAMPION. ⚡\n\nSanjivani University × Revenue Royals proudly presents:\n🤼‍♂️ LE-PANGA KABADDI LEAGUE\n🏏 GIRLS CRICKET TOURNAMENT\n\n📅 Date: 29 AUGUST 2026 (Saturday)\n📍 Venue: Sanjivani University Campus, Kopargaon\n⏰ Time: 9:30 AM onwards\n🎯 OPEN FOR ALL TEAMS\n\n💰 Entry Fees:\n🤼 Kabaddi — ₹3,000\n🏏 Girls Cricket — ₹1,100\n\n🏆 PRIZE POOL:\n🥇 Kabaddi — ₹15,000\n🏏 Girls Cricket — ₹5,000\n\n🚨 REGISTRATIONS CLOSE: 23 AUGUST 2026 🚨\n\n📝 REGISTER YOUR TEAM NOW:\n${formUrl}\n\n📞 KABADDI: 9511984101\n📞 GIRLS CRICKET: 9021773849`,
    priority: '🏆 Fest / Sports',
    targetDept: 'All Students',
    postedBy: 'Sanjivani University × Revenue Royals',
    createdAt: new Date().toISOString(),
    attachment: {
      name: 'LePanga_Kabaddi_Girls_Cricket_Poster.jpg',
      type: 'image/jpeg',
      size: posterSize,
      dataUrl: posterDataUrl
    }
  };

  await db.collection('announcements').doc(noticeId).set(noticeData, { merge: true });
  console.log('✅ Campus Notice Broadcast successfully published to "announcements" collection!');

  console.log('🎉 Done! Tournament is live on EventPulse with direct Google Form link.');
  process.exit(0);
}

postTournament().catch(err => {
  console.error('❌ Error posting tournament:', err);
  process.exit(1);
});
