/*
 * treasure.js - treasure maps and the riddle guardians.
 *
 * A treasure map (from a chest or a trader) is read with a bit of maths:
 * "from the flag Grzybowy Las 3 walk 4 times 6 steps to the right". The
 * answer is how many metres; the HUD then counts the metres from that flag
 * and an X shows on the ground when she is close. Standing on the X digs up
 * a big treasure.
 *
 * Riddle guardians are stone owls deep in the caves (below 60 m) sitting on
 * a golden chest. Three right answers open it.
 *
 * Save data: fun.map = { fx, fy, name, dir, dist, x } (the map being
 * followed), fun.maps (maps dug up), fun.guards { id: 1 } (guardians solved).
 */
(function () {
  const U = LZ.U, S = LZ.S, A = LZ.A, Art = LZ.Art, Fun = LZ.Fun, Bag = LZ.Bag, M = LZ.M;
  const T = LZ.T;
  const GUARD_DEPTH = 60;

  /* ================= treasure maps ================= */
  // the flag the map starts from: a surface flag she has already found, or the house
  function pickStart(p) {
    const ws = LZ.World.worldSave(p);
    const flags = Object.values(ws.flags).filter(f => f.y > -12 && f.y < 12);
    if (flags.length) { const f = U.pick(Math.random, flags); return { x: f.x, y: f.y, name: 'od flagi „' + f.name + '”', flag: 'flaga ' + f.name }; }
    return { x: 0, y: 0, name: 'od drzwi domku', flag: 'drzwi domku' };
  }
  function readMap(p, done) {
    const f = Fun.state(p), h = LZ.UI._h;
    if (f.map) { LZ.UI._alert('Już masz mapę', 'Najpierw znajdź skarb z mapy, którą czytasz. ' + mapText(f.map)); return; }
    const st = pickStart(p), tier = Fun.tierOf(p);
    const dir = Math.random() < 0.5 ? -1 : 1, word = dir > 0 ? 'w prawo' : 'w lewo';
    let q, dist;
    if (tier >= 4) { const a = U.ri(Math.random, 2, tier === 4 ? 5 : 7), b = U.pick(Math.random, tier === 4 ? [2, 3, 4, 5, 10] : [3, 4, 6, 7, 8, 9]); dist = a * b; q = 'Idź ' + word + ' ' + a + ' razy po ' + b + ' kroków. Ile to metrów?'; }
    else if (tier === 3) { const a = U.ri(Math.random, 12, 40), b = U.ri(Math.random, 8, 30); dist = a + b; q = 'Idź ' + word + ' ' + a + ' kroków, a potem jeszcze ' + b + '. Ile to metrów?'; }
    else { const a = U.ri(Math.random, 5, tier === 1 ? 6 : 12), b = U.ri(Math.random, 4, tier === 1 ? 4 : 8); dist = a + b; q = 'Idź ' + word + ' ' + a + ' kroków, a potem jeszcze ' + b + '. Ile to metrów?'; }
    const box = h('div');
    const m = Fun.open([h('h2', null, '🗺 Mapa skarbów'), h('p', null, 'Start: ' + st.name + '.'), box]);
    Fun.ask(box, p, () => ({ q, a: String(dist), choices: M.numChoices(dist, [dist + 10, dist - 1]), topic: tier >= 4 ? 'mul' : 'add' }), () => {
      Bag.take(p, 'map');
      f.map = { fx: st.x, fy: st.y, name: st.name, flag: st.flag, dir, dist, x: st.x + dir * dist };
      S.save();
      box.innerHTML = '';
      box.appendChild(h('p', null, ['Skarb leży ', h('b', null, dist + ' m ' + word), ' ' + st.name + '. Licznik na górze pokaże, ile już przeszłaś. Szukaj znaku X!']));
      box.appendChild(h('button.btn.mid.primary', { onclick: () => { m.close(); if (done) done(); } }, 'Ruszam!'));
    }, { same: true, cancel: () => m.close(), cancelText: 'Później' });
  }
  const mapText = mp => 'Skarb: ' + mp.dist + ' m ' + (mp.dir > 0 ? 'w prawo' : 'w lewo') + ' ' + mp.name + '.';
  function dig(G, e) {
    const p = G.prof, f = Fun.state(p), h = LZ.UI._h, ws = LZ.World.worldSave(p);
    f.map = null; f.maps = (f.maps || 0) + 1;
    const coins = 25 + Math.floor(Math.random() * 16);
    p.coins += coins; p.stats.totalCoins += coins;
    const ids = ['throne', 'crystallamp', 'fossil', 'piano', 'telescope', 'aquarium', 'fireplace'];
    const id = U.pick(Math.random, ids), home = LZ.Home.homeOf(p); home.inv[id] = (home.inv[id] || 0) + 1;
    const seed = U.pick(Math.random, ['blue', 'pumpkin']); Bag.add(p, 'seed_' + seed, 2);
    ws.chestCount = (ws.chestCount || 0) + 1;
    S.checkBadges(p); S.save(); A.play('win');
    for (let i = 0; i < 30; i++) G.particles.push({ x: e.x, y: e.y - 10, vx: (Math.random() - 0.5) * 400, vy: -Math.random() * 500, life: 0.8, max: 0.8, size: 6, kind: 'stars', rot: Math.random() * 6, grav: 900 });
    LZ.Game._confetti(e.x, e.y - 60, 40);
    e.dug = true;
    const m = Fun.open([h('h2', null, 'Skarb!'), h('div.loot', null, [
      h('div.lootrow', null, [h('span.coin-ico'), ' +' + coins + ' monet']),
      h('div.lootrow', null, ['🛋 ', h('b', null, LZ.Home.FURN_BY[id].name), ' - do domku!']),
      h('div.lootrow', null, [Bag.icon('seed_' + seed, 28), ' ', h('b', null, Bag.name('seed_' + seed, 2))]),
    ]), h('button.btn.mid.primary', { onclick: () => m.close() }, 'Hurra!')]);
  }

  /* ================= riddle guardians ================= */
  function openGuard(G, e) {
    const p = G.prof, f = Fun.state(p), h = LZ.UI._h;
    f.guards = f.guards || {};
    const box = h('div'), stars = h('div.funrow');
    const m = Fun.open([h('h2', null, 'Strażnik Głębin'), stars, box]);
    let got = 0;
    const drawStars = () => { stars.innerHTML = ''; for (let i = 0; i < 3; i++) stars.appendChild(h('span', { style: 'font-size:30px;' + (i < got ? '' : 'filter:grayscale(1);opacity:.35') }, '⭐')); };
    drawStars();
    box.appendChild(h('p', null, 'Huhu! Pilnuję tej złotej skrzyni. Odpowiedz na trzy zagadki, a będzie twoja.'));
    box.appendChild(h('div.funrow', null, [h('button.btn.mid.primary', { onclick: next }, 'Zgoda!'), h('button.btn.mid', { onclick: () => m.close() }, 'Innym razem')]));
    function next() {
      Fun.ask(box, p, () => M.question(Math.min(5.9, p.skill + 0.3), S.mathBand(p)), () => {
        got++; drawStars();
        if (got < 3) { box.innerHTML = ''; box.appendChild(h('p', null, got === 1 ? 'Dobrze! Druga zagadka...' : 'Świetnie! Ostatnia...')); setTimeout(next, 700); return; }
        win();
      }, { title: 'Zagadka ' + (got + 1) + ' z 3', cancel: () => m.close(), cancelText: 'Później' });
    }
    function win() {
      f.guards[e.id] = 1; e.done = true;
      const coins = 35 + Math.floor(Math.random() * 11);
      p.coins += coins; p.stats.totalCoins += coins;
      const home = LZ.Home.homeOf(p);
      const first = !f.owlGot; let id;
      if (first) { f.owlGot = true; id = 'owlstatue'; }
      else id = U.pick(Math.random, ['throne', 'crystallamp', 'fossil', 'piano']);
      home.inv[id] = (home.inv[id] || 0) + 1;
      const map = Math.random() < 0.5; if (map) Bag.add(p, 'map');
      Fun.state(p).book.places.guard = (Fun.state(p).book.places.guard || 0) + 1;
      S.checkBadges(p); S.save(); A.play('win'); LZ.Game._confetti(e.x, e.y - 80, 50);
      box.innerHTML = '';
      box.appendChild(h('p', null, 'Huhu! Mądra z ciebie głowa. Skrzynia jest twoja!'));
      box.appendChild(h('div.loot', null, [
        h('div.lootrow', null, [h('span.coin-ico'), ' +' + coins + ' monet']),
        h('div.lootrow', null, ['🛋 ', h('b', null, LZ.Home.FURN_BY[id].name), ' - do domku!']),
        map ? h('div.lootrow', null, [Bag.icon('map', 28), ' ', h('b', null, 'Mapa skarbów')]) : null,
      ]));
      box.appendChild(h('button.btn.mid.primary', { onclick: () => m.close() }, 'Dziękuję!'));
    }
  }

  /* ================= drawing ================= */
  function drawX(g, e, t) {
    // a patch of loose earth with a red X, and a shovel stuck in it
    Art.ell(g, e.x, e.y - 2, 30, 7); Art.fs(g, '#8a5a32', '#5c3a1c', 1.5);
    g.strokeStyle = '#ff3a5e'; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(e.x - 14, e.y - 8); g.lineTo(e.x + 14, e.y + 2); g.moveTo(e.x + 14, e.y - 8); g.lineTo(e.x - 14, e.y + 2); g.stroke();
    g.save(); g.translate(e.x + 26, e.y - 6); g.rotate(0.35);
    g.fillStyle = '#8a5a32'; g.fillRect(-2, -46, 4, 40); U.rr(g, -8, -8, 16, 18, 4); Art.fs(g, '#b8c0d0', '#5a6388', 1.5); g.restore();
    g.globalAlpha = 0.5 + 0.5 * Math.sin(t * 4); Art.starPath(g, e.x, e.y - 40, 8, 3.5, 5, t); Art.fs(g, '#fff6c9', '#e0a000', 1.5); g.globalAlpha = 1;
    Fun.ring(g, e.x, e.y - 64, e, 0.8);
  }
  function drawGuard(g, e, t, G) {
    const ell = Art.ell, fs = Art.fs, rr = U.rr, x = e.x, y = e.y;
    // golden chest next to the owl
    const cx = x + 44;
    rr(g, cx, y - 30, 44, 30, 5); fs(g, e.done ? '#b8a060' : '#ffd23f', '#b8861c', 2.5);
    rr(g, cx - 2, y - 40, 48, 14, 6); fs(g, e.done ? '#c9b070' : '#ffe680', '#b8861c', 2.5);
    g.fillStyle = '#ff5e7e'; g.fillRect(cx + 19, y - 32, 6, 12);
    // pedestal and a stone owl with glowing eyes
    rr(g, x - 30, y - 30, 60, 30, 5); fs(g, '#9a92b0', '#5a5270', 2.5);
    ell(g, x, y - 62, 24, 30); fs(g, '#b8b0c8', '#5a5270', 2.5);
    ell(g, x, y - 56, 15, 18); fs(g, '#d0c8e0');
    Art.tri(g, x - 20, y - 84, x - 14, y - 100, x - 8, y - 86); fs(g, '#b8b0c8', '#5a5270', 2);
    Art.tri(g, x + 20, y - 84, x + 14, y - 100, x + 8, y - 86); fs(g, '#b8b0c8', '#5a5270', 2);
    const glow = e.done ? '#7be08a' : 'rgba(92,207,255,' + (0.6 + 0.4 * Math.sin(t * 3)) + ')';
    ell(g, x - 9, y - 74, 7, 7); fs(g, '#fff', '#5a5270', 1.5); ell(g, x + 9, y - 74, 7, 7); fs(g, '#fff', '#5a5270', 1.5);
    ell(g, x - 9, y - 74, 3.5, 3.5); fs(g, glow); ell(g, x + 9, y - 74, 3.5, 3.5); fs(g, glow);
    Art.tri(g, x - 4, y - 68, x + 4, y - 68, x, y - 60); fs(g, '#ffb020', '#c47a00', 1);
    if (!e.done) Fun.bubble(g, x, y - 108 + Math.sin(t * 2) * 3, '?', '#2a7fb0');
    Fun.ring(g, x, y - 130, e, 0.6);
  }
  // where the X is, counted from the map's flag
  function mapHUD(g, G, vw, vh, t, text) {
    const f = Fun.state(G.prof), mp = f.map; if (!mp) return;
    const wx = G.wl.wx || 0;
    const y = 206;
    g.fillStyle = 'rgba(58,36,110,0.72)'; U.rr(g, 14, y - 26, 250, 52, 16); g.fill();
    Bag.draw(g, 'map', 40, y, t);
    text(g, 'Skarb: ' + mp.dist + ' m ' + (mp.dir > 0 ? '→' : '←'), 150, y - 8, 17, '#fff', '#3a246e');
    const from = (wx - mp.fx) * mp.dir;
    if (Math.abs(wx - mp.fx) < 200) text(g, 'Przeszłaś: ' + from + ' m', 150, y + 14, 16, from === mp.dist ? '#b8ffb8' : '#ffe680', '#3a246e');
    else text(g, 'Start: ' + (mp.flag || 'domek'), 150, y + 14, 13, '#ffe680', '#3a246e');
  }

  LZ.Ext.add({
    world: {
      chunk(W, cx, cy, x0, y0, add, r) {
        // a guardian in about one deep piece in six
        if (y0 + 32 <= GUARD_DEPTH || y0 > 96) return;
        const rg = U.rng(Math.floor(((cx * 73856093) ^ (cy * 19349663) ^ W.seed) >>> 0));
        if (rg() > 0.17) return;
        for (let k = 0; k < 30; k++) {
          const x = x0 + 4 + Math.floor(rg() * 24), y = y0 + 2 + Math.floor(rg() * 28);
          if (y < GUARD_DEPTH || y >= 98) continue;
          const solid = c => c === '#' || c === 'I';
          let ok = true;
          for (let dx = -1; dx <= 3 && ok; dx++) { if (!solid(W.tile(x + dx, y))) ok = false; for (let dy = 1; dy <= 3; dy++) if (W.tile(x + dx, y - dy) !== '.') ok = false; }
          if (ok) { add({ t: 'guard', x, y, id: 'g' + x + ',' + y }); return; }
        }
      },
      defs(G, cx, cy, push, W) {
        const mp = Fun.state(G.prof).map;
        if (!mp || Math.floor(mp.x / 32) !== cx) return;
        const st = W.standAt(mp.x);
        if (Math.floor(st.y / 32) === cy) push({ t: 'digspot', x: st.x, y: st.y });
      },
      buildEnt(G, e, px, py) {
        if (e.t === 'digspot') { G.ents.push({ k: 'digspot', x: px + T / 2, y: py }); return true; }
        if (e.t === 'guard') { const f = Fun.state(G.prof); G.ents.push({ k: 'guard', x: px + T / 2, y: py, id: e.id, done: !!(f.guards && f.guards[e.id]) }); return true; }
        return false;
      },
      updateEnt(G, e, i, dt) {
        if (e.k === 'digspot') {
          if (e.dug) { G.ents.splice(i, 1); return true; }
          if (Fun.stand(G, e, dt, { dx: 30, t: 0.8 })) dig(G, e);
          else if (e._st > 0 && Math.random() < 0.4) G.particles.push({ x: e.x + (Math.random() - 0.5) * 30, y: e.y - 4, vx: (Math.random() - 0.5) * 200, vy: -200 - Math.random() * 150, life: 0.5, max: 0.5, size: 5, kind: 'stars', rot: 0, grav: 900 });
          return true;
        }
        if (e.k === 'guard') { if (!e.done && Fun.stand(G, e, dt, { dx: 60, t: 0.6 })) openGuard(G, e); return true; }
        return false;
      },
      drawEnt(g, e, t, G) {
        if (e.k === 'digspot') {
          // the X only shows up close by: finding the spot is counting the metres
          const near = Math.abs(G.player.x + 14 - e.x) < 12 * T;
          if (near) drawX(g, e, t);
          return true;
        }
        if (e.k === 'guard') { drawGuard(g, e, t, G); return true; }
        return false;
      },
      drawHUD(g, G, vw, vh, t, text) { mapHUD(g, G, vw, vh, t, text); },
      loot(p, tier, loot) {
        if (tier >= 2 && Math.random() < 0.18 && !Fun.state(p).map && !Bag.count(p, 'map')) { Bag.add(p, 'map'); loot.push({ kind: 'bag', id: 'map', n: 1 }); return true; }
        return false;
      },
    },
    bag: {
      actions(p, id, acts) { if (id === 'map') acts.push({ label: 'Czytaj', fn: m => { m.close(); readMap(p); } }); },
    },
  });

  LZ.Treasure = { readMap, dig, openGuard, GUARD_DEPTH };
})();
