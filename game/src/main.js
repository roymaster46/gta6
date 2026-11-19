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
import { createWanted, addHeat, updateWanted, clearWanted, spawnCopsForStars, updateCop, updateCopCar, createHeli, updateHeli, heliActive, wantedSummary } from './police.js';
import { createMissionState, startMission, updateMission, missionProgress, nextAvailableMission, totalEarned, createSideState, checkPackagePickup, startFare, updateFare, missionDef } from './missions.js';
import { createLoadout, switchWeapon, giveWeapon, fireWeapon, punch, shootCar, weaponDef, tickLoadout, applyHit } from './combat.js';
import { createRenderer } from './render.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import { createInput, ACTION_INTERACT, ACTION_JUMP, ACTION_PAUSE, ACTION_CONFIRM, ACTION_SHOOT, ACTION_NITRO, ACTION_HORN } from './input.js';
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

function contextAction() {
  const p = game.player;
  const pos = game.playerCar || p;
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

  // Wanted decay + police spawning keeps pace with stars.
  const committing = false;
  updateWanted(game.wanted, dt, committing);
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

  // Player or car movement.
  if (game.playerCar) {
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

  // Interact: enter/exit car, start mission at the pier, grab case.
  if ((actions & ACTION_INTERACT) !== 0) {
    if (game.playerCar) {
      exitCar();
    } else {
      const near = nearestCar(game.cars, p.x, p.z, 4.5);
      const pier = landmarkById(city, 'pier');
      const m = missionProgress(game.missions);
      if (m && (m.stepKind === 'grab') && dist(p.x, p.z, m.stepX, m.stepZ) < 6) {
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
  if (input.isHeld('garage')) contextActionOnce();
  if ((actions & ACTION_HORN) !== 0) audio.horn();

  // Shooting / punching.
  tickLoadout(game.loadout, dt);
  const shooting = (actions & ACTION_SHOOT) !== 0 || input.mouseDown;
  if (shooting && !game.playerCar) {
    const targets = [
      ...game.traffic.peds.filter((x) => !x.dead).map((x) => ({ ...x, kind: 'ped', health: 100, ref: x })),
      ...game.cops.map((x) => ({ ...x, kind: 'cop', health: 100, ref: x })),
      ...game.enemies.filter((x) => !x.dead),
    ];
    if (game.loadout.current === 'fists') {
      const res = punch(game.loadout, p.x, p.z, p.heading, targets);
      if (res.fired) {
        audio.punch();
        for (const h of res.hits) {
          if (h.target.ref) { h.target.ref.dead = true; }
          else if (h.target.kind === 'gang') { h.target.health -= h.damage; if (h.target.health <= 0) h.target.dead = true; }
          else { h.target.dead = true; }
          registerKill(h.target);
        }
      }
    } else {
      const res = fireWeapon(game.loadout, p.x, p.z, p.heading, targets);
      if (res.fired) {
        audio.shot();
        addHeat(game.wanted, 0.4, game.playSeconds);
        for (const h of res.hits) {
          if (h.target.ref) { h.target.ref.dead = true; registerKill(h.target); }
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

  // Gang enemies shoot back.
  for (const e of game.enemies) {
    if (e.dead) continue;
    e.shootTimer -= dt;
    if (e.shootTimer <= 0 && dist(e.x, e.z, p.x, p.z) < 42) {
      e.shootTimer = 1.6 + rng() * 1.2;
      if (rng() < 0.45) {
        damagePlayer(p, 9);
        hud.toast('You are taking fire!');
      }
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
    });
    game.grabbed = false;
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
  } else if (target.kind === 'gang') {
    game.player.rep += 5;
    if (game.missions.activeId) {
      missionContext({ x: game.player.x, z: game.player.z, killed: 1, dt: 0, wantedStars: game.wanted.stars });
    }
  }
}

function hudState() {
  const m = missionProgress(game.missions);
  return {
    player: game.player,
    playerCar: game.playerCar,
    wanted: wantedSummary(game.wanted),
    dayTime: game.dayTime,
    weather: game.weather,
    cops: game.cops,
    copCars: game.copCars,
    mission: m,
    nextMission: game.missions.activeId ? null : nextAvailableMission(game.missions),
    fare: game.side.fare,
    weaponName: weaponDef(game.loadout.current).name,
    ammo: game.loadout.current === 'fists' ? '—' : String(game.loadout.weapons[game.loadout.current].ammo),
    score: game.score,
    bestScore: game.bestScore,
    missionsDone: game.missions.completed.length,
    packagesFound: game.side.packagesFound,
    faresDone: game.side.faresDone,
    objective: currentObjective(),
    deathKind: game.deathKind,
    time: game.playSeconds,
  };
}

function renderState() {
  return {
    player: game.player,
    playerCar: game.playerCar,
    traffic: game.traffic,
    cops: game.cops,
    copCars: game.copCars,
    heli: game.heli,
    dayTime: game.dayTime,
    weather: game.weather,
    camYaw: input.camYaw,
    camPitch: input.camPitch,
    camDist: input.camDist,
    objective: currentObjective(),
    packages: game.side.packages,
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
    game.dayTime = 0.45;
    startMission(game.missions, 'first-drop');
    game.player.x = -100;
    game.player.z = -260;
  } else if (name === 'chase') {
    game.dayTime = 0.78;
    game.weather = 'rain';
    const car = createCar('coupe', 0, 0, 0);
    game.cars.push(car);
    enterCar(car);
    addHeat(game.wanted, 3, 0);
    const spawned = spawnCopsForStars(3, rng, game.player);
    game.cops = spawned.cops;
    game.copCars = spawned.cars;
    game.heli.active = true;
    game.heli.x = 20;
    game.heli.z = -20;
  } else {
    game.dayTime = 0.35;
    game.player.x = 0;
    game.player.z = 0;
  }
  // Drive the staged scene forward a few seconds so traffic, cops and the
  // camera settle into a lived-in frame.
  const fakeInput = {
    move: () => ({ moveX: 0, moveY: game.playerCar ? 1 : 0, sprint: false, jump: false }),
    isHeld: () => false,
    camYaw: Math.PI * 0.9, camPitch: 0.42, camDist: 12,
  };
  for (let i = 0; i < 180; i += 1) stepWorld(STEP, fakeInput, 0);
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
