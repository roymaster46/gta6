// Ember Harbor — the wanted system and the Harbor PD. Pure state machine:
// heat (0..5 stars, fractional while it builds), foot cops that chase,
// search and give up, cop cars that chase and ram, roadblocks at 4 stars,
// a helicopter at 4 stars, and a clean escape when the heat decays.

import { POLICE, WANTED } from './config.js';
import { clamp, createRng, dist, rngRange, wrapAngle } from './utils.js';
import { createCar } from './vehicles.js';

export function createWanted() {
  return {
    stars: 0,
    heat: 0,
    notoriety: 0,
    cleanTimer: 0,
    lastCrimeAt: -999,
    busted: false,
    escaped: false,
  };
}

export function addHeat(w, amount, now) {
  w.heat = clamp(w.heat + amount, 0, WANTED.maxStars);
  w.stars = Math.floor(w.heat + 0.0001);
  w.notoriety = clamp(w.notoriety + amount * 4, 0, 100);
  w.cleanTimer = 0;
  w.lastCrimeAt = now;
  return w.stars;
}

export function updateWanted(w, dt, committingCrime) {
  if (committingCrime) {
    w.cleanTimer = 0;
    return w.stars;
  }
  w.cleanTimer += dt;
  if (w.cleanTimer > WANTED.decayDelay && w.heat > 0) {
    w.heat = Math.max(0, w.heat - WANTED.decayPerSecond * dt);
    w.stars = Math.floor(w.heat + 0.0001);
    if (w.heat === 0) w.escaped = true;
  }
  if (w.cleanTimer > 90) w.notoriety = Math.max(0, w.notoriety - dt * 0.4);
  return w.stars;
}

export function clearWanted(w, cost) {
  w.heat = 0;
  w.stars = 0;
  w.cleanTimer = 0;
  return cost;
}

export function notorietyBand(notoriety) {
  if (notoriety >= 80) return 'Most Wanted';
  if (notoriety >= 60) return 'Notorious';
  if (notoriety >= 35) return 'Known Face';
  if (notoriety >= 12) return 'On File';
  return 'Unknown';
}

export function heliActive(w) {
  return w.stars >= WANTED.heliAtStars || (w.stars >= 3 && w.notoriety >= 60);
}

export function roadblockActive(w) {
  return w.stars >= WANTED.roadblockAtStars;
}

export function createCop(x, z) {
  return {
    x, z, heading: 0, speed: 0, state: 'chase', stateTimer: 0,
    lastSeenX: x, lastSeenZ: z, arrestTimer: 0, searchTimer: 0,
  };
}

export function createCopCar(x, z, heading) {
  const car = createCar('cop', x, z, heading);
  car.cruise = POLICE.copCarSpeed;
  return { car, state: 'chase', stateTimer: 0, ramCooldown: 0 };
}

export function updateCop(cop, player, dt) {
  const d = dist(cop.x, cop.z, player.x, player.z);
  if (cop.state === 'chase') {
    cop.lastSeenX = player.x;
    cop.lastSeenZ = player.z;
    cop.stateTimer += dt;
    if (d < POLICE.arrestRange) {
      // Close enough to grab: hold position and count the arrest down.
      cop.arrestTimer += dt;
      cop.speed = 0;
      if (cop.arrestTimer > POLICE.arrestTime) return 'busted';
      return null;
    }
    cop.arrestTimer = 0;
    const target = Math.atan2(player.x - cop.x, player.z - cop.z);
    cop.heading += clamp(wrapAngle(target - cop.heading), -5 * dt, 5 * dt);
    cop.speed = POLICE.copRunSpeed;
    cop.x += Math.sin(cop.heading) * cop.speed * dt;
    cop.z += Math.cos(cop.heading) * cop.speed * dt;
    if (d > POLICE.sightRange) {
      cop.state = 'search';
      cop.stateTimer = 0;
    }
  } else if (cop.state === 'search') {
    cop.stateTimer += dt;
    const target = Math.atan2(cop.lastSeenX - cop.x, cop.lastSeenZ - cop.z);
    cop.heading += clamp(wrapAngle(target - cop.heading), -4 * dt, 4 * dt);
    cop.speed = 5.5;
    cop.x += Math.sin(cop.heading) * cop.speed * dt;
    cop.z += Math.cos(cop.heading) * cop.speed * dt;
    if (d < 26) { cop.state = 'chase'; cop.stateTimer = 0; }
    else if (cop.stateTimer > POLICE.giveUpSeconds) cop.state = 'gone';
  }
  return null;
}

export function updateCopCar(unit, player, playerCar, dt) {
  const car = unit.car;
  if (car.wrecked) { unit.state = 'gone'; return unit; }
  unit.ramCooldown = Math.max(0, unit.ramCooldown - dt);
  const tx = playerCar ? playerCar.x : player.x;
  const tz = playerCar ? playerCar.z : player.z;
  const d = dist(car.x, car.z, tx, tz);
  const target = Math.atan2(tx - car.x, tz - car.z);
  car.heading += clamp(wrapAngle(target - car.heading), -2.6 * dt, 2.6 * dt);
  const want = d > 6 ? POLICE.copCarSpeed : 12;
  car.speed += clamp(want - car.speed, -18 * dt, 12 * dt);
  car.x += Math.sin(car.heading) * car.speed * dt;
  car.z += Math.cos(car.heading) * car.speed * dt;
  car.x = clamp(car.x, -452, 452);
  car.z = clamp(car.z, -452, 452);
  if (d < POLICE.ramRange && unit.ramCooldown <= 0) {
    unit.ramCooldown = 1.4;
    return 'ram';
  }
  if (d > 160) unit.state = 'search';
  return unit;
}

export function spawnCopsForStars(stars, rng, player) {
  const cops = [];
  const cars = [];
  const nFoot = Math.min(POLICE.maxFootCops, stars + 1);
  for (let i = 0; i < nFoot; i += 1) {
    const a = rngRange(rng, 0, Math.PI * 2);
    cops.push(createCop(player.x + Math.sin(a) * 34, player.z + Math.cos(a) * 34));
  }
  const nCars = Math.min(POLICE.maxCopCars, Math.max(0, stars - 1));
  for (let i = 0; i < nCars; i += 1) {
    const a = rngRange(rng, 0, Math.PI * 2);
    cars.push(createCopCar(player.x + Math.sin(a) * 48, player.z + Math.cos(a) * 48, a));
  }
  return { cops, cars };
}

export function updateHeli(heli, player, dt) {
  if (!heli.active) return heli;
  heli.angle += dt * 0.35;
  const tx = player.x + Math.sin(heli.angle) * 14;
  const tz = player.z + Math.cos(heli.angle) * 14;
  heli.x += (tx - heli.x) * Math.min(1, dt * 1.4);
  heli.z += (tz - heli.z) * Math.min(1, dt * 1.4);
  heli.y = 42 + Math.sin(heli.angle * 2) * 3;
  heli.spotX = player.x;
  heli.spotZ = player.z;
  return heli;
}

export function createHeli() {
  return { active: false, x: 0, z: 0, y: 42, angle: 0, spotX: 0, spotZ: 0, health: 100 };
}

export function wantedSummary(w) {
  return {
    stars: w.stars,
    heat: Math.round(w.heat * 100) / 100,
    notoriety: Math.round(w.notoriety),
    band: notorietyBand(w.notoriety),
    heli: heliActive(w),
    roadblock: roadblockActive(w),
  };
}
