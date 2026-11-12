// validate.mjs — the server's input rules. Every write goes through one of the functions at the bottom; each
// returns clean values (trimmed text, integers for money and counts, null for empty) or throws Invalid with a
// message per field, which the server answers as 422 { error, fields } and the form shows under each input.
import { LOOKS } from './db.mjs';

export class Invalid extends Error {
  constructor(fields) { super(Object.values(fields)[0]); this.status = 422; this.fields = fields; }
}
export const rupiah = (n) => (n == null || n === '' ? '' : 'Rp' + Number(n).toLocaleString('id-ID'));
export const discount = (price, was) => (price > 0 && was > price ? Math.round((1 - price / was) * 100) : null);

const MAX_MONEY = 1_000_000_000;
const empty = (v) => v == null || (typeof v === 'string' && v.trim() === '');

// each rule: (value) => clean value, or throws a string
const R = {
  text: (max, { required } = {}) => (v) => {
    if (v != null && typeof v !== 'string' && typeof v !== 'number') throw 'harus berupa teks.';
    const s = String(v ?? '').replace(/\r\n/g, '\n').trim();
    if (!s) { if (required) throw 'wajib diisi.'; return null; }
    if (s.length > max) throw `maksimal ${max} karakter (sekarang ${s.length}).`;
    return s;
  },
  // rupiah as a whole number; "Rp79.000", "79.000" and 79000 all mean 79000
  money: () => (v) => {
    if (empty(v)) return null;
    let n;
    if (typeof v === 'number') n = v;
    else if (typeof v === 'string') {
      const s = v.replace(/^\s*rp\.?/i, '').replace(/[\s.]/g, '');
      if (!/^\d+$/.test(s)) throw 'isi angka rupiah saja, tanpa desimal (mis. 79.000).';
      n = Number(s);
    } else throw 'harus berupa angka.';
    if (!Number.isInteger(n)) throw 'harus bilangan bulat rupiah.';
    if (n <= 0) throw 'harus lebih dari 0.';
    if (n > MAX_MONEY) throw `maksimal ${rupiah(MAX_MONEY)}.`;
    return n;
  },
  percent: () => (v) => {
    if (empty(v)) return null;
    const n = typeof v === 'number' ? v : Number(String(v).replace('%', '').replace(',', '.').trim());
    if (!Number.isFinite(n)) throw 'isi angka persen (mis. 10 atau 7,5).';
    if (n < 0 || n > 100) throw 'harus antara 0 dan 100.';
    return Math.round(n * 100) / 100;
  },
  count: () => (v) => {
    if (empty(v)) return null;
    const n = typeof v === 'number' ? v : Number(String(v).replace(/[\s.]/g, ''));
    if (!Number.isInteger(n) || n < 0) throw 'harus bilangan bulat 0 atau lebih.';
    if (n > 1e12) throw 'angkanya terlalu besar.';
    return n;
  },
  date: () => (v) => {
    if (empty(v)) return null;
    const s = String(v).trim(), m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    const d = m && new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (!d || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3] || +m[1] < 2000 || +m[1] > 2100) throw 'tanggal tidak valid (format TTTT-BB-HH).';
    return s;
  },
  url: () => (v) => {
    if (empty(v)) return null;
    const s = String(v).trim();
    if (s.length > 2000) throw 'terlalu panjang.';
    let u; try { u = new URL(s); } catch { throw 'tidak valid. Awali dengan https://'; }
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) throw 'harus alamat web http(s).';
    return u.href;
  },
  oneOf: (list, { required } = {}) => (v) => {
    if (empty(v)) { if (required) throw 'wajib dipilih.'; return null; }
    const hit = list.find((x) => String(x) === String(v));
    if (hit === undefined) throw `pilih salah satu: ${list.join(', ')}.`;
    return hit;
  },
  flag: () => (v) => (v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0),
  claims: () => (v) => {
    if (v == null) return [];
    if (!Array.isArray(v)) throw 'harus berupa daftar.';
    if (v.length > 20) throw 'maksimal 20 klaim.';
    const out = [];
    for (const [i, c] of v.entries()) {
      const claim = R.text(200)(c?.claim), source = R.text(200)(c?.source);
      if (!claim) { if (source) throw `klaim ke-${i + 1}: isi klaimnya, atau hapus barisnya.`; continue; }
      out.push({ claim, source });
    }
    return out;
  },
};

const LABEL = { name: 'Nama produk', url: 'Link produk', what: 'Apa ini', shop: 'Toko', variants: 'Varian', price: 'Harga', was_price: 'Harga coret',
  promo: 'Promo', promo_end: 'Promo berakhir', commission: 'Komisi', description: 'Deskripsi penjual', selling_points: 'Poin jual', claims: 'Klaim',
  audience: 'Target penonton', problem: 'Masalah', used_it: 'Sudah pakai sendiri', honest_note: 'Kekurangan jujur', notes: 'Catatan',
  title: 'Judul', duration: 'Durasi', look: 'Look', style: 'Gaya', angle: 'Sudut hook', voice: 'Voice', caption: 'Caption', hashtags: 'Hashtag',
  pinned_comment: 'Komentar sematan', posted_url: 'Link video', posted_at: 'Tanggal posting', views: 'Views', orders: 'Pesanan',
  note: 'Catatan revisi', origin: 'Asal file', shows: 'Isi klip' };

// Runs the rules over the keys present in `body` (all keys when !partial, so required ones are enforced).
function run(rules, body, { partial = false } = {}) {
  if (body == null || typeof body !== 'object' || Array.isArray(body)) throw new Invalid({ _: 'Data harus berupa objek JSON.' });
  const data = {}, fields = {};
  for (const [k, rule] of Object.entries(rules)) {
    if (partial && !(k in body)) continue;
    try { data[k] = rule(body[k]); } catch (e) { if (typeof e !== 'string') throw e; fields[k] = `${LABEL[k] || k} ${e}`; }
  }
  return { data, fields };
}
const done = ({ data, fields }) => { if (Object.keys(fields).length) throw new Invalid(fields); return data; };

const PRODUCT = {
  name: R.text(150, { required: true }), url: R.url(), what: R.text(200), shop: R.text(100), variants: R.text(200),
  price: R.money(), was_price: R.money(), promo: R.text(150), promo_end: R.date(), commission: R.percent(),
  description: R.text(8000), selling_points: R.text(2000), claims: R.claims(),
  audience: R.text(200), problem: R.text(200), used_it: R.text(100), honest_note: R.text(300), notes: R.text(2000),
};
// `current` is the stored row on an update, so rules across fields see the values that are not being changed
export function product(body, { partial = false, current = {} } = {}) {
  const r = run(PRODUCT, body, { partial });
  const now = { ...current, ...r.data };
  if (!r.fields.price && !r.fields.was_price && now.was_price != null) {
    if (now.price == null) r.fields.was_price = 'Harga coret butuh Harga: isi harga jualnya dulu.';
    else if (now.was_price <= now.price) r.fields.was_price = `Harga coret harus lebih besar dari harga (${rupiah(now.price)}).`;
  }
  if (!r.fields.promo_end && now.promo_end && !now.promo) r.fields.promo_end = 'Tanggal berakhir butuh nama promonya: isi kolom Promo.';
  return done(r);
}

const VIDEO_NEW = { title: R.text(150), duration: R.oneOf([30, 45, 60], { required: true }), look: R.oneOf(LOOKS), style: R.oneOf(['motion', 'ugc', 'hybrid']),
  concept_review: R.flag(), angle: R.text(200), voice: R.text(100), notes: R.text(2000) };
export const newVideo = (body) => done(run(VIDEO_NEW, { duration: 45, ...body }));

const VIDEO_PATCH = { ...VIDEO_NEW, look: R.oneOf(LOOKS, { required: true }), caption: R.text(2200), hashtags: R.text(500), pinned_comment: R.text(500),
  posted_url: R.url(), posted_at: R.date(), views: R.count(), orders: R.count() };
export const videoPatch = (body) => done(run(VIDEO_PATCH, body, { partial: true }));

export const revision = (body) => done(run({ note: R.text(2000, { required: true }) }, body));
export const posted = (body) => done(run({ posted_url: R.url(), posted_at: R.date() }, body, { partial: true }));
export const asset = (body) => done(run({ origin: R.oneOf(['own', 'listing'], { required: true }), shows: R.text(200) }, body, { partial: true }));
export const copy = (body) => done(run({ caption: R.text(2200), hashtags: R.text(500), pinned_comment: R.text(500) }, body, { partial: true }));
export function urls(body, max = 12) {
  const list = body?.urls;
  if (!Array.isArray(list) || !list.length) throw new Invalid({ urls: 'Pilih minimal satu foto.' });
  if (list.length > max) throw new Invalid({ urls: `Maksimal ${max} foto sekali simpan.` });
  return list.map((u) => { try { return R.url()(u); } catch (e) { throw new Invalid({ urls: `Link foto ${e}` }); } });
}
export const link = (body) => { try { const u = R.url()(body?.url); if (!u) throw 'wajib diisi.'; return u; } catch (e) { if (typeof e !== 'string') throw e; throw new Invalid({ url: `Link produk ${e}` }); } };
