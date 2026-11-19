// Ember Harbor — cars. Pure arcade physics: a car has a position, a
// heading, a forward speed and a health bar. Steering scales with speed,
// the rear slides a little when you handbrake, nitro multiplies top speed.
// Colours and models are the renderer's job; here a car is data + motion.

import { CAR } from './config.js';
import { clamp, dist, wrapAngle } from './utils.js';

export const CAR_MODELS = [
  { id: 'hatch', name: 'Pip Hatch', top: 26, accel: 15, color: 0x7a8a99, value: 180, w: 1.8, l: 3.6 },
  { id: 'sedan', name: 'Marlin Sedan', top: 31, accel: 17, color: 0x3a5a8a, value: 260, w: 1.9, l: 4.2 },
  { id: 'coupe', name: 'Falcon GT', top: 38, accel: 21, color: 0xc22e2e, value: 420, w: 1.9, l: 4.4 },
  { id: 'taxi', name: 'Harbor Cab', top: 29, accel: 16, color: 0xf2c200, value: 220, w: 1.9, l: 4.2 },
  { id: 'van', name: 'Cargo Van', top: 24, accel: 13, color: 0x8a7a5a, value: 240, w: 2.1, l: 4.8 },
  { id: 'pickup', name: 'Dune Pickup', top: 30, accel: 16, color: 0x4a7a4a, value: 300, w: 2.0, l: 4.6 },
  { id: 'cop', name: 'HPD Interceptor', top: 36, accel: 22, color: 0x1e4fd8, value: 0, w: 1.9, l: 4.4 },
  // r6: two new classes on the road — a quick, fragile motorbike that
  // weaves through traffic, and a slow, heavy truck that shrugs off bumps.
  { id: 'bike', name: 'Ember 900 Bike', top: 34, accel: 24, color: 0xd84a2f, value: 200, w: 0.9, l: 2.2 },
  { id: 'truck', name: 'Harbor Hauler', top: 22, accel: 11, color: 0x5a6a7a, value: 380, w: 2.4, l: 6.4 },
];

export function vehicleClass(modelId) {
  if (modelId === 'bike') return 'bike';
  if (modelId === 'truck' || modelId === 'van') return 'heavy';
  if (modelId === 'cop') return 'police';
  return 'car';
}

export function isTwoWheeler(modelId) {
  return modelId === 'bike';
}

// r6 garage upgrades: engine (+12% top speed per level), grip (+10%
// handling) and armour (-12% damage taken). Bought at Rusty Wrench.
export function upgradeCar(car, kind, cash, price) {
  if (cash < price) return { ok: false, cash, reason: 'not enough cash' };
  if (kind === 'engine' && car.engine >= 3) return { ok: false, cash, reason: 'engine maxed' };
  if (kind === 'grip' && car.grip >= 3) return { ok: false, cash, reason: 'grip maxed' };
  if (kind === 'armour' && car.armour >= 3) return { ok: false, cash, reason: 'armour maxed' };
  if (kind === 'engine') car.engine += 1;
  else if (kind === 'grip') car.grip += 1;
  else if (kind === 'armour') car.armour += 1;
  else return { ok: false, cash, reason: 'unknown upgrade' };
  return { ok: true, cash: cash - price, kind, level: car[kind] };
}

export function upgradeSummary(car) {
  return { engine: car.engine, grip: car.grip, armour: car.armour };
}

export function modelById(id) {
  return CAR_MODELS.find((m) => m.id === id) || CAR_MODELS[1];
}

export function createCar(modelId, x, z, heading) {
  const model = modelById(modelId);
  return {
    model: model.id, modelName: model.name, color: model.color, value: model.value,
    x, z, heading: heading || 0, speed: 0,
    health: CAR.maxHealth, maxHealth: CAR.maxHealth,
    wrecked: false, stolen: false, isPlayerCar: false,
    nitro: 1, nitroActive: 0, nitroCooldown: 0,
    engine: 0, grip: 0, armour: 0,
    steer: 0, drift: 0, lights: false,
  };
}

export function updateCar(car, input, dt, collide) {
  if (car.wrecked) {
    car.speed = car.speed * Math.max(0, 1 - 4 * dt);
    if (Math.abs(car.speed) < 0.1) car.speed = 0;
    return car;
  }
  const model = modelById(car.model);
  const top = model.top * (1 + car.engine * 0.12) * (car.nitroActive > 0 ? CAR.nitroBoost : 1);
  const accel = model.accel * (1 + car.engine * 0.1);

  if (input.nitro && car.nitro > 0.25 && car.nitroCooldown <= 0 && car.speed > 4) {
    car.nitroActive = CAR.nitroTime;
    car.nitroCooldown = CAR.nitroCooldown;
  }
  if (car.nitroActive > 0) car.nitroActive -= dt;
  if (car.nitroCooldown > 0) car.nitroCooldown -= dt;
  car.nitro = clamp(car.nitro + (car.nitroActive > 0 ? -dt / CAR.nitroTime : dt / 14), 0, 1);

  const steerTarget = (input.steer || 0) * CAR.steerMax * clamp(Math.abs(car.speed) / 8, 0, 1);
  car.steer += (steerTarget - car.steer) * Math.min(1, CAR.steerSpeed * 3 * dt);
  // r6: bikes lean and turn sharper, trucks wallow — the class matters.
  const classFactor = model.id === 'bike' ? 1.35 : model.id === 'truck' ? 0.7 : 1;
  const gripFactor = (1 + car.grip * 0.1) / classFactor;
  car.heading += (car.steer * (car.speed / 6) * (input.handbrake ? 1.7 : 1) / gripFactor) * dt;
  car.heading = wrapAngle(car.heading);

  if (input.throttle > 0) car.speed += accel * input.throttle * dt;
  else if (input.throttle < 0) {
    if (car.speed > 0.5) car.speed -= CAR.brake * dt;
    else car.speed += CAR.reverseAccel * input.throttle * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), CAR.drag * 6 * dt);
  }
  if (input.handbrake) {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 22 * dt);
    car.drift = clamp(car.drift + dt * 2, 0, 1);
  } else {
    car.drift = Math.max(0, car.drift - dt * 3);
  }
  car.speed = clamp(car.speed, -CAR.maxReverse, top);

  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  if (collide) {
    const r = collide(nx, nz, 1.4);
    if (r.hit) {
      car.x = r.x; car.z = r.z;
      if (Math.abs(car.speed) > 9) damageCar(car, CAR.damagePerHit);
      car.speed *= -0.25;
    } else { car.x = nx; car.z = nz; }
  } else { car.x = nx; car.z = nz; }
  car.x = clamp(car.x, -452, 452);
  car.z = clamp(car.z, -452, 452);
  return car;
}

export function damageCar(car, amount) {
  if (car.wrecked) return false;
  const armour = 1 - car.armour * 0.12;
  car.health = Math.max(0, car.health - amount * armour);
  if (car.health <= 0) {
    car.health = 0;
    car.wrecked = true;
    car.speed = 0;
  }
  return true;
}

export function repairCar(car, amount) {
  car.health = clamp(car.health + amount, 0, car.maxHealth);
  if (car.health > 0) car.wrecked = false;
  return car.health;
}

export function chopValue(car) {
  if (car.model === 'cop') return 0;
  return Math.round(car.value * (0.25 + 0.75 * (car.health / car.maxHealth)));
}

export function nearestCar(cars, x, z, maxDist) {
  let best = null;
  let bestD = maxDist || Infinity;
  for (const car of cars) {
    if (car.wrecked) continue;
    const d = dist(x, z, car.x, car.z);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best ? { car: best, dist: bestD } : null;
}

export function carSeatPosition(car) {
  return { x: car.x - Math.sin(car.heading) * 1.6, z: car.z - Math.cos(car.heading) * 1.6 };
}
