import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const possibleKeyPaths = [
  path.join(__dirname, '../functions/serviceAccountKey.json'),
  path.join(__dirname, '../serviceAccountKey.json'),
  process.env.GOOGLE_APPLICATION_CREDENTIALS
].filter(Boolean);

let serviceAccountPath = null;
for (const p of possibleKeyPaths) {
  if (p && fs.existsSync(p)) {
    serviceAccountPath = p;
    break;
  }
}

if (!serviceAccountPath) {
  console.error('❌ Service account key not found.');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function run() {
  console.log('Fetching certificates collection...');
  const snapshot = await db.collection('certificates').get();
  console.log(`Found ${snapshot.size} certificate(s).`);
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    console.log(`Cert ID: ${doc.id}, Student: ${data.studentName || data.userName}, Event: ${data.eventTitle || data.eventName}`);
    // Delete the certificate
    await db.collection('certificates').doc(doc.id).delete();
    console.log(`Deleted certificate: ${doc.id}`);
  }

  // Also check if any registration has this certId or issued certificate flag
  const regSnapshot = await db.collection('registrations').get();
  for (const doc of regSnapshot.docs) {
    const data = doc.data();
    if (data.certificateId || data.certId || data.attended) {
      console.log(`Checking registration: ${doc.id} (user: ${data.userName || data.studentName})`);
    }
  }

  console.log('Done!');
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
