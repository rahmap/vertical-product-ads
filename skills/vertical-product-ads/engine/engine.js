/* vertical-product-ads engine.
 *
 * Reads <project>/scenes.json (+ audio/words.json and audio/grid.json when present) and exposes a pure
 * window.seek(t): every style is computed from t, nothing is carried between frames.
 *
 * One shape, never cut: a rounded clip that holds three bands. The bands can split apart (gap), change
 * relative heights (b0..b2) and merge again; every scene is the same element morphing. Panels are extra rounded
 * frames that grow out of the shape (or slide in) for split screens, grids, picture-in-picture, collages and phone
 * mockups; masks, callouts, marquees and check lists are the other layout pieces.
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
// how HUD text and UI enter (theme.enter, usually from the look): blur (default), rise, cut, pop, wipe, type
const ENTERS = new Set(['blur', 'rise', 'cut', 'pop', 'wipe', 'type']);
const POP = { w: 22, z: 0.55 };
const TRACK_KEYS = ['x', 'y', 'w', 'h', 'r', 'gap', 'rin', 'b0', 'b1', 'b2', 'lz', 'cx', 'cy', 'dx', 'dy', 'o'];

async function fetchJSON(path, optional) {
  const res = await fetch(PROJECT + path);
  if (!res.ok) { if (optional) return null; throw new Error(`${path}: HTTP ${res.status}`); }
  return res.json();
}
// looks/<name>.json from the skill: a preset theme (+ caption defaults) that scenes.json "theme" overrides
async function fetchLook(name) {
  const res = await fetch('/looks/' + encodeURIComponent(name) + '.json');
  if (!res.ok) throw new Error(`look "${name}": no looks/${name}.json in the skill`);
  return res.json();
}

async function main() {
  const S = await fetchJSON('scenes.json');
  const LOOK = S.look ? await fetchLook(S.look) : null;
  const WORDS = await fetchJSON('audio/words.json', true);
  const usesFootage = (S.layers || []).some(l => l.kind === 'video') || (S.masks || []).some(m => m.footage);
  const FOOT = usesFootage ? await fetchJSON('build/footage.json', true) : null;
  if (usesFootage && !FOOT) throw new Error('video layers and footage masks need build/footage.json: run footage.py (make.sh runs it)');
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
    cx: CX, cy: CY, dx: W * 0.065, dy: CY, o: 1, ...(S.shape && S.shape.initial) };
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

  // ── panels ───────────────────────────────────────────────────────────────────────────────
  // x, y = centre in world px, like the shape. A panel enters at tin (out of the shape's rect at that moment, from
  // an edge, scaling up, fading or on a cut), springs through its moves, and leaves at tout the same ways.
  const PANEL_WAYS = new Set(['shape', 'left', 'right', 'top', 'bottom', 'scale', 'fade', 'cut']);
  const PANEL_KEYS = ['x', 'y', 'w', 'h', 'r', 'rot'];
  const isEdge = s => s === 'left' || s === 'right' || s === 'top' || s === 'bottom';
  const shapeAt = t => ({ x: TR.x.at(t), y: TR.y.at(t), w: TR.w.at(t), h: TR.h.at(t), r: TR.r.at(t), rot: 0 });
  const offEdge = (side, g) => {
    const o = { ...g }, reach = Math.hypot(g.w, g.h) / 2 + 40;   // fully outside the frame, even rotated
    if (side === 'left') o.x = -reach; else if (side === 'right') o.x = W + reach;
    else if (side === 'top') o.y = -reach; else o.y = H + reach;
    return o;
  };
  const PANELS = (S.panels || []).map(P => {
    const from = P.from || 'shape', into = P.into || 'fade';
    for (const w of [from, into]) if (!PANEL_WAYS.has(w)) throw new Error(`panel "${P.id}": "${w}" not in ${[...PANEL_WAYS]}`);
    const tin = T(P.tin), tout = P.tout == null ? null : T(P.tout), s = sp(P.sp);
    const goal = { x: P.x, y: P.y, w: P.w, h: P.h, r: P.r == null ? 40 : P.r, rot: P.rot || 0 };
    const start = from === 'shape' ? shapeAt(tin) : isEdge(from) ? offEdge(from, goal) : goal;
    const tr = Object.fromEntries(PANEL_KEYS.map(k => [k, new Track(start[k]).to(tin, goal[k], s)]));
    for (const m of P.moves || []) {
      const at = T(m.at), ms = sp(m.sp);
      for (const [k, v] of Object.entries(m.set)) {
        if (!tr[k]) throw new Error(`panel "${P.id}": move key "${k}" not in ${PANEL_KEYS}`);
        tr[k].to(at, v, ms);
      }
    }
    if (tout != null && (into === 'shape' || isEdge(into))) {
      const cur = Object.fromEntries(PANEL_KEYS.map(k => [k, tr[k].cur]));
      const end = into === 'shape' ? shapeAt(tout) : offEdge(into, cur);
      for (const k of PANEL_KEYS) tr[k].to(tout, end[k], s);
    }
    return { id: P.id, tin, tout, from, into, tr, frame: P.frame || 'none', shadow: P.shadow !== false };
  });
  const panelById = Object.fromEntries(PANELS.map(P => [P.id, P]));

  // ── scene content ────────────────────────────────────────────────────────────────────────
  const asset = k => { if (!S.assets || !S.assets[k]) throw new Error(`unknown asset "${k}"`); return PROJECT + S.assets[k]; };
  const LAYERS = (S.layers || []).map(L => ({
    id: L.id, kind: L.kind || 'img', band: L.band == null ? 'all' : L.band, mode: L.mode || 'cover', panel: L.panel || null,
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
  for (const L of LAYERS) {
    if (!L.panel) continue;
    L.P = panelById[L.panel];
    if (!L.P) throw new Error(`layer "${L.id}": panel "${L.panel}" not in panels`);
    if (L.wipe || L.mode === 'world' || L.toutBand) throw new Error(`layer "${L.id}": a panel layer is a cover layer without wipe or toutBand`);
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
  const POPS = (S.pops || []).map(p => ({ band: p.band, panel: p.panel, t: T(p.at) }));
  const touch = S.touch || {};
  const DOT = (touch.windows || []).map(w => ({ tin: T(w.tin), tout: T(w.tout), dOut: w.dOut == null ? 0.2 : w.dOut }));
  const PRESSES = (touch.presses || []).map(T);
  if (CTA) PRESSES.push(CTA.press);
  const HOLDS = (touch.holds || []).map(h => ({ a: T(h.from), b: T(h.to), wiper: !!h.wiper }));

  // masks (a picture inside big letters), callouts, marquees, check lists: the look styles them
  const MASKS = (S.masks || []).map(m => {
    const o = { x: CX, cls: 'serif', dOut: 0.16, fx: 0.5, fy: 0.5, ...m, zoomF: zoomFn(m.zoom),
      tin: T(m.tin), tout: m.tout == null ? null : T(m.tout), src: m.src ? asset(m.src) : null };
    for (const c of o.cls.split(/\s+/)) if (!['serif', 'sans', 'ital'].includes(c)) throw new Error(`mask class "${c}" not in serif, sans, ital`);
    if (m.footage) {
      o.man = FOOT[m.footage];
      if (!o.man) throw new Error(`mask "${m.text}": footage "${m.footage}" not in build/footage.json (run footage.py)`);
      o.vin = m.clip ? m.clip.in : 0; o.vat = m.clip ? T(m.clip.at) : o.tin;
    }
    return o;
  });
  const CALLS = (S.callouts || []).map(c => ({ ...c, side: c.side || (c.label[0] >= c.point[0] ? 'right' : 'left'),
    tin: T(c.tin), tout: c.tout == null ? null : T(c.tout) }));
  const MARQS = (S.marquees || []).map(m => ({ h: 96, speed: 140, dir: 'left', rot: 0, sep: '•', ...m,
    tin: T(m.tin), tout: m.tout == null ? null : T(m.tout) }));
  const CHECKS = (S.checks || []).map(k => {
    const cols = k.head ? k.head.length : 1;
    const rows = k.rows.map(r => ({ ...r, at: T(r.at), marks: r.marks || [true] }));
    for (const r of rows) if (r.marks.length !== cols) throw new Error(`checks: row "${r.text}" has ${r.marks.length} marks, the list has ${cols} column(s)`);
    return { x: CX, w: 800, size: 44, ...k, cols, rows, tin: k.tin == null ? rows[0].at - 0.12 : T(k.tin), tout: k.tout == null ? null : T(k.tout) };
  });

  // captions: word-by-word chunks from audio/words.json (screen space, class "cap" so qa_safe checks them)
  const CAPCFG = { y: Math.round(H * 0.615), size: 64, maxWords: 3, maxGap: 0.35, case: 'upper', style: 'pill', ...(LOOK && LOOK.captions), ...S.captions };
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
  const shadowsEl = $('#shadows'), panelsEl = $('#panels');
  frame.style.width = W + 'px'; frame.style.height = H + 'px';
  // look first, then the project's own theme on top: css keys and pools override, fonts and faces add up
  const LT = (LOOK && LOOK.theme) || {}, PT = S.theme || {};
  const theme = {
    css: { ...LT.css, ...PT.css }, fonts: [...(LT.fonts || []), ...(PT.fonts || [])], pools: PT.pools || LT.pools || [],
    faces: [...(LT.fontFaces || []).map(f => ({ ...f, url: '/looks/' + f.src })), ...(PT.fontFaces || []).map(f => ({ ...f, url: PROJECT + f.src }))],
  };
  const ENTER = PT.enter || LT.enter || 'blur';
  if (!ENTERS.has(ENTER)) throw new Error(`theme.enter "${ENTER}" not in ${[...ENTERS]}`);
  for (const [k, v] of Object.entries(theme.css)) frame.style.setProperty(k, v);
  const cssVar = k => getComputedStyle(frame).getPropertyValue(k).trim();
  const hexRGB = h => { const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(h); if (!m) throw new Error(`theme color "${h}" must be #RRGGBB`); return m.slice(1).map(x => parseInt(x, 16)); };
  const ACC = hexRGB(cssVar('--accent')), ACC2 = hexRGB(cssVar('--accent-pressed'));
  frame.style.setProperty('--accent-rgb', ACC.join(', '));
  // --ui-round scales the corner radius of chips, labels and the CTA (1 = pill, 0 = square)
  const UI_ROUND = cssVar('--ui-round') === '' ? 1 : parseFloat(cssVar('--ui-round'));
  // --panel-round scales panel corner radii the same way (phones keep theirs)
  const PANEL_ROUND = cssVar('--panel-round') === '' ? 1 : parseFloat(cssVar('--panel-round'));
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

  for (const P of PANELS) {
    P.e = el('div', `pnl ${P.frame}${P.shadow ? '' : ' flat'}`, panelsEl); P.e.dataset.id = P.id;
    P.pin = el('div', 'pin', P.e);
    if (P.frame === 'phone') P.island = el('div', 'island', P.e);
  }
  const imgCache = {};
  for (const L of LAYERS) {
    L.els = [];
    for (const b of L.P ? ['p'] : L.band === 'all' ? [0, 1, 2] : [L.band]) {
      const parent = L.P ? L.P.pin : BANDS[b];
      let e;
      if (L.kind === 'sheen') e = el('div', 'sheen', parent);
      else if (L.kind === 'fill') { e = el('div', null, parent); e.style.background = L.fill; }
      else if (L.kind === 'video') { e = el('img', null, parent); e.decoding = 'sync'; }
      else { e = el('img', null, parent); e.src = L.src; e.decoding = 'sync'; imgCache[L.src] = imgCache[L.src] || e; }
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

  // marquees and masks sit under the texts, so they are built first
  for (const m of MARQS) {
    m.e = el('div', 'marq', hud); m.track = el('div', 'mtrack', m.e);
    Object.assign(m.e.style, { left: -0.25 * W + 'px', width: 1.5 * W + 'px', top: m.y - m.h / 2 + 'px', height: m.h + 'px' });
    if (m.fill) m.e.style.background = m.fill;
    if (m.ink) m.e.style.color = m.ink;
    m.track.style.fontSize = (m.size || Math.round(m.h * 0.5)) + 'px';
    el('span', null, m.track).textContent = m.text; el('span', 'sep', m.track).textContent = m.sep;
  }
  for (const m of MASKS) {
    m.e = el('div', 'mask ' + m.cls, hud); m.in = el('span', 'mki', m.e);
    m.e.style.left = m.x + 'px'; m.e.style.top = m.y + 'px'; m.e.style.fontSize = m.size + 'px';
    if (ENTER === 'rise') m.e.style.clipPath = 'inset(-0.4em -0.5em -0.3em -0.5em)';
    if (ENTER === 'type') m.chars = [...m.text].map(ch => { const c = el('span', null, m.in); c.textContent = ch; return c; });
    else m.in.textContent = m.text;
    if (m.fill) { m.in.style.background = m.fill; m.in.style.webkitBackgroundClip = m.in.style.backgroundClip = 'text'; }
    else if (m.src) { m.img = imgCache[m.src] || (imgCache[m.src] = Object.assign(new Image(), { src: m.src })); m.in.style.backgroundImage = `url("${m.src}")`; }
    else m.img = new Image();   // footage: decodes each new frame before it is shown
  }
  for (const o of TEXTS) {
    o.e = el('div', 'tb ' + o.cls, hud);
    o.e.style.left = o.x - o.w / 2 + 'px'; o.e.style.top = o.y + 'px'; o.e.style.width = o.w + 'px'; o.e.style.textAlign = o.align;
    o.words = [];
    for (const line of o.lines) {
      const le = el('span', 'line', o.e);
      for (const wd of line) {
        const s = el('span', 'w' + (wd.acc ? ' acc' : ''), le);
        const w = { s, at: wd.at, slam: !!wd.slam };
        // rise: the glyphs (inner span) slide up inside the word's fixed clip, so the measured box never moves
        if (ENTER === 'rise') { s.style.clipPath = 'inset(-0.4em -0.5em -0.3em -0.5em)'; w.inner = el('span', 'wi', s); w.inner.textContent = wd.t; }
        // type: one span per character; hidden ones keep their space, so the layout never changes
        else if (ENTER === 'type') w.chars = [...wd.t].map(ch => { const c = el('span', null, s); c.textContent = ch; return c; });
        else s.textContent = wd.t;
        o.words.push(w);
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
  const svgEl = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); parent.appendChild(e); return e; };
  if (CALLS.length) {
    const svg = svgEl('svg', { id: 'calls', width: W, height: H, viewBox: `0 0 ${W} ${H}` }, hud);
    for (const k of CALLS) {
      const [x0, y0] = k.point, [lx, ly] = k.label;
      k.line = svgEl('line', { x1: x0, y1: y0, x2: lx, y2: ly, pathLength: 1, 'stroke-dasharray': '1 1', class: 'cl-line' }, svg);
      k.dot = svgEl('circle', { cx: x0, cy: y0, r: 12, class: 'cl-dot' }, svg);
    }
  }
  // callout labels: the near edge sits on the line's end, vertically centred on it
  for (const k of CALLS) {
    k.e = el('div', 'callout', hud); k.e.textContent = k.text;
    k.e.style.top = k.label[1] - 36 + 'px';
    if (k.side === 'right') k.e.style.left = k.label[0] + 'px'; else k.e.style.right = W - k.label[0] + 'px';
  }
  const MARK_D = { true: 'M5 12.5 10 17.5 19.5 7', false: 'M7 7 17 17 M17 7 7 17' };
  for (const k of CHECKS) {
    const rowH = Math.round(k.size * 2.1), gap = Math.round(k.size * 0.34), pad = Math.round(k.size * 0.7);
    k.mw = Math.round(k.size * 2.4);
    const box = (e, top, h) => Object.assign(e.style, { left: k.x - k.w / 2 + 'px', top: top + 'px', width: k.w + 'px', height: h + 'px',
      paddingLeft: pad + 'px', paddingRight: Math.round(pad * 0.4) + 'px' });
    let y = k.y;
    if (k.head) {
      const hh = Math.round(k.size * 1.2);
      k.he = el('div', 'ck-head', hud); box(k.he, y, hh); k.he.style.fontSize = Math.round(k.size * 0.6) + 'px';
      el('span', 'ck-t', k.he);
      k.hcells = k.head.map(name => { const s = el('span', 'ck-m', k.he); s.textContent = name; s.style.width = k.mw + 'px'; return s; });
      y += hh + gap;
    }
    for (const r of k.rows) {
      r.e = el('div', 'ck-row', hud); box(r.e, y, rowH);
      r.e.style.fontSize = k.size + 'px'; r.e.style.borderRadius = rowH / 2 * UI_ROUND + 'px';
      r.t = el('span', 'ck-t', r.e); r.t.textContent = r.text;
      r.cells = []; r.paths = r.marks.map(m => {
        const cell = el('span', 'ck-m', r.e); cell.style.width = k.mw + 'px'; r.cells.push(cell);
        const svg = svgEl('svg', { viewBox: '0 0 24 24', width: Math.round(k.size * 1.15), height: Math.round(k.size * 1.15) }, cell);
        return svgEl('path', { d: MARK_D[m], pathLength: 1, 'stroke-dasharray': '1 1', class: m ? 'ck-yes' : 'ck-no' }, svg);
      });
      y += rowH + gap;
    }
  }
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
  // after the fonts: comparison columns widen to their headers, row text shrinks to its row, mask boxes are
  // measured, marquee text repeats to cover the band
  function fitLayouts() {
    for (const k of CHECKS) {
      if (k.hcells) {
        const need = Math.ceil(Math.max(...k.hcells.map(s => s.scrollWidth)) + k.size * 0.5);
        if (need > k.mw) for (const c of [...k.hcells, ...k.rows.flatMap(r => r.cells)]) c.style.width = need + 'px';
      }
      for (const r of k.rows) { let s = k.size; while (s > k.size * 0.6 && r.t.scrollWidth > r.t.clientWidth + 0.5) { s *= 0.95; r.t.style.fontSize = s + 'px'; } }
    }
    for (const m of MASKS) { m.bw = m.in.offsetWidth; m.bh = m.in.offsetHeight; }
    for (const m of MARQS) {
      const unit = [...m.track.children];
      m.seg = unit.reduce((a, e) => a + e.getBoundingClientRect().width, 0);
      for (let n = Math.ceil(1.5 * W / m.seg) + 1; n > 0; n--) for (const e of unit) m.track.appendChild(e.cloneNode(true));
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
  function layerRect(L, t, R) {
    if (L.mode === 'world') {
      const z = L.zoom(t), sh = L.shift ? L.shift(t) : { dx: 0, dy: 0 }, r = L.rect;
      return { x: L.ax + (r.x - L.ax) * z + sh.dx, y: L.ay + (r.y - L.ay) * z + sh.dy, w: r.w * z, h: r.h * z };
    }
    if (L.kind === 'fill') return { x: R.x, y: R.y, w: R.w, h: R.h };
    const img = L.kind === 'video' ? null : imgCache[L.src];
    return coverRect(R, L.man ? L.man.width : img.naturalWidth, L.man ? L.man.height : img.naturalHeight, L.fx, L.fy, L.zoom(t));
  }
  const camAt = t => ({ z: Math.exp(TR.lz.at(t)), cx: TR.cx.at(t), cy: TR.cy.at(t) });
  const toScreen = (x, y, c) => ({ x: (x - c.cx) * c.z + CX, y: (y - c.cy) * c.z + CY });
  const px = v => v.toFixed(2) + 'px';
  const show = (e, on) => { const d = on ? '' : 'none'; if (e.style.display !== d) e.style.display = d; };
  const blurOf = v => (v.b > 0.05 ? `blur(${v.b.toFixed(2)}px)` : '');
  // non-blur entrances never blur: cut switches on/off on frame boundaries; the others ramp the opacity and give an
  // entry progress e (critically damped) and an exit progress x
  function enterVis(t, tin, tout, dOut = 0.16, w = 16) {
    if (ENTER === 'cut') { const on = t >= frameEdge(tin) && (tout == null || t < frameEdge(tout)); return { o: on ? 1 : 0, b: 0, e: 1, x: 0 }; }
    const tau = t - tin;
    if (tau <= 0) return { o: 0, b: 0, e: 0, x: 0 };
    const x = tout == null ? 0 : clamp((t - tout) / dOut), xo = x * x;
    return { o: clamp(tau / (ENTER === 'pop' ? 0.05 : 0.09)) * (1 - xo), b: 0, e: stepR(tau, { w, z: 1 }), x: xo };
  }
  const hudVis = (t, tin, tout, dOut, w) => (ENTER === 'blur' ? vis(t, tin, tout, dOut, w) : enterVis(t, tin, tout, dOut, w));
  // reveal from one side; once p reaches 1 the clip leaves `pad` px around the box (glyph overhang, shadows)
  const revealClip = (p, fromRight, pad) => {
    if (p >= 0.999) return '';
    const edge = `calc(${((1 - p) * 100).toFixed(2)}% + ${((1 - p) * 2 * pad - pad).toFixed(2)}px)`;
    return fromRight ? `inset(-${pad}px -${pad}px -${pad}px ${edge})` : `inset(-${pad}px ${edge} -${pad}px -${pad}px)`;
  };

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
  // panel entry/exit: opacity o and scale sc
  function panelVis(P, t) {
    let o = 1, sc = 1;
    if (P.from === 'fade') o = stepR(t - P.tin, { w: 14, z: 1 });
    else if (P.from === 'scale') { sc = stepR(t - P.tin, POP); o = clamp((t - P.tin) / 0.06); }
    else if (t < frameEdge(P.tin)) o = 0;
    if (P.tout != null) {
      const u = t - P.tout;
      if (P.into === 'cut') { if (t >= frameEdge(P.tout)) o = 0; }
      else if (u > 0 && P.into === 'fade') o *= 1 - clamp(u / 0.2) ** 2;
      else if (u > 0 && P.into === 'scale') sc *= 1 - stepR(u, { w: 20, z: 1 });
      else if (u > 0 && P.into === 'shape') o *= 1 - clamp((u - 0.35) / 0.15);   // lands on the shape, then hands over
    }
    return { o, sc };
  }
  // the picture area inside a panel's frame: polaroid paper, phone bezel, or none
  function framePad(frame, w, h, r) {
    if (frame === 'polaroid') { const s = w * 0.055; return { l: s, t: s, r: s, b: Math.min(w * 0.2, h * 0.3), ri: Math.min(r * 0.4, s) }; }
    if (frame === 'phone') { const s = w * 0.035; return { l: s, t: s, r: s, b: s, ri: Math.max(0, r - s) }; }
    return { l: 0, t: 0, r: 0, b: 0, ri: r };
  }

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
    // shape opacity: 0 hides it (panels or type alone carry the frame)
    const so = clamp(TR.o.at(t)), sop = so < 0.999 ? so.toFixed(3) : '';
    show(bandsEl, so > 0.003); show(shadowsEl, so > 0.003);
    if (bandsEl.style.opacity !== sop) { bandsEl.style.opacity = sop; shadowsEl.style.opacity = sop; }
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

    for (const P of PANELS) {
      const pv = panelVis(P, t);
      const w = Math.max(1, P.tr.w.at(t)), h = Math.max(1, P.tr.h.at(t)), x = P.tr.x.at(t), y = P.tr.y.at(t);
      const s = toScreen(x, y, c), reach = Math.hypot(w, h) / 2 * c.z;
      P.on = pv.o > 0.003 && pv.sc > 0.003 && s.x + reach > 0 && s.x - reach < W && s.y + reach > 0 && s.y - reach < H;
      show(P.e, P.on); if (!P.on) continue;
      const r = clamp(P.tr.r.at(t) * (P.frame === 'phone' ? 1 : PANEL_ROUND), 0, Math.min(w, h) / 2), rot = P.tr.rot.at(t);
      let sc = pv.sc; for (const p of POPS) if (p.panel === P.id) sc += 0.045 * punch(t - p.t);
      Object.assign(P.e.style, { left: px(x - w / 2), top: px(y - h / 2), width: px(w), height: px(h), borderRadius: px(r),
        opacity: pv.o < 0.999 ? pv.o.toFixed(3) : '',
        transform: (Math.abs(rot) > 0.01 ? `rotate(${rot.toFixed(3)}deg)` : '') + (Math.abs(sc - 1) > 1e-4 ? ` scale(${sc.toFixed(4)})` : '') });
      const f = framePad(P.frame, w, h, r);
      P.inner = { x: 0, y: 0, w: w - f.l - f.r, h: h - f.t - f.b };
      Object.assign(P.pin.style, { left: px(f.l), top: px(f.t), width: px(P.inner.w), height: px(P.inner.h), borderRadius: px(f.ri) });
      if (P.island) Object.assign(P.island.style, { left: px(w * 0.35), top: px(f.t + w * 0.03), width: px(w * 0.3), height: px(w * 0.085) });
    }

    for (const L of LAYERS) {
      const v0 = L.toutBand ? null : layerVis(L, t, L.tout);
      for (const { b, e } of L.els) {
        const v = v0 || layerVis(L, t, L.toutBand[b]);
        // a panel layer draws in the panel's picture box (local coordinates), a band layer in its band
        const B = L.P ? L.P.inner : Bs[b], Sx = L.P ? B : Sh;
        const on = v.o > 0.003 && (L.P ? L.P.on : B.h > 0.5);
        show(e, on); if (!on) continue;
        if (L.kind === 'sheen') {
          const p = smooth((t - L.t0) / (L.t1 - L.t0));
          e.style.left = px(Sx.x - B.x + lerp(-1.1, 1.1, p) * Sx.w); e.style.top = px(Sx.y - B.y);
          e.style.width = px(Sx.w); e.style.height = px(Sx.h); e.style.opacity = v.o.toFixed(3);
          continue;
        }
        const r = layerRect(L, t, L.band === 'all' || L.P ? Sx : B);
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
        const t0 = w.at - o.lead;
        const v = hudVis(t, t0, o.tout, o.dOut);
        if (v.o <= 0.003) { if (w.s.style.opacity !== '0') w.s.style.opacity = '0'; continue; }
        any = true;
        let sc = 1;
        if (w.slam) sc = 1 + 0.16 * (1 - stepR(t - t0, { w: 17, z: 0.74 }));
        if (ENTER === 'pop') sc *= 0.5 + 0.5 * stepR(t - t0, POP);
        const dy = ENTER === 'blur' ? (1 - v.e) * 20 - v.x * 12 : ENTER === 'cut' ? 0 : -v.x * 12;
        w.s.style.opacity = v.o.toFixed(3);
        w.s.style.filter = blurOf(v);
        w.s.style.transform = `translateY(${px(dy)})${sc !== 1 ? ` scale(${sc.toFixed(4)})` : ''}`;
        if (ENTER === 'rise') w.inner.style.transform = `translateY(${((1 - v.e) * 1.4).toFixed(4)}em)`;
        else if (ENTER === 'wipe') w.s.style.clipPath = revealClip(v.e, false, 60);
        else if (ENTER === 'type') {
          // 45 ms per character, but a long piece (a footnote) types within 0.6 s
          const n = Math.floor((t - t0) / Math.min(0.045, 0.6 / w.chars.length)) + 1;
          w.chars.forEach((c, k) => { const vv = k < n ? '' : 'hidden'; if (c.style.visibility !== vv) c.style.visibility = vv; });
        }
      }
      show(o.e, any);
    }

    for (const m of MASKS) {
      const v = hudVis(t, m.tin, m.tout, m.dOut); show(m.e, v.o > 0.003); if (v.o <= 0.003) continue;
      const sc = ENTER === 'pop' ? 0.5 + 0.5 * stepR(t - m.tin, POP) : 1;
      m.e.style.opacity = v.o.toFixed(3);
      m.e.style.transform = `translateX(-50%)${sc !== 1 ? ` scale(${sc.toFixed(4)})` : ''}`;
      m.in.style.filter = blurOf(v);
      if (ENTER === 'rise') m.in.style.transform = `translateY(${((1 - v.e) * 1.4).toFixed(4)}em)`;
      else if (ENTER === 'blur') m.in.style.transform = `translateY(${px((1 - v.e) * 20 - v.x * 12)})`;
      else if (ENTER === 'wipe') m.e.style.clipPath = revealClip(v.e, false, 60);
      else if (ENTER === 'type') {
        const n = Math.floor((t - m.tin) / Math.min(0.06, 0.6 / m.chars.length)) + 1;
        m.chars.forEach((ch, k) => { const vv = k < n ? '' : 'hidden'; if (ch.style.visibility !== vv) ch.style.visibility = vv; });
      }
      // the picture covers the letters' box, with its own slow zoom
      let iw = 0, ih = 0;
      if (m.man) {
        const u = frameURL(m, t);
        if (m._u !== u) { m._u = u; m.img.src = u; pending.push(m.img.decode()); m.in.style.backgroundImage = `url("${u}")`; }
        iw = m.man.width; ih = m.man.height;
      } else if (m.src) { iw = m.img.naturalWidth; ih = m.img.naturalHeight; }
      if (iw) {
        const r = coverRect({ x: 0, y: 0, w: m.bw, h: m.bh }, iw, ih, m.fx, m.fy, m.zoomF(t));
        m.in.style.backgroundSize = `${px(r.w)} ${px(r.h)}`; m.in.style.backgroundPosition = `${px(r.x)} ${px(r.y)}`;
      }
    }

    // marquee: the band reveals from the side its text comes from; the text runs at a constant speed
    for (const m of MARQS) {
      const v = hudVis(t, m.tin, m.tout, 0.16); show(m.e, v.o > 0.003); if (v.o <= 0.003) continue;
      const off = (m.speed * Math.max(0, t - m.tin)) % m.seg;
      m.e.style.opacity = v.o.toFixed(3);
      m.e.style.transform = m.rot ? `rotate(${m.rot}deg)` : '';
      m.e.style.clipPath = ENTER === 'cut' ? '' : revealClip(stepR(t - m.tin, { w: 12, z: 1 }), m.dir === 'left', 0);
      m.track.style.transform = `translateX(${px(m.dir === 'left' ? -off : off - m.seg)})`;
    }

    for (const ch of CHIPS) {
      const v = hudVis(t, ch.tin, ch.tout, 0.14, 20); show(ch.e, v.o > 0.003); if (v.o <= 0.003) continue;
      const dir = ch.side === 'left' ? -1 : 1;
      ch.e.style.opacity = v.o.toFixed(3);
      ch.e.style.filter = blurOf(v);
      // blur: slides in from the shape side, never past the safe edge
      if (ENTER === 'blur') ch.e.style.transform = `translateX(${px(-dir * (1 - stepR(t - ch.tin, { w: 18, z: 0.8 })) * 90)})`;
      else if (ENTER === 'pop') ch.e.style.transform = `scale(${(0.6 + 0.4 * stepR(t - ch.tin, POP)).toFixed(4)})`;
      else if (ENTER === 'rise') ch.e.style.transform = `translateY(${px((1 - v.e) * 36)})`;
      else if (ENTER === 'wipe' || ENTER === 'type') ch.e.style.clipPath = revealClip(v.e, ch.side !== 'left', 80);
    }

    for (const l of LABELS) {
      const v = hudVis(t, l.tin, l.tout, 0.14); show(l.e, v.o > 0.003); if (v.o <= 0.003) continue;
      const a = toScreen(Sh.x, Sh.y + Sh.h, c), b = toScreen(Sh.x + Sh.w, Sh.y + Sh.h, c);
      l.e.style.top = px(a.y - 86);
      // pinned to the shape's bottom corners, clamped inside the safe zone
      if (l.side === 'left') { l.e.style.left = px(Math.max(SAFE.l + 16, a.x + 28)); l.e.style.right = ''; }
      else { l.e.style.right = px(Math.max(W - SAFE.r + 20, W - b.x + 28)); l.e.style.left = ''; }
      l.e.style.opacity = v.o.toFixed(3); l.e.style.filter = blurOf(v);
    }

    // callouts: the dot lands, the line draws out to the label, then the label enters
    for (const k of CALLS) {
      const v = hudVis(t, k.tin, k.tout, 0.16), on = v.o > 0.003;
      show(k.line, on); show(k.dot, on);
      const lv = hudVis(t, k.tin + (ENTER === 'cut' ? 0 : 0.3), k.tout, 0.16);
      show(k.e, lv.o > 0.003);
      if (!on) continue;
      const fade = (1 - v.x).toFixed(3);
      k.dot.setAttribute('r', (12 * (ENTER === 'cut' ? 1 : stepR(t - k.tin, POP))).toFixed(2)); k.dot.style.opacity = fade;
      k.line.setAttribute('stroke-dashoffset', (ENTER === 'cut' ? 0 : 1 - smooth((t - k.tin - 0.06) / 0.3)).toFixed(4)); k.line.style.opacity = fade;
      if (lv.o <= 0.003) continue;
      const dir = k.side === 'right' ? -1 : 1;
      k.e.style.opacity = lv.o.toFixed(3); k.e.style.filter = blurOf(lv);
      if (ENTER === 'blur') k.e.style.transform = `translateX(${px(dir * (1 - lv.e) * 40)})`;
      else if (ENTER === 'pop') k.e.style.transform = `scale(${(0.6 + 0.4 * stepR(t - k.tin - 0.3, POP)).toFixed(4)})`;
      else if (ENTER === 'rise') k.e.style.transform = `translateY(${px((1 - lv.e) * 30)})`;
      else if (ENTER === 'wipe' || ENTER === 'type') k.e.style.clipPath = revealClip(lv.e, k.side === 'left', 80);
    }

    // check lists: each row lands on its word or beat, then its marks draw
    for (const k of CHECKS) {
      if (k.he) { const v = hudVis(t, k.tin, k.tout, 0.14); show(k.he, v.o > 0.003); k.he.style.opacity = v.o.toFixed(3); k.he.style.filter = blurOf(v); }
      for (const r of k.rows) {
        const v = hudVis(t, r.at, k.tout, 0.14, 20); show(r.e, v.o > 0.003); if (v.o <= 0.003) continue;
        r.e.style.opacity = v.o.toFixed(3); r.e.style.filter = blurOf(v);
        // rows can span the safe width: no overshoot past their box (critically damped slide, pop capped at 1)
        if (ENTER === 'blur') r.e.style.transform = `translateX(${px(-(1 - stepR(t - r.at, { w: 18, z: 1 })) * 60)})`;
        else if (ENTER === 'pop') r.e.style.transform = `scale(${Math.min(1, 0.6 + 0.4 * stepR(t - r.at, POP)).toFixed(4)})`;
        else if (ENTER === 'rise') r.e.style.transform = `translateY(${px((1 - v.e) * 30)})`;
        else if (ENTER === 'wipe' || ENTER === 'type') r.e.style.clipPath = revealClip(v.e, false, 40);
        const p = ENTER === 'cut' ? (t >= r.at + 0.12 ? 1 : 0) : smooth((t - r.at - 0.12) / 0.25);
        for (const path of r.paths) path.setAttribute('stroke-dashoffset', (1 - p).toFixed(4));
      }
    }

    for (const o of ODOS) {
      const v = hudVis(t, o.t0 - 0.08, o.tout, 0.14); show(o.e, v.o > 0.003); if (v.o <= 0.003) continue;
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
        cta.style.width = px(wdt); cta.style.height = px(CTA.h); cta.style.borderRadius = px(CTA.h / 2 * UI_ROUND);
        cta.style.opacity = cv.o.toFixed(3);
        cta.style.transform = `scale(${(pp * (0.6 + 0.4 * stepR(t - CTA.tin, { w: 20, z: 0.78 }))).toFixed(4)})`;
        const pr = stepR(t - CTA.press, { w: 14, z: 1 });
        cta.style.background = `rgb(${[0, 1, 2].map(i => Math.round(lerp(ACC[i], ACC2[i], pr))).join(', ')})`;
        const tv = hudVis(t, CTA.textIn, null);
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
  // self-hosted faces (look and project files) first, then preload every face the theme names
  const faces = theme.faces.map(f => new FontFace(f.family, `url("${f.url}")`,
    { style: f.style || 'normal', weight: String(f.weight || 400) }));
  for (const f of faces) document.fonts.add(f);
  await Promise.all(faces.map(f => f.load()));
  await Promise.all([...theme.fonts.map(f => document.fonts.load(f)), ...Object.values(imgCache).map(i => i.decode())]);
  fitCaptions();
  fitLayouts();
  await seek(0);
  window.READY = true;
}

main().catch(e => { window.ERROR = String(e && e.message || e); console.error('engine:', e); });
