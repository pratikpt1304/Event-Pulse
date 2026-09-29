const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '..', 'functions', 'serviceAccountKey.json'));

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

async function check() {
  const evSnap = await db.collection('events').doc('evt_volleyball_tournament_2026').get();
  console.log('Event in Firestore:', evSnap.exists ? evSnap.data().title : 'NOT FOUND');

  const notSnap = await db.collection('announcements').doc('notice_volleyball_tournament_2026').get();
  console.log('Notice in Firestore:', notSnap.exists ? notSnap.data().title : 'NOT FOUND');
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
