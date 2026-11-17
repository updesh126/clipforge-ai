# Art styles

ClipForge has 14 art styles plus two picker modes. Each style has a full spec in `src/artstyles/<id>.json`.

| Style | Origin | Best for |
|---|---|---|
| Children's storybook | Picture-book gouache | Fables, bedtime and moral stories |
| Cartoon | TV cartoon | Comedy, kids, energetic explainers |
| Flat vector | Modern explainer | Business, tech, education |
| Hand-drawn | Sketchbook ink and wash | Personal stories, journals |
| Madhubani | Mithila, Bihar | Indian festivals, folk tales |
| Ink wash | China / Japan (sumi-e) | Nature, calm reflection |
| Shadow puppet | Tholu Bommalata, wayang kulit | Myths, legends, drama |
| Paper cutout | Paper craft | Kids, friendly explainers |
| Stained glass | Gothic windows | Heritage, grand moments |
| Anime | Japanese animation | Youth, hype, launches |
| Warli | Maharashtra tribal art | Community, farming, rural India |
| Blueprint | Engineering drawings | Tech, how-it-works |
| Ukiyo-e | Edo-period woodblock prints | Travel, oceans, seasons |
| Miniature painting | Mughal / Rajput courts | History, royalty, weddings |

**Auto** lets your local AI pick a style from the script. **Mix all** uses a different style per scene.

## What is in a style file

Each `src/artstyles/<id>.json` holds:

- origin, history, look, mood, best for and avoid for
- the palette, with a name and a role for every colour
- line, fill, shading and texture
- characters, environment motifs, border and composition
- typography and banner colours (read from the renderer, so they never drift)
- suggested camera moves, transitions, atmosphere and text reveals (checked against the motion library)
- the filters that re-colour library pictures to match the style
- a `generation` block for image models: description, linework, lighting, instructions, prompt modifier and negative prompt

Shared rules (character consistency, composition, output) are in `src/artstyles/_rules.json`.

## Rebuild the files

The style files are generated. Edit `scripts/data/art-style-presets.json` (image-generation wording) or `scripts/gen-art-style-specs.ts` (art direction), then run:

```bash
npm run artstyles
```

## Thumbnails

The style picker cards (`public/styles/<id>.jpg`, 16:9) and hover previews (`<id>-preview.jpg`, 9:16) are painted with Stable Diffusion:

```bash
npm run thumbs:ai
```

Repaint only some styles with `npm run thumbs:ai -- warli anime`. The subjects live in `scripts/gen-style-thumbs-ai.ts`. The older procedural (vector) thumbnails can still be made with `npm run thumbs`.

## Prompts for other image tools

`npm run prompts` writes ready-to-paste prompts for every style and every library asset into `assets/prompts/`. They use the same style data.

## In code

```ts
import { buildSdPrompt, buildNegativePrompt, buildImagePrompt } from './src/artstyles/prompt.ts';

buildSdPrompt('a girl feeding a calf in a village', 'warli');   // compact prompt for Stable Diffusion
buildNegativePrompt('warli');                                   // what to avoid
buildImagePrompt('a girl feeding a calf', 'warli');             // long form for instruction-following models
```
