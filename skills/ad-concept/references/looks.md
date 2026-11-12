# Looks

Plain-language guide for choosing the look. How each look is built and directed: the production
skill's `references/looks.md`.

`style` says how the film is produced (photos, footage, both). `look` says how it looks: fonts,
palette, chip and button shape, captions and how text enters. Any look works with any style.

| Look | Feels like | Fits | Avoid for |
|---|---|---|---|
| `classic` | Soft, polished beauty ad (the Dior Lip Glow film) | Anything, when nothing else fits | Products that need energy |
| `luxe-editorial` | Fashion magazine: Bodoni serif, ivory, slow and quiet | Fragrance, jewellery, premium beauty, fashion | Promotions, discounts, fast offers |
| `clean-clinical` | Dermatology clinic: one clean sans, white and teal, data | Skincare actives, pharmacy, supplements, oral and baby care | Fun, emotional or fashion products |
| `bold-streetwear` | Drop-day poster: black, huge capitals, acid lime, hard cuts | Sneakers, streetwear, energy drinks, fitness, gaming gear | Gentle, caring, premium-quiet products |
| `warm-organic` | Kitchen table: cream paper, soft serif, terracotta | Herbal and jamu, coffee, food, hair and body care, home | Tech and high-energy products |
| `tech-neon` | Launch keynote: dark grid, cyan glow, typed text | Gadgets, audio, apps, smart home | Natural, food, baby products |
| `pop-playful` | Snack aisle: chunky letters, pink and yellow, bouncy | Snacks, drinks, candy, toys, Gen-Z beauty | Luxury, health claims |
| `ugc-native` | Made in the app: TikTok Sans, outlined captions, sticker chips | `ugc` and `hybrid` with creator footage | `motion` films with no footage |

## Choosing
1. The user or `brief.md` names a look: use it. If it clashes with the product (e.g. `pop-playful`
   for a prescription-like claim), say so once and keep their choice.
2. Otherwise pick from the product category and the brand's tone in the table, and write the reason
   in the concept.
   - `ugc` films: `ugc-native` unless the brand insists on its own look.
   - The brand has strong colours: keep the look, its colours are replaced by the brand's.
3. Record it as `look:` in the concept's frontmatter. **Checkpoint:** show it with the hooks for
   approval. **Autopilot:** log `DECISION: look …`.

## How to switch
- Say it ("pakai look tech-neon") or set `look:` in `brief.md`.
- After approval: the agent edits `look:` in `concept.md`; the production skill changes one line in
  `scenes.json` and renders again. The script, timing and beat sheet stay; the look's pace and music
  suggestions may prompt small changes, which the agent lists before rendering.
