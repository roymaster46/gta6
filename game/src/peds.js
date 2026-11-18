// peds.js — pedestrians: walk the sidewalks, chat, flee gunfire and crashes.
// The city breathes with the day/night cycle: after dark the streets thin
// out, everyone walks a little slower, and a few night owls gather on the
// beach to watch the ocean instead of strolling.
import { clamp, dist, rand, pick, mulberry32, angleTo, turnToward } from './utils.js';
import { WORLD, randomFreePoint, randomRoadPoint, onRoad, pointInBuilding } from './city.js';
import { isNight } from './daynight.js';

const PED_COLORS = ['#e8b4b8', '#8a6a4a', '#4a6a8a', '#c8a8d8', '#a8c8a8', '#d8d8a8', '#e8e8e8', '#6a4a6a'];
const PED_SHIRTS = ['#d84a4a', '#3a6fd8', '#e8c832', '#3ab86a', '#8a4ad8', '#e8e8e8', '#d86a2a', '#4ad8d0'];
let nextPedId = 1;

export function makePed(x, y, opts = {}) {
  return {
    id: nextPedId++,
    x, y,
    angle: rand(0, Math.PI * 2),
    speed: 0,
    walkSpeed: 28 + rand(0, 26),
    state: opts.state || 'walk', // walk | flee | dead | panic | watch
    target: null,
    shirt: pick(PED_SHIRTS),
    skin: pick(PED_COLORS),
    hair: pick(['#2a2a2a', '#6a4a2a', '#c8c8c8', '#8a5a2a', '#3a2a1a']),
    fleeTimer: 0,
    panicTimer: 0,
    dead: false,
    bob: rand(0, Math.PI * 2),
  };
}

export function spawnPeds(city, count, rng) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const p = randomFreePoint(city, rng);
    peds.push(makePed(p.x, p.y));
  }
  return peds;
}

// A ped panics: run away from (fx, fy).
export function scarePeds(peds, fx, fy, radius = 320) {
  let count = 0;
  for (const p of peds) {
    if (p.dead) continue;
    if (dist(p.x, p.y, fx, fy) < radius) {
      p.state = 'flee';
      p.fleeTimer = 2.5 + Math.random() * 2;
      // Remember where the danger came from so the flee target is chosen
      // away from it, not at a random point that may be back toward it.
      p.fleeFrom = { x: fx, y: fy };
      p.target = null;
      count++;
    }
  }
  return count;
}

// `clock` is the day/night clock (0..360) — main.js passes game.clock.
export function updatePeds(peds, city, dt, time, clock = 0) {
  const night = isNight(clock);
  for (const p of peds) {
    if (p.dead) continue;
    p.bob += dt * 8;
    if (p.state === 'flee') {
      p.fleeTimer -= dt;
      if (!p.target) {
        // Run away from the scare source: pick a point in the away
        // direction (with some spread) instead of anywhere at random.
        const away = p.fleeFrom ? angleTo(p.fleeFrom.x, p.fleeFrom.y, p.x, p.y) : rand(0, Math.PI * 2);
        const a = away + rand(-0.7, 0.7);
        const d = rand(180, 420);
        const tx = clamp(p.x + Math.cos(a) * d, 40, WORLD - 40);
        const ty = clamp(p.y + Math.sin(a) * d, 40, WORLD - 140);
        p.target = pointInBuilding(city, tx, ty) ? randomFreePoint(city, Math.random) : { x: tx, y: ty };
      }
      const a = angleTo(p.x, p.y, p.target.x, p.target.y);
      p.angle = turnToward(p.angle, a, dt * 6);
      p.speed = p.walkSpeed * 3.4;
      if (dist(p.x, p.y, p.target.x, p.target.y) < 30 || p.fleeTimer <= 0) {
        p.state = 'walk';
        p.target = null;
      }
    } else if (p.state === 'watch') {
      // Night owl on the beach: stand still, face the ocean, drift home
      // after a while (or instantly when morning comes).
      p.speed = 0;
      p.angle = turnToward(p.angle, Math.PI / 2, dt * 2);
      if (!night || Math.random() < dt * 0.02) { p.state = 'walk'; p.target = null; }
    } else {
      // Stroll: pick a nearby free point, walk to it, idle a moment.
      if (!p.target) {
        // At night, peds near the beach sometimes stop to watch the water
        // instead of walking on.
        if (night && p.y > 2100 && Math.random() < dt * 0.25) {
          p.state = 'watch';
          p.speed = 0;
        } else if (Math.random() < dt * 0.4) {
          const t = randomFreePoint(city, Math.random);
          // Prefer nearby targets so peds stay local.
          if (dist(p.x, p.y, t.x, t.y) < 500) p.target = t;
        }
        p.speed = 0;
      } else {
        const a = angleTo(p.x, p.y, p.target.x, p.target.y);
        p.angle = turnToward(p.angle, a, dt * 4);
        // Everyone walks slower after dark.
        p.speed = p.walkSpeed * (night ? 0.75 : 1);
        if (dist(p.x, p.y, p.target.x, p.target.y) < 16) p.target = null;
      }
    }
    if (p.speed > 0) {
      p.x += Math.cos(p.angle) * p.speed * dt;
      p.y += Math.sin(p.angle) * p.speed * dt;
      p.x = clamp(p.x, 30, WORLD - 30);
      p.y = clamp(p.y, 30, WORLD - 130);
      if (pointInBuilding(city, p.x, p.y)) {
        // Step back out of the building.
        p.x -= Math.cos(p.angle) * p.speed * dt * 2;
        p.y -= Math.sin(p.angle) * p.speed * dt * 2;
        p.target = null;
      }
    }
  }
  return peds;
}

// A car running over a ped: returns the peds hit.
export function carHitsPeds(car, peds, radius = 26) {
  const hit = [];
  for (const p of peds) {
    if (p.dead) continue;
    if (dist(car.x, car.y, p.x, p.y) < radius && Math.abs(car.speed) > 40) {
      p.dead = true;
      p.state = 'dead';
      hit.push(p);
    }
  }
  return hit;
}
