// chopshop.js — Solmarina's chop shop and the PD impound lot.
// Two sides of the same stolen-car economy, both on the east edge:
//   * The CHOP SHOP (Docklands) buys hot cars, no questions asked. Drive a
//     stolen car in and press F: the car disappears into the crusher and Leo
//     walks away with cash. The payout follows the model and the condition —
//     a pristine Marina GT is worth far more than a battered Solano — and
//     every sale is a crime, so it adds heat and notoriety. A 45-second
//     cooldown between sales stops the lot becoming a parked-car ATM, and
//     the shop will not touch a police car or a car a mission still needs.
//   * The IMPOUND LOT (Portside) is where the PD tows the car Leo was
//     driving when he got busted or wasted (see player.respawn). Walk up
//     on foot and press F to buy it back for $200 — model, colour and
//     upgrades included. A second bust while a car is already impounded
//     replaces it: the lot only holds one car at a time.
import { dist, clamp } from './utils.js';
import { LANDMARKS } from './city.js';
import { carHealth, makeCar } from './vehicles.js';
import { addCrime } from './police.js';

export const CHOP_COOLDOWN = 45;   // seconds between chop-shop sales
export const IMPOUND_FEE = 200;    // dollars to buy a towed car back
export const CHOP_RANGE = 110;     // how close Leo must be to sell / reclaim
export const IMPOUND_RANGE = 110;

// What the crusher pays for a clean example of each model. Police cars are
// worth nothing — too hot even for the Docklands, and the shop says so.
export const CHOP_VALUES = {
  'Marina GT': 420,
  'Camioneta': 320,
  'Taxi Sol': 300,
  'Carguero': 260,
  'Moto Sol': 220,
  'Solano': 180,
  'Patrulla': 0,
};

export function createChopState() {
  return {
    cooldown: 0,   // seconds until the next sale is allowed
    sold: 0,       // cars fenced in this session
    earned: 0,     // dollars earned from the crusher
  };
}

// Payout for a car: model value scaled by condition (25% floor for a
// wreck, full price for a showroom car), rounded to the nearest $5.
export function chopShopValue(car) {
  const base = CHOP_VALUES[car.model.name] ?? 150;
  if (base <= 0) return 0;
  const condition = clamp(carHealth(car) / 100, 0.25, 1);
  return Math.round((base * condition) / 5) * 5;
}

// Can Leo sell the car he is driving right now? Returns null when he can,
// or the reason he cannot (shown as a toast).
export function chopBlockReason(game) {
  const p = game.player;
  if (!p.inCar || !p.car) return 'Get in a car first — the crusher buys cars, not pedestrians.';
  const car = p.car;
  if (dist(p.x, p.y, LANDMARKS.chopshop.x, LANDMARKS.chopshop.y) > CHOP_RANGE) {
    return 'Drive the car to the Chop Shop in the Docklands to sell it.';
  }
  if (game.chopshop && game.chopshop.cooldown > 0) {
    return `The crusher is busy — come back in ${Math.ceil(game.chopshop.cooldown)}s.`;
  }
  if (car.model.name === 'Patrulla') return 'The chop shop will not touch a police car — too hot.';
  if (game.missions && game.missions.targetCar === car) {
    return 'Rico needs that car — a mission is waiting for it.';
  }
  if (chopShopValue(car) <= 0) return 'Nobody will buy that car.';
  return null;
}

// Sell the car Leo is driving to the crusher. Returns a message for the HUD
// toast, or null when the sale could not happen (chopBlockReason explains).
export function sellCarToChop(game) {
  const blocked = chopBlockReason(game);
  if (blocked) return blocked;
  const p = game.player;
  const car = p.car;
  const value = chopShopValue(car);
  // The car goes to the crusher: out of the world, Leo on foot beside it.
  game.cars = game.cars.filter((c) => c !== car);
  p.inCar = false;
  p.car = null;
  p.money += value;
  p.stats.chopSales = (p.stats.chopSales || 0) + 1;
  p.stats.chopEarned = (p.stats.chopEarned || 0) + value;
  p.stats.rep = (p.stats.rep || 0) + 10;
  if (game.chopshop) {
    game.chopshop.cooldown = CHOP_COOLDOWN;
    game.chopshop.sold++;
    game.chopshop.earned += value;
  }
  // Fencing is a crime: a little heat now, a little notoriety that sticks.
  addCrime(game.wanted, 10, game.time);
  game.events.push({ type: 'cash' });
  game.save();
  return `Chop shop: ${car.model.name} crushed — +$${value}!`;
}

// The PD tows the car Leo was driving when he got busted or wasted.
// Called from player.respawn; the lot only holds one car, so a second tow
// replaces the first (the old one is gone for good).
export function impoundCar(game, car) {
  if (!car) return false;
  game.impound = {
    model: car.model,
    color: car.color,
    upgrades: { ...(car.upgrades || { engine: 0, armor: 0, nitro: false, tires: 0 }) },
    damage: car.damage || 0,
  };
  return true;
}

// Buy the impounded car back: $200, and it spawns beside the lot with its
// upgrades intact. Returns a message for the HUD toast.
export function reclaimImpound(game) {
  const p = game.player;
  if (!game.impound) return 'The impound lot is empty — nothing to reclaim.';
  if (dist(p.x, p.y, LANDMARKS.impound.x, LANDMARKS.impound.y) > IMPOUND_RANGE) {
    return 'Go to the Impound Lot in Portside to reclaim your car.';
  }
  if (p.money < IMPOUND_FEE) return `Reclaim costs $${IMPOUND_FEE} — you are short.`;
  const held = game.impound;
  p.money -= IMPOUND_FEE;
  game.impound = null;
  // The car comes back parked by the lot, damage and upgrades as towed.
  const car = makeCar(LANDMARKS.impound.x + 60, LANDMARKS.impound.y + 30, 0, {
    kind: 'parked', driver: null, color: held.color, model: held.model,
  });
  car.upgrades = { ...held.upgrades };
  car.damage = held.damage;
  car.health = carHealth(car);
  game.cars.push(car);
  game.events.push({ type: 'pickup' });
  game.save();
  return `Impound: ${held.model.name} reclaimed for $${IMPOUND_FEE} — it is parked by the lot.`;
}

// Cooldown ticks down while Leo plays; nothing else needs a per-frame pass.
export function updateChopShop(game, dt) {
  if (!game.chopshop) return;
  game.chopshop.cooldown = Math.max(0, game.chopshop.cooldown - dt);
}
