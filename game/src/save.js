// Ember Harbor — save / load. The serialisable snapshot is pure data, so
// tests can round-trip it without localStorage; the storage wrapper is the
// only part that touches the browser.

import { SAVE_KEY } from './config.js';

export function buildSnapshot(game) {
  // JSON turns Infinity into null, so fists ammo is stored as -1 and
  // restored to Infinity on load.
  const weapons = {};
  for (const [id, w] of Object.entries(game.loadout.weapons)) {
    weapons[id] = { ammo: w.ammo === Infinity ? -1 : w.ammo, owned: w.owned };
  }
  return {
    v: 2,
    cash: Math.round(game.player.cash),
    rep: game.player.rep,
    health: game.player.health,
    px: Math.round(game.player.x * 10) / 10,
    pz: Math.round(game.player.z * 10) / 10,
    dayTime: game.dayTime,
    missionsCompleted: game.missions.completed.slice(),
    packagesFound: game.side.packagesFound,
    faresDone: game.side.faresDone,
    chopSales: game.side.chopSales,
    bestScore: game.bestScore,
    playSeconds: Math.round(game.playSeconds),
    weapons,
    currentWeapon: game.loadout.current,
    carUpgrades: game.playerCar ? { engine: game.playerCar.engine, grip: game.playerCar.grip, armour: game.playerCar.armour } : null,
    // r6: the new progress — armour, shop, safehouse, vigilante, events
    // and heli fuel survive a reload like everything else.
    armour: game.loadout.armour || 0,
    shopSpent: game.shops ? game.shops.spent : 0,
    shopVisits: game.shops ? game.shops.visits : 0,
    safehouseSleeps: game.safehouse ? game.safehouse.sleeps : 0,
    storedCars: game.safehouse ? game.safehouse.storedCars : [],
    vigilanteDone: game.vigilante ? game.vigilante.done : 0,
    vigilanteEarned: game.vigilante ? game.vigilante.earned : 0,
    eventsDone: game.events ? game.events.completed : 0,
    eventsEarned: game.events ? game.events.earned : 0,
    heliFuel: game.playerHeli ? Math.round(game.playerHeli.fuel) : 100,
    stamina: Math.round(game.player.stamina ?? 100),
  };
}

export function applySnapshot(game, snap) {
  if (!snap || (snap.v !== 1 && snap.v !== 2)) return false;
  game.player.cash = snap.cash || 0;
  game.player.rep = snap.rep || 0;
  game.player.health = snap.health ?? 100;
  game.player.x = snap.px || 0;
  game.player.z = snap.pz || 0;
  game.dayTime = typeof snap.dayTime === 'number' ? snap.dayTime : 0.3;
  game.missions.completed = Array.isArray(snap.missionsCompleted) ? snap.missionsCompleted.slice() : [];
  game.side.packagesFound = snap.packagesFound || 0;
  game.side.faresDone = snap.faresDone || 0;
  game.side.chopSales = snap.chopSales || 0;
  game.bestScore = snap.bestScore || 0;
  game.playSeconds = snap.playSeconds || 0;
  if (snap.weapons) {
    for (const [id, w] of Object.entries(snap.weapons)) {
      if (w.ammo === -1) w.ammo = Infinity;
    }
    game.loadout.weapons = snap.weapons;
  }
  if (snap.currentWeapon) game.loadout.current = snap.currentWeapon;
  // r6 fields default cleanly when loading a v1 save from r5.
  if (typeof snap.armour === 'number') game.loadout.armour = snap.armour;
  if (game.shops) {
    game.shops.spent = snap.shopSpent || 0;
    game.shops.visits = snap.shopVisits || 0;
  }
  if (game.safehouse) {
    game.safehouse.sleeps = snap.safehouseSleeps || 0;
    game.safehouse.storedCars = Array.isArray(snap.storedCars) ? snap.storedCars.slice() : [];
  }
  if (game.vigilante) {
    game.vigilante.done = snap.vigilanteDone || 0;
    game.vigilante.earned = snap.vigilanteEarned || 0;
  }
  if (game.events) {
    game.events.completed = snap.eventsDone || 0;
    game.events.earned = snap.eventsEarned || 0;
  }
  if (game.playerHeli && typeof snap.heliFuel === 'number') game.playerHeli.fuel = snap.heliFuel;
  if (typeof snap.stamina === 'number') game.player.stamina = snap.stamina;
  return true;
}

export function serializeSnapshot(game) {
  return JSON.stringify(buildSnapshot(game));
}

export function parseSnapshot(text) {
  try {
    const snap = JSON.parse(text);
    if (!snap || typeof snap !== 'object' || (snap.v !== 1 && snap.v !== 2)) return null;
    return snap;
  } catch {
    return null;
  }
}

export function saveGame(game, storage) {
  const store = storage || (typeof window !== 'undefined' ? window.localStorage : null);
  if (!store) return false;
  try {
    store.setItem(SAVE_KEY, serializeSnapshot(game));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(game, storage) {
  const store = storage || (typeof window !== 'undefined' ? window.localStorage : null);
  if (!store) return null;
  let text = null;
  try {
    text = store.getItem(SAVE_KEY);
  } catch {
    return null;
  }
  if (!text) return null;
  const snap = parseSnapshot(text);
  if (!snap) return null;
  return applySnapshot(game, snap);
}

export function hasSave(storage) {
  const store = storage || (typeof window !== 'undefined' ? window.localStorage : null);
  if (!store) return false;
  try {
    return store.getItem(SAVE_KEY) != null;
  } catch {
    return false;
  }
}

export function clearSave(storage) {
  const store = storage || (typeof window !== 'undefined' ? window.localStorage : null);
  if (!store) return false;
  try {
    store.removeItem(SAVE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function scoreOf(game) {
  return game.missions.completed.length * 1000
    + game.side.packagesFound * 120
    + game.side.faresDone * 45
    + Math.floor(game.player.cash / 10)
    + Math.floor(game.player.rep)
    // r6: the new work counts too — vigilante, events and the extra jobs.
    + (game.vigilante ? game.vigilante.done * 150 : 0)
    + (game.events ? game.events.completed * 100 : 0)
    + (game.shops ? Math.floor(game.shops.spent / 50) : 0);
}

export function progressSummary(game) {
  return {
    missions: game.missions.completed.length,
    missionsTotal: 14,
    packages: game.side.packagesFound,
    packagesTotal: game.side.packagesTotal || 16,
    fares: game.side.faresDone,
    vigilante: game.vigilante ? game.vigilante.done : 0,
    events: game.events ? game.events.completed : 0,
    score: scoreOf(game),
  };
}
