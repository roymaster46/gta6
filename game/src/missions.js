// missions.js — Solmarina story chain (12 missions) + repeatable taxi fares.
// Each mission has an id, title, briefing, objective text, a target point and
// a stage machine driven by updateMissions(game, dt). Completing one pays
// cash, advances the chain and saves progress. Missions 6-9 are timed: fail
// the clock and the job is lost, but the chain lets you retry it. Mission 7
// is a night job — starting it in daylight fast-forwards the clock to
// nightfall, then sends Leo across the city through three checkpoints under
// 5-star heat. Mission 8 runs the docks at the port; Mission 9 is the
// finale — steal the armored van and run a 5-star escape to the boat.
// Mission 10 is the epilogue: survive 90 seconds of 5-star heat and the
// city is yours.
import { dist, rand, fmtCountdown } from './utils.js';
import { LANDMARKS, randomRoadPoint } from './city.js';
import { makeCar, CAR_MODELS } from './vehicles.js';
import { addCrime } from './police.js';
import { advanceToNight, isNight } from './daynight.js';
import { cancelSideJobs, sideJobObjectiveText } from './sidejobs.js';

export const MISSION_DEFS = [
  {
    id: 1, title: 'First Fare', pay: 120,
    brief: 'A client at the marina needs a ride to the hospital. Grab any car and get them there — smooth driving earns a tip.',
    objective: 'Drive the client to Solmarina Hospital',
    sayer: 'Rico', role: 'Fixer', say: 'First fare’s easy, Leo. Don’t scratch the paint.',
  },
  {
    id: 2, title: 'Hot Wheels', pay: 250,
    brief: 'Rico needs a Marina GT, fast and no questions. Steal the marked car and deliver it to the Pay-n-Spray garage.',
    objective: 'Steal the marked Marina GT and deliver it to the garage',
    sayer: 'Rico', role: 'Fixer', say: 'I need a Marina GT. Fast, quiet, no questions.',
  },
  {
    id: 3, title: 'Beach Shootout', pay: 400,
    brief: 'The Vipers took over Playa Sol. Clear them off the beach — all five of them.',
    objective: 'Eliminate the Vipers on Playa Sol (0/5)',
    sayer: 'Rico', role: 'Fixer', say: 'The Vipers took the beach. Take it back.',
  },
  {
    id: 4, title: 'The Getaway', pay: 600,
    brief: 'A package is waiting at the port. Grab it — the cops will be on you the second you touch it. Lose them at the safehouse.',
    objective: 'Grab the package at the port, then escape to the safehouse',
    sayer: 'Rico', role: 'Fixer', say: 'Package at the port. Cops the second you touch it. Lose them.',
  },
  {
    id: 5, title: 'Solmarina Heist', pay: 1500,
    brief: 'The big one. Hit Solmarina Bank, grab the cash, and run a 5-star escape to the getaway boat at the port.',
    objective: 'Rob the bank, then escape to the getaway boat',
    sayer: 'Maya', role: 'Getaway Driver', say: 'Bank’s open, Leo. I’ll have the boat warm. Don’t be late.',
  },
  {
    id: 6, title: 'The Last Delivery', pay: 2500,
    brief: 'Rico’s final job: a package at the port, a buyer waiting on the yacht at the marina — and the whole PD already tipped off. Grab a fast car. You have 100 seconds.',
    objective: 'Grab the package at the port, deliver it to the yacht',
    sayer: 'Rico', role: 'Fixer', say: 'Last delivery. The whole PD is tipped off — drive like it.',
  },
  {
    id: 7, title: 'Midnight Run', pay: 3000,
    brief: 'A night job. One last package, three checkpoints across the city, and every cop in Solmarina on your tail. It only runs after dark — and you have 150 seconds.',
    objective: 'Hit all 3 checkpoints, then deliver to the safehouse',
    sayer: 'Maya', role: 'Getaway Driver', say: 'Three checkpoints, every cop in the city. Make it look easy.',
  },
  {
    id: 8, title: 'Harbor Lights', pay: 3500,
    brief: 'The port never sleeps. Grab the crate at the docks and run it to all three piers before the PD locks the harbor down — 120 seconds, and the heat is on from the first crate.',
    objective: 'Deliver the crate to all 3 piers',
    sayer: 'Rico', role: 'Fixer', say: 'The harbor never sleeps. Three piers, one crate, no mistakes.',
  },
  {
    id: 9, title: 'The Solmarina Job', pay: 5000,
    brief: 'The finale. Rico’s armored van is parked outside the bank, engine warm. Steal it, lose 5-star heat, and deliver it to the getaway boat at the port. You have 180 seconds.',
    objective: 'Steal the armored van and deliver it to the boat',
    sayer: 'Maya', role: 'Getaway Driver', say: 'The van’s the job, Leo. Bring it to the boat and we’re rich.',
  },
  {
    id: 10, title: 'King of Solmarina', pay: 6000,
    brief: 'The epilogue. Every cop in the city wants you tonight — 5 stars, no package, no destination. Stay free for 90 seconds and Solmarina is yours.',
    objective: 'Survive 90 seconds of 5-star heat',
    sayer: 'Rico', role: 'Fixer', say: 'Every cop in Solmarina wants you tonight. Stay free, kid.',
  },
  {
    id: 11, title: 'Double Cross', pay: 4500,
    brief: 'Rico smells a setup: a package at the port, a buyer who pays too well. Grab it — the Vipers will be waiting, and they hunt in packs. Deliver it to the safehouse in 150 seconds.',
    objective: 'Grab the package, outrun the Viper hunters, reach the safehouse',
    sayer: 'Rico', role: 'Fixer', say: 'Something’s off about this pickup. Keep your eyes open.',
  },
  {
    id: 12, title: 'The Last Sunset', pay: 8000,
    brief: 'The grand tour. Eight stops, one in each of eight districts — Marina, Yacht Basin, Market Square, Civic Center, University Quarter, Rose Gardens, Docklands, Coral Beach — and the whole city watching. 260 seconds, 3-star heat, one last sunset.',
    objective: 'Hit all 8 district checkpoints',
    sayer: 'Maya', role: 'Getaway Driver', say: 'One last sunset tour, Leo. Eight stops, then the city is ours.',
  },
];

// The three Midnight Run checkpoints, in order: park, bridge, beach.
export const MIDNIGHT_CHECKPOINTS = [
  { x: 1200, y: 1470, label: 'Checkpoint 1 — Palm Park' },
  { x: 1200, y: 150, label: 'Checkpoint 2 — Marina Bridge' },
  { x: 1200, y: 2250, label: 'Checkpoint 3 — Playa Sol' },
];

// The three Harbor Lights delivery piers, in order: north, middle, south.
export const HARBOR_DOCKS = [
  { x: 2280, y: 1800, label: 'Pier 1 — North Dock' },
  { x: 2280, y: 1900, label: 'Pier 2 — Middle Dock' },
  { x: 2280, y: 2000, label: 'Pier 3 — South Dock' },
];

// The eight Last Sunset tour stops, one per district across the new
// sixteen-district map: Marina, Yacht Basin, Market Square, Civic Center,
// University Quarter, Rose Gardens, Docklands, Coral Beach — a lap of the
// whole city, north edge to south beach, in one sunset.
export const GRAND_TOUR = [
  { x: 900, y: 150, label: 'Stop 1 — Marina Bridge' },
  { x: 1800, y: 150, label: 'Stop 2 — Yacht Basin' },
  { x: 375, y: 975, label: 'Stop 3 — Market Square' },
  { x: 1200, y: 975, label: 'Stop 4 — Civic Center' },
  { x: 2025, y: 975, label: 'Stop 5 — University Quarter' },
  { x: 900, y: 1500, label: 'Stop 6 — Rose Gardens' },
  { x: 1800, y: 1920, label: 'Stop 7 — Docklands' },
  { x: 1800, y: 2280, label: 'Stop 8 — Coral Beach' },
];

export function createMissionState() {
  return {
    current: 0,          // index into MISSION_DEFS (0-based); 12 = all done
    stage: 'idle',       // idle | active | done
    target: null,        // {x, y, label}
    progress: 0,
    needed: 0,
    timer: 0,
    timeLimit: 0,        // seconds; 0 = no limit (missions 1-5)
    message: '',
    messageTimer: 0,
    dialogue: null,      // {sayer, role, say} shown on the dialogue card
    dialogueTimer: 0,
    taxi: null,          // active taxi fare {pickup, dropoff, fare, passenger}
    taxiCooldown: 0,
    packageCarried: false,
    heistCash: 0,
    checkpoints: null,   // mission 7/8/12: [{x, y, label, done}]
    checkpointIndex: 0,
  };
}

export function currentMissionDef(ms) {
  return MISSION_DEFS[ms.current] || null;
}

// Seconds left on a timed mission (0 when the active mission has no clock).
export function missionTimeLeft(ms) {
  if (ms.stage !== 'active' || !ms.timeLimit) return 0;
  return Math.max(0, ms.timeLimit - ms.timer);
}

export function missionObjectiveText(game) {
  const ms = game.missions;
  const def = currentMissionDef(ms);
  // An active story mission always outranks a taxi fare: the banner, the
  // world marker and the edge arrow all follow the mission while it runs.
  if (def && ms.stage === 'active') {
    if (def.id === 1 && ms.progress === 1) return 'Drive the client to Solmarina Hospital';
    if (def.id === 3) return `Eliminate the Vipers on Playa Sol (${ms.progress}/${ms.needed})`;
    if (def.id === 4 && ms.packageCarried) return 'Escape the police — reach the safehouse';
    if (def.id === 5 && ms.progress === 1) return 'Escape the 5-star chase — reach the getaway boat';
    if (def.id === 6) {
      if (!ms.packageCarried) return `Grab the package at the port — ${fmtCountdown(missionTimeLeft(ms))} left`;
      return `Deliver to the yacht — ${fmtCountdown(missionTimeLeft(ms))} left`;
    }
    if (def.id === 7) {
      if (!ms.packageCarried) return `Grab the package at the port — ${fmtCountdown(missionTimeLeft(ms))} left`;
      const done = ms.checkpointIndex;
      if (done < MIDNIGHT_CHECKPOINTS.length) {
        return `Checkpoint ${done + 1}/3 — ${MIDNIGHT_CHECKPOINTS[done].label} — ${fmtCountdown(missionTimeLeft(ms))} left`;
      }
      return `All checkpoints hit — deliver to the safehouse — ${fmtCountdown(missionTimeLeft(ms))} left`;
    }
    if (def.id === 8) {
      if (!ms.packageCarried) return `Grab the crate at the port — ${fmtCountdown(missionTimeLeft(ms))} left`;
      const done = ms.checkpointIndex;
      if (done < HARBOR_DOCKS.length) {
        return `Pier ${done + 1}/3 — ${HARBOR_DOCKS[done].label} — ${fmtCountdown(missionTimeLeft(ms))} left`;
      }
      return `All piers served — ${fmtCountdown(missionTimeLeft(ms))} left`;
    }
    if (def.id === 9) {
      if (!ms.packageCarried) return `Steal the armored van at the bank — ${fmtCountdown(missionTimeLeft(ms))} left`;
      return `Deliver the van to the getaway boat — ${fmtCountdown(missionTimeLeft(ms))} left`;
    }
    if (def.id === 10) {
      return `Survive the 5-star heat — ${fmtCountdown(missionTimeLeft(ms))} left`;
    }
    if (def.id === 11) {
      if (!ms.packageCarried) return `Grab the package at the port — ${fmtCountdown(missionTimeLeft(ms))} left`;
      const left = game.gang.filter((g) => !g.dead).length;
      return `Outrun the Viper hunters (${left} left) — reach the safehouse — ${fmtCountdown(missionTimeLeft(ms))} left`;
    }
    if (def.id === 12) {
      const done = ms.checkpointIndex;
      if (done < GRAND_TOUR.length) {
        return `Stop ${done + 1}/${GRAND_TOUR.length} — ${GRAND_TOUR[done].label} — ${fmtCountdown(missionTimeLeft(ms))} left`;
      }
      return `Grand tour complete — ${fmtCountdown(missionTimeLeft(ms))} left`;
    }
    return def.objective;
  }
  // A side job outranks a taxi fare the same way a mission does.
  const side = sideJobObjectiveText(game);
  if (side) return side;
  if (ms.taxi && !ms.taxi.done) {
    return ms.taxi.hasPassenger
      ? `Taxi: drop the passenger at the marker (${'$' + ms.taxi.fare})`
      : 'Taxi: pick up the passenger at the marker';
  }
  if (!def) return 'All missions complete — free roam! Take taxi fares for cash.';
  if (ms.stage === 'idle') return `Next mission: ${def.title} — press F to start`;
  return def.objective;
}

export function startMission(game) {
  const ms = game.missions;
  const def = currentMissionDef(ms);
  if (!def || ms.stage === 'active') return false;
  // A story mission owns the gang list and the objective banner while it
  // runs, so any open side job is cancelled first (sidejobs.js).
  cancelSideJobs(game);
  ms.stage = 'active';
  ms.progress = 0;
  ms.timer = 0;
  ms.timeLimit = 0;
  ms.packageCarried = false;
  ms.checkpoints = null;
  ms.checkpointIndex = 0;
  const L = LANDMARKS;
  if (def.id === 1) {
    ms.target = { x: L.marina.x, y: L.marina.y, label: 'Pick up the client' };
    ms.needed = 0;
  } else if (def.id === 2) {
    // Spawn a marked Marina GT near the park.
    const car = makeCar(1150, 1450, 0.4, {
      kind: 'mission', driver: null, color: '#e8c832',
      model: CAR_MODELS.find((m) => m.name === 'Marina GT'), label: 'TARGET',
    });
    game.cars.push(car);
    ms.targetCar = car;
    ms.target = { x: car.x, y: car.y, label: 'Steal the Marina GT' };
  } else if (def.id === 3) {
    ms.needed = 5;
    ms.target = { x: L.beach.x, y: L.beach.y, label: 'Playa Sol' };
    game.gang.length = 0;
    for (let i = 0; i < 5; i++) {
      const gx = 900 + i * 140 + rand(-40, 40);
      const gy = 2200 + rand(-30, 30);
      game.gang.push({
        x: gx, y: gy, angle: rand(0, 6.28), health: 100, dead: false,
        shootTimer: rand(1, 2.5), state: 'guard', target: null, speed: 0,
      });
    }
  } else if (def.id === 4) {
    ms.target = { x: L.port.x, y: L.port.y, label: 'Grab the package' };
  } else if (def.id === 5) {
    ms.target = { x: L.bank.x, y: L.bank.y, label: 'Rob the bank' };
  } else if (def.id === 6) {
    // The PD is already tipped off: 4 stars the moment the job starts.
    ms.timeLimit = 100;
    addCrime(game.wanted, 85, game.time);
    game.events.push({ type: 'siren' });
    ms.target = { x: L.port.x, y: L.port.y, label: 'Grab the package' };
  } else if (def.id === 7) {
    // A night job: if the sun is still up, Leo waits for dark first — the
    // clock jump is visible on screen (the city goes dark), so no extra
    // message is needed; the mission brief follows below.
    if (!isNight(game.clock)) {
      game.clock = advanceToNight(game.clock);
    }
    ms.timeLimit = 150;
    ms.checkpoints = MIDNIGHT_CHECKPOINTS.map((c) => ({ ...c, done: false }));
    ms.checkpointIndex = 0;
    addCrime(game.wanted, 100, game.time);
    game.events.push({ type: 'siren' });
    ms.target = { x: L.port.x, y: L.port.y, label: 'Grab the package' };
  } else if (def.id === 8) {
    // Harbor Lights: grab the crate at the port, then serve three piers.
    ms.timeLimit = 120;
    ms.checkpoints = HARBOR_DOCKS.map((c) => ({ ...c, done: false }));
    ms.checkpointIndex = 0;
    ms.target = { x: L.port.x, y: L.port.y, label: 'Grab the crate' };
  } else if (def.id === 9) {
    // The finale: an armored van waits outside the bank, engine warm.
    ms.timeLimit = 180;
    const van = makeCar(L.bank.x + 60, L.bank.y + 120, 0.4, {
      kind: 'mission', driver: null, color: '#2a2a2e',
      model: CAR_MODELS.find((m) => m.name === 'Camioneta'), label: 'TARGET',
    });
    game.cars.push(van);
    ms.targetCar = van;
    ms.target = { x: van.x, y: van.y, label: 'Steal the armored van' };
  } else if (def.id === 10) {
    // King of Solmarina: 5 stars the moment the job starts, no package,
    // no destination — just stay free for 90 seconds.
    ms.timeLimit = 90;
    addCrime(game.wanted, 100, game.time);
    game.events.push({ type: 'siren' });
    ms.target = null;
  } else if (def.id === 11) {
    // Double Cross: the package is bait — the Vipers hunt Leo from the
    // moment he touches it. 150 seconds to reach the safehouse.
    ms.timeLimit = 150;
    ms.target = { x: L.port.x, y: L.port.y, label: 'Grab the package' };
  } else if (def.id === 12) {
    // The Last Sunset: eight stops, one per district, under 3-star heat.
    ms.timeLimit = 260;
    addCrime(game.wanted, 65, game.time);
    game.events.push({ type: 'siren' });
    ms.checkpoints = GRAND_TOUR.map((c) => ({ ...c, done: false }));
    ms.checkpointIndex = 0;
    ms.target = { x: GRAND_TOUR[0].x, y: GRAND_TOUR[0].y, label: GRAND_TOUR[0].label };
  }
  game.events.push({ type: 'missionStart' });
  // The crew talks: the mission's dialogue line shows on the bottom-center
  // card for six seconds (render.js drawHUD).
  if (def.say) {
    ms.dialogue = { sayer: def.sayer, role: def.role, say: def.say };
    ms.dialogueTimer = 8;
  }
  setMessage(game, def.title + ' — ' + def.brief, 6);
  return true;
}

export function setMessage(game, text, seconds = 4) {
  game.missions.message = text;
  game.missions.messageTimer = seconds;
}

export function completeMission(game) {
  const ms = game.missions;
  const def = currentMissionDef(ms);
  if (!def) return;
  game.player.money += def.pay;
  game.player.stats.missionsDone++;
  game.player.stats.rep = (game.player.stats.rep || 0) + 100;
  game.events.push({ type: 'missionDone' });
  setMessage(game, `Mission complete: ${def.title} — +$${def.pay}`, 5);
  ms.current++;
  ms.stage = 'idle';
  ms.target = null;
  ms.targetCar = null;
  ms.packageCarried = false;
  ms.timeLimit = 0;
  ms.checkpoints = null;
  ms.checkpointIndex = 0;
  game.gang.length = 0;
  game.save();
}

// A timed mission ran out of clock (or otherwise failed): the job is lost
// but the chain stays put, so the player can retry it.
export function failMission(game, reason) {
  const ms = game.missions;
  const def = currentMissionDef(ms);
  if (!def || ms.stage !== 'active') return;
  ms.stage = 'idle';
  ms.target = null;
  ms.targetCar = null;
  ms.packageCarried = false;
  ms.timeLimit = 0;
  ms.checkpoints = null;
  ms.checkpointIndex = 0;
  game.gang.length = 0;
  game.events.push({ type: 'missionFail' });
  setMessage(game, `Mission failed: ${def.title} — ${reason}`, 5);
  game.save();
}

// --- Taxi fares -------------------------------------------------------------
export function offerTaxi(game) {
  const ms = game.missions;
  if (ms.taxi || ms.taxiCooldown > 0) return;
  const pickup = randomRoadPoint(game.city, Math.random);
  const dropoff = randomRoadPoint(game.city, Math.random);
  const fare = 40 + Math.floor(dist(pickup.x, pickup.y, dropoff.x, dropoff.y) / 40);
  ms.taxi = { pickup, dropoff, fare, hasPassenger: false, done: false };
  setMessage(game, `Taxi fare available: pick up a passenger ($${fare})`, 5);
}
export function updateTaxi(game, dt) {
  const ms = game.missions;
  ms.taxiCooldown = Math.max(0, ms.taxiCooldown - dt);
  const taxi = ms.taxi;
  if (!taxi) {
    if (ms.taxiCooldown <= 0 && Math.random() < dt * 0.08) offerTaxi(game);
    return;
  }
  const p = game.player;
  const px = p.inCar && p.car ? p.car.x : p.x;
  const py = p.inCar && p.car ? p.car.y : p.y;
  if (!taxi.hasPassenger) {
    if (dist(px, py, taxi.pickup.x, taxi.pickup.y) < 60) {
      taxi.hasPassenger = true;
      game.events.push({ type: 'pickup' });
      setMessage(game, 'Passenger aboard — drive to the marker', 4);
    }
  } else if (dist(px, py, taxi.dropoff.x, taxi.dropoff.y) < 60) {
    p.money += taxi.fare;
    p.stats.faresDone++;
    p.stats.rep = (p.stats.rep || 0) + 10;
    game.events.push({ type: 'cash' });
    setMessage(game, `Fare complete — +$${taxi.fare}`, 4);
    ms.taxi = null;
    ms.taxiCooldown = 8;
    game.save();
  }
}

// --- Main mission update ----------------------------------------------------
export function updateMissions(game, dt, time) {
  const ms = game.missions;
  if (ms.messageTimer > 0) ms.messageTimer -= dt;
  if (ms.dialogueTimer > 0) ms.dialogueTimer -= dt;
  updateTaxi(game, dt);
  if (ms.stage !== 'active') return;
  const def = currentMissionDef(ms);
  if (!def) return;
  const p = game.player;
  const px = p.inCar && p.car ? p.car.x : p.x;
  const py = p.inCar && p.car ? p.car.y : p.y;
  ms.timer += dt;
  const L = LANDMARKS;

  if (def.id === 1) {
    // Stage A: reach the client at the marina; Stage B: drive them to hospital.
    if (!ms.progress) {
      if (dist(px, py, L.marina.x, L.marina.y) < 80) {
        ms.progress = 1;
        ms.target = { x: L.hospital.x, y: L.hospital.y, label: 'Drop off the client' };
        setMessage(game, 'Client aboard — drive to the hospital', 4);
      }
    } else if (dist(px, py, L.hospital.x, L.hospital.y) < 90) {
      completeMission(game);
    }
  } else if (def.id === 2) {
    const car = ms.targetCar;
    if (car && p.inCar && p.car === car) {
      ms.target = { x: L.garage.x, y: L.garage.y, label: 'Deliver to the garage' };
      if (dist(px, py, L.garage.x, L.garage.y) < 90) completeMission(game);
    } else if (car) {
      ms.target = { x: car.x, y: car.y, label: 'Steal the Marina GT' };
    }
  } else if (def.id === 3) {
    ms.progress = game.gang.filter((g) => g.dead).length;
    if (ms.progress >= ms.needed) completeMission(game);
  } else if (def.id === 4) {
    if (!ms.packageCarried) {
      if (dist(px, py, L.port.x, L.port.y) < 70) {
        ms.packageCarried = true;
        addCrime(game.wanted, 70, time);
        game.events.push({ type: 'siren' });
        ms.target = { x: L.safehouse.x, y: L.safehouse.y, label: 'Escape to the safehouse' };
        setMessage(game, 'Package grabbed! 3-star wanted — lose the cops at the safehouse', 5);
      }
    } else if (dist(px, py, L.safehouse.x, L.safehouse.y) < 90 && game.wanted.stars === 0) {
      completeMission(game);
    } else if (dist(px, py, L.safehouse.x, L.safehouse.y) < 90 && game.wanted.stars > 0) {
      setMessage(game, 'Lose the wanted level first — hide or use Pay-n-Spray', 3);
    }
  } else if (def.id === 5) {
    if (!ms.progress) {
      if (dist(px, py, L.bank.x, L.bank.y) < 90) {
        ms.progress = 1;
        addCrime(game.wanted, 100, time);
        game.events.push({ type: 'siren' });
        ms.target = { x: L.boat.x, y: L.boat.y, label: 'Escape to the getaway boat' };
        setMessage(game, 'Bank robbed! 5-star wanted — reach the boat at the port', 5);
      }
    } else if (dist(px, py, L.boat.x, L.boat.y) < 80) {
      completeMission(game);
    }
  } else if (def.id === 6) {
    if (!ms.packageCarried) {
      if (dist(px, py, L.port.x, L.port.y) < 70) {
        ms.packageCarried = true;
        ms.target = { x: L.yacht.x, y: L.yacht.y, label: 'Deliver to the yacht' };
        setMessage(game, 'Package secured — deliver it to the yacht at the marina!', 5);
      }
    } else if (dist(px, py, L.yacht.x, L.yacht.y) < 90) {
      completeMission(game);
    }
  } else if (def.id === 7) {
    if (!ms.packageCarried) {
      if (dist(px, py, L.port.x, L.port.y) < 70) {
        ms.packageCarried = true;
        ms.target = { x: MIDNIGHT_CHECKPOINTS[0].x, y: MIDNIGHT_CHECKPOINTS[0].y, label: MIDNIGHT_CHECKPOINTS[0].label };
        setMessage(game, 'Package grabbed! 5-star wanted — hit all 3 checkpoints!', 5);
      }
    } else if (ms.checkpointIndex < MIDNIGHT_CHECKPOINTS.length) {
      const cp = MIDNIGHT_CHECKPOINTS[ms.checkpointIndex];
      if (dist(px, py, cp.x, cp.y) < 90) {
        ms.checkpoints[ms.checkpointIndex].done = true;
        ms.checkpointIndex++;
        game.events.push({ type: 'pickup' });
        if (ms.checkpointIndex < MIDNIGHT_CHECKPOINTS.length) {
          const next = MIDNIGHT_CHECKPOINTS[ms.checkpointIndex];
          ms.target = { x: next.x, y: next.y, label: next.label };
          setMessage(game, `Checkpoint ${ms.checkpointIndex}/3 hit — next: ${next.label}`, 4);
        } else {
          ms.target = { x: L.safehouse.x, y: L.safehouse.y, label: 'Deliver to the safehouse' };
          setMessage(game, 'All checkpoints hit — deliver to the safehouse!', 4);
        }
      }
    } else if (dist(px, py, L.safehouse.x, L.safehouse.y) < 90) {
      completeMission(game);
    }
  } else if (def.id === 8) {
    if (!ms.packageCarried) {
      if (dist(px, py, L.port.x, L.port.y) < 70) {
        ms.packageCarried = true;
        addCrime(game.wanted, 65, time);
        game.events.push({ type: 'siren' });
        ms.target = { x: HARBOR_DOCKS[0].x, y: HARBOR_DOCKS[0].y, label: HARBOR_DOCKS[0].label };
        setMessage(game, 'Crate grabbed! 3-star wanted — serve all 3 piers!', 5);
      }
    } else if (ms.checkpointIndex < HARBOR_DOCKS.length) {
      const cp = HARBOR_DOCKS[ms.checkpointIndex];
      if (dist(px, py, cp.x, cp.y) < 90) {
        ms.checkpoints[ms.checkpointIndex].done = true;
        ms.checkpointIndex++;
        game.events.push({ type: 'pickup' });
        if (ms.checkpointIndex < HARBOR_DOCKS.length) {
          const next = HARBOR_DOCKS[ms.checkpointIndex];
          ms.target = { x: next.x, y: next.y, label: next.label };
          setMessage(game, `Pier ${ms.checkpointIndex}/3 served — next: ${next.label}`, 4);
        } else {
          setMessage(game, 'All piers served — the harbor is yours!', 4);
          completeMission(game);
        }
      }
    }
  } else if (def.id === 9) {
    const van = ms.targetCar;
    if (van && p.inCar && p.car === van && !ms.packageCarried) {
      // The van is the package: stepping into it trips the 5-star alarm.
      ms.packageCarried = true;
      addCrime(game.wanted, 100, time);
      game.events.push({ type: 'siren' });
      ms.target = { x: L.boat.x, y: L.boat.y, label: 'Escape to the getaway boat' };
      setMessage(game, 'Van stolen! 5-star wanted — reach the boat at the port', 5);
    } else if (van && !ms.packageCarried) {
      ms.target = { x: van.x, y: van.y, label: 'Steal the armored van' };
    }
    if (ms.packageCarried) {
      if (p.inCar && p.car === van) {
        ms.target = { x: L.boat.x, y: L.boat.y, label: 'Escape to the getaway boat' };
        if (dist(px, py, L.boat.x, L.boat.y) < 80) completeMission(game);
      } else {
        // Out of the van: the job is to bring the VAN to the boat, so the
        // marker points back at it until Leo climbs in again.
        ms.target = { x: van.x, y: van.y, label: 'Get back in the van' };
      }
    }
  } else if (def.id === 10) {
    // Survival job: reaching the time limit IS the win, so the branch
    // completes the mission before the timed-fail check below can fire.
    if (ms.timer >= ms.timeLimit) {
      setMessage(game, 'You outlasted the whole PD — King of Solmarina!', 5);
      completeMission(game);
    }
  } else if (def.id === 11) {
    if (!ms.packageCarried) {
      if (dist(px, py, L.port.x, L.port.y) < 70) {
        ms.packageCarried = true;
        addCrime(game.wanted, 40, time);
        game.events.push({ type: 'siren' });
        ms.target = { x: L.safehouse.x, y: L.safehouse.y, label: 'Escape to the safehouse' };
        setMessage(game, 'It’s a setup! The Vipers are hunting you — run!', 5);
        // Four Viper hunters spawn around the port and chase Leo down.
        game.gang.length = 0;
        for (let i = 0; i < 4; i++) {
          const a = rand(0, Math.PI * 2);
          game.gang.push({
            x: L.port.x + Math.cos(a) * rand(120, 220), y: L.port.y + Math.sin(a) * rand(120, 220),
            angle: rand(0, Math.PI * 2), health: 100, dead: false,
            shootTimer: rand(0.5, 1.5), state: 'hunt', target: null, speed: 0,
          });
        }
      }
    } else if (dist(px, py, L.safehouse.x, L.safehouse.y) < 90) {
      completeMission(game);
    }
  } else if (def.id === 12) {
    if (ms.checkpointIndex < GRAND_TOUR.length) {
      const cp = GRAND_TOUR[ms.checkpointIndex];
      if (dist(px, py, cp.x, cp.y) < 90) {
        ms.checkpoints[ms.checkpointIndex].done = true;
        ms.checkpointIndex++;
        game.events.push({ type: 'pickup' });
        if (ms.checkpointIndex < GRAND_TOUR.length) {
          const next = GRAND_TOUR[ms.checkpointIndex];
          ms.target = { x: next.x, y: next.y, label: next.label };
          setMessage(game, `Stop ${ms.checkpointIndex}/${GRAND_TOUR.length} hit — next: ${next.label}`, 4);
        } else {
          setMessage(game, 'Grand tour complete — Solmarina is yours!', 5);
          completeMission(game);
        }
      }
    }
  }
  // Timed missions: the clock runs out only while the job is still active
  // (completeMission above already set stage back to idle on success).
  // Each timed job fails in its own words.
  const FAIL_REASONS = {
    6: 'the buyer walked away — delivery too slow',
    7: 'the buyer walked away — delivery too slow',
    8: 'the docks went quiet — delivery too slow',
    9: 'the crew left without you — the van never arrived',
    11: 'the Vipers got the package — the setup worked',
    12: 'the sun set on the tour — too slow',
  };
  if (ms.stage === 'active' && ms.timeLimit > 0 && ms.timer > ms.timeLimit) {
    failMission(game, FAIL_REASONS[def.id] || 'time ran out');
  }
}

// Gang members (mission 3) shoot at the player when close.
export function updateGang(game, dt, time) {
  const p = game.player;
  const px = p.inCar && p.car ? p.car.x : p.x;
  const py = p.inCar && p.car ? p.car.y : p.y;
  for (const g of game.gang) {
    if (g.dead) continue;
    const d = dist(g.x, g.y, px, py);
    g.shootTimer -= dt;
    if (d < 480 && g.shootTimer <= 0) {
      g.shootTimer = 1.4 + Math.random();
      const w = { damage: 8, speed: 520, range: 480, color: '#ff6a4a' };
      game.bullets.push({
        x: g.x, y: g.y,
        angle: Math.atan2(py - g.y, px - g.x) + (Math.random() - 0.5) * 0.15,
        speed: w.speed, damage: w.damage, range: w.range, travelled: 0,
        owner: 'enemy', color: w.color, dead: false,
      });
      game.events.push({ type: 'enemyShot' });
    }
    // Viper hunters (mission 11) chase Leo down at a run and keep coming;
    // ordinary gang members only strafe slowly when he gets very close.
    if (g.state === 'hunt') {
      if (d > 120) {
        const a = Math.atan2(py - g.y, px - g.x);
        g.x += Math.cos(a) * 95 * dt;
        g.y += Math.sin(a) * 95 * dt;
        g.angle = a;
      }
    } else if (d < 260 && d > 120) {
      const a = Math.atan2(py - g.y, px - g.x);
      g.x += Math.cos(a) * 40 * dt;
      g.y += Math.sin(a) * 40 * dt;
      g.angle = a;
    }
  }
}
