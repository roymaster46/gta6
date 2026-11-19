# EMBER HARBOR — Open-World Crime Game

[![make.fun bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/roymaster46/gta6/rank.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/roymaster46/gta6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Ember Harbor** is an original 3D open-world crime game set in Rust Harbor, a
gritty harbour city of nine districts — now twelve, with the Night Market,
the Docks, Foundry Row Industrial, the Marina and Lantern Row. You are
**Vex Marlowe**, a courier who came back to the harbour with $60 and a
borrowed jacket. Run jobs, steal cars, sail boats, dodge the Harbor PD —
and pull the heist of the decade.

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
- **Helicopter** — a flyable chopper waits at the Harbor Heliport. Press E
  to board (taking it costs 2 stars), Space climbs, X descends, WASD flies,
  E lands and steps out. Fuel burns while the engine runs; refuel at the
  heliport for $150 (G). The Skyhook mission flies you to the Harborview
  Tower roof, and the Harbor Heist finale escapes by air.
- **Gun shop** — Iron Annie Guns in Gunshop Alley sells the Wasp SMG, the
  Boomstick, the Longshot Rifle, ammo for all of them, kevlar vests (+50
  armour, absorbs damage before health) and medkits. Press B at the shop:
  first press opens the catalogue, second press buys the selected item.
- **Safehouses** — Vex's safehouse in Hillcrest and a second one in
  Northgate. Press G there to heal for $50, sleep until morning (full heal,
  wanted cleared) when healthy, or store the car you are driving in the
  garage (up to 4 cars).
- **Vigilante work** — press V to take a wanted-criminal job: a red marker
  shows the target, who flees on foot and shoots back up close. Take them
  down for $180–$340, paid by the Harbor PD.
- **Ambient events** — the city keeps living while you work: robberies,
  police chases, street races, ambulances, brawls and VIP escorts spawn on
  a timer with an orange marker. Catch the robber, break up the brawl or
  out-drive the racer (3 overtakes) for a cash reward.
- **Stamina & stealth** — sprinting drains stamina (walk when it runs dry),
  and Ctrl crouches: half speed, quiet enough for the Ghost stealth job,
  where any heat at all blows the mission.
- **Traffic & pedestrians** — traffic AI follows the streets, brakes for the
  car ahead and for you standing in the road; motorbikes weave through
  traffic and heavy trucks crawl. Pedestrians have archetypes — joggers run,
  vendors stand at their corners, tourists dawdle — and flee gunfire,
  crashes and speeding cars. Hit one while driving and the city notices.
- **Day / night cycle** — a six-minute day: sunny day, dusk, a proper night,
  dawn. At night the sky deepens, windows light up warm yellow, street lamps
  glow, billboards bleed neon, and your headlights cut a cone through the
  dark. Rain and fog roll in on their own schedule. The clock and district sit
  at the top of the HUD.
- **Wanted 0–5 stars** — car theft, shooting, running over peds and robberies
  raise heat. Foot cops chase and try to arrest you (2.2 s in their grip and
  you are busted); police cars chase and ram; at 4 stars a **police
  helicopter** joins from above and spotlights you, and roadblocks seal the
  avenues ahead. At **5 stars** the response changes completely: **SWAT
  troopers** who shoot on sight, **FIB interceptors** that box your car in
  and ram harder, and an **armed police helicopter** firing bursts from
  above. The Longshot Rifle is the only gun with the range to shoot a
  police heli down. Cops search your last
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
- **Combat** — fists, P9 pistol, Wasp SMG, Boomstick shotgun and Longshot
  Rifle (1–5 to switch), with ammo, range, fire rate and pellet spread per
  weapon, R to reload, and kevlar armour that absorbs damage first. Gang
  members and SWAT shoot back. Click or F to fire.
- **Missions (22-story chain in 3 acts)** — 1) First Drop (courier run, 3 drops),
  2) Hot Wheels (steal the Falcon GT, deliver it to the chop shop),
  3) Street Circuit (3 laps, 8 gates a lap against the clock),
  4) Payback (clear the Dockside crew, 4 gang members),
  5) Heat Wave (lose a 3-star chase), 6) Night Shift (3 taxi fares),
  7) Smash & Grab (grab the bank courier case, vanish),
  8) The Big One (steal a fast car, take the ferry payroll,
  lose the whole harbour PD, bring it home — $1,500),
  9) Skyhook (fly the heli to the Tower roof),
  10) Midnight Run (4 timed drops with speed bonuses),
  11) Ghost (stealth: reach the casino vault with zero heat),
  12) Turf War (hold the Pier against waves for 120 s),
  13) Tail Job (tail the courier 45 s without being spotted),
  14) Harbor Heist (the finale: vault gold, 5-star escape by helicopter —
  $2,000), 15) Ferry Gambit (board the ferry by boat, take the manifest),
  16) The Last Ferry (escort Mara's people, hold the dock),
  17) Harbor King (take Warehouse 9, the casino floor and the docks —
  $2,500), 18) Market Courier (5 timed drops through the night market),
  19) Ambulance Hero (3 patients to St. Anselm),
  20) Street Champion (5-lap championship),
  21) Bounty Hunter (4 names on the board),
  22) Fishing Charter (tourists at dawn). Each has a timer, a pulsing beacon in the world and on the
  minimap, and a cash reward. Start the next job at the South Pier.
  The three-act story wraps them: Act I Coming Home, Act II The Night
  Market, Act III Seven Stars — with cutscene dialogue from Mara, Rusty,
  Iron Annie, Juno, Sal Kett, Ibrahim Hale and Doc Anselm, and a chapter
  bonus every time an act chapter closes.
- **Side jobs** — taxi fares for cash (pick up at the cyan marker, drop off
  for $45 plus tips), vigilante jobs (press V) and **16 hidden packages**
  tucked across the city, $120 each.
- **r7 systems** — **Story campaign**: 8 chapters in 3 acts with cutscene
  dialogue and chapter bonuses. **Crowds**: groups that walk together,
  queue at stalls, cross streets and panic as one when gunfire starts.
  **Weather that matters**: rain makes roads slick (longer braking, more
  drift), fog cuts police sight range, night patrols are stricter (heat
  builds faster, roadblocks at 3 stars), storms ground the helicopter.
  **Boats**: steal a Harbor Runner at the pier and sail the water strip —
  the Ferry Gambit and Fishing Charter missions run on it. **New
  vehicles**: Comet R sports bike, Harborview limo, ambulance, bus and
  Iron V8 muscle car, each with its own handling. **Interiors**: walk
  into the gun-shop back room, the casino floor, the hospital ward,
  Juno's tea house, the ferry office and Warehouse 9 (T at a glowing
  doorway) — each with loot or a contact. **Night market**: six stalls
  that sell healing food, stamina tea and harbour intel after dark.
  **Side jobs (Q)**: taxi shifts with ratings, ambulance runs, a
  street-race series with a leaderboard, courier deliveries, a bounty
  board (alive pays double) and fishing charters. **Effects**: particles
  (smoke, sparks, splashes), screen shake, skid marks, and slow motion
  on long-range headshots. **New weapons**: Iron Revolver (6) and the
  silenced Whisper (7, builds no heat). **Seven-star legend**: rep
  tiers 1–7 above the 5-star wanted level — at 6 stars the Harbor
  Marshal (260 HP, never gives up) hunts you. **Skills**: driving,
  shooting, swimming and flying grow with use.
- **HUD & minimap** — cash, health, armour, stamina, wanted stars, weapon
  + ammo, mission card with timer and live step progress, car card (health,
  nitro, speed) or heli card (altitude, fuel, health), score, mission/
  package/fare/vigilante/event progress, and a circular live minimap
  (player arrow, streets, water, objective beacon, cops, SWAT, FIB cars,
  roadblocks, heli, fares, events).
- **Save** — progress autosaves every 25 seconds and on mission completion
  (cash, health, missions, packages, fares, weapons, armour, shop, safehouse,
  vigilante, events, heli fuel, position, time of day) to localStorage;
  your best score persists between visits. Saves from the previous version
  still load.
- **Audio** — synthesized only: engine hum that follows your speed, sirens,
  gunshots, pickup blips, cash chimes, mission fanfare and a moody bass line
  while you drive. M mutes.

## Controls

| Key | Action |
| --- | --- |
| WASD / Arrows | Move on foot / drive |
| Shift | Sprint on foot / handbrake in a car |
| Mouse drag | Orbit camera (wheel zooms) |
| Click / F | Shoot / punch |
| E | Enter / exit nearest car, board / leave helicopter, start next mission at the Pier, grab a case |
| G | Context action: spray shop (clear wanted) / chop shop (sell car) / safehouse (heal, sleep, store car) / heliport (refuel) |
| N | Nitro boost (while driving) |
| H | Horn |
| 1 / 2 / 3 / 4 / 5 | Fists / Pistol / SMG / Shotgun / Rifle |
| B | Gun shop (at Iron Annie Guns): open, then buy selected item |
| V | Vigilante job: take the next wanted criminal |
| Q | Side job: taxi / ambulance / courier / bounty / fishing (rotates) |
| T | Enter doorway / buy at a market stall (or leave an interior) |
| 6 / 7 | Iron Revolver / Whisper Silenced |
| X | Descend in the helicopter |
| R | Reload current weapon |
| Ctrl | Crouch / sneak (stealth jobs) |
| Space | Jump on foot / climb in the helicopter |
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
- `?shot=mission` — Skyhook mission at the Harbor Heliport, flyable helicopter on its pad
- `?shot=chase` — 5-star police response in the rain: SWAT, FIB interceptor, roadblock, helicopter overhead

The four submission screenshots are `screenshots/`: 1-day, 2-night,
3-mission, 4-chase.

## Layout

- `game/index.html`, `game/style.css` — page shell
- `game/vendor/three.min.js` — vendored Three.js (offline runtime)
- `game/src/main.js` — boot, loop, state machine, save, shot staging
- `game/src/world.js` — procedural city: grid, buildings, lamps, parks, landmarks, districts, heli pads
- `game/src/player.js` — on-foot movement, jump, stamina, crouch, health, respawn
- `game/src/vehicles.js` — car physics, nitro, damage, chop pricing, bikes, trucks, garage upgrades
- `game/src/traffic.js` — traffic + pedestrian AI, ped archetypes
- `game/src/police.js` — wanted system, cop state machine, helicopter, roadblocks
- `game/src/heli.js` — flyable player helicopter + police heli air response
- `game/src/swat.js` — 5-star SWAT troopers, FIB interceptors, roadblocks
- `game/src/shops.js` — gun shop, safehouses, vigilante jobs, VIP fares
- `game/src/events.js` — ambient city events + ped archetype catalogue
- `game/src/missions.js` — 14 story missions + taxi fares + hidden packages
- `game/src/missions-extra.js` — the 6 r6 story jobs (Skyhook, Midnight Run, Ghost, Turf War, Tail Job, Harbor Heist)
- `game/src/missions-r7.js` — the 8 r7 story jobs (Ferry Gambit, Last Ferry, Harbor King, Market Courier, Ambulance Hero, Street Champion, Bounty Hunter, Fishing Charter)
- `game/src/story.js` — three-act story campaign: 8 chapters, cutscene dialogue, chapter bonuses
- `game/src/crowd.js` — crowd AI: groups, panic, street crossings, stall queues
- `game/src/weather.js` — weather + day/night gameplay rules (slick roads, fog sight, night patrols, storm grounding)
- `game/src/boats.js` — boats, sports bike, limo, ambulance, bus, muscle car + handling table
- `game/src/interiors.js` — six enterable interiors + night-market stalls + dock/foundry props
- `game/src/sidejobs.js` — taxi, ambulance, street-race series, courier, bounty board, fishing
- `game/src/fx.js` — particles, screen shake, slow-mo, muzzle flashes, skid marks, explosions
- `game/src/combat.js` — weapons, ammo, reload, armour, rifle anti-heli fire, hit math
- `game/src/render.js` — Three.js scene, day/night, weather, camera, heli/SWAT/roadblock/event meshes
- `game/src/hud.js` — HUD + circular minimap
- `game/src/audio.js` — synthesized SFX + music, rotor, SWAT siren, shop bell
- `game/src/input.js` — keyboard / mouse
- `game/src/save.js` — save / load v2 (localStorage), v1 saves still load
- `game/src/config.js` — all tuning numbers
- `game/src/utils.js` — math, seeded RNG, formatting
- `main.ts` — entrypoint: copies game/ + screenshots/ to /output, writes dossier.json
- `serve.ts` — tiny static server for local play
- `tests/test.mjs` — logic test suite (262 checks r6, 340+ checks r7, Node only)
- `screenshots/` — 4 real renders of the game

---

Built for the [make.fun GTA 6 bounty](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01).
Want to build your own? Start at [make.fun](https://make.fun/?ref=26tnw136).
