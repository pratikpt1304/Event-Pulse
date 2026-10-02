import { getApprovedEvents, getCachedEventsSync } from './events.js';
import { getStudentRegistrations, getCachedRegistrationsSync } from './registrations.js';
import { getCachedCertificatesSync } from './certificates.js';
import { getCachedTeamsSync } from './teams.js';
import { getCachedVolunteersSync } from './volunteers.js';
import { getAnnouncements, getCachedAnnouncementsSync } from './announcements.js';
import { getStudentComplaints } from './complaints.js';

function formatDateSafe(val) {
  if (!val) return 'Recent';
  try {
    if (typeof val.toDate === 'function') return val.toDate().toLocaleDateString();
    if (val.seconds) return new Date(val.seconds * 1000).toLocaleDateString();
    return new Date(val).toLocaleDateString();
  } catch (e) {
    return 'Recent';
  }
}

/**
 * Retrieves the active Gemini API key from environment variable or localStorage
 */
export function getGeminiApiKey() {
  try {
    if (typeof localStorage !== 'undefined') {
      const localKey = localStorage.getItem('ep_gemini_api_key');
      if (localKey && localKey.trim()) return localKey.trim();
    }
  } catch (e) {}

  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) {
      return import.meta.env.VITE_GEMINI_API_KEY;
    }
  } catch (e) {}

  return '';
}

/**
 * Saves a custom Gemini API key into localStorage
 */
export function setGeminiApiKey(key) {
  try {
    if (typeof localStorage !== 'undefined') {
      if (!key) {
        localStorage.removeItem('ep_gemini_api_key');
      } else {
        localStorage.setItem('ep_gemini_api_key', key.trim());
      }
    }
  } catch (e) {}
}

/**
 * Checks if Gemini AI is currently active and configured
 */
export function isGeminiAIActive() {
  return !!getGeminiApiKey();
}

/**
 * Fetch fresh campus context from Firestore so the AI is NEVER stale
 */
async function getLiveCampusContext(user) {
  let events = [];
  try {
    events = await getApprovedEvents();
  } catch (e) {
    events = getCachedEventsSync() || [];
  }

  let registrations = [];
  if (user?.uid) {
    try {
      registrations = await getStudentRegistrations(user.uid);
    } catch (e) {
      registrations = getCachedRegistrationsSync(user.uid) || [];
    }
  }

  let complaints = [];
  if (user) {
    try {
      complaints = await getStudentComplaints(user);
    } catch (e) {}
  }

  let announcements = [];
  try {
    announcements = await getAnnouncements();
  } catch (e) {
    announcements = getCachedAnnouncementsSync() || [];
  }

  return { events, registrations, complaints, announcements };
}

/**
 * Calls Google Gemini API (gemini-1.5-flash / gemini-2.0-flash)
 */
async function callGeminiAPI(prompt, systemInstruction, apiKey) {
  const models = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemInstruction}\n\nUSER QUESTION:\n${prompt}` }]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 900
        }
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        console.warn(`Gemini API error with model ${model}:`, res.status);
        continue;
      }

      const data = await res.json();
      const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (answer && answer.trim()) {
        return answer.trim();
      }
    } catch (err) {
      console.warn(`Gemini call error with ${model}:`, err.message);
    }
  }

  return null;
}

/**
 * Main AI Query Handler — Dual-Engine Architecture
 * Engine A: Google Gemini 1.5 Flash (Grounded with real-time Campus Data)
 * Engine B: Smart Live Campus NLP Engine (Instant, Offline & Zero-Failure)
 */
export async function askPulseAI(rawQuery, user) {
  const query = (rawQuery || '').trim();
  if (!query) {
    return {
      text: "👋 Hi! Main **NEX AI** hoon. Aap mujhse campus events, hackathons, passes, ya grievance ke baare me kuch bhi pooch sakte hain!",
      actions: [{ label: '🎉 Browse Events', route: 'events' }]
    };
  }

  // 1. Load Live Campus Context
  const context = await getLiveCampusContext(user);
  const { events, registrations, complaints, announcements } = context;

  // 2. Try Engine A: Google Gemini AI (if key is set)
  const geminiKey = getGeminiApiKey();
  if (geminiKey) {
    const eventsBrief = events.map((e, idx) => 
      `${idx + 1}. Title: "${e.title}" | Category: ${e.category} | Date: ${e.date} | Venue: ${e.venue || 'Campus Main Hall'} | Organizer: ${e.organizerName || 'Department'} | Description: ${(e.description || '').substring(0, 120)}`
    ).join('\n');

    const userBrief = user 
      ? `Name: ${user.name}, Role: ${user.role}, Dept: ${user.department || 'Computer Engineering'}, PRN: ${user.prn || 'N/A'}`
      : 'Visitor / Not Logged In';

    const regsBrief = registrations.length > 0
      ? registrations.map(r => `• Event "${r.eventTitle}": Status = ${r.status || 'approved'}, Registered On = ${r.registeredAt}`).join('\n')
      : 'No events registered yet.';

    const systemPrompt = `You are "NEX", the official next-generation AI campus assistant for EventPulse at Sanjivani University.
You are smart, supportive, friendly, and precise.
You seamlessly converse in whatever language the user uses — English, Hindi, Hinglish (Hindi in English script), or Marathi!

LIVE SANJIVANI CAMPUS CONTEXT:
- Active Events in Database (${events.length} total):
${eventsBrief || 'No active events currently listed.'}

- Current User:
${userBrief}

- User Registered Passes:
${regsBrief}

- Official University Leadership:
  * Head of Department (HOD, Computer Engineering): Prof. Anwar Sheikh
  * Dean (School of Engineering & Tech): Dr. Neha Sharma
  * Vice Chancellor (Apex Executive): Prof. K. V. Raman

- Key Campus Policies:
  * Official Duty / OD Attendance: When a student checks in at any event venue using their EventPulse QR pass, a verified OD attendance notification is sent directly to their HOD for official college leave credit.
  * Registration Fees: Events hosted for Sanjivani students are 100% free unless explicitly stated as an external inter-college ticketed fest.
  * Grievance Redressal: Students can submit confidential grievance reports under "My Passes -> Grievances" which are reviewed directly by the HOD, Dean, and VC.
  * Squads / Teammates: Students can find teammates for hackathons in the "Squad Finder" tab.

RESPONSE GUIDELINES:
1. Provide a direct, helpful, and natural answer. Format using neat bullet points and markdown bold.
2. If the user asks in Hindi/Hinglish (e.g. "aaj kya chal raha hai", "hackathon kab hai", "mera pass dikhao"), reply naturally in clean, friendly Hinglish/Hindi!
3. If they ask about specific events, refer directly to the live events list above.
4. Keep answers concise (under 150 words) unless detailed step-by-step instructions are asked.`;

    try {
      const geminiResponse = await callGeminiAPI(query, systemPrompt, geminiKey);
      if (geminiResponse) {
        // Derive contextual actions
        const actions = [];
        const lowQuery = query.toLowerCase();
        if (lowQuery.includes('event') || lowQuery.includes('hackathon') || lowQuery.includes('fest')) {
          actions.push({ label: '🎉 View Campus Events', route: 'events' });
        }
        if (lowQuery.includes('pass') || lowQuery.includes('ticket') || lowQuery.includes('registered')) {
          actions.push({ label: '🎫 My Passes', route: 'my-passes' });
        }
        if (lowQuery.includes('team') || lowQuery.includes('squad') || lowQuery.includes('hackathon')) {
          actions.push({ label: '🤝 Find Squads', route: 'teams_modal' });
        }
        if (lowQuery.includes('complain') || lowQuery.includes('grievance') || lowQuery.includes('issue')) {
          actions.push({ label: '🚨 File Grievance', route: 'complaint_modal' });
        }
        if (actions.length === 0) {
          actions.push({ label: '🎉 Browse Events', route: 'events' });
          actions.push({ label: '🎫 My Passes', route: 'my-passes' });
        }

        return {
          text: `⚡ **NEX AI (Gemini 1.5 Flash)**:\n\n${geminiResponse}`,
          actions
        };
      }
    } catch (err) {
      console.warn('Gemini inference fallback:', err);
    }
  }

  // 3. Engine B: Smart Live Campus Grounded NLP (Instant Local Fallback)
  return runSmartCampusEngine(query, user, context);
}

/**
 * Engine B: Smart Live Campus Grounded NLP Engine
 * High-speed semantic matcher over live Firestore data with multi-lingual support
 */
function runSmartCampusEngine(rawQuery, user, context) {
  const { events, registrations, complaints, announcements } = context;
  const q = rawQuery.toLowerCase().trim();

  // Helper: check any keyword match
  const has = (...keywords) => keywords.some(k => q.includes(k.toLowerCase()));

  // -------------------------------------------------------------
  // 1. GREETINGS & INTRODUCTIONS
  // -------------------------------------------------------------
  if (has('hi', 'hello', 'hey', 'hii', 'kya hal', 'kaise ho', 'wassup', "what's up", 'good morning', 'good afternoon', 'good evening', 'namaste')) {
    const userName = user ? user.name.split(' ')[0] : 'friend';
    const activeCount = events.length;
    return {
      text: `👋 **Hey ${userName}! Welcome to NEX AI.** ⚡\n\nMain Sanjivani University ka **Live Campus Copilot** hoon.\n\n📊 **Campus Status Right Now:**\n• 🎉 **${activeCount} Events** abhi live hain database me!\n• 📢 **${announcements.length} Official Notices** posted hain.\n\n**Aap mujhse ye sab pooch sakte hain:**\n• *"Upcoming hackathons & fests dikhao"*\n• *"Mera pass aur registration status kya hai?"*\n• *"HOD ya Dean kaun hain?"*\n• *"Hackathon me attendance (OD) kaise milegi?"*\n• *"Naya event suggest karna hai"*`,
      actions: [
        { label: '🎉 Browse Live Events', route: 'events' },
        { label: '🎫 My Passes', route: 'my-passes' },
        { label: '🤝 Squad Finder', route: 'teams_modal' }
      ]
    };
  }

  // -------------------------------------------------------------
  // 2. CREATOR & PLATFORM IDENTITY
  // -------------------------------------------------------------
  if (has('who made you', 'who created you', 'kisne banaya', 'creator', 'developer', 'who are you', 'kya ho tum', 'your name', 'pratik')) {
    return {
      text: `⚡ **I am NEX AI — Architected & Designed by Pratik Thorat!** 🚀👨‍💻\n\n**Pratik Thorat** built and developed the entire **EventPulse Platform** and **NEX AI** for **Sanjivani University** to modernize campus event clearance, digital QR passes, hackathon squads, and academic attendance workflows.\n\n✨ **Core Features Created by Pratik:**\n• 🎫 **Cryptographic QR Passes & Tamper-Proof Certificates**\n• 🏛️ **3-Tier Approval Workflow (HOD ➔ Dean ➔ Vice Chancellor)**\n• ⚡ **Live Attendance & Auto-OD Credit Engine**\n• 🤝 **Campus Squad & Teammate Hub**\n• 🚨 **Confidential Grievance Redressal Dossier**`,
      actions: [
        { label: '🎉 Explore Events', route: 'events' },
        { label: '🎫 My Digital Passes', route: 'my-passes' }
      ]
    };
  }

  // -------------------------------------------------------------
  // 3. USER PASSES, TICKETS & REGISTRATION STATUS
  // -------------------------------------------------------------
  if (has('my pass', 'pass status', 'mera pass', 'ticket', 'registration status', 'mera ticket', 'admit card', 'status kya hai')) {
    if (!user) {
      return {
        text: `🔒 **Please Sign In First!**\n\nApna live pass aur attendance status check karne ke liye pehle apne student account se sign in karein.`,
        actions: [{ label: '🔑 Sign In Now', route: 'login' }]
      };
    }

    if (registrations.length === 0) {
      return {
        text: `🎫 **No Active Passes Found for ${user.name}!**\n\nAapne abhi tak kisi event me register nahi kiya hai. Abhi campus me **${events.length} events** live hain jisme aap 1-click se participate kar sakte hain!`,
        actions: [{ label: '🎉 Explore & Claim Free Pass', route: 'events' }]
      };
    }

    const regList = registrations.slice(0, 4).map(r => {
      const statusIcon = r.status === 'approved' ? '✅ Approved' : (r.status === 'attended' ? '🎟️ Attended' : '⏳ Pending Approval');
      return `• **${r.eventTitle}**\n  Status: ${statusIcon} | 📅 Reg: ${formatDateSafe(r.registeredAt)}`;
    }).join('\n\n');

    return {
      text: `🎫 **Your Live Passes (${registrations.length} Total)**:\n\n${regList}\n\nAapka **QR Code Pass** ready hai venue par check-in ke liye!`,
      actions: [
        { label: '📱 Open My Passes Wallet', route: 'my-passes' },
        { label: '🎉 Browse More Events', route: 'events' }
      ]
    };
  }

  // -------------------------------------------------------------
  // 4. SEARCHING LIVE EVENTS & HACKATHONS
  // -------------------------------------------------------------
  if (has('event', 'hackathon', 'competition', 'fest', 'workshop', 'sports', 'coding', 'aaj kya hai', 'upcoming', 'browse', 'list')) {
    if (events.length === 0) {
      return {
        text: `📌 **Abhi koi live approved event scheduled nahi hai.**\n\nLekin aap naye hackathon ya fest ke liye **Campus Wishlist** par vote ya request kar sakte hain!`,
        actions: [{ label: '💡 Request Event on Wishlist', route: 'ideas' }]
      };
    }

    // Filter by specific subcategory if mentioned
    let matchedEvents = events;
    if (has('hackathon', 'coding', 'tech', 'software', 'ai')) {
      matchedEvents = events.filter(e => (e.category || '').toLowerCase().includes('tech') || (e.title || '').toLowerCase().includes('hack'));
    } else if (has('sports', 'cricket', 'football', 'badminton', 'chess')) {
      matchedEvents = events.filter(e => (e.category || '').toLowerCase().includes('sport'));
    } else if (has('cultural', 'dance', 'music', 'dj', 'drama')) {
      matchedEvents = events.filter(e => (e.category || '').toLowerCase().includes('cult'));
    }

    if (matchedEvents.length === 0) matchedEvents = events;

    const listHtml = matchedEvents.slice(0, 3).map((e, i) => 
      `${i + 1}. 🌟 **${e.title}**\n   📁 ${e.category} | 📅 ${e.date || 'Upcoming'} | 📍 ${e.venue || 'Campus Auditorium'}\n   👤 Organizer: ${e.organizerName || 'Department'}`
    ).join('\n\n');

    return {
      text: `🎉 **Live Campus Events Found (${matchedEvents.length})**:\n\n${listHtml}\n\n*Tap below to open event cards and claim your instant QR pass!*`,
      actions: [
        { label: '🎉 Open Events Directory', route: 'events' },
        { label: '🤝 Find Squad Teammates', route: 'teams_modal' }
      ]
    };
  }

  // -------------------------------------------------------------
  // 5. ATTENDANCE, OD (OFFICIAL DUTY) & LEAVE POLICY
  // -------------------------------------------------------------
  if (has('attendance', 'od', 'duty leave', 'leave', 'absent', 'concession', 'attendance milegi', 'lecture miss')) {
    return {
      text: `📋 **Official Academic On-Duty (OD) Attendance Policy**:\n\n✅ **Haan, EventPulse par sabhi approved events me OD attendance milti hai!**\n\n1. **Live QR Verification**: Event venue par entry desk par organizer aapka QR pass scan karega.\n2. **Verified Timestamp**: System me student ki attendance **PRESENT** record ho jati hai.\n3. **HOD Approval**: Department HODs ke dashboard par verified attendance audit log jata hai, jisse lecture attendance credit instantly grant ho jata hai!`,
      actions: [
        { label: '🎫 Check My QR Passes', route: 'my-passes' },
        { label: '🎉 Discover Events', route: 'events' }
      ]
    };
  }

  // -------------------------------------------------------------
  // 6. CAMPUS LEADERSHIP (HOD, DEAN, VC)
  // -------------------------------------------------------------
  if (has('hod', 'dean', 'vc', 'vice chancellor', 'anwar', 'kulkarni', 'neha sharma', 'raman', 'principal', 'head of department')) {
    return {
      text: `🏛️ **Official University Leadership & Academic Clearance Authority**:\n\n• 👨‍🏫 **Head of Department (HOD - Computer Engineering)**: **Prof. Anwar Sheikh** (Level 1 Event & OD Clearance)\n• 👩‍🏫 **Dean (School of Engineering & Technology)**: **Dr. Neha Sharma** (Level 2 Inter-Departmental Clearance)\n• 👑 **Vice Chancellor (Apex Executive Authority)**: **Prof. K. V. Raman** (Level 3 Apex Clearance & Merit Citations)\n\n*EventPulse in sabhi administrative portals ke sath live integrated hai!*`,
      actions: [
        { label: '🎉 View Approved Events', route: 'events' }
      ]
    };
  }

  // -------------------------------------------------------------
  // 7. GRIEVANCE, COMPLAINTS & INCIDENT REPORTING
  // -------------------------------------------------------------
  if (has('complain', 'complaint', 'grievance', 'issue', 'problem', 'ragging', 'cheat', 'unfair', 'report')) {
    let complaintStatus = '';
    if (complaints && complaints.length > 0) {
      complaintStatus = `\n\n📌 **Your Active Grievances (${complaints.length})**:\n` + complaints.slice(0, 2).map(c => `• Ticket #${c.ticketId || c.id}: Status = ${c.status || 'open'}`).join('\n');
    }

    return {
      text: `🚨 **Confidential Grievance & Redressal Desk**:\n\nAgar aapko kisi event me unfair judging, pass issue, cheating, ya security concern feel hui ho, to aap **100% confidential report** darj kar sakte hain.${complaintStatus}\n\nYeh report seedha **HOD aur Dean** ke executive dashboard me audit hoti hai.`,
      actions: [
        { label: '🚨 File New Grievance', route: 'complaint_modal' },
        { label: '🎫 View My Reports', route: 'my-passes' }
      ]
    };
  }

  // -------------------------------------------------------------
  // 8. SQUADS, TEAMMATES & HACKATHON PARTNERS
  // -------------------------------------------------------------
  if (has('team', 'squad', 'teammate', 'partner', 'hackathon team', 'dost', 'group', 'member')) {
    return {
      text: `🤝 **EventPulse Squad & Teammate Hub**:\n\nHackathons aur project competitions ke liye akele participate karne ki zaroorat nahi hai!\n\n• **Create a Squad**: Apna team name aur required skills (Frontend, AI/ML, UI/UX) post karein.\n• **Join Open Squads**: Dusre students ki teams me 1-click connect karein.\n• **Direct Contact**: WhatsApp aur email se seedha coordinate karein!`,
      actions: [
        { label: '🤝 Open Squad Finder', route: 'teams_modal' },
        { label: '🏆 View Hackathons', route: 'events' }
      ]
    };
  }

  // -------------------------------------------------------------
  // 9. CERTIFICATES & CREDENTIALS
  // -------------------------------------------------------------
  if (has('certificate', 'cert', 'degree', 'download certificate', 'verify', 'proof')) {
    return {
      text: `📜 **Digital Certificates & Instant Verification**:\n\n• Har event jisme aapki attendance QR se verify hoti hai, uska **Official Cryptographic PDF Certificate** aapke wallet me automatically generate ho jata hai.\n• Har certificate me ek unique verification QR code aur ID hota hai jise koi bhi recruiter ya company \`/verify/:id\` par verify kar sakti hai!`,
      actions: [
        { label: '📜 View My Certificates', route: 'my-passes' },
        { label: '🎉 Join Events to Earn Certs', route: 'events' }
      ]
    };
  }

  // -------------------------------------------------------------
  // 10. SMART DYNAMIC FALLBACK (ALWAYS RELEVANT)
  // -------------------------------------------------------------
  const liveCount = events.length;
  return {
    text: `⚡ **Aapka swagat hai! Main NEX AI Campus Copilot hoon.** 🤖\n\nAapka sawal tha: *"${rawQuery}"*\n\n📊 **Quick Campus Snapshot Right Now:**\n• 🌟 **${liveCount} Events** abhi live scheduled hain.\n• 🎫 **Instant Pass & Auto-OD** attendance system operational hai.\n\n**Aap mujhse ye specific cheezein pooch sakte hain:**\n• 🚀 *"Upcoming hackathons & events dikhao"*\n• 🎫 *"Mera QR pass dikhao"*\n• 🤝 *"Hackathon ke liye teammates chahiye"*\n• 📋 *"College attendance (OD) policy kya hai?"*\n• 🚨 *"Event me grievance ya complaint kaise karein?"*\n\nNeeche diye options me se choose karein:`,
    actions: [
      { label: '🎉 Browse Events', route: 'events' },
      { label: '🎫 My Passes', route: 'my-passes' },
      { label: '🤝 Teammate Finder', route: 'teams_modal' },
      { label: '💡 Campus Wishlist', route: 'ideas' }
    ]
  };
}

/**
 * AI Event Description Generator for Organizers (Dual-Engine)
 */
export async function generateEventDescriptionAI(title, category, department) {
  const catName = (category || 'Technical').toUpperCase();
  const deptName = department || 'Computer Engineering';
  const cleanTitle = title || 'Campus Flagship Challenge';

  const geminiKey = getGeminiApiKey();
  if (geminiKey) {
    const prompt = `Write a high-energy, professional, and well-structured event description and participation agenda for a university event.
Event Title: "${cleanTitle}"
Category: ${catName}
Department: ${deptName}, Sanjivani University.

Include:
- High-level Event Overview
- Key Highlights & Problem Tracks
- Eligibility & Team Size
- Rewards, Cash Prizes & Official Certificates
- Rules & QR Attendance Check-in Guidelines.
Format neatly with markdown headers and bullet points. Keep it engaging.`;

    try {
      const generated = await callGeminiAPI(prompt, 'You are an expert university event curator and technical writer.', geminiKey);
      if (generated && generated.trim().length > 50) {
        return generated.trim();
      }
    } catch (e) {
      console.warn('Gemini description generation fallback:', e);
    }
  }

  // High-Quality Dynamic Template Fallback
  return `### 🌟 Event Overview
Join us for **${cleanTitle}**, an official **${catName}** competition hosted by the Department of **${deptName}** at Sanjivani University!

### 🎯 Key Highlights & Structure
- **Format**: Competitive team & individual tracks evaluated by industry experts and faculty jury.
- **Hands-on Experience**: Practical problem statements tailored to cutting-edge real-world challenges.
- **Prizes & Recognition**: Official university certificates, trophies, and exciting cash prizes for top performers!

### 📋 Participation Guidelines
1. All participants must present their **EventPulse Digital QR Pass** at the registration desk for check-in.
2. Verified attendance directly syncs with departmental records for official **Academic On-Duty (OD)** credit.
3. Bring your student ID card and laptops/gear as required for your track.`;
}

/**
 * AI Squad Pitch Generator for Students (Dual-Engine)
 */
export async function generateSquadPitchAI(teamName, idea, roles) {
  const cleanTeam = teamName || 'Innovators';
  const cleanIdea = idea || 'an innovative campus solution';
  const rolesList = roles || 'Frontend Developer, Backend Engineer, UI/UX Designer';

  const geminiKey = getGeminiApiKey();
  if (geminiKey) {
    const prompt = `Write a punchy, exciting 2-sentence hackathon squad recruitment pitch for students.
Team Name: ${cleanTeam}
Idea / Project: ${cleanIdea}
Roles needed: ${rolesList}`;

    try {
      const pitch = await callGeminiAPI(prompt, 'You are an enthusiastic hackathon mentor.', geminiKey);
      if (pitch && pitch.trim()) return pitch.trim();
    } catch (e) {}
  }

  return `🚀 Team **${cleanTeam}** is gearing up for the upcoming hackathon! We're building "${cleanIdea}" and actively looking for motivated teammates specializing in **${rolesList}**. Connect with us on WhatsApp or Email to team up!`;
}
