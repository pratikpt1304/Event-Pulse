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

async function inspectFailures() {
  const snap = await db.collection('fcm_tokens').get();
  const tokens = snap.docs.map(doc => doc.id);

  const payload = {
    notification: {
      title: 'Test',
      body: 'Test notification'
    },
    tokens: tokens.slice(0, 3)
  };

  const response = await messaging.sendEachForMulticast(payload);
  response.responses.forEach((r, idx) => {
    if (!r.success) {
      console.log(`Token ${idx} error:`, r.error.code, r.error.message);
    }
  });
}

inspectFailures().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
