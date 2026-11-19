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
    // r6: new landmarks the new systems live at — gun shop, casino,
    // heliport and a second safehouse up in Northgate.
    { id: 'gunshop', name: 'Iron Annie Guns', x: -138, z: 138, kind: 'gunshop' },
    { id: 'casino', name: 'Harbour Casino', x: 230, z: -138, kind: 'casino' },
    { id: 'heliport', name: 'Harbor Heliport', x: 414, z: -138, kind: 'heliport' },
    { id: 'safehouse2', name: 'Northgate Safehouse', x: -322, z: -138, kind: 'safehouse' },
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

  // 16 hidden packages tucked in alleys, parks and behind landmarks.
  // r6 adds four more in the new corners of town (casino, heliport,
  // gunshop alley, Northgate) so the hunt keeps paying after the first 12.
  const pkgSpots = [
    { x: -414, z: -414 }, { x: 414, z: -368 }, { x: -368, z: 46 }, { x: 230, z: 414 },
    { x: -230, z: -414 }, { x: 46, z: 230 }, { x: -138, z: 138 }, { x: 368, z: 138 },
    { x: 138, z: -138 }, { x: -414, z: 230 }, { x: 322, z: -230 }, { x: -46, z: 414 },
    { x: 230, z: -92 }, { x: 368, z: -138 }, { x: -92, z: 138 }, { x: -322, z: -92 },
  ];
  pkgSpots.forEach((p, idx) => packages.push({ id: idx, x: p.x, z: p.z, taken: false }));

  taxiStands.push({ x: 46, z: 46 }, { x: -46, z: 322 }, { x: 322, z: -322 }, { x: -322, z: -46 });
  garages.push({ x: 138, z: -322, name: 'Quick Coat' }, { x: -368, z: 322, name: 'Rusty Wrench' });

  // r6: heli pads (heliport + two rooftops) and the avenues roadblocks
  // seal at 4+ stars. Pads are flat clearings, not buildings, so the
  // renderer draws an H circle and the heli can land on them.
  const heliPads = [
    { id: 'heliport', name: 'Harbor Heliport', x: 368, z: -138, radius: 10 },
    { id: 'tower-roof', name: 'Harborview Tower Roof', x: 322, z: -46, radius: 9 },
    { id: 'hospital-roof', name: 'St. Anselm Roof', x: -322, z: 138, radius: 9 },
  ];
  // Street corners where ambient events like to start.
  const eventSpots = [
    { x: 0, z: 0 }, { x: -184, z: 92 }, { x: 184, z: -92 },
    { x: -92, z: -184 }, { x: 92, z: 184 }, { x: -276, z: 276 },
  ];

  // The harbour water strip hugs the east edge; the pier reaches into it.
  // r7: the city also carries its new districts as data — night-market
  // stalls, dock cranes and containers, foundry furnaces, and the six
  // enterable interiors (doors are real positions the player can use).
  const r7 = {
    marketStalls: [
      { id: 'noodles', x: -62, z: -230 }, { id: 'lanterns', x: -46, z: -246 },
      { id: 'fish', x: -30, z: -230 }, { id: 'tea', x: -46, z: -214 },
      { id: 'trinkets', x: -62, z: -214 }, { id: 'records', x: -30, z: -246 },
    ],
    docks: [
      { id: 'crane-1', x: 400, z: 92, h: 42 }, { id: 'crane-2', x: 400, z: 184, h: 38 },
      { id: 'container-a', x: 368, z: 92 }, { id: 'container-b', x: 368, z: 108 },
      { id: 'container-c', x: 368, z: 124 }, { id: 'container-d', x: 414, z: 92 },
    ],
    foundry: [
      { id: 'furnace-1', x: -368, z: -368, h: 26 }, { id: 'furnace-2', x: -322, z: -368, h: 22 },
      { id: 'chimney', x: -414, z: -368, h: 48 }, { id: 'silo', x: -368, z: -322, h: 30 },
    ],
    interiors: [
      { id: 'gunshop-back', x: -138, z: 138, doorX: -138, doorZ: 122 },
      { id: 'casino-floor', x: 230, z: -138, doorX: 230, doorZ: -122 },
      { id: 'hospital-ward', x: -322, z: 138, doorX: -322, doorZ: 122 },
      { id: 'tea-house', x: -46, z: -230, doorX: -46, doorZ: -214 },
      { id: 'ferry-office', x: 414, z: 230, doorX: 414, doorZ: 214 },
      { id: 'warehouse-9', x: -368, z: -368, doorX: -368, doorZ: -352 },
    ],
    boatDocks: [
      { id: 'pier-south', x: 470, z: 414 }, { id: 'ferry', x: 480, z: 230 }, { id: 'harbor-north', x: 470, z: -322 },
    ],
  };
  return {
    seed, buildings, lamps, trees, parks, plazas, landmarks, billboards,
    packages, carSpawns, taxiStands, garages, heliPads, eventSpots, r7,
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

export function heliPadById(city, id) {
  return (city.heliPads || []).find((p) => p.id === id) || null;
}

export function nearestHeliPad(city, x, z, maxDist) {
  let best = null;
  let bestD = maxDist || Infinity;
  for (const p of city.heliPads || []) {
    const d = Math.hypot(x - p.x, z - p.z);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best ? { pad: best, dist: bestD } : null;
}

export function safehouses(city) {
  return city.landmarks.filter((l) => l.kind === 'safehouse');
}

export function landmarkKinds(city) {
  const kinds = {};
  for (const lm of city.landmarks) kinds[lm.kind] = (kinds[lm.kind] || 0) + 1;
  return kinds;
}

export function randomStreetPoint(rng, margin) {
  const m = margin || 40;
  const i = rngInt(rng, 1, 9);
  const j = rngInt(rng, 1, 9);
  const along = rngRange(rng, -m, m);
  if (rng() < 0.5) return { x: streetCoord(i), z: streetCoord(j) + along };
  return { x: streetCoord(i) + along, z: streetCoord(j) };
}

// r7: the new districts, interiors and water are data on the city — the
// renderer draws them, the gameplay modules read them, tests count them.
export function r7Extras(city) {
  return city.r7 || { marketStalls: [], docks: [], foundry: [], interiors: [], boatDocks: [] };
}

export function inWater(x, z) {
  return x > 460;
}

export function nearestInteriorDoor(city, x, z, maxDist) {
  let best = null;
  let bestD = maxDist || 6;
  for (const it of (city.r7?.interiors || [])) {
    const d = Math.hypot(x - it.doorX, z - it.doorZ);
    if (d < bestD) { bestD = d; best = it; }
  }
  return best;
}

export function nearestBoatDock(city, x, z) {
  let best = null;
  let bestD = Infinity;
  for (const d of (city.r7?.boatDocks || [])) {
    const dd = Math.hypot(x - d.x, z - d.z);
    if (dd < bestD) { bestD = dd; best = d; }
  }
  return best ? { dock: best, dist: bestD } : null;
}

export function marketStallAt(city, x, z, maxDist) {
  let best = null;
  let bestD = maxDist || 5;
  for (const s of (city.r7?.marketStalls || [])) {
    const d = Math.hypot(x - s.x, z - s.z);
    if (d < bestD) { bestD = d; best = s; }
  }
  return best;
}
