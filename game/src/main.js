// Ember Harbor — bootstrap and the one game loop. Input is read every frame,
// the world advances in fixed 1/60 s steps, and the renderer + HUD paint
// what is there. Screens: title, play, paused, over.
// ?seed=N fixes the city. ?shot=day|night|mission|chase (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { DAY, ECONOMY, SEED_DEFAULT, STEP } from './config.js';
import { createRng, clamp, dist, formatMoney } from './utils.js';
import { generateCity, landmarkById, resolveBuildingCollision } from './world.js';
import { createPlayer, updatePlayer, damagePlayer, respawnPlayer, nearestToPlayer } from './player.js';
import { createCar, updateCar, damageCar, chopValue, nearestCar } from './vehicles.js';
import { spawnTraffic, updateTrafficCar, updatePed, crashTrafficCar } from './traffic.js';
import { createWanted, addHeat, addHeatFor, updateWanted, clearWanted, spawnCopsForStars, updateCop, updateCopCar, createHeli, updateHeli, heliActive, wantedSummary, createRoadblockState, updateRoadblocks, roadblockBlocksCar, isFiveStar } from './police.js';
import { createMissionState, startMission, updateMission, missionProgress, nextAvailableMission, totalEarned, createSideState, checkPackagePickup, startFare, updateFare, missionDef, MISSION_COUNT } from './missions.js';
import { createLoadout, switchWeapon, giveWeapon, fireWeapon, punch, shootCar, weaponDef, tickLoadout, applyHit, startReload, shootHeli, setArmour, armourAbsorb } from './combat.js';
import { createPlayerHeli, updatePlayerHeli, updatePoliceHeli, updatePoliceHeliFire, damagePoliceHeli, heliCanTakeOff, refuelHeli, padAt, nearestHeli } from './heli.js';
import { updateSwat, damageSwat, updateFibCar, planRoadblocks } from './swat.js';
import { createShopState, createSafehouseState, createVigilanteState, openShop, closeShop, shopCycle, selectedItem, buySelected, healAtSafehouse, sleepAtSafehouse, storeCarAtSafehouse, startVigilante, updateVigilante, damageVigilanteTarget, tickVigilante } from './shops.js';
import { createEventState, updateEvents, resolveEvent, raceOvertake, nearestEvent } from './events.js';
import { createRenderer } from './render.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createInput, ACTION_INTERACT, ACTION_JUMP, ACTION_PAUSE, ACTION_CONFIRM, ACTION_SHOOT, ACTION_NITRO, ACTION_HORN, ACTION_SHOP, ACTION_DESCEND, ACTION_VIGILANTE } from './input.js';
import { saveGame, loadGame, hasSave, scoreOf } from './save.js';

const MAX_FRAME = 0.25;
const RACE_GATES = [
  { x: 0, z: -368 }, { x: 368, z: -368 }, { x: 368, z: 0 },
  { x: 368, z: 368 }, { x: 0, z: 368 }, { x: -368, z: 368 },
  { x: -368, z: 0 }, { x: -368, z: -368 },
];

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : SEED_DEFAULT;

const glCanvas = document.getElementById('gl');
const hudCanvas = document.getElementById('hud');
const statusEl = document.getElementById('status');

if (typeof window.THREE === 'undefined') {
  document.getElementById('fallback').hidden = false;
  throw new Error('Three.js failed to load');
}

const city = generateCity(seed);
const cityApi = { resolveBuildingCollision: (x, z, r) => resolveBuildingCollision(city, x, z, r) };
const rng = createRng(seed + 913);
const renderer = createRenderer(glCanvas, city);
const hud = createHud(hudCanvas);
const audio = createAudio();

const game = {
  player: createPlayer(322, 300),
  playerCar: null,
  cars: [],
  traffic: spawnTraffic(seed, city),
  cops: [],
  copCars: [],
  heli: createHeli(),
  wanted: createWanted(),
  missions: createMissionState(),
  side: createSideState(city),
  loadout: createLoadout(),
  dayTime: 0.32,
  weather: 'clear',
  weatherTimer: 75,
  playSeconds: 0,
  bestScore: 0,
  score: 0,
  enemies: [],
  raceGate: 0,
  grabbed: false,
  deliveredCar: null,
  deathKind: null,
  saveTimer: 0,
  missionMarker: null,
  // r6: the new systems — a flyable heli, SWAT/FIB response, roadblocks,
  // the gun shop, safehouses, vigilante work and ambient city events.
  playerHeli: createPlayerHeli(368, -138),
  swat: [],
  fibCars: [],
  roadblocks: createRoadblockState(),
  shops: createShopState(),
  safehouse: createSafehouseState(),
  vigilante: createVigilanteState(),
  events: createEventState(),
  shopPrompt: null,
  tailCar: null,
  tailSpotted: 0,
  shopTimer: 0,
  lastRacePass: -99,
};

function readBest() {
  try { return Number.parseInt(window.localStorage.getItem('ember-harbor.best.v1') ?? '0', 10) || 0; } catch { return 0; }
}
function saveBest(v) {
  try { window.localStorage.setItem('ember-harbor.best.v1', String(v)); } catch { /* private mode */ }
}
game.bestScore = readBest();

// Parked cars around the city, including the mission Falcon GT.
const parkedModels = ['hatch', 'sedan', 'coupe', 'van', 'pickup', 'sedan', 'hatch', 'taxi', 'sedan', 'coupe'];
for (let i = 0; i < parkedModels.length; i += 1) {
  const spot = city.carSpawns[i % city.carSpawns.length] || { x: i * 40 - 200, z: -100 };
  const car = createCar(parkedModels[i], spot.x + 6, spot.z, Math.PI / 2);
  game.cars.push(car);
}
const falcon = createCar('coupe', 46, 58, 0);
falcon.missionCar = true;
game.cars.push(falcon);
const cab = createCar('taxi', 46, 34, Math.PI);
game.cars.push(cab);

function announce(msg) { statusEl.textContent = msg; }

function currentObjective() {
  const m = missionProgress(game.missions);
  if (m) return { x: m.stepX, z: m.stepZ, label: m.step };
  if (game.side.fare) {
    const f = game.side.fare;
    return f.pickedUp ? { x: f.toX, z: f.toZ, label: 'Drop off the fare' } : { x: f.fromX, z: f.fromZ, label: 'Pick up the fare' };
  }
  const next = nextAvailableMission(game.missions);
  if (next) {
    const lm = landmarkById(city, 'pier');
    return { x: lm.x, z: lm.z, label: `New job: ${next.name} — go to the Pier` };
  }
  return null;
}

function spawnEnemies(x, z, count) {
  game.enemies = [];
  for (let i = 0; i < count; i += 1) {
    game.enemies.push({ x: x + (i - 1.5) * 6, z: z + (i % 2) * 8 - 4, health: 100, dead: false, radius: 0.8, kind: 'gang', shootTimer: 1 + i * 0.7 });
  }
}

function enterCar(car) {
  game.playerCar = car;
  car.isPlayerCar = true;
  if (car.stolen !== true && !car.ownedByPlayer) {
    car.stolen = true;
    addHeat(game.wanted, 1, game.playSeconds);
    hud.toast('Car stolen — the PD noticed (+1 star)');
    audio.fail();
  }
  audio.engine(0, true);
}

function exitCar() {
  if (!game.playerCar) return;
  const car = game.playerCar;
  car.isPlayerCar = false;
  game.player.x = car.x - Math.sin(car.heading) * 2.4;
  game.player.z = car.z - Math.cos(car.heading) * 2.4;
  game.player.heading = car.heading;
  game.playerCar = null;
  audio.engine(0, false);
}

function applyShopItem(item, loadout, player) {
  if (item.kind === 'weapon') {
    giveWeapon(loadout, item.weapon, item.amount);
    return { ok: true };
  }
  if (item.kind === 'ammo') {
    if (!loadout.weapons[item.weapon] || !loadout.weapons[item.weapon].owned) {
      return { ok: false, reason: `you do not own the ${item.weapon} yet` };
    }
    giveWeapon(loadout, item.weapon, item.amount);
    return { ok: true };
  }
  if (item.kind === 'armour') {
    setArmour(loadout, (loadout.armour || 0) + item.amount);
    return { ok: true };
  }
  if (item.kind === 'heal') {
    if (player.health >= 100) return { ok: false, reason: 'already full health' };
    player.health = Math.min(100, player.health + item.amount);
    return { ok: true };
  }
  return { ok: false, reason: 'unknown item' };
}

function shopAction() {
  const p = game.player;
  const gunshop = landmarkById(city, 'gunshop');
  if (dist(p.x, p.z, gunshop.x, gunshop.z) >= 16) {
    hud.toast('Gun shop is at Iron Annie Guns — Gunshop Alley');
    return;
  }
  if (!game.shops.open) {
    openShop(game.shops);
    const item = selectedItem(game.shops);
    game.shopPrompt = `Iron Annie: ${item.label} — $${item.price}. Press B again to buy.`;
    hud.toast(game.shopPrompt);
    audio.shopBell();
    return;
  }
  const res = buySelected(game.shops, game.loadout, p, applyShopItem);
  if (res.ok) {
    hud.toast(`Bought ${res.item.label} — $${res.item.price}`);
    audio.cash();
    closeShop(game.shops);
    game.shopPrompt = null;
  } else {
    hud.toast(`Cannot buy: ${res.reason}`);
    audio.fail();
  }
  shopCycle(game.shops, 1);
}

function contextAction() {
  const p = game.player;
  const pos = game.playerCar || p;
  // r6: heli refuel at the heliport — $150 fills the tank.
  const pad = padAt(pos.x, pos.z);
  if (pad && game.playerHeli.occupied) {
    if (game.playerHeli.fuel > 95) { hud.toast('Tank is already full'); return; }
    if (p.cash < 150) { hud.toast('Refuel costs $150 — not enough cash'); return; }
    p.cash -= 150;
    refuelHeli(game.playerHeli);
    hud.toast('Tank filled — $150');
    audio.cash();
    return;
  }
  // r6: safehouse — heal for $50, or sleep until morning (full heal,
  // wanted cleared) when you are already healthy.
  for (const sh of [landmarkById(city, 'safehouse'), landmarkById(city, 'safehouse2')]) {
    if (!sh) continue;
    if (dist(pos.x, pos.z, sh.x, sh.z) < 14) {
      if (game.playerCar) {
        const stored = storeCarAtSafehouse(game.safehouse, game.playerCar);
        if (stored.ok) {
          exitCar();
          game.cars = game.cars.filter((c) => c !== game.playerCar);
          hud.toast(`Car stored in the safehouse garage (${stored.stored}/4)`);
          audio.cash();
        } else {
          hud.toast(stored.reason);
        }
        return;
      }
      if (p.health < 100) {
        const healed = healAtSafehouse(game.safehouse, p);
        if (healed.ok) { hud.toast('Patched up at the safehouse — $50'); audio.cash(); }
        else hud.toast(healed.reason);
        return;
      }
      sleepAtSafehouse(game.safehouse, p, game);
      game.cops = [];
      game.copCars = [];
      game.swat = [];
      game.fibCars = [];
      hud.toast('Slept until morning — clean, rested, ready');
      audio.mission();
      return;
    }
  }
  // Spray shop: clear wanted for cash.
  const spray = landmarkById(city, 'spray');
  if (game.playerCar && dist(pos.x, pos.z, spray.x, spray.z) < 14) {
    const cost = ECONOMY.sprayCost + (game.wanted.notoriety >= 60 ? ECONOMY.spraySurcharge : 0);
    if (game.wanted.stars === 0) { hud.toast('No heat to clear — you are clean'); return; }
    if (p.cash < cost) { hud.toast(`Spray costs ${formatMoney(cost)} — not enough cash`); return; }
    p.cash -= cost;
    clearWanted(game.wanted, cost);
    game.cops = [];
    game.copCars = [];
    game.heli.active = false;
    hud.toast(`Fresh coat — wanted cleared for ${formatMoney(cost)}`);
    audio.cash();
    return;
  }
  // Chop shop: sell the driven car.
  const chop = landmarkById(city, 'chopshop');
  if (game.playerCar && dist(pos.x, pos.z, chop.x, chop.z) < 14) {
    const car = game.playerCar;
    if (car.model === 'cop') { hud.toast('The chop shop will not touch a police car'); return; }
    if (game.side.chopCooldown > 0) { hud.toast(`Chop shop is cooling down (${Math.ceil(game.side.chopCooldown)}s)`); return; }
    const value = chopValue(car);
    p.cash += value;
    game.side.chopSales += 1;
    game.side.chopCooldown = 45;
    addHeat(game.wanted, 1, game.playSeconds);
    exitCar();
    game.cars = game.cars.filter((c) => c !== car);
    hud.toast(`Sold for ${formatMoney(value)} — the crusher is loud (+1 star)`);
    audio.cash();
    return;
  }
  hud.toast('Nothing to do here — try the spray shop or the chop shop in a car');
}

function startNextMission() {
  const next = nextAvailableMission(game.missions);
  if (!next) { hud.toast('All missions complete — you run this harbour now'); return; }
  if (startMission(game.missions, next.id)) {
    hud.toast(`New mission: ${next.name} — ${next.brief}`);
    audio.mission();
    announce(`Mission started: ${next.name}. ${next.brief}`);
    if (next.id === 'payback') spawnEnemies(-368, 46, 4);
    if (next.id === 'heat-wave' || next.id === 'the-big-one') addHeat(game.wanted, 3, game.playSeconds);
    if (next.id === 'smash-grab') addHeat(game.wanted, 2, game.playSeconds);
    // r6: the new jobs set their own stage — the heist sounds the alarm,
    // the turf war spawns its first wave, the tail job parks its courier.
    if (next.id === 'harbor-heist') { addHeat(game.wanted, 2, game.playSeconds); audio.alarm(); }
    if (next.id === 'turf-war') spawnEnemies(0, 380, 3);
    if (next.id === 'tail-job') {
      game.tailCar = createCar('sedan', 138, 138, Math.PI / 2);
      game.tailCar.cruise = 9;
      game.tailSpotted = 0;
    }
    if (next.id === 'skyhook') hud.toast('Take the helicopter from the Harbor Heliport (E to board)');
    if (next.id === 'ghost') hud.toast('Ghost run: stay clean — any heat blows the job');
  }
}

function missionContext(ctx) {
  const ev = updateMission(game.missions, ctx);
  if (!ev) return;
  if (ev.type === 'complete') {
    game.player.cash += ev.reward;
    game.player.rep += 12;
    hud.toast(`Mission complete: ${ev.name} — ${formatMoney(ev.reward)}`);
    audio.mission();
    audio.cash();
    announce(`Mission complete: ${ev.name}. Earned ${formatMoney(ev.reward)}.`);
    saveGame(game);
  } else if (ev.type === 'failed') {
    hud.toast(`Mission failed: ${ev.reason}`);
    audio.fail();
  } else if (ev.type === 'fare') {
    hud.toast(`Fare ${ev.delivered} dropped off`);
    audio.cash();
  }
}

function stepWorld(dt, input, actions) {
  const p = game.player;
  game.playSeconds += dt;
  game.dayTime = (game.dayTime + dt / 360) % 1;
  game.weatherTimer -= dt;
  if (game.weatherTimer <= 0) {
    game.weatherTimer = 80 + rng() * 60;
    game.weather = rng() < 0.55 ? 'clear' : rng() < 0.7 ? 'rain' : 'fog';
  }
  game.side.chopCooldown = Math.max(0, game.side.chopCooldown - dt);
  game.saveTimer += dt;
  if (game.saveTimer > 25) { game.saveTimer = 0; saveGame(game); }
  tickVigilante(game.vigilante, dt);
  game.shopTimer = Math.max(0, (game.shopTimer || 0) - dt);
  if (game.shopTimer === 0) game.shopPrompt = null;

  // r6: ambient events — new ones spawn on a timer, and the player gets
  // a toast + blip so a robbery across town is worth driving to.
  const eventsBefore = game.events.active.length;
  const evNotes = updateEvents(game.events, p, dt, rng);
  if (game.events.active.length > eventsBefore) {
    const newest = game.events.active[game.events.active.length - 1];
    hud.toast(`City event: ${newest.label} — orange marker on the map`);
    audio.eventBlip();
  }
  for (const note of evNotes) {
    if (note.type === 'event-expired') hud.toast(`${note.label} is over — the city moved on`);
  }
  // Vigilante target shoots back up close.
  const vigShot = updateVigilante(game.vigilante, p, dt, rng);
  if (vigShot && vigShot.type === 'criminal-shot') {
    const split = armourAbsorb(game.loadout, vigShot.damage);
    if (split.healthDamage > 0) damagePlayer(p, split.healthDamage);
  }

  // Wanted decay + police spawning keeps pace with stars.
  const committing = false;
  updateWanted(game.wanted, dt, committing);
  updateRoadblocks(game.roadblocks, game.wanted, p, dt);
  audio.siren(game.wanted.stars > 0, dt);
  audio.swatSiren(game.wanted.stars >= 5);
  const wantCops = Math.min(6, game.wanted.stars + 1);
  const wantCars = Math.max(0, game.wanted.stars - 1);
  if (game.wanted.stars > 0) {
    if (game.cops.length < wantCops && rng() < dt * 0.5) {
      const a = rng() * Math.PI * 2;
      game.cops.push({ x: p.x + Math.sin(a) * 40, z: p.z + Math.cos(a) * 40, heading: 0, speed: 0, state: 'chase', stateTimer: 0, lastSeenX: p.x, lastSeenZ: p.z, arrestTimer: 0, searchTimer: 0 });
    }
    if (game.copCars.length < wantCars && rng() < dt * 0.35) {
      const a = rng() * Math.PI * 2;
      const car = createCar('cop', p.x + Math.sin(a) * 55, p.z + Math.cos(a) * 55, a);
      game.copCars.push({ car, state: 'chase', stateTimer: 0, ramCooldown: 0 });
    }
  }
  game.heli.active = heliActive(game.wanted);
  updateHeli(game.heli, p, dt);
  // r6: the police heli radios the player's position — each call brings
  // another ground unit — and at 5 stars it opens fire in short bursts.
  if (updatePoliceHeli(game.heli, p, dt) && game.wanted.stars > 0 && game.cops.length < 6) {
    const a = rng() * Math.PI * 2;
    game.cops.push({ x: p.x + Math.sin(a) * 40, z: p.z + Math.cos(a) * 40, heading: 0, speed: 0, state: 'chase', stateTimer: 0, lastSeenX: p.x, lastSeenZ: p.z, arrestTimer: 0, searchTimer: 0 });
  }
  const heliFire = updatePoliceHeliFire(game.heli, p, dt, game.wanted.stars);
  if (heliFire) {
    const split = armourAbsorb(game.loadout, heliFire.damage);
    if (split.healthDamage > 0) damagePlayer(p, split.healthDamage);
    hud.toast('Police heli is firing on you!');
  }
  // r6: 5-star ground response — SWAT troopers and FIB interceptors
  // trickle in while the heat holds, instead of more beat cops.
  if (game.wanted.stars >= 5) {
    if (game.swat.length < 4 && rng() < dt * 0.4) {
      const spawned = spawnCopsForStars(5, rng, p);
      for (const u of spawned.swatUnits) if (game.swat.length < 4) game.swat.push(u);
      for (const f of spawned.fibCars) if (game.fibCars.length < 2) game.fibCars.push(f);
    }
  } else {
    game.swat = game.swat.filter((u) => u.state !== 'gone');
    if (game.wanted.stars === 0) { game.swat = []; game.fibCars = []; }
  }

  // r6: flying the helicopter — Space climbs, X descends, WASD flies.
  // The player rides along; the camera follows the aircraft, not the street.
  if (game.playerHeli.occupied) {
    const h = game.playerHeli;
    const mv = input.move();
    const lift = (input.isHeld('jump') ? 1 : 0) - ((actions & ACTION_DESCEND) !== 0 || input.isHeld('descend') ? 1 : 0);
    updatePlayerHeli(h, { lift, throttle: mv.moveY, steer: -mv.moveX }, dt);
    p.x = h.x;
    p.z = h.z;
    p.heading = h.heading;
    audio.rotor(true, Math.abs(h.speed) / 42);
    if (h.altitude === 0 && h.verticalSpeed <= 0 && h.speed < 1) {
      // Landed: the heli is parked again.
    }
  } else if (game.playerCar) {
    const car = game.playerCar;
    const mv = input.move();
    updateCar(car, {
      throttle: mv.moveY, steer: -mv.moveX,
      handbrake: mv.sprint, nitro: (actions & ACTION_NITRO) !== 0 || input.isHeld('nitro'),
    }, dt, (x, z, r) => {
      const res = resolveBuildingCollision(city, x, z, r);
      return res.hit ? { hit: true, x: res.x, z: res.z } : { hit: false, x, z };
    });
    p.x = car.x;
    p.z = car.z;
    p.heading = car.heading;
    audio.engine(Math.abs(car.speed) / 38, true);
    // Crash into traffic cars.
    for (const t of game.traffic.cars) {
      if (t === car || t.wrecked) continue;
      if (dist(car.x, car.z, t.x, t.z) < 3.4 && Math.abs(car.speed) > 6) {
        const ped = crashTrafficCar(t, Math.abs(car.speed));
        if (ped) game.traffic.peds.push(ped);
        damageCar(car, 8);
        addHeat(game.wanted, 0.4, game.playSeconds);
        audio.crash();
      }
    }
    // r6: roadblocks — driving through one at speed wrecks the car and
    // stops you dead. Go around, on the sidewalk, like everyone does.
    const block = roadblockBlocksCar(game.roadblocks, car.x, car.z, 1.4);
    if (block && Math.abs(car.speed) > 4) {
      damageCar(car, 22);
      car.speed *= -0.3;
      addHeat(game.wanted, 0.4, game.playSeconds);
      hud.toast('Roadblock! The PD sealed this avenue');
      audio.crash();
    }
    // Race gates for the street circuit.
    const m = missionProgress(game.missions);
    if (m && m.id === 'street-circuit') {
      const gate = RACE_GATES[game.raceGate % RACE_GATES.length];
      if (dist(car.x, car.z, gate.x, gate.z) < 12) {
        game.raceGate += 1;
        hud.toast(`Gate ${game.raceGate} — ${Math.floor(game.raceGate / RACE_GATES.length)} laps`);
        audio.pickup();
      }
    }
  } else {
    updatePlayer(p, { ...input.move(), camYaw: input.camYaw }, dt, cityApi);
    audio.engine(0, false);
    if ((actions & ACTION_JUMP) !== 0 && p.onGround) audio.jump();
  }

  // Interact: enter/exit car or heli, start mission at the pier, grab case.
  if ((actions & ACTION_INTERACT) !== 0) {
    if (game.playerHeli.occupied) {
      // Land first: exiting mid-air is not an option the game offers.
      if (game.playerHeli.altitude < 2) {
        game.playerHeli.occupied = false;
        p.x = game.playerHeli.x;
        p.z = game.playerHeli.z;
        hud.toast('Out of the helicopter');
      } else {
        hud.toast('Too high — land the helicopter first (X to descend)');
      }
    } else if (game.playerCar) {
      exitCar();
    } else {
      const near = nearestCar(game.cars, p.x, p.z, 4.5);
      const pier = landmarkById(city, 'pier');
      const m = missionProgress(game.missions);
      const heliNear = nearestHeli([game.playerHeli], p.x, p.z, 7);
      if (heliNear && game.playerHeli.altitude < 2) {
        game.playerHeli.occupied = true;
        if (!game.playerHeli.stolen) {
          game.playerHeli.stolen = true;
          addHeatFor(game.wanted, 'heliTheft', game.playSeconds);
          hud.toast('Helicopter taken — the PD noticed (+2 stars)');
          audio.fail();
        } else {
          hud.toast('Helicopter — Space climbs, X descends, WASD flies');
        }
        audio.rotor(true, 0);
      } else if (m && (m.stepKind === 'grab') && dist(p.x, p.z, m.stepX, m.stepZ) < 6) {
        game.grabbed = true;
        hud.toast('Case grabbed — run!');
        audio.pickup();
        addHeat(game.wanted, 2, game.playSeconds);
      } else if (!m && dist(p.x, p.z, pier.x, pier.z) < 12) {
        startNextMission();
      } else if (near) {
        enterCar(near.car);
      } else {
        hud.toast('Nothing here — head to the Pier for work');
      }
    }
  }
  if ((actions & ACTION_SHOP) !== 0) shopAction();
  if ((actions & ACTION_VIGILANTE) !== 0) {
    const target = startVigilante(game.vigilante, rng, p, city);
    if (target) hud.toast(`Vigilante job: take down the criminal — $${target.payout} reward`);
    else hud.toast(game.vigilante.cooldown > 0 ? `Vigilante cooling down (${Math.ceil(game.vigilante.cooldown)}s)` : 'Vigilante job already active');
  }
  if (input.isHeld('reload')) startReload(game.loadout);
  if (input.isHeld('garage')) contextActionOnce();
  if ((actions & ACTION_HORN) !== 0) audio.horn();

  // Shooting / punching.
  tickLoadout(game.loadout, dt);
  const shooting = (actions & ACTION_SHOOT) !== 0 || input.mouseDown;
  if (shooting && !game.playerCar) {
    const targets = [
      ...game.traffic.peds.filter((x) => !x.dead).map((x) => ({ ...x, kind: 'ped', health: 100, ref: x })),
      ...game.cops.map((x) => ({ ...x, kind: 'cop', health: 100, ref: x })),
      ...game.swat.filter((x) => !x.dead).map((x) => ({ ...x, kind: 'swat', health: x.health, ref: x })),
      ...(game.vigilante.active ? [{ ...game.vigilante.active, kind: 'criminal', health: game.vigilante.active.health, ref: game.vigilante.active }] : []),
      ...game.enemies.filter((x) => !x.dead),
    ];
    // r6: the rifle can shoot down the police helicopter — the only gun
    // with the range for it. A downed heli clears the sky for a while.
    // A rifle shot at the heli is the whole shot this frame: it does not
    // also fire at the ground, or one trigger pull would cost two rounds.
    let heliShot = false;
    if (game.loadout.current === 'rifle' && game.heli.active) {
      const hs = shootHeli(game.loadout, p.x, p.z, p.heading, game.heli);
      heliShot = hs.fired;
      if (hs.fired && hs.damage > 0) {
        audio.rifleShot();
        if (damagePoliceHeli(game.heli, hs.damage)) {
          hud.toast('Police helicopter shot down! The sky is clear');
          audio.heliDown();
          game.player.rep += 15;
        }
      }
    }
    if (!heliShot && game.loadout.current === 'fists') {
      const res = punch(game.loadout, p.x, p.z, p.heading, targets);
      if (res.fired) {
        audio.punch();
        for (const h of res.hits) {
          if (h.target.kind === 'swat' && h.target.ref) {
            damageSwat(h.target.ref, h.damage);
            if (h.target.ref.dead) registerKill(h.target);
          } else if (h.target.kind === 'criminal' && h.target.ref) {
            const r = damageVigilanteTarget(game.vigilante, h.damage);
            if (r && r.type === 'vigilante-done') { p.cash += r.payout; hud.toast(`Vigilante payout ${formatMoney(r.payout)}`); audio.cash(); }
          } else if (h.target.ref) { h.target.ref.dead = true; registerKill(h.target); }
          else if (h.target.kind === 'gang') { h.target.health -= h.damage; if (h.target.health <= 0) { h.target.dead = true; registerKill(h.target); } }
          else { h.target.dead = true; registerKill(h.target); }
        }
      }
    } else {
      const res = fireWeapon(game.loadout, p.x, p.z, p.heading, targets);
      if (res.fired) {
        audio.shot();
        addHeat(game.wanted, 0.4, game.playSeconds);
        for (const h of res.hits) {
          if (h.target.kind === 'swat' && h.target.ref) {
            damageSwat(h.target.ref, h.damage);
            if (h.target.ref.dead) registerKill(h.target);
          } else if (h.target.kind === 'criminal' && h.target.ref) {
            const r = damageVigilanteTarget(game.vigilante, h.damage);
            if (r && r.type === 'vigilante-done') { p.cash += r.payout; hud.toast(`Vigilante payout ${formatMoney(r.payout)}`); audio.cash(); }
          } else if (h.target.ref) { h.target.ref.dead = true; registerKill(h.target); }
          else if (h.target.kind === 'gang') {
            h.target.health -= h.damage;
            if (h.target.health <= 0) { h.target.dead = true; registerKill(h.target); }
          } else { h.target.dead = true; registerKill(h.target); }
        }
      }
      const carHit = shootCar(game.loadout, p.x, p.z, p.heading, [...game.traffic.cars, ...game.cars]);
      if (carHit.car) audio.crash();
    }
  }
  if (input.isHeld('w1')) switchWeapon(game.loadout, 'fists');
  if (input.isHeld('w2')) switchWeapon(game.loadout, 'pistol');
  if (input.isHeld('w3')) switchWeapon(game.loadout, 'smg');
  if (input.isHeld('w4')) switchWeapon(game.loadout, 'shotgun');
  if (input.isHeld('w5')) switchWeapon(game.loadout, 'rifle');

  // Gang enemies shoot back.
  for (const e of game.enemies) {
    if (e.dead) continue;
    e.shootTimer -= dt;
    if (e.shootTimer <= 0 && dist(e.x, e.z, p.x, p.z) < 42) {
      e.shootTimer = 1.6 + rng() * 1.2;
      if (rng() < 0.45) {
        const split = armourAbsorb(game.loadout, 9);
        if (split.healthDamage > 0) damagePlayer(p, split.healthDamage);
        hud.toast('You are taking fire!');
      }
    }
  }

  // r6: the tail-job courier drives a loop across town; the mission reads
  // the live distance to it every frame. Turf-war waves keep coming
  // while the defend step is live.
  const mTail = missionProgress(game.missions);
  if (mTail && mTail.id === 'tail-job' && mTail.stepKind === 'tail' && game.tailCar) {
    const tc = game.tailCar;
    tc.heading += 0.12 * dt;
    tc.speed = 9;
    tc.x += Math.sin(tc.heading) * tc.speed * dt;
    tc.z += Math.cos(tc.heading) * tc.speed * dt;
    tc.x = clamp(tc.x, -420, 420);
    tc.z = clamp(tc.z, -420, 420);
    if (dist(p.x, p.z, tc.x, tc.z) < 8) {
      game.tailSpotted += 1;
      if (game.tailSpotted === 1) hud.toast('Too close — the courier is looking back!');
    }
  }
  if (mTail && mTail.id === 'tail-job' && mTail.stepKind === 'grab' && game.tailCar) {
    game.tailCar.x = -138;
    game.tailCar.z = -138;
    game.tailCar.speed = 0;
  }
  if (mTail && mTail.id === 'turf-war' && mTail.stepKind === 'defend') {
    const alive = game.enemies.filter((e) => !e.dead).length;
    if (alive < 3 && rng() < dt * 0.5) {
      const a = rng() * Math.PI * 2;
      game.enemies.push({ x: p.x + Math.sin(a) * 30, z: p.z + Math.cos(a) * 30, health: 100, dead: false, radius: 0.8, kind: 'gang', shootTimer: 1 });
    }
  }

  // Traffic + peds.
  const threats = [{ x: p.x, z: p.z, radius: 16 }];
  if (game.wanted.stars > 0) threats.push({ x: p.x, z: p.z, radius: 26 });
  for (const car of game.traffic.cars) updateTrafficCar(car, game.traffic.cars, p, dt, city);
  for (const ped of game.traffic.peds) {
    if (ped.dead) continue;
    updatePed(ped, threats, dt, city);
    // Run over a ped while driving.
    if (game.playerCar && dist(game.playerCar.x, game.playerCar.z, ped.x, ped.z) < 2.4 && Math.abs(game.playerCar.speed) > 3) {
      ped.dead = true;
      addHeat(game.wanted, 1, game.playSeconds);
      hud.toast('Pedestrian hit — the city saw that');
    }
  }
  game.traffic.peds = game.traffic.peds.filter((x) => !x.dead || rng() < 0.999);

  // Cops.
  for (let i = game.cops.length - 1; i >= 0; i -= 1) {
    const cop = game.cops[i];
    const res = updateCop(cop, p, dt);
    if (res === 'busted') {
      game.deathKind = 'busted';
      return 'over';
    }
    if (cop.state === 'gone') game.cops.splice(i, 1);
  }
  for (let i = game.copCars.length - 1; i >= 0; i -= 1) {
    const unit = game.copCars[i];
    const res = updateCopCar(unit, p, game.playerCar, dt);
    if (res === 'ram' && game.playerCar) {
      damageCar(game.playerCar, 12);
      audio.crash();
      hud.toast('Police rammed your car!');
    }
    if (unit.state === 'gone' || unit.car.wrecked) game.copCars.splice(i, 1);
  }
  // r6: SWAT troopers on foot — they shoot, and they arrest faster than
  // beat cops. FIB interceptors box the player's car in and ram harder.
  for (let i = game.swat.length - 1; i >= 0; i -= 1) {
    const unit = game.swat[i];
    const res = updateSwat(unit, p, dt);
    if (res === 'busted') {
      game.deathKind = 'busted';
      return 'over';
    }
    if (res === 'shot') {
      const split = armourAbsorb(game.loadout, 11);
      if (split.healthDamage > 0) damagePlayer(p, split.healthDamage);
      hud.toast('SWAT is firing on you!');
    }
    if (unit.state === 'gone' || unit.dead) game.swat.splice(i, 1);
  }
  for (let i = game.fibCars.length - 1; i >= 0; i -= 1) {
    const unit = game.fibCars[i];
    const res = updateFibCar(unit, p, game.playerCar, dt);
    if (res === 'ram' && game.playerCar) {
      damageCar(game.playerCar, 16);
      audio.crash();
      hud.toast('FIB interceptor rammed your car!');
    }
    if (unit.state === 'gone' || unit.car.wrecked) game.fibCars.splice(i, 1);
  }
  // Helicopter spotlight calls cops in: handled by spawn logic above.

  // Packages.
  const pkg = checkPackagePickup(game.side, p.x, p.z);
  if (pkg) {
    p.cash += pkg.bonus;
    hud.toast(`Hidden package ${pkg.total}/12 — ${formatMoney(pkg.bonus)}`);
    audio.pickup();
  }

  // Taxi side job (also drives the Night Shift mission).
  const mNow = missionProgress(game.missions);
  if (mNow && mNow.id === 'night-shift' && !game.side.fare) startFare(game.side, rng, city);
  if (game.side.fare && game.playerCar) {
    const fEv = updateFare(game.side, p.x, p.z, true);
    if (fEv && fEv.type === 'delivered') {
      p.cash += fEv.pay;
      hud.toast(`Fare paid ${formatMoney(fEv.pay)}`);
      audio.cash();
      if (mNow && mNow.id === 'night-shift') missionContext({ x: p.x, z: p.z, taxiDone: 1, dt, wantedStars: game.wanted.stars });
    }
  }

  // Mission update.
  const m2 = missionProgress(game.missions);
  if (m2) {
    let gatesPassed = 0;
    if (m2.id === 'street-circuit' && game.raceGate > 0) {
      gatesPassed = game.raceGate;
      game.raceGate = 0;
    }
    missionContext({
      x: p.x, z: p.z,
      inCar: !!game.playerCar,
      carModel: game.playerCar ? game.playerCar.model : null,
      wantedStars: game.wanted.stars,
      grabbed: game.grabbed,
      deliveredCar: game.playerCar && game.playerCar.missionCar,
      raceGatesPassed: gatesPassed,
      dt,
      // r6: the new step kinds read these — heli, tail distance, spotting.
      inHeli: !!game.playerHeli.occupied,
      tailDist: game.tailCar ? dist(p.x, p.z, game.tailCar.x, game.tailCar.z) : null,
      tailSpotted: game.tailSpotted > 1,
    });
    game.grabbed = false;
  }

  // r6: intervening in a live city event pays out — catch the robber,
  // break up the brawl, or out-drive the street racer.
  const nearEv = nearestEvent(game.events, p.x, p.z, 6);
  if (nearEv && (nearEv.event.kind === 'robbery' || nearEv.event.kind === 'brawl')) {
    const done = resolveEvent(game.events, nearEv.event.id, 'caught in the act');
    if (done) {
      p.cash += done.reward;
      game.side.sideEarned += done.reward;
      hud.toast(`${done.label} stopped — ${formatMoney(done.reward)} reward`);
      audio.cash();
    }
  }
  const raceEv = game.events.active.find((e) => e.kind === 'street-race');
  if (raceEv && game.playerCar && dist(game.playerCar.x, game.playerCar.z, raceEv.actorX, raceEv.actorZ) < 6 && Math.abs(game.playerCar.speed) > 10) {
    // One overtake every 3 seconds at most — passing the racer is a
    // moment, not a frame, and the counter must not spin out of control.
    if ((game.playSeconds - (game.lastRacePass || -99)) > 3) {
      game.lastRacePass = game.playSeconds;
      const won = raceOvertake(game.events, raceEv.id);
      if (won && won.type === 'event-resolved') {
        p.cash += won.reward;
        game.side.sideEarned += won.reward;
        hud.toast(`Won the street race — ${formatMoney(won.reward)}`);
        audio.cash();
      } else if (won) {
        hud.toast(`Overtake ${won.progress}/3 — keep passing the racer`);
      }
    }
  }

  if (p.dead) {
    game.deathKind = 'wasted';
    return 'over';
  }
  game.score = scoreOf(game);
  if (game.score > game.bestScore) { game.bestScore = game.score; saveBest(game.bestScore); }
  return null;
}

let garagePressed = false;
function contextActionOnce() {
  if (garagePressed) return;
  garagePressed = true;
  setTimeout(() => { garagePressed = false; }, 350);
  contextAction();
}

function registerKill(target) {
  if (target.kind === 'ped') {
    addHeat(game.wanted, 1, game.playSeconds);
  } else if (target.kind === 'cop') {
    addHeat(game.wanted, 1, game.playSeconds);
    game.player.rep += 2;
  } else if (target.kind === 'swat') {
    // r6: dropping a SWAT trooper is worth rep — and a lot of heat.
    addHeat(game.wanted, 1, game.playSeconds);
    game.player.rep += 8;
    hud.toast('SWAT trooper down — the whole city heard that');
  } else if (target.kind === 'criminal') {
    game.player.rep += 5;
  } else if (target.kind === 'gang') {
    game.player.rep += 5;
    if (game.missions.activeId) {
      missionContext({ x: game.player.x, z: game.player.z, killed: 1, dt: 0, wantedStars: game.wanted.stars });
    }
  }
}

function hudState() {
  const m = missionProgress(game.missions);
  const gunshop = landmarkById(city, 'gunshop');
  const nearShop = gunshop && dist(game.player.x, game.player.z, gunshop.x, gunshop.z) < 16;
  return {
    player: game.player,
    playerCar: game.playerCar,
    playerHeli: game.playerHeli.occupied ? game.playerHeli : null,
    wanted: wantedSummary(game.wanted),
    dayTime: game.dayTime,
    weather: game.weather,
    cops: game.cops,
    copCars: game.copCars,
    swat: game.swat,
    fibCars: game.fibCars,
    roadblocks: game.roadblocks.blocks,
    mission: m,
    nextMission: game.missions.activeId ? null : nextAvailableMission(game.missions),
    fare: game.side.fare,
    weaponName: weaponDef(game.loadout.current).name,
    ammo: game.loadout.current === 'fists' ? '—' : String(game.loadout.weapons[game.loadout.current].ammo),
    reloading: game.loadout.reloading,
    armour: game.loadout.armour || 0,
    stamina: Math.round(game.player.stamina ?? 100),
    score: game.score,
    bestScore: game.bestScore,
    missionsDone: game.missions.completed.length,
    missionsTotal: MISSION_COUNT,
    packagesFound: game.side.packagesFound,
    packagesTotal: game.side.packagesTotal || 16,
    faresDone: game.side.faresDone,
    vigilante: game.vigilante.active,
    vigilanteDone: game.vigilante.done,
    event: game.events.active[0] || null,
    eventsDone: game.events.completed,
    shopPrompt: nearShop ? (game.shops.open ? `Iron Annie: ${selectedItem(game.shops).label} — $${selectedItem(game.shops).price} (B to buy)` : 'Iron Annie Guns — press B to shop') : game.shopPrompt,
    objective: currentObjective(),
    deathKind: game.deathKind,
    time: game.playSeconds,
  };
}

function renderState() {
  return {
    player: game.player,
    playerCar: game.playerCar,
    playerHeli: game.playerHeli,
    traffic: game.traffic,
    cops: game.cops,
    copCars: game.copCars,
    swat: game.swat,
    fibCars: game.fibCars,
    roadblocks: game.roadblocks.blocks,
    heli: game.heli,
    dayTime: game.dayTime,
    weather: game.weather,
    camYaw: input.camYaw,
    camPitch: input.camPitch,
    camDist: input.camDist,
    objective: currentObjective(),
    packages: game.side.packages,
    events: game.events.active,
    vigilante: game.vigilante.active,
    time: game.playSeconds,
  };
}

const input = createInput(glCanvas);
let screen = 'title';
let accumulator = 0;
let last = performance.now();
let muteHeld = false;

function resetRun() {
  game.player = createPlayer(322, 300);
  game.player.cash = 60;
  game.playerCar = null;
  game.cops = [];
  game.copCars = [];
  game.heli = createHeli();
  game.wanted = createWanted();
  game.missions = createMissionState();
  game.side = createSideState(city);
  game.loadout = createLoadout();
  game.enemies = [];
  game.raceGate = 0;
  game.playSeconds = 0;
  game.deathKind = null;
  game.dayTime = 0.32;
  // r6: a fresh run resets the new systems too — heli back on its pad,
  // SWAT gone, roadblocks cleared, shop closed, jobs idle.
  game.playerHeli = createPlayerHeli(368, -138);
  game.swat = [];
  game.fibCars = [];
  game.roadblocks = createRoadblockState();
  game.shops = createShopState();
  game.safehouse = createSafehouseState();
  game.vigilante = createVigilanteState();
  game.events = createEventState();
  game.shopPrompt = null;
  game.tailCar = null;
  game.tailSpotted = 0;
  game.lastRacePass = -99;
}

function startGame() {
  resetRun();
  if (hasSave(window.localStorage)) {
    const ok = loadGame(game, window.localStorage);
    if (ok) hud.toast('Save loaded — welcome back to Rust Harbor');
  }
  screen = 'play';
  hud.setScreen('play');
  audio.unlock();
  audio.startMusic();
  announce('Playing Ember Harbor. Head to the Pier for work.');
}

function endGame() {
  screen = 'over';
  hud.setScreen('over');
  audio.stopMusic();
  audio.engine(0, false);
  saveGame(game);
  announce(`${game.deathKind === 'busted' ? 'Busted' : 'Wasted'}. Score ${game.score}.`);
}

function frame(now) {
  requestAnimationFrame(frame);
  const actions = input.takeActions();
  if (actions & ACTION_PAUSE) {
    if (screen === 'play') { screen = 'paused'; hud.setScreen('paused'); }
    else if (screen === 'paused') { screen = 'play'; hud.setScreen('play'); }
  }
  if (actions & ACTION_CONFIRM) {
    if (screen === 'title' || screen === 'over') {
      if (screen === 'over' && game.deathKind === 'busted') {
        game.player.cash = Math.floor(game.player.cash * 0.8);
        respawnPlayer(game.player, 322, 300, 0);
        game.wanted = createWanted();
        game.cops = [];
        game.copCars = [];
        screen = 'play';
        hud.setScreen('play');
        hud.toast('Released — the PD kept 20% of your cash');
      } else {
        startGame();
      }
    }
  }
  // Mute toggles on the key-down edge only, not every frame it is held.
  if (input.isHeld('mute') && !muteHeld) audio.setMuted(!audio.isMuted());
  muteHeld = input.isHeld('mute');
  if (screen === 'play') {
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    let firstStep = true;
    while (accumulator >= STEP) {
      // One-shot actions go to the first sub-step only; later sub-steps
      // in the same frame get none, so a single keypress fires once.
      const res = stepWorld(STEP, input, firstStep ? actions : 0);
      firstStep = false;
      accumulator -= STEP;
      if (res === 'over') { endGame(); break; }
    }
    if (screen === 'play') {
      renderer.draw(renderState());
      hud.draw(hudState());
    }
  } else {
    last = now;
    accumulator = 0;
    if (screen === 'title' || screen === 'over' || screen === 'paused') {
      renderer.draw(renderState());
      hud.draw(hudState());
    }
  }
}

function runShot(name) {
  hud.setScreen('play');
  screen = 'play';
  // Stage each scene from a fresh run so the frame is a real game state.
  if (name === 'night') {
    game.dayTime = 0.92;
    game.weather = 'clear';
    // Stand on the street (x = 0 is a street centreline) so the camera
    // looks down the road past lit windows and lamps, not into a wall.
    game.player.x = 0;
    game.player.z = 92;
    game.player.heading = 0;
  } else if (name === 'mission') {
    // r6: the mission shot is the new Skyhook job — Vex on the heliport
    // apron beside the flyable helicopter, terminal behind it, beacon on
    // the Tower roof. The pad sits on open ground, never inside the
    // terminal building, so the camera sees the heli, not a wall.
    game.dayTime = 0.45;
    startMission(game.missions, 'skyhook');
    game.player.x = 356;
    game.player.z = -120;
    game.player.heading = Math.PI * 0.75;
    game.playerHeli.x = 368;
    game.playerHeli.z = -138;
  } else if (name === 'chase') {
    // r6: the chase shot is the full 5-star response — rain, SWAT on the
    // street, an FIB interceptor, a roadblock ahead and the heli above.
    game.dayTime = 0.78;
    game.weather = 'rain';
    const car = createCar('coupe', 0, 0, 0);
    game.cars.push(car);
    enterCar(car);
    addHeat(game.wanted, 5, 0);
    const spawned = spawnCopsForStars(5, rng, game.player);
    game.cops = spawned.cops;
    game.copCars = spawned.cars;
    game.swat = spawned.swatUnits;
    game.fibCars = spawned.fibCars;
    game.heli.active = true;
    game.heli.x = 20;
    game.heli.z = -20;
    updateRoadblocks(game.roadblocks, game.wanted, game.player, 1);
    game.roadblocks.blocks = planRoadblocks(game.player, 0, 1);
  } else {
    game.dayTime = 0.35;
    game.player.x = 0;
    game.player.z = 0;
  }
  // Drive the staged scene forward a few seconds so traffic, cops and the
  // camera settle into a lived-in frame. The chase shot crawls (0.4) so
  // the car stays near the SWAT and FIB units that spawn around it instead
  // of outrunning them off-frame in three seconds.
  const drive = name === 'chase' ? 0.4 : 1;
  const fakeInput = {
    move: () => ({ moveX: 0, moveY: game.playerCar ? drive : 0, sprint: false, jump: false }),
    isHeld: () => false,
    camYaw: Math.PI * 0.9, camPitch: 0.42, camDist: 12,
  };
  for (let i = 0; i < 180; i += 1) stepWorld(STEP, fakeInput, 0);
  // r6: the chase shot drops the police heli low into the frame after the
  // steps settle — at its patrol altitude it flies above the camera's
  // field of view and the shot reads as an empty street. Two SWAT
  // troopers and an FIB interceptor are placed ahead of the car for the
  // same reason: the chase converges from behind the camera, so the
  // units that matter must be staged where the camera looks.
  if (name === 'chase') {
    game.heli.x = game.player.x + 2;
    game.heli.z = game.player.z - 16;
    game.heli.y = 6;
    game.heli.spotX = game.player.x;
    game.heli.spotZ = game.player.z;
    if (game.swat[0]) { game.swat[0].x = game.player.x + 3; game.swat[0].z = game.player.z - 14; game.swat[0].heading = Math.PI; }
    if (game.swat[1]) { game.swat[1].x = game.player.x - 4; game.swat[1].z = game.player.z - 18; game.swat[1].heading = Math.PI; }
    if (game.fibCars[0]) { game.fibCars[0].car.x = game.player.x + 7; game.fibCars[0].car.z = game.player.z - 28; game.fibCars[0].car.heading = Math.PI; }
  }
  let painted = 0;
  function paint() {
    renderer.draw({ ...renderState(), camYaw: fakeInput.camYaw, camPitch: fakeInput.camPitch, camDist: fakeInput.camDist });
    hud.draw(hudState());
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && screen === 'play') {
    screen = 'paused';
    hud.setScreen('paused');
    announce('Paused.');
  }
});

if (shot) runShot(shot);
else {
  hud.setScreen('title');
  announce('Ember Harbor. Press Enter or click to start.');
  requestAnimationFrame(frame);
}
