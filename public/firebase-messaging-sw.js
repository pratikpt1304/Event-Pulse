/**
 * EventPulse — Firebase Cloud Messaging (FCM) Background Service Worker
 * Handles background push notifications when website is closed or in background.
 */

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyCOCFGsYq_-sBMij5tS3P4qFal-NxmClFM",
  authDomain: "eventpulse-su-34a42.firebaseapp.com",
  projectId: "eventpulse-su-34a42",
  storageBucket: "eventpulse-su-34a42.firebasestorage.app",
  messagingSenderId: "190541768232",
  appId: "1:190541768232:web:08e403f458f7bbc91cf71d",
  measurementId: "G-NJW2ENJCV3"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Handle Background Push Messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || '⚡ EventPulse Campus Alert';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'New campus update is available on EventPulse.',
    icon: payload.notification?.icon || '/logo.jpg',
    badge: '/logo.jpg',
    data: {
      url: payload.data?.url || payload.fcmOptions?.link || 'https://eventpulse-su-34a42.web.app/#events'
    },
    vibrate: [200, 100, 200]
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle Notification Click (Opens the App / Specific Route)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || 'https://eventpulse-su-34a42.web.app/#events';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If a window is already open, focus it and navigate
      for (const client of windowClients) {
        if (client.url.includes('eventpulse') && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
