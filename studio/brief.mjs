// brief.mjs — turn a product + video row into an ad project the skills can build:
//   data/projects/<slug>/brief.md   (the ad-concept skill's brief template, filled from the database)
//   data/projects/<slug>/assets/    copies of the product's files
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { product, productAssets, productDir, projectDir, setting } from './db.mjs';
import { discount, rupiah } from './validate.mjs';

const v = (s) => (s == null || s === '' ? '' : String(s).trim());
const lines = (s) => v(s).split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
const cell = (s) => v(s).replace(/\|/g, '/').replace(/\s*\n\s*/g, ' ');

export function briefMarkdown(p, assets, vid) {
  const own = assets.filter((a) => a.origin === 'own').length;
  const hasVideo = assets.some((a) => a.kind === 'video');
  const claims = (p.claims || []).filter((c) => v(c.claim));
  const out = [];
  out.push('# Brief', '', 'Written by the studio from its database. Edit the product in the studio, not this file:',
    'it is rewritten whenever the video is queued again.', '', '```yaml',
    `mode: ${vid.concept_review ? 'checkpoint' : 'autopilot'}`,
    `style: ${v(vid.style) || (hasVideo ? 'hybrid' : 'motion')}`,
    `look: ${v(vid.look) || 'ugc-native'}`, 'platform: tiktok', `duration: ${vid.duration || 45}`,
    'language: id', 'objective: affiliate', '```', '',
    '## Product — Produk',
    `- Name — nama produk: ${v(p.name)}`,
    `- Variants (shades, sizes) — varian: ${v(p.variants)}`,
    `- What it is, in one sentence — apa ini: ${v(p.what)}`,
    `- Price and where to buy — harga dan tempat beli: ${rupiah(p.price)}${p.shop ? ` — ${v(p.shop)}` : ''} (TikTok Shop, keranjang kuning)`,
    `- Product link — link produk: ${v(p.url)}`,
    `- Was-price (if any) — harga coret: ${rupiah(p.was_price)}${discount(p.price, p.was_price) ? ` (diskon ${discount(p.price, p.was_price)}%, computed from the two prices)` : ''}`,
    `- Promo and its end date — promo dan tanggal berakhir: ${[v(p.promo), v(p.promo_end)].filter(Boolean).join(' — sampai ')}`,
    `- Have you used it yourself? For how long? — sudah pakai sendiri? berapa lama: ${v(p.used_it)}`,
    `- One honest limitation — satu kekurangan jujur: ${v(p.honest_note)}`, '');
  if (lines(p.selling_points).length) out.push('### Selling points — poin jual', ...lines(p.selling_points).map((s) => `- ${s}`), '');
  if (v(p.description)) out.push('### Seller description — deskripsi penjual (source for "Menurut deskripsi penjual" footnotes)', '', '```', v(p.description), '```', '');
  out.push('## Objective and CTA — Tujuan dan ajakan',
    '- Objective — tujuan: affiliate (TikTok Shop)',
    '- Exact CTA — ajakan persis: "Klik keranjang kuning"', '',
    '## Audience — Target',
    `- Who, in one sentence — siapa target: ${v(p.audience)}`,
    `- Their main problem or wish — masalah/keinginan utama: ${v(p.problem)}`, '',
    '## Claims — Klaim', '| Claim — klaim | Source — sumber |', '|---|---|',
    ...(claims.length ? claims.map((c) => `| ${cell(c.claim)} | ${cell(c.source) || 'deskripsi penjual'} |`) : ['| | |']), '',
    '## Assets — Aset',
    `${assets.length} file(s), ${own} recorded by the user (own), ${assets.length - own} from the listing.`, '',
    '| File | Shows — isi | Origin — asal | Kind |', '|---|---|---|---|',
    ...(assets.length ? assets.map((a) => `| assets/${a.file} | ${cell(a.shows)} | ${a.origin} | ${a.kind} |`) : ['| | | | |']), '',
    '## Audio — Suara dan musik',
    `- Voice — suara: ElevenLabs${v(vid.voice) || setting('STUDIO_VOICE') ? `, voice id ${v(vid.voice) || setting('STUDIO_VOICE')}` : ', conversational Indonesian voice'}`,
    '- Music — musik: low bed under the voice (ElevenLabs prompt, or the free synth if no key)', '',
    '## Notes — Catatan');
  if (v(vid.angle)) out.push(`- Hook angle asked for — sudut hook: ${v(vid.angle)}`);
  if (v(vid.notes)) out.push(`- For this video — untuk video ini: ${v(vid.notes)}`);
  if (v(p.notes)) out.push(`- About the product — tentang produk: ${v(p.notes)}`);
  if (v(vid.revision_note)) out.push('', '## Revision requested — Revisi diminta', v(vid.revision_note));
  return out.join('\n') + '\n';
}

// Writes brief.md and syncs assets/ (adds new files, removes ones deleted in the studio). Returns the project dir.
export function writeProject(vid) {
  const p = product(vid.product_id);
  const assets = productAssets(p.id);
  const dir = projectDir(vid);
  const dst = join(dir, 'assets');
  mkdirSync(dst, { recursive: true });
  const keep = new Set(assets.map((a) => a.file));
  for (const f of readdirSync(dst)) if (!keep.has(f) && !f.startsWith('.')) rmSync(join(dst, f), { recursive: true, force: true });
  for (const a of assets) {
    const src = join(productDir(p), 'assets', a.file);
    if (existsSync(src)) cpSync(src, join(dst, a.file), { force: true });
  }
  writeFileSync(join(dir, 'brief.md'), briefMarkdown(p, assets, vid));
  return dir;
}
