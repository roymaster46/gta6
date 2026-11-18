// audio.js — fully synthesized WebAudio sound for Solmarina.
// No audio files: every effect is an oscillator / noise buffer built in code.
export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let muted = false;
  let engineNodes = null;
  let musicTimer = null;
  let musicStep = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.14;
      musicGain.connect(master);
      return true;
    } catch {
      return false;
    }
  }

  function noiseBuffer(seconds = 1) {
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function blip(freq, dur, type = 'sine', vol = 0.3, slideTo = null) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g); g.connect(master);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  function noiseHit(dur, vol, filterFreq, type = 'lowpass') {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(dur + 0.1);
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filt); filt.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur + 0.05);
  }

  const api = {
    unlock() { ensure(); },
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    shoot() {
      noiseHit(0.12, 0.5, 1800, 'highpass');
      blip(220, 0.08, 'square', 0.18, 60);
    },
    smgShoot() { noiseHit(0.07, 0.35, 2400, 'highpass'); },
    explosion() {
      noiseHit(0.7, 0.7, 400, 'lowpass');
      blip(90, 0.5, 'sine', 0.4, 30);
    },
    pickup() { blip(660, 0.09, 'sine', 0.3); setTimeout(() => blip(990, 0.12, 'sine', 0.3), 80); },
    cash() { blip(880, 0.08, 'triangle', 0.3); setTimeout(() => blip(1320, 0.14, 'triangle', 0.3), 90); },
    hurt() { blip(160, 0.18, 'sawtooth', 0.3, 70); },
    busted() { blip(440, 0.3, 'sawtooth', 0.3, 220); setTimeout(() => blip(330, 0.4, 'sawtooth', 0.3, 165), 250); },
    missionDone() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.18, 'triangle', 0.3), i * 110));
    },
    missionStart() { blip(392, 0.15, 'triangle', 0.3); setTimeout(() => blip(523, 0.2, 'triangle', 0.3), 130); },
    sirenBlip() { blip(700, 0.25, 'sine', 0.12, 950); },
    door() { noiseHit(0.08, 0.25, 900, 'bandpass'); },
    crash() { noiseHit(0.25, 0.5, 500, 'lowpass'); blip(120, 0.15, 'square', 0.2, 50); },
    horn() { blip(370, 0.25, 'square', 0.12); blip(466, 0.25, 'square', 0.1); },
    click() { blip(800, 0.05, 'square', 0.15); },

    // Continuous engine hum; call with speed 0..1, or null to stop.
    engine(speed) {
      if (!ensure()) return;
      if (speed === null || speed === undefined) {
        if (engineNodes) { try { engineNodes.osc.stop(); } catch { /* already stopped */ } engineNodes = null; }
        return;
      }
      if (!engineNodes) {
        const osc = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const g = ctx.createGain();
        const filt = ctx.createBiquadFilter();
        osc.type = 'sawtooth'; osc2.type = 'square';
        filt.type = 'lowpass'; filt.frequency.value = 500;
        g.gain.value = 0.0;
        osc.connect(filt); osc2.connect(filt); filt.connect(g); g.connect(master);
        osc.start(); osc2.start();
        engineNodes = { osc, osc2, g, filt };
      }
      const t = ctx.currentTime;
      const f = 55 + speed * 130;
      engineNodes.osc.frequency.setTargetAtTime(f, t, 0.05);
      engineNodes.osc2.frequency.setTargetAtTime(f * 0.5 + 2, t, 0.05);
      engineNodes.g.gain.setTargetAtTime(0.02 + speed * 0.06, t, 0.1);
      engineNodes.filt.frequency.setTargetAtTime(350 + speed * 900, t, 0.1);
    },

    startMusic() {
      if (!ensure() || musicTimer) return;
      // Sunny coastal groove: Am – F – C – G arpeggio, 8th notes at 112 BPM.
      const chords = [
        [220.0, 261.63, 329.63], [174.61, 220.0, 261.63],
        [261.63, 329.63, 392.0], [196.0, 246.94, 293.66],
      ];
      const bass = [110.0, 87.31, 130.81, 98.0];
      const stepDur = 60 / 112 / 2;
      musicTimer = setInterval(() => {
        if (muted) return;
        const chord = chords[Math.floor(musicStep / 4) % 4];
        const note = chord[musicStep % 3];
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = note * 2;
        g.gain.setValueAtTime(0.16, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 1.8);
        osc.connect(g); g.connect(musicGain);
        osc.start(t); osc.stop(t + stepDur * 2);
        if (musicStep % 4 === 0) {
          const b = ctx.createOscillator();
          const bg = ctx.createGain();
          b.type = 'sine';
          b.frequency.value = bass[Math.floor(musicStep / 4) % 4];
          bg.gain.setValueAtTime(0.25, t);
          bg.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 3.5);
          b.connect(bg); bg.connect(musicGain);
          b.start(t); b.stop(t + stepDur * 4);
        }
        musicStep++;
      }, stepDur * 1000);
    },
    stopMusic() {
      if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    },
  };
  return api;
}
