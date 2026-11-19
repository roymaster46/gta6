// gangwar.js — Viper turf war: the gang fights back for the streets.
// Once Leo owns a district (respect.js district control at 100), the
// Vipers do not just accept it. Every 90-150 seconds of free roam the
// crew picks an owned district and hits it: four Vipers spawn at the
// district centre and Leo has 60 seconds to clear them out.
//   * WIN — all four down in time: +$500, +150 REP, the district stays
//     owned, and the next attack waits longer (the Vipers lick wounds).
//   * LOSE — the clock runs out or Leo leaves: control in that district
//     drops to 50 (no longer owned), -50 REP, and the Vipers strut.
// Attacks never fire while a story mission or a race is running — the
// turf war is free-roam pressure, not a mission ambush. The HUD shows a
// red banner while an attack is live, the world marker points at the
// district under attack, and the minimap gets a red diamond. Everything
// is plain state on game.turfWar, so the headless tests can run a whole
// war without a canvas.
import { dist, rand } from './utils.js';
import { DISTRICTS, districtAt } from './city.js';
import { addRespect, addDistrictControl } from './respect.js';

export const TURF_ATTACK_MIN = 90;   // seconds between attacks (fastest)
export const TURF_ATTACK_MAX = 150;  // seconds between attacks (slowest)
export const TURF_ATTACK_TIME = 60;  // seconds to clear the attackers
export const TURF_ATTACK_SIZE = 4;   // Vipers per attack
export const TURF_WIN_PAY = 500;
export const TURF_WIN_REP = 150;
export const TURF_LOSE_REP = 50;

export function createTurfState() {
  return {
    active: null,      // {district, x, y, timer, timeLimit, attackers}
    cooldown: 75,      // seconds until the first attack can fire
    warsWon: 0,
    warsLost: 0,
    lastDistrict: null,
  };
}

// Districts Leo owns right now (control at 100). Pure lookup, tested.
export function ownedDistrictNames(game) {
  const control = game.respect?.control || {};
  return Object.keys(control).filter((d) => control[d] >= 100);
}

// Centre of a district, for spawning the attack squad.
export function districtCenter(name) {
  const d = DISTRICTS.find((x) => x.name === name);
  if (!d) return { x: 1200, y: 1200 };
  return { x: d.x + d.w / 2, y: d.y + d.h / 2 };
}

// Start an attack on a district: spawn the squad, set the clock, warn Leo.
export function startTurfAttack(game, districtName) {
  const tw = game.turfWar;
  if (!tw || tw.active) return false;
  const c = districtCenter(districtName);
  tw.active = {
    district: districtName,
    x: c.x, y: c.y,
    timer: 0,
    timeLimit: TURF_ATTACK_TIME,
    attackers: [],
  };
  tw.lastDistrict = districtName;
  // The squad spawns around the district centre, spread so they do not stack.
  for (let i = 0; i < TURF_ATTACK_SIZE; i++) {
    const a = rand(0, Math.PI * 2);
    const r = rand(40, 160);
    const g = {
      x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r,
      angle: rand(0, Math.PI * 2), health: 100, dead: false,
      shootTimer: rand(0.5, 1.5), state: 'hunt', target: null, speed: 0,
    };
    game.gang.push(g);
    tw.active.attackers.push(g);
  }
  game.events.push({ type: 'siren' });
  if (game.missions) {
    game.missions.message = `TURF WAR: Vipers are hitting ${districtName} — clear them out!`;
    game.missions.messageTimer = 6;
  }
  return true;
}

// Maybe start an attack: only in free roam (no mission, no race), only
// when Leo owns turf, only when the cooldown has run out. The cooldown
// re-rolls randomly each time so attacks do not feel metronomic.
export function maybeTurfAttack(game, dt, rng = Math.random) {
  const tw = game.turfWar;
  if (!tw || tw.active) return false;
  tw.cooldown -= dt;
  if (tw.cooldown > 0) return false;
  if (game.missions && game.missions.stage === 'active') {
    tw.cooldown = 20;
    return false;
  }
  if (game.races && game.races.active) {
    tw.cooldown = 20;
    return false;
  }
  const owned = ownedDistrictNames(game);
  if (owned.length === 0) {
    tw.cooldown = 30;
    return false;
  }
  // Do not hit the same district twice in a row when there is a choice.
  const choices = owned.filter((d) => d !== tw.lastDistrict);
  const pick = (choices.length ? choices : owned)[Math.floor(rng() * (choices.length ? choices.length : owned.length))];
  tw.cooldown = TURF_ATTACK_MIN + rng() * (TURF_ATTACK_MAX - TURF_ATTACK_MIN);
  return startTurfAttack(game, pick);
}

// Tick the live attack: the clock runs, and clearing the squad wins it.
// Returns 'won' | 'lost' | null.
export function updateTurfWar(game, dt) {
  const tw = game.turfWar;
  if (!tw || !tw.active) return null;
  const a = tw.active;
  a.timer += dt;
  const alive = a.attackers.filter((g) => !g.dead).length;
  if (alive === 0) {
    // Won: the district stays owned, Leo gets paid and respected.
    tw.warsWon++;
    tw.active = null;
    tw.cooldown = TURF_ATTACK_MAX;
    const p = game.player;
    p.money += TURF_WIN_PAY;
    p.stats.rep = (p.stats.rep || 0) + TURF_WIN_REP;
    if (game.respect) addRespect(game, TURF_WIN_REP, `Turf defended: ${a.district}`);
    if (game.events) game.events.push({ type: 'cash' });
    if (game.missions) {
      game.missions.message = `Turf defended! ${a.district} is still yours — +$${TURF_WIN_PAY}, +${TURF_WIN_REP} REP`;
      game.missions.messageTimer = 5;
    }
    if (game.save) game.save();
    return 'won';
  }
  if (a.timer >= a.timeLimit) {
    // Lost: the Vipers take the district back to half control.
    tw.warsLost++;
    tw.active = null;
    tw.cooldown = TURF_ATTACK_MIN;
    if (game.respect) {
      const control = game.respect.control || {};
      control[a.district] = 50;
      addRespect(game, -TURF_LOSE_REP, `Lost ${a.district} to the Vipers`);
    }
    // The surviving attackers melt away instead of lingering forever.
    game.gang = game.gang.filter((g) => !a.attackers.includes(g));
    if (game.missions) {
      game.missions.message = `Turf lost: the Vipers took ${a.district} back — control halved, -${TURF_LOSE_REP} REP`;
      game.missions.messageTimer = 5;
    }
    if (game.save) game.save();
    return 'lost';
  }
  return null;
}

// Objective line for the HUD banner while an attack is live.
export function turfWarObjectiveText(game) {
  const tw = game.turfWar;
  if (!tw || !tw.active) return null;
  const a = tw.active;
  const left = a.attackers.filter((g) => !g.dead).length;
  const secs = Math.max(0, Math.ceil(a.timeLimit - a.timer));
  return `TURF WAR — defend ${a.district}: ${left} Vipers left, ${secs}s`;
}

// World target for the marker + minimap while an attack is live.
export function turfWarTarget(game) {
  const tw = game.turfWar;
  if (!tw || !tw.active) return null;
  return { x: tw.active.x, y: tw.active.y, label: `Defend ${tw.active.district}` };
}

// How long until the next attack can fire (for the pause screen).
export function turfCooldownText(game) {
  const tw = game.turfWar;
  if (!tw) return '—';
  if (tw.active) return 'UNDER ATTACK';
  return `${Math.max(0, Math.ceil(tw.cooldown))}s`;
}

// Serialize the turf record for the save file.
export function turfSnapshot(game) {
  const tw = game.turfWar;
  if (!tw) return { warsWon: 0, warsLost: 0 };
  return { warsWon: tw.warsWon, warsLost: tw.warsLost };
}
