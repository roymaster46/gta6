// city.js — Solmarina map: roads, buildings, beach, park, port, bridge.
// World is 2400x2400. Roads form a grid; blocks hold buildings, parks and
// landmarks. All placement is deterministic from a seed so ?shot= scenes match.
// New in this revision: billboards along the main roads, a plaza with benches
// next to Palm Park, beach kiosks on Playa Sol, and a glow radius on every
// street lamp so the renderer can light them up after dark.
import { mulberry32, pick, resolveCircleRect } from './utils.js';

export const WORLD = 2400;
export const ROAD_W = 64;
export const BLOCK = 300; // grid pitch: road + block

// Named landmarks the missions and HUD refer to.
export const LANDMARKS = {
  safehouse: { x: 330, y: 330, label: 'Safehouse' },
  hospital: { x: 2070, y: 330, label: 'Hospital' },
  bank: { x: 1470, y: 1170, label: 'Solmarina Bank' },
  garage: { x: 870, y: 1770, label: 'Pay-n-Spray' },
  beach: { x: 1200, y: 2250, label: 'Playa Sol' },
  port: { x: 2250, y: 1950, label: 'Port' },
  boat: { x: 2280, y: 2130, label: 'Getaway Boat' },
  park: { x: 1200, y: 1470, label: 'Palm Park' },
  bridge: { x: 1200, y: 150, label: 'Marina Bridge' },
  marina: { x: 1200, y: 90, label: 'Marina' },
  // The buyer's yacht, moored just north of the marina — the drop point for
  // the final mission. Reachable on foot and by car along the north edge.
  yacht: { x: 1200, y: 60, label: 'Yacht' },
};

const BUILDING_COLORS = [
  '#e8b48a', '#d99a6c', '#f2d5a0', '#c98f7a', '#a8c8d8', '#e6d3b3',
  '#d8a0a0', '#b5c9a8', '#e0c090', '#9fb8c8', '#f0e0c0', '#c8b098',
];
const ROOF_COLORS = ['#8a5a3b', '#6b4a3a', '#7a6a5a', '#5a6a7a', '#9a7a5a'];

// Roadside billboards: fixed spots, fixed copy — part of the city's look.
const BILLBOARDS = [
  { x: 1050, y: 420, w: 120, h: 40, text: 'SOLMARINA', sub: 'sun • sea • speed', color: '#ff5a5a' },
  { x: 1650, y: 1080, w: 120, h: 40, text: 'PAY-N-SPRAY', sub: 'lose the heat', color: '#3a6fd8' },
  { x: 450, y: 1680, w: 120, h: 40, text: 'PLAYA SOL', sub: 'beach • all night', color: '#e8c832' },
];

export function buildCity(seed = 1) {
  const rng = mulberry32(seed);
  const buildings = [];
  const trees = [];
  const lamps = [];

  // Road centrelines: verticals and horizontals every BLOCK, offset so the
  // grid starts at 150 (road centre) and the beach strip sits at the south.
  const roadsV = [];
  const roadsH = [];
  for (let x = 150; x < WORLD; x += BLOCK) roadsV.push(x);
  for (let y = 150; y < WORLD - 240; y += BLOCK) roadsH.push(y);

  // Buildings fill each block between roads, leaving the park block open.
  const parkBlock = { bx: 3, by: 4 }; // block indices for Palm Park
  for (let bx = 0; bx < roadsV.length - 1; bx++) {
    for (let by = 0; by < roadsH.length - 1; by++) {
      const x0 = roadsV[bx] + ROAD_W / 2 + 14;
      const y0 = roadsH[by] + ROAD_W / 2 + 14;
      const x1 = roadsV[bx + 1] - ROAD_W / 2 - 14;
      const y1 = roadsH[by + 1] - ROAD_W / 2 - 14;
      if (bx === parkBlock.bx && by === parkBlock.by) {
        // Park: palm trees and a pond instead of buildings.
        for (let i = 0; i < 14; i++) {
          trees.push({ x: x0 + rng() * (x1 - x0), y: y0 + rng() * (y1 - y0), r: 9 + rng() * 5 });
        }
        continue;
      }
      // 2-4 buildings per block.
      const n = 2 + Math.floor(rng() * 3);
      for (let i = 0; i < n; i++) {
        const w = 60 + rng() * 90;
        const h = 60 + rng() * 90;
        const x = x0 + rng() * Math.max(1, (x1 - x0) - w);
        const y = y0 + rng() * Math.max(1, (y1 - y0) - h);
        const b = { x, y, w, h, color: pick(BUILDING_COLORS), roof: pick(ROOF_COLORS), hgt: 24 + rng() * 70 };
        if (buildings.some((o) => rectsOverlapPad(o, b, 10))) continue;
        buildings.push(b);
      }
      // A couple of street trees per block corner.
      for (let i = 0; i < 2; i++) {
        trees.push({ x: x0 + rng() * (x1 - x0), y: y0 + rng() * (y1 - y0), r: 7 + rng() * 4 });
      }
    }
  }
  // Landmark buildings (bigger, fixed spots so missions can point at them).
  const landmarkBuildings = [
    { x: 1400, y: 1100, w: 150, h: 110, color: '#e8d8a8', roof: '#6b4a3a', hgt: 90, label: 'BANK' },
    { x: 800, y: 1700, w: 130, h: 90, color: '#b8c8d8', roof: '#5a6a7a', hgt: 40, label: 'GARAGE' },
    { x: 2000, y: 260, w: 140, h: 100, color: '#f0f0e8', roof: '#8a5a3b', hgt: 60, label: 'HOSPITAL' },
    { x: 260, y: 260, w: 120, h: 90, color: '#e8b48a', roof: '#6b4a3a', hgt: 50, label: 'HOME' },
  ];
  for (const lb of landmarkBuildings) buildings.push(lb);

  // Street lamps along roads. Each lamp carries a glow radius for the
  // night renderer — the same lamp lights the same patch every night.
  for (const x of roadsV) for (const y of roadsH) lamps.push({ x: x + ROAD_W / 2 + 6, y: y - ROAD_W / 2 - 6, glow: 34 });

  // The plaza: a paved square with benches just north of Palm Park, where
  // peds idle during the day.
  const plaza = {
    x: 1050, y: 1050, w: 300, h: 150,
    benches: [
      { x: 1120, y: 1100 }, { x: 1280, y: 1100 },
      { x: 1120, y: 1160 }, { x: 1280, y: 1160 },
    ],
  };
  // Beach kiosks on Playa Sol — little striped stalls that sell ice cream
  // by day and stay shuttered at night.
  const kiosks = [
    { x: 500, y: 2190, w: 46, h: 34, color: '#ff5a5a' },
    { x: 1000, y: 2190, w: 46, h: 34, color: '#3a6fd8' },
    { x: 1700, y: 2190, w: 46, h: 34, color: '#e8c832' },
  ];

  // Beach strip along the south edge (y 2160..2400): sand + ocean.
  const beach = { x: 0, y: 2160, w: WORLD, h: 130 };
  const ocean = { x: 0, y: 2290, w: WORLD, h: 110 };
  // Port docks on the east edge.
  const docks = [
    { x: 2280, y: 1800, w: 120, h: 26 },
    { x: 2280, y: 1900, w: 120, h: 26 },
    { x: 2280, y: 2000, w: 120, h: 26 },
  ];
  return { buildings, trees, lamps, roadsV, roadsH, beach, ocean, docks, seed, billboards: BILLBOARDS, plaza, kiosks };
}

function rectsOverlapPad(a, b, pad) {
  return a.x - pad < b.x + b.w + pad && a.x + a.w + pad > b.x - pad &&
    a.y - pad < b.y + b.h + pad && a.y + a.h + pad > b.y - pad;
}

// Is the point on a road (drivable asphalt)?
export function onRoad(city, x, y) {
  for (const rx of city.roadsV) if (Math.abs(x - rx) <= ROAD_W / 2) return true;
  for (const ry of city.roadsH) if (Math.abs(y - ry) <= ROAD_W / 2) return true;
  return false;
}
// Nearest road centre point to (x,y) — used to snap traffic onto lanes.
export function nearestRoadPoint(city, x, y) {
  let best = null, bestD = Infinity;
  for (const rx of city.roadsV) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y, vertical: true }; }
  }
  for (const ry of city.roadsH) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x, y: ry, vertical: false }; }
  }
  return best;
}
// Random point on a road, for spawning traffic / peds.
export function randomRoadPoint(city, rng) {
  if (rng() < 0.5) {
    return { x: city.roadsV[Math.floor(rng() * city.roadsV.length)], y: 100 + rng() * 2000 };
  }
  return { x: 100 + rng() * 2200, y: city.roadsH[Math.floor(rng() * city.roadsH.length)] };
}
// Waypoint following: next point along the road grid from (x,y) heading dir.
export function nextWaypoint(city, x, y, dir) {
  // dir: 0 east, 1 south, 2 west, 3 north. At an intersection, maybe turn.
  const snap = nearestRoadPoint(city, x, y);
  const onV = Math.abs(x - snap.x) < 4;
  const atIntersection = onV && city.roadsH.some((ry) => Math.abs(y - ry) < 10);
  let nd = dir;
  if (atIntersection && Math.random() < 0.45) {
    nd = (dir + (Math.random() < 0.5 ? 1 : 3)) % 4;
  }
  const step = 120;
  let nx = x, ny = y;
  if (nd === 0) nx += step; else if (nd === 1) ny += step;
  else if (nd === 2) nx -= step; else ny -= step;
  nx = Math.max(90, Math.min(WORLD - 90, nx));
  ny = Math.max(90, Math.min(WORLD - 130, ny));
  return { x: nx, y: ny, dir: nd };
}
// Collision: push circle out of every building; returns true if any hit.
export function collideBuildings(city, p, r) {
  let hit = false;
  for (const b of city.buildings) {
    if (p.x + r < b.x || p.x - r > b.x + b.w || p.y + r < b.y || p.y - r > b.y + b.h) continue;
    if (resolveCircleRect(p, r, b)) hit = true;
  }
  return hit;
}
export function pointInBuilding(city, x, y) {
  return city.buildings.some((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
}
// A free (non-building, on-road-adjacent) spot near (x,y) for spawning.
export function freeSpotNear(city, x, y, rng, radius = 40) {
  for (let i = 0; i < 24; i++) {
    const a = rng() * Math.PI * 2;
    const d = rng() * radius;
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
    if (px < 40 || py < 40 || px > WORLD - 40 || py > WORLD - 40) continue;
    if (!pointInBuilding(city, px, py)) return { x: px, y: py };
  }
  return { x, y };
}
export function randomFreePoint(city, rng) {
  for (let i = 0; i < 40; i++) {
    const x = 80 + rng() * (WORLD - 160);
    const y = 80 + rng() * (WORLD - 260);
    if (!pointInBuilding(city, x, y)) return { x, y };
  }
  return { x: 330, y: 330 };
}
export function randomParkedSpot(city, rng) {
  const p = randomRoadPoint(city, rng);
  return { x: p.x + (rng() < 0.5 ? -20 : 20), y: p.y + (rng() < 0.5 ? -20 : 20) };
}
