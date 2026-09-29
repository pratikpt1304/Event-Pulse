import { 
  loginUser, 
  registerStudent, 
  sendPasswordReset,
  isDemoModeEnabled 
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
    if (!pwd) return { score: 0, label: 'Empty', color: '#64748b', percent: 0 };
    
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

    return { score, label, color, percent };
  }

  const render = () => {
    const strength = computePasswordStrength(signupData.password);

    container.innerHTML = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@600;700&display=swap');

        /* ── ROOT CONTAINER (Full bleed, viewport-centered) ── */
        .ep-auth-page {
          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.25rem 1rem;
          background: 
            radial-gradient(circle at 10% 15%, rgba(99, 102, 241, 0.15) 0%, transparent 45%),
            radial-gradient(circle at 90% 85%, rgba(139, 92, 246, 0.12) 0%, transparent 50%),
            radial-gradient(circle at 50% 50%, rgba(15, 23, 42, 0.6) 0%, transparent 100%),
            #060b17;
          font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
          color: #f1f5f9;
          box-sizing: border-box;
          overflow-x: hidden;
        }

        /* ── COMPACT MAIN CARD FRAME ── */
        .ep-card-frame {
          width: 100%;
          max-width: 980px;
          min-height: 560px;
          background: rgba(11, 19, 38, 0.82);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 
            0 20px 50px -10px rgba(0, 0, 0, 0.75),
            0 0 0 1px rgba(99, 102, 241, 0.15) inset;
          border-radius: 22px;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          display: flex;
          overflow: hidden;
          position: relative;
          z-index: 10;
        }

        /* ── LEFT BRAND PANEL ── */
        .ep-brand-col {
          flex: 0 0 42%;
          background: linear-gradient(160deg, rgba(20, 32, 65, 0.7) 0%, rgba(10, 16, 32, 0.95) 100%);
          border-right: 1px solid rgba(255, 255, 255, 0.06);
          padding: 2.25rem 2rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
          overflow: hidden;
        }

        .ep-brand-col::before {
          content: '';
          position: absolute;
          top: -60px;
          left: -40px;
          width: 240px;
          height: 240px;
          background: radial-gradient(circle, rgba(99, 102, 241, 0.25) 0%, transparent 70%);
          pointer-events: none;
        }

        .ep-brand-col::after {
          content: '';
          position: absolute;
          inset: 0;
          background-image: 
            linear-gradient(rgba(99, 102, 241, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99, 102, 241, 0.05) 1px, transparent 1px);
          background-size: 32px 32px;
          pointer-events: none;
        }

        .ep-brand-content {
          position: relative;
          z-index: 2;
        }

        .ep-brand-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 4px 10px;
          background: rgba(99, 102, 241, 0.12);
          border: 1px solid rgba(99, 102, 241, 0.28);
          border-radius: 999px;
          font-size: 0.72rem;
          font-weight: 700;
          color: #a5b4fc;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin-bottom: 1.5rem;
        }

        .ep-badge-pulse {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 8px #10b981;
          display: inline-block;
        }

        .ep-logo-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1.5rem;
        }

        .ep-logo-icon {
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border-radius: 11px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.25rem;
          box-shadow: 0 0 16px rgba(99, 102, 241, 0.5);
          flex-shrink: 0;
        }

        .ep-logo-title {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 1.5rem;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: #ffffff;
          line-height: 1;
        }

        .ep-logo-title span {
          color: #818cf8;
        }

        .ep-brand-heading {
          font-size: 1.65rem;
          font-weight: 800;
          line-height: 1.2;
          letter-spacing: -0.025em;
          color: #ffffff;
          margin-bottom: 0.65rem;
        }

        .ep-gradient-text {
          background: linear-gradient(135deg, #818cf8 0%, #c084fc 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .ep-brand-desc {
          font-size: 0.85rem;
          color: #94a3b8;
          line-height: 1.55;
          margin-bottom: 1.5rem;
        }

        /* Feature Pills */
        .ep-feature-stack {
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
        }

        .ep-feature-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 8px 12px;
          background: rgba(15, 23, 42, 0.55);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }

        .ep-feat-icon {
          font-size: 1.05rem;
          width: 28px;
          text-align: center;
        }

        .ep-feat-text {
          font-size: 0.78rem;
          font-weight: 600;
          color: #e2e8f0;
          line-height: 1.25;
        }

        .ep-feat-text small {
          display: block;
          font-size: 0.7rem;
          font-weight: 400;
          color: #64748b;
        }

        .ep-brand-footer {
          position: relative;
          z-index: 2;
          padding-top: 1rem;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          font-size: 0.72rem;
          color: #475569;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        /* ── RIGHT FORM PANEL ── */
        .ep-form-col {
          flex: 1;
          padding: 2rem 2.25rem;
          display: flex;
          flex-direction: column;
          justify-content: center;
          background: #090f1d;
          overflow-y: auto;
          max-height: 90vh;
        }

        /* Top Segmented Tab Switch */
        .ep-tab-switch {
          display: flex;
          background: #0d1527;
          border: 1px solid #1a253d;
          border-radius: 12px;
          padding: 4px;
          margin-bottom: 1.25rem;
          gap: 4px;
        }

        .ep-tab-item {
          flex: 1;
          background: transparent;
          border: none;
          color: #64748b;
          padding: 8px 12px;
          font-size: 0.82rem;
          font-weight: 700;
          font-family: inherit;
          border-radius: 9px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.45rem;
        }

        .ep-tab-item.active {
          background: linear-gradient(135deg, #1f2b48 0%, #151d32 100%);
          color: #ffffff;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(99, 102, 241, 0.3) inset;
        }

        /* Form Title / Subtitle */
        .ep-form-heading {
          margin-bottom: 1.15rem;
        }

        .ep-form-title {
          font-size: 1.35rem;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: -0.02em;
          margin: 0 0 3px 0;
        }

        .ep-form-sub {
          font-size: 0.8rem;
          color: #64748b;
          margin: 0;
        }

        /* Input Controls */
        .ep-field {
          margin-bottom: 0.85rem;
        }

        .ep-field-label-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }

        .ep-label {
          font-size: 0.74rem;
          font-weight: 600;
          color: #94a3b8;
          display: block;
        }

        .ep-link-btn {
          background: none;
          border: none;
          color: #818cf8;
          font-size: 0.73rem;
          font-weight: 600;
          cursor: pointer;
          padding: 0;
          font-family: inherit;
          transition: color 0.15s;
        }

        .ep-link-btn:hover {
          color: #a5b4fc;
          text-decoration: underline;
        }

        .ep-input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .ep-input-field {
          width: 100%;
          background: #0d1527;
          border: 1px solid #1e293b;
          border-radius: 10px;
          padding: 8px 12px;
          height: 38px;
          color: #ffffff;
          font-size: 0.85rem;
          font-family: inherit;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }

        .ep-input-field:focus {
          border-color: #6366f1;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
          background: #0f1930;
        }

        .ep-input-field::placeholder {
          color: #475569;
          font-size: 0.82rem;
        }

        .ep-eye-btn {
          position: absolute;
          right: 8px;
          background: transparent;
          border: none;
          color: #64748b;
          cursor: pointer;
          font-size: 0.95rem;
          padding: 4px 6px;
          border-radius: 6px;
          line-height: 1;
        }

        .ep-eye-btn:hover {
          color: #cbd5e1;
        }

        /* 2-column Compact Grid for Sign Up */
        .ep-grid-2col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }

        .ep-select-field {
          appearance: none;
          background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
          background-repeat: no-repeat;
          background-position: right 10px center;
          background-size: 14px;
          padding-right: 30px;
          cursor: pointer;
        }

        /* Primary Submit Button */
        .ep-submit-btn {
          width: 100%;
          height: 40px;
          background: linear-gradient(135deg, #6366f1 0%, #7c3aed 100%);
          color: #ffffff;
          border: none;
          border-radius: 10px;
          font-size: 0.88rem;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          margin-top: 0.35rem;
          box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
          transition: transform 0.15s, box-shadow 0.15s;
        }

        .ep-submit-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(99, 102, 241, 0.55);
        }

        .ep-submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .ep-submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Password Strength Bar */
        .ep-strength-track {
          height: 3px;
          width: 100%;
          background: #1e293b;
          border-radius: 3px;
          overflow: hidden;
          margin-top: 4px;
        }

        .ep-strength-fill {
          height: 100%;
          transition: width 0.25s, background 0.25s;
        }

        .ep-strength-label {
          display: flex;
          justify-content: space-between;
          font-size: 0.68rem;
          color: #64748b;
          margin-top: 3px;
        }

        /* Alert Notifications */
        .ep-banner-alert {
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 0.8rem;
          margin-bottom: 0.85rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          line-height: 1.4;
        }

        .ep-banner-alert.error {
          background: rgba(239, 68, 68, 0.12);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fca5a5;
        }

        .ep-banner-alert.success {
          background: rgba(16, 185, 129, 0.12);
          border: 1px solid rgba(16, 185, 129, 0.3);
          color: #6ee7b7;
        }

        .ep-banner-close {
          background: none;
          border: none;
          color: inherit;
          font-size: 1.1rem;
          cursor: pointer;
          margin-left: auto;
          line-height: 1;
        }

        /* ── ULTRA-COMPACT 1-CLICK DEMO SECTION ── */
        .ep-demo-container {
          margin-top: 1rem;
          background: rgba(13, 21, 39, 0.95);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: 12px;
          padding: 10px 12px;
        }

        .ep-demo-top-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .ep-demo-legend {
          font-size: 0.72rem;
          font-weight: 700;
          color: #818cf8;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .ep-demo-chip {
          font-size: 0.6rem;
          font-weight: 700;
          background: rgba(99, 102, 241, 0.2);
          color: #c7d2fe;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .ep-demo-grid-compact {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
        }

        .ep-demo-chip-btn {
          background: #111a2f;
          border: 1px solid #1f2b45;
          color: #e2e8f0;
          border-radius: 8px;
          padding: 6px 8px;
          font-size: 0.74rem;
          font-family: inherit;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 6px;
          transition: all 0.15s ease;
          text-align: left;
        }

        .ep-demo-chip-btn:hover {
          background: #182542;
          border-color: #6366f1;
          transform: translateY(-1px);
          box-shadow: 0 3px 10px rgba(99, 102, 241, 0.25);
        }

        .ep-demo-chip-btn .role-icon {
          font-size: 0.95rem;
          flex-shrink: 0;
        }

        .ep-demo-chip-btn .role-meta {
          display: flex;
          flex-direction: column;
          overflow: hidden;
          line-height: 1.15;
        }

        .ep-demo-chip-btn .role-title {
          font-weight: 700;
          color: #f1f5f9;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ep-demo-chip-btn .role-sub {
          font-size: 0.62rem;
          color: #64748b;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ep-demo-footer-note {
          font-size: 0.67rem;
          color: #475569;
          text-align: center;
          margin-top: 6px;
        }

        /* ── MODAL (Forgot Password) ── */
        .ep-modal-mask {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          z-index: 9999;
        }

        .ep-modal-box {
          width: 100%;
          max-width: 390px;
          background: #0e1526;
          border: 1px solid #1e293b;
          border-radius: 16px;
          padding: 1.5rem;
          box-shadow: 0 25px 50px rgba(0,0,0,0.8);
        }

        .ep-modal-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: #ffffff;
          margin: 0 0 6px 0;
        }

        .ep-modal-p {
          font-size: 0.8rem;
          color: #64748b;
          line-height: 1.45;
          margin: 0 0 1rem 0;
        }

        .ep-modal-btns {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 1.25rem;
        }

        .ep-btn-subtle {
          background: #1e293b;
          border: none;
          color: #94a3b8;
          border-radius: 8px;
          padding: 8px 14px;
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
        }

        /* Spinner */
        .ep-loader {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: ep-spin 0.6s linear infinite;
        }

        @keyframes ep-spin {
          to { transform: rotate(360deg); }
        }

        /* ── RESPONSIVE DESIGN (< 880px) ── */
        @media (max-width: 880px) {
          .ep-card-frame {
            flex-direction: column;
            max-width: 480px;
            min-height: auto;
          }

          .ep-brand-col {
            flex: none;
            padding: 1.5rem 1.5rem 1.25rem;
            border-right: none;
            border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          }

          .ep-brand-heading,
          .ep-feature-stack,
          .ep-brand-desc,
          .ep-brand-footer {
            display: none;
          }

          .ep-logo-header {
            margin-bottom: 0;
          }

          .ep-form-col {
            padding: 1.5rem;
          }
        }

        @media (max-width: 480px) {
          .ep-auth-page {
            padding: 0.5rem;
          }

          .ep-demo-grid-compact {
            grid-template-columns: repeat(2, 1fr);
          }

          .ep-grid-2col {
            grid-template-columns: 1fr;
            gap: 0;
          }
        }
      </style>

      <div class="ep-auth-page">
        <div class="ep-card-frame">

          <!-- ════════ LEFT BRAND PANEL ════════ -->
          <div class="ep-brand-col">
            <div class="ep-brand-content">
              <div class="ep-brand-badge">
                <span class="ep-badge-pulse"></span>
                Sanjivani University Portal
              </div>

              <div class="ep-logo-header">
                <div class="ep-logo-icon">⚡</div>
                <div class="ep-logo-title">Event<span>Pulse</span></div>
              </div>

              <h1 class="ep-brand-heading">
                Campus Events &amp;<br>
                <span class="ep-gradient-text">Leadership Hub</span>
              </h1>

              <p class="ep-brand-desc">
                Discover technical fests, download digital QR passes, and provide administrative oversight in one unified ecosystem.
              </p>

              <div class="ep-feature-stack">
                <div class="ep-feature-row">
                  <div class="ep-feat-icon">🎪</div>
                  <div class="ep-feat-text">
                    Smart Event Passes
                    <small>Real-time booking &amp; verified QR check-ins</small>
                  </div>
                </div>

                <div class="ep-feature-row">
                  <div class="ep-feat-icon">🏛️</div>
                  <div class="ep-feat-text">
                    Executive Oversight
                    <small>HOD, Dean &amp; VC Sir analytical dashboards</small>
                  </div>
                </div>

                <div class="ep-feature-row">
                  <div class="ep-feat-icon">🚨</div>
                  <div class="ep-feat-text">
                    DGRC Grievance Portal
                    <small>Transparent campus issue tracking &amp; resolution</small>
                  </div>
                </div>
              </div>
            </div>

            <div class="ep-brand-footer">
              <span>Faculty of Engg &amp; Technology</span>
              <span>• NAAC Aligned</span>
            </div>
          </div>

          <!-- ════════ RIGHT FORM PANEL ════════ -->
          <div class="ep-form-col">
            
            <!-- Segmented Switch Tab -->
            <div class="ep-tab-switch">
              <button type="button" class="ep-tab-item ${activeTab === 'signin' ? 'active' : ''}" id="tab-btn-signin">
                🔐 Sign In
              </button>
              <button type="button" class="ep-tab-item ${activeTab === 'signup' ? 'active' : ''}" id="tab-btn-signup">
                👨‍🎓 Student Sign Up
              </button>
            </div>

            <!-- Header -->
            <div class="ep-form-heading">
              <h2 class="ep-form-title">
                ${activeTab === 'signin' ? 'Welcome Back' : 'Student Registration'}
              </h2>
              <p class="ep-form-sub">
                ${activeTab === 'signin' 
                  ? 'Sign in to access your campus dashboard.' 
                  : 'Enter your PRN and institutional email to register.'}
              </p>
            </div>

            <!-- Banner Alerts -->
            ${errorMessage ? `
              <div class="ep-banner-alert error">
                <span>⚠️</span>
                <span>${errorMessage}</span>
                <button class="ep-banner-close" id="ep-dismiss-error">×</button>
              </div>
            ` : ''}

            ${successMessage ? `
              <div class="ep-banner-alert success">
                <span>✅</span>
                <span>${successMessage}</span>
                <button class="ep-banner-close" id="ep-dismiss-success">×</button>
              </div>
            ` : ''}

            <!-- ── SIGN IN TAB ── -->
            ${activeTab === 'signin' ? `
              <form id="ep-login-form">
                <div class="ep-field">
                  <label class="ep-label">University Email</label>
                  <div class="ep-input-wrapper">
                    <input
                      type="email"
                      id="ep-login-email"
                      class="ep-input-field"
                      placeholder="name@college.edu"
                      value="${loginEmail}"
                      required
                      autocomplete="username"
                    />
                  </div>
                </div>

                <div class="ep-field">
                  <div class="ep-field-label-row">
                    <label class="ep-label">Password</label>
                    <button type="button" class="ep-link-btn" id="ep-btn-forgot">Forgot?</button>
                  </div>
                  <div class="ep-input-wrapper">
                    <input
                      type="${showLoginPassword ? 'text' : 'password'}"
                      id="ep-login-password"
                      class="ep-input-field"
                      placeholder="••••••••"
                      value="${loginPassword}"
                      required
                      autocomplete="current-password"
                    />
                    <button type="button" class="ep-eye-btn" id="ep-btn-toggle-login-pwd" title="Toggle visibility">
                      ${showLoginPassword ? '👁️' : '🙈'}
                    </button>
                  </div>
                </div>

                <button type="submit" class="ep-submit-btn" id="ep-btn-submit" ${isLoading ? 'disabled' : ''}>
                  ${isLoading ? '<div class="ep-loader"></div> Signing in…' : 'Sign In to EventPulse →'}
                </button>
              </form>

              <!-- ── COMPACT 1-CLICK DEMO ACCOUNTS ── -->
              ${demoModeActive ? `
                <div class="ep-demo-container">
                  <div class="ep-demo-top-row">
                    <div class="ep-demo-legend">⚡ Quick Demo Logins</div>
                    <span class="ep-demo-chip">1-CLICK</span>
                  </div>

                  <div class="ep-demo-grid-compact">
                    <!-- 1. Student -->
                    <button type="button" class="ep-demo-chip-btn" data-email="student@college.edu" title="Sign in as Student">
                      <span class="role-icon">👨‍🎓</span>
                      <div class="role-meta">
                        <span class="role-title">Student</span>
                        <span class="role-sub">Rahul S.</span>
                      </div>
                    </button>

                    <!-- 2. Organizer -->
                    <button type="button" class="ep-demo-chip-btn" data-email="organizer@college.edu" title="Sign in as Organizer">
                      <span class="role-icon">⚡</span>
                      <div class="role-meta">
                        <span class="role-title">Organizer</span>
                        <span class="role-sub">Pratik T.</span>
                      </div>
                    </button>

                    <!-- 3. HOD -->
                    <button type="button" class="ep-demo-chip-btn" data-email="hod@college.edu" title="Sign in as HOD">
                      <span class="role-icon">📚</span>
                      <div class="role-meta">
                        <span class="role-title">HOD</span>
                        <span class="role-sub">IMTech Dept</span>
                      </div>
                    </button>

                    <!-- 4. Dean -->
                    <button type="button" class="ep-demo-chip-btn" data-email="dean@college.edu" title="Sign in as Dean">
                      <span class="role-icon">🎓</span>
                      <div class="role-meta">
                        <span class="role-title">Dean</span>
                        <span class="role-sub">Faculty Engg</span>
                      </div>
                    </button>

                    <!-- 5. VC Sir -->
                    <button type="button" class="ep-demo-chip-btn" data-email="vc@college.edu" title="Sign in as VC Sir">
                      <span class="role-icon">👑</span>
                      <div class="role-meta">
                        <span class="role-title">VC Sir</span>
                        <span class="role-sub">Vice Chancellor</span>
                      </div>
                    </button>

                    <!-- 6. Central Admin -->
                    <button type="button" class="ep-demo-chip-btn" data-email="admin@college.edu" title="Sign in as Central Admin">
                      <span class="role-icon">🛡️</span>
                      <div class="role-meta">
                        <span class="role-title">Admin</span>
                        <span class="role-sub">Superuser</span>
                      </div>
                    </button>
                  </div>
                  <div class="ep-demo-footer-note">Tap any role for instant access without password</div>
                </div>
              ` : ''}

            ` : `
              <!-- ── SIGN UP TAB (Compact 2-Column Grid) ── -->
              <form id="ep-signup-form">
                <div class="ep-grid-2col">
                  <div class="ep-field">
                    <label class="ep-label">Student Name</label>
                    <input
                      type="text"
                      id="ep-signup-name"
                      class="ep-input-field"
                      placeholder="Rahul Sharma"
                      value="${signupData.name}"
                      required
                    />
                  </div>

                  <div class="ep-field">
                    <label class="ep-label">College PRN</label>
                    <input
                      type="text"
                      id="ep-signup-prn"
                      class="ep-input-field"
                      placeholder="SU2026CS0417"
                      maxlength="16"
                      value="${signupData.prn}"
                      style="text-transform: uppercase; font-family: monospace;"
                      required
                    />
                  </div>
                </div>

                <div class="ep-grid-2col">
                  <div class="ep-field">
                    <label class="ep-label">Department</label>
                    <select id="ep-signup-department" class="ep-input-field ep-select-field" required>
                      <option value="Computer Science &amp; Engineering" ${signupData.department === 'Computer Science & Engineering' ? 'selected' : ''}>CSE</option>
                      <option value="Information Technology" ${signupData.department === 'Information Technology' ? 'selected' : ''}>Information Technology</option>
                      <option value="AI &amp; Data Science" ${signupData.department === 'AI & Data Science' ? 'selected' : ''}>AI &amp; Data Science</option>
                      <option value="Integrated M.Tech (AIML)" ${signupData.department === 'Integrated M.Tech (AIML)' ? 'selected' : ''}>Integrated M.Tech</option>
                      <option value="BBA" ${signupData.department === 'BBA' ? 'selected' : ''}>BBA</option>
                      <option value="Mechanical Engineering" ${signupData.department === 'Mechanical Engineering' ? 'selected' : ''}>Mechanical Engg.</option>
                      <option value="Cyber Security" ${signupData.department === 'Cyber Security' ? 'selected' : ''}>Cyber Security</option>
                      <option value="MBA / MCA" ${signupData.department === 'MBA / MCA' ? 'selected' : ''}>MBA / MCA</option>
                    </select>
                  </div>

                  <div class="ep-field">
                    <label class="ep-label">Year of Study</label>
                    <select id="ep-signup-year" class="ep-input-field ep-select-field" required>
                      <option value="1st Year" ${signupData.year === '1st Year' ? 'selected' : ''}>1st Year</option>
                      <option value="2nd Year" ${signupData.year === '2nd Year' ? 'selected' : ''}>2nd Year</option>
                      <option value="3rd Year" ${signupData.year === '3rd Year' ? 'selected' : ''}>3rd Year</option>
                      <option value="4th Year" ${signupData.year === '4th Year' ? 'selected' : ''}>4th Year</option>
                      <option value="Post Graduate" ${signupData.year === 'Post Graduate' ? 'selected' : ''}>Post Graduate</option>
                    </select>
                  </div>
                </div>

                <div class="ep-grid-2col">
                  <div class="ep-field">
                    <label class="ep-label">Division / Class</label>
                    <input
                      type="text"
                      id="ep-signup-division"
                      class="ep-input-field"
                      placeholder="e.g. A, B, C"
                      value="${signupData.division}"
                      required
                    />
                  </div>

                  <div class="ep-field">
                    <label class="ep-label">
                      Email ${allowedDomain ? `<span style="color: #818cf8; font-size: 0.68rem;">(@${allowedDomain})</span>` : ''}
                    </label>
                    <input
                      type="email"
                      id="ep-signup-email"
                      class="ep-input-field"
                      placeholder="${allowedDomain ? `student@${allowedDomain}` : 'student@college.edu'}"
                      value="${signupData.email}"
                      required
                      autocomplete="username"
                    />
                  </div>
                </div>

                <div class="ep-field">
                  <label class="ep-label">Create Password</label>
                  <div class="ep-input-wrapper">
                    <input
                      type="${showSignupPassword ? 'text' : 'password'}"
                      id="ep-signup-password"
                      class="ep-input-field"
                      placeholder="Minimum 8 characters"
                      minlength="6"
                      value="${signupData.password}"
                      required
                      autocomplete="new-password"
                    />
                    <button type="button" class="ep-eye-btn" id="ep-btn-toggle-signup-pwd">
                      ${showSignupPassword ? '👁️' : '🙈'}
                    </button>
                  </div>
                  ${signupData.password ? `
                    <div class="ep-strength-track">
                      <div class="ep-strength-fill" style="width: ${strength.percent}%; background: ${strength.color};"></div>
                    </div>
                    <div class="ep-strength-label">
                      <span>Strength: <strong style="color: ${strength.color};">${strength.label}</strong></span>
                      <span>${strength.score}/4 criteria</span>
                    </div>
                  ` : ''}
                </div>

                <button type="submit" class="ep-submit-btn" id="ep-btn-submit-signup" ${isLoading ? 'disabled' : ''}>
                  ${isLoading ? '<div class="ep-loader"></div> Creating Account…' : 'Complete Registration →'}
                </button>
              </form>
            `}

          </div>
        </div>

        <!-- ═══ Forgot Password Modal ═══ -->
        ${showForgotModal ? `
          <div class="ep-modal-mask" id="forgot-modal-backdrop">
            <div class="ep-modal-box">
              <h3 class="ep-modal-title">🔑 Reset Password</h3>
              <p class="ep-modal-p">
                Enter your registered university email to receive a password reset link.
              </p>
              <div class="ep-field">
                <label class="ep-label">Registered Email</label>
                <input type="email" id="input-forgot-email" class="ep-input-field" placeholder="name@college.edu" value="${forgotEmail}" required />
              </div>
              <div class="ep-modal-btns">
                <button type="button" class="ep-btn-subtle" id="btn-cancel-forgot">Cancel</button>
                <button type="button" class="ep-submit-btn" id="btn-submit-forgot" style="width: auto; height: 36px; padding: 0 16px; margin: 0;">Send Link</button>
              </div>
            </div>
          </div>
        ` : ''}

      </div>
    `;

    bindEvents();
  };

  const bindEvents = () => {
    // Dismiss alerts
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
    container.querySelector('#btn-cancel-forgot')?.addEventListener('click', () => {
      showForgotModal = false;
      render();
    });
    container.querySelector('#forgot-modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'forgot-modal-backdrop') {
        showForgotModal = false;
        render();
      }
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
      // Demo buttons 1-click login
      container.querySelectorAll('.ep-demo-chip-btn').forEach(btn => {
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

      // Sign In Submit
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
      // Real-time password strength
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
