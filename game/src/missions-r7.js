// Ember Harbor — r7 missions, part three. Eight more jobs (total 22)
// that use the r7 systems: the ferry gambit (boat + heli), the last ferry
// (finale choice), harbour king (own the docks), the night-market courier,
// the ambulance hero, the street-race championship, the bounty hunter,
// and the fishing charter. These defs live apart from MISSION_DEFS so
// the base 14 stay untouched; main.js offers them after the story arc
// reaches Act III, and the HUD shows them in the same mission card.

import { clamp, dist } from './utils.js';

export const R7_MISSION_DEFS = [
  {
    id: 'r7-ferry-gambit', name: 'Ferry Gambit', giver: 'Ibrahim Hale (FIB)',
    brief: 'Sal\'s last ferry leaves at dawn with the gold. Take the boat, board it mid-harbour, and bring the manifest back — alive.',
    reward: 1400, chapter: 'seven-stars', steps: [
      { kind: 'boat-deliver', label: 'Take the boat from South Pier dock', x: 470, z: 414 },
      { kind: 'goto', label: 'Board the ferry mid-harbour', x: 520, z: 230 },
      { kind: 'grab', label: 'Take the payroll manifest', x: 520, z: 230 },
      { kind: 'escape', label: 'Lose the harbour patrol — reach the Pier', x: 0, z: 414, survive: 45 },
    ],
    timeLimit: 480,
  },
  {
    id: 'r7-last-ferry', name: 'The Last Ferry', giver: 'Mara at the Pier',
    brief: 'One last ferry, one last choice. Escort Mara\'s people to the ferry while Sal\'s crew closes in — hold the dock until it sails.',
    reward: 1800, chapter: 'the-last-ferry', steps: [
      { kind: 'escort', label: 'Escort Mara\'s people to the Ferry Terminal', x: 414, z: 230, count: 3 },
      { kind: 'defend', label: 'Hold the dock — survive 90 seconds', x: 414, z: 230, survive: 90, count: 4 },
      { kind: 'goto', label: 'Watch the ferry sail — report to the Pier', x: 0, z: 414 },
    ],
    timeLimit: 420,
  },
  {
    id: 'r7-harbor-king', name: 'Harbor King', giver: 'Juno Park',
    brief: 'The finale. Take Warehouse 9, the casino floor and the docks in one night — and the harbour is yours.',
    reward: 2500, chapter: 'the-last-ferry', steps: [
      { kind: 'goto', label: 'Take Warehouse 9 in Foundry Row', x: -368, z: -368 },
      { kind: 'stealth', label: 'Walk the casino floor — no heat', x: 230, z: -138 },
      { kind: 'goto', label: 'Raise your flag at the Docks', x: 414, z: 138 },
    ],
    timeLimit: 600,
  },
  {
    id: 'r7-market-courier', name: 'Market Courier', giver: 'Juno Park',
    brief: 'Five hot parcels through the night market, lanterns lit, stalls open. Fast drops pay double — the crowd is watching.',
    reward: 700, chapter: 'market-lights', steps: [
      { kind: 'timed-goto', label: 'Drop 1: Noodle stall', x: -62, z: -230, bonus: 60 },
      { kind: 'timed-goto', label: 'Drop 2: Tea house', x: -46, z: -214, bonus: 60 },
      { kind: 'timed-goto', label: 'Drop 3: Lantern stall', x: -46, z: -246, bonus: 60 },
      { kind: 'timed-goto', label: 'Drop 4: Fish stall', x: -30, z: -230, bonus: 60 },
      { kind: 'timed-goto', label: 'Drop 5: Juno\'s stage', x: -46, z: -230, bonus: 120 },
    ],
    timeLimit: 300,
  },
  {
    id: 'r7-ambulance-hero', name: 'Ambulance Hero', giver: 'Doc Anselm',
    brief: 'Three patients across the city, one ambulance, no time to waste. Drive like their lives depend on it — they do.',
    reward: 900, chapter: 'the-pier-debt', steps: [
      { kind: 'taxi', label: 'Rush patients to St. Anselm (3)', x: -322, z: 138, count: 3 },
    ],
    timeLimit: 420,
  },
  {
    id: 'r7-street-champion', name: 'Street Champion', giver: 'The Strip regulars',
    brief: 'Five races, one leaderboard, winner takes the Strip. Beat the pace car through every gate — and do not lose a single race.',
    reward: 1200, chapter: 'neon-mile', steps: [
      { kind: 'race', label: 'Win the championship — 5 laps of the harbour loop', x: 0, z: 0, laps: 5 },
    ],
    timeLimit: 600,
  },
  {
    id: 'r7-bounty-hunter', name: 'Bounty Hunter', giver: 'Harbor PD bounty board',
    brief: 'Four names on the board, four bounties. Bring them in — alive pays double, and the city will remember your name.',
    reward: 1500, chapter: 'the-ledger', steps: [
      { kind: 'eliminate', label: 'Take down the bounty targets (4)', x: -368, z: 46, count: 4 },
      { kind: 'goto', label: 'Collect at the bounty board, South Pier', x: 0, z: 414 },
    ],
    timeLimit: 480,
  },
  {
    id: 'r7-fishing-charter', name: 'Fishing Charter', giver: 'Old Man Ferry',
    brief: 'Take the tourists out on the boat, show them the harbour at dawn, and bring them home before the storm rolls in.',
    reward: 500, chapter: 'homecoming', steps: [
      { kind: 'boat-deliver', label: 'Board the charter boat at the Marina', x: 470, z: 0 },
      { kind: 'goto', label: 'Show them the harbour lighthouse point', x: 520, z: -322 },
      { kind: 'goto', label: 'Bring the tourists home to the Marina', x: 470, z: 0 },
    ],
    timeLimit: 420,
  },
];

export function r7MissionDef(id) {
  return R7_MISSION_DEFS.find((m) => m.id === id) || null;
}

export function r7MissionIds() {
  return R7_MISSION_DEFS.map((m) => m.id);
}

export function totalR7Rewards() {
  return R7_MISSION_DEFS.reduce((sum, m) => sum + m.reward, 0);
}

export function createR7MissionState() {
  return {
    activeId: null,
    stepIndex: 0,
    timer: 0,
    timeLeft: 0,
    completed: [],
    failed: [],
    kills: 0,
    delivered: 0,
    escapeTimer: 0,
    bonusEarned: 0,
    spotted: false,
    stepStartedAt: 0,
    race: null,
  };
}

export function startR7Mission(state, id) {
  const def = r7MissionDef(id);
  if (!def || state.activeId) return false;
  if (state.completed.includes(id)) return false;
  state.activeId = id;
  state.stepIndex = 0;
  state.timer = 0;
  state.timeLeft = def.timeLimit;
  state.kills = 0;
  state.delivered = 0;
  state.escapeTimer = 0;
  state.bonusEarned = 0;
  state.spotted = false;
  state.stepStartedAt = 0;
  state.race = null;
  return true;
}

export function r7CurrentStep(state) {
  const def = state.activeId ? r7MissionDef(state.activeId) : null;
  if (!def) return null;
  return def.steps[state.stepIndex] || null;
}

export function r7MissionProgress(state) {
  const def = state.activeId ? r7MissionDef(state.activeId) : null;
  if (!def) return null;
  const step = r7CurrentStep(state);
  return {
    id: def.id, name: def.name, giver: def.giver, brief: def.brief,
    reward: def.reward, chapter: def.chapter,
    stepIndex: state.stepIndex, stepsTotal: def.steps.length,
    step: step ? step.label : 'Done',
    stepKind: step ? step.kind : null,
    stepX: step ? step.x : 0, stepZ: step ? step.z : 0,
    timeLeft: Math.max(0, Math.ceil(state.timeLeft)),
    kills: state.kills, delivered: state.delivered,
    bonusEarned: state.bonusEarned || 0,
    totalMissions: 22,
    r7: true,
  };
}

function r7Advance(state) {
  state.stepIndex += 1;
  state.escapeTimer = 0;
  state.spotted = false;
  state.stepStartedAt = state.timer;
  const def = r7MissionDef(state.activeId);
  if (state.stepIndex >= def.steps.length) {
    const reward = def.reward + (state.bonusEarned || 0);
    state.completed.push(state.activeId);
    state.activeId = null;
    state.stepIndex = 0;
    return { done: true, reward, id: def.id, name: def.name, bonus: state.bonusEarned || 0 };
  }
  return { done: false, advanced: true };
}

function r7Fail(state, reason) {
  const def = r7MissionDef(state.activeId);
  state.failed.push(state.activeId);
  state.activeId = null;
  state.stepIndex = 0;
  return { failed: true, reason, id: def ? def.id : null };
}

// ctx mirrors updateMission's ctx, plus inBoat and escortCount.
export function updateR7Mission(state, ctx) {
  if (!state.activeId) return null;
  const def = r7MissionDef(state.activeId);
  const step = r7CurrentStep(state);
  if (!step) return null;
  state.timer += ctx.dt;
  state.timeLeft -= ctx.dt;
  if (state.timeLeft <= 0) return r7Fail(state, 'Out of time');
  if (ctx.killed) state.kills += ctx.killed;
  if (step.kind === 'goto') {
    if (dist(ctx.x, ctx.z, step.x, step.z) < 9) {
      const r = r7Advance(state);
      return r.done ? { type: 'complete', ...r } : { type: 'step', label: step.label };
    }
  } else if (step.kind === 'grab') {
    if (ctx.grabbed) {
      const r = r7Advance(state);
      return r.done ? { type: 'complete', ...r } : { type: 'step', label: step.label };
    }
  } else if (step.kind === 'stealth') {
    if ((ctx.wantedStars || 0) > 0) {
      state.spotted = true;
      return r7Fail(state, 'Spotted — the PD noticed you');
    }
    if (dist(ctx.x, ctx.z, step.x, step.z) < 9) {
      const r = r7Advance(state);
      return r.done ? { type: 'complete', ...r } : { type: 'step', label: step.label };
    }
  } else if (step.kind === 'escape') {
    const safe = ctx.wantedStars === 0 || dist(ctx.x, ctx.z, step.x, step.z) < 12;
    if (safe) {
      state.escapeTimer += ctx.dt;
      if (state.escapeTimer >= step.survive) {
        const r = r7Advance(state);
        return r.done ? { type: 'complete', ...r } : { type: 'step', label: step.label };
      }
    } else {
      state.escapeTimer = Math.max(0, state.escapeTimer - ctx.dt * 0.5);
    }
  } else if (step.kind === 'boat-deliver') {
    // Reach the dock — in the boat if the step is a boarding step, on
    // foot otherwise. The caller passes inBoat when sailing.
    if (dist(ctx.x, ctx.z, step.x, step.z) < 12) {
      const r = r7Advance(state);
      return r.done ? { type: 'complete', ...r } : { type: 'step', label: step.label };
    }
  } else if (step.kind === 'escort') {
    // Escort: the caller reports each person delivered via ctx.escorted.
    if (ctx.escorted) state.delivered += ctx.escorted;
    if (state.delivered >= (step.count || 1) || dist(ctx.x, ctx.z, step.x, step.z) < 9) {
      const r = r7Advance(state);
      return r.done ? { type: 'complete', ...r } : { type: 'step', label: step.label };
    }
  } else if (step.kind === 'defend') {
    const near = dist(ctx.x, ctx.z, step.x, step.z) < 30;
    if (near) state.escapeTimer += ctx.dt;
    if (state.escapeTimer >= (step.survive || 60) && state.kills >= (step.count || 0)) {
      const r = r7Advance(state);
      return r.done ? { type: 'complete', ...r } : { type: 'step', label: step.label };
    }
    if (state.escapeTimer >= (step.survive || 60) && state.kills < (step.count || 0)) {
      return r7Fail(state, 'The dock was overrun');
    }
  } else if (step.kind === 'timed-goto') {
    if (dist(ctx.x, ctx.z, step.x, step.z) < 9) {
      const stepTime = state.timer - state.stepStartedAt;
      const par = step.par || 45;
      if (stepTime <= par && step.bonus) state.bonusEarned += step.bonus;
      const r = r7Advance(state);
      return r.done ? { type: 'complete', ...r } : { type: 'step', label: step.label, bonus: step.bonus };
    }
  } else if (step.kind === 'taxi') {
    if (ctx.taxiDone) {
      state.delivered += ctx.taxiDone;
      if (state.delivered >= step.count) {
        const r = r7Advance(state);
        return r.done ? { type: 'complete', ...r } : { type: 'step', label: step.label };
      }
      return { type: 'fare', delivered: state.delivered };
    }
  } else if (step.kind === 'race') {
    if (ctx.raceGatesPassed) {
      state.race = state.race || { gates: 0, laps: 0 };
      state.race.gates += ctx.raceGatesPassed;
      state.race.laps = Math.floor(state.race.gates / 6);
      if (state.race.laps >= step.laps) {
        const r = r7Advance(state);
        return r.done ? { type: 'complete', ...r } : { type: 'step', label: step.label };
      }
    }
  } else if (step.kind === 'eliminate') {
    if (state.kills >= step.count) {
      const r = r7Advance(state);
      return r.done ? { type: 'complete', ...r } : { type: 'step', label: step.label };
    }
  }
  return null;
}

export function abortR7Mission(state) {
  if (!state.activeId) return false;
  state.failed.push(state.activeId);
  state.activeId = null;
  state.stepIndex = 0;
  return true;
}

export function nextR7Mission(state) {
  for (const def of R7_MISSION_DEFS) {
    if (!state.completed.includes(def.id) && state.activeId !== def.id) return def;
  }
  return null;
}

export function totalR7Earned(state) {
  return state.completed.reduce((sum, id) => sum + (r7MissionDef(id)?.reward || 0), 0);
}

export function allMissionsTotal() {
  return 22;
}

export function r7ChapterOrder() {
  return R7_MISSION_DEFS.map((m) => ({ id: m.id, name: m.name, chapter: m.chapter }));
}
