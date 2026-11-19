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
    // r7: story chapter, legend rep, skills, side jobs, crowds, boats
    // and interiors survive a reload like everything else.
    storyChapter: game.story ? game.story.chapterIndex : 0,
    storyChapters: game.story ? game.story.completedChapters.slice() : [],
    legendRep: game.player.rep || 0,
    skills: game.player.skills ? { ...game.player.skills } : { driving: 0, shooting: 0, swimming: 0, flying: 0 },
    r7Missions: game.r7missions ? game.r7missions.completed.slice() : [],
    sideJobsDone: game.sidejobs ? game.sidejobs.totalDone : 0,
    sideJobsEarned: game.sidejobs ? game.sidejobs.totalEarned : 0,
    crowdPanics: game.crowd ? game.crowd.panics : 0,
    interiorsVisited: game.interiors ? game.interiors.visited.slice() : [],
    boatsStolen: game.boatsStolen || 0,
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
  // r7 fields default cleanly when loading an older save.
  if (game.story) {
    game.story.chapterIndex = snap.storyChapter || 0;
    game.story.completedChapters = Array.isArray(snap.storyChapters) ? snap.storyChapters.slice() : [];
  }
  if (snap.skills && game.player.skills) game.player.skills = { ...game.player.skills, ...snap.skills };
  if (game.r7missions && Array.isArray(snap.r7Missions)) game.r7missions.completed = snap.r7Missions.slice();
  if (game.sidejobs) {
    game.sidejobs.totalDone = snap.sideJobsDone || 0;
    game.sidejobs.totalEarned = snap.sideJobsEarned || 0;
  }
  if (game.crowd && typeof snap.crowdPanics === 'number') game.crowd.panics = snap.crowdPanics;
  if (game.interiors && Array.isArray(snap.interiorsVisited)) game.interiors.visited = snap.interiorsVisited.slice();
  if (typeof snap.boatsStolen === 'number') game.boatsStolen = snap.boatsStolen;
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
    + (game.shops ? Math.floor(game.shops.spent / 50) : 0)
    // r7: story chapters, r7 missions, side jobs and legend all count.
    + (game.story ? game.story.completedChapters.length * 400 : 0)
    + (game.r7missions ? game.r7missions.completed.length * 1000 : 0)
    + (game.sidejobs ? game.sidejobs.totalDone * 120 : 0)
    + (game.interiors ? game.interiors.visited.length * 80 : 0);
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
    // r7: the wider game — 22 missions total, story chapters, side jobs.
    missionsTotalAll: 22,
    r7Missions: game.r7missions ? game.r7missions.completed.length : 0,
    storyChapters: game.story ? game.story.completedChapters.length : 0,
    sideJobs: game.sidejobs ? game.sidejobs.totalDone : 0,
    interiors: game.interiors ? game.interiors.visited.length : 0,
  };
}
