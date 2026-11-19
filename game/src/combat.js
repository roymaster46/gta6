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
      // r6: the rifle starts locked behind the gun shop, not in your pocket.
      rifle: { ammo: 0, owned: false },
      // r7: the revolver and the silenced Whisper — also shop-locked.
      revolver: { ammo: 0, owned: false },
      whisper: { ammo: 0, owned: false },
    },
    cooldown: 0,
    reloading: false,
    reloadTimer: 0,
    // r6: kevlar vest — absorbs damage before health does.
    armour: 0,
    maxArmour: 50,
  };
}

// r6: R reloads the current weapon from a reserve the gun shop sells.
// A reload takes 1.4 s (rifle 2.0 s) and is interrupted by switching.
export function startReload(loadout) {
  if (loadout.current === 'fists' || loadout.reloading) return false;
  if (!loadout.weapons[loadout.current].owned) return false;
  loadout.reloading = true;
  loadout.reloadTimer = loadout.current === 'rifle' ? 2.0 : 1.4;
  return true;
}

export function tickReload(loadout, dt) {
  if (!loadout.reloading) return false;
  loadout.reloadTimer -= dt;
  if (loadout.reloadTimer <= 0) {
    loadout.reloading = false;
    return true;
  }
  return false;
}

export function setArmour(loadout, amount) {
  loadout.armour = clamp(amount, 0, loadout.maxArmour);
  return loadout.armour;
}

// Armour absorbs damage first: a 20-damage hit with 50 armour costs
// 20 armour and 0 health. Returns {armour, health} damage split.
export function armourAbsorb(loadout, damage) {
  const absorbed = Math.min(loadout.armour, damage);
  loadout.armour -= absorbed;
  return { absorbed, healthDamage: damage - absorbed };
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
  if (loadout.reloading) return false;
  if (loadout.current === 'fists') return true;
  return loadout.weapons[loadout.current].ammo > 0;
}

export function tickLoadout(loadout, dt) {
  loadout.cooldown = Math.max(0, loadout.cooldown - dt);
  if (loadout.reloading) tickReload(loadout, dt);
  return loadout;
}

// r6: the rifle can shoot down a police helicopter — the ray check runs
// against the heli's 3D position using the same along/side math, with the
// altitude folded into the distance. Returns the damage dealt.
export function shootHeli(loadout, ox, oz, heading, heli) {
  if (loadout.current !== 'rifle' || !canFire(loadout)) return { fired: false, damage: 0 };
  if (!heli || !heli.active) return { fired: false, damage: 0 };
  const def = weaponDef('rifle');
  loadout.cooldown = def.rate;
  loadout.weapons.rifle.ammo -= 1;
  const dx = heli.x - ox;
  const dz = heli.z - oz;
  const along = dx * Math.sin(heading) + dz * Math.cos(heading);
  const side = Math.abs(dx * Math.cos(heading) - dz * Math.sin(heading));
  const slant = Math.sqrt(along * along + (heli.y || 42) * (heli.y || 42));
  if (along < 0 || slant > def.range || side > 6) return { fired: true, damage: 0, missed: true };
  return { fired: true, damage: def.damage };
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

// r7: headshots — a hit is a headshot when the target is far and the
// shot is straight down the line. Headshots deal double and, past 30 m,
// trigger slow motion (see fx.js registerHeadshot).
export function isHeadshot(distance, sideOffset, weaponId) {
  if (weaponId === 'fists' || weaponId === 'shotgun') return false;
  return distance >= 12 && sideOffset < 0.25;
}

export function headshotDamage(baseDamage, weaponId) {
  if (weaponId === 'revolver') return baseDamage * 2;
  return baseDamage * 2;
}

export function silentKill(loadout) {
  // The Whisper builds no heat: a silent kill is the Ghost job's friend.
  return loadout.current === 'whisper';
}

export function weaponRange(weaponId) {
  return weaponDef(weaponId).range;
}

export function weaponList(loadout) {
  return Object.keys(loadout.weapons).filter((id) => loadout.weapons[id].owned);
}

export function totalAmmo(loadout) {
  let total = 0;
  for (const id of Object.keys(loadout.weapons)) {
    const a = loadout.weapons[id].ammo;
    if (Number.isFinite(a)) total += a;
  }
  return total;
}
