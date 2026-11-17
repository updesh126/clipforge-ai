/**
 * Contact sheets of the motion graphics library (real Remotion renders, mid/late in each animation).
 *   npm run motion-sheet                → one sheet per category in assets/library/vector/demo/motion-<category>.png
 *   npm run motion-sheet -- data maps   → only those categories
 *   npm run motion-sheet -- --at 0.5    → capture at 50 % of each effect (default 0.8)
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { getBundle } from '../server/remotion.ts';
import { CATEGORIES, EFFECTS_LIB } from '../src/motion/catalog.ts';
import { SEQUENCES } from '../src/motion/sequences.ts';

const args = process.argv.slice(2);
const ai = args.indexOf('--at');
const AT = ai >= 0 ? Number(args[ai + 1]) : 0.8;
const wanted = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--at');
const OUT = path.resolve(import.meta.dirname, '..', 'assets', 'library', 'vector', 'demo');
fs.mkdirSync(OUT, { recursive: true });

const { renderStill, selectComposition, ensureBrowser } = await import('@remotion/renderer');
await ensureBrowser();
const serveUrl = await getBundle();
const W = 1080;
const H = 1920;
const SCALE = 0.25;
const cw = W * SCALE;
const ch = H * SCALE;

for (const cat of CATEGORIES) {
  if (wanted.length && !wanted.includes(cat.id)) continue;
  const ids = cat.id === 'sequences' ? Object.keys(SEQUENCES) : Object.values(EFFECTS_LIB).filter((e) => e.category === cat.id).map((e) => e.id);
  const tiles: NonNullable<Parameters<ReturnType<typeof sharp>['composite']>[0]> = []; // sharp's overlay type (works with sharp 0.34 and 0.35)
  const cols = 8;
  for (const [i, fx] of ids.entries()) {
    const duration = SEQUENCES[fx]?.duration ?? EFFECTS_LIB[fx].duration;
    const inputProps = { fx, width: W, height: H, duration };
    const composition = await selectComposition({ serveUrl, id: 'ClipForgeMotion', inputProps });
    const file = path.join(OUT, `_tile.png`);
    const frame = Math.min(composition.durationInFrames - 1, Math.round(composition.durationInFrames * AT));
    await renderStill({ composition, serveUrl, inputProps, output: file, frame, scale: SCALE, imageFormat: 'png' });
    const label = Buffer.from(`<svg width="${cw}" height="22"><rect width="100%" height="100%" fill="rgba(0,0,0,.7)"/><text x="6" y="15" font-family="Arial" font-size="12" fill="#fff">${fx}</text></svg>`);
    const tile = await sharp(file).composite([{ input: label, top: ch - 22, left: 0 }]).png().toBuffer();
    tiles.push({ input: tile, left: (i % cols) * cw, top: Math.floor(i / cols) * ch });
    process.stdout.write('.');
  }
  const rows = Math.ceil(ids.length / cols);
  const out = path.join(OUT, `motion-${cat.id}.png`);
  await sharp({ create: { width: cols * cw, height: rows * ch, channels: 4, background: '#000' } }).composite(tiles).png().toFile(out);
  console.log(`\n${cat.label}: ${ids.length} → ${out}`);
}
fs.rmSync(path.join(OUT, '_tile.png'), { force: true });
process.exit(0);
