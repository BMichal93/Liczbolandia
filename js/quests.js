/*
 * quests.js - the quest board: three small tasks every day and one big one
 * every week, each with a reward to collect.
 *
 * Tasks are drawn from what she already does (coins, stomps, good answers,
 * levels, the tower, the arcade, fishing, baking...) so they nudge her
 * towards parts of the game she might have forgotten. Only tasks she can
 * actually do are offered: no fishing task before she's ever caught a fish.
 * Progress is counted from a snapshot of the counters taken when the task
 * appears, so nothing done before counts.
 *
 * Save data: fun.quests = { day, daily: [{ id, need, base, claimed }], bonus,
 *   week, weekly: { id, need, base, claimed } }; fun.cnt (levels, nohit,
 *   weekly, daily, arcade, towerFloors) is filled by the hooks below and by
 *   tower.js / arcade.js.
 */
(function () {
  const U = LZ.U, S = LZ.S, A = LZ.A, Fun = LZ.Fun, Bag = LZ.Bag;
  const sum = o => Object.values(o || {}).reduce((a, v) => a + (typeof v === 'number' ? v : (v && v.n) || 0), 0);

  // every counter a task can watch
  function counts(p) {
    const f = Fun.state(p), c = f.cnt || {}, b = f.book || {};
    return {
      coins: p.stats.totalCoins || 0, stomps: p.stats.stomps || 0, correct: p.stats.correct || 0,
      levels: c.levels || 0, nohit: c.nohit || 0, weekly: c.weekly || 0, daily: c.daily || 0,
      floors: c.towerFloors || 0, arcade: c.arcade || 0,
      fish: sum(b.fish), crops: sum(b.crops), cakes: sum(b.cakes),
      giants: f.giantCount || 0, chests: (p.world && p.world.chestCount) || 0,
    };
  }
  /*
   * The tasks. need(t) gets the maths tier (1-5) so the older sister's tasks
   * are a bit bigger; can(p, c) says whether it makes sense for her yet.
   */
  const DAILY = [
    { id: 'coins', icon: '🪙', ctr: 'coins', need: t => 40 + t * 10, text: n => 'Zbierz ' + n + ' monet' },
    { id: 'stomps', icon: '🐾', ctr: 'stomps', need: t => 6 + t, text: n => 'Wskocz na ' + n + ' stworków' },
    { id: 'correct', icon: '✅', ctr: 'correct', need: t => 8 + t * 2, text: n => 'Odpowiedz dobrze na ' + n + ' pytań' },
    { id: 'levels', icon: '🚩', ctr: 'levels', need: () => 2, text: n => 'Ukończ ' + n + ' poziomy' },
    { id: 'nohit', icon: '💖', ctr: 'nohit', need: () => 1, text: () => 'Przejdź poziom bez utraty serduszka' },
    { id: 'floors', icon: '🗼', ctr: 'floors', need: t => 10 + t * 2, text: n => 'Wejdź w Wieży łącznie na ' + n + ' pięter' },
    { id: 'arcade', icon: '🕹️', ctr: 'arcade', need: () => 2, text: n => 'Zagraj ' + n + ' razy na automacie w domku', can: p => LZ.Arcade && LZ.Home.homeOf(p).items.some(i => i.id === 'arcade') },
    { id: 'weekly', icon: '🗓️', ctr: 'weekly', need: () => 1, text: () => 'Przejdź poziom Świata tygodnia', can: p => LZ.Weekly.progress(p).done < 6 },
    { id: 'daily', icon: '📅', ctr: 'daily', need: () => 1, text: () => 'Zagraj Poziom dnia', can: p => !(p.daily && p.daily.played === LZ.X.dateKey()) },
    { id: 'fish', icon: '🐟', ctr: 'fish', need: () => 2, text: n => 'Złów ' + n + ' ryby', can: (p, c) => c.fish > 0 },
    { id: 'crops', icon: '🥕', ctr: 'crops', need: () => 4, text: n => 'Zbierz ' + n + ' plonów z ogródka', can: (p, c) => c.crops > 0 },
    { id: 'cakes', icon: '🎂', ctr: 'cakes', need: () => 1, text: () => 'Upiecz ciasto', can: (p, c) => c.cakes > 0 },
    { id: 'chests', icon: '🎁', ctr: 'chests', need: () => 2, text: n => 'Otwórz ' + n + ' skrzynie na wyprawie', can: (p, c) => c.chests > 0 },
    { id: 'giants', icon: '👹', ctr: 'giants', need: () => 1, text: () => 'Pokonaj olbrzyma na wyprawie', can: (p, c) => c.giants > 0 },
  ];
  const WEEKLY = [
    { id: 'w_coins', icon: '🪙', ctr: 'coins', need: t => 300 + t * 50, text: n => 'Zbierz w tym tygodniu ' + n + ' monet' },
    { id: 'w_correct', icon: '✅', ctr: 'correct', need: t => 50 + t * 10, text: n => 'Odpowiedz dobrze na ' + n + ' pytań' },
    { id: 'w_floors', icon: '🗼', ctr: 'floors', need: t => 60 + t * 10, text: n => 'Wejdź w Wieży łącznie na ' + n + ' pięter' },
    { id: 'w_levels', icon: '🚩', ctr: 'levels', need: () => 10, text: n => 'Ukończ ' + n + ' poziomów' },
    { id: 'w_stomps', icon: '🐾', ctr: 'stomps', need: t => 35 + t * 5, text: n => 'Wskocz na ' + n + ' stworków' },
    { id: 'w_week', icon: '🗓️', ctr: 'weekly', need: () => 6, text: () => 'Przejdź cały Świat tygodnia' },
  ];
  const BY = {}; DAILY.concat(WEEKLY).forEach(q => { BY[q.id] = q; });
  const MATS = ['iron', 'feather', 'gem', 'stone', 'iron', 'feather'];

  function hash(s) { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
  function monday() { const d = new Date(); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return LZ.X.dateKey(d); }

  // today's and this week's tasks, made when the day or week changes
  function board(p) {
    const f = Fun.state(p), c = counts(p), day = LZ.X.dateKey(), wk = monday();
    const q = f.quests = f.quests || {};
    const tier = U.clamp(Math.round(p.skill || 1), 1, 5);
    if (q.day !== day) {
      const r = U.rng(hash(day + '|' + p.name));
      const pool = U.shuffle(r, DAILY.filter(d => !d.can || d.can(p, c)));
      // the first three, but never two tasks that count the same thing
      const pick = [];
      for (const d of pool) { if (pick.length < 3 && !pick.some(x => x.ctr === d.ctr)) pick.push(d); }
      q.day = day; q.bonus = false;
      q.daily = pick.map(d => ({ id: d.id, need: d.need(tier), base: c[d.ctr], claimed: false }));
    }
    if (q.week !== wk) {
      const r = U.rng(hash(wk + '#' + p.name));
      const d = WEEKLY[Math.floor(r() * WEEKLY.length)];
      q.week = wk;
      q.weekly = { id: d.id, need: d.need(tier), base: d.ctr === 'weekly' ? 0 : c[d.ctr], claimed: false };
      // the whole World of the week counts its own progress, whenever she started it
      if (d.ctr === 'weekly') q.weekly.useWeek = true;
    }
    return q;
  }
  function progressOf(p, it, c) {
    const d = BY[it.id];
    const got = it.useWeek ? LZ.Weekly.progress(p).done : (c || counts(p))[d.ctr] - it.base;
    return Math.max(0, Math.min(it.need, got));
  }
  // for the hub button: how many tasks are done today
  function tag(p) {
    const q = board(p), c = counts(p);
    const ready = q.daily.filter(it => !it.claimed && progressOf(p, it, c) >= it.need).length + (!q.weekly.claimed && progressOf(p, q.weekly, c) >= q.weekly.need ? 1 : 0);
    if (ready) return ready + ' 🎁';
    return q.daily.filter(it => it.claimed).length + '/3';
  }

  function claim(p, it, weekly) {
    if (it.claimed) return null;
    it.claimed = true;
    const got = [];
    const coins = weekly ? 80 : 15;
    p.coins += coins; p.stats.totalCoins += coins; got.push(coins + ' monet');
    const mat = weekly ? 'gold' : MATS[Math.floor(Math.random() * MATS.length)], n = weekly ? 2 : 1;
    Bag.add(p, mat, n); got.push(Bag.name(mat, n).toLowerCase());
    const f = Fun.state(p); f.questsDone = (f.questsDone || 0) + 1;
    const q = f.quests;
    if (!weekly && !q.bonus && q.daily.every(x => x.claimed)) {
      // all three today: a little extra
      q.bonus = true; p.coins += 25; p.stats.totalCoins += 25; Bag.add(p, 'star', 1);
      got.push('premia za komplet: 25 monet i gwiezdny odłamek');
    }
    S.checkBadges(p); S.save();
    return got;
  }

  function open() {
    const UI = LZ.UI, h = UI._h, p = S.active();
    let m = null;
    function render() {
      const q = board(p), c = counts(p);
      const line = (it, weekly) => {
        const d = BY[it.id], got = progressOf(p, it, c), done = got >= it.need;
        return h('div.qline' + (it.claimed ? '.done' : ''), null, [
          h('span.qi', null, d.icon),
          h('div.qt', null, [
            h('b', null, d.text(it.need)),
            h('div.qbar', null, [h('i', { style: 'width:' + Math.round(got / it.need * 100) + '%' })]),
            h('small', null, got + ' / ' + it.need + (weekly ? ' · nagroda: 80 monet i 2 złote bryłki' : ' · nagroda: 15 monet i materiał')),
          ]),
          it.claimed ? h('span.qok', null, '✓') : h('button.btn.small' + (done ? '.primary' : '.ghost'), { disabled: !done, onclick: () => {
            const got2 = claim(p, it, weekly); if (!got2) return;
            A.play('star'); render();
            m.box.appendChild(h('p.qgot', null, 'Odebrane: ' + got2.join(', ') + '!'));
          } }, done ? 'Odbierz' : '...'),
        ]);
      };
      const content = [
        h('h2', null, '📋 Tablica zadań'),
        h('h3', null, 'Na dziś'),
        h('div.qlist', null, q.daily.map(it => line(it, false))),
        h('p.note', null, q.bonus ? 'Komplet na dziś zrobiony! Jutro nowe zadania.' : 'Zrób wszystkie trzy, a dostaniesz premię!'),
        h('h3', null, 'Na ten tydzień'),
        h('div.qlist', null, [line(q.weekly, true)]),
        h('button.btn.mid', { onclick: () => m.close() }, 'Zamknij'),
      ];
      if (m) { m.box.innerHTML = ''; content.forEach(el => m.box.appendChild(el)); }
      else m = UI._modal(content);
    }
    render();
    return m;
  }

  // levels finished, without a scratch, of the week, of the day: counted for the tasks
  LZ.Ext.add({
    game: {
      finish(p, G, run) {
        if (G.kind === 'home' || G.kind === 'world' || G.kind === 'tower') return;
        const f = Fun.state(p), c = f.cnt = f.cnt || {};
        c.levels = (c.levels || 0) + 1;
        if (!run.hits) c.nohit = (c.nohit || 0) + 1;
        if (G.kind === 'weekly') c.weekly = (c.weekly || 0) + 1;
        if (G.kind === 'daily') c.daily = (c.daily || 0) + 1;
      },
    },
  });

  LZ.Quests = { open, tag, board, counts, claim, progressOf, DAILY, WEEKLY };
})();
