// Ember Harbor — shops, safehouses and side jobs. The gun shop sells
// weapons, ammo and armour; a safehouse heals you, stores your cars and
// lets you sleep until morning; vigilante work pays you to hunt the city's
// wanted criminals. Pure logic — prices live in config.js, the HUD shows
// the prompts, and main.js wires the keys.

import { ECONOMY } from './config.js';
import { clamp, dist } from './utils.js';

export const SHOP_STOCK = [
  { id: 'pistol-ammo', kind: 'ammo', weapon: 'pistol', amount: 48, price: 60, label: 'P9 ammo ×48' },
  { id: 'smg', kind: 'weapon', weapon: 'smg', amount: 120, price: 420, label: 'Wasp SMG + 120 ammo' },
  { id: 'shotgun', kind: 'weapon', weapon: 'shotgun', amount: 18, price: 520, label: 'Boomstick + 18 shells' },
  { id: 'rifle', kind: 'weapon', weapon: 'rifle', amount: 40, price: 680, label: 'Longshot Rifle + 40 rounds' },
  { id: 'smg-ammo', kind: 'ammo', weapon: 'smg', amount: 120, price: 110, label: 'SMG ammo ×120' },
  { id: 'shotgun-ammo', kind: 'ammo', weapon: 'shotgun', amount: 12, price: 90, label: 'Shells ×12' },
  { id: 'rifle-ammo', kind: 'ammo', weapon: 'rifle', amount: 30, price: 120, label: 'Rifle rounds ×30' },
  { id: 'armour', kind: 'armour', weapon: null, amount: 50, price: 300, label: 'Kevlar vest (+50 armour)' },
  { id: 'medkit', kind: 'heal', weapon: null, amount: 50, price: 80, label: 'Medkit (+50 HP)' },
];

export function shopItem(id) {
  return SHOP_STOCK.find((s) => s.id === id) || null;
}

export function createShopState() {
  return {
    open: false,
    selected: 0,
    visits: 0,
    spent: 0,
    bought: [],
  };
}

export function openShop(state) {
  state.open = true;
  state.visits += 1;
  return state;
}

export function closeShop(state) {
  state.open = false;
  return state;
}

export function shopCycle(state, dir) {
  state.selected = (state.selected + (dir || 1) + SHOP_STOCK.length) % SHOP_STOCK.length;
  return SHOP_STOCK[state.selected];
}

export function selectedItem(state) {
  return SHOP_STOCK[state.selected];
}

// Buy the selected item. The caller passes the loadout helpers so this
// module stays free of the combat module's internals.
export function buySelected(state, loadout, player, apply) {
  const item = selectedItem(state);
  if (!item) return { ok: false, reason: 'nothing selected' };
  if (player.cash < item.price) return { ok: false, reason: 'not enough cash', item };
  const res = apply(item, loadout, player);
  if (!res || res.ok === false) return { ok: false, reason: (res && res.reason) || 'cannot buy', item };
  player.cash -= item.price;
  state.spent += item.price;
  state.bought.push(item.id);
  return { ok: true, item, cash: player.cash };
}

export function affordableItems(state, cash) {
  return SHOP_STOCK.filter((s) => s.price <= cash);
}

export function cheapestAffordable(cash) {
  const list = affordableItems(null, cash);
  if (list.length === 0) return null;
  return list.reduce((a, b) => (a.price < b.price ? a : b));
}

// --- Safehouses -----------------------------------------------------------

export function createSafehouseState() {
  return {
    owned: ['safehouse'],
    storedCars: [],
    sleeps: 0,
    heals: 0,
    lastSleepAt: -999,
  };
}

export const SAFEHOUSE_HEAL_COST = 50;
export const SAFEHOUSE_SLEEP_HEAL = 100;

export function healAtSafehouse(state, player) {
  if (player.health >= 100) return { ok: false, reason: 'already full health' };
  if (player.cash < SAFEHOUSE_HEAL_COST) return { ok: false, reason: 'not enough cash' };
  player.cash -= SAFEHOUSE_HEAL_COST;
  player.health = 100;
  state.heals += 1;
  return { ok: true, cash: player.cash };
}

// Sleep until morning: full heal, wanted cleared, clock set to dawn.
export function sleepAtSafehouse(state, player, game) {
  player.health = 100;
  if (game.wanted) {
    game.wanted.heat = 0;
    game.wanted.stars = 0;
    game.wanted.cleanTimer = 0;
  }
  if (game.cops) game.cops.length = 0;
  if (game.copCars) game.copCars.length = 0;
  if (game.swat) game.swat.length = 0;
  if (game.heli) game.heli.active = false;
  game.dayTime = 0.24;
  state.sleeps += 1;
  state.lastSleepAt = game.playSeconds || 0;
  return { ok: true, sleeps: state.sleeps };
}

export function storeCarAtSafehouse(state, car) {
  if (state.storedCars.length >= 4) return { ok: false, reason: 'garage full (4 cars)' };
  if (car.model === 'cop') return { ok: false, reason: 'the safehouse will not hide a police car' };
  state.storedCars.push({ model: car.model, health: Math.round(car.health), engine: car.engine, grip: car.grip, armour: car.armour });
  return { ok: true, stored: state.storedCars.length };
}

export function storedCarCount(state) {
  return state.storedCars.length;
}

// --- Vigilante ------------------------------------------------------------
// A vigilante job: a wanted criminal is marked on the map. Find them, take
// them down (on foot or by ramming their car), and the Harbor PD pays out.
// The criminal flees on foot once cornered and fights back up close.

export function createVigilanteState() {
  return {
    active: null,
    done: 0,
    earned: 0,
    cooldown: 0,
  };
}

export function startVigilante(state, rng, player, city) {
  if (state.active) return null;
  if (state.cooldown > 0) return null;
  const spots = [
    { x: -368, z: -138 }, { x: 230, z: 322 }, { x: -138, z: -230 },
    { x: 138, z: 230 }, { x: 322, z: 138 }, { x: -230, z: 322 },
  ];
  const spot = spots[Math.floor(rng() * spots.length)];
  const payout = 180 + Math.floor(rng() * 5) * 40;
  state.active = {
    x: spot.x, z: spot.z, heading: 0,
    health: 120, dead: false,
    payout, fleeing: false,
    shootTimer: 1.5,
    kind: 'criminal',
  };
  return state.active;
}

export function updateVigilante(state, player, dt, rng) {
  const target = state.active;
  if (!target || target.dead) return null;
  const d = dist(target.x, target.z, player.x, player.z);
  target.fleeing = d < 26;
  if (target.fleeing) {
    const away = Math.atan2(target.x - player.x, target.z - player.z);
    target.heading = away;
    target.x += Math.sin(away) * 5.4 * dt;
    target.z += Math.cos(away) * 5.4 * dt;
    target.x = clamp(target.x, -452, 452);
    target.z = clamp(target.z, -452, 452);
  } else {
    target.heading += (rng() - 0.5) * dt;
    target.x += Math.sin(target.heading) * 1.4 * dt;
    target.z += Math.cos(target.heading) * 1.4 * dt;
  }
  target.shootTimer -= dt;
  if (d < 30 && target.shootTimer <= 0) {
    target.shootTimer = 2.2;
    return { type: 'criminal-shot', damage: 8 };
  }
  return null;
}

export function damageVigilanteTarget(state, amount) {
  const target = state.active;
  if (!target || target.dead) return null;
  target.health = Math.max(0, target.health - amount);
  if (target.health <= 0) {
    target.dead = true;
    const payout = target.payout;
    state.done += 1;
    state.earned += payout;
    state.active = null;
    state.cooldown = 30;
    return { type: 'vigilante-done', payout, done: state.done };
  }
  return { type: 'vigilante-hit', health: target.health };
}

export function tickVigilante(state, dt) {
  state.cooldown = Math.max(0, state.cooldown - dt);
  return state.cooldown;
}

// --- Taxi VIP fares -------------------------------------------------------
// A VIP fare pays triple but the passenger complains about every bump: the
// caller must deliver without wrecking the car (health above 60) or the
// tip is lost.

export function vipFarePay(base, carHealth, fast) {
  let pay = base * 3;
  if (carHealth < 60) pay = base;
  if (fast) pay += 25;
  return pay;
}

export function shopSummary(state, safehouse, vigilante) {
  return {
    shopVisits: state.visits,
    shopSpent: state.spent,
    itemsBought: state.bought.length,
    safehouseSleeps: safehouse.sleeps,
    storedCars: safehouse.storedCars.length,
    vigilanteDone: vigilante.done,
    vigilanteEarned: vigilante.earned,
  };
}
