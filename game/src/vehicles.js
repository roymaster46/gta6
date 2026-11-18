// vehicles.js — car models, driving physics, traffic AI and parked cars.
// A car is a plain object: {x, y, angle, speed, color, model, driver, kind,
// health, damage, waypoint, ...} plus garage upgrades (engine / armour /
// nitro) fitted at the Pay-n-Spray shop. Physics is simple arcade: accel,
// steering scaled by speed, handbrake drift, crash damage. Traffic follows
// road waypoints in a lane, brakes for jams and honks at them; at night the
// whole flow slows a touch (see daynight.trafficFactor).
import { clamp, lerp, angleTo, turnToward, dist, rand, pick, mulberry32 } from './utils.js';
import { WORLD, nearestRoadPoint, nextWaypoint, randomRoadPoint, randomParkedSpot, collideBuildings } from './city.js';
import { topSpeedOf, maxHealthOf, nitroActive, gripOf } from './garage.js';
import { trafficFactor } from './daynight.js';

export const CAR_COLORS = ['#d84a4a', '#3a6fd8', '#e8c832', '#3ab86a', '#e8e8e8', '#2a2a2e', '#d86a2a', '#8a4ad8', '#4ad8d0', '#c0c8d0'];
export const CAR_MODELS = [
  { name: 'Solano', len: 44, wid: 22, top: 150, accel: 240 },   // zippy hatchback
  { name: 'Marina GT', len: 48, wid: 22, top: 185, accel: 270 }, // sports coupe
  { name: 'Carguero', len: 54, wid: 24, top: 120, accel: 180 },  // van
  { name: 'Taxi Sol', len: 46, wid: 22, top: 160, accel: 230 },  // taxi
  { name: 'Patrulla', len: 48, wid: 23, top: 200, accel: 300 },  // police interceptor
  { name: 'Camioneta', len: 52, wid: 24, top: 135, accel: 200 }, // pickup
  { name: 'Moto Sol', len: 34, wid: 14, top: 170, accel: 320 },  // scooter — narrow, quick off the line, sketchy at speed
];
let nextCarId = 1;

export function makeCar(x, y, angle, opts = {}) {
  const model = opts.model || pick(CAR_MODELS);
  return {
    id: nextCarId++,
    x, y, angle,
    speed: 0,
    model,
    color: opts.color || pick(CAR_COLORS),
    kind: opts.kind || 'traffic', // 'traffic' | 'parked' | 'player' | 'police' | 'mission'
    driver: opts.driver || null, // 'traffic' | 'player' | 'police' | null
    health: 100,
    damage: 0,
    waypoint: null,
    dir: opts.dir ?? 0,
    cruise: opts.cruise || rand(70, 120),
    stopped: false,
    stopTimer: 0,
    honkTimer: rand(4, 12),
    brakeLight: false,
    siren: opts.kind === 'police',
    wanted: false,
    label: opts.label || null,
    // Garage upgrades, fitted at the Pay-n-Spray shop (garage.js).
    upgrades: { engine: 0, armor: 0, nitro: false, tires: 0 },
    boostUntil: 0,          // game-time when the current nitro boost ends
    boostCooldownUntil: 0,  // game-time when the next boost is allowed
  };
}

// Current health of a car: max health (raised by armour plating) minus damage.
export function carHealth(car) {
  return Math.max(0, maxHealthOf(car) - car.damage);
}
export function carWrecked(car) {
  return carHealth(car) <= 0;
}
export function damageCar(car, amount, game) {
  car.damage += amount;
  car.health = carHealth(car);
  if (carWrecked(car)) {
    game.events.push({ type: 'explosion', x: car.x, y: car.y });
    if (car.kind === 'player') game.events.push({ type: 'carWrecked' });
  }
}

// Arcade car physics for the player-driven car. `time` is game time in
// seconds; it only matters for nitro (boost window on the car).
export function driveCar(car, input, dt, time = 0) {
  const boosting = nitroActive(car, time);
  const fwd = input.up ? 1 : input.down ? -0.6 : 0;
  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  // A battered car loses top speed; engine tunes and nitro raise it.
  const top = topSpeedOf(car) * (car.health < 40 ? 0.6 : 1) * (boosting ? 1.6 : 1);
  const accel = car.model.accel * (boosting ? 2 : 1);
  if (fwd !== 0) {
    car.speed += fwd * accel * dt * (input.up ? 1 : 0.7);
  } else {
    car.speed = lerp(car.speed, 0, Math.min(1, dt * 1.2));
  }
  if (input.handbrake) {
    car.speed = lerp(car.speed, 0, Math.min(1, dt * 4));
    car.angle += steer * dt * 2.2 * Math.sign(car.speed || 1);
  } else if (Math.abs(car.speed) > 2) {
    // Steering scales with speed and with grip: a car on grip tires turns
    // noticeably sharper at speed than a stock one (garage.gripOf).
    const grip = clamp(Math.abs(car.speed) / 60, 0.25, 1) * gripOf(car);
    car.angle += steer * dt * 1.9 * grip * Math.sign(car.speed);
  }
  car.speed = clamp(car.speed, -top * 0.45, top);
  // Rolling drag.
  car.speed *= Math.max(0, 1 - dt * 0.25);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 30, WORLD - 30);
  car.y = clamp(car.y, 30, WORLD - 30);
  car.brakeLight = !!input.down || input.handbrake;
  return car;
}

// Traffic AI: follow road waypoints in a lane, stop for jams, honk sometimes.
// `time` here is the day/night clock (0..360): traffic cruises slower after
// dark. main.js passes game.clock, not game.time.
export function updateTrafficCar(car, city, cars, dt, time) {
  if (!car.waypoint) {
    const wp = nextWaypoint(city, car.x, car.y, car.dir);
    car.waypoint = wp; car.dir = wp.dir;
  }
  const target = car.waypoint;
  const d = dist(car.x, car.y, target.x, target.y);
  if (d < 26) {
    const wp = nextWaypoint(city, target.x, target.y, car.dir);
    car.waypoint = wp; car.dir = wp.dir;
  }
  // Look ahead for a car stopped in front; brake for it.
  let blocked = false;
  const aheadX = car.x + Math.cos(car.angle) * 52;
  const aheadY = car.y + Math.sin(car.angle) * 52;
  for (const other of cars) {
    if (other === car || other.speed > 5) continue;
    if (dist(aheadX, aheadY, other.x, other.y) < 34) { blocked = true; break; }
  }
  if (blocked) {
    car.speed = lerp(car.speed, 0, Math.min(1, dt * 5));
    car.honkTimer -= dt;
    // Flag the honk for the main loop, which plays it (traffic has no audio).
    if (car.honkTimer <= 0) { car.honkTimer = rand(5, 12); car.honked = true; }
  } else {
    const desired = angleTo(car.x, car.y, target.x, target.y);
    car.angle = turnToward(car.angle, desired, dt * 2.4);
    car.speed = lerp(car.speed, car.cruise * trafficFactor(time), Math.min(1, dt * 0.8));
  }
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 30, WORLD - 30);
  car.y = clamp(car.y, 30, WORLD - 30);
  // Keep traffic off buildings (they stay on roads, but a turn can clip a corner).
  const p = { x: car.x, y: car.y };
  if (collideBuildings(city, p, 16)) { car.x = p.x; car.y = p.y; car.speed *= 0.5; }
  car.brakeLight = blocked;
  return car;
}

// Simple circle-ish collision between two cars; returns impact speed.
export function collideCars(a, b) {
  const r = (a.model.len + b.model.len) / 2 * 0.72;
  const d = dist(a.x, a.y, b.x, b.y);
  if (d >= r || d === 0) return 0;
  const overlap = r - d;
  const nx = (b.x - a.x) / d, ny = (b.y - a.y) / d;
  const rel = Math.abs(a.speed - b.speed);
  a.x -= nx * overlap * 0.5; a.y -= ny * overlap * 0.5;
  b.x += nx * overlap * 0.5; b.y += ny * overlap * 0.5;
  const impact = rel + Math.abs(a.speed) * 0.3;
  a.speed *= 0.55; b.speed *= 0.55;
  if (impact > 60) {
    // Damage is measured against each car's own max health, so an armoured
    // car survives hits that would total a stock one.
    a.damage += impact * 0.08; a.health = carHealth(a);
    b.damage += impact * 0.08; b.health = carHealth(b);
  }
  return impact;
}

export function spawnTraffic(city, count, rng) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const p = randomRoadPoint(city, rng);
    const snap = nearestRoadPoint(city, p.x, p.y);
    const angle = snap.vertical ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI);
    const lane = rng() < 0.5 ? -14 : 14;
    const car = makeCar(
      snap.vertical ? snap.x + lane : p.x,
      snap.vertical ? p.y : snap.y + lane,
      angle,
      { kind: 'traffic', driver: 'traffic', cruise: 70 + rng() * 55 }
    );
    car.speed = car.cruise * 0.8;
    cars.push(car);
  }
  return cars;
}

export function spawnParked(city, count, rng) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const p = randomParkedSpot(city, rng);
    const snap = nearestRoadPoint(city, p.x, p.y);
    const angle = snap.vertical ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI);
    cars.push(makeCar(p.x, p.y, angle, { kind: 'parked', driver: null }));
  }
  return cars;
}
export function nearestCar(cars, x, y, maxDist = 90) {
  let best = null, bestD = maxDist;
  for (const c of cars) {
    const d = dist(x, y, c.x, c.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}
