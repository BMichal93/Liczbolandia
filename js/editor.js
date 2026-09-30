/*
 * editor.js - the Pracownia level editor.
 *
 * A tap-to-place grid over the real game art: pick a tool at the bottom,
 * tap or drag on the level. Everything is drawn with the same functions the
 * game uses, at the same 48-unit tile size, just scaled down - so what she
 * builds looks exactly like what she'll play.
 *
 * Rules that keep every level playable without explaining anything:
 *   - the first 4 columns are the start area and can't be changed
 *   - walking things (creatures, springs, stumps, gates) drop onto the ground
 *   - a maths gate levels the ground in front of it by itself
 *   - the finish (stairs, flag, castle) is added automatically at the end
 *   - a level can only be sent to someone after its builder has finished it
 */
(function () {
  const D = LZ.D, S = LZ.S, X = LZ.X, Art = LZ.Art, A = LZ.A;
  const T = LZ.T, H = 14, START_COLS = 4;
  const ESIZE = { slime: [36, 26], bee: [32, 30], snowball: [34, 34], fish: [36, 26], jelly: [30, 34], shroom: [36, 34], bat: [34, 28], cloudy: [40, 30], robot: [34, 38], alien: [34, 32], ufo: [46, 30], scorpion: [40, 28], vulture: [46, 32] };

  const TOOLS = [
    { id: 'hand', name: 'Przesuń' },
    { id: '#', name: 'Ziemia' },
    { id: 'dig', name: 'Dziura' },
    { id: '=', name: 'Klocek' },
    { id: 'B', name: 'Cegła' },
    { id: '?', name: '?-klocek' },
    { id: '-', name: 'Kładka' },
    { id: 'coin', name: 'Moneta' },
    { id: 'enemy', name: 'Stworek' },
    { id: 'fly', name: 'Latający' },
    { id: 'spring', name: 'Sprężyna' },
    { id: 'stump', name: 'Pień' },
    { id: 'gate', name: 'Zadanie' },
    { id: 'S', name: 'Kolce' },
    { id: 'I', name: 'Lód' },
    { id: '>', name: 'Taśma' },
    { id: '<', name: 'Taśma' },
    { id: 'Q', name: 'Piaski' },
    { id: 'erase', name: 'Gumka' },
  ];

  let st = null;   // open editor: { lv, tool, scroll, cv, hist, drag }

  /* ---------------- level storage ---------------- */
  const newId = () => 'c' + Date.now().toString(36) + Math.floor(Math.random() * 1e4);
  function create(w, W) {
    const p = S.active();
    const lv = Object.assign(X.blankLevel(w, W, p ? p.name : ''), { id: newId(), created: Date.now() });
    (S.data.custom = S.data.custom || []).push(lv); S.save();
    return lv;
  }
  function copy(id) {
    const src = (S.data.custom || []).find(x => x.id === id);
    const p = S.active();
    const lv = JSON.parse(JSON.stringify(src));
    Object.assign(lv, { id: newId(), author: p ? p.name : '', name: (src.name || 'Poziom') + ' 2', verified: false, received: false, created: Date.now() });
    S.data.custom.push(lv); S.save();
    return lv;
  }

  /* ---------------- editing operations ---------------- */
  const colsArr = lv => lv.cols.map(c => c.split(''));
  function setCell(lv, x, y, c) { const a = lv.cols[x].split(''); a[y] = c; lv.cols[x] = a.join(''); }
  function entAt(lv, x, y) {
    // a stump covers 2 columns from its top down to the ground; a gate post is the whole column above the ground
    return lv.ents.find(e => e.t === 'stump' ? (x === e.x || x === e.x + 1) && y >= e.y && y < Math.min(X.groundTop(lv.cols, e.x), X.groundTop(lv.cols, e.x + 1))
      : e.t === 'gate' ? x === e.x && y <= e.y : e.x === x && e.y === y);
  }
  function removeEntsIn(lv, x, y0) { lv.ents = lv.ents.filter(e => !(e.t !== 'stump' && e.t !== 'gate' && e.x === x && e.y >= y0)); }
  // the empty cell resting on the ground of column x (where walking things go)
  function dropY(lv, x) { return X.groundTop(lv.cols, x) - 1; }

  function apply(x, y, first) {
    const lv = st.lv, tool = st.tool;
    if (x < START_COLS || x >= lv.W || y < 0 || y >= H) return false;
    const cell = lv.cols[x][y];
    switch (tool) {
      case '#': {
        // ground fills from here to the bottom - one tap builds a hill
        for (let yy = y; yy < H; yy++) setCell(lv, x, yy, '#');
        removeEntsIn(lv, x, y);
        return true;
      }
      case 'dig': {
        for (let yy = y; yy < H; yy++) setCell(lv, x, yy, '.');
        lv.ents = lv.ents.filter(e => !((e.t === 'stump' && (e.x === x || e.x + 1 === x)) || (e.t === 'gate' && e.x === x)));
        return true;
      }
      case 'erase': {
        const e = entAt(lv, x, y);
        if (e) { lv.ents.splice(lv.ents.indexOf(e), 1); return true; }
        if (cell !== '.') { setCell(lv, x, y, '.'); return true; }
        return false;
      }
      case '=': case 'B': case '?': case '-': case 'S': case 'I': case '>': case '<': case 'Q': {
        if (cell === tool) return false;
        if (entAt(lv, x, y)) return false;
        setCell(lv, x, y, tool);
        return true;
      }
    }
    if (!first) return false;   // creatures and things are placed one per tap, not painted
    const limit = lv.ents.length >= 400;
    if (limit) { toast('Już bardzo dużo rzeczy!'); return false; }
    if (tool === 'coin') {
      if (cell !== '.' || entAt(lv, x, y)) return false;
      lv.ents.push({ t: 'coin', x, y }); return true;
    }
    if (tool === 'fly') {
      if (cell !== '.' || entAt(lv, x, y)) return false;
      lv.ents.push({ t: 'fly', x, y }); return true;
    }
    if (tool === 'enemy' || tool === 'spring') {
      const yy = dropY(lv, x);
      if (yy < 0 || yy >= H - 1 || entAt(lv, x, yy)) return false;
      lv.ents.push({ t: tool, x, y: yy }); return true;
    }
    if (tool === 'stump') {
      if (x + 1 >= lv.W) return false;
      const g = Math.min(X.groundTop(lv.cols, x), X.groundTop(lv.cols, x + 1));
      if (g >= H) { toast('Pień musi stać na ziemi'); return false; }
      const top = Math.max(g - 4, Math.min(y, g - 1));
      if (lv.ents.some(e => e.t === 'stump' && Math.abs(e.x - x) < 2)) return false;
      lv.ents = lv.ents.filter(e => !(e.t !== 'stump' && (e.x === x || e.x === x + 1)));
      lv.ents.push({ t: 'stump', x, y: top }); return true;
    }
    if (tool === 'gate') {
      if (x < 16) { toast('Brama musi stać dalej od startu'); return false; }
      if (lv.ents.some(e => e.t === 'gate' && Math.abs(e.x - x) < 15)) { toast('Za blisko innej bramy'); return false; }
      let g = X.groundTop(lv.cols, x); if (g >= H) g = 10;
      g = Math.max(6, Math.min(11, g));
      // flatten the 13 columns in front of the gate so the answer blocks can be reached
      for (let cx = x - 12; cx <= x; cx++) { for (let yy = 0; yy < H; yy++) setCell(lv, cx, yy, yy >= g ? '#' : '.'); }
      // things in the levelled strip stay where they still fit: walkers drop to the new
      // ground, stumps (whose ground just changed) and anything in a block's spot go
      const blocks = [x - 9, x - 6, x - 3];
      lv.ents = lv.ents.filter(e => {
        if (e.x < x - 12 || e.x > x) return true;
        if (e.t === 'stump' || e.t === 'gate') return false;
        if (e.t === 'enemy' || e.t === 'spring') e.y = g - 1;
        return e.y < g && !(e.y === g - 4 && blocks.includes(e.x)) && e.x !== x;
      });
      lv.ents.push({ t: 'gate', x, y: g - 1 });
      toast('Brama z zadaniem! Teren przed nią jest wyrównany.');
      return true;
    }
    return false;
  }

  /* ---------------- drawing ---------------- */
  function world() { return D.WORLDS[(st.lv.w || 1) - 1] || D.WORLDS[0]; }
  function draw(t) {
    const cv = st.cv, ctx = cv.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = cv.clientWidth, ch = cv.clientHeight;
    if (cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(ch * dpr)) { cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); }
    const w = world(), lv = st.lv;
    const ts = ch / H, k = ts / T;
    st.ts = ts;
    const visCols = Math.ceil(cw / ts) + 1;
    st.scroll = Math.max(0, Math.min(st.scroll, lv.W + 6 - cw / ts));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, ch); g.addColorStop(0, w.pal.skyTop); g.addColorStop(1, w.pal.skyBot);
    ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);
    ctx.setTransform(dpr * k, 0, 0, dpr * k, -st.scroll * T * dpr * k, 0);
    const x0 = Math.max(0, Math.floor(st.scroll)), x1 = Math.min(lv.W - 1, x0 + visCols);
    const isG = (x, y) => x < 0 || x >= lv.W || y >= H ? true : y < 0 ? false : '#I><Q'.includes(lv.cols[x][y]);
    // start area
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(0, 0, START_COLS * T, H * T);
    for (let x = x0; x <= x1; x++) for (let y = 0; y < H; y++) {
      const c = x < START_COLS ? (y >= 10 ? '#' : '.') : lv.cols[x][y];
      if (c === '.') continue;
      if (c === '?') { Art.drawQBlock(ctx, x * T, y * T, t, 0); continue; }
      if (c === '>' || c === '<') { Art.drawConveyor(ctx, x * T, y * T, c === '>' ? 1 : -1, t, w, lv.cols[x - 1] ? lv.cols[x - 1][y] !== c : true, lv.cols[x + 1] ? lv.cols[x + 1][y] !== c : true); continue; }
      if (c === 'Q') { Art.drawQuicksand(ctx, x * T, y * T, t, true, true); continue; }
      const mask = (c === '#' || c === 'I') ? ((isG(x, y - 1) ? 0 : 1) | (isG(x + 1, y) ? 0 : 2) | (isG(x, y + 1) ? 0 : 4) | (isG(x - 1, y) ? 0 : 8)) : 0;
      ctx.drawImage(Art.getTile(w, c, mask), x * T - 0.3, y * T - 0.3, T + 0.6, T + 0.6);
    }
    // grid
    ctx.strokeStyle = 'rgba(60,30,120,0.12)'; ctx.lineWidth = 1.5 / k;
    ctx.beginPath();
    for (let x = x0; x <= x1 + 1; x++) { ctx.moveTo(x * T, 0); ctx.lineTo(x * T, H * T); }
    for (let y = 0; y <= H; y++) { ctx.moveTo(x0 * T, y * T); ctx.lineTo((x1 + 1) * T, y * T); }
    ctx.stroke();
    // things
    for (const e of lv.ents) {
      if (e.x < x0 - 2 || e.x > x1 + 1) continue;
      const px = e.x * T, py = e.y * T;
      if (e.t === 'coin') Art.drawCoin(ctx, px + T / 2, py + T / 2, t + e.x * 0.1, 12);
      else if (e.t === 'enemy' || e.t === 'fly') {
        const type = e.t === 'fly' ? X.flyerOf(w) : X.walkerOf(w), sz = ESIZE[type] || [34, 30];
        Art.drawEnemy(ctx, { type, x: px + (T - sz[0]) / 2, y: py + T - sz[1], w: sz[0], h: sz[1], dir: -1, seed: e.x, roll: 0, col: '#8fe36b' }, t, w);
      } else if (e.t === 'spring') {
        ctx.fillStyle = '#ff5e7e'; LZ.U.rr(ctx, px + 8, py + T - 12, T - 16, 12, 4); ctx.fill();
        ctx.strokeStyle = '#9aa3b5'; ctx.lineWidth = 4; ctx.beginPath(); for (let i = 0; i < 4; i++) { ctx.moveTo(px + 12, py + T - 14 - i * 6); ctx.lineTo(px + T - 12, py + T - 17 - i * 6); } ctx.stroke();
        ctx.fillStyle = '#ffd23f'; LZ.U.rr(ctx, px + 6, py + T - 40, T - 12, 8, 4); ctx.fill();
      } else if (e.t === 'stump') {
        const base = Math.min(X.groundTop(lv.cols, e.x), X.groundTop(lv.cols, e.x + 1));
        const top = Math.max(0, Math.min(e.y, base - 1));
        Art.drawStump(ctx, { x: px, y: top * T, w: 2 * T, h: (base - top) * T, base: base * T }, w, t);
      } else if (e.t === 'gate') {
        const g = e.y + 1;
        for (const bx of [e.x - 9, e.x - 6, e.x - 3]) { LZ.U.rr(ctx, bx * T + 3, (g - 4) * T + 3, T - 6, T - 6, 10); Art.fs(ctx, '#fff6c9', '#9d7bff', 4); ctx.fillStyle = '#7a5ce6'; ctx.font = '800 30px "Baloo 2", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', bx * T + T / 2, (g - 4) * T + T / 2 + 2); }
        LZ.U.rr(ctx, px + 6, 0, T - 12, g * T, 8); Art.fs(ctx, 'rgba(157,123,255,0.55)', '#7a5ce6', 3);
      }
    }
    // the finish that gets added automatically
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(lv.W * T, 0, 6 * T, H * T);
    ctx.fillStyle = '#7a5ce6'; ctx.font = '800 40px "Baloo 2", sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('META →', lv.W * T + 12, 4 * T);
    ctx.fillText('START', 8, 4 * T);
  }

  /* ---------------- UI ---------------- */
  let toastEl = null, toastT = 0;
  function toast(msg) { if (!toastEl) return; toastEl.textContent = msg; toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl && toastEl.classList.remove('on'), 1800); }

  function toolIcon(tool) {
    const c = document.createElement('canvas'); c.width = 72; c.height = 72;
    const g = c.getContext('2d'), w = world();
    g.scale(1.5, 1.5);
    const t0 = 0.3;
    switch (tool.id) {
      case 'hand': case 'dig': case 'erase': {
        g.font = '30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText({ hand: '✋', dig: '⛏', erase: '🧽' }[tool.id], 24, 26); break;
      }
      case '?': Art.drawQBlock(g, 0, 0, t0, 0); break;
      case '>': case '<': Art.drawConveyor(g, 0, 0, tool.id === '>' ? 1 : -1, t0, w, true, true); break;
      case 'Q': Art.drawQuicksand(g, 0, 0, t0, true, true); break;
      case 'coin': Art.drawCoin(g, 24, 24, t0, 13); break;
      case 'enemy': { const type = X.walkerOf(w), sz = ESIZE[type] || [34, 30]; Art.drawEnemy(g, { type, x: (48 - sz[0]) / 2, y: 46 - sz[1], w: sz[0], h: sz[1], dir: -1, seed: 1, roll: 0, col: '#8fe36b' }, t0, w); break; }
      case 'fly': { const type = X.flyerOf(w), sz = ESIZE[type] || [34, 30]; Art.drawEnemy(g, { type, x: (48 - sz[0]) / 2, y: 44 - sz[1], w: sz[0], h: sz[1], dir: -1, seed: 1, roll: 0, col: '#8fe36b' }, t0, w); break; }
      case 'spring': g.fillStyle = '#ff5e7e'; LZ.U.rr(g, 8, 36, 32, 10, 4); g.fill(); g.strokeStyle = '#9aa3b5'; g.lineWidth = 4; g.beginPath(); for (let i = 0; i < 3; i++) { g.moveTo(12, 32 - i * 7); g.lineTo(36, 29 - i * 7); } g.stroke(); g.fillStyle = '#ffd23f'; LZ.U.rr(g, 6, 8, 36, 8, 4); g.fill(); break;
      case 'stump': g.save(); g.scale(0.5, 0.5); Art.drawStump(g, { x: 0, y: 8, w: 96, h: 80, base: 88 }, w, t0); g.restore(); break;
      case 'gate': LZ.U.rr(g, 6, 6, 36, 36, 9); Art.fs(g, '#fff6c9', '#9d7bff', 3); g.fillStyle = '#7a5ce6'; g.font = '800 26px "Baloo 2", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 24, 26); break;
      default: g.drawImage(Art.getTile(w, tool.id, tool.id === '#' || tool.id === 'I' ? 1 : 0), 0, 0, 48, 48);
    }
    return c;
  }

  function open(id) {
    const lv = (S.data.custom || []).find(x => x.id === id);
    if (!lv) return LZ.UI.workshop();
    const h = LZ.UI._h;
    st = { lv, tool: '#', scroll: 0, hist: [], drag: null };
    const cv = h('canvas.edcanvas');
    st.cv = cv;
    const nameIn = h('input.edname', { maxlength: 22, value: lv.name || '' });
    nameIn.addEventListener('input', () => { lv.name = nameIn.value; S.save(); });
    const toolsBar = h('div.edtools', null, []);
    const worldBtn = h('button.btn.small', { onclick: pickWorld }, '');
    const renderTools = () => {
      toolsBar.innerHTML = '';
      TOOLS.forEach(tl => {
        const b = h('button.edtool' + (st.tool === tl.id ? '.sel' : ''), { onclick: () => { st.tool = tl.id; renderTools(); } }, [toolIcon(tl), h('span', null, tl.name)]);
        toolsBar.appendChild(b);
      });
      worldBtn.textContent = '🌍 ' + world().name;
    };
    st.renderTools = renderTools;
    toastEl = h('div.edtoast');
    const scrollBy = d => { st.scroll += d; };
    LZ.UI._show(h('div.editor', null, [
      h('div.edtop', null, [
        h('button.btn.small', { onclick: close }, '← Wyjdź'),
        nameIn,
        worldBtn,
        h('button.btn.small', { onclick: undo }, '↶ Cofnij'),
        h('button.btn.small.primary', { onclick: test }, '▶ Zagraj'),
      ]),
      h('div.edmain', null, [
        cv, toastEl,
        h('button.edscroll.left', { onclick: () => scrollBy(-8) }, '◀'),
        h('button.edscroll.right', { onclick: () => scrollBy(8) }, '▶'),
      ]),
      toolsBar,
    ]));
    renderTools();
    // pointer: tap/drag to build, drag with the hand (or two fingers' worth of patience) to scroll
    const cellOf = ev => { const r = cv.getBoundingClientRect(); return { x: Math.floor((ev.clientX - r.left) / st.ts + st.scroll), y: Math.floor((ev.clientY - r.top) / st.ts), cx: ev.clientX }; };
    cv.addEventListener('pointerdown', ev => {
      ev.preventDefault(); cv.setPointerCapture(ev.pointerId);
      const c = cellOf(ev);
      st.drag = { startX: c.cx, scroll0: st.scroll, last: c.x + ',' + c.y, changed: false };
      if (st.tool === 'hand') return;
      st.hist.push(JSON.stringify({ cols: lv.cols, ents: lv.ents })); if (st.hist.length > 40) st.hist.shift();
      if (apply(c.x, c.y, true)) { st.drag.changed = true; A.play('click'); }
      else st.hist.pop();
    });
    cv.addEventListener('pointermove', ev => {
      if (!st || !st.drag) return;
      const c = cellOf(ev);
      if (st.tool === 'hand') { st.scroll = st.drag.scroll0 - (c.cx - st.drag.startX) / st.ts; return; }
      const key = c.x + ',' + c.y; if (key === st.drag.last) return;
      st.drag.last = key;
      if (!st.drag.changed) st.hist.push(JSON.stringify({ cols: lv.cols, ents: lv.ents }));
      if (apply(c.x, c.y, false)) st.drag.changed = true;
    });
    const up = () => { if (!st || !st.drag) return; if (st.drag.changed) { lv.verified = false; S.save(); } st.drag = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    // mouse wheel / trackpad scrolls sideways on a laptop
    cv.addEventListener('wheel', ev => { ev.preventDefault(); st.scroll += (ev.deltaX || ev.deltaY) / 40; }, { passive: false });
    const loop = (now) => { if (!st || !cv.isConnected) return; draw(now / 1000); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    if (!lv.ents.length && lv.cols.every(c => c === lv.cols[4])) toast('Wybierz narzędzie na dole i stukaj w planszę!');
  }
  function undo() {
    if (!st || !st.hist.length) return;
    const prev = JSON.parse(st.hist.pop());
    st.lv.cols = prev.cols; st.lv.ents = prev.ents; st.lv.verified = false; S.save();
  }
  function pickWorld() {
    const h = LZ.UI._h, p = S.active();
    const m = LZ.UI._modal([
      h('h2', null, 'Który świat?'),
      h('div.edworlds', null, D.WORLDS.filter(w => S.isWorldUnlocked(p, w.id)).map(w => h('button.edworld', {
        style: 'background:linear-gradient(160deg,' + w.pal.skyTop + ',' + w.pal.skyBot + ')',
        onclick: () => { st.lv.w = w.id; st.lv.verified = false; S.save(); m.close(); st.renderTools(); },
      }, w.name))),
    ]);
  }
  function test() {
    const lv = st.lv;
    S.save();
    const go = () => { const id = lv.id; st = null; LZ.UI.play(lv.w, 1, { kind: 'custom', data: lv, id, test: true }); };
    if (!X.reachable(X.toLevel(lv))) LZ.UI._confirm('Czy da się dojść do mety?', 'Wygląda na to, że gdzieś jest za wysoko albo za daleko do skoczenia. Zagrać mimo to?', go);
    else go();
  }
  function close() { S.save(); st = null; LZ.UI.workshop(); }

  LZ.Editor = { open, create, copy, get active() { return !!st; }, _state: () => st, _apply: (x, y, tool) => { const t0 = st.tool; st.tool = tool; const r = apply(x, y, true); st.tool = t0; return r; } };
})();
