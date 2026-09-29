import './styles/main.css';
import { initAuthListener, subscribeAuth, getCurrentUser, isUserAdmin, logoutUser } from './services/auth';
import { renderNavbar } from './components/Navbar';
import { renderLoginView } from './views/LoginView';
import { renderEventsView } from './views/EventsView';
import { renderStudentPassesView } from './views/StudentPassesView';
import { renderOrganizerDashView } from './views/OrganizerDashView';
import { renderAdminView } from './views/AdminView';
import { renderExecutiveDashboardView } from './views/ExecutiveDashboardView';
import { renderPortalGatewayView } from './views/PortalGatewayView';
import { renderVerifyCertView } from './views/VerifyCertView';
import { renderIdeaHubView } from './views/IdeaHubView';
import { renderMomentsWallView } from './views/MomentsWallView';
import { initPulseAIChatWidget } from './components/PulseAIChatWidget';
import { initForegroundNotificationListener, requestPushNotificationPermission } from './services/fcm';

const appContainer = document.getElementById('app');

function getHashRoute() {
  const hash = window.location.hash.slice(1);
  if (!hash) return { name: 'portal', param: null };
  const parts = hash.split('/');
  return { name: parts[0], param: parts[1] || null };
}

export function navigateTo(routeName, param = null) {
  if (param) {
    window.location.hash = `${routeName}/${param}`;
  } else {
    window.location.hash = routeName;
  }
}

async function renderApp() {
  const { name: routeName, param: routeParam } = getHashRoute();
  const user = getCurrentUser();

  // Hard Ban Check
  if (user && user.status === 'banned') {
    alert(`⛔ ACCOUNT SUSPENDED\n\nYour EventPulse access has been revoked by University Administration.`);
    await logoutUser();
    window.location.hash = 'login';
    return;
  }

  // 1. Render Top Shell / Navbar
  let navbarMount = document.getElementById('navbar-mount');
  if (!navbarMount) {
    appContainer.innerHTML = `
      <div id="navbar-mount"></div>
      <main class="main-content container" id="view-mount"></main>
    `;
    navbarMount = document.getElementById('navbar-mount');
  }

  if (routeName !== 'login') {
    await renderNavbar(navbarMount, routeName, navigateTo);
  } else {
    navbarMount.innerHTML = '';
  }

  // 2. Render Target View
  const viewMount = document.getElementById('view-mount');

  if (routeName === 'portal' || routeName === 'gateway') {
    renderPortalGatewayView(viewMount, navigateTo);
  } else if (routeName === 'verify') {
    await renderVerifyCertView(viewMount, routeParam);
  } else if (routeName === 'login') {
    if (user) {
      navigateTo('portal');
      return;
    }
    renderLoginView(viewMount, navigateTo);
  } else if (routeName === 'my-passes') {
    if (!user) {
      navigateTo('login');
      return;
    }
    await renderStudentPassesView(viewMount, navigateTo);
  } else if (routeName === 'organizer') {
    // Route Protection: Requires organizer or admin
    const isOrganizerOrAdmin = user && (user.role === 'organizer' || isUserAdmin(user));
    if (!isOrganizerOrAdmin) {
      alert('⛔ Access Denied: You must have an Organizer or Admin role assigned in your profile to access this hub.');
      navigateTo('events');
      return;
    }
    await renderOrganizerDashView(viewMount, navigateTo);
  } else if (routeName === 'admin') {
    // Route Protection: Requires admin role
    const isAdmin = isUserAdmin(user);
    if (!isAdmin) {
      alert('⛔ Access Denied: Administrator privileges required.');
      navigateTo('events');
      return;
    }
    await renderAdminView(viewMount, navigateTo);
  } else if (routeName === 'vc') {
    await renderExecutiveDashboardView(viewMount, 'vc', navigateTo);
  } else if (routeName === 'dean') {
    await renderExecutiveDashboardView(viewMount, 'dean', navigateTo);
  } else if (routeName === 'hod') {
    await renderExecutiveDashboardView(viewMount, 'hod', navigateTo);
  } else if (routeName === 'ideas') {
    await renderIdeaHubView(viewMount, navigateTo);
  } else if (routeName === 'moments') {
    await renderMomentsWallView(viewMount, navigateTo);
  } else {
    // Default: 'events'
    await renderEventsView(viewMount, navigateTo);
  }
}

window.addEventListener('hashchange', () => {
  renderApp();
});

initAuthListener();
initPulseAIChatWidget(navigateTo);
initForegroundNotificationListener();

// Auto-register / refresh token on load if permission is already granted
if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
  requestPushNotificationPermission(getCurrentUser()).catch(() => {});
}

subscribeAuth((user) => {
  renderApp();
  // If notifications were already granted, quietly register / refresh token with updated user details
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    requestPushNotificationPermission(user).catch(() => {});
  }
});

// Register FCM Background Service Worker if supported
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/firebase-messaging-sw.js').catch((err) => {
    console.log('FCM Service worker registration note:', err.message);
  });
}
