/**
 * Writes docs/site/script-tags.md — every [tag] a script can use, generated from the motion catalogue so the
 * list always matches what ClipForge has. Run: npm run tags-doc
 */
import fs from 'node:fs';
import path from 'node:path';
import { BASE_FIELDS, CATEGORIES, COMMON_FIELDS, EFFECTS_LIB } from '../src/motion/catalog.ts';
import { SEQUENCES } from '../src/motion/sequences.ts';
import { EFFECTS } from '../src/editor/catalog.ts';
import { PLANNED_CAMERAS } from '../server/directives.ts';

const esc = (s: string) => s.replace(/\|/g, '\\|');
const CUTS = ['whipPan', 'irisWipe', 'flash', 'fadeIn', 'fadeOut'];
const fieldList = (keys: string[]) => (keys.length ? keys.map((k) => `\`${k}\``).join(', ') : '—');
const exampleValue = (v: string | number) => (typeof v === 'number' ? String(v) : /\s|;/.test(v) ? `"${v}"` : v);

const out: string[] = [];
out.push(`# Script tags

Put **[tags]** in your script to tell ClipForge exactly which motion graphic, camera move, transition or atmosphere to use in a scene. Tags are never spoken and never appear in captions. Anything you don't tag is still chosen automatically.

\`\`\`text
[title: The Digital Leap] India now has 900 million internet users. [bigStat value=900 suffix=" million" label="India now has" text="internet users"]

The storm reaches the village at night. [rainFx] [shake] [transition: paperTearTransition]

First the farmer checks the sky, then he covers the seeds, and finally he runs home. [processExplain steps="Check the sky; Cover the seeds; Run home"] [move]
\`\`\`

## How to write a tag

| Form | Example | Meaning |
|---|---|---|
| \`[name]\` | \`[rainFx]\` | Use this effect in this scene |
| \`[name key=value …]\` | \`[bigStat value=900 suffix=" million"]\` | …with these settings (quote values that have spaces) |
| \`[kind: name]\` | \`[transition: irisWipe]\` | Same, saying what it is (optional — the name already tells ClipForge) |
| \`[title: text]\` | \`[title: Why the river turned dark]\` | Title banner for this scene |
| \`[move]\` / \`[still]\` | \`[still]\` | With Motion on: force this scene to move / stay a painting (overrides Mix) |

Rules:

- **A tag belongs to the scene it's written in** (a paragraph is a scene; a long paragraph may become two — the tag goes with its own sentence). A line with only tags joins the scene above it.
- **Names are forgiving:** case, spaces and dashes don't matter, and display names work too — \`[Big statistic reveal]\` = \`[bigStat]\`.
- **Unknown names are skipped** and listed while the video is made ("Ignored unknown tags…"); they are never read aloud.
- **Numbers only come from you:** a sequence that needs a number (like \`value\`) takes it from the tag or from the scene's own words. If neither has it, the tag is skipped rather than inventing one.
- Text settings you leave out are filled from the scene's narration (e.g. \`[wordReveal]\` reveals the first words of the scene).
- Your tags always win over the automatic choices for that scene.

## Tips for the best output

1. **Tag the 2–4 key moments**, not every scene — let ClipForge handle the rest. One strong stat or timeline beats five weak ones.
2. **Write the facts in the sentence too** ("900 million internet users"), so captions, voice and graphic agree.
3. **Give sequences their settings** for full control: \`events="1947|Independence; 1991|Reforms"\`, \`steps="Plan; Build; Launch"\`, \`data="Delhi:21, Mumbai:24"\`.
4. **One transition per cut** and one atmosphere per scene; atmosphere suits the mood (rain, fireflies, embers), not decoration.
5. **Camera:** \`pushIn\` for emotion, \`panLeft\`/\`panRight\` to reveal, \`pullOut\` for endings, \`zoomPunch\` for a punchline.
6. **With Motion on**, use \`[move]\` on action scenes and \`[still]\` on quiet ones to steer Mix.
7. **Match the video type:** documentary → timelines, maps, quotes; tech → processes, charts, comparisons; fun → questions, myths, countdowns.

## Camera moves

${PLANNED_CAMERAS.length} planned moves replace the scene's camera; the others are added on top.

| Tag | What it does | Length |
|---|---|---|
${Object.entries(EFFECTS)
  .filter(([id]) => !CUTS.includes(id))
  .map(([id, e]) => `| \`[${id}]\` | ${esc(e.description)}${PLANNED_CAMERAS.includes(id) ? ' *(replaces the planned camera)*' : ''} | ${e.duration}s |`)
  .join('\n')}

Settings: \`intensity\` (0.2–2) for the add-on effects, e.g. \`[shake intensity=0.5]\`.

## Transitions

Used to cut **into** the scene the tag is in.

| Tag | What it does | Length |
|---|---|---|
${[
  ...CUTS.map((id) => `| \`[${id}]\` | ${esc(EFFECTS[id as keyof typeof EFFECTS].description)} | ${EFFECTS[id as keyof typeof EFFECTS].duration}s |`),
  ...Object.values(EFFECTS_LIB)
    .filter((f) => f.category === 'transitions')
    .map((f) => `| \`[${f.id}]\` | ${esc(f.description)} | ${f.duration}s |`),
].join('\n')}

Settings for the colour wipes: \`accent\`, \`accent2\`, \`direction\` (left, right, up, down); \`[textWipe text="MEANWHILE"]\`.

## Atmosphere

A see-through overlay for the whole scene (replaces the automatic one).

| Tag | What it does |
|---|---|
${Object.values(EFFECTS_LIB)
  .filter((f) => f.category === 'atmosphere')
  .map((f) => `| \`[${f.id}]\` | ${esc(f.description)} |`)
  .join('\n')}

Settings: \`count\` and \`colors\` for particles; \`amount\` (0–1) for looks, e.g. \`[vignette amount=0.6]\`.

## Explainer sequences

Full storytelling beats (a big stat, a timeline, a map…). Settings marked **number** must come from the tag or the scene's words.

| Tag | What it shows | Settings | Example |
|---|---|---|---|
${Object.values(SEQUENCES)
  .map((s) => {
    const keys = Object.keys(s.params).filter((k) => k !== 'bg');
    const nums = keys.filter((k) => typeof s.params[k] === 'number');
    const example = `[${s.id}${keys.map((k) => ` ${k}=${exampleValue(s.params[k])}`).join('')}]`;
    return `| \`[${s.id}]\` | ${esc(s.description)} | ${keys.map((k) => (nums.includes(k) ? `\`${k}\` (number)` : `\`${k}\``)).join(', ') || '—'} | \`${esc(example)}\` |`;
  })
  .join('\n')}

## Motion graphics

Added on top of the scene for a few seconds. Every one also takes the common settings: ${fieldList(COMMON_FIELDS.map((f) => f.key))}.
`);

for (const cat of CATEGORIES) {
  if (cat.id === 'sequences' || cat.id === 'transitions' || cat.id === 'atmosphere') continue;
  const list = Object.values(EFFECTS_LIB).filter((f) => f.category === cat.id);
  if (!list.length) continue;
  out.push(`### ${cat.label}

${cat.blurb}.

| Tag | What it does | Settings |
|---|---|---|
${list.map((f) => `| \`[${f.id}]\` | ${esc(f.description)} | ${fieldList(BASE_FIELDS[f.base].map((x) => x.key))} |`).join('\n')}
`);
}

out.push(`---

This page is generated from ClipForge's motion catalogue (\`npm run tags-doc\`), so every name here works.
`);

const file = path.join(process.cwd(), 'docs', 'site', 'script-tags.md');
fs.writeFileSync(file, out.join('\n'));
const count = Object.keys(EFFECTS_LIB).length + Object.keys(SEQUENCES).length + Object.keys(EFFECTS).length;
console.log(`Wrote ${path.relative(process.cwd(), file)} — ${count} tags`);
