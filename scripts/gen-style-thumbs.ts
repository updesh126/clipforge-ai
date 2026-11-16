/**
 * Renders a preview of every art style with Remotion (the real art scenes, not mock-ups):
 *   public/styles/<id>.jpg          — 16:9 thumbnail for the style picker cards
 *   public/styles/<id>-preview.jpg  — 9:16 preview with a sample title, shown on hover
 * Run:  npm run thumbs
 */
import fs from 'node:fs';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import { ART_STYLE_OPTIONS } from '../src/editor/catalog.ts';

const out = path.join(process.cwd(), 'public', 'styles');
fs.mkdirSync(out, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.join(process.cwd(), 'src', 'remotion', 'index.ts') });

const shots: Array<{ suffix: string; w: number; h: number; text: string; scale: number }> = [
  { suffix: '', w: 1920, h: 1080, text: '', scale: 0.25 }, // 480×270, scene only
  { suffix: '-preview', w: 1080, h: 1920, text: 'Your story here', scale: 0.3 }, // 324×576, with title
];

for (const style of ART_STYLE_OPTIONS) {
  for (const s of shots) {
    const edit = {
      id: 'thumb',
      name: style,
      width: s.w,
      height: s.h,
      fps: 30,
      background: '#000',
      items: [{ id: 'a', kind: 'text', track: 1, from: 0, duration: 4, template: 'artCard', props: { style, text: s.text, subtitle: '', position: 'auto', size: 1, dim: 0 } }],
      createdAt: '',
      updatedAt: '',
    };
    const inputProps = { edit, assetBase: '', preview: false };
    const composition = await selectComposition({ serveUrl, id: 'ClipForgeEdit', inputProps });
    const file = path.join(out, `${style}${s.suffix}.jpg`);
    await renderStill({ composition, serveUrl, inputProps, frame: 80, output: file, imageFormat: 'jpeg', jpegQuality: 82, scale: s.scale });
    console.log('✓', path.relative(process.cwd(), file));
  }
}
process.exit(0);
