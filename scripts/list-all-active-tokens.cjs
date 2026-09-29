const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '..', 'functions', 'serviceAccountKey.json'));

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

async function listTokens() {
  const snap = await db.collection('fcm_tokens').get();
  console.log(`Total Docs in fcm_tokens: ${snap.size}`);
  snap.forEach(d => {
    const data = d.data();
    console.log(`- User: ${data.userName || data.userId || 'Unknown'} | Role: ${data.role || 'N/A'} | Updated: ${data.updatedAt || 'N/A'}`);
  });
}

listTokens().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
