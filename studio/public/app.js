// app.js — the studio's single page. No framework: hash routes, DOM built with h(), Tailwind classes (public/app.css,
// built from styles/input.css with `npm run css`; class names must stay whole strings so Tailwind finds them).
const app = document.getElementById('app');
let META = { statuses: [], looks: [] };
let poll = null;
let dirty = false;   // an edited, unsaved product form

// ---------- vocabulary
const TONE = {
  stone: 'bg-stone-500/15 text-stone-600 dark:text-stone-300',
  amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  violet: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  sky: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  emerald: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
};
const STATUS = {
  draft: { label: 'Draft', tone: 'stone', step: -1, next: 'Belum diantrekan. Antrekan supaya bisa dikerjakan.' },
  antre: { label: 'Antre', tone: 'amber', step: 0, claude: true, next: 'Menunggu dikerjakan. Jalankan perintah ini di Claude Code (di folder repo):' },
  konsep: { label: 'Dikerjakan', tone: 'violet', step: 1, next: 'Claude Code sedang menulis konsep, naskah dan adegan, lalu merender draft. Halaman ini memperbarui sendiri.' },
  preview: { label: 'Perlu review', tone: 'sky', step: 2, next: 'Draft siap. Tonton sampai habis, lalu setujui atau minta revisi.' },
  revisi: { label: 'Revisi', tone: 'amber', step: 0, claude: true, next: 'Revisimu masuk antrean. Jalankan perintah ini di Claude Code:' },
  disetujui: { label: 'Disetujui', tone: 'amber', step: 3, claude: true, next: 'Preview disetujui. Jalankan perintah ini di Claude Code untuk render final:' },
  final: { label: 'Final', tone: 'emerald', step: 4, next: 'Video final siap. Unduh, posting, lalu catat link-nya di sini.' },
  diposting: { label: 'Diposting', tone: 'emerald', step: 5, next: 'Sudah diposting. Perbarui angka views dan pesanan kapan saja.' },
};
const STEPS = ['Antre', 'Dikerjakan', 'Review', 'Final', 'Diposting'];
const COLUMNS = [
  { title: 'Menunggu Claude', statuses: ['draft', 'antre', 'revisi', 'disetujui'], empty: 'Tidak ada antrean' },
  { title: 'Dikerjakan', statuses: ['konsep'], empty: 'Tidak ada yang berjalan' },
  { title: 'Perlu review', statuses: ['preview'], empty: 'Tidak ada draft' },
  { title: 'Siap posting', statuses: ['final'], empty: 'Belum ada' },
  { title: 'Diposting', statuses: ['diposting'], empty: 'Belum ada' },
];
const LOOK_NOTE = {
  'ugc-native': 'Seperti dibuat di aplikasi: teks putih, caption kuning. Paling natural untuk affiliate.',
  classic: 'Krem hangat, huruf serif. Tenang dan rapi.',
  'luxe-editorial': 'Gading dan perunggu. Untuk produk premium.',
  'clean-clinical': 'Putih bersih, aksen teal. Skincare, kesehatan.',
  'bold-streetwear': 'Hitam, huruf besar, aksen lime. Fashion, sneakers.',
  'warm-organic': 'Kertas krem, terakota. Makanan, produk alami.',
  'tech-neon': 'Gelap dengan cyan menyala. Gadget, aksesori.',
  'pop-playful': 'Peach dan pink, stiker memantul. Produk lucu, anak muda.',
};
const DURATION_NOTE = {
  30: 'Satu kegunaan, satu manfaat. Sekitar 50 kata, minimal 10 shot.',
  45: 'Dua hal untuk ditunjukkan. Sekitar 78 kata, minimal 15 shot.',
  60: 'Cerita lengkap. Sekitar 105 kata, minimal 20 shot dari 8+ klip berbeda.',
};
const REVISION_CHIPS = ['Hook kurang kuat', 'Suara terlalu cepat', 'Suara kurang natural', 'Ganti shot pertama', 'Teks di layar terlalu banyak',
  'Musik terlalu keras', 'Terlalu panjang', 'Harga kurang jelas'];
const CMD = '/affiliate-queue';

// ---------- helpers
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'value') el.value = v;
    else if (['checked', 'disabled', 'selected', 'controls', 'muted', 'open', 'required'].includes(k)) el[k] = !!v;
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}
const fill = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false));
const ICONS = {
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  upload: '<path d="M12 16V4m0 0-4 4m4-4 4 4"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
  download: '<path d="M12 4v12m0 0-4-4m4 4 4-4"/><path d="M4 18v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1"/>',
  alert: '<path d="M12 9v4m0 4h.01"/><path d="M10.3 3.9 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>',
  play: '<path d="M7 5v14l12-7L7 5Z"/>',
  arrow: '<path d="M5 12h14m0 0-5-5m5 5-5 5"/>',
  back: '<path d="M19 12H5m0 0 5-5m-5 5 5 5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  spark: '<path d="M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
  film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4m10 0h4M3 15h4m10 0h4"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m4 18 5.5-5 4 3.5 2.5-2 4 3.5"/>',
};
function icon(name, cls = 'size-4') {
  const t = document.createElement('template');
  t.innerHTML = `<svg viewBox="0 0 24 24" class="${cls} shrink-0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
  return t.content.firstChild;
}
async function api(method, path, data) {
  const res = await fetch(path, { method, headers: data ? { 'content-type': 'application/json' } : {}, body: data ? JSON.stringify(data) : undefined });
  const out = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok) throw new Error(out.error || `HTTP ${res.status}`);
  return out;
}
// upload with progress (fetch cannot report it)
function upload(url, file, onProgress) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('PUT', url);
    x.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    x.onload = () => { let o = {}; try { o = JSON.parse(x.responseText); } catch { /* not JSON */ } x.status < 300 ? resolve(o) : reject(new Error(o.error || `HTTP ${x.status}`)); };
    x.onerror = () => reject(new Error('Koneksi ke server terputus.'));
    x.send(file);
  });
}
function toast(msg, bad) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = t.className.replace(/\b(bg|text)-\S+/g, '').replace(/opacity-0|translate-y-2/g, '') + (bad ? ' bg-red-600 text-white' : ' bg-ink text-canvas');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.className += ' opacity-0 translate-y-2'; }, bad ? 6500 : 2600);
}
function confirmDialog({ title, text, yes = 'Hapus', danger = true }) {
  const d = document.getElementById('confirm'), btn = document.getElementById('confirm-yes');
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-text').textContent = text;
  btn.textContent = yes; btn.className = danger ? 'btn border-red-600 bg-red-600 text-white hover:bg-red-700' : 'btn btn-primary';
  d.returnValue = 'no'; d.showModal();
  return new Promise((r) => d.addEventListener('close', () => r(d.returnValue === 'yes'), { once: true }));
}
const guard = (fn) => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message, true); } };
async function copy(text, done = 'Disalin.') { await navigator.clipboard.writeText(text); toast(done); }
const copyCmd = () => h('button', { class: 'btn btn-sm font-mono', type: 'button', title: 'Salin perintah', onclick: guard(() => copy(CMD, `${CMD} disalin. Tempel di Claude Code.`)) }, CMD, icon('copy', 'size-3.5'));
const badge = (s) => h('span', { class: `badge ${TONE[STATUS[s]?.tone || 'stone']}` }, STATUS[s]?.label || s);
const date = (s) => new Date(String(s).replace(' ', 'T') + 'Z');
const when = (s) => (s ? date(s).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '');
function ago(s) {
  const m = Math.round((Date.now() - date(s)) / 60000);
  if (m < 1) return 'baru saja';
  if (m < 60) return `${m} mnt lalu`;
  if (m < 60 * 24) return `${Math.round(m / 60)} jam lalu`;
  return `${Math.round(m / 1440)} hari lalu`;
}
const num = (n) => (n == null ? '–' : Number(n).toLocaleString('id-ID'));
const field = (label, input, hint, cls = '') => h('label', { class: `field ${cls}` }, h('span', { class: 'field-label' }, label, hint ? h('span', { class: 'field-hint' }, hint) : null), input);
const pageHead = (title, sub, ...actions) => h('div', { class: 'mb-6 flex flex-wrap items-start justify-between gap-3' },
  h('div', { class: 'min-w-0' }, h('h1', { class: 'text-2xl font-bold tracking-tight' }, title), sub ? h('p', { class: 'mt-0.5 text-muted' }, sub) : null),
  actions.length ? h('div', { class: 'flex flex-wrap gap-2' }, actions) : null);
const crumb = (href, text) => h('a', { class: 'mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted no-underline hover:text-ink', href }, icon('back', 'size-3.5'), text);
const empty = (title, text, action) => h('div', { class: 'card flex flex-col items-center px-6 py-14 text-center' },
  h('div', { class: 'mb-3 grid size-12 place-items-center rounded-2xl bg-subtle text-muted' }, icon('film', 'size-6')),
  h('h2', { class: 'mb-1 text-base font-semibold' }, title), h('p', { class: 'mb-5 max-w-sm text-sm text-muted' }, text), action);

// sidebar: what waits on the user (badge) and on Claude Code (queue box)
function shell(videos) {
  const todo = videos.filter((v) => ['preview', 'final'].includes(v.status)).length;
  const waiting = videos.filter((v) => STATUS[v.status]?.claude).length;
  const b = document.getElementById('nav-todo');
  b.textContent = todo; b.classList.toggle('hidden', !todo);
  document.getElementById('queue-title').textContent = waiting ? `${waiting} video menunggu` : 'Antrean kosong';
  document.getElementById('queue-text').textContent = waiting ? 'Jalankan di Claude Code, di folder repo ini:' : 'Tidak ada yang menunggu dikerjakan.';
  document.getElementById('queue-copy').classList.toggle('hidden', !waiting);
}
document.getElementById('queue-copy').addEventListener('click', guard(() => copy(CMD, `${CMD} disalin. Tempel di Claude Code.`)));

// ---------- home
async function home() {
  const [videos, products] = await Promise.all([api('GET', '/api/videos'), api('GET', '/api/products')]);
  shell(videos);
  const by = (...s) => videos.filter((v) => s.includes(v.status));
  const waiting = videos.filter((v) => STATUS[v.status].claude);
  const todo = [
    ...by('preview').map((v) => ({ tone: 'sky', icon: 'play', title: `Tonton draft: ${v.title}`, text: 'Setujui untuk render final, atau minta revisi.', href: `#/video/${v.id}`, cta: 'Review' })),
    ...by('final').map((v) => ({ tone: 'emerald', icon: 'download', title: `Siap posting: ${v.title}`, text: 'Unduh MP4, salin caption, lalu catat link-nya.', href: `#/video/${v.id}`, cta: 'Buka' })),
  ];
  const stat = (label, value) => h('div', { class: 'card px-4 py-3' }, h('div', { class: 'text-xs font-medium text-muted' }, label), h('div', { class: 'text-xl font-bold tabular-nums' }, value));
  const sum = (k) => videos.reduce((a, v) => a + (v[k] || 0), 0);

  const onboarding = !products.length ? h('div', { class: 'card card-pad mb-6' },
    h('h2', { class: 'card-title mb-1' }, 'Mulai dari sini'),
    h('p', { class: 'mb-4 text-sm text-muted' }, 'Tiga langkah dari produk sampai video siap posting.'),
    h('ol', { class: 'grid gap-3 sm:grid-cols-3' }, [
      ['Tambah produk', 'Tempel link TikTok Shop atau isi form, lalu unggah foto dan klip rekamanmu.'],
      ['Antrekan video', 'Pilih durasi 30, 45 atau 60 detik. Lalu ketik /affiliate-queue di Claude Code.'],
      ['Review dan posting', 'Tonton draft di sini, setujui, unduh MP4 final beserta caption-nya.'],
    ].map(([t, d], i) => h('li', { class: 'rounded-xl bg-subtle p-4' }, h('div', { class: 'mb-2 grid size-7 place-items-center rounded-full bg-brand text-sm font-bold text-brand-ink' }, i + 1),
      h('div', { class: 'font-semibold' }, t), h('p', { class: 'text-sm text-muted' }, d)))),
    h('a', { class: 'btn btn-primary btn-lg mt-5', href: '#/produk/baru' }, icon('plus'), 'Tambah produk pertama')) : null;

  const actions = todo.length || waiting.length ? h('section', { class: 'mb-8' },
    h('h2', { class: 'mb-3 text-sm font-semibold tracking-wide text-muted uppercase' }, 'Perlu tindakanmu'),
    h('div', { class: 'grid gap-3 md:grid-cols-2' },
      todo.map((t) => h('a', { class: 'card flex items-center gap-3 p-4 no-underline transition hover:border-brand', href: t.href },
        h('span', { class: `grid size-10 shrink-0 place-items-center rounded-xl ${TONE[t.tone]}` }, icon(t.icon, 'size-5')),
        h('span', { class: 'min-w-0 flex-1' }, h('span', { class: 'block truncate font-semibold' }, t.title), h('span', { class: 'block text-sm text-muted' }, t.text)),
        h('span', { class: 'btn btn-sm' }, t.cta, icon('arrow', 'size-3.5')))),
      waiting.length ? h('div', { class: 'card flex items-center gap-3 p-4' },
        h('span', { class: `grid size-10 shrink-0 place-items-center rounded-xl ${TONE.amber}` }, icon('spark', 'size-5')),
        h('span', { class: 'min-w-0 flex-1' }, h('span', { class: 'block font-semibold' }, `${waiting.length} video menunggu Claude Code`), h('span', { class: 'block text-sm text-muted' }, 'Buka Claude Code di folder repo ini, lalu jalankan:')),
        copyCmd()) : null)) : null;

  const card = (v) => h('a', { class: 'block rounded-xl border border-line bg-surface p-3 no-underline shadow-sm transition hover:border-brand', href: `#/video/${v.id}` },
    h('div', { class: 'mb-1 flex items-start justify-between gap-2' }, h('span', { class: 'text-sm leading-snug font-semibold' }, v.title || v.slug),
      ['draft', 'revisi', 'disetujui'].includes(v.status) ? badge(v.status) : null),
    h('div', { class: 'text-xs text-muted' }, `${v.duration} dtk · ${ago(v.updated_at)}`));
  const board = videos.length ? h('section', {},
    h('h2', { class: 'mb-3 text-sm font-semibold tracking-wide text-muted uppercase' }, 'Semua video'),
    h('div', { class: 'grid gap-3 md:grid-cols-3 xl:grid-cols-5' }, COLUMNS.map((c) => {
      const list = by(...c.statuses);
      return h('div', { class: 'rounded-2xl bg-subtle/70 p-2.5' },
        h('div', { class: 'mb-2 flex items-center justify-between px-1.5 text-xs font-semibold tracking-wide text-muted uppercase' }, c.title, h('span', { class: 'tabular-nums' }, list.length)),
        h('div', { class: 'grid gap-2' }, list.length ? list.map(card) : h('div', { class: 'rounded-xl border border-dashed border-line px-3 py-5 text-center text-xs text-muted' }, c.empty)));
    }))) : null;

  const view = h('div', {},
    pageHead('Beranda', products.length ? `${products.length} produk · ${videos.length} video` : 'Studio video affiliate TikTok Shop'),
    onboarding, actions,
    videos.length ? h('div', { class: 'mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4' }, stat('Video final', by('final', 'diposting').length), stat('Diposting', by('diposting').length), stat('Total views', num(sum('views'))), stat('Total pesanan', num(sum('orders')))) : null,
    board,
    products.length && !videos.length ? empty('Belum ada video', 'Buka salah satu produk, lalu antrekan video pertamamu.', h('a', { class: 'btn btn-primary', href: '#/produk' }, 'Lihat produk')) : null);
  return { view, refresh: async () => JSON.stringify((await api('GET', '/api/videos')).map((x) => [x.id, x.status])) };
}

// ---------- products
function readiness(p) {
  const own = p.assets.filter((a) => a.origin === 'own');
  const undescribed = p.assets.filter((a) => a.kind === 'video' && !(a.shows || '').trim()).length;
  return [
    { ok: !!(p.name && p.what), label: 'Nama dan penjelasan singkat', tab: 'data' },
    { ok: !!p.price, label: 'Harga', tab: 'data' },
    { ok: own.length >= 3, warn: own.length > 0, label: own.length >= 3 ? `${own.length} rekaman/foto sendiri` : `Rekaman sendiri: ${own.length} dari minimal 3`, tab: 'aset' },
    { ok: p.assets.length > 0 && !undescribed, warn: p.assets.length > 0, label: undescribed ? `${undescribed} klip belum dijelaskan isinya` : 'Isi tiap klip dijelaskan', tab: 'aset' },
    { ok: !!((p.selling_points || '').trim() || p.claims.length), label: 'Poin jual atau klaim bersumber', tab: 'data' },
  ];
}

async function products() {
  const list = await api('GET', '/api/products');
  const grid = h('div', { class: 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3' });
  const draw = (q = '') => {
    const hit = list.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
    fill(grid, hit.length ? hit.map((p) => h('a', { class: 'card group overflow-hidden no-underline transition hover:border-brand', href: `#/produk/${p.id}` },
      h('div', { class: 'aspect-[4/3] bg-subtle bg-cover bg-center', style: p.thumb ? `background-image:url("${p.thumb}")` : null },
        p.thumb ? null : h('div', { class: 'grid h-full place-items-center text-muted' }, icon('image', 'size-8'))),
      h('div', { class: 'p-4' }, h('div', { class: 'truncate font-semibold' }, p.name),
        h('div', { class: 'mt-0.5 text-sm text-muted' }, [p.price, `${p.asset_count} aset`, `${p.video_count} video`].filter(Boolean).join(' · ')))))
      : h('p', { class: 'col-span-full py-10 text-center text-muted' }, `Tidak ada produk dengan nama "${q}".`));
  };
  draw();
  return { view: h('div', {},
    pageHead('Produk', `${list.length} produk`, h('a', { class: 'btn btn-primary', href: '#/produk/baru' }, icon('plus'), 'Produk baru')),
    list.length > 6 ? h('input', { class: 'input mb-5 max-w-sm', type: 'search', placeholder: 'Cari produk…', 'aria-label': 'Cari produk', oninput: (e) => draw(e.target.value) }) : null,
    list.length ? grid : empty('Belum ada produk', 'Tambahkan produk yang mau kamu promosikan. Cukup tempel link-nya.', h('a', { class: 'btn btn-primary', href: '#/produk/baru' }, icon('plus'), 'Tambah produk'))) };
}

function productForm(p, onSaved) {
  const f = {}, claims = (p.claims || []).map((c) => ({ ...c }));
  const touch = () => { dirty = true; bar.classList.remove('hidden'); };
  const inp = (k, attrs = {}) => (f[k] = h('input', { class: 'input', value: p[k] ?? '', oninput: touch, ...attrs }));
  const area = (k, attrs = {}) => (f[k] = h('textarea', { class: 'input', oninput: touch, ...attrs }, p[k] ?? ''));
  const picks = h('div', {});
  const importMsg = h('p', { class: 'mt-2 hidden text-sm' });
  const say = (text, tone) => { importMsg.textContent = text; importMsg.className = `mt-2 text-sm ${tone === 'bad' ? 'text-amber-700 dark:text-amber-300' : tone === 'ok' ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted'}`; };
  const urlIn = inp('url', { placeholder: 'https://… link produk TikTok Shop atau marketplace', type: 'url', inputmode: 'url' });

  const doImport = guard(async (ev) => {
    if (!urlIn.value.trim()) { urlIn.focus(); return toast('Tempel link produknya dulu.', true); }
    const btn = ev.currentTarget; btn.disabled = true; say('Mengambil data dari link…');
    try {
      const r = await api('POST', '/api/import', { url: urlIn.value.trim() });
      if (!r.ok) return say('Halaman ini tidak bisa dibaca otomatis (toko sering memblokirnya). Isi form di bawah secara manual, lalu tempel deskripsi produknya.', 'bad');
      let n = 0;
      for (const [k, v] of Object.entries(r.fields)) if (f[k] && !f[k].value.trim()) { f[k].value = v; n++; }
      fill(picks, r.images.length ? h('div', { class: 'mt-4' },
        h('div', { class: 'field-label' }, 'Foto dari listing', h('span', { class: 'field-hint' }, 'centang yang mau disimpan sebagai aset')),
        h('div', { class: 'grid grid-cols-4 gap-2 sm:grid-cols-6' }, r.images.map((u, i) => h('label', { class: 'relative cursor-pointer' },
          h('input', { type: 'checkbox', class: 'peer absolute top-1.5 left-1.5 size-4 accent-brand', checked: i < 6, 'data-url': u }),
          h('img', { class: 'aspect-square w-full rounded-lg border-2 border-transparent object-cover peer-checked:border-brand', src: u, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }))))) : null);
      say(`${n} kolom terisi, ${r.images.length} foto ditemukan. Periksa hasilnya sebelum menyimpan: data dari toko bisa keliru.`, 'ok');
      touch();
    } finally { btn.disabled = false; }
  });

  const claimsBox = h('div', { class: 'grid gap-2' });
  const drawClaims = () => fill(claimsBox, claims.map((c, i) => h('div', { class: 'flex gap-2' },
    h('input', { class: 'input', value: c.claim || '', placeholder: 'Klaim, mis. "Muat 5 kabel"', 'aria-label': 'Klaim', oninput: (e) => { c.claim = e.target.value; touch(); } }),
    h('input', { class: 'input', value: c.source || '', placeholder: 'Sumber: deskripsi penjual, label, tes sendiri', 'aria-label': 'Sumber klaim', oninput: (e) => { c.source = e.target.value; touch(); } }),
    h('button', { class: 'btn btn-ghost px-2', type: 'button', title: 'Hapus klaim', 'aria-label': 'Hapus klaim', onclick: () => { claims.splice(i, 1); drawClaims(); touch(); } }, icon('x')))),
    h('div', {}, h('button', { class: 'btn btn-sm', type: 'button', onclick: () => { claims.push({ claim: '', source: '' }); drawClaims(); claimsBox.querySelector('div:nth-last-child(2) input')?.focus(); } }, icon('plus', 'size-3.5'), 'Tambah klaim')));
  drawClaims();

  const save = guard(async () => {
    if (!f.name.value.trim()) { f.name.focus(); return toast('Nama produk wajib diisi.', true); }
    const data = { claims: claims.filter((c) => (c.claim || '').trim()) };
    for (const [k, el] of Object.entries(f)) data[k] = el.value.trim();
    saveBtn.disabled = true;
    try {
      const saved = p.id ? await api('PUT', `/api/products/${p.id}`, data) : await api('POST', '/api/products', data);
      const chosen = [...picks.querySelectorAll('input:checked')].map((c) => c.dataset.url);
      let out = saved;
      if (chosen.length) {
        toast('Menyimpan foto listing…');
        const r = await api('POST', `/api/products/${saved.id}/import-images`, { urls: chosen });
        out = r.product;
        if (r.failed.length) toast(`${r.saved.length} foto tersimpan, ${r.failed.length} gagal diunduh.`, true);
      }
      dirty = false; toast('Produk tersimpan.'); onSaved(out);
    } finally { saveBtn.disabled = false; }
  });
  const saveBtn = h('button', { class: 'btn btn-primary btn-lg', type: 'button', onclick: save }, p.id ? 'Simpan perubahan' : 'Simpan dan lanjut ke aset');
  const bar = h('div', { class: `sticky bottom-4 z-10 mt-5 flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface/95 p-3 shadow-lg backdrop-blur ${p.id ? 'hidden' : ''}` },
    h('span', { class: 'pl-2 text-sm text-muted' }, p.id ? 'Ada perubahan yang belum disimpan.' : 'Setelah disimpan, kamu bisa mengunggah foto dan klip.'), saveBtn);
  const section = (title, hint, ...kids) => h('section', { class: 'card card-pad' }, h('h2', { class: 'card-title' }, title), hint ? h('p', { class: 'mb-4 text-sm text-muted' }, hint) : h('div', { class: 'mb-4' }), kids);
  const two = (...kids) => h('div', { class: 'grid gap-4 sm:grid-cols-2' }, kids);

  return h('div', { class: 'grid gap-4' },
    section('Link produk', 'Tempel link untuk mengisi form otomatis. Kalau tidak terbaca, isi manual di bawah.',
      h('div', { class: 'flex gap-2' }, urlIn, h('button', { class: 'btn shrink-0', type: 'button', onclick: doImport }, icon('link'), 'Ambil data')), importMsg, picks),
    section('Produk', null, h('div', { class: 'grid gap-4' },
      field('Nama produk', inp('name', { required: true, placeholder: 'Rak Kabel Meja Lipat' })),
      field('Apa ini', inp('what', { placeholder: 'Rak kecil untuk merapikan kabel charger di meja' }), 'satu kalimat'),
      two(field('Toko atau merek', inp('shop')), field('Varian', inp('variants', { placeholder: 'warna, ukuran' }))))),
    section('Harga dan promo', 'Hanya angka di sini yang boleh muncul di video. Cek lagi di hari posting.', h('div', { class: 'grid gap-4' },
      two(field('Harga', inp('price', { placeholder: 'Rp79.000' })), field('Harga coret', inp('was_price', { placeholder: 'Rp129.000' }), 'opsional')),
      two(field('Promo', inp('promo', { placeholder: 'Diskon 11.11, gratis ongkir' }), 'opsional'), field('Promo berakhir', inp('promo_end', { type: 'date' }))),
      two(field('Komisi', inp('commission', { placeholder: '10%' }), 'catatan pribadi, tidak masuk video')))),
    section('Bahan naskah', 'Makin jujur dan spesifik, makin natural hasilnya.', h('div', { class: 'grid gap-4' },
      two(field('Sudah pakai sendiri?', inp('used_it', { placeholder: 'Ya, 2 minggu / Belum' }), 'menentukan gaya bicara'),
        field('Satu kekurangan jujur', inp('honest_note', { placeholder: 'Perekatnya butuh 24 jam' }))),
      field('Poin jual', area('selling_points', { placeholder: 'Satu poin per baris, yang benar-benar kamu lihat atau rasakan' })),
      two(field('Target penonton', inp('audience', { placeholder: 'Pekerja WFH dengan meja sempit' })), field('Masalah mereka', inp('problem', { placeholder: 'Kabel charger berantakan' }))),
      field('Deskripsi penjual', area('description', { placeholder: 'Tempel deskripsi dari halaman produk' }), 'jadi sumber klaim'),
      field('Catatan lain', area('notes'), 'opsional'))),
    section('Klaim dan sumbernya', 'Tiap klaim tampil dengan catatan kaki di video. Klaim tanpa sumber tidak dipakai.', claimsBox),
    bar);
}

function assetsTab(p, redraw) {
  let origin = 'own';
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Asal file' });
  const drawSeg = () => fill(seg, [['own', 'Rekaman sendiri'], ['listing', 'Dari listing']].map(([v, t]) => h('button', { type: 'button', 'aria-pressed': String(origin === v), onclick: () => { origin = v; drawSeg(); } }, t)));
  drawSeg();
  const progress = h('div', { class: 'grid gap-2' });
  const picker = h('input', { type: 'file', multiple: true, accept: 'image/*,video/*', class: 'hidden', onchange: (e) => { send(e.target.files); e.target.value = ''; } });
  const drop = h('button', { type: 'button', class: 'flex w-full cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line px-6 py-9 text-center text-muted transition hover:border-brand hover:text-ink', onclick: () => picker.click() },
    icon('upload', 'size-7'), h('span', { class: 'font-semibold text-ink' }, 'Tarik foto atau video ke sini'), h('span', { class: 'text-sm' }, 'atau klik untuk memilih · JPG, PNG, WEBP, MP4, MOV · maks. 2 GB per file'));
  const send = guard(async (files) => {
    let fresh = p, failed = 0;
    for (const file of [...files]) {
      const barIn = h('div', { class: 'h-full w-0 rounded-full bg-brand transition-[width]' });
      const row = h('div', { class: 'rounded-xl border border-line bg-surface p-3 text-sm' }, h('div', { class: 'mb-1.5 flex justify-between gap-3' }, h('span', { class: 'truncate' }, file.name), h('span', { class: 'text-muted tabular-nums' }, `${(file.size / 1e6).toFixed(1)} MB`)),
        h('div', { class: 'h-1.5 overflow-hidden rounded-full bg-subtle' }, barIn));
      progress.append(row);
      try {
        fresh = await upload(`/api/products/${p.id}/assets?name=${encodeURIComponent(file.name)}&origin=${origin}`, file, (f) => { barIn.style.width = `${Math.round(f * 100)}%`; });
        row.remove();
      } catch (e) { failed++; barIn.className = 'h-full w-full rounded-full bg-red-500'; row.append(h('div', { class: 'mt-1.5 text-red-600 dark:text-red-400' }, e.message)); }
    }
    if (!failed) toast(`${files.length} file diunggah.`);
    if (fresh !== p) redraw(fresh, 'aset', failed ? progress : null);
  });
  for (const ev of ['dragenter', 'dragover']) drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('border-brand', 'text-ink'); });
  for (const ev of ['dragleave', 'drop']) drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('border-brand', 'text-ink'); });
  drop.addEventListener('drop', (e) => send(e.dataTransfer.files));

  const own = p.assets.filter((a) => a.origin === 'own').length;
  const patch = (a, data) => guard(async () => { const fresh = await api('PATCH', `/api/assets/${a.id}`, data()); Object.assign(p, fresh); });
  return h('div', { class: 'grid gap-5' },
    h('div', { class: 'card card-pad' },
      h('div', { class: 'mb-4 flex flex-wrap items-center justify-between gap-3' }, h('div', {}, h('h2', { class: 'card-title' }, 'Unggah aset'), h('p', { class: 'text-sm text-muted' }, 'Klip pendek 3–10 detik: unboxing, dipakai, close-up, ukuran di tangan.')),
        h('div', { class: 'flex items-center gap-2 text-sm' }, h('span', { class: 'text-muted' }, 'Unggah sebagai'), seg)),
      picker, drop, progress),
    p.assets.length && !own ? h('div', { class: `flex gap-3 rounded-2xl p-4 text-sm ${TONE.amber}` }, icon('alert', 'size-5'),
      h('span', {}, h('b', {}, 'Belum ada rekaman sendiri. '), 'Video yang hanya memakai foto listing terlihat seperti slideshow dan cenderung kurang dijangkau. Rekam minimal 3–4 klip pendek produknya.')) : null,
    p.assets.length ? h('div', { class: 'grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4' }, p.assets.map((a) => h('div', { class: 'card overflow-hidden' },
      h('div', { class: 'relative' },
        a.kind === 'video' ? h('video', { class: 'aspect-square w-full bg-black object-cover', src: a.url, muted: true, preload: 'metadata', controls: true, playsinline: '' })
          : h('img', { class: 'aspect-square w-full bg-subtle object-cover', src: a.url, alt: a.shows || a.file, loading: 'lazy' }),
        h('span', { class: 'badge absolute top-2 left-2 bg-black/65 text-white' }, a.kind === 'video' ? 'Video' : 'Foto')),
      h('div', { class: 'grid gap-2 p-3' },
        h('div', { class: 'truncate text-xs text-muted', title: a.file }, a.file),
        h('select', { class: 'input px-2 py-1 text-[13px]', 'aria-label': 'Asal file', onchange: (e) => patch(a, () => ({ origin: e.target.value }))() },
          h('option', { value: 'own', selected: a.origin === 'own' }, 'Rekaman sendiri'), h('option', { value: 'listing', selected: a.origin === 'listing' }, 'Dari listing')),
        h('input', { class: `input px-2 py-1 text-[13px] ${a.kind === 'video' && !(a.shows || '').trim() ? 'border-amber-500' : ''}`, value: a.shows || '', 'aria-label': 'Isi klip',
          placeholder: a.kind === 'video' ? 'Isinya apa? (wajib untuk video)' : 'Isinya apa?', onchange: (e) => { patch(a, () => ({ shows: e.target.value }))(); e.target.classList.toggle('border-amber-500', a.kind === 'video' && !e.target.value.trim()); } }),
        h('button', { class: 'btn btn-sm btn-ghost btn-danger justify-self-start', type: 'button', onclick: guard(async () => {
          if (await confirmDialog({ title: `Hapus ${a.file}?`, text: 'File dihapus dari studio. Video yang sudah jadi tidak berubah.' })) redraw(await api('DELETE', `/api/assets/${a.id}`), 'aset');
        }) }, icon('trash', 'size-3.5'), 'Hapus')))))
      : null,
    p.assets.some((a) => a.kind === 'video') ? h('p', { class: 'text-sm text-muted' }, 'Tulis isi tiap klip (mis. "tangan menempel rak ke sisi meja"). Claude tidak bisa menonton video, jadi keterangan ini yang dipakai untuk menyusun adegan.') : null);
}

function videoTab(p, checks) {
  let duration = 45;
  const note = h('p', { class: 'mt-2 text-sm text-muted' });
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Durasi' });
  const drawSeg = () => { fill(seg, [30, 45, 60].map((d) => h('button', { type: 'button', 'aria-pressed': String(duration === d), onclick: () => { duration = d; drawSeg(); } }, `${d} detik`))); note.textContent = DURATION_NOTE[duration]; };
  drawSeg();
  const lookNote = h('p', { class: 'mt-2 text-sm text-muted' }, LOOK_NOTE['ugc-native']);
  const look = h('select', { class: 'input', onchange: (e) => { lookNote.textContent = LOOK_NOTE[e.target.value] || ''; } }, META.looks.map((l) => h('option', { value: l }, l)));
  const angle = h('input', { class: 'input', placeholder: 'mis. "murah tapi awet". Kosongkan supaya dipilihkan.' });
  const notes = h('textarea', { class: 'input', placeholder: 'Permintaan khusus: nada bicara, shot yang wajib ada, hal yang jangan disebut…' });
  const review = h('input', { type: 'checkbox', class: 'size-4 accent-brand' });
  const missing = checks.filter((c) => !c.ok);
  const create = guard(async () => {
    const v = await api('POST', `/api/products/${p.id}/videos`, { duration, look: look.value, angle: angle.value, notes: notes.value, concept_review: review.checked });
    toast('Video masuk antrean.'); location.hash = `#/video/${v.id}`;
  });
  return h('div', { class: 'grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:items-start' },
    h('div', { class: 'card card-pad' },
      h('h2', { class: 'card-title' }, 'Buat video baru'), h('p', { class: 'mb-5 text-sm text-muted' }, 'Naskah, adegan dan suara dibuat Claude Code dari data produk dan asetmu.'),
      h('div', { class: 'grid gap-5' },
        h('div', {}, h('div', { class: 'field-label' }, 'Durasi'), seg, note),
        h('div', {}, field('Look', look), lookNote),
        field('Sudut hook', angle, 'opsional'), field('Catatan', notes, 'opsional'),
        h('label', { class: 'flex cursor-pointer items-start gap-2.5 text-sm' }, review, h('span', {}, h('span', { class: 'font-medium' }, 'Aku mau baca naskahnya dulu'), h('span', { class: 'block text-muted' }, 'Berhenti setelah konsep ditulis, sebelum draft dirender.')))),
      !p.assets.length ? h('p', { class: `mt-5 flex gap-2 rounded-xl p-3 text-sm ${TONE.amber}` }, icon('alert'), h('span', {}, 'Unggah minimal satu foto atau klip dulu di tab ', h('a', { class: 'font-semibold', href: `#/produk/${p.id}/aset` }, 'Aset'), '.')) : null,
      h('div', { class: 'mt-5 flex flex-wrap items-center gap-3' }, h('button', { class: 'btn btn-primary btn-lg', type: 'button', onclick: create, disabled: !p.assets.length }, icon('spark'), 'Antrekan video'),
        missing.length && p.assets.length ? h('span', { class: 'text-sm text-muted' }, `Bisa diantrekan, tapi ${missing.length} hal di daftar kesiapan belum lengkap.`) : null)),
    h('div', { class: 'card card-pad' }, h('h2', { class: 'card-title mb-3' }, `Video produk ini (${p.videos.length})`),
      p.videos.length ? h('div', { class: 'flex flex-col gap-2' }, p.videos.map((v) => h('a', { class: 'flex min-w-0 items-center justify-between gap-2 rounded-xl border border-line p-3 no-underline transition hover:border-brand', href: `#/video/${v.id}` },
        h('span', { class: 'min-w-0' }, h('span', { class: 'block truncate text-sm font-semibold' }, v.title), h('span', { class: 'text-xs text-muted' }, `${v.duration} dtk · ${ago(v.updated_at)}`)), badge(v.status))))
        : h('p', { class: 'text-sm text-muted' }, 'Belum ada. Video pertama muncul di sini setelah diantrekan.')));
}

async function productPage(id, tabArg) {
  const root = h('div', {});
  function draw(p, tab, keep) {
    const checks = readiness(p), done = checks.filter((c) => c.ok).length;
    tab = tab || (p.assets.length ? 'video' : 'aset');
    const thumb = p.assets.find((a) => a.kind === 'image');
    const tabs = [['video', 'Video', p.videos.length], ['aset', 'Aset', p.assets.length], ['data', 'Data produk', null]];
    const body = tab === 'aset' ? assetsTab(p, draw) : tab === 'data' ? productForm(p, (fresh) => draw(fresh, 'data')) : videoTab(p, checks);
    if (keep) body.prepend(keep);
    fill(root,
      crumb('#/produk', 'Semua produk'),
      h('div', { class: 'mb-5 flex flex-wrap items-center gap-4' },
        h('div', { class: 'size-16 shrink-0 rounded-2xl border border-line bg-subtle bg-cover bg-center', style: thumb ? `background-image:url("${thumb.url}")` : null }),
        h('div', { class: 'min-w-0 flex-1 basis-3/5 sm:basis-0' }, h('h1', { class: 'text-2xl font-bold tracking-tight sm:truncate' }, p.name),
          h('p', { class: 'text-muted' }, [p.price, p.was_price ? `dari ${p.was_price}` : null, p.shop].filter(Boolean).join(' · ') || 'Harga belum diisi')),
        p.url ? h('a', { class: 'btn', href: p.url, target: '_blank', rel: 'noopener noreferrer' }, icon('link'), 'Buka listing') : null,
        h('button', { class: 'btn btn-ghost btn-danger', type: 'button', onclick: guard(async () => {
          if (await confirmDialog({ title: `Hapus "${p.name}"?`, text: `Semua aset (${p.assets.length}) dan video (${p.videos.length}) produk ini ikut terhapus dan tidak bisa dikembalikan.` })) { await api('DELETE', `/api/products/${p.id}`); location.hash = '#/produk'; }
        }) }, icon('trash'), 'Hapus')),
      done < checks.length ? h('div', { class: 'card mb-5 p-4' },
        h('div', { class: 'mb-2 flex items-center justify-between gap-3' }, h('span', { class: 'text-sm font-semibold' }, 'Kesiapan produk'), h('span', { class: 'text-sm text-muted tabular-nums' }, `${done}/${checks.length}`)),
        h('div', { class: 'mb-3 h-1.5 overflow-hidden rounded-full bg-subtle' }, h('div', { class: 'h-full rounded-full bg-brand', style: `width:${(done / checks.length) * 100}%` })),
        h('ul', { class: 'grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2' }, checks.map((c) => h('li', { class: 'flex items-center gap-2' },
          h('span', { class: `grid size-4 shrink-0 place-items-center rounded-full ${c.ok ? 'bg-emerald-600 text-white' : c.warn ? 'bg-amber-500 text-white' : 'bg-subtle text-muted'}` }, c.ok ? icon('check', 'size-3') : null),
          c.ok ? h('span', { class: 'text-muted' }, c.label) : h('a', { class: 'font-medium no-underline hover:underline', href: `#/produk/${p.id}/${c.tab}` }, c.label))))) : null,
      h('div', { class: 'mb-5 flex gap-6 border-b border-line', role: 'tablist' }, tabs.map(([k, t, n]) => h('a', { class: 'tab', href: `#/produk/${p.id}/${k}`, 'aria-current': tab === k ? 'page' : null }, t, n != null ? h('span', { class: 'ml-1.5 text-muted tabular-nums' }, n) : null))),
      body);
  }
  draw(await api('GET', `/api/products/${id}`), ['video', 'aset', 'data'].includes(tabArg) ? tabArg : null);
  return { view: root };
}
const newProduct = async () => ({ view: h('div', { class: 'mx-auto max-w-3xl' }, crumb('#/produk', 'Semua produk'),
  pageHead('Produk baru', 'Langkah 1 dari 3: data produk. Berikutnya unggah aset, lalu antrekan video.'),
  productForm({}, (p) => { location.hash = `#/produk/${p.id}/aset`; })) });

// ---------- video
function stepper(status) {
  const cur = STATUS[status].step;
  return h('ol', { class: 'mb-6 flex items-center', 'aria-label': 'Tahap video' }, STEPS.map((s, i) => {
    const done = i < cur, now = i === cur;
    return h('li', { class: `flex items-center ${i ? 'flex-1' : ''}` },
      i ? h('span', { class: `mx-2 h-0.5 flex-1 rounded ${i <= cur ? 'bg-brand' : 'bg-line'}` }) : null,
      h('span', { class: 'flex items-center gap-2', 'aria-current': now ? 'step' : null },
        h('span', { class: `grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${done ? 'bg-brand text-brand-ink' : now ? 'bg-brand/15 text-brand ring-2 ring-brand' : 'bg-subtle text-muted'}` }, done ? icon('check', 'size-3.5') : i + 1),
        h('span', { class: `hidden text-sm font-medium sm:inline ${done || now ? 'text-ink' : 'text-muted'}` }, s)));
  }));
}

async function videoPage(id) {
  const root = h('div', {});
  const act = (name, data) => guard(async () => { const fresh = await api('POST', `/api/videos/${id}/${name}`, data ? data() : undefined); set(fresh); });
  let v;
  const set = (fresh) => { v = fresh; draw(); api('GET', '/api/videos').then(shell).catch(() => {}); };
  function draw() {
    const s = v.status, st = STATUS[s];
    const note = h('textarea', { class: 'input', placeholder: 'Tulis apa yang perlu diubah, sespesifik mungkin. mis. "Ganti shot pertama dengan klip unboxing, dan pelankan musik."' });
    const chips = h('div', { class: 'mb-2 flex flex-wrap gap-1.5' }, REVISION_CHIPS.map((c) => h('button', { class: 'chip', type: 'button', onclick: () => { note.value = (note.value.trim() ? note.value.trim().replace(/[.;]?$/, '; ') : '') + c.toLowerCase(); note.focus(); } }, c)));
    const revise = (label = 'Kirim revisi') => h('div', {}, h('div', { class: 'field-label' }, 'Minta revisi'), chips, note,
      h('button', { class: 'btn mt-3', type: 'button', onclick: act('revise', () => ({ note: note.value })) }, label));
    const postUrl = h('input', { class: 'input', type: 'url', value: v.posted_url || '', placeholder: 'https://www.tiktok.com/@kamu/video/…' });
    const views = h('input', { class: 'input', type: 'number', min: 0, inputmode: 'numeric', value: v.views ?? '' }), orders = h('input', { class: 'input', type: 'number', min: 0, inputmode: 'numeric', value: v.orders ?? '' });
    const copyText = [v.caption, v.hashtags].filter(Boolean).join('\n\n');
    const src = v.final_url || v.draft_url;
    const card = (title, ...kids) => h('section', { class: 'card card-pad' }, title ? h('h2', { class: 'card-title mb-3' }, title) : null, kids);

    const player = h('div', { class: 'lg:sticky lg:top-6' },
      src ? h('video', { class: 'mx-auto aspect-[9/16] w-full max-w-[340px] rounded-2xl bg-black shadow-lg', src, controls: true, playsinline: '', preload: 'metadata' })
        : h('div', { class: 'mx-auto grid aspect-[9/16] w-full max-w-[340px] place-items-center rounded-2xl border-2 border-dashed border-line text-center text-muted' },
          h('div', { class: 'px-6' }, icon('film', 'mx-auto mb-2 size-8'), h('div', { class: 'font-medium' }, s === 'konsep' ? 'Sedang dibuat…' : 'Belum ada render'), h('div', { class: 'text-sm' }, 'Draft muncul di sini begitu selesai.'))),
      src ? h('p', { class: 'mt-2 text-center text-sm text-muted' }, v.final_url ? 'Video final · 1080×1920' : 'Draft setengah resolusi, untuk menilai isi dan tempo') : null,
      v.final_url ? h('a', { class: 'btn btn-primary btn-lg mx-auto mt-3 flex w-full max-w-[340px]', href: v.final_url.split('?')[0] + '?download=1' }, icon('download'), 'Unduh MP4') : null);

    const status = h('section', { class: `rounded-2xl p-4 ${TONE[st.tone]}` },
      h('div', { class: 'flex flex-wrap items-center gap-x-3 gap-y-2' }, h('span', { class: 'min-w-0 flex-1 text-[15px] font-medium' }, st.next), st.claude ? copyCmd() : null,
        s === 'draft' ? h('button', { class: 'btn btn-primary', type: 'button', onclick: act('queue') }, 'Antrekan') : null));

    const decision = s === 'preview' ? card(v.draft_url ? 'Keputusanmu' : 'Konsep menunggu persetujuan',
      h('button', { class: 'btn btn-ok btn-lg mb-5 w-full', type: 'button', onclick: act('approve') }, icon('check'), v.draft_url ? 'Setujui, lanjut render final' : 'Setujui konsep'),
      revise()) : ['final', 'disetujui'].includes(s) ? card('Masih kurang?', revise('Minta revisi')) : null;

    const posting = ['final', 'diposting'].includes(s) ? card('Posting',
      copyText ? h('div', { class: 'mb-4' }, h('div', { class: 'field-label' }, 'Caption dan hashtag'), h('div', { class: 'mb-2 rounded-xl bg-subtle p-3 text-sm whitespace-pre-wrap' }, copyText),
        h('button', { class: 'btn btn-sm', type: 'button', onclick: guard(() => copy(copyText, 'Caption disalin.')) }, icon('copy', 'size-3.5'), 'Salin')) : null,
      v.pinned_comment ? h('div', { class: 'mb-4' }, h('div', { class: 'field-label' }, 'Komentar untuk disematkan'), h('div', { class: 'mb-2 rounded-xl bg-subtle p-3 text-sm whitespace-pre-wrap' }, v.pinned_comment),
        h('button', { class: 'btn btn-sm', type: 'button', onclick: guard(() => copy(v.pinned_comment, 'Komentar disalin.')) }, icon('copy', 'size-3.5'), 'Salin')) : null,
      s === 'final' ? h('div', { class: 'mb-4' }, h('div', { class: 'field-label' }, 'Sebelum upload'),
        h('ul', { class: 'grid gap-1.5 text-sm' }, ['Harga dan promo masih sama dengan yang di video', 'Produk ditautkan di keranjang kuning', 'Label konten AI dinyalakan bila diwajibkan (suaranya sintetis)', 'Punya izin memakai foto/video dari listing penjual']
          .map((t) => h('li', {}, h('label', { class: 'flex cursor-pointer items-start gap-2' }, h('input', { type: 'checkbox', class: 'mt-0.5 size-4 accent-brand' }), t))))) : null,
      field('Link video TikTok', postUrl, s === 'final' ? 'isi setelah diposting' : null),
      s === 'diposting' ? h('div', { class: 'mt-4 grid grid-cols-2 gap-4' }, field('Views', views), field('Pesanan', orders)) : null,
      h('div', { class: 'mt-4 flex flex-wrap gap-2' },
        h('button', { class: 'btn btn-primary', type: 'button', onclick: act('posted', () => ({ posted_url: postUrl.value.trim() })) }, s === 'diposting' ? 'Simpan link' : 'Tandai sudah diposting'),
        s === 'diposting' ? h('button', { class: 'btn', type: 'button', onclick: guard(async () => { set(await api('PATCH', `/api/videos/${id}`, { views: views.value === '' ? null : +views.value, orders: orders.value === '' ? null : +orders.value })); toast('Angka tersimpan.'); }) }, 'Simpan angka') : null,
        v.posted_url ? h('a', { class: 'btn btn-ghost', href: v.posted_url, target: '_blank', rel: 'noopener noreferrer' }, icon('link'), 'Buka di TikTok') : null)) : null;

    const sheet = v.storyboard_url || v.sheet_url;
    fill(root,
      crumb(`#/produk/${v.product_id}`, v.product_name),
      h('div', { class: 'mb-5 flex flex-wrap items-center gap-3' },
        h('h1', { class: 'min-w-0 truncate text-2xl font-bold tracking-tight' }, v.title || v.slug), badge(s),
        h('span', { class: 'text-muted' }, `${v.duration} detik · ${v.look}`)),
      s === 'draft' ? null : stepper(s),
      h('div', { class: 'grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:items-start' },
        player,
        h('div', { class: 'grid min-w-0 gap-4' },
          status,
          s === 'revisi' && v.revision_note ? card('Revisi yang kamu minta', h('p', { class: 'text-sm whitespace-pre-wrap' }, v.revision_note)) : null,
          decision, posting,
          sheet ? card(v.storyboard_url ? 'Storyboard final' : 'Deretan frame draft', h('a', { href: sheet, target: '_blank', rel: 'noopener' }, h('img', { class: 'w-full rounded-xl border border-line', src: sheet, alt: 'Deretan frame video dari awal sampai akhir', loading: 'lazy' }))) : null,
          card(null,
            v.concept ? h('details', { class: 'group mb-3', open: s === 'preview' && !v.draft_url }, h('summary', { class: 'cursor-pointer font-semibold' }, 'Konsep dan naskah'), h('pre', { class: 'doc mt-2' }, v.concept)) : null,
            v.brief ? h('details', { class: 'mb-3' }, h('summary', { class: 'cursor-pointer font-semibold' }, 'Brief yang dikirim ke Claude'), h('pre', { class: 'doc mt-2' }, v.brief)) : null,
            h('details', { open: !v.concept }, h('summary', { class: 'cursor-pointer font-semibold' }, 'Riwayat'),
              h('ul', { class: 'mt-2 text-sm' }, v.events.map((e) => h('li', { class: 'flex gap-3 border-b border-line py-1.5 last:border-0' }, h('time', { class: 'shrink-0 text-muted tabular-nums' }, when(e.at)), h('span', { class: 'min-w-0 break-words' }, e.kind === 'status' ? e.message : `${e.kind}: ${e.message}`)))))),
          h('div', { class: 'flex flex-wrap items-center justify-between gap-3 px-1 text-sm text-muted' },
            h('span', { class: 'min-w-0' }, 'Folder project: ', h('code', { class: 'code' }, v.project)),
            h('span', { class: 'flex gap-2' },
              ['final', 'diposting', 'preview'].includes(s) ? h('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: guard(async () => {
                if (await confirmDialog({ title: 'Buat ulang dari awal?', text: 'Video diantrekan lagi dengan data produk terbaru. Konsep dan adegan yang ada dipakai sebagai titik awal.', yes: 'Antrekan ulang', danger: false })) await act('queue')();
              }) }, 'Buat ulang') : null,
              h('button', { class: 'btn btn-sm btn-ghost btn-danger', type: 'button', onclick: guard(async () => {
                if (await confirmDialog({ title: 'Hapus video ini?', text: 'Folder project dan hasil rendernya ikut terhapus. Produk dan asetnya tetap ada.' })) { await api('DELETE', `/api/videos/${id}`); location.hash = `#/produk/${v.product_id}`; }
              }) }, icon('trash', 'size-3.5'), 'Hapus'))))));
  }
  const key = (x) => [x.status, x.updated_at, x.draft_url, x.final_url, x.events.length].join('|');
  set(await api('GET', `/api/videos/${id}`));
  return { view: root, soft: async () => { const n = await api('GET', `/api/videos/${id}`); if (key(n) !== key(v)) set(n); } };
}

// ---------- router
const skeleton = () => h('div', { class: 'grid gap-4', 'aria-busy': 'true' }, h('div', { class: 'skeleton h-9 w-56' }), h('div', { class: 'skeleton h-28' }), h('div', { class: 'skeleton h-64' }));
let routeId = 0, lastHash = location.hash;
async function route() {
  if (dirty && !(await confirmDialog({ title: 'Tinggalkan tanpa menyimpan?', text: 'Perubahan data produk belum disimpan.', yes: 'Tinggalkan', danger: false }))) { history.replaceState(null, '', lastHash || '#/'); return; }
  dirty = false; lastHash = location.hash;
  clearInterval(poll);
  const mine = ++routeId;
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const section = parts[0] === 'produk' ? 'produk' : parts[0] === 'video' ? '' : 'home';
  document.querySelectorAll('[data-nav]').forEach((a) => (a.dataset.nav === section ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  const slow = setTimeout(() => mine === routeId && fill(app, skeleton()), 150);
  try {
    const page = parts[0] === 'produk' && !parts[1] ? await products()
      : parts[0] === 'produk' && parts[1] === 'baru' ? await newProduct()
      : parts[0] === 'produk' ? await productPage(+parts[1], parts[2])
      : parts[0] === 'video' ? await videoPage(+parts[1])
      : await home();
    if (mine !== routeId) return;
    fill(app, page.view);
    if (!parts[2]) window.scrollTo(0, 0);
    if (section !== 'home') api('GET', '/api/videos').then(shell).catch(() => {});
    if (page.refresh || page.soft) {
      let last = page.refresh ? await page.refresh() : null;
      poll = setInterval(async () => {
        const busy = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) || [...document.querySelectorAll('video')].some((x) => !x.paused) || document.querySelector('dialog[open]');
        if (document.hidden || busy) return;
        try { if (page.soft) await page.soft(); else if ((await page.refresh()) !== last) route(); } catch { /* server stopped: keep the page */ }
      }, 5000);
    }
  } catch (e) {
    if (mine === routeId) fill(app, empty('Halaman tidak bisa dimuat', e.message, h('a', { class: 'btn', href: '#/' }, 'Kembali ke beranda')));
  } finally { clearTimeout(slow); }
}
window.addEventListener('beforeunload', (e) => { if (dirty) e.preventDefault(); });
window.addEventListener('hashchange', route);
META = await api('GET', '/api/meta').catch(() => META);
route();
