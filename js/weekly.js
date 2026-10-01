/*
 * weekly.js - "Świat tygodnia": a brand-new world every Monday.
 *
 * Each week the date picks one of the worlds as a base (its look, creatures
 * and boss) and adds a twist borrowed from another world: ice everywhere,
 * low gravity, wind, conveyor belts, bouncy mushrooms, falling platforms,
 * vanishing clouds or quicksand. Five levels and the boss, made by the
 * normal level generator with the week as the seed, so both sisters get
 * the same world that week. Finishing all six gives the week's cup for the
 * house and coins; next Monday there's a new world.
 *
 * Save data: fun.weekly = { key: monday's dateKey, done: { li: 1 }, cup }, fun.cups.
 */
(function () {
  const U = LZ.U, S = LZ.S, A = LZ.A, D = LZ.D, Fun = LZ.Fun;
  const BASES = [1, 2, 4, 5, 6, 7, 8, 9];   // not the reef: a whole world under water doesn't mix with the twists
  const TWISTS = [
    { f: 'ice', name: 'Wszędzie ślisko', desc: 'Lód pod nogami - hamuj zawczasu!' },
    { f: 'lowgrav', name: 'Niska grawitacja', desc: 'Skoki jak na Księżycu, długie i wysokie.' },
    { f: 'wind', name: 'Wietrzny tydzień', desc: 'Podmuchy wiatru niosą w górę.' },
    { f: 'conveyor', name: 'Taśmociągi', desc: 'Ziemia sama jedzie - w przód albo w tył!' },
    { f: 'mushroom', name: 'Grzybowe trampoliny', desc: 'Skacz po grzybach wysoko w górę.' },
    { f: 'falling', name: 'Spadające kładki', desc: 'Nie stój długo na kładkach!' },
    { f: 'cloud', name: 'Znikające chmurki', desc: 'Chmurki rozpływają się pod stopami.' },
    { f: 'quicksand', name: 'Ruchome piaski', desc: 'Piasek wciąga - skacz szybko!' },
  ];
  const LEVELS = 5, BOSS = 6;

  function monday(d) { d = new Date(d || Date.now()); const day = (d.getDay() + 6) % 7; d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - day); return d; }
  // everything about this week's world, the same for everyone that week
  function info(when) {
    const m = monday(when), key = LZ.X.dateKey(m), n = Math.round(m.getTime() / (7 * 864e5));
    const r = U.rng(n * 7919 + 17);
    const wi = BASES[Math.floor(r() * BASES.length)], base = D.WORLDS[wi - 1];
    const twists = TWISTS.filter(t => !base.features.includes(t.f));
    const twist = twists[Math.floor(r() * twists.length)];
    const next = new Date(m); next.setDate(next.getDate() + 7);
    const daysLeft = Math.max(1, Math.ceil((next - Date.now()) / 864e5));
    const world = Object.assign({}, base, { name: base.name + ': ' + twist.name, features: base.features.concat([twist.f]), weekly: true });
    return { key, n, wi, base, twist, world, name: base.name, daysLeft };
  }
  function progress(p) {
    const f = Fun.state(p), wk = info();
    if (!f.weekly || f.weekly.key !== wk.key) f.weekly = { key: wk.key, done: {}, cup: false };
    return { done: Object.keys(f.weekly.done).length, all: f.weekly };
  }
  function level(mode) {
    const wk = info(mode.when);   // when: only the tests look at other weeks
    const lvl = LZ.Gen.generate(wk.wi, mode.li === BOSS ? D.LEVELS_PER_WORLD : mode.li + 1, { daily: wk.n * 31 + mode.li, world: wk.world });
    lvl.noStars = true;
    lvl.themeName = 'Świat tygodnia ' + mode.li + (mode.li === BOSS ? ' (boss)' : '');
    return lvl;
  }
  // after a level of the week (game.js finish)
  function win(p, mode) {
    const pr = progress(p), w = pr.all, lines = [];
    w.done[mode.li] = 1;
    let head = mode.li === BOSS ? 'Boss tygodnia pokonany!' : 'Poziom ' + mode.li + ' z 5 zaliczony!';
    if (Object.keys(w.done).length >= BOSS && !w.cup) {
      w.cup = true;
      const f = Fun.state(p); f.cups = (f.cups || 0) + 1;
      const home = LZ.Home.homeOf(p); home.inv.weekcup = (home.inv.weekcup || 0) + 1;
      p.coins += 60; p.stats.totalCoins += 60;
      head = 'Cały Świat tygodnia przebyty!';
      lines.push('🏆 Puchar tygodnia do domku (masz już ' + f.cups + ')', '+ 60 monet', 'W poniedziałek nowy świat!');
    } else if (mode.li < BOSS) lines.push('Następny: ' + (mode.li + 1 === BOSS ? 'boss tygodnia' : 'poziom ' + (mode.li + 1)));
    S.checkBadges(p); S.save();
    return { head, lines, next: mode.li < BOSS };
  }
  // the week's map: five levels and the boss, one after another
  function screen() {
    const UI = LZ.UI, h = UI._h, p = S.active(), wk = info(), pr = progress(p), w = pr.all;
    if (!document.querySelector('.screen.hub')) UI.hub();
    const pal = wk.base.pal;
    const nodes = [];
    for (let li = 1; li <= BOSS; li++) {
      const done = !!w.done[li], open = li === 1 || !!w.done[li - 1];
      nodes.push(h('button.wknode' + (done ? '.done' : '') + (!open ? '.lock' : '') + (li === BOSS ? '.boss' : ''), { onclick: () => {
        if (!open) { A.play('bump'); return; }
        m.close(); UI.play(wk.wi, li, { kind: 'weekly', li, week: wk.key });
      } }, li === BOSS ? '👑' : String(li)));
    }
    const m = UI._modal([
      h('h2', null, '🗓️ Świat tygodnia'),
      h('div.dailyworld', { style: 'background:linear-gradient(160deg,' + pal.skyTop + ',' + pal.skyBot + ')' }, [h('b', null, wk.name), h('div', null, '✨ ' + wk.twist.name + ' - ' + wk.twist.desc)]),
      h('div.wknodes', null, nodes),
      h('p.note', null, (w.cup ? '🏆 Puchar tego tygodnia już jest twój! ' : 'Przejdź wszystkie 6 i zdobądź puchar tygodnia. ') + 'Nowy świat za ' + wk.daysLeft + ' ' + U.plural(wk.daysLeft, 'dzień', 'dni', 'dni') + '.'),
      h('button.btn.mid', { onclick: () => m.close() }, 'Wróć'),
    ]);
  }
  // the cup for the house
  function drawCup(g, X, Y, w, t) {
    const cx = X + w / 2, Art = LZ.Art;
    U.rr(g, cx - 18, Y - 12, 36, 12, 3); Art.fs(g, '#8a5a32', '#5c3a1c', 2);
    U.rr(g, cx - 5, Y - 26, 10, 14, 2); Art.fs(g, '#ffd23f', '#b8861c', 1.5);
    g.beginPath(); g.moveTo(cx - 22, Y - 64); g.lineTo(cx + 22, Y - 64); g.quadraticCurveTo(cx + 20, Y - 30, cx, Y - 26); g.quadraticCurveTo(cx - 20, Y - 30, cx - 22, Y - 64); Art.fs(g, '#ffd23f', '#b8861c', 2);
    for (const s of [-1, 1]) { g.beginPath(); g.arc(cx + s * 24, Y - 52, 8, s > 0 ? -1.4 : Math.PI - 1.7, s > 0 ? 1.7 : Math.PI + 1.4); g.strokeStyle = '#b8861c'; g.lineWidth = 4; g.stroke(); }
    Art.starPath(g, cx, Y - 48, 8, 3.5, 5, 0); Art.fs(g, '#fff6c9');
    if (Math.sin(t * 2) > 0.6) { Art.starPath(g, cx + 12, Y - 60, 4, 1, 4, 0); Art.fs(g, '#fff'); }
  }
  LZ.Ext.add({ furn: { draw(g, id, X, Y, w, t) { if (id !== 'weekcup') return false; drawCup(g, X, Y, w, t); return true; } } });

  LZ.Weekly = { info, progress, level, win, screen, BOSS, TWISTS };
})();
