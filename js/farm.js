/*
 * farm.js - the vegetable garden next to the house, and Kurka Zosia.
 *
 * Six garden beds stand in the open world just left of the house. She plants
 * a seed from the backpack, the plant grows in real time (minutes to a few
 * hours; watering makes it grow twice as fast, and so does rain), and a ripe
 * bed is harvested with a little maths story. What grows goes into the
 * backpack: for baking, trading and gifts.
 *
 * Kurka Zosia, the hen by the garden, gives the first seeds, lays an egg for
 * her every day and sells the easy seeds.
 *
 * Save data (profile.fun.garden): plots[i] = { crop, at, wat } (times in ms),
 * started (she met Zosia).
 */
(function () {
  const U = LZ.U, S = LZ.S, A = LZ.A, Art = LZ.Art, Fun = LZ.Fun, Bag = LZ.Bag;
  const T = LZ.T;

  // minutes to ripen (without water), and how many she picks
  const CROPS = {
    carrot: { min: 20, get: [3, 5], name: 'Marchewka' },
    wheat: { min: 40, get: [3, 5], name: 'Pszenica' },
    straw: { min: 60, get: [3, 6], name: 'Truskawki' },
    blue: { min: 120, get: [4, 7], name: 'Borówki' },
    pumpkin: { min: 180, get: [1, 2], name: 'Dynia' },
  };
  const THINGS = { carrot: ['marchewka', 'marchewki', 'marchewek'], wheat: ['kłos', 'kłosy', 'kłosów'], straw: ['truskawka', 'truskawki', 'truskawek'], blue: ['borówka', 'borówki', 'borówek'], pumpkin: ['dynia', 'dynie', 'dyń'] };
  const PLOTS = [-23, -20, -17, -14, -11, -8];   // left edge of each 2-tile bed (world x)
  const HEN_X = -30;
  const SEED_SHOP = [['seed_carrot', 5], ['seed_wheat', 5], ['seed_straw', 8], ['milk', 4]];   // milk from the cow next door, for baking

  const garden = p => { const g = Fun.state(p).garden; while (g.plots.length < PLOTS.length) g.plots.push(null); return g; };
  function growth(pl, now) {
    if (!pl) return 0;
    now = now || Date.now();
    const ms = CROPS[pl.crop].min * 60000;
    const t = (now - pl.at) + (pl.wat ? Math.max(0, now - pl.wat) : 0);
    return Math.min(1, t / ms);
  }
  const stage = g => g >= 1 ? 3 : g >= 0.6 ? 2 : g >= 0.25 ? 1 : 0;
  function timeLeft(pl) {
    const now = Date.now(), g = growth(pl, now), ms = CROPS[pl.crop].min * 60000;
    const speed = pl.wat ? 2 : 1;
    const min = Math.max(1, Math.ceil((1 - g) * ms / speed / 60000));
    return min >= 60 ? 'ok. ' + Math.round(min / 60 * 2) / 2 + ' godz.' : min + ' min';
  }
  // rain waters every bed (weather in adventure.js calls this)
  function rainOnGarden(p) {
    const now = Date.now(); let n = 0;
    garden(p).plots.forEach(pl => { if (pl && !pl.wat && growth(pl, now) < 1) { pl.wat = now; n++; } });
    return n;
  }

  /* ================= the bed's menu ================= */
  function openPlot(G, e) {
    const p = G.prof, gd = garden(p), h = LZ.UI._h;
    const box = h('div');
    const m = Fun.open([h('h2', null, 'Grządka ' + (e.i + 1)), box]);
    const close = () => m.close();
    function render() {
      box.innerHTML = '';
      const pl = gd.plots[e.i];
      if (!pl) {
        const seeds = Object.keys(CROPS).filter(c => Bag.count(p, 'seed_' + c) > 0);
        if (!seeds.length) {
          box.appendChild(h('p', null, 'Pusta grządka, ale nie masz nasion. Kurka Zosia obok sprzedaje nasiona, a inne znajdziesz w skrzyniach i u handlarzy.'));
          box.appendChild(h('button.btn.mid.primary', { onclick: close }, 'Dobrze'));
          return;
        }
        box.appendChild(h('p', null, 'Co posadzisz?'));
        box.appendChild(h('div.funrow', null, seeds.map(c => h('button.funpick', { onclick: () => plant(c) }, [Bag.icon('seed_' + c, 44), CROPS[c].name, h('small', null, '×' + Bag.count(p, 'seed_' + c) + ' · ' + (CROPS[c].min >= 60 ? CROPS[c].min / 60 + ' godz.' : CROPS[c].min + ' min'))]))));
        box.appendChild(h('button.btn.small.ghost', { onclick: close }, 'Nie teraz'));
        return;
      }
      const g = growth(pl);
      if (g >= 1) {
        box.appendChild(h('p', null, CROPS[pl.crop].name + ' urosła! Zbieramy?'));
        box.appendChild(h('button.btn.mid.primary', { onclick: harvest }, '🧺 Zbieraj'));
        box.appendChild(h('button.btn.small.ghost', { onclick: close }, 'Później'));
        return;
      }
      box.appendChild(h('p', null, CROPS[pl.crop].name + ' rośnie. Będzie gotowa za ' + timeLeft(pl) + '.'));
      box.appendChild(h('div.funbar', null, h('i', { style: 'width:' + Math.round(g * 100) + '%' })));
      if (!pl.wat) box.appendChild(h('button.btn.mid.primary', { onclick: () => { pl.wat = Date.now(); A.play('splash'); S.save(); e.splash = 1.2; close(); LZ.Game._toast('Podlane! Teraz urośnie dwa razy szybciej.', 2.2); } }, '💧 Podlej'));
      else box.appendChild(h('p.note', null, 'Podlane - rośnie dwa razy szybciej.'));
      box.appendChild(h('button.btn.small.ghost', { onclick: close }, 'OK'));
    }
    function plant(c) {
      if (!Bag.take(p, 'seed_' + c)) return;
      gd.plots[e.i] = { crop: c, at: Date.now(), wat: 0 };
      S.save(); A.play('coin'); close();
      LZ.Game._toast('Posadzone! ' + CROPS[c].name + ' będzie gotowa za ' + timeLeft(gd.plots[e.i]) + '.', 2.6);
    }
    function harvest() {
      const pl = gd.plots[e.i], c = pl.crop, cr = CROPS[c];
      const n = U.ri(Math.random, cr.get[0], cr.get[1]);
      box.innerHTML = '';
      const q = h('div'); box.appendChild(q);
      const have = Bag.count(p, c);
      // the story is about this very harvest: what's in the basket plus what she picked
      Fun.ask(q, p, () => {
        const tier = Fun.tierOf(p);
        if (tier >= 4) return Fun.story(p, THINGS[c], { tier });
        const a = have > 0 && have + n <= (tier <= 1 ? 10 : tier === 2 ? 20 : 100) ? have : U.ri(Math.random, 1, tier <= 1 ? 10 - n : 12);
        return { q: 'W koszyku ' + U.plural(a, 'jest ', 'są ', 'jest ') + Fun.nf(a, THINGS[c]) + '. Zbierasz jeszcze ' + n + '. Ile będzie razem?', a: String(a + n), choices: LZ.M.numChoices(a + n, [a + n + 1]), topic: 'add', visual: tier <= 1 ? { type: 'dots', a, b: n, op: '+' } : null };
      }, () => {
        Bag.add(p, c, n);
        gd.plots[e.i] = null;
        const bk = Fun.state(p).book.crops; bk[c] = (bk[c] || 0) + n;
        // sometimes a seed falls out of a ripe plant, so the garden can go on by itself
        const seed = Math.random() < 0.6 ? 1 + (Math.random() < 0.3 ? 1 : 0) : 0;
        if (seed) Bag.add(p, 'seed_' + c, seed);
        S.checkBadges(p); S.save(); A.play('star'); LZ.Game._confetti(e.x + T, e.y - 30, 25);
        box.innerHTML = '';
        box.appendChild(h('div.funrow', null, [Bag.icon(c, 56)]));
        box.appendChild(h('p', null, ['Do plecaka: ', h('b', null, Bag.name(c, n)), seed ? ' i ' + Bag.name('seed_' + c, seed).toLowerCase() + '.' : '.']));
        box.appendChild(h('button.btn.mid.primary', { onclick: close }, 'Super!'));
      }, { title: 'Zbiory!', cancel: render });
    }
    render();
  }

  /* ================= Kurka Zosia ================= */
  function talkHen(G, e) {
    const p = G.prof, gd = garden(p), h = LZ.UI._h;
    const box = h('div');
    const m = Fun.open([h('div.npchead', null, [henPic(), h('h2', null, 'Kurka Zosia')]), box]);
    const close = () => m.close();
    const say = [];
    if (!gd.started) {
      gd.started = true;
      Bag.add(p, 'seed_carrot', 3); Bag.add(p, 'seed_wheat', 2); Bag.add(p, 'seed_straw', 2);
      say.push('Ko ko! Jestem Zosia, twoja sąsiadka. To twój ogródek! Masz tu nasiona na początek: 3 marchewki, 2 pszenice i 2 truskawki. Posadź je w grządkach - stań przy grządce, a zobaczysz.');
    }
    if (Fun.onceToday(p, 'egg')) {
      const n = 1 + (Math.random() < 0.4 ? 1 : 0);
      Bag.add(p, 'egg', n);
      say.push(n > 1 ? 'Zniosłam dziś dwa jajka. Weź je, przydadzą się do ciasta!' : 'Zniosłam dziś jajko. Weź je, przyda się do ciasta!');
    } else if (!say.length) say.push('Ko ko! Po następne jajko przyjdź jutro.');
    S.save();
    function render(msg) {
      box.innerHTML = '';
      box.appendChild(h('p', null, msg || say.join(' ')));
      box.appendChild(h('p.funstep', null, 'Na sprzedaż:'));
      box.appendChild(h('div.funrow', null, SEED_SHOP.map(([id, price]) => h('button.funpick' + (p.coins < price ? '.dim' : ''), { onclick: () => buy(id, price) }, [Bag.icon(id, 40), Bag.ITEMS[id].name, h('small', null, [h('span.coin-ico'), ' ' + price])]))));
      box.appendChild(h('button.btn.mid.primary', { onclick: close }, 'Pa pa, Zosiu!'));
    }
    function buy(id, price) {
      if (p.coins < price) { A.play('bump'); render('Ko ko, to kosztuje ' + price + ' monet, a masz ' + p.coins + '.'); return; }
      p.coins -= price; Bag.add(p, id); A.play('buy'); S.save();
      render('Proszę bardzo! Masz już ' + Bag.name(id, Bag.count(p, id)).toLowerCase() + '.');
    }
    render();
  }
  function henPic() {
    const c = document.createElement('canvas'); c.width = 160; c.height = 160; c.style.width = c.style.height = '80px';
    const g = c.getContext('2d'); g.scale(2, 2); drawHen(g, 40, 70, 0.5, 1.4); return c;
  }

  /* ================= drawing ================= */
  function drawHen(g, x, y, t, s) {
    const ell = Art.ell, fs = Art.fs;
    g.save(); g.translate(x, y); g.scale(s || 1, s || 1);
    const peck = Math.max(0, Math.sin(t * 2.2)) > 0.93 ? 5 : 0;
    g.strokeStyle = '#e0a000'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-4, -8); g.lineTo(-5, 0); g.moveTo(4, -8); g.lineTo(5, 0); g.stroke();
    ell(g, -12, -22, 8, 10, -0.5); fs(g, '#fff', '#c9b8a0', 1.5);
    ell(g, 0, -18, 15, 12); fs(g, '#fff', '#c9b8a0', 2);
    ell(g, -2, -18, 8, 6, 0.3); fs(g, '#f3eadc', '#c9b8a0', 1.2);
    g.save(); g.translate(10, -30 + peck); ell(g, 0, 0, 8, 8); fs(g, '#fff', '#c9b8a0', 2);
    ell(g, -1, -9, 3, 4); fs(g, '#ff5e5e'); ell(g, 3, -8, 3, 3.5); fs(g, '#ff5e5e');
    Art.tri(g, 6, -2, 12, 1, 6, 3); fs(g, '#ffb020', '#c47a00', 1);
    ell(g, 7, 4, 2, 3); fs(g, '#ff5e5e');
    ell(g, 2, -2, 1.6, 1.8); fs(g, '#222');
    g.restore();
    g.restore();
  }
  function drawCoop(g, x, y) {
    const rr = U.rr, fs = Art.fs;
    rr(g, x - 40, y - 64, 80, 64, 4); fs(g, '#e8b878', '#8a5a32', 2.5);
    g.strokeStyle = 'rgba(138,90,50,0.4)'; g.lineWidth = 2; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(x - 40, y - 64 + i * 16); g.lineTo(x + 40, y - 64 + i * 16); g.stroke(); }
    g.beginPath(); g.moveTo(x - 50, y - 60); g.lineTo(x, y - 94); g.lineTo(x + 50, y - 60); g.closePath(); fs(g, '#ff6f61', '#a8342a', 2.5);
    rr(g, x - 14, y - 34, 28, 34, 12); fs(g, '#5c3a1c');
    g.strokeStyle = '#8a5a32'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 14, y - 8); g.lineTo(x + 40, y + 2); g.stroke();
  }
  function drawPlot(g, e, t, G) {
    const x = e.x, y = e.y, w = 2 * T, pl = garden(G.prof).plots[e.i];
    const wet = pl && pl.wat;
    // a raised bed: wooden frame, dark soil with furrows on top
    U.rr(g, x + 3, y - 22, w - 6, 24, 5); Art.fs(g, '#c98a5a', '#6b4424', 2.5);
    g.strokeStyle = 'rgba(107,68,36,0.45)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 5, y - 10); g.lineTo(x + w - 5, y - 10); g.stroke();
    g.beginPath(); g.ellipse(x + w / 2, y - 22, w / 2 - 6, 9, 0, Math.PI, 0); g.closePath(); Art.fs(g, wet ? '#5c3a1c' : '#8a5a32', '#4a2c12', 2);
    g.fillStyle = wet ? 'rgba(20,10,5,0.35)' : 'rgba(60,34,14,0.45)'; for (let i = 0; i < 4; i++) g.fillRect(x + 14 + i * 18, y - 25 + Math.abs(i - 1.5) * 1.5, 10, 2.5);
    if (wet) { g.fillStyle = 'rgba(120,200,255,0.5)'; for (let i = 0; i < 3; i++) { Art.ell(g, x + 22 + i * 26, y - 20, 4, 1.6); g.fill(); } }
    if (e.splash > 0) {
      e.splash -= 1 / 60;
      for (let i = 0; i < 6; i++) { const k = (t * 3 + i / 6) % 1; Art.ell(g, x + 12 + i * 14, y - 40 + k * 30, 2, 4); Art.fs(g, 'rgba(90,180,255,' + (1 - k) + ')'); }
    }
    if (!pl) return;
    const st = stage(growth(pl)), c = pl.crop;
    for (let i = 0; i < 3; i++) {
      const px = x + 18 + i * 30, sw = Math.sin(t * 2 + i + e.i) * 0.08;
      g.save(); g.translate(px, y - 24); g.rotate(sw);
      if (st === 0) { Art.ell(g, 0, 0, 4, 2.5); Art.fs(g, '#5c3a1c'); Art.ell(g, 0, -3, 2, 3); Art.fs(g, '#7be08a'); }
      else if (st === 1) { for (const a of [-0.6, 0.6]) { g.save(); g.rotate(a); Art.ell(g, 0, -7, 3, 7); Art.fs(g, '#5cc15a', '#2f7a2a', 1); g.restore(); } }
      else plant(g, c, st === 3, t);
      g.restore();
    }
    if (st === 3) { g.globalAlpha = 0.5 + 0.5 * Math.sin(t * 4); Art.starPath(g, x + w / 2, y - 84, 8, 3.5, 5, t); Art.fs(g, '#fff6c9', '#e0a000', 1.5); g.globalAlpha = 1; }
    Fun.ring(g, x + w / 2, y - 104, e, 0.5);
  }
  // a grown plant, from the soil up (ripe shows the fruit)
  function plant(g, c, ripe, t) {
    const ell = Art.ell, fs = Art.fs;
    switch (c) {
      case 'carrot':
        for (const a of [-0.5, 0, 0.5]) { g.save(); g.rotate(a); ell(g, 0, -11, 3.5, 11); fs(g, '#5cc15a', '#2f7a2a', 1); g.restore(); }
        if (ripe) { g.beginPath(); g.moveTo(-6, 2); g.lineTo(6, 2); g.lineTo(0, -6); g.closePath(); fs(g, '#ff8a3d', '#c4621c', 1.2); }
        break;
      case 'wheat':
        g.strokeStyle = ripe ? '#c9a012' : '#7bbf4a'; g.lineWidth = 2;
        for (const d of [-5, 0, 5]) { g.beginPath(); g.moveTo(d, 0); g.lineTo(d, -26); g.stroke(); for (let k = 0; k < 3; k++) { ell(g, d - 2, -26 + k * 5, 2, 3, -0.4); fs(g, ripe ? '#ffd23f' : '#9cd66a'); ell(g, d + 2, -26 + k * 5, 2, 3, 0.4); fs(g, ripe ? '#ffd23f' : '#9cd66a'); } }
        break;
      case 'straw':
        for (const [a, b] of [[-7, -8], [7, -8], [0, -14]]) { ell(g, a, b, 8, 6); fs(g, '#5cc15a', '#2f7a2a', 1); }
        if (ripe) for (const [a, b] of [[-8, -3], [6, -2], [0, -8]]) { ell(g, a, b, 3.5, 4); fs(g, '#ff5e7e', '#a3223f', 1); }
        break;
      case 'blue':
        ell(g, 0, -14, 13, 12); fs(g, '#4f9a4a', '#2f6a2a', 1.5);
        if (ripe) for (const [a, b] of [[-6, -16], [5, -18], [0, -9], [8, -10], [-8, -8]]) { ell(g, a, b, 3, 3); fs(g, '#5a6ad8', '#2a3488', 1); }
        break;
      case 'pumpkin':
        g.strokeStyle = '#4f9a4a'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-12, -2); g.quadraticCurveTo(0, -12, 12, -4); g.stroke();
        ell(g, -8, -8, 6, 4); fs(g, '#5cc15a', '#2f7a2a', 1); ell(g, 8, -8, 6, 4); fs(g, '#5cc15a', '#2f7a2a', 1);
        if (ripe) { for (const [a, w] of [[-6, 7], [6, 7], [0, 8]]) { ell(g, a, -8, w, 9); fs(g, '#ff9a3d', '#c4621c', 1.5); } }
        else { ell(g, 0, -4, 5, 4); fs(g, '#b8d96a', '#6b8a3a', 1); }
        break;
    }
  }
  function drawGardenSign(g, x, y) {
    g.fillStyle = '#8a5a32'; g.fillRect(x - 3, y - 60, 6, 60);
    U.rr(g, x - 50, y - 84, 100, 30, 8); Art.fs(g, '#fff6c9', '#8a5a32', 2.5);
    g.fillStyle = '#4f9a4a'; g.font = '800 18px "Baloo 2", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Ogródek', x, y - 69);
  }

  /* ================= hooking into the open world ================= */
  LZ.Ext.add({
    world: {
      defs(G, cx, cy, push, W) {
        if (cx !== -1 || cy !== 0) return;   // the garden lives in the piece left of the house
        PLOTS.forEach((x, i) => push({ t: 'plot', x, y: 0, i }));
        push({ t: 'gsign', x: PLOTS[0] - 2, y: 0 });
        const st = W.standAt(HEN_X);
        push({ t: 'hen', x: st.x, y: st.y });
      },
      buildEnt(G, e, px, py) {
        if (e.t === 'plot') { G.ents.push({ k: 'plot', x: px, y: py, i: e.i }); return true; }
        if (e.t === 'hen') { G.ents.push({ k: 'hen', x: px + T / 2, y: py, hx: 0, f: 1 }); return true; }
        if (e.t === 'gsign') { G.ents.push({ k: 'gsign', x: px + T / 2, y: py }); return true; }
        return false;
      },
      updateEnt(G, e, i, dt) {
        if (e.k === 'plot') { if (Fun.stand(G, e, dt, { cx: e.x + T, cy: e.y, dx: T - 6, t: 0.5 })) openPlot(G, e); return true; }
        if (e.k === 'hen') {
          // Zosia potters about in front of her coop
          e.hx += dt * 0.6; const tx = Math.sin(e.hx) * 36; e.f = Math.cos(e.hx) >= 0 ? 1 : -1; e.dx = tx;
          if (Fun.stand(G, e, dt, { cx: e.x + tx, dx: 50, t: 0.5 })) talkHen(G, e);
          return true;
        }
        return e.k === 'gsign';
      },
      drawEnt(g, e, t, G) {
        if (e.k === 'plot') { drawPlot(g, e, t, G); return true; }
        if (e.k === 'gsign') { drawGardenSign(g, e.x, e.y); return true; }
        if (e.k === 'hen') {
          drawCoop(g, e.x - 70, e.y);
          g.save(); g.translate(e.x + (e.dx || 0), 0); g.scale(e.f, 1); drawHen(g, 0, e.y, t, 1); g.restore();
          const p = G.prof;
          if (!garden(p).started || !Fun.doneToday(p, 'egg')) Fun.bubble(g, e.x + (e.dx || 0), e.y - 58 + Math.sin(t * 3) * 2, garden(p).started ? '🥚' : '!', '#ff8a3d');
          Fun.ring(g, e.x + (e.dx || 0), e.y - 90, e, 0.5);
          g.fillStyle = 'rgba(58,36,110,0.75)'; U.rr(g, e.x - 50, e.y + 6, 100, 20, 8); g.fill();
          g.fillStyle = '#fff'; g.font = '700 13px "Baloo 2", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Kurka Zosia', e.x, e.y + 16);
          return true;
        }
        return false;
      },
      // chests sometimes hold a packet of seeds
      loot(p, tier, loot) {
        if (Math.random() < 0.3) {
          const c = U.pick(Math.random, tier >= 2 ? ['blue', 'pumpkin', 'straw'] : ['carrot', 'wheat', 'straw', 'blue']);
          const n = 2 + Math.floor(Math.random() * 2);
          Bag.add(p, 'seed_' + c, n); loot.push({ kind: 'bag', id: 'seed_' + c, n });
          return true;
        }
        return false;
      },
    },
  });

  LZ.Farm = { CROPS, PLOTS, HEN_X, garden, growth, stage, rainOnGarden, drawHen, plant };
})();
