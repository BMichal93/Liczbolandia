/*
 * fun.js - shared pieces for the house and open-world activities
 * (pet, garden, baking, fishing, traders, treasure maps...).
 *
 *   LZ.Ext  - a list of add-on modules. home.js and world.js call every
 *             add-on from their engine hooks, so each activity lives in its
 *             own file instead of growing those two files forever.
 *   LZ.Bag  - the backpack: seeds, fruit, fish, eggs, cakes... with a picture
 *             for every thing.
 *   LZ.Fun  - save data, story questions dressed up for each activity, and
 *             small helpers (stand-to-use, modals).
 *
 * Save data lives in profile.fun (see state()), so old saves just get the
 * defaults the first time.
 */
(function () {
  const U = LZ.U, S = LZ.S, A = LZ.A, M = LZ.M;
  const P = U.plural;

  /* ================= add-on registry ================= */
  const list = [];
  const Ext = {
    list,
    add(x) { list.push(x); },
    // call a hook on every add-on (for ticks and drawing)
    each(kind, name, ...args) { for (const x of list) { const h = x[kind]; if (h && h[name]) h[name](...args); } },
    // first add-on that handles it wins (for entities: building, updating, drawing)
    first(kind, name, ...args) { for (const x of list) { const h = x[kind]; if (h && h[name] && h[name](...args)) return true; } return false; },
  };

  /* ================= save data ================= */
  function state(p) {
    const f = p.fun || (p.fun = {});
    f.bag = f.bag || {};
    f.book = f.book || {};
    ['seen', 'fish', 'crops', 'cakes', 'places'].forEach(k => { f.book[k] = f.book[k] || {}; });
    f.book.claimed = f.book.claimed || 0;
    f.garden = f.garden || { plots: [], started: false };
    f.daily = f.daily || {};          // things that happen once a day: { key: dateKey }
    f.traders = f.traders || {};      // coins each trader paid today
    f.gifts = f.gifts || {};
    if (f.time == null) f.time = 0.15;   // time of day in the open world, 0..1 (starts in the morning)
    return f;
  }
  const today = () => LZ.X.dateKey();
  // once-a-day things: returns true the first time today and remembers it
  function onceToday(p, key) { const f = state(p); if (f.daily[key] === today()) return false; f.daily[key] = today(); return true; }
  const doneToday = (p, key) => state(p).daily[key] === today();

  /* ================= the backpack ================= */
  // name forms: 1 / 2-4 / 5+ ; sell = coins a trader pays ; cat groups the list
  const FISH = [
    { id: 'fish_1', name: 'Płotka', few: 'Płotki', many: 'Płotek', c: '#9fb8d0', f: '#ff8a5c', r: 1, sell: 2 },
    { id: 'fish_2', name: 'Złota rybka', few: 'Złote rybki', many: 'Złotych rybek', c: '#ffb347', f: '#ff8a3d', r: 2, sell: 5 },
    { id: 'fish_3', name: 'Błazenek', few: 'Błazenki', many: 'Błazenków', c: '#ff8a3d', f: '#fff', stripes: '#fff', r: 2, sell: 4 },
    { id: 'fish_4', name: 'Niebieska rybka', few: 'Niebieskie rybki', many: 'Niebieskich rybek', c: '#5ccfff', f: '#2a7fb0', r: 1, sell: 2 },
    { id: 'fish_5', name: 'Rozdymka', few: 'Rozdymki', many: 'Rozdymek', c: '#ffe066', f: '#c9a012', round: true, r: 3, sell: 6 },
    { id: 'fish_6', name: 'Pstrąg tęczowy', few: 'Pstrągi tęczowe', many: 'Pstrągów tęczowych', c: '#b8d9a8', f: '#ff85c8', stripes: '#ff85c8', r: 2, sell: 4 },
    { id: 'fish_7', name: 'Różowa rybka', few: 'Różowe rybki', many: 'Różowych rybek', c: '#ff9ecf', f: '#d9458a', r: 1, sell: 2 },
    { id: 'fish_8', name: 'Konik morski', few: 'Koniki morskie', many: 'Koników morskich', c: '#ffcf70', f: '#e0a000', horse: true, r: 3, sell: 7 },
    { id: 'fish_9', name: 'Świecąca rybka', few: 'Świecące rybki', many: 'Świecących rybek', c: '#c9f5ff', f: '#5ccfff', glow: true, night: true, r: 3, sell: 7 },
    { id: 'fish_10', name: 'Księżycowa ryba', few: 'Księżycowe ryby', many: 'Księżycowych ryb', c: '#e8dcff', f: '#9d7bff', night: true, r: 4, sell: 9 },
    { id: 'fish_11', name: 'Deszczowy sum', few: 'Deszczowe sumy', many: 'Deszczowych sumów', c: '#8a9ab0', f: '#5a6388', whisk: true, rain: true, r: 3, sell: 8 },
    { id: 'fish_12', name: 'Złoty karp', few: 'Złote karpie', many: 'Złotych karpi', c: '#ffd23f', f: '#b8861c', crown: true, r: 5, sell: 15 },
  ];
  const ITEMS = {
    seed_carrot: { name: 'Nasiona marchewki', few: 'Nasiona marchewki', many: 'Nasion marchewki', cat: 'seed', sell: 1 },
    seed_straw: { name: 'Nasiona truskawki', few: 'Nasiona truskawki', many: 'Nasion truskawki', cat: 'seed', sell: 1 },
    seed_wheat: { name: 'Ziarno pszenicy', few: 'Ziarna pszenicy', many: 'Ziaren pszenicy', cat: 'seed', sell: 1 },
    seed_blue: { name: 'Nasiona borówki', few: 'Nasiona borówki', many: 'Nasion borówki', cat: 'seed', sell: 1 },
    seed_pumpkin: { name: 'Pestka dyni', few: 'Pestki dyni', many: 'Pestek dyni', cat: 'seed', sell: 1 },
    carrot: { name: 'Marchewka', few: 'Marchewki', many: 'Marchewek', cat: 'crop', sell: 2 },
    straw: { name: 'Truskawka', few: 'Truskawki', many: 'Truskawek', cat: 'crop', sell: 2 },
    wheat: { name: 'Kłos pszenicy', few: 'Kłosy pszenicy', many: 'Kłosów pszenicy', cat: 'crop', sell: 2 },
    blue: { name: 'Borówka', few: 'Borówki', many: 'Borówek', cat: 'crop', sell: 3 },
    pumpkin: { name: 'Dynia', few: 'Dynie', many: 'Dyń', cat: 'crop', sell: 5 },
    egg: { name: 'Jajko', few: 'Jajka', many: 'Jajek', cat: 'food', sell: 1 },
    milk: { name: 'Mleko', few: 'Butelki mleka', many: 'Butelek mleka', cat: 'food', sell: 1 },
    cake_carrot: { name: 'Ciasto marchewkowe', few: 'Ciasta marchewkowe', many: 'Ciast marchewkowych', cat: 'cake', sell: 10 },
    cake_straw: { name: 'Tarta truskawkowa', few: 'Tarty truskawkowe', many: 'Tart truskawkowych', cat: 'cake', sell: 10 },
    muffin: { name: 'Babeczka borówkowa', few: 'Babeczki borówkowe', many: 'Babeczek borówkowych', cat: 'cake', sell: 12 },
    pie_pumpkin: { name: 'Placek dyniowy', few: 'Placki dyniowe', many: 'Placków dyniowych', cat: 'cake', sell: 14 },
    bread: { name: 'Koszyk bułeczek', few: 'Koszyki bułeczek', many: 'Koszyków bułeczek', cat: 'cake', sell: 8 },
    cake_rainbow: { name: 'Tort tęczowy', few: 'Torty tęczowe', many: 'Tortów tęczowych', cat: 'cake', sell: 25 },
    // materials for the smithy and the tailor (gear.js, nature.js)
    iron: { name: 'Bryłka żelaza', few: 'Bryłki żelaza', many: 'Bryłek żelaza', cat: 'mat', sell: 2 },
    gem: { name: 'Kryształ', few: 'Kryształy', many: 'Kryształów', cat: 'mat', sell: 4 },
    gold: { name: 'Złota bryłka', few: 'Złote bryłki', many: 'Złotych bryłek', cat: 'mat', sell: 6 },
    feather: { name: 'Piórko', few: 'Piórka', many: 'Piórek', cat: 'mat', sell: 2 },
    star: { name: 'Gwiezdny odłamek', few: 'Gwiezdne odłamki', many: 'Gwiezdnych odłamków', cat: 'mat', sell: 5 },
    firefly: { name: 'Świetlik w słoiku', few: 'Świetliki w słoikach', many: 'Świetlików w słoikach', cat: 'mat', sell: 0 },
    stone: { name: 'Kamień', few: 'Kamienie', many: 'Kamieni', cat: 'mat', sell: 0 },
    candy: { name: 'Cukierek', few: 'Cukierki', many: 'Cukierków', cat: 'misc', sell: 0 },
    bait: { name: 'Robaczek', few: 'Robaczki', many: 'Robaczków', cat: 'misc', sell: 0 },
    treat: { name: 'Smakołyk dla pupila', few: 'Smakołyki dla pupila', many: 'Smakołyków dla pupila', cat: 'misc', sell: 0 },
    map: { name: 'Mapa skarbów', few: 'Mapy skarbów', many: 'Map skarbów', cat: 'misc', sell: 0 },
  };
  FISH.forEach(f => { ITEMS[f.id] = { name: f.name, few: f.few, many: f.many, cat: 'fish', sell: f.sell, fish: f }; });
  const CATS = [['mat', 'Materiały'], ['cake', 'Wypieki'], ['crop', 'Z ogródka'], ['seed', 'Nasiona'], ['food', 'Do pieczenia'], ['fish', 'Ryby'], ['misc', 'Różne']];
  const itemName = (id, n) => { const it = ITEMS[id]; return n == null ? it.name : n + ' ' + P(n, it.name, it.few, it.many).toLowerCase(); };

  const Bag = {
    ITEMS, FISH, CATS,
    count: (p, id) => state(p).bag[id] || 0,
    add(p, id, n) { const b = state(p).bag; b[id] = (b[id] || 0) + (n == null ? 1 : n); if (b[id] <= 0) delete b[id]; },
    take(p, id, n) { n = n == null ? 1 : n; const b = state(p).bag; if ((b[id] || 0) < n) return false; b[id] -= n; if (b[id] <= 0) delete b[id]; return true; },
    name: itemName,
    draw: drawItem,
    icon(id, size) {
      const c = document.createElement('canvas'); c.width = c.height = size * 2; c.style.width = c.style.height = size + 'px'; c.className = 'bagico';
      const g = c.getContext('2d'); g.scale(size / 18, size / 18); drawItem(g, id, 18, 18, 0.5); return c;
    },
  };

  /*
   * Every backpack thing drawn around (x, y), about 30 px across.
   */
  function drawItem(g, id, x, y, t) {
    const Art = LZ.Art, ell = Art.ell, fs = Art.fs, rr = U.rr;
    g.save(); g.translate(x, y);
    const it = ITEMS[id];
    if (it && it.cat === 'seed') {
      // a paper seed packet with the plant's picture on it
      rr(g, -11, -14, 22, 28, 4); fs(g, '#f3e1c2', '#a8845a', 1.5);
      g.save(); g.translate(0, -1); g.scale(0.55, 0.55); drawItemInner(g, id.slice(5)); g.restore();
      g.fillStyle = '#a8845a'; g.fillRect(-11, 8, 22, 2);
      g.restore(); return;
    }
    if (it && it.fish) { drawFish(g, it.fish, 0, 0, 1, t); g.restore(); return; }
    drawItemInner(g, id, t);
    g.restore();

    function drawItemInner(g, id) {
      switch (id) {
        case 'carrot':
          g.beginPath(); g.moveTo(-6, -6); g.quadraticCurveTo(0, 18, 2, 16); g.quadraticCurveTo(8, -2, 6, -6); g.closePath(); fs(g, '#ff8a3d', '#c4621c', 1.5);
          g.strokeStyle = 'rgba(160,70,20,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-3, 0); g.lineTo(1, 0); g.moveTo(-1, 6); g.lineTo(3, 6); g.stroke();
          for (const a of [-0.5, 0, 0.5]) { g.save(); g.translate(0, -7); g.rotate(a); ell(g, 0, -6, 2.5, 7); fs(g, '#5cc15a', '#2f7a2a', 1); g.restore(); }
          break;
        case 'straw':
          g.beginPath(); g.moveTo(0, 13); g.quadraticCurveTo(-13, 0, -8, -6); g.quadraticCurveTo(0, -10, 8, -6); g.quadraticCurveTo(13, 0, 0, 13); fs(g, '#ff5e7e', '#a3223f', 1.5);
          g.fillStyle = '#ffe680'; for (const [a, b] of [[-4, -1], [3, -2], [0, 4], [-2, 8], [4, 5]]) { ell(g, a, b, 1, 1.4); g.fill(); }
          for (const a of [-0.9, -0.3, 0.3, 0.9]) { g.save(); g.translate(0, -8); g.rotate(a); ell(g, 0, -3, 2.2, 4.5); fs(g, '#5cc15a', '#2f7a2a', 1); g.restore(); }
          break;
        case 'wheat':
          g.strokeStyle = '#c9a012'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 15); g.lineTo(0, -12); g.stroke();
          for (let i = 0; i < 5; i++) { ell(g, -3.5, -10 + i * 4.5, 3, 4.5, -0.5); fs(g, '#ffd23f', '#c9a012', 1); ell(g, 3.5, -10 + i * 4.5, 3, 4.5, 0.5); fs(g, '#ffd23f', '#c9a012', 1); }
          break;
        case 'blue':
          for (const [a, b] of [[-5, 3], [5, 3], [0, -5]]) { ell(g, a, b, 7, 7); fs(g, '#5a6ad8', '#2a3488', 1.5); g.fillStyle = '#2a3488'; g.beginPath(); g.arc(a, b - 4, 2, 0, 7); g.fill(); ell(g, a - 2, b - 1, 2, 1.5); fs(g, 'rgba(255,255,255,0.6)'); }
          ell(g, 4, -12, 5, 2.5, -0.5); fs(g, '#5cc15a', '#2f7a2a', 1);
          break;
        case 'pumpkin':
          for (const [a, w] of [[-7, 7], [7, 7], [0, 8]]) { ell(g, a, 3, w, 11); fs(g, '#ff9a3d', '#c4621c', 1.5); }
          rr(g, -2, -12, 4, 7, 2); fs(g, '#6b8a3a');
          break;
        case 'egg': ell(g, 0, 1, 9, 12); fs(g, '#fff6e8', '#c9a88a', 1.5); ell(g, -3, -4, 2.5, 3.5); fs(g, 'rgba(255,255,255,0.9)'); break;
        case 'milk':
          rr(g, -7, -8, 14, 22, 4); fs(g, '#ffffff', '#8aa0c0', 1.5); rr(g, -4, -14, 8, 7, 2); fs(g, '#5ccfff', '#2a7fb0', 1.2);
          g.fillStyle = '#5ccfff'; g.fillRect(-7, 0, 14, 5);
          break;
        case 'cake_carrot': case 'cake_straw': case 'pie_pumpkin': case 'cake_rainbow': {
          const top = { cake_carrot: '#fff6e8', cake_straw: '#ff85b0', pie_pumpkin: '#ffb347', cake_rainbow: '#fff' }[id];
          const body = { cake_carrot: '#e0a86a', cake_straw: '#ffe0cc', pie_pumpkin: '#d98a4a', cake_rainbow: '#ff9ecf' }[id];
          ell(g, 0, 11, 15, 4); fs(g, '#e8e8f0', '#9aa3b5', 1);
          rr(g, -12, -4, 24, 14, 4); fs(g, body, U.shade(body, -0.3), 1.5);
          if (id === 'cake_rainbow') ['#ff5e7e', '#ffd23f', '#7be08a', '#5ccfff'].forEach((c, i) => { g.fillStyle = c; g.fillRect(-12, -2 + i * 3, 24, 3); });
          ell(g, 0, -4, 12, 4); fs(g, top, U.shade(top, -0.2), 1.2);
          if (id === 'cake_carrot') { g.save(); g.translate(0, -8); g.scale(0.4, 0.4); drawItemInner(g, 'carrot'); g.restore(); }
          else if (id === 'cake_straw') { g.save(); g.translate(0, -8); g.scale(0.45, 0.45); drawItemInner(g, 'straw'); g.restore(); }
          else if (id === 'cake_rainbow') { ell(g, 0, -9, 2, 5); fs(g, '#fff6c9', '#c9a012', 1); ell(g, 0, -15, 2, 3); fs(g, '#ffd23f'); }
          else { g.strokeStyle = 'rgba(140,70,20,0.6)'; g.lineWidth = 1; for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(i * 5, -7); g.lineTo(i * 5, -1); g.stroke(); } }
          break;
        }
        case 'muffin':
          for (const a of [-7, 7]) {
            g.beginPath(); g.moveTo(a - 7, 0); g.lineTo(a - 5, 12); g.lineTo(a + 5, 12); g.lineTo(a + 7, 0); g.closePath(); fs(g, '#9d7bff', '#6a4fcf', 1.2);
            ell(g, a, -1, 8, 7); fs(g, '#e8c9a0', '#a8845a', 1.2);
            for (const [b, c] of [[-3, -3], [3, -2], [0, 1]]) { ell(g, a + b, c, 1.8, 1.8); fs(g, '#3a4ab8'); }
          }
          break;
        case 'bread':
          for (const [a, b] of [[-6, 3], [6, 3], [0, -4]]) { ell(g, a, b, 8, 6.5); fs(g, '#e0a45a', '#a86c30', 1.2); ell(g, a - 2, b - 2, 3, 1.5); fs(g, 'rgba(255,240,200,0.6)'); }
          break;
        case 'iron':
          g.beginPath(); g.moveTo(-11, 6); g.lineTo(-8, -6); g.lineTo(2, -10); g.lineTo(11, -3); g.lineTo(9, 8); g.lineTo(-2, 11); g.closePath(); fs(g, '#9aa3b5', '#4a5268', 1.5);
          for (const [a, b] of [[-4, -2], [4, 1], [0, 6]]) { ell(g, a, b, 2.4, 2); fs(g, '#d98a4a'); }
          ell(g, -3, -6, 3, 1.5, -0.4); fs(g, 'rgba(255,255,255,0.5)');
          break;
        case 'gem':
          g.beginPath(); g.moveTo(0, -13); g.lineTo(8, -4); g.lineTo(5, 11); g.lineTo(-5, 11); g.lineTo(-8, -4); g.closePath(); fs(g, '#8fe6ff', '#2a8fb8', 1.5);
          g.beginPath(); g.moveTo(0, -13); g.lineTo(2, 11); g.moveTo(-8, -4); g.lineTo(8, -4); g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1.2; g.stroke();
          ell(g, -3, -5, 2, 3, -0.4); fs(g, 'rgba(255,255,255,0.8)');
          break;
        case 'gold':
          g.beginPath(); g.moveTo(-10, 5); g.quadraticCurveTo(-11, -6, -2, -8); g.quadraticCurveTo(9, -10, 10, 0); g.quadraticCurveTo(10, 9, 0, 9); g.quadraticCurveTo(-8, 10, -10, 5); fs(g, '#ffd23f', '#b8861c', 1.5);
          ell(g, -3, -3, 3, 2, -0.4); fs(g, '#fff6c9'); ell(g, 4, 3, 1.5, 1.5); fs(g, '#fff6c9');
          break;
        case 'feather':
          g.save(); g.rotate(-0.6);
          g.beginPath(); g.moveTo(0, -14); g.quadraticCurveTo(9, -4, 2, 12); g.lineTo(-2, 12); g.quadraticCurveTo(-9, -4, 0, -14); fs(g, '#9fd8ff', '#3a8ac0', 1.3);
          g.strokeStyle = '#3a8ac0'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(0, -12); g.lineTo(0, 15); g.stroke();
          g.restore();
          break;
        case 'star': {
          const gr = g.createRadialGradient(0, 0, 2, 0, 0, 16); gr.addColorStop(0, 'rgba(255,240,160,0.8)'); gr.addColorStop(1, 'rgba(255,240,160,0)'); g.fillStyle = gr; g.fillRect(-16, -16, 32, 32);
          LZ.Art.starPath(g, 0, 0, 11, 5, 5, 0.2); fs(g, '#fff6c9', '#e0a000', 1.5);
          break;
        }
        case 'firefly':
          rr(g, -8, -9, 16, 20, 5); fs(g, 'rgba(220,245,255,0.55)', '#8aa0c0', 1.5); rr(g, -7, -13, 14, 5, 2); fs(g, '#c98a5a', '#6b4424', 1);
          { const gr = g.createRadialGradient(0, 2, 1, 0, 2, 9); gr.addColorStop(0, 'rgba(255,250,150,1)'); gr.addColorStop(1, 'rgba(255,250,150,0)'); g.fillStyle = gr; g.fillRect(-9, -7, 18, 18); }
          ell(g, 0, 2, 2.2, 2.2); fs(g, '#fffbd0');
          break;
        case 'stone':
          g.beginPath(); g.moveTo(-11, 8); g.lineTo(-9, -5); g.lineTo(0, -10); g.lineTo(10, -5); g.lineTo(11, 7); g.closePath(); fs(g, '#a8a0b8', '#5a5270', 1.5);
          g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.moveTo(-7, -3); g.lineTo(0, -7); g.lineTo(2, -3); g.closePath(); g.fill();
          break;
        case 'candy':
          g.save(); g.rotate(-0.3);
          g.beginPath(); g.moveTo(-8, 0); g.lineTo(-15, -6); g.lineTo(-15, 6); g.closePath(); fs(g, '#ff85c8', '#b8467a', 1);
          g.beginPath(); g.moveTo(8, 0); g.lineTo(15, -6); g.lineTo(15, 6); g.closePath(); fs(g, '#ff85c8', '#b8467a', 1);
          ell(g, 0, 0, 9, 7); fs(g, '#ff8a3d', '#b8561c', 1.5); g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(-4, -6); g.lineTo(3, 6); g.stroke();
          g.restore();
          break;
        case 'bait':
          g.strokeStyle = '#ff85b0'; g.lineWidth = 5; g.lineCap = 'round';
          g.beginPath(); g.moveTo(-10, 4); g.quadraticCurveTo(-5, -8, 0, 2); g.quadraticCurveTo(5, 10, 10, -2); g.stroke();
          ell(g, 10, -3, 2, 2); fs(g, '#222');
          break;
        case 'treat':
          // a little bone
          for (const [a, b] of [[-9, -4], [-9, 4], [9, -4], [9, 4]]) { ell(g, a, b, 4.5, 4.5); fs(g, '#f3e1c2', '#a8845a', 1.5); }
          rr(g, -10, -3.5, 20, 7, 3); fs(g, '#f3e1c2');
          g.strokeStyle = '#a8845a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-6, -3.5); g.lineTo(6, -3.5); g.moveTo(-6, 3.5); g.lineTo(6, 3.5); g.stroke();
          break;
        case 'map':
          rr(g, -13, -10, 26, 20, 3); fs(g, '#fff1c7', '#b8834a', 1.5);
          g.strokeStyle = '#c4621c'; g.setLineDash([2, 2]); g.lineWidth = 1.5; g.beginPath(); g.moveTo(-9, 5); g.quadraticCurveTo(-2, -8, 6, 1); g.stroke(); g.setLineDash([]);
          g.strokeStyle = '#ff3a5e'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(4, -2); g.lineTo(9, 3); g.moveTo(9, -2); g.lineTo(4, 3); g.stroke();
          break;
        default: ell(g, 0, 0, 10, 10); fs(g, '#e8dcff', '#9d7bff', 1.5);
      }
    }
  }
  // a fish from the album; s = size factor, faces right
  function drawFish(g, f, x, y, s, t) {
    const Art = LZ.Art, ell = Art.ell, fs = Art.fs;
    g.save(); g.translate(x, y); g.scale(s, s);
    if (f.glow) { const gr = g.createRadialGradient(0, 0, 2, 0, 0, 22); gr.addColorStop(0, 'rgba(160,240,255,0.7)'); gr.addColorStop(1, 'rgba(160,240,255,0)'); g.fillStyle = gr; g.fillRect(-22, -22, 44, 44); }
    if (f.horse) {
      g.beginPath(); g.moveTo(2, -12); g.quadraticCurveTo(12, -12, 8, -4); g.quadraticCurveTo(12, 6, 2, 10); g.quadraticCurveTo(-6, 14, -2, 6); g.quadraticCurveTo(-8, 2, -2, -4); g.quadraticCurveTo(-4, -10, 2, -12); fs(g, f.c, f.f, 1.5);
      ell(g, 3, -8, 1.5, 1.5); fs(g, '#222'); g.restore(); return;
    }
    const wig = Math.sin((t || 0) * 8) * 0.25;
    g.save(); g.translate(-9, 0); g.rotate(wig); Art.tri(g, 0, 0, -8, -7, -8, 7); fs(g, f.f, U.shade(f.f, -0.3), 1); g.restore();
    if (f.round) { ell(g, 1, 0, 11, 10); fs(g, f.c, U.shade(f.c, -0.35), 1.5); g.fillStyle = U.shade(f.c, -0.3); for (let i = 0; i < 5; i++) { const a = i * 1.2; g.fillRect(1 + Math.cos(a) * 9, Math.sin(a) * 8, 2, 2); } }
    else { ell(g, 1, 0, 12, 7); fs(g, f.c, U.shade(f.c, -0.35), 1.5); }
    if (f.stripes) { g.fillStyle = f.stripes; g.fillRect(-3, -6, 3, 12); g.fillRect(4, -6, 2.5, 12); }
    ell(g, 1, -8, 5, 2.5, 0.2); fs(g, f.f);
    ell(g, 7, -1.5, 2, 2); fs(g, '#fff'); ell(g, 7.5, -1.5, 1.1, 1.1); fs(g, '#222');
    if (f.whisk) { g.strokeStyle = '#3a3a4a'; g.lineWidth = 1; g.beginPath(); g.moveTo(12, 2); g.quadraticCurveTo(16, 4, 17, 8); g.moveTo(12, 1); g.quadraticCurveTo(17, 1, 19, 4); g.stroke(); }
    if (f.crown) { g.beginPath(); g.moveTo(-3, -7); g.lineTo(-3, -12); g.lineTo(0, -9); g.lineTo(3, -13); g.lineTo(6, -9); g.lineTo(8, -12); g.lineTo(8, -7); g.closePath(); fs(g, '#ffd23f', '#b8861c', 1); }
    g.restore();
  }
  Bag.drawFish = drawFish;

  /* ================= story questions ================= */
  /*
   * Maths questions dressed up for the activity at hand (the kitten's
   * crunchies, strawberries from the garden, eggs for a cake). The level
   * follows the child's own skill band, the same way the level gates do:
   *   1  + and - within 10 (with dot pictures)
   *   2  + and - within 20
   *   3  + and - within 100
   *   4  × and : with the 2, 3, 4, 5 and 10 tables
   *   5  the full table
   * thing = [one, few, many] ; who = a name to put in the story
   */
  function tierOf(p) {
    const b = S.mathBand(p);
    const s = U.clamp(p.skill + (Math.random() * 0.9 - 0.5), b.min, b.max);
    return U.clamp(Math.floor(s), 1, 5);
  }
  const R = Math.random, ri = (a, b) => U.ri(R, a, b);
  const nf = (n, th) => n + ' ' + P(n, th[0], th[1], th[2]);
  function mk(q, a, topic, opts) {
    opts = opts || {};
    return { q, a: String(a), choices: M.numChoices(a, opts.extra), topic, visual: opts.visual || null };
  }
  function story(p, thing, o) {
    o = o || {};
    const tier = o.tier || tierOf(p);
    const W = o.who || 'Ty', gone = o.gone || 'zabrano';
    if (tier <= 2) {
      const max = tier === 1 ? 10 : 20;
      if (R() < 0.5) {
        const a = ri(tier === 1 ? 1 : 4, max - 2), b = ri(1, max - a);
        return mk((o.who ? W + ' ma ' + nf(a, thing) + ' i dostaje jeszcze ' : 'Masz ' + nf(a, thing) + ' i dostajesz jeszcze ') + b + '. Ile jest razem?', a + b, 'add', { visual: tier === 1 ? { type: 'dots', a, b, op: '+' } : null, extra: [a + b + 1] });
      }
      const a = ri(tier === 1 ? 3 : 11, max), b = ri(1, a - 1);
      return mk(P(a, 'Było', 'Były', 'Było') + ' ' + nf(a, thing) + '. ' + b + ' ' + gone + '. Ile zostało?', a - b, 'sub', { visual: tier === 1 ? { type: 'dots', a, b, op: '-' } : null, extra: [a + b] });
    }
    if (tier === 3) {
      if (R() < 0.5) { const a = ri(12, 70), b = ri(5, 99 - a); return mk((o.place || 'W koszyku') + ' ' + P(a, 'jest', 'są', 'jest') + ' ' + nf(a, thing) + '. Dokładasz ' + b + '. Ile jest teraz?', a + b, 'add', { extra: [a + b + 10, a + b - 10] }); }
      const a = ri(30, 99), b = ri(6, a - 8); return mk(P(a, 'Było', 'Były', 'Było') + ' ' + nf(a, thing) + '. ' + b + ' ' + gone + '. Ile zostało?', a - b, 'sub', { extra: [a - b + 10, a - b - 10] });
    }
    const tables = tier === 4 ? [2, 3, 4, 5, 10] : [2, 3, 4, 5, 6, 7, 8, 9];
    const k = U.pick(R, tables), n = ri(2, tier === 4 ? 6 : 9);
    const bowls = ['miseczka', 'miseczki', 'miseczek'];
    if (R() < 0.6) return mk(nf(n, bowls) + ', w każdej ' + nf(k, thing) + '. Ile to razem?', n * k, 'mul', { extra: [n + k, n * k + k] });
    return mk(nf(n * k, thing) + ' dzielimy równo na ' + nf(n, bowls) + '. Ile w każdej?', k, 'div', { extra: [k + 1, n] });
  }

  /*
   * Show a question inside a modal box: the story, a dot picture on the
   * easy level, and the answer buttons. A wrong answer gets a gentle word
   * and a fresh question; ok() runs after the right answer.
   */
  function ask(box, p, gen, ok, opts) {
    opts = opts || {};
    const h = LZ.UI._h;
    let pr = gen(), wrongs = 0;
    function show(msg) {
      box.innerHTML = '';
      box.dataset.a = pr.a;   // lets the automated tests answer
      if (opts.title) box.appendChild(h('p.funstep', null, opts.title));
      if (msg) box.appendChild(h('p.wrongmsg', null, msg));
      box.appendChild(h('p.chestq', null, pr.q));
      if (pr.visual) { const c = document.createElement('canvas'); c.width = 520; c.height = 90; c.className = 'chestvis'; LZ.Game._drawVisual(c.getContext('2d'), pr.visual, 260, 45); box.appendChild(c); }
      box.appendChild(h('div.row.answers', null, pr.choices.map(ch => h('button.btn.mid.ans', { onclick: () => answer(ch) }, ch))));
      if (opts.cancel) box.appendChild(h('button.btn.small.ghost', { onclick: opts.cancel }, opts.cancelText || 'Później'));
      LZ.Speech.say(pr.q);
    }
    function answer(ch) {
      const good = String(ch) === String(pr.a);
      S.recordAnswer(p, pr.topic, good);
      if (!good) { wrongs++; A.play('wrong'); pr = opts.same ? pr : gen(); box.querySelectorAll('.ans').forEach(b => { b.disabled = true; }); setTimeout(() => show('Prawie! Spróbuj jeszcze raz:'), 650); return; }
      A.play('correct');
      ok(wrongs === 0);
    }
    show();
  }

  /* ================= small helpers ================= */
  // a modal that pauses the game (every open modal does) and cleans the input when closed
  function open(content, onclose) {
    LZ.In.reset();
    const m = LZ.UI._modal(content, { dismiss: false, onclose: () => { LZ.In.reset(); if (onclose) onclose(); } });
    return m;
  }
  /*
   * "Stand here to use it": true once when she has stood still next to the
   * thing for `t` seconds; then not again until she walks away.
   */
  function stand(G, e, dt, o) {
    o = o || {};
    const p = G.player, px = p.x + 14, py = p.y + 40;
    const cx = o.cx != null ? o.cx : e.x, cy = o.cy != null ? o.cy : e.y;
    const near = Math.abs(px - cx) < (o.dx || 28) && Math.abs(py - cy) < (o.dy || 30);
    if (!near) { e._st = 0; e._cool = false; return false; }
    if (e._cool || !p.grounded || Math.abs(p.vx) > 40 || G.state !== 'play') { e._st = 0; return false; }
    e._st = (e._st || 0) + dt;
    if (e._st >= (o.t || 0.6)) { e._st = 0; e._cool = true; return true; }
    return false;
  }
  // the little filling circle over a thing she's standing at
  function ring(g, x, y, e, t0) {
    const f = (e._st || 0) / (t0 || 0.6);
    if (f <= 0.02) return;
    g.beginPath(); g.arc(x, y, 14, 0, Math.PI * 2); g.fillStyle = 'rgba(255,255,255,0.85)'; g.fill();
    g.beginPath(); g.moveTo(x, y); g.arc(x, y, 11, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); g.closePath(); g.fillStyle = '#7a5ce6'; g.fill();
  }
  // a speech bubble with a short word over a character
  function bubble(g, x, y, text, col) {
    g.font = '800 15px "Baloo 2", sans-serif';
    const w = g.measureText(text).width + 18;
    U.rr(g, x - w / 2, y - 26, w, 24, 10); LZ.Art.fs(g, '#fff', col || '#7a5ce6', 2);
    g.beginPath(); g.moveTo(x - 5, y - 3); g.lineTo(x, y + 5); g.lineTo(x + 5, y - 3); g.fillStyle = '#fff'; g.fill();
    g.fillStyle = col || '#7a5ce6'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, x, y - 14);
  }

  /* ================= buttons on the play screen ================= */
  // the little row of buttons at the top right in the house and the open world
  function bar(kind, on, base) {
    let b = document.getElementById('sbbar');
    if (!on) { if (b) b.remove(); return; }
    if (b) b.remove();
    b = document.createElement('div'); b.id = 'sbbar';
    const h = LZ.UI._h;
    const btns = (base || []).slice();
    Ext.each(kind, 'buttons', btns);
    btns.forEach(x => b.appendChild(h('button.sbbtn', { onclick: () => { if (LZ.UI.isPaused()) return; x.fn(); } }, x.label)));
    document.getElementById('hud').appendChild(b);
    return b;
  }

  /* ================= the backpack screen ================= */
  function openBag() {
    const p = S.active(); if (!p) return;
    const f = state(p), h = LZ.UI._h;
    const box = h('div.bagbox');
    const m = open([h('h2', null, '🎒 Plecak'), box, h('button.btn.mid.primary', { onclick: () => m.close() }, 'Zamknij')]);
    function render() {
      box.innerHTML = '';
      const ids = Object.keys(f.bag).filter(k => f.bag[k] > 0 && ITEMS[k]);
      if (!ids.length) { box.appendChild(h('p', null, 'Plecak jest pusty. Zbieraj plony w ogródku, łów ryby i handluj na wyprawie!')); return; }
      CATS.forEach(([cat, label]) => {
        const mine = ids.filter(k => ITEMS[k].cat === cat);
        if (!mine.length) return;
        box.appendChild(h('h3.bagcat', null, label));
        box.appendChild(h('div.baggrid', null, mine.map(id => {
          const acts = [];
          Ext.each('bag', 'actions', p, id, acts);
          return h('div.bagitem', null, [Bag.icon(id, 40), h('span.bagname', null, ITEMS[id].name), h('b.bagn', null, '×' + f.bag[id]),
            acts.length ? h('div.bagacts', null, acts.map(a => h('button.btn.small' + (a.cls || ''), { onclick: () => { a.fn(m, render); } }, a.label))) : null]);
        })));
      });
    }
    render();
  }

  // the backpack button, in the house and outside
  Ext.add({ home: { buttons(l) { l.push({ label: '🎒', fn: openBag }); } }, world: { buttons(l) { l.push({ label: '🎒', fn: openBag }); } } });

  LZ.Ext = Ext;
  LZ.Bag = Bag;
  LZ.Fun = { state, onceToday, doneToday, today, story, ask, open, stand, ring, bubble, bar, openBag, tierOf, nf };
})();
