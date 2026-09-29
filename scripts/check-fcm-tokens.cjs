const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '..', 'functions', 'serviceAccountKey.json'));

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

async function checkTokens() {
  const snap = await db.collection('fcm_tokens').get();
  console.log(`Total FCM Tokens in database: ${snap.size}`);
  snap.forEach(doc => {
    const data = doc.data();
    console.log(`- Token User: ${data.userName || data.email || doc.id} (Created: ${data.updatedAt || data.createdAt})`);
  });
}

checkTokens().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
