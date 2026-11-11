// node snap.mjs <project> [--safe] [--out dir] [--sheet cols] [--beats] t1 t2 …
//   Writes one PNG per time and prints each path. Every frame carries a time stamp (and beat number with
//   --beats) in the top band, which is outside the safe zone.
//   --beats   adds one frame per beat (t = k·period + 0.12); default out <project>/snaps (cleared first)
//   manual    default out <project>/snaps/manual-<time>: a fresh folder per run, so image viewers that
//             cache by path never show a frame from before your last edit
//   --sheet N tiles this run's frames into <out>/sheet.png, N columns, quarter size
//   --safe    draws the safe zone
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { projectDir, readScenes, serve, launch, openPage } from './lib/stage.mjs';

const args = process.argv.slice(2);
const dir = projectDir(args.shift());
const opt = (name, def) => { const i = args.indexOf(name); if (i < 0) return def; const v = args[i + 1]; args.splice(i, 2); return v; };
const flag = name => { const i = args.indexOf(name); if (i < 0) return false; args.splice(i, 1); return true; };
const safe = flag('--safe'), beats = flag('--beats');
const stampNow = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
const out = path.resolve(opt('--out', beats ? path.join(dir, 'snaps') : path.join(dir, 'snaps', `manual-${stampNow}`)));
const sheetCols = Number(opt('--sheet', 0));
const S = readScenes(dir);
const shots = args.map(a => ({ t: Number(a), label: `t ${Number(a).toFixed(2)} s` }));
if (shots.some(s => Number.isNaN(s.t))) { console.error(`times must be numbers, got: ${args.join(' ')}`); process.exit(2); }
if (beats) {
  const gridFile = path.join(dir, 'audio/grid.json');
  const period = fs.existsSync(gridFile) ? JSON.parse(fs.readFileSync(gridFile, 'utf8')).period : 60 / ((S.music && S.music.bpm) || 120);
  for (let k = 0, t = 0.12; t < S.duration; k++, t = 0.12 + k * period) shots.push({ t: +t.toFixed(3), label: `t ${t.toFixed(2)} s · beat ${k}` });
}
if (!shots.length) { console.error('no times given'); process.exit(2); }

fs.mkdirSync(out, { recursive: true });
if (beats) for (const f of fs.readdirSync(out)) if (/^t_.*\.png$/.test(f)) fs.rmSync(path.join(out, f));
const { server, origin } = await serve(dir);
const browser = await launch();
const page = await openPage(browser, origin, { safe, width: S.format.width, height: S.format.height });
await page.evaluate(() => {
  const s = document.createElement('div');
  s.id = 'snap-stamp';
  Object.assign(s.style, { position: 'absolute', left: '16px', top: '16px', zIndex: 99, padding: '6px 14px', borderRadius: '10px',
    background: 'rgba(0,0,0,0.62)', color: '#fff', font: '600 30px ui-monospace, Menlo, monospace' });
  document.querySelector('#frame').appendChild(s);
});
const files = [];
for (const { t, label } of shots) {
  await page.evaluate(([t, label]) => { window.seek(t); document.querySelector('#snap-stamp').textContent = label; }, [t, label]);
  const f = path.join(out, `t_${t.toFixed(2).padStart(6, '0')}.png`);
  await page.screenshot({ path: f });
  files.push(f);
}
await browser.close();
server.close();
for (const f of files) console.log(f);
if (sheetCols) {
  const w = S.format.width / 4, h = S.format.height / 4, rows = Math.ceil(files.length / sheetCols);
  const list = path.join(out, 'sheet.txt');
  fs.writeFileSync(list, files.map(f => `file '${f.replaceAll("'", "'\\''")}'`).join('\n') + '\n');
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list,
    '-vf', `scale=${w}:${h},tile=${sheetCols}x${rows}:padding=4`, '-frames:v', '1', path.join(out, 'sheet.png')]);
  fs.rmSync(list);
  console.log(path.join(out, 'sheet.png'));
}
process.exit(0);
