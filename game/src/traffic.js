// Ember Harbor — traffic cars and pedestrians. Pure AI: traffic follows the
// street grid, keeps a gap to the car ahead, brakes for jams and for the
// player standing in the road; pedestrians stroll the sidewalks, wait at
// corners, and flee from gunfire, crashes and speeding cars.

import { TRAFFIC } from './config.js';
import { createCar } from './vehicles.js';
import { clamp, createRng, dist, rngInt, rngPick, rngRange, wrapAngle } from './utils.js';

const TRAFFIC_MODELS = ['hatch', 'sedan', 'sedan', 'coupe', 'van', 'pickup', 'taxi'];
const PED_COLORS = [0xd8b48a, 0x7a9ab8, 0xb87a7a, 0x8ab87a, 0xc9a86a, 0x9a8ab8, 0x6a8a8a];

export function createTrafficCar(rng, x, z, heading) {
  const car = createCar(rngPick(rng, TRAFFIC_MODELS), x, z, heading);
  car.speed = rngRange(rng, 7, TRAFFIC.carSpeed);
  car.cruise = rngRange(rng, 8, TRAFFIC.carSpeed);
  car.lane = rng() < 0.5 ? -1 : 1;
  car.wait = 0;
  return car;
}

export function spawnTraffic(seed, city) {
  const rng = createRng(seed + 77);
  const cars = [];
  for (let i = 0; i < TRAFFIC.carCount; i += 1) {
    const alongStreet = rng() < 0.5;
    const street = (rngInt(rng, 1, 9) - 5) * 92;
    const along = rngRange(rng, -420, 420);
    const heading = alongStreet ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    const x = alongStreet ? street + 4 : along;
    const z = alongStreet ? along : street + 4;
    cars.push(createTrafficCar(rng, x, z, heading));
  }
  const peds = [];
  for (let i = 0; i < TRAFFIC.pedCount; i += 1) {
    peds.push(spawnPed(rng));
  }
  return { cars, peds };
}

export function spawnPed(rng) {
  const street = (rngInt(rng, 1, 9) - 5) * 92;
  const along = rngRange(rng, -420, 420);
  const onXStreet = rng() < 0.5;
  return {
    x: onXStreet ? street + 11 : along,
    z: onXStreet ? along : street + 11,
    heading: rngRange(rng, 0, Math.PI * 2),
    speed: rngRange(rng, 0.9, TRAFFIC.pedSpeed),
    color: rngPick(rng, PED_COLORS),
    state: 'walk',
    stateTimer: rngRange(rng, 2, 9),
    fleeX: 0, fleeZ: 0,
    dead: false,
  };
}

function carAhead(cars, self) {
  let best = null;
  let bestD = 16;
  const fx = Math.sin(self.heading);
  const fz = Math.cos(self.heading);
  for (const other of cars) {
    if (other === self || other.wrecked) continue;
    const dx = other.x - self.x;
    const dz = other.z - self.z;
    const forward = dx * fx + dz * fz;
    const side = Math.abs(dx * fz - dz * fx);
    if (forward > 0 && forward < bestD && side < 3.2) { bestD = forward; best = other; }
  }
  return best;
}

export function updateTrafficCar(car, cars, player, dt, city) {
  if (car.wrecked) return car;
  const fx = Math.sin(car.heading);
  const fz = Math.cos(car.heading);
  // Player in the road ahead? Brake hard.
  let target = car.cruise;
  if (player && !player.dead) {
    const dx = player.x - car.x;
    const dz = player.z - car.z;
    const forward = dx * fx + dz * fz;
    const side = Math.abs(dx * fz - dz * fx);
    if (forward > 0 && forward < 12 && side < 2.6) target = 0;
  }
  const ahead = carAhead(cars, car);
  if (ahead) target = Math.min(target, Math.max(0, (dist(car.x, car.z, ahead.x, ahead.z) - 7) * 0.8));
  if (car.wait > 0) { car.wait -= dt; target = 0; }

  car.speed += clamp(target - car.speed, -14 * dt, 7 * dt);
  // At an intersection the car may turn onto the cross street.
  const onGridX = Math.abs(((car.x + 460) % 92) - 46) > 40;
  const onGridZ = Math.abs(((car.z + 460) % 92) - 46) > 40;
  if ((onGridX || onGridZ) && Math.abs(car.speed) > 3) {
    // Keep heading; turns happen at street centrelines only.
  }
  const nx = car.x + fx * car.speed * dt;
  const nz = car.z + fz * car.speed * dt;
  car.x = clamp(nx, -452, 452);
  car.z = clamp(nz, -452, 452);
  // Bounce off the world edge by turning around.
  if (Math.abs(car.x) > 448 || Math.abs(car.z) > 448) car.heading = wrapAngle(car.heading + Math.PI);
  return car;
}

export function updatePed(ped, threats, dt, city) {
  if (ped.dead) return ped;
  ped.stateTimer -= dt;
  let fleeing = false;
  for (const t of threats || []) {
    if (dist(ped.x, ped.z, t.x, t.z) < (t.radius || 18)) {
      fleeing = true;
      ped.fleeX = ped.x - t.x;
      ped.fleeZ = ped.z - t.z;
      break;
    }
  }
  if (fleeing) {
    ped.state = 'flee';
    const len = Math.hypot(ped.fleeX, ped.fleeZ) || 1;
    ped.heading = Math.atan2(ped.fleeX / len, ped.fleeZ / len);
    ped.x += Math.sin(ped.heading) * 4.6 * dt;
    ped.z += Math.cos(ped.heading) * 4.6 * dt;
  } else if (ped.state === 'flee') {
    ped.state = 'walk';
    ped.stateTimer = 3;
  } else if (ped.stateTimer <= 0) {
    if (ped.state === 'walk' && Math.random() < 0.4) {
      ped.state = 'idle';
      ped.stateTimer = 2 + Math.random() * 4;
    } else {
      ped.state = 'walk';
      ped.heading = wrapAngle(ped.heading + (Math.random() * 2.4 - 1.2));
      ped.stateTimer = 3 + Math.random() * 6;
    }
  }
  if (ped.state === 'walk') {
    ped.x += Math.sin(ped.heading) * ped.speed * dt;
    ped.z += Math.cos(ped.heading) * ped.speed * dt;
    ped.x = clamp(ped.x, -452, 452);
    ped.z = clamp(ped.z, -452, 452);
  }
  return ped;
}

// A traffic car that the player crashes into hard becomes a wreck and its
// driver bails out as a fleeing pedestrian.
export function crashTrafficCar(car, speed) {
  if (speed < 8) return null;
  car.health -= 30;
  if (car.health <= 0) {
    car.wrecked = true;
    car.speed = 0;
    return { x: car.x, z: car.z, heading: car.heading, speed: 1.4, color: 0xd8d8d8, state: 'flee', stateTimer: 4, fleeX: 1, fleeZ: 0, dead: false };
  }
  return null;
}
