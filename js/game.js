/*
 * game.js - the platformer engine: physics, entities, maths gates,
 * number challenges, bosses, camera, HUD.
 *
 * Main loop lives in main.js and calls LZ.Game.update(dt) with a fixed
 * 1/120 s step (fixed steps keep jump heights identical on a slow phone and
 * a fast laptop) and LZ.Game.render(ctx) once per frame.
 */
(function () {
  const U = LZ.U, A = LZ.A, Art = LZ.Art, M = LZ.M, S = LZ.S, D = LZ.D;
  const T = LZ.T;

  /* ---------- physics tuning (world units / second) ---------- */
  const P = {
    grav: 2300, jump: 880, run: 300, accG: 2600, accA: 1700, fric: 2600,
    iceAcc: 700, iceFric: 260, maxFall: 1000,
    wGrav: 820, wMaxFall: 240, wSwim: 430, wRun: 230,
    spring: 1420, mushroom: 1180, stomp: 560,
    coyote: 0.1, buffer: 0.13,
  };
  const PW = 28, PH = 40;           // player hitbox
  const VIEW_TILES_H = 11.5;        // how many tiles tall the screen shows

  let G = null;                     // current level state
  let viewW = 800, viewH = VIEW_TILES_H * T, scale = 1;

  // T = tree stump, B = brick, C = cannon (all solid)
  const isSolid = c => c === '#' || c === 'I' || c === '=' || c === '?' || c === 'U' || c === 'T' || c === 'B' || c === 'C' || c === '>' || c === '<';

  /* =================================================================
   * LEVEL START
   * ================================================================= */
  /*
   * mode (optional) says what kind of run this is:
   *   { kind: 'hard' }                    night version of a world level
   *   { kind: 'daily', info }             level of the day (info from LZ.X.daily)
   *   { kind: 'custom', data, test, id }  a level from the Pracownia;
   *                                        test = the builder checking her own level
   */
  function start(wi, li, mode) {
    const prof = S.active();
    mode = mode || null;
    const kind = mode ? mode.kind : 'normal';
    // home and world are "sandbox" runs: a module (G.sb) builds the level and
    // adds its own behaviour through the hooks called below (sb.init, sb.tick...)
    const sb = kind === 'home' ? LZ.Home.hooks : kind === 'world' ? LZ.World.hooks : kind === 'tower' ? LZ.Tower.hooks : null;
    const lvl = kind === 'custom' ? LZ.X.toLevel(mode.data)
      : kind === 'home' ? LZ.Home.buildLevel(prof)
      : kind === 'world' ? LZ.World.buildLevel(prof, mode)
      : kind === 'wboss' ? Object.assign(LZ.Gen.bossArena(mode.world), { noStars: true })   // a boss from the open world (bosses.js): statue or the crystal lair
      : kind === 'temple' ? LZ.Temples.level(mode)   // a temple dungeon entered from the open world (temples.js)
      : kind === 'weekly' ? LZ.Weekly.level(mode)    // World of the week (weekly.js)
      : kind === 'tower' ? LZ.Tower.buildLevel(prof, mode) // the endless tower (tower.js)
      : LZ.Gen.generate(wi, li, kind === 'hard' ? { hard: true } : kind === 'daily' ? { daily: mode.info.day } : null);
    if (sb) { wi = lvl.wi; li = lvl.li; }
    if (kind === 'hard') lvl.world = Art.nightWorld(lvl.world);
    if (kind === 'custom') { wi = lvl.wi; li = 1; }
    const ch = D.CHARACTERS.find(c => c.id === prof.equip.char) || D.CHARACTERS[0];
    const ab = ch.ability || {};
    const si = prof.starItems || [];
    const maxHearts = (ab.hearts || 3) + (si.includes('perk_heart') ? 1 : 0) + (si.includes('perk_heart2') ? 1 : 0);   // star-shop perks
    G = {
      lvl, prof, ch, ab, wi, li, t: 0, state: 'play',
      rew: (S.mathBand(prof).reward || 1),   // difficulty reward multiplier
      grid: lvl.cols, W: lvl.W, H: lvl.H,
      mask: null,
      coins: 0, stars: [false, false, false], hearts: maxHearts, maxHearts,
      mathOk: 0, mathTotal: 0, startTime: performance.now(),
      ents: [], enemies: [], particles: [], texts: [], projectiles: [], toasts: [],
      banner: null, cam: { x: 0, y: 0 }, shake: 0,
      checkpoint: { x: lvl.start.x * T, y: lvl.start.y * T },
      bumps: {},                   // "x,y" -> bump animation time for ?-blocks
      qc: lvl.qc,
      boss: null,
      // run tracking for medals and daily goals
      mode, kind, clock: 0, hits: 0, stompsRun: 0, looseTotal: 0, looseGot: 0,
      par: LZ.X.parTime(lvl.W),
      // built levels can't be a coin farm, and a temple run again the same day gives no coins (temples.js)
      noCoins: kind === 'custom' || !!(mode && mode.noCoins),
      speedMul: kind === 'hard' || kind === 'wboss' ? 1.15 : 1,
      sb,
    };
    if (kind === 'daily') G.dailyTarget = LZ.X.dailyGoalText(mode.info, lvl);
    G.player = {
      x: lvl.start.x * T, y: lvl.start.y * T + (T - PH), vx: 0, vy: 0, w: PW, h: PH,
      facing: 1, grounded: false, coyote: 0, buffer: 0, jumps: 0, invuln: 0,
      squash: 0, phase: 0, state: 'idle', on: null, lastSafe: null, trailT: 0,
      magnetT: 0, bootsT: 0, rainbowT: 0, shield: false, hurtT: 0, glide: false,
    };
    // pet bought in the star shop: follows the player and collects nearby coins
    const petId = prof.equip.pet;
    G.pet = petId && petId !== 'none' && (prof.starItems || []).includes(petId) ? { id: petId, x: G.player.x - 40, y: G.player.y - 30, reach: D.PETS[petId].reach * T } : null;
    G.gold = !!prof.equip.gold && (prof.starItems || []).includes('gold');
    if (si.includes('perk_shield')) G.player.shield = true;   // star-shop perk: start with a shield
    if (si.includes('perk_magnet')) G.player.magnetT = 20;   // start with a 20 s coin magnet
    if (si.includes('perk_boots')) G.player.bootsT = 15;     // and 15 s of super-jump boots
    // world mechanics
    G.lowgrav = lvl.world.features.includes('lowgrav');
    computeMasks();
    buildEntities();
    if (lvl.boss) setupBoss();
    G.cam.x = G.player.x - viewW * 0.35; G.cam.y = (G.H * T - viewH);
    clampCam(true);
    A.playMusic(lvl.world.music + (lvl.boss ? 100 : 0));
    if (sb) sb.init(G);
    const title = sb ? lvl.themeName : kind === 'daily' ? 'Poziom dnia: ' + G.dailyTarget.text
      : kind === 'custom' || kind === 'temple' ? lvl.themeName
      : (kind === 'hard' || kind === 'wboss' ? 'Noc ' : '') + (lvl.boss ? lvl.boss.name + '!' : lvl.themeName && wi !== D.BONUS_ID ? wi + '-' + li + ': ' + lvl.themeName : lvl.world.name + ' ' + wi + '-' + li);
    if (title) toast(title, kind === 'daily' ? 3.5 : 2.2);
    // secret room bounds in world units (the room sits past the castle)
    G.room = lvl.room ? { x0: lvl.room.x0 * T, x1: lvl.room.x1 * T, spawn: { x: lvl.room.spawn.x * T, y: lvl.room.spawn.y * T } } : null;
    G.secret = lvl.secret || null;
  }

  /* Neighbour masks decide which tile edges get grass and rounded corners. */
  function computeMasks() {
    const { W, H, grid } = G;
    G.mask = [];
    for (let x = 0; x < W; x++) {
      const col = [];
      for (let y = 0; y < H; y++) {
        const c = grid[x][y];
        if (c !== '#' && c !== 'I') { col.push(0); continue; }
        const g = (xx, yy) => xx < 0 || xx >= W || yy >= H ? true : yy < 0 ? false : (grid[xx][yy] === '#' || grid[xx][yy] === 'I' || grid[xx][yy] === '>' || grid[xx][yy] === '<' || grid[xx][yy] === 'Q');   // no grass edge under quicksand
        col.push((g(x, y - 1) ? 0 : 1) | (g(x + 1, y) ? 0 : 2) | (g(x, y + 1) ? 0 : 4) | (g(x - 1, y) ? 0 : 8));
      }
      G.mask.push(col);
    }
  }
  const tileAt = (tx, ty) => (tx < 0 || tx >= G.W) ? '#' : (ty < 0 || ty >= G.H) ? '.' : G.grid[tx][ty];

  // list: entity definitions in window tile coordinates (the open world passes
  // the pieces of map it streams in; normal levels build everything at start)
  function buildEntities(list) {
    for (const e of list || G.lvl.ents) {
      const px = e.x * T, py = e.y * T;
      switch (e.t) {
        case 'coin': G.ents.push({ k: 'coin', x: px + T / 2, y: py + T / 2, r: 12, loose: true, wid: e.wid }); G.looseTotal++; break;
        case 'star': G.ents.push({ k: 'star', x: px + T / 2, y: py + T / 2, idx: e.idx }); break;
        case 'spring': G.ents.push({ k: 'spring', x: px + 6, y: py - 26, w: T - 12, h: 26, comp: 0 }); break;
        case 'mushroom': G.ents.push({ k: 'mushroom', x: px - 20, y: py - 38, w: T + 40, h: 38, comp: 0 }); break;
        case 'moving': G.ents.push({ k: 'plat', sub: 'moving', lift: !!e.lift, x: px, y: py, w: e.w * T, h: 18, x1: px, y1: py, x2: e.x2 * T, y2: e.y2 * T, ph: 0, dx: 0, dy: 0 }); break;
        case 'cloud': G.ents.push({ k: 'plat', sub: 'cloud', x: px, y: py, w: e.w * T, h: 18, timer: -1, gone: 0, dx: 0, dy: 0 }); break;
        case 'falling': G.ents.push({ k: 'plat', sub: 'falling', x: px, y: py, w: e.w * T, h: 18, oy: py, timer: -1, vy: 0, dx: 0, dy: 0 }); break;
        case 'wind': G.ents.push({ k: 'wind', x: px, y: py, w: e.w * T, h: e.h * T }); break;
        case 'checkpoint': G.ents.push({ k: 'checkpoint', x: px + T / 2, y: py, on: false, anim: 0 }); break;
        case 'goal': G.ents.push({ k: 'goal', x: px + T / 2, y: py, flagY: 0 }); G.goalX = px; break;
        case 'castle': G.ents.push({ k: 'castle', x: px, y: py }); break;
        case 'sign': G.ents.push({ k: 'sign', x: px + T / 2, y: py, down: !!e.down }); break;
        case 'stump': {
          // hollow tree stump; `base` = ground row it stands on (room stumps stand on the room floor)
          const st = { k: 'stump', x: px, y: py, w: 2 * T, h: e.h * T, base: (e.base || (e.y + e.h)) * T, secret: !!e.secret, exit: !!e.exit, roomExit: !!e.roomExit, standT: 0 };
          G.ents.push(st);
          if (e.plant) { const pl = spawnEnemy('plant', px + T / 2, py); pl.x = px + T - pl.w / 2; pl.stumpTop = py; pl.stump = st; pl.y = py; pl.up = 0; pl.cycle = Math.random() * 3; }
          break;
        }
        case 'cannon': G.ents.push({ k: 'cannon', x: px, y: py, w: T, h: e.h * T, fireT: 1.5 + Math.random() * 2, face: -1, recoil: 0 }); break;
        case 'gate': {
          const gate = { k: 'gate', x: e.x * T + 4, y: 0, w: T - 8, h: e.gh * T, baseH: e.gh * T, open: 0, state: 'closed', zone: [e.zone[0] * T, e.zone[1] * T], blocks: [], problem: null, wrong: 0, first: true };
          e.blocks.forEach(bx => {
            const b = { k: 'ans', x: bx * T, y: e.by * T, w: T, h: T, label: '', correct: false, bad: false, bump: 0, gate, hint: false, active: false };
            gate.blocks.push(b); G.ents.push(b);
          });
          G.ents.push(gate);
          break;
        }
        case 'challenge': G.ents.push({ k: 'challenge', zone: [e.zone[0] * T, e.zone[1] * T], spots: e.spots.map(s => [s[0] * T + T / 2, s[1] * T + T / 2]), chest: { x: e.chest[0] * T, y: e.chest[1] * T - 34, w: 44, h: 34, open: 0 }, c: null, state: 'idle', bubbles: [] }); break;
        case 'enemy': { const en = spawnEnemy(e.type, px, py); if (e.wid) en.wid = e.wid; if (e.col) en.col = e.col; if (e.giant) makeGiant(en, e); break; }
        default: if (G.sb && G.sb.buildEnt) G.sb.buildEnt(G, e, px, py);
      }
    }
  }

  /*
   * A giant (open world, giants.js): the same creature drawn bigger, with a
   * few hearts. Every hop on its head takes one; the last one knocks it out.
   * bw/bh keep the normal size for drawing, w/h are the real, bigger body.
   */
  function makeGiant(en, d) {
    const k = d.giant, feet = en.y + en.h, cx = en.x + en.w / 2;
    en.bw = en.w; en.bh = en.h; en.w = Math.round(en.w * k); en.h = Math.round(en.h * k);
    en.x = cx - en.w / 2; en.y = feet - en.h; en.ox = en.x; en.oy = en.y;
    en.giant = k; en.hp = en.maxHp = d.hp || 4; en.gid = d.gid; en.gname = d.gname; en.stompable = true; en.hitT = 0;
  }
  function spawnEnemy(type, px, py) {
    const size = { slime: [36, 26], bee: [32, 30], hedgehog: [36, 26], snowball: [34, 34], fish: [36, 26], jelly: [30, 34], urchin: [30, 30], shroom: [36, 34], bat: [34, 28], cloudy: [40, 30], firejelly: [30, 34], plant: [34, 46], ball: [30, 30], robot: [34, 38], alien: [34, 32], ufo: [46, 30], scorpion: [40, 28], cactus: [32, 40], vulture: [46, 32], ghost: [36, 38], balloon: [34, 46], wisp: [30, 30] }[type] || [32, 30];
    const e = {
      type, x: px + (T - size[0]) / 2, y: py - size[1], w: size[0], h: size[1], vx: 0, vy: 0, dir: -1,
      ox: px, oy: py - size[1], dead: false, deadT: 0, seed: Math.random() * 10, grounded: false, t: 0, roll: 0,
      stompable: !['hedgehog', 'urchin', 'firejelly', 'plant', 'cactus', 'wisp'].includes(type),   // spiky ones hurt from above too
      col: null,
    };
    if (type === 'firejelly') { e.restY = py - size[1] + T; e.y = e.restY; e.jt = 1 + Math.random() * 2; }
    if (type === 'slime') e.col = U.pick(Math.random, ['#8fe36b', '#ff85b0', '#5ccfff', '#ffb347', '#b58cff']);
    G.enemies.push(e);
    return e;
  }

  /* =================================================================
   * UPDATE
   * ================================================================= */
  function update(dt) {
    if (!G) return;
    G.t += dt;
    if (G.decorating) { updateParticles(dt); return; }
    if (G.state === 'dead') { G.deadT -= dt; updateParticles(dt); if (G.deadT <= 0) restartAfterDeath(); return; }   // home decorate mode: the room stands still, the camera is moved by dragging
    const p = G.player;
    for (const k in G.bumps) { G.bumps[k] -= dt * 4; if (G.bumps[k] <= 0) delete G.bumps[k]; }

    if (G.state === 'play' || G.state === 'bossdefeat') updatePlatforms(dt);
    if (G.state === 'play') {
      G.clock += dt;   // play time only: pauses, warps and the flag slide don't count against the par time
      updatePlayer(dt);
      updateEntities(dt);
      updateEnemies(dt);
      if (G.boss) updateBoss(dt);
      updateProjectiles(dt);
      if (G.sb) G.sb.tick(G, dt);
    } else if (G.state === 'goal') {
      // slide down the pole, then walk to the castle
      G.goalT += dt;
      if (G.goalT < 1.0) { p.vy = 0; p.y = Math.min(p.y + 260 * dt, G.goalGround - PH); p.state = 'fall'; }
      else { p.x += 150 * dt; p.facing = 1; p.phase += dt * 14; p.state = 'run'; p.y = G.goalGround - PH; }
      const goal = G.ents.find(e => e.k === 'goal'); if (goal) goal.flagY = Math.min(1, goal.flagY + dt * 0.9);
      if (G.goalT > 2.6 && !G.finished) finish(true);
    } else if (G.state === 'bossdefeat') {
      G.defeatT += dt;
      if (Math.random() < 0.5) confetti(G.boss.x + G.boss.w / 2 + (Math.random() - 0.5) * 200, G.boss.y + (Math.random() - 0.5) * 100, 3);
      if (G.defeatT > 3 && !G.finished) finish(true);
    } else if (G.state === 'respawn') {
      G.respawnT -= dt;
      if (G.respawnT <= 0) G.state = 'play';
    } else if (G.state === 'warp') {
      updateWarp(dt);
    }
    if (G.pet) {
      // float behind the player's back with a gentle bob; lag makes it feel alive
      const p2 = G.player, tx = p2.x + PW / 2 - p2.facing * 44, ty = p2.y - 18 + Math.sin(G.t * 3) * 8;
      G.pet.x += (tx - G.pet.x) * Math.min(1, dt * 5); G.pet.y += (ty - G.pet.y) * Math.min(1, dt * 5);
      G.pet.facing = p2.facing;
    }
    if (G.gold && Math.random() < dt * 14) G.particles.push({ x: G.player.x + Math.random() * PW, y: G.player.y + Math.random() * PH, vx: 0, vy: -25, life: 0.6, max: 0.6, size: 4, kind: 'sparkle', rot: Math.random() * 3, grav: 0 });
    updateParticles(dt);
    updateCamera(dt);
  }

  /* ---------------- player ---------------- */
  function updatePlayer(dt) {
    const p = G.player, In = LZ.In, ab = G.ab;
    const water = G.lvl.water || !!G.inWater;   // open world: lakes are 'W' tiles (sb.tick sets inWater)
    const onIce = p.grounded && p.groundTile === 'I';
    const speed = (water ? P.wRun : P.run) * (ab.speed || 1) * (p.rainbowT > 0 ? 1.25 : 1);
    const want = (In.right ? 1 : 0) - (In.left ? 1 : 0);
    if (p.invuln > 0) p.invuln -= dt;
    if (p.hurtT > 0) p.hurtT -= dt;
    p.magnetT = Math.max(0, p.magnetT - dt); p.bootsT = Math.max(0, p.bootsT - dt); p.rainbowT = Math.max(0, p.rainbowT - dt);
    // a ride (mine cart, balloon, boat) moves her itself: no walking, no gravity
    if (G.lockPlayer) { p.vx = 0; p.vy = 0; p.grounded = true; p.state = G.lockPlayer; p.jumps = 0; return; }

    // horizontal: accelerate toward the wanted speed; ice keeps momentum
    const acc = p.grounded ? (onIce ? P.iceAcc : P.accG) : P.accA;
    const fric = p.grounded ? (onIce ? P.iceFric : P.fric) : P.accA * 0.35;
    if (want !== 0 && p.hurtT <= 0) {
      if (Math.sign(p.vx) === want && Math.abs(p.vx) >= speed) {
        // already at/above top speed in this direction (e.g. after a knockback
        // or a speed power-up ending): only let the extra speed fade out
        p.vx = want * Math.max(speed, Math.abs(p.vx) - fric * dt);
      } else {
        // accelerate, but never past top speed - without this cap the player
        // kept speeding up in mid-air and long jumps flew out of control
        p.vx += want * acc * dt;
        if (Math.sign(p.vx) === want && Math.abs(p.vx) > speed) p.vx = want * speed;
      }
      p.facing = want;
    } else {
      const s = Math.sign(p.vx), m = Math.max(0, Math.abs(p.vx) - fric * dt);
      p.vx = s * m;
    }

    // jump with coyote time (jump just after leaving a ledge) and jump
    // buffering (press slightly before landing) - both make the controls
    // forgiving, which matters a lot for a 7-year-old on a touch screen.
    if (In.jumpPressed) { p.buffer = P.buffer; In.jumpPressed = false; }
    else p.buffer -= dt;
    p.coyote = p.grounded ? P.coyote : p.coyote - dt;
    // quicksand holds your feet: a slightly weaker jump (still clears a 2-tile bank)
    const inSand = p.grounded && p.groundTile === 'Q';
    const jumpMul = (ab.jump || 1) * (p.bootsT > 0 ? 1.28 : 1) * (inSand ? 0.86 : 1);

    if (water) {
      if (p.buffer > 0) { p.vy = -P.wSwim * (ab.jump || 1); p.buffer = 0; A.play('splash'); p.squash = -0.3; }
    } else if (p.buffer > 0 && (p.coyote > 0)) {
      p.vy = -P.jump * jumpMul * (G.lowgrav ? 0.78 : 1); p.buffer = 0; p.coyote = 0; p.grounded = false; p.on = null;
      p.jumps = 1; p.squash = -0.35; A.play('jump'); G.prof.stats.jumps++;
      dust(p.x + PW / 2, p.y + PH, 5);
    } else if (p.buffer > 0 && !p.grounded && ab.doubleJump && p.jumps < 2) {
      p.vy = -P.jump * jumpMul * 0.92 * (G.lowgrav ? 0.78 : 1); p.buffer = 0; p.jumps = 2; p.squash = -0.3; A.play('djump');
      for (let i = 0; i < 10; i++) G.particles.push({ x: p.x + PW / 2, y: p.y + PH, vx: (Math.random() - 0.5) * 200, vy: Math.random() * 80, life: 0.5, max: 0.5, size: 4, kind: 'rainbow', ci: i, grav: 0 });
    }
    // variable jump height: letting go early cuts the jump short
    // (but never for spring/mushroom launches: those must always go full height,
    //  otherwise a child who doesn't hold the button can't reach what's above)
    if (p.padLaunch && (p.vy >= 0 || p.grounded)) p.padLaunch = false;
    if (!water && !In.jump && p.vy < -300 && !p.padLaunch) p.vy += 3200 * dt;

    /*
     * Vines ('H', open world): hold jump to climb up, let go to slide down
     * slowly. Only three buttons on a touch screen, so climbing reuses jump.
     */
    const cx0 = Math.floor((p.x + PW / 2) / T), onVine = tileAt(cx0, Math.floor((p.y + PH / 2) / T)) === 'H' || tileAt(cx0, Math.floor((p.y + PH - 4) / T)) === 'H';
    // grab a vine only on purpose (holding jump, not in the rising part of a jump):
    // otherwise a jump over a shaft got caught by its vine and slid her down
    p.climb = onVine && !water && (p.climb || (In.jump && p.vy > -150));
    if (p.climb) {
      p.vy = In.jump ? -240 : Math.min(p.vy + 900 * dt, 110);
      p.jumps = 0; p.coyote = P.coyote;
    }
    // space: gravity x0.55 with a softer jump = about 10% higher and much floatier
    const grav = p.climb ? 0 : water ? P.wGrav : P.grav * (G.lowgrav ? 0.55 : 1);
    p.vy += grav * dt;
    p.glide = false;
    if (!water && ab.glide && In.jump && p.vy > 110 && !p.grounded) { p.vy = 110; p.glide = true; }
    // wind updrafts
    for (const e of G.ents) if (e.k === 'wind' && U.overlap(p, e)) { p.vy -= 3400 * dt; if (p.vy < -560) p.vy = -560; }
    p.vy = Math.min(p.vy, water ? P.wMaxFall : P.maxFall * (G.lowgrav ? 0.6 : 1));

    // ride moving platforms: apply the platform's movement first
    if (p.on && p.on.k === 'plat') { p.x += p.on.dx; p.y += p.on.dy; }

    const prevBottom = p.y + PH;
    // space: a floaty jump stays in the air ~40% longer, which carried players
    // past planks and ledges laid out for normal jumps. Slowing sideways drift
    // in the air keeps the jump's footprint the same while it still feels floaty.
    // quicksand: wading is half speed, so jumping over a pool is the quick way
    moveX(p, p.vx * dt * (G.lowgrav && !p.grounded ? 0.72 : 1) * (inSand ? 0.5 : 1));
    const wasGrounded = p.grounded;
    p.grounded = false; p.on = null;
    moveY(p, p.vy * dt, prevBottom);
    // conveyor belt: carries whoever stands on it
    if (p.grounded && (p.groundTile === '>' || p.groundTile === '<')) moveX(p, (p.groundTile === '>' ? 1 : -1) * 105 * dt);
    // quicksand: standing in it you slowly sink up to your knees (never deeper -
    // it slows you down but can't swallow anyone), stepping out resets it
    if (p.grounded && p.groundTile === 'Q') {
      p.sinkD = Math.min(22, (p.sinkD || 0) + 26 * dt);
      if (Math.abs(p.vx) > 30 && Math.random() < 0.3) G.particles.push({ x: p.x + PW / 2 + (Math.random() - 0.5) * 20, y: p.y + PH - 4, vx: (Math.random() - 0.5) * 60, vy: -60 - Math.random() * 40, life: 0.4, max: 0.4, size: 4, col: '#e8b86a', grav: 400 });
    } else if (!p.grounded || p.groundTile !== 'Q') p.sinkD = 0;
    // invisible ceiling at the top of the level: no swimming or flying over a maths gate
    if (p.y < 0) { p.y = 0; if (p.vy < 0) p.vy = 0; }
    if (p.grounded && !wasGrounded) { p.squash = 0.35; p.jumps = 0; if (!water) dust(p.x + PW / 2, p.y + PH, 3); }
    p.squash *= Math.pow(0.0006, dt);

    // remember a safe spot to respawn after a fall (not near an edge)
    if (p.grounded && !p.on) {
      const tx = Math.floor((p.x + PW / 2) / T), ty = Math.floor((p.y + PH + 2) / T);
      if (isSolid(tileAt(tx - 1, ty)) && isSolid(tileAt(tx + 1, ty)) && isSolid(tileAt(tx, ty))) p.lastSafe = { x: p.x, y: p.y };
    }

    // animation state
    p.state = water && !p.grounded ? 'swim' : !p.grounded ? (p.vy < 0 ? 'jump' : 'fall') : Math.abs(p.vx) > 30 ? 'run' : 'idle';
    p.phase += dt * (Math.abs(p.vx) / 22);

    // trail particles
    const trail = G.prof.equip.trail;
    if (trail && trail !== 'none' && (Math.abs(p.vx) > 60 || !p.grounded)) {
      p.trailT -= dt;
      if (p.trailT <= 0) {
        p.trailT = 0.05;
        G.particles.push({ x: p.x + PW / 2 - p.facing * 12 + (Math.random() - 0.5) * 8, y: p.y + PH * 0.6 + (Math.random() - 0.5) * 14, vx: -p.facing * 20, vy: trail === 'bubbles' ? -40 : -10, life: 0.7, max: 0.7, size: 5 + Math.random() * 2, kind: trail, ci: Math.floor(G.t * 20), rot: Math.random() * 6, grav: 0, col: U.pick(Math.random, ['#9d7bff', '#ff6fae', '#5ccfff']) });
      }
    }
    if (p.rainbowT > 0 && Math.random() < 0.6) G.particles.push({ x: p.x + Math.random() * PW, y: p.y + Math.random() * PH, vx: 0, vy: -30, life: 0.5, max: 0.5, size: 4, kind: 'rainbow', ci: Math.floor(Math.random() * 6), grav: 0 });

    // hazards: thorns and lava
    const x0 = Math.floor(p.x / T), x1 = Math.floor((p.x + PW - 1) / T), y0 = Math.floor(p.y / T), y1 = Math.floor((p.y + PH - 1) / T);
    for (let tx = x0; tx <= x1; tx++) for (let ty = y0; ty <= y1; ty++) {
      const c = tileAt(tx, ty);
      if (c === 'S' && p.y + PH > ty * T + 22) { hurt(null, 'thorns'); p.vy = -620; }
      if (c === 'L' && p.y + PH > ty * T + 14) { fallOut(); return; }
    }
    if (p.y > G.H * T + 80) fallOut();
  }

  /* Axis-separated collision against tiles and solid entities. */
  function moveX(o, dx) {
    o.x += dx;
    const y0 = Math.floor(o.y / T), y1 = Math.floor((o.y + o.h - 1) / T);
    if (dx > 0) {
      const tx = Math.floor((o.x + o.w) / T);
      for (let ty = y0; ty <= y1; ty++) if (isSolid(tileAt(tx, ty))) { o.x = tx * T - o.w - 0.01; o.vx = 0; o.hitWall = 1; break; }
    } else if (dx < 0) {
      const tx = Math.floor(o.x / T);
      for (let ty = y0; ty <= y1; ty++) if (isSolid(tileAt(tx, ty))) { o.x = (tx + 1) * T + 0.01; o.vx = 0; o.hitWall = -1; break; }
    }
    if (o === G.player) for (const e of G.ents) {
      if ((e.k === 'gate' && e.state !== 'open') || e.k === 'ans') {
        const r = e.k === 'gate' ? { x: e.x, y: e.y + (e.baseH - e.h), w: e.w, h: e.h } : e;
        if (U.overlap(o, r)) {
          if (dx > 0) o.x = r.x - o.w - 0.01; else if (dx < 0) o.x = r.x + r.w + 0.01; o.vx = 0;
          // underwater, bonking from below is fiddly while floating - any touch answers
          if (e.k === 'ans' && G.lvl.water && dx !== 0) hitAnswer(e);
        }
      }
    }
  }
  function moveY(o, dy, prevBottom) {
    o.y += dy;
    const x0 = Math.floor((o.x + 2) / T), x1 = Math.floor((o.x + o.w - 3) / T);
    if (dy > 0) {
      const ty = Math.floor((o.y + o.h) / T);
      for (let tx = x0; tx <= x1; tx++) {
        const c = tileAt(tx, ty);
        if (isSolid(c) || (c === '-' && prevBottom <= ty * T + 1)) { o.y = ty * T - o.h; o.vy = 0; o.grounded = true; o.groundTile = c; break; }
        // quicksand is soft ground for the player only: the surface sits sinkD
        // pixels down and moves lower the longer she stands in it. Feet already
        // inside the sand row get pulled down to that surface (that's the sinking),
        // because gravity alone moves them less per frame than the sand sinks.
        if (c === 'Q' && o === G.player) { const sy = ty * T + (o.sinkD || 0); if (prevBottom <= sy + 1) { o.y = sy - o.h; o.vy = 0; o.grounded = true; o.groundTile = 'Q'; break; } }
      }
    } else if (dy < 0) {
      const ty = Math.floor(o.y / T);
      for (let tx = x0; tx <= x1; tx++) {
        const c = tileAt(tx, ty);
        if (isSolid(c)) {
          o.y = (ty + 1) * T; o.vy = 0;
          if (o === G.player) hitBlock(tx, ty, c);
          break;
        }
      }
    }
    if (o !== G.player) return;
    // entity platforms / blocks
    for (const e of G.ents) {
      if (e.k === 'plat' && !(e.sub === 'cloud' && e.gone > 0)) {
        if (o.vy >= 0 && prevBottom <= e.y + 2 && o.y + o.h >= e.y && o.x + o.w > e.x + 2 && o.x < e.x + e.w - 2) {
          o.y = e.y - o.h; o.vy = 0; o.grounded = true; o.on = e; o.groundTile = '-';
          if (e.sub === 'cloud' && e.timer < 0) e.timer = 0.75;
          if (e.sub === 'falling' && e.timer < 0) e.timer = 0.9;   // long enough to shake visibly and step off
        }
      } else if (e.k === 'spring' || e.k === 'mushroom') {
        if (o.vy >= 0 && prevBottom <= e.y + 6 && o.y + o.h >= e.y && o.x + o.w > e.x && o.x < e.x + e.w) {
          o.y = e.y - o.h; o.vy = -(e.k === 'spring' ? P.spring : P.mushroom) * (LZ.In.jump ? 1.06 : 1);
          e.comp = 1; o.jumps = 1; o.squash = -0.45; o.padLaunch = true; A.play('spring');
        }
      } else if (e.k === 'ans' || (e.k === 'gate' && e.state !== 'open')) {
        const r = e.k === 'gate' ? { x: e.x, y: e.y + (e.baseH - e.h), w: e.w, h: e.h } : e;
        if (!U.overlap(o, r)) continue;
        if (dy > 0) { o.y = r.y - o.h; o.vy = 0; o.grounded = true; o.groundTile = '='; if (e.k === 'ans' && G.lvl.water) hitAnswer(e); }
        else if (dy < 0) { o.y = r.y + r.h; o.vy = 0; if (e.k === 'ans') hitAnswer(e); }
      }
    }
  }

  function hitBlock(tx, ty, c) {
    const key = tx + ',' + ty;
    if (G.sb) setTimeout(() => G && G.sb && G.sb.onBlock(G, tx, ty, G.grid[tx][ty]), 0);   // after the change below
    if (c === '?') {
      G.grid[tx][ty] = 'U';
      G.bumps[key] = 1;
      const what = G.qc[key] || 'coin';
      if (what === 'coin') { popCoin(tx * T + T / 2, ty * T); A.play('block'); A.play('coin'); }
      else { G.ents.push({ k: 'power', kind: what, x: tx * T + T / 2, y: ty * T - 18, vy: -200, born: 0.35 }); A.play('sprout'); }
      // knock enemies standing on the block
      for (const e of G.enemies) if (!e.dead && Math.abs(e.x + e.w / 2 - (tx * T + T / 2)) < T && Math.abs(e.y + e.h - ty * T) < 6) killEnemy(e, true);
    } else if (c === 'B') {
      const what = G.qc[key];
      if (what === 'multi' || typeof what === 'number') {
        // coin brick: one coin per hit, up to 6, then it turns into a used block
        const left = what === 'multi' ? 4 : what;   // 4 coins per multi brick (was 6 - the shop emptied too fast)
        popCoin(tx * T + T / 2, ty * T); A.play('coin'); G.bumps[key] = 1;
        if (left <= 1) { G.grid[tx][ty] = 'U'; delete G.qc[key]; } else G.qc[key] = left - 1;
      } else if (what) {
        G.grid[tx][ty] = 'U'; G.bumps[key] = 1; delete G.qc[key];
        G.ents.push({ k: 'power', kind: what, x: tx * T + T / 2, y: ty * T - 18, vy: -200, born: 0.35 }); A.play('sprout');
      } else {
        // plain brick: smash! (nothing required ever sits only on bricks)
        G.grid[tx][ty] = '.'; A.play('break'); G.shake = Math.max(G.shake, 0.08);
        const col = G.lvl.world.pal.block;
        for (let k = 0; k < 4; k++) G.particles.push({ x: tx * T + (k % 2 ? 36 : 12), y: ty * T + (k < 2 ? 12 : 36), vx: (k % 2 ? 1 : -1) * (90 + Math.random() * 60), vy: -380 - (k < 2 ? 120 : 0), life: 1.1, max: 1.1, size: 12, kind: 'debris', col, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14, grav: 1500 });
      }
      for (const e of G.enemies) if (!e.dead && Math.abs(e.x + e.w / 2 - (tx * T + T / 2)) < T && Math.abs(e.y + e.h - ty * T) < 6) killEnemy(e, true);
    } else { G.bumps[key] = 0.6; A.play('bump'); }
  }

  /* ---------------- maths: answer blocks & gates ---------------- */
  function hitAnswer(b) {
    if (b.bump > 0.3) return;   // ignore repeat touches in the same moment (side-touch underwater fires every frame)
    b.bump = 1;
    const gate = b.gate;
    if (!gate.problem || gate.state !== 'closed' || b.bad || !b.active) { A.play('bump'); return; }
    if (b.correct) {
      A.play('correct'); gate.state = 'opening';
      b.good = true;
      confetti(b.x + T / 2, b.y, 30);
      floatText(b.x + T / 2, b.y - 20, U.pick(Math.random, ['Brawo!', 'Super!', 'Świetnie!', 'Ekstra!', 'Tak jest!']), '#2fb34a', 30);
      if (gate.first) {
        mathResult(gate.problem.topic, true);
        // coin shower only for a first-try answer - bigger on harder difficulty levels
        for (let i = 0; i < Math.round(3 * G.rew); i++) setTimeout(() => G && popCoin(b.x + T / 2, b.y), i * 70);
      } else floatText(b.x + T / 2, b.y - 50, 'Brama otwarta (bez monet)', '#7a6a9a', 18);
      setTimeout(() => A.play('gate'), 300);
      G.shake = 0.3;
    } else {
      A.play('wrong'); b.bad = true; gate.wrong++;
      if (gate.first) { mathResult(gate.problem.topic, false); gate.first = false; }
      floatText(b.x + T / 2, b.y - 20, 'Spróbuj jeszcze raz!', '#e0567a', 24);
      // After two misses show the answer so nobody gets stuck.
      if (gate.wrong >= 2 || gate.blocks.filter(x => x.active && !x.bad && !x.correct).length === 0) gate.blocks.forEach(x => { if (x.correct) x.hint = true; });
    }
  }
  function mathResult(topic, ok) {
    G.mathTotal++; if (ok) G.mathOk++;
    S.recordAnswer(G.prof, topic, ok);
    if (ok && G.prof.stats.streak > 0 && G.prof.stats.streak % 5 === 0) toast('Seria ' + G.prof.stats.streak + ' dobrych odpowiedzi!', 2);
  }

  function setupGate(gate) {
    const band = S.mathBand(G.prof);
    gate.problem = M.question(G.prof.skill, band);
    const ch = gate.problem.choices;
    const slots = ch.length === 2 ? [gate.blocks[0], gate.blocks[2]] : gate.blocks;
    gate.blocks.forEach(b => { b.active = false; b.label = ''; });
    slots.forEach((b, i) => { b.active = true; b.label = ch[i]; b.correct = ch[i] === gate.problem.a; });
    LZ.Speech.say(gate.problem.q);
  }

  /* ---------------- number challenges ---------------- */
  function setupChallenge(z) {
    const c = M.challenge(G.prof.skill, S.mathBand(G.prof));
    z.c = c; z.state = 'active'; z.total = 0; z.next = 0; z.mistake = false;
    const n = c.labels.length;
    // spread N bubbles across the available spots
    const idxs = [];
    for (let i = 0; i < n; i++) idxs.push(Math.round(i * (z.spots.length - 1) / Math.max(1, n - 1)));
    const used = [...new Set(idxs)];
    while (used.length < n) { for (let i = 0; i < z.spots.length && used.length < n; i++) if (!used.includes(i)) used.push(i); }
    z.bubbles = c.labels.map((label, i) => { const s = z.spots[used[i]]; return { x: s[0], y: s[1], ox: s[0], oy: s[1], label, alive: true, cool: 0, seed: i * 1.7, pop: 0 }; });
    z.goodLeft = c.kind === 'set' ? c.labels.filter(l => c.good(l)).length : 0;
    LZ.Speech.say(c.title);
    A.play('power');
  }
  function collectBubble(z, b) {
    const c = z.c;
    if (b.cool > 0) return;
    if (c.kind === 'sum') {
      b.alive = false; b.pop = 1; A.play('pop');
      z.total += +b.label;
      floatText(b.x, b.y - 24, '+' + b.label + ' = ' + z.total, '#7a5ce6', 22);
      if (z.total === c.target) challengeDone(z);
      else if (z.total > c.target) {
        A.play('wrong'); z.mistake = true;
        floatText(b.x, b.y - 50, 'Za dużo! Spróbuj jeszcze raz', '#e0567a', 22);
        z.total = 0; z.bubbles.forEach(x => { x.alive = true; x.cool = 0.8; });
      }
    } else if (c.kind === 'set') {
      if (c.good(b.label)) {
        b.alive = false; b.pop = 1; A.play('pop'); z.goodLeft--;
        floatText(b.x, b.y - 24, 'Tak!', '#2fb34a', 22);
        if (z.goodLeft <= 0) challengeDone(z);
      } else {
        b.cool = 1.2; A.play('wrong'); z.mistake = true;
        floatText(b.x, b.y - 30, c.whyBad(b.label), '#e0567a', 20);
      }
    } else if (c.kind === 'order') {
      if (b.label === c.sorted[z.next]) {
        b.alive = false; b.pop = 1; A.play('pop'); z.next++;
        floatText(b.x, b.y - 24, z.next + '.', '#2fb34a', 24);
        if (z.next >= c.sorted.length) challengeDone(z);
      } else {
        b.cool = 1.2; A.play('wrong'); z.mistake = true;
        floatText(b.x, b.y - 30, 'Najpierw ' + c.sorted[z.next] + '!', '#e0567a', 22);
      }
    }
  }
  function challengeDone(z) {
    z.state = 'done'; z.doneT = 0;
    A.play('correct'); confetti(z.chest.x + 22, z.chest.y, 40);
    mathResult(z.c.topic, !z.mistake);
    toast(z.mistake ? 'Skrzynia otwarta! (monety tylko bez pomyłek)' : 'Brawo! Skrzynia otwarta!', 1.8);
    z.chest.open = 0.01;
    setTimeout(() => {
      if (!G) return;
      // coins only if there was no mistake; the star is always given for finishing it
      if (!z.mistake) for (let i = 0; i < Math.round(6 * G.rew); i++) popCoin(z.chest.x + 22, z.chest.y, true);
      if (!G.stars[1] && !G.lvl.noStars) G.ents.push({ k: 'star', x: z.chest.x + 22, y: z.chest.y - 30, idx: 1, vy: -420, fly: true });
    }, 350);
  }

  /* ---------------- entities ---------------- */
  function updatePlatforms(dt) {
    for (const e of G.ents) {
      if (e.k !== 'plat') continue;
      const ox = e.x, oy = e.y;
      if (e.sub === 'moving' && e.lift) {
        // lift: waits 1.2s at the bottom and the top so it's easy to step on and off
        e.ph = (e.ph + dt) % 6.8;
        const q = e.ph, travel = 2.2, hold = 1.2;
        const s = q < hold ? 0 : q < hold + travel ? (1 - Math.cos(Math.PI * (q - hold) / travel)) / 2 : q < 2 * hold + travel ? 1 : 1 - (1 - Math.cos(Math.PI * (q - 2 * hold - travel) / travel)) / 2;
        e.x = U.lerp(e.x1, e.x2, s); e.y = U.lerp(e.y1, e.y2, s);
      } else if (e.sub === 'moving') {
        e.ph += dt * 0.9;
        const s = (1 - Math.cos(e.ph)) / 2;
        e.x = U.lerp(e.x1, e.x2, s); e.y = U.lerp(e.y1, e.y2, s);
      } else if (e.sub === 'cloud') {
        if (e.timer >= 0) { e.timer -= dt; if (e.timer < 0) { e.gone = 3; e.timer = -1; for (let i = 0; i < 8; i++) G.particles.push({ x: e.x + Math.random() * e.w, y: e.y, vx: (Math.random() - 0.5) * 60, vy: -20, life: 0.6, max: 0.6, size: 9, col: '#ffffff', grav: 0 }); } }
        if (e.gone > 0) e.gone -= dt;
      } else if (e.sub === 'falling') {
        if (e.timer >= 0 && !e.falling) { e.timer -= dt; e.shake = 1; if (e.timer < 0) e.falling = true; }
        if (e.falling) { e.vy += 1600 * dt; e.y += e.vy * dt; if (e.y > G.H * T + 300) { e.respawn = (e.respawn || 0) + dt; } }
        if (e.respawn > 1.2) { e.y = e.oy; e.vy = 0; e.falling = false; e.timer = -1; e.respawn = 0; e.shake = 0; }
      }
      e.dx = e.x - ox; e.dy = e.y - oy;
    }
  }

  function updateEntities(dt) {
    const p = G.player;
    const pc = { x: p.x + PW / 2, y: p.y + PH / 2 };
    const magnetR = Math.max(G.ab.magnet ? G.ab.magnet * T : 0, p.magnetT > 0 ? 5 * T : 0);
    let bannerSet = null;

    for (let i = G.ents.length - 1; i >= 0; i--) {
      const e = G.ents[i];
      // In the secret room (past the castle) the level's position-based
      // triggers must not fire: the room is further right than the goal.
      if (G.inRoom && (e.k === 'goal' || e.k === 'gate' || e.k === 'challenge' || e.k === 'checkpoint')) continue;
      switch (e.k) {
        case 'coin': {
          if (e.vy !== undefined) { e.vy += 1400 * dt; e.y += e.vy * dt; e.x += (e.vx || 0) * dt; e.life -= dt; if (e.life <= 0) { G.ents.splice(i, 1); break; } if (e.vy > 0 && e.life < 0.9 && !e.stay) { collectCoin(i, e); break; } }
          const dx = pc.x - e.x, dy = pc.y - e.y, d = Math.hypot(dx, dy);
          if (magnetR && d < magnetR && d > 1) { e.x += dx / d * 520 * dt; e.y += dy / d * 520 * dt; }
          else if (G.pet) {
            const pdx = G.pet.x - e.x, pdy = G.pet.y - e.y, pd = Math.hypot(pdx, pdy);
            if (pd < G.pet.reach) { if (pd < 16) { collectCoin(i, e); break; } e.x += pdx / pd * 480 * dt; e.y += pdy / pd * 480 * dt; }
          }
          if (Math.abs(dx) < PW / 2 + e.r && Math.abs(dy) < PH / 2 + e.r) collectCoin(i, e);
          break;
        }
        case 'star': {
          if (e.fly) { e.vy += 900 * dt; e.y += e.vy * dt; if (e.vy > 0) e.fly = false; }
          if (Math.abs(pc.x - e.x) < PW / 2 + 18 && Math.abs(pc.y - e.y) < PH / 2 + 18) {
            G.stars[e.idx] = true; G.ents.splice(i, 1); A.play('star');
            confetti(e.x, e.y, 25); toast('Gwiazdka ' + (G.stars.filter(Boolean).length) + ' z 3!', 1.6);
          }
          break;
        }
        case 'power': {
          if (e.born > 0) { e.born -= dt; e.y += e.vy * dt; break; }
          if (Math.abs(pc.x - e.x) < PW / 2 + 16 && Math.abs(pc.y - e.y) < PH / 2 + 16) { applyPower(e.kind); G.ents.splice(i, 1); }
          break;
        }
        case 'spring': case 'mushroom': {
          e.comp = Math.max(0, e.comp - dt * 4);
          // Launch even when the player just walks onto the pad. Kids (and
          // Mario habits) expect to run into a spring, not to jump on it
          // precisely; a pad that only works when landed on reads as broken.
          const feet = p.y + PH;
          if (p.vy >= 0 && pc.x > e.x + 4 && pc.x < e.x + e.w - 4 && feet >= e.y - 2 && feet <= e.y + e.h + 2 && e.comp < 0.5) {
            p.y = e.y - PH; p.vy = -(e.k === 'spring' ? P.spring : P.mushroom) * (LZ.In.jump ? 1.06 : 1);
            p.grounded = false; p.on = null; e.comp = 1; p.jumps = 1; p.squash = -0.45; p.padLaunch = true; A.play('spring');
          }
          break;
        }
        case 'checkpoint':
          if (!e.on && Math.abs(pc.x - e.x) < 30 && pc.y > e.y - 120) {
            e.on = true; G.checkpoint = { x: e.x - PW / 2, y: e.y - PH };
            A.play('checkpoint'); toast('Punkt kontrolny!', 1.5); confetti(e.x, e.y - 90, 15);
            S.save();
          }
          if (e.on) e.anim = Math.min(1, e.anim + dt * 2);
          break;
        case 'goal':
          if (G.state === 'play' && pc.x > e.x - 8) {
            G.state = 'goal'; G.goalT = 0; G.goalGround = e.y; p.vx = 0; p.x = e.x - PW / 2 + 4;
            A.play('flag'); setTimeout(() => A.play('win'), 900);   // slide-down glissando, then the fanfare
            confetti(e.x, e.y - 300, 40);
          }
          break;
        case 'gate': {
          const inZone = pc.x > e.zone[0] && pc.x < e.zone[1] + 60;
          if (inZone && !e.problem) setupGate(e);
          if (inZone && e.state === 'closed') bannerSet = { kind: 'gate', ref: e };
          if (e.state === 'opening') {
            e.open = Math.min(1, e.open + dt * 1.2);
            e.h = e.baseH * (1 - U.easeOutCubic(e.open));
            if (Math.random() < 0.5) G.particles.push({ x: e.x + Math.random() * e.w, y: e.baseH - 4, vx: (Math.random() - 0.5) * 60, vy: -100 - Math.random() * 80, life: 0.8, max: 0.8, size: 6, kind: 'rainbow', ci: Math.floor(Math.random() * 6), grav: 200 });
            if (e.open >= 1) e.state = 'open';
          }
          break;
        }
        case 'ans': e.bump = Math.max(0, e.bump - dt * 5); break;
        case 'cannon': {
          // fires a slow ball toward the player while on screen and not too close
          e.recoil = Math.max(0, e.recoil - dt * 4);
          const onScreen = e.x > G.cam.x - T && e.x < G.cam.x + viewW + T;
          const dxp = pc.x - (e.x + T / 2);
          e.face = dxp < 0 ? -1 : 1;
          e.fireT -= dt;
          if (onScreen && Math.abs(dxp) > 2.2 * T && e.fireT <= 0) {
            const young = G.prof.mathLevel <= 2;
            e.fireT = young ? 4.2 : 3.2;
            const b = spawnEnemy('ball', e.x, e.y + 34);
            b.x = e.face < 0 ? e.x - 26 : e.x + T - 4; b.y = e.y + 8; b.vx = e.face * (young ? 120 : 155);
            e.recoil = 1; A.play('cannon');
            for (let k = 0; k < 5; k++) G.particles.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, vx: e.face * Math.random() * 80, vy: -Math.random() * 60, life: 0.5, max: 0.5, size: 8, col: 'rgba(230,230,240,0.85)', grav: 0 });
          }
          break;
        }
        case 'stump': {
          // secret stump / room exit: stand still on top for a moment to go through
          if (!(e.secret || e.roomExit)) break;
          const on = p.grounded && Math.abs(p.vx) < 40 && pc.x > e.x + 8 && pc.x < e.x + e.w - 8 && Math.abs(p.y + PH - e.y) < 3;
          e.standT = on ? e.standT + dt : Math.max(0, e.standT - dt * 2);
          if (e.standT > 0.7 && G.state === 'play') startWarp(e);
          break;
        }
        case 'challenge': {
          const inZone = pc.x > e.zone[0] - 20 && pc.x < e.zone[1];
          if (inZone && e.state === 'idle') setupChallenge(e);
          if (e.state === 'active') {
            if (inZone) bannerSet = { kind: 'challenge', ref: e };
            for (const b of e.bubbles) {
              if (b.cool > 0) b.cool -= dt;
              b.x = b.ox + Math.sin(G.t * 1.3 + b.seed) * 6; b.y = b.oy + Math.sin(G.t * 2 + b.seed) * 5;
              if (b.alive && Math.abs(pc.x - b.x) < PW / 2 + 20 && Math.abs(pc.y - b.y) < PH / 2 + 20) collectBubble(e, b);
            }
            if (!inZone && pc.x > e.zone[1] + 40) { e.state = 'missed'; }
          }
          if (e.state === 'done') { e.doneT += dt; e.chest.open = Math.min(1, e.chest.open + dt * 3); if (inZone && e.doneT < 2.5) bannerSet = { kind: 'challenge', ref: e }; }
          e.bubbles.forEach(b => { if (b.pop > 0) b.pop -= dt * 3; });
          break;
        }
        default: if (G.sb) G.sb.updateEnt(G, e, i, dt, pc);
      }
    }
    if (G.boss && G.boss.phase === 'question') bannerSet = { kind: 'boss', ref: G.boss };
    G.banner = bannerSet;
  }

  function collectCoin(i, e) {
    G.ents.splice(i, 1);
    G.coins++; if (e.loose) G.looseGot++;
    if (e.wid && G.sb && G.sb.onCoin) G.sb.onCoin(G, e);   // the open world remembers collected coins
    if (!G.noCoins) { G.prof.coins++; G.prof.stats.totalCoins++; }
    A.play('coin');
    for (let k = 0; k < 4; k++) G.particles.push({ x: e.x, y: e.y, vx: (Math.random() - 0.5) * 120, vy: -Math.random() * 120, life: 0.35, max: 0.35, size: 3, kind: 'sparkle', rot: Math.random() * 3, grav: 0 });
  }
  function popCoin(x, y, spread) {
    G.ents.push({ k: 'coin', x, y: y - 10, r: 12, vy: -700 - Math.random() * 150, vx: spread ? (Math.random() - 0.5) * 300 : 0, life: 1.2, stay: !!spread });
  }
  function applyPower(kind) {
    const p = G.player;
    A.play(kind === 'heart' ? 'heart' : 'power');
    const names = { heart: 'Serduszko!', magnet: 'Magnes na monety!', shield: 'Tarcza!', boots: 'Superskok!', rainbow: 'Tęczowa moc!' };
    toast(names[kind], 1.4);
    if (kind === 'heart') G.hearts = Math.min(G.maxHearts, G.hearts + 1);
    if (kind === 'magnet') p.magnetT = 14;
    if (kind === 'shield') p.shield = true;
    if (kind === 'boots') p.bootsT = 14;
    if (kind === 'rainbow') p.rainbowT = 9;
  }

  /* ---------------- enemies ---------------- */
  function updateEnemies(dt) {
    const p = G.player;
    const camL = G.cam.x - 300, camR = G.cam.x + viewW + 300;
    for (let i = G.enemies.length - 1; i >= 0; i--) {
      const e = G.enemies[i];
      if (e.dead) { e.deadT += dt; e.vy += 1800 * dt; e.y += e.vy * dt; if (e.deadT > 1.2) G.enemies.splice(i, 1); continue; }
      if (e.x + e.w < camL || e.x > camR) continue;   // sleep off-screen
      e.t += dt;
      const young = G.prof.mathLevel <= 2;   // gentler enemies/bosses on the easier levels
      const spd = (young ? 0.8 : 1) * G.speedMul;   // night levels: enemies 15% faster
      switch (e.type) {
        case 'slime': case 'shroom': case 'hedgehog': case 'snowball': case 'robot': case 'alien': case 'scorpion': case 'cactus': {
          const sp = (e.type === 'snowball' ? 115 : e.type === 'hedgehog' ? 55 : e.type === 'robot' ? 80 : e.type === 'scorpion' ? 75 : e.type === 'cactus' ? 0 : 65) * spd;   // a cactus stands still: spiky AND walking was too much for a 7-year-old
          e.vx = e.dir * sp;
          e.vy = Math.min(e.vy + P.grav * dt, P.maxFall);
          e.hitWall = 0;
          moveX(e, e.vx * dt);
          const prevB = e.y + e.h;
          e.grounded = false;
          moveY(e, e.vy * dt, prevB);
          if (e.hitWall) e.dir = -e.hitWall;
          // turn around at ledges so enemies stay on their platform
          if (e.grounded) {
            const fx = e.dir > 0 ? e.x + e.w + 2 : e.x - 2;
            const below = tileAt(Math.floor(fx / T), Math.floor((e.y + e.h + 4) / T));
            if (!isSolid(below) && below !== '-') e.dir = -e.dir;
          }
          if (e.type === 'snowball') e.roll += e.vx * dt / 18;
          if (e.y > G.H * T + 100) e.dead = true;
          break;
        }
        case 'bee': case 'cloudy': case 'fish': case 'bat': case 'ufo': case 'vulture': {
          const range = e.type === 'fish' ? 4 * T : 3 * T;
          const sp = (e.type === 'bat' ? 95 : 70) * spd;
          e.x += e.dir * sp * dt;
          if (e.x > e.ox + range) e.dir = -1; if (e.x < e.ox - range) e.dir = 1;
          e.y = e.oy + Math.sin(e.t * (e.type === 'bat' ? 3 : 2)) * (e.type === 'bat' ? 40 : 18);
          break;
        }
        case 'jelly': e.y = e.oy - 30 + Math.sin(e.t * 1.5) * 50; break;
        // floating creatures (tower.js uses them most)
        case 'ghost': {
          /*
           * Drifts back and forth; when she's on its level it floats towards her,
           * but like a shy ghost it freezes and hides its eyes while she looks at it.
           * So the trick is to face it - or hop on its head.
           */
          const near = Math.abs(p.y + PH / 2 - (e.y + e.h / 2)) < 2.5 * T && Math.abs(p.x - e.x) < 7 * T;
          const looking = (p.facing > 0) === (e.x + e.w / 2 > p.x + PW / 2);
          e.shy = near && looking;
          if (near && !e.shy) e.dir = p.x < e.x ? -1 : 1;
          if (!e.shy) e.x += e.dir * (near ? 50 : 60) * spd * dt;
          if (e.x > e.ox + 4 * T) { e.x = e.ox + 4 * T; e.dir = -1; }
          if (e.x < e.ox - 4 * T) { e.x = e.ox - 4 * T; e.dir = 1; }
          e.y = e.oy + Math.sin(e.t * 1.6) * 16;
          break;
        }
        // a balloon creature bobbing up and down: popping it throws her high, so it doubles as a step up
        case 'balloon': e.y = e.oy - 50 + Math.sin(e.t * 1.1) * 55; e.x = e.ox + Math.sin(e.t * 0.7) * 14; break;
        // a spiky spark circling a point: it can't be stomped, only avoided
        case 'wisp': {
          const a = e.t * 1.7 * (e.seed > 5 ? 1 : -1);
          e.x = e.ox + Math.cos(a) * 1.4 * T; e.y = e.oy + Math.sin(a) * 1.1 * T; e.dir = Math.sin(a) * (e.seed > 5 ? -1 : 1) > 0 ? 1 : -1;
          break;
        }
        case 'plant': {
          /*
           * Snapping plant in a stump: hides, rises 0.5s, stays up 1.4s, sinks
           * 0.5s. Like in Mario it will NOT come out while the player stands
           * right next to or on its stump - so there's always a safe way over.
           */
          const period = young ? 5.2 : 4.6, hideT = young ? 2.8 : 2.2;
          const near = Math.abs(p.x + PW / 2 - (e.x + e.w / 2)) < 1.9 * T && p.y + PH > e.stumpTop - 3 * T;
          e.cycle += dt;
          let c = e.cycle % period;
          if (near && c > hideT - 0.05 && c < hideT) { e.cycle -= dt; c = e.cycle % period; }   // stay hidden while she's close
          e.up = c < hideT ? 0 : c < hideT + 0.5 ? (c - hideT) / 0.5 : c < hideT + 1.9 ? 1 : c < hideT + 2.4 ? 1 - (c - hideT - 1.9) / 0.5 : 0;
          e.y = e.stumpTop - e.h * e.up + 4;
          e.dir = p.x < e.x ? -1 : 1;
          break;
        }
        case 'ball': {
          // cannonball: flies straight, vanishes in a puff at a wall or far off screen
          e.x += e.vx * dt; e.dir = e.vx < 0 ? -1 : 1;
          const fx = e.vx < 0 ? e.x : e.x + e.w;
          if (isSolid(tileAt(Math.floor(fx / T), Math.floor((e.y + e.h / 2) / T))) || e.x < G.cam.x - 400 || e.x > G.cam.x + viewW + 400) {
            e.dead = true; e.deadT = 1.2;
            for (let k = 0; k < 6; k++) G.particles.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, vx: (Math.random() - 0.5) * 120, vy: -Math.random() * 80, life: 0.4, max: 0.4, size: 7, col: 'rgba(200,200,210,0.8)', grav: 0 });
          }
          break;
        }
        case 'urchin': break;
        case 'firejelly': {
          e.jt -= dt;
          if (e.jt <= 0 && e.y >= e.restY) { e.vy = -(820 + Math.random() * 160); e.jt = 2.4 + Math.random() * 1.5; }
          if (e.y < e.restY || e.vy < 0) { e.vy += 1500 * dt; e.y += e.vy * dt; if (e.y >= e.restY) { e.y = e.restY; e.vy = 0; } }
          e.dir = e.vy < 0 ? 1 : -1;
          break;
        }
      }
      // player contact
      if (G.state !== 'play') continue;
      if (e.type === 'plant' && e.up < 0.35) continue;   // mostly hidden in its stump: harmless
      const hb = e.type === 'plant' ? { x: e.x + 6, y: e.y + 2, w: e.w - 12, h: Math.max(4, e.stumpTop - e.y - 2) } : { x: e.x + 4, y: e.y + 4, w: e.w - 8, h: e.h - 6 };
      if (U.overlap(p, hb)) {
        if (p.rainbowT > 0 && !e.giant) { killEnemy(e); continue; }
        const fromAbove = p.vy > 60 && (p.y + PH) - e.y < 22 + (e.giant ? 10 : 0);
        if (fromAbove && e.giant && e.hp > 1) {
          // a giant loses a heart and throws her high up
          e.hp--; e.hitT = 0.5; A.play('bosshit'); G.shake = 0.25; p.vy = -P.stomp * 1.5; p.jumps = 1; p.invuln = Math.max(p.invuln, 0.35);
          floatText(e.x + e.w / 2, e.y - 20, 'Jeszcze ' + e.hp + '!', '#ff6fae', 24);
          for (let k = 0; k < 10; k++) G.particles.push({ x: e.x + e.w / 2, y: e.y, vx: (Math.random() - 0.5) * 300, vy: -Math.random() * 200, life: 0.5, max: 0.5, size: 6, kind: 'stars', rot: 0, grav: 500 });
        } else if (fromAbove && e.stompable) {
          killEnemy(e, false, true);
          p.vy = (LZ.In.jump ? -P.stomp * 1.35 : -P.stomp) * (G.ab.stomp || 1); p.jumps = 1; if (G.ab.stomp) p.padLaunch = true;
          if (e.type === 'balloon') { p.vy = -P.mushroom * (G.lowgrav ? 0.74 : 1); p.padLaunch = true; A.play('spring'); }   // pop! about two floors up
        } else if (p.invuln <= 0) {
          hurt(e.x + e.w / 2, e.type);
        }
      }
    }
  }
  function killEnemy(e, flip, stomp) {
    e.dead = true; e.vy = -420; e.deadT = 0; e.flip = true;
    A.play('stomp');
    G.prof.stats.stomps++; if (stomp) G.stompsRun++;
    for (let i = 0; i < 8; i++) G.particles.push({ x: e.x + e.w / 2, y: e.y + e.h / 2, vx: (Math.random() - 0.5) * 260, vy: -Math.random() * 200, life: 0.5, max: 0.5, size: 5, kind: 'stars', rot: Math.random() * 6, grav: 400 });
    if (stomp) floatText(e.x + e.w / 2, e.y - 10, 'Hop!', '#ff6fae', 22);
    popCoin(e.x + e.w / 2, e.y);
    if (G.sb && G.sb.onKill) G.sb.onKill(G, e, stomp);
  }

  function hurt(fromX, cause) {
    const p = G.player;
    if (p.invuln > 0 || G.state !== 'play' || G.ghost) return;   // ghost: riding a cart or a balloon
    G.damage = G.damage || {}; G.damage[cause || '?'] = (G.damage[cause || '?'] || 0) + 1;
    if (p.shield) { p.shield = false; p.invuln = 1.2; A.play('pop'); toast('Tarcza cię obroniła!', 1.2); return; }
    G.hearts--; G.hits++; A.play('hurt'); p.invuln = 1.6; p.hurtT = 0.25; G.shake = 0.25;
    p.vy = -420; p.vx = fromX != null ? (p.x + PW / 2 < fromX ? -260 : 260) : 0;
    if (G.hearts <= 0) outOfHearts();
  }
  function fallOut() {
    const p = G.player;
    G.damage = G.damage || {}; G.damage.pit = (G.damage.pit || 0) + 1;
    (G.pitAt = G.pitAt || {})[Math.floor(p.x / T)] = (G.pitAt[Math.floor(p.x / T)] || 0) + 1;   // where falls happen (for tests)
    G.hearts--; G.hits++; A.play('fall');   // long 'whistle down' for a pit instead of the ouch sound
    if (G.hearts <= 0) { outOfHearts(); return; }
    // a fall costs the way back: to the checkpoint flag, or the start if she hasn't reached it
    const soft = G.sb || LZ.Game.lenient;   // lenient: only for the automated test bot
    const s = soft ? (p.lastSafe || G.checkpoint) : G.checkpoint;
    p.x = s.x; p.y = s.y; p.vx = 0; p.vy = 0; p.invuln = 1.6; p.lastSafe = null;
    toast(soft ? 'Hopsa! Uważaj na dziury' : 'Hopsa! Wracasz do flagi', 1.4);
    G.state = 'respawn'; G.respawnT = 0.4;
  }
  /* No "game over": back to the last flag with full hearts. */
  function outOfHearts() {
    if (G.sb && G.sb.outOfHearts(G)) return;
    /*
     * Out of hearts in a level: it starts again from the beginning and the
     * coins picked up on this try are lost (they went into the piggy bank as
     * she collected them, so they come back out).
     */
    if (LZ.Game.lenient) {   // the test bot checks the levels play through: keep the old gentle rule for it
      const p = G.player; G.hearts = G.maxHearts;
      p.x = G.checkpoint.x; p.y = G.checkpoint.y; p.vx = 0; p.vy = 0; p.invuln = 2; p.lastSafe = null;
      G.projectiles = []; if (G.boss) { G.boss.phase = 'attack'; G.boss.phaseT = 0; }
      G.state = 'respawn'; G.respawnT = 0.6; return;
    }
    // (the restart itself waits for the next frame: we may be in the middle of the enemy loop)
    G.state = 'dead'; G.deadT = 1.0; G.projectiles = [];
    A.play('fall'); G.shake = 0.3;
  }
  function restartAfterDeath() {
    if (!G.noCoins && G.coins > 0) G.prof.coins = Math.max(0, G.prof.coins - G.coins);
    const lost = G.noCoins ? 0 : G.coins;
    S.save();
    start(G.wi, G.li, G.mode);
    toast(lost > 0 ? 'Koniec serduszek! Od początku - ' + lost + ' ' + U.plural(lost, 'moneta przepadła', 'monety przepadły', 'monet przepadło') + '.' : 'Koniec serduszek! Poziom od początku.', 3);
  }

  /* =================================================================
   * BOSS
   * ================================================================= */
  function setupBoss() {
    const b = G.lvl.boss;
    const young = G.prof.mathLevel <= 2;   // gentler enemies/bosses on the easier levels
    const hp = b.hp || Math.max(3, 3 + Math.floor(G.wi / 2) - (young ? 1 : 0)) + (G.kind === 'hard' ? 2 : G.kind === 'wboss' ? 3 : 0);
    const size = { slimeking: [130, 110], snowman: [120, 150], octopus: [130, 120], shroomlord: [140, 120], storm: [150, 100], chocodragon: [150, 150], gearbot: [140, 150], comet: [140, 130], sphinx: [128, 112], crystaldragon: [150, 130] }[b.kind];
    G.boss = {
      kind: b.kind, name: b.name, attack: b.attack, x: 19 * T, y: 11 * T - size[1], w: size[0], h: size[1],
      vx: 0, vy: 0, dir: -1, hp, maxHp: hp, phase: 'intro', phaseT: 0, flash: 0, atkT: 1, grounded: true,
      orbs: [], problem: null, wrong: 0, first: true, speed: young ? 0.75 : 1, look: 0,
    };
    if (b.kind === 'storm' || b.kind === 'octopus') G.boss.y = 3.2 * T;
    if (b.kind === 'crystaldragon') G.boss.y = 2.9 * T;
  }
  function updateBoss(dt) {
    const b = G.boss, p = G.player;
    b.phaseT += dt; b.flash = Math.max(0, b.flash - dt);
    b.look = U.clamp((p.x - (b.x + b.w / 2)) / 300, -1, 1);
    const floorY = 11 * T;
    if (b.phase === 'intro') { if (b.phaseT > 2.2) { b.phase = 'attack'; b.phaseT = 0; } return; }
    if (b.phase === 'defeat') return;

    const rage = b.speed * (1 + (b.maxHp - b.hp) * 0.1);
    const atkMul = b.phase === 'question' ? 0.5 : 1;
    b.atkT -= dt * rage * atkMul;

    switch (b.attack) {
      case 'shock': {
        b.vy += P.grav * 0.8 * dt; b.y += b.vy * dt; b.x += b.vx * dt;
        if (b.y + b.h >= floorY) {
          if (!b.grounded) { b.grounded = true; b.squash = 0.6; G.shake = 0.3; A.play('bump'); shockwaves(b); }
          b.y = floorY - b.h; b.vy = 0; b.vx = 0;
        }
        b.squash = (b.squash || 0) * Math.pow(0.02, dt);
        if (b.grounded && b.atkT <= 0) {
          // the Sphinx has 7 hearts (vs Glutek's 3), so it rests a bit longer between pounces
          b.grounded = false; b.vy = -820; b.atkT = b.kind === 'sphinx' ? 2.7 : 2.1;
          const target = U.clamp(p.x - b.w / 2, 3 * T, (G.W - 3) * T - b.w);
          b.vx = (target - b.x) / 1.0; b.dir = b.vx < 0 ? -1 : 1;
        }
        break;
      }
      case 'throw': case 'fire': {
        const home = 21 * T + Math.sin(G.t * 0.8) * 2 * T;
        b.x += (home - b.x) * dt * 2; b.dir = p.x < b.x ? -1 : 1;
        if (b.atkT <= 0) {
          b.atkT = b.attack === 'fire' ? 1.3 : 1.5;
          const sx = b.x + b.w / 2, sy = b.y + 30;
          if (b.attack === 'throw' || Math.random() < 0.5) {
            const tx = p.x + PW / 2 + p.vx * 0.5, ty = p.y + PH / 2, ft = 1.15;
            const g = 900;
            G.projectiles.push({ kind: b.attack === 'fire' ? 'fireball' : b.kind === 'gearbot' ? 'gear' : 'snowball', x: sx, y: sy, vx: (tx - sx) / ft, vy: (ty - sy - 0.5 * g * ft * ft) / ft, g, r: 14, life: 4 });
          } else {
            G.projectiles.push({ kind: 'fireball', x: sx, y: floorY - 20, vx: -300 * rage, vy: 0, g: 0, r: 15, life: 5 });
          }
          A.play('throw');
        }
        break;
      }
      case 'bubbles': {
        b.x = 17 * T + Math.sin(G.t * 0.6) * 5 * T; b.y = 3.2 * T + Math.sin(G.t * 1.3) * 30; b.dir = p.x < b.x ? -1 : 1;
        if (b.atkT <= 0) { b.atkT = 1.7; G.projectiles.push({ kind: 'bubble', x: b.x + b.w / 2, y: b.y + b.h, vx: 0, vy: 60, g: 0, r: 16, life: 6, homing: 150 }); A.play('pop'); }
        break;
      }
      case 'rain': {
        b.x += b.dir * 60 * dt;
        if (b.x < 4 * T) b.dir = 1; if (b.x + b.w > (G.W - 4) * T) b.dir = -1;
        b.y = floorY - b.h;
        if (b.atkT <= 0) {
          b.atkT = 0.8;
          const x = U.clamp(p.x + (Math.random() - 0.5) * 6 * T, 3 * T, (G.W - 3) * T);
          G.projectiles.push({ kind: b.kind === 'comet' ? 'meteor' : 'spore', x, y: -20, vx: 0, vy: b.kind === 'comet' ? 150 : 170, g: 0, r: 13, life: 6 });
        }
        break;
      }
      case 'crystal': {
        // the Crystal Dragon of the lair: hovers, throws crystal shards at her
        // and every other time lets a few fall from the ceiling around her
        b.x = 13 * T + Math.sin(G.t * 0.55) * 6 * T; b.y = 2.9 * T + Math.sin(G.t * 1.2) * 16; b.dir = p.x < b.x + b.w / 2 ? -1 : 1;
        if (b.atkT <= 0) {
          b.atkT = 1.6; b.alt = !b.alt;
          if (b.alt) {
            const sx = b.x + b.w / 2, sy = b.y + b.h * 0.6, tx = p.x + PW / 2 + p.vx * 0.4, ty = p.y + PH / 2, ft = 1.2, g = 800;
            G.projectiles.push({ kind: 'shard', x: sx, y: sy, vx: (tx - sx) / ft, vy: (ty - sy - 0.5 * g * ft * ft) / ft, g, r: 14, life: 4 });
            A.play('throw');
          } else {
            for (let k = -1; k <= 1; k++) G.projectiles.push({ kind: 'shard', x: U.clamp(p.x + PW / 2 + k * 2.6 * T, 3 * T, (G.W - 3) * T), y: -20 - Math.abs(k) * 60, vx: 0, vy: 190, g: 0, r: 13, life: 6 });
            A.play('pop');
          }
        }
        break;
      }
      case 'lightning': {
        b.x = 12 * T + Math.sin(G.t * 0.7) * 7 * T; b.y = 3 * T; b.dir = p.x < b.x ? -1 : 1;
        if (b.atkT <= 0) {
          b.atkT = 1.9;
          G.projectiles.push({ kind: 'bolt', x: p.x + PW / 2 + (Math.random() - 0.5) * T, y: 0, vx: 0, vy: 0, g: 0, r: 26, life: 1.3, warn: 0.95 });
        }
        break;
      }
    }

    // time to ask a question?
    if (b.phase === 'attack' && b.phaseT > 5) {
      b.phase = 'question'; b.phaseT = 0; b.wrong = 0; b.first = true;
      b.problem = M.question(G.prof.skill, S.mathBand(G.prof));
      const ch = b.problem.choices;
      const spots = ch.length === 2 ? [G.lvl.boss.orbs[0], G.lvl.boss.orbs[2]] : G.lvl.boss.orbs;
      b.orbs = ch.map((label, i) => ({ x: spots[i][0] * T, y: spots[i][1] * T, label, correct: label === b.problem.a, alive: true, hint: false, pop: 0 }));
      LZ.Speech.say(b.problem.q);
      A.play('power');
    }
    if (b.phase === 'question') {
      for (const o of b.orbs) {
        if (o.pop > 0) o.pop -= dt * 3;
        if (!o.alive) continue;
        if (Math.abs(p.x + PW / 2 - o.x) < PW / 2 + 24 && Math.abs(p.y + PH / 2 - o.y) < PH / 2 + 24) {
          if (o.correct) {
            A.play('correct'); if (b.first) mathResult(b.problem.topic, true);
            b.orbs.forEach(x => { x.alive = false; x.pop = 1; });
            G.projectiles.push({ kind: 'magic', x: o.x, y: o.y, vx: 0, vy: 0, g: 0, r: 16, life: 3, target: true });
            if (b.first) for (let i = 0; i < Math.round(3 * G.rew); i++) setTimeout(() => G && popCoin(o.x, o.y), i * 70);   // coins only for a first-try answer
            b.phase = 'hitwait'; b.phaseT = 0;
            floatText(o.x, o.y - 30, 'Brawo!', '#2fb34a', 30);
          } else {
            A.play('wrong'); o.alive = false; o.pop = 1; b.wrong++;
            if (b.first) { mathResult(b.problem.topic, false); b.first = false; }
            floatText(o.x, o.y - 30, 'Nie tym razem!', '#e0567a', 24);
            if (b.wrong >= 2 || b.orbs.filter(x => x.alive && !x.correct).length === 0) b.orbs.forEach(x => { if (x.correct) x.hint = true; });
          }
        }
      }
    }
    // body contact
    if (G.state === 'play' && b.phase !== 'defeat') {
      const hb = { x: b.x + 12, y: b.y + 14, w: b.w - 24, h: b.h - 14 };
      if (U.overlap(p, hb)) {
        if (p.vy > 50 && p.y + PH - hb.y < 30) { p.vy = -700; floatText(p.x, p.y - 20, 'Hi hi, łaskocze!', '#7a5ce6', 20); A.play('spring'); }
        else if (p.invuln <= 0) hurt(b.x + b.w / 2, 'boss');
      }
    }
  }
  function shockwaves(b) {
    const y = 11 * T - 18;
    [-1, 1].forEach(d => G.projectiles.push({ kind: 'wave', x: b.x + b.w / 2 + d * b.w / 2, y, vx: d * 270 * b.speed, vy: 0, g: 0, r: 16, life: 3.5 }));
  }
  function bossHit() {
    const b = G.boss;
    b.hp--; b.flash = 0.9; A.play('bosshit'); G.shake = 0.4;
    confetti(b.x + b.w / 2, b.y + b.h / 2, 30);
    if (b.hp <= 0) {
      b.phase = 'defeat'; G.state = 'bossdefeat'; G.defeatT = 0; G.projectiles = [];
      A.play('win'); toast(b.name + ' pokonany! Hurra!', 3);
    } else { b.phase = 'attack'; b.phaseT = 0; b.atkT = 1.2; toast('Jeszcze ' + b.hp + '!', 1.2); }
  }

  function updateProjectiles(dt) {
    const p = G.player;
    for (let i = G.projectiles.length - 1; i >= 0; i--) {
      const q = G.projectiles[i];
      q.life -= dt;
      if (q.kind === 'magic') {
        // the "magic star" flies from the orb into the boss
        const b = G.boss, tx = b.x + b.w / 2, ty = b.y + b.h / 2;
        const dx = tx - q.x, dy = ty - q.y, d = Math.hypot(dx, dy);
        q.x += dx / d * 700 * dt; q.y += dy / d * 700 * dt;
        G.particles.push({ x: q.x, y: q.y, vx: 0, vy: 0, life: 0.4, max: 0.4, size: 6, kind: 'rainbow', ci: Math.floor(G.t * 30), grav: 0 });
        if (d < 30) { G.projectiles.splice(i, 1); bossHit(); return; }  // bossHit may clear the list - stop iterating
        continue;
      }
      if (q.warn > 0) { q.warn -= dt; continue; }
      if (q.homing) { const dx = p.x + PW / 2 - q.x, dy = p.y + PH / 2 - q.y, d = Math.hypot(dx, dy) || 1; q.vx += dx / d * q.homing * dt; q.vy += dy / d * q.homing * dt; const s = Math.hypot(q.vx, q.vy); if (s > 150) { q.vx *= 150 / s; q.vy *= 150 / s; } }
      q.vy += (q.g || 0) * dt; q.x += q.vx * dt; q.y += q.vy * dt;
      if ((q.kind === 'spore' || q.kind === 'meteor' || q.kind === 'shard') && q.y > 11 * T - 12) q.life = 0;
      if ((q.kind === 'snowball' || q.kind === 'fireball' || q.kind === 'gear') && q.y > 11 * T - q.r) { q.y = 11 * T - q.r; if (q.kind !== 'fireball') q.life = Math.min(q.life, 0.05); }
      if (q.x < 2 * T - 20 || q.x > (G.W - 2) * T + 20) q.life = 0;
      let hit = false;
      if (q.kind === 'bolt') hit = Math.abs(p.x + PW / 2 - q.x) < q.r && q.life > 0 && q.life < 0.35;
      else hit = Math.abs(p.x + PW / 2 - q.x) < PW / 2 + q.r * 0.7 && Math.abs(p.y + PH / 2 - q.y) < PH / 2 + q.r * 0.7;
      if (hit && G.state === 'play' && p.invuln <= 0) {
        const list = G.projectiles;
        hurt(q.x, 'shot-' + q.kind); if (q.kind !== 'bolt' && q.kind !== 'wave') q.life = 0;
        if (G.projectiles !== list) return;   // running out of hearts clears the list - stop iterating it
      }
      if (q.life <= 0) G.projectiles.splice(i, 1);
    }
  }

  /* =================================================================
   * FINISH
   * ================================================================= */
  function finish(win) {
    G.finished = true;
    const prof = G.prof, key = S.levelKey(G.wi, G.li);
    const secs = Math.round(G.clock);
    const run = { time: G.clock, par: G.par, hits: G.hits, looseTotal: G.looseTotal, looseGot: G.looseGot, coins: G.coins, mathOk: G.mathOk, mathTotal: G.mathTotal, stomps: G.stompsRun };
    const res = { kind: G.kind, mode: G.mode, bonus: 0, rew: G.rew, bandName: S.mathBand(prof).name, wi: G.wi, li: G.li, coins: G.coins, stars: G.stars.slice(),
      mathOk: G.mathOk, mathTotal: G.mathTotal, time: secs, par: G.par, firstClear: false, badges: [], newChars: [], boss: !!G.lvl.boss, worldName: G.lvl.world.name,
      loose: [G.looseGot, G.looseTotal], hits: G.hits };
    const ownedBefore = prof.owned.chars.slice();

    if (G.kind === 'normal') {
      const nightBefore = G.wi !== D.BONUS_ID && S.isHardUnlocked(prof, G.wi);
      res.firstClear = !prof.done[key];
      prof.done[key] = true;
      const prevStars = prof.stars[key] || [false, false, false];
      if (G.lvl.boss) G.stars = [true, true, true];
      res.stars = G.stars.slice();
      prof.stars[key] = prevStars.map((s, i) => s || G.stars[i]);
      prof.best[key] = Math.max(prof.best[key] || 0, G.coins);
      if (G.lvl.boss && !prof.bossWins.includes(G.wi)) { prof.bossWins.push(G.wi); res.newChars = S.grantBossUnlocks(prof); }
      // medals only on the ordinary levels (not the boss, not the bonus level)
      if (!G.lvl.boss && G.wi !== D.BONUS_ID) {
        const prev = (prof.medals = prof.medals || {})[key] || [false, false, false];
        const now = LZ.X.medalsFor(run);
        prof.medals[key] = prev.map((m, i) => m || now[i]);
        res.medals = { now, prev, all: prof.medals[key] };
      }
      if (G.wi !== D.BONUS_ID) res.nightOpened = !nightBefore && S.isHardUnlocked(prof, G.wi);
    } else if (G.kind === 'hard') {
      prof.hard.done[key] = true;
      if (G.lvl.boss && !prof.hard.boss.includes(G.wi)) prof.hard.boss.push(G.wi);
    } else if (G.kind === 'daily') {
      const info = G.mode.info, met = LZ.X.dailyGoalMet(info, G.dailyTarget, run);
      res.daily = { text: G.dailyTarget.text, met, reward: met ? LZ.X.dailyReward(prof, info) : null, already: prof.daily.last === info.key };
      prof.daily.played = info.key;
    } else if (G.kind === 'wboss' || G.kind === 'temple' || G.kind === 'weekly') {
      res.wboss = G.kind === 'temple' ? LZ.Temples.win(prof, G.mode) : G.kind === 'weekly' ? LZ.Weekly.win(prof, G.mode) : LZ.Bosses.win(prof, G.mode);   // rewards and what the results screen says
    } else if (G.kind === 'custom') {
      const lv = (S.data.custom || []).find(x => x.id === G.mode.id);
      if (G.mode.test && lv) { if (!lv.verified) { lv.verified = true; prof.stats.built = (prof.stats.built || 0) + 1; res.verifiedNow = true; } }
      else if (lv && lv.author !== prof.name) prof.stats.guest = (prof.stats.guest || 0) + 1;
    }
    LZ.Ext.each('game', 'finish', prof, G, run);   // e.g. the quest board counts finished levels (quests.js)
    res.badges = S.checkBadges(prof);
    // characters that came with a badge (the owl)
    D.CHARACTERS.forEach(c => { if (prof.owned.chars.includes(c.id) && !ownedBefore.includes(c.id) && !res.newChars.includes(c)) res.newChars.push(c); });
    S.save();
    // difficulty bonus: harder maths levels multiply what you collected
    if (!G.noCoins) {
      res.bonus = Math.round(G.coins * (G.rew - 1));
      if (res.bonus > 0) { prof.coins += res.bonus; prof.stats.totalCoins += res.bonus; res.badges = res.badges.concat(S.checkBadges(prof)); S.save(); }
    }
    setTimeout(() => LZ.UI.levelComplete(res), 300);
  }

  /*
   * Warp through a stump (Mario's pipe): sink in (0.7s), fade to black,
   * move to the destination, rise out / drop in, fade back.
   */
  function startWarp(st) {
    const p = G.player;
    let to;
    if (st.secret && G.room) to = { x: G.room.spawn.x, y: G.room.spawn.y, rise: false, room: true };
    else if (st.roomExit && G.secret && G.secret.exit) to = { x: G.secret.exit.x * T + T - PW / 2, y: G.secret.exit.y * T - PH, rise: true, room: false };
    if (!to) return;
    G.state = 'warp'; G.warp = { t: 0, from: st, to, x0: st.x + st.w / 2 - PW / 2, y0: st.y - PH };
    p.vx = 0; p.vy = 0; p.x = G.warp.x0; A.play('warp'); LZ.In.reset();
  }
  function updateWarp(dt) {
    const w = G.warp, p = G.player;
    w.t += dt;
    if (w.t < 0.7) { p.y = w.y0 + (w.t / 0.7) * PH; p.sink = w.from.y; }          // sinking into the stump
    else if (!w.moved && w.t >= 1.0) {
      w.moved = true; p.x = w.to.x; p.sink = null;
      if (w.to.rise) { p.y = w.to.y + PH; p.sink = w.to.y + PH; } else p.y = w.to.y;
      G.inRoom = w.to.room;
      G.cam.x = p.x - viewW * 0.4; G.cam.y = p.y - viewH * 0.55; clampCam();
      if (w.to.room) toast('Tajna kryjówka!', 1.8);
    } else if (w.moved && w.to.rise && w.t < 1.8) { p.y = w.to.y + PH * (1 - (w.t - 1.0) / 0.8); p.sink = w.to.y + PH; }
    if (w.t >= (w.to.rise ? 1.85 : 1.3)) {
      p.sink = null; if (w.to.rise) p.y = w.to.y;
      p.lastSafe = { x: p.x, y: p.y };
      if (!w.to.room) G.checkpoint = { x: p.x, y: p.y };   // after the secret, a fall doesn't send her all the way back
      G.state = 'play'; G.warp = null;
    }
    p.state = 'idle';
  }
  // fade overlay value 0..1 during a warp
  function warpFade() {
    const w = G && G.warp; if (!w) return 0;
    if (w.t < 0.7) return 0; if (w.t < 1.0) return (w.t - 0.7) / 0.3; if (w.t < 1.3) return 1 - (w.t - 1.0) / 0.3; return 0;
  }

  function quit() { if (G) { S.save(); if (G.sb && G.sb.quit) G.sb.quit(G); } G = null; LZ.Speech.stop(); }
  function restart() { if (G) start(G.wi, G.li, G.mode); }

  /* =================================================================
   * EFFECTS
   * ================================================================= */
  function dust(x, y, n) { for (let i = 0; i < n; i++) G.particles.push({ x, y, vx: (Math.random() - 0.5) * 140, vy: -Math.random() * 60, life: 0.4, max: 0.4, size: 5, col: 'rgba(255,255,255,0.8)', grav: 0 }); }
  function confetti(x, y, n) {
    for (let i = 0; i < n; i++) G.particles.push({ x, y, vx: (Math.random() - 0.5) * 520, vy: -Math.random() * 520 - 100, life: 1.4, max: 1.4, size: 5, kind: 'confetti', ci: i, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12, grav: 900 });
  }
  function floatText(x, y, text, col, size) { G.texts.push({ x, y, text, col, size: size || 24, life: 1.4, max: 1.4 }); }
  function toast(text, life) { if (!G) return; G.toasts = [{ text, life: life || 1.5, max: life || 1.5 }]; }
  function updateParticles(dt) {
    for (let i = G.particles.length - 1; i >= 0; i--) {
      const q = G.particles[i];
      q.life -= dt; if (q.life <= 0) { G.particles.splice(i, 1); continue; }
      q.vy += (q.grav || 0) * dt; q.x += q.vx * dt; q.y += q.vy * dt; if (q.vr) q.rot += q.vr * dt;
    }
    if (G.particles.length > 500) G.particles.splice(0, G.particles.length - 500);
    for (let i = G.texts.length - 1; i >= 0; i--) { const t = G.texts[i]; t.life -= dt; t.y -= 40 * dt; if (t.life <= 0) G.texts.splice(i, 1); }
    for (let i = G.toasts.length - 1; i >= 0; i--) { G.toasts[i].life -= dt; if (G.toasts[i].life <= 0) G.toasts.splice(i, 1); }
    G.shake = Math.max(0, G.shake - dt);
  }

  /* =================================================================
   * CAMERA
   * ================================================================= */
  function updateCamera(dt) {
    const p = G.player;
    const tx = p.x + PW / 2 - viewW * 0.4 + p.facing * 40;
    const ty = p.y + PH / 2 - viewH * 0.55;
    G.cam.x += (tx - G.cam.x) * Math.min(1, dt * 6);
    G.cam.y += (ty - G.cam.y) * Math.min(1, dt * 4);
    clampCam();
  }
  function clampCam() {
    const lw = G.W * T, lh = G.H * T;
    // the secret room lives past the castle: the camera never shows it from the
    // main level, and inside the room it only shows the room
    let lo = 0, hi = lw;
    if (G.room) { if (G.inRoom) { lo = G.room.x0; hi = G.room.x1; } else hi = G.room.x0 - 6 * T; }
    if (hi - lo <= viewW) G.cam.x = lo + (hi - lo - viewW) / 2;
    else G.cam.x = U.clamp(G.cam.x, lo, hi - viewW);
    G.cam.y = U.clamp(G.cam.y, 0, Math.max(0, lh - viewH));
  }

  /* =================================================================
   * RENDER
   * ================================================================= */
  function resize(cssW, cssH) {
    /*
     * The camera shows a fixed number of tiles vertically, so how much you
     * see sideways depends on the screen shape. A 4:3 tablet would only
     * show ~15 tiles ahead, which feels cramped, so on squarer screens we
     * show more rows (up to the full level height of 14) to keep at least
     * ~20 tiles of width. Phones (~2:1) and laptops (16:9) stay at 11.5.
     */
    const aspect = cssW / cssH;
    viewH = U.clamp(Math.max(VIEW_TILES_H, 20 / aspect), VIEW_TILES_H, 14) * T;
    scale = cssH / viewH;
    viewW = cssW / scale;
    LZ.Art.clearCaches();
  }

  function render(ctx, dpr) {
    if (!G) return;
    const t = G.t, world = G.lvl.world;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    if (G.sb) G.sb.drawBack(ctx, G, G.cam, viewW, viewH, t);
    else if (G.inRoom || G.lvl.cave) Art.drawCave(ctx, world, G.cam.x, viewW, viewH, t);
    else Art.drawBackground(ctx, world, G.cam.x, G.cam.y, viewW, viewH, t);

    const sx = G.shake > 0 ? (Math.random() - 0.5) * 8 : 0, sy = G.shake > 0 ? (Math.random() - 0.5) * 8 : 0;
    ctx.save();
    ctx.translate(-Math.round(G.cam.x * scale * dpr) / (scale * dpr) + sx, -Math.round(G.cam.y * scale * dpr) / (scale * dpr) + sy);

    const x0 = Math.max(0, Math.floor(G.cam.x / T) - 1), x1 = Math.min(G.W - 1, Math.ceil((G.cam.x + viewW) / T) + 1);
    const y0 = Math.max(0, Math.floor(G.cam.y / T)), y1 = Math.min(G.H - 1, Math.ceil((G.cam.y + viewH) / T));

    // decorations behind everything
    for (const e of G.ents) if (e.k === 'castle' && e.x > G.cam.x - 400 && e.x < G.cam.x + viewW + 100) drawCastle(ctx, e, world);
    for (const e of G.ents) if (e.k === 'wind' && e.x < G.cam.x + viewW && e.x + e.w > G.cam.x) drawWind(ctx, e, t);

    // tiles
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const c = G.grid[x][y];
        if (c === '.' || c === 'L' || c === 'T' || c === 'C' || c === 'Q' || c === 'W') continue;   // stumps and cannons are drawn as entities, quicksand/water in front of the player
        if (c === 'H') { Art.drawVine(ctx, x * T, y * T, t, tileAt(x, y - 1) !== 'H'); continue; }
        if (c === '?') { Art.drawQBlock(ctx, x * T, y * T, t + x * 0.3, G.bumps[x + ',' + y] || 0); continue; }
        // the open world changes scenery along the way: each tile uses the look of its own place
        const tw = G.sb && G.sb.worldAt ? G.sb.worldAt(G, x, y) : world;
        if (c === '>' || c === '<') { Art.drawConveyor(ctx, x * T, y * T, c === '>' ? 1 : -1, t, tw, tileAt(x - 1, y) !== c, tileAt(x + 1, y) !== c); continue; }
        const bump = G.bumps[x + ',' + y] || 0;
        const img = Art.getTile(tw, c, (c === '#' || c === 'I') ? G.mask[x][y] : 0);
        ctx.drawImage(img, x * T - 0.3, y * T - 0.3 - bump * 8, T + 0.6, T + 0.6);
      }
    }

    // entities
    for (const e of G.ents) drawEntity(ctx, e, t, world);
    for (const e of G.enemies) {
      if (e.x + e.w < G.cam.x - 50 || e.x > G.cam.x + viewW + 50) continue;
      if (e.type === 'firejelly' && e.y >= e.restY - 2) continue;
      ctx.save();
      // a plant only shows above the rim of its stump, so it looks like it comes out of the hole
      if (e.type === 'plant' && !e.dead) { if (e.up <= 0.01) { ctx.restore(); continue; } ctx.beginPath(); ctx.rect(e.x - 60, e.stumpTop - 200, e.w + 120, 206); ctx.clip(); }
      if (e.dead) { ctx.translate(e.x + e.w / 2, e.y + e.h / 2); ctx.scale(1, -1); ctx.translate(-(e.x + e.w / 2), -(e.y + e.h / 2)); }
      if (e.giant) {
        // drawn at the normal size and scaled up around the feet
        const cx = e.x + e.w / 2, by = e.y + e.h;
        ctx.translate(cx, by); ctx.scale(e.giant, e.giant); ctx.translate(-cx, -by);
        if (e.hitT > 0) { e.hitT -= 1 / 60; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 40); }
        Art.drawEnemy(ctx, Object.assign({}, e, { x: cx - e.bw / 2, y: by - e.bh, w: e.bw, h: e.bh }), t, world);
      } else Art.drawEnemy(ctx, e, t, world);
      ctx.restore();
      if (e.giant && !e.dead) drawGiantBar(ctx, e, t);
    }
    if (G.boss) drawBossAll(ctx, t);
    if (G.pet) Art.drawPet(ctx, G.pet.id, G.pet.x, G.pet.y, t, G.pet.facing || 1);

    // player (blinks while invulnerable)
    const p = G.player;
    if (!(p.invuln > 0 && Math.floor(t * 14) % 2 === 0)) {
      const eq = G.prof.equip;
      // while warping, the part of the character below the stump rim is hidden
      if (p.sink != null) { ctx.save(); ctx.beginPath(); ctx.rect(p.x - 100, p.sink - 400, PW + 200, 400); ctx.clip(); }
      if (p.rainbowT > 0) { ctx.save(); ctx.shadowColor = 'hsl(' + (t * 400 % 360) + ',100%,60%)'; ctx.shadowBlur = 18; }
      // riding the pony (stable.js) she sits higher; the body she collides with stays on the ground
      Art.drawCharacter(ctx, p.x + PW / 2, p.y + PH + 1 - (G.riderLift || 0), { id: eq.char, variant: eq.variant, hat: eq.hat, gold: G.gold, facing: p.facing, t, state: p.hurtT > 0 ? 'hurt' : p.state, phase: p.phase, squash: p.squash, glide: p.glide });
      if (p.rainbowT > 0) ctx.restore();
      if (p.shield) { Art.ell(ctx, p.x + PW / 2, p.y + PH / 2 - 4, 34, 36); ctx.fillStyle = 'rgba(140,220,255,0.22)'; ctx.fill(); ctx.strokeStyle = 'rgba(90,190,255,0.8)'; ctx.lineWidth = 2.5; ctx.stroke(); }
      if (p.sink != null) ctx.restore();
    }

    // projectiles
    for (const q of G.projectiles) drawProjectile(ctx, q, t);
    if (G.sb) G.sb.drawFront(ctx, G, x0, x1, y0, y1, t);

    // quicksand in front of the player, so she looks knee-deep in it
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) if (G.grid[x][y] === 'Q') Art.drawQuicksand(ctx, x * T, y * T, t, tileAt(x - 1, y) !== 'Q', tileAt(x + 1, y) !== 'Q');

    // chocolate lava in front of things that fall into it
    let run = -1;
    if (!G.sb) for (let x = x0; x <= x1 + 1; x++) {
      let ly = -1;
      if (x <= x1) for (let y = 0; y < G.H; y++) if (G.grid[x][y] === 'L') { ly = y; break; }
      if (ly >= 0 && run < 0) run = x;
      if ((ly < 0 || x > x1) && run >= 0) { let yy = 0; for (let y = 0; y < G.H; y++) if (G.grid[run][y] === 'L') yy = y; Art.drawLava(ctx, run * T, yy * T, (x - run) * T, t, world); run = -1; }
    }

    // particles & floating texts
    for (const q of G.particles) {
      if (q.kind === 'debris') { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.globalAlpha = Math.min(1, q.life * 2); U.rr(ctx, -q.size / 2, -q.size / 2, q.size, q.size * 0.8, 3); Art.fs(ctx, q.col, U.shade(q.col, -0.35), 2); ctx.restore(); continue; }
      if (q.kind === 'confetti') { ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.globalAlpha = Math.min(1, q.life * 2); ctx.fillStyle = Art.RAINBOW[q.ci % 6]; ctx.fillRect(-5, -3, 10, 6); ctx.restore(); }
      else Art.drawTrailParticle(ctx, q);
    }
    ctx.globalAlpha = 1;
    for (const tx of G.texts) {
      ctx.globalAlpha = Math.min(1, tx.life / tx.max * 2);
      outlinedText(ctx, tx.text, tx.x, tx.y, tx.size, tx.col, '#fff');
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // warp fade-to-black
    const wf = warpFade();
    if (wf > 0) { ctx.fillStyle = 'rgba(20,10,40,' + wf + ')'; ctx.fillRect(0, 0, viewW, viewH); }
    drawHUD(ctx, t);
  }

  function outlinedText(ctx, text, x, y, size, fill, stroke, align) {
    ctx.font = '800 ' + size + 'px "Baloo 2", sans-serif';
    ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.22; ctx.strokeStyle = stroke; ctx.strokeText(text, x, y);
    ctx.fillStyle = fill; ctx.fillText(text, x, y);
  }

  function drawEntity(ctx, e, t, world) {
    const cull = e.k === 'landmark' || e.k === 'house' ? 520 : 200;   // the open world's statues and the house are wide
    if (e.x !== undefined && (e.x < G.cam.x - cull || e.x > G.cam.x + viewW + cull) && e.k !== 'gate' && e.k !== 'challenge' && e.k !== 'plat') return;
    switch (e.k) {
      case 'coin': Art.drawCoin(ctx, e.x, e.y, t + e.x * 0.01); break;
      case 'star': Art.drawStar(ctx, e.x, e.y + Math.sin(t * 3) * 4, 18, t); break;
      case 'power': Art.drawPowerup(ctx, e.kind, e.x, e.y, t); break;
      case 'spring': {
        const c = e.comp;
        const top = e.y + c * 12;
        ctx.strokeStyle = '#9aa3b5'; ctx.lineWidth = 4; ctx.beginPath();
        for (let i = 0; i <= 4; i++) { const yy = top + 8 + i * (e.h - 8 + (0 - c * 12)) / 4; ctx.lineTo(e.x + (i % 2 ? e.w - 6 : 6), yy); }
        ctx.stroke();
        U.rr(ctx, e.x - 2, top, e.w + 4, 10, 5); Art.fs(ctx, '#ff5e7e', '#a3223f', 2);
        U.rr(ctx, e.x, e.y + e.h - 6, e.w, 6, 3); Art.fs(ctx, '#6b7489');
        break;
      }
      case 'mushroom': {
        const c = e.comp;
        U.rr(ctx, e.x + e.w / 2 - 12, e.y + 16, 24, e.h - 16, 8); Art.fs(ctx, '#fff3e0', '#8a6a50', 2);
        ctx.beginPath(); ctx.ellipse(e.x + e.w / 2, e.y + 18 + c * 6, e.w / 2 + c * 6, 22 - c * 8, 0, Math.PI, 0); ctx.closePath();
        Art.fs(ctx, '#5ccfff', '#2a7fb0', 2.5);
        [[-18, 4], [2, -6], [18, 6]].forEach(([dx, dy]) => { Art.ell(ctx, e.x + e.w / 2 + dx, e.y + 14 + dy + c * 6, 5, 4); Art.fs(ctx, '#fff'); });
        break;
      }
      case 'plat': {
        if (e.sub === 'furn') break;   // the furniture itself is drawn, this is just its top surface
        if (e.sub === 'cloud') {
          if (e.gone > 0) { if (e.gone < 0.6) ctx.globalAlpha = 1 - e.gone / 0.6; else break; }
          const a = e.timer >= 0 ? 0.5 + 0.5 * (e.timer / 0.75) : 1;
          ctx.globalAlpha *= a;
          for (let i = 0; i < e.w / 20; i++) { Art.ell(ctx, e.x + 10 + i * 20, e.y + 8, 16, 12); Art.fs(ctx, '#ffffff'); }
          Art.ell(ctx, e.x + e.w / 2, e.y + 14, e.w / 2, 8); Art.fs(ctx, '#f0e6ff');
          ctx.globalAlpha = 1;
        } else {
          const shk = e.sub === 'falling' && e.timer >= 0 && !e.falling ? (Math.random() - 0.5) * 3 : 0;
          const col = e.sub === 'falling' ? '#ffcf70' : world.pal.block;
          U.rr(ctx, e.x + shk, e.y, e.w, e.h, 8); Art.fs(ctx, U.shade(col, -0.25));
          U.rr(ctx, e.x + shk, e.y, e.w, e.h - 5, 8); Art.fs(ctx, col);
          U.rr(ctx, e.x + 6 + shk, e.y + 3, e.w - 12, 3, 2); Art.fs(ctx, 'rgba(255,255,255,0.5)');
          if (e.sub === 'falling') { ctx.fillStyle = '#e0a53c'; for (let i = 12; i < e.w; i += 20) ctx.fillRect(e.x + i + shk, e.y + 4, 3, 8); }
        }
        break;
      }
      case 'checkpoint': {
        ctx.fillStyle = '#9aa3b5'; ctx.fillRect(e.x - 3, e.y - 110, 6, 110);
        Art.ell(ctx, e.x, e.y - 112, 7, 7); Art.fs(ctx, '#ffd23f', '#c99a12', 2);
        const fy = e.y - 100 + (1 - e.anim) * 70;
        ctx.beginPath(); ctx.moveTo(e.x + 3, fy); ctx.quadraticCurveTo(e.x + 25, fy + 6 + Math.sin(t * 5) * 4, e.x + 42, fy + 14); ctx.lineTo(e.x + 3, fy + 28); ctx.closePath();
        Art.fs(ctx, e.on ? '#7be08a' : '#ff85b0', e.on ? '#3a9a4a' : '#c4557f', 2);
        break;
      }
      case 'goal': {
        const top = e.y - 8 * T;
        ctx.fillStyle = '#e9edf5'; ctx.fillRect(e.x - 4, top, 8, 8 * T);
        ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(e.x + 1, top, 3, 8 * T);
        Art.ell(ctx, e.x, top - 6, 10, 10); Art.fs(ctx, '#ffd23f', '#c99a12', 2.5);
        const fy = top + 10 + e.flagY * (7 * T - 40);
        ctx.beginPath(); ctx.moveTo(e.x - 4, fy); ctx.lineTo(e.x - 60, fy + 20 + Math.sin(t * 6) * 3); ctx.lineTo(e.x - 4, fy + 40); ctx.closePath();
        Art.fs(ctx, '#ff5e7e', '#a3223f', 2);
        Art.starPath(ctx, e.x - 24, fy + 20, 8, 3.5, 5, 0); Art.fs(ctx, '#fff');
        U.rr(ctx, e.x - 16, e.y - 16, 32, 16, 4); Art.fs(ctx, world.pal.block, world.pal.blockDark, 2);
        break;
      }
      case 'gate': drawGate(ctx, e, t); drawBlockHints(ctx, e, t); break;
      case 'stump': {
        Art.drawStump(ctx, e, G.lvl.world, t);
        if (e.secret || e.roomExit) {
          // bobbing "go down here" arrow and a ring that fills while she stands still
          const cx = e.x + e.w / 2, bob = Math.abs(Math.sin(t * 4)) * 10;
          ctx.save(); ctx.translate(cx, e.y - 70 - bob); ctx.rotate(Math.PI);
          ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(16, 4); ctx.lineTo(6, 4); ctx.lineTo(6, 16); ctx.lineTo(-6, 16); ctx.lineTo(-6, 4); ctx.lineTo(-16, 4); ctx.closePath();
          Art.fs(ctx, '#ffe066', '#c47a00', 2.5); ctx.restore();
          if (e.standT > 0.05) { ctx.beginPath(); ctx.arc(cx, e.y - 110, 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, e.standT / 0.7)); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6; ctx.stroke(); }
        }
        break;
      }
      case 'cannon': Art.drawCannon(ctx, e, t); break;
      case 'sign': {
        // wooden signpost with a big arrow: "go this way" (or "go down" before a secret stump)
        ctx.fillStyle = '#9a6a3a'; ctx.fillRect(e.x - 4, e.y - 70, 8, 70);
        U.rr(ctx, e.x - 34, e.y - 96, 68, 40, 8); Art.fs(ctx, '#d9a066', '#8a5a2a', 2.5);
        if (e.down) { ctx.save(); ctx.translate(e.x, e.y - 76); ctx.rotate(Math.PI / 2); ctx.translate(-e.x, -(e.y - 76)); }
        ctx.beginPath(); ctx.moveTo(e.x - 20, e.y - 82); ctx.lineTo(e.x + 6, e.y - 82); ctx.lineTo(e.x + 6, e.y - 90); ctx.lineTo(e.x + 22, e.y - 76); ctx.lineTo(e.x + 6, e.y - 62); ctx.lineTo(e.x + 6, e.y - 70); ctx.lineTo(e.x - 20, e.y - 70); ctx.closePath();
        Art.fs(ctx, '#ffffff', '#5a3a1a', 2);
        if (e.down) ctx.restore();
        break;
      }
      case 'ans': if (e.active || e.label) drawAnswerBlock(ctx, e, t); else { U.rr(ctx, e.x + 1, e.y + 1, T - 2, T - 2, 9); Art.fs(ctx, '#d6d0e8', '#9a92b5', 2); } break;
      case 'challenge': drawChallenge(ctx, e, t); break;
      default: if (G.sb) G.sb.drawEnt(ctx, e, t, G);
    }
  }

  function drawGate(ctx, e, t) {
    if (e.state === 'open') return;
    const h = e.h, y = e.baseH - h;
    ctx.save();
    ctx.beginPath(); ctx.rect(e.x - 6, 0, e.w + 12, e.baseH); ctx.clip();
    // a tall rainbow crystal wall
    for (let i = 0; i < Math.ceil(h / 24) + 1; i++) {
      const yy = y + i * 24;
      U.rr(ctx, e.x, yy, e.w, 22, 6);
      ctx.fillStyle = Art.RAINBOW[(i + Math.floor(t * 2)) % 6]; ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(e.x + 5, yy + 4, e.w - 10, 4);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.strokeRect(e.x, y, e.w, h);
    // lock with a question mark at eye level
    const ly = e.baseH - 2 * T - (e.baseH - h) * 0;
    if (h > 2 * T) {
      Art.ell(ctx, e.x + e.w / 2, y + h - 2 * T + 10, 22, 22); Art.fs(ctx, '#ffffff', '#7a5ce6', 3);
      outlinedText(ctx, '?', e.x + e.w / 2, y + h - 2 * T + 12, 30, '#7a5ce6', '#fff');
    }
    ctx.restore();
  }
  /*
   * Bouncing up-arrows under the answer blocks: shows "jump into this from
   * below" without any reading. Always shown in world 1 and for Poziom 1
   * players; older players only see them after a first mistake.
   */
  function drawBlockHints(ctx, gate, t) {
    if (gate.state !== 'closed' || !gate.problem) return;
    if (!(G.prof.mathLevel === 1 || G.wi === 1 || gate.wrong > 0)) return;
    const bob = Math.abs(Math.sin(t * 5)) * 8;
    for (const b of gate.blocks) {
      if (!b.active || b.bad) continue;
      const x = b.x + T / 2, y = b.y + T + 22 + bob;
      ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.moveTo(x, y - 20); ctx.lineTo(x + 18, y); ctx.lineTo(x + 7, y); ctx.lineTo(x + 7, y + 18); ctx.lineTo(x - 7, y + 18); ctx.lineTo(x - 7, y); ctx.lineTo(x - 18, y); ctx.closePath();
      Art.fs(ctx, '#ffffff', '#7a5ce6', 2.5);
      ctx.globalAlpha = 1;
    }
  }
  function drawAnswerBlock(ctx, b, t) {
    const oy = -b.bump * 10;
    const col = b.good ? '#7be08a' : b.bad ? '#c9c4d6' : b.hint ? 'hsl(' + (t * 200 % 360) + ',80%,70%)' : '#9d7bff';
    const dark = b.good ? '#3a9a4a' : b.bad ? '#8f89a3' : '#5a3fbf';
    const sh = b.bad ? (Math.max(0, b.bump) * Math.sin(t * 60) * 4) : 0;
    ctx.save(); ctx.translate(sh, 0);
    if (b.hint) { ctx.shadowColor = '#fff6a0'; ctx.shadowBlur = 20; }
    U.rr(ctx, b.x + 1, b.y + 1 + oy, T - 2, T - 2, 10); Art.fs(ctx, dark);
    U.rr(ctx, b.x + 1, b.y + 1 + oy, T - 2, T - 6, 10); Art.fs(ctx, col);
    ctx.shadowBlur = 0;
    U.rr(ctx, b.x + 6, b.y + 5 + oy, T - 16, 5, 3); Art.fs(ctx, 'rgba(255,255,255,0.45)');
    const label = b.bad ? '✗' : b.label;
    let size = 26; ctx.font = '800 ' + size + 'px "Baloo 2", sans-serif';
    // expression answers ('13+5') may spill a little past the block edge - bigger text beats tiny text
    const maxW = /[+·:-]\d/.test(label) ? T + 14 : T - 8;
    while (ctx.measureText(label).width > maxW && size > 12) { size -= 2; ctx.font = '800 ' + size + 'px "Baloo 2", sans-serif'; }
    outlinedText(ctx, label, b.x + T / 2, b.y + T / 2 + 2 + oy, size, '#ffffff', dark);
    ctx.restore();
  }
  function drawChallenge(ctx, z, t) {
    // chest
    const c = z.chest;
    if (c.x > G.cam.x - 100 && c.x < G.cam.x + viewW + 100) {
      U.rr(ctx, c.x, c.y + 10, c.w, c.h - 10, 5); Art.fs(ctx, '#b8743a', '#6b3a18', 2.5);
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(c.x, c.y + 18, c.w, 4); ctx.fillRect(c.x + c.w / 2 - 3, c.y + 10, 6, c.h - 10);
      ctx.save(); ctx.translate(c.x, c.y + 12); ctx.rotate(-c.open * 1.2);
      U.rr(ctx, 0, -14, c.w, 16, 7); Art.fs(ctx, '#c98a4a', '#6b3a18', 2.5);
      ctx.fillStyle = '#ffd23f'; ctx.fillRect(c.w / 2 - 4, -6, 8, 8);
      ctx.restore();
      if (z.state !== 'done' && G.t % 2 < 1.4) { Art.starPath(ctx, c.x + c.w / 2, c.y - 16 + Math.sin(t * 4) * 3, 8, 3.5, 5, 0); Art.fs(ctx, '#ffd23f', '#d98a0b', 1.5); }
    }
    // bubbles
    for (const b of z.bubbles) {
      if (!b.alive && b.pop <= 0) continue;
      const s = b.alive ? 1 : 1 + (1 - b.pop) * 0.6;
      ctx.save(); ctx.translate(b.x, b.y); ctx.scale(s, s);
      if (!b.alive) ctx.globalAlpha = b.pop;
      if (b.cool > 0) ctx.translate(Math.sin(t * 50) * 3, 0);
      const g = ctx.createRadialGradient(-7, -8, 3, 0, 0, 24);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, '#dff4ff'); g.addColorStop(1, b.cool > 0 ? '#ffb3c7' : '#8fd3ff');
      Art.ell(ctx, 0, 0, 23, 23); Art.fs(ctx, g, b.cool > 0 ? '#e0567a' : '#3aa8e0', 2.5);
      Art.ell(ctx, -9, -10, 5, 3, -0.6); Art.fs(ctx, 'rgba(255,255,255,0.9)');
      let size = 22; ctx.font = '800 ' + size + 'px "Baloo 2", sans-serif';
      while (ctx.measureText(b.label).width > 38 && size > 12) { size -= 2; ctx.font = '800 ' + size + 'px "Baloo 2", sans-serif'; }
      outlinedText(ctx, b.label, 0, 2, size, '#2d3a8c', '#fff');
      ctx.restore();
    }
  }
  function drawCastle(ctx, e, world) {
    const x = e.x, y = e.y, col = world.pal.block, dark = world.pal.blockDark;
    ctx.fillStyle = dark; ctx.fillRect(x - 10, y - 150, 170, 150);
    ctx.fillStyle = col; ctx.fillRect(x - 6, y - 146, 162, 146);
    [[-20, 190], [120, 190]].forEach(([dx, h]) => {
      ctx.fillStyle = dark; ctx.fillRect(x + dx, y - h, 60, h);
      ctx.fillStyle = col; ctx.fillRect(x + dx + 4, y - h + 4, 52, h - 4);
      Art.tri(ctx, x + dx - 6, y - h, x + dx + 30, y - h - 50, x + dx + 66, y - h); Art.fs(ctx, world.pal.accent, U.shade(world.pal.accent, -0.3), 2);
      Art.ell(ctx, x + dx + 30, y - h + 40, 10, 14); Art.fs(ctx, '#3a2a50');
    });
    U.rr(ctx, x + 50, y - 80, 50, 80, 25); Art.fs(ctx, '#5a3a2a');
    ctx.fillStyle = '#ffd23f'; Art.ell(ctx, x + 90, y - 40, 4, 4); ctx.fill();
  }
  function drawWind(ctx, e, t) {
    ctx.save(); ctx.globalAlpha = 0.5;
    for (let i = 0; i < 12; i++) {
      const x = e.x + ((i * 37) % e.w), y = e.y + e.h - ((t * 260 + i * 97) % e.h);
      ctx.strokeStyle = G.lvl.world.id === 9 ? '#fff0c7' : '#ffffff'; ctx.lineWidth = 3; ctx.lineCap = 'round';   // desert: sandy dust devil
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 8, y - 20, x, y - 40); ctx.stroke();
    }
    ctx.restore();
  }
  function drawGiantBar(ctx, e, t) {
    const cx = e.x + e.w / 2, y = e.y - 26;
    // a little crown and the hearts it has left
    ctx.beginPath(); ctx.moveTo(cx - 12, y - 8); ctx.lineTo(cx - 13, y - 20); ctx.lineTo(cx - 6, y - 13); ctx.lineTo(cx, y - 23); ctx.lineTo(cx + 6, y - 13); ctx.lineTo(cx + 13, y - 20); ctx.lineTo(cx + 12, y - 8); ctx.closePath();
    Art.fs(ctx, '#ffd84a', '#c99a12', 1.5);
    for (let i = 0; i < e.maxHp; i++) Art.drawHeart(ctx, cx + (i - (e.maxHp - 1) / 2) * 18, y + 2, 7, i < e.hp);
    if (e.gname) { ctx.font = '800 13px "Baloo 2", sans-serif'; const w = ctx.measureText(e.gname).width + 14; ctx.fillStyle = 'rgba(58,36,110,0.75)'; U.rr(ctx, cx - w / 2, y + 12, w, 18, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(e.gname, cx, y + 21); }
  }
  function drawBossAll(ctx, t) {
    const b = G.boss;
    if (b.phase === 'defeat') {
      ctx.save(); const k = Math.max(0, 1 - G.defeatT / 1.5);
      ctx.translate(b.x + b.w / 2, b.y + b.h / 2); ctx.rotate(G.defeatT * 6); ctx.scale(k, k); ctx.translate(-(b.x + b.w / 2), -(b.y + b.h / 2));
      Art.drawBoss(ctx, b, t); ctx.restore();
      if (G.defeatT > 1.2) Art.drawStar(ctx, b.x + b.w / 2, b.y + b.h / 2 - Math.min(80, (G.defeatT - 1.2) * 100), 30, t, '#ffd23f');
    } else Art.drawBoss(ctx, b, t);
    // boss orbs (answers)
    if (b.orbs) for (const o of b.orbs) {
      if (!o.alive && o.pop <= 0) continue;
      ctx.save(); ctx.translate(o.x, o.y + Math.sin(t * 2 + o.x) * 5);
      if (!o.alive) { ctx.globalAlpha = o.pop; ctx.scale(1 + (1 - o.pop), 1 + (1 - o.pop)); }
      if (o.hint) { ctx.shadowColor = '#fff6a0'; ctx.shadowBlur = 25; }
      const g = ctx.createRadialGradient(-8, -10, 3, 0, 0, 30);
      g.addColorStop(0, '#fff'); g.addColorStop(0.4, '#ffe0f4'); g.addColorStop(1, o.hint ? '#ffe066' : '#ff85c8');
      Art.ell(ctx, 0, 0, 29, 29); Art.fs(ctx, g, '#c4458f', 3);
      ctx.shadowBlur = 0;
      let size = 26; ctx.font = '800 ' + size + 'px "Baloo 2", sans-serif';
      while (ctx.measureText(o.label).width > (/[+·]/.test(o.label) ? 58 : 48) && size > 12) { size -= 2; ctx.font = '800 ' + size + 'px "Baloo 2", sans-serif'; }
      outlinedText(ctx, o.label, 0, 2, size, '#7a1a55', '#fff');
      ctx.restore();
    }
  }
  function drawProjectile(ctx, q, t) {
    switch (q.kind) {
      case 'wave': ctx.beginPath(); ctx.moveTo(q.x - 22, q.y + 18); ctx.quadraticCurveTo(q.x, q.y - 22, q.x + 22, q.y + 18); ctx.closePath(); Art.fs(ctx, 'rgba(143,227,107,0.85)', '#3f8a2a', 2.5); break;
      case 'snowball': Art.ell(ctx, q.x, q.y, q.r, q.r); Art.fs(ctx, '#fff', '#9fc4e8', 2.5); break;
      case 'fireball': { const g = ctx.createRadialGradient(q.x, q.y, 2, q.x, q.y, q.r * 1.4); g.addColorStop(0, '#fff6c9'); g.addColorStop(0.5, '#ff9a3d'); g.addColorStop(1, 'rgba(255,90,60,0)'); ctx.fillStyle = g; ctx.fillRect(q.x - q.r * 1.5, q.y - q.r * 1.5, q.r * 3, q.r * 3); break; }
      case 'bubble': Art.ell(ctx, q.x, q.y, q.r, q.r); ctx.fillStyle = 'rgba(200,120,255,0.35)'; ctx.fill(); ctx.strokeStyle = '#9d4fd6'; ctx.lineWidth = 2.5; ctx.stroke(); Art.ell(ctx, q.x - 5, q.y - 6, 4, 3); Art.fs(ctx, '#fff'); break;
      case 'spore': Art.ell(ctx, q.x, 11 * T - 4, q.r, 4); Art.fs(ctx, 'rgba(0,0,0,0.15)'); Art.ell(ctx, q.x, q.y, q.r, q.r); Art.fs(ctx, '#ff85b0', '#b8467a', 2); Art.ell(ctx, q.x - 4, q.y - 4, 3, 3); Art.fs(ctx, '#fff'); break;
      case 'bolt':
        if (q.warn > 0) { ctx.fillStyle = 'rgba(255,230,100,' + (0.15 + 0.2 * Math.abs(Math.sin(t * 20))) + ')'; ctx.fillRect(q.x - q.r, 0, q.r * 2, 11 * T); }
        else if (q.life < 0.35) { ctx.strokeStyle = '#fff6a0'; ctx.lineWidth = 10; ctx.beginPath(); let y = 0, x = q.x; ctx.moveTo(x, y); while (y < 11 * T) { y += 40; x = q.x + (Math.random() - 0.5) * 30; ctx.lineTo(x, y); } ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.stroke(); }
        break;
      case 'magic': Art.drawStar(ctx, q.x, q.y, 16, t * 3, '#ffe066'); break;
      case 'gear': Art.drawGear(ctx, q.x, q.y, q.r + 2, t * 8, '#b8c0d0'); break;
      case 'shard': {
        Art.ell(ctx, q.x, 11 * T - 4, q.r, 4); Art.fs(ctx, 'rgba(0,0,0,0.15)');
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(t * 5);
        ctx.beginPath(); ctx.moveTo(0, -q.r * 1.3); ctx.lineTo(q.r * 0.7, 0); ctx.lineTo(0, q.r * 1.3); ctx.lineTo(-q.r * 0.7, 0); ctx.closePath(); Art.fs(ctx, '#8fe6ff', '#2a8fb8', 2);
        Art.ell(ctx, -2, -4, 2.5, 4); Art.fs(ctx, 'rgba(255,255,255,0.8)');
        ctx.restore();
        break;
      }
      case 'meteor': {
        for (let i = 1; i <= 4; i++) { Art.ell(ctx, q.x - i * 4, q.y - i * 9, q.r * (1 - i * 0.18), q.r * (1 - i * 0.18)); Art.fs(ctx, 'rgba(255,' + (200 - i * 25) + ',120,' + (0.6 - i * 0.12) + ')'); }
        Art.ell(ctx, q.x, 11 * T - 4, q.r, 4); Art.fs(ctx, 'rgba(0,0,0,0.2)');
        Art.ell(ctx, q.x, q.y, q.r, q.r); Art.fs(ctx, '#a08cd0', '#5a3fbf', 2); Art.ell(ctx, q.x - 4, q.y - 3, 3.5, 3.5); Art.fs(ctx, '#7a64b0'); Art.ell(ctx, q.x + 4, q.y + 3, 2.5, 2.5); Art.fs(ctx, '#7a64b0');
        break;
      }
    }
  }

  /* ---------------- HUD & maths banner (screen space) ---------------- */
  function drawHUD(ctx, t) {
    const pad = 14;
    if (G.sb && G.sb.drawHUD(ctx, G, viewW, viewH, t, outlinedText)) return;
    // hearts
    for (let i = 0; i < G.maxHearts; i++) Art.drawHeart(ctx, pad + 18 + i * 36, pad + 22, 15, i < G.hearts);
    // coins
    const cx = pad + 18 + G.maxHearts * 36 + 18;
    Art.drawCoin(ctx, cx, pad + 20, 0, 13);
    outlinedText(ctx, String(G.sb ? G.prof.coins : G.coins), cx + 20, pad + 22, 28, '#fff', '#5a3a8a', 'left');   // at home: the piggy bank
    if (G.rew > 1 && !G.sb) { ctx.font = '800 28px "Baloo 2", sans-serif'; const w = ctx.measureText(String(G.coins)).width; outlinedText(ctx, '×' + String(G.rew).replace('.', ','), cx + 26 + w, pad + 24, 18, '#ffd23f', '#8a5a00', 'left'); }
    // stars
    if (!G.lvl.noStars) for (let i = 0; i < 3; i++) {
      const sx = cx + 100 + i * 34;
      Art.starPath(ctx, sx, pad + 20, 14, 6.5, 5, 0);
      Art.fs(ctx, G.stars[i] ? '#ffd23f' : 'rgba(255,255,255,0.35)', G.stars[i] ? '#d98a0b' : 'rgba(90,60,120,0.5)', 2);
    }
    // active power-up timers
    const p = G.player; let px = cx + 220;
    [['magnet', p.magnetT, 14], ['boots', p.bootsT, 14], ['rainbow', p.rainbowT, 9]].forEach(([k, v, m]) => {
      if (v > 0) { ctx.globalAlpha = v < 2 && Math.floor(t * 8) % 2 ? 0.4 : 1; Art.drawPowerup(ctx, k, px, pad + 22, 0); ctx.globalAlpha = 1; px += 40; }
    });
    // run clock with the par time (medal goal) at the top centre
    const fmt = v => Math.floor(v / 60) + ':' + String(Math.floor(v % 60)).padStart(2, '0');
    const showClock = !G.boss && G.wi !== D.BONUS_ID && (G.kind === 'normal' || (G.kind === 'daily' && G.mode.info.goal === 'time'));
    if (showClock) {
      const par = G.kind === 'daily' ? G.dailyTarget.t : G.par, over = G.clock > par;
      outlinedText(ctx, '⏱ ' + fmt(G.clock), viewW / 2 - 6, pad + 22, 24, '#fff', '#5a3a8a', 'right');
      outlinedText(ctx, '/ ' + fmt(par), viewW / 2 + 2, pad + 22, 20, over ? '#ffb3c7' : '#ffe680', '#5a3a8a', 'left');
    }
    // level of the day: the goal and how it's going
    if (G.kind === 'daily') {
      const info = G.mode.info, tg = G.dailyTarget;
      const prog = info.goal === 'coins' ? G.coins + '/' + tg.n : info.goal === 'stomp' ? G.stompsRun + '/' + tg.n : info.goal === 'nohit' ? (G.hits ? '✗' : '✓') : info.goal === 'math' ? (G.mathOk === G.mathTotal ? '✓' : '✗') : '';
      outlinedText(ctx, 'Cel dnia: ' + prog, viewW / 2, pad + (showClock ? 50 : 22), 20, '#ffffff', '#e0629f');
    }
    // boss hp bar
    if (G.boss && G.boss.phase !== 'defeat') {
      const b = G.boss, w = Math.min(320, viewW * 0.35), x = viewW / 2 - w / 2, y = viewH - 34;
      U.rr(ctx, x - 4, y - 4, w + 8, 24, 12); Art.fs(ctx, 'rgba(40,20,60,0.55)');
      U.rr(ctx, x, y, w * b.hp / b.maxHp, 16, 8); Art.fs(ctx, '#ff5e7e');
      outlinedText(ctx, b.name, viewW / 2, y - 16, 20, '#fff', '#5a3a8a');
    }
    if (G.banner) drawBanner(ctx, t);
    // toasts
    for (const tt of G.toasts) {
      const a = Math.min(1, tt.life * 3, (tt.max - tt.life) * 6 + 0.2);
      ctx.globalAlpha = a;
      const y = G.banner ? viewH * 0.62 : viewH * 0.32;
      outlinedText(ctx, tt.text, viewW / 2, y - (1 - a) * 20, 38, '#ffffff', '#7a5ce6');
      ctx.globalAlpha = 1;
    }
  }

  /* Wrap text into lines that fit `maxW`. */
  function wrap(ctx, text, maxW) {
    const words = text.split(' '), lines = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  function drawBanner(ctx, t) {
    const bn = G.banner;
    let title = '', sub = '', visual = null;
    if (bn.kind === 'gate') { const pr = bn.ref.problem; if (!pr) return; title = pr.q; visual = pr.visual; sub = 'Uderz głową w dobry klocek!'; if (bn.ref.wrong >= 1 && pr.hint) sub = pr.hint; }
    else if (bn.kind === 'boss') { const pr = bn.ref.problem; title = pr.q; visual = pr.visual; sub = 'Dotknij dobrej kulki!'; }
    else if (bn.kind === 'challenge') {
      const z = bn.ref, c = z.c;
      title = c.title;
      if (z.state === 'done') sub = 'Udało się! Zajrzyj do skrzyni!';
      else if (c.kind === 'sum') sub = 'Masz już: ' + z.total + ' z ' + c.target;
      else if (c.kind === 'set') sub = 'Zostało do zebrania: ' + z.goodLeft;
      else sub = 'Następna: ' + (z.next + 1) + ' z ' + c.sorted.length;
    }
    const maxW = Math.min(viewW - 40, 760);
    let size = 34;
    ctx.font = '800 ' + size + 'px "Baloo 2", sans-serif';
    let lines = wrap(ctx, title, maxW - 40);
    while (lines.length > 2 && size > 22) { size -= 2; ctx.font = '800 ' + size + 'px "Baloo 2", sans-serif'; lines = wrap(ctx, title, maxW - 40); }
    const visH = visual ? 44 : 0;
    const h = 22 + lines.length * size * 1.1 + visH + 30;
    const w = Math.min(maxW, Math.max(...lines.map(l => ctx.measureText(l).width)) + 60, maxW);
    const bw = Math.max(w, 320);
    const x = viewW / 2 - bw / 2, y = 62;
    ctx.save();
    ctx.shadowColor = 'rgba(60,20,90,0.3)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 4;
    U.rr(ctx, x, y, bw, h, 22); Art.fs(ctx, 'rgba(255,255,255,0.95)');
    ctx.restore();
    U.rr(ctx, x, y, bw, h, 22); ctx.strokeStyle = bn.kind === 'challenge' ? '#3aa8e0' : bn.kind === 'boss' ? '#ff5e9e' : '#9d7bff'; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = '#3b2a6b'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '800 ' + size + 'px "Baloo 2", sans-serif';
    lines.forEach((l, i) => ctx.fillText(l, viewW / 2, y + 16 + size * 0.55 + i * size * 1.1));
    let vy = y + 16 + lines.length * size * 1.1;
    if (visual) { drawVisual(ctx, visual, viewW / 2, vy + 20); vy += visH; }
    ctx.font = '700 20px "Baloo 2", sans-serif'; ctx.fillStyle = '#6a5a8a';
    ctx.fillText(sub, viewW / 2, vy + 13);
  }
  /* Dot pictures for the youngest players: 3 + 4 shows as 3 pink and 4 blue dots. */
  function drawVisual(ctx, v, cx, cy) {
    if (v.type === 'dots') {
      const n = v.op === '+' ? v.a + v.b : v.a;
      const gap = 22, w = (n - 1) * gap + (v.op === '+' ? 16 : 0);
      let x = cx - w / 2;
      for (let i = 0; i < n; i++) {
        if (v.op === '+' && i === v.a) x += 16;
        const second = v.op === '+' ? i >= v.a : false;
        Art.ell(ctx, x, cy, 9, 9); Art.fs(ctx, second ? '#5ccfff' : '#ff85b0', second ? '#2a7fb0' : '#c4557f', 2);
        if (v.op === '-' && i >= v.a - v.b) { ctx.strokeStyle = '#3b2a6b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 9, cy - 9); ctx.lineTo(x + 9, cy + 9); ctx.stroke(); }
        x += gap;
      }
    } else if (v.type === 'count') {
      const gap = 26, w = (v.n - 1) * gap; let x = cx - w / 2;
      for (let i = 0; i < v.n; i++) { Art.starPath(ctx, x, cy + (i % 2) * 4 - 2, 11, 5, 5, 0); Art.fs(ctx, '#ffd23f', '#d98a0b', 1.5); x += gap; }
    }
  }

  LZ.Game = {
    start, update, render, resize, quit, restart,
    get active() { return !!G; },
    get state() { return G && G.state; },
    get kind() { return G && G.kind; },
    get view() { return { w: viewW, h: viewH, scale }; },
    _dbg: () => G,   // used by the automated tests only
    lenient: false,  // tests only: falls and lost hearts don't send the bot back (see fallOut/outOfHearts)
    // for the open world (world.js), which streams the map in pieces
    _build: list => buildEntities(list), _computeMasks: () => computeMasks(), _clampCam: () => clampCam(),
    _drawVisual: (ctx, v, x, y) => drawVisual(ctx, v, x, y), _toast: (t, d) => toast(t, d), _hurt: (x, c) => hurt(x, c), _setupGate: g => setupGate(g), _confetti: (x, y, n) => confetti(x, y, n), _floatText: (x, y, t, c, s) => floatText(x, y, t, c, s),
  };
})();
