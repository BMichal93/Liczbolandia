/*
 * giants.js - roaming giants in the open world.
 *
 * Every landscape has two: one on the surface and one in the tunnel below.
 * A giant is a bigger version of that landscape's creature with a crown and
 * 4-6 hearts; each hop on its head takes one heart. Beating it gives coins
 * and rare materials. A beaten giant is back the next day.
 * (The engine side - size, hearts, hops - is makeGiant() in game.js.)
 *
 * Save data: fun.giants { id: dateKey beaten }, fun.giantCount.
 */
(function () {
  const U = LZ.U, S = LZ.S, A = LZ.A, Fun = LZ.Fun, Bag = LZ.Bag;
  const NAMES = { slime: 'Wielki Glutek', snowball: 'Wielki Śnieżynek', shroom: 'Wielki Grzybek', robot: 'Wielki Robot', alien: 'Wielki Kosmitek', scorpion: 'Wielki Skorpion', bee: 'Wielki Bzyczek', vulture: 'Wielki Sęp', cloudy: 'Wielki Chmurek', ufo: 'Wielki Talerz', bat: 'Wielki Nietoperz' };
  const OK = Object.keys(NAMES);   // spiky ones can't be hopped on, so they never grow into giants
  function hash(a, b, c) { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }

  // where the giants of landscape b live, and what they are
  function giantsOf(W, b) {
    if (b === 0) return [];
    const dir = Math.sign(b), bk = W.biomeKey(b), world = LZ.D.WORLDS[LZ.World.BIOMES[bk].w - 1];
    const kinds = world.enemies.filter(e => OK.includes(e));
    const pick = (salt, list) => list[Math.floor(hash(b, salt, W.seed) * list.length)];
    const surfType = pick(1, kinds.length ? kinds : ['slime']);
    // away from the traders' stalls and the balloons, so a giant never guards one
    let sx = b * W.BAND - 60 * dir;
    const near = x => Math.abs(((x - 125) % 250 + 250) % 250) < 20 || Math.abs(((x - 125) % 250 + 250) % 250 - 250) < 20 || Math.abs(((x - 150) % 300 + 300) % 300) < 20 || Math.abs(((x - 150) % 300 + 300) % 300 - 300) < 20;
    for (let k = 0; k < 4 && near(sx); k++) sx += 25 * dir;
    const st = W.standAt(sx);
    const flyer = LZ.World.FLYERS.includes(surfType);
    const out = [{ gid: 's' + b, type: surfType, x: st.x, y: flyer ? st.y - 3 : st.y, hp: Math.min(6, 4 + Math.floor(Math.abs(b) / 3)), deep: false }];
    const cx = b * W.BAND + 10 * dir, cy = W.tunnelC(cx, 0) + W.tunnelH(cx, 0) + 1;
    const caveType = pick(2, ['slime', 'bat', 'shroom']);
    out.push({ gid: 'c' + b, type: caveType, x: cx, y: caveType === 'bat' ? cy - 2 : cy, hp: Math.min(6, 5 + Math.floor(Math.abs(b) / 3)), deep: true });
    return out;
  }

  function reward(G, e) {
    const p = G.prof, f = Fun.state(p);
    f.giants = f.giants || {};
    const first = !f.giants[e.gid];
    f.giants[e.gid] = Fun.today(); f.giantCount = (f.giantCount || 0) + 1;
    f.book.places.giant = 1;
    const deep = e.gid[0] === 'c', far = Math.abs(parseInt(e.gid.slice(1), 10)) >= 3;
    const pool = deep ? ['gem', 'gold', 'iron'] : ['iron', 'feather', 'gem'];
    const got = {};
    for (let i = 0; i < 3; i++) { const m = U.pick(Math.random, pool); got[m] = (got[m] || 0) + 1; }
    if (far) got.star = (got.star || 0) + 1;
    if (first) got.gem = (got.gem || 0) + 1;
    Object.keys(got).forEach(k => Bag.add(p, k, got[k]));
    const coins = 15 + (far ? 10 : 0);
    p.coins += coins; p.stats.totalCoins += coins;
    S.checkBadges(p); S.save(); A.play('win');
    LZ.Game._confetti(e.x + e.w / 2, e.y, 50);
    LZ.Game._toast(e.gname + ' pokonany! +' + coins + ' monet, ' + Object.keys(got).map(k => Bag.name(k, got[k]).toLowerCase()).join(', '), 3.4);
  }

  LZ.Ext.add({
    world: {
      defs(G, cx, cy, push, W) {
        const f = Fun.state(G.prof); f.giants = f.giants || {};
        const x0 = cx * 32;
        for (const b of new Set([W.bandOf(x0), W.bandOf(x0 + 31)])) {
          for (const gi of giantsOf(W, b)) {
            if (gi.x < x0 || gi.x >= x0 + 32 || Math.floor(gi.y / 32) !== cy) continue;
            if (f.giants[gi.gid] === Fun.today()) continue;   // beaten today: back tomorrow
            push({ t: 'enemy', type: gi.type, x: gi.x, y: gi.y, giant: 1.8, hp: gi.hp, gid: gi.gid, gname: NAMES[gi.type] });
          }
        }
      },
      kill(G, e) { if (e.giant) reward(G, e); },
    },
  });

  LZ.Giants = { giantsOf, NAMES };
})();
