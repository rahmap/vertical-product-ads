// node qa_safe.mjs <project> → layout gate, checked at every output frame (1/render.fps). Exit 1 on any violation
// (first time each breaks):
//   safe zone   every visible word, chip, label, odometer digit, caption chunk, mask, callout label, check row and the
//               CTA sits inside format.safe; a marquee band runs edge to edge, so only its height is checked
//   overlap     no two visible HUD blocks (text block, chip, label, odometer, caption chunk, mask, callout, check row,
//               marquee, CTA) cover each other: double-printed text is a bug, not a transition
//   empty band  every visible band of the shape and every visible panel shows at least one layer (else the bare
//               --band surface or a gap between footage segments reaches the screen)
import { projectDir, readScenes, serve, launch, openPage } from './lib/stage.mjs';

const dir = projectDir(process.argv[2]);
const S = readScenes(dir);
const { server, origin } = await serve(dir);
const browser = await launch();
const page = await openPage(browser, origin, { width: S.format.width, height: S.format.height });
const FPS = (S.render && S.render.fps) || 30;
const fails = { safe: new Map(), overlap: new Map(), empty: new Map() };
for (let f = 0, n = Math.round(S.duration * FPS); f < n; f++) {
  const t = f / FPS;
  const hits = await page.evaluate(async ([t, Z]) => {
    await window.seek(t);
    // effective opacity: product down to #hud / #bands; 0 when any ancestor is display:none
    const alpha = (e, stop) => {
      let a = 1;
      for (let p = e; p && p.id !== stop; p = p.parentElement) {
        const cs = getComputedStyle(p);
        if (cs.display === 'none') return 0;
        a *= +cs.opacity;
      }
      return a;
    };
    const box = r => `[${r.left.toFixed(0)},${r.top.toFixed(0)} → ${r.right.toFixed(0)},${r.bottom.toFixed(0)}]`;
    const name = e => (e.textContent || e.id).trim().replace(/\s+/g, ' ').slice(0, 32);
    const safe = [], overlap = [], empty = [];

    // odometer slots: measure the visible window (the cell minus its clip inset, i.e. 1 em at `y`), not the padded
    // rolling cell or the font's content box; the suffix is measured as text
    const rectOf = e => {
      const r = e.getBoundingClientRect();
      if (!e.classList.contains('slot')) return r;
      const pad = (r.height - parseFloat(getComputedStyle(e).fontSize)) / 2;
      return { left: r.left, right: r.right, top: r.top + pad, bottom: r.bottom - pad, width: r.width };
    };
    const HUD_SEL = '#hud .w, #hud .chip, #hud .label, #hud .odo > *, #hud .cap, #cta, #hud .mask, #hud .callout, #hud .ck-row, #hud .ck-head';
    for (const e of document.querySelectorAll(HUD_SEL)) {
      if (alpha(e, 'hud') < 0.05) continue;
      const r = rectOf(e);
      if (r.width < 1) continue;
      if (r.left < Z.l - 0.5 || r.right > Z.r + 0.5 || r.top < Z.t - 0.5 || r.bottom > Z.b + 0.5)
        safe.push([e.classList.contains('slot') ? e.firstChild.textContent : name(e), box(r)]);
    }
    for (const e of document.querySelectorAll('#hud .marq')) {
      if (alpha(e, 'hud') < 0.05) continue;
      const r = e.getBoundingClientRect();
      if (r.top < Z.t - 0.5 || r.bottom > Z.b + 0.5) safe.push([`marquee "${e.firstChild.firstChild.textContent}"`, box(r)]);
    }

    // a text block or odometer is the union of its visible glyph boxes; the others are one box each
    const blocks = [];
    const union = (parts, min) => {
      let r = null;
      for (const w of parts) {
        if (alpha(w, 'hud') < min) continue;
        const b = rectOf(w);
        if (b.width < 1) continue;
        r = r ? { left: Math.min(r.left, b.left), top: Math.min(r.top, b.top), right: Math.max(r.right, b.right), bottom: Math.max(r.bottom, b.bottom) } : { left: b.left, top: b.top, right: b.right, bottom: b.bottom };
      }
      return r;
    };
    for (const tb of document.querySelectorAll('#hud .tb')) { const r = union(tb.querySelectorAll('.w'), 0.25); if (r) blocks.push([name(tb), r]); }
    for (const od of document.querySelectorAll('#hud .odo')) {
      if (alpha(od, 'hud') < 0.25) continue;
      const parts = [...od.children];
      const r = union(parts, 0);
      if (r) blocks.push([parts.map(p => (p.classList.contains('slot') ? p.firstChild.textContent : p.textContent)).join('').trim(), r]);
    }
    for (const e of document.querySelectorAll('#hud .chip, #hud .label, #hud .cap, #cta, #hud .mask, #hud .callout, #hud .ck-row, #hud .ck-head, #hud .marq')) {
      if (alpha(e, 'hud') < 0.25) continue;
      const r = e.getBoundingClientRect();
      if (r.width >= 1) blocks.push([name(e), r]);
    }
    for (let i = 0; i < blocks.length; i++) for (let j = i + 1; j < blocks.length; j++) {
      const [a, ra] = blocks[i], [b, rb] = blocks[j];
      const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (w > 2 && h > 2) overlap.push([`"${a}" × "${b}"`, `${box(ra)} ${box(rb)}`]);
    }

    const bandsOn = alpha(document.getElementById('bands'), 'world') >= 0.05;
    document.querySelectorAll('#bands > .band').forEach((band, i) => {
      if (!bandsOn || getComputedStyle(band).display === 'none' || band.getBoundingClientRect().height < 2) return;
      const shown = [...band.children].some(c => alpha(c, 'bands') >= 0.05);
      if (!shown) empty.push([`band ${i}`, box(band.getBoundingClientRect())]);
    });
    for (const p of document.querySelectorAll('#panels > .pnl')) {
      if (alpha(p, 'panels') < 0.05) continue;
      const pin = p.querySelector('.pin'), r = pin.getBoundingClientRect();
      if (r.right < 0 || r.left > innerWidth || r.bottom < 0 || r.top > innerHeight || r.height < 2) continue;
      if (![...pin.children].some(c => alpha(c, 'panels') >= 0.05)) empty.push([`panel ${p.dataset.id}`, box(r)]);
    }
    return { safe, overlap, empty };
  }, [t, S.format.safe]);
  for (const k of Object.keys(fails)) for (const [n, b] of hits[k]) if (!fails[k].has(n)) fails[k].set(n, `t=${t.toFixed(2)}  ${k === 'overlap' ? n : `"${n}"`} ${b}`);
}
await browser.close();
server.close();
const Z = S.format.safe;
const report = [];
if (fails.safe.size) report.push(`SAFE ZONE FAIL (x ${Z.l}–${Z.r}, y ${Z.t}–${Z.b}):\n` + [...fails.safe.values()].join('\n'));
if (fails.overlap.size) report.push('OVERLAP FAIL (two text/UI blocks on top of each other; end one before the other enters, or move it):\n' + [...fails.overlap.values()].join('\n'));
if (fails.empty.size) report.push('EMPTY BAND FAIL (a visible band shows no layer: give it a layer, or close the gap between segments):\n' + [...fails.empty.values()].join('\n'));
if (report.length) { console.log(report.join('\n\n')); process.exit(1); }
console.log(`layout OK at all ${Math.round(S.duration * FPS)} frames: text/UI inside x ${Z.l}–${Z.r}, y ${Z.t}–${Z.b}; no overlapping blocks; no empty band`);
process.exit(0);
