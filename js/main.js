/*
 * main.js - boots the game: canvas sizing, the main loop, the animated
 * menu background, character previews in menus, and service worker
 * registration (which is what makes the game installable and offline).
 */
(function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let dpr = 1, cssW = 0, cssH = 0;

  function resize() {
    // Cap the pixel ratio at 2: sharper than that costs battery for no
    // visible gain on a phone screen.
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cssW = window.innerWidth; cssH = window.innerHeight;
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px';
    LZ.Game.resize(cssW, cssH);
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));

  /* Animated menu backdrop: a world scrolls by while the current hero walks. */
  let menuT = 0;
  function drawMenuScene(dt) {
    menuT += dt;
    const v = LZ.Game.view;
    ctx.setTransform(v.scale * dpr, 0, 0, v.scale * dpr, 0, 0);
    const world = LZ.D.WORLDS[Math.floor(menuT / 20) % LZ.D.WORLDS.length];
    const camX = menuT * 60;
    LZ.Art.drawBackground(ctx, world, camX, 0, v.w, v.h, menuT);
    const T = LZ.T, gy = v.h - T * 1.3;
    const ox = -(camX % T);
    for (let x = ox - T; x < v.w + T; x += T) {
      ctx.drawImage(LZ.Art.getTile(world, '#', 1), x, gy, T + 0.5, T + 0.5);
      ctx.drawImage(LZ.Art.getTile(world, '#', 0), x, gy + T, T + 0.5, T + 0.5);
    }
  }

  /* Draw every live preview canvas registered by the UI. */
  function drawPreviews(t) {
    for (const pv of LZ.UI.previews) {
      const c = pv.canvas;
      if (!c.isConnected) continue;
      const g = c.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, c.width, c.height);
      const s = c.width / 100;
      g.setTransform(s, 0, 0, s, 0, 0);
      if (pv.trailOnly) { drawTrailPreview(g, pv.trailOnly, t); continue; }
      const o = pv.opts;
      const walk = o.walk;
      if (walk && o.trail && o.trail !== 'none') drawTrailPreview(g, o.trail, t, true);
      // soft shadow
      g.fillStyle = 'rgba(40,20,70,0.15)'; g.beginPath(); g.ellipse(50, 90, 22, 5, 0, 0, Math.PI * 2); g.fill();
      LZ.Art.drawCharacter(g, 50, 89, { id: o.id, variant: o.variant, hat: o.hat, facing: 1, t: t + (o.id.length), state: walk ? 'run' : 'idle', phase: t * 9, scale: 1.45 });
    }
  }
  function drawTrailPreview(g, kind, t, behind) {
    if (kind === 'none') { g.fillStyle = '#b8a8d8'; g.font = '800 30px "Baloo 2", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('-', 50, 50); return; }
    for (let i = 0; i < 7; i++) {
      const ph = ((t * 0.8 + i / 7) % 1);
      LZ.Art.drawTrailParticle(g, { x: behind ? 30 - ph * 30 : 15 + ph * 70, y: behind ? 70 - ph * 20 : 60 + Math.sin(ph * 6 + i) * 14 - ph * 20, life: 1 - ph, max: 1, size: 7, kind, ci: i, rot: t + i, col: ['#9d7bff', '#ff6fae', '#5ccfff'][i % 3] });
    }
  }

  /* Fixed-step main loop. */
  let last = performance.now(), acc = 0;
  const STEP = 1 / 120;
  function frame(now) {
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.1) dt = 0.1;   // after a tab switch don't simulate a huge jump
    if (LZ.Game.active) {
      if (!LZ.UI.isPaused()) {
        acc += dt;
        while (acc >= STEP) { LZ.Game.update(STEP); acc -= STEP; }
      }
      LZ.Game.render(ctx, dpr);
    } else {
      drawMenuScene(dt);
    }
    drawPreviews(now / 1000);
    requestAnimationFrame(frame);
  }

  function boot() {
    LZ.S.load();
    // phones/tablets: show the on-screen buttons from the start
    if (matchMedia('(pointer: coarse)').matches) { document.body.classList.add('touch'); LZ.In.touch = true; }
    LZ.S.requestPersistence();
    resize();
    document.getElementById('btn-pause').addEventListener('click', () => { LZ.A.play('click'); LZ.UI.togglePause(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && LZ.Game.active && !LZ.UI.isPaused()) LZ.UI.togglePause(); });
    // Wait for the rounded font so canvas text doesn't flash in a fallback font.
    const fontsReady = document.fonts ? Promise.race([document.fonts.load('800 20px "Baloo 2"'), new Promise(r => setTimeout(r, 1500))]) : Promise.resolve();
    fontsReady.then(() => {
      document.getElementById('loading').remove();
      const p = LZ.S.active();
      if (p) LZ.UI.hub(); else LZ.UI.title();
      requestAnimationFrame(frame);
    });
    // first interaction unlocks audio
    ['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, () => LZ.A.unlock(), { once: true, passive: true }));
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW failed', e));
    }
  }
  boot();
})();
