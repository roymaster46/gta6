// sidejobs.js — repeatable side work beyond taxi fares: courier runs,
// Viper rampages and vigilante takedowns. All three are offered only while
// no story mission is running, pay cash on completion, and feed the same
// HUD objective / world marker / minimap plumbing as missions (priority:
// story mission, then side job, then taxi fare). Starting a story mission
// cancels any open side job, so the systems never fight over the gang list
// or the objective banner. The vigilante job is the driving one: a Viper
// getaway car flees across the city and Leo has 90 seconds to wreck it —
// by ramming it or shooting it — for $400.
import { dist, rand, fmtCountdown, angleTo, turnToward, clamp } from './utils.js';
import { randomRoadPoint, collideBuildings } from './city.js';
import { makeCar, carHealth, CAR_MODELS } from './vehicles.js';
import { addRespect, controlHere, CONTROL_GAIN } from './respect.js';

// Courier tiers: same job, different stakes. Fragile pays more for a
// tighter window; VIP pays most of all and the clock is brutal; the
// Midnight parcel only runs after dark and pays triple — if you dare.
const COURIER_TIERS = [
  { name: 'parcel', payMult: 1.0, speed: 200, slack: 20 },
  { name: 'fragile parcel', payMult: 1.5, speed: 260, slack: 15 },
  { name: 'VIP parcel', payMult: 2.2, speed: 240, slack: 12 },
  { name: 'Midnight parcel', payMult: 3.0, speed: 280, slack: 10, nightOnly: true },
];

export function createSideJobState() {
  return {
    courier: null,        // {pickup, dropoff, pay, timeLimit, timer, hasParcel, tier}
    courierCooldown: 0,
    rampage: null,        // {zone, needed, timeLimit, timer, started}
    rampageCooldown: 0,
    vigilante: null,      // {car, pay, timeLimit, timer}
    vigilanteCooldown: 0,
  };
}

// A story mission starting cancels any open side job (the gang list and the
// objective banner belong to the mission while it runs).
export function cancelSideJobs(game) {
  const sj = game.sideJobs;
  if (!sj) return;
  if (sj.rampage && sj.rampage.started) game.gang.length = 0;
  if (sj.vigilante && sj.vigilante.car) {
    // The getaway car leaves town when the job is cancelled.
    game.cars = game.cars.filter((c) => c !== sj.vigilante.car);
  }
  sj.courier = null;
  sj.rampage = null;
  sj.vigilante = null;
  sj.courierCooldown = 10;
  sj.rampageCooldown = 15;
  sj.vigilanteCooldown = 20;
}

function pickTier(game) {
  // The Midnight parcel only rolls after dark — and only for drivers the
  // street already knows (respect tier 1+).
  const night = game && game.clock !== undefined && game.nightMode;
  const known = game && game.respect && game.respect.tier >= 1;
  const r = Math.random();
  if (night && known && r < 0.15) return COURIER_TIERS[3];
  if (r < 0.6) return COURIER_TIERS[0];
  if (r < 0.85) return COURIER_TIERS[1];
  return COURIER_TIERS[2];
}

export function offerCourier(game) {
  const sj = game.sideJobs;
  if (!sj || sj.courier || sj.courierCooldown > 0) return;
  const pickup = randomRoadPoint(game.city, Math.random);
  const dropoff = randomRoadPoint(game.city, Math.random);
  const d = dist(pickup.x, pickup.y, dropoff.x, dropoff.y);
  const tier = pickTier(game);
  const pay = Math.round((60 + d / 25) * tier.payMult);
  sj.courier = {
    pickup, dropoff, pay, tier: tier.name,
    timeLimit: d / tier.speed + tier.slack,
    timer: 0, hasParcel: false,
  };
  game.missions.message = `Courier job: pick up a ${tier.name} ($${pay})`;
  game.missions.messageTimer = 5;
}

function offerRampage(game) {
  const sj = game.sideJobs;
  if (!sj || sj.rampage || sj.rampageCooldown > 0) return;
  if (game.gang.length > 0) return; // mission 3 owns the gang list
  const zone = randomRoadPoint(game.city, Math.random);
  sj.rampage = { zone, needed: 6, timeLimit: 75, timer: 0, started: false };
  game.missions.message = 'Side job: a Viper crew is causing trouble — drive to the marker';
  game.missions.messageTimer = 5;
}

// Spawn the rampage crew around the zone when the player drives in.
function startRampage(game) {
  const sj = game.sideJobs;
  const rj = sj.rampage;
  rj.started = true;
  rj.timer = 0;
  game.gang.length = 0;
  for (let i = 0; i < rj.needed; i++) {
    const a = rand(0, Math.PI * 2);
    const d = rand(60, 170);
    game.gang.push({
      x: rj.zone.x + Math.cos(a) * d, y: rj.zone.y + Math.sin(a) * d,
      angle: rand(0, Math.PI * 2), health: 100, dead: false,
      shootTimer: rand(0.5, 2), state: 'guard', target: null, speed: 0,
    });
  }
  game.missions.message = `Rampage! Take down all ${rj.needed} Vipers — ${rj.timeLimit}s!`;
  game.missions.messageTimer = 5;
  game.events.push({ type: 'siren' });
}

// A Viper getaway car is running from the PD — the city pays $400 to
// whoever wrecks it first. The car spawns a few blocks from Leo and flees
// from him the moment the job is offered, so the chase starts immediately.
export function offerVigilante(game) {
  const sj = game.sideJobs;
  if (!sj || sj.vigilante || sj.vigilanteCooldown > 0) return;
  const p = game.player;
  let spot = null;
  for (let i = 0; i < 12; i++) {
    const cand = randomRoadPoint(game.city, Math.random);
    if (dist(cand.x, cand.y, p.x, p.y) > 350) { spot = cand; break; }
  }
  if (!spot) spot = randomRoadPoint(game.city, Math.random);
  const car = makeCar(spot.x, spot.y, angleTo(spot.x, spot.y, p.x, p.y) + Math.PI, {
    kind: 'viper', driver: 'viper', color: '#c22a2a',
    model: CAR_MODELS.find((m) => m.name === 'Marina GT'), label: 'VIPER',
  });
  car.speed = 60;
  game.cars.push(car);
  sj.vigilante = { car, pay: 400, timeLimit: 90, timer: 0 };
  game.missions.message = 'Vigilante job: a Viper getaway car is running — wreck it in 90s for $400!';
  game.missions.messageTimer = 5;
}

// The getaway car flees: it steers away from Leo at up to 150 speed and
// slides off buildings instead of through them. Returns true while the
// chase is still on.
function updateVigilanteCar(game, dt) {
  const v = game.sideJobs.vigilante;
  const car = v.car;
  const p = game.player;
  const px = p.inCar && p.car ? p.car.x : p.x;
  const py = p.inCar && p.car ? p.car.y : p.y;
  const away = angleTo(px, py, car.x, car.y);
  car.angle = turnToward(car.angle, away, dt * 2.2);
  car.speed = clamp(car.speed + 120 * dt, 0, 150);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 30, 2370);
  car.y = clamp(car.y, 30, 2370);
  const pos = { x: car.x, y: car.y };
  if (collideBuildings(game.city, pos, 20)) {
    car.x = pos.x; car.y = pos.y;
    car.speed *= 0.5;
    // A hard shunt into a wall spins the getaway driver: he turns away
    // from the wall instead of grinding along it forever.
    car.angle += Math.PI / 2;
  }
  return true;
}

export function updateSideJobs(game, dt) {
  const sj = game.sideJobs;
  if (!sj) return;
  sj.courierCooldown = Math.max(0, sj.courierCooldown - dt);
  sj.rampageCooldown = Math.max(0, sj.rampageCooldown - dt);
  sj.vigilanteCooldown = Math.max(0, sj.vigilanteCooldown - dt);
  const ms = game.missions;
  const p = game.player;
  const px = p.inCar && p.car ? p.car.x : p.x;
  const py = p.inCar && p.car ? p.car.y : p.y;

  // Offers only arrive while no story mission is running.
  if (ms.stage !== 'active') {
    if (!sj.courier && sj.courierCooldown <= 0 && Math.random() < dt * 0.05) offerCourier(game);
    if (!sj.rampage && sj.rampageCooldown <= 0 && Math.random() < dt * 0.03) offerRampage(game);
    if (!sj.vigilante && sj.vigilanteCooldown <= 0 && Math.random() < dt * 0.03) offerVigilante(game);
  }

  const c = sj.courier;
  if (c) {
    if (!c.hasParcel) {
      if (dist(px, py, c.pickup.x, c.pickup.y) < 60) {
        c.hasParcel = true;
        c.timer = 0;
        game.events.push({ type: 'pickup' });
        game.missions.message = `Parcel aboard — deliver it in ${fmtCountdown(c.timeLimit)}!`;
        game.missions.messageTimer = 4;
      }
    } else {
      c.timer += dt;
      if (dist(px, py, c.dropoff.x, c.dropoff.y) < 60) {
        // On time pays the full fee; every second left over is a $2 bonus.
        const bonus = Math.round(Math.max(0, c.timeLimit - c.timer) * 2);
        p.money += c.pay + bonus;
        p.stats.couriersDone++;
        p.stats.rep = (p.stats.rep || 0) + 15;
        if (game.respect) {
          addRespect(game, 15, 'Courier done');
          controlHere(game, CONTROL_GAIN.fare, 'Courier');
        }
        game.events.push({ type: 'cash' });
        game.missions.message = `Courier done — +$${c.pay + bonus}${bonus ? ` (incl. $${bonus} speed bonus)` : ''}`;
        game.missions.messageTimer = 4;
        sj.courier = null;
        sj.courierCooldown = 15;
        game.save();
      } else if (c.timer > c.timeLimit) {
        game.missions.message = 'Courier failed — the parcel arrived too late';
        game.missions.messageTimer = 4;
        game.events.push({ type: 'missionFail' });
        sj.courier = null;
        sj.courierCooldown = 20;
        game.save();
      }
    }
  }

  const rj = sj.rampage;
  if (rj) {
    if (!rj.started) {
      if (dist(px, py, rj.zone.x, rj.zone.y) < 140) startRampage(game);
    } else {
      rj.timer += dt;
      const dead = game.gang.filter((g) => g.dead).length;
      if (dead >= rj.needed) {
        const pay = 350;
        p.money += pay;
        p.stats.rampagesDone++;
        p.stats.rep = (p.stats.rep || 0) + 25;
        if (game.respect) {
          addRespect(game, 25, 'Rampage cleared');
          controlHere(game, CONTROL_GAIN.vigilante, 'Rampage');
        }
        game.events.push({ type: 'cash' });
        game.missions.message = `Rampage cleared — +$${pay}! The streets are quieter tonight.`;
        game.missions.messageTimer = 4;
        game.gang.length = 0;
        sj.rampage = null;
        sj.rampageCooldown = 30;
        game.save();
      } else if (rj.timer > rj.timeLimit) {
        game.missions.message = 'Rampage failed — the Vipers slipped away';
        game.missions.messageTimer = 4;
        game.events.push({ type: 'missionFail' });
        game.gang.length = 0;
        sj.rampage = null;
        sj.rampageCooldown = 30;
        game.save();
      }
    }
  }

  // Vigilante: the getaway car flees while the clock runs. Wreck it — by
  // ramming or shooting — and the city pays $400 plus REP.
  const v = sj.vigilante;
  if (v) {
    v.timer += dt;
    if (!game.cars.includes(v.car)) {
      // The car is gone without being wrecked (despawned or sold): the job
      // ends quietly instead of hanging on the HUD forever.
      sj.vigilante = null;
      sj.vigilanteCooldown = 20;
    } else if (carHealth(v.car) <= 0) {
      p.money += v.pay;
      p.stats.vigilanteDone = (p.stats.vigilanteDone || 0) + 1;
      p.stats.rep = (p.stats.rep || 0) + 30;
      if (game.respect) {
        addRespect(game, 30, 'Vigilante takedown');
        controlHere(game, CONTROL_GAIN.vigilante, 'Vigilante');
      }
      game.events.push({ type: 'cash' });
      game.events.push({ type: 'explosion', x: v.car.x, y: v.car.y });
      game.missions.message = `Vigilante: Viper getaway wrecked — +$${v.pay}! The PD sends its thanks.`;
      game.missions.messageTimer = 4;
      game.cars = game.cars.filter((c) => c !== v.car);
      sj.vigilante = null;
      sj.vigilanteCooldown = 45;
      game.save();
    } else if (v.timer > v.timeLimit) {
      game.missions.message = 'Vigilante failed — the Viper getaway car got away';
      game.missions.messageTimer = 4;
      game.events.push({ type: 'missionFail' });
      game.cars = game.cars.filter((c) => c !== v.car);
      sj.vigilante = null;
      sj.vigilanteCooldown = 45;
      game.save();
    } else {
      updateVigilanteCar(game, dt);
    }
  }
}

// Objective banner line for the active side job (null when there is none).
export function sideJobObjectiveText(game) {
  const sj = game.sideJobs;
  if (!sj) return null;
  const rj = sj.rampage;
  if (rj) {
    if (!rj.started) return 'Side job: Viper crew at the marker — drive there to start';
    const dead = game.gang.filter((g) => g.dead).length;
    return `Rampage: take down the Vipers (${dead}/${rj.needed}) — ${fmtCountdown(rj.timeLimit - rj.timer)} left`;
  }
  const v = sj.vigilante;
  if (v) {
    const hp = Math.max(0, Math.round(carHealth(v.car)));
    return `Vigilante: wreck the Viper getaway car (${hp}% left) — ${fmtCountdown(v.timeLimit - v.timer)} left ($${v.pay})`;
  }
  const c = sj.courier;
  if (c) {
    if (!c.hasParcel) return `Courier: pick up the ${c.tier} at the marker ($${c.pay})`;
    return `Courier: deliver the ${c.tier} — ${fmtCountdown(c.timeLimit - c.timer)} left ($${c.pay})`;
  }
  return null;
}

// World-map target for the active side job: where the marker and the
// minimap dot point (null when there is none).
export function sideJobTarget(game) {
  const sj = game.sideJobs;
  if (!sj) return null;
  if (sj.rampage) return { x: sj.rampage.zone.x, y: sj.rampage.zone.y, label: 'RAMPAGE', color: '#ff4a4a' };
  if (sj.vigilante) return { x: sj.vigilante.car.x, y: sj.vigilante.car.y, label: 'VIPER', color: '#ff4a4a' };
  const c = sj.courier;
  if (c) {
    const dest = c.hasParcel ? c.dropoff : c.pickup;
    return { x: dest.x, y: dest.y, label: 'COURIER', color: '#4ad8d0' };
  }
  return null;
}
