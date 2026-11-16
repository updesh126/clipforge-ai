# Procedural vector engine

ClipForge draws every story character and place **at runtime as SVG**, then exports a transparent PNG. There are no stock PNGs and no diffusion models, and it needs no GPU. It runs on a 16 GB RAM / 6 GB VRAM laptop: rendering uses the CPU through sharp/librsvg. The only GPU user is Ollama, called once per story.

```
story text ──Qwen (Ollama)──▶ cast specs + place specs ──▶ src/vector (pure TS → SVG) ──▶ sharp → PNG (cached) ──▶ Remotion timeline
```

## Modules (`src/vector/`)

| File | What it does |
|---|---|
| `geom.ts` | Seeded RNG (mulberry32 + FNV hash), value noise and fBm, Catmull-Rom → cubic Bézier paths, tapered limb outlines with round caps, superellipse face outlines, noise blobs, scalloped outlines, midpoint-displacement ridges, Bridson Poisson-disc sampling, hand-drawn wobble, HSL colour maths |
| `skeleton.ts` | Proportions in head-heights (child 4.3 H, teen 5.6, adult 6.6, elder 6.3) × build × height. Forward kinematics for shoulders, elbows, hips and knees, with feet planted on the ground. Poses: stand, walk, run, sit (cross-legged), jump, wave, point, cheer, think. `phase` animates walk/run/wave cycles |
| `character.ts` | `CharacterSpec` identity. Part modules: face shape, ears, eyes, brows, nose, mouth, cheeks, freckles, 9 hair styles, beard, torso, 8 tops, 5 bottoms, sleeves, hands, shoes, 10 accessories and 11 held props. Six parametric expressions (brow tilt and raise, eye openness, smile-eyes, pupils, gaze, mouth curve, openness, width and shape, blush, tear, sweat). Each part is its own `<g data-part>` |
| `environment.ts` | `EnvSpec` and 12 environments: forest, village, city, school, house, room, fantasy, riverbank, mountains, beach, desert and field. Built from recursive branching trees, tiered pines, curved palms, huts with thatch, houses, city towers with lit windows, a school with playground, floating islands, castle, mushrooms and crystals. Depth bands use haze, time of day relights everything, and weather can be rain, snow or fog |
| `theme.ts` | Theme engine and the `Pen`. Every shape passes through it: palette shift, outline weight and colour, hand-drawn wobble, a sketchy second line, cel or soft-gradient shading, and paper grain. Themes: **children's storybook, flat vector, hand-drawn, cartoon** |

## Consistency: the cast

Each person is stored once as `assets/library/cast/<id>.json`. Every scene renders that same spec with a different pose and expression, so the face, colours, clothes and proportions never change.

- Missing fields are filled from a seed hashed from the name, so "Meera" is always the same Meera.
- Before a story is drawn, Qwen reads the whole script and returns one spec per person, with aliases ("the girl", "she").
- `assets/library/cast/<id>-<theme>.png` is the character's reference sheet: 6 expressions and 6 poses, rendered one after another.

## Caching

The output depends only on the spec, pose, expression, theme and size. The files are named by a hash of those inputs (`assets/library/vector/cache/…`), so nothing is drawn twice. Change a character and only its new renders are made.

## API

| Method | Path | Body |
|---|---|---|
| GET | `/api/vector/cast` | — lists the cast, themes, poses, expressions and environments |
| POST | `/api/vector/cast` | `{name, description?, spec?, aliases?, theme?}` → stores the character and returns its reference sheet |
| PUT | `/api/vector/cast/:id` | partial `CharacterSpec` (e.g. `{"outfit":{"topColor":"#C44569"}}`) → edit; every future scene uses it |
| POST | `/api/vector/character` | `{id \| name, pose, expression, theme, size, flip}` → `{url (PNG), svgUrl}` |
| POST | `/api/vector/environment` | `{place \| spec, theme, width, height}` → `{url, svgUrl}` |
| POST | `/api/vector/plan` | `{text}` → Qwen builds the cast and places |

## In the app

- **Script page:** pick *Children's storybook*, *Cartoon*, *Flat vector* or *Hand-drawn*. Places become procedural environments. People become cast characters whose pose and expression follow the scene (Qwen sets them, with a mood heuristic as fallback).
- **Editor:** select a character layer and the Inspector shows Pose, Expression and Theme. Change one and the same character is redrawn.
- Animals and objects still use the parametric asset kit (`src/assetkit`) in the matching theme.

## Commands

```bash
npm run vector-demo      # sheets in assets/library/vector/demo (expressions × themes, poses, environments)
npm run theme-thumbs     # style-card thumbnails for the four themes
```

## Ollama settings

- `OLLAMA_EDIT_MODEL` (default `qwen3.5:4b`) does story → spec planning and storyboarding.
- `OLLAMA_VISION_MODEL` (default: `gemma3:4b` if pulled, else `qwen3.5:4b`) is only used for cataloguing your own PNGs (`npm run describe-assets`).
- Calls use `keep_alive: 2m` and run one at a time, so two models never sit in VRAM together.

IP-Adapter is not used. It is a diffusion technique, and this engine keeps identity by reusing the stored spec instead.
