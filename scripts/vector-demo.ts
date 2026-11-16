/**
 * Showcase / regression sheet for the procedural vector engine.
 *   npm run vector-demo                 → assets/library/vector/demo/*.png
 *   npm run vector-demo -- characters   only the character sheets
 *   npm run vector-demo -- environments only the environment sheet
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { characterSvg, EXPRESSIONS, normaliseCharacter } from '../src/vector/character.ts';
import { POSES } from '../src/vector/skeleton.ts';
import { THEME_IDS } from '../src/vector/theme.ts';
import { ENV_KINDS, environmentSvg, normaliseEnv } from '../src/vector/environment.ts';

const OUT = path.resolve(import.meta.dirname, '..', 'assets', 'library', 'vector', 'demo');
fs.mkdirSync(OUT, { recursive: true });
const which = process.argv[2];

async function sheet(svgs: string[], cols: number, cell: number, file: string, bg = '#EDE7DC') {
  const rows = Math.ceil(svgs.length / cols);
  const cw = cell || 270;
  const ch = cell || 480; // cell 0 = portrait environment tiles
  const tiles = await Promise.all(svgs.map(async (svg, i) => ({ input: await sharp(Buffer.from(svg)).resize(cw, ch).png().toBuffer(), left: (i % cols) * cw, top: Math.floor(i / cols) * ch })));
  await sharp({ create: { width: cols * cw, height: rows * ch, channels: 4, background: bg } }).composite(tiles).png().toFile(path.join(OUT, file));
  console.log('→', path.join(OUT, file));
}

const cast = [
  normaliseCharacter({ name: 'Meera', description: 'a village girl with a lantern' }),
  normaliseCharacter({ name: 'Old fisherman', description: 'an old fisherman villager' }),
  normaliseCharacter({ name: 'Priya', description: 'a teacher woman in a saree with glasses' }),
  normaliseCharacter({ name: 'Arjun', description: 'a school boy student' }),
  normaliseCharacter({ name: 'King Vikram', description: 'a king' }),
];

if (!which || which === 'characters') {
  // 1. every expression × every theme for one character (identity must stay identical)
  for (const c of cast.slice(0, 2)) await sheet(THEME_IDS.flatMap((t) => EXPRESSIONS.map((e) => characterSvg(c, { expression: e, theme: t }))), EXPRESSIONS.length, 256, `expressions-${c.id}.png`);
  // 2. every pose for the cast (storybook)
  await sheet(cast.flatMap((c) => POSES.map((p) => characterSvg(c, { pose: p, expression: p === 'jump' || p === 'cheer' ? 'happy' : 'neutral', theme: 'storybook', phase: 0.25 }))), POSES.length, 220, 'poses-storybook.png');
  await sheet(cast.flatMap((c) => POSES.map((p) => characterSvg(c, { pose: p, theme: 'cartoon', phase: 0.25 }))), POSES.length, 220, 'poses-cartoon.png');
}

if (!which || which === 'environments') {
  // every environment kind (storybook, portrait) + the forest in every theme and time of day
  await sheet(ENV_KINDS.map((k) => environmentSvg(normaliseEnv({ kind: k, time: k === 'fantasy' ? 'night' : 'day' }), 'storybook', 540, 960)), 6, 0, 'environments.png');
}
