const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '..', 'functions', 'serviceAccountKey.json'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'eventpulse-su-34a42'
  });
}

const db = admin.firestore();
const messaging = admin.messaging();

async function cleanupAndValidateTokens() {
  console.log('🧹 Validating all tokens and cleaning up stale/expired ones...');

  const snap = await db.collection('fcm_tokens').get();
  let deletedCount = 0;
  let validCount = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const token = data.token || doc.id;

    if (!token || !token.includes(':')) {
      await doc.ref.delete();
      deletedCount++;
      continue;
    }

    try {
      // Dry-run test each token
      await messaging.send({
        token: token,
        data: { test: 'true' }
      }, true); // dryRun = true
      validCount++;
    } catch (err) {
      if (err.code === 'messaging/registration-token-not-registered' || err.code === 'messaging/invalid-argument') {
        await doc.ref.delete();
        deletedCount++;
      }
    }
  }

  console.log(`✅ Cleanup Complete! Valid active devices: ${validCount}, Removed stale tokens: ${deletedCount}`);
  process.exit(0);
}

cleanupAndValidateTokens().catch(err => {
  console.error(err);
  process.exit(1);
});
