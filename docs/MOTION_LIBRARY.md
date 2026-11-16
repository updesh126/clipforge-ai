# Motion graphics library

An editorial explainer motion-graphics engine inside the editor: **200 effects and 30 sequences** across 14 categories. Every effect is a parameterised animation component, not a video clip or image, so you can edit its text, data, colours, timing and easing.

## Three layers

| Layer | What it is | Where |
|---|---|---|
| **Effect** | One animation (a counter, a bar chart, a red circle, a route on a map). A *preset* is a base renderer plus default parameters. | `src/motion/catalog.ts` (metadata), `src/motion/renderers/*` (about 60 base renderers) |
| **Sequence** | A storytelling beat made of timed effects with shared parameters (Big statistic reveal, Chart explanation, Map investigation…). | `src/motion/sequences.ts` |
| **Scene** | A full composition: footage or procedural places, characters, voice, captions and sequences. | the editor timeline / script-to-video |

`src/motion/MotionFx.tsx` is the single Remotion component that plays an effect or a sequence. In the edit file a motion graphic is a `text` item with `template: "motion"` and `props.fx` set to the effect or sequence id.

## Categories

| Category | Count | Examples |
|---|---|---|
| Sequences | 30 | big stat, chart explanation, map investigation, evidence, comparison, timeline, process, quote, myth vs fact, ranking countdown, money breakdown, breaking news, search investigation, final conclusion |
| Typography | 41 | word, letter or line reveal, typewriter, scramble, mask, blur, wipe, flip, tracking, kinetic headline, paper title, marker highlight, underline, strike, circle, quote card, lower third, ticker, chapter card, text morph, circular text |
| Data visualisation | 30 | counters (%, ₹ with lakh/crore grouping, decimals, odometer), bars (vertical, horizontal, stacked, grouped, sorted, highlighted), line, multi-line, area, pie, donut, radial, gauge, pictogram, before/after, ranking, funnel, pyramid, bubbles, heatmap, waterfall, histogram |
| Maps | 10 | country highlight, zoom-in, pin drop, great-circle route, flight and shipping paths, region comparison, choropleth, spinning globe, paper map (real Natural Earth shapes) |
| Annotations | 25 | red circle, oval, box, underline, cross, tick, "?" and "!", arrows (straight, curved, dotted), leader lines, brackets, magnifier, stamps, redaction, sticky note, speech and thought bubbles, numbered callouts, document excerpt, cursor click |
| Shapes | 14 | draw, scale, pop, wipe, rotate, morph and ripple on circles, squares, triangles, hexagons, stars and lines; burst and assembly; grid and tile reveal |
| Layouts | 12 | split screen, card row, list, stack and fan, browser, search, chat, social post, newspaper zoom, evidence board, myth vs fact |
| Timelines | 5 | horizontal and vertical timelines, decade progression, then vs now, year counter |
| Diagrams | 6 | process flow, cycle, network graph, cause and effect, org chart, decision tree |
| Scientific | 8 | atom, wave, gears, DNA helix, solar system, circuit, molecule, heartbeat |
| Finance | 8 | coin stacks, ₹/$ conversion, money flow, budget donut, revenue and stock lines, salary comparison, waterfall |
| Atmosphere | 23 | dust, rain, snow, confetti, sparks, embers, bokeh, stars, fireflies, light sweep, rays, grain, vignette, light leak, film burn, VHS, glitch, spotlight, fog, gradient, patterns, colour wash, glow |
| Transitions | 12 | wipe, dip, iris, radial, shutter, blinds, split, grid, pixel dissolve, paper tear, line wipe, text wipe |
| Audio reactive | 6 | waveform bars, wave line, circular spectrum, beat pulse, narration progress, speaker indicator |

## Controls every effect has

Delay, speed, easing (editorial, ease out, ease in-out, ease in, linear, back, bounce, elastic, spring, expo, step), exit (fade, slide, scale, wipe, blur, none), position, scale, colour and accent. Each effect also has its own parameters: text with `*emphasis*`, `data` as `Label:value, …` (use `a|b` for stacked series), `events` as `year|event; …`, countries, cities and so on.

## Using it

- **Editor → Library → Motion:** search or pick a category, hover to preview, click to add at the playhead. The Inspector then shows that effect's own fields, plus a picker to switch to any other effect.
- **Edit with AI:** for example "add a big statistic of 1000 when she says…". The local Qwen model gets the catalogue and must use a real id; invented ids are dropped.
- **Script to video (story mode):** the storyboard may give a scene an explainer sequence (big stat, chart, comparison, timeline, process, quote, map, myth vs fact…). A sequence is used only when every parameter is filled and **every number in it is actually said in that scene**. Otherwise the scene keeps its normal graphic, so no sample text or invented numbers appear.

## Adding an effect

1. **New look on an existing engine:** add one row to `ROWS` in `src/motion/catalog.ts` (id, base, category, label, description, duration, defaults).
2. **New engine:** add a renderer `(m: Motion) => ReactElement` in `src/motion/renderers/`, its field schema in `BASE_FIELDS`, and register it in `RENDERERS` (`MotionFx.tsx`).
3. **New sequence:** add an entry to `SEQUENCES` with timed steps; step props can use `{{param}}`.

## Contact sheets

```bash
npm run motion-sheet                 # every category → assets/library/vector/demo/motion-<category>.png
npm run motion-sheet -- data maps    # just some
npm run motion-sheet -- --at 0.5     # capture at 50 % of each animation
```

## Not in this version

- **Image & photo effects and footage effects:** freeze-frame, speed ramp, tracking, parallax on photos and so on. Ken Burns, parallax and camera moves already exist as item motion and timeline effects; the rest needs per-footage processing.
- **True audio-reactive input:** the audio visualisers follow a smooth voice-like envelope, not the actual waveform yet.
- **India state-level maps:** country level only for now.
