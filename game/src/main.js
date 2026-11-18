// main.js — Solmarina boot, game loop, state machine and save.
// States: title → playing ⇄ paused → busted/wasted → playing, plus 'shop'
// (the garage upgrade overlay, which freezes the world while open).
// The day/night clock runs here: game.clock advances 0..360 seconds and
// game.light follows it; dusk flips the music into its night groove and the
// helicopter rotor sound ticks while the PD heli is overhead.
// URL query ?shot=<name>&seed=1 stages a deterministic scene for screenshots:
//   shot=chase   — Leo in a car, 3-star police chase, HUD + minimap + objective
//   shot=mission — beach shootout (mission 3) with gang members and HUD
//   shot=city    — busy street: traffic, peds, taxi fare, on foot
//   shot=police  — roadblock chase: police cars ahead, 4 stars
//   shot=night   — night drive: headlights, lamp glow, 2-star chase, Mission 7
//   shot=shop    — garage upgrade shop open, Leo in a car by the Pay-n-Spray
//   shot=start   — title screen over the city
import { clamp, dist, mulberry32, hashSeed, rand } from './utils.js';
import { buildCity, WORLD, LANDMARKS, randomRoadPoint, randomFreePoint } from './city.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createPlayer, updatePlayerOnFoot, updatePlayerDriving, tryEnterCar, damagePlayer, respawn } from './player.js';
import { spawnTraffic, spawnParked, updateTrafficCar, collideCars, makeCar, CAR_MODELS } from './vehicles.js';
import { spawnPeds, updatePeds, scarePeds, carHitsPeds } from './peds.js';
import { createWanted, addCrime, updateWanted, spawnPolice, updatePolice, updateHeli, payNSpray } from './police.js';
import { updateBullets, updatePickups, spawnPickups, WEAPONS } from './combat.js';
import { createMissionState, startMission, updateMissions, updateGang, missionObjectiveText, currentMissionDef, MIDNIGHT_CHECKPOINTS } from './missions.js';
import { drawWorld, drawHUD, drawTitle, drawPause, drawEndScreen, drawShop } from './render.js';
import { lightAt, isNight, CYCLE } from './daynight.js';
import { createShop, buyUpgrade, UPGRADES } from './garage.js';

const SAVE_KEY = 'solmarina-save-v1';
const params = new URLSearchParams(location.search);
const SHOT = params.get('shot') || '';
const SEED = parseInt(params.get('seed') || '1', 10) || 1;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

const input = createInput(canvas);
const audio = createAudio();

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { money: 50, missionsDone: 0, faresDone: 0, bestMoney: 50 };
    const s = JSON.parse(raw);
    return { money: 50, missionsDone: 0, faresDone: 0, bestMoney: 50, ...s };
  } catch {
    return { money: 50, missionsDone: 0, faresDone: 0, bestMoney: 50 };
  }
}

function buildGame() {
  const rng = mulberry32(SEED);
  const city = buildCity(SEED);
  const saveData = loadSave();
  const player = createPlayer();
  player.money = saveData.money;
  player.stats.missionsDone = 0;
  const game = {
    city, rng, input, audio,
    player,
    wanted: createWanted(),
    missions: createMissionState(),
    cars: [],
    peds: [],
    cops: [],
    gang: [],
    bullets: [],
    pickups: [],
    particles: [],
    events: [],
    camera: { x: 0, y: 0 },
    time: 0,
    clock: 0,          // day/night clock, 0..360s (0 = 08:00 morning sun)
    light: 1,          // 1.0 day … 0.32 deep night
    nightMode: false,  // true while the clock is in the Night phase
    heli: null,        // police helicopter, or null when the PD has none up
    heliSoundTimer: 0,
    shop: createShop(),
    state: 'title', // title | playing | paused | ended | shop
    endKind: null,
    endLost: 0,
    endTimer: 0,
    saveData,
    shot: SHOT,
    view: { w: canvas.width, h: canvas.height },
    save() {
      const s = {
        money: Math.max(game.player.money, 0),
        missionsDone: game.player.stats.missionsDone,
        faresDone: game.player.stats.faresDone,
        bestMoney: Math.max(game.saveData.bestMoney, game.player.money),
      };
      game.saveData = s;
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
    },
  };
  // World population.
  game.cars.push(...spawnTraffic(city, 14, rng));
  game.cars.push(...spawnParked(city, 10, rng));
  game.peds = spawnPeds(city, 26, rng);
  game.pickups = spawnPickups(city, rng, 10);
  return game;
}

let game = buildGame();

function addParticles(x, y, color, n = 14, speed = 160) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2);
    const s = rand(speed * 0.3, speed);
    game.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 0.5 + rand(0, 0.4), maxLife: 0.9, size: 2 + rand(0, 3), color,
    });
  }
}

function updateCamera(dt) {
  const p = game.player;
  const tx = clamp(p.x - canvas.width / 2, 0, Math.max(0, WORLD - canvas.width));
  const ty = clamp(p.y - canvas.height / 2, 0, Math.max(0, WORLD - canvas.height));
  const k = 1 - Math.pow(0.001, dt); // smooth follow
  game.camera.x += (tx - game.camera.x) * k;
  game.camera.y += (ty - game.camera.y) * k;
  // Mouse world coords for aiming.
  input.mouse.wx = game.camera.x + input.mouse.x;
  input.mouse.wy = game.camera.y + input.mouse.y;
}

function handleEvents(dt) {
  for (const ev of game.events) {
    if (ev.type === 'shoot') {
      audio.shoot();
      // Gunfire in public scares nearby pedestrians away from Leo.
      scarePeds(game.peds, game.player.x, game.player.y, 240);
    }
    else if (ev.type === 'enemyShot') audio.smgShoot();
    else if (ev.type === 'pickup') audio.pickup();
    else if (ev.type === 'cash') audio.cash();
    else if (ev.type === 'hurt') audio.hurt();
    else if (ev.type === 'crash') audio.crash();
    else if (ev.type === 'explosion') { addParticles(ev.x, ev.y, '#ff8a2a', 26, 260); addParticles(ev.x, ev.y, '#555', 16, 120); }
    else if (ev.type === 'missionDone') { audio.missionDone(); game.save(); }
    else if (ev.type === 'missionFail') { audio.missionFail(); game.save(); }
    else if (ev.type === 'missionStart') audio.missionStart();
    else if (ev.type === 'siren') audio.sirenBlip();
    else if (ev.type === 'door') audio.door();
    else if (ev.type === 'wall' || ev.type === 'car' || ev.type === 'heliHit') {
      addParticles(ev.x, ev.y, '#ffd94a', 4, 60);
    }
    else if (ev.type === 'kill') {
      addParticles(ev.x, ev.y, '#c22a2a', 12, 120);
      game.player.stats.kills++;
      if (ev.who === 'ped' || ev.who === 'gang') addCrime(game.wanted, ev.who === 'ped' ? 15 : 5, game.time);
    } else if (ev.type === 'hit' || ev.type === 'copHit') {
      addParticles(ev.x, ev.y, '#ffd94a', 6, 90);
      if (ev.type === 'copHit') addCrime(game.wanted, 10, game.time);
    } else if (ev.type === 'playerHit') {
      damagePlayer(game, ev.damage, 'bullet');
      addParticles(ev.x, ev.y, '#ff4a4a', 6, 90);
    } else if (ev.type === 'heliDown') {
      // Shooting down the PD helicopter pays a bounty and drops a star.
      game.player.money += 500;
      game.wanted.stars = Math.max(0, game.wanted.stars - 1);
      game.wanted.heat = 0;
      audio.cash();
      game.missions.message = 'Helicopter down! +$500, heat dropped';
      game.missions.messageTimer = 4;
      game.save();
    } else if (ev.type === 'busted') endGame('busted');
    else if (ev.type === 'wasted') endGame('wasted');
    else if (ev.type === 'toast') {
      // Toasts (pickups, car jacked, Pay-n-Spray, nitro) show as the
      // centre message — before this wiring they were pushed and never seen.
      game.missions.message = ev.text;
      game.missions.messageTimer = 4;
    }
  }
  game.events.length = 0;
}

function endGame(kind) {
  if (game.state !== 'playing') return;
  game.state = 'ended';
  game.endKind = kind;
  game.endLost = respawn(game, kind);
  game.endTimer = 0;
  audio.engine(null);
  audio.busted();
  game.save();
}

function update(dt) {
  game.time += dt;
  // Day/night clock: 360 seconds per full day. Dusk flips the music into
  // its night groove (once per phase change, not every frame).
  game.clock = (game.clock + dt) % CYCLE;
  game.light = lightAt(game.clock);
  const night = isNight(game.clock);
  if (night !== game.nightMode) {
    game.nightMode = night;
    game.audio.setNightMode(night);
  }
  game.player.stats.playTime += dt;
  updateCamera(dt);
  const p = game.player;

  // Global keys.
  if (input.wasPressed('mute')) audio.toggleMute();
  if (input.wasPressed('restart')) { restart(); return; }
  if (input.wasPressed('pause') || input.wasPressed('escape')) {
    if (game.state === 'playing') game.state = 'paused';
    else if (game.state === 'paused') game.state = 'playing';
  }

  if (game.state === 'shop') {
    // The shop freezes the world: only selection + close keys work here.
    if (input.wasPressed('garage') || input.wasPressed('escape')) {
      game.state = 'playing';
      game.shop.open = false;
    } else if (input.wasPressed('up')) {
      game.shop.selected = (game.shop.selected + UPGRADES.length - 1) % UPGRADES.length;
    } else if (input.wasPressed('down')) {
      game.shop.selected = (game.shop.selected + 1) % UPGRADES.length;
    }
  } else if (game.state === 'playing') {
    // Enter / exit car.
    if (input.wasPressed('enter')) tryEnterCar(game, game.time);
    // Honk (in a car only).
    if (input.wasPressed('horn') && p.inCar) game.audio.horn();
    // G opens the upgrade shop — but only in a car, parked near the garage.
    if (input.wasPressed('garage')) {
      const nearGarage = dist(p.x, p.y, LANDMARKS.garage.x, LANDMARKS.garage.y) < 140;
      if (nearGarage && p.inCar) {
        game.state = 'shop';
        game.shop.open = true;
        game.audio.click();
      } else if (nearGarage) {
        game.events.push({ type: 'toast', text: 'Get in a car to fit upgrades' });
      }
    }
    // F does ONE thing per press: near the garage while wanted it pays for
    // Pay-n-Spray; otherwise it starts the next mission. Before this fix a
    // single F press near the garage did both at once — starting a mission
    // and charging the spray fee in the same frame.
    if (input.wasPressed('interact')) {
      const nearGarage = dist(p.x, p.y, LANDMARKS.garage.x, LANDMARKS.garage.y) < 110;
      if (nearGarage && game.wanted.stars > 0) {
        const fee = payNSpray(game);
        if (fee > 0) game.events.push({ type: 'toast', text: `Pay-n-Spray: wanted cleared for $${fee}` });
        else game.events.push({ type: 'toast', text: 'Pay-n-Spray: not enough cash!' });
      } else if (game.missions.stage === 'idle') {
        startMission(game);
      }
    }

    if (p.inCar) updatePlayerDriving(game, dt, game.time);
    else updatePlayerOnFoot(game, dt, game.time);

    // Traffic + parked cars. The traffic AI gets the day/night clock so it
    // cruises slower after dark.
    for (const car of game.cars) {
      if (car.kind === 'traffic') updateTrafficCar(car, game.city, game.cars, dt, game.clock);
    }
    // Traffic honks flagged by the AI: play them here (traffic has no audio).
    for (const car of game.cars) {
      if (car.honked) { car.honked = false; game.audio.horn(); }
    }
    // Car-car collisions.
    for (let i = 0; i < game.cars.length; i++) {
      for (let j = i + 1; j < game.cars.length; j++) {
        const impact = collideCars(game.cars[i], game.cars[j]);
        if (impact > 90) {
          game.events.push({ type: 'crash' });
          if (game.cars[i] === p.car || game.cars[j] === p.car) {
            damagePlayer(game, impact * 0.05, 'crash');
            scarePeds(game.peds, p.x, p.y, 260);
          }
        }
      }
    }
    // Running over peds.
    if (p.inCar && p.car && Math.abs(p.car.speed) > 40) {
      const hit = carHitsPeds(p.car, game.peds);
      if (hit.length) {
        addCrime(game.wanted, 15 * hit.length, game.time);
        scarePeds(game.peds, p.x, p.y, 320);
        game.events.push({ type: 'crash' });
      }
    }
    // Speeding through a crowd scares pedestrians even without a hit.
    if (p.inCar && p.car && Math.abs(p.car.speed) > 120) {
      scarePeds(game.peds, p.x, p.y, 220);
    }
    updatePeds(game.peds, game.city, dt, game.time, game.clock);
    // Bullet hits are returned, not pushed — wire them into the event queue
    // so kills, cop hits and player hits actually play out (before this
    // wiring updateBullets' hits were computed and thrown away).
    for (const h of updateBullets(game, dt)) game.events.push(h);
    updatePickups(game, dt);
    updateGang(game, dt, game.time);
    updateMissions(game, dt, game.time);
    updateWanted(game.wanted, dt, game.time, false);
    spawnPolice(game, dt);
    updatePolice(game, dt, game.time);
    updateHeli(game, dt, game.time);
    // Helicopter rotor chop while it is overhead.
    if (game.heli) {
      game.heliSoundTimer -= dt;
      if (game.heliSoundTimer <= 0) {
        game.heliSoundTimer = 0.5;
        game.audio.heli();
      }
    }

    // Particles.
    for (const pt of game.particles) {
      pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      pt.vx *= 0.96; pt.vy *= 0.96;
      pt.life -= dt;
    }
    game.particles = game.particles.filter((pt) => pt.life > 0);
    // Respawn pickups occasionally.
    if (game.pickups.length < 6 && Math.random() < dt * 0.1) {
      const spot = randomFreePoint(game.city, Math.random);
      game.pickups.push({ x: spot.x, y: spot.y, kind: 'health', bob: 0, life: 60 });
    }
    // Keep traffic topped up near the player.
    if (game.cars.filter((c) => c.kind === 'traffic').length < 10 && Math.random() < dt * 0.2) {
      const spot = randomRoadPoint(game.city, Math.random);
      const car = makeCar(spot.x, spot.y, rand(0, Math.PI * 2), { kind: 'traffic', driver: 'traffic' });
      game.cars.push(car);
    }
    handleEvents(dt);
    // Wasted check (damagePlayer pushes the event; handleEvents ends the game).
    if (p.health <= 0 && game.state === 'playing') endGame('wasted');
  } else if (game.state === 'ended') {
    game.endTimer += dt;
    if (input.wasPressed('restart') || (input.mouse.clicked && game.endTimer > 0.6)) {
      game.state = 'playing';
    }
  }
  input.endFrame();
}

function restart() {
  const keepMoney = game.player.money;
  const keepStats = game.player.stats;
  game = buildGame();
  game.player.money = keepMoney;
  game.player.stats = keepStats;
  game.state = 'playing';
  audio.engine(null);
}

// --- Screenshot staging -----------------------------------------------------
// Deterministic scenes for ?shot=. Each stages the world, then plays.
function stageShot(name) {
  const rng = mulberry32(hashSeed(name + SEED));
  const p = game.player;
  game.state = 'playing';
  audio.startMusic();
  if (name === 'start') { game.state = 'title'; return; }
  if (name === 'chase') {
    // Leo in a Marina GT on the north-south road x=1050, 3-star chase.
    const car = makeCar(1050, 1050, -Math.PI / 2, {
      kind: 'player', driver: 'player', color: '#d84a4a',
      model: CAR_MODELS.find((m) => m.name === 'Marina GT'),
    });
    car.speed = 150;
    game.cars.push(car);
    p.inCar = true; p.car = car; p.x = car.x; p.y = car.y;
    p.money = 1250;
    game.wanted.stars = 3; game.wanted.heat = 70; game.wanted.lastCrime = 0;
    game.missions.current = 3; game.missions.stage = 'active';
    game.missions.target = { x: LANDMARKS.safehouse.x, y: LANDMARKS.safehouse.y, label: 'Escape to the safehouse' };
    game.missions.packageCarried = true;
    // Two police cars in pursuit, far enough back to not ram before the shot.
    for (let i = 0; i < 2; i++) {
      const pc = makeCar(1050, 1330 + i * 110, -Math.PI / 2, {
        kind: 'police', driver: 'police', color: '#1a1a22',
        model: CAR_MODELS.find((m) => m.name === 'Patrulla'),
      });
      pc.speed = 150; pc.siren = true;
      game.cars.push(pc);
      game.cops.push({ x: pc.x, y: pc.y, angle: -Math.PI / 2, speed: 170, inCar: true, car: pc, state: 'chase', lastSeen: { x: 1050, y: 1050 }, searchTimer: 0, arrestTimer: 0, stunTimer: 0, sirenPhase: 0 });
    }
    // Traffic + peds around for a busy chase frame.
    game.cars.push(...spawnTraffic(game.city, 6, rng));
    for (let i = 0; i < 8; i++) {
      const s = randomFreePoint(game.city, rng);
      game.peds.push({ x: s.x, y: s.y, angle: 0, speed: 0, walkSpeed: 30, state: 'flee', target: null, shirt: '#d84a4a', skin: '#e8b4b8', hair: '#2a2a2a', fleeTimer: 3, panicTimer: 0, dead: false, bob: 0 });
    }
    addParticles(1050, 1080, '#ffd94a', 8, 90);
  } else if (name === 'mission') {
    // Beach shootout: Leo on foot at Playa Sol, 5 Vipers, mission 3 active.
    p.x = 1200; p.y = 2080; p.angle = Math.PI / 2;
    p.weapon = 'smg'; p.weapons.smg = true; p.ammo.smg = 120;
    p.money = 840;
    game.missions.current = 2; game.missions.stage = 'active'; game.missions.needed = 5;
    game.missions.target = { x: LANDMARKS.beach.x, y: LANDMARKS.beach.y, label: 'Playa Sol' };
    game.gang.length = 0;
    for (let i = 0; i < 5; i++) {
      game.gang.push({
        x: 960 + i * 130, y: 2220 + (i % 2) * 40, angle: -Math.PI / 2,
        health: 100, dead: false, shootTimer: 1 + i * 0.4, state: 'guard', target: null, speed: 0,
      });
    }
    game.bullets.push({ x: 1200, y: 2100, angle: Math.PI / 2, speed: 700, damage: 18, range: 460, travelled: 0, owner: 'player', color: '#ffb84a', dead: false });
    game.wanted.stars = 2; game.wanted.heat = 50; game.wanted.lastCrime = 0;
    game.cars.push(...spawnTraffic(game.city, 4, rng));
  } else if (name === 'city') {
    // Busy street on foot: traffic, peds, taxi fare active, noon sun.
    p.x = 750; p.y = 750; p.angle = 0.6;
    p.money = 320;
    game.missions.taxi = {
      pickup: { x: 900, y: 750 }, dropoff: { x: 1650, y: 450 }, fare: 85,
      hasPassenger: false, done: false,
    };
    game.cars.push(...spawnTraffic(game.city, 8, rng));
    for (let i = 0; i < 10; i++) {
      const s = randomFreePoint(game.city, rng);
      game.peds.push({ x: s.x, y: s.y, angle: rand(0, 6), speed: 20, walkSpeed: 30, state: 'walk', target: null, shirt: '#3a6fd8', skin: '#e8b4b8', hair: '#2a2a2a', fleeTimer: 0, panicTimer: 0, dead: false, bob: 0 });
    }
  } else if (name === 'night') {
    // Night drive: Leo in a Marina GT with a nitro kit fitted, 2-star chase,
    // lamps glowing, headlights cutting the dark — Mission 7, Midnight Run.
    game.clock = 210; game.light = lightAt(210);
    game.nightMode = true; game.audio.setNightMode(true);
    const car = makeCar(1050, 1050, -Math.PI / 2, {
      kind: 'player', driver: 'player', color: '#d84a4a',
      model: CAR_MODELS.find((m) => m.name === 'Marina GT'),
    });
    car.speed = 140;
    car.upgrades.nitro = true;
    car.boostUntil = 999; // caught mid-boost so the flame shows in the shot
    game.cars.push(car);
    p.inCar = true; p.car = car; p.x = car.x; p.y = car.y;
    p.money = 950;
    game.wanted.stars = 2; game.wanted.heat = 50; game.wanted.lastCrime = 0;
    game.missions.current = 6; game.missions.stage = 'active';
    game.missions.timeLimit = 150; game.missions.timer = 40;
    game.missions.packageCarried = true;
    game.missions.checkpoints = MIDNIGHT_CHECKPOINTS.map((c) => ({ ...c, done: false }));
    game.missions.checkpointIndex = 0;
    game.missions.target = { x: MIDNIGHT_CHECKPOINTS[0].x, y: MIDNIGHT_CHECKPOINTS[0].y, label: MIDNIGHT_CHECKPOINTS[0].label };
    // One police car in pursuit.
    const pc = makeCar(1050, 1330, -Math.PI / 2, {
      kind: 'police', driver: 'police', color: '#1a1a22',
      model: CAR_MODELS.find((m) => m.name === 'Patrulla'),
    });
    pc.speed = 150; pc.siren = true;
    game.cars.push(pc);
    game.cops.push({ x: pc.x, y: pc.y, angle: -Math.PI / 2, speed: 170, inCar: true, car: pc, state: 'chase', lastSeen: { x: 1050, y: 1050 }, searchTimer: 0, arrestTimer: 0, stunTimer: 0, sirenPhase: 0 });
    game.cars.push(...spawnTraffic(game.city, 5, rng));
    // Night owls on the beach, watching the ocean.
    for (let i = 0; i < 6; i++) {
      const s = randomFreePoint(game.city, rng);
      game.peds.push({ x: 900 + i * 90, y: 2220, angle: Math.PI / 2, speed: 0, walkSpeed: 30, state: 'watch', target: null, shirt: '#3a6fd8', skin: '#e8b4b8', hair: '#2a2a2a', fleeTimer: 0, panicTimer: 0, dead: false, bob: 0 });
    }
  } else if (name === 'shop') {
    // Garage shop staging: Leo in a Marina GT beside the Pay-n-Spray with
    // $2,000 in pocket, the upgrade shop open on the engine row.
    const car = makeCar(LANDMARKS.garage.x + 60, LANDMARKS.garage.y, 0, {
      kind: 'player', driver: 'player', color: '#d84a4a',
      model: CAR_MODELS.find((m) => m.name === 'Marina GT'),
    });
    game.cars.push(car);
    p.inCar = true; p.car = car; p.x = car.x; p.y = car.y;
    p.money = 2000;
    game.state = 'shop';
    game.shop.open = true;
    game.shop.selected = 0;
  } else if (name === 'police') {
    // Roadblock chase: 4 stars, police cars ahead and behind, Leo speeding
    // south down the x=1050 road, bank already robbed (escape stage).
    const car = makeCar(1050, 750, Math.PI / 2, {
      kind: 'player', driver: 'player', color: '#3a6fd8',
      model: CAR_MODELS.find((m) => m.name === 'Marina GT'),
    });
    car.speed = 175;
    game.cars.push(car);
    p.inCar = true; p.car = car; p.x = car.x; p.y = car.y;
    p.money = 2100;
    game.wanted.stars = 4; game.wanted.heat = 88; game.wanted.lastCrime = 0;
    game.missions.current = 4; game.missions.stage = 'active'; game.missions.progress = 1;
    game.missions.target = { x: LANDMARKS.boat.x, y: LANDMARKS.boat.y, label: 'Escape to the getaway boat' };
    // Roadblock: two police cars across the road ahead (y=1050 road).
    for (const dx of [-18, 18]) {
      const pc = makeCar(1050 + dx, 1050, 0, {
        kind: 'police', driver: 'police', color: '#1a1a22',
        model: CAR_MODELS.find((m) => m.name === 'Patrulla'),
      });
      pc.speed = 0; pc.siren = true;
      game.cars.push(pc);
      game.cops.push({ x: pc.x, y: pc.y, angle: 0, speed: 0, inCar: true, car: pc, state: 'chase', lastSeen: { x: 1050, y: 750 }, searchTimer: 0, arrestTimer: 0, stunTimer: 0, sirenPhase: 0 });
    }
    // One pursuer behind.
    const pc = makeCar(1050, 480, Math.PI / 2, {
      kind: 'police', driver: 'police', color: '#1a1a22',
      model: CAR_MODELS.find((m) => m.name === 'Patrulla'),
    });
    pc.speed = 190; pc.siren = true;
    game.cars.push(pc);
    game.cops.push({ x: pc.x, y: pc.y, angle: Math.PI / 2, speed: 190, inCar: true, car: pc, state: 'chase', lastSeen: { x: 1050, y: 750 }, searchTimer: 0, arrestTimer: 0, stunTimer: 0, sirenPhase: 0 });
    game.cars.push(...spawnTraffic(game.city, 5, rng));
  } else if (name === 'play' || name === 'end') {
    // Generic staged play / end frames for the starter shot names.
    p.x = 750; p.y = 750;
    if (name === 'end') { game.state = 'ended'; game.endKind = 'wasted'; game.endLost = 120; }
  }
  updateCamera(1);
  game.camera.x = clamp(p.x - canvas.width / 2, 0, Math.max(0, WORLD - canvas.width));
  game.camera.y = clamp(p.y - canvas.height / 2, 0, Math.max(0, WORLD - canvas.height));
  input.mouse.wx = p.x + 200;
  input.mouse.wy = p.y + 100;
}

// --- Main loop ---------------------------------------------------------------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.view = { w: canvas.width, h: canvas.height };

  if (game.state === 'title') {
    updateCamera(dt);
    if (input.mouse.clicked || input.anyKey) {
      input.clearAnyKey();
      game.state = 'playing';
      audio.unlock();
      audio.startMusic();
      game.events.push({ type: 'missionStart' });
    }
    drawWorld(ctx, game, game.view);
    drawTitle(ctx, game, game.view);
    input.endFrame();
  } else if (game.state === 'paused') {
    update(dt);
    drawWorld(ctx, game, game.view);
    drawHUD(ctx, game, game.view);
    drawPause(ctx, game, game.view);
  } else if (game.state === 'shop') {
    update(dt);
    drawWorld(ctx, game, game.view);
    drawHUD(ctx, game, game.view);
    drawShop(ctx, game, game.view);
  } else if (game.state === 'ended') {
    update(dt);
    drawWorld(ctx, game, game.view);
    drawHUD(ctx, game, game.view);
    drawEndScreen(ctx, game, game.view, game.endKind, game.endLost);
  } else {
    update(dt);
    drawWorld(ctx, game, game.view);
    drawHUD(ctx, game, game.view);
  }
  requestAnimationFrame(frame);
}

// Keyboard weapon switching (Digit1/2/3) and shop buying: in the shop the
// same digits buy upgrades instead of switching weapons.
window.addEventListener('keydown', (e) => {
  const p = game.player;
  if (game.state === 'shop') {
    if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3') {
      const idx = Number(e.code.slice(-1)) - 1;
      game.shop.selected = idx;
      const msg = buyUpgrade(game, UPGRADES[idx]);
      if (msg) {
        game.missions.message = msg;
        game.missions.messageTimer = 3;
      }
    }
    return;
  }
  if (e.code === 'Digit1' && p.weapons.pistol) p.weapon = 'pistol';
  if (e.code === 'Digit2' && p.weapons.smg) p.weapon = 'smg';
  if (e.code === 'Digit3' && p.weapons.shotgun) p.weapon = 'shotgun';
});

if (SHOT) stageShot(SHOT);
requestAnimationFrame(frame);
