// Ember Harbor — make.fun gta6-01 entry point (Node 22, standard library only).
// The game is the static game/ folder beside this file: a Three.js open-world
// crime game that runs in a desktop browser with zero network requests at
// runtime. This script copies game/ and screenshots/ into the output dir and
// writes /output/dossier.json, the summary the judge reads, using the kit's
// vendored make.fun library. Run it with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// (Outside the grader's container MAKEFUN_OUTPUT_DIR stands in for /output.)
// Serve the game locally with `node serve.ts`, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of
// game files, in all, or a path under game/ over 1000 bytes: game/ counts
// beside /output's own 1000-entry cap, its screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

const shots = existsSync(join(here, 'screenshots'))
  ? readdirSync(join(here, 'screenshots')).filter((f) => /\.(jpe?g|png)$/i.test(f)).sort()
  : [];
// The scorer refuses a screenshot over 256 KiB, so fail loudly here instead
// of shipping an entry that cannot be graded.
const MAX_SHOT_BYTES = 262144;
for (const shot of shots) {
  const size = statSync(join(here, 'screenshots', shot)).size;
  if (size > MAX_SHOT_BYTES) {
    throw new Error(`Screenshot ${shot} is ${size} bytes, over the ${MAX_SHOT_BYTES} byte cap — re-capture it smaller.`);
  }
}
if (shots.length === 0) console.warn('Warning: no screenshots — the entry needs at least one.');
if (shots.length > 4) throw new Error(`Too many screenshots (${shots.length}); the cap is 4.`);

// Quick self-check of the dossier the judge will read: it must name the
// game files and the screenshots, and it must parse as JSON.
const dossierPath = join(out, 'dossier.json');
const dossier = JSON.parse(readFileSync(dossierPath, 'utf8'));
console.log(`Dossier: ${JSON.stringify(dossier).length} bytes, ${Object.keys(dossier).length} top-level keys.`);
const gameFiles = [];
(function walk(dir, rel) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const r = rel ? `${rel}/${name}` : name;
    if (statSync(full).isDirectory()) walk(full, r);
    else gameFiles.push(r);
  }
})(join(here, 'game'), '');
console.log(`Ember Harbor: ${gameFiles.length} game files, ${shots.length} screenshots -> ${out}`);
console.log(`Screenshots: ${shots.join(', ') || '(none)'}`);
