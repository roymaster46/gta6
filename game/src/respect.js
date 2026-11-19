// respect.js — the Respect system: street cred that opens Solmarina up.
// Respect (REP) is earned by doing the job well — missions (+100), fares
// (+10), drifts (+5), near misses (+2), heli takedowns (+50), gang kills
// (+5) — and lost by getting busted (-150) or wasted (-100). Six tiers
// gate the good stuff: at tier 2 the chop shop pays 10% more, at tier 3
// the garage gives a 15% discount, at tier 4 gang members stop shooting
// on sight in three districts, and at tier 5 Rico trusts Leo with the
// Midnight Run's harder variant. District control is the long game: every
// district has a control meter (0-100) fed by missions, fares and
// vigilante work done inside it; a district at 100 is "owned" — peds there
// greet Leo, traffic gives way, and the safehouse discount applies. The
// HUD shows a thin respect bar under the cash; the pause menu shows the
// full tier ladder and which districts Leo owns.
import { clamp } from './utils.js';
import { districtAt } from './city.js';

export const RESPECT_TIERS = [
  { tier: 0, name: 'Nobody', min: 0, perk: 'Fresh off the boat — nobody knows your name yet.' },
  { tier: 1, name: 'Wheelman', min: 150, perk: 'Taxi drivers wave. Fares tip 10% more.' },
  { tier: 2, name: 'Hustler', min: 400, perk: 'Chop shop pays 10% more for hot cars.' },
  { tier: 3, name: 'Made Man', min: 800, perk: 'Garage discount 15%. Cops take longer to spot you.' },
  { tier: 4, name: 'Shot Caller', min: 1500, perk: 'Vipers hold fire in owned districts. Safehouse heals free.' },
  { tier: 5, name: 'King of Solmarina', min: 2500, perk: 'The city is yours. Everyone knows the name Leo Marín.' },
];

export const DISTRICT_CONTROL_MAX = 100;
// Respect earned per district action — small numbers, so control is a
// slow burn across many visits, not one lucky fare.
export const CONTROL_GAIN = { mission: 25, fare: 8, vigilante: 12, race: 15, chop: 5 };

// Tier lookup: the highest tier whose min is met. Pure function, tested.
export function tierFor(points) {
  let tier = RESPECT_TIERS[0];
  for (const t of RESPECT_TIERS) if (points >= t.min) tier = t;
  return tier;
}

export function nextTier(points) {
  for (const t of RESPECT_TIERS) if (points < t.min) return t;
  return null;
}

export function tierProgress(points) {
  const cur = tierFor(points);
  const nxt = nextTier(points);
  if (!nxt) return { tier: cur, into: points - cur.min, need: 0, frac: 1 };
  return {
    tier: cur, into: points - cur.min,
    need: nxt.min - cur.min, frac: (points - cur.min) / (nxt.min - cur.min),
  };
}

export function createRespectState(points = 0) {
  return {
    points: Math.max(0, points),
    tier: tierFor(points).tier,
    // district control: { [districtName]: 0..100 }
    control: {},
    // last few respect events, for the HUD ticker ("+100 Mission complete")
    feed: [],
    feedTimer: 0,
  };
}

// Add respect, clamp at 0, refresh the tier, log the event. Returns the
// points actually gained (0 when the amount was negative and clamped).
export function addRespect(game, amount, reason = '') {
  const r = game.respect || (game.respect = createRespectState(game.player?.stats?.rep || 0));
  const before = r.points;
  r.points = Math.max(0, r.points + amount);
  r.tier = tierFor(r.points).tier;
  if (game.player && game.player.stats) game.player.stats.rep = r.points;
  if (reason) {
    r.feed.unshift({ text: `${amount > 0 ? '+' : ''}${amount} REP — ${reason}`, timer: 4 });
    if (r.feed.length > 4) r.feed.length = 4;
    r.feedTimer = 4;
  }
  return r.points - before;
}

// District control: feed a district by doing work inside it. Returns the
// new control value (0-100). Owned districts (100) pay a one-time bonus.
export function addDistrictControl(game, districtName, amount, reason = '') {
  const r = game.respect || (game.respect = createRespectState(0));
  const before = r.control[districtName] || 0;
  const after = clamp(before + amount, 0, DISTRICT_CONTROL_MAX);
  r.control[districtName] = after;
  if (before < DISTRICT_CONTROL_MAX && after >= DISTRICT_CONTROL_MAX) {
    addRespect(game, 75, `You own ${districtName}`);
    if (game.events) game.events.push({ type: 'toast', text: `District owned: ${districtName} — +75 REP` });
  } else if (reason && game.events) {
    // Quiet gains do not spam the toast queue; the feed carries them.
    r.feed.unshift({ text: `${districtName} +${amount}`, timer: 3 });
    if (r.feed.length > 4) r.feed.length = 4;
  }
  return after;
}

// Convenience: credit control for the district Leo is standing in.
export function controlHere(game, amount, reason = '') {
  const name = districtAt(game.player.x, game.player.y);
  return addDistrictControl(game, name, amount, reason);
}

export function districtOwned(game, districtName) {
  return (game.respect?.control?.[districtName] || 0) >= DISTRICT_CONTROL_MAX;
}

export function ownedDistricts(game) {
  const c = game.respect?.control || {};
  return Object.keys(c).filter((d) => c[d] >= DISTRICT_CONTROL_MAX);
}

// Perks, read by the systems that grant them. All pure lookups on tier.
export function chopBonus(game) {
  return (game.respect?.tier || 0) >= 2 ? 1.1 : 1;
}

export function garageDiscount(game) {
  return (game.respect?.tier || 0) >= 3 ? 0.85 : 1;
}

export function fareTipBonus(game) {
  return (game.respect?.tier || 0) >= 1 ? 1.1 : 1;
}

export function freeSafehouseHeal(game) {
  return (game.respect?.tier || 0) >= 4;
}

// Gang members in an owned district hold fire: updateGang checks this
// before shooting, so owning turf visibly changes the street.
export function gangHoldsFire(game, x, y) {
  if ((game.respect?.tier || 0) < 4) return false;
  return districtOwned(game, districtAt(x, y));
}

// Wanted decay is faster when Leo is respected — the PD looks the other
// way a little. Returns the multiplier on the base decay rate.
export function wantedDecayMultiplier(game) {
  const tier = game.respect?.tier || 0;
  return 1 + tier * 0.12;
}

// Tick the respect feed timers down (called once per frame from main).
export function updateRespect(game, dt) {
  const r = game.respect;
  if (!r) return;
  if (r.feedTimer > 0) r.feedTimer -= dt;
  for (const f of r.feed) f.timer -= dt;
  r.feed = r.feed.filter((f) => f.timer > 0);
}

// Serialize respect into a save snapshot.
export function respectSnapshot(game) {
  const r = game.respect;
  if (!r) return { points: 0, tier: 0, control: {} };
  return { points: r.points, tier: r.tier, control: { ...r.control } };
}

// Restore respect from a snapshot (or a bare points number from v1 saves).
export function restoreRespect(game, snap) {
  if (typeof snap === 'number') {
    game.respect = createRespectState(snap);
    return game.respect;
  }
  const r = createRespectState(snap?.points || 0);
  r.control = { ...(snap?.control || {}) };
  game.respect = r;
  return r;
}

// One-line status for the HUD respect bar.
export function respectLine(game) {
  const p = tierProgress(game.respect?.points || 0);
  const nxt = nextTier(game.respect?.points || 0);
  if (!nxt) return `${p.tier.name} — MAX`;
  return `${p.tier.name} · ${p.into}/${p.need} to ${nxt.name}`;
}
