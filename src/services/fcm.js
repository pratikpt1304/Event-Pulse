import { messaging, messagingReady, db } from '../firebase';
import { getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion, setDoc } from 'firebase/firestore';

export const VAPID_KEY = 'BIG7XhKJA_MQlG0IgpgTi1LPUBXE0kQ26mtY8eO0WIWBm8sxgPrcNAKyTPvdPu3mL0-8gm5vwadS5wtATCjgnQA';

/**
 * Checks if browser supports Web Push Notifications
 */
export function isPushNotificationSupported() {
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

/**
 * Gets current notification permission status ('default' | 'granted' | 'denied')
 */
export function getNotificationPermissionStatus() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

/**
 * Requests push notification permission and registers FCM device token in Firestore
 */
export async function requestPushNotificationPermission(user) {
  if (!isPushNotificationSupported()) {
    console.warn('Push notifications are not supported in this browser.');
    return { success: false, reason: 'unsupported' };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, reason: 'denied' };
    }

    const supported = await isSupported();
    if (!supported) {
      return { success: false, reason: 'messaging_unsupported' };
    }

    // Wait for messaging to be fully initialized
    const msgInstance = await messagingReady;
    if (!msgInstance) {
      return { success: false, reason: 'messaging_unsupported' };
    }

    // Register service worker for messaging and ensure it is ready
    let registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
    if (!registration) {
      registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    }
    const readyReg = await navigator.serviceWorker.ready;

    // Get FCM Token
    const currentToken = await getToken(msgInstance, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: readyReg || registration
    });

    if (currentToken) {
      console.log('⚡ FCM Device Token received:', currentToken);
      localStorage.setItem('ep_fcm_token', currentToken);

      // 1. ALWAYS save token to global fcm_tokens registry (even for guests / before login)
      try {
        const tokenRef = doc(db, 'fcm_tokens', currentToken.replace(/[^a-zA-Z0-9_-]/g, '_'));
        await setDoc(tokenRef, {
          token: currentToken,
          userId: user?.uid || 'guest_device',
          userName: user?.name || user?.displayName || 'Student / Campus Device',
          department: user?.department || 'All Departments',
          role: user?.role || 'student',
          updatedAt: new Date().toISOString()
        }, { merge: true });
      } catch (dbErr) {
        console.warn('Error saving global FCM token:', dbErr);
      }

      // 2. If user is authenticated, also link token directly to their user profile
      if (user && user.uid) {
        try {
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, {
            fcmTokens: arrayUnion(currentToken),
            notificationsEnabled: true,
            lastTokenUpdate: new Date().toISOString()
          }).catch(async () => {
            await setDoc(userRef, {
              fcmTokens: [currentToken],
              notificationsEnabled: true,
              lastTokenUpdate: new Date().toISOString()
            }, { merge: true });
          });
        } catch (dbErr) {
          console.warn('Error updating user doc with FCM token:', dbErr);
        }
      }

      return { success: true, token: currentToken };
    } else {
      return { success: false, reason: 'no_token' };
    }
  } catch (err) {
    console.error('Error enabling push notifications:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Listens for incoming push messages while app is in foreground
 */
export function initForegroundNotificationListener(onNotificationReceived) {
  messagingReady.then((msgInstance) => {
    if (!msgInstance) return;

    onMessage(msgInstance, (payload) => {
      console.log('[FCM] Foreground message received:', payload);

      const title = payload.notification?.title || payload.data?.title || '⚡ EventPulse Alert';
      const body = payload.notification?.body || payload.data?.body || 'New campus update is available.';
      const url = payload.data?.url || payload.fcmOptions?.link || 'https://eventpulse-su-34a42.web.app/#events';

      // 1. Show native OS notification banner
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(title, {
            body,
            icon: '/logo.jpg',
            badge: '/logo.jpg',
            data: { url }
          });
        }).catch(() => {
          try {
            new Notification(title, { body, icon: '/logo.jpg' });
          } catch(e) {}
        });
      }

      // 2. Show in-app banner or toast
      showInAppNotificationBanner({
        title,
        body,
        url
      });

      if (onNotificationReceived) {
        onNotificationReceived(payload);
      }
    });
  }).catch(() => {});
}

/**
 * Displays a styled floating toast for foreground push notifications
 */
function showInAppNotificationBanner({ title, body, url }) {
  const existing = document.getElementById('ep-foreground-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'ep-foreground-toast';
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 100000;
    max-width: 380px;
    width: 90%;
    background: linear-gradient(135deg, #1e1b4b, #0f172a);
    border: 1px solid rgba(139, 92, 246, 0.4);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    border-radius: 14px;
    padding: 1rem 1.25rem;
    color: #ffffff;
    display: flex;
    gap: 0.85rem;
    align-items: flex-start;
    animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    cursor: pointer;
  `;

  toast.innerHTML = `
    <div style="font-size: 1.5rem; flex-shrink: 0; background: rgba(139, 92, 246, 0.2); width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(139, 92, 246, 0.3);">
      🔔
    </div>
    <div style="flex: 1; overflow: hidden;">
      <div style="font-size: 0.9rem; font-weight: 800; color: #ffffff; margin-bottom: 0.25rem; letter-spacing: -0.01em;">
        ${title}
      </div>
      <div style="font-size: 0.8rem; color: #cbd5e1; line-height: 1.35;">
        ${body}
      </div>
      <div style="font-size: 0.725rem; color: #a78bfa; font-weight: 700; margin-top: 0.4rem;">
        Tap to view ➜
      </div>
    </div>
    <button id="btn-close-toast" style="background: none; border: none; color: #94a3b8; font-size: 1rem; cursor: pointer; padding: 0;">✕</button>
  `;

  document.body.appendChild(toast);

  toast.addEventListener('click', (e) => {
    if (e.target.id === 'btn-close-toast') {
      e.stopPropagation();
      toast.remove();
      return;
    }
    toast.remove();
    if (url) {
      if (url.startsWith('http')) {
        window.location.href = url;
      } else {
        window.location.hash = url.replace(/^#/, '');
      }
    }
  });

  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }
  }, 6000);
}
