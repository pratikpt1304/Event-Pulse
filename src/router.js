import { getCurrentUser, isUserAdmin } from './services/auth';

/**
 * Route metadata and allowed roles
 * Empty allowedRoles array means public or all authenticated users
 */
export const ROUTES_CONFIG = {
  login: {
    title: 'Sign In & Student Registration - EventPulse',
    public: true,
    allowedRoles: []
  },
  events: {
    title: 'Campus Events & Announcements - EventPulse',
    public: false,
    allowedRoles: ['student', 'organizer', 'admin']
  },
  'my-passes': {
    title: 'Digital QR Passes - EventPulse',
    public: false,
    allowedRoles: ['student', 'admin']
  },
  organizer: {
    title: 'Organizer Hub & Gate Scanner - EventPulse',
    public: false,
    allowedRoles: ['organizer', 'admin']
  },
  executive: {
    title: 'Executive Academic Dashboard (HOD/Dean/VC) - EventPulse',
    public: false,
    allowedRoles: ['hod', 'dean', 'vc', 'admin']
  },
  admin: {
    title: 'Administration Console & Institutional Oversight - EventPulse',
    public: false,
    allowedRoles: ['admin', 'vc']
  },
  ideas: {
    title: 'Campus Wishlist & Ideas - EventPulse',
    public: false,
    allowedRoles: ['student', 'organizer', 'hod', 'dean', 'vc', 'admin']
  },
  verify: {
    title: 'Verify Certificate - EventPulse',
    public: true,
    allowedRoles: []
  }
};

export function getRoleDefaultRoute(role) {
  switch (role) {
    case 'admin':
    case 'vc':
      return 'admin';
    case 'organizer':
      return 'organizer';
    case 'hod':
    case 'dean':
      return 'executive';
    case 'student':
    default:
      return 'events';
  }
}

export function getHashRoute() {
  const hash = window.location.hash.slice(1);
  if (!hash) {
    const user = getCurrentUser();
    if (user && user.role && user.role !== 'student') {
      return { name: getRoleDefaultRoute(user.role), param: null };
    }
    return { name: 'events', param: null };
  }
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

/**
 * Verifies if the current user has permission to view the target route.
 * Returns { allowed: boolean, redirect: string | null, reason: string | null }
 */
export function checkRouteGuard(routeName, user) {
  const config = ROUTES_CONFIG[routeName] || ROUTES_CONFIG.events;

  // 1. If user is logged in and visits 'login', redirect to their role dashboard
  if (routeName === 'login' && user) {
    return {
      allowed: false,
      redirect: getRoleDefaultRoute(user.role),
      reason: 'Already authenticated'
    };
  }

  // 2. Public routes (verify, login for unauthenticated)
  if (config.public) {
    return { allowed: true, redirect: null, reason: null };
  }

  // 3. Protected route: requires authentication
  if (!user) {
    return {
      allowed: false,
      redirect: 'login',
      reason: 'Authentication required. Please sign in.'
    };
  }

  // 4. Role-based permission check
  const role = user.role || 'student';
  const isAdmin = isUserAdmin(user) || role === 'admin';

  if (isAdmin) {
    // Admins have access across all dashboards
    return { allowed: true, redirect: null, reason: null };
  }

  if (config.allowedRoles && config.allowedRoles.length > 0) {
    if (!config.allowedRoles.includes(role)) {
      return {
        allowed: false,
        redirect: getRoleDefaultRoute(role),
        reason: `Access restricted. Your role (${role}) cannot access the ${routeName} view.`
      };
    }
  }

  return { allowed: true, redirect: null, reason: null };
}
