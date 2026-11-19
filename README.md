# SOLARA BAY — Open-World Crime Game

[![make.fun bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/roymaster46/gta6/rank.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/roymaster46/gta6/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Solara Bay** is an original 3D open-world crime game set in a sun-soaked
coastal city with a countdown hanging over it: **Hurricane Vera makes
landfall in 7 days**. You are **Rin Kade**, a storm-courier turned wheelman
for the **Stormbreakers** crew. The Tide Kings are hoarding the city's
storm-relief cash — steal it back, run ten story missions, and deliver it to
the shelters before the storm surge swallows the bay.

Everything is original: the city, characters, vehicles, story and sounds. No
Rockstar / GTA names, characters, map, art or music are used. All art is
procedural Three.js geometry with canvas-generated textures, all sound is
synthesized with WebAudio, and the game ships as plain static files and makes
**zero network requests** at runtime (Three.js r160 is vendored under
`game/vendor/`).

## The city

A 920×920 m open world on a street grid: ten districts — The Marina, Old
Town, Bayfront, Boardwalk, Downtown, The Harbor, Crosstown, Palm Court,
Storm Point and South Beach — each with its own flavour line on the HUD.
Parks, plazas, neon signs, street lamps, a beach and ocean to the south,
plus landmarks you will learn by heart: the Storm Point lighthouse, the
Boardwalk ferris wheel, the Harbor Trust bank, Otis Garage in Crosstown,
Iron Annie Guns downtown, and Rin's safehouse in Palm Court.

## The hook: 7 days to landfall

Every in-game day the storm gets closer. The sky darkens, the wind picks
up, rain starts falling, and the countdown on the HUD ticks down. Sleeping
at a safehouse advances to the next morning — and the next chapter of the
story. On day 7, Hurricane Vera hits, and the finale mission **Landfall**
is the last run of your life.

## Systems

- **On foot** — WASD to move, Shift to sprint, Space to jump, mouse drag to
  orbit the camera. Camera-relative movement, building collision with
  sliding.
- **Cars** — parked cars and live traffic on the road grid. Press E to steal
  the nearest car (that is a crime — the PD notices); drive with
  WASD/arrows, Shift for handbrake, N for nitro (top speed ×1.65). Cars take
  damage, smoke, and can be wrecked. Six cars, from the Dune Beater to the
  Tempest GT.
- **Police, 5 stars** — wanted level rises with every crime and decays when
  you stay hidden. 1–2 stars: patrol cars chase you. 3+: a police
  helicopter joins the hunt. 4+: roadblocks. 5 stars: the whole Bayfront PD.
  Bribe them at any time (button in the HUD) or sleep it off at a safehouse.
- **Combat** — 5 weapons (Fists, Surge P9 pistol, Riptide SMG, Breaker 12
  shotgun, Longhaul Rifle) with a weapon wheel (Q) and slots (1–5), ammo,
  and enemies that shoot back. Kevlar vests absorb damage before health.
- **Story missions** — 10 staged missions across the 7 days (M to open the
  list): fuel-truck theft, carjacking, a relay sabotage, a boardwalk brawl,
  a hot courier run, a midnight street race, a blackout escort, the Harbor
  Heist, a convoy chase, and the Landfall finale. Each mission pays cash
  and respect.
- **Crew** — recruit Jax (driver, longer nitro), Luma (hacker, wanted
  decays faster), Otis (mechanic, half-price repairs) and Mara (fixer, 15%
  shop discount). Each has a real gameplay perk.
- **Garage & shop** — Otis Garage (G in Crosstown) sells cars and upgrades:
  tuned engines, nitro kit, plated body, grip tires, repairs. Iron Annie
  Guns (B) sells weapons, ammo, armor — and recruits crew.
- **Respect & rank** — earn respect from missions, races and jobs to climb
  from Nobody to Runner, Wheelman, Hustler, Stormbreaker, Bay Legend and
  King of the Bay.
- **Side jobs** — taxi fares, courier runs, vigilante hits and street races
  (V for a vigilante job on the spot).
- **A living city** — 12 traffic cars cruising the grid, 16 pedestrians who
  flee when crimes happen, a day/night cycle with golden-hour sunsets,
  weather that worsens as Vera approaches, rain, and storm clouds that
  thicken and race across the sky.
- **Radio** — 4 synthesized stations (R to cycle): WAVE 98.4 surf pop,
  STORM FM night drive, HARBOR TALK storm watch, NEON 101 synthwave. All
  music is generated live by WebAudio — no audio files.
- **Safehouses** — Palm Court and Old Town. Heal for $50 or sleep until
  morning (full heal, wanted cleared, day advances).
- **Save** — autosaves every 30 seconds and on demand (💾 Save button) to
  localStorage; progress, money, weapons, cars, crew and missions all
  persist.

## Controls

| Key | Action |
| --- | ------ |
| WASD / arrows | Move / drive |
| Shift | Sprint / handbrake |
| Space | Jump |
| Mouse drag | Orbit camera |
| Click | Shoot |
| E | Interact / steal car / exit car |
| Q / 1–5 | Weapon wheel / weapon slots |
| N | Nitro |
| B | Gun shop |
| G | Safehouse / garage |
| M | Mission list |
| R | Cycle radio |
| V | Vigilante job |
| P / Esc | Pause |

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

## Tests

```sh
node --test tests/logic.test.mjs tests/logic2.test.mjs
# 161 tests, all passing — missions, police, combat, economy, save/load
```

## Screenshots

1. `screenshots/1-day.jpg` — Solara Bay by day: downtown, traffic, pedestrians
2. `screenshots/2-night.jpg` — Neon night on the Boardwalk
3. `screenshots/3-mission.jpg` — Story mission "Static" in Downtown
4. `screenshots/4-chase.jpg` — 4-star police chase with the helicopter

## License

MIT — see `LICENSE`.
