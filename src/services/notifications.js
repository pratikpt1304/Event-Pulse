import { getStudentRegistrations, getCachedRegistrationsSync } from './registrations';
import { getStudentCertificates, getCachedCertificatesSync } from './certificates';
import { getCachedAnnouncementsSync } from './announcements';
import { getCachedEventsSync } from './events';

export async function getStudentNotifications(user) {
  if (!user) return [];

  const readSet = new Set(JSON.parse(localStorage.getItem('ep_read_notifications_' + user.uid) || '[]'));
  const dismissedSet = new Set(JSON.parse(localStorage.getItem('ep_dismissed_notifications_' + user.uid) || '[]'));
  
  const regs = getCachedRegistrationsSync(user.uid) || [];
  const certs = getCachedCertificatesSync(user.uid) || [];
  const notices = getCachedAnnouncementsSync() || [];
  const events = getCachedEventsSync() || [];

  const notifs = [];

  // 1. Welcome Notification
  const welcomeId = 'welcome_' + user.uid;
  if (!dismissedSet.has(welcomeId)) {
    notifs.push({
      id: welcomeId,
      title: '⚡ Welcome to EventPulse!',
      message: `Hello ${user.name}! Your role is configured as ${user.role.toUpperCase()}.`,
      time: 'Just now',
      type: 'welcome',
      route: user.role === 'student' ? 'events' : (user.role === 'organizer' ? 'organizer' : 'executive'),
      isRead: readSet.has(welcomeId)
    });
  }

  // 2. Role-Based Notifications
  if (user.role === 'student') {
    // A. Certificates Earned
    certs.forEach(c => {
      const id = 'cert_' + c.id;
      if (!dismissedSet.has(id)) {
        notifs.push({
          id,
          title: '🏆 Verified Certificate Ready!',
          message: `Official certificate for "${c.eventTitle}" is issued and ready to download.`,
          time: new Date(c.issuedAt || Date.now()).toLocaleDateString(),
          type: 'certificate',
          route: 'my-passes',
          isRead: readSet.has(id)
        });
      }
    });

    // B. Registration Status Updates
    regs.forEach(r => {
      const id = 'reg_' + r.id + '_' + r.status;
      if (!dismissedSet.has(id)) {
        let title = '⏳ Registration Submitted';
        let msg = `Your registration for "${r.eventTitle}" is pending sanction.`;
        
        if (r.status === 'approved') {
          title = '🎉 Digital Pass Approved!';
          msg = `Your QR Pass for "${r.eventTitle}" is ready! Tap to view your entry pass.`;
        } else if (r.status === 'attended') {
          title = '✅ Attendance Verified';
          msg = `You attended "${r.eventTitle}". Your certificate is ready in your pass vault.`;
        } else if (r.status === 'waitlisted') {
          title = '📋 Added to Waitlist';
          msg = `You are on the waitlist for "${r.eventTitle}".`;
        }

        notifs.push({
          id,
          title,
          message: msg,
          time: new Date(r.registeredAt || Date.now()).toLocaleDateString(),
          type: r.status,
          route: 'my-passes',
          isRead: readSet.has(id)
        });
      }
    });

    // C. Approved Events Notification (Alerting students of new events)
    events.slice(0, 3).forEach(e => {
      const id = 'evt_live_' + e.id;
      if (!dismissedSet.has(id) && e.status === 'approved') {
        notifs.push({
          id,
          title: '🎪 New Campus Event Live!',
          message: `"${e.title}" is officially approved. Book your free student pass now!`,
          time: e.date || 'Upcoming',
          type: 'event_approved',
          route: 'events',
          isRead: readSet.has(id)
        });
      }
    });

    // D. Active Grievance Update
    const grievanceId = 'grv_status_' + user.uid;
    if (!dismissedSet.has(grievanceId)) {
      notifs.push({
        id: grievanceId,
        title: '⚖️ Grievance Docket Active',
        message: 'Ticket GRV-2026-0091 is active and monitored by Department Head & Dean.',
        time: 'Today',
        type: 'grievance',
        route: 'my-passes',
        isRead: readSet.has(grievanceId)
      });
    }

  } else if (user.role === 'organizer') {
    // Organizer Alerts: Event Sanction Status & Attendee Registrations
    events.forEach(e => {
      if (e.status === 'approved') {
        const id = 'org_approved_' + e.id;
        if (!dismissedSet.has(id)) {
          notifs.push({
            id,
            title: '🎉 Event Officially Approved!',
            message: `"${e.title}" has been sanctioned by academic administration. Live registrations open!`,
            time: 'Live',
            type: 'event_approved',
            route: 'organizer',
            isRead: readSet.has(id)
          });
        }
      } else if (e.status === 'pending') {
        const id = 'org_pending_' + e.id;
        if (!dismissedSet.has(id)) {
          notifs.push({
            id,
            title: '⏳ Sanction In Progress',
            message: `"${e.title}" is in review with HOD & Dean of Engineering.`,
            time: 'Pending',
            type: 'event_pending',
            route: 'organizer',
            isRead: readSet.has(id)
          });
        }
      }
    });

    // Roster / Scanner Quick Link
    const scannerNotifId = 'org_scanner_ready_' + user.uid;
    if (!dismissedSet.has(scannerNotifId)) {
      notifs.push({
        id: scannerNotifId,
        title: '📱 QR Check-In Scanner Ready',
        message: 'Camera QR scanner is active for live student check-ins and instant certificate issuance.',
        time: 'Active',
        type: 'scanner',
        route: 'organizer',
        isRead: readSet.has(scannerNotifId)
      });
    }

  } else if (['hod', 'dean', 'vc'].includes(user.role)) {
    // Executive Leadership Notifications
    const roleTitle = user.role === 'hod' ? 'Department HOD' : (user.role === 'dean' ? 'School Dean' : 'Vice Chancellor');
    
    // Approval pipeline status
    const pendingEvents = events.filter(e => e.status === 'pending');
    if (pendingEvents.length > 0) {
      const id = 'exec_pending_events';
      if (!dismissedSet.has(id)) {
        notifs.push({
          id,
          title: `📋 ${pendingEvents.length} Event(s) Awaiting Sanction`,
          message: `Organizer proposals require ${roleTitle} review and budgetary sign-off.`,
          time: 'Urgent',
          type: 'approval_required',
          route: 'executive',
          isRead: readSet.has(id)
        });
      }
    } else {
      const id = 'exec_all_sanctioned';
      if (!dismissedSet.has(id)) {
        notifs.push({
          id,
          title: '✅ All Events Sanctioned',
          message: 'Campus event pipeline is clear. All active events have official approvals.',
          time: 'Status OK',
          type: 'status_ok',
          route: 'executive',
          isRead: readSet.has(id)
        });
      }
    }

    // Grievance Redressal
    const idGrv = 'exec_grv_alert';
    if (!dismissedSet.has(idGrv)) {
      notifs.push({
        id: idGrv,
        title: '⚖️ Grievance Redressal Oversight',
        message: '1 active student ticket (GRV-2026-0091) logged in Department Redressal Cell.',
        time: 'Active',
        type: 'grievance',
        route: 'executive',
        isRead: readSet.has(idGrv)
      });
    }

    // VC Specific Matrix Notice
    if (user.role === 'vc') {
      const idVc = 'vc_apex_matrix';
      if (!dismissedSet.has(idVc)) {
        notifs.push({
          id: idVc,
          title: '🏛️ Apex Institutional Matrix Live',
          message: 'NAAC / NIRF readiness metrics & Universal Student Directory active.',
          time: 'Today',
          type: 'apex',
          route: 'executive',
          isRead: readSet.has(idVc)
        });
      }
    }
  }

  // 3. Campus Broadcast Notices (for everyone matching dept)
  notices.forEach(n => {
    const id = 'notice_' + n.id;
    const isDeptMatch = !n.targetDept || n.targetDept.toLowerCase() === 'all' || (user.department && n.targetDept.toLowerCase().includes(user.department.toLowerCase()));

    if (isDeptMatch && !dismissedSet.has(id)) {
      notifs.push({
        id,
        title: '📢 Campus Notice Broadcast',
        message: `"${n.title}": ${n.message ? (n.message.length > 70 ? n.message.substring(0, 70) + '...' : n.message) : 'Official university circular.'}`,
        time: n.postedAt ? new Date(n.postedAt).toLocaleDateString() : 'Recent',
        type: 'announcement',
        route: 'events',
        isRead: readSet.has(id)
      });
    }
  });

  return notifs;
}

export function markNotificationAsRead(userId, notifId) {
  try {
    const readSet = new Set(JSON.parse(localStorage.getItem('ep_read_notifications_' + userId) || '[]'));
    readSet.add(notifId);
    localStorage.setItem('ep_read_notifications_' + userId, JSON.stringify(Array.from(readSet)));
    window.dispatchEvent(new CustomEvent('ep_notification_update'));
  } catch (e) {}
}

export function markAllNotificationsAsRead(userId, notifs) {
  try {
    const ids = notifs.map(n => n.id);
    localStorage.setItem('ep_read_notifications_' + userId, JSON.stringify(ids));
    window.dispatchEvent(new CustomEvent('ep_notification_update'));
  } catch (e) {}
}

export function dismissNotification(userId, notifId) {
  try {
    const dismissedSet = new Set(JSON.parse(localStorage.getItem('ep_dismissed_notifications_' + userId) || '[]'));
    dismissedSet.add(notifId);
    localStorage.setItem('ep_dismissed_notifications_' + userId, JSON.stringify(Array.from(dismissedSet)));
    window.dispatchEvent(new CustomEvent('ep_notification_update'));
  } catch (e) {}
}

export function clearAllNotifications(userId, notifs) {
  try {
    const ids = notifs.map(n => n.id);
    localStorage.setItem('ep_dismissed_notifications_' + userId, JSON.stringify(ids));
    window.dispatchEvent(new CustomEvent('ep_notification_update'));
  } catch (e) {}
}
