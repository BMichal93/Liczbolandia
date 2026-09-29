/*
 * input.js - keyboard and touch controls merged into one state object.
 *
 * Touch: instead of listening on each button separately, every touch point
 * is checked against the (enlarged) button areas on every touch event.
 * That way a child can slide a thumb from "left" to "right" without lifting
 * it, and a thumb that drifts slightly off the jump button still counts.
 */
(function () {
  const In = { left: false, right: false, jump: false, jumpPressed: false, touch: false };
  const keys = new Set();
  let touchState = { left: false, right: false, jump: false };

  function recompute() {
    const kl = keys.has('ArrowLeft') || keys.has('KeyA');
    const kr = keys.has('ArrowRight') || keys.has('KeyD');
    const kj = keys.has('Space') || keys.has('ArrowUp') || keys.has('KeyW') || keys.has('KeyZ');
    const wasJump = In.jump;
    In.left = kl || touchState.left;
    In.right = kr || touchState.right;
    In.jump = kj || touchState.jump;
    if (In.jump && !wasJump) In.jumpPressed = true;
  }

  window.addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    LZ.A.unlock();
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if ((e.code === 'Escape' || e.code === 'KeyP') && LZ.Game.active) { LZ.UI.togglePause(); return; }
    keys.add(e.code); recompute();
  });
  window.addEventListener('keyup', e => { keys.delete(e.code); recompute(); });
  window.addEventListener('blur', () => { keys.clear(); touchState = { left: false, right: false, jump: false }; recompute(); });

  function zoneRects() {
    const out = {};
    ['left', 'right', 'jump'].forEach(k => {
      const el = document.getElementById('btn-' + k);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const grow = k === 'jump' ? 34 : 18;
      out[k] = { x: r.left - grow, y: r.top - grow, w: r.width + grow * 2, h: r.height + grow * 2, el };
    });
    return out;
  }
  function onTouch(e) {
    if (!LZ.Game.active || LZ.UI.isPaused()) return;
    const z = zoneRects();
    const st = { left: false, right: false, jump: false };
    for (const t of e.touches) {
      for (const k in z) {
        const r = z[k];
        if (t.clientX >= r.x && t.clientX <= r.x + r.w && t.clientY >= r.y && t.clientY <= r.y + r.h) st[k] = true;
      }
    }
    // left and right can't both be held by the same thumb area - prefer the latest
    touchState = st;
    for (const k in z) z[k].el.classList.toggle('on', st[k]);
    recompute();
    if (e.target && e.target.closest && e.target.closest('#controls')) e.preventDefault();
  }
  ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach(ev => window.addEventListener(ev, onTouch, { passive: false }));
  window.addEventListener('touchstart', () => { In.touch = true; LZ.A.unlock(); document.body.classList.add('touch'); }, { passive: true });

  // Mouse support for the on-screen buttons (handy on a laptop with a touchscreen off)
  ['left', 'right', 'jump'].forEach(k => {
    document.addEventListener('mousedown', e => { if (e.target.id === 'btn-' + k) { touchState[k] = true; recompute(); } });
  });
  document.addEventListener('mouseup', () => { touchState = { left: false, right: false, jump: false }; recompute(); });

  In.reset = () => { keys.clear(); touchState = { left: false, right: false, jump: false }; In.jumpPressed = false; recompute(); document.querySelectorAll('.ctl').forEach(b => b.classList.remove('on')); };
  LZ.In = In;
})();
