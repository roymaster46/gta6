// main.js — Solmarina boot, game loop, state machine and save.
// States: title → playing ⇄ paused → busted/wasted → playing, plus 'shop'
// (the garage upgrade overlay, which freezes the world while open),
// 'wheel' (the weapon wheel, hold Q — the world freezes while picking)
// and 'store' (gun store / diner / clothing shop overlay, also frozen).
// The day/night clock runs here: game.clock advances 0..360 seconds and
// game.light follows it; dusk flips the music into its night groove and the
// helicopter rotor sound ticks while the PD heli is overhead. At 3+ stars
// the radio is forced onto the Fuga FM chase groove until the heat drops.
// F is the multi-use key: Pay-n-Spray at the garage, sell the car at the
// chop shop, reclaim a towed car at the impound lot, open a shop door,
// buy the penthouse — otherwise start the next mission. District discovery
// pays $25 per district (sixteen now) and feeds district control.
// Q opens the weapon wheel. E on a driven car starts a carjack struggle
// instead of an instant steal. Resting at an owned safehouse heals Leo
// and autosaves. URL query ?shot=<name>&seed=1 stages a deterministic
// scene for screenshots:
//   shot=chase   — Leo in a car, 3-star police chase, HUD + minimap + objective
//   shot=mission — beach shootout (mission 3) with gang members and HUD
//   shot=city    — busy street: traffic, peds, taxi fare, on foot
//   shot=police  — roadblock chase: police cars ahead, 4 stars
//   shot=night   — night drive: headlights, lamp glow, 2-star chase, Mission 7
//   shot=shop    — garage upgrade shop open, Leo in a car by the Pay-n-Spray
//   shot=finale  — Mission 9 finale: armored van, 5 stars, PD heli overhead
//   shot=race    — street race mid-flight: Marina Sprint gates + rival + race HUD
//   shot=wheel   — weapon wheel open on foot at night, SMG owned, 2 stars
//   shot=store   — Marina Arms gun store open, Leo on foot at the door
//   shot=start   — title screen over the city
import { clamp, dist, mulberry32, hashSeed, rand } from './utils.js';
import { buildCity, WORLD, LANDMARKS, districtAt, districtInfo, randomRoadPoint, randomFreePoint } from './city.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createPlayer, updatePlayerOnFoot, updatePlayerDriving, tryEnterCar, damagePlayer, respawn } from './player.js';
import { spawnTraffic, spawnParked, updateTrafficCar, collideCars, makeCar, CAR_MODELS } from './vehicles.js';
import { spawnPeds, updatePeds, scarePeds, carHitsPeds, spawnShopkeepers } from './peds.js';
import { createWanted, addCrime, updateWanted, spawnPolice, updatePolice, updateHeli, payNSpray } from './police.js';
import { updateBullets, updatePickups, spawnPickups, WEAPONS } from './combat.js';
import { createMissionState, startMission, updateMissions, updateGang, missionObjectiveText, currentMissionDef, MIDNIGHT_CHECKPOINTS } from './missions.js';
import { createSideJobState, updateSideJobs } from './sidejobs.js';
import { createRaceState, updateRaces, startRace, abandonRace, nearestRaceStart } from './races.js';
import { createChopState, updateChopShop, sellCarToChop, reclaimImpound } from './chopshop.js';
import { drawWorld, drawHUD, drawTitle, drawPause, drawEndScreen, drawShop, drawWheel, drawStore } from './render.js';
import { lightAt, isNight, pedTarget, CYCLE } from './daynight.js';
import { createShop, buyUpgrade, UPGRADES } from './garage.js';
import { loadSave, applySave, saveNow, createSaveState, autosaveTick } from './save.js';
import { createRespectState, addRespect, updateRespect, restoreRespect, chopBonus } from './respect.js';
import { createWheelState, openWheel, closeWheel, updateWheel, switchWeapon, cycleWeapon } from './weaponwheel.js';
import { createShopState, nearestShop, nearestSafehouse, openShopOverlay, buySelected, buySafehouse, ownsSafehouse, shopItems, SHOPS, SAFEHOUSES } from './shops.js';
import { createCarjackState, updateCarjack, startCarjack, nearestJackableCar } from './carjack.js';
import { createTurfState, maybeTurfAttack, updateTurfWar } from './gangwar.js';
import { createCollectibleState, updateCollectibles, restoreCollectibles } from './collectibles.js';
import { createAchievementState, checkAchievements, updateAchievements, restoreAchievements } from './achievements.js';

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

function buildGame() {
  const rng = mulberry32(SEED);
  const city = buildCity(SEED);
  const saveData = loadSave();
  const player = createPlayer();
  const game = {
    city, rng, input, audio,
    player,
    wanted: createWanted(),
    missions: createMissionState(),
    sideJobs: createSideJobState(),
    races: createRaceState(), // street circuit: best times, wins, active race
    chopshop: createChopState(), // chop-shop cooldown / sales ledger
    impound: null,               // {model, color, upgrades, damage} or null
    cars: [],
    peds: [],
    cops: [],
    gang: [],
    bullets: [],
    pickups: [],
    particles: [],
    skids: [],       // handbrake skid marks, fading over 2.5s
    floaters: [],    // score popups ("DRIFT +$50", "NEAR MISS +$25"), rising
    shake: 0,        // screen-shake magnitude, decays every frame
    discovered: new Set(), // districts Leo has entered (first visit pays $25)
    audioChase: false,     // whether the chase groove is currently forced
    events: [],
    camera: { x: 0, y: 0 },
    time: 0,
    clock: 0,          // day/night clock, 0..360s (0 = 08:00 morning sun)
    light: 1,          // 1.0 day … 0.32 deep night
    nightMode: false,  // true while the clock is in the Night phase
    heli: null,        // police helicopter, or null when the PD has none up
    heliSoundTimer: 0,
    shop: createShop(),
    state: 'title', // title | playing | paused | ended | shop | wheel | store
    endKind: null,
    endLost: 0,
    endTimer: 0,
    saveData,
    saveState: createSaveState(),
    respect: null,     // respect system (createRespectState below)
    wheel: createWheelState(),
    carjack: createCarjackState(),
    turfWar: createTurfState(),
    collectibles: createCollectibleState([]),
    achievements: createAchievementState([]),
    shopState: createShopState(),
    garageCars: [],    // cars stored at the safehouse garage
    safehousesOwned: ['safehouse'],
    settings: { showHints: true },
    restTimer: 0,      // seconds spent standing in a safehouse rest zone
    rested: false,     // toast/saved flag for the current rest
    shot: SHOT,
    view: { w: canvas.width, h: canvas.height },
    save() {
      saveNow(game, game.saveState ? game.saveState.activeSlot : 0, true);
    },
  };
  // Restore the save: money, stats, weapons, discoveries, garage cars.
  applySave(game, saveData);
  // Collectibles restore from the snapshot (found indices + bonus flag).
  restoreCollectibles(game, saveData.packages || []);
  // Achievements restore from the snapshot (unlocked ids).
  restoreAchievements(game, saveData.achievements || []);
  // Respect restores from the snapshot (points + district control).
  game.respect = restoreRespect(game, {
    points: saveData.respect || 0,
    control: saveData.respectControl || {},
  });
  // World population.
  game.cars.push(...spawnTraffic(city, 18, rng));
  game.cars.push(...spawnParked(city, 12, rng));
  game.peds = spawnPeds(city, 30, rng);
  game.peds.push(...spawnShopkeepers()); // one keeper at each shop door
  game.pickups = spawnPickups(city, rng, 10);
  // Street-circuit best times survive reloads (saved under raceBest).
  game.races.best = { ...(saveData.raceBest || {}) };
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
    else if (ev.type === 'crash') { audio.crash(); game.shake = Math.max(game.shake, 6); }
    else if (ev.type === 'explosion') { addParticles(ev.x, ev.y, '#ff8a2a', 26, 260); addParticles(ev.x, ev.y, '#555', 16, 120); game.shake = Math.max(game.shake, 12); }
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
      if (ev.who === 'gang') {
        game.player.stats.rep = (game.player.stats.rep || 0) + 5;
        if (game.respect) addRespect(game, 5, 'Viper down');
      }
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
      game.player.stats.rep = (game.player.stats.rep || 0) + 50;
      if (game.respect) addRespect(game, 50, 'Helicopter down');
      game.player.stats.helisDown = (game.player.stats.helisDown || 0) + 1;
      game.wanted.stars = Math.max(0, game.wanted.stars - 1);
      game.wanted.heat = 0;
      game.shake = Math.max(game.shake, 10);
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
  // Getting caught costs respect as well as cash: the street notices.
  if (game.respect) addRespect(game, kind === 'busted' ? -150 : -100, kind === 'busted' ? 'Busted by the PD' : 'Wasted');
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
  updateRespect(game, dt);
  const p = game.player;

  // District discovery: the first visit to each of the sixteen districts
  // pays $25 and toasts its name and flavour line (city.js DISTRICTS).
  const here = districtAt(p.x, p.y);
  if (!game.discovered.has(here)) {
    game.discovered.add(here);
    p.money += 25;
    const info = districtInfo(p.x, p.y);
    game.events.push({ type: 'toast', text: `Discovered: ${here} — ${info.blurb} +$25` });
  }
  // Chase music: at 3+ stars the radio is forced onto the Fuga FM chase
  // groove; when the heat drops the driver's station comes back.
  const chase = game.wanted.stars >= 3;
  if (chase !== game.audioChase) {
    game.audioChase = chase;
    game.audio.setChaseMode(chase);
    syncRadioChip(game);
  }
  // Screen shake decays fast so a crash kicks and settles in half a second.
  game.shake = Math.max(0, game.shake - dt * 30);
  // Skid marks fade out over their 2.5-second life.
  for (const s of game.skids) s.life -= dt;
  game.skids = game.skids.filter((s) => s.life > 0);

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
  } else if (game.state === 'wheel') {
    // The weapon wheel freezes the world; the mouse picks the slot and
    // releasing Q (or clicking) confirms the pick. Staged scenes keep the
    // wheel open (sticky) so the screenshot catches it.
    updateWheel(game, dt);
    if (!game.wheel.sticky && !input.is('wheel')) closeWheel(game);
  } else if (game.state === 'store') {
    // The store overlay freezes the world: navigate, buy, close.
    const st = game.shopState;
    const itemCount = shopItems(game, st.open).length || 1;
    if (input.wasPressed('escape') || input.wasPressed('interact')) {
      game.state = 'playing';
      st.open = null;
    } else if (input.wasPressed('up')) {
      st.selected = (st.selected + itemCount - 1) % itemCount;
    } else if (input.wasPressed('down')) {
      st.selected = (st.selected + 1) % itemCount;
    } else if (input.wasPressed('confirm')) {
      const msg = buySelected(game);
      if (msg) { game.missions.message = msg; game.missions.messageTimer = 3; }
    }
  } else if (game.state === 'playing') {
    // Q opens the weapon wheel (on foot or in a car — picking a gun is
    // picking a gun). The wheel state freezes the world until closed.
    if (input.wasPressed('wheel')) openWheel(game);
    // Enter / exit car — or start a carjack on a driven car.
    if (input.wasPressed('enter')) {
      if (!p.inCar) {
        // A carjack in progress owns the E key: pressing it again must not
        // bypass the struggle with an instant steal (tryEnterCar).
        if (game.carjack.active) {
          // Hold on — the struggle ticks down in updateCarjack.
        } else {
          const jackable = nearestJackableCar(game);
          if (jackable) {
            const msg = startCarjack(game, jackable);
            if (msg) game.events.push({ type: 'toast', text: msg });
          } else {
            tryEnterCar(game, game.time);
          }
        }
      } else {
        tryEnterCar(game, game.time);
      }
    }
    // A carjack in progress ticks down while Leo holds on.
    updateCarjack(game, dt, game.time);
    // Honk (in a car only).
    if (input.wasPressed('horn') && p.inCar) game.audio.horn();
    // C cycles the car radio through its four stations (Sol / Noche /
    // Fuga / Onda) and shows the new station on the radio chip.
    if (input.wasPressed('station')) {
      const label = game.audio.cycleStation();
      game.events.push({ type: 'toast', text: `Radio: ${label}` });
      syncRadioChip(game);
    }
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
    // F does ONE thing per press, in priority order: near the garage while
    // wanted it pays for Pay-n-Spray; in a car at the chop shop it sells
    // the car to the crusher; at the impound lot it buys Leo's towed car
    // back; at a shop door it opens the shop; at the penthouse it buys it;
    // otherwise it starts the next mission. Before the priority fix a
    // single F press near the garage did both at once — starting a mission
    // and charging the spray fee in the same frame.
    if (input.wasPressed('interact')) {
      const nearGarage = dist(p.x, p.y, LANDMARKS.garage.x, LANDMARKS.garage.y) < 110;
      const nearChop = dist(p.x, p.y, LANDMARKS.chopshop.x, LANDMARKS.chopshop.y) < 110;
      const nearImpound = dist(p.x, p.y, LANDMARKS.impound.x, LANDMARKS.impound.y) < 110;
      const shop = nearestShop(game);
      const house = nearestSafehouse(game);
      if (nearGarage && game.wanted.stars > 0) {
        const fee = payNSpray(game);
        if (fee > 0) game.events.push({ type: 'toast', text: `Pay-n-Spray: wanted cleared for $${fee}` });
        else game.events.push({ type: 'toast', text: 'Pay-n-Spray: not enough cash!' });
      } else if (nearChop && p.inCar) {
        game.events.push({ type: 'toast', text: sellCarToChop(game) });
      } else if (nearImpound && game.impound) {
        game.events.push({ type: 'toast', text: reclaimImpound(game) });
      } else if (shop) {
        openShopOverlay(game, shop);
      } else if (house && house.id === 'penthouse' && !ownsSafehouse(game, 'penthouse')) {
        game.events.push({ type: 'toast', text: buySafehouse(game, 'penthouse') });
      } else if (game.missions.stage === 'idle') {
        startMission(game);
      }
    }

    // T starts a street race at the nearest start pad (or quits the race
    // that is running). startRace returns the blocker reason, if any, so
    // the player always gets told why instead of nothing happening.
    if (input.wasPressed('race')) {
      if (game.races.active) {
        abandonRace(game, 'you quit the race');
      } else {
        const pad = nearestRaceStart(game);
        if (pad) {
          const msg = startRace(game, pad.circuit.id);
          if (msg) game.events.push({ type: 'toast', text: msg });
        } else {
          game.events.push({ type: 'toast', text: 'No race start pad nearby — look for the checkered pads' });
        }
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
    // Near miss: screaming past a traffic car at 120+ without touching it
    // pays $25 and pops a floater (each car pays at most once per 3s).
    if (p.inCar && p.car && Math.abs(p.car.speed) > 120) {
      for (const car of game.cars) {
        if (car.kind !== 'traffic') continue;
        const d = dist(p.car.x, p.car.y, car.x, car.y);
        if (d < 55 && d > 40 && (!car.nearMissAt || game.time - car.nearMissAt > 3)) {
          car.nearMissAt = game.time;
          p.money += 25;
          p.stats.rep = (p.stats.rep || 0) + 2;
          p.stats.nearMisses = (p.stats.nearMisses || 0) + 1;
          if (game.respect) addRespect(game, 2, 'Near miss');
          game.floaters.push({ x: p.car.x, y: p.car.y - 40, text: 'NEAR MISS +$25', color: '#7ad8ff', life: 1.4, maxLife: 1.4 });
          game.events.push({ type: 'cash' });
        }
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
    updateSideJobs(game, dt);
    updateRaces(game, dt); // street circuit: countdown, gates, rival, prizes
    updateChopShop(game, dt); // chop-shop sale cooldown ticks down
    maybeTurfAttack(game, dt); // Viper turf war: attacks on owned districts
    updateTurfWar(game, dt);
    updateCollectibles(game, dt); // hidden packages: walk over to collect
    // Achievements: cheap predicate checks every frame; unlocks toast + save.
    checkAchievements(game);
    updateAchievements(game, dt);
    // The streets thin out after dark: top the peds back up toward the
    // target for this hour (daynight.pedTarget), a few at a time.
    const alive = game.peds.filter((pd) => !pd.dead).length;
    if (alive < pedTarget(game.clock) && Math.random() < dt * 0.5) {
      const s = randomFreePoint(game.city, Math.random);
      game.peds.push({ x: s.x, y: s.y, angle: 0, speed: 0, walkSpeed: 30, pace: 1, state: 'walk', target: null, shirt: '#3a6fd8', skin: '#e8b4b8', hair: '#2a2a2a', fleeTimer: 0, panicTimer: 0, chatTimer: 0, chatPartner: null, dead: false, bob: 0 });
    }
    updateWanted(game.wanted, dt, game.time, false, game.respect ? game.respect.tier : 0);
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

    // Resting at an owned safehouse: stand in the rest zone and Leo heals
    // 20 HP/s; reaching full health saves the game and toasts once.
    const restHouse = nearestSafehouse(game);
    if (restHouse && ownsSafehouse(game, restHouse.id) && !p.inCar) {
      game.restTimer += dt;
      if (p.health < 100) {
        p.health = clamp(p.health + 20 * dt, 0, 100);
        game.rested = false;
      } else if (!game.rested && game.restTimer > 1) {
        game.rested = true;
        game.save();
        game.events.push({ type: 'toast', text: `Rested at the ${restHouse.name} — game saved` });
      }
    } else {
      game.restTimer = 0;
      game.rested = false;
    }

    // Particles.
    for (const pt of game.particles) {
      pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      pt.vx *= 0.96; pt.vy *= 0.96;
      pt.life -= dt;
    }
    game.particles = game.particles.filter((pt) => pt.life > 0);
    // Score popups rise and fade over their short life.
    for (const f of game.floaters) { f.y -= 24 * dt; f.life -= dt; }
    game.floaters = game.floaters.filter((f) => f.life > 0);
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
    // Quiet autosave every 45 seconds of play.
    autosaveTick(game, dt);
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
  const keepRespect = game.respect;
  game = buildGame();
  game.player.money = keepMoney;
  game.player.stats = keepStats;
  game.respect = keepRespect;
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
  } else if (name === 'wheel') {
    // Weapon wheel staging: Leo on foot at dusk in Old Town, SMG + shotgun
    // owned, 2 stars, the wheel open on the SMG slot — the new HUD star.
    game.clock = 150; game.light = lightAt(150);
    p.x = 750; p.y = 750; p.angle = 0.6;
    p.weapon = 'smg'; p.weapons.smg = true; p.weapons.shotgun = true;
    p.ammo.smg = 120; p.ammo.shotgun = 12;
    p.money = 1250;
    if (game.respect) addRespect(game, 420, 'staging');
    game.wanted.stars = 2; game.wanted.heat = 50; game.wanted.lastCrime = 0;
    game.missions.current = 2; game.missions.stage = 'active'; game.missions.needed = 5;
    game.missions.target = { x: LANDMARKS.beach.x, y: LANDMARKS.beach.y, label: 'Playa Sol' };
    game.gang.length = 0;
    for (let i = 0; i < 3; i++) {
      game.gang.push({
        x: 700 + i * 130, y: 900 + (i % 2) * 40, angle: -Math.PI / 2,
        health: 100, dead: false, shootTimer: 1 + i * 0.4, state: 'guard', target: null, speed: 0,
      });
    }
    game.cars.push(...spawnTraffic(game.city, 4, rng));
    openWheel(game);
    game.wheel.hovered = 1; // SMG slot highlighted
    game.wheel.sticky = true; // keep the wheel open for the screenshot
  } else if (name === 'store') {
    // Marina Arms staging: Leo on foot at the gun store door in Old Town,
    // $1,500 in pocket, the store overlay open on the SMG row.
    p.x = 375; p.y = 600; p.angle = 0;
    p.money = 1500;
    p.weapons.smg = true; p.ammo.smg = 30;
    game.shopState.open = 'gunstore';
    game.shopState.selected = 0;
    game.state = 'store';
    game.cars.push(...spawnTraffic(game.city, 4, rng));
    for (let i = 0; i < 6; i++) {
      const s = randomFreePoint(game.city, rng);
      game.peds.push({ x: s.x, y: s.y, angle: rand(0, 6), speed: 20, walkSpeed: 30, state: 'walk', target: null, shirt: '#3a6fd8', skin: '#e8b4b8', hair: '#2a2a2a', fleeTimer: 0, panicTimer: 0, dead: false, bob: 0 });
    }
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
  } else if (name === 'finale') {
    // Mission 9 finale: Leo in the stolen armored van outside the bank,
    // 5 stars, PD helicopter overhead, the whole city after him.
    game.clock = 60; game.light = lightAt(60);
    const van = makeCar(LANDMARKS.bank.x + 60, LANDMARKS.bank.y + 120, 0.4, {
      kind: 'player', driver: 'player', color: '#2a2a2e',
      model: CAR_MODELS.find((m) => m.name === 'Camioneta'),
    });
    van.speed = 120;
    game.cars.push(van);
    p.inCar = true; p.car = van; p.x = van.x; p.y = van.y;
    p.money = 4800;
    game.wanted.stars = 5; game.wanted.heat = 100; game.wanted.lastCrime = 0;
    game.missions.current = 8; game.missions.stage = 'active';
    game.missions.timeLimit = 180; game.missions.timer = 35;
    game.missions.packageCarried = true;
    game.missions.targetCar = van;
    game.missions.target = { x: LANDMARKS.boat.x, y: LANDMARKS.boat.y, label: 'Escape to the getaway boat' };
    // Maya talks Leo through the job — the dialogue card shows on the cover.
    game.missions.dialogue = { sayer: 'Maya', role: 'Getaway Driver', say: 'The van’s the job, Leo. Bring it to the boat and we’re rich.' };
    game.missions.dialogueTimer = 8;
    // The PD helicopter, hovering over the bank.
    game.heli = { x: van.x + 60, y: van.y - 200, angle: 0, hp: 150, maxHp: 150, rotor: 1.2, smokeTimer: 0, down: false };
    // Two police cars in pursuit behind the van.
    for (let i = 0; i < 2; i++) {
      const pc = makeCar(LANDMARKS.bank.x + 60 - i * 40, LANDMARKS.bank.y + 260 + i * 110, -Math.PI / 2, {
        kind: 'police', driver: 'police', color: '#1a1a22',
        model: CAR_MODELS.find((m) => m.name === 'Patrulla'),
      });
      pc.speed = 150; pc.siren = true;
      game.cars.push(pc);
      game.cops.push({ x: pc.x, y: pc.y, angle: -Math.PI / 2, speed: 170, inCar: true, car: pc, state: 'chase', lastSeen: { x: van.x, y: van.y }, searchTimer: 0, arrestTimer: 0, stunTimer: 0, sirenPhase: 0 });
    }
    game.cars.push(...spawnTraffic(game.city, 6, rng));
    // Fleeing peds near the bank for a busy finale frame.
    for (let i = 0; i < 8; i++) {
      const s = randomFreePoint(game.city, rng);
      game.peds.push({ x: s.x, y: s.y, angle: 0, speed: 0, walkSpeed: 30, pace: 1.6, state: 'flee', target: null, shirt: '#d84a4a', skin: '#e8b4b8', hair: '#2a2a2a', fleeTimer: 3, panicTimer: 0, chatTimer: 0, chatPartner: null, dead: false, bob: 0 });
    }
    addParticles(van.x, van.y - 40, '#ffd94a', 8, 90);
  } else if (name === 'race') {
    // Street race mid-flight: Leo in a Marina GT on the Marina Sprint,
    // two gates cleared, rival pace car ahead on the loop, timer running.
    const car = makeCar(1050, 300, 0, {
      kind: 'player', driver: 'player', color: '#d84a4a',
      model: CAR_MODELS.find((m) => m.name === 'Marina GT'),
    });
    car.speed = 150;
    game.cars.push(car);
    p.inCar = true; p.car = car; p.x = car.x; p.y = car.y;
    p.money = 1250;
    startRace(game, 'marina');
    const a = game.races.active;
    if (a) {
      a.countdown = 0; a.started = true; a.time = 42.3;
      a.totalPassed = 2; a.nextIndex = 3; a.lap = 1;
      a.rivalDist = 1150;
      const rp = a.rivalCar;
      rp.x = 700; rp.y = 450; rp.angle = Math.PI; rp.speed = 64;
    }
    game.missions.message = '';
    game.missions.messageTimer = 0;
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
  } else if (game.state === 'wheel') {
    update(dt);
    drawWorld(ctx, game, game.view);
    drawHUD(ctx, game, game.view);
    drawWheel(ctx, game, game.view);
  } else if (game.state === 'store') {
    update(dt);
    drawWorld(ctx, game, game.view);
    drawHUD(ctx, game, game.view);
    drawStore(ctx, game, game.view);
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

// Keyboard weapon switching (Digit1/2/3/4) and shop buying: in the shop the
// same digits buy upgrades instead of switching weapons; in a store they
// select the row, and Enter buys it.
window.addEventListener('keydown', (e) => {
  const p = game.player;
  if (game.state === 'shop') {
    if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3' || e.code === 'Digit4') {
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
  if (game.state === 'store') {
    if (e.code === 'Digit1' || e.code === 'Digit2' || e.code === 'Digit3' || e.code === 'Digit4' || e.code === 'Digit5') {
      game.shopState.selected = Number(e.code.slice(-1)) - 1;
    }
    return;
  }
  if (e.code === 'Digit1') switchWeapon(game, 'pistol');
  if (e.code === 'Digit2') switchWeapon(game, 'smg');
  if (e.code === 'Digit3') switchWeapon(game, 'shotgun');
  if (e.code === 'Digit4') switchWeapon(game, 'rifle');
  if (e.code === 'Digit5') switchWeapon(game, 'molotov');
  if (e.code === 'Digit6') switchWeapon(game, 'revolver');
});

// Mouse-wheel weapon cycling: scroll to the next owned gun without opening
// the wheel. The wheel state still owns the logic (cycleWeapon).
window.addEventListener('wheel', (e) => {
  if (game.state !== 'playing') return;
  cycleWeapon(game, e.deltaY > 0 ? 1 : -1);
}, { passive: true });

// The DOM radio chip (index.html #radio) shows the station the synth is
// playing right now; it follows dial changes and the chase groove.
function syncRadioChip(game) {
  const el = document.getElementById('radio');
  if (el) el.textContent = game.audio.stationName();
}

if (SHOT) stageShot(SHOT);
requestAnimationFrame(frame);
