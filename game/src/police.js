// Ember Harbor — the wanted system and the Harbor PD. Pure state machine:
// heat (0..5 stars, fractional while it builds), foot cops that chase,
// search and give up, cop cars that chase and ram, roadblocks at 4 stars,
// a helicopter at 4 stars, and a clean escape when the heat decays.

import { POLICE, WANTED } from './config.js';
import { clamp, createRng, dist, rngRange, wrapAngle } from './utils.js';
import { createCar } from './vehicles.js';
import { createRoadblock, planRoadblocks, responseTier, spawnSwatForStars } from './swat.js';

export { responseTier };

// r6: heat by named crime, so missions and events can log exactly what
// the player did — and so a vault grab or a heli theft is worth more heat
// than a punch. Returns the new star count.
export function addHeatFor(w, crime, now) {
  const amount = (WANTED.crimes && WANTED.crimes[crime]) ?? 1;
  return addHeat(w, amount, now);
}

export function crimesForStars(stars) {
  if (stars >= 5) return ['swat', 'fib', 'heli', 'roadblock'];
  if (stars >= 4) return ['heli', 'roadblock'];
  if (stars >= 3) return ['pursuit'];
  if (stars >= 1) return ['patrol'];
  return [];
}

export function isFiveStar(w) {
  return w.stars >= WANTED.swatAtStars;
}

export function createRoadblockState() {
  return { blocks: [], spawnTimer: 0, placed: 0 };
}

export function updateRoadblocks(state, wanted, player, dt) {
  if (wanted.stars < WANTED.roadblockAtStars) {
    if (state.blocks.length > 0) state.blocks = [];
    return state;
  }
  state.spawnTimer -= dt;
  const want = Math.min(WANTED.roadblockMax, wanted.stars - 2);
  if (state.blocks.length < want && state.spawnTimer <= 0) {
    state.spawnTimer = 18;
    const fresh = planRoadblocks(player, player.heading || 0, 1);
    state.blocks.push(...fresh);
    state.placed += 1;
  }
  state.blocks = state.blocks.filter((b) => b.active);
  return state;
}

export function roadblockBlocksCar(state, x, z, radius) {
  for (const b of state.blocks) {
    for (const bar of b.barriers) {
      if (dist(x, z, bar.x, bar.z) < 2.4 + (radius || 0)) return b;
    }
  }
  return null;
}

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
  // r6: 5 stars brings the SWAT squad and FIB interceptors instead of
  // just more beat cops — the response visibly changes at the top.
  const swat = spawnSwatForStars(stars, rng, player);
  return { cops, cars, swatUnits: swat.units, fibCars: swat.cars };
}

export function wantedTierLabel(stars) {
  if (stars >= 5) return 'FIVE-STAR — SWAT & FIB';
  if (stars >= 4) return 'Air support overhead';
  if (stars >= 3) return 'Full pursuit';
  if (stars >= 1) return 'Police responding';
  return 'Clean';
}

// r7: the seven-star legend — permanent reputation tiers (1–7) that sit
// above the 0–5 wanted stars. Heat is the chase; legend is the name.
// Legend grows with rep and never decays; at 6+ the city treats Vex as
// a harbour legend, and the final missions unlock.
export function legendFor(rep) {
  const tiers = [
    { stars: 1, name: 'Nobody', rep: 0 },
    { stars: 2, name: 'Small Name', rep: 50 },
    { stars: 3, name: 'Known Face', rep: 150 },
    { stars: 4, name: 'Harbour Regular', rep: 300 },
    { stars: 5, name: 'Most Wanted', rep: 500 },
    { stars: 6, name: 'Harbour Legend', rep: 800 },
    { stars: 7, name: 'SEVEN-STAR', rep: 1200 },
  ];
  let tier = tiers[0];
  for (const t of tiers) if (rep >= t.rep) tier = t;
  return tier;
}

export function legendStars(rep) {
  return legendFor(rep).stars;
}

export function legendLabel(rep) {
  return legendFor(rep).name;
}

// Live wanted UI: stars rise/fall with a direction arrow, and the HUD
// shows whether the heat is climbing, holding or cooling off.
export function wantedDirection(w, prevHeat) {
  if (w.heat > (prevHeat || 0) + 0.05) return 'rising';
  if (w.heat < (prevHeat || 0) - 0.05) return 'falling';
  return 'steady';
}

export function wantedDisplay(w, prevHeat) {
  return {
    stars: w.stars,
    heat: Math.round(w.heat * 100) / 100,
    direction: wantedDirection(w, prevHeat),
    band: notorietyBand(w.notoriety),
    tier: responseTier(w.stars),
    tierLabel: wantedTierLabel(w.stars),
    legend: legendFor(w.notoriety),
  };
}

// Night patrols are stricter: the same crime builds heat faster after
// dark, and roadblocks appear a star earlier.
export function nightPatrolMultiplier(dayTime) {
  return (dayTime < 0.22 || dayTime >= 0.85) ? 1.35 : dayTime >= 0.68 && dayTime < 0.85 ? 1.15 : 1;
}

export function heatForCrimeAt(w, crime, now, dayTime, weather) {
  let amount = (WANTED.crimes && WANTED.crimes[crime]) ?? 1;
  amount *= nightPatrolMultiplier(dayTime);
  if (weather === 'rain') amount *= 0.9;
  if (weather === 'fog') amount *= 0.85;
  return addHeat(w, amount, now);
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
    // r6: the summary now tells the HUD exactly which top-tier response
    // is live, so the 5-star banner can say SWAT instead of just stars.
    tier: responseTier(w.stars),
    tierLabel: wantedTierLabel(w.stars),
    fiveStar: isFiveStar(w),
  };
}
