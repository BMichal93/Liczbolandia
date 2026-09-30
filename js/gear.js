/*
 * gear.js - making her character stronger for the adventure, and new
 * things to wear.
 *
 * Right of the house stand two workshops:
 *   - Kuźnia (Panda Bogna the smith) makes tools and upgrades from coins
 *     and materials found outside (iron, crystals, gold, feathers, star
 *     shards, fireflies - see nature.js):
 *       tools    - pickaxe (mining), umbrella (glide), golden fishing rod,
 *                  lantern (bigger light at night), magnet, little wings
 *                  (double jump)
 *       upgrades - stronger heart (+1 heart), fast shoes (+speed),
 *                  springs (+jump), three levels each
 *   - Krawcowa (Żabka Tosia the tailor) sews hats and trails that can't be
 *     bought with coins; they show up in Garderoba.
 * Every piece of work starts with a little maths question.
 *
 * Tools and upgrades work on the adventure (Wyprawa); the levels keep their
 * own balance, so medals and par times stay fair.
 *
 * Save data: fun.gear { pick, umbrella, rod, lantern, magnet, wings: true },
 * fun.up { heart, speed, jump: 0-3 }.
 */
(function () {
  const U = LZ.U, S = LZ.S, A = LZ.A, Art = LZ.Art, Fun = LZ.Fun, Bag = LZ.Bag;
  const T = LZ.T;
  const SMITH_X = 13, TAILOR_X = 20;   // world x, on the flat ground right of the house

  const TOOLS = [
    { id: 'pick', name: 'Kilof', desc: 'Wydobywaj żelazo, kryształy i złoto ze skał w jaskiniach.', cost: { coins: 40 } },
    { id: 'lantern', name: 'Latarnia', desc: 'Większe światło nocą i w jaskiniach.', cost: { coins: 30, firefly: 4 } },
    { id: 'umbrella', name: 'Parasolka', desc: 'Trzymaj skok w powietrzu, żeby powoli opadać.', cost: { coins: 60, feather: 3 } },
    { id: 'rod', name: 'Złota wędka', desc: '3 łowienia więcej dziennie i częściej rzadkie ryby.', cost: { coins: 50, iron: 4 } },
    { id: 'magnet', name: 'Magnes', desc: 'Monety same do ciebie lecą.', cost: { coins: 80, iron: 4, gem: 2 } },
    { id: 'wings', name: 'Skrzydełka', desc: 'Podwójny skok! W powietrzu naciśnij skok jeszcze raz.', cost: { coins: 150, star: 3, gold: 2, feather: 3 } },
  ];
  const UPGRADES = [
    { id: 'heart', name: 'Mocne serce', desc: '+1 serduszko na wyprawie', levels: [{ coins: 60, gem: 2 }, { coins: 100, gem: 3, gold: 1 }, { coins: 150, gem: 4, gold: 2 }] },
    { id: 'speed', name: 'Szybkie buty', desc: 'Szybszy bieg na wyprawie', levels: [{ coins: 40, iron: 3 }, { coins: 70, iron: 5, gem: 1 }, { coins: 110, iron: 6, gold: 2 }] },
    { id: 'jump', name: 'Sprężynki', desc: 'Wyższy skok na wyprawie', levels: [{ coins: 40, feather: 2, iron: 2 }, { coins: 70, feather: 4, iron: 3 }, { coins: 110, feather: 5, star: 1 }] },
  ];
  const COSMETICS = [
    { type: 'hat', id: 'featherhat', cost: { coins: 20, feather: 4 } },
    { type: 'hat', id: 'knight', cost: { coins: 30, iron: 5 } },
    { type: 'hat', id: 'gemcrown', cost: { coins: 40, gem: 4, gold: 1 } },
    { type: 'hat', id: 'starhat', cost: { coins: 40, star: 3, firefly: 2 } },
    { type: 'trail', id: 'feathers', cost: { coins: 20, feather: 5 } },
    { type: 'trail', id: 'fireflies', cost: { coins: 20, firefly: 6 } },
    { type: 'trail', id: 'sparks', cost: { coins: 30, iron: 4, gold: 2 } },
  ];
  const SPEED_STEP = 0.07, JUMP_STEP = 0.05;

  const st = p => { const f = Fun.state(p); f.gear = f.gear || {}; f.up = f.up || {}; return f; };
  const has = (p, id) => !!st(p).gear[id];
  const level = (p, id) => st(p).up[id] || 0;
  const canPay = (p, cost) => Object.keys(cost).every(k => k === 'coins' ? p.coins >= cost[k] : Bag.count(p, k) >= cost[k]);
  function pay(p, cost) { Object.keys(cost).forEach(k => { if (k === 'coins') p.coins -= cost[k]; else Bag.take(p, k, cost[k]); }); }

  /* What she has, applied to a run of the open world. Called again after
     buying something, so it works straight away; base values are kept so
     nothing is added twice. */
  function apply(G) {
    const p = G.prof;
    if (!G.gearBase) G.gearBase = { ab: G.ab, max: G.maxHearts };
    const ab = Object.assign({}, G.gearBase.ab);
    ab.speed = (ab.speed || 1) * (1 + SPEED_STEP * level(p, 'speed'));
    ab.jump = (ab.jump || 1) * (1 + JUMP_STEP * level(p, 'jump'));
    if (has(p, 'umbrella')) ab.glide = true;
    if (has(p, 'wings')) ab.doubleJump = true;
    if (has(p, 'magnet')) ab.magnet = Math.max(ab.magnet || 0, 3.2);
    if (G.riding) { ab.speed *= 1.3; ab.jump *= 1.12; }   // on the pony (stable.js)
    G.ab = ab;
    const extra = level(p, 'heart');
    const max = G.gearBase.max + extra;
    if (G.maxHearts !== max) { G.hearts += max - G.maxHearts; G.maxHearts = max; }
  }

  /* ================= pictures ================= */
  function drawTool(g, id, x, y, t) {
    const ell = Art.ell, fs = Art.fs, rr = U.rr;
    g.save(); g.translate(x, y);
    switch (id) {
      case 'pick':
        g.save(); g.rotate(-0.7); rr(g, -2.5, -4, 5, 26, 2); fs(g, '#a86c40', '#6b4424', 1.2); g.restore();
        g.beginPath(); g.moveTo(-15, -6); g.quadraticCurveTo(0, -18, 15, -6); g.quadraticCurveTo(0, -12, -15, -6); fs(g, '#b8c0d0', '#5a6388', 1.5);
        break;
      case 'lantern':
        g.strokeStyle = '#5a5a6a'; g.lineWidth = 2; g.beginPath(); g.arc(0, -12, 6, Math.PI, 0); g.stroke();
        rr(g, -9, -10, 18, 22, 4); fs(g, 'rgba(255,240,170,0.9)', '#5a5a6a', 2);
        { const gr = g.createRadialGradient(0, 1, 1, 0, 1, 16); gr.addColorStop(0, 'rgba(255,240,150,0.8)'); gr.addColorStop(1, 'rgba(255,240,150,0)'); g.fillStyle = gr; g.fillRect(-16, -15, 32, 32); }
        rr(g, -10, 10, 20, 4, 2); fs(g, '#5a5a6a');
        break;
      case 'umbrella':
        g.beginPath(); g.moveTo(-16, -2); g.quadraticCurveTo(0, -24, 16, -2); g.closePath(); fs(g, '#ff85b0', '#b8467a', 1.5);
        g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-5, -2); g.quadraticCurveTo(0, -20, 5, -2); g.closePath(); g.fill();
        g.strokeStyle = '#6b4424'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, -2); g.lineTo(0, 14); g.arc(3, 14, 3, Math.PI, 0, true); g.stroke();
        break;
      case 'rod':
        g.strokeStyle = '#e0a000'; g.lineWidth = 3; g.beginPath(); g.moveTo(-12, 14); g.lineTo(12, -14); g.stroke();
        g.strokeStyle = 'rgba(90,90,110,0.8)'; g.lineWidth = 1; g.beginPath(); g.moveTo(12, -14); g.quadraticCurveTo(16, 0, 10, 10); g.stroke();
        ell(g, -8, 9, 4, 4); fs(g, '#ffd23f', '#b8861c', 1.2); ell(g, 10, 11, 3, 4); fs(g, '#ff5e5e');
        break;
      case 'magnet':
        g.lineWidth = 8; g.strokeStyle = '#ff5e5e'; g.beginPath(); g.arc(0, -2, 10, Math.PI, 0); g.stroke();
        g.fillStyle = '#ff5e5e'; g.fillRect(-14, -2, 8, 10); g.fillRect(6, -2, 8, 10);
        g.fillStyle = '#d9e2f0'; g.fillRect(-14, 8, 8, 5); g.fillRect(6, 8, 8, 5);
        break;
      case 'wings':
        for (const d of [-1, 1]) { g.save(); g.scale(d, 1); g.beginPath(); g.moveTo(2, 0); g.quadraticCurveTo(10, -18, 18, -10); g.quadraticCurveTo(16, -2, 18, 4); g.quadraticCurveTo(10, 8, 2, 4); g.closePath(); fs(g, '#fff', '#9aa3c5', 1.5); g.restore(); }
        ell(g, 0, 2, 3, 3); fs(g, '#ffd23f');
        break;
      case 'heart': Art.heartPath(g, 0, 0, 13); fs(g, '#ff5e7e', '#a3223f', 1.5); ell(g, -5, -4, 3, 2, -0.5); fs(g, 'rgba(255,255,255,0.6)'); break;
      case 'speed':
        g.beginPath(); g.moveTo(-10, -8); g.lineTo(-2, -8); g.lineTo(-1, 2); g.lineTo(12, 5); g.lineTo(12, 11); g.lineTo(-11, 11); g.closePath(); fs(g, '#5ccfff', '#2a7fb0', 1.5);
        g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(-3, 11); g.lineTo(-3, 13); g.moveTo(4, 11); g.lineTo(4, 13); g.stroke();
        for (let i = 0; i < 3; i++) { g.strokeStyle = 'rgba(92,207,255,0.6)'; g.beginPath(); g.moveTo(-16, -2 + i * 5); g.lineTo(-12, -2 + i * 5); g.stroke(); }
        break;
      case 'jump':
        g.strokeStyle = '#9aa3b5'; g.lineWidth = 3; g.beginPath(); for (let i = 0; i <= 5; i++) g.lineTo(i % 2 ? 8 : -8, 12 - i * 5); g.stroke();
        rr(g, -11, 11, 22, 4, 2); fs(g, '#5a6388'); rr(g, -11, -15, 22, 4, 2); fs(g, '#ff85b0');
        break;
    }
    g.restore();
  }
  const toolIcon = (id, size) => { const c = document.createElement('canvas'); c.width = c.height = size * 2; c.style.width = c.style.height = size + 'px'; const g = c.getContext('2d'); g.scale(size / 18, size / 18); drawTool(g, id, 18, 18, 0); return c; };
  function costChips(p, cost) {
    const h = LZ.UI._h;
    return h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-size:14px' }, Object.keys(cost).map(k => {
      const ok = k === 'coins' ? p.coins >= cost[k] : Bag.count(p, k) >= cost[k];
      return h('span', { style: 'display:inline-flex;align-items:center;gap:2px;' + (ok ? '' : 'color:#c0392b') }, k === 'coins' ? [h('span.coin-ico'), ' ' + cost[k]] : [Bag.icon(k, 22), Bag.count(p, k) + '/' + cost[k]]);
    }));
  }
  const NAILS = ['gwóźdź', 'gwoździe', 'gwoździ'];

  /* ================= the smithy ================= */
  function openSmith(G) {
    const p = G.prof, f = st(p), h = LZ.UI._h;
    let tab = 'tools';
    const tabs = h('div.funtabs'), box = h('div'), coins = h('p.funstep');
    const m = Fun.open([h('div.npchead', null, [LZ.UI._preview({ id: 'panda', variant: 0, hat: 'knight' }, 80), h('h2', null, 'Kuźnia Pandy Bogny')]), coins, tabs, box, h('button.btn.mid', { onclick: () => m.close() }, 'Do zobaczenia!')]);
    function render(msg) {
      coins.innerHTML = ''; coins.appendChild(h('span', null, [h('span.coin-ico'), ' ' + p.coins]));
      tabs.innerHTML = '';
      [['tools', 'Narzędzia'], ['up', 'Ulepszenia'], ['me', 'Moja postać']].forEach(([k, n]) => tabs.appendChild(h('button.tab' + (tab === k ? '.on' : ''), { onclick: () => { tab = k; render(); } }, n)));
      box.innerHTML = '';
      if (msg) box.appendChild(h('p', null, msg));
      const L = h('div.funlist');
      if (tab === 'tools') {
        TOOLS.forEach(tl => {
          const own = has(p, tl.id), ok = canPay(p, tl.cost);
          L.appendChild(h('div.funline', null, [toolIcon(tl.id, 40), h('div.grow', null, [h('b', null, tl.name), h('div', { style: 'font-size:13px;font-weight:600' }, tl.desc), own ? null : costChips(p, tl.cost)]),
            own ? h('span', { style: 'font-weight:800;color:#3a9a4a' }, '✓ Masz') : h('button.btn.small' + (ok ? '.primary' : ''), { onclick: () => ok ? forge(tl.name, tl.cost, () => { f.gear[tl.id] = true; }) : A.play('bump') }, ok ? 'Wykuj' : 'Brakuje')]));
        });
      } else if (tab === 'up') {
        UPGRADES.forEach(u => {
          const lv = level(p, u.id), next = u.levels[lv], ok = next && canPay(p, next);
          L.appendChild(h('div.funline', null, [toolIcon(u.id, 40), h('div.grow', null, [h('b', null, u.name + ' ' + '★'.repeat(lv) + '☆'.repeat(3 - lv)), h('div', { style: 'font-size:13px;font-weight:600' }, u.desc), next ? costChips(p, next) : null]),
            !next ? h('span', { style: 'font-weight:800;color:#3a9a4a' }, '✓ Maks') : h('button.btn.small' + (ok ? '.primary' : ''), { onclick: () => ok ? forge(u.name + ' (poziom ' + (lv + 1) + ')', next, () => { f.up[u.id] = lv + 1; }) : A.play('bump') }, ok ? 'Ulepsz' : 'Brakuje')]));
        });
      } else {
        const lines = [
          ['heart', 'Serduszka na wyprawie: ' + G.maxHearts],
          ['speed', 'Bieg: +' + Math.round(SPEED_STEP * level(p, 'speed') * 100) + '%'],
          ['jump', 'Skok: +' + Math.round(JUMP_STEP * level(p, 'jump') * 100) + '%'],
        ];
        lines.forEach(([ic, tx]) => L.appendChild(h('div.funline', null, [toolIcon(ic, 32), h('div.grow', null, tx)])));
        const tools = TOOLS.filter(tl => has(p, tl.id));
        L.appendChild(h('div.funline', null, [h('div.grow', null, tools.length ? 'Narzędzia: ' + tools.map(tl => tl.name).join(', ') : 'Nie masz jeszcze narzędzi. Zacznij od kilofa!')]));
        L.appendChild(h('p.note', null, 'Ulepszenia działają na wyprawie. Materiały: żelazo, kryształy i złoto z jaskiń (kilofem), piórka z wysp w chmurach, gwiezdne odłamki z nocnego deszczu meteorów, świetliki łapane nocą.'));
      }
      box.appendChild(L);
    }
    function forge(name, cost, done) {
      const q = h('div'); box.innerHTML = ''; box.appendChild(q);
      Fun.ask(q, p, () => Fun.story(p, NAILS, { place: 'W skrzynce', gone: 'wbito w podkowy' }), () => {
        if (!canPay(p, cost)) { render('Coś się nie zgadza - brakuje materiałów.'); return; }
        pay(p, cost); done(); S.checkBadges(p); S.save(); A.play('win');
        apply(G);
        LZ.Game._confetti(G.player.x + 14, G.player.y, 30);
        render('Gotowe! ' + name + ' - jak nowe, prosto z kowadła!');
      }, { title: 'Kowalka pyta:', cancel: () => render(), cancelText: 'Wróć' });
    }
    render('Witaj! Wykuję ci narzędzia i ulepszenia. Przynieś monety i materiały z wyprawy.');
  }

  /* ================= the tailor ================= */
  function openTailor(G) {
    const p = G.prof, h = LZ.UI._h, eq = p.equip;
    const box = h('div'), coins = h('p.funstep');
    const m = Fun.open([h('div.npchead', null, [LZ.UI._preview({ id: 'frog', variant: 1, hat: 'featherhat' }, 80), h('h2', null, 'Pracownia Żabki Tosi')]), coins, box, h('button.btn.mid', { onclick: () => m.close() }, 'Do zobaczenia!')]);
    const owns = c => c.type === 'hat' ? S.ownsHat(p, c.id) : S.ownsTrail(p, c.id);
    const nameOf = c => (c.type === 'hat' ? LZ.D.HATS : LZ.D.TRAILS).find(x => x.id === c.id).name;
    function render(msg) {
      coins.innerHTML = ''; coins.appendChild(h('span', null, [h('span.coin-ico'), ' ' + p.coins]));
      box.innerHTML = '';
      box.appendChild(h('p', null, msg || 'Szyję rzeczy, których nie kupisz w sklepie. Przynieś materiały z wyprawy!'));
      const L = h('div.funlist');
      COSMETICS.forEach(c => {
        const own = owns(c), ok = canPay(p, c.cost), worn = c.type === 'hat' ? eq.hat === c.id : eq.trail === c.id;
        const pic = c.type === 'hat' ? LZ.UI._preview({ id: eq.char, variant: eq.variant, hat: c.id }, 56) : trailIcon(c.id);
        L.appendChild(h('div.funline', null, [pic, h('div.grow', null, [h('b', null, nameOf(c)), h('div', { style: 'font-size:13px;font-weight:600' }, c.type === 'hat' ? 'Czapka' : 'Ślad za postacią'), own ? null : costChips(p, c.cost)]),
          own ? h('button.btn.small' + (worn ? '' : '.primary'), { onclick: () => { if (c.type === 'hat') eq.hat = c.id; else eq.trail = c.id; S.save(); render('Pięknie wyglądasz!'); } }, worn ? 'Założone' : 'Załóż')
            : h('button.btn.small' + (ok ? '.primary' : ''), { onclick: () => ok ? sew(c) : A.play('bump') }, ok ? 'Uszyj' : 'Brakuje')]));
      });
      box.appendChild(L);
    }
    function sew(c) {
      const q = h('div'); box.innerHTML = ''; box.appendChild(q);
      Fun.ask(q, p, () => Fun.story(p, ['guzik', 'guziki', 'guzików'], { place: 'W pudełku', gone: 'przyszyto' }), () => {
        if (!canPay(p, c.cost)) { render('Brakuje materiałów.'); return; }
        pay(p, c.cost);
        if (c.type === 'hat') { p.owned.hats.push(c.id); eq.hat = c.id; } else { p.owned.trails.push(c.id); eq.trail = c.id; }
        S.checkBadges(p); S.save(); A.play('win');
        render('Uszyte! ' + nameOf(c) + ' - już masz na sobie.');
      }, { title: 'Tosia pyta:', cancel: () => render(), cancelText: 'Wróć' });
    }
    render();
  }
  function trailIcon(id) {
    const c = document.createElement('canvas'); c.width = c.height = 112; c.style.width = c.style.height = '56px';
    const g = c.getContext('2d'); g.scale(2, 2);
    for (let i = 0; i < 6; i++) Art.drawTrailParticle ? Art.drawTrailParticle(g, { kind: id, x: 10 + i * 8, y: 28 + Math.sin(i) * 6, size: 4 + i * 0.4, life: 0.4 + i * 0.1, max: 1, rot: i, ci: i }) : null;
    return c;
  }

  /* ================= drawing the two workshops ================= */
  function drawSmithy(g, e, t) {
    const x = e.x, y = e.y, rr = U.rr, fs = Art.fs;
    // stone house with a wide chimney and a glowing forge
    rr(g, x - 90, y - 110, 180, 110, 6); fs(g, '#c9c0d0', '#6a6278', 2.5);
    g.fillStyle = 'rgba(106,98,120,0.35)'; for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) rr(g, x - 86 + c * 30 + (r % 2) * 14, y - 104 + r * 21, 24, 15, 3), g.fill();
    g.beginPath(); g.moveTo(x - 104, y - 106); g.lineTo(x, y - 160); g.lineTo(x + 104, y - 106); g.closePath(); fs(g, '#8a5a32', '#5c3a1c', 2.5);
    rr(g, x + 40, y - 175, 26, 50, 4); fs(g, '#9a92a8', '#5a5270', 2);
    for (let i = 0; i < 3; i++) { const k = (t * 0.5 + i / 3) % 1; Art.ell(g, x + 53 + k * 16, y - 180 - k * 70, 10 + k * 10, 8 + k * 8); fs(g, 'rgba(160,160,170,' + (0.6 - k * 0.6) + ')'); }
    rr(g, x - 70, y - 70, 60, 70, 8); fs(g, '#3a2020');
    const fl = 0.6 + 0.3 * Math.sin(t * 8); const gr = g.createRadialGradient(x - 40, y - 20, 4, x - 40, y - 20, 50); gr.addColorStop(0, 'rgba(255,160,60,' + fl + ')'); gr.addColorStop(1, 'rgba(255,90,30,0)'); g.fillStyle = gr; g.fillRect(x - 90, y - 70, 100, 70);
    // anvil
    rr(g, x + 20, y - 26, 44, 12, 3); fs(g, '#5a5a6a', '#2a2a3a', 2); rr(g, x + 34, y - 14, 16, 14, 2); fs(g, '#5a5a6a', '#2a2a3a', 2);
    // the smith
    Art.drawCharacter(g, x + 76, y, { id: 'panda', variant: 0, hat: 'knight', facing: -1, t, state: 'idle', scale: 1 });
    U.rr(g, x - 60, y - 142, 120, 26, 7); fs(g, '#fff6c9', '#8a5a32', 2);
    g.fillStyle = '#5a3a8a'; g.font = '800 16px "Baloo 2", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('KUŹNIA', x, y - 129);
    Fun.ring(g, x + 40, y - 70, e, 0.6);
  }
  function drawTailor(g, e, t, G) {
    const x = e.x, y = e.y, rr = U.rr, fs = Art.fs;
    // a striped tent with a mannequin wearing the newest hat
    g.beginPath(); g.moveTo(x - 70, y); g.lineTo(x - 60, y - 90); g.lineTo(x, y - 130); g.lineTo(x + 60, y - 90); g.lineTo(x + 70, y); g.closePath(); fs(g, '#ffd6e8', '#b8467a', 2.5);
    g.save(); g.clip(); g.fillStyle = 'rgba(255,133,200,0.45)'; for (let i = -4; i < 5; i++) { g.beginPath(); g.moveTo(x + i * 30, y); g.lineTo(x, y - 130); g.lineTo(x + i * 30 + 15, y); g.closePath(); g.fill(); } g.restore();
    rr(g, x - 26, y - 70, 52, 70, 22); fs(g, '#7a3a60');
    g.strokeStyle = '#6b4424'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 46, y); g.lineTo(x - 46, y - 44); g.stroke();
    Art.ell(g, x - 46, y - 56, 12, 14); fs(g, '#e8dcc8', '#8a7a60', 2);
    Art.drawCharacter(g, x + 52, y, { id: 'frog', variant: 1, hat: 'featherhat', facing: -1, t, state: 'idle', scale: 1 });
    U.rr(g, x - 56, y - 160, 112, 24, 7); fs(g, '#fff6c9', '#b8467a', 2);
    g.fillStyle = '#b8467a'; g.font = '800 15px "Baloo 2", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('KRAWCOWA', x, y - 148);
    Fun.ring(g, x, y - 100, e, 0.6);
  }

  LZ.Ext.add({
    world: {
      init(G) { apply(G); },
      defs(G, cx, cy, push) {
        if (cx !== 0 || cy !== 0) return;
        push({ t: 'smithy', x: SMITH_X, y: 0 });
        push({ t: 'tailor', x: TAILOR_X, y: 0 });
      },
      buildEnt(G, e, px, py) {
        if (e.t === 'smithy' || e.t === 'tailor') { G.ents.push({ k: e.t, x: px + T / 2, y: py }); return true; }
        return false;
      },
      updateEnt(G, e, i, dt) {
        if (e.k === 'smithy') { if (Fun.stand(G, e, dt, { cx: e.x + 40, dx: 44, t: 0.6 })) openSmith(G); return true; }
        if (e.k === 'tailor') { if (Fun.stand(G, e, dt, { dx: 40, t: 0.6 })) openTailor(G); return true; }
        return false;
      },
      drawEnt(g, e, t, G) {
        if (e.k === 'smithy') { drawSmithy(g, e, t); return true; }
        if (e.k === 'tailor') { drawTailor(g, e, t, G); return true; }
        return false;
      },
    },
  });

  LZ.Gear = { TOOLS, UPGRADES, COSMETICS, has, level, apply, openSmith, openTailor, drawTool, canPay, SMITH_X, TAILOR_X };
})();
