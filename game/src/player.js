// Ember Harbor — on-foot player. Pure movement + health logic; the renderer
// draws this state, the input module feeds it. Position is metres, y is
// height above ground, heading is radians (0 = facing -Z / north on the map).

import { HALF, PLAYER } from './config.js';
import { clamp, clampToWorld, dist, wrapAngle } from './utils.js';

export function createPlayer(x, z) {
  return {
    x, z, y: 0, vx: 0, vz: 0, vy: 0,
    heading: Math.PI,
    health: PLAYER.maxHealth,
    onGround: true,
    sprinting: false,
    moving: false,
    dead: false,
    deadTimer: 0,
    punchTimer: 0,
    hurtTimer: 0,
    cash: 60,
    rep: 0,
    // r6: stamina drains on sprint and refills at rest; crouching
    // (Ctrl) halves your speed but keeps you quiet for stealth jobs.
    stamina: 100,
    maxStamina: 100,
    crouching: false,
    exhausted: false,
  };
}

export function updatePlayer(p, input, dt, city) {
  if (p.dead) {
    p.deadTimer += dt;
    p.vx = 0;
    p.vz = 0;
    return p;
  }
  p.punchTimer = Math.max(0, p.punchTimer - dt);
  p.hurtTimer = Math.max(0, p.hurtTimer - dt);

  // Input is camera-relative: forward is away from the camera.
  const fx = Math.sin(input.camYaw);
  const fz = Math.cos(input.camYaw);
  const rx = Math.cos(input.camYaw);
  const rz = -Math.sin(input.camYaw);
  let mx = fx * input.moveY + rx * input.moveX;
  let mz = fz * input.moveY + rz * input.moveX;
  const len = Math.hypot(mx, mz);
  if (len > 1) { mx /= len; mz /= len; }
  p.moving = len > 0.05;

  const speed = input.sprint ? PLAYER.runSpeed : PLAYER.walkSpeed;
  p.sprinting = input.sprint && p.moving;
  // r6: stamina — sprinting drains it, standing still refills it fast,
  // and running it dry forces a walk until it recovers past 25.
  p.crouching = !!input.crouch;
  const crouchFactor = p.crouching ? 0.5 : 1;
  if (p.sprinting) {
    p.stamina = Math.max(0, p.stamina - dt * 16);
    if (p.stamina === 0) p.exhausted = true;
  } else if (!p.moving) {
    p.stamina = Math.min(p.maxStamina, p.stamina + dt * 22);
  } else {
    p.stamina = Math.min(p.maxStamina, p.stamina + dt * 8);
  }
  if (p.exhausted && p.stamina > 25) p.exhausted = false;
  const effSpeed = (p.exhausted ? PLAYER.walkSpeed : speed) * crouchFactor;
  p.vx += (mx * effSpeed - p.vx) * Math.min(1, PLAYER.accel * dt / speed * 6);
  p.vz += (mz * effSpeed - p.vz) * Math.min(1, PLAYER.accel * dt / speed * 6);
  if (len <= 0.05) {
    const f = Math.max(0, 1 - PLAYER.friction * dt / 10);
    p.vx *= f;
    p.vz *= f;
    if (Math.hypot(p.vx, p.vz) < 0.05) { p.vx = 0; p.vz = 0; }
  }

  let nx = p.x + p.vx * dt;
  let nz = p.z + p.vz * dt;
  // Slide along buildings instead of stopping dead.
  if (city) {
    const { resolveBuildingCollision } = city;
    if (resolveBuildingCollision) {
      const r = resolveBuildingCollision(nx, p.z, PLAYER.radius);
      if (r.hit) { nx = r.x; p.vx = 0; }
      const r2 = resolveBuildingCollision(nx, nz, PLAYER.radius);
      if (r2.hit) { nz = r2.z; p.vz = 0; }
    }
  }
  const clamped = clampToWorld(nx, nz, 8);
  p.x = clamped.x;
  p.z = clamped.z;

  if (p.moving) {
    const target = Math.atan2(p.vx, p.vz);
    let d = wrapAngle(target - p.heading);
    p.heading += clamp(d, -9 * dt, 9 * dt);
  }

  if (input.jump && p.onGround) {
    p.vy = PLAYER.jumpSpeed;
    p.onGround = false;
  }
  if (!p.onGround) {
    p.vy -= PLAYER.gravity * dt;
    p.y += p.vy * dt;
    if (p.y <= 0) { p.y = 0; p.vy = 0; p.onGround = true; }
  }
  return p;
}

export function damagePlayer(p, amount) {
  if (p.dead || p.hurtTimer > 0.4) return false;
  p.health = Math.max(0, p.health - amount);
  p.hurtTimer = 0.5;
  if (p.health <= 0) {
    p.dead = true;
    p.deadTimer = 0;
  }
  return true;
}

export function healPlayer(p, amount) {
  p.health = clamp(p.health + amount, 0, PLAYER.maxHealth);
  if (p.health > 0) p.dead = false;
  return p.health;
}

export function respawnPlayer(p, x, z, cost) {
  p.x = x;
  p.z = z;
  p.y = 0;
  p.vx = 0;
  p.vz = 0;
  p.vy = 0;
  p.health = PLAYER.maxHealth;
  p.dead = false;
  p.deadTimer = 0;
  if (cost) p.cash = Math.max(0, p.cash - cost);
  return p;
}

export function playerSpeed(p) {
  return Math.hypot(p.vx, p.vz);
}

export function playerStaminaPct(p) {
  return Math.round((p.stamina / p.maxStamina) * 100);
}

export function isSneaking(p) {
  return !!p.crouching && p.moving;
}

export function nearestToPlayer(p, list, maxDist) {
  let best = null;
  let bestD = maxDist || Infinity;
  for (const item of list) {
    const d = dist(p.x, p.z, item.x, item.z);
    if (d < bestD) { bestD = d; best = item; }
  }
  return best ? { item: best, dist: bestD } : null;
}
