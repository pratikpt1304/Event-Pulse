const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '..', 'functions', 'serviceAccountKey.json'));

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

async function cleanMoments() {
  console.log('🧹 Cleaning dummy/seed moments from Firestore...');
  const snap = await db.collection('moments').get();
  let deleted = 0;
  for (const doc of snap.docs) {
    if (doc.id.startsWith('moment_seed_')) {
      await doc.ref.delete();
      deleted++;
    }
  }
  console.log(`✅ Deleted ${deleted} seed moments from Firestore!`);
  process.exit(0);
}

cleanMoments().catch(err => {
  console.error(err);
  process.exit(1);
});
