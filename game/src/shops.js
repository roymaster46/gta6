// shops.js — stores & safehouses: spend mission money on something useful.
// Three shops and two safehouses, all on the map as real buildings the
// player walks into (press F near the door):
//   Marina Arms (gun store, Old Town) — buy any wheel weapon + ammo.
//   Sol Diner (Market Square) — food heals: $15 snack (+25 HP), $30 meal
//     (+60 HP), $50 feast (full heal + 20 armor).
//   Coral Clothing (Rose Gardens) — outfits that change Leo's look and
//     grant small perks: Street ($200, +5% sprint), Sharp ($500, fares tip
//     +10%), Ghost ($800, wanted decays 20% faster).
// Safehouses: the starter Safehouse Hills house (free heal + save) and
// the Marina Penthouse ($4,000, ownable, free heal + save + a garage slot
// for a second stored car). Owning the penthouse is the money sink for
// the late game — and the "King of Solmarina" fantasy made concrete.
// Every shop keeps its own stock/prices in one table so the renderer,
// the HUD hint and the tests all read the same numbers.
import { clamp, dist } from './utils.js';
import { LANDMARKS } from './city.js';

export const SHOPS = [
  {
    id: 'gunstore', name: 'Marina Arms', kind: 'guns',
    x: 375, y: 600, label: 'Marina Arms — guns & ammo',
    blurb: 'Guns, ammo, no questions. Rico sends his regards.',
  },
  {
    id: 'diner', name: 'Sol Diner', kind: 'food',
    x: 375, y: 1050, label: 'Sol Diner — food & health',
    blurb: 'Best empanadas in Solmarina. Heals what the PD did to you.',
  },
  {
    id: 'clothes', name: 'Coral Clothing', kind: 'clothes',
    x: 900, y: 1575, label: 'Coral Clothing — outfits',
    blurb: 'Look the part. Dress like you own the city.',
  },
];

export const SAFEHOUSES = [
  {
    id: 'safehouse', name: 'Safehouse', price: 0,
    x: 330, y: 330, label: 'Safehouse — heal & save',
    blurb: 'Home. Heal up, save the game, plan the next job.',
  },
  {
    id: 'penthouse', name: 'Marina Penthouse', price: 4000,
    x: 1800, y: 240, label: 'Marina Penthouse — $4,000',
    blurb: 'Glass, ocean view, and a garage for your best car.',
  },
];

export const FOOD_MENU = [
  { id: 'snack', name: 'Empanada', price: 15, heal: 25, armor: 0, blurb: '+25 HP' },
  { id: 'meal', name: 'Sol Platter', price: 30, heal: 60, armor: 0, blurb: '+60 HP' },
  { id: 'feast', name: 'Marina Feast', price: 50, heal: 100, armor: 20, blurb: 'Full heal + 20 armor' },
];

export const OUTFITS = [
  { id: 'street', name: 'Street', price: 200, perk: 'sprint', blurb: '+5% sprint speed' },
  { id: 'sharp', name: 'Sharp', price: 500, perk: 'tips', blurb: 'Fares tip +10%' },
  { id: 'ghost', name: 'Ghost', price: 800, perk: 'stealth', blurb: 'Wanted decays 20% faster' },
];

export const AMMO_PRICES = { smg: 40, shotgun: 60, rifle: 80, molotov: 50, revolver: 70 };
export const AMMO_PACKS = { smg: 60, shotgun: 12, rifle: 10, molotov: 3, revolver: 12 };

export const SHOP_RANGE = 110;
export const SAFEHOUSE_RANGE = 110;

export function createShopState() {
  return {
    open: null, // shop id currently open as an overlay, or null
    selected: 0,
    ownedOutfits: ['street'],
    outfit: 'street',
  };
}

export function nearestShop(game) {
  const p = game.player;
  for (const s of SHOPS) {
    if (dist(p.x, p.y, s.x, s.y) < SHOP_RANGE) return s;
  }
  return null;
}

export function nearestSafehouse(game) {
  const p = game.player;
  for (const s of SAFEHOUSES) {
    if (dist(p.x, p.y, s.x, s.y) < SAFEHOUSE_RANGE) return s;
  }
  return null;
}

export function ownsSafehouse(game, id) {
  return (game.safehousesOwned || ['safehouse']).includes(id);
}

// Buy food: heal immediately, no inventory to manage.
export function buyFood(game, item) {
  const p = game.player;
  if (p.money < item.price) return `Not enough cash — ${item.name} costs $${item.price}`;
  if (p.health >= 100 && item.armor === 0) return 'Already at full health';
  p.money -= item.price;
  p.health = clamp(p.health + item.heal, 0, 100);
  p.armor = clamp(p.armor + item.armor, 0, 100);
  if (game.events) game.events.push({ type: 'cash' });
  return `${item.name} — ${item.blurb}`;
}

// Buy an outfit: owned outfits can be worn for free afterwards.
export function buyOutfit(game, outfit) {
  const p = game.player;
  const st = game.shopState;
  if (st.ownedOutfits.includes(outfit.id)) {
    st.outfit = outfit.id;
    return `Wearing ${outfit.name}`;
  }
  if (p.money < outfit.price) return `Not enough cash — ${outfit.name} costs $${outfit.price}`;
  p.money -= outfit.price;
  st.ownedOutfits.push(outfit.id);
  st.outfit = outfit.id;
  if (game.events) game.events.push({ type: 'cash' });
  return `${outfit.name} outfit bought — ${outfit.blurb}`;
}

// Outfit perks, read by player.js (sprint) and the fare code (tips).
export function outfitPerk(game, perk) {
  const st = game.shopState;
  if (!st) return false;
  const worn = OUTFITS.find((o) => o.id === st.outfit);
  return !!worn && worn.perk === perk;
}

export function sprintMultiplier(game) {
  return outfitPerk(game, 'sprint') ? 1.05 : 1;
}

// Buy ammo for a weapon the player already owns.
export function buyAmmo(game, weaponId) {
  const p = game.player;
  const price = AMMO_PRICES[weaponId];
  if (price === undefined) return null;
  if (!p.weapons[weaponId]) return 'You do not own that weapon yet';
  if (p.money < price) return `Not enough cash — ammo costs $${price}`;
  p.money -= price;
  p.ammo[weaponId] = (p.ammo[weaponId] || 0) + AMMO_PACKS[weaponId];
  if (game.events) game.events.push({ type: 'cash' });
  return `Ammo +${AMMO_PACKS[weaponId]} — $${price}`;
}

// Buy the penthouse: the late-game money sink. Returns a message.
export function buySafehouse(game, id) {
  const house = SAFEHOUSES.find((s) => s.id === id);
  const p = game.player;
  if (!house) return null;
  if (ownsSafehouse(game, id)) return `${house.name} is already yours`;
  if (p.money < house.price) return `Not enough cash — ${house.name} costs $${house.price.toLocaleString()}`;
  p.money -= house.price;
  game.safehousesOwned = [...(game.safehousesOwned || ['safehouse']), id];
  if (game.events) game.events.push({ type: 'cash' });
  if (game.save) game.save();
  return `${house.name} bought — welcome home, King`;
}

// Use a safehouse: heal to full (free at tier 4+ respect, $25 otherwise
// at the starter house; the penthouse always heals free) and save.
export function useSafehouse(game, id) {
  const p = game.player;
  const free = id === 'penthouse' || (game.respect && game.respect.tier >= 4);
  const cost = free ? 0 : 25;
  if (p.money < cost) return 'Not enough cash to rest ($25)';
  p.money -= cost;
  p.health = 100;
  p.armor = Math.max(p.armor, 50);
  if (game.save) game.save();
  return cost === 0 ? 'Rested — full health, game saved' : `Rested — full health, game saved (-$${cost})`;
}

// The F-key priority at a shop door: open the shop overlay. The overlay
// itself is drawn by render.js; this only flips state.
export function openShopOverlay(game, shop) {
  const st = game.shopState;
  st.open = shop.id;
  st.selected = 0;
  game.state = 'store';
}

// Shop items for the overlay, per shop kind. The renderer lists these.
export function shopItems(game, shopId) {
  if (shopId === 'diner') return FOOD_MENU.map((f) => ({ ...f, kind: 'food' }));
  if (shopId === 'clothes') {
    return OUTFITS.map((o) => ({
      ...o, kind: 'outfit',
      owned: game.shopState.ownedOutfits.includes(o.id),
      worn: game.shopState.outfit === o.id,
    }));
  }
  if (shopId === 'gunstore') {
    // Weapons first (buy once), then ammo for owned weapons.
    const items = [];
    for (const id of ['smg', 'shotgun', 'rifle', 'molotov', 'revolver']) {
      const owned = !!game.player.weapons[id];
      items.push({
        id, kind: 'weapon', name: owned ? `Ammo — ${id}` : `Buy ${id}`,
        price: owned ? AMMO_PRICES[id] : { smg: 300, shotgun: 500, rifle: 900, molotov: 250, revolver: 650 }[id],
        blurb: owned ? `+${AMMO_PACKS[id]} rounds` : 'Unlocks on the weapon wheel',
        owned,
      });
    }
    return items;
  }
  return [];
}

// Buy whatever the overlay has selected. Returns a toast message.
export function buySelected(game) {
  const st = game.shopState;
  const shop = SHOPS.find((s) => s.id === st.open);
  if (!shop) return null;
  const items = shopItems(game, shop.id);
  const item = items[st.selected];
  if (!item) return null;
  if (item.kind === 'food') return buyFood(game, item);
  if (item.kind === 'outfit') return buyOutfit(game, item);
  if (item.kind === 'weapon') {
    if (item.owned) return buyAmmo(game, item.id);
    // Buying the weapon itself goes through the wheel's price table.
    const { buyWeapon } = requireWheelBuy();
    return buyWeapon(game, item.id);
  }
  return null;
}

// Tiny indirection so shops.js does not import weaponwheel.js at module
// scope (the wheel imports combat, shops import the wheel — a cycle the
// bundler-free ES module graph tolerates, but this keeps it explicit).
import { buyWeapon as _buyWeapon } from './weaponwheel.js';
function requireWheelBuy() {
  return { buyWeapon: _buyWeapon };
}

// Landmark positions for the minimap + world markers, derived from the
// shop table so the renderer never hard-codes shop coordinates twice.
export function shopMarkers() {
  return [...SHOPS, ...SAFEHOUSES].map((s) => ({
    x: s.x, y: s.y, label: s.label, kind: s.kind || 'safehouse',
  }));
}

// How far Leo is from the nearest shop door, for the hint line.
export function nearestShopDistance(game) {
  const p = game.player;
  let best = Infinity;
  for (const s of [...SHOPS, ...SAFEHOUSES]) best = Math.min(best, dist(p.x, p.y, s.x, s.y));
  return best;
}
