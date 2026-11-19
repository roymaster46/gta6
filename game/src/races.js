// races.js — Solmarina Street Circuit: illegal street racing.
// Three circuits on the city's own road grid, each with an entry fee, a
// pace rival to beat, lap timing, best times and cash + REP prizes.
// A race starts at a checkered start pad (press T in a car, near the pad)
// and only while no story mission is running — the same rule as side jobs,
// so the race never fights a mission over the objective banner. The rival
// is a pace car that runs the loop at a fixed speed: beat its finish time
// and you take 1st and the full prize; finish behind it and you take 2nd
// and a quarter of the prize. Beating your best time on a circuit pays a
// $100 bonus. The Coastal Grand Prix only opens once you have won the
// Downtown Loop — the street scene makes you earn the big race.
import { dist, clamp, angleTo, fmtMoney } from './utils.js';
import { makeCar, carHealth, CAR_MODELS } from './vehicles.js';

// Checkpoints sit on road centrelines and every leg between consecutive
// checkpoints runs along a road, so the loop is always drivable without
// cutting through buildings. The closing leg returns to the start pad.
export const RACE_CIRCUITS = [
  {
    id: 'marina',
    name: 'Marina Sprint',
    blurb: 'A tight rectangle along the marina — learn the corners here.',
    start: { x: 450, y: 150 },
    checkpoints: [
      { x: 450, y: 150 }, { x: 1050, y: 150 },
      { x: 1050, y: 450 }, { x: 450, y: 450 },
    ],
    laps: 2,
    entry: 50,
    prize: 300,
    rep: 40,
    rivalLap: 28, // seconds per lap for the pace rival
    requires: null,
  },
  {
    id: 'downtown',
    name: 'Downtown Loop',
    blurb: 'Six corners through the glass towers — the scene’s home turf.',
    start: { x: 750, y: 750 },
    checkpoints: [
      { x: 750, y: 750 }, { x: 1350, y: 750 },
      { x: 1350, y: 1050 }, { x: 1350, y: 1350 },
      { x: 750, y: 1350 }, { x: 750, y: 1050 },
    ],
    laps: 2,
    entry: 100,
    prize: 650,
    rep: 60,
    rivalLap: 40,
    requires: null,
  },
  {
    id: 'coastal',
    name: 'Coastal Grand Prix',
    blurb: 'The full tour: marina to port to beach. Win Downtown to enter.',
    start: { x: 150, y: 150 },
    checkpoints: [
      { x: 150, y: 150 }, { x: 1050, y: 150 },
      { x: 1950, y: 150 }, { x: 1950, y: 750 },
      { x: 1950, y: 1650 }, { x: 1950, y: 1950 },
      { x: 1050, y: 1950 }, { x: 450, y: 1950 },
      { x: 150, y: 1950 }, { x: 150, y: 1050 },
    ],
    laps: 2,
    entry: 200,
    prize: 1500,
    rep: 100,
    rivalLap: 100,
    requires: 'downtown',
  },
];

export const RACE_START_RADIUS = 130; // how close to a pad to enter (T)
export const RACE_GATE_RADIUS = 55;   // how close to a gate to clear it
export const RACE_TIMEOUT = 600;      // seconds before a race is a DNF
export const RACE_BEST_BONUS = 100;   // cash bonus for beating your best

export function circuitById(id) {
  return RACE_CIRCUITS.find((c) => c.id === id) || null;
}

// Total loop length: every leg plus the closing leg back to the start pad.
export function circuitLength(circuit) {
  const cps = circuit.checkpoints;
  let total = 0;
  for (let i = 0; i < cps.length; i++) {
    const a = cps[i], b = cps[(i + 1) % cps.length];
    total += dist(a.x, a.y, b.x, b.y);
  }
  return total;
}

// Pace-rival speed: loop length divided by the rival's lap time.
export function rivalSpeed(circuit) {
  return circuitLength(circuit) / circuit.rivalLap;
}

// The rival's target finish time for the whole race (all laps).
export function rivalFinishTime(circuit) {
  return circuit.rivalLap * circuit.laps;
}

// Point on the loop at distance d from the start pad, plus the direction
// of travel there and how many checkpoint gates lie behind that point.
export function loopPointAt(circuit, d) {
  const cps = circuit.checkpoints;
  const total = circuitLength(circuit);
  let dd = ((d % total) + total) % total;
  let passed = 0;
  for (let i = 0; i < cps.length; i++) {
    const a = cps[i], b = cps[(i + 1) % cps.length];
    const leg = dist(a.x, a.y, b.x, b.y);
    if (dd <= leg) {
      const t = leg === 0 ? 0 : dd / leg;
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        angle: angleTo(a.x, a.y, b.x, b.y),
        // Gates cleared beyond the start pad: gate 0 is cleared by
        // starting there, so a rival still on leg 0 has cleared none and
        // one sitting exactly on gate i has cleared i gates.
        checkpointsPassed: passed + (dd >= leg ? 1 : 0),
      };
    }
    dd -= leg;
    passed++;
  }
  const last = cps[cps.length - 1];
  return { x: last.x, y: last.y, angle: 0, checkpointsPassed: cps.length };
}

// Race clock: "1:23.4" — minutes, seconds, tenths. Tenths truncate (a
// race timer shows elapsed time, it never rounds up), but a 1e-6 epsilon
// absorbs float dust: 42.3s must print .3, not .2, while 65.25s stays .2.
export function formatRaceTime(sec) {
  const totalTenths = Math.floor(sec * 10 + 1e-6);
  const m = Math.floor(totalTenths / 600);
  const s = Math.floor((totalTenths % 600) / 10);
  const tenth = totalTenths % 10;
  return `${m}:${String(s).padStart(2, '0')}.${tenth}`;
}

export function createRaceState() {
  return {
    active: null,   // {circuit, lap, nextIndex, totalPassed, time, countdown,
                    //  rivalDist, rivalFinishAt, rivalCar, started}
    results: null,  // {circuitId, name, time, place, prize, newBest} — shown ~6s
    resultsTimer: 0,
    best: {},       // circuitId -> best total time in seconds
    wins: {},       // circuitId -> wins
    racesDone: 0,
    racesWon: 0,
    cooldown: 0,
  };
}

// Street-circuit championship: a season-long ladder across the three
// circuits. A win is 10 points, a 2nd place is 4, every finish is 1 — so
// grinding the Marina Sprint still moves the needle, but the Grand Prix
// is where the season is won. The pause menu shows the ladder.
export const SERIES_POINTS = { win: 10, second: 4, finish: 1 };
export function seriesPoints(state) {
  // Per-circuit points come from the per-circuit win table; the season
  // total also counts the global win/finish counters (wins are 10, every
  // other finish is 1), so a season total never depends on which circuit
  // the wins happened on.
  const perCircuit = {};
  for (const c of RACE_CIRCUITS) {
    perCircuit[c.id] = (state.wins[c.id] || 0) * SERIES_POINTS.win;
  }
  const wins = state.racesWon || 0;
  const done = state.racesDone || 0;
  const total = wins * SERIES_POINTS.win + Math.max(0, done - wins) * SERIES_POINTS.finish;
  return { total, perCircuit, wins, done };
}
export function seriesRank(state) {
  const { total } = seriesPoints(state);
  if (total >= 100) return 'Street Legend';
  if (total >= 50) return 'Circuit Pro';
  if (total >= 20) return 'Regular';
  if (total >= 1) return 'Rookie';
  return 'Unranked';
}

// Nearest start pad to the player (within entry range), or null.
export function nearestRaceStart(game) {
  const p = game.player;
  let best = null, bestD = Infinity;
  for (const c of RACE_CIRCUITS) {
    const d = dist(p.x, p.y, c.start.x, c.start.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  if (!best || bestD > RACE_START_RADIUS) return null;
  return { circuit: best, dist: bestD };
}

export function circuitUnlocked(state, circuit) {
  if (!circuit.requires) return true;
  return (state.wins[circuit.requires] || 0) > 0;
}

// Why a race cannot start right now (null when it can). The T key calls
// this first so the player always gets a reason instead of silence.
export function raceStartBlocker(game, circuit) {
  const rs = game.races;
  if (!rs) return 'Racing is not available right now.';
  if (rs.active) return 'A race is already running — press T to quit it.';
  if (rs.cooldown > 0) return 'The street circuit is cooling off — give it a moment.';
  if (game.missions && game.missions.stage === 'active') return 'Finish the mission first — no racing mid-job.';
  if (!game.player.inCar || !game.player.car) return 'You need a car to race — steal one first.';
  if (!circuitUnlocked(rs, circuit)) {
    const req = circuitById(circuit.requires);
    return `The ${circuit.name} needs a win on the ${req ? req.name : circuit.requires} first.`;
  }
  if (game.player.money < circuit.entry) return `Entry is ${fmtMoney(circuit.entry)} — you have ${fmtMoney(game.player.money)}.`;
  return null;
}

// Start a race at the given circuit: deduct the entry fee, spawn the pace
// rival behind the player on the start pad and hold both cars for the
// 3-2-1-GO countdown. Returns a message for the HUD toast.
export function startRace(game, circuitId) {
  const circuit = circuitById(circuitId);
  if (!circuit) return 'Unknown circuit.';
  const blocker = raceStartBlocker(game, circuit);
  if (blocker) return blocker;
  const p = game.player;
  p.money -= circuit.entry;
  const rivalCar = makeCar(circuit.start.x, circuit.start.y + 46, -Math.PI / 2, {
    kind: 'rival', driver: 'rival', color: '#e8c832',
    model: CAR_MODELS.find((m) => m.name === 'Marina GT'),
    label: 'RIVAL',
  });
  rivalCar.speed = 0;
  game.cars.push(rivalCar);
  game.races.active = {
    circuit,
    lap: 1,
    nextIndex: 1, // gate 0 is the start pad Leo is already sitting on
    totalPassed: 0,
    time: 0,
    countdown: 3.2,
    rivalDist: 0,
    rivalFinishAt: null,
    rivalCar,
    started: false,
  };
  game.missions.message = `${circuit.name} — entry ${fmtMoney(circuit.entry)} paid. Get ready…`;
  game.missions.messageTimer = 3;
  return null;
}

// Quit the current race (T mid-race, wrecked car, timeout, left the car).
// The entry fee is gone — street racing does not do refunds.
export function abandonRace(game, reason) {
  const rs = game.races;
  if (!rs || !rs.active) return;
  const active = rs.active;
  if (active.rivalCar) game.cars = game.cars.filter((c) => c !== active.rivalCar);
  rs.active = null;
  rs.cooldown = 8;
  rs.racesDone++;
  game.player.stats.racesDone = (game.player.stats.racesDone || 0) + 1;
  game.missions.message = `Race over — ${reason} (entry fee lost)`;
  game.missions.messageTimer = 4;
  game.events.push({ type: 'missionFail' });
  if (typeof game.save === 'function') game.save();
}

// Who is ahead: compare checkpoints cleared, then distance to the next
// gate. Returns '1st' or '2nd'.
export function racePosition(game) {
  const a = game.races && game.races.active;
  if (!a) return null;
  const p = game.player;
  const next = a.circuit.checkpoints[a.nextIndex];
  // Gate 0 (the start pad) counts as cleared the moment the race starts —
  // that is why nextIndex begins at 1 — so the player's cleared count is
  // totalPassed + 1, matching the rival's loopPointAt count.
  const playerScore = (a.totalPassed + 1) * 10000 - dist(p.x, p.y, next.x, next.y);
  const rp = loopPointAt(a.circuit, a.rivalDist);
  // The rival cleared gate 0 by starting there too, so its score counts
  // the start gate as well; its next gate is one past the gates it cleared.
  const rivalNext = a.circuit.checkpoints[(rp.checkpointsPassed + 1) % a.circuit.checkpoints.length];
  const rivalScore = (rp.checkpointsPassed + 1) * 10000 - dist(a.rivalCar.x, a.rivalCar.y, rivalNext.x, rivalNext.y);
  return playerScore >= rivalScore ? '1st' : '2nd';
}

function finishRace(game, won) {
  const rs = game.races;
  const a = rs.active;
  const circuit = a.circuit;
  const p = game.player;
  const time = a.time;
  const prevBest = rs.best[circuit.id];
  const newBest = prevBest === undefined || time < prevBest;
  if (newBest) rs.best[circuit.id] = time;
  const prize = won ? circuit.prize : Math.round(circuit.prize * 0.25);
  const bonus = newBest ? RACE_BEST_BONUS : 0;
  p.money += prize + bonus;
  p.stats.racesDone = (p.stats.racesDone || 0) + 1;
  if (won) {
    p.stats.racesWon = (p.stats.racesWon || 0) + 1;
    rs.wins[circuit.id] = (rs.wins[circuit.id] || 0) + 1;
    rs.racesWon++;
    p.stats.rep = (p.stats.rep || 0) + circuit.rep;
  } else {
    p.stats.rep = (p.stats.rep || 0) + Math.round(circuit.rep / 2);
  }
  rs.racesDone++;
  if (a.rivalCar) game.cars = game.cars.filter((c) => c !== a.rivalCar);
  rs.active = null;
  rs.cooldown = 8;
  rs.results = {
    circuitId: circuit.id, name: circuit.name, time,
    place: won ? 1 : 2, prize: prize + bonus, newBest,
  };
  rs.resultsTimer = 6;
  game.missions.message = won
    ? `${circuit.name} — 1st place! +${fmtMoney(prize + bonus)}${newBest ? ' (NEW BEST!)' : ''}`
    : `${circuit.name} — 2nd place. +${fmtMoney(prize + bonus)}${newBest ? ' (NEW BEST!)' : ''}`;
  game.missions.messageTimer = 5;
  game.events.push({ type: won ? 'missionDone' : 'cash' });
  if (typeof game.save === 'function') game.save();
}

export function updateRaces(game, dt) {
  const rs = game.races;
  if (!rs) return;
  rs.cooldown = Math.max(0, rs.cooldown - dt);
  if (rs.resultsTimer > 0) {
    rs.resultsTimer -= dt;
    if (rs.resultsTimer <= 0) rs.results = null;
  }
  const a = rs.active;
  if (!a) return;
  const p = game.player;
  // The race ends if Leo leaves the car or the car is wrecked.
  if (!p.inCar || !p.car) { abandonRace(game, 'you left the car'); return; }
  if (carHealth(p.car) <= 0) { abandonRace(game, 'your car was wrecked'); return; }
  if (a.countdown > 0) {
    // Hold both cars on the line for the 3-2-1-GO.
    a.countdown -= dt;
    p.car.speed = 0;
    a.rivalCar.speed = 0;
    if (a.countdown <= 0) {
      a.started = true;
      game.missions.message = 'GO! Beat the rival to the finish!';
      game.missions.messageTimer = 2;
      game.events.push({ type: 'siren' });
    }
    return;
  }
  a.time += dt;
  // Pace rival: runs the loop at a fixed speed, gate to gate.
  const speed = rivalSpeed(a.circuit);
  a.rivalDist += speed * dt;
  const rp = loopPointAt(a.circuit, a.rivalDist);
  a.rivalCar.x = rp.x;
  a.rivalCar.y = rp.y;
  a.rivalCar.angle = rp.angle;
  a.rivalCar.speed = speed;
  if (a.rivalFinishAt === null && a.rivalDist >= circuitLength(a.circuit) * a.circuit.laps) {
    a.rivalFinishAt = a.time;
  }
  // Gate check: drive through the next gate to clear it.
  const next = a.circuit.checkpoints[a.nextIndex];
  if (dist(p.x, p.y, next.x, next.y) < RACE_GATE_RADIUS) {
    a.totalPassed++;
    const wasStartGate = a.nextIndex === 0;
    a.nextIndex = (a.nextIndex + 1) % a.circuit.checkpoints.length;
    if (wasStartGate) a.lap++;
    game.floaters.push({
      x: p.x, y: p.y - 40,
      text: wasStartGate ? `LAP ${Math.min(a.lap, a.circuit.laps)}/${a.circuit.laps}` : `GATE ${a.totalPassed}/${a.circuit.laps * a.circuit.checkpoints.length}`,
      color: '#e8c832', life: 1.2, maxLife: 1.2,
    });
    game.events.push({ type: 'pickup' });
    if (a.totalPassed >= a.circuit.laps * a.circuit.checkpoints.length) {
      const won = a.rivalFinishAt === null;
      finishRace(game, won);
      return;
    }
  }
  if (a.time > RACE_TIMEOUT) abandonRace(game, 'time ran out');
}

// Objective banner line while a race runs (null when there is none).
export function raceObjectiveText(game) {
  const a = game.races && game.races.active;
  if (!a) return null;
  if (a.countdown > 0) {
    const n = Math.ceil(a.countdown);
    return `${a.circuit.name}: ${n > 3 ? 'READY…' : n + '…'}`;
  }
  const next = a.circuit.checkpoints[a.nextIndex];
  return `${a.circuit.name} — Lap ${Math.min(a.lap, a.circuit.laps)}/${a.circuit.laps} — Gate ${a.totalPassed + 1}/${a.circuit.laps * a.circuit.checkpoints.length} — ${formatRaceTime(a.time)} — ${racePosition(game)}`;
}

// World-map target for the active race: the next gate (null when idle).
export function raceTarget(game) {
  const a = game.races && game.races.active;
  if (!a) return null;
  const next = a.circuit.checkpoints[a.nextIndex];
  return { x: next.x, y: next.y, label: `GATE ${a.nextIndex + 1}`, color: '#e8c832' };
}

// Best time on a circuit, formatted, or '—' when never raced.
export function bestTimeText(state, circuitId) {
  const b = state && state.best ? state.best[circuitId] : undefined;
  return b === undefined ? '—' : formatRaceTime(b);
}
