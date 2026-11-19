// Ember Harbor — r7 vehicles, part two: boats, bikes and heavy metal.
// The harbour is water on the east edge, so r7 adds a boat you can steal
// from the pier and sail, a fast sports bike, a limousine and an ambulance
// (steal it and the city notices — it is a working emergency vehicle).
// Each class handles differently: boats slide and turn slow, bikes lean
// and turn sharp, the limo is long and soft, the ambulance is heavy but
// shrugs off bumps. Pure physics + catalogue; the renderer draws hulls.

import { clamp, dist } from './utils.js';
import { modelById } from './vehicles.js';

export const R7_MODELS = [
  { id: 'boat', name: 'Harbor Runner Boat', top: 30, accel: 14, color: 0x2e7a8a, value: 520, w: 2.2, l: 6.8, kind: 'boat' },
  { id: 'sportbike', name: 'Comet R Sport Bike', top: 42, accel: 28, color: 0xff2e88, value: 480, w: 0.8, l: 2.1, kind: 'bike' },
  { id: 'limo', name: 'Harborview Limo', top: 32, accel: 14, color: 0x111111, value: 600, w: 2.0, l: 6.2, kind: 'car' },
  { id: 'ambulance', name: 'St. Anselm Ambulance', top: 31, accel: 16, color: 0xf2f2f2, value: 0, w: 2.1, l: 5.4, kind: 'emergency' },
  { id: 'bus', name: 'Harbor Bus', top: 24, accel: 10, color: 0x2e6a4a, value: 300, w: 2.5, l: 8.0, kind: 'heavy' },
  { id: 'muscle', name: 'Iron V8 Muscle', top: 40, accel: 23, color: 0x7a1a1a, value: 550, w: 2.0, l: 4.6, kind: 'car' },
];

export function r7ModelById(id) {
  return R7_MODELS.find((m) => m.id === id) || null;
}

export function allModels() {
  return [...R7_MODELS];
}

export function isBoatModel(id) {
  return id === 'boat';
}

export function isEmergencyModel(id) {
  return id === 'ambulance';
}

export function isR7Model(id) {
  return R7_MODELS.some((m) => m.id === id);
}

export function vehicleHandling(id) {
  // turn: how sharply it steers. grip: how much it slides. brake: stopping power.
  const table = {
    boat: { turn: 0.55, grip: 0.45, brake: 0.6, accelFactor: 1, drift: 0.9, label: 'Slides on the water — plan turns early' },
    sportbike: { turn: 1.6, grip: 1.25, brake: 1.3, accelFactor: 1.3, drift: 0.2, label: 'Sharp, quick, unforgiving' },
    bike: { turn: 1.35, grip: 1.1, brake: 1.1, accelFactor: 1.15, drift: 0.3, label: 'Weaves through traffic' },
    truck: { turn: 0.7, grip: 0.9, brake: 0.8, accelFactor: 0.8, drift: 0.1, label: 'Slow, heavy, unstoppable' },
    bus: { turn: 0.65, grip: 0.9, brake: 0.75, accelFactor: 0.75, drift: 0.1, label: 'A bus. It turns like a bus.' },
    limo: { turn: 0.8, grip: 1.0, brake: 0.9, accelFactor: 0.9, drift: 0.15, label: 'Long, soft, VIP smooth' },
    ambulance: { turn: 0.95, grip: 1.05, brake: 1.1, accelFactor: 1, drift: 0.1, label: 'Heavy, but it stops on a coin' },
    muscle: { turn: 1.0, grip: 0.85, brake: 0.9, accelFactor: 1.2, drift: 0.65, label: 'Big V8, tail-happy' },
    coupe: { turn: 1.1, grip: 1.05, brake: 1, accelFactor: 1.1, drift: 0.4, label: 'The Falcon GT — fast and planted' },
    cop: { turn: 1.15, grip: 1.1, brake: 1.15, accelFactor: 1.1, drift: 0.25, label: 'Interceptor — built to chase' },
  };
  return table[id] || { turn: 1, grip: 1, brake: 1, accelFactor: 1, drift: 0.3, label: 'Standard city car' };
}

export function createBoat(x, z, heading) {
  return {
    model: 'boat', modelName: 'Harbor Runner Boat', color: 0x2e7a8a, value: 520,
    x, z, heading: heading || 0, speed: 0,
    health: 100, maxHealth: 100,
    wrecked: false, stolen: false, isPlayerCar: false,
    nitro: 0, nitroActive: 0, nitroCooldown: 0,
    engine: 0, grip: 0, armour: 0,
    steer: 0, drift: 0, lights: false,
    wake: 0, onWater: true,
  };
}

export function updateBoat(boat, input, dt) {
  if (boat.wrecked) {
    boat.speed *= Math.max(0, 1 - 2 * dt);
    return boat;
  }
  const handling = vehicleHandling('boat');
  const top = 30;
  const target = input.throttle * top;
  boat.speed += clamp(target - boat.speed, -8 * dt, 10 * dt);
  const steerTarget = (input.steer || 0) * 0.55 * clamp(Math.abs(boat.speed) / 8, 0, 1);
  boat.steer += (steerTarget - boat.steer) * Math.min(1, 3 * dt);
  boat.heading += boat.steer * (boat.speed / 8) * handling.turn * dt;
  boat.x += Math.sin(boat.heading) * boat.speed * dt;
  boat.z += Math.cos(boat.heading) * boat.speed * dt;
  boat.wake = clamp(Math.abs(boat.speed) / 30, 0, 1);
  // Boats stay in the water strip east of the city and the harbour basin.
  boat.x = clamp(boat.x, 440, 620);
  boat.z = clamp(boat.z, -460, 460);
  return boat;
}

export function boatDamage(boat, amount) {
  if (boat.wrecked) return false;
  boat.health = Math.max(0, boat.health - amount);
  if (boat.health <= 0) {
    boat.wrecked = true;
    boat.speed = 0;
  }
  return true;
}

export function boatInWater(x, z) {
  return x > 460;
}

export function dockPoints() {
  return [
    { id: 'pier-south', name: 'South Pier dock', x: 470, z: 414 },
    { id: 'ferry', name: 'Ferry Terminal dock', x: 480, z: 230 },
    { id: 'harbor-north', name: 'North Harbor dock', x: 470, z: -322 },
  ];
}

export function nearestDock(x, z) {
  let best = null;
  let bestD = Infinity;
  for (const d of dockPoints()) {
    const dd = dist(x, z, d.x, d.z);
    if (dd < bestD) { bestD = dd; best = d; }
  }
  return best ? { dock: best, dist: bestD } : null;
}

export function boatValue(boat) {
  return Math.round(520 * (0.25 + 0.75 * (boat.health / boat.maxHealth)));
}

export function compareModels(aId, bId) {
  const a = r7ModelById(aId) || modelById(aId);
  const b = r7ModelById(bId) || modelById(bId);
  return {
    faster: a.top > b.top ? a.id : b.id,
    topDiff: Math.abs(a.top - b.top),
    valueDiff: Math.abs(a.value - b.value),
  };
}

export function garageSlotsFor(modelId) {
  if (modelId === 'boat') return 'dock';
  if (modelId === 'bus' || modelId === 'truck') return 'yard';
  return 'garage';
}

export function fuelUseFor(modelId, speed) {
  const base = { boat: 0.8, sportbike: 0.5, bus: 1.2, limo: 0.9, ambulance: 0.9, muscle: 1.1 };
  return (base[modelId] || 0.7) * (0.4 + Math.abs(speed) / 40);
}

export function hornSoundFor(modelId) {
  if (modelId === 'boat') return 'foghorn';
  if (modelId === 'ambulance') return 'siren-wail';
  if (modelId === 'bus') return 'air-horn';
  return 'horn';
}
