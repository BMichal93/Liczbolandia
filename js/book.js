/*
 * book.js - "Księga odkryć": everything she has found in the open world.
 *
 * Four pages: the creatures she has met (and how many she hopped on), the
 * fish album, the garden and the kitchen, and the places (landscapes,
 * statues, the sky, the deep, rides, guardians, treasure). Every 5
 * discoveries earn a reward she collects from the book.
 */
(function () {
  const U = LZ.U, S = LZ.S, A = LZ.A, Art = LZ.Art, Fun = LZ.Fun, Bag = LZ.Bag, D = LZ.D;
  const T = LZ.T;

  const CREATURES = ['slime', 'hedgehog', 'shroom', 'snowball', 'robot', 'alien', 'scorpion', 'cactus', 'bee', 'bat', 'cloudy', 'ufo', 'vulture', 'fish'];
  const CROPS = ['carrot', 'wheat', 'straw', 'blue', 'pumpkin'];
  const CAKES = ['bread', 'cake_carrot', 'cake_straw', 'muffin', 'pie_pumpkin', 'cake_rainbow'];
  const LANDS = ['meadow', 'ice', 'forest', 'desert', 'beach', 'volcano', 'factory', 'moon'];
  const OTHER = [['sky', 'Wyspy w chmurach'], ['deep', 'Głębia 40 m'], ['guard', 'Strażnik Głębin'], ['dig', 'Wykopany skarb'], ['cart', 'Jazda wagonikiem'], ['boat', 'Rejs łódką'], ['balloon', 'Lot balonem'], ['ore', 'Wydobyta ruda'], ['race', 'Wygrany wyścig'], ['meteor', 'Deszcz meteorów']];
  const stickerName = id => (D.STICKERS.find(s => s.id === id) || { name: id }).name;

  // every discovery, as [page, key, done]
  function entries(p) {
    const f = Fun.state(p), b = f.book, ws = LZ.World.worldSave(p);
    const lm = Object.values(ws.landmarks || {});
    const out = [];
    CREATURES.forEach(id => out.push(['cre', id, !!b.seen[id]]));
    Bag.FISH.forEach(fi => out.push(['fish', fi.id, !!b.fish[fi.id]]));
    CROPS.forEach(id => out.push(['farm', id, !!b.crops[id]]));
    CAKES.forEach(id => out.push(['farm', id, !!b.cakes[id]]));
    LANDS.forEach(id => out.push(['place', 'b_' + id, !!b.places['b_' + id]]));
    Object.keys(LZ.World.LANDMARKS).forEach(id => out.push(['place', 'lm_' + id, lm.includes(id)]));
    const other = { sky: !!ws.sky, deep: (ws.maxDepth || 0) >= 40, guard: !!b.places.guard, dig: (f.maps || 0) > 0, cart: !!b.places.cart, boat: !!b.places.boat, balloon: !!b.places.balloon, ore: !!b.places.ore, race: !!b.places.race, meteor: !!b.places.meteor };
    OTHER.forEach(([id]) => out.push(['place', id, other[id]]));
    return out;
  }
  const found = p => entries(p).filter(e => e[2]).length;
  // what the n-th reward (1, 2, 3...) gives
  function reward(n) {
    if (n === 2) return { coins: 20, furn: 'fishtrophy', text: 'Złoty karp na ścianie' };
    if (n === 5) return { coins: 20, bag: [['map', 1], ['treat', 3]], text: 'Mapa skarbów i 3 smakołyki' };
    if (n % 4 === 0) return { coins: 50, text: '' };
    return { coins: 20, text: '' };
  }

  function open(tab) {
    const p = S.active(); if (!p) return;
    const f = Fun.state(p), b = f.book, h = LZ.UI._h;
    tab = tab || 'cre';
    const head = h('div'), tabs = h('div.funtabs'), body = h('div');
    const m = Fun.open([h('h2', null, '📖 Księga odkryć'), head, tabs, body, h('button.btn.mid', { onclick: () => m.close() }, 'Zamknij')]);
    function render() {
      const all = entries(p), n = all.filter(e => e[2]).length, can = Math.floor(n / 5) - b.claimed;
      head.innerHTML = '';
      head.appendChild(h('div.funbar', null, h('i', { style: 'width:' + Math.round(n / all.length * 100) + '%' })));
      head.appendChild(h('p', null, ['Odkrycia: ', h('b', null, n + ' / ' + all.length), can > 0 ? '' : ' · następna nagroda za ' + (5 - n % 5)]));
      if (can > 0) head.appendChild(h('button.btn.mid.primary.pulse', { onclick: claim }, '🎁 Odbierz nagrodę'));
      tabs.innerHTML = '';
      [['cre', 'Stworki'], ['fish', 'Ryby'], ['farm', 'Ogród i kuchnia'], ['place', 'Miejsca']].forEach(([k, name]) => tabs.appendChild(h('button.tab' + (tab === k ? '.on' : ''), { onclick: () => { tab = k; render(); } }, name)));
      body.innerHTML = '';
      const grid = h('div.bookgrid');
      all.filter(e => e[0] === tab).forEach(([, id, done]) => grid.appendChild(cell(tab, id, done)));
      body.appendChild(grid);
    }
    function cell(tab, id, done) {
      const c = document.createElement('canvas'); c.width = 128; c.height = 104; c.style.width = '64px'; c.style.height = '52px';
      const g = c.getContext('2d'); g.scale(2, 2);
      let name = '', sub = '';
      if (tab === 'cre') {
        g.translate(32, 30); Art.drawSticker(g, id, 44, 0.5);
        name = done ? stickerName(id) : '???'; sub = done && b.seen[id].k ? 'Hop ×' + b.seen[id].k : '';
      } else if (tab === 'fish') {
        const fi = Bag.FISH.find(x => x.id === id);
        Bag.drawFish(g, fi, 32, 26, 1.5, 0.5);
        name = done ? fi.name : '???'; sub = done ? '×' + b.fish[id].n + ' · ' + b.fish[id].cm + ' cm' : fi.night ? 'Tylko nocą' : fi.rain ? 'Tylko w deszcz' : '';
      } else if (tab === 'farm') {
        Bag.draw(g, id, 32, 26, 0.5);
        name = Bag.ITEMS[id].name; sub = done ? '×' + (b.crops[id] || b.cakes[id]) : CROPS.includes(id) ? 'Zbierz z grządki' : 'Upiecz';
      } else {
        drawPlace(g, id);
        name = placeName(id); sub = '';
      }
      return h('div.bookcell' + (done || tab === 'place' || tab === 'farm' ? '' : '.no'), { style: !done && (tab === 'place' || tab === 'farm') ? 'opacity:.45' : '' }, [c, h('div', null, name), sub ? h('small', null, sub) : null]);
    }
    function claim() {
      b.claimed++;
      const r = reward(b.claimed);
      p.coins += r.coins; p.stats.totalCoins += r.coins;
      if (r.furn) { const home = LZ.Home.homeOf(p); home.inv[r.furn] = (home.inv[r.furn] || 0) + 1; }
      (r.bag || []).forEach(([id, n]) => Bag.add(p, id, n));
      S.save(); A.play('win');
      LZ.UI._alert('Nagroda!', '+' + r.coins + ' monet' + (r.text ? ' i ' + r.text : '') + '. Tak trzymaj, odkrywczyni!', () => render());
    }
    render();
  }
  function placeName(id) {
    if (id.startsWith('b_')) return LZ.World.BIOMES[id.slice(2)].name;
    if (id.startsWith('lm_')) return LZ.World.LANDMARKS[id.slice(3)].name;
    return (OTHER.find(o => o[0] === id) || [0, id])[1];
  }
  // a little picture for a place
  function drawPlace(g, id) {
    const Wd = D.WORLDS;
    if (id.startsWith('b_') || id.startsWith('lm_')) {
      const bk = id.slice(id.indexOf('_') + 1), bi = LZ.World.BIOMES[bk], pal = Wd[bi.w - 1].pal;
      const sky = g.createLinearGradient(0, 0, 0, 52); sky.addColorStop(0, pal.skyTop); sky.addColorStop(1, pal.skyBot);
      U.rr(g, 2, 2, 60, 48, 8); g.fillStyle = sky; g.fill();
      g.fillStyle = pal.mid; g.beginPath(); g.moveTo(2, 40); g.quadraticCurveTo(20, 20, 36, 34); g.quadraticCurveTo(50, 22, 62, 36); g.lineTo(62, 50); g.lineTo(2, 50); g.fill();
      g.fillStyle = pal.grass; g.fillRect(2, 40, 60, 10);
      if (id.startsWith('lm_')) { g.save(); g.translate(32, 40); g.scale(0.22, 0.22); Art.drawBoss(g, { kind: LZ.World.LANDMARKS[bk].boss, x: -55, y: -150, w: 110, h: 150, dir: 1, flash: 0, phase: 'intro', look: 0 }, 0); g.restore(); }
      return;
    }
    const icons = { sky: '☁️', deep: '💎', guard: '🦉', dig: '❌', cart: '🚃', boat: '⛵', balloon: '🎈', ore: '⛏️', race: '🏁', meteor: '🌠' };
    U.rr(g, 2, 2, 60, 48, 8); g.fillStyle = '#e8dcff'; g.fill();
    g.font = '28px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(icons[id] || '?', 32, 27);
  }

  LZ.Ext.add({
    world: {
      buttons(l) { l.push({ label: '📖', fn: () => open() }); },
      init(G) { G.bookT = 0; },
      tick(G, dt, W) {
        G.bookT -= dt; if (G.bookT > 0) return;
        G.bookT = 0.5;
        const b = Fun.state(G.prof).book, p = G.player;
        for (const e of G.enemies) {
          if (e.dead || b.seen[e.type] || !CREATURES.includes(e.type)) continue;
          if (Math.abs(e.x - p.x) < 8 * T && Math.abs(e.y - p.y) < 5 * T) { b.seen[e.type] = { k: 0 }; LZ.Game._toast('Nowy stworek w księdze: ' + stickerName(e.type) + '!', 2); }
        }
        const bk = W.biomeAt(G.wl.wx || 0);
        if (!b.places['b_' + bk]) b.places['b_' + bk] = 1;
      },
      kill(G, e) { const b = Fun.state(G.prof).book; if (CREATURES.includes(e.type)) { b.seen[e.type] = b.seen[e.type] || { k: 0 }; b.seen[e.type].k++; } },
    },
    home: { buttons(l) { l.push({ label: '📖', fn: () => open() }); } },
  });

  LZ.Book = { open, entries, found, CREATURES };
})();
