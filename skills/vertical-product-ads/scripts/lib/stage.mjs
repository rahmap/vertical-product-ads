// Shared plumbing for every Node tool: a static server for engine + project, and a browser page that
// waits for the engine. No network, no Python server needed.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../engine');
export const LOOKS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../looks');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf' };

export function projectDir(arg) {
  if (!arg) { console.error('usage: <tool> <project-dir> …'); process.exit(2); }
  const dir = path.resolve(arg);
  if (!fs.existsSync(path.join(dir, 'scenes.json'))) { console.error(`no scenes.json in ${dir}`); process.exit(2); }
  return dir;
}

export function readScenes(dir) { return JSON.parse(fs.readFileSync(path.join(dir, 'scenes.json'), 'utf8')); }

// Serves /engine/* and /looks/* from the skill and /project/* from the ad project on a free localhost port.
export function serve(project) {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let root, rel;
    if (url.startsWith('/engine/')) { root = ENGINE; rel = url.slice(8); }
    else if (url.startsWith('/looks/')) { root = LOOKS; rel = url.slice(7); }
    else if (url.startsWith('/project/')) { root = project; rel = url.slice(9); }
    else { res.writeHead(404).end(); return; }
    const file = path.resolve(root, rel);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(ok => server.listen(0, '127.0.0.1', () => ok({ server, origin: `http://127.0.0.1:${server.address().port}` })));
}

// GPU rasterisation: Metal on macOS (measured +22 % throughput vs SwiftShader). VPA_GPU=0 disables it.
export function launchOptions() {
  if (process.env.VPA_GPU === '0') return {};
  if (process.platform === 'darwin') return { args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal'] };
  return {};
}

export async function launch() { return chromium.launch(launchOptions()); }

export async function openPage(browser, origin, { safe = false, scale = 1, width, height } = {}) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${origin}/engine/index.html?project=/project/${safe ? '&safe=1' : ''}`);
  await page.waitForFunction(() => window.READY === true || window.ERROR, null, { timeout: 120000 });
  const err = await page.evaluate(() => window.ERROR);
  if (err || errors.length) throw new Error(`engine failed: ${err || errors.join('; ')}`);
  return page;
}
