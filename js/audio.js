/*
 * audio.js - 8-bit "chiptune" sound effects and music, synthesised live
 * with the Web Audio API. No audio files: the download stays tiny, it
 * works offline, and every world gets its own tune generated from a seed.
 *
 * The sound is modelled on classic 8-bit consoles (the Mario era):
 *   - two PULSE channels with narrow duty cycles (12.5% / 25% / 50%) -
 *     that thin, buzzy "NES" tone - for melody and most effects,
 *   - a TRIANGLE channel for bass and soft "boing" sounds,
 *   - a NOISE channel for drums, thuds and whooshes.
 * Pitch sweeps and super-fast arpeggios (stepping notes every ~40 ms)
 * give the recognisable retro feel. All effects and tunes are original.
 *
 * Browsers only allow audio after a user gesture, so LZ.A.unlock() is
 * called from the first tap/keypress.
 */
(function () {
  let ctx = null, master = null, musicGain = null, sfxGain = null;
  let musicTimer = null, musicSong = null, nextNoteTime = 0, step = 0;
  let PULSE = {}, noiseBuf = null;
  // Extra gain for the effect being played, so every effect ends up at a
  // similar loudness (measured by rendering each one offline and scaling to
  // a common peak). Without it the jump was ~8x quieter than the shop 'ding'.
  let curGain = 1;
  const LEVEL = { jump: 5, djump: 3.5, coin: 4.4, stomp: 2.2, bump: 2.9, block: 4.4, sprout: 5, power: 4.4, heart: 4.4, star: 5, hurt: 4.4, fall: 5,
    correct: 1.35, wrong: 1.9, gate: 5, bosshit: 1.6, throw: 5, click: 3, pop: 2.5, spring: 1.5, checkpoint: 4.4, pause: 5, flag: 5, win: 1.1, buy: 0.7, splash: 3.5, break: 2, cannon: 1.8, warp: 4 };

  function unlock() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    // gentle compressor so many overlapping bleeps never clip on phone speakers
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master = ctx.createGain(); master.gain.value = 0.9;
    master.connect(comp); comp.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.connect(master);
    buildWaves();
    applyVolumes();
    if (pendingSong != null) playMusic(pendingSong);
  }
  function applyVolumes() {
    if (!ctx) return;
    const s = LZ.S.data.settings;
    musicGain.gain.value = 0.32 * s.music;
    sfxGain.gain.value = 1.0 * s.sfx;
  }

  /*
   * Pulse waves with a given duty cycle, built from their Fourier series.
   * A 12.5% pulse is the thin, nasal lead tone of 8-bit games; 50% is a
   * plain square. Built once, reused by every note.
   */
  function buildWaves() {
    for (const duty of [0.125, 0.25, 0.5]) {
      const n = 64, re = new Float32Array(n), im = new Float32Array(n);
      for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
      PULSE[duty] = ctx.createPeriodicWave(re, im);
    }
    const len = ctx.sampleRate;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  const midi = n => 440 * Math.pow(2, (n - 69) / 12);

  /*
   * One note. `wave` is 12.5 / 25 / 50 (pulse duty %), 'tri' or 'sine'.
   * opts.slide: glide to this frequency; opts.vib: vibrato depth in Hz;
   * the envelope is a quick attack and an 8-bit-style fast decay.
   */
  function note(freq, t, dur, wave, vol, dest, opts) {
    opts = opts || {};
    const o = ctx.createOscillator(), g = ctx.createGain();
    if (wave === 'tri') o.type = 'triangle';
    else if (wave === 'sine') o.type = 'sine';
    else o.setPeriodicWave(PULSE[(wave || 50) / 100] || PULSE[0.5]);
    o.frequency.setValueAtTime(freq, t);
    if (opts.slide) o.frequency.exponentialRampToValueAtTime(opts.slide, t + (opts.slideT || dur));
    if (opts.vib) {
      const l = ctx.createOscillator(), lg = ctx.createGain();
      l.frequency.value = opts.vibRate || 14; lg.gain.value = opts.vib;
      l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.05);
    }
    g.gain.setValueAtTime(0.0001, t);
    if (!dest) vol *= curGain;   // sound effects get their balancing gain; music doesn't
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    if (opts.hold) g.gain.setValueAtTime(vol, t + dur * opts.hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || sfxGain);
    o.start(t); o.stop(t + dur + 0.05);
  }
  /* Fast arpeggio: notes (MIDI) played one after another every `gap` seconds. */
  function arp(notes, t, gap, wave, vol, dur, dest) {
    notes.forEach((n, i) => note(midi(n), t + i * gap, dur || gap * 1.6, wave, vol, dest));
  }
  /* Noise burst through a filter - drums, thuds, whooshes. */
  function noise(t, dur, vol, dest, freq, type, sweepTo) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    src.playbackRate.value = 0.5 + Math.random();
    const f = ctx.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.setValueAtTime(freq || 3000, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = ctx.createGain();
    if (!dest) vol *= curGain;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest || sfxGain);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
  }

  /*
   * Sound effects. Each is an original 8-bit design in the classic
   * platformer spirit: rising pulse sweep for a jump, a bright two-note
   * "bling" for coins, a pop-and-rise for ?-blocks, and so on.
   */
  const SFX = {
    // rising 25% pulse sweep - the classic jump
    jump: t => note(260, t, 0.2, 25, 0.13, null, { slide: 820, slideT: 0.14 }),
    djump: t => { note(420, t, 0.17, 12.5, 0.12, null, { slide: 1250, slideT: 0.12 }); arp([84, 88, 91], t + 0.05, 0.035, 12.5, 0.05); },
    // short high blip then a longer ringing note
    coin: t => { note(midi(86), t, 0.06, 50, 0.11); note(midi(91), t + 0.055, 0.32, 50, 0.11, null, { hold: 0.3 }); },
    // squash: quick downward square + noise click
    stomp: t => { note(520, t, 0.13, 50, 0.14, null, { slide: 110 }); noise(t, 0.06, 0.18, null, 2500); },
    // head hits a solid block: dull low thud
    bump: t => { note(150, t, 0.09, 50, 0.13, null, { slide: 90 }); noise(t, 0.07, 0.14, null, 900); },
    // ?-block gives a coin/item: pop + little rising arpeggio
    block: t => { noise(t, 0.04, 0.12, null, 4000); arp([72, 76, 79, 84], t + 0.02, 0.04, 25, 0.09); },
    // power-up sprouting out of a block: slow rising wobble
    sprout: t => { for (let i = 0; i < 10; i++) note(midi(60 + i * 2), t + i * 0.06, 0.08, 50, 0.07, null, { vib: 20 }); },
    // power-up collected: very fast multi-octave arpeggio
    power: t => arp([60, 64, 67, 72, 76, 79, 84, 88, 91, 96], t, 0.035, 12.5, 0.09, 0.07),
    // heart = extra life feel: happy six-note jingle
    heart: t => arp([79, 83, 86, 91, 95, 98], t, 0.08, 25, 0.1, 0.14),
    star: t => { arp([88, 91, 96, 100, 103, 108], t, 0.05, 12.5, 0.09, 0.12); arp([88, 91, 96, 100, 103, 108], t + 0.32, 0.05, 12.5, 0.035, 0.12); },
    // ouch: wobbling fall in pitch
    hurt: t => note(900, t, 0.42, 50, 0.1, null, { slide: 140, vib: 40, vibRate: 22 }),
    // falling into a pit: long "whistle down"
    fall: t => note(1200, t, 0.75, 12.5, 0.1, null, { slide: 120 }),
    // correct maths answer: bright rising fanfare with bass
    correct: t => { arp([72, 76, 79, 84], t, 0.07, 25, 0.12, 0.2); note(midi(48), t, 0.35, 'tri', 0.2); note(midi(96), t + 0.28, 0.35, 12.5, 0.07, null, { vib: 8 }); },
    // wrong answer: soft, friendly "uh-oh" (never harsh for kids)
    wrong: t => { note(midi(62), t, 0.16, 'tri', 0.2); note(midi(57), t + 0.15, 0.3, 'tri', 0.2, null, { vib: 5 }); },
    // maths gate sliding open: rumble + falling square
    gate: t => { noise(t, 0.8, 0.14, null, 500, 'lowpass', 120); note(160, t, 0.8, 50, 0.05, null, { slide: 60 }); },
    bosshit: t => { noise(t, 0.4, 0.25, null, 2500, 'lowpass', 200); note(300, t, 0.35, 50, 0.14, null, { slide: 55 }); },
    // boss throws something
    throw: t => noise(t, 0.22, 0.1, null, 600, 'bandpass', 3000),
    click: t => note(midi(96), t, 0.04, 50, 0.06),
    pop: t => note(600, t, 0.09, 'sine', 0.15, null, { slide: 1400 }),
    // bouncy "boing"
    spring: t => note(180, t, 0.35, 'tri', 0.25, null, { slide: 820, slideT: 0.18, vib: 30, vibRate: 18 }),
    checkpoint: t => arp([79, 84, 88], t, 0.09, 25, 0.1, 0.2),
    pause: t => { note(midi(88), t, 0.08, 50, 0.1); note(midi(84), t + 0.09, 0.08, 50, 0.1); note(midi(88), t + 0.18, 0.08, 50, 0.1); note(midi(84), t + 0.27, 0.14, 50, 0.1); },
    // grabbing the goal flag: descending pulse glissando while sliding down
    flag: t => { for (let i = 0; i < 16; i++) note(midi(96 - i * 2), t + i * 0.055, 0.07, 12.5, 0.07); },
    // level clear: original 8-bit fanfare (lead + harmony + bass + drums)
    win: t => {
      const lead = [[67, 0], [72, 0.12], [76, 0.24], [79, 0.36], [84, 0.5], [79, 0.7], [84, 0.84], [88, 1.0]];
      lead.forEach(([n, d]) => { note(midi(n), t + d, 0.22, 25, 0.1); note(midi(n - 5), t + d, 0.2, 12.5, 0.04); });
      [[48, 0], [55, 0.36], [53, 0.7], [48, 1.0]].forEach(([n, d]) => note(midi(n), t + d, 0.4, 'tri', 0.22));
      [0, 0.36, 0.7, 1.0].forEach(d => noise(t + d, 0.05, 0.08, null, 7000, 'highpass'));
      note(midi(88), t + 1.0, 0.9, 25, 0.08, null, { vib: 7, hold: 0.5 });
    },
    buy: t => { arp([84, 88, 91, 96], t, 0.05, 50, 0.1, 0.1); noise(t + 0.2, 0.1, 0.08, null, 6000, 'highpass'); },
    // brick smashed: crunchy noise + tumbling low notes
    break: t => { noise(t, 0.22, 0.25, null, 2200, 'lowpass', 300); [0, 0.05, 0.1].forEach((d, i) => note(midi(52 - i * 5), t + d, 0.08, 50, 0.1)); },
    // cannon fires: low thump + puff
    cannon: t => { note(110, t, 0.2, 50, 0.16, null, { slide: 45 }); noise(t, 0.25, 0.2, null, 900, 'lowpass', 150); },
    // warp into a stump: descending "bloop-bloop-bloop"
    warp: t => { for (let i = 0; i < 3; i++) note(midi(76 - i * 5), t + i * 0.16, 0.15, 25, 0.12, null, { slide: midi(64 - i * 5) }); },
    splash: t => { noise(t, 0.32, 0.18, null, 1400, 'bandpass', 300); note(500, t, 0.12, 'sine', 0.06, null, { slide: 1100 }); },
  };
  const lastPlay = {};
  function play(name) {
    if (!ctx || !SFX[name] || !noiseBuf) return;
    // Don't stack the same sound 20 times when the magnet grabs 20 coins.
    const now = ctx.currentTime;
    if (lastPlay[name] && now - lastPlay[name] < 0.035) return;
    lastPlay[name] = now;
    curGain = LEVEL[name] || 1;
    SFX[name](now + 0.01);
    curGain = 1;
  }

  /*
   * Music: a generated chiptune per world, like a 4-channel 8-bit console:
   *   pulse 25%   - lead melody (major pentatonic, so it's always cheerful)
   *   pulse 12.5% - quick chord arpeggios on the off-beats
   *   triangle    - bouncing octave bass
   *   noise       - kick / hi-hat / snare pattern
   * Chords loop I-V-vi-IV. Boss levels use a faster minor-flavoured loop.
   * The seed makes it the same tune every time you enter that world.
   */
  const PENTA = [0, 2, 4, 7, 9];
  const PROG = [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]];
  const PROG_BOSS = [[0, 3, 7], [8, 12, 15], [5, 8, 12], [7, 11, 14]];
  function makeSong(seed) {
    const r = LZ.U.rng(seed * 7919 + 13);
    const boss = seed >= 100;
    const root = 60 + [0, 2, -3, 5, -1, 3, 0][seed % 7];
    const tempo = boss ? 150 : 124 + Math.floor(r() * 22);
    const scale = boss ? [0, 3, 5, 7, 10] : PENTA;
    const melody = [];
    let idx = 5;
    for (let bar = 0; bar < 8; bar++) {
      for (let i = 0; i < 8; i++) {
        // rests on some off-beats give the bouncy, syncopated platformer feel
        if (r() < 0.28 && i % 2 === 1) { melody.push(null); continue; }
        idx += Math.floor(r() * 5) - 2;
        idx = Math.max(2, Math.min(11, idx));
        const oct = Math.floor(idx / 5), deg = idx % 5;
        melody.push(root + scale[deg] + 12 * oct - 12);
      }
    }
    // bars 5-8 echo bars 1-4 with small changes, so the tune is catchy
    for (let i = 32; i < 64; i++) if (r() < 0.7) melody[i] = melody[i - 32];
    return { root, tempo, melody, prog: boss ? PROG_BOSS : PROG, boss };
  }
  let pendingSong = null;
  function playMusic(seed) {
    pendingSong = seed;
    if (!ctx) return;
    if (musicSong && musicSong.seed === seed) return;
    stopMusic();
    musicSong = makeSong(seed); musicSong.seed = seed;
    step = 0; nextNoteTime = ctx.currentTime + 0.1;
    musicTimer = setInterval(schedule, 40);
  }
  function stopMusic() {
    if (musicTimer) clearInterval(musicTimer);
    musicTimer = null; musicSong = null;
  }
  function schedule() {
    if (!ctx || !musicSong) return;
    const S = musicSong, spb = 60 / S.tempo / 2; // eighth notes
    while (nextNoteTime < ctx.currentTime + 0.25) {
      const s = step % 64, bar = Math.floor(s / 8) % 4, chord = S.prog[bar], t = nextNoteTime;
      // lead
      const m = S.melody[s];
      if (m != null) note(midi(m + 12), t, spb * 1.5, 25, 0.075, musicGain, { hold: 0.4 });
      // off-beat chord stabs as a fast 12.5% arpeggio
      if (s % 2 === 1) chord.forEach((c, i) => note(midi(S.root + c), t + i * 0.018, spb * 0.7, 12.5, 0.022, musicGain));
      // triangle bass: root on the beat, octave on the "and"
      const bassN = S.root - 24 + chord[0];
      note(midi(s % 2 === 0 ? bassN : bassN + 12), t, spb * 0.9, 'tri', 0.2, musicGain, { hold: 0.5 });
      // drums: kick on 1 & 5, snare on 3 & 7, hi-hat on every eighth
      const b8 = s % 8;
      if (b8 === 0 || b8 === 4 || (S.boss && b8 === 6)) { noise(t, 0.09, 0.2, musicGain, 180); note(120, t, 0.08, 'sine', 0.2, musicGain, { slide: 50 }); }
      if (b8 === 2 || b8 === 6) noise(t, 0.1, 0.1, musicGain, 3000, 'bandpass');
      noise(t, 0.025, 0.035, musicGain, 8000, 'highpass');
      nextNoteTime += spb; step++;
    }
  }

  // _sfx is exposed only so the automated test can render every effect offline
  LZ.A = { unlock, play, playMusic, stopMusic, applyVolumes, _sfx: SFX, _render: (name, t) => { curGain = LEVEL[name] || 1; SFX[name](t); curGain = 1; } };
})();

/*
 * Read-aloud for maths questions (Web Speech API, Polish voice).
 * A 7-year-old reads slowly; hearing "siedem plus jeden, ile to jest?"
 * keeps the game about maths rather than about reading. On by default for
 * Poziom 1 profiles, switchable in Ustawienia. Silently does nothing if the
 * device has no speech engine.
 */
(function () {
  const synth = window.speechSynthesis;
  let voice = null;
  function pickVoice() {
    if (!synth) return;
    const vs = synth.getVoices();
    voice = vs.find(v => /^pl/i.test(v.lang) && /google/i.test(v.name)) || vs.find(v => /^pl/i.test(v.lang)) || null;
  }
  if (synth) { pickVoice(); synth.onvoiceschanged = pickVoice; }

  // Turn maths notation into words a speech engine pronounces correctly.
  function toSpeech(t) {
    // new short formats first, so the generic rules below don't mangle them
    let m;
    if ((m = t.match(/^Który znak\? (\d+) \? (\d+) = (\d+)$/))) return 'Jaki znak wstawić między ' + m[1] + ' a ' + m[2] + ', żeby wyszło ' + m[3] + '?';
    if ((m = t.match(/^\? ([+\-·:]) (\d+) = (\d+)$/))) t = 'Ile ' + m[1] + ' ' + m[2] + ' daje ' + m[3] + '?';
    return t
      .replace(/\(-(\d+)\)/g, 'minus $1')
      .replace(/(\d)x/g, '$1 iks').replace(/\bx\b/g, 'iks')
      .replace(/√(\d+)/g, 'pierwiastek z $1')
      .replace(/(\d+)²/g, '$1 do kwadratu').replace(/(\d+)³/g, '$1 do sześcianu')
      .replace(/(\d+)\/(\d+)/g, '$1 przez $2')
      .replace(/%/g, ' procent')
      .replace(/ · /g, ' razy ').replace(/ : /g, ' podzielić przez ')
      .replace(/ \+ /g, ' plus ').replace(/ - /g, ' minus ').replace(/^-(\d)/, 'minus $1')
      .replace(/ ?= \?/g, ', ile to jest?').replace(/ = /g, ' równa się ')
      .replace(/\?\s*$/, '?');
  }
  function say(text) {
    const p = LZ.S.active();
    if (!synth || !p || !p.readAloud || !text) return;
    try {
      synth.cancel();
      const u = new SpeechSynthesisUtterance(toSpeech(text));
      u.lang = 'pl-PL'; if (voice) u.voice = voice;
      u.rate = 0.92; u.pitch = 1.1;
      u.volume = Math.max(0.3, LZ.S.data.settings.sfx);
      synth.speak(u);
    } catch (e) { /* no speech on this device - fine */ }
  }
  function stop() { try { synth && synth.cancel(); } catch (e) {} }
  LZ.Speech = { say, stop, toSpeech, available: !!synth };
})();
