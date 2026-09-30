/*
 * rides.js - ways to travel in the open world:
 *   - a mine cart at the bottom of every cave shaft, running along the long
 *     tunnel to the next shaft's station,
 *   - hot-air balloons on the surface that lift her up to the sky islands,
 *   - boats at both shores of every bay (the pier is also where she fishes).
 *
 * During a ride the engine's player is locked (G.lockPlayer) and can't be
 * hurt (G.ghost); the ride moves her in world tiles, so the map window can
 * slide under her as usual.
 */
(function () {
  const U = LZ.U, S = LZ.S, A = LZ.A, Art = LZ.Art, Fun = LZ.Fun;
  const T = LZ.T;
  const CART_SPEED = 14, BOAT_SPEED = 7, BALLOON_SPEED = 6;   // tiles per second

  /* ================= where the stations are ================= */
  const floorOf = (W, x, i) => W.tunnelC(x, i) + W.tunnelH(x, i) + 1;
  // the station at the bottom of shaft k, and where its cart can go
  function nextStation(W, k, deep, dir) {
    for (let j = k + dir, n = 0; n < 8; j += dir, n++) { const sh = W.shaft(j); if (sh && sh.deep === deep) return { x: sh.x + 8, k: j }; }
    return null;
  }
  function chunk(W, cx, cy, x0, y0, add) {
    // mine carts (one per shaft, in its tunnel)
    for (const k of new Set([Math.floor(x0 / 64), Math.floor((x0 + 31) / 64)])) {
      const sh = W.shaft(k); if (!sh) continue;
      const x = sh.x + 8, y = floorOf(W, x, sh.deep);
      add({ t: 'station', x, y, k, deep: sh.deep });
    }
    // balloons on the surface every 300 m
    {
      for (let x = Math.ceil((x0 - 150) / 300) * 300 + 150; x < x0 + 32; x += 300) {
        if (x < x0 || Math.abs(x) < 60 || W.isLake(x)) continue;
        const st = W.standAt(x); add({ t: 'balloon', x: st.x, y: st.y });
      }
    }
    // piers at the two shores of every bay
    // (a pier just outside this piece belongs to the neighbour; add() drops it here)
    {
      for (let x = x0 - 1; x <= x0 + 32; x++) {
        if (!W.isLake(x)) continue;
        const w = W.tile(x, W.SEA) === 'W';
        if (w && W.tile(x - 1, W.SEA) !== 'W') {           // left shore: the bay starts at x
          let e = x; while (e < x + 260 && W.tile(e + 1, W.SEA) === 'W') e++;
          if (e - x >= 5) add({ t: 'dock', x: x - 1, y: W.surf(x - 1), dir: 1, to: e + 1 });
        }
        if (w && W.tile(x + 1, W.SEA) !== 'W') {           // right shore
          let b = x; while (b > x - 260 && W.tile(b - 1, W.SEA) === 'W') b--;
          if (x - b >= 5) add({ t: 'dock', x: x + 1, y: W.surf(x + 1), dir: -1, to: b - 1 });
        }
      }
    }
  }

  /* ================= riding ================= */
  function start(G, ride) {
    G.ride = ride; ride.t = 0;
    G.lockPlayer = 'idle'; G.ghost = true;
    G.player.facing = ride.dir || 1;
    Fun.state(G.prof).book.places[ride.kind] = 1;
    A.play(ride.kind === 'boat' ? 'splash' : 'spring');
  }
  function stop(G, at) {
    const r = G.ride; G.ride = null; G.lockPlayer = null; G.ghost = false;
    const p = G.player; p.invuln = 1; p.vx = p.vy = 0;
    if (at) { p.x = (at.x - G.ox) * T + T / 2 - 14; p.y = (at.y - G.oy) * T - 40; }
    G.rideCool = 1.2;
    if (r && r.kind) { A.play('checkpoint'); LZ.Game._toast({ cart: 'Stacja! Wysiadamy.', boat: 'Drugi brzeg!', balloon: 'Wyspa w chmurach!' }[r.kind], 1.8); }
    const pet = G.ents.find(e => e.k === 'pupil'); if (pet) { pet.x = p.x + 14 - 40 * p.facing; pet.y = p.y + 40; pet.vx = pet.vy = 0; }
  }
  // put her (feet) at a world spot, in pixels relative to the window
  function setFeet(G, wx, fy) { const p = G.player; p.x = (wx - G.ox) * T - 14; p.y = fy - G.oy * T - 40; }
  function tick(G, dt, W) {
    if (G.rideCool > 0) G.rideCool -= dt;
    const r = G.ride; if (!r) return;
    r.t += dt;
    if (r.kind === 'cart' || r.kind === 'boat') {
      const left = Math.abs(r.to - r.wx), done = Math.abs(r.wx - r.from);
      const v = Math.min(r.kind === 'cart' ? CART_SPEED : BOAT_SPEED, 2.5 + done * 3, 1.5 + left * 2.5);
      r.wx += r.dir * v * dt;
      if ((r.to - r.wx) * r.dir <= 0.05) {
        if (r.kind === 'cart') { const x = Math.round(r.to) + r.dir * 2; stop(G, { x, y: floorOf(W, x, r.deep) }); }
        else { const st = W.standAt(r.to + r.dir); stop(G, { x: st.x, y: st.y }); }
        return;
      }
      if (r.kind === 'cart') {
        const x0 = Math.floor(r.wx), f = r.wx - x0;
        r.fy = U.lerp(floorOf(W, x0, r.deep), floorOf(W, x0 + 1, r.deep), f) * T;
        setFeet(G, r.wx + 0.5, r.fy - 12);
      } else {
        r.fy = W.SEA * T + 10 + Math.sin(r.t * 3) * 3;
        setFeet(G, r.wx + 0.5, r.fy - 14);
      }
    } else if (r.kind === 'balloon') {
      // up, across to the island, and down onto it
      const p = r.path; let seg = p[r.i], nx = p[r.i + 1];
      const dx = nx.x - r.x, dy = nx.y - r.y, d = Math.hypot(dx, dy), step = BALLOON_SPEED * dt * (r.i === 0 ? Math.min(1, 0.3 + r.t) : 1);
      if (d <= step) { r.x = nx.x; r.y = nx.y; r.i++; if (r.i >= p.length - 1) { stop(G, { x: Math.round(nx.x), y: Math.round(nx.y) + 1 }); return; } }
      else { r.x += dx / d * step; r.y += dy / d * step; }
      setFeet(G, r.x + 0.5, (r.y + 1) * T - 14 + Math.sin(r.t * 2) * 4);
    }
  }

  /* ================= talking to a station ================= */
  function openStation(G, e, W) {
    const h = LZ.UI._h, box = h('div');
    const m = Fun.open([h('h2', null, '🚃 Kolejka w tunelu'), box]);
    const opts = [-1, 1].map(dir => ({ dir, st: nextStation(W, e.shaft, e.deep, dir) }));
    box.appendChild(h('p', null, 'Wsiadaj do wagonika! Pojedzie tunelem do następnej stacji.'));
    box.appendChild(h('div.funrow', null, opts.map(o => h('button.btn.mid' + (o.st ? '.primary' : ''), { onclick: () => {
      if (!o.st) { A.play('bump'); return; }
      m.close();
      start(G, { kind: 'cart', dir: o.dir, from: Math.round(e.wx), wx: e.wx, to: o.st.x, deep: e.deep });
    } }, o.st ? (o.dir < 0 ? '← ' : '') + Math.abs(o.st.x - e.wx) + ' m' + (o.dir > 0 ? ' →' : '') : (o.dir < 0 ? '← ' : '') + 'koniec torów' + (o.dir > 0 ? ' →' : '')))));
    box.appendChild(h('button.btn.small.ghost', { onclick: () => m.close() }, 'Nie jadę'));
  }
  function openDock(G, e, W) {
    const h = LZ.UI._h, box = h('div'), p = G.prof;
    const m = Fun.open([h('h2', null, '⛵ Przystań'), box]);
    box.appendChild(h('p', null, 'Łódka czeka przy pomoście. Możesz popłynąć na drugi brzeg albo połowić ryby.'));
    box.appendChild(h('div.funrow', null, [
      h('button.btn.mid.primary', { onclick: () => { m.close(); start(G, { kind: 'boat', dir: e.dir, from: e.wx, wx: e.wx + e.dir, to: e.to }); } }, '⛵ Płyń ' + Math.abs(e.to - e.wx) + ' m'),
      LZ.Fishing ? h('button.btn.mid', { onclick: () => { m.close(); LZ.Fishing.open(G, e); } }, '🎣 Łów ryby') : null,
    ]));
    box.appendChild(h('button.btn.small.ghost', { onclick: () => m.close() }, 'Nie teraz'));
  }
  function openBalloon(G, e, W) {
    const h = LZ.UI._h, box = h('div');
    const m = Fun.open([h('h2', null, '🎈 Balon'), box]);
    box.appendChild(h('p', null, 'Balon zabierze cię na wyspę w chmurach. Na dół zeskoczysz sama, albo zejdziesz po fasolce!'));
    box.appendChild(h('div.funrow', null, [
      h('button.btn.mid.primary', { onclick: () => {
        m.close();
        // the nearest island with room on top
        let best = null;
        for (let j = Math.floor(e.wx / 26) - 1; j <= Math.floor(e.wx / 26) + 1; j++) { const is = W.island(j); if (!best || Math.abs((is.x0 + is.x1) / 2 - e.wx) < Math.abs((best.x0 + best.x1) / 2 - e.wx)) best = is; }
        const mid = Math.round((best.x0 + best.x1) / 2), gy = e.wy - 1;
        const path = [{ x: e.wx, y: gy }, { x: e.wx, y: best.top - 5 }, { x: mid, y: best.top - 5 }, { x: mid, y: best.top - 1 }];
        start(G, { kind: 'balloon', dir: mid >= e.wx ? 1 : -1, path, i: 0, x: e.wx, y: gy });
      } }, '🎈 Lecimy!'),
    ]));
    box.appendChild(h('button.btn.small.ghost', { onclick: () => m.close() }, 'Nie teraz'));
  }

  /* ================= drawing ================= */
  function drawRails(g, x0, x1, yAt) {
    g.strokeStyle = '#6b4424'; g.lineWidth = 5;
    for (let x = x0; x < x1; x += 16) { const y = yAt(x); g.beginPath(); g.moveTo(x, y - 1); g.lineTo(x + 6, y - 1); g.stroke(); }
    g.strokeStyle = '#9aa3b5'; g.lineWidth = 3; g.beginPath();
    for (let x = x0; x <= x1; x += 8) { const y = yAt(x) - 5; if (x === x0) g.moveTo(x, y); else g.lineTo(x, y); }
    g.stroke();
  }
  function drawCart(g, x, y, t, moving) {
    const rr = U.rr, fs = Art.fs;
    for (const d of [-16, 16]) { g.save(); g.translate(x + d, y - 9); g.rotate(moving ? t * 12 : 0); Art.ell(g, 0, 0, 7, 7); fs(g, '#5a6388', '#2d2a3a', 2); g.fillStyle = '#9aa3b5'; g.fillRect(-1.5, -6, 3, 12); g.restore(); }
    g.beginPath(); g.moveTo(x - 30, y - 42); g.lineTo(x + 30, y - 42); g.lineTo(x + 24, y - 12); g.lineTo(x - 24, y - 12); g.closePath(); fs(g, '#ff8a3d', '#8a3a10', 2.5);
    g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(x - 26, y - 30, 52, 4);
    rr(g, x - 32, y - 45, 64, 7, 3); fs(g, '#9aa3b5', '#5a6388', 2);
    for (const d of [-18, 0, 18]) { Art.ell(g, x + d, y - 22, 2.5, 2.5); fs(g, '#ffd23f'); }
  }
  function drawBoat(g, x, y, t, dir) {
    const fs = Art.fs;
    g.save(); g.translate(x, y); g.scale(dir || 1, 1);
    g.beginPath(); g.moveTo(-44, -18); g.lineTo(44, -18); g.quadraticCurveTo(40, 6, 22, 8); g.lineTo(-30, 8); g.quadraticCurveTo(-44, 0, -44, -18); g.closePath(); fs(g, '#ff6f91', '#a3223f', 2.5);
    g.fillStyle = '#fff'; g.fillRect(-40, -12, 80, 5);
    g.strokeStyle = '#8a5a32'; g.lineWidth = 3; g.beginPath(); g.moveTo(-18, -18); g.lineTo(-18, -86); g.stroke();
    g.beginPath(); g.moveTo(-21, -84); g.quadraticCurveTo(-50, -60, -54, -26); g.lineTo(-21, -26); g.closePath(); fs(g, '#fff6e8', '#b8a080', 2);
    g.beginPath(); g.moveTo(-18, -86); g.lineTo(-4, -80); g.lineTo(-18, -76); g.closePath(); fs(g, '#5ccfff');
    g.restore();
  }
  function drawBalloon(g, x, y, t, withBasket) {
    const fs = Art.fs;
    const top = y - 150;
    const cols = ['#ff5e7e', '#ffd23f', '#5ccfff', '#7be08a', '#9d7bff'];
    g.save();
    g.beginPath(); g.ellipse(x, top, 44, 52, 0, 0, Math.PI * 2); g.clip();
    cols.forEach((c, i) => { g.fillStyle = c; g.fillRect(x - 44 + i * 18, top - 60, 18, 120); });
    g.restore();
    g.beginPath(); g.ellipse(x, top, 44, 52, 0, 0, Math.PI * 2); g.strokeStyle = '#8a3a60'; g.lineWidth = 2.5; g.stroke();
    Art.ell(g, x - 16, top - 22, 8, 12, -0.4); g.fillStyle = 'rgba(255,255,255,0.4)'; g.fill();
    g.strokeStyle = '#6b4424'; g.lineWidth = 1.5; g.beginPath();
    g.moveTo(x - 30, top + 38); g.lineTo(x - 20, y - 40); g.moveTo(x + 30, top + 38); g.lineTo(x + 20, y - 40); g.stroke();
    if (withBasket) { U.rr(g, x - 24, y - 40, 48, 30, 6); fs(g, '#c98a5a', '#6b4424', 2.5); g.strokeStyle = 'rgba(107,68,36,0.5)'; g.lineWidth = 1.5; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(x - 24 + i * 12, y - 40); g.lineTo(x - 24 + i * 12, y - 10); g.stroke(); } }
  }
  function drawStation(g, e, t, G) {
    const W = LZ.World.gen();
    drawRails(g, e.x - 3 * T, e.x + 3 * T, () => e.y);
    const riding = G.ride && G.ride.kind === 'cart';
    if (!riding) drawCart(g, e.x, e.y, t, false);
    // the sign
    g.fillStyle = '#8a5a32'; g.fillRect(e.x - 70, e.y - 70, 5, 70);
    U.rr(g, e.x - 112, e.y - 96, 90, 28, 7); Art.fs(g, '#fff6c9', '#8a5a32', 2);
    g.fillStyle = '#5a3a8a'; g.font = '800 15px "Baloo 2", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Kolejka', e.x - 67, e.y - 82);
    // a lantern
    Art.ell(g, e.x + 60, e.y - 80, 7, 9); Art.fs(g, '#ffe680', '#b8861c', 1.5);
    Fun.ring(g, e.x, e.y - 70, e, 0.6);
  }
  function drawDock(g, e, t, G) {
    const sea = (LZ.World.gen().SEA - G.oy) * T, d = e.dir;   // window coordinates, like the entity
    // the wooden pier over the water, from the shore
    const x0 = d > 0 ? e.x + T / 2 : e.x - T / 2 - 2.2 * T;
    U.rr(g, x0, sea - 14, 2.2 * T, 12, 3); Art.fs(g, '#c98a5a', '#6b4424', 2);
    g.fillStyle = '#8a5a32'; for (let i = 0; i < 3; i++) g.fillRect(x0 + 8 + i * 40, sea - 4, 7, 40);
    const riding = G.ride && G.ride.kind === 'boat';
    if (!riding) drawBoat(g, e.x + d * 2.4 * T, sea + 10 + Math.sin(t * 2 + e.x) * 3, t, d);
    // sign with a fish
    g.fillStyle = '#8a5a32'; g.fillRect(e.x - 3, e.y - 64, 6, 64);
    U.rr(g, e.x - 44, e.y - 92, 88, 30, 7); Art.fs(g, '#fff6c9', '#8a5a32', 2);
    g.fillStyle = '#2a7fb0'; g.font = '800 14px "Baloo 2", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('Przystań', e.x, e.y - 77);
    Fun.ring(g, e.x, e.y - 110, e, 0.6);
  }
  function drawFront(g, G, t, W) {
    const r = G.ride; if (!r) return;
    const p = G.player, cx = p.x + 14;
    if (r.kind === 'cart') {
      const yAt = x => { const wx = x / T + G.ox; const x0 = Math.floor(wx); return U.lerp(floorOf(W, x0, r.deep), floorOf(W, x0 + 1, r.deep), wx - x0) * T - G.oy * T; };
      drawRails(g, cx - 4 * T, cx + 4 * T, yAt);
      drawCart(g, cx, r.fy - G.oy * T, t, true);
      // sparks from the wheels
      if (Math.random() < 0.5) G.particles.push({ x: cx - r.dir * 20, y: r.fy - G.oy * T - 4, vx: -r.dir * 120 * Math.random(), vy: -80 * Math.random(), life: 0.3, max: 0.3, size: 3, kind: 'sparkle', rot: 0, grav: 300 });
    } else if (r.kind === 'boat') drawBoat(g, cx, r.fy - G.oy * T + 8, t, r.dir);
    else if (r.kind === 'balloon') drawBalloon(g, cx, p.y + 40 + 12, t, true);
  }

  LZ.Ext.add({
    world: {
      chunk(W, cx, cy, x0, y0, add) { chunk(W, cx, cy, x0, y0, add); },
      buildEnt(G, e, px, py) {
        const wx = e.x + G.ox, wy = e.y + G.oy;
        if (e.t === 'station') { G.ents.push({ k: 'station', x: px + T / 2, y: py, wx, wy, shaft: e.k, deep: e.deep }); return true; }
        if (e.t === 'dock') { G.ents.push({ k: 'dock', x: px + T / 2, y: py, wx, wy, dir: e.dir, to: e.to }); return true; }
        if (e.t === 'balloon') { G.ents.push({ k: 'balloon', x: px + T / 2, y: py, wx, wy }); return true; }
        return false;
      },
      updateEnt(G, e, i, dt, pc, W) {
        if (e.k !== 'station' && e.k !== 'dock' && e.k !== 'balloon') return false;
        if (G.ride || G.rideCool > 0) { e._st = 0; return true; }
        if (e.k === 'station' && Fun.stand(G, e, dt, { dx: 30, t: 0.6 })) openStation(G, e, W);
        if (e.k === 'dock' && Fun.stand(G, e, dt, { dx: 30, t: 0.6 })) openDock(G, e, W);
        if (e.k === 'balloon' && Fun.stand(G, e, dt, { dx: 44, t: 0.6 })) openBalloon(G, e, W);
        return true;
      },
      drawEnt(g, e, t, G) {
        if (e.k === 'station') { drawStation(g, e, t, G); return true; }
        if (e.k === 'dock') { drawDock(g, e, t, G); return true; }
        if (e.k === 'balloon') {
          if (!(G.ride && G.ride.kind === 'balloon')) drawBalloon(g, e.x, e.y - 8 + Math.sin(t * 1.5) * 4, t, true);
          Fun.ring(g, e.x, e.y - 60, e, 0.6);
          return true;
        }
        return false;
      },
      tick(G, dt, W) { tick(G, dt, W); },
      drawFront(g, G, t, W) { drawFront(g, G, t, W); },
      placed(G) { if (G.ride) { G.ride = null; G.lockPlayer = null; G.ghost = false; } },
      quit(G) { G.ride = null; G.lockPlayer = null; G.ghost = false; },
    },
  });

  LZ.Rides = { start, stop, nextStation, floorOf, drawBoat, drawCart, drawBalloon };
})();
