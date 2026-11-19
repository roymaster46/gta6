# EMBER HARBOR — Open-World Crime Game

[![make.fun bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/roymaster46/gta6/rank.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/roymaster46/gta6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Ember Harbor** is an original 3D open-world crime game set in Rust Harbor, a
gritty harbour city of nine districts. You are **Vex Marlowe**, a courier who
came back to the harbour with $60 and a borrowed jacket. Run jobs, steal cars,
dodge the Harbor PD — and pull the heist of the decade.

Everything is original: the city, characters, vehicles, story and sounds. No
Rockstar / GTA names, characters, map, art or music are used. All art is
procedural Three.js geometry with canvas-generated textures, all sound is
synthesized with WebAudio, and the game ships as plain static files and makes
**zero network requests** at runtime (Three.js is vendored under
`game/vendor/`).

## The city

A 920×920 m open world on a street grid: nine districts — Foundry Row,
Dockside, Cannery Flats, Old Market, The Strip, Hillcrest, Northgate,
Harborview and South Pier — each with its own flavour line on the HUD. Parks,
plazas, neon billboards, street lamps, a harbour water strip and the South
Pier, plus landmarks you will learn by heart: Harbor Trust Bank, St. Anselm
Hospital, the Ferry Terminal, the Rusty Wrench chop shop, the Quick Coat spray
shop and Vex's safehouse in Hillcrest.

## Systems

- **On foot** — WASD to move, Shift to sprint, Space to jump, mouse drag to
  orbit the camera. Camera-relative movement, building collision with sliding.
- **Cars** — parked cars and live traffic on the road grid. Press E to steal
  the nearest car; drive with WASD/arrows, Shift for handbrake, N for nitro
  (top speed ×1.65, 2.6 s boost, 8 s cooldown). Cars take damage, smoke and
  can be wrecked; nitro and health gauges sit on the car card.
- **Traffic & pedestrians** — traffic AI follows the streets, brakes for the
  car ahead and for you standing in the road; pedestrians stroll the sidewalks
  and flee gunfire, crashes and speeding cars. Hit one while driving and the
  city notices.
- **Day / night cycle** — a six-minute day: sunny day, dusk, a proper night,
  dawn. At night the sky deepens, windows light up warm yellow, street lamps
  glow, billboards bleed neon, and your headlights cut a cone through the
  dark. Rain and fog roll in on their own schedule. The clock and district sit
  at the top of the HUD.
- **Wanted 0–5 stars** — car theft, shooting, running over peds and robberies
  raise heat. Foot cops chase and try to arrest you (2.2 s in their grip and
  you are busted); police cars chase and ram; at 4 stars a **police
  helicopter** joins from above and spotlights you. Cops search your last
  known position when the trail goes cold and give up when the heat drops.
  Heat decays after 14 clean seconds; Quick Coat spray shop clears your
  wanted level for cash.
- **Notoriety** — heat is the chase you are in now; notoriety (0–100) is the
  name you carry between chases. Every crime adds to it, and it only fades
  after a long clean stretch. At 60+ the helicopter flies at 3 stars instead
  of 4 and the spray shop charges a surcharge. The HUD shows your band, from
  Unknown to Most Wanted.
- **Chop shop** — drive a stolen car to Rusty Wrench in the Docklands and
  press G to sell it to the crusher: payout follows the model and the
  condition (a clean Falcon GT pays $420, a wreck pays a quarter), one sale
  every 45 seconds, and every sale adds heat. The shop will not touch a
  police car.
- **Busted / Wasted** — arrested or killed, you lose money and wake up at the
  safehouse; busted costs 20% of your cash.
- **Combat** — fists, P9 pistol, Wasp SMG and Boomstick shotgun (1–4 to
  switch), with ammo, range, fire rate and pellet spread per weapon. Gang
  members shoot back. Click or F to fire.
- **Missions (8-story chain)** — 1) First Drop (courier run, 3 drops),
  2) Hot Wheels (steal the Falcon GT, deliver it to the chop shop),
  3) Street Circuit (3 laps, 8 gates a lap against the clock),
  4) Payback (clear the Dockside crew, 4 gang members),
  5) Heat Wave (lose a 3-star chase), 6) Night Shift (3 taxi fares),
  7) Smash & Grab (grab the bank courier case, vanish),
  8) The Big One (the finale: steal a fast car, take the ferry payroll,
  lose the whole harbour PD, bring it home — $1,500). Each has a timer, a
  pulsing beacon in the world and on the minimap, and a cash reward. Start
  the next job at the South Pier.
- **Side jobs** — taxi fares for cash (pick up at the cyan marker, drop off
  for $45 plus tips) and **12 hidden packages** tucked across the city, $120
  each.
- **HUD & minimap** — cash, health, wanted stars, weapon + ammo, mission
  card with timer, car card (health, nitro, speed), score, mission/package/
  fare progress, and a circular live minimap (player arrow, streets, water,
  objective beacon, cops, fares).
- **Save** — progress autosaves every 25 seconds and on mission completion
  (cash, health, missions, packages, fares, weapons, position, time of day)
  to localStorage; your best score persists between visits.
- **Audio** — synthesized only: engine hum that follows your speed, sirens,
  gunshots, pickup blips, cash chimes, mission fanfare and a moody bass line
  while you drive. M mutes.

## Controls

| Key | Action |
| --- | --- |
| WASD / Arrows | Move on foot / drive |
| Shift | Sprint on foot / handbrake in a car |
| Space | Jump |
| Mouse drag | Orbit camera (wheel zooms) |
| Click / F | Shoot / punch |
| E | Enter / exit nearest car, start next mission at the Pier, grab a case |
| G | Context action: spray shop (clear wanted) / chop shop (sell car) |
| N | Nitro boost (while driving) |
| H | Horn |
| 1 / 2 / 3 / 4 | Fists / Pistol / SMG / Shotgun |
| P / Esc | Pause |
| M | Mute |
| Enter | Start / restart |

## How to run

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no install, no network. Any static file server works; open
`game/index.html` from a server (ES modules need http, not `file://`).

To run the logic tests:

```sh
node tests/test.mjs
```

## Screenshots

Deterministic scenes are staged with `?shot=<name>&seed=20261119`:

- `?shot=day` — daytime in the city, on foot on the Strip
- `?shot=night` — night drive: headlights, lamp glow, lit windows
- `?shot=mission` — First Drop mission, beacon and objective marker
- `?shot=chase` — 3-star police chase in the rain, helicopter overhead

The four submission screenshots are `screenshots/`: 1-day, 2-night,
3-mission, 4-chase.

## Layout

- `game/index.html`, `game/style.css` — page shell
- `game/vendor/three.min.js` — vendored Three.js (offline runtime)
- `game/src/main.js` — boot, loop, state machine, save, shot staging
- `game/src/world.js` — procedural city: grid, buildings, lamps, parks, landmarks, districts
- `game/src/player.js` — on-foot movement, jump, health, respawn
- `game/src/vehicles.js` — car physics, nitro, damage, chop pricing
- `game/src/traffic.js` — traffic + pedestrian AI
- `game/src/police.js` — wanted system, cop state machine, helicopter
- `game/src/missions.js` — 8 story missions + taxi fares + hidden packages
- `game/src/combat.js` — weapons, ammo, hit math
- `game/src/render.js` — Three.js scene, day/night, weather, camera
- `game/src/hud.js` — HUD + circular minimap
- `game/src/audio.js` — synthesized SFX + music
- `game/src/input.js` — keyboard / mouse
- `game/src/save.js` — save / load (localStorage)
- `game/src/config.js` — all tuning numbers
- `game/src/utils.js` — math, seeded RNG, formatting
- `main.ts` — entrypoint: copies game/ + screenshots/ to /output, writes dossier.json
- `serve.ts` — tiny static server for local play
- `tests/test.mjs` — logic test suite (150 checks, Node only)
- `screenshots/` — 4 real renders of the game

---

Built for the [make.fun GTA 6 bounty](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01).
Want to build your own? Start at [make.fun](https://make.fun/?ref=26tnw136).
