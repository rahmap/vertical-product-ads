/* vertical-product-ads engine.
 *
 * Reads <project>/scenes.json (+ audio/words.json and audio/grid.json when present) and exposes a pure
 * window.seek(t): every style is computed from t, nothing is carried between frames.
 *
 * One shape, never cut: a rounded clip that holds three bands. The bands can split apart (gap), change
 * relative heights (b0..b2) and merge again; every scene is the same element morphing.
 *
 * Globals set for the tools: READY, seek, FILM_DURATION, CUES, SCENE_META. Load errors land in ERROR.
 */
'use strict';

const PROJECT = new URLSearchParams(location.search).get('project') || '/project/';
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, p) => a + (b - a) * p;
const smooth = p => { p = clamp(p); return p * p * (3 - 2 * p); };

function stepR(tau, { w, z }) {
  if (tau <= 0) return 0;
  if (z >= 1) { const x = w * tau; return 1 - Math.exp(-x) * (1 + x); }
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * tau) * (Math.cos(wd * tau) + (z * w / wd) * Math.sin(wd * tau));
}
class Track {
  constructor(v0) { this.v0 = v0; this.cur = v0; this.ev = []; }
  to(t, v, sp) { if (v !== this.cur) { this.ev.push([t, v - this.cur, sp]); this.cur = v; } return this; }
  at(t) { let v = this.v0; for (const [ti, d, sp] of this.ev) v += d * stepR(t - ti, sp); return v; }
}
function vis(t, tin, tout, dOut = 0.16, w = 24) {
  const e = stepR(t - tin, { w, z: 1 });
  const x = tout == null ? 0 : clamp((t - tout) / dOut), xo = x * x;
  return { o: e * (1 - xo), b: (1 - e) * 12 + xo * 12, e, x: xo };
}
const punch = tau => (tau > 0 ? Math.exp(-tau * 9) * Math.sin(tau * 21) : 0);

const SPRINGS = {
  morph: { w: 9.5, z: 0.88 }, snap: { w: 16, z: 0.76 }, settle: { w: 7, z: 1 }, drift: { w: 1.9, z: 1 },
  slow: { w: 2.3, z: 1 }, drag: { w: 4.4, z: 1 }, move: { w: 9, z: 1 }, lead: { w: 26, z: 0.86 },
  trail: { w: 13, z: 0.9 }, jump: { w: 60, z: 1 },
};
const TEXT_CLASSES = new Set(['serif', 'sans', 'ital', 'h0', 'h1', 'sub', 'wordmark', 'caps', 'foot']);
const TRACK_KEYS = ['x', 'y', 'w', 'h', 'r', 'gap', 'rin', 'b0', 'b1', 'b2', 'lz', 'cx', 'cy', 'dx', 'dy'];

async function fetchJSON(path, optional) {
  const res = await fetch(PROJECT + path);
  if (!res.ok) { if (optional) return null; throw new Error(`${path}: HTTP ${res.status}`); }
  return res.json();
}

async function main() {
  const S = await fetchJSON('scenes.json');
  const WORDS = await fetchJSON('audio/words.json', true);
  const FOOT = (S.layers || []).some(l => l.kind === 'video') ? await fetchJSON('build/footage.json', true) : null;
  if ((S.layers || []).some(l => l.kind === 'video') && !FOOT) throw new Error('video layers need build/footage.json: run footage.py (make.sh runs it)');
  const GRID = (await fetchJSON('audio/grid.json', true)) ||
    { period: 60 / ((S.music && S.music.bpm) || 120), phase: 0, peak_offset: 0 };

  const W = S.format.width, H = S.format.height, CX = W / 2, CY = H / 2;
  const SAFE = S.format.safe;
  const FILM = S.duration;
  // cut edges snap to the boundary between two output frames: the motion-blur subframes of a frame (±1.5/240 s around
  // its centre) then all fall on one side, so a cut never renders as a 50/50 double exposure
  const FPS = (S.render && S.render.fps) || 30;
  const frameEdge = e => (Math.round(e * FPS) - 0.5) / FPS;
  // "full" = one full-frame image: the bands merge too, else their gaps cross the frame as thin lines
  const FULL = { x: CX, y: CY, w: W, h: H, r: 0, gap: 0, rin: 0 };
  const sp = s => {
    if (s == null) return SPRINGS.morph;
    if (typeof s === 'string') { if (!SPRINGS[s]) throw new Error(`unknown spring "${s}"`); return SPRINGS[s]; }
    return s;
  };

  // ── time expressions ─────────────────────────────────────────────────────────────────────
  // number | "w12" (word start) | "we12" (word end) | "k16" (kick peak of beat 16, fractions allowed)
  // | "ANCHOR" | any of those joined with + / - offsets: "k16-0.13", "w18+0.05", "TAP+0.32"
  // | { cross: "dx", value: 760, from: <time>, to: <time> } (first time the track reaches value)
  const ANCHORS = {};
  const wordAt = (i, key) => {
    if (!WORDS) throw new Error(`time "w${i}" needs audio/words.json (run place_vo.py)`);
    const w = WORDS.find(x => x.i === i);
    if (!w) throw new Error(`word index ${i} not in audio/words.json`);
    return w[key];
  };
  let tracksReady = false;
  function T(e) {
    if (typeof e === 'number') return e;
    if (e && typeof e === 'object' && e.cross) {
      if (!tracksReady) throw new Error('"cross" times are only allowed outside the timeline');
      const tr = TR[e.cross], to = T(e.to), step = e.step || 0.004;
      for (let t = T(e.from); t < to; t += step) if (tr.at(t) >= e.value) return t;
      return to;
    }
    if (typeof e !== 'string') throw new Error(`bad time expression ${JSON.stringify(e)}`);
    const re = /\s*([+-])?\s*(we\d+|w\d+|k\d+(?:\.\d+)?|\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_]*)/y;
    let pos = 0, v = 0, first = true, m;
    while (pos < e.length && (m = re.exec(e))) {
      pos = re.lastIndex;
      const sign = m[1] === '-' ? -1 : 1;
      if (!first && !m[1]) throw new Error(`time "${e}": missing + or -`);
      const tok = m[2];
      let x;
      if (/^we\d+$/.test(tok)) x = wordAt(+tok.slice(2), 'end');
      else if (/^w\d+$/.test(tok)) x = wordAt(+tok.slice(1), 'start');
      else if (/^k[\d.]+$/.test(tok)) x = GRID.phase + +tok.slice(1) * GRID.period + GRID.peak_offset;
      else if (/^[\d.]+$/.test(tok)) x = +tok;
      else if (tok in ANCHORS) x = ANCHORS[tok];
      else throw new Error(`time "${e}": unknown anchor "${tok}"`);
      v += sign * x; first = false;
    }
    if (pos !== e.length || first) throw new Error(`cannot parse time "${e}"`);
    return v;
  }
  for (const [k, e] of Object.entries(S.anchors || {})) ANCHORS[k] = T(e);

  // ── tracks ───────────────────────────────────────────────────────────────────────────────
  const init = { x: CX, y: CY, w: W * 0.87, h: H * 0.4, r: 52, gap: 0, rin: 0, b0: 1, b1: 1, b2: 1, lz: 0,
    cx: CX, cy: CY, dx: W * 0.065, dy: CY, ...(S.shape && S.shape.initial) };
  if (S.touch && S.touch.start) { init.dx = S.touch.start[0]; init.dy = S.touch.start[1]; }
  const TR = {};
  for (const k of TRACK_KEYS) TR[k] = new Track(init[k]);
  TR.ctaL = new Track(CX); TR.ctaR = new Track(CX);
  for (const ev of S.timeline || []) {
    const at = T(ev.at), s = sp(ev.sp);
    const set = ev.set === 'full' ? FULL : ev.set;
    for (const [k, v] of Object.entries(set)) {
      if (k === 'zoom') { TR.lz.to(at, Math.log(v), s); continue; }
      if (!TR[k] || k === 'ctaL' || k === 'ctaR') throw new Error(`timeline: unknown track "${k}"`);
      TR[k].to(at, v, s);
    }
  }
  const CTA = S.cta ? { ...S.cta, tin: T(S.cta.tin), textIn: T(S.cta.textIn), press: T(S.cta.press) } : null;
  if (CTA) {
    TR.ctaL.to(CTA.tin + 0.06, CX - CTA.half, SPRINGS.trail);
    TR.ctaR.to(CTA.tin + 0.06, CX + CTA.half, SPRINGS.lead);
  }
  tracksReady = true;

  // ── value specs ──────────────────────────────────────────────────────────────────────────
  // zoom: number | {to, at, sp} (spring from 1) | array of those (product)
  // shift: {dx: {to, at, sp}, dy: {to, at, sp}} (springs from 0)
  const springFrom = (base, s) => { const tr = new Track(base).to(T(s.at), s.to, sp(s.sp || 'drift')); return t => tr.at(t); };
  function zoomFn(z) {
    if (z == null) return () => 1;
    if (typeof z === 'number') return () => z;
    const parts = (Array.isArray(z) ? z : [z]).map(s => springFrom(1, s));
    return t => parts.reduce((acc, f) => acc * f(t), 1);
  }
  function shiftFn(s) {
    if (!s) return null;
    const dx = s.dx ? springFrom(0, s.dx) : () => 0, dy = s.dy ? springFrom(0, s.dy) : () => 0;
    return t => ({ dx: dx(t), dy: dy(t) });
  }

  // ── scene content ────────────────────────────────────────────────────────────────────────
  const asset = k => { if (!S.assets || !S.assets[k]) throw new Error(`unknown asset "${k}"`); return PROJECT + S.assets[k]; };
  const LAYERS = (S.layers || []).map(L => ({
    id: L.id, kind: L.kind || 'img', band: L.band == null ? 'all' : L.band, mode: L.mode || 'cover',
    src: L.src && L.kind !== 'video' ? asset(L.src) : null, fill: L.fill, fx: L.fx == null ? 0.5 : L.fx, fy: L.fy == null ? 0.5 : L.fy,
    zoom: zoomFn(L.zoom), shift: shiftFn(L.shift), blend: L.blend || null, clipX: L.clipX || null, wipe: !!L.wipe,
    tin: L.tin == null ? -9 : T(L.tin), tout: L.tout == null ? null : T(L.tout), dOut: L.dOut == null ? 0.16 : L.dOut,
    toutBand: L.toutBand ? L.toutBand.map(T) : null,
    t0: L.t0 == null ? null : T(L.t0), t1: L.t1 == null ? null : T(L.t1),
    rect: L.place ? (() => {
      const p = L.place, s = p.size / p.srcSize;
      return { x: p.at[0] - p.imagePoint[0] * s, y: p.at[1] - p.imagePoint[1] * s, w: p.size, h: p.size * (p.srcAspect || 1) };
    })() : null,
    ax: L.pivot ? L.pivot[0] : CX, ay: L.pivot ? L.pivot[1] : CY,
  }));
  const layerById = Object.fromEntries(LAYERS.map(L => [L.id, L]));
  for (const L of LAYERS) {
    if (L.kind === 'img' && !L.src) throw new Error(`layer "${L.id}": img layers need "src"`);
    if (L.mode === 'world' && !L.rect) throw new Error(`layer "${L.id}": world layers need "place"`);
  }
  // video layers: frame n of footage "src" shows at film time t, n = round((vin + t − vat)·fps). round, not floor, so the
  // motion-blur subframes of one output frame all show the same source frame.
  (S.layers || []).forEach((raw, i) => {
    const L = LAYERS[i];
    if (L.kind !== 'video') return;
    L.man = FOOT[raw.src];
    if (!L.man) throw new Error(`layer "${L.id}": footage "${raw.src}" not in build/footage.json (run footage.py)`);
    const seg = raw.dialogue == null ? null : ((S.dialogue || {}).segments || [])[raw.dialogue];
    if (raw.dialogue != null && !seg) throw new Error(`layer "${L.id}": dialogue segment ${raw.dialogue} not found`);
    if (seg) {
      if (raw.tin == null) L.tin = seg.at;
      if (raw.tout == null && raw.toutBand == null) L.tout = seg.at + seg.out - seg.in;
      L.vin = seg.in; L.vat = seg.at;
    } else if (raw.clip) { L.vin = raw.clip.in; L.vat = T(raw.clip.at); }
    else { L.vin = 0; L.vat = raw.tin == null ? 0 : L.tin; }
    L.cut = !!raw.cut;
  });

  const TEXTS = (S.texts || []).map(o => {
    for (const c of o.cls.split(/\s+/)) if (!TEXT_CLASSES.has(c)) throw new Error(`text class "${c}" not in ${[...TEXT_CLASSES]}`);
    return { x: CX, w: 780, align: 'center', dOut: 0.14, lead: 0.05, ...o,
      tout: o.tout == null ? null : T(o.tout), lines: o.lines.map(l => l.map(wd => ({ ...wd, at: T(wd.at) }))) };
  });
  const CHIPS = (S.chips || []).map(c => ({ ...c, tin: T(c.tin), tout: c.tout == null ? null : T(c.tout) }));
  const LABELS = (S.labels || []).map(l => ({ ...l, tin: T(l.tin), tout: l.tout == null ? null : T(l.tout) }));
  const ODOS = (S.odometers || []).map(o => ({ ...o, t0: T(o.t0), t1: T(o.t1), tout: o.tout == null ? null : T(o.tout) }));
  const ARCS = (S.arcs || []).map(a => ({ ...a, layer: layerById[a.layer], t0: T(a.t0), t1: T(a.t1), tout: T(a.tout) }));
  for (const a of ARCS) if (!a.layer) throw new Error('arc: unknown layer');
  const POPS = (S.pops || []).map(p => ({ band: p.band, t: T(p.at) }));
  const touch = S.touch || {};
  const DOT = (touch.windows || []).map(w => ({ tin: T(w.tin), tout: T(w.tout), dOut: w.dOut == null ? 0.2 : w.dOut }));
  const PRESSES = (touch.presses || []).map(T);
  if (CTA) PRESSES.push(CTA.press);
  const HOLDS = (touch.holds || []).map(h => ({ a: T(h.from), b: T(h.to), wiper: !!h.wiper }));

  // captions: word-by-word chunks from audio/words.json (screen space, class "cap" so qa_safe checks them)
  const CAPCFG = { y: Math.round(H * 0.615), size: 64, maxWords: 3, maxGap: 0.35, case: 'upper', style: 'pill', ...S.captions };
  const CAPFIX = Object.fromEntries(Object.entries(CAPCFG.fix || {}).map(([k, v]) => [k.toLowerCase(), v]));
  const CAPS = [];
  if (S.captions) {
    if (!WORDS) throw new Error('captions need audio/words.json (run place_vo.py or place_dialogue.py)');
    const lo = CAPCFG.tin == null ? -Infinity : T(CAPCFG.tin), hi = CAPCFG.tout == null ? Infinity : T(CAPCFG.tout);
    const text = w => { const s = CAPFIX[w.w.toLowerCase()] || w.w; return CAPCFG.case === 'upper' ? s.toUpperCase() : s; };
    let cur = [];
    for (const w of WORDS) {
      const prev = cur[cur.length - 1];
      if (prev && (cur.length >= CAPCFG.maxWords || w.start - prev.end > CAPCFG.maxGap || /[.!?,;:]/.test(prev.p || ''))) { CAPS.push({ words: cur }); cur = []; }
      cur.push({ ...w, text: text(w) });
    }
    if (cur.length) CAPS.push({ words: cur });
    for (const c of CAPS) c.t0 = Math.max(c.words[0].start - 0.06, lo);
    // a chunk leaves before the next one enters: two chunks never share a frame
    CAPS.forEach((c, k) => {
      const first = c.words[0], last = c.words[c.words.length - 1], next = CAPS[k + 1];
      c.t1 = Math.min(Math.max(last.end + 0.25, first.start), next ? next.t0 : Infinity, hi);
    });
  }

  const odoValue = (o, t) => { const p = clamp((t - o.t0) / (o.t1 - o.t0)); return o.final * (1 - Math.pow(1 - p, 4)); };
  const CUES = (S.cues || []).map(c => { const { at, ...rest } = c; return { ...rest, t: +T(at).toFixed(4) }; });
  // odometer ticks: one per integer the last digit passes, thinned to ≥ 30 ms apart
  for (const o of ODOS) {
    let last = -1, lastT = -1;
    for (let t = o.t0; t <= o.t1 + 0.4; t += 0.002) {
      const n = Math.floor(odoValue(o, t));
      if (n !== last && t - lastT > 0.03) { if (last >= 0) CUES.push({ t: +t.toFixed(4), kind: 'tick', gain: 0.12, f: 2400 + n * 8 }); last = n; lastT = t; }
    }
  }

  // ── build DOM ────────────────────────────────────────────────────────────────────────────
  const $ = s => document.querySelector(s);
  const el = (tag, cls, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; parent && parent.appendChild(e); return e; };
  const frame = $('#frame'), world = $('#world'), hud = $('#hud'), bandsEl = $('#bands'), grainEl = $('#grain');
  frame.style.width = W + 'px'; frame.style.height = H + 'px';
  const theme = S.theme || {};
  for (const [k, v] of Object.entries(theme.css || {})) frame.style.setProperty(k, v);
  const cssVar = k => getComputedStyle(frame).getPropertyValue(k).trim();
  const hexRGB = h => { const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(h); if (!m) throw new Error(`theme color "${h}" must be #RRGGBB`); return m.slice(1).map(x => parseInt(x, 16)); };
  const ACC = hexRGB(cssVar('--accent')), ACC2 = hexRGB(cssVar('--accent-pressed'));
  frame.style.setProperty('--accent-rgb', ACC.join(', '));
  const safeBox = $('#safe div');
  Object.assign(safeBox.style, { left: SAFE.l + 'px', top: SAFE.t + 'px', width: SAFE.r - SAFE.l + 'px', height: SAFE.b - SAFE.t + 'px' });
  const overlay = $('#overlay');
  overlay.setAttribute('width', W); overlay.setAttribute('height', H); overlay.setAttribute('viewBox', `0 0 ${W} ${H}`);
  grainEl.width = W + 160; grainEl.height = H + 160;

  const BANDS = [0, 1, 2].map(() => el('div', 'band', bandsEl));
  const SHAPE_SH = el('div', 'shadow', $('#shadows'));
  const SHADOWS = [0, 1, 2].map(() => el('div', 'shadow', $('#shadows')));
  const wave = ([base, amp, freq, phase = 0, fn = 'sin']) => t => base + amp * Math[fn](t * freq + phase);
  const POOLS = (theme.pools || []).map(p => ({ r: p.r, x: wave(p.x), y: wave(p.y), e: el('div', 'pool', $('#bg')), c: p.color }));
  for (const p of POOLS) { p.e.style.width = p.e.style.height = 2 * p.r + 'px'; p.e.style.background = `radial-gradient(closest-side, ${p.c}, rgba(255,255,255,0))`; }

  const imgCache = {};
  for (const L of LAYERS) {
    L.els = [];
    for (const b of L.band === 'all' ? [0, 1, 2] : [L.band]) {
      let e;
      if (L.kind === 'sheen') e = el('div', 'sheen', BANDS[b]);
      else if (L.kind === 'fill') { e = el('div', null, BANDS[b]); e.style.background = L.fill; }
      else if (L.kind === 'video') { e = el('img', null, BANDS[b]); e.decoding = 'sync'; }
      else { e = el('img', null, BANDS[b]); e.src = L.src; e.decoding = 'sync'; imgCache[L.src] = imgCache[L.src] || e; }
      if (L.blend) e.style.mixBlendMode = L.blend;
      L.els.push({ b, e });
    }
  }

  const NS = 'http://www.w3.org/2000/svg';
  for (const a of ARCS) {
    a.path_ = document.createElementNS(NS, 'path');
    for (const [k, v] of [['pathLength', '1'], ['fill', 'none'], ['stroke', '#fff'], ['stroke-width', '7'], ['stroke-linecap', 'round'], ['stroke-dasharray', '1 1']]) a.path_.setAttribute(k, v);
    overlay.appendChild(a.path_);
    a.head = document.createElementNS(NS, 'circle');
    a.head.setAttribute('r', '11'); a.head.setAttribute('fill', '#fff');
    overlay.appendChild(a.head);
  }

  for (const o of TEXTS) {
    o.e = el('div', 'tb ' + o.cls, hud);
    o.e.style.left = o.x - o.w / 2 + 'px'; o.e.style.top = o.y + 'px'; o.e.style.width = o.w + 'px'; o.e.style.textAlign = o.align;
    o.words = [];
    for (const line of o.lines) {
      const le = el('span', 'line', o.e);
      for (const wd of line) {
        const s = el('span', 'w' + (wd.acc ? ' acc' : ''), le); s.textContent = wd.t;
        o.words.push({ s, at: wd.at, slam: !!wd.slam });
      }
    }
  }
  const accentHex = cssVar('--accent');
  for (const c of CHIPS) {
    c.e = el('div', 'chip sans', hud);
    const icon = c.icon ? (S.icons || {})[c.icon] : null;
    if (c.icon && !icon) throw new Error(`chip icon "${c.icon}" not in scenes.icons`);
    if (icon) { const ic = el('span', 'ic', c.e); ic.innerHTML = icon.replaceAll('{accent}', accentHex); }
    el('span', null, c.e).textContent = c.text;
    c.e.style.top = c.y - 46 + 'px';
    if (c.side === 'left') c.e.style.left = c.x + 'px'; else c.e.style.right = W - c.x + 'px';
  }
  for (const l of LABELS) { l.e = el('div', 'label sans', hud); l.e.textContent = l.text; }
  // Odometer cells are 1.4× the font size and use lining figures: glyphs overflow their em box (old-style
  // figures in Georgia/Cormorant descend), and with 1-em cells the neighbouring digit's tail showed inside the
  // window, even at rest. The block is shifted up by the padding so the digits sit where `y` puts them.
  for (const o of ODOS) {
    o.cell = Math.round(o.size * 1.4);
    o.e = el('div', 'odo serif', hud);
    o.e.style.left = '0px'; o.e.style.width = W + 'px'; o.e.style.top = o.y - (o.cell - o.size) / 2 + 'px';
    o.e.style.fontSize = o.size + 'px'; o.e.style.lineHeight = o.cell + 'px';
    const digits = String(o.final).split('');
    o.slots = digits.map((dch, i) => {
      const slot = el('div', 'slot', o.e);
      // the window is the middle 1 em of the cell: rolling digits stay in the number's own band, and a neighbour
      // (0.4 em further out) never reaches it
      slot.style.height = o.cell + 'px';
      slot.style.clipPath = `inset(${(o.cell - o.size) / 2}px -80px)`;
      const probe = el('span', null, slot); probe.textContent = dch; probe.style.visibility = 'hidden';
      const strip = el('div', 'strip', slot);
      for (const n of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0]) { const s = el('span', null, strip); s.textContent = n; s.style.height = o.cell + 'px'; }
      return { slot, strip, p: digits.length - 1 - i };
    });
    if (o.suffix) {   // line-height 1 as before: the padded cell height is for the digits only
      o.suf = el('span', 'ital', o.e); o.suf.textContent = '\u2009' + o.suffix;
      o.suf.style.fontSize = o.size * 0.48 + 'px'; o.suf.style.lineHeight = '1';
    }
  }
  for (const c of CAPS) {
    c.e = el('div', `cap ${CAPCFG.style}`, hud);
    // centred on the frame, so the widest box is symmetric about CX inside the (asymmetric) safe zone
    const capW = 2 * Math.min(CX - SAFE.l, SAFE.r - CX);
    Object.assign(c.e.style, { top: CAPCFG.y + 'px', fontSize: CAPCFG.size + 'px', maxWidth: capW + 'px', display: 'none' });
    c.spans = c.words.map((w, k) => { if (k) c.e.appendChild(document.createTextNode(' ')); const s = el('span', 'cw', c.e); s.textContent = w.text; return s; });
  }
  // a chunk wraps to at most two lines: shrink its font until it does (needs the final font loaded)
  function fitCaptions() {
    const padEm = CAPCFG.style === 'pill' ? 0.4 : 0;
    for (const c of CAPS) {
      let size = CAPCFG.size;
      c.e.style.display = ''; c.e.style.transform = 'translate(-50%, -50%)';
      while (size > 24 && c.e.offsetHeight > size * (2 * 1.12 + padEm) + 1) { size *= 0.94; c.e.style.fontSize = size + 'px'; }
      c.e.style.display = 'none';
    }
  }
  let cta = null, ctaText = null;
  if (CTA) { cta = el('div', 'sans', hud); cta.id = 'cta'; ctaText = el('span', null, cta); ctaText.textContent = CTA.text; }
  for (const h of HOLDS) if (h.wiper) h.e = el('div', 'wiper', hud);
  const ripple = el('div', null, hud); ripple.id = 'ripple';
  const dot = el('div', null, hud); dot.id = 'dot';

  // grain: seeded fixed plate, offset by a playhead hash (deterministic per frame)
  {
    const c = grainEl.getContext('2d'), im = c.createImageData(grainEl.width, grainEl.height);
    let s = 0x9e3779b9;
    const rnd = () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let x = Math.imul(s ^ (s >>> 15), 1 | s); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
    for (let i = 0; i < im.data.length; i += 4) { const v = rnd(); const w = v > 0.5 ? 255 : 0; im.data[i] = im.data[i + 1] = im.data[i + 2] = w; im.data[i + 3] = Math.abs(v - 0.5) * 2 * 255; }
    c.putImageData(im, 0, 0);
  }
  const hash = n => { let x = Math.imul(n ^ 0x5bd1e995, 0x27d4eb2d); x ^= x >>> 15; return (x >>> 0) / 4294967296; };

  // ── draw ─────────────────────────────────────────────────────────────────────────────────
  function shapeRect(t) { const w = TR.w.at(t), h = TR.h.at(t); return { x: TR.x.at(t) - w / 2, y: TR.y.at(t) - h / 2, w, h }; }
  function bandRects(t) {
    const R = shapeRect(t), g = Math.max(0, TR.gap.at(t));
    const ws = [TR.b0.at(t), TR.b1.at(t), TR.b2.at(t)].map(v => Math.max(0, v)), sum = ws[0] + ws[1] + ws[2];
    const inner = R.h - 2 * g; let y = R.y;
    return ws.map(wk => { const h = inner * wk / sum; const r = { x: R.x, y, w: R.w, h }; y += h + g; return r; });
  }
  function coverRect(R, iw, ih, fx, fy, z) {
    const s = Math.max(R.w / iw, R.h / ih) * z, w = iw * s, h = ih * s;
    return { x: clamp(R.x + R.w / 2 - fx * w, R.x + R.w - w, R.x), y: clamp(R.y + R.h / 2 - fy * h, R.y + R.h - h, R.y), w, h };
  }
  function layerRect(L, t, Sh, B) {
    if (L.mode === 'world') {
      const z = L.zoom(t), sh = L.shift ? L.shift(t) : { dx: 0, dy: 0 }, r = L.rect;
      return { x: L.ax + (r.x - L.ax) * z + sh.dx, y: L.ay + (r.y - L.ay) * z + sh.dy, w: r.w * z, h: r.h * z };
    }
    const R = L.band === 'all' ? Sh : B;
    if (L.kind === 'fill') return { x: R.x, y: R.y, w: R.w, h: R.h };
    const img = L.kind === 'video' ? null : imgCache[L.src];
    return coverRect(R, L.man ? L.man.width : img.naturalWidth, L.man ? L.man.height : img.naturalHeight, L.fx, L.fy, L.zoom(t));
  }
  const camAt = t => ({ z: Math.exp(TR.lz.at(t)), cx: TR.cx.at(t), cy: TR.cy.at(t) });
  const toScreen = (x, y, c) => ({ x: (x - c.cx) * c.z + CX, y: (y - c.cy) * c.z + CY });
  const px = v => v.toFixed(2) + 'px';
  const show = (e, on) => { const d = on ? '' : 'none'; if (e.style.display !== d) e.style.display = d; };
  const blurOf = v => (v.b > 0.05 ? `blur(${v.b.toFixed(2)}px)` : '');

  // video frames: a changed frame loads in its <img>; seek() hands the decode promises to its caller
  let pending = [];
  const frameURL = (L, t) => {
    const n = clamp(Math.round((L.vin + t - L.vat) * L.man.fps), 0, L.man.frames - 1);
    return `${PROJECT}${L.man.dir}/f${String(n + 1).padStart(5, '0')}.jpg`;
  };
  function setFrame(L, e, t) {
    const u = frameURL(L, t);
    if (e._u === u) return;
    e._u = u; e.src = u; pending.push(e.decode());
  }
  // cut: exactly on inside [tin, tout), exactly off outside, no blur or scale; edges on frame boundaries
  const layerVis = (L, t, tout) => (L.cut
    ? { o: t >= frameEdge(L.tin) && (tout == null || t < frameEdge(tout)) ? 1 : 0, b: 0, e: 1, x: 0 }
    : vis(t, L.tin, tout, L.dOut));

  function seek(t) {
    pending = [];
    for (const p of POOLS) p.e.style.transform = `translate(${px(p.x(t) - p.r)}, ${px(p.y(t) - p.r)})`;
    const c = camAt(t);
    world.style.transform = `translate(${CX}px, ${CY}px) scale(${c.z.toFixed(5)}) translate(${px(-c.cx)}, ${px(-c.cy)})`;

    // the shape: one rounded clip holds three bands; bands only round their inner corners
    const Sh = shapeRect(t), Bs = bandRects(t), R = Math.min(Math.max(0, TR.r.at(t)), Sh.w / 2, Sh.h / 2);
    const rin = Math.max(0, TR.rin.at(t)), g = TR.gap.at(t), split = clamp(g / 10);
    const seam = g < 0.6 ? 1 : 0;   // merged bands overlap by 1 px so no hairline shows
    bandsEl.style.left = px(Sh.x); bandsEl.style.top = px(Sh.y); bandsEl.style.width = px(Sh.w); bandsEl.style.height = px(Sh.h);
    bandsEl.style.clipPath = `inset(0px round ${px(R)})`;
    const full = Sh.w >= W - 10;
    show(SHAPE_SH, !full && split < 1);
    Object.assign(SHAPE_SH.style, { left: px(Sh.x), top: px(Sh.y), width: px(Sh.w), height: px(Sh.h), borderRadius: px(R), opacity: (1 - split).toFixed(3) });
    const visible = Bs.map(b => b.h > 0.5);
    Bs.forEach((B, i) => {
      const e = BANDS[i], sh = SHADOWS[i], on = visible[i];
      show(e, on); show(sh, on && !full && split > 0);
      if (!on) return;
      const top = !visible.slice(0, i).some(Boolean), bot = !visible.slice(i + 1).some(Boolean);
      const lim = v => Math.min(v, B.h / 2, B.w / 2);
      const ri = lim(rin);
      let sc = 1; for (const p of POPS) if (p.band === i) sc += 0.045 * punch(t - p.t);
      const tf = sc !== 1 ? `scale(${sc.toFixed(4)})` : '';
      const h = B.h + (bot ? 0 : seam);
      Object.assign(e.style, { left: px(B.x - Sh.x), top: px(B.y - Sh.y), width: px(B.w), height: px(h), transform: tf,
        borderRadius: `${px(top ? 0 : ri)} ${px(top ? 0 : ri)} ${px(bot ? 0 : ri)} ${px(bot ? 0 : ri)}`,
        backgroundSize: `${px(Sh.w)} ${px(Sh.h)}`, backgroundPosition: `0px ${px(Sh.y - B.y)}` });
      if (split > 0) {
        const rt = lim(top ? R : rin), rb = lim(bot ? R : rin);
        Object.assign(sh.style, { left: px(B.x), top: px(B.y), width: px(B.w), height: px(B.h), transform: tf,
          borderRadius: `${px(rt)} ${px(rt)} ${px(rb)} ${px(rb)}`, opacity: split.toFixed(3) });
      }
    });

    for (const L of LAYERS) {
      const v0 = L.toutBand ? null : layerVis(L, t, L.tout);
      for (const { b, e } of L.els) {
        const v = v0 || layerVis(L, t, L.toutBand[b]);
        const B = Bs[b], on = v.o > 0.003 && B.h > 0.5;
        show(e, on); if (!on) continue;
        if (L.kind === 'sheen') {
          const p = smooth((t - L.t0) / (L.t1 - L.t0));
          e.style.left = px(Sh.x - B.x + lerp(-1.1, 1.1, p) * Sh.w); e.style.top = px(Sh.y - B.y);
          e.style.width = px(Sh.w); e.style.height = px(Sh.h); e.style.opacity = v.o.toFixed(3);
          continue;
        }
        const r = layerRect(L, t, Sh, B);
        if (L.kind === 'video') setFrame(L, e, t);
        e.style.left = px(r.x - B.x); e.style.top = px(r.y - B.y); e.style.width = px(r.w); e.style.height = px(r.h);
        e.style.opacity = v.o.toFixed(3);
        e.style.filter = blurOf(v);
        const sc = L.wipe ? 1 : 1 + (1 - v.e) * 0.04;
        e.style.transform = sc !== 1 ? `scale(${sc.toFixed(4)})` : '';
        let clip = '';
        if (L.clipX) clip = `inset(0px ${px((1 - L.clipX[1]) * r.w)} 0px ${px(L.clipX[0] * r.w)})`;
        if (L.wipe) clip = `inset(0px ${px(Math.max(0, r.x + r.w - TR.dx.at(t)))} 0px 0px)`;
        e.style.clipPath = clip;
      }
    }

    // gesture arcs drawn over a layer (follow its Ken Burns)
    for (const a of ARCS) {
      const L = a.layer, img = imgCache[L.src], p = smooth((t - a.t0) / (a.t1 - a.t0));
      const v = vis(t, a.t0 - 0.05, a.tout, 0.18);
      const on = p > 0 && v.o > 0.003;
      a.path_.style.display = a.head.style.display = on ? '' : 'none';
      if (!on) continue;
      const r = coverRect(Sh, img.naturalWidth, img.naturalHeight, L.fx, L.fy, L.zoom(t));
      const P = a.path.map(([nx, ny]) => [r.x + nx * r.w, r.y + ny * r.h]);
      a.path_.setAttribute('d', `M${P[0][0]},${P[0][1]} Q${P[1][0]},${P[1][1]} ${P[2][0]},${P[2][1]}`);
      a.path_.setAttribute('stroke-dashoffset', (1 - p).toFixed(4));
      a.path_.style.opacity = (0.92 * v.o).toFixed(3);
      const u = p, q = 1 - u;
      a.head.setAttribute('cx', q * q * P[0][0] + 2 * q * u * P[1][0] + u * u * P[2][0]);
      a.head.setAttribute('cy', q * q * P[0][1] + 2 * q * u * P[1][1] + u * u * P[2][1]);
      a.head.style.opacity = (0.95 * v.o).toFixed(3);
    }

    for (const o of TEXTS) {
      let any = false;
      for (const w of o.words) {
        const v = vis(t, w.at - o.lead, o.tout, o.dOut);
        if (v.o <= 0.003) { if (w.s.style.opacity !== '0') w.s.style.opacity = '0'; continue; }
        any = true;
        let sc = 1;
        if (w.slam) sc = 1 + 0.16 * (1 - stepR(t - (w.at - o.lead), { w: 17, z: 0.74 }));
        const dy = (1 - v.e) * 20 - v.x * 12;
        w.s.style.opacity = v.o.toFixed(3);
        w.s.style.filter = blurOf(v);
        w.s.style.transform = `translateY(${px(dy)})${sc !== 1 ? ` scale(${sc.toFixed(4)})` : ''}`;
      }
      show(o.e, any);
    }

    for (const ch of CHIPS) {
      const v = vis(t, ch.tin, ch.tout, 0.14, 20); show(ch.e, v.o > 0.003); if (v.o <= 0.003) continue;
      const dir = ch.side === 'left' ? -1 : 1;
      ch.e.style.opacity = v.o.toFixed(3);
      ch.e.style.filter = blurOf(v);
      // slides in from the shape side, never past the safe edge
      ch.e.style.transform = `translateX(${px(-dir * (1 - stepR(t - ch.tin, { w: 18, z: 0.8 })) * 90)})`;
    }

    for (const l of LABELS) {
      const v = vis(t, l.tin, l.tout, 0.14); show(l.e, v.o > 0.003); if (v.o <= 0.003) continue;
      const a = toScreen(Sh.x, Sh.y + Sh.h, c), b = toScreen(Sh.x + Sh.w, Sh.y + Sh.h, c);
      l.e.style.top = px(a.y - 86);
      // pinned to the shape's bottom corners, clamped inside the safe zone
      if (l.side === 'left') { l.e.style.left = px(Math.max(SAFE.l + 16, a.x + 28)); l.e.style.right = ''; }
      else { l.e.style.right = px(Math.max(W - SAFE.r + 20, W - b.x + 28)); l.e.style.left = ''; }
      l.e.style.opacity = v.o.toFixed(3); l.e.style.filter = blurOf(v);
    }

    for (const o of ODOS) {
      const v = vis(t, o.t0 - 0.08, o.tout, 0.14); show(o.e, v.o > 0.003); if (v.o <= 0.003) continue;
      o.e.style.opacity = v.o.toFixed(3); o.e.style.filter = blurOf(v);
      const val = odoValue(o, t);
      for (const s of o.slots) {
        const P = Math.pow(10, s.p);
        const d = Math.floor(val / P) % 10 + Math.max(0, (val % P) - (P - 1));
        s.strip.style.transform = `translateY(${px(-d * o.cell)})`;
        s.slot.style.opacity = (s.p === 0 ? 1 : clamp((val - P + 1) / 1.5)).toFixed(3);
      }
    }

    // touch dot, press, ripple, wipers
    let dv = 0; for (const w of DOT) dv += vis(t, w.tin, w.tout, w.dOut, 20).o;
    dv = clamp(dv);
    let hold = 0; for (const h of HOLDS) hold += stepR(t - h.a, { w: 30, z: 1 }) - stepR(t - h.b, { w: 30, z: 1 });
    let press = 0; for (const p of PRESSES) press += Math.exp(-Math.pow((t - p) / 0.06, 2));
    const ds = 1 - 0.14 * clamp(hold) - 0.16 * press;
    show(dot, dv > 0.003);
    if (dv > 0.003) {
      dot.style.left = px(TR.dx.at(t)); dot.style.top = px(TR.dy.at(t));
      dot.style.opacity = dv.toFixed(3); dot.style.transform = `scale(${(ds * (0.85 + 0.15 * dv)).toFixed(4)})`;
    }
    let rp = null; for (const p of PRESSES) if (t >= p && t < p + 0.5) rp = p;
    show(ripple, rp != null && dv > 0.003);
    if (rp != null) {
      const q = (t - rp) / 0.5;
      ripple.style.left = px(TR.dx.at(rp)); ripple.style.top = px(TR.dy.at(rp));
      ripple.style.transform = `scale(${(1 + 1.6 * (1 - Math.pow(1 - q, 3))).toFixed(4)})`;
      ripple.style.opacity = ((1 - q) * 0.9).toFixed(3);
    }
    for (const h of HOLDS) {
      if (!h.e) continue;
      const wv = vis(t, h.a - 0.05, h.b + 0.1, 0.22, 22);
      show(h.e, wv.o > 0.003);
      if (wv.o <= 0.003) continue;
      const a = toScreen(Sh.x, Sh.y, c), b = toScreen(Sh.x, Sh.y + Sh.h, c);
      h.e.style.left = px(TR.dx.at(t) - 7); h.e.style.top = px(a.y - 24); h.e.style.height = px(b.y - a.y + 48);
      h.e.style.opacity = wv.o.toFixed(3);
    }

    // CTA pill: trailing/leading edges on different springs, press pulse, colour settles after the press
    if (CTA) {
      const cv = vis(t, CTA.tin, null);
      show(cta, cv.o > 0.003);
      if (cv.o > 0.003) {
        const L = TR.ctaL.at(t), Rr = TR.ctaR.at(t), wdt = Math.max(CTA.h, Rr - L + CTA.h);
        const cx = (L + Rr) / 2;
        const pp = 1 - 0.05 * Math.exp(-Math.pow((t - CTA.press - 0.03) / 0.07, 2));
        cta.style.left = px(cx - wdt / 2); cta.style.top = px(CTA.y - CTA.h / 2);
        cta.style.width = px(wdt); cta.style.height = px(CTA.h); cta.style.borderRadius = px(CTA.h / 2);
        cta.style.opacity = cv.o.toFixed(3);
        cta.style.transform = `scale(${(pp * (0.6 + 0.4 * stepR(t - CTA.tin, { w: 20, z: 0.78 }))).toFixed(4)})`;
        const pr = stepR(t - CTA.press, { w: 14, z: 1 });
        cta.style.background = `rgb(${[0, 1, 2].map(i => Math.round(lerp(ACC[i], ACC2[i], pr))).join(', ')})`;
        const tv = vis(t, CTA.textIn, null);
        ctaText.style.opacity = tv.o.toFixed(3); ctaText.style.filter = blurOf(tv);
      }
    }

    for (const c of CAPS) {
      const on = t >= c.t0 && t < c.t1;
      show(c.e, on); if (!on) continue;
      const p = stepR(t - c.t0, { w: 26, z: 0.7 });
      c.e.style.opacity = clamp((t - c.t0) / 0.05).toFixed(3);
      // the spring overshoots; cap at 1 so a full-width chunk never grows past the safe zone
      c.e.style.transform = `translate(-50%, -50%) scale(${Math.min(1, 0.86 + 0.14 * p).toFixed(4)})`;
      c.words.forEach((w, k) => {
        const act = t >= w.start && t < w.end + 0.05;
        if (c.spans[k]._act !== act) { c.spans[k]._act = act; c.spans[k].style.color = act ? 'var(--caption-active)' : ''; }
      });
    }

    const f = Math.floor(t * 30);
    grainEl.style.transform = `translate(${px(-hash(f) * 160)}, ${px(-hash(f + 7919) * 160)})`;
    return pending.length ? Promise.all(pending) : undefined;
  }

  window.seek = seek;
  window.FILM_DURATION = FILM;
  window.CUES = CUES.sort((a, b) => a.t - b.t);
  window.SCENE_META = { width: W, height: H, safe: SAFE, duration: FILM };
  if (new URLSearchParams(location.search).has('safe')) $('#safe').classList.add('on');
  // self-hosted faces (project files) first, then preload every face the theme names
  const faces = (theme.fontFaces || []).map(f => new FontFace(f.family, `url("${PROJECT + f.src}")`,
    { style: f.style || 'normal', weight: String(f.weight || 400) }));
  for (const f of faces) document.fonts.add(f);
  await Promise.all(faces.map(f => f.load()));
  await Promise.all([...(theme.fonts || []).map(f => document.fonts.load(f)), ...Object.values(imgCache).map(i => i.decode())]);
  fitCaptions();
  await seek(0);
  window.READY = true;
}

main().catch(e => { window.ERROR = String(e && e.message || e); console.error('engine:', e); });
