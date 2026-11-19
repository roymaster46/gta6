// audio.js — fully synthesized WebAudio sound for Solmarina.
// No audio files: every effect is an oscillator / noise buffer built in code.
// New in this revision: a four-station car radio (radio.js) — C cycles
// Sol FM, Noche FM, Fuga FM and Onda FM, each with its own day and night
// groove and tempo; at 3+ stars the chase groove takes over until the heat
// drops. Also new: a nitro whoosh, a shop-purchase chime, a helicopter
// rotor chop, a tire skid squeal, and a night mode for the music.
import { STATIONS, stationAt, stationChords, stationStepDur, stationLabel, stationNowPlaying, nextStation, CHASE_STATION } from './radio.js';

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let muted = false;
  let engineNodes = null;
  let musicTimer = null;
  let musicStep = 0;
  // Two chord sets for the music loop; setNightMode swaps the active one.
  let nightMode = false;
  // Radio: which station the dial is on, and whether the chase groove is
  // forcing Fuga FM while the wanted level is 3+ stars.
  let stationIndex = 0;
  let chaseMode = false;

  // The station the synth is actually playing right now: the chase groove
  // wins while the heat is on, otherwise the station on the dial.
  function activeStation() {
    return chaseMode ? STATIONS[CHASE_STATION] : stationAt(stationIndex);
  }

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

  // One 8th-note step of the radio: the active station's chord and bass,
  // read fresh every step so a station change, the chase groove or night
  // falling all land mid-bar instead of at the next track.
  function playMusicStep() {
    if (muted || !ctx) return;
    const station = activeStation();
    const { chords, bass } = stationChords(station, nightMode);
    const stepDur = stationStepDur(station);
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
  }

  // Re-time the music interval to the active station's tempo. Called when
  // the dial moves or the chase groove takes over; a no-op while the music
  // is off (startMusic starts it at the right tempo anyway).
  function restartMusicTimer() {
    if (!musicTimer) return;
    clearInterval(musicTimer);
    musicTimer = setInterval(playMusicStep, stationStepDur(activeStation()) * 1000);
  }

  const api = {
    unlock() { ensure(); },
    get muted() { return muted; },
    get night() { return nightMode; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    // Swap the music groove between day and night. The loop reads the
    // active chord set on every step, so the change takes effect mid-bar.
    setNightMode(on) {
      nightMode = !!on;
    },
    // The radio dial: cycle to the next station and return its label for
    // the HUD chip. The tempo follows the new station (see restartMusic).
    cycleStation() {
      stationIndex = nextStation(stationIndex);
      restartMusicTimer();
      return stationLabel(stationAt(stationIndex));
    },
    // Label for the HUD radio chip ("♪ Sol FM — sunny coastal groove ·
    // "Sunset Drive" — The Marinas").
    stationName() {
      return stationNowPlaying(activeStation());
    },
    // Chase music: at 3+ stars the tense Fuga FM groove takes over; when
    // the heat drops the dial goes back to the driver's station.
    setChaseMode(on) {
      on = !!on;
      if (on === chaseMode) return;
      chaseMode = on;
      restartMusicTimer();
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
    missionFail() {
      [392, 330, 262, 196].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'sawtooth', 0.25), i * 130));
    },
    missionStart() { blip(392, 0.15, 'triangle', 0.3); setTimeout(() => blip(523, 0.2, 'triangle', 0.3), 130); },
    sirenBlip() { blip(700, 0.25, 'sine', 0.12, 950); },
    door() { noiseHit(0.08, 0.25, 900, 'bandpass'); },
    crash() { noiseHit(0.25, 0.5, 500, 'lowpass'); blip(120, 0.15, 'square', 0.2, 50); },
    horn() { blip(370, 0.25, 'square', 0.12); blip(466, 0.25, 'square', 0.1); },
    // Tire squeal while handbraking at speed (throttled by the caller).
    skid() { noiseHit(0.18, 0.2, 1200, 'bandpass'); },
    click() { blip(800, 0.05, 'square', 0.15); },
    // Nitro boost: a rising filtered whoosh.
    nitro() {
      noiseHit(0.5, 0.45, 3000, 'bandpass');
      blip(180, 0.45, 'sawtooth', 0.18, 900);
    },
    // Garage purchase: cash-register chime.
    shopBuy() {
      blip(880, 0.08, 'triangle', 0.3);
      setTimeout(() => blip(1174, 0.1, 'triangle', 0.3), 70);
      setTimeout(() => blip(1568, 0.16, 'triangle', 0.3), 140);
    },
    // One rotor chop (two low thumps). main.js calls this on a timer while
    // the police helicopter is overhead.
    heli() {
      blip(65, 0.09, 'square', 0.22, 45);
      setTimeout(() => blip(65, 0.09, 'square', 0.18, 45), 110);
    },
    // Car alarm: two-tone wail when a carjack trips the alarm.
    alarm() {
      blip(950, 0.18, 'square', 0.16, 1200);
      setTimeout(() => blip(1200, 0.18, 'square', 0.16, 950), 180);
      setTimeout(() => blip(950, 0.18, 'square', 0.16, 1200), 360);
    },
    // Save chime: a soft two-note confirm when the game writes a slot.
    save() {
      blip(784, 0.1, 'triangle', 0.25);
      setTimeout(() => blip(1047, 0.16, 'triangle', 0.25), 100);
    },
    // Weapon wheel open/close: a short mechanical click.
    wheel() { blip(500, 0.06, 'square', 0.18, 700); },

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
      // The radio starts on the dial's station at its own tempo; every
      // step reads the active station fresh (see playMusicStep).
      musicTimer = setInterval(playMusicStep, stationStepDur(activeStation()) * 1000);
    },
    stopMusic() {
      if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
    },
  };
  return api;
}
