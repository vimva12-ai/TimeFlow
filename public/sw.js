// TimeFlow Service Worker

// ── Push 알림 ──────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title ?? 'TimeFlow';
  const options = {
    body: data.body ?? '곧 시작할 슬롯이 있습니다.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.slotId ?? 'timeflow-notification',
    data: { url: data.url ?? '/app/today', slotId: data.slotId },
    actions: [
      { action: 'open', title: '열기' },
      { action: 'dismiss', title: '닫기' },
    ],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url ?? '/app/today';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ── App Shell 캐시 (CacheFirst) ────────────────────────────────
const SHELL_CACHE = 'timeflow-shell-v1';
const SHELL_URLS = ['/', '/app/today', '/offline.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── 네트워크 요청 전략 ─────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Supabase API — NetworkFirst
  if (url.hostname.endsWith('supabase.co')) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open('timeflow-api-v1').then((c) => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // App Shell — CacheFirst
  if (request.mode === 'navigate' || SHELL_URLS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached ?? fetch(request).catch(() => caches.match('/offline.html')))
    );
    return;
  }
});
