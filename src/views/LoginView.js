import { loginUser, registerStudent, loginWithGoogle } from '../services/auth';

export function renderLoginView(container, navigateTo) {
  let isSignUpMode = false;
  let currentStep = 1; // 1 | 2 for signup
  let signupDraft = { name: '', prn: '', department: '', year: '', division: '' };

  const render = () => {
    container.innerHTML = `
      <style>
        :root {
          --paper: #ffffff;
          --paper-dim: #f1f5f9;
          --ink: #0f172a;
          --ink-soft: #64748b;
          --navy: #3b0764;
          --navy-2: #581c87;
          --navy-3: #6b21a8;
          --pulse: #10b981;
          --pulse-dim: rgba(16, 185, 129, 0.6);
          --line: #cbd5e1;
          --radius: 16px;
        }

        .pass-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: calc(100vh - 40px);
          padding: 0.5rem;
        }

        .pass {
          width: 100%;
          max-width: 900px;
          background: var(--paper);
          border-radius: var(--radius);
          display: grid;
          grid-template-columns: 0.85fr 40px 1.25fr;
          box-shadow: 0 30px 60px -20px rgba(23,21,33,0.35), 0 2px 0 rgba(23,21,33,0.04);
          overflow: hidden;
          max-height: calc(100vh - 30px);
        }

        .stub {
          position: relative;
          background: radial-gradient(120% 90% at 15% 0%, var(--navy-3) 0%, var(--navy-2) 45%, var(--navy) 100%);
          color: var(--paper);
          padding: 28px 26px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          overflow: hidden;
        }

        .stub::before {
          content: "";
          position: absolute; inset: 0;
          background-image: radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px);
          background-size: 14px 14px;
          opacity: 0.5;
          pointer-events: none;
        }

        .stub .brand .mark {
          display: inline-flex; align-items: center; gap: 8px;
          font-family: 'Space Grotesk', system-ui, sans-serif;
          font-weight: 700; font-size: 20px; letter-spacing: -0.02em;
        }

        .stub .brand .mark .dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: var(--pulse);
          animation: dotpulse 2.2s ease-in-out infinite;
        }

        @keyframes dotpulse {
          0% { box-shadow: 0 0 0 0 rgba(255,100,82,0.55); }
          70% { box-shadow: 0 0 0 10px rgba(255,100,82,0); }
          100% { box-shadow: 0 0 0 0 rgba(255,100,82,0); }
        }

        .stub .brand .tag {
          margin-top: 6px;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase;
          color: #c9c3e8;
        }

        .stub .headline {
          position: relative; z-index: 2;
          font-family: 'Space Grotesk', system-ui, sans-serif;
          font-weight: 600; font-size: 22px; line-height: 1.25; letter-spacing: -0.01em;
          max-width: 250px;
          margin-top: 18px;
        }
        .stub .headline span { color: var(--pulse); }

        .unlocks {
          position: relative; z-index: 2;
          margin-top: 16px;
          display: flex; flex-direction: column; gap: 10px;
        }

        .unlocks li {
          list-style: none; display: flex; align-items: flex-start; gap: 8px;
          font-size: 12px; color: #d6d1ee;
        }

        .unlocks li .tick {
          flex: none; width: 15px; height: 15px; border-radius: 4px;
          background: rgba(255,100,82,0.16); border: 1px solid var(--pulse-dim);
          display: flex; align-items: center; justify-content: center;
          font-size: 9px; color: var(--pulse); margin-top: 1px;
        }

        .serial {
          position: relative; z-index: 2;
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10.5px; letter-spacing: 0.08em; color: #9a92c4;
          display: flex; justify-content: space-between; align-items: flex-end;
          margin-top: 16px;
        }
        .serial b { color: #c9c3e8; font-weight: 500; }

        .seam { position: relative; }
        .seam::before, .seam::after {
          content: ""; position: absolute; left: 50%; transform: translateX(-50%);
          width: 26px; height: 13px; background: var(--paper-dim);
          border-radius: 0 0 26px 26px;
        }
        .seam::before { top: -1px; }
        .seam::after { bottom: -1px; transform: translateX(-50%) rotate(180deg); }

        .seam-holes {
          position: absolute; inset: 0;
          display: flex; flex-direction: column; justify-content: space-evenly; align-items: center;
        }
        .seam-holes i {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--paper-dim); box-shadow: inset 0 1px 2px rgba(23,21,33,0.15);
        }

        .seam svg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }

        .ecg-path {
          fill: none; stroke: var(--pulse); stroke-width: 2;
          stroke-linecap: round; stroke-linejoin: round;
          stroke-dasharray: 340; stroke-dashoffset: 340;
          animation: draw 4.5s linear infinite;
          filter: drop-shadow(0 0 4px rgba(255,100,82,0.5));
        }
        @keyframes draw {
          0% { stroke-dashoffset: 340; }
          60% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -40; }
        }

        .form-panel {
          padding: 24px 32px;
          display: flex; flex-direction: column; justify-content: center;
          color: var(--ink);
          overflow-y: auto;
        }

        .form-eyebrow {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--ink-soft); margin-bottom: 4px;
        }

        .form-panel h1 {
          font-family: 'Space Grotesk', system-ui, sans-serif;
          font-weight: 600; font-size: 22px; letter-spacing: -0.01em;
          margin-bottom: 4px; color: var(--ink);
        }

        .form-panel .sub { color: var(--ink-soft); font-size: 13px; margin-bottom: 12px; }

        .steps {
          display: flex; align-items: center; gap: 8px; margin-bottom: 12px;
        }
        .steps .seg {
          flex: 1; height: 3px; border-radius: 2px; background: var(--line); overflow: hidden;
        }
        .steps .seg i {
          display: block; height: 100%; width: 0%; background: var(--pulse); transition: width 0.35s ease;
        }
        .steps .seg.done i { width: 100%; }
        .steps .label {
          font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: 0.06em;
          color: var(--ink-soft); white-space: nowrap;
        }

        .ticket-form { display: flex; flex-direction: column; gap: 10px; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }

        .field { display: flex; flex-direction: column; gap: 4px; }
        .field label { font-size: 11.5px; font-weight: 600; color: var(--ink-soft); letter-spacing: 0.01em; }
        .field input, .field select {
          font-family: 'IBM Plex Sans', sans-serif; font-size: 13.5px;
          padding: 9px 11px; border: 1.5px solid var(--line); border-radius: 8px;
          background: #fff; color: var(--ink); outline: none; width: 100%;
          transition: border-color 0.15s ease, box-shadow 0.15s ease; appearance: none;
        }

        .field select {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2359526f' stroke-width='1.6' fill='none' fill-rule='evenodd'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 12px center; padding-right: 30px;
        }

        .field input:focus, .field select:focus {
          border-color: var(--pulse); box-shadow: 0 0 0 3px rgba(255,100,82,0.14);
        }

        .btn-ticket-submit {
          margin-top: 4px;
          font-family: 'Space Grotesk', system-ui, sans-serif;
          font-weight: 600; font-size: 14px; letter-spacing: 0.01em;
          color: #fff; background: var(--ink); border: none; border-radius: 8px;
          padding: 11px 16px; cursor: pointer;
          display: flex; align-items: center; justify-content: center; gap: 6px;
          transition: background 0.2s ease, transform 0.12s ease;
        }
        .btn-ticket-submit:hover { background: #2a2740; }
        .btn-ticket-submit:active { transform: scale(0.98); }

        .btn-google-ticket {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          background: #ffffff; color: var(--ink); border: 1.5px solid var(--line);
          border-radius: 8px; padding: 9px 14px; font-weight: 600; font-size: 13.5px;
          cursor: pointer; transition: all 0.2s; margin-bottom: 10px; width: 100%;
        }
        .btn-google-ticket:hover { background: #f8fafc; border-color: #cbd5e1; }

        .footer-note { margin-top: 12px; font-size: 12.5px; color: var(--ink-soft); text-align: center; }
        .footer-note button { color: var(--ink); text-decoration: none; border: none; background: none; border-bottom: 1px solid var(--line); padding-bottom: 1px; cursor: pointer; font-weight: 600; }
        .footer-note button:hover { border-color: var(--pulse); color: var(--pulse); }

        @media (max-width: 820px) {
          .pass { grid-template-columns: 1fr; min-height: 0; max-height: none; }
          .stub { padding: 22px 20px; }
          .unlocks { display: none; }
          .seam { display: none; }
          .form-panel { padding: 22px 20px 28px; }
          .grid-2 { grid-template-columns: 1fr; }
        }
      </style>

      <div class="pass-wrapper">
        <div class="pass" id="pass">
          <!-- LEFT: Brand Stub -->
          <div class="stub">
            <div class="brand">
              <div class="mark" style="display: flex; align-items: center; gap: 10px;">
                <img src="/logo.jpg" alt="EventPulse Logo" style="width: 32px; height: 32px; border-radius: 8px; object-fit: cover; box-shadow: 0 4px 12px rgba(168, 85, 247, 0.4);" />
                EventPulse
              </div>
              <div class="tag">${isSignUpMode ? 'New campus pass' : 'Campus pass · issued 2026'}</div>
            </div>

            <div class="headline">
              ${isSignUpMode ? 'One account, <span>every event</span> on campus.' : 'Your events, <span>one live pulse</span> away.'}
            </div>

            <ul class="unlocks">
              <li><span class="tick">✓</span>Discover and register for events across every department</li>
              <li><span class="tick">✓</span>Get a QR pass the moment you're approved</li>
              <li><span class="tick">✓</span>Collect verified certificates after you attend</li>
            </ul>

            <div class="serial">
              <span>${isSignUpMode ? 'Create your pass' : 'Sign in to check in'}</span>
              <b>EP&nbsp;·&nbsp;2026&nbsp;·&nbsp;${isSignUpMode ? 'NEW' : '0X47'}</b>
            </div>
          </div>

          <!-- MIDDLE: Perforated Seam -->
          <div class="seam" aria-hidden="true">
            <div class="seam-holes">
              <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
            </div>
            <svg viewBox="0 0 40 560" preserveAspectRatio="none">
              <path class="ecg-path" d="M20,0 L20,220 L27,220 L31,190 L35,260 L39,220 L20,220 L20,340 L27,340 L31,310 L35,380 L39,340 L20,340 L20,560" />
            </svg>
          </div>

          <!-- RIGHT: Form Panel -->
          <div class="form-panel">
            <div class="form-eyebrow">${isSignUpMode ? 'Create your account' : 'Student & organizer sign in'}</div>
            <h1>${isSignUpMode ? (currentStep === 1 ? "Let's get your details" : 'Secure your account') : 'Welcome back'}</h1>
            <p class="sub">
              ${isSignUpMode 
                ? (currentStep === 1 ? 'This is what shows up on your pass and certificates.' : "Almost there — this is how you'll sign back in next time.")
                : 'Sign in with your registered email ID to see today\'s events and passes.'}
            </p>

            <div id="auth-alert" style="display: none; margin-bottom: 10px; font-size: 12px; padding: 8px 10px; border-radius: 6px; background: rgba(239,68,68,0.1); color: #ef4444; border: 1px solid rgba(239,68,68,0.3);"></div>

            ${isSignUpMode ? `
              <div class="steps">
                <div class="seg ${currentStep >= 1 ? 'done' : ''}"><i></i></div>
                <div class="seg ${currentStep >= 2 ? 'done' : ''}"><i></i></div>
                <div class="label">Step ${currentStep} of 2 · ${currentStep === 1 ? 'Profile' : 'Account'}</div>
              </div>

              <form class="ticket-form" id="signup-form">
                ${currentStep === 1 ? `
                  <div class="grid-2">
                    <div class="field">
                      <label for="fullname">Full name</label>
                      <input id="fullname" type="text" placeholder="Ananya Sharma" value="${signupDraft.name || ''}" required>
                    </div>
                    <div class="field">
                      <label for="prn">PRN / Student ID (12 chars)</label>
                      <input id="prn" type="text" placeholder="SU2026CS0417" maxlength="12" minlength="12" style="text-transform: uppercase;" value="${signupDraft.prn || ''}" required>
                    </div>
                  </div>

                  <div class="grid-2">
                    <div class="field">
                      <label for="department">Department</label>
                      <select id="department" required>
                        <option value="" disabled ${!signupDraft.department ? 'selected' : ''}>Select department</option>
                        <option value="Computer Science & Engineering" ${signupDraft.department === 'Computer Science & Engineering' ? 'selected' : ''}>Computer Science & Engineering</option>
                        <option value="Information Technology" ${signupDraft.department === 'Information Technology' ? 'selected' : ''}>Information Technology</option>
                        <option value="AIML" ${signupDraft.department === 'AIML' ? 'selected' : ''}>AI & Machine Learning (AIML)</option>
                        <option value="AIDS" ${signupDraft.department === 'AIDS' ? 'selected' : ''}>AI & Data Science (AIDS)</option>
                        <option value="Cyber Security" ${signupDraft.department === 'Cyber Security' ? 'selected' : ''}>Cyber Security</option>
                        <option value="IMtech" ${signupDraft.department === 'IMtech' ? 'selected' : ''}>Integrated M.Tech (IMtech)</option>
                        <option value="Robotics & Automation" ${signupDraft.department === 'Robotics & Automation' ? 'selected' : ''}>Robotics & Automation</option>
                        <option value="Mechanical Engineering" ${signupDraft.department === 'Mechanical Engineering' ? 'selected' : ''}>Mechanical Engineering</option>
                        <option value="Civil Engineering" ${signupDraft.department === 'Civil Engineering' ? 'selected' : ''}>Civil Engineering</option>
                        <option value="Other" ${signupDraft.department === 'Other' ? 'selected' : ''}>Other</option>
                      </select>
                    </div>
                    <div class="grid-2" style="gap:10px;">
                      <div class="field">
                        <label for="year">Year</label>
                        <select id="year" required>
                          <option value="" disabled ${!signupDraft.year ? 'selected' : ''}>Year</option>
                          <option value="1st Year" ${signupDraft.year === '1st Year' ? 'selected' : ''}>1st</option>
                          <option value="2nd Year" ${signupDraft.year === '2nd Year' ? 'selected' : ''}>2nd</option>
                          <option value="3rd Year" ${signupDraft.year === '3rd Year' ? 'selected' : ''}>3rd</option>
                          <option value="4th Year" ${signupDraft.year === '4th Year' ? 'selected' : ''}>4th</option>
                        </select>
                      </div>
                      <div class="field">
                        <label for="division">Division</label>
                        <input id="division" type="text" placeholder="A" value="${signupDraft.division || ''}" required>
                      </div>
                    </div>
                  </div>

                  <button class="btn-ticket-submit" type="button" id="toStep2">
                    <span>Continue</span><span class="arrow">→</span>
                  </button>
                ` : `
                  <div class="field">
                    <label for="email">Email ID</label>
                    <input id="email" type="email" placeholder="you@gmail.com" required>
                  </div>

                  <div class="field">
                    <label for="password">Password</label>
                    <input id="password" type="password" placeholder="At least 8 characters" required minlength="8">
                  </div>

                  <div class="field">
                    <label for="confirm">Confirm password</label>
                    <input id="confirm" type="password" placeholder="Re-enter password" required minlength="8">
                  </div>

                  <button class="btn-ticket-submit" type="submit" id="btn-submit-signup">
                    <span id="btnLabel">Create my pass</span><span class="arrow">→</span>
                  </button>
                `}
              </form>
            ` : `
              <form class="ticket-form" id="login-form">
                <div class="field">
                  <label for="login-email">Email ID</label>
                  <input id="login-email" type="email" placeholder="you@gmail.com" required>
                </div>

                <div class="field">
                  <label for="login-password">Password</label>
                  <input id="login-password" type="password" placeholder="••••••••" required>
                </div>

                <button class="btn-ticket-submit" type="submit">
                  <span>Sign in</span><span class="arrow">→</span>
                </button>
              </form>
            `}

            <p class="footer-note">
              ${isSignUpMode ? 'Already have an account?' : 'New to campus?'}
              <button type="button" id="toggle-mode-btn">
                ${isSignUpMode ? 'Sign in' : 'Create an account'}
              </button>
            </p>
          </div>
        </div>
      </div>
    `;

    const alertEl = container.querySelector('#auth-alert');

    // Mode Toggle
    container.querySelector('#toggle-mode-btn')?.addEventListener('click', () => {
      isSignUpMode = !isSignUpMode;
      currentStep = 1;
      render();
    });

    // Step 1 -> Step 2 Validation
    container.querySelector('#toStep2')?.addEventListener('click', () => {
      const name = container.querySelector('#fullname')?.value.trim();
      const prn = container.querySelector('#prn')?.value.trim().toUpperCase();
      const dept = container.querySelector('#department')?.value;
      const yr = container.querySelector('#year')?.value;
      const div = container.querySelector('#division')?.value.trim();

      if (!name || !prn || !dept || !yr || !div) {
        alertEl.style.display = 'block';
        alertEl.textContent = 'Please fill out all profile fields to continue.';
        return;
      }

      if (prn.length !== 12) {
        alertEl.style.display = 'block';
        alertEl.textContent = `PRN must be exactly 12 characters long (Current length: ${prn.length}). Example: SU2026CS0417`;
        return;
      }

      signupDraft = { name, prn, department: dept, year: yr, division: div };
      alertEl.style.display = 'none';
      currentStep = 2;
      render();
    });

    // Step 2 Final Signup Submission
    container.querySelector('#signup-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      alertEl.style.display = 'none';

      const email = container.querySelector('#email').value.trim();
      const password = container.querySelector('#password').value;
      const confirm = container.querySelector('#confirm').value;

      if (password !== confirm) {
        alertEl.style.display = 'block';
        alertEl.textContent = 'Passwords do not match.';
        return;
      }

      const submitBtn = container.querySelector('#btn-submit-signup');
      const btnLabel = container.querySelector('#btnLabel');
      if (submitBtn) submitBtn.disabled = true;
      if (btnLabel) btnLabel.textContent = 'Creating your pass…';

      try {
        const res = await registerStudent({
          email,
          password,
          name: signupDraft.name || 'Student',
          prn: signupDraft.prn || 'SU2026CS0417',
          department: signupDraft.department || 'Computer Science & Engineering',
          year: signupDraft.year || '3rd Year',
          division: signupDraft.division || 'A'
        });

        if (res && res.success) {
          if (btnLabel) btnLabel.textContent = 'Pass created ✓';
          setTimeout(() => {
            navigateTo('events');
          }, 500);
        } else {
          if (submitBtn) submitBtn.disabled = false;
          if (btnLabel) btnLabel.textContent = 'Create my pass';
          alertEl.style.display = 'block';
          alertEl.textContent = (res && res.error) ? res.error : 'Registration failed. Please check your details.';
        }
      } catch (err) {
        if (submitBtn) submitBtn.disabled = false;
        if (btnLabel) btnLabel.textContent = 'Create my pass';
        alertEl.style.display = 'block';
        alertEl.textContent = err.message || 'Registration failed.';
      }
    });

    // Login Submit
    container.querySelector('#login-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      alertEl.style.display = 'none';

      const email = container.querySelector('#login-email').value.trim();
      const password = container.querySelector('#login-password').value;

      const res = await loginUser(email, password);
      if (res.success) {
        if (res.user.role === 'organizer') navigateTo('organizer');
        else if (res.user.role === 'admin') navigateTo('admin');
        else navigateTo('events');
      } else {
        alertEl.style.display = 'block';
        alertEl.textContent = res.error || 'Invalid email or password.';
      }
    });
  };

  render();
}
