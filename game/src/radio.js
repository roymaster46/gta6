// radio.js — Solmarina car radio: four switchable stations, each with its
// own groove. The audio engine reads the active station's chords, bass and
// tempo on every step, so switching stations (or day into night) takes
// effect mid-bar. Station 0 is the default sunny groove; the game forces
// the tense chase groove while the wanted level is 3 stars or higher, and
// hands the dial back to the driver when the heat drops.
// Every chord is a [root, third, fifth] (sometimes a seventh) in Hz; every
// bass line is one root note per bar. All of it is original — no sampled
// music, no licensed tracks, just frequencies the synth plays.
export const STATIONS = [
  {
    name: 'Sol FM', bpm: 112, tag: 'sunny coastal groove',
    tracks: [{ title: 'Sunset Drive', artist: 'The Marinas' }, { title: 'Coast Road', artist: 'Palm Static' }],
    day: {
      chords: [[220.0, 261.63, 329.63], [174.61, 220.0, 261.63], [261.63, 329.63, 392.0], [196.0, 246.94, 293.66]],
      bass: [110.0, 87.31, 130.81, 98.0],
    },
    night: {
      chords: [[220.0, 261.63, 329.63], [146.83, 174.61, 220.0], [164.81, 196.0, 246.94], [220.0, 261.63, 329.63]],
      bass: [110.0, 73.42, 82.41, 110.0],
    },
  },
  {
    name: 'Noche FM', bpm: 96, tag: 'late-night smooth jazz',
    tracks: [{ title: 'Blue Hour', artist: 'Lena Marlowe' }, { title: 'Neon Rain', artist: 'The Cutwater' }],
    day: {
      chords: [[261.63, 329.63, 392.0, 493.88], [220.0, 261.63, 329.63, 392.0], [293.66, 349.23, 440.0, 523.25], [196.0, 246.94, 293.66, 349.23]],
      bass: [130.81, 110.0, 146.83, 98.0],
    },
    night: {
      chords: [[220.0, 261.63, 329.63, 493.88], [164.81, 207.65, 246.94, 329.63], [146.83, 174.61, 220.0, 261.63], [196.0, 246.94, 293.66, 392.0]],
      bass: [110.0, 82.41, 73.42, 98.0],
    },
  },
  {
    name: 'Fuga FM', bpm: 132, tag: 'chase music — fast minor drive',
    tracks: [{ title: 'Redline', artist: 'Vexa' }, { title: 'Sirens', artist: 'Night Pursuit' }],
    day: {
      chords: [[220.0, 261.63, 329.63], [220.0, 261.63, 329.63], [164.81, 207.65, 246.94], [220.0, 261.63, 329.63]],
      bass: [110.0, 110.0, 82.41, 110.0],
    },
    night: {
      chords: [[164.81, 196.0, 246.94], [164.81, 196.0, 246.94], [138.59, 164.81, 207.65], [164.81, 196.0, 246.94]],
      bass: [82.41, 82.41, 69.3, 82.41],
    },
  },
  {
    name: 'Onda FM', bpm: 104, tag: 'island offbeat — bass on the two',
    tracks: [{ title: 'Island Time', artist: 'Cayo Sound' }, { title: 'Low Tide', artist: 'The Breakers' }],
    day: {
      chords: [[261.63, 329.63, 392.0], [196.0, 246.94, 293.66], [220.0, 261.63, 329.63], [174.61, 220.0, 261.63]],
      bass: [130.81, 98.0, 110.0, 87.31],
    },
    night: {
      chords: [[220.0, 261.63, 329.63], [174.61, 220.0, 261.63], [146.83, 174.61, 220.0], [164.81, 207.65, 246.94]],
      bass: [110.0, 87.31, 73.42, 82.41],
    },
  },
];

// The chase groove the game forces at 3+ stars (index into STATIONS).
export const CHASE_STATION = 2;

// Wrap an index into the station list (negative or overshooting is fine).
export function stationAt(i) {
  const n = STATIONS.length;
  return STATIONS[((i % n) + n) % n];
}

// The next station after i (wraps back to Sol FM after Onda FM).
export function nextStation(i) {
  return (i + 1) % STATIONS.length;
}

// The chord set the synth should play for a station right now: the night
// progression after dark, the day one while the sun is up.
export function stationChords(station, night) {
  return night ? station.night : station.day;
}

// Step duration in seconds for a station's tempo (8th notes).
export function stationStepDur(station) {
  return 60 / station.bpm / 2;
}

// One-line label for the HUD radio chip: "♪ Fuga FM — chase music".
export function stationLabel(station) {
  return `♪ ${station.name} — ${station.tag}`;
}

// The track the station is playing right now (first track; cycling the
// dial moves to the next station's first track). Shown on the radio chip.
export function stationTrack(station) {
  const t = (station.tracks && station.tracks[0]) || { title: 'Solmarina FM', artist: 'House Band' };
  return `"${t.title}" — ${t.artist}`;
}

// Full radio-chip line: station, tag and now-playing track.
export function stationNowPlaying(station) {
  return `${stationLabel(station)} · ${stationTrack(station)}`;
}
