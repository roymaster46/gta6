// Ember Harbor — helicopters. Two kinds share this module: the police
// helicopter that hunts the player from 4 stars up, and a flyable helicopter
// the player can steal from the Harbor Heliport and fly anywhere in the
// city. Pure logic — the renderer only reads positions, altitude and rotor
// state. A heli is data + motion: lift, forward speed, yaw and health.

import { clamp, dist, wrapAngle } from './utils.js';

export const HELI = {
  maxAltitude: 120,
  minAltitude: 2,
  liftAccel: 14,
  sinkAccel: 18,
  maxSpeed: 42,
  maxReverse: 12,
  turnRate: 1.9,
  maxHealth: 120,
  rotorSpinUp: 2.2,
  spotlightRange: 90,
  crashDamage: 60,
};

// A parked, stealable helicopter sitting on a helipad.
export function createPlayerHeli(x, z) {
  return {
    x, z, y: 0,
    heading: 0,
    speed: 0,
    verticalSpeed: 0,
    altitude: 0,
    rotor: 0,
    spinning: false,
    health: HELI.maxHealth,
    maxHealth: HELI.maxHealth,
    wrecked: false,
    occupied: false,
    stolen: false,
    fuel: 100,
    engineOn: false,
  };
}

// The police helicopter: orbits the player, keeps its spotlight on them,
// and radios their position so foot cops and cop cars converge faster.
export function createPoliceHeli() {
  return {
    active: false,
    x: 0, z: 0, y: 42,
    angle: 0,
    spotX: 0, spotZ: 0,
    health: 100,
    shooting: false,
    shootTimer: 2,
    callTimer: 0,
    // How often the heli radios the player's position to ground units.
    callInterval: 4,
  };
}

export function heliOrbitTarget(heli, player, dt) {
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

// The police heli calls in ground units on a timer; the caller spawns them.
// Returns true on the frames a call goes out.
export function updatePoliceHeli(heli, player, dt) {
  if (!heli.active) return false;
  heliOrbitTarget(heli, player, dt);
  heli.callTimer -= dt;
  if (heli.callTimer <= 0) {
    heli.callTimer = heli.callInterval;
    return true;
  }
  return false;
}

// At 5 stars the police heli stops circling politely and starts firing
// short bursts at the player. Returns 'shooting' while a burst is live.
export function updatePoliceHeliFire(heli, player, dt, stars) {
  if (!heli.active || stars < 5) {
    heli.shooting = false;
    return null;
  }
  heli.shootTimer -= dt;
  if (heli.shootTimer <= 0) {
    heli.shooting = !heli.shooting;
    heli.shootTimer = heli.shooting ? 0.9 : 2.4;
  }
  if (!heli.shooting) return null;
  const d = dist(heli.x, heli.z, player.x, player.z);
  if (d > HELI.spotlightRange) return null;
  return { type: 'heli-fire', damage: 6, fromX: heli.x, fromZ: heli.z };
}

// Damage a police heli; returns true when it is shot down and goes away.
export function damagePoliceHeli(heli, amount) {
  heli.health = Math.max(0, heli.health - amount);
  if (heli.health <= 0) {
    heli.active = false;
    heli.health = 100;
    return true;
  }
  return false;
}

// Fly the player's heli. Input: {lift (-1..1), throttle (-1..1),
// steer (-1..1), yaw} — lift is Space / X, throttle is W/S, steer is A/D.
// Returns the heli; wrecked helis fall out of the sky and stay down.
export function updatePlayerHeli(heli, input, dt) {
  if (heli.wrecked) {
    heli.altitude = Math.max(0, heli.altitude - 26 * dt);
    heli.y = heli.altitude;
    heli.rotor = Math.max(0, heli.rotor - dt * 0.5);
    return heli;
  }
  if (input.lift > 0 || input.throttle !== 0 || input.steer !== 0) {
    heli.engineOn = true;
  }
  if (heli.engineOn) {
    heli.rotor = Math.min(1, heli.rotor + dt / HELI.rotorSpinUp);
  } else {
    heli.rotor = Math.max(0, heli.rotor - dt);
  }
  const spin = heli.rotor;
  // Vertical: lift climbs, gravity sinks when the rotor is not spun up.
  const lift = input.lift * HELI.liftAccel * spin;
  heli.verticalSpeed += (lift - HELI.sinkAccel * (1 - spin) - 2.5) * dt;
  heli.verticalSpeed = clamp(heli.verticalSpeed, -16, 14);
  heli.altitude = clamp(heli.altitude + heli.verticalSpeed * dt, 0, HELI.maxAltitude);
  if (heli.altitude === 0 && heli.verticalSpeed < 0) heli.verticalSpeed = 0;
  if (heli.altitude === HELI.maxAltitude && heli.verticalSpeed > 0) heli.verticalSpeed = 0;
  heli.y = heli.altitude;
  // Forward flight only really works once airborne.
  const airFactor = clamp(heli.altitude / 6, 0, 1);
  const target = input.throttle * HELI.maxSpeed * airFactor * spin;
  heli.speed += clamp(target - heli.speed, -20 * dt, 12 * dt);
  heli.heading += (input.steer || 0) * HELI.turnRate * dt * clamp(Math.abs(heli.speed) / 10 + 0.3, 0, 1);
  heli.heading = wrapAngle(heli.heading);
  heli.x += Math.sin(heli.heading) * heli.speed * dt;
  heli.z += Math.cos(heli.heading) * heli.speed * dt;
  heli.x = clamp(heli.x, -452, 452);
  heli.z = clamp(heli.z, -452, 452);
  // Fuel burns while the engine runs; out of fuel means a forced landing.
  if (heli.engineOn && spin > 0.2) {
    heli.fuel = Math.max(0, heli.fuel - dt * 0.55);
    if (heli.fuel === 0) heli.engineOn = false;
  }
  return heli;
}

export function refuelHeli(heli) {
  heli.fuel = 100;
  return heli.fuel;
}

export function damagePlayerHeli(heli, amount) {
  if (heli.wrecked) return false;
  heli.health = Math.max(0, heli.health - amount);
  if (heli.health <= 0) {
    heli.health = 0;
    heli.wrecked = true;
    heli.speed = 0;
    heli.occupied = false;
  }
  return true;
}

// Hard landing: coming down fast damages the heli and can wreck it.
export function heliLandingCheck(heli) {
  if (heli.altitude > 0.5) return null;
  if (heli.verticalSpeed < -9) {
    damagePlayerHeli(heli, HELI.crashDamage);
    return { type: 'hard-landing', damage: HELI.crashDamage };
  }
  if (heli.verticalSpeed < -4) {
    damagePlayerHeli(heli, 12);
    return { type: 'rough-landing', damage: 12 };
  }
  return { type: 'landed' };
}

export function heliCanTakeOff(heli) {
  return !heli.wrecked && heli.fuel > 0 && heli.health > 0;
}

export function heliAltitudeBand(heli) {
  if (heli.altitude < 1) return 'grounded';
  if (heli.altitude < 25) return 'low';
  if (heli.altitude < 70) return 'cruising';
  return 'high';
}

// A heli gun run: the player's heli has no mounted gun, but the pilot can
// fire their own weapon from the cabin — this is the ray check the caller
// uses for heli-vs-ground targets while airborne.
export function heliFireRange(heli) {
  return heli.altitude > 2 ? 60 + heli.altitude * 0.4 : 0;
}

export function nearestHeli(helis, x, z, maxDist) {
  let best = null;
  let bestD = maxDist || Infinity;
  for (const h of helis) {
    if (h.wrecked) continue;
    const d = dist(x, z, h.x, h.z);
    if (d < bestD) { bestD = d; best = h; }
  }
  return best ? { heli: best, dist: bestD } : null;
}

// Police heli escalation: which stars bring which air response.
export function airResponseForStars(stars, notoriety) {
  if (stars >= 5) return { helis: 2, armed: true, calls: true };
  if (stars >= 4) return { helis: 1, armed: false, calls: true };
  if (stars >= 3 && notoriety >= 60) return { helis: 1, armed: false, calls: false };
  return { helis: 0, armed: false, calls: false };
}

// Landing pads: the heliport apron (open ground beside the terminal, not
// inside it — a pad under a building is a wall, not a landing zone) plus
// two rooftops the missions use.
export const HELI_PADS = [
  { id: 'heliport', name: 'Harbor Heliport', x: 368, z: -138, radius: 10 },
  { id: 'tower-roof', name: 'Harborview Tower Roof', x: 322, z: -46, radius: 9 },
  { id: 'hospital-roof', name: 'St. Anselm Roof', x: -322, z: 138, radius: 9 },
  // r7: a fourth pad on the docks crane platform, for the Ferry Gambit.
  { id: 'docks-crane', name: 'Docks Crane Platform', x: 400, z: 138, radius: 9 },
];

export function padAt(x, z) {
  for (const pad of HELI_PADS) {
    if (dist(x, z, pad.x, pad.z) < pad.radius) return pad;
  }
  return null;
}

export function onPad(heli) {
  return padAt(heli.x, heli.z);
}

// r7: storms ground the helicopter — the pilot can feel it in the rotor
// before the HUD says it. Night landings are harder: the pad lights are
// the only guide, so the landing check is stricter after dark.
export function canFlyNow(heli, weather, dayTime) {
  if (heli.wrecked || heli.fuel <= 0) return { ok: false, reason: 'heli not airworthy' };
  if (weather === 'storm') return { ok: false, reason: 'storm — heli grounded' };
  return { ok: true };
}

export function landingDifficulty(dayTime, weather) {
  let d = 1;
  if (dayTime < 0.22 || dayTime >= 0.85) d += 0.5;
  if (weather === 'rain') d += 0.4;
  if (weather === 'fog') d += 0.6;
  return d;
}

export function heliSkillGain(heli, dt) {
  // Flying time is flying skill: 1 point per 10 s airborne.
  if (heli.altitude > 5) return dt / 10;
  return 0;
}
