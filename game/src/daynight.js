// daynight.js — Solmarina's clock: a six-minute day cycle.
// The city runs on a 360-second loop: long sunny day, a short dusk, a
// proper night, then dawn. Light level drives the renderer (dark overlay,
// lamp glow, headlights, lit windows) and the world (fewer peds at night,
// traffic drives slower, Mission 7 only runs after dark).
export const CYCLE = 360; // seconds per full day

// Phase boundaries in cycle seconds. Light is 1.0 at noon, ~0.3 at midnight.
const PHASES = [
  { from: 0, to: 150, name: 'Day', light: 1.0 },
  { from: 150, to: 180, name: 'Dusk', light: 0.55 },
  { from: 180, to: 300, name: 'Night', light: 0.32 },
  { from: 300, to: 330, name: 'Dawn', light: 0.6 },
  { from: 330, to: 360, name: 'Day', light: 1.0 },
];

function wrap(t) {
  return ((t % CYCLE) + CYCLE) % CYCLE;
}

// Smooth interpolation between two light levels across a phase boundary.
function ramp(a, b, f) {
  const s = f * f * (3 - 2 * f); // smoothstep, no hard edge at the seam
  return a + (b - a) * s;
}

// Light level (0..1) at cycle time t. Dusk and dawn are 30-second ramps.
export function lightAt(t) {
  const w = wrap(t);
  if (w < 150) return 1.0;
  if (w < 180) return ramp(1.0, 0.32, (w - 150) / 30);
  if (w < 300) return 0.32;
  if (w < 330) return ramp(0.32, 1.0, (w - 300) / 30);
  return 1.0;
}

export function phaseAt(t) {
  const w = wrap(t);
  for (const p of PHASES) {
    if (w >= p.from && w < p.to) return { name: p.name, light: lightAt(w), t: w };
  }
  return { name: 'Day', light: 1.0, t: w };
}

export function isNight(t) {
  return phaseAt(t).name === 'Night';
}

export function isDark(t) {
  return lightAt(t) < 0.7;
}

// Seconds until the next night phase starts (0 when already night).
export function timeUntilNight(t) {
  const w = wrap(t);
  if (w >= 180 && w < 300) return 0;
  if (w < 180) return 180 - w;
  return 180 + (CYCLE - w);
}

// Jump the clock straight to nightfall (used when Mission 7 starts in the
// daytime: Leo waits for dark instead of doing a night job at noon).
export function advanceToNight(t) {
  return wrap(t) < 180 || wrap(t) >= 300 ? 180 : wrap(t);
}

// Clock face for the HUD: the 360-second cycle maps onto a 24-hour day,
// starting at 08:00 so the game opens in morning sun.
export function clockLabel(t) {
  const mins = Math.floor((wrap(t) / CYCLE) * 24 * 60) + 8 * 60;
  const hh = Math.floor(mins / 60) % 24;
  const mm = mins % 60;
  return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}

// How many pedestrians the city should hold at this hour: the streets thin
// out after dark, but the beach keeps a few night owls.
export function pedTarget(t) {
  const p = phaseAt(t);
  if (p.name === 'Night') return 12;
  if (p.name === 'Dusk' || p.name === 'Dawn') return 18;
  return 26;
}

// Traffic cruise factor by hour: everyone drives a little slower at night.
export function trafficFactor(t) {
  return isNight(t) ? 0.85 : 1.0;
}
