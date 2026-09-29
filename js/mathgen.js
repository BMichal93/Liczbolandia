/*
 * mathgen.js - generates maths questions and "collect the numbers"
 * challenges, in Polish, at a difficulty driven by a per-profile skill value.
 *
 * Scope (agreed with the parent): only + - × :, whole numbers 0-100,
 * never a negative number anywhere (not in questions, answers or wrong
 * options). Multiplication and division appear only on the harder levels.
 *
 * Skill model:
 *   skill is a float from 1.0 to 5.99. Its integer part is a "tier":
 *     1 - counting, comparing, + and - within 10 (with dot pictures)
 *     2 - + and - within 20 (crossing ten), missing numbers, short stories
 *     3 - + and - within 100: tens, two-digit numbers, stories, change
 *     4 - × and : within 50 (tables of 2, 3, 4, 5, 10) mixed with tier 3
 *     5 - the full times table to 100 and division, story problems with × :
 *   Each profile's difficulty level (MATH_LEVELS in data.js) is a band of
 *   tiers; inside it the skill moves +0.08 per correct answer and -0.15 per
 *   mistake. Mistakes weigh more, so a struggling child drops back quickly.
 *
 * Notation follows Polish school conventions: "·" for multiply and ":" for
 * divide (Polish kids write 12 : 3, not 12 ÷ 3).
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
    mul: 'Mnożenie', div: 'Dzielenie', word: 'Zadania z treścią', collect: 'Zbieranie liczb', money: 'Pieniądze',
  };

  /*
   * Build answer options: the right one plus 2 believable wrong ones.
   * Wrong answers are "near misses" (off by 1, 2, 10) or a typical mistake
   * passed in by the generator (e.g. adding instead of multiplying), because
   * obviously-wrong options teach nothing. Wrong options are never negative
   * and never above 100 when the right answer is within 100.
   */
  function numChoices(ans, extra) {
    // wrong options stay in the same number range as the answer (within 20 for the easy level)
    const cap = ans <= 20 ? 20 : ans <= 100 ? 100 : Infinity;
    const ex = (extra || []).slice();
    const near = [1, -1, 2, -2, 10, -10, 3, -3, 5, -5].map(d => ans + d);
    const seen = new Set([ans]);
    const wrong = [];
    for (const c of U.shuffle(R, ex).concat(U.shuffle(R, near))) {
      if (wrong.length >= 2) break;
      if (!Number.isFinite(c) || Math.round(c) !== c || c < 0 || c > cap || seen.has(c)) continue;
      seen.add(c); wrong.push(c);
    }
    return U.shuffle(R, [ans].concat(wrong)).map(String);
  }
  function mk(q, ans, topic, opts) {
    opts = opts || {};
    const choices = opts.choices ? U.shuffle(R, opts.choices.map(String)) : numChoices(ans, opts.extra);
    return { q, a: String(ans), choices, topic, visual: opts.visual || null, hint: opts.hint || null };
  }

  /* ---------------- Tier 1: within 10 ---------------- */
  const T1 = [
    [3, () => { const a = ri(0, 7), b = ri(1, 10 - a); return mk(a + ' + ' + b + ' = ?', a + b, 'add', { visual: { type: 'dots', a, b, op: '+' }, hint: 'Policz wszystkie kropki!' }); }],
    [3, () => { const a = ri(3, 10), b = ri(1, a - 1); return mk(a + ' - ' + b + ' = ?', a - b, 'sub', { visual: { type: 'dots', a, b, op: '-' }, hint: 'Policz kropki, które nie są skreślone.' }); }],
    [2, () => { const n = ri(3, 12); return mk('Ile jest gwiazdek?', n, 'count', { visual: { type: 'count', n } }); }],
    [2, () => {
      let a = ri(1, 20), b = ri(1, 20); while (b === a) b = ri(1, 20);
      const big = R() < 0.6;
      return mk('Która liczba jest ' + (big ? 'większa' : 'mniejsza') + '?', big ? Math.max(a, b) : Math.min(a, b), 'compare', { choices: [a, b] });
    }],
    [1, () => { const step = pick([1, 1, 2]), s = ri(0, 8); return mk([s, s + step, s + 2 * step].join(', ') + ', ?', s + 3 * step, 'seq', { extra: [s + 3 * step + 1, s + 2 * step + 1] }); }],
  ];

  /* ---------------- Tier 2: within 20 ---------------- */
  const T2 = [
    [4, () => { const a = ri(5, 14), b = ri(3, 20 - a); return mk(a + ' + ' + b + ' = ?', a + b, 'add'); }],
    [4, () => { const a = ri(11, 20), b = ri(2, a - 2); return mk(a + ' - ' + b + ' = ?', a - b, 'sub'); }],
    [2, () => { const c = ri(8, 20), a = ri(2, c - 2); return mk(a + ' + ? = ' + c, c - a, 'add'); }],
    [1, () => { const c = ri(3, 12), b = ri(2, 8); return mk('? - ' + b + ' = ' + c, c + b, 'sub', { extra: [c - b >= 0 ? c - b : c + b + 1] }); }],
    [1, () => { const a = ri(2, 10); return mk(a + ' + ' + a + ' = ?', 2 * a, 'add', { extra: [2 * a + 1] }); }],
    [1, () => { const step = pick([2, 2, 5]), s = step === 5 ? 5 * ri(0, 1) : ri(0, 12); return mk([s, s + step, s + 2 * step].join(', ') + ', ?', s + 3 * step, 'seq'); }],   // stays within 20
    // Story problems are kept to one short line ("Masz 7 jabłek. Dostajesz 5. Ile masz?"):
    // the child should spend the time on the maths, not on reading.
    [1, () => { const noun = pick(NOUNS), a = ri(3, 12), b = ri(2, 20 - a); return mk('Masz ' + nf(a, noun) + '. Dostajesz ' + b + '. Ile masz?', a + b, 'word', { extra: [a - b > 0 ? a - b : a + b + 2] }); }],
    // 'added instead of subtracted' as a wrong option only while it stays within 20
    [1, () => { const noun = pick(NOUNS), a = ri(8, 20), b = ri(2, a - 2); return mk('Masz ' + nf(a, noun) + '. Oddajesz ' + b + '. Ile zostało?', a - b, 'word', { extra: [a + b <= 20 ? a + b : a - b + 2] }); }],
    [1, () => { const noun = pick(NOUNS), a = ri(5, 14), b = ri(2, 20 - a); return mk(nf(a, noun) + ' i ' + nf(b, noun) + '. Ile razem?', a + b, 'word', { extra: [Math.abs(a - b)] }); }],   // total stays within 20
    [1, () => { const a = ri(2, 9), b = ri(1, 9); return mk('Masz ' + a + ' zł. Dostajesz ' + b + ' zł. Ile masz?', a + b, 'money'); }],
  ];

  /* ---------------- Tier 3: + and - within 100 ---------------- */
  const T3 = [
    [2, () => { const a = 10 * ri(1, 6), b = 10 * ri(1, 10 - a / 10); return mk(a + ' + ' + b + ' = ?', a + b, 'add'); }],                    // 30 + 40
    [2, () => { const a = 10 * ri(3, 10), b = 10 * ri(1, a / 10 - 1); return mk(a + ' - ' + b + ' = ?', a - b, 'sub'); }],                  // 90 - 30
    [3, () => { const a = ri(12, 60), b = ri(11, 99 - a); return mk(a + ' + ' + b + ' = ?', a + b, 'add', { extra: [a + b + 10, a + b - 10] }); }],
    [3, () => { const a = ri(30, 99), b = ri(11, a - 5); return mk(a + ' - ' + b + ' = ?', a - b, 'sub', { extra: [a - b + 10, a - b - 10] }); }],
    [2, () => { const a = ri(21, 89), b = ri(2, 9); return R() < 0.5 ? mk(a + ' + ' + b + ' = ?', a + b, 'add', { extra: [a + b - 10] }) : mk(a + ' - ' + b + ' = ?', a - b, 'sub', { extra: [a - b + 10] }); }],
    [2, () => { const c = ri(30, 100), a = ri(11, c - 5); return mk(a + ' + ? = ' + c, c - a, 'add', { extra: [c - a + 10] }); }],
    [1, () => { const noun = pick(NOUNS), a = ri(20, 60), b = ri(11, 99 - a); return mk('Masz ' + nf(a, noun) + '. Dostajesz ' + b + '. Ile masz?', a + b, 'word', { extra: [a + b - 10, a - b > 0 ? a - b : a + b + 10] }); }],
    [1, () => { const noun = pick(NOUNS), a = ri(40, 99), b = ri(11, a - 10); return mk('Masz ' + nf(a, noun) + '. Oddajesz ' + b + '. Ile zostało?', a - b, 'word', { extra: [a - b + 10] }); }],
    [1, () => { const m = pick([20, 50, 100]), p = ri(3, m - 2); return mk('Masz ' + m + ' zł. Wydajesz ' + p + ' zł. Ile zostało?', m - p, 'money', { extra: [m - p + 10, m - p - 10] }); }],
    [1, () => { const s = ri(1, 30), st = pick([3, 4, 5, 10]); return mk([s, s + st, s + 2 * st, s + 3 * st].join(', ') + ', ?', s + 4 * st, 'seq'); }],
  ];

  /* ---------------- Tier 4: × and : within 50 (tables 2, 3, 4, 5, 10) ---------------- */
  const LEGS = [
    { w: ['kot', 'koty', 'kotów'], l: ['łapa', 'łapy', 'łap'], k: 4 },
    { w: ['pająk', 'pająki', 'pająków'], l: ['noga', 'nogi', 'nóg'], k: 8 },
    { w: ['biedronka', 'biedronki', 'biedronek'], l: ['noga', 'nogi', 'nóg'], k: 6 },
    { w: ['trójkąt', 'trójkąty', 'trójkątów'], l: ['bok', 'boki', 'boków'], k: 3 },
    { w: ['kwiatek', 'kwiatki', 'kwiatków'], l: ['płatek', 'płatki', 'płatków'], k: 5 },
    { w: ['rower', 'rowery', 'rowerów'], l: ['koło', 'koła', 'kół'], k: 2 },
  ];
  const legsQ = (maxProduct) => {
    const it = pick(LEGS.filter(x => x.k * 2 <= maxProduct));
    const n = ri(2, Math.min(10, Math.floor(maxProduct / it.k)));
    const W = it.w[0][0].toUpperCase() + it.w[0].slice(1);
    return mk(W + ' ma ' + it.k + ' ' + P(it.k, it.l[0], it.l[1], it.l[2]) + '. Ile ' + it.l[2] + ' ' + P(n, 'ma', 'mają', 'ma') + ' ' + n + ' ' + P(n, it.w[0], it.w[1], it.w[2]) + '?', it.k * n, 'word', { extra: [it.k + n] });
  };
  const shareQ = (maxTotal) => {
    const n = pick(NAMES), b = ri(2, 5), q = ri(2, Math.min(10, Math.floor(maxTotal / b))), a = b * q;
    return mk(a + ' ' + P(a, 'naklejka', 'naklejki', 'naklejek') + ' dla ' + b + ' dzieci po równo. Ile ma każde?', q, 'word', { extra: [a - b] });
  };
  const T4 = [
    [4, () => { const a = pick([2, 3, 4, 5, 10]), b = ri(2, a === 10 ? 5 : 10); return R() < 0.5 ? mk(a + ' · ' + b + ' = ?', a * b, 'mul', { extra: [a + b, a * b + a] }) : mk(b + ' · ' + a + ' = ?', a * b, 'mul', { extra: [a + b, a * b - b] }); }],
    [3, () => { const b = pick([2, 3, 4, 5, 10]), q = ri(2, b === 10 ? 5 : 10); return mk((b * q) + ' : ' + b + ' = ?', q, 'div', { extra: [q + 1, b * q - b] }); }],
    [1, () => { const a = ri(2, 10); return mk('Połowa z ' + (2 * a) + ' to?', a, 'div', { extra: [2 * a - 2, a + 2] }); }],
    [1, () => legsQ(50)],
    [1, () => shareQ(50)],
    [3, () => U.wpick(R, T3)()],   // keep practising + and - to 100 at this level too
  ];

  /* ---------------- Tier 5: the full times table to 100 ---------------- */
  const T5 = [
    [5, () => { const a = ri(2, 10), b = ri(2, 10); return mk(a + ' · ' + b + ' = ?', a * b, 'mul', { extra: [a + b, a * b + a, a * b - b] }); }],
    [4, () => { const b = ri(2, 10), q = ri(2, 10); return mk((b * q) + ' : ' + b + ' = ?', q, 'div', { extra: [b * q - b, q + 1] }); }],
    [1, () => { const b = ri(2, 9), q = ri(2, 9), c = b * q; return mk(b + ' · ? = ' + c, q, 'mul', { extra: [c - b, q + 1] }); }],
    [1, () => legsQ(100)],
    [1, () => shareQ(100)],
    [1, () => {
      const it = pick([['Lizak', 'lizaki', 'lizaków'], ['Bilet', 'bilety', 'biletów'], ['Zeszyt', 'zeszyty', 'zeszytów']]), p = ri(2, 10), n = ri(2, 9);
      return mk(it[0] + ' to ' + p + ' zł. Ile za ' + n + ' ' + P(n, it[0].toLowerCase(), it[1], it[2]) + '?', p * n, 'money', { extra: [p + n, p * n + p] });
    }],
    [1, () => { const st = ri(3, 9); return mk([st, 2 * st, 3 * st, 4 * st].join(', ') + ', ?', 5 * st, 'seq'); }],
  ];

  const TIERS = [null, T1, T2, T3, T4, T5];

  /*
   * Pick a tier around the current skill with a little randomness,
   * so a player at 2.4 mostly gets tier 2 with the occasional tier 1
   * (a confidence boost) or tier 3 (a stretch) - always inside the band.
   */
  function tierFor(skill, band) {
    const lo = band ? band.min : 1, hi = band ? band.max : 5.99;
    const s = U.clamp(skill + (R() * 0.9 - 0.5), lo, hi);
    return U.clamp(Math.floor(s), 1, 5);
  }

  /* ------------------------------------------------------------------
   * Extra short formats, so the same kind of task doesn't keep coming back.
   * All are pure maths with almost no reading:
   *   "? + 3 = 7"           missing first number
   *   "Który znak? 8 ? 3 = 5"   pick the operation (+ - × :)
   *   "Co jest po 39?"      number neighbours
   *   "Co jest większe?"    an expression vs a number
   *   "Która para daje 10?" / "Które daje 24?"  pick the expression
   * Expression options are written compactly ("3+7", "6·7") so they fit
   * on the answer blocks.
   * ------------------------------------------------------------------ */
  const OPS = { '+': (a, b) => a + b, '-': (a, b) => a - b, '·': (a, b) => a * b, ':': (a, b) => (b && a % b === 0) ? a / b : NaN };
  // "Który znak?" - only offered when exactly one sign gives the result
  function whichSign(a, b, ops) {
    const good = ops.filter(o => OPS[o](a, b) >= 0);
    const o = pick(good), r = OPS[o](a, b);
    const valid = ops.filter(x => OPS[x](a, b) === r);
    if (valid.length !== 1 || r < 0 || r > 100 || !Number.isInteger(r)) return null;
    return mk('Który znak? ' + a + ' ? ' + b + ' = ' + r, o, o === '+' ? 'add' : o === '-' ? 'sub' : o === '·' ? 'mul' : 'div', { choices: [o].concat(U.shuffle(R, ops.filter(x => x !== o)).slice(0, 2)) });   // max 3 options: gates have 3 blocks
  }
  function retry(fn) { for (let i = 0; i < 20; i++) { const q = fn(); if (q) return q; } return null; }
  // pick-the-expression: one option hits the target, the others miss by a little
  function whichGives(target, makeRight, makeWrong, sym, topic, title) {
    const right = makeRight(), wrongs = [];
    for (let i = 0; i < 40 && wrongs.length < 2; i++) {
      const w = makeWrong();
      const v = sym === '+' ? w[0] + w[1] : w[0] * w[1];
      const lbl = w[0] + sym + w[1];
      // both parts must be positive whole numbers ('9+-1' must never appear)
      if (w[0] >= 1 && w[1] >= 1 && v !== target && !wrongs.includes(lbl) && lbl !== right) wrongs.push(lbl);
    }
    if (wrongs.length < 2) return null;
    return mk(title, right, topic, { choices: [right].concat(wrongs) });
  }
  const next = (lo, hi) => () => { const n = ri(lo, hi); return R() < 0.5 ? mk('Co jest po ' + n + '?', n + 1, 'count', { extra: [n - 1, n + 10] }) : mk('Co jest przed ' + (n + 1) + '?', n, 'count', { extra: [n + 2, n + 1 - 10] }); };
  const missingFirst = (max, sym) => () => {
    if (sym === '+') { const c = ri(Math.min(8, max), max), b = ri(1, c - 1); return mk('? + ' + b + ' = ' + c, c - b, 'add', { extra: [c + b] }); }
    const b = ri(2, Math.floor(max / 3)), c = ri(1, max - b); return mk('? - ' + b + ' = ' + c, c + b, 'sub', { extra: [c - b >= 0 ? c - b : c + b + 1] });
  };
  const bigger = (mkExpr) => () => {
    const [lbl, v] = mkExpr();
    let n = v + pick([-2, -1, 1, 2, 3]); if (n < 0) n = v + 2;
    if (v <= 20 && n > 20) n = v - 2;   // stay within 20 on the easy level
    return mk('Co jest większe?', v > n ? lbl : String(n), 'compare', { choices: [lbl, String(n)] });
  };
  const addExpr = (max) => () => { const a = ri(1, max - 1), b = ri(1, max - a); return [a + '+' + b, a + b]; };
  const mulExpr = (tables) => () => { const a = pick(tables), b = ri(2, 10); return [a + '·' + b, a * b]; };
  const pairFor = (target) => whichGives(target, () => { const a = ri(1, target - 1); return a + '+' + (target - a); },
    () => { const a = ri(1, target - 1); return [a, target - a + pick([-2, -1, 1, 2])]; }, '+', 'add', 'Która para daje ' + target + '?');
  const productFor = (tables) => { const a = pick(tables), b = ri(2, 10), t = a * b;
    return whichGives(t, () => a + '·' + b, () => { const x = ri(2, 10); return [x, ri(2, 10)]; }, '·', 'mul', 'Które daje ' + t + '?'); };

  T1.push(
    [2, missingFirst(10, '+')],
    [1, () => retry(() => whichSign(ri(2, 9), ri(1, 5), ['+', '-']))],
    [1, next(1, 18)],
    [1, bigger(addExpr(10))],
    [1, () => retry(() => pairFor(pick([5, 6, 7, 8, 9, 10])))],
  );
  T2.push(
    [1, missingFirst(20, '+')],
    [1, missingFirst(20, '-')],
    [1, () => retry(() => whichSign(ri(8, 18), ri(2, 9), ['+', '-']))],
    [1, bigger(addExpr(20))],
    [1, () => retry(() => pairFor(pick([10, 12, 15, 18, 20])))],
  );
  T3.push(
    [1, next(19, 98)],
    [1, missingFirst(100, '+')],
    [1, () => retry(() => whichSign(ri(20, 80), ri(5, 20), ['+', '-']))],
    [1, () => { const d = ri(1, 9); return mk('Ile dziesiątek ma ' + (10 * d) + '?', d, 'count', { extra: [10 * d, d + 1] }); }],
    [1, () => retry(() => pairFor(pick([30, 40, 50, 60, 100])))],
  );
  T4.push(
    [2, () => retry(() => whichSign(pick([2, 3, 4, 5, 10]) * ri(2, 5), pick([2, 3, 4, 5]), ['+', '-', '·', ':']))],
    [1, () => { const b = pick([2, 3, 4, 5, 10]), q = ri(2, 5); return mk('? : ' + b + ' = ' + q, b * q, 'div', { extra: [b + q, b * q + b] }); }],
    [2, () => retry(() => productFor([2, 3, 4, 5]))],
    [1, bigger(mulExpr([2, 3, 4, 5]))],
  );
  T5.push(
    [2, () => retry(() => whichSign(ri(2, 10) * ri(2, 9), ri(2, 9), ['+', '-', '·', ':']))],
    [1, () => { const b = ri(3, 9), q = ri(2, 9); return mk('? : ' + b + ' = ' + q, b * q, 'div', { extra: [b + q, b * q - b] }); }],
    [2, () => retry(() => productFor([3, 4, 6, 7, 8, 9]))],
    [1, bigger(mulExpr([6, 7, 8, 9]))],
  );

  /*
   * Anti-repetition. The generator remembers recent questions and:
   *   - never repeats an exact question from the last 40,
   *   - never gives the same KIND of task twice in a row
   *     (e.g. two "a + b = ?" in a row),
   *   - prefers kinds it hasn't used for a while (soft rotation).
   * Kinds are "tier:index" of the template that made the question.
   */
  const hist = { texts: [], kinds: [], tmpl: [] };
  // What the child perceives as "the same kind of task": the question's shape
  // with numbers and nouns blanked out, e.g. "# + # = ?", "Masz # X. Dostajesz".
  // (Two different templates that print "# + # = ?" count as one kind.)
  const NOUN_FORMS = new RegExp('\\b(' + NOUNS.flat().join('|') + ')\\b', 'g');
  const kindOf = q => q.q.replace(/\d+/g, '#').replace(NOUN_FORMS, 'X').split(' ').slice(0, 3).join(' ');
  // exact repeat = same text AND same options (e.g. "Co jest większe?" with other numbers is new)
  // A question with numbers in it ('6 + 2 = ?') is the same question whatever the wrong
  // options are; only number-less texts ('Co jest większe?') are told apart by their options.
  const idOf = q => /\d/.test(q.q) ? q.q : q.q + '|' + q.choices.slice().sort().join(',');
  function resetHistory() { hist.texts.length = 0; hist.kinds.length = 0; hist.tmpl.length = 0; lastChallenge = null; }
  function question(skill, band) {
    let best = null;
    for (let attempt = 0; attempt < 25; attempt++) {
      const t = tierFor(skill, band);
      const list = TIERS[t];
      // weight kinds by how long ago we used them (unused lately = more likely)
      const weighted = list.map((e, i) => {
        const ago = hist.tmpl.lastIndexOf(t + ':' + i);
        const age = ago < 0 ? 12 : hist.tmpl.length - ago;
        return [e[0] * Math.min(3, 0.4 + age / 4), i];
      });
      const i = U.wpick(R, weighted);
      const q = list[i][1]();
      if (!q) continue;
      q.tier = t; q.tmpl = t + ':' + i; q.kind = kindOf(q);
      if (!best) best = q;
      const k = hist.kinds;
      if (k[k.length - 1] === q.kind) continue;                                  // never the same kind twice in a row
      if (attempt < 15 && k.slice(-4).filter(x => x === q.kind).length >= 2) continue;  // and not more than 2 of the last 5
      if (hist.texts.includes(idOf(q))) continue;                                 // never an exact repeat of the last 40
      best = q; break;
    }
    hist.texts.push(idOf(best)); if (hist.texts.length > 40) hist.texts.shift();
    hist.kinds.push(best.kind); if (hist.kinds.length > 40) hist.kinds.shift();
    hist.tmpl.push(best.tmpl); if (hist.tmpl.length > 40) hist.tmpl.shift();
    return best;
  }

  /*
   * "Collect the numbers" challenges. Each returns bubbles (labels) and a
   * small rule object the game uses to judge every pickup:
   *   kind 'sum'   - pick bubbles until the total equals the target
   *   kind 'set'   - pick every "good" bubble (even/odd, multiples);
   *                  bad bubbles just bounce off with a friendly explanation
   *   kind 'order' - pick bubbles from smallest to biggest
   */
  let lastChallenge = null;
  const challengeKey = c => c.kind + (/parzyste/.test(c.title) ? '-parity' : /tabliczki/.test(c.title) ? '-table' : '');
  function challenge(skill, band) {
    const t = tierFor(skill, band);
    const opts = [];
    // SUM: build a guaranteed solution first, then add distractors. Target stays within 100.
    opts.push(() => {
      const parts = t <= 1 ? 2 : 3;
      const maxN = [0, 5, 7, 30, 30, 30][t];
      const sol = []; for (let i = 0; i < parts; i++) sol.push(ri(1, maxN));
      const target = sol.reduce((s, v) => s + v, 0);
      const extra = []; while (extra.length < (t <= 1 ? 2 : 3)) extra.push(ri(1, maxN));
      return { kind: 'sum', title: 'Zbierz liczby: razem ' + target, target, labels: U.shuffle(R, sol.concat(extra)).map(String), topic: 'collect' };
    });
    if (t <= 3) {
      opts.push(() => {
        const even = R() < 0.5, max = t <= 2 ? 20 : 100, labels = [];
        const goodCount = ri(3, 4);
        while (labels.filter(v => (v % 2 === 0) === even).length < goodCount) { const v = ri(1, max); if (!labels.includes(v) && (v % 2 === 0) === even) labels.push(v); }
        while (labels.length < goodCount + 3) { const v = ri(1, max); if (!labels.includes(v) && (v % 2 === 0) !== even) labels.push(v); }
        return {
          kind: 'set', title: 'Zbierz liczby ' + (even ? 'parzyste' : 'nieparzyste'), labels: U.shuffle(R, labels).map(String),
          good: v => (+v % 2 === 0) === even, whyBad: v => v + ' to liczba ' + (even ? 'nieparzysta' : 'parzysta') + '!', topic: 'collect',
        };
      });
      opts.push(() => {
        const labels = []; const max = t === 1 ? 20 : t === 2 ? 30 : 100;
        while (labels.length < 5) { const v = ri(0, max); if (!labels.includes(v)) labels.push(v); }
        return { kind: 'order', title: 'Od najmniejszej do największej', labels: U.shuffle(R, labels).map(String), sorted: labels.slice().sort((a, b) => a - b).map(String), topic: 'collect' };
      });
    }
    if (t >= 4) {
      // multiples = the times table in disguise; products stay within 100
      opts.push(() => {
        const k = t === 4 ? pick([2, 3, 4, 5, 10]) : ri(3, 9); const labels = [];
        while (labels.length < 4) { const v = k * ri(1, Math.floor(100 / k)); if (!labels.includes(v)) labels.push(v); }
        while (labels.length < 7) { const v = ri(1, 100); if (v % k !== 0 && !labels.includes(v)) labels.push(v); }
        return { kind: 'set', title: 'Zbierz liczby z tabliczki × ' + k, labels: U.shuffle(R, labels).map(String), good: v => +v % k === 0, whyBad: v => v + ' nie dzieli się przez ' + k + '.', topic: 'collect' };
      });
    }
    // never the same kind of challenge twice in a row
    let c = pick(opts)();
    for (let i = 0; i < 10 && lastChallenge && challengeKey(c) === lastChallenge; i++) c = pick(opts)();
    lastChallenge = challengeKey(c);
    c.tier = t;
    return c;
  }

  /* Price question for the shop's "promocja" (discount) offers: plain subtraction. */
  function discountQuestion(price, skill) {
    // young players: round discounts (10, 20, 30); older: any amount
    const off = skill < 3 ? Math.min(price - 10, pick([10, 20, 30])) : Math.min(price - 10, 10 + ri(1, 40));
    return { off, q: 'Cena ' + price + ', taniej o ' + off + '. Ile zapłacisz?', a: String(price - off), choices: numChoices(price - off, [price + off, price - off + 10]).filter(c => +c >= 0), topic: 'money' };
  }

  LZ.M = { question, challenge, discountQuestion, TOPICS, numChoices, resetHistory };
})();
