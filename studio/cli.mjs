#!/usr/bin/env node
// cli.mjs — the agent's side of the studio queue. Prints JSON.
//   node studio/cli.mjs next                      the job to work on now (or {"job": null})
//   node studio/cli.mjs list [status]             all videos, or those with one status
//   node studio/cli.mjs show <id>                 one video with its product, paths and revision note
//   node studio/cli.mjs status <id> <status> [message]
//   node studio/cli.mjs note <id> <message>       add a line to the video's log
//   node studio/cli.mjs copy <id> --caption "…" --hashtags "#a #b" --pinned "…"
//   node studio/cli.mjs attach <id> <final.mp4>   record the final render (copies it into data/videos/ if elsewhere)
const warn = process.emitWarning;
process.emitWarning = (w, ...a) => (String(w?.message ?? w).includes('SQLite') ? undefined : warn.call(process, w, ...a));
const fs = await import('node:fs');
const { join, relative, resolve } = await import('node:path');
const D = await import('./db.mjs');
const { writeProject } = await import('./brief.mjs');
const V = await import('./validate.mjs');
const { db } = D;

const [cmd, ...args] = process.argv.slice(2);
const out = (o) => console.log(JSON.stringify(o, null, 2));
const fail = (m) => { console.error(m); process.exit(1); };
const get = (id) => D.video(Number(id)) || fail(`no video with id ${id}`);

function job(v) {
  const dir = D.projectDir(v);
  const p = D.product(v.product_id);
  return { id: v.id, slug: v.slug, title: v.title, status: v.status, product: p.name,
    duration: v.duration, look: v.look, style: v.style, concept_review: !!v.concept_review,
    revision_note: v.revision_note || null,
    project: dir, brief: join(dir, 'brief.md'), concept: fs.existsSync(join(dir, 'concept.md')) ? join(dir, 'concept.md') : null,
    scenes: fs.existsSync(join(dir, 'scenes.json')) ? join(dir, 'scenes.json') : null,
    final_out: join(D.DIRS.videos, `${v.slug}.mp4`),
    what_to_do: { antre: 'write the concept, build the scenes, run the preview, then set status preview',
      revisi: 'apply revision_note to concept/scenes, run the preview again, then set status preview',
      disetujui: 'the user approved the preview: render the final to final_out, save the post copy, attach' }[v.status] || null };
}

switch (cmd) {
  case 'next': {
    // finish what is closest to done first: approved previews, then revisions, then new jobs (oldest first)
    const v = ['disetujui', 'revisi', 'antre'].map((s) => db.prepare('SELECT id FROM videos WHERE status = ? ORDER BY updated_at, id LIMIT 1').get(s)).find(Boolean);
    const waiting = db.prepare("SELECT status, COUNT(*) AS n FROM videos WHERE status IN ('antre','revisi','disetujui','konsep','preview') GROUP BY status").all();
    out({ job: v ? job(D.video(v.id)) : null, waiting });
    break;
  }
  case 'list': {
    const rows = args[0] ? db.prepare('SELECT id FROM videos WHERE status = ? ORDER BY updated_at').all(args[0]) : db.prepare('SELECT id FROM videos ORDER BY updated_at DESC').all();
    out(rows.map((r) => { const v = D.video(r.id); return { id: v.id, slug: v.slug, status: v.status, product: v.product_name, duration: v.duration, updated_at: v.updated_at }; }));
    break;
  }
  case 'show': { const v = get(args[0]); out({ ...job(v), product_row: D.product(v.product_id), assets: D.productAssets(v.product_id), events: D.videoEvents(v.id).slice(0, 15) }); break; }
  case 'status': {
    const v = get(args[0]);
    if (!args[1]) fail(`usage: status <id> <${D.STATUSES.join('|')}> [message]`);
    try { D.setStatus(v.id, args[1], args.slice(2).join(' ')); } catch (e) { fail(e.message); }
    if (args[1] === 'antre') writeProject(D.video(v.id));
    out(job(D.video(v.id)));
    break;
  }
  case 'note': { const v = get(args[0]); D.log(v.id, 'note', args.slice(1).join(' ')); out({ ok: true }); break; }
  case 'copy': {
    const v = get(args[0]);
    const flag = (n) => { const i = args.indexOf(`--${n}`); return i < 0 ? undefined : args[i + 1]; };
    const row = {};
    for (const [f, col] of [['caption', 'caption'], ['hashtags', 'hashtags'], ['pinned', 'pinned_comment']]) if (flag(f) !== undefined) row[col] = flag(f);
    if (!Object.keys(row).length) fail('usage: copy <id> --caption "…" --hashtags "…" --pinned "…"');
    try { D.update('videos', v.id, V.copy(row), D.VIDEO_FIELDS); } catch (e) { fail(e.message); }
    D.log(v.id, 'copy', 'caption/hashtag disimpan');
    out({ ok: true, ...row });
    break;
  }
  case 'attach': {
    const v = get(args[0]);
    const src = resolve(args[1] || fail('usage: attach <id> <final.mp4>'));
    if (!fs.existsSync(src) || fs.statSync(src).size < 1000) fail(`not a rendered file: ${src}`);
    const dst = join(D.DIRS.videos, `${v.slug}.mp4`);
    if (src !== dst) fs.copyFileSync(src, dst);
    const sbSrc = src.replace(/\.mp4$/, '_storyboard.png'), sbDst = dst.replace(/\.mp4$/, '_storyboard.png');
    if (fs.existsSync(sbSrc) && sbSrc !== sbDst) fs.copyFileSync(sbSrc, sbDst);
    db.prepare("UPDATE videos SET final_path = ?, storyboard_path = ?, revision_note = NULL, updated_at = datetime('now') WHERE id = ?")
      .run(relative(D.DATA, dst), fs.existsSync(sbDst) ? relative(D.DATA, sbDst) : null, v.id);
    D.setStatus(v.id, 'final', `${(fs.statSync(dst).size / 1e6).toFixed(1)} MB`);
    out(job(D.video(v.id)));
    break;
  }
  default:
    fail('usage: node studio/cli.mjs next | list [status] | show <id> | status <id> <status> [message] | note <id> <message> | copy <id> --caption … | attach <id> <final.mp4>');
}
