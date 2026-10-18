// app shell을 cache-first로 잡는다. 외부 의존성이 없어 오프라인이 완전히 동작한다.
const VERSION = 'rr-v3-003'; // 배포할 때마다 올린다
const ASSETS = [
  './', './index.html', './styles.css',
  './app.js', './logic.js', './data.js', './store.js',
  './manifest.webmanifest',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png',
  './icons/icon-512-maskable.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  // ignoreSearch: 단축어가 ?steps=... 를 붙여 열기 때문에 쿼리가 달라도 캐시를 맞혀야 한다.
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) =>
      hit || fetch(e.request).catch(() => caches.match('./index.html'))
    )
  );
});
