// db.mjs — the studio's SQLite store (node:sqlite, built into Node ≥ 22.5) and its paths.
//   settings: STUDIO_DATA, STUDIO_PORT from the environment or <repo>/.env (see .env.example)
//   data/studio.db            products, assets, videos, events
//   data/products/<slug>/assets/   uploaded and imported files (the originals)
//   data/projects/<slug>/     one ad project per video (brief.md, assets/, concept.md, scenes.json, renders/…)
//   data/videos/<slug>.mp4    final renders (+ _storyboard.png)
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Settings come from the environment, then from <repo>/.env. Only STUDIO_* lines are taken from the file:
// the API keys in it are for the render tools, and the web server has no use for them.
export function studioEnv(file = join(ROOT, '.env')) {
  const out = {};
  let text = '';
  try { text = readFileSync(file, 'utf8'); } catch { return out; }
  for (const raw of text.split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?(STUDIO_[A-Z_]+)\s*=\s*(.*)$/.exec(raw);
    if (!m) continue;
    const v = m[2].trim().replace(/^(['"])(.*)\1$/, '$2');
    if (v) out[m[1]] = v;
  }
  return out;
}
const FILE_ENV = studioEnv();
export const setting = (name) => process.env[name] || FILE_ENV[name] || '';
export const DATA = resolve(ROOT, setting('STUDIO_DATA') || 'data');
export const DIRS = { products: join(DATA, 'products'), projects: join(DATA, 'projects'), videos: join(DATA, 'videos') };
for (const d of Object.values(DIRS)) mkdirSync(d, { recursive: true });

// order matters: it is the board's column order
export const STATUSES = ['draft', 'antre', 'konsep', 'preview', 'revisi', 'disetujui', 'final', 'diposting'];
export const LOOKS = ['ugc-native', 'classic', 'luxe-editorial', 'clean-clinical', 'bold-streetwear', 'warm-organic', 'tech-neon', 'pop-playful'];

export const db = new DatabaseSync(join(DATA, 'studio.db'));
db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY, slug TEXT UNIQUE NOT NULL,
  url TEXT, name TEXT NOT NULL, variants TEXT, what TEXT, shop TEXT,
  price TEXT, was_price TEXT, promo TEXT, promo_end TEXT, commission TEXT,
  description TEXT, selling_points TEXT, claims TEXT NOT NULL DEFAULT '[]',
  audience TEXT, problem TEXT, used_it TEXT, honest_note TEXT, notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS assets (
  id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  file TEXT NOT NULL, kind TEXT NOT NULL, origin TEXT NOT NULL DEFAULT 'own', shows TEXT, bytes INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(product_id, file)
);
CREATE TABLE IF NOT EXISTS videos (
  id INTEGER PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL, title TEXT, status TEXT NOT NULL DEFAULT 'draft',
  duration INTEGER NOT NULL DEFAULT 45, look TEXT NOT NULL DEFAULT 'ugc-native', style TEXT,
  concept_review INTEGER NOT NULL DEFAULT 0, angle TEXT, voice TEXT, notes TEXT,
  revision_note TEXT, final_path TEXT, storyboard_path TEXT,
  caption TEXT, hashtags TEXT, pinned_comment TEXT,
  posted_url TEXT, posted_at TEXT, views INTEGER, orders INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY, video_id INTEGER NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  at TEXT NOT NULL DEFAULT (datetime('now')), kind TEXT NOT NULL, message TEXT
);
CREATE INDEX IF NOT EXISTS videos_status ON videos(status);
`);

export const PRODUCT_FIELDS = ['url', 'name', 'variants', 'what', 'shop', 'price', 'was_price', 'promo', 'promo_end', 'commission',
  'description', 'selling_points', 'claims', 'audience', 'problem', 'used_it', 'honest_note', 'notes'];
export const VIDEO_FIELDS = ['title', 'duration', 'look', 'style', 'concept_review', 'angle', 'voice', 'notes', 'revision_note',
  'caption', 'hashtags', 'pinned_comment', 'posted_url', 'posted_at', 'views', 'orders'];

export function slugify(s) {
  return String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'item';
}
export function uniqueSlug(table, base) {
  const has = db.prepare(`SELECT 1 FROM ${table} WHERE slug = ?`);
  let slug = base, n = 2;
  while (has.get(slug)) slug = `${base}-${n++}`;
  return slug;
}

const clean = (v) => (v == null || v === '' ? null : typeof v === 'object' ? JSON.stringify(v) : v);
export function insert(table, row) {
  const keys = Object.keys(row);
  const r = db.prepare(`INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...keys.map((k) => clean(row[k])));
  return Number(r.lastInsertRowid);
}
export function update(table, id, row, allowed) {
  const keys = Object.keys(row).filter((k) => allowed.includes(k));
  if (!keys.length) return;
  db.prepare(`UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`)
    .run(...keys.map((k) => clean(row[k])), id);
}

export const product = (id) => {
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (p) { try { p.claims = JSON.parse(p.claims || '[]'); } catch { p.claims = []; } }
  return p;
};
export const productAssets = (id) => db.prepare('SELECT * FROM assets WHERE product_id = ? ORDER BY origin DESC, id').all(id);
export const video = (id) => db.prepare('SELECT v.*, p.name AS product_name, p.slug AS product_slug FROM videos v JOIN products p ON p.id = v.product_id WHERE v.id = ?').get(id);
export const videoEvents = (id) => db.prepare('SELECT * FROM events WHERE video_id = ? ORDER BY id DESC LIMIT 100').all(id);
export const projectDir = (v) => join(DIRS.projects, v.slug);
export const productDir = (p) => join(DIRS.products, p.slug);

export function log(videoId, kind, message = '') {
  db.prepare('INSERT INTO events (video_id, kind, message) VALUES (?, ?, ?)').run(videoId, kind, message);
}
export function setStatus(videoId, status, message = '') {
  if (!STATUSES.includes(status)) throw new Error(`unknown status "${status}" (one of: ${STATUSES.join(', ')})`);
  db.prepare("UPDATE videos SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, videoId);
  log(videoId, 'status', message ? `${status}: ${message}` : status);
}
