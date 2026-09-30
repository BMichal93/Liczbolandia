/*
 * villages.js - the neighbours' villages grow when she helps them.
 *
 * Each landscape's neighbour (world.js) starts alone. Friendship points
 * come from visiting (once a day), finishing their task and giving them
 * their favourite cake. With more points houses appear around them, then
 * more neighbours walking about, and finally a well with flowers where the
 * village leaves her a thank-you gift every day.
 *   level 1 at 2 points, level 2 at 5, level 3 at 8.
 *
 * Save data: fun.visits { band: count }, fun.vlevel { band: level shown }.
 */
(function () {
  const U = LZ.U, S = LZ.S, A = LZ.A, Art = LZ.Art, Fun = LZ.Fun, Bag = LZ.Bag;
  const T = LZ.T;
  const STEPS = [2, 5, 8];
  const FOLK = [['hamster', 1], ['guinea', 1], ['penguin', 1], ['frog', 1], ['fox', 0], ['panda', 0], ['bunny', 0], ['cat', 2]];
  const HOUSE = {   // wall, roof per landscape
    ice: ['#e6f6ff', '#5ab8e6'], forest: ['#fff3e0', '#ff6b8a'], desert: ['#f3d9a8', '#c4702a'], beach: ['#ffe8c0', '#5ccfff'],
    volcano: ['#e8c39e', '#8b5a3c'], factory: ['#fff6c9', '#9d7bff'], moon: ['#e8dcff', '#6a5a9a'],
  };

  function points(p, band) {
    const f = Fun.state(p), ws = LZ.World.worldSave(p);
    f.visits = f.visits || {};
    const q = ws.quests && ws.quests[band];
    return (f.visits[band] || 0) + (q && q.state === 'done' ? 3 : 0) + (f.gifts && f.gifts['fav' + band] ? 2 : 0);
  }
  const levelOf = pts => pts >= STEPS[2] ? 3 : pts >= STEPS[1] ? 2 : pts >= STEPS[0] ? 1 : 0;

  function check(G, band, biome) {
    const f = Fun.state(G.prof); f.vlevel = f.vlevel || {};
    const lv = levelOf(points(G.prof, band));
    if (lv > (f.vlevel[band] || 0)) {
      f.vlevel[band] = lv; S.checkBadges(G.prof); S.save(); A.play('star');
      LZ.Game._toast(['', 'Obok sąsiadki stanął nowy domek!', 'Wioska rośnie - przybyli nowi mieszkańcy!', 'Wioska w pełni! Przy studni czeka codzienny prezent.'][lv], 3);
    }
    return lv;
  }
  function wellGift(G, e) {
    const p = G.prof;
    if (!Fun.onceToday(p, 'well' + e.band)) return;
    const k = U.pick(Math.random, ['egg', 'milk', 'gem', 'feather', 'iron', 'seed_blue', 'seed_pumpkin']), n = 1 + Math.floor(Math.random() * 2);
    Bag.add(p, k, n); p.coins += 5; p.stats.totalCoins += 5; S.save(); A.play('coin');
    LZ.Game._toast('Mieszkańcy dziękują: ' + Bag.name(k, n).toLowerCase() + ' i 5 monet!', 2.6);
  }

  function drawHouse(g, x, y, s, col) {
    const [wall, roof] = col, rr = U.rr, fs = Art.fs;
    g.save(); g.translate(x, y); g.scale(s, s);
    rr(g, -44, -72, 88, 72, 5); fs(g, wall, U.shade(wall, -0.35), 2.5);
    g.beginPath(); g.moveTo(-56, -68); g.lineTo(0, -112); g.lineTo(56, -68); g.closePath(); fs(g, roof, U.shade(roof, -0.35), 2.5);
    rr(g, -12, -44, 24, 44, 8); fs(g, '#8a5a32', '#5c3a1c', 2);
    rr(g, 18, -58, 18, 18, 3); fs(g, '#bfe8ff', '#fff', 3); rr(g, -36, -58, 18, 18, 3); fs(g, '#bfe8ff', '#fff', 3);
    g.restore();
  }
  function drawVillage(g, e, t, G) {
    const f = Fun.state(G.prof), lv = (f.vlevel || {})[e.band] || 0;
    if (!lv) return;
    const col = HOUSE[e.biome] || HOUSE.forest, x = e.x, y = e.y;
    drawHouse(g, x - 170, y, 1, col);
    if (lv >= 2) { drawHouse(g, x + 170, y, 0.9, col); drawHouse(g, x - 300, y, 0.8, col); }
    if (lv >= 2) {
      // neighbours walking about
      const n = lv >= 3 ? 4 : 2;
      for (let i = 0; i < n; i++) {
        const [id, v] = FOLK[(e.band * 3 + i + 16) % FOLK.length], sp = 0.35 + i * 0.1, span = 90 + i * 20;
        const wx = x + (i % 2 ? 1 : -1) * (230 + i * 30) + Math.sin(t * sp + i) * span, dir = Math.cos(t * sp + i) >= 0 ? 1 : -1;
        Art.drawCharacter(g, wx, y, { id, variant: v, facing: dir * (i % 2 ? 1 : -1) >= 0 ? 1 : -1, t: t + i, state: 'run', phase: t * 8 + i, scale: 0.8 });
      }
    }
    if (lv >= 3) {
      // the well, flowers and a banner
      const wx = x + 290;
      U.rr(g, wx - 30, y - 34, 60, 34, 6); Art.fs(g, '#b8b0c8', '#5a5270', 2.5);
      g.fillStyle = '#8a5a32'; g.fillRect(wx - 26, y - 84, 6, 52); g.fillRect(wx + 20, y - 84, 6, 52);
      g.beginPath(); g.moveTo(wx - 38, y - 80); g.lineTo(wx, y - 104); g.lineTo(wx + 38, y - 80); g.closePath(); Art.fs(g, col[1], U.shade(col[1], -0.35), 2);
      Art.ell(g, wx, y - 34, 24, 6); Art.fs(g, '#5ccfff');
      for (let i = 0; i < 7; i++) { const fx = x - 110 + i * 26; for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; Art.ell(g, fx + Math.cos(a) * 4, y - 8 + Math.sin(a) * 4, 3, 3); Art.fs(g, ['#ff85c8', '#ffe066', '#9d7bff'][i % 3]); } Art.ell(g, fx, y - 8, 2, 2); Art.fs(g, '#fff'); }
      if (!Fun.doneToday(G.prof, 'well' + e.band)) Fun.bubble(g, wx, y - 118 + Math.sin(t * 3) * 3, '🎁', '#ff6f91');
      g.strokeStyle = '#8a5a32'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 240, y - 150); g.quadraticCurveTo(x - 170, y - 130, x - 100, y - 150); g.stroke();
      for (let i = 0; i < 6; i++) { Art.tri(g, x - 234 + i * 22, y - 146 + Math.abs(i - 2.5) * 1.5, x - 222 + i * 22, y - 146 + Math.abs(i - 2.5) * 1.5, x - 228 + i * 22, y - 128); Art.fs(g, ['#ff5e7e', '#ffd23f', '#5ccfff'][i % 3]); }
    }
  }

  LZ.Ext.add({
    world: {
      defs(G, cx, cy, push, W) {
        const x0 = cx * 32;
        for (const b of new Set([W.bandOf(x0), W.bandOf(x0 + 31)])) {
          if (b === 0) continue;
          const st = W.standAt(b * W.BAND - 30, true);   // where world.js puts the neighbour
          if (st.x >= x0 && st.x < x0 + 32 && Math.floor(st.y / 32) === cy) push({ t: 'village', x: st.x, y: st.y, band: b, biome: W.biomeKey(b) });
        }
      },
      buildEnt(G, e, px, py) { if (e.t !== 'village') return false; G.ents.push({ k: 'village', x: px + T / 2, y: py, band: e.band, biome: e.biome }); return true; },
      updateEnt(G, e, i, dt) {
        if (e.k !== 'village') return false;
        const lv = check(G, e.band, e.biome);
        if (lv >= 3) { const p = G.player; if (Math.abs(p.x + 14 - (e.x + 290)) < 40 && Math.abs(p.y + 40 - e.y) < 40) wellGift(G, e); }
        return true;
      },
      drawEnt(g, e, t, G) { if (e.k !== 'village') return false; drawVillage(g, e, t, G); return true; },
      // talking to the neighbour counts as a visit, once a day
      npc(G, e) { const f = Fun.state(G.prof); f.visits = f.visits || {}; if (Fun.onceToday(G.prof, 'visit' + e.band)) { f.visits[e.band] = (f.visits[e.band] || 0) + 1; S.save(); } },
    },
  });

  LZ.Villages = { points, levelOf, STEPS };
})();
