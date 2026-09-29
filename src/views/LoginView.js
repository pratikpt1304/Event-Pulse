import { loginUser, registerStudent, switchDemoPersona } from '../services/auth';

/**
 * University Dual-Authentication Gateway
 * 1. Student Access (Student Login & 2-Step Registration)
 * 2. Faculty & Staff Administration (Separate Tiered Governance Sections)
 */
export function renderLoginView(container, navigateTo) {
  let activeTab = 'student'; // 'student' | 'staff'
  let isSignUpMode = false;
  let currentStep = 1; // 1 | 2 for student signup
  let signupDraft = { name: '', prn: '', department: '', year: '', division: '' };

  const staffTiers = [
    {
      id: 'vc',
      title: "Office of the Vice Chancellor",
      designation: "Prof. (Dr.) S. B. Patil (Vice Chancellor)",
      badge: "APEX SANCTION AUTHORITY (TOP LAYER)",
      accentColor: "#d97706",
      scope: "Final Institutional Sanctions & University-Wide Charters",
      icon: "👑",
      route: 'vc',
      buttonText: "Authorize VC Executive Suite ➔"
    },
    {
      id: 'dean',
      title: "Office of the Academic Dean",
      designation: "Dr. Kavita (Dean)",
      badge: "SCHOOL LEVEL CLEARANCE",
      accentColor: "#0284c7",
      scope: "School of Computing & Engineering (Inter-Departmental Clearance)",
      icon: "🎓",
      route: 'dean',
      buttonText: "Authorize Dean Academic Suite ➔"
    },
    {
      id: 'hod',
      title: "Office of the Head of Department",
      designation: "Prof. Anwar Shaikh (HOD)",
      badge: "DEPARTMENTAL COMMAND & SCRUTINY",
      accentColor: "#7c3aed",
      scope: "Department of AI & ML (120-Student Attendance Roster & Vetting)",
      icon: "🏫",
      route: 'hod',
      buttonText: "Authorize HOD Department Console ➔"
    },
    {
      id: 'organizer',
      title: "Event Operations Directorate",
      designation: "Pratik Thorat (Lead Organizer)",
      badge: "OPERATIONAL EXECUTION LEAD",
      accentColor: "#059669",
      scope: "Student Council / Group 8 (Proposals, Stepper & QR Pass Scanning)",
      icon: "⚡",
      route: 'organizer',
      buttonText: "Authorize Operations Hub ➔"
    },
    {
      id: 'admin',
      title: "Central Administrative Secretariat",
      designation: "Prof. Hariprasath & Admin Directorate",
      badge: "MASTER SYSTEM GOVERNANCE",
      accentColor: "#dc2626",
      scope: "University Central Secretariat (Full Control & Disciplinary Redressal)",
      icon: "🛡️",
      route: 'admin',
      buttonText: "Authorize Central Secretariat ➔"
    }
  ];

  const render = () => {
    container.innerHTML = `
      <div style="min-height: calc(100vh - 40px); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 1.5rem 1rem 3rem; font-family: 'Plus Jakarta Sans', system-ui, sans-serif;">
        
        <!-- Institutional Top Badge -->
        <div style="text-align: center; margin-bottom: 1.5rem;">
          <div style="display: inline-flex; align-items: center; gap: 0.5rem; background: #ffffff; border: 1px solid #e2e8f0; padding: 0.35rem 0.95rem; border-radius: 999px; font-size: 0.75rem; font-weight: 800; color: #475569; box-shadow: 0 2px 6px rgba(0,0,0,0.03); margin-bottom: 0.75rem;">
            <img src="/logo.jpg" alt="Logo" style="width: 20px; height: 20px; border-radius: 5px; object-fit: cover;" />
            SANJIVANI UNIVERSITY • EVENTPULSE ENTERPRISE
          </div>
          <h1 style="font-size: 2rem; font-weight: 900; color: #0f172a; margin: 0 0 0.35rem; letter-spacing: -0.02em;">
            Single Sign-On (SSO) Portal
          </h1>
          <p style="font-size: 0.9rem; color: #64748b; margin: 0; max-width: 500px;">
            Select your university affiliation below to access your dedicated workspace.
          </p>
        </div>

        <!-- 1. Primary Segment Switcher: Student vs Staff -->
        <div style="
          display: flex;
          background: #e2e8f0;
          padding: 5px;
          border-radius: 12px;
          width: 100%;
          max-width: 520px;
          margin-bottom: 1.75rem;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.04);
        ">
          <button id="tab-btn-student" style="
            flex: 1;
            padding: 0.65rem 1rem;
            border-radius: 9px;
            border: none;
            font-size: 0.88rem;
            font-weight: 800;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 0.45rem;
            background: ${activeTab === 'student' ? '#ffffff' : 'transparent'};
            color: ${activeTab === 'student' ? '#0f172a' : '#64748b'};
            box-shadow: ${activeTab === 'student' ? '0 3px 10px rgba(0,0,0,0.08)' : 'none'};
          ">
            <span>🎓</span> Login as Student
          </button>

          <button id="tab-btn-staff" style="
            flex: 1;
            padding: 0.65rem 1rem;
            border-radius: 9px;
            border: none;
            font-size: 0.88rem;
            font-weight: 800;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 0.45rem;
            background: ${activeTab === 'staff' ? '#0f172a' : 'transparent'};
            color: ${activeTab === 'staff' ? '#ffffff' : '#64748b'};
            box-shadow: ${activeTab === 'staff' ? '0 3px 10px rgba(0,0,0,0.15)' : 'none'};
          ">
            <span>🏛️</span> Login as Staff / Faculty
          </button>
        </div>

        <div id="auth-alert" style="display: none; width: 100%; max-width: 520px; margin-bottom: 1.25rem; font-size: 0.82rem; padding: 0.75rem 1rem; border-radius: 8px; background: rgba(239,68,68,0.1); color: #ef4444; border: 1px solid rgba(239,68,68,0.3); font-weight: 600;"></div>

        <!-- 2. STUDENT LOGIN SECTION -->
        ${activeTab === 'student' ? `
          <div style="
            width: 100%;
            max-width: 520px;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            border-radius: 16px;
            padding: 2rem;
            box-shadow: 0 10px 30px -5px rgba(0,0,0,0.05);
          ">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem;">
              <div>
                <span style="font-size: 0.7rem; font-weight: 800; color: #4f46e5; text-transform: uppercase; letter-spacing: 0.05em;">
                  ${isSignUpMode ? 'New Student Registration' : 'Student Access'}
                </span>
                <h2 style="font-size: 1.4rem; font-weight: 900; color: #0f172a; margin: 0.15rem 0;">
                  ${isSignUpMode ? (currentStep === 1 ? 'Academic Information' : 'Account Credentials') : 'Student Portal Sign In'}
                </h2>
                <p style="font-size: 0.82rem; color: #64748b; margin: 0;">
                  ${isSignUpMode ? 'Register to get verified QR passes and event access.' : 'Access campus hackathons, sports passes, and team finder.'}
                </p>
              </div>
              <span style="font-size: 1.75rem;">🎒</span>
            </div>

            <!-- Quick Demo Student Login Button -->
            ${!isSignUpMode ? `
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.85rem 1rem; margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center; gap: 0.75rem;">
                <div>
                  <div style="font-size: 0.72rem; font-weight: 800; color: #475569; text-transform: uppercase;">1-Click Sample Student</div>
                  <div style="font-size: 0.85rem; font-weight: 800; color: #0f172a;">Kharad Kishor Devidas</div>
                  <div style="font-size: 0.7rem; color: #64748b;">PRN: 2126PMIM1001 • FY IMTech AIML</div>
                </div>
                <button id="btn-quick-sample-student" style="
                  background: #4f46e5;
                  color: #ffffff;
                  border: none;
                  padding: 0.45rem 0.85rem;
                  border-radius: 7px;
                  font-size: 0.78rem;
                  font-weight: 700;
                  cursor: pointer;
                  white-space: nowrap;
                ">
                  Quick Enter ➔
                </button>
              </div>

              <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem;">
                <div style="flex: 1; height: 1px; background: #e2e8f0;"></div>
                <span style="font-size: 0.72rem; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Or with credentials</span>
                <div style="flex: 1; height: 1px; background: #e2e8f0;"></div>
              </div>
            ` : ''}

            <!-- Student Form -->
            ${isSignUpMode ? `
              <form id="signup-form" style="display: flex; flex-direction: column; gap: 0.85rem;">
                ${currentStep === 1 ? `
                  <div>
                    <label style="font-size: 0.75rem; font-weight: 700; color: #334155; display: block; margin-bottom: 0.3rem;">Full Name</label>
                    <input id="fullname" type="text" placeholder="Ananya Sharma" value="${signupDraft.name || ''}" required style="width: 100%; padding: 0.65rem 0.85rem; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 0.85rem; outline: none;" />
                  </div>

                  <div>
                    <label style="font-size: 0.75rem; font-weight: 700; color: #334155; display: block; margin-bottom: 0.3rem;">PRN / Roll Number (12 Characters)</label>
                    <input id="prn" type="text" placeholder="2126PMIM1001" maxlength="12" minlength="12" style="width: 100%; padding: 0.65rem 0.85rem; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 0.85rem; text-transform: uppercase; outline: none;" value="${signupDraft.prn || ''}" required />
                  </div>

                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                    <div>
                      <label style="font-size: 0.75rem; font-weight: 700; color: #334155; display: block; margin-bottom: 0.3rem;">Department</label>
                      <select id="department" required style="width: 100%; padding: 0.65rem 0.85rem; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 0.82rem; background: #fff; outline: none;">
                        <option value="" disabled ${!signupDraft.department ? 'selected' : ''}>Select Dept</option>
                        <option value="IMTech (AIML)" ${signupDraft.department === 'IMTech (AIML)' ? 'selected' : ''}>IMTech (AIML)</option>
                        <option value="Computer Science & Engineering" ${signupDraft.department === 'Computer Science & Engineering' ? 'selected' : ''}>CSE</option>
                        <option value="Information Technology" ${signupDraft.department === 'Information Technology' ? 'selected' : ''}>IT</option>
                        <option value="AIDS" ${signupDraft.department === 'AIDS' ? 'selected' : ''}>AIDS</option>
                        <option value="Other" ${signupDraft.department === 'Other' ? 'selected' : ''}>Other</option>
                      </select>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                      <div>
                        <label style="font-size: 0.75rem; font-weight: 700; color: #334155; display: block; margin-bottom: 0.3rem;">Year</label>
                        <select id="year" required style="width: 100%; padding: 0.65rem 0.5rem; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 0.82rem; background: #fff; outline: none;">
                          <option value="1st Year (FY)" ${signupDraft.year === '1st Year (FY)' ? 'selected' : ''}>FY</option>
                          <option value="2nd Year (SY)" ${signupDraft.year === '2nd Year (SY)' ? 'selected' : ''}>SY</option>
                          <option value="3rd Year (TY)" ${signupDraft.year === '3rd Year (TY)' ? 'selected' : ''}>TY</option>
                          <option value="Final Year" ${signupDraft.year === 'Final Year' ? 'selected' : ''}>Final</option>
                        </select>
                      </div>

                      <div>
                        <label style="font-size: 0.75rem; font-weight: 700; color: #334155; display: block; margin-bottom: 0.3rem;">Div</label>
                        <input id="division" type="text" placeholder="A" value="${signupDraft.division || 'A'}" required style="width: 100%; padding: 0.65rem 0.5rem; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 0.85rem; text-align: center; outline: none;" />
                      </div>
                    </div>
                  </div>

                  <button id="toStep2" type="button" style="
                    width: 100%;
                    background: #0f172a;
                    color: #ffffff;
                    border: none;
                    padding: 0.75rem 1rem;
                    border-radius: 8px;
                    font-size: 0.85rem;
                    font-weight: 800;
                    cursor: pointer;
                    margin-top: 0.5rem;
                  ">
                    Continue to Account Credentials ➔
                  </button>
                ` : `
                  <div>
                    <label style="font-size: 0.75rem; font-weight: 700; color: #334155; display: block; margin-bottom: 0.3rem;">University / Personal Email</label>
                    <input id="email" type="email" placeholder="you@sanjivani.edu.in" required style="width: 100%; padding: 0.65rem 0.85rem; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 0.85rem; outline: none;" />
                  </div>

                  <div>
                    <label style="font-size: 0.75rem; font-weight: 700; color: #334155; display: block; margin-bottom: 0.3rem;">Password (Min 8 Chars)</label>
                    <input id="password" type="password" placeholder="••••••••" required minlength="8" style="width: 100%; padding: 0.65rem 0.85rem; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 0.85rem; outline: none;" />
                  </div>

                  <div>
                    <label style="font-size: 0.75rem; font-weight: 700; color: #334155; display: block; margin-bottom: 0.3rem;">Confirm Password</label>
                    <input id="confirm" type="password" placeholder="••••••••" required minlength="8" style="width: 100%; padding: 0.65rem 0.85rem; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 0.85rem; outline: none;" />
                  </div>

                  <button id="btn-submit-signup" type="submit" style="
                    width: 100%;
                    background: #0f172a;
                    color: #ffffff;
                    border: none;
                    padding: 0.75rem 1rem;
                    border-radius: 8px;
                    font-size: 0.85rem;
                    font-weight: 800;
                    cursor: pointer;
                    margin-top: 0.5rem;
                  ">
                    <span id="btnLabel">Create Student Pass & Account ➔</span>
                  </button>
                `}
              </form>
            ` : `
              <form id="student-login-form" style="display: flex; flex-direction: column; gap: 0.85rem;">
                <div>
                  <label style="font-size: 0.75rem; font-weight: 700; color: #334155; display: block; margin-bottom: 0.3rem;">Student Email ID</label>
                  <input id="student-email" type="email" placeholder="student@sanjivani.edu.in" required style="width: 100%; padding: 0.65rem 0.85rem; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 0.85rem; outline: none;" />
                </div>

                <div>
                  <label style="font-size: 0.75rem; font-weight: 700; color: #334155; display: block; margin-bottom: 0.3rem;">Password</label>
                  <input id="student-password" type="password" placeholder="••••••••" required style="width: 100%; padding: 0.65rem 0.85rem; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 0.85rem; outline: none;" />
                </div>

                <button type="submit" style="
                  width: 100%;
                  background: #0f172a;
                  color: #ffffff;
                  border: none;
                  padding: 0.75rem 1rem;
                  border-radius: 8px;
                  font-size: 0.88rem;
                  font-weight: 800;
                  cursor: pointer;
                  margin-top: 0.5rem;
                  transition: background 0.2s;
                " onmouseover="this.style.background='#334155'" onmouseout="this.style.background='#0f172a'">
                  Sign In to Student Portal ➔
                </button>
              </form>
            `}

            <div style="text-align: center; margin-top: 1.25rem; font-size: 0.8rem; color: #64748b;">
              ${isSignUpMode ? 'Already registered?' : 'New student on campus?'}
              <button type="button" id="toggle-signup-btn" style="background: none; border: none; color: #4f46e5; font-weight: 700; cursor: pointer; text-decoration: underline; margin-left: 0.25rem;">
                ${isSignUpMode ? 'Sign in with existing pass' : 'Create new student account'}
              </button>
            </div>
          </div>
        ` : `
          <!-- 3. STAFF & FACULTY GOVERNANCE SECTION -->
          <div style="width: 100%; max-width: 960px;">
            
            <div style="text-align: center; margin-bottom: 1.5rem;">
              <h2 style="font-size: 1.45rem; font-weight: 900; color: #0f172a; margin: 0 0 0.35rem;">
                Faculty & Executive Authority Clearance
              </h2>
              <p style="font-size: 0.85rem; color: #64748b; margin: 0;">
                Select your designated administrative clearance tier to authenticate into your isolated suite:
              </p>
            </div>

            <!-- Staff Tiers Grid (Separate Sections) -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
              ${staffTiers.map(st => `
                <div style="
                  background: #ffffff;
                  border: 1px solid #e2e8f0;
                  border-top: 3.5px solid ${st.accentColor};
                  border-radius: 12px;
                  padding: 1.25rem;
                  box-shadow: 0 2px 8px rgba(0,0,0,0.03);
                  display: flex;
                  flex-direction: column;
                  justify-content: space-between;
                  transition: transform 0.15s, box-shadow 0.15s;
                " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 20px -4px rgba(0,0,0,0.08)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(0,0,0,0.03)';">
                  
                  <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                      <span style="font-size: 0.62rem; font-weight: 800; color: ${st.accentColor}; background: #f8fafc; border: 1px solid #e2e8f0; padding: 0.15rem 0.45rem; border-radius: 4px; letter-spacing: 0.04em;">
                        ${st.badge}
                      </span>
                      <span style="font-size: 1.35rem;">${st.icon}</span>
                    </div>

                    <h3 style="font-size: 1.05rem; font-weight: 900; color: #0f172a; margin: 0 0 0.2rem;">
                      ${st.title}
                    </h3>
                    <div style="font-size: 0.8rem; font-weight: 700; color: #334155; margin-bottom: 0.4rem;">
                      ${st.designation}
                    </div>
                    <p style="font-size: 0.75rem; color: #64748b; line-height: 1.45; margin: 0 0 1rem;">
                      ${st.scope}
                    </p>
                  </div>

                  <button class="btn-staff-auth" data-persona="${st.id}" data-route="${st.route}" style="
                    width: 100%;
                    background: #0f172a;
                    color: #ffffff;
                    border: 1px solid #0f172a;
                    padding: 0.55rem 0.85rem;
                    border-radius: 7px;
                    font-size: 0.78rem;
                    font-weight: 800;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.35rem;
                    transition: all 0.15s;
                  " onmouseover="this.style.background='${st.accentColor}'; this.style.borderColor='${st.accentColor}';" onmouseout="this.style.background='#0f172a'; this.style.borderColor='#0f172a';">
                    <span>${st.buttonText}</span>
                  </button>

                </div>
              `).join('')}
            </div>

            <!-- Standard Staff Credential Login Option -->
            <div style="
              max-width: 500px;
              margin: 0 auto;
              background: #ffffff;
              border: 1px solid #e2e8f0;
              border-radius: 14px;
              padding: 1.5rem 1.75rem;
              box-shadow: 0 4px 15px -3px rgba(0,0,0,0.03);
            ">
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
                <span style="font-size: 1.1rem;">🔑</span>
                <div>
                  <h4 style="font-size: 0.95rem; font-weight: 800; color: #0f172a; margin: 0;">
                    Or Sign In with Official Staff Credentials
                  </h4>
                  <p style="font-size: 0.75rem; color: #64748b; margin: 0;">
                    Custom administrator or faculty registered email ID
                  </p>
                </div>
              </div>

              <form id="staff-credential-form" style="display: flex; flex-direction: column; gap: 0.75rem;">
                <div>
                  <label style="font-size: 0.72rem; font-weight: 700; color: #334155; display: block; margin-bottom: 0.25rem;">Staff Email</label>
                  <input id="staff-email" type="email" placeholder="faculty@sanjivani.edu.in" required style="width: 100%; padding: 0.6rem 0.85rem; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 0.85rem; outline: none;" />
                </div>

                <div>
                  <label style="font-size: 0.72rem; font-weight: 700; color: #334155; display: block; margin-bottom: 0.25rem;">Password</label>
                  <input id="staff-password" type="password" placeholder="••••••••" required style="width: 100%; padding: 0.6rem 0.85rem; border: 1.5px solid #cbd5e1; border-radius: 8px; font-size: 0.85rem; outline: none;" />
                </div>

                <button type="submit" style="
                  width: 100%;
                  background: #0f172a;
                  color: #ffffff;
                  border: none;
                  padding: 0.65rem 1rem;
                  border-radius: 8px;
                  font-size: 0.82rem;
                  font-weight: 800;
                  cursor: pointer;
                  margin-top: 0.25rem;
                ">
                  Authenticate Staff Session ➔
                </button>
              </form>
            </div>

          </div>
        `}

        <!-- Bottom Return to Portal Gateway -->
        <div style="margin-top: 2rem; text-align: center;">
          <a id="btn-back-gateway" style="font-size: 0.8rem; font-weight: 700; color: #64748b; text-decoration: none; cursor: pointer; display: inline-flex; align-items: center; gap: 0.35rem;">
            <span>🏛️</span> Open Enterprise Portal Gateway
          </a>
        </div>

      </div>
    `;

    const alertEl = container.querySelector('#auth-alert');

    // 1. Primary Tab Switchers
    container.querySelector('#tab-btn-student')?.addEventListener('click', () => {
      activeTab = 'student';
      isSignUpMode = false;
      currentStep = 1;
      render();
    });

    container.querySelector('#tab-btn-staff')?.addEventListener('click', () => {
      activeTab = 'staff';
      render();
    });

    container.querySelector('#btn-back-gateway')?.addEventListener('click', () => {
      navigateTo('portal');
    });

    // 2. Student Mode Toggle
    container.querySelector('#toggle-signup-btn')?.addEventListener('click', () => {
      isSignUpMode = !isSignUpMode;
      currentStep = 1;
      render();
    });

    // 3. Quick Sample Student Entry
    container.querySelector('#btn-quick-sample-student')?.addEventListener('click', () => {
      switchDemoPersona('student');
      navigateTo('events');
    });

    // 4. Staff Tier Authorize Buttons
    container.querySelectorAll('.btn-staff-auth').forEach(btn => {
      btn.addEventListener('click', () => {
        const personaId = btn.getAttribute('data-persona');
        const targetRoute = btn.getAttribute('data-route');
        switchDemoPersona(personaId);
        navigateTo(targetRoute);
      });
    });

    // 5. Student Step 1 -> Step 2
    container.querySelector('#toStep2')?.addEventListener('click', () => {
      const name = container.querySelector('#fullname')?.value.trim();
      const prn = container.querySelector('#prn')?.value.trim().toUpperCase();
      const dept = container.querySelector('#department')?.value;
      const yr = container.querySelector('#year')?.value;
      const div = container.querySelector('#division')?.value.trim();

      if (!name || !prn || !dept || !yr || !div) {
        alertEl.style.display = 'block';
        alertEl.textContent = 'Please fill out all academic fields to continue.';
        return;
      }

      if (prn.length !== 12) {
        alertEl.style.display = 'block';
        alertEl.textContent = `PRN must be exactly 12 characters long (Current length: ${prn.length}). Example: 2126PMIM1001`;
        return;
      }

      signupDraft = { name, prn, department: dept, year: yr, division: div };
      alertEl.style.display = 'none';
      currentStep = 2;
      render();
    });

    // 6. Student Signup Final Submit
    container.querySelector('#signup-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      alertEl.style.display = 'none';

      const email = container.querySelector('#email')?.value.trim();
      const password = container.querySelector('#password')?.value;
      const confirm = container.querySelector('#confirm')?.value;

      if (!email || !password) return;

      if (password !== confirm) {
        alertEl.style.display = 'block';
        alertEl.textContent = 'Passwords do not match.';
        return;
      }

      const submitBtn = container.querySelector('#btn-submit-signup');
      const btnLabel = container.querySelector('#btnLabel');
      if (submitBtn) submitBtn.disabled = true;
      if (btnLabel) btnLabel.textContent = 'Creating pass...';

      try {
        const res = await registerStudent({
          email,
          password,
          name: signupDraft.name || 'Student',
          prn: signupDraft.prn || '2126PMIM1001',
          department: signupDraft.department || 'IMTech (AIML)',
          year: signupDraft.year || '1st Year (FY)',
          division: signupDraft.division || 'A'
        });

        if (res && res.success) {
          if (btnLabel) btnLabel.textContent = 'Pass created ✓';
          setTimeout(() => {
            navigateTo('events');
          }, 400);
        } else {
          if (submitBtn) submitBtn.disabled = false;
          if (btnLabel) btnLabel.textContent = 'Create Student Pass & Account ➔';
          alertEl.style.display = 'block';
          alertEl.textContent = (res && res.error) ? res.error : 'Registration failed. Please check your details.';
        }
      } catch (err) {
        if (submitBtn) submitBtn.disabled = false;
        if (btnLabel) btnLabel.textContent = 'Create Student Pass & Account ➔';
        alertEl.style.display = 'block';
        alertEl.textContent = err.message || 'Registration failed.';
      }
    });

    // 7. Student Login Submit
    container.querySelector('#student-login-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      alertEl.style.display = 'none';

      const email = container.querySelector('#student-email')?.value.trim();
      const password = container.querySelector('#student-password')?.value;

      const res = await loginUser(email, password);
      if (res.success) {
        navigateTo('events');
      } else {
        alertEl.style.display = 'block';
        alertEl.textContent = res.error || 'Invalid student credentials.';
      }
    });

    // 8. Staff Credential Login Submit
    container.querySelector('#staff-credential-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      alertEl.style.display = 'none';

      const email = container.querySelector('#staff-email')?.value.trim();
      const password = container.querySelector('#staff-password')?.value;

      const res = await loginUser(email, password);
      if (res.success) {
        const role = res.user.role;
        if (role === 'vc') navigateTo('vc');
        else if (role === 'dean') navigateTo('dean');
        else if (role === 'hod') navigateTo('hod');
        else if (role === 'organizer') navigateTo('organizer');
        else if (role === 'admin') navigateTo('admin');
        else navigateTo('portal');
      } else {
        alertEl.style.display = 'block';
        alertEl.textContent = res.error || 'Invalid staff credentials.';
      }
    });
  };

  render();
}
