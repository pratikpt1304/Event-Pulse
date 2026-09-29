import { getCurrentUser, logoutUser, isUserAdmin } from '../services/auth';
import { openEditProfileModal, openHelpDeskModal } from './ProfileModals';
import { getStudentNotifications, markAllNotificationsAsRead, markNotificationAsRead, clearAllNotifications, dismissNotification } from '../services/notifications';
import { openTeamFinderModal } from './TeamFinderModal';
import { openComplaintModal } from './ComplaintModal';
import { requestPushNotificationPermission, getNotificationPermissionStatus, isPushNotificationSupported } from '../services/fcm';

/**
 * Converts plain URLs in text to clickable <a> links
 */
function linkifyText(text) {
  if (!text) return '';
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  return escaped.replace(
    /(https?:\/\/[^\s<>"']+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: var(--primary); text-decoration: underline; word-break: break-all;" onclick="event.stopPropagation()">$1</a>'
  );
}

export async function renderNavbar(container, activeRoute, navigateTo) {
  const user = getCurrentUser();

  const getInitials = (name) => {
    if (!name) return 'EP';
    const parts = name.split(' ');
    return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
  };

  // 1. GATEWAY VIEW NAVBAR
  if (activeRoute === 'portal' || activeRoute === 'gateway') {
    container.innerHTML = `
      <nav style="
        background: #ffffff;
        border-bottom: 1.5px solid #e2e8f0;
        padding: 0.75rem 1.5rem;
        box-shadow: 0 2px 10px rgba(0,0,0,0.03);
        font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      ">
        <div style="max-width: 1240px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <div style="display: flex; align-items: center; gap: 0.75rem; cursor: pointer;" id="nav-brand-gateway">
            <img src="/logo.jpg" alt="Sanjivani Logo" style="width: 38px; height: 38px; border-radius: 10px; object-fit: cover;" />
            <div>
              <div style="font-weight: 900; font-size: 1.15rem; color: #0f172a; line-height: 1.2;">Sanjivani University</div>
              <div style="font-size: 0.72rem; color: #7c3aed; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em;">EventPulse Enterprise Gateway</div>
            </div>
          </div>
          
          <button id="btn-quick-student" style="
            background: linear-gradient(135deg, #7c3aed, #4f46e5);
            color: #ffffff;
            border: none;
            padding: 0.45rem 1rem;
            border-radius: 8px;
            font-size: 0.8rem;
            font-weight: 800;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(124, 58, 237, 0.25);
          ">
            🎒 Student Portal ➔
          </button>
        </div>
      </nav>
    `;
    container.querySelector('#nav-brand-gateway')?.addEventListener('click', () => navigateTo('portal'));
    container.querySelector('#btn-quick-student')?.addEventListener('click', () => navigateTo('events'));
    return;
  }

  // 2. DEDICATED EXECUTIVE PORTALS NAVBAR (VC, Dean, HOD, Organizer, Admin)
  const isExecutiveRoute = ['vc', 'dean', 'hod', 'organizer', 'admin'].includes(activeRoute);
  if (isExecutiveRoute) {
    let meta = {
      title: "Vice Chancellor's Apex Portal",
      sub: "Apex University Governance & Charters",
      icon: "👑",
      color: "#f59e0b",
      bg: "linear-gradient(90deg, #090d16 0%, #1e1b4b 100%)",
      userTitle: "Hon'ble Vice Chancellor",
      userName: "Prof. (Dr.) S. B. Patil"
    };

    if (activeRoute === 'dean') {
      meta = {
        title: "Dean's Academic Oversight Portal",
        sub: "School of Computing & Engineering (SCE)",
        icon: "🎓",
        color: "#38bdf8",
        bg: "linear-gradient(90deg, #090d16 0%, #0c4a6e 100%)",
        userTitle: "Dean (SCE)",
        userName: "Dr. Kavita"
      };
    } else if (activeRoute === 'hod') {
      meta = {
        title: "HOD Departmental Command Console",
        sub: "Department of AI & ML (IMTech)",
        icon: "🏫",
        color: "#a855f7",
        bg: "linear-gradient(90deg, #090d16 0%, #2e1065 100%)",
        userTitle: "Head of Department (AIML)",
        userName: "Prof. Anwar Shaikh"
      };
    } else if (activeRoute === 'organizer') {
      meta = {
        title: "Event Operations Hub",
        sub: "Lead Student Organizer (Group 8)",
        icon: "⚡",
        color: "#10b981",
        bg: "linear-gradient(90deg, #090d16 0%, #064e3b 100%)",
        userTitle: "Lead Organizer",
        userName: "Pratik Thorat"
      };
    } else if (activeRoute === 'admin') {
      meta = {
        title: "Master Administration Console",
        sub: "Universal Governance & Security (\"That's for us\")",
        icon: "🛡️",
        color: "#ef4444",
        bg: "linear-gradient(90deg, #090d16 0%, #450a0a 100%)",
        userTitle: "Super Administrator",
        userName: "Prof. Hariprasath"
      };
    }

    container.innerHTML = `
      <nav style="
        background: ${meta.bg};
        border-bottom: 1.5px solid rgba(255, 255, 255, 0.12);
        padding: 0.65rem 1.5rem;
        color: #ffffff;
        font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
        box-shadow: 0 4px 18px rgba(0,0,0,0.3);
      ">
        <div style="max-width: 1240px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; width: 100%; flex-wrap: wrap; gap: 0.75rem;">
          
          <!-- Left: Dedicated Portal Brand -->
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <span style="font-size: 1.6rem;">${meta.icon}</span>
            <div>
              <div style="font-weight: 900; font-size: 1.15rem; color: #ffffff; letter-spacing: -0.01em; line-height: 1.2;">
                ${meta.title}
              </div>
              <div style="font-size: 0.72rem; color: ${meta.color}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">
                ${meta.sub}
              </div>
            </div>
          </div>

          <!-- Right: Official Identity & Switch Portal Action -->
          <div style="display: flex; align-items: center; gap: 0.85rem;">
            <div style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.18); border-radius: 8px; padding: 0.35rem 0.85rem; text-align: right;">
              <div style="font-size: 0.82rem; font-weight: 800; color: #ffffff;">${user?.name || meta.userName}</div>
              <div style="font-size: 0.68rem; color: ${meta.color}; font-weight: 700;">${user?.title || meta.userTitle}</div>
            </div>

            <button id="btn-switch-portal" style="
              background: rgba(255, 255, 255, 0.15);
              color: #ffffff;
              border: 1px solid rgba(255, 255, 255, 0.25);
              padding: 0.45rem 0.95rem;
              border-radius: 8px;
              font-size: 0.78rem;
              font-weight: 800;
              cursor: pointer;
              display: inline-flex;
              align-items: center;
              gap: 0.4rem;
              transition: all 0.2s;
            ">
              <span>🔄</span> Switch Portal
            </button>
          </div>

        </div>
      </nav>
    `;

    container.querySelector('#btn-switch-portal')?.addEventListener('click', () => navigateTo('portal'));
    return;
  }

  // 3. STUDENT & PUBLIC VIEWS NAVBAR (Clean, uncluttered, focused)
  const notifications = user ? await getStudentNotifications(user) : [];
  const unreadCount = notifications.filter(n => !n.isRead).length;
  const pushStatus = getNotificationPermissionStatus();
  const hasPushTokenOrGranted = pushStatus === 'granted' || !!localStorage.getItem('ep_fcm_token');
  const isPushDismissed = localStorage.getItem('ep_push_banner_dismissed') === 'true';
  const showPushBanner = user && isPushNotificationSupported() && !hasPushTokenOrGranted && !isPushDismissed;

  const navHtml = `
    <nav class="navbar">
      <div class="navbar-container">
        <!-- LEFT: Brand Logo & Title -->
        <div class="brand" id="nav-brand" style="cursor: pointer;" title="Go to Home / Campus Events">
          <img src="/logo.jpg" alt="EventPulse Logo" style="width: 36px; height: 36px; border-radius: 9px; object-fit: cover; box-shadow: 0 4px 12px rgba(168, 85, 247, 0.35);" />
          <div class="brand-text">
            <span class="brand-title" style="font-size: 1.3rem; font-weight: 800; letter-spacing: -0.02em;">Event<span class="highlight" style="color: var(--primary);">Pulse</span></span>
          </div>
        </div>

        <!-- CENTER: Student Navigation Links Only -->
        <div class="nav-links">
          <a class="nav-link ${activeRoute === 'events' ? 'active' : ''}" id="nav-events-link" style="cursor: pointer;">
            <span>📅</span> Events
          </a>
          <a class="nav-link ${activeRoute === 'moments' ? 'active' : ''}" id="nav-moments" style="cursor: pointer;">
            <span>📸</span> Moments
          </a>
          <a class="nav-link ${activeRoute === 'ideas' ? 'active' : ''}" id="nav-ideas" style="cursor: pointer;">
            <span>💡</span> Wishlist
          </a>
          ${user ? `
            <a class="nav-link ${activeRoute === 'my-passes' ? 'active' : ''}" id="nav-passes" style="cursor: pointer;">
              <span>🎟️</span> My Passes
            </a>
          ` : ''}
        </div>

        <!-- RIGHT: Portals Gateway Button + User Actions -->
        <div class="nav-actions" style="display: flex; align-items: center; gap: 0.75rem; flex-shrink: 0;">
          
          <button id="btn-nav-gateway" style="
            background: #f1f5f9;
            border: 1.5px solid #cbd5e1;
            color: #334155;
            font-size: 0.75rem;
            font-weight: 800;
            padding: 0.4rem 0.8rem;
            border-radius: 8px;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 0.35rem;
          " title="Open Vice Chancellor, Dean, HOD & Admin Portals">
            <span>🏛️</span> Role Portals
          </button>

          ${user ? `
            <!-- Notification Bell Icon Button -->
            <div style="position: relative; display: flex; align-items: center;" id="notif-bell-container">
              <button id="notif-bell-btn" style="background: var(--bg-surface-elevated); border: 1.5px solid var(--border-strong); width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text-primary); font-size: 1.15rem; position: relative; transition: all 0.2s; box-shadow: 0 2px 6px rgba(0,0,0,0.04);" title="Campus Notifications">
                🔔
                ${unreadCount > 0 ? `
                  <span id="notif-badge-count" style="position: absolute; top: -3px; right: -3px; background: #ef4444; color: #fff; font-size: 0.65rem; font-weight: 800; border-radius: 10px; padding: 1px 5px; border: 2px solid var(--bg-surface); animation: pulse 2s infinite;">
                    ${unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                ` : ''}
              </button>

              <!-- Notification Dropdown Panel -->
              <div id="notif-dropdown-menu" style="display: none; position: absolute; right: 0; top: 125%; background: var(--bg-surface); border: 1px solid var(--border-strong); border-radius: var(--radius-md); box-shadow: var(--shadow-modal); width: 340px; max-width: 90vw; padding: 0.75rem; z-index: 210;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border-subtle); margin-bottom: 0.5rem;">
                  <div style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary);">
                    🔔 Notifications (${unreadCount} unread)
                  </div>
                  
                  <div style="display: flex; gap: 0.5rem; align-items: center;">
                    ${unreadCount > 0 ? `
                      <button id="btn-mark-all-read" style="background: none; border: none; font-size: 0.75rem; color: var(--primary); font-weight: 600; cursor: pointer;">
                        Mark read
                      </button>
                    ` : ''}
                    ${notifications.length > 0 ? `
                      <button id="btn-clear-all-notifs" style="background: none; border: none; font-size: 0.75rem; color: #ef4444; font-weight: 600; cursor: pointer;" title="Clear all notifications">
                        🗑️ Clear All
                      </button>
                    ` : ''}
                  </div>
                </div>

                <!-- Enable Web Push Notification Banner -->
                ${showPushBanner ? `
                  <div id="push-enable-banner" style="background: linear-gradient(135deg, rgba(124, 58, 237, 0.12), rgba(6, 182, 212, 0.12)); border: 1px solid rgba(124, 58, 237, 0.25); border-radius: 8px; padding: 0.5rem 0.65rem; margin-bottom: 0.65rem; display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; transition: all 0.3s ease;">
                    <div style="font-size: 0.75rem; color: var(--text-primary); line-height: 1.3;">
                      <strong>📲 Get Lock-Screen Alerts</strong><br>
                      <span style="color: var(--text-secondary); font-size: 0.7rem;">Never miss notices & events</span>
                    </div>
                    <button id="btn-enable-push-notifs" style="background: #7c3aed; color: #fff; border: none; padding: 0.35rem 0.65rem; border-radius: 6px; font-size: 0.7rem; font-weight: 700; cursor: pointer; white-space: nowrap;">
                      Turn On
                    </button>
                  </div>
                ` : ''}

                <div id="notif-list-container" style="max-height: 300px; overflow-y: auto;">
                  ${notifications.length === 0 ? `
                    <div style="text-align: center; padding: 1.5rem 0; color: var(--text-tertiary); font-size: 0.85rem;">
                      No new notifications 🎉
                    </div>
                  ` : notifications.map(n => `
                    <div class="notif-item ${!n.isRead ? 'unread' : ''}" data-id="${n.id}" style="padding: 0.65rem; border-radius: var(--radius-sm); margin-bottom: 0.4rem; background: ${!n.isRead ? 'rgba(124, 58, 237, 0.06)' : 'transparent'}; border-left: 3px solid ${!n.isRead ? 'var(--primary)' : 'transparent'}; cursor: pointer; position: relative;">
                      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
                        <strong style="font-size: 0.8rem; color: var(--text-primary); line-height: 1.2;">${n.title}</strong>
                        <div style="display: flex; align-items: center; gap: 0.25rem;">
                          <span style="font-size: 0.65rem; color: var(--text-tertiary); white-space: nowrap;">${new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          <button class="btn-dismiss-single-notif" data-id="${n.id}" style="background: none; border: none; color: var(--text-tertiary); font-size: 0.75rem; cursor: pointer; padding: 0 0.15rem; line-height: 1;" title="Dismiss notification">✕</button>
                        </div>
                      </div>
                      <p style="font-size: 0.75rem; color: var(--text-secondary); margin: 0.25rem 0 0 0; line-height: 1.3;">
                        ${linkifyText(n.message)}
                      </p>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>

            <!-- Profile Dropdown Trigger -->
            <div style="position: relative;">
              <button class="profile-chip" id="profile-dropdown-btn" style="cursor: pointer; border: 1px solid var(--border-subtle); background: var(--bg-surface); padding: 0.25rem 0.5rem; border-radius: var(--radius-full); display: flex; align-items: center; gap: 0.5rem;">
                <div class="avatar" style="width: 28px; height: 28px; font-size: 0.75rem; border-radius: 50%; background: var(--primary); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700;">
                  ${getInitials(user.name)}
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-start; text-align: left; line-height: 1.1;">
                  <span style="font-weight: 700; font-size: 0.8rem; color: var(--text-primary);">${user.name.split(' ')[0]}</span>
                  <span class="role-tag ${user.role}" style="font-size: 0.625rem; padding: 0.05rem 0.35rem;">${user.role}</span>
                </div>
                <span style="font-size: 0.65rem; color: var(--text-tertiary);">▼</span>
              </button>

              <!-- Profile Dropdown Menu -->
              <div id="profile-dropdown-menu" style="display: none; position: absolute; right: 0; top: 120%; background: var(--bg-surface); border: 1px solid var(--border-strong); border-radius: var(--radius-md); box-shadow: var(--shadow-modal); width: 220px; padding: 0.5rem; z-index: 200;">
                <div style="padding: 0.5rem; border-bottom: 1px solid var(--border-subtle); margin-bottom: 0.5rem;">
                  <div style="font-weight: 700; font-size: 0.875rem; color: var(--text-primary);">${user.name}</div>
                  <div style="font-size: 0.75rem; color: var(--text-tertiary); word-break: break-all;">${user.email}</div>
                  <div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 0.2rem;">PRN: ${user.prn || 'N/A'}</div>
                </div>

                <a class="dropdown-item" id="menu-edit-profile" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.5rem; border-radius: var(--radius-sm); color: var(--text-primary); cursor: pointer; font-size: 0.85rem;">
                  <span>✏️</span> Edit Profile
                </a>
                <a class="dropdown-item" id="menu-team-finder" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.5rem; border-radius: var(--radius-sm); color: var(--text-primary); cursor: pointer; font-size: 0.85rem;">
                  <span>🤝</span> Teammate Finder
                </a>
                <a class="dropdown-item" id="menu-help-desk" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.5rem; border-radius: var(--radius-sm); color: var(--text-primary); cursor: pointer; font-size: 0.85rem;">
                  <span>💬</span> Campus Helpdesk
                </a>
                <a class="dropdown-item" id="menu-complaint" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.5rem; border-radius: var(--radius-sm); color: #ef4444; cursor: pointer; font-size: 0.85rem;">
                  <span>🚨</span> Confidential Grievance
                </a>

                <div style="border-top: 1px solid var(--border-subtle); margin-top: 0.5rem; padding-top: 0.5rem;">
                  <a class="dropdown-item" id="menu-logout" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.4rem 0.5rem; border-radius: var(--radius-sm); color: #ef4444; cursor: pointer; font-size: 0.85rem;">
                    <span>🚪</span> Log Out
                  </a>
                </div>
              </div>
            </div>
          ` : `
            <button class="btn btn-primary btn-sm" id="btn-login-nav" style="font-weight: 700;">
              Sign In
            </button>
          `}

        </div>
      </div>
    </nav>
  `;

  container.innerHTML = navHtml;

  // Student Navigation Listeners
  container.querySelector('#nav-brand')?.addEventListener('click', () => navigateTo('events'));
  container.querySelector('#nav-events-link')?.addEventListener('click', () => navigateTo('events'));
  container.querySelector('#nav-moments')?.addEventListener('click', () => navigateTo('moments'));
  container.querySelector('#nav-ideas')?.addEventListener('click', () => navigateTo('ideas'));
  container.querySelector('#nav-passes')?.addEventListener('click', () => navigateTo('my-passes'));
  container.querySelector('#btn-nav-gateway')?.addEventListener('click', () => navigateTo('portal'));
  container.querySelector('#btn-login-nav')?.addEventListener('click', () => navigateTo('login'));

  // Notification Bell Listeners
  const notifBtn = container.querySelector('#notif-bell-btn');
  const notifMenu = container.querySelector('#notif-dropdown-menu');
  const profileBtn = container.querySelector('#profile-dropdown-btn');
  const profileMenu = container.querySelector('#profile-dropdown-menu');

  if (notifBtn && notifMenu) {
    notifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      notifMenu.style.display = notifMenu.style.display === 'block' ? 'none' : 'block';
      if (profileMenu) profileMenu.style.display = 'none';
    });
  }

  if (profileBtn && profileMenu) {
    profileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      profileMenu.style.display = profileMenu.style.display === 'block' ? 'none' : 'block';
      if (notifMenu) notifMenu.style.display = 'none';
    });
  }

  // Close menus on outside click
  document.addEventListener('click', () => {
    if (notifMenu) notifMenu.style.display = 'none';
    if (profileMenu) profileMenu.style.display = 'none';
  });

  // Profile Menu Actions
  container.querySelector('#menu-edit-profile')?.addEventListener('click', () => {
    if (profileMenu) profileMenu.style.display = 'none';
    openEditProfileModal(user);
  });
  container.querySelector('#menu-team-finder')?.addEventListener('click', () => {
    if (profileMenu) profileMenu.style.display = 'none';
    openTeamFinderModal();
  });
  container.querySelector('#menu-help-desk')?.addEventListener('click', () => {
    if (profileMenu) profileMenu.style.display = 'none';
    openHelpDeskModal();
  });
  container.querySelector('#menu-complaint')?.addEventListener('click', () => {
    if (profileMenu) profileMenu.style.display = 'none';
    openComplaintModal();
  });
  container.querySelector('#menu-logout')?.addEventListener('click', async () => {
    await logoutUser();
    navigateTo('portal');
  });
}
