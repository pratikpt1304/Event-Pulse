<div align="center">

  <img src="public/logo.jpg" alt="EventPulse Logo" width="120" style="border-radius: 28px; box-shadow: 0 12px 36px rgba(124, 58, 237, 0.4);" />

  # ⚡ EventPulse
  ### Next-Generation University Event & Campus Life Super-Platform

  <p align="center">
    <strong>Empowering campus life with Cryptographic QR Passes, NEX AI Copilot, Teammate Matchmaking, Shared Moments Wall, 1-Click Calendar Sync, and Real-time Broadcasts.</strong>
  </p>

  [![Live App](https://img.shields.io/badge/Live%20Demo-EventPulse%20Web-7c3aed?style=for-the-badge&logo=firebase&logoColor=white)](https://eventpulse-su-34a42.web.app)
  [![Vite](https://img.shields.io/badge/Vite-6.x-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
  [![Firebase](https://img.shields.io/badge/Firebase-Firestore%20%26%20Hosting-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
  [![JavaScript](https://img.shields.io/badge/ES6+-Vanilla%20JS-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/)
  [![License](https://img.shields.io/badge/License-MIT-10B981?style=for-the-badge)](LICENSE)

</div>

---

## 🌟 Overview

**EventPulse** is a university-scale event management and student engagement ecosystem designed from the ground up for modern campuses. Built with high performance, zero-latency caching, and full real-time cloud sync, EventPulse streamlines every step of campus activities — from discovery and squad-building to check-in passes and cryptographic certificates.

👉 **Live Portal**: [https://eventpulse-su-34a42.web.app](https://eventpulse-su-34a42.web.app)

---

## 🚀 Key Features

### 🎫 1. Cryptographic Digital Passes & QR Verification
- **Anti-Fraud Single-Use Passes**: Each pass is cryptographically signed and linked to student PRN & Auth UID.
- **Organizer Turbo Scanner**: High-speed camera scanner with instant sound & haptic feedback (`Beep` for valid pass, `Buzz` for already-used/duplicate tokens).
- **Offline Pass Cache**: Passes load in 0ms even in spotty campus basement/auditorium network conditions.

### 🤖 2. NEX AI — 24/7 Intelligent Campus Copilot
- Next-Gen intelligent assistant built right into the portal.
- Answers queries about upcoming hackathons, eligibility, PRN issues, venue locations, registration fees, and campus helpdesk (Lab 506 / 707).
- Auto-drafts event descriptions and rulebooks for organizers in seconds.

### 📸 3. Campus Moments Wall (Shared Photo Gallery)
- **Live Memory Feed**: Students and attendees can capture and share high-res photos during hackathons, sports tournaments, and cultural nights.
- **Interactive Engagement**: Live ❤️ like counters, filter by event/category, and high-performance **full-screen Lightbox photo viewer**.
- **Client-Side Compression**: Auto-scales uploads up to 1200px HD for lightning-fast loads.

### 📅 4. 1-Click Google & Apple Calendar Sync
- **Universal Calendar Integration**: 1-click sync on event cards and digital passes.
- **Google Calendar**: Pre-fills date, time window, venue location, description, and pass link.
- **Apple / Outlook (.ics)**: Instant dynamic standard iCalendar download with automatic 1-hour pre-event alarm reminder.

### 💬 5. Event Discussion & Live Q&A
- **Real-Time Event Threads**: Students can ask questions regarding kit requirements, reporting deadlines, and guidelines.
- **⚡ Organizer Verified Answers**: Responses from organizers & faculty admins are highlighted with verified official badges.
- **Community Upvotes**: Upvote queries to bring important questions to the top.

### 🤝 6. Teammate & Squad Finder
- Eliminates the hassle of finding hackathon teammates.
- Search and recruit students based on required skills (Frontend, Backend, AI/ML, UI/UX, Hardware).
- 1-Click WhatsApp & in-app squad requests.

### 📢 7. Campus Broadcasts with Ultra-HD Document Viewer
- Instant emergency notices, schedule changes, and fest announcements.
- **Multi-Page Canvas Engine**: PDF.js super-sampled at 2.5x High-DPI resolution for razor-sharp document and rulebook viewing on mobile & laptop screens.
- **Clickable Hyperlinks**: Safe XSS-sanitized linkify engine for Google Forms and Unstop links.

### 💡 8. Campus Democracy Wishlist & Upvoting
- Students propose ideas for concerts, hackathons, and guest speakers.
- Community upvoting and feedback threads help organizers approve the most popular requests.

### 🛡️ 9. Confidential Grievance & Disciplinary Redressal
- Encrypted incident reporting channel direct to University Administration.
- Track resolution notes and status updates confidentially.

---

## 🏗️ Architecture & Tech Stack

```
EventPulse/
├── src/
│   ├── components/      # UI Modals, Cards, Navbar, Lightbox, Scanner, AI Widget
│   ├── services/        # Firebase Auth, Firestore, FCM Push, QR Engine, PDF.js
│   ├── views/           # Events, Passes, Admin Hub, Organizer Hub, Moments Wall
│   ├── styles/          # Responsive Glassmorphic Design System & Themes
│   ├── firebase.js      # Production Firebase Cloud SDK Setup
│   └── main.js          # Client-Side Hash Router & App Lifecycle
├── functions/           # Firebase Admin SDK Backend & Multicast Push Notification Scripts
├── public/              # Service Workers, PWA Manifest, High-Res Assets
└── firestore.rules      # Role-Based Firestore Security Governance
```

| Layer | Technologies Used |
|---|---|
| **Frontend Core** | Vanilla ES6+ JavaScript, HTML5 Canvas, CSS3 Custom Properties |
| **Build & Bundler** | Vite 6.x with Code Splitting & Manual Chunking |
| **Database & Auth** | Google Firebase Cloud Firestore & Firebase Authentication |
| **PDF & Graphics Engine** | PDF.js with Multi-Page Super-Sampled HTML5 Canvas Renderer |
| **Notifications** | Firebase Cloud Messaging (FCM) & Web Push Service Worker |
| **Hosting & CDN** | Firebase Global Edge Hosting (SSL / HTTP/2) |

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

### 3. Start Local Development Server
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

### 4. Build for Production
```bash
npm run build
```

### 5. Deploy to Firebase Hosting
```bash
firebase deploy --only hosting
```

---

## 👥 Role-Based Governance

| Role | Permissions & Access |
|---|---|
| **👨‍🎓 Student** | Browse events, claim single-use QR passes, view certificates, post moments, join squads, ask Q&A, and propose wishlist ideas. |
| **⚡ Organizer** | Create & manage events, scan QR passes at entry gates with live validation, reply with `ORGANIZER VERIFIED` badges in Q&A, and export attendance CSVs. |
| **🛡️ Administrator** | Full platform governance, broadcast campus notices with PDF attachments, manage user roles & PRNs, review grievances, and push multicast notifications. |

---

## 👨‍💻 Author & Creator

**Pratik Thorat**
- GitHub: [@thoratpratik2323-hue](https://github.com/thoratpratik2323-hue)
- Platform: **EventPulse**

---

<div align="center">
  <p>Built with ❤️ for University Campuses across India 🇮🇳</p>
  <sub>© 2026 EventPulse Platform. All rights reserved.</sub>
</div>
