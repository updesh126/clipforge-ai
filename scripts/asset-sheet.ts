/**
 * Contact sheet of library assets on a coloured background (shows halos / missing parts at a glance).
 *   npm run asset-sheet -- <folder: characters|animals|…> [out.png] [--cols 10] [--limit 60]
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { ASSETS_DIR } from '../server/assets.ts';

const args = process.argv.slice(2);
const folder = args.find((a) => !a.startsWith('--')) ?? 'characters';
const out = args.filter((a) => !a.startsWith('--'))[1] ?? path.join(ASSETS_DIR, `sheet-${folder}.png`);
const opt = (k: string, d: number) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? Number(args[i + 1]) : d;
};
const cols = opt('cols', 10);
const limit = opt('limit', 60);
const cell = 160;

const dir = path.join(ASSETS_DIR, folder);
const files = fs.readdirSync(dir).filter((f) => /\.png$/i.test(f)).slice(0, limit);
const rows = Math.ceil(files.length / cols);
const tiles = await Promise.all(
  files.map(async (f, i) => ({
    input: await sharp(path.join(dir, f)).resize(cell - 8, cell - 8, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(),
    left: (i % cols) * cell + 4,
    top: Math.floor(i / cols) * cell + 4,
  }))
);
await sharp({ create: { width: cols * cell, height: rows * cell, channels: 4, background: { r: 47, g: 111, b: 168, alpha: 1 } } })
  .composite(tiles)
  .png()
  .toFile(out);
console.log(`${files.length} assets → ${out}`);
