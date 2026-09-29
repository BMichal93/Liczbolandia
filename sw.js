/*
 * Service worker - makes the game work offline and installable.
 *
 * Strategy: on install, cache every game file. On fetch, answer from the
 * cache first (instant start, works with no internet), and refresh the
 * cache in the background so the next launch picks up updates.
 * Bump VERSION whenever files change so old caches get cleaned up.
 */
const VERSION = 'lz-v10';
const FILES = [
  './', 'index.html', 'install.html', 'qr.png', 'manifest.webmanifest', 'css/style.css',
  'js/util.js', 'js/data.js', 'js/mathgen.js', 'js/save.js', 'js/audio.js', 'js/art.js',
  'js/levelgen.js', 'js/game.js', 'js/input.js', 'js/ui.js', 'js/main.js',
  'fonts/baloo-2-latin-500-normal.woff2', 'fonts/baloo-2-latin-700-normal.woff2', 'fonts/baloo-2-latin-800-normal.woff2',
  'fonts/baloo-2-latin-ext-500-normal.woff2', 'fonts/baloo-2-latin-ext-700-normal.woff2', 'fonts/baloo-2-latin-ext-800-normal.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.open(VERSION).then(async cache => {
    const hit = await cache.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(res => { if (res.ok && new URL(e.request.url).origin === location.origin) cache.put(e.request, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});
