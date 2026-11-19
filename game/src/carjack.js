// carjack.js — carjacking: stealing a car with a driver in it is a fight.
// The old tryEnterCar treated a traffic car like a parked one: press E
// and it was yours. Now a driven car has an owner who resists. The
// carjack has three phases:
//   1. GRAB — Leo yanks the door. The driver struggles for 0.6-1.4s
//      (shorter for nervous drivers, longer for tough ones).
//   2. DRAG — Leo hauls the driver out. The driver may fight back: a
//      25% chance they swing at Leo (10 damage) before running off.
//   3. GONE — the car is Leo's, the driver flees on foot, and the
//      carjack counts as a crime (+12 wanted) plus a respect bump.
// Some drivers fight harder: taxi drivers and gang cars resist longer,
// and a driver in a car Leo already owns nothing about gets a 10% chance
// to trigger the car alarm — nearby cops get Leo's position and a star.
// The system is pure state on the game object (game.carjack) so the
// headless tests can run a whole carjack without a canvas.
import { clamp, dist, rand } from './utils.js';
import { addCrime } from './police.js';

export const CARJACK_GRAB_TIME = 0.6; // base struggle time, seconds
export const CARJACK_FIGHT_CHANCE = 0.25;
export const CARJACK_FIGHT_DAMAGE = 10;
export const CARJACK_ALARM_CHANCE = 0.1;
export const CARJACK_RANGE = 95;

// Driver temperaments: how long they struggle and how likely they fight.
export const DRIVER_TYPES = {
  nervous: { struggle: 0.6, fight: 0.1, label: 'nervous driver' },
  normal: { struggle: 1.0, fight: 0.25, label: 'driver' },
  tough: { struggle: 1.4, fight: 0.45, label: 'tough driver' },
  taxi: { struggle: 1.2, fight: 0.35, label: 'taxi driver' },
  gang: { struggle: 1.6, fight: 0.6, label: 'Viper driver' },
};

export function createCarjackState() {
  return {
    active: false,
    car: null,
    driver: null, // the ped being dragged out, or null
    timer: 0,
    total: 0,
    phase: 'idle', // idle | grab | drag
    alarm: false,
  };
}

// Pick a driver temperament for a car: gang cars and taxis are tougher,
// everything else rolls the dice. Deterministic with an rng passed in.
export function driverTypeFor(car, rng = Math.random) {
  if (car.driver === 'gang') return 'gang';
  if (car.model && car.model.name === 'Taxi') return 'taxi';
  const roll = rng();
  if (roll < 0.2) return 'nervous';
  if (roll > 0.85) return 'tough';
  return 'normal';
}

// Start a carjack on a driven traffic car. Returns a message, or null
// when the car cannot be jacked (parked cars and mission cars use the
// old instant path — nobody is inside to resist).
export function startCarjack(game, car, rng = Math.random) {
  const cj = game.carjack;
  if (!car || car.kind !== 'traffic') return null;
  if (cj.active) return null;
  const type = driverTypeFor(car, rng);
  const def = DRIVER_TYPES[type];
  cj.active = true;
  cj.car = car;
  cj.phase = 'grab';
  cj.total = def.struggle * (0.8 + rng() * 0.4);
  cj.timer = cj.total;
  cj.driver = {
    type, x: car.x, y: car.y, angle: car.angle,
    fight: rng() < def.fight,
    alarm: rng() < CARJACK_ALARM_CHANCE,
  };
  cj.alarm = cj.driver.alarm;
  if (game.events) game.events.push({ type: 'door' });
  return `Carjacking the ${def.label} — hold on!`;
}

// Tick the active carjack. Leo must stay close; walking away (or getting
// shot) cancels it and the driver speeds off. Returns an event string
// when the carjack resolves, otherwise null.
export function updateCarjack(game, dt, time) {
  const cj = game.carjack;
  if (!cj || !cj.active || !cj.car) return null;
  const p = game.player;
  // Cancel if Leo moved away or got in another car.
  if (p.inCar || dist(p.x, p.y, cj.car.x, cj.car.y) > CARJACK_RANGE + 40) {
    cancelCarjack(game, 'You let go — the driver sped off');
    return 'cancelled';
  }
  cj.timer -= dt;
  if (cj.phase === 'grab' && cj.timer <= cj.total * 0.45) {
    cj.phase = 'drag';
  }
  if (cj.timer > 0) return null;
  // Resolved: the driver is out. They may fight, then they flee.
  const driver = cj.driver;
  const car = cj.car;
  cj.active = false;
  cj.phase = 'idle';
  cj.car = null;
  if (driver && driver.fight) {
    // A swing at Leo before running.
    if (game.player) {
      game.player.health = Math.max(1, game.player.health - CARJACK_FIGHT_DAMAGE);
      if (game.events) game.events.push({ type: 'hurt' });
    }
  }
  if (driver) {
    // The driver becomes a fleeing ped in the world.
    game.peds.push({
      x: car.x - Math.sin(car.angle) * 30, y: car.y + Math.cos(car.angle) * 30,
      angle: car.angle + Math.PI, speed: 0, walkSpeed: 120, pace: 1.6,
      state: 'flee', target: null, shirt: '#d8b43a', skin: '#e8b4b8',
      hair: '#2a2a2a', fleeTimer: 6, panicTimer: 0, dead: false, bob: 0,
    });
  }
  // The car is Leo's now.
  car.driver = 'player';
  car.kind = 'player';
  p.inCar = true;
  p.car = car;
  p.x = car.x; p.y = car.y;
  car.speed = 0;
  p.stats.carsStolen++;
  addCrime(game.wanted, 12, time);
  if (game.respect) {
    const { addRespect } = requireRespect();
    addRespect(game, 5, 'Carjacked a ride');
  }
  if (cj.alarm) {
    // The alarm brings the heat: a star and the cops know where Leo is.
    addCrime(game.wanted, 15, time);
    if (game.events) game.events.push({ type: 'siren' });
    if (game.missions) {
      game.missions.message = 'Car alarm! The PD knows where you are';
      game.missions.messageTimer = 4;
    }
  }
  if (game.events) game.events.push({ type: 'toast', text: driver && driver.fight ? 'Car jacked — the driver got a swing in!' : 'Car jacked!' });
  return 'done';
}

// Cancel a carjack in progress (Leo walked away or was interrupted).
export function cancelCarjack(game, reason = '') {
  const cj = game.carjack;
  if (!cj) return;
  cj.active = false;
  cj.phase = 'idle';
  cj.car = null;
  cj.driver = null;
  if (reason && game.missions) {
    game.missions.message = reason;
    game.missions.messageTimer = 3;
  }
}

// Is a carjackable car near Leo? The HUD hint reads this.
export function nearestJackableCar(game) {
  const p = game.player;
  let best = null;
  let bestD = CARJACK_RANGE;
  for (const car of game.cars) {
    if (car.kind !== 'traffic') continue;
    const d = dist(p.x, p.y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

// Progress 0..1 for the struggle bar the renderer draws over Leo.
export function carjackProgress(game) {
  const cj = game.carjack;
  if (!cj || !cj.active || cj.total <= 0) return 0;
  return clamp(1 - cj.timer / cj.total, 0, 1);
}

// Tiny indirection to avoid a static import cycle (respect imports city,
// carjack imports police; respect is only needed for the +5 bump).
import { addRespect as _addRespect } from './respect.js';
function requireRespect() {
  return { addRespect: _addRespect };
}
