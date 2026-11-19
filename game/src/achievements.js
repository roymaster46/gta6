// achievements.js — Solmarina achievements: eighteen milestones that pay
// the player for playing the whole game, not just the story.
// Each achievement has an id, a name, a description and a predicate over
// the live game state. checkAchievements(game) runs the locked ones every
// frame (they are cheap reads) and unlocks the ones whose predicate holds:
// a toast names the unlock, the event queue plays the cash chime, and the
// save writes immediately so an unlock never gets lost to a crash. Some
// achievements pay cash on unlock (noted in the list); the rest pay in
// bragging rights on the pause screen, which lists the count and the
// latest unlock. All predicates are pure reads, so the headless tests can
// drive them by staging game state directly.
import { packagesFound } from './collectibles.js';

export const ACHIEVEMENTS = [
  { id: 'first-fare', name: 'First Fare', desc: 'Complete your first mission', pay: 0,
    check: (g) => (g.player.stats.missionsDone || 0) >= 1 },
  { id: 'five-missions', name: 'Rising Star', desc: 'Complete 5 story missions', pay: 250,
    check: (g) => (g.player.stats.missionsDone || 0) >= 5 },
  { id: 'ten-missions', name: 'Made Man', desc: 'Complete 10 story missions', pay: 500,
    check: (g) => (g.player.stats.missionsDone || 0) >= 10 },
  { id: 'all-missions', name: 'Sunset King', desc: 'Complete all 16 story missions', pay: 2000,
    check: (g) => (g.player.stats.missionsDone || 0) >= 16 },
  { id: 'first-carjack', name: 'Nice Ride', desc: 'Carjack your first driven car', pay: 0,
    check: (g) => (g.player.stats.carsStolen || 0) >= 1 },
  { id: 'ten-carjacks', name: 'Grand Theft', desc: 'Steal 10 cars', pay: 300,
    check: (g) => (g.player.stats.carsStolen || 0) >= 10 },
  { id: 'first-chop', name: 'Crusher', desc: 'Sell your first car to the chop shop', pay: 0,
    check: (g) => (g.player.stats.chopSales || 0) >= 1 },
  { id: 'chop-king', name: 'Chop King', desc: 'Earn $2,000 from the chop shop', pay: 400,
    check: (g) => (g.player.stats.chopEarned || 0) >= 2000 },
  { id: 'first-race-win', name: 'Podium', desc: 'Win your first street race', pay: 0,
    check: (g) => (g.player.stats.racesWon || 0) >= 1 },
  { id: 'race-champion', name: 'Circuit Champion', desc: 'Win 5 street races', pay: 500,
    check: (g) => (g.player.stats.racesWon || 0) >= 5 },
  { id: 'heli-down', name: 'Bird Down', desc: 'Shoot down the police helicopter', pay: 250,
    check: (g) => (g.player.stats.helisDown || 0) >= 1 },
  { id: 'rep-1000', name: 'Respected', desc: 'Reach 1,000 respect', pay: 0,
    check: (g) => (g.respect?.points || 0) >= 1000 },
  { id: 'rep-king', name: 'King of Solmarina', desc: 'Reach respect tier 5', pay: 1000,
    check: (g) => (g.respect?.tier || 0) >= 5 },
  { id: 'first-district', name: 'Turf', desc: 'Own your first district', pay: 0,
    check: (g) => Object.values(g.respect?.control || {}).some((v) => v >= 100) },
  { id: 'turf-defender', name: 'Turf Defender', desc: 'Win a turf war', pay: 250,
    check: (g) => (g.turfWar?.warsWon || 0) >= 1 },
  { id: 'package-hunter', name: 'Package Hunter', desc: 'Find 10 hidden packages', pay: 250,
    check: (g) => packagesFound(g) >= 10 },
  { id: 'treasure-hunter', name: 'Treasure Hunter', desc: 'Find all 20 hidden packages', pay: 0,
    check: (g) => packagesFound(g) >= 20 },
  { id: 'penthouse', name: 'High Life', desc: 'Buy the Marina Penthouse', pay: 0,
    check: (g) => (g.safehousesOwned || []).includes('penthouse') },
  { id: 'arsenal', name: 'Arsenal', desc: 'Own all six weapons', pay: 500,
    check: (g) => ['pistol', 'smg', 'shotgun', 'rifle', 'molotov', 'revolver'].every((w) => g.player.weapons[w]) },
  { id: 'rich', name: 'Fat Stacks', desc: 'Hold $10,000 at once', pay: 0,
    check: (g) => g.player.money >= 10000 },
];

export function createAchievementState(unlocked = []) {
  return {
    unlocked: new Set(unlocked),
    latest: null,      // id of the most recent unlock, for the pause screen
    latestTimer: 0,
  };
}

// Check every locked achievement against the live game. Returns the list
// of ids unlocked by this call (usually empty, sometimes one or two when
// a big moment trips several at once, e.g. finishing mission 16).
export function checkAchievements(game) {
  const st = game.achievements;
  if (!st) return [];
  const newly = [];
  for (const a of ACHIEVEMENTS) {
    if (st.unlocked.has(a.id)) continue;
    let holds = false;
    try {
      holds = !!a.check(game);
    } catch {
      holds = false; // a predicate must never crash the frame
    }
    if (!holds) continue;
    st.unlocked.add(a.id);
    st.latest = a.id;
    st.latestTimer = 6;
    newly.push(a.id);
    if (a.pay > 0) game.player.money += a.pay;
    if (game.missions) {
      game.missions.message = `Achievement unlocked: ${a.name} — ${a.desc}${a.pay > 0 ? ` (+$${a.pay})` : ''}`;
      game.missions.messageTimer = 5;
    }
    if (game.events) game.events.push({ type: 'cash' });
  }
  if (newly.length > 0 && game.save) game.save();
  return newly;
}

// Tick the latest-unlock timer down (called once per frame from main).
export function updateAchievements(game, dt) {
  const st = game.achievements;
  if (!st) return;
  if (st.latestTimer > 0) st.latestTimer -= dt;
}

// One-line summary for the pause screen.
export function achievementsText(game) {
  const st = game.achievements;
  if (!st) return 'Achievements 0/20';
  const latest = st.latest ? ACHIEVEMENTS.find((a) => a.id === st.latest) : null;
  return `Achievements ${st.unlocked.size}/${ACHIEVEMENTS.length}${latest ? ` — latest: ${latest.name}` : ''}`;
}

// Serialize unlocked ids for the save file.
export function achievementsSnapshot(game) {
  const st = game.achievements;
  if (!st) return { unlocked: [] };
  return { unlocked: [...st.unlocked] };
}

// Restore from a snapshot (an array of ids, or the snapshot object).
export function restoreAchievements(game, snap) {
  const ids = Array.isArray(snap) ? snap : (snap?.unlocked || []);
  const st = createAchievementState(ids);
  if (!Array.isArray(snap) && snap?.latest) st.latest = snap.latest;
  game.achievements = st;
  return st;
}
