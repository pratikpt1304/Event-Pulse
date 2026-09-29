<div align="center">

  <img src="public/logo.jpg" alt="EventPulse Logo" width="120" style="border-radius: 28px; box-shadow: 0 12px 36px rgba(124, 58, 237, 0.4);" />

  # ⚡ EventPulse
  ### Next-Generation University Event & Campus Life Super-Platform

  <p align="center">
    <strong>Empowering university campuses with Cryptographic QR Entry Passes, AI Campus Copilot, Role-Scoped Academic Dashboards (HOD, Dean, VC), Teammate Squad Matchmaking, and High-DPI Notice Broadcasts.</strong>
  </p>

  [![Live App](https://img.shields.io/badge/Live%20Demo-EventPulse%20Web-7c3aed?style=for-the-badge&logo=firebase&logoColor=white)](https://eventpulse-su-34a42.web.app)
  [![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
  [![Firebase](https://img.shields.io/badge/Firebase-Firestore%20%26%20Hosting-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
  [![JavaScript](https://img.shields.io/badge/ES6+-Vanilla%20JS-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/)
  [![License: MIT](https://img.shields.io/badge/License-MIT-10B981?style=for-the-badge)](LICENSE)

</div>

---

## 🌟 Overview

**EventPulse** is a university-scale event management and academic governance ecosystem engineered for modern campus operations. Built on zero-framework Vanilla ES6+, Vite 6, and reactive Firebase Firestore listeners, EventPulse unifies every stakeholder in university life &mdash; students, club organizers, department heads (HODs), academic deans, and the Vice Chancellor's office.

🌐 **Production Deployment**: [https://eventpulse-su-34a42.web.app](https://eventpulse-su-34a42.web.app)

---

## 👥 Role & Permissions Matrix

EventPulse enforces strict role separation across six university personas. Roles are never settable client-side; they are assigned by administrators or pre-provisioned via the `staffInvites` collection in Firestore.

| Persona | Role Key | Permissions & Scope | Onboarding Workflow |
|---|---|---|---|
| **👨‍🎓 Student** | `student` | Browse events, claim single-use anti-fraud QR passes, view digital certificates, join squad matchmaking, submit wishlist ideas, and ask Q&A. | Self-registration via the **Student Sign Up** tab with college PRN and email verification. |
| **⚡ Organizer** | `organizer` | Create & manage events, live camera gate pass scanner with haptic/audio validation, reply with `ORGANIZER VERIFIED` badges in Q&A, and export attendance CSVs. | Staff Invite issued by Admin (`staffInvites/{email}`). Cannot self-register. |
| **📚 HOD** | `hod` | Department-scoped academic dashboard, approve and endorse departmental events, view student attendance numbers, and export NAAC Criterion 5 participation logs. | Staff Invite issued by Admin (`staffInvites/{email}`). Applied on first login. |
| **🎓 Dean** | `dean` | School/Faculty-wide event oversight, cross-department metrics, inter-departmental event approvals, and institutional compliance reviews. | Staff Invite issued by Admin (`staffInvites/{email}`). Applied on first login. |
| **👑 Vice Chancellor** | `vc` | University-wide executive dashboard, institutional health metrics, campus participation summaries, and flagship event oversight. | Staff Invite issued by Admin (`staffInvites/{email}`). Applied on first login. |
| **🛡️ Administrator** | `admin` | Full platform control: issue staff invites, bulk CSV invite import with interactive validation preview, promote/demote user roles, broadcast notices, review grievances. | Pre-configured in `SUPER_ADMIN_EMAILS` or manually assigned in Firestore. |

---

## 🔐 Staff Invites Architecture

Staff members (**Organizer, HOD, Dean, VC, Admin**) cannot create accounts through the student sign-up form. Their roles are provisioned securely:

1. **Admin Issues Invite**: In the Admin Console, the administrator issues an invite (or uploads a CSV) targeting a faculty email, specifying `role` and `department`.
2. **Firestore Record**: A document is written to `staffInvites/{email.toLowerCase()}` with fields `{ email, role, department, invitedBy, redeemed: false }`.
3. **Automatic Redemption on First Login**: When the staff member signs in with their university email, the authentication service looks up `staffInvites/{email}`, updates `users/{uid}` with their assigned role and department, and marks the invite as redeemed.
4. **Strict Security Rules**: Non-admin users cannot alter their own `role` field in `users/{uid}`, ensuring tamper-proof authorization.

---

## 🔑 How to Create the First Admin

To bootstrap the administrative account for your campus deployment:

### Option A: Via Firebase Console (Recommended for Production)
1. Navigate to the [Firebase Console](https://console.firebase.google.com/) and open your project.
2. Under **Authentication** &rarr; **Users**, click **Add User** and create an account with your admin email (e.g. `admin@college.edu`) and a secure password. Copy the generated **User UID**.
3. Go to **Firestore Database** &rarr; click on the `users` collection.
4. Add a document with **Document ID** = `{User UID}` and add the following fields:
   * `role`: `"admin"` (string)
   * `name`: `"System Administrator"` (string)
   * `email`: `"admin@college.edu"` (string)
   * `department`: `"Central Administration"` (string)
5. Alternatively, add your email address to the `SUPER_ADMIN_EMAILS` array in [`src/services/auth.js`](file:///C:/My%20Projects/New%20folder/src/services/auth.js).

### Option B: Using the Demo Seed Script (Local Development)
1. Download your service account key from **Firebase Project Settings &rarr; Service Accounts** and save it as `functions/serviceAccountKey.json`.
2. Run:
   ```bash
   npm run seed:demo
   ```
   This automatically provisions the six demo accounts (`admin@college.edu`, `vc@college.edu`, `dean@college.edu`, `hod@college.edu`, `organizer@college.edu`, `student@college.edu`) with the password `Password@123`.

---

## 🧪 Demo Mode (Evaluators & Presentations)

For showcase and demonstration environments, EventPulse includes a 1-click **Try Demo** switcher:
* Enable by setting `VITE_DEMO_MODE=true` in your `.env` or `.env.local` file.
* When active, a demo card renders on the login view allowing 1-click login as **Student**, **Organizer**, **HOD**, **Dean**, **VC**, or **Admin**.
* **Production Safety**: In production builds, `VITE_DEMO_MODE` is disabled (`false`), completely hiding all demo buttons from real students and faculty.

---

## ⚡ Quick Start & Local Development

### 1. Clone the Repository
```bash
git clone https://github.com/thoratpratik2323-hue/Event-Pulse.git
cd Event-Pulse
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your Firebase credentials, optional college domain (`VITE_ALLOWED_EMAIL_DOMAIN=sanjivani.edu.in`), and demo mode preference.

### 3. Install Dependencies
```bash
npm install
```

### 4. Start Local Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 5. Build for Production
```bash
npm run build
```

---

## 🏗️ Architecture & Project Structure

```
EventPulse/
├── src/
│   ├── assets/          # Static branding, university seals, and logos
│   ├── components/      # Navbar, DigitalPassModal, Scanner, PulseAIChatWidget
│   ├── services/        # Firebase Auth, Staff Invites, Firestore, FCM Push, QR Engine
│   ├── styles/          # Responsive Glassmorphic Design System & Variables
│   ├── views/           # Modular SPA Views:
│   │   ├── LoginView.js               # Dual-Tab Sign In & Student Sign Up
│   │   ├── EventsView.js              # Student Portal, Event Discovery, Calendar Sync
│   │   ├── StudentPassesView.js       # Cryptographic QR Entry Passes
│   │   ├── OrganizerDashView.js       # Organizer Hub, Turbo QR Camera Gate Scanner
│   │   ├── ExecutiveDashboardView.js  # HOD, Dean, & VC Scoped Academic Dashboards
│   │   ├── AdminView.js               # Admin Console, Staff Invites & CSV Import
│   │   ├── IdeaHubView.js             # Campus Wishlist & Democracy Voting
│   │   └── VerifyCertView.js          # Public Certificate Cryptographic Verification
│   ├── firebase.js      # Initialized with import.meta.env.VITE_* variables
│   ├── router.js        # Route Guards, Role Redirects, and Hash Router
│   └── main.js          # App Bootstrap & Lifecycle Manager
├── functions/           # Firebase Admin SDK & Push Notification Cloud Functions
├── scripts/
│   ├── seed-demo.js     # Seeds 6 Core Personas in Firebase Auth & Firestore
│   ├── seed.js          # Sample Event Data & Notice Seeder
│   └── test-closed-events.js # Automated verification test suite for closed events
├── public/              # Service Workers, Manifest, Posters & Icons
├── .env.example         # Environment template with demo mode & domain settings
└── firestore.rules      # Strict Security Rules enforcing role-scoped access
```

---

## 🔒 Closed Event Participants & Invite-Only Roster

EventPulse supports **Closed Events** restricted to specific approved participants.

### 1. Visibility & Access Model
* **Open Events (`visibility: 'open'`)**: Discoverable and registerable by all eligible university students.
* **Closed Events (`visibility: 'closed'`)**: Restricted strictly to students on the event's approved participant roster. Unlisted students cannot see the event in their discovery feed, cannot access direct registration, and are rejected by Firestore security rules.

### 2. Participant Storage & Security
* **Storage Location**: `events/{eventId}/allowedParticipants/{emailLower}`
* **Schema**:
  ```json
  {
    "name": "Aditya Patil",
    "email": "aditya.cs24@college.edu",
    "prn": "PRN20240101",
    "addedBy": "Prof. Anwar / Organizer",
    "addedByUid": "user_uid",
    "addedAt": "2026-09-29T10:00:00.000Z"
  }
  ```
* **Security Rules**:
  - `events/{eventId}`: Closed events can only be fetched by the event owner, staff/admin, or listed participants (`request.auth.token.email.lower() in allowedParticipants`).
  - `events/{eventId}/allowedParticipants/{email}`: Only the event owner or admin can read/write the list. Arbitrary students cannot list the participant subcollection.
  - `registrations/{regId}`: Creation blocked if the target event is closed and caller email is not on the roster.

### 3. Building Participant Lists
Organizers can manage rosters from **Organizer Dashboard → 👥 Allowed Participants**:
* **Manual Add**: Name, College Email, PRN.
* **Excel & CSV Bulk Upload**: Drag & Drop `.xlsx`, `.xls`, or `.csv` files parsed completely in the browser via **SheetJS** (`xlsx`).
* **Validation Preview**: Real-time analysis detecting:
  - ✅ Valid rows
  - ⚠️ Invalid rows (missing fields, malformed emails)
  - 🔁 Duplicates (intra-file and already-existing entries)
* **Sample Template**: Downloadable `.xlsx` and `.csv` templates.
* **Batch Writes**: Chunks writes into Firestore batches of up to 450 documents with a live progress indicator.

### 4. Manual Test Checklist
1. **Organizer Upload**:
   - Log in as Organizer (`anwar.hod@college.edu` or demo account).
   - Go to Organizer Dashboard → Select or Create a Closed event.
   - Go to **👥 Allowed Participants** tab.
   - Click **📥 Template (.xlsx)** to download the sample file.
   - Click **📤 Upload Excel / CSV** → Drag & drop the template file.
   - Verify that Valid, Invalid, and Duplicate counts appear correctly.
   - Click **Confirm & Save Participants** → Check that the roster table populates with the participants.
2. **Listed Student Registration**:
   - Log in as a student whose email is in the uploaded roster.
   - Open Event Discovery (`#events`) → Verify the event appears with the **🔒 Closed Roster** badge.
   - Click **Register Now** → Verify that registration succeeds (`pending`).
3. **Unlisted Student Blocked**:
   - Log in as a student whose email is NOT in the roster.
   - Open Event Discovery (`#events`) → Verify the event does not appear in the feed.
   - If attempting to register, verify that access is blocked with a `🔒 Registration Restricted: This is a closed, invite-only event` warning.

---

## 📄 License

This project is open-source and distributed under the [MIT License](LICENSE).

---

## 👨‍💻 Author & Acknowledgements

**Pratik Thorat**
* GitHub: [@thoratpratik2323-hue](https://github.com/thoratpratik2323-hue)
* Platform: **EventPulse**

<div align="center">
  <sub>Built with ❤️ for University Campuses across India 🇮🇳</sub>
</div>
