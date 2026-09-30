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
    } else if (id === 'owl') {
      // folded wings that open while gliding
      const open = glide ? 0.9 + Math.sin(t * 20) * 0.25 : 0.15;
      ctx.save(); ctx.translate(-9, -20); ctx.rotate(-open);
      ell(ctx, -4, 6, 7, 13); fs(ctx, pal.accent, oc, 2);
      ctx.strokeStyle = U.shade(pal.accent, -0.3); ctx.lineWidth = 1.4; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-8 + k * 3, 12); ctx.lineTo(-6 + k * 3, 17); ctx.stroke(); }
      ctx.restore();
    } else if (id === 'bunny') {
      // fluffy round tail
      ell(ctx, -14, -12, 6, 6); fs(ctx, pal.belly, oc, 1.8);
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
    } else if (id === 'owl') {
      // feather tufts
      tri(ctx, hx - 15, hy - 6, hx - 13, hy - 22, hx - 5, hy - 13); fs(ctx, pal.body, oc, lw);
      tri(ctx, hx + 7, hy - 13, hx + 15, hy - 22, hx + 17, hy - 6); fs(ctx, pal.body, oc, lw);
    } else if (id === 'bunny') {
      // long ears that sway a little; the back one flops over at the tip
      const sw = Math.sin(t * 3) * 0.06;
      ctx.save(); ctx.translate(hx - 6, hy - 12); ctx.rotate(-0.25 + sw);
      ell(ctx, 0, -13, 5.5, 14); fs(ctx, pal.body, oc, lw); ell(ctx, 0, -12, 2.8, 10); fs(ctx, pal.accent);
      ctx.restore();
      ctx.save(); ctx.translate(hx + 8, hy - 13); ctx.rotate(0.3 - sw);
      ell(ctx, 0, -13, 5.5, 14); fs(ctx, pal.body, oc, lw); ell(ctx, 0, -12, 2.8, 10); fs(ctx, pal.accent);
      ctx.restore();
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
    if (id === 'owl') { ell(ctx, ex1, ey, 6.5, 6.5); fs(ctx, pal.belly, U.shade(pal.body, -0.25), 1.2); ell(ctx, ex2, ey, 6.5, 6.5); fs(ctx, pal.belly, U.shade(pal.body, -0.25), 1.2); }
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
    if (id === 'owl') { tri(ctx, hx + 1, hy + 3, hx + 7, hy + 3, hx + 4, hy + 9); fs(ctx, '#ffb84d', '#b8741c', 1.2); return; }
    if (id === 'fox' || id === 'cat' || id === 'hamster' || id === 'panda' || id === 'guinea' || id === 'bunny') { ell(ctx, hx + 4, hy + 4, 2, 1.5); fs(ctx, id === 'fox' ? '#2b1a12' : '#ff6f91'); }
    if (id === 'dragon') { ell(ctx, hx + 8, hy + 3, 1, 1); fs(ctx, oc); ell(ctx, hx + 4, hy + 3, 1, 1); fs(ctx, oc); }
    ctx.strokeStyle = U.shade(pal.eye, 0.1); ctx.lineWidth = 1.8; ctx.lineCap = 'round';
    if (surprised) { ell(ctx, hx + 4, hy + 9.5, 2.3, 2.8); fs(ctx, '#7a2a3a'); }
    else if (id === 'frog') { ctx.beginPath(); ctx.arc(hx + 2, hy + 3, 9, 0.25, Math.PI - 0.25); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(hx + 2, hy + 6, 2.6, 0.2, Math.PI - 0.2); ctx.arc(hx + 6.4, hy + 6, 2.6, 0.2, Math.PI - 0.2); ctx.stroke(); }
    if (id === 'bunny' && !surprised) { U.rr(ctx, hx + 2.6, hy + 7, 3.6, 3.6, 1); fs(ctx, '#fff', oc, 0.8); }
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
      case 'gearcap': {
        // mechanic's cap with a little gear badge
        ctx.beginPath(); ctx.ellipse(hx, hy - 5, 17, 13, 0, Math.PI, 0); ctx.closePath(); fs(ctx, '#5ccfff', '#2a7fb0', 2);
        U.rr(ctx, hx - 2, hy - 7, 24, 5, 2.5); fs(ctx, '#2a7fb0');
        drawGear(ctx, hx - 3, hy - 13, 6, t, '#ffd23f');
        break;
      }
      case 'astro': {
        // astronaut helmet: glass bubble with a rim and antenna
        ell(ctx, hx, hy + 1, 23, 22); ctx.fillStyle = 'rgba(190,230,255,0.28)'; ctx.fill(); ctx.strokeStyle = '#d9e2f0'; ctx.lineWidth = 3; ctx.stroke();
        ell(ctx, hx - 9, hy - 10, 5, 3, -0.6); fs(ctx, 'rgba(255,255,255,0.8)');
        ctx.strokeStyle = '#9aa3c5'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(hx + 12, hy - 18); ctx.lineTo(hx + 16, hy - 28); ctx.stroke(); ell(ctx, hx + 16, hy - 29, 2.6, 2.6); fs(ctx, '#ff5e7e');
        break;
      }
      case 'laurel': {
        // golden laurel wreath - 30 medals
        for (let side = -1; side <= 1; side += 2) for (let k = 0; k < 5; k++) {
          const a = Math.PI * (side < 0 ? 1.05 + k * 0.14 : -0.05 - k * 0.14);
          const lx = hx + 1 + Math.cos(a) * 17, ly = hy - 2 + Math.sin(a) * 15;
          ell(ctx, lx, ly, 5, 2.6, a + Math.PI / 2 * side); fs(ctx, '#ffd23f', '#b8861c', 1);
        }
        break;
      }
      case 'nightcap': {
        // floppy striped nightcap with a pompom, for the first night level
        ctx.beginPath(); ctx.moveTo(hx - 16, top + 6); ctx.quadraticCurveTo(hx - 4, top - 22, hx + 14, top - 16); ctx.quadraticCurveTo(hx + 26, top - 10, hx + 22, top + 4); ctx.lineTo(hx + 17, top + 6); ctx.closePath();
        fs(ctx, '#6a5aa8', '#3a2f70', 1.8);
        ctx.save(); ctx.clip(); ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 3; for (let k = -20; k < 30; k += 9) { ctx.beginPath(); ctx.moveTo(hx + k, top - 30); ctx.lineTo(hx + k - 10, top + 10); ctx.stroke(); } ctx.restore();
        U.rr(ctx, hx - 17, top + 2, 36, 7, 3.5); fs(ctx, '#fff', '#b8b0d8', 1.2);
        ell(ctx, hx + 23, top + 6, 5, 5); fs(ctx, '#fff', '#b8b0d8', 1.2);
        break;
      }
      case 'sunhat': {
        // straw sun hat with a pink ribbon - 7 days in a row
        ell(ctx, hx + 1, top + 4, 26, 6.5); fs(ctx, '#f7d98a', '#b8923c', 1.8);
        ctx.beginPath(); ctx.ellipse(hx + 1, top + 2, 14, 12, 0, Math.PI, 0); ctx.closePath(); fs(ctx, '#f7d98a', '#b8923c', 1.8);
        U.rr(ctx, hx - 13, top - 2, 28, 5, 2); fs(ctx, '#ff6fae');
        ell(ctx, hx + 12, top, 3, 3); fs(ctx, '#ff85c8');
        break;
      }
      case 'hardhat': {
        // builder's helmet - for building and finishing your own level
        ctx.beginPath(); ctx.ellipse(hx + 1, top + 5, 16, 14, 0, Math.PI, 0); ctx.closePath(); fs(ctx, '#ffd23f', '#c99a00', 2);
        U.rr(ctx, hx - 19, top + 3, 40, 5, 2.5); fs(ctx, '#ffc21a', '#c99a00', 1.5);
        U.rr(ctx, hx - 2, top - 9, 6, 14, 3); fs(ctx, '#ffe680');
        break;
      }
      case 'nemes': {
        // pharaoh's striped headdress (reward for beating the Sphinx)
        ctx.beginPath(); ctx.moveTo(hx - 17, hy - 4); ctx.quadraticCurveTo(hx + 1, hy - 26, hx + 19, hy - 4);
        ctx.lineTo(hx + 22, hy + 14); ctx.lineTo(hx + 14, hy + 14); ctx.lineTo(hx + 12, hy - 2); ctx.lineTo(hx - 10, hy - 2); ctx.lineTo(hx - 12, hy + 14); ctx.lineTo(hx - 20, hy + 14); ctx.closePath();
        fs(ctx, '#ffd23f', '#b8861c', 2);
        ctx.save(); ctx.clip(); ctx.strokeStyle = '#2a9fd6'; ctx.lineWidth = 3;
        for (let k = -24; k < 30; k += 7) { ctx.beginPath(); ctx.moveTo(hx - 30, hy + k); ctx.lineTo(hx + 30, hy + k - 4); ctx.stroke(); }
        ctx.restore();
        U.rr(ctx, hx - 12, hy - 7, 26, 5, 2); fs(ctx, '#2a9fd6', '#155f86', 1.2);
        ell(ctx, hx + 1, hy - 14, 3.5, 4); fs(ctx, '#ff5e7e', '#a3223f', 1.2);
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
      case 'pet_robot': {
        const f = Math.sin(t * 20) * 3;
        ctx.strokeStyle = '#6b7489'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, -14); ctx.stroke();
        ell(ctx, -8 - f, -15, 8, 2); fs(ctx, 'rgba(200,210,230,0.8)'); ell(ctx, 8 + f, -15, 8, 2); fs(ctx, 'rgba(200,210,230,0.8)');
        U.rr(ctx, -10, -10, 20, 18, 6); fs(ctx, '#5ccfff', '#2a7fb0', 1.8);
        U.rr(ctx, -6, -6, 12, 8, 3); fs(ctx, '#2d2a3a');
        ell(ctx, -3, -2, 1.8, 1.8); fs(ctx, '#7be08a'); ell(ctx, 3, -2, 1.8, 1.8); fs(ctx, '#7be08a');
        break;
      }
      case 'pet_ufo': {
        const gl = 0.25 + 0.2 * Math.sin(t * 6);
        ctx.beginPath(); ctx.moveTo(-6, 4); ctx.lineTo(6, 4); ctx.lineTo(12, 24); ctx.lineTo(-12, 24); ctx.closePath(); ctx.fillStyle = 'rgba(255,240,140,' + gl + ')'; ctx.fill();
        ell(ctx, 0, -5, 6, 5.5); fs(ctx, 'rgba(180,230,255,0.75)', '#5a8ab0', 1.2); ell(ctx, 0, -5, 2.5, 2.5); fs(ctx, '#7ed957');
        ell(ctx, 0, 0, 15, 5); fs(ctx, '#b8c0d0', '#5a6388', 1.8);
        for (let i = -1; i <= 1; i++) { ell(ctx, i * 7, 1, 1.6, 1.6); fs(ctx, Math.floor(t * 6 + i) % 2 ? '#ffe066' : '#ff5e7e'); }
        break;
      }
      case 'pet_scarab': {
        // golden flying scarab with shimmering wing cases
        const f = Math.sin(t * 28) * 0.5;
        ell(ctx, -5, -9, 8, 3.5, -0.6 + f); fs(ctx, 'rgba(220,245,255,0.8)'); ell(ctx, 5, -9, 8, 3.5, 0.6 - f); fs(ctx, 'rgba(220,245,255,0.8)');
        ell(ctx, 0, 0, 10, 9); fs(ctx, '#ffd23f', '#b8861c', 1.8);
        ctx.strokeStyle = '#b8861c'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, 8); ctx.stroke();
        ell(ctx, -4, -3, 2.5, 2, -0.5); fs(ctx, 'rgba(255,255,255,0.7)');
        ell(ctx, 8, -6, 5, 4.5); fs(ctx, '#4fd1c5', '#2a8a80', 1.5);
        ell(ctx, 10, -7, 1.4, 1.6); fs(ctx, '#222');
        const gl = 0.4 + 0.3 * Math.sin(t * 4);
        starPath(ctx, -10, -12, 3, 1.2, 4, t); fs(ctx, 'rgba(255,250,200,' + gl + ')');
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
      const sz = { slime: [36, 26], bee: [32, 30], hedgehog: [36, 26], snowball: [34, 34], fish: [36, 26], jelly: [30, 34], urchin: [30, 30], shroom: [36, 34], bat: [34, 28], cloudy: [40, 30], firejelly: [30, 34], plant: [34, 46], ball: [30, 30], robot: [34, 38], alien: [34, 32], ufo: [46, 30], scorpion: [40, 28], cactus: [32, 40], vulture: [46, 32] }[id];
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
      case 'gold': starPath(ctx, p.x, p.y, s * 1.1, s * 0.3, 4, p.rot); fs(ctx, '#ffd23f', '#b8861c', 0.8); ell(ctx, p.x + s, p.y - s * 0.6, s * 0.3, s * 0.3); fs(ctx, '#fff6c9'); break;
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
    } else if (code === 'B') {
      // brick: world-coloured bricks in two offset rows with mortar between
      const col = p.block, mortar = U.shade(p.blockDark, -0.35);
      g.fillStyle = mortar; g.fillRect(0, 0, T, T);
      const brickRow = (y, xs) => xs.forEach(([bx, bw]) => {
        U.rr(g, bx + 1.5, y + 1.5, bw - 3, 21, 3); g.fillStyle = col; g.fill();
        g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(bx + 4, y + 3.5, bw - 9, 3);
        g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(bx + 3, y + 17, bw - 6, 4);
      });
      g.save(); g.beginPath(); g.rect(0, 0, T, T); g.clip();
      brickRow(0, [[0, 24], [24, 24]]);
      brickRow(24, [[-12, 24], [12, 24], [36, 24]]);
      g.restore();
      g.strokeStyle = mortar; g.lineWidth = 2; g.strokeRect(1, 1, T - 2, T - 2);
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
      case 'plant': {
        // "Kłapacz": a snapping flower on a stem, with friendly eyes
        const hh = e.h, bite = Math.abs(Math.sin(tt * 7)) * 0.5;
        ctx.strokeStyle = '#3f9a2a'; ctx.lineWidth = 7; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, 6); ctx.quadraticCurveTo(4, -hh * 0.4, 0, -hh + 22); ctx.stroke();
        ell(ctx, -9, -hh * 0.35, 9, 4.5, -0.5); fs(ctx, '#7ed957', '#3f9a2a', 1.5);
        ell(ctx, 9, -hh * 0.5, 9, 4.5, 0.5); fs(ctx, '#7ed957', '#3f9a2a', 1.5);
        const hy = -hh + 16, headCol = world.id === 4 ? '#ff7a9a' : world.id === 2 ? '#8fd3ff' : world.id === 3 ? '#ffb347' : '#ff5e7e';
        // lower jaw
        ctx.save(); ctx.translate(0, hy); ctx.rotate(bite * 0.6);
        ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI); ctx.closePath(); fs(ctx, headCol, U.shade(headCol, -0.4), 2);
        for (let i = -2; i <= 2; i++) { tri(ctx, i * 5.5 - 2.5, 0, i * 5.5 + 2.5, 0, i * 5.5, -4); fs(ctx, '#fff'); }
        ctx.restore();
        // upper jaw with spots and eyes
        ctx.save(); ctx.translate(0, hy); ctx.rotate(-bite * 0.6);
        ctx.beginPath(); ctx.arc(0, 0, 16, Math.PI, 0); ctx.closePath(); fs(ctx, headCol, U.shade(headCol, -0.4), 2);
        for (let i = -2; i <= 2; i++) { tri(ctx, i * 5.5 - 2.5, 0, i * 5.5 + 2.5, 0, i * 5.5, 4); fs(ctx, '#fff'); }
        ell(ctx, -9, -8, 2.5, 2.5); fs(ctx, 'rgba(255,255,255,0.8)'); ell(ctx, 8, -11, 2, 2); fs(ctx, 'rgba(255,255,255,0.8)');
        ell(ctx, -4, -10, 3.2, 4); fs(ctx, '#fff', '#333', 1); ell(ctx, 4, -10, 3.2, 4); fs(ctx, '#fff', '#333', 1);
        ell(ctx, -3.5, -9.5, 1.6, 2); fs(ctx, '#222'); ell(ctx, 4.5, -9.5, 1.6, 2); fs(ctx, '#222');
        ctx.restore();
        break;
      }
      case 'ball': {
        // cannonball with a puff trail and cross little eyebrows
        for (let i = 1; i <= 3; i++) { ell(ctx, -12 - i * 9, -15 + Math.sin(tt * 20 + i) * 2, 6 - i, 6 - i); fs(ctx, 'rgba(230,230,240,' + (0.7 - i * 0.18) + ')'); }
        ell(ctx, 0, -15, 15, 15); fs(ctx, '#3b3550', '#1a1626', 2);
        ell(ctx, -5, -21, 5, 3.5, -0.6); fs(ctx, 'rgba(255,255,255,0.35)');
        ell(ctx, 4, -16, 3, 3.6); fs(ctx, '#fff'); ell(ctx, 10, -16, 3, 3.6); fs(ctx, '#fff');
        ell(ctx, 5, -15.5, 1.5, 2); fs(ctx, '#222'); ell(ctx, 11, -15.5, 1.5, 2); fs(ctx, '#222');
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(1, -22); ctx.lineTo(7, -20); ctx.moveTo(13, -22); ctx.lineTo(8, -20); ctx.stroke();
        break;
      }
      case 'robot': {
        // wind-up toy robot: boxy body, turning key on its back, stepping feet
        const step = Math.sin(tt * 12) * 3;
        U.rr(ctx, -12, -10 + Math.max(0, step) * -0.3, 9, 10, 3); fs(ctx, '#6b7489'); U.rr(ctx, 3, -10 + Math.max(0, -step) * -0.3, 9, 10, 3); fs(ctx, '#6b7489');
        U.rr(ctx, -15, -34, 30, 26, 7); fs(ctx, '#ff85b0', '#b8467a', 2);
        U.rr(ctx, -9, -28, 18, 11, 4); fs(ctx, '#2d2a3a');
        ell(ctx, -4, -22.5, 2.6, 2.6); fs(ctx, '#7be08a'); ell(ctx, 4, -22.5, 2.6, 2.6); fs(ctx, '#7be08a');
        ctx.strokeStyle = '#6b7489'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(0, -40); ctx.stroke(); ell(ctx, 0, -41, 3, 3); fs(ctx, '#ffe066');
        ctx.save(); ctx.translate(-17, -22); ctx.rotate(tt * 6); ctx.fillStyle = '#ffd23f'; ctx.fillRect(-1.5, -7, 3, 14); ctx.fillRect(-7, -1.5, 14, 3); ctx.restore();
        break;
      }
      case 'alien': {
        // little green alien with one big eye and wobbly antennae
        const b2 = Math.sin(tt * 6) * 1.5;
        ctx.strokeStyle = '#4fb52b'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-6, -26); ctx.quadraticCurveTo(-10 + b2, -34, -12, -37); ctx.moveTo(6, -26); ctx.quadraticCurveTo(10 - b2, -34, 12, -37); ctx.stroke();
        ell(ctx, -12, -38, 3, 3); fs(ctx, '#ff85c8'); ell(ctx, 12, -38, 3, 3); fs(ctx, '#ff85c8');
        ctx.beginPath(); ctx.moveTo(-16, 0); ctx.bezierCurveTo(-18, -30, 18, -30, 16, 0); ctx.closePath(); fs(ctx, '#7ed957', '#3f8a2a', 2);
        ell(ctx, 2, -15, 8, 8); fs(ctx, '#fff', '#333', 1.2); ell(ctx, 4, -15, 4, 4.5); fs(ctx, '#222'); ell(ctx, 5.5, -17, 1.4, 1.4); fs(ctx, '#fff');
        ctx.strokeStyle = '#2d3a1a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(2, -5, 3, 0.2, Math.PI - 0.2); ctx.stroke();
        break;
      }
      case 'ufo': {
        // flying saucer with a tiny pilot and blinking lights
        ell(ctx, 0, -18, 10, 9); fs(ctx, 'rgba(180,230,255,0.7)', '#5a8ab0', 1.5);
        ell(ctx, 0, -18, 4, 4); fs(ctx, '#7ed957'); ell(ctx, 1, -19, 1.3, 1.3); fs(ctx, '#222');
        ell(ctx, 0, -11, 23, 7); fs(ctx, '#b8c0d0', '#5a6388', 2);
        for (let i = -2; i <= 2; i++) { ell(ctx, i * 8, -10, 2.2, 2.2); fs(ctx, Math.floor(tt * 6 + i) % 2 ? '#ffe066' : '#ff5e7e'); }
        break;
      }
      case 'scorpion': {
        // round little desert scorpion: curly tail with a heart-shaped tip, snapping claws
        const st = Math.sin(tt * 14) * 2, cl = Math.abs(Math.sin(tt * 4)) * 0.4;
        for (let i = 0; i < 3; i++) { ctx.strokeStyle = '#a3542a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-8 + i * 7, -6); ctx.lineTo(-12 + i * 7 + (i % 2 ? st : -st), 0); ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(-14, -12); ctx.bezierCurveTo(-30, -14, -30, -38, -14, -38); ctx.strokeStyle = '#a3542a'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.stroke(); ctx.strokeStyle = '#ff8a3d'; ctx.lineWidth = 5.5; ctx.stroke();
        heartPath(ctx, -12, -40, 8); fs(ctx, '#ff5e7e', '#a3223f', 1.5);
        ell(ctx, 0, -11, 15, 9); fs(ctx, '#ff8a3d', '#a3542a', 2);
        ctx.save(); ctx.translate(16, -12); ctx.rotate(-0.3);
        ell(ctx, 4, 0, 6, 5); fs(ctx, '#ff8a3d', '#a3542a', 1.8);
        tri(ctx, 8, -1, 14, -4 - cl * 8, 14, 2); fs(ctx, '#ffa94d', '#a3542a', 1.2); tri(ctx, 8, 1, 14, 5 + cl * 8, 14, 1); fs(ctx, '#ffa94d', '#a3542a', 1.2);
        ctx.restore();
        eyes(1, -16, 0.6);
        break;
      }
      case 'cactus': {
        // walking cactus with a flower on top: spiky, so it can't be stomped
        const step = Math.sin(tt * 8) * 2;
        ell(ctx, -6, -2 - Math.max(0, step), 5, 3); fs(ctx, '#3f8a2a'); ell(ctx, 6, -2 - Math.max(0, -step), 5, 3); fs(ctx, '#3f8a2a');
        U.rr(ctx, -12, -38, 24, 36, 12); fs(ctx, '#5cc15a', '#2f7a2a', 2);
        U.rr(ctx, -21, -26, 9, 14, 4.5); fs(ctx, '#5cc15a', '#2f7a2a', 2); U.rr(ctx, 12, -32, 9, 14, 4.5); fs(ctx, '#5cc15a', '#2f7a2a', 2);
        ctx.strokeStyle = '#fffbe0'; ctx.lineWidth = 1.4;
        for (const [sx, sy] of [[-8, -30], [8, -26], [-6, -12], [7, -10], [0, -20], [-18, -22], [18, -28]]) { ctx.beginPath(); ctx.moveTo(sx - 3, sy); ctx.lineTo(sx + 3, sy); ctx.moveTo(sx, sy - 3); ctx.lineTo(sx, sy + 3); ctx.stroke(); }
        for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + tt; ell(ctx, Math.cos(a) * 4, -40 + Math.sin(a) * 4, 3.5, 3.5); fs(ctx, '#ff85c8'); }
        ell(ctx, 0, -40, 2.5, 2.5); fs(ctx, '#ffe066');
        eyes(-5, -24, 0.6);
        break;
      }
      case 'vulture': {
        // friendly-looking desert bird gliding in circles
        const fl = Math.sin(tt * 7) * 0.5;
        ctx.save(); ctx.translate(-4, -18); ctx.rotate(-0.4 - fl); ell(ctx, -12, 0, 16, 6); fs(ctx, '#8a6a50', '#4a3222', 1.8); ctx.restore();
        ell(ctx, 0, -14, 15, 11); fs(ctx, '#a8866a', '#4a3222', 2);
        ell(ctx, 2, -10, 8, 6); fs(ctx, '#f3e1d2');
        ctx.save(); ctx.translate(4, -18); ctx.rotate(0.4 + fl); ell(ctx, 12, 0, 16, 6); fs(ctx, '#8a6a50', '#4a3222', 1.8); ctx.restore();
        ell(ctx, 14, -24, 8, 7.5); fs(ctx, '#ffb3a7', '#a8594a', 1.8);
        ell(ctx, 10, -18, 7, 3); fs(ctx, '#fff');
        tri(ctx, 20, -25, 28, -21, 20, -19); fs(ctx, '#ffd23f', '#b8861c', 1.2);
        ell(ctx, 16, -26, 1.8, 2.2); fs(ctx, '#222');
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
      case 'gearbot': {
        // Robot Zębatek: big toy robot with a spinning gear in its chest
        ctx.fillStyle = '#6b7489'; U.rr(ctx, -40, -26, 26, 26, 6); ctx.fill(); U.rr(ctx, 14, -26, 26, 26, 6); ctx.fill();
        U.rr(ctx, -50, -100, 100, 78, 14); fs(ctx, '#9aa3b5', '#4a5268', 4);
        drawGear(ctx, 0, -62, 20, t * 3, '#ffd23f');
        U.rr(ctx, -34, -150, 68, 48, 12); fs(ctx, '#b8c0d0', '#4a5268', 4);
        U.rr(ctx, -26, -142, 52, 30, 8); fs(ctx, '#2d2a3a');
        ctx.strokeStyle = '#4a5268'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(0, -150); ctx.lineTo(0, -166); ctx.stroke(); ell(ctx, 0, -168, 6, 6); fs(ctx, Math.floor(t * 4) % 2 ? '#ff5e7e' : '#ffe066');
        const mood2 = b.flash > 0 ? 'hurt' : b.phase === 'attack' ? 'angry' : 'smug';
        ell(ctx, -12 + (b.look || 0) * 3, -128, 6, 6); fs(ctx, mood2 === 'angry' ? '#ff5e7e' : '#7be08a'); ell(ctx, 12 + (b.look || 0) * 3, -128, 6, 6); fs(ctx, mood2 === 'angry' ? '#ff5e7e' : '#7be08a');
        ctx.strokeStyle = '#7be08a'; ctx.lineWidth = 3; ctx.beginPath(); if (mood2 === 'hurt') ctx.arc(0, -114, 5, 0, Math.PI * 2); else ctx.arc(0, -120, 8, 0.3, Math.PI - 0.3); ctx.stroke();
        ctx.strokeStyle = '#6b7489'; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-50, -86); ctx.lineTo(-68, -60 + Math.sin(t * 5) * 8); ctx.moveTo(50, -86); ctx.lineTo(70, -70 - Math.sin(t * 5) * 10); ctx.stroke();
        break;
      }
      case 'sphinx': {
        // Sfinks Mruczek: a big sandy cat-sphinx in a striped headdress; it
        // crouches and jumps (squash) to send shock waves through the sand
        const sq = b.squash || 0;
        ctx.scale(1 + sq * 0.25, 1 - sq * 0.25);
        const tw = Math.sin(t * 3) * 0.2;
        ctx.save(); ctx.translate(-50, -30); ctx.rotate(-0.4 + tw);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-30, -10, -26, -46); ctx.strokeStyle = '#b8861c'; ctx.lineWidth = 14; ctx.lineCap = 'round'; ctx.stroke(); ctx.strokeStyle = '#f2c46b'; ctx.lineWidth = 9; ctx.stroke();
        ctx.restore();
        ell(ctx, -6, -34, 56, 34); fs(ctx, '#f2c46b', '#a8751c', 4);
        ell(ctx, 30, -6, 22, 10); fs(ctx, '#f2c46b', '#a8751c', 3); ell(ctx, -36, -6, 20, 10); fs(ctx, '#f2c46b', '#a8751c', 3);
        // headdress behind the head
        ctx.beginPath(); ctx.moveTo(-46, -80); ctx.quadraticCurveTo(0, -150, 46, -80); ctx.lineTo(52, -34); ctx.lineTo(30, -34); ctx.lineTo(28, -70); ctx.lineTo(-28, -70); ctx.lineTo(-30, -34); ctx.lineTo(-52, -34); ctx.closePath();
        fs(ctx, '#ffd23f', '#b8861c', 4);
        ctx.save(); ctx.clip(); ctx.strokeStyle = '#2a9fd6'; ctx.lineWidth = 7; for (let k = -150; k < -20; k += 16) { ctx.beginPath(); ctx.moveTo(-60, k); ctx.lineTo(60, k - 8); ctx.stroke(); } ctx.restore();
        // cat head with ears
        tri(ctx, -30, -96, -24, -128, -8, -104); fs(ctx, '#f2c46b', '#a8751c', 3); tri(ctx, 8, -104, 24, -128, 30, -96); fs(ctx, '#f2c46b', '#a8751c', 3);
        ell(ctx, 0, -84, 34, 30); fs(ctx, '#f2c46b', '#a8751c', 4);
        U.rr(ctx, -30, -112, 60, 9, 4); fs(ctx, '#2a9fd6', '#155f86', 2);
        ell(ctx, 0, -118, 7, 8); fs(ctx, '#ff5e7e', '#a3223f', 2);
        face(0, -86, mood);
        ctx.strokeStyle = 'rgba(90,50,20,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(24, -74); ctx.lineTo(44, -78); ctx.moveTo(24, -70); ctx.lineTo(44, -68); ctx.moveTo(-24, -74); ctx.lineTo(-44, -78); ctx.stroke();
        break;
      }
      case 'comet': {
        // Królowa Komet: a round icy comet with a sparkly tail and a crown
        for (let i = 6; i >= 1; i--) { ell(ctx, -30 - i * 14, -70 + Math.sin(t * 3 + i) * 4, 34 - i * 4, 30 - i * 4); ctx.fillStyle = 'rgba(143,211,255,' + (0.12 + (6 - i) * 0.05) + ')'; ctx.fill(); }
        for (let i = 0; i < 6; i++) { starPath(ctx, -40 - i * 16, -70 + Math.sin(t * 4 + i) * 16, 5, 2, 4, t + i); fs(ctx, '#fff6c9'); }
        ell(ctx, 0, -66, 56, 56); fs(ctx, '#bfe8ff', '#4a8ab8', 4);
        ell(ctx, -18, -90, 12, 8, -0.5); fs(ctx, 'rgba(255,255,255,0.7)');
        ell(ctx, 22, -44, 9, 6); fs(ctx, 'rgba(74,138,184,0.25)'); ell(ctx, -26, -40, 6, 4); fs(ctx, 'rgba(74,138,184,0.25)');
        face(0, -64, mood);
        ctx.beginPath(); ctx.moveTo(-26, -112); ctx.lineTo(-30, -134); ctx.lineTo(-14, -122); ctx.lineTo(0, -140); ctx.lineTo(14, -122); ctx.lineTo(30, -134); ctx.lineTo(26, -112); ctx.closePath(); fs(ctx, '#ffe066', '#c99a12', 3);
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
    const key = world.id + (world.night ? 'n' : '') + which + Math.round(viewH);
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
    if (world.id === 7 && which === 'far') {
      // toy factory skyline: building-block towers with chimneys puffing candy smoke
      const cols7 = ['#ffb3d9', '#b3e0ff', '#ffe8a3', '#c9b8ff'];
      for (let i = 0; i < 10; i++) {
        const cx = i * BG_W / 10 + r() * 60, w = 110 + r() * 70, h = 110 + r() * 110;
        [cx, cx - BG_W, cx + BG_W].forEach(x => {
          g.fillStyle = cols7[i % 4]; U.rr(g, x, H - h, w, h + 10, 10); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.45)';
          for (let wy = H - h + 18; wy < H - 30; wy += 34) for (let wx = x + 14; wx < x + w - 20; wx += 30) { U.rr(g, wx, wy, 16, 18, 4); g.fill(); }
          if (i % 2 === 0) { g.fillStyle = U.shade(cols7[i % 4], -0.15); g.fillRect(x + w * 0.6, H - h - 50, 22, 52); for (let k = 0; k < 3; k++) { ell(g, x + w * 0.6 + 11 + k * 14, H - h - 62 - k * 18, 14 + k * 4, 11 + k * 3); g.fillStyle = 'rgba(255,255,255,0.8)'; g.fill(); } }
        });
      }
      return finish();
    }
    if (world.id === 8 && which === 'far') {
      // distant moons and small planets
      for (let i = 0; i < 6; i++) {
        const cx = i * BG_W / 6 + r() * 150, cy = H * 0.3 + r() * H * 0.3, rad = 18 + r() * 34;
        [cx, cx - BG_W, cx + BG_W].forEach(x => {
          ell(g, x, cy, rad, rad); g.fillStyle = ['#5a4aa0', '#3a6aa0', '#7a4a8a'][i % 3]; g.fill();
          ell(g, x - rad * 0.3, cy - rad * 0.2, rad * 0.25, rad * 0.2); g.fillStyle = 'rgba(0,0,0,0.18)'; g.fill();
          ell(g, x + rad * 0.3, cy + rad * 0.35, rad * 0.18, rad * 0.14); g.fillStyle = 'rgba(0,0,0,0.18)'; g.fill();
        });
      }
      return finish();
    }
    if (world.id === 9 && which === 'far') {
      // pyramids on the horizon, one with a golden tip
      for (let i = 0; i < 5; i++) {
        const cx = i * BG_W / 5 + 80 + r() * 180, h = 120 + r() * 110;
        [cx, cx - BG_W, cx + BG_W].forEach(x => {
          tri(g, x - h * 1.1, H, x, H - h, x + h * 1.1, H); g.fillStyle = p.far; g.fill();
          tri(g, x, H - h, x + h * 1.1, H, x + h * 0.25, H); g.fillStyle = 'rgba(160,90,30,0.18)'; g.fill();
          if (i % 2 === 0) { tri(g, x - 14, H - h + 13, x, H - h, x + 14, H - h + 13); g.fillStyle = '#ffe066'; g.fill(); }
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
    } else if (id === 7) {
      // stacks of toy building blocks with letters/numbers
      const n = 2 + Math.floor(r() * 3), cols7 = ['#ff6fae', '#5ccfff', '#ffd23f', '#7be08a', '#9d7bff'];
      for (let k = 0; k < n; k++) { const c = cols7[(k + Math.floor(r() * 5)) % 5]; U.rr(g, x - 16 + (k % 2) * 6, y - 30 - k * 30, 32, 30, 5); g.fillStyle = c; g.fill(); g.fillStyle = 'rgba(255,255,255,0.85)'; g.font = '800 18px "Baloo 2", sans-serif'; g.textAlign = 'center'; g.fillText(String(1 + Math.floor(r() * 9)), x + (k % 2) * 6, y - 9 - k * 30); }
    } else if (id === 8) {
      // glowing crystals and a little antenna
      if (r() < 0.6) { for (let k = 0; k < 3; k++) { const hh = 22 + k * 10; g.beginPath(); g.moveTo(x + k * 10 - 6, y); g.lineTo(x + k * 10, y - hh); g.lineTo(x + k * 10 + 6, y); g.closePath(); g.fillStyle = ['#5ccfff', '#ff85c8', '#ffe066'][k]; g.fill(); } }
      else { g.strokeStyle = '#c9b8ff'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 46); g.stroke(); ell(g, x, y - 50, 6, 6); g.fillStyle = '#ff5e7e'; g.fill(); }
    } else if (id === 9) {
      if (r() < 0.55) {   // saguaro cactus
        const h = 50 + r() * 30;
        g.fillStyle = '#5cc15a'; U.rr(g, x - 8, y - h, 16, h + 4, 8); g.fill();
        U.rr(g, x - 22, y - h * 0.7, 9, h * 0.35, 4.5); g.fill(); g.fillRect(x - 16, y - h * 0.42, 10, 7);
        U.rr(g, x + 13, y - h * 0.85, 9, h * 0.4, 4.5); g.fill(); g.fillRect(x + 6, y - h * 0.5, 10, 7);
        if (r() < 0.5) { ell(g, x, y - h - 2, 5, 5); g.fillStyle = '#ff85c8'; g.fill(); }
      } else {            // palm tree
        g.strokeStyle = '#b8894a'; g.lineWidth = 7; g.lineCap = 'round';
        g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 10, y - 40, x + 4, y - 80); g.stroke();
        g.fillStyle = '#4fb56a';
        for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * 0.6; g.beginPath(); g.ellipse(x + 4 + Math.cos(a) * 20, y - 80 + Math.sin(a) * 12 + 8, 24, 7, a, 0, TAU); g.fill(); }
        ell(g, x + 1, y - 76, 4, 4); g.fillStyle = '#8a5a32'; g.fill(); ell(g, x + 8, y - 75, 4, 4); g.fill();
      }
    } else if (id === 6) {
      g.strokeStyle = '#fff'; g.lineWidth = 8; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 50); g.arc(x + 12, y - 50, 12, Math.PI, 0); g.stroke();
      g.strokeStyle = '#ff5e7e'; g.lineWidth = 8; g.setLineDash([6, 8]); g.stroke(); g.setLineDash([]);
    }
  }

  /* =====================================================================
   * TREE STUMPS (Liczbolandia's version of Mario's pipes), one style per world
   *   1 sweet-bark stump with pink frosting   2 stump with a snow cap
   *   3 coral tube                            4 mossy log with little mushrooms
   *   5 cloud tower                           6 chocolate chimney
   *   7 (bonus) golden stump
   * Secret stumps glow from inside.
   * ===================================================================== */
  function drawStump(ctx, e, world, t) {
    const x = e.x, y = e.y, w = e.w, b = e.base, id = world.id;
    const cx = x + w / 2, rimY = y + 11;
    const style = {
      1: { body: '#c98a5a', dark: '#8a5a32', rim: '#e0a878' },
      2: { body: '#8a6a50', dark: '#5c4432', rim: '#a8866a' },
      3: { body: '#ff8f7a', dark: '#d9604f', rim: '#ffb3a7' },
      4: { body: '#6b4e3a', dark: '#46321f', rim: '#8a6a50' },
      5: { body: '#f3eaff', dark: '#c9b8f0', rim: '#ffffff' },
      6: { body: '#7a4a2e', dark: '#4a2a18', rim: '#9a6040' },
      7: { body: '#ff5e7e', dark: '#b8234f', rim: '#ffd23f' },
      8: { body: '#9aa3c5', dark: '#5a6388', rim: '#d9e2f0' },
      9: { body: '#e8c07a', dark: '#b8894a', rim: '#fff0c7' },
      99: { body: '#ffcf3f', dark: '#c99a00', rim: '#ffe680' },
    }[id] || { body: '#c98a5a', dark: '#8a5a32', rim: '#e0a878' };
    ctx.save();
    // roots at the base
    if (id !== 5 && id !== 3 && id !== 7 && id !== 8 && id !== 9) { [[-1, 0.18], [1, 0.82]].forEach(([d, f]) => { ell(ctx, x + w * f + d * 8, b - 5, 13, 7, d * 0.4); fs(ctx, style.body, style.dark, 2.5); }); }
    // trunk (slightly narrower than the rim)
    U.rr(ctx, x + 6, rimY, w - 12, b - rimY, 6); fs(ctx, style.body, style.dark, 3);
    // body texture
    ctx.save(); U.rr(ctx, x + 6, rimY, w - 12, b - rimY, 6); ctx.clip();
    if (id === 3) {             // coral bumps
      for (let yy = rimY + 14; yy < b; yy += 18) for (let xx = x + 16 + ((yy / 18) % 2) * 12; xx < x + w - 10; xx += 24) { ell(ctx, xx, yy, 6, 5); fs(ctx, 'rgba(255,255,255,0.28)'); }
    } else if (id === 5) {      // tower bricks + a little arched window
      ctx.strokeStyle = 'rgba(150,120,210,0.35)'; ctx.lineWidth = 2;
      for (let yy = rimY + 16; yy < b; yy += 16) { ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke(); }
      if (b - rimY > 70) { U.rr(ctx, cx - 8, rimY + 26, 16, 22, 8); fs(ctx, '#8f7bd6'); }
    } else {                    // bark lines
      ctx.strokeStyle = style.dark; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      for (const fx of [0.3, 0.52, 0.74]) { ctx.beginPath(); ctx.moveTo(x + w * fx, rimY + 14); for (let yy = rimY + 14; yy < b; yy += 12) ctx.lineTo(x + w * fx + Math.sin(yy * 0.2 + fx * 9) * 3, yy); ctx.stroke(); }
    }
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(x + w - 22, rimY, 16, b - rimY);
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x + 12, rimY, 8, b - rimY);
    ctx.restore();
    // rim and hole
    ell(ctx, cx, rimY, w / 2, 12); fs(ctx, style.rim, style.dark, 3);
    ell(ctx, cx, rimY + 1, w / 2 - 11, 7); fs(ctx, e.secret || e.roomExit ? '#3a2410' : U.shade(style.dark, -0.45));
    if (e.secret || e.roomExit) {
      const gl = 0.55 + 0.45 * Math.sin(t * 4);
      const g = ctx.createRadialGradient(cx, rimY, 2, cx, rimY, w / 2);
      g.addColorStop(0, 'rgba(255,240,140,' + gl + ')'); g.addColorStop(1, 'rgba(255,240,140,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 10, rimY - 40, w + 20, 60);
      for (let i = 0; i < 3; i++) { const a = t * 2 + i * 2.1; starPath(ctx, cx + Math.cos(a) * 30, rimY - 14 + Math.sin(a * 1.3) * 8, 5, 1.8, 4, a); fs(ctx, '#fff6c9'); }
    }
    // world decorations on the rim
    if (id === 1) {             // pink frosting drips + sprinkles
      ctx.beginPath(); ctx.moveTo(x, rimY);
      for (let i = 0; i <= 6; i++) { const xx = x + (w * i) / 6; ctx.quadraticCurveTo(xx - w / 12, rimY + (i % 2 ? 22 : 12), xx, rimY + 6); }
      ctx.lineTo(x + w, rimY - 4); ctx.ellipse(cx, rimY, w / 2, 12, 0, 0, Math.PI, true); ctx.closePath();
      ctx.save(); ell(ctx, cx, rimY + 1, w / 2 - 11, 7); ctx.rect(x - 20, rimY - 30, w + 40, 80); ctx.clip('evenodd');
      ctx.beginPath(); ctx.moveTo(x - 1, rimY);
      for (let i = 0; i <= 6; i++) { const xx = x + (w * i) / 6; ctx.quadraticCurveTo(xx - w / 12, rimY + (i % 2 ? 24 : 13), xx, rimY + 7); }
      ctx.lineTo(x + w + 1, rimY); ctx.ellipse(cx, rimY, w / 2 + 1, 13, 0, 0, Math.PI, true); ctx.closePath();
      fs(ctx, '#ff9ecf', '#d9458a', 2);
      ctx.restore();
      ['#ffe066', '#5ccfff', '#7be08a', '#fff'].forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(x + 12 + i * 20, rimY + 10 + (i % 2) * 4, 5, 2.5); });
    } else if (id === 2) {      // snow cap + icicles
      ell(ctx, cx, rimY - 3, w / 2 + 3, 8); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.save(); ell(ctx, cx, rimY + 1, w / 2 - 11, 7); ctx.fillStyle = U.shade(style.dark, -0.45); ctx.fill(); ctx.restore();
      for (let i = 0; i < 5; i++) { tri(ctx, x + 10 + i * 19, rimY + 8, x + 18 + i * 19, rimY + 8, x + 14 + i * 19, rimY + 20 + (i % 2) * 6); fs(ctx, '#d8f4ff'); }
    } else if (id === 4) {      // moss + little mushrooms
      ell(ctx, x + 18, rimY + 10, 14, 6); fs(ctx, '#7be08a'); ell(ctx, x + w - 22, rimY + 8, 10, 5); fs(ctx, '#7be08a');
      const my = Math.min(b - 20, rimY + 40);
      ctx.fillStyle = '#fff3e0'; ctx.fillRect(x + w - 10, my, 4, 8); ctx.beginPath(); ctx.ellipse(x + w - 8, my, 8, 6, 0, Math.PI, 0); fs(ctx, '#ff6b6b');
      ctx.fillStyle = '#fff3e0'; ctx.fillRect(x + w - 2, my + 8, 3, 6); ctx.beginPath(); ctx.ellipse(x + w - 0.5, my + 8, 6, 4.5, 0, Math.PI, 0); fs(ctx, '#ff6b6b');
    } else if (id === 5) {      // cloud puffs around the rim
      for (let i = 0; i < 5; i++) { ell(ctx, x + 6 + i * 21, rimY + 6 + (i % 2) * 3, 13, 9); ctx.fillStyle = '#fff'; ctx.fill(); }
      ell(ctx, cx, rimY + 1, w / 2 - 11, 7); ctx.fillStyle = e.secret || e.roomExit ? '#3a2410' : '#6a5a9a'; ctx.fill();
    } else if (id === 6) {      // chocolate chimney with pink icing drips
      for (let i = 0; i < 4; i++) { U.rr(ctx, x + 12 + i * 22, rimY + 4, 8, 14 + (i % 2) * 10, 4); fs(ctx, '#ff9ecf'); }
      ell(ctx, cx, rimY, w / 2, 12); ctx.strokeStyle = '#ff9ecf'; ctx.lineWidth = 4; ctx.stroke();
    } else if (id === 7) {      // toy drum: white zig-zag band and gold studs
      ctx.save(); U.rr(ctx, x + 6, rimY, w - 12, b - rimY, 6); ctx.clip();
      ctx.beginPath(); const zy = rimY + (b - rimY) * 0.45; ctx.moveTo(x, zy);
      for (let i = 0; i <= 8; i++) ctx.lineTo(x + 6 + i * (w - 12) / 8, zy + (i % 2 ? -14 : 14));
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.stroke(); ctx.restore();
      for (let i = 0; i < 4; i++) { ell(ctx, x + 16 + i * 21, rimY + 16, 3.5, 3.5); fs(ctx, '#ffe066'); }
    } else if (id === 8) {      // space tube: glowing light strip
      const gl = 0.5 + 0.5 * Math.sin(t * 3);
      U.rr(ctx, cx - 4, rimY + 14, 8, b - rimY - 22, 4); fs(ctx, 'rgba(92,207,255,' + (0.5 + gl * 0.5) + ')');
      for (let yy = rimY + 20; yy < b - 10; yy += 22) { ell(ctx, x + 14, yy, 3, 3); fs(ctx, '#5a6388'); ell(ctx, x + w - 14, yy, 3, 3); fs(ctx, '#5a6388'); }
    } else if (id === 9) {      // sandstone column: turquoise bands and a little sun sign
      ctx.save(); U.rr(ctx, x + 6, rimY, w - 12, b - rimY, 6); ctx.clip();
      ctx.fillStyle = '#4fd1c5'; ctx.fillRect(x, rimY + 14, w, 7); ctx.fillRect(x, b - 18, w, 7);
      ctx.restore();
      if (b - rimY > 70) { ell(ctx, cx, rimY + 44, 8, 8); fs(ctx, '#ffd23f', '#b8861c', 1.5); }
    } else if (id === 99) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(x + 14, rimY + 14, 5, b - rimY - 22);
    }
    ctx.restore();
  }

  /* Cannon on a stone pedestal; the barrel turns toward the player and kicks back when firing. */
  function drawCannon(ctx, e, t) {
    const x = e.x, y = e.y, b = e.y + e.h, cx = x + T / 2;
    U.rr(ctx, x + 4, y + 22, T - 8, b - y - 22, 6); fs(ctx, '#7a7090', '#3b3550', 2.5);
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(x + 9, y + 26, 5, b - y - 32);
    ctx.save(); ctx.translate(cx, y + 18); ctx.scale(e.face, 1); ctx.translate(-e.recoil * 6, 0);
    U.rr(ctx, -20, -13, 42, 26, 12); fs(ctx, '#4a4560', '#1f1b2e', 2.5);
    ell(ctx, 22, 0, 6, 13); fs(ctx, '#2a2538', '#1f1b2e', 2);
    ell(ctx, 22, 0, 3, 8); fs(ctx, '#111');
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(8, -13, 4, 26);
    ell(ctx, -6, -4, 3, 3.6); fs(ctx, '#fff'); ell(ctx, 2, -4, 3, 3.6); fs(ctx, '#fff');
    ell(ctx, -5, -3.5, 1.5, 2); fs(ctx, '#222'); ell(ctx, 3, -3.5, 1.5, 2); fs(ctx, '#222');
    ctx.restore();
    ell(ctx, cx - 10, y + 30, 7, 7); fs(ctx, '#5a5370', '#1f1b2e', 2);
  }

  /*
   * Night version of a world (the hard levels): same world, same tiles, but
   * a dark sky and dimmed hills. Only the background colours change, so the
   * ground stays easy to read.
   */
  const nightCache = new Map();
  function nightWorld(world) {
    if (nightCache.has(world.id)) return nightCache.get(world.id);
    const p = world.pal;
    const nw = Object.assign({}, world, { night: true, pal: Object.assign({}, p, { skyTop: '#120e38', skyBot: U.shade(p.skyBot, -0.6), far: U.shade(p.far, -0.5), mid: U.shade(p.mid, -0.45) }) });
    nightCache.set(world.id, nw); return nw;
  }

  /* Quicksand, drawn in front of the player: the surface sits a few pixels
     below the tile top and ripples, so she looks like she's wading in it. */
  function drawQuicksand(ctx, x, y, t, leftEnd, rightEnd) {
    const top = y + 6;
    ctx.beginPath(); ctx.moveTo(x - 0.5, y + T + 0.5);
    ctx.lineTo(x - 0.5, top + Math.sin(t * 2 + x * 0.05) * 1.5);
    for (let k = 1; k <= 6; k++) { const xx = x + (T * k) / 6; ctx.lineTo(xx + (k === 6 ? 0.5 : 0), top + Math.sin(t * 2 + xx * 0.05) * 1.5); }
    ctx.lineTo(x + T + 0.5, y + T + 0.5); ctx.closePath();
    // darker, wetter orange-brown than the dry dunes, so a pool reads as "different ground"
    ctx.fillStyle = '#c98642'; ctx.fill();
    ctx.fillStyle = 'rgba(120,70,20,0.25)';
    for (let k = 0; k < 5; k++) { ell(ctx, x + 6 + ((k * 19) % 40), top + 12 + ((k * 13) % 26), 2.2, 1.6); ctx.fill(); }
    // swirls turning slowly, like the sand is being sucked down
    ctx.strokeStyle = 'rgba(255,220,160,0.55)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    for (let k = 0; k < 2; k++) { const cx = x + 12 + k * 24, cy = top + 14 + k * 12; ctx.beginPath(); ctx.arc(cx, cy, 5 + k * 2, t * 1.5 + k, t * 1.5 + k + 3.5); ctx.stroke(); }
    // a bubble now and then pops at the surface
    const bp = (t * 0.7 + x * 0.013) % 1;
    if (bp < 0.35) { ell(ctx, x + 24 + Math.sin(x) * 10, top + 2, 2 + bp * 10, 1.5 + bp * 6); ctx.strokeStyle = 'rgba(255,230,180,' + (0.8 - bp * 2) + ')'; ctx.lineWidth = 1.5; ctx.stroke(); }
    ctx.fillStyle = 'rgba(255,225,170,0.6)'; ctx.fillRect(x, top + 1, T, 3);
    if (leftEnd) { ctx.fillStyle = 'rgba(170,110,40,0.35)'; ctx.fillRect(x, top, 3, T - 6); }
    if (rightEnd) { ctx.fillStyle = 'rgba(170,110,40,0.35)'; ctx.fillRect(x + T - 3, top, 3, T - 6); }
  }

  /* A toothed gear (toy factory decoration, boss projectile). */
  function drawGear(ctx, x, y, r, rot, col) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.beginPath();
    for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU, rr2 = i % 2 ? r * 0.78 : r; ctx.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); ctx.lineTo(Math.cos(a + TAU / 32) * rr2, Math.sin(a + TAU / 32) * rr2); }
    ctx.closePath(); fs(ctx, col, U.shade(col, -0.4), Math.max(1.5, r * 0.08));
    ell(ctx, 0, 0, r * 0.35, r * 0.35); fs(ctx, U.shade(col, -0.3));
    ctx.restore();
  }
  /* Conveyor belt tile: rollers inside, moving chevrons on top. */
  function drawConveyor(ctx, x, y, dir, t, world, leftEnd, rightEnd) {
    U.rr(ctx, x - (leftEnd ? 0 : 1), y, T + (leftEnd ? 0 : 1) + (rightEnd ? 0 : 1), T, leftEnd || rightEnd ? 10 : 0); fs(ctx, '#4a4560');
    ctx.fillStyle = '#6b7489'; ctx.fillRect(x, y + 2, T, 12);
    // chevrons slide along the belt surface
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, T, 14); ctx.clip();
    const off = ((t * 105 * dir) % 24 + 24) % 24;
    ctx.fillStyle = '#ffd23f';
    for (let k = -1; k < 3; k++) { const cx = x + k * 24 + off; ctx.beginPath(); if (dir > 0) { ctx.moveTo(cx, y + 3); ctx.lineTo(cx + 8, y + 8); ctx.lineTo(cx, y + 13); ctx.lineTo(cx + 5, y + 8); } else { ctx.moveTo(cx + 8, y + 3); ctx.lineTo(cx, y + 8); ctx.lineTo(cx + 8, y + 13); ctx.lineTo(cx + 3, y + 8); } ctx.closePath(); ctx.fill(); }
    ctx.restore();
    for (const rx of [x + 12, x + 36]) { ell(ctx, rx, y + 30, 9, 9); fs(ctx, '#9aa3b5', '#2d2a3a', 2); ctx.save(); ctx.translate(rx, y + 30); ctx.rotate(t * 6 * dir); ctx.fillStyle = '#4a4560'; ctx.fillRect(-1.5, -7, 3, 14); ctx.restore(); }
  }

  /* Underground secret room background: dark cave with glowing crystals. */
  function drawCave(ctx, world, camX, vw, vh, t) {
    const gr = ctx.createLinearGradient(0, 0, 0, vh);
    gr.addColorStop(0, '#2a1f4a'); gr.addColorStop(1, '#120c26');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, vw, vh);
    const cols = [world.pal.accent || '#ff6fae', '#5ccfff', '#ffe066', '#9d7bff'];
    for (let i = 0; i < 14; i++) {
      const x = ((i * 173 - camX * 0.35) % (vw + 200) + vw + 200) % (vw + 200) - 100, y = vh * 0.25 + ((i * 97) % (vh * 0.55));
      const c = cols[i % 4], s = 10 + (i % 3) * 6, glow = 0.35 + 0.25 * Math.sin(t * 2 + i);
      const g = ctx.createRadialGradient(x, y, 1, x, y, s * 2.5); g.addColorStop(0, U.rgba(c.startsWith('#') ? c : '#ffe066', glow)); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(x - s * 2.5, y - s * 2.5, s * 5, s * 5);
      ctx.beginPath(); ctx.moveTo(x, y - s * 1.3); ctx.lineTo(x + s * 0.55, y); ctx.lineTo(x, y + s * 0.7); ctx.lineTo(x - s * 0.55, y); ctx.closePath(); fs(ctx, c, 'rgba(255,255,255,0.6)', 1.5);
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
    const skyKey = world.id + (world.night ? 'n' : '');
    if (cv && cv.__sky !== skyKey) { cv.__sky = skyKey; cv.style.background = 'linear-gradient(' + p.skyTop + ',' + p.skyBot + ')'; }
    ctx.clearRect(0, 0, vw, vh);
    const id = world.id;
    // sun / moon
    if (world.night && id !== 8 && id !== 3) {
      // night version of a world: twinkling stars and a big crescent moon
      for (let i = 0; i < 55; i++) { const sx = ((i * 173 - camX * 0.03) % vw + vw) % vw, sy = (i * 97) % (vh * 0.6); ctx.globalAlpha = 0.45 + 0.55 * Math.sin(t * 2 + i); ell(ctx, sx, sy, i % 6 === 0 ? 2.2 : 1.4, i % 6 === 0 ? 2.2 : 1.4); fs(ctx, '#fff'); }
      ctx.globalAlpha = 1;
      const mg = ctx.createRadialGradient(vw * 0.8, vh * 0.18, 20, vw * 0.8, vh * 0.18, 90); mg.addColorStop(0, 'rgba(255,250,210,0.35)'); mg.addColorStop(1, 'rgba(255,250,210,0)');
      ctx.fillStyle = mg; ctx.fillRect(vw * 0.8 - 90, vh * 0.18 - 90, 180, 180);
      ell(ctx, vw * 0.8, vh * 0.18, 36, 36); fs(ctx, '#fff6c9'); ell(ctx, vw * 0.8 + 14, vh * 0.18 - 8, 30, 30); fs(ctx, p.skyTop);
    } else if (id === 8) {
      // space: starfield and a ringed planet
      for (let i = 0; i < 70; i++) { const sx = ((i * 173 - camX * 0.04) % vw + vw) % vw, sy = (i * 97) % (vh * 0.75); ctx.globalAlpha = 0.45 + 0.55 * Math.sin(t * 2 + i * 1.3); ell(ctx, sx, sy, i % 7 === 0 ? 2.4 : 1.4, i % 7 === 0 ? 2.4 : 1.4); fs(ctx, i % 5 === 0 ? '#ffe066' : '#fff'); }
      ctx.globalAlpha = 1;
      const px = vw * 0.78, py = vh * 0.2;
      ell(ctx, px, py, 42, 42); fs(ctx, '#ff9ecf'); ell(ctx, px - 10, py - 12, 14, 9, -0.4); fs(ctx, 'rgba(255,255,255,0.35)');
      ctx.save(); ctx.translate(px, py); ctx.rotate(-0.35); ell(ctx, 0, 0, 72, 13); ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 5; ctx.stroke(); ctx.restore();
      ell(ctx, vw * 0.18, vh * 0.12, 14, 14); fs(ctx, '#7be08a'); ell(ctx, vw * 0.18 - 4, vh * 0.12 - 4, 4, 3); fs(ctx, 'rgba(255,255,255,0.4)');
    } else if (id === 4) {
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
    if (id !== 3 && id !== 4 && id !== 8 && !world.night) {
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
    if (id === 9) {
      // desert: fine sand drifting sideways in the warm wind
      for (let i = 0; i < 30; i++) {
        const x = ((i * 157 - t * (60 + (i % 4) * 20) - camX * 0.5) % vw + vw) % vw, y = (i * 83) % vh + Math.sin(t * 2 + i) * 6;
        ell(ctx, x, y, 1.6 + (i % 3) * 0.6, 1.2 + (i % 3) * 0.4); fs(ctx, 'rgba(255,230,170,0.7)');
      }
    }
    if (id === 7) {
      // toy factory: big slowly turning gears floating in the back
      for (let i = 0; i < 5; i++) {
        const x = ((i * 347 - camX * 0.25) % (vw + 200) + vw + 200) % (vw + 200) - 100, y = vh * 0.2 + (i * 61) % (vh * 0.35);
        ctx.globalAlpha = 0.35; drawGear(ctx, x, y, 26 + (i % 3) * 10, t * (i % 2 ? 0.6 : -0.6), ['#ff85c8', '#5ccfff', '#ffd23f'][i % 3]); ctx.globalAlpha = 1;
      }
    }
    if (id === 8) {
      // shooting star now and then
      const k = (t * 0.25) % 1, sx = vw * (1.1 - k * 1.2), sy = vh * (0.05 + k * 0.3);
      if (k < 0.5) { ctx.strokeStyle = 'rgba(255,255,255,' + (0.8 - k) + ')'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 60, sy - 16); ctx.stroke(); }
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
    drawEnemy, drawBoss, drawBackground, clearCaches, drawPet, drawSticker, drawStump, drawCannon, drawCave, drawGear, drawConveyor, drawQuicksand, nightWorld, starPath, heartPath, ell, fs, tri, RAINBOW,
  };
})();
