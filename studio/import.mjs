// import.mjs — best-effort product import from a link: Open Graph tags and JSON-LD Product data.
// Shop pages often refuse automated requests; the caller then falls back to the manual form.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from './db.mjs';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const decode = (s) => String(s ?? '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).trim();

export function assertHttpUrl(raw) {
  let u;
  try { u = new URL(String(raw).trim()); } catch { throw new Error('Link tidak valid.'); }
  if (!/^https?:$/.test(u.protocol)) throw new Error('Link harus http atau https.');
  const h = u.hostname;
  if (h === 'localhost' || h.endsWith('.local') || /^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) || h.includes(':')) {
    throw new Error('Link ke alamat lokal tidak diizinkan.');
  }
  return u;
}

function meta(html, key) {
  const tag = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, 'i').exec(html);
  return tag ? decode(/content=["']([^"']*)["']/i.exec(tag[0])?.[1]) : '';
}
const rupiah = (n) => (Number.isFinite(+n) && +n > 0 ? 'Rp' + Math.round(+n).toLocaleString('id-ID') : '');

function findProduct(node, depth = 0) {
  if (!node || depth > 6) return null;
  if (Array.isArray(node)) { for (const n of node) { const r = findProduct(n, depth + 1); if (r) return r; } return null; }
  if (typeof node !== 'object') return null;
  const type = [].concat(node['@type'] || []);
  if (type.includes('Product')) return node;
  return findProduct(node['@graph'], depth + 1) || findProduct(node.mainEntity, depth + 1);
}

export function parseProduct(html, baseUrl) {
  const fields = {}, images = [];
  const addImage = (u) => { try { const a = new URL(decode(u), baseUrl).href; if (/^https?:/.test(a) && !images.includes(a)) images.push(a); } catch { /* skip */ } };
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let p; try { p = findProduct(JSON.parse(m[1])); } catch { continue; }
    if (!p) continue;
    fields.name ||= decode(p.name);
    fields.description ||= decode(p.description);
    if (p.brand) fields.shop ||= decode(typeof p.brand === 'object' ? p.brand.name : p.brand);
    const offer = [].concat(p.offers || [])[0];
    if (offer) {
      const cur = offer.priceCurrency || 'IDR';
      const price = offer.price ?? offer.lowPrice;
      if (price != null) fields.price ||= cur === 'IDR' ? rupiah(price) : `${price} ${cur}`;
    }
    for (const i of [].concat(p.image || [])) addImage(typeof i === 'object' ? i.url : i);
  }
  fields.name ||= meta(html, 'og:title') || decode(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]);
  fields.description ||= meta(html, 'og:description') || meta(html, 'description');
  if (!fields.price) {
    const amt = meta(html, 'product:price:amount') || meta(html, 'og:price:amount');
    const cur = meta(html, 'product:price:currency') || meta(html, 'og:price:currency') || 'IDR';
    if (amt) fields.price = cur === 'IDR' ? rupiah(amt) : `${amt} ${cur}`;
  }
  for (const m of html.matchAll(/<meta[^>]+(?:property|name)=["']og:image(?::secure_url)?["'][^>]*>/gi)) {
    const c = /content=["']([^"']*)["']/i.exec(m[0])?.[1]; if (c) addImage(c);
  }
  for (const k of Object.keys(fields)) if (!fields[k]) delete fields[k];
  if (fields.name) fields.name = fields.name.replace(/\s*[|–-]\s*(TikTok Shop|TikTok|Tokopedia|Shopee[^|]*|Lazada[^|]*)\s*$/i, '').slice(0, 200);
  return { fields, images: images.slice(0, 12) };
}

const looksBlocked = (html, f) => !f.name || /captcha|verify you are human|access denied|security check|robot/i.test(html.slice(0, 20000)) && !f.description;

async function viaFetch(url) {
  const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000),
    headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml', 'accept-language': 'id-ID,id;q=0.9,en;q=0.6' } });
  assertHttpUrl(r.url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return { html: (await r.text()).slice(0, 4_000_000), finalUrl: r.url };
}

// Playwright is the production skill's dependency; used only if it is installed there.
async function viaBrowser(url) {
  const entry = join(ROOT, 'skills', 'vertical-product-ads', 'node_modules', 'playwright', 'index.mjs');
  if (!existsSync(entry)) throw new Error('Playwright belum terpasang');
  const { chromium } = await import(pathToFileURL(entry).href);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ userAgent: UA, locale: 'id-ID', viewport: { width: 1280, height: 900 } });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(2500);
    return { html: (await page.content()).slice(0, 4_000_000), finalUrl: page.url() };
  } finally { await browser.close(); }
}

export async function importProduct(rawUrl) {
  const url = assertHttpUrl(rawUrl).href;
  const tried = [];
  for (const [name, get] of [['fetch', viaFetch], ['browser', viaBrowser]]) {
    try {
      const { html, finalUrl } = await get(url);
      const parsed = parseProduct(html, finalUrl);
      if (!looksBlocked(html, parsed.fields)) return { ok: true, via: name, url: finalUrl, ...parsed, tried };
      tried.push(`${name}: halaman tidak memberi data produk (kemungkinan diblokir)`);
    } catch (e) { tried.push(`${name}: ${e.message}`); }
  }
  return { ok: false, url, fields: {}, images: [], tried };
}

export async function downloadImage(rawUrl) {
  const url = assertHttpUrl(rawUrl).href;
  const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'user-agent': UA } });
  assertHttpUrl(r.url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const type = (r.headers.get('content-type') || '').split(';')[0].trim();
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' }[type];
  if (!ext) throw new Error(`bukan gambar (${type || 'tipe tidak dikenal'})`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > 30 * 1024 * 1024) throw new Error('gambar terlalu besar');
  return { buf, ext };
}
