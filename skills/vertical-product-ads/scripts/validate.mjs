// node validate.mjs <project> → schema check of scenes.json plus the cross-references a schema can't see:
// asset/footage files exist, layer/arc/icon names resolve, style/dialogue/caption/music rules, VO segments fit the
// word list, duration limits, and the contrast of UI text on its surface once the look and the project theme are
// merged. Exit 1 on any problem; a duration above 34 s only prints a WARNING.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { projectDir, readScenes, LOOKS } from './lib/stage.mjs';

const dir = projectDir(process.argv[2]);
const S = readScenes(dir);
const schema = JSON.parse(fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../schemas/scenes.schema.json'), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: false });
const problems = [];
if (!ajv.validate(schema, S)) for (const e of ajv.errors) problems.push(`schema: ${e.instancePath || '/'} ${e.message}${e.params && e.params.additionalProperty ? ` (${e.params.additionalProperty})` : ''}`);

// look: the preset must exist, its theme and caption defaults must pass the same schema, its fonts must be there
let lookCss = {};
if (S.look) {
  const file = path.join(LOOKS, S.look + '.json');
  if (!fs.existsSync(file)) {
    const names = fs.readdirSync(LOOKS).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5));
    problems.push(`look "${S.look}" does not exist; looks: ${names.join(', ')}`);
  } else {
    const L = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const k of ['theme', 'captions']) {
      if (L[k] && !ajv.validate({ $defs: schema.$defs, ...schema.properties[k] }, L[k]))
        for (const e of ajv.errors) problems.push(`look "${S.look}": ${k}${e.instancePath} ${e.message}`);
    }
    for (const f of (L.theme && L.theme.fontFaces) || [])
      if (!fs.existsSync(path.join(LOOKS, f.src))) problems.push(`look "${S.look}": font ${f.src} is missing from looks/`);
    lookCss = (L.theme && L.theme.css) || {};
  }
}

// contrast: the engine's defaults, then the look, then the project's theme.css. A project theme written for one
// look (or for none) can leave the look's light ink on its own white surface; these texts are ≥ 28 px, so the
// bar is WCAG's 3:1 for large text. Only plain colours are compared (gradients and translucent fills are skipped).
{
  const html = fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../engine/index.html'), 'utf8');
  const root = Object.fromEntries([...(/:root\s*{([^}]*)}/.exec(html) || ['', ''])[1].matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));
  const css = { ...root, ...lookCss, ...((S.theme && S.theme.css) || {}) };
  const value = (v, depth = 0) => {
    const m = v && /^var\((--[a-z0-9-]+)(?:\s*,\s*(.+))?\)$/.exec(v.trim());
    if (!m || depth > 5) return v;
    return value(css[m[1]] != null ? css[m[1]] : m[2], depth + 1);
  };
  const rgb = v => {
    v = value(v);
    let m = v && /^#([\da-f]{3}|[\da-f]{6})$/i.exec(v.trim());
    if (m) { const h = m[1].length === 3 ? [...m[1]].map(c => c + c).join('') : m[1]; return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); }
    m = v && /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(v.trim());
    if (m && (m[4] == null || +m[4] >= 0.85)) return [+m[1], +m[2], +m[3]];
    return null;
  };
  const lum = c => { const [r, g, b] = c.map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const pairs = [
    ['chip, callout and check-row text', css['--ui-ink'] || css['--ink'], css['--surface']],
    ['label text', css['--ui-ink'] || css['--ink'], css['--surface-label']],
    ['CTA text', css['--cta-ink'] || '#FFFFFF', css['--accent']],
    ['marquee text', css['--marquee-ink'] || css['--cta-ink'] || '#FFFFFF', css['--marquee-bg'] || css['--accent']],
  ];
  for (const [what, fg, bg] of pairs) {
    const a = rgb(fg), b = rgb(bg);
    if (!a || !b) continue;
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x), ratio = (hi + 0.05) / (lo + 0.05);
    if (ratio < 3) problems.push(`contrast: ${what} ${value(fg)} on ${value(bg)} is ${ratio.toFixed(2)}:1 (needs 3:1). theme.css over a look usually needs only the brand colours; drop the rest or set the ink too`);
  }
}

const assets = S.assets || {};
for (const [k, f] of Object.entries(assets)) if (!fs.existsSync(path.join(dir, f))) problems.push(`asset "${k}": file ${f} not found`);
const footage = S.footage || {};
for (const [k, f] of Object.entries(footage)) if (!fs.existsSync(path.join(dir, f.file))) problems.push(`footage "${k}": file ${f.file} not found`);
for (const [k, f] of Object.entries(footage)) {
  if (f.sound && f.speech) problems.push(`footage "${k}": sound is for b-roll; a speech clip is heard through dialogue`);
  if (f.sound && !(S.layers || []).some(L => L.kind === 'video' && L.src === k)) problems.push(`footage "${k}": sound is set but no video layer shows the clip`);
}
const dlg = S.dialogue ? S.dialogue.segments : [];
const ids = new Set();
for (const L of S.layers || []) {
  if (ids.has(L.id)) problems.push(`layer id "${L.id}" is used twice`);
  ids.add(L.id);
  const kind = L.kind || 'img';
  if (kind === 'img' && !L.src) problems.push(`layer "${L.id}": img layer needs "src"`);
  if (kind === 'video') {
    if (!L.src) problems.push(`layer "${L.id}": video layer needs "src" (a footage name)`);
    else if (!footage[L.src]) problems.push(`layer "${L.id}": src "${L.src}" is not in footage`);
    if (L.clip && L.dialogue != null) problems.push(`layer "${L.id}": use clip or dialogue, not both`);
    if (L.dialogue != null) {
      const seg = dlg[L.dialogue];
      if (!seg) problems.push(`layer "${L.id}": dialogue segment ${L.dialogue} does not exist`);
      else if (seg.footage !== L.src) problems.push(`layer "${L.id}": src "${L.src}" differs from dialogue segment ${L.dialogue} footage "${seg.footage}"`);
    }
    if (L.mode === 'world') problems.push(`layer "${L.id}": video layers are cover mode only`);
  } else {
    for (const k of ['clip', 'dialogue']) if (L[k] != null) problems.push(`layer "${L.id}": "${k}" is only for video layers`);
    if (L.cut && kind === 'sheen') problems.push(`layer "${L.id}": "cut" does not apply to a sheen`);
    if (L.src && !assets[L.src]) problems.push(`layer "${L.id}": src "${L.src}" is not in assets`);
  }
  if (L.fit === 'contain') {
    if (!['img', 'video'].includes(kind)) problems.push(`layer "${L.id}": fit "contain" is only for img and video layers`);
    for (const k of ['wipe', 'clipX', 'place']) if (L[k] != null) problems.push(`layer "${L.id}": "${k}" does not combine with fit "contain"`);
    if (L.mode === 'world') problems.push(`layer "${L.id}": fit "contain" needs cover mode`);
  }
  if (kind === 'fill' && !L.fill) problems.push(`layer "${L.id}": fill layer needs "fill"`);
  if (kind === 'sheen' && (L.t0 == null || L.t1 == null)) problems.push(`layer "${L.id}": sheen needs t0 and t1`);
  if (L.mode === 'world' && !L.place) problems.push(`layer "${L.id}": world layer needs "place"`);
}
for (const a of S.arcs || []) {
  const L = (S.layers || []).find(l => l.id === a.layer);
  if (!L) problems.push(`arc: layer "${a.layer}" not found`);
  else if ((L.kind || 'img') !== 'img' || L.mode === 'world') problems.push(`arc: layer "${a.layer}" must be a cover img layer`);
}

// layouts: panels hold layers; layer/pop/mask references resolve; comparison rows fit their columns
const panelIds = new Set();
for (const P of S.panels || []) {
  if (panelIds.has(P.id)) problems.push(`panel id "${P.id}" is used twice`);
  panelIds.add(P.id);
  if (!(S.layers || []).some(L => L.panel === P.id)) problems.push(`panel "${P.id}": no layer has "panel": "${P.id}" (an empty panel shows the bare --band surface)`);
}
for (const L of S.layers || []) {
  if (L.panel == null) continue;
  if (!panelIds.has(L.panel)) problems.push(`layer "${L.id}": panel "${L.panel}" not in panels`);
  for (const k of ['band', 'toutBand', 'wipe', 'place', 'pivot']) if (L[k] != null) problems.push(`layer "${L.id}": "${k}" does not apply inside a panel`);
  if (L.mode === 'world') problems.push(`layer "${L.id}": panel layers are cover mode only`);
  if ((S.arcs || []).some(a => a.layer === L.id)) problems.push(`arc: layer "${L.id}" is in a panel; arcs draw over the shape only`);
}
for (const p of S.pops || []) {
  if ((p.band == null) === (p.panel == null)) problems.push('pops: each pop needs either "band" or "panel"');
  else if (p.panel != null && !panelIds.has(p.panel)) problems.push(`pops: panel "${p.panel}" not in panels`);
}
for (const m of S.masks || []) {
  if (['src', 'fill', 'footage'].filter(k => m[k] != null).length !== 1) problems.push(`mask "${m.text}": give exactly one of src, fill, footage`);
  if (m.src && !assets[m.src]) problems.push(`mask "${m.text}": src "${m.src}" is not in assets`);
  if (m.footage && !footage[m.footage]) problems.push(`mask "${m.text}": footage "${m.footage}" is not in footage`);
  if (m.clip && !m.footage) problems.push(`mask "${m.text}": clip is only for footage masks`);
}
for (const k of S.checks || []) {
  const cols = k.head ? k.head.length : 1;
  for (const r of k.rows) if ((r.marks || [true]).length !== cols) problems.push(`checks: row "${r.text}" has ${(r.marks || [true]).length} mark(s), the list has ${cols} column(s)`);
}
for (const c of S.chips || []) if (c.icon && !(S.icons || {})[c.icon]) problems.push(`chip "${c.text}": icon "${c.icon}" not in icons`);
const M = S.music;
if (M && M.synth && M.prompt) problems.push('music: synth and prompt are mutually exclusive');
if (M && M.synth) {
  if (!M.file) problems.push('music.synth needs music.file (where the synth writes the bed)');
  if (M.bpm != null && (M.bpm < 90 || M.bpm > 140)) problems.push(`music.bpm ${M.bpm}: synth supports 90–140`);
} else if (M && M.file && !fs.existsSync(path.join(dir, M.file)) && !M.prompt)
  problems.push(`music.file ${M.file} is missing and there is no music.prompt (or music.synth) to generate it`);
for (const [n, x] of Object.entries(S.sfx || {}))
  if (!x.prompt && !fs.existsSync(path.join(dir, x.file))) problems.push(`sfx.${n}: ${x.file} is missing and there is no prompt to generate it`);
for (const c of S.cues || []) {
  if (c.kind === 'sample' && !(S.sfx || {})[c.src]) problems.push(`cue at ${JSON.stringify(c.at)}: sample src "${c.src}" is not in sfx`);
  if (c.kind !== 'sample' && (c.src != null || c.align != null)) problems.push(`cue at ${JSON.stringify(c.at)}: "src"/"align" are only for kind "sample"`);
}
if (S.vo && S.vo.engine === 'edge' && !/^[a-z]{2,3}-[A-Z]{2,4}-\w+Neural$/.test(S.vo.voice))
  problems.push(`vo.voice "${S.vo.voice}": engine edge needs a name like id-ID-GadisNeural (scripts/voices.py lists them)`);
if (S.vo && S.dialogue) problems.push('vo and dialogue are mutually exclusive (one speech track)');

// dialogue: the edit list must be playable as written
dlg.forEach((s, i) => {
  const tag = `dialogue.segments[${i}]`;
  if (!footage[s.footage]) problems.push(`${tag}: footage "${s.footage}" is not in footage`);
  else if (!footage[s.footage].speech) problems.push(`${tag}: footage "${s.footage}" needs speech: true`);
  if (!(s.in < s.out)) problems.push(`${tag}: in (${s.in}) must be < out (${s.out})`);
  if (s.at + (s.out - s.in) > S.duration + 1e-6) problems.push(`${tag}: ends at ${(s.at + s.out - s.in).toFixed(2)} s, after duration ${S.duration}`);
});
const byAt = dlg.map((s, i) => ({ i, a: s.at, b: s.at + s.out - s.in })).sort((x, y) => x.a - y.a);
for (let k = 1; k < byAt.length; k++)
  if (byAt[k].a < byAt[k - 1].b - 1e-6) problems.push(`dialogue.segments[${byAt[k - 1].i}] and [${byAt[k].i}] overlap in film time`);

const style = S.style || 'motion', videos = [...(S.layers || []).filter(l => l.kind === 'video'), ...(S.masks || []).filter(m => m.footage)];
if (style === 'motion' && videos.length) problems.push('style "motion" has footage (video layers or footage masks): set style to ugc or hybrid');
if (style !== 'motion' && !videos.length) problems.push(`style "${style}" needs at least one video layer`);
if (style === 'ugc' && !S.captions) problems.push('style "ugc" needs "captions"');
if (S.captions && !S.vo && !S.dialogue) problems.push('captions need a speech track: add vo or dialogue');

// 15–60 s allowed; above 34 s is a deliberate choice, not a default
if (S.duration > 60) problems.push(`duration ${S.duration} s: max 60 s`);
else if (S.duration > 34) console.log(`WARNING: duration ${S.duration} s is above 34 s; keep it only if the concept justifies the length`);
const wordsFile = path.join(dir, 'audio/vo_words.json');
if (S.vo && fs.existsSync(wordsFile)) {
  const n = JSON.parse(fs.readFileSync(wordsFile, 'utf8')).words.length;
  let prev = -1;
  if (!(S.vo.place || []).length) problems.push(`vo.place is empty: add segments {words:[first,last], anchor, at} covering words 0–${n - 1} (vo.py printed them)`);
  for (const p of S.vo.place || []) {
    const [a, b] = p.words;
    if (a > b || b >= n || p.anchor < a || p.anchor > b) problems.push(`vo.place ${JSON.stringify(p.words)}: indices must satisfy first ≤ anchor ≤ last < ${n}`);
    if (a !== prev + 1) problems.push(`vo.place ${JSON.stringify(p.words)}: segments must cover the words in order (expected first = ${prev + 1})`);
    prev = b;
  }
  if (prev !== n - 1) problems.push(`vo.place ends at word ${prev}, the voice-over has ${n} words`);
}
const Z = S.format.safe;
if (Z.l < 0 || Z.r > S.format.width || Z.t < 0 || Z.b > S.format.height || Z.l >= Z.r || Z.t >= Z.b) problems.push('format.safe is outside the frame');

if (problems.length) { console.log(`scenes.json: ${problems.length} problem(s)\n- ` + problems.join('\n- ')); process.exit(1); }
console.log('scenes.json OK');
