// Ember Harbor — procedural sound. Everything is synthesized with WebAudio:
// no audio files, no network. Engine hum follows car speed, the siren is
// two alternating tones, gunshots are filtered noise bursts, and a small
// step sequencer plays a moody bass line while you drive at night.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let muted = false;
  let musicOn = false;
  let step = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 420;
      engineOsc.connect(lp);
      lp.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 720;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    resume();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    gain.gain.setValueAtTime(vol || 0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ensure() || muted) return;
    resume();
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1800;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
  }

  const BASS = [55, 0, 55, 65.4, 0, 49, 0, 58.3, 55, 0, 55, 65.4, 73.4, 0, 49, 0];

  function musicStep() {
    if (!musicOn || muted || !ctx) return;
    const note = BASS[step % BASS.length];
    if (note) tone(note, 0.22, 'triangle', 0.16);
    if (step % 4 === 0) noise(0.05, 0.05, 6000);
    step += 1;
  }

  return {
    unlock() { ensure(); resume(); },
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.5;
      return muted;
    },
    isMuted() { return muted; },
    engine(speedNorm, on) {
      if (!ensure()) return;
      const target = on ? 0.05 + speedNorm * 0.1 : 0;
      engineGain.gain.setTargetAtTime(muted ? 0 : target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(48 + speedNorm * 130, ctx.currentTime, 0.08);
    },
    siren(on, dt) {
      if (!ensure()) return;
      if (!on) { sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2); return; }
      sirenGain.gain.setTargetAtTime(muted ? 0 : 0.045, ctx.currentTime, 0.2);
      const t = ctx.currentTime;
      sirenOsc.frequency.setValueAtTime(660 + 160 * Math.sin(t * 4.4), t);
    },
    shot() { noise(0.14, 0.4, 2400); tone(160, 0.09, 'square', 0.22, 60); },
    punch() { noise(0.08, 0.25, 900); },
    pickup() { tone(660, 0.1, 'sine', 0.22); setTimeout(() => tone(990, 0.14, 'sine', 0.22), 90); },
    cash() { tone(880, 0.09, 'sine', 0.2); setTimeout(() => tone(1318, 0.16, 'sine', 0.2), 80); },
    fail() { tone(220, 0.3, 'sawtooth', 0.18, 110); },
    mission() { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.22), i * 110)); },
    horn() { tone(370, 0.25, 'square', 0.12); tone(466, 0.25, 'square', 0.1); },
    crash() { noise(0.3, 0.45, 700); },
    jump() { tone(300, 0.12, 'sine', 0.12, 520); },
    startMusic() {
      if (!ensure() || musicOn) return;
      musicOn = true;
      musicTimer = setInterval(musicStep, 240);
    },
    stopMusic() {
      musicOn = false;
      if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    },
  };
}
