/// <reference lib="webworker" />
// Service worker: offline app shell, Web Push display and notification taps.
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheFirst } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();
clientsClaim();
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
// Single-page app: every navigation serves index.html from the cache.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));
// Recipe photos: kept on the phone once seen, so each downloads once (the
// browser's HTTP cache can be evicted at any time, especially on iOS).
registerRoute(
  ({ url, request }) => url.origin === self.location.origin && url.pathname.startsWith('/recipe-photos/')
    && request.destination === 'image',
  new CacheFirst({
    cacheName: 'recipe-photos',
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 60 * 86_400, purgeOnQuotaError: true }),
    ],
  }),
);

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

self.addEventListener('push', (event) => {
  let data: PushPayload = { title: 'Dineamite', body: '' };
  try {
    data = { ...data, ...(event.data?.json() as PushPayload) };
  } catch {
    data.body = event.data?.text() ?? '';
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url ?? '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data?.url as string) ?? '/', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const w of windows) {
        if ('focus' in w) {
          await w.focus();
          await (w as WindowClient).navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
