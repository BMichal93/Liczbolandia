/*
 * art.js - every picture in the game is drawn here with canvas paths.
 *
 * No image files are used. Vector drawing gives the "bright cartoon" look
 * the kids picked, stays crisp on any phone resolution, and lets one
 * drawing function produce every colour variant of a character.
 *
 * Conventions:
 *   - world units: one tile = 48 units (LZ.T)
 *   - character/enemy draw functions take the BOTTOM-CENTRE point (feet),
 *     which is what the physics code tracks for landing anyway.
 */
(function () {
  const U = LZ.U;
  const T = 48;
  LZ.T = T;
  const TAU = Math.PI * 2;

  function ell(ctx, x, y, rx, ry, rot) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot || 0, 0, TAU); }
  function fs(ctx, fill, stroke, lw) {
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2.2; ctx.stroke(); }
  }
  function tri(ctx, ax, ay, bx, by, cx, cy) { ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.closePath(); }
  function starPath(ctx, x, y, r1, r2, n, rot) {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const r = i % 2 ? r2 : r1, a = rot + (i * Math.PI) / n - Math.PI / 2;
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath();
  }
  function heartPath(ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.35);
    ctx.bezierCurveTo(x - s * 1.1, y - s * 0.35, x - s * 0.45, y - s * 1.05, x, y - s * 0.45);
    ctx.bezierCurveTo(x + s * 0.45, y - s * 1.05, x + s * 1.1, y - s * 0.35, x, y + s * 0.35);
    ctx.closePath();
  }
  const RAINBOW = ['#ff5e7e', '#ffa62b', '#ffe066', '#7be08a', '#5ccfff', '#9d7bff'];

  /* =====================================================================
   * CHARACTERS
   * o = { id, variant, hat, facing, t, state, run (0..1 run intensity),
   *       phase (run cycle), squash, scale, glide, blink }
   * ===================================================================== */
  function drawCharacter(ctx, x, y, o) {
    const ch = LZ.D.CHARACTERS.find(c => c.id === o.id) || LZ.D.CHARACTERS[0];
    let pal = (ch.variants[o.variant || 0] || ch.variants[0]).pal;
    // star-shop "Złota postać": any character in shiny gold (keeps its own eye colour)
    if (o.gold) pal = { body: '#ffd84a', belly: '#fff3b0', accent: '#e0a000', patch2: '#ffe680', eye: pal.eye };
    const out = U.shade(pal.id === 'panda' ? '#555' : pal.body, -0.5);
    const st = o.state || 'idle';
    const t = o.t || 0;
    const ph = o.phase || 0;
    const sc = o.scale || 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale((o.facing || 1) * sc, sc);
    // Squash & stretch: landing squashes, jumping stretches. Cheap and
    // makes movement feel alive.
    const sq = o.squash || 0;
    ctx.scale(1 + sq * 0.25, 1 - sq * 0.25);

    const bob = st === 'run' ? Math.abs(Math.sin(ph)) * 2.5 : st === 'idle' ? Math.sin(t * 3) * 0.8 : 0;
    const air = st === 'jump' || st === 'fall' || st === 'swim';
    const oc = U.shade(pal.body, ch.id === 'panda' ? -0.75 : -0.48);
    const lw = 2.2;

    // ---- tail / wings behind body ----
    drawBack(ctx, ch.id, pal, oc, t, st, o.glide, bob);

    // ---- feet ----
    const fsw = st === 'run' ? Math.sin(ph) * 6 : air ? 3 : 0;
    const flift = st === 'run' ? Math.max(0, Math.cos(ph)) * 3 : 0;
    const flift2 = st === 'run' ? Math.max(0, -Math.cos(ph)) * 3 : 0;
    const footCol = (ch.id === 'panda') ? pal.accent : (ch.id === 'penguin' ? pal.accent : U.shade(pal.body, -0.08));
    ell(ctx, -6 - fsw, -3.5 - flift2 - (air ? 2 : 0), 6.5, 4.2); fs(ctx, footCol, oc, lw);
    ell(ctx, 7 + fsw, -3.5 - flift - (air ? 3 : 0), 6.5, 4.2); fs(ctx, footCol, oc, lw);

    ctx.translate(0, -bob);
    // ---- back arm ----
    const armCol = ch.id === 'panda' ? pal.accent : pal.body;
    const asw = st === 'run' ? -Math.sin(ph) * 0.7 : air ? -1.2 : 0.2;
    ell(ctx, -10, -17, 4.5, 7, asw); fs(ctx, U.shade(armCol, -0.1), oc, lw);

    // ---- body ----
    const bw = ch.id === 'hamster' ? 15 : ch.id === 'guinea' ? 16.5 : 13;
    ell(ctx, 0, -15, bw, 12.5); fs(ctx, ch.id === 'penguin' ? pal.body : pal.body, oc, lw);
    if (ch.id === 'guinea') { ctx.save(); ell(ctx, 0, -15, bw, 12.5); ctx.clip(); ell(ctx, -11, -18, 10, 9); fs(ctx, pal.accent); ell(ctx, -2, -4, 7, 5); fs(ctx, pal.patch2); ctx.restore(); ell(ctx, 0, -15, bw, 12.5); fs(ctx, null, oc, lw); }
    ell(ctx, 2.5, -13.5, bw - 5.5, 8.5); fs(ctx, pal.belly);

    // ---- head ----
    const hx = 2, hy = -34;
    drawEars(ctx, ch.id, pal, oc, hx, hy, t, lw);
    if (ch.id === 'frog') { ell(ctx, hx, hy + 2, 19, 14); fs(ctx, pal.body, oc, lw); }
    else if (ch.id === 'hamster') { ell(ctx, hx, hy + 1, 17.5, 16); fs(ctx, pal.body, oc, lw); }
    else if (ch.id === 'guinea') {
      // guinea pig: wide loaf-shaped head with a coloured patch (tri-colour look)
      ell(ctx, hx + 1, hy + 3, 19, 15); fs(ctx, pal.body, oc, lw);
      ctx.save(); ell(ctx, hx + 1, hy + 3, 19, 15); ctx.clip();
      ell(ctx, hx - 9, hy - 2, 11, 12, 0.3); fs(ctx, pal.accent);
      ell(ctx, hx + 14, hy - 9, 8, 7); fs(ctx, pal.patch2);
      ctx.restore();
      ell(ctx, hx + 1, hy + 3, 19, 15); fs(ctx, null, oc, lw);
    }
    else { ell(ctx, hx, hy, 16.5, 16); fs(ctx, pal.body, oc, lw); }
    drawFace(ctx, ch.id, pal, oc, hx, hy, t, st, o.blink);

    // ---- front arm ----
    ell(ctx, 11, -17, 4.5, 7, -asw); fs(ctx, armCol, oc, lw);

    // ---- hat ----
    if (o.hat && o.hat !== 'none') drawHat(ctx, o.hat, hx, hy, ch.id, t);
    ctx.restore();
  }

  function drawBack(ctx, id, pal, oc, t, st, glide, bob) {
    const wag = Math.sin(t * 6) * 0.15;
    ctx.save();
    ctx.translate(0, -bob);
    if (id === 'cat') {
      ctx.beginPath(); ctx.moveTo(-10, -12);
      ctx.bezierCurveTo(-26, -10, -22, -30 + wag * 20, -16, -34 + wag * 10);
      ctx.lineCap = 'round'; ctx.strokeStyle = oc; ctx.lineWidth = 8.5; ctx.stroke();
      ctx.strokeStyle = pal.body; ctx.lineWidth = 4.5; ctx.stroke();
    } else if (id === 'fox') {
      ctx.save(); ctx.translate(-14, -14); ctx.rotate(-0.7 + wag);
      ell(ctx, -8, -3, 13, 7.5); fs(ctx, pal.body, oc, 2.2);
      ell(ctx, -17, -3.5, 5, 4.6); fs(ctx, pal.belly);
      ctx.restore();
    } else if (id === 'unicorn') {
      for (let i = 0; i < 4; i++) {
        ctx.beginPath(); ctx.moveTo(-10, -13);
        ctx.quadraticCurveTo(-22, -12 + i * 3, -24 - i, 0 + i * 2 + wag * 10);
        ctx.lineCap = 'round'; ctx.strokeStyle = RAINBOW[i + 1]; ctx.lineWidth = 4; ctx.stroke();
      }
    } else if (id === 'dragon') {
      // Wings flap quickly while gliding, slowly otherwise.
      const flap = Math.sin(t * (glide ? 22 : 4)) * (glide ? 0.5 : 0.15);
      ctx.save(); ctx.translate(-5, -22); ctx.rotate(-0.4 - flap);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-20, -16); ctx.lineTo(-16, -6); ctx.lineTo(-24, -4); ctx.lineTo(-14, 2); ctx.lineTo(-18, 8); ctx.closePath();
      fs(ctx, pal.accent, oc, 2); ctx.restore();
      ctx.beginPath(); ctx.moveTo(-10, -9); ctx.quadraticCurveTo(-24, -4, -26, -14 + wag * 12);
      ctx.lineCap = 'round'; ctx.strokeStyle = oc; ctx.lineWidth = 8; ctx.stroke(); ctx.strokeStyle = pal.body; ctx.lineWidth = 4.5; ctx.stroke();
      tri(ctx, -30, -14 + wag * 12, -24, -20 + wag * 12, -22, -11 + wag * 12); fs(ctx, pal.accent, oc, 1.5);
    } else if (id === 'penguin' && glide) {
      // little flapping flippers for the glide
      const f = Math.sin(t * 25) * 0.5;
      ctx.save(); ctx.translate(-8, -20); ctx.rotate(-1.2 + f); ell(ctx, -6, 0, 9, 3.5); fs(ctx, pal.body, oc, 2); ctx.restore();
    } else if (id === 'hamster') {
      ell(ctx, -14, -9, 3.5, 3); fs(ctx, pal.body, oc, 1.8);
    }
    ctx.restore();
  }

  function drawEars(ctx, id, pal, oc, hx, hy, t, lw) {
    if (id === 'cat') {
      tri(ctx, hx - 13, hy - 7, hx - 10, hy - 24, hx - 1, hy - 13); fs(ctx, pal.body, oc, lw);
      tri(ctx, hx - 10.5, hy - 10, hx - 9, hy - 19, hx - 4.5, hy - 13); fs(ctx, pal.accent);
      tri(ctx, hx + 3, hy - 14, hx + 13, hy - 24, hx + 15, hy - 6); fs(ctx, pal.body, oc, lw);
      tri(ctx, hx + 6, hy - 14, hx + 12, hy - 20, hx + 12.5, hy - 10); fs(ctx, pal.accent);
    } else if (id === 'fox') {
      tri(ctx, hx - 14, hy - 5, hx - 11, hy - 28, hx - 1, hy - 13); fs(ctx, pal.body, oc, lw);
      tri(ctx, hx - 11, hy - 10, hx - 10, hy - 22, hx - 5, hy - 13); fs(ctx, U.shade(pal.body, -0.45));
      tri(ctx, hx + 3, hy - 14, hx + 14, hy - 28, hx + 16, hy - 5); fs(ctx, pal.body, oc, lw);
      tri(ctx, hx + 6, hy - 14, hx + 13, hy - 23, hx + 13, hy - 9); fs(ctx, U.shade(pal.body, -0.45));
    } else if (id === 'hamster') {
      ell(ctx, hx - 11, hy - 13, 6, 6); fs(ctx, pal.body, oc, lw); ell(ctx, hx - 11, hy - 13, 3.2, 3.2); fs(ctx, '#ffb3c7');
      ell(ctx, hx + 12, hy - 13, 6, 6); fs(ctx, pal.body, oc, lw); ell(ctx, hx + 12, hy - 13, 3.2, 3.2); fs(ctx, '#ffb3c7');
    } else if (id === 'guinea') {
      ell(ctx, hx - 15, hy - 5, 5.5, 7.5, -0.9); fs(ctx, '#f6b3a8', oc, lw);
      ell(ctx, hx + 17, hy - 5, 5.5, 7.5, 0.9); fs(ctx, '#f6b3a8', oc, lw);
    } else if (id === 'panda') {
      ell(ctx, hx - 12, hy - 12, 6.5, 6.5); fs(ctx, pal.accent, U.shade(pal.accent, -0.3), lw);
      ell(ctx, hx + 13, hy - 12, 6.5, 6.5); fs(ctx, pal.accent, U.shade(pal.accent, -0.3), lw);
    } else if (id === 'frog') {
      ell(ctx, hx - 6, hy - 10, 8, 8); fs(ctx, pal.body, oc, lw);
      ell(ctx, hx + 10, hy - 10, 8, 8); fs(ctx, pal.body, oc, lw);
    } else if (id === 'unicorn') {
      // mane first (behind), then ears and the golden horn
      for (let i = 0; i < 6; i++) { ell(ctx, hx - 13 + i * 1.2, hy - 12 + i * 5, 6, 5.5); fs(ctx, RAINBOW[i]); }
      tri(ctx, hx - 10, hy - 10, hx - 6, hy - 22, hx - 1, hy - 13); fs(ctx, pal.body, oc, lw);
      tri(ctx, hx + 5, hy - 14, hx + 13, hy - 22, hx + 14, hy - 8); fs(ctx, pal.body, oc, lw);
      tri(ctx, hx + 1, hy - 14, hx + 7, hy - 16, hx + 7, hy - 33); fs(ctx, '#ffd84a', '#c99a12', 2);
      ctx.strokeStyle = '#e8b820'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(hx + 2.5, hy - 17); ctx.lineTo(hx + 7, hy - 19); ctx.moveTo(hx + 4, hy - 22); ctx.lineTo(hx + 7, hy - 23.5); ctx.moveTo(hx + 5.5, hy - 27); ctx.lineTo(hx + 7, hy - 28); ctx.stroke();
    } else if (id === 'dragon') {
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(hx - 6, hy - 14); ctx.quadraticCurveTo(hx - 10, hy - 24, hx - 16, hy - 24);
      ctx.moveTo(hx + 8, hy - 14); ctx.quadraticCurveTo(hx + 8, hy - 25, hx + 2, hy - 28);
      ctx.strokeStyle = U.shade(pal.accent, -0.35); ctx.lineWidth = 6; ctx.stroke(); ctx.strokeStyle = pal.accent; ctx.lineWidth = 3.5; ctx.stroke();
      // back spikes
      for (let i = 0; i < 3; i++) { tri(ctx, hx - 15 + i * 2, hy - 4 + i * 8, hx - 22 + i * 1.5, hy + i * 8, hx - 15 + i * 1.5, hy + 4 + i * 8); fs(ctx, pal.accent, oc, 1.5); }
    }
  }

  function drawFace(ctx, id, pal, oc, hx, hy, t, st, blinkT) {
    // Blink for 0.12s roughly every 3.7s.
    const blink = ((t + (blinkT || 0)) % 3.7) < 0.12;
    const surprised = st === 'jump' || st === 'hurt';
    let ex1 = hx - 3, ex2 = hx + 9, ey = hy - 1;
    if (id === 'frog') { ex1 = hx - 6; ex2 = hx + 10; ey = hy - 11; }

    if (id === 'panda') {
      ell(ctx, ex1, ey + 1, 5.5, 6.5, 0.4); fs(ctx, pal.accent);
      ell(ctx, ex2, ey + 1, 5.5, 6.5, -0.4); fs(ctx, pal.accent);
    }
    if (id === 'penguin') {
      // white face mask
      ell(ctx, hx - 2, hy + 3, 9.5, 10); fs(ctx, pal.belly);
      ell(ctx, hx + 9, hy + 3, 9.5, 10); fs(ctx, pal.belly);
    }
    if (id === 'fox') { ell(ctx, hx + 6, hy + 7, 10, 7); fs(ctx, pal.belly); }
    if (id === 'hamster') { ell(ctx, hx - 8, hy + 7, 7, 6); fs(ctx, pal.belly); ell(ctx, hx + 13, hy + 7, 7, 6); fs(ctx, pal.belly); }

    const eyeCol = id === 'panda' ? '#ffffff' : pal.eye;
    if (id === 'frog') { ell(ctx, ex1, ey, 5.5, 5.5); fs(ctx, '#fff'); ell(ctx, ex2, ey, 5.5, 5.5); fs(ctx, '#fff'); }
    if (blink) {
      ctx.strokeStyle = id === 'panda' ? '#fff' : pal.eye; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ex1 - 3, ey); ctx.lineTo(ex1 + 3, ey); ctx.moveTo(ex2 - 3, ey); ctx.lineTo(ex2 + 3, ey); ctx.stroke();
    } else {
      const er = id === 'frog' ? 3 : 3.3, eh = id === 'frog' ? 3.4 : 4.4;
      ell(ctx, ex1, ey, er, eh); fs(ctx, id === 'panda' ? '#1a1a22' : eyeCol);
      ell(ctx, ex2, ey, er, eh); fs(ctx, id === 'panda' ? '#1a1a22' : eyeCol);
      ell(ctx, ex1 + 1, ey - 1.6, 1.3, 1.3); fs(ctx, '#fff');
      ell(ctx, ex2 + 1, ey - 1.6, 1.3, 1.3); fs(ctx, '#fff');
      ell(ctx, ex1 - 1, ey + 1.8, 0.7, 0.7); fs(ctx, '#fff');
      ell(ctx, ex2 - 1, ey + 1.8, 0.7, 0.7); fs(ctx, '#fff');
    }
    // cheeks
    ell(ctx, hx - 8, hy + 6, 3.5, 2.2); fs(ctx, 'rgba(255,110,150,0.45)');
    ell(ctx, hx + 14, hy + 6, 3.5, 2.2); fs(ctx, 'rgba(255,110,150,0.45)');

    // nose / beak / mouth
    if (id === 'penguin') { tri(ctx, hx + 3, hy + 3, hx + 11, hy + 3, hx + 7, hy + 9); fs(ctx, pal.accent, U.shade(pal.accent, -0.3), 1.5); return; }
    if (id === 'fox' || id === 'cat' || id === 'hamster' || id === 'panda' || id === 'guinea') { ell(ctx, hx + 4, hy + 4, 2, 1.5); fs(ctx, id === 'fox' ? '#2b1a12' : '#ff6f91'); }
    if (id === 'dragon') { ell(ctx, hx + 8, hy + 3, 1, 1); fs(ctx, oc); ell(ctx, hx + 4, hy + 3, 1, 1); fs(ctx, oc); }
    ctx.strokeStyle = U.shade(pal.eye, 0.1); ctx.lineWidth = 1.8; ctx.lineCap = 'round';
    if (surprised) { ell(ctx, hx + 4, hy + 9.5, 2.3, 2.8); fs(ctx, '#7a2a3a'); }
    else if (id === 'frog') { ctx.beginPath(); ctx.arc(hx + 2, hy + 3, 9, 0.25, Math.PI - 0.25); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(hx + 2, hy + 6, 2.6, 0.2, Math.PI - 0.2); ctx.arc(hx + 6.4, hy + 6, 2.6, 0.2, Math.PI - 0.2); ctx.stroke(); }
    if (id === 'cat') {
      ctx.strokeStyle = 'rgba(80,40,60,0.55)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(hx + 14, hy + 3); ctx.lineTo(hx + 21, hy + 1); ctx.moveTo(hx + 14, hy + 6); ctx.lineTo(hx + 21, hy + 7); ctx.moveTo(hx - 9, hy + 3); ctx.lineTo(hx - 16, hy + 1); ctx.stroke();
    }
  }

  /* Hats sit relative to the head centre (hx, hy). */
  function drawHat(ctx, hat, hx, hy, charId, t) {
    const top = charId === 'frog' ? hy - 18 : hy - 15;
    ctx.save();
    switch (hat) {
      case 'bow': {
        ctx.translate(hx - 7, top + 1); ctx.rotate(-0.3);
        tri(ctx, 0, 0, -10, -7, -10, 7); fs(ctx, '#ff4f8b', '#b8235a', 1.8);
        tri(ctx, 0, 0, 10, -7, 10, 7); fs(ctx, '#ff4f8b', '#b8235a', 1.8);
        ell(ctx, 0, 0, 3.5, 3.5); fs(ctx, '#ff85b0', '#b8235a', 1.8);
        break;
      }
      case 'flowers': {
        const cols = ['#ff85b0', '#ffe066', '#9d7bff', '#ff85b0', '#5ccfff', '#ffe066'];
        for (let i = 0; i < 6; i++) {
          const a = Math.PI + 0.35 + i * 0.45, fx = hx + Math.cos(a) * 15, fy = hy + Math.sin(a) * 14;
          for (let k = 0; k < 5; k++) { ell(ctx, fx + Math.cos(k * 1.26) * 2.8, fy + Math.sin(k * 1.26) * 2.8, 2.3, 2.3); fs(ctx, cols[i]); }
          ell(ctx, fx, fy, 1.6, 1.6); fs(ctx, '#fff6c9');
        }
        break;
      }
      case 'beanie': {
        ctx.beginPath(); ctx.ellipse(hx, hy - 4, 17, 14, 0, Math.PI, 0); ctx.closePath(); fs(ctx, '#5ccfff', '#2a7fb0', 2);
        U.rr(ctx, hx - 17.5, hy - 7, 35, 6, 3); fs(ctx, '#ffffff', '#2a7fb0', 2);
        ell(ctx, hx, hy - 20, 5, 5); fs(ctx, '#ffffff', '#2a7fb0', 2);
        break;
      }
      case 'glasses': {
        U.rr(ctx, hx - 9, hy - 5, 11, 8, 3); fs(ctx, '#27213a', '#111', 1.5);
        U.rr(ctx, hx + 4, hy - 5, 11, 8, 3); fs(ctx, '#27213a', '#111', 1.5);
        ctx.strokeStyle = '#111'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(hx + 2, hy - 2); ctx.lineTo(hx + 4, hy - 2); ctx.moveTo(hx - 9, hy - 2); ctx.lineTo(hx - 15, hy - 4); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(hx - 7, hy - 4, 3, 2); ctx.fillRect(hx + 6, hy - 4, 3, 2);
        break;
      }
      case 'headphones': {
        ctx.beginPath(); ctx.arc(hx, hy - 2, 17, Math.PI * 1.05, Math.PI * 1.95); ctx.lineWidth = 4; ctx.strokeStyle = '#9d7bff'; ctx.stroke();
        U.rr(ctx, hx - 20, hy - 6, 7, 12, 3); fs(ctx, '#ff6fae', '#8a3a66', 1.8);
        U.rr(ctx, hx + 13, hy - 6, 7, 12, 3); fs(ctx, '#ff6fae', '#8a3a66', 1.8);
        break;
      }
      case 'party': {
        ctx.translate(hx + 2, top + 2); ctx.rotate(0.2);
        tri(ctx, -9, 0, 9, 0, 0, -22); fs(ctx, '#ffe066', '#c99a12', 1.8);
        ctx.save(); ctx.clip();
        ctx.fillStyle = '#ff5e7e'; for (let i = 0; i < 3; i++) ctx.fillRect(-12, -5 - i * 7, 24, 3);
        ctx.restore();
        ell(ctx, 0, -23, 3.5, 3.5); fs(ctx, '#5ccfff');
        break;
      }
      case 'wizard': {
        ell(ctx, hx, top + 2, 20, 5); fs(ctx, '#6a4fcf', '#3b2a80', 1.8);
        ctx.beginPath(); ctx.moveTo(hx - 12, top + 1); ctx.quadraticCurveTo(hx - 2, top - 20, hx + 14, top - 30); ctx.quadraticCurveTo(hx + 6, top - 12, hx + 12, top + 1); ctx.closePath(); fs(ctx, '#7a5ce6', '#3b2a80', 1.8);
        starPath(ctx, hx + 1, top - 8, 4, 1.8, 5, t); fs(ctx, '#ffe066');
        break;
      }
      case 'tophat': {
        ell(ctx, hx + 1, top + 2, 16, 4); fs(ctx, '#2d2a3a', '#111', 1.5);
        U.rr(ctx, hx - 9, top - 18, 20, 20, 2); fs(ctx, '#2d2a3a', '#111', 1.5);
        ctx.fillStyle = '#ff5e7e'; ctx.fillRect(hx - 9, top - 4, 20, 4);
        break;
      }
      case 'crown': {
        ctx.beginPath(); ctx.moveTo(hx - 11, top + 2); ctx.lineTo(hx - 12, top - 11); ctx.lineTo(hx - 5, top - 4); ctx.lineTo(hx + 1, top - 14); ctx.lineTo(hx + 7, top - 4); ctx.lineTo(hx + 14, top - 11); ctx.lineTo(hx + 13, top + 2); ctx.closePath();
        fs(ctx, '#ffd84a', '#c99a12', 1.8);
        ell(ctx, hx + 1, top - 3, 2.2, 2.2); fs(ctx, '#ff5e7e'); ell(ctx, hx - 7, top - 1, 1.6, 1.6); fs(ctx, '#5ccfff'); ell(ctx, hx + 9, top - 1, 1.6, 1.6); fs(ctx, '#7be08a');
        break;
      }
      case 'tiara': {
        ctx.beginPath(); ctx.arc(hx + 1, top + 10, 14, Math.PI * 1.15, Math.PI * 1.85); ctx.lineWidth = 3; ctx.strokeStyle = '#d9e2f0'; ctx.stroke();
        for (let i = -1; i <= 1; i++) { starPath(ctx, hx + 1 + i * 7, top - (i === 0 ? 6 : 2), i === 0 ? 4.5 : 3, 1.6, 4, 0); fs(ctx, i === 0 ? '#ff85b0' : '#bfefff', '#8a9ab0', 1); }
        break;
      }
      case 'pirate': {
        ctx.beginPath(); ctx.moveTo(hx - 18, top + 2); ctx.quadraticCurveTo(hx + 1, top - 22, hx + 20, top + 2); ctx.quadraticCurveTo(hx + 1, top - 4, hx - 18, top + 2); fs(ctx, '#2d2a3a', '#111', 1.5);
        ell(ctx, hx + 1, top - 7, 3.2, 3); fs(ctx, '#fff');
        break;
      }
    }
    ctx.restore();
  }

  /* =====================================================================
   * PETS (star shop) - small companions drawn around their centre
   * ===================================================================== */
  function drawPet(ctx, id, x, y, t, facing) {
    ctx.save(); ctx.translate(x, y); ctx.scale(facing || 1, 1);
    switch (id) {
      case 'pet_butterfly': {
        const f = Math.abs(Math.sin(t * 14));
        // upper and lower wings on both sides, flapping by squashing their width
        const ww = 0.35 + 0.65 * f;
        ell(ctx, -6, -5, 9 * ww, 7, -0.5); fs(ctx, '#ff85c8', '#b8467a', 1.5);
        ell(ctx, 6, -5, 9 * ww, 7, 0.5); fs(ctx, '#ff85c8', '#b8467a', 1.5);
        ell(ctx, -5, 4, 6 * ww, 5, 0.4); fs(ctx, '#c9b8ff', '#6a4fcf', 1.5);
        ell(ctx, 5, 4, 6 * ww, 5, -0.4); fs(ctx, '#c9b8ff', '#6a4fcf', 1.5);
        ell(ctx, 0, 0, 2.5, 9); fs(ctx, '#3b2a6b');
        ctx.strokeStyle = '#3b2a6b'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, -8); ctx.quadraticCurveTo(3, -14, 6, -15); ctx.moveTo(0, -8); ctx.quadraticCurveTo(-3, -14, -6, -15); ctx.stroke();
        break;
      }
      case 'pet_fish': {
        ell(ctx, 0, 0, 17, 17); ctx.fillStyle = 'rgba(180,230,255,0.35)'; ctx.fill(); ctx.strokeStyle = 'rgba(120,200,255,0.9)'; ctx.lineWidth = 2; ctx.stroke();
        const w = Math.sin(t * 8) * 0.3;
        ctx.save(); ctx.translate(-8, 1); ctx.rotate(w); tri(ctx, 0, 0, -7, -6, -7, 6); fs(ctx, '#ff8a3d'); ctx.restore();
        ell(ctx, 1, 1, 9, 6.5); fs(ctx, '#ffa94d', '#c4621c', 1.5);
        ell(ctx, 5, -1, 2, 2); fs(ctx, '#222');
        ell(ctx, -6, -8, 3, 2, -0.6); fs(ctx, 'rgba(255,255,255,0.8)');
        break;
      }
      case 'pet_firefly': {
        const glow = 0.55 + 0.45 * Math.sin(t * 5);
        const g = ctx.createRadialGradient(0, 4, 1, 0, 4, 26); g.addColorStop(0, 'rgba(255,250,150,' + glow + ')'); g.addColorStop(1, 'rgba(255,250,150,0)');
        ctx.fillStyle = g; ctx.fillRect(-26, -22, 52, 52);
        const f = Math.sin(t * 30) * 0.5;
        ell(ctx, -4, -6, 6, 3.5, -0.8 + f); fs(ctx, 'rgba(230,245,255,0.85)'); ell(ctx, 4, -6, 6, 3.5, 0.8 - f); fs(ctx, 'rgba(230,245,255,0.85)');
        ell(ctx, 0, -2, 5, 5); fs(ctx, '#6b4e8f'); ell(ctx, 0, 5, 5.5, 6); fs(ctx, 'rgb(255,' + Math.round(220 + 30 * glow) + ',90)');
        ell(ctx, 2, -3, 1.3, 1.3); fs(ctx, '#fff');
        break;
      }
      case 'pet_dragon': {
        const f = Math.sin(t * 10) * 0.4;
        ctx.save(); ctx.translate(-3, -6); ctx.rotate(-0.5 - f); tri(ctx, 0, 0, -14, -10, -10, 3); fs(ctx, '#9f7aea', '#5a3fbf', 1.5); ctx.restore();
        ell(ctx, 0, 2, 10, 8); fs(ctx, '#4fd1c5', '#2a8a80', 1.8);
        ell(ctx, 7, -5, 7.5, 6.5); fs(ctx, '#4fd1c5', '#2a8a80', 1.8);
        tri(ctx, 4, -10, 6, -16, 8, -10); fs(ctx, '#ffd84a'); tri(ctx, 8, -10, 11, -15, 11, -9); fs(ctx, '#ffd84a');
        ell(ctx, 10, -6, 1.6, 2); fs(ctx, '#222'); ell(ctx, 10.5, -6.8, 0.6, 0.6); fs(ctx, '#fff');
        ell(ctx, 1, 4, 5, 4); fs(ctx, '#fff6c9');
        ctx.beginPath(); ctx.moveTo(-9, 4); ctx.quadraticCurveTo(-17, 6, -18, 0); ctx.strokeStyle = '#4fd1c5'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.stroke();
        if (Math.sin(t * 2) > 0.95) { ell(ctx, 18, -4, 3, 2); fs(ctx, 'rgba(255,160,60,0.8)'); }
        break;
      }
    }
    ctx.restore();
  }

  /* Sticker art for the album: reuses the game's own creatures and items. */
  function drawSticker(ctx, id, size, t) {
    const S = LZ.D.STICKERS.find(s => s.id === id); if (!S) return;
    ctx.save();
    const world = LZ.D.WORLDS[0];
    if (S.kind === 'enemy') {
      const sz = { slime: [36, 26], bee: [32, 30], hedgehog: [36, 26], snowball: [34, 34], fish: [36, 26], jelly: [30, 34], urchin: [30, 30], shroom: [36, 34], bat: [34, 28], cloudy: [40, 30], firejelly: [30, 34] }[id];
      const k = size / 60; ctx.scale(k, k);
      drawEnemy(ctx, { type: id, x: -sz[0] / 2, y: 18 - sz[1], w: sz[0], h: sz[1], dir: 1, seed: 1, roll: 0, col: '#8fe36b' }, t, world);
    } else if (S.kind === 'boss') {
      const k = size / 200; ctx.scale(k, k); ctx.translate(0, -8);   // bosses are tall: a bit smaller so nothing is cut off
      drawBoss(ctx, { kind: id, x: -55, y: 70 - 150, w: 110, h: 150, dir: 1, flash: 0, phase: 'intro', look: 0 }, t);
    } else if (S.kind === 'power') {
      const k = size / 40; ctx.scale(k, k); drawPowerup(ctx, id, 0, 0, t);
    } else if (id === 'coin') { const k = size / 34; ctx.scale(k, k); drawCoin(ctx, 0, 0, 0.2, 13); }
    else { const k = size / 44; ctx.scale(k, k); drawStar(ctx, 0, 0, 18, t); }
    ctx.restore();
  }

  /* =====================================================================
   * TRAIL PARTICLE shapes (spawned by the game, drawn here)
   * ===================================================================== */
  function drawTrailParticle(ctx, p) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    const s = p.size * (0.5 + 0.5 * p.life / p.max);
    switch (p.kind) {
      case 'stars': starPath(ctx, p.x, p.y, s, s * 0.45, 5, p.rot); fs(ctx, '#ffe066', '#e0ae12', 1); break;
      case 'hearts': heartPath(ctx, p.x, p.y, s); fs(ctx, '#ff6fae'); break;
      case 'bubbles': ell(ctx, p.x, p.y, s, s); ctx.strokeStyle = '#8fdcff'; ctx.lineWidth = 1.6; ctx.stroke(); ell(ctx, p.x - s * 0.35, p.y - s * 0.35, s * 0.25, s * 0.25); fs(ctx, '#fff'); break;
      case 'notes': ctx.fillStyle = p.col || '#9d7bff'; ctx.font = '800 ' + (s * 2.4) + 'px "Baloo 2", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('♪', p.x, p.y); break;
      case 'rainbow': ell(ctx, p.x, p.y, s, s); fs(ctx, RAINBOW[p.ci % RAINBOW.length]); break;
      case 'sparkle': starPath(ctx, p.x, p.y, s * 1.2, s * 0.25, 4, p.rot); fs(ctx, '#ffffff'); break;
      default: ell(ctx, p.x, p.y, s, s); fs(ctx, p.col || '#fff');
    }
    ctx.globalAlpha = 1;
  }

  /* =====================================================================
   * ITEMS
   * ===================================================================== */
  function drawCoin(ctx, x, y, t, r) {
    r = r || 11;
    const w = Math.abs(Math.cos(t * 3)) * r + 2;
    ell(ctx, x, y, w, r); fs(ctx, '#ffd23f', '#d99a0b', 2);
    ell(ctx, x, y, w * 0.6, r * 0.62); fs(ctx, '#ffe680');
    if (w > r * 0.5) { ctx.fillStyle = '#e0a800'; ctx.fillRect(x - 1.2, y - r * 0.4, 2.4, r * 0.8); }
  }
  function drawStar(ctx, x, y, r, t, col) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 2) * 0.15);
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 1.8);
    glow.addColorStop(0, 'rgba(255,240,150,0.7)'); glow.addColorStop(1, 'rgba(255,240,150,0)');
    ctx.fillStyle = glow; ctx.fillRect(-r * 2, -r * 2, r * 4, r * 4);
    starPath(ctx, 0, 0, r, r * 0.5, 5, 0); fs(ctx, col || '#ffd23f', '#d98a0b', 2.5);
    starPath(ctx, -r * 0.1, -r * 0.1, r * 0.55, r * 0.27, 5, 0); fs(ctx, 'rgba(255,255,255,0.45)');
    ell(ctx, -r * 0.18, -r * 0.05, r * 0.08, r * 0.14); fs(ctx, '#6b3a0b'); ell(ctx, r * 0.18, -r * 0.05, r * 0.08, r * 0.14); fs(ctx, '#6b3a0b');
    ctx.restore();
  }
  function drawHeart(ctx, x, y, s, full) {
    heartPath(ctx, x, y, s); fs(ctx, full ? '#ff4f7b' : 'rgba(255,255,255,0.35)', full ? '#b8234f' : 'rgba(120,60,90,0.5)', 2);
    if (full) { ell(ctx, x - s * 0.35, y - s * 0.45, s * 0.18, s * 0.12, -0.6); fs(ctx, 'rgba(255,255,255,0.7)'); }
  }
  function drawPowerup(ctx, kind, x, y, t) {
    const b = Math.sin(t * 4) * 2;
    ctx.save(); ctx.translate(x, y + b);
    ell(ctx, 0, 0, 16, 16); fs(ctx, 'rgba(255,255,255,0.85)', '#fff', 2);
    switch (kind) {
      case 'heart': drawHeart(ctx, 0, 3, 11, true); break;
      case 'magnet':
        ctx.lineWidth = 7; ctx.lineCap = 'butt'; ctx.strokeStyle = '#ff4f5e';
        ctx.beginPath(); ctx.arc(0, -1, 7, Math.PI, 0, false); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-7, -1); ctx.lineTo(-7, 7); ctx.moveTo(7, -1); ctx.lineTo(7, 7); ctx.stroke();
        ctx.strokeStyle = '#d9e2f0'; ctx.beginPath(); ctx.moveTo(-7, 5); ctx.lineTo(-7, 9); ctx.moveTo(7, 5); ctx.lineTo(7, 9); ctx.stroke();
        break;
      case 'shield': ell(ctx, 0, 0, 11, 11); ctx.fillStyle = 'rgba(120,210,255,0.5)'; ctx.fill(); ctx.strokeStyle = '#3aa8e0'; ctx.lineWidth = 2.5; ctx.stroke(); ell(ctx, -4, -4, 3, 2, -0.6); fs(ctx, '#fff'); break;
      case 'boots':
        ctx.strokeStyle = '#7a5ce6'; ctx.lineWidth = 2.5; ctx.beginPath();
        for (let i = 0; i < 4; i++) { ctx.moveTo(-7, 7 - i * 4); ctx.lineTo(7, 5 - i * 4); }
        ctx.stroke(); U.rr(ctx, -9, 7, 18, 5, 2); fs(ctx, '#9d7bff'); U.rr(ctx, -8, -12, 16, 5, 2); fs(ctx, '#ff85b0');
        break;
      case 'rainbow': starPath(ctx, 0, 0, 12, 5.5, 5, t * 2); ctx.fillStyle = 'hsl(' + ((t * 300) % 360) + ',90%,65%)'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); break;
    }
    ctx.restore();
  }

  /* =====================================================================
   * TILES - cached bitmaps per (world, tile code, neighbour mask)
   * mask bits: 1 = nothing above, 2 = nothing right, 4 = nothing below, 8 = nothing left
   * ===================================================================== */
  const tileCache = new Map();
  const TILE_RES = 2; // bitmap px per world unit - crisp on 2x screens
  function getTile(world, code, mask) {
    const key = world.id + code + mask;
    let c = tileCache.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = T * TILE_RES;
    const g = c.getContext('2d');
    g.scale(TILE_RES, TILE_RES);
    paintTile(g, world, code, mask);
    tileCache.set(key, c);
    return c;
  }
  function paintTile(g, world, code, mask) {
    const p = world.pal;
    const top = mask & 1, right = mask & 2, bottom = mask & 4, left = mask & 8;
    if (code === '#' || code === 'I') {
      const ice = code === 'I';
      const r = 12;
      g.save();
      // body with rounded exposed corners
      g.beginPath();
      const tl = top && left ? r : 0, tr = top && right ? r : 0, br = bottom && right ? r : 0, bl = bottom && left ? r : 0;
      g.moveTo(tl, 0); g.lineTo(T - tr, 0); g.quadraticCurveTo(T, 0, T, tr); g.lineTo(T, T - br); g.quadraticCurveTo(T, T, T - br, T);
      g.lineTo(bl, T); g.quadraticCurveTo(0, T, 0, T - bl); g.lineTo(0, tl); g.quadraticCurveTo(0, 0, tl, 0); g.closePath();
      g.clip();
      if (ice) {
        const gr = g.createLinearGradient(0, 0, T, T); gr.addColorStop(0, '#d8f4ff'); gr.addColorStop(1, '#8fd3f5');
        g.fillStyle = gr; g.fillRect(0, 0, T, T);
        g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 3; g.beginPath(); g.moveTo(8, 38); g.lineTo(22, 24); g.moveTo(28, 40); g.lineTo(38, 30); g.stroke();
        g.strokeStyle = '#5ab8e6'; g.lineWidth = 3; g.strokeRect(0, 0, T, T);
      } else {
        g.fillStyle = p.dirt; g.fillRect(0, 0, T, T);
        // stable "random" pebbles so neighbouring tiles look varied but don't flicker
        const r2 = U.rng(mask * 31 + world.id * 7);
        g.fillStyle = p.dirtDark;
        for (let i = 0; i < 4; i++) { ell(g, 6 + r2() * 36, 16 + r2() * 28, 2.5 + r2() * 2.5, 2 + r2() * 2); g.fill(); }
        g.fillStyle = U.shade(p.dirt, 0.18);
        for (let i = 0; i < 2; i++) { ell(g, 6 + r2() * 36, 16 + r2() * 28, 2, 1.6); g.fill(); }
        if (left) { g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(0, 0, 4, T); }
        if (right) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(T - 5, 0, 5, T); }
        if (bottom) { g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(0, T - 5, T, 5); }
      }
      g.restore();
      if (top && !ice) {
        // grass / snow / sand cap with a scalloped lower edge
        g.fillStyle = p.grassDark;
        g.beginPath(); g.moveTo(left ? 3 : 0, 0); g.lineTo(right ? T - 3 : T, 0); g.lineTo(right ? T - 3 : T, 13);
        for (let i = 4; i >= 0; i--) { const x = i * (T / 4); g.quadraticCurveTo(x + T / 8, 21, x, 14); }
        g.closePath(); g.fill();
        g.fillStyle = p.grass;
        g.beginPath(); g.moveTo(left ? 4 : 0, 0); g.lineTo(right ? T - 4 : T, 0); g.lineTo(right ? T - 4 : T, 10);
        for (let i = 4; i >= 0; i--) { const x = i * (T / 4); g.quadraticCurveTo(x + T / 8, 17, x, 10); }
        g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.35)'; U.rr(g, left ? 8 : 2, 2, T - (left ? 12 : 4) - (right ? 6 : 0), 3, 1.5); g.fill();
      }
    } else if (code === '=' || code === 'U') {
      const col = code === 'U' ? '#b99a7a' : p.block, dark = code === 'U' ? '#8a6a4a' : p.blockDark;
      U.rr(g, 1, 1, T - 2, T - 2, 9); g.fillStyle = dark; g.fill();
      U.rr(g, 1, 1, T - 2, T - 6, 9); g.fillStyle = col; g.fill();
      U.rr(g, 6, 5, T - 18, 6, 3); g.fillStyle = 'rgba(255,255,255,0.45)'; g.fill();
      if (code === '=') {
        g.fillStyle = 'rgba(255,255,255,0.25)';
        if (world.id === 1) { g.beginPath(); g.arc(T / 2, T / 2 + 2, 8, 0, TAU); g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.4)'; g.stroke(); }
        else { starPath(g, T / 2, T / 2 + 2, 7, 3, 4, 0); g.fill(); }
      }
      U.rr(g, 1, 1, T - 2, T - 2, 9); g.strokeStyle = U.shade(dark, -0.3); g.lineWidth = 2; g.stroke();
    } else if (code === '-') {
      if (world.id === 5 || world.id === 3) {
        g.fillStyle = world.id === 5 ? '#ffffff' : '#ffb3a7';
        for (let i = 0; i < 4; i++) { ell(g, 6 + i * 12, 10, 10, 8); g.fill(); }
        g.fillStyle = world.id === 5 ? '#efe3ff' : '#ff8f7a'; U.rr(g, 0, 12, T, 7, 3); g.fill();
      } else {
        U.rr(g, 0, 2, T, 14, 4); g.fillStyle = U.shade(p.plank, -0.25); g.fill();
        U.rr(g, 0, 2, T, 10, 4); g.fillStyle = p.plank; g.fill();
        g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(T / 2 - 1, 3, 2, 12);
        g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(4, 4, T - 8, 2);
      }
    } else if (code === 'S') {
      // thorny bush - clearly "don't touch"
      for (let i = 0; i < 4; i++) { tri(g, i * 12, T, i * 12 + 6, T - 22, i * 12 + 12, T); g.fillStyle = '#9b7fc4'; g.fill(); g.strokeStyle = '#5d4488'; g.lineWidth = 2; g.stroke(); }
      g.fillStyle = '#7ed957'; ell(g, T / 2, T - 4, T / 2, 6); g.fill();
    }
  }
  function drawQBlock(ctx, x, y, t, bump) {
    const oy = -bump * 10;
    const sh = (Math.sin(t * 3) + 1) / 2;
    U.rr(ctx, x + 1, y + 1 + oy, T - 2, T - 2, 9); ctx.fillStyle = '#e0a000'; ctx.fill();
    U.rr(ctx, x + 1, y + 1 + oy, T - 2, T - 6, 9); ctx.fillStyle = 'rgb(255,' + Math.floor(200 + sh * 30) + ',60)'; ctx.fill();
    U.rr(ctx, x + 1, y + 1 + oy, T - 2, T - 2, 9); ctx.strokeStyle = '#a86c00'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = '800 32px "Baloo 2", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 4; ctx.strokeStyle = '#c47a00'; ctx.strokeText('?', x + T / 2, y + T / 2 + 2 + oy); ctx.fillText('?', x + T / 2, y + T / 2 + 2 + oy);
  }
  function drawLava(ctx, x, y, w, t, world) {
    // chocolate lava for world 6 - warm, glossy, animated surface
    ctx.save();
    ctx.beginPath(); ctx.moveTo(x, y + 14);
    for (let i = 0; i <= w; i += 8) ctx.lineTo(x + i, y + 10 + Math.sin(t * 3 + (x + i) * 0.08) * 4);
    ctx.lineTo(x + w, y + T * 3); ctx.lineTo(x, y + T * 3); ctx.closePath();
    const gr = ctx.createLinearGradient(0, y, 0, y + T * 2);
    gr.addColorStop(0, '#a8643a'); gr.addColorStop(1, '#5c3620');
    ctx.fillStyle = gr; ctx.fill();
    ctx.fillStyle = 'rgba(255,220,180,0.35)';
    for (let i = 0; i < w; i += 36) { ell(ctx, x + i + 12 + Math.sin(t + i) * 4, y + 18, 7, 2); ctx.fill(); }
    ctx.restore();
  }

  /* =====================================================================
   * ENEMIES - bottom-centre origin
   * ===================================================================== */
  function drawEnemy(ctx, e, t, world) {
    const x = e.x + e.w / 2, y = e.y + e.h;
    ctx.save(); ctx.translate(x, y);
    if (e.dir < 0) ctx.scale(-1, 1);
    const tt = t + (e.seed || 0);
    const eyes = (ex, ey, s) => {
      s = s || 1;
      ell(ctx, ex, ey, 4 * s, 5 * s); fs(ctx, '#fff', '#333', 1.2);
      ell(ctx, ex + 5 * s + 4, ey, 4 * s, 5 * s); fs(ctx, '#fff', '#333', 1.2);
      ell(ctx, ex + 1.4 * s, ey + 1, 2 * s, 2.6 * s); fs(ctx, '#222');
      ell(ctx, ex + 5 * s + 5.4, ey + 1, 2 * s, 2.6 * s); fs(ctx, '#222');
    };
    switch (e.type) {
      case 'slime': {
        const sq = Math.sin(tt * 6) * 0.08;
        const col = e.col || world.pal.accent;
        ctx.beginPath(); ctx.moveTo(-19 * (1 + sq), 0);
        ctx.bezierCurveTo(-20 * (1 + sq), -30 * (1 - sq), 20 * (1 + sq), -30 * (1 - sq), 19 * (1 + sq), 0); ctx.closePath();
        fs(ctx, U.rgba(col.startsWith('#') ? col : '#8fe36b', 0.9), U.shade(col, -0.4), 2.2);
        ell(ctx, -7, -17, 4, 3, -0.5); fs(ctx, 'rgba(255,255,255,0.6)');
        eyes(-4, -12, 0.9);
        break;
      }
      case 'bee': {
        const fl = Math.sin(tt * 40) * 0.5;
        ell(ctx, -3, -26, 8, 5, -0.6 + fl); fs(ctx, 'rgba(220,245,255,0.85)', '#9ac', 1.2);
        ell(ctx, 4, -27, 8, 5, 0.6 - fl); fs(ctx, 'rgba(220,245,255,0.85)', '#9ac', 1.2);
        ell(ctx, 0, -14, 15, 12); fs(ctx, '#ffd23f', '#6b4a00', 2);
        ctx.save(); ell(ctx, 0, -14, 15, 12); ctx.clip(); ctx.fillStyle = '#3a2a1a'; ctx.fillRect(-9, -28, 5, 30); ctx.fillRect(1, -28, 5, 30); ctx.restore();
        tri(ctx, -15, -14, -21, -12, -14, -10); fs(ctx, '#3a2a1a');
        eyes(3, -17, 0.75);
        break;
      }
      case 'hedgehog': {
        for (let i = 0; i < 7; i++) { const a = Math.PI + 0.25 + i * 0.4; tri(ctx, Math.cos(a) * 12, -12 + Math.sin(a) * 10, Math.cos(a) * 24, -12 + Math.sin(a) * 20, Math.cos(a + 0.2) * 12, -12 + Math.sin(a + 0.2) * 10); fs(ctx, '#6b4e3a', '#3a2a1a', 1.5); }
        ell(ctx, 0, -11, 17, 11); fs(ctx, '#8b6a50', '#3a2a1a', 2);
        ell(ctx, 10, -9, 9, 7); fs(ctx, '#f3d9b8', '#3a2a1a', 1.5);
        ell(ctx, 18, -10, 2.4, 2.4); fs(ctx, '#222');
        ell(ctx, 9, -12, 2, 2.6); fs(ctx, '#222');
        break;
      }
      case 'snowball': {
        ctx.save(); ctx.translate(0, -18); ctx.rotate(e.roll || 0);
        ell(ctx, 0, 0, 18, 18); fs(ctx, '#ffffff', '#9fc4e8', 2.5);
        ell(ctx, -6, -8, 4, 3); fs(ctx, '#e3f1ff'); ell(ctx, 7, 5, 3, 2); fs(ctx, '#e3f1ff');
        ctx.restore();
        eyes(-2, -22, 0.85);
        ctx.strokeStyle = '#555'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(6, -12, 4, 0.3, Math.PI - 0.3); ctx.stroke();
        break;
      }
      case 'fish': {
        const w = Math.sin(tt * 8) * 0.3;
        ctx.save(); ctx.translate(-16, -14); ctx.rotate(w); tri(ctx, 0, 0, -12, -9, -12, 9); fs(ctx, '#ffb347', '#b86b00', 1.8); ctx.restore();
        ell(ctx, 0, -14, 18, 12); fs(ctx, '#ffb347', '#b86b00', 2);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-3, -24); ctx.lineTo(-3, -4); ctx.stroke();
        ell(ctx, 8, -17, 4, 4.5); fs(ctx, '#fff', '#333', 1.2); ell(ctx, 9, -16.5, 2, 2.4); fs(ctx, '#222');
        break;
      }
      case 'jelly': {
        const p = Math.sin(tt * 3);
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-9 + i * 6, -16); ctx.quadraticCurveTo(-12 + i * 6 + p * 4, -6, -9 + i * 6, 2); ctx.strokeStyle = 'rgba(255,150,220,0.9)'; ctx.lineWidth = 2.5; ctx.stroke(); }
        ctx.beginPath(); ctx.ellipse(0, -17, 16, 14 + p, 0, Math.PI, 0); ctx.closePath(); fs(ctx, 'rgba(255,170,230,0.85)', '#d05aa8', 2);
        eyes(-6, -22, 0.7);
        break;
      }
      case 'urchin': {
        const r = 14 + Math.sin(tt * 4) * 1.5;
        for (let i = 0; i < 12; i++) { const a = i * TAU / 12 + tt * 0.5; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 8, -16 + Math.sin(a) * 8); ctx.lineTo(Math.cos(a) * (r + 6), -16 + Math.sin(a) * (r + 6)); ctx.strokeStyle = '#5d3a8a'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.stroke(); }
        ell(ctx, 0, -16, 12, 12); fs(ctx, '#8a5cc4', '#4a2a70', 2);
        eyes(-6, -18, 0.6);
        break;
      }
      case 'shroom': {
        const st = Math.sin(tt * 10) * 2;
        ell(ctx, -5, -3, 5, 3.5); fs(ctx, '#5a3a2a'); ell(ctx, 6, -3 + st * 0.3, 5, 3.5); fs(ctx, '#5a3a2a');
        U.rr(ctx, -9, -20, 18, 16, 6); fs(ctx, '#fff3e0', '#8a6a50', 2);
        ctx.beginPath(); ctx.ellipse(0, -20, 22, 16, 0, Math.PI, 0); ctx.closePath(); fs(ctx, '#ff6b6b', '#a33', 2);
        ell(ctx, -8, -28, 4, 3); fs(ctx, '#fff'); ell(ctx, 6, -31, 3, 2.5); fs(ctx, '#fff'); ell(ctx, 13, -24, 2.5, 2); fs(ctx, '#fff');
        eyes(-4, -14, 0.65);
        break;
      }
      case 'bat': {
        const f = Math.sin(tt * 18);
        ctx.fillStyle = '#6a4fa3'; ctx.strokeStyle = '#2b1f4a'; ctx.lineWidth = 1.8;
        [-1, 1].forEach(s => { ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(s * 22, -24 - f * 8); ctx.lineTo(s * 18, -12 - f * 3); ctx.lineTo(s * 12, -16); ctx.closePath(); ctx.fill(); ctx.stroke(); });
        ell(ctx, 0, -14, 11, 10); fs(ctx, '#7a5cc4', '#2b1f4a', 2);
        tri(ctx, -7, -21, -4, -28, -1, -22); fs(ctx, '#7a5cc4'); tri(ctx, 1, -22, 4, -28, 7, -21); fs(ctx, '#7a5cc4');
        eyes(-5, -16, 0.6);
        break;
      }
      case 'cloudy': {
        const b = Math.sin(tt * 2) * 2;
        for (let i = 0; i < 4; i++) { ell(ctx, -14 + i * 9, -16 + b + (i % 2) * -4, 10, 9); fs(ctx, '#b8c4dc'); }
        ell(ctx, 0, -12 + b, 20, 8); fs(ctx, '#b8c4dc');
        eyes(-4, -16 + b, 0.7);
        ctx.strokeStyle = '#555'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(5, -6 + b, 3.5, Math.PI + 0.4, -0.4); ctx.stroke();
        break;
      }
      case 'firejelly': {
        const p = Math.sin(tt * 12) * 3;
        ctx.beginPath(); ctx.moveTo(-14, 0); ctx.quadraticCurveTo(-16, -18, -6, -26 - p); ctx.quadraticCurveTo(0, -38, 4, -28); ctx.quadraticCurveTo(14, -30 + p, 12, -16); ctx.quadraticCurveTo(16, -4, 14, 0); ctx.closePath();
        fs(ctx, '#ff8a3d', '#c4431c', 2);
        ell(ctx, 0, -10, 9, 8); fs(ctx, '#ffe066');
        eyes(-5, -14, 0.6);
        break;
      }
    }
    ctx.restore();
  }

  /* =====================================================================
   * BOSSES - drawn around their centre, ~3x player size
   * ===================================================================== */
  function drawBoss(ctx, b, t) {
    ctx.save();
    ctx.translate(b.x + b.w / 2, b.y + b.h);
    if (b.flash > 0 && Math.floor(t * 20) % 2 === 0) ctx.globalAlpha = 0.5;
    const s = b.w / 110;
    ctx.scale((b.dir < 0 ? -1 : 1) * s, s);
    const face = (x, y, mood) => {
      ell(ctx, x - 13, y, 10, 12); fs(ctx, '#fff', '#333', 2); ell(ctx, x + 13, y, 10, 12); fs(ctx, '#fff', '#333', 2);
      const lookX = b.look || 0;
      ell(ctx, x - 11 + lookX * 3, y + 2, 5, 6); fs(ctx, '#222'); ell(ctx, x + 15 + lookX * 3, y + 2, 5, 6); fs(ctx, '#222');
      ell(ctx, x - 12 + lookX * 3, y - 1, 2, 2); fs(ctx, '#fff'); ell(ctx, x + 14 + lookX * 3, y - 1, 2, 2); fs(ctx, '#fff');
      ctx.strokeStyle = '#333'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - 22, y - 16 - (mood === 'angry' ? -4 : 0)); ctx.lineTo(x - 6, y - 14 + (mood === 'angry' ? 4 : 0)); ctx.moveTo(x + 22, y - 16 - (mood === 'angry' ? -4 : 0)); ctx.lineTo(x + 6, y - 14 + (mood === 'angry' ? 4 : 0)); ctx.stroke();
      ctx.beginPath();
      if (mood === 'hurt') { ell(ctx, x, y + 24, 8, 9); fs(ctx, '#7a2a3a'); }
      else { ctx.arc(x, y + 16, 12, 0.2, Math.PI - 0.2); ctx.stroke(); }
    };
    const mood = b.flash > 0 ? 'hurt' : b.phase === 'attack' ? 'angry' : 'smug';
    switch (b.kind) {
      case 'slimeking': {
        const sq = b.squash || 0;
        ctx.scale(1 + sq * 0.3, 1 - sq * 0.3);
        ctx.beginPath(); ctx.moveTo(-55, 0); ctx.bezierCurveTo(-60, -95, 60, -95, 55, 0); ctx.closePath(); fs(ctx, 'rgba(143,227,107,0.92)', '#3f8a2a', 4);
        ell(ctx, -22, -58, 10, 7, -0.5); fs(ctx, 'rgba(255,255,255,0.55)');
        face(0, -40, mood);
        ctx.beginPath(); ctx.moveTo(-26, -76); ctx.lineTo(-28, -100); ctx.lineTo(-13, -86); ctx.lineTo(0, -106); ctx.lineTo(13, -86); ctx.lineTo(28, -100); ctx.lineTo(26, -76); ctx.closePath(); fs(ctx, '#ffd84a', '#c99a12', 3);
        break;
      }
      case 'snowman': {
        ell(ctx, 0, -32, 46, 34); fs(ctx, '#fff', '#9fc4e8', 4);
        ell(ctx, 0, -86, 34, 30); fs(ctx, '#fff', '#9fc4e8', 4);
        ell(ctx, 0, -38, 4, 4); fs(ctx, '#333'); ell(ctx, 0, -22, 4, 4); fs(ctx, '#333');
        U.rr(ctx, -30, -110, 60, 10, 4); fs(ctx, '#ff5e7e', '#a3223f', 3);
        U.rr(ctx, -20, -150, 40, 44, 6); fs(ctx, '#34426b', '#1a2140', 3);
        ctx.fillStyle = '#ff5e7e'; ctx.fillRect(-20, -118, 40, 7);
        face(0, -90, mood);
        tri(ctx, 0, -80, 26, -76, 0, -72); fs(ctx, '#ff8a3d', '#b8561c', 2);
        ctx.strokeStyle = '#7a4a2e'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(40, -50); ctx.lineTo(70, -70 + Math.sin(t * 5) * 10); ctx.moveTo(-40, -50); ctx.lineTo(-68, -64); ctx.stroke();
        break;
      }
      case 'octopus': {
        for (let i = 0; i < 6; i++) {
          const x0 = -40 + i * 16, w = Math.sin(t * 3 + i) * 10;
          ctx.beginPath(); ctx.moveTo(x0, -30); ctx.quadraticCurveTo(x0 + w, -10, x0 - w * 0.5 + (i < 3 ? -10 : 10), 4);
          ctx.strokeStyle = '#9d4fd6'; ctx.lineWidth = 13; ctx.lineCap = 'round'; ctx.stroke();
          ctx.strokeStyle = '#c77dff'; ctx.lineWidth = 8; ctx.stroke();
        }
        ell(ctx, 0, -62, 52, 46); fs(ctx, '#c77dff', '#7a2fb0', 4);
        ell(ctx, -20, -86, 10, 7, -0.4); fs(ctx, 'rgba(255,255,255,0.45)');
        face(0, -58, mood);
        break;
      }
      case 'shroomlord': {
        U.rr(ctx, -26, -64, 52, 62, 18); fs(ctx, '#fff3e0', '#8a6a50', 4);
        ctx.beginPath(); ctx.ellipse(0, -62, 64, 50, 0, Math.PI, 0); ctx.closePath(); fs(ctx, '#ff6b8a', '#a3334f', 4);
        [[-30, -82, 10], [8, -98, 12], [34, -74, 8], [-6, -72, 6]].forEach(([x, y, r]) => { ell(ctx, x, y, r, r * 0.8); fs(ctx, '#fff'); });
        face(0, -36, mood);
        break;
      }
      case 'storm': {
        const b2 = Math.sin(t * 2) * 3;
        [[-40, -50, 30], [-10, -70, 36], [28, -60, 32], [48, -40, 24], [-50, -30, 22], [0, -34, 40]].forEach(([x, y, r]) => { ell(ctx, x, y + b2, r, r * 0.85); fs(ctx, '#8e9bb8'); });
        ell(ctx, 0, -40 + b2, 62, 26); fs(ctx, '#7a87a6');
        face(0, -50 + b2, mood);
        ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-30, -14); ctx.lineTo(-24, -2); ctx.lineTo(-32, 0); ctx.lineTo(-26, 14); ctx.stroke();
        break;
      }
      case 'chocodragon': {
        const f = Math.sin(t * 4) * 0.2;
        ctx.save(); ctx.translate(-20, -80); ctx.rotate(-0.5 - f);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-50, -40); ctx.lineTo(-40, -12); ctx.lineTo(-62, -8); ctx.lineTo(-34, 6); ctx.lineTo(-44, 22); ctx.closePath(); fs(ctx, '#ff9ecf', '#b8567f', 3); ctx.restore();
        ell(ctx, 0, -42, 48, 40); fs(ctx, '#8b5a3c', '#4a2a18', 4);
        ell(ctx, 6, -36, 30, 26); fs(ctx, '#e8c39e');
        ell(ctx, 22, -96, 36, 30); fs(ctx, '#8b5a3c', '#4a2a18', 4);
        ell(ctx, 44, -86, 18, 14); fs(ctx, '#a5704c', '#4a2a18', 3);
        tri(ctx, 4, -120, 12, -140, 18, -122); fs(ctx, '#ffcf70', '#b8861c', 2); tri(ctx, 28, -124, 40, -142, 40, -120); fs(ctx, '#ffcf70', '#b8861c', 2);
        face(18, -100, mood);
        break;
      }
    }
    ctx.restore();
  }

  /* =====================================================================
   * BACKGROUNDS - parallax layers cached per world & view height
   * ===================================================================== */
  const bgCache = new Map();
  const BG_W = 1920; // layers tile horizontally every 1920 world units
  function bgLayer(world, which, viewH) {
    const key = world.id + which + Math.round(viewH);
    let c = bgCache.get(key);
    if (c) return c;
    const res = 1;
    c = document.createElement('canvas'); c.width = BG_W * res; c.height = Math.ceil(viewH * res);
    const g = c.getContext('2d'); g.scale(res, res);
    const r = U.rng(world.id * 100 + (which === 'far' ? 1 : 2));
    const H = viewH, p = world.pal;
    // periodic height function so the layer wraps seamlessly
    const waves = [];
    for (let i = 0; i < 4; i++) waves.push({ k: (i + 1) * (which === 'far' ? 2 : 3), a: r() * (which === 'far' ? 40 : 28) / (i + 1), ph: r() * TAU });
    const hAt = (x) => waves.reduce((s, w) => s + Math.sin(x / BG_W * TAU * w.k + w.ph) * w.a, 0);
    const baseY = which === 'far' ? H * 0.5 : H * 0.66;

    if (world.id === 2 && which === 'far') {
      // jagged snowy mountains
      for (let i = 0; i < 9; i++) {
        const cx = i * BG_W / 9 + r() * 80, h = 160 + r() * 140, w = 170 + r() * 90;
        [cx, cx - BG_W, cx + BG_W].forEach(x => {
          tri(g, x - w, H, x, H * 0.62 - h + 60, x + w, H); g.fillStyle = p.far; g.fill();
          tri(g, x - w * 0.3, H * 0.62 - h + 60 + h * 0.3, x, H * 0.62 - h + 60, x + w * 0.3, H * 0.62 - h + 60 + h * 0.3); g.fillStyle = '#ffffff'; g.fill();
        });
      }
      return finish();
    }
    if (world.id === 6 && which === 'far') {
      for (let i = 0; i < 4; i++) {
        const cx = i * BG_W / 4 + 120 + r() * 200, h = 230 + r() * 80, w = 260;
        [cx, cx - BG_W, cx + BG_W].forEach(x => {
          g.beginPath(); g.moveTo(x - w, H); g.lineTo(x - 40, H - h); g.lineTo(x + 40, H - h); g.lineTo(x + w, H); g.closePath(); g.fillStyle = p.far; g.fill();
          g.fillStyle = '#6b3a20'; g.beginPath(); g.moveTo(x - 44, H - h + 4); g.lineTo(x + 44, H - h + 4);
          for (let k = 0; k < 5; k++) g.quadraticCurveTo(x + 44 - k * 22 + 11, H - h + 30 + (k % 2) * 30, x + 44 - (k + 1) * 22 + 4, H - h + 8);
          g.closePath(); g.fill();
        });
      }
      return finish();
    }
    if (world.id === 5 && which === 'far') {
      // floating islands with little castles
      for (let i = 0; i < 5; i++) {
        const cx = i * BG_W / 5 + r() * 120 + 60, cy = H * 0.3 + r() * H * 0.25;
        [cx, cx - BG_W, cx + BG_W].forEach(x => {
          g.fillStyle = '#e8d6ff'; g.beginPath(); g.moveTo(x - 90, cy); g.quadraticCurveTo(x, cy + 90, x + 90, cy); g.closePath(); g.fill();
          g.fillStyle = '#ffffff'; ell(g, x, cy, 92, 14); g.fill();
          g.fillStyle = '#ffd6e8';
          g.fillRect(x - 40, cy - 60, 22, 60); g.fillRect(x + 18, cy - 70, 22, 70); g.fillRect(x - 20, cy - 40, 40, 40);
          g.fillStyle = '#b79cf0'; tri(g, x - 44, cy - 60, x - 29, cy - 88, x - 14, cy - 60); g.fill(); tri(g, x + 14, cy - 70, x + 29, cy - 100, x + 44, cy - 70); g.fill();
          g.fillStyle = '#ff85b0'; g.fillRect(x + 28, cy - 112, 2, 14); tri(g, x + 30, cy - 112, x + 42, cy - 108, x + 30, cy - 104); g.fill();
        });
      }
      return finish();
    }
    // generic rolling hills
    g.beginPath(); g.moveTo(0, H);
    for (let x = 0; x <= BG_W; x += 16) g.lineTo(x, baseY + hAt(x));
    g.lineTo(BG_W, H); g.closePath();
    g.fillStyle = which === 'far' ? p.far : p.mid; g.fill();
    if (which === 'mid') { g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); for (let x = 0; x <= BG_W; x += 16) g.lineTo(x, baseY + hAt(x) + 8); g.lineTo(BG_W, baseY + hAt(BG_W)); g.fill(); }
    // decorations on the mid layer
    if (which === 'mid') {
      const n = 14;
      for (let i = 0; i < n; i++) {
        const x = (i + r() * 0.6) * BG_W / n, y = baseY + hAt(x) + 4;
        decor(g, world, x, y, r);
        if (x < 120) decor(g, world, x + BG_W, y, U.rng(i));
      }
    }
    if (world.id === 3 && which === 'far') {
      for (let i = 0; i < 18; i++) { const x = r() * BG_W, h = 60 + r() * 120; g.strokeStyle = 'rgba(20,80,120,0.5)'; g.lineWidth = 8; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, H); g.quadraticCurveTo(x + 20, H - h / 2, x, H - h); g.stroke(); }
    }
    return finish();

    function finish() {
      // Crop away the fully transparent sky part at the top of the layer so
      // each frame blits only real pixels (roughly half the area).
      const data = g.getImageData(0, 0, c.width, c.height).data;
      let top = 0;
      outer: for (let y = 0; y < c.height; y++) { for (let x = 3; x < c.width * 4; x += 16) if (data[y * c.width * 4 + x] > 0) { top = y; break outer; } }
      top = Math.max(0, top - 2);
      const cropped = document.createElement('canvas'); cropped.width = c.width; cropped.height = Math.max(1, c.height - top);
      cropped.getContext('2d').drawImage(c, 0, -top);
      cropped.top = top / res;
      bgCache.set(key, cropped); return cropped;
    }
  }
  function decor(g, world, x, y, r) {
    const id = world.id;
    if (id === 1) {
      if (r() < 0.55) { // lollipop tree
        g.fillStyle = '#fff'; g.fillRect(x - 3, y - 70, 6, 70);
        const cols = ['#ff6fae', '#ffd23f', '#5ccfff', '#9d7bff'];
        const cc = cols[Math.floor(r() * 4)];
        ell(g, x, y - 80, 26, 26); g.fillStyle = cc; g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 5; g.beginPath(); g.arc(x, y - 80, 15, 0, 5); g.stroke();
      } else { for (let k = 0; k < 3; k++) { ell(g, x + k * 12, y - 6, 5, 5); g.fillStyle = ['#fff', '#ffe066', '#ff85b0'][k]; g.fill(); } }
    } else if (id === 2) {
      g.fillStyle = '#4f8f7a'; for (let k = 0; k < 3; k++) { tri(g, x - 26 + k * 5, y - k * 24, x, y - 40 - k * 24, x + 26 - k * 5, y - k * 24); g.fill(); }
      g.fillStyle = '#fff'; for (let k = 0; k < 3; k++) { tri(g, x - 12 + k * 3, y - 22 - k * 24, x, y - 40 - k * 24, x + 12 - k * 3, y - 22 - k * 24); g.fill(); }
    } else if (id === 3) {
      const cols = ['#ff8f7a', '#ffb3d9', '#ffd166'];
      g.strokeStyle = cols[Math.floor(r() * 3)]; g.lineWidth = 9; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 50); g.moveTo(x, y - 25); g.lineTo(x - 18, y - 45); g.moveTo(x, y - 35); g.lineTo(x + 16, y - 60); g.stroke();
    } else if (id === 4) {
      const h = 50 + r() * 50;
      g.fillStyle = '#e6d6c8'; g.fillRect(x - 6, y - h, 12, h);
      g.beginPath(); g.ellipse(x, y - h, 30, 20, 0, Math.PI, 0); g.closePath(); g.fillStyle = r() < 0.5 ? '#ff7a9a' : '#5ccfff'; g.fill();
      g.fillStyle = 'rgba(255,255,200,0.9)'; ell(g, x - 10, y - h - 8, 4, 3); g.fill(); ell(g, x + 9, y - h - 12, 3, 2.5); g.fill();
    } else if (id === 5) {
      for (let k = 0; k < 3; k++) { ell(g, x + k * 22, y - 10 - (k % 2) * 10, 26, 20); g.fillStyle = '#ffffff'; g.fill(); }
    } else if (id === 6) {
      g.strokeStyle = '#fff'; g.lineWidth = 8; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 50); g.arc(x + 12, y - 50, 12, Math.PI, 0); g.stroke();
      g.strokeStyle = '#ff5e7e'; g.lineWidth = 8; g.setLineDash([6, 8]); g.stroke(); g.setLineDash([]);
    }
  }

  /* Sky + parallax + live effects (clouds, bubbles, fireflies, snow...). */
  function drawBackground(ctx, world, camX, camY, vw, vh, t) {
    const p = world.pal;
    // The sky gradient is a CSS background on the canvas element: the
    // browser's compositor paints it on the GPU for free, while repainting a
    // full-screen gradient in the canvas every frame was the single biggest
    // cost on slow tablets. The canvas itself is just cleared.
    const cv = ctx.canvas;
    if (cv && cv.__sky !== world.id) { cv.__sky = world.id; cv.style.background = 'linear-gradient(' + p.skyTop + ',' + p.skyBot + ')'; }
    ctx.clearRect(0, 0, vw, vh);
    const id = world.id;
    // sun / moon
    if (id === 4) {
      for (let i = 0; i < 40; i++) { const sx = (i * 173) % vw, sy = (i * 97) % (vh * 0.6); ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 2 + i); ell(ctx, sx, sy, 1.6, 1.6); fs(ctx, '#fff'); }
      ctx.globalAlpha = 1; ell(ctx, vw * 0.8, vh * 0.18, 34, 34); fs(ctx, '#fff6c9'); ell(ctx, vw * 0.8 + 12, vh * 0.18 - 6, 28, 28); fs(ctx, p.skyTop);
    } else if (id !== 3) {
      const sg = ctx.createRadialGradient(vw * 0.82, vh * 0.16, 10, vw * 0.82, vh * 0.16, 90);
      sg.addColorStop(0, 'rgba(255,250,200,1)'); sg.addColorStop(0.4, 'rgba(255,240,160,0.7)'); sg.addColorStop(1, 'rgba(255,240,160,0)');
      ctx.fillStyle = sg; ctx.fillRect(vw * 0.82 - 90, vh * 0.16 - 90, 180, 180);
    } else {
      // underwater light rays
      ctx.save(); ctx.globalAlpha = 0.12;
      for (let i = 0; i < 5; i++) { const x = ((i * 300 - camX * 0.1) % (vw + 300) + vw + 300) % (vw + 300) - 150; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 60, 0); ctx.lineTo(x + 180 + Math.sin(t + i) * 20, vh); ctx.lineTo(x + 80, vh); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); }
      ctx.restore();
    }
    // drifting clouds (not underwater / at night)
    if (id !== 3 && id !== 4) {
      for (let i = 0; i < 6; i++) {
        const cw = 900 + vw;
        const x = ((i * 380 - camX * 0.08 - t * (8 + i * 2)) % cw + cw) % cw - 200, y = 40 + (i * 53) % (vh * 0.35);
        ctx.globalAlpha = 0.85;
        ell(ctx, x, y, 44, 20); fs(ctx, '#fff'); ell(ctx, x + 30, y - 10, 30, 22); fs(ctx, '#fff'); ell(ctx, x - 26, y + 2, 26, 16); fs(ctx, '#fff');
        ctx.globalAlpha = 1;
      }
    }
    const far = bgLayer(world, 'far', vh), mid = bgLayer(world, 'mid', vh);
    const fy = -camY * 0.15, my = -camY * 0.3;
    drawWrap(ctx, far, camX * 0.18, vw, fy, vh);
    drawWrap(ctx, mid, camX * 0.42, vw, my + 30, vh);
    // world-specific ambient particles
    if (id === 2 || id === 6) {
      for (let i = 0; i < 40; i++) {
        const x = ((i * 137 + t * 20 * (id === 2 ? 1 : 0.6) - camX * 0.5) % vw + vw) % vw;
        const y = ((i * 71 + t * (30 + (i % 5) * 8)) % vh);
        if (id === 2) { ell(ctx, x, y, 2 + (i % 3), 2 + (i % 3)); fs(ctx, 'rgba(255,255,255,0.85)'); }
        else { ctx.save(); ctx.translate(x, y); ctx.rotate(i); ctx.fillStyle = RAINBOW[i % 6]; ctx.fillRect(-4, -1.5, 8, 3); ctx.restore(); }
      }
    }
    if (id === 3) {
      for (let i = 0; i < 25; i++) {
        const x = ((i * 191 - camX * 0.3) % vw + vw) % vw + Math.sin(t * 2 + i) * 6;
        const y = vh - ((i * 83 + t * (25 + (i % 4) * 10)) % (vh + 40));
        ell(ctx, x, y, 3 + (i % 4), 3 + (i % 4)); ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
      }
    }
    if (id === 4) {
      for (let i = 0; i < 18; i++) {
        const x = ((i * 211 - camX * 0.6) % vw + vw) % vw + Math.sin(t * 0.7 + i) * 30;
        const y = vh * 0.3 + ((i * 59) % (vh * 0.6)) + Math.cos(t * 0.9 + i * 2) * 20;
        const a = 0.5 + 0.5 * Math.sin(t * 3 + i * 1.7);
        const fg = ctx.createRadialGradient(x, y, 0, x, y, 10); fg.addColorStop(0, 'rgba(255,255,150,' + a + ')'); fg.addColorStop(1, 'rgba(255,255,150,0)');
        ctx.fillStyle = fg; ctx.fillRect(x - 10, y - 10, 20, 20);
      }
    }
  }
  function drawWrap(ctx, img, off, vw, y, vh) {
    const w = BG_W, top = img.top || 0, h = vh - top;
    let x = -((off % w) + w) % w;
    for (; x < vw; x += w) ctx.drawImage(img, x, y + top, w, h);
  }
  function clearCaches() { bgCache.clear(); }

  LZ.Art = {
    drawCharacter, drawHat, drawTrailParticle, drawCoin, drawStar, drawHeart, drawPowerup, getTile, drawQBlock, drawLava,
    drawEnemy, drawBoss, drawBackground, clearCaches, drawPet, drawSticker, starPath, heartPath, ell, fs, tri, RAINBOW,
  };
})();
