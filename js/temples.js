/*
 * temples.js - an old temple in every landscape of the open world.
 *
 * Going through the temple door starts a dungeon: a level built by the
 * normal level generator from that landscape's own world (its creatures and
 * its trick - ice, water, wind...), with maths gates, secret rooms and stone
 * walls instead of sky. At the far end waits the temple treasure.
 * The treasure (materials, coins, and the first time a relic for the house)
 * is given once a day per temple; going in again the same day is just for
 * fun and gives no coins.
 *
 * Save data: fun.temples { band: dateKey of the last treasure }, fun.relics.
 */
(function () {
  const U = LZ.U, S = LZ.S, A = LZ.A, Art = LZ.Art, Fun = LZ.Fun, Bag = LZ.Bag, D = LZ.D;
  const T = LZ.T;

  const where = (W, b) => W.standAt(b * W.BAND + 12 * Math.sign(b));
  // the landscape's world dressed in old temple stone
  function templeWorld(w) {
    return Object.assign({}, w, {
      id: 70 + w.id, name: 'Świątynia', cave: true,
      pal: Object.assign({}, w.pal, { skyTop: '#2a2240', skyBot: '#141024', far: '#3a3056', mid: '#2e2646', dirt: '#b8a07a', dirtDark: '#8a7456', block: '#d9c49a', blockDark: '#9a8458', grass: '#7aa35a', grassDark: '#557a3a' }),
    });
  }
  function level(mode) {
    const w = D.WORLDS[mode.wi - 1];
    const lvl = LZ.Gen.generate(mode.wi, 3, { daily: 9000 + mode.band * 17 });
    lvl.world = templeWorld(w); lvl.cave = true; lvl.noStars = true;
    lvl.themeName = 'Świątynia: ' + LZ.World.BIOMES[mode.biome].name;
    return lvl;
  }
  function enter(G, e) {
    const p = G.prof, f = Fun.state(p), h = LZ.UI._h;
    f.temples = f.temples || {};
    const done = f.temples[e.band] === Fun.today();
    const m = Fun.open([h('h2', null, 'Świątynia: ' + LZ.World.BIOMES[e.biome].name),
      h('p', null, 'Stara świątynia pełna zagadek: bramy z zadaniami, pułapki, ukryte przejścia. Na końcu czeka skarb!'),
      done ? h('p.note', null, 'Dzisiejszy skarb już zabrany. Możesz wejść dla zabawy - skarb wróci jutro.') : null,
      h('div.funrow', null, [h('button.btn.mid.primary', { onclick: () => {
        m.close();
        const back = { x: G.wl.wx, y: G.wl.wy - 1 };
        const wi = LZ.World.BIOMES[e.biome].w;
        LZ.Game.quit();
        LZ.UI.play(wi, 3, { kind: 'temple', wi, band: e.band, biome: e.biome, back, noCoins: done });
      } }, 'Wchodzę!'), h('button.btn.mid', { onclick: () => m.close() }, 'Nie teraz')])]);
  }
  // called by game.js when she reaches the end of the temple
  function win(p, mode) {
    const f = Fun.state(p), lines = [];
    f.temples = f.temples || {}; f.relics = f.relics || {};
    f.book.places.temple = 1;
    if (f.temples[mode.band] === Fun.today()) return { head: 'Świątynia przebyta!', lines: ['Skarb już dziś zabrany - wróć jutro po następny.'] };
    f.temples[mode.band] = Fun.today();
    const give = (k, n) => { Bag.add(p, k, n); lines.push('+ ' + Bag.name(k, n).toLowerCase()); };
    if (!f.relics[mode.biome]) {
      f.relics[mode.biome] = 1;
      const home = LZ.Home.homeOf(p); home.inv.relic = (home.inv.relic || 0) + 1;
      lines.push('🏺 Starożytna waza do domku');
    }
    p.coins += 25; p.stats.totalCoins += 25; lines.push('+ 25 monet');
    give('gem', 2); give(U.pick(Math.random, ['gold', 'star', 'feather']), 1);
    if (Math.random() < 0.4) give('map', 1);
    S.checkBadges(p); S.save();
    return { head: 'Skarb świątyni jest twój!', lines };
  }

  function drawTemple(g, e, t, G) {
    const x = e.x, y = e.y, rr = U.rr, fs = Art.fs;
    // stepped base, four columns, a triangular roof and a glowing doorway
    rr(g, x - 130, y - 18, 260, 18, 3); fs(g, '#c9b48a', '#7a6440', 2);
    rr(g, x - 116, y - 32, 232, 16, 3); fs(g, '#d9c49a', '#7a6440', 2);
    for (const cx of [-96, -52, 52, 96]) { rr(g, x + cx - 11, y - 150, 22, 120, 4); fs(g, '#e8d8b0', '#7a6440', 2); g.fillStyle = 'rgba(122,100,64,0.25)'; g.fillRect(x + cx - 3, y - 146, 6, 112); }
    rr(g, x - 124, y - 166, 248, 18, 3); fs(g, '#d9c49a', '#7a6440', 2);
    g.beginPath(); g.moveTo(x - 132, y - 164); g.lineTo(x, y - 226); g.lineTo(x + 132, y - 164); g.closePath(); fs(g, '#c9b48a', '#7a6440', 2.5);
    Art.ell(g, x, y - 190, 14, 14); fs(g, '#ffd23f', '#b8861c', 2);
    const glow = 0.5 + 0.3 * Math.sin(t * 2);
    rr(g, x - 30, y - 110, 60, 80, 28); fs(g, '#1a1030');
    const gr = g.createRadialGradient(x, y - 60, 4, x, y - 60, 60); gr.addColorStop(0, 'rgba(255,210,120,' + glow + ')'); gr.addColorStop(1, 'rgba(255,210,120,0)'); g.fillStyle = gr; g.fillRect(x - 60, y - 120, 120, 100);
    // moss and a few vines, so it looks old
    g.fillStyle = 'rgba(92,160,70,0.7)'; for (let i = 0; i < 6; i++) Art.ell(g, x - 110 + i * 44, y - 166, 10, 5), g.fill();
    U.rr(g, x - 76, y - 262, 152, 26, 7); fs(g, '#fff6c9', '#7a6440', 2);
    g.fillStyle = '#5a3a8a'; g.font = '800 15px "Baloo 2", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ŚWIĄTYNIA', x, y - 249);
    const f = Fun.state(G.prof);
    if (!(f.temples && f.temples[e.band] === Fun.today())) { g.globalAlpha = 0.5 + 0.5 * Math.sin(t * 4); Art.starPath(g, x, y - 128, 8, 3.5, 5, t); fs(g, '#fff6c9', '#e0a000', 1.5); g.globalAlpha = 1; }
    Fun.ring(g, x, y - 140, e, 0.7);
  }
  // the relic for the house: an old striped vase
  function drawRelic(g, X, Y, w, t) {
    const cx = X + w / 2;
    g.beginPath(); g.moveTo(cx - 12, Y); g.quadraticCurveTo(cx - 28, Y - 30, cx - 14, Y - 54); g.lineTo(cx - 10, Y - 64); g.lineTo(cx + 10, Y - 64); g.lineTo(cx + 14, Y - 54); g.quadraticCurveTo(cx + 28, Y - 30, cx + 12, Y); g.closePath();
    Art.fs(g, '#d98a4a', '#7a3a10', 2.5);
    g.fillStyle = '#2a1a10'; g.fillRect(cx - 22, Y - 36, 44, 6); g.fillStyle = '#ffd23f'; for (let i = 0; i < 4; i++) g.fillRect(cx - 18 + i * 10, Y - 35, 5, 4);
    g.strokeStyle = '#2a1a10'; g.lineWidth = 2; g.beginPath(); g.arc(cx - 20, Y - 46, 7, -1.2, 1.2); g.stroke(); g.beginPath(); g.arc(cx + 20, Y - 46, 7, Math.PI - 1.2, Math.PI + 1.2); g.stroke();
  }

  LZ.Ext.add({
    world: {
      defs(G, cx, cy, push, W) {
        const x0 = cx * 32;
        for (const b of new Set([W.bandOf(x0), W.bandOf(x0 + 31)])) {
          if (b === 0) continue;
          const st = where(W, b);
          if (st.x >= x0 && st.x < x0 + 32 && Math.floor(st.y / 32) === cy) push({ t: 'temple', x: st.x, y: st.y, band: b, biome: W.biomeKey(b) });
        }
      },
      buildEnt(G, e, px, py) { if (e.t !== 'temple') return false; G.ents.push({ k: 'temple', x: px + T / 2, y: py, band: e.band, biome: e.biome }); return true; },
      updateEnt(G, e, i, dt) { if (e.k !== 'temple') return false; if (Fun.stand(G, e, dt, { dx: 30, t: 0.7 })) enter(G, e); return true; },
      drawEnt(g, e, t, G) { if (e.k !== 'temple') return false; drawTemple(g, e, t, G); return true; },
    },
    furn: { draw(g, id, X, Y, w, t) { if (id !== 'relic') return false; drawRelic(g, X, Y, w, t); return true; } },
  });

  LZ.Temples = { level, win, enter, where, templeWorld };
})();
