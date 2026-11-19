// Ember Harbor — r7 side jobs. The city pays for honest work too: taxi
// shifts with ratings, ambulance runs that save lives (and pay by the
// patient), a street-race series with a leaderboard, courier deliveries,
// and a bounty board with tiers. Each job is a small state machine with
// its own timer, payout curve and rating — the HUD shows the active job,
// the save file remembers your best runs.

import { clamp, dist, rngInt } from './utils.js';

export const SIDE_JOB_KINDS = [
  { id: 'taxi-shift', name: 'Taxi Shift', pay: 45, per: 'fare', desc: 'Drive fares across town. Tips for speed, complaints for bumps.' },
  { id: 'ambulance', name: 'Ambulance Run', pay: 120, per: 'patient', desc: 'Pick up the injured and race them to St. Anselm. Every second counts.' },
  { id: 'street-race-series', name: 'Street Race Series', pay: 300, per: 'win', desc: 'Five races, one leaderboard. Win the series, own the Strip.' },
  { id: 'courier', name: 'Courier Delivery', pay: 90, per: 'parcel', desc: 'Hot parcels, tight clocks. The harbour runs on couriers.' },
  { id: 'bounty-board', name: 'Bounty Board', pay: 250, per: 'bounty', desc: 'Wanted posters at the pier. Bring them in — alive pays double.' },
  { id: 'fishing', name: 'Fishing Charter', pay: 80, per: 'catch', desc: 'Take tourists out on the boat. Calm water, good tips.' },
];

export function sideJobById(id) {
  return SIDE_JOB_KINDS.find((j) => j.id === id) || null;
}

export function createSideJobsState() {
  return {
    active: null,
    done: {},
    earned: {},
    best: {},
    ratings: { taxi: 5.0, ambulance: 5.0 },
    raceWins: 0,
    raceLosses: 0,
    raceSeries: 0,
    totalEarned: 0,
    totalDone: 0,
    streak: 0,
    bestStreak: 0,
  };
}

export function startSideJob(state, kindId, rng, city) {
  if (state.active) return null;
  const def = sideJobById(kindId);
  if (!def) return null;
  const spots = [
    { x: 46, z: 46 }, { x: -322, z: 138 }, { x: 0, z: 414 }, { x: 230, z: -138 },
    { x: -138, z: 138 }, { x: 322, z: -46 }, { x: -368, z: 322 }, { x: 138, z: -322 },
  ];
  const from = spots[Math.floor(rng() * spots.length)];
  const to = spots[Math.floor(rng() * spots.length)];
  const job = {
    kind: kindId,
    name: def.name,
    fromX: from.x, fromZ: from.z,
    toX: to.x, toZ: to.z,
    pickedUp: false,
    timer: 0,
    timeLimit: kindId === 'ambulance' ? 150 : kindId === 'courier' ? 180 : 300,
    pay: def.pay,
    patients: kindId === 'ambulance' ? 1 : 0,
    progress: 0,
    needed: kindId === 'street-race-series' ? 5 : kindId === 'bounty-board' ? 1 : 3,
  };
  state.active = job;
  return job;
}

export function updateSideJob(state, ctx) {
  const job = state.active;
  if (!job) return null;
  job.timer += ctx.dt;
  if (job.timer > job.timeLimit) {
    state.active = null;
    state.streak = 0;
    return { type: 'sidejob-failed', kind: job.kind, reason: 'Out of time' };
  }
  if (!job.pickedUp) {
    if (dist(ctx.x, ctx.z, job.fromX, job.fromZ) < 10) {
      job.pickedUp = true;
      return { type: 'sidejob-pickup', kind: job.kind };
    }
    return null;
  }
  if (dist(ctx.x, ctx.z, job.toX, job.toZ) < 10) {
    job.progress += 1;
    const fast = job.timer < job.timeLimit * 0.5;
    let pay = job.pay + (fast ? 25 : 0);
    if (job.kind === 'ambulance') pay = 120 + (fast ? 60 : 0);
    if (job.kind === 'bounty-board') pay = 250;
    state.done[job.kind] = (state.done[job.kind] || 0) + 1;
    state.earned[job.kind] = (state.earned[job.kind] || 0) + pay;
    state.totalEarned += pay;
    state.totalDone += 1;
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    if (job.kind === 'taxi-shift') {
      state.ratings.taxi = clamp(state.ratings.taxi + (fast ? 0.1 : -0.05), 1, 5);
    }
    if (job.kind === 'ambulance') {
      state.ratings.ambulance = clamp(state.ratings.ambulance + (fast ? 0.15 : 0), 1, 5);
    }
    if (job.progress >= job.needed) {
      state.active = null;
      if (job.kind === 'street-race-series') state.raceWins += 1;
      return { type: 'sidejob-complete', kind: job.kind, pay, total: state.totalEarned, progress: job.progress };
    }
    // Chain the next leg: a new destination, same job.
    job.pickedUp = false;
    job.fromX = job.toX;
    job.fromZ = job.toZ;
    job.toX = (Math.floor(Math.random() * 9) - 4) * 92;
    job.toZ = (Math.floor(Math.random() * 9) - 4) * 92;
    return { type: 'sidejob-leg', kind: job.kind, pay, progress: job.progress, needed: job.needed };
  }
  return null;
}

export function abortSideJob(state) {
  if (!state.active) return false;
  state.active = null;
  state.streak = 0;
  return true;
}

export function taxiRating(state) {
  return Math.round(state.ratings.taxi * 10) / 10;
}

export function ambulanceRating(state) {
  return Math.round(state.ratings.ambulance * 10) / 10;
}

export function raceSeriesStanding(state) {
  const total = state.raceWins + state.raceLosses;
  return {
    wins: state.raceWins,
    losses: state.raceLosses,
    winRate: total ? Math.round((state.raceWins / total) * 100) : 0,
    series: state.raceSeries,
  };
}

export function recordRaceResult(state, won) {
  if (won) { state.raceWins += 1; state.raceSeries += 1; }
  else state.raceLosses += 1;
  return raceSeriesStanding(state);
}

export function sideJobsSummary(state) {
  return {
    active: state.active ? state.active.kind : null,
    totalDone: state.totalDone,
    totalEarned: state.totalEarned,
    streak: state.streak,
    bestStreak: state.bestStreak,
    taxiRating: taxiRating(state),
    ambulanceRating: ambulanceRating(state),
    races: raceSeriesStanding(state),
    byKind: { ...state.done },
  };
}

export function bestSideJobPay(state, kindId) {
  return state.earned[kindId] || 0;
}

export function sideJobTip(kindId, fast, carHealth) {
  if (kindId === 'taxi-shift') {
    if (carHealth < 60) return 0;
    return fast ? 25 : 10;
  }
  if (kindId === 'ambulance') return fast ? 60 : 20;
  if (kindId === 'courier') return fast ? 30 : 0;
  return 0;
}

export const BOUNTY_BOARD = [
  { id: 'bounty-1', name: 'Eddie "Knuckles" Marsh', crime: 'Dockside extortion', pay: 250, aliveBonus: 250, x: -368, z: 46 },
  { id: 'bounty-2', name: 'Lena Voss', crime: 'Casino cheating ring', pay: 300, aliveBonus: 300, x: 230, z: -138 },
  { id: 'bounty-3', name: 'Big Tommy Rourke', crime: 'Foundry arson', pay: 400, aliveBonus: 400, x: -322, z: -322 },
  { id: 'bounty-4', name: 'The Ghost of Pier 9', crime: 'Ferry payroll theft', pay: 600, aliveBonus: 600, x: 0, z: 414 },
];

export function bountyById(id) {
  return BOUNTY_BOARD.find((b) => b.id === id) || null;
}

export function nextBounty(doneIds) {
  return BOUNTY_BOARD.find((b) => !doneIds.includes(b.id)) || null;
}
