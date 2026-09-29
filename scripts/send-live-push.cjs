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

async function sendRealPush() {
  console.log('🚀 Sending Live Push Notification using real data tokens...');

  const snap = await db.collection('fcm_tokens').get();
  const tokenSet = new Set();

  snap.forEach(doc => {
    const data = doc.data();
    const t = data.token || doc.id;
    if (t && t.includes(':')) {
      tokenSet.add(t);
    }
  });

  const tokens = Array.from(tokenSet);
  console.log(`📱 Found ${tokens.length} valid FCM tokens.`);

  if (tokens.length === 0) {
    console.log('No valid tokens.');
    process.exit(1);
  }

  const payload = {
    notification: {
      title: '🔥🏆 New Campus Tournaments Announced!',
      body: '🤼 Le-Panga Kabaddi & 🏏 Girls Cricket League are live on EventPulse. Check notices now!'
    },
    data: {
      url: 'https://eventpulse-su-34a42.web.app',
      title: '🔥🏆 New Campus Tournaments Announced!',
      body: '🤼 Le-Panga Kabaddi & 🏏 Girls Cricket League are live on EventPulse.'
    },
    tokens: tokens
  };

  const response = await messaging.sendEachForMulticast(payload);
  console.log(`🎉 Multicast Result: Success: ${response.successCount}, Failed: ${response.failureCount}`);

  response.responses.forEach((r, i) => {
    if (r.success) {
      console.log(`✅ Token ${i + 1}: Delivered successfully! MessageId: ${r.messageId}`);
    } else {
      console.log(`❌ Token ${i + 1} Failed: ${r.error?.code} - ${r.error?.message}`);
    }
  });

  process.exit(0);
}

sendRealPush().catch(err => {
  console.error(err);
  process.exit(1);
});
