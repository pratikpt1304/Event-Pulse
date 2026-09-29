const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '..', 'functions', 'serviceAccountKey.json'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'eventpulse-su-34a42'
  });
}

const db = admin.firestore();
const messaging = admin.messaging();

async function sendSportsPush() {
  console.log('🚀 Sending Push Notification to all devices...');

  const snap = await db.collection('fcm_tokens').get();
  if (snap.empty) {
    console.log('❌ No FCM tokens found.');
    process.exit(1);
  }

  const tokens = snap.docs.map(doc => doc.id).filter(t => typeof t === 'string' && t.length > 20);
  console.log(`📱 Found ${tokens.length} target devices.`);

  const payload = {
    notification: {
      title: '🔥🏆 New Campus Tournaments Announced!',
      body: '🤼 Le-Panga Kabaddi, 🏏 Girls Cricket & 🏐 Volleyball tournaments are live on EventPulse. Check notices now!'
    },
    data: {
      url: 'https://eventpulse-su-34a42.web.app',
      title: '🔥🏆 New Campus Tournaments Announced!',
      body: '🤼 Le-Panga Kabaddi, 🏏 Girls Cricket & 🏐 Volleyball tournaments are live on EventPulse.'
    },
    tokens: tokens
  };

  const response = await messaging.sendEachForMulticast(payload);
  console.log(`✅ Push Sent! Success: ${response.successCount}, Failed: ${response.failureCount}`);

  process.exit(0);
}

sendSportsPush().catch(err => {
  console.error('❌ Push error:', err);
  process.exit(1);
});
