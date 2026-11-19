// Ember Harbor — r7 crowds. Pedestrians are no longer lone walkers:
// they gather in groups, queue at stalls, cross streets together at
// crossings, and panic as a crowd when gunfire starts — a fleeing crowd
// blocks a street, draws cops, and makes a shootout feel like a shootout.
// Pure AI: groups have a leader, a destination and a mood; individuals
// follow, scatter, or freeze. main.js feeds threats (gunfire, crashes,
// wanted stars) and the renderer draws the crowd as peds.

import { clamp, createRng, dist, rngInt, rngPick, rngRange, wrapAngle } from './utils.js';

export const CROWD_MOODS = ['calm', 'busy', 'panicked', 'celebrating', 'queuing'];
export const CROWD_TYPES = [
  { id: 'market', label: 'Market crowd', size: [6, 12], speed: 1.1, hangout: 'night-market' },
  { id: 'commuters', label: 'Commuter rush', size: [5, 9], speed: 1.9, hangout: 'ferry' },
  { id: 'tourists', label: 'Tourist group', size: [4, 7], speed: 1.0, hangout: 'pier' },
  { id: 'fans', label: 'Stadium fans', size: [8, 14], speed: 2.0, hangout: 'stadium' },
  { id: 'nightlife', label: 'Nightlife crowd', size: [5, 10], speed: 1.3, hangout: 'casino' },
  { id: 'dockers', label: 'Dock workers', size: [4, 8], speed: 1.7, hangout: 'dockside' },
];

export function crowdTypeById(id) {
  return CROWD_TYPES.find((t) => t.id === id) || null;
}

export const CROSSINGS = [
  { x: 0, z: 0 }, { x: 92, z: 92 }, { x: -92, z: -92 }, { x: 184, z: 0 },
  { x: 0, z: 184 }, { x: -184, z: 92 }, { x: 92, z: -184 }, { x: -276, z: -92 },
];

export function nearestCrossing(x, z) {
  let best = null;
  let bestD = Infinity;
  for (const c of CROSSINGS) {
    const d = dist(x, z, c.x, c.z);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best ? { crossing: best, dist: bestD } : null;
}

export function createCrowdState() {
  return {
    groups: [],
    nextId: 1,
    panics: 0,
    crossingsUsed: 0,
    totalSpawned: 0,
    spawnTimer: 20,
  };
}

export function spawnCrowdGroup(state, rng, player, typeId) {
  const type = crowdTypeById(typeId || rngPick(rng, CROWD_TYPES.map((t) => t.id)));
  if (!type) return null;
  const size = rngInt(rng, type.size[0], type.size[1]);
  // Spawn on a street corner away from the player so crowds are found,
  // not staged on top of the player.
  let gx = 0;
  let gz = 0;
  for (let tries = 0; tries < 10; tries += 1) {
    gx = (rngInt(rng, -4, 4)) * 92;
    gz = (rngInt(rng, -4, 4)) * 92;
    if (dist(gx, gz, player.x, player.z) > 80) break;
  }
  const group = {
    id: state.nextId,
    type: type.id,
    label: type.label,
    x: gx, z: gz,
    heading: rngRange(rng, 0, Math.PI * 2),
    destX: (rngInt(rng, -4, 4)) * 92,
    destZ: (rngInt(rng, -4, 4)) * 92,
    mood: 'calm',
    moodTimer: 20 + rng() * 30,
    speed: type.speed,
    members: [],
    panicTimer: 0,
  };
  state.nextId += 1;
  for (let i = 0; i < size; i += 1) {
    group.members.push({
      x: gx + rngRange(rng, -4, 4),
      z: gz + rngRange(rng, -4, 4),
      heading: rngRange(rng, 0, Math.PI * 2),
      speed: type.speed * rngRange(rng, 0.85, 1.15),
      offsetX: rngRange(rng, -3, 3),
      offsetZ: rngRange(rng, -3, 3),
      state: 'walk',
      stateTimer: rngRange(rng, 1, 5),
      dead: false,
      archetype: rngPick(rng, ['commuter', 'tourist', 'student', 'dockworker', 'vendor']),
      color: rngPick(rng, [0xd8b48a, 0x7a9ab8, 0xb87a7a, 0x8ab87a, 0xc9a86a]),
    });
  }
  state.groups.push(group);
  state.totalSpawned += size;
  return group;
}

export function panicCrowd(state, x, z, radius) {
  let panicked = 0;
  for (const g of state.groups) {
    if (dist(g.x, g.z, x, z) < (radius || 40)) {
      if (g.mood !== 'panicked') state.panics += 1;
      g.mood = 'panicked';
      g.panicTimer = 6;
      g.moodTimer = 6;
      panicked += g.members.length;
      for (const m of g.members) {
        m.state = 'flee';
        const away = Math.atan2(m.x - x, m.z - z);
        m.heading = away;
      }
    }
  }
  return panicked;
}

export function calmCrowd(state, dt) {
  for (const g of state.groups) {
    if (g.mood === 'panicked') {
      g.panicTimer -= dt;
      if (g.panicTimer <= 0) {
        g.mood = 'calm';
        for (const m of g.members) m.state = 'walk';
      }
    }
  }
}

export function updateCrowdGroup(group, dt, threats, rng) {
  group.moodTimer -= dt;
  if (group.mood === 'calm' && group.moodTimer <= 0) {
    group.mood = rng() < 0.5 ? 'busy' : 'calm';
    group.moodTimer = 15 + rng() * 25;
    // Pick a new destination: the crowd drifts across town together.
    group.destX = (Math.floor(rng() * 9) - 4) * 92;
    group.destZ = (Math.floor(rng() * 9) - 4) * 92;
  }
  const dDest = dist(group.x, group.z, group.destX, group.destZ);
  if (dDest < 6 && group.mood !== 'panicked') {
    group.destX = (Math.floor(rng() * 9) - 4) * 92;
    group.destZ = (Math.floor(rng() * 9) - 4) * 92;
  }
  const speed = group.mood === 'panicked' ? 4.8 : group.speed;
  const target = Math.atan2(group.destX - group.x, group.destZ - group.z);
  if (group.mood === 'panicked') {
    // Panic runs away from the nearest threat, not toward the destination.
    const threat = (threats || [])[0];
    if (threat) {
      const away = Math.atan2(group.x - threat.x, group.z - threat.z);
      group.heading = away;
    }
  } else {
    group.heading += clamp(wrapAngle(target - group.heading), -3 * dt, 3 * dt);
  }
  group.x += Math.sin(group.heading) * speed * dt;
  group.z += Math.cos(group.heading) * speed * dt;
  group.x = clamp(group.x, -452, 452);
  group.z = clamp(group.z, -452, 452);
  for (const m of group.members) {
    if (m.dead) continue;
    if (m.state === 'flee') {
      m.x += Math.sin(m.heading) * 4.6 * dt;
      m.z += Math.cos(m.heading) * 4.6 * dt;
    } else {
      // Members trail the leader with their own offset, like a real group.
      const tx = group.x + m.offsetX;
      const tz = group.z + m.offsetZ;
      const d = dist(m.x, m.z, tx, tz);
      if (d > 0.4) {
        const h = Math.atan2(tx - m.x, tz - m.z);
        m.heading = h;
        m.x += Math.sin(h) * m.speed * dt;
        m.z += Math.cos(h) * m.speed * dt;
      }
    }
    m.x = clamp(m.x, -452, 452);
    m.z = clamp(m.z, -452, 452);
  }
  return group;
}

export function updateCrowds(state, player, dt, rng, threats) {
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0 && state.groups.length < 5) {
    state.spawnTimer = 35 + rng() * 30;
    spawnCrowdGroup(state, rng, player);
  }
  for (let i = state.groups.length - 1; i >= 0; i -= 1) {
    const g = state.groups[i];
    updateCrowdGroup(g, dt, threats, rng);
    // A group that wandered far from everything dissolves back into the city.
    if (dist(g.x, g.z, player.x, player.z) > 420 && g.mood !== 'panicked') {
      state.groups.splice(i, 1);
    }
  }
  calmCrowd(state, dt);
  return state.groups.length;
}

export function crowdNear(state, x, z, maxDist) {
  let best = null;
  let bestD = maxDist || Infinity;
  for (const g of state.groups) {
    const d = dist(x, z, g.x, g.z);
    if (d < bestD) { bestD = d; best = g; }
  }
  return best ? { group: best, dist: bestD } : null;
}

export function crowdPeds(state) {
  const out = [];
  for (const g of state.groups) {
    for (const m of g.members) out.push({ ...m, groupId: g.id, groupMood: g.mood, groupLabel: g.label });
  }
  return out;
}

export function crowdCount(state) {
  return state.groups.reduce((n, g) => n + g.members.length, 0);
}

export function crowdMoodSummary(state) {
  const counts = {};
  for (const g of state.groups) counts[g.mood] = (counts[g.mood] || 0) + 1;
  return { groups: state.groups.length, peds: crowdCount(state), moods: counts, panics: state.panics };
}

// Pedestrians crossing a street: they wait for a gap in traffic, then
// cross in a loose line. Returns true when the crossing is in progress.
export function startCrossing(ped, crossing, trafficCars) {
  const gap = trafficCars.every((c) => dist(c.x, c.z, crossing.x, crossing.z) > 14);
  if (!gap) return false;
  ped.state = 'crossing';
  ped.crossTarget = { x: crossing.x + (ped.x > crossing.x ? -16 : 16), z: crossing.z };
  ped.stateTimer = 6;
  return true;
}

export function updateCrossingPed(ped, dt) {
  if (ped.state !== 'crossing' || !ped.crossTarget) return ped;
  const d = dist(ped.x, ped.z, ped.crossTarget.x, ped.crossTarget.z);
  if (d < 1) {
    ped.state = 'walk';
    ped.crossTarget = null;
    return ped;
  }
  const h = Math.atan2(ped.crossTarget.x - ped.x, ped.crossTarget.z - ped.z);
  ped.heading = h;
  ped.x += Math.sin(h) * ped.speed * 1.4 * dt;
  ped.z += Math.cos(h) * ped.speed * 1.4 * dt;
  ped.stateTimer -= dt;
  if (ped.stateTimer <= 0) ped.state = 'walk';
  return ped;
}

export function queueAtStall(state, stallX, stallZ, count, rng) {
  const members = [];
  for (let i = 0; i < count; i += 1) {
    members.push({
      x: stallX + rngRange(rng, -2, 2),
      z: stallZ + 3 + i * 1.4,
      heading: Math.PI,
      speed: 0.7,
      state: 'idle',
      stateTimer: 8 + i * 2,
      dead: false,
      archetype: 'tourist',
      color: 0xc9a86a,
    });
  }
  return { x: stallX, z: stallZ, queue: members, label: 'Stall queue' };
}

export function crowdPanicRadius(wantedStars) {
  return 26 + wantedStars * 6;
}
