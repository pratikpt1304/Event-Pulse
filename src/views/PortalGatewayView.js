import { switchDemoPersona } from '../services/auth';

/**
 * Sanjivani University Enterprise Portal Gateway
 * Ultra-professional Institutional Governance & Access Console
 */
export function renderPortalGatewayView(container, navigateTo) {
  const portals = [
    {
      id: 'vc',
      title: "Office of the Vice Chancellor",
      designation: "Prof. (Dr.) S. B. Patil",
      roleBadge: "APEX SANCTION AUTHORITY (TOP LAYER)",
      accentColor: "#d97706",
      topBorder: "linear-gradient(90deg, #d97706, #f59e0b)",
      org: "Apex University Governance & Executive Sanctions",
      icon: "👑",
      scope: "Final Institutional Sanction",
      desc: "Top-layer university clearance authority. Review academic proposals endorsed by School Deans, inspect the 4-tier student participation hierarchy, and issue university charters.",
      route: 'vc',
      buttonLabel: "Launch VC Executive Suite ➔"
    },
    {
      id: 'dean',
      title: "Office of the Academic Dean",
      designation: "Dr. Kavita",
      roleBadge: "SCHOOL LEVEL OVERSIGHT",
      accentColor: "#0284c7",
      topBorder: "linear-gradient(90deg, #0284c7, #38bdf8)",
      org: "School of Computing & Engineering (SCE)",
      icon: "🎓",
      scope: "Inter-Departmental Clearance",
      desc: "Academic & budgetary scrutiny for departments of AI & ML, Computer Engineering, and IT. Review HOD recommendations and escalate verified proposals to the Vice Chancellor.",
      route: 'dean',
      buttonLabel: "Launch Dean Academic Suite ➔"
    },
    {
      id: 'hod',
      title: "Office of the Head of Department",
      designation: "Prof. Anwar Shaikh",
      roleBadge: "DEPARTMENTAL LEVEL CLEARANCE",
      accentColor: "#7c3aed",
      topBorder: "linear-gradient(90deg, #7c3aed, #a855f7)",
      org: "Department of AI & ML (IMTech Cohort)",
      icon: "🏫",
      scope: "First-Tier Scrutiny & Student Roster",
      desc: "Direct administrative governance over FY to Final Year IMTech cohorts. First-line vetting of student event proposals, timetable conflict resolution, and 120-student attendance monitoring.",
      route: 'hod',
      buttonLabel: "Launch HOD Department Console ➔"
    },
    {
      id: 'organizer',
      title: "Event Operations Directorate",
      designation: "Pratik Thorat (Lead Organizer)",
      roleBadge: "OPERATIONAL EXECUTION LEAD",
      accentColor: "#059669",
      topBorder: "linear-gradient(90deg, #059669, #10b981)",
      org: "Student Council / Group 8 (DTIL)",
      icon: "⚡",
      scope: "Proposals, Stepper & QR Check-in",
      desc: "Draft and submit event charters, monitor real-time 4-tier approval advancement (HOD ➔ Dean ➔ VC), scan encrypted student QR passes, and export attendance records.",
      route: 'organizer',
      buttonLabel: "Launch Operations Hub ➔"
    },
    {
      id: 'admin',
      title: "Central Administrative Secretariat",
      designation: "Prof. Hariprasath & Admin Directorate",
      roleBadge: "CENTRAL PLATFORM GOVERNANCE",
      accentColor: "#dc2626",
      topBorder: "linear-gradient(90deg, #dc2626, #ef4444)",
      org: "University Central Secretariat (\"That's for us\")",
      icon: "🛡️",
      scope: "Full Master Platform Control",
      desc: "Institutional platform administration: manage faculty privileges, audit disciplinary grievance tickets, issue campus broadcast notices, and oversee student registry directories.",
      route: 'admin',
      buttonLabel: "Launch Central Secretariat ➔"
    },
    {
      id: 'student',
      title: "Student Discovery & Participation Portal",
      designation: "Kharad Kishor Devidas & Enrolled Cohort",
      roleBadge: "STUDENT ACCESS & PASSES",
      accentColor: "#4f46e5",
      topBorder: "linear-gradient(90deg, #4f46e5, #6366f1)",
      org: "Undergraduate & Integrated M.Tech Cohorts",
      icon: "🎒",
      scope: "Campus Life & Verified Dossiers",
      desc: "Discover approved university symposiums, hackathons, and sports tournaments. Obtain cryptographic single-use QR passes, review verified participation transcripts, and collaborate.",
      route: 'events',
      buttonLabel: "Launch Student Portal ➔"
    }
  ];

  container.innerHTML = `
    <div style="min-height: 88vh; padding: 2rem 1rem 4rem; max-width: 1260px; margin: 0 auto; font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;">
      
      <!-- Top Institutional Header Card -->
      <div style="
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        padding: 1.75rem 2rem;
        margin-bottom: 2rem;
        box-shadow: 0 4px 20px -4px rgba(15, 23, 42, 0.05);
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 1.5rem;
      ">
        <div style="display: flex; align-items: center; gap: 1.25rem;">
          <img src="/logo.jpg" alt="Sanjivani University Seal" style="
            width: 64px;
            height: 64px;
            border-radius: 12px;
            object-fit: cover;
            border: 2px solid #e2e8f0;
            box-shadow: 0 2px 8px rgba(0,0,0,0.06);
          " />
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
              <span style="
                background: #f1f5f9;
                color: #475569;
                border: 1px solid #cbd5e1;
                font-size: 0.68rem;
                font-weight: 800;
                padding: 0.15rem 0.55rem;
                border-radius: 4px;
                letter-spacing: 0.06em;
                text-transform: uppercase;
              ">
                Official Institutional Governance Portal
              </span>
              <span style="font-size: 0.72rem; color: #16a34a; font-weight: 700; display: inline-flex; align-items: center; gap: 0.25rem;">
                <span style="width: 7px; height: 7px; background: #16a34a; border-radius: 50%; display: inline-block;"></span>
                Enterprise Node Online
              </span>
            </div>
            <h1 style="font-size: 1.65rem; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -0.02em;">
              Sanjivani University • EventPulse Enterprise
            </h1>
            <p style="font-size: 0.85rem; color: #64748b; margin: 0.2rem 0 0; font-weight: 500;">
              Multi-Tier Academic Approval Hierarchy & Centralized Student Participation Governance System
            </p>
          </div>
        </div>

        <!-- Institutional Security & Scope Badge -->
        <div style="
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 0.75rem 1.25rem;
          text-align: right;
        ">
          <div style="font-size: 0.68rem; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">
            Academic Year 2026–2027
          </div>
          <div style="font-size: 0.92rem; font-weight: 800; color: #0f172a; margin-top: 0.15rem;">
            NAAC 'A' & NIRF Criterion 5.3 Ready
          </div>
          <div style="font-size: 0.72rem; color: #475569; font-weight: 600; margin-top: 0.15rem;">
            Autonomous Sanjivani Group of Institutes
          </div>
        </div>
      </div>

      <!-- Section Guide Label -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
        <div>
          <h2 style="font-size: 1.15rem; font-weight: 800; color: #0f172a; margin: 0;">
            Role-Based Institutional Portals
          </h2>
          <p style="font-size: 0.82rem; color: #64748b; margin: 0.15rem 0 0;">
            Select a specialized governance workspace to view isolated approvals, ledgers, and dossiers:
          </p>
        </div>
        <span style="font-size: 0.75rem; color: #64748b; font-weight: 700;">
          6 Authorized Systems
        </span>
      </div>

      <!-- Portals Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 1.25rem;">
        ${portals.map(p => `
          <div style="
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-top: 4px solid ${p.accentColor};
            border-radius: 14px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.02);
            position: relative;
            overflow: hidden;
          " onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 12px 28px -6px rgba(15, 23, 42, 0.08)'; this.style.borderColor='#cbd5e1'; this.style.borderTopColor='${p.accentColor}';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 10px rgba(0, 0, 0, 0.02)'; this.style.borderColor='#e2e8f0'; this.style.borderTopColor='${p.accentColor}';">
            
            <div style="padding: 1.5rem 1.6rem 1rem;">
              
              <!-- Badge & Icon -->
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                <span style="
                  background: #f8fafc;
                  border: 1px solid #e2e8f0;
                  color: ${p.accentColor};
                  font-size: 0.65rem;
                  font-weight: 800;
                  padding: 0.2rem 0.55rem;
                  border-radius: 6px;
                  letter-spacing: 0.05em;
                ">
                  ${p.roleBadge}
                </span>
                <span style="font-size: 1.5rem; line-height: 1;">${p.icon}</span>
              </div>

              <!-- Portal Title & Designated Authority -->
              <h3 style="font-size: 1.2rem; font-weight: 800; color: #0f172a; margin: 0 0 0.35rem; letter-spacing: -0.01em;">
                ${p.title}
              </h3>
              
              <div style="display: flex; align-items: baseline; gap: 0.4rem; margin-bottom: 0.75rem;">
                <span style="font-size: 0.88rem; font-weight: 700; color: #334155;">
                  ${p.designation}
                </span>
                <span style="font-size: 0.72rem; color: #64748b; font-weight: 600;">
                  • ${p.org}
                </span>
              </div>

              <div style="height: 1px; background: #f1f5f9; margin-bottom: 0.85rem;"></div>

              <!-- Scope & Description -->
              <div style="margin-bottom: 0.5rem;">
                <span style="font-size: 0.7rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em;">Primary Authority:</span>
                <span style="font-size: 0.75rem; font-weight: 700; color: #0f172a; margin-left: 0.25rem;">${p.scope}</span>
              </div>

              <p style="font-size: 0.82rem; color: #475569; line-height: 1.5; margin: 0;">
                ${p.desc}
              </p>
            </div>

            <!-- Card Action Footer -->
            <div style="padding: 1rem 1.6rem 1.4rem; background: #fafafa; border-top: 1px solid #f1f5f9;">
              <button class="btn-enter-portal" data-persona="${p.id}" data-route="${p.route}" style="
                width: 100%;
                background: #0f172a;
                color: #ffffff;
                border: 1px solid #0f172a;
                padding: 0.65rem 1rem;
                border-radius: 8px;
                font-size: 0.84rem;
                font-weight: 700;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.5rem;
                transition: all 0.15s ease-in-out;
              " onmouseover="this.style.background='${p.accentColor}'; this.style.borderColor='${p.accentColor}';" onmouseout="this.style.background='#0f172a'; this.style.borderColor='#0f172a';">
                <span>${p.buttonLabel}</span>
              </button>
            </div>

          </div>
        `).join('')}
      </div>

      <!-- Institutional Footer Info -->
      <div style="
        margin-top: 2.5rem;
        padding: 1.25rem 1.5rem;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 1rem;
      ">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="font-size: 1.2rem;">🏛️</span>
          <div>
            <div style="font-size: 0.8rem; font-weight: 700; color: #0f172a;">
              Institutional Briefing Mode Active
            </div>
            <div style="font-size: 0.72rem; color: #64748b;">
              Each portal operates in complete architectural isolation. Use <strong>"🔄 Switch Portal"</strong> in the top header at any point to toggle governance perspectives.
            </div>
          </div>
        </div>

        <div style="font-size: 0.72rem; color: #64748b; font-weight: 600;">
          Department of AI & Data Science • Sanjivani University
        </div>
      </div>

    </div>
  `;

  // Attach button click listeners
  container.querySelectorAll('.btn-enter-portal').forEach(btn => {
    btn.addEventListener('click', () => {
      const personaId = btn.getAttribute('data-persona');
      const targetRoute = btn.getAttribute('data-route');
      switchDemoPersona(personaId);
      navigateTo(targetRoute);
    });
  });
}
