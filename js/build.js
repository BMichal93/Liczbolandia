/*
 * build.js - digging and building in the open world, Terraria style.
 *
 * The 🧱 button opens a small toolbar. With the pickaxe she can dig out
 * ground near her (each piece is a stone in the backpack); stones are then
 * placed back as blocks, wooden walkways she can jump up through, or vines
 * to climb. Taps work within 5 tiles of her, so building stays close by.
 * The first time she gets 10 stones to start with.
 *
 * Changes are stored like broken bricks: profile.world.mods["x,y"] = tile,
 * which the world generator lays over its own tiles.
 * Save data: fun.built (pieces placed), fun.buildGift.
 */
(function () {
  const U = LZ.U, S = LZ.S, A = LZ.A, Art = LZ.Art, Fun = LZ.Fun, Bag = LZ.Bag;
  const T = LZ.T, REACH = 5;
  const TOOLS = [
    { id: 'dig', label: '⛏️ Kop', tile: null },
    { id: 'block', label: '🧱 Blok', tile: '#' },
    { id: 'plank', label: '➖ Kładka', tile: '-' },
    { id: 'vine', label: '🌿 Pnącze', tile: 'H' },
  ];
  const DIGGABLE = '#IB';
  let bar = null, tool = 'block', saveT = 0;

  function G_() { const G = LZ.Game._dbg(); return G && G.kind === 'world' ? G : null; }
  function open() {
    const G = G_(); if (!G) return;
    if (bar) { close(); return; }
    const p = G.prof, f = Fun.state(p), h = LZ.UI._h;
    if (!f.buildGift) { f.buildGift = true; Bag.add(p, 'stone', 10); S.save(); LZ.Game._toast('Na start 10 kamieni! Stuknij obok siebie, żeby budować.', 3); }
    G.building = true;
    bar = h('div'); bar.id = 'buildbar';
    render();
    document.getElementById('hud').appendChild(bar);
  }
  function render() {
    const G = G_(); if (!G || !bar) return;
    const h = LZ.UI._h;
    bar.innerHTML = '';
    TOOLS.forEach(tl => bar.appendChild(h('button.bbtn' + (tool === tl.id ? '.on' : ''), { onclick: () => { tool = tl.id; render(); } }, tl.label)));
    bar.appendChild(h('span.bcount', null, [Bag.icon('stone', 22), ' ' + Bag.count(G.prof, 'stone')]));
    bar.appendChild(h('button.bbtn', { onclick: close }, '✓'));
  }
  function close() { if (bar) bar.remove(); bar = null; const G = LZ.Game._dbg(); if (G) G.building = false; }

  // a tap on the game screen while the toolbar is open
  function tap(ev) {
    const G = G_(); if (!G || !bar || LZ.UI.isPaused()) return;
    if (ev.target.closest && ev.target.closest('button, .ctl, #buildbar, #sbbar')) return;
    // near the touch buttons (they react a bit around their edge too): that's moving, not building
    for (const el of document.querySelectorAll('.ctl')) { const r = el.getBoundingClientRect(); if (r.width && ev.clientX > r.left - 40 && ev.clientX < r.right + 40 && ev.clientY > r.top - 40 && ev.clientY < r.bottom + 40) return; }
    const v = LZ.Game.view, r = document.getElementById('game').getBoundingClientRect();
    const wx = (ev.clientX - r.left) / v.scale + G.cam.x, wy = (ev.clientY - r.top) / v.scale + G.cam.y;
    const tx = Math.floor(wx / T), ty = Math.floor(wy / T);
    const p = G.player, pcx = (p.x + 14) / T, pcy = (p.y + 20) / T;
    if (Math.hypot(tx + 0.5 - pcx, ty + 0.5 - pcy) > REACH) { A.play('bump'); flash(G, tx, ty, false); return; }
    const cur = G.grid[tx] && G.grid[tx][ty];
    if (cur == null) return;
    const wX = tx + G.ox, wY = ty + G.oy;
    if (tool === 'dig') {
      if (!LZ.Gear.has(G.prof, 'pick')) { LZ.Game._toast('Do kopania potrzebny jest kilof z kuźni.', 2.2); return; }
      if (!DIGGABLE.includes(cur) || (Math.abs(wX) < 7 && wY >= -1 && wY <= 1)) { A.play('bump'); flash(G, tx, ty, false); return; }   // not the ground right at the house door
      set(G, tx, ty, '.'); Bag.add(G.prof, 'stone', 1); A.play('break');
      for (let k = 0; k < 6; k++) G.particles.push({ x: tx * T + T / 2, y: ty * T + T / 2, vx: (Math.random() - 0.5) * 240, vy: -Math.random() * 240, life: 0.5, max: 0.5, size: 5, kind: 'stars', rot: 0, grav: 900 });
    } else {
      const tl = TOOLS.find(x => x.id === tool);
      if (cur !== '.' ) { A.play('bump'); flash(G, tx, ty, false); return; }
      // never inside her
      if (tl.tile === '#' && p.x + 28 > tx * T && p.x < tx * T + T && p.y + 40 > ty * T && p.y < ty * T + T) { A.play('bump'); return; }
      if (!Bag.take(G.prof, 'stone')) { LZ.Game._toast('Brak kamieni. Wykop je kilofem!', 2); return; }
      set(G, tx, ty, tl.tile); A.play('block');
      const f = Fun.state(G.prof); f.built = (f.built || 0) + 1;
    }
    flash(G, tx, ty, true);
    render();
  }
  function set(G, tx, ty, c) {
    const W = LZ.World.gen(), ws = G.prof.world, k = (tx + G.ox) + ',' + (ty + G.oy);
    G.grid[tx][ty] = c; ws.mods[k] = c; W.mods[k] = c;
    W.chunkCache.delete(Math.floor((tx + G.ox) / 32) + ',' + Math.floor((ty + G.oy) / 32));
    LZ.Game._computeMasks();
    saveT = 2;
  }
  function flash(G, tx, ty, ok) { G.buildFlash = { tx, ty, ok, t: 0.35 }; }

  document.addEventListener('pointerdown', tap);

  LZ.Ext.add({
    world: {
      buttons(l) { l.push({ label: '🧱', fn: open }); },
      tick(G, dt) {
        if (saveT > 0) { saveT -= dt; if (saveT <= 0) { S.checkBadges(G.prof); S.save(); } }
        if (G.buildFlash) { G.buildFlash.t -= dt; if (G.buildFlash.t <= 0) G.buildFlash = null; }
      },
      // the reach circle and the tile just changed
      drawFront(g, G, t) {
        if (!G.building) return;
        const p = G.player;
        g.save(); g.setLineDash([8, 8]); g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2;
        g.beginPath(); g.arc(p.x + 14, p.y + 20, REACH * T, 0, Math.PI * 2); g.stroke(); g.restore();
        const fl = G.buildFlash;
        if (fl) { g.strokeStyle = fl.ok ? 'rgba(123,224,138,0.9)' : 'rgba(255,94,126,0.9)'; g.lineWidth = 4; g.strokeRect(fl.tx * T + 2, fl.ty * T + 2, T - 4, T - 4); }
      },
      placed(G) { if (bar) render(); },
      quit() { close(); },
    },
  });

  LZ.Build = { open, close, tap, set };
})();
