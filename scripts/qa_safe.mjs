// node qa_safe.mjs <project> → samples every 0.05 s; every visible word, chip, label, odometer digit and the
// CTA must sit inside format.safe. Exit 1 on any violation (first time each element breaks the zone).
import { projectDir, readScenes, serve, launch, openPage } from './lib/stage.mjs';

const dir = projectDir(process.argv[2]);
const S = readScenes(dir);
const { server, origin } = await serve(dir);
const browser = await launch();
const page = await openPage(browser, origin, { width: S.format.width, height: S.format.height });
const bad = new Map();
for (let t = 0; t <= S.duration; t += 0.05) {
  const hits = await page.evaluate(([t, Z]) => {
    window.seek(t);
    const out = [];
    for (const e of document.querySelectorAll('#hud .w, #hud .chip, #hud .label, #hud .odo > *, #cta')) {
      let p = e, hidden = false;
      while (p && p.id !== 'hud') { const cs = getComputedStyle(p); if (cs.display === 'none' || +cs.opacity < 0.05) { hidden = true; break; } p = p.parentElement; }
      if (hidden) continue;
      const r = e.getBoundingClientRect();
      if (r.width < 1) continue;
      if (r.left < Z.l - 0.5 || r.right > Z.r + 0.5 || r.top < Z.t - 0.5 || r.bottom > Z.b + 0.5)
        out.push([(e.textContent || e.id).trim().slice(0, 32), `[${r.left.toFixed(0)},${r.top.toFixed(0)} → ${r.right.toFixed(0)},${r.bottom.toFixed(0)}]`]);
    }
    return out;
  }, [t, S.format.safe]);
  for (const [name, box] of hits) if (!bad.has(name)) bad.set(name, `t=${t.toFixed(2)}  "${name}" ${box}`);
}
await browser.close();
server.close();
const Z = S.format.safe;
if (bad.size) {
  console.log(`SAFE ZONE FAIL (x ${Z.l}–${Z.r}, y ${Z.t}–${Z.b}):\n` + [...bad.values()].join('\n'));
  process.exit(1);
}
console.log(`safe zone OK: all text/UI inside x ${Z.l}–${Z.r}, y ${Z.t}–${Z.b} at every 0.05 s`);
process.exit(0);
