/* ───────────────────────────────────────────────
   Push notifications (Firebase Cloud Messaging)
   ─────────────────────────────────────────────── */
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyC-1Vxm47hKExg1vtdlISCAS2E0s27LwOE",
  authDomain: "malvern-shopping-list.firebaseapp.com",
  projectId: "malvern-shopping-list",
  storageBucket: "malvern-shopping-list.firebasestorage.app",
  messagingSenderId: "777547621261",
  appId: "1:777547621261:web:77f43796b9763dfda513c4"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.data?.title || 'Shopping List';
  const body = payload.data?.body || 'Your list was updated';
  self.registration.showNotification(title, {
    body,
    icon: '/images/icon-192.png',
    badge: '/images/icon-192.png',
    vibrate: [100, 50, 100]
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) return client.focus();
      }
      return clients.openWindow('/');
    })
  );
});

/* ───────────────────────────────────────────────
   Caching (unchanged logic, bumped cache version)
   ─────────────────────────────────────────────── */
const CACHE_NAME = 'malvern-shopping-list-v4';
const APP_SHELL_ASSETS = ['/', '/index.html', '/manifest.webmanifest', '/images/icon-192.png', '/images/icon-512.png', '/images/apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        return networkResponse;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/index.html')))
  );
});