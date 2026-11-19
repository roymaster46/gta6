// Ember Harbor — the city as data. Pure: given a seed it returns the same
// layout every time, with no DOM or THREE involved, so tests can check it.
// The city is a 10x10 grid of blocks (streets every 92 m). Each block holds
// 1-4 buildings, a plaza, a park or a landmark. The renderer turns this data
// into meshes; the gameplay modules only read positions and flags.

import { BLOCK, DISTRICTS, HALF, PALETTE, WORLD_SIZE } from './config.js';
import { createRng, hash2, rngInt, rngPick, rngRange } from './utils.js';

export const GRID_N = 10; // blocks per side; streets at -460..460 step 92

export function streetCoord(i) {
  return -HALF + i * BLOCK;
}

export function blockCenter(i, j) {
  return { x: streetCoord(i) + BLOCK / 2, z: streetCoord(j) + BLOCK / 2 };
}

export function districtAt(x, z) {
  const gx = x < -153 ? -3 : x < 153 ? 0 : 3;
  const gz = z < -153 ? -3 : z < 153 ? 0 : 3;
  const found = DISTRICTS.find((d) => d.x === gx && d.z === gz);
  return found || DISTRICTS[4];
}

export function generateCity(seed) {
  const rng = createRng(seed);
  const buildings = [];
  const lamps = [];
  const trees = [];
  const parks = [];
  const plazas = [];
  const landmarks = [];
  const billboards = [];
  const packages = [];
  const carSpawns = [];
  const taxiStands = [];
  const garages = [];

  // Landmarks are fixed by design so missions can point at them by name.
  const landmarkDefs = [
    { id: 'pier', name: 'South Pier', x: 0, z: 414, kind: 'pier' },
    { id: 'bank', name: 'Harbor Trust Bank', x: 46, z: -46, kind: 'bank' },
    { id: 'hospital', name: 'St. Anselm Hospital', x: -322, z: 138, kind: 'hospital' },
    { id: 'safehouse', name: "Vex's Safehouse", x: 322, z: 322, kind: 'safehouse' },
    { id: 'chopshop', name: 'Rusty Wrench Chop Shop', x: -368, z: 322, kind: 'chopshop' },
    { id: 'spray', name: 'Quick Coat Spray Shop', x: 138, z: -322, kind: 'spray' },
    { id: 'market', name: 'Old Market Hall', x: -46, z: -322, kind: 'market' },
    { id: 'tower', name: 'Harborview Tower', x: 322, z: -46, kind: 'tower' },
    { id: 'stadium', name: 'Foundry Bowl', x: -322, z: -322, kind: 'stadium' },
    { id: 'ferry', name: 'Ferry Terminal', x: 414, z: 230, kind: 'ferry' },
  ];
  for (const def of landmarkDefs) {
    landmarks.push({ ...def, w: def.kind === 'stadium' ? 70 : 44, d: def.kind === 'stadium' ? 70 : 36, h: def.kind === 'tower' ? 96 : def.kind === 'bank' ? 34 : 18 });
  }

  for (let i = 0; i < GRID_N; i += 1) {
    for (let j = 0; j < GRID_N; j += 1) {
      const c = blockCenter(i, j);
      const h = hash2(i, j, seed);
      const nearLandmark = landmarks.some((lm) => Math.abs(lm.x - c.x) < 60 && Math.abs(lm.z - c.z) < 60);
      if (nearLandmark) continue;
      if (h < 0.1) {
        parks.push({ x: c.x, z: c.z, size: 62, trees: rngInt(rng, 6, 11) });
        for (let t = 0; t < 8; t += 1) {
          trees.push({ x: c.x + rngRange(rng, -26, 26), z: c.z + rngRange(rng, -26, 26), s: rngRange(rng, 0.8, 1.5) });
        }
        continue;
      }
      if (h < 0.18) {
        plazas.push({ x: c.x, z: c.z, size: 58 });
        continue;
      }
      const nBuild = h < 0.55 ? 1 : h < 0.85 ? 2 : 4;
      for (let b = 0; b < nBuild; b += 1) {
        const ox = nBuild === 1 ? 0 : (b % 2 === 0 ? -20 : 20);
        const oz = nBuild === 1 ? 0 : (b < 2 ? -20 : 20);
        const tall = hash2(i * 7 + b, j * 3 + 1, seed);
        const height = tall > 0.82 ? rngRange(rng, 48, 88) : tall > 0.55 ? rngRange(rng, 22, 44) : rngRange(rng, 9, 20);
        buildings.push({
          x: c.x + ox, z: c.z + oz,
          w: nBuild === 1 ? 52 : 34, d: nBuild === 1 ? 52 : 34,
          h: Math.round(height),
          color: rngPick(rng, PALETTE.building),
          litRatio: rngRange(rng, 0.25, 0.75),
          roof: rngPick(rng, ['flat', 'flat', 'flat', 'spire', 'tank']),
        });
      }
      if (hash2(i, j, seed + 5) < 0.5) {
        carSpawns.push({ x: c.x + rngRange(rng, -30, 30), z: streetCoord(j) + 10, angle: 0 });
      }
    }
  }

  // Street lamps along every street, both sides, every other block.
  for (let i = 0; i <= GRID_N; i += 1) {
    for (let j = 0; j < GRID_N; j += 1) {
      if ((i + j) % 2 === 0) continue;
      lamps.push({ x: streetCoord(i) + 10, z: streetCoord(j) + BLOCK / 2 });
      lamps.push({ x: streetCoord(i) - 10, z: streetCoord(j) + BLOCK / 2 });
    }
  }

  // Billboards on the main avenues.
  const bbTexts = ['EMBER COLA', 'HARBOUR CASINO', 'RUSTY WRENCH', 'NIGHT FERRY', 'VOLT ENERGY', 'PIER 9'];
  for (let k = 0; k < 12; k += 1) {
    billboards.push({
      x: streetCoord(rngInt(rng, 1, 9)) + (rng() < 0.5 ? 12 : -12),
      z: streetCoord(rngInt(rng, 1, 9)),
      angle: rng() < 0.5 ? 0 : Math.PI / 2,
      text: bbTexts[k % bbTexts.length],
      color: PALETTE.neon[k % PALETTE.neon.length],
    });
  }

  // 12 hidden packages tucked in alleys, parks and behind landmarks.
  const pkgSpots = [
    { x: -414, z: -414 }, { x: 414, z: -368 }, { x: -368, z: 46 }, { x: 230, z: 414 },
    { x: -230, z: -414 }, { x: 46, z: 230 }, { x: -138, z: 138 }, { x: 368, z: 138 },
    { x: 138, z: -138 }, { x: -414, z: 230 }, { x: 322, z: -230 }, { x: -46, z: 414 },
  ];
  pkgSpots.forEach((p, idx) => packages.push({ id: idx, x: p.x, z: p.z, taken: false }));

  taxiStands.push({ x: 46, z: 46 }, { x: -46, z: 322 }, { x: 322, z: -322 }, { x: -322, z: -46 });
  garages.push({ x: 138, z: -322, name: 'Quick Coat' }, { x: -368, z: 322, name: 'Rusty Wrench' });

  // The harbour water strip hugs the east edge; the pier reaches into it.
  return {
    seed, buildings, lamps, trees, parks, plazas, landmarks, billboards,
    packages, carSpawns, taxiStands, garages,
    water: { x: HALF + 55, z: 0, w: 130, d: WORLD_SIZE + 260 },
    bounds: HALF,
  };
}

export function buildingAt(city, x, z) {
  for (const b of city.buildings) {
    if (Math.abs(x - b.x) < b.w / 2 + 0.4 && Math.abs(z - b.z) < b.d / 2 + 0.4) return b;
  }
  for (const lm of city.landmarks) {
    if (Math.abs(x - lm.x) < lm.w / 2 + 0.4 && Math.abs(z - lm.z) < lm.d / 2 + 0.4) return lm;
  }
  return null;
}

export function collidesWithBuilding(city, x, z, radius) {
  const b = buildingAt(city, x, z);
  if (!b) return false;
  const dx = Math.abs(x - b.x) - b.w / 2;
  const dz = Math.abs(z - b.z) - b.d / 2;
  return dx < radius && dz < radius;
}

export function resolveBuildingCollision(city, x, z, radius) {
  const b = buildingAt(city, x, z);
  if (!b) return { x, z, hit: false };
  const dx = x - b.x;
  const dz = z - b.z;
  const px = b.w / 2 + radius - Math.abs(dx);
  const pz = b.d / 2 + radius - Math.abs(dz);
  if (px < pz) return { x: b.x + Math.sign(dx || 1) * (b.w / 2 + radius), z, hit: true };
  return { x, z: b.z + Math.sign(dz || 1) * (b.d / 2 + radius), hit: true };
}

export function landmarkById(city, id) {
  return city.landmarks.find((l) => l.id === id) || null;
}

export function randomStreetPoint(rng, margin) {
  const m = margin || 40;
  const i = rngInt(rng, 1, 9);
  const j = rngInt(rng, 1, 9);
  const along = rngRange(rng, -m, m);
  if (rng() < 0.5) return { x: streetCoord(i), z: streetCoord(j) + along };
  return { x: streetCoord(i) + along, z: streetCoord(j) };
}
