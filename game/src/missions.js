// Ember Harbor — missions. Eight story jobs for Vex Marlowe, plus the
// side economy (taxi fares, hidden packages, chop shop). Each mission is a
// small state machine over checkpoints: the game feeds it the player's
// position, car and combat events, and it answers with objectives, rewards
// and completion. Pure logic — the renderer only reads the returned state.

import { ECONOMY } from './config.js';
import { clamp, dist } from './utils.js';
import { EXTRA_MISSION_DEFS } from './missions-extra.js';

// The full story: the first eight jobs plus the six r6 jobs. Keeping the
// base list literal below and appending the extras keeps the merge visible
// in one place — and the tests count all fourteen.
export const BASE_MISSION_DEFS = [
  {
    id: 'first-drop', name: 'First Drop', giver: 'Mara at the Pier',
    brief: 'Three parcels, three doorsteps, one hour on the clock. Run them before the harbour fog rolls in.',
    reward: 220, steps: [
      { kind: 'goto', label: 'Drop the parcel at Old Market Hall', x: -46, z: -322 },
      { kind: 'goto', label: 'Drop the parcel at Harborview Tower', x: 322, z: -46 },
      { kind: 'goto', label: 'Drop the parcel at South Pier', x: 0, z: 414 },
    ],
    timeLimit: 240,
  },
  {
    id: 'hot-wheels', name: 'Hot Wheels', giver: 'Rusty Wrench',
    brief: 'A Falcon GT is parked by the Strip. Take it — quietly — and bring it to the chop shop in one piece.',
    reward: 420, steps: [
      { kind: 'steal', label: 'Steal the Falcon GT on the Strip', x: 46, z: 46, carModel: 'coupe' },
      { kind: 'deliver-car', label: 'Deliver it to the Rusty Wrench chop shop', x: -368, z: 322 },
    ],
    timeLimit: 300,
  },
  {
    id: 'street-circuit', name: 'Street Circuit', giver: 'The Strip regulars',
    brief: 'Three laps of the harbour loop. Beat the pace car through every gate — no shortcuts, the crowd is watching.',
    reward: 500, steps: [
      { kind: 'race', label: 'Race the harbour loop — pass every gate', x: 0, z: 0, laps: 3 },
    ],
    timeLimit: 420,
  },
  {
    id: 'payback', name: 'Payback', giver: 'Mara at the Pier',
    brief: 'The Dockside crew jumped one of ours. Four of them are hanging around the docks. Settle it.',
    reward: 480, steps: [
      { kind: 'eliminate', label: 'Deal with the Dockside crew (4)', x: -368, z: 46, count: 4 },
      { kind: 'goto', label: 'Report back to Mara at the Pier', x: 0, z: 414 },
    ],
    timeLimit: 360,
  },
  {
    id: 'heat-wave', name: 'Heat Wave', giver: 'A burner phone',
    brief: 'The PD is already on you. Lose them — stay out of sight for 60 seconds, or reach the safehouse.',
    reward: 550, steps: [
      { kind: 'escape', label: 'Lose the police — stay clean for 60s', x: 322, z: 322, survive: 60 },
    ],
    timeLimit: 240,
  },
  {
    id: 'night-shift', name: 'Night Shift', giver: 'Harbor Cab dispatch',
    brief: 'Drive the cab. Three fares, three corners of the city. Tips if you are fast, complaints if you are not.',
    reward: 380, steps: [
      { kind: 'taxi', label: 'Pick up fares and drop them off (3)', x: 46, z: 46, count: 3 },
    ],
    timeLimit: 420,
  },
  {
    id: 'smash-grab', name: 'Smash & Grab', giver: 'Rusty Wrench',
    brief: 'Hit the Harbor Trust Bank vault courier outside the bank, grab the case, and vanish before the sirens close in.',
    reward: 700, steps: [
      { kind: 'grab', label: 'Grab the courier case at the bank', x: 46, z: -46 },
      { kind: 'escape', label: 'Lose the heat — reach the safehouse', x: 322, z: 322, survive: 45 },
    ],
    timeLimit: 300,
  },
  {
    id: 'the-big-one', name: 'The Big One', giver: 'Mara at the Pier',
    brief: 'The ferry payroll crosses the pier at midnight. Get a fast car, take the case, lose the whole harbour PD, and bring it home.',
    reward: 1500, steps: [
      { kind: 'steal', label: 'Steal a fast car (any coupe or better)', x: 138, z: 138, carModel: 'coupe' },
      { kind: 'grab', label: 'Take the payroll case at the Ferry Terminal', x: 414, z: 230 },
      { kind: 'escape', label: 'Lose the police and reach the safehouse', x: 322, z: 322, survive: 75 },
    ],
    timeLimit: 600,
  },
];

export const MISSION_DEFS = [...BASE_MISSION_DEFS, ...EXTRA_MISSION_DEFS];
export const MISSION_COUNT = MISSION_DEFS.length;

export function missionDef(id) {
  return MISSION_DEFS.find((m) => m.id === id) || null;
}

export function createMissionState() {
  return {
    activeId: null,
    stepIndex: 0,
    timer: 0,
    timeLeft: 0,
    completed: [],
    failed: [],
    race: null,
    taxi: null,
    escapeTimer: 0,
    kills: 0,
    delivered: 0,
    // r6: new step mechanics — tailing, turf defence, stealth and speed.
    tailTimer: 0,
    defendTimer: 0,
    bonusEarned: 0,
    spotted: false,
    stepStartedAt: 0,
  };
}

export function startMission(state, id) {
  const def = missionDef(id);
  if (!def || state.activeId) return false;
  if (state.completed.includes(id)) return false;
  state.activeId = id;
  state.stepIndex = 0;
  state.timer = 0;
  state.timeLeft = def.timeLimit;
  state.race = null;
  state.taxi = null;
  state.escapeTimer = 0;
  state.tailTimer = 0;
  state.defendTimer = 0;
  state.bonusEarned = 0;
  state.spotted = false;
  state.kills = 0;
  state.delivered = 0;
  state.stepStartedAt = 0;
  return true;
}

export function currentStep(state) {
  const def = state.activeId ? missionDef(state.activeId) : null;
  if (!def) return null;
  return def.steps[state.stepIndex] || null;
}

export function missionProgress(state) {
  const def = state.activeId ? missionDef(state.activeId) : null;
  if (!def) return null;
  const step = currentStep(state);
  return {
    id: def.id, name: def.name, giver: def.giver, brief: def.brief,
    reward: def.reward, stepIndex: state.stepIndex, stepsTotal: def.steps.length,
    step: step ? step.label : 'Done',
    stepKind: step ? step.kind : null,
    stepX: step ? step.x : 0, stepZ: step ? step.z : 0,
    timeLeft: Math.max(0, Math.ceil(state.timeLeft)),
    kills: state.kills, delivered: state.delivered,
    race: state.race, taxi: state.taxi,
    // r6 progress for the new step kinds, so the HUD can show a live bar.
    tailTimer: Math.round(state.tailTimer || 0),
    defendTimer: Math.round(state.defendTimer || 0),
    bonusEarned: state.bonusEarned || 0,
    spotted: !!state.spotted,
    totalMissions: MISSION_DEFS.length,
  };
}

function advanceStep(state) {
  state.stepIndex += 1;
  state.escapeTimer = 0;
  state.tailTimer = 0;
  state.defendTimer = 0;
  state.spotted = false;
  state.stepStartedAt = state.timer;
  const def = missionDef(state.activeId);
  if (state.stepIndex >= def.steps.length) {
    const reward = def.reward + (state.bonusEarned || 0);
    state.completed.push(state.activeId);
    state.activeId = null;
    state.stepIndex = 0;
    return { done: true, reward, id: def.id, name: def.name, bonus: state.bonusEarned || 0 };
  }
  return { done: false, advanced: true };
}

function failMission(state, reason) {
  const def = missionDef(state.activeId);
  state.failed.push(state.activeId);
  state.activeId = null;
  state.stepIndex = 0;
  state.race = null;
  state.taxi = null;
  return { failed: true, reason, id: def ? def.id : null };
}

// ctx: {x, z, inCar, carModel, wantedStars, killed, deliveredCar, grabbed,
//       raceGatesPassed, taxiDone, dt, now}
// Returns an event object or null.
export function updateMission(state, ctx) {
  if (!state.activeId) return null;
  const def = missionDef(state.activeId);
  const step = currentStep(state);
  if (!step) return null;
  state.timer += ctx.dt;
  state.timeLeft -= ctx.dt;
  if (state.timeLeft <= 0) return failMission(state, 'Out of time');

  if (ctx.killed) state.kills += ctx.killed;
  if (step.kind === 'goto') {
    if (dist(ctx.x, ctx.z, step.x, step.z) < 9) {
      const r = advanceStep(state);
      return r.done ? { type: 'complete', ...r } : { type: 'step', label: step.label };
    }
  } else if (step.kind === 'steal') {
    if (ctx.inCar && ctx.carModel === step.carModel) {
      const r = advanceStep(state);
      return r.done ? { type: 'complete', ...r } : { type: 'step', label: step.label };
    }
  } else if (step.kind === 'deliver-car') {
    if (ctx.inCar && ctx.deliveredCar && dist(ctx.x, ctx.z, step.x, step.z) < 12) {
      const r = advanceStep(state);
      return r.done ? { type: 'complete', ...r } : { type: 'step', label: step.label };
    }
  } else if (step.kind === 'eliminate') {
    if (state.kills >= step.count) {
      const r = advanceStep(state);
      return r.done ? { type: 'complete', ...r } : { type: 'step', label: step.label };
    }
  } else if (step.kind === 'grab') {
    if (ctx.grabbed) {
      const r = advanceStep(state);
      return r.done ? { type: 'complete', ...r } : { type: 'step', label: step.label };
    }
  } else if (step.kind === 'taxi') {
    if (ctx.taxiDone) {
      state.delivered += ctx.taxiDone;
      if (state.delivered >= step.count) {
        const r = advanceStep(state);
        return r.done ? { type: 'complete', ...r } : { type: 'step', label: step.label };
      }
      return { type: 'fare', delivered: state.delivered };
    }
  } else if (step.kind === 'race') {
    if (ctx.raceGatesPassed) {
      state.race = state.race || { gates: 0, laps: 0 };
      state.race.gates += ctx.raceGatesPassed;
      const gatesPerLap = 6;
      state.race.laps = Math.floor(state.race.gates / gatesPerLap);
      if (state.race.laps >= step.laps) {
        const r = advanceStep(state);
        return r.done ? { type: 'complete', ...r } : { type: 'step', label: step.label };
      }
    }
  } else if (step.kind === 'escape') {
    const safe = ctx.wantedStars === 0 || dist(ctx.x, ctx.z, step.x, step.z) < 12;
    if (safe) {
      state.escapeTimer += ctx.dt;
      if (state.escapeTimer >= step.survive) {
        const r = advanceStep(state);
        return r.done ? { type: 'complete', ...r } : { type: 'step', label: step.label };
      }
    } else {
      state.escapeTimer = Math.max(0, state.escapeTimer - ctx.dt * 0.5);
    }
  } else if (step.kind === 'flyto') {
    // Reach the point — in the helicopter if the step says so, on foot
    // or in a car otherwise. The caller passes inHeli when airborne.
    const needHeli = step.heli !== false && (ctx.inHeli || dist(ctx.x, ctx.z, step.x, step.z) < 12);
    if (ctx.inHeli ? dist(ctx.x, ctx.z, step.x, step.z) < 14 : dist(ctx.x, ctx.z, step.x, step.z) < 12) {
      const r = advanceStep(state);
      return r.done ? { type: 'complete', ...r } : { type: 'step', label: step.label };
    }
    void needHeli;
  } else if (step.kind === 'timed-goto') {
    // A timed drop: reach the point fast and bank the step bonus. Slow
    // drops still count, but the bonus is only paid when the step's own
    // par time is beaten — the caller passes stepTimeLeft via ctx.
    if (dist(ctx.x, ctx.z, step.x, step.z) < 9) {
      const stepTime = state.timer - state.stepStartedAt;
      const par = step.par || 45;
      if (stepTime <= par && step.bonus) state.bonusEarned += step.bonus;
      const r = advanceStep(state);
      return r.done ? { type: 'complete', ...r } : { type: 'step', label: step.label, bonus: step.bonus };
    }
  } else if (step.kind === 'stealth') {
    // Any heat at all blows the job — the moment the PD notices you,
    // the mission fails. Arrive clean and the step advances.
    if ((ctx.wantedStars || 0) > 0) {
      state.spotted = true;
      return failMission(state, 'Spotted — the PD noticed you');
    }
    if (dist(ctx.x, ctx.z, step.x, step.z) < 9) {
      const r = advanceStep(state);
      return r.done ? { type: 'complete', ...r } : { type: 'step', label: step.label };
    }
  } else if (step.kind === 'defend') {
    // Hold the ground: survive the timer while the wave count is met.
    // Kills feed state.kills; the timer only runs while the player is
    // near the turf point, so running away does not count.
    const near = dist(ctx.x, ctx.z, step.x, step.z) < 30;
    if (near) state.defendTimer += ctx.dt;
    if (state.defendTimer >= (step.survive || 60) && state.kills >= (step.count || 0)) {
      const r = advanceStep(state);
      return r.done ? { type: 'complete', ...r } : { type: 'step', label: step.label };
    }
    if (state.defendTimer >= (step.survive || 60) && state.kills < (step.count || 0)) {
      return failMission(state, 'The turf was overrun');
    }
  } else if (step.kind === 'tail') {
    // Stay in the 8–30 m band behind the target: too close and they
    // spot you, too far and you lose them. ctx.tailDist is the distance
    // to the moving target, fed by main.js every frame.
    const d = ctx.tailDist;
    if (d == null) {
      // No target in range yet — hold position, do not fail.
    } else if (d < 8) {
      state.tailTimer = Math.max(0, state.tailTimer - ctx.dt * 2);
      state.spotted = true;
      if (state.tailTimer <= 0 && state.timer - state.stepStartedAt > 10) {
        // Spotted only fails after the player crowds the target twice.
        if (ctx.tailSpotted) return failMission(state, 'Spotted — you got too close');
      }
    } else if (d <= 30) {
      state.tailTimer += ctx.dt;
      if (state.tailTimer >= (step.tailTime || 45)) {
        const r = advanceStep(state);
        return r.done ? { type: 'complete', ...r } : { type: 'step', label: step.label };
      }
    } else {
      state.tailTimer = Math.max(0, state.tailTimer - ctx.dt);
    }
  }
  return null;
}

export function abortMission(state) {
  if (!state.activeId) return false;
  state.failed.push(state.activeId);
  state.activeId = null;
  state.stepIndex = 0;
  state.race = null;
  state.taxi = null;
  state.tailTimer = 0;
  state.defendTimer = 0;
  state.bonusEarned = 0;
  state.spotted = false;
  return true;
}

export function nextAvailableMission(state) {
  for (const def of MISSION_DEFS) {
    if (!state.completed.includes(def.id) && state.activeId !== def.id) return def;
  }
  return null;
}

export function totalEarned(state) {
  return state.completed.reduce((sum, id) => sum + (missionDef(id)?.reward || 0), 0);
}

// --- Side economy ---------------------------------------------------------

export function createSideState(city) {
  return {
    packages: city.packages.map((p) => ({ ...p })),
    packagesFound: 0,
    packagesTotal: city.packages.length,
    faresDone: 0,
    fare: null,
    chopCooldown: 0,
    chopSales: 0,
    // r6: VIP fares pay triple but hate bumps; vigilante + event money
    // is tracked here so the HUD can show one side-income total.
    vipFaresDone: 0,
    sideEarned: 0,
  };
}

export function checkPackagePickup(side, x, z) {
  for (const p of side.packages) {
    if (!p.taken && dist(x, z, p.x, p.z) < 3.5) {
      p.taken = true;
      side.packagesFound += 1;
      return { id: p.id, bonus: ECONOMY.packageBonus, total: side.packagesFound };
    }
  }
  return null;
}

export function startFare(side, rng, city) {
  const stands = city.taxiStands;
  const from = stands[Math.floor(rng() * stands.length)];
  const to = { x: (Math.floor(rng() * 9) - 4) * 92, z: (Math.floor(rng() * 9) - 4) * 92 };
  side.fare = { fromX: from.x, fromZ: from.z, toX: to.x, toZ: to.z, pickedUp: false, tip: 0 };
  return side.fare;
}

export function updateFare(side, x, z, inCar) {
  const fare = side.fare;
  if (!fare) return null;
  if (!fare.pickedUp) {
    if (inCar && dist(x, z, fare.fromX, fare.fromZ) < 10) {
      fare.pickedUp = true;
      return { type: 'picked-up' };
    }
  } else if (dist(x, z, fare.toX, fare.toZ) < 10) {
    side.fare = null;
    side.faresDone += 1;
    const pay = ECONOMY.taxiFare + fare.tip;
    return { type: 'delivered', pay, fares: side.faresDone };
  }
  return null;
}
