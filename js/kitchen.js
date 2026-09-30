/*
 * kitchen.js - baking in the house.
 *
 * The oven stands in the room (a gift the first time she comes home after
 * this update). She picks a recipe she has the ingredients for, measures
 * them (a maths story), sets the oven (another one) and watches it bake.
 * Garden fruit, eggs from Kurka Zosia and milk go in; a cake comes out.
 *
 * A cake can be eaten before an adventure (one extra heart for the next
 * trip), given to a neighbour in the open world (each has a favourite), or
 * sold to a trader.
 */
(function () {
  const U = LZ.U, S = LZ.S, A = LZ.A, Art = LZ.Art, Fun = LZ.Fun, Bag = LZ.Bag, M = LZ.M;
  const T = LZ.T;

  const RECIPES = [
    { id: 'bread', need: [['wheat', 3], ['milk', 1]], min: 20 },
    { id: 'cake_carrot', need: [['carrot', 3], ['egg', 1], ['wheat', 1]], min: 35 },
    { id: 'cake_straw', need: [['straw', 3], ['milk', 1], ['wheat', 1]], min: 30 },
    { id: 'muffin', need: [['blue', 3], ['egg', 1], ['milk', 1]], min: 25 },
    { id: 'pie_pumpkin', need: [['pumpkin', 1], ['egg', 2], ['wheat', 1]], min: 45 },
    { id: 'cake_rainbow', need: [['straw', 1], ['blue', 1], ['carrot', 1], ['egg', 2], ['milk', 1]], min: 50 },
  ];
  // each neighbour's favourite cake (by landscape)
  const FAV = { ice: 'muffin', forest: 'cake_carrot', desert: 'cake_straw', beach: 'bread', volcano: 'pie_pumpkin', factory: 'cake_straw', moon: 'cake_rainbow' };
  const THING = { wheat: ['kłos', 'kłosy', 'kłosów'], carrot: ['marchewka', 'marchewki', 'marchewek'], straw: ['truskawka', 'truskawki', 'truskawek'], blue: ['borówka', 'borówki', 'borówek'], pumpkin: ['dynia', 'dynie', 'dyń'], egg: ['jajko', 'jajka', 'jajek'] };
  const canBake = (p, r) => r.need.every(([id, n]) => Bag.count(p, id) >= n);

  /* the oven step: minutes left, or the oven warming up by the minute */
  function ovenQ(p, r) {
    const tier = Fun.tierOf(p);
    if (tier >= 4) {
      const k = U.pick(Math.random, tier === 4 ? [10, 20, 5] : [20, 30, 40]), n = U.ri(Math.random, 2, tier === 4 ? 9 : 6);
      return { q: 'Piekarnik grzeje się o ' + k + ' stopni na minutę. Ile stopni będzie po ' + n + ' minutach?', a: String(k * n), choices: M.numChoices(k * n, [k + n, k * n + k]), topic: 'mul' };
    }
    const tot = tier === 1 ? U.ri(Math.random, 6, 10) : tier === 2 ? U.ri(Math.random, 12, 20) : r.min, gone = U.ri(Math.random, 2, tot - 2);
    return { q: 'Ciasto piecze się ' + tot + ' minut. Minęło już ' + gone + '. Ile minut jeszcze?', a: String(tot - gone), choices: M.numChoices(tot - gone, [tot + gone]), topic: 'sub', visual: tier === 1 ? { type: 'dots', a: tot, b: gone, op: '-' } : null };
  }

  function drawOven(g, x, yb, w, t, glow) {
    const rr = U.rr, fs = Art.fs, h = 2 * T;
    rr(g, x + 2, yb - h + 8, w - 4, h - 8, 8); fs(g, '#fff6e8', '#b8a080', 2.5);
    rr(g, x - 2, yb - h + 2, w + 4, 12, 4); fs(g, '#e8dcc8', '#b8a080', 2);
    for (const d of [0.3, 0.7]) { Art.ell(g, x + w * d, yb - h + 3, 9, 3); fs(g, '#5a5a6a'); }
    for (let i = 0; i < 3; i++) { Art.ell(g, x + 16 + i * 18, yb - h + 26, 5, 5); fs(g, '#ff85b0', '#b8467a', 1.5); }
    rr(g, x + 10, yb - h + 40, w - 20, 44, 6); fs(g, '#3a2a3a', '#2a1a2a', 2);
    const a = glow ? 0.55 + 0.35 * Math.sin(t * 6) : 0.18;
    const gr = g.createLinearGradient(0, yb - h + 40, 0, yb - h + 84); gr.addColorStop(0, 'rgba(255,170,60,' + a + ')'); gr.addColorStop(1, 'rgba(255,90,40,' + a + ')');
    g.fillStyle = gr; rr(g, x + 14, yb - h + 44, w - 28, 36, 4); g.fill();
    g.fillStyle = '#b8a080'; g.fillRect(x + 16, yb - h + 34, w - 32, 4);
    rr(g, x + 6, yb - 8, w - 12, 8, 3); fs(g, '#e8dcc8');
    if (glow) for (let i = 0; i < 2; i++) { const k = (t * 0.5 + i / 2) % 1; Art.ell(g, x + w * 0.4 + k * 12, yb - h - k * 50, 6 + k * 6, 5 + k * 5); fs(g, 'rgba(255,255,255,' + (0.7 - k * 0.7) + ')'); }
  }

  function openKitchen(G) {
    const p = G.prof, h = LZ.UI._h;
    const box = h('div');
    const m = Fun.open([h('h2', null, '🧁 Pieczemy!'), box], () => clearInterval(iv));
    let iv = null;
    function list() {
      box.innerHTML = '';
      box.appendChild(h('p', null, 'Wybierz przepis. Składniki zbierzesz w ogródku, jajka da Kurka Zosia, a mleko kupisz u niej albo u handlarzy.'));
      const L = h('div.funlist');
      RECIPES.forEach(r => {
        const ok = canBake(p, r);
        L.appendChild(h('div.funline', null, [
          Bag.icon(r.id, 40),
          h('div.grow', null, [h('b', null, Bag.ITEMS[r.id].name), h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-size:14px' }, r.need.map(([id, n]) => h('span', { style: 'display:inline-flex;align-items:center;gap:2px;' + (Bag.count(p, id) >= n ? '' : 'color:#c0392b') }, [Bag.icon(id, 22), Bag.count(p, id) + '/' + n])))]),
          h('button.btn.small' + (ok ? '.primary' : ''), { onclick: () => ok ? bake(r) : A.play('bump') }, ok ? 'Piecz' : 'Brakuje'),
        ]));
      });
      box.appendChild(L);
      box.appendChild(h('button.btn.mid', { onclick: () => m.close() }, 'Zamknij'));
    }
    function bake(r) {
      const main = r.need[0][0];
      const q = h('div'); box.innerHTML = ''; box.appendChild(q);
      Fun.ask(q, p, () => Fun.story(p, THING[main] || THING.egg, { place: 'W misce', gone: 'wsypano do ciasta' }), () => {
        Fun.ask(q, p, () => ovenQ(p, r), () => { r.need.forEach(([id, n]) => Bag.take(p, id, n)); S.save(); anim(r); }, { title: 'Krok 2: ustaw piekarnik', cancel: list, cancelText: 'Wróć' });
      }, { title: 'Krok 1: odmierz składniki', cancel: list, cancelText: 'Wróć' });
    }
    function anim(r) {
      box.innerHTML = '';
      const c = document.createElement('canvas'); c.width = 360; c.height = 240; c.className = 'funcanvas'; c.style.width = '180px';
      const bar = h('i', { style: 'width:0%' });
      box.appendChild(c); box.appendChild(h('div.funbar', null, bar)); const msg = h('p', null, 'Piecze się...'); box.appendChild(msg);
      const g = c.getContext('2d'); const t0 = performance.now(); const LEN = 3.2;
      A.play('pop');
      iv = setInterval(() => {
        const t = (performance.now() - t0) / 1000, k = Math.min(1, t / LEN);
        g.setTransform(2, 0, 0, 2, 0, 0); g.clearRect(0, 0, 180, 120);
        drawOven(g, 54, 116, 72, t, k < 1);
        bar.style.width = Math.round(k * 100) + '%';
        if (k >= 1) {
          clearInterval(iv); iv = null;
          Bag.add(p, r.id);
          const bk = Fun.state(p).book.cakes; bk[r.id] = (bk[r.id] || 0) + 1;
          S.checkBadges(p); S.save(); A.play('star');
          box.innerHTML = '';
          box.appendChild(h('div.funrow', null, [Bag.icon(r.id, 90)]));
          box.appendChild(h('p', null, ['Gotowe! ', h('b', null, Bag.ITEMS[r.id].name), ' jest w plecaku. Możesz je zjeść przed wyprawą (dodatkowe serduszko), dać sąsiadce albo sprzedać handlarzowi.']));
          box.appendChild(h('div.funrow', null, [h('button.btn.mid.primary', { onclick: list }, 'Piecz dalej'), h('button.btn.mid', { onclick: () => m.close() }, 'Koniec')]));
          const G2 = LZ.Game._dbg(); if (G2) { const ov = G2.ents.find(e => e.k === 'furn' && e.id === 'oven'); if (ov) LZ.Game._confetti(ov.x + ov.w / 2, ov.y - 2 * T, 30); }
        }
      }, 33);
    }
    list();
  }

  /* ---------------- cakes from the backpack ---------------- */
  function eat(p, id) {
    const f = Fun.state(p);
    if (f.cakeBuff) { LZ.UI._alert('Mniam!', 'Masz już dodatkowe serduszko na następną wyprawę. Zachowaj ciasto na później!'); return false; }
    Bag.take(p, id); f.cakeBuff = 1; S.save(); A.play('heart');
    LZ.UI._alert('Mniam!', 'Na następnej wyprawie masz jedno serduszko więcej.');
    return true;
  }
  // a neighbour in the open world gets a cake (called from their talk window)
  function giftRow(G, e, m) {
    const p = G.prof, f = Fun.state(p), h = LZ.UI._h;
    const cakes = RECIPES.map(r => r.id).filter(id => Bag.count(p, id) > 0);
    if (!cakes.length) return;
    const key = 'gift' + e.band;
    if (f.gifts[key] === Fun.today()) { m.box.appendChild(h('p.note', null, 'Dziękuję za dzisiejsze ciasto!')); return; }
    const row = h('div.funrow', null, [h('span', { style: 'font-weight:700' }, '🎂 Daj ciasto:')].concat(cakes.map(id => h('button.funpick', { onclick: () => give(id) }, [Bag.icon(id, 36), h('small', null, Bag.ITEMS[id].name)]))));
    m.box.appendChild(row);
    function give(id) {
      Bag.take(p, id); f.gifts[key] = Fun.today();
      const fav = FAV[e.biome] === id;
      const first = fav && !f.gifts['fav' + e.band];
      let coins = fav ? 25 : 10, furn = null;
      if (first) { f.gifts['fav' + e.band] = 1; furn = U.pick(Math.random, ['crystallamp', 'cloudbed', 'aquarium', 'fireplace', 'telescope']); const home = LZ.Home.homeOf(p); home.inv[furn] = (home.inv[furn] || 0) + 1; }
      p.coins += coins; p.stats.totalCoins += coins;
      S.save(); A.play(fav ? 'win' : 'coin'); LZ.Game._confetti(e.x, e.y - 60, fav ? 30 : 12);
      row.innerHTML = '';
      row.appendChild(h('p', null, fav ? ['To moje ulubione! Dziękuję! Proszę: ', h('span.coin-ico'), ' ' + coins, furn ? [' i ', h('b', null, LZ.Home.FURN_BY[furn].name), ' do domku!'] : '.'] : ['Pyszne, dziękuję! Proszę: ', h('span.coin-ico'), ' ' + coins + '. A wiesz, że najbardziej lubię ' + Bag.ITEMS[FAV[e.biome]].name.toLowerCase() + '?']));
    }
  }

  LZ.Ext.add({
    home: {
      init(G) {
        const f = Fun.state(G.prof);
        if (!f.ovenGiven) {
          f.ovenGiven = true;
          const placed = LZ.Home.homeOf(G.prof).items.some(i => i.id === 'oven') || LZ.Home.autoPlace(G.prof, 'oven');
          LZ.Home.spawnFurniture(G); S.save();
          setTimeout(() => LZ.Game._toast(placed ? 'Nowość: piekarnik! Stań przy nim, żeby upiec ciasto.' : 'Nowość: piekarnik! Czeka w „Urządzaj” - postaw go w pokoju.', 3.2), 900);
        }
      },
      tick(G, dt) {
        const ov = G.ents.find(e => e.k === 'furn' && e.id === 'oven');
        if (ov && Fun.stand(G, ov, dt, { cx: ov.x + ov.w / 2, cy: ov.y, dx: ov.w / 2 + 6, t: 0.8 })) openKitchen(G);
      },
      drawHUD(g, G, vw, vh, t) {
        const ov = G.ents.find(e => e.k === 'furn' && e.id === 'oven');
        if (ov && ov._st > 0.05) { g.save(); g.translate(-G.cam.x, -G.cam.y); Fun.ring(g, ov.x + ov.w / 2, ov.y - 2 * T - 30, ov, 0.8); g.restore(); }
      },
    },
    world: {
      init(G) {
        const f = Fun.state(G.prof);
        if (f.cakeBuff) { f.cakeBuff = 0; G.maxHearts += 1; G.hearts = G.maxHearts; setTimeout(() => LZ.Game._toast('Ciasto dodało ci serduszko!', 2.2), 2600); }
      },
      npc(G, e, m) { giftRow(G, e, m); },
    },
    furn: { draw(g, id, X, Y, w, t) { if (id !== 'oven') return false; drawOven(g, X, Y, w, t, false); return true; } },
    bag: { actions(p, id, acts) { if (Bag.ITEMS[id] && Bag.ITEMS[id].cat === 'cake') acts.push({ label: 'Zjedz', fn: (m, render) => { if (eat(p, id)) m.close(); } }); } },
  });

  LZ.Kitchen = { RECIPES, FAV, open: openKitchen, canBake, drawOven, eat };
})();
