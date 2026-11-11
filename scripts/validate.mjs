// node validate.mjs <project> → schema check of scenes.json plus the cross-references a schema can't see:
// asset files exist, layer/arc/icon names resolve, VO segments fit the word list. Exit 1 on any problem.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { projectDir, readScenes } from './lib/stage.mjs';

const dir = projectDir(process.argv[2]);
const S = readScenes(dir);
const schema = JSON.parse(fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../schemas/scenes.schema.json'), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: false });
const problems = [];
if (!ajv.validate(schema, S)) for (const e of ajv.errors) problems.push(`schema: ${e.instancePath || '/'} ${e.message}${e.params && e.params.additionalProperty ? ` (${e.params.additionalProperty})` : ''}`);

const assets = S.assets || {};
for (const [k, f] of Object.entries(assets)) if (!fs.existsSync(path.join(dir, f))) problems.push(`asset "${k}": file ${f} not found`);
const ids = new Set();
for (const L of S.layers || []) {
  if (ids.has(L.id)) problems.push(`layer id "${L.id}" is used twice`);
  ids.add(L.id);
  const kind = L.kind || 'img';
  if (kind === 'img' && !L.src) problems.push(`layer "${L.id}": img layer needs "src"`);
  if (L.src && !assets[L.src]) problems.push(`layer "${L.id}": src "${L.src}" is not in assets`);
  if (kind === 'fill' && !L.fill) problems.push(`layer "${L.id}": fill layer needs "fill"`);
  if (kind === 'sheen' && (L.t0 == null || L.t1 == null)) problems.push(`layer "${L.id}": sheen needs t0 and t1`);
  if (L.mode === 'world' && !L.place) problems.push(`layer "${L.id}": world layer needs "place"`);
}
for (const a of S.arcs || []) {
  const L = (S.layers || []).find(l => l.id === a.layer);
  if (!L) problems.push(`arc: layer "${a.layer}" not found`);
  else if ((L.kind || 'img') !== 'img' || L.mode === 'world') problems.push(`arc: layer "${a.layer}" must be a cover img layer`);
}
for (const c of S.chips || []) if (c.icon && !(S.icons || {})[c.icon]) problems.push(`chip "${c.text}": icon "${c.icon}" not in icons`);
if (S.music && S.music.file && !fs.existsSync(path.join(dir, S.music.file)) && !S.music.prompt)
  problems.push(`music.file ${S.music.file} is missing and there is no music.prompt to generate it`);
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
