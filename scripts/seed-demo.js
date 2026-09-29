/**
 * EventPulse Demo Seed Script
 * Creates the 6 core demo users (Student, Organizer, HOD, Dean, VC, Admin)
 * in Firebase Auth and Firestore with correct roles and claims.
 * 
 * Usage:
 *   node scripts/seed-demo.js
 * 
 * Prerequisites:
 *   Place serviceAccountKey.json in ./functions/serviceAccountKey.json
 *   or set GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json
 */

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Find Service Account Key
const possibleKeyPaths = [
  path.join(__dirname, '../functions/serviceAccountKey.json'),
  path.join(__dirname, '../serviceAccountKey.json'),
  process.env.GOOGLE_APPLICATION_CREDENTIALS
].filter(Boolean);

let serviceAccountPath = null;
for (const p of possibleKeyPaths) {
  if (fs.existsSync(p)) {
    serviceAccountPath = p;
    break;
  }
}

if (serviceAccountPath) {
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log(`🔑 Initialized Firebase Admin SDK using ${serviceAccountPath}`);
} else {
  // Try default credentials or project ID
  admin.initializeApp({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'eventpulse-su-34a42'
  });
  console.log('ℹ️ Attempting initialization with Application Default Credentials.');
}

const auth = admin.auth();
const db = admin.firestore();

export const DEMO_USERS = [
  {
    uid: 'demo_student',
    email: 'student@college.edu',
    password: 'Password@123',
    name: 'Rahul Sharma (Student)',
    role: 'student',
    prn: 'SU2024CS0142',
    department: 'Computer Science & Engineering',
    year: '3rd Year',
    division: 'A'
  },
  {
    uid: 'demo_organizer',
    email: 'organizer@college.edu',
    password: 'Password@123',
    name: 'Pratik Thorat (Event Lead)',
    role: 'organizer',
    prn: 'ORG-TECH-2026',
    department: 'Technology Council',
    year: 'Lead Organizer',
    division: 'TECH'
  },
  {
    uid: 'demo_hod',
    email: 'hod@college.edu',
    password: 'Password@123',
    name: 'Prof. Anwar Sheikh (HOD)',
    role: 'hod',
    prn: 'HOD-CE-101',
    department: 'Computer Science & Engineering',
    year: 'HOD',
    division: 'CS'
  },
  {
    uid: 'demo_dean',
    email: 'dean@college.edu',
    password: 'Password@123',
    name: 'Dr. Kavita Verma (Dean)',
    role: 'dean',
    prn: 'DEAN-ACAD-02',
    department: 'Faculty of Engineering & Technology',
    year: 'Dean',
    division: 'HQ'
  },
  {
    uid: 'demo_vc',
    email: 'vc@college.edu',
    password: 'Password@123',
    name: 'Dr. R. K. Sharma (Vice Chancellor)',
    role: 'vc',
    prn: 'VC-EXEC-01',
    department: 'University Executive Office',
    year: 'Vice Chancellor',
    division: 'HQ'
  },
  {
    uid: 'demo_admin',
    email: 'admin@college.edu',
    password: 'Password@123',
    name: 'Central Administration',
    role: 'admin',
    prn: 'ADM-CENTRAL-01',
    department: 'Central Administration',
    year: 'Admin',
    division: 'HQ'
  }
];

async function seedDemoUsers() {
  console.log('\n🚀 Starting EventPulse Demo Users Seeding (6 Core Roles)...\n');

  for (const user of DEMO_USERS) {
    try {
      let uid = user.uid;
      let existingUser = null;

      try {
        existingUser = await auth.getUserByEmail(user.email);
        uid = existingUser.uid;
        await auth.updateUser(uid, {
          password: user.password,
          displayName: user.name,
          emailVerified: true
        });
        console.log(`✓ Updated Auth User: ${user.email} (${user.role.toUpperCase()})`);
      } catch (err) {
        if (err.code === 'auth/user-not-found') {
          const created = await auth.createUser({
            uid: user.uid,
            email: user.email,
            password: user.password,
            displayName: user.name,
            emailVerified: true
          });
          uid = created.uid;
          console.log(`✓ Created Auth User: ${user.email} (${user.role.toUpperCase()})`);
        } else {
          throw err;
        }
      }

      // Set Custom Claims for strict Firestore Rules
      await auth.setCustomUserClaims(uid, { role: user.role });

      // Create / Update Firestore User Profile
      const userProfile = {
        uid,
        email: user.email,
        name: user.name,
        role: user.role,
        prn: user.prn,
        department: user.department,
        year: user.year,
        division: user.division,
        status: 'active',
        emailVerified: true,
        seededAt: new Date().toISOString()
      };

      await db.collection('users').doc(uid).set(userProfile, { merge: true });
      console.log(`  └─ Set Firestore doc users/${uid} [role: ${user.role}]`);

      // If Staff role, also seed staffInvites document
      if (user.role !== 'student') {
        const inviteDoc = {
          email: user.email.toLowerCase(),
          role: user.role,
          department: user.department,
          invitedBy: 'admin@college.edu',
          createdAt: new Date().toISOString(),
          redeemed: true,
          redeemedBy: uid,
          redeemedAt: new Date().toISOString()
        };
        await db.collection('staffInvites').doc(user.email.toLowerCase()).set(inviteDoc, { merge: true });
        console.log(`  └─ Set Firestore doc staffInvites/${user.email.toLowerCase()}`);
      }

    } catch (err) {
      console.error(`✕ Error seeding ${user.email}:`, err.message);
    }
  }

  console.log('\n✨ Demo Seeding Process Complete!');
  console.log('You can now log in using any demo account with password: Password@123\n');
}

seedDemoUsers().catch(console.error);
