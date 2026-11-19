// garage.js — the Pay-n-Spray upgrade shop.
// Park near the garage and press G to open it. Upgrades are bought with
// mission and fare money and apply to the car Leo is driving right now:
// engine (top speed), armour (car health), grip tires (steering) and a
// nitro kit (N to boost). Levels stack; prices rise per level. A car with
// no upgrades object yet gets a fresh one the first time the shop touches it.
// Respect tier 3+ (Made Man) knocks 15% off every price — the shop knows
// who Leo is by now.
import { garageDiscount } from './respect.js';
export const UPGRADES = [
  {
    id: 'engine',
    name: 'Engine Tune',
    desc: '+15% top speed per level',
    levels: [300, 600, 1200],
    max: 3,
  },
  {
    id: 'armor',
    name: 'Armour Plating',
    desc: '+50 car health per level',
    levels: [250, 500, 1000],
    max: 3,
  },
  {
    id: 'nitro',
    name: 'Nitro Kit',
    desc: 'Press N while driving for a boost',
    levels: [400],
    max: 1,
  },
  {
    id: 'tires',
    name: 'Grip Tires',
    desc: '+12% steering grip per level',
    levels: [250, 500],
    max: 2,
  },
  {
    id: 'bulletproof',
    name: 'Bulletproof Tires',
    desc: 'Tires never blow out in chases',
    levels: [350],
    max: 1,
  },
];

export function createShop() {
  return { open: false, selected: 0 };
}

export function carUpgrades(car) {
  if (!car.upgrades) {
    car.upgrades = { engine: 0, armor: 0, nitro: false, tires: 0 };
  }
  return car.upgrades;
}

export function upgradeLevel(car, id) {
  const u = carUpgrades(car);
  return id === 'nitro' ? (u.nitro ? 1 : 0) : (u[id] || 0);
}

export function upgradeCost(def, level) {
  if (level >= def.max) return null; // already maxed out
  return def.levels[level];
}

// Top speed of a car including its engine tunes.
export function topSpeedOf(car) {
  return car.model.top * (1 + 0.15 * upgradeLevel(car, 'engine'));
}

// Max health of a car including its armour plating.
export function maxHealthOf(car) {
  return 100 + 50 * upgradeLevel(car, 'armor');
}

// Steering grip multiplier from the grip-tire upgrade: +12% per level, so
// a fully tired car turns noticeably sharper at speed (vehicles.driveCar).
export function gripOf(car) {
  return 1 + 0.12 * upgradeLevel(car, 'tires');
}

export function hasNitro(car) {
  return upgradeLevel(car, 'nitro') > 0;
}

// Nitro state lives on the car: boostUntil (active boost) and
// boostCooldownUntil (earliest next boost), both in game seconds.
export function nitroReady(car, time) {
  return hasNitro(car) && time >= (car.boostCooldownUntil || 0) && time >= (car.boostUntil || 0);
}

export function nitroActive(car, time) {
  return hasNitro(car) && time < (car.boostUntil || 0);
}

export function activateNitro(car, time) {
  if (!nitroReady(car, time)) return false;
  car.boostUntil = time + 2.5;
  car.boostCooldownUntil = time + 8;
  return true;
}

// Buy the selected upgrade for the car Leo is driving. Returns a message
// for the HUD toast, or null when nothing could be bought.
export function buyUpgrade(game, def) {
  const p = game.player;
  if (!p.inCar || !p.car) return 'Get in a car first — upgrades fit the car you drive.';
  const car = p.car;
  const level = upgradeLevel(car, def.id);
  const baseCost = upgradeCost(def, level);
  if (baseCost === null) return `${def.name} is already maxed out.`;
  // Made Man discount: 15% off at respect tier 3+.
  const cost = Math.round(baseCost * garageDiscount(game));
  if (p.money < cost) return `Not enough cash — ${def.name} costs $${cost}.`;
  p.money -= cost;
  const u = carUpgrades(car);
  if (def.id === 'nitro') u.nitro = true;
  else u[def.id] = level + 1;
  // Armour also repairs the car up to its new max health.
  if (def.id === 'armor') {
    car.health = Math.min(maxHealthOf(car), car.health + 50);
    car.damage = Math.max(0, maxHealthOf(car) - car.health);
  }
  if (game.audio && game.audio.shopBuy) game.audio.shopBuy();
  game.save();
  return `${def.name} Lv${level + 1} fitted — $${cost}.`;
}
