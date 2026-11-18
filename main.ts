// main.ts — Solmarina entrypoint for make.fun.
// Copies game/ and screenshots/ from this repository into the output
// directory and writes dossier.json with buildDossier from the kit's
// vendor/makefun-game.ts. Standard library only; runs on Node 22.
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
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
import { readdirSync, statSync } from 'node:fs';
const topLevel = readdirSync(outDir);
const gameFiles = readdirSync(join(outDir, 'game'));
const shotFiles = readdirSync(join(outDir, 'screenshots'));
const dossierBytes = statSync(join(outDir, 'dossier.json')).size;
console.log(`output: ${topLevel.join(', ')}`);
console.log(`game/: ${gameFiles.length} top-level entries; screenshots/: ${shotFiles.length} files; dossier.json: ${dossierBytes} bytes`);
