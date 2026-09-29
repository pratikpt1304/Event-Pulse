const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '..', 'functions', 'serviceAccountKey.json'));

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

async function removeEvent() {
  console.log('🗑️ Removing event "evt_volleyball_tournament_2026" from events collection...');
  await db.collection('events').doc('evt_volleyball_tournament_2026').delete();
  console.log('✅ Event removed from Upcoming Events successfully!');
  process.exit(0);
}

removeEvent().catch(err => {
  console.error('❌ Error removing event:', err);
  process.exit(1);
});
