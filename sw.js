// EventPulse Background Service Worker for Native Mobile & Push Notifications
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Handle Background Push Notifications
self.addEventListener('push', (event) => {
  let data = { title: '🔔 EventPulse Alert', body: 'New event posted on campus portal!' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body || 'Check out the new campus event!',
    icon: '/eventpulse-logo.jpg',
    badge: '/eventpulse-logo.jpg',
    vibrate: [200, 100, 200, 100, 200],
    data: { url: data.url || 'https://eventpulse-su.web.app' },
    actions: [
      { action: 'open', title: '📲 Open EventPulse' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || '🚨 EventPulse Campus Notice', options)
  );
});

// Handle Notification Tap / Click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = (event.notification.data && event.notification.data.url) ? event.notification.data.url : 'https://eventpulse-su.web.app';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
