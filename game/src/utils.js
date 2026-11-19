// Ember Harbor — pure helpers. No DOM, no THREE, no window here, so Node
// tests can import this file directly. Every function is deterministic for a
// given input; randomness always flows through a seeded generator.

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function smoothstep(t) {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function angleLerp(a, b, t) {
  return a + wrapAngle(b - a) * clamp(t, 0, 1);
}

export function dist2(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

export function dist(ax, az, bx, bz) {
  return Math.sqrt(dist2(ax, az, bx, bz));
}

export function degToRad(d) {
  return (d * Math.PI) / 180;
}

// Mulberry32: small fast seeded PRNG with a clean 32-bit state.
export function createRng(seed) {
  let s = (seed >>> 0) || 1;
  return function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rngInt(rng, lo, hi) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

export function rngPick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

export function rngRange(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}

export function shuffle(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

// 2D hash -> stable pseudo-random in [0,1) for a grid cell. Used to give
// every city block a fixed look without storing a random table.
export function hash2(x, z, seed) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + Math.imul(seed | 0, 974634211)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function formatMoney(n) {
  const v = Math.round(n);
  const sign = v < 0 ? '-' : '';
  return `${sign}$${Math.abs(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

export function formatClock(dayTime) {
  const hours = Math.floor(dayTime * 24);
  const minutes = Math.floor((dayTime * 24 - hours) * 60);
  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function starsText(stars) {
  let out = '';
  for (let i = 0; i < 5; i += 1) out += i < stars ? '★' : '☆';
  return out;
}

export function isOnRoad(x, z) {
  // Streets run on the grid lines: a point is on a road when it is close to
  // a multiple of BLOCK on either axis (inside the half world).
  const bx = Math.abs(x) % 92;
  const bz = Math.abs(z) % 92;
  const nearX = Math.min(bx, 92 - bx) < 8;
  const nearZ = Math.min(bz, 92 - bz) < 8;
  return nearX || nearZ;
}

export function nearestStreetCoord(v) {
  return Math.round(v / 92) * 92;
}

export function clampToWorld(x, z, margin) {
  const lim = 460 - (margin || 6);
  return { x: clamp(x, -lim, lim), z: clamp(z, -lim, lim) };
}

export function moveToward(v, target, maxDelta) {
  if (v < target) return Math.min(v + maxDelta, target);
  if (v > target) return Math.max(v - maxDelta, target);
  return v;
}

// r6 helpers: progress bars, money-per-minute, and a seeded pick that
// reads like English at the call site.
export function progressBar(frac, width) {
  const w = width || 10;
  const filled = Math.round(clamp(frac, 0, 1) * w);
  return '[' + '#'.repeat(filled) + '-'.repeat(w - filled) + ']';
}

export function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function pickWeighted(rng, entries) {
  const total = entries.reduce((sum, e) => sum + (e.weight || 1), 0);
  let roll = rng() * total;
  for (const e of entries) {
    roll -= e.weight || 1;
    if (roll <= 0) return e.value;
  }
  return entries[entries.length - 1].value;
}

export function angleTo(ax, az, bx, bz) {
  return Math.atan2(bx - ax, bz - az);
}

export function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
