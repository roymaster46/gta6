// A tiny static server for game/ (Node 22, standard library only), so an entry can be played
// locally without a build step: `node serve.ts` serves game/ on http://localhost:8080.
// It sends the MIME types a browser game needs, refuses any path outside game/, and otherwise
// does nothing clever: this is a development convenience, not a web server for the internet.
// Port precedence: --port flag (also --port=8080), then the PORT environment
// variable, then 8080. `--host 0.0.0.0` serves on all interfaces (default
// 127.0.0.1). On startup it lists the ?shot= scenes from shots.json —
// including the new wheel and store scenes for the weapon wheel and the
// Marina Arms gun store.
import { createReadStream, statSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('./game', import.meta.url)));
const args = process.argv.slice(2);

function pickPort(): number {
  const equals = args.find((a) => a.startsWith('--port='));
  const flagIndex = args.indexOf('--port');
  const raw = equals ? equals.slice('--port='.length) : flagIndex === -1 ? process.env.PORT : args[flagIndex + 1];
  const n = Number(raw ?? 8080);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : 8080;
}

function pickHost(): string {
  const equals = args.find((a) => a.startsWith('--host='));
  const flagIndex = args.indexOf('--host');
  return equals ? equals.slice('--host='.length) : flagIndex === -1 ? '127.0.0.1' : args[flagIndex + 1] ?? '127.0.0.1';
}

// The ?shot= scenes main.js understands, read from shots.json so the list
// on startup can never drift from the screenshots the build produces.
function listShots(): string[] {
  try {
    const shots = JSON.parse(readFileSync(resolve(root, '..', 'shots.json'), 'utf8'));
    if (!Array.isArray(shots)) return ['  (shots.json is not a list)'];
    return shots.map((s: { name: string; query: string }) => `  ${s.name} -> ${s.query}`);
  } catch {
    return ['  (shots.json not found)'];
  }
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin': 'application/octet-stream',
  '.wasm': 'application/wasm',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.txt': 'text/plain; charset=utf-8',
};

function resolveSafe(pathname: string): string | null {
  const file = resolve(join(root, normalize(pathname)));
  if (file !== root && !file.startsWith(root + sep)) return null;
  return file;
}

const port = pickPort();
const host = pickHost();
createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  let pathname: string;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    response.writeHead(400).end('bad request');
    return;
  }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = resolveSafe(pathname);
  if (file === null) {
    response.writeHead(403).end('forbidden');
    return;
  }
  let size: number;
  try {
    const stats = statSync(file);
    if (!stats.isFile()) throw new Error('not a file');
    size = stats.size;
  } catch {
    response.writeHead(404).end('not found');
    return;
  }
  response.writeHead(200, {
    'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'content-length': size,
    'cache-control': 'no-store',
  });
  createReadStream(file).pipe(response);
}).listen(port, host, () => {
  console.log(`game/ is on http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
  console.log('?shot= scenes (from shots.json):');
  for (const line of listShots()) console.log(line);
});
