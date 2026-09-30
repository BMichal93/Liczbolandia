/*
 * traders.js - travelling traders camping in the open world.
 *
 * Every 250 m along the surface (not right by the house) a trader has put
 * up a market stall. Each one sells a few things for coins (eggs, milk,
 * seeds, worms for fishing, pet treats, treasure maps), buys fish, fruit and
 * cakes (up to a daily limit, so coins stay precious), swaps a couple of
 * special things, and once a day asks a riddle with a small gift for the
 * right answer.
 *
 * Save data: fun.traders[k] = { d: dateKey, paid: coins paid today }.
 */
(function () {
  const U = LZ.U, S = LZ.S, A = LZ.A, Art = LZ.Art, Fun = LZ.Fun, Bag = LZ.Bag;
  const T = LZ.T;
  const EVERY = 250, DAILY_PAY = 60;

  const PEOPLE = [
    { name: 'Sowa Hania', char: 'owl', v: 0, stall: '#9d7bff' },
    { name: 'Kret Kazik', char: 'mole', v: 0, stall: '#ff8a3d' },
    { name: 'Kotka Kasia', char: 'cat', v: 1, stall: '#ff5e7e' },
    { name: 'Smoczek Bajtek', char: 'dragon', v: 0, stall: '#5cc15a' },
    { name: 'Jednorożka Lila', char: 'unicorn', v: 0, stall: '#5ccfff' },
    { name: 'Chomik Pączek', char: 'hamster', v: 1, stall: '#ffb020' },
  ];
  // things for coins: every trader has the basics and a few of the rest
  const BASIC = [['egg', 3], ['milk', 4], ['bait', 3]];
  const EXTRA = [['seed_blue', 8], ['seed_pumpkin', 12], ['seed_straw', 7], ['treat', 6], ['map', 30], ['seed_carrot', 5]];
  // swaps: give -> get (get is a backpack thing or furniture for the house)
  const SWAPS = [
    { give: [['fish_any', 3]], get: ['map', 1] },
    { give: [['carrot', 5]], get: ['seed_pumpkin', 2] },
    { give: [['straw', 4]], get: ['treat', 2] },
    { give: [['bread', 1]], get: ['bait', 4] },
    { give: [['blue', 5]], get: ['milk', 3] },
    { give: [['wheat', 5]], get: ['egg', 3] },
    { give: [['cake_carrot', 1]], furn: 'crystallamp' },
    { give: [['muffin', 1]], furn: 'telescope' },
    { give: [['pie_pumpkin', 1]], furn: 'fossil' },
    { give: [['cake_rainbow', 1]], furn: 'throne' },
    { give: [['fish_12', 1]], furn: 'fishtrophy' },
  ];
  function hash(a, b) { let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
  function trader(k, seed) {
    const r = U.rng(Math.floor(hash(k, seed) * 1e9));
    const who = PEOPLE[Math.floor(r() * PEOPLE.length)];
    const extra = U.shuffle(r, EXTRA.slice()).slice(0, 3);
    const swaps = U.shuffle(r, SWAPS.slice()).slice(0, 3);
    return { k, who, sell: BASIC.concat(extra), swaps };
  }
  const fishCount = p => Bag.FISH.reduce((s, f) => s + Bag.count(p, f.id), 0);
  const have = (p, id) => id === 'fish_any' ? fishCount(p) : Bag.count(p, id);
  function takeGive(p, id, n) {
    if (id !== 'fish_any') return Bag.take(p, id, n);
    // any fish: the most common ones go first
    for (let i = 0; i < n; i++) { const f = Bag.FISH.slice().sort((a, b) => Bag.count(p, b.id) - Bag.count(p, a.id))[0]; Bag.take(p, f.id); }
    return true;
  }
  function paidToday(p, k) { const f = Fun.state(p); const tr = f.traders[k]; return tr && tr.d === Fun.today() ? tr.paid : 0; }

  function open(G, e, W) {
    const p = G.prof, h = LZ.UI._h, tr = trader(e.kk, W.seed), f = Fun.state(p);
    let tab = 'buy';
    const tabs = h('div.funtabs'), box = h('div'), coins = h('p.funstep');
    const m = Fun.open([h('div.npchead', null, [LZ.UI._preview({ id: tr.who.char, variant: tr.who.v }, 80), h('h2', null, tr.who.name)]), coins, tabs, box, h('button.btn.mid', { onclick: () => m.close() }, 'Do widzenia!')]);
    function render(msg) {
      coins.innerHTML = ''; coins.appendChild(h('span', null, [h('span.coin-ico'), ' ' + p.coins]));
      tabs.innerHTML = '';
      [['buy', 'Kupuję'], ['sell', 'Sprzedaję'], ['swap', 'Wymiana'], ['riddle', 'Zagadka']].forEach(([k, n]) => tabs.appendChild(h('button.tab' + (tab === k ? '.on' : ''), { onclick: () => { tab = k; render(); } }, n)));
      box.innerHTML = '';
      if (msg) box.appendChild(h('p', null, msg));
      if (tab === 'buy') {
        box.appendChild(h('div.funrow', null, tr.sell.map(([id, price]) => {
          const blocked = id === 'map' && (f.map || Bag.count(p, 'map'));
          return h('button.funpick' + (p.coins < price || blocked ? '.dim' : ''), { onclick: () => buy(id, price, blocked) }, [Bag.icon(id, 40), Bag.ITEMS[id].name, h('small', null, [h('span.coin-ico'), ' ' + price + (Bag.count(p, id) ? ' · masz ' + Bag.count(p, id) : '')])]);
        })));
      } else if (tab === 'sell') {
        const left = DAILY_PAY - paidToday(p, e.kk);
        const ids = Object.keys(f.bag).filter(id => Bag.ITEMS[id] && Bag.ITEMS[id].sell > 0 && f.bag[id] > 0 && Bag.ITEMS[id].cat !== 'seed');
        if (left <= 0) box.appendChild(h('p', null, 'Na dziś mam już pełną sakiewkę wydaną. Przyjdź jutro!'));
        else if (!ids.length) box.appendChild(h('p', null, 'Kupię ryby, owoce z ogródka i ciasta. Na razie nic takiego nie masz.'));
        else {
          box.appendChild(h('p.note', null, 'Dziś mogę jeszcze zapłacić ' + left + ' monet.'));
          box.appendChild(h('div.funrow', null, ids.map(id => h('button.funpick' + (Bag.ITEMS[id].sell > left ? '.dim' : ''), { onclick: () => sell(id) }, [Bag.icon(id, 40), Bag.ITEMS[id].name, h('small', null, ['×' + f.bag[id] + ' · ', h('span.coin-ico'), ' ' + Bag.ITEMS[id].sell])]))));
        }
      } else if (tab === 'swap') {
        const L = h('div.funlist');
        tr.swaps.forEach(sw => {
          const ok = sw.give.every(([id, n]) => have(p, id) >= n);
          L.appendChild(h('div.funline', null, [
            h('div.grow', { style: 'display:flex;align-items:center;gap:6px;flex-wrap:wrap' }, sw.give.map(([id, n]) => h('span', { style: 'display:inline-flex;align-items:center;gap:3px' }, [id === 'fish_any' ? Bag.icon('fish_1', 30) : Bag.icon(id, 30), n + ' ' + (id === 'fish_any' ? 'dowolne ryby' : Bag.name(id, n).replace(/^\d+ /, ''))])).concat([h('b', null, ' → '),
              sw.furn ? h('span', null, ['🛋 ', h('b', null, LZ.Home.FURN_BY[sw.furn].name)]) : h('span', { style: 'display:inline-flex;align-items:center;gap:3px' }, [Bag.icon(sw.get[0], 30), Bag.name(sw.get[0], sw.get[1])])])),
            h('button.btn.small' + (ok ? '.primary' : ''), { onclick: () => swap(sw, ok) }, ok ? 'Wymień' : 'Brakuje'),
          ]));
        });
        box.appendChild(L);
      } else {
        if (Fun.doneToday(p, 'riddle' + e.kk)) { box.appendChild(h('p', null, 'Dzisiejszą zagadkę już rozwiązałaś. Jutro wymyślę nową!')); return; }
        const q = h('div'); box.appendChild(q);
        const things = U.pick(Math.random, [['jabłko', 'jabłka', 'jabłek'], ['gruszka', 'gruszki', 'gruszek'], ['orzech', 'orzechy', 'orzechów'], ['śliwka', 'śliwki', 'śliwek']]);
        Fun.ask(q, p, () => Fun.story(p, things, { place: 'Na straganie', gone: 'kupili goście' }), () => {
          Fun.onceToday(p, 'riddle' + e.kk);
          const gift = U.pick(Math.random, ['egg', 'milk', 'bait', 'seed_blue', 'treat']);
          Bag.add(p, gift, 1); p.coins += 5; p.stats.totalCoins += 5; S.save(); A.play('star');
          render('Brawo! Proszę: ' + Bag.name(gift, 1).toLowerCase() + ' i 5 monet.');
        }, { title: 'Zagadka handlarza' });
      }
    }
    function buy(id, price, blocked) {
      if (blocked) { A.play('bump'); render('Najpierw znajdź skarb z mapy, którą masz!'); return; }
      if (p.coins < price) { A.play('bump'); render('To kosztuje ' + price + ' monet, a masz ' + p.coins + '.'); return; }
      p.coins -= price; p.stats.purchases++; Bag.add(p, id); S.save(); A.play('buy');
      render('Proszę bardzo! ' + Bag.ITEMS[id].name + ' jest w plecaku.');
    }
    function sell(id) {
      const price = Bag.ITEMS[id].sell, paid = paidToday(p, e.kk);
      if (paid + price > DAILY_PAY) { A.play('bump'); render('Na to już dziś nie mam monet. Przyjdź jutro!'); return; }
      if (!Bag.take(p, id)) return;
      f.traders[e.kk] = { d: Fun.today(), paid: paid + price };
      p.coins += price; p.stats.totalCoins += price; S.save(); A.play('coin');
      render('Dziękuję! +' + price + ' monet.');
    }
    function swap(sw, ok) {
      if (!ok) { A.play('bump'); return; }
      sw.give.forEach(([id, n]) => takeGive(p, id, n));
      let got;
      if (sw.furn) { const home = LZ.Home.homeOf(p); home.inv[sw.furn] = (home.inv[sw.furn] || 0) + 1; got = LZ.Home.FURN_BY[sw.furn].name + ' - czeka w domku'; }
      else { Bag.add(p, sw.get[0], sw.get[1]); got = Bag.name(sw.get[0], sw.get[1]); }
      S.save(); A.play('buy');
      render('Wymiana udana! ' + got + '.');
    }
    render('Witaj, podróżniczko! Zajrzyj, co mam na straganie.');
  }

  /* ---------------- drawing: a market stall with a campfire ---------------- */
  function drawCamp(g, e, t, G) {
    const tr = trader(e.kk, LZ.World.gen().seed), x = e.x, y = e.y, rr = U.rr, fs = Art.fs;
    // stall: posts, counter with crates, striped awning
    g.fillStyle = '#8a5a32'; g.fillRect(x - 70, y - 120, 7, 120); g.fillRect(x + 63, y - 120, 7, 120);
    rr(g, x - 76, y - 48, 152, 48, 6); fs(g, '#c98a5a', '#6b4424', 2.5);
    for (let i = 0; i < 3; i++) { rr(g, x - 64 + i * 44, y - 64, 38, 20, 4); fs(g, '#e8b878', '#8a5a32', 2); Bag.draw(g, ['egg', 'milk', 'carrot'][i], x - 45 + i * 44, y - 70, t); }
    for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(x - 84 + i * 28, y - 128); g.lineTo(x - 56 + i * 28, y - 128); g.lineTo(x - 56 + i * 28, y - 108); g.quadraticCurveTo(x - 70 + i * 28, y - 98, x - 84 + i * 28, y - 108); g.closePath(); fs(g, i % 2 ? '#fff' : tr.who.stall, U.shade(tr.who.stall, -0.3), 1.5); }
    rr(g, x - 88, y - 142, 176, 16, 6); fs(g, tr.who.stall, U.shade(tr.who.stall, -0.3), 2);
    // the trader behind the counter
    Art.drawCharacter(g, x, y - 38, { id: tr.who.char, variant: tr.who.v, facing: G.player.x < x ? -1 : 1, t: t + e.kk, state: 'idle', scale: 1 });
    rr(g, x - 76, y - 48, 152, 48, 6); fs(g, '#c98a5a', '#6b4424', 2.5);
    g.fillStyle = '#fff6c9'; g.font = '800 15px "Baloo 2", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('STRAGAN', x, y - 24);
    // campfire
    const fx = x + 110;
    for (const d of [-10, 0, 10]) { g.save(); g.translate(fx + d, y - 4); g.rotate(d * 0.06); rr(g, -14, -3, 28, 6, 3); fs(g, '#8a5a32'); g.restore(); }
    for (let i = 0; i < 3; i++) { const fh = 18 + Math.sin(t * 9 + i * 2) * 5; g.beginPath(); g.moveTo(fx - 10 + i * 10, y - 6); g.quadraticCurveTo(fx - 14 + i * 10, y - 6 - fh / 2, fx - 8 + i * 10, y - 6 - fh); g.quadraticCurveTo(fx - 2 + i * 10, y - 6 - fh / 2, fx - 4 + i * 10, y - 6); fs(g, i % 2 ? '#ffd23f' : '#ff8a3d'); }
    Fun.bubble(g, x, y - 150 + Math.sin(t * 2) * 3, Fun.doneToday(G.prof, 'riddle' + e.kk) ? '🛒' : '?', '#ff8a3d');
    Fun.ring(g, x, y - 180, e, 0.6);
    g.fillStyle = 'rgba(58,36,110,0.75)'; rr(g, x - 64, y + 6, 128, 20, 8); g.fill();
    g.fillStyle = '#fff'; g.font = '700 13px "Baloo 2", sans-serif'; g.fillText(tr.who.name, x, y + 16);
  }

  LZ.Ext.add({
    world: {
      // (from defs rather than chunk: the dry spot may be a few steps into the next piece)
      defs(G, cx, cy, push, W) {
        const x0 = cx * 32;
        for (let x = Math.ceil((x0 - 125) / EVERY) * EVERY + 125; x < x0 + 32; x += EVERY) {
          if (x < x0 || Math.abs(x) < 100) continue;
          const st = W.standAt(x, true);
          if (Math.floor(st.y / 32) === cy) push({ t: 'camp', x: st.x, y: st.y, k: Math.round((x - 125) / EVERY) });
        }
      },
      buildEnt(G, e, px, py) { if (e.t !== 'camp') return false; G.ents.push({ k: 'camp', x: px + T / 2, y: py, kk: e.k }); return true; },
      updateEnt(G, e, i, dt, pc, W) { if (e.k !== 'camp') return false; if (Fun.stand(G, e, dt, { dx: 60, t: 0.6 })) open(G, e, W); return true; },
      drawEnt(g, e, t, G) { if (e.k !== 'camp') return false; drawCamp(g, e, t, G); return true; },
    },
  });

  LZ.Traders = { trader, open, PEOPLE, EVERY };
})();
