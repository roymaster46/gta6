// SOLARA BAY — pure game logic (no DOM, no Three.js). Testable in Node.
// A coastal open-world crime game: Hurricane Vera makes landfall in 7 days.
// You are Rin Kade, a storm-courier turned wheelman for the Stormbreakers crew.
// Original setting, characters, vehicles, story. No Rockstar / GTA material.

export const GAME_TITLE = 'SOLARA BAY';
export const HURRICANE_NAME = 'Vera';
export const TOTAL_DAYS = 7;
export const CITY_SIZE = 920; // metres, square city
export const START_MONEY = 120;
export const SAVE_KEY = 'solara-bay-save-v1';

export const DISTRICTS = [
  { id: 'marina', name: 'The Marina', x: -380, z: -380, w: 220, h: 180, flavor: 'Yachts, neon, and people who lie about money.' },
  { id: 'oldtown', name: 'Old Town', x: -120, z: -380, w: 220, h: 180, flavor: 'Brick lanes, fish stalls, and the oldest grudges in Solara.' },
  { id: 'bayfront', name: 'Bayfront', x: 140, z: -380, w: 220, h: 180, flavor: 'Glass towers owned by the Tide Kings.' },
  { id: 'boardwalk', name: 'Boardwalk', x: -380, z: -140, w: 220, h: 180, flavor: 'Arcades, salt air, and radios turned all the way up.' },
  { id: 'downtown', name: 'Downtown', x: -120, z: -140, w: 220, h: 180, flavor: 'Traffic, towers, and the Port Authority watching everything.' },
  { id: 'harbor', name: 'The Harbor', x: 140, z: -140, w: 220, h: 180, flavor: 'Cranes, containers, and deals made after midnight.' },
  { id: 'crosstown', name: 'Crosstown', x: -380, z: 120, w: 220, h: 180, flavor: 'Chop shops, garages, and Otis the mechanic.' },
  { id: 'palms', name: 'Palm Court', x: -120, z: 120, w: 220, h: 180, flavor: 'Safehouses, palms, and quiet streets that are not quiet.' },
  { id: 'stormpoint', name: 'Storm Point', x: 140, z: 120, w: 220, h: 180, flavor: 'The lighthouse, the cliffs, and the eye of the storm.' },
  { id: 'southbeach', name: 'South Beach', x: -120, z: 340, w: 460, h: 120, flavor: 'Sand, surf, and the last road out of town.' },
];

export const RANKS = [
  { min: 0, name: 'Nobody', title: 'Nobody' },
  { min: 100, name: 'Runner', title: 'Runner' },
  { min: 300, name: 'Wheelman', title: 'Wheelman' },
  { min: 600, name: 'Hustler', title: 'Hustler' },
  { min: 1000, name: 'Stormbreaker', title: 'Stormbreaker' },
  { min: 1600, name: 'Bay Legend', title: 'Bay Legend' },
  { min: 2500, name: 'King of the Bay', title: 'King of the Bay' },
];

export const WEAPONS = {
  fists:   { name: 'Fists', slot: 0, damage: 12, range: 2.2, rate: 2.2, ammo: Infinity, price: 0, auto: false },
  pistol:  { name: 'Surge P9', slot: 1, damage: 22, range: 55, rate: 3.5, ammo: 60, price: 350, auto: false },
  smg:     { name: 'Riptide SMG', slot: 2, damage: 14, range: 40, rate: 11, ammo: 180, price: 900, auto: true },
  shotgun: { name: 'Breaker 12', slot: 3, damage: 70, range: 18, rate: 1.1, ammo: 24, price: 1200, auto: false },
  rifle:   { name: 'Longhaul Rifle', slot: 4, damage: 55, range: 120, rate: 1.6, ammo: 40, price: 2200, auto: false },
};

export const CARS = {
  beater:  { name: 'Dune Beater', top: 26, accel: 9, grip: 0.8, price: 0, color: 0x8a7a5a },
  sedan:   { name: 'Coral Sedan', top: 34, accel: 12, grip: 1.0, price: 800, color: 0x3f6fb5 },
  coupe:   { name: 'Vela Coupe', top: 42, accel: 16, grip: 1.15, price: 2400, color: 0xc23b4e },
  muscle:  { name: 'Tide Muscle', top: 46, accel: 18, grip: 1.0, price: 4200, color: 0x2e8b6a },
  supercar:{ name: 'Tempest GT', top: 58, accel: 24, grip: 1.35, price: 12000, color: 0xe8a020 },
  van:     { name: 'Gull Van', top: 28, accel: 8, grip: 0.9, price: 1500, color: 0xd8d3c3 },
};

export const GARAGE_UPGRADES = [
  { id: 'engine1', name: 'Tuned Engine I', price: 600, topMul: 1.12, accelMul: 1.15 },
  { id: 'engine2', name: 'Tuned Engine II', price: 1600, topMul: 1.25, accelMul: 1.35, needs: 'engine1' },
  { id: 'nitro', name: 'Nitro Kit', price: 900, nitro: true },
  { id: 'armor', name: 'Plated Body', price: 1100, hpMul: 2 },
  { id: 'tires', name: 'Grip Tires', price: 500, gripMul: 1.25 },
];

export const RADIO_STATIONS = [
  { id: 'wave', name: 'WAVE 98.4 — Surf Pop', tempo: 112, mood: 'bright' },
  { id: 'storm', name: 'STORM FM — Night Drive', tempo: 92, mood: 'dark' },
  { id: 'harbor', name: 'HARBOR TALK — News & Storm Watch', tempo: 0, mood: 'talk' },
  { id: 'neon', name: 'NEON 101 — Synthwave', tempo: 128, mood: 'neon' },
];

export const CREW = [
  { id: 'jax', name: 'Jax Moreno', role: 'Getaway driver', perk: 'Nitro lasts 40% longer' },
  { id: 'luma', name: 'Luma Park', role: 'Hacker & lookout', perk: 'Wanted decays 30% faster' },
  { id: 'otis', name: 'Otis Bell', role: 'Mechanic', perk: 'Repairs cost half' },
  { id: 'mara', name: 'Mara Voss', role: 'Fixer', perk: 'Shop prices 15% off' },
];

// 10 story missions, staged across the 7-day hurricane countdown.
export const MISSIONS = [
  {
    id: 'm1', day: 1, title: 'First Light', giver: 'Mara Voss', respect: 60, reward: 400,
    brief: 'The storm is coming and the Tide Kings are hoarding fuel. Steal the fuel truck from the Harbor depot and bring it to Otis.',
    stages: [
      { id: 'go', text: 'Reach the Harbor fuel depot', kind: 'goto', target: 'harbor' },
      { id: 'take', text: 'Take the fuel truck (press E)', kind: 'steal', target: 'harbor' },
      { id: 'deliver', text: 'Deliver the truck to Otis in Crosstown', kind: 'goto', target: 'crosstown' },
    ],
  },
  {
    id: 'm2', day: 1, title: 'Salt in the Wound', giver: 'Jax Moreno', respect: 80, reward: 600,
    brief: 'Jax needs a fast car for the crew. Jack a Vela Coupe on Bayfront and lose the cops before you park it at the safehouse.',
    stages: [
      { id: 'jack', text: 'Carjack a coupe on Bayfront', kind: 'steal', target: 'bayfront' },
      { id: 'lose', text: 'Lose the cops (wanted to zero)', kind: 'evade', target: 'palms' },
      { id: 'park', text: 'Park at the Palm Court safehouse', kind: 'goto', target: 'palms' },
    ],
  },
  {
    id: 'm3', day: 2, title: 'Static', giver: 'Luma Park', respect: 100, reward: 800,
    brief: 'Luma needs the Port Authority relay on the Downtown roof silenced. Fight through the guards and plant the jammer.',
    stages: [
      { id: 'go', text: 'Reach the Downtown relay', kind: 'goto', target: 'downtown' },
      { id: 'fight', text: 'Take down 3 guards', kind: 'combat', count: 3, target: 'downtown' },
      { id: 'plant', text: 'Plant the jammer (hold E)', kind: 'hold', target: 'downtown' },
    ],
  },
  {
    id: 'm4', day: 2, title: 'Boardwalk Brawl', giver: 'Otis Bell', respect: 120, reward: 900,
    brief: 'Tide King enforcers are shaking down the Boardwalk arcades. Clear them out and the shopkeepers will pay you in respect.',
    stages: [
      { id: 'go', text: 'Reach the Boardwalk', kind: 'goto', target: 'boardwalk' },
      { id: 'fight', text: 'Take down 4 enforcers', kind: 'combat', count: 4, target: 'boardwalk' },
      { id: 'collect', text: 'Collect the protection money', kind: 'hold', target: 'boardwalk' },
    ],
  },
  {
    id: 'm5', day: 3, title: 'The Long Way Home', giver: 'Mara Voss', respect: 150, reward: 1200,
    brief: 'A courier run with a catch: the package is hot and the whole Bayfront precinct is looking for it. Deliver to Storm Point, fast.',
    stages: [
      { id: 'pickup', text: 'Pick up the package in Bayfront', kind: 'goto', target: 'bayfront' },
      { id: 'deliver', text: 'Deliver to the Storm Point lighthouse', kind: 'goto', target: 'stormpoint' },
      { id: 'escape', text: 'Escape the police dragnet', kind: 'evade', target: 'southbeach' },
    ],
  },
  {
    id: 'm6', day: 3, title: 'Neon Sprint', giver: 'Jax Moreno', respect: 180, reward: 1500,
    brief: 'Midnight street race across the city: Boardwalk to Storm Point, three checkpoints, no rules. Win it and the crew eats for a week.',
    stages: [
      { id: 'start', text: 'Reach the start line on the Boardwalk', kind: 'goto', target: 'boardwalk' },
      { id: 'race', text: 'Race through 3 checkpoints', kind: 'race', count: 3, target: 'stormpoint' },
      { id: 'win', text: 'Cross the finish at Storm Point', kind: 'goto', target: 'stormpoint' },
    ],
  },
  {
    id: 'm7', day: 4, title: 'Blackout', giver: 'Luma Park', respect: 220, reward: 2000,
    brief: 'Luma will kill the grid for the heist. Escort her to the Downtown substation while Tide King hitmen hunt you both.',
    stages: [
      { id: 'go', text: 'Escort Luma to the substation', kind: 'goto', target: 'downtown' },
      { id: 'defend', text: 'Defend Luma — take down 5 hitmen', kind: 'combat', count: 5, target: 'downtown' },
      { id: 'cut', text: 'Cut the power (hold E)', kind: 'hold', target: 'downtown' },
    ],
  },
  {
    id: 'm8', day: 5, title: 'Harbor Heist', giver: 'Mara Voss', respect: 300, reward: 4000,
    brief: 'The vault under the Harbor Trust: $400,000 in storm-relief cash the Tide Kings skimmed. Crack it, grab it, run.',
    stages: [
      { id: 'in', text: 'Reach the Harbor Trust vault', kind: 'goto', target: 'harbor' },
      { id: 'crack', text: 'Crack the vault (hold E)', kind: 'hold', target: 'harbor' },
      { id: 'grab', text: 'Grab the cash', kind: 'hold', target: 'harbor' },
      { id: 'out', text: 'Escape to the Marina boats', kind: 'goto', target: 'marina' },
    ],
  },
  {
    id: 'm9', day: 6, title: 'Eye of the Storm', giver: 'Otis Bell', respect: 350, reward: 3000,
    brief: 'Vera is hours out and the Tide Kings are fleeing by sea. Chase their convoy down South Beach and stop the last boat.',
    stages: [
      { id: 'chase', text: 'Chase the convoy down South Beach', kind: 'goto', target: 'southbeach' },
      { id: 'fight', text: 'Take down 4 convoy guards', kind: 'combat', count: 4, target: 'southbeach' },
      { id: 'stop', text: 'Stop the boat (hold E)', kind: 'hold', target: 'southbeach' },
    ],
  },
  {
    id: 'm10', day: 7, title: 'Landfall', giver: 'Mara Voss', respect: 500, reward: 8000,
    brief: 'The hurricane hits at dawn. One last run: deliver the relief cash to the shelters, outrun the storm surge, and become a legend.',
    stages: [
      { id: 'load', text: 'Load the relief cash at the Harbor', kind: 'goto', target: 'harbor' },
      { id: 'drop1', text: 'Deliver to the Old Town shelter', kind: 'goto', target: 'oldtown' },
      { id: 'drop2', text: 'Deliver to the Downtown shelter', kind: 'goto', target: 'downtown' },
      { id: 'survive', text: 'Outrun the surge to Storm Point', kind: 'goto', target: 'stormpoint' },
    ],
  },
];

export const SIDE_JOBS = [
  { id: 'taxi', name: 'Taxi Fare', pay: 120, text: 'Drive a fare across town' },
  { id: 'delivery', name: 'Courier Run', pay: 150, text: 'Deliver a package before the timer ends' },
  { id: 'vigilante', name: 'Vigilante', pay: 200, text: 'Take down a wanted Tide King enforcer' },
  { id: 'race', name: 'Street Race', pay: 500, text: 'Beat the clock through 3 checkpoints' },
];

export function newGameState() {
  return {
    money: START_MONEY,
    respect: 0,
    health: 100,
    armor: 0,
    wanted: 0,
    wantedHeat: 0,
    day: 1,
    timeOfDay: 8.0, // hours, 0-24
    weather: 'clear',
    storm: 0.05, // 0..1, grows toward landfall
    weapons: { fists: { owned: true, ammo: Infinity } },
    weapon: 'fists',
    cars: { beater: { owned: true, hp: 100, upgrades: [] } },
    car: 'beater',
    garage: ['beater'],
    missionsDone: [],
    missionActive: null, // { id, stage: 0, progress: 0 }
    crew: ['jax'],
    radio: 0,
    racesWon: 0,
    jobsDone: 0,
    kills: 0,
    carsStolen: 0,
    playSeconds: 0,
    savedAt: null,
  };
}

export function rankFor(respect) {
  let r = RANKS[0];
  for (const cand of RANKS) if (respect >= cand.min) r = cand;
  return r;
}

export function nextRankFor(respect) {
  for (const cand of RANKS) if (respect < cand.min) return cand;
  return null;
}

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && z >= d.z && z < d.z + d.h) return d;
  }
  return null;
}

export function availableMissions(state) {
  return MISSIONS.filter(
    (m) => m.day <= state.day && !state.missionsDone.includes(m.id) && state.missionActive?.id !== m.id,
  );
}

export function nextMission(state) {
  return availableMissions(state)[0] ?? null;
}

export function startMission(state, missionId) {
  const m = MISSIONS.find((x) => x.id === missionId);
  if (!m) return { ok: false, error: 'no such mission' };
  if (state.missionsDone.includes(missionId)) return { ok: false, error: 'already done' };
  if (state.missionActive) return { ok: false, error: 'mission already active' };
  if (m.day > state.day) return { ok: false, error: 'not yet — day ' + m.day };
  state.missionActive = { id: m.id, stage: 0, progress: 0 };
  return { ok: true, mission: m };
}

export function activeMissionDef(state) {
  if (!state.missionActive) return null;
  return MISSIONS.find((m) => m.id === state.missionActive.id) ?? null;
}

export function activeStage(state) {
  const m = activeMissionDef(state);
  if (!m || !state.missionActive) return null;
  return m.stages[state.missionActive.stage] ?? null;
}

// Advance the active mission stage when its condition is met.
// `event` = { kind, count?, district? } describing what the player just did.
export function progressMission(state, event) {
  const m = activeMissionDef(state);
  if (!m || !state.missionActive) return { advanced: false, done: false };
  const stage = m.stages[state.missionActive.stage];
  if (!stage) return { advanced: false, done: false };
  let match = false;
  if (stage.kind === 'goto' && event.kind === 'arrive' && event.district === stage.target) match = true;
  if (stage.kind === 'steal' && event.kind === 'steal' && (!stage.target || event.district === stage.target)) match = true;
  if (stage.kind === 'hold' && event.kind === 'hold' && event.district === stage.target) match = true;
  if (stage.kind === 'evade' && event.kind === 'evade') match = true;
  if (stage.kind === 'race' && event.kind === 'checkpoint') {
    state.missionActive.progress += 1;
    if (state.missionActive.progress >= (stage.count ?? 3)) match = true;
  }
  if (stage.kind === 'combat' && event.kind === 'kill') {
    state.missionActive.progress += 1;
    if (state.missionActive.progress >= (stage.count ?? 1)) match = true;
  }
  if (!match) return { advanced: false, done: false, progress: state.missionActive.progress };
  state.missionActive.stage += 1;
  state.missionActive.progress = 0;
  if (state.missionActive.stage >= m.stages.length) {
    state.missionsDone.push(m.id);
    state.money += m.reward;
    state.respect += m.respect;
    state.missionActive = null;
    return { advanced: true, done: true, mission: m };
  }
  return { advanced: true, done: false, stage: m.stages[state.missionActive.stage] };
}

export function abortMission(state) {
  state.missionActive = null;
}

// ---- Wanted / police ----
export function addWanted(state, stars) {
  state.wanted = Math.max(0, Math.min(5, state.wanted + stars));
  state.wantedHeat = 100;
  return state.wanted;
}

export function decayWanted(state, dtSeconds, hidden) {
  if (state.wanted === 0) return 0;
  const crewMul = state.crew.includes('luma') ? 0.7 : 1;
  state.wantedHeat -= dtSeconds * (hidden ? 6 : 1.2) * crewMul;
  if (state.wantedHeat <= 0) {
    state.wanted = Math.max(0, state.wanted - 1);
    state.wantedHeat = state.wanted > 0 ? 60 : 0;
  }
  return state.wanted;
}

export function policeForWanted(wanted) {
  return {
    cars: wanted === 0 ? 0 : wanted + 1,
    heli: wanted >= 3,
    roadblock: wanted >= 4,
    aggression: Math.min(1, 0.25 + wanted * 0.15),
  };
}

export function payBribe(state) {
  const cost = 150 * state.wanted;
  if (state.wanted === 0) return { ok: false, error: 'not wanted' };
  if (state.money < cost) return { ok: false, error: 'not enough cash' };
  state.money -= cost;
  state.wanted = 0;
  state.wantedHeat = 0;
  return { ok: true, cost };
}

// ---- Combat ----
export function fireWeapon(state) {
  const w = WEAPONS[state.weapon];
  if (!w) return { ok: false, error: 'no weapon' };
  const inv = state.weapons[state.weapon];
  if (!inv?.owned) return { ok: false, error: 'not owned' };
  if (inv.ammo !== Infinity && inv.ammo <= 0) return { ok: false, error: 'out of ammo' };
  if (inv.ammo !== Infinity) inv.ammo -= 1;
  return { ok: true, damage: w.damage, range: w.range };
}

export function takeDamage(state, amount) {
  let left = amount;
  if (state.armor > 0) {
    const absorbed = Math.min(state.armor, left);
    state.armor -= absorbed;
    left -= absorbed;
  }
  state.health = Math.max(0, state.health - left);
  return state.health;
}

export function heal(state, amount) {
  state.health = Math.min(100, state.health + amount);
  return state.health;
}

export function buyWeapon(state, id) {
  const w = WEAPONS[id];
  if (!w) return { ok: false, error: 'no such weapon' };
  if (id === 'fists') return { ok: false, error: 'already owned' };
  const price = state.crew.includes('mara') ? Math.round(w.price * 0.85) : w.price;
  if (state.weapons[id]?.owned) {
    // top up ammo instead
    const ammoPrice = Math.round(price * 0.25);
    if (state.money < ammoPrice) return { ok: false, error: 'not enough cash' };
    state.money -= ammoPrice;
    state.weapons[id].ammo += w.ammo;
    return { ok: true, ammo: true, cost: ammoPrice };
  }
  if (state.money < price) return { ok: false, error: 'not enough cash' };
  state.money -= price;
  state.weapons[id] = { owned: true, ammo: w.ammo };
  return { ok: true, cost: price };
}

export function buyAmmo(state, id, qty) {
  const w = WEAPONS[id];
  if (!w || !state.weapons[id]?.owned) return { ok: false, error: 'not owned' };
  const cost = Math.round((w.price * 0.1) * (qty / w.ammo));
  if (state.money < cost) return { ok: false, error: 'not enough cash' };
  state.money -= cost;
  state.weapons[id].ammo += qty;
  return { ok: true, cost };
}

export function buyArmor(state) {
  const cost = 200;
  if (state.money < cost) return { ok: false, error: 'not enough cash' };
  if (state.armor >= 100) return { ok: false, error: 'armor full' };
  state.money -= cost;
  state.armor = Math.min(100, state.armor + 50);
  return { ok: true, cost };
}

// ---- Cars / garage ----
export function carStats(state, carId) {
  const base = CARS[carId];
  if (!base) return null;
  const owned = state.cars[carId];
  let top = base.top, accel = base.accel, grip = base.grip, hp = 100;
  if (owned) {
    for (const u of owned.upgrades ?? []) {
      const def = GARAGE_UPGRADES.find((g) => g.id === u);
      if (!def) continue;
      if (def.topMul) top *= def.topMul;
      if (def.accelMul) accel *= def.accelMul;
      if (def.gripMul) grip *= def.gripMul;
      if (def.hpMul) hp *= def.hpMul;
    }
  }
  return { ...base, top, accel, grip, maxHp: hp };
}

export function buyCar(state, id) {
  const c = CARS[id];
  if (!c) return { ok: false, error: 'no such car' };
  if (state.cars[id]?.owned) return { ok: false, error: 'already owned' };
  const price = state.crew.includes('mara') ? Math.round(c.price * 0.85) : c.price;
  if (state.money < price) return { ok: false, error: 'not enough cash' };
  state.money -= price;
  state.cars[id] = { owned: true, hp: 100, upgrades: [] };
  state.garage.push(id);
  return { ok: true, cost: price };
}

export function buyUpgrade(state, carId, upgradeId) {
  const up = GARAGE_UPGRADES.find((g) => g.id === upgradeId);
  if (!up) return { ok: false, error: 'no such upgrade' };
  const car = state.cars[carId];
  if (!car?.owned) return { ok: false, error: 'car not owned' };
  if (car.upgrades.includes(upgradeId)) return { ok: false, error: 'already installed' };
  if (up.needs && !car.upgrades.includes(up.needs)) return { ok: false, error: 'needs ' + up.needs };
  if (state.money < up.price) return { ok: false, error: 'not enough cash' };
  state.money -= up.price;
  car.upgrades.push(upgradeId);
  return { ok: true, cost: up.price };
}

export function repairCar(state, carId) {
  const car = state.cars[carId];
  if (!car?.owned) return { ok: false, error: 'car not owned' };
  const missing = 100 - car.hp;
  if (missing <= 0) return { ok: false, error: 'already pristine' };
  let cost = Math.round(missing * 4);
  if (state.crew.includes('otis')) cost = Math.round(cost / 2);
  if (state.money < cost) return { ok: false, error: 'not enough cash' };
  state.money -= cost;
  car.hp = 100;
  return { ok: true, cost };
}

export function stealCar(state) {
  state.carsStolen += 1;
  addWanted(state, 1);
  return state.carsStolen;
}

// ---- Time, weather, storm ----
export function advanceTime(state, dtHours) {
  state.timeOfDay = (state.timeOfDay + dtHours) % 24;
  state.playSeconds += dtHours * 3600;
  // a game day passes at 06:00
  return state.timeOfDay;
}

export function sleepUntilMorning(state) {
  state.timeOfDay = 7;
  state.health = 100;
  state.wanted = 0;
  state.wantedHeat = 0;
  if (state.day < TOTAL_DAYS) state.day += 1;
  state.storm = Math.min(1, 0.05 + (state.day / TOTAL_DAYS) * 0.95);
  state.weather = state.day >= 6 ? 'storm' : state.day >= 4 ? 'rain' : state.day >= 2 ? 'cloudy' : 'clear';
  return state.day;
}

export function isNight(state) {
  return state.timeOfDay < 6 || state.timeOfDay >= 19;
}

export function stormIntensity(state) {
  return Math.min(1, state.storm + (state.day - 1) * 0.12);
}

export function hoursToLandfall(state) {
  const daysLeft = TOTAL_DAYS - state.day;
  return daysLeft * 24 + (24 - state.timeOfDay);
}

// ---- Jobs, races, crew ----
export function doSideJob(state, jobId) {
  const job = SIDE_JOBS.find((j) => j.id === jobId);
  if (!job) return { ok: false, error: 'no such job' };
  state.money += job.pay;
  state.jobsDone += 1;
  state.respect += 5;
  return { ok: true, pay: job.pay };
}

export function winRace(state, seconds) {
  state.racesWon += 1;
  const pay = 500 + Math.max(0, 300 - Math.round(seconds));
  state.money += pay;
  state.respect += 40;
  return { ok: true, pay };
}

export function recruitCrew(state, id) {
  const member = CREW.find((c) => c.id === id);
  if (!member) return { ok: false, error: 'no such crew' };
  if (state.crew.includes(id)) return { ok: false, error: 'already in crew' };
  const cost = { jax: 0, luma: 800, otis: 600, mara: 1500 }[id] ?? 0;
  if (state.money < cost) return { ok: false, error: 'not enough cash' };
  state.money -= cost;
  state.crew.push(id);
  return { ok: true, cost, member };
}

export function setRadio(state, index) {
  state.radio = ((index % RADIO_STATIONS.length) + RADIO_STATIONS.length) % RADIO_STATIONS.length;
  return RADIO_STATIONS[state.radio];
}

// ---- Save / load ----
export function serialize(state) {
  const copy = { ...state, savedAt: new Date().toISOString() };
  return JSON.stringify(copy);
}

export function deserialize(json) {
  try {
    const data = JSON.parse(json);
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
    const fresh = newGameState();
    const merged = { ...fresh, ...data };
    merged.weapons = { ...fresh.weapons, ...(data.weapons ?? {}) };
    merged.cars = { ...fresh.cars, ...(data.cars ?? {}) };
    if (!Array.isArray(merged.missionsDone)) merged.missionsDone = [];
    if (!Array.isArray(merged.garage)) merged.garage = ['beater'];
    if (!Array.isArray(merged.crew)) merged.crew = ['jax'];
    return merged;
  } catch {
    return null;
  }
}

export function isStoryComplete(state) {
  return state.missionsDone.length >= MISSIONS.length;
}

export function completionPercent(state) {
  const missionPart = (state.missionsDone.length / MISSIONS.length) * 70;
  const rankPart = Math.min(15, (state.respect / 2500) * 15);
  const collectPart = Math.min(15, ((Object.keys(state.cars).length + Object.keys(state.weapons).length) / 11) * 15);
  return Math.round(missionPart + rankPart + collectPart);
}
