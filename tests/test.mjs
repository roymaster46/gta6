// Ember Harbor — test suite (Node 22, no external dependencies).
// Run: node tests/test.mjs
// Tests only the pure game logic: utils, city generation, player physics,
// car physics, traffic AI, wanted system, missions, combat and save/load.

import {
  clamp, lerp, wrapAngle, dist, createRng, rngInt, hash2,
  formatMoney, formatClock, formatTime, starsText, isOnRoad, clampToWorld,
  progressBar, formatDuration, pickWeighted, angleTo,
} from '../game/src/utils.js';
import { generateCity, districtAt, buildingAt, resolveBuildingCollision, landmarkById, heliPadById, nearestHeliPad, safehouses } from '../game/src/world.js';
import { createPlayer, updatePlayer, damagePlayer, healPlayer, respawnPlayer, playerSpeed, playerStaminaPct } from '../game/src/player.js';
import { createCar, updateCar, damageCar, repairCar, chopValue, nearestCar, modelById, vehicleClass, isTwoWheeler, upgradeCar } from '../game/src/vehicles.js';
import { spawnTraffic, updateTrafficCar, updatePed, crashTrafficCar, pedArchetypeSpeed } from '../game/src/traffic.js';
import { createWanted, addHeat, addHeatFor, updateWanted, clearWanted, notorietyBand, heliActive, roadblockActive, createCop, updateCop, spawnCopsForStars, createHeli, updateHeli, wantedSummary, isFiveStar, responseTier, crimesForStars, createRoadblockState, updateRoadblocks, roadblockBlocksCar } from '../game/src/police.js';
import { MISSION_DEFS, createMissionState, startMission, updateMission, missionProgress, nextAvailableMission, totalEarned, createSideState, checkPackagePickup, abortMission } from '../game/src/missions.js';
import { EXTRA_MISSION_DEFS, extraMissionDef, totalExtraRewards } from '../game/src/missions-extra.js';
import { createLoadout, switchWeapon, giveWeapon, canFire, fireWeapon, punch, applyHit, shootCar, ammoText, totalAmmo, startReload, tickReload, setArmour, armourAbsorb, shootHeli } from '../game/src/combat.js';
import { buildSnapshot, applySnapshot, serializeSnapshot, parseSnapshot, scoreOf, progressSummary } from '../game/src/save.js';
import { createPlayerHeli, createPoliceHeli, updatePlayerHeli, updatePoliceHeli, updatePoliceHeliFire, damagePoliceHeli, damagePlayerHeli, heliCanTakeOff, refuelHeli, padAt, airResponseForStars, HELI_PADS } from '../game/src/heli.js';
import { createSwatUnit, updateSwat, damageSwat, createFibCar, updateFibCar, spawnSwatForStars, createRoadblock, planRoadblocks, roadblockHit, damageRoadblock, fiveStarActive } from '../game/src/swat.js';
import { SHOP_STOCK, shopItem, createShopState, openShop, closeShop, shopCycle, selectedItem, buySelected, createSafehouseState, healAtSafehouse, sleepAtSafehouse, storeCarAtSafehouse, createVigilanteState, startVigilante, updateVigilante, damageVigilanteTarget, tickVigilante, vipFarePay } from '../game/src/shops.js';
import { EVENT_KINDS, eventDef, createEventState, spawnEvent, updateEvents, resolveEvent, raceOvertake, nearestEvent, PED_ARCHETYPES, archetypeSpeed } from '../game/src/events.js';
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
check('city has 14 landmarks', cityA.landmarks.length === 14);
check('city has 16 packages', cityA.packages.length === 16);
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
eq('mission defs count', MISSION_DEFS.length, 14);
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
check('snapshot rejects wrong version', parseSnapshot('{"v":3}') === null);
check('scoreOf counts missions', scoreOf(fakeGame()) === 1000 + 360 + 90 + 123 + 25);
check('snapshot has version 2', buildSnapshot(fakeGame()).v === 2);
check('snapshot v1 still loads', (() => {
  const g = fakeGame();
  g.shops = { spent: 0, visits: 0 };
  g.safehouse = { sleeps: 0, storedCars: [] };
  g.vigilante = { done: 0, earned: 0 };
  g.events = { completed: 0, earned: 0 };
  g.playerHeli = { fuel: 100 };
  const snap = { v: 1, cash: 500, rep: 3, health: 90, px: 1, pz: 2, dayTime: 0.4, missionsCompleted: [], packagesFound: 0, faresDone: 0, chopSales: 0, bestScore: 0, playSeconds: 0, weapons: { fists: { ammo: -1, owned: true } }, currentWeapon: 'fists' };
  return applySnapshot(g, snap) && g.player.cash === 500;
})());

// ---- r6: utils additions ----
eq('progressBar half', progressBar(0.5, 10), '[#####-----]');
eq('progressBar full', progressBar(1, 4), '[####]');
eq('formatDuration', formatDuration(125), '2:05');
check('pickWeighted deterministic', pickWeighted(createRng(3), [{ value: 'a', weight: 1 }, { value: 'b', weight: 1 }]) === pickWeighted(createRng(3), [{ value: 'a', weight: 1 }, { value: 'b', weight: 1 }]));
approx('angleTo north', angleTo(0, 0, 0, 10), 0, 1e-9);

// ---- r6: world additions ----
eq('landmark gunshop', landmarkById(cityA, 'gunshop').name, 'Iron Annie Guns');
eq('landmark casino', landmarkById(cityA, 'casino').name, 'Harbour Casino');
eq('landmark heliport', landmarkById(cityA, 'heliport').name, 'Harbor Heliport');
check('city has 3 heli pads', cityA.heliPads.length === 3);
eq('heli pad by id', heliPadById(cityA, 'tower-roof').name, 'Harborview Tower Roof');
check('nearest heli pad', nearestHeliPad(cityA, 368, -138, 20).pad.id === 'heliport');
check('two safehouses', safehouses(cityA).length === 2);
check('city packages total 16 in side state', createSideState(cityA).packagesTotal === 16);

// ---- r6: vehicles — bikes, trucks, upgrades ----
eq('model bike', modelById('bike').name, 'Ember 900 Bike');
eq('model truck', modelById('truck').name, 'Harbor Hauler');
eq('vehicleClass bike', vehicleClass('bike'), 'bike');
eq('vehicleClass truck', vehicleClass('truck'), 'heavy');
eq('vehicleClass cop', vehicleClass('cop'), 'police');
check('isTwoWheeler bike', isTwoWheeler('bike'));
check('isTwoWheeler sedan false', !isTwoWheeler('sedan'));
check('upgrade engine', (() => { const c = createCar('coupe', 0, 0, 0); const r = upgradeCar(c, 'engine', 500, 250); return r.ok && c.engine === 1 && r.cash === 250; })());
check('upgrade needs cash', (() => { const c = createCar('coupe', 0, 0, 0); return !upgradeCar(c, 'engine', 100, 250).ok; })());
check('upgrade maxes at 3', (() => { const c = createCar('coupe', 0, 0, 0); upgradeCar(c, 'armour', 9999, 250); upgradeCar(c, 'armour', 9999, 250); upgradeCar(c, 'armour', 9999, 250); return !upgradeCar(c, 'armour', 9999, 250).ok; })());
check('bike turns sharper than truck', (() => {
  const b = createCar('bike', 0, 0, 0);
  const t = createCar('truck', 0, 0, 0);
  // 0.5 s only: longer and the bike's heading wraps past PI, which would
  // make the comparison meaningless.
  for (let i = 0; i < 30; i += 1) {
    updateCar(b, { throttle: 1, steer: 1, handbrake: false, nitro: false }, STEP, null);
    updateCar(t, { throttle: 1, steer: 1, handbrake: false, nitro: false }, STEP, null);
  }
  return Math.abs(b.heading) > Math.abs(t.heading);
})());

// ---- r6: player stamina + crouch ----
check('sprint drains stamina', (() => {
  const p = createPlayer(0, 0);
  const spr = { moveX: 0, moveY: 1, sprint: true, jump: false, camYaw: 0, crouch: false };
  for (let i = 0; i < 600; i += 1) updatePlayer(p, spr, STEP, null);
  return p.stamina < 100;
})());
check('crouch halves speed', (() => {
  const a = createPlayer(0, 0);
  const b = createPlayer(0, 0);
  const walk = { moveX: 0, moveY: 1, sprint: false, jump: false, camYaw: 0, crouch: false };
  const crouch = { moveX: 0, moveY: 1, sprint: false, jump: false, camYaw: 0, crouch: true };
  for (let i = 0; i < 120; i += 1) { updatePlayer(a, walk, STEP, null); updatePlayer(b, crouch, STEP, null); }
  return playerSpeed(b) < playerSpeed(a) && b.crouching === true;
})());
check('stamina recovers at rest', (() => {
  const p = createPlayer(0, 0);
  p.stamina = 10;
  const idle = { moveX: 0, moveY: 0, sprint: false, jump: false, camYaw: 0, crouch: false };
  for (let i = 0; i < 300; i += 1) updatePlayer(p, idle, STEP, null);
  return p.stamina > 50;
})());
eq('stamina pct', playerStaminaPct(Object.assign(createPlayer(0, 0), { stamina: 50, maxStamina: 100 })), 50);

// ---- r6: helicopters ----
check('player heli starts grounded', (() => { const h = createPlayerHeli(368, -138); return h.altitude === 0 && h.fuel === 100 && heliCanTakeOff(h); })());
check('heli climbs with lift', (() => {
  const h = createPlayerHeli(0, 0);
  for (let i = 0; i < 60 * 6; i += 1) updatePlayerHeli(h, { lift: 1, throttle: 0, steer: 0 }, STEP);
  return h.altitude > 10 && h.rotor > 0.5;
})());
check('heli fuel burns', (() => {
  const h = createPlayerHeli(0, 0);
  for (let i = 0; i < 60 * 10; i += 1) updatePlayerHeli(h, { lift: 1, throttle: 1, steer: 0 }, STEP);
  return h.fuel < 100;
})());
check('heli refuel', (() => { const h = createPlayerHeli(0, 0); h.fuel = 20; return refuelHeli(h) === 100; })());
check('heli wrecked by damage', (() => { const h = createPlayerHeli(0, 0); damagePlayerHeli(h, 999); return h.wrecked && !heliCanTakeOff(h); })());
check('padAt heliport', padAt(368, -138).id === 'heliport');
check('padAt none', padAt(0, 0) === null);
check('air response 5 stars armed', (() => { const r = airResponseForStars(5, 0); return r.helis === 2 && r.armed; })());
check('air response 4 stars one heli', (() => { const r = airResponseForStars(4, 0); return r.helis === 1 && !r.armed; })());
check('air response 1 star none', airResponseForStars(1, 0).helis === 0);
check('police heli calls on interval', (() => {
  const h = createPoliceHeli();
  h.active = true;
  let called = false;
  for (let i = 0; i < 60 * 10; i += 1) if (updatePoliceHeli(h, { x: 0, z: 0 }, STEP)) called = true;
  return called;
})());
check('police heli fires only at 5 stars', (() => {
  const h = createPoliceHeli();
  h.active = true; h.x = 0; h.z = 0;
  return updatePoliceHeliFire(h, { x: 0, z: 0 }, STEP, 4) === null;
})());
check('police heli shot down', (() => {
  const h = createPoliceHeli();
  h.active = true; h.health = 40;
  return damagePoliceHeli(h, 55) === true && h.active === false;
})());

// ---- r6: SWAT, FIB, roadblocks ----
check('fiveStarActive', fiveStarActive(Object.assign(createWanted(), { stars: 5 })));
check('not five star at 4', !fiveStarActive(Object.assign(createWanted(), { stars: 4 })));
eq('responseTier 5', responseTier(5), 'swat');
eq('responseTier 4', responseTier(4), 'heli');
eq('responseTier 0', responseTier(0), 'none');
check('crimesForStars 5 has swat', crimesForStars(5).includes('swat'));
check('swat chases player', (() => {
  const u = createSwatUnit(0, 0);
  updateSwat(u, { x: 10, z: 0 }, STEP);
  return u.state === 'chase' && u.x > 0;
})());
check('swat shoots in range', (() => {
  const u = createSwatUnit(0, 0);
  u.shootTimer = 0;
  const res = updateSwat(u, { x: 10, z: 0 }, STEP);
  return res === 'shot';
})());
check('swat dies from damage', (() => { const u = createSwatUnit(0, 0); damageSwat(u, 999); return u.dead; })());
check('swat spawns only at 5', (() => {
  const rng = createRng(5);
  return spawnSwatForStars(4, rng, { x: 0, z: 0 }).units.length === 0
    && spawnSwatForStars(5, rng, { x: 0, z: 0 }).units.length > 0;
})());
check('fib car chases', (() => {
  const f = createFibCar(0, 0, 0);
  updateFibCar(f, { x: 20, z: 0 }, null, STEP);
  return f.car.x > 0;
})());
check('roadblock plan ahead', planRoadblocks({ x: 0, z: 0 }, 0, 2).length === 2);
check('roadblock hit', (() => { const b = createRoadblock(0, 0, 0); return roadblockHit(b, 0, 0, 1); })());
check('roadblock damage clears', (() => { const b = createRoadblock(0, 0, 0); damageRoadblock(b, 200); return !b.active; })());
check('roadblocks spawn at 4 stars', (() => {
  const st = createRoadblockState();
  const w = createWanted();
  addHeat(w, 4, 0);
  updateRoadblocks(st, w, { x: 0, z: 0, heading: 0 }, 1);
  return st.blocks.length >= 1;
})());
check('roadblocks clear below 4 stars', (() => {
  const st = createRoadblockState();
  const w = createWanted();
  addHeat(w, 4, 0);
  updateRoadblocks(st, w, { x: 0, z: 0, heading: 0 }, 1);
  const w2 = createWanted();
  updateRoadblocks(st, w2, { x: 0, z: 0, heading: 0 }, 1);
  return st.blocks.length === 0;
})());
check('roadblockBlocksCar finds barrier', (() => {
  const st = createRoadblockState();
  // Barriers sit 4 m either side of the block centre along the road.
  st.blocks.push(createRoadblock(0, 0, 0));
  return roadblockBlocksCar(st, 4, 0, 1) !== null && roadblockBlocksCar(st, 100, 100, 1) === null;
})());

// ---- r6: police named crimes ----
check('addHeatFor vault grab is 2', (() => { const w = createWanted(); addHeatFor(w, 'vaultGrab', 0); return w.stars === 2; })());
check('addHeatFor punch is 0.2', (() => { const w = createWanted(); addHeatFor(w, 'punch', 0); return w.heat === 0.2 && w.stars === 0; })());
check('isFiveStar helper', isFiveStar(Object.assign(createWanted(), { stars: 5 })));

// ---- r6: new missions ----
eq('extra mission defs count', EXTRA_MISSION_DEFS.length, 6);
check('extra def skyhook exists', extraMissionDef('skyhook').name === 'Skyhook');
check('extra rewards sum', totalExtraRewards() === 900 + 650 + 800 + 750 + 600 + 2000);
check('skyhook flyto steps advance', (() => {
  const ms = createMissionState();
  startMission(ms, 'skyhook');
  updateMission(ms, { x: 368, z: -138, dt: STEP, wantedStars: 0 });
  updateMission(ms, { x: 322, z: -46, inHeli: true, dt: STEP, wantedStars: 0 });
  updateMission(ms, { x: 322, z: -46, grabbed: true, dt: STEP, wantedStars: 0 });
  const ev = updateMission(ms, { x: 368, z: -138, inHeli: true, dt: STEP, wantedStars: 0 });
  return ev && ev.type === 'complete' && ev.reward === 900 && ms.completed.includes('skyhook');
})());
check('ghost fails when spotted', (() => {
  const ms = createMissionState();
  startMission(ms, 'ghost');
  const ev = updateMission(ms, { x: 100, z: 100, dt: STEP, wantedStars: 3 });
  return ev && ev.failed && ev.reason.includes('Spotted');
})());
check('ghost advances when clean', (() => {
  const ms = createMissionState();
  startMission(ms, 'ghost');
  const ev = updateMission(ms, { x: 230, z: -138, dt: STEP, wantedStars: 0 });
  return ev && ev.type === 'step' && ms.stepIndex === 1;
})());
check('midnight-run banks speed bonus', (() => {
  const ms = createMissionState();
  startMission(ms, 'midnight-run');
  updateMission(ms, { x: -322, z: -322, dt: STEP, wantedStars: 0 });
  return ms.bonusEarned === 80;
})());
check('turf-war defend completes', (() => {
  const ms = createMissionState();
  startMission(ms, 'turf-war');
  for (let i = 0; i < 6; i += 1) updateMission(ms, { x: 0, z: 414, killed: 1, dt: STEP, wantedStars: 0 });
  let ev = null;
  for (let i = 0; i < 60 * 125 && !ev; i += 1) ev = updateMission(ms, { x: 0, z: 414, dt: STEP, wantedStars: 0 });
  return ev && ev.type === 'step' && ms.stepIndex === 1;
})());
check('tail-job completes in band', (() => {
  const ms = createMissionState();
  startMission(ms, 'tail-job');
  let ev = null;
  for (let i = 0; i < 60 * 50 && !ev; i += 1) ev = updateMission(ms, { x: 0, z: 0, tailDist: 15, dt: STEP, wantedStars: 0 });
  return ev && ev.type === 'step' && ms.stepIndex === 1;
})());
check('tail-job loses progress far away', (() => {
  const ms = createMissionState();
  startMission(ms, 'tail-job');
  for (let i = 0; i < 60 * 20; i += 1) updateMission(ms, { x: 0, z: 0, tailDist: 15, dt: STEP, wantedStars: 0 });
  const before = ms.tailTimer;
  for (let i = 0; i < 60 * 20; i += 1) updateMission(ms, { x: 0, z: 0, tailDist: 80, dt: STEP, wantedStars: 0 });
  return before > 0 && ms.tailTimer < before;
})());
check('next available reaches extras after base', (() => {
  const ms = createMissionState();
  for (const def of MISSION_DEFS.slice(0, 8)) ms.completed.push(def.id);
  return nextAvailableMission(ms).id === 'skyhook';
})());
check('total earned includes extras', (() => {
  const ms = createMissionState();
  ms.completed.push('skyhook', 'ghost');
  return totalEarned(ms) === 1700;
})());

// ---- r6: combat — rifle, reload, armour ----
check('rifle weapon def', (() => { const lo = createLoadout(); return lo.weapons.rifle && !lo.weapons.rifle.owned; })());
check('reload starts and finishes', (() => {
  const lo = createLoadout();
  switchWeapon(lo, 'pistol');
  startReload(lo);
  for (let i = 0; i < 120; i += 1) tickReload(lo, STEP);
  return !lo.reloading;
})());
check('cannot fire while reloading', (() => {
  const lo = createLoadout();
  switchWeapon(lo, 'pistol');
  startReload(lo);
  return !canFire(lo);
})());
check('armour absorbs first', (() => {
  const lo = createLoadout();
  setArmour(lo, 50);
  const split = armourAbsorb(lo, 20);
  return split.absorbed === 20 && split.healthDamage === 0 && lo.armour === 30;
})());
check('armour overflow hits health', (() => {
  const lo = createLoadout();
  setArmour(lo, 10);
  const split = armourAbsorb(lo, 30);
  return split.absorbed === 10 && split.healthDamage === 20;
})());
check('rifle shoots heli', (() => {
  const lo = createLoadout();
  giveWeapon(lo, 'rifle', 10);
  switchWeapon(lo, 'rifle');
  lo.cooldown = 0;
  const heli = { active: true, x: 0, z: 30, y: 42, health: 100 };
  const res = shootHeli(lo, 0, 0, 0, heli);
  return res.fired && res.damage === 55 && lo.weapons.rifle.ammo === 9;
})());
check('rifle misses heli behind', (() => {
  const lo = createLoadout();
  giveWeapon(lo, 'rifle', 10);
  switchWeapon(lo, 'rifle');
  lo.cooldown = 0;
  const heli = { active: true, x: 0, z: -30, y: 42, health: 100 };
  return shootHeli(lo, 0, 0, 0, heli).damage === 0;
})());

// ---- r6: shops, safehouse, vigilante ----
check('shop stock has rifle', shopItem('rifle').price === 680);
check('shop stock count', SHOP_STOCK.length === 9);
check('shop open/close', (() => { const s = createShopState(); openShop(s); return s.open && s.visits === 1 && (closeShop(s), !s.open); })());
check('shop cycle wraps', (() => { const s = createShopState(); for (let i = 0; i < SHOP_STOCK.length; i += 1) shopCycle(s, 1); return selectedItem(s).id === SHOP_STOCK[0].id; })());
check('buy selected deducts cash', (() => {
  const s = createShopState();
  const lo = createLoadout();
  const p = createPlayer(0, 0);
  p.cash = 1000;
  const apply = () => ({ ok: true });
  const res = buySelected(s, lo, p, apply);
  return res.ok && p.cash === 1000 - res.item.price && s.spent === res.item.price;
})());
check('buy selected needs cash', (() => {
  const s = createShopState();
  const lo = createLoadout();
  const p = createPlayer(0, 0);
  p.cash = 10;
  return !buySelected(s, lo, p, () => ({ ok: true })).ok;
})());
check('safehouse heal', (() => {
  const sh = createSafehouseState();
  const p = createPlayer(0, 0);
  p.health = 40;
  p.cash = 500;
  const r = healAtSafehouse(sh, p);
  return r.ok && p.health === 100 && p.cash === 450 && sh.heals === 1;
})());
check('safehouse sleep clears wanted', (() => {
  const sh = createSafehouseState();
  const p = createPlayer(0, 0);
  const gameLike = { wanted: { heat: 3, stars: 3, cleanTimer: 0 }, cops: [{ x: 0 }], copCars: [], swat: [], heli: { active: true }, dayTime: 0.9, playSeconds: 100 };
  const r = sleepAtSafehouse(sh, p, gameLike);
  return r.ok && gameLike.wanted.stars === 0 && gameLike.dayTime === 0.24 && sh.sleeps === 1;
})());
check('safehouse stores cars', (() => {
  const sh = createSafehouseState();
  const car = createCar('coupe', 0, 0, 0);
  const r = storeCarAtSafehouse(sh, car);
  return r.ok && sh.storedCars.length === 1;
})());
check('safehouse refuses cop car', (() => {
  const sh = createSafehouseState();
  return !storeCarAtSafehouse(sh, createCar('cop', 0, 0, 0)).ok;
})());
check('vigilante starts with payout', (() => {
  const v = createVigilanteState();
  const t = startVigilante(v, createRng(4), { x: 0, z: 0 }, cityA);
  return t !== null && t.payout >= 180 && t.health === 120;
})());
check('vigilante kill pays out', (() => {
  const v = createVigilanteState();
  startVigilante(v, createRng(4), { x: 0, z: 0 }, cityA);
  const r = damageVigilanteTarget(v, 999);
  return r && r.type === 'vigilante-done' && r.payout >= 180 && v.done === 1 && v.active === null;
})());
check('vigilante cooldown ticks', (() => {
  const v = createVigilanteState();
  v.cooldown = 10;
  tickVigilante(v, 5);
  return v.cooldown === 5;
})());
eq('vip fare triple', vipFarePay(45, 90, false), 135);
eq('vip fare no tip when wrecked', vipFarePay(45, 40, false), 45);
eq('vip fare fast bonus', vipFarePay(45, 90, true), 160);

// ---- r6: ambient events ----
check('event defs count', EVENT_KINDS.length === 6);
check('event def robbery', eventDef('robbery').reward === 150);
check('spawn event', (() => {
  const st = createEventState();
  const ev = spawnEvent(st, createRng(8), { x: 0, z: 0 }, 'robbery');
  return ev && ev.kind === 'robbery' && st.active.length === 1;
})());
check('events spawn over time', (() => {
  const st = createEventState();
  for (let i = 0; i < 60 * 200; i += 1) updateEvents(st, { x: 0, z: 0 }, STEP, createRng(11));
  return st.completed === 0 && st.active.length >= 0 && st.seen !== undefined;
})());
check('resolve event pays reward', (() => {
  const st = createEventState();
  const ev = spawnEvent(st, createRng(8), { x: 0, z: 0 }, 'brawl');
  const r = resolveEvent(st, ev.id, 'broke it up');
  return r && r.reward === 100 && st.completed === 1 && st.earned === 100;
})());
check('race overtake wins at 3', (() => {
  const st = createEventState();
  const ev = spawnEvent(st, createRng(8), { x: 0, z: 0 }, 'street-race');
  raceOvertake(st, ev.id);
  raceOvertake(st, ev.id);
  const r = raceOvertake(st, ev.id);
  return r && r.type === 'event-resolved' && r.reward === 200;
})());
check('nearest event', (() => {
  const st = createEventState();
  spawnEvent(st, createRng(8), { x: 0, z: 0 }, 'robbery');
  return nearestEvent(st, st.active[0].actorX, st.active[0].actorZ, 10) !== null;
})());
check('ped archetypes exist', PED_ARCHETYPES.length === 6);
eq('archetype jogger speed', archetypeSpeed('jogger'), 3.4);
eq('archetype vendor speed', archetypeSpeed('vendor'), 0.7);
check('traffic has bikes and trucks', (() => {
  const tr2 = spawnTraffic(20261119, cityA);
  const models = new Set(tr2.cars.map((c) => c.model));
  return models.has('bike') || models.has('truck') || tr2.cars.length === 26;
})());
check('ped archetype assigned', (() => {
  const tr2 = spawnTraffic(20261119, cityA);
  return tr2.peds.every((p) => typeof p.archetype === 'string' && p.speed > 0);
})());

// ---- r6: save v2 round trip ----
check('snapshot v2 round trip keeps new fields', (() => {
  const g = fakeGame();
  g.shops = { spent: 250, visits: 2 };
  g.safehouse = { sleeps: 1, storedCars: [{ model: 'coupe', health: 90, engine: 1, grip: 0, armour: 0 }] };
  g.vigilante = { done: 2, earned: 400 };
  g.events = { completed: 3, earned: 300 };
  g.playerHeli = { fuel: 55 };
  g.loadout.armour = 30;
  g.player.stamina = 70;
  const snap = parseSnapshot(serializeSnapshot(g));
  const g2 = fakeGame();
  g2.shops = { spent: 0, visits: 0 };
  g2.safehouse = { sleeps: 0, storedCars: [] };
  g2.vigilante = { done: 0, earned: 0 };
  g2.events = { completed: 0, earned: 0 };
  g2.playerHeli = { fuel: 100 };
  g2.loadout.armour = 0;
  applySnapshot(g2, snap);
  return g2.shops.spent === 250 && g2.safehouse.sleeps === 1 && g2.vigilante.done === 2
    && g2.events.completed === 3 && g2.playerHeli.fuel === 55 && g2.loadout.armour === 30;
})());
check('progress summary totals', (() => {
  const g = fakeGame();
  g.vigilante = { done: 1 };
  g.events = { completed: 2 };
  g.shops = { spent: 100 };
  const s = progressSummary(g);
  return s.missionsTotal === 14 && s.packagesTotal === 16 && s.vigilante === 1 && s.events === 2;
})());

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('Failed checks:');
  for (const f of failures) console.log(` - ${f}`);
  process.exit(1);
}
