---
name: affiliate-queue
description: Work through the studio's video queue for this repository — turn queued TikTok Shop affiliate jobs (created in the local studio web app) into previews, apply requested revisions, and render approved previews to final MP4s. Use when the user types /affiliate-queue, or asks to "kerjakan antrean", process the queue, or make the queued affiliate videos.
---

# Affiliate queue

The studio (`studio/`, a local web app over SQLite) is where the user enters products, uploads
assets, queues videos, reviews previews and keeps the finished files. You are the worker: you take
jobs from its queue and build them with the two skills in this repository,
`skills/ad-concept` and `skills/vertical-product-ads`. Run every command from the repository root.

## Loop
1. `node studio/cli.mjs next`. `job: null` → tell the user the queue is empty (and what is waiting
   on them: `preview` jobs need their decision in the studio) and stop.
2. Do the job by its `status` (below). Each job has its own `project` folder; never work in another
   job's folder, and never edit `brief.md` (the studio rewrites it).
3. After finishing one job, run `next` again and continue until the queue is empty or a job is
   blocked. One job failing does not stop the others: note why
   (`node studio/cli.mjs note <id> "<why>"`), leave its status, go on.
4. End with a short report per job: what was made, what the user must do next in the studio
   (`http://127.0.0.1:4173`), and any reminder from the concept (price check, AI label, rights).

## `antre` — a new video
1. `node studio/cli.mjs status <id> konsep "mulai"`.
2. Read `skills/ad-concept/SKILL.md` and `skills/ad-concept/references/affiliate.md`, then run the
   concept workflow on `<project>` (its `brief.md` has `objective: affiliate`). Asset descriptions
   and origins (`own` / `listing`) are in the brief's asset table; you cannot watch footage, so rely
   on those descriptions, the clip lengths in `build/footage.json` after `footage.py`, and snaps.
   - `mode: autopilot` (default): decide, log `DECISION:`/`ASSUMPTION:`, approve the concept yourself.
   - `mode: checkpoint`: write the concept, set `node studio/cli.mjs status <id> preview
     "konsep menunggu persetujuan"`, tell the user to read it on the video's page, and move on. It
     comes back as `revisi` (changes) or `disetujui` (approved: then build the film, and return it
     to `preview` when the draft exists rather than rendering a final nobody has seen).
3. Read `skills/vertical-product-ads/SKILL.md` and build `<project>/scenes.json` up to and
   including its preview and review steps (`scripts/make.sh <project> preview`). The draft must be
   `<project>/renders/draft.mp4`: the studio plays that file.
4. `node studio/cli.mjs status <id> preview "draft siap"`. Do **not** render the final: the user
   approves in the studio first.

## `revisi` — the user asked for changes
`revision_note` is the request. Change the concept first if the note changes the script, hook,
length or claims; then the scenes; run the preview and its review again; set `preview` with a
one-line summary of what changed. Words changed → `vo.py` again → every `w<i>` rechecked.

## `disetujui` — the preview is approved
1. No `renders/draft.mp4` yet (a checkpoint concept was approved): build as in `antre` step 3–4.
2. Otherwise `skills/vertical-product-ads/scripts/make.sh <project> final <final_out>`
   (`final_out` is in the job). Every gate must pass; look at the `_storyboard.png`.
3. Save the post copy from the concept:
   `node studio/cli.mjs copy <id> --caption "…" --hashtags "#… #…" --pinned "…"`.
4. `node studio/cli.mjs attach <id> <final_out>` (sets `final`).

## Rules
- The production skills' non-negotiables apply unchanged: safe zones, claim footnotes, no bypassed
  gate, no invented product facts, credentials never in the chat.
- Prices, promos and claims come only from the brief. A promo whose end date has passed is not
  shown; say so in the note.
- A missing tool (ffmpeg, the ElevenLabs key) blocks rendering: say exactly what to run
  (`sudo apt install ffmpeg`; the key goes in the repository's `.env`, a copy of `.env.example`, which
  the user fills in themselves, or via `skills/vertical-product-ads/scripts/set_key.sh`; never read
  or print `.env`) and leave the job in
  its status. With no key the free options (edge-tts, synth music) are allowed only if the user
  agrees: the brief asks for ElevenLabs.
- Other commands: `list [status]`, `show <id>` (product row, assets, recent log).
- The studio server does not need to be running for the CLI to work; to start it for the user:
  `node studio/server.mjs`.
