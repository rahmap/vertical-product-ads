# User guide

[Home](../README.md) · [Bahasa Indonesia](guide.id.md) · [Gallery](showcase.md) · [Technical reference](technical.md)

[Installation](#installation) · [Preparing material](#preparing-material) · [Workflow](#workflow) · [Voice and music](#voice-and-music) · [Rendering](#rendering)

## Installation

Install Node.js 20+, Python 3.9+ and FFmpeg/FFprobe first. On macOS, FFmpeg is available through
`brew install ffmpeg`; on Debian/Ubuntu, `apt install ffmpeg`.
[Full requirements](technical.md#requirements).

Install both skills:

```bash
npx skills add tomimandalaputra/vertical-product-ads --skill '*' -y
```

To choose skills and agents interactively, omit `--skill '*' -y`. To install only the concept skill,
use `--skill ad-concept`.

The installer prints the skill location. Claude Code commonly uses `.claude/skills/`; Codex and
many other agents use `.agents/skills/`. Set `SKILL` to the actual production skill folder:

```bash
SKILL=".claude/skills/vertical-product-ads"
"$SKILL/scripts/check_setup.sh" --with all
```

Setup checks dependencies and installs missing Chromium, numpy and the selected extras:

| Command | Includes |
|---|---|
| `check_setup.sh` | Core rendering and audio dependencies |
| `check_setup.sh --with edge` | Core + edge-tts voice-over |
| `check_setup.sh --with whisper` | Core + local faster-whisper transcription |
| `check_setup.sh --with all` | All of the above |

## Preparing material

Keep each ad in its own folder, outside the installed skills:

```text
ads/my-product/
  brief.md
  assets/
```

Copy the [brief template](../skills/ad-concept/templates/brief.md), or give the same information in
your prompt: product name and variants, price if needed, supported claims and sources, exact CTA,
audience, platform and asset location. The agent can write `brief.md` from your prompt.

| Style | Material to provide |
|---|---|
| `motion` | Product photos. For photo-led ads, aim for at least three angles, a white or transparent background and a short side of at least 2000 px. |
| `ugc` | Creator footage with speech: vertical 1080×1920 at 30 fps, clean audio, no background music. Add short b-roll clips and an end-card packshot if available. |
| `hybrid` | Footage plus product photos or graphic scenes. Use creator speech, or provide muted product b-roll for a voice-over edit. |

A logo, brand colours, texture close-ups and one photo per variant help. Obtain permission for
people and third-party assets. Before/after images, ratings and testimonials must be real.
The skills do not generate product photography or AI presenters.

For a shoot, use the [creator shot list](../skills/ad-concept/templates/creator-shot-list.md).
Detailed asset specs: [intake reference](../skills/ad-concept/references/intake.md).
Filled fictional briefs: [motion](../skills/ad-concept/examples/brief-motion.md),
[UGC](../skills/ad-concept/examples/brief-ugc.md), [hybrid](../skills/ad-concept/examples/brief-hybrid.md).

## Workflow

1. Ask the agent to create an ad from your project folder.
2. `ad-concept` researches the product, proposes three hooks, and writes the script and scene plan.
3. Approve or revise `concept.md`.
4. `vertical-product-ads` prepares audio, animation and a draft with a contact sheet.
5. Review the draft. The agent fixes issues, then renders the final MP4 and storyboard.

| Mode | How it behaves |
|---|---|
| Checkpoint, the default | Stops for concept approval before production. |
| Autopilot | Chooses the hook and continues without waiting. Logs assumptions and decisions in `concept.md`. Start the prompt with “Autopilot” or put `mode: autopilot` in the brief. |

Production requires an approved `concept.md` in either mode. Autopilot does not create missing
creator footage or establish permission to use assets.

Example request:

> Create a 30-second TikTok ad from `ads/my-product`, using `brief.md` and `assets/`.
> Use hybrid style, the warm-organic look, and a split screen for the product comparison.
> Use only the claims and sources in the brief. Show me the concept before production.

After seeing the concept, you can say “Use hook #2, but leave out the price.” After preview,
request a specific revision, such as “The claim at 18 s is too small; enlarge it and render again.”
[Full prompt collection](../skills/ad-concept/examples/prompts.md).

### Style, look and layout

| Setting | Decides | Examples |
|---|---|---|
| `style` | How the ad uses photos, footage and speech | `motion`, `ugc`, `hybrid` |
| `look` | Fonts, colours, captions and visual treatment | `luxe-editorial`, `warm-organic`, `ugc-native` |
| Layout | How a scene arranges its pictures and text | Split screen, collage, phone, callouts |

Set `style:` and `look:` in the brief or name them in your prompt. The agent picks two to four
layouts per film and records them in the scene plan. Brand colours can override a look; the
contrast check still applies. Changing an approved concept in checkpoint mode requires approval again.

[Visual catalogue](showcase.md#looks-and-layouts) ·
[Look direction](../skills/vertical-product-ads/references/looks.md) ·
[Layout recipes](../skills/vertical-product-ads/references/layouts.md)

### Duration

The default is 30 seconds; production ads must be 15–60 seconds. Above 34 seconds, the concept
must explain the length. The hook belongs in the first three seconds; the CTA holds for three to
five seconds. Reels cutdowns are separate projects. TikTok Shop affiliate videos
(`objective: affiliate` in the brief) default to 45 seconds and may run to 60 without that note.
[Platform guidance and sources](../skills/ad-concept/references/duration-and-platforms.md).

## Voice and music

ElevenLabs is optional. A film can use the free options below, but review each service's terms
before using its output in paid advertising.

| Part | ElevenLabs | Free or local option |
|---|---|---|
| Voice-over | `vo.engine: "elevenlabs"` | `vo.engine: "edge"`, through edge-tts; needs internet |
| Music | `music.prompt` | `music.synth`, or your licensed music file |
| Sound effects | Prompted `sfx` | Built-in synthesized cues or your own files |
| Footage transcription | `dialogue.transcriber: "elevenlabs"` | `"whisper"`, through faster-whisper; runs offline |

`"auto"` transcription uses ElevenLabs when available, otherwise local Whisper.
Local music and synthesized cues are generated on your machine. ElevenLabs output follows your
plan's terms. edge-tts is an unofficial client of Microsoft's Edge read-aloud service; its terms
for commercial reuse are unclear. Prefer it for drafts unless you have resolved those terms.

### ElevenLabs API key

Never paste a key into agent chat or a prompt. Create it in the ElevenLabs dashboard with the
service permissions you need, then run this yourself in your workspace terminal:

```bash
"$SKILL/scripts/set_key.sh"
```

The script uses hidden input, saves the key to `.env` with mode `600`, and adds `.env` to
`.gitignore`. `check_setup.sh` reports the key's location, not its value, and warns about unsafe
permissions or missing ignore rules. Tools load it from the environment or the nearest `.env`;
the agent must not read or print it. If a key appeared in chat, revoke it and create another.

## Rendering

The agent normally runs these steps. For a manual pipeline check, copy the asset-free example:

```bash
cp -r "$SKILL/examples/minimal" my-ad
"$SKILL/scripts/make.sh" my-ad preview
```

Review `my-ad/snaps/sheet.png` and `my-ad/renders/draft.mp4`, then render:

```bash
"$SKILL/scripts/make.sh" my-ad final my-ad/out.mp4
```

The minimal example is an 8.5-second pipeline smoke demo, not a production-length ad. It requires
no product assets or API key.

For your own ad, replace `my-ad` with its project folder. Preview builds a contact sheet and a
half-size draft with sound; final produces the full MP4 and a storyboard. Failed quality checks
stop the build. Watch the final video and listen to its audio before publishing.

[Quality checks and limitations](technical.md#quality-checks) ·
[Production reference](../skills/vertical-product-ads/references/render-and-qa.md)

## Studio (local web app)

`studio/` is a single-user web app for TikTok Shop affiliate work: a product form (paste a link to
prefill it, then correct it), asset uploads, a video queue, preview review and an archive of the
finished files. It needs Node 22.5 or newer (built-in SQLite) and no extra packages.

```bash
node studio/server.mjs            # http://127.0.0.1:4173
```

1. **Product:** paste the product link and choose "Ambil data", or fill the form by hand. Shop pages
   often refuse automated requests; the manual form always works.
2. **Assets:** upload your own clips and photos, mark each as own or from the listing, and describe
   what each clip shows (the agent cannot watch video).
3. **Queue a video:** pick 30, 45 or 60 seconds and a look.
4. **Build:** in Claude Code, at the repository root, type `/affiliate-queue`. It writes the concept
   and scenes and renders a draft.
5. **Review:** watch the draft on the video's page; approve it or send a revision note, then run
   `/affiliate-queue` again for the final render or the revision.
6. **Post:** download the MP4, copy the caption and hashtags, and record the link and results.

Settings live in `.env` at the repository root: copy `.env.example`, then fill in `ELEVENLABS_API_KEY`
(and, if you like, `STUDIO_PORT` and `STUDIO_DATA`). Everything is stored in `data/` (git-ignored): `studio.db`, `products/`, `projects/` and `videos/`.
The server listens on 127.0.0.1 only and has no accounts; do not expose it to a network.
