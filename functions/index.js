const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { createQRToken, verifyQRToken } = require('./qrService');
const { buildCertificatePDF } = require('./certService');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * 1. Cloud Function to issue cryptographically signed QR token
 */
exports.generateQRToken = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to request QR pass.');
  }

  const { eventId, userId } = data;
  if (!eventId || !userId) {
    throw new functions.https.HttpsError('invalid-argument', 'eventId and userId are required.');
  }

  // Ensure requesting user owns registration or is an organizer
  if (context.auth.uid !== userId) {
    // Check if user is organizer/admin
    const userDoc = await db.collection('users').doc(context.auth.uid).get();
    const role = userDoc.exists ? userDoc.data().role : null;
    if (role !== 'organizer' && role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Cannot request pass for another user.');
    }
  }

  const regId = `${eventId}_${userId}`;
  const regDoc = await db.collection('registrations').doc(regId).get();

  if (!regDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'No registration found for this event.');
  }

  const regData = regDoc.data();
  if (regData.status !== 'approved' && regData.status !== 'attended') {
    throw new functions.https.HttpsError('failed-precondition', `Pass unavailable. Registration status is ${regData.status}.`);
  }

  const token = createQRToken(eventId, userId);
  return { token, expiresAt: Date.now() + (15 * 60 * 1000) };
});

/**
 * 2. Cloud Function to verify QR token & mark attendance server-side
 */
exports.verifyAndMarkAttendance = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Organizer must be logged in to scan attendance.');
  }

  // Verify scanner is an organizer or admin
  const scannerUid = context.auth.uid;
  const scannerDoc = await db.collection('users').doc(scannerUid).get();
  const scannerData = scannerDoc.exists ? scannerDoc.data() : {};
  if (scannerData.role !== 'organizer' && scannerData.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Only organizers can mark attendance.');
  }

  const { qrToken } = data;
  if (!qrToken) {
    throw new functions.https.HttpsError('invalid-argument', 'qrToken is required.');
  }

  // Cryptographically verify token
  const verification = verifyQRToken(qrToken);
  if (!verification.valid) {
    return {
      success: false,
      code: 'INVALID_TOKEN',
      message: verification.reason
    };
  }

  const { eventId, userId } = verification;
  const attendanceId = `${eventId}_${userId}`;
  const regId = `${eventId}_${userId}`;

  // Check if attendance already marked
  const attendanceRef = db.collection('attendance').doc(attendanceId);
  const attendanceDoc = await attendanceRef.get();

  if (attendanceDoc.exists) {
    const existingData = attendanceDoc.data();
    return {
      success: false,
      code: 'ALREADY_CHECKED_IN',
      message: `Student was already checked in at ${new Date(existingData.checkInTime).toLocaleTimeString()}`,
      checkInTime: existingData.checkInTime
    };
  }

  // Load student & event info for verification and certificate
  const [studentDoc, eventDoc, regDoc] = await Promise.all([
    db.collection('users').doc(userId).get(),
    db.collection('events').doc(eventId).get(),
    db.collection('registrations').doc(regId).get()
  ]);

  if (!eventDoc.exists) {
    return { success: false, code: 'EVENT_NOT_FOUND', message: 'Associated event does not exist.' };
  }

  if (!regDoc.exists || (regDoc.data().status !== 'approved' && regDoc.data().status !== 'attended')) {
    return { success: false, code: 'NOT_APPROVED', message: 'Registration is not approved for this event.' };
  }

  const student = studentDoc.exists ? studentDoc.data() : { name: 'Student', email: 'N/A' };
  const event = eventDoc.data();
  const nowIso = new Date().toISOString();

  // Perform Firestore writes using Transaction / Batch
  const batch = db.batch();

  // Write attendance record
  batch.set(attendanceRef, {
    eventId,
    userId,
    checkInTime: nowIso,
    markedBy: scannerUid
  });

  // Update registration status to attended
  batch.update(db.collection('registrations').doc(regId), {
    status: 'attended',
    attendedAt: nowIso
  });

  // Create Audit Log
  const logRef = db.collection('auditLogs').doc();
  batch.set(logRef, {
    action: 'MARK_ATTENDANCE',
    actorId: scannerUid,
    targetId: attendanceId,
    timestamp: nowIso,
    details: {
      eventId,
      userId,
      studentName: student.name,
      eventTitle: event.title
    }
  });

  // Issue Certificate
  const verificationId = `EP-${eventId.slice(-4).toUpperCase()}-${userId.slice(-4).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const certRef = db.collection('certificates').doc(verificationId);
  
  batch.set(certRef, {
    certificateId: verificationId,
    verificationId,
    eventId,
    userId,
    studentName: student.name,
    prn: student.prn || '',
    eventTitle: event.title,
    eventDate: `${event.date} at ${event.time}`,
    issuedAt: nowIso,
    organizerId: event.organizerId || scannerUid
  });

  await batch.commit();

  return {
    success: true,
    code: 'ATTENDANCE_MARKED',
    message: `Attendance marked successfully for ${student.name}!`,
    studentName: student.name,
    prn: student.prn || '',
    eventTitle: event.title,
    checkInTime: nowIso,
    verificationId
  };
});

/**
 * 3. Cloud Function to download/view Certificate PDF
 */
exports.getCertificatePDF = functions.https.onCall(async (data, context) => {
  const { verificationId } = data;
  if (!verificationId) {
    throw new functions.https.HttpsError('invalid-argument', 'verificationId required.');
  }

  const certDoc = await db.collection('certificates').doc(verificationId).get();
  if (!certDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'Certificate not found.');
  }

  const certData = certDoc.data();
  const pdfBuffer = await buildCertificatePDF({
    studentName: certData.studentName,
    prn: certData.prn,
    eventTitle: certData.eventTitle,
    eventDate: certData.eventDate,
    verificationId: certData.verificationId,
    organizerId: certData.organizerId
  });

  return {
    verificationId: certData.verificationId,
    pdfBase64: pdfBuffer.toString('base64'),
    filename: `Certificate_${certData.studentName.replace(/\s+/g, '_')}_${verificationId}.pdf`
  };
});

/**
 * 4. Automatic Trigger: Whenever a new user is created in Firebase Authentication,
 * automatically create/sync their profile in Firestore 'users' collection!
 */
exports.onAuthUserCreated = functions.auth.user().onCreate(async (user) => {
  const userRef = db.collection('users').doc(user.uid);
  const docSnap = await userRef.get();
  if (docSnap.exists) return null;

  const email = user.email || '';
  const isAdmin = email.toLowerCase().trim() === 'eventpulsesupport@gmail.com';
  const name = user.displayName || (email ? email.split('@')[0] : 'University Student');

  const profile = {
    uid: user.uid,
    email: email,
    name: name,
    prn: 'SU' + Math.floor(1000000000 + Math.random() * 9000000000),
    department: 'Computer Science & Engineering',
    year: '1st Year',
    division: 'A',
    role: isAdmin ? 'admin' : 'student',
    createdAt: user.metadata.creationTime || new Date().toISOString()
  };

  return userRef.set(profile, { merge: true });
});

/**
 * 5. Admin Cloud Function: Fetch all registered users directly from Firebase Authentication
 * and ensure they exist in Firestore.
 */
exports.listAllAuthUsers = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Admin authentication required.');
  }

  const requesterEmail = (context.auth.token.email || '').toLowerCase().trim();
  if (requesterEmail !== 'eventpulsesupport@gmail.com') {
    const adminDoc = await db.collection('users').doc(context.auth.uid).get();
    if (!adminDoc.exists || adminDoc.data().role !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Only super administrators can list auth users.');
    }
  }

  const authList = await admin.auth().listUsers(1000);
  const batch = db.batch();
  const resultUsers = [];

  for (const u of authList.users) {
    const userRef = db.collection('users').doc(u.uid);
    const docSnap = await userRef.get();
    let userData = docSnap.exists ? docSnap.data() : null;

    if (!userData) {
      const email = u.email || '';
      const isAdmin = email.toLowerCase().trim() === 'eventpulsesupport@gmail.com';
      const name = u.displayName || (email ? email.split('@')[0] : 'University Student');

      userData = {
        uid: u.uid,
        email: email,
        name: name,
        prn: 'SU' + Math.floor(1000000000 + Math.random() * 9000000000),
        department: 'Computer Science & Engineering',
        year: '1st Year',
        division: 'A',
        role: isAdmin ? 'admin' : 'student',
        createdAt: u.metadata.creationTime || new Date().toISOString()
      };
      batch.set(userRef, userData, { merge: true });
    }

    resultUsers.push({
      uid: u.uid,
      email: u.email || userData.email || '',
      name: userData.name || u.displayName || (u.email ? u.email.split('@')[0] : 'Student'),
      prn: userData.prn || 'N/A',
      department: userData.department || 'General',
      year: userData.year || '1st Year',
      role: userData.role || ((u.email || '').toLowerCase() === 'eventpulsesupport@gmail.com' ? 'admin' : 'student'),
      createdAt: userData.createdAt || u.metadata.creationTime || new Date().toISOString()
    });
  }

  await batch.commit().catch(() => {});
  return { users: resultUsers };
});

