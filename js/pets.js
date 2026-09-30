/*
 * pets.js - her own pet: a kitten, a puppy or a bunny that lives in the house.
 *
 * She adopts it once, gives it a name and feeds it every day (a maths story
 * about its crunchies). A fed pet is happy and comes along on the adventure:
 * it trots behind her, sniffs out the nearest treasure chest (an arrow in the
 * corner shows where) and fetches coins and finds that lie close by.
 *
 * Save data (profile.fun.pupil):
 *   type 'kitten' | 'puppy' | 'bunny', name, col (colour index)
 *   happy 0-100, fedDay / playDay / treatDay (dateKey), lastDay (for the
 *   daily drop in happiness), trips (adventures together)
 */
(function () {
  const U = LZ.U, S = LZ.S, A = LZ.A, Art = LZ.Art, Fun = LZ.Fun, Bag = LZ.Bag;
  const T = LZ.T;

  const TYPES = {
    kitten: { name: 'Kotek', cols: [['#ffb366', '#e08a3a'], ['#b8b8c8', '#8a8aa0'], ['#4a4a5a', '#2a2a3a']], names: ['Mruczek', 'Figa', 'Puszek', 'Kluska', 'Sierściuch', 'Mgiełka'] },
    puppy: { name: 'Piesek', cols: [['#c98a5a', '#8a5a32'], ['#f3dcb0', '#c9a878'], ['#ffffff', '#6b4424']], names: ['Burek', 'Łatka', 'Kulka', 'Reksio', 'Pestka', 'Figiel'] },
    bunny: { name: 'Króliczek', cols: [['#ffffff', '#c9c0d0'], ['#c8c0c8', '#8a808a'], ['#b88a6a', '#8a5a3a']], names: ['Uszatek', 'Kicia', 'Tuptuś', 'Marchewka', 'Śnieżka', 'Pompon'] },
  };
  const pupil = p => Fun.state(p).pupil || null;

  /* Happiness drops a little for every day she wasn't fed; checked whenever the pet is looked at. */
  function settle(p) {
    const pu = pupil(p); if (!pu) return null;
    const now = Fun.today();
    if (pu.lastDay && pu.lastDay !== now) {
      const days = Math.max(0, Math.round((new Date(now) - new Date(pu.lastDay)) / 864e5));
      // the day it was last fed doesn't count as a hungry day
      const hungry = Math.max(0, days - (pu.fedDay === pu.lastDay ? 1 : 0));
      pu.happy = Math.max(0, pu.happy - hungry * 20);
    }
    pu.lastDay = now;
    return pu;
  }
  const fedToday = pu => pu && pu.fedDay === Fun.today();

  /* ================= drawing ================= */
  /*
   * The pet from the side, feet at (x, y), facing right unless f = -1.
   * st: 'walk' | 'sit' | 'sleep' | 'jump' ; ph = walking phase
   */
  function draw(g, pu, x, y, t, st, f, ph, sc) {
    const ell = Art.ell, fs = Art.fs, rr = U.rr;
    const [c1, c2] = TYPES[pu.type].cols[pu.col || 0];
    const ol = U.shade(c2, -0.35);
    g.save(); g.translate(x, y); g.scale((f || 1) * (sc || 1), sc || 1);
    const walk = st === 'walk', sleep = st === 'sleep', sit = st === 'sit';
    const bob = walk ? Math.abs(Math.sin(ph)) * 2 : sleep ? Math.sin(t * 2) * 0.8 : 0;
    const legA = walk ? Math.sin(ph) * 5 : 0;
    if (sleep) {
      // curled up in a ball
      ell(g, 0, -10 - bob * 0.3, 18, 11); fs(g, c1, ol, 2);
      ell(g, 11, -9, 9, 8); fs(g, c1, ol, 2);
      ears(g, 11, -9, 0.8);
      g.strokeStyle = '#3a2a3a'; g.lineWidth = 1.6; g.beginPath(); g.arc(13, -9, 2.5, 0.2, Math.PI - 0.2); g.stroke();
      tail(g, -16, -8, 0);
      g.fillStyle = '#7a5ce6'; g.font = '800 14px "Baloo 2", sans-serif'; g.textAlign = 'center';
      const k = (t * 0.6) % 1; g.globalAlpha = 1 - k; g.fillText('z', 18 + k * 10, -26 - k * 18); g.globalAlpha = 1;
      g.restore(); return;
    }
    // legs (back pair behind the body)
    const legs = sit ? [[-9, 0], [-4, 0]] : [[-11, legA], [-6, -legA], [7, -legA], [12, legA]];
    legs.forEach(([lx, a], i) => { rr(g, lx + a * 0.4, -10, 6, 10 - (i % 2 ? 0 : 0), 3); fs(g, i < 2 ? U.shade(c1, -0.12) : c1, ol, 1.5); });
    tail(g, sit ? -14 : -16, sit ? -8 : -16 - bob, t);
    if (sit) { ell(g, -2, -14, 13, 12); fs(g, c1, ol, 2); rr(g, 4, -12, 6, 12, 3); fs(g, c1, ol, 1.5); rr(g, 10, -12, 6, 12, 3); fs(g, c1, ol, 1.5); }
    else { ell(g, 0, -17 - bob, 17, 10); fs(g, c1, ol, 2); }
    if (pu.type === 'puppy' && pu.col === 2) { ell(g, -5, -19 - bob, 6, 4); fs(g, c2); }
    // head
    const hx = sit ? 8 : 14, hy = (sit ? -30 : -27) - bob;
    ears(g, hx, hy, 1);
    ell(g, hx, hy, 11, 10); fs(g, c1, ol, 2);
    if (pu.type === 'puppy') { ell(g, hx + 8, hy + 3, 6, 5); fs(g, U.shade(c1, 0.25), ol, 1.2); ell(g, hx + 13, hy + 1, 2.8, 2.2); fs(g, '#2a2a3a'); }
    else { ell(g, hx + 9, hy + 2, 1.8, 1.4); fs(g, '#ff85a8'); }
    ell(g, hx + 4, hy - 2, 2.2, 2.6); fs(g, '#2a2a3a'); ell(g, hx + 4.6, hy - 3, 0.8, 0.8); fs(g, '#fff');
    ell(g, hx + 2, hy + 4, 3, 1.8); fs(g, 'rgba(255,120,160,0.45)');
    if (pu.type === 'kitten') { g.strokeStyle = ol; g.lineWidth = 0.8; g.beginPath(); for (const d of [-1, 1]) { g.moveTo(hx + 9, hy + 3); g.lineTo(hx + 17, hy + 3 + d * 2.5); } g.stroke(); }
    g.restore();

    function ears(g, hx, hy, s) {
      if (pu.type === 'kitten') { for (const d of [-5, 3]) { Art.tri(g, hx + d - 4 * s, hy - 6 * s, hx + d + 1 * s, hy - 15 * s, hx + d + 5 * s, hy - 6 * s); fs(g, c1, ol, 1.5); } }
      else if (pu.type === 'puppy') { g.save(); g.translate(hx - 5, hy - 4); g.rotate(0.5); ell(g, 0, 6 * s, 4.5 * s, 9 * s); fs(g, c2, ol, 1.5); g.restore(); }
      else { for (const d of [-4, 2]) { g.save(); g.translate(hx + d, hy - 8 * s); g.rotate(-0.25 + d * 0.03); ell(g, 0, -8 * s, 3.8 * s, 10 * s); fs(g, c1, ol, 1.5); ell(g, 0, -8 * s, 1.8 * s, 7 * s); fs(g, '#ffc0d0'); g.restore(); } }
    }
    function tail(g, tx, ty, t) {
      if (pu.type === 'kitten') { g.strokeStyle = ol; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.moveTo(tx + 3, ty); g.quadraticCurveTo(tx - 10, ty - 4, tx - 8 + Math.sin(t * 2) * 3, ty - 18); g.stroke(); g.strokeStyle = c1; g.lineWidth = 4.5; g.stroke(); }
      else if (pu.type === 'puppy') { g.save(); g.translate(tx + 2, ty); g.rotate(-0.8 + Math.sin(t * 14) * 0.45); ell(g, 0, -6, 3.2, 7); fs(g, c1, ol, 1.5); g.restore(); }
      else { ell(g, tx + 1, ty, 6, 6); fs(g, '#ffffff', '#c9c0d0', 1.5); }
    }
  }

  /* ================= adopting ================= */
  function adopt(then) {
    const p = S.active(), f = Fun.state(p), h = LZ.UI._h;
    let type = null, col = 0, name = '';
    const box = h('div');
    const m = Fun.open([h('h2', null, 'Ktoś drapie w drzwi!'), box]);
    const pic = (pu, w, hh) => {
      const c = document.createElement('canvas'); c.width = w * 2; c.height = hh * 2; c.style.width = w + 'px'; c.style.height = hh + 'px';
      const g = c.getContext('2d'); g.scale(2, 2); draw(g, pu, w / 2 - 2, hh - 6, 0.3, 'sit', 1, 0, 1.5); return c;
    };
    function step1() {
      box.innerHTML = '';
      box.appendChild(h('p', null, 'Przed domkiem siedzą trzy maluchy, które szukają domu. Którego przygarniesz?'));
      box.appendChild(h('div.funrow', null, Object.keys(TYPES).map(k => h('button.funpick', { onclick: () => { type = k; step2(); } }, [pic({ type: k, col: 0 }, 100, 80), TYPES[k].name]))));
      box.appendChild(h('button.btn.small.ghost', { onclick: () => { f.adoptLater = Fun.today(); S.save(); m.close(); } }, 'Później'));
    }
    function step2() {
      box.innerHTML = '';
      box.appendChild(h('p', null, 'Jakiego koloru jest twój ' + TYPES[type].name.toLowerCase() + '?'));
      box.appendChild(h('div.funrow', null, TYPES[type].cols.map((_, i) => h('button.funpick', { onclick: () => { col = i; step3(); } }, [pic({ type, col: i }, 100, 80)]))));
    }
    function step3() {
      box.innerHTML = '';
      box.appendChild(h('p', null, 'Jak ma na imię?'));
      const inp = h('input.funinput', { maxlength: 14, placeholder: 'Imię' });
      box.appendChild(inp);
      box.appendChild(h('div.funrow', null, TYPES[type].names.map(n => h('button.btn.small', { onclick: () => { inp.value = n; } }, n))));
      box.appendChild(h('button.btn.mid.primary', { onclick: () => {
        name = inp.value.trim().replace(/\s+/g, ' ');
        if (!name) { inp.focus(); A.play('bump'); return; }
        f.pupil = { type, col, name: name.charAt(0).toUpperCase() + name.slice(1), happy: 60, fedDay: null, lastDay: Fun.today(), adopted: Date.now(), trips: 0 };
        // a bed of its own goes straight into the room
        const placed = LZ.Home.autoPlace(p, 'petbed');
        if (!placed) setTimeout(() => LZ.Game._toast('Legowisko czeka w „Urządzaj” - postaw je w pokoju!', 3), 800);
        S.checkBadges(p); S.save(); A.play('win');
        m.close(); if (then) then();
      } }, 'Gotowe!'));
    }
    step1();
  }

  /* ================= the pet's card ================= */
  function card() {
    const p = S.active(), pu = settle(p), h = LZ.UI._h;
    if (!pu) { adopt(() => { const G = LZ.Game._dbg(); if (G && G.kind === 'home') { spawnHome(G); refreshBar(G); } }); return; }
    const c = document.createElement('canvas'); c.width = 440; c.height = 180; c.className = 'funcanvas'; c.style.width = '220px';
    const g = c.getContext('2d');
    let anim = 'sit', animT = 0;
    const box = h('div');
    const m = Fun.open([h('h2', null, '🐾 ' + pu.name), c, box], () => clearInterval(iv));
    const t0 = performance.now();
    const iv = setInterval(() => {
      const t = (performance.now() - t0) / 1000; animT += 0.05;
      g.setTransform(2, 0, 0, 2, 0, 0); g.clearRect(0, 0, 220, 90);
      g.fillStyle = '#f6f2ff'; U.rr(g, 0, 0, 220, 90, 14); g.fill();
      const jump = anim === 'jump' ? Math.abs(Math.sin(animT * 5)) * 26 : 0;
      draw(g, pu, 110, 82 - jump, t, anim === 'jump' ? 'walk' : anim, 1, t * 10, 1.4);
      if (anim === 'jump' || anim === 'eat') for (let i = 0; i < 3; i++) { const k = (t * 0.8 + i / 3) % 1; g.globalAlpha = 1 - k; Art.heartPath(g, 80 + i * 30, 40 - k * 30, 6); Art.fs(g, '#ff5e7e'); g.globalAlpha = 1; }
      if (anim === 'eat') { Art.ell(g, 150, 80, 14, 5); Art.fs(g, '#5ccfff', '#2a7fb0', 1.5); }
      if (animT > 3 && anim !== 'sit') anim = 'sit';
    }, 50);
    function render(msg) {
      box.innerHTML = '';
      const fed = fedToday(pu);
      box.appendChild(h('div.funbar', null, h('i', { style: 'width:' + Math.max(4, pu.happy) + '%' })));
      box.appendChild(h('p', null, (msg ? msg + ' ' : '') + (fed ? 'Brzuszek pełny! ' + pu.name + ' pójdzie z tobą na wyprawę.' : 'Brzuszek pusty... Nakarm pupila, to pójdzie z tobą na wyprawę!')));
      const row = h('div.funrow');
      if (!fed) row.appendChild(h('button.btn.mid.primary', { onclick: feed }, '🥣 Nakarm'));
      row.appendChild(h('button.btn.mid', { onclick: play }, '🎾 Pobaw się'));
      if (Bag.count(p, 'treat')) row.appendChild(h('button.btn.mid', { onclick: () => giveTreat(p, render) }, '🦴 Smakołyk'));
      box.appendChild(row);
      box.appendChild(h('button.btn.small.ghost', { onclick: () => m.close() }, 'Pa pa!'));
    }
    function feed() {
      const q = h('div'); box.innerHTML = ''; box.appendChild(q);
      Fun.ask(q, p, () => Fun.story(p, ['chrupka', 'chrupki', 'chrupek'], { who: pu.name, gone: 'zjedzono', place: 'W misce' }), () => {
        pu.fedDay = Fun.today(); pu.happy = Math.min(100, pu.happy + 30);
        anim = 'eat'; animT = 0; A.play('coin');
        S.checkBadges(p); S.save(); render('Mniam, mniam!');
        const G = LZ.Game._dbg(); if (G && G.kind === 'home') { const e = G.ents.find(x => x.k === 'pupil'); if (e) { e.mode = 'sit'; e.wait = 2; } }
      }, { title: 'Ile chrupek?', cancel: () => render() });
    }
    function play() {
      anim = 'jump'; animT = 0; A.play('jump');
      if (pu.playDay !== Fun.today()) { pu.playDay = Fun.today(); pu.happy = Math.min(100, pu.happy + 10); S.save(); }
      render(U.pick(Math.random, ['Hop, hop!', 'Łap piłkę!', pu.name + ' merda z radości!', 'Jeszcze raz!']));
    }
    render();
  }
  function giveTreat(p, then) {
    const pu = settle(p);
    if (!pu || !Bag.take(p, 'treat')) return;
    pu.happy = Math.min(100, pu.happy + 20); A.play('coin'); S.save();
    if (then) then(pu.name + ' uwielbia smakołyki!');
  }

  /* ================= in the house ================= */
  const H = () => LZ.Home;
  function spawnHome(G) {
    const pu = settle(G.prof); if (!pu) return;
    G.ents = G.ents.filter(e => e.k !== 'pupil');
    const bed = H().homeOf(G.prof).items.find(it => it.id === 'petbed');
    const x = bed ? (bed.x + 0.75) * T : G.player.x - 60;
    G.ents.push({ k: 'pupil', x, y: H().FLOOR * T, vx: 0, f: 1, ph: 0, mode: fedToday(pu) ? 'sit' : 'hungry', wait: 1.5, tx: x, hearts: 0 });
  }
  function refreshBar(G) { LZ.Fun.bar('home', true, [{ label: '🛋 Urządzaj', fn: () => LZ.Home.openDeco() }]); }
  function bedX(G) { const b = G.ents.find(e => e.k === 'furn' && e.id === 'petbed'); return b ? b.x + b.w / 2 : null; }
  function homeUpdate(G, e, dt) {
    const pu = pupil(G.prof); if (!pu) return;
    const p = G.player, pcx = p.x + 14;
    e.ph += dt * 10; e.wait -= dt;
    const W = G.W * T;
    if (e.mode === 'walk') {
      const d = e.tx - e.x;
      if (Math.abs(d) < 6) { e.mode = e.then || 'sit'; e.then = null; e.wait = 2 + Math.random() * 4; e.vx = 0; }
      else { e.vx = Math.sign(d) * (e.run ? 200 : 80); e.f = Math.sign(d); e.x += e.vx * dt; }
    } else if (e.wait <= 0) {
      // what next: follow her, go for a nap on the bed, or just wander about
      const bx = bedX(G), r = Math.random();
      if (Math.abs(pcx - e.x) > 160 && r < 0.5) { e.tx = pcx - Math.sign(pcx - e.x) * 50; e.run = true; e.mode = 'walk'; e.then = 'sit'; }
      else if (bx != null && r < 0.7 && fedToday(pu)) { e.tx = bx; e.run = false; e.mode = 'walk'; e.then = 'sleep'; }
      else { e.tx = U.clamp(e.x + (Math.random() - 0.5) * 400, T * 1.5, W - T * 1.5); e.run = false; e.mode = 'walk'; e.then = fedToday(pu) ? 'sit' : 'hungry'; }
    }
    // hearts when she stands right next to it
    const near = Math.abs(pcx - e.x) < 40 && Math.abs(p.y + 40 - e.y) < 30;
    if (near && e.mode !== 'walk') { e.hearts += dt; if (e.hearts > 0.5) { e.hearts = 0; LZ.Game._floatText(e.x, e.y - 50, '♥', '#ff5e7e', 22); } }
  }
  function homeDraw(g, e, t, G) {
    const pu = pupil(G.prof); if (!pu) return;
    const st = e.mode === 'walk' ? 'walk' : e.mode === 'sleep' ? 'sleep' : 'sit';
    draw(g, pu, e.x, e.y + 1, t, st, e.f, e.ph);
    if (e.mode === 'hungry') Fun.bubble(g, e.x, e.y - 50 + Math.sin(t * 3) * 2, 'Mniam?', '#ff6f91');
  }

  /* ================= on the adventure ================= */
  const SOLID = '#IBU?=<>TWLQ';   // it trots over water, lava and quicksand like a little wizard
  function spawnWorld(G) {
    const pu = settle(G.prof);
    G.ents = G.ents.filter(e => e.k !== 'pupil');
    if (!pu || !fedToday(pu)) return;
    const p = G.player;
    G.ents.push({ k: 'pupil', x: p.x + 14 - 40 * p.facing, y: p.y + 40, vx: 0, vy: 0, f: p.facing, ph: 0, g: false, far: 0, sniffT: 0, sniff: null });
  }
  const tileAt = (G, x, y) => { const tx = Math.floor(x / T), ty = Math.floor(y / T); return (G.grid[tx] && G.grid[tx][ty]) || '.'; };
  function worldUpdate(G, e, dt) {
    const p = G.player, pcx = p.x + 14, pfy = p.y + 40;
    if (G.ride) { e.x = pcx; e.y = pfy; e.hide = true; return; }
    e.hide = false;
    e.ph += Math.abs(e.vx) * dt * 0.05;
    // run to a spot behind her
    const tx = pcx - p.facing * 46, dx = tx - e.x;
    const want = Math.abs(dx) < 10 ? 0 : Math.sign(dx) * Math.min(360, 120 + Math.abs(dx) * 2.5);
    e.vx += U.clamp(want - e.vx, -2400 * dt, 2400 * dt);
    if (Math.abs(e.vx) > 20) e.f = Math.sign(e.vx);
    // a wall in front: hop
    const nx = e.x + e.vx * dt;
    const ahead = nx + Math.sign(e.vx) * 12;
    if (SOLID.includes(tileAt(G, ahead, e.y - 8)) && e.vx !== 0) {
      if (e.g) { e.vy = -760; e.g = false; }
      e.vx = 0;
    } else e.x = nx;
    // gravity and landing
    e.vy = Math.min(1000, e.vy + 2300 * dt);
    const ny = e.y + e.vy * dt;
    if (e.vy >= 0) {
      const below = tileAt(G, e.x, ny), top = Math.floor(ny / T) * T;
      if ((SOLID.includes(below) || below === '-') && e.y <= top + 4) { e.y = top; e.vy = 0; e.g = true; }
      else { e.y = ny; e.g = false; }
    } else {
      if (SOLID.replace('W', '').replace('L', '').replace('Q', '').includes(tileAt(G, e.x, ny - 30))) e.vy = 0; else e.y = ny;
      e.g = false;
    }
    // got left behind (a vine, a cave, a flag jump): pop back next to her
    const far = Math.abs(pcx - e.x) > 7 * T || Math.abs(pfy - e.y) > 4 * T;
    e.far = far ? e.far + dt : 0;
    if (e.far > 1.2 && p.grounded) {
      for (let i = 0; i < 10; i++) G.particles.push({ x: e.x, y: e.y - 20, vx: (Math.random() - 0.5) * 200, vy: -Math.random() * 160, life: 0.5, max: 0.5, size: 5, kind: 'sparkle', rot: 0, grav: 0 });
      e.x = pcx - p.facing * 40; e.y = pfy; e.vx = e.vy = 0; e.far = 0;
    }
    // fetch: coins and finds near the pet fly to her
    for (const o of G.ents) {
      if (o.k !== 'coin' && o.k !== 'witem') continue;
      const ox = o.x, oy = o.y, d = Math.hypot(ox - e.x, oy - (e.y - 20));
      if (d < 3 * T) { const tx2 = pcx - ox, ty2 = p.y + 20 - oy, dd = Math.hypot(tx2, ty2) || 1; o.x += tx2 / dd * 420 * dt; o.y += ty2 / dd * 420 * dt; }
    }
    // sniff: the closest closed chest or treasure spot, now and then
    e.sniffT -= dt;
    if (e.sniffT <= 0) {
      e.sniffT = 1;
      let best = null, bd = 60 * T;
      for (const o of G.ents) {
        if (!((o.k === 'wchest' && !o.opened) || o.k === 'digspot' || (o.k === 'guard' && !o.done))) continue;
        const d = Math.hypot(o.x - pcx, o.y - pfy);
        if (d < bd) { bd = d; best = o; }
      }
      e.sniff = best;
    }
  }
  function worldDraw(g, e, t, G) {
    const pu = pupil(G.prof); if (!pu || e.hide) return;
    draw(g, pu, e.x, e.y + 1, t, !e.g ? 'walk' : Math.abs(e.vx) > 20 ? 'walk' : 'sit', e.f, e.ph);
    if (e.sniff) { g.globalAlpha = 0.6 + 0.4 * Math.sin(t * 6); Fun.bubble(g, e.x, e.y - 46, '!', '#ff8a3d'); g.globalAlpha = 1; }
  }
  // "Mruczek czuje skarb" with an arrow at the bottom left of the screen
  function sniffHUD(g, G, vw, vh, t, text) {
    const e = G.ents.find(x => x.k === 'pupil');
    const pu = pupil(G.prof);
    if (!e || !pu || !e.sniff || e.hide) return;
    const p = G.player, dx = e.sniff.x - (p.x + 14), dy = (e.sniff.y - 20) - (p.y + 20);
    const m = Math.round(Math.hypot(dx, dy) / T);
    const x = 60, y = 150;   // under the hearts, clear of the arrow buttons at the bottom
    g.save(); g.fillStyle = 'rgba(58,36,110,0.72)'; U.rr(g, 14, y - 34, 250, 68, 18); g.fill();
    g.translate(x, y); draw(g, pu, -6, 20, t, 'sit', 1, 0, 0.8); g.restore();
    const ang = Math.atan2(dy, dx);
    g.save(); g.translate(230, y); g.rotate(ang);
    g.beginPath(); g.moveTo(18, 0); g.lineTo(-6, -13); g.lineTo(-1, 0); g.lineTo(-6, 13); g.closePath(); Art.fs(g, '#ffd23f', '#b8861c', 2); g.restore();
    text(g, pu.name + ' czuje skarb', 146, y - 10, 16, '#fff', '#3a246e');
    text(g, m < 2 ? 'Tutaj!' : m + ' m', 146, y + 14, 20, '#ffe680', '#3a246e');
  }

  LZ.Ext.add({
    home: {
      init(G) {
        const f = Fun.state(G.prof);
        if (pupil(G.prof)) spawnHome(G);
        else if (f.adoptLater !== Fun.today()) setTimeout(() => { const g2 = LZ.Game._dbg(); if (g2 && g2.kind === 'home' && !pupil(g2.prof) && !LZ.UI.isPaused()) adopt(() => { spawnHome(g2); refreshBar(g2); }); }, 1600);
      },
      buttons(list) { const pu = pupil(S.active()); list.push({ label: '🐾 ' + (pu ? pu.name : 'Pupil'), fn: card }); },
      updateEnt(G, e, i, dt) { if (e.k !== 'pupil') return false; homeUpdate(G, e, dt); return true; },
      drawEnt(g, e, t, G) { if (e.k !== 'pupil') return false; homeDraw(g, e, t, G); return true; },
    },
    world: {
      init(G) { const pu = settle(G.prof); G.pupilCame = !!(pu && fedToday(pu)); if (G.pupilCame) pu.trips = (pu.trips || 0) + 1; },
      placed(G) { spawnWorld(G); },
      updateEnt(G, e, i, dt) { if (e.k !== 'pupil') return false; worldUpdate(G, e, dt); return true; },
      drawEnt(g, e, t, G) { if (e.k !== 'pupil') return false; worldDraw(g, e, t, G); return true; },
      drawHUD(g, G, vw, vh, t, text) { sniffHUD(g, G, vw, vh, t, text); },
    },
    furn: {
      draw(g, id, X, Y, w, t, prof) {
        if (id !== 'petbed') return false;
        Art.ell(g, X + w / 2, Y - 10, w / 2 - 2, 12); Art.fs(g, '#ff85b0', '#b8467a', 2.5);
        Art.ell(g, X + w / 2, Y - 12, w / 2 - 10, 7); Art.fs(g, '#ffd6e8');
        const pu = prof && pupil(prof);
        if (pu) { g.fillStyle = '#b8467a'; g.font = '800 11px "Baloo 2", sans-serif'; g.textAlign = 'center'; g.fillText(pu.name, X + w / 2, Y + 1); }
        return true;
      },
    },
    bag: {
      actions(p, id, acts) { if (id === 'treat' && pupil(p)) acts.push({ label: 'Daj ' + pupil(p).name, fn: (m, render) => { giveTreat(p); render(); } }); },
    },
  });

  LZ.Pets = { TYPES, draw, adopt, card, pupil, settle, fedToday };
})();
