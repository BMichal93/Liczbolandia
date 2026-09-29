/*
 * levelgen.js - builds levels from hand-designed "chunks".
 *
 * Why chunks instead of 18 hand-drawn maps: each chunk (a gap, a row of
 * ?-blocks, a moving platform over a pit...) was designed once with jump
 * distances that are known to be reachable, and the generator strings them
 * together with a seeded random order. Every level is different, yet always
 * beatable, and the seed keeps a level identical on replays so kids can go
 * back for missed stars.
 *
 * Output uses tile coordinates; game.js converts to world units.
 * Grid codes:
 *   .  empty        #  ground         I  ice ground     =  solid block
 *   ?  ?-block      -  one-way plank  S  thorn bush     L  chocolate lava
 */
(function () {
  const U = LZ.U, D = LZ.D;
  const H = 14;          // rows in every level
  const MAX_GAP = 4;     // widest gap a normal jump clears comfortably

  function generate(wi, li) {
    const world = D.WORLDS[wi - 1];
    if (li === D.LEVELS_PER_WORLD) return bossArena(world);

    const r = U.rng(wi * 1009 + li * 37 + 5);
    const has = f => world.features.includes(f);
    const water = has('water');
    const diff = (wi - 1) * 0.55 + (li - 1) * 0.4;       // 0 .. ~3.6
    const cols = [];
    const ents = [];
    const qc = {};                                       // "x,y" -> ?-block content
    const starSpots = [];
    let x = 0, gh = 10;

    const ensure = cx => { while (cols.length <= cx) cols.push(new Array(H).fill('.')); };
    const set = (cx, cy, c) => { if (cy < 0 || cy >= H) return; ensure(cx); cols[cx][cy] = c; };
    const ground = (cx, h, mat) => { ensure(cx); for (let y = h; y < H; y++) cols[cx][y] = mat || '#'; };
    // A "pit" column: deadly drop normally, lava in the volcano, a safe sea
    // floor underwater (swimming makes pits pointless there).
    const pit = (cx) => {
      ensure(cx);
      if (water) ground(cx, H - 1);
      else if (has('lava')) set(cx, H - 2, 'L');
    };
    const coin = (cx, cy) => ents.push({ t: 'coin', x: cx, y: cy });
    const arc = (x0, w, y0) => { for (let i = 0; i <= w; i++) coin(x0 + i, y0 - Math.round(Math.sin((i / w) * Math.PI) * 2)); };
    const walkers = world.enemies.filter(e => ['slime', 'hedgehog', 'shroom', 'snowball'].includes(e));
    const flyers = world.enemies.filter(e => ['bee', 'bat', 'cloudy', 'fish', 'jelly'].includes(e));
    const enemy = (cx, cy) => {
      let type;
      if (water) type = U.pick(r, ['fish', 'fish', 'jelly']);
      else if (flyers.length && r() < 0.3) type = U.pick(r, flyers);
      else type = U.pick(r, walkers.length ? walkers : ['slime']);
      const fly = ['bee', 'bat', 'cloudy', 'fish', 'jelly'].includes(type);
      ents.push({ t: 'enemy', type, x: cx, y: fly ? cy - 2 - Math.floor(r() * 2) : cy });
    };
    const maybeEnemy = (cx) => { if (r() < 0.35 + diff * 0.12) enemy(cx, gh); };

    /* ---------------- chunk library ---------------- */
    const C = {
      flat() {
        const n = U.ri(r, 5, 9);
        for (let i = 0; i < n; i++) ground(x + i, gh, has('ice') && r() < 0.3 ? 'I' : '#');
        if (r() < 0.55) for (let i = 1; i < n - 1; i++) coin(x + i, gh - 2);
        if (n > 6) maybeEnemy(x + n - 2);
        x += n;
      },
      gap() {
        const w = U.ri(r, 2, Math.min(MAX_GAP, 2 + Math.floor(diff * 0.8)));
        ground(x, gh); ground(x + 1, gh);
        for (let i = 0; i < w; i++) pit(x + 2 + i);
        arc(x + 1, w + 1, gh - 2);
        ground(x + 2 + w, gh); ground(x + 3 + w, gh);
        if (water && r() < 0.6) ents.push({ t: 'enemy', type: 'urchin', x: x + 2 + Math.floor(w / 2), y: H - 1 });
        if (has('lava') && w >= 3 && r() < 0.7) ents.push({ t: 'enemy', type: 'firejelly', x: x + 2 + Math.floor(w / 2), y: H - 2 });
        x += 4 + w;
      },
      steps() {
        const up = gh > 8 && (gh >= 11 || r() < 0.55);
        const dh = up ? -U.ri(r, 1, 2) : U.ri(r, 1, Math.min(2, 11 - gh));
        for (let i = 0; i < 3; i++) ground(x + i, gh);
        gh = U.clamp(gh + dh, 7, 11);
        for (let i = 3; i < 7; i++) ground(x + i, gh);
        coin(x + 4, gh - 2); coin(x + 5, gh - 2);
        x += 7;
      },
      floating() {
        ground(x, gh); x++;
        const top = gh;
        if (diff < 0.8) {
          // gentle version for the first levels: two low planks that touch,
          // so it's one small hop up and a walk across - no precise jumps
          for (let i = 0; i < 7; i++) pit(x + i);
          for (let i = 0; i <= 3; i++) { set(x + i, top - 1, '-'); coin(x + i, top - 2); }
          for (let i = 4; i <= 6; i++) { set(x + i, top - 2, '-'); coin(x + i, top - 3); }
          starSpots.push({ x: x + 5, y: Math.max(1, top - 5) });
          x += 7; ground(x, gh); ground(x + 1, gh); x += 2;
          return;
        }
        for (let i = 0; i < 8; i++) pit(x + i);
        for (let i = 1; i <= 3; i++) set(x + i, top - 2, '-');
        for (let i = 5; i <= 7; i++) set(x + i, top - 3, '-');
        for (let i = 1; i <= 3; i++) coin(x + i, top - 3);
        for (let i = 5; i <= 7; i++) coin(x + i, top - 4);
        starSpots.push({ x: x + 6, y: Math.max(1, top - 6) });
        x += 8;
        ground(x, gh); ground(x + 1, gh); x += 2;
      },
      blocks() {
        const n = 10;
        for (let i = 0; i < n; i++) ground(x + i, gh);
        const pat = U.pick(r, ['=?=?=', '?=?', '=??=', '?===?']);
        // row gh-3: low enough to bonk from the ground AND to climb on top of
        const bx = x + 2, by = gh - 3;
        for (let i = 0; i < pat.length; i++) {
          set(bx + i, by, pat[i]);
          if (pat[i] === '?') qc[(bx + i) + ',' + by] = r() < 0.3 ? U.wpick(r, [[3, 'heart'], [2, 'magnet'], [2, 'shield'], [2, 'boots'], [1.2, 'rainbow']]) : 'coin';
        }
        for (let i = 0; i < pat.length; i++) coin(bx + i, by - 1);
        if (r() < 0.5) starSpots.push({ x: bx + Math.floor(pat.length / 2), y: Math.max(1, by - 3) });
        maybeEnemy(x + 7);
        x += n;
      },
      pillars() {
        const count = U.ri(r, 2, 3);
        for (let k = 0; k < count; k++) {
          ground(x, gh); ground(x + 1, gh);
          const h = U.ri(r, 1, diff > 1.5 ? 3 : 2);
          ground(x + 2, gh - h); ground(x + 3, gh - h);
          coin(x + 2, gh - h - 1); coin(x + 3, gh - h - 1);
          x += 4;
        }
        ground(x, gh); ground(x + 1, gh);
        maybeEnemy(x);
        x += 2;
      },
      spring() {
        for (let i = 0; i < 8; i++) ground(x + i, gh);
        ents.push({ t: 'spring', x: x + 2, y: gh });
        const py = Math.max(2, gh - 6);
        for (let i = 3; i <= 7; i++) { set(x + i, py, '-'); coin(x + i, py - 1); }
        starSpots.push({ x: x + 6, y: Math.max(1, py - 2) });
        x += 8;
      },
      moving() {
        const pw = U.ri(r, 8, 10);
        ground(x, gh); x++;
        for (let i = 0; i < pw; i++) pit(x + i);
        ents.push({ t: 'moving', x: x + 1, y: gh - 1, w: 3, x2: x + pw - 4, y2: gh - 1 });
        for (let i = 2; i < pw - 2; i++) coin(x + i, gh - 3);
        x += pw;
        ground(x, gh); ground(x + 1, gh); x += 2;
      },
      parade() {
        const n = 13;
        for (let i = 0; i < n; i++) ground(x + i, gh, has('ice') && r() < 0.5 ? 'I' : '#');
        enemy(x + 5, gh); enemy(x + 10, gh);
        if (diff > 1.2) enemy(x + 8, gh);
        for (let i = 2; i < n - 2; i += 2) coin(x + i, gh - 3);
        x += n;
      },
      thorns() {
        for (let i = 0; i < 9; i++) ground(x + i, gh);
        set(x + 4, gh - 1, 'S'); if (diff > 1) set(x + 5, gh - 1, 'S');
        arc(x + 3, 3, gh - 3);
        x += 9;
      },
      /* ---- world-specific chunks ---- */
      ice() {
        const n = U.ri(r, 10, 15);
        for (let i = 0; i < n; i++) ground(x + i, gh, 'I');
        ents.push({ t: 'enemy', type: 'snowball', x: x + n - 3, y: gh });
        for (let i = 1; i < n - 1; i += 2) coin(x + i, gh - 2);
        x += n;
      },
      mushroom() {
        for (let i = 0; i < 5; i++) ground(x + i, gh);
        ents.push({ t: 'mushroom', x: x + 2, y: gh });
        const hi = Math.max(3, gh - 5);
        for (let i = 5; i < 11; i++) { ground(x + i, hi); coin(x + i, hi - 1); }
        starSpots.push({ x: x + 8, y: Math.max(1, hi - 3) });
        for (let i = 11; i < 14; i++) ground(x + i, gh);
        x += 14;
      },
      clouds() {
        ground(x, gh); x++;
        const pw = U.ri(r, 10, 12);
        for (let i = 0; i < pw; i++) pit(x + i);
        ents.push({ t: 'cloud', x: x + 1, y: gh - 1, w: 3 });
        ents.push({ t: 'cloud', x: x + 5, y: gh - 2, w: 2 });
        ents.push({ t: 'cloud', x: x + 8, y: gh - 1, w: 3 });
        for (let i = 1; i < pw - 1; i += 2) coin(x + i, gh - 4);
        x += pw;
        ground(x, gh); ground(x + 1, gh); x += 2;
      },
      wind() {
        ground(x, gh); ground(x + 1, gh); x += 2;
        const pw = 7;
        for (let i = 0; i < pw; i++) pit(x + i);
        ents.push({ t: 'wind', x: x, y: 1, w: pw, h: H - 1 });
        for (let i = 1; i < pw - 1; i++) coin(x + i, gh - 5);
        starSpots.push({ x: x + 3, y: Math.max(1, gh - 7) });
        x += pw;
        const hh = Math.max(6, gh - 2);
        for (let i = 0; i < 3; i++) ground(x + i, hh);
        gh = hh; x += 3;
      },
      falling() {
        ground(x, gh); x++;
        // two roomy 3-tile platforms with a 1-tile gap: still exciting
        // (they drop!) but doable by a 7-year-old
        const pw = 8;
        for (let i = 0; i < pw; i++) pit(x + i);
        ents.push({ t: 'falling', x: x + 1, y: gh - 1, w: 3 });
        ents.push({ t: 'falling', x: x + 5, y: gh - 1, w: 3 });
        for (let i = 1; i < pw; i += 2) coin(x + i, gh - 3);
        x += pw;
        ground(x, gh); ground(x + 1, gh); x += 2;
      },
      reef() {
        // underwater: a low ceiling of coral to swim under, with coins inside
        const n = 12;
        for (let i = 0; i < n; i++) ground(x + i, gh);
        for (let i = 2; i < n - 2; i++) set(x + i, gh - 5, '=');
        for (let i = 3; i < n - 3; i++) coin(x + i, gh - 2);
        ents.push({ t: 'enemy', type: 'urchin', x: x + 1, y: gh });
        ents.push({ t: 'enemy', type: 'fish', x: x + 8, y: gh - 3 });
        starSpots.push({ x: x + 6, y: Math.max(1, gh - 8) });
        x += n;
      },
    };

    /* ---- special chunks: maths gate, number challenge, checkpoint ---- */
    function gateChunk() {
      gh = U.clamp(gh, 7, 11);
      for (let i = 0; i < 15; i++) ground(x + i, gh);
      ents.push({ t: 'gate', x: x + 12, gh, blocks: [x + 3, x + 6, x + 9], by: gh - 4, zone: [x - 1, x + 12] });
      x += 15;
    }
    function challengeChunk() {
      gh = U.clamp(gh, 8, 11);
      const n = 21;
      for (let i = 0; i < n; i++) ground(x + i, gh);
      for (let i = 5; i <= 8; i++) set(x + i, gh - 3, '-');
      for (let i = 12; i <= 15; i++) set(x + i, gh - 3, '-');
      const spots = [[2, gh - 1.5], [4, gh - 3], [6.5, gh - 5], [9.5, gh - 2], [13.5, gh - 5], [16, gh - 2.5], [18, gh - 3.5]];
      ents.push({ t: 'challenge', zone: [x, x + n], spots: spots.map(s => [x + s[0], s[1]]), chest: [x + 19, gh] });
      x += n;
    }
    function checkpoint() {
      for (let i = 0; i < 4; i++) ground(x + i, gh);
      ents.push({ t: 'checkpoint', x: x + 1, y: gh });
      x += 4;
    }

    /* ---- assemble ---- */
    for (let i = 0; i < 8; i++) ground(i, gh);
    x = 8;
    ents.push({ t: 'sign', x: 5, y: gh });
    const length = 150 + wi * 14 + li * 10;
    const pool = [[3, 'flat'], [3, 'gap'], [2, 'steps'], [2, 'floating'], [2.5, 'blocks'], [1.5, 'pillars'], [1.5, 'spring'], [1.5, 'parade']];
    if (diff > 0.5) pool.push([1, 'thorns']);
    if (wi === 1 && li === 1) pool.forEach(p => { if (p[1] === 'pillars' || p[1] === 'parade') p[0] = 0.5; });
    if (has('moving')) pool.push([2, 'moving']);
    if (has('ice')) pool.push([3, 'ice']);
    if (has('mushroom')) pool.push([3, 'mushroom']);
    if (has('cloud')) pool.push([3, 'clouds']);
    if (has('wind')) pool.push([2, 'wind']);
    if (has('falling')) pool.push([3, 'falling']);
    if (water) { pool.push([3, 'reef']); pool.forEach(p => { if (p[1] === 'spring' || p[1] === 'thorns') p[0] = 0; }); }
    if (!has('moving') && wi >= 2) pool.push([1, 'moving']);

    const specials = [
      { at: 0.28, fn: gateChunk },
      { at: 0.5, fn: checkpoint },
      { at: 0.55, fn: challengeChunk },
      { at: 0.8, fn: gateChunk },
    ];
    let last = '';
    while (x < length) {
      const sp = specials.find(s => !s.done && x >= length * s.at);
      if (sp) { sp.done = true; sp.fn(); continue; }
      let name = U.wpick(r, pool);
      if (name === last) name = U.wpick(r, pool);  // avoid the same chunk twice in a row
      last = name;
      C[name]();
    }
    specials.forEach(s => { if (!s.done) s.fn(); });

    // Finale: stairs up, the goal flag and a little castle.
    for (let i = 0; i < 3; i++) ground(x + i, gh);
    x += 3;
    for (let s = 1; s <= 3; s++) { for (let y = gh - s; y < gh; y++) set(x, y, '='); ground(x, gh); x++; }
    for (let i = 0; i < 16; i++) ground(x + i, gh);
    ents.push({ t: 'goal', x: x + 4, y: gh });
    ents.push({ t: 'castle', x: x + 9, y: gh });
    x += 16;

    // Stars: one early, one from the maths chest, one late.
    const W = cols.length;
    const early = starSpots.filter(s => s.x < W * 0.5);
    const late = starSpots.filter(s => s.x >= W * 0.5);
    // Fallback: float the star 3 tiles above the ground - a plain jump reaches it.
    const above = (cx) => { let y = 0; while (y < H && cols[cx][y] === '.') y++; return { x: cx, y: Math.max(1, y - 3) }; };
    const s0 = early.length ? U.pick(r, early) : above(20);
    const s2 = late.length ? U.pick(r, late) : above(W - 30);
    ents.push({ t: 'star', x: s0.x, y: s0.y, idx: 0 });
    ents.push({ t: 'star', x: s2.x, y: s2.y, idx: 2 });
    // star idx 1 lives in the challenge chest (see game.js)

    return { world, wi, li, H, W, cols, ents, qc, start: { x: 2, y: 9 }, water, boss: null };
  }

  /* Boss arena: a closed room, three perches for the answer orbs. */
  function bossArena(world) {
    const W = 30, cols = [];
    for (let x = 0; x < W; x++) {
      const c = new Array(H).fill('.');
      for (let y = 11; y < H; y++) c[y] = '#';
      if (x < 2 || x >= W - 2) for (let y = 0; y < H; y++) c[y] = '#';
      cols.push(c);
    }
    // perches sit low so the answer orbs stay below the question banner on short phone screens
    const perches = [[5, 9], [13, 8], [22, 9]];
    perches.forEach(([px, py]) => { for (let i = 0; i < 4; i++) cols[px + i][py] = '-'; });
    return {
      world, wi: world.id, li: LZ.D.LEVELS_PER_WORLD, H, W, cols, ents: [], qc: {},
      start: { x: 4, y: 10 }, water: world.features.includes('water'),
      boss: { kind: world.boss.id, name: world.boss.name, attack: world.boss.attack, orbs: perches.map(([px, py]) => [px + 2, py - 1.3]) },
    };
  }

  LZ.Gen = { generate, H };
})();
