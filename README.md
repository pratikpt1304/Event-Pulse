<div align="center">

  <img src="public/logo.jpg" alt="EventPulse Logo" width="120" style="border-radius: 28px; box-shadow: 0 12px 36px rgba(124, 58, 237, 0.4);" />

  # ⚡ EventPulse
  ### Next-Generation University Event & Academic Governance Super-Platform

  <p align="center">
    <strong>Empowering universities with Cryptographic QR Entry Passes, 5-Tier Academic Governance (Student ➔ Organizer ➔ HOD ➔ Dean ➔ VC), Instant Client-Side PDF Certificate Generation, In-App PDF Canvas Viewer, Inbuilt Gemini AI RAG Copilot, NAAC Criterion 5.3.3 Audits, and Real-Time Push & In-App Broadcasts.</strong>
  </p>

  [![Live App](https://img.shields.io/badge/Live%20Demo-EventPulse%20Web-7c3aed?style=for-the-badge&logo=firebase&logoColor=white)](https://eventpulse-su-34a42.web.app)
  [![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
  [![Firebase](https://img.shields.io/badge/Firebase-Firestore%20%26%20Hosting-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
  [![PDF-Lib](https://img.shields.io/badge/PDF--Lib-High--DPI%20Certs-E11D48?style=for-the-badge&logo=adobeacrobatreader&logoColor=white)](https://pdf-lib.js.org/)
  [![Gemini AI](https://img.shields.io/badge/AI-Google%20Gemini%20RAG-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
  [![Security](https://img.shields.io/badge/Security-Grade%20A%2B%20Headers-10B981?style=for-the-badge&logo=shield&logoColor=white)](https://eventpulse-su-34a42.web.app)
  [![License: MIT](https://img.shields.io/badge/License-MIT-10B981?style=for-the-badge)](LICENSE)

</div>

---

## 🌟 Overview

**EventPulse** is an enterprise-scale university event management, student lifecycle, and academic governance ecosystem engineered for modern campus operations. Built on zero-framework Vanilla ES6+, Vite 6, and reactive Firebase Firestore listeners, EventPulse unifies every stakeholder in university life &mdash; students, club organizers, department heads (HODs), academic deans, and the Vice Chancellor's apex office.

🌐 **Production Deployment**: [https://eventpulse-su-34a42.web.app](https://eventpulse-su-34a42.web.app)  
🔒 **Repository**: Private GitHub Enterprise Repository (`thoratpratik2323-hue/Event-Pulse`)

---

## 👥 Academic Role Hierarchy & Demo Accounts

EventPulse enforces strict role separation across the university's academic governance hierarchy:

| Persona | Demo Email | Password | Academic Scope & Authority |
|---|---|---|---|
| **👩‍🎓 Student**<br>*(Mihika Joshi)* | `student@college.edu` | `Password@123` | Integrated M.Tech (AIML) 1st Year student. Event discovery, dynamic QR passes, verified certificate downloads, squad matchmaking, wishlist ideas, and confidential grievances. |
| **⚡ Organizer**<br>*(Hariprasath)* | `organizer@college.edu` | `Password@123` | Event proposal submission, **Multi-Tier Visual Approval Pipeline Tracker**, live camera QR gate attendance scanner, participant roster management, and CSV exports. |
| **📚 HOD**<br>*(Dr. Arun Kulkarni)* | `hod@college.edu` | `Password@123` | Department-level academic jurisdiction (Integrated M.Tech AIML). Endorses/sanctions departmental events, monitors 1st&ndash;4th year student breakdown, resolves grievances, and exports **NAAC Criterion 5.3.3 Reports**. |
| **🎓 Dean**<br>*(Dr. Neha Sharma)* | `dean@college.edu` | `Password@123` | School of Engineering & Technology oversight (11 Departments). Inter-departmental participation matrix, budgetary and venue sanctions, star achievers tracking, and school-wide compliance. |
| **👑 Vice Chancellor**<br>*(Prof. K. V. Raman)* | `vc@college.edu` | `Password@123` | Supreme Executive Authority. **Apex Institutional Matrix**, NAAC/NIRF readiness metrics, **Universal Student Directory with 4-Tier Interactive Drilldown Filters**, University Ombudsman grievance redressal, and **Instant Campus-Wide Proclamation Broadcasts**. |
| **🛠️ Central Admin** | `admin@college.edu` | `Password@123` | Platform administration, staff role invitations, direct event publishing, system configuration, and audit logs. |

> [!NOTE]
> Demo accounts are accessible with 1-click directly from the **⚡ Quick Demo Logins** grid on the `#login` view.

---

## 🚀 Key Platform Features & Architecture

### 1. 🏛️ Academic Multi-Tier Governance Pipeline
- Organizers cannot self-publish events. Every proposed event moves through a visual 5-stage progress stepper:
  $$\text{1. Proposal Drafted} \longrightarrow \text{2. HOD Review} \longrightarrow \text{3. Dean Approval} \longrightarrow \text{4. VC Directive} \longrightarrow \text{5. Campus Discovery Feed}$$
- Live status tags (`🟢 INSTITUTIONALLY APPROVED & LIVE`, `⏳ AWAITING ADMINISTRATIVE SANCTION`, `🏁 CONCLUDED & ARCHIVED`).

### 2. 🤖 Inbuilt Gemini AI Campus Assistant & RAG Copilot
- Real-time campus chatbot powered by Google Gemini API.
- Live Firestore context retrieval (RAG) that answers questions regarding upcoming hackathons, registration deadlines, rules, and departmental schedules.
- AI-assisted event description drafting for organizers with one-click generation.

### 3. 📜 Client-Side Instant PDF Certificate Engine
- Powered by `pdf-lib` operating entirely inside the student's browser (0ms server latency, zero pop-up blocking issues).
- Generates high-resolution, print-ready A4 landscape certificates containing:
  - Official **Sanjivani University** header, gold decorative borders, and institutional seal.
  - Student Name, College PRN, and Academic Department.
  - Three official signatures: **HOD**, **Dean of Engineering**, and **Vice Chancellor**.
  - Digital Certificate ID with instant public validation via `#verify/{id}`.

### 4. 📄 In-App High-DPI PDF & Circular Viewer
- Built-in multi-browser PDF Canvas Engine using bundled `pdfjs-dist`.
- Retina / High-DPI super-sampling (2.5x multiplier) for razor-sharp rendering of university notices, circulars, and attachments without forcing file downloads.

### 5. 🛡️ Crash-Proof Frontend & Error Boundaries
- Comprehensive AST-verified code hardening:
  - **Zero-Freeze Buttons**: All async network requests wrapped in `try...catch...finally` so action buttons never remain permanently disabled on network timeouts.
  - **Modal Deduplication**: Global root tracking (`getElementById` + auto-cleanup) prevents stacking of duplicate dark backdrops on rapid multi-clicks.
  - **Graceful Media Fallbacks**: Handled `onerror` fallbacks across dynamic QR codes, posters, and document previews.

### 6. 📊 NAAC Criterion 5.3.3 & IQAC Compliance Reporting
- 1-Click export of official accreditation audit sheets:
  - `NAAC Criterion (5.3.3 - Sports, Cultural & Co-Curricular Student Activities)`
  - `Student PRN, Academic Year, Event Title, Activity Level (State/National)`
  - `Certificate Verification IDs & Accreditation Authority Sign-Off`

### 7. 🔔 Real-Time Cross-Role In-App Notification Center
- Reactive notification bell in the top navigation bar.
- Automatic cross-tab sync via custom event bus (`ep_notification_update`).
- Unread badge counters and role-aware message dispatch for students, organizers, academic leaders, and central admins.

### 8. 🎟️ Student Pass Vault: Active Passes vs Attended History
- Filter pill switcher in `#my-passes`:
  - `🟢 Upcoming Active Passes`: Single-use encrypted QR code passes for gate entry.
  - `🏁 Attended & Certified History`: Direct links to download PDF certificates and inspect participation records.

---

## ⚡ Quick Start & Local Development

### 1. Clone the Repository
```bash
git clone https://github.com/thoratpratik2323-hue/Event-Pulse.git
cd Event-Pulse
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure your Firebase configuration keys and `VITE_DEMO_MODE=true` are set.

### 4. Seed Demo Environment
Seed the 5 academic personas, verified demo certificates, and completed events:
```bash
npm run seed:demo
```

### 5. Run Local Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 6. Production Build & Deployment
```bash
# Build the project
npm run build

# Deploy directly to Firebase Hosting (Uses authenticated Service Account credentials)
npm run deploy:hosting
```

---

## 🏗️ Architecture & Project Structure

```
EventPulse/
├── src/
│   ├── assets/          # Static branding, university seals, and logos
│   ├── components/      # Navbar, DigitalPassModal, Scanner, Modals, DocumentPreviewModal
│   ├── services/        # Service modules:
│   │   ├── ai.js                  # Inbuilt Google Gemini API + Live Firestore RAG
│   │   ├── auth.js                # Role resolution, session state, permissions
│   │   ├── clientPdfService.js    # Browser-side PDF certificate generator (pdf-lib)
│   │   ├── certificates.js        # Certificate cache, queries, and download triggers
│   │   ├── notifications.js       # Role-aware real-time notification engine
│   │   ├── events.js              # Event approvals, status transitions, Firestore CRUD
│   │   ├── registrations.js       # Student registration and pass management
│   │   ├── qr.js                  # Signed HMAC QR generation and camera validation
│   │   └── announcements.js       # Campus broadcasts and VC circulars
│   ├── styles/          # Responsive Glassmorphic Design System & Variables
│   ├── views/           # Modular SPA Views:
│   │   ├── LoginView.js               # Clean 5-Role Demo Grid & Sign In / Sign Up
│   │   ├── EventsView.js              # Student Event Discovery & Live Feed
│   │   ├── StudentPassesView.js       # Pass Vault (Upcoming vs Attended History)
│   │   ├── OrganizerDashView.js       # Organizer Hub, Governance Stepper & Gate Scanner
│   │   ├── ExecutiveDashboardView.js  # Scoped HOD, Dean, & VC Apex Dashboards
│   │   ├── AdminView.js               # Central Administration & User Directory
│   │   ├── IdeaHubView.js             # Campus Wishlist & Democracy Voting
│   │   └── VerifyCertView.js          # Public Certificate Validation Portal
│   ├── firebase.js      # Initialized with import.meta.env.VITE_* variables
│   ├── router.js        # Route Guards, Role Redirects, and Hash Router
│   └── main.js          # App Bootstrap & Lifecycle Manager
├── functions/           # Firebase Cloud Functions & Push Notification Services
├── scripts/
│   ├── seed-demo.js         # Seeds 5 Core Personas, Sample Passes & Certificates
│   ├── seed-certificate.js  # Verified Certificate & Event Seeder
│   └── deploy-hosting.js    # Direct Firebase Hosting REST API Deployment Script
├── public/              # Service Workers, Manifest, Posters & Icons
├── firebase.json        # Grade A+ Security Headers & Hosting Configuration
└── firestore.rules      # Strict Security Rules enforcing role-scoped access
```

---

## 🔒 Security & Compliance

- **Grade A+ HTTP Security Headers**: Content-Security-Policy (CSP), Strict-Transport-Security (`max-age=31536000; includeSubDomains; preload`), X-Frame-Options (`DENY`), X-Content-Type-Options (`nosniff`), and Referrer-Policy enforced on Firebase Hosting.
- **Role-Based Access Control (RBAC)**: All sensitive collections (`events`, `registrations`, `complaints`, `certificates`, `staffInvites`) are protected by server-enforced rules in `firestore.rules`.
- **Anti-Fraud QR Passes**: QR passes contain cryptographic hashes verified by camera scanners; unauthorized modifications fail gate check.
- **Closed Event Restrictive Access**: Only approved roster emails can view or register for private departmental hackathons.

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
