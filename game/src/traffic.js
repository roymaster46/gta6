// Ember Harbor — traffic cars and pedestrians. Pure AI: traffic follows the
// street grid, keeps a gap to the car ahead, brakes for jams and for the
// player standing in the road; pedestrians stroll the sidewalks, wait at
// corners, and flee from gunfire, crashes and speeding cars.

import { TRAFFIC } from './config.js';
import { createCar } from './vehicles.js';
import { clamp, createRng, dist, rngInt, rngPick, rngRange, wrapAngle } from './utils.js';

const TRAFFIC_MODELS = ['hatch', 'sedan', 'sedan', 'coupe', 'van', 'pickup', 'taxi', 'bike', 'bike', 'truck'];
const PED_COLORS = [0xd8b48a, 0x7a9ab8, 0xb87a7a, 0x8ab87a, 0xc9a86a, 0x9a8ab8, 0x6a8a8a];
// r6: pedestrians are no longer clones — an archetype sets their pace and
// how often they stop, so joggers hurry past vendors who mostly stand still.
const PED_ARCHETYPES = ['commuter', 'jogger', 'vendor', 'tourist', 'dockworker', 'student'];
const ARCHETYPE_SPEED = { commuter: 1.6, jogger: 3.4, vendor: 0.7, tourist: 1.1, dockworker: 1.9, student: 2.2 };

export function createTrafficCar(rng, x, z, heading) {
  const car = createCar(rngPick(rng, TRAFFIC_MODELS), x, z, heading);
  // r6: bikes are quick and light, trucks are slow and heavy — the cruise
  // speed follows the model, not a single traffic number.
  const base = car.model === 'bike' ? 14 : car.model === 'truck' ? 8 : TRAFFIC.carSpeed;
  car.speed = rngRange(rng, Math.max(5, base - 3), base);
  car.cruise = rngRange(rng, Math.max(5, base - 2), base);
  car.lane = rng() < 0.5 ? -1 : 1;
  car.wait = 0;
  car.weave = car.model === 'bike' ? rngRange(rng, 0.5, 1.5) : 0;
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
  const archetype = rngPick(rng, PED_ARCHETYPES);
  return {
    x: onXStreet ? street + 11 : along,
    z: onXStreet ? along : street + 11,
    heading: rngRange(rng, 0, Math.PI * 2),
    speed: ARCHETYPE_SPEED[archetype] * rngRange(rng, 0.85, 1.15),
    color: rngPick(rng, PED_COLORS),
    state: 'walk',
    stateTimer: rngRange(rng, 2, 9),
    fleeX: 0, fleeZ: 0,
    dead: false,
    archetype,
    // Vendors and tourists pause a lot; joggers almost never stop.
    idleChance: archetype === 'vendor' ? 0.8 : archetype === 'tourist' ? 0.6 : archetype === 'jogger' ? 0.05 : 0.35,
  };
}

export function pedArchetypeSpeed(archetype) {
  return ARCHETYPE_SPEED[archetype] || 1.6;
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
  // r6: bikes weave gently in their lane instead of holding a dead
  // straight line — they read as alive even from a distance.
  if (car.weave && car.speed > 4) {
    const sideX = Math.cos(car.heading);
    const sideZ = -Math.sin(car.heading);
    const wobble = Math.sin((car.x + car.z) * 0.08) * car.weave * dt;
    car.x += sideX * wobble;
    car.z += sideZ * wobble;
  }
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
    if (ped.state === 'walk' && Math.random() < (ped.idleChance ?? 0.4)) {
      ped.state = 'idle';
      ped.stateTimer = 2 + Math.random() * 4;
    } else {
      ped.state = 'walk';
      ped.heading = wrapAngle(ped.heading + (Math.random() * 2.4 - 1.2));
      ped.stateTimer = 3 + Math.random() * 6;
    }
  }
  // r6: joggers run the sidewalk loop, vendors stay near their corner —
  // the archetype shapes the walk, not just the speed.
  if (ped.state === 'walk' && ped.archetype === 'jogger') {
    ped.speed = Math.max(ped.speed, 3.0);
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
