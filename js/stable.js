/*
 * stable.js - a pony to ride in the open world.
 *
 * Left of the garden stands a little stable with a pony looking for a
 * friend. Five carrots from the garden (and a counting story) tame it; she
 * picks its colour and name. Then the 🐴 button puts her in the saddle
 * anywhere outside: the pony runs faster and jumps a bit higher, and she
 * sits up on its back (only the picture - she still fits where she fits).
 *
 * Save data: fun.pony = { col, name, riding }.
 */
(function () {
  const U = LZ.U, S = LZ.S, A = LZ.A, Art = LZ.Art, Fun = LZ.Fun, Bag = LZ.Bag;
  const T = LZ.T, STABLE_X = -46, LIFT = 26;
  const COLS = [
    { name: 'Biały', body: '#fbf7ff', dark: '#c9c0d8', mane: '#ff85c8' },
    { name: 'Gniady', body: '#b87a4a', dark: '#7a4a24', mane: '#3a2418' },
    { name: 'Liliowy', body: '#d9c8ff', dark: '#9a84d0', mane: 'rainbow' },
  ];
  const NAMES = ['Iskierka', 'Galop', 'Mgiełka', 'Kasztan', 'Tęcza', 'Bułka'];
  const RAIN = ['#ff5e7e', '#ffa62b', '#ffe066', '#7be08a', '#5ccfff', '#9d7bff'];
  const pony = p => Fun.state(p).pony || null;

  /* the pony from the side, hooves at (x, y) */
  function draw(g, pn, x, y, t, f, run, air) {
    const c = COLS[pn.col || 0], ell = Art.ell, fs = Art.fs, rr = U.rr;
    g.save(); g.translate(x, y); g.scale(f || 1, 1);
    const ph = run * 1, legA = air ? 0.6 : Math.sin(ph) * 0.5;
    const legs = [[-22, legA], [-14, -legA], [14, -legA], [22, legA]];
    legs.forEach(([lx, a], i) => { g.save(); g.translate(lx, -22); g.rotate(air ? (i < 2 ? 0.7 : -0.7) : a); rr(g, -4, 0, 8, 22, 4); fs(g, i % 2 ? c.dark : c.body, U.shade(c.dark, -0.3), 1.5); rr(g, -4.5, 17, 9, 6, 2); fs(g, '#5a4a4a'); g.restore(); });
    // tail
    g.save(); g.translate(-30, -36); g.rotate(0.6 + Math.sin(t * 3) * 0.15);
    if (c.mane === 'rainbow') RAIN.forEach((col, i) => { ell(g, -2 + i * 1.2, 8 + i * 2, 4, 12); fs(g, col); });
    else { ell(g, 0, 10, 6, 15); fs(g, c.mane); }
    g.restore();
    ell(g, 0, -32, 30, 15); fs(g, c.body, U.shade(c.dark, -0.3), 2);
    // neck and head
    g.save(); g.translate(22, -40); g.rotate(-0.5); rr(g, -8, -26, 16, 30, 7); fs(g, c.body, U.shade(c.dark, -0.3), 2); g.restore();
    ell(g, 36, -62, 14, 10, 0.3); fs(g, c.body, U.shade(c.dark, -0.3), 2);
    ell(g, 46, -58, 6, 5); fs(g, U.shade(c.body, -0.08));
    Art.tri(g, 26, -70, 30, -82, 34, -70); fs(g, c.body, U.shade(c.dark, -0.3), 1.5);
    ell(g, 36, -65, 2.2, 2.6); fs(g, '#2a2a3a'); ell(g, 36.6, -66, 0.8, 0.8); fs(g, '#fff');
    ell(g, 40, -58, 3, 1.8); fs(g, 'rgba(255,120,160,0.5)');
    // mane
    for (let i = 0; i < 5; i++) { ell(g, 22 - i * 4 + 6, -72 + i * 7, 5, 6); fs(g, c.mane === 'rainbow' ? RAIN[i] : c.mane); }
    // saddle
    rr(g, -12, -48, 24, 8, 4); fs(g, '#ff6f91', '#a3223f', 1.5);
    g.restore();
  }

  function mountToggle() {
    const G = LZ.Game._dbg(); if (!G || G.kind !== 'world') return;
    const pn = pony(G.prof); if (!pn) { LZ.Game._toast('Najpierw oswój kucyka w stajni koło ogródka!', 2.4); return; }
    pn.riding = !pn.riding; S.save();
    setRide(G, pn.riding);
    A.play(pn.riding ? 'spring' : 'pop');
  }
  function setRide(G, on) {
    G.riding = on; G.riderLift = on ? LIFT : 0;
    G.ents = G.ents.filter(e => e.k !== 'mount');
    if (on) G.ents.push({ k: 'mount', x: 0, y: 0 });
    if (LZ.Gear) LZ.Gear.apply(G);
  }

  function openStable(G, e) {
    const p = G.prof, f = Fun.state(p), h = LZ.UI._h, box = h('div');
    const m = Fun.open([h('h2', null, '🐴 Stajnia'), box]);
    const pic = (pn, w, hh) => { const c = document.createElement('canvas'); c.width = w * 2; c.height = hh * 2; c.style.width = w + 'px'; c.style.height = hh + 'px'; const g = c.getContext('2d'); g.scale(2, 2); draw(g, pn, w / 2 - 8, hh - 4, 0.3, 1, 0, false); return c; };
    if (pony(p)) {
      box.appendChild(h('p', null, pony(p).name + ' cię poznaje! Wsiadasz i zsiadasz przyciskiem 🐴 na górze ekranu.'));
      box.appendChild(h('div.funrow', null, [pic(pony(p), 120, 90)]));
      box.appendChild(h('button.btn.mid.primary', { onclick: () => m.close() }, 'Wio!'));
      return;
    }
    const need = 5, have = Bag.count(p, 'carrot');
    box.appendChild(h('div.funrow', null, [pic({ col: 0 }, 120, 90)]));
    box.appendChild(h('p', null, 'Ten kucyk szuka przyjaciela. Lubi marchewki - przynieś ' + need + ' z ogródka, a pozwoli się oswoić. Masz ' + have + '.'));
    if (have < need) { box.appendChild(h('button.btn.mid.primary', { onclick: () => m.close() }, 'Idę do ogródka!')); return; }
    box.appendChild(h('button.btn.mid.primary', { onclick: tame }, '🥕 Daj marchewki'));
    function tame() {
      const q = h('div'); box.innerHTML = ''; box.appendChild(q);
      Fun.ask(q, p, () => Fun.story(p, ['marchewka', 'marchewki', 'marchewek'], { place: 'W żłobie', gone: 'schrupał kucyk' }), () => {
        box.innerHTML = '';
        box.appendChild(h('p', null, 'Kucyk ci ufa! Jakiego jest koloru?'));
        box.appendChild(h('div.funrow', null, COLS.map((c, i) => h('button.funpick', { onclick: () => name(i) }, [pic({ col: i }, 110, 84), c.name]))));
      }, { title: 'Karmimy kucyka' });
    }
    function name(col) {
      box.innerHTML = '';
      box.appendChild(h('p', null, 'Jak ma na imię?'));
      const inp = h('input.funinput', { maxlength: 14, placeholder: 'Imię' });
      box.appendChild(inp);
      box.appendChild(h('div.funrow', null, NAMES.map(n => h('button.btn.small', { onclick: () => { inp.value = n; } }, n))));
      box.appendChild(h('button.btn.mid.primary', { onclick: () => {
        const nm = inp.value.trim(); if (!nm) { A.play('bump'); return; }
        Bag.take(p, 'carrot', need);
        f.pony = { col, name: nm.charAt(0).toUpperCase() + nm.slice(1), riding: true };
        S.checkBadges(p); S.save(); A.play('win');
        m.close(); setRide(G, true); LZ.Fun.bar('world', true);
        LZ.Game._toast('Wio, ' + f.pony.name + '! Przycisk 🐴 u góry: wsiadasz i zsiadasz.', 3);
      } }, 'Gotowe!'));
    }
  }
  function drawStable(g, e, t, G) {
    const x = e.x, y = e.y, rr = U.rr, fs = Art.fs;
    rr(g, x - 80, y - 110, 160, 110, 6); fs(g, '#d9534f', '#8a2a28', 2.5);
    g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 4; g.strokeRect(x - 30, y - 70, 60, 70); g.beginPath(); g.moveTo(x - 30, y - 70); g.lineTo(x + 30, y); g.moveTo(x + 30, y - 70); g.lineTo(x - 30, y); g.stroke();
    g.beginPath(); g.moveTo(x - 94, y - 106); g.lineTo(x, y - 160); g.lineTo(x + 94, y - 106); g.closePath(); fs(g, '#8a5a32', '#5c3a1c', 2.5);
    rr(g, x - 14, y - 142, 28, 22, 4); fs(g, '#fff6c9', '#8a5a32', 2);
    // a fence and, until tamed, the pony waiting by it
    g.fillStyle = '#c98a5a'; for (let i = 0; i < 4; i++) g.fillRect(x + 90 + i * 24, y - 36, 6, 36); g.fillRect(x + 86, y - 30, 80, 5); g.fillRect(x + 86, y - 16, 80, 5);
    if (!pony(G.prof)) draw(g, { col: 0 }, x + 128, y, t, -1, 0, false);
    U.rr(g, x - 50, y - 194, 100, 26, 7); fs(g, '#fff6c9', '#8a5a32', 2);
    g.fillStyle = '#5a3a8a'; g.font = '800 15px "Baloo 2", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('STAJNIA', x, y - 181);
    Fun.ring(g, x, y - 90, e, 0.6);
  }

  LZ.Ext.add({
    world: {
      init(G) { const pn = pony(G.prof); if (pn && pn.riding) { G.riding = true; G.riderLift = LIFT; if (LZ.Gear) LZ.Gear.apply(G); } },
      placed(G) { G.ents = G.ents.filter(e => e.k !== 'mount'); if (G.riding) G.ents.push({ k: 'mount', x: 0, y: 0 }); },
      buttons(l) { if (pony(S.active())) l.push({ label: '🐴', fn: mountToggle }); },
      defs(G, cx, cy, push, W) {
        if (cx !== Math.floor(STABLE_X / 32)) return;
        const st = W.standAt(STABLE_X);
        if (Math.floor(st.y / 32) === cy) push({ t: 'stable', x: st.x, y: st.y });
      },
      buildEnt(G, e, px, py) { if (e.t !== 'stable') return false; G.ents.push({ k: 'stable', x: px + T / 2, y: py }); return true; },
      updateEnt(G, e, i, dt) {
        if (e.k === 'stable') { if (Fun.stand(G, e, dt, { dx: 44, t: 0.6 })) openStable(G, e); return true; }
        if (e.k === 'mount') { const p = G.player; e.x = p.x + 14; e.y = p.y + 40; return true; }
        return false;
      },
      drawEnt(g, e, t, G) {
        if (e.k === 'stable') { drawStable(g, e, t, G); return true; }
        if (e.k === 'mount') {
          if (G.ride) return true;   // no pony in a mine cart
          const p = G.player, pn = pony(G.prof); if (!pn) return true;
          draw(g, pn, e.x - p.facing * 4, e.y + 1, t, p.facing, p.state === 'run' ? p.phase : 0, !p.grounded);
          return true;
        }
        return false;
      },
    },
  });

  LZ.Stable = { draw, mountToggle, setRide, STABLE_X, COLS };
})();
