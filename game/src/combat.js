// Ember Harbor — combat. Pure hit math: weapons, ammo, punch, bullets as
// fast ray checks against peds, cops and cars. The renderer draws tracers
// and muzzle flashes from the events this module returns; sounds come from
// audio.js. No randomness in damage — the spread lives in the caller.

import { WEAPONS } from './config.js';
import { clamp, dist } from './utils.js';

export function createLoadout() {
  return {
    current: 'fists',
    weapons: {
      fists: { ammo: Infinity, owned: true },
      pistol: { ammo: 24, owned: true },
      smg: { ammo: 0, owned: false },
      shotgun: { ammo: 0, owned: false },
    },
    cooldown: 0,
    reloading: false,
  };
}

export function weaponDef(id) {
  return WEAPONS[id] || WEAPONS.fists;
}

export function switchWeapon(loadout, id) {
  if (!loadout.weapons[id] || !loadout.weapons[id].owned) return false;
  loadout.current = id;
  loadout.cooldown = 0.2;
  return true;
}

export function giveWeapon(loadout, id, ammo) {
  loadout.weapons[id] = { ammo: (loadout.weapons[id]?.ammo || 0) + ammo, owned: true };
  return loadout.weapons[id].ammo;
}

export function buyAmmo(loadout, id, ammo, price, cash) {
  if (cash < price) return { ok: false, cash };
  if (!loadout.weapons[id] || !loadout.weapons[id].owned) return { ok: false, cash };
  loadout.weapons[id].ammo += ammo;
  return { ok: true, cash: cash - price };
}

export function canFire(loadout) {
  const def = weaponDef(loadout.current);
  if (loadout.cooldown > 0) return false;
  if (loadout.current === 'fists') return true;
  return loadout.weapons[loadout.current].ammo > 0;
}

export function tickLoadout(loadout, dt) {
  loadout.cooldown = Math.max(0, loadout.cooldown - dt);
  return loadout;
}

// Fire one shot from (ox, oz) along heading. Targets is a list of
// {x, z, radius, health, kind}. Returns hit events; the caller applies
// damage and removes the dead. Ammo is consumed here.
export function fireWeapon(loadout, ox, oz, heading, targets) {
  const def = weaponDef(loadout.current);
  if (!canFire(loadout)) return { fired: false, hits: [], pellets: 0 };
  loadout.cooldown = def.rate;
  if (loadout.current !== 'fists') loadout.weapons[loadout.current].ammo -= 1;
  const pellets = def.pellets || 1;
  const hits = [];
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  for (const t of targets) {
    if (t.dead || t.health <= 0) continue;
    const dx = t.x - ox;
    const dz = t.z - oz;
    const along = dx * fx + dz * fz;
    if (along < 0 || along > def.range) continue;
    const side = Math.abs(dx * fz - dz * fx);
    if (side > (t.radius || 0.8) + 0.35) continue;
    hits.push({ target: t, damage: def.damage, along, pellets });
    if (hits.length >= pellets) break;
  }
  return { fired: true, hits, pellets };
}

export function punch(loadout, ox, oz, heading, targets) {
  const def = WEAPONS.fists;
  if (loadout.cooldown > 0) return { fired: false, hits: [] };
  loadout.cooldown = def.rate;
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const hits = [];
  for (const t of targets) {
    if (t.dead || t.health <= 0) continue;
    const dx = t.x - ox;
    const dz = t.z - oz;
    const along = dx * fx + dz * fz;
    if (along < 0 || along > def.range) continue;
    const side = Math.abs(dx * fz - dz * fx);
    if (side > (t.radius || 0.8) + 0.3) continue;
    hits.push({ target: t, damage: def.damage, along });
  }
  return { fired: true, hits };
}

export function applyHit(target, damage) {
  target.health = Math.max(0, (target.health ?? 100) - damage);
  if (target.health <= 0) target.dead = true;
  return target.health;
}

export function shootCar(loadout, ox, oz, heading, cars) {
  const def = weaponDef(loadout.current);
  if (!canFire(loadout) || loadout.current === 'fists') return { fired: false, car: null };
  loadout.cooldown = def.rate;
  loadout.weapons[loadout.current].ammo -= 1;
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  let best = null;
  let bestAlong = def.range;
  for (const car of cars) {
    if (car.wrecked) continue;
    const dx = car.x - ox;
    const dz = car.z - oz;
    const along = dx * fx + dz * fz;
    if (along < 0 || along > bestAlong) continue;
    const side = Math.abs(dx * fz - dz * fx);
    if (side > 2.4) continue;
    best = car;
    bestAlong = along;
  }
  if (best) {
    best.health = Math.max(0, best.health - def.damage);
    if (best.health <= 0) { best.wrecked = true; best.speed = 0; }
  }
  return { fired: true, car: best, along: bestAlong };
}

export function ammoText(loadout) {
  const def = weaponDef(loadout.current);
  if (loadout.current === 'fists') return '—';
  return String(loadout.weapons[loadout.current].ammo);
}

export function totalAmmo(loadout) {
  let total = 0;
  for (const id of Object.keys(loadout.weapons)) {
    const a = loadout.weapons[id].ammo;
    if (Number.isFinite(a)) total += a;
  }
  return total;
}
