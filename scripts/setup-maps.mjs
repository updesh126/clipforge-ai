#!/usr/bin/env node
/**
 * Satellite map imagery for ClipForge maps: NASA Blue Marble Next Generation (December 2004, topography + bathymetry).
 * Public domain (NASA Earth Observatory). Saved under <data>/maps/bluemarble/ — never in git.
 *
 *   world.jpg          5400 × 2700 whole Earth (world view)
 *   tiles/r{row}c{col}.jpg   16 × 8 tiles of 1350 px, each 22.5° × 22.5° (sharp zoom into one country)
 *
 * Usage: npm run maps:setup            (asks before downloading, 32.5 MB)
 *        npm run maps:setup -- --yes   (no question)
 * Maps fall back to the drawn look when these files are missing.
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const BASE = 'https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography-bathymetry/december';
const FILES = [
  { name: 'world.topo.bathy.200412.3x5400x2700.jpg', mb: 2.6, as: 'world.jpg' },
  { name: 'world.topo.bathy.200412.3x21600x10800.jpg', mb: 29.9, as: 'big.jpg' },
];
const COLS = 16;
const ROWS = 8;

const dataDir = path.resolve(process.env.CLIPFORGE_DATA_DIR || path.join(process.cwd(), 'data'));
const dir = path.join(dataDir, 'maps', 'bluemarble');
const tilesDir = path.join(dir, 'tiles');
const done = () => fs.existsSync(path.join(dir, 'world.jpg')) && fs.existsSync(path.join(tilesDir, `r${ROWS - 1}c${COLS - 1}.jpg`));

if (done()) {
  console.log(`✔ Satellite map imagery is already in ${dir}`);
  process.exit(0);
}

const yes = process.argv.includes('--yes') || process.argv.includes('-y');
if (!yes) {
  console.log('ClipForge can show maps on a real satellite photo of Earth (NASA Blue Marble, public domain).');
  for (const f of FILES) console.log(`  • ${f.name}  (${f.mb} MB)  from assets.science.nasa.gov`);
  console.log(`  → saved in ${dir}`);
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const a = (await rl.question('Download 32.5 MB now? [y/N] ')).trim().toLowerCase();
  rl.close();
  if (a !== 'y' && a !== 'yes') {
    console.log('Skipped. Maps keep the drawn look. Run "npm run maps:setup" any time.');
    process.exit(0);
  }
}

fs.mkdirSync(tilesDir, { recursive: true });
for (const f of FILES) {
  const out = path.join(dir, f.as);
  if (fs.existsSync(out) && fs.statSync(out).size > f.mb * 0.9e6) continue;
  process.stdout.write(`Downloading ${f.name} (${f.mb} MB)… `);
  const res = await fetch(`${BASE}/${f.name}`);
  if (!res.ok || !res.body) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(`${out}.part`));
  fs.renameSync(`${out}.part`, out);
  console.log('done');
}

// cut the 21600 × 10800 image into tiles once, so a render never decodes a 900 MB picture
process.stdout.write(`Cutting ${COLS}×${ROWS} tiles… `);
const sharp = (await import('sharp')).default;
sharp.cache(false);
const big = path.join(dir, 'big.jpg');
const { data, info } = await sharp(big, { limitInputPixels: false }).raw().toBuffer({ resolveWithObject: true });
const tw = Math.floor(info.width / COLS);
const th = Math.floor(info.height / ROWS);
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    await sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels }, limitInputPixels: false })
      .extract({ left: c * tw, top: r * th, width: tw, height: th })
      .jpeg({ quality: 86, mozjpeg: true })
      .toFile(path.join(tilesDir, `r${r}c${c}.jpg`));
  }
}
fs.rmSync(big, { force: true }); // the tiles hold it all
fs.writeFileSync(path.join(dir, 'README.txt'), 'NASA Blue Marble Next Generation, December 2004 (topography + bathymetry). Public domain — NASA Earth Observatory.\nworld.jpg = 5400x2700 equirectangular; tiles/r{row}c{col}.jpg = 16x8 tiles, 22.5 degrees each, row 0 = 90N..67.5N, col 0 = 180W..157.5W.\n');
console.log('done');
console.log(`✔ Satellite maps ready in ${dir}`);
