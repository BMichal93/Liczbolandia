/*
 * extras.js - the "keep playing" systems that sit on top of the normal levels:
 *
 *   - MEDALS: three extra goals on every normal level (finish in time, lose
 *     no hearts, collect 90% of the coins). They make beaten levels worth
 *     replaying and they open the night worlds.
 *   - LEVEL OF THE DAY: one level per calendar day, the same for everyone,
 *     with a small goal and a streak reward for coming back day after day.
 *   - CUSTOM LEVELS: turning an editor level into something the engine can
 *     play, a reachability check, and the share code (text) format.
 */
(function () {
  const U = LZ.U, D = LZ.D;
  const H = 14;

  /* ================= MEDALS ================= */
  /*
   * Par time scales with the level width. 0.26 s per tile was calibrated on
   * the autopilot, which finishes a level in about 0.19 s per tile while
   * waiting for lifts and plants; a child who knows the level can beat it,
   * a first try usually doesn't.
   */
  function parTime(W) { return Math.ceil(W * 0.26 / 5) * 5; }
  const COIN_SHARE = 0.9;   // "prawie wszystkie" - 100% would hinge on one coin above a pit
  const MEDALS = [
    { id: 'time', icon: '⏱', name: 'Na czas' },
    { id: 'nohit', icon: '❤', name: 'Bez utraty serduszka' },
    { id: 'coins', icon: '●', name: '90% monet' },
  ];
  function medalsFor(run) {
    return [run.time <= run.par, run.hits === 0, run.looseTotal > 0 && run.looseGot >= Math.ceil(run.looseTotal * COIN_SHARE)];
  }

  /* ================= LEVEL OF THE DAY ================= */
  function dateKey(d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  // day number since 2026-01-01 in local time - stable seed for the whole day
  function dayNumber(d) { d = d || new Date(); return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(2026, 0, 1)) / 86400000); }
  const GOALS = [
    { id: 'nohit', text: 'Dojdź do mety bez utraty serduszka' },
    { id: 'coins', text: 'Zbierz {n} monet' },
    { id: 'time', text: 'Dobiegnij do mety w {t}' },
    { id: 'math', text: 'Wszystkie zadania dobrze za pierwszym razem' },
    { id: 'stomp', text: 'Podskocz na {n} przeciwnikach' },
  ];
  /*
   * The day's level: world picked from the worlds this player has opened (so
   * a beginner never lands in the volcano), goal from the date. Two sisters
   * on different worlds get different levels on the same day, which is fine.
   */
  function daily(p, d) {
    const day = dayNumber(d);
    let maxW = 1; for (let w = 1; w <= D.WORLDS.length; w++) if (LZ.S.isWorldUnlocked(p, w)) maxW = w;
    const r = U.rng(day * 101 + 7);
    const world = 1 + Math.floor(r() * maxW);
    const goal = GOALS[Math.floor(r() * GOALS.length)];
    return { day, key: dateKey(d), world, goal: goal.id, n: goal.id === 'stomp' ? 3 + Math.floor(r() * 3) : 0 };
  }
  // fill in the numbers that depend on the generated level (coin count, par time)
  function dailyGoalText(info, lvl) {
    const g = GOALS.find(x => x.id === info.goal);
    const loose = lvl ? lvl.ents.filter(e => e.t === 'coin').length : 0;
    const n = info.goal === 'coins' ? Math.max(10, Math.floor(loose * 0.6)) : info.n;
    const t = lvl ? parTime(lvl.W) : 0;
    return { text: g.text.replace('{n}', n).replace('{t}', Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0')), n, t };
  }
  function dailyGoalMet(info, target, run) {
    switch (info.goal) {
      case 'nohit': return run.hits === 0;
      case 'coins': return run.coins >= target.n;
      case 'time': return run.time <= target.t;
      case 'math': return run.mathTotal > 0 && run.mathOk === run.mathTotal;
      case 'stomp': return run.stomps >= target.n;
    }
    return false;
  }
  /*
   * Streak rewards: every day with the goal met adds to the streak; missing a
   * day resets it. Every 3rd day a free sticker (or coins once the album is
   * full), the 7-day badge gives a hat. Returns what was given, for the UI.
   */
  function dailyReward(p, info) {
    const dly = p.daily;
    if (dly.last === info.key) return null;                        // already rewarded today
    const yesterday = dateKey(new Date(new Date().setDate(new Date().getDate() - 1)));
    dly.streak = dly.last === yesterday ? dly.streak + 1 : 1;
    dly.best = Math.max(dly.best, dly.streak); dly.total = (dly.total || 0) + 1; dly.last = info.key;
    const out = { coins: 25, streak: dly.streak, sticker: null };
    if (dly.streak % 3 === 0) {
      const missing = D.STICKERS.filter(s => !(p.stickers || []).includes(s.id));
      if (missing.length) { const st = U.pick(Math.random, missing); (p.stickers = p.stickers || []).push(st.id); out.sticker = st; }
      else out.coins += 40;
    }
    p.coins += out.coins; p.stats.totalCoins += out.coins;
    return out;
  }

  /* ================= CUSTOM LEVELS ================= */
  /*
   * Editor format (what gets saved and shared):
   *   { v: 1, name, author, w: world id, W: width, cols: [W strings of H chars],
   *     ents: [{ t: 'coin'|'enemy'|'fly'|'spring'|'stump'|'gate', x, y, h? }] }
   * Columns 0-3 are the start area and are always ground; the finish (stairs,
   * flag, castle) is appended when the level is played, so nobody can build
   * a level without an end.
   */
  const EDIT_TILES = '#=B?-SI><Q';
  function blankLevel(w, W, author) {
    const cols = [];
    for (let x = 0; x < W; x++) cols.push('.'.repeat(10) + '####');
    return { v: 1, name: 'Mój poziom', author: author || '', w: w || 1, W, cols, ents: [], verified: false };
  }
  function groundTop(cols, x) { const c = cols[x] || ''; for (let y = 0; y < H; y++) if ('#I=B?><QT'.includes(c[y])) return y; return H; }

  function toLevel(data) {
    const world = D.WORLDS[(data.w || 1) - 1] || D.WORLDS[0];
    const cols = data.cols.map(s => s.padEnd(H, '.').slice(0, H).split(''));
    for (let x = 0; x < 4; x++) for (let y = 0; y < H; y++) cols[x][y] = y >= 10 ? '#' : '.';
    const ents = [], qc = {};
    for (const e of data.ents) {
      if (e.t === 'coin') ents.push({ t: 'coin', x: e.x, y: e.y });
      else if (e.t === 'enemy') ents.push({ t: 'enemy', type: e.type || walkerOf(world), x: e.x, y: e.y + 1 });
      else if (e.t === 'fly') ents.push({ t: 'enemy', type: e.type || flyerOf(world), x: e.x, y: e.y + 1 });
      else if (e.t === 'spring') ents.push({ t: 'spring', x: e.x, y: e.y + 1 });
      else if (e.t === 'stump') {
        // a 2-wide stump from row y down to the ground it stands on
        const base = Math.min(groundTop(data.cols, e.x), groundTop(data.cols, e.x + 1));
        const h = Math.max(1, base - e.y);
        for (let i = 0; i < 2; i++) for (let y = base - h; y < base; y++) if (cols[e.x + i]) cols[e.x + i][y] = 'T';
        ents.push({ t: 'stump', x: e.x, y: base - h, h, base });
      } else if (e.t === 'gate') {
        // maths gate: answer blocks 4 rows above the ground, gate post at x
        const gh = groundTop(data.cols, e.x);
        ents.push({ t: 'gate', x: e.x, gh, blocks: [e.x - 9, e.x - 6, e.x - 3], by: gh - 4, zone: [e.x - 13, e.x] });
        for (const bx of [e.x - 9, e.x - 6, e.x - 3]) if (cols[bx]) cols[bx][gh - 4] = '.';
      }
    }
    // ?-blocks hold a coin
    cols.forEach((c, x) => c.forEach((t, y) => { if (t === '?') qc[x + ',' + y] = 'coin'; }));
    // finish: stairs up from the last column's ground, flag and castle
    let gh = Math.min(11, Math.max(4, groundTop(data.cols, data.W - 1)));
    if (gh >= H) gh = 10;
    const col = () => { const c = new Array(H).fill('.'); for (let y = gh; y < H; y++) c[y] = '#'; return c; };
    for (let i = 0; i < 3; i++) cols.push(col());
    for (let s = 1; s <= 3; s++) { const c = col(); for (let y = gh - s; y < gh; y++) c[y] = '='; cols.push(c); }
    const gx = cols.length;
    for (let i = 0; i < 16; i++) cols.push(col());
    ents.push({ t: 'goal', x: gx + 4, y: gh }, { t: 'castle', x: gx + 9, y: gh });
    return {
      world, wi: world.id, li: 1, H, W: cols.length, cols, ents, qc, start: { x: 2, y: 9 },
      water: world.features.includes('water'), boss: null, theme: null, themeName: data.name || 'Mój poziom',
      secret: null, room: null, custom: true, noStars: true,
    };
  }
  function walkerOf(world) { return world.enemies.find(e => ['slime', 'shroom', 'snowball', 'robot', 'alien', 'scorpion', 'fish'].includes(e)) || 'slime'; }
  function flyerOf(world) { return world.enemies.find(e => ['bee', 'bat', 'cloudy', 'fish', 'jelly', 'ufo', 'vulture'].includes(e)) || 'bee'; }

  /*
   * Can the goal be reached? A breadth-first search over standable surfaces
   * with safe jump limits (3 up, 5 across) - the same check the level tests
   * use. Springs count as 8 up. Only a hint for the builder: the real proof
   * is that she finishes her own level before it can be shared.
   */
  function reachable(lvl) {
    const solid = c => '#I=?UTBC><'.includes(c);
    const { cols, W } = lvl, surf = [];
    const up = {};
    for (const e of lvl.ents) if (e.t === 'spring') up[e.x + ',' + e.y] = 8;
    for (let x = 0; x < W; x++) for (let y = 1; y < H; y++) {
      const c = cols[x][y], a = cols[x][y - 1];
      if ((solid(c) || c === '-' || c === 'Q') && !solid(a) && a !== 'S') surf.push({ x, y: c === 'Q' ? y + 1 : y, up: up[x + ',' + y] || 3 });
    }
    if (lvl.water) for (let x = 0; x < W; x++) for (let y = 1; y < H; y++) if (!solid(cols[x][y])) surf.push({ x, y, up: 3 });
    const goal = lvl.ents.find(e => e.t === 'goal');
    const start = surf.find(s => s.x === 2);
    if (!start) return false;
    const seen = new Set([start.x + ',' + start.y]), q = [start];
    while (q.length) {
      const s = q.shift();
      if (s.x >= goal.x - 1) return true;
      for (const t of surf) {
        const k = t.x + ',' + t.y; if (seen.has(k)) continue;
        if (Math.abs(t.x - s.x) <= 5 && s.y - t.y <= s.up) { seen.add(k); q.push(t); }
      }
    }
    return false;
  }

  /*
   * Share code: the level as compact text. Each column is run-length encoded
   * ("10.4#" style, most columns are a few runs), entities are short tuples,
   * the whole thing is base64 of UTF-8. A 100-wide level fits in a WhatsApp
   * message and survives copy/paste. The "LZ1:" prefix lets the game tell a
   * level code from any other text.
   */
  const ENT_CODE = { coin: 'c', enemy: 'e', fly: 'f', spring: 's', stump: 't', gate: 'g' };
  function encode(data) {
    const rle = s => s.replace(/(.)\1*/g, m => (m.length > 1 ? m.length : '') + m[0]);
    const ents = data.ents.map(e => [ENT_CODE[e.t], e.x, e.y].join(',')).join(';');
    const body = [data.v, data.w, data.W, (data.name || '').replace(/[|]/g, ''), (data.author || '').replace(/[|]/g, ''), data.cols.map(rle).join('/'), ents].join('|');
    return 'LZ1:' + btoa(unescape(encodeURIComponent(body))).replace(/=+$/, '');
  }
  function decode(code) {
    code = (code || '').trim().replace(/\s+/g, '');
    const m = code.match(/LZ1:([A-Za-z0-9+/_-]+)/);
    if (!m) throw new Error('To nie jest kod poziomu.');
    const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
    let body;
    try { body = decodeURIComponent(escape(atob(b64 + '==='.slice((b64.length + 3) % 4)))); } catch (e) { throw new Error('Kod jest uszkodzony albo niepełny.'); }
    if (body.split('|').length !== 7) throw new Error('Kod jest uszkodzony albo niepełny.');
    const [v, w, W, name, author, colsS, entsS] = body.split('|');
    const unrle = s => s.replace(/(\d*)(\D)/g, (_, n, c) => c.repeat(n ? +n : 1));
    const cols = colsS.split('/').map(unrle);
    const kinds = {}; for (const k in ENT_CODE) kinds[ENT_CODE[k]] = k;
    const ents = (entsS ? entsS.split(';') : []).map(t => { const [k, x, y] = t.split(','); return { t: kinds[k], x: +x, y: +y }; }).filter(e => e.t && e.x >= 0 && e.y >= 0);
    const data = { v: +v, w: +w, W: +W, name, author, cols, ents, verified: false };
    if (!(data.W >= 20 && data.W <= 200) || cols.length !== data.W || cols.some(c => c.length !== H) || !(data.w >= 1 && data.w <= D.WORLDS.length)) throw new Error('Kod jest uszkodzony.');
    if (cols.some(c => [...c].some(ch => ch !== '.' && !EDIT_TILES.includes(ch)))) throw new Error('Kod jest uszkodzony.');
    return data;
  }

  LZ.X = { parTime, MEDALS, medalsFor, COIN_SHARE, dateKey, dayNumber, daily, dailyGoalText, dailyGoalMet, dailyReward, blankLevel, toLevel, reachable, encode, decode, groundTop, EDIT_TILES, walkerOf, flyerOf };
})();
