const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '..', 'functions', 'serviceAccountKey.json'));

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

async function debugTokens() {
  const snap = await db.collection('fcm_tokens').get();
  console.log(`Total tokens in fcm_tokens: ${snap.size}`);
  snap.forEach((doc, idx) => {
    const d = doc.data();
    console.log(`\n[Token ${idx + 1}] ID: ${doc.id.slice(0, 20)}...`);
    console.log(`  User: ${d.userName || 'N/A'} (${d.userId || 'N/A'})`);
    console.log(`  Updated: ${d.updatedAt || 'N/A'}`);
    console.log(`  Token: ${d.token ? d.token.slice(0, 30) + '...' : 'NONE'}`);
  });
}

debugTokens().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
