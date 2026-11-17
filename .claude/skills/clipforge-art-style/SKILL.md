---
name: clipforge-art-style
description: Improve, tune or add an art style in ClipForge AI (this repo) — e.g. "Madhubani paintings come out grey", "make Warli look more authentic", "add a Kalighat / Pattachitra / pixel-art / watercolour style", "the style thumbnails look wrong". Covers the style's Stable Diffusion wording (prompt modifier, negative prompt, colour hint), its art-direction JSON, the vector/Remotion renderer registration, picker thumbnails, and a paint-test loop to prove it. Use when the user wants better or more accurate results for a particular style, or a new style. Not for making a video (use clipforge-director).
---

# ClipForge art styles

A style has two halves:

- **Painting (Stable Diffusion)** — how AI paintings look. Lives in data, quick to tune.
- **Drawing (vector / Remotion)** — titles, banners, frames, procedural scenes and colour filters. Lives in code; only needed for a brand-new style.

Test helper (server must be running): `node .claude/skills/clipforge-director/scripts/cf.mjs paint --style <id> --prompt "<subject>" --aspect 16:9 --seed 11`, then open the PNG with the Read tool.

## A. Tune an existing style (most requests)

1. **Reproduce.** Paint 2–3 typical subjects for the style (people, a place, an object) with a fixed seed. Look at each picture and name exactly what's wrong: colours, lost subject, wrong medium, painted text, modern look.
2. **Edit the wording** in `scripts/data/art-style-presets.json` → `styles.<id>`:
   | Field | Use it for |
   |---|---|
   | `prompt_modifier` | the medium and technique, in concrete words ("rice-paste white lines on red ochre mud wall") |
   | `negative_modifier` / `negative_prompt` | what keeps creeping in ("photorealism, 3D, gradients") |
   | `sd_hint` | a short colour/layout cue placed right after the subject — the strongest lever when colours drift (Madhubani grey → "vivid vermilion red, turmeric yellow…") |
   | `sd_negative` | a few words against the specific drift ("monochrome, greyscale") |
   Prompt order is built by `buildSdPrompt()` in `src/artstyles/prompt.ts`: `<Label> illustration of <subject>`, hint, characters, modifier, lighting, textures. Stable Diffusion weights the start most; keep hints short.
3. `npm run artstyles` to rebuild `src/artstyles/<id>.json`, then **repaint the same subjects with the same seed** and compare. Iterate until 3 subjects in a row look right. Change one thing at a time.
4. If thumbnails should change: `npm run thumbs:ai -- <id>` (subjects in `scripts/gen-style-thumbs-ai.ts`).
5. Art-direction text (look, palette roles, motifs, motion suggestions, do's and don'ts) lives in the `D` table of `scripts/gen-art-style-specs.ts`; rebuild with `npm run artstyles`. The script fails if a suggested motion id doesn't exist.

## B. Add a new style

Write all wording yourself. Do not copy prompts or style text from other projects unless their licence allows commercial use (for example, Lemo-Opuscar's style prompts are CC BY-NC — inspiration only).

Pick an id in camelCase (e.g. `pattachitra`). Then register it everywhere — every list below must include it or something breaks:

| File | What to add |
|---|---|
| `scripts/data/art-style-presets.json` | `styles.<id>`: all fields like the existing entries, plus `sd_hint` if needed |
| `scripts/gen-art-style-specs.ts` | `D.<id>` art direction (family, origin, history, palette with roles, line, characters, environment, motion ids) |
| `src/remotion/artStyles.tsx` | `ArtStyleId` union, `ART_STYLES.<id>` (font, title/banner colours, titlePos), `styleLook` filters, `SCENES.<id>` and `BORDERS.<id>` (a simple procedural scene + border; copy the pattern of a similar style) |
| `src/editor/catalog.ts` | `ART_STYLE_OPTIONS`, `ART_STYLE_LABELS`, `STYLE_INFO` |
| `src/editor/LibraryPanel.tsx` | `ART_SWATCH.<id>` (4 colours) |
| `server/scriptVideo.ts` | `STYLE_ACCENT.<id>`; add to `BORDER_STYLES` if it has a signature frame |
| `src/assetkit/paint.ts` | palette + `case` for re-colouring library assets |
| `server/editAI.ts` | the ART STYLES list in the prompt |
| `scripts/gen-prompts.ts` | `BASE_STYLES` entry (prompts for outside image tools) |
| `scripts/gen-style-thumbs-ai.ts` | `SUBJECTS.<id>` — the subject the style is best at |

Then:

1. `npm run artstyles` (must print 15+ specs, no "unknown effect id" errors) and `npx tsc --noEmit`.
2. Paint-test loop from section A until 3 subjects look right.
3. `npm run thumbs:ai -- <id>` and look at both thumbnails.
4. Make one short test video with the clipforge-director skill (3 scenes, AI illustration) and check the stills: title banner font and colours, transitions, atmosphere.
5. Update `docs/site/art-styles.md` (table row) and the style count in `README.md`.

## Quality bar

- The **subject survives**: people and objects from the prompt are clearly there (pattern-heavy styles lose them first — fix with the `<Label> illustration of <subject>` order and a short `sd_hint`).
- **Colours match the tradition**, not a generic "painting".
- **No painted text**, logos or watermarks; hands and faces acceptable at thumbnail size.
- **Same seed, same look**: two subjects with the same seed should feel like one series.
- Respect the culture: for living traditions (Warli, Madhubani, Gond, Pattachitra…) describe the real motifs and medium correctly and avoid religious misuse.
