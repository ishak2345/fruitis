/* ============================================================================
   js/audio.js — procedural audio engine (WebAudio only, zero asset files)

   Design notes
   - Every sound in the game is synthesized: ambience layers (ocean, wind, rain,
     hearth murmur, island hum), a tiny lookahead music sequencer with three
     original loops (title / village / battle) and one-shot stings.
   - The old GameMaker .ogg/.mp3 exports in /sounds were evaluated but are NOT
     used: loading them from file:// is blocked by browser CORS and embedding
     6.6 MB of audio as base64 would bloat the single build. Documented in
     docs/TECH_NOTES.md §Audio with a swap-in guide.
   - Every public call is guarded: audio failure can never break the game.
   ========================================================================== */
'use strict';

const AudioSys = (() => {
  let ctx = null, master = null, musicBus = null, ambBus = null;
  let enabled = true, started = false, volume = 1;   // volume: 1, .5, 0 steps
  const amb = {};           // ambience layer gains by name
  const noiseCache = {};

  function init() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = enabled ? 0.55 * volume : 0;
      master.connect(ctx.destination);
      musicBus = ctx.createGain(); musicBus.gain.value = 0.9; musicBus.connect(master);
      ambBus = ctx.createGain(); ambBus.gain.value = 1; ambBus.connect(master);
      return true;
    } catch (e) { ctx = null; return false; }
  }
  function resume() {
    if (!ctx && !init()) return;
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }
  function noiseBuffer(seconds, brown) {
    const key = (brown ? 'b' : 'w') + seconds;
    if (noiseCache[key]) return noiseCache[key];
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; }
      else d[i] = w * 0.6;
    }
    noiseCache[key] = buf;
    return buf;
  }

  /* -------------------------------------------------------- ambience layers */
  function layerNoise(name, opts) {
    // one looping filtered-noise voice on its own gain node
    try {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(opts.seconds || 3, !!opts.brown);
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = opts.type || 'lowpass';
      f.frequency.value = opts.freq || 500;
      f.Q.value = opts.q || 0.7;
      const g = ctx.createGain();
      g.gain.value = 0;
      if (opts.lfo) {
        const lfo = ctx.createOscillator(); lfo.frequency.value = opts.lfo;
        const lg = ctx.createGain(); lg.gain.value = opts.lfoAmt || 0.01;
        lfo.connect(lg); lg.connect(g.gain); lfo.start();
      }
      src.connect(f); f.connect(g); g.connect(ambBus);
      src.start();
      amb[name] = g;
    } catch (e) { /* a missing layer is fine */ }
  }
  function startAmbience() {
    if (!init() || started) return;
    started = true;
    try {
      layerNoise('ocean', { brown: true, seconds: 4, freq: 480, lfo: 0.11, lfoAmt: 0.14, base: 0.2 });
      layerNoise('wind', { brown: false, seconds: 3, type: 'bandpass', freq: 880, q: 0.6, lfo: 0.07, lfoAmt: 0.009, base: 0.012 });
      layerNoise('rain', { brown: false, seconds: 2.5, type: 'highpass', freq: 1700, q: 0.4, base: 0.05 });
      layerNoise('hum',  { brown: true, seconds: 5, freq: 140, lfo: 0.05, lfoAmt: 0.02, base: 0.035 });
      layerNoise('hearth', { brown: false, seconds: 2, type: 'bandpass', freq: 240, q: 0.5, lfo: 0.3, lfoAmt: 0.02, base: 0.03 });
    } catch (e) {}
  }
  // crossfade ambience mix per place: {ocean:0..1, wind:.., rain:.., hum:.., hearth:..}
  function setMix(mix, speed) {
    if (!ctx) return;
    speed = speed || 0.6;
    const t = ctx.currentTime;
    for (const k in amb) {
      const target = (mix && mix[k]) || 0;
      try { amb[k].gain.cancelScheduledValues(t); amb[k].gain.setTargetAtTime(target, t, 1 / speed); } catch (e) {}
    }
  }

  /* ----------------------------------------------------------- one-shot sfx */
  function blip(freq, dur, type, vol, slideTo) {
    if (!ctx || !enabled || volume === 0) return;
    try {
      const t0 = ctx.currentTime;
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(master);
      o.start(t0); o.stop(t0 + dur + 0.02);
    } catch (e) {}
  }
  function burst(dur, freq, q, vol, type) {
    if (!ctx || !enabled || volume === 0) return;
    try {
      const t0 = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(0.4, false);
      const f = ctx.createBiquadFilter();
      f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f); f.connect(g); g.connect(master);
      src.start(t0); src.stop(t0 + dur + 0.02);
    } catch (e) {}
  }
  function tone(freq, dur, type, vol, when, bus) {
    // used by the sequencer: schedule at absolute time `when`
    const t0 = when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'triangle';
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    g.gain.setValueAtTime(vol, t0 + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(bus || musicBus);
    o.start(t0); o.stop(t0 + dur + 0.03);
  }

  /* ------------------------------------------------------- music sequencer */
  // Original, tiny loops. Steps are 16ths at given BPM; note = step index.
  // freq helpers
  const N = {
    C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
    C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00,
    A2: 110, F2: 87.31, G2: 98, D2: 73.42, E2: 82.41, C2: 65.41, B2: 123.47
  };
  const SONGS = {
    title: {
      bpm: 72, bars: 4, stepsPerBar: 16,
      lead: [ // gentle melancholy loop (A minor)
        [0, N.A4, 1.8], [4, N.C5, 1.2], [6, N.B4, 0.9], [8, N.E4, 1.8],
        [16, N.G4, 1.4], [20, N.A4, 1.2], [22, N.G4, 0.8], [24, N.E4, 2.2],
        [32, N.F4, 1.6], [36, N.E4, 1.2], [38, N.D4, 0.9], [40, N.C4, 2.4],
        [48, N.E4, 1.4], [52, N.D4, 1.0], [54, N.B3, 0.8], [56, N.A3, 2.6]
      ],
      bass: [
        [0, N.A2, 3.5], [8, N.E2, 3.5], [16, N.C3, 3.5], [24, N.G2, 3.5],
        [32, N.F2, 3.5], [40, N.C3, 3.5], [48, N.E2, 2.0], [52, N.E2, 1.6], [56, N.A2, 3.5]
      ],
      leadVol: 0.045, bassVol: 0.05, leadType: 'triangle', bassType: 'sine'
    },
    village: {
      bpm: 88, bars: 4, stepsPerBar: 16,
      lead: [ // warm little waltz-ish loop (C major, D minor turn)
        [0, N.E4, 1.2], [2, N.G4, 1.2], [4, N.C5, 2.0], [8, N.B4, 0.8], [10, N.G4, 1.6],
        [16, N.A4, 1.2], [18, N.F4, 1.2], [20, N.A4, 2.0], [24, N.G4, 1.6], [26, N.E4, 1.2],
        [32, N.F4, 1.0], [34, N.E4, 1.0], [36, N.D4, 1.6], [40, N.E4, 1.6], [42, N.F4, 1.2],
        [48, N.G4, 1.6], [52, N.E4, 1.2], [54, N.D4, 1.0], [56, N.C4, 2.4]
      ],
      bass: [
        [0, N.C3, 2.6], [4, N.G2, 2.6], [8, N.E2, 2.6], [12, N.G2, 2.6],
        [16, N.F2, 2.6], [20, N.C3, 2.6], [24, N.A2, 2.6], [28, N.F2, 2.6],
        [32, N.D3, 2.6], [36, N.A2, 2.6], [40, N.G2, 2.6], [44, N.B2, 2.6],
        [48, N.C3, 2.6], [52, N.G2, 2.6], [56, N.C3, 2.6]
      ],
      leadVol: 0.04, bassVol: 0.045, leadType: 'triangle', bassType: 'sine'
    },
    battle: {
      bpm: 132, bars: 2, stepsPerBar: 16,
      lead: [ // tense pulse (D minor)
        [0, N.D4, 0.7], [2, N.D4, 0.5], [4, N.F4, 0.7], [6, N.D4, 0.5],
        [8, N.A4, 0.7], [10, N.G4, 0.5], [12, N.F4, 0.7], [14, N.E4, 0.5],
        [16, N.D4, 0.7], [18, N.D4, 0.5], [20, N.F4, 0.7], [22, N.G4, 0.5],
        [24, N.A4, 0.9], [27, N.G4, 0.6], [29, N.F4, 0.6], [30, N.E4, 0.8]
      ],
      bass: [
        [0, N.D2, 0.9], [3, N.D2, 0.6], [6, N.D2, 0.6], [8, N.A2, 0.9], [11, N.A2, 0.6],
        [14, N.A2, 0.6], [16, N.D2, 0.9], [19, N.D2, 0.6], [22, N.C3, 0.7],
        [24, N.A2, 0.9], [27, N.E2, 0.6], [30, N.A2, 0.6]
      ],
      leadVol: 0.04, bassVol: 0.055, leadType: 'square', bassType: 'triangle'
    }
  };
  const seq = { song: null, step: 0, nextT: 0 };
  function playSong(name) {
    if (seq.song === name) return;
    seq.song = name;
    seq.step = 0;
    if (ctx) seq.nextT = ctx.currentTime + 0.08;
  }
  function stopSong() { seq.song = null; }
  function tickMusic() {
    if (!ctx || !enabled || volume === 0 || !seq.song) return;
    try {
      const s = SONGS[seq.song];
      if (!s) return;
      const stepDur = 60 / s.bpm / 4;
      while (seq.nextT < ctx.currentTime + 0.18) {
        const st = seq.step % (s.bars * s.stepsPerBar);
        for (const nt of s.lead) if (nt[0] === st) tone(nt[1], nt[2] * stepDur, s.leadType, s.leadVol, seq.nextT);
        for (const nt of s.bass) if (nt[0] === st) tone(nt[1], nt[2] * stepDur, s.bassType, s.bassVol, seq.nextT);
        seq.step++;
        seq.nextT += stepDur;
      }
    } catch (e) { seq.song = null; }
  }

  /* -------------------------------------------------------------- the API */
  let stepSide = 0;
  return {
    init, resume, startAmbience, setMix, playSong, stopSong, tickMusic,
    get ctx() { return ctx; },
    get enabled() { return enabled; },
    get volume() { return volume; },
    setEnabled(on) {
      enabled = on;
      if (!on) { stopSong(); }
      if (master) master.gain.value = on ? 0.55 * volume : 0;
      if (on) { resume(); startAmbience(); }
    },
    cycleVolume() {
      volume = volume === 1 ? 0.5 : volume === 0.5 ? 0 : 1;
      if (master) master.gain.value = enabled ? 0.55 * volume : 0;
      return volume;
    },
    /* ------ sfx ------ */
    footstep(surface) {
      if (!enabled) return;
      stepSide = 1 - stepSide;
      if (surface === 'sand') burst(0.07, 620, 1.4, 0.032);
      else if (surface === 'wood') burst(0.06, 240, 2.2, 0.05);
      else burst(0.07, 330, 1.4, 0.024);
    },
    type() { blip(500 + Math.random() * 50, 0.024, 'square', 0.011); },
    advance() { blip(660, 0.05, 'triangle', 0.03, 880); },
    back() { blip(440, 0.06, 'triangle', 0.028, 300); },
    select() { blip(760, 0.07, 'triangle', 0.033, 980); },
    examine() { blip(440, 0.1, 'triangle', 0.032, 660); },
    talk() { blip(392, 0.09, 'square', 0.02, 523); },
    open() { blip(320, 0.12, 'triangle', 0.035, 520); },
    close() { blip(520, 0.1, 'triangle', 0.03, 320); },
    stepObj() { blip(523, 0.12, 'triangle', 0.038, 784); },
    itemGet() { blip(587, 0.09, 'square', 0.035); setTimeout(() => blip(784, 0.12, 'square', 0.035), 90); setTimeout(() => blip(1175, 0.18, 'triangle', 0.04), 190); },
    heal() { blip(523, 0.12, 'sine', 0.045, 784); setTimeout(() => blip(659, 0.16, 'sine', 0.04, 1046), 110); },
    save() { blip(660, 0.1, 'triangle', 0.04); setTimeout(() => blip(880, 0.16, 'triangle', 0.04), 100); setTimeout(() => blip(1320, 0.22, 'sine', 0.035), 210); },
    warn() {
      if (!ctx || !enabled) return;
      try {
        const freqs = [110, 130.81, 164.81, 220];
        const t0 = ctx.currentTime;
        freqs.forEach((f, i) => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = i < 2 ? 'sine' : 'triangle';
          o.frequency.value = f;
          g.gain.setValueAtTime(0, t0);
          g.gain.linearRampToValueAtTime(0.05 - i * 0.008, t0 + 1.1);
          g.gain.linearRampToValueAtTime(0.0001, t0 + 6.5);
          const trem = ctx.createOscillator(); trem.frequency.value = 0.9 + i * 0.13;
          const tg = ctx.createGain(); tg.gain.value = 0.012;
          trem.connect(tg); tg.connect(g.gain); trem.start(t0); trem.stop(t0 + 6.6);
          o.connect(g); g.connect(master);
          o.start(t0); o.stop(t0 + 6.6);
        });
      } catch (e) {}
    },
    moan() {
      if (!ctx || !enabled) return;
      blip(72, 2.6, 'sine', 0.05, 48);
      blip(108, 2.1, 'triangle', 0.016, 74);
      burst(2.0, 220, 0.9, 0.011, 'lowpass');
    },
    bird() {
      if (!ctx || !enabled) return;
      const base = 1400 + Math.random() * 900;
      blip(base, 0.06, 'sine', 0.016, base * 1.35);
      setTimeout(() => blip(base * 0.92, 0.05, 'sine', 0.012, base * 1.2), 95);
    },
    thunder() {
      if (!ctx || !enabled) return;
      burst(2.4, 90, 0.4, 0.22, 'lowpass');
      burst(1.1, 220, 0.5, 0.08, 'lowpass');
    },
    crash() { // ship destruction sting
      if (!ctx || !enabled) return;
      burst(1.6, 140, 0.5, 0.2, 'lowpass');
      blip(220, 0.5, 'sawtooth', 0.06, 60);
      setTimeout(() => burst(0.8, 700, 0.8, 0.07), 160);
    },
    /* ------ battle ------ */
    battleStart() {
      if (!ctx || !enabled) return;
      blip(196, 0.16, 'square', 0.05);
      setTimeout(() => blip(233, 0.16, 'square', 0.05), 130);
      setTimeout(() => blip(311, 0.3, 'square', 0.06, 220), 260);
    },
    swing() { burst(0.12, 900, 1.2, 0.06, 'bandpass'); },
    hit() {
      if (!ctx || !enabled) return;
      burst(0.16, 180, 1.0, 0.14, 'lowpass');
      blip(160, 0.14, 'square', 0.06, 80);
    },
    hurt() {
      if (!ctx || !enabled) return;
      blip(300, 0.2, 'sawtooth', 0.06, 90);
      burst(0.18, 400, 0.8, 0.05);
    },
    graze() { blip(1200, 0.03, 'sine', 0.02); },
    dodgeTick() { blip(900, 0.02, 'sine', 0.012); },
    spare() {
      if (!ctx || !enabled) return;
      blip(523, 0.12, 'triangle', 0.04);
      setTimeout(() => blip(659, 0.12, 'triangle', 0.04), 110);
      setTimeout(() => blip(784, 0.2, 'triangle', 0.045), 220);
    },
    victory() {
      if (!ctx || !enabled) return;
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.16, 'square', 0.035), i * 110));
    },
    defeat() {
      if (!ctx || !enabled) return;
      [330, 262, 196, 131].forEach((f, i) => setTimeout(() => blip(f, 0.3, 'triangle', 0.045), i * 220));
    },
    flee() { blip(880, 0.1, 'square', 0.03, 440); },
    encounterZap() {
      if (!ctx || !enabled) return;
      blip(160, 0.22, 'sawtooth', 0.05, 640);
      burst(0.22, 1200, 0.7, 0.04);
    }
  };
})();
