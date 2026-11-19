// Ember Harbor — ambient city events. The city is not a backdrop: while
// the player works, the streets keep living. Robberies, police chases,
// street races, ambulances and brawls spawn on a timer, play out on their
// own, and pay the player for intervening. Pure logic — the renderer draws
// markers, main.js feeds the player position and combat events.

import { clamp, dist, rngInt, rngPick, rngRange } from './utils.js';

export const EVENT_KINDS = [
  { kind: 'robbery', label: 'Robbery in progress', reward: 150, duration: 75 },
  { kind: 'police-chase', label: 'Police chase', reward: 120, duration: 90 },
  { kind: 'street-race', label: 'Street race', reward: 200, duration: 120 },
  { kind: 'ambulance', label: 'Ambulance crossing town', reward: 0, duration: 60 },
  { kind: 'brawl', label: 'Street brawl', reward: 100, duration: 60 },
  { kind: 'vip-escort', label: 'VIP escort', reward: 250, duration: 100 },
];

export function eventDef(kind) {
  return EVENT_KINDS.find((e) => e.kind === kind) || null;
}

export function createEventState() {
  return {
    active: [],
    completed: 0,
    earned: 0,
    spawnTimer: 45,
    seen: [],
    nextId: 1,
  };
}

export function eventSpawnInterval() {
  return 55;
}

// Pick a street corner for the next event, away from the player so events
// feel discovered rather than staged on top of them.
export function pickEventSpot(rng, player) {
  for (let tries = 0; tries < 12; tries += 1) {
    const x = (rngInt(rng, -4, 4)) * 92;
    const z = (rngInt(rng, -4, 4)) * 92;
    if (dist(x, z, player.x, player.z) > 90) return { x, z };
  }
  return { x: player.x + 120, z: player.z };
}

export function spawnEvent(state, rng, player, kind) {
  const def = eventDef(kind || rngPick(rng, EVENT_KINDS.map((e) => e.kind)));
  if (!def) return null;
  if (state.active.length >= 2) return null;
  const spot = pickEventSpot(rng, player);
  const ev = {
    id: state.nextId,
    kind: def.kind,
    label: def.label,
    reward: def.reward,
    x: spot.x, z: spot.z,
    timer: def.duration,
    progress: 0,
    done: false,
    // Per-kind actors the caller moves: racers, a robber, a fleeing car.
    actorX: spot.x + 6, actorZ: spot.z,
    actorHeading: rngRange(rng, 0, Math.PI * 2),
    actorSpeed: def.kind === 'street-race' ? 24 : def.kind === 'police-chase' ? 26 : 0,
    chaserX: spot.x - 10, chaserZ: spot.z - 6,
    targetHealth: def.kind === 'brawl' ? 100 : 0,
  };
  state.nextId += 1;
  state.active.push(ev);
  return ev;
}

export function activeEvent(state, kind) {
  return state.active.find((e) => e.kind === kind) || null;
}

// Advance every live event. Robbers run from the player, racers loop the
// block, the chased car flees down the grid. Returns event notifications.
export function updateEvents(state, player, dt, rng) {
  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    state.spawnTimer = eventSpawnInterval() + rng() * 30;
    spawnEvent(state, rng, player);
  }
  const notes = [];
  for (let i = state.active.length - 1; i >= 0; i -= 1) {
    const ev = state.active[i];
    ev.timer -= dt;
    if (ev.kind === 'robbery') {
      const d = dist(ev.actorX, ev.actorZ, player.x, player.z);
      if (d < 40) {
        const away = Math.atan2(ev.actorX - player.x, ev.actorZ - player.z);
        ev.actorHeading = away;
        ev.actorX += Math.sin(away) * 6.2 * dt;
        ev.actorZ += Math.cos(away) * 6.2 * dt;
      }
    } else if (ev.kind === 'street-race' || ev.kind === 'police-chase') {
      ev.actorHeading += 0.25 * dt;
      ev.actorX += Math.sin(ev.actorHeading) * ev.actorSpeed * dt;
      ev.actorZ += Math.cos(ev.actorHeading) * ev.actorSpeed * dt;
      ev.actorX = clamp(ev.actorX, -440, 440);
      ev.actorZ = clamp(ev.actorZ, -440, 440);
      if (ev.kind === 'police-chase') {
        const chaseHeading = Math.atan2(ev.actorX - ev.chaserX, ev.actorZ - ev.chaserZ);
        ev.chaserX += Math.sin(chaseHeading) * 28 * dt;
        ev.chaserZ += Math.cos(chaseHeading) * 28 * dt;
      }
    } else if (ev.kind === 'ambulance') {
      ev.actorX += Math.sin(ev.actorHeading) * 16 * dt;
      ev.actorZ += Math.cos(ev.actorHeading) * 16 * dt;
    } else if (ev.kind === 'brawl') {
      ev.actorX += Math.sin(ev.actorHeading + Math.sin(ev.timer) * 2) * 1.2 * dt;
      ev.actorZ += Math.cos(ev.actorHeading) * 1.2 * dt;
    } else if (ev.kind === 'vip-escort') {
      ev.actorX += Math.sin(ev.actorHeading) * 9 * dt;
      ev.actorZ += Math.cos(ev.actorHeading) * 9 * dt;
    }
    if (ev.timer <= 0) {
      ev.done = true;
      state.active.splice(i, 1);
      notes.push({ type: 'event-expired', kind: ev.kind, label: ev.label });
    }
  }
  return notes;
}

// The player intervened: catching the robber, stopping the brawl, or
// winning the street race. Pays the event reward and closes the event.
export function resolveEvent(state, eventId, how) {
  const idx = state.active.findIndex((e) => e.id === eventId);
  if (idx === -1) return null;
  const ev = state.active[idx];
  state.active.splice(idx, 1);
  state.completed += 1;
  state.earned += ev.reward;
  state.seen.push(ev.kind);
  return { type: 'event-resolved', kind: ev.kind, label: ev.label, how, reward: ev.reward, completed: state.completed };
}

// A street race is won by passing the racer's car three times: the caller
// reports each overtake.
export function raceOvertake(state, eventId) {
  const ev = state.active.find((e) => e.id === eventId);
  if (!ev || ev.kind !== 'street-race') return null;
  ev.progress += 1;
  if (ev.progress >= 3) return resolveEvent(state, eventId, 'won the street race');
  return { type: 'race-progress', progress: ev.progress, needed: 3 };
}

export function nearestEvent(state, x, z, maxDist) {
  let best = null;
  let bestD = maxDist || Infinity;
  for (const ev of state.active) {
    const d = dist(x, z, ev.actorX, ev.actorZ);
    if (d < bestD) { bestD = d; best = ev; }
  }
  return best ? { event: best, dist: bestD } : null;
}

export function eventsSummary(state) {
  return {
    active: state.active.map((e) => ({ kind: e.kind, label: e.label, x: Math.round(e.x), z: Math.round(e.z) })),
    completed: state.completed,
    earned: state.earned,
    seenKinds: [...new Set(state.seen)],
  };
}

// Pedestrian variety: every ped gets an archetype that changes how they
// move and look, so the sidewalks stop feeling like clones.
export const PED_ARCHETYPES = [
  { id: 'commuter', label: 'Commuter', speed: 1.6, idleChance: 0.35, color: 0x7a9ab8 },
  { id: 'jogger', label: 'Jogger', speed: 3.4, idleChance: 0.05, color: 0xd84a2f },
  { id: 'vendor', label: 'Street vendor', speed: 0.7, idleChance: 0.8, color: 0xc9a86a },
  { id: 'tourist', label: 'Tourist', speed: 1.1, idleChance: 0.6, color: 0x8ab87a },
  { id: 'dockworker', label: 'Dockworker', speed: 1.9, idleChance: 0.2, color: 0x6a8a8a },
  { id: 'student', label: 'Student', speed: 2.2, idleChance: 0.3, color: 0x9a8ab8 },
];

export function pedArchetype(id) {
  return PED_ARCHETYPES.find((a) => a.id === id) || PED_ARCHETYPES[0];
}

export function randomArchetype(rng) {
  return rngPick(rng, PED_ARCHETYPES);
}

export function archetypeSpeed(archetypeId) {
  return pedArchetype(archetypeId).speed;
}

// r7: the city after dark — parade, harbour fire, market concert,
// dock protest and a boat race on the water. These are the big events:
// they draw crowds, close streets, and pay more than a street brawl.
export const R7_EVENT_KINDS = [
  { kind: 'parade', label: 'Harbour parade', reward: 200, duration: 120 },
  { kind: 'harbour-fire', label: 'Warehouse fire', reward: 300, duration: 90 },
  { kind: 'concert', label: 'Night-market concert', reward: 180, duration: 150 },
  { kind: 'protest', label: 'Dock protest', reward: 150, duration: 100 },
  { kind: 'boat-race', label: 'Harbour boat race', reward: 350, duration: 120 },
];

export function r7EventDef(kind) {
  return R7_EVENT_KINDS.find((e) => e.kind === kind) || null;
}

export function spawnR7Event(state, rng, player, kind) {
  const def = r7EventDef(kind || R7_EVENT_KINDS[Math.floor(rng() * R7_EVENT_KINDS.length)].kind);
  if (!def) return null;
  if (state.active.length >= 3) return null;
  const spot = pickEventSpot(rng, player);
  const ev = {
    id: state.nextId, kind: def.kind, label: def.label, reward: def.reward,
    x: spot.x, z: spot.z, timer: def.duration, progress: 0, done: false,
    actorX: spot.x + 6, actorZ: spot.z, actorHeading: 0, actorSpeed: 12,
    chaserX: spot.x - 10, chaserZ: spot.z - 6, targetHealth: 0, r7: true,
  };
  state.nextId += 1;
  state.active.push(ev);
  return ev;
}

export function r7EventsSummary(state) {
  return state.active.filter((e) => e.r7).map((e) => ({ kind: e.kind, label: e.label }));
}
