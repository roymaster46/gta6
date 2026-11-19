// Ember Harbor — 5-star response: SWAT and FIB units plus roadblocks.
// At 5 stars the Harbor PD stops sending beat cops and sends in the heavy
// squad: armoured SWAT troopers on foot who shoot on sight, FIB interceptors
// that box the player's car in, and striped roadblocks that seal the avenues
// ahead. Pure state machines; the renderer draws them from this state.

import { clamp, dist, wrapAngle } from './utils.js';
import { createCar } from './vehicles.js';

export const SWAT = {
  runSpeed: 10.2,
  health: 160,
  shootRange: 46,
  shootCooldown: 1.1,
  shootDamage: 11,
  arrestRange: 1.6,
  arrestTime: 1.6,
  sightRange: 85,
  giveUpSeconds: 30,
  maxUnits: 6,
};

export const FIB = {
  carSpeed: 38,
  ramRange: 3.4,
  boxInRange: 9,
  maxCars: 3,
};

export function fiveStarActive(wanted) {
  return wanted.stars >= 5;
}

export function responseTier(stars) {
  if (stars >= 5) return 'swat';
  if (stars >= 4) return 'heli';
  if (stars >= 3) return 'pursuit';
  if (stars >= 1) return 'patrol';
  return 'none';
}

export function createSwatUnit(x, z) {
  return {
    x, z, heading: 0, speed: 0,
    state: 'chase', stateTimer: 0,
    lastSeenX: x, lastSeenZ: z,
    health: SWAT.health, maxHealth: SWAT.health,
    shootTimer: 0.6,
    arrestTimer: 0,
    dead: false,
    kind: 'swat',
  };
}

export function createFibCar(x, z, heading) {
  const car = createCar('cop', x, z, heading);
  car.cruise = FIB.carSpeed;
  car.modelName = 'FIB Interceptor';
  car.color = 0x111827;
  return { car, state: 'chase', stateTimer: 0, ramCooldown: 0, kind: 'fib' };
}

// A SWAT trooper: faster and tougher than a beat cop, shoots instead of
// only grabbing, and only gives up after a long cold trail.
export function updateSwat(unit, player, dt) {
  if (unit.dead) return null;
  const d = dist(unit.x, unit.z, player.x, player.z);
  if (unit.state === 'chase') {
    unit.lastSeenX = player.x;
    unit.lastSeenZ = player.z;
    unit.stateTimer += dt;
    if (d < SWAT.arrestRange) {
      unit.arrestTimer += dt;
      unit.speed = 0;
      if (unit.arrestTimer > SWAT.arrestTime) return 'busted';
      return null;
    }
    unit.arrestTimer = 0;
    const target = Math.atan2(player.x - unit.x, player.z - unit.z);
    unit.heading += clamp(wrapAngle(target - unit.heading), -6 * dt, 6 * dt);
    unit.speed = SWAT.runSpeed;
    unit.x += Math.sin(unit.heading) * unit.speed * dt;
    unit.z += Math.cos(unit.heading) * unit.speed * dt;
    unit.shootTimer -= dt;
    if (d < SWAT.shootRange && unit.shootTimer <= 0) {
      unit.shootTimer = SWAT.shootCooldown;
      return 'shot';
    }
    if (d > SWAT.sightRange) {
      unit.state = 'search';
      unit.stateTimer = 0;
    }
  } else if (unit.state === 'search') {
    unit.stateTimer += dt;
    const target = Math.atan2(unit.lastSeenX - unit.x, unit.lastSeenZ - unit.z);
    unit.heading += clamp(wrapAngle(target - unit.heading), -4 * dt, 4 * dt);
    unit.speed = 6.5;
    unit.x += Math.sin(unit.heading) * unit.speed * dt;
    unit.z += Math.cos(unit.heading) * unit.speed * dt;
    if (d < 30) { unit.state = 'chase'; unit.stateTimer = 0; }
    else if (unit.stateTimer > SWAT.giveUpSeconds) unit.state = 'gone';
  }
  return null;
}

export function damageSwat(unit, amount) {
  if (unit.dead) return false;
  unit.health = Math.max(0, unit.health - amount);
  if (unit.health <= 0) {
    unit.dead = true;
    unit.state = 'gone';
  }
  return true;
}

// An FIB interceptor: faster than a patrol car, rams harder, and tries to
// box the player in by pulling alongside instead of only chasing behind.
export function updateFibCar(unit, player, playerCar, dt) {
  const car = unit.car;
  if (car.wrecked) { unit.state = 'gone'; return unit; }
  unit.ramCooldown = Math.max(0, unit.ramCooldown - dt);
  const tx = playerCar ? playerCar.x : player.x;
  const tz = playerCar ? playerCar.z : player.z;
  const d = dist(car.x, car.z, tx, tz);
  // Box-in: when close, aim for a point beside the player instead of
  // directly at them, so two FIB cars trap the player between them.
  const side = unit.car.x > tx ? 1 : -1;
  const aimX = d < FIB.boxInRange ? tx + side * 4 : tx;
  const aimZ = d < FIB.boxInRange ? tz : tz;
  const target = Math.atan2(aimX - car.x, aimZ - car.z);
  car.heading += clamp(wrapAngle(target - car.heading), -3.1 * dt, 3.1 * dt);
  const want = d > 7 ? FIB.carSpeed : 14;
  car.speed += clamp(want - car.speed, -20 * dt, 14 * dt);
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
  car.x = clamp(car.x, -452, 452);
  car.z = clamp(car.z, -452, 452);
  if (d < FIB.ramRange && unit.ramCooldown <= 0) {
    unit.ramCooldown = 1.2;
    return 'ram';
  }
  if (d > 180) unit.state = 'search';
  return unit;
}

export function spawnSwatForStars(stars, rng, player) {
  const units = [];
  const cars = [];
  if (stars < 5) return { units, cars };
  const nUnits = Math.min(SWAT.maxUnits, 2 + (stars - 4) * 2);
  for (let i = 0; i < nUnits; i += 1) {
    const a = (i / nUnits) * Math.PI * 2 + rng() * 0.6;
    units.push(createSwatUnit(player.x + Math.sin(a) * 36, player.z + Math.cos(a) * 36));
  }
  const nCars = Math.min(FIB.maxCars, stars - 3);
  for (let i = 0; i < nCars; i += 1) {
    const a = (i / nCars) * Math.PI * 2 + rng() * 0.5;
    cars.push(createFibCar(player.x + Math.sin(a) * 52, player.z + Math.cos(a) * 52, a));
  }
  return { units, cars };
}

// --- Roadblocks -----------------------------------------------------------
// A roadblock is two striped barriers plus a patrol car parked across the
// avenue ahead of the player. Driving through one wrecks the car; going
// around it on the sidewalk is the smart move.

export function createRoadblock(x, z, heading) {
  return {
    x, z, heading,
    barriers: [
      { x: x - Math.cos(heading) * 4, z: z + Math.sin(heading) * 4 },
      { x: x + Math.cos(heading) * 4, z: z - Math.sin(heading) * 4 },
    ],
    hp: 100,
    active: true,
    timer: 0,
  };
}

// Place roadblocks on the streets ahead of the player, on the grid lines.
export function planRoadblocks(player, heading, count) {
  const blocks = [];
  const aheadX = Math.sin(heading);
  const aheadZ = Math.cos(heading);
  for (let i = 0; i < count; i += 1) {
    const along = 60 + i * 46;
    let bx = player.x + aheadX * along;
    let bz = player.z + aheadZ * along;
    bx = Math.round(bx / 92) * 92;
    bz = Math.round(bz / 92) * 92;
    blocks.push(createRoadblock(clamp(bx, -414, 414), clamp(bz, -414, 414), heading));
  }
  return blocks;
}

export function updateRoadblock(block, dt) {
  block.timer += dt;
  return block;
}

export function roadblockHit(block, x, z, radius) {
  if (!block.active) return false;
  for (const b of block.barriers) {
    if (dist(x, z, b.x, b.z) < 2.2 + (radius || 0)) return true;
  }
  if (dist(x, z, block.x, block.z) < 3 + (radius || 0)) return true;
  return false;
}

export function damageRoadblock(block, amount) {
  block.hp = Math.max(0, block.hp - amount);
  if (block.hp <= 0) block.active = false;
  return block.hp;
}

export function clearRoadblocks(blocks) {
  return blocks.filter((b) => b.active);
}
