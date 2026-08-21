import { getStudentRegistrations, getCachedRegistrationsSync } from './registrations';
import { getStudentCertificates, getCachedCertificatesSync } from './certificates';
import { getCachedAnnouncementsSync } from './announcements';

export async function getStudentNotifications(user) {
  if (!user) return [];

  const readSet = new Set(JSON.parse(localStorage.getItem('ep_read_notifications_' + user.uid) || '[]'));
  const dismissedSet = new Set(JSON.parse(localStorage.getItem('ep_dismissed_notifications_' + user.uid) || '[]'));
  
  const regs = getCachedRegistrationsSync(user.uid) || [];
  const certs = getCachedCertificatesSync(user.uid) || [];
  const notices = getCachedAnnouncementsSync() || [];

  const notifs = [];

  // Campus Notice Broadcast Notifications
  notices.forEach(n => {
    const id = 'notice_' + n.id;
    const isDeptMatch = !n.targetDept || n.targetDept.toLowerCase() === 'all' || (user.department && n.targetDept.toLowerCase().includes(user.department.toLowerCase()));

    if (isDeptMatch && !dismissedSet.has(id)) {
      notifs.push({
        id,
        title: '📢 New Campus Notice Broadcast!',
        message: `"${n.title}": ${n.message ? (n.message.length > 70 ? n.message.substring(0, 70) + '...' : n.message) : 'Official university circular published.'}`,
        time: n.postedAt ? new Date(n.postedAt).toLocaleDateString() : 'Recent',
        type: 'announcement',
        route: 'events',
        isRead: readSet.has(id)
      });
    }
  });

  // Welcome Notification
  if (!dismissedSet.has('welcome_' + user.uid)) {
    notifs.push({
      id: 'welcome_' + user.uid,
      title: '⚡ Welcome to EventPulse!',
      message: `Hello ${user.name}! Browse approved hackathons, sports, and tech events on campus.`,
      time: 'Just now',
      type: 'welcome',
      route: 'events',
      isRead: readSet.has('welcome_' + user.uid)
    });
  }

  // Certificate Notifications
  certs.forEach(c => {
    const id = 'cert_' + c.id;
    if (!dismissedSet.has(id)) {
      notifs.push({
        id,
        title: '🏆 Verified Certificate Issued!',
        message: `Congratulations! Official certificate for "${c.eventTitle}" is ready to download.`,
        time: new Date(c.issuedAt || Date.now()).toLocaleDateString(),
        type: 'certificate',
        route: 'my-passes',
        isRead: readSet.has(id)
      });
    }
  });

  // Registration Status Notifications
  regs.forEach(r => {
    const id = 'reg_' + r.id + '_' + r.status;
    if (!dismissedSet.has(id)) {
      let title = '⏳ Registration Submitted';
      let msg = `Your registration for "${r.eventTitle}" is pending approval.`;
      
      if (r.status === 'approved') {
        title = '🎉 Pass Approved!';
        msg = `Your Digital QR Pass for "${r.eventTitle}" is ready! Tap to view your pass.`;
      } else if (r.status === 'attended') {
        title = '✅ Attendance Verified';
        msg = `You attended "${r.eventTitle}". Your certificate is being processed.`;
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

  return notifs;
}

export function markNotificationAsRead(userId, notifId) {
  try {
    const readSet = new Set(JSON.parse(localStorage.getItem('ep_read_notifications_' + userId) || '[]'));
    readSet.add(notifId);
    localStorage.setItem('ep_read_notifications_' + userId, JSON.stringify(Array.from(readSet)));
  } catch (e) {}
}

export function markAllNotificationsAsRead(userId, notifs) {
  try {
    const ids = notifs.map(n => n.id);
    localStorage.setItem('ep_read_notifications_' + userId, JSON.stringify(ids));
  } catch (e) {}
}

export function dismissNotification(userId, notifId) {
  try {
    const dismissedSet = new Set(JSON.parse(localStorage.getItem('ep_dismissed_notifications_' + userId) || '[]'));
    dismissedSet.add(notifId);
    localStorage.setItem('ep_dismissed_notifications_' + userId, JSON.stringify(Array.from(dismissedSet)));
  } catch (e) {}
}

export function clearAllNotifications(userId, notifs) {
  try {
    const ids = notifs.map(n => n.id);
    localStorage.setItem('ep_dismissed_notifications_' + userId, JSON.stringify(ids));
  } catch (e) {}
}
