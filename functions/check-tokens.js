const admin = require('firebase-admin');
const sa = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

async function findUser() {
  // Search for Shubham
  const snapshot = await db.collection('users').get();
  
  snapshot.forEach(doc => {
    const data = doc.data();
    const name = (data.name || data.displayName || '').toLowerCase();
    if (name.includes('shubham') || name.includes('deore') || (data.prn || '').includes('1072')) {
      console.log('\n=== FOUND ===');
      console.log('UID:', doc.id);
      console.log('Name:', data.name || data.displayName);
      console.log('PRN:', data.prn);
      console.log('Email:', data.email);
      console.log('Department:', data.department);
      console.log('Year:', data.year);
      console.log('Full data keys:', Object.keys(data));
    }
  });
  
  console.log('\nTotal users in Firestore:', snapshot.size);
  process.exit(0);
}

findUser().catch(err => { console.error(err); process.exit(1); });
