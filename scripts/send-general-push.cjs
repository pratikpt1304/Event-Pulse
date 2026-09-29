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

async function sendNewEventsBroadcast() {
  console.log('🚀 Blasting "Check All New Events" Push Notification to all devices...');

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
  console.log(`📱 Target: ${tokens.length} registered FCM devices.`);

  if (tokens.length === 0) {
    console.log('❌ No valid tokens found.');
    process.exit(1);
  }

  const payload = {
    notification: {
      title: '🔥⚡ Campus Alert: New Events & Tournaments Live!',
      body: 'Check out newly announced tournaments, sports fests & official campus notices on EventPulse now! 🏆'
    },
    data: {
      url: 'https://eventpulse-su-34a42.web.app/#events',
      title: '🔥⚡ Campus Alert: New Events & Tournaments Live!',
      body: 'Check out newly announced tournaments, sports fests & official campus notices on EventPulse now! 🏆'
    },
    tokens: tokens
  };

  const response = await messaging.sendEachForMulticast(payload);
  console.log(`\n🎉 Multicast Sent!`);
  console.log(`   ✅ Successful deliveries: ${response.successCount}`);
  console.log(`   ❌ Stale/Unregistered tokens: ${response.failureCount}`);

  response.responses.forEach((r, i) => {
    if (r.success) {
      console.log(`   📱 Device ${i + 1}: Delivered! (Message ID: ${r.messageId})`);
    }
  });

  // Also log into notification_logs collection in Firestore for audit history
  await db.collection('notification_logs').add({
    title: payload.notification.title,
    body: payload.notification.body,
    url: payload.data.url,
    recipientCount: tokens.length,
    successCount: response.successCount,
    failureCount: response.failureCount,
    sentAt: new Date().toISOString(),
    sentBy: 'Admin Broadcast'
  });

  console.log('📝 Logged to admin notification history in Firestore.');
  process.exit(0);
}

sendNewEventsBroadcast().catch(err => {
  console.error('❌ Push error:', err);
  process.exit(1);
});
