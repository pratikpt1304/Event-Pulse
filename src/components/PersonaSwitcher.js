import { getCurrentUser, DEMO_PERSONAS, switchDemoPersona } from '../services/auth';

/**
 * Executive & Academic Persona Switcher
 * Built for high-stakes leadership demos (VC, Dean, HOD, Organizer, Admin, Student)
 */
export function renderPersonaSwitcher(container, navigateTo) {
  if (!container) return;
  const currentUser = getCurrentUser();
  const activeRole = currentUser?.role || 'student';

  const html = `
    <div id="ep-persona-bar" style="
      background: linear-gradient(90deg, #090d16 0%, #111827 50%, #090d16 100%);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding: 0.45rem 1rem;
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      font-size: 0.75rem;
      color: #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.5rem;
      position: sticky;
      top: 0;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    ">
      <!-- Left: Role & Context Label -->
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <span style="
          background: linear-gradient(135deg, #7c3aed, #4f46e5);
          color: #fff;
          font-weight: 800;
          padding: 0.15rem 0.5rem;
          border-radius: 999px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          font-size: 0.65rem;
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
        ">
          ⚡ DEMO ROLE SWITCHER
        </span>
        <span style="color: #94a3b8; font-weight: 500;">
          Logged in as: <strong style="color: #38bdf8;">${currentUser?.name || 'Guest User'}</strong> 
          <span style="color: #64748b;">(${currentUser?.role?.toUpperCase() || 'STUDENT'})</span>
        </span>
      </div>

      <!-- Right: Interactive Persona Pills -->
      <div style="display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;" id="persona-pill-group">
        ${DEMO_PERSONAS.map(p => {
          const isActive = activeRole === p.role;
          let activeBorder = 'rgba(255, 255, 255, 0.12)';
          let activeBg = 'rgba(255, 255, 255, 0.04)';
          let textColor = '#cbd5e1';

          if (isActive) {
            if (p.id === 'vc') {
              activeBorder = '#f59e0b';
              activeBg = 'rgba(245, 158, 11, 0.2)';
              textColor = '#fbbf24';
            } else if (p.id === 'dean') {
              activeBorder = '#38bdf8';
              activeBg = 'rgba(56, 189, 248, 0.2)';
              textColor = '#38bdf8';
            } else if (p.id === 'hod') {
              activeBorder = '#a855f7';
              activeBg = 'rgba(168, 85, 247, 0.2)';
              textColor = '#c084fc';
            } else if (p.id === 'organizer') {
              activeBorder = '#10b981';
              activeBg = 'rgba(16, 185, 129, 0.2)';
              textColor = '#34d399';
            } else if (p.id === 'admin') {
              activeBorder = '#ef4444';
              activeBg = 'rgba(239, 68, 68, 0.2)';
              textColor = '#f87171';
            } else {
              activeBorder = '#818cf8';
              activeBg = 'rgba(129, 140, 248, 0.2)';
              textColor = '#a5b4fc';
            }
          }

          return `
            <button class="persona-switch-btn" data-persona="${p.id}" data-route="${p.route}" style="
              background: ${activeBg};
              border: 1px solid ${activeBorder};
              color: ${textColor};
              font-size: 0.72rem;
              font-weight: ${isActive ? '800' : '600'};
              padding: 0.22rem 0.6rem;
              border-radius: 6px;
              cursor: pointer;
              transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
              display: inline-flex;
              align-items: center;
              gap: 0.3rem;
              outline: none;
              box-shadow: ${isActive ? '0 0 12px ' + activeBg : 'none'};
            " title="${p.title} — ${p.scope}">
              <span>${p.icon}</span>
              <span>${p.badge}</span>
              ${isActive ? '<span style="font-size: 0.55rem; background: rgba(255,255,255,0.25); padding: 0.05rem 0.3rem; border-radius: 4px; margin-left: 0.15rem;">ACTIVE</span>' : ''}
            </button>
          `;
        }).join('')}
      </div>
    </div>
  `;

  container.innerHTML = html;

  // Event handlers
  container.querySelectorAll('.persona-switch-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const personaId = btn.getAttribute('data-persona');
      const targetRoute = btn.getAttribute('data-route');
      const persona = DEMO_PERSONAS.find(p => p.id === personaId);

      switchDemoPersona(personaId);
      
      // Trigger instant navigation
      if (navigateTo && targetRoute) {
        navigateTo(targetRoute);
      } else {
        window.location.hash = targetRoute || 'events';
      }

      // Re-render switcher to update ACTIVE tag
      renderPersonaSwitcher(container, navigateTo);
    });
  });
}
