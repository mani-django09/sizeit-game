// Network-first service worker: works offline after the first visit,
// but always prefers fresh files so updates show up immediately.
// tools/build.py replaces CACHE with a hash of the site's files, so every deploy that changes a file gets a new cache.
const CACHE = 'sg-dev';
const SHELL = [
  './', 'index.html', 'assets/style.css', 'assets/common.js', 'fonts/bricolage-latin.woff2', 'fonts/bricolage-latin-ext.woff2', 'data/objects.js', 'icon.svg', 'manifest.webmanifest', 'icons/icon-192.png',
  'size-it-up/', 'size-it-up/index.html', 'size-it-up/game.js',
  'which-is-heavier/', 'which-is-heavier/index.html', 'which-is-heavier/game.js',
  'number-guess/', 'number-guess/index.html', 'number-guess/game.js', 'data/numbers.js',
  'sort-it/', 'sort-it/index.html', 'sort-it/game.js',
  'ballpark/', 'ballpark/index.html', 'ballpark/game.js',
  'speed-race/', 'speed-race/index.html', 'speed-race/game.js', 'data/speeds.js',
  'how-many-fit/', 'how-many-fit/index.html', 'how-many-fit/game.js',
  'how-far/', 'how-far/index.html', 'how-far/game.js', 'data/cities.js',
  'weekly/', 'weekly/index.html', 'weekly/game.js',
  'survival/', 'survival/index.html', 'survival/game.js',
  'answers/', 'answers/index.html', 'suggest/', 'suggest/index.html',
  'archive/', 'archive/index.html', 'stats/', 'stats/index.html', 'league/', 'league/index.html', 'league/league.js',
  'categories/', 'categories/index.html', 'about/', 'about/index.html', 'contact/', 'contact/index.html', 'terms/', 'terms/index.html', 'privacy/', 'privacy/index.html'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (u.pathname.startsWith('/admin') || u.pathname.startsWith('/api/')) return;   // the admin page is never cached
  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
