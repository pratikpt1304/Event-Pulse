import { loginUser, registerStudent, loginWithGoogle, DEMO_ACCOUNTS, resolveUserRole, isUserAdmin } from '../services/auth';

export function renderLoginView(container, navigateTo) {
  let isSignUpMode = false;
  let showPassword = false;
  let isLoading = false;
  let errorMessage = '';
  let selectedDemoKey = null;

  // Sign in form state
  let loginEmail = '';
  let loginPassword = '';

  // Student Sign up form state
  let signupData = {
    name: '',
    prn: '',
    department: 'Computer Science & Engineering',
    year: '1st Year',
    division: 'A',
    email: '',
    password: ''
  };

  function detectRoleText(email) {
    if (!email) return null;
    const clean = email.toLowerCase().trim();
    if (DEMO_ACCOUNTS[clean]) {
      const acc = DEMO_ACCOUNTS[clean];
      return { title: acc.name, role: acc.role };
    }
    if (isUserAdmin(clean)) {
      return { title: 'Executive Administrator', role: 'admin' };
    }
    const role = resolveUserRole(clean, 'student');
    if (role === 'organizer') {
      return { title: 'Event Organizer', role: 'organizer' };
    }
    return { title: 'Campus Student', role: 'student' };
  }

  const render = () => {
    const roleInfo = detectRoleText(loginEmail);

    container.innerHTML = `
      <style>
        .ep-auth-page {
          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem 1rem;
          background: #090d16;
          background-image: 
            radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.18) 0px, transparent 50%),
            radial-gradient(at 100% 100%, rgba(124, 58, 237, 0.15) 0px, transparent 50%),
            radial-gradient(at 50% 50%, rgba(15, 23, 42, 0.8) 0px, transparent 100%);
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #f8fafc;
          box-sizing: border-box;
        }

        .ep-auth-card {
          width: 100%;
          max-width: ${isSignUpMode ? '580px' : '470px'};
          background: #111827;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 2.25rem 2rem;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.65), 0 0 35px rgba(99, 102, 241, 0.08);
          transition: max-width 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          box-sizing: border-box;
        }

        @media (max-width: 480px) {
          .ep-auth-card {
            padding: 1.75rem 1.25rem;
            border-radius: 16px;
          }
        }

        .ep-brand-header {
          margin-bottom: 1.5rem;
        }

        .ep-brand-title {
          font-size: 1.85rem;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: -0.025em;
          margin: 0 0 0.4rem 0;
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }

        .ep-brand-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #6366f1;
          box-shadow: 0 0 12px #6366f1;
          display: inline-block;
        }

        .ep-brand-subtitle {
          font-size: 0.95rem;
          line-height: 1.45;
          color: #94a3b8;
          margin: 0;
        }

        .ep-form-group {
          margin-bottom: 1.1rem;
        }

        .ep-label {
          display: block;
          font-size: 0.8rem;
          font-weight: 600;
          color: #cbd5e1;
          margin-bottom: 0.4rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .ep-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }

        .ep-input {
          width: 100%;
          background: #1e293b;
          border: 1.5px solid #334155;
          color: #ffffff;
          border-radius: 10px;
          padding: 13px 16px;
          font-size: 0.95rem;
          font-family: inherit;
          outline: none;
          box-sizing: border-box;
          transition: all 0.15s ease;
        }

        .ep-input::placeholder {
          color: #64748b;
        }

        .ep-input:focus {
          border-color: #6366f1;
          background: #1e293b;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.22);
        }

        .ep-input-toggle-btn {
          position: absolute;
          right: 12px;
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          font-size: 0.9rem;
          padding: 4px 6px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .ep-input-toggle-btn:hover {
          color: #ffffff;
        }

        .ep-role-indicator {
          margin-top: -0.4rem;
          margin-bottom: 1rem;
          padding: 0.45rem 0.75rem;
          background: rgba(99, 102, 241, 0.1);
          border: 1px solid rgba(99, 102, 241, 0.25);
          border-radius: 8px;
          font-size: 0.8rem;
          color: #c7d2fe;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .ep-btn-primary {
          width: 100%;
          background: #6366f1;
          color: #ffffff;
          border: none;
          border-radius: 10px;
          padding: 13px 16px;
          font-size: 1rem;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.18s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          box-shadow: 0 4px 14px rgba(99, 102, 241, 0.35);
        }

        .ep-btn-primary:hover:not(:disabled) {
          background: #4f46e5;
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(99, 102, 241, 0.45);
        }

        .ep-btn-primary:active:not(:disabled) {
          transform: translateY(0);
        }

        .ep-btn-primary:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .ep-btn-google {
          width: 100%;
          margin-top: 0.75rem;
          background: #1e293b;
          border: 1.5px solid #334155;
          color: #f1f5f9;
          border-radius: 10px;
          padding: 12px 16px;
          font-size: 0.95rem;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.18s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.65rem;
        }

        .ep-btn-google:hover:not(:disabled) {
          background: #283548;
          border-color: #475569;
          color: #ffffff;
        }

        /* Demo Accounts Box */
        .ep-demo-box {
          margin-top: 1.35rem;
          background: #0f172a;
          border: 1px solid #1e293b;
          border-radius: 12px;
          padding: 1rem;
        }

        .ep-demo-title {
          font-size: 0.85rem;
          color: #94a3b8;
          margin-bottom: 0.65rem;
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }

        .ep-pills-wrap {
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem;
          margin-bottom: 0.65rem;
        }

        .ep-pill {
          background: rgba(30, 41, 59, 0.85);
          border: 1px solid #334155;
          color: #e2e8f0;
          border-radius: 8px;
          padding: 6px 11px;
          font-size: 0.8rem;
          font-family: monospace;
          cursor: pointer;
          transition: all 0.15s ease;
          user-select: none;
        }

        .ep-pill:hover {
          border-color: #6366f1;
          color: #ffffff;
          background: #1e293b;
        }

        .ep-pill.active {
          border-color: #6366f1;
          background: rgba(99, 102, 241, 0.25);
          color: #ffffff;
          box-shadow: 0 0 0 1px #6366f1;
        }

        .ep-demo-hint {
          font-size: 0.78rem;
          color: #64748b;
          margin: 0;
          line-height: 1.4;
        }

        .ep-demo-hint strong {
          color: #cbd5e1;
        }

        /* Switch Card Footer */
        .ep-switch-box {
          margin-top: 1.5rem;
          padding-top: 1.25rem;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          text-align: center;
          font-size: 0.9rem;
          color: #94a3b8;
        }

        .ep-link-btn {
          background: none;
          border: none;
          color: #818cf8;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          padding: 0;
          text-decoration: underline;
          text-underline-offset: 3px;
        }

        .ep-link-btn:hover {
          color: #a5b4fc;
        }

        /* Grid for Student Signup */
        .ep-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.85rem;
        }

        @media (max-width: 540px) {
          .ep-grid-2 {
            grid-template-columns: 1fr;
            gap: 0;
          }
        }

        .ep-select {
          appearance: none;
          background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
          background-repeat: no-repeat;
          background-position: right 12px center;
          background-size: 14px;
          padding-right: 32px;
          cursor: pointer;
        }

        .ep-alert-error {
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.35);
          color: #fca5a5;
          padding: 0.75rem 1rem;
          border-radius: 10px;
          font-size: 0.85rem;
          margin-bottom: 1.25rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .ep-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: ep-spin 0.6s linear infinite;
        }

        @keyframes ep-spin {
          to { transform: rotate(360deg); }
        }
      </style>

      <div class="ep-auth-page">
        <div class="ep-auth-card">
          ${errorMessage ? `
            <div class="ep-alert-error">
              <span>⚠️</span>
              <div style="flex: 1;">${errorMessage}</div>
              <button id="ep-dismiss-error" style="background: none; border: none; color: #fca5a5; cursor: pointer; font-size: 1rem;">×</button>
            </div>
          ` : ''}

          ${!isSignUpMode ? `
            <!-- UNIFIED SIGN IN VIEW (Exact mockup style) -->
            <div class="ep-brand-header">
              <h1 class="ep-brand-title">
                <span class="ep-brand-dot"></span>
                EventPulse
              </h1>
              <p class="ep-brand-subtitle">
                Ek hi login page sabke liye. Role email se apne aap decide hota hai.
              </p>
            </div>

            <form id="ep-login-form">
              <div class="ep-form-group">
                <input 
                  type="email" 
                  id="ep-login-email" 
                  class="ep-input" 
                  placeholder="Email" 
                  value="${loginEmail}" 
                  required 
                  autocomplete="username"
                />
              </div>

              <div class="ep-form-group">
                <div class="ep-input-wrap">
                  <input 
                    type="${showPassword ? 'text' : 'password'}" 
                    id="ep-login-password" 
                    class="ep-input" 
                    placeholder="Password (preview me kuch bhi)" 
                    value="${loginPassword}" 
                    required 
                    autocomplete="current-password"
                  />
                  <button type="button" class="ep-input-toggle-btn" id="ep-btn-toggle-pwd" title="Toggle password visibility">
                    ${showPassword ? '👁️' : '🙈'}
                  </button>
                </div>
              </div>

              ${roleInfo ? `
                <div class="ep-role-indicator">
                  <span>✨ <strong>Detected Role:</strong> ${roleInfo.title}</span>
                  <span style="text-transform: uppercase; font-size: 0.7rem; font-weight: 800; background: #6366f1; color: #fff; padding: 2px 7px; border-radius: 4px;">
                    ${roleInfo.role}
                  </span>
                </div>
              ` : ''}

              <button type="submit" class="ep-btn-primary" id="ep-btn-submit" ${isLoading ? 'disabled' : ''}>
                ${isLoading ? '<div class="ep-spinner"></div> Signing in...' : 'Sign in'}
              </button>

              <button type="button" class="ep-btn-google" id="ep-btn-google" ${isLoading ? 'disabled' : ''}>
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                Continue with Google
              </button>
            </form>

            <!-- Quick Tap Demo Accounts -->
            <div class="ep-demo-box">
              <div class="ep-demo-title">
                <span>⚡ Demo accounts try karo (tap karo):</span>
              </div>
              <div class="ep-pills-wrap">
                <button type="button" class="ep-pill ${selectedDemoKey === 'vc@college.edu' ? 'active' : ''}" data-email="vc@college.edu" data-pwd="password123">
                  vc - vc@college.edu
                </button>
                <button type="button" class="ep-pill ${selectedDemoKey === 'kavita@college.edu' ? 'active' : ''}" data-email="kavita@college.edu" data-pwd="password123">
                  dean - kavita@college.edu
                </button>
                <button type="button" class="ep-pill ${selectedDemoKey === 'anwar@college.edu' ? 'active' : ''}" data-email="anwar@college.edu" data-pwd="password123">
                  hod - anwar@college.edu
                </button>
                <button type="button" class="ep-pill ${selectedDemoKey === 'pratik@college.edu' ? 'active' : ''}" data-email="pratik@college.edu" data-pwd="password123">
                  organizer - pratik@college.edu
                </button>
                <button type="button" class="ep-pill ${selectedDemoKey === 'admin@college.edu' ? 'active' : ''}" data-email="admin@college.edu" data-pwd="password123">
                  admin - admin@college.edu
                </button>
                <button type="button" class="ep-pill ${selectedDemoKey === 'rahul@college.edu' ? 'active' : ''}" data-email="rahul@college.edu" data-pwd="password123">
                  student - rahul@college.edu
                </button>
              </div>
              <p class="ep-demo-hint">
                Koi naya email daaloge to default me <strong>student</strong> banega.
              </p>
            </div>

            <!-- Footer: Only Students Need Registration -->
            <div class="ep-switch-box">
              Are you a new student?
              <button type="button" class="ep-link-btn" id="ep-btn-goto-signup">
                Create Student Account (Sign Up) →
              </button>
            </div>
          ` : `
            <!-- STUDENT REGISTRATION VIEW ("bass students ko need hai sign up ki") -->
            <div class="ep-brand-header">
              <button type="button" id="ep-btn-back-signin" class="ep-link-btn" style="display: inline-flex; align-items: center; gap: 0.35rem; margin-bottom: 0.85rem; font-size: 0.85rem;">
                ← Back to Unified Sign In
              </button>
              <h1 class="ep-brand-title">
                <span class="ep-brand-dot"></span>
                Student Registration
              </h1>
              <p class="ep-brand-subtitle">
                Only students need to create an account with their university PRN. Faculty and organizers log in directly.
              </p>
            </div>

            <form id="ep-signup-form">
              <div class="ep-form-group">
                <label class="ep-label">Full Student Name</label>
                <input 
                  type="text" 
                  id="ep-signup-name" 
                  class="ep-input" 
                  placeholder="e.g. Rahul Sharma" 
                  value="${signupData.name}" 
                  required 
                />
              </div>

              <div class="ep-grid-2">
                <div class="ep-form-group">
                  <label class="ep-label">University PRN / Roll No. (12 Chars)</label>
                  <input 
                    type="text" 
                    id="ep-signup-prn" 
                    class="ep-input" 
                    placeholder="e.g. SU2026CS0417" 
                    maxlength="12"
                    value="${signupData.prn}" 
                    style="text-transform: uppercase; font-family: monospace;"
                    required 
                  />
                </div>

                <div class="ep-form-group">
                  <label class="ep-label">Division / Class</label>
                  <input 
                    type="text" 
                    id="ep-signup-division" 
                    class="ep-input" 
                    placeholder="e.g. A, B, C" 
                    value="${signupData.division}" 
                    required 
                  />
                </div>
              </div>

              <div class="ep-grid-2">
                <div class="ep-form-group">
                  <label class="ep-label">Department / Branch</label>
                  <select id="ep-signup-department" class="ep-input ep-select" required>
                    <option value="Computer Science & Engineering" ${signupData.department === 'Computer Science & Engineering' ? 'selected' : ''}>Computer Science & Engg</option>
                    <option value="Information Technology" ${signupData.department === 'Information Technology' ? 'selected' : ''}>Information Technology</option>
                    <option value="AI & Data Science" ${signupData.department === 'AI & Data Science' ? 'selected' : ''}>AI & Data Science</option>
                    <option value="Integrated M.Tech (AIML)" ${signupData.department === 'Integrated M.Tech (AIML)' ? 'selected' : ''}>Integrated M.Tech (AIML)</option>
                    <option value="Electronics & Telecommunication" ${signupData.department === 'Electronics & Telecommunication' ? 'selected' : ''}>Electronics & Telecom</option>
                    <option value="Mechanical Engineering" ${signupData.department === 'Mechanical Engineering' ? 'selected' : ''}>Mechanical Engineering</option>
                    <option value="Civil Engineering" ${signupData.department === 'Civil Engineering' ? 'selected' : ''}>Civil Engineering</option>
                    <option value="MBA / MCA" ${signupData.department === 'MBA / MCA' ? 'selected' : ''}>MBA / MCA</option>
                  </select>
                </div>

                <div class="ep-form-group">
                  <label class="ep-label">Year of Study</label>
                  <select id="ep-signup-year" class="ep-input ep-select" required>
                    <option value="1st Year" ${signupData.year === '1st Year' ? 'selected' : ''}>1st Year</option>
                    <option value="2nd Year" ${signupData.year === '2nd Year' ? 'selected' : ''}>2nd Year</option>
                    <option value="3rd Year" ${signupData.year === '3rd Year' ? 'selected' : ''}>3rd Year</option>
                    <option value="4th Year" ${signupData.year === '4th Year' ? 'selected' : ''}>4th Year</option>
                    <option value="Post Graduate" ${signupData.year === 'Post Graduate' ? 'selected' : ''}>Post Graduate</option>
                  </select>
                </div>
              </div>

              <div class="ep-form-group">
                <label class="ep-label">Email Address</label>
                <input 
                  type="email" 
                  id="ep-signup-email" 
                  class="ep-input" 
                  placeholder="name@college.edu or personal email" 
                  value="${signupData.email}" 
                  required 
                  autocomplete="username"
                />
              </div>

              <div class="ep-form-group">
                <label class="ep-label">Password (Min. 6 characters)</label>
                <div class="ep-input-wrap">
                  <input 
                    type="${showPassword ? 'text' : 'password'}" 
                    id="ep-signup-password" 
                    class="ep-input" 
                    placeholder="Create a secure password" 
                    minlength="6"
                    value="${signupData.password}" 
                    required 
                    autocomplete="new-password"
                  />
                  <button type="button" class="ep-input-toggle-btn" id="ep-btn-toggle-pwd">
                    ${showPassword ? '👁️' : '🙈'}
                  </button>
                </div>
              </div>

              <button type="submit" class="ep-btn-primary" id="ep-btn-submit-signup" ${isLoading ? 'disabled' : ''}>
                ${isLoading ? '<div class="ep-spinner"></div> Registering Student...' : 'Create Student Account'}
              </button>
            </form>

            <div class="ep-switch-box">
              Already have an account?
              <button type="button" class="ep-link-btn" id="ep-btn-goto-signin">
                Sign in directly →
              </button>
            </div>
          `}
        </div>
      </div>
    `;

    bindEvents();
  };

  const bindEvents = () => {
    // Dismiss error banner
    container.querySelector('#ep-dismiss-error')?.addEventListener('click', () => {
      errorMessage = '';
      render();
    });

    // Toggle Password visibility
    container.querySelector('#ep-btn-toggle-pwd')?.addEventListener('click', () => {
      showPassword = !showPassword;
      render();
    });

    if (!isSignUpMode) {
      // Input listener on email to dynamically display detected role
      const emailInput = container.querySelector('#ep-login-email');
      emailInput?.addEventListener('input', (e) => {
        loginEmail = e.target.value;
        const currentRole = detectRoleText(loginEmail);
        const existingIndicator = container.querySelector('.ep-role-indicator');
        if (currentRole && !existingIndicator) {
          render();
        } else if (!currentRole && existingIndicator) {
          render();
        }
      });

      // Quick tap demo accounts
      container.querySelectorAll('.ep-pill').forEach(pill => {
        pill.addEventListener('click', (e) => {
          const email = pill.getAttribute('data-email');
          const pwd = pill.getAttribute('data-pwd') || 'password123';
          loginEmail = email;
          loginPassword = pwd;
          selectedDemoKey = email;
          errorMessage = '';
          render();
        });
      });

      // Google sign-in
      container.querySelector('#ep-btn-google')?.addEventListener('click', async () => {
        isLoading = true;
        errorMessage = '';
        render();

        const res = await loginWithGoogle();
        isLoading = false;
        if (res.success) {
          if (res.user.role === 'admin' || isUserAdmin(res.user)) navigateTo('admin');
          else if (res.user.role === 'organizer') navigateTo('organizer');
          else navigateTo('events');
        } else {
          errorMessage = res.error || 'Failed to sign in with Google.';
          render();
        }
      });

      // Unified Sign In Form Submit
      container.querySelector('#ep-login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = container.querySelector('#ep-login-email')?.value.trim();
        const password = container.querySelector('#ep-login-password')?.value;

        if (!email || !password) {
          errorMessage = 'Please enter both email and password.';
          render();
          return;
        }

        isLoading = true;
        errorMessage = '';
        render();

        const res = await loginUser(email, password);
        isLoading = false;

        if (res.success) {
          if (res.user.role === 'admin' || isUserAdmin(res.user)) {
            navigateTo('admin');
          } else if (res.user.role === 'organizer') {
            navigateTo('organizer');
          } else {
            navigateTo('events');
          }
        } else {
          errorMessage = res.error || 'Login failed. Please check your credentials.';
          render();
        }
      });

      // Switch to Student Sign Up mode
      container.querySelector('#ep-btn-goto-signup')?.addEventListener('click', () => {
        isSignUpMode = true;
        errorMessage = '';
        render();
      });

    } else {
      // Back to Sign In
      container.querySelector('#ep-btn-back-signin')?.addEventListener('click', () => {
        isSignUpMode = false;
        errorMessage = '';
        render();
      });

      container.querySelector('#ep-btn-goto-signin')?.addEventListener('click', () => {
        isSignUpMode = false;
        errorMessage = '';
        render();
      });

      // Student Registration Form Submit
      container.querySelector('#ep-signup-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = container.querySelector('#ep-signup-name')?.value.trim();
        const prn = container.querySelector('#ep-signup-prn')?.value.trim().toUpperCase();
        const department = container.querySelector('#ep-signup-department')?.value;
        const year = container.querySelector('#ep-signup-year')?.value;
        const division = container.querySelector('#ep-signup-division')?.value.trim().toUpperCase();
        const email = container.querySelector('#ep-signup-email')?.value.trim();
        const password = container.querySelector('#ep-signup-password')?.value;

        signupData = { name, prn, department, year, division, email, password };

        if (!name || !prn || !email || !password) {
          errorMessage = 'Please fill out all required student fields.';
          render();
          return;
        }

        if (prn.length !== 12) {
          errorMessage = `Student PRN must be exactly 12 characters (Current length: ${prn.length}). Example: SU2026CS0417`;
          render();
          return;
        }

        isLoading = true;
        errorMessage = '';
        render();

        const res = await registerStudent({
          name,
          prn,
          department,
          year,
          division,
          email,
          password
        });

        isLoading = false;

        if (res.success) {
          navigateTo('events');
        } else {
          errorMessage = res.error || 'Registration failed. Please check your inputs.';
          render();
        }
      });
    }
  };

  render();
}
