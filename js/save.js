/*
 * save.js - player profiles, progress and settings.
 *
 * Storage: everything lives in one localStorage key as JSON. On an installed
 * PWA that storage belongs to the app and survives restarts. We also ask the
 * browser for "persistent" storage so Android won't evict it when the phone
 * is low on space.
 *
 * Because localStorage can still be wiped (clearing Chrome data, new phone),
 * the settings screen offers export/import: a .json file and a copy-paste
 * text code. That is the "save/load" the kids (or a parent) can rely on.
 */
(function () {
  const KEY = 'liczbolandia_v1';
  const D = LZ.D;

  function newProfile(name, mathLevel) {
    const ml = D.MATH_LEVELS.find(m => m.id === mathLevel) || D.MATH_LEVELS[0];
    return {
      id: 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
      name: name,
      mathLevel: ml.id,
      skill: ml.start,
      coins: 0,
      done: {},          // 'w-l' -> true once a level is finished
      stars: {},         // 'w-l' -> [bool,bool,bool]
      best: {},          // 'w-l' -> best coin count
      bossWins: [],      // world numbers whose boss was beaten
      owned: { chars: ['cat'], variants: { cat: [0] }, hats: ['none'], trails: ['none'] },
      equip: { char: 'cat', variant: 0, hat: 'none', trail: 'none' },
      badges: [],
      readAloud: ml.id === 1,   // read questions aloud - default on for the youngest level
      stats: { correct: 0, wrong: 0, streak: 0, bestStreak: 0, totalCoins: 0, stomps: 0, jumps: 0, purchases: 0, topics: {} },
      created: Date.now(), lastPlayed: Date.now(),
    };
  }

  const defaults = () => ({ version: 1, profiles: [], active: null, settings: { music: 0.6, sfx: 0.8 } });

  let data = defaults();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) data = migrate(JSON.parse(raw));
    } catch (e) { console.warn('save load failed', e); data = defaults(); }
    return data;
  }

  /*
   * Fill in any fields missing from older saves or hand-edited imports,
   * so new features never crash on an old profile.
   */
  function migrate(d) {
    const base = defaults();
    d = Object.assign(base, d || {});
    d.settings = Object.assign(defaults().settings, d.settings || {});
    d.profiles = (d.profiles || []).map(p => {
      const fresh = newProfile(p.name || 'Gracz', p.mathLevel || 1);
      const out = Object.assign(fresh, p);
      out.owned = Object.assign(fresh.owned, p.owned || {});
      out.equip = Object.assign(fresh.equip, p.equip || {});
      out.stats = Object.assign(fresh.stats, p.stats || {});
      out.stats.topics = out.stats.topics || {};
      if (p.readAloud === undefined) out.readAloud = out.mathLevel === 1;
      return out;
    });
    return d;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { console.warn('save failed', e); }
  }

  function requestPersistence() {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  }

  function active() { return data.profiles.find(p => p.id === data.active) || null; }
  function setActive(id) { data.active = id; const p = active(); if (p) p.lastPlayed = Date.now(); save(); }
  function addProfile(name, level) { const p = newProfile(name, level); data.profiles.push(p); save(); return p; }
  function removeProfile(id) { data.profiles = data.profiles.filter(p => p.id !== id); if (data.active === id) data.active = null; save(); }

  /* ---- maths bookkeeping: adaptive difficulty + per-topic stats ---- */
  function recordAnswer(p, topic, correct) {
    const band = D.MATH_LEVELS.find(m => m.id === p.mathLevel) || D.MATH_LEVELS[0];
    const s = p.stats;
    const t = s.topics[topic] || (s.topics[topic] = { c: 0, t: 0 });
    t.t++;
    if (correct) {
      t.c++; s.correct++; s.streak++; s.bestStreak = Math.max(s.bestStreak, s.streak);
      p.skill = Math.min(band.max, p.skill + 0.08 + (s.streak >= 5 ? 0.04 : 0));
    } else {
      s.wrong++; s.streak = 0;
      p.skill = Math.max(band.min, p.skill - 0.15);
    }
  }
  function mathBand(p) { return D.MATH_LEVELS.find(m => m.id === p.mathLevel) || D.MATH_LEVELS[0]; }
  function setMathLevel(p, id) {
    const b = D.MATH_LEVELS.find(m => m.id === id); if (!b) return;
    p.mathLevel = id; p.skill = b.start; save();
  }

  /* ---- unlock rules ---- */
  function levelKey(w, l) { return w + '-' + l; }
  function isLevelUnlocked(p, w, l) {
    if (w === 1 && l === 1) return true;
    if (l > 1) return !!p.done[levelKey(w, l - 1)];
    return !!p.done[levelKey(w - 1, D.LEVELS_PER_WORLD)];
  }
  function isWorldUnlocked(p, w) { return isLevelUnlocked(p, w, 1); }

  /* Check badges; returns newly earned ones so the UI can celebrate. */
  function checkBadges(p) {
    const got = [];
    for (const b of D.BADGES) {
      if (!p.badges.includes(b.id) && b.check(p)) { p.badges.push(b.id); got.push(b); }
    }
    return got;
  }
  /* Characters given for bosses. */
  function grantBossUnlocks(p) {
    const got = [];
    for (const c of D.CHARACTERS) {
      if (c.unlock && c.unlock.boss && p.bossWins.includes(c.unlock.boss) && !p.owned.chars.includes(c.id)) {
        p.owned.chars.push(c.id); p.owned.variants[c.id] = [0]; got.push(c);
      }
    }
    return got;
  }
  /* Hat/trail owned either because bought or because its badge is earned. */
  function ownsHat(p, id) { const h = D.HATS.find(x => x.id === id); return p.owned.hats.includes(id) || (h && h.badge && p.badges.includes(h.badge)); }
  function ownsTrail(p, id) { const t = D.TRAILS.find(x => x.id === id); return p.owned.trails.includes(id) || (t && t.badge && p.badges.includes(t.badge)); }

  /* ---- export / import ---- */
  function exportText() {
    // base64 of UTF-8 JSON - survives copy/paste through chat apps.
    const json = JSON.stringify(data);
    return btoa(unescape(encodeURIComponent(json)));
  }
  function importText(txt) {
    txt = (txt || '').trim();
    let obj;
    if (txt.startsWith('{')) obj = JSON.parse(txt);
    else obj = JSON.parse(decodeURIComponent(escape(atob(txt))));
    if (!obj || !Array.isArray(obj.profiles)) throw new Error('To nie wygląda na zapis gry.');
    data = migrate(obj);
    save();
    return data;
  }
  function exportFile() {
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    const d = new Date();
    a.download = 'liczbolandia-zapis-' + d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + '.json';
    a.href = URL.createObjectURL(blob);
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  LZ.S = {
    load, save, requestPersistence, get data() { return data; }, active, setActive, addProfile, removeProfile,
    recordAnswer, mathBand, setMathLevel, levelKey, isLevelUnlocked, isWorldUnlocked, checkBadges, grantBossUnlocks,
    ownsHat, ownsTrail, exportText, importText, exportFile,
  };
})();
