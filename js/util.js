/*
 * util.js - small shared helpers.
 *
 * Everything in the game hangs off one global namespace object (window.LZ)
 * instead of ES modules. Reason: classic scripts work identically when the
 * game is opened from GitHub Pages, from the installed PWA, or from a local
 * file during testing, and there is no bundler step to maintain.
 */
window.LZ = window.LZ || {};

LZ.U = (function () {
  /*
   * Seeded random generator (mulberry32). Levels are generated from a seed
   * built from world + level number, so a given level always looks the same.
   * Kids remember "the level with the big spring" - random-every-time levels
   * would take that away and make stars impossible to hunt on replay.
   */
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Non-seeded helpers use Math.random - fine for math questions, effects.
  const R = Math.random;

  function ri(r, a, b) { return a + Math.floor(r() * (b - a + 1)); }   // int in [a,b]
  function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }
  function shuffle(r, arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  /* Weighted pick: items = [[weight, value], ...] */
  function wpick(r, items) {
    let sum = 0;
    for (const it of items) sum += it[0];
    let x = r() * sum;
    for (const it of items) { x -= it[0]; if (x <= 0) return it[1]; }
    return items[items.length - 1][1];
  }

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const overlap = (a, b) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  function easeOutBack(t) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; }

  /*
   * Polish plural forms: 1 jabłko, 2-4 jabłka, 5+ jabłek (and 12-14 -> jabłek).
   * Needed because the math word problems print numbers next to nouns and a
   * wrong ending is exactly the kind of thing kids notice and laugh at.
   */
  function plural(n, one, few, many) {
    n = Math.abs(n);
    if (n === 1) return one;
    const d = n % 10, dd = n % 100;
    if (d >= 2 && d <= 4 && !(dd >= 12 && dd <= 14)) return few;
    return many;
  }

  /* Rounded-rectangle path, used everywhere in the cartoon art. */
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* Colour helpers: shade('#ff8800', -0.2) darkens by 20%. Used to derive
     outline and shadow colours from one base colour per character/world. */
  function hexToRgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function shade(hex, amt) {
    const [r, g, b] = hexToRgb(hex);
    const f = (c) => Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt);
    return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')';
  }
  function rgba(hex, a) {
    const [r, g, b] = hexToRgb(hex);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  return { rng, R, ri, pick, shuffle, wpick, clamp, lerp, overlap, easeOutBack, easeOutCubic, gcd, plural, rr, shade, rgba, hexToRgb };
})();
