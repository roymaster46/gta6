// Ember Harbor — r7 interiors + new districts. The city grows three new
// places you can actually go inside: the night market (stalls, lanterns,
// Juno's stage), the harbour docks (cranes, containers, the ferry), and
// the industrial Foundry Row (warehouses, furnaces). Interiors are small
// walkable rooms entered through a doorway: the gun shop back room, the
// casino floor, the hospital ward and the market tea house. Each interior
// has loot, a contact, or a shortcut — never just a wall with a door.

import { clamp, dist } from './utils.js';

export const R7_DISTRICTS = [
  { id: 'night-market', name: 'Night Market', x: -46, z: -230, flavor: 'Lanterns, smoke and every deal in the city.', openAt: 0.78, closesAt: 0.3 },
  { id: 'docks', name: 'The Docks', x: 414, z: 138, flavor: 'Cranes, containers and Sal Kett\'s empire.', openAt: 0, closesAt: 1 },
  { id: 'foundry', name: 'Foundry Row Industrial', x: -368, z: -368, flavor: 'Furnaces never sleep here. Neither do the guards.', openAt: 0, closesAt: 1 },
  { id: 'marina', name: 'Marina', x: 470, z: 0, flavor: 'Boats, gulls and money that floats.', openAt: 0, closesAt: 1 },
  { id: 'chinatown', name: 'Lantern Row', x: 138, z: 322, flavor: 'Noodles at 3 a.m., mahjong at dawn.', openAt: 0.78, closesAt: 0.35 },
];

export function r7DistrictAt(x, z) {
  let best = null;
  let bestD = 120;
  for (const d of R7_DISTRICTS) {
    const dd = dist(x, z, d.x, d.z);
    if (dd < bestD) { bestD = dd; best = d; }
  }
  return best;
}

export function districtOpen(district, dayTime) {
  if (!district) return true;
  if (district.openAt <= district.closesAt) return dayTime >= district.openAt && dayTime < district.closesAt;
  return dayTime >= district.openAt || dayTime < district.closesAt;
}

export const INTERIORS = [
  {
    id: 'gunshop-back', name: 'Iron Annie — Back Room', x: -138, z: 138, doorX: -138, doorZ: 122,
    w: 18, d: 14, kind: 'shop',
    description: 'Annie\'s workbench, a wall of parts, and a crate of "lost" rifles.',
    loot: [{ id: 'rifle-ammo', label: 'Rifle rounds ×30', value: 120 }, { id: 'armour', label: 'Kevlar vest', value: 300 }],
    contact: 'annie',
  },
  {
    id: 'casino-floor', name: 'Harbour Casino — Floor', x: 230, z: -138, doorX: 230, doorZ: -122,
    w: 26, d: 20, kind: 'casino',
    description: 'Slots, cards and a back room with a ledger. Sal\'s money moves through here.',
    loot: [{ id: 'casino-chips', label: 'Casino chips ($250)', value: 250 }],
    contact: 'sal',
  },
  {
    id: 'hospital-ward', name: 'St. Anselm — Ward', x: -322, z: 138, doorX: -322, doorZ: 122,
    w: 20, d: 16, kind: 'hospital',
    description: 'Doc Anselm\'s ward. Beds, bandages, and a fridge full of blood bags.',
    loot: [{ id: 'medkit', label: 'Medkit (+50 HP)', value: 80 }, { id: 'medkit', label: 'Medkit (+50 HP)', value: 80 }],
    contact: 'doc',
  },
  {
    id: 'tea-house', name: 'Juno\'s Tea House', x: -46, z: -230, doorX: -46, doorZ: -214,
    w: 16, d: 12, kind: 'social',
    description: 'Juno sings here after dark. The back table is where the harbour talks.',
    loot: [{ id: 'intel', label: 'Harbour intel (next mission marked)', value: 0 }],
    contact: 'juno',
  },
  {
    id: 'ferry-office', name: 'Ferry Office', x: 414, z: 230, doorX: 414, doorZ: 214,
    w: 18, d: 12, kind: 'office',
    description: 'Timetables, manifests — and the payroll schedule for the midnight ferry.',
    loot: [{ id: 'manifest', label: 'Ferry manifest (payroll times)', value: 0 }],
    contact: 'mara',
  },
  {
    id: 'warehouse-9', name: 'Warehouse 9', x: -368, z: -368, doorX: -368, doorZ: -352,
    w: 24, d: 18, kind: 'warehouse',
    description: 'Crates stacked to the roof. One of them is full of Sal\'s gold.',
    loot: [{ id: 'gold-bar', label: 'Gold bar ($400)', value: 400 }, { id: 'gold-bar', label: 'Gold bar ($400)', value: 400 }],
    contact: 'rusty',
  },
];

export function interiorById(id) {
  return INTERIORS.find((i) => i.id === id) || null;
}

export function interiorAtDoor(x, z, maxDist) {
  let best = null;
  let bestD = maxDist || 6;
  for (const it of INTERIORS) {
    const d = dist(x, z, it.doorX, it.doorZ);
    if (d < bestD) { bestD = d; best = it; }
  }
  return best;
}

export function insideInterior(interior, x, z) {
  if (!interior) return false;
  return Math.abs(x - interior.x) < interior.w / 2 && Math.abs(z - interior.z) < interior.d / 2;
}

export function createInteriorState() {
  return {
    current: null,
    visited: [],
    lootTaken: [],
    entries: 0,
    lastEntry: null,
  };
}

export function enterInterior(state, interiorId, player) {
  const it = interiorById(interiorId);
  if (!it) return { ok: false, reason: 'no such interior' };
  if (state.current) return { ok: false, reason: 'already inside' };
  state.current = it.id;
  state.entries += 1;
  state.lastEntry = it.id;
  if (!state.visited.includes(it.id)) state.visited.push(it.id);
  // Stepping inside moves the player to the room centre.
  player.x = it.x;
  player.z = it.z;
  return { ok: true, interior: it };
}

export function exitInterior(state, player) {
  if (!state.current) return { ok: false, reason: 'not inside' };
  const it = interiorById(state.current);
  state.current = null;
  if (it && player) {
    player.x = it.doorX;
    player.z = it.doorZ + 2;
  }
  return { ok: true, interior: it };
}

export function takeInteriorLoot(state, interiorId, lootIndex, player) {
  const it = interiorById(interiorId);
  if (!it || !it.loot[lootIndex]) return { ok: false, reason: 'no loot there' };
  const key = `${interiorId}:${lootIndex}`;
  if (state.lootTaken.includes(key)) return { ok: false, reason: 'already taken' };
  const loot = it.loot[lootIndex];
  state.lootTaken.push(key);
  if (loot.value && player) player.cash += loot.value;
  return { ok: true, loot, cash: player ? player.cash : 0 };
}

export function interiorSummary(state) {
  return {
    current: state.current,
    visited: state.visited.length,
    visitedTotal: INTERIORS.length,
    lootTaken: state.lootTaken.length,
    entries: state.entries,
  };
}

export const NIGHT_MARKET_STALLS = [
  { id: 'noodles', name: 'Noodle stall', x: -62, z: -230, goods: 'Noodles — heal $10', price: 10, heal: 25 },
  { id: 'lanterns', name: 'Lantern stall', x: -46, z: -246, goods: 'Paper lantern — rep +2', price: 15, rep: 2 },
  { id: 'fish', name: 'Fish stall', x: -30, z: -230, goods: 'Grilled fish — heal $12', price: 12, heal: 30 },
  { id: 'tea', name: 'Tea stall', x: -46, z: -214, goods: 'Harbour tea — stamina full', price: 8, stamina: 100 },
  { id: 'trinkets', name: 'Trinket stall', x: -62, z: -214, goods: 'Lucky charm — notoriety -5', price: 20, notoriety: -5 },
  { id: 'records', name: 'Record stall', x: -30, z: -246, goods: 'Vinyl — new radio track', price: 25, track: 'night-drive' },
];

export function stallById(id) {
  return NIGHT_MARKET_STALLS.find((s) => s.id === id) || null;
}

export function stallNear(x, z, maxDist) {
  let best = null;
  let bestD = maxDist || 5;
  for (const s of NIGHT_MARKET_STALLS) {
    const d = dist(x, z, s.x, s.z);
    if (d < bestD) { bestD = d; best = s; }
  }
  return best;
}

export function buyFromStall(stall, player) {
  if (!stall) return { ok: false, reason: 'no stall' };
  if (player.cash < stall.price) return { ok: false, reason: 'not enough cash' };
  player.cash -= stall.price;
  if (stall.heal) player.health = clamp(player.health + stall.heal, 0, 100);
  if (stall.rep) player.rep += stall.rep;
  if (stall.stamina) player.stamina = stall.stamina;
  return { ok: true, stall, cash: player.cash };
}

export const DOCK_PROPS = [
  { id: 'crane-1', kind: 'crane', x: 400, z: 92, h: 42 },
  { id: 'crane-2', kind: 'crane', x: 400, z: 184, h: 38 },
  { id: 'container-a', kind: 'container', x: 368, z: 92, color: 0xc22e2e },
  { id: 'container-b', kind: 'container', x: 368, z: 108, color: 0x2e7a8a },
  { id: 'container-c', kind: 'container', x: 368, z: 124, color: 0xf2c200 },
  { id: 'container-d', kind: 'container', x: 414, z: 92, color: 0x4a7a4a },
];

export const FOUNDRY_PROPS = [
  { id: 'furnace-1', kind: 'furnace', x: -368, z: -368, h: 26 },
  { id: 'furnace-2', kind: 'furnace', x: -322, z: -368, h: 22 },
  { id: 'chimney', kind: 'chimney', x: -414, z: -368, h: 48 },
  { id: 'silo', kind: 'silo', x: -368, z: -322, h: 30 },
];

export function propsNear(list, x, z, maxDist) {
  return list.filter((p) => dist(x, z, p.x, p.z) < maxDist);
}

export function harbourDetails() {
  return {
    districts: R7_DISTRICTS.length,
    interiors: INTERIORS.length,
    stalls: NIGHT_MARKET_STALLS.length,
    dockProps: DOCK_PROPS.length,
    foundryProps: FOUNDRY_PROPS.length,
  };
}
