const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '..', 'functions', 'serviceAccountKey.json'));

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

async function removeEventFromUpcoming() {
  console.log('🗑️ Removing "evt_kabaddi_girls_cricket_2026" from events collection...');
  await db.collection('events').doc('evt_kabaddi_girls_cricket_2026').delete();
  console.log('✅ Removed from Upcoming Events. (It remains safely as a Campus Notice broadcast!)');
  process.exit(0);
}

removeEventFromUpcoming().catch(err => {
  console.error(err);
  process.exit(1);
});
