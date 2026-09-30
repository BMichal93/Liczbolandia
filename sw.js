/*
 * Service worker - makes the game work offline and installable.
 *
 * Strategy: on install, cache every game file. On fetch, go to the network
 * first (so an update shows up on the next launch) and fall back to the
 * cache when there is no internet.
 * Bump VERSION whenever files change so old caches get cleaned up.
 */
const VERSION = 'lz-v19';
const FILES = [
  './', 'index.html', 'install.html', 'qr.png', 'manifest.webmanifest', 'css/style.css',
  'js/util.js', 'js/data.js', 'js/mathgen.js', 'js/save.js', 'js/audio.js', 'js/art.js',
  'js/levelgen.js', 'js/extras.js',
  'js/fun.js', 'js/pets.js', 'js/farm.js', 'js/sky.js', 'js/rides.js', 'js/fishing.js', 'js/treasure.js', 'js/book.js', 'js/kitchen.js', 'js/traders.js', 'js/gear.js', 'js/nature.js', 'js/giants.js', 'js/bosses.js',
  'js/temples.js', 'js/build.js', 'js/stable.js', 'js/story.js', 'js/seasons.js', 'js/villages.js',
  'js/home.js', 'js/world.js', 'js/game.js', 'js/input.js', 'js/ui.js', 'js/editor.js', 'js/main.js',
  'fonts/baloo-2-latin-500-normal.woff2', 'fonts/baloo-2-latin-700-normal.woff2', 'fonts/baloo-2-latin-800-normal.woff2',
  'fonts/baloo-2-latin-ext-500-normal.woff2', 'fonts/baloo-2-latin-ext-700-normal.woff2', 'fonts/baloo-2-latin-ext-800-normal.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png',
];
// cache: 'reload' skips the browser's own HTTP cache: GitHub Pages lets files
// be cached for 10 minutes, and without this a new version could be stored
// next to stale files from the old one (a new index.html with an old ui.js).
self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION)
    .then(c => Promise.all(FILES.map(f => fetch(new Request(f, { cache: 'reload' })).then(res => { if (!res.ok) throw new Error(f + ' ' + res.status); return c.put(f, res); }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Network first: when online she always gets the newest game (and the cache is
// refreshed); the cache is only the fallback for playing offline.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(async cache => {
    try {
      const res = await fetch(e.request, { cache: 'no-cache' });
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    } catch (err) {
      const hit = await cache.match(e.request, { ignoreSearch: true });
      if (hit) return hit;
      throw err;
    }
  }));
});
