// Web Push handlers — imported into the next-pwa generated service worker
// via the `importScripts` option in next.config.ts. Static file: next-pwa
// does NOT overwrite this (it only regenerates sw.js + workbox-*.js).

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: 'Chief Arti', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Chief Arti 🍳';
  const options = {
    body: payload.body || 'Aaj kya banao?',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: payload.url || '/home' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/home';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    }),
  );
});
