// 오프라인(지하철 터널)은 유지하되, 배포한 변경이 다음 실행에 바로 보이게 한다.
//
// 전부 cache-first로 두면 새 버전이 설치돼도 그 실행에서는 옛 파일이 그대로
// 나가서, 사용자는 한 번 더 열어야 바뀐 걸 본다. 그래서 자주 바뀌는 셸
// (HTML/CSS/JS)만 network-first로 돌리고, 거의 안 바뀌는 아이콘·manifest는
// cache-first로 남긴다. 네트워크가 느리면 타임아웃으로 캐시에 떨어진다.
const VERSION = 'rr-v3-008';
const NET_TIMEOUT_MS = 2500;

const SHELL = [
  './', './index.html', './styles.css',
  './app.js', './logic.js', './data.js', './store.js', './illustrations.js', './glyphs.js',
];
const STATIC = [
  './manifest.webmanifest',
  './icons/icon-180.png', './icons/icon-192.png',
  './icons/icon-512.png', './icons/icon-512-maskable.png',
];
const ASSETS = [...SHELL, ...STATIC];

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

// 셸인지 판정. 단축어가 ?steps=... 를 붙여 열기 때문에 쿼리는 무시한다.
function isShell(url, request) {
  if (request.mode === 'navigate') return true;
  return /\.(?:html|css|js)$/.test(url.pathname);
}

function fromCache(request) {
  return caches.match(request, { ignoreSearch: true })
    .then((hit) => hit || caches.match('./index.html'));
}

function networkFirst(request) {
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), NET_TIMEOUT_MS));
  const network = fetch(request)
    .then((res) => {
      if (res && res.ok && request.method === 'GET') {
        const copy = res.clone();
        // 쿼리 없는 키로 저장해야 ?steps=... 로 열어도 같은 항목을 맞힌다.
        caches.open(VERSION).then((c) => c.put(new Request(request.url.split('?')[0]), copy))
          .catch(() => { /* 저장 실패는 무시 */ });
      }
      return res;
    })
    .catch(() => null);

  return Promise.race([network, timeout])
    .then((res) => res || network.catch(() => null))
    .then((res) => res || fromCache(request));
}

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    isShell(url, request)
      ? networkFirst(request)
      : fromCache(request).then((hit) => hit || fetch(request))
  );
});
