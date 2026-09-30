/*
 * story.js - "Zaginiona korona", a story quest across the open world.
 *
 *   1. Królewna Lila (in her tent next to the house) lost her crown:
 *      Sroka Kleptka the magpie stole it.
 *   2. Kurka Zosia saw where the magpie flew.
 *   3. The magpie's nest on a tall tree in the next landscape is empty,
 *      but there's a note: the crown fell out above the clouds.
 *   4. The crown lies on a sky island (balloon, beanstalk or wings) and
 *      the magpie left a riddle next to it.
 *   5. Back to the Princess: a royal crown of her own (badge), the golden
 *      throne and coins.
 * A panel under the hearts always says what to do next, with an arrow.
 *
 * Save data: fun.story = { step: 0-5 }.
 */
(function () {
  const U = LZ.U, S = LZ.S, A = LZ.A, Art = LZ.Art, Fun = LZ.Fun, Bag = LZ.Bag;
  const T = LZ.T, TENT_X = 28;
  function hash(a, b) { let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
  const st = p => { const f = Fun.state(p); f.story = f.story || { step: 0 }; return f.story; };
  // where the nest and the crown are, for this world
  function places(W) {
    const side = hash(W.seed, 3) < 0.5 ? 1 : -1, nx = side * 108;
    const is = W.island(Math.floor(nx / 26)), cx = Math.floor((is.x0 + is.x1) / 2);
    return { side, nest: W.standAt(nx), crown: { x: cx, y: is.top }, land: W.biomeAt(nx) };
  }
  function goal(W, p) {
    const s = st(p).step, pl = places(W);
    switch (s) {
      case 0: return { text: 'Odwiedź Królewnę Lilę - namiot obok domku', x: TENT_X, y: W.surf(TENT_X) - 1 };
      case 1: return { text: 'Zapytaj Kurkę Zosię o srokę', x: LZ.Farm.HEN_X, y: W.surf(LZ.Farm.HEN_X) - 1 };
      case 2: return { text: 'Znajdź gniazdo sroki (' + LZ.World.BIOMES[pl.land].name + ')', x: pl.nest.x, y: pl.nest.y - 1 };
      case 3: return { text: 'Korona jest na wyspie w chmurach! Balon albo fasolka', x: pl.crown.x, y: pl.crown.y - 1 };
      case 4: return { text: 'Zanieś koronę Królewnie', x: TENT_X, y: W.surf(TENT_X) - 1 };
      default: return null;
    }
  }

  function talkPrincess(G) {
    const p = G.prof, s = st(p), h = LZ.UI._h;
    const box = h('div');
    const m = Fun.open([h('div.npchead', null, [LZ.UI._preview({ id: 'cat', variant: 1, hat: s.step >= 5 ? 'royal' : 'tiara' }, 80), h('h2', null, 'Królewna Lila')]), box]);
    const ok = (txt, then) => box.appendChild(h('button.btn.mid.primary', { onclick: () => { m.close(); if (then) then(); } }, txt));
    if (s.step === 0) {
      box.appendChild(h('p', null, 'Och, jak dobrze, że jesteś! Sroka Kleptka porwała moją koronę prosto z poduszki! Kurka Zosia z ogródka wszystko widzi - zapytaj ją, dokąd poleciała sroka.'));
      ok('Pomogę!', () => { s.step = 1; S.save(); A.play('checkpoint'); });
    } else if (s.step < 4) box.appendChild(h('p', null, 'Szukasz jeszcze? Wierzę w ciebie!')), ok('Szukam dalej');
    else if (s.step === 4) {
      s.step = 5;
      const home = LZ.Home.homeOf(p); home.inv.throne = (home.inv.throne || 0) + 1;
      p.coins += 60; p.stats.totalCoins += 60; Bag.add(p, 'star', 2);
      const badges = S.checkBadges(p); S.save(); A.play('win'); LZ.Game._confetti(G.player.x, G.player.y - 60, 60);
      box.appendChild(h('p', null, 'Moja korona! Dziękuję, dzielna podróżniczko! Od dziś jesteś Królewską Pomocnicą. Weź swoją własną koronę, złoty tron do domku i skarby z królewskiego skarbca.'));
      box.appendChild(h('div.loot', null, [h('div.lootrow', null, '👑 Królewska korona - w Garderobie'), h('div.lootrow', null, '🛋 Złoty tron - do domku'), h('div.lootrow', null, [h('span.coin-ico'), ' +60 monet, 2 gwiezdne odłamki'])]));
      if (badges.length) box.appendChild(h('p', null, ['Nowe odznaki: ', h('b', null, badges.map(b => b.name).join(', '))]));
      ok('Hurra!');
    } else { box.appendChild(h('p', null, 'Moja bohaterka! Korona pięknie świeci.')); ok('Pa pa!'); }
  }
  function atNest(G) {
    const s = st(G.prof), h = LZ.UI._h;
    if (s.step !== 2) return;
    s.step = 3; S.save(); A.play('star');
    const m = Fun.open([h('h2', null, 'Gniazdo sroki'), h('p', null, 'Gniazdo jest puste... Na dnie leży liścik: „Leciałam nad chmurami i korona mi wypadła! Leży na wyspie w chmurach. Sroka K.”'),
      h('p.note', null, 'Na wyspy dostaniesz się balonem, po wielkiej fasolce albo na skrzydełkach z kuźni.'),
      h('button.btn.mid.primary', { onclick: () => m.close() }, 'Lecę!')]);
  }
  function atCrown(G, e) {
    const p = G.prof, s = st(p), h = LZ.UI._h;
    if (s.step !== 3) return;
    const box = h('div');
    const m = Fun.open([h('h2', null, 'Korona!'), h('p', null, 'Obok korony sroka zostawiła zagadkę. Rozwiąż ją, żeby zabrać koronę.'), box]);
    Fun.ask(box, p, () => LZ.M.question(p.skill, S.mathBand(p)), () => {
      s.step = 4; S.save(); A.play('win'); e.gone = true;
      box.innerHTML = ''; box.appendChild(h('p', null, 'Korona jest twoja! Zanieś ją Królewnie Lili.'));
      box.appendChild(h('button.btn.mid.primary', { onclick: () => m.close() }, 'Już niosę!'));
    }, { cancel: () => m.close() });
  }

  /* ---------------- drawing ---------------- */
  function drawTent(g, e, t, G) {
    const x = e.x, y = e.y, fs = Art.fs;
    g.beginPath(); g.moveTo(x - 64, y); g.lineTo(x, y - 120); g.lineTo(x + 64, y); g.closePath(); fs(g, '#ffd6e8', '#b8467a', 2.5);
    g.save(); g.clip(); g.fillStyle = 'rgba(157,123,255,0.35)'; for (let i = -3; i < 4; i++) { g.beginPath(); g.moveTo(x + i * 26, y); g.lineTo(x, y - 120); g.lineTo(x + i * 26 + 13, y); g.closePath(); g.fill(); } g.restore();
    g.fillStyle = '#8a5a32'; g.fillRect(x - 2, y - 146, 4, 30);
    g.beginPath(); g.moveTo(x + 2, y - 146); g.lineTo(x + 26, y - 138 + Math.sin(t * 4) * 3); g.lineTo(x + 2, y - 130); g.closePath(); fs(g, '#ffd23f');
    Art.drawCharacter(g, x + 84, y, { id: 'cat', variant: 1, hat: st(G.prof).step >= 5 ? 'royal' : 'tiara', facing: G.player.x < x + 84 ? -1 : 1, t, state: 'idle', scale: 1 });
    const s = st(G.prof).step;
    if (s === 0 || s === 4) Fun.bubble(g, x + 84, y - 70 + Math.sin(t * 3) * 3, s === 0 ? '!' : '👑', '#b8467a');
    Fun.ring(g, x + 84, y - 100, e, 0.6);
    g.fillStyle = 'rgba(58,36,110,0.75)'; U.rr(g, x + 34, y + 6, 100, 20, 8); g.fill();
    g.fillStyle = '#fff'; g.font = '700 13px "Baloo 2", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Królewna Lila', x + 84, y + 16);
  }
  function drawNest(g, e, t, G) {
    const x = e.x, y = e.y;
    // a tall old tree with the magpie's nest on top
    g.fillStyle = '#6b4424'; g.beginPath(); g.moveTo(x - 12, y); g.lineTo(x - 7, y - 200); g.lineTo(x + 7, y - 200); g.lineTo(x + 12, y); g.closePath(); g.fill();
    g.strokeStyle = '#6b4424'; g.lineWidth = 6; g.beginPath(); g.moveTo(x, y - 130); g.lineTo(x + 40, y - 170); g.moveTo(x, y - 100); g.lineTo(x - 36, y - 140); g.stroke();
    Art.ell(g, x, y - 206, 34, 14); Art.fs(g, '#a8784a', '#5c3a1c', 2);
    g.strokeStyle = 'rgba(92,58,28,0.7)'; g.lineWidth = 2; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(x - 30 + i * 12, y - 212); g.lineTo(x - 22 + i * 12, y - 198); g.stroke(); }
    if (st(G.prof).step === 2) Fun.bubble(g, x, y - 230 + Math.sin(t * 3) * 3, '?', '#2a7fb0');
    Fun.ring(g, x, y - 60, e, 0.6);
  }
  function drawCrown(g, e, t) {
    const x = e.x, y = e.y - 30 + Math.sin(t * 2) * 5;
    const gr = g.createRadialGradient(x, y, 4, x, y, 50); gr.addColorStop(0, 'rgba(255,230,120,0.6)'); gr.addColorStop(1, 'rgba(255,230,120,0)'); g.fillStyle = gr; g.fillRect(x - 50, y - 50, 100, 100);
    g.beginPath(); g.moveTo(x - 20, y + 10); g.lineTo(x - 22, y - 12); g.lineTo(x - 10, y - 2); g.lineTo(x, y - 18); g.lineTo(x + 10, y - 2); g.lineTo(x + 22, y - 12); g.lineTo(x + 20, y + 10); g.closePath(); Art.fs(g, '#ffd84a', '#c99a12', 2);
    for (const [dx, c] of [[-12, '#5ccfff'], [0, '#ff5e7e'], [12, '#7be08a']]) { Art.ell(g, x + dx, y + 4, 3, 3); Art.fs(g, c); }
  }
  // the next step, under the hearts, with an arrow pointing the way
  function hud(g, G, vw, vh, t, text, W) {
    const gl = goal(W, G.prof); if (!gl) return;
    const y = 262, p = G.player;
    const dx = (gl.x + 0.5) * T - (G.ox * T + p.x + 14), dy = (gl.y + 0.5) * T - (G.oy * T + p.y + 20);
    const m = Math.round(Math.hypot(dx, dy) / T);
    g.fillStyle = 'rgba(58,36,110,0.72)'; U.rr(g, 14, y - 26, 300, 52, 16); g.fill();
    g.font = '24px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('👑', 38, y);
    text(g, gl.text.length > 34 ? gl.text.slice(0, 33) + '…' : gl.text, 170, y - 9, 13, '#fff', '#3a246e');
    text(g, m < 3 ? 'Tutaj!' : m + ' m', 150, y + 13, 16, '#ffe680', '#3a246e');
    g.save(); g.translate(290, y); g.rotate(Math.atan2(dy, dx));
    g.beginPath(); g.moveTo(14, 0); g.lineTo(-6, -11); g.lineTo(-2, 0); g.lineTo(-6, 11); g.closePath(); Art.fs(g, '#ffd23f', '#b8861c', 2); g.restore();
  }

  LZ.Ext.add({
    world: {
      defs(G, cx, cy, push, W) {
        const s = st(G.prof).step, pl = places(W);
        const inC = (x, y) => Math.floor(x / 32) === cx && Math.floor(y / 32) === cy;
        const tent = W.standAt(TENT_X);
        if (inC(tent.x, tent.y)) push({ t: 'ptent', x: tent.x, y: tent.y });
        if (inC(pl.nest.x, pl.nest.y)) push({ t: 'nest', x: pl.nest.x, y: pl.nest.y });
        if (s === 3 && inC(pl.crown.x, pl.crown.y - 1)) push({ t: 'crown', x: pl.crown.x, y: pl.crown.y - 1 });
      },
      buildEnt(G, e, px, py) {
        if (e.t === 'ptent' || e.t === 'nest') { G.ents.push({ k: e.t, x: px + T / 2, y: py }); return true; }
        if (e.t === 'crown') { G.ents.push({ k: 'crown', x: px + T / 2, y: py + T }); return true; }
        return false;
      },
      updateEnt(G, e, i, dt) {
        if (e.k === 'ptent') { if (Fun.stand(G, e, dt, { cx: e.x + 84, dx: 40, t: 0.6 })) talkPrincess(G); return true; }
        if (e.k === 'nest') { if (st(G.prof).step === 2 && Fun.stand(G, e, dt, { dx: 40, t: 0.6 })) atNest(G); return true; }
        if (e.k === 'crown') { if (e.gone) { G.ents.splice(i, 1); return true; } if (Fun.stand(G, e, dt, { dx: 40, dy: 50, t: 0.4 })) atCrown(G, e); return true; }
        return false;
      },
      drawEnt(g, e, t, G) {
        if (e.k === 'ptent') { drawTent(g, e, t, G); return true; }
        if (e.k === 'nest') { drawNest(g, e, t, G); return true; }
        if (e.k === 'crown') { drawCrown(g, e, t); return true; }
        return false;
      },
      drawHUD(g, G, vw, vh, t, text, W) { hud(g, G, vw, vh, t, text, W); },
      // Kurka Zosia knows where the magpie flew (farm.js asks this when you talk to her)
      henTalk(G, say) {
        const s = st(G.prof); if (s.step !== 1) return;
        const pl = places(LZ.World.gen());
        s.step = 2; S.save();
        say.push('Sroka? Ko ko, widziałam! Poleciała ' + (pl.side > 0 ? 'w prawo' : 'w lewo') + ', do krainy ' + LZ.World.BIOMES[pl.land].name + '. Ma gniazdo na wysokim, starym drzewie!');
      },
    },
  });

  LZ.Story = { places, goal, st, TENT_X };
})();
