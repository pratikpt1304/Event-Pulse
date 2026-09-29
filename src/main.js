import './styles/main.css';
import { initAuthListener, subscribeAuth, getCurrentUser, logoutUser } from './services/auth';
import { getHashRoute, navigateTo, checkRouteGuard } from './router';
import { renderNavbar } from './components/Navbar';
import { renderLoginView } from './views/LoginView';
import { renderEventsView } from './views/EventsView';
import { renderStudentPassesView } from './views/StudentPassesView';
import { renderOrganizerDashView } from './views/OrganizerDashView';
import { renderExecutiveDashboardView } from './views/ExecutiveDashboardView';
import { renderAdminView } from './views/AdminView';
import { renderVerifyCertView } from './views/VerifyCertView';
import { renderIdeaHubView } from './views/IdeaHubView';
import { initPulseAIChatWidget } from './components/PulseAIChatWidget';
import { initForegroundNotificationListener, requestPushNotificationPermission } from './services/fcm';

const appContainer = document.getElementById('app');

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

  // Route Guard Enforcement
  const guard = checkRouteGuard(routeName, user);
  if (!guard.allowed) {
    if (guard.reason && routeName !== 'login') {
      alert(`🔒 ${guard.reason}`);
    }
    navigateTo(guard.redirect || 'login');
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

  if (routeName === 'verify') {
    await renderVerifyCertView(viewMount, routeParam);
  } else if (routeName === 'login') {
    renderLoginView(viewMount, navigateTo);
  } else if (routeName === 'my-passes') {
    await renderStudentPassesView(viewMount, navigateTo);
  } else if (routeName === 'organizer') {
    await renderOrganizerDashView(viewMount, navigateTo);
  } else if (routeName === 'executive') {
    await renderExecutiveDashboardView(viewMount, navigateTo);
  } else if (routeName === 'admin') {
    await renderAdminView(viewMount, navigateTo);
  } else if (routeName === 'ideas') {
    await renderIdeaHubView(viewMount, navigateTo);
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

subscribeAuth((user) => {
  renderApp();
  if (user && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    requestPushNotificationPermission(user).catch(() => {});
  }
});

// Register FCM Background Service Worker if supported
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/firebase-messaging-sw.js').catch((err) => {
    console.log('FCM Service worker registration note:', err.message);
  });
}
