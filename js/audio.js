/*
 * audio.js - sound effects and background music, all synthesised with the
 * Web Audio API. No audio files: keeps the download tiny, works offline,
 * and every world can get its own tune generated from a seed.
 *
 * Browsers only allow audio after a user gesture, so LZ.A.unlock() is called
 * from the first tap/keypress.
 */
(function () {
  let ctx = null, master = null, musicGain = null, sfxGain = null;
  let musicTimer = null, musicSong = null, nextNoteTime = 0, step = 0;

  function unlock() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.connect(master);
    applyVolumes();
    if (pendingSong != null) playMusic(pendingSong);
  }
  function applyVolumes() {
    if (!ctx) return;
    const s = LZ.S.data.settings;
    musicGain.gain.value = 0.22 * s.music;
    sfxGain.gain.value = 0.5 * s.sfx;
  }

  /* One enveloped oscillator note - the building block of every sound. */
  function tone(freq, t, dur, type, vol, dest, slideTo) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'triangle';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || sfxGain);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(t, dur, vol, dest, filterFreq) {
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq || 3000;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(dest || sfxGain);
    src.start(t);
  }
  const midi = n => 440 * Math.pow(2, (n - 69) / 12);

  /* Sound effects - short, bright, never harsh (it's for kids). */
  const SFX = {
    jump: t => tone(330, t, 0.16, 'square', 0.12, null, 660),
    djump: t => tone(520, t, 0.16, 'square', 0.1, null, 1040),
    coin: t => { tone(988, t, 0.07, 'square', 0.1); tone(1319, t + 0.06, 0.18, 'square', 0.1); },
    stomp: t => { tone(260, t, 0.14, 'square', 0.14, null, 90); noise(t, 0.08, 0.15, null, 1500); },
    hurt: t => { tone(440, t, 0.3, 'sawtooth', 0.08, null, 150); },
    bump: t => tone(150, t, 0.1, 'square', 0.12, null, 110),
    block: t => { tone(700, t, 0.08, 'square', 0.08); tone(1050, t + 0.05, 0.12, 'triangle', 0.08); },
    correct: t => [60, 64, 67, 72].forEach((n, i) => tone(midi(n + 12), t + i * 0.07, 0.25, 'triangle', 0.16)),
    wrong: t => { tone(midi(55), t, 0.18, 'triangle', 0.13); tone(midi(52), t + 0.16, 0.28, 'triangle', 0.13); },
    power: t => [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => tone(midi(67 + n), t + i * 0.05, 0.12, 'square', 0.07)),
    star: t => [0, 7, 12, 16, 19, 24].forEach((n, i) => tone(midi(76 + n), t + i * 0.06, 0.2, 'triangle', 0.12)),
    gate: t => { tone(110, t, 0.8, 'sawtooth', 0.06, null, 55); noise(t, 0.7, 0.08, null, 600); },
    bosshit: t => { tone(180, t, 0.4, 'square', 0.16, null, 60); noise(t, 0.35, 0.2, null, 1200); },
    click: t => tone(880, t, 0.05, 'triangle', 0.08),
    pop: t => tone(600, t, 0.08, 'sine', 0.15, null, 1200),
    spring: t => tone(200, t, 0.3, 'sine', 0.18, null, 900),
    win: t => [[60, 0], [64, 0.12], [67, 0.24], [72, 0.36], [67, 0.52], [72, 0.64]].forEach(([n, d]) => { tone(midi(n + 12), t + d, 0.3, 'square', 0.08); tone(midi(n), t + d, 0.3, 'triangle', 0.1); }),
    buy: t => [72, 76, 79, 84].forEach((n, i) => tone(midi(n), t + i * 0.06, 0.2, 'triangle', 0.14)),
    splash: t => noise(t, 0.3, 0.15, null, 900),
  };
  let lastPlay = {};
  function play(name) {
    if (!ctx || !SFX[name]) return;
    // Don't stack the same sound 20 times when the magnet grabs 20 coins.
    const now = ctx.currentTime;
    if (lastPlay[name] && now - lastPlay[name] < 0.035) return;
    lastPlay[name] = now;
    SFX[name](now + 0.01);
  }

  /*
   * Music: a generated tune per world. We use the major pentatonic scale
   * (no notes clash, so a random melody still sounds cheerful) over a
   * I-V-vi-IV chord loop, 4 bars of 8 eighth-notes. The seed makes it the
   * same tune every time you enter that world.
   */
  const PENTA = [0, 2, 4, 7, 9];
  const PROG = [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]]; // C G Am F in semitones from root
  function makeSong(seed) {
    const r = LZ.U.rng(seed * 7919 + 13);
    const root = 60 + [0, 2, -3, 5, -1, 3, 0][seed % 7];
    const tempo = 112 + Math.floor(r() * 26);
    const melody = [];
    let idx = 5;
    for (let bar = 0; bar < 8; bar++) {
      for (let i = 0; i < 8; i++) {
        if (r() < 0.22 && i % 2 === 1) { melody.push(null); continue; }
        idx += Math.floor(r() * 5) - 2;
        idx = Math.max(2, Math.min(11, idx));
        const oct = Math.floor(idx / 5), deg = idx % 5;
        melody.push(root + PENTA[deg] + 12 * oct - 12);
      }
    }
    // Make bars 5-8 an echo of 1-4 with small changes so the tune is catchy.
    for (let i = 32; i < 64; i++) if (r() < 0.65) melody[i] = melody[i - 32];
    return { root, tempo, melody, wave: ['triangle', 'square', 'sine'][seed % 3] };
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
    const spb = 60 / musicSong.tempo / 2; // eighth note
    while (nextNoteTime < ctx.currentTime + 0.25) {
      const s = step % 64, bar = Math.floor(s / 8) % 4, chord = PROG[bar];
      const m = musicSong.melody[s];
      if (m != null) tone(midi(m + 12), nextNoteTime, spb * 1.6, musicSong.wave, 0.09, musicGain);
      if (s % 8 === 0) tone(midi(musicSong.root - 24 + chord[0]), nextNoteTime, spb * 3.5, 'sine', 0.22, musicGain);
      if (s % 8 === 4) tone(midi(musicSong.root - 24 + chord[0] + 7), nextNoteTime, spb * 3, 'sine', 0.16, musicGain);
      if (s % 2 === 0) chord.forEach(c => tone(midi(musicSong.root + c), nextNoteTime, spb * 0.9, 'triangle', 0.025, musicGain));
      if (s % 2 === 1) noise(nextNoteTime, 0.03, 0.03, musicGain, 8000);
      nextNoteTime += spb; step++;
    }
  }

  LZ.A = { unlock, play, playMusic, stopMusic, applyVolumes };
})();
