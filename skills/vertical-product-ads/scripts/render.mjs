// node render.mjs <project> [--fps 30|60|24|25] [--draft] [--workers N]
//
// Final:  4 subframes per frame, 1/240 s apart, averaged by ffmpeg tmix → real motion blur.
//         Shutter = 4·fps/240: 30 fps → 180° (film look), 60 fps → 360°. Frame k at 30 fps samples exactly the
//         subframe times of frame 2k at 60 fps, so 30 fps halves the work without changing what a frame shows.
//         Encoded once at the final quality (libx264 slow, CRF scenes.render.crf or 19, tune film, BT.709);
//         finish.sh only touches the audio.
// Draft:  half resolution, 1 subframe, 30 fps, fast encode, muxed with audio/mix.wav when present —
//         for watching timing at normal speed before the full render.
//
// Speed:  JPEG q95 capture (PNG is ~10× slower), Chromium on the GPU (Metal on macOS), one browser with N tabs
//         (separate browsers stalled), chunk N encodes while chunk N+1 is captured.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { projectDir, readScenes, serve, launch, openPage, launchOptions } from './lib/stage.mjs';

const args = process.argv.slice(2);
const dir = projectDir(args.shift());
const opt = (name, def) => { const i = args.indexOf(name); return i < 0 ? def : args[i + 1]; };
const draft = args.includes('--draft');
const S = readScenes(dir);
const fps = draft ? 30 : Number(opt('--fps', (S.render && S.render.fps) || 30));
const SUB = draft ? 1 : 4;
const WORKERS = Number(opt('--workers', process.env.VPA_WORKERS || 6));
const CRF = (S.render && S.render.crf) || 19;
const CHUNK_FRAMES = 240;
const out = path.join(dir, 'renders', draft ? 'draft.mp4' : 'video_noaudio.mp4');
const work = path.join(dir, 'renders', 'work');
fs.rmSync(work, { recursive: true, force: true });
fs.mkdirSync(work, { recursive: true });

const FRAMES = Math.round(S.duration * fps);
const subT = i => Math.floor(i / SUB) / fps + (SUB === 1 ? 0 : ((i % SUB) - (SUB - 1) / 2) / 240);
const chunks = Math.ceil(FRAMES / CHUNK_FRAMES);
const W = S.format.width, H = S.format.height;

const t0 = Date.now();
const { server, origin } = await serve(dir);
let browser = await launch();
const scale = draft ? 0.5 : 1;
async function newPage() {
  if (!browser.isConnected()) browser = await launch();
  return openPage(browser, origin, { width: W, height: H, scale });
}
const pages = [];
for (let w = 0; w < WORKERS; w++) pages.push(await newPage());   // sequential: parallel loads of big assets time out

function encode(c, src) {
  const vf = SUB === 1
    ? 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p'
    : `tmix=frames=${SUB}:weights='${Array(SUB).fill(1).join(' ')}',select='eq(mod(n\\,${SUB})\\,${SUB - 1})',setpts=N/(${fps}*TB),scale=out_color_matrix=bt709:out_range=tv,format=yuv420p`;
  const file = path.join(work, `chunk_${String(c).padStart(3, '0')}.mp4`);
  const enc = draft ? ['-preset', 'veryfast', '-crf', '23'] : ['-preset', 'slow', '-crf', String(CRF), '-tune', 'film'];
  const argv = ['-v', 'error', '-y', '-framerate', String(fps * SUB), '-i', path.join(src, 's%05d.jpg'), '-vf', vf,
    '-r', String(fps), '-c:v', 'libx264', ...enc, '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', file];
  return new Promise((ok, fail) => {
    const p = spawn('ffmpeg', argv, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = ''; p.stderr.on('data', d => (err += d));
    p.on('close', code => {
      fs.rmSync(src, { recursive: true, force: true });
      code === 0 ? ok(file) : fail(new Error(`ffmpeg chunk ${c}: ${err}`));
    });
  });
}

let captureMs = 0;
const encodes = [];
for (let c = 0; c < chunks; c++) {
  const fa = c * CHUNK_FRAMES, fb = Math.min(FRAMES, (c + 1) * CHUNK_FRAMES), a = fa * SUB, b = fb * SUB;
  const src = path.join(work, `sub_${c}`);
  fs.mkdirSync(src);
  const ts = Date.now();
  // a tab renders every subframe of a frame before the next frame, so a video frame loads once per output frame
  await Promise.all(pages.map(async (_, w) => {
    for (let f = fa + w; f < fb; f += WORKERS) {
      for (let s = 0; s < SUB; s++) {
        const i = f * SUB + s;
        for (let attempt = 0; ; attempt++) {
          try {
            await pages[w].evaluate(t => window.seek(t), subT(i));   // returns the video-frame decode promise
            await pages[w].screenshot({ path: path.join(src, `s${String(i - a).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 95 });
            break;
          } catch (e) {
            if (attempt >= 3) throw e;
            console.error(`subframe ${i} failed (${e.message.split('\n')[0]}), new tab`);
            try { await pages[w].close(); } catch {}
            pages[w] = await newPage();
          }
        }
      }
    }
  }));
  captureMs += Date.now() - ts;
  if (encodes.length >= 1) await encodes[encodes.length - 1];   // at most one encode in flight beside capture
  encodes.push(encode(c, src));
  console.log(`chunk ${c + 1}/${chunks} captured · ${(b - a) / SUB} frames · ${((Date.now() - ts) / 1000).toFixed(1)} s`);
}
const files = await Promise.all(encodes);
await browser.close().catch(() => {});
server.close();

const list = path.join(work, 'chunks.txt');
fs.writeFileSync(list, files.map(f => `file '${f.replaceAll("'", "'\\''")}'`).join('\n') + '\n');
const mix = path.join(dir, 'audio/mix.wav');
if (draft && fs.existsSync(mix)) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-i', mix, '-map', '0:v', '-map', '1:a',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', out]);
} else {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', out]);
}
fs.rmSync(work, { recursive: true, force: true });
const meta = { fps, subframes: SUB, shutterDeg: SUB === 1 ? 0 : (SUB * fps / 240) * 360, frames: FRAMES,
  chunkSeconds: CHUNK_FRAMES / fps, draft, gpu: (launchOptions().args || []).includes('--use-angle=metal') ? 'metal' : 'default',
  workers: WORKERS, captureSeconds: +(captureMs / 1000).toFixed(1), totalSeconds: +((Date.now() - t0) / 1000).toFixed(1) };
fs.writeFileSync(path.join(dir, 'renders', draft ? 'draft.json' : 'render.json'), JSON.stringify(meta, null, 1));
console.log(`done: ${path.relative(dir, out)} · ${FRAMES} frames @ ${fps} fps · shutter ${meta.shutterDeg}° · capture ${meta.captureSeconds} s · total ${meta.totalSeconds} s`);
process.exit(0);
