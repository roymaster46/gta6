// Ember Harbor — r7 effects: particles, screen shake, slow motion,
// muzzle flashes, skid marks, splashes and explosions. All pure state:
// the renderer reads the live particle list and the camera offset, the
// HUD reads the slow-mo timer. Nothing here touches the DOM or THREE.

import { clamp, lerp } from './utils.js';

export const PARTICLE_KINDS = ['smoke', 'spark', 'blood', 'splash', 'dust', 'flame', 'glass', 'rain-splash', 'muzzle', 'wake'];

export function createFxState() {
  return {
    particles: [],
    shake: 0,
    shakeX: 0,
    shakeY: 0,
    slowMo: 0,
    slowMoScale: 1,
    flashes: [],
    skidMarks: [],
    explosions: 0,
    headshots: 0,
    slowMoKills: 0,
    timeScale: 1,
  };
}

export function spawnParticles(state, kind, x, y, z, count, spread) {
  const n = count || 8;
  for (let i = 0; i < n; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const sp = (spread || 3) * (0.4 + Math.random() * 0.8);
    state.particles.push({
      kind,
      x, y: y || 0.5, z,
      vx: Math.sin(a) * sp,
      vy: 1 + Math.random() * 3,
      vz: Math.cos(a) * sp,
      life: 0.5 + Math.random() * 0.7,
      maxLife: 1.2,
      size: 0.2 + Math.random() * 0.5,
      dead: false,
    });
  }
  if (state.particles.length > 400) state.particles.splice(0, state.particles.length - 400);
  return n;
}

export function updateParticles(state, dt) {
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const p = state.particles[i];
    p.life -= dt;
    if (p.life <= 0) { state.particles.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    p.vy -= 6 * dt;
    if (p.kind === 'smoke') { p.vy = Math.abs(p.vy) * 0.2 + 0.8; p.vx *= 0.98; p.vz *= 0.98; }
    if (p.kind === 'splash') p.vy -= 4 * dt;
    if (p.y < 0) { p.y = 0; p.vy = 0; }
  }
  return state.particles.length;
}

export function addShake(state, amount) {
  state.shake = clamp(state.shake + amount, 0, 1.2);
  return state.shake;
}

export function updateShake(state, dt, time) {
  if (state.shake <= 0.01) {
    state.shake = 0;
    state.shakeX = 0;
    state.shakeY = 0;
    return { x: 0, y: 0 };
  }
  state.shake = Math.max(0, state.shake - dt * 1.6);
  const s = state.shake * state.shake;
  state.shakeX = Math.sin(time * 47) * s * 0.6;
  state.shakeY = Math.cos(time * 39) * s * 0.6;
  return { x: state.shakeX, y: state.shakeY };
}

export function triggerSlowMo(state, seconds, scale) {
  state.slowMo = seconds || 1.2;
  state.slowMoScale = scale || 0.25;
  state.timeScale = state.slowMoScale;
  return state.slowMo;
}

export function updateSlowMo(state, dt) {
  if (state.slowMo <= 0) {
    state.timeScale = 1;
    return 1;
  }
  state.slowMo -= dt;
  if (state.slowMo <= 0) {
    state.slowMo = 0;
    state.timeScale = 1;
  }
  return state.timeScale;
}

export function registerHeadshot(state, distance) {
  state.headshots += 1;
  // A long-range headshot triggers slow motion — the game's signature moment.
  if (distance >= 30) {
    triggerSlowMo(state, 1.4, 0.22);
    state.slowMoKills += 1;
    return { slowMo: true, distance };
  }
  return { slowMo: false, distance };
}

export function muzzleFlash(state, x, y, z, heading) {
  state.flashes.push({ x, y: y || 1.4, z, heading, life: 0.08 });
  if (state.flashes.length > 12) state.flashes.shift();
  return state.flashes.length;
}

export function updateFlashes(state, dt) {
  for (let i = state.flashes.length - 1; i >= 0; i -= 1) {
    state.flashes[i].life -= dt;
    if (state.flashes[i].life <= 0) state.flashes.splice(i, 1);
  }
  return state.flashes.length;
}

export function addSkidMark(state, x, z, heading, length) {
  state.skidMarks.push({ x, z, heading, length: length || 2, life: 6 });
  if (state.skidMarks.length > 60) state.skidMarks.shift();
  return state.skidMarks.length;
}

export function updateSkidMarks(state, dt) {
  for (let i = state.skidMarks.length - 1; i >= 0; i -= 1) {
    state.skidMarks[i].life -= dt;
    if (state.skidMarks[i].life <= 0) state.skidMarks.splice(i, 1);
  }
  return state.skidMarks.length;
}

export function explode(state, x, z, radius) {
  state.explosions += 1;
  spawnParticles(state, 'flame', x, 1, z, 26, 6);
  spawnParticles(state, 'smoke', x, 2, z, 18, 4);
  spawnParticles(state, 'spark', x, 1, z, 20, 9);
  addShake(state, 0.9);
  return { type: 'explosion', x, z, radius: radius || 8, count: state.explosions };
}

export function splashAt(state, x, z, speed) {
  const count = Math.round(clamp(speed / 4, 2, 14));
  spawnParticles(state, 'splash', x, 0.2, z, count, 3);
  return count;
}

export function driftSmoke(state, car, dt) {
  if (Math.abs(car.speed) > 12 && car.drift > 0.4) {
    spawnParticles(state, 'smoke', car.x, 0.3, car.z, 2, 1.5);
    addSkidMark(state, car.x, car.z, car.heading, 1.5);
  }
  return state.particles.length;
}

export function fxSummary(state) {
  return {
    particles: state.particles.length,
    shake: Math.round(state.shake * 100) / 100,
    slowMo: Math.round(state.slowMo * 100) / 100,
    timeScale: state.timeScale,
    explosions: state.explosions,
    headshots: state.headshots,
    slowMoKills: state.slowMoKills,
    skidMarks: state.skidMarks.length,
  };
}

export function timeScaleFor(state) {
  return state.slowMo > 0 ? state.slowMoScale : 1;
}

export function lerpCamera(base, shakeOffset, t) {
  return { x: base.x + shakeOffset.x * t, y: base.y + shakeOffset.y * t, z: base.z };
}
