/**
 * Fix Shubham's PRN in Firestore: 2126PMIM1O72 → 2126PMIM1072
 * Letter 'O' was mistakenly used instead of digit '0'
 */
const admin = require('firebase-admin');
const sa = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

async function fixPRN() {
  const uid = 'EzOwwZktNvhA3j8GMF1Ow6XitbQ2'; // Shubham anil deore
  const wrongPRN = '2126PMIM1O72';
  const correctPRN = '2126PMIM1072';

  const ref = db.collection('users').doc(uid);
  const doc = await ref.get();

  if (!doc.exists) {
    console.log('User not found!');
    process.exit(1);
  }

  const data = doc.data();
  console.log('Current PRN:', data.prn);

  if (data.prn === wrongPRN) {
    await ref.update({ prn: correctPRN });
    console.log('✅ PRN fixed:', wrongPRN, '→', correctPRN);
  } else if (data.prn === correctPRN) {
    console.log('✅ PRN already correct:', correctPRN);
  } else {
    console.log('⚠️ Unexpected PRN value:', data.prn);
  }

  process.exit(0);
}

fixPRN().catch(err => { console.error(err); process.exit(1); });
