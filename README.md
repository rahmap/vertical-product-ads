# vertical-product-ads

Create 9:16 product ads for TikTok, Reels and Shorts from photos or creator footage, using your coding agent.

These installable skills handle the concept, script, voice, music, animation and MP4 render.
They run inside your agent, not a standalone video editor.

[Bahasa Indonesia](README.id.md) · [Gallery](docs/showcase.md) · [User guide](docs/guide.md)

## The two skills

- `ad-concept` plans the hook, script and scenes for your approval.
- `vertical-product-ads` builds the approved concept, checks a preview and exports the final MP4.

Use them together, or install either one. They work with agents that support `SKILL.md`,
including Claude Code, Codex, Cursor, Amp and Cline.

## Example output

The same creator-shot footage, rendered in eight looks with picture-in-picture, split screens,
collage and product callouts. Click the preview for the full video with sound.

<a href="media/ugc-layouts.mp4"><img src="media/ugc-layouts.gif" width="720" height="696" alt="Eight versions of a ginger-shampoo ad, showing how each look changes typography, colour, captions and layout styling"></a>

Footage by [@hanie.ugc.creator](https://www.tiktok.com/@hanie.ugc.creator/video/7467561053971369223),
used with permission. This is b-roll with voice-over, not creator dialogue.
[See all examples, looks and layouts](docs/showcase.md).

## Quick start

You need Node.js 20+, Python 3.9+ and FFmpeg. [Setup details](docs/guide.md#installation).

**1. Install both skills.**

```bash
npx skills add tomimandalaputra/vertical-product-ads --skill '*' -y
```

**2. Run setup once.** Use the skill path printed by the installer:

```bash
SKILL=".claude/skills/vertical-product-ads"  # Codex: .agents/skills/vertical-product-ads
"$SKILL/scripts/check_setup.sh" --with all
```

**3. Put your brief and assets in a project folder, then ask your agent:**

> Create a 30-second TikTok product ad from `ads/my-product`.
> Product details and approved claims are in `brief.md`; photos are in `assets/`.
> Use the warm-organic look and free audio for the draft.
> Show me the concept before starting production.

The agent prepares the concept, then produces a preview and final MP4 after approval.
For hands-off production, start the prompt with **Autopilot**.

[Brief template](skills/ad-concept/templates/brief.md) ·
[More prompts](skills/ad-concept/examples/prompts.md)

## What you can make

| Style | Starting material |
|---|---|
| Motion | Product photos, animated text and graphics |
| UGC | Creator footage with its original speech and captions |
| Hybrid | Footage combined with motion graphics, using creator speech or voice-over |

Choose from eight looks, from editorial to creator-native. Layouts include split screen,
grids, collage, picture-in-picture, phone frames and callouts.
The [gallery](docs/showcase.md#looks-and-layouts) shows the differences.

ElevenLabs is optional. Local music and sound effects are available; free voice uses edge-tts,
whose commercial-use terms are unclear. See [audio options](docs/guide.md#voice-and-music).

## Studio (local web app)

A web app for the TikTok Shop affiliate video queue: products, assets, preview review and finished files.
Needs Node.js 22.5+. Run it from the repository root:

```bash
node studio/server.mjs              # http://127.0.0.1:4173
node studio/server.mjs --port 4174  # if port 4173 is already in use
```

[Using the Studio](docs/guide.md#studio-local-web-app)

## Documentation

| Read | For |
|---|---|
| [User guide](docs/guide.md) | Setup, preparing assets, approvals, audio and rendering |
| [Gallery](docs/showcase.md) | Finished ads, look comparisons, layout demos and credits |
| [Technical reference](docs/technical.md) | Quality checks, limitations, measured speed and repository structure |

## Licence

The skills are [MIT-licensed](LICENSE); bundled fonts use the SIL Open Font License.
Showcase media and third-party assets have separate terms. Attribution, including the motion
techniques adapted from product-launch-motion: [NOTICE](NOTICE).
