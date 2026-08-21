import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, collection } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';

// Sample Seed Configuration for client-side or script initialization
export const SEED_DATA = {
  users: [
    {
      uid: 'user_student_1',
      email: 'student@univ.edu',
      password: 'password123',
      name: 'Rahul Sharma',
      prn: '2024CS001',
      department: 'Computer Science',
      year: '3rd Year',
      division: 'A',
      role: 'student',
      createdAt: new Date().toISOString()
    },
    {
      uid: 'user_student_2',
      email: 'ananya@univ.edu',
      password: 'password123',
      name: 'Ananya Patel',
      prn: '2024IT042',
      department: 'Information Technology',
      year: '2nd Year',
      division: 'B',
      role: 'student',
      createdAt: new Date().toISOString()
    },
    {
      uid: 'user_organizer_1',
      email: 'organizer@univ.edu',
      password: 'password123',
      name: 'Prof. Vikram Shah',
      prn: 'FAC-802',
      department: 'Computer Science',
      year: 'Faculty',
      division: 'CS',
      role: 'organizer',
      createdAt: new Date().toISOString()
    },
    {
      uid: 'user_admin_1',
      email: 'admin@univ.edu',
      password: 'password123',
      name: 'Dr. S. K. Kulkarni (Dean)',
      prn: 'ADM-001',
      department: 'Administration',
      year: 'Admin',
      division: 'HQ',
      role: 'admin',
      createdAt: new Date().toISOString()
    }
  ],

  events: [
    {
      id: 'evt_techcon',
      title: 'Hackathon 2026: AI & Cloud Systems',
      description: 'Annual 24-hour inter-departmental hackathon focused on building intelligent web and cloud applications. Cash prizes, certificates, and mentor sessions provided.',
      organizerId: 'user_organizer_1',
      organizerName: 'Prof. Vikram Shah',
      department: 'Computer Science',
      date: '2026-09-10',
      time: '09:00 AM',
      venue: 'Main University Auditorium & Lab 4',
      eligibleDepartments: ['Computer Science', 'Information Technology', 'AI & Data Science'],
      eligibleYears: ['1st Year', '2nd Year', '3rd Year', '4th Year'],
      maxParticipants: 150,
      registrationDeadline: '2026-09-08',
      status: 'approved',
      createdAt: new Date().toISOString()
    },
    {
      id: 'evt_cybersec',
      title: 'Cybersecurity & Hands-on Ethical Hacking',
      description: 'Interactive workshop covering network penetration testing, web app vulnerabilities, OWASP Top 10, and modern defense mechanisms.',
      organizerId: 'user_organizer_1',
      organizerName: 'Prof. Vikram Shah',
      department: 'Information Technology',
      date: '2026-09-15',
      time: '02:00 PM',
      venue: 'IT Lab 302',
      eligibleDepartments: ['Computer Science', 'Information Technology'],
      eligibleYears: ['2nd Year', '3rd Year', '4th Year'],
      maxParticipants: 50,
      registrationDeadline: '2026-09-14',
      status: 'pending_approval',
      createdAt: new Date().toISOString()
    },
    {
      id: 'evt_robotics',
      title: 'RoboWars University Championship',
      description: 'Custom bot battles, line follower obstacle courses, and autonomous drone navigation challenges.',
      organizerId: 'user_organizer_1',
      organizerName: 'Prof. Vikram Shah',
      department: 'Robotics',
      date: '2026-09-20',
      time: '10:00 AM',
      venue: 'Indoor Sports Arena',
      eligibleDepartments: ['All Departments'],
      eligibleYears: ['1st Year', '2nd Year', '3rd Year', '4th Year'],
      maxParticipants: 80,
      registrationDeadline: '2026-09-18',
      status: 'approved',
      createdAt: new Date().toISOString()
    }
  ],

  registrations: [
    {
      id: 'evt_techcon_user_student_1',
      eventId: 'evt_techcon',
      eventTitle: 'Hackathon 2026: AI & Cloud Systems',
      userId: 'user_student_1',
      studentName: 'Rahul Sharma',
      prn: '2024CS001',
      department: 'Computer Science',
      year: '3rd Year',
      status: 'approved',
      registeredAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      decidedAt: new Date(Date.now() - 86400000).toISOString(),
      decidedBy: 'user_organizer_1'
    },
    {
      id: 'evt_techcon_user_student_2',
      eventId: 'evt_techcon',
      eventTitle: 'Hackathon 2026: AI & Cloud Systems',
      userId: 'user_student_2',
      studentName: 'Ananya Patel',
      prn: '2024IT042',
      department: 'Information Technology',
      year: '2nd Year',
      status: 'pending',
      registeredAt: new Date().toISOString()
    }
  ]
};

export async function seedFirestore(db, auth) {
  console.log('🌱 Starting Firestore database seeding...');
  
  // Seed Users
  for (const u of SEED_DATA.users) {
    const { password, ...userData } = u;
    await setDoc(doc(db, 'users', u.uid), userData, { merge: true });
    console.log(`✓ User seeded: ${u.email} (${u.role})`);
  }

  // Seed Events
  for (const e of SEED_DATA.events) {
    await setDoc(doc(db, 'events', e.id), e, { merge: true });
    console.log(`✓ Event seeded: ${e.title} [${e.status}]`);
  }

  // Seed Registrations
  for (const r of SEED_DATA.registrations) {
    await setDoc(doc(db, 'registrations', r.id), r, { merge: true });
    console.log(`✓ Registration seeded: ${r.studentName} -> ${r.eventTitle} [${r.status}]`);
  }

  console.log('🎉 Seeding complete!');
  return { success: true, count: SEED_DATA.users.length + SEED_DATA.events.length + SEED_DATA.registrations.length };
}
