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
The Docklands hide a chop shop that buys stolen cars, and the Portside holds the
PD impound lot where towed cars wait to be bought back. Camera follows you on
foot and in a car.

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
  with a district pill naming where Leo is standing — one of sixteen districts:
  Marina, Yacht Basin, Old Town, Market Square, Downtown, Civic Center, Hospital
  Row, University Quarter, Palm Park, Rose Gardens, Portside, Docklands, Safehouse
  Hills, Sunset Ridge, Playa Sol and Coral Beach, each with its own flavour line
  and a $25 discovery bonus on first visit. Mission 7 only
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
- **Notoriety** — heat is the chase you are in now; notoriety (0–100) is the name
  you carry between chases. Every crime adds a slice of it, and it only fades
  after a long clean stretch. At 60+ the PD answers faster, the helicopter flies
  at 3 stars instead of 4, and Pay-n-Spray charges a $50 surcharge for a face the
  whole precinct recognises. Clearing your stars never clears your name — only
  staying clean does. The PD RESPONSE panel shows your notoriety band, from
  Unknown to Most Wanted.
- **Chop shop & impound** — drive a stolen car to the Chop Shop in the Docklands
  and press F to sell it to the crusher: payout follows the model and the
  condition (a clean Marina GT pays $420, a wreck pays a quarter), one sale
  every 45 seconds, and every sale adds heat and notoriety. The shop will not
  touch a police car or a car a mission still needs. Get busted or wasted while
  driving and the PD tows your car to the Impound Lot in Portside — press F
  there to buy it back for $200, upgrades included. The lot holds one car.
- **Busted / Wasted** — arrested or killed, you lose some money and wake up at
  the hospital / safehouse.
- **Weapon wheel** — hold Q and the world freezes on a radial menu: six slots
  (Pistol, SMG, Shotgun, Rifle, Molotov, Revolver), each with ammo and price.
  Locked slots can be bought on the spot from the wheel. Mouse-wheel scroll
  cycles owned guns without opening the wheel; 1–6 are the hotkeys.
- **Carjacking** — stealing a driven car is a fight now: press E on a traffic
  car and Leo hauls the driver out over 0.6–1.6 seconds while the driver
  struggles — tough drivers and Viper drivers fight back (a swing for 10 HP
  before they flee), and one car in ten trips its alarm, bringing a star and
  the cops to Leo's position. Parked cars are still a quiet E.
- **Respect & district control** — REP is now a ladder with six tiers
  (Nobody → Wheelman → Hustler → Made Man → Shot Caller → King of Solmarina),
  each with a real perk: fares tip 10% more, the chop shop pays 10% more, the
  garage gives a 15% discount, Vipers hold fire in districts Leo owns, and
  safehouse healing is free. Every district has a control meter fed by work
  done inside it; owning a district (100) pays +75 REP. Busted costs 150 REP,
  wasted 100, a failed mission 25.
- **Shops & safehouses** — three stores with doors on the map (press F):
  **Marina Arms** (guns + ammo), **Sol Diner** (food heals: empanada +25 HP,
  platter +60, feast full heal + armor) and **Coral Clothing** (Street / Sharp /
  Ghost outfits — sprint speed, fare tips, faster wanted decay). The
  **Marina Penthouse** ($4,000) is the late-game money sink: ownable safehouse
  with free healing and a garage slot. Resting at any owned safehouse heals
  Leo and autosaves. Shopkeepers stand at each door.
- **Save system v2** — three save slots (slot 1 is the old save, migrated),
  autosave every 45 seconds, save on mission completion, race win, chop sale
  and safehouse rest. A slot holds money, story progress, respect + district
  control, weapon unlocks and ammo, garage cars, safehouses and lifetime stats.
- **Weather** — the day cycle carries a weather band: clear, cloudy, then rain
  (260–320s). Rain draws streaks across the screen and trims grip 8%.
- **SWAT at 5 stars** — the PD stops sending patrol cars at 5 stars and sends
  SWAT vans instead. Wanted heat also decays faster when Leo is respected.
- **Turf war** — once Leo owns a district, the Vipers hit back: every 90–150
  seconds of free roam they attack an owned district with four hunters and a
  60-second clock. Clear them for +$500 and +150 REP; lose and the district
  drops to half control and −50 REP. A red banner and minimap diamond mark
  the district under attack.
- **Hidden packages** — twenty gold stashes tucked across all sixteen districts
  (under the bridge, behind the hospital, on the beach…). Walk over one for
  +$100 and +10 REP; all twenty pay a $1,000 Treasure Hunter bonus. The
  nearest unfound package shows on the minimap.
- **Missions (16-story chain)** — 1) First Fare, 2) Hot Wheels, 3) Beach Shootout,
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
  Last Sunset (eight stops, one in each of eight districts, 260 seconds, $8,000),
  13) Rico's Revenge (clear eight Vipers from the Docklands warehouse, $5,500),
  14) Four Drops (four smuggling drops across the map in 200 seconds, $6,500),
  15) Smoke on the Water (burn the Vipers' three stash cars at the port, $7,000),
  16) Sunset King (survive 120 seconds of 5-star heat, then claim the crown at
  the yacht, $10,000)
  — each with a mission card (number, objective, stage progress, timer), a dialogue
  card where Rico or Maya talks to Leo, and a pulsing minimap marker. While a
  mission is active it outranks taxi fares everywhere (banner, world marker,
  off-screen arrow). Plus repeatable taxi fares for cash.
- **Side jobs** — between story jobs the city offers work: **courier runs**
  (parcel / fragile / VIP / Midnight — the Midnight parcel only runs after dark
  for respected drivers and pays triple, faster pay for tighter windows, time bonus),
  **Viper rampages** (clear a gang zone in 75 seconds for $350) and **vigilante
  takedowns** (a Viper getaway car flees across the city — wreck it by ramming
  or shooting within 90 seconds for $400). Side jobs pay
  cash and REP; they never interrupt a story mission.
- **Street racing** — the Solmarina Street Circuit: three circuits on the
  city's own road grid, each with a checkered start pad you drive to. **Marina
  Sprint** (2 laps, 4 gates, $50 entry, $300 prize), **Downtown Loop** (2 laps,
  6 gates, $100 entry, $650 prize) and the **Coastal Grand Prix** (2 laps, 10
  gates, $200 entry, $1,500 prize — only opens once you have won the Downtown
  Loop). Press T in a car at a pad to enter: a 3-2-1-GO countdown, then race
  the gates against a gold pace-rival car running the loop at a fixed speed.
  Beat the rival to the line for 1st place and the full prize; finish behind
  it for 2nd and a quarter. Beat your best time on a circuit for a $100 bonus
  (best times save between sessions). Wins feed a **championship ladder**
  (10 pts a win, 1 a finish — Street Legend at 100 pts) shown on the pause
  screen. The HUD shows a race panel (timer, lap,
  gate, 1st/2nd, best, prize), the world shows every gate (cleared green,
  next pulsing gold), and the minimap marks the pads and the next gate. Quit
  with T mid-race, wreck the car, leave the car or run out the 10-minute clock
  and the entry fee is gone — street racing does not do refunds.
- **REP** — reputation earned from missions (+100), fares (+10), couriers (+15),
  rampages (+25), vigilante takedowns (+30), chop-shop sales (+10), gang kills (+5), drifts (+5), near misses (+2) and shooting
  down the helicopter (+50), plus race wins (Marina +40, Downtown +60, Grand
  Prix +100; 2nd place pays half). 500 REP per level; the HUD shows your REP level
  and progress.
- **Drift & near misses** — hold the handbrake and steer at speed to build a
  drift chain, then bank it as cash; scream past traffic at 120+ km/h for a
  $25 near-miss payout. Skid marks stay on the asphalt behind you.
- **Radio** — four original stations on C: Sol FM (sunny coastal groove),
  Noche FM (night jazz), Fuga FM (chase rock) and Onda FM (island grooves).
  The chase station takes over automatically at 3+ stars, and the HUD chip
  shows the station and the track playing.
- **Money, health, armor** — earn from missions and fares; pick up health,
  armor, an SMG, a shotgun, a rifle and found cash around the city. Buy the
  Molotov and Revolver at Marina Arms.
- **HUD & minimap** — health/armor/stamina/REP bars, money, wanted stars,
  mission card, PD RESPONSE panel, dialogue card, weapon slots 1–6, car card
  (condition, speed, gear, nitro), clock + district pill, and a circular live
  minimap (player, cops, helicopter, garage, shops, safehouses, mission marker, roads, search zone).
- **Menus & save** — title screen with story intro, pause (now with respect tier,
  districts owned and race-series standing), busted/wasted screen
  with stats, restart; progress saves to three localStorage slots with autosave.
- **Audio** — synthesized only: engine hum, gunshots, sirens, pickup blips, nitro
  whoosh, shop chime, helicopter rotor, skid squeal, car alarm, save chime and a four-station radio
  soundtrack with DJ chatter. M mutes.

## Controls

| Key | Action |
| --- | --- |
| WASD / Arrows | Move on foot / drive |
| Shift | Sprint |
| Mouse + Click | Aim / shoot |
| E | Enter / exit nearest car (a driven car starts a carjack struggle) |
| F | Start next mission (near the garage while wanted: Pay-n-Spray; in a car at the chop shop: sell the car; at the impound lot: reclaim your car; at a shop door: open the shop; at the penthouse: buy it) |
| Q | Weapon wheel (hold — mouse picks, release equips) |
| T | Start a street race at the nearest start pad (in a car) / quit a race in progress |
| G | Upgrade shop (in a car, near the garage) |
| N | Nitro boost (car with the kit fitted) |
| H | Horn (while driving) |
| 1 / 2 / 3 / 4 / 5 / 6 | Pistol / SMG / Shotgun / Rifle / Molotov / Revolver (in the shop: buy upgrades; in a store: select row) |
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
- `?shot=wheel` — weapon wheel open on foot at dusk, SMG owned, 2 stars
- `?shot=store` — Marina Arms gun store overlay, Leo at the door
- `?shot=night` — night drive: headlights, lamp glow, Mission 7 Midnight Run
- `?shot=police` — 4-star roadblock escape
- `?shot=finale` — Mission 9 The Solmarina Job: armored van, 5-star heat, heli
- `?shot=race` — street race mid-flight: Marina Sprint, gates, rival pace car, race HUD

The four submission screenshots are `shots.json`: 1-cover = finale, 2-mission =
wheel, 3-night = night, 4-police = police.

## Layout

- `game/index.html`, `game/style.css` — page shell
- `game/src/main.js` — boot, loop, state machine, save, shot staging
- `game/src/save.js` — save system v2: three slots, autosave, migration, stats
- `game/src/respect.js` — respect tiers, perks, district control
- `game/src/weaponwheel.js` — weapon wheel, hotkeys, scroll cycle, wheel shop
- `game/src/shops.js` — gun store, diner, clothing, safehouses, penthouse
- `game/src/carjack.js` — carjacking struggle, driver resistance, alarms
- `game/src/gangwar.js` — Viper turf-war attacks on owned districts
- `game/src/collectibles.js` — twenty hidden packages across the city
- `game/src/achievements.js` — twenty achievements with cash payouts
- `game/src/city.js` — map, roads, buildings, collision, billboards, plaza, kiosks, 16 districts, chop shop + impound lot + shop landmarks
- `game/src/chopshop.js` — chop-shop sales (model + condition pricing, cooldown) and the impound-lot reclaim
- `game/src/daynight.js` — day/night cycle: phases, light level, clock label, golden hour
- `game/src/garage.js` — upgrade shop: engine / armour / nitro / grip tires / bulletproof tires, pricing, respect discount
- `game/src/player.js` — on-foot + driving control, nitro, stamina, drift chains, damage, respawn
- `game/src/vehicles.js` — car physics, traffic AI, upgrades in the drive model, Moto Sol
- `game/src/peds.js` — pedestrian AI, day/night behaviour, night owls, chatting pairs
- `game/src/police.js` — wanted level, notoriety, cop state machine, helicopter, roadblocks
- `game/src/missions.js` — story chain (16 missions, dialogue, fail reasons) + taxi fares; M12 grand tour visits 8 districts; M13-16 close the Viper war
- `game/src/sidejobs.js` — courier runs (incl. Midnight parcel) + Viper rampages + vigilante takedowns
- `game/src/races.js` — street circuit: 3 circuits, countdown, gates, pace rival, prizes, best times, Grand Prix unlock, championship ladder
- `game/src/radio.js` — 4 radio stations, tracks, DJ chatter, chase music
- `game/src/combat.js` — weapons (incl. molotov + revolver), bullets (incl. helicopter hits), pickups
- `game/src/render.js` — world, night lighting, golden-hour shadows, HUD, shop, weapon wheel, store overlay, circular minimap, menus
- `game/src/audio.js` — synthesized SFX + radio stations + chase music
- `game/src/input.js` — keyboard / mouse
- `game/src/utils.js` — math, seeded RNG, REP levels, helpers
- `main.ts` — entrypoint: copies game/ + screenshots/ to /output, writes dossier.json
- `screenshots/` — 4 real renders of the game

---

Built for the [make.fun GTA 6 bounty](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01).
Want to build your own? Start at [make.fun](https://make.fun/?ref=26tnw136).
