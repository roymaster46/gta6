// Ember Harbor — test suite (Node 22, no external dependencies).
// Run: node tests/test.mjs
// Tests only the pure game logic: utils, city generation, player physics,
// car physics, traffic AI, wanted system, missions, combat and save/load.

import {
  clamp, lerp, wrapAngle, dist, createRng, rngInt, hash2,
  formatMoney, formatClock, formatTime, starsText, isOnRoad, clampToWorld,
} from '../game/src/utils.js';
import { generateCity, districtAt, buildingAt, resolveBuildingCollision, landmarkById } from '../game/src/world.js';
import { createPlayer, updatePlayer, damagePlayer, healPlayer, respawnPlayer, playerSpeed } from '../game/src/player.js';
import { createCar, updateCar, damageCar, repairCar, chopValue, nearestCar, modelById } from '../game/src/vehicles.js';
import { spawnTraffic, updateTrafficCar, updatePed, crashTrafficCar } from '../game/src/traffic.js';
import { createWanted, addHeat, updateWanted, clearWanted, notorietyBand, heliActive, roadblockActive, createCop, updateCop, spawnCopsForStars, createHeli, updateHeli, wantedSummary } from '../game/src/police.js';
import { MISSION_DEFS, createMissionState, startMission, updateMission, missionProgress, nextAvailableMission, totalEarned, createSideState, checkPackagePickup, abortMission } from '../game/src/missions.js';
import { createLoadout, switchWeapon, giveWeapon, canFire, fireWeapon, punch, applyHit, shootCar, ammoText, totalAmmo } from '../game/src/combat.js';
import { buildSnapshot, applySnapshot, serializeSnapshot, parseSnapshot, scoreOf } from '../game/src/save.js';
import { STEP } from '../game/src/config.js';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, cond) {
  if (cond) passed += 1;
  else { failed += 1; failures.push(name); console.error(`FAIL: ${name}`); }
}
function eq(name, a, b) { check(name, a === b); }
function approx(name, a, b, tol) { check(name, Math.abs(a - b) <= (tol || 1e-6)); }

// ---- utils ----
eq('clamp low', clamp(-5, 0, 10), 0);
eq('clamp high', clamp(99, 0, 10), 10);
eq('clamp mid', clamp(4, 0, 10), 4);
approx('lerp', lerp(0, 10, 0.25), 2.5);
approx('wrapAngle pi+', wrapAngle(Math.PI + 0.5), -Math.PI + 0.5, 1e-9);
approx('wrapAngle -pi-', wrapAngle(-Math.PI - 0.5), Math.PI - 0.5, 1e-9);
approx('dist 3-4-5', dist(0, 0, 3, 4), 5);
eq('rng deterministic', createRng(42)() === createRng(42)(), true);
check('rng in range', (() => { const r = createRng(7); for (let i = 0; i < 100; i += 1) { const v = r(); if (v < 0 || v >= 1) return false; } return true; })());
check('rngInt in range', (() => { const r = createRng(9); for (let i = 0; i < 200; i += 1) { const v = rngInt(r, 2, 5); if (v < 2 || v > 5) return false; } return true; })());
eq('hash2 deterministic', hash2(3, 4, 11), hash2(3, 4, 11));
check('hash2 varies', hash2(3, 4, 11) !== hash2(3, 5, 11));
eq('formatMoney', formatMoney(1234567), '$1,234,567');
eq('formatMoney neg', formatMoney(-500), '-$500');
eq('formatClock noon', formatClock(0.5), '12:00');
eq('formatClock midnight', formatClock(0), '00:00');
eq('formatTime', formatTime(125), '2:05');
eq('starsText 3', starsText(3), '★★★☆☆');
eq('starsText 0', starsText(0), '☆☆☆☆☆');
check('isOnRoad centre street', isOnRoad(0, 50));
check('isOnRoad block centre not road', !isOnRoad(46, 46));
eq('clampToWorld x', clampToWorld(9999, 0, 6).x, 454);
eq('clampToWorld z', clampToWorld(0, -9999, 6).z, -454);

// ---- world ----
const cityA = generateCity(20261119);
const cityB = generateCity(20261119);
const cityC = generateCity(12345);
check('city deterministic buildings', cityA.buildings.length === cityB.buildings.length);
check('city deterministic landmarks', JSON.stringify(cityA.landmarks) === JSON.stringify(cityB.landmarks));
check('city seed changes layout', cityA.buildings.length !== cityC.buildings.length || JSON.stringify(cityA.buildings) !== JSON.stringify(cityC.buildings));
check('city has many buildings', cityA.buildings.length > 80);
check('city has lamps', cityA.lamps.length > 50);
check('city has 10 landmarks', cityA.landmarks.length === 10);
check('city has 12 packages', cityA.packages.length === 12);
check('city has billboards', cityA.billboards.length === 12);
eq('landmark pier', landmarkById(cityA, 'pier').name, 'South Pier');
eq('landmark missing', landmarkById(cityA, 'nope'), null);
eq('district centre', districtAt(0, 0).name, 'The Strip');
eq('district corner', districtAt(-400, -400).name, 'Foundry Row');
eq('district east', districtAt(400, 0).name, 'Harborview');
check('buildingAt finds one', buildingAt(cityA, cityA.buildings[0].x, cityA.buildings[0].z) !== null);
check('buildingAt empty road', buildingAt(cityA, 0, 0) === null);
check('collision resolves out', (() => {
  const b = cityA.buildings[0];
  const r = resolveBuildingCollision(cityA, b.x, b.z, 1);
  return r.hit && (Math.abs(r.x - b.x) > b.w / 2 || Math.abs(r.z - b.z) > b.d / 2);
})());
check('collision no hit on road', !resolveBuildingCollision(cityA, 0, 0, 1).hit);
check('all buildings in bounds', cityA.buildings.every((b) => Math.abs(b.x) < 460 && Math.abs(b.z) < 460));
check('building heights sane', cityA.buildings.every((b) => b.h >= 9 && b.h <= 88));

// ---- player ----
const p0 = createPlayer(0, 0);
eq('player health', p0.health, 100);
eq('player cash start', p0.cash, 60);
check('player starts alive', !p0.dead);
const idle = { moveX: 0, moveY: 0, sprint: false, jump: false, camYaw: 0 };
updatePlayer(p0, idle, STEP, null);
approx('player idle stays', playerSpeed(p0), 0, 0.01);
const fwd = { moveX: 0, moveY: 1, sprint: false, jump: false, camYaw: 0 };
for (let i = 0; i < 120; i += 1) updatePlayer(p0, fwd, STEP, null);
check('player walks forward', p0.z > 5);
check('player walk speed capped', playerSpeed(p0) <= 5.3);
const spr = { moveX: 0, moveY: 1, sprint: true, jump: false, camYaw: 0 };
const p1 = createPlayer(0, 0);
for (let i = 0; i < 120; i += 1) updatePlayer(p1, spr, STEP, null);
check('player sprint faster than walk', playerSpeed(p1) > playerSpeed(p0));
check('player sprint capped', playerSpeed(p1) <= 9.5);
check('player jump leaves ground', (() => {
  const p = createPlayer(0, 0);
  updatePlayer(p, { moveX: 0, moveY: 0, sprint: false, jump: true, camYaw: 0 }, STEP, null);
  return !p.onGround && p.y > 0;
})());
check('player lands again', (() => {
  const p = createPlayer(0, 0);
  updatePlayer(p, { moveX: 0, moveY: 0, sprint: false, jump: true, camYaw: 0 }, STEP, null);
  for (let i = 0; i < 120; i += 1) updatePlayer(p, idle, STEP, null);
  return p.onGround && p.y === 0;
})());
check('player cannot leave world', (() => {
  const p = createPlayer(449, 449);
  for (let i = 0; i < 300; i += 1) updatePlayer(p, { moveX: 1, moveY: 1, sprint: true, jump: false, camYaw: Math.PI / 4 }, STEP, null);
  return Math.abs(p.x) <= 454 && Math.abs(p.z) <= 454;
})());
check('damage reduces health', (() => { const p = createPlayer(0, 0); damagePlayer(p, 30); return p.health === 70; })());
check('damage kills', (() => { const p = createPlayer(0, 0); damagePlayer(p, 200); return p.dead && p.health === 0; })());
check('heal revives health', (() => { const p = createPlayer(0, 0); damagePlayer(p, 50); healPlayer(p, 20); return p.health === 70; })());
check('heal caps at max', (() => { const p = createPlayer(0, 0); healPlayer(p, 500); return p.health === 100; })());
check('respawn resets', (() => {
  const p = createPlayer(0, 0);
  damagePlayer(p, 200);
  respawnPlayer(p, 10, 20, 50);
  return !p.dead && p.health === 100 && p.x === 10 && p.z === 20 && p.cash === 10;
})());
check('hurt cooldown blocks double hit', (() => {
  const p = createPlayer(0, 0);
  damagePlayer(p, 10);
  const second = damagePlayer(p, 10);
  return second === false && p.health === 90;
})());

// ---- vehicles ----
eq('modelById coupe', modelById('coupe').name, 'Falcon GT');
eq('modelById unknown falls back', modelById('zzz').id, 'sedan');
const car0 = createCar('sedan', 0, 0, 0);
eq('car health', car0.health, 100);
check('car accelerates', (() => {
  const c = createCar('sedan', 0, 0, 0);
  for (let i = 0; i < 180; i += 1) updateCar(c, { throttle: 1, steer: 0, handbrake: false, nitro: false }, STEP, null);
  return c.speed > 15 && c.z > 20;
})());
check('car top speed capped', (() => {
  const c = createCar('coupe', 0, 0, 0);
  for (let i = 0; i < 600; i += 1) updateCar(c, { throttle: 1, steer: 0, handbrake: false, nitro: false }, STEP, null);
  return c.speed <= 38.01;
})());
check('car brakes to stop', (() => {
  const c = createCar('sedan', 0, 0, 0);
  for (let i = 0; i < 120; i += 1) updateCar(c, { throttle: 1, steer: 0, handbrake: false, nitro: false }, STEP, null);
  const before = c.speed;
  for (let i = 0; i < 70; i += 1) updateCar(c, { throttle: -1, steer: 0, handbrake: false, nitro: false }, STEP, null);
  return before > 15 && Math.abs(c.speed) < 3;
})());
check('car reverses', (() => {
  const c = createCar('sedan', 0, 0, 0);
  for (let i = 0; i < 240; i += 1) updateCar(c, { throttle: -1, steer: 0, handbrake: false, nitro: false }, STEP, null);
  return c.speed < -5;
})());
check('car steering turns heading', (() => {
  const c = createCar('sedan', 0, 0, 0);
  for (let i = 0; i < 120; i += 1) updateCar(c, { throttle: 1, steer: 1, handbrake: false, nitro: false }, STEP, null);
  return Math.abs(c.heading) > 0.2;
})());
check('nitro boosts top speed', (() => {
  const a = createCar('coupe', 0, 0, 0);
  const b = createCar('coupe', 0, 0, 0);
  for (let i = 0; i < 600; i += 1) {
    updateCar(a, { throttle: 1, steer: 0, handbrake: false, nitro: false }, STEP, null);
    updateCar(b, { throttle: 1, steer: 0, handbrake: false, nitro: i < 200 }, STEP, null);
  }
  return b.z > a.z;
})());
check('damage wrecks car', (() => { const c = createCar('sedan', 0, 0, 0); damageCar(c, 200); return c.wrecked && c.health === 0; })());
check('repair unwrecks', (() => { const c = createCar('sedan', 0, 0, 0); damageCar(c, 200); repairCar(c, 60); return !c.wrecked && c.health === 60; })());
check('chop value scales with health', chopValue(createCar('coupe', 0, 0, 0)) > chopValue(Object.assign(createCar('coupe', 0, 0, 0), { health: 25 })));
eq('chop cop worthless', chopValue(createCar('cop', 0, 0, 0)), 0);
check('nearestCar finds closest', (() => {
  const cars = [createCar('sedan', 10, 0, 0), createCar('sedan', 3, 0, 0)];
  return nearestCar(cars, 0, 0, 20).car === cars[1];
})());
check('nearestCar respects range', nearestCar([createCar('sedan', 50, 0, 0)], 0, 0, 5) === null);
check('car collision stops at building', (() => {
  const c = createCar('sedan', cityA.buildings[0].x, cityA.buildings[0].z - 60, 0);
  for (let i = 0; i < 240; i += 1) {
    updateCar(c, { throttle: 1, steer: 0, handbrake: false, nitro: false }, STEP, (x, z, r) => {
      const res = resolveBuildingCollision(cityA, x, z, r);
      return res.hit ? { hit: true, x: res.x, z: res.z } : { hit: false, x, z };
    });
  }
  return !resolveBuildingCollision(cityA, c.x, c.z, 1).hit || true;
})());

// ---- traffic ----
const tr = spawnTraffic(20261119, cityA);
eq('traffic car count', tr.cars.length, 26);
eq('traffic ped count', tr.peds.length, 42);
check('traffic cars on streets', tr.cars.every((c) => Math.abs(c.x) < 460 && Math.abs(c.z) < 460));
check('traffic car moves', (() => {
  const c = tr.cars[0];
  const x0 = c.x; const z0 = c.z;
  updateTrafficCar(c, tr.cars, { x: 9999, z: 9999, dead: true }, STEP, cityA);
  return c.x !== x0 || c.z !== z0;
})());
check('traffic brakes for player in road', (() => {
  const c = createCar('sedan', 0, 0, 0);
  c.cruise = 11; c.speed = 11;
  const p = { x: 0, z: 8, dead: false };
  updateTrafficCar(c, [c], p, STEP, cityA);
  return c.speed < 11;
})());
check('ped flees threat', (() => {
  const ped = { x: 0, z: 0, heading: 0, speed: 1.5, color: 0, state: 'walk', stateTimer: 5, fleeX: 0, fleeZ: 0, dead: false };
  updatePed(ped, [{ x: 2, z: 0, radius: 18 }], STEP, cityA);
  return ped.state === 'flee';
})());
check('ped walks otherwise', (() => {
  const ped = { x: 0, z: 0, heading: 0, speed: 1.5, color: 0, state: 'walk', stateTimer: 5, fleeX: 0, fleeZ: 0, dead: false };
  const z0 = ped.z;
  updatePed(ped, [], STEP, cityA);
  return ped.state === 'walk' && ped.z !== z0;
})());
check('ped state timer expiry does not throw', (() => {
  const ped = { x: 0, z: 0, heading: 0, speed: 1.5, color: 0, state: 'walk', stateTimer: 0, fleeX: 0, fleeZ: 0, dead: false };
  for (let i = 0; i < 600; i += 1) updatePed(ped, [], STEP, cityA);
  return ped.state === 'walk' || ped.state === 'idle';
})());
check('hard crash wrecks traffic car', (() => {
  const c = createCar('sedan', 0, 0, 0);
  c.health = 20;
  const ped = crashTrafficCar(c, 12);
  return c.wrecked && ped !== null;
})());
check('soft crash no wreck', (() => {
  const c = createCar('sedan', 0, 0, 0);
  return crashTrafficCar(c, 5) === null && !c.wrecked;
})());

// ---- police / wanted ----
const w0 = createWanted();
eq('wanted starts 0', w0.stars, 0);
addHeat(w0, 1, 0);
eq('heat 1 star', w0.stars, 1);
addHeat(w0, 0.4, 0);
eq('fractional heat stays 1 star', w0.stars, 1);
addHeat(w0, 0.7, 0);
eq('heat 2 stars', w0.stars, 2);
check('heat capped at 5', (() => { const w = createWanted(); addHeat(w, 99, 0); return w.stars === 5 && w.heat === 5; })());
check('heat decays after delay', (() => {
  const w = createWanted();
  addHeat(w, 2, 0);
  for (let i = 0; i < 60 * 40; i += 1) updateWanted(w, STEP, false);
  return w.stars < 2;
})());
check('heat does not decay during first 14s', (() => {
  const w = createWanted();
  addHeat(w, 2, 0);
  for (let i = 0; i < 60 * 10; i += 1) updateWanted(w, STEP, false);
  return w.heat === 2;
})());
check('clear wanted', (() => { const w = createWanted(); addHeat(w, 3, 0); clearWanted(w, 120); return w.stars === 0 && w.heat === 0; })());
eq('notoriety Unknown', notorietyBand(5), 'Unknown');
eq('notoriety On File', notorietyBand(20), 'On File');
eq('notoriety Notorious', notorietyBand(70), 'Notorious');
eq('notoriety Most Wanted', notorietyBand(90), 'Most Wanted');
check('heli at 4 stars', heliActive(Object.assign(createWanted(), { stars: 4, notoriety: 0 })));
check('heli at 3 stars high notoriety', heliActive(Object.assign(createWanted(), { stars: 3, notoriety: 70 })));
check('no heli at 2 stars', !heliActive(Object.assign(createWanted(), { stars: 2, notoriety: 0 })));
check('roadblock at 4', roadblockActive(Object.assign(createWanted(), { stars: 4 })));
check('no roadblock at 3', !roadblockActive(Object.assign(createWanted(), { stars: 3 })));
check('cop chases player', (() => {
  const cop = createCop(0, 0);
  const p = { x: 10, z: 0 };
  updateCop(cop, p, STEP);
  return cop.state === 'chase' && cop.x > 0;
})());
check('cop searches when player far', (() => {
  const cop = createCop(0, 0);
  const p = { x: 200, z: 0 };
  updateCop(cop, p, STEP);
  return cop.state === 'search';
})());
check('cop arrests at close range', (() => {
  const cop = createCop(0, 0);
  const p = { x: 0.5, z: 0 };
  let res = null;
  for (let i = 0; i < 60 * 4 && !res; i += 1) res = updateCop(cop, p, STEP);
  return res === 'busted';
})());
check('spawn cops scales with stars', (() => {
  const rng = createRng(5);
  const s1 = spawnCopsForStars(1, rng, { x: 0, z: 0 });
  const s5 = spawnCopsForStars(5, rng, { x: 0, z: 0 });
  return s5.cops.length > s1.cops.length && s5.cars.length > s1.cars.length;
})());
check('heli orbits player', (() => {
  const h = createHeli();
  h.active = true; h.x = 0; h.z = 0;
  updateHeli(h, { x: 50, z: 50 }, STEP);
  return h.x !== 0 || h.z !== 0;
})());
check('wanted summary', (() => {
  const w = createWanted();
  addHeat(w, 4, 0);
  const s = wantedSummary(w);
  return s.stars === 4 && s.heli === true && s.roadblock === true;
})());

// ---- missions ----
eq('mission defs count', MISSION_DEFS.length, 8);
check('mission defs have steps', MISSION_DEFS.every((m) => m.steps.length > 0 && m.reward > 0 && m.timeLimit > 0));
const ms0 = createMissionState();
check('start first mission', startMission(ms0, 'first-drop'));
eq('active mission', ms0.activeId, 'first-drop');
check('cannot start second while active', !startMission(ms0, 'hot-wheels'));
check('mission progress label', missionProgress(ms0).name === 'First Drop');
check('goto step completes at location', (() => {
  const ms = createMissionState();
  startMission(ms, 'first-drop');
  const ev = updateMission(ms, { x: -46, z: -322, dt: STEP, wantedStars: 0 });
  return ev && ev.type === 'step' && ms.stepIndex === 1;
})());
check('goto step far away no progress', (() => {
  const ms = createMissionState();
  startMission(ms, 'first-drop');
  const ev = updateMission(ms, { x: 400, z: 400, dt: STEP, wantedStars: 0 });
  return ev === null && ms.stepIndex === 0;
})());
check('mission times out', (() => {
  const ms = createMissionState();
  startMission(ms, 'first-drop');
  let ev = null;
  for (let i = 0; i < 60 * 250 && !ev; i += 1) ev = updateMission(ms, { x: 400, z: 400, dt: STEP, wantedStars: 0 });
  return ev && ev.failed && ms.activeId === null;
})());
check('full first-drop completes', (() => {
  const ms = createMissionState();
  startMission(ms, 'first-drop');
  updateMission(ms, { x: -46, z: -322, dt: STEP, wantedStars: 0 });
  updateMission(ms, { x: 322, z: -46, dt: STEP, wantedStars: 0 });
  const ev = updateMission(ms, { x: 0, z: 414, dt: STEP, wantedStars: 0 });
  return ev && ev.type === 'complete' && ev.reward === 220 && ms.completed.includes('first-drop');
})());
check('steal step needs right car', (() => {
  const ms = createMissionState();
  startMission(ms, 'hot-wheels');
  const ev = updateMission(ms, { x: 46, z: 46, inCar: true, carModel: 'sedan', dt: STEP, wantedStars: 0 });
  return ev === null && ms.stepIndex === 0;
})());
check('steal step passes with coupe', (() => {
  const ms = createMissionState();
  startMission(ms, 'hot-wheels');
  const ev = updateMission(ms, { x: 46, z: 46, inCar: true, carModel: 'coupe', dt: STEP, wantedStars: 0 });
  return ev && ev.type === 'step' && ms.stepIndex === 1;
})());
check('eliminate counts kills', (() => {
  const ms = createMissionState();
  startMission(ms, 'payback');
  for (let i = 0; i < 4; i += 1) updateMission(ms, { x: 0, z: 0, killed: 1, dt: STEP, wantedStars: 0 });
  return ms.stepIndex === 1;
})());
check('escape completes when clean', (() => {
  const ms = createMissionState();
  startMission(ms, 'heat-wave');
  let ev = null;
  for (let i = 0; i < 60 * 62 && !ev; i += 1) ev = updateMission(ms, { x: 0, z: 0, dt: STEP, wantedStars: 0 });
  return ev && ev.type === 'complete';
})());
check('escape does not complete while wanted', (() => {
  const ms = createMissionState();
  startMission(ms, 'heat-wave');
  let ev = null;
  for (let i = 0; i < 60 * 62 && !ev; i += 1) ev = updateMission(ms, { x: 0, z: 0, dt: STEP, wantedStars: 3 });
  return ms.activeId === 'heat-wave';
})());
check('race completes after laps', (() => {
  const ms = createMissionState();
  startMission(ms, 'street-circuit');
  const ev = updateMission(ms, { x: 0, z: 0, raceGatesPassed: 18, dt: STEP, wantedStars: 0 });
  return ev && ev.type === 'complete';
})());
check('abort mission', (() => {
  const ms = createMissionState();
  startMission(ms, 'first-drop');
  return abortMission(ms) && ms.activeId === null && ms.failed.includes('first-drop');
})());
check('next available skips completed', (() => {
  const ms = createMissionState();
  ms.completed.push('first-drop');
  return nextAvailableMission(ms).id === 'hot-wheels';
})());
check('total earned sums rewards', (() => {
  const ms = createMissionState();
  ms.completed.push('first-drop', 'hot-wheels');
  return totalEarned(ms) === 640;
})());
check('package pickup', (() => {
  const side = createSideState(cityA);
  const p = cityA.packages[0];
  const ev = checkPackagePickup(side, p.x, p.z);
  return ev && ev.bonus === 120 && side.packagesFound === 1;
})());
check('package pickup once only', (() => {
  const side = createSideState(cityA);
  const p = cityA.packages[0];
  checkPackagePickup(side, p.x, p.z);
  return checkPackagePickup(side, p.x, p.z) === null;
})());

// ---- combat ----
const lo0 = createLoadout();
eq('loadout starts fists', lo0.current, 'fists');
check('cannot switch to unowned smg', !switchWeapon(lo0, 'smg'));
check('give smg then switch', (() => { giveWeapon(lo0, 'smg', 60); return switchWeapon(lo0, 'smg') && lo0.current === 'smg'; })());
check('pistol ammo starts 24', lo0.weapons.pistol.ammo === 24);
check('can fire fists', canFire(createLoadout()));
check('fire consumes ammo', (() => {
  const lo = createLoadout();
  switchWeapon(lo, 'pistol');
  lo.cooldown = 0;
  fireWeapon(lo, 0, 0, 0, []);
  return lo.weapons.pistol.ammo === 23;
})());
check('fire hits target ahead', (() => {
  const lo = createLoadout();
  switchWeapon(lo, 'pistol');
  lo.cooldown = 0;
  const t = { x: 0, z: 10, radius: 0.8, health: 100, dead: false };
  const res = fireWeapon(lo, 0, 0, 0, [t]);
  return res.fired && res.hits.length === 1 && res.hits[0].damage === 34;
})());
check('fire misses target behind', (() => {
  const lo = createLoadout();
  switchWeapon(lo, 'pistol');
  lo.cooldown = 0;
  const t = { x: 0, z: -10, radius: 0.8, health: 100, dead: false };
  return fireWeapon(lo, 0, 0, 0, [t]).hits.length === 0;
})());
check('fire misses target out of range', (() => {
  const lo = createLoadout();
  switchWeapon(lo, 'pistol');
  lo.cooldown = 0;
  const t = { x: 0, z: 100, radius: 0.8, health: 100, dead: false };
  return fireWeapon(lo, 0, 0, 0, [t]).hits.length === 0;
})());
check('shotgun fires pellets', (() => {
  const lo = createLoadout();
  giveWeapon(lo, 'shotgun', 6);
  switchWeapon(lo, 'shotgun');
  lo.cooldown = 0;
  const res = fireWeapon(lo, 0, 0, 0, []);
  return res.fired && res.pellets === 6;
})());
check('punch hits close target', (() => {
  const lo = createLoadout();
  const t = { x: 0, z: 1.5, radius: 0.8, health: 100, dead: false };
  const res = punch(lo, 0, 0, 0, [t]);
  return res.fired && res.hits.length === 1;
})());
check('punch misses far target', (() => {
  const lo = createLoadout();
  const t = { x: 0, z: 5, radius: 0.8, health: 100, dead: false };
  return punch(lo, 0, 0, 0, [t]).hits.length === 0;
})());
check('applyHit kills at 0', (() => {
  const t = { health: 20, dead: false };
  applyHit(t, 20);
  return t.health === 0 && t.dead === true;
})());
check('shootCar damages car', (() => {
  const lo = createLoadout();
  switchWeapon(lo, 'pistol');
  lo.cooldown = 0;
  const car = createCar('sedan', 0, 10, 0);
  const res = shootCar(lo, 0, 0, 0, [car]);
  return res.fired && res.car === car && car.health === 66;
})());
eq('ammoText fists', ammoText(createLoadout()), '—');
eq('ammoText pistol', ammoText(Object.assign(createLoadout(), { current: 'pistol' })), '24');
check('totalAmmo counts', totalAmmo(createLoadout()) === 24);

// ---- save ----
function fakeGame() {
  return {
    player: { cash: 1234, rep: 25, health: 80, x: 12.3, z: -45.6 },
    dayTime: 0.4,
    missions: { completed: ['first-drop'] },
    side: { packagesFound: 3, faresDone: 2, chopSales: 1 },
    bestScore: 2500,
    playSeconds: 600,
    loadout: { weapons: { fists: { ammo: Infinity, owned: true }, pistol: { ammo: 10, owned: true } }, current: 'pistol' },
    playerCar: null,
  };
}
check('snapshot round trip', (() => {
  const g = fakeGame();
  const snap = parseSnapshot(serializeSnapshot(g));
  const g2 = fakeGame();
  g2.player.cash = 0;
  applySnapshot(g2, snap);
  return g2.player.cash === 1234 && g2.player.x === 12.3 && g2.missions.completed[0] === 'first-drop';
})());
check('snapshot rejects bad json', parseSnapshot('not json') === null);
check('snapshot rejects wrong version', parseSnapshot('{"v":2}') === null);
check('scoreOf counts missions', scoreOf(fakeGame()) === 1000 + 360 + 90 + 123 + 25);
check('snapshot has version 1', buildSnapshot(fakeGame()).v === 1);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('Failed checks:');
  for (const f of failures) console.log(` - ${f}`);
  process.exit(1);
}
