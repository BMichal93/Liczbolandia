/*
 * mathgen.js - generates maths questions and "collect the numbers"
 * challenges, in Polish, at a difficulty driven by a per-profile skill value.
 *
 * Skill model:
 *   skill is a float from 1.0 to 5.99. Its integer part is a "tier":
 *     1 - counting, +/- within 10 (with dot pictures)
 *     2 - +/- within 20, missing numbers, doubles/halves, simple stories
 *     3 - times tables, division, +/- within 100, time
 *     4 - order of operations, fractions/percent of a number, negatives, rounding
 *     5 - equations, powers/roots, adding fractions, area/perimeter, averages
 *   Each profile has a band (see MATH_LEVELS in data.js) and the skill moves
 *   inside it: +0.08 per correct answer, -0.15 per mistake. Mistakes weigh
 *   more so a struggling kid drops back quickly and doesn't get discouraged.
 *
 * Notation follows Polish school conventions: "·" for multiply and ":" for
 * divide (Polish kids write 12 : 3, not 12 ÷ 3), decimal comma if ever needed.
 */
(function () {
  const U = LZ.U;
  const R = Math.random;
  const ri = (a, b) => U.ri(R, a, b);
  const pick = (arr) => U.pick(R, arr);
  const P = U.plural;

  const NAMES = ['Ola', 'Zosia', 'Hania', 'Lena', 'Maja', 'Tosia', 'Kuba', 'Staś', 'Tomek', 'Julka', 'Ania', 'Franek'];
  // Nouns with their three Polish number forms [1, 2-4, 5+].
  const NOUNS = [
    ['jabłko', 'jabłka', 'jabłek'], ['cukierek', 'cukierki', 'cukierków'], ['naklejka', 'naklejki', 'naklejek'],
    ['kredka', 'kredki', 'kredek'], ['balon', 'balony', 'balonów'], ['muszelka', 'muszelki', 'muszelek'],
    ['kasztan', 'kasztany', 'kasztanów'], ['koralik', 'koraliki', 'koralików'], ['truskawka', 'truskawki', 'truskawek'],
  ];
  const nf = (n, noun) => n + ' ' + P(n, noun[0], noun[1], noun[2]);

  /* Topic names shown on the "Moje wyniki" stats screen. */
  const TOPICS = {
    add: 'Dodawanie', sub: 'Odejmowanie', count: 'Liczenie', compare: 'Porównywanie', seq: 'Ciągi liczb',
    mul: 'Mnożenie', div: 'Dzielenie', word: 'Zadania z treścią', order: 'Kolejność działań',
    frac: 'Ułamki', pct: 'Procenty', neg: 'Liczby ujemne', eq: 'Równania', pow: 'Potęgi i pierwiastki',
    geo: 'Geometria', avg: 'Średnia', round: 'Zaokrąglanie', time: 'Czas', collect: 'Zbieranie liczb',
    money: 'Pieniądze',
  };

  /*
   * Build 3 answer options: the right one plus 2 believable wrong ones.
   * Wrong answers are "near misses" (off by 1, 2, 10) or a typical mistake
   * passed in by the generator (e.g. adding instead of multiplying), because
   * obviously-wrong options teach nothing.
   */
  function numChoices(ans, extra, allowNeg) {
    const cands = [];
    (extra || []).forEach(v => cands.push(v));
    [1, -1, 2, -2, 10, -10, 3, -3, 5].forEach(d => cands.push(ans + d));
    const seen = new Set([ans]);
    const wrong = [];
    for (const c of U.shuffle(R, cands.slice(0, (extra || []).length)).concat(U.shuffle(R, cands.slice((extra || []).length)))) {
      if (wrong.length >= 2) break;
      if (!Number.isFinite(c) || Math.round(c) !== c) continue;
      if (!allowNeg && c < 0) continue;
      if (seen.has(c)) continue;
      seen.add(c); wrong.push(c);
    }
    return U.shuffle(R, [ans].concat(wrong)).map(String);
  }
  function mk(q, ans, topic, opts) {
    opts = opts || {};
    const a = String(ans);
    const choices = opts.choices ? U.shuffle(R, opts.choices.map(String)) : numChoices(ans, opts.extra, opts.neg);
    return { q, a, choices, topic, visual: opts.visual || null, hint: opts.hint || null };
  }

  /* ---------------- Tier 1: 6-7 years ---------------- */
  const T1 = [
    [3, () => { const a = ri(0, 7), b = ri(1, 10 - a); return mk(a + ' + ' + b + ' = ?', a + b, 'add', { visual: { type: 'dots', a, b, op: '+' }, hint: 'Policz wszystkie kropki!' }); }],
    [3, () => { const a = ri(3, 10), b = ri(1, a - 1); return mk(a + ' - ' + b + ' = ?', a - b, 'sub', { visual: { type: 'dots', a, b, op: '-' }, hint: 'Policz kropki, które nie są skreślone.' }); }],
    [2, () => { const n = ri(3, 12); return mk('Ile jest gwiazdek?', n, 'count', { visual: { type: 'count', n } }); }],
    [2, () => {
      let a = ri(1, 20), b = ri(1, 20); while (b === a) b = ri(1, 20);
      return mk('Która liczba jest większa?', Math.max(a, b), 'compare', { choices: [a, b] });
    }],
    [1, () => {
      let a = ri(2, 20), b = ri(1, 20); while (b === a) b = ri(1, 20);
      return mk('Która liczba jest mniejsza?', Math.min(a, b), 'compare', { choices: [a, b] });
    }],
    [2, () => {
      const step = pick([1, 1, 2, 5, 10]), s = step === 10 ? 10 * ri(0, 3) : step === 5 ? 5 * ri(0, 3) : ri(0, 8);
      return mk([s, s + step, s + 2 * step].join(', ') + ', ?', s + 3 * step, 'seq', { extra: [s + 3 * step + 1, s + 2 * step + 1] });
    }],
  ];

  /* ---------------- Tier 2: 7-8 years ---------------- */
  const T2 = [
    [3, () => { const a = ri(5, 14), b = ri(3, 20 - a); return mk(a + ' + ' + b + ' = ?', a + b, 'add', { extra: [a + b - 10 > 0 ? a + b - 10 : a + b + 10] }); }],
    [3, () => { const a = ri(11, 20), b = ri(2, a - 2); return mk(a + ' - ' + b + ' = ?', a - b, 'sub'); }],
    [2, () => { const c = ri(8, 20), a = ri(2, c - 2); return mk(a + ' + ? = ' + c, c - a, 'add', { extra: [c + a > 20 ? c - a + 1 : c + a] }); }],
    [1, () => { const c = ri(3, 12), b = ri(2, 8); return mk('? - ' + b + ' = ' + c, c + b, 'sub', { extra: [c - b >= 0 ? c - b : c + b + 1] }); }],
    [2, () => { const a = ri(2, 10); return R() < 0.5 ? mk('Dwa razy ' + a + ' to?', 2 * a, 'mul', { extra: [a + 2] }) : mk('Połowa z ' + (2 * a) + ' to?', a, 'div', { extra: [2 * a - 2] }); }],
    [1, () => {
      const t = ri(1, 9), j = ri(0, 9);
      return mk(t + ' ' + P(t, 'dziesiątka', 'dziesiątki', 'dziesiątek') + ' i ' + j + ' ' + P(j, 'jedność', 'jedności', 'jedności') + ' to?', 10 * t + j, 'count', { extra: [10 * j + t, t + j] });
    }],
    [3, () => {
      const n = pick(NAMES), noun = pick(NOUNS), a = ri(3, 12), b = ri(2, 20 - a);
      return mk(n + ' ma ' + nf(a, noun) + ' i dostaje jeszcze ' + b + '. Ile ' + noun[2] + ' ma teraz?', a + b, 'word', { extra: [a - b > 0 ? a - b : a + b + 2] });
    }],
    [2, () => {
      const n = pick(NAMES), noun = pick(NOUNS), a = ri(8, 20), b = ri(2, a - 2);
      return mk(n + ' ma ' + nf(a, noun) + '. Oddaje ' + b + ' koleżance. Ile ' + noun[2] + ' zostało?', a - b, 'word', { extra: [a + b] });
    }],
    [1, () => {
      const n1 = pick(NAMES); let n2 = pick(NAMES); while (n2 === n1) n2 = pick(NAMES);
      const noun = pick(NOUNS), a = ri(8, 18), b = ri(2, a - 3);
      return mk(n1 + ' ma ' + nf(a, noun) + ', a ' + n2 + ' ma ' + nf(b, noun) + '. O ile więcej ma ' + n1 + '?', a - b, 'word', { extra: [a + b] });
    }],
    [1, () => { const a = ri(2, 9), b = ri(1, 9); return mk('Masz ' + a + ' zł i dostajesz ' + b + ' zł. Ile masz razem?', a + b, 'money'); }],
  ];

  /* ---------------- Tier 3: 8-10 years ---------------- */
  const LEGS = [
    { w: ['kot', 'koty', 'kotów'], l: ['łapa', 'łapy', 'łap'], k: 4 },
    { w: ['pająk', 'pająki', 'pająków'], l: ['noga', 'nogi', 'nóg'], k: 8 },
    { w: ['biedronka', 'biedronki', 'biedronek'], l: ['noga', 'nogi', 'nóg'], k: 6 },
    { w: ['trójkąt', 'trójkąty', 'trójkątów'], l: ['bok', 'boki', 'boków'], k: 3 },
    { w: ['kwiatek', 'kwiatki', 'kwiatków'], l: ['płatek', 'płatki', 'płatków'], k: 5 },
    { w: ['rower', 'rowery', 'rowerów'], l: ['koło', 'koła', 'kół'], k: 2 },
  ];
  const T3 = [
    [5, () => { const a = ri(2, 10), b = ri(2, 10); return mk(a + ' · ' + b + ' = ?', a * b, 'mul', { extra: [a + b, a * b + a, a * b - b] }); }],
    [4, () => { const b = ri(2, 10), q = ri(2, 10); return mk((b * q) + ' : ' + b + ' = ?', q, 'div', { extra: [b * q - b, q + 1] }); }],
    [2, () => { const a = ri(12, 60), b = ri(11, 99 - a); return mk(a + ' + ' + b + ' = ?', a + b, 'add', { extra: [a + b + 10, a + b - 1] }); }],
    [2, () => { const a = ri(30, 99), b = ri(11, a - 5); return mk(a + ' - ' + b + ' = ?', a - b, 'sub', { extra: [a - b + 10, a - b - 10] }); }],
    [2, () => {
      const it = pick(LEGS), n = ri(3, 9);
      return mk('Każdy ' + it.w[0] + ' ma ' + it.k + ' ' + P(it.k, it.l[0], it.l[1], it.l[2]) + '. Ile ' + it.l[2] + ' ' + P(n, 'ma', 'mają', 'ma') + ' ' + n + ' ' + P(n, it.w[0], it.w[1], it.w[2]) + '?', it.k * n, 'word', { extra: [it.k + n] });
    }],
    [2, () => {
      const n = pick(NAMES), b = ri(2, 6), q = ri(2, 8), a = b * q;
      return mk(n + ' ma ' + a + ' ' + P(a, 'naklejkę', 'naklejki', 'naklejek') + ' i daje po równo każdej z ' + b + ' koleżanek. Ile dostanie każda?', q, 'word', { extra: [a - b] });
    }],
    [1, () => {
      const v = pick([
        ['Ile minut to pół godziny?', 30, [15, 50]],
        ['Ile minut to kwadrans?', 15, [25, 10]],
        ['Ile minut to trzy kwadranse?', 45, [30, 35]],
        ['Ile godzin ma doba?', 24, [12, 20]],
        ['Ile dni ma tydzień?', 7, [5, 10]],
        ['Ile miesięcy ma rok?', 12, [10, 11]],
      ]);
      if (R() < 0.5) { const h = ri(2, 4); return mk('Ile minut to ' + h + ' ' + P(h, 'godzina', 'godziny', 'godzin') + '?', 60 * h, 'time', { extra: [100 * h, 60 * h + 30] }); }
      return mk(v[0], v[1], 'time', { extra: v[2] });
    }],
    [1, () => { const s = ri(1, 10), st = pick([3, 4, 5, 6]); return mk([s, s + st, s + 2 * st, s + 3 * st].join(', ') + ', ?', s + 4 * st, 'seq'); }],
  ];

  /* ---------------- Tier 4: 10-12 years ---------------- */
  const FRAC_WORD = { 2: 'połowa', 3: 'jedna trzecia', 4: 'jedna czwarta', 5: 'jedna piąta', 10: 'jedna dziesiąta' };
  const T4 = [
    [3, () => {
      const a = ri(2, 12), b = ri(2, 9), c = ri(2, 9);
      const form = ri(0, 2);
      if (form === 0) return mk(a + ' + ' + b + ' · ' + c + ' = ?', a + b * c, 'order', { extra: [(a + b) * c] });
      if (form === 1) return mk('(' + a + ' + ' + b + ') · ' + c + ' = ?', (a + b) * c, 'order', { extra: [a + b * c] });
      const x = b * c + ri(1, 20);
      return mk(x + ' - ' + b + ' · ' + c + ' = ?', x - b * c, 'order', { extra: [(x - b) * c > 0 && (x - b) * c < 999 ? (x - b) * c : x - b * c + 10] });
    }],
    [3, () => {
      const d = pick([2, 3, 4, 5, 10]), n = ri(1, d - 1), k = ri(2, 12), w = d * k;
      const txt = (n === 1 && R() < 0.4) ? FRAC_WORD[d][0].toUpperCase() + FRAC_WORD[d].slice(1) + ' z ' + w + ' to?' : n + '/' + d + ' z ' + w + ' = ?';
      return mk(txt, n * k, 'frac', { extra: [w - n * k === n * k ? n * k + k : w - n * k, k] });
    }],
    [3, () => {
      const p = pick([10, 20, 25, 50, 75]), base = { 10: 10, 20: 5, 25: 4, 50: 2, 75: 4 }[p] * ri(2, 20);
      return mk(p + '% z ' + base + ' = ?', base * p / 100, 'pct', { extra: [base - base * p / 100, p] });
    }],
    [2, () => {
      const a = ri(-9, 9), b = ri(-9, 9);
      const bs = b < 0 ? '(' + b + ')' : String(b);
      return mk(a + ' + ' + bs + ' = ?', a + b, 'neg', { neg: true, extra: [a - b, -(a + b)] });
    }],
    [2, () => { const a = ri(2, 9), b = ri(a + 2, 15); return mk(a + ' - ' + b + ' = ?', a - b, 'neg', { neg: true, extra: [b - a] }); }],
    [3, () => { const a = ri(12, 49), b = ri(3, 9); return mk(a + ' · ' + b + ' = ?', a * b, 'mul', { extra: [a * b + 10, a * b - b] }); }],
    [2, () => { const b = ri(3, 9), q = ri(11, 30); return mk((b * q) + ' : ' + b + ' = ?', q, 'div', { extra: [q + 10, q - 1] }); }],
    [2, () => {
      const n = ri(101, 989), toH = R() < 0.4;
      const ans = toH ? Math.round(n / 100) * 100 : Math.round(n / 10) * 10;
      const other = toH ? Math.floor(n / 100) * 100 + (ans === Math.floor(n / 100) * 100 ? 100 : 0) : Math.floor(n / 10) * 10 + (ans === Math.floor(n / 10) * 10 ? 10 : 0);
      return mk('Zaokrąglij ' + n + ' do ' + (toH ? 'setek' : 'dziesiątek'), ans, 'round', { extra: [other, n] });
    }],
    [2, () => {
      const p = ri(4, 25), n = ri(3, 8), it = pick([['Książka', 'książki', 'książek'], ['Bilet', 'bilety', 'biletów'], ['Lody', 'lody', 'lodów']]);
      if (it[0] === 'Lody') return mk('Lody kosztują ' + p + ' zł. Ile zapłacisz za ' + n + ' porcji?', p * n, 'money', { extra: [p + n, p * n + p] });
      return mk(it[0] + ' kosztuje ' + p + ' zł. Ile zapłacisz za ' + n + ' ' + P(n, it[0].toLowerCase(), it[1], it[2]) + '?', p * n, 'money', { extra: [p + n, p * n + p] });
    }],
    [1, () => { const m = pick([20, 50, 100]), p = ri(3, m - 2); return mk('Płacisz ' + m + ' zł za zakupy za ' + p + ' zł. Ile dostaniesz reszty?', m - p, 'money', { extra: [m - p + 10] }); }],
  ];

  /* ---------------- Tier 5: 12+ years ---------------- */
  const T5 = [
    [4, () => {
      const x = ri(2, 12), a = ri(2, 9), b = ri(1, 20), form = ri(0, 2);
      if (form === 0) return mk(a + 'x + ' + b + ' = ' + (a * x + b) + '.   x = ?', x, 'eq', { extra: [a * x + b - b - a > 0 ? x + 1 : x + 2, (a * x + b) / a | 0] });
      if (form === 1) return mk(a + 'x - ' + b + ' = ' + (a * x - b) + '.   x = ?', x, 'eq', { extra: [x - 1, x + 2] });
      return mk('x : ' + a + ' = ' + x + '.   x = ?', a * x, 'eq', { extra: [x + a, a * x + a] });
    }],
    [3, () => {
      if (R() < 0.5) { const b = ri(2, 10), e = b <= 5 ? pick([2, 3]) : 2; return mk(b + (e === 2 ? '²' : '³') + ' = ?', Math.pow(b, e), 'pow', { extra: [b * e, Math.pow(b, e) + b] }); }
      const r = ri(2, 12); return mk('√' + (r * r) + ' = ?', r, 'pow', { extra: [r * r / 2 | 0, r + 1] });
    }],
    [3, () => {
      const d = pick([5, 7, 11]), a = ri(1, d - 3), b = ri(1, d - 1 - a);
      const ans = (a + b) + '/' + d;
      return mk(a + '/' + d + ' + ' + b + '/' + d + ' = ?', ans, 'frac', { choices: [ans, (a + b) + '/' + (2 * d), (a * b) + '/' + d === ans ? (a + b + 1) + '/' + d : (a * b) + '/' + d] });
    }],
    [3, () => {
      const a = ri(3, 12), b = ri(2, 9);
      return R() < 0.5
        ? mk('Pole prostokąta o bokach ' + a + ' cm i ' + b + ' cm (w cm²)?', a * b, 'geo', { extra: [2 * (a + b), a + b] })
        : mk('Obwód prostokąta o bokach ' + a + ' cm i ' + b + ' cm (w cm)?', 2 * (a + b), 'geo', { extra: [a * b, a + b] });
    }],
    [2, () => {
      const m = ri(4, 20), d1 = ri(1, 4), d2 = ri(0, 3);
      const nums = U.shuffle(R, [m - d1, m + d1 - d2, m + d2]);
      return mk('Średnia liczb ' + nums.join(', ') + ' = ?', m, 'avg', { extra: [nums.reduce((s, v) => s + v, 0), m + 1] });
    }],
    [2, () => {
      const p = pick([10, 20, 25, 50]), price = { 10: 10, 20: 5, 25: 4, 50: 2 }[p] * ri(4, 30);
      return mk('Cena ' + price + ' zł spadła o ' + p + '%. Nowa cena to?', price - price * p / 100, 'pct', { extra: [price * p / 100, price - p] });
    }],
    [2, () => { const a = ri(2, 6), b = ri(2, 6); return mk('(-' + a + ') · ' + b + ' = ?', -a * b, 'neg', { neg: true, extra: [a * b, -a - b] }); }],
    [1, () => { const b = pick([2, 3]), s = ri(1, 4); return mk([s, s * b, s * b * b, s * b * b * b].join(', ') + ', ?', s * Math.pow(b, 4), 'seq', { extra: [s * Math.pow(b, 3) * 2 + (b === 2 ? 1 : 0), s * Math.pow(b, 3) + s] }); }],
  ];

  const TIERS = [null, T1, T2, T3, T4, T5];

  /*
   * Pick a tier around the current skill with a little randomness,
   * so a player at 2.4 mostly gets tier 2 with the occasional tier 1
   * (a confidence boost) or tier 3 (a stretch).
   */
  function tierFor(skill, band) {
    const lo = band ? band.min : 1, hi = band ? band.max : 5.99;
    const s = U.clamp(skill + (R() * 0.9 - 0.5), lo, hi);
    return U.clamp(Math.floor(s), 1, 5);
  }

  function question(skill, band) {
    const t = tierFor(skill, band);
    const q = U.wpick(R, TIERS[t])();
    q.tier = t;
    return q;
  }

  /*
   * "Collect the numbers" challenges. Each returns bubbles (labels) and a
   * small rule object the game uses to judge every pickup:
   *   kind 'sum'   - pick bubbles until the total equals the target
   *   kind 'set'   - pick every "good" bubble (even, multiples, primes...);
   *                  bad bubbles just bounce off with a friendly explanation
   *   kind 'order' - pick bubbles from smallest to biggest
   */
  function isPrime(n) { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; }

  function challenge(skill, band) {
    const t = tierFor(skill, band);
    const opts = [];
    // SUM: build a guaranteed solution first, then add distractors.
    opts.push(() => {
      const parts = t <= 1 ? 2 : t <= 3 ? 3 : 3;
      const maxN = [0, 5, 9, 20, 30, 40][t];
      const sol = []; for (let i = 0; i < parts; i++) sol.push(ri(1, maxN));
      const target = sol.reduce((s, v) => s + v, 0);
      const extra = []; while (extra.length < (t <= 1 ? 2 : 3)) extra.push(ri(1, maxN));
      return { kind: 'sum', title: 'Zbierz liczby, które razem dają ' + target, target, labels: U.shuffle(R, sol.concat(extra)).map(String), topic: 'collect' };
    });
    if (t <= 2) {
      opts.push(() => {
        const even = R() < 0.5; const labels = [];
        const goodCount = ri(3, 4);
        while (labels.filter(v => (v % 2 === 0) === even).length < goodCount) { const v = ri(1, 20); if (!labels.includes(v) && (v % 2 === 0) === even) labels.push(v); }
        while (labels.length < goodCount + 3) { const v = ri(1, 20); if (!labels.includes(v) && (v % 2 === 0) !== even) labels.push(v); }
        return {
          kind: 'set', title: 'Zbierz wszystkie liczby ' + (even ? 'parzyste' : 'nieparzyste'), labels: U.shuffle(R, labels).map(String),
          good: v => (+v % 2 === 0) === even, whyBad: v => v + ' to liczba ' + (even ? 'nieparzysta' : 'parzysta') + '!', topic: 'collect',
        };
      });
    }
    if (t <= 3) {
      opts.push(() => {
        const labels = []; const max = t === 1 ? 20 : 99;
        while (labels.length < 5) { const v = ri(0, max); if (!labels.includes(v)) labels.push(v); }
        return { kind: 'order', title: 'Zbieraj od najmniejszej do największej', labels: U.shuffle(R, labels).map(String), sorted: labels.slice().sort((a, b) => a - b).map(String), topic: 'collect' };
      });
    }
    if (t >= 3) {
      opts.push(() => {
        const k = ri(3, t >= 4 ? 12 : 9); const labels = [];
        while (labels.length < 4) { const v = k * ri(2, 10); if (!labels.includes(v)) labels.push(v); }
        while (labels.length < 7) { const v = ri(10, k * 10); if (v % k !== 0 && !labels.includes(v)) labels.push(v); }
        return { kind: 'set', title: 'Zbierz wielokrotności liczby ' + k, labels: U.shuffle(R, labels).map(String), good: v => +v % k === 0, whyBad: v => v + ' nie dzieli się przez ' + k + '.', topic: 'collect' };
      });
    }
    if (t >= 5) {
      opts.push(() => {
        const labels = [];
        while (labels.filter(isPrime).length < 4) { const v = ri(2, 50); if (isPrime(v) && !labels.includes(v)) labels.push(v); }
        while (labels.length < 7) { const v = ri(4, 50); if (!isPrime(v) && !labels.includes(v)) labels.push(v); }
        return { kind: 'set', title: 'Zbierz wszystkie liczby pierwsze', labels: U.shuffle(R, labels).map(String), good: v => isPrime(+v), whyBad: v => v + ' nie jest liczbą pierwszą.', topic: 'collect' };
      });
      opts.push(() => {
        const good = U.shuffle(R, ['2/4', '3/6', '4/8', '5/10', '6/12', '7/14']).slice(0, 3);
        const bad = U.shuffle(R, ['2/3', '3/5', '1/3', '4/6', '5/8', '3/4']).slice(0, 3);
        return { kind: 'set', title: 'Zbierz ułamki równe 1/2', labels: U.shuffle(R, good.concat(bad)), good: v => { const [a, b] = v.split('/').map(Number); return 2 * a === b; }, whyBad: v => v + ' to nie jest połowa.', topic: 'frac' };
      });
    }
    const c = pick(opts)();
    c.tier = t;
    return c;
  }

  /* Price question for the shop's "promocja" (discount) offers. */
  function discountQuestion(price, skill) {
    if (skill < 2.5) {
      // Young players: discount in whole coins, a simple subtraction.
      const off = Math.min(price - 10, U.pick(R, [10, 20, 30]));
      return { off, q: 'Promocja! ' + price + ' monet, taniej o ' + off + '. Ile zapłacisz?', a: String(price - off), choices: numChoices(price - off, [price + off, price - off + 10]), topic: 'money' };
    }
    if (skill < 3.6) {
      const off = Math.round(price / 2 / 10) * 10 || 10;
      return { off, q: 'Promocja! ' + price + ' monet, taniej o ' + off + '. Ile zapłacisz?', a: String(price - off), choices: numChoices(price - off, [price + off, price - off - 10]), topic: 'money' };
    }
    const p = U.pick(R, [10, 20, 25, 50]);
    const off = price * p / 100;
    return { off, q: 'Promocja -' + p + '%! Cena ' + price + ' monet. Ile zapłacisz?', a: String(price - off), choices: numChoices(price - off, [off, price - p]), topic: 'pct' };
  }

  LZ.M = { question, challenge, discountQuestion, TOPICS, numChoices };
})();
