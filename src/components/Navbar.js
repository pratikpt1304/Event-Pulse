import { getCurrentUser, logoutUser, isUserAdmin } from '../services/auth';
import { openEditProfileModal, openHelpDeskModal } from './ProfileModals';
import { getStudentNotifications, markAllNotificationsAsRead, markNotificationAsRead, clearAllNotifications, dismissNotification } from '../services/notifications';
import { openTeamFinderModal } from './TeamFinderModal';
import { openComplaintModal } from './ComplaintModal';
import { requestPushNotificationPermission, getNotificationPermissionStatus, isPushNotificationSupported } from '../services/fcm';

/**
 * Converts plain URLs in text to clickable <a> links
 * Safe: escapes HTML to prevent XSS, then replaces URLs with anchor tags
 */
function linkifyText(text) {
  if (!text) return '';
  // Escape HTML first to prevent XSS
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  // Replace URLs with clickable links
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

  // Fetch notifications
  const notifications = user ? await getStudentNotifications(user) : [];
  const unreadCount = notifications.filter(n => !n.isRead).length;
  const pushStatus = getNotificationPermissionStatus();
  const hasPushTokenOrGranted = pushStatus === 'granted' || !!localStorage.getItem('ep_fcm_token');
  const isPushDismissed = localStorage.getItem('ep_push_banner_dismissed') === 'true';
  const showPushBanner = user && isPushNotificationSupported() && !hasPushTokenOrGranted && !isPushDismissed;

  const navHtml = `
    <nav class="navbar">
      <div class="navbar-container">
        <!-- LEFT: Brand Logo & Title (Clickable to Home) -->
        <div class="brand" id="nav-brand" style="cursor: pointer;" title="Go to Home / Campus Events">
          <img src="/logo.jpg" alt="EventPulse Logo" style="width: 36px; height: 36px; border-radius: 9px; object-fit: cover; box-shadow: 0 4px 12px rgba(168, 85, 247, 0.35);" />
          <div class="brand-text">
            <span class="brand-title" style="font-size: 1.3rem; font-weight: 800; letter-spacing: -0.02em;">Event<span class="highlight" style="color: var(--primary);">Pulse</span></span>
          </div>
        </div>

        <!-- CENTER: Main Navigation Links (Desktop) -->
        <div class="nav-links">
          ${user && (user.role === 'organizer' || isUserAdmin(user)) ? `
            <a class="nav-link ${activeRoute === 'organizer' ? 'active' : ''}" id="nav-organizer" style="cursor: pointer; color: var(--primary);">
              <span>⚡</span> Organizer Hub
            </a>
          ` : ''}
          ${isUserAdmin(user) ? `
            <a class="nav-link ${activeRoute === 'admin' ? 'active' : ''}" id="nav-admin" style="cursor: pointer; color: #ef4444; font-weight: 700;">
              <span>🛡️</span> Admin Console
            </a>
          ` : ''}
        </div>

        <!-- RIGHT: User Profile / Auth Action & Notification Bell (Side-by-Side) -->
        <div class="nav-actions" style="display: flex; align-items: center; gap: 0.75rem; flex-shrink: 0;">
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
                    <div style="display: flex; align-items: center; gap: 0.35rem; flex-shrink: 0;">
                      <button id="btn-enable-push-notifs" class="btn btn-sm btn-primary" style="padding: 0.28rem 0.6rem; font-size: 0.725rem; font-weight: 700; white-space: nowrap;">
                        Enable
                      </button>
                      <button id="btn-dismiss-push-banner" style="background: none; border: none; font-size: 0.85rem; color: var(--text-tertiary); cursor: pointer; padding: 2px 4px; border-radius: 4px; line-height: 1;" title="Dismiss alert">
                        ✕
                      </button>
                    </div>
                  </div>
                ` : ''}

                <div style="max-height: 280px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.45rem;">
                  ${notifications.length === 0 ? `
                    <div style="text-align: center; padding: 2rem 1rem; color: var(--text-tertiary); font-size: 0.85rem;">
                      <div style="font-size: 1.75rem; margin-bottom: 0.35rem;">✨</div>
                      No notifications yet
                    </div>
                  ` : notifications.map(n => `
                    <div class="notif-item ${n.isRead ? 'read' : 'unread'}" data-notif-id="${n.id}" data-route="${n.route}" style="position: relative; padding: 0.6rem 0.7rem; padding-right: 1.75rem; border-radius: var(--radius-sm); background: ${n.isRead ? '#f8fafc' : 'rgba(124, 58, 237, 0.08)'}; border: 1px solid ${n.isRead ? 'var(--border-subtle)' : 'rgba(124, 58, 237, 0.25)'}; cursor: pointer; transition: background 0.15s;">
                      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.2rem;">
                        <div style="font-size: 0.825rem; font-weight: 700; color: var(--text-primary);">${n.title}</div>
                        <span style="font-size: 0.675rem; color: var(--text-tertiary); white-space: nowrap;">${n.time}</span>
                      </div>
                      <div style="font-size: 0.775rem; color: var(--text-secondary); line-height: 1.4;">${linkifyText(n.message)}</div>
                      
                      <!-- Individual Dismiss Button -->
                      <button class="btn-dismiss-notif" data-notif-id="${n.id}" style="position: absolute; top: 6px; right: 6px; background: none; border: none; font-size: 0.75rem; color: var(--text-tertiary); cursor: pointer; padding: 2px 4px; border-radius: 4px;" title="Dismiss">
                        ✕
                      </button>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>

            <!-- Profile Dropdown -->
            <div style="position: relative;" id="profile-dropdown-container">
              <button id="profile-menu-btn" style="background: var(--bg-surface-elevated); border: 1px solid var(--border-strong); padding: 0.25rem 0.65rem; border-radius: var(--radius-full); display: flex; align-items: center; gap: 0.5rem; cursor: pointer; color: var(--text-primary); outline: none; transition: all 0.2s;">
                <div style="width: 30px; height: 30px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), #8b5cf6); display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 800; color: #fff; flex-shrink: 0; box-shadow: 0 2px 6px rgba(124, 58, 237, 0.25);">
                  ${getInitials(user.name)}
                </div>
                <div class="user-profile-meta" style="text-align: left; line-height: 1.2;">
                  <div class="user-profile-name" style="font-size: 0.825rem; font-weight: 700; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${user.name}</div>
                  <span class="role-tag ${user.role}" style="font-size: 0.625rem; padding: 0.05rem 0.35rem;">${user.role}</span>
                </div>
                <span style="font-size: 0.65rem; color: var(--text-tertiary);">▼</span>
              </button>

              <!-- Profile Dropdown Menu -->
              <div id="profile-dropdown-menu" style="display: none; position: absolute; right: 0; top: 120%; background: var(--bg-surface); border: 1px solid var(--border-strong); border-radius: var(--radius-md); box-shadow: var(--shadow-modal); min-width: 220px; padding: 0.5rem; z-index: 200;">
                <div style="padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border-subtle); margin-bottom: 0.35rem;">
                  <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-primary);">${user.name}</div>
                  <div style="font-size: 0.75rem; color: var(--text-tertiary); word-break: break-all;">${user.email}</div>
                  <div style="font-size: 0.75rem; color: var(--primary); font-family: monospace; margin-top: 0.2rem;">PRN: ${user.prn || 'Not Set'}</div>
                </div>

                <button class="nav-dropdown-item" id="btn-menu-events">
                  🎉 Campus Events
                </button>

                <button class="nav-dropdown-item" id="btn-menu-passes">
                  🎫 My Passes & Certs
                </button>

                <button class="nav-dropdown-item" id="btn-menu-teams">
                  🤝 Teammate & Squad Hub
                </button>

                <button class="nav-dropdown-item" id="btn-menu-ideas">
                  💡 Campus Wishlist & Ideas
                </button>

                <button class="nav-dropdown-item" id="btn-menu-profile">
                  ✏️ Edit Profile
                </button>
                
                <button class="nav-dropdown-item" id="btn-menu-help">
                  🎧 Helpdesk & Support
                </button>

                <button class="nav-dropdown-item" id="btn-menu-report-grievance" style="color: #dc2626; font-weight: 600;">
                  🚨 Report Grievance / Incident
                </button>

                <div style="border-top: 1px solid var(--border-subtle); margin-top: 0.35rem; padding-top: 0.35rem;">
                  <button class="nav-dropdown-item danger" id="btn-menu-logout">
                    🚪 Sign Out
                  </button>
                </div>
              </div>
            </div>
          ` : `
            <button class="btn btn-primary btn-sm" id="btn-login-nav">Sign In</button>
          `}
        </div>
      </div>
    </nav>

    <!-- MOBILE BOTTOM NAVIGATION BAR (Fixed on Mobile Screens <= 768px) -->
    ${user ? `
      <nav class="mobile-bottom-nav">
        <button class="mobile-nav-btn ${activeRoute === 'events' ? 'active' : ''}" id="mob-nav-events">
          <span class="mob-icon">🎪</span>
          <span class="mob-label">Events</span>
        </button>
        <button class="mobile-nav-btn ${activeRoute === 'my-passes' ? 'active' : ''}" id="mob-nav-passes">
          <span class="mob-icon">🎫</span>
          <span class="mob-label">Passes</span>
        </button>
        <button class="mobile-nav-btn ${activeRoute === 'ideas' ? 'active' : ''}" id="mob-nav-ideas">
          <span class="mob-icon">💡</span>
          <span class="mob-label">Ideas</span>
        </button>
        ${isUserAdmin(user) ? `
          <button class="mobile-nav-btn ${activeRoute === 'admin' ? 'active' : ''}" id="mob-nav-admin">
            <span class="mob-icon">🛡️</span>
            <span class="mob-label">Admin</span>
          </button>
        ` : user.role === 'organizer' ? `
          <button class="mobile-nav-btn ${activeRoute === 'organizer' ? 'active' : ''}" id="mob-nav-organizer">
            <span class="mob-icon">⚡</span>
            <span class="mob-label">Org Hub</span>
          </button>
        ` : `
          <button class="mobile-nav-btn" id="mob-nav-teams">
            <span class="mob-icon">🤝</span>
            <span class="mob-label">Teams</span>
          </button>
        `}
        <button class="mobile-nav-btn" id="mob-nav-profile">
          <span class="mob-icon">👤</span>
          <span class="mob-label">Profile</span>
        </button>
      </nav>
    ` : ''}
  `;

  container.innerHTML = navHtml;

  // Navigation Links
  container.querySelector('#nav-brand')?.addEventListener('click', () => navigateTo('events'));
  container.querySelector('#nav-events-link')?.addEventListener('click', () => navigateTo('events'));
  container.querySelector('#nav-ideas')?.addEventListener('click', () => navigateTo('ideas'));
  container.querySelector('#nav-organizer')?.addEventListener('click', () => navigateTo('organizer'));
  container.querySelector('#nav-admin')?.addEventListener('click', () => navigateTo('admin'));

  container.querySelector('#btn-login-nav')?.addEventListener('click', () => navigateTo('login'));

  // Notification Bell Listeners
  const notifBtn = container.querySelector('#notif-bell-btn');
  const notifMenu = container.querySelector('#notif-dropdown-menu');

  if (notifBtn && notifMenu) {
    notifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      notifMenu.style.display = notifMenu.style.display === 'block' ? 'none' : 'block';
      if (dropdownMenu) dropdownMenu.style.display = 'none';
    });

    // Enable Push Notifications Click Handler
    container.querySelector('#btn-enable-push-notifs')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const btn = e.currentTarget;
      const banner = container.querySelector('#push-enable-banner');
      btn.disabled = true;
      btn.textContent = 'Enabling...';

      try {
        const res = await requestPushNotificationPermission(user);
        if (res.success || Notification.permission === 'granted') {
          localStorage.setItem('ep_push_banner_dismissed', 'true');
          btn.textContent = '✓ Active!';
          btn.style.background = '#10b981';
          if (banner) {
            banner.innerHTML = `
              <div style="font-size: 0.75rem; color: #059669; font-weight: 700; display: flex; align-items: center; gap: 0.35rem; width: 100%;">
                <span>✅</span> Lock-Screen Alerts Active!
              </div>
            `;
            setTimeout(() => {
              banner.style.opacity = '0';
              banner.style.height = '0';
              banner.style.padding = '0';
              banner.style.margin = '0';
              banner.style.overflow = 'hidden';
              setTimeout(() => banner.remove(), 300);
            }, 1200);
          }
        } else {
          btn.disabled = false;
          btn.textContent = res.reason === 'denied' ? 'Blocked in Browser' : 'Enable';
          if (res.reason === 'denied') {
            alert('Notifications were blocked in your browser settings. Please allow notifications from your browser address bar icon to receive alerts.');
          }
        }
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Enable';
      }
    });

    // Dismiss Push Notification Banner Handler
    container.querySelector('#btn-dismiss-push-banner')?.addEventListener('click', (e) => {
      e.stopPropagation();
      localStorage.setItem('ep_push_banner_dismissed', 'true');
      const banner = container.querySelector('#push-enable-banner');
      if (banner) {
        banner.style.opacity = '0';
        banner.style.height = '0';
        banner.style.padding = '0';
        banner.style.margin = '0';
        banner.style.overflow = 'hidden';
        setTimeout(() => banner.remove(), 300);
      }
    });

    // Auto-trigger push permission after 5 seconds if banner is visible and not already asked
    if (showPushBanner && !sessionStorage.getItem('ep_push_auto_asked')) {
      sessionStorage.setItem('ep_push_auto_asked', 'true');
      setTimeout(async () => {
        const banner = container.querySelector('#push-enable-banner');
        if (!banner) return; // Already dismissed
        const btn = container.querySelector('#btn-enable-push-notifs');
        if (btn) {
          btn.disabled = true;
          btn.textContent = 'Enabling...';
        }
        try {
          const res = await requestPushNotificationPermission(user);
          if (res.success || Notification.permission === 'granted') {
            localStorage.setItem('ep_push_banner_dismissed', 'true');
            if (banner) {
              banner.innerHTML = `
                <div style="font-size: 0.75rem; color: #059669; font-weight: 700; display: flex; align-items: center; gap: 0.35rem; width: 100%;">
                  <span>✅</span> Lock-Screen Alerts Active!
                </div>
              `;
              setTimeout(() => {
                banner.style.opacity = '0';
                banner.style.height = '0';
                banner.style.padding = '0';
                banner.style.margin = '0';
                banner.style.overflow = 'hidden';
                setTimeout(() => banner.remove(), 300);
              }, 1500);
            }
          } else {
            // User denied or dismissed — re-enable the manual button
            if (btn) {
              btn.disabled = false;
              btn.textContent = res.reason === 'denied' ? '🚫 Blocked' : 'Enable';
            }
          }
        } catch (err) {
          if (btn) { btn.disabled = false; btn.textContent = 'Enable'; }
        }
      }, 5000);
    }

    container.querySelector('#btn-mark-all-read')?.addEventListener('click', (e) => {
      e.stopPropagation();
      markAllNotificationsAsRead(user.uid, notifications);
      renderNavbar(container, activeRoute, navigateTo);
    });

    container.querySelector('#btn-clear-all-notifs')?.addEventListener('click', (e) => {
      e.stopPropagation();
      clearAllNotifications(user.uid, notifications);
      renderNavbar(container, activeRoute, navigateTo);
    });

    container.querySelectorAll('.btn-dismiss-notif').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const notifId = e.currentTarget.getAttribute('data-notif-id');
        dismissNotification(user.uid, notifId);
        renderNavbar(container, activeRoute, navigateTo);
      });
    });

    container.querySelectorAll('.notif-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const notifId = e.currentTarget.getAttribute('data-notif-id');
        const route = e.currentTarget.getAttribute('data-route') || 'events';
        markNotificationAsRead(user.uid, notifId);
        notifMenu.style.display = 'none';
        navigateTo(route);
      });
    });
  }

  // Profile Dropdown Toggle
  const menuBtn = container.querySelector('#profile-menu-btn');
  const dropdownMenu = container.querySelector('#profile-dropdown-menu');

  if (menuBtn && dropdownMenu) {
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
      if (notifMenu) notifMenu.style.display = 'none';
    });

    document.addEventListener('click', (e) => {
      if (!container.contains(e.target)) {
        dropdownMenu.style.display = 'none';
        if (notifMenu) notifMenu.style.display = 'none';
      }
    });

    container.querySelector('#btn-menu-events')?.addEventListener('click', () => {
      dropdownMenu.style.display = 'none';
      navigateTo('events');
    });

    container.querySelector('#btn-menu-passes')?.addEventListener('click', () => {
      dropdownMenu.style.display = 'none';
      navigateTo('my-passes');
    });

    container.querySelector('#btn-menu-teams')?.addEventListener('click', () => {
      dropdownMenu.style.display = 'none';
      openTeamFinderModal();
    });

    container.querySelector('#btn-menu-ideas')?.addEventListener('click', () => {
      dropdownMenu.style.display = 'none';
      navigateTo('ideas');
    });

    container.querySelector('#btn-menu-profile')?.addEventListener('click', () => {
      dropdownMenu.style.display = 'none';
      openEditProfileModal(user, () => renderNavbar(container, activeRoute, navigateTo));
    });

    container.querySelector('#btn-menu-help')?.addEventListener('click', () => {
      dropdownMenu.style.display = 'none';
      openHelpDeskModal();
    });

    container.querySelector('#btn-menu-report-grievance')?.addEventListener('click', () => {
      dropdownMenu.style.display = 'none';
      openComplaintModal();
    });

    container.querySelector('#btn-menu-logout')?.addEventListener('click', async () => {
      dropdownMenu.style.display = 'none';
      await logoutUser();
      navigateTo('login');
    });
  }

  // Mobile Bottom Navigation Listeners
  container.querySelector('#mob-nav-events')?.addEventListener('click', () => navigateTo('events'));
  container.querySelector('#mob-nav-passes')?.addEventListener('click', () => navigateTo('my-passes'));
  container.querySelector('#mob-nav-ideas')?.addEventListener('click', () => navigateTo('ideas'));
  container.querySelector('#mob-nav-organizer')?.addEventListener('click', () => navigateTo('organizer'));
  container.querySelector('#mob-nav-admin')?.addEventListener('click', () => navigateTo('admin'));
  container.querySelector('#mob-nav-teams')?.addEventListener('click', () => openTeamFinderModal());
  container.querySelector('#mob-nav-profile')?.addEventListener('click', () => {
    openEditProfileModal(user, () => renderNavbar(container, activeRoute, navigateTo));
  });
}
