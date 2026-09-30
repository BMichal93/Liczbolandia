/*
 * fishing.js - fishing from a pier in the bay.
 *
 * Cast, wait for the float to dip, and pull in time. Big and rare fish also
 * want a quick sum before they let themselves be pulled in. Twelve kinds of
 * fish live in the bays; some only come out at night and one only in the
 * rain. Every fish caught goes into the backpack and the album in the book.
 *
 * The fish bite 5 times a day for free; a worm (from a trader) buys one
 * more cast.
 */
(function () {
  const U = LZ.U, S = LZ.S, A = LZ.A, Art = LZ.Art, Fun = LZ.Fun, Bag = LZ.Bag, M = LZ.M;
  const FREE = 5;
  const WEIGHT = { 1: 40, 2: 24, 3: 14, 4: 7, 5: 3 };

  function castsLeft(p) {
    const f = Fun.state(p);
    if (!f.fishDay || f.fishDay.d !== Fun.today()) f.fishDay = { d: Fun.today(), n: 0 };
    return Math.max(0, FREE - f.fishDay.n);
  }
  function roll(G) {
    const night = LZ.Sky ? LZ.Sky.isNight(G.prof) : false, rain = LZ.Sky ? LZ.Sky.weatherNow(G) === 'rain' : false;
    const pool = Bag.FISH.filter(f => (!f.night || night) && (!f.rain || rain));
    return U.wpick(Math.random, pool.map(f => [WEIGHT[f.r] * (f.night && night ? 2 : 1) * (f.rain && rain ? 3 : 1), f]));
  }

  function open(G) {
    const p = G.prof, h = LZ.UI._h;
    const cv = document.createElement('canvas'); cv.width = 1040; cv.height = 420; cv.className = 'funcanvas'; cv.style.width = '520px';
    const g = cv.getContext('2d');
    const info = h('p'), row = h('div.funrow'), q = h('div');
    let state = 'idle', t0 = 0, biteAt = 0, fish = null, dip = 0, msg = '', splash = 0, caughtFish = null;
    const m = Fun.open([h('h2', null, '🎣 Łowienie ryb'), cv, info, q, row], () => { clearInterval(iv); });
    const night = LZ.Sky ? LZ.Sky.darkness(Fun.state(p).time) : 0;
    const window = S.mathBand(p).id <= 1 ? 1.3 : 1.0;   // the youngest get a little longer to react
    const start = performance.now();
    const iv = setInterval(frame, 33);
    function frame() {
      const t = (performance.now() - start) / 1000;
      g.setTransform(2, 0, 0, 2, 0, 0);
      // sky and water, darker at night
      const sky = g.createLinearGradient(0, 0, 0, 90); sky.addColorStop(0, night > 0.5 ? '#1a1850' : '#8fd3ff'); sky.addColorStop(1, night > 0.5 ? '#3a3080' : '#e6f8ff');
      g.fillStyle = sky; g.fillRect(0, 0, 520, 90);
      if (night > 0.5) { Art.ell(g, 440, 30, 14, 14); Art.fs(g, '#fff6c9'); } else { Art.ell(g, 440, 30, 16, 16); Art.fs(g, '#ffe066'); }
      const wat = g.createLinearGradient(0, 90, 0, 210); wat.addColorStop(0, night > 0.5 ? '#2a4a8a' : '#4fb8f0'); wat.addColorStop(1, night > 0.5 ? '#142a5a' : '#2a7fb0');
      g.fillStyle = wat; g.fillRect(0, 90, 520, 120);
      g.fillStyle = 'rgba(255,255,255,0.35)'; for (let i = 0; i < 8; i++) { const x = (i * 70 + t * 20) % 560 - 20; Art.ell(g, x, 100 + (i % 3) * 30, 18, 2.5); g.fill(); }
      // fish shadows swimming below
      for (let i = 0; i < 3; i++) { const x = (i * 190 + t * (30 + i * 12)) % 600 - 40; g.fillStyle = 'rgba(10,40,80,0.25)'; Art.ell(g, x, 160 + i * 14, 16, 6); g.fill(); }
      // the pier and the girl's rod
      g.fillStyle = '#c98a5a'; g.fillRect(0, 84, 110, 12); g.fillStyle = '#8a5a32'; g.fillRect(20, 96, 8, 60); g.fillRect(80, 96, 8, 60);
      const eq = p.equip;
      Art.drawCharacter(g, 70, 84, { id: eq.char, variant: eq.variant, hat: eq.hat, facing: 1, t, state: 'idle', scale: 0.9 });
      const bx = 330, by = 96 + (state === 'bite' ? 10 + Math.sin(t * 30) * 3 : Math.sin(t * 2) * 2) + dip;
      g.strokeStyle = '#6b4424'; g.lineWidth = 3; g.beginPath(); g.moveTo(84, 60); g.lineTo(150, 20); g.stroke();
      if (state !== 'idle' && state !== 'done') {
        g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 1; g.beginPath(); g.moveTo(150, 20); g.quadraticCurveTo(250, 40, bx, by - 8); g.stroke();
        Art.ell(g, bx, by - 4, 6, 8); Art.fs(g, '#ff5e5e', '#8a2a2a', 1.5); g.fillStyle = '#fff'; g.fillRect(bx - 6, by - 4, 12, 3);
        if (state === 'bite') { g.fillStyle = '#ffd23f'; g.font = '800 30px "Baloo 2", sans-serif'; g.textAlign = 'center'; g.fillText('!', bx, by - 22); }
        if (splash > 0) { splash -= 0.05; g.strokeStyle = 'rgba(255,255,255,' + splash + ')'; g.lineWidth = 2; g.beginPath(); g.ellipse(bx, by + 2, 20 * (1.5 - splash), 5 * (1.5 - splash), 0, 0, Math.PI * 2); g.stroke(); }
      }
      if (caughtFish) { const k = Math.min(1, (t - caughtFish.t) * 2); Bag.drawFish(g, caughtFish.f, 330 - k * 60, 150 - k * 80, 2.2, t); }
      // the bite comes after a random wait; missing the moment loses the fish
      if (state === 'wait' && t >= biteAt) { state = 'bite'; t0 = t; A.play('pop'); setButtons(); }
      else if (state === 'bite' && t - t0 > window) { state = 'idle'; info.textContent = 'Ryba odpłynęła... Następnym razem ciągnij szybciej!'; A.play('wrong'); setButtons(); }
      if (state === 'idle') dip = Math.max(0, dip - 1);
    }
    function setButtons() {
      row.innerHTML = '';
      const left = castsLeft(p), worms = Bag.count(p, 'bait');
      if (state === 'idle') {
        if (left + worms > 0) row.appendChild(h('button.btn.mid.primary', { onclick: cast }, '🎣 Zarzuć wędkę'));
        info.textContent = info.textContent || (left ? 'Ryby biorą jeszcze ' + left + ' ' + U.plural(left, 'raz', 'razy', 'razy') + ' dzisiaj.' + (worms ? ' Masz też ' + Bag.name('bait', worms).toLowerCase() + '.' : '') : worms ? 'Masz ' + Bag.name('bait', worms).toLowerCase() + ' - każdy to jeszcze jedno łowienie.' : 'Na dziś koniec łowienia. Robaczki kupisz u handlarzy.');
        row.appendChild(h('button.btn.mid', { onclick: () => m.close() }, 'Koniec'));
      } else if (state === 'wait' || state === 'bite') {
        row.appendChild(h('button.btn.big' + (state === 'bite' ? '.primary.pulse' : ''), { onclick: pull }, 'Ciągnij!'));
      }
    }
    function cast() {
      const f = Fun.state(p);
      if (castsLeft(p) > 0) f.fishDay.n++;
      else if (!Bag.take(p, 'bait')) return;
      S.save();
      const t = (performance.now() - start) / 1000;
      state = 'wait'; biteAt = t + 1.5 + Math.random() * 3; splash = 1; caughtFish = null; info.textContent = 'Cicho... czekamy, aż ryba chwyci.';
      A.play('splash'); setButtons();
    }
    function pull() {
      if (state === 'wait') { state = 'idle'; info.textContent = 'Za wcześnie! Ryba się wystraszyła.'; A.play('bump'); setButtons(); return; }
      if (state !== 'bite') return;
      fish = roll(G);
      state = 'reel';
      row.innerHTML = '';
      if (fish.r >= 3) {
        info.textContent = 'Duża ryba! Szybko, policz, żeby ją wyciągnąć:';
        Fun.ask(q, p, () => M.question(p.skill, S.mathBand(p)), () => { q.innerHTML = ''; caught(); });
      } else caught();
    }
    function caught() {
      const f = Fun.state(p), bk = f.book.fish, cm = Math.round((8 + fish.r * 7) * (0.8 + Math.random() * 0.5));
      const first = !bk[fish.id];
      bk[fish.id] = { n: (bk[fish.id] ? bk[fish.id].n : 0) + 1, cm: Math.max(cm, bk[fish.id] ? bk[fish.id].cm : 0) };
      Bag.add(p, fish.id);
      S.checkBadges(p); S.save(); A.play(first ? 'star' : 'coin');
      caughtFish = { f: fish, t: (performance.now() - start) / 1000 };
      state = 'idle';
      info.textContent = (first ? 'Nowa ryba w albumie! ' : 'Złowione! ') + fish.name + ', ' + cm + ' cm.';
      setButtons();
    }
    setButtons();
  }

  LZ.Fishing = { open, castsLeft, roll, FREE };
})();
