// collectibles.js — hidden packages: twenty stashes across Solmarina.
// GTA's hidden packages, Solmarina style: small gold parcels tucked into
// alleys, under the bridge, behind the hospital, on the beach — one per
// corner of the city, each with a district hint. Walk over one to grab it:
// +$100 and +10 REP each, and finding all twenty pays a $1,000 completion
// bonus plus 100 REP and the "Treasure Hunter" line on the pause screen.
// The nearest unfound package shows as a gold diamond on the minimap (only
// the nearest, so the map never turns into a Christmas tree), and the HUD
// counts them "Packages 7/20". Found packages persist in the save file.
// The list is fixed (not random) so guides and screenshots agree.
import { dist } from './utils.js';
import { districtAt } from './city.js';
import { addRespect } from './respect.js';

export const PACKAGE_PAY = 100;
export const PACKAGE_REP = 10;
export const PACKAGE_BONUS_PAY = 1000;
export const PACKAGE_BONUS_REP = 100;
export const PACKAGE_RADIUS = 42;

// Twenty stashes, one or two per district, at spots a player can actually
// reach on foot (roads, sidewalks, beach, park — never inside a building).
export const PACKAGES = [
  { x: 450, y: 120, district: 'Marina', hint: 'under the Marina Bridge' },
  { x: 1950, y: 120, district: 'Yacht Basin', hint: 'behind the yacht club' },
  { x: 240, y: 480, district: 'Old Town', hint: 'in the Old Town alley' },
  { x: 480, y: 660, district: 'Old Town', hint: 'behind the bakery' },
  { x: 300, y: 960, district: 'Market Square', hint: 'under the market stall' },
  { x: 1140, y: 480, district: 'Downtown', hint: 'in the Downtown underpass' },
  { x: 1380, y: 660, district: 'Downtown', hint: 'behind the glass tower' },
  { x: 1140, y: 960, district: 'Civic Center', hint: 'by the courthouse steps' },
  { x: 1980, y: 480, district: 'Hospital Row', hint: 'behind the hospital' },
  { x: 2160, y: 960, district: 'University Quarter', hint: 'in the campus quad' },
  { x: 300, y: 1440, district: 'Palm Park', hint: 'under the park bench' },
  { x: 480, y: 1560, district: 'Palm Park', hint: 'by the plaza fountain' },
  { x: 780, y: 1560, district: 'Rose Gardens', hint: 'in the rose beds' },
  { x: 1740, y: 1440, district: 'Portside', hint: 'on the Portside dock' },
  { x: 2160, y: 1740, district: 'Docklands', hint: 'behind the chop shop' },
  { x: 1740, y: 1980, district: 'Docklands', hint: 'in the container yard' },
  { x: 240, y: 1980, district: 'Safehouse Hills', hint: 'behind the safehouse' },
  { x: 840, y: 2100, district: 'Sunset Ridge', hint: 'on the Sunset Ridge overlook' },
  { x: 600, y: 2280, district: 'Playa Sol', hint: 'under the beach umbrella' },
  { x: 1980, y: 2280, district: 'Coral Beach', hint: 'by the Coral Beach kiosk' },
];

export function createCollectibleState(found = []) {
  return {
    found: new Set(found), // indices into PACKAGES
    totalFound: found.length,
    bonusPaid: false,
  };
}

export function packagesFound(game) {
  return game.collectibles ? game.collectibles.found.size : 0;
}

export function packagesTotal() {
  return PACKAGES.length;
}

export function packagesText(game) {
  return `Hidden packages ${packagesFound(game)}/${PACKAGES.length}`;
}

// The nearest package Leo has not found yet, or null when all are found.
export function nearestPackage(game) {
  const c = game.collectibles;
  if (!c) return null;
  const p = game.player;
  let best = null;
  let bestD = Infinity;
  for (let i = 0; i < PACKAGES.length; i++) {
    if (c.found.has(i)) continue;
    const d = dist(p.x, p.y, PACKAGES[i].x, PACKAGES[i].y);
    if (d < bestD) { bestD = d; best = { ...PACKAGES[i], index: i, dist: d }; }
  }
  return best;
}

// Hint for the nearest package: district + hiding spot, for the HUD line.
export function nearestPackageHint(game) {
  const n = nearestPackage(game);
  if (!n) return 'All packages found — Treasure Hunter!';
  return `Nearest package: ${n.hint} (${n.district}, ${Math.round(n.dist)}m)`;
}

// Tick: walking over an unfound package collects it. Returns the package
// collected this tick, or null.
export function updateCollectibles(game, dt) {
  const c = game.collectibles;
  if (!c) return null;
  const p = game.player;
  const px = p.inCar && p.car ? p.car.x : p.x;
  const py = p.inCar && p.car ? p.car.y : p.y;
  for (let i = 0; i < PACKAGES.length; i++) {
    if (c.found.has(i)) continue;
    if (dist(px, py, PACKAGES[i].x, PACKAGES[i].y) < PACKAGE_RADIUS) {
      c.found.add(i);
      c.totalFound = c.found.size;
      p.money += PACKAGE_PAY;
      p.stats.rep = (p.stats.rep || 0) + PACKAGE_REP;
      if (game.respect) addRespect(game, PACKAGE_REP, `Hidden package found (${c.found.size}/20)`);
      if (game.events) game.events.push({ type: 'cash' });
      if (game.missions) {
        game.missions.message = `Hidden package found! +$${PACKAGE_PAY} (${c.found.size}/20)`;
        game.missions.messageTimer = 4;
      }
      // All twenty: the completion bonus, once.
      if (c.found.size >= PACKAGES.length && !c.bonusPaid) {
        c.bonusPaid = true;
        p.money += PACKAGE_BONUS_PAY;
        if (game.respect) addRespect(game, PACKAGE_BONUS_REP, 'Treasure Hunter — all packages found');
        if (game.missions) {
          game.missions.message = `TREASURE HUNTER! All 20 packages — +$${PACKAGE_BONUS_PAY} bonus!`;
          game.missions.messageTimer = 6;
        }
      }
      if (game.save) game.save();
      return { ...PACKAGES[i], index: i };
    }
  }
  return null;
}

// Serialize found indices for the save file.
export function collectiblesSnapshot(game) {
  const c = game.collectibles;
  if (!c) return { found: [], bonusPaid: false };
  return { found: [...c.found], bonusPaid: c.bonusPaid };
}

// Restore from a snapshot (an array of indices, or the snapshot object).
export function restoreCollectibles(game, snap) {
  const found = Array.isArray(snap) ? snap : (snap?.found || []);
  const st = createCollectibleState(found);
  st.bonusPaid = Array.isArray(snap) ? found.length >= PACKAGES.length : !!snap?.bonusPaid;
  game.collectibles = st;
  return st;
}

// Districts that still hide an unfound package, for the pause screen.
export function districtsWithPackages(game) {
  const c = game.collectibles;
  if (!c) return [];
  const out = new Set();
  for (let i = 0; i < PACKAGES.length; i++) {
    if (!c.found.has(i)) out.add(PACKAGES[i].district);
  }
  return [...out];
}

// Sanity: every package sits in the district its entry claims. The tests
// check this so a typo never strands a package in the wrong district.
export function packagesMatchDistricts() {
  return PACKAGES.every((pk) => districtAt(pk.x, pk.y) === pk.district);
}
