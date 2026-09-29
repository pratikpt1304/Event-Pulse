const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '..', 'functions', 'serviceAccountKey.json'));

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

async function inspectDoc() {
  const snap = await db.collection('fcm_tokens').limit(3).get();
  snap.forEach(d => {
    console.log('Doc ID:', d.id);
    console.log('Doc Data:', JSON.stringify(d.data(), null, 2));
  });
}

inspectDoc().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
