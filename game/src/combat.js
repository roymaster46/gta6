// combat.js — weapons, bullets, explosions and pickups for Solmarina.
import { clamp, dist, angleTo, rand, pick } from './utils.js';
import { WORLD, pointInBuilding, randomFreePoint } from './city.js';

export const WEAPONS = {
  pistol: { name: 'Pistol', damage: 34, rate: 0.28, speed: 620, spread: 0.05, range: 520, mag: 12, auto: false, color: '#ffd94a' },
  smg: { name: 'SMG', damage: 18, rate: 0.09, speed: 700, spread: 0.11, range: 460, mag: 30, auto: true, color: '#ffb84a' },
  shotgun: { name: 'Shotgun', damage: 16, rate: 0.7, speed: 560, spread: 0.22, range: 300, mag: 6, auto: false, pellets: 5, color: '#ff8a4a' },
};

export function makeBullet(x, y, angle, weapon, owner) {
  return {
    x, y, angle,
    speed: weapon.speed,
    damage: weapon.damage,
    range: weapon.range,
    travelled: 0,
    owner, // 'player' | 'enemy' | 'cop'
    color: weapon.color,
    dead: false,
  };
}

export function fireWeapon(game, shooter, weapon, tx, ty) {
  const base = angleTo(shooter.x, shooter.y, tx, ty);
  const pellets = weapon.pellets || 1;
  const bullets = [];
  for (let i = 0; i < pellets; i++) {
    const a = base + (Math.random() - 0.5) * weapon.spread * 2;
    bullets.push(makeBullet(
      shooter.x + Math.cos(a) * 20,
      shooter.y + Math.sin(a) * 20,
      a, weapon, shooter === game.player ? 'player' : 'enemy'
    ));
  }
  return bullets;
}

// Move bullets; hit buildings, peds, cops, gang members, cars and the player.
// Returns a list of hit events for sound / wanted / score handling.
export function updateBullets(game, dt) {
  const hits = [];
  for (const b of game.bullets) {
    if (b.dead) continue;
    const step = b.speed * dt;
    b.x += Math.cos(b.angle) * step;
    b.y += Math.sin(b.angle) * step;
    b.travelled += step;
    if (b.travelled > b.range || b.x < 0 || b.y < 0 || b.x > WORLD || b.y > WORLD) {
      b.dead = true; continue;
    }
    if (pointInBuilding(game.city, b.x, b.y)) {
      b.dead = true;
      hits.push({ type: 'wall', x: b.x, y: b.y });
      continue;
    }
    // Hit a car?
    for (const car of game.cars) {
      if (dist(b.x, b.y, car.x, car.y) < 24) {
        b.dead = true;
        car.damage += b.damage * 0.15;
        car.health = Math.max(0, 100 - car.damage);
        hits.push({ type: 'car', x: b.x, y: b.y, car });
        break;
      }
    }
    if (b.dead) continue;
    if (b.owner === 'player') {
      // Gang members / rivals.
      for (const g of game.gang) {
        if (g.dead) continue;
        if (dist(b.x, b.y, g.x, g.y) < 16) {
          b.dead = true;
          g.health -= b.damage;
          if (g.health <= 0) { g.dead = true; hits.push({ type: 'kill', x: g.x, y: g.y, who: 'gang' }); }
          else hits.push({ type: 'hit', x: b.x, y: b.y });
          break;
        }
      }
      if (b.dead) continue;
      // Cops.
      for (const c of game.cops) {
        if (c.inCar) continue;
        if (dist(b.x, b.y, c.x, c.y) < 15) {
          b.dead = true;
          c.stunTimer = 2.5;
          hits.push({ type: 'copHit', x: b.x, y: b.y });
          break;
        }
      }
      if (b.dead) continue;
      // Peds (a crime — wanted rises).
      for (const p of game.peds) {
        if (p.dead) continue;
        if (dist(b.x, b.y, p.x, p.y) < 14) {
          b.dead = true;
          p.dead = true; p.state = 'dead';
          hits.push({ type: 'kill', x: p.x, y: p.y, who: 'ped' });
          break;
        }
      }
    } else {
      // Enemy bullet vs the player.
      const p = game.player;
      const px = p.inCar && p.car ? p.car.x : p.x;
      const py = p.inCar && p.car ? p.car.y : p.y;
      if (dist(b.x, b.y, px, py) < (p.inCar ? 24 : 14)) {
        b.dead = true;
        hits.push({ type: 'playerHit', x: b.x, y: b.y, damage: b.damage });
      }
    }
  }
  game.bullets = game.bullets.filter((b) => !b.dead);
  return hits;
}

// --- Pickups: health, armor, weapons, cash --------------------------------
export function makePickup(x, y, kind) {
  return { x, y, kind, bob: rand(0, Math.PI * 2), life: 60 };
}
export function spawnPickups(city, rng, count = 10) {
  const kinds = ['health', 'armor', 'smg', 'health', 'armor', 'cash'];
  const out = [];
  for (let i = 0; i < count; i++) {
    const p = randomFreePoint(city, rng);
    out.push(makePickup(p.x, p.y, kinds[i % kinds.length]));
  }
  return out;
}
export function updatePickups(game, dt) {
  const p = game.player;
  const px = p.inCar && p.car ? p.car.x : p.x;
  const py = p.inCar && p.car ? p.car.y : p.y;
  for (const pk of game.pickups) pk.bob += dt * 3;
  for (let i = game.pickups.length - 1; i >= 0; i--) {
    const pk = game.pickups[i];
    pk.life -= dt;
    if (pk.life <= 0) { game.pickups.splice(i, 1); continue; }
    if (dist(px, py, pk.x, pk.y) < 30) {
      applyPickup(game, pk);
      game.pickups.splice(i, 1);
    }
  }
}
export function applyPickup(game, pk) {
  const p = game.player;
  if (pk.kind === 'health') { p.health = clamp(p.health + 40, 0, 100); game.events.push({ type: 'toast', text: '+40 Health' }); }
  if (pk.kind === 'armor') { p.armor = clamp(p.armor + 50, 0, 100); game.events.push({ type: 'toast', text: '+50 Armor' }); }
  if (pk.kind === 'smg') { p.weapons.smg = true; p.weapon = 'smg'; p.ammo.smg = (p.ammo.smg || 0) + 60; game.events.push({ type: 'toast', text: 'SMG picked up!' }); }
  if (pk.kind === 'cash') { p.money += 25; game.events.push({ type: 'toast', text: '+$25 found cash' }); }
  game.events.push({ type: 'pickup' });
}
