# SOLMARINA — Open-World Crime Game

[![make.fun bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/roymaster46/gta6/rank.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/roymaster46/gta6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Solmarina** is an original top-down 2D open-world crime game set in a sun-soaked
coastal city. You are **Leo Marín**, a driver-for-hire who came back to Solmarina
with $50 and a borrowed jacket. Drive fares, steal cars, dodge the Solmarina PD —
and pull the heist of the decade.

Everything is original: the city, characters, vehicles, story, art and sounds.
No Rockstar / GTA names, characters, map, art or music are used. All art is drawn
in Canvas 2D and all sound is synthesized with WebAudio — the game ships as plain
static files and makes **zero network requests**.

## The city

A 2400×2400 open world: a road grid with traffic and sidewalks, a beach and ocean
edge, Palm Park with a plaza and benches, the port with docks and a getaway boat,
the Marina Bridge, the Solmarina Bank, a Pay-n-Spray garage, a hospital and Leo's
safehouse. Roadside billboards, beach kiosks and street lamps fill out the streets.
Camera follows you on foot and in a car.

## Systems

- **On foot** — WASD to move, Shift to sprint, mouse to aim, click to shoot.
- **Cars** — parked cars and live traffic driving road lanes. Press E to steal the
  nearest car; drive with WASD/arrows, Space for handbrake. Cars take damage and
  can be wrecked.
- **Traffic & pedestrians** — traffic AI follows road waypoints and brakes for
  jams; pedestrians stroll the sidewalks and flee gunfire and crashes. After dark
  the streets thin out, everyone walks slower, and a few night owls gather on the
  beach to watch the ocean.
- **Day / night cycle** — a six-minute day: long sunny day, dusk, a proper night,
  dawn. At night the sky deepens, windows light up warm yellow, street lamps glow,
  billboards bleed neon onto the street, your headlights cut a cone through the
  dark, traffic cruises slower, and the soundtrack swaps to a moodier minor
  groove. At dusk and dawn the golden hour stretches the shadows long and the sky
  turns orange-pink. The clock (sun/moon, phase, time) sits at the top of the HUD
  with a district pill naming where Leo is standing — Marina, Old Town, Downtown,
  Hospital Row, Palm Park, Portside, Safehouse Hills or Playa Sol. Mission 7 only
  runs after dark — start it in the daytime and Leo waits for nightfall.
- **Garage upgrade shop** — park in a car near the Pay-n-Spray and press G. Spend
  mission and fare money on Engine Tune (+15% top speed per level, 3 levels),
  Armour Plating (+50 car health per level, 3 levels), Grip Tires (+12% steering
  per level, 2 levels) and a Nitro Kit ($400). Upgrades stick to the car you are
  driving.
- **Nitro** — with the kit fitted, press N while driving for a 2.5-second boost
  (top speed ×1.6, flames out the exhaust), 8-second cooldown. The HUD shows a
  nitro gauge on the car card.
- **Wanted 0–5 stars** — car theft, shooting and running over peds raise heat.
  Foot cops chase and try to arrest you; police cars chase and ram, and they
  collide with buildings now instead of ghosting through them. At 4–5 stars the
  PD sets **roadblocks**: two police cars block the road ahead, sirens wailing,
  until you close in or the heat drops. Cops run a real state machine: they chase
  while they can see you, fall back to searching your last known position when
  the trail goes cold, and give up when the heat drops. At 4–5 stars a **police
  helicopter** joins from above: it spotlights you, calls ground units in faster,
  and can be shot down — $500 bounty and one star off. Heat decays when you stay
  clean; Pay-n-Spray clears your wanted level for cash. The HUD's PD RESPONSE
  panel lists the units on you — distance and CHASE / SEARCH / ROADBLOCK — and
  the minimap shows the pulsing red search zone around you.
- **Busted / Wasted** — arrested or killed, you lose some money and wake up at
  the hospital / safehouse.
- **Missions (12-story chain)** — 1) First Fare, 2) Hot Wheels, 3) Beach Shootout,
  4) The Getaway, 5) Solmarina Heist, 6) The Last Delivery (a timed 100-second
  run: grab the package at the port under 4-star heat and deliver it to the
  buyer's yacht at the marina — run out of time and the job fails, but you can
  retry it), 7) **Midnight Run** (a night job under 5-star heat — grab the
  package at the port, hit three checkpoints across the city, deliver to the
  safehouse in 150 seconds, $3,000), 8) Harbor Lights (three piers, 120 seconds,
  3-star heat from the first crate), 9) **The Solmarina Job** (the finale: steal
  the armored van outside the bank under 5-star heat and deliver it to the
  getaway boat, 180 seconds, $5,000), 10) King of Solmarina (survive 90 seconds
  of 5-star heat, $6,000), 11) Double Cross (the package at the port is a setup —
  four Viper hunters chase you to the safehouse, 150 seconds, $4,500), 12) The
  Last Sunset (five stops, one in every district, 200 seconds, $7,000) — each
  with a mission card (number, objective, stage progress, timer), a dialogue
  card where Rico or Maya talks to Leo, and a pulsing minimap marker. While a
  mission is active it outranks taxi fares everywhere (banner, world marker,
  off-screen arrow). Plus repeatable taxi fares for cash.
- **Side jobs** — between story jobs the city offers work: **courier runs**
  (parcel / fragile / VIP, faster pay for tighter windows, time bonus) and
  **Viper rampages** (clear a gang zone in 75 seconds for $350). Side jobs pay
  cash and REP; they never interrupt a story mission.
- **REP** — reputation earned from missions (+100), fares (+10), couriers (+15),
  rampages (+25), gang kills (+5), drifts (+5), near misses (+2) and shooting
  down the helicopter (+50). 500 REP per level; the HUD shows your REP level
  and progress.
- **Drift & near misses** — hold the handbrake and steer at speed to build a
  drift chain, then bank it as cash; scream past traffic at 120+ km/h for a
  $25 near-miss payout. Skid marks stay on the asphalt behind you.
- **Radio** — four original stations on C: Sol FM (sunny coastal groove),
  Noche FM (night jazz), Fuga FM (chase rock) and Onda FM (island grooves).
  The chase station takes over automatically at 3+ stars, and the HUD chip
  shows the station and the track playing.
- **Money, health, armor** — earn from missions and fares; pick up health,
  armor, an SMG, a shotgun, a rifle and found cash around the city.
- **HUD & minimap** — health/armor/stamina/REP bars, money, wanted stars,
  mission card, PD RESPONSE panel, dialogue card, weapon slots 1–4, car card
  (condition, speed, gear, nitro), clock + district pill, and a circular live
  minimap (player, cops, helicopter, garage, mission marker, roads, search zone).
- **Menus & save** — title screen with story intro, pause, busted/wasted screen
  with stats, restart; progress (money, missions, best) saves to localStorage.
- **Audio** — synthesized only: engine hum, gunshots, sirens, pickup blips, nitro
  whoosh, shop chime, helicopter rotor, skid squeal and a four-station radio
  soundtrack. M mutes.

## Controls

| Key | Action |
| --- | --- |
| WASD / Arrows | Move on foot / drive |
| Shift | Sprint |
| Mouse + Click | Aim / shoot |
| E | Enter / exit nearest car |
| F | Start next mission (near the garage while wanted: Pay-n-Spray instead) |
| G | Upgrade shop (in a car, near the garage) |
| N | Nitro boost (car with the kit fitted) |
| H | Horn (while driving) |
| 1 / 2 / 3 / 4 | Pistol / SMG / Shotgun / Rifle (in the shop: buy upgrades) |
| C | Cycle radio station |
| Space | Handbrake |
| P / Esc | Pause |
| M | Mute |
| R | Restart |

## How to run

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no install, no network. Any static file server works; open
`game/index.html` from a server (ES modules need http, not `file://`).

## Screenshots

Deterministic scenes are staged with `?shot=<name>&seed=1`:

- `?shot=chase` — 3-star police chase in the Marina GT
- `?shot=mission` — beach shootout against the Vipers
- `?shot=night` — night drive: headlights, lamp glow, Mission 7 Midnight Run
- `?shot=police` — 4-star roadblock escape
- `?shot=finale` — Mission 9 The Solmarina Job: armored van, 5-star heat, heli

The four submission screenshots are `shots.json`: 1-cover = finale, 2-mission =
mission, 3-night = night, 4-police = police.

## Layout

- `game/index.html`, `game/style.css` — page shell
- `game/src/main.js` — boot, loop, state machine, save, shot staging
- `game/src/city.js` — map, roads, buildings, collision, billboards, plaza, kiosks, 8 districts
- `game/src/daynight.js` — day/night cycle: phases, light level, clock label, golden hour
- `game/src/garage.js` — upgrade shop: engine / armour / nitro / grip tires, pricing
- `game/src/player.js` — on-foot + driving control, nitro, stamina, drift chains, damage, respawn
- `game/src/vehicles.js` — car physics, traffic AI, upgrades in the drive model, Moto Sol
- `game/src/peds.js` — pedestrian AI, day/night behaviour, night owls, chatting pairs
- `game/src/police.js` — wanted level, cop state machine, helicopter, roadblocks
- `game/src/missions.js` — story chain (12 missions, dialogue, fail reasons) + taxi fares
- `game/src/sidejobs.js` — courier runs + Viper rampages
- `game/src/radio.js` — 4 radio stations, tracks, chase music
- `game/src/combat.js` — weapons (incl. rifle), bullets (incl. helicopter hits), pickups
- `game/src/render.js` — world, night lighting, golden-hour shadows, HUD, shop, circular minimap, menus
- `game/src/audio.js` — synthesized SFX + radio stations + chase music
- `game/src/input.js` — keyboard / mouse
- `game/src/utils.js` — math, seeded RNG, REP levels, helpers
- `main.ts` — entrypoint: copies game/ + screenshots/ to /output, writes dossier.json
- `screenshots/` — 4 real renders of the game

---

Built for the [make.fun GTA 6 bounty](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01).
Want to build your own? Start at [make.fun](https://make.fun/?ref=26tnw136).
