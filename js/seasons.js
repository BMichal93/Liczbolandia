/*
 * seasons.js - holidays in the open world, by the real calendar.
 *
 *   October (Halloween) - glowing pumpkins along the paths, each with a
 *     sweet on top (a new one every day), friendly ghosts floating around
 *     them at night, and Czarownica Mela by the house who swaps sweets for
 *     a pumpkin lamp, a pumpkin hat and coins.
 *   1 December - 6 January (winter holidays) - snow nearly everywhere and
 *     Christmas trees with a present under each one every day; presents
 *     hold materials, coins, a tree for the house and a Santa hat.
 * LZ.Seasons.force = 'halloween' | 'winter' | null overrides the date (tests).
 *
 * Save data: fun.picked (sweets and presents, by day), fun.xmasTree.
 */
(function () {
  const U = LZ.U, S = LZ.S, A = LZ.A, Art = LZ.Art, Fun = LZ.Fun, Bag = LZ.Bag;
  const T = LZ.T, WITCH_X = -64;
  const Seasons = { force: null, now };
  function now() {
    if (Seasons.force !== null && Seasons.force !== undefined) return Seasons.force;
    const d = new Date(), m = d.getMonth();
    if (m === 9) return 'halloween';
    if (m === 11 || (m === 0 && d.getDate() <= 6)) return 'winter';
    return null;
  }
  const picked = (p, id) => { const f = Fun.state(p); f.picked = f.picked || {}; return f.picked[id] === Fun.today(); };
  const pick = (p, id) => { const f = Fun.state(p); f.picked = f.picked || {}; f.picked[id] = Fun.today(); };

  /* ---------------- Halloween: the witch's swaps ---------------- */
  const SWAPS = [
    { need: 5, name: 'Dyniowa lampa', desc: 'do domku', give: p => { const home = LZ.Home.homeOf(p); home.inv.pumpkinlamp = (home.inv.pumpkinlamp || 0) + 1; } },
    { need: 10, name: 'Dyniowa czapka', desc: 'do Garderoby', once: p => S.ownsHat(p, 'pumpkinhat'), give: p => { p.owned.hats.push('pumpkinhat'); p.equip.hat = 'pumpkinhat'; } },
    { need: 4, name: '15 monet', desc: '', give: p => { p.coins += 15; p.stats.totalCoins += 15; } },
  ];
  function openWitch(G) {
    const p = G.prof, h = LZ.UI._h, box = h('div');
    const m = Fun.open([h('div.npchead', null, [LZ.UI._preview({ id: 'cat', variant: 2, hat: 'wizard' }, 80), h('h2', null, 'Czarownica Mela')]), box]);
    function render(msg) {
      box.innerHTML = '';
      box.appendChild(h('p', null, msg || 'Hihihi! Uwielbiam cukierki. Znajdziesz je na świecących dyniach - co dzień nowe. Mam dla ciebie coś w zamian!'));
      box.appendChild(h('p.funstep', null, ['Twoje cukierki: ', Bag.icon('candy', 22), ' ' + Bag.count(p, 'candy')]));
      const L = h('div.funlist');
      SWAPS.forEach(sw => {
        const done = sw.once && sw.once(p), ok = !done && Bag.count(p, 'candy') >= sw.need;
        L.appendChild(h('div.funline', null, [h('div.grow', null, [h('b', null, sw.name), sw.desc ? ' ' + sw.desc : '', h('div', { style: 'font-size:13px' }, [Bag.icon('candy', 18), ' ' + sw.need])]),
          done ? h('span', { style: 'font-weight:800;color:#3a9a4a' }, '✓ Masz') : h('button.btn.small' + (ok ? '.primary' : ''), { onclick: () => { if (!ok) { A.play('bump'); return; } Bag.take(p, 'candy', sw.need); sw.give(p); S.save(); A.play('win'); render('Abrakadabra! ' + sw.name + ' jest twoja!'); } }, ok ? 'Zamień' : 'Za mało')]));
      });
      box.appendChild(L);
      box.appendChild(h('button.btn.mid', { onclick: () => m.close() }, 'Pa pa!'));
    }
    render();
  }
  /* ---------------- winter: presents ---------------- */
  function openPresent(G, e) {
    const p = G.prof, f = Fun.state(p), lines = [];
    pick(p, e.id);
    if (!f.xmasTree) { f.xmasTree = true; const home = LZ.Home.homeOf(p); home.inv.xmastree = (home.inv.xmastree || 0) + 1; lines.push('🎄 Choinka do domku'); }
    else if (!S.ownsHat(p, 'santahat') && Math.random() < 0.25) { p.owned.hats.push('santahat'); lines.push('🎅 Czapka Mikołaja'); }
    else {
      const k = U.pick(Math.random, ['gem', 'gold', 'star', 'feather', 'iron']), n = 1 + Math.floor(Math.random() * 2);
      Bag.add(p, k, n); lines.push(Bag.name(k, n));
      p.coins += 5; p.stats.totalCoins += 5; lines.push('5 monet');
    }
    S.save(); A.play('star'); LZ.Game._confetti(e.x, e.y - 30, 30);
    LZ.Game._toast('Prezent! ' + lines.join(', '), 3);
  }

  /* ---------------- drawing ---------------- */
  function drawPumpkin(g, e, t, G) {
    const x = e.x, y = e.y;
    for (const [dx, w] of [[-10, 12], [10, 12], [0, 14]]) { Art.ell(g, x + dx, y - 16, w, 16); Art.fs(g, '#ff9a3d', '#b8561c', 2); }
    U.rr(g, x - 3, y - 38, 6, 8, 2); Art.fs(g, '#4f8a3a');
    const fl = 0.7 + 0.3 * Math.sin(t * 8 + x);
    g.fillStyle = 'rgba(255,' + Math.round(200 + 40 * fl) + ',80,' + fl + ')';
    Art.tri(g, x - 11, y - 18, x - 4, y - 18, x - 7.5, y - 26); g.fill(); Art.tri(g, x + 4, y - 18, x + 11, y - 18, x + 7.5, y - 26); g.fill();
    g.beginPath(); g.moveTo(x - 10, y - 11); g.lineTo(x - 5, y - 7); g.lineTo(x, y - 11); g.lineTo(x + 5, y - 7); g.lineTo(x + 10, y - 11); g.lineTo(x + 7, y - 4); g.lineTo(x - 7, y - 4); g.closePath(); g.fill();
    if (!picked(G.prof, e.id)) Bag.draw(g, 'candy', x, y - 56 + Math.sin(t * 3 + x) * 3, t);
    if (e.ghost && LZ.Sky && LZ.Sky.darkness(Fun.state(G.prof).time) > 0.5) {
      const gx = x + Math.sin(t * 0.7 + x) * 60, gy = y - 110 + Math.sin(t * 1.3 + x) * 14;
      g.globalAlpha = 0.8;
      g.beginPath(); g.moveTo(gx - 16, gy + 16); g.quadraticCurveTo(gx - 18, gy - 20, gx, gy - 20); g.quadraticCurveTo(gx + 18, gy - 20, gx + 16, gy + 16);
      for (let i = 0; i < 4; i++) g.quadraticCurveTo(gx + 12 - i * 8, gy + 10 + (i % 2) * 6, gx + 8 - i * 8, gy + 16);
      g.closePath(); Art.fs(g, '#ffffff', '#c9c0e0', 1.5);
      Art.ell(g, gx - 5, gy - 6, 2.5, 3.5); Art.fs(g, '#3a2a5a'); Art.ell(g, gx + 5, gy - 6, 2.5, 3.5); Art.fs(g, '#3a2a5a');
      Art.ell(g, gx, gy + 2, 3, 2); Art.fs(g, '#ff85b0');
      g.globalAlpha = 1;
    }
  }
  function drawTree(g, e, t, G) {
    const x = e.x, y = e.y;
    U.rr(g, x - 7, y - 26, 14, 26, 3); Art.fs(g, '#8a5a32');
    for (let i = 0; i < 3; i++) { Art.tri(g, x - 46 + i * 9, y - 22 - i * 34, x + 46 - i * 9, y - 22 - i * 34, x, y - 72 - i * 34); Art.fs(g, '#3a9a5a', '#1f6a3a', 2); }
    Art.starPath(g, x, y - 148, 11, 5, 5, 0); Art.fs(g, '#ffd23f', '#b8861c', 1.5);
    ['#ff5e7e', '#5ccfff', '#ffe066', '#9d7bff', '#ff8a3d', '#7be08a'].forEach((c, i) => { const bx = x + ((i * 37) % 60) - 30, by = y - 40 - ((i * 23) % 90); Art.ell(g, bx, by, 4.5, 4.5); Art.fs(g, Math.floor(t * 2 + i) % 3 === 0 ? '#fff6c9' : c); });
    if (!picked(G.prof, e.id)) { U.rr(g, x + 26, y - 26, 26, 26, 3); Art.fs(g, '#ff5e7e', '#a3223f', 2); g.fillStyle = '#ffd23f'; g.fillRect(x + 36, y - 26, 6, 26); g.fillRect(x + 26, y - 16, 26, 6); Art.ell(g, x + 39, y - 28, 7, 4); Art.fs(g, '#ffd23f'); }
    Fun.ring(g, x + 39, y - 60, e, 0.4);
  }
  function drawWitch(g, e, t, G) {
    const x = e.x, y = e.y;
    // a bubbling cauldron and the witch next to it
    Art.ell(g, x - 50, y - 22, 30, 22); Art.fs(g, '#2d2a3a', '#111', 2);
    Art.ell(g, x - 50, y - 38, 28, 8); Art.fs(g, '#7be08a');
    for (let i = 0; i < 3; i++) { const k = (t * 0.8 + i / 3) % 1; Art.ell(g, x - 60 + i * 10, y - 42 - k * 40, 5 + k * 4, 5 + k * 4); Art.fs(g, 'rgba(160,255,170,' + (0.8 - k * 0.8) + ')'); }
    Art.drawCharacter(g, x + 10, y, { id: 'cat', variant: 2, hat: 'wizard', facing: -1, t, state: 'idle', scale: 1 });
    Fun.bubble(g, x + 10, y - 76 + Math.sin(t * 3) * 3, '🍬', '#9d4fd6');
    Fun.ring(g, x + 10, y - 100, e, 0.6);
    g.fillStyle = 'rgba(58,36,110,0.75)'; U.rr(g, x - 50, y + 6, 120, 20, 8); g.fill();
    g.fillStyle = '#fff'; g.font = '700 13px "Baloo 2", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Czarownica Mela', x + 10, y + 16);
  }
  function drawFurn(g, id, X, Y, w, t) {
    if (id === 'pumpkinlamp') { drawPumpkin(g, { x: X + w / 2, y: Y, id: '' }, t, { prof: { fun: { picked: { '': Fun.today() } } } }); return true; }
    if (id === 'xmastree') { drawTree(g, { x: X + w / 2 - 12, y: Y, id: '' }, t, { prof: { fun: { picked: { '': Fun.today() } } } }); return true; }
    return false;
  }

  LZ.Ext.add({
    world: {
      init(G) {
        const s = now();
        if (s) setTimeout(() => LZ.Game._toast(s === 'halloween' ? '🎃 Halloween w Liczbolandii! Cukierki czekają na dyniach.' : '🎄 Zima w Liczbolandii! Pod choinkami czekają prezenty.', 3), 3200);
      },
      defs(G, cx, cy, push, W) {
        const s = now(); if (!s) return;
        const x0 = cx * 32, step = s === 'halloween' ? 37 : 60, off = s === 'halloween' ? 11 : 23;
        for (let x = Math.ceil((x0 - off) / step) * step + off; x < x0 + 32; x += step) {
          if (Math.abs(x) < 30 || W.isLake(x)) continue;
          const st = W.standAt(x);
          if (Math.floor(st.y / 32) !== cy) continue;
          const k = Math.round((x - off) / step);
          push({ t: s === 'halloween' ? 'pumpkin' : 'xtree', x: st.x, y: st.y, id: (s === 'halloween' ? 'pk' : 'xt') + k, ghost: ((k % 3) + 3) % 3 === 0 });
        }
        if (s === 'halloween' && cx === Math.floor(WITCH_X / 32)) { const st = W.standAt(WITCH_X); if (Math.floor(st.y / 32) === cy) push({ t: 'witch', x: st.x, y: st.y }); }
      },
      buildEnt(G, e, px, py) {
        if (e.t === 'pumpkin') { G.ents.push({ k: 'pumpkin', x: px + T / 2, y: py, id: e.id, ghost: e.ghost, glow: 130 }); return true; }
        if (e.t === 'xtree') { G.ents.push({ k: 'xtree', x: px + T / 2, y: py, id: e.id, glow: 150 }); return true; }
        if (e.t === 'witch') { G.ents.push({ k: 'witch', x: px + T / 2, y: py, glow: 160 }); return true; }
        return false;
      },
      updateEnt(G, e, i, dt) {
        if (e.k === 'pumpkin') {
          const p = G.player;
          if (!picked(G.prof, e.id) && Math.abs(p.x + 14 - e.x) < 30 && Math.abs(p.y + 20 - (e.y - 56)) < 44) {
            pick(G.prof, e.id); Bag.add(G.prof, 'candy'); S.save(); A.play('coin'); LZ.Game._floatText(e.x, e.y - 70, '+1 cukierek', '#fff', 20);
          }
          return true;
        }
        if (e.k === 'xtree') { if (!picked(G.prof, e.id) && Fun.stand(G, e, dt, { cx: e.x + 39, dx: 34, t: 0.4 })) openPresent(G, e); return true; }
        if (e.k === 'witch') { if (Fun.stand(G, e, dt, { cx: e.x + 10, dx: 40, t: 0.6 })) openWitch(G); return true; }
        return false;
      },
      drawEnt(g, e, t, G) {
        if (e.k === 'pumpkin') { drawPumpkin(g, e, t, G); return true; }
        if (e.k === 'xtree') { drawTree(g, e, t, G); return true; }
        if (e.k === 'witch') { drawWitch(g, e, t, G); return true; }
        return false;
      },
    },
    furn: { draw(g, id, X, Y, w, t) { return drawFurn(g, id, X, Y, w, t); } },
  });

  LZ.Seasons = Seasons;
})();
