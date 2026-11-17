/**
 * Paints the art-style picker thumbnails with local Stable Diffusion (ComfyUI):
 *   public/styles/<id>.jpg          — 16:9 card (960×540)
 *   public/styles/<id>-preview.jpg  — 9:16 hover preview (648×1152)
 * Run:  npm run thumbs:ai            (all styles)
 *       npm run thumbs:ai -- warli anime   (only these)
 * ComfyUI is started automatically when installed. The procedural versions are still available: npm run thumbs
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { ensureComfy } from '../server/comfy.ts';
import { generateImage, sdSize } from '../server/imagegen.ts';
import { buildNegativePrompt, buildSdPrompt } from '../src/artstyles/prompt.ts';

/** One sample subject per style — what each style is best at (matches the style samples sheet). */
const SUBJECTS: Record<string, string> = {
  storybook: 'a cheerful boy with a backpack and his golden puppy on a village path under a big green tree, cottage and hills behind',
  cartoon: 'a cheerful boy in a red cap giving a thumbs up on a colourful town street with trees',
  flatVector: 'a young man with a backpack looking at a sunny city skyline',
  handDrawn: 'a boy sitting under a big tree reading a book, countryside with a farmhouse',
  madhubani: 'Krishna playing a flute beside Radha, surrounded by peacocks, flowers and leaves',
  inkWash: 'misty mountains with bamboo, a pagoda on a cliff and a red sun',
  shadowPuppet: 'a warrior puppet with a spear facing a dragon puppet on a glowing screen',
  paperCutout: 'layered hills with a round tree, a small house, clouds and the sun',
  stainedGlass: 'a castle on a green hill under a bright sun',
  anime: 'a young man with a red scarf looking up at cherry blossom trees under a blue sky',
  warli: 'villagers dancing in a circle beside a tree, the sun and a drum',
  blueprint: 'a rocket ship side view with measurement lines',
  ukiyoe: 'a great ocean wave with Mount Fuji and a red sun',
  miniature: 'a royal lady holding a flower in a palace garden with trees and a domed palace',
};

const SHOTS = [
  { suffix: '', aspect: '16:9', size: [960, 540] as const },
  { suffix: '-preview', aspect: '9:16', size: [648, 1152] as const },
];

const only = process.argv.slice(2).filter((a) => SUBJECTS[a]);
const styles = only.length ? only : Object.keys(SUBJECTS);
const out = path.join(process.cwd(), 'public', 'styles');
fs.mkdirSync(out, { recursive: true });

if (!(await ensureComfy((m) => process.stdout.write(`\r${m}   `)))) {
  console.error('\nStable Diffusion (ComfyUI) is not available. Install it with: npm run comfy:setup');
  process.exit(1);
}
console.log(`\nPainting ${styles.length * SHOTS.length} thumbnails…`);

let n = 0;
for (const style of styles) {
  for (const shot of SHOTS) {
    n++;
    const started = Date.now();
    const [width, height] = sdSize(shot.aspect);
    const img = await generateImage({
      prompt: buildSdPrompt(SUBJECTS[style], style),
      negative: `${buildNegativePrompt(style)}, text, letters, watermark, signature, logo, blurry, extra limbs`,
      width,
      height,
      seed: 11,
      onProgress: (m) => process.stdout.write(`\r[${n}/${styles.length * SHOTS.length}] ${style}${shot.suffix} · ${m}            `),
    });
    const file = path.join(out, `${style}${shot.suffix}.jpg`);
    await sharp(img.file).resize(shot.size[0], shot.size[1], { fit: 'cover' }).jpeg({ quality: 84, mozjpeg: true }).toFile(file);
    console.log(`\r[${n}/${styles.length * SHOTS.length}] ${style}${shot.suffix} → public/styles/${path.basename(file)} (${Math.round((Date.now() - started) / 1000)}s)            `);
  }
}
console.log('Done. Reload the Script page to see the new thumbnails.');
process.exit(0);
