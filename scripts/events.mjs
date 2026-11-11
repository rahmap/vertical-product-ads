// node events.mjs <project> → audio/events.json: the SFX cue table read from the engine (one source of truth,
// including the odometer ticks the engine derives).
import fs from 'node:fs';
import path from 'node:path';
import { projectDir, readScenes, serve, launch, openPage } from './lib/stage.mjs';

const dir = projectDir(process.argv[2]);
const S = readScenes(dir);
const { server, origin } = await serve(dir);
const browser = await launch();
const page = await openPage(browser, origin, { width: S.format.width, height: S.format.height });
const data = await page.evaluate(() => ({ film: window.FILM_DURATION, cues: window.CUES }));
fs.mkdirSync(path.join(dir, 'audio'), { recursive: true });
fs.writeFileSync(path.join(dir, 'audio/events.json'), JSON.stringify(data, null, 1));
console.log(`${data.cues.length} cues, film ${data.film}s → audio/events.json`);
await browser.close();
server.close();
process.exit(0);
