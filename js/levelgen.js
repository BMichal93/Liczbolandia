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
 *   B  brick (smash it from below; some hold a stack of coins)
 *   T  hollow tree stump (solid; drawn by its entity, may hide a snapping plant)
 *   C  cannon (solid; drawn by its entity, fires slow cannonballs)
 *   U  used block / underground wall
 *   >  <  conveyor belt (solid; carries you right / left) - toy factory
 *
 * Every level also gets a THEME (Las pniaków, Ceglane miasteczko...) that
 * changes which chunks dominate, so levels in one world feel different.
 */
(function () {
  const U = LZ.U, D = LZ.D;
  const H = 14;          // rows in every level
  const MAX_GAP = 4;     // widest gap a normal jump clears comfortably

  /*
   * Level themes: weights for the chunk library. A level's theme decides
   * its character; world-specific chunks (ice, clouds...) are added on top.
   */
  const THEMES = {
    meadow: { name: 'Słoneczna ścieżka', w: { flat: 3, gap: 3, steps: 2, floating: 2, blocks: 2.5, spring: 1.5, stumps: 2, bricks: 1.5, pyramid: 1, valley: 1.5 } },
    stumps: { name: 'Las pniaków', w: { stumps: 5, flat: 1.5, gap: 2, steps: 1.5, blocks: 1.5, valley: 2, twoRoutes: 1.5, pyramid: 1 } },
    bricks: { name: 'Ceglane miasteczko', w: { bricks: 4, tunnel: 3, twoRoutes: 2.5, flat: 1, gap: 1.5, blocks: 1, stumps: 1 } },
    heights: { name: 'Podniebne schody', w: { pyramid: 3, elevator: 2.5, floating: 3, pillars: 2, spring: 2, gap: 2, steps: 1.5 } },
    fort: { name: 'Twierdza armatek', w: { cannons: 4, pyramid: 2, thorns: 2, stumps: 2, bricks: 1.5, gap: 2, parade: 1.5, tunnel: 1 } },
  };
  /* Which theme a level gets: world 1 introduces them one by one; later
     worlds get a seeded mix of 3 different ones (the cannon fort from world 2). */
  function themeFor(wi, li) {
    if (wi === D.BONUS_ID) return 'meadow';
    // world 1 introduces the themes one at a time, easiest first
    if (wi === 1) return ['meadow', 'stumps', 'bricks', 'heights', 'meadow', 'stumps', 'bricks'][li - 1];
    // 7 levels but only 5 themes: two shuffled rounds back to back, never the
    // same theme twice in a row where the rounds meet
    const r = U.rng(wi * 7717 + 3);
    const all = ['stumps', 'bricks', 'heights', 'fort', 'meadow'];
    const a = U.shuffle(r, all.slice()), b = U.shuffle(r, all.slice());
    if (b[0] === a[a.length - 1]) [b[0], b[1]] = [b[1], b[0]];
    return a.concat(b)[li - 1];
  }

  /*
   * opt (all optional):
   *   hard: true   - the night version: a different layout (other seed) and
   *                  about one world's worth harder
   *   daily: n     - level of the day; n is the date number, which seeds
   *                  the layout and theme so everyone gets the same level that day
   * Stars are a fixed currency earned only in normal levels, so night and
   * daily levels have none.
   */
  function generate(wi, li, opt) {
    opt = opt || {};
    // the star-shop bonus level "Kraina Monet": one replayable level
    const bonus = wi === D.BONUS_ID;
    const world = bonus ? D.BONUS_WORLD : D.WORLDS[wi - 1];
    if (!bonus && li === D.LEVELS_PER_WORLD) { const a = bossArena(world); a.hard = !!opt.hard; return a; }
    const daily = opt.daily != null, special = daily || !!opt.hard;

    const seed = daily ? opt.daily * 7919 + wi * 31 : opt.hard ? wi * 1009 + li * 37 + 50021 : wi * 1009 + li * 37 + 5;
    const r = bonus ? U.rng(Date.now() & 0xffff) : U.rng(seed);   // bonus level is different on every visit
    const has = f => world.features.includes(f);
    const water = has('water');
    // ramps up more gently inside a world now that each world has 7 levels
    let diff = bonus ? 0.5 : (wi - 1) * 0.42 + (li - 1) * 0.18;   // 0 .. ~4.4
    if (opt.hard) diff += 0.6;   // about 1.5 worlds harder; +0.9 made the last night worlds a wall of cannons
    const theme = daily ? U.pick(U.rng(opt.daily * 13 + 1), Object.keys(THEMES).filter(k => wi > 1 || k !== 'fort')) : themeFor(wi, li);
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
    /*
     * Coins are rationed per chunk: each terrain chunk either keeps all of
     * its coins or none (see coinOn in the assembly loop). Dropping whole
     * groups keeps the lines and arcs looking deliberate, while roughly
     * halving the coin supply so the shop lasts much longer.
     */
    let coinOn = true;
    const coin = (cx, cy) => { if (coinOn) ents.push({ t: 'coin', x: cx, y: cy }); };
    const arc = (x0, w, y0) => { for (let i = 0; i <= w; i++) coin(x0 + i, y0 - Math.round(Math.sin((i / w) * Math.PI) * 2)); };
    const walkers = world.enemies.filter(e => ['slime', 'hedgehog', 'shroom', 'snowball', 'robot', 'alien', 'scorpion', 'cactus'].includes(e));
    const flyers = world.enemies.filter(e => ['bee', 'bat', 'cloudy', 'fish', 'jelly', 'ufo', 'vulture'].includes(e));
    /*
     * Spiky walkers (hedgehog, cactus) can't be stomped, so they only go where
     * there is open sky and flat ground on both sides (flat stretches and the
     * head of a parade). Under a brick ceiling or next to quicksand the jump
     * over them gets cut short and a child lands right on the spikes.
     */
    const SPIKY = ['hedgehog', 'cactus'];
    const softWalkers = walkers.filter(t => !SPIKY.includes(t)), spikyWalkers = walkers.filter(t => SPIKY.includes(t));
    const enemy = (cx, cy, spikyOk) => {
      let type;
      if (water) type = U.pick(r, ['fish', 'fish', 'jelly']);
      else if (flyers.length && r() < 0.3) type = U.pick(r, flyers);
      else if (spikyOk && spikyWalkers.length && r() < 0.45) type = U.pick(r, spikyWalkers);
      else type = U.pick(r, softWalkers.length ? softWalkers : ['slime']);
      const fly = ['bee', 'bat', 'cloudy', 'fish', 'jelly', 'ufo', 'vulture'].includes(type);
      ents.push({ t: 'enemy', type, x: cx, y: fly ? cy - 2 - Math.floor(r() * 2) : cy });
    };
    const maybeEnemy = (cx, spikyOk) => { if (r() < (bonus ? 0.12 : 0.35 + diff * 0.12)) enemy(cx, gh, spikyOk); };
    const walker = () => U.pick(r, softWalkers.length ? softWalkers : ['slime']);
    // hollow tree stump, 2 tiles wide, h tiles tall, standing on ground level gh
    const stump = (sx, h, opts) => {
      opts = opts || {};
      for (let i = 0; i < 2; i++) { ground(sx + i, gh); for (let y = gh - h; y < gh; y++) set(sx + i, y, 'T'); }
      ents.push(Object.assign({ t: 'stump', x: sx, y: gh - h, h }, opts));
    };
    // brick with an optional surprise inside
    // a multi-coin brick counts as coins, so it follows the same per-chunk ration
    const brick = (bx, by, content) => { set(bx, by, 'B'); if (content === 'multi' && !coinOn) content = null; if (content) qc[bx + ',' + by] = content; };
    const brickSurprise = () => r() < 0.07 ? 'multi' : r() < 0.08 ? U.pick(r, ['heart', 'magnet', 'boots']) : null;
    const plantChance = water ? 0.25 : bonus ? 0 : diff < 0.4 ? 0 : Math.min(0.75, 0.35 + diff * 0.12);

    /* ---------------- chunk library ---------------- */
    const C = {
      flat() {
        const n = U.ri(r, 5, 9);
        for (let i = 0; i < n; i++) ground(x + i, gh, has('ice') && r() < 0.3 ? 'I' : '#');
        if (bonus || r() < 0.55) for (let i = 1; i < n - 1; i++) { coin(x + i, gh - 2); if (bonus) coin(x + i, gh - 3); }
        if (n > 6) maybeEnemy(x + n - 2, true);
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
        // 3 tiles of ground first, so she can land and take a breath before the jumps
        for (let i = 0; i < 3; i++) ground(x + i, gh);
        x += 3;
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
          if (pat[i] === '?') qc[(bx + i) + ',' + by] = r() < (bonus ? 0.15 : 0.3) ? U.wpick(r, [[3, 'heart'], [2, 'magnet'], [2, 'shield'], [2, 'boots'], [1.2, 'rainbow']]) : 'coin';
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
        // walking onto a spring launches you, and a child holding 'right' flies
        // ~6 tiles - so the chunk ends with a long safe landing strip
        for (let i = 0; i < 13; i++) ground(x + i, gh);
        ents.push({ t: 'spring', x: x + 2, y: gh });
        const py = Math.max(2, gh - 6);
        for (let i = 3; i <= 7; i++) { set(x + i, py, '-'); coin(x + i, py - 1); }
        starSpots.push({ x: x + 6, y: Math.max(1, py - 2) });
        x += 13;
      },
      moving() {
        const pw = U.ri(r, 8, 10);
        // a 4-tile landing strip before the pit: the previous chunk may end in a
        // step up, and a jump up that step used to carry her straight into the gap
        for (let i = 0; i < 4; i++) ground(x + i, gh);
        x += 4;
        for (let i = 0; i < pw; i++) pit(x + i);
        ents.push({ t: 'moving', x: x + 1, y: gh - 1, w: 3, x2: x + pw - 4, y2: gh - 1 });
        for (let i = 2; i < pw - 2; i++) coin(x + i, gh - 3);
        x += pw;
        ground(x, gh); ground(x + 1, gh); x += 2;
      },
      parade() {
        const n = 13;
        for (let i = 0; i < n; i++) ground(x + i, gh, has('ice') && r() < 0.5 ? 'I' : '#');
        // at most one spiky (can't-stomp) enemy per parade, at the front: two of
        // them a few tiles apart left no safe place to land between the jumps
        // the rest of the parade walks: flyers at head height in a row of walkers
        // left no gap to jump through (the night space level showed it)
        enemy(x + 5, gh, true); ents.push({ t: 'enemy', type: walker(), x: x + 10, y: gh });
        if (diff > 1.2) ents.push({ t: 'enemy', type: walker(), x: x + 8, y: gh });
        for (let i = 2; i < n - 2; i += 2) coin(x + i, gh - 3);
        x += n;
      },
      thorns() {
        for (let i = 0; i < 9; i++) ground(x + i, gh);
        set(x + 4, gh - 1, 'S'); if (diff > 1) set(x + 5, gh - 1, 'S');
        arc(x + 3, 3, gh - 2);   // peak 4 above the ground: an easy full jump, even for the 90%-coins medal
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
        // stairs back down (a blind 5-tile drop could land in the next gap)
        let k = 0; for (let hgt = hi + 1; hgt < gh; hgt++, k++) ground(x + 11 + k, hgt);
        for (let i = 0; i < 3; i++) ground(x + 11 + k + i, gh);
        x += 14 + k;
      },
      clouds() {
        // 3 tiles of ground first, so she can land and take a breath before the jumps
        for (let i = 0; i < 3; i++) ground(x + i, gh);
        x += 3;
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
        // 3 tiles of ground first (a step up right before the drop sent jumps into the lava)
        for (let i = 0; i < 3; i++) ground(x + i, gh);
        x += 3;
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

      /* ---- desert: quicksand ('Q' = one row of sand over solid ground) ---- */
      // a pool of quicksand: wading is slow and you sink a little - jump over it or wade through
      quicksand() {
        const w = U.ri(r, 3, Math.min(7, 4 + Math.floor(diff * 0.6))), n = w + 6;
        for (let i = 0; i < n; i++) ground(x + i, gh);
        for (let i = 3; i < 3 + w; i++) set(x + i, gh, 'Q');
        arc(x + 2, w + 1, gh - 2);
        if (r() < 0.5) ents.push({ t: 'enemy', type: walker(), x: x + n - 1, y: gh });
        x += n;
      },
      // a long sand sea with stone pillars sticking out: hop pillar to pillar,
      // or wade the slow way; a vulture circles above
      sandSea() {
        const w = U.ri(r, 10, 13), n = w + 4;
        for (let i = 0; i < n; i++) ground(x + i, gh);
        for (let i = 2; i < 2 + w; i++) set(x + i, gh, 'Q');
        for (let k = 5; k < 2 + w - 1; k += 4) { set(x + k, gh, '='); set(x + k, gh - 1, '='); coin(x + k, gh - 3); }
        if (flyers.length) ents.push({ t: 'enemy', type: U.pick(r, flyers), x: x + Math.floor(n / 2), y: gh - 4 });
        starSpots.push({ x: x + Math.floor(n / 2), y: Math.max(1, gh - 5) });
        x += n;
      },

      /* ---- toy factory: conveyor belts ---- */
      // a long belt on the ground - sometimes helping, sometimes pushing back
      conveyor() {
        const n = U.ri(r, 10, 14), dirc = r() < 0.5 ? '>' : '<';
        ground(x, gh); ground(x + 1, gh);
        for (let i = 2; i < n - 2; i++) { ground(x + i, gh); set(x + i, gh, dirc); if (i % 2 === 0) coin(x + i, gh - 2); }
        ground(x + n - 2, gh); ground(x + n - 1, gh);
        ents.push({ t: 'enemy', type: walker(), x: x + Math.floor(n / 2), y: gh });
        x += n;
      },
      // a belt bridge over a pit that carries you across
      beltBridge() {
        ground(x, gh); ground(x + 1, gh); ground(x + 2, gh);
        const w = U.ri(r, 5, 7), by = gh - 2;
        for (let i = 0; i < w; i++) { pit(x + 3 + i); set(x + 3 + i, by, '>'); coin(x + 3 + i, by - 2); }
        starSpots.push({ x: x + 3 + Math.floor(w / 2), y: Math.max(1, by - 4) });
        x += 3 + w;
        ground(x, gh); ground(x + 1, gh); ground(x + 2, gh); x += 3;
      },

      /* ---- Mario-style terrain ---- */
      // a row of hollow stumps of different heights; some hide a snapping plant
      stumps() {
        const count = U.ri(r, 2, 3);
        ground(x, gh); ground(x + 1, gh); x += 2;
        for (let k = 0; k < count; k++) {
          const h = U.ri(r, 2, diff > 1.2 ? 3 : 2);
          stump(x, h, { plant: r() < plantChance });
          coin(x, gh - h - 2); coin(x + 1, gh - h - 2);
          const gapW = U.ri(r, 3, 5);
          for (let i = 2; i < 2 + gapW; i++) ground(x + i, gh);
          if (gapW >= 4 && k === 1) maybeEnemy(x + 3);
          x += 2 + gapW;
        }
      },
      // Mario brick row with ?-blocks; some bricks hide a coin stack or a power-up
      bricks() {
        const n = 13;
        for (let i = 0; i < n; i++) ground(x + i, gh);
        const pat = U.pick(r, ['BB?BB', 'B?B?B', '?BBB?', 'BBB?BBB', 'B?BB?B']);
        const bx = x + 3, by = gh - 3;
        for (let i = 0; i < pat.length; i++) {
          if (pat[i] === '?') { set(bx + i, by, '?'); qc[(bx + i) + ',' + by] = r() < 0.3 ? U.wpick(r, [[3, 'heart'], [2, 'magnet'], [2, 'shield'], [2, 'boots'], [1.2, 'rainbow']]) : 'coin'; }
          else brick(bx + i, by, brickSurprise());
          coin(bx + i, by - 1);
        }
        // a second, higher row in the middle (reachable from the first row)
        if (by - 3 >= 2 && r() < 0.6) {
          const mid = bx + Math.floor(pat.length / 2) - 1;
          for (let i = 0; i < 3; i++) { brick(mid + i, by - 3, i === 1 ? 'multi' : null); coin(mid + i, by - 4); }
          starSpots.push({ x: mid + 1, y: Math.max(1, by - 5) });
        }
        if (r() < 0.7) ents.push({ t: 'enemy', type: walker(), x: x + 9, y: gh });
        x += n;
      },
      // low brick ceiling: smash your way through or run on top of it
      tunnel() {
        const n = U.ri(r, 11, 15);
        for (let i = 0; i < n; i++) ground(x + i, gh);
        for (let i = 2; i < n - 2; i++) {
          const c = r() < 0.15 ? '?' : 'B';
          if (c === '?') { set(x + i, gh - 3, '?'); qc[(x + i) + ',' + (gh - 3)] = 'coin'; } else brick(x + i, gh - 3, r() < 0.06 ? 'multi' : null);
          if (i % 2 === 0) coin(x + i, gh - 1);
          coin(x + i, gh - 4);
        }
        ents.push({ t: 'enemy', type: walker(), x: x + Math.floor(n / 2), y: gh });
        if (diff > 1.2) ents.push({ t: 'enemy', type: walker(), x: x + n - 4, y: gh });
        x += n;
      },
      // two routes: a safe-ish low road with enemies, and a high brick road with coins and a star
      twoRoutes() {
        const n = 22;
        for (let i = 0; i < n; i++) ground(x + i, gh);
        set(x + 2, gh - 1, '='); set(x + 3, gh - 1, '='); set(x + 3, gh - 2, '=');
        for (let i = 5; i <= 17; i++) { brick(x + i, gh - 4, i === 11 ? 'multi' : null); coin(x + i, gh - 5); }
        set(x + 8, gh - 4, '?'); qc[(x + 8) + ',' + (gh - 4)] = U.pick(r, ['heart', 'boots', 'magnet']);
        starSpots.push({ x: x + 12, y: Math.max(1, gh - 7) });
        ents.push({ t: 'enemy', type: walker(), x: x + 9, y: gh });
        ents.push({ t: 'enemy', type: walker(), x: x + 15, y: gh });
        x += n;
      },
      // Mario staircase pyramid; later levels put a gap between the two halves
      pyramid() {
        const top = Math.min(4, gh - 3), gap = diff < 0.6 ? 0 : U.ri(r, 1, 2);
        ground(x, gh); ground(x + 1, gh); x += 2;
        for (let k = 1; k <= top; k++) { ground(x, gh); for (let y = gh - k; y < gh; y++) set(x, y, '='); if (k === top) coin(x, gh - k - 1); x++; }
        for (let i = 0; i < gap; i++) { pit(x); coin(x, gh - top - 2); x++; }
        for (let k = top; k >= 1; k--) { ground(x, gh); for (let y = gh - k; y < gh; y++) set(x, y, '='); if (k === top) coin(x, gh - k - 1); x++; }
        ground(x, gh); ground(x + 1, gh); x += 2;
      },
      // ride a lift up to a high ledge full of coins
      /*
       * The lift sits flush with the ground at the bottom (just walk on) and
       * rides up a 2-wide shaft to a high ledge. The shaft has a safe floor,
       * so missing the lift costs nothing - hop out or wait for it. The ledge
       * steps back down with stairs (a blind drop could land in the next gap).
       */
      elevator() {
        if (gh < 8 || water) return C.steps();
        ground(x, gh); ground(x + 1, gh);
        const fl = Math.min(H - 1, gh + 2);                          // shaft floor only 2 tiles down:
        ground(x + 2, fl); ground(x + 3, fl);                        // hop onto the lift or climb out
        ents.push({ t: 'moving', x: x + 2, y: gh, w: 2, x2: x + 2, y2: gh - 6, lift: true });
        for (let i = 4; i < 11; i++) { ground(x + i, gh - 5); coin(x + i, gh - 6); }
        starSpots.push({ x: x + 8, y: Math.max(1, gh - 8) });
        [gh - 4, gh - 3, gh - 2, gh - 1].forEach((hgt, k) => ground(x + 11 + k, hgt));
        for (let i = 15; i < 18; i++) ground(x + i, gh);
        x += 18;
      },
      // a dip in the terrain: walk down into a hollow and climb out
      valley() {
        const deep = Math.min(11, gh + 2);
        if (deep === gh) return C.steps();
        ground(x, gh); ground(x + 1, gh);
        ground(x + 2, gh + 1 <= deep ? gh + 1 : deep);
        for (let i = 3; i < 10; i++) { ground(x + i, deep); if (i % 2) coin(x + i, deep - 2); }
        if (r() < 0.6) ents.push({ t: 'enemy', type: walker(), x: x + 7, y: deep });
        ground(x + 10, gh + 1 <= deep ? gh + 1 : deep);
        ground(x + 11, gh); ground(x + 12, gh);
        x += 13;
      },
      // cannon tower firing slow cannonballs - jump over or stomp them
      cannons() {
        if (diff < 0.5) return C.bricks();
        const two = diff > 2 && gh - 4 >= 3;
        const n = two ? 17 : 13;                                   // always 3+ flat tiles after the last cannon
        for (let i = 0; i < n; i++) ground(x + i, gh);
        const hc = U.ri(r, 1, 2);
        for (let y = gh - hc; y < gh; y++) set(x + 8, y, 'C');
        ents.push({ t: 'cannon', x: x + 8, y: gh - hc, h: hc });
        arc(x + 6, 4, gh - hc - 2);
        if (two) { for (let y = gh - 2; y < gh; y++) set(x + 13, y, 'C'); ents.push({ t: 'cannon', x: x + 13, y: gh - 2, h: 2 }); }
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
    /*
     * Secret stump (Mario's warp pipe): stand still on the glowing stump and
     * you sink into an underground coin room. The room's exit stump brings
     * you back further along the level, out of an 'exit stump'.
     */
    let secret = null;
    function secretChunk() {
      gh = U.clamp(gh, 8, 11);
      for (let i = 0; i < 8; i++) ground(x + i, gh);
      stump(x + 4, 2, { secret: true });
      ents.push({ t: 'sign', x: x + 2, y: gh, down: true });
      secret = { x: x + 4 };
      x += 8;
    }
    function exitChunk() {
      gh = U.clamp(gh, 8, 11);
      for (let i = 0; i < 6; i++) ground(x + i, gh);
      stump(x + 2, 2, { exit: true });
      secret.exit = { x: x + 2, y: gh - 2 };
      x += 6;
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
    // Long levels (about 1.35x the previous size) with a single checkpoint
    // halfway: a pit only costs a heart and puts you back at the last safe
    // spot, so the flag matters only when all hearts are gone.
    const length = bonus ? 130 : 290 + wi * 18 + li * 11;
    const pool = Object.entries(THEMES[theme].w).map(([k, v]) => [v, k]);
    if (diff > 0.5 && !THEMES[theme].w.thorns) pool.push([0.8, 'thorns']);
    if (!THEMES[theme].w.parade) pool.push([0.8, 'parade']);
    if (wi === 1 && li === 1) pool.forEach(p => { if (p[1] === 'pillars' || p[1] === 'parade') p[0] = 0.5; });
    if (has('moving')) pool.push([2, 'moving']);
    if (has('ice')) pool.push([3, 'ice']);
    if (has('mushroom')) pool.push([3, 'mushroom']);
    if (has('cloud')) pool.push([3, 'clouds']);
    if (has('wind')) pool.push([2, 'wind']);
    if (has('falling')) pool.push([3, 'falling']);
    if (has('conveyor')) { pool.push([3.5, 'conveyor']); pool.push([2.5, 'beltBridge']); }
    if (has('quicksand')) { pool.push([3.5, 'quicksand']); pool.push([2, 'sandSea']); }
    if (has('lowgrav')) pool.forEach(p => { if (['floating', 'gap', 'pyramid'].includes(p[1])) p[0] *= 1.6; });   // floaty jumps: more air time
    if (water) { pool.push([3, 'reef']); pool.forEach(p => { if (['spring', 'thorns', 'elevator'].includes(p[1])) p[0] = 0; }); }
    if (!has('moving') && wi >= 2) pool.push([1, 'moving']);

    if (bonus) pool.forEach(p => { if (['blocks', 'spring', 'floating'].includes(p[1])) p[0] *= 2.5; if (['parade', 'thorns', 'gap'].includes(p[1])) p[0] *= 0.3; });
    const specials = [
      { at: 0.17, fn: gateChunk },
      { at: 0.4, fn: challengeChunk },
      { at: 0.5, fn: checkpoint },
      { at: 0.62, fn: gateChunk },
      { at: 0.85, fn: gateChunk },
    ];
    if (!bonus) specials.push({ at: 0.22, fn: secretChunk });
    specials.sort((a, b) => a.at - b.at);
    let last = '';
    while (x < length) {
      if (secret && !secret.exit && x >= secret.x + 26) { exitChunk(); continue; }
      const sp = specials.find(s => !s.done && x >= length * s.at);
      if (sp) { sp.done = true; sp.fn(); continue; }
      let name = U.wpick(r, pool);
      if (name === last) name = U.wpick(r, pool);  // avoid the same chunk twice in a row
      last = name;
      coinOn = r() < (bonus ? 0.6 : 0.42);
      C[name]();
      coinOn = true;
    }
    specials.forEach(s => { if (!s.done) s.fn(); });
    if (secret && !secret.exit) exitChunk();

    // Finale: stairs up, the goal flag and a little castle.
    for (let i = 0; i < 3; i++) ground(x + i, gh);
    x += 3;
    for (let s = 1; s <= 3; s++) { for (let y = gh - s; y < gh; y++) set(x, y, '='); ground(x, gh); x++; }
    for (let i = 0; i < 16; i++) ground(x + i, gh);
    ents.push({ t: 'goal', x: x + 4, y: gh });
    ents.push({ t: 'castle', x: x + 9, y: gh });
    x += 16;

    // underground secret room, placed past the castle behind solid walls
    let room = null;
    if (secret) {
      for (let i = 0; i < 6; i++) for (let y = 0; y < H; y++) set(x + i, y, 'U');
      x += 6;
      const rx = x, RW = 26;
      for (let i = 0; i < RW; i++) {
        for (let y = 0; y < H; y++) set(rx + i, y, (i === 0 || i === RW - 1 || y <= 1 || y >= 11) ? 'U' : '.');
      }
      // coin carpet on the floor and a platform with coins and the star above it
      for (let i = 2; i < RW - 6; i += 2) coin(rx + i, 10);
      for (let i = 8; i <= 15; i++) { set(rx + i, 8, '='); if (i % 2 === 0) coin(rx + i, 7); }
      for (const i of [4, 19]) brick(rx + i, 7, 'multi');
      // exit stump on the right, standing on the room floor
      const sx = rx + RW - 5;
      for (let i = 0; i < 2; i++) for (let y = 9; y < 11; y++) set(sx + i, y, 'T');
      ents.push({ t: 'stump', x: sx, y: 9, h: 2, roomExit: true, base: 11 });
      room = { x0: rx, x1: rx + RW, spawn: { x: rx + 2, y: 3 }, star: { x: rx + 12, y: 5 } };
      x += RW;
    }

    // Stars: one early, one from the maths chest, one late.
    const W = cols.length;
    const early = starSpots.filter(s => s.x < W * 0.5);
    const late = starSpots.filter(s => s.x >= W * 0.5);
    // Fallback: float the star 3 tiles above the ground - a plain jump reaches it.
    // (searching outward for a column with solid ground - never over a pit or lava)
    const above = (cx0) => {
      for (let d = 0; d < 40; d++) for (const cx of [cx0 + d, cx0 - d]) {
        if (cx < 1 || cx >= cols.length) continue;
        let y = 0; while (y < H && cols[cx][y] === '.') y++;
        if (y < H && y > 4 && '#I='.includes(cols[cx][y])) return { x: cx, y: y - 3 };
      }
      return { x: cx0, y: 5 };
    };
    const s0 = early.length ? U.pick(r, early) : above(20);
    const s2 = late.length ? U.pick(r, late) : above(W - 30);
    // Kraina Monet: a dotted line of coins follows the ground along the whole level
    // (it was a double line - replaying it was a coin farm that emptied the shop)
    if (bonus) {
      const have = new Set(ents.filter(e => e.t === 'coin').map(e => e.x + ',' + e.y));
      for (let cx = 6; cx < W - 20; cx++) {
        let top = 0; while (top < H && cols[cx][top] === '.') top++;
        if (top >= H || top < 4) continue;
        for (const dy of [2, 3]) {
          const cy = top - dy;
          if (cols[cx][cy] === '.' && cols[cx][cy + 1] === '.' && !have.has(cx + ',' + cy) && dy === 2 && cx % 2 === 0) { coin(cx, cy); have.add(cx + ',' + cy); }
        }
      }
    }
    // the bonus level has no stars - stars stay a fixed, earned currency
    // the third star waits in the secret room when there is one - a reward for exploring
    if (!bonus && !special) { ents.push({ t: 'star', x: s0.x, y: s0.y, idx: 0 }); const st2 = room ? room.star : s2; ents.push({ t: 'star', x: st2.x, y: st2.y, idx: 2 }); }
    // star idx 1 lives in the challenge chest (see game.js)

    return { world, wi, li, H, W: cols.length, cols, ents, qc, start: { x: 2, y: 9 }, water, boss: null, theme, themeName: THEMES[theme].name, secret, room, hard: !!opt.hard, daily, noStars: special };
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

  LZ.Gen = { generate, H, themeFor, THEMES };
})();
