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
  // r6: what each crime is worth, by name, for the new heat-for-crime log.
  crimes: {
    stealCar: 1, killPed: 1, shoot: 0.4, punch: 0.2, crashPed: 1,
    robbery: 2, chopSale: 1, vigilanteKill: 0, heliTheft: 2, vaultGrab: 2,
  },
  swatAtStars: 5,
  fibAtStars: 5,
  heliArmedAtStars: 5,
  roadblockMax: 3,
};

export const HELI_TUNING = {
  maxAltitude: 120,
  liftAccel: 14,
  maxSpeed: 42,
  fuelBurnPerSecond: 0.55,
  fuelCapacity: 100,
  refuelCost: 150,
  policeCallInterval: 4,
};

export const SWAT_TUNING = {
  runSpeed: 10.2,
  health: 160,
  shootRange: 46,
  shootDamage: 11,
  maxUnits: 6,
  fibCarSpeed: 38,
  maxFibCars: 3,
};

export const SHOP_TUNING = {
  gunshopHealCost: 80,
  armourPrice: 300,
  armourValue: 50,
  medkitPrice: 80,
  medkitHeal: 50,
  safehouseHealCost: 50,
  heliRefuelCost: 150,
  garageUpgradeCost: 250,
};

export const EVENTS_TUNING = {
  spawnInterval: 55,
  maxActive: 2,
  firstSpawnDelay: 45,
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
  // r6: at 5 stars the ground response is SWAT + FIB, not more beat cops.
  maxSwat: 6,
  maxFibCars: 3,
  heliCallInterval: 4,
};

export const TRAFFIC = {
  carCount: 26,
  pedCount: 42,
  carSpeed: 11,
  pedSpeed: 1.6,
  spawnMargin: 40,
};

export const MISSIONS = {
  count: 14,
  rewardBase: 150,
  // r6: the six new jobs pay for new mechanics (heli, stealth, turf).
  extraCount: 6,
  heistReward: 2000,
};

export const SIDE_JOBS = {
  vigilanteBase: 180,
  vigilanteStep: 40,
  vipMultiplier: 3,
  eventRewards: { robbery: 150, 'police-chase': 120, 'street-race': 200, brawl: 100, 'vip-escort': 250 },
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
  // r6: gun shop, safehouse, heli fuel and garage upgrades.
  riflePrice: 680,
  smgPrice: 420,
  shotgunPrice: 520,
  armourPrice: 300,
  medkitPrice: 80,
  safehouseHealCost: 50,
  heliRefuelCost: 150,
  upgradeCost: 250,
  vigilanteBase: 180,
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
  // r6: the Longshot Rifle — slow, loud, and the only gun that can bring
  // down a police helicopter from the ground. Sold at Iron Annie Guns.
  rifle: { name: 'Longshot Rifle', damage: 55, range: 120, rate: 1.1, ammo: 40, auto: false, antiHeli: true },
};

// r6: the city also has named corners inside the nine districts — the
// places regulars meet, the spots the HUD can name as you drive past.
export const NEIGHBORHOODS = [
  { name: 'The Neon Mile', x: 0, z: 0, flavor: 'The Strip at full glare.' },
  { name: 'Fishmarket Steps', x: -46, z: 322, flavor: 'Gulls, crates and early deals.' },
  { name: 'Casino Row', x: 230, z: -138, flavor: 'Gold light and bad decisions.' },
  { name: 'Heliport Flats', x: 368, z: -138, flavor: 'Rotor wash over the water.' },
  { name: 'Gunshop Alley', x: -138, z: 138, flavor: 'Iron Annie keeps the lights on.' },
];

export function neighborhoodAt(x, z) {
  let best = null;
  let bestD = 60;
  for (const n of NEIGHBORHOODS) {
    const d = Math.hypot(x - n.x, z - n.z);
    if (d < bestD) { bestD = d; best = n; }
  }
  return best;
}
