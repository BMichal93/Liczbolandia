/*
 * ui.js - every menu screen (HTML over the canvas).
 *
 * Menus are HTML rather than canvas because text, scrolling lists and the
 * name input field all come for free, look sharp, and are easy to read at
 * any size. The canvas underneath keeps animating a pretty scene.
 */
(function () {
  const D = LZ.D, S = LZ.S, A = LZ.A, U = LZ.U, M = LZ.M;
  const root = () => document.getElementById('ui');
  let paused = false;
  let currentWorld = 1;
  const previews = [];   // live character canvases animated by main.js

  /* Tiny DOM builder: h('div.card', {onclick}, [children]) */
  function h(tag, attrs, kids) {
    const [t, ...cls] = tag.split('.');
    const el = document.createElement(t || 'div');
    if (cls.length) el.className = cls.join(' ');
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (k.startsWith('on')) el.addEventListener(k.slice(2), (e) => { if (k === 'onclick') A.play('click'); v(e); });
      else if (k === 'style') el.setAttribute('style', v);
      else if (k === 'html') el.innerHTML = v;
      else if (v !== false && v != null) el.setAttribute(k, v);
    }
    (Array.isArray(kids) ? kids : kids != null ? [kids] : []).forEach(c => { if (c == null || c === false) return; el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c); });
    return el;
  }
  const coinIcon = () => h('span.coin-ico');
  const CRAFT_TEXT = 'Uszyje ją Krawcowa Tosia - jej pracownia stoi na wyprawie, tuż za domkiem w prawo. Potrzebne są materiały z wyprawy.';
  const starIcon = (on) => h('span.star-ico' + (on === false ? '.off' : ''));

  function show(el) {
    // Drop previews from the previous screen; the new screen's previews
    // were registered while `el` was being built, so keep those.
    for (let i = previews.length - 1; i >= 0; i--) if (previews[i].canvas.isConnected) previews.splice(i, 1);
    const r = root(); r.innerHTML = ''; r.appendChild(el); r.classList.remove('hidden');
    document.getElementById('hud').classList.add('hidden');
    r.scrollTop = 0;
  }
  function hide() { root().classList.add('hidden'); root().innerHTML = ''; previews.length = 0; }

  function preview(opts, size) {
    const c = h('canvas.preview', { width: size * 2, height: size * 2, style: 'width:' + size + 'px;height:' + size + 'px' });
    previews.push({ canvas: c, opts, size });
    return c;
  }

  /* ---------------- modal ---------------- */
  function modal(content, opts) {
    opts = opts || {};
    const back = h('div.modal-back', { onclick: (e) => { if (e.target === back && opts.dismiss !== false) close(); } });
    const box = h('div.modal', null, content);
    back.appendChild(box);
    document.body.appendChild(back);
    function close() { back.remove(); if (opts.onclose) opts.onclose(); }
    return { close, box };
  }
  function alertBox(title, text, then) {
    const m = modal([h('h2', null, title), h('p', null, text), h('button.btn.primary', { onclick: () => { m.close(); if (then) then(); } }, 'OK')]);
  }
  function confirmBox(title, text, yes, no) {
    const m = modal([h('h2', null, title), h('p', null, text), h('div.row', null, [
      h('button.btn', { onclick: () => { m.close(); if (no) no(); } }, 'Nie'),
      h('button.btn.primary', { onclick: () => { m.close(); yes(); } }, 'Tak'),
    ])]);
  }

  /* ================= TITLE ================= */
  function title() {
    A.playMusic(5);
    show(h('div.screen.title', null, [
      h('div.logo', null, [h('span', null, 'Liczbo'), h('span.l2', null, 'landia')]),
      h('p.tag', null, 'Skacz, zbieraj, licz!'),
      h('button.btn.big.primary.pulse', { onclick: () => { A.unlock(); profiles(); } }, 'Graj!'),
      installHint(),
      h('button.btn.small.ghost', { onclick: shareGame }, 'Udostępnij grę (kod QR)'),
    ]));
  }
  let deferredInstall = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; });
  function installHint() {
    const standalone = matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone;
    if (standalone) return null;
    return h('button.btn.small.ghost', { onclick: installFlow }, 'Dodaj grę na ekran telefonu');
  }
  function installFlow() {
    if (deferredInstall) { deferredInstall.prompt(); deferredInstall.userChoice.finally(() => { deferredInstall = null; }); return; }
    alertBox('Jak dodać grę na ekran?', 'W Chrome na Androidzie: dotknij menu ⋮ w prawym górnym rogu i wybierz „Dodaj do ekranu głównego” (lub „Zainstaluj aplikację”). Potem gra otwiera się z ikonki, bez przeglądarki.');
  }

  /* Contents of a difficulty card: name, what maths it has, and the reward
     multiplier - shown big so choosing the harder level feels worth it. */
  function lvlBody(m) {
    return [
      h('div.lvlname', null, [m.icon + ' ', m.name]),
      h('div.lvldesc', null, m.desc),
      m.note ? h('div.lvlnote', null, m.note) : null,
      h('div.lvlrew', null, ['Nagrody ', h('b', null, '×' + String(m.reward).replace('.', ','))]),
    ];
  }

  /*
   * "Udostępnij grę": the easy way to pass the game on.
   *  - QR code on screen: another Android phone scans it -> install page
   *    with one "Zainstaluj" button (install.html)
   *  - share button: the phone's own share menu (WhatsApp, Messenger, SMS...)
   *    with the same install link
   *  - copy link as a fallback where sharing isn't available (laptops)
   */
  const INSTALL_URL = 'https://bmichal93.github.io/Liczbolandia/install.html';
  function shareGame() {
    const shareBtn = navigator.share ? h('button.btn.mid.primary', { onclick: () => {
      navigator.share({ title: 'Liczbolandia', text: 'Liczbolandia - gra z matematyką dla dzieci. Otwórz link i dotknij „Zainstaluj grę”:', url: INSTALL_URL }).catch(() => {});
    } }, 'Wyślij link') : null;
    const copyBtn = h('button.btn.mid', { onclick: (e) => {
      const done = () => { e.target.textContent = 'Skopiowano!'; };
      (navigator.clipboard ? navigator.clipboard.writeText(INSTALL_URL) : Promise.reject()).then(done).catch(() => { const t = h('textarea'); t.value = INSTALL_URL; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); done(); });
    } }, 'Kopiuj link');
    const m = modal([
      h('h2', null, 'Udostępnij grę'),
      h('img.qrimg', { src: 'qr.png', alt: 'Kod QR do instalacji gry' }),
      h('p', null, 'Zeskanuj aparatem telefonu z Androidem i dotknij „Zainstaluj grę”.'),
      h('div.row.wrap.center-row', null, [shareBtn, copyBtn, h('button.btn.mid', { onclick: () => m.close() }, 'Zamknij')]),
    ]);
  }

  /* ================= PROFILES ================= */
  function profiles() {
    const data = S.data;
    const cards = data.profiles.map(p => h('div.pcard', { onclick: () => { S.setActive(p.id); hub(); } }, [
      preview({ id: p.equip.char, variant: p.equip.variant, hat: p.equip.hat }, 110),
      h('div.pname', null, p.name),
      h('div.pmeta', null, [starIcon(), ' ' + D.countStars(p) + '   ', coinIcon(), ' ' + p.coins]),
      h('button.del', { title: 'Usuń gracza', onclick: (e) => { e.stopPropagation(); confirmBox('Usunąć gracza?', 'Cały postęp gracza „' + p.name + '” zniknie. Na pewno?', () => { S.removeProfile(p.id); profiles(); }); } }, '×'),
    ]));
    if (data.profiles.length < 6) cards.push(h('div.pcard.add', { onclick: newProfile }, [h('div.plus', null, '+'), h('div.pname', null, 'Nowy gracz')]));
    show(h('div.screen', null, [
      h('div.topbar', null, [h('button.btn.small', { onclick: title }, '← Wróć'), h('h1', null, 'Kto gra?'), h('span')]),
      h('div.pgrid', null, cards),
    ]));
  }
  function newProfile() {
    let level = 1, name = '';
    const input = h('input.name', { maxlength: 14, placeholder: 'Twoje imię', autocomplete: 'off' });
    input.addEventListener('input', () => { name = input.value.trim(); });
    const levels = h('div.levels', null, D.MATH_LEVELS.map(m => {
      const el = h('div.lvlcard' + (m.id === 1 ? '.sel' : ''), { onclick: () => { level = m.id; levels.querySelectorAll('.lvlcard').forEach(x => x.classList.remove('sel')); el.classList.add('sel'); } }, [
      ].concat(lvlBody(m)));
      return el;
    }));
    show(h('div.screen', null, [
      h('div.topbar', null, [h('button.btn.small', { onclick: profiles }, '← Wróć'), h('h1', null, 'Nowy gracz'), h('span')]),
      h('div.panel', null, [
        h('label', null, 'Jak masz na imię?'), input,
        h('label', null, 'Jak trudna matematyka?'),
        levels,
        h('p.note', null, 'Trudniejszy poziom = więcej monet za dobre odpowiedzi. W ramach poziomu gra sama dopasowuje zadania: po dobrych odpowiedziach trochę trudniejsze, po błędach łatwiejsze. Poziom można zmienić w ustawieniach.'),
        h('button.btn.big.primary', { onclick: () => {
          if (!name) { input.classList.add('shake'); setTimeout(() => input.classList.remove('shake'), 500); input.focus(); return; }
          const p = S.addProfile(name, level); S.setActive(p.id); A.play('buy'); hub();
        } }, 'Zaczynamy!'),
      ]),
    ]));
    setTimeout(() => input.focus(), 100);
  }

  /* ================= HUB ================= */
  function hub() {
    const p = S.active(); if (!p) return profiles();
    A.playMusic(5);
    const newBadges = S.checkBadges(p); S.save();
    // the daily button shows a tick when today's goal is done, or the running streak
    const doneToday = p.daily && p.daily.last === LZ.X.dateKey();
    const streakOn = p.daily && p.daily.streak > 1 && p.daily.last >= LZ.X.dateKey(new Date(Date.now() - 86400000));
    const dailyTag = doneToday ? h('span.tag.ok', null, '✓') : streakOn ? h('span.tag', null, p.daily.streak + ' dni 🔥') : null;
    show(h('div.screen.hub', null, [
      h('div.topbar', null, [
        h('button.btn.small', { onclick: profiles }, 'Zmień gracza'),
        h('div.who', null, [h('b', null, p.name), '  ', starIcon(), ' ' + D.countStars(p) + '  ', coinIcon(), ' ' + p.coins]),
        h('button.btn.small', { onclick: settings }, '⚙ Ustawienia'),
      ]),
      h('div.hubmain', null, [
        h('div.hero', null, [preview({ id: p.equip.char, variant: p.equip.variant, hat: p.equip.hat, walk: true }, 170)]),
        /*
         * The menu in three tiers, most important first: the two ways to play
         * (big picture tiles with a one-line hint), then three everyday extras,
         * then the collections. One icon + one word per button, so a 7-year-old
         * can find things before she can read every label.
         */
        h('div.hubbtns', null, [
          h('div.hubtiles', null, [
            h('button.hubtile.mission', { onclick: () => worlds() }, [h('span.ti', null, '🗺️'), h('b', null, 'Misja'), h('small', null, 'Poziomy i bossowie')]),
            h('button.hubtile.trip', { onclick: () => play(0, 0, { kind: 'home' }) }, [h('span.ti', null, '🏠'), h('b', null, 'Wyprawa'), h('small', null, 'Domek i wielki świat')]),
            h('button.hubtile.chall', { onclick: challenges }, [h('span.ti', null, '🏆'), h('b', null, 'Wyzwania'), h('small', null, 'Tydzień, wieża, dzień'), dailyTag]),
          ]),
          h('div.hubrow', null, [
            h('button.hubbtn.orange', { onclick: () => LZ.Quests.open() }, [h('span.ti', null, '📋'), 'Zadania', h('span.tag', null, LZ.Quests.tag(p))]),
            h('button.hubbtn.purple', { onclick: () => workshop() }, [h('span.ti', null, '🔨'), 'Pracownia']),
            h('button.hubbtn.pink', { onclick: () => wardrobe('chars') }, [h('span.ti', null, '👗'), 'Garderoba']),
          ]),
          h('div.hubrow.small', null, [
            h('button.hubpill', { onclick: badges }, '🏅 Odznaki'),
            h('button.hubpill', { onclick: album }, '📖 Album'),
            h('button.hubpill', { onclick: stats }, '📊 Wyniki'),
          ]),
        ]),
      ]),
    ]));
    if (newBadges.length) celebrateBadges(newBadges);
    else checkPendingLevel();
  }

  /* ================= WORLDS & LEVELS ================= */
  function worlds() {
    const p = S.active();
    const cards = D.WORLDS.map(w => {
      const open = S.isWorldUnlocked(p, w.id);
      let st = 0; for (let l = 1; l < D.LEVELS_PER_WORLD; l++) st += (p.stars[S.levelKey(w.id, l)] || []).filter(Boolean).length;
      const maxSt = (D.LEVELS_PER_WORLD - 1) * 3;   // the boss always pays its 3 stars, so the card counts the ones you have to find
      const beaten = p.bossWins.includes(w.id);
      return h('div.wcard' + (open ? '' : '.locked'), {
        style: 'background:linear-gradient(160deg,' + w.pal.skyTop + ',' + w.pal.skyBot + ')',
        onclick: () => { if (open) levels(w.id); else alertBox('Jeszcze zamknięte', 'Pokonaj bossa poprzedniego świata, żeby tu wejść!'); },
      }, [
        h('div.wnum', null, 'Świat ' + w.id),
        h('div.wname', null, w.name),
        h('div.wsub', null, open ? w.sub : '🔒'),
        h('div.wground', { style: 'background:' + w.pal.grass + ';border-top:6px solid ' + w.pal.grassDark }),
        open ? h('div.wstars', null, [starIcon(), ' ' + st + '/' + maxSt, beaten ? h('span.crown', null, ' 👑') : null]) : null,
      ]);
    });
    show(h('div.screen', null, [
      h('div.topbar', null, [h('button.btn.small', { onclick: hub }, '← Wróć'), h('h1', null, 'Mapa świata'), h('span')]),
      h('div.wgrid', null, cards.concat((p.starItems || []).includes('bonus_level') ? [h('div.wcard.bonus', {
        style: 'background:linear-gradient(160deg,' + D.BONUS_WORLD.pal.skyTop + ',' + D.BONUS_WORLD.pal.skyBot + ')', onclick: () => play(D.BONUS_ID, 1),
      }, [h('div.wnum', null, 'Tajny poziom'), h('div.wname', null, D.BONUS_WORLD.name), h('div.wsub', null, D.BONUS_WORLD.sub), h('div.wground', { style: 'background:' + D.BONUS_WORLD.pal.grass + ';border-top:6px solid ' + D.BONUS_WORLD.pal.grassDark })])] : [])),
    ]));
  }
  function levels(wi, night) {
    currentWorld = wi;
    const p = S.active(), w0 = D.WORLDS[wi - 1];
    const nightOpen = S.isHardUnlocked(p, wi);
    if (!nightOpen) night = false;
    const w = night ? LZ.Art.nightWorld(w0) : w0;
    const nodes = [];
    for (let l = 1; l <= D.LEVELS_PER_WORLD; l++) {
      const key = S.levelKey(wi, l), boss = l === D.LEVELS_PER_WORLD;
      const open = night ? S.isHardLevelUnlocked(p, wi, l) : S.isLevelUnlocked(p, wi, l);
      const done = night ? !!p.hard.done[key] : !!p.done[key];
      const st = p.stars[key] || [], md = (p.medals || {})[key] || [];
      nodes.push(h('div.lnode' + (open ? '' : '.locked') + (boss ? '.boss' : '') + (done ? '.done' : '') + (night ? '.night' : ''), {
        onclick: () => { if (open) play(wi, l, night ? { kind: 'hard' } : null); },
      }, [
        h('div.lnum', null, boss ? 'BOSS' : String(l)),
        boss ? h('div.lbossname', null, w.boss.name)
          : night ? h('div.lstars', null, done ? '🌙' : '')
          : h('div.lstars', null, [0, 1, 2].map(i => starIcon(!!st[i]))),
        boss || night ? null : h('div.lmedals', null, LZ.X.MEDALS.map((m, i) => h('span.medal' + (md[i] ? '.got' : ''), { title: m.name }, m.icon))),
        !open ? h('div.lock', null, '🔒') : null,
      ]));
    }
    const medals = D.medalCount(p, wi);
    const toggle = p.bossWins.includes(wi)
      ? h('button.btn.small' + (night ? '.gold' : '.night'), { onclick: () => { if (nightOpen) levels(wi, !night); else alertBox('Noc jeszcze zamknięta', 'Zdobądź ' + S.NIGHT_MEDALS + ' medali w tym świecie (masz ' + medals + '), a otworzy się jego nocna, trudniejsza wersja.'); } }, night ? '☀ Dzień' : (nightOpen ? '🌙 Noc' : '🌙 ' + medals + '/' + S.NIGHT_MEDALS))
      : h('span');
    show(h('div.screen' + (night ? '.nightscreen' : ''), { style: 'background:linear-gradient(160deg,' + w.pal.skyTop + 'dd,' + w.pal.skyBot + 'dd)' }, [
      h('div.topbar', null, [h('button.btn.small', { onclick: worlds }, '← Mapa'), h('h1', null, (night ? 'Noc: ' : '') + w.name), toggle]),
      h('div.lpath', null, nodes),
      h('p.note.center', null, night ? 'Nocą przeciwnicy są szybsi, a bossowie silniejsi. Gwiazdek tu nie ma, za to są nagrody za nocnych bossów!'
        : 'Medale: ⏱ zdąż przed czasem, ❤ nie strać serduszka, ● zbierz 90% monet. ' + S.NIGHT_MEDALS + ' medali otwiera noc w tym świecie!'),
    ]));
  }

  /* ================= PLAY ================= */
  // where "Wyjdź" (pause) and "Mapa" (results) lead back to, by run kind
  let exitTo = () => levels(currentWorld);
  function play(wi, li, mode) {
    hide();
    paused = false;
    document.getElementById('hud').classList.remove('hidden');
    LZ.In.reset();
    const kind = mode ? mode.kind : 'normal';
    exitTo = kind === 'weekly' ? () => LZ.Weekly.screen() : kind === 'tower' ? () => challenges() : kind === 'wboss' || kind === 'temple' ? () => play(0, 0, { kind: 'world', at: mode.back }) : kind === 'daily' || kind === 'home' || kind === 'world' ? hub : kind === 'custom' ? () => (mode.test ? LZ.Editor.open(mode.id) : workshop()) : kind === 'hard' ? () => levels(wi, true) : () => levels(wi);
    LZ.Game.start(wi, li, mode);
    tryFullscreen();
  }
  function tryFullscreen() {
    // In the installed app the manifest already gives fullscreen; in a
    // browser tab we ask for it on the first level start (needs a tap).
    const el = document.documentElement;
    const standalone = matchMedia('(display-mode: fullscreen)').matches || matchMedia('(display-mode: standalone)').matches;
    if (!standalone && LZ.In.touch && !document.fullscreenElement && el.requestFullscreen) {
      el.requestFullscreen().then(() => { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); }).catch(() => {});
    }
  }
  function togglePause() {
    if (!LZ.Game.active || LZ.Game.state === 'goal' || document.querySelector('.modal-back.levelend')) return;
    if (paused) return resume();
    paused = true;
    A.play('pause');
    LZ.In.reset();
    const set = S.data.settings;
    const m = modal([
      h('h2', null, 'Pauza'),
      h('div.col', null, [
        h('button.btn.big.primary', { onclick: () => { m.close(); } }, 'Graj dalej'),
        // open world: go home or jump to a flag instead of restarting a level
        LZ.Game.kind === 'world' ? h('button.btn.mid.green', { onclick: () => { m.close(); LZ.World.goHome(); } }, '🏠 Wróć do domu') : null,
        LZ.Game.kind === 'world' ? h('button.btn.mid', { onclick: () => { m.close(); LZ.World.travelMenu(); } }, '🚩 Skocz do flagi') : null,
        LZ.Game.kind === 'world' || LZ.Game.kind === 'home' ? null : h('button.btn.mid', { onclick: () => { m.close(); LZ.Game.restart(); } }, 'Zacznij poziom od nowa'),
        h('button.btn.mid', { onclick: () => { m.close(); LZ.Game.quit(); exitTo(); } }, LZ.Game.kind === 'world' || LZ.Game.kind === 'home' ? 'Wyjdź do menu' : 'Wyjdź'),
        h('div.row', null, [
          h('button.btn.small' + (set.music ? '.on' : ''), { onclick: (e) => { set.music = set.music ? 0 : 0.6; A.applyVolumes(); S.save(); e.target.classList.toggle('on'); } }, 'Muzyka'),
          h('button.btn.small' + (set.sfx ? '.on' : ''), { onclick: (e) => { set.sfx = set.sfx ? 0 : 0.8; A.applyVolumes(); S.save(); e.target.classList.toggle('on'); } }, 'Dźwięki'),
        ]),
      ]),
    ], { onclose: () => { paused = false; LZ.In.reset(); } });
    pauseModal = m;
  }
  let pauseModal = null;
  function resume() { if (pauseModal) pauseModal.close(); paused = false; }

  function levelComplete(res) {
    document.getElementById('hud').classList.add('hidden');
    const kind = res.kind || 'normal';
    const night = kind === 'hard';
    const next = () => {
      if (kind === 'weekly') return res.mode.li < 6 && res.wboss.next ? () => play(res.wi, res.mode.li + 1, Object.assign({}, res.mode, { li: res.mode.li + 1 })) : null;
      if (kind === 'daily' || kind === 'custom' || kind === 'wboss' || kind === 'temple') return null;
      if (res.wi === D.BONUS_ID) return null;   // bonus level: nothing comes after it
      if (res.li < D.LEVELS_PER_WORLD) return () => play(res.wi, res.li + 1, night ? { kind: 'hard' } : null);
      if (!night && res.wi < D.WORLDS.length) return () => play(res.wi + 1, 1);
      return null;
    };
    const nx = next();
    const fmt = v => Math.floor(v / 60) + ':' + String(Math.floor(v % 60)).padStart(2, '0');
    const extras = [];
    if (res.newChars.length) res.newChars.forEach(c => extras.push(h('div.unlock', null, [preview({ id: c.id, variant: 0 }, 90), h('div', null, ['Nowa postać: ', h('b', null, c.name), '!'])])));
    if (res.badges.length) extras.push(h('div.unlock', null, ['Nowe odznaki: ', h('b', null, res.badges.map(b => b.name).join(', '))]));
    if (res.nightOpened) extras.push(h('div.unlock.nightmsg', null, ['🌙 Otworzyła się ', h('b', null, 'noc'), ' w tym świecie! Przełącznik jest na mapie poziomów.']));

    let head = res.boss ? 'Boss pokonany!' : 'Poziom ukończony!', top = null;
    if (kind === 'normal') top = h('div.bigstars', null, [0, 1, 2].map(i => h('span.bigstar' + (res.stars[i] ? '.got' : ''), { style: 'animation-delay:' + (0.3 + i * 0.35) + 's' })));
    if (night) head = res.boss ? 'Nocny boss pokonany!' : 'Nocny poziom ukończony!';
    if (kind === 'daily') {
      const d = res.daily;
      head = d.met ? 'Cel dnia wykonany!' : 'Meta! Ale cel dnia jeszcze nie...';
      top = h('div.dailybox' + (d.met ? '.ok' : ''), null, [
        h('div', null, (d.met ? '✓ ' : '✗ ') + d.text),
        d.reward ? h('div.bonus', null, ['Nagroda: ', coinIcon(), ' +' + d.reward.coins, d.reward.sticker ? ' i naklejka „' + d.reward.sticker.name + '”' : '', ' · seria: ' + d.reward.streak + (d.reward.streak === 1 ? ' dzień' : ' dni')]) : null,
        d.met && !d.reward ? h('div', null, 'Dzisiejsza nagroda jest już odebrana. Jutro nowy poziom!') : null,
        !d.met ? h('div', null, 'Spróbuj jeszcze raz - masz cały dzień!') : null,
      ]);
    }
    if (kind === 'wboss' || kind === 'temple' || kind === 'weekly') {
      head = res.wboss.head;
      top = h('div.dailybox.ok', null, res.wboss.lines.map(l => h('div', null, l)));
    }
    if (kind === 'custom') {
      head = 'Brawo!';
      top = res.verifiedNow ? h('div.dailybox.ok', null, 'Poziom sprawdzony - da się go przejść! Teraz możesz go wysłać.') : h('p.note', null, 'Monety w zbudowanych poziomach są tylko dla zabawy.');
    }
    const medalRow = res.medals ? h('div.medalrow', null, LZ.X.MEDALS.map((m, i) => h('div.medalbig' + (res.medals.all[i] ? '.got' : '') + (res.medals.now[i] && !res.medals.prev[i] ? '.new' : ''), null, [
      h('span.mi', null, m.icon), h('span.mn', null, m.name),
      h('span.mv', null, i === 0 ? fmt(res.time) + ' / ' + fmt(res.par) : i === 1 ? (res.hits ? '−' + res.hits + ' ❤' : 'bez strat') : res.loose[0] + ' / ' + res.loose[1]),
    ]))) : null;
    const m = modal([
      h('h2.win', null, head),
      top,
      medalRow,
      h('div.results', null, [
        h('div', null, [coinIcon(), ' Monety: ', h('b', null, String(res.coins))]),
        res.bonus > 0 ? h('div.bonus', null, ['Bonus za poziom ' + res.bandName + ' (×' + String(res.rew).replace('.', ',') + '): ', h('b', null, '+' + res.bonus)]) : null,
        h('div', null, ['Zadania: ', h('b', null, res.mathOk + ' / ' + res.mathTotal)]),
        res.medals ? null : h('div', null, ['Czas: ', h('b', null, fmt(res.time))]),
      ]),
      ...extras,
      h('div.row', null, [
        h('button.btn.mid' + (kind === 'wboss' || kind === 'temple' ? '.primary' : ''), { onclick: () => { m.close(); LZ.Game.quit(); exitTo(); } }, kind === 'wboss' || kind === 'temple' ? 'Wracam na wyprawę' : kind === 'weekly' ? 'Świat tygodnia' : kind === 'daily' ? 'Menu' : kind === 'custom' ? (res.mode && res.mode.test ? 'Wróć do budowania' : 'Pracownia') : 'Mapa'),
        h('button.btn.mid', { onclick: () => { m.close(); LZ.Game.quit(); play(res.wi, res.li, res.mode); } }, 'Jeszcze raz'),
        nx ? h('button.btn.mid.primary', { onclick: () => { m.close(); LZ.Game.quit(); nx(); } }, 'Dalej →') : null,
      ]),
    ], { dismiss: false });
    m.box.parentNode.classList.add('levelend');
  }

  /* ================= LEVEL OF THE DAY ================= */
  function dailyScreen() {
    const p = S.active(), info = LZ.X.daily(p);
    const lvl = LZ.Gen.generate(info.world, 1, { daily: info.day });
    const goal = LZ.X.dailyGoalText(info, lvl);
    const w = D.WORLDS[info.world - 1];
    const doneToday = p.daily.last === info.key;
    const alive = doneToday || p.daily.last === LZ.X.dateKey(new Date(Date.now() - 86400000));
    const streak = alive ? p.daily.streak : 0;
    const toSticker = 3 - (streak % 3);
    const m = modal([
      h('h2', null, 'Poziom dnia'),
      h('div.dailyworld', { style: 'background:linear-gradient(160deg,' + w.pal.skyTop + ',' + w.pal.skyBot + ')' }, [h('b', null, w.name), h('div', null, LZ.Gen.THEMES[lvl.theme].name)]),
      h('div.dailybox' + (doneToday ? '.ok' : ''), null, [h('div', null, 'Cel: ' + goal.text), doneToday ? h('div', null, '✓ Dziś już wykonane!') : h('div.bonus', null, ['Nagroda: ', coinIcon(), ' 25'])]),
      h('p.note', null, 'Seria: ' + streak + (streak === 1 ? ' dzień' : ' dni') + ' (najdłuższa: ' + p.daily.best + '). ' +
        (doneToday ? 'Wróć jutro po nowy poziom!' : 'Jeszcze ' + toSticker + (toSticker === 1 ? ' dzień' : ' dni') + ' do darmowej naklejki. 7 dni z rzędu = kapelusz!')),
      h('div.row', null, [
        h('button.btn.mid', { onclick: () => m.close() }, 'Wróć'),
        h('button.btn.mid.primary', { onclick: () => { m.close(); play(info.world, 1, { kind: 'daily', info }); } }, doneToday ? 'Zagraj jeszcze raz' : 'Graj!'),
      ]),
    ]);
  }

  /* ================= WYZWANIA: the challenges that never run out ================= */
  // World of the week (weekly.js), the endless tower (tower.js) and the level of the day
  function challenges() {
    if (!document.querySelector('.screen.hub')) hub();   // the menu stays behind the window
    const p = S.active(), wk = LZ.Weekly.info(), ws = LZ.Weekly.progress(p), tw = LZ.Tower.best(p);
    const doneToday = p.daily && p.daily.last === LZ.X.dateKey();
    const card = (cls, icon, title, sub, tag, fn) => h('button.chcard.' + cls, { onclick: () => { m.close(); fn(); } }, [h('span.ti', null, icon), h('div', null, [h('b', null, title), h('small', null, sub)]), tag ? h('span.tag', null, tag) : null]);
    const m = modal([
      h('h2', null, '🏆 Wyzwania'),
      h('div.chlist', null, [
        card('week', '🗓️', 'Świat tygodnia', wk.name + ' · ' + wk.twist.name, ws.done + ' / 6', () => LZ.Weekly.screen()),
        card('tower', '🗼', 'Wieża', tw ? 'Rekord: ' + tw + '. piętro' : 'Wspinaj się jak najwyżej!', null, () => play(0, 0, { kind: 'tower' })),
        card('day', '📅', 'Poziom dnia', doneToday ? 'Dziś już zrobione!' : 'Nowy poziom z celem', doneToday ? '✓' : null, () => dailyScreen()),
      ]),
      h('button.btn.mid', { onclick: () => m.close() }, 'Wróć'),
    ]);
  }

  /* ================= PRACOWNIA (custom levels) ================= */
  function workshop() {
    const p = S.active();
    const list = S.data.custom || [];
    const cards = list.slice().reverse().map(lv => {
      const w = D.WORLDS[lv.w - 1] || D.WORLDS[0];
      const mine = lv.author === p.name && !lv.received;
      return h('div.wslot', { style: 'background:linear-gradient(160deg,' + w.pal.skyTop + ',' + w.pal.skyBot + ')' }, [
        h('div.wsname', null, lv.name || 'Poziom'),
        h('div.wsmeta', null, (lv.author ? 'od: ' + lv.author : '') + (lv.verified ? ' · ✓ sprawdzony' : ' · jeszcze nie sprawdzony')),
        h('div.row', null, [
          h('button.btn.small.primary', { onclick: () => play(lv.w, 1, { kind: 'custom', data: lv, id: lv.id, test: mine && !lv.verified }) }, 'Graj'),
          mine ? h('button.btn.small', { onclick: () => LZ.Editor.open(lv.id) }, 'Edytuj') : h('button.btn.small', { onclick: () => { const c = LZ.Editor.copy(lv.id); LZ.Editor.open(c.id); } }, 'Przerób'),
          lv.verified ? h('button.btn.small.blue', { onclick: () => shareLevel(lv) }, 'Wyślij') : null,
          h('button.btn.small.ghost', { onclick: () => confirmBox('Usunąć poziom?', '„' + (lv.name || 'Poziom') + '” zniknie z tego urządzenia.', () => { S.data.custom = S.data.custom.filter(x => x.id !== lv.id); S.save(); workshop(); }) }, '×'),
        ]),
      ]);
    });
    show(h('div.screen', null, [
      h('div.topbar', null, [h('button.btn.small', { onclick: hub }, '← Wróć'), h('h1', null, 'Pracownia'), h('button.btn.small', { onclick: () => importLevel() }, 'Wklej kod')]),
      h('div.wsgrid', null, [h('div.wslot.new', { onclick: newCustomLevel }, [h('div.plus', null, '+'), h('div.wsname', null, 'Zbuduj nowy poziom')])].concat(cards)),
      h('p.note.center', null, 'Zbuduj poziom, przejdź go sama, a potem wyślij siostrze albo koleżance. Poziomy na tym urządzeniu widzą wszyscy gracze.'),
    ]));
  }
  function newCustomLevel() {
    const m = modal([
      h('h2', null, 'Jak długi poziom?'),
      h('div.col', null, [[60, 'Krótki'], [100, 'Średni'], [150, 'Długi']].map(([W, n]) => h('button.btn.mid', { onclick: () => { m.close(); const lv = LZ.Editor.create(1, W); LZ.Editor.open(lv.id); } }, n))),
    ]);
  }
  function levelLink(lv) {
    return location.origin + location.pathname.replace(/[^/]*$/, '') + '#poziom=' + encodeURIComponent(LZ.X.encode(lv));
  }
  function shareLevel(lv) {
    const url = levelLink(lv);
    const text = 'Zagraj w mój poziom „' + (lv.name || 'Poziom') + '” w Liczbolandii!';
    const box = h('textarea.code', { readonly: true, rows: 4 }); box.value = url;
    const m = modal([
      h('h2', null, 'Wyślij poziom'),
      h('p', null, 'Wyślij ten link (np. przez WhatsApp). Kto go otworzy, dostanie twój poziom w swojej Pracowni.'),
      box,
      h('div.row', null, [
        navigator.share ? h('button.btn.mid.primary', { onclick: () => { navigator.share({ title: 'Liczbolandia', text, url }).catch(() => {}); } }, 'Wyślij...') : null,
        h('button.btn.mid', { onclick: () => { box.select(); try { navigator.clipboard.writeText(url); } catch (e) { try { document.execCommand('copy'); } catch (e2) {} } box.classList.add('copied'); } }, 'Kopiuj'),
        h('button.btn.mid', { onclick: () => m.close() }, 'Zamknij'),
      ]),
    ]);
  }
  function importLevel(prefill) {
    const box = h('textarea.code', { rows: 4, placeholder: 'Wklej tu link albo kod poziomu' });
    if (typeof prefill === 'string') box.value = prefill;
    const m = modal([
      h('h2', null, typeof prefill === 'string' ? 'Ktoś przysłał ci poziom!' : 'Poziom od kogoś'),
      box,
      h('div.row', null, [
        h('button.btn.mid', { onclick: () => m.close() }, 'Anuluj'),
        h('button.btn.mid.primary', { onclick: () => {
          try {
            let txt = box.value; try { txt = decodeURIComponent(txt); } catch (e) {}
            const data = LZ.X.decode(txt);
            // levels from someone else were finished by their builder before sharing
            const lv = Object.assign(data, { id: 'c' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), verified: true, received: true });
            (S.data.custom = S.data.custom || []).push(lv); S.save(); m.close(); workshop();
            alertBox('Nowy poziom!', '„' + (lv.name || 'Poziom') + '” czeka w Pracowni.');
          } catch (e) { alertBox('Hmm...', e.message || 'Nie udało się odczytać kodu.'); }
        } }, 'Dodaj'),
      ]),
    ]);
  }
  // a level link opened the game (#poziom=...): offer it once a player is chosen
  function checkPendingLevel() {
    let code = null; try { code = sessionStorage.getItem('lz_pending_level'); } catch (e) {}
    if (!code) return;
    try { sessionStorage.removeItem('lz_pending_level'); } catch (e) {}
    importLevel(code);
  }

  // badges are shown one after another (closing one opens the next), never stacked
  function celebrateBadges(list) {
    if (!list.length) return;
    const b = list[0];
    const m = modal([h('div.badge-big', null, '🏅'), h('h2', null, 'Nowa odznaka!'), h('p', null, [h('b', null, b.name), ' - ' + b.desc]), b.reward ? h('p', null, 'Nagroda: ' + b.reward) : null, h('button.btn.primary', { onclick: () => m.close() }, 'Super!')], { onclose: () => celebrateBadges(list.slice(1)) });
    A.play('star');
  }

  /* ================= WARDROBE & SHOP ================= */
  let promos = null;   // two discounted items, re-rolled each shop visit
  function rollPromos(p) {
    const cands = [];
    D.CHARACTERS.forEach(c => { if (!c.unlock && c.price > 0 && !p.owned.chars.includes(c.id)) cands.push({ type: 'char', id: c.id, price: c.price }); });
    D.HATS.forEach(x => { if (x.price > 0 && !S.ownsHat(p, x.id)) cands.push({ type: 'hat', id: x.id, price: x.price }); });
    D.TRAILS.forEach(x => { if (x.price > 0 && !S.ownsTrail(p, x.id)) cands.push({ type: 'trail', id: x.id, price: x.price }); });
    promos = U.shuffle(Math.random, cands.filter(c => c.price <= 100)).slice(0, 2).map(c => Object.assign(c, { dq: M.discountQuestion(c.price, p.skill) }));
  }
  function promoFor(type, id) { return (promos || []).find(x => x.type === type && x.id === id); }

  function wardrobe(tab) {
    const p = S.active();
    if (!promos) rollPromos(p);
    const tabs = [['chars', 'Postacie'], ['colors', 'Kolory'], ['hats', 'Dodatki'], ['trails', 'Ślady'], ['stars', '⭐ Za gwiazdki']];
    const eq = p.equip;
    const items = [];
    const card = (opts) => h('div.item' + (opts.equipped ? '.eq' : '') + (opts.locked ? '.locked' : '') + (opts.promo ? '.promo' : ''), { onclick: opts.onclick }, [
      opts.promo ? h('div.promo-tag', null, 'PROMOCJA') : null,
      opts.pic,
      h('div.iname', null, opts.name),
      opts.sub ? h('div.isub', null, opts.sub) : null,
      h('div.iact', null, opts.action),
    ]);
    const priceTag = (price, promo) => promo ? h('span.price', null, [coinIcon(), ' ', h('s', null, String(price)), ' ?']) : h('span.price', null, [coinIcon(), ' ' + price]);

    if (tab === 'chars') {
      D.CHARACTERS.forEach(c => {
        const owned = p.owned.chars.includes(c.id), promo = promoFor('char', c.id);
        items.push(card({
          pic: preview({ id: c.id, variant: owned && eq.char === c.id ? eq.variant : 0, hat: 'none' }, 84),
          name: c.name, sub: c.abilityText, equipped: eq.char === c.id, locked: !owned && !!c.unlock, promo: !owned && promo,
          action: owned ? (eq.char === c.id ? 'Wybrana' : 'Wybierz') : c.unlock ? (c.unlock.boss ? 'Pokonaj bossa Świata ' + c.unlock.boss : 'Odznaka: ' + ((D.BADGES.find(b => b.id === c.unlock.badge) || {}).name || '')) : priceTag(c.price, promo),
          onclick: () => {
            if (owned) { eq.char = c.id; eq.variant = (p.owned.variants[c.id] || [0]).includes(eq.variant) && eq.char === c.id ? eq.variant : 0; S.save(); wardrobe(tab); }
            else if (!c.unlock) buy({ price: c.price, name: c.name, promo, desc: c.desc }, () => { p.owned.chars.push(c.id); p.owned.variants[c.id] = [0]; eq.char = c.id; eq.variant = 0; }, tab);
            else alertBox(c.name, c.desc);
          },
        }));
      });
    } else if (tab === 'colors') {
      const c = D.CHARACTERS.find(x => x.id === eq.char);
      c.variants.forEach((v, i) => {
        const owned = (p.owned.variants[c.id] || [0]).includes(i);
        const price = D.VARIANT_PRICES[i];
        items.push(card({
          pic: preview({ id: c.id, variant: i, hat: eq.hat }, 84), name: v.name, equipped: eq.variant === i,
          action: owned ? (eq.variant === i ? 'Założone' : 'Załóż') : priceTag(price),
          onclick: () => {
            if (owned) { eq.variant = i; S.save(); wardrobe(tab); }
            else buy({ price, name: c.name + ' - ' + v.name }, () => { (p.owned.variants[c.id] = p.owned.variants[c.id] || [0]).push(i); eq.variant = i; }, tab);
          },
        }));
      });
    } else if (tab === 'hats') {
      D.HATS.forEach(x => {
        const owned = S.ownsHat(p, x.id) || x.id === 'none', promo = promoFor('hat', x.id);
        const badge = x.badge && D.BADGES.find(b => b.id === x.badge);
        items.push(card({
          pic: preview({ id: eq.char, variant: eq.variant, hat: x.id }, 84), name: x.name, equipped: eq.hat === x.id, locked: !owned && (!!badge || !!x.craft || !!x.season), promo: !owned && promo,
          action: owned ? (eq.hat === x.id ? 'Założone' : 'Załóż') : x.craft ? '🧵 U krawcowej' : x.season ? '🎃 Świąteczna' : badge ? 'Odznaka: ' + badge.name : priceTag(x.price, promo),
          onclick: () => {
            if (owned) { eq.hat = x.id; S.save(); wardrobe(tab); }
            else if (x.craft) alertBox(x.name, CRAFT_TEXT);
            else if (x.season) alertBox(x.name, x.season + '.');
            else if (badge) alertBox(x.name, 'Zdobądź odznakę „' + badge.name + '”: ' + badge.desc.toLowerCase() + '.');
            else buy({ price: x.price, name: x.name, promo }, () => { p.owned.hats.push(x.id); eq.hat = x.id; }, tab);
          },
        }));
      });
    } else if (tab === 'trails') {
      D.TRAILS.forEach(x => {
        const owned = S.ownsTrail(p, x.id) || x.id === 'none', promo = promoFor('trail', x.id);
        const badge = x.badge && D.BADGES.find(b => b.id === x.badge);
        items.push(card({
          pic: trailPic(x.id), name: x.name, equipped: eq.trail === x.id, locked: !owned && (!!badge || !!x.craft), promo: !owned && promo,
          action: owned ? (eq.trail === x.id ? 'Założone' : 'Załóż') : x.craft ? '🧵 U krawcowej' : badge ? 'Odznaka: ' + badge.name : priceTag(x.price, promo),
          onclick: () => {
            if (owned) { eq.trail = x.id; S.save(); wardrobe(tab); }
            else if (x.craft) alertBox(x.name, CRAFT_TEXT);
            else if (badge) alertBox(x.name, 'Zdobądź odznakę „' + badge.name + '”: ' + badge.desc.toLowerCase() + '.');
            else buy({ price: x.price, name: x.name, promo }, () => { p.owned.trails.push(x.id); eq.trail = x.id; }, tab);
          },
        }));
      });
    } else if (tab === 'stars') {
      /*
       * Star shop: stars are the rare currency (72 in the whole game), and
       * these items together cost exactly 72 - so getting all of them means
       * finishing the whole game and finding every hidden star.
       */
      const bal = D.starBalance(p);
      D.STAR_ITEMS.forEach(it => {
        const owned = (p.starItems || []).includes(it.id);
        let action, onclick;
        if (!owned) {
          action = h('span.price.star', null, [starIcon(), ' ' + it.stars]);
          onclick = () => {
            if (bal < it.stars) { alertBox(it.name, it.desc + ' Masz ' + bal + ' ' + LZ.U.plural(bal, 'gwiazdkę', 'gwiazdki', 'gwiazdek') + ', a to kosztuje ' + it.stars + '. Brakuje ' + (it.stars - bal) + ' - szukaj gwiazdek na poziomach!'); return; }
            confirmBox(it.name, it.desc + ' Kupić za ' + it.stars + ' ' + LZ.U.plural(it.stars, 'gwiazdkę', 'gwiazdki', 'gwiazdek') + '? Zostanie ci ' + (bal - it.stars) + '.', () => {
              p.starsSpent = (p.starsSpent || 0) + it.stars; (p.starItems = p.starItems || []).push(it.id);
              if (it.type === 'pet') eq.pet = it.id;
              if (it.type === 'skin') eq.gold = true;
              const nb = S.checkBadges(p); S.save(); A.play('star'); wardrobe('stars');
              alertBox('Masz to!', it.type === 'level' ? 'Tajny poziom czeka na mapie świata!' : it.type === 'pet' ? 'Twój pupil będzie z tobą na każdym poziomie.' : it.type === 'perk' ? it.desc : 'Twoja postać świeci złotem!', () => { if (nb.length) celebrateBadges(nb); });
            });
          };
        } else if (it.type === 'pet') { action = eq.pet === it.id ? 'Założony (zdejmij)' : 'Załóż'; onclick = () => { eq.pet = eq.pet === it.id ? 'none' : it.id; S.save(); wardrobe('stars'); }; }
        else if (it.type === 'skin') { action = eq.gold ? 'Włączone (wyłącz)' : 'Włącz'; onclick = () => { eq.gold = !eq.gold; S.save(); wardrobe('stars'); }; }
        else if (it.type === 'level') { action = 'Zagraj!'; onclick = () => play(D.BONUS_ID, 1); }
        else { action = 'Masz to!'; onclick = () => alertBox(it.name, it.desc); }
        items.push(card({ pic: starItemPic(it), name: it.name, sub: it.desc, equipped: owned && ((it.type === 'pet' && eq.pet === it.id) || (it.type === 'skin' && eq.gold) || it.type === 'perk' || it.type === 'level'), locked: !owned && bal < it.stars, action, onclick }));
      });
    }
    show(h('div.screen.shop', null, [
      h('div.topbar', null, [h('button.btn.small', { onclick: () => { promos = null; hub(); } }, '← Wróć'), h('h1', null, 'Garderoba i sklep'), h('div.wallet', null, [coinIcon(), ' ' + p.coins, '  ', starIcon(), ' ' + D.starBalance(p)])]),
      h('div.tabs', null, tabs.map(([k, n]) => h('button.tab' + (k === tab ? '.on' : ''), { onclick: () => wardrobe(k) }, n))),
      h('div.shopbody', null, [
        h('div.bigpreview', null, [preview({ id: eq.char, variant: eq.variant, hat: eq.hat, walk: true, trail: eq.trail, gold: eq.gold && (p.starItems || []).includes('gold'), pet: (p.starItems || []).includes(eq.pet) ? eq.pet : null }, 170), h('div.cname', null, (D.CHARACTERS.find(c => c.id === eq.char) || {}).name)]),
        h('div.igrid', null, items),
      ]),
    ]));
  }
  function starItemPic(it) {
    const c = h('canvas.preview', { width: 168, height: 168, style: 'width:84px;height:84px' });
    previews.push({ canvas: c, starItem: it, size: 84 });
    return c;
  }

  /* ================= STICKER ALBUM ================= */
  function album() {
    const p = S.active(); const have = p.stickers || [];
    const slots = D.STICKERS.map(st => {
      const got = have.includes(st.id);
      const c = h('canvas.preview', { width: 150, height: 150, style: 'width:75px;height:75px' });
      if (got) previews.push({ canvas: c, sticker: st.id, size: 75 });
      return h('div.sticker' + (got ? '.got' : ''), null, [got ? c : h('div.qmark', null, '?'), h('div.sname', null, got ? st.name : '???')]);
    });
    const done = have.length >= D.STICKERS.length;
    show(h('div.screen', null, [
      h('div.topbar', null, [h('button.btn.small', { onclick: hub }, '← Wróć'), h('h1', null, 'Album naklejek'), h('div.wallet', null, [coinIcon(), ' ' + p.coins])]),
      h('p.note.center', null, 'Masz ' + have.length + ' z ' + D.STICKERS.length + ' naklejek. Każda paczka to nowa naklejka!'),
      h('button.btn.mid.primary', { onclick: () => buyPack(), disabled: done }, done ? 'Masz wszystkie!' : ['Kup paczkę naklejek  ', coinIcon(), ' ' + D.STICKER_PACK_PRICE]),
      h('div.album', null, slots),
    ]));
  }
  function buyPack() {
    const p = S.active(); p.stickers = p.stickers || [];
    const missing = D.STICKERS.filter(st => !p.stickers.includes(st.id));
    if (!missing.length) return;
    if (p.coins < D.STICKER_PACK_PRICE) { alertBox('Za mało monet', 'Paczka kosztuje ' + D.STICKER_PACK_PRICE + ', masz ' + p.coins + '. Brakuje ' + (D.STICKER_PACK_PRICE - p.coins) + '.'); return; }
    p.coins -= D.STICKER_PACK_PRICE; p.stats.purchases++;
    const st = U.pick(Math.random, missing); p.stickers.push(st.id);
    const nb = S.checkBadges(p); S.save(); A.play('power');
    album();
    // the reveal: the new sticker pops out big
    const c = h('canvas.preview.reveal', { width: 320, height: 320, style: 'width:160px;height:160px' });
    previews.push({ canvas: c, sticker: st.id, size: 160 });
    // badges earned by this pack are shown only after the sticker reveal is closed
    const m = modal([h('h2', null, 'Nowa naklejka!'), c, h('p.q', null, st.name), h('p.note', null, (p.stickers.length) + ' z ' + D.STICKERS.length + ' w albumie'), h('button.btn.primary', { onclick: () => m.close() }, 'Super!')], { onclose: () => { if (nb.length) celebrateBadges(nb); } });
    setTimeout(() => A.play('star'), 350);
  }

  function trailPic(id) {
    const c = h('canvas.preview', { width: 168, height: 168, style: 'width:84px;height:84px' });
    previews.push({ canvas: c, trailOnly: id, size: 84 });
    return c;
  }

  /*
   * Buying. The maths happens here too:
   *   - promo items: answer the discounted price correctly to get it cheaper
   *   - normal items (older players): "how many coins will be left?" for a
   *     small bonus. A wrong answer never blocks the purchase.
   */
  function buy(item, grant, tab) {
    const p = S.active();
    if (item.promo) {
      const dq = item.promo.dq;
      const newPrice = +dq.a;
      const m = modal([
        h('h2', null, item.name),
        h('p.q', null, dq.q),
        h('div.row.answers', null, dq.choices.map(ch => h('button.btn.mid.ans', { onclick: () => {
          m.close();
          const ok = ch === dq.a;
          S.recordAnswer(p, dq.topic, ok);
          if (ok) { A.play('correct'); finishBuy(newPrice, 'Brawo! Płacisz tylko ' + newPrice + ' monet.'); }
          else { A.play('wrong'); confirmBox('Prawie!', 'Dobra odpowiedź to ' + dq.a + '. Promocja przepadła - kupić za pełną cenę ' + item.price + '?', () => finishBuy(item.price)); }
        } }, ch))),
        h('p.note', null, 'Dobra odpowiedź = niższa cena!'),
      ]);
      return;
    }
    if (p.coins < item.price) {
      alertBox('Za mało monet', 'Masz ' + p.coins + ' monet, a to kosztuje ' + item.price + '. Brakuje ci ' + (item.price - p.coins) + '. Zbieraj dalej!');
      return;
    }
    if (p.skill >= 2.3 && p.coins <= 100) {   // 'how many coins left?' - only while numbers stay within 100
      const left = p.coins - item.price;
      const choices = M.numChoices(left, [p.coins + item.price, left + 10]);
      const m = modal([
        h('h2', null, item.name),
        h('p.q', null, 'Masz ' + p.coins + ' monet. Kupujesz za ' + item.price + '. Ile ci zostanie?'),
        h('div.row.answers', null, choices.map(ch => h('button.btn.mid.ans', { onclick: () => {
          m.close();
          const ok = +ch === left;
          S.recordAnswer(p, 'money', ok);
          if (ok) { p.coins += 5; A.play('correct'); finishBuy(item.price, 'Dobrze policzone! Bonus +5 monet.'); }
          else { A.play('wrong'); finishBuy(item.price, 'Zostanie ' + left + ' monet. Kupione!'); }
        } }, ch))),
        h('button.btn.small.ghost', { onclick: () => m.close() }, 'Jednak nie kupuję'),
      ]);
    } else {
      confirmBox(item.name, 'Kupić za ' + item.price + ' monet? Zostanie ci ' + (p.coins - item.price) + '.', () => finishBuy(item.price));
    }

    function finishBuy(price, msg) {
      if (p.coins < price) { alertBox('Za mało monet', 'Potrzebujesz ' + price + ', masz ' + p.coins + '. Brakuje ' + (price - p.coins) + '.'); return; }
      p.coins -= price; p.stats.purchases++;
      grant();
      if (item.promo) promos = promos.filter(x => x !== item.promo);
      const nb = S.checkBadges(p);
      S.save(); A.play('buy');
      wardrobe(tab);
      if (msg) alertBox('Kupione!', msg);
      if (nb.length) celebrateBadges(nb);
    }
  }

  /* ================= BADGES ================= */
  function badges() {
    const p = S.active();
    show(h('div.screen', null, [
      h('div.topbar', null, [h('button.btn.small', { onclick: hub }, '← Wróć'), h('h1', null, 'Odznaki'), h('span', null, p.badges.length + ' / ' + D.BADGES.length)]),
      h('div.bgrid', null, D.BADGES.map(b => {
        const got = p.badges.includes(b.id);
        return h('div.badge' + (got ? '.got' : ''), null, [h('div.bico', null, got ? '🏅' : '🔒'), h('div.bname', null, b.name), h('div.bdesc', null, b.desc), b.reward ? h('div.brew', null, 'Nagroda: ' + b.reward) : null]);
      })),
    ]));
  }

  /* ================= STATS ================= */
  function stats() {
    const p = S.active(), s = p.stats;
    const total = s.correct + s.wrong;
    const acc = total ? Math.round(100 * s.correct / total) : 0;
    const topics = Object.keys(s.topics).map(k => ({ k, n: M.TOPICS[k] || k, c: s.topics[k].c, t: s.topics[k].t })).sort((a, b) => b.t - a.t);
    const band = S.mathBand(p);
    const lvlPct = Math.round(100 * (p.skill - band.min) / (band.max - band.min));
    show(h('div.screen', null, [
      h('div.topbar', null, [h('button.btn.small', { onclick: hub }, '← Wróć'), h('h1', null, 'Moje wyniki'), h('span')]),
      h('div.panel', null, [
        h('div.statrow', null, [
          h('div.stat', null, [h('b', null, String(s.correct)), h('span', null, 'dobrych odpowiedzi')]),
          h('div.stat', null, [h('b', null, acc + '%'), h('span', null, 'trafność')]),
          h('div.stat', null, [h('b', null, String(s.bestStreak)), h('span', null, 'najdłuższa seria')]),
          h('div.stat', null, [h('b', null, String(D.countStars(p))), h('span', null, 'gwiazdek')]),
        ]),
        h('label', null, 'Poziom ' + band.name + ' - postęp'),
        h('div.bar', null, h('div.fill', { style: 'width:' + U.clamp(lvlPct, 3, 100) + '%' })),
        h('label', null, 'Tematy'),
        topics.length ? h('div.topics', null, topics.map(t => h('div.topic', null, [
          h('span.tn', null, t.n), h('div.bar.small', null, h('div.fill', { style: 'width:' + Math.round(100 * t.c / t.t) + '%' })), h('span.tv', null, t.c + '/' + t.t),
        ]))) : h('p.note', null, 'Tu pojawią się tematy, gdy rozwiążesz pierwsze zadania.'),
      ]),
    ]));
  }

  /* ================= SETTINGS & SAVE/LOAD ================= */
  function settings() {
    const p = S.active(), set = S.data.settings;
    const slider = (label, key) => {
      const inp = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: set[key] });
      inp.addEventListener('input', () => { set[key] = +inp.value; A.applyVolumes(); S.save(); });
      return h('div.setrow', null, [h('span', null, label), inp]);
    };
    const fileIn = h('input', { type: 'file', accept: '.json,application/json', style: 'display:none' });
    fileIn.addEventListener('change', () => {
      const f = fileIn.files[0]; if (!f) return;
      f.text().then(txt => { try { S.importText(txt); alertBox('Wczytano!', 'Zapis gry został wczytany.', profiles); } catch (e) { alertBox('Ups', 'Nie udało się wczytać tego pliku. ' + (e.message || '')); } });
    });
    show(h('div.screen', null, [
      h('div.topbar', null, [h('button.btn.small', { onclick: () => p ? hub() : title() }, '← Wróć'), h('h1', null, 'Ustawienia'), h('span')]),
      h('div.panel', null, [
        h('h3', null, 'Dźwięk'),
        slider('Muzyka', 'music'), slider('Efekty', 'sfx'),
        p ? h('h3', null, 'Matematyka dla: ' + p.name) : null,
        p ? h('div.levels', null, D.MATH_LEVELS.map(m => h('div.lvlcard' + (p.mathLevel === m.id ? '.sel' : ''), { onclick: () => { if (m.id !== p.mathLevel) confirmBox('Zmienić poziom?', 'Zadania będą od teraz: ' + m.desc.toLowerCase() + '.', () => { S.setMathLevel(p, m.id); settings(); }); } }, lvlBody(m)))) : null,
        p && LZ.Speech.available ? h('h3', null, 'Czytanie na głos') : null,
        p && LZ.Speech.available ? h('div.row.wrap', null, [
          h('button.btn.mid' + (p.readAloud ? '.on' : ''), { onclick: () => { p.readAloud = !p.readAloud; S.save(); if (p.readAloud) LZ.Speech.say('Będę czytać zadania na głos.'); settings(); } }, p.readAloud ? 'Czytam zadania: TAK' : 'Czytam zadania: NIE'),
        ]) : null,
                h('h3', null, 'Zapis gry'),
        h('p.note', null, 'Gra zapisuje się sama po każdym poziomie i zakupie. Poniżej możesz zrobić kopię zapasową (np. przed zmianą telefonu) i ją potem wczytać.'),
        h('div.row.wrap', null, [
          h('button.btn.mid.blue', { onclick: () => { S.save(); S.exportFile(); } }, 'Zapisz do pliku'),
          h('button.btn.mid', { onclick: () => fileIn.click() }, 'Wczytaj z pliku'),
          h('button.btn.mid', { onclick: codeExport }, 'Kod zapisu'),
          h('button.btn.mid', { onclick: codeImport }, 'Wklej kod'),
        ]),
        fileIn,
        h('h3', null, 'Aplikacja'),
        h('div.row.wrap', null, [
          h('button.btn.mid', { onclick: installFlow }, 'Dodaj na ekran telefonu'),
          h('button.btn.mid.blue', { onclick: shareGame }, 'Udostępnij grę'),
          h('button.btn.mid', { onclick: () => { const el = document.documentElement; if (document.fullscreenElement) document.exitFullscreen(); else if (el.requestFullscreen) el.requestFullscreen().catch(() => {}); } }, 'Pełny ekran'),
        ]),
        h('p.note', null, 'Sterowanie: na telefonie przyciski na ekranie. Na komputerze strzałki lub A/D i spacja, P - pauza.'),
      ]),
    ]));
  }
  function codeExport() {
    const code = S.exportText();
    const ta = h('textarea.code', { readonly: true }); ta.value = code;
    const m = modal([h('h2', null, 'Kod zapisu'), h('p', null, 'Skopiuj ten kod i zachowaj go (np. wyślij sobie). Wklejony na innym urządzeniu przywróci grę.'), ta,
      h('div.row', null, [h('button.btn', { onclick: () => m.close() }, 'Zamknij'), h('button.btn.primary', { onclick: () => { ta.select(); (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).then(() => alertBox('Skopiowano!', 'Kod jest w schowku.')).catch(() => { document.execCommand('copy'); }); } }, 'Kopiuj')])]);
  }
  function codeImport() {
    const ta = h('textarea.code', { placeholder: 'Wklej tutaj kod zapisu' });
    const m = modal([h('h2', null, 'Wklej kod'), h('p', null, 'Uwaga: wczytanie zastąpi obecny zapis na tym urządzeniu.'), ta,
      h('div.row', null, [h('button.btn', { onclick: () => m.close() }, 'Anuluj'), h('button.btn.primary', { onclick: () => { try { S.importText(ta.value); m.close(); alertBox('Wczytano!', 'Zapis przywrócony.', profiles); } catch (e) { alertBox('Ups', 'Ten kod nie działa. Sprawdź, czy skopiowano całość.'); } } }, 'Wczytaj')])]);
  }

  LZ.UI = {
    album,
    title, profiles, hub, worlds, levels, play, levelComplete, togglePause, workshop, dailyScreen, importLevel, challenges,
    _preview: (o, sz) => preview(o, sz), _h: h, _modal: (c, o) => modal(c, o), _alert: (a, b, c) => alertBox(a, b, c), _confirm: (a, b, c, d) => confirmBox(a, b, c, d), _show: el => show(el), _hide: () => hide(),
    isPaused: () => paused || !!document.querySelector('.modal-back'),
    previews,
  };
})();
