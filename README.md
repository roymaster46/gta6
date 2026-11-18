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
  your headlights cut a cone through the dark, traffic cruises slower, and the
  soundtrack swaps to a moodier minor groove. The clock (sun/moon, phase, time)
  sits at the top of the HUD. Mission 7 only runs after dark — start it in the
  daytime and Leo waits for nightfall.
- **Garage upgrade shop** — park in a car near the Pay-n-Spray and press G. Spend
  mission and fare money on Engine Tune (+15% top speed per level, 3 levels),
  Armour Plating (+50 car health per level, 3 levels) and a Nitro Kit ($400).
  Upgrades stick to the car you are driving.
- **Nitro** — with the kit fitted, press N while driving for a 2.5-second boost
  (top speed ×1.6, flames out the exhaust), 8-second cooldown. The HUD shows a
  nitro gauge above the speedometer.
- **Wanted 0–5 stars** — car theft, shooting and running over peds raise heat.
  Foot cops chase and try to arrest you; police cars chase and ram, and they
  collide with buildings now instead of ghosting through them. Cops run a real
  state machine: they chase while they can see you, fall back to searching your
  last known position when the trail goes cold, and give up when the heat drops.
  At 4–5 stars a **police helicopter** joins from above: it spotlights you,
  calls ground units in faster, and can be shot down — $500 bounty and one star
  off. Heat decays when you stay clean; Pay-n-Spray clears your wanted level
  for cash.
- **Busted / Wasted** — arrested or killed, you lose some money and wake up at
  the hospital / safehouse.
- **Missions (7-story chain)** — 1) First Fare, 2) Hot Wheels, 3) Beach Shootout,
  4) The Getaway, 5) Solmarina Heist, 6) The Last Delivery (a timed 100-second
  run: grab the package at the port under 4-star heat and deliver it to the
  buyer's yacht at the marina — run out of time and the job fails, but you can
  retry it), 7) **Midnight Run** (the finale: a night job under 5-star heat —
  grab the package at the port, hit three checkpoints across the city, deliver
  to the safehouse in 150 seconds, $3,000) — each with an objective banner and
  a pulsing minimap marker. While a mission is active it outranks taxi fares
  everywhere (banner, world marker, off-screen arrow). Plus repeatable taxi
  fares for cash.
- **Money, health, armor** — earn from missions and fares; pick up health,
  armor, an SMG, a shotgun and found cash around the city.
- **HUD & minimap** — health/armor bars, money, wanted stars, objective text,
  speedometer, nitro gauge, clock, and a live minimap (player, cops, helicopter,
  garage, mission marker, roads).
- **Menus & save** — title screen with story intro, pause, busted/wasted screen
  with stats, restart; progress (money, missions, best) saves to localStorage.
- **Audio** — synthesized only: engine hum, gunshots, sirens, pickup blips, nitro
  whoosh, shop chime, helicopter rotor and a day/night soundtrack. M mutes.

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
| 1 / 2 / 3 | Pistol / SMG / Shotgun (in the shop: buy upgrades) |
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

## Layout

- `game/index.html`, `game/style.css` — page shell
- `game/src/main.js` — boot, loop, state machine, save, shot staging
- `game/src/city.js` — map, roads, buildings, collision, billboards, plaza, kiosks
- `game/src/daynight.js` — day/night cycle: phases, light level, clock label
- `game/src/garage.js` — upgrade shop: engine / armour / nitro, pricing
- `game/src/player.js` — on-foot + driving control, nitro, damage, respawn
- `game/src/vehicles.js` — car physics, traffic AI, upgrades in the drive model
- `game/src/peds.js` — pedestrian AI, day/night behaviour, night owls
- `game/src/police.js` — wanted level, cop state machine, helicopter
- `game/src/missions.js` — story chain (7 missions) + taxi fares
- `game/src/combat.js` — weapons, bullets (incl. helicopter hits), pickups
- `game/src/render.js` — world, night lighting, HUD, shop, minimap, menus
- `game/src/audio.js` — synthesized SFX + day/night music
- `game/src/input.js` — keyboard / mouse
- `game/src/utils.js` — math, seeded RNG, helpers
- `main.ts` — entrypoint: copies game/ + screenshots/ to /output, writes dossier.json
- `screenshots/` — 4 real renders of the game

---

Built for the [make.fun GTA 6 bounty](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01).
Want to build your own? Start at [make.fun](https://make.fun/?ref=26tnw136).
