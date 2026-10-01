/*
 * tower.js - "Wieża": climb as high as you can.
 *
 * A tall tower of one-hundred floors, built fresh each day from the date
 * (both sisters get the same tower, so the record is a fair race). Floors
 * are planks three rows apart, zig-zagging left and right; higher up they
 * get shorter, some are solid blocks (go round them), moving platforms and
 * vanishing clouds, with slimes walking on them and bats in between.
 * Every tenth floor is a closed ceiling with three answer blocks: bump the
 * right one with your head and the ceiling opens.
 *
 * Chocolate rises from the bottom after a short head start, so there's no
 * dawdling. Touching it costs a heart and throws her up. When the hearts
 * run out the run is over: the floor reached is the score.
 *
 * Save data: fun.towerBest (highest floor ever), fun.towerDay { key, bonus }
 * (coins given today for floors, capped), fun.cnt.towerFloors (all floors
 * ever climbed, for the quest board), fun.towerRuns.
 */
(function () {
  const U = LZ.U, S = LZ.S, A = LZ.A, Art = LZ.Art, Fun = LZ.Fun;
  const T = LZ.T, PW = 28, PH = 40;
  const FLOORS = 100, GAP = 3, W = 22, TOP = 6;
  const GROUND = TOP + FLOORS * GAP, H = GROUND + 1;
  const rowOf = f => GROUND - f * GAP;
  const DAY_CAP = 40;   // floor bonus coins per day: the tower is a challenge, not a coin farm

  const TOWER_WORLD = {
    id: 52, name: 'Wieża', features: [], enemies: [], music: 97,
    pal: { skyTop: '#2a1f4a', skyBot: '#5a3f8a', far: '#3a2f5a', mid: '#4a3a6a', grass: '#b8a0e8', grassDark: '#8a70c0', dirt: '#8a7aa8', dirtDark: '#5a4a78', block: '#c9b8e8', blockDark: '#7a64b0', plank: '#ffcf70', accent: '#ff6fae' },
  };

  /* ---------------- building the tower ---------------- */
  function buildLevel(p) {
    const seed = Number(LZ.X.dateKey().replace(/-/g, ''));
    const r = U.rng(seed * 13 + 5);
    const cols = [];
    for (let x = 0; x < W; x++) {
      const c = new Array(H).fill('.');
      for (let y = 0; y < H; y++) if (x === 0 || x === W - 1 || y === 0) c[y] = '=';
      c[GROUND] = '#';
      cols.push(c);
    }
    const ents = [];
    const put = (x0, x1, y, ch) => { for (let x = Math.max(1, x0); x <= Math.min(W - 2, x1); x++) cols[x][y] = ch; };
    const barriers = [];
    let prev = { x0: 1, x1: W - 2, full: true };
    for (let f = 1; f <= FLOORS; f++) {
      const y = rowOf(f), d = f / FLOORS;
      if (f === FLOORS) {
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
        // a heart waits just above every ceiling
        ents.push({ t: 'theart', x: U.ri(r, 4, W - 5), y: y - 1 });
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
      const len = U.clamp(Math.round(6.5 - f / 22 + (r() - 0.5) * 2), 3, 7);
      const kindRoll = r();
      const solid = f >= 18 && kindRoll < 0.12 + d * 0.15;
      const moving = !solid && f >= 25 && kindRoll < 0.12 + d * 0.15 + 0.14;
      const cloud = !solid && !moving && f >= 35 && kindRoll < 0.12 + d * 0.15 + 0.28;
      const maxGap = f < 15 ? 1 : 2, maxOver = prev.full || f < 4 ? 99 : 2;
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
        const ch = isSolid ? U.pick(r, f > 40 ? ['=', 'I', '>', '<'] : ['=', 'I']) : '-';
        put(x0, x1, y, ch);
        prev = { x0, x1 };
        // creatures and springs only on real ground
        if (f >= 8 && len >= 5 && r() < 0.3 + d * 0.35) ents.push({ t: 'enemy', type: f > 55 && r() < 0.4 ? 'robot' : 'slime', x: x0 + Math.floor(len / 2), y });
        else if (!isSolid && len >= 4 && f % 10 < 7 && r() < 0.07) ents.push({ t: 'spring', x: r() < 0.5 ? x0 : x1, y });
      }
      if (r() < 0.6) { const n = U.ri(r, 1, Math.min(3, x1 - x0 + 1)); for (let k = 0; k < n; k++) ents.push({ t: 'coin', x: x0 + k, y: y - 1 }); }
      // a short spare plank somewhere else, sometimes with a coin on it
      if (r() < 0.45) {
        const el = U.ri(r, 2, 3), ex = r() < 0.5 ? U.ri(r, 1, Math.max(1, x0 - el - 1)) : U.ri(r, Math.min(W - 2 - el, x1 + 2), W - 1 - el);
        if (ex + el - 1 < x0 - 1 || ex > x1 + 1) { put(ex, ex + el - 1, y, '-'); if (r() < 0.5) ents.push({ t: 'coin', x: ex, y: y - 1 }); }
      }
      if (f >= 15 && r() < 0.12 + d * 0.25) ents.push({ t: 'enemy', type: 'bat', x: U.ri(r, 3, W - 4), y: y - 1 });
    }
    return {
      world: TOWER_WORLD, wi: 52, li: 1, H, W, cols, ents, qc: {}, start: { x: 10, y: GROUND - 1 },
      water: false, boss: null, theme: null, themeName: 'Wieża - wspinaj się!', noStars: true, sandbox: 'tower', barriers,
    };
  }

  /* ---------------- engine hooks (G.sb) ---------------- */
  function floorOf(G) {
    const p = G.player, feet = Math.round((p.y + PH) / T);
    return Math.max(0, Math.round((GROUND - feet) / GAP));
  }
  const hooks = {
    init(G) {
      G.hearts = G.maxHearts;
      G.tw = { floor: 0, top: 0, lava: (GROUND + 2) * T, grace: 8, barriers: G.lvl.barriers.map(b => Object.assign({}, b)), over: false, endT: 0, summit: false };
      setTimeout(() => G && G.tw && LZ.Game._toast('Czekolada zaraz zacznie rosnąć - w górę!', 2.6), 2300);
    },
    tick(G, dt) {
      const tw = G.tw, p = G.player;
      if (tw.over) return;
      if (p.grounded) { tw.floor = floorOf(G); if (tw.floor > tw.top) { tw.top = tw.floor; if (tw.top % 10 === 1 && tw.top > 1) A.play('checkpoint'); } }
      // the next closed ceiling: cut its answer blocks in when she gets close
      const next = tw.barriers.find(b => !b.open);
      if (next && !next.gate && tw.top >= next.f - 2) openQuestion(G, next);
      if (next && next.gate && next.gate.state !== 'closed') passBarrier(G, next);
      // the chocolate: a head start, then it rises, faster higher up; it waits
      // under a closed ceiling (answering takes time) and never falls too far behind
      if (tw.grace > 0) tw.grace -= dt;
      else {
        let sp = (0.45 + Math.min(0.6, tw.top * 0.008)) * T;
        if (next && tw.lava < (next.y + 10) * T && tw.top >= next.f - 1) sp = 0.1 * T;
        tw.lava -= sp * dt;
        const feet = p.y + PH;
        if (tw.lava - feet > 15 * T && !(next && tw.top >= next.f - 1)) tw.lava = feet + 15 * T;
      }
      // touching it hurts and throws her up out of it
      if (p.y + PH > tw.lava + 12 && G.state === 'play') {
        LZ.Game._hurt(null, 'lava');
        if (!tw.over && G.state === 'play') { p.vy = -1250; p.grounded = false; p.on = null; tw.lava = Math.min((GROUND + 2) * T, tw.lava + 3 * T); }
      }
      // the trophy at the top
      const sm = G.ents.find(e => e.k === 'tsummit');
      if (sm && !tw.summit && Math.abs(p.x + PW / 2 - sm.x) < 50 && Math.abs(p.y + PH - sm.y) < 60) { tw.summit = true; tw.top = FLOORS; endRun(G, true); }
    },
    buildEnt(G, e, px, py) {
      if (e.t === 'tsummit') G.ents.push({ k: 'tsummit', x: px, y: py });
      else if (e.t === 'theart') G.ents.push({ k: 'power', kind: 'heart', x: px + T / 2, y: py + T / 2, vy: 0, born: 0 });
    },
    updateEnt() { return false; },
    drawEnt(ctx, e, t, G) { if (e.k === 'tsummit') { drawTrophy(ctx, e.x, e.y, t); return true; } return false; },
    drawBack(ctx, G, cam, vw, vh, t) {
      const cv = ctx.canvas;
      if (cv.__sky !== 'tower') { cv.__sky = 'tower'; cv.style.background = '#3a2f5a'; }
      ctx.clearRect(0, 0, vw, vh);
      ctx.fillStyle = '#2a1f4a'; ctx.fillRect(0, 0, vw, vh);
      ctx.save(); ctx.translate(-cam.x, -cam.y);
      drawWall(ctx, G, cam, vw, vh, t);
      ctx.restore();
    },
    drawFront(ctx, G, x0, x1, y0, y1, t) {
      const tw = G.tw; if (!tw) return;
      // the answer blocks of an open ceiling sit in holes; mark the ceiling's floor number
      drawLava(ctx, tw.lava, G.cam.y + 2000, t);
    },
    drawHUD(ctx, G, vw, vh, t, text) {
      const tw = G.tw; if (!tw) return false;
      const best = Fun.state(G.prof).towerBest || 0;
      text(ctx, '🗼 ' + tw.top + '. piętro', vw / 2, 36, 28, '#fff', '#5a3a8a');
      if (!G.banner) text(ctx, 'Rekord: ' + Math.max(best, tw.top) + (tw.top > best && best > 0 ? ' - nowy!' : ''), vw / 2, 64, 18, tw.top > best && best > 0 ? '#ffe680' : '#e8dcff', '#5a3a8a');
      // how close the chocolate is: a warm glow along the bottom of the screen
      const gap = tw.lava - (G.player.y + PH);
      if (gap < 5 * T && !tw.over) {
        const a = U.clamp(1 - gap / (5 * T), 0, 1) * (0.5 + 0.2 * Math.sin(t * 8));
        const gr = ctx.createLinearGradient(0, vh - 120, 0, vh); gr.addColorStop(0, 'rgba(160,80,40,0)'); gr.addColorStop(1, 'rgba(160,80,40,' + a.toFixed(2) + ')');
        ctx.fillStyle = gr; ctx.fillRect(0, vh - 120, vw, 120);
      }
      return false;   // and the normal hearts / coins
    },
    outOfHearts(G) { endRun(G, false); return true; },
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
    LZ.Game._toast('Sufit otwarty! Piętro ' + b.f + '!', 1.8);
    LZ.Game._confetti(G.player.x, b.y * T, 30);
  }

  function saveRun(G) {
    const tw = G.tw, p = G.prof, f = Fun.state(p);
    tw.saved = true;
    const prevBest = f.towerBest || 0;
    f.towerBest = Math.max(prevBest, tw.top);
    f.towerRuns = (f.towerRuns || 0) + 1;
    f.cnt = f.cnt || {}; f.cnt.towerFloors = (f.cnt.towerFloors || 0) + tw.top;
    // floor coins, capped per day
    const key = LZ.X.dateKey();
    if (!f.towerDay || f.towerDay.key !== key) f.towerDay = { key, bonus: 0 };
    const bonus = Math.max(0, Math.min(Math.floor(tw.top / 2) + (tw.summit ? 30 : 0), DAY_CAP + (tw.summit ? 30 : 0) - f.towerDay.bonus));
    f.towerDay.bonus += bonus;
    p.coins += bonus; p.stats.totalCoins += bonus;
    if (tw.summit) { f.towerSummit = (f.towerSummit || 0) + 1; const home = LZ.Home.homeOf(p); if (f.towerSummit === 1) home.inv.towertrophy = (home.inv.towertrophy || 0) + 1; }
    S.checkBadges(p); S.save();
    return { prevBest, bonus };
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
    const UI = LZ.UI, h = UI._h, tw = G.tw, record = tw.top > res.prevBest;
    const m = UI._modal([
      h('h2', null, summit ? '🏆 Szczyt wieży!' : '🗼 Koniec wspinaczki'),
      h('div.towerres', null, [h('b', null, String(tw.top)), h('small', null, U.plural(tw.top, 'piętro', 'piętra', 'pięter'))]),
      h('p', null, summit ? 'Cała wieża! Puchar szczytu czeka w domku.' : record ? 'Nowy rekord!' + (res.prevBest ? ' Poprzedni: ' + res.prevBest + '.' : '') : 'Rekord: ' + res.prevBest + '. Spróbuj go pobić!'),
      res.bonus ? h('p', null, ['Premia za piętra: ', h('span.coin-ico'), ' ' + res.bonus]) : h('p.note', null, 'Dzisiejsza premia za piętra już zebrana - rekord liczy się dalej!'),
      h('div.row', null, [
        h('button.btn.mid', { onclick: () => { m.close(); LZ.Game.quit(); document.getElementById('hud').classList.add('hidden'); UI.challenges(); } }, 'Wyjdź'),
        h('button.btn.mid.primary', { onclick: () => { m.close(); LZ.Game.quit(); UI.play(0, 0, { kind: 'tower' }); } }, 'Jeszcze raz'),
      ]),
    ], { dismiss: false });
    m.box.parentNode.classList.add('levelend');
  }

  /* ---------------- drawing ---------------- */
  // the inside of the tower: stone bricks, windows to a sky that darkens as she climbs, floor numbers
  function drawWall(g, G, cam, vw, vh, t) {
    const y0 = Math.max(0, Math.floor(cam.y / T) - 1), y1 = Math.min(H, Math.ceil((cam.y + vh) / T) + 1);
    const top = y0 * T, bot = y1 * T, x0 = T, x1 = (W - 1) * T;
    const h01 = U.clamp(1 - (cam.y + vh / 2) / (GROUND * T), 0, 1);   // 0 at the bottom, 1 at the top
    const stone = mix('#8a7aa8', '#4a3a78', h01), line = mix('#6a5a88', '#2f2458', h01);
    g.fillStyle = stone; g.fillRect(x0, top, x1 - x0, bot - top);
    g.strokeStyle = line; g.lineWidth = 2;
    g.beginPath();
    for (let y = Math.floor(top / 24) * 24; y < bot; y += 24) {
      g.moveTo(x0, y); g.lineTo(x1, y);
      const off = (y / 24) % 2 ? 0 : 24;
      for (let x = x0 + off; x < x1; x += 48) { g.moveTo(x, y); g.lineTo(x, y + 24); }
    }
    g.stroke();
    // windows every 9 rows, alternating sides
    for (let wy = Math.floor(y0 / 9) * 9; wy <= y1; wy += 9) {
      const wx = (wy / 9) % 2 ? 4 : W - 6, X = wx * T, Y = wy * T, ww = 2 * T, wh = 3 * T;
      const hh = U.clamp(1 - wy / GROUND, 0, 1);
      const sky = g.createLinearGradient(0, Y, 0, Y + wh);
      sky.addColorStop(0, hh < 0.35 ? '#7fd0ff' : hh < 0.7 ? '#ff9a8a' : '#1a1440');
      sky.addColorStop(1, hh < 0.35 ? '#d8f2ff' : hh < 0.7 ? '#ffd08a' : '#3a2a70');
      g.beginPath(); g.moveTo(X, Y + wh); g.lineTo(X, Y + ww / 2); g.arc(X + ww / 2, Y + ww / 2, ww / 2, Math.PI, 0); g.lineTo(X + ww, Y + wh); g.closePath();
      g.fillStyle = sky; g.fill(); g.strokeStyle = line; g.lineWidth = 6; g.stroke();
      if (hh >= 0.7) for (let k = 0; k < 4; k++) { Art.starPath(g, X + 16 + k * 18, Y + 40 + (k % 2) * 30, 4, 1.6, 4, 0); Art.fs(g, 'rgba(255,255,255,' + (0.5 + 0.5 * Math.sin(t * 2 + k)).toFixed(2) + ')'); }
      else { Art.ell(g, X + 30 + Math.sin(t * 0.3 + wy) * 10, Y + 70, 18, 8); Art.fs(g, 'rgba(255,255,255,0.8)'); }
      g.fillStyle = line; g.fillRect(X + ww / 2 - 2, Y + 10, 4, wh - 10); g.fillRect(X, Y + wh / 2, ww, 4);
    }
    // floor numbers on the wall at every fifth floor
    g.font = '800 22px "Baloo 2", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let f = 5; f <= FLOORS; f += 5) {
      const y = rowOf(f) * T - T * 1.2;
      if (y < top - T || y > bot + T) continue;
      for (const sx of [T * 1.6, (W - 1.6) * T]) {
        U.rr(g, sx - 24, y - 16, 48, 32, 8); Art.fs(g, f % 10 === 0 ? '#ffd23f' : '#fff6c9', '#7a5a2a', 2.5);
        g.fillStyle = '#5a3a1a'; g.fillText(String(f), sx, y + 1);
      }
    }
  }
  function mix(a, b, k) {
    const A1 = U.hexToRgb(a), B1 = U.hexToRgb(b);
    return 'rgb(' + [0, 1, 2].map(i => Math.round(A1[i] + (B1[i] - A1[i]) * k)).join(',') + ')';
  }
  function drawLava(g, y, bottom, t) {
    if (y > bottom) return;
    g.save();
    g.beginPath(); g.moveTo(0, bottom);
    for (let x = 0; x <= W * T; x += 12) g.lineTo(x, y + Math.sin(t * 3 + x * 0.05) * 6);
    g.lineTo(W * T, bottom); g.closePath();
    const gr = g.createLinearGradient(0, y, 0, y + 4 * T);
    gr.addColorStop(0, '#b0703f'); gr.addColorStop(0.3, '#7a4526'); gr.addColorStop(1, '#4a2614');
    g.fillStyle = gr; g.fill();
    g.lineWidth = 4; g.strokeStyle = '#d0905a'; g.stroke();
    // bubbles popping on the surface
    g.fillStyle = 'rgba(255,225,190,0.45)';
    for (let i = 0; i < 9; i++) { const ph = (t * 0.7 + i * 0.37) % 1, bx = (i * 131 + 40) % (W * T); Art.ell(g, bx, y + 14 + (1 - ph) * 20, 6 * ph + 2, 5 * ph + 2); g.fill(); }
    g.restore();
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
  // the summit cup for the house (first time at the top)
  LZ.Ext.add({ furn: { draw(g, id, X, Y, w, t) { if (id !== 'towertrophy') return false; g.save(); g.translate(X + w / 2, Y); g.scale(0.6, 0.6); drawTrophy(g, 0, 0, t); g.restore(); return true; } } });

  LZ.Tower = { hooks, buildLevel, best: p => Fun.state(p).towerBest || 0, FLOORS, rowOf, _floorOf: floorOf };
})();
