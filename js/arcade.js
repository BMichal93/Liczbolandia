/*
 * arcade.js - an arcade machine in the house with three short maths games.
 *
 *   Łańcuch sum  - a grid of numbers; join neighbours that add up to the
 *                  target before the minute runs out.
 *   Pary         - memory: find each sum and its answer under the cards.
 *   Podwajanie   - the 2048 game: slide, equal numbers join and double.
 *
 * Each game keeps her best score and shows the family best (both sisters
 * on this device), which is what makes her play "one more". Coins are small
 * and capped per day, so the arcade is for fun, not for getting rich.
 *
 * The machine is a gift: it appears in the house on the first visit after
 * this update (or waits in "Urządzaj" if the room is full).
 *
 * Save data: fun.arcade = { best: { sum, pairs, merge }, day: { key, coins } },
 * fun.cnt.arcade (games played, for the quest board), fun.arcadeGiven.
 */
(function () {
  const U = LZ.U, S = LZ.S, A = LZ.A, Art = LZ.Art, Fun = LZ.Fun;
  const T = LZ.T;
  const DAY_CAP = 30;
  const GAMES = [
    { id: 'sum', icon: '🔗', name: 'Łańcuch sum', desc: 'Połącz liczby w sumę', perCoin: 20 },
    { id: 'pairs', icon: '🃏', name: 'Pary', desc: 'Działanie i wynik', perCoin: 30 },
    { id: 'merge', icon: '🔢', name: 'Podwajanie', desc: 'Łącz, aż urosną', perCoin: 120 },
  ];
  const FONT = '"Baloo 2", sans-serif';

  function save(p) {
    const f = Fun.state(p);
    f.arcade = f.arcade || { best: {}, day: null };
    f.arcade.best = f.arcade.best || {};
    return f.arcade;
  }
  function familyBest(id) {
    let best = null;
    for (const q of S.data.profiles || []) {
      const s = q.fun && q.fun.arcade && q.fun.arcade.best && q.fun.arcade.best[id];
      if (s && (!best || s > best.s)) best = { s, name: q.name };
    }
    return best;
  }
  const young = p => (p.skill || 1) < 2.5;

  /* ================= the menu ================= */
  function openMenu() {
    const UI = LZ.UI, h = UI._h, p = S.active(), sv = save(p);
    const m = Fun.open([
      h('h2', null, '🕹️ Automat z grami'),
      h('div.arcgrid', null, GAMES.map(gm => {
        const fb = familyBest(gm.id);
        return h('button.arccard', { onclick: () => { m.close(); play(gm.id); } }, [
          h('span.ti', null, gm.icon), h('span', null, gm.name), h('small', null, gm.desc),
          h('small', null, 'Twój rekord: ' + (sv.best[gm.id] || 0)),
          fb && fb.name !== p.name ? h('small', null, '👑 ' + fb.name + ': ' + fb.s) : null,
        ]);
      })),
      h('p.note', null, 'Za dobre wyniki są monety (do ' + DAY_CAP + ' dziennie).'),
      h('button.btn.mid', { onclick: () => m.close() }, 'Wróć'),
    ]);
    return m;
  }

  /* ================= one game in a window ================= */
  function play(id) {
    const UI = LZ.UI, h = UI._h, p = S.active(), gm = GAMES.find(g => g.id === id);
    const size = Math.floor(Math.max(200, Math.min(360, window.innerWidth - 80, window.innerHeight - 150)));
    const game = id === 'sum' ? sumGame(p, size) : id === 'pairs' ? pairsGame(p, size) : mergeGame(p, size);
    const cv = h('canvas'), dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(size * dpr); cv.height = Math.round(game.h * dpr);
    cv.style.width = size + 'px'; cv.style.height = game.h + 'px';
    const g = cv.getContext('2d');
    const left = h('span'), right = h('span');
    let running = true, last = performance.now(), t = 0, ended = false;
    const m = Fun.open([
      h('h2', null, gm.icon + ' ' + gm.name),
      h('div.arcinfo', null, [left, right]),
      h('div.arcbox', null, [cv]),
      h('div.row', null, [h('button.btn.small', { onclick: () => m.close() }, 'Zakończ')]),
    ], () => { running = false; window.removeEventListener('keydown', onKey, true); });
    m.box.classList.add('arcmodal');
    const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * size / r.width, (e.clientY - r.top) * game.h / r.height]; };
    let down = false;
    cv.addEventListener('pointerdown', e => { if (ended) return; down = true; cv.setPointerCapture && cv.setPointerCapture(e.pointerId); game.down(...pos(e)); });
    cv.addEventListener('pointermove', e => { if (down && !ended && game.move) game.move(...pos(e)); });
    cv.addEventListener('pointerup', e => { if (!down) return; down = false; if (!ended && game.up) game.up(...pos(e)); });
    function onKey(e) {
      if (!game.key || ended) return;
      const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], KeyA: [-1, 0], KeyD: [1, 0], KeyW: [0, -1], KeyS: [0, 1] }[e.code];
      if (dir) { e.preventDefault(); e.stopPropagation(); game.key(dir); }
    }
    window.addEventListener('keydown', onKey, true);
    function frame(now) {
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      game.tick(dt);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, size, game.h);
      game.draw(g, t);
      const info = game.info();
      left.textContent = info[0]; right.textContent = info[1];
      if (game.over && !ended) { ended = true; setTimeout(() => running && finish(), 500); }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    // the end: record, coins, and what next
    function finish() {
      const sv = save(p), f = Fun.state(p), score = game.score;
      const prev = sv.best[id] || 0, record = score > prev;
      if (record) sv.best[id] = score;
      f.cnt = f.cnt || {}; f.cnt.arcade = (f.cnt.arcade || 0) + 1;
      const key = LZ.X.dateKey();
      if (!sv.day || sv.day.key !== key) sv.day = { key, coins: 0 };
      const coins = Math.max(0, Math.min(Math.floor(score / gm.perCoin), 15, DAY_CAP - sv.day.coins));
      sv.day.coins += coins; p.coins += coins; p.stats.totalCoins += coins;
      S.checkBadges(p); S.save();
      A.play(record ? 'win' : 'star');
      const fb = familyBest(id);
      m.box.querySelector('.row').replaceWith(h('div', null, [
        h('p', null, [h('b', null, 'Wynik: ' + score), record ? ' - nowy rekord!' : ' (rekord: ' + prev + ')']),
        fb ? h('p.note', null, '👑 Najlepszy w rodzinie: ' + fb.name + ' - ' + fb.s) : null,
        coins ? h('p', null, ['Nagroda: ', h('span.coin-ico'), ' ' + coins]) : null,
        h('div.row', null, [
          h('button.btn.small', { onclick: () => { m.close(); openMenu(); } }, 'Inne gry'),
          h('button.btn.small.primary', { onclick: () => { m.close(); play(id); } }, 'Jeszcze raz'),
        ]),
      ]));
    }
  }

  /* shared drawing bits */
  function tile(g, x, y, w, h, fill, edge, r) { U.rr(g, x, y, w, h, r || 10); Art.fs(g, fill, edge, 2.5); }
  function label(g, s, x, y, size, col) { g.font = '800 ' + size + 'px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = col || '#3b2a6b'; g.fillText(s, x, y + 1); }
  function backdrop(g, w, h) { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#3a2f6a'); gr.addColorStop(1, '#5a3f8a'); U.rr(g, 0, 0, w, h, 14); g.fillStyle = gr; g.fill(); }

  /* ================= Łańcuch sum ================= */
  function sumGame(p, size) {
    const N = 5, cell = size / N, kid = young(p), R = Math.random;
    const maxV = kid ? 5 : 9, TIME = 60;
    const grid = [];   // grid[x][y] = { v, oy }
    const rnd = () => 1 + Math.floor(R() * maxV);
    for (let x = 0; x < N; x++) { grid.push([]); for (let y = 0; y < N; y++) grid[x].push({ v: rnd(), oy: 0 }); }
    let chain = [], target = 0, score = 0, left = TIME, flash = 0, good = 0, pops = [];
    const adj = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])) === 1;
    const inChain = c => chain.findIndex(k => k[0] === c[0] && k[1] === c[1]);
    const sumOf = () => chain.reduce((s, c) => s + grid[c[0]][c[1]].v, 0);
    // the target is always the sum of some real path on the board, so there's always an answer
    function newTarget() {
      for (let tries = 0; tries < 50; tries++) {
        const len = kid ? (R() < 0.7 ? 2 : 3) : 2 + Math.floor(R() * 3);
        let c = [Math.floor(R() * N), Math.floor(R() * N)];
        const path = [c];
        for (let i = 1; i < len; i++) {
          const nb = [];
          for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const n = [c[0] + dx, c[1] + dy]; if ((dx || dy) && n[0] >= 0 && n[1] >= 0 && n[0] < N && n[1] < N && !path.some(q => q[0] === n[0] && q[1] === n[1])) nb.push(n); }
          if (!nb.length) break;
          c = nb[Math.floor(R() * nb.length)]; path.push(c);
        }
        const s = path.reduce((a, q) => a + grid[q[0]][q[1]].v, 0);
        if (path.length >= 2 && s >= (kid ? 4 : 8)) { target = s; return; }
      }
      target = grid[0][0].v + grid[1][0].v;
    }
    newTarget();
    const at = (x, y) => { const cx = Math.floor(x / cell), cy = Math.floor(y / cell); return cx >= 0 && cy >= 0 && cx < N && cy < N ? [cx, cy] : null; };
    function add(c) {
      if (!c) return;
      const i = inChain(c);
      if (i >= 0) { chain.length = i + 1; return; }   // back along the chain: undo
      if (chain.length && !adj(chain[chain.length - 1], c)) chain = [];
      chain.push(c); A.play('coin');
      const s = sumOf();
      if (s === target) {
        score += chain.length * 10 + (chain.length >= 4 ? 20 : 0); good++;
        A.play('correct');
        // the numbers pop, the ones above fall down and new ones drop in
        for (const q of chain) pops.push({ x: (q[0] + 0.5) * cell, y: (q[1] + 0.5) * cell, v: grid[q[0]][q[1]].v, life: 0.5 });
        for (let x = 0; x < N; x++) {
          const keep = grid[x].filter((c2, y) => inChain([x, y]) < 0);
          const fresh = N - keep.length;
          const col = [];
          for (let k = 0; k < fresh; k++) col.push({ v: rnd(), oy: -(fresh) * cell });
          keep.forEach((c2, k) => { const oldY = grid[x].indexOf(c2); c2.oy = (oldY - (fresh + k)) * cell; col.push(c2); });
          grid[x] = col;
        }
        chain = []; newTarget();
      } else if (s > target) { flash = 0.4; chain = []; A.play('wrong'); }
    }
    return {
      h: size,
      get score() { return score; }, get over() { return left <= 0; },
      down(x, y) { add(at(x, y)); },
      move(x, y) {
        const c = at(x, y); if (!c) return;
        // only react near the middle of a cell, so a diagonal drag doesn't catch the neighbours
        const fx = x / cell - c[0] - 0.5, fy = y / cell - c[1] - 0.5;
        if (fx * fx + fy * fy > 0.16) return;
        const lastC = chain[chain.length - 1];
        if (lastC && lastC[0] === c[0] && lastC[1] === c[1]) return;
        if (chain.length >= 2) { const pr = chain[chain.length - 2]; if (pr[0] === c[0] && pr[1] === c[1]) { chain.pop(); return; } }
        if (lastC && adj(lastC, c) && inChain(c) < 0) add(c);
      },
      up() {},
      tick(dt) {
        left = Math.max(0, left - dt); flash = Math.max(0, flash - dt);
        for (const col of grid) for (const c of col) c.oy *= Math.pow(0.0005, dt);
        pops = pops.filter(q => (q.life -= dt) > 0);
      },
      info() { const s = sumOf(); return ['🎯 Cel: ' + target + (chain.length ? ' (masz ' + s + ')' : ''), 'Wynik: ' + score + ' · ⏱ ' + Math.ceil(left) + ' s']; },
      draw(g, t) {
        backdrop(g, size, size);
        const s = sumOf();
        for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) {
          const c = grid[x][y], on = inChain([x, y]) >= 0;
          const X = x * cell + 4, Y = y * cell + 4 + c.oy;
          tile(g, X, Y, cell - 8, cell - 8, on ? '#ffd23f' : '#f6f2ff', on ? '#d98a0b' : '#9d7bff', 12);
          label(g, String(c.v), X + cell / 2 - 4, Y + cell / 2 - 4, cell * 0.45, on ? '#7a4a00' : '#3b2a6b');
        }
        // the chain as a line through the picked numbers
        if (chain.length > 1) {
          g.beginPath(); chain.forEach((q, i) => { const X = (q[0] + 0.5) * cell, Y = (q[1] + 0.5) * cell; if (i) g.lineTo(X, Y); else g.moveTo(X, Y); });
          g.strokeStyle = 'rgba(255,111,174,0.75)'; g.lineWidth = 8; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke();
        }
        for (const q of pops) { g.globalAlpha = q.life * 2; label(g, '+' + q.v, q.x, q.y - (0.5 - q.life) * 80, 28, '#ffe680'); g.globalAlpha = 1; }
        // too much: a red flash over the board
        if (flash > 0) { U.rr(g, 0, 0, size, size, 14); g.fillStyle = 'rgba(255,94,126,' + (flash * 0.9).toFixed(2) + ')'; g.fill(); }
      },
    };
  }

  /* ================= Pary (memory) ================= */
  function pairsGame(p, size) {
    const COLS = 4, ROWS = 3, hgt = Math.round(size * 0.8), cw = size / COLS, ch = hgt / ROWS, R = Math.random, kid = young(p);
    const pairs = [], used = new Set();
    while (pairs.length < 6) {
      let q, a;
      const k = R();
      if (kid) {
        if (k < 0.6) { const x = U.ri(R, 1, 9), y = U.ri(R, 1, 10 - x); q = x + ' + ' + y; a = x + y; }
        else { const x = U.ri(R, 3, 10), y = U.ri(R, 1, x - 1); q = x + ' − ' + y; a = x - y; }
      } else if (k < 0.5) { const x = U.ri(R, 2, 9), y = U.ri(R, 2, 9); q = x + ' × ' + y; a = x * y; }
      else if (k < 0.8) { const x = U.ri(R, 11, 49), y = U.ri(R, 5, 40); q = x + ' + ' + y; a = x + y; }
      else { const y = U.ri(R, 2, 9), a0 = U.ri(R, 2, 9); q = (a0 * y) + ' : ' + y; a = a0; }
      if (used.has(a)) continue;
      used.add(a); pairs.push([q, String(a)]);
    }
    const cards = U.shuffle(R, pairs.flatMap((pr, i) => [{ s: pr[0], id: i, eq: true }, { s: pr[1], id: i, eq: false }])).map(c => Object.assign(c, { up: false, flip: 0, done: false }));
    let open = [], wait = 0, misses = 0, clock = 0, found = 0;
    return {
      h: hgt,
      get score() { return found < 6 ? found * 20 : Math.max(20, 300 - misses * 10 - Math.floor(clock)); },
      get over() { return found === 6 || clock >= 180; },
      down(x, y) {
        if (wait > 0) return;
        const i = Math.floor(y / ch) * COLS + Math.floor(x / cw), c = cards[i];
        if (!c || c.up || c.done) return;
        c.up = true; open.push(c); A.play('pop');
        if (open.length === 2) {
          if (open[0].id === open[1].id) { open.forEach(o => { o.done = true; }); found++; open = []; A.play('correct'); }
          else { misses++; wait = 0.9; A.play('bump'); }
        }
      },
      tick(dt) {
        if (found < 6) clock += dt;
        if (wait > 0) { wait -= dt; if (wait <= 0) { open.forEach(o => { o.up = false; }); open = []; } }
        for (const c of cards) c.flip = U.clamp(c.flip + (c.up ? dt : -dt) * 6, 0, 1);
      },
      info() { return ['Pary: ' + found + ' / 6', 'Pomyłki: ' + misses + ' · ⏱ ' + Math.floor(clock) + ' s']; },
      draw(g, t) {
        backdrop(g, size, hgt);
        cards.forEach((c, i) => {
          const X = (i % COLS) * cw, Y = Math.floor(i / COLS) * ch, sx = Math.abs(Math.cos(c.flip * Math.PI));
          const face = c.flip > 0.5;
          g.save(); g.translate(X + cw / 2, Y + ch / 2); g.scale(Math.max(0.05, sx), 1);
          if (face) {
            tile(g, -cw / 2 + 5, -ch / 2 + 5, cw - 10, ch - 10, c.done ? '#c8f5d0' : c.eq ? '#fff6c9' : '#e0f2ff', c.done ? '#3fb866' : c.eq ? '#d9a40b' : '#3aa8e0', 12);
            label(g, c.s, 0, 0, Math.min(cw * 0.26, c.s.length > 6 ? 22 : 30), '#3b2a6b');
          } else {
            tile(g, -cw / 2 + 5, -ch / 2 + 5, cw - 10, ch - 10, '#9d7bff', '#5a3fbf', 12);
            Art.starPath(g, 0, 0, Math.min(cw, ch) * 0.2, Math.min(cw, ch) * 0.09, 5, 0); Art.fs(g, '#ffd23f');
          }
          g.restore();
        });
      },
    };
  }

  /* ================= Podwajanie (2048) ================= */
  function mergeGame(p, size) {
    const N = 4, cell = size / N, R = Math.random;
    let tiles = [], score = 0, over = false, sx = 0, sy = 0, idc = 0;
    const COL = { 2: '#fff1c7', 4: '#ffe0a8', 8: '#ffc07a', 16: '#ff9e6a', 32: '#ff7f7f', 64: '#ff5e7e', 128: '#d98bff', 256: '#b07aff', 512: '#7a8cff', 1024: '#4ab8ff', 2048: '#3fd88a' };
    const at = (x, y) => tiles.find(q => q.x === x && q.y === y && !q.gone);
    function spawn() {
      const free = [];
      for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) if (!at(x, y)) free.push([x, y]);
      if (!free.length) return;
      const f = free[Math.floor(R() * free.length)];
      tiles.push({ id: idc++, x: f[0], y: f[1], dx: f[0], dy: f[1], v: R() < 0.9 ? 2 : 4, pop: 0.01 });
    }
    spawn(); spawn();
    function canMove() {
      for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) {
        const a = at(x, y); if (!a) return true;
        const r = at(x + 1, y), d = at(x, y + 1);
        if ((r && r.v === a.v) || (d && d.v === a.v)) return true;
      }
      return false;
    }
    function move(dir) {
      const [ddx, ddy] = dir;
      tiles = tiles.filter(q => !q.gone);
      let moved = false;
      const order = [];
      for (let i = 0; i < N; i++) order.push(ddx > 0 || ddy > 0 ? N - 1 - i : i);
      const merged = new Set();
      for (const a of order) for (const b of order) {
        const x = ddx ? a : b, y = ddx ? b : a;
        const tq = at(x, y); if (!tq) continue;
        let nx = x, ny = y;
        while (true) {
          const tx = nx + ddx, ty = ny + ddy;
          if (tx < 0 || ty < 0 || tx >= N || ty >= N) break;
          const o = at(tx, ty);
          if (!o) { nx = tx; ny = ty; continue; }
          if (o.v === tq.v && !merged.has(o.id) && !merged.has(tq.id)) {
            // join: the moving tile slides into the other and disappears, the other doubles
            o.v *= 2; o.pop = 0.01; merged.add(o.id); score += o.v;
            tq.gone = true; tq.x = tx; tq.y = ty; moved = true;
            A.play('coin');
          }
          break;
        }
        if (!tq.gone && (nx !== x || ny !== y)) { tq.x = nx; tq.y = ny; moved = true; }
      }
      if (moved) { spawn(); if (!canMove()) over = true; }
    }
    return {
      h: size,
      get score() { return score; }, get over() { return over; },
      down(x, y) { sx = x; sy = y; },
      up(x, y) {
        const dx = x - sx, dy = y - sy;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
        move(Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)]);
      },
      key(dir) { move(dir); },
      tick(dt) {
        for (const q of tiles) {
          q.dx += (q.x - q.dx) * Math.min(1, dt * 18); q.dy += (q.y - q.dy) * Math.min(1, dt * 18);
          if (q.pop > 0) q.pop = Math.min(1, q.pop + dt * 5);
          if (q.gone && Math.abs(q.dx - q.x) + Math.abs(q.dy - q.y) < 0.05) q.dead = true;
        }
        tiles = tiles.filter(q => !q.dead);
      },
      info() { return ['Wynik: ' + score, 'Przesuwaj: palcem lub strzałkami']; },
      draw(g, t) {
        backdrop(g, size, size);
        for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) { U.rr(g, x * cell + 5, y * cell + 5, cell - 10, cell - 10, 12); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fill(); }
        for (const q of tiles.slice().sort((a, b) => (a.gone ? 0 : 1) - (b.gone ? 0 : 1))) {
          const s = q.pop > 0 && q.pop < 1 ? 1 + Math.sin(q.pop * Math.PI) * 0.15 : 1;
          const X = q.dx * cell + cell / 2, Y = q.dy * cell + cell / 2, w = (cell - 10) * s;
          tile(g, X - w / 2, Y - w / 2, w, w, COL[q.v] || '#3fd88a', 'rgba(90,50,30,0.5)', 12);
          label(g, String(q.v), X, Y, cell * (q.v >= 1000 ? 0.26 : q.v >= 100 ? 0.32 : 0.4), q.v >= 64 ? '#fff' : '#5a3a1a');
        }
        if (over) { g.fillStyle = 'rgba(40,20,60,0.55)'; g.fillRect(0, 0, size, size); label(g, 'Brak ruchów!', size / 2, size / 2, 34, '#fff'); }
      },
    };
  }

  /* ================= the machine in the house ================= */
  function drawMachine(g, x, yb, w, t) {
    const h = 2.4 * T, fs = Art.fs, rr = U.rr;
    // the cabinet
    g.beginPath(); g.moveTo(x + 6, yb); g.lineTo(x + 6, yb - h + 20); g.lineTo(x + 14, yb - h); g.lineTo(x + w - 14, yb - h); g.lineTo(x + w - 6, yb - h + 20); g.lineTo(x + w - 6, yb); g.closePath();
    fs(g, '#7a5ce6', '#3a2a8a', 3);
    rr(g, x + 10, yb - h + 4, w - 20, 20, 6); fs(g, '#ff6fae', '#b8467a', 2);
    g.font = '800 14px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText('GRY', x + w / 2, yb - h + 15);
    // the screen with something moving on it
    const sx = x + 14, sy = yb - h + 32, sw = w - 28, sh = 46;
    rr(g, sx, sy, sw, sh, 6); fs(g, '#1a1440', '#0a0820', 2);
    g.save(); rr(g, sx, sy, sw, sh, 6); g.clip();
    const k = Math.floor(t * 2) % 3;
    if (k === 0) { for (let i = 0; i < 4; i++) { rr(g, sx + 6 + i * (sw - 12) / 4, sy + 12, (sw - 12) / 4 - 4, 22, 3); fs(g, ['#ffd23f', '#ff9e6a', '#ff5e7e', '#9d7bff'][i]); } }
    else if (k === 1) { g.font = '800 18px ' + FONT; g.fillStyle = '#7fffb0'; g.fillText('2+2=4', sx + sw / 2, sy + sh / 2 + 1); }
    else { for (let i = 0; i < 3; i++) { Art.starPath(g, sx + 14 + i * 22, sy + sh / 2 + Math.sin(t * 6 + i) * 6, 7, 3, 5, 0); fs(g, '#ffe680'); } }
    g.restore();
    // the control panel
    g.beginPath(); g.moveTo(x + 4, yb - h + 92); g.lineTo(x + w - 4, yb - h + 92); g.lineTo(x + w, yb - h + 108); g.lineTo(x, yb - h + 108); g.closePath(); fs(g, '#5a3fbf', '#2a1a6a', 2);
    g.strokeStyle = '#3a2a3a'; g.lineWidth = 4; g.beginPath(); g.moveTo(x + 20, yb - h + 100); g.lineTo(x + 22, yb - h + 86); g.stroke();
    Art.ell(g, x + 22, yb - h + 84, 6, 6); fs(g, '#ff5e7e', '#a02a4a', 1.5);
    Art.ell(g, x + w - 26, yb - h + 99, 5, 3.5); fs(g, '#ffd23f', '#b8861c', 1.5);
    Art.ell(g, x + w - 14, yb - h + 99, 5, 3.5); fs(g, '#5ccfff', '#2a7ab0', 1.5);
    // coin slot and side lights
    rr(g, x + w / 2 - 8, yb - 40, 16, 20, 3); fs(g, '#3a2a8a', '#2a1a6a', 1.5); g.fillStyle = '#ffd23f'; g.fillRect(x + w / 2 - 1.5, yb - 36, 3, 12);
    for (let i = 0; i < 4; i++) { Art.ell(g, x + 10, yb - 20 - i * 18, 3, 3); fs(g, Math.floor(t * 4 + i) % 2 ? '#ffe680' : '#7a64b0'); }
  }

  LZ.Ext.add({
    home: {
      init(G) {
        const f = Fun.state(G.prof);
        if (!f.arcadeGiven) {
          f.arcadeGiven = true;
          const placed = LZ.Home.homeOf(G.prof).items.some(i => i.id === 'arcade') || LZ.Home.autoPlace(G.prof, 'arcade');
          LZ.Home.spawnFurniture(G); S.save();
          setTimeout(() => LZ.Game._toast(placed ? 'Nowość: automat z grami! Stań przy nim.' : 'Nowość: automat z grami! Czeka w „Urządzaj”.', 3.2), 4400);
        }
      },
      tick(G, dt) {
        const ar = G.ents.find(e => e.k === 'furn' && e.id === 'arcade');
        if (ar && Fun.stand(G, ar, dt, { cx: ar.x + ar.w / 2, cy: ar.y, dx: ar.w / 2 + 6, t: 0.8 })) openMenu();
      },
      drawHUD(g, G) {
        const ar = G.ents.find(e => e.k === 'furn' && e.id === 'arcade');
        if (ar && ar._st > 0.05) { g.save(); g.translate(-G.cam.x, -G.cam.y); Fun.ring(g, ar.x + ar.w / 2, ar.y - 2.4 * T - 30, ar, 0.8); g.restore(); }
      },
    },
    furn: { draw(g, id, X, Y, w, t) { if (id !== 'arcade') return false; drawMachine(g, X, Y, w, t); return true; } },
  });

  LZ.Arcade = { open: openMenu, play, GAMES, familyBest, _sum: sumGame, _pairs: pairsGame, _merge: mergeGame };
})();
