// police.js — wanted level, police AI and the PD helicopter.
// Wanted 0-5 stars. Crimes add heat; heat decays when the player stays clean.
// Foot cops and police cars run a small state machine: chase the player
// while they can see them, fall back to searching the last known position
// when the trail goes cold, and give up when the heat drops. At 4-5 stars a
// police helicopter joins from above and the PD sets roadblocks across the
// road ahead: it spotlights Leo, calls the ground units in faster, and can
// be shot down for a bounty.
import { clamp, dist, angleTo, turnToward, rand } from './utils.js';
import { WORLD, randomFreePoint, collideBuildings } from './city.js';
import { makeCar, CAR_MODELS } from './vehicles.js';

export function createWanted() {
  return {
    stars: 0,
    heat: 0,          // 0..100 within the current star band
    decayTimer: 0,
    lastCrime: -999,
    bustedTimer: 0,
    copSpawnTimer: 0,
    maxCops: 0,
    heliTimer: 0,     // respawn timer for the helicopter
    roadblockTimer: 18, // seconds until the PD tries its first roadblock
  };
}

// Heat thresholds per star: reaching 100 heat adds a star.
const STAR_HEAT = [0, 25, 45, 65, 85, 100];
export function addCrime(wanted, amount, time) {
  wanted.heat += amount;
  wanted.lastCrime = time;
  wanted.decayTimer = 0;
  while (wanted.stars < 5 && wanted.heat >= STAR_HEAT[wanted.stars + 1]) {
    wanted.stars++;
  }
  wanted.maxCops = wanted.stars * 2;
}
export function clearWanted(wanted) {
  wanted.stars = 0;
  wanted.heat = 0;
  wanted.decayTimer = 0;
}

export function updateWanted(wanted, dt, time, committingCrime) {
  if (committingCrime) return;
  // Decay only after 8 quiet seconds; faster at low stars.
  if (time - wanted.lastCrime > 8) {
    wanted.decayTimer += dt;
    if (wanted.decayTimer > 2) {
      wanted.heat = Math.max(0, wanted.heat - dt * (wanted.stars <= 2 ? 3.5 : 1.6));
      while (wanted.stars > 0 && wanted.heat < STAR_HEAT[wanted.stars]) wanted.stars--;
    }
  }
}

export function makeCop(x, y, inCar) {
  return {
    x, y, angle: rand(0, Math.PI * 2),
    speed: 0,
    inCar,
    car: null,
    state: 'chase', // chase | search | patrol | roadblock
    lastSeen: { x, y },
    searchTimer: 0,
    arrestTimer: 0,
    stunTimer: 0,
    sirenPhase: rand(0, 1),
  };
}

// The PD helicopter: hovers above Leo at 4-5 stars, shines a spotlight and
// radios the ground units in. 150 HP — shoot it down for $500 and -1 star.
export function createHeli(x, y) {
  return {
    x, y, angle: 0,
    hp: 150, maxHp: 150,
    rotor: 0,
    smokeTimer: 0,
    down: false,
  };
}

export function spawnHeli(game) {
  const p = game.player;
  game.heli = createHeli(p.x + rand(-200, 200), p.y - 260);
  game.events.push({ type: 'siren' });
  game.events.push({ type: 'toast', text: 'PD helicopter overhead — they can see you!' });
}

export function updateHeli(game, dt, time) {
  const wanted = game.wanted;
  // The heli only flies at 4-5 stars; it leaves when the heat drops.
  if (wanted.stars < 4) {
    if (game.heli) game.heli = null;
    return;
  }
  if (!game.heli) {
    wanted.heliTimer -= dt;
    if (wanted.heliTimer <= 0) spawnHeli(game);
    return;
  }
  const heli = game.heli;
  const p = game.player;
  heli.rotor += dt * 22;
  // Drift toward a hover point just behind and above the player.
  const tx = p.x - 40, ty = p.y - 200;
  heli.x += (tx - heli.x) * Math.min(1, dt * 0.9);
  heli.y += (ty - heli.y) * Math.min(1, dt * 0.9);
  heli.angle = angleTo(heli.x, heli.y, p.x, p.y);
  // Smoke when badly damaged.
  if (heli.hp < 60) {
    heli.smokeTimer -= dt;
    if (heli.smokeTimer <= 0) {
      heli.smokeTimer = 0.12;
      game.particles.push({
        x: heli.x + rand(-8, 8), y: heli.y + rand(-6, 6),
        vx: rand(-20, 20), vy: rand(10, 40), life: 0.8, maxLife: 0.8, size: 5, color: '#555',
      });
    }
  }
  if (heli.hp <= 0 && !heli.down) {
    heli.down = true;
    game.events.push({ type: 'explosion', x: heli.x, y: heli.y });
    game.events.push({ type: 'heliDown' });
    game.heli = null;
    wanted.heliTimer = 30; // the PD sends another one after half a minute
  }
}

// Spawn police around the player, just off-screen, scaled to wanted stars.
export function spawnPolice(game, dt) {
  const wanted = game.wanted;
  if (wanted.stars === 0) return;
  wanted.copSpawnTimer -= dt;
  const wantFoot = Math.min(wanted.stars, 3);
  const wantCars = wanted.stars >= 2 ? Math.min(wanted.stars - 1, 3) : 0;
  const foot = game.cops.filter((c) => !c.inCar).length;
  const cars = game.cops.filter((c) => c.inCar).length;
  if (wanted.copSpawnTimer > 0) return;
  // The helicopter overhead calls ground units in faster.
  wanted.copSpawnTimer = game.heli ? 0.8 : 1.2;
  const px = game.player.x, py = game.player.y;
  const spawnAt = () => {
    const a = rand(0, Math.PI * 2);
    const d = rand(620, 780);
    return {
      x: clamp(px + Math.cos(a) * d, 60, WORLD - 60),
      y: clamp(py + Math.sin(a) * d, 60, WORLD - 160),
    };
  };
  if (foot < wantFoot) {
    const s = spawnAt();
    const cop = makeCop(s.x, s.y, false);
    cop.lastSeen = { x: px, y: py };
    game.cops.push(cop);
  } else if (cars < wantCars) {
    const s = spawnAt();
    const car = makeCar(s.x, s.y, angleTo(s.x, s.y, px, py), {
      kind: 'police', driver: 'police', color: '#1a1a22',
      model: CAR_MODELS.find((m) => m.name === 'Patrulla'),
    });
    car.siren = true;
    const cop = makeCop(s.x, s.y, true);
    cop.car = car;
    cop.lastSeen = { x: px, y: py };
    game.cars.push(car);
    game.cops.push(cop);
  }
  maybeRoadblock(game, dt);
}

// Roadblocks at 4-5 stars: the PD parks two interceptors across the road
// ahead of Leo, lights flashing. They hold position until he gets close,
// then join the chase. At most one roadblock at a time, and never while
// the player is on foot (a roadblock is a driving problem).
export function maybeRoadblock(game, dt) {
  const wanted = game.wanted;
  if (wanted.stars < 4 || !game.player.inCar || !game.player.car) return;
  if (game.cops.some((c) => c.state === 'roadblock')) return;
  wanted.roadblockTimer -= dt;
  if (wanted.roadblockTimer > 0) return;
  wanted.roadblockTimer = 45; // one roadblock at most every 45 seconds
  const car = game.player.car;
  const ahead = 340;
  const cx = car.x + Math.cos(car.angle) * ahead;
  const cy = car.y + Math.sin(car.angle) * ahead;
  const perp = car.angle + Math.PI / 2;
  for (const off of [-18, 18]) {
    const x = clamp(cx + Math.cos(perp) * off, 60, WORLD - 60);
    const y = clamp(cy + Math.sin(perp) * off, 60, WORLD - 160);
    const pc = makeCar(x, y, perp, {
      kind: 'police', driver: 'police', color: '#1a1a22',
      model: CAR_MODELS.find((m) => m.name === 'Patrulla'),
    });
    pc.speed = 0; pc.siren = true;
    const cop = makeCop(x, y, true);
    cop.car = pc;
    cop.state = 'roadblock';
    cop.lastSeen = { x: car.x, y: car.y };
    game.cars.push(pc);
    game.cops.push(cop);
  }
  game.events.push({ type: 'toast', text: 'Roadblock ahead — go around or through!' });
  game.events.push({ type: 'siren' });
}

// A cop can "see" Leo within ~700 units (further when the helicopter is
// spotting for them). Beyond that the trail goes cold.
function canSee(game, cop, px, py) {
  const sight = game.heli ? 950 : 700;
  return dist(cop.x, cop.y, px, py) < sight;
}

export function updatePolice(game, dt, time) {
  const { player, cops, city } = game;
  const px = player.inCar ? player.car.x : player.x;
  const py = player.inCar ? player.car.y : player.y;
  // At 5 stars the ground units get faster — the whole city is after Leo.
  const speedBoost = game.wanted.stars >= 5 ? 1.18 : 1.0;
  for (let i = cops.length - 1; i >= 0; i--) {
    const cop = cops[i];
    // Staged cops (screenshot scenes) are plain literals without the
    // state-machine fields — fill them in so the update never reads undefined.
    if (!cop.lastSeen) cop.lastSeen = { x: cop.x, y: cop.y };
    if (cop.searchTimer === undefined) cop.searchTimer = 0;
    if (cop.stunTimer > 0) {
      cop.stunTimer -= dt;
      continue;
    }
    const d = dist(cop.x, cop.y, px, py);
    // Roadblock cops hold position until Leo gets close, then join the
    // chase. When the heat drops below 2 stars the PD stands them down
    // and their interceptors drive off.
    if (cop.state === 'roadblock') {
      if (game.wanted.stars < 2) {
        if (cop.car) game.cars = game.cars.filter((c) => c !== cop.car);
        cops.splice(i, 1);
        continue;
      }
      if (d < 260) cop.state = 'chase';
      else continue;
    }
    // State machine: chase while visible, search the last known spot when
    // the trail goes cold, give up entirely when the heat drops.
    if (cop.state === 'chase' && !canSee(game, cop, px, py)) {
      cop.state = 'search';
      cop.searchTimer = 8;
    } else if (cop.state === 'search') {
      cop.searchTimer -= dt;
      if (canSee(game, cop, px, py)) cop.state = 'chase';
      else if (cop.searchTimer <= 0 || game.wanted.stars === 0) {
        if (cop.inCar && cop.car) game.cars = game.cars.filter((c) => c !== cop.car);
        cops.splice(i, 1);
        continue;
      }
    }
    if (cop.state === 'chase') {
      cop.lastSeen = { x: px, y: py };
    }
    const tx = cop.state === 'chase' ? px : cop.lastSeen.x;
    const ty = cop.state === 'chase' ? py : cop.lastSeen.y;
    if (cop.inCar && cop.car) {
      const car = cop.car;
      const cd = dist(car.x, car.y, px, py);
      if (cd > 1400) { // lost the trail: despawn far cops
        game.cars = game.cars.filter((c) => c !== car);
        cops.splice(i, 1);
        continue;
      }
      // Ram the player's car, or the player on foot.
      const desired = angleTo(car.x, car.y, tx, ty);
      car.angle = turnToward(car.angle, desired, dt * 2.6);
      const targetSpeed = (cd > 260 ? 235 : 200) * speedBoost;
      car.speed = lerpSpeed(car.speed, targetSpeed, dt);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      // Police cars obey the city too: they used to ghost straight through
      // buildings while chasing. A hard hit slows them down, like traffic.
      const cpos = { x: car.x, y: car.y };
      if (collideBuildings(city, cpos, 20)) {
        car.x = cpos.x; car.y = cpos.y;
        car.speed *= 0.4;
      }
      cop.x = car.x; cop.y = car.y; cop.angle = car.angle;
      // Siren wail timer for audio blips.
      cop.sirenPhase += dt;
      if (cop.sirenPhase > 1.6) { cop.sirenPhase = 0; game.events.push({ type: 'siren' }); }
      continue;
    }
    // Foot cop: chase the player; arrest when close and player is on foot.
    if (d > 1200) { cops.splice(i, 1); continue; }
    const desired = angleTo(cop.x, cop.y, tx, ty);
    cop.angle = turnToward(cop.angle, desired, dt * 5);
    cop.speed = 165 * speedBoost;
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    // Foot cops walk around buildings instead of through them.
    const fpos = { x: cop.x, y: cop.y };
    if (collideBuildings(city, fpos, 12)) { cop.x = fpos.x; cop.y = fpos.y; }
    if (!player.inCar && d < 34 && cop.state === 'chase') {
      cop.arrestTimer += dt;
      if (cop.arrestTimer > 1.1) {
        game.events.push({ type: 'busted', reason: 'arrested by the Solmarina PD' });
        cop.arrestTimer = 0;
      }
    } else {
      cop.arrestTimer = Math.max(0, cop.arrestTimer - dt * 2);
    }
  }
}

function lerpSpeed(v, target, dt) {
  return v + (target - v) * Math.min(1, dt * 1.4);
}

// Pay-n-spray: clear wanted for a fee; returns the fee or -1 when unaffordable.
export function payNSpray(game) {
  const fee = 50 + game.wanted.stars * 50;
  if (game.player.money < fee) return -1;
  game.player.money -= fee;
  clearWanted(game.wanted);
  game.cops.length = 0;
  game.cars = game.cars.filter((c) => c.kind !== 'police');
  if (game.heli) game.heli = null;
  return fee;
}
