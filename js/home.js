/*
 * home.js - "Mój domek": the player's own little house.
 *
 * The house is a small level the engine plays like any other (walk, jump,
 * stand on furniture), plus a decorate mode: pick a piece of furniture at
 * the bottom, tap where it goes. Furniture is bought with coins or found on
 * adventures in the open world; some pieces can only be found.
 *
 * Save data (profile.home):
 *   size   1-4   room width grows, size 4 adds an upstairs
 *   items  [{ id, x, y, f }]  placed furniture; x = left edge in tiles
 *          (half-tile steps), y = row whose top the item stands on, f = flipped
 *   inv    { id: count }      owned but not placed
 *   wall   { style, color }   wallpaper
 */
(function () {
  const U = LZ.U, D = LZ.D, S = LZ.S, A = LZ.A;
  const T = LZ.T;

  /*
   * Furniture catalog.
   *   w, h    size in tiles (h only for tapping and the shop picture)
   *   wall    hangs on the wall instead of standing on the floor
   *   top     height (tiles) of a surface she can stand on, or 0
   *   price   coins in the furniture shop; 0 = can only be found on adventures
   */
  const FURN = [
    // shop
    { id: 'bed', name: 'Łóżko', w: 3, h: 1.4, top: 1.0, price: 120 },
    { id: 'sofa', name: 'Kanapa', w: 3, h: 1.4, top: 0.8, price: 150 },
    { id: 'armchair', name: 'Fotel', w: 1.5, h: 1.4, top: 0.7, price: 80 },
    { id: 'table', name: 'Stół', w: 2, h: 1.1, top: 1.1, price: 70 },
    { id: 'chair', name: 'Krzesło', w: 1, h: 1.5, top: 0.75, price: 40 },
    { id: 'lamp', name: 'Lampa stojąca', w: 1, h: 2.2, top: 0, price: 60 },
    { id: 'bookshelf', name: 'Regał z książkami', w: 2, h: 3, top: 3, price: 110 },
    { id: 'plant', name: 'Kwiatek w doniczce', w: 1, h: 1.2, top: 0, price: 45 },
    { id: 'bigplant', name: 'Duża palma', w: 1.5, h: 2.5, top: 0, price: 70 },
    { id: 'rug', name: 'Dywan w kropki', w: 3, h: 0.3, top: 0, price: 50 },
    { id: 'picture', name: 'Obrazek z tęczą', w: 1.5, h: 1.2, wall: true, top: 0, price: 40 },
    { id: 'clock', name: 'Zegar', w: 1, h: 1, wall: true, top: 0, price: 55 },
    { id: 'window', name: 'Okno z firanką', w: 2, h: 2, wall: true, top: 0, price: 90 },
    { id: 'shelf', name: 'Półka', w: 2, h: 0.5, wall: true, top: 0.35, price: 50 },
    { id: 'toybox', name: 'Skrzynia z zabawkami', w: 1.5, h: 1.2, top: 1.0, price: 60 },
    { id: 'teddy', name: 'Miś', w: 1, h: 1.1, top: 0, price: 50 },
    { id: 'piano', name: 'Pianino', w: 2.5, h: 2.2, top: 2.1, price: 260 },
    { id: 'aquarium', name: 'Akwarium', w: 2, h: 2, top: 1.9, price: 220 },
    { id: 'fireplace', name: 'Kominek', w: 2.5, h: 2.5, top: 2.3, price: 240 },
    { id: 'tv', name: 'Telewizor', w: 2, h: 1.9, top: 0, price: 180 },
    { id: 'beanbag', name: 'Pufa', w: 1.5, h: 1, top: 0.6, price: 70 },
    { id: 'desk', name: 'Biurko z lampką', w: 2, h: 1.9, top: 1.1, price: 90 },
    { id: 'lights', name: 'Lampki na sznurku', w: 4, h: 0.6, wall: true, top: 0, price: 80 },
    { id: 'candy', name: 'Automat z cukierkami', w: 1, h: 2, top: 0, price: 140 },
    // found on adventures only
    { id: 'trophies', name: 'Półka z trofeami', w: 3, h: 0.8, wall: true, top: 0.4, price: 0, desc: 'Pokazuje pokonanych bossów' },
    { id: 'stickerboard', name: 'Tablica z naklejkami', w: 2, h: 1.6, wall: true, top: 0, price: 0, desc: 'Pokazuje twoje naklejki' },
    { id: 'worldmap', name: 'Mapa świata', w: 2, h: 1.6, wall: true, top: 0, price: 0, desc: 'Stań przy niej, żeby skoczyć do flagi' },
    { id: 'crystallamp', name: 'Kryształowa lampa', w: 1, h: 2, top: 0, price: 0 },
    { id: 'throne', name: 'Złoty tron', w: 2, h: 2.3, top: 0.8, price: 0 },
    { id: 'telescope', name: 'Teleskop', w: 1.5, h: 2, top: 0, price: 0 },
    { id: 'fossil', name: 'Szkielet dinozaura', w: 3, h: 2.2, top: 0, price: 0 },
    { id: 'rocket', name: 'Model rakiety', w: 1, h: 2.2, top: 0, price: 0 },
    { id: 'snowglobe', name: 'Śnieżna kula', w: 1, h: 1.2, top: 0, price: 0 },
    { id: 'cactuspot', name: 'Kaktus w donicy', w: 1, h: 1.5, top: 0, price: 0 },
    { id: 'mushlamp', name: 'Grzybkowa lampka', w: 1, h: 1.5, top: 0, price: 0 },
    { id: 'train', name: 'Kolejka', w: 3, h: 0.8, top: 0, price: 0 },
    { id: 'shelllamp', name: 'Lampa z muszli', w: 1, h: 1.6, top: 0, price: 0 },
    { id: 'chocofountain', name: 'Czekoladowa fontanna', w: 1.5, h: 1.8, top: 0, price: 0 },
    { id: 'cloudbed', name: 'Chmurkowe łóżko', w: 3, h: 1.4, top: 0.9, price: 0 },
    { id: 'treasure', name: 'Skrzynia skarbów', w: 1.5, h: 1.2, top: 1.0, price: 0 },
    // the pet's bed comes with the pet; the oven is a gift for baking (kitchen.js)
    { id: 'petbed', name: 'Legowisko', w: 1.5, h: 0.7, top: 0, price: 60 },
    { id: 'oven', name: 'Piekarnik', w: 1.5, h: 2, top: 1.95, price: 0, desc: 'Stań przy nim, żeby upiec ciasto' },
    { id: 'owlstatue', name: 'Posąg Strażnika', w: 1.5, h: 2.4, top: 0, price: 0 },
    { id: 'fishtrophy', name: 'Złoty karp na ścianie', w: 2, h: 1.2, wall: true, top: 0, price: 0 },
    // figurines of the statue bosses beaten at night, and the final trophy (bosses.js)
    { id: 'fig_snowman', name: 'Figurka: Bałwan Bubu', w: 1.5, h: 1.6, top: 0, price: 0 },
    { id: 'fig_shroomlord', name: 'Figurka: Grzybolord', w: 1.5, h: 1.6, top: 0, price: 0 },
    { id: 'fig_sphinx', name: 'Figurka: Sfinks', w: 1.5, h: 1.6, top: 0, price: 0 },
    { id: 'fig_octopus', name: 'Figurka: Ośmiornica Ola', w: 1.5, h: 1.6, top: 0, price: 0 },
    { id: 'fig_chocodragon', name: 'Figurka: Smok Czekoladowy', w: 1.5, h: 1.6, top: 0, price: 0 },
    { id: 'fig_gearbot', name: 'Figurka: Robot Zębatek', w: 1.5, h: 1.6, top: 0, price: 0 },
    { id: 'fig_comet', name: 'Figurka: Królowa Komet', w: 1.5, h: 1.6, top: 0, price: 0 },
    { id: 'dragontrophy', name: 'Kryształowy Smok (trofeum)', w: 2.5, h: 2.4, top: 0, price: 0 },
    { id: 'relic', name: 'Starożytna waza', w: 1.5, h: 1.5, top: 0, price: 0 },
    { id: 'pumpkinlamp', name: 'Dyniowa lampa', w: 1, h: 1.1, top: 0, price: 0 },
    { id: 'xmastree', name: 'Choinka', w: 2, h: 2.6, top: 0, price: 0 },
  ];
  const FURN_BY = {}; FURN.forEach(f => { FURN_BY[f.id] = f; });

  const WALLS = [
    { id: 'stripes', name: 'Paski' }, { id: 'dots', name: 'Kropki' }, { id: 'stars', name: 'Gwiazdki' }, { id: 'hearts', name: 'Serduszka' }, { id: 'plain', name: 'Gładka' },
  ];
  const WALL_COLORS = ['#ffd6e8', '#d6ecff', '#e0f7d4', '#fff1c7', '#e8dcff', '#ffe0cc'];
  const WALL_PRICE = 40;
  /* House sizes: width in tiles and whether there's an upstairs. */
  const SIZES = [null, { W: 18, up: false }, { W: 26, up: false }, { W: 34, up: false }, { W: 34, up: true }];
  // size 2 is bought with coins; sizes 3 and 4 need a blueprint found on an adventure
  const EXPAND = [null, null, { price: 400, name: 'Większy pokój' }, { price: 600, plan: 'plan3', name: 'Wielki salon' }, { price: 900, plan: 'plan4', name: 'Piętro na górze' }];

  const HOME_WORLD = {
    id: 50, name: 'Mój domek', home: true, features: [], enemies: [], music: 5,
    pal: { skyTop: '#ffe9f3', skyBot: '#fff6e0', far: '#f7d9c4', mid: '#f2c9a8', grass: '#e0a86a', grassDark: '#c98a4a', dirt: '#d9a066', dirtDark: '#b8834a', block: '#e8b878', blockDark: '#b8834a', plank: '#ffcf70', accent: '#ff6fae' },
  };

  function defaultHome() {
    return {
      size: 1, wall: { style: 'stripes', color: WALL_COLORS[0] }, inv: {},
      items: [{ id: 'bed', x: 2, y: 11 }, { id: 'table', x: 7, y: 11 }, { id: 'plant', x: 10, y: 11 }, { id: 'worldmap', x: 11.5, y: 7 }, { id: 'trophies', x: 2, y: 7 }, { id: 'stickerboard', x: 6.5, y: 8 }],
    };
  }
  function homeOf(p) { if (!p.home) p.home = defaultHome(); return p.home; }

  /* ---------------- the house as a level ---------------- */
  const H = 14, FLOOR = 11, CEIL = 3, UP = 7;
  function buildLevel(p) {
    const home = homeOf(p), sz = SIZES[home.size] || SIZES[1], W = sz.W;
    const cols = [];
    for (let x = 0; x < W; x++) {
      const c = new Array(H).fill('.');
      for (let y = 0; y < H; y++) if (y < CEIL || y >= FLOOR || x === 0 || x === W - 1) c[y] = '#';
      cols.push(c);
    }
    if (sz.up) {
      // upstairs: a plank floor you can jump up through, reached by a staircase
      // on the left; a gap on the right lets you drop back down
      for (let x = 1; x < W - 1; x++) if (x < W - 8 || x > W - 6) cols[x][UP] = '-';
      for (let s = 1; s <= 3; s++) for (let y = FLOOR - s; y < FLOOR; y++) cols[1 + s][y] = '=';
    }
    const ents = [];
    // the door sits in the back wall on the right, it leads outside
    ents.push({ t: 'hdoor', x: W - 3, y: FLOOR });
    return { world: HOME_WORLD, wi: 50, li: 1, H, W, cols, ents, qc: {}, start: { x: W - 6, y: FLOOR - 1 }, water: false, boss: null, theme: null, themeName: 'Mój domek', noStars: true, sandbox: 'home' };
  }
  // engine entities for the placed furniture (drawing + surfaces to stand on)
  function spawnFurniture(G) {
    const home = homeOf(G.prof);
    G.ents = G.ents.filter(e => e.k !== 'furn' && !(e.k === 'plat' && e.sub === 'furn'));
    home.items.forEach((it, i) => {
      const f = FURN_BY[it.id]; if (!f) return;
      const e = { k: 'furn', id: it.id, idx: i, x: it.x * T, y: it.y * T, w: f.w * T, h: f.h * T, f: !!it.f };
      G.ents.push(e);
      if (f.top) G.ents.push({ k: 'plat', sub: 'furn', x: e.x + 4, y: e.y - f.top * T, w: e.w - 8, h: 14, dx: 0, dy: 0 });
    });
  }

  /* ---------------- engine hooks (G.sb) ---------------- */
  const hooks = {
    init(G) {
      G.hearts = G.maxHearts;
      spawnFurniture(G);
      G.home = { standDoor: 0, standMap: 0 };
      showHomeButtons(true);
      LZ.Ext.each('home', 'init', G);
      LZ.Fun.bar('home', true, [{ label: '🛋 Urządzaj', fn: () => openDeco() }]);
      // first visit: say what the door and the button do
      const home = homeOf(G.prof);
      if (!home.visited) { home.visited = true; S.save(); setTimeout(() => LZ.Game._toast('Stań w drzwiach, żeby wyruszyć na wyprawę!', 3.5), 2400); }
    },
    tick(G, dt) {
      const p = G.player, cx = p.x + 14;
      // stand in the doorway to go outside, in front of the map to travel
      const door = G.ents.find(e => e.k === 'hdoor');
      const atDoor = door && Math.abs(cx - (door.x + T / 2)) < 20 && p.grounded && Math.abs(p.vx) < 20;
      G.home.standDoor = atDoor ? G.home.standDoor + dt : 0;
      if (G.home.standDoor > 0.7 && G.state === 'play') { G.home.standDoor = -99; leaveHouse(); }
      const map = G.ents.find(e => e.k === 'furn' && e.id === 'worldmap');
      const atMap = map && cx > map.x && cx < map.x + map.w && p.y < map.y + 2 * T && p.grounded && Math.abs(p.vx) < 20;
      G.home.standMap = atMap ? G.home.standMap + dt : 0;
      if (G.home.standMap > 0.9 && G.state === 'play') { G.home.standMap = -99; if (LZ.World) LZ.World.travelMenu(); }
      LZ.Ext.each('home', 'tick', G, dt);
    },
    buildEnt(G, e, px, py) { if (e.t === 'hdoor') G.ents.push({ k: 'hdoor', x: px, y: py }); else LZ.Ext.first('home', 'buildEnt', G, e, px, py); },
    updateEnt(G, e, i, dt, pc) { return LZ.Ext.first('home', 'updateEnt', G, e, i, dt, pc); },
    drawEnt(ctx, e, t, G) {
      if (e.k === 'furn') { drawFurniture(ctx, e.id, e.x, e.y, e.w, t, e.f, G.prof); return true; }
      if (e.k === 'hdoor') { drawDoor(ctx, e.x, e.y, t, G.home && G.home.standDoor > 0 ? Math.min(1, G.home.standDoor / 0.7) : 0); return true; }
      return LZ.Ext.first('home', 'drawEnt', ctx, e, t, G);
    },
    drawBack(ctx, G, cam, vw, vh, t) {
      // outside the house: a soft evening garden; inside: the wallpaper
      const cv = ctx.canvas;
      if (cv.__sky !== 'home') { cv.__sky = 'home'; cv.style.background = 'linear-gradient(#8fd3ff,#ffe9c7)'; }
      ctx.clearRect(0, 0, vw, vh);
      ctx.save(); ctx.translate(-cam.x, -cam.y);
      const W = G.W, home = homeOf(G.prof);
      drawWallpaper(ctx, T, CEIL * T, (W - 2) * T, (FLOOR - CEIL) * T, home.wall, t);
      if (SIZES[home.size].up) { ctx.fillStyle = 'rgba(120,70,30,0.08)'; ctx.fillRect(T, UP * T + 12, (W - 2) * T, 10); }
      ctx.restore();
    },
    drawFront(ctx, G, x0, x1, y0, y1, t) { LZ.Ext.each('home', 'drawFront', ctx, G, t); },
    drawHUD(ctx, G, vw, vh, t, text) {
      LZ.Ext.each('home', 'drawHUD', ctx, G, vw, vh, t, text);
      const d = G.home;
      if (d && d.standDoor > 0.1) text(ctx, 'Wychodzę na przygodę...', vw / 2, vh * 0.3, 30, '#fff', '#7a5ce6');
      if (d && d.standMap > 0.1) text(ctx, 'Mapa świata...', vw / 2, vh * 0.3, 30, '#fff', '#7a5ce6');
      return false;   // keep the normal hearts/coins HUD
    },
    outOfHearts() { return false; },
    onBlock() {},
    quit(G) { showHomeButtons(false); LZ.Fun.bar('home', false); LZ.Ext.each('home', 'quit', G); },
  };
  function leaveHouse() {
    if (!LZ.World) return;
    LZ.Game.quit(); showHomeButtons(false);
    LZ.UI.play(0, 0, { kind: 'world', from: 'home' });
  }

  /* ---------------- drawing ---------------- */
  function drawWallpaper(g, x, y, w, h, wall, t) {
    g.fillStyle = wall.color; g.fillRect(x, y, w, h);
    const dark = U.shade(wall.color, -0.1), light = U.shade(wall.color, -0.16);
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    if (wall.style === 'stripes') { g.fillStyle = dark; for (let xx = x; xx < x + w; xx += 36) g.fillRect(xx, y, 14, h); }
    else if (wall.style === 'dots') { g.fillStyle = light; for (let yy = y + 20; yy < y + h; yy += 40) for (let xx = x + 20 + ((yy / 40) % 2) * 20; xx < x + w; xx += 40) { LZ.Art.ell(g, xx, yy, 6, 6); g.fill(); } }
    else if (wall.style === 'stars') { for (let yy = y + 26; yy < y + h; yy += 56) for (let xx = x + 26 + ((yy / 56) % 2) * 28; xx < x + w; xx += 56) { LZ.Art.starPath(g, xx, yy, 9, 4, 5, 0.3); g.fillStyle = light; g.fill(); } }
    else if (wall.style === 'hearts') { for (let yy = y + 26; yy < y + h; yy += 56) for (let xx = x + 26 + ((yy / 56) % 2) * 28; xx < x + w; xx += 56) { LZ.Art.heartPath(g, xx, yy, 9); g.fillStyle = light; g.fill(); } }
    // skirting board and a soft shadow under the ceiling
    g.fillStyle = 'rgba(120,70,30,0.12)'; g.fillRect(x, y, w, 14);
    g.fillStyle = '#fff6e8'; g.fillRect(x, y + h - 16, w, 16); g.fillStyle = 'rgba(120,70,30,0.2)'; g.fillRect(x, y + h - 16, w, 3);
    g.restore();
  }
  function drawDoor(g, x, y, t, glow) {
    const top = y - 2.4 * T;
    U.rr(g, x - 4, top - 4, T + 8, 2.4 * T + 4, 16); LZ.Art.fs(g, '#b8834a');
    U.rr(g, x + 2, top + 2, T - 4, 2.4 * T - 2, 12); LZ.Art.fs(g, '#8a5a32', '#5c3a1c', 2);
    g.strokeStyle = '#6b4424'; g.lineWidth = 3; g.strokeRect(x + 9, top + 12, T - 18, 36); g.strokeRect(x + 9, top + 58, T - 18, 42);
    LZ.Art.ell(g, x + T - 12, top + 60, 4, 4); LZ.Art.fs(g, '#ffd23f', '#b8861c', 1);
    if (glow > 0) { g.fillStyle = 'rgba(255,245,200,' + (0.5 * glow) + ')'; U.rr(g, x + 2, top + 2, T - 4, 2.4 * T - 2, 12); g.fill(); }
    // little sign above the door
    U.rr(g, x - 8, top - 30, T + 16, 22, 6); LZ.Art.fs(g, '#fff6c9', '#b8834a', 2);
    g.fillStyle = '#7a5ce6'; g.font = '800 14px "Baloo 2", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('WYJŚCIE', x + T / 2, top - 18);
  }

  /*
   * Every piece of furniture, drawn from its bottom-left corner (x, yb) with
   * width w (px). Simple rounded shapes in the same style as the rest of the
   * game; a few are live (the aquarium fish swim, the fire flickers, the
   * trophy shelf shows the bosses she has actually beaten).
   */
  function drawFurniture(g, id, x, yb, w, t, flip, prof) {
    const Art = LZ.Art, ell = Art.ell, fs = Art.fs, rr = U.rr;
    g.save();
    if (flip) { g.translate(x * 2 + w, 0); g.scale(-1, 1); }
    const X = x, Y = yb;
    switch (id) {
      case 'bed': {
        rr(g, X + 4, Y - 58, 14, 58, 6); fs(g, '#b8834a', '#6b4424', 2);
        rr(g, X + w - 18, Y - 42, 14, 42, 6); fs(g, '#b8834a', '#6b4424', 2);
        rr(g, X + 10, Y - 40, w - 20, 22, 8); fs(g, '#fff6f0', '#c9a0a0', 2);
        rr(g, X + 40, Y - 44, w - 52, 26, 10); fs(g, '#ff9ecf', '#d9458a', 2);
        g.fillStyle = 'rgba(255,255,255,0.5)'; for (let i = 0; i < 4; i++) { ell(g, X + 56 + i * 18, Y - 34, 3, 3); g.fill(); }
        ell(g, X + 30, Y - 42, 16, 9); fs(g, '#ffffff', '#c9a0a0', 2);
        rr(g, X + 8, Y - 18, w - 16, 10, 4); fs(g, '#8a5a32');
        break;
      }
      case 'sofa': case 'cloudbed': {
        const cloud = id === 'cloudbed';
        const c1 = cloud ? '#ffffff' : '#7ad3c8', c2 = cloud ? '#dfe8ff' : '#3fa89c';
        rr(g, X + 2, Y - 64, w - 4, 34, 16); fs(g, c1, c2, 2.5);
        rr(g, X + 2, Y - 38, 22, 34, 10); fs(g, c1, c2, 2.5); rr(g, X + w - 24, Y - 38, 22, 34, 10); fs(g, c1, c2, 2.5);
        rr(g, X + 20, Y - 40, w - 40, 26, 10); fs(g, U.shade(c1, -0.06), c2, 2);
        if (cloud) for (let i = 0; i < 5; i++) { ell(g, X + 14 + i * (w - 28) / 4, Y - 62, 16, 12); fs(g, '#fff'); }
        else { ctxLegs(g, X + 10, Y); ctxLegs(g, X + w - 16, Y); }
        break;
      }
      case 'armchair': {
        rr(g, X + 4, Y - 64, w - 8, 36, 14); fs(g, '#ffb877', '#c4702a', 2.5);
        rr(g, X + 2, Y - 36, 16, 32, 8); fs(g, '#ffb877', '#c4702a', 2.5); rr(g, X + w - 18, Y - 36, 16, 32, 8); fs(g, '#ffb877', '#c4702a', 2.5);
        rr(g, X + 14, Y - 36, w - 28, 22, 8); fs(g, '#ffcf99', '#c4702a', 2);
        ctxLegs(g, X + 8, Y); ctxLegs(g, X + w - 14, Y);
        break;
      }
      case 'table': case 'desk': {
        rr(g, X, Y - 54, w, 12, 5); fs(g, '#c98a5a', '#6b4424', 2);
        g.fillStyle = '#a86c40'; g.fillRect(X + 8, Y - 44, 8, 44); g.fillRect(X + w - 16, Y - 44, 8, 44);
        if (id === 'desk') {
          rr(g, X + w - 40, Y - 44, 32, 30, 4); fs(g, '#b8834a', '#6b4424', 2); ell(g, X + w - 24, Y - 30, 3, 3); fs(g, '#ffd23f');
          g.strokeStyle = '#5a6388'; g.lineWidth = 3; g.beginPath(); g.moveTo(X + 20, Y - 54); g.lineTo(X + 26, Y - 76); g.lineTo(X + 40, Y - 82); g.stroke();
          ctxShade(g, X + 40, Y - 82);
        } else { ell(g, X + w / 2, Y - 60, 10, 6); fs(g, '#ff85c8', '#b8467a', 1.5); ell(g, X + w / 2 - 4, Y - 66, 4, 4); fs(g, '#ffe066'); }
        break;
      }
      case 'chair': {
        rr(g, X + 8, Y - 72, 8, 40, 3); fs(g, '#c98a5a', '#6b4424', 2);
        rr(g, X + 8, Y - 38, w - 12, 8, 3); fs(g, '#c98a5a', '#6b4424', 2);
        g.fillStyle = '#a86c40'; g.fillRect(X + 10, Y - 30, 5, 30); g.fillRect(X + w - 10, Y - 30, 5, 30);
        rr(g, X + 12, Y - 40, w - 18, 6, 3); fs(g, '#ff85b0');
        break;
      }
      case 'lamp': case 'crystallamp': {
        g.fillStyle = id === 'crystallamp' ? '#9aa3c5' : '#6b4424'; g.fillRect(X + w / 2 - 3, Y - 88, 6, 84);
        ell(g, X + w / 2, Y - 4, 14, 5); fs(g, '#8a5a32');
        const glow = g.createRadialGradient(X + w / 2, Y - 92, 4, X + w / 2, Y - 92, 60);
        glow.addColorStop(0, id === 'crystallamp' ? 'rgba(160,230,255,0.45)' : 'rgba(255,240,170,0.5)'); glow.addColorStop(1, 'rgba(255,240,170,0)');
        g.fillStyle = glow; g.fillRect(X + w / 2 - 60, Y - 152, 120, 120);
        if (id === 'crystallamp') { g.beginPath(); g.moveTo(X + w / 2, Y - 126); g.lineTo(X + w / 2 + 14, Y - 96); g.lineTo(X + w / 2, Y - 84); g.lineTo(X + w / 2 - 14, Y - 96); g.closePath(); fs(g, '#bfefff', '#5ab8e6', 2); }
        else { g.beginPath(); g.moveTo(X + 4, Y - 84); g.lineTo(X + w - 4, Y - 84); g.lineTo(X + w - 12, Y - 108); g.lineTo(X + 12, Y - 108); g.closePath(); fs(g, '#ffe066', '#c99a12', 2); }
        break;
      }
      case 'bookshelf': {
        rr(g, X + 2, Y - 3 * T, w - 4, 3 * T, 6); fs(g, '#b8834a', '#6b4424', 2.5);
        const cols = ['#ff5e7e', '#5ccfff', '#7be08a', '#ffd23f', '#9d7bff', '#ff8a3d'];
        for (let r = 0; r < 3; r++) {
          const sy = Y - 3 * T + 8 + r * 46;
          g.fillStyle = '#8a5a32'; g.fillRect(X + 8, sy + 36, w - 16, 5);
          for (let i = 0; i < 6; i++) { g.fillStyle = cols[(i + r * 2) % 6]; g.fillRect(X + 10 + i * 12, sy + 8 + ((i + r) % 3) * 3, 10, 28 - ((i + r) % 3) * 3); }
        }
        break;
      }
      case 'plant': case 'bigplant': case 'cactuspot': {
        const big = id === 'bigplant', cac = id === 'cactuspot';
        rr(g, X + w / 2 - 14, Y - 24, 28, 24, 6); fs(g, cac ? '#e0a45a' : '#ff8a5c', '#b8562a', 2);
        if (cac) { rr(g, X + w / 2 - 9, Y - 70, 18, 48, 9); fs(g, '#5cc15a', '#2f7a2a', 2); rr(g, X + w / 2 + 6, Y - 56, 10, 20, 5); fs(g, '#5cc15a', '#2f7a2a', 2); ell(g, X + w / 2, Y - 72, 5, 5); fs(g, '#ff85c8'); }
        else {
          const n = big ? 7 : 5, hh = big ? 100 : 36;
          for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.45; g.save(); g.translate(X + w / 2, Y - 22); g.rotate(a + Math.PI / 2); ell(g, 0, -hh / 2, big ? 10 : 7, hh / 2); fs(g, '#5cc15a', '#2f7a2a', 1.5); g.restore(); }
          if (!big) { ell(g, X + w / 2, Y - 50, 7, 7); fs(g, '#ff85c8', '#b8467a', 1.5); ell(g, X + w / 2, Y - 50, 3, 3); fs(g, '#ffe066'); }
        }
        break;
      }
      case 'rug': {
        ell(g, X + w / 2, Y - 3, w / 2, 8); fs(g, '#9d7bff', '#6a4fcf', 2);
        g.fillStyle = 'rgba(255,255,255,0.6)'; for (let i = 0; i < 6; i++) { ell(g, X + 20 + i * (w - 40) / 5, Y - 3, 3, 2); g.fill(); }
        break;
      }
      case 'picture': {
        rr(g, X, Y - 1.2 * T, w, 1.2 * T, 4); fs(g, '#fff', '#c98a5a', 5);
        g.save(); g.beginPath(); g.rect(X + 6, Y - 1.2 * T + 6, w - 12, 1.2 * T - 12); g.clip();
        g.fillStyle = '#bfe8ff'; g.fillRect(X, Y - T * 1.2, w, T * 1.2);
        ['#ff5e7e', '#ffa62b', '#ffe066', '#7be08a', '#5ccfff', '#9d7bff'].forEach((c, i) => { g.beginPath(); g.arc(X + w / 2, Y, 44 - i * 5, Math.PI, 0); g.strokeStyle = c; g.lineWidth = 5; g.stroke(); });
        g.restore();
        break;
      }
      case 'clock': {
        ell(g, X + w / 2, Y - w / 2, w / 2 - 2, w / 2 - 2); fs(g, '#fff6e8', '#b8834a', 4);
        const a1 = t * 0.5, a2 = t * 6;
        g.strokeStyle = '#5a3a8a'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath();
        g.moveTo(X + w / 2, Y - w / 2); g.lineTo(X + w / 2 + Math.cos(a1) * 10, Y - w / 2 + Math.sin(a1) * 10);
        g.moveTo(X + w / 2, Y - w / 2); g.lineTo(X + w / 2 + Math.cos(a2) * 15, Y - w / 2 + Math.sin(a2) * 15); g.stroke();
        break;
      }
      case 'window': {
        rr(g, X, Y - 2 * T, w, 2 * T, 6); fs(g, '#8fd3ff', '#fff', 6);
        ell(g, X + w * 0.7, Y - 1.5 * T, 12, 12); fs(g, '#fff6c9');
        g.fillStyle = '#fff'; g.fillRect(X + w / 2 - 2, Y - 2 * T, 4, 2 * T); g.fillRect(X, Y - T - 2, w, 4);
        g.fillStyle = 'rgba(255,158,207,0.85)'; g.beginPath(); g.moveTo(X - 6, Y - 2 * T - 6); g.quadraticCurveTo(X + 14, Y - T, X + 4, Y + 4); g.lineTo(X - 6, Y + 4); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(X + w + 6, Y - 2 * T - 6); g.quadraticCurveTo(X + w - 14, Y - T, X + w - 4, Y + 4); g.lineTo(X + w + 6, Y + 4); g.closePath(); g.fill();
        break;
      }
      case 'shelf': case 'trophies': {
        rr(g, X, Y - 14, w, 12, 4); fs(g, '#c98a5a', '#6b4424', 2);
        if (id === 'trophies') {
          const wins = (prof && prof.bossWins) || [];
          const n = Math.max(3, Math.min(9, D.WORLDS.length));
          for (let i = 0; i < n; i++) {
            const cx = X + 14 + i * (w - 28) / (n - 1), won = wins.includes(i + 1);
            g.globalAlpha = won ? 1 : 0.25;
            rr(g, cx - 7, Y - 22, 14, 8, 2); fs(g, '#b8861c');
            g.beginPath(); g.moveTo(cx - 10, Y - 42); g.lineTo(cx + 10, Y - 42); g.quadraticCurveTo(cx + 10, Y - 24, cx, Y - 24); g.quadraticCurveTo(cx - 10, Y - 24, cx - 10, Y - 42); fs(g, won ? '#ffd23f' : '#ccc', '#b8861c', 1.5);
            g.globalAlpha = 1;
          }
        } else { ell(g, X + 16, Y - 24, 8, 10); fs(g, '#5ccfff', '#2a7fb0', 1.5); rr(g, X + w - 34, Y - 30, 22, 16, 3); fs(g, '#ff85b0'); }
        break;
      }
      case 'stickerboard': case 'worldmap': {
        rr(g, X, Y - 1.6 * T, w, 1.6 * T, 6); fs(g, id === 'worldmap' ? '#fff1c7' : '#e8c9a0', '#8a5a32', 4);
        if (id === 'worldmap') {
          g.strokeStyle = '#5cc15a'; g.lineWidth = 5; g.beginPath(); g.moveTo(X + 10, Y - 30); g.quadraticCurveTo(X + w / 2, Y - 60, X + w - 10, Y - 40); g.stroke();
          g.fillStyle = '#5ccfff'; ell(g, X + w * 0.7, Y - 22, 14, 7); g.fill();
          g.strokeStyle = '#ff5e7e'; g.setLineDash([4, 4]); g.lineWidth = 2; g.beginPath(); g.moveTo(X + 16, Y - 56); g.lineTo(X + w - 20, Y - 58); g.stroke(); g.setLineDash([]);
          LZ.Art.starPath(g, X + w - 20, Y - 58, 7, 3, 5, 0); fs(g, '#ffd23f');
          g.fillStyle = '#ff5e7e'; g.fillRect(X + 16, Y - 64, 3, 12); g.beginPath(); g.moveTo(X + 19, Y - 64); g.lineTo(X + 28, Y - 60); g.lineTo(X + 19, Y - 56); g.fill();
        } else {
          const n = Math.min(12, ((prof && prof.stickers) || []).length);
          for (let i = 0; i < 12; i++) { const sx = X + 10 + (i % 4) * (w - 20) / 4, sy = Y - 1.6 * T + 10 + Math.floor(i / 4) * 20; rr(g, sx, sy, (w - 28) / 4, 16, 4); fs(g, i < n ? ['#ff9ecf', '#bfe8ff', '#ffe680', '#c9f5d3'][i % 4] : 'rgba(0,0,0,0.08)'); }
        }
        break;
      }
      case 'toybox': case 'treasure': {
        const gold = id === 'treasure';
        rr(g, X + 2, Y - 44, w - 4, 44, 8); fs(g, gold ? '#b8834a' : '#5ccfff', gold ? '#6b4424' : '#2a7fb0', 2.5);
        rr(g, X, Y - 54, w, 14, 7); fs(g, gold ? '#c98a5a' : '#ff85c8', gold ? '#6b4424' : '#b8467a', 2.5);
        if (gold) { g.fillStyle = '#ffd23f'; g.fillRect(X + w / 2 - 5, Y - 50, 10, 18); for (let i = 0; i < 3; i++) Art.drawCoin(g, X + 16 + i * 14, Y - 58, 0.2, 7); }
        else { LZ.Art.starPath(g, X + w / 2, Y - 22, 10, 4.5, 5, 0); fs(g, '#ffe066'); }
        break;
      }
      case 'teddy': {
        ell(g, X + w / 2, Y - 16, 16, 16); fs(g, '#c98a5a', '#6b4424', 2);
        ell(g, X + w / 2, Y - 40, 13, 12); fs(g, '#c98a5a', '#6b4424', 2);
        ell(g, X + w / 2 - 11, Y - 50, 5, 5); fs(g, '#c98a5a', '#6b4424', 2); ell(g, X + w / 2 + 11, Y - 50, 5, 5); fs(g, '#c98a5a', '#6b4424', 2);
        ell(g, X + w / 2, Y - 36, 5, 4); fs(g, '#f3e1d2'); ell(g, X + w / 2 - 5, Y - 43, 1.8, 2.2); fs(g, '#222'); ell(g, X + w / 2 + 5, Y - 43, 1.8, 2.2); fs(g, '#222');
        rr(g, X + w / 2 - 9, Y - 29, 18, 5, 2); fs(g, '#ff5e7e');
        break;
      }
      case 'piano': {
        rr(g, X + 2, Y - 2.2 * T, w - 4, 2.2 * T - 30, 8); fs(g, '#3a2a3a', '#111', 2.5);
        rr(g, X - 4, Y - 42, w + 8, 12, 3); fs(g, '#fff', '#888', 1.5);
        g.fillStyle = '#222'; for (let i = 0; i < 12; i++) if (i % 7 !== 2 && i % 7 !== 6) g.fillRect(X + 4 + i * (w - 8) / 12, Y - 42, 5, 7);
        g.fillStyle = '#3a2a3a'; g.fillRect(X + 8, Y - 30, 8, 30); g.fillRect(X + w - 16, Y - 30, 8, 30);
        g.fillStyle = '#ffd23f'; g.font = '20px sans-serif'; g.textAlign = 'center'; g.fillText('♪', X + w / 2 + Math.sin(t * 2) * 6, Y - 2.2 * T - 10 - (t * 10) % 20);
        break;
      }
      case 'aquarium': {
        g.fillStyle = '#6b4424'; g.fillRect(X + 6, Y - 40, w - 12, 40);
        rr(g, X, Y - 2 * T + 6, w, 2 * T - 44, 6); fs(g, 'rgba(120,210,255,0.55)', '#5a8ab0', 3);
        for (let i = 0; i < 3; i++) { const fx = X + 20 + ((t * 30 + i * 30) % (w - 40)), fy = Y - 2 * T + 22 + i * 12; ell(g, fx, fy, 7, 4.5); fs(g, ['#ff8a3d', '#ffe066', '#ff85c8'][i]); }
        g.fillStyle = '#5cc15a'; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(X + 10 + i * 20, Y - 42); g.quadraticCurveTo(X + 16 + i * 20 + Math.sin(t * 2 + i) * 4, Y - 60, X + 12 + i * 20, Y - 74); g.lineTo(X + 16 + i * 20, Y - 42); g.fill(); }
        break;
      }
      case 'fireplace': case 'chocofountain': {
        if (id === 'chocofountain') {
          rr(g, X + 8, Y - 16, w - 16, 16, 6); fs(g, '#e8e8f0', '#9aa3b5', 2);
          g.fillStyle = '#8b5a3c'; g.fillRect(X + w / 2 - 5, Y - 80, 10, 66);
          for (let i = 0; i < 3; i++) { ell(g, X + w / 2, Y - 34 - i * 22, 22 - i * 5, 5); fs(g, '#e8e8f0', '#9aa3b5', 1.5); ell(g, X + w / 2, Y - 34 - i * 22 + 4, 20 - i * 5, 4); fs(g, '#8b5a3c'); }
          ell(g, X + w / 2 + 12, Y - 60 + Math.sin(t * 3) * 3, 5, 5); fs(g, '#ff5e7e');
        } else {
          rr(g, X, Y - 2.5 * T + 10, w, 2.5 * T - 10, 6); fs(g, '#d98a6a', '#8a4a2a', 2.5);
          g.fillStyle = 'rgba(0,0,0,0.12)'; for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) g.fillRect(X + 6 + c * 28 + (r % 2) * 14, Y - 2.5 * T + 20 + r * 20, 24, 2);
          rr(g, X + 20, Y - 60, w - 40, 60, 20); fs(g, '#3a2020');
          for (let i = 0; i < 3; i++) { const fh = 26 + Math.sin(t * 9 + i * 2) * 6; g.beginPath(); g.moveTo(X + 34 + i * 16, Y - 6); g.quadraticCurveTo(X + 26 + i * 16, Y - 6 - fh / 2, X + 38 + i * 16, Y - 6 - fh); g.quadraticCurveTo(X + 46 + i * 16, Y - 6 - fh / 2, X + 42 + i * 16, Y - 6); fs(g, i % 2 ? '#ffd23f' : '#ff8a3d'); }
          rr(g, X - 6, Y - 2.5 * T + 4, w + 12, 12, 4); fs(g, '#b8834a', '#6b4424', 2);
        }
        break;
      }
      case 'tv': {
        g.fillStyle = '#6b4424'; g.fillRect(X + 10, Y - 40, w - 20, 40);
        rr(g, X + 4, Y - 1.9 * T, w - 8, 1.9 * T - 44, 8); fs(g, '#3a3a4a', '#111', 2.5);
        const scr = ['#5ccfff', '#ff85c8', '#7be08a'][Math.floor(t / 2) % 3];
        rr(g, X + 10, Y - 1.9 * T + 6, w - 20, 1.9 * T - 58, 5); fs(g, scr);
        ell(g, X + w / 2, Y - 1.9 * T + 26, 8, 8); fs(g, '#fff6c9');
        break;
      }
      case 'beanbag': {
        g.beginPath(); g.moveTo(X + 4, Y); g.quadraticCurveTo(X, Y - 40, X + w / 2, Y - 46); g.quadraticCurveTo(X + w, Y - 40, X + w - 4, Y); g.closePath(); fs(g, '#ff85c8', '#b8467a', 2.5);
        ell(g, X + w / 2 - 8, Y - 30, 8, 5, -0.4); fs(g, 'rgba(255,255,255,0.4)');
        break;
      }
      case 'lights': {
        g.strokeStyle = '#3a6a3a'; g.lineWidth = 2; g.beginPath(); g.moveTo(X, Y - 26); for (let i = 1; i <= 4; i++) g.quadraticCurveTo(X + (i - 0.5) * w / 4, Y - 8, X + i * w / 4, Y - 26); g.stroke();
        for (let i = 0; i < 12; i++) { const lx = X + 8 + i * (w - 16) / 11, ly = Y - 26 + Math.sin((i % 3) / 3 * Math.PI) * 14; ell(g, lx, ly + 4, 4, 5); fs(g, Math.floor(t * 3 + i) % 3 === 0 ? '#fff6c9' : ['#ff5e7e', '#ffe066', '#5ccfff', '#7be08a'][i % 4]); }
        break;
      }
      case 'candy': {
        rr(g, X + 4, Y - 44, w - 8, 44, 4); fs(g, '#ff5e7e', '#a3223f', 2);
        ell(g, X + w / 2, Y - 66, w / 2 - 2, 24); fs(g, 'rgba(220,245,255,0.8)', '#5a8ab0', 2);
        for (let i = 0; i < 9; i++) { ell(g, X + 12 + (i % 3) * 12, Y - 76 + Math.floor(i / 3) * 10, 4.5, 4.5); fs(g, ['#ffe066', '#7be08a', '#9d7bff'][i % 3]); }
        ell(g, X + w / 2, Y - 28, 5, 5); fs(g, '#ffd23f');
        break;
      }
      case 'throne': {
        rr(g, X + 10, Y - 2.3 * T, w - 20, 2.3 * T - 30, 14); fs(g, '#ffd23f', '#b8861c', 3);
        rr(g, X + 20, Y - 2.3 * T + 14, w - 40, 60, 10); fs(g, '#ff5e7e', '#a3223f', 2);
        rr(g, X + 2, Y - 44, w - 4, 16, 6); fs(g, '#ffd23f', '#b8861c', 3);
        g.fillStyle = '#b8861c'; g.fillRect(X + 10, Y - 30, 8, 30); g.fillRect(X + w - 18, Y - 30, 8, 30);
        ell(g, X + w / 2, Y - 2.3 * T - 4, 8, 8); fs(g, '#5ccfff', '#2a7fb0', 2);
        break;
      }
      case 'telescope': {
        g.strokeStyle = '#6b4424'; g.lineWidth = 5; g.beginPath(); g.moveTo(X + w / 2, Y - 50); g.lineTo(X + 8, Y); g.moveTo(X + w / 2, Y - 50); g.lineTo(X + w - 8, Y); g.moveTo(X + w / 2, Y - 50); g.lineTo(X + w / 2, Y); g.stroke();
        g.save(); g.translate(X + w / 2, Y - 56); g.rotate(-0.6); rr(g, -34, -9, 68, 18, 8); fs(g, '#5a6388', '#2d2a3a', 2); rr(g, 26, -12, 12, 24, 5); fs(g, '#ffd23f', '#b8861c', 2); g.restore();
        break;
      }
      case 'fossil': {
        // a soft brown outline so the white bones show on light wallpaper
        g.shadowColor = '#8a6a4a'; g.shadowOffsetX = 1.5; g.shadowOffsetY = 1.5;
        g.strokeStyle = '#fff6e0'; g.lineWidth = 7; g.lineCap = 'round';
        g.beginPath(); g.moveTo(X + 10, Y - 50); g.quadraticCurveTo(X + w / 2, Y - 90, X + w - 40, Y - 60); g.quadraticCurveTo(X + w - 20, Y - 90, X + w - 8, Y - 96); g.stroke();
        g.lineWidth = 4; for (let i = 0; i < 6; i++) { const bx = X + 30 + i * 16; g.beginPath(); g.moveTo(bx, Y - 70 + Math.abs(i - 2.5) * 3); g.lineTo(bx, Y - 44); g.stroke(); }
        g.lineWidth = 6; g.beginPath(); g.moveTo(X + 40, Y - 50); g.lineTo(X + 36, Y); g.moveTo(X + w - 50, Y - 55); g.lineTo(X + w - 46, Y); g.stroke();
        ell(g, X + w - 8, Y - 100, 14, 9); fs(g, '#fff6e0'); ell(g, X + w - 4, Y - 102, 2.5, 2.5); fs(g, '#5a3a8a');
        g.shadowColor = 'transparent';
        rr(g, X, Y - 8, w, 8, 3); fs(g, '#9aa3b5');
        break;
      }
      case 'rocket': {
        rr(g, X + w / 2 - 12, Y - 96, 24, 80, 12); fs(g, '#e8e8f0', '#5a6388', 2);
        g.beginPath(); g.moveTo(X + w / 2 - 12, Y - 84); g.quadraticCurveTo(X + w / 2, Y - 116, X + w / 2 + 12, Y - 84); fs(g, '#ff5e7e', '#a3223f', 2);
        ell(g, X + w / 2, Y - 66, 7, 7); fs(g, '#5ccfff', '#2a7fb0', 2);
        tri(g, X + w / 2 - 12, Y - 36, X + w / 2 - 22, Y - 14, X + w / 2 - 12, Y - 18); fs(g, '#ff5e7e');
        tri(g, X + w / 2 + 12, Y - 36, X + w / 2 + 22, Y - 14, X + w / 2 + 12, Y - 18); fs(g, '#ff5e7e');
        rr(g, X + 4, Y - 14, w - 8, 14, 4); fs(g, '#9aa3b5');
        break;
      }
      case 'snowglobe': {
        rr(g, X + 8, Y - 14, w - 16, 14, 5); fs(g, '#b8834a', '#6b4424', 2);
        ell(g, X + w / 2, Y - 34, 20, 20); fs(g, 'rgba(220,245,255,0.6)', '#8fb4e0', 2);
        tri(g, X + w / 2 - 8, Y - 20, X + w / 2, Y - 40, X + w / 2 + 8, Y - 20); fs(g, '#4f8f7a');
        for (let i = 0; i < 6; i++) { ell(g, X + w / 2 - 12 + ((i * 7 + t * 8) % 24), Y - 46 + ((i * 11 + t * 12) % 24), 1.6, 1.6); fs(g, '#fff'); }
        break;
      }
      case 'mushlamp': {
        rr(g, X + w / 2 - 6, Y - 40, 12, 40, 5); fs(g, '#fff3e0', '#8a6a50', 2);
        g.beginPath(); g.ellipse(X + w / 2, Y - 40, 22, 20, 0, Math.PI, 0); g.closePath(); fs(g, '#ff6b8a', '#a3334f', 2);
        [[-10, -48], [6, -54], [12, -44]].forEach(([dx, dy]) => { ell(g, X + w / 2 + dx, Y + dy, 3.5, 3); fs(g, '#fff'); });
        const gl = g.createRadialGradient(X + w / 2, Y - 44, 4, X + w / 2, Y - 44, 46); gl.addColorStop(0, 'rgba(255,160,200,0.35)'); gl.addColorStop(1, 'rgba(255,160,200,0)'); g.fillStyle = gl; g.fillRect(X - 30, Y - 90, w + 60, 90);
        break;
      }
      case 'train': {
        g.strokeStyle = '#8a5a32'; g.lineWidth = 3; g.beginPath(); g.moveTo(X, Y - 3); g.lineTo(X + w, Y - 3); g.stroke();
        const off = (t * 20) % 20;
        for (let i = 0; i < 3; i++) { const cx = X + 8 + i * 44; rr(g, cx, Y - 30, 38, 22, 5); fs(g, ['#ff5e7e', '#5ccfff', '#ffd23f'][i], '#5a3a8a', 2); ell(g, cx + 9, Y - 6, 6, 6); fs(g, '#3a3a4a'); ell(g, cx + 29, Y - 6, 6, 6); fs(g, '#3a3a4a'); }
        rr(g, X + 12, Y - 42, 12, 12, 3); fs(g, '#ff5e7e', '#5a3a8a', 2);
        ell(g, X + 10, Y - 50 - off, 5 + off / 4, 4 + off / 5); fs(g, 'rgba(255,255,255,' + (0.8 - off / 25) + ')');
        break;
      }
      case 'shelllamp': {
        rr(g, X + w / 2 - 3, Y - 50, 6, 50, 3); fs(g, '#e8c9a0');
        ell(g, X + w / 2, Y - 3, 14, 4); fs(g, '#e8c9a0');
        g.beginPath(); g.moveTo(X + w / 2, Y - 50); for (let i = 0; i <= 6; i++) { const a = Math.PI + i * Math.PI / 6; g.lineTo(X + w / 2 + Math.cos(a) * 22, Y - 50 + Math.sin(a) * 26); } g.closePath(); fs(g, '#ffb3c7', '#d9458a', 2);
        g.strokeStyle = 'rgba(217,69,138,0.5)'; g.lineWidth = 1.5; for (let i = 1; i < 6; i++) { const a = Math.PI + i * Math.PI / 6; g.beginPath(); g.moveTo(X + w / 2, Y - 50); g.lineTo(X + w / 2 + Math.cos(a) * 20, Y - 50 + Math.sin(a) * 24); g.stroke(); }
        break;
      }
      default: if (!LZ.Ext.first('furn', 'draw', g, id, X, Y, w, t, prof)) { rr(g, X, Y - T, w, T, 6); fs(g, '#e8dcff', '#9d7bff', 2); }
    }
    g.restore();
    function ctxLegs(gg, lx, ly) { gg.fillStyle = '#8a5a32'; gg.fillRect(lx, ly - 8, 6, 8); }
    function ctxShade(gg, sx, sy) { gg.beginPath(); gg.moveTo(sx - 12, sy + 10); gg.lineTo(sx + 12, sy + 10); gg.lineTo(sx + 6, sy - 6); gg.lineTo(sx - 6, sy - 6); gg.closePath(); LZ.Art.fs(gg, '#ffe066', '#c99a12', 2); }
    function tri(gg, a, b, c, d, e, f) { LZ.Art.tri(gg, a, b, c, d, e, f); }
  }

  /* Put a new piece on the ground floor where nothing stands yet (or in
     "Moje rzeczy" when the room is full). Returns true when placed. */
  function autoPlace(p, id) {
    const home = homeOf(p), f = FURN_BY[id], W = (SIZES[home.size] || SIZES[1]).W;
    const floorItems = home.items.filter(it => FURN_BY[it.id] && !FURN_BY[it.id].wall && it.y === FLOOR && FURN_BY[it.id].id !== 'rug');
    // the right end stays free: she comes in there and the door is there
    for (let x = W - 7.5 - f.w; x >= 1; x -= 0.5) {
      if (floorItems.every(it => x + f.w <= it.x || x >= it.x + FURN_BY[it.id].w)) { home.items.push({ id, x, y: FLOOR }); return true; }
    }
    home.inv[id] = (home.inv[id] || 0) + 1; return false;
  }

  /* ---------------- decorate mode ---------------- */
  let deco = null;   // { tab, pick: {id, fromIdx}, layer }
  // the Urządzaj button sits in the shared button row (LZ.Fun.bar)
  function showHomeButtons(on) { if (!on) closeDeco(); }
  function G_() { return LZ.Game._dbg(); }
  function openDeco(tab) {
    const G = G_(); if (!G || G.kind !== 'home') return;
    LZ.In.reset();
    G.decorating = true;
    closeDeco(true);
    const h = LZ.UI._h;
    deco = { tab: tab || 'mine', pick: null };
    const layer = h('div.decolayer');
    const bar = h('div.decobar');
    const top = h('div.decotop', null, [
      h('button.btn.small', { onclick: () => closeDeco() }, '✓ Gotowe'),
      h('div.decotabs', null, [['mine', 'Moje rzeczy'], ['shop', 'Sklep meblowy'], ['wall', 'Tapeta'], ['grow', 'Rozbudowa']].map(([k, n]) => h('button.tab' + (deco.tab === k ? '.on' : ''), { onclick: () => { deco.tab = k; deco.pick = null; render(); } }, n))),
      h('div.decocoins', null, [h('span.coin-ico'), ' ' + G.prof.coins]),
    ]);
    const hint = h('div.decohint');
    // the catalog is a column on the right: on a landscape phone that's the
    // spare room, while a bar at the bottom covered the floor she decorates
    layer.appendChild(top); layer.appendChild(h('div.decomain', null, [hint, bar]));
    document.getElementById('ui').parentNode.appendChild(layer);
    document.body.classList.add('decorating');   // hides the move/jump buttons while decorating
    deco.layer = layer;
    // taps on the room place or pick up furniture; a drag scrolls a wide room
    let down = null;
    const panelW = () => bar.getBoundingClientRect().width / LZ.Game.view.scale;
    const clampRoom = () => { const vis = LZ.Game.view.w - panelW(); G.cam.x = Math.max(-8, Math.min(G.W * T + 8 - vis, G.cam.x)); if (G.W * T < vis) G.cam.x = (G.W * T - vis) / 2; };
    setTimeout(() => { G.cam.x = G.player.x - (LZ.Game.view.w - panelW()) / 2; G.cam.y = Math.max(0, G.H * T - LZ.Game.view.h); clampRoom(); }, 0);
    const isRoom = el => el === layer || (el.classList && el.classList.contains('decomain')) || (el.classList && el.classList.contains('decohint'));
    layer.addEventListener('pointerdown', ev => { if (!isRoom(ev.target)) return; down = { x: ev.clientX, y: ev.clientY, cam: G.cam.x, moved: false }; });
    layer.addEventListener('pointermove', ev => {
      if (!down) return;
      const dx = ev.clientX - down.x;
      if (Math.abs(dx) > 8) down.moved = true;
      if (down.moved) { G.cam.x = down.cam - dx / LZ.Game.view.scale; clampRoom(); }
    });
    layer.addEventListener('pointerup', ev => { if (!down) return; const d = down; down = null; if (!d.moved) tapRoom(ev.clientX, ev.clientY); });
    function render() {
      const p = G.prof, home = homeOf(p);
      top.querySelectorAll('.tab').forEach((b, i) => b.classList.toggle('on', ['mine', 'shop', 'wall', 'grow'][i] === deco.tab));
      top.querySelector('.decocoins').lastChild.textContent = ' ' + p.coins;
      bar.innerHTML = '';
      hint.textContent = deco.pick ? 'Stuknij w pokój, gdzie ma stać: ' + FURN_BY[deco.pick.id].name : deco.tab === 'mine' ? 'Wybierz rzecz z listy obok albo stuknij mebel w pokoju, żeby go przesunąć.' : '';
      hint.classList.toggle('on', !!hint.textContent);
      if (deco.tab === 'mine') {
        const ids = Object.keys(home.inv).filter(k => home.inv[k] > 0);
        if (!ids.length) bar.appendChild(h('div.decoempty', null, 'Wszystko stoi w pokoju. Nowe rzeczy kupisz w sklepie albo znajdziesz na wyprawach!'));
        ids.forEach(id => bar.appendChild(itemCard(id, '×' + home.inv[id], () => { deco.pick = { id }; render(); }, deco.pick && deco.pick.id === id)));
      } else if (deco.tab === 'shop') {
        FURN.filter(f => f.price > 0).forEach(f => bar.appendChild(itemCard(f.id, f.price, () => buy(f), false, p.coins < f.price)));
      } else if (deco.tab === 'wall') {
        WALLS.forEach(wl => bar.appendChild(h('button.decoitem' + (home.wall.style === wl.id ? '.sel' : ''), { onclick: () => { if (home.wall.style !== wl.id && !payWall()) return; home.wall.style = wl.id; S.save(); render(); } }, [wallSwatch(wl.id, home.wall.color), h('span', null, wl.name)])));
        WALL_COLORS.forEach(c => bar.appendChild(h('button.decoitem' + (home.wall.color === c ? '.sel' : ''), { onclick: () => { if (home.wall.color !== c && !payWall()) return; home.wall.color = c; S.save(); render(); } }, [h('span.swatch', { style: 'background:' + c }), h('span', null, WALL_PRICE + ' monet')])));
      } else if (deco.tab === 'grow') {
        for (let s = 2; s <= 4; s++) {
          const ex = EXPAND[s], have = home.size >= s, canPlan = !ex.plan || (p.world && (p.world.plans || []).includes(ex.plan));
          bar.appendChild(h('button.decoitem.grow' + (have ? '.sel' : ''), { onclick: () => grow(s) }, [
            h('b', null, ex.name),
            h('span', null, have ? '✓ Masz' : home.size < s - 1 ? 'Najpierw poprzednia' : !canPlan ? '🔒 Potrzebny plan z wyprawy' : ex.price + ' monet'),
          ]));
        }
      }
    }
    function itemCard(id, sub, onclick, sel, dim) {
      const f = FURN_BY[id];
      const c = document.createElement('canvas'); c.width = 120; c.height = 96;
      const g = c.getContext('2d'); const s = Math.min(1, 1.9 / Math.max(f.w, f.h)) * 0.8; g.scale(s * 1.2, s * 1.2);
      const pw = f.w * T; drawFurniture(g, id, (100 / s - pw) / 2, 78 / s, pw, 0.5, false, G.prof);
      return h('button.decoitem' + (sel ? '.sel' : '') + (dim ? '.dim' : ''), { onclick }, [c, h('span', null, f.name), h('span.sub', null, typeof sub === 'number' ? [h('span.coin-ico'), ' ' + sub] : sub)]);
    }
    function wallSwatch(style, color) {
      const c = document.createElement('canvas'); c.width = 96; c.height = 72;
      const g = c.getContext('2d'); g.scale(0.5, 0.5); drawWallpaper(g, 0, 0, 192, 160, { style, color }, 0); return c;
    }
    function payWall() {
      const p = G.prof; if (p.coins < WALL_PRICE) { LZ.UI._alert('Za mało monet', 'Nowa tapeta kosztuje ' + WALL_PRICE + ' monet.'); return false; }
      p.coins -= WALL_PRICE; A.play('buy'); return true;
    }
    function buy(f) {
      const p = G.prof, home = homeOf(p);
      if (p.coins < f.price) { LZ.UI._alert('Za mało monet', f.name + ' kosztuje ' + f.price + ' monet. Masz ' + p.coins + '.'); return; }
      LZ.UI._confirm(f.name, 'Kupić za ' + f.price + ' monet? Zostanie ci ' + (p.coins - f.price) + '.', () => {
        p.coins -= f.price; home.inv[f.id] = (home.inv[f.id] || 0) + 1; p.stats.purchases++; S.save(); A.play('buy');
        deco.tab = 'mine'; deco.pick = { id: f.id }; render();
      });
    }
    function grow(s) {
      const p = G.prof, home = homeOf(p), ex = EXPAND[s];
      if (home.size >= s) return;
      if (home.size < s - 1) { LZ.UI._alert('Po kolei!', 'Najpierw rozbuduj domek do „' + EXPAND[s - 1].name + '”.'); return; }
      if (ex.plan && !(p.world && (p.world.plans || []).includes(ex.plan))) { LZ.UI._alert('Potrzebny plan', 'Plan tej rozbudowy leży gdzieś w skrzyni skarbów na wyprawie. Szukaj daleko od domu!'); return; }
      if (p.coins < ex.price) { LZ.UI._alert('Za mało monet', ex.name + ' kosztuje ' + ex.price + ' monet.'); return; }
      LZ.UI._confirm(ex.name, 'Rozbudować domek za ' + ex.price + ' monet?', () => {
        p.coins -= ex.price; home.size = s; S.save(); A.play('win');
        closeDeco(); LZ.Game.quit(); LZ.UI.play(0, 0, { kind: 'home' });
        setTimeout(() => { const g2 = G_(); if (g2) g2.toasts.push({ text: 'Większy domek!', life: 2, max: 2 }); }, 300);
      });
    }
    deco.render = render;
    render();
  }
  // world position of a screen tap
  function screenToWorld(cx, cy) {
    const G = G_(), v = LZ.Game.view, r = document.getElementById('game').getBoundingClientRect();
    return { x: (cx - r.left) / v.scale + G.cam.x, y: (cy - r.top) / v.scale + G.cam.y };
  }
  function tapRoom(cx, cy) {
    const G = G_(); if (!G || !deco) return;
    const home = homeOf(G.prof), wp = screenToWorld(cx, cy);
    if (deco.pick) {
      const f = FURN_BY[deco.pick.id];
      const pos = placeAt(G, f, wp.x, wp.y);
      if (!pos) { A.play('bump'); return; }
      home.items.push({ id: f.id, x: pos.x, y: pos.y });
      home.inv[f.id]--; if (home.inv[f.id] <= 0) delete home.inv[f.id];
      deco.pick = home.inv[f.id] ? deco.pick : null;
      A.play('coin'); S.save(); spawnFurniture(G); deco.render();
      return;
    }
    // tap a placed item: pick it up (back to "Moje rzeczy") so it can be placed elsewhere
    const hit = G.ents.filter(e => e.k === 'furn').reverse().find(e => wp.x > e.x && wp.x < e.x + e.w && wp.y < e.y + 6 && wp.y > e.y - e.h - 6);
    if (hit) {
      const it = home.items[hit.idx];
      home.items.splice(hit.idx, 1);
      home.inv[it.id] = (home.inv[it.id] || 0) + 1;
      deco.tab = 'mine'; deco.pick = { id: it.id };
      A.play('click'); S.save(); spawnFurniture(G); deco.render();
    }
  }
  /* Where a piece lands: floor things drop to the floor (or upstairs floor)
     under the tap, wall things hang at the tapped height. Always inside the room. */
  function placeAt(G, f, wx, wy) {
    const W = G.W;
    let x = Math.round((wx / T - f.w / 2) * 2) / 2;
    x = Math.max(1, Math.min(W - 1 - f.w, x));
    if (f.wall) {
      let y = Math.round(wy / T + f.h / 2);
      y = Math.max(CEIL + Math.ceil(f.h), Math.min(FLOOR - 1, y));
      return { x, y };
    }
    // floor: the first solid or plank row below the tap
    let ty = Math.max(CEIL, Math.floor(wy / T));
    const col = Math.floor(x + f.w / 2);
    while (ty < FLOOR && G.grid[col][ty] !== '-' && G.grid[col][ty] !== '#' && G.grid[col][ty] !== '=') ty++;
    return { x, y: ty };
  }
  function closeDeco(silent) {
    if (deco && deco.layer) deco.layer.remove();
    document.body.classList.remove('decorating');
    deco = null;
    const G = G_(); if (G && !silent) { G.decorating = false; LZ.In.reset(); }
  }

  LZ.Home = { FURN, FURN_BY, hooks, buildLevel, homeOf, defaultHome, drawFurniture, openDeco, closeDeco, SIZES, EXPAND, HOME_WORLD, autoPlace, spawnFurniture, FLOOR, CEIL, UP, _placeAt: placeAt, _tap: tapRoom };
})();
