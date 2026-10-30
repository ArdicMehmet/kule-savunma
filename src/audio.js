'use strict';

// Tüm sesler Web Audio API ile prosedürel olarak üretilir.
class SoundManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicEnabled = true;
    this.sfxEnabled = true;
    this.last = {};
    this.intensity = 0;
    this.musicStarted = false;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : 0.85;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 6; comp.attack.value = 0.004; comp.release.value = 0.2;
    this.master.connect(comp); comp.connect(c.destination);
    this.sfx = c.createGain(); this.sfx.gain.value = 0.7; this.sfx.connect(this.master);
    this.music = c.createGain(); this.music.gain.value = 0.2; this.music.connect(this.master);
    const len = c.sampleRate * 2;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.startMusic();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.05);
  }
  setMusic(on) {
    this.musicEnabled = on;
    if (this.music) this.music.gain.setTargetAtTime(on ? 0.2 : 0, this.ctx.currentTime, 0.1);
  }
  setSfx(on) {
    this.sfxEnabled = on;
    if (this.sfx) this.sfx.gain.setTargetAtTime(on ? 0.7 : 0, this.ctx.currentTime, 0.05);
  }

  // ---------- İlkel ses üreticileri ----------
  tone({ type = 'sine', f0 = 440, f1 = null, dur = 0.2, vol = 0.3, attack = 0.005, delay = 0, dest = null, q = null }) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (q) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = q; o.connect(f); node = f;
    }
    node.connect(g); g.connect(dest || this.sfx);
    o.start(t); o.stop(t + dur + 0.05);
  }

  noise({ dur = 0.3, vol = 0.3, type = 'lowpass', f0 = 1000, f1 = null, Q = 1, attack = 0.005, delay = 0, dest = null }) {
    const c = this.ctx, t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = type; f.Q.value = Q;
    f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest || this.sfx);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  }

  // ---------- Oyun sesleri ----------
  play(name, vol = 1) {
    if (!this.ctx || this.muted || !this.sfxEnabled) return;
    const now = this.ctx.currentTime;
    const gap = SoundManager.GAPS[name] ?? 0.03;
    if (this.last[name] && now - this.last[name] < gap) return;
    this.last[name] = now;
    const p = rand(0.94, 1.06);
    const v = vol;
    switch (name) {
      case 'click': this.tone({ type: 'sine', f0: 900, f1: 1200, dur: 0.06, vol: 0.15 * v }); break;
      case 'error':
        this.tone({ type: 'square', f0: 180, f1: 120, dur: 0.18, vol: 0.12 * v, q: 900 });
        this.tone({ type: 'square', f0: 140, f1: 100, dur: 0.18, vol: 0.1 * v, delay: 0.09, q: 900 });
        break;
      case 'coin':
        this.tone({ type: 'triangle', f0: 1320 * p, dur: 0.08, vol: 0.12 * v });
        this.tone({ type: 'triangle', f0: 1760 * p, dur: 0.14, vol: 0.12 * v, delay: 0.06 });
        break;
      case 'buy':
        [988, 1319, 1568].forEach((f, i) => this.tone({ type: 'triangle', f0: f, dur: 0.16, vol: 0.14 * v, delay: i * 0.06 }));
        break;
      case 'place':
        this.noise({ dur: 0.35, vol: 0.5 * v, f0: 300, f1: 80 });
        this.tone({ type: 'sine', f0: 110, f1: 45, dur: 0.35, vol: 0.5 * v });
        break;
      case 'build':
        this.noise({ dur: 0.5, vol: 0.4 * v, f0: 500, f1: 90 });
        this.tone({ type: 'sine', f0: 90, f1: 40, dur: 0.5, vol: 0.5 * v });
        [523, 659, 784, 1047].forEach((f, i) => this.tone({ type: 'triangle', f0: f, dur: 0.35, vol: 0.12 * v, delay: 0.12 + i * 0.07 }));
        break;
      case 'upgrade':
        [392, 523, 659, 784].forEach((f, i) => this.tone({ type: 'sine', f0: f, dur: 0.3, vol: 0.14 * v, delay: i * 0.06 }));
        this.noise({ dur: 0.6, vol: 0.06 * v, type: 'highpass', f0: 5000, delay: 0.1 });
        break;
      case 'card_flip': this.noise({ dur: 0.16, vol: 0.18 * v, type: 'bandpass', f0: 900, f1: 3500, Q: 1.2 }); break;
      case 'card_orta':
        [784, 988].forEach((f, i) => this.tone({ type: 'sine', f0: f, dur: 0.4, vol: 0.1 * v, delay: i * 0.05 }));
        break;
      case 'card_nadir':
        [880, 1109, 1319, 1760].forEach((f, i) => this.tone({ type: 'sine', f0: f, dur: 0.9, vol: 0.1 * v, delay: i * 0.07 }));
        this.noise({ dur: 1.0, vol: 0.07 * v, type: 'highpass', f0: 6000 });
        break;
      case 'card_pick':
        [523, 659, 784].forEach((f) => this.tone({ type: 'triangle', f0: f, dur: 0.45, vol: 0.12 * v }));
        break;
      case 'hero_shot': this.tone({ type: 'triangle', f0: 700 * p, f1: 1100 * p, dur: 0.09, vol: 0.06 * v }); break;
      case 'fire_shot':
        this.noise({ dur: 0.2, vol: 0.12 * v, type: 'bandpass', f0: 700 * p, f1: 300, Q: 0.8 });
        break;
      case 'ice_shot':
        this.tone({ type: 'sine', f0: 2200 * p, f1: 1300 * p, dur: 0.12, vol: 0.06 * v });
        this.tone({ type: 'triangle', f0: 3300 * p, dur: 0.05, vol: 0.03 * v, delay: 0.02 });
        break;
      case 'zap':
        this.noise({ dur: 0.16, vol: 0.12 * v, type: 'highpass', f0: 2500 * p, Q: 0.7 });
        this.tone({ type: 'sawtooth', f0: 180 * p, f1: 90, dur: 0.12, vol: 0.05 * v, q: 1800 });
        break;
      case 'acid_shot':
        this.tone({ type: 'sine', f0: 340 * p, f1: 160, dur: 0.16, vol: 0.12 * v });
        break;
      case 'splash':
        this.noise({ dur: 0.22, vol: 0.12 * v, type: 'bandpass', f0: 1200 * p, f1: 500, Q: 1.5 });
        this.tone({ type: 'sine', f0: 500 * p, f1: 900, dur: 0.08, vol: 0.05 * v, delay: 0.03 });
        break;
      case 'hit': this.noise({ dur: 0.06, vol: 0.06 * v, type: 'bandpass', f0: 1800 * p, Q: 2 }); break;
      case 'explosion':
        this.noise({ dur: 0.7, vol: 0.45 * v, f0: 1200, f1: 60 });
        this.tone({ type: 'sine', f0: 90 * p, f1: 30, dur: 0.6, vol: 0.45 * v });
        break;
      case 'meteor_fall': this.tone({ type: 'sine', f0: 1600 * p, f1: 300, dur: 0.55, vol: 0.05 * v }); break;
      case 'thunder':
        this.noise({ dur: 0.25, vol: 0.4 * v, type: 'highpass', f0: 1500, Q: 0.5 });
        this.noise({ dur: 1.6, vol: 0.4 * v, f0: 2500, f1: 90, delay: 0.05 });
        this.tone({ type: 'sine', f0: 60, f1: 30, dur: 1.2, vol: 0.3 * v, delay: 0.05 });
        break;
      case 'freeze':
        this.noise({ dur: 0.3, vol: 0.25 * v, type: 'highpass', f0: 3500, Q: 1 });
        [2637, 3136, 3951].forEach((f, i) => this.tone({ type: 'sine', f0: f * p, dur: 0.3, vol: 0.04 * v, delay: i * 0.03 }));
        break;
      case 'whoosh': this.noise({ dur: 0.5, vol: 0.22 * v, type: 'bandpass', f0: 400, f1: 2400, Q: 1.2, attack: 0.15 }); break;
      case 'wind': this.noise({ dur: 2.2, vol: 0.18 * v, type: 'bandpass', f0: 500, f1: 900, Q: 2.5, attack: 0.4 }); break;
      case 'fire_whoosh':
        this.noise({ dur: 0.7, vol: 0.3 * v, type: 'lowpass', f0: 2500, f1: 300, attack: 0.08 });
        break;
      case 'phoenix':
        this.tone({ type: 'sawtooth', f0: 900, f1: 1800, dur: 0.5, vol: 0.06 * v, q: 3000 });
        this.noise({ dur: 0.9, vol: 0.3 * v, f0: 3000, f1: 400, attack: 0.05 });
        break;
      case 'bubble':
        for (let i = 0; i < 4; i++) this.tone({ type: 'sine', f0: rand(300, 700), f1: rand(700, 1200), dur: 0.07, vol: 0.05 * v, delay: i * 0.06 });
        break;
      case 'charge':
        this.tone({ type: 'sawtooth', f0: 200, f1: 1600, dur: 0.6, vol: 0.06 * v, q: 2500 });
        this.noise({ dur: 0.6, vol: 0.08 * v, type: 'highpass', f0: 3000 });
        break;
      case 'snowball': this.noise({ dur: 0.25, vol: 0.25 * v, f0: 600, f1: 150 }); break;
      case 'saw': this.tone({ type: 'sawtooth', f0: 1400 * p, f1: 900, dur: 0.3, vol: 0.04 * v, q: 4000 }); break;
      case 'enemy_die':
        this.tone({ type: 'sine', f0: 420 * p, f1: 110, dur: 0.12, vol: 0.09 * v });
        this.noise({ dur: 0.08, vol: 0.06 * v, type: 'bandpass', f0: 900, Q: 1 });
        break;
      case 'boss_die':
        this.noise({ dur: 1.5, vol: 0.5 * v, f0: 1500, f1: 50 });
        [392, 330, 262, 196].forEach((f, i) => this.tone({ type: 'sawtooth', f0: f, dur: 0.4, vol: 0.1 * v, delay: i * 0.15, q: 1500 }));
        break;
      case 'leak':
        this.tone({ type: 'sine', f0: 110, f1: 50, dur: 0.4, vol: 0.5 * v });
        this.tone({ type: 'square', f0: 660, dur: 0.12, vol: 0.06 * v, delay: 0.05, q: 2000 });
        this.tone({ type: 'square', f0: 440, dur: 0.16, vol: 0.06 * v, delay: 0.18, q: 2000 });
        break;
      case 'wave_start':
        this.tone({ type: 'sawtooth', f0: 220, dur: 0.5, vol: 0.12 * v, attack: 0.05, q: 1200 });
        this.tone({ type: 'sawtooth', f0: 330, dur: 0.9, vol: 0.12 * v, attack: 0.05, delay: 0.42, q: 1200 });
        this.tone({ type: 'sawtooth', f0: 110, dur: 1.3, vol: 0.1 * v, attack: 0.05, q: 600 });
        break;
      case 'boss_horn':
        this.tone({ type: 'sawtooth', f0: 98, dur: 2.0, vol: 0.2 * v, attack: 0.2, q: 700 });
        this.tone({ type: 'sawtooth', f0: 147, dur: 2.0, vol: 0.12 * v, attack: 0.2, q: 700 });
        this.tone({ type: 'sawtooth', f0: 92, dur: 1.4, vol: 0.15 * v, attack: 0.2, delay: 1.6, q: 600 });
        break;
      case 'wave_clear':
        [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone({ type: 'triangle', f0: f, dur: 0.3, vol: 0.12 * v, delay: i * 0.1 }));
        break;
      case 'game_over':
        [392, 349, 311, 262, 196].forEach((f, i) => this.tone({ type: 'sawtooth', f0: f, dur: 0.6, vol: 0.12 * v, delay: i * 0.3, q: 1200 }));
        break;
      case 'unlock':
        this.tone({ type: 'sawtooth', f0: 60, f1: 120, dur: 1.4, vol: 0.2 * v, attack: 0.3, q: 400 });
        this.noise({ dur: 1.4, vol: 0.12 * v, type: 'bandpass', f0: 200, f1: 1200, Q: 2, attack: 0.3 });
        break;
      // ---- Ölüm Kulesi ----
      case 'curse':
        this.tone({ type: 'sine', f0: 520 * p, f1: 180 * p, dur: 0.22, vol: 0.08 * v });
        this.tone({ type: 'triangle', f0: 260 * p, f1: 130 * p, dur: 0.25, vol: 0.05 * v, delay: 0.02 });
        break;
      case 'soul':
        this.tone({ type: 'sine', f0: 880 * p, f1: 1500 * p, dur: 0.25, vol: 0.035 * v, attack: 0.05 });
        break;
      case 'gold_shot':
        this.tone({ type: 'triangle', f0: 1100 * p, f1: 500, dur: 0.25, vol: 0.08 * v });
        this.noise({ dur: 0.25, vol: 0.08 * v, type: 'bandpass', f0: 2500, f1: 800, Q: 1.5 });
        break;
      case 'crystal':
        [1568, 2093, 2637].forEach((f, i) => this.tone({ type: 'sine', f0: f * p, dur: 0.22, vol: 0.06 * v, delay: i * 0.05 }));
        break;
      case 'zombie':
        this.tone({ type: 'sawtooth', f0: 95 * p, f1: 70 * p, dur: 0.6, vol: 0.09 * v, attack: 0.1, q: 500 });
        this.noise({ dur: 0.5, vol: 0.12 * v, f0: 400, f1: 150, attack: 0.08 });
        break;
      case 'zombie_hit': this.noise({ dur: 0.08, vol: 0.08 * v, type: 'bandpass', f0: 600 * p, Q: 1.5 }); break;
      case 'death_wave':
        this.noise({ dur: 1.0, vol: 0.22 * v, type: 'bandpass', f0: 300, f1: 1200, Q: 2, attack: 0.15 });
        this.tone({ type: 'sine', f0: 220, f1: 110, dur: 0.9, vol: 0.12 * v, attack: 0.1 });
        break;
      case 'pit':
        this.tone({ type: 'sine', f0: 70, f1: 35, dur: 0.9, vol: 0.4 * v });
        this.noise({ dur: 0.8, vol: 0.25 * v, f0: 700, f1: 80 });
        break;
      case 'pit_fall': this.tone({ type: 'sine', f0: 600 * p, f1: 90, dur: 0.35, vol: 0.08 * v }); break;
      // ---- Yaşam Kulesi ----
      case 'vine':
        this.noise({ dur: 0.45, vol: 0.2 * v, type: 'bandpass', f0: 1800, f1: 600, Q: 1.2, attack: 0.03 });
        this.tone({ type: 'sine', f0: 160 * p, f1: 90, dur: 0.3, vol: 0.12 * v });
        break;
      case 'fairy':
        [1760, 2349, 2794].forEach((f, i) => this.tone({ type: 'sine', f0: f * p, dur: 0.18, vol: 0.035 * v, delay: i * 0.04 }));
        break;
      case 'fairy_shot': this.tone({ type: 'sine', f0: 2600 * p, f1: 1800 * p, dur: 0.07, vol: 0.03 * v }); break;
      case 'quake':
        this.noise({ dur: 0.9, vol: 0.4 * v, f0: 500, f1: 60 });
        this.tone({ type: 'sine', f0: 55, f1: 30, dur: 0.9, vol: 0.4 * v });
        break;
      case 'decay':
        this.noise({ dur: 0.7, vol: 0.12 * v, type: 'bandpass', f0: 900, f1: 300, Q: 0.8, attack: 0.1 });
        this.tone({ type: 'triangle', f0: 180 * p, f1: 120, dur: 0.6, vol: 0.05 * v, attack: 0.1 });
        break;
      case 'seed_pop':
        this.tone({ type: 'sine', f0: 300 * p, f1: 900 * p, dur: 0.1, vol: 0.12 * v });
        this.noise({ dur: 0.35, vol: 0.2 * v, f0: 1500, f1: 200 });
        break;
      case 'sprout': this.tone({ type: 'sine', f0: 600 * p, f1: 1200 * p, dur: 0.12, vol: 0.03 * v }); break;
    }
  }

  // ---------- Prosedürel müzik ----------
  startMusic() {
    if (this.musicStarted || !this.ctx) return;
    this.musicStarted = true;
    this.step = 0;
    this.stepDur = 60 / 92 / 4;
    this.nextTime = this.ctx.currentTime + 0.1;
    // Am - F - C - G / Dm - Am - E - Am
    this.prog = [
      [57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62],
      [50, 53, 57], [57, 60, 64], [52, 56, 59], [57, 60, 64],
    ];
    this.timerId = setInterval(() => this.schedule(), 50);
  }

  setIntensity(v) { this.intensity = v; }

  schedule() {
    const c = this.ctx;
    if (!c) return;
    if (this.nextTime < c.currentTime - 0.3) this.nextTime = c.currentTime + 0.05;
    while (this.nextTime < c.currentTime + 0.2) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += this.stepDur;
      this.step++;
    }
  }

  mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  playStep(step, time) {
    if (!this.musicEnabled || this.muted) return;
    const bar = Math.floor(step / 16) % this.prog.length;
    const s = step % 16;
    const chord = this.prog[bar];
    const d = time - this.ctx.currentTime;
    const dest = this.music;
    if (s === 0) {
      for (const n of chord) this.tone({ type: 'triangle', f0: this.mtof(n), dur: this.stepDur * 16, vol: 0.05, attack: 0.5, delay: d, dest, q: 1400 });
      this.tone({ type: 'sine', f0: this.mtof(chord[0] - 12), dur: this.stepDur * 16, vol: 0.06, attack: 0.3, delay: d, dest });
    }
    if (s % 2 === 0) {
      const pat = [0, 1, 2, 1, 2, 0, 1, 2];
      const n = chord[pat[(s / 2) % 8]] + 12;
      this.tone({ type: 'triangle', f0: this.mtof(n), dur: 0.25, vol: this.intensity > 0 ? 0.035 : 0.022, delay: d, dest });
    }
    if (this.intensity > 0) {
      if (s % 4 === 0) this.tone({ type: 'sine', f0: this.mtof(chord[0] - 24), dur: 0.3, vol: 0.12, delay: d, dest });
      if (s === 0 || s === 8) this.tone({ type: 'sine', f0: 130, f1: 40, dur: 0.18, vol: 0.22, delay: d, dest });
      if (s === 4 || s === 12) this.noise({ dur: 0.12, vol: 0.06, type: 'bandpass', f0: 1800, Q: 0.8, delay: d, dest });
      if (s % 2 === 1) this.noise({ dur: 0.03, vol: 0.025, type: 'highpass', f0: 7000, delay: d, dest });
      if (this.intensity > 1 && s % 4 === 2) this.tone({ type: 'sawtooth', f0: this.mtof(chord[0] - 12), dur: 0.2, vol: 0.05, delay: d, dest, q: 800 });
    }
  }
}

SoundManager.GAPS = {
  hero_shot: 0.08, fire_shot: 0.07, ice_shot: 0.07, zap: 0.08, acid_shot: 0.08, splash: 0.08, hit: 0.05,
  explosion: 0.08, enemy_die: 0.04, coin: 0.06, freeze: 0.1, thunder: 0.25, bubble: 0.2, whoosh: 0.1,
  meteor_fall: 0.12, snowball: 0.1, saw: 0.15, wind: 0.5, fire_whoosh: 0.15, card_flip: 0.05,
  curse: 0.09, soul: 0.07, gold_shot: 0.1, crystal: 0.08, zombie: 0.6, zombie_hit: 0.08, death_wave: 0.3,
  pit: 0.3, pit_fall: 0.06, vine: 0.2, fairy: 0.3, fairy_shot: 0.06, quake: 0.3, decay: 0.4, seed_pop: 0.06, sprout: 0.25,
};

const Sound = new SoundManager();
