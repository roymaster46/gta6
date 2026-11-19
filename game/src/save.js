// save.js — Solmarina save system v2: three slots, autosave and stats.
// The original game kept one autosave blob (money, missions, fares, best
// money, race bests). This revision keeps that blob compatible — slot 1 IS
// the old key — and adds two more slots plus a full snapshot: story
// progress, garage collection (owned cars by model), respect, weapon
// unlocks, district discoveries, settings (mute, station) and lifetime
// stats. Saving is explicit (safehouse / F at the safehouse, or the pause
// menu) AND automatic after every mission, race win and chop sale, so a
// busted run never eats an hour of progress. Every read is defensive:
// a corrupt or half-written slot falls back to a fresh start instead of
// crashing the boot, and a slot from an older version migrates forward.
import { clamp } from './utils.js';

export const SAVE_KEY = 'solmarina-save-v1';
export const SAVE_KEY_V2 = 'solmarina-save-v2';
export const SLOT_COUNT = 3;
export const AUTOSAVE_INTERVAL = 45; // seconds between quiet autosaves

// A fresh snapshot: every field the game needs to rebuild a session.
export function freshSave() {
  return {
    version: 2,
    money: 50,
    missionsDone: 0,
    faresDone: 0,
    bestMoney: 50,
    raceBest: {},
    respect: 0,
    respectTier: 0,
    respectControl: {},
    districtsFound: [],
    weaponsOwned: ['pistol'],
    ammo: { smg: 0, shotgun: 0, rifle: 0 },
    garageCars: [], // {model, color, upgrades, damage} parked at the safehouse
    safehousesOwned: ['safehouse'],
    packages: { found: [], bonusPaid: false }, // hidden-package progress
    achievements: { unlocked: [] }, // achievement ids
    stats: {
      kills: 0, carsStolen: 0, deaths: 0, playTime: 0,
      couriersDone: 0, rampagesDone: 0, vigilanteDone: 0,
      racesWon: 0, racesDone: 0, chopSales: 0, chopEarned: 0,
      nearMisses: 0, drifts: 0, helisDown: 0, arrests: 0,
    },
    settings: { muted: false, station: 0, showHints: true },
    savedAt: 0,
  };
}

// Serialize the live game into a snapshot. Nothing here touches the DOM;
// it only reads plain fields, so the headless tests can drive it too.
export function snapshotGame(game) {
  const p = game.player;
  const s = freshSave();
  s.money = Math.max(0, Math.floor(p.money));
  s.missionsDone = p.stats.missionsDone || 0;
  s.faresDone = p.stats.faresDone || 0;
  s.bestMoney = Math.max(game.saveData?.bestMoney || 0, p.money);
  s.raceBest = { ...(game.races?.best || {}) };
  s.respect = game.respect?.points || p.stats.rep || 0;
  s.respectTier = game.respect?.tier || 0;
  s.respectControl = { ...(game.respect?.control || {}) };
  s.districtsFound = [...(game.discovered || [])];
  s.weaponsOwned = Object.keys(p.weapons || {}).filter((w) => p.weapons[w]);
  s.ammo = { smg: p.ammo?.smg || 0, shotgun: p.ammo?.shotgun || 0, rifle: p.ammo?.rifle || 0 };
  s.garageCars = (game.garageCars || []).map((c) => ({
    model: c.model?.name || c.model, color: c.color,
    upgrades: { ...(c.upgrades || {}) }, damage: c.damage || 0,
  }));
  s.safehousesOwned = [...(game.safehousesOwned || ['safehouse'])];
  s.packages = {
    found: [...(game.collectibles?.found || [])],
    bonusPaid: !!game.collectibles?.bonusPaid,
  };
  s.achievements = { unlocked: [...(game.achievements?.unlocked || [])] };
  s.stats = { ...s.stats, ...(p.stats || {}) };
  s.settings = {
    muted: !!game.audio?.muted,
    station: game.audio?.station ?? 0,
    showHints: game.settings?.showHints !== false,
  };
  s.savedAt = Date.now();
  return s;
}

// Write a snapshot into a slot (0-based). Returns true on success.
export function writeSlot(slot, snapshot) {
  if (slot < 0 || slot >= SLOT_COUNT) return false;
  try {
    const all = readAllSlotsRaw();
    all[slot] = { ...snapshot, slot, savedAt: Date.now() };
    localStorage.setItem(SAVE_KEY_V2, JSON.stringify(all));
    return true;
  } catch {
    return false;
  }
}

// Read every slot raw (null entries for empty slots). Never throws.
export function readAllSlotsRaw() {
  try {
    const raw = localStorage.getItem(SAVE_KEY_V2);
    if (!raw) return [null, null, null];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [null, null, null];
    const out = [null, null, null];
    for (let i = 0; i < SLOT_COUNT; i++) out[i] = parsed[i] || null;
    return out;
  } catch {
    return [null, null, null];
  }
}

// Read one slot, migrated to the current shape. Returns null when empty.
export function readSlot(slot) {
  if (slot < 0 || slot >= SLOT_COUNT) return null;
  const raw = readAllSlotsRaw()[slot];
  if (!raw) return null;
  return migrateSave(raw);
}

// Slot 1 doubles as the legacy v1 blob: migrate it on first v2 read so
// returning players keep their money, missions and race bests.
export function migrateSave(raw) {
  const s = freshSave();
  if (!raw || typeof raw !== 'object') return s;
  // v1 shape: flat money / missionsDone / faresDone / bestMoney / raceBest.
  if (raw.version !== 2) {
    s.money = clamp(Math.floor(raw.money ?? 50), 0, 9999999);
    s.missionsDone = raw.missionsDone || 0;
    s.faresDone = raw.faresDone || 0;
    s.bestMoney = raw.bestMoney || s.money;
    s.raceBest = raw.raceBest || {};
    s.version = 2;
    return s;
  }
  const merged = { ...s, ...raw };
  merged.stats = { ...s.stats, ...(raw.stats || {}) };
  merged.settings = { ...s.settings, ...(raw.settings || {}) };
  merged.ammo = { ...s.ammo, ...(raw.ammo || {}) };
  merged.weaponsOwned = Array.isArray(raw.weaponsOwned) && raw.weaponsOwned.length
    ? raw.weaponsOwned : ['pistol'];
  merged.districtsFound = Array.isArray(raw.districtsFound) ? raw.districtsFound : [];
  merged.garageCars = Array.isArray(raw.garageCars) ? raw.garageCars : [];
  merged.safehousesOwned = Array.isArray(raw.safehousesOwned) && raw.safehousesOwned.length
    ? raw.safehousesOwned : ['safehouse'];
  merged.packages = raw.packages && Array.isArray(raw.packages.found)
    ? { found: raw.packages.found, bonusPaid: !!raw.packages.bonusPaid }
    : { found: [], bonusPaid: false };
  merged.achievements = raw.achievements && Array.isArray(raw.achievements.unlocked)
    ? { unlocked: raw.achievements.unlocked }
    : { unlocked: [] };
  merged.version = 2;
  return merged;
}

// The legacy single-slot read, kept for the boot path: v2 slot 0 wins,
// otherwise the old v1 blob migrates in place.
export function loadSave() {
  const v2 = readSlot(0);
  if (v2) return v2;
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return freshSave();
    return migrateSave(JSON.parse(raw));
  } catch {
    return freshSave();
  }
}

// Apply a snapshot onto a live game: money, stats, weapons, respect,
// discoveries and the garage collection. Called once, at boot.
export function applySave(game, save) {
  const p = game.player;
  p.money = save.money;
  p.stats.missionsDone = save.missionsDone;
  p.stats.faresDone = save.faresDone;
  Object.assign(p.stats, save.stats);
  p.stats.rep = save.respect;
  for (const w of save.weaponsOwned) {
    if (p.weapons[w] !== undefined) p.weapons[w] = true;
  }
  p.ammo.smg = save.ammo.smg;
  p.ammo.shotgun = save.ammo.shotgun;
  p.ammo.rifle = save.ammo.rifle;
  if (save.weaponsOwned.includes('rifle')) p.weapon = p.weapon || 'pistol';
  game.discovered = new Set(save.districtsFound);
  game.garageCars = (save.garageCars || []).map((c) => ({ ...c, upgrades: { ...c.upgrades } }));
  game.safehousesOwned = [...save.safehousesOwned];
  game.saveData = save;
  if (game.races) game.races.best = { ...(save.raceBest || {}) };
  if (game.audio && save.settings) {
    if (save.settings.muted && !game.audio.muted) game.audio.toggleMute();
  }
  return game;
}

// Save-state machine for the pause menu / safehouse: which slot is active,
// when the last autosave ran, and whether the current session is dirty.
export function createSaveState() {
  return {
    activeSlot: 0,
    lastAutosave: 0,
    dirty: false,
    lastSavedAt: 0,
    message: '',
    messageTimer: 0,
  };
}

// Quiet autosave: writes slot 0 every AUTOSAVE_INTERVAL seconds while the
// player is alive and playing. Returns true when a save actually happened.
export function autosaveTick(game, dt) {
  const st = game.saveState;
  if (!st || game.state !== 'playing') return false;
  st.lastAutosave += dt;
  if (st.lastAutosave < AUTOSAVE_INTERVAL) return false;
  st.lastAutosave = 0;
  return saveNow(game, st.activeSlot, true);
}

// Full save: snapshot the game, write the slot, update the HUD toast.
export function saveNow(game, slot = 0, quiet = false) {
  const snap = snapshotGame(game);
  const ok = writeSlot(slot, snap);
  if (ok) {
    game.saveData = snap;
    const st = game.saveState;
    if (st) {
      st.lastSavedAt = Date.now();
      st.dirty = false;
      if (!quiet) {
        st.message = `Game saved — slot ${slot + 1}`;
        st.messageTimer = 3;
      }
    }
    // Keep the legacy blob in sync so older builds still see progress.
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        money: snap.money, missionsDone: snap.missionsDone,
        faresDone: snap.faresDone, bestMoney: snap.bestMoney,
        raceBest: snap.raceBest,
      }));
    } catch { /* storage unavailable */ }
  }
  return ok;
}

// Human-readable slot line for the pause menu: money, missions, date.
export function slotSummary(slotData) {
  if (!slotData) return '— empty slot —';
  const when = slotData.savedAt ? new Date(slotData.savedAt).toLocaleDateString() : 'unknown date';
  return `$${(slotData.money || 0).toLocaleString()} · ${slotData.missionsDone || 0} missions · ${when}`;
}

// Total play time across all slots, for the end screen.
export function totalPlayTime(slots) {
  let t = 0;
  for (const s of slots) t += (s && s.stats && s.stats.playTime) || 0;
  return t;
}
