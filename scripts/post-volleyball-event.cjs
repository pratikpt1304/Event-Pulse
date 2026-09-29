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

async function postEventAndNotice() {
  console.log('🚀 Posting Volleyball Tournament event & notice to Firestore...');

  // Convert poster image to base64 dataUrl for notice attachment preview
  const posterFilePath = path.join(__dirname, '..', 'public', 'volleyball_poster.jpg');
  let posterDataUrl = '/volleyball_poster.jpg';
  let posterSize = 0;

  if (fs.existsSync(posterFilePath)) {
    const fileBuffer = fs.readFileSync(posterFilePath);
    posterSize = fileBuffer.length;
    posterDataUrl = `data:image/jpeg;base64,${fileBuffer.toString('base64')}`;
  }

  // 1. Event in 'events' collection
  const eventId = 'evt_volleyball_tournament_2026';
  const eventData = {
    id: eventId,
    title: 'Inter College Volleyball Tournament for Boys',
    description: 'Sanjivani College of Pharmaceutical Education and Research, Kopargaon organises Inter College Volleyball Tournament for Boys on the occasion of National Sports Day (29th August 2026). Grab your team and compete for the campus championship trophy!\n\nContact Coordinators:\n• Mr. Yogesh Mandlik: 9156812789\n• Mr. Affan Shaikh: 8888895597',
    category: 'sports',
    department: 'Pharmaceutical Education & Research',
    eligibleDepartments: ['All Departments'],
    eligibleYears: ['1st Year', '2nd Year', '3rd Year', '4th Year'],
    date: '2026-08-29',
    time: '02:00 PM',
    venue: 'Volleyball Ground, Sanjivani Campus, Kopargaon',
    maxParticipants: 150,
    registrationDeadline: '2026-08-29',
    status: 'approved',
    organizerId: 'sanjivani_pharmacy_sports',
    organizerName: 'Sanjivani College of Pharmaceutical Education and Research',
    posterUrl: '/volleyball_poster.jpg',
    createdAt: new Date().toISOString()
  };

  await db.collection('events').doc(eventId).set(eventData, { merge: true });
  console.log('✅ Event successfully published to "events" collection!');

  // 2. Broadcast Notice in 'announcements' collection
  const noticeId = 'notice_volleyball_tournament_2026';
  const noticeData = {
    id: noticeId,
    title: '🏐 Inter College Volleyball Tournament for Boys (National Sports Day)',
    message: 'Sanjivani College of Pharmaceutical Education and Research, Kopargaon Organises:\n\n🏆 Inter College Volleyball Tournament for Boys\n🌟 On the Occasion of National Sports Day (29th August 2026)\n\n📅 Date: 29th August 2026 (Saturday)\n⏰ Inauguration Time: 02:00 PM\n📍 Venue: Volleyball Ground, Sanjivani Campus, Kopargaon\n\n📞 Contact Details:\n1. Mr. Yogesh Mandlik: 9156812789\n2. Mr. Affan Shaikh: 8888895597\n\nAll departments and college teams are invited. Register now to claim your entry pass!',
    priority: '🏆 Fest / Sports',
    targetDept: 'All Students',
    postedBy: 'Sanjivani College of Pharmaceutical Education & Research',
    createdAt: new Date().toISOString(),
    attachment: {
      name: 'Volleyball_Tournament_2026_Poster.jpg',
      type: 'image/jpeg',
      size: posterSize,
      dataUrl: posterDataUrl
    }
  };

  await db.collection('announcements').doc(noticeId).set(noticeData, { merge: true });
  console.log('✅ Campus Notice Broadcast successfully published to "announcements" collection!');

  console.log('🎉 Done! Both Event and Notice are live on EventPulse.');
  process.exit(0);
}

postEventAndNotice().catch((err) => {
  console.error('❌ Error posting event:', err);
  process.exit(1);
});
