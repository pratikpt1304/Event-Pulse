const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '..', 'functions', 'serviceAccountKey.json'));

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

const db = admin.firestore();

async function checkAllUserTokens() {
  console.log('🔍 Checking users collection for fcmTokens...');
  const usersSnap = await db.collection('users').get();
  console.log(`Total users in database: ${usersSnap.size}`);

  let totalTokensInUsers = 0;
  usersSnap.forEach(d => {
    const data = d.data();
    const tokens = data.fcmTokens || [];
    if (tokens.length > 0) {
      console.log(`- User: ${data.name || d.id} (${data.email || 'No email'}) has ${tokens.length} token(s)`);
      totalTokensInUsers += tokens.length;
    }
  });

  console.log(`\nTotal tokens found across all users: ${totalTokensInUsers}`);
}

checkAllUserTokens().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
