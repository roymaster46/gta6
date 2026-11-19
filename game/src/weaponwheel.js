// weaponwheel.js — the weapon wheel: hold Q, pick a gun with the mouse.
// GTA-style radial menu, drawn top-down: four (later six) slots around
// Leo, each showing the weapon's icon, name, ammo and price. The wheel
// freezes the world while open — picking a gun mid-firefight should feel
// deliberate, not like a pause-menu chore. Weapons the player does not
// own show as locked with their buy price; clicking a locked slot with
// enough cash buys it on the spot (Marina Arms prices, same as the shop).
// The wheel also handles the 1-4 hotkeys and the scroll-wheel cycle, so
// every weapon-switch path funnels through one place: switchWeapon().
// Ammo is per-weapon and persists in the save; the pistol has infinite
// ammo and is always owned, so the player can never be unarmed.
import { clamp, dist, angleTo } from './utils.js';
import { WEAPONS } from './combat.js';

// Wheel slots in display order. Locked weapons carry their shop price;
// the wheel buys them the same way the gun store does.
export const WHEEL_SLOTS = [
  { id: 'pistol', price: 0, blurb: 'Trusty sidearm. Infinite ammo.' },
  { id: 'smg', price: 300, blurb: 'Spray and pray. 30-round mag.' },
  { id: 'shotgun', price: 500, blurb: 'Close range, five pellets a shell.' },
  { id: 'rifle', price: 900, blurb: 'Long-range Viper rifle. 5-round mag.' },
  { id: 'molotov', price: 250, blurb: 'Fire in a bottle. Burns cars and crews.' },
  { id: 'revolver', price: 650, blurb: 'Heavy hand cannon. Slow, huge damage.' },
];

// Extra weapons the wheel knows about that combat.js does not (yet) fire:
// their stats live here so the wheel, the shop and the HUD agree.
export const EXTRA_WEAPONS = {
  molotov: { name: 'Molotov', damage: 40, rate: 0.8, speed: 420, spread: 0.04, range: 320, mag: 1, auto: false, color: '#ff7a2a', burn: 6 },
  revolver: { name: 'Revolver', damage: 80, rate: 0.6, speed: 780, spread: 0.01, range: 600, mag: 6, auto: false, color: '#e8e8e8' },
};

// Full weapon table for the wheel + shop: base four plus the two extras.
export function wheelWeapon(id) {
  return WEAPONS[id] || EXTRA_WEAPONS[id] || null;
}

export function createWheelState() {
  return {
    open: false,
    sticky: false, // staged scenes (screenshots) keep the wheel open
    // Angle the mouse points at while the wheel is open (radians).
    aimAngle: 0,
    // Slot index currently highlighted under the mouse, -1 = none.
    hovered: -1,
    // Which slot the wheel opened on (so releasing Q keeps the pick).
    openedOn: null,
    // Scroll-cycle cooldown so one wheel tick is one weapon.
    cycleCooldown: 0,
  };
}

// Which slot sits under a screen angle? Slots are laid out clockwise from
// the top, evenly spaced. Pure math — tested headlessly.
export function slotAtAngle(angle, slotCount = WHEEL_SLOTS.length) {
  // Normalize so 0 = top of the wheel, clockwise positive.
  let a = angle + Math.PI / 2;
  while (a < 0) a += Math.PI * 2;
  while (a >= Math.PI * 2) a -= Math.PI * 2;
  const slot = Math.floor((a / (Math.PI * 2)) * slotCount);
  return clamp(slot, 0, slotCount - 1);
}

// Centre of a slot on the wheel, for the renderer (fractions of radius).
export function slotPosition(i, slotCount = WHEEL_SLOTS.length) {
  const a = (i / slotCount) * Math.PI * 2 - Math.PI / 2;
  return { x: Math.cos(a), y: Math.sin(a), angle: a };
}

export function ownsWeapon(game, id) {
  return !!game.player.weapons[id];
}

// Switch to a weapon the player owns. Returns true on a real switch.
export function switchWeapon(game, id) {
  const p = game.player;
  if (!wheelWeapon(id)) return false;
  if (!ownsWeapon(game, id)) return false;
  if (p.weapon === id) return false;
  p.weapon = id;
  p.fireTimer = 0;
  if (game.audio) game.audio.click();
  return true;
}

// Cycle to the next / previous owned weapon (mouse wheel). Skips locked
// slots and wraps around. Returns the new weapon id, or null.
export function cycleWeapon(game, dir = 1) {
  const p = game.player;
  const owned = WHEEL_SLOTS.filter((s) => ownsWeapon(game, s.id)).map((s) => s.id);
  if (owned.length <= 1) return null;
  const cur = owned.indexOf(p.weapon);
  const next = owned[(cur + dir + owned.length) % owned.length];
  switchWeapon(game, next);
  return next;
}

// Buy a locked weapon from the wheel or the gun store. Cash first, then
// the weapon lands in the inventory with a starter ammo pack. Returns a
// message for the toast, or null when it cannot be bought.
export function buyWeapon(game, id) {
  const slot = WHEEL_SLOTS.find((s) => s.id === id);
  if (!slot) return null;
  const p = game.player;
  if (ownsWeapon(game, id)) return `${wheelWeapon(id).name} already owned`;
  if (p.money < slot.price) return `Not enough cash — ${wheelWeapon(id).name} costs $${slot.price}`;
  p.money -= slot.price;
  p.weapons[id] = true;
  // Starter ammo: a full mag plus a spare for guns, 3 bottles for molotov.
  const starter = { smg: 60, shotgun: 12, rifle: 10, molotov: 3, revolver: 12 };
  p.ammo[id] = (p.ammo[id] || 0) + (starter[id] || 0);
  p.weapon = id;
  if (game.events) game.events.push({ type: 'cash' });
  return `${wheelWeapon(id).name} bought — $${slot.price}`;
}

// Open the wheel: freeze the world, remember what was equipped.
export function openWheel(game) {
  const w = game.wheel;
  if (!w || w.open) return;
  w.open = true;
  w.openedOn = game.player.weapon;
  w.hovered = -1;
  game.state = 'wheel';
}

// Close the wheel: equip the hovered slot (buying it first if locked and
// affordable), otherwise keep whatever was equipped when it opened.
export function closeWheel(game) {
  const w = game.wheel;
  if (!w || !w.open) return;
  w.open = false;
  w.sticky = false;
  if (game.state === 'wheel') game.state = 'playing';
  const slot = WHEEL_SLOTS[w.hovered];
  if (slot) {
    if (ownsWeapon(game, slot.id)) {
      switchWeapon(game, slot.id);
    } else {
      const msg = buyWeapon(game, slot.id);
      if (msg && game.missions) {
        game.missions.message = msg;
        game.missions.messageTimer = 3;
      }
    }
  }
  w.hovered = -1;
}

// While the wheel is open, the mouse angle picks the highlighted slot.
// Called every frame from main.js while state === 'wheel'.
export function updateWheel(game, dt) {
  const w = game.wheel;
  if (!w || !w.open) return;
  w.cycleCooldown = Math.max(0, w.cycleCooldown - dt);
  const cx = game.view.w / 2;
  const cy = game.view.h / 2;
  const mx = game.input.mouse.x - cx;
  const my = game.input.mouse.y - cy;
  if (dist(0, 0, mx, my) > 40) {
    w.aimAngle = angleTo(0, 0, mx, my);
    w.hovered = slotAtAngle(w.aimAngle);
  } else {
    w.hovered = -1;
  }
  // Click while open confirms immediately; releasing Q also closes.
  if (game.input.mouse.clicked) closeWheel(game);
}

// Ammo display for a slot: ∞ for the pistol, a count otherwise.
export function ammoLabel(game, id) {
  if (id === 'pistol') return '∞';
  return String(game.player.ammo[id] ?? 0);
}

// Total firepower owned, for the end screen and the pause menu.
export function arsenalValue(game) {
  let total = 0;
  for (const s of WHEEL_SLOTS) if (ownsWeapon(game, s.id)) total += s.price;
  return total;
}
