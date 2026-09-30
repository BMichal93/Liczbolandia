/*
 * world.js - the open world ("Wyprawa") that starts at the door of her house.
 *
 * A side-view world in the style of Terraria: endless to the left and the
 * right, caves underneath, floating islands above. Every place is computed
 * from the player's own world seed, so the same spot always looks the same
 * and only what she changed (chests opened, coins taken, flags found) has
 * to be saved.
 *
 * How it fits the engine: the engine plays a normal finite level. Here that
 * level is a WINDOW of 5 x 3 map pieces (160 x 96 tiles) around the player.
 * When she walks towards an edge the window slides by one piece: every
 * position is shifted, the tiles are rebuilt and the entities of the pieces
 * that came into view are created. The rest of the game never notices.
 *
 * Coordinates: world tiles (wx, wy); wy grows downwards, 0 = sea level.
 * Window tiles = world tiles - (G.ox, G.oy). One tile is "1 metre" in the HUD.
 */
(function () {
  const U = LZ.U, D = LZ.D, S = LZ.S, A = LZ.A, Art = LZ.Art, M = LZ.M;
  const T = LZ.T;
  const CH = 32, WCX = 5, WCY = 3;            // piece size, window size in pieces
  const BAND = 200;                           // width of one landscape (biome)
  const SEA = 3, BOTTOM = 100;                // lakes fill up to SEA; bedrock below BOTTOM
  const TUNNELS = [24, 52, 80];               // depths of the long cave tunnels
  const SKY = -26;                            // above this row: the sky islands
  const HOME_R = 24;                          // flat, safe ground around the house

  /* ================= noise ================= */
  function hash(a, b, s) {
    let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  const smooth = f => f * f * (3 - 2 * f);
  function noise1(x, s) { const i = Math.floor(x), f = x - i; return U.lerp(hash(i, 0, s), hash(i + 1, 0, s), smooth(f)); }
  function noise2(x, y, s) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = smooth(x - ix), fy = smooth(y - iy);
    return U.lerp(U.lerp(hash(ix, iy, s), hash(ix + 1, iy, s), fx), U.lerp(hash(ix, iy + 1, s), hash(ix + 1, iy + 1, s), fx), fy);
  }

  /* ================= landscapes ================= */
  const BIOMES = {
    meadow: { w: 1, amp: 3, name: 'Słoneczna Łąka' },
    ice: { w: 2, amp: 8, name: 'Lodowe Szczyty', ice: true },
    forest: { w: 4, amp: 5, name: 'Grzybowy Las', mush: true },
    desert: { w: 9, amp: 4, name: 'Złota Pustynia', sand: true },
    beach: { w: 3, amp: 5, name: 'Rafowa Zatoka', lake: true },
    volcano: { w: 6, amp: 7, name: 'Czekoladowy Wulkan', lava: true },
    factory: { w: 7, amp: 2, name: 'Zabawkowa Fabryka', belts: true },
    moon: { w: 8, amp: 6, name: 'Księżycowe Wzgórza', lowgrav: true },
  };
  const ORDER = ['ice', 'forest', 'desert', 'beach', 'volcano', 'factory', 'moon'];
  /*
   * A neighbour lives in the middle of every landscape and asks for help:
   * bring some of the things that lie around there. The reward is a piece
   * of furniture you can't buy.
   */
  const NPCS = {
    ice: { name: 'Pingwinka Pola', char: 'penguin', v: 0, item: 'snow', reward: 'snowglobe' },
    forest: { name: 'Żabka Klara', char: 'frog', v: 0, item: 'shroom', reward: 'mushlamp' },
    desert: { name: 'Liska Sara', char: 'fox', v: 0, item: 'flower', reward: 'cactuspot' },
    beach: { name: 'Chomik Kapitan', char: 'hamster', v: 0, item: 'shell', reward: 'shelllamp' },
    volcano: { name: 'Panda Iskra', char: 'panda', v: 1, item: 'lava', reward: 'chocofountain' },
    factory: { name: 'Świnka Śrubka', char: 'guinea', v: 0, item: 'gear', reward: 'train' },
    moon: { name: 'Króliczka Luna', char: 'bunny', v: 1, item: 'moon', reward: 'rocket' },
  };
  const ITEMS = {
    snow: { one: 'śnieżynka', many: 'śnieżynek', acc: 'śnieżynki' }, shroom: { one: 'grzybek', many: 'grzybków', acc: 'grzybki' }, flower: { one: 'kwiat kaktusa', many: 'kwiatów kaktusa', acc: 'kwiaty kaktusa' },
    shell: { one: 'muszelka', many: 'muszelek', acc: 'muszelki' }, lava: { one: 'kamyk lawy', many: 'kamyków lawy', acc: 'kamyki lawy' }, gear: { one: 'zębatka', many: 'zębatek', acc: 'zębatki' }, moon: { one: 'gwiezdny kamyk', many: 'gwiezdnych kamyków', acc: 'gwiezdne kamyki' },
  };
  // a giant statue of the landscape's boss stands in every landscape
  const LANDMARKS = {
    ice: { boss: 'snowman', name: 'Pomnik Bałwana Bubu' }, forest: { boss: 'shroomlord', name: 'Pomnik Grzyboloda' }, desert: { boss: 'sphinx', name: 'Wielki Sfinks' },
    beach: { boss: 'octopus', name: 'Pomnik Ośmiornicy Oli' }, volcano: { boss: 'chocodragon', name: 'Pomnik Smoka' }, factory: { boss: 'gearbot', name: 'Wielki Robot Zębatek' }, moon: { boss: 'comet', name: 'Pomnik Królowej Komet' },
  };
  const CAVE_WORLD = { id: 51, name: 'Jaskinie', features: [], enemies: ['slime', 'bat', 'shroom'],
    pal: { skyTop: '#2a1f4a', skyBot: '#120c26', far: '#3a2f60', mid: '#2a2050', grass: '#7a6ab8', grassDark: '#5a4a98', dirt: '#5a4f7a', dirtDark: '#453a66', block: '#9d7bff', blockDark: '#6a4fcf', plank: '#b8a8e0', accent: '#5ccfff' } };
  const DEEP_WORLD = { id: 52, name: 'Kryształowe Głębiny', features: [], enemies: ['bat', 'hedgehog', 'slime'],
    pal: { skyTop: '#1a1440', skyBot: '#0a0820', far: '#2a2060', mid: '#20184a', grass: '#5ccfff', grassDark: '#2a9fd6', dirt: '#3a3470', dirtDark: '#2a245a', block: '#ff85c8', blockDark: '#b8467a', plank: '#b8a8e0', accent: '#ff85c8' } };
  // the bay uses the reef's sand and creatures, but under an open sky (world 3's
  // own background is underwater)
  const BEACH_WORLD = Object.assign({}, D.WORLDS[2], { id: 53, name: 'Rafowa Zatoka', features: [],
    pal: Object.assign({}, D.WORLDS[2].pal, { skyTop: '#6fc8ff', skyBot: '#e6f8ff', far: '#5ab8f0', mid: '#ffe0a8' }) });
  const biomeWorld = bk => bk === 'beach' ? BEACH_WORLD : D.WORLDS[BIOMES[bk].w - 1];
  const WALKERS = ['slime', 'hedgehog', 'shroom', 'snowball', 'robot', 'alien', 'scorpion', 'cactus'];
  const FLYERS = ['bee', 'bat', 'cloudy', 'ufo', 'vulture'];

  /* ================= the generator ================= */
  function makeWorld(seed) {
    const s0 = seed | 0;
    const surfCache = new Map(), shaftCache = new Map(), chunkCache = new Map();
    const bandOf = x => Math.floor((x + BAND / 2) / BAND);
    // landscapes follow two different shuffled orders, one each way from home
    const rR = U.rng(s0 + 11), rL = U.rng(s0 + 23);
    const right = U.shuffle(rR, ORDER.slice()), left = U.shuffle(rL, ORDER.slice());
    const biomeKey = b => b === 0 ? 'meadow' : b > 0 ? right[(b - 1) % right.length] : left[(-b - 1) % left.length];
    const biomeAt = x => biomeKey(bandOf(x));
    // a landscape property blended over 48 tiles at each border, so the
    // ground never jumps where one landscape turns into the next
    function blend(x, get) {
      const b = bandOf(x), pos = x + BAND / 2 - b * BAND, a = get(BIOMES[biomeKey(b)]);
      if (pos < 24) return U.lerp(get(BIOMES[biomeKey(b - 1)]), a, 0.5 + pos / 48);
      if (pos > BAND - 24) return U.lerp(a, get(BIOMES[biomeKey(b + 1)]), (pos - (BAND - 24)) / 48);
      return a;
    }
    const ampAt = x => blend(x, bi => bi.amp);
    // ground height of column x (row of the top ground tile)
    function surf(x) {
      let v = surfCache.get(x);
      if (v !== undefined) return v;
      let s = ampAt(x) * (noise1(x / 46, s0 + 1) * 2 - 1) + 2.5 * (noise1(x / 14, s0 + 2) * 2 - 1);
      s += blend(x, bi => bi.lake ? 3.5 : 0);                    // bays dip below the sea level
      // terraces: plateaus 2 tiles apart, so walking has little hops to jump
      // (2-tile steps plus the slope stay within a 3-tile jump)
      s -= 2 * Math.floor(noise1(x / 30, s0 + 3) * 2.99) * blend(x, bi => bi.lake ? 0 : 1);
      const ax = Math.abs(x);
      if (ax < HOME_R) s = 0; else if (ax < HOME_R + 20) s *= (ax - HOME_R) / 20;   // flat garden around the house
      v = Math.round(s);
      if (surfCache.size > 20000) surfCache.clear();
      surfCache.set(x, v); return v;
    }
    // vertical shafts down to the first tunnel (every ~64 tiles), with a vine to climb back
    function shaft(k) {
      if (shaftCache.has(k)) return shaftCache.get(k);
      const sx = k * 64 + 10 + Math.floor(hash(k, 5, s0) * 40);
      let v = null;
      if (Math.abs(sx) > HOME_R + 16 && !BIOMES[biomeAt(sx)].lake && !BIOMES[biomeAt(sx + 2)].lake) {
        const deep = hash(k, 6, s0) < 0.45 ? 1 : 0;
        v = { x: sx, deep, top: Math.min(surf(sx), surf(sx + 1), surf(sx + 2)), bottom: tunnelC(sx + 1, deep) + tunnelH(sx + 1, deep) };
      }
      shaftCache.set(k, v); return v;
    }
    const tunnelC = (x, i) => TUNNELS[i] + Math.round(6 * (noise1(x / 60, s0 + 40 + i) * 2 - 1));
    const tunnelH = (x, i) => 2 + (noise1(x / 25, s0 + 50 + i) > 0.62 ? 1 : 0);
    function inTunnel(x, y) { for (let i = 0; i < TUNNELS.length; i++) { const c = tunnelC(x, i); if (Math.abs(y - c) <= tunnelH(x, i)) return true; } return false; }
    function caveAir(x, y, s) {
      if (y <= s + 5) return false;
      if (inTunnel(x, y)) return true;
      // the tunnels are the dependable roads underground: their floor is never
      // eaten by a cavern, so walking along a tunnel never drops into a pit
      for (let i = 0; i < TUNNELS.length; i++) if (y === tunnelC(x, i) + tunnelH(x, i) + 1) return false;
      const th = y > 60 ? 0.58 : 0.63;
      return noise2(x / 22, y / 11, s0 + 7) > th;
    }
    /* sky islands: one every 26 columns, 6-12 wide, between rows -30 and -38 */
    function island(i) {
      const cx = i * 26 + 13 + Math.round((hash(i, 21, s0) - 0.5) * 6), w = 6 + Math.floor(hash(i, 22, s0) * 7);
      return { x0: cx - Math.floor(w / 2), x1: cx - Math.floor(w / 2) + w - 1, top: -30 - Math.floor(hash(i, 23, s0) * 9) };
    }
    function skyTile(x, y) {
      const i = Math.floor(x / 26);
      for (const j of [i - 1, i, i + 1]) {
        const is = island(j);
        if (x >= is.x0 && x <= is.x1) {
          const half = (is.x1 - is.x0) / 2, d = Math.abs(x - (is.x0 + half)) / (half + 0.5);
          const th = Math.max(1, Math.round(3 - d * 2.2));
          if (y >= is.top && y < is.top + th) return '#';
        }
      }
      // cloud stepping stones in the gaps between two islands
      const a = island(i), b = island(i + 1), a0 = island(i - 1);
      const gap = (L, R) => { if (x > L.x1 && x < R.x0) { const k = x - L.x1 - 1, len = R.x0 - L.x1 - 1; if (k % 5 >= 2 && k % 5 <= 4 && k < len - 1) { const f = (k + 1) / (len + 1); const yy = Math.round(U.lerp(L.top, R.top, f)) - 1; if (y === yy) return '-'; } } return null; };
      return gap(a, b) || gap(a0, a) || '.';
    }
    /* beanstalks: every ~150 columns a vine from the ground up to an island */
    const stalkCache = new Map();
    function stalk(k) {
      if (stalkCache.has(k)) return stalkCache.get(k);
      const guess = k * 150 + 40 + Math.floor(hash(k, 31, s0) * 70);
      const is = island(Math.floor(guess / 26)), bx = is.x0 - 1;
      let v = null;
      if (Math.abs(bx) > HOME_R + 10 && !BIOMES[biomeAt(bx)].lake) v = { x: bx, top: is.top - 1, bottom: surf(bx) - 1 };
      stalkCache.set(k, v); return v;
    }

    /* The tile at a world position. Pure function of the seed. */
    function baseTile(x, y) {
      if (y >= BOTTOM) return 'U';
      const s = surf(x), bk = biomeAt(x), bi = BIOMES[bk];
      // shafts (a hole with a vine at its left edge)
      const sh = shaft(Math.floor(x / 64));
      if (sh && x >= sh.x && x <= sh.x + 2 && y >= sh.top && y <= sh.bottom) return x === sh.x && y < sh.bottom ? 'H' : '.';
      if (sh && x === sh.x && y === sh.top - 1) return 'H';
      // beanstalk
      const st = stalk(Math.floor(x / 150));
      if (st && x === st.x && y >= st.top && y <= st.bottom) return 'H';
      if (st && (x === st.x + 1 || x === st.x - 1) && y > st.top + 3 && y < st.bottom - 2 && (st.bottom - y) % 7 === 0 && ((st.bottom - y) / 7) % 2 === (x > st.x ? 1 : 0)) return '-';
      if (y < s) {
        if (y < SKY + 2 && y > SKY - 20) return skyTile(x, y);
        if (bi.lake && y >= SEA) return 'W';
        // lava pools get stone pillars every 7 tiles (4 lava, 3 stone), so even a
        // wide pool can be crossed by hopping - a pool without them could block the way
        if (bi.lava && y >= 5 && s > 5) return ((x % 7) + 7) % 7 < 4 ? 'L' : '#';
        return '.';
      }
      if (y === s) {
        const flat = surf(x - 1) === s && surf(x + 1) === s;
        if (bi.ice && noise1(x / 9, s0 + 60) > 0.6) return 'I';
        if (bi.sand && flat && noise1(x / 7, s0 + 61) > 0.72 && Math.abs(x) > HOME_R) return 'Q';
        if (bi.belts && flat && Math.abs(x) > HOME_R) { const n = noise1(x / 11, s0 + 62); if (n > 0.7) return '>'; if (n < 0.28) return '<'; }
      }
      if (caveAir(x, y, s)) {
        // some columns get a vine through their cave air, so every pit in a cave can be climbed
        if (hash(x, 77, s0) < 0.06 && caveAir(x, y + 1, s)) return 'H';
        return '.';
      }
      return '#';
    }
    // the ground something can stand on near column x: not in a bay or a lava pool
    function standAt(x, far) {
      // (far: keep looking further, for neighbours who must never stand in the middle of a bay)
      for (let d = 0; d < (far ? 90 : 12); d++) for (const xx of [x + d, x - d]) {
        const s = surf(xx); let y = s - 8;
        while (y < s + 1 && !'#I'.includes(tile(xx, y))) { if ('WLQ'.includes(tile(xx, y))) { y = 999; break; } y++; }
        if (y <= s && tile(xx, y - 1) === '.') return { x: xx, y };
      }
      return { x, y: surf(x) };
    }
    const mods = {};   // tiles she changed (bricks broken...), filled from the save
    function tile(x, y) { const m = mods[x + ',' + y]; return m !== undefined ? m : baseTile(x, y); }

    /* ---- one 32x32 piece: its tiles and what lives there ---- */
    function chunk(cx, cy) {
      const key = cx + ',' + cy;
      let c = chunkCache.get(key);
      if (c) return c;
      const x0 = cx * CH, y0 = cy * CH;
      const cols = [];
      for (let i = 0; i < CH; i++) { const col = new Array(CH); for (let j = 0; j < CH; j++) col[j] = tile(x0 + i, y0 + j); cols.push(col); }
      const defs = [], qc = {};
      const r = U.rng(Math.floor(hash(cx, cy, s0 + 99) * 1e9));
      const dist = Math.abs(bandOf(x0 + 16));
      const at = (x, y) => (x >= x0 && x < x0 + CH && y >= y0 && y < y0 + CH) ? cols[x - x0][y - y0] : tile(x, y);
      const inChunk = (x, y) => x >= x0 && x < x0 + CH && y >= y0 && y < y0 + CH;
      const add = d => { if (inChunk(d.x, d.y)) defs.push(d); };
      const tierOf = (x, y) => y < SKY ? 2 : y > 60 ? 3 : y > surf(x) + 10 ? (dist >= 2 ? 3 : 2) : dist >= 3 ? 3 : dist >= 1 ? 2 : 1;
      // --- surface ---
      for (let pass = 0; pass < 1; pass++) {
        const cols16 = [];
        for (let i = 0; i < CH; i++) { const x = x0 + i, s = surf(x); if (s - 1 >= y0 && s - 1 < y0 + CH && Math.abs(x) > HOME_R && at(x, s) !== 'W' && at(x, s - 1) === '.') cols16.push(x); }
        if (!cols16.length) break;
        const bk = biomeAt(x0 + 16), bw = D.WORLDS[BIOMES[bk].w - 1];   // enemy list from the real world (fish for the bay)
        const walkers = bw.enemies.filter(e => WALKERS.includes(e)), flyers = bw.enemies.filter(e => FLYERS.includes(e));
        const nEn = Math.min(4, 1 + Math.floor(r() * (1.5 + dist * 0.6)));
        for (let k = 0; k < nEn; k++) {
          const x = U.pick(r, cols16), s = surf(x);
          if (flyers.length && r() < 0.35) add({ t: 'enemy', type: U.pick(r, flyers), x, y: s - 3 });
          else if (walkers.length) {
            // spiky ones (can't be stomped) only on open flat ground, never near lava or a step:
            // the explorer test lost 30 hearts to hedgehogs between the lava pillars
            let type = U.pick(r, walkers);
            const flat = [-3, -2, -1, 1, 2, 3].every(d => surf(x + d) === s && at(x + d, s - 1) === '.');
            if (['hedgehog', 'cactus'].includes(type) && (!flat || r() < 0.5)) type = walkers.find(w => !['hedgehog', 'cactus'].includes(w)) || 'slime';
            add({ t: 'enemy', type, x, y: s });
          }
        }
        if (r() < 0.3) { const x = U.pick(r, cols16), s = surf(x); for (let i = 0; i < 4; i++) if (at(x + i, s - 2) === '.') add({ t: 'coin', x: x + i, y: s - 2 - (i === 1 || i === 2 ? 1 : 0), wid: 'c' + (x + i) + ',' + (s - 2) }); }
        if (r() < 0.28) { const x = U.pick(r, cols16); add({ t: 'wchest', x, y: surf(x), id: x + ',' + surf(x), tier: tierOf(x, surf(x) - 1) }); }
        if (NPCS[bk]) for (let k = 0; k < 2; k++) if (r() < 0.8) { const x = U.pick(r, cols16), s = surf(x); add({ t: 'witem', x, y: s - 1, item: NPCS[bk].item, id: 'i' + x + ',' + (s - 1) }); }
        if (r() < 0.18) {   // a row of bricks with a surprise
          const x = U.pick(r, cols16), s = surf(x), by = s - 4;
          for (let i = 0; i < 4; i++) if (inChunk(x + i, by) && at(x + i, by) === '.' && at(x + i, by + 1) === '.') { cols[x + i - x0][by - y0] = i === 1 ? '?' : 'B'; if (i === 1) qc[(x + i) + ',' + by] = U.pick(r, ['heart', 'magnet', 'boots', 'shield']); }
        }
        if (BIOMES[bk].mush && r() < 0.35) { const x = U.pick(r, cols16); add({ t: 'mushroom', x, y: surf(x) }); }
        else if (r() < 0.12) { const x = U.pick(r, cols16); add({ t: 'spring', x, y: surf(x) }); }
        // fish in the bays
        if (BIOMES[bk].lake) for (let i = 0; i < CH; i += 8) { const x = x0 + i; if (at(x, SEA + 2) === 'W' && r() < 0.5) add({ t: 'enemy', type: 'fish', x, y: SEA + 3 }); }
      }
      // --- flags every 100 m, distance signs, the neighbour, the statue, the house ---
      // (each stands on dry ground: moved a little sideways off water or lava)
      for (let i = 0; i < CH; i++) {
        const x = x0 + i;
        if (x === 0) add({ t: 'house', x: 0, y: 0 });
        const b = bandOf(x);
        if (x % 100 === 50 && Math.abs(x) > 60) { const st = standAt(x); if (inChunk(x, st.y)) defs.push({ t: 'wflag', x: st.x, y: st.y, id: 'f' + st.x + ',' + st.y, name: BIOMES[biomeAt(x)].name + ' ' + Math.abs(Math.round(x / 100)) }); }
        if (x % 100 === 0 && x !== 0) { const st = standAt(x); if (inChunk(x, st.y)) defs.push({ t: 'wsign', x: st.x, y: st.y, text: Math.abs(x) + ' m', dir: x > 0 ? 1 : -1 }); }
        if (b !== 0 && x === b * BAND - 30) { const st = standAt(x, true); if (inChunk(x, st.y)) defs.push({ t: 'npc', x: st.x, y: st.y, band: b, biome: biomeKey(b) }); }
        if (b !== 0 && x === b * BAND + 40) { const st = standAt(x); if (inChunk(x, st.y)) defs.push({ t: 'landmark', x: st.x, y: st.y, band: b, biome: biomeKey(b) }); }
      }
      // --- shaft bottoms: a flag in the tunnel ---
      const sh = shaft(Math.floor(x0 / 64)), sh2 = shaft(Math.floor((x0 + CH - 1) / 64));
      // a little sign warns about the hole (and invites her down)
      for (const q of [sh, sh2]) if (q) { const st = standAt(q.x - 2); if (st.x < q.x && inChunk(st.x, st.y)) defs.push({ t: 'wsign', x: st.x, y: st.y, text: 'Jaskinia ↓', dir: 0 }); }
      for (const q of [sh, sh2]) if (q) add({ t: 'wflag', x: q.x + 4, y: q.bottom + 1, id: 'f' + (q.x + 4) + ',' + (q.bottom + 1), name: 'Jaskinia ' + Math.abs(Math.round(q.x / 100)) + (q.bottom > 40 ? ' (głęboko)' : '') });
      // --- caves: floors inside this piece ---
      if (y0 + CH > -5) {
        const floors = [];
        for (let i = 0; i < CH; i += 2) for (let j = 1; j < CH; j++) {
          const x = x0 + i, y = y0 + j;
          if (y > surf(x) + 6 && cols[i][j] === '#' && cols[i][j - 1] === '.' && (j < 2 || cols[i][j - 2] === '.')) floors.push([x, y]);
        }
        if (floors.length) {
          const deep = y0 > 50;
          const cw = deep ? DEEP_WORLD : CAVE_WORLD;
          const n = Math.min(3, Math.floor(r() * (2 + dist * 0.5)));
          for (let k = 0; k < n; k++) { const [x, y] = U.pick(r, floors); if (r() < 0.3) add({ t: 'enemy', type: 'bat', x, y: y - 3 }); else add({ t: 'enemy', type: U.pick(r, cw.enemies.filter(e => WALKERS.includes(e))), x, y }); }
          if (r() < 0.5) { const [x, y] = U.pick(r, floors); add({ t: 'wchest', x, y, id: x + ',' + y, tier: tierOf(x, y) }); }
          if (r() < 0.3) { const [x, y] = U.pick(r, floors); for (let i = 0; i < 5; i++) if (at(x + i, y - 1) === '.' && at(x + i, y) !== '.') add({ t: 'coin', x: x + i, y: y - 1, wid: 'c' + (x + i) + ',' + (y - 1) }); }
          const bk = biomeAt(x0 + 16);
          if (NPCS[bk] && r() < 0.5) { const [x, y] = U.pick(r, floors); add({ t: 'witem', x, y: y - 1, item: NPCS[bk].item, id: 'i' + x + ',' + (y - 1) }); }
        }
      }
      // --- sky islands: a treasure on some, a flag on the one a beanstalk reaches ---
      if (y0 <= SKY && y0 + CH > SKY - 20) {
        for (let i = Math.floor(x0 / 26) - 1; i <= Math.floor((x0 + CH) / 26); i++) {
          const is = island(i), mid = Math.floor((is.x0 + is.x1) / 2);
          const ri = U.rng(Math.floor(hash(i, 88, s0) * 1e9));
          if (ri() < 0.45) add({ t: 'wchest', x: mid, y: is.top, id: mid + ',' + is.top, tier: 2 });
          if (ri() < 0.4) add({ t: 'enemy', type: ri() < 0.5 ? 'bee' : 'cloudy', x: mid + 2, y: is.top - 3 });
          if (ri() < 0.5) for (let k = is.x0 + 1; k < is.x1; k += 2) add({ t: 'coin', x: k, y: is.top - 2, wid: 'c' + k + ',' + (is.top - 2) });
        }
        const stk = stalk(Math.floor(x0 / 150)), stk2 = stalk(Math.floor((x0 + CH - 1) / 150));
        for (const q of [stk, stk2]) if (q) add({ t: 'wflag', x: q.x + 2, y: q.top + 1, id: 'f' + (q.x + 2) + ',' + (q.top + 1), name: 'Chmurki ' + Math.abs(Math.round(q.x / 100)) });
      }
      // add-ons (fun.js) put their own things into the piece: stations, camps...
      LZ.Ext.each('world', 'chunk', self, cx, cy, x0, y0, add, r);
      // no duplicates (two helpers can add the same flag)
      const seen = new Set(); c = { cols, defs: defs.filter(d => { const k = d.t + (d.id || d.wid || (d.x + ',' + d.y)); if (seen.has(k)) return false; seen.add(k); return true; }), qc };
      if (chunkCache.size > 90) chunkCache.delete(chunkCache.keys().next().value);
      chunkCache.set(key, c); return c;
    }
    const self = { seed: s0, surf, biomeAt, bandOf, biomeKey, tile, baseTile, chunk, mods, shaft, stalk, island, chunkCache, tunnelC, tunnelH, inTunnel, standAt, SEA, SKY, BAND, HOME_R, isLake: x => !!BIOMES[biomeAt(x)].lake };
    return self;
  }

  /* ================= save data ================= */
  function worldSave(p) {
    if (!p.world || p.world.seed == null) p.world = Object.assign({ seed: Math.floor(Math.random() * 1e9), flags: {}, chests: {}, got: {}, items: {}, quests: {}, landmarks: {}, mods: {}, plans: [], maxDist: 0, maxDepth: 0, sky: false, chestCount: 0, questCount: 0, mole: false }, p.world || {});
    const w = p.world;
    ['flags', 'chests', 'got', 'items', 'quests', 'landmarks', 'mods'].forEach(k => { w[k] = w[k] || {}; });
    w.plans = w.plans || [];
    return w;
  }
  let W = null;   // generator for the current profile
  function gen(p) {
    const ws = worldSave(p);
    if (!W || W.seed !== (ws.seed | 0)) W = makeWorld(ws.seed);
    Object.assign(W.mods, ws.mods);
    return W;
  }

  /* ================= window streaming ================= */
  // build the window's tiles and entity definitions around world origin (ox, oy)
  function fillWindow(G) {
    const cols = [], qc = {}, defs = [];
    for (let i = 0; i < WCX * CH; i++) cols.push(new Array(WCY * CH));
    const cx0 = G.ox / CH, cy0 = G.oy / CH;
    for (let a = 0; a < WCX; a++) for (let b = 0; b < WCY; b++) {
      const c = W.chunk(cx0 + a, cy0 + b);
      for (let i = 0; i < CH; i++) for (let j = 0; j < CH; j++) cols[a * CH + i][b * CH + j] = c.cols[i][j];
      for (const k in c.qc) { const [x, y] = k.split(',').map(Number); qc[(x - G.ox) + ',' + (y - G.oy)] = c.qc[k]; }
    }
    return { cols, qc };
  }
  function defsFor(G, cx, cy) {
    const c = W.chunk(cx, cy), ws = G.prof.world, out = [];
    for (const d of c.defs) {
      if (d.wid && ws.got[d.wid]) continue;           // coins already taken
      if (d.t === 'witem' && ws.got[d.id]) continue;  // items already picked up
      out.push(Object.assign({}, d, { x: d.x - G.ox, y: d.y - G.oy }));
    }
    // things whose state changes (garden plots, a treasure spot) come from the add-ons each time
    LZ.Ext.each('world', 'defs', G, cx, cy, d => out.push(Object.assign({}, d, { x: d.x - G.ox, y: d.y - G.oy })), W);
    return out;
  }
  const inWin = (G, x, y) => x > -T * 2 && x < G.W * T + T * 2 && y > -T * 4 && y < G.H * T + T * 4;
  function shift(G, dxc, dyc) {
    const dx = dxc * CH * T, dy = dyc * CH * T;
    G.ox += dxc * CH; G.oy += dyc * CH;
    const mv = o => { if (!o) return; o.x -= dx; o.y -= dy; };
    mv(G.player); mv(G.player.lastSafe); mv(G.checkpoint); mv(G.pet); G.cam.x -= dx; G.cam.y -= dy;
    for (const e of G.ents) { mv(e); if (e.x1 !== undefined) { e.x1 -= dx; e.x2 -= dx; e.y1 -= dy; e.y2 -= dy; } if (e.oy !== undefined) e.oy -= dy; }
    for (const e of G.enemies) { mv(e); if (e.ox !== undefined) { e.ox -= dx; e.oy -= dy; } if (e.restY !== undefined) e.restY -= dy; if (e.stumpTop !== undefined) e.stumpTop -= dy; }
    G.particles.forEach(mv); G.projectiles.forEach(mv); G.texts.forEach(mv);
    G.ents = G.ents.filter(e => inWin(G, e.x, e.y));
    G.enemies = G.enemies.filter(e => inWin(G, e.x, e.y));
    G.particles = G.particles.filter(e => inWin(G, e.x, e.y));
    const win = fillWindow(G);
    G.grid = win.cols; G.lvl.cols = win.cols; G.qc = win.qc; G.bumps = {};
    LZ.Game._computeMasks();
    // create what lives in the pieces that just came into the window
    const now = new Set();
    for (let a = 0; a < WCX; a++) for (let b = 0; b < WCY; b++) now.add((G.ox / CH + a) + ',' + (G.oy / CH + b));
    const fresh = [];
    now.forEach(k => { if (!G.wl.loaded.has(k)) { const [cx, cy] = k.split(',').map(Number); fresh.push(...defsFor(G, cx, cy)); } });
    G.wl.loaded = now;
    LZ.Game._build(fresh);
    LZ.Ext.each('world', 'shifted', G);
  }
  // put the window around a world tile (start, teleport)
  function placeWindow(G, wx, wy) {
    // never drop her inside rock: move up to the first free spot
    const solid = c => '#IU=?BT<>'.includes(c);
    for (let k = 0; k < 60 && (solid(W.tile(wx, wy)) || solid(W.tile(wx, wy - 1))); k++) wy--;
    G.ox = (Math.floor(wx / CH) - 2) * CH; G.oy = (Math.floor(wy / CH) - 1) * CH;
    G.ents = []; G.enemies = []; G.particles = []; G.projectiles = []; G.texts = [];
    const win = fillWindow(G);
    G.grid = win.cols; G.lvl.cols = win.cols; G.qc = win.qc; G.bumps = {};
    G.W = WCX * CH; G.H = WCY * CH; G.lvl.W = G.W; G.lvl.H = G.H;
    LZ.Game._computeMasks();
    const defs = [];
    G.wl.loaded = new Set();
    for (let a = 0; a < WCX; a++) for (let b = 0; b < WCY; b++) { const cx = G.ox / CH + a, cy = G.oy / CH + b; G.wl.loaded.add(cx + ',' + cy); defs.push(...defsFor(G, cx, cy)); }
    LZ.Game._build(defs);
    const p = G.player;
    p.x = (wx - G.ox) * T + T / 2 - 14; p.y = (wy - G.oy) * T + T - 40; p.vx = p.vy = 0; p.lastSafe = null;
    G.checkpoint = { x: p.x, y: p.y };
    G.cam.x = p.x - LZ.Game.view.w * 0.4; G.cam.y = p.y - LZ.Game.view.h * 0.55;
    LZ.Game._clampCam();
    LZ.Ext.each('world', 'placed', G);
  }

  /* ================= building the run ================= */
  function buildLevel(p, mode) {
    gen(p);
    const ws = worldSave(p);
    // where to start: a chosen flag, or next to the house door
    let at = mode && mode.at;
    if (!at) at = { x: 3, y: W.surf(3) - 1 };
    const lvl = { world: D.WORLDS[0], wi: 0, li: 0, H: WCY * CH, W: WCX * CH, cols: [], ents: [], qc: {}, start: { x: 0, y: 0 }, water: false, boss: null, theme: null, themeName: '', noStars: true, sandbox: 'world', startAt: at };
    // the engine needs a grid right away; placeWindow() in init fills the real one
    for (let i = 0; i < lvl.W; i++) lvl.cols.push(new Array(lvl.H).fill('.'));
    ws.lastVisit = Date.now();
    return lvl;
  }

  const hooks = {
    init(G) {
      G.wl = { loaded: new Set(), band: null, lastSave: 0, standHouse: 0, modal: false };
      G.hearts = G.maxHearts;
      LZ.Ext.each('world', 'init', G, W);
      placeWindow(G, G.lvl.startAt.x, G.lvl.startAt.y);
      bandToast(G, true);
      LZ.Fun.bar('world', true);
    },
    tick(G, dt) {
      const p = G.player;
      // slide the window when she gets near its edge
      const ptx = Math.floor((p.x + 14) / T), pty = Math.floor((p.y + 20) / T);
      if (ptx < 48) shift(G, -1, 0); else if (ptx > WCX * CH - 48) shift(G, 1, 0);
      if (pty < 26) shift(G, 0, -1); else if (pty > WCY * CH - 26) shift(G, 0, 1);
      const wx = G.ox + Math.floor((p.x + 14) / T), wy = G.oy + Math.floor((p.y + 20) / T);
      G.wl.wx = wx; G.wl.wy = wy;
      // build the next pieces ahead of time (one per frame), so the slide itself is quick
      const cxs = [G.ox / CH - 1, G.ox / CH + WCX], cys = [G.oy / CH - 1, G.oy / CH, G.oy / CH + 1, G.oy / CH + WCY];
      prefetch: for (const cxx of cxs) for (const cyy of cys) if (!W.chunkCache.has(cxx + ',' + cyy)) { W.chunk(cxx, cyy); break prefetch; }
      const bk = W.biomeAt(wx), s = W.surf(wx);
      // landscape physics: floaty on the moon (only above ground), swimming in the bays
      G.lowgrav = !!BIOMES[bk].lowgrav && wy < s + 3;
      const cx = Math.floor((p.x + 14) / T), cy = Math.floor((p.y + 20) / T);
      G.inWater = G.grid[cx] && G.grid[cx][cy] === 'W';
      G.lvl.world = worldFor(wx, wy);
      bandToast(G);
      // records for badges
      const ws = G.prof.world;
      const dist = Math.abs(wx), depth = wy - s;
      let changed = false;
      if (dist > ws.maxDist) { ws.maxDist = dist; changed = true; }
      if (depth > ws.maxDepth) { ws.maxDepth = depth; changed = true; }
      if (wy < SKY && !ws.sky) { ws.sky = true; changed = true; }
      if (changed) checkBadges(G);
      // stand in the house door to go inside
      const house = G.ents.find(e => e.k === 'house');
      const atDoor = house && Math.abs(p.x + 14 - house.x) < 22 && p.grounded && Math.abs(p.vx) < 20;
      G.wl.standHouse = atDoor ? G.wl.standHouse + dt : 0;
      if (G.wl.standHouse > 0.7) { G.wl.standHouse = -99; goHome(); }
      // save now and then (position isn't saved, but what she found is)
      G.wl.lastSave += dt; if (G.wl.lastSave > 20) { G.wl.lastSave = 0; S.save(); }
      LZ.Ext.each('world', 'tick', G, dt, W);
    },
    buildEnt(G, e, px, py) {
      const ws = G.prof.world;
      switch (e.t) {
        case 'wchest': G.ents.push({ k: 'wchest', x: px, y: py, w: 44, id: e.id, tier: e.tier, open: ws.chests[e.id] ? 1 : 0, opened: !!ws.chests[e.id] }); break;
        case 'wflag': G.ents.push({ k: 'wflag', x: px + T / 2, y: py, id: e.id, name: e.name, on: !!ws.flags[e.id], wx: e.x + G.ox, wy: e.y + G.oy, anim: ws.flags[e.id] ? 1 : 0 }); break;
        case 'witem': G.ents.push({ k: 'witem', x: px + T / 2, y: py + T / 2, item: e.item, id: e.id }); break;
        case 'wsign': G.ents.push({ k: 'wsign', x: px + T / 2, y: py, text: e.text, dir: e.dir }); break;
        case 'npc': G.ents.push({ k: 'npc', x: px + T / 2, y: py, band: e.band, biome: e.biome, bob: Math.random() * 6 }); break;
        case 'landmark': G.ents.push({ k: 'landmark', x: px + T / 2, y: py, band: e.band, biome: e.biome }); break;
        case 'house': G.ents.push({ k: 'house', x: px + T / 2, y: py }); break;
        default: LZ.Ext.first('world', 'buildEnt', G, e, px, py, W);
      }
    },
    updateEnt(G, e, i, dt, pc) {
      const near = (dx, dy) => Math.abs(pc.x - e.x - (e.w ? e.w / 2 : 0)) < dx && Math.abs(pc.y - (e.y - 20)) < dy;
      switch (e.k) {
        case 'wchest':
          if (e.opened) { e.open = Math.min(1, e.open + dt * 3); break; }
          if (near(40, 50) && G.player.grounded && !G.wl.modal) openChest(G, e);
          break;
        case 'wflag':
          if (e.on) e.anim = Math.min(1, e.anim + dt * 2);
          if (!e.on && near(30, 90)) activateFlag(G, e);
          if (e.on && near(30, 90) && G.hearts < G.maxHearts) { G.hearts = G.maxHearts; A.play('heart'); }
          if (e.on && near(30, 90)) G.wl.lastFlag = { x: e.wx, y: e.wy - 1 };
          break;
        case 'witem':
          if (Math.abs(pc.x - e.x) < 30 && Math.abs(pc.y - e.y) < 34) {
            const ws = G.prof.world; ws.got[e.id] = 1; ws.items[e.item] = (ws.items[e.item] || 0) + 1;
            G.ents.splice(i, 1); A.play('coin');
            LZ.Game._floatText(e.x, e.y - 20, '+1 ' + ITEMS[e.item].one, '#fff', 20);
          }
          break;
        case 'npc':
          e.bob += dt;
          if (near(62, 70) && !G.wl.modal && !e.cool) { e.cool = true; talkNpc(G, e); }
          if (!near(90, 120)) e.cool = false;
          break;
        case 'landmark': {
          const ws = G.prof.world;
          if (!ws.landmarks[e.band] && near(140, 260)) discoverLandmark(G, e);
          break;
        }
        default: return LZ.Ext.first('world', 'updateEnt', G, e, i, dt, pc, W);
      }
    },
    drawEnt(ctx, e, t, G) {
      switch (e.k) {
        case 'wchest': drawChest(ctx, e, t); return true;
        case 'wflag': drawFlag(ctx, e, t); return true;
        case 'witem': drawItem(ctx, e.item, e.x, e.y + Math.sin(t * 3 + e.x) * 3, t); return true;
        case 'wsign': drawSign(ctx, e); return true;
        case 'npc': drawNpc(ctx, e, t, G); return true;
        case 'landmark': drawLandmark(ctx, e, t, G); return true;
        case 'house': drawHouse(ctx, e, t, G); return true;
      }
      return LZ.Ext.first('world', 'drawEnt', ctx, e, t, G, W);
    },
    worldAt(G, x, y) { return worldFor(x + G.ox, y + G.oy); },
    drawBack(ctx, G, cam, vw, vh, t) {
      const wxc = G.ox + (cam.x + vw / 2) / T, wyc = G.oy + (cam.y + vh / 2) / T;
      const s = W.surf(Math.floor(wxc)), depth = wyc - s;
      const camWX = cam.x + G.ox * T;
      if (wyc < SKY + 4) {
        // the sky layer: cloud castles far away
        Art.drawBackground(ctx, D.WORLDS[4], camWX, 60, vw, vh, t);
      } else {
        const bw = biomeWorld(W.biomeAt(Math.floor(wxc)));
        // the hills sit at the horizon of the ground under the camera
        const camYrel = U.clamp((wyc - s) * T + 300, 0, 300);
        Art.drawBackground(ctx, bw, camWX, camYrel, vw, vh, t);
      }
      if (depth > 6) {
        ctx.globalAlpha = U.clamp((depth - 6) / 6, 0, 1);
        Art.drawCave(ctx, depth > 45 ? DEEP_WORLD : CAVE_WORLD, camWX, vw, vh, t);
        ctx.globalAlpha = 1;
      }
      LZ.Ext.each('world', 'drawBack', ctx, G, cam, vw, vh, t, W, depth);
    },
    drawFront(ctx, G, x0, x1, y0, y1, t) {
      // water and lava pools in front of whoever is in them
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
        const c = G.grid[x] && G.grid[x][y];
        if (c === 'W') {
          const surface = G.grid[x][y - 1] !== 'W';
          ctx.fillStyle = 'rgba(70,170,240,0.45)'; ctx.fillRect(x * T - 0.3, y * T + (surface ? 8 : 0) - 0.3, T + 0.6, T + 0.6 - (surface ? 8 : 0));
          if (surface) { ctx.fillStyle = 'rgba(220,245,255,0.8)'; for (let k = 0; k < 3; k++) { LZ.Art.ell(ctx, x * T + 8 + k * 16, y * T + 9 + Math.sin(t * 3 + x + k) * 2, 7, 2.5); ctx.fill(); } }
        } else if (c === 'Q') { /* drawn by the engine */ }
        else if (c === 'L') {
          const surface = G.grid[x][y - 1] !== 'L';
          if (surface) Art.drawLava(ctx, x * T, y * T, T, t, G.lvl.world);
          else { ctx.fillStyle = '#8b5a3c'; ctx.fillRect(x * T - 0.3, y * T - 0.3, T + 0.6, T + 0.6); }
        }
      }
      LZ.Ext.each('world', 'drawFront', ctx, G, t, W);
    },
    drawHUD(ctx, G, vw, vh, t, text) {
      const pad = 14, p = G.prof, ws = p.world;
      LZ.Ext.each('world', 'drawSky', ctx, G, vw, vh, t, W);   // night and weather, over the world but under the HUD
      for (let i = 0; i < G.maxHearts; i++) Art.drawHeart(ctx, pad + 18 + i * 36, pad + 22, 15, i < G.hearts);
      const cx = pad + 18 + G.maxHearts * 36 + 18;
      Art.drawCoin(ctx, cx, pad + 20, 0, 13);
      text(ctx, String(p.coins), cx + 20, pad + 22, 28, '#fff', '#5a3a8a', 'left');
      // where am I: distance from home (with an arrow pointing home), depth or height
      const wx = G.wl.wx || 0, wy = G.wl.wy || 0, s = W.surf(wx);
      const dist = Math.abs(wx), dir = wx > 0 ? '←' : '→';
      text(ctx, dist < 8 ? '🏠' : '🏠 ' + dir + ' ' + dist + ' m', vw / 2, pad + 22, 24, '#fff', '#5a3a8a');
      const depth = wy - s;
      if (depth > 3) text(ctx, '⬇ ' + depth + ' m pod ziemią', vw / 2, pad + 50, 18, '#bfe8ff', '#2a2050');
      else if (wy < s - 12) text(ctx, '⬆ ' + (s - wy) + ' m w górze', vw / 2, pad + 50, 18, '#fff6c9', '#5a3a8a');
      // the neighbour's task, when there is one
      const q = activeQuest(ws);
      if (q) { const have = ws.items[q.item] || 0; drawItem(ctx, q.item, pad + 22, pad + 60, t, 0.9); text(ctx, have + ' / ' + q.need, pad + 42, pad + 62, 22, have >= q.need ? '#b8ffb8' : '#fff', '#5a3a8a', 'left'); }
      const px = cx + 110; const pl = G.player;
      [['magnet', pl.magnetT], ['boots', pl.bootsT], ['rainbow', pl.rainbowT]].forEach(([k, v], i) => { if (v > 0) Art.drawPowerup(ctx, k, px + i * 40, pad + 22, 0); });
      if (G.wl.standHouse > 0.1) text(ctx, 'Wracam do domku...', vw / 2, vh * 0.3, 30, '#fff', '#7a5ce6');
      LZ.Ext.each('world', 'drawHUD', ctx, G, vw, vh, t, text, W);
      return true;
    },
    outOfHearts(G) {
      // no game over: back to the last flag she touched (or home) with full hearts
      const to = G.wl.lastFlag || { x: 3, y: W.surf(3) - 1 };
      G.hearts = G.maxHearts;
      LZ.Ext.each('world', 'respawn', G);
      placeWindow(G, to.x, to.y);
      G.player.invuln = 2;
      LZ.Game._toast('Nic się nie stało! Wracasz do flagi.', 2);
      G.state = 'respawn'; G.respawnT = 0.6;
      return true;
    },
    onBlock(G, tx, ty, c) { const ws = G.prof.world; const k = (tx + G.ox) + ',' + (ty + G.oy); ws.mods[k] = c; W.mods[k] = c; const ck = Math.floor((tx + G.ox) / CH) + ',' + Math.floor((ty + G.oy) / CH); W.chunkCache.delete(ck); },
    onCoin(G, e) { G.prof.world.got[e.wid] = 1; },
    onKill(G, e, stomp) { LZ.Ext.each('world', 'kill', G, e, stomp, W); },
    quit(G) { LZ.Fun.bar('world', false); LZ.Ext.each('world', 'quit', G); S.save(); },
  };
  function worldFor(wx, wy) {
    const s = W.surf(wx);
    if (wy > s + 8) return wy > 52 ? DEEP_WORLD : CAVE_WORLD;
    if (wy < SKY + 2) return D.WORLDS[4];
    return biomeWorld(W.biomeAt(wx));
  }
  function bandToast(G, first) {
    const b = W.bandOf(G.wl.wx != null ? G.wl.wx : G.lvl.startAt.x);
    if (b === G.wl.band) return;
    G.wl.band = b;
    const bk = W.biomeKey(b);
    LZ.Game._toast(b === 0 ? (first ? 'Wyprawa! Idź w lewo albo w prawo' : 'Okolice domku') : BIOMES[bk].name, 2.4);
    A.playMusic(b === 0 ? 5 : D.WORLDS[BIOMES[bk].w - 1].music);
  }

  /* ================= treasure chests ================= */
  const CHEST_FINDS = { 1: ['treasure', 'telescope', 'plant', 'rug', 'picture', 'teddy', 'lamp'], 2: ['crystallamp', 'fossil', 'cloudbed', 'telescope', 'aquarium', 'fireplace'], 3: ['throne', 'crystallamp', 'fossil', 'piano'] };
  function rollLoot(p, tier, firstTry) {
    const ws = p.world, loot = [];
    const coins = firstTry ? [0, 6, 10, 16][tier] + Math.floor(Math.random() * 5) : 0;
    if (coins) loot.push({ kind: 'coins', n: coins });
    // special finds first: the mole friend in the deep, the upstairs blueprint
    if (tier === 3 && !ws.mole) { ws.mole = true; loot.push({ kind: 'char', id: 'mole' }); return loot; }
    if (tier === 3 && !ws.plans.includes('plan4')) { ws.plans.push('plan4'); loot.push({ kind: 'plan', name: 'Plan: Piętro na górze' }); return loot; }
    if (LZ.Ext.first('world', 'loot', p, tier, loot)) return loot;   // seeds, a treasure map...
    const missing = D.STICKERS.filter(s => !(p.stickers || []).includes(s.id));
    if (missing.length && Math.random() < 0.2) { const st = U.pick(Math.random, missing); (p.stickers = p.stickers || []).push(st.id); loot.push({ kind: 'sticker', name: st.name }); return loot; }
    const id = U.pick(Math.random, CHEST_FINDS[tier]);
    const home = LZ.Home.homeOf(p); home.inv[id] = (home.inv[id] || 0) + 1;
    loot.push({ kind: 'furn', id, name: LZ.Home.FURN_BY[id].name });
    return loot;
  }
  function openChest(G, e) {
    G.wl.modal = true; LZ.In.reset();
    const h = LZ.UI._h, p = G.prof, band = S.mathBand(p);
    let first = true, pr = M.question(p.skill, band);
    const box = h('div');
    const tiers = { 1: 'Skrzynia', 2: 'Srebrna skrzynia', 3: 'Złota skrzynia' };
    const m = LZ.UI._modal([h('h2', null, tiers[e.tier] + '!'), box], { dismiss: false });
    function show() {
      box.innerHTML = '';
      box.appendChild(h('p.chestq', null, pr.q));
      if (pr.visual) { const c = document.createElement('canvas'); c.width = 520; c.height = 90; c.className = 'chestvis'; const g = c.getContext('2d'); g.scale(1, 1); LZ.Game._drawVisual(g, pr.visual, 260, 45); box.appendChild(c); }
      box.appendChild(h('div.row.answers', null, pr.choices.map(ch => h('button.btn.mid.ans', { onclick: () => answer(ch) }, ch))));
      box.appendChild(h('button.btn.small.ghost', { onclick: () => { m.close(); G.wl.modal = false; LZ.In.reset(); } }, 'Później'));
      LZ.Speech.say(pr.q);
    }
    function answer(ch) {
      const ok = String(ch) === String(pr.a);
      S.recordAnswer(p, pr.topic, ok);
      if (!ok) { A.play('wrong'); first = false; pr = M.question(p.skill, band); box.insertBefore(h('p.wrongmsg', null, 'Prawie! Spróbuj tego:'), box.firstChild); setTimeout(show, 700); return; }
      A.play('correct');
      const loot = rollLoot(p, e.tier, first);
      const ws = p.world; ws.chests[e.id] = 1; ws.chestCount = (ws.chestCount || 0) + 1;
      e.opened = true;
      loot.forEach(l => { if (l.kind === 'coins') { p.coins += l.n; p.stats.totalCoins += l.n; } });
      const badges = checkBadges(G);
      S.save();
      LZ.Game._confetti(e.x + 22, e.y - 40, 30);
      box.innerHTML = '';
      box.appendChild(h('div.loot', null, loot.map(l => h('div.lootrow', null,
        l.kind === 'coins' ? [h('span.coin-ico'), ' +' + l.n + ' monet'] :
        l.kind === 'furn' ? ['🛋 ', h('b', null, l.name), ' - do domku!'] :
        l.kind === 'char' ? ['🐾 Nowa przyjaciółka: ', h('b', null, 'Kret Grzebuś'), '! Czeka w garderobie.'] :
        l.kind === 'plan' ? ['📜 ', h('b', null, l.name), ' - możesz rozbudować domek!'] :
        l.kind === 'bag' ? [LZ.Bag.icon(l.id, 28), ' ', h('b', null, LZ.Bag.name(l.id, l.n)), ' - do plecaka!'] :
        ['⭐ Naklejka: ', h('b', null, l.name)]))));
      if (!first) box.appendChild(h('p.note', null, 'Monety są za dobrą odpowiedź od razu, ale skarb jest twój!'));
      if (badges.length) box.appendChild(h('p', null, ['Nowe odznaki: ', h('b', null, badges.map(b => b.name).join(', '))]));
      box.appendChild(h('button.btn.mid.primary', { onclick: () => { m.close(); G.wl.modal = false; LZ.In.reset(); } }, 'Super!'));
    }
    show();
  }

  /* ================= flags and travel ================= */
  function activateFlag(G, e) {
    e.on = true; const ws = G.prof.world;
    ws.flags[e.id] = { x: e.wx, y: e.wy - 1, name: e.name };
    G.hearts = G.maxHearts;
    G.wl.lastFlag = { x: e.wx, y: e.wy - 1 };
    A.play('checkpoint'); LZ.Game._toast('Nowa flaga: ' + e.name, 2); LZ.Game._confetti(e.x, e.y - 90, 15);
    checkBadges(G); S.save();
  }
  function travelMenu() {
    const p = S.active(); const ws = worldSave(p);
    const h = LZ.UI._h;
    const flags = Object.values(ws.flags).sort((a, b) => a.x - b.x);
    const go = to => { m.close(); const G = LZ.Game._dbg(); if (G && G.kind === 'world') { placeWindow(G, to.x, to.y); G.wl.lastFlag = to; G.wl.band = null; bandToast(G); } else { LZ.Game.quit(); LZ.UI.play(0, 0, { kind: 'world', at: to }); } };
    const m = LZ.UI._modal([
      h('h2', null, 'Dokąd skaczemy?'),
      flags.length ? null : h('p', null, 'Nie masz jeszcze flag. Idź na wyprawę i dotknij flagi po drodze!'),
      h('div.flaglist', null, [h('button.btn.mid.green', { onclick: () => go({ x: 3, y: gen(p).surf(3) - 1 }) }, '🏠 Przed domkiem')].concat(flags.map(f => h('button.btn.mid', { onclick: () => go(f) }, [(f.x < 0 ? '← ' : '→ ') + f.name, h('span.flagdist', null, ' ' + Math.abs(f.x) + ' m')])))),
      h('button.btn.small.ghost', { onclick: () => m.close() }, 'Zostaję tutaj'),
    ]);
    const G = LZ.Game._dbg(); if (G && G.wl) { G.wl.modal = true; m.box.parentNode.addEventListener('click', () => {}, { once: true }); }
    const obs = new MutationObserver(() => { if (!m.box.isConnected) { const g2 = LZ.Game._dbg(); if (g2 && g2.wl) g2.wl.modal = false; if (g2 && g2.home) g2.home.standMap = 0; obs.disconnect(); } });
    obs.observe(document.body, { childList: true, subtree: true });
  }
  function goHome() { LZ.Game.quit(); LZ.UI.play(0, 0, { kind: 'home' }); }

  /* ================= neighbours ================= */
  function activeQuest(ws) { for (const b in ws.quests) { const q = ws.quests[b]; if (q.state === 'asked') return q; } return null; }
  function talkNpc(G, e) {
    const ws = G.prof.world, npc = NPCS[e.biome], it = ITEMS[npc.item], h = LZ.UI._h;
    const q = ws.quests[e.band];
    G.wl.modal = true; LZ.In.reset();
    const close = () => { m.close(); G.wl.modal = false; LZ.In.reset(); };
    const box = h('div');
    const m = LZ.UI._modal([h('div.npchead', null, [LZ.UI._preview({ id: npc.char, variant: npc.v }, 80), h('h2', null, npc.name)]), box], { dismiss: false });
    LZ.Ext.each('world', 'npc', G, e, m);   // e.g. giving her a cake (kitchen.js)
    if (q && q.state === 'done') {
      box.appendChild(h('p', null, 'Dziękuję jeszcze raz! Mój prezent dobrze ci służy?'));
      box.appendChild(h('button.btn.mid.primary', { onclick: close }, 'Pa pa!'));
      return;
    }
    if (q && q.state === 'asked') {
      const have = ws.items[npc.item] || 0;
      if (have >= q.need) {
        ws.items[npc.item] = have - q.need; q.state = 'done'; ws.questCount = (ws.questCount || 0) + 1;
        const home = LZ.Home.homeOf(G.prof); home.inv[npc.reward] = (home.inv[npc.reward] || 0) + 1;
        G.prof.coins += 20; G.prof.stats.totalCoins += 20;
        const badges = checkBadges(G); S.save(); A.play('win'); LZ.Game._confetti(e.x, e.y - 60, 40);
        box.appendChild(h('p', null, ['Hurra, ' + q.need + ' ' + it.many + '! Proszę, to dla ciebie: ', h('b', null, LZ.Home.FURN_BY[npc.reward].name), ' do twojego domku i ', h('span.coin-ico'), ' 20.']));
        if (badges.length) box.appendChild(h('p', null, ['Nowe odznaki: ', h('b', null, badges.map(b => b.name).join(', '))]));
        box.appendChild(h('button.btn.mid.primary', { onclick: close }, 'Dziękuję!'));
      } else {
        box.appendChild(h('p', null, 'Masz ' + have + ' z ' + q.need + '. Brakuje jeszcze ' + (q.need - have) + '. Szukaj ich tutaj, na ziemi i w jaskiniach!'));
        box.appendChild(h('button.btn.mid.primary', { onclick: close }, 'Już szukam!'));
      }
      return;
    }
    if (activeQuest(ws)) {
      box.appendChild(h('p', null, 'Cześć! Widzę, że pomagasz już komuś innemu. Wróć do mnie potem!'));
      box.appendChild(h('button.btn.mid.primary', { onclick: close }, 'Dobrze!'));
      return;
    }
    // a new task with a little subtraction: "I have a, I need b - how many are missing?"
    const need = 5 + Math.floor(Math.random() * 6), have = 1 + Math.floor(Math.random() * 6), total = have + need;
    const choices = M.numChoices(need, [total, need + 2]);
    const ask = () => {
      box.innerHTML = '';
      box.appendChild(h('p', null, 'Cześć! Zbieram ' + it.acc + '. Mam już ' + have + ', a potrzebuję ' + total + '. Ile mi brakuje?'));
      box.appendChild(h('div.row.answers', null, choices.map(ch => h('button.btn.mid.ans', { onclick: () => {
        const ok = +ch === need; S.recordAnswer(G.prof, 'sub', ok);
        if (!ok) { A.play('wrong'); box.insertBefore(h('p.wrongmsg', null, 'Hmm, policz jeszcze raz: ' + total + ' - ' + have + ' = ?'), box.firstChild); return; }
        A.play('correct');
        ws.quests[e.band] = { state: 'asked', need, item: npc.item, npc: npc.name };
        S.save();
        box.innerHTML = '';
        box.appendChild(h('p', null, 'Tak! Przynieś mi ' + need + ' ' + it.many + ', a dostaniesz coś fajnego do domku.'));
        box.appendChild(h('button.btn.mid.primary', { onclick: close }, 'Zrobione, idę szukać!'));
      } }, ch))));
      box.appendChild(h('button.btn.small.ghost', { onclick: close }, 'Nie teraz'));
    };
    ask();
  }

  /* ================= landmarks ================= */
  function discoverLandmark(G, e) {
    const ws = G.prof.world; ws.landmarks[e.band] = e.biome;
    const lm = LANDMARKS[e.biome];
    let msg = 'Odkrycie: ' + lm.name + '!';
    if (!ws.plans.includes('plan3')) { ws.plans.push('plan3'); msg += ' Znalazłaś plan Wielkiego salonu!'; }
    A.play('star'); LZ.Game._toast(msg, 3.2); LZ.Game._confetti(e.x, e.y - 200, 50);
    checkBadges(G); S.save();
  }

  /* ================= badges ================= */
  function checkBadges(G) {
    const got = S.checkBadges(G.prof);
    if (got.length) setTimeout(() => LZ.Game._toast('Nowa odznaka: ' + got.map(b => b.name).join(', '), 2.6), 400);
    return got;
  }

  /* ================= drawing ================= */
  function drawChest(g, e, t) {
    const x = e.x, y = e.y, w = 44, h = 34;
    const col = { 1: ['#b8743a', '#6b3a18', '#c98a4a'], 2: ['#b8c0d0', '#5a6388', '#d9e2f0'], 3: ['#ffd23f', '#b8861c', '#ffe680'] }[e.tier];
    U.rr(g, x + 2, y - h + 10, w, h - 10, 5); Art.fs(g, col[0], col[1], 2.5);
    g.fillStyle = e.tier === 3 ? '#ff5e7e' : '#ffd23f'; g.fillRect(x + 2, y - h + 18, w, 4); g.fillRect(x + w / 2 - 1, y - h + 10, 6, h - 10);
    g.save(); g.translate(x + 2, y - h + 12); g.rotate(-e.open * 1.2);
    U.rr(g, 0, -14, w, 16, 7); Art.fs(g, col[2], col[1], 2.5); g.restore();
    if (!e.opened) { const a = 0.5 + 0.5 * Math.sin(t * 3); g.globalAlpha = a; Art.starPath(g, x + w / 2 + 2, y - h - 14, 7, 3, 5, t); Art.fs(g, '#fff6c9'); g.globalAlpha = 1; }
  }
  function drawFlag(g, e, t) {
    g.fillStyle = '#9aa3b5'; g.fillRect(e.x - 3, e.y - 110, 6, 110);
    Art.ell(g, e.x, e.y - 112, 7, 7); Art.fs(g, '#ffd23f', '#c99a12', 2);
    const fy = e.y - 100 + (1 - e.anim) * 70;
    g.beginPath(); g.moveTo(e.x + 3, fy); g.quadraticCurveTo(e.x + 25, fy + 6 + Math.sin(t * 5) * 4, e.x + 42, fy + 14); g.lineTo(e.x + 3, fy + 28); g.closePath();
    Art.fs(g, e.on ? '#7be08a' : '#ff85b0', e.on ? '#3a9a4a' : '#c4557f', 2);
  }
  function drawSign(g, e) {
    g.fillStyle = '#8a5a32'; g.fillRect(e.x - 3, e.y - 56, 6, 56);
    const label = (e.dir < 0 ? '← ' : '') + e.text + (e.dir > 0 ? ' →' : '');
    g.font = '800 16px "Baloo 2", sans-serif'; const bw = g.measureText(label).width + 20;
    U.rr(g, e.x - bw / 2, e.y - 70, bw, 26, 6); Art.fs(g, '#fff6c9', '#8a5a32', 2);
    g.fillStyle = '#5a3a8a'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(label, e.x, e.y - 56);
  }
  function drawItem(g, item, x, y, t, sc) {
    g.save(); g.translate(x, y); if (sc) g.scale(sc, sc);
    switch (item) {
      case 'snow': g.strokeStyle = '#bfe8ff'; g.lineWidth = 3; g.lineCap = 'round'; for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3 + t * 0.5; g.beginPath(); g.moveTo(Math.cos(a) * 11, Math.sin(a) * 11); g.lineTo(-Math.cos(a) * 11, -Math.sin(a) * 11); g.stroke(); } Art.ell(g, 0, 0, 3, 3); Art.fs(g, '#fff'); break;
      case 'shroom': U.rr(g, -3, -2, 6, 10, 2); Art.fs(g, '#fff3e0', '#8a6a50', 1.2); g.beginPath(); g.ellipse(0, -2, 11, 9, 0, Math.PI, 0); g.closePath(); Art.fs(g, '#ff6b8a', '#a3334f', 1.5); Art.ell(g, -4, -6, 2, 2); Art.fs(g, '#fff'); break;
      case 'flower': for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; Art.ell(g, Math.cos(a) * 6, Math.sin(a) * 6, 5, 5); Art.fs(g, '#ff85c8'); } Art.ell(g, 0, 0, 4, 4); Art.fs(g, '#ffe066'); break;
      case 'shell': g.beginPath(); g.moveTo(0, 8); for (let i = 0; i <= 6; i++) { const a = Math.PI + i * Math.PI / 6; g.lineTo(Math.cos(a) * 12, 4 + Math.sin(a) * 14); } g.closePath(); Art.fs(g, '#ffb3c7', '#d9458a', 1.5); break;
      case 'lava': Art.ell(g, 0, 0, 10, 8); Art.fs(g, '#5a3a2a', '#2a1a10', 1.5); Art.ell(g, -2, -2, 5, 3); Art.fs(g, '#ff8a3d'); break;
      case 'gear': Art.drawGear(g, 0, 0, 11, t, '#b8c0d0'); break;
      case 'moon': Art.starPath(g, 0, 0, 11, 5, 5, t * 0.5); Art.fs(g, '#fff6c9', '#c9b060', 1.5); break;
    }
    g.restore();
  }
  function drawNpc(g, e, t, G) {
    const npc = NPCS[e.biome], ws = G.prof.world, q = ws.quests[e.band];
    Art.drawCharacter(g, e.x, e.y + 1, { id: npc.char, variant: npc.v, facing: G.player.x < e.x ? -1 : 1, t: t + e.band, state: 'idle', scale: 1.1 });
    const mark = !q ? '!' : q.state === 'asked' ? ((ws.items[npc.item] || 0) >= q.need ? '★' : '…') : '♥';
    const by = e.y - 86 + Math.sin(e.bob * 3) * 4;
    Art.ell(g, e.x, by, 16, 16); Art.fs(g, '#fff', '#7a5ce6', 2.5);
    g.fillStyle = mark === '♥' ? '#ff5e7e' : '#7a5ce6'; g.font = '800 22px "Baloo 2", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(mark, e.x, by + 1);
    g.fillStyle = 'rgba(58,36,110,0.75)'; U.rr(g, e.x - 60, e.y + 6, 120, 20, 8); g.fill();
    g.fillStyle = '#fff'; g.font = '700 13px "Baloo 2", sans-serif'; g.fillText(npc.name, e.x, e.y + 16);
  }
  function drawLandmark(g, e, t, G) {
    const lm = LANDMARKS[e.biome];
    // stone pedestal with a name plate, and the giant statue on top
    U.rr(g, e.x - 110, e.y - 60, 220, 60, 10); Art.fs(g, '#d9d2e8', '#8a82a0', 3);
    U.rr(g, e.x - 90, e.y - 44, 180, 26, 6); Art.fs(g, '#fff6c9', '#b8861c', 2);
    g.fillStyle = '#5a3a8a'; g.font = '800 15px "Baloo 2", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(lm.name, e.x, e.y - 31);
    g.save(); g.translate(e.x, e.y - 60); g.scale(1.6, 1.6);
    Art.drawBoss(g, { kind: lm.boss, x: -55, y: -150, w: 110, h: 150, dir: -1, flash: 0, phase: 'intro', look: 0 }, t);
    g.restore();
    if (G.prof.world.landmarks[e.band]) { Art.starPath(g, e.x + 96, e.y - 300 + Math.sin(t * 2) * 6, 14, 6, 5, t); Art.fs(g, '#ffd23f', '#b8861c', 2); }
  }
  function drawHouse(g, e, t, G) {
    // her house from outside: the door in the middle takes her in
    const x = e.x, y = e.y, w = 9 * T;
    U.rr(g, x - w / 2, y - 4 * T, w, 4 * T, 8); Art.fs(g, '#fff1d6', '#c98a5a', 3);
    g.beginPath(); g.moveTo(x - w / 2 - 30, y - 4 * T + 6); g.lineTo(x, y - 7 * T); g.lineTo(x + w / 2 + 30, y - 4 * T + 6); g.closePath(); Art.fs(g, '#ff6f91', '#b8234f', 3);
    g.fillStyle = '#b8834a'; g.fillRect(x + w / 4, y - 6.6 * T, 30, 70);
    for (let i = 0; i < 3; i++) { const k = (t * 0.4 + i / 3) % 1; Art.ell(g, x + w / 4 + 15 + k * 20, y - 6.8 * T - k * 90, 12 + k * 10, 9 + k * 8); Art.fs(g, 'rgba(255,255,255,' + (0.7 - k * 0.7) + ')'); }
    for (const wx of [x - w / 2 + 50, x + w / 2 - 110]) { U.rr(g, wx, y - 3.2 * T, 60, 56, 6); Art.fs(g, '#bfe8ff', '#fff', 5); g.fillStyle = 'rgba(255,240,170,0.6)'; g.fillRect(wx + 6, y - 3.2 * T + 6, 48, 44); }
    U.rr(g, x - 26, y - 2.4 * T, 52, 2.4 * T, 12); Art.fs(g, '#8a5a32', '#5c3a1c', 2.5);
    Art.ell(g, x + 14, y - 1.2 * T, 4, 4); Art.fs(g, '#ffd23f');
    if (G.wl && G.wl.standHouse > 0) { g.fillStyle = 'rgba(255,245,200,' + Math.min(0.6, G.wl.standHouse) + ')'; U.rr(g, x - 26, y - 2.4 * T, 52, 2.4 * T, 12); g.fill(); }
    g.fillStyle = '#7a5ce6'; g.font = '800 18px "Baloo 2", sans-serif'; g.textAlign = 'center'; g.fillText('DOM ' + (G.prof.name || '').toUpperCase(), x, y - 4.3 * T);
  }

  LZ.World = { _place: (G, x, y) => placeWindow(G, x, y), gen: () => W, drawItem, checkBadges, activeQuest, WALKERS, FLYERS, CAVE_WORLD, DEEP_WORLD, hooks, buildLevel, travelMenu, goHome, makeWorld, BIOMES, NPCS, ITEMS, LANDMARKS, worldSave, _gen: gen, CH, SKY, TUNNELS };
})();
