import { 
  loginUser, 
  registerStudent, 
  loginWithGoogle, 
  sendPasswordReset,
  isDemoModeEnabled, 
  DEMO_ACCOUNTS, 
  isUserAdmin 
} from '../services/auth';
import { getRoleDefaultRoute } from '../router';

export function renderLoginView(container, navigateTo) {
  let activeTab = 'signin'; // 'signin' | 'signup'
  let showLoginPassword = false;
  let showSignupPassword = false;
  let isLoading = false;
  let errorMessage = '';
  let successMessage = '';
  let showForgotModal = false;
  let forgotEmail = '';

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

  const allowedDomain = (import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN || '').trim().toLowerCase();
  const demoModeActive = isDemoModeEnabled();

  // Password strength calculator
  function computePasswordStrength(pwd) {
    if (!pwd) return { score: 0, label: 'Empty', color: '#64748b', percent: 0, checks: { length: false, upper: false, number: false, symbol: false } };
    
    const checks = {
      length: pwd.length >= 8,
      upper: /[A-Z]/.test(pwd) && /[a-z]/.test(pwd),
      number: /[0-9]/.test(pwd),
      symbol: /[^A-Za-z0-9]/.test(pwd)
    };

    let score = 0;
    if (checks.length) score++;
    if (checks.upper) score++;
    if (checks.number) score++;
    if (checks.symbol) score++;

    let label = 'Weak';
    let color = '#ef4444';
    let percent = 25;

    if (score === 2) {
      label = 'Fair';
      color = '#f59e0b';
      percent = 50;
    } else if (score === 3) {
      label = 'Good';
      color = '#3b82f6';
      percent = 75;
    } else if (score === 4) {
      label = 'Strong';
      color = '#10b981';
      percent = 100;
    }

    return { score, label, color, percent, checks };
  }

  const render = () => {
    const strength = computePasswordStrength(signupData.password);

    container.innerHTML = `
      <style>
        .ep-auth-page {
          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem 1rem;
          background: #090d16;
          background-image: 
            radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.16) 0px, transparent 50%),
            radial-gradient(at 100% 100%, rgba(124, 58, 237, 0.14) 0px, transparent 50%),
            radial-gradient(at 50% 50%, rgba(15, 23, 42, 0.8) 0px, transparent 100%);
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #f8fafc;
          box-sizing: border-box;
        }

        .ep-auth-card {
          width: 100%;
          max-width: ${activeTab === 'signup' ? '580px' : '470px'};
          background: #111827;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 2.25rem 2rem;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px rgba(99, 102, 241, 0.08);
          transition: max-width 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          box-sizing: border-box;
          position: relative;
        }

        @media (max-width: 480px) {
          .ep-auth-card {
            padding: 1.75rem 1.25rem;
            border-radius: 16px;
          }
        }

        .ep-brand-header {
          text-align: center;
          margin-bottom: 1.5rem;
        }

        .ep-brand-title {
          font-size: 1.85rem;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: -0.025em;
          margin: 0 0 0.35rem 0;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
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
          font-size: 0.925rem;
          line-height: 1.45;
          color: #94a3b8;
          margin: 0;
        }

        /* Modern Tabs Header */
        .ep-tabs-nav {
          display: flex;
          background: #0f172a;
          border: 1px solid #1e293b;
          border-radius: 12px;
          padding: 4px;
          margin-bottom: 1.5rem;
          gap: 4px;
        }

        .ep-tab-btn {
          flex: 1;
          background: transparent;
          border: none;
          color: #94a3b8;
          padding: 9px 12px;
          font-size: 0.875rem;
          font-weight: 700;
          font-family: inherit;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.18s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
        }

        .ep-tab-btn.active {
          background: #1e293b;
          color: #ffffff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.25);
        }

        .ep-form-group {
          margin-bottom: 1.1rem;
        }

        .ep-label {
          display: block;
          font-size: 0.775rem;
          font-weight: 700;
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
          padding: 12px 14px;
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
          right: 10px;
          background: transparent;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          font-size: 0.9rem;
          padding: 4px;
          border-radius: 6px;
        }
        .ep-input-toggle-btn:hover {
          color: #ffffff;
        }

        .ep-btn-primary {
          width: 100%;
          background: #6366f1;
          color: #ffffff;
          border: none;
          border-radius: 10px;
          padding: 12px 16px;
          font-size: 0.975rem;
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
          padding: 11px 16px;
          font-size: 0.925rem;
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

        /* Password Strength UI */
        .ep-strength-meter {
          margin-top: 0.4rem;
        }
        .ep-strength-bar {
          height: 4px;
          width: 100%;
          background: #334155;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 0.35rem;
        }
        .ep-strength-fill {
          height: 100%;
          transition: width 0.3s ease, background 0.3s ease;
        }
        .ep-strength-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
          color: #94a3b8;
        }

        /* Demo Mode Box */
        .ep-demo-box {
          margin-top: 1.35rem;
          background: #0f172a;
          border: 1px dashed #6366f1;
          border-radius: 14px;
          padding: 1rem;
        }

        .ep-demo-title {
          font-size: 0.8rem;
          font-weight: 700;
          color: #818cf8;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.65rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .ep-demo-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
          gap: 0.5rem;
          margin-bottom: 0.65rem;
        }

        .ep-demo-btn {
          background: rgba(30, 41, 59, 0.9);
          border: 1px solid #334155;
          color: #e2e8f0;
          border-radius: 8px;
          padding: 7px 10px;
          font-size: 0.775rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: left;
          display: flex;
          flex-direction: column;
        }

        .ep-demo-btn:hover {
          border-color: #6366f1;
          color: #ffffff;
          background: #1e293b;
          transform: translateY(-1px);
        }

        .ep-demo-btn small {
          font-size: 0.65rem;
          color: #94a3b8;
        }

        .ep-grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.85rem;
        }

        @media (max-width: 520px) {
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
          background: rgba(239, 68, 68, 0.14);
          border: 1px solid rgba(239, 68, 68, 0.4);
          color: #fca5a5;
          padding: 0.75rem 1rem;
          border-radius: 10px;
          font-size: 0.85rem;
          margin-bottom: 1.25rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .ep-alert-success {
          background: rgba(16, 185, 129, 0.14);
          border: 1px solid rgba(16, 185, 129, 0.4);
          color: #6ee7b7;
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

        /* Modal Overlay */
        .ep-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          z-index: 9999;
        }
        .ep-modal-card {
          width: 100%;
          max-width: 420px;
          background: #111827;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 16px;
          padding: 1.75rem;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.8);
        }
      </style>

      <div class="ep-auth-page">
        <div class="ep-auth-card">
          <!-- Brand Header -->
          <div class="ep-brand-header">
            <h1 class="ep-brand-title">
              <span class="ep-brand-dot"></span>
              EventPulse
            </h1>
            <p class="ep-brand-subtitle">
              ${activeTab === 'signin' 
                ? 'Ek hi login page sabke liye. Role invite aur account se decide hota hai.'
                : 'Student account creation with university PRN verification.'}
            </p>
          </div>

          <!-- Tabs Navigation -->
          <div class="ep-tabs-nav">
            <button type="button" class="ep-tab-btn ${activeTab === 'signin' ? 'active' : ''}" id="tab-btn-signin">
              <span>🔐</span> Sign In
            </button>
            <button type="button" class="ep-tab-btn ${activeTab === 'signup' ? 'active' : ''}" id="tab-btn-signup">
              <span>👨‍🎓</span> Student Sign Up
            </button>
          </div>

          <!-- Alert Banners -->
          ${errorMessage ? `
            <div class="ep-alert-error">
              <span>⚠️</span>
              <div style="flex: 1;">${errorMessage}</div>
              <button id="ep-dismiss-error" style="background: none; border: none; color: #fca5a5; cursor: pointer; font-size: 1.1rem; line-height: 1;">×</button>
            </div>
          ` : ''}

          ${successMessage ? `
            <div class="ep-alert-success">
              <span>✅</span>
              <div style="flex: 1;">${successMessage}</div>
              <button id="ep-dismiss-success" style="background: none; border: none; color: #6ee7b7; cursor: pointer; font-size: 1.1rem; line-height: 1;">×</button>
            </div>
          ` : ''}

          ${activeTab === 'signin' ? `
            <!-- TAB 1: UNIFIED SIGN IN -->
            <form id="ep-login-form">
              <div class="ep-form-group">
                <label class="ep-label">Email Address</label>
                <input 
                  type="email" 
                  id="ep-login-email" 
                  class="ep-input" 
                  placeholder="name@college.edu" 
                  value="${loginEmail}" 
                  required 
                  autocomplete="username"
                />
              </div>

              <div class="ep-form-group">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                  <label class="ep-label" style="margin-bottom: 0;">Password</label>
                  <button type="button" id="ep-btn-forgot" style="background: none; border: none; color: #818cf8; font-size: 0.775rem; font-weight: 600; cursor: pointer; padding: 0;">
                    Forgot Password?
                  </button>
                </div>
                <div class="ep-input-wrap">
                  <input 
                    type="${showLoginPassword ? 'text' : 'password'}" 
                    id="ep-login-password" 
                    class="ep-input" 
                    placeholder="Enter your password" 
                    value="${loginPassword}" 
                    required 
                    autocomplete="current-password"
                  />
                  <button type="button" class="ep-input-toggle-btn" id="ep-btn-toggle-login-pwd" title="Toggle password visibility">
                    ${showLoginPassword ? '👁️' : '🙈'}
                  </button>
                </div>
              </div>

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

            <!-- DEMO MODE SECTION (Only rendered when VITE_DEMO_MODE=true) -->
            ${demoModeActive ? `
              <div class="ep-demo-box">
                <div class="ep-demo-title">
                  <span>⚡ Try Demo Accounts</span>
                  <span style="font-size: 0.65rem; background: #3730a3; color: #c7d2fe; padding: 2px 6px; border-radius: 4px;">VITE_DEMO_MODE=true</span>
                </div>
                <div class="ep-demo-grid">
                  <button type="button" class="ep-demo-btn" data-email="student@college.edu">
                    <span>👨‍🎓 Student</span>
                    <small>student@college.edu</small>
                  </button>
                  <button type="button" class="ep-demo-btn" data-email="organizer@college.edu">
                    <span>⚡ Organizer</span>
                    <small>organizer@college.edu</small>
                  </button>
                  <button type="button" class="ep-demo-btn" data-email="hod@college.edu">
                    <span>📚 HOD</span>
                    <small>hod@college.edu</small>
                  </button>
                  <button type="button" class="ep-demo-btn" data-email="dean@college.edu">
                    <span>🎓 Dean</span>
                    <small>dean@college.edu</small>
                  </button>
                  <button type="button" class="ep-demo-btn" data-email="vc@college.edu">
                    <span>👑 VC</span>
                    <small>vc@college.edu</small>
                  </button>
                  <button type="button" class="ep-demo-btn" data-email="admin@college.edu">
                    <span>🛡️ Admin</span>
                    <small>admin@college.edu</small>
                  </button>
                </div>
                <div style="font-size: 0.725rem; color: #94a3b8; text-align: center;">
                  Tap any card for 1-click preview authentication
                </div>
              </div>
            ` : ''}

            <div style="margin-top: 1.5rem; text-align: center; font-size: 0.85rem; color: #64748b;">
              Staff (Organizer, HOD, Dean, VC, Admin) are provisioned via Admin Invites.
            </div>
          ` : `
            <!-- TAB 2: STUDENT SIGN UP -->
            <form id="ep-signup-form">
              <div class="ep-form-group">
                <label class="ep-label">Student Full Name</label>
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
                  <label class="ep-label">College PRN / Roll No.</label>
                  <input 
                    type="text" 
                    id="ep-signup-prn" 
                    class="ep-input" 
                    placeholder="e.g. SU2026CS0417" 
                    maxlength="16"
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
                  <label class="ep-label">Department</label>
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
                <label class="ep-label">
                  University / College Email
                  ${allowedDomain ? `<span style="color: #818cf8; text-transform: none;">(@${allowedDomain})</span>` : ''}
                </label>
                <input 
                  type="email" 
                  id="ep-signup-email" 
                  class="ep-input" 
                  placeholder="${allowedDomain ? `student@${allowedDomain}` : 'student@college.edu'}" 
                  value="${signupData.email}" 
                  required 
                  autocomplete="username"
                />
              </div>

              <div class="ep-form-group">
                <label class="ep-label">Password</label>
                <div class="ep-input-wrap">
                  <input 
                    type="${showSignupPassword ? 'text' : 'password'}" 
                    id="ep-signup-password" 
                    class="ep-input" 
                    placeholder="Create a strong password" 
                    minlength="6"
                    value="${signupData.password}" 
                    required 
                    autocomplete="new-password"
                  />
                  <button type="button" class="ep-input-toggle-btn" id="ep-btn-toggle-signup-pwd">
                    ${showSignupPassword ? '👁️' : '🙈'}
                  </button>
                </div>

                <!-- Password Strength Meter -->
                ${signupData.password ? `
                  <div class="ep-strength-meter">
                    <div class="ep-strength-bar">
                      <div class="ep-strength-fill" style="width: ${strength.percent}%; background: ${strength.color};"></div>
                    </div>
                    <div class="ep-strength-row">
                      <span>Strength: <strong style="color: ${strength.color};">${strength.label}</strong></span>
                      <span>${strength.score}/4 criteria</span>
                    </div>
                  </div>
                ` : ''}
              </div>

              <button type="submit" class="ep-btn-primary" id="ep-btn-submit-signup" ${isLoading ? 'disabled' : ''}>
                ${isLoading ? '<div class="ep-spinner"></div> Creating Student Account...' : 'Complete Student Registration'}
              </button>

              <div style="margin-top: 1rem; text-align: center; font-size: 0.775rem; color: #94a3b8;">
                ✉️ A verification email will be automatically sent to verify your college address.
              </div>
            </form>
          `}
        </div>

        <!-- Forgot Password Modal -->
        ${showForgotModal ? `
          <div class="ep-modal-backdrop" id="forgot-modal-backdrop">
            <div class="ep-modal-card">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3 style="margin: 0; font-size: 1.25rem; font-weight: 700; color: #ffffff;">Reset Password</h3>
                <button type="button" id="btn-close-forgot" style="background: none; border: none; color: #94a3b8; font-size: 1.25rem; cursor: pointer;">×</button>
              </div>
              <p style="font-size: 0.85rem; color: #94a3b8; margin: 0 0 1.25rem 0;">
                Enter your registered university email. We will send a secure password reset link to your inbox.
              </p>
              <div class="ep-form-group">
                <label class="ep-label">Registered Email</label>
                <input type="email" id="input-forgot-email" class="ep-input" placeholder="name@college.edu" value="${forgotEmail}" required />
              </div>
              <div style="display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1.5rem;">
                <button type="button" id="btn-cancel-forgot" class="btn btn-outline" style="border-radius: 8px;">Cancel</button>
                <button type="button" id="btn-submit-forgot" class="ep-btn-primary" style="width: auto; padding: 10px 18px; border-radius: 8px;">Send Reset Link</button>
              </div>
            </div>
          </div>
        ` : ''}
      </div>
    `;

    bindEvents();
  };

  const bindEvents = () => {
    // Dismiss alert banners
    container.querySelector('#ep-dismiss-error')?.addEventListener('click', () => {
      errorMessage = '';
      render();
    });
    container.querySelector('#ep-dismiss-success')?.addEventListener('click', () => {
      successMessage = '';
      render();
    });

    // Tab buttons
    container.querySelector('#tab-btn-signin')?.addEventListener('click', () => {
      activeTab = 'signin';
      errorMessage = '';
      render();
    });
    container.querySelector('#tab-btn-signup')?.addEventListener('click', () => {
      activeTab = 'signup';
      errorMessage = '';
      render();
    });

    // Toggle Password Visibility
    container.querySelector('#ep-btn-toggle-login-pwd')?.addEventListener('click', () => {
      showLoginPassword = !showLoginPassword;
      render();
    });
    container.querySelector('#ep-btn-toggle-signup-pwd')?.addEventListener('click', () => {
      showSignupPassword = !showSignupPassword;
      render();
    });

    // Forgot password modal
    container.querySelector('#ep-btn-forgot')?.addEventListener('click', () => {
      forgotEmail = loginEmail;
      showForgotModal = true;
      render();
    });
    container.querySelector('#btn-close-forgot')?.addEventListener('click', () => {
      showForgotModal = false;
      render();
    });
    container.querySelector('#btn-cancel-forgot')?.addEventListener('click', () => {
      showForgotModal = false;
      render();
    });
    container.querySelector('#btn-submit-forgot')?.addEventListener('click', async () => {
      const email = container.querySelector('#input-forgot-email')?.value.trim();
      if (!email) {
        alert('Please enter your registered email address.');
        return;
      }
      const res = await sendPasswordReset(email);
      showForgotModal = false;
      if (res.success) {
        successMessage = `Password reset email sent to ${email}. Please check your inbox.`;
      } else {
        errorMessage = res.error || 'Failed to send password reset email.';
      }
      render();
    });

    if (activeTab === 'signin') {
      // Demo buttons (rendered only if VITE_DEMO_MODE=true)
      container.querySelectorAll('.ep-demo-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const email = btn.getAttribute('data-email');
          isLoading = true;
          errorMessage = '';
          render();

          const res = await loginUser(email, 'Password@123');
          isLoading = false;
          if (res.success) {
            navigateTo(getRoleDefaultRoute(res.user.role));
          } else {
            errorMessage = res.error || 'Failed to log into demo account.';
            render();
          }
        });
      });

      // Google Sign-In
      container.querySelector('#ep-btn-google')?.addEventListener('click', async () => {
        isLoading = true;
        errorMessage = '';
        render();

        const res = await loginWithGoogle();
        isLoading = false;
        if (res.success) {
          navigateTo(getRoleDefaultRoute(res.user.role));
        } else {
          errorMessage = res.error || 'Google sign in failed.';
          render();
        }
      });

      // Unified Sign In Submit
      container.querySelector('#ep-login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = container.querySelector('#ep-login-email')?.value.trim();
        const password = container.querySelector('#ep-login-password')?.value;

        loginEmail = email;
        loginPassword = password;

        if (!email || !password) {
          errorMessage = 'Please provide both email and password.';
          render();
          return;
        }

        isLoading = true;
        errorMessage = '';
        render();

        const res = await loginUser(email, password);
        isLoading = false;

        if (res.success) {
          navigateTo(getRoleDefaultRoute(res.user.role));
        } else {
          errorMessage = res.error || 'Invalid email or password.';
          render();
        }
      });

    } else {
      // Real-time password strength listener
      const pwdInput = container.querySelector('#ep-signup-password');
      pwdInput?.addEventListener('input', (e) => {
        signupData.password = e.target.value;
        const bar = container.querySelector('.ep-strength-fill');
        const st = computePasswordStrength(signupData.password);
        if (bar) {
          bar.style.width = st.percent + '%';
          bar.style.background = st.color;
        }
      });

      // Student Sign Up Submit
      container.querySelector('#ep-signup-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = container.querySelector('#ep-signup-name')?.value.trim();
        const prn = container.querySelector('#ep-signup-prn')?.value.trim().toUpperCase();
        const department = container.querySelector('#ep-signup-department')?.value;
        const year = container.querySelector('#ep-signup-year')?.value;
        const division = container.querySelector('#ep-signup-division')?.value.trim().toUpperCase();
        const email = container.querySelector('#ep-signup-email')?.value.trim().toLowerCase();
        const password = container.querySelector('#ep-signup-password')?.value;

        signupData = { name, prn, department, year, division, email, password };

        if (!name || !prn || !email || !password) {
          errorMessage = 'All fields are required for student onboarding.';
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
          errorMessage = res.error || 'Registration failed. Please check your details.';
          render();
        }
      });
    }
  };

  render();
}
