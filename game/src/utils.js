// utils.js — math, seeded RNG and small helpers for Solmarina.
// Every other module imports from here; nothing here touches the DOM.
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
export const dist2 = (x1, y1, x2, y2) => {
  const dx = x2 - x1, dy = y2 - y1;
  return dx * dx + dy * dy;
};
export const angleTo = (x1, y1, x2, y2) => Math.atan2(y2 - y1, x2 - x1);
export function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
export function turnToward(a, b, maxStep) {
  const d = angleDiff(a, b);
  return a + clamp(d, -maxStep, maxStep);
}
// Shortest-path interpolation between two angles (0..1).
export function angleLerp(a, b, t) {
  return a + angleDiff(a, b) * clamp01(t);
}
// Smooth 0..1 ramp between two edges (smoothstep).
export function smoothstep(a, b, x) {
  const f = clamp01((x - a) / (b - a));
  return f * f * (3 - 2 * f);
}
export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const choice = (arr, rng) => arr[Math.floor(rng() * arr.length)];
// Pick n distinct entries from an array (fewer when the array is shorter).
export function pickN(arr, n, rng = Math.random) {
  const copy = arr.slice();
  const out = [];
  while (copy.length && out.length < n) {
    out.push(copy.splice(Math.floor(rng() * copy.length), 1)[0]);
  }
  return out;
}
// Fisher-Yates shuffle, in place, driven by the given rng (seeded when the
// caller passes one, so staged scenes stay deterministic).
export function shuffle(arr, rng = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
// Weighted pick: entries are [value, weight]; returns a value.
export function pickWeighted(entries, rng = Math.random) {
  let total = 0;
  for (const [, w] of entries) total += w;
  let r = rng() * total;
  for (const [v, w] of entries) {
    r -= w;
    if (r <= 0) return v;
  }
  return entries[entries.length - 1][0];
}
// Deterministic 0..1 hash of a grid position — used for lit windows at
// night, so the same building always has the same lit windows.
export function hash2(x, y) {
  let h = (Math.floor(x) * 374761393 + Math.floor(y) * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}
// Deterministic RNG (mulberry32) so ?shot= scenes stage identically.
export function mulberry32(seed) {
  let s = seed >>> 0;
  return function rng() {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
export function circleRect(cx, cy, r, rect) {
  const nx = clamp(cx, rect.x, rect.x + rect.w);
  const ny = clamp(cy, rect.y, rect.y + rect.h);
  return dist2(cx, cy, nx, ny) < r * r;
}
// Push a circle out of a rect; returns true when a collision happened.
export function resolveCircleRect(p, r, rect) {
  const nx = clamp(p.x, rect.x, rect.x + rect.w);
  const ny = clamp(p.y, rect.y, rect.y + rect.h);
  const dx = p.x - nx, dy = p.y - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return false;
  if (d2 === 0) {
    // Centre inside the rect: push out along the smallest penetration axis.
    const left = p.x - rect.x, right = rect.x + rect.w - p.x;
    const top = p.y - rect.y, bottom = rect.y + rect.h - p.y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) p.x = rect.x - r;
    else if (m === right) p.x = rect.x + rect.w + r;
    else if (m === top) p.y = rect.y - r;
    else p.y = rect.y + rect.h + r;
    return true;
  }
  const d = Math.sqrt(d2);
  p.x = nx + (dx / d) * r;
  p.y = ny + (dy / d) * r;
  return true;
}
// Reputation: 500 points per level, level 1 at 0 points. Returns the level
// and how far into it the player is (for the REP progress bar on the HUD).
export function repLevel(rep) {
  const level = Math.floor(rep / 500) + 1;
  return { level, into: rep % 500, need: 500 };
}
export function fmtMoney(n) {
  return '$' + Math.floor(n).toLocaleString('en-US');
}
export function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m + ':' + String(s).padStart(2, '0');
}
// Short countdown for timed objectives: "87s" (never negative).
export function fmtCountdown(sec) {
  return Math.max(0, Math.ceil(sec)) + 's';
}
// "mm:ss" for race timers and survival clocks (same shape as fmtTime, but
// named for what it measures so call sites read clearly).
export function fmtDuration(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
// Wrap an angle to (-PI, PI].
export function clampAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a <= -Math.PI) a += Math.PI * 2;
  return a;
}
export function shade(hex, amt) {
  // Lighten (amt>0) or darken (amt<0) a #rrggbb colour by amt (-100..100).
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
  r = clamp(r, 0, 255); g = clamp(g, 0, 255); b = clamp(b, 0, 255);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
