/*
 * bosses.js - the big fights of the open world.
 *
 *   Waking statues - every landscape's boss statue comes alive at night.
 *     Standing next to it starts the fight: the same boss as in the levels,
 *     but the night version with 3 more hearts. The first win gives the
 *     landscape's crystal key, a figurine for the house, coins and rare
 *     materials; later wins give a smaller prize.
 *   The Crystal Lair - at the bottom of the Great Rift (right of the house,
 *     down to ~80 m) a stone door with 7 keyholes. With all 7 keys it opens
 *     on the Crystal Dragon, the final boss, which is new: it hovers, throws
 *     crystal shards and drops more from the ceiling.
 * The fights themselves are ordinary boss arenas run by game.js (run kind
 * 'wboss'); win() below decides the rewards and the results screen text.
 *
 * Save data: fun.keys { biome: 1 }, fun.statues { biome: wins }, fun.dragon (wins).
 */
(function () {
  const U = LZ.U, S = LZ.S, A = LZ.A, Art = LZ.Art, Fun = LZ.Fun, Bag = LZ.Bag, D = LZ.D;
  const T = LZ.T;
  const KEY_ORDER = ['ice', 'forest', 'desert', 'beach', 'volcano', 'factory', 'moon'];
  const KEY_COL = { ice: '#bfefff', forest: '#ff6b8a', desert: '#ffd23f', beach: '#5ccfff', volcano: '#ff8a3d', factory: '#b8c0d0', moon: '#e8dcff' };
  const LAIR_WORLD = {
    id: 54, name: 'Kryształowa Grota', cave: true, features: [], enemies: [], music: 9,
    pal: { skyTop: '#140f38', skyBot: '#07051a', far: '#241c58', mid: '#1a1446', grass: '#8fe6ff', grassDark: '#3aa8d8', dirt: '#2e2a66', dirtDark: '#221e52', block: '#ff9ecf', blockDark: '#b8467a', plank: '#c9b8ff', accent: '#8fe6ff' },
    boss: { id: 'crystaldragon', name: 'Kryształowy Smok', attack: 'crystal', hp: 9 },
  };
  const st = p => { const f = Fun.state(p); f.keys = f.keys || {}; f.statues = f.statues || {}; return f; };
  const worldOf = biome => D.WORLDS[LZ.World.BIOMES[biome].w - 1];
  const bossName = biome => worldOf(biome).boss.name;

  function fight(G, mode, wi) {
    const back = { x: G.wl.wx, y: G.wl.wy - 1 };
    LZ.Game.quit();
    LZ.UI.play(wi, D.LEVELS_PER_WORLD, Object.assign({ kind: 'wboss', back }, mode));
  }

  /* ---------------- the statue wakes up ---------------- */
  function wake(G, e) {
    const p = G.prof, f = st(p), h = LZ.UI._h, beaten = f.statues[e.biome];
    const w = worldOf(e.biome);
    const m = Fun.open([h('h2', null, 'Pomnik się budzi!'),
      h('p', null, beaten ? bossName(e.biome) + ' znowu ożył w świetle księżyca. Jeszcze jedna walka?' : bossName(e.biome) + ' otwiera oczy! Nocą jest silniejszy niż w poziomach. Pokonaj go, a zdobędziesz kryształowy klucz tej krainy.'),
      h('div.funrow', null, [h('button.btn.mid.primary', { onclick: () => { m.close(); fight(G, { world: Art.nightWorld(w), biome: e.biome, statue: true }, w.id); } }, 'Walczę!'), h('button.btn.mid', { onclick: () => m.close() }, 'Nie teraz')])]);
  }
  /* ---------------- the lair door ---------------- */
  function openDoor(G, e) {
    const p = G.prof, f = st(p), h = LZ.UI._h;
    const have = KEY_ORDER.filter(k => f.keys[k]);
    const slots = h('div.funrow', null, KEY_ORDER.map(k => h('div.funpick' + (f.keys[k] ? '' : '.dim'), null, [keyIcon(k, 34), h('small', null, LZ.World.BIOMES[k].name)])));
    const all = have.length === KEY_ORDER.length;
    const m = Fun.open([h('h2', null, 'Kryształowe Wrota'), slots,
      h('p', null, all ? (f.dragon ? 'Wrota znów się otwierają. Kryształowy Smok czeka na rewanż!' : 'Wszystkie klucze pasują! Za wrotami śpi Kryształowy Smok...') : 'Wrota mają 7 dziurek na klucze. Masz ' + have.length + ' z 7. Klucze dają pomniki bossów, które budzą się nocą w każdej krainie.'),
      h('div.funrow', null, [all ? h('button.btn.mid.primary', { onclick: () => { m.close(); fight(G, { world: LAIR_WORLD, lair: true }, LAIR_WORLD.id); } }, 'Otwieram!') : null, h('button.btn.mid', { onclick: () => m.close() }, all ? 'Jeszcze nie' : 'Wracam szukać')])]);
  }

  /* ---------------- rewards (called by game.js when the fight is won) ---------------- */
  function win(p, mode) {
    const f = st(p), home = LZ.Home.homeOf(p), lines = [];
    const give = (k, n) => { Bag.add(p, k, n); lines.push('+ ' + Bag.name(k, n).toLowerCase()); };
    const coins = n => { p.coins += n; p.stats.totalCoins += n; lines.push('+ ' + n + ' monet'); };
    if (mode.lair) {
      const first = !f.dragon;
      f.dragon = (f.dragon || 0) + 1; f.book.places.dragon = 1;
      if (first) {
        home.inv.dragontrophy = (home.inv.dragontrophy || 0) + 1;
        lines.push('🏆 Figurka Kryształowego Smoka do domku');
        lines.push('👑 Smocza korona w Garderobie');
        coins(150); give('star', 3); give('gold', 3);
      } else { coins(40); give('gem', 3); }
      S.checkBadges(p); S.save();
      return { head: first ? 'Kryształowy Smok pokonany! Jesteś legendą Liczbolandii!' : 'Smok znowu pokonany!', lines };
    }
    const b = mode.biome, first = !f.statues[b];
    f.statues[b] = (f.statues[b] || 0) + 1; f.book.places.statue = 1;
    if (first) {
      f.keys[b] = 1;
      const fig = 'fig_' + worldOf(b).boss.id;
      home.inv[fig] = (home.inv[fig] || 0) + 1;
      lines.push('🔑 Kryształowy klucz: ' + LZ.World.BIOMES[b].name + ' (' + KEY_ORDER.filter(k => f.keys[k]).length + ' z 7)');
      lines.push('🏆 ' + LZ.Home.FURN_BY[fig].name + ' do domku');
      coins(50); give('gem', 3); give('gold', 2); give('star', 1);
    } else { coins(20); give(U.pick(Math.random, ['gem', 'gold', 'iron']), 2); }
    S.checkBadges(p); S.save();
    return { head: bossName(b) + ' pokonany!', lines };
  }

  /* ---------------- drawing ---------------- */
  function keyIcon(biome, size) {
    const c = document.createElement('canvas'); c.width = c.height = size * 2; c.style.width = c.style.height = size + 'px';
    const g = c.getContext('2d'); g.scale(size / 18, size / 18); drawKey(g, 18, 18, KEY_COL[biome]); return c;
  }
  function drawKey(g, x, y, col) {
    g.save(); g.translate(x, y); g.rotate(-0.6);
    Art.ell(g, 0, -8, 7, 7); Art.fs(g, col, '#5a6388', 1.5); Art.ell(g, 0, -8, 3, 3); Art.fs(g, 'rgba(0,0,0,0.25)');
    U.rr(g, -2, -2, 4, 16, 1.5); Art.fs(g, col, '#5a6388', 1.2); g.fillStyle = col; g.fillRect(2, 8, 5, 3); g.fillRect(2, 12, 4, 2);
    g.restore();
  }
  // glowing eyes on a statue that is awake, a sleepy "z" in the day
  function drawStatueState(g, e, t, G) {
    const f = st(G.prof), night = LZ.Sky && LZ.Sky.darkness(Fun.state(G.prof).time) > 0.6;
    if (night) {
      // an awake statue: a pulsing magic glow around it and sparks rising
      const a = 0.25 + 0.15 * Math.sin(t * 4), cy = e.y - 190;
      const gr = g.createRadialGradient(e.x, cy, 20, e.x, cy, 220); gr.addColorStop(0, 'rgba(255,90,160,' + a + ')'); gr.addColorStop(1, 'rgba(255,90,160,0)');
      g.fillStyle = gr; g.fillRect(e.x - 220, cy - 220, 440, 440);
      for (let i = 0; i < 6; i++) { const k = (t * 0.5 + i / 6) % 1; Art.starPath(g, e.x - 90 + i * 36, e.y - 60 - k * 260, 5 * (1 - k), 2 * (1 - k), 4, t); Art.fs(g, 'rgba(255,220,240,' + (1 - k) + ')'); }
    } else if (!f.statues[e.biome]) {
      g.fillStyle = '#7a5ce6'; g.font = '800 26px "Baloo 2", sans-serif'; g.textAlign = 'center';
      const k = (t * 0.4) % 1; g.globalAlpha = 1 - k; g.fillText('z', e.x + 70 + k * 20, e.y - 330 - k * 40); g.globalAlpha = 1;
    }
    if (f.keys[e.biome]) drawKey(g, e.x - 96, e.y - 300 + Math.sin(t * 2) * 5, KEY_COL[e.biome]);
    Fun.ring(g, e.x, e.y - 80, e, 1);
  }
  function drawDoor(g, e, t, G) {
    const f = st(G.prof), x = e.x, y = e.y;
    U.rr(g, x - 70, y - 170, 140, 170, 60); Art.fs(g, '#4a4270', '#221e52', 4);
    U.rr(g, x - 54, y - 150, 108, 150, 48); Art.fs(g, '#2e2a66', '#1a1446', 3);
    g.strokeStyle = 'rgba(143,230,255,0.4)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y - 150); g.lineTo(x, y); g.stroke();
    KEY_ORDER.forEach((k, i) => {
      const a = Math.PI + (i + 0.5) / KEY_ORDER.length * Math.PI, kx = x + Math.cos(a) * 44, ky = y - 96 + Math.sin(a) * 44;
      Art.ell(g, kx, ky, 8, 8); Art.fs(g, f.keys[k] ? KEY_COL[k] : '#15123a', '#8fe6ff', 1.5);
      if (f.keys[k]) { g.globalAlpha = 0.4 + 0.3 * Math.sin(t * 3 + i); Art.ell(g, kx, ky, 13, 13); Art.fs(g, KEY_COL[k]); g.globalAlpha = 1; }
    });
    for (const d of [-86, 86]) { Art.ell(g, x + d, y - 110, 8, 12); Art.fs(g, '#8fe6ff', '#2a8fb8', 1.5); const gr = g.createRadialGradient(x + d, y - 110, 2, x + d, y - 110, 40); gr.addColorStop(0, 'rgba(143,230,255,0.45)'); gr.addColorStop(1, 'rgba(143,230,255,0)'); g.fillStyle = gr; g.fillRect(x + d - 40, y - 150, 80, 80); }
    U.rr(g, x - 76, y - 206, 152, 26, 7); Art.fs(g, '#e8dcff', '#6a5a9a', 2);
    g.fillStyle = '#3a246e'; g.font = '800 15px "Baloo 2", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('KRYSZTAŁOWE WROTA', x, y - 193);
    Fun.ring(g, x, y - 230, e, 0.7);
  }
  // figurines of the beaten bosses and the dragon trophy, standing on a pedestal in the house
  function drawFig(g, id, X, Y, w, t) {
    const kind = id === 'dragontrophy' ? 'crystaldragon' : id.slice(4);
    U.rr(g, X + 4, Y - 16, w - 8, 16, 4); Art.fs(g, id === 'dragontrophy' ? '#8fe6ff' : '#ffd23f', '#8a6a20', 2);
    g.save(); g.translate(X + w / 2, Y - 16); const s = id === 'dragontrophy' ? 0.5 : 0.36; g.scale(s, s);
    Art.drawBoss(g, { kind, x: -55, y: -150, w: 110, h: 150, dir: 1, flash: 0, phase: 'intro', look: 0 }, t);
    g.restore();
  }

  LZ.Ext.add({
    world: {
      chunk(W, cx, cy, x0, y0, add) {
        const gx = W.GREAT_X;
        if (gx < x0 - 8 || gx > x0 + 40) return;
        const fx = gx + 4, dx = gx + 9;
        add({ t: 'wsign', x: gx - 2, y: W.surf(gx - 2), text: 'Wielka Szczelina ↓', dir: 0 });
        add({ t: 'wflag', x: fx, y: W.tunnelC(fx, 2) + W.tunnelH(fx, 2) + 1, id: 'fgreat', name: 'Wielka Szczelina (dno)' });
        add({ t: 'lairdoor', x: dx, y: W.tunnelC(dx, 2) + W.tunnelH(dx, 2) + 1 });
      },
      buildEnt(G, e, px, py) { if (e.t !== 'lairdoor') return false; G.ents.push({ k: 'lairdoor', x: px + T / 2, y: py }); return true; },
      updateEnt(G, e, i, dt) {
        if (e.k === 'lairdoor') { if (Fun.stand(G, e, dt, { dx: 60, t: 0.7 })) openDoor(G, e); return true; }
        return false;
      },
      drawEnt(g, e, t, G) { if (e.k !== 'lairdoor') return false; drawDoor(g, e, t, G); return true; },
      // statues are world.js entities ('landmark'); waking them is handled here
      tick(G, dt) {
        const night = LZ.Sky && LZ.Sky.darkness(Fun.state(G.prof).time) > 0.6;
        for (const e of G.ents) {
          if (e.k !== 'landmark') continue;
          if (!night) {
            if (!st(G.prof).statues[e.biome] && Math.abs(G.player.x + 14 - e.x) < 130 && !e.hinted) { e.hinted = true; LZ.Game._toast('Pomnik śpi... Podobno nocą się budzi.', 2.4); }
            e._st = 0; continue;
          }
          if (Fun.stand(G, e, dt, { dx: 120, dy: 60, t: 1 })) wake(G, e);
        }
      },
      drawFront(g, G, t) { for (const e of G.ents) if (e.k === 'landmark') drawStatueState(g, e, t, G); },
    },
    furn: { draw(g, id, X, Y, w, t) { if (!(id.startsWith('fig_') || id === 'dragontrophy')) return false; drawFig(g, id, X, Y, w, t); return true; } },
  });

  LZ.Bosses = { win, wake, openDoor, KEY_ORDER, LAIR_WORLD, drawKey };
})();
