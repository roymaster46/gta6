// SOLARA BAY — synthesized audio. No audio files, no network.
// WebAudio oscillators + noise: radio stations, engine hum, gunshots, sirens.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.station = 0;
    this.musicTimer = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.16;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.5;
      this.sfxGain.connect(this.master);
      return true;
    } catch {
      return false;
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  // --- SFX ---
  blip(freq = 660, dur = 0.08, type = 'square', vol = 0.25) {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noiseBurst(dur = 0.2, vol = 0.4, lowpass = 1200) {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = lowpass;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.sfxGain);
    src.start(t);
  }

  gunshot(kind = 'pistol') {
    if (kind === 'shotgun') { this.noiseBurst(0.35, 0.6, 900); this.blip(90, 0.2, 'sawtooth', 0.3); }
    else if (kind === 'smg') { this.noiseBurst(0.08, 0.35, 2500); }
    else if (kind === 'rifle') { this.noiseBurst(0.3, 0.55, 1600); this.blip(140, 0.15, 'sawtooth', 0.2); }
    else { this.noiseBurst(0.15, 0.45, 2000); this.blip(180, 0.1, 'square', 0.2); }
  }

  siren(on) {
    if (!this.ensure()) return;
    if (on && !this.sirenOsc) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine'; o.frequency.value = 700;
      g.gain.value = 0.05;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.6;
      const lg = this.ctx.createGain(); lg.gain.value = 250;
      lfo.connect(lg); lg.connect(o.frequency);
      o.connect(g); g.connect(this.sfxGain);
      o.start(); lfo.start();
      this.sirenOsc = { o, lfo, g };
    } else if (!on && this.sirenOsc) {
      try { this.sirenOsc.o.stop(); this.sirenOsc.lfo.stop(); } catch {}
      this.sirenOsc = null;
    }
  }

  engine(on, speed01 = 0) {
    if (!this.ensure()) return;
    if (on && !this.engineOsc) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = 55;
      const g = this.ctx.createGain(); g.gain.value = 0.05;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
      o.connect(f); f.connect(g); g.connect(this.sfxGain);
      o.start();
      this.engineOsc = o; this.engineGain = g;
    } else if (!on && this.engineOsc) {
      try { this.engineOsc.stop(); } catch {}
      this.engineOsc = null; this.engineGain = null;
    }
    if (this.engineOsc) {
      this.engineOsc.frequency.value = 55 + speed01 * 140;
      this.engineGain.gain.value = 0.04 + speed01 * 0.05;
    }
  }

  cash() { this.blip(880, 0.07); setTimeout(() => this.blip(1320, 0.12), 70); }
  mission() { [523, 659, 784].forEach((f, i) => setTimeout(() => this.blip(f, 0.14, 'triangle', 0.3), i * 90)); }
  fail() { [400, 300, 200].forEach((f, i) => setTimeout(() => this.blip(f, 0.18, 'sawtooth', 0.2), i * 110)); }
  click() { this.blip(1200, 0.04, 'square', 0.15); }

  // --- Radio: generative loops per station ---
  startRadio(stationIndex) {
    this.station = stationIndex;
    this.stopRadio();
    if (!this.ensure()) return;
    const scales = [
      [0, 3, 5, 7, 10], // surf pop pentatonic
      [0, 2, 3, 7, 8],  // night drive minor
      null,             // talk: no music, just blips
      [0, 2, 5, 7, 9],  // synthwave
    ];
    const roots = [220, 164.8, 0, 196];
    const scale = scales[stationIndex];
    if (!scale) return; // talk station: silence + occasional blip
    const root = roots[stationIndex];
    const tempos = [112, 92, 0, 128];
    const stepMs = 60000 / tempos[stationIndex] / 2;
    let step = 0;
    const playStep = () => {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      // bass on beats
      if (step % 4 === 0) {
        const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
        o.type = 'triangle'; o.frequency.value = root / 2;
        g.gain.setValueAtTime(0.22, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        o.connect(g); g.connect(this.musicGain); o.start(t); o.stop(t + 0.4);
      }
      // melody: pseudo-random walk from step seed
      const seed = (step * 2654435761) % 97;
      if (seed % 3 !== 0) {
        const deg = scale[seed % scale.length] + 12 * (seed % 5 === 0 ? 1 : 0);
        const freq = root * Math.pow(2, deg / 12);
        const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
        o.type = stationIndex === 3 ? 'sawtooth' : 'sine';
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.14, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        o.connect(g); g.connect(this.musicGain); o.start(t); o.stop(t + 0.32);
      }
      // hat tick
      if (step % 2 === 1) {
        const len = Math.floor(this.ctx.sampleRate * 0.03);
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = this.ctx.createBufferSource(); src.buffer = buf;
        const g = this.ctx.createGain(); g.gain.value = 0.06;
        src.connect(g); g.connect(this.musicGain); src.start(t);
      }
      step++;
      this.musicTimer = setTimeout(playStep, stepMs);
    };
    playStep();
  }

  stopRadio() {
    if (this.musicTimer) { clearTimeout(this.musicTimer); this.musicTimer = null; }
  }
}
