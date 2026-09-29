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
        /* =====================================================================
           EVENTPULSE — PREMIUM LOGIN PAGE
           Split-screen: Branded Left Panel + Clean Right Form Panel
        ====================================================================== */
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        * { box-sizing: border-box; }

        .ep-auth-root {
          min-height: 100vh;
          width: 100%;
          display: flex;
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #060b17;
        }

        /* ── LEFT BRAND PANEL ─────────────────────────────────────────── */
        .ep-brand-panel {
          flex: 0 0 48%;
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          overflow: hidden;
          padding: 3rem 3.5rem;
          background: linear-gradient(145deg, #0d1b3e 0%, #0a0f1e 40%, #0c1a38 100%);
        }

        /* Animated orbs */
        .ep-brand-panel::before {
          content: '';
          position: absolute;
          top: -120px;
          left: -80px;
          width: 420px;
          height: 420px;
          background: radial-gradient(circle, rgba(99,102,241,0.28) 0%, transparent 70%);
          animation: ep-orb-float 8s ease-in-out infinite;
          pointer-events: none;
        }
        .ep-brand-panel::after {
          content: '';
          position: absolute;
          bottom: -100px;
          right: -60px;
          width: 380px;
          height: 380px;
          background: radial-gradient(circle, rgba(139,92,246,0.22) 0%, transparent 70%);
          animation: ep-orb-float 10s ease-in-out infinite reverse;
          pointer-events: none;
        }

        @keyframes ep-orb-float {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-30px) scale(1.05); }
        }

        /* Decorative grid lines */
        .ep-grid-overlay {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(99,102,241,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99,102,241,0.06) 1px, transparent 1px);
          background-size: 48px 48px;
          pointer-events: none;
        }

        /* Top vignette on grid */
        .ep-grid-overlay::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(to bottom right, rgba(13,27,62,0.6), transparent 60%, rgba(10,15,30,0.8));
          pointer-events: none;
        }

        .ep-brand-top {
          position: relative;
          z-index: 2;
        }

        .ep-logo-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 3rem;
        }

        .ep-logo-icon {
          width: 44px;
          height: 44px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.25rem;
          box-shadow: 0 0 20px rgba(99,102,241,0.5);
          flex-shrink: 0;
        }

        .ep-logo-wordmark {
          font-size: 1.5rem;
          font-weight: 800;
          color: #ffffff;
          letter-spacing: -0.03em;
        }

        .ep-logo-wordmark span {
          color: #818cf8;
        }

        .ep-hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          background: rgba(99,102,241,0.15);
          border: 1px solid rgba(99,102,241,0.35);
          border-radius: 100px;
          padding: 5px 14px;
          font-size: 0.72rem;
          font-weight: 700;
          color: #a5b4fc;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          margin-bottom: 1.25rem;
        }

        .ep-hero-badge::before {
          content: '';
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #818cf8;
          box-shadow: 0 0 6px #818cf8;
          animation: ep-pulse 2s ease-in-out infinite;
        }

        @keyframes ep-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.85); }
        }

        .ep-hero-title {
          font-size: 2.75rem;
          font-weight: 800;
          color: #ffffff;
          line-height: 1.15;
          letter-spacing: -0.035em;
          margin: 0 0 1rem 0;
        }

        .ep-hero-title .ep-gradient-text {
          background: linear-gradient(135deg, #818cf8 0%, #c084fc 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .ep-hero-desc {
          font-size: 1rem;
          color: #94a3b8;
          line-height: 1.65;
          margin: 0 0 2.5rem 0;
          max-width: 340px;
        }

        /* Feature pillars */
        .ep-features {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .ep-feature-item {
          display: flex;
          align-items: flex-start;
          gap: 0.85rem;
        }

        .ep-feature-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.95rem;
          flex-shrink: 0;
          margin-top: 1px;
        }

        .ep-feature-icon.indigo { background: rgba(99,102,241,0.18); }
        .ep-feature-icon.violet { background: rgba(139,92,246,0.18); }
        .ep-feature-icon.cyan   { background: rgba(34,211,238,0.18); }

        .ep-feature-text strong {
          display: block;
          font-size: 0.85rem;
          font-weight: 700;
          color: #e2e8f0;
          margin-bottom: 2px;
        }

        .ep-feature-text span {
          font-size: 0.775rem;
          color: #64748b;
          line-height: 1.4;
        }

        /* Bottom university strip */
        .ep-brand-footer {
          position: relative;
          z-index: 2;
          padding-top: 2rem;
          border-top: 1px solid rgba(255,255,255,0.07);
        }

        .ep-univ-name {
          font-size: 0.72rem;
          font-weight: 700;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 0.3rem;
        }

        .ep-univ-tagline {
          font-size: 0.78rem;
          color: #334155;
        }

        /* Stats row */
        .ep-stats-row {
          display: flex;
          gap: 1.75rem;
          margin-top: 1.5rem;
        }

        .ep-stat {
          display: flex;
          flex-direction: column;
        }

        .ep-stat-num {
          font-size: 1.35rem;
          font-weight: 800;
          color: #6366f1;
          line-height: 1;
        }

        .ep-stat-label {
          font-size: 0.7rem;
          color: #475569;
          margin-top: 2px;
        }

        /* ── RIGHT FORM PANEL ─────────────────────────────────────────── */
        .ep-form-panel {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2.5rem 2rem;
          background: #070c18;
          overflow-y: auto;
          position: relative;
        }

        /* Subtle noise texture */
        .ep-form-panel::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
          pointer-events: none;
          opacity: 0.4;
        }

        .ep-form-inner {
          width: 100%;
          max-width: ${activeTab === 'signup' ? '520px' : '440px'};
          position: relative;
          z-index: 1;
          transition: max-width 0.3s cubic-bezier(0.16,1,0.3,1);
        }

        /* Form header */
        .ep-form-header {
          margin-bottom: 2rem;
        }

        .ep-form-eyebrow {
          font-size: 0.72rem;
          font-weight: 700;
          color: #6366f1;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 0.5rem;
        }

        .ep-form-title {
          font-size: 1.75rem;
          font-weight: 800;
          color: #f8fafc;
          letter-spacing: -0.025em;
          margin: 0 0 0.4rem 0;
          line-height: 1.2;
        }

        .ep-form-subtitle {
          font-size: 0.875rem;
          color: #64748b;
          margin: 0;
          line-height: 1.5;
        }

        /* Tabs */
        .ep-tabs-nav {
          display: flex;
          background: #0e1525;
          border: 1px solid #1e293b;
          border-radius: 14px;
          padding: 5px;
          margin-bottom: 1.75rem;
          gap: 4px;
        }

        .ep-tab-btn {
          flex: 1;
          background: transparent;
          border: none;
          color: #475569;
          padding: 10px 14px;
          font-size: 0.85rem;
          font-weight: 700;
          font-family: inherit;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.45rem;
          letter-spacing: -0.01em;
        }

        .ep-tab-btn.active {
          background: linear-gradient(135deg, #1e2a45, #1a2340);
          color: #f8fafc;
          box-shadow: 0 2px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06);
        }

        .ep-tab-btn .tab-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #6366f1;
          box-shadow: 0 0 6px rgba(99,102,241,0.7);
          display: none;
        }

        .ep-tab-btn.active .tab-dot {
          display: block;
        }

        /* Form groups */
        .ep-form-group {
          margin-bottom: 1.1rem;
        }

        .ep-label {
          display: block;
          font-size: 0.75rem;
          font-weight: 700;
          color: #94a3b8;
          margin-bottom: 0.45rem;
          letter-spacing: 0.03em;
        }

        .ep-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }

        .ep-input {
          width: 100%;
          background: #0e1525;
          border: 1.5px solid #1e293b;
          color: #f1f5f9;
          border-radius: 12px;
          padding: 12px 16px;
          font-size: 0.9rem;
          font-family: inherit;
          outline: none;
          transition: all 0.18s ease;
        }

        .ep-input::placeholder {
          color: #334155;
        }

        .ep-input:focus {
          border-color: #6366f1;
          background: #0f1a2e;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.18), 0 0 12px rgba(99,102,241,0.08);
        }

        .ep-input:hover:not(:focus) {
          border-color: #2d3f5c;
        }

        .ep-input-toggle-btn {
          position: absolute;
          right: 12px;
          background: transparent;
          border: none;
          color: #475569;
          cursor: pointer;
          font-size: 0.85rem;
          padding: 4px 6px;
          border-radius: 6px;
          transition: color 0.15s;
          line-height: 1;
        }

        .ep-input-toggle-btn:hover { color: #94a3b8; }

        /* Inline row for forgot pwd */
        .ep-label-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.45rem;
        }

        .ep-forgot-link {
          background: none;
          border: none;
          color: #6366f1;
          font-size: 0.75rem;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          padding: 0;
          transition: color 0.15s;
        }

        .ep-forgot-link:hover { color: #818cf8; }

        /* Primary CTA */
        .ep-btn-primary {
          width: 100%;
          background: linear-gradient(135deg, #6366f1 0%, #7c3aed 100%);
          color: #ffffff;
          border: none;
          border-radius: 12px;
          padding: 13px 18px;
          font-size: 0.925rem;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          box-shadow: 0 4px 20px rgba(99,102,241,0.4), 0 1px 0 rgba(255,255,255,0.1) inset;
          letter-spacing: -0.01em;
          position: relative;
          overflow: hidden;
        }

        .ep-btn-primary::before {
          content: '';
          position: absolute;
          top: 0; left: -100%;
          width: 100%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
          transition: left 0.4s ease;
        }

        .ep-btn-primary:hover:not(:disabled)::before { left: 100%; }

        .ep-btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(99,102,241,0.55), 0 1px 0 rgba(255,255,255,0.15) inset;
        }

        .ep-btn-primary:active:not(:disabled) {
          transform: translateY(0);
        }

        .ep-btn-primary:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        /* Divider */
        .ep-divider {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin: 1.1rem 0;
          color: #1e293b;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .ep-divider::before, .ep-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: #1e293b;
        }

        .ep-divider span { color: #334155; }

        /* Google button */
        .ep-btn-google {
          width: 100%;
          background: #0e1525;
          border: 1.5px solid #1e293b;
          color: #cbd5e1;
          border-radius: 12px;
          padding: 12px 16px;
          font-size: 0.875rem;
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
          background: #131e34;
          border-color: #2d3f5c;
          color: #f1f5f9;
          transform: translateY(-1px);
        }

        /* Password strength */
        .ep-strength-meter { margin-top: 0.5rem; }
        .ep-strength-bar {
          height: 3px;
          width: 100%;
          background: #1e293b;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 0.35rem;
        }
        .ep-strength-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.3s ease, background 0.3s ease;
        }
        .ep-strength-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.7rem;
          color: #475569;
        }

        /* Alert banners */
        .ep-alert-error {
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.3);
          color: #fca5a5;
          padding: 0.75rem 1rem;
          border-radius: 10px;
          font-size: 0.83rem;
          margin-bottom: 1.25rem;
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
        }

        .ep-alert-success {
          background: rgba(16,185,129,0.1);
          border: 1px solid rgba(16,185,129,0.3);
          color: #6ee7b7;
          padding: 0.75rem 1rem;
          border-radius: 10px;
          font-size: 0.83rem;
          margin-bottom: 1.25rem;
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
        }

        .ep-alert-dismiss {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 1.1rem;
          line-height: 1;
          padding: 0;
          margin-left: auto;
          flex-shrink: 0;
        }

        .ep-alert-error .ep-alert-dismiss { color: #fca5a5; }
        .ep-alert-success .ep-alert-dismiss { color: #6ee7b7; }

        /* Demo box */
        .ep-demo-box {
          margin-top: 1.25rem;
          background: #0a1120;
          border: 1px solid rgba(99,102,241,0.22);
          border-radius: 14px;
          padding: 1rem 1rem 0.85rem;
        }

        .ep-demo-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.75rem;
        }

        .ep-demo-title {
          font-size: 0.72rem;
          font-weight: 700;
          color: #818cf8;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }

        .ep-demo-badge {
          font-size: 0.6rem;
          background: rgba(55,48,163,0.6);
          color: #c7d2fe;
          padding: 2px 7px;
          border-radius: 4px;
          font-weight: 600;
          letter-spacing: 0.03em;
        }

        .ep-demo-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.5rem;
          margin-bottom: 0.65rem;
        }

        .ep-demo-btn {
          background: rgba(15,26,46,0.8);
          border: 1px solid #1e293b;
          color: #e2e8f0;
          border-radius: 9px;
          padding: 8px 8px 6px;
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          font-family: inherit;
        }

        .ep-demo-btn:hover {
          border-color: #6366f1;
          background: #131e34;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(99,102,241,0.2);
        }

        .ep-demo-btn .ep-demo-role {
          font-size: 0.95rem;
          line-height: 1;
          margin-bottom: 1px;
        }

        .ep-demo-btn small {
          font-size: 0.6rem;
          color: #475569;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%;
        }

        .ep-demo-hint {
          font-size: 0.68rem;
          color: #334155;
          text-align: center;
        }

        /* 2 column grid */
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
          background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
          background-repeat: no-repeat;
          background-position: right 12px center;
          background-size: 14px;
          padding-right: 34px;
          cursor: pointer;
        }

        /* Spinner */
        .ep-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: ep-spin 0.6s linear infinite;
          flex-shrink: 0;
        }

        @keyframes ep-spin {
          to { transform: rotate(360deg); }
        }

        /* Staff note */
        .ep-staff-note {
          margin-top: 1.25rem;
          padding: 0.75rem 1rem;
          background: #080f1e;
          border: 1px solid #141f33;
          border-radius: 10px;
          font-size: 0.77rem;
          color: #475569;
          text-align: center;
          line-height: 1.5;
        }

        .ep-staff-note a {
          color: #6366f1;
          text-decoration: none;
          font-weight: 600;
        }

        /* Forgot password modal */
        .ep-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.8);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          z-index: 9999;
        }

        .ep-modal-card {
          width: 100%;
          max-width: 400px;
          background: #0e1525;
          border: 1px solid #1e293b;
          border-radius: 18px;
          padding: 1.75rem;
          box-shadow: 0 40px 80px rgba(0,0,0,0.7);
        }

        .ep-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .ep-modal-title {
          font-size: 1.15rem;
          font-weight: 800;
          color: #f8fafc;
          margin: 0;
        }

        .ep-modal-close {
          background: none;
          border: none;
          color: #475569;
          font-size: 1.35rem;
          cursor: pointer;
          padding: 0 4px;
          line-height: 1;
          border-radius: 6px;
          transition: color 0.15s;
        }

        .ep-modal-close:hover { color: #94a3b8; }

        .ep-modal-desc {
          font-size: 0.83rem;
          color: #475569;
          margin: 0 0 1.25rem 0;
          line-height: 1.55;
        }

        .ep-modal-actions {
          display: flex;
          gap: 0.75rem;
          justify-content: flex-end;
          margin-top: 1.5rem;
        }

        .ep-btn-ghost {
          background: #1e293b;
          border: none;
          color: #94a3b8;
          border-radius: 10px;
          padding: 10px 18px;
          font-size: 0.85rem;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.15s;
        }

        .ep-btn-ghost:hover { background: #253347; color: #f1f5f9; }

        /* ── RESPONSIVE: hide left panel on mobile ─────────────────────── */
        @media (max-width: 900px) {
          .ep-brand-panel { display: none; }
          .ep-form-panel { background: #060b17; }
        }

        @media (max-width: 500px) {
          .ep-form-panel { padding: 1.5rem 1rem; }
          .ep-form-title { font-size: 1.5rem; }
        }
      </style>

      <div class="ep-auth-root">

        <!-- ═══════════════════ LEFT BRAND PANEL ═══════════════════ -->
        <div class="ep-brand-panel">
          <div class="ep-grid-overlay"></div>

          <div class="ep-brand-top">
            <!-- Logo row -->
            <div class="ep-logo-row">
              <div class="ep-logo-icon">⚡</div>
              <div class="ep-logo-wordmark">Event<span>Pulse</span></div>
            </div>

            <!-- Hero text -->
            <div class="ep-hero-badge">Sanjivani University Platform</div>
            <h1 class="ep-hero-title">
              Your Campus.<br>
              <span class="ep-gradient-text">One Platform.</span>
            </h1>
            <p class="ep-hero-desc">
              Manage, discover, and participate in every academic event — from technical fests to grievance redressal — all in one unified portal.
            </p>

            <!-- Feature list -->
            <div class="ep-features">
              <div class="ep-feature-item">
                <div class="ep-feature-icon indigo">🎪</div>
                <div class="ep-feature-text">
                  <strong>Smart Event Discovery</strong>
                  <span>Browse, register & get digital passes for campus events instantly.</span>
                </div>
              </div>
              <div class="ep-feature-item">
                <div class="ep-feature-icon violet">🏛️</div>
                <div class="ep-feature-text">
                  <strong>Executive Academic Hub</strong>
                  <span>HOD, Dean & VC dashboards with NAAC-ready reporting.</span>
                </div>
              </div>
              <div class="ep-feature-item">
                <div class="ep-feature-icon cyan">🚨</div>
                <div class="ep-feature-text">
                  <strong>DGRC Grievance Redressal</strong>
                  <span>Anonymous and tracked complaint resolution for every student.</span>
                </div>
              </div>
            </div>
          </div>

          <div class="ep-brand-footer">
            <div class="ep-univ-name">Sanjivani University — Faculty of Engineering & Technology</div>
            <div class="ep-univ-tagline">Empowering students and faculty through connected campus experiences.</div>

          </div>
        </div>

        <!-- ═══════════════════ RIGHT FORM PANEL ═══════════════════ -->
        <div class="ep-form-panel">
          <div class="ep-form-inner">

            <!-- Form header -->
            <div class="ep-form-header">
              <div class="ep-form-eyebrow">
                ${activeTab === 'signin' ? '🔐 Secure Sign In' : '👨‍🎓 Student Registration'}
              </div>
              <h2 class="ep-form-title">
                ${activeTab === 'signin' ? 'Welcome back' : 'Create your account'}
              </h2>
              <p class="ep-form-subtitle">
                ${activeTab === 'signin'
                  ? 'Sign in to access your EventPulse dashboard.'
                  : 'Register with your university PRN and institutional email.'}
              </p>
            </div>

            <!-- Tabs Navigation -->
            <div class="ep-tabs-nav">
              <button type="button" class="ep-tab-btn ${activeTab === 'signin' ? 'active' : ''}" id="tab-btn-signin">
                <span class="tab-dot"></span>🔐 Sign In
              </button>
              <button type="button" class="ep-tab-btn ${activeTab === 'signup' ? 'active' : ''}" id="tab-btn-signup">
                <span class="tab-dot"></span>👨‍🎓 Student Sign Up
              </button>
            </div>

            <!-- Alert Banners -->
            ${errorMessage ? `
              <div class="ep-alert-error">
                <span>⚠️</span>
                <div style="flex: 1; line-height: 1.45;">${errorMessage}</div>
                <button class="ep-alert-dismiss" id="ep-dismiss-error">×</button>
              </div>
            ` : ''}

            ${successMessage ? `
              <div class="ep-alert-success">
                <span>✅</span>
                <div style="flex: 1; line-height: 1.45;">${successMessage}</div>
                <button class="ep-alert-dismiss" id="ep-dismiss-success">×</button>
              </div>
            ` : ''}

            ${activeTab === 'signin' ? `
              <!-- ── SIGN IN TAB ── -->
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
                  <div class="ep-label-row">
                    <label class="ep-label" style="margin-bottom: 0;">Password</label>
                    <button type="button" class="ep-forgot-link" id="ep-btn-forgot">Forgot password?</button>
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
                    <button type="button" class="ep-input-toggle-btn" id="ep-btn-toggle-login-pwd" title="Toggle visibility">
                      ${showLoginPassword ? '👁️' : '🙈'}
                    </button>
                  </div>
                </div>

                <button type="submit" class="ep-btn-primary" id="ep-btn-submit" ${isLoading ? 'disabled' : ''}>
                  ${isLoading ? '<div class="ep-spinner"></div> Signing in…' : '→ Sign In to EventPulse'}
                </button>
              </form>



              <!-- DEMO MODE -->
              ${demoModeActive ? `
                <div class="ep-demo-box">
                  <div class="ep-demo-header">
                    <div class="ep-demo-title">⚡ Try Demo Accounts</div>
                    <span class="ep-demo-badge">DEMO MODE ON</span>
                  </div>
                  <div class="ep-demo-grid">
                    <button type="button" class="ep-demo-btn" data-email="student@college.edu">
                      <span class="ep-demo-role">👨‍🎓</span>
                      <strong>Student</strong>
                      <small>student@college.edu</small>
                    </button>
                    <button type="button" class="ep-demo-btn" data-email="organizer@college.edu">
                      <span class="ep-demo-role">⚡</span>
                      <strong>Organizer</strong>
                      <small>organizer@college.edu</small>
                    </button>
                    <button type="button" class="ep-demo-btn" data-email="hod@college.edu">
                      <span class="ep-demo-role">📚</span>
                      <strong>HOD</strong>
                      <small>hod@college.edu</small>
                    </button>
                    <button type="button" class="ep-demo-btn" data-email="dean@college.edu">
                      <span class="ep-demo-role">🎓</span>
                      <strong>Dean</strong>
                      <small>dean@college.edu</small>
                    </button>
                    <button type="button" class="ep-demo-btn" data-email="vc@college.edu">
                      <span class="ep-demo-role">👑</span>
                      <strong>VC</strong>
                      <small>vc@college.edu</small>
                    </button>
                    <button type="button" class="ep-demo-btn" data-email="admin@college.edu">
                      <span class="ep-demo-role">🛡️</span>
                      <strong>Admin</strong>
                      <small>admin@college.edu</small>
                    </button>
                  </div>
                  <div class="ep-demo-hint">Tap any card — 1-click authentication, no password needed</div>
                </div>
              ` : ''}



            ` : `
              <!-- ── SIGN UP TAB ── -->
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
                      style="text-transform: uppercase; font-family: monospace; font-size: 0.85rem;"
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
                    University Email
                    ${allowedDomain ? `<span style="color: #6366f1; font-weight: 500; text-transform: none; margin-left: 4px;">(@${allowedDomain})</span>` : ''}
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
                  <label class="ep-label">Create Password</label>
                  <div class="ep-input-wrap">
                    <input
                      type="${showSignupPassword ? 'text' : 'password'}"
                      id="ep-signup-password"
                      class="ep-input"
                      placeholder="Minimum 8 characters"
                      minlength="6"
                      value="${signupData.password}"
                      required
                      autocomplete="new-password"
                    />
                    <button type="button" class="ep-input-toggle-btn" id="ep-btn-toggle-signup-pwd">
                      ${showSignupPassword ? '👁️' : '🙈'}
                    </button>
                  </div>
                  ${signupData.password ? `
                    <div class="ep-strength-meter">
                      <div class="ep-strength-bar">
                        <div class="ep-strength-fill" style="width: ${strength.percent}%; background: ${strength.color};"></div>
                      </div>
                      <div class="ep-strength-row">
                        <span>Strength: <strong style="color: ${strength.color};">${strength.label}</strong></span>
                        <span>${strength.score}/4 criteria met</span>
                      </div>
                    </div>
                  ` : ''}
                </div>

                <button type="submit" class="ep-btn-primary" id="ep-btn-submit-signup" ${isLoading ? 'disabled' : ''} style="margin-top: 0.25rem;">
                  ${isLoading ? '<div class="ep-spinner"></div> Creating Account…' : '→ Complete Student Registration'}
                </button>

                <div style="margin-top: 0.9rem; text-align: center; font-size: 0.75rem; color: #334155; line-height: 1.5;">
                  ✉️ A verification email will be sent to confirm your university address.
                </div>
              </form>
            `}

          </div>
        </div>

        <!-- ═══ Forgot Password Modal ═══ -->
        ${showForgotModal ? `
          <div class="ep-modal-backdrop" id="forgot-modal-backdrop">
            <div class="ep-modal-card">
              <div class="ep-modal-header">
                <h3 class="ep-modal-title">🔑 Reset Password</h3>
                <button type="button" class="ep-modal-close" id="btn-close-forgot">×</button>
              </div>
              <p class="ep-modal-desc">
                Enter your registered university email. We'll send a secure password reset link straight to your inbox.
              </p>
              <div class="ep-form-group">
                <label class="ep-label">Registered Email</label>
                <input type="email" id="input-forgot-email" class="ep-input" placeholder="name@college.edu" value="${forgotEmail}" required />
              </div>
              <div class="ep-modal-actions">
                <button type="button" class="ep-btn-ghost" id="btn-cancel-forgot">Cancel</button>
                <button type="button" class="ep-btn-primary" id="btn-submit-forgot" style="width: auto; padding: 10px 22px;">Send Reset Link</button>
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
      // Demo buttons
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
