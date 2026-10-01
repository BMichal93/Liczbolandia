/*
 * tower.js - the towers: climb floor by floor while something rises below.
 *
 * Two kinds:
 *   Wieża dnia  - 100 floors, built fresh each day from the date (both
 *                 sisters get the same one, so the record is a fair race).
 *                 One life: when the hearts run out the run ends and the
 *                 floor reached is the score.
 *   themed towers - six fixed towers, each its own level with its own look,
 *                 creatures and tricks (candy, ice, mushrooms, storm,
 *                 volcano, space). The layout stays the same every try, so
 *                 she can learn it. Losing all hearts sends her back to the
 *                 last opened maths ceiling (a setback, not game over).
 *                 Stars: half way, the top, the top without running out of
 *                 hearts. Reaching the top opens the next tower.
 *
 * Floors are planks three rows apart, zig-zagging left and right; higher up
 * they get shorter, some are solid blocks (go round them), moving
 * platforms and vanishing clouds. Trampolines (small: two floors, big:
 * three) and balloon creatures (pop one: two floors up) are the quick way
 * up; ghosts, sparks and bats float in the way. Every tenth floor is a
 * closed ceiling with three answer blocks: bump the right one with your
 * head and it opens.
 *
 * Save data: fun.towers { id: { best, top, stars } }, fun.towerBest (the
 * best floor in any tower, for badges), fun.towerDay { key, bonus } (floor
 * coins given today, capped), fun.cnt.towerFloors (for the quest board),
 * fun.towerRuns, fun.towerSummit (daily tower tops).
 */
(function () {
  const U = LZ.U, S = LZ.S, A = LZ.A, Art = LZ.Art, Fun = LZ.Fun;
  const T = LZ.T, PW = 28, PH = 40;
  const GAP = 3, W = 22, TOP = 6;
  const DAY_CAP = 40;   // floor bonus coins per day: the towers are a challenge, not a coin farm

  /*
   * The towers. Numbers are chances per floor (scaled up as she climbs):
   *   len/shrink  - platform length at the bottom and how much it shrinks by the top
   *   solid/moving/cloud and their "from" floors - the tricky platforms
   *   tramp/big   - trampolines and how many of them are the big three-floor ones
   *   walk/fly    - creatures on the planks and floating in between
   *   wind        - updraft columns that lift her (storm tower)
   *   speed/accel - how fast the liquid rises (rows per second) and how much faster per floor
   */
  const TOWERS = [
    { id: 'daily', name: 'Wieża dnia', icon: '🗼', floors: 100, daily: true, liquid: 'choco',
      len: 6.5, shrink: 4.5, solid: 0.2, solidFrom: 18, solids: ['=', 'I', '>', '<'], moving: 0.18, movingFrom: 25, cloud: 0.15, cloudFrom: 35,
      tramp: 0.2, big: 0.4, walk: ['slime', 'slime', 'robot'], walkP: 0.35, walkFrom: 8, fly: ['bat', 'balloon', 'ghost', 'wisp'], flyP: 0.25, flyFrom: 12,
      speed: 0.45, accel: 0.008, maxSpeed: 1.05, wispCol: '#ffb347',
      wall: ['#8a7aa8', '#4a3a78'], line: ['#6a5a88', '#2f2458'], sky: 'day',
      pal: { block: '#c9b8e8', blockDark: '#7a64b0', plank: '#ffcf70', grass: '#b8a0e8', grassDark: '#8a70c0', dirt: '#8a7aa8', dirtDark: '#5a4a78' } },
    { id: 'candy', name: 'Cukierkowa Wieża', icon: '🍭', floors: 25, liquid: 'choco',
      len: 7.5, shrink: 2, solid: 0, solidFrom: 99, solids: ['='], moving: 0, movingFrom: 99, cloud: 0, cloudFrom: 99,
      tramp: 0.45, big: 0.25, walk: ['slime'], walkP: 0.25, walkFrom: 5, fly: ['balloon', 'balloon', 'bee'], flyP: 0.35, flyFrom: 3,
      speed: 0.3, accel: 0.004, maxSpeed: 0.45, wispCol: '#ff85c8',
      wall: ['#f7c8e0', '#e8a0c8'], line: ['#e0a0c4', '#c878a8'], sky: 'day',
      pal: { block: '#fff1c7', blockDark: '#d9a64a', plank: '#4cc9b8', grass: '#ffb3d9', grassDark: '#e07ab0', dirt: '#f3c8a0', dirtDark: '#c9906a' } },
    { id: 'ice', name: 'Lodowa Wieża', icon: '❄️', floors: 40, liquid: 'water',
      len: 6.5, shrink: 2.5, solid: 0.22, solidFrom: 6, solids: ['I'], moving: 0.08, movingFrom: 20, cloud: 0, cloudFrom: 99,
      tramp: 0.28, big: 0.3, walk: ['snowball', 'slime'], walkP: 0.3, walkFrom: 6, fly: ['ghost', 'ghost', 'balloon'], flyP: 0.3, flyFrom: 5,
      speed: 0.35, accel: 0.006, maxSpeed: 0.6, wispCol: '#9de8ff',
      wall: ['#c8e4f4', '#7ab0d8'], line: ['#9cc8e4', '#5a90b8'], sky: 'snow',
      pal: { block: '#e6f6ff', blockDark: '#7ab0d8', plank: '#c8955a', grass: '#ffffff', grassDark: '#bfe0f4', dirt: '#9cc8e4', dirtDark: '#5a90b8' } },
    { id: 'mush', name: 'Grzybowa Wieża', icon: '🍄', floors: 40, liquid: 'slime',
      len: 6, shrink: 2.5, solid: 0.12, solidFrom: 12, solids: ['='], moving: 0.08, movingFrom: 15, cloud: 0, cloudFrom: 99,
      tramp: 0.14, mush: 0.22, big: 0.3, walk: ['shroom', 'slime'], walkP: 0.35, walkFrom: 4, fly: ['bat', 'bee', 'balloon', 'wisp'], flyP: 0.32, flyFrom: 6,
      speed: 0.38, accel: 0.007, maxSpeed: 0.7, wispCol: '#c6ff6a',
      wall: ['#a8c890', '#5a7a4a'], line: ['#88a870', '#3a5a2a'], sky: 'forest',
      pal: { block: '#e8d0a8', blockDark: '#8a6a4a', plank: '#ffb347', grass: '#8fe36b', grassDark: '#5aa83a', dirt: '#a0784a', dirtDark: '#6a4a2a' } },
    { id: 'storm', name: 'Wieża Burzy', icon: '⛈️', floors: 50, liquid: 'fog',
      len: 6, shrink: 3, solid: 0.12, solidFrom: 15, solids: ['='], moving: 0.22, movingFrom: 6, cloud: 0.25, cloudFrom: 4,
      tramp: 0.22, big: 0.4, wind: 0.14, walk: ['slime'], walkP: 0.2, walkFrom: 8, fly: ['ghost', 'wisp', 'balloon', 'bat'], flyP: 0.38, flyFrom: 4,
      speed: 0.42, accel: 0.008, maxSpeed: 0.85, wispCol: '#ffe066',
      wall: ['#9aa0b8', '#4a4e68'], line: ['#7a80a0', '#30344a'], sky: 'storm',
      pal: { block: '#d0d4e8', blockDark: '#6a7090', plank: '#e8d8a8', grass: '#c8d0e8', grassDark: '#8a90b0', dirt: '#8a90a8', dirtDark: '#5a6078' } },
    { id: 'volcano', name: 'Wulkaniczna Wieża', icon: '🌋', floors: 60, liquid: 'lava',
      len: 5.5, shrink: 2.5, solid: 0.25, solidFrom: 6, solids: ['=', '>', '<'], moving: 0.15, movingFrom: 10, cloud: 0.05, cloudFrom: 30,
      tramp: 0.28, big: 0.5, walk: ['hedgehog', 'slime', 'robot'], walkP: 0.4, walkFrom: 4, fly: ['wisp', 'wisp', 'bat', 'balloon'], flyP: 0.35, flyFrom: 4,
      speed: 0.5, accel: 0.009, maxSpeed: 1.0, wispCol: '#ff7a3a',
      wall: ['#8a5a4a', '#3a2020'], line: ['#6a3a2a', '#200c0c'], sky: 'fire',
      pal: { block: '#c88a6a', blockDark: '#6a3a2a', plank: '#ffb347', grass: '#d0805a', grassDark: '#8a4a2a', dirt: '#8a5a4a', dirtDark: '#5a3020' } },
    { id: 'space', name: 'Kosmiczna Wieża', icon: '🚀', floors: 80, liquid: 'stars', lowgrav: true,
      len: 5.5, shrink: 2.5, solid: 0.22, solidFrom: 8, solids: ['=', 'I', '>', '<'], moving: 0.2, movingFrom: 8, cloud: 0.15, cloudFrom: 20,
      tramp: 0.32, big: 0.5, walk: ['alien', 'robot'], walkP: 0.35, walkFrom: 5, fly: ['ufo', 'wisp', 'balloon', 'ghost'], flyP: 0.38, flyFrom: 4,
      speed: 0.55, accel: 0.008, maxSpeed: 1.1, wispCol: '#b08cff',
      wall: ['#3a3a6a', '#141432'], line: ['#2a2a50', '#0a0a20'], sky: 'space',
      pal: { block: '#b8a8ff', blockDark: '#5a4aa8', plank: '#9d7bff', grass: '#c8b8ff', grassDark: '#7a64c0', dirt: '#4a4a7a', dirtDark: '#2a2a50' } },
  ];
  const BY = {}; TOWERS.forEach((c, i) => { c.i = i; BY[c.id] = c; });
  const THEMED = TOWERS.filter(c => !c.daily);
  const LIQUID = {
    choco: { name: 'Czekolada', cols: ['#b0703f', '#7a4526', '#4a2614'], edge: '#d0905a', bub: 'rgba(255,225,190,0.45)', glow: '160,80,40' },
    water: { name: 'Lodowata woda', cols: ['#7fd0ff', '#3a8ad0', '#1a4a8a'], edge: '#d8f2ff', bub: 'rgba(255,255,255,0.6)', glow: '60,140,220' },
    slime: { name: 'Zielona galaretka', cols: ['#8fe36b', '#4aa83a', '#2a6a2a'], edge: '#c6ff9a', bub: 'rgba(230,255,200,0.55)', glow: '80,170,60' },
    fog: { name: 'Burzowa chmura', cols: ['#9a9ab8', '#5a5a78', '#2a2a40'], edge: '#d8d8f0', bub: 'rgba(255,240,150,0.7)', glow: '90,90,130' },
    lava: { name: 'Lawa', cols: ['#ffb347', '#ff5a2a', '#8a1a0a'], edge: '#ffe066', bub: 'rgba(255,240,180,0.6)', glow: '255,90,30' },
    stars: { name: 'Kosmiczny pył', cols: ['#b08cff', '#5a3aa8', '#1a1040'], edge: '#e8dcff', bub: 'rgba(255,255,255,0.8)', glow: '150,110,255' },
  };
  const worlds = {};
  function worldOf(c) {
    if (worlds[c.id]) return worlds[c.id];
    // each tower is a "world" of its own for the tile art (getTile caches by id)
    return (worlds[c.id] = { id: 60 + c.i, name: c.name, features: c.lowgrav ? ['lowgrav'] : [], enemies: [], music: 97 + c.i * 6,
      pal: Object.assign({ skyTop: '#2a1f4a', skyBot: '#5a3f8a', far: '#3a2f5a', mid: '#4a3a6a', accent: '#ff6fae' }, c.pal) });
  }

  /* ---------------- save data ---------------- */
  function saves(p) {
    const f = Fun.state(p);
    f.towers = f.towers || {};
    // the first tower version kept only the daily record
    if (f.towerBest && !f.towers.daily) f.towers.daily = { best: f.towerBest, top: !!f.towerSummit, stars: 0 };
    TOWERS.forEach(c => { f.towers[c.id] = f.towers[c.id] || { best: 0, top: false, stars: 0 }; });
    return f.towers;
  }
  const unlocked = (p, c) => c.daily || c.i === 1 || !!saves(p)[TOWERS[c.i - 1].id].top;

  /* ---------------- building a tower ---------------- */
  function buildLevel(p, mode) {
    const c = BY[(mode && mode.tower) || 'daily'] || BY.daily;
    const F = c.floors, GROUND = TOP + F * GAP, H = GROUND + 1;
    const rowOf = f => GROUND - f * GAP;
    const seed = c.daily ? Number(LZ.X.dateKey().replace(/-/g, '')) : 7700 + c.i * 131;
    const r = U.rng(seed * 13 + 5);
    const cols = [];
    for (let x = 0; x < W; x++) {
      const col = new Array(H).fill('.');
      for (let y = 0; y < H; y++) if (x === 0 || x === W - 1 || y === 0) col[y] = '=';
      col[GROUND] = '#';
      cols.push(col);
    }
    const ents = [];
    const put = (x0, x1, y, ch) => { for (let x = Math.max(1, x0); x <= Math.min(W - 2, x1); x++) cols[x][y] = ch; };
    const barriers = [];
    let prev = { x0: 1, x1: W - 2, full: true }, tricky = 0;
    for (let f = 1; f <= F; f++) {
      const y = rowOf(f), d = f / F, up = 0.5 + d;   // up: chances grow from half to one and a half towards the top
      if (f === F) {
        // the top: a whole floor (planks, so she can jump up through it) and the trophy
        put(1, W - 2, y, '-');
        ents.push({ t: 'tsummit', x: W / 2, y });
        break;
      }
      if (f % 10 === 0) {
        // the maths ceiling; the answer blocks are cut into it when she gets close
        put(1, W - 2, y, '=');
        const off = U.ri(r, 0, 1);
        barriers.push({ f, y, cols: [3 + off, 10 + off, 17 - off], gate: null, open: false });
        prev = { x0: 1, x1: W - 2, full: true };
        ents.push({ t: 'theart', x: U.ri(r, 4, W - 5), y: y - 1 });   // a heart waits just above every ceiling
        continue;
      }
      if (f % 10 === 9) {
        // under a ceiling: a full floor, so every answer block can be reached
        put(1, W - 2, y, '-');
        prev = { x0: 1, x1: W - 2, full: true };
        if (r() < 0.7) for (let k = 0; k < 3; k++) ents.push({ t: 'coin', x: U.ri(r, 2, W - 3), y: y - 1 });
        continue;
      }
      // a normal floor: one main platform reachable from the one below
      const len = U.clamp(Math.round(c.len - d * c.shrink + (r() - 0.5) * 2), 3, 8);
      const kindRoll = r();
      const pS = f >= c.solidFrom ? c.solid * up : 0, pM = f >= c.movingFrom ? c.moving * up : 0, pC = f >= c.cloudFrom ? c.cloud * up : 0;
      // never more than two moving or vanishing platforms in a row: there has to be somewhere to stand still
      const solid = kindRoll < pS;
      const moving = !solid && tricky < 2 && kindRoll < pS + pM;
      const cloud = !solid && !moving && tricky < 2 && kindRoll < pS + pM + pC;
      tricky = moving || cloud ? tricky + 1 : 0;
      const maxGap = f < 15 && !c.lowgrav ? 1 : 2, maxOver = prev.full || f < 4 ? 99 : 2;
      const cand = [];
      for (let x0 = 1; x0 + len - 1 <= W - 2; x0++) {
        const x1 = x0 + len - 1;
        const over = Math.min(x1, prev.x1) - Math.max(x0, prev.x0) + 1;
        const dist = Math.max(0, x0 - prev.x1 - 1, prev.x0 - x1 - 1);
        // a solid block can't be jumped through: it must stand beside the floor below, not over it
        if (solid ? (over > 0 || prev.full || dist < 1 || dist > 2) : (dist > maxGap || over > maxOver)) continue;
        cand.push(x0);
      }
      let x0 = cand.length ? cand[Math.floor(r() * cand.length)] : U.clamp(prev.x0, 1, W - 1 - len);
      let x1 = x0 + len - 1;
      const isSolid = solid && cand.length;
      let plankMain = false;
      if (moving) {
        // a moving platform: starts over the floor below, rides to the other side
        const w = 3, a = U.clamp(prev.full ? x0 : Math.round((prev.x0 + prev.x1) / 2) - 1, 1, W - 1 - w);
        const b = a < W / 2 ? U.clamp(a + U.ri(r, 5, 9), 1, W - 1 - w) : U.clamp(a - U.ri(r, 5, 9), 1, W - 1 - w);
        ents.push({ t: 'moving', x: a, y, w, x2: b, y2: y });
        x0 = Math.min(a, b); x1 = Math.max(a, b) + w - 1;
        prev = { x0: Math.min(a, b) + 1, x1: Math.max(a, b) + w - 2 };   // what she can count on being under her
      } else if (cloud) {
        ents.push({ t: 'cloud', x: x0, y, w: len });
        prev = { x0, x1 };
      } else {
        const ch = isSolid ? U.pick(r, c.solids) : '-';
        put(x0, x1, y, ch);
        prev = { x0, x1 };
        plankMain = !isSolid;
        // creatures, trampolines and mushrooms only on real ground
        // a trampoline at one end of the plank, a walker (if any) in the middle
        let tramped = false;
        if (plankMain && len >= 4 && f % 10 < 7 && r() < c.tramp * (1.5 - d * 0.5)) {
          ents.push({ t: 'ttramp', x: r() < 0.5 ? x0 : x1 - 1, y, big: r() < c.big });
          tramped = true;
        }
        if (f >= c.walkFrom && len >= 6 - (tramped ? 0 : 1) && r() < c.walkP * up) ents.push({ t: 'enemy', type: U.pick(r, c.walk), x: x0 + Math.floor(len / 2), y });
        else if (!tramped && c.mush && plankMain && len >= 3 && f % 10 < 8 && r() < c.mush) ents.push({ t: 'mushroom', x: U.ri(r, x0, x1), y });
      }
      if (r() < 0.55) { const n = U.ri(r, 1, Math.min(3, x1 - x0 + 1)); for (let k = 0; k < n; k++) ents.push({ t: 'coin', x: x0 + k, y: y - 1 }); }
      // a short spare plank somewhere else, sometimes with a coin on it
      if (r() < 0.45) {
        const el = U.ri(r, 2, 3), ex = r() < 0.5 ? U.ri(r, 1, Math.max(1, x0 - el - 1)) : U.ri(r, Math.min(W - 2 - el, x1 + 2), W - 1 - el);
        if (ex + el - 1 < x0 - 1 || ex > x1 + 1) { put(ex, ex + el - 1, y, '-'); if (f % 10 < 7 && r() < c.tramp * 0.6) ents.push({ t: 'ttramp', x: ex, y, big: r() < c.big }); else if (r() < 0.5) ents.push({ t: 'coin', x: ex, y: y - 1 }); }
      }
      // floating creatures between this floor and the next
      if (f >= c.flyFrom && f % 10 < 8 && r() < c.flyP * up) {
        const type = U.pick(r, c.fly);
        const fx = type === 'ghost' ? U.ri(r, 5, W - 6) : type === 'wisp' ? U.ri(r, 3, W - 4) : U.ri(r, 2, W - 3);
        ents.push({ t: 'enemy', type, x: fx, y: y - 1, col: type === 'wisp' ? c.wispCol : type === 'balloon' ? U.pick(r, ['#ff6fae', '#5ccfff', '#ffd23f', '#8fe36b', '#b58cff']) : null });
      }
      // a column of rising wind beside the platform (storm tower): ride it up two floors
      if (c.wind && f % 10 < 7 && r() < c.wind) {
        const wx = x0 > W / 2 ? U.clamp(x0 - 3, 1, W - 3) : U.clamp(x1 + 2, 1, W - 3);
        ents.push({ t: 'wind', x: wx, y: y - 7, w: 2, h: 7 });
      }
    }
    // trampolines need a clear way up: none under solid blocks or a closed ceiling
    for (let i = ents.length - 1; i >= 0; i--) {
      const e = ents[i];
      if (e.t !== 'ttramp') continue;
      const clearTo = reach => { for (let yy = e.y - 1; yy >= Math.max(1, e.y - reach); yy--) for (const xx of [e.x, e.x + 1]) if ('#I=><'.includes(cols[xx][yy]) && cols[xx][yy] !== '.') return false; return true; };
      if (e.big && !clearTo(10)) e.big = false;   // not enough room for the big one: a small one will do
      if (!clearTo(7)) { ents.splice(i, 1); continue; }
      // coins up the path she'll fly, to show what it's for
      for (const k of e.big ? [2, 4, 5, 7, 8] : [2, 4, 5]) ents.push({ t: 'coin', x: e.x + (k % 2), y: e.y - k });
    }
    return {
      world: worldOf(c), wi: 52, li: 1, H, W, cols, ents, qc: {}, start: { x: 10, y: GROUND - 1 },
      water: false, boss: null, theme: null, themeName: c.name + (c.daily ? ' - wspinaj się!' : ' - ' + F + ' pięter'), noStars: true, sandbox: 'tower',
      barriers, tower: c, ground: GROUND,
    };
  }

  /* ---------------- engine hooks (G.sb) ---------------- */
  const rowOfG = (G, f) => G.lvl.ground - f * GAP;
  function floorOf(G) {
    const p = G.player, feet = Math.round((p.y + PH) / T);
    return Math.max(0, Math.round((G.lvl.ground - feet) / GAP));
  }
  const hooks = {
    init(G) {
      const c = G.lvl.tower;
      G.hearts = G.maxHearts;
      G.tw = { c, floor: 0, top: 0, lava: (G.lvl.ground + 2) * T, grace: c.daily ? 8 : 6, barriers: G.lvl.barriers.map(b => Object.assign({}, b)), over: false, summit: false, restarts: 0, check: 0 };
      saves(G.prof);
      setTimeout(() => LZ.Game._dbg() === G && LZ.Game._toast(LIQUID[c.liquid].name + ' zaraz zacznie rosnąć - w górę!', 2.6), 2300);
    },
    tick(G, dt) {
      const tw = G.tw, p = G.player, c = tw.c;
      if (tw.over) return;
      if (p.grounded) { tw.floor = floorOf(G); if (tw.floor > tw.top) { tw.top = tw.floor; if (tw.top % 10 === 1 && tw.top > 1) A.play('checkpoint'); } }
      // the next closed ceiling: cut its answer blocks in when she gets close
      const next = tw.barriers.find(b => !b.open);
      if (next && !next.gate && tw.top >= next.f - 2) openQuestion(G, next);
      if (next && next.gate && next.gate.state !== 'closed') passBarrier(G, next);
      // the liquid: a head start, then it rises, faster higher up; it waits
      // under a closed ceiling (answering takes time) and never falls too far behind
      if (tw.grace > 0) tw.grace -= dt;
      else {
        let sp = Math.min(c.maxSpeed, c.speed + tw.top * c.accel) * T;
        if (next && tw.lava < (next.y + 10) * T && tw.top >= next.f - 1) sp = 0.1 * T;
        tw.lava -= sp * dt;
        const feet = p.y + PH;
        if (tw.lava - feet > 15 * T && !(next && tw.top >= next.f - 1)) tw.lava = feet + 15 * T;
      }
      // touching it hurts and throws her up out of it
      if (p.y + PH > tw.lava + 12 && G.state === 'play') {
        LZ.Game._hurt(null, 'lava');
        if (!tw.over && G.state === 'play') { p.vy = -1250 * (G.lowgrav ? 0.74 : 1); p.grounded = false; p.on = null; tw.lava = Math.min((G.lvl.ground + 2) * T, tw.lava + 3 * T); }
      }
      // the trophy at the top
      const sm = G.ents.find(e => e.k === 'tsummit');
      if (sm && !tw.summit && Math.abs(p.x + PW / 2 - sm.x) < 50 && Math.abs(p.y + PH - sm.y) < 60) { tw.summit = true; tw.top = c.floors; endRun(G, true); }
    },
    buildEnt(G, e, px, py) {
      if (e.t === 'tsummit') G.ents.push({ k: 'tsummit', x: px, y: py });
      else if (e.t === 'theart') G.ents.push({ k: 'power', kind: 'heart', x: px + T / 2, y: py + T / 2, vy: 0, born: 0 });
      else if (e.t === 'ttramp') G.ents.push({ k: 'ttramp', x: px, y: py, w: 2 * T, big: !!e.big, comp: 0 });
      else if (e.t === 'enemy') return;   // handled by the engine
    },
    updateEnt(G, e, i, dt) {
      if (e.k !== 'ttramp') return false;
      /*
       * A trampoline on a plank: landing on it, or walking onto it, throws her
       * up two floors (small) or three (big). Launch speeds come from the
       * jump height: v = sqrt(2 g h), with h a little over 6 or 9 rows.
       */
      e.comp = Math.max(0, e.comp - dt * 3);
      const p = G.player, top = e.y - 22, feet = p.y + PH, cx = p.x + PW / 2;
      if (G.state === 'play' && p.vy >= 0 && cx > e.x + 6 && cx < e.x + e.w - 6 && feet >= top - 4 && feet <= e.y + 2 && e.comp < 0.5) {
        p.y = top - PH; p.vy = -(e.big ? 1450 : 1200) * (G.lowgrav ? 0.74 : 1);
        p.grounded = false; p.on = null; p.jumps = 1; p.squash = -0.5; p.padLaunch = true;
        e.comp = 1; A.play('spring');
      }
      return true;
    },
    drawEnt(ctx, e, t, G) {
      if (e.k === 'tsummit') { drawTrophy(ctx, e.x, e.y, t); return true; }
      if (e.k === 'ttramp') { drawTramp(ctx, e, t); return true; }
      return false;
    },
    drawBack(ctx, G, cam, vw, vh, t) {
      const cv = ctx.canvas, c = G.lvl.tower;
      if (cv.__sky !== 'tower' + c.id) { cv.__sky = 'tower' + c.id; cv.style.background = c.line[1]; }
      ctx.clearRect(0, 0, vw, vh);
      ctx.fillStyle = c.line[1]; ctx.fillRect(0, 0, vw, vh);
      ctx.save(); ctx.translate(-cam.x, -cam.y);
      drawWall(ctx, G, cam, vw, vh, t);
      ctx.restore();
    },
    drawFront(ctx, G, x0, x1, y0, y1, t) {
      const tw = G.tw; if (!tw) return;
      drawLiquid(ctx, LIQUID[tw.c.liquid], tw.lava, G.cam.y + 2000, t);
    },
    drawHUD(ctx, G, vw, vh, t, text) {
      const tw = G.tw; if (!tw) return false;
      const c = tw.c, sv = saves(G.prof)[c.id], best = sv.best;
      if (c.daily) {
        text(ctx, c.icon + ' ' + tw.top + '. piętro', vw / 2, 36, 28, '#fff', '#5a3a8a');
        if (!G.banner) text(ctx, 'Rekord: ' + Math.max(best, tw.top) + (tw.top > best && best > 0 ? ' - nowy!' : ''), vw / 2, 64, 18, tw.top > best && best > 0 ? '#ffe680' : '#e8dcff', '#5a3a8a');
      } else {
        text(ctx, c.icon + ' ' + tw.top + ' / ' + c.floors, vw / 2, 36, 28, '#fff', '#5a3a8a');
        if (!G.banner) text(ctx, '★'.repeat(sv.stars) + '☆'.repeat(3 - sv.stars) + (tw.restarts ? '  · powroty: ' + tw.restarts : ''), vw / 2, 64, 18, '#ffe680', '#5a3a8a');
      }
      // how close the liquid is: a glow along the bottom of the screen
      const gap = tw.lava - (G.player.y + PH);
      if (gap < 5 * T && !tw.over) {
        const a = U.clamp(1 - gap / (5 * T), 0, 1) * (0.5 + 0.2 * Math.sin(t * 8)), gc = LIQUID[c.liquid].glow;
        const gr = ctx.createLinearGradient(0, vh - 120, 0, vh); gr.addColorStop(0, 'rgba(' + gc + ',0)'); gr.addColorStop(1, 'rgba(' + gc + ',' + a.toFixed(2) + ')');
        ctx.fillStyle = gr; ctx.fillRect(0, vh - 120, vw, 120);
      }
      return false;   // and the normal hearts / coins
    },
    outOfHearts(G) {
      const tw = G.tw;
      if (tw.c.daily) { endRun(G, false); return true; }
      /*
       * A themed tower is a level: out of hearts means back to the last
       * opened ceiling (or the bottom) with full hearts and the liquid pushed
       * down. The climb above is lost, and the third star with it.
       */
      tw.restarts++;
      const last = tw.barriers.filter(b => b.open).pop();
      const row = last ? last.y : G.lvl.ground;
      const p = G.player;
      G.hearts = G.maxHearts; G.projectiles = [];
      p.x = 10 * T + 10; p.y = row * T - PH - 1; p.vx = 0; p.vy = 0; p.invuln = 2; p.on = null;
      tw.lava = (row + 9) * T; tw.grace = 3;
      tw.top = last ? last.f : 0; tw.floor = tw.top;
      LZ.Game._toast(last ? 'Koniec serduszek! Wracasz na ' + last.f + '. piętro.' : 'Koniec serduszek! Od początku wieży.', 2.4);
      A.play('fall'); G.state = 'respawn'; G.respawnT = 0.8;
      return true;
    },
    onBlock() {},
    quit(G) { if (G.tw && !G.tw.saved) saveRun(G); },
  };

  function openQuestion(G, b) {
    // a gate entity far outside the tower holds the question; the three answer
    // blocks replace bricks of the ceiling, so bumping them is the only way up
    const gate = { k: 'gate', x: -20 * T, y: 0, w: T - 8, h: T, baseH: T, open: 0, state: 'closed', zone: [-1e9, 1e9], blocks: [], problem: null, wrong: 0, first: true };
    b.cols.forEach(cx => {
      G.grid[cx][b.y] = '.';
      const blk = { k: 'ans', x: cx * T, y: b.y * T, w: T, h: T, label: '', correct: false, bad: false, bump: 0, gate, hint: false, active: false };
      gate.blocks.push(blk); G.ents.push(blk);
    });
    G.ents.push(gate);
    b.gate = gate;
  }
  function passBarrier(G, b) {
    b.open = true;
    G.ents = G.ents.filter(e => e !== b.gate && !(e.k === 'ans' && e.gate === b.gate));
    for (let x = 1; x < W - 1; x++) G.grid[x][b.y] = '-';
    LZ.Game._toast('Sufit otwarty! Piętro ' + b.f + '!' + (G.tw.c.daily ? '' : ' Tu wrócisz, gdy zabraknie serduszek.'), 2);
    LZ.Game._confetti(G.player.x, b.y * T, 30);
  }

  function saveRun(G) {
    const tw = G.tw, c = tw.c, p = G.prof, f = Fun.state(p), sv = saves(p)[c.id];
    tw.saved = true;
    const prevBest = sv.best, prevStars = sv.stars, firstTop = tw.summit && !sv.top;
    sv.best = Math.max(sv.best, tw.top);
    if (tw.summit) sv.top = true;
    // stars for the themed towers: half way, the top, the top without running out of hearts
    const stars = c.daily ? 0 : (tw.top >= Math.ceil(c.floors / 2) ? 1 : 0) + (tw.summit ? 1 : 0) + (tw.summit && !tw.restarts ? 1 : 0);
    sv.stars = Math.max(sv.stars, stars);
    f.towerBest = Math.max(f.towerBest || 0, tw.top);
    f.towerRuns = (f.towerRuns || 0) + 1;
    f.cnt = f.cnt || {}; f.cnt.towerFloors = (f.cnt.towerFloors || 0) + tw.top;
    // floor coins, capped per day; the first time at the top of a themed tower pays extra
    const key = LZ.X.dateKey();
    if (!f.towerDay || f.towerDay.key !== key) f.towerDay = { key, bonus: 0 };
    let bonus = Math.max(0, Math.min(Math.floor(tw.top / (c.daily ? 2 : 3)), DAY_CAP - f.towerDay.bonus));
    f.towerDay.bonus += bonus;
    const extra = [];
    if (c.daily && tw.summit) { bonus += 30; f.towerSummit = (f.towerSummit || 0) + 1; if (f.towerSummit === 1) { const home = LZ.Home.homeOf(p); home.inv.towertrophy = (home.inv.towertrophy || 0) + 1; extra.push('Puchar szczytu czeka w domku!'); } }
    if (!c.daily && firstTop) { bonus += c.floors; const nx = TOWERS[c.i + 1]; extra.push(nx ? 'Otwarta nowa wieża: ' + nx.icon + ' ' + nx.name + '!' : 'Wszystkie wieże zdobyte!'); }
    if (!c.daily && stars === 3 && prevStars < 3) { LZ.Bag.add(p, 'star', 1); extra.push('Za trzy gwiazdki: gwiezdny odłamek!'); }
    p.coins += bonus; p.stats.totalCoins += bonus;
    S.checkBadges(p); S.save();
    return { prevBest, bonus, stars, extra, firstTop };
  }
  function endRun(G, summit) {
    const tw = G.tw;
    if (tw.over) return;
    tw.over = true;
    G.state = 'over'; G.projectiles = [];
    A.play(summit ? 'win' : 'fall');
    if (summit) LZ.Game._confetti(G.player.x, G.player.y - 200, 60);
    const res = saveRun(G);
    setTimeout(() => showEnd(G, res, summit), summit ? 1800 : 1000);
  }
  function showEnd(G, res, summit) {
    const UI = LZ.UI, h = UI._h, tw = G.tw, c = tw.c, record = tw.top > res.prevBest;
    const nx = !c.daily && summit && TOWERS[c.i + 1];
    const leave = fn => { m.close(); LZ.Game.quit(); fn(); };
    const m = UI._modal([
      h('h2', null, summit ? '🏆 Szczyt: ' + c.name + '!' : c.icon + ' Koniec wspinaczki'),
      h('div.towerres', null, [h('b', null, String(tw.top)), h('small', null, U.plural(tw.top, 'piętro', 'piętra', 'pięter'))]),
      c.daily ? null : h('div.towerstars', null, [0, 1, 2].map(i => h('span' + (i < res.stars ? '.on' : ''), null, '★'))),
      h('p', null, summit ? (c.daily ? 'Cała wieża dnia!' : tw.restarts ? 'Na szczycie! Trzecią gwiazdkę daje wejście bez ani jednego powrotu.' : 'Na szczycie, bez ani jednego powrotu!') : record ? 'Nowy rekord!' + (res.prevBest ? ' Poprzedni: ' + res.prevBest + '.' : '') : 'Rekord: ' + res.prevBest + '. Spróbuj go pobić!'),
      ...res.extra.map(x => h('p', null, h('b', null, x))),
      res.bonus ? h('p', null, ['Monety: ', h('span.coin-ico'), ' ' + res.bonus]) : h('p.note', null, 'Dzisiejsza premia za piętra już zebrana - rekord liczy się dalej!'),
      h('div.row', null, [
        h('button.btn.mid', { onclick: () => leave(() => { document.getElementById('hud').classList.add('hidden'); menu(); }) }, 'Wieże'),
        h('button.btn.mid' + (nx ? '' : '.primary'), { onclick: () => leave(() => UI.play(0, 0, { kind: 'tower', tower: c.id })) }, 'Jeszcze raz'),
        nx ? h('button.btn.mid.primary', { onclick: () => leave(() => UI.play(0, 0, { kind: 'tower', tower: nx.id })) }, nx.icon + ' Dalej') : null,
      ]),
    ], { dismiss: false });
    m.box.parentNode.classList.add('levelend');
  }

  /* ---------------- the towers menu ---------------- */
  function menu() {
    const UI = LZ.UI, h = UI._h, p = S.active(), sv = saves(p);
    if (!document.querySelector('.screen.hub')) UI.hub();
    const card = c => {
      const s = sv[c.id], open = unlocked(p, c);
      const sub = c.daily ? 'Codziennie inna · rekord: ' + s.best : !open ? '🔒 Otworzy się po szczycie: ' + TOWERS[c.i - 1].icon : c.floors + ' pięter · rekord: ' + s.best;
      return h('button.twcard' + (open ? '' : '.lock'), {
        style: 'background:linear-gradient(160deg,' + c.wall[0] + ',' + c.wall[1] + ')',
        onclick: () => { if (!open) { A.play('bump'); return; } m.close(); UI.play(0, 0, { kind: 'tower', tower: c.id }); },
      }, [h('span.ti', null, c.icon), h('b', null, c.name), h('small', null, sub), c.daily ? null : h('span.twst', null, '★'.repeat(s.stars) + '☆'.repeat(3 - s.stars))]);
    };
    const got = THEMED.filter(c => sv[c.id].top).length;
    const m = UI._modal([
      h('h2', null, '🗼 Wieże'),
      h('div.twgrid', null, TOWERS.map(card)),
      h('p.note', null, 'Zdobyte wieże: ' + got + ' z ' + THEMED.length + '. Szczyt otwiera następną. Trampoliny i baloniki wyrzucają wysoko w górę!'),
      h('button.btn.mid', { onclick: () => { m.close(); UI.challenges(); } }, 'Wróć'),
    ]);
    m.box.classList.add('twmodal');
  }
  // a line for the challenges card
  function summary(p) {
    const sv = saves(p), got = THEMED.filter(c => sv[c.id].top).length;
    return 'Zdobyte: ' + got + '/' + THEMED.length + ' · rekord dnia: ' + sv.daily.best;
  }

  /* ---------------- drawing ---------------- */
  // the inside of the tower: bricks, windows to a sky that changes as she climbs, floor numbers
  function drawWall(g, G, cam, vw, vh, t) {
    const c = G.lvl.tower, GROUND = G.lvl.ground, H = G.H;
    const y0 = Math.max(0, Math.floor(cam.y / T) - 1), y1 = Math.min(H, Math.ceil((cam.y + vh) / T) + 1);
    const top = y0 * T, bot = y1 * T, x0 = T, x1 = (W - 1) * T;
    const h01 = U.clamp(1 - (cam.y + vh / 2) / (GROUND * T), 0, 1);   // 0 at the bottom, 1 at the top
    const stone = mix(c.wall[0], c.wall[1], h01), line = mix(c.line[0], c.line[1], h01);
    g.fillStyle = stone; g.fillRect(x0, top, x1 - x0, bot - top);
    g.strokeStyle = line; g.lineWidth = 2;
    g.beginPath();
    for (let y = Math.floor(top / 24) * 24; y < bot; y += 24) {
      g.moveTo(x0, y); g.lineTo(x1, y);
      const off = (y / 24) % 2 ? 0 : 24;
      for (let x = x0 + off; x < x1; x += 48) { g.moveTo(x, y); g.lineTo(x, y + 24); }
    }
    g.stroke();
    // a few themed touches on the wall
    if (c.sky === 'space') for (let i = 0; i < 30; i++) { const sx = x0 + ((i * 397) % (x1 - x0)), sy = top + ((i * 241 + Math.floor(top / 7)) % (bot - top)); Art.ell(g, sx, sy, 1.6, 1.6); g.fillStyle = 'rgba(255,255,255,' + (0.4 + 0.4 * Math.sin(t * 2 + i)).toFixed(2) + ')'; g.fill(); }
    if (c.sky === 'forest') for (let yy = Math.floor(y0 / 4) * 4; yy <= y1; yy += 4) { const vx = ((yy * 7) % 18 + 2) * T; g.strokeStyle = 'rgba(60,120,40,0.5)'; g.lineWidth = 5; g.beginPath(); g.moveTo(vx, yy * T); g.quadraticCurveTo(vx + 20, yy * T + 60, vx, yy * T + 120); g.stroke(); Art.ell(g, vx + 8, yy * T + 50, 9, 5, 0.6); Art.fs(g, 'rgba(110,190,70,0.7)'); }
    if (c.sky === 'snow') for (let i = 0; i < 18; i++) { const sx = x0 + ((i * 331 + t * 30) % (x1 - x0)), sy = top + ((i * 173 + t * 50) % (bot - top)); Art.ell(g, sx, sy, 2.5, 2.5); g.fillStyle = 'rgba(255,255,255,0.7)'; g.fill(); }
    if (c.sky === 'fire') for (let i = 0; i < 14; i++) { const sx = x0 + ((i * 331) % (x1 - x0)), sy = bot - ((i * 173 + t * 60) % (bot - top)); Art.ell(g, sx + Math.sin(t * 2 + i) * 8, sy, 2.5, 2.5); g.fillStyle = 'rgba(255,170,60,0.75)'; g.fill(); }
    // windows every 9 rows, alternating sides
    for (let wy = Math.floor(y0 / 9) * 9; wy <= y1; wy += 9) {
      const wx = (wy / 9) % 2 ? 4 : W - 6, X = wx * T, Y = wy * T, ww = 2 * T, wh = 3 * T;
      const hh = U.clamp(1 - wy / GROUND, 0, 1);
      const sk = skyCols(c.sky, hh);
      const sky = g.createLinearGradient(0, Y, 0, Y + wh); sky.addColorStop(0, sk[0]); sky.addColorStop(1, sk[1]);
      g.beginPath(); g.moveTo(X, Y + wh); g.lineTo(X, Y + ww / 2); g.arc(X + ww / 2, Y + ww / 2, ww / 2, Math.PI, 0); g.lineTo(X + ww, Y + wh); g.closePath();
      g.fillStyle = sky; g.fill(); g.strokeStyle = line; g.lineWidth = 6; g.stroke();
      if (sk[2] === 'stars') for (let k = 0; k < 4; k++) { Art.starPath(g, X + 16 + k * 18, Y + 40 + (k % 2) * 30, 4, 1.6, 4, 0); Art.fs(g, 'rgba(255,255,255,' + (0.5 + 0.5 * Math.sin(t * 2 + k)).toFixed(2) + ')'); }
      else if (sk[2] === 'bolt') { if (Math.sin(t * 1.3 + wy) > 0.93) { g.beginPath(); g.moveTo(X + 50, Y + 30); g.lineTo(X + 38, Y + 70); g.lineTo(X + 52, Y + 70); g.lineTo(X + 40, Y + 110); g.strokeStyle = '#fff6a0'; g.lineWidth = 4; g.stroke(); } Art.ell(g, X + 30 + Math.sin(t * 0.5 + wy) * 10, Y + 60, 22, 10); Art.fs(g, 'rgba(90,90,120,0.8)'); }
      else { Art.ell(g, X + 30 + Math.sin(t * 0.3 + wy) * 10, Y + 70, 18, 8); Art.fs(g, sk[2] === 'smoke' ? 'rgba(80,40,40,0.7)' : 'rgba(255,255,255,0.8)'); }
      g.fillStyle = line; g.fillRect(X + ww / 2 - 2, Y + 10, 4, wh - 10); g.fillRect(X, Y + wh / 2, ww, 4);
    }
    // floor numbers on the wall at every fifth floor
    g.font = '800 22px "Baloo 2", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let f = 5; f <= c.floors; f += 5) {
      const y = rowOfG(G, f) * T - T * 1.2;
      if (y < top - T || y > bot + T) continue;
      for (const sx of [T * 1.6, (W - 1.6) * T]) {
        U.rr(g, sx - 24, y - 16, 48, 32, 8); Art.fs(g, f % 10 === 0 ? '#ffd23f' : '#fff6c9', '#7a5a2a', 2.5);
        g.fillStyle = '#5a3a1a'; g.fillText(String(f), sx, y + 1);
      }
    }
  }
  // what the windows show: [top colour, bottom colour, extra]
  function skyCols(kind, hh) {
    if (kind === 'space') return ['#0a0a2a', '#2a1a5a', 'stars'];
    if (kind === 'fire') return ['#3a1010', '#ff6a2a', 'smoke'];
    if (kind === 'storm') return ['#3a3e58', '#7a80a0', 'bolt'];
    if (kind === 'snow') return hh < 0.6 ? ['#bfe8ff', '#ffffff', 'cloud'] : ['#5a7ab8', '#bfd8ff', 'stars'];
    if (kind === 'forest') return hh < 0.5 ? ['#8fd3ff', '#d8ffc8', 'cloud'] : ['#ffb38a', '#ffe0a8', 'cloud'];
    return hh < 0.35 ? ['#7fd0ff', '#d8f2ff', 'cloud'] : hh < 0.7 ? ['#ff9a8a', '#ffd08a', 'cloud'] : ['#1a1440', '#3a2a70', 'stars'];
  }
  function mix(a, b, k) {
    const A1 = U.hexToRgb(a), B1 = U.hexToRgb(b);
    return 'rgb(' + [0, 1, 2].map(i => Math.round(A1[i] + (B1[i] - A1[i]) * k)).join(',') + ')';
  }
  function drawLiquid(g, L, y, bottom, t) {
    if (y > bottom) return;
    g.save();
    g.beginPath(); g.moveTo(0, bottom);
    for (let x = 0; x <= W * T; x += 12) g.lineTo(x, y + Math.sin(t * 3 + x * 0.05) * 6);
    g.lineTo(W * T, bottom); g.closePath();
    const gr = g.createLinearGradient(0, y, 0, y + 4 * T);
    gr.addColorStop(0, L.cols[0]); gr.addColorStop(0.3, L.cols[1]); gr.addColorStop(1, L.cols[2]);
    g.fillStyle = gr; g.fill();
    g.lineWidth = 4; g.strokeStyle = L.edge; g.stroke();
    // bubbles (or sparkles) on the surface
    g.fillStyle = L.bub;
    for (let i = 0; i < 9; i++) { const ph = (t * 0.7 + i * 0.37) % 1, bx = (i * 131 + 40) % (W * T); Art.ell(g, bx, y + 14 + (1 - ph) * 20, 6 * ph + 2, 5 * ph + 2); g.fill(); }
    g.restore();
  }
  // a trampoline: legs, a padded frame (gold for the big one), a dark mat that dips when used
  function drawTramp(g, e, t) {
    const x = e.x, w = e.w, yb = e.y, dip = e.comp * 10, top = yb - 22;
    const rim = e.big ? '#ffd23f' : '#5ccfff', rimD = e.big ? '#b8861c' : '#2a7ab0';
    // legs
    g.strokeStyle = '#4a3a5a'; g.lineWidth = 5; g.lineCap = 'round';
    for (const lx of [x + 14, x + w / 2, x + w - 14]) { g.beginPath(); g.moveTo(lx, top + 12); g.lineTo(lx + (lx < x + w / 2 ? -5 : lx > x + w / 2 ? 5 : 0), yb - 2); g.stroke(); }
    // the padded skirt with stripes
    U.rr(g, x, top + 4, w, 11, 5); Art.fs(g, rim, rimD, 2);
    g.fillStyle = 'rgba(255,255,255,0.55)'; for (let k = x + 8; k < x + w - 6; k += 14) g.fillRect(k, top + 7, 5, 5);
    // the stretchy mat on top, sagging in the middle when she lands
    g.beginPath(); g.moveTo(x + 4, top + 4); g.quadraticCurveTo(x + w / 2, top + 4 + dip * 2.2, x + w - 4, top + 4);
    g.strokeStyle = '#2a1f4a'; g.lineWidth = 5; g.stroke();
    Art.ell(g, x + 4, top + 4, 4, 4); Art.fs(g, '#fff', rimD, 1.5); Art.ell(g, x + w - 4, top + 4, 4, 4); Art.fs(g, '#fff', rimD, 1.5);
    // a bouncing arrow (two for the big one) shows what it does
    const by = top - 12 - Math.abs(Math.sin(t * 4)) * 8;
    for (let k = 0; k < (e.big ? 2 : 1); k++) { Art.tri(g, x + w / 2 - 10, by - k * 12, x + w / 2 + 10, by - k * 12, x + w / 2, by - 12 - k * 12); Art.fs(g, rim, rimD, 2); }
  }
  function drawTrophy(g, x, y, t) {
    const bob = Math.sin(t * 2) * 4;
    g.save(); g.translate(x, y + bob);
    g.globalAlpha = 0.35 + 0.15 * Math.sin(t * 3); Art.ell(g, 0, -60, 70, 70); Art.fs(g, '#fff6c9'); g.globalAlpha = 1;
    U.rr(g, -30, -20, 60, 20, 4); Art.fs(g, '#8a5a32', '#5c3a1c', 2.5);
    U.rr(g, -8, -44, 16, 24, 3); Art.fs(g, '#ffd23f', '#b8861c', 2);
    g.beginPath(); g.moveTo(-36, -110); g.lineTo(36, -110); g.quadraticCurveTo(34, -52, 0, -44); g.quadraticCurveTo(-34, -52, -36, -110); Art.fs(g, '#ffd23f', '#b8861c', 3);
    for (const s of [-1, 1]) { g.beginPath(); g.arc(s * 40, -90, 13, s > 0 ? -1.4 : Math.PI - 1.7, s > 0 ? 1.7 : Math.PI + 1.4); g.strokeStyle = '#b8861c'; g.lineWidth = 6; g.stroke(); }
    Art.starPath(g, 0, -82, 14, 6, 5, 0); Art.fs(g, '#fff6c9');
    g.restore();
  }
  // the summit cup for the house (first time at the top of the daily tower)
  LZ.Ext.add({ furn: { draw(g, id, X, Y, w, t) { if (id !== 'towertrophy') return false; g.save(); g.translate(X + w / 2, Y); g.scale(0.6, 0.6); drawTrophy(g, 0, 0, t); g.restore(); return true; } } });

  LZ.Tower = { hooks, buildLevel, menu, summary, saves, unlocked, best: p => saves(p).daily.best, TOWERS, rowOf: (f, id) => TOP + (BY[id || 'daily'].floors - f) * GAP, _floorOf: floorOf };
})();
