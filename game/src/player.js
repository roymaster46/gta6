// player.js — Leo Marín on foot and behind the wheel.
// Owns movement, entering/exiting cars, shooting, damage and respawn.
// Driving now includes nitro: press N in a car that has a Nitro Kit fitted
// at the garage for a short boost (2.5s, 8s cooldown) with flame particles.
import { clamp, dist, angleTo, turnToward, rand, pick } from './utils.js';
import { WORLD, collideBuildings, LANDMARKS } from './city.js';
import { nearestCar, driveCar, carHealth } from './vehicles.js';
import { fireWeapon, WEAPONS } from './combat.js';
import { addCrime } from './police.js';
import { activateNitro, nitroActive, nitroReady, maxHealthOf } from './garage.js';

export function createPlayer() {
  return {
    x: LANDMARKS.safehouse.x + 40,
    y: LANDMARKS.safehouse.y + 40,
    angle: 0, // facing (aim) angle
    moveAngle: 0,
    speed: 0,
    health: 100,
    armor: 0,
    stamina: 100, // sprint drains it, standing still refills it
    skidTimer: 0, // throttle for the skid sound while handbraking
    money: 50,
    inCar: false,
    car: null,
    weapon: 'pistol',
    weapons: { pistol: true, smg: false, shotgun: false, rifle: false },
    ammo: { pistol: Infinity, smg: 0, shotgun: 0, rifle: 0 },
    fireTimer: 0,
    hurtTimer: 0,
    stats: { missionsDone: 0, faresDone: 0, kills: 0, carsStolen: 0, deaths: 0, playTime: 0, couriersDone: 0, rampagesDone: 0, rep: 0 },
    driftTime: 0, // seconds spent handbrake-drifting in the current chain
    drifting: false,
  };
}

export function damagePlayer(game, amount, source) {
  const p = game.player;
  // Brief invulnerability after any hit: without it, a multi-car pileup
  // drains the player in a single frame (one damage call per colliding
  // pair), and a crash landing on the same tick as a bullet double-counts.
  if (p.hurtTimer > 0) return;
  let remaining = amount;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, remaining * 0.6);
    p.armor -= absorbed;
    remaining -= absorbed;
  }
  p.health -= remaining;
  p.hurtTimer = 0.35;
  game.events.push({ type: 'hurt' });
  if (p.health <= 0) {
    p.health = 0;
    game.events.push({ type: 'wasted', reason: source === 'arrest' ? 'arrested' : 'wasted' });
  }
}

// On-foot movement: WASD, Shift sprint, mouse aim, click to shoot.
// Sprinting drains stamina (25/s) and stops working at 0; standing still
// or walking refills it (15/s), so a sprint is a choice, not a default.
export function updatePlayerOnFoot(game, dt, time) {
  const p = game.player;
  const input = game.input;
  const wantSprint = input.is('sprint') && p.stamina > 0;
  const speed = wantSprint ? 250 : 150;
  let mx = (input.is('right') ? 1 : 0) - (input.is('left') ? 1 : 0);
  let my = (input.is('down') ? 1 : 0) - (input.is('up') ? 1 : 0);
  const moving = mx !== 0 || my !== 0;
  if (moving) {
    const len = Math.hypot(mx, my);
    mx /= len; my /= len;
    p.x += mx * speed * dt;
    p.y += my * speed * dt;
    p.moveAngle = Math.atan2(my, mx);
    p.speed = speed;
    if (wantSprint) p.stamina = Math.max(0, p.stamina - 25 * dt);
    else p.stamina = Math.min(100, p.stamina + 8 * dt);
  } else {
    p.speed = 0;
    p.stamina = Math.min(100, p.stamina + 15 * dt);
  }
  p.x = clamp(p.x, 24, WORLD - 24);
  p.y = clamp(p.y, 24, WORLD - 24);
  collideBuildings(game.city, p, 13);

  // Aim at the mouse (world coords set by main.js each frame).
  p.angle = angleTo(p.x, p.y, game.input.mouse.wx, game.input.mouse.wy);

  // Shooting.
  p.fireTimer -= dt;
  const weapon = WEAPONS[p.weapon];
  const wantFire = weapon.auto ? input.mouse.down : input.mouse.clicked;
  if (wantFire && p.fireTimer <= 0 && (p.ammo[p.weapon] === Infinity || p.ammo[p.weapon] > 0)) {
    p.fireTimer = weapon.rate;
    if (p.ammo[p.weapon] !== Infinity) p.ammo[p.weapon]--;
    const bullets = fireWeapon(game, p, weapon, game.input.mouse.wx, game.input.mouse.wy);
    game.bullets.push(...bullets);
    // Muzzle flash: a short-lived burst at the gun tip, drawn as particles.
    const fa = angleTo(p.x, p.y, game.input.mouse.wx, game.input.mouse.wy);
    for (let i = 0; i < 4; i++) {
      game.particles.push({
        x: p.x + Math.cos(fa) * 22 + rand(-3, 3), y: p.y + Math.sin(fa) * 22 + rand(-3, 3),
        vx: Math.cos(fa) * rand(40, 120), vy: Math.sin(fa) * rand(40, 120),
        life: 0.12, maxLife: 0.12, size: 4 + rand(0, 3), color: pick(['#ffd94a', '#ffb84a', '#fff2b8']),
      });
    }
    game.events.push({ type: 'shoot', weapon: p.weapon });
    addCrime(game.wanted, 4, time); // firing a gun in public draws heat
    game.audio.shoot();
  }
  // Weapon switch (1/2/3/4) is handled in main.js.
}

// Enter / exit the nearest car.
export function tryEnterCar(game, time) {
  const p = game.player;
  if (p.inCar) {
    // Exit the car.
    const car = p.car;
    const side = { x: car.x - Math.sin(car.angle) * 34, y: car.y + Math.cos(car.angle) * 34 };
    p.x = side.x; p.y = side.y;
    p.inCar = false;
    p.car = null;
    car.driver = null;
    car.speed = 0;
    game.events.push({ type: 'door' });
    return true;
  }
  const car = nearestCar(game.cars, p.x, p.y, 95);
  if (!car) return false;
  const wasParked = car.kind === 'parked';
  const wasTraffic = car.kind === 'traffic';
  p.inCar = true;
  p.car = car;
  car.driver = 'player';
  car.kind = 'player';
  car.speed = 0;
  game.events.push({ type: 'door' });
  if (wasTraffic || wasParked) {
    p.stats.carsStolen++;
    addCrime(game.wanted, wasTraffic ? 12 : 6, time);
    game.events.push({ type: 'toast', text: wasTraffic ? 'Car jacked! +wanted' : 'Car taken' });
  }
  return true;
}

export function updatePlayerDriving(game, dt, time) {
  const p = game.player;
  const car = p.car;
  if (!car) { p.inCar = false; return; }
  const input = game.input;
  const drive = {
    up: input.is('up'), down: input.is('down'),
    left: input.is('left'), right: input.is('right'),
    handbrake: input.is('handbrake'),
  };
  // Nitro: one press, 2.5s of boost, 8s cooldown. Only works on a car with
  // the kit fitted; pressing N in a stock car tells you why nothing happens.
  if (input.wasPressed('nitro')) {
    if (activateNitro(car, time)) {
      game.audio.nitro();
      game.events.push({ type: 'toast', text: 'NITRO!' });
    } else if (car.upgrades && !car.upgrades.nitro) {
      game.events.push({ type: 'toast', text: 'No nitro kit — fit one at the garage (G)' });
    }
  }
  driveCar(car, drive, dt, time);
  // Handbrake at speed lays skid marks on the asphalt and plays a squeal
  // (throttled so it does not stutter every frame). Marks fade after 2.5s.
  p.skidTimer -= dt;
  if (drive.handbrake && Math.abs(car.speed) > 40) {
    game.skids.push({ x: car.x, y: car.y, angle: car.angle, life: 2.5, maxLife: 2.5 });
    if (game.skids.length > 220) game.skids.splice(0, game.skids.length - 220);
    if (p.skidTimer <= 0) { p.skidTimer = 0.25; game.audio.skid(); }
  }
  // Drift chain: handbrake + steering at speed builds drift time; letting
  // go (or slowing under 40) banks it as cash + REP with a floater. The
  // threshold is 50, not 80: the handbrake bleeds speed toward ~56 while
  // the accelerator is held, so 80 would make drifting unreachable.
  const drifting = drive.handbrake && Math.abs(car.speed) > 50 && (drive.left || drive.right);
  if (drifting) {
    p.driftTime += dt;
    p.drifting = true;
  } else if (p.drifting) {
    if (p.driftTime > 0.8) {
      const award = Math.round(p.driftTime) * 25;
      p.money += award;
      p.stats.rep = (p.stats.rep || 0) + 5;
      game.floaters.push({ x: car.x, y: car.y - 40, text: `DRIFT +$${award}`, color: '#ffd94a', life: 1.6, maxLife: 1.6 });
      game.events.push({ type: 'cash' });
    }
    p.driftTime = 0;
    p.drifting = false;
  }
  // Nitro flame particles trail behind the exhaust while boosting.
  if (nitroActive(car, time)) {
    const bx = car.x - Math.cos(car.angle) * car.model.len * 0.6;
    const by = car.y - Math.sin(car.angle) * car.model.len * 0.6;
    game.particles.push({
      x: bx + rand(-4, 4), y: by + rand(-4, 4),
      vx: -Math.cos(car.angle) * 120 + rand(-20, 20),
      vy: -Math.sin(car.angle) * 120 + rand(-20, 20),
      life: 0.35, maxLife: 0.35, size: 6, color: pick(['#ff9a3c', '#ffd23c', '#ff5a3c']),
    });
  }
  // Car vs buildings: push out and damage on hard hits. Health is measured
  // against the car's own max (armour plating raises it), not a flat 100.
  const pos = { x: car.x, y: car.y };
  if (collideBuildings(game.city, pos, 20)) {
    const impact = Math.abs(car.speed);
    car.x = pos.x; car.y = pos.y;
    car.speed *= -0.25;
    if (impact > 120) {
      car.damage += impact * 0.06;
      car.health = carHealth(car);
      game.events.push({ type: 'crash' });
      game.audio.crash();
    }
  }
  p.x = car.x; p.y = car.y;
  p.angle = car.angle;
  // Engine sound follows speed.
  game.audio.engine(Math.abs(car.speed) / car.model.top);
  // Wrecked car: smoke, then the player is forced out.
  if (carHealth(car) <= 0 && car.damage > 0) {
    game.events.push({ type: 'explosion', x: car.x, y: car.y });
    game.audio.explosion();
    car.health = maxHealthOf(car); car.damage = 0;
    tryEnterCar(game, time);
    damagePlayer(game, 20, 'crash');
  }
}

// Busted / wasted: lose some cash, respawn at the hospital or safehouse.
export function respawn(game, kind) {
  const p = game.player;
  const lost = Math.min(p.money, Math.floor(p.money * 0.2) + 20);
  p.money -= lost;
  p.deaths++;
  if (p.inCar && p.car) {
    p.car.driver = null;
    p.car.kind = 'parked';
    p.car.speed = 0;
    p.car = null;
    p.inCar = false;
  }
  const spot = kind === 'busted' ? LANDMARKS.hospital : LANDMARKS.safehouse;
  p.x = spot.x + 40;
  p.y = spot.y + 40;
  p.health = 100;
  p.armor = 0;
  game.wanted.stars = 0;
  game.wanted.heat = 0;
  game.cops.length = 0;
  game.cars = game.cars.filter((c) => c.kind !== 'police');
  // The helicopter leaves too — the PD calls it off after an arrest.
  game.heli = null;
  game.audio.engine(null);
  return lost;
}
