# Intake: what to collect

Check every item against the brief and `assets/`. **Required** items block the concept (checkpoint:
ask; autopilot: assume and log `ASSUMPTION:`). **Recommended** items improve the film; say what is
lost if absent. **Optional** items add authenticity.

- **A file that exists but fails its spec counts as missing** (e.g. a packshot with baked-in text, or
  one under 2000 px). Leave it out of the film unless the user supplies a clean version, and say so.
- **A blank field in `brief.md`** (e.g. `style:`, `duration:`) means "agent decides": choose from the
  assets and the rules, log `DECISION:`. Do not ask about it.
- **The brief and an official source disagree** (e.g. number of shades): put both in the claims
  table, show neither on screen until the user confirms, and ask in the same message.

## Required
| Item | Spec | Why |
|---|---|---|
| Product photos | ≥ 3 angles; ≥ 2000 px on the short side; on white or transparent background; **no baked-in text or badges** | The engine crops full-bleed and zooms; small or lettered images blur or show text that clashes. Small crops can be upscaled but never gain detail |
| Product info | Name, variants, what it is, price (or "no price"), where it is sold | Script and on-screen text |
| Claims and their source | Each claim as one sentence + where it comes from (label, test report, official page) | Every on-screen claim carries a footnote; no source, no claim |
| Objective and CTA | Sales / traffic / awareness / launch; the exact action ("klik keranjang kuning", "link di bio", code `HEMAT20`) | Decides the ending and the hook |
| Audience and platform | Who, in one sentence; TikTok / Reels / Shorts | Decides tone, hook, length |

## Recommended
| Item | Spec | Why |
|---|---|---|
| Logo | PNG/SVG with transparent background | End card |
| Brand colours and font | Hex codes; font name (or "none") | Theme; otherwise an OFL font is chosen |
| Texture / application close-ups | Photos or footage of the texture, swatch, pour, application. Photos ≥ 1600 px on the short side (they fill a band or the full frame; smaller ones are upscaled and lose detail) | Sensory scenes; hard to fake |
| Reference ads | 1–3 links or descriptions of ads they like | You cannot watch them: ask what they like in words |
| Voice preference | Female/male, tone, ElevenLabs or free (edge-tts) | Audio plan |
| Music preference | Licensed file, ElevenLabs prompt, or free synth bed | Audio plan |

## Optional (only if real)
| Item | Spec | Why |
|---|---|---|
| Real before/after | Same angle, light, framing; date span; permission from the person | Strongest proof; invented ones are refused |
| Real ratings and testimonials | Screenshot or quoted text with source and date; permission to quote | Social-proof hook; never invent |
| Awards, certifications | Number or name, issuer | Footnote required |

## Footage (needed for `ugc` and `hybrid`)
| Spec | Value |
|---|---|
| Orientation / size | 9:16, 1080×1920 (or higher, same ratio) |
| Frame rate | 30 fps (variable-frame-rate phone clips are converted to constant) |
| Audio | Clean, close to the mouth, no music baked in, no room echo; a quiet room beats a noisy one |
| Speech | Spoken in the language of the ad; one idea per take; short pauses between takes make cutting easier |
| Length | A few clips of 5–40 s; every clip is a named file under `assets/` |
| Light | Face and product clearly lit; no heavy filter |
| Release | Written permission from every person on camera for paid ads, and from the owner of any third-party brand visible |

Limits to tell the user: b-roll (clips without speech) is muted in the mix; the engine does not
generate presenters or avatars; the transcript comes from speech recognition and may need
proofreading (the production skill does this with the user's help).

## Asking in one message (checkpoint)
Group the missing items by Required / Recommended, one line each with its spec, and end with the
choices you will otherwise assume. Do not ask what the files already answer.
