// Ember Harbor — r7 story campaign "SEVEN-STAR HARBOR". A full three-act
// story arc for Vex Marlowe: the harbour's old families, the night market,
// and the man who owns the docks. Chapters unlock in order; each chapter
// has a cutscene (a short dialogue script the HUD plays line by line),
// a set of missions, and a payoff that changes the city — new contacts,
// new safehouses, new heat. Pure data + state machine: the renderer only
// reads the current line, main.js advances it on a timer or on Enter.

import { clamp } from './utils.js';

export const STORY_CHARACTERS = [
  { id: 'vex', name: 'Vex Marlowe', role: 'Courier, driver, harbour ghost', color: 0xd84a2f, bio: 'Came back to Rust Harbor with $60 and a borrowed jacket. Leaves with the city.' },
  { id: 'mara', name: 'Mara Voss', role: 'Fixer at the South Pier', color: 0x22d3ee, bio: 'Runs the pier, the parcels and half the harbour. Never raises her voice. Never repeats herself.' },
  { id: 'rusty', name: 'Rusty Wrench', role: 'Chop-shop king of Dockside', color: 0xf59e0b, bio: 'Buys every car in town twice: once when it is stolen, once when it is crushed.' },
  { id: 'annie', name: 'Iron Annie', role: 'Gunsmith, Gunshop Alley', color: 0x7dff8a, bio: 'Sells the tools, never asks what they are for. Her ledger is the safest book in the city.' },
  { id: 'sal', name: 'Salvatore "Sal" Kett', role: 'Harbourmaster of the docks', color: 0xc9a227, bio: 'Owns the cranes, the ferries and the night market. The villain of Act Two — and the employer of Act Three.' },
  { id: 'juno', name: 'Juno Park', role: 'Night-market singer, informant', color: 0xff2e88, bio: 'Sings at the market after dark. Hears everything the harbour whispers before the harbour says it.' },
  { id: 'ibrahim', name: 'Ibrahim Hale', role: 'FIB handler, Harborview', color: 0x1e4fd8, bio: 'The federal man who wants Sal — and will use anyone, including Vex, to get him.' },
  { id: 'doc', name: 'Doc Anselm', role: 'Surgeon, St. Anselm Hospital', color: 0xe8e4da, bio: 'Patches up anyone with cash and no questions. Keeps a bed warm for Vex.' },
];

export function characterById(id) {
  return STORY_CHARACTERS.find((c) => c.id === id) || null;
}

export const STORY_ACTS = [
  {
    id: 'act1', title: 'Act I — Coming Home', tagline: 'The harbour remembers you. So do the people you owe.',
    chapters: ['homecoming', 'the-pier-debt', 'neon-mile'],
    summary: 'Vex returns, works the pier, and learns the harbour has a new owner.',
  },
  {
    id: 'act2', title: 'Act II — The Night Market', tagline: 'Every deal in Rust Harbor passes through Sal Kett.',
    chapters: ['market-lights', 'the-ledger', 'harbourmaster'],
    summary: 'Vex infiltrates the night market, steals Sal\'s ledger, and becomes his problem.',
  },
  {
    id: 'act3', title: 'Act III — Seven Stars', tagline: 'Burn the docks or own them. There is no third way.',
    chapters: ['seven-stars', 'the-last-ferry'],
    summary: 'The FIB, the PD and Sal all converge on one night. Vex picks a side — then picks the harbour.',
  },
];

export const STORY_CHAPTERS = [
  {
    id: 'homecoming', act: 'act1', title: 'Homecoming', missions: ['first-drop', 'hot-wheels'],
    brief: 'Mara puts Vex back to work the night he returns: parcels first, a Falcon GT second.',
    cutscene: [
      { who: 'mara', line: 'You took your time coming home, Vex.' },
      { who: 'vex', line: 'The road out was easier than the road back.' },
      { who: 'mara', line: 'Three parcels. One hour. The harbour fog does not wait, and neither do I.' },
      { who: 'vex', line: 'Same Mara. Same pier. Same price?' },
      { who: 'mara', line: 'The price went up while you were gone. So did the heat.' },
    ],
  },
  {
    id: 'the-pier-debt', act: 'act1', title: 'The Pier Debt', missions: ['payback', 'night-shift'],
    brief: 'The Dockside crew jumped one of Mara\'s runners. Vex settles it — then drives the night cab to pay the interest.',
    cutscene: [
      { who: 'mara', line: 'They jumped Tomas at the docks. He is in St. Anselm\'s with a broken jaw.' },
      { who: 'vex', line: 'Four of them, you said. Four is a crowd.' },
      { who: 'mara', line: 'Four is a message. Answer it.' },
      { who: 'doc', line: 'If you bleed on my floor again, Vex, I am charging double.' },
    ],
  },
  {
    id: 'neon-mile', act: 'act1', title: 'Neon Mile', missions: ['street-circuit', 'smash-grab'],
    brief: 'The Strip regulars want a show; Rusty wants a bank courier\'s case. Vex gives them both.',
    cutscene: [
      { who: 'rusty', line: 'That Falcon you brought me? Beautiful. The bank courier is prettier.' },
      { who: 'vex', line: 'You want me to rob a courier in daylight.' },
      { who: 'rusty', line: 'I want you to be the fastest thing on the Neon Mile. The case is a bonus.' },
      { who: 'juno', line: 'Careful, courier. The Strip watches everyone — and it remembers.' },
    ],
  },
  {
    id: 'market-lights', act: 'act2', title: 'Market Lights', missions: ['midnight-run', 'ghost'],
    brief: 'Juno opens the night market to Vex: timed drops through the stalls, then a silent walk into Sal\'s casino.',
    cutscene: [
      { who: 'juno', line: 'The market only opens after dark. Lanterns, smoke, and every deal in the city.' },
      { who: 'vex', line: 'And Sal Kett owns the lanterns.' },
      { who: 'juno', line: 'Sal owns the docks. The market belongs to whoever is brave enough to walk it.' },
      { who: 'vex', line: 'Then walk with me. I need a ghost, not a guide.' },
    ],
  },
  {
    id: 'the-ledger', act: 'act2', title: 'The Ledger', missions: ['turf-war', 'tail-job'],
    brief: 'With the ledger in hand, the Dockside crew wants the Pier back. Vex holds the ground — then tails Sal\'s courier to the real money.',
    cutscene: [
      { who: 'mara', line: 'The ledger says Sal has been skimming the ferry payroll for a year.' },
      { who: 'sal', line: 'You have something of mine, courier. Bring it back and I forget your name.' },
      { who: 'vex', line: 'You forgot it once already. That is why I am standing here.' },
      { who: 'ibrahim', line: 'Keep the ledger, Vex. The FIB will want a word — and a witness.' },
    ],
  },
  {
    id: 'harbourmaster', act: 'act2', title: 'Harbourmaster', missions: ['skyhook', 'the-big-one'],
    brief: 'The ferry payroll crosses at midnight. Vex takes it from the air and the street on the same night.',
    cutscene: [
      { who: 'sal', line: 'The harbour is mine, Vex. The cranes, the ferries, the fog. All mine.' },
      { who: 'vex', line: 'Then you will not mind me borrowing the sky for one night.' },
      { who: 'mara', line: 'The payroll crosses at midnight. Take it, and Sal cannot pay his men by morning.' },
      { who: 'vex', line: 'By morning he will not have men left to pay.' },
    ],
  },
  {
    id: 'seven-stars', act: 'act3', title: 'Seven Stars', missions: ['harbor-heist', 'r7-ferry-gambit'],
    brief: 'The heist of the decade — then the gambit: Sal\'s last ferry, the FIB closing in, seven stars of heat and nowhere to hide.',
    cutscene: [
      { who: 'ibrahim', line: 'Seven stars, Vex. That is not a wanted level. That is a legend.' },
      { who: 'vex', line: 'Legends do not get arrested, Ibrahim. They get a statue — or a cell.' },
      { who: 'sal', line: 'Last ferry out, courier. Be on it, or be under it.' },
      { who: 'juno', line: 'The whole harbour is watching tonight. Make it worth the song.' },
    ],
  },
  {
    id: 'the-last-ferry', act: 'act3', title: 'The Last Ferry', missions: ['r7-last-ferry', 'r7-harbor-king'],
    brief: 'The finale: one last ferry, one last choice — burn Sal\'s empire or take the harbour for yourself.',
    cutscene: [
      { who: 'mara', line: 'Whatever happens tonight, the pier is yours now, Vex. I am done running it.' },
      { who: 'vex', line: 'Then the harbour has a new harbourmaster.' },
      { who: 'sal', line: 'You think you won? The city eats harbourmasters, boy.' },
      { who: 'vex', line: 'Let it try. I am the harbour now.' },
    ],
  },
];

export function chapterById(id) {
  return STORY_CHAPTERS.find((c) => c.id === id) || null;
}

export function actById(id) {
  return STORY_ACTS.find((a) => a.id === id) || null;
}

export function chapterForMission(missionId) {
  return STORY_CHAPTERS.find((c) => c.missions.includes(missionId)) || null;
}

export function createStoryState() {
  return {
    chapterIndex: 0,
    completedChapters: [],
    cutscene: null,
    cutsceneLine: 0,
    cutsceneTimer: 0,
    linesShown: 0,
    choicesMade: [],
    ending: null,
  };
}

export function currentChapter(state) {
  return STORY_CHAPTERS[state.chapterIndex] || null;
}

export function chapterProgress(state, completedMissions) {
  const ch = currentChapter(state);
  if (!ch) return { done: true, chapter: null, missionsDone: 0, missionsTotal: 0 };
  const done = ch.missions.filter((m) => completedMissions.includes(m)).length;
  return { done: done >= ch.missions.length, chapter: ch, missionsDone: done, missionsTotal: ch.missions.length };
}

export function advanceChapter(state, completedMissions) {
  const prog = chapterProgress(state, completedMissions);
  if (!prog.done) return null;
  const finished = prog.chapter;
  state.completedChapters.push(finished.id);
  state.chapterIndex += 1;
  const next = currentChapter(state);
  if (!next) {
    state.ending = 'harbor-king';
    return { type: 'story-complete', chapter: finished, ending: 'harbor-king' };
  }
  return { type: 'chapter-complete', chapter: finished, next };
}

export function startCutscene(state, chapterId) {
  const ch = chapterById(chapterId);
  if (!ch) return null;
  state.cutscene = ch;
  state.cutsceneLine = 0;
  state.cutsceneTimer = 0;
  return ch;
}

export function cutsceneLine(state) {
  if (!state.cutscene) return null;
  const ch = state.cutscene;
  if (state.cutsceneLine >= ch.cutscene.length) return null;
  const line = ch.cutscene[state.cutsceneLine];
  const who = characterById(line.who);
  return { who: who ? who.name : line.who, role: who ? who.role : '', line: line.line, index: state.cutsceneLine, total: ch.cutscene.length };
}

export function advanceCutscene(state, dt) {
  if (!state.cutscene) return null;
  state.cutsceneTimer += dt || 0;
  const line = cutsceneLine(state);
  if (!line) {
    state.cutscene = null;
    state.cutsceneLine = 0;
    return { type: 'cutscene-done' };
  }
  return { type: 'cutscene-line', ...line };
}

export function skipCutsceneLine(state) {
  if (!state.cutscene) return false;
  state.cutsceneLine += 1;
  state.linesShown += 1;
  state.cutsceneTimer = 0;
  if (state.cutsceneLine >= state.cutscene.cutscene.length) {
    state.cutscene = null;
    state.cutsceneLine = 0;
    return true;
  }
  return false;
}

export function storyChoice(state, choiceId, label) {
  state.choicesMade.push({ id: choiceId, label, at: state.chapterIndex });
  return state.choicesMade.length;
}

export function storyCompletion(state, completedMissions) {
  let done = 0;
  let total = 0;
  for (const ch of STORY_CHAPTERS) {
    total += ch.missions.length;
    done += ch.missions.filter((m) => completedMissions.includes(m)).length;
  }
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0, chaptersDone: state.completedChapters.length, chaptersTotal: STORY_CHAPTERS.length };
}

export function actProgress(state, completedMissions) {
  return STORY_ACTS.map((act) => {
    const missions = act.chapters.flatMap((cid) => chapterById(cid).missions);
    const done = missions.filter((m) => completedMissions.includes(m)).length;
    return { id: act.id, title: act.title, done, total: missions.length, pct: Math.round((done / missions.length) * 100) };
  });
}

export function endingTitle(ending) {
  if (ending === 'harbor-king') return 'Harbor King — Vex owns the docks, the market and the night.';
  if (ending === 'ghost') return 'Ghost — Vex vanishes; the harbour only whispers the name.';
  return 'Unfinished Business';
}

export function storySummary(state, completedMissions) {
  const comp = storyCompletion(state, completedMissions);
  const ch = currentChapter(state);
  return {
    ...comp,
    currentChapter: ch ? ch.title : 'Epilogue',
    currentAct: ch ? actById(ch.act).title : 'Epilogue',
    ending: state.ending,
    choices: state.choicesMade.length,
    linesShown: state.linesShown,
  };
}

export function dialogueFor(missionId) {
  const ch = chapterForMission(missionId);
  if (!ch) return [];
  return ch.cutscene.map((l) => ({ ...l, speaker: characterById(l.who)?.name || l.who }));
}

export function chapterReward(chapterId) {
  const ch = chapterById(chapterId);
  if (!ch) return 0;
  return 150 + ch.missions.length * 120;
}
