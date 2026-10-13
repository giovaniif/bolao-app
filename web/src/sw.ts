import { openNotificationTarget, parsePushPayload, toNotification } from './serviceWorker/push';

declare const self: ServiceWorkerGlobalScope;

self.addEventListener('install', () => {
  void self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let raw: unknown = null;
  try {
    raw = event.data?.json();
  } catch {
    raw = null;
  }
  const { title, options } = toNotification(parsePushPayload(raw));
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) =>
        openNotificationTarget(event.notification.data, self.location.origin, clients, (url) =>
          self.clients.openWindow(url),
        ),
      ),
  );
});
