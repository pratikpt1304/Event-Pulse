const admin = require('firebase-admin');

// Initialize Firebase Admin with project ID
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'eventpulse-su-34a42'
  });
}

const auth = admin.auth();
const db = admin.firestore();

async function syncAllUsers() {
  try {
    console.log('Fetching users from Firebase Auth...');
    const listUsersResult = await auth.listUsers(1000);
    console.log(`Found ${listUsersResult.users.length} users in Firebase Authentication!`);

    let synced = 0;
    for (const u of listUsersResult.users) {
      const userRef = db.collection('users').doc(u.uid);
      const userDoc = await userRef.get();
      const existing = userDoc.exists ? userDoc.data() : {};

      const profile = {
        uid: u.uid,
        email: u.email || 'student@sanjivani.edu.in',
        name: existing.name || u.displayName || (u.email ? u.email.split('@')[0] : 'Student User'),
        prn: existing.prn || ('SU2026CS' + u.uid.slice(0, 4).toUpperCase()),
        department: existing.department || 'Computer Science & Engineering',
        year: existing.year || '1st Year',
        division: existing.division || 'A',
        role: existing.role || ((u.email || '').toLowerCase() === 'eventpulsesupport@gmail.com' ? 'admin' : 'student'),
        createdAt: existing.createdAt || u.metadata.creationTime || new Date().toISOString()
      };

      await userRef.set(profile, { merge: true });
      synced++;
    }

    console.log(`Successfully synced ${synced} users into Firestore 'users' collection!`);
  } catch (err) {
    console.error('Sync Error:', err.message);
  }
}

syncAllUsers();
