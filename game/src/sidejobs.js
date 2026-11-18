// sidejobs.js — repeatable side work beyond taxi fares: courier runs and
// Viper rampages. Both are offered only while no story mission is running,
// pay cash on completion, and feed the same HUD objective / world marker /
// minimap plumbing as missions (priority: story mission, then side job,
// then taxi fare). Starting a story mission cancels any open side job, so
// the two systems never fight over the gang list or the objective banner.
import { dist, rand, fmtCountdown } from './utils.js';
import { randomRoadPoint } from './city.js';

// Courier tiers: same job, different stakes. Fragile pays more for a
// tighter window; VIP pays most of all and the clock is brutal.
const COURIER_TIERS = [
  { name: 'parcel', payMult: 1.0, speed: 200, slack: 20 },
  { name: 'fragile parcel', payMult: 1.5, speed: 260, slack: 15 },
  { name: 'VIP parcel', payMult: 2.2, speed: 240, slack: 12 },
];

export function createSideJobState() {
  return {
    courier: null,        // {pickup, dropoff, pay, timeLimit, timer, hasParcel, tier}
    courierCooldown: 0,
    rampage: null,        // {zone, needed, timeLimit, timer, started}
    rampageCooldown: 0,
  };
}

// A story mission starting cancels any open side job (the gang list and the
// objective banner belong to the mission while it runs).
export function cancelSideJobs(game) {
  const sj = game.sideJobs;
  if (!sj) return;
  if (sj.rampage && sj.rampage.started) game.gang.length = 0;
  sj.courier = null;
  sj.rampage = null;
  sj.courierCooldown = 10;
  sj.rampageCooldown = 15;
}

function pickTier() {
  const r = Math.random();
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
  const tier = pickTier();
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

export function updateSideJobs(game, dt) {
  const sj = game.sideJobs;
  if (!sj) return;
  sj.courierCooldown = Math.max(0, sj.courierCooldown - dt);
  sj.rampageCooldown = Math.max(0, sj.rampageCooldown - dt);
  const ms = game.missions;
  const p = game.player;
  const px = p.inCar && p.car ? p.car.x : p.x;
  const py = p.inCar && p.car ? p.car.y : p.y;

  // Offers only arrive while no story mission is running.
  if (ms.stage !== 'active') {
    if (!sj.courier && sj.courierCooldown <= 0 && Math.random() < dt * 0.05) offerCourier(game);
    if (!sj.rampage && sj.rampageCooldown <= 0 && Math.random() < dt * 0.03) offerRampage(game);
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
  const c = sj.courier;
  if (c) {
    const dest = c.hasParcel ? c.dropoff : c.pickup;
    return { x: dest.x, y: dest.y, label: 'COURIER', color: '#4ad8d0' };
  }
  return null;
}
