/*
 * nature.js - where the materials for the smithy and the tailor come from,
 * and a few more things to do out there.
 *
 *   ore rocks in the caves   - iron near the top, crystals deeper, gold in
 *                              the deep; mined with the pickaxe (stand next
 *                              to the rock). A mined rock grows back after
 *                              8 hours.
 *   feathers                 - lie on the sky islands, back every day
 *   meteor showers           - some nights stars fall and a few star shards
 *                              land near her, glowing
 *   fox races                - in every landscape Lisek Sprinter holds a
 *                              60 m race; beating the time gives a prize,
 *                              and the best time is kept
 * (Fireflies for jars are caught at night, see sky.js.)
 *
 * Save data: fun.mined { id: time }, fun.picked { id: dateKey },
 * fun.races { band: best seconds }, fun.raceWins.
 */
(function () {
  const U = LZ.U, S = LZ.S, A = LZ.A, Art = LZ.Art, Fun = LZ.Fun, Bag = LZ.Bag;
  const T = LZ.T;
  const REGROW = 8 * 3600 * 1000;
  const RACE_LEN = 60, RACE_LIMIT = 18, RACE_GOLD = 12, RACE_SILVER = 15;

  const st = p => { const f = Fun.state(p); f.mined = f.mined || {}; f.picked = f.picked || {}; f.races = f.races || {}; return f; };
  function hash(a, b, c) { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }

  /* ================= ore rocks ================= */
  function oreKind(r, y) {
    const v = r();
    if (y < 35) return v < 0.85 ? 'iron' : 'gem';
    if (y < 65) return v < 0.5 ? 'iron' : v < 0.9 ? 'gem' : 'gold';
    return v < 0.3 ? 'iron' : v < 0.7 ? 'gem' : 'gold';
  }
  function chunkOres(W, cx, cy, x0, y0, add) {
    if (y0 + 32 < 8) return;
    const r = U.rng(Math.floor(hash(cx, cy, W.seed + 5) * 1e9));
    let n = 0;
    for (let k = 0; k < 12 && n < 2; k++) {
      const x = x0 + Math.floor(r() * 32), y = y0 + Math.floor(r() * 32);
      if (y >= 98 || y < W.surf(x) + 8) continue;
      const c = W.tile(x, y);
      if ((c !== '#' && c !== 'I') || W.tile(x, y - 1) !== '.' || W.tile(x, y - 2) !== '.') continue;
      add({ t: 'ore', x, y, kind: oreKind(r, y), id: 'o' + x + ',' + y }); n++;
    }
  }
  function drawOre(g, e, t) {
    // drawn around (0, 0) at 1.35x, so the rock stands out next to her
    g.save(); g.translate(e.x, e.y); g.scale(1.35, 1.35);
    const x = 0, y = 0;
    g.beginPath(); g.moveTo(x - 24, y); g.lineTo(x - 20, y - 18); g.lineTo(x - 6, y - 30); g.lineTo(x + 12, y - 26); g.lineTo(x + 24, y - 12); g.lineTo(x + 22, y); g.closePath();
    Art.fs(g, '#8a82a0', '#4a4460', 2.5);
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.moveTo(x - 18, y - 16); g.lineTo(x - 6, y - 27); g.lineTo(x + 2, y - 24); g.lineTo(x - 12, y - 12); g.closePath(); g.fill();
    const spots = [[-10, -12], [6, -16], [12, -6], [-2, -5]];
    if (e.kind === 'gem') {
      for (const [dx, dy, s] of [[-8, -24, 1], [6, -26, 0.8], [14, -14, 0.7]]) { g.save(); g.translate(x + dx, y + dy); g.scale(s, s); g.beginPath(); g.moveTo(0, -12); g.lineTo(6, -2); g.lineTo(0, 8); g.lineTo(-6, -2); g.closePath(); Art.fs(g, ['#8fe6ff', '#ff9ecf', '#b8ff9a'][Math.floor((dx + 20) / 10) % 3], '#2a6a88', 1.5); g.restore(); }
    } else for (const [dx, dy] of spots) { Art.ell(g, x + dx, y + dy, 4, 3.2); Art.fs(g, e.kind === 'gold' ? '#ffd23f' : '#d98a4a', e.kind === 'gold' ? '#b8861c' : '#8a4a20', 1); }
    if (Math.sin(t * 3 + e.x) > 0.7) { Art.starPath(g, x + 8, y - 22, 5, 1.3, 4, 0); Art.fs(g, '#fff'); }
    if (e.hits) { g.fillStyle = 'rgba(40,30,60,0.7)'; g.fillRect(x - 20, y + 6, 40, 6); g.fillStyle = '#ffd23f'; g.fillRect(x - 20, y + 6, 40 * e.hits / 3, 6); }
    g.restore();
  }
  function updOre(G, e, i, dt) {
    const p = G.player, f = st(G.prof);
    const near = Math.abs(p.x + 14 - e.x) < 44 && Math.abs(p.y + 40 - e.y) < 30 && p.grounded;
    if (!near) { e.t = 0; e.warned = false; if (e.hits && !G.mine) e.hits = 0; if (G.mine === e) G.mine = null; return; }
    if (!LZ.Gear.has(G.prof, 'pick')) { if (!e.warned) { e.warned = true; LZ.Game._toast('Tu jest ruda! Kilof wykuje Panda Bogna w kuźni obok domku.', 2.6); } return; }
    if (Math.abs(p.vx) > 40) { e.t = 0; return; }
    G.mine = e; e.t = (e.t || 0) + dt;
    if (e.t >= 0.42) {
      e.t = 0; e.hits = (e.hits || 0) + 1; A.play(e.hits < 3 ? 'bump' : 'break'); G.shake = 0.08;
      for (let k = 0; k < 6; k++) G.particles.push({ x: e.x + (Math.random() - 0.5) * 30, y: e.y - 18, vx: (Math.random() - 0.5) * 260, vy: -Math.random() * 300, life: 0.5, max: 0.5, size: 4, kind: 'stars', rot: 0, grav: 900 });
      if (e.hits >= 3) {
        const n = 1 + (Math.random() < 0.35 ? 1 : 0);
        Bag.add(G.prof, e.kind, n); f.mined[e.id] = Date.now();
        Fun.state(G.prof).book.places.ore = 1;
        LZ.Game._floatText(e.x, e.y - 50, '+' + n + ' ' + Bag.name(e.kind, n).replace(/^\d+ /, ''), '#fff', 20);
        S.checkBadges(G.prof); S.save(); G.mine = null;
        G.ents.splice(i, 1);
      }
    }
  }

  /* ================= things lying around (feathers, star shards) ================= */
  function chunkFeathers(W, cx, cy, x0, y0, add) {
    if (!(y0 <= W.SKY && y0 + 32 > W.SKY - 20)) return;
    for (let i = Math.floor(x0 / 26) - 1; i <= Math.floor((x0 + 32) / 26); i++) {
      if (hash(i, 7, W.seed) > 0.55) continue;
      const is = W.island(i), x = is.x0 + 1 + Math.floor(hash(i, 8, W.seed) * Math.max(1, is.x1 - is.x0 - 1));
      add({ t: 'mat', x, y: is.top - 1, mat: 'feather', id: 'fe' + i });
    }
  }
  function updMat(G, e, i, dt) {
    if (e.fall > 0) { e.fall -= dt; return; }
    const p = G.player;
    if (Math.abs(p.x + 14 - e.x) < 30 && Math.abs(p.y + 20 - e.y) < 40) {
      Bag.add(G.prof, e.mat, 1);
      if (e.id) st(G.prof).picked[e.id] = Fun.today();
      A.play('coin'); LZ.Game._floatText(e.x, e.y - 20, '+1 ' + Bag.ITEMS[e.mat].name.toLowerCase(), '#fff', 20);
      S.save(); G.ents.splice(i, 1);
    }
  }
  function drawMat(g, e, t) {
    if (e.fall > 0) {
      // a shard still falling: a bright streak coming down to its spot
      const k = e.fall / 1.4, yy = e.y - k * 520, xx = e.x + k * 260;
      g.strokeStyle = 'rgba(255,246,201,0.8)'; g.lineWidth = 4; g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx + 60, yy - 110); g.stroke();
      Bag.draw(g, e.mat, xx, yy, t); return;
    }
    Bag.draw(g, e.mat, e.x, e.y + Math.sin(t * 3 + e.x) * 3, t);
  }

  /* ================= meteor shower ================= */
  function meteor(G, W) {
    const wx = G.wl.wx || 0;
    LZ.Game._toast('Deszcz meteorów! Gwiezdne odłamki spadają niedaleko!', 3);
    A.play('star');
    Fun.state(G.prof).book.places.meteor = 1;
    const n = 3;
    for (let k = 0; k < n; k++) {
      const x = wx + (k % 2 ? 1 : -1) * (6 + Math.floor(Math.random() * 18));
      const s2 = W.standAt(x);
      const px = (s2.x - G.ox) * T + T / 2, py = (s2.y - G.oy) * T - 26;
      if (px < 0 || px > G.W * T || py < 0 || py > G.H * T) continue;
      G.ents.push({ k: 'mat', mat: 'star', x: px, y: py, fall: 1.4 + k * 0.5 });
    }
    G.meteorShow = 5;
  }
  function tickMeteor(G, dt, W) {
    const f = Fun.state(G.prof), dark = LZ.Sky ? LZ.Sky.darkness(f.time) > 0.6 : false;
    const wy = G.wl.wy || 0, surface = wy <= W.surf(G.wl.wx || 0) + 2 && wy > W.SKY;
    if (dark && !G.nightSeen) { G.nightSeen = true; G.meteorAt = Math.random() < 0.7 ? 8 + Math.random() * 25 : -1; }
    if (!dark) G.nightSeen = false;
    if (G.meteorAt > 0) { G.meteorAt -= dt; if (G.meteorAt <= 0) { if (surface && dark) meteor(G, W); else G.meteorAt = 5; } }
    if (G.meteorShow > 0) G.meteorShow -= dt;
  }
  function drawMeteors(g, G, vw, vh, t) {
    if (!(G.meteorShow > 0)) return;
    for (let i = 0; i < 6; i++) {
      const k = ((t * 0.7 + i / 6) % 1), x = vw * (0.2 + (i * 0.37) % 0.8) + 200 - k * 400, y = -20 + k * vh * 0.6;
      g.strokeStyle = 'rgba(255,246,201,' + (0.9 - k * 0.6) + ')'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 70, y - 40); g.stroke();
      Art.starPath(g, x, y, 5, 2, 5, t); Art.fs(g, '#fff6c9');
    }
  }

  /* ================= fox races ================= */
  function raceSpot(W, b) {
    const dir = Math.sign(b), start = b * W.BAND + dir * 80, fin = start + dir * RACE_LEN;
    return { dir, start: W.standAt(start), fin: W.standAt(fin) };
  }
  function defsRace(G, cx, cy, push, W) {
    const x0 = cx * 32, x1 = x0 + 32;
    for (const b of new Set([W.bandOf(x0), W.bandOf(x1)])) {
      if (b === 0) continue;
      const rs = raceSpot(W, b);
      if (rs.start.x >= x0 && rs.start.x < x1 && Math.floor(rs.start.y / 32) === cy) push({ t: 'race', x: rs.start.x, y: rs.start.y, band: b });
      if (rs.fin.x >= x0 && rs.fin.x < x1 && Math.floor(rs.fin.y / 32) === cy) push({ t: 'finish', x: rs.fin.x, y: rs.fin.y, band: b });
    }
  }
  function openRace(G, e, W) {
    const p = G.prof, f = st(p), h = LZ.UI._h, best = f.races[e.band];
    const m = Fun.open([h('div.npchead', null, [LZ.UI._preview({ id: 'fox', variant: 1, hat: 'glasses' }, 80), h('h2', null, 'Wyścig Liska Sprintera')]),
      h('p', null, 'Dobiegnij do mety (' + RACE_LEN + ' m ' + (e.dir > 0 ? 'w prawo' : 'w lewo') + ') w ' + RACE_LIMIT + ' sekund!'),
      h('p.note', null, '🥇 do ' + RACE_GOLD + ' s · 🥈 do ' + RACE_SILVER + ' s · 🥉 do ' + RACE_LIMIT + ' s' + (best ? ' · Twój rekord: ' + best.toFixed(1).replace('.', ',') + ' s' : '')),
      h('div.funrow', null, [h('button.btn.mid.primary', { onclick: () => { m.close(); start(G, e, W); } }, 'Start!'), h('button.btn.mid', { onclick: () => m.close() }, 'Nie teraz')])]);
  }
  function start(G, e, W) {
    const rs = raceSpot(W, e.band);
    G.race = { band: e.band, dir: rs.dir, fin: rs.fin.x, count: 3, t: 0 };
    G.lockPlayer = 'idle';
    A.play('pause');
  }
  function tickRace(G, dt) {
    const r = G.race; if (!r) return;
    if (r.count > 0) {
      const before = Math.ceil(r.count); r.count -= dt;
      if (Math.ceil(r.count) !== before) A.play(r.count <= 0 ? 'checkpoint' : 'click');
      if (r.count <= 0) G.lockPlayer = null;
      return;
    }
    r.t += dt;
    const wx = G.ox + (G.player.x + 14) / T;
    if ((wx - r.fin) * r.dir >= 0) finish(G, r);
    else if (r.t > RACE_LIMIT + 0.05) { G.race = null; A.play('wrong'); LZ.Game._toast('Czas minął! Spróbuj jeszcze raz u Liska.', 2.4); }
  }
  function finish(G, r) {
    const p = G.prof, f = st(p), tm = Math.round(r.t * 10) / 10;
    G.race = null;
    const medal = tm <= RACE_GOLD ? '🥇' : tm <= RACE_SILVER ? '🥈' : '🥉';
    const first = !f.races[r.band], record = !first && tm < f.races[r.band];
    let coins = 0, extra = '';
    if (first) { coins = 20; Bag.add(p, 'feather', 2); extra = ' i 2 piórka'; f.raceWins = (f.raceWins || 0) + 1; }
    else if (record) coins = 5;
    if (Fun.onceToday(p, 'race' + r.band) && !first) coins += 5;
    if (first || record) f.races[r.band] = tm;
    p.coins += coins; p.stats.totalCoins += coins;
    Fun.state(p).book.places.race = 1;
    S.checkBadges(p); S.save(); A.play('win'); LZ.Game._confetti(G.player.x + 14, G.player.y - 20, 40);
    LZ.Game._toast(medal + ' Meta! ' + String(tm).replace('.', ',') + ' s' + (record ? ' - nowy rekord!' : '') + (coins ? ' +' + coins + ' monet' + extra : ''), 3.2);
  }
  function drawArch(g, x, y, label, t, finish) {
    g.fillStyle = '#8a5a32'; g.fillRect(x - 60, y - 110, 7, 110); g.fillRect(x + 53, y - 110, 7, 110);
    U.rr(g, x - 66, y - 128, 132, 24, 6); Art.fs(g, finish ? '#fff' : '#ff8a3d', '#6b4424', 2);
    if (finish) { g.fillStyle = '#2a2a3a'; for (let i = 0; i < 11; i++) for (let j = 0; j < 2; j++) if ((i + j) % 2) g.fillRect(x - 66 + i * 12, y - 128 + j * 12, 12, 12); }
    else { g.fillStyle = '#fff'; g.font = '800 15px "Baloo 2", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, x, y - 116); }
    for (const d of [-56, 56]) { g.beginPath(); g.moveTo(x + d, y - 128); g.lineTo(x + d + 16, y - 140 + Math.sin(t * 5 + d) * 3); g.lineTo(x + d, y - 146); g.closePath(); Art.fs(g, '#ff5e7e'); }
  }
  function raceHUD(g, G, vw, vh, t, text) {
    const r = G.race; if (!r) return;
    if (r.count > 0) { text(g, String(Math.ceil(r.count)), vw / 2, vh * 0.38, 90, '#fff', '#ff6f91'); return; }
    if (r.t < 0.8) text(g, 'START!', vw / 2, vh * 0.38, 60, '#fff', '#ff6f91');
    const left = Math.max(0, RACE_LIMIT - r.t);
    text(g, '⏱ ' + left.toFixed(1).replace('.', ','), vw / 2, 96, 34, left < 4 ? '#ffb8b8' : '#fff', '#3a246e');
    const wx = G.ox + (G.player.x + 14) / T;
    text(g, Math.max(0, Math.round((r.fin - wx) * r.dir)) + ' m do mety', vw / 2, 128, 18, '#ffe680', '#3a246e');
  }

  LZ.Ext.add({
    world: {
      chunk(W, cx, cy, x0, y0, add) { chunkOres(W, cx, cy, x0, y0, add); chunkFeathers(W, cx, cy, x0, y0, add); },
      defs(G, cx, cy, push, W) { defsRace(G, cx, cy, push, W); },
      buildEnt(G, e, px, py) {
        const f = st(G.prof);
        if (e.t === 'ore') { if (f.mined[e.id] && Date.now() - f.mined[e.id] < REGROW) return true; G.ents.push({ k: 'ore', x: px + T / 2, y: py, kind: e.kind, id: e.id }); return true; }
        if (e.t === 'mat') { if (e.id && f.picked[e.id] === Fun.today()) return true; G.ents.push({ k: 'mat', x: px + T / 2, y: py + T / 2, mat: e.mat, id: e.id }); return true; }
        if (e.t === 'race') { G.ents.push({ k: 'race', x: px + T / 2, y: py, band: e.band, dir: Math.sign(e.band) }); return true; }
        if (e.t === 'finish') { G.ents.push({ k: 'finish', x: px + T / 2, y: py, band: e.band }); return true; }
        return false;
      },
      updateEnt(G, e, i, dt, pc, W) {
        if (e.k === 'ore') { updOre(G, e, i, dt); return true; }
        if (e.k === 'mat') { updMat(G, e, i, dt); return true; }
        if (e.k === 'race') { if (!G.race && !G.ride && Fun.stand(G, e, dt, { dx: 40, t: 0.6 })) openRace(G, e, W); return true; }
        return e.k === 'finish';
      },
      drawEnt(g, e, t, G) {
        if (e.k === 'ore') { drawOre(g, e, t); return true; }
        if (e.k === 'mat') { drawMat(g, e, t); return true; }
        if (e.k === 'race') {
          drawArch(g, e.x, e.y, 'WYŚCIG ' + (e.dir > 0 ? '→' : '←'), t, false);
          Art.drawCharacter(g, e.x - e.dir * 90, e.y, { id: 'fox', variant: 1, hat: 'glasses', facing: e.dir, t, state: 'idle', scale: 1 });
          Fun.ring(g, e.x, e.y - 160, e, 0.6);
          return true;
        }
        if (e.k === 'finish') { drawArch(g, e.x, e.y, '', t, true); return true; }
        return false;
      },
      // the pickaxe swinging while she mines
      drawFront(g, G, t) {
        const e = G.mine; if (!e || !e.t) return;
        const p = G.player, dir = e.x > p.x + 14 ? 1 : -1, a = -1.2 + Math.min(1, e.t / 0.42) * 1.6;
        g.save(); g.translate(p.x + 14 + dir * 8, p.y + 14); g.scale(dir, 1); g.rotate(a); LZ.Gear.drawTool(g, 'pick', 16, -6, t); g.restore();
      },
      tick(G, dt, W) { tickMeteor(G, dt, W); tickRace(G, dt); },
      drawSky(g, G, vw, vh, t) { drawMeteors(g, G, vw, vh, t); },
      drawHUD(g, G, vw, vh, t, text) { raceHUD(g, G, vw, vh, t, text); },
      placed(G) { if (G.race) { G.race = null; G.lockPlayer = null; } G.mine = null; },
      respawn(G) { if (G.race) { G.race = null; G.lockPlayer = null; } },
    },
  });

  LZ.Nature = { meteor, raceSpot, RACE_LEN, RACE_LIMIT };
})();
