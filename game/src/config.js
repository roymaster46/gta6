// Ember Harbor — every tuning number in one place. The city is a square
// WORLD_SIZE x WORLD_SIZE metres, laid out on a regular street grid. Nothing
// here depends on the screen size; the renderer scales to the window.

export const STEP = 1 / 60;
export const WORLD_SIZE = 920;
export const HALF = WORLD_SIZE / 2;
export const BLOCK = 92; // metres between street centrelines
export const STREET_W = 16;
export const SEED_DEFAULT = 20261119;

export const PLAYER = {
  walkSpeed: 5.2,
  runSpeed: 9.4,
  accel: 34,
  friction: 26,
  jumpSpeed: 8.6,
  gravity: 24,
  radius: 0.55,
  height: 1.8,
  maxHealth: 100,
  punchDamage: 12,
  punchRange: 2.1,
  punchCooldown: 0.45,
};

export const CAR = {
  accel: 17,
  brake: 30,
  reverseAccel: 9,
  maxSpeed: 34,
  maxReverse: 10,
  steerMax: 0.55,
  steerSpeed: 2.4,
  grip: 7.5,
  drag: 0.55,
  nitroBoost: 1.65,
  nitroTime: 2.6,
  nitroCooldown: 8,
  maxHealth: 100,
  damagePerHit: 8,
};

export const WANTED = {
  maxStars: 5,
  decayDelay: 14,
  decayPerSecond: 0.055,
  stealCar: 1,
  killPed: 1,
  shoot: 0.4,
  punch: 0.2,
  crashPed: 1,
  robbery: 2,
  heliAtStars: 4,
  roadblockAtStars: 4,
};

export const POLICE = {
  copRunSpeed: 8.8,
  copCarSpeed: 33,
  arrestRange: 1.6,
  arrestTime: 2.2,
  ramRange: 3.2,
  sightRange: 70,
  giveUpSeconds: 26,
  maxFootCops: 6,
  maxCopCars: 5,
};

export const TRAFFIC = {
  carCount: 26,
  pedCount: 42,
  carSpeed: 11,
  pedSpeed: 1.6,
  spawnMargin: 40,
};

export const MISSIONS = {
  count: 8,
  rewardBase: 150,
};

export const DAY = {
  lengthSeconds: 360,
  dawn: 0.22,
  noon: 0.5,
  dusk: 0.78,
  nightStart: 0.85,
};

export const ECONOMY = {
  startCash: 60,
  taxiFare: 45,
  packageBonus: 120,
  chopPayout: 320,
  sprayCost: 120,
  spraySurcharge: 60,
  hospitalCost: 150,
  ammoCost: 40,
};

export const SAVE_KEY = 'ember-harbor.save.v1';
export const BEST_KEY = 'ember-harbor.best.v1';

export const DISTRICTS = [
  { name: 'Foundry Row', x: -3, z: -3, flavor: 'Furnaces never sleep here.' },
  { name: 'Dockside', x: -3, z: 0, flavor: 'Salt, diesel and deals after dark.' },
  { name: 'Cannery Flats', x: -3, z: 3, flavor: 'Tin roofs, cheap rooms, loud radios.' },
  { name: 'Old Market', x: 0, z: -3, flavor: 'Spices, shouting vendors, quick fingers.' },
  { name: 'The Strip', x: 0, z: 0, flavor: 'Neon, noise and money that moves fast.' },
  { name: 'Hillcrest', x: 0, z: 3, flavor: 'Quiet streets, big houses, locked gates.' },
  { name: 'Northgate', x: 3, z: -3, flavor: 'Warehouses and trucks, day and night.' },
  { name: 'Harborview', x: 3, z: 0, flavor: 'Glass towers watching the water.' },
  { name: 'South Pier', x: 3, z: 3, flavor: 'Ferries, fishermen and fog.' },
];

export const PALETTE = {
  asphalt: 0x2b2e36,
  sidewalk: 0x8a8d94,
  building: [0x9a6b4f, 0x6f7d8c, 0xb08a5a, 0x7a6a8a, 0x5f7a6a, 0xa89a7a],
  windowLit: 0xffd27a,
  windowDark: 0x2a3340,
  lamp: 0xffe6a3,
  grass: 0x4a7a4a,
  water: 0x1d4e6b,
  playerJacket: 0xd84a2f,
  playerPants: 0x2e3440,
  copBlue: 0x1e4fd8,
  taxiYellow: 0xf2c200,
  neon: [0xff2e88, 0x22d3ee, 0xa3e635, 0xf59e0b],
};

export const WEAPONS = {
  fists: { name: 'Fists', damage: 12, range: 2.1, rate: 0.45, ammo: Infinity, auto: false },
  pistol: { name: 'P9 Pistol', damage: 34, range: 55, rate: 0.32, ammo: 120, auto: false },
  smg: { name: 'Wasp SMG', damage: 16, range: 42, rate: 0.09, ammo: 240, auto: true },
  shotgun: { name: 'Boomstick', damage: 22, range: 20, rate: 0.85, ammo: 24, auto: false, pellets: 6 },
};
