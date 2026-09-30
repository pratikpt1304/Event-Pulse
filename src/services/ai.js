import { getCachedEventsSync } from './events';
import { getCachedRegistrationsSync } from './registrations';
import { getCachedCertificatesSync } from './certificates';
import { getCachedTeamsSync } from './teams';
import { getCachedVolunteersSync } from './volunteers';

/**
 * Normalizes input text and catches typos / spelling variations
 */
function normalizeQuery(text) {
  let q = (text || '').toLowerCase().trim();
  // Common typo fixes
  q = q.replace(/hackathone/g, 'hackathon')
       .replace(/hackthone/g, 'hackathon')
       .replace(/hackthon/g, 'hackathon')
       .replace(/certeficate/g, 'certificate')
       .replace(/certficate/g, 'certificate')
       .replace(/volunter/g, 'volunteer')
       .replace(/voluntering/g, 'volunteering')
       .replace(/teammats/g, 'teammates')
       .replace(/regester/g, 'register')
       .replace(/regestration/g, 'registration')
       .replace(/wishlist/g, 'wishlist')
       .replace(/reveiw/g, 'review')
       .replace(/reivew/g, 'review')
       .replace(/complant/g, 'complaint')
       .replace(/complain/g, 'complaint');
  return q;
}

/**
 * NEX — Next-Generation Grounded Campus Intelligence Engine
 */
export async function askPulseAI(rawQuery, user) {
  const q = normalizeQuery(rawQuery);
  const events = getCachedEventsSync() || [];
  const registrations = user ? (getCachedRegistrationsSync(user.uid) || []) : [];
  const certificates = user ? (getCachedCertificatesSync(user.uid) || []) : [];
  const teams = getCachedTeamsSync() || [];
  const volunteers = user ? (getCachedVolunteersSync(user.uid) || []) : [];

  // =========================================================================
  // 0. STUDENT WELLNESS, MOOD, FEELING LOW & STRESS RELIEF
  // =========================================================================
  if (
    q.includes('feeling low') ||
    q.includes('feel low') ||
    q.includes('feeling sad') ||
    q.includes('sad') ||
    q.includes('depress') ||
    q.includes('stressed') ||
    q.includes('stress') ||
    q.includes('bored') ||
    q.includes('boring') ||
    q.includes('tired') ||
    q.includes('exhausted') ||
    q.includes('mood off') ||
    q.includes('not feeling good') ||
    q.includes('kuch accha nahi') ||
    q.includes('kya karu') ||
    q.includes('demotivated') ||
    q.includes('lonely') ||
    q.includes('break chahiye') ||
    q.includes('relax') ||
    q.includes('chill') ||
    q.includes('fun karna hai') ||
    q.includes('need a break') ||
    (q.includes('what should i do') && !q.includes('register') && !q.includes('volunteer'))
  ) {
    const culturalOrFunEvents = events.filter(e => {
      const cat = (e.category || '').toLowerCase();
      return cat.includes('cultural') || cat.includes('sports') || cat.includes('music') || cat.includes('gaming');
    });

    let eventSuggestions = '';
    if (culturalOrFunEvents.length > 0) {
      const top3 = culturalOrFunEvents.slice(0, 3).map(e => `• **${e.title}** (${e.category} • 📅 ${e.date})`).join('\n');
      eventSuggestions = `\n\n🎉 **Upcoming Fun & Relaxing Events on Campus:**\n${top3}`;
    }

    return {
      text: `💙 **Hey, take a deep breath!** It's completely okay to feel low or overwhelmed sometimes. College life, assignments, and exams can get hectic.\n\nHere are a few quick ways to reset your mood right now:\n\n1. ☕ **Take a Break**: Step outside, grab a chai/coffee with friends, or take a short walk near the **Campus Amphitheater & Garden Lawn**.\n2. 🎵 **Listen to Music or Open Mics**: Check out upcoming music gigs, standup comedy, or cultural events on campus.${eventSuggestions}\n3. 🎮 **Play Games or Team Up**: Find buddies for casual BGMI/Valorant or hackathons in the **🤝 Teammate Finder**.\n4. 💡 **Wish for Something Fun**: Want a DJ night, gaming tournament, or movie screening on campus? Suggest it on the **💡 Campus Wishlist** and get students to vote!\n5. 🎧 **Need Support?**: Talk to a trusted friend, professor, or visit the campus helpdesk (Classroom 707 / Lab 506).\n\n*You're doing better than you think! What would you like to explore?*`,
      actions: [
        { label: '🎉 Explore Fun Campus Events', route: 'events' },
        { label: '💡 Suggest a Fun Event Wish', route: 'ideas' },
        { label: '🤝 Connect on Squad Finder', route: 'teams_modal' }
      ]
    };
  }

  // =========================================================================
  // 0b. FRIENDLY GREETINGS
  // =========================================================================
  if (
    q === 'hi' || q === 'hello' || q === 'hey' || q === 'hey nex' ||
    q === 'hii' || q === 'hiii' || q === 'hola' || q === 'wassup' ||
    q === "what's up" || q === 'good morning' || q === 'good afternoon' ||
    q === 'good evening' || q === 'kaise ho' || q === 'kya hal hai'
  ) {
    const name = user ? user.name.split(' ')[0] : 'friend';
    const eventsCount = events.length;
    const eventsStatus = eventsCount > 0
      ? `🎉 **${eventsCount} events** abhi live hain — check them out!`
      : `📌 Abhi koi live event nahi hai, lekin **upcoming events** ke liye stay tuned!`;
    return {
      text: `👋 **Hey ${name}! Welcome to NEX AI.** ⚡\n\nMain tumhara **24/7 intelligent campus copilot** hoon — EventPulse ka smart assistant!\n\n${eventsStatus}\n\n**Main kya kar sakta hoon:**\n• 🔍 Upcoming hackathons, sports & cultural events dhundna\n• 💡 Wishlist par naya event suggest karna\n• 🤝 Hackathon ke liye teammates dhundhna\n• 📜 Certificates & QR Passes check karna\n• 🚨 Grievance ya complaint file karna\n• 🎧 Campus helpdesk & support\n\nKya poochna hai? 🚀`,
      actions: [
        { label: '🎉 Browse Events', route: 'events' },
        { label: '💡 Campus Wishlist', route: 'ideas' },
        { label: '🎫 My Passes', route: 'my-passes' }
      ]
    };
  }

  // =========================================================================
  // 0c. IDENTITY & WHO MADE NEX AI
  // =========================================================================
  if (
    q.includes('who are you') ||
    q.includes('who made you') ||
    q.includes('kisne banaya') ||
    q.includes('creator') ||
    q.includes('developer') ||
    q.includes('kya ho tum') ||
    q.includes('your name') ||
    q.includes('pratik') ||
    q === 'nex'
  ) {
    return {
      text: `⚡ **I was built and designed by Pratik Thorat!** 🚀👨‍💻\n\n**Pratik Thorat** created and architected the **EventPulse** platform along with **NEX (Next-Generation Campus AI)** for **Sanjivani University** to make campus events, hackathons, squad finding, and pass management super seamless and modern!\n\n**What Pratik built in this platform:**\n• 🎫 **Cryptographic QR Passes & Certificates**\n• 🤖 **NEX AI — 24/7 Intelligent Campus Copilot**\n• 🤝 **Teammate & Squad Hub for Hackathons**\n• 💡 **Student Democracy Wishlist & Upvoting**\n• 🙋 **Volunteer Crew Management Portal**\n• 🚨 **Confidential Grievance & Incident Redressal**\n\nGot any questions about the platform or events? Feel free to ask! 🔥`,
      actions: [
        { label: '🎉 Explore Campus Events', route: 'events' },
        { label: '💡 Campus Wishlist', route: 'ideas' },
        { label: '🎫 My Passes', route: 'my-passes' }
      ]
    };
  }

  // =========================================================================
  // 0d. ATTENDANCE, OD (OFFICIAL DUTY) & LECTURE CONCESSION
  // =========================================================================
  if (
    q.includes('attendance') ||
    q.includes('od') ||
    q.includes('duty leave') ||
    q.includes('lecture miss') ||
    q.includes('concession') ||
    q.includes('absent') ||
    q.includes('attendance milegi') ||
    q.includes('attendance milega')
  ) {
    return {
      text: `📋 **Official Attendance & OD (Duty Leave) Policy**:\n\n✅ **Yes! Official approved events on EventPulse provide verified attendance / OD:**\n\n1. **Digital QR Check-in**: When you reach the venue, the organizer will scan your **Cryptographically Signed QR Pass** at the entry desk.\n2. **Automatic Attendance Log**: Your attendance is recorded in the university database with exact scan timestamp.\n3. **OD Submission**: Department coordinators and faculty can verify your verified attendance record directly from the EventPulse system for OD credit!`,
      actions: [
        { label: '🎫 Check My QR Passes', route: 'my-passes' },
        { label: '🎉 Explore Events', route: 'events' }
      ]
    };
  }

  // =========================================================================
  // 0e. REGISTRATION FEES / FREE VS PAID
  // =========================================================================
  if (
    q.includes('fee') ||
    q.includes('fees') ||
    q.includes('free') ||
    q.includes('paid') ||
    q.includes('paisa') ||
    q.includes('cost') ||
    q.includes('entry fee') ||
    q.includes('charge') ||
    q.includes('ticket price') ||
    q.includes('free hai')
  ) {
    return {
      text: `💰 **Event Registration Fees & Cost**:\n\n✨ **Most campus events on EventPulse are 100% FREE for Sanjivani University students!**\n\n• **Free Events**: Technical seminars, branch hackathons, cultural open mics, and intra-college sports typically have **₹0 registration fee**.\n• **Flagship / External Fests**: If an event requires a pass or kit fee, it is explicitly shown on the event details card before you confirm registration.\n\n*No hidden charges — simply tap Register Now on any event to claim your pass!*`,
      actions: [
        { label: '🎉 Browse Free Events', route: 'events' },
        { label: '🎫 View My Passes', route: 'my-passes' }
      ]
    };
  }

  // =========================================================================
  // 0f. FOOD, REFRESHMENTS, SNACKS & SWAG KITS
  // =========================================================================
  if (
    q.includes('food') ||
    q.includes('refreshment') ||
    q.includes('lunch') ||
    q.includes('snack') ||
    q.includes('breakfast') ||
    q.includes('khana') ||
    q.includes('swag') ||
    q.includes('t-shirt') ||
    q.includes('tshirt') ||
    q.includes('goodies') ||
    q.includes('canteen')
  ) {
    return {
      text: `🍕 **Food, Refreshments & Swags**:\n\n• **Hackathons & Full-Day Events**: Usually provide complimentary lunch, high-tea refreshments, and energy drinks for all registered participants!\n• **Official Swag Kits**: Flagship competitions often give official event T-shirts, stickers, notebooks, and badges.\n• **Campus Canteen**: The main food court and cafeteria near the Main Building are open throughout event days.\n\n*Check the specific Event Description card for exact refreshment details!*`,
      actions: [
        { label: '🎉 Check Event Details', route: 'events' },
        { label: '💡 Wish for a Food/Fest Event', route: 'ideas' }
      ]
    };
  }

  // =========================================================================
  // 0g. PRIZES, CASH AWARDS, TROPHIES & REWARDS
  // =========================================================================
  if (
    q.includes('prize') ||
    q.includes('cash prize') ||
    q.includes('prize pool') ||
    q.includes('reward') ||
    q.includes('trophy') ||
    q.includes('winner') ||
    q.includes('winning') ||
    q.includes('kitna prize')
  ) {
    return {
      text: `🏆 **Prizes, Cash Rewards & Recognition**:\n\nCampus competitions offer exciting rewards:\n\n• 🥇 **Winner Cash Prizes**: Top hackathons and esport fests feature dedicated cash pools (e.g. ₹10,000 to ₹50,000+).\n• 🎖️ **Trophies & Medals**: Official university podium trophies.\n• 📜 **Merit Certificates**: Officially signed rank & distinction certificates.\n• ⭐ **Participation Certificate**: Every student who checks in gets a tamper-proof digital certificate for their resume!\n\n*View each event card to see its specific prize breakdown!*`,
      actions: [
        { label: '🏆 Discover Competitions', route: 'events' },
        { label: '📜 My Certificates', route: 'my-passes' }
      ]
    };
  }

  // =========================================================================
  // 0h. FIRST YEAR & FRESHER GUIDANCE
  // =========================================================================
  if (
    q.includes('1st year') ||
    q.includes('first year') ||
    q.includes('fresher') ||
    q.includes('freshers') ||
    q.includes('new student') ||
    q.includes('nayi hu') ||
    q.includes('naya hu') ||
    q.includes('start kaise') ||
    q.includes('beginner')
  ) {
    return {
      text: `🎓 **Welcome Freshers & 1st Year Students!** 🌟\n\nEventPulse is your gateway to explore college beyond the classroom:\n\n1. **Open to All**: Most beginner coding workshops, open mics, esports, and cultural nights welcome 1st-year students with open arms.\n2. **Volunteer & Network**: Tap **🙋 Volunteer** on event cards — it's the fastest way to connect with seniors and build leadership experience!\n3. **Find Squads**: Join the **🤝 Teammate Finder** to partner up with seniors or batchmates for hackathons.\n4. **Build Your Resume**: Collect digital certificates directly in your EventPulse wallet from Year 1!`,
      actions: [
        { label: '🎉 Explore Events for 1st Years', route: 'events' },
        { label: '🤝 Teammate & Squad Hub', route: 'teams_modal' },
        { label: '💡 Post a Fresher Idea', route: 'ideas' }
      ]
    };
  }

  // =========================================================================
  // 0i. SOLO VS TEAM PARTICIPATION
  // =========================================================================
  if (
    q.includes('solo') ||
    q.includes('alone') ||
    q.includes('single') ||
    q.includes('akela') ||
    q.includes('akeli') ||
    q.includes('bina team') ||
    q.includes('individual') ||
    q.includes('can i join alone')
  ) {
    return {
      text: `🙋 **Can I participate Solo / Alone?**\n\n• **Solo Events**: Coding contests, quizzes, gaming 1v1, open mics, and art competitions allow direct individual registration!\n• **Team Hackathons**: If an event requires a team (2–4 members) and you don't have one yet, don't worry! Use our **🤝 Teammate Finder** to discover open squads or post your skill set in 30 seconds!`,
      actions: [
        { label: '🤝 Open Teammate Finder', route: 'teams_modal' },
        { label: '🎉 Browse Events', route: 'events' }
      ]
    };
  }

  // =========================================================================
  // 0j. LAPTOP, WI-FI, HARDWARE & SOFTWARE REQUIREMENTS
  // =========================================================================
  if (
    q.includes('laptop') ||
    q.includes('wifi') ||
    q.includes('hardware') ||
    q.includes('charger') ||
    q.includes('pc') ||
    q.includes('system') ||
    q.includes('bring laptop')
  ) {
    return {
      text: `💻 **Hardware & Wi-Fi Requirements**:\n\n• **Technical Workshops & Hackathons**: Bringing your own laptop with charger is recommended so you have your preferred IDE and environment.\n• **Campus Wi-Fi**: High-speed student Wi-Fi is available across all labs and the auditorium.\n• **Lab Workstations**: Computer Labs (Lab 506 & 707) are equipped with workstations with pre-installed developer tools for students who need them.`,
      actions: [
        { label: '🚀 Explore Hackathons', route: 'events' },
        { label: '🎧 Helpdesk (Lab 506)', route: 'help' }
      ]
    };
  }

  // =========================================================================
  // 0k. LOST & FOUND ON CAMPUS
  // =========================================================================
  if (
    q.includes('lost') ||
    q.includes('found') ||
    q.includes('kho gaya') ||
    q.includes('ghoom gaya') ||
    q.includes('lost id') ||
    q.includes('lost card') ||
    q.includes('lost bag')
  ) {
    return {
      text: `🔍 **Campus Lost & Found Assistance**:\n\nIf you lost your ID card, bag, bottle, or valuables during an event:\n\n1. **Immediate Desk**: Check with the Event Registration / Volunteer desk at the venue.\n2. **Central Helpdesk**: Visit **Classroom No. 707 or Lab No. 506** in the Main Building.\n3. **Campus Security**: Check the Main Gate Security office where found items are deposited.\n4. **Report to Support**: You can also email \`eventpulsesupport@gmail.com\` with the item description.`,
      actions: [{ label: '🎧 Contact Helpdesk', route: 'help' }]
    };
  }

  // =========================================================================
  // 0l. JOKES, FUN & CAMPUS TRIVIA
  // =========================================================================
  if (
    q.includes('joke') ||
    q.includes('chutkula') ||
    q.includes('make me laugh') ||
    q.includes('funny') ||
    q.includes('koi joke')
  ) {
    const jokes = [
      `😂 **Engineering Fact**:\nWhy do programmers prefer dark mode?\n*Because light attracts bugs!* 🐛💻\n\nTake a break from debugging and check out what's happening on campus today!`,
      `😂 **College Life**:\n*Student*: "Sir, will this code run in production?"\n*Professor*: "It works on my machine!" 🚀\n\nGo register for a hackathon and prove your code works everywhere!`,
      `😂 **Coffee vs Code**:\nA programmer had a problem. He decided to use threads. Now problems have two he.`
    ];
    const pickedJoke = jokes[Math.floor(Math.random() * jokes.length)];
    return {
      text: `${pickedJoke}\n\nFeeling better? Ready to explore some fun campus activities?`,
      actions: [
        { label: '🎉 Explore Events', route: 'events' },
        { label: '💡 Campus Wishlist', route: 'ideas' }
      ]
    };
  }

  // =========================================================================
  // 1. PARTICIPATION / HACKATHON / EVENT DISCOVERY
  // =========================================================================
  if (
    q.includes('hackathon') ||
    q.includes('take part') ||
    q.includes('participate') ||
    q.includes('join event') ||
    q.includes('how to register') ||
    q.includes('where can i find') ||
    q.includes('find event') ||
    q.includes('upcoming event') ||
    q.includes('kaise participate') ||
    q.includes('kahan milega') ||
    q.includes('events list') ||
    // "check event" / "want to check" / "want to see"
    q.includes('check event') ||
    q.includes('see event') ||
    q.includes('view event') ||
    q.includes('show event') ||
    q.includes('browse event') ||
    q.includes('open event') ||
    q.includes('want to check') ||
    q.includes('want to see') ||
    q.includes('want to join') ||
    q.includes('want to go') ||
    q.includes('want event') ||
    q.includes('i want event') ||
    q.includes('events dekhna') ||
    q.includes('event dekhna') ||
    q.includes('event dikhao') ||
    q.includes('kya events') ||
    q.includes('kon se event') ||
    q.includes('kaun se event') ||
    q.includes('events hai') ||
    q.includes('event hai') ||
    q.includes('list of event') ||
    q.includes('all event') ||
    q.includes('available event') ||
    q.includes('current event') ||
    q.includes('today event') ||
    q.includes('aaj event') ||
    q.includes('register') ||
    q.includes('sport') ||
    q.includes('cultural') ||
    q.includes('competition') ||
    q.includes('symposium') ||
    q.includes('workshop') ||
    q.includes('seminar') ||
    q.includes('fest') ||
    q.includes('concert') ||
    q.includes('coding')
  ) {
    const techEvents = events.filter(e => (e.category || '').toLowerCase() === 'technical');
    const availableEvents = events.length > 0 ? events : [];

    if (q.includes('hackathon') || q.includes('coding') || q.includes('tech')) {
      if (techEvents.length > 0) {
        const list = techEvents.map(e => `• **${e.title}**\n  📍 ${e.venue} | 📅 ${e.date} (${e.time})\n  🎓 Eligible: ${(e.eligibleYears || []).join(', ')}`).join('\n\n');
        return {
          text: `🚀 **Campus Hackathons & Technical Competitions**:\n\n${list}\n\n👉 **How to participate:**\n1. Tap the **Browse Events** button below.\n2. Filter by **💻 Technical** category tab.\n3. Click **Register Now** on your chosen event to claim your digital pass!`,
          actions: [
            { label: '🚀 Explore Hackathons & Events', route: 'events' },
            { label: '🤝 Find a Hackathon Squad', route: 'teams_modal' }
          ]
        };
      } else {
        return {
          text: `🚀 **How to Participate in Campus Hackathons & Competitions**:\n\n1. Head over to the **Campus Events Portal**.\n2. Browse under the **💻 Technical** filter tab for active hackathons & symposiums.\n3. Click **Register Now** — your digital pass will be instantly generated in your **Wallet**!\n4. If you need teammates, you can also join or create a team in the **🤝 Teammate Finder**!`,
          actions: [
            { label: '🎉 Browse Events Portal', route: 'events' },
            { label: '🤝 Teammate & Squad Hub', route: 'teams_modal' }
          ]
        };
      }
    }

    // General participation
    if (availableEvents.length === 0) {
      return {
        text: `🔍 **Abhi koi active events nahi hain!**\n\nCurrently EventPulse par koi live event registered nahi hai. Lekin ye change ho sakta hai anytime soon! 🚀\n\n**Kya karo tab tak:**\n• 💡 **Wishlist par suggest karo** — Kaunsa event chahiye? Hackathon? Sports? Concert? Suggest karo aur votes lao!\n• 🤝 **Teammates find karo** — Future hackathons ke liye abhi se apna squad ready karo!\n• 🙋 **Volunteer ke liye ready raho** — Jab event aaye toh pehle aap organizer crew mein ho!\n• 🔔 **Stay tuned** — Notifications enable karo (Profile > Settings) taaki naya event aate hi alert mile!\n\n*Koi naya event ata hai toh main turant tumhe bata dunga! 🔥*`,
        actions: [
          { label: '💡 Suggest an Event on Wishlist', route: 'ideas' },
          { label: '🤝 Squad & Teammate Finder', route: 'teams_modal' },
          { label: '🎫 My Profile & Passes', route: 'my-passes' }
        ]
      };
    }

    return {
      text: `🎉 **How to Participate in Campus Events on EventPulse**:\n\n1. **Browse Approved Events**: Go to the **Campus Events** tab to view Technical, Sports, and Cultural events.\n2. **1-Click Registration**: Click **Register Now** on any eligible event.\n3. **Access Your Digital QR Pass**: Once approved, your QR pass is always available in **🎫 My Passes** for venue check-in!`,
      actions: [
        { label: '🎉 Open Events Portal', route: 'events' },
        { label: '🎫 My Wallet & Passes', route: 'my-passes' }
      ]
    };
  }

  // =========================================================================
  // 1b. CAMPUS NOTICES & ANNOUNCEMENTS
  // =========================================================================
  if (
    q.includes('notice') ||
    q.includes('announcement') ||
    q.includes('notice board') ||
    q.includes('noticeboard') ||
    q.includes('koi notice') ||
    q.includes('koi announcement') ||
    q.includes('campus notice') ||
    q.includes('circullar') ||
    q.includes('circular') ||
    q.includes('what is new') ||
    q.includes('kya naya hai') ||
    q.includes('latest news') ||
    q.includes('khabar')
  ) {
    return {
      text: `📢 **Campus Notices & Announcements**:\n\nCurrently EventPulse par **koi active campus notice published nahi hai**. 🔕\n\n*Jab Admin koi official notice, sports event announcement, ya campus circular post karega — woh yahan aur Events tab ke "📢 Campus Notices" section mein turant dikhega!*\n\n**Stay connected:**\n• 🔔 **Push Notifications** enable karo (Profile > Settings) — nayi notice aate hi alert milega!\n• 💡 **Wishlist** par apni events & activity ideas suggest karo!\n• 🎧 **Support**: eventpulsesupport@gmail.com`,
      actions: [
        { label: '📢 Browse Campus Notices', route: 'events' },
        { label: '💡 Suggest an Event', route: 'ideas' },
        { label: '🔔 Enable Notifications', route: 'my-passes' }
      ]
    };
  }

  // =========================================================================
  // 2. VOLUNTEERING / DUTY INQUIRIES
  // =========================================================================
  if (q.includes('volunteer') || q.includes('volunteering') || q.includes('help organize') || q.includes('crew') || q.includes('duty')) {
    return {
      text: `🙋 **Event Volunteering on EventPulse**:\n\nStudents can apply as official volunteers for campus events and earn verified **Leadership Certificates** & VIP access!\n\n**Available Roles:**\n• 📋 Registration Desk & QR Check-in\n• 🎙️ Stage, AV & Anchor Support\n• 👥 Crowd Management & Hospitality\n• 📸 Photography & Social Media\n\n**How to apply:** Tap **🙋 Volunteer** directly on any event card!`,
      actions: [
        { label: '🎉 Find Events to Volunteer', route: 'events' },
        { label: '🎫 My Volunteering Status', route: 'my-passes' }
      ]
    };
  }

  // =========================================================================
  // 3. TEAMMATE / SQUAD FINDER INTENT
  // =========================================================================
  if (q.includes('team') || q.includes('teammate') || q.includes('squad') || q.includes('partner') || q.includes('group') || q.includes('member')) {
    const totalTeams = teams.length;
    return {
      text: `🤝 **Campus Squad & Teammate Finder**:\n\nThere are currently **${totalTeams} open team post(s)** looking for teammates across: Frontend, Backend, UI/UX, AI/ML, and Mobile Dev.\n\n**What you can do:**\n• Browse open teams for hackathons.\n• Connect directly with team leaders via **WhatsApp** or **Email**.\n• Post your own squad requirement in 30 seconds!`,
      actions: [
        { label: '🤝 Open Teammate Hub', route: 'teams_modal' },
        { label: '🎉 Browse Events', route: 'events' }
      ]
    };
  }

  // =========================================================================
  // 4. PASSES, QR CODES & REGISTRATION STATUS
  // =========================================================================
  if (q.includes('pass') || q.includes('ticket') || q.includes('qr') || q.includes('status') || q.includes('wallet') || q.includes('checkin') || q.includes('entry')) {
    if (!user) {
      return {
        text: `🎫 **Digital QR Passes**:\n\nPlease **Sign In** to view your active event passes and check your registration status.`,
        actions: [{ label: '🔑 Sign In Now', route: 'login' }]
      };
    }

    if (registrations.length === 0) {
      return {
        text: `Hi ${user.name}! You haven't registered for any events yet. Once you register for an event, your **Cryptographically Signed QR Pass** will appear in your wallet!`,
        actions: [{ label: '🎉 Discover Events', route: 'events' }]
      };
    }

    const approvedCount = registrations.filter(r => r.status === 'approved' || r.status === 'attended').length;
    const pendingCount = registrations.filter(r => r.status === 'pending').length;

    return {
      text: `🎫 **Your Passes & Wallet Overview**:\n\n• **${user.name}** (PRN: \`${user.prn || 'N/A'}\`)\n• Active Registrations: **${registrations.length}**\n• Approved Passes: **${approvedCount}**\n• Pending Approval: **${pendingCount}**\n\nShow your digital QR code at the event entrance for seamless check-in!`,
      actions: [
        { label: '🎫 Open My QR Wallet', route: 'my-passes' },
        { label: '🎉 Browse More Events', route: 'events' }
      ]
    };
  }

  // =========================================================================
  // 5. CERTIFICATES & VERIFICATION
  // =========================================================================
  if (q.includes('certificate') || q.includes('cert') || q.includes('download') || q.includes('verify') || q.includes('proof')) {
    if (!user) {
      return {
        text: `📜 **Official University Certificates**:\n\nCertificates are generated digitally after your attendance is scanned at an event. Please sign in to view your certificate wallet.`,
        actions: [{ label: '🔑 Sign In', route: 'login' }]
      };
    }

    if (certificates.length === 0) {
      return {
        text: `📜 **Certificate Hub**:\n\nYou don't have any certificates yet, ${user.name}. Attend your registered events to have the organizer scan your QR pass — your tamper-proof PDF certificate with unique ID will be instantly downloadable!`,
        actions: [{ label: '🎫 Check Passes', route: 'my-passes' }]
      };
    }

    return {
      text: `🏆 **You have ${certificates.length} verified certificate(s) available!**\n\nAll certificates are officially signed and include unique verification links for your resume and LinkedIn.`,
      actions: [{ label: '📜 Download Certificates', route: 'my-passes' }]
    };
  }

  // =========================================================================
  // 6. EVENT REVIEWS & STAR RATINGS
  // =========================================================================
  if (q.includes('review') || q.includes('rating') || q.includes('rate') || q.includes('feedback') || q.includes('star') || q.includes('opinion') || q.includes('kaisa tha')) {
    return {
      text: `⭐ **Event Reviews & Ratings on EventPulse**:\n\nAttended an event? Share your experience and help improve future ones!\n\n**How to leave a review:**\n1. Go to **🎉 Campus Events** tab.\n2. Find the event you attended.\n3. Click the **⭐ Reviews** button on the event card.\n4. Give a star rating (1–5 ⭐) and write your feedback.\n\n**What others say:**\n• Ratings are visible to all students so they can decide which events to join.\n• Your review helps organizers improve the next edition!`,
      actions: [
        { label: '⭐ Go to Events & Review', route: 'events' },
        { label: '🎫 My Attended Events', route: 'my-passes' }
      ]
    };
  }

  // =========================================================================
  // 6b. CAMPUS WISHLIST & IDEA HUB
  // =========================================================================
  if (
    q.includes('idea') || q.includes('wishlist') || q.includes('wish') ||
    q.includes('suggest') || q.includes('suggestion') ||
    q.includes('new event') || q.includes('event chahiye') ||
    q.includes('improve') || q.includes('improvement') ||
    q.includes('upvote') || q.includes('vote') ||
    q.includes('kya event hona chahiye') || q.includes('campus wish')
  ) {
    return {
      text: `💡 **Campus Idea & Event Wishlist Hub**:\n\nYou can shape what happens on campus! Suggest events or improve existing ones — most-voted ideas get officially organized! 🔥\n\n**What you can do:**\n• 🎤 **Suggest New Events** — concerts, hackathons, gaming nights, open mics, sports days, etc.\n• ✨ **Improve Existing Events** — fix venue, timing, activities, prizes, food, or theme.\n• 🗳️ **Upvote Ideas** — vote for events you want. More votes = higher chance of it happening!\n• 💬 **Comment & Discuss** — add your specific suggestions on others' ideas.\n• 🔥 **Trending Ideas** — most-requested events are highlighted automatically.\n\n**Access:** Open the **💡 Campus Wishlist** from the profile menu (top-right dropdown)!`,
      actions: [
        { label: '💡 Open Campus Wishlist', route: 'ideas' },
        { label: '🎉 Browse Current Events', route: 'events' }
      ]
    };
  }

  // =========================================================================
  // 6c. COMPLAINTS, GRIEVANCES & MISCONDUCT
  // =========================================================================
  if (q.includes('complaint') || q.includes('grievance') || q.includes('misbehave') || q.includes('cheat') || q.includes('harass') || q.includes('report') || q.includes('fraud') || q.includes('kuch galat') || q.includes('incident') || q.includes('unfair') || q.includes('galat hua')) {
    return {
      text: `🚨 **Campus Grievance & Safety Redressal**:\n\nIf you experienced misconduct, unfair judging, harassment, pass issues, or event fraud — you can report it safely:\n\n• **🔒 100% Confidential**: Optional anonymous mode — your name & PRN stay hidden.\n• **Unique Ticket ID**: Instantly generated (e.g. GRV-XXXXXX) to track your complaint.\n• **Official Oversight**: Reviewed by University Disciplinary Committee + Event Organizers.\n• **Resolution Tracking**: Know when your report is under investigation or resolved.\n\n**How to report:**\nProfile menu (top-right) → 🚨 Report Grievance / Incident`,
      actions: [
        { label: '🚨 Report Grievance / Incident', route: 'complaint_modal' },
        { label: '🎧 Contact Helpdesk', route: 'help' }
      ]
    };
  }

  // =========================================================================
  // 7. HELPDESK, SUPPORT & CAMPUS LOCATION
  // =========================================================================
  if (q.includes('help') || q.includes('support') || q.includes('contact') || q.includes('office') || q.includes('email') || q.includes('lab 506') || q.includes('707') || q.includes('sanjivani') || q.includes('admin')) {
    return {
      text: `🎧 **EventPulse Campus Helpdesk & Support**:\n\n• **Email**: eventpulsesupport@gmail.com\n• **Office**: Main Building, Sanjivani University, Classroom No. 707 and Lab No. 506\n• **Hours**: Mon–Fri, 8:00 AM – 7:00 PM\n\nVisit Classroom 707 or Lab 506 for on-ground assistance with passes, PRN queries, or organizer permissions!`,
      actions: [{ label: '🎧 Open Helpdesk', route: 'help' }]
    };
  }

  // =========================================================================
  // 7. BRANCH & ELIGIBILITY QUERIES
  // =========================================================================
  if (q.includes('branch') || q.includes('department') || q.includes('eligible') || q.includes('imtech') || q.includes('cse') || q.includes('aiml') || q.includes('sports') || q.includes('for me')) {
    if (user) {
      const eligibleEvents = events.filter(e => {
        const deptOk = !e.eligibleDepartments || e.eligibleDepartments.length === 0 || e.eligibleDepartments.includes('All Departments') || e.eligibleDepartments.includes(user.department);
        const yearOk = !e.eligibleYears || e.eligibleYears.length === 0 || e.eligibleYears.includes(user.year);
        return deptOk && yearOk;
      });

      if (eligibleEvents.length > 0) {
        const titles = eligibleEvents.map(e => `• **${e.title}** (${e.category || 'tech'} • 📅 ${e.date})`).join('\n');
        return {
          text: `🎯 **Recommended Events for ${user.department} (${user.year})**:\n\n${titles}`,
          actions: [{ label: '🎉 Explore Events', route: 'events' }]
        };
      }
    }

    if (events.length > 0) {
      const titles = events.slice(0, 4).map(e => `• **${e.title}** (${e.department} • 📅 ${e.date})`).join('\n');
      return {
        text: `🌟 **Current Approved Campus Events**:\n\n${titles}`,
        actions: [{ label: '🎉 Open Events Portal', route: 'events' }]
      };
    }
  }

  // =========================================================================
  // 8. ORGANIZER / HOSTING AN EVENT
  // =========================================================================
  if (q.includes('organize') || q.includes('create event') || q.includes('host') || q.includes('organizer')) {
    return {
      text: `🎛️ **Hosting an Event on EventPulse**:\n\nFaculty and authorized student coordinators can host events:\n1. Open the **Organizer Hub**.\n2. Click **➕ Create Event** (use **⚡ Auto-Draft with NEX** to instantly generate complete rules & schedules!).\n3. Submit for admin verification. Once approved, tickets & volunteer slots go live across campus!`,
      actions: [
        { label: '🎛️ Organizer Hub', route: 'organizer' },
        { label: '🎉 Explore Events', route: 'events' }
      ]
    };
  }

  // =========================================================================
  // 8b. PLAY WITH ME, GAMES, TRIVIA & CASUAL BANTER
  // =========================================================================
  if (
    q.includes('play with me') ||
    q.includes('play a game') ||
    q.includes('play game') ||
    q.includes('game khelo') ||
    q.includes('khelte hai') ||
    q.includes('let us play') ||
    q.includes('lets play')
  ) {
    const riddles = [
      `🧠 **Riddle Time!**\n\n*I have branches, but no fruit, trunk or leaves. What am I?*\n\n*(Hint: Git developers and banks love it!)* 😄\n\nType your guess or explore gaming events on campus!`,
      `🧠 **Campus Riddle!**\n\n*I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?*\n\n*(Hint: Echo!)* 🗣️`,
      `🧠 **Coder Trivia!**\n\n*What is 0.1 + 0.2 in JavaScript?*\n*(A) 0.3*\n*(B) 0.30000000000000004*\n*(C) NaN*\n\nTake a guess! 😉`
    ];
    const pickedRiddle = riddles[Math.floor(Math.random() * riddles.length)];

    return {
      text: `🎮 **Haha, I'd love to!** 🚀\n\nWhile I can't jump into a live BGMI or Valorant match directly (I'm an AI living on the cloud ☁️), here's what we can do:\n\n${pickedRiddle}\n\n👉 Or if you want real gaming action, you can find gaming squads or browse esports tournaments below!`,
      actions: [
        { label: '🎮 Gaming & Esports Events', route: 'events' },
        { label: '🤝 Find Gaming Squad (BGMI/Valo)', route: 'teams_modal' },
        { label: '💡 Wish for a Gaming Tournament', route: 'ideas' }
      ]
    };
  }

  // =========================================================================
  // 8c. SINGING, DANCING, SHAYARI & ENTERTAINMENT
  // =========================================================================
  if (
    q.includes('sing') ||
    q.includes('dance') ||
    q.includes('shayari') ||
    q.includes('poem') ||
    q.includes('gaana') ||
    q.includes('song')
  ) {
    return {
      text: `🎙️ **Here's a campus shayari for you!** ✨\n\n*"Assignments ki raat lambi hoti hai,*\n*Coding ki errors kabhi khatam nahi hoti,*\n*Par jab event ka certificate milta hai,*\n*Toh saari mehnat safal lagti hai!"* 🎓💙\n\nIf you love singing, poetry, or standup, check out upcoming **Open Mic & Cultural Events** on campus or suggest an Acoustic Jam on Wishlist!`,
      actions: [
        { label: '🎙️ Explore Cultural & Open Mic', route: 'events' },
        { label: '💡 Wish for a Concert / Music Night', route: 'ideas' }
      ]
    };
  }

  // =========================================================================
  // 8d. COURTESY, THANKS, BYE & APPRECIATION
  // =========================================================================
  if (
    q.includes('thank') ||
    q.includes('thanks') ||
    q.includes('thx') ||
    q.includes('shukriya') ||
    q.includes('dhanyawad') ||
    q.includes('awesome') ||
    q.includes('nice') ||
    q.includes('great') ||
    q.includes('good job')
  ) {
    return {
      text: `💙 **You're most welcome!** Always happy to help.\n\nEnjoy your time at Sanjivani University and make the most out of every event! Feel free to ask if you ever need anything else. 🚀`,
      actions: [
        { label: '🎉 Explore Events', route: 'events' },
        { label: '💡 Campus Wishlist', route: 'ideas' }
      ]
    };
  }

  if (
    q.includes('bye') ||
    q.includes('good night') ||
    q.includes('goodnight') ||
    q.includes('see you') ||
    q.includes('alvida') ||
    q.includes('tata')
  ) {
    return {
      text: `👋 **Goodbye! Take care and have a wonderful day ahead on campus!** 🌟\n\nI'll be right here whenever you need event passes, certificates, or team updates. Rest well! ✨`,
      actions: [{ label: '🎉 Browse Events', route: 'events' }]
    };
  }

  // =========================================================================
  // 9. WHAT CAN YOU DO / FEATURES OVERVIEW
  // =========================================================================
  if (q.includes('what can you do') || q.includes('features') || q.includes('help me') || q.includes('guide') || q.includes('kya kar') || q.includes('kya kya') || q.includes('sab kuch')) {
    const liveCount = events.length;
    const eventsLine = liveCount > 0 ? `→ ${liveCount} events currently live! Browse & register.` : `→ Abhi koi event nahi hai. Wishlist par suggest karo!`;
    return {
      text: `⚡ **NEX — EventPulse ke saare features:**\n\n🎉 **Events & Registration**\n${eventsLine}\n\n📢 **Campus Notices**\n→ Official campus circulars, sports events, & announcements (Admin dwara post hote hain).\n\n🙋 **Volunteer**\n→ Event volunteer ke liye apply karo — Leadership Certificate & VIP access milta hai!\n\n⭐ **Event Reviews**\n→ Attended event ko rate & review karo. Future events improve honge!\n\n💡 **Campus Wishlist & Ideas**\n→ Naya event suggest karo. Most-voted idea officially organize hota hai! 🔥\n\n🤝 **Teammate Finder**\n→ Hackathon partners dhundo, squad post karo, WhatsApp par connect karo.\n\n📜 **Certificates**\n→ Event attend karo, QR scan ho, tamper-proof PDF certificate download karo.\n\n🚨 **Grievance / Report**\n→ Misbehavior, unfair judging ya safety issues — 100% confidential option.\n\n🎧 **Helpdesk**\n→ Email & on-campus support for any issue.\n\n*Kuch bhi poocho — main 24/7 yahan hoon!* 👆`,
      actions: [
        { label: '🎉 Browse Events', route: 'events' },
        { label: '💡 Campus Wishlist', route: 'ideas' },
        { label: '🎫 My Passes', route: 'my-passes' }
      ]
    };
  }

  // =========================================================================
  // 10. SMART DYNAMIC CONVERSATIONAL FALLBACK
  // =========================================================================
  const liveEventsHint = events.length > 0
    ? `🎉 *${events.length} events abhi live hain!*`
    : `📌 *Abhi koi live event nahi hai — Wishlist par suggest karo ya squad ready karo!*`;

  return {
    text: `⚡ **Samjha!** 🤖\n\nMain tumhara **24/7 NEX AI Campus Copilot** hoon — EventPulse ka intelligent assistant for Sanjivani University! 🎓\n\n${liveEventsHint}\n\n**Ye cheezein mujhse pooch sakte ho:**\n• 🚀 *"Upcoming hackathons & events dikhao"*\n• 🤝 *"Hackathon ke liye teammates chahiye"*\n• 🙋 *"Event volunteer kaise bane?"*\n• 💡 *"Naya event ya concert suggest karna hai"*\n• 🎫 *"Mera QR pass & status check karo"*\n• 📢 *"Koi campus notice ya circular hai?"*\n• 🚨 *"Grievance ya complaint file karna hai"*\n\nAage kya explore karna hai?`,
    actions: [
      { label: '🎉 Browse Events', route: 'events' },
      { label: '💡 Campus Wishlist', route: 'ideas' },
      { label: '🤝 Teammate Finder', route: 'teams_modal' }
    ]
  };
}

/**
 * AI Event Description Generator for Organizers
 */
export async function generateEventDescriptionAI(title, category, department) {
  const catName = (category || 'Technical').toUpperCase();
  const deptName = department || 'Engineering';

  return `### 🌟 Event Overview
Join us for **${title || 'Campus Flagship Event'}**, an official **${catName}** event hosted by the Department of **${deptName}** at Sanjivani University.

### 🎯 Key Highlights & Structure
- **Format**: Competitive team & individual tracks with live judging.
- **Hands-on Experience**: Practical problem statements tailored to industry standards.
- **Prizes & Recognition**: Official university certificates, trophies, and cash prizes for top finishers!

### 📋 Participation Guidelines
1. All participants must present their **EventPulse Digital QR Pass** at the registration desk for check-in.
2. Please bring your student ID card and necessary gear/laptops.
3. Attendance will be verified digitally for instant certificate issuance.`;
}

/**
 * AI Squad Pitch Generator for Students
 */
export async function generateSquadPitchAI(teamName, idea, roles) {
  const rolesList = roles || 'Frontend Developer, Backend Engineer, UI/UX Designer';
  return `🚀 Team **${teamName || 'Innovators'}** is gearing up for the upcoming hackathon! We're building "${idea || 'an innovative campus solution'}" and looking for motivated teammates specializing in **${rolesList}**. Connect with us on WhatsApp or Email to team up!`;
}
