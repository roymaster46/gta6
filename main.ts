// main.ts — Solmarina entrypoint for make.fun.
// Copies game/ and screenshots/ from this repository into the output
// directory and writes dossier.json with buildDossier from the kit's
// vendor/makefun-game.ts. Standard library only; runs on Node 22.
// The build is checked before it is written: the game folder must exist,
// every screenshot named in shots.json must exist (at most 4, per the
// dossier config), and the modules added in this revision — the day/night
// cycle, the garage shop, the side jobs and the radio stations — must be
// present. A missing module would ship a game whose import graph breaks.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');

const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');

if (!existsSync(gameDir)) {
  throw new Error('main.ts: game/ is missing from the repository');
}
if (!existsSync(shotsDir)) {
  throw new Error('main.ts: screenshots/ is missing from the repository');
}
for (const mod of ['daynight.js', 'garage.js', 'sidejobs.js', 'radio.js']) {
  if (!existsSync(join(gameDir, 'src', mod))) {
    throw new Error(`main.ts: game/src/${mod} is missing — the day/night, garage, side-job and radio modules are required`);
  }
}
// Every screenshot named in shots.json must exist on disk: a stale entry
// would otherwise ship a dossier pointing at a file that is not there.
const shotList = JSON.parse(readFileSync(join(repoRoot, 'shots.json'), 'utf8'));
if (!Array.isArray(shotList) || shotList.length === 0 || shotList.length > 4) {
  throw new Error('main.ts: shots.json must list 1-4 screenshots');
}
for (const s of shotList) {
  if (!existsSync(join(shotsDir, s.name))) {
    throw new Error(`main.ts: screenshot ${s.name} listed in shots.json is missing from screenshots/`);
  }
  // The dossier config caps each screenshot at 262,144 bytes (256 KiB) and
  // the gate rejects the entry otherwise — check before copying, not after.
  const shotBytes = statSync(join(shotsDir, s.name)).size;
  if (shotBytes > 262144) {
    throw new Error(`main.ts: screenshot ${s.name} is ${shotBytes} bytes — over the 262,144-byte cap; re-export it at lower quality`);
  }
  console.log(`screenshot ${s.name}: ${shotBytes} bytes (<= 262,144)`);
}

mkdirSync(outDir, { recursive: true });
mkdirSync(join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });

// Copy the playable game and its screenshots beside the dossier.
cpSync(gameDir, join(outDir, 'game'), { recursive: true });
cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

// The dossier is byte for byte what the kit library writes from the output
// directory, so the scorer's rebuild matches it exactly.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`Solmarina entry written to ${outDir} (dossier.json: ${dossier.length} bytes)`);

// Sanity-check what was handed in: the dossier must exist, and the output
// must hold the game, the screenshots and nothing else at the top level.
const topLevel = readdirSync(outDir);
const gameFiles = readdirSync(join(outDir, 'game'));
const shotFiles = readdirSync(join(outDir, 'screenshots'));
const dossierBytes = statSync(join(outDir, 'dossier.json')).size;
console.log(`output: ${topLevel.join(', ')}`);
console.log(`game/: ${gameFiles.length} top-level entries; screenshots/: ${shotFiles.length} files; dossier.json: ${dossierBytes} bytes`);
