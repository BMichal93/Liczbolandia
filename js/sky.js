/*
 * sky.js - day and night, and the weather, in the open world.
 *
 * A whole day lasts 8 minutes of play. At night the world gets dark except
 * for a warm light around her, the pet and every glowing thing (chests,
 * flags, windows, campfires), fireflies come out and some fish only bite
 * then. Each landscape has its own weather that changes every few minutes:
 * rain on the meadow (it waters the garden by itself), snow on the ice
 * peaks, sand wind in the desert, chocolate sprinkles near the volcano,
 * falling stars on the moon and soap bubbles in the toy factory.
 *
 * Save data: fun.time (0..1 time of day), fun.wclock (play seconds in the
 * world, which drives the weather).
 */
(function () {
  const U = LZ.U, S = LZ.S, Art = LZ.Art, Fun = LZ.Fun;
  const T = LZ.T;
  const DAY = 480;              // seconds in one day
  const SLOT = 150;             // the weather can change every 2.5 minutes

  // how dark it is, 0 (day) .. 1 (night)
  function darkness(time) {
    if (time < 0.55) return 0;
    if (time < 0.65) return (time - 0.55) / 0.1;
    if (time < 0.92) return 1;
    return 1 - (time - 0.92) / 0.08;
  }
  const isNight = p => darkness(Fun.state(p).time) > 0.6;

  const KINDS = {
    meadow: ['rain', 0.35], forest: ['rain', 0.4], beach: ['rain', 0.35], ice: ['snow', 0.55], desert: ['sand', 0.3],
    volcano: ['ash', 0.4], moon: ['stars', 0.4], factory: ['bubbles', 0.35],
  };
  const SAY = { rain: 'Pada deszcz!', snow: 'Pada śnieg!', sand: 'Wieje wiatr z piaskiem!', ash: 'Z wulkanu sypie się czekoladowa posypka!', stars: 'Spadające gwiazdy!', bubbles: 'Bańki mydlane!' };
  function hash(a, b) { let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
  // the weather in a landscape (band) at a moment of play time
  function weatherAt(W, band, clock, seed) {
    const bk = W.biomeKey(band), k = KINDS[bk];
    if (!k) return null;
    return hash(Math.floor(clock / SLOT) * 7 + band, seed) < k[1] ? k[0] : null;
  }
  function weatherNow(G) { return G && G.sky ? (G.sky.int > 0.3 ? G.sky.kind : null) : null; }

  /* ---------------- state per run ---------------- */
  function init(G) {
    G.sky = { kind: null, int: 0, drops: [], flies: [], rainbow: 0, lastDark: null, lastKind: null, dark: null };
  }
  function tick(G, dt, W) {
    const p = G.prof, f = Fun.state(p), sk = G.sky;
    if (G.lockClock) return;
    f.time = (f.time + dt / DAY) % 1;
    f.wclock = (f.wclock || 0) + dt;
    const wx = G.wl.wx || 0, wy = G.wl.wy || 0;
    const under = wy > W.surf(wx) + 4 || wy < W.SKY + 2;
    const want = under ? null : weatherAt(W, W.bandOf(wx), f.wclock, W.seed);
    // fade the weather in and out
    if (want && want === sk.kind) sk.int = Math.min(1, sk.int + dt / 4);
    else { sk.int = Math.max(0, sk.int - dt / 3); if (sk.int === 0) { if (sk.kind === 'rain' && !want) sk.rainbow = 30; sk.kind = want; } }
    if (sk.kind && sk.int > 0.5 && sk.kind !== sk.lastKind) { sk.lastKind = sk.kind; LZ.Game._toast(SAY[sk.kind] + (sk.kind === 'rain' && G.wl.band === 0 ? ' Ogródek sam się podlewa.' : ''), 2.4); }
    if (!sk.kind) sk.lastKind = null;
    if (sk.rainbow > 0) sk.rainbow -= dt;
    // rain at home waters the garden, wherever she is
    if (Math.floor(f.wclock) % 5 === 0 && weatherAt(W, 0, f.wclock, W.seed) === 'rain' && LZ.Farm) LZ.Farm.rainOnGarden(p);
    // night and morning
    const d = darkness(f.time) > 0.5;
    if (sk.lastDark !== null && d !== sk.lastDark) LZ.Game._toast(d ? 'Zapada noc... Świecące rybki już pływają!' : 'Dzień dobry! Wstało słońce.', 2.4);
    sk.lastDark = d;
  }

  /* ---------------- drawing ---------------- */
  const STARS = []; for (let i = 0; i < 70; i++) STARS.push([hash(i, 1), hash(i, 2) * 0.6, 0.6 + hash(i, 3) * 1.6, hash(i, 4) * 6]);
  // behind the landscape: a darker sky with stars and the moon, or a rainbow after the rain
  function drawBack(g, G, cam, vw, vh, t, W, depth) {
    const f = Fun.state(G.prof), n = darkness(f.time);
    if (depth > 8) return;
    const sk = G.sky;
    if (sk && sk.rainbow > 0 && n < 0.5) {
      const a = Math.min(1, sk.rainbow / 5) * 0.45 * (1 - n);
      g.save(); g.globalAlpha = a;
      ['#ff5e7e', '#ffa62b', '#ffe066', '#7be08a', '#5ccfff', '#9d7bff'].forEach((c, i) => { g.beginPath(); g.arc(vw * 0.62, vh * 0.95, vh * 0.75 - i * 14, Math.PI, 0); g.strokeStyle = c; g.lineWidth = 14; g.stroke(); });
      g.restore();
    }
    if (n <= 0) return;
    g.fillStyle = 'rgba(16,14,58,' + (0.7 * n) + ')'; g.fillRect(0, 0, vw, vh);
    for (const [x, y, r, ph] of STARS) { g.globalAlpha = n * (0.55 + 0.45 * Math.sin(t * 2 + ph)); Art.ell(g, x * vw, y * vh, r, r); g.fillStyle = '#fff6c9'; g.fill(); }
    g.globalAlpha = n;
    Art.ell(g, vw * 0.82, vh * 0.16, 30, 30); Art.fs(g, '#fff6c9'); Art.ell(g, vw * 0.82 + 12, vh * 0.16 - 6, 26, 26); g.fillStyle = 'rgba(16,14,58,0.85)'; g.fill();
    g.globalAlpha = 1;
  }

  /*
   * Over the whole world, under the HUD: the dark of the night with holes of
   * light, then the weather. The darkness is painted on a small canvas (half
   * the screen size) and stretched; that keeps it cheap on phones.
   */
  function drawSky(g, G, vw, vh, t, W) {
    const f = Fun.state(G.prof), sk = G.sky; if (!sk) return;
    const wx = G.wl.wx || 0, wy = G.wl.wy || 0, depth = wy - W.surf(wx);
    let a = 0.62 * darkness(f.time);
    if (depth > 10) a = Math.max(a * 0.5, 0.28);          // caves are always a little dim
    if (sk.kind === 'rain') a = Math.max(a, 0.14 * sk.int);
    const cam = G.cam;
    if (a > 0.01) {
      const sc = 0.5, cw = Math.ceil(vw * sc), ch = Math.ceil(vh * sc);
      let c = sk.dark; if (!c || c.width !== cw || c.height !== ch) { c = sk.dark = document.createElement('canvas'); c.width = cw; c.height = ch; }
      const d = c.getContext('2d');
      d.globalCompositeOperation = 'source-over'; d.clearRect(0, 0, cw, ch);
      d.fillStyle = 'rgba(8,8,34,' + a + ')'; d.fillRect(0, 0, cw, ch);
      d.globalCompositeOperation = 'destination-out';
      const light = (x, y, r, s) => {
        const sx = (x - cam.x) * sc, sy = (y - cam.y) * sc, rr = r * sc;
        if (sx < -rr || sx > cw + rr || sy < -rr || sy > ch + rr) return;
        const gr = d.createRadialGradient(sx, sy, rr * 0.15, sx, sy, rr);
        gr.addColorStop(0, 'rgba(0,0,0,' + (s || 1) + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        d.fillStyle = gr; d.fillRect(sx - rr, sy - rr, rr * 2, rr * 2);
      };
      const p = G.player;
      light(p.x + 14, p.y + 20, LZ.Gear && LZ.Gear.has(G.prof, 'lantern') ? 400 : 250);
      for (const e of G.ents) {
        if (e.x < cam.x - 300 || e.x > cam.x + vw + 300) continue;
        if (e.k === 'pupil') light(e.x, e.y - 20, 90, 0.7);
        else if (e.k === 'wchest' && !e.opened) light(e.x + 22, e.y - 20, 90, 0.8);
        else if (e.k === 'wflag' && e.on) light(e.x, e.y - 100, 110, 0.7);
        else if (e.k === 'house') light(e.x, e.y - 120, 260, 0.9);
        else if (e.k === 'camp') light(e.x, e.y - 30, 230, 0.95);
        else if (e.k === 'guard') light(e.x, e.y - 60, 140, 0.8);
        else if (e.k === 'station' || e.k === 'dock' || e.k === 'balloon') light(e.x, e.y - 60, 120, 0.7);
        else if (e.k === 'digspot') light(e.x, e.y - 10, 80, 0.7);
      }
      for (const fl of sk.flies) light(fl.x, fl.y, 40, 0.5);
      g.drawImage(c, 0, 0, vw, vh);
    }
    // fireflies on a summer night
    const n = darkness(f.time);
    if (n > 0.5 && depth < 4 && sk.kind !== 'rain' && sk.kind !== 'snow') {
      while (sk.flies.length < 14) sk.flies.push({ x: cam.x + Math.random() * vw, y: cam.y + vh * (0.3 + Math.random() * 0.6), ph: Math.random() * 6, vx: (Math.random() - 0.5) * 30 });
    } else if (sk.flies.length) sk.flies.length = 0;
    // touching a firefly puts it in a jar (for the lantern and the tailor), up to 12 a day
    const pl = G.player, f2 = Fun.state(G.prof);
    if (!f2.flyDay || f2.flyDay.d !== Fun.today()) f2.flyDay = { d: Fun.today(), n: 0 };
    for (let i = sk.flies.length - 1; i >= 0; i--) {
      const fl = sk.flies[i];
      if (f2.flyDay.n < 12 && Math.abs(fl.x - (pl.x + 14)) < 34 && Math.abs(fl.y - (pl.y + 20)) < 40) {
        sk.flies.splice(i, 1); f2.flyDay.n++; LZ.Bag.add(G.prof, 'firefly'); LZ.S.save();
        LZ.A.play('coin'); LZ.Game._floatText(fl.x, fl.y - 10, '+1 świetlik', '#fffbd0', 18);
      }
    }
    for (const fl of sk.flies) {
      fl.ph += 0.03; fl.x += fl.vx / 60; fl.y += Math.sin(fl.ph) * 0.6;
      if (fl.x < cam.x - 60 || fl.x > cam.x + vw + 60) { fl.x = cam.x + Math.random() * vw; }
      const sx = fl.x - cam.x, sy = fl.y - cam.y, glow = 0.5 + 0.5 * Math.sin(fl.ph * 3);
      const gr = g.createRadialGradient(sx, sy, 0, sx, sy, 10); gr.addColorStop(0, 'rgba(255,250,150,' + glow + ')'); gr.addColorStop(1, 'rgba(255,250,150,0)');
      g.fillStyle = gr; g.fillRect(sx - 10, sy - 10, 20, 20);
    }
    drawWeather(g, G, vw, vh, t);
  }
  function drawWeather(g, G, vw, vh, t) {
    const sk = G.sky; if (!sk.kind || sk.int <= 0) return;
    const drops = sk.drops, want = { rain: 90, snow: 60, sand: 40, ash: 45, stars: 3, bubbles: 14 }[sk.kind] * sk.int;
    while (drops.length < want) drops.push({ x: Math.random() * vw, y: Math.random() * vh, s: 0.6 + Math.random() * 0.8, ph: Math.random() * 6, k: sk.kind });
    if (drops.length > want + 2) drops.length = Math.floor(want);
    const cdx = (G.sky.lastCam ? G.cam.x - G.sky.lastCam.x : 0), cdy = (G.sky.lastCam ? G.cam.y - G.sky.lastCam.y : 0);
    G.sky.lastCam = { x: G.cam.x, y: G.cam.y };
    g.save();
    for (const d of drops) {
      // move with the weather and against the camera, so the drops stay put in the world
      d.x -= cdx * 0.6; d.y -= cdy * 0.6; d.ph += 0.05;
      if (d.k !== sk.kind) { d.k = sk.kind; d.y = -10; }
      switch (sk.kind) {
        case 'rain': d.x -= 3 * d.s; d.y += 16 * d.s; g.strokeStyle = 'rgba(180,215,255,0.7)'; g.lineWidth = 2; g.beginPath(); g.moveTo(d.x, d.y); g.lineTo(d.x + 4, d.y - 16 * d.s); g.stroke(); break;
        case 'snow': d.x += Math.sin(d.ph) * 0.8; d.y += 1.6 * d.s; Art.ell(g, d.x, d.y, 3 * d.s, 3 * d.s); g.fillStyle = 'rgba(255,255,255,0.9)'; g.fill(); break;
        case 'sand': d.x += 12 * d.s; d.y += Math.sin(d.ph) * 0.8; g.strokeStyle = 'rgba(230,190,110,0.55)'; g.lineWidth = 2.5 * d.s; g.beginPath(); g.moveTo(d.x, d.y); g.lineTo(d.x - 26 * d.s, d.y); g.stroke(); break;
        case 'ash': d.y += 1.8 * d.s; d.x += Math.sin(d.ph) * 0.6; g.fillStyle = ['#ff85c8', '#ffe066', '#7be08a', '#5ccfff', '#8b5a3c'][Math.floor(d.s * 10) % 5]; g.save(); g.translate(d.x, d.y); g.rotate(d.ph); g.fillRect(-4, -1.5, 8, 3); g.restore(); break;
        case 'stars': d.x -= 9 * d.s; d.y += 5 * d.s; g.strokeStyle = 'rgba(255,246,201,0.8)'; g.lineWidth = 2; g.beginPath(); g.moveTo(d.x, d.y); g.lineTo(d.x + 40, d.y - 22); g.stroke(); Art.starPath(g, d.x, d.y, 6, 2.5, 5, d.ph); Art.fs(g, '#fff6c9'); break;
        case 'bubbles': d.y -= 0.9 * d.s; d.x += Math.sin(d.ph) * 0.7; Art.ell(g, d.x, d.y, 9 * d.s, 9 * d.s); g.fillStyle = 'rgba(200,240,255,0.25)'; g.fill(); g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 1.5; g.stroke(); Art.ell(g, d.x - 3 * d.s, d.y - 3 * d.s, 2, 2); g.fillStyle = '#fff'; g.fill(); break;
      }
      if (d.y > vh + 20) { d.y = -20; d.x = Math.random() * (vw + 100); }
      if (d.y < -30) { d.y = vh + 20; d.x = Math.random() * vw; }
      if (d.x < -40) d.x += vw + 80; if (d.x > vw + 40) d.x -= vw + 80;
    }
    g.restore();
  }
  // a little sun or moon next to the distance at the top
  function drawHUD(g, G, vw, vh, t) {
    const f = Fun.state(G.prof), n = darkness(f.time), x = vw / 2 - 128, y = 36;
    if (n > 0.5) { Art.ell(g, x, y, 12, 12); Art.fs(g, '#fff6c9', '#c9b060', 2); Art.ell(g, x + 6, y - 4, 10, 10); g.fillStyle = 'rgba(58,36,110,0.9)'; g.fill(); }
    else { for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + t * 0.3; g.strokeStyle = '#ffb020'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14); g.lineTo(x + Math.cos(a) * 19, y + Math.sin(a) * 19); g.stroke(); } Art.ell(g, x, y, 11, 11); Art.fs(g, '#ffe066', '#e0a000', 2); }
  }

  LZ.Ext.add({ world: { init, tick, drawBack, drawSky, drawHUD } });
  LZ.Sky = { darkness, isNight, weatherAt, weatherNow, DAY };
})();
