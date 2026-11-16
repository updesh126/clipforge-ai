/**
 * Style-card thumbnails for the four procedural vector themes, drawn straight by the engine (no Remotion):
 *   public/styles/<theme>.jpg          480×270 card
 *   public/styles/<theme>-preview.jpg  324×576 hover preview
 *   npm run theme-thumbs
 */
import path from 'node:path';
import sharp from 'sharp';
import { characterSvg, normaliseCharacter } from '../src/vector/character.ts';
import { environmentSvg, normaliseEnv, type EnvSpec } from '../src/vector/environment.ts';
import { THEME_IDS, type ThemeId } from '../src/vector/theme.ts';

const OUT = path.resolve(import.meta.dirname, '..', 'public', 'styles');
const SCENE: Record<ThemeId, { env: Partial<EnvSpec>; who: { name: string; description: string }; expression: 'happy' | 'neutral' | 'surprised'; pose: 'wave' | 'stand' | 'jump' | 'walk' }> = {
  storybook: { env: { kind: 'forest', time: 'sunset' }, who: { name: 'Meera', description: 'a village girl with a lantern' }, expression: 'happy', pose: 'stand' },
  cartoon: { env: { kind: 'fantasy', time: 'day' }, who: { name: 'Arjun', description: 'a school boy student' }, expression: 'surprised', pose: 'jump' },
  flatVector: { env: { kind: 'city', time: 'day' }, who: { name: 'Priya', description: 'a woman engineer with a phone' }, expression: 'happy', pose: 'wave' },
  handDrawn: { env: { kind: 'village', time: 'day' }, who: { name: 'Old fisherman', description: 'an old fisherman villager' }, expression: 'neutral', pose: 'walk' },
};

for (const t of THEME_IDS) {
  const sc = SCENE[t];
  const who = normaliseCharacter(sc.who);
  for (const [suffix, w, h] of [['', 960, 540], ['-preview', 648, 1152]] as const) {
    const bg = await sharp(Buffer.from(environmentSvg(normaliseEnv(sc.env), t, w, h))).png().toBuffer();
    const size = Math.round(Math.min(h * 0.62, w * 0.95));
    const ch = await sharp(Buffer.from(characterSvg(who, { theme: t, expression: sc.expression, pose: sc.pose, phase: 0.25 })), { density: (72 * size) / 512 }).resize(size, size).png().toBuffer();
    const file = path.join(OUT, `${t}${suffix}.jpg`);
    // sharp resizes before compositing within one pipeline, so composite first, then scale down
    const full = await sharp(bg).composite([{ input: ch, left: Math.round(w / 2 - size / 2), top: Math.round(h * 0.95 - size) }]).png().toBuffer();
    await sharp(full)
      .resize(suffix ? 324 : 480, suffix ? 576 : 270)
      .jpeg({ quality: 84 })
      .toFile(file);
    console.log('→', file);
  }
}
