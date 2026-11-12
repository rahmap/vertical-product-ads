#!/usr/bin/env node
// server.mjs — the studio: a local, single-user web app over the SQLite store.
//   node studio/server.mjs [--port 4173]      then open http://127.0.0.1:4173   (port and data folder: .env, see .env.example)
// Listens on 127.0.0.1 only. No accounts: do not expose it to a network.
const warn = process.emitWarning;
process.emitWarning = (w, ...a) => (String(w?.message ?? w).includes('SQLite') ? undefined : warn.call(process, w, ...a));

const http = await import('node:http');
const fs = await import('node:fs');
const { pipeline } = await import('node:stream/promises');
const { basename, extname, join, resolve, sep } = await import('node:path');
const D = await import('./db.mjs');
const { writeProject } = await import('./brief.mjs');
const { importProduct, downloadImage } = await import('./import.mjs');
const V = await import('./validate.mjs');
const { db } = D;

const PORT = Number(process.argv[process.argv.indexOf('--port') + 1]) || Number(D.setting('STUDIO_PORT')) || 4173;
const PUBLIC = join(D.ROOT, 'studio', 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm',
  '.m4v': 'video/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.md': 'text/plain; charset=utf-8' };
const IMAGE = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.svg'];
const VIDEO = ['.mp4', '.mov', '.m4v', '.webm'];
const MAX_UPLOAD = 2 * 1024 ** 3;

class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const json = (res, body, status = 200) => { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
async function body(req) {
  const chunks = []; let n = 0;
  for await (const c of req) { n += c.length; if (n > 2e6) throw new HttpError(413, 'Data terlalu besar.'); chunks.push(c); }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new HttpError(400, 'JSON tidak valid.'); }
}
const inside = (root, p) => { const a = resolve(p); return a === root || a.startsWith(root + sep); };
const need = (row, what) => { if (!row) throw new HttpError(404, `${what} tidak ditemukan.`); return row; };

function safeName(name) {
  const ext = extname(name).toLowerCase();
  const stem = D.slugify(basename(name, extname(name))) || 'file';
  return { ext, file: stem + ext };
}
function freeName(dir, file) {
  const ext = extname(file), stem = basename(file, ext);
  let f = file, n = 2;
  while (fs.existsSync(join(dir, f))) f = `${stem}-${n++}${ext}`;
  return f;
}

// ---- file serving with Range (video playback needs it)
function sendFile(req, res, path, { download } = {}) {
  let st; try { st = fs.statSync(path); } catch { st = null; }
  if (!st?.isFile()) throw new HttpError(404, 'File tidak ditemukan.');
  const head = { 'content-type': MIME[extname(path).toLowerCase()] || 'application/octet-stream', 'accept-ranges': 'bytes', 'cache-control': 'no-store' };
  if (download) head['content-disposition'] = `attachment; filename="${basename(path)}"`;
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (m && (m[1] || m[2])) {
    let start = m[1] ? +m[1] : st.size - +m[2], end = m[1] && m[2] ? +m[2] : st.size - 1;
    start = Math.max(0, start); end = Math.min(end, st.size - 1);
    if (start > end) { res.writeHead(416, { 'content-range': `bytes */${st.size}` }); return res.end(); }
    res.writeHead(206, { ...head, 'content-range': `bytes ${start}-${end}/${st.size}`, 'content-length': end - start + 1 });
    return req.method === 'HEAD' ? res.end() : fs.createReadStream(path, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...head, 'content-length': st.size });
  return req.method === 'HEAD' ? res.end() : fs.createReadStream(path).pipe(res);
}

// ---- views
const fileIf = (dir, rel) => (fs.existsSync(join(dir, rel)) ? rel : null);
function videoView(v) {
  const dir = D.projectDir(v);
  const media = (rel) => (rel ? `/media/projects/${v.slug}/${rel}?v=${Math.round(fs.statSync(join(dir, rel)).mtimeMs)}` : null);
  const read = (rel) => { try { return fs.readFileSync(join(dir, rel), 'utf8'); } catch { return null; } };
  const fin = v.final_path && fs.existsSync(join(D.DATA, v.final_path)) ? v.final_path : null;
  const sb = v.storyboard_path && fs.existsSync(join(D.DATA, v.storyboard_path)) ? v.storyboard_path : null;
  return { ...v,
    project: dir,
    draft_url: media(fileIf(dir, 'renders/draft.mp4')), sheet_url: media(fileIf(dir, 'snaps/sheet.png')),
    final_url: fin ? `/media/${fin}?v=${Math.round(fs.statSync(join(D.DATA, fin)).mtimeMs)}` : null,
    storyboard_url: sb ? `/media/${sb}` : null,
    concept: read('concept.md'), brief: read('brief.md'), events: D.videoEvents(v.id) };
}
const productView = (p) => ({ ...p,
  assets: D.productAssets(p.id).map((a) => ({ ...a, url: `/media/products/${p.slug}/assets/${encodeURIComponent(a.file)}` })),
  videos: db.prepare('SELECT id, slug, title, status, duration, look, updated_at FROM videos WHERE product_id = ? ORDER BY id DESC').all(p.id) });

function addAsset(p, file, origin, bytes, shows = null) {
  const ext = extname(file).toLowerCase();
  return D.insert('assets', { product_id: p.id, file, kind: VIDEO.includes(ext) ? 'video' : 'image', origin: origin === 'listing' ? 'listing' : 'own', shows, bytes });
}

// ---- API
const routes = [];
const on = (method, pattern, fn) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:id/g, '(\\d+)') + '$'), fn });

on('GET', '/api/meta', () => ({ statuses: D.STATUSES, looks: D.LOOKS, data: D.DATA }));

on('GET', '/api/products', () => db.prepare(`SELECT p.*, (SELECT COUNT(*) FROM assets a WHERE a.product_id = p.id) AS asset_count,
  (SELECT COUNT(*) FROM videos v WHERE v.product_id = p.id) AS video_count,
  (SELECT file FROM assets a WHERE a.product_id = p.id AND a.kind = 'image' ORDER BY a.id LIMIT 1) AS thumb
  FROM products p ORDER BY p.updated_at DESC`).all().map((p) => ({ ...p, thumb: p.thumb ? `/media/products/${p.slug}/assets/${encodeURIComponent(p.thumb)}` : null })));
on('POST', '/api/products', async (req) => {
  const data = V.product(await body(req));
  const id = D.insert('products', { slug: D.uniqueSlug('products', D.slugify(data.name)), ...data });
  fs.mkdirSync(join(D.productDir(D.product(id)), 'assets'), { recursive: true });
  return productView(D.product(id));
});
on('GET', '/api/products/:id', (req, id) => productView(need(D.product(id), 'Produk')));
on('PUT', '/api/products/:id', async (req, id) => {
  const current = need(D.product(id), 'Produk');
  D.update('products', id, V.product(await body(req), { partial: true, current }), D.PRODUCT_FIELDS);
  return productView(D.product(id));
});
on('DELETE', '/api/products/:id', (req, id) => {
  const p = need(D.product(id), 'Produk');
  const vids = db.prepare('SELECT * FROM videos WHERE product_id = ?').all(id);
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  fs.rmSync(D.productDir(p), { recursive: true, force: true });
  for (const v of vids) removeVideoFiles(v);
  return { ok: true };
});

on('POST', '/api/import', async (req) => {
  const url = V.link(await body(req));
  try { return await importProduct(url); } catch (e) { throw new HttpError(400, e.message); }
});
on('POST', '/api/products/:id/import-images', async (req, id) => {
  const p = need(D.product(id), 'Produk');
  const urls = V.urls(await body(req));
  const dir = join(D.productDir(p), 'assets'); fs.mkdirSync(dir, { recursive: true });
  const saved = [], failed = [];
  for (const [i, u] of urls.entries()) {
    try {
      const { buf, ext } = await downloadImage(u);
      const file = freeName(dir, `listing-${i + 1}.${ext}`);
      fs.writeFileSync(join(dir, file), buf);
      addAsset(p, file, 'listing', buf.length, 'foto dari listing');
      saved.push(file);
    } catch (e) { failed.push(`${u}: ${e.message}`); }
  }
  return { saved, failed, product: productView(D.product(id)) };
});

// upload: PUT with the raw file as the body (no multipart)
on('PUT', '/api/products/:id/assets', async (req, id, url) => {
  const p = need(D.product(id), 'Produk');
  const { ext, file: wanted } = safeName(url.searchParams.get('name') || 'file');
  if (![...IMAGE, ...VIDEO].includes(ext)) throw new HttpError(400, `Tipe file ${ext || '(tanpa ekstensi)'} tidak didukung. Pakai: ${[...IMAGE, ...VIDEO].join(' ')}`);
  if (+req.headers['content-length'] > MAX_UPLOAD) throw new HttpError(413, 'File lebih dari 2 GB.');
  const dir = join(D.productDir(p), 'assets'); fs.mkdirSync(dir, { recursive: true });
  const file = freeName(dir, wanted), tmp = join(dir, `.${file}.part`);
  let bytes = 0;
  try {
    await pipeline(req, async function* (src) { for await (const c of src) { bytes += c.length; if (bytes > MAX_UPLOAD) throw new HttpError(413, 'File lebih dari 2 GB.'); yield c; } }, fs.createWriteStream(tmp));
    fs.renameSync(tmp, join(dir, file));
  } catch (e) { fs.rmSync(tmp, { force: true }); throw e; }
  if (!bytes) { fs.rmSync(join(dir, file), { force: true }); throw new HttpError(400, 'File kosong.'); }
  addAsset(p, file, url.searchParams.get('origin'), bytes);
  return productView(D.product(id));
});
on('PATCH', '/api/assets/:id', async (req, id) => {
  const a = need(db.prepare('SELECT * FROM assets WHERE id = ?').get(id), 'Aset');
  const data = V.asset(await body(req));
  for (const [k, val] of Object.entries(data)) db.prepare(`UPDATE assets SET ${k} = ? WHERE id = ?`).run(val, id);
  return productView(D.product(a.product_id));
});
on('DELETE', '/api/assets/:id', (req, id) => {
  const a = need(db.prepare('SELECT * FROM assets WHERE id = ?').get(id), 'Aset');
  const p = D.product(a.product_id);
  db.prepare('DELETE FROM assets WHERE id = ?').run(id);
  fs.rmSync(join(D.productDir(p), 'assets', a.file), { force: true });
  return productView(p);
});

on('GET', '/api/videos', () => db.prepare(`SELECT v.id, v.slug, v.title, v.status, v.duration, v.look, v.updated_at, v.posted_url, v.views, v.orders,
  p.name AS product_name, p.id AS product_id FROM videos v JOIN products p ON p.id = v.product_id ORDER BY v.updated_at DESC`).all());
on('POST', '/api/products/:id/videos', async (req, id) => {
  const p = need(D.product(id), 'Produk');
  const b = await body(req), data = V.newVideo(b);
  if (!D.productAssets(id).length) throw new HttpError(400, 'Upload minimal satu foto atau video produk dulu.');
  const n = db.prepare('SELECT COUNT(*) AS n FROM videos WHERE product_id = ?').get(id).n + 1;
  const vid = D.insert('videos', { product_id: id, slug: D.uniqueSlug('videos', `${p.slug}-v${n}`), ...data,
    title: data.title || `${p.name} #${n}`, look: data.look || 'ugc-native', status: 'draft' });
  if (b.queue !== false) queue(vid, 'dibuat dari studio');
  return videoView(D.video(vid));
});
on('GET', '/api/videos/:id', (req, id) => videoView(need(D.video(id), 'Video')));
on('PATCH', '/api/videos/:id', async (req, id) => {
  need(D.video(id), 'Video');
  D.update('videos', id, V.videoPatch(await body(req)), D.VIDEO_FIELDS);
  return videoView(D.video(id));
});
on('DELETE', '/api/videos/:id', (req, id) => {
  const v = need(D.video(id), 'Video');
  db.prepare('DELETE FROM videos WHERE id = ?').run(id);
  removeVideoFiles(v);
  return { ok: true };
});

function queue(id, why) { writeProject(D.video(id)); D.setStatus(id, 'antre', why); }
function removeVideoFiles(v) {
  fs.rmSync(D.projectDir(v), { recursive: true, force: true });
  for (const rel of [v.final_path, v.storyboard_path]) if (rel && inside(D.DIRS.videos, join(D.DATA, rel))) fs.rmSync(join(D.DATA, rel), { force: true });
}
const action = (name, from, fn) => on('POST', `/api/videos/:id/${name}`, async (req, id) => {
  const v = need(D.video(id), 'Video');
  if (from && !from.includes(v.status)) throw new HttpError(409, `Tidak bisa "${name}" saat status "${v.status}".`);
  await fn(v, await body(req));
  return videoView(D.video(id));
});
action('queue', ['draft', 'final', 'diposting', 'preview', 'revisi'], (v) => queue(v.id, 'diantrekan ulang'));
action('approve', ['preview'], (v) => D.setStatus(v.id, 'disetujui', 'preview disetujui, menunggu render final'));
action('revise', ['preview', 'final', 'disetujui'], (v, b) => {
  const { note } = V.revision(b);
  D.update('videos', v.id, { revision_note: note }, D.VIDEO_FIELDS);
  writeProject(D.video(v.id));
  D.setStatus(v.id, 'revisi', note);
});
action('posted', ['final', 'diposting'], (v, b) => {
  const d = V.posted(b);
  D.update('videos', v.id, { posted_url: d.posted_url || v.posted_url, posted_at: d.posted_at || v.posted_at || new Date().toISOString().slice(0, 10) }, D.VIDEO_FIELDS);
  if (v.status !== 'diposting') D.setStatus(v.id, 'diposting', d.posted_url || '');
});

// ---- server
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const path = decodeURIComponent(url.pathname);
    // local-only guard: refuse other hosts (DNS rebinding) and cross-site writes
    const host = (req.headers.host || '').replace(/:\d+$/, '');
    if (!['127.0.0.1', 'localhost'].includes(host)) throw new HttpError(403, 'Host tidak diizinkan.');
    if (!['GET', 'HEAD'].includes(req.method)) {
      const origin = req.headers.origin;
      if (origin && new URL(origin).host !== req.headers.host) throw new HttpError(403, 'Permintaan lintas situs ditolak.');
      if (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(req.headers['sec-fetch-site'])) throw new HttpError(403, 'Permintaan lintas situs ditolak.');
    }
    if (path.startsWith('/api/')) {
      for (const r of routes) {
        const m = r.method === req.method && r.re.exec(path);
        if (m) return json(res, await r.fn(req, ...m.slice(1).map(Number), url));
      }
      throw new HttpError(404, 'Endpoint tidak ada.');
    }
    if (!['GET', 'HEAD'].includes(req.method)) throw new HttpError(405, 'Metode tidak didukung.');
    if (path.startsWith('/media/')) {
      const file = resolve(D.DATA, path.slice('/media/'.length));
      const ok = [D.DIRS.products, D.DIRS.projects, D.DIRS.videos].some((d) => inside(d, file)) && !basename(file).startsWith('.');
      if (!ok) throw new HttpError(403, 'Tidak diizinkan.');
      return sendFile(req, res, file, { download: url.searchParams.has('download') });
    }
    const file = resolve(PUBLIC, '.' + (path === '/' ? '/index.html' : path));
    if (!inside(PUBLIC, file)) throw new HttpError(403, 'Tidak diizinkan.');
    return sendFile(req, res, fs.existsSync(file) ? file : join(PUBLIC, 'index.html'));
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error(e);
    if (res.headersSent) return res.destroy();
    json(res, { error: e.status ? e.message : `Kesalahan server: ${e.message}`, ...(e.fields ? { fields: e.fields } : {}) }, status);
  }
});
server.on('error', (e) => { console.error(e.code === 'EADDRINUSE' ? `Port ${PORT} sedang dipakai. Coba: node studio/server.mjs --port ${PORT + 1}` : e); process.exit(1); });
server.listen(PORT, '127.0.0.1', () => console.log(`Studio: http://127.0.0.1:${PORT}   (data: ${D.DATA})`));
