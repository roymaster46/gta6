// SOLARA BAY — screenshot presets. ?shot=day|night|mission|chase is handled in main.js.
// This module only exists so the shot list is explicit and testable.
export const SHOTS = [
  { name: '1-day.jpg', query: '?shot=day&seed=1', label: 'Solara Bay by day — downtown, traffic and pedestrians' },
  { name: '2-night.jpg', query: '?shot=night&seed=1', label: 'Neon night on the Boardwalk — ferris wheel, lamps, radio' },
  { name: '3-mission.jpg', query: '?shot=mission&seed=1', label: 'Story mission Static — fighting guards in Downtown' },
  { name: '4-chase.jpg', query: '?shot=chase&seed=1', label: '4-star police chase with helicopter closing in' },
];
