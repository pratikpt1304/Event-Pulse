/**
 * EventPulse — Push Notification Sender Script
 * =============================================
 * Yeh script chalao jab sabko push notification bhejna ho.
 * App band ho toh bhi sabke phones pe notification aayegi!
 *
 * Usage:
 *   node send-notification.js
 *
 * Environment Variable (REQUIRED):
 *   GOOGLE_APPLICATION_CREDENTIALS = path to your serviceAccountKey.json
 *
 * Steps:
 *   1. Firebase Console → Project Settings → Service Accounts → Generate new private key
 *   2. Save as functions/serviceAccountKey.json
 *   3. node send-notification.js
 */

const admin = require('firebase-admin');
const path = require('path');

// ─── CUSTOMIZE NOTIFICATION HERE ──────────────────────────────────────────────
const NOTIFICATION = {
  title: '⚡ EventPulse Campus Alert',
  body: 'Naya event add hua hai! Check karo EventPulse pe.',
  url: 'https://eventpulse-su-34a42.web.app/#events',  // Kahan le jaaye click pe
  
  // Optional: Sirf specific department ko bhejna ho toh
  // targetDepartment: 'Computer Engineering',  // uncomment & set karo
  
  // Optional: Sirf specific role ko bhejna ho toh  
  // targetRole: 'student',  // 'student', 'organizer', 'admin'
};
// ──────────────────────────────────────────────────────────────────────────────

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
try {
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'eventpulse-su-34a42'
  });
} catch (e) {
  console.error('\n❌ serviceAccountKey.json nahi mila!\n');
  console.error('Steps:');
  console.error('1. Firebase Console → Project Settings → Service Accounts');
  console.error('2. "Generate new private key" pe click karo');
  console.error('3. Download karke functions/serviceAccountKey.json pe save karo');
  console.error('4. Dobara chalao: node send-notification.js\n');
  process.exit(1);
}

const db = admin.firestore();
const messaging = admin.messaging();

async function sendNotificationToAll() {
  console.log('\n🚀 EventPulse Push Notification Sender\n');
  console.log('📢 Notification:');
  console.log(`   Title: ${NOTIFICATION.title}`);
  console.log(`   Body:  ${NOTIFICATION.body}`);
  console.log(`   URL:   ${NOTIFICATION.url}\n`);

  try {
    // Firestore se sabke FCM tokens fetch karo
    console.log('📋 FCM tokens fetch kar raha hoon Firestore se...');
    let query = db.collection('fcm_tokens');

    // Optional filters
    if (NOTIFICATION.targetDepartment) {
      query = query.where('department', '==', NOTIFICATION.targetDepartment);
      console.log(`   Filter: Department = ${NOTIFICATION.targetDepartment}`);
    }
    if (NOTIFICATION.targetRole) {
      query = query.where('role', '==', NOTIFICATION.targetRole);
      console.log(`   Filter: Role = ${NOTIFICATION.targetRole}`);
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      console.log('\n⚠️  Koi FCM token nahi mila! Users ne notifications enable nahi ki hain abhi tak.\n');
      return;
    }

    const tokens = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.token) tokens.push(data.token);
    });

    console.log(`✅ ${tokens.length} registered users mile.\n`);

    // FCM MulticastMessage banao
    const messagePayload = {
      notification: {
        title: NOTIFICATION.title,
        body: NOTIFICATION.body,
      },
      data: {
        url: NOTIFICATION.url,
        title: NOTIFICATION.title,
        body: NOTIFICATION.body,
        timestamp: Date.now().toString()
      },
      webpush: {
        notification: {
          title: NOTIFICATION.title,
          body: NOTIFICATION.body,
          icon: 'https://eventpulse-su-34a42.web.app/logo.jpg',
          badge: 'https://eventpulse-su-34a42.web.app/logo.jpg',
          vibrate: [200, 100, 200],
          click_action: NOTIFICATION.url
        },
        fcmOptions: {
          link: NOTIFICATION.url
        }
      }
    };

    // FCM max 500 tokens per batch accept karta hai
    const BATCH_SIZE = 500;
    let totalSuccess = 0;
    let totalFailed = 0;
    const failedTokens = [];

    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
      const batch = tokens.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(tokens.length / BATCH_SIZE);
      
      process.stdout.write(`   Batch ${batchNum}/${totalBatches} bhej raha hoon (${batch.length} tokens)... `);
      
      const response = await messaging.sendEachForMulticast({
        ...messagePayload,
        tokens: batch
      });

      totalSuccess += response.successCount;
      totalFailed += response.failureCount;
      console.log(`✅ ${response.successCount} success, ❌ ${response.failureCount} failed`);

      // Failed tokens collect karo (expired/invalid)
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push({ token: batch[idx], error: resp.error?.code });
        }
      });
    }

    console.log('\n─────────────────────────────────────');
    console.log(`📊 Final Result:`);
    console.log(`   ✅ Successfully sent: ${totalSuccess}`);
    console.log(`   ❌ Failed:           ${totalFailed}`);
    console.log('─────────────────────────────────────\n');

    // Expired tokens cleanup (optional)
    if (failedTokens.length > 0) {
      const expiredCodes = ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'];
      const expiredTokens = failedTokens.filter(t => expiredCodes.includes(t.error));
      
      if (expiredTokens.length > 0) {
        console.log(`🧹 ${expiredTokens.length} expired tokens Firestore se hata raha hoon...`);
        const batch = db.batch();
        expiredTokens.forEach(({ token }) => {
          const ref = db.collection('fcm_tokens').doc(token.replace(/[^a-zA-Z0-9_-]/g, '_'));
          batch.delete(ref);
        });
        await batch.commit();
        console.log('✅ Cleanup complete!\n');
      }
    }

    // Notification log Firestore mein save karo
    await db.collection('notification_logs').add({
      title: NOTIFICATION.title,
      body: NOTIFICATION.body,
      url: NOTIFICATION.url,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      totalTargeted: tokens.length,
      successCount: totalSuccess,
      failedCount: totalFailed,
      sentBy: 'admin_script'
    });

    console.log('📝 Notification log Firestore mein save ho gaya.\n');
    console.log('🎉 Done!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  }
}

sendNotificationToAll();
