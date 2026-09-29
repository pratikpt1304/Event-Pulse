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

async function sendHighPriorityPush() {
  console.log('🚀 Sending High-Urgency WebPush to all devices...');

  const snap = await db.collection('fcm_tokens').get();
  const tokens = [];

  snap.forEach(d => {
    const data = d.data();
    const token = data.token || d.id;
    if (token && token.includes(':')) {
      tokens.push(token);
    }
  });

  console.log(`📱 Found ${tokens.length} target tokens in database.`);

  const message = {
    notification: {
      title: '🔥⚡ EventPulse Campus Notice Live!',
      body: '🏆 Kabaddi League & Girls Cricket Tournament are announced! Tap to view details & register now.'
    },
    data: {
      url: 'https://eventpulse-su-34a42.web.app/#events',
      title: '🔥⚡ EventPulse Campus Notice Live!',
      body: '🏆 Kabaddi League & Girls Cricket Tournament are announced! Tap to view details & register now.'
    },
    webpush: {
      headers: {
        Urgency: 'high',
        TTL: '86400'
      },
      notification: {
        title: '🔥⚡ EventPulse Campus Notice Live!',
        body: '🏆 Kabaddi League & Girls Cricket Tournament are announced! Tap to view details & register now.',
        icon: 'https://eventpulse-su-34a42.web.app/logo.jpg',
        badge: 'https://eventpulse-su-34a42.web.app/logo.jpg',
        requireInteraction: true,
        vibrate: [200, 100, 200]
      },
      fcmOptions: {
        link: 'https://eventpulse-su-34a42.web.app/#events'
      }
    },
    tokens: tokens
  };

  const res = await messaging.sendEachForMulticast(message);
  console.log(`\n🎉 Result: Success = ${res.successCount}, Failed = ${res.failureCount}`);

  res.responses.forEach((r, idx) => {
    if (r.success) {
      console.log(`✅ [${idx + 1}] Sent! MsgId: ${r.messageId}`);
    } else {
      console.log(`❌ [${idx + 1}] Failed: ${r.error?.code}`);
    }
  });

  process.exit(0);
}

sendHighPriorityPush().catch(e => {
  console.error(e);
  process.exit(1);
});
