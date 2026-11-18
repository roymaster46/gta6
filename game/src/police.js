// police.js — wanted level, police foot cops and police cars, busted/wasted.
// Wanted 0-5 stars. Crimes add heat; heat decays when the player stays clean.
// Police spawn at the edge of the camera view and chase; foot cops try to
// arrest a player on foot, police cars ram the player's car.
import { clamp, dist, angleTo, turnToward, rand, pick } from './utils.js';
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
    state: 'chase', // chase | arrest | stunned
    arrestTimer: 0,
    stunTimer: 0,
    sirenPhase: rand(0, 1),
  };
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
  wanted.copSpawnTimer = 1.2;
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
    game.cops.push(makeCop(s.x, s.y, false));
  } else if (cars < wantCars) {
    const s = spawnAt();
    const car = makeCar(s.x, s.y, angleTo(s.x, s.y, px, py), {
      kind: 'police', driver: 'police', color: '#1a1a22',
      model: CAR_MODELS.find((m) => m.name === 'Patrulla'),
    });
    car.siren = true;
    const cop = makeCop(s.x, s.y, true);
    cop.car = car;
    game.cars.push(car);
    game.cops.push(cop);
  }
}

export function updatePolice(game, dt, time) {
  const { player, cops, city } = game;
  const px = player.inCar ? player.car.x : player.x;
  const py = player.inCar ? player.car.y : player.y;
  for (let i = cops.length - 1; i >= 0; i--) {
    const cop = cops[i];
    if (cop.stunTimer > 0) {
      cop.stunTimer -= dt;
      continue;
    }
    if (cop.inCar && cop.car) {
      const car = cop.car;
      const d = dist(car.x, car.y, px, py);
      if (d > 1400) { // lost the trail: despawn far cops
        game.cars = game.cars.filter((c) => c !== car);
        cops.splice(i, 1);
        continue;
      }
      // Ram the player's car, or the player on foot.
      const desired = angleTo(car.x, car.y, px, py);
      car.angle = turnToward(car.angle, desired, dt * 2.6);
      const targetSpeed = d > 260 ? 235 : 200;
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
    const d = dist(cop.x, cop.y, px, py);
    if (d > 1200) { cops.splice(i, 1); continue; }
    const desired = angleTo(cop.x, cop.y, px, py);
    cop.angle = turnToward(cop.angle, desired, dt * 5);
    cop.speed = 165;
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    // Foot cops walk around buildings instead of through them.
    const fpos = { x: cop.x, y: cop.y };
    if (collideBuildings(city, fpos, 12)) { cop.x = fpos.x; cop.y = fpos.y; }
    if (!player.inCar && d < 34) {
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
  return fee;
}
