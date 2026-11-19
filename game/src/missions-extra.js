// Ember Harbor — story jobs, part two. Six more missions for Vex Marlowe
// that use mechanics the first eight do not: flying a helicopter, a timed
// delivery chain, a stealth run with no heat, holding turf against waves,
// tailing a courier without being spotted, and a two-stage harbour heist.
// These defs merge into MISSION_DEFS in missions.js; the step kinds they
// use (flyto, stealth, defend, tail, timed-goto) are handled there.

export const EXTRA_MISSION_DEFS = [
  {
    id: 'skyhook', name: 'Skyhook', giver: 'Mara at the Pier',
    brief: 'The Harborview Tower roof has a package the PD cannot reach. Take the heliport chopper, land on the roof, grab it, and bring it back down.',
    reward: 900, steps: [
      { kind: 'flyto', label: 'Take the helicopter from the Harbor Heliport', x: 368, z: -138 },
      { kind: 'flyto', label: 'Land on the Harborview Tower roof', x: 322, z: -46 },
      { kind: 'grab', label: 'Grab the roof package', x: 322, z: -46 },
      { kind: 'flyto', label: 'Fly it back to the Heliport', x: 368, z: -138 },
    ],
    timeLimit: 420,
  },
  {
    id: 'midnight-run', name: 'Midnight Run', giver: 'Harbor Cab dispatch',
    brief: 'Four hot parcels, one clock. Every drop is timed — the faster the drop, the fatter the bonus. Do not stop for anything.',
    reward: 650, steps: [
      { kind: 'timed-goto', label: 'Drop 1: Foundry Bowl gates', x: -322, z: -322, bonus: 80 },
      { kind: 'timed-goto', label: 'Drop 2: Northgate warehouse', x: 230, z: -322, bonus: 80 },
      { kind: 'timed-goto', label: 'Drop 3: Cannery Flats corner', x: -230, z: 230, bonus: 80 },
      { kind: 'timed-goto', label: 'Drop 4: Hillcrest gates', x: 138, z: 230, bonus: 120 },
    ],
    timeLimit: 300,
  },
  {
    id: 'ghost', name: 'Ghost', giver: 'A burner phone',
    brief: 'The Harbour Casino vault is counting its take. Walk in, take the ledger from the back room, and walk out — if the PD notices you, the job is blown.',
    reward: 800, steps: [
      { kind: 'stealth', label: 'Reach the casino back room — no heat, no noise', x: 230, z: -138 },
      { kind: 'grab', label: 'Take the ledger', x: 230, z: -138 },
      { kind: 'stealth', label: 'Slip away to the Pier — stay clean', x: 0, z: 414 },
    ],
    timeLimit: 360,
  },
  {
    id: 'turf-war', name: 'Turf War', giver: 'Mara at the Pier',
    brief: 'The Dockside crew wants the Pier back. Hold the ground by the ferry for two minutes — they are coming in waves, and they are not asking.',
    reward: 750, steps: [
      { kind: 'defend', label: 'Hold the Pier — survive 120 seconds', x: 0, z: 414, survive: 120, count: 6 },
      { kind: 'goto', label: 'Report back to Mara', x: 0, z: 414 },
    ],
    timeLimit: 300,
  },
  {
    id: 'tail-job', name: 'Tail Job', giver: 'Rusty Wrench',
    brief: 'A courier is moving a prototype engine across town. Follow him for 45 seconds — close enough to see, far enough that he never looks back.',
    reward: 600, steps: [
      { kind: 'tail', label: 'Tail the courier — stay 8–30 m behind for 45s', x: 138, z: 138, tailTime: 45 },
      { kind: 'grab', label: 'Grab the prototype when he parks', x: -138, z: -138 },
    ],
    timeLimit: 420,
  },
  {
    id: 'harbor-heist', name: 'Harbor Heist', giver: 'Mara at the Pier',
    brief: 'The finale. Hit the Harbor Trust vault at dawn, take the gold, lose a 5-star response in the chopper, and land on the tower roof. The harbour will remember this one.',
    reward: 2000, steps: [
      { kind: 'grab', label: 'Take the vault gold at Harbor Trust Bank', x: 46, z: -46 },
      { kind: 'escape', label: 'Lose the heat — 5 stars are coming', x: 368, z: -138, survive: 60 },
      { kind: 'flyto', label: 'Escape by helicopter to the Tower roof', x: 322, z: -46 },
    ],
    timeLimit: 600,
  },
];

export function extraMissionDef(id) {
  return EXTRA_MISSION_DEFS.find((m) => m.id === id) || null;
}

export function extraMissionIds() {
  return EXTRA_MISSION_DEFS.map((m) => m.id);
}

export function totalExtraRewards() {
  return EXTRA_MISSION_DEFS.reduce((sum, m) => sum + m.reward, 0);
}

// The story arc in order: the first eight jobs, then these six. The game
// unlocks them in this order so the heist is always the last job offered.
export function storyArcOrder(firstEightIds) {
  return [...firstEightIds, ...extraMissionIds()];
}
