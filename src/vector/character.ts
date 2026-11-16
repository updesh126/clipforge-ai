/**
 * Modular procedural character generator.
 *
 * A CharacterSpec is the character's IDENTITY (proportions, skin, face shape, eyes, hair, clothes, accessories).
 * It is stored once (the "cast") and every scene renders that same spec with a different pose + expression,
 * so faces, colours, clothing and proportions never drift. Missing fields are filled deterministically from
 * the character's seed — the same name always yields the same person.
 *
 * Parts (each its own function, each its own editable <g data-part>):
 *   shadow · hair-back · legs/shoes · bottoms · torso/top · arms/hands/sleeves · neck · ears · head ·
 *   face (brows, eyes, nose, mouth, cheeks) · beard · hair-front · accessories · held prop
 */
import { type Pt, add, blobPts, hexToRgb, bumpyPts, clamp, ellipsePts, faceOutline, hashString, lerp, lerpPt, limbPts, mixHex, mul, norm, perp, polar, rng, type Rng, shade, sub } from './geom.ts';
import { bodyOf, poseAngles, solve, mid, type Body, type Joints, type Pose } from './skeleton.ts';
import { Pen, theme as themeOf, type Theme, type ThemeId } from './theme.ts';

export type Expression = 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'scared';
export const EXPRESSIONS: Expression[] = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'scared'];

export type HairStyle = 'short' | 'long' | 'bob' | 'bun' | 'ponytail' | 'braid' | 'curly' | 'spiky' | 'bald';
export type TopKind = 'tshirt' | 'shirt' | 'kurta' | 'dress' | 'saree' | 'jacket' | 'robe' | 'uniform';
export type BottomKind = 'trousers' | 'shorts' | 'skirt' | 'dhoti' | 'leggings';
export type Accessory = 'glasses' | 'hat' | 'cap' | 'turban' | 'scarf' | 'crown' | 'backpack' | 'necklace' | 'bindi' | 'earrings';
export type Held = 'none' | 'lantern' | 'book' | 'stick' | 'basket' | 'phone' | 'flag' | 'umbrella' | 'pot' | 'sword' | 'flower' | 'ball';

export interface CharacterSpec {
  id: string; // slug
  name: string;
  description?: string; // free text the LLM/user gave
  seed: number;
  age: 'child' | 'teen' | 'adult' | 'elder';
  gender: 'female' | 'male' | 'neutral';
  build: 'slim' | 'average' | 'broad' | 'round';
  height: number; // 0.85–1.15
  skin: string;
  face: { shape: 'round' | 'oval' | 'square' | 'heart' | 'long'; eyes: 'round' | 'almond' | 'narrow'; eyeColor: string; nose: 'button' | 'pointed' | 'wide' | 'none'; freckles: boolean };
  hair: { style: HairStyle; color: string };
  beard: 'none' | 'stubble' | 'moustache' | 'full';
  outfit: { top: TopKind; topColor: string; pattern: 'none' | 'stripes' | 'dots' | 'checks'; patternColor: string; bottom: BottomKind; bottomColor: string; shoes: 'shoes' | 'sandals' | 'boots' | 'barefoot'; shoeColor: string };
  accessories: Accessory[];
  accessoryColor: string;
  holding: Held;
}

// ---------------------------------------------------------------- palettes for deterministic defaults
const SKIN = ['#F7DCC8', '#EBC4A3', '#DDAA82', '#C98E5F', '#B07548', '#8D5A35', '#6E4027', '#53301E'];
const HAIR = ['#1E1410', '#2B1B12', '#4A2C1A', '#6B3E22', '#8A5A2B', '#B9874E', '#D9B27A', '#A23B1E'];
const CLOTH = ['#E4572E', '#F2A541', '#F3CA40', '#4CB944', '#2A9D8F', '#277DA1', '#3A5BA0', '#6A4C93', '#C44569', '#E07A5F', '#81B29A', '#F4D35E', '#5E548E', '#EE6C4D', '#3D405B', '#9C6644'];
const EYE = ['#3B2416', '#4E3524', '#2F4F6F', '#3E5F3A', '#1C1C1C'];

const colourDistance = (a: string, b: string) => {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
};
const one = <T,>(v: unknown, xs: readonly T[], d: T): T => (xs.includes(v as T) ? (v as T) : d);
const hexOr = (v: unknown, d: string) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : d);
export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'character';

/** Fill every field: given values win, the rest come from the seed (stable for the same name). */
export function normaliseCharacter(input: Partial<CharacterSpec> & { name?: string }): CharacterSpec {
  const name = String(input.name ?? 'Character').slice(0, 60);
  const seed = typeof input.seed === 'number' ? input.seed >>> 0 : hashString(name.toLowerCase());
  const r = rng(seed);
  const text = `${name} ${input.description ?? ''}`.toLowerCase();
  const has = (re: RegExp) => re.test(text);
  const age = one(input.age, ['child', 'teen', 'adult', 'elder'] as const, has(/\b(girl|boy|child|kid|baby|little)\b/) ? 'child' : has(/\b(teen|student|youth)\b/) ? 'teen' : has(/\b(old|elder|grand|aged|granny|grandpa|grandma|dadi|nani|baba)\b/) ? 'elder' : 'adult');
  const gender = one(input.gender, ['female', 'male', 'neutral'] as const, has(/\b(she|her|girl|woman|women|mother|mom|queen|princess|lady|grandma|granny|aunt|sister|daughter|wife|dadi|nani|didi)\b/) ? 'female' : has(/\b(he|his|boy|man|men|father|dad|king|prince|grandpa|uncle|brother|son|husband|baba|sir)\b/) ? 'male' : r.chance(0.5) ? 'female' : 'male');
  const f = gender === 'female';
  const hairStyle: HairStyle = f ? r.pick(['long', 'bob', 'bun', 'ponytail', 'braid', 'curly'] as const) : r.pick(['short', 'short', 'curly', 'spiky'] as const);
  const elderHair = age === 'elder' ? r.pick(['#D9D9D9', '#BDBDBD', '#ECECEC']) : null;
  const inputFace = (input.face ?? {}) as Partial<CharacterSpec['face']>;
  const inputHair = (input.hair ?? {}) as Partial<CharacterSpec['hair']>;
  const inputOutfit = (input.outfit ?? {}) as Partial<CharacterSpec['outfit']>;
  const top = one(inputOutfit.top, ['tshirt', 'shirt', 'kurta', 'dress', 'saree', 'jacket', 'robe', 'uniform'] as const, has(/\bsaree|sari\b/) ? 'saree' : has(/\bkurta\b/) ? 'kurta' : has(/\b(school|student|uniform|police|soldier)\b/) ? 'uniform' : has(/\b(king|queen|monk|sage|rishi|wizard|priest)\b/) ? 'robe' : f && r.chance(0.35) ? 'dress' : r.pick(['tshirt', 'shirt', 'kurta', 'jacket'] as const));
  const bottomDefault: BottomKind = top === 'dress' || top === 'saree' || top === 'robe' ? 'skirt' : has(/\b(farmer|fisherman|villager|dhoti)\b/) && !f ? 'dhoti' : f && r.chance(0.3) ? 'skirt' : age === 'child' && r.chance(0.4) ? 'shorts' : 'trousers';
  const accessories = (Array.isArray(input.accessories) ? input.accessories : []).filter((a): a is Accessory => ['glasses', 'hat', 'cap', 'turban', 'scarf', 'crown', 'backpack', 'necklace', 'bindi', 'earrings'].includes(a as string));
  if (!Array.isArray(input.accessories)) {
    if (has(/\b(king|queen|prince|princess|raja|rani)\b/)) accessories.push('crown');
    if (has(/\bturban|pagdi|sikh\b/) || (has(/\b(farmer|fisherman|villager)\b/) && !f && r.chance(0.6))) accessories.push('turban');
    if (has(/\b(glasses|spectacles|teacher|professor|scientist|grandpa|grandma)\b/)) accessories.push('glasses');
    if (has(/\b(school|student|traveller|hiker)\b/)) accessories.push('backpack');
    if (f && (top === 'saree' || top === 'kurta') && r.chance(0.6)) accessories.push('bindi');
    if (f && r.chance(0.4)) accessories.push('earrings');
  }
  const held = one(input.holding, ['none', 'lantern', 'book', 'stick', 'basket', 'phone', 'flag', 'umbrella', 'pot', 'sword', 'flower', 'ball'] as const,
    has(/\blantern|lamp|diya\b/) ? 'lantern' : has(/\bbook|reading\b/) ? 'book' : has(/\b(stick|staff|cane|walking)\b/) || age === 'elder' && r.chance(0.4) ? 'stick' : has(/\bbasket\b/) ? 'basket' : has(/\bumbrella\b/) ? 'umbrella' : has(/\bsword|warrior\b/) ? 'sword' : has(/\bflower\b/) ? 'flower' : has(/\bball|football|cricket\b/) ? 'ball' : 'none');
  // clothes must not melt into the skin: re-pick colours that are too close
  const skin = hexOr(input.skin, r.pick(SKIN.slice(1, 7)));
  const far = (c: string) => colourDistance(c, skin) > 90;
  const royal = has(/(king|queen|prince|princess|raja|rani|emperor)/);
  const pickCloth = (given: unknown, label: string) => {
    const g = hexOr(given, '');
    if (g) return g;
    const rr = r.fork(label);
    const pool = royal && label === 'top' ? ['#7B2CBF', '#9D0208', '#1D3557', '#6A040F'] : CLOTH;
    for (let i = 0; i < 8; i++) {
      const c = rr.pick(pool);
      if (far(c)) return c;
    }
    return '#277DA1';
  };
  return {
    id: slugify(input.id ?? name),
    name,
    description: input.description,
    seed,
    age,
    gender,
    build: one(input.build, ['slim', 'average', 'broad', 'round'] as const, age === 'child' ? 'average' : r.pick(['slim', 'average', 'average', 'broad', 'round'] as const)),
    height: clamp(Number(input.height) || r.range(0.93, 1.07), 0.85, 1.15),
    skin,
    face: {
      shape: one(inputFace.shape, ['round', 'oval', 'square', 'heart', 'long'] as const, age === 'child' ? 'round' : r.pick(['round', 'oval', 'oval', 'square', 'heart', 'long'] as const)),
      eyes: one(inputFace.eyes, ['round', 'almond', 'narrow'] as const, r.pick(['round', 'almond', 'almond', 'narrow'] as const)),
      eyeColor: hexOr(inputFace.eyeColor, r.pick(EYE)),
      nose: one(inputFace.nose, ['button', 'pointed', 'wide', 'none'] as const, r.pick(['button', 'button', 'pointed', 'wide'] as const)),
      freckles: typeof inputFace.freckles === 'boolean' ? inputFace.freckles : r.chance(0.15),
    },
    hair: { style: one(inputHair.style, ['short', 'long', 'bob', 'bun', 'ponytail', 'braid', 'curly', 'spiky', 'bald'] as const, age === 'elder' && !f && r.chance(0.4) ? 'bald' : hairStyle), color: hexOr(inputHair.color, elderHair ?? r.pick(HAIR)) },
    beard: one(input.beard, ['none', 'stubble', 'moustache', 'full'] as const, !f && (age === 'adult' || age === 'elder') ? r.pick(['none', 'none', 'stubble', 'moustache', 'full'] as const) : 'none'),
    outfit: {
      top,
      topColor: pickCloth(inputOutfit.topColor, 'top'),
      pattern: one(inputOutfit.pattern, ['none', 'stripes', 'dots', 'checks'] as const, r.pick(['none', 'none', 'none', 'stripes', 'dots', 'checks'] as const)),
      patternColor: hexOr(inputOutfit.patternColor, '#FFFFFF'),
      bottom: one(inputOutfit.bottom, ['trousers', 'shorts', 'skirt', 'dhoti', 'leggings'] as const, bottomDefault),
      bottomColor: hexOr(inputOutfit.bottomColor, bottomDefault === 'dhoti' ? '#F4EFE6' : pickCloth(undefined, 'bottom')),
      shoes: one(inputOutfit.shoes, ['shoes', 'sandals', 'boots', 'barefoot'] as const, has(/\b(villager|farmer|fisherman|monk|sage)\b/) ? r.pick(['sandals', 'barefoot'] as const) : r.pick(['shoes', 'shoes', 'sandals', 'boots'] as const)),
      shoeColor: hexOr(inputOutfit.shoeColor, r.pick(['#3B2A1A', '#2B2B2B', '#7A4E2D', '#A23B1E', '#33415C'])),
    },
    accessories: [...new Set(accessories)],
    accessoryColor: hexOr(input.accessoryColor, r.pick(CLOTH)),
    holding: held,
  };
}

// ---------------------------------------------------------------- expressions (parametric, not stickers)
interface Face {
  browTilt: number; // deg: + angry (inner ends down), − worried (inner ends up)
  browRaise: number; // × r
  eyeOpen: number; // 0 = closed arc (happy squint), 1 = normal, 1.3 = wide
  smileEyes: boolean;
  pupil: number; // pupil size multiplier
  look: Pt; // gaze offset (× eye size)
  mouthCurve: number; // −1 frown … +1 smile
  mouthOpen: number; // 0 … 1
  mouthWidth: number;
  mouthShape: 'curve' | 'o' | 'teeth' | 'wavy';
  blush: number;
  tear: boolean;
  sweat: boolean;
}

const FACES: Record<Expression, Face> = {
  neutral: { browTilt: 0, browRaise: 0, eyeOpen: 1, smileEyes: false, pupil: 1, look: [0, 0], mouthCurve: 0.25, mouthOpen: 0, mouthWidth: 0.9, mouthShape: 'curve', blush: 0.25, tear: false, sweat: false },
  happy: { browTilt: -4, browRaise: 0.05, eyeOpen: 0.85, smileEyes: true, pupil: 1, look: [0, 0], mouthCurve: 1, mouthOpen: 0.55, mouthWidth: 1.25, mouthShape: 'curve', blush: 0.6, tear: false, sweat: false },
  sad: { browTilt: -18, browRaise: 0.06, eyeOpen: 0.8, smileEyes: false, pupil: 1, look: [0, 0.3], mouthCurve: -0.8, mouthOpen: 0.08, mouthWidth: 0.85, mouthShape: 'curve', blush: 0.15, tear: true, sweat: false },
  angry: { browTilt: 22, browRaise: -0.06, eyeOpen: 0.72, smileEyes: false, pupil: 0.85, look: [0, 0], mouthCurve: -0.55, mouthOpen: 0.45, mouthWidth: 1.05, mouthShape: 'teeth', blush: 0.45, tear: false, sweat: false },
  surprised: { browTilt: -4, browRaise: 0.16, eyeOpen: 1.3, smileEyes: false, pupil: 0.7, look: [0, 0], mouthCurve: 0, mouthOpen: 0.8, mouthWidth: 0.6, mouthShape: 'o', blush: 0.2, tear: false, sweat: false },
  scared: { browTilt: -20, browRaise: 0.13, eyeOpen: 1.25, smileEyes: false, pupil: 0.6, look: [0.25, 0], mouthCurve: -0.35, mouthOpen: 0.45, mouthWidth: 1, mouthShape: 'wavy', blush: 0, tear: false, sweat: true },
};

// ---------------------------------------------------------------- drawing context
interface Ctx {
  pen: Pen;
  t: Theme;
  s: CharacterSpec;
  b: Body;
  j: Joints;
  e: Face;
  r: Rng;
  ink: string; // dark line colour for facial features
}

export interface RenderOpts {
  pose?: Pose;
  expression?: Expression;
  phase?: number; // 0–1 for walk/run/wave cycles
  theme?: ThemeId;
  flip?: boolean; // face left
  shadow?: boolean; // ground contact shadow
}

/** Render a character to an SVG string (512×512, ground at y = 492, transparent background). */
export function characterSvg(spec: CharacterSpec, o: RenderOpts = {}, size = 512): string {
  const t = themeOf(o.theme);
  const b = bodyOf({ age: spec.age, build: spec.build, height: spec.height, headScale: t.headScale });
  const j = solve(b, poseAngles(o.pose ?? 'stand', o.phase ?? 0));
  const pen = new Pen(t, b.H / 26, spec.seed);
  const ctx: Ctx = { pen, t, s: spec, b, j, e: FACES[o.expression ?? 'neutral'], r: rng(spec.seed).fork('detail'), ink: '#24170F' };

  pen.group(`character:${spec.id}`, () => {
    if (o.shadow !== false) shadowPart(ctx);
    pen.group('hair-back', () => hairBack(ctx));
    if (spec.accessories.includes('backpack')) pen.group('backpack', () => backpack(ctx, false));
    pen.group('legs', () => legs(ctx));
    pen.group('bottoms', () => bottoms(ctx));
    pen.group('top', () => topPart(ctx));
    pen.group('arms', () => arms(ctx));
    if (spec.accessories.includes('backpack')) pen.group('backpack-straps', () => backpack(ctx, true));
    if (spec.accessories.includes('necklace')) pen.group('necklace', () => necklace(ctx));
    if (spec.accessories.includes('scarf')) pen.group('scarf', () => scarf(ctx));
    const tilt = j.angles.headTilt;
    pen.group('head', () => {
      neck(ctx);
      ears(ctx);
      head(ctx);
      face(ctx);
      beard(ctx);
      hairFront(ctx);
      brows(ctx);
      headwear(ctx);
    }, tilt ? `transform="rotate(${tilt} ${j.head[0].toFixed(1)} ${(j.head[1] + b.headR).toFixed(1)})"` : '');
    if (spec.holding !== 'none') pen.group(`holding:${spec.holding}`, () => heldProp(ctx));
  }, o.flip ? 'transform="translate(512 0) scale(-1 1)"' : '');
  return pen.svg(size, size, '0 0 512 512', { engine: 'clipforge-vector/1', spec, pose: o.pose ?? 'stand', expression: o.expression ?? 'neutral', theme: t.id });
}

// ---------------------------------------------------------------- parts
function shadowPart({ pen, j, b }: Ctx) {
  const k = clamp(1 - j.airborne / 160, 0.4, 1);
  pen.ellipse([j.hip[0], j.ground - 2], (b.hipW * 2.2 + 20) * k, 9 * k, '#000000', { raw: true, opacity: 0.16, outline: 0 });
}

function skinOf({ s }: Ctx) {
  return s.skin;
}

function legs(ctx: Ctx) {
  const { pen, j, b, s } = ctx;
  const skin = skinOf(ctx);
  for (const i of [0, 1] as const) {
    const k = i === 0 ? -1 : 1;
    pen.shape(limbPts([j.hipJ[i], j.knee[i], j.foot[i]], [b.legW * 1.05, b.legW * 0.88, b.legW * 0.7]), skin, { part: `leg-${i ? 'right' : 'left'}`, shade: true });
    // feet / footwear: oriented along the shin, toes pointing outward
    const dir = norm(sub(j.foot[i], j.knee[i]));
    const toe: Pt = add(j.foot[i], [k * b.legW * 0.35, 0]);
    const ang = (Math.atan2(dir[0], dir[1]) * -180) / Math.PI * 0.25;
    const shoe = s.outfit.shoes;
    if (shoe === 'barefoot' || shoe === 'sandals') {
      pen.ellipse(add(toe, [0, -b.legW * 0.2]), b.legW * 0.72, b.legW * 0.32, skin, { rot: ang });
      if (shoe === 'sandals') pen.line([add(toe, [-b.legW * 0.5, -b.legW * 0.3]), add(toe, [b.legW * 0.5, -b.legW * 0.3])], s.outfit.shoeColor, 2.2);
    } else {
      if (shoe === 'boots') pen.shape(limbPts([lerpPt(j.knee[i], j.foot[i], 0.55), j.foot[i]], [b.legW * 0.95, b.legW * 0.9]), s.outfit.shoeColor, { shade: true });
      pen.ellipse(add(toe, [0, -b.legW * 0.24]), b.legW * 0.85, b.legW * 0.42, s.outfit.shoeColor, { rot: ang, shade: true, part: 'shoe' });
    }
  }
}

function bottoms(ctx: Ctx) {
  const { pen, j, b, s } = ctx;
  const c = s.outfit.bottomColor;
  const kind = s.outfit.top === 'saree' || s.outfit.top === 'dress' || s.outfit.top === 'robe' ? 'none' : s.outfit.bottom;
  // pelvis block joins the two legs under the top
  const pelvis: Pt[] = [
    [j.hipJ[0][0] - b.legW * 0.55, j.hip[1] - b.legW * 0.4],
    [j.hipJ[1][0] + b.legW * 0.55, j.hip[1] - b.legW * 0.4],
    [j.hipJ[1][0] + b.legW * 0.5, j.hip[1] + b.legW * 0.55],
    [j.hip[0], j.hip[1] + b.legW * 0.75],
    [j.hipJ[0][0] - b.legW * 0.5, j.hip[1] + b.legW * 0.55],
  ];
  if (kind === 'none') return;
  if (kind === 'skirt') {
    const hem = j.knee[0][1] + b.shin * 0.15;
    const flare = b.hipW * 1.5;
    pen.shape(
      [
        [j.hip[0] - b.waistW, j.hip[1] - b.legW * 0.6],
        [j.hip[0] + b.waistW, j.hip[1] - b.legW * 0.6],
        [j.hip[0] + flare, hem],
        [j.hip[0], hem + b.legW * 0.25],
        [j.hip[0] - flare, hem],
      ],
      c,
      { part: 'skirt', shade: true, tension: 0.3 }
    );
    return;
  }
  const legW = kind === 'leggings' ? 1.08 : kind === 'dhoti' ? 1.5 : 1.22;
  for (const i of [0, 1] as const) {
    const end = kind === 'shorts' ? lerpPt(j.knee[i], j.foot[i], 0.08) : kind === 'dhoti' ? lerpPt(j.knee[i], j.foot[i], 0.6) : lerpPt(j.knee[i], j.foot[i], 0.86);
    const chain = kind === 'shorts' ? [j.hipJ[i], end] : [j.hipJ[i], j.knee[i], end];
    const widths = chain.map((_, n) => b.legW * legW * (n === 0 ? 1.05 : n === 1 ? 0.95 : 0.9));
    pen.shape(limbPts(chain, widths), c, { part: `bottom-${i ? 'right' : 'left'}`, shade: true });
    if (kind === 'dhoti') pen.line([lerpPt(j.hipJ[i], j.knee[i], 0.2), lerpPt(j.knee[i], end, 0.7)], shade(c, -0.2), 1.2, { opacity: 0.6 });
  }
  pen.shape(pelvis, c, { part: 'pelvis', tension: 0.35 });
}

/** Torso outline from the skeleton: shoulders → armpits → waist (+ belly) → hips. */
function torsoPts({ j, b }: Ctx, hemDrop = 0, flare = 0): Pt[] {
  const n = j.neck;
  const h = j.hip;
  const dx = (h[0] - n[0]) * 0;
  const sw = b.shoulderW;
  const bellyOut = b.belly * b.waistW * 0.35;
  const waistY = lerp(n[1], h[1], 0.62);
  const hemY = h[1] + b.legW * 0.35 + hemDrop;
  const right: Pt[] = [
    [n[0] + b.H * 0.12, n[1] - b.H * 0.02],
    [n[0] + sw, n[1] + b.limbW * 0.25],
    [n[0] + sw * 0.95, lerp(n[1], h[1], 0.3)],
    [h[0] + b.waistW + bellyOut + dx, waistY],
    [h[0] + b.hipW + flare, hemY],
  ];
  const left: Pt[] = right.map(([x, y]) => [2 * h[0] - x + (n[0] - h[0]) * (y < waistY ? 2 : 0), y] as Pt).reverse();
  return [...right, [h[0], hemY + b.legW * 0.12], ...left];
}

function topPart(ctx: Ctx) {
  const { pen, s, b, j } = ctx;
  const o = s.outfit;
  const c = o.topColor;
  const long = o.top === 'kurta' ? b.thigh * 0.65 : o.top === 'robe' ? b.thigh + b.shin * 0.85 : o.top === 'dress' ? b.thigh * 0.95 : o.top === 'jacket' ? b.legW * 0.6 : 0;
  const flare = o.top === 'dress' ? b.hipW * 0.9 : o.top === 'robe' ? b.hipW * 0.7 : o.top === 'kurta' ? b.hipW * 0.2 : 0;
  if (o.top === 'saree') {
    // blouse + skirt (bottomColor) + pleats + pallu over the left shoulder
    const pleatsTop = j.hip[1] - b.legW * 0.5;
    const hem = j.ground - b.legW * 0.55;
    pen.shape(
      [
        [j.hip[0] - b.waistW, pleatsTop],
        [j.hip[0] + b.waistW, pleatsTop],
        [j.hip[0] + b.hipW * 1.35, hem],
        [j.hip[0] - b.hipW * 1.35, hem],
      ],
      o.bottomColor,
      { part: 'saree-skirt', shade: true, tension: 0.25 }
    );
    for (let k = -2; k <= 2; k++) pen.line([[j.hip[0] + k * b.waistW * 0.25, pleatsTop + b.legW], [j.hip[0] + k * b.hipW * 0.4, hem - 4]], shade(o.bottomColor, -0.18), 1, { opacity: 0.55 });
    pen.line([[j.hip[0] - b.hipW * 1.33, hem - 3], [j.hip[0] + b.hipW * 1.33, hem - 3]], o.patternColor === '#FFFFFF' ? '#D4A537' : o.patternColor, 3);
    pen.shape(torsoPts(ctx, -b.torso * 0.45), c, { part: 'blouse', shade: true });
    pen.shape(
      [
        [j.neck[0] - b.shoulderW * 0.95, j.neck[1] + b.limbW * 0.1],
        [j.neck[0] - b.shoulderW * 0.35, j.neck[1] - b.H * 0.02],
        [j.hip[0] + b.waistW * 1.1, j.hip[1] - b.legW * 0.3],
        [j.hip[0] + b.waistW * 0.5, j.hip[1] + b.legW * 0.6],
      ],
      o.bottomColor,
      { part: 'pallu', shade: true, tension: 0.3 }
    );
    return;
  }
  const pts = torsoPts(ctx, long, flare);
  pen.shape(pts, o.top === 'jacket' ? '#F5F1E8' : c, { part: o.top, shade: true, tension: 0.4 });
  if (o.pattern !== 'none' && o.top !== 'jacket') {
    const pid = pen.pattern(o.pattern, o.patternColor, b.H * 0.2);
    pen.raw(`<path d="${smooth(pts)}" fill="${pid}" opacity="0.55"/>`);
  }
  const n = j.neck;
  // neckline / collar
  if (o.top === 'shirt' || o.top === 'uniform') {
    pen.shape([[n[0] - b.H * 0.16, n[1] - b.H * 0.03], [n[0], n[1] + b.H * 0.16], [n[0] - b.H * 0.05, n[1] + b.H * 0.2], [n[0] - b.H * 0.2, n[1] + b.H * 0.06]], shade(c, 0.12), { tension: 0, part: 'collar' });
    pen.shape([[n[0] + b.H * 0.16, n[1] - b.H * 0.03], [n[0], n[1] + b.H * 0.16], [n[0] + b.H * 0.05, n[1] + b.H * 0.2], [n[0] + b.H * 0.2, n[1] + b.H * 0.06]], shade(c, 0.12), { tension: 0 });
    for (let i = 1; i <= 3; i++) pen.circle([n[0], n[1] + b.H * 0.12 + i * b.torso * 0.2], b.H * 0.025, shade(c, -0.3), { outline: 0 });
    if (o.top === 'uniform') {
      pen.shape([[n[0] - b.H * 0.05, n[1] + b.H * 0.16], [n[0] + b.H * 0.05, n[1] + b.H * 0.16], [n[0] + b.H * 0.07, n[1] + b.torso * 0.6], [n[0], n[1] + b.torso * 0.7], [n[0] - b.H * 0.07, n[1] + b.torso * 0.6]], s.accessoryColor, { tension: 0.1, part: 'tie' });
      pen.shape([[n[0] - b.shoulderW * 0.75, n[1] + b.torso * 0.3], [n[0] - b.shoulderW * 0.3, n[1] + b.torso * 0.3], [n[0] - b.shoulderW * 0.3, n[1] + b.torso * 0.45], [n[0] - b.shoulderW * 0.75, n[1] + b.torso * 0.45]], shade(c, -0.08), { tension: 0, part: 'pocket' });
    }
  } else if (o.top === 'kurta') {
    pen.line([[n[0], n[1] + b.H * 0.02], [n[0], n[1] + b.torso * 0.35]], shade(c, -0.25), 1.6);
    for (let i = 0; i < 3; i++) pen.circle([n[0] + b.H * 0.04, n[1] + b.torso * (0.1 + i * 0.09)], b.H * 0.02, '#D4A537', { outline: 0 });
    // side slits
    const hemY = j.hip[1] + b.legW * 0.35 + long;
    for (const k of [-1, 1]) pen.line([[j.hip[0] + k * (b.hipW + flare) * 0.97, hemY], [j.hip[0] + k * (b.hipW + flare) * 0.9, hemY - long * 0.45]], shade(c, -0.25), 1.4);
  } else if (o.top === 'jacket') {
    for (const k of [-1, 1] as const) {
      const panel: Pt[] = [
        [n[0] + k * b.H * 0.1, n[1] - b.H * 0.03],
        [n[0] + k * b.shoulderW, n[1] + b.limbW * 0.25],
        [n[0] + k * b.shoulderW * 0.95, lerp(n[1], j.hip[1], 0.3)],
        [j.hip[0] + k * (b.waistW + b.belly * b.waistW * 0.35), lerp(n[1], j.hip[1], 0.62)],
        [j.hip[0] + k * b.hipW, j.hip[1] + b.legW * 0.35 + long],
        [j.hip[0] + k * b.H * 0.06, j.hip[1] + b.legW * 0.35 + long],
        [n[0] + k * b.H * 0.05, n[1] + b.torso * 0.42],
      ];
      pen.shape(panel, c, { part: `jacket-${k < 0 ? 'left' : 'right'}`, shade: true, tension: 0.25 });
    }
  } else if (o.top === 'robe') {
    pen.shape([[j.hip[0] - b.waistW * 1.1, j.hip[1] - b.legW * 0.45], [j.hip[0] + b.waistW * 1.1, j.hip[1] - b.legW * 0.45], [j.hip[0] + b.waistW * 1.1, j.hip[1] - b.legW * 0.05], [j.hip[0] - b.waistW * 1.1, j.hip[1] - b.legW * 0.05]], s.accessoryColor, { part: 'sash', tension: 0.2 });
  } else {
    // round neckline
    pen.line([[n[0] - b.H * 0.13, n[1] - b.H * 0.01], [n[0], n[1] + b.H * 0.08], [n[0] + b.H * 0.13, n[1] - b.H * 0.01]], shade(c, -0.25), 1.4);
  }
}

const smooth = (pts: Pt[]) => {
  // plain smooth path for overlays (pattern) — no wobble so it lines up with the shape underneath
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (const p of pts.slice(1)) d += ` L${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
  return `${d}Z`;
};

function arms(ctx: Ctx) {
  const { pen, j, b, s } = ctx;
  const skin = skinOf(ctx);
  const o = s.outfit;
  const sleeve = o.top === 'tshirt' || o.top === 'dress' || o.top === 'saree' ? 'short' : o.top === 'robe' ? 'wide' : 'long';
  const sleeveColor = o.top === 'saree' ? o.topColor : o.topColor;
  for (const i of [0, 1] as const) {
    const chain = [j.shoulder[i], j.elbow[i], j.hand[i]];
    pen.shape(limbPts(chain, [b.limbW * 1.1, b.limbW * 0.95, b.limbW * 0.78]), skin, { part: `arm-${i ? 'right' : 'left'}`, shade: true });
    if (sleeve === 'short') pen.shape(limbPts([j.shoulder[i], lerpPt(j.shoulder[i], j.elbow[i], 0.55)], [b.limbW * 1.45, b.limbW * 1.3]), sleeveColor, { part: 'sleeve', shade: true });
    else {
      const end = lerpPt(j.elbow[i], j.hand[i], sleeve === 'wide' ? 0.8 : 0.78);
      const w = sleeve === 'wide' ? [1.5, 1.55, 1.9] : [1.4, 1.25, 1.15];
      pen.shape(limbPts([j.shoulder[i], j.elbow[i], end], w.map((x) => x * b.limbW)), o.top === 'jacket' ? o.topColor : sleeveColor, { part: 'sleeve', shade: true });
    }
    // hand: palm + thumb, oriented along the forearm
    const dir = norm(sub(j.hand[i], j.elbow[i]));
    const palm = add(j.hand[i], mul(dir, b.limbW * 0.25));
    pen.circle(palm, b.limbW * 0.62, skin, { part: 'hand', shade: true });
    const thumbSide = i === 0 ? 1 : -1;
    pen.ellipse(add(palm, add(mul(perp(dir), thumbSide * b.limbW * 0.5), mul(dir, -b.limbW * 0.1))), b.limbW * 0.22, b.limbW * 0.34, skin, { rot: (Math.atan2(dir[1], dir[0]) * 180) / Math.PI });
  }
}

function neck({ pen, j, b, s }: Ctx) {
  const top: Pt = [j.head[0], j.head[1] + b.headR * 0.75];
  pen.shape(limbPts([top, [j.neck[0], j.neck[1] + b.H * 0.04]], [b.H * 0.22, b.H * 0.24]), s.skin, { part: 'neck', outline: 0.6 });
  pen.ellipse([j.head[0], top[1] + b.H * 0.04], b.H * 0.12, b.H * 0.04, shade(s.skin, -0.1), { outline: 0, opacity: 0.6 });
}

function headBox({ j, b }: Ctx) {
  const c = j.head;
  const rx = b.headR;
  const ry = b.H * 0.5;
  return { c, rx, ry };
}

function headShape(ctx: Ctx): Pt[] {
  const { c, rx, ry } = headBox(ctx);
  const shp = ctx.s.face.shape;
  const opts = { round: { square: 0, jaw: 0.05, chin: 0 }, oval: { square: 0, jaw: 0.18, chin: 0.05 }, square: { square: 0.6, jaw: 0.06, chin: 0 }, heart: { square: 0.1, jaw: 0.36, chin: 0.12 }, long: { square: 0.15, jaw: 0.16, chin: 0.06 } }[shp];
  const rxx = shp === 'long' ? rx * 0.88 : shp === 'round' ? rx * 1.04 : rx;
  return faceOutline(c, rxx, ry, opts);
}

function ears(ctx: Ctx) {
  const { pen, s } = ctx;
  const { c, rx } = headBox(ctx);
  if (s.hair.style === 'long' || s.accessories.includes('turban')) return;
  for (const k of [-1, 1]) {
    pen.ellipse([c[0] + k * rx * 0.97, c[1] + rx * 0.08], rx * 0.17, rx * 0.25, s.skin, { part: 'ear' });
    if (s.accessories.includes('earrings')) pen.circle([c[0] + k * rx * 0.98, c[1] + rx * 0.36], rx * 0.07, '#D4A537', { outline: 0.5 });
  }
}

function head(ctx: Ctx) {
  ctx.pen.shape(headShape(ctx), ctx.s.skin, { part: 'face-shape', shade: true, tension: 0.6 });
}

function face(ctx: Ctx) {
  const { pen, s, e, t, ink } = ctx;
  const { c, rx, ry } = headBox(ctx);
  const eyeY = c[1] + ry * 0.05;
  const gap = rx * (s.age === 'child' ? 0.4 : 0.37);
  const eyeR = rx * (t.eyes === 'cartoon' ? 0.2 : t.eyes === 'storybook' ? 0.1 : 0.085) * (s.age === 'child' ? 1.15 : 1);
  const shapeK = s.face.eyes === 'narrow' ? 0.7 : s.face.eyes === 'almond' ? 0.85 : 1;
  pen.group('face', () => {
    // cheeks
    if (t.blush && e.blush > 0) for (const k of [-1, 1]) pen.ellipse([c[0] + k * rx * 0.55, eyeY + ry * 0.32], rx * 0.17, rx * 0.1, '#F28B82', { raw: true, outline: 0, opacity: 0.35 * e.blush + 0.1 });
    if (s.face.freckles) for (const k of [-1, 1]) for (let i = 0; i < 4; i++) pen.circle([c[0] + k * rx * (0.42 + (i % 2) * 0.12), eyeY + ry * (0.22 + Math.floor(i / 2) * 0.08)], rx * 0.022, shade(s.skin, -0.3), { raw: true, outline: 0 });
    // eyes
    for (const k of [-1, 1] as const) {
      const ec: Pt = [c[0] + k * gap, eyeY];
      if (e.smileEyes && t.eyes !== 'cartoon') {
        // happy closed eyes: upward arcs
        pen.line([[ec[0] - eyeR * 1.4, ec[1] + eyeR * 0.3], [ec[0], ec[1] - eyeR * 0.9], [ec[0] + eyeR * 1.4, ec[1] + eyeR * 0.3]], ink, 1.5, { raw: true, tension: 0.6 });
        continue;
      }
      const open = e.eyeOpen * shapeK;
      if (t.eyes === 'cartoon') {
        const ry2 = eyeR * 1.25 * open;
        pen.ellipse(ec, eyeR, ry2, '#FFFFFF', { raw: true, outline: 0.8, stroke: ink });
        const pr = eyeR * 0.62 * e.pupil;
        const pc: Pt = [ec[0] + e.look[0] * eyeR * 0.5, ec[1] + e.look[1] * ry2 * 0.5 + ry2 * 0.12];
        pen.circle(pc, pr, s.face.eyeColor, { raw: true, outline: 0 });
        pen.circle(pc, pr * 0.55, '#111111', { raw: true, outline: 0 });
        pen.circle([pc[0] - pr * 0.35, pc[1] - pr * 0.4], pr * 0.28, '#FFFFFF', { raw: true, outline: 0 });
        if (e.smileEyes) pen.shape([[ec[0] - eyeR * 1.2, ec[1] + ry2 * 1.1], [ec[0], ec[1] + ry2 * 0.35], [ec[0] + eyeR * 1.2, ec[1] + ry2 * 1.1]], s.skin, { tension: 0.6, outline: 0 });
      } else {
        const ry2 = eyeR * 1.35 * Math.max(0.35, open);
        pen.ellipse([ec[0] + e.look[0] * eyeR * 0.3, ec[1] + e.look[1] * eyeR * 0.5], eyeR * e.pupil ** 0.3, ry2, ink, { raw: true, outline: 0 });
        if (t.eyes === 'storybook') pen.circle([ec[0] - eyeR * 0.3, ec[1] - ry2 * 0.4], eyeR * 0.35, '#FFFFFF', { raw: true, outline: 0 });
        if (e.eyeOpen > 1.1) pen.ellipse(ec, eyeR * 2, ry2 * 1.5, ink, { raw: true, outline: 0, opacity: 0 }); // keeps layout parity
      }
      // eyelid line for narrow/almond eyes
      if (s.face.eyes !== 'round' && t.eyes !== 'dot') pen.line([[ec[0] - eyeR * 1.2, ec[1] - eyeR * 0.6], [ec[0] + eyeR * 1.2, ec[1] - eyeR * 0.75]], ink, 0.8, { raw: true });
    }
    // nose
    const ny = eyeY + ry * 0.27;
    if (s.face.nose === 'button') pen.ellipse([c[0], ny], rx * 0.07, rx * 0.05, shade(s.skin, -0.12), { outline: 0 });
    else if (s.face.nose === 'pointed') pen.line([[c[0] + rx * 0.02, eyeY + ry * 0.05], [c[0] + rx * 0.08, ny + rx * 0.02], [c[0] - rx * 0.03, ny + rx * 0.05]], shade(s.skin, -0.3), 1.1, { raw: true });
    else if (s.face.nose === 'wide') pen.line([[c[0] - rx * 0.1, ny], [c[0], ny + rx * 0.06], [c[0] + rx * 0.1, ny]], shade(s.skin, -0.3), 1.3, { raw: true });
    // mouth
    mouth(ctx, [c[0], eyeY + ry * 0.47], rx);
    // tear / sweat
    if (e.tear) pen.shape([[c[0] - gap, eyeY + eyeR * 1.4], [c[0] - gap + rx * 0.05, eyeY + ry * 0.3], [c[0] - gap, eyeY + ry * 0.36], [c[0] - gap - rx * 0.05, eyeY + ry * 0.3]], '#7FC8F8', { raw: true, outline: 0.4, stroke: '#3A86C8' });
    if (e.sweat) pen.shape([[c[0] + rx * 0.82, c[1] - ry * 0.45], [c[0] + rx * 0.9, c[1] - ry * 0.25], [c[0] + rx * 0.82, c[1] - ry * 0.2], [c[0] + rx * 0.74, c[1] - ry * 0.25]], '#9ED8FF', { raw: true, outline: 0.4, stroke: '#3A86C8' });
    if (s.accessories.includes('bindi')) pen.circle([c[0], eyeY - ry * 0.3], rx * 0.045, '#C1121F', { raw: true, outline: 0 });
  });
}

/** Brows sit ON TOP of the fringe (cartoon convention) so expressions always read. */
function brows(ctx: Ctx) {
  const { pen, s, e, t } = ctx;
  const { c, rx, ry } = headBox(ctx);
  const eyeY = c[1] + ry * 0.05;
  const gap = rx * (s.age === 'child' ? 0.4 : 0.37);
  const eyeR = rx * (t.eyes === 'cartoon' ? 0.2 : t.eyes === 'storybook' ? 0.1 : 0.085) * (s.age === 'child' ? 1.15 : 1);
  const col = s.hair.style === 'bald' || /^#(E|D|C|B)/i.test(s.hair.color) ? shade(s.skin, -0.4) : shade(s.hair.color, -0.08);
  for (const k of [-1, 1]) {
    const ecx = c[0] + k * gap;
    // tilt pivots around the brow centre; + tilt drops the inner end (angry), − lifts it (sad, scared)
    const by = eyeY - ry * (0.15 + e.browRaise) - eyeR * (t.eyes === 'cartoon' ? 0.75 : 0.6);
    const bw = rx * 0.19;
    const tan = Math.tan((e.browTilt * Math.PI) / 180);
    const inner: Pt = [ecx - k * bw, by + tan * bw];
    const outer: Pt = [ecx + k * bw, by - tan * bw * 0.4];
    const peak: Pt = [ecx, by - rx * 0.035 * (e.browTilt < 0 ? 1.4 : 1)];
    // skin-coloured halo first, so a dark brow still reads over a dark fringe
    pen.line([inner, peak, outer], s.skin, s.age === 'elder' ? 3.6 : 3.1, { raw: true });
    pen.line([inner, peak, outer], col, s.age === 'elder' ? 2.3 : 1.8, { raw: true, part: 'brow' });
  }
}

function mouth(ctx: Ctx, m: Pt, rx: number) {
  const { pen, e, ink, s } = ctx;
  const w = rx * 0.3 * e.mouthWidth;
  const curve = e.mouthCurve * rx * 0.13;
  const open = e.mouthOpen * rx * 0.32;
  if (e.mouthShape === 'o') {
    pen.ellipse([m[0], m[1] + rx * 0.02], w * 0.75, open * 0.75 + rx * 0.05, '#5A1E1E', { raw: true, outline: 0.7, stroke: ink });
    return;
  }
  if (open < rx * 0.03) {
    pen.line([[m[0] - w, m[1] - curve * 0.3], [m[0], m[1] + curve], [m[0] + w, m[1] - curve * 0.3]], ink, 1.4, { raw: true, part: 'mouth', tension: 0.6 });
    return;
  }
  const upper: Pt[] = e.mouthShape === 'wavy'
    ? [[m[0] - w, m[1]], [m[0] - w * 0.5, m[1] - rx * 0.03], [m[0], m[1] + rx * 0.01], [m[0] + w * 0.5, m[1] - rx * 0.03], [m[0] + w, m[1]]]
    : [[m[0] - w, m[1] - curve * 0.35], [m[0], m[1] + curve * 0.25], [m[0] + w, m[1] - curve * 0.35]];
  const lower: Pt[] = [[m[0] + w * 0.92, m[1] - curve * 0.25 + open * 0.15], [m[0], m[1] + curve * 0.6 + open], [m[0] - w * 0.92, m[1] - curve * 0.25 + open * 0.15]];
  const pts = [...upper, ...lower];
  pen.shape(pts, '#6B1F2A', { raw: true, outline: 0.8, stroke: ink, tension: 0.5, part: 'mouth' });
  if (e.mouthShape === 'teeth' || e.mouthCurve > 0.6) pen.shape([[m[0] - w * 0.75, m[1] - curve * 0.15], [m[0] + w * 0.75, m[1] - curve * 0.15], [m[0] + w * 0.6, m[1] + open * 0.3], [m[0] - w * 0.6, m[1] + open * 0.3]], '#FFFFFF', { raw: true, outline: 0, tension: 0.3 });
  if (e.mouthCurve > 0.6) pen.ellipse([m[0], m[1] + curve * 0.45 + open * 0.7], w * 0.45, open * 0.25, '#E5707E', { raw: true, outline: 0 });
  void s;
}

function beard(ctx: Ctx) {
  const { pen, s } = ctx;
  if (s.beard === 'none') return;
  const { c, rx, ry } = headBox(ctx);
  const col = s.hair.color;
  const my = c[1] + ry * 0.52;
  if (s.beard === 'moustache' || s.beard === 'full') {
    for (const k of [-1, 1]) pen.shape([[c[0], my - ry * 0.1], [c[0] + k * rx * 0.32, my - ry * 0.08], [c[0] + k * rx * 0.36, my - ry * 0.01], [c[0] + k * rx * 0.1, my - ry * 0.04]], col, { part: 'moustache', tension: 0.6 });
  }
  if (s.beard === 'full') {
    const pts: Pt[] = [];
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI * (0.02 + 0.96 * (i / 12));
      pts.push([c[0] + Math.cos(a) * rx * 0.97, c[1] + Math.sin(a) * ry * 1.12]);
    }
    const inner: Pt[] = [[c[0] - rx * 0.62, c[1] + ry * 0.22], [c[0] - rx * 0.3, my + ry * 0.2], [c[0] + rx * 0.3, my + ry * 0.2], [c[0] + rx * 0.62, c[1] + ry * 0.22]];
    pen.shape([...pts, ...inner], col, { part: 'beard', shade: true, tension: 0.5 });
  }
  if (s.beard === 'stubble') pen.shape(faceOutline(c, rx * 0.95, ry * 0.98, { jaw: 0.2 }).filter((p) => p[1] > c[1] + ry * 0.25), shade(s.skin, -0.12), { outline: 0, opacity: 0.55 });
}

// ---------------------------------------------------------------- hair (procedural shapes built on the head outline)
function hairBack(ctx: Ctx) {
  const { pen, s, b, r } = ctx;
  const { c, rx, ry } = headBox(ctx);
  const col = s.hair.color;
  const hr = r.fork('hair-back');
  switch (s.hair.style) {
    case 'long': {
      const bottom = c[1] + ry * 2.3;
      const pts: Pt[] = [[c[0] - rx * 1.1, c[1] - ry * 0.2], ...Array.from({ length: 7 }, (_, i) => [c[0] - rx * 1.25 + (rx * 2.5 * i) / 6, bottom + Math.sin(i * 1.7 + hr()) * ry * 0.12] as Pt), [c[0] + rx * 1.1, c[1] - ry * 0.2], [c[0], c[1] - ry * 1.1]];
      pen.shape(pts, col, { part: 'hair-back', shade: true, tension: 0.5 });
      break;
    }
    case 'bob':
      pen.shape([[c[0] - rx * 1.12, c[1] - ry * 0.3], [c[0] - rx * 1.15, c[1] + ry * 0.75], [c[0] + rx * 1.15, c[1] + ry * 0.75], [c[0] + rx * 1.12, c[1] - ry * 0.3], [c[0], c[1] - ry * 1.12]], col, { part: 'hair-back', shade: true, tension: 0.45 });
      break;
    case 'ponytail': {
      const root: Pt = [c[0] + rx * 0.75, c[1] - ry * 0.55];
      const tail = [root, [c[0] + rx * 1.45, c[1] - ry * 0.1], [c[0] + rx * 1.3, c[1] + ry * 0.9], [c[0] + rx * 1.05, c[1] + ry * 1.5]] as Pt[];
      pen.shape(limbPts(tail, [rx * 0.42, rx * 0.5, rx * 0.36, rx * 0.12]), col, { part: 'ponytail', shade: true });
      break;
    }
    case 'braid': {
      let p: Pt = [c[0] + rx * 1.02, c[1] + ry * 0.1];
      for (let i = 0; i < 7; i++) {
        pen.ellipse(p, rx * 0.17, rx * 0.22, col, { part: 'braid', shade: true, rot: 15 });
        p = add(p, [rx * 0.08, rx * 0.3]);
      }
      pen.line([add(p, [-rx * 0.1, -rx * 0.1]), add(p, [rx * 0.12, -rx * 0.06])], s.accessoryColor, 3);
      break;
    }
    case 'curly':
      pen.shape(bumpyPts([c[0], c[1] - ry * 0.05], rx * 1.12, ry * 1.08, 11, 0.12, Math.PI * 0.9, Math.PI * 2.1), col, { part: 'hair-back', shade: true, tension: 0.5 });
      break;
    default:
      break;
  }
  void b;
}

function hairFront(ctx: Ctx) {
  const { pen, s, r } = ctx;
  const { c, rx, ry } = headBox(ctx);
  const col = s.hair.color;
  const style = s.hair.style;
  if (style === 'bald') {
    if (s.age === 'elder') for (const k of [-1, 1]) pen.shape(blobPts([c[0] + k * rx * 0.95, c[1] - ry * 0.05], rx * 0.18, r.fork(`tuft${k}`), { n: 8, amp: 0.25, squash: 1.6 }), col, { part: 'hair' });
    return;
  }
  if (s.accessories.includes('turban')) return; // turban covers the hair
  const hr = r.fork('hair-front');
  // crown arc: from the left temple over the top to the right temple (slightly larger than the skull)
  const crown: Pt[] = [];
  const spiky = style === 'spiky';
  const n = spiky ? 15 : 12;
  for (let i = 0; i <= n; i++) {
    const a = Math.PI * (1.02 + 0.96 * (i / n));
    const k = spiky ? (i % 2 ? 1.32 : 1.05) : style === 'curly' ? 1.1 + 0.07 * Math.abs(Math.sin(i * 1.9)) : 1.07;
    crown.push([c[0] + Math.cos(a) * rx * k, c[1] + Math.sin(a) * ry * k]);
  }
  // hairline: fringe running back from the right temple to the left one, scalloped by the seed
  const lineY = c[1] - ry * (style === 'bun' || style === 'ponytail' ? 0.5 : 0.38);
  const scallops = style === 'bun' || style === 'ponytail' ? 1 : hr.int(3, 5);
  const fringe: Pt[] = [];
  const sideDrop = style === 'short' || style === 'spiky' || style === 'curly' ? ry * 0.15 : ry * 0.45;
  fringe.push([c[0] + rx * 1.02, c[1] + sideDrop * 0.2]);
  for (let i = 0; i <= scallops * 2; i++) {
    const t = i / (scallops * 2);
    const x = c[0] + rx * 0.92 - rx * 1.84 * t;
    const dip = i % 2 ? ry * (0.08 + hr() * 0.1) : 0;
    const part = style === 'long' || style === 'bob' ? Math.max(0, 1 - Math.abs(t - 0.35) * 4) * ry * 0.22 : 0; // side parting
    fringe.push([x, lineY + dip - part + Math.abs(t - 0.5) * ry * 0.15]);
  }
  fringe.push([c[0] - rx * 1.02, c[1] + sideDrop * 0.2]);
  pen.shape([...crown, ...fringe], col, { part: 'hair', shade: true, tension: spiky ? 0.15 : 0.5 });
  if (style === 'bun') pen.circle([c[0], c[1] - ry * 1.12], rx * 0.38, col, { part: 'bun', shade: true });
  // shine streak for storybook / cartoon
  if (ctx.t.shading !== 'none') pen.line([[c[0] - rx * 0.5, c[1] - ry * 0.85], [c[0] - rx * 0.15, c[1] - ry * 1.0]], shade(col, 0.25), 1.6, { opacity: 0.7, raw: true });
}

function headwear(ctx: Ctx) {
  const { pen, s } = ctx;
  const { c, rx, ry } = headBox(ctx);
  const col = s.accessoryColor;
  const a = s.accessories;
  if (a.includes('turban')) {
    // wrapped bands: stacked curved layers + a knot
    const tc = mixHex(col, '#FFFFFF', 0.05);
    pen.shape(bumpyPts([c[0], c[1] - ry * 0.35], rx * 1.12, ry * 0.85, 3, 0.05, Math.PI, Math.PI * 2).concat([[c[0] + rx * 1.1, c[1] - ry * 0.22], [c[0] - rx * 1.1, c[1] - ry * 0.22]]), tc, { part: 'turban', shade: true });
    for (let i = 0; i < 3; i++) pen.line([[c[0] - rx * (1 - i * 0.12), c[1] - ry * (0.3 + i * 0.22)], [c[0] + rx * 0.2, c[1] - ry * (0.55 + i * 0.25)], [c[0] + rx * (1 - i * 0.1), c[1] - ry * (0.45 + i * 0.2)]], shade(tc, -0.2), 1.3, { opacity: 0.8 });
    pen.circle([c[0] + rx * 0.15, c[1] - ry * 0.75], rx * 0.13, shade(tc, -0.08), { part: 'turban-knot' });
  }
  if (a.includes('cap')) {
    pen.shape(ellipsePts([c[0], c[1] - ry * 0.45], rx * 1.06, ry * 0.68, 20).filter((p) => p[1] <= c[1] - ry * 0.42), col, { part: 'cap', shade: true });
    pen.shape([[c[0] + rx * 0.2, c[1] - ry * 0.48], [c[0] + rx * 1.55, c[1] - ry * 0.42], [c[0] + rx * 1.5, c[1] - ry * 0.32], [c[0] + rx * 0.2, c[1] - ry * 0.36]], shade(col, -0.1), { tension: 0.3, part: 'cap-brim' });
  }
  if (a.includes('hat')) {
    pen.ellipse([c[0], c[1] - ry * 0.62], rx * 1.75, ry * 0.2, col, { part: 'hat-brim', shade: true });
    pen.shape([[c[0] - rx * 0.85, c[1] - ry * 0.65], [c[0] - rx * 0.75, c[1] - ry * 1.45], [c[0] + rx * 0.75, c[1] - ry * 1.45], [c[0] + rx * 0.85, c[1] - ry * 0.65]], col, { part: 'hat', shade: true, tension: 0.3 });
    pen.line([[c[0] - rx * 0.83, c[1] - ry * 0.82], [c[0] + rx * 0.83, c[1] - ry * 0.82]], shade(col, -0.3), 3);
  }
  if (a.includes('crown')) {
    const base = c[1] - ry * 0.78;
    const pts: Pt[] = [[c[0] - rx * 0.8, base], [c[0] - rx * 0.85, base - ry * 0.55], [c[0] - rx * 0.42, base - ry * 0.22], [c[0], base - ry * 0.7], [c[0] + rx * 0.42, base - ry * 0.22], [c[0] + rx * 0.85, base - ry * 0.55], [c[0] + rx * 0.8, base]];
    pen.shape(pts, '#E9B949', { part: 'crown', shade: true, tension: 0 });
    for (const x of [-0.45, 0, 0.45]) pen.circle([c[0] + rx * x, base - ry * 0.1], rx * 0.07, x ? '#2A9D8F' : '#C1121F', { outline: 0.5 });
  }
  if (a.includes('glasses')) {
    const ey = c[1] + ry * 0.05;
    const gap = rx * 0.37;
    for (const k of [-1, 1]) pen.raw(`<circle cx="${(c[0] + k * gap).toFixed(1)}" cy="${ey.toFixed(1)}" r="${(rx * 0.2).toFixed(1)}" fill="#DDEEFF" fill-opacity="0.25" stroke="#2B2B2B" stroke-width="${(ctx.pen.u * 1.2).toFixed(1)}"/>`);
    pen.line([[c[0] - gap + rx * 0.2, ey], [c[0] + gap - rx * 0.2, ey]], '#2B2B2B', 1.2, { raw: true });
  }
}

function backpack(ctx: Ctx, straps: boolean) {
  const { pen, j, b, s } = ctx;
  const col = s.accessoryColor;
  if (!straps) {
    for (const k of [-1, 1]) pen.shape([[j.neck[0] + k * b.shoulderW * 0.7, j.neck[1] + b.H * 0.1], [j.neck[0] + k * b.shoulderW * 1.25, j.neck[1] + b.H * 0.25], [j.neck[0] + k * b.shoulderW * 1.25, j.hip[1] - b.H * 0.2], [j.neck[0] + k * b.shoulderW * 0.7, j.hip[1] - b.H * 0.1]], col, { part: 'backpack', shade: true, tension: 0.4 });
    return;
  }
  for (const k of [-1, 1]) pen.line([[j.neck[0] + k * b.shoulderW * 0.55, j.neck[1] + b.H * 0.02], [j.neck[0] + k * b.shoulderW * 0.62, lerp(j.neck[1], j.hip[1], 0.55)]], shade(col, -0.2), 3.2);
}

function necklace({ pen, j, b }: Ctx) {
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.15 + (0.7 * i) / 8);
    pen.circle([j.neck[0] + Math.cos(a) * b.H * 0.2, j.neck[1] + Math.sin(a) * b.H * 0.18], b.H * 0.03, i === 4 ? '#C1121F' : '#E9B949', { outline: 0.4 });
  }
}

function scarf({ pen, j, b, s }: Ctx) {
  const col = s.accessoryColor;
  pen.shape(ellipsePts([j.neck[0], j.neck[1] + b.H * 0.02], b.H * 0.24, b.H * 0.09, 16), col, { part: 'scarf', shade: true });
  pen.shape(limbPts([[j.neck[0] + b.H * 0.1, j.neck[1] + b.H * 0.05], [j.neck[0] + b.H * 0.16, j.neck[1] + b.torso * 0.55]], [b.H * 0.12, b.H * 0.14]), col, { shade: true });
}

function heldProp(ctx: Ctx) {
  const { pen, j, b, s } = ctx;
  const hand = j.hand[1];
  const u = b.H;
  switch (s.holding) {
    case 'lantern': {
      const top: Pt = [hand[0], hand[1] + u * 0.12];
      pen.line([hand, top], '#3B2A1A', 1.2);
      pen.raw(`<circle cx="${top[0].toFixed(1)}" cy="${(top[1] + u * 0.32).toFixed(1)}" r="${(u * 0.55).toFixed(1)}" fill="#FFD166" opacity="0.28"/>`);
      pen.shape([[top[0] - u * 0.16, top[1] + u * 0.08], [top[0] + u * 0.16, top[1] + u * 0.08], [top[0] + u * 0.2, top[1] + u * 0.52], [top[0] - u * 0.2, top[1] + u * 0.52]], '#FFD166', { part: 'lantern', tension: 0.2, shade: true });
      pen.shape([[top[0] - u * 0.22, top[1] + u * 0.02], [top[0] + u * 0.22, top[1] + u * 0.02], [top[0] + u * 0.18, top[1] + u * 0.1], [top[0] - u * 0.18, top[1] + u * 0.1]], '#7A4E2D', { tension: 0.1 });
      pen.shape([[top[0] - u * 0.24, top[1] + u * 0.5], [top[0] + u * 0.24, top[1] + u * 0.5], [top[0] + u * 0.2, top[1] + u * 0.58], [top[0] - u * 0.2, top[1] + u * 0.58]], '#7A4E2D', { tension: 0.1 });
      pen.shape([[top[0], top[1] + u * 0.18], [top[0] + u * 0.06, top[1] + u * 0.32], [top[0], top[1] + u * 0.42], [top[0] - u * 0.06, top[1] + u * 0.32]], '#FF8C42', { raw: true, outline: 0 });
      break;
    }
    case 'book':
      pen.shape([[hand[0] - u * 0.28, hand[1] - u * 0.22], [hand[0] + u * 0.28, hand[1] - u * 0.22], [hand[0] + u * 0.28, hand[1] + u * 0.18], [hand[0] - u * 0.28, hand[1] + u * 0.18]], '#B23A48', { part: 'book', tension: 0.1, shade: true });
      pen.line([[hand[0], hand[1] - u * 0.22], [hand[0], hand[1] + u * 0.18]], '#F5F1E8', 1.4);
      break;
    case 'stick':
      pen.shape(limbPts([[hand[0], hand[1] - u * 0.35], [hand[0] + u * 0.05, j.ground - 2]], [u * 0.08, u * 0.07]), '#8B5E34', { part: 'stick' });
      break;
    case 'basket':
      pen.shape([[hand[0] - u * 0.4, hand[1] + u * 0.05], [hand[0] + u * 0.4, hand[1] + u * 0.05], [hand[0] + u * 0.3, hand[1] + u * 0.5], [hand[0] - u * 0.3, hand[1] + u * 0.5]], '#C8955A', { part: 'basket', tension: 0.3, shade: true });
      for (let i = 1; i < 4; i++) pen.line([[hand[0] - u * (0.38 - i * 0.02), hand[1] + u * (0.05 + i * 0.11)], [hand[0] + u * (0.38 - i * 0.02), hand[1] + u * (0.05 + i * 0.11)]], '#8B5E34', 1);
      break;
    case 'phone':
      pen.shape([[hand[0] - u * 0.1, hand[1] - u * 0.32], [hand[0] + u * 0.1, hand[1] - u * 0.32], [hand[0] + u * 0.1, hand[1] + u * 0.02], [hand[0] - u * 0.1, hand[1] + u * 0.02]], '#222831', { part: 'phone', tension: 0.15 });
      break;
    case 'flag':
      pen.line([[hand[0], hand[1] + u * 0.3], [hand[0], hand[1] - u * 1.6]], '#5C4033', 1.6);
      pen.shape([[hand[0], hand[1] - u * 1.6], [hand[0] + u * 0.85, hand[1] - u * 1.45], [hand[0] + u * 0.8, hand[1] - u * 1.1], [hand[0], hand[1] - u * 1.15]], s.accessoryColor, { part: 'flag', tension: 0.4, shade: true });
      break;
    case 'umbrella': {
      const tip: Pt = [hand[0], hand[1] - u * 1.5];
      pen.line([[hand[0], hand[1] + u * 0.2], tip], '#3B2A1A', 1.4);
      pen.shape([...ellipsePts(tip, u * 1.1, u * 0.65, 24).filter((p) => p[1] <= tip[1] + 1), [tip[0] + u * 1.1, tip[1]]], s.accessoryColor, { part: 'umbrella', shade: true });
      break;
    }
    case 'pot':
      pen.shape(blobPts([hand[0], hand[1] - u * 0.2], u * 0.32, ctx.r.fork('pot'), { n: 12, amp: 0.04, squash: 0.85 }), '#B5532A', { part: 'pot', shade: true });
      break;
    case 'sword':
      pen.shape([[hand[0] - u * 0.05, hand[1]], [hand[0] + u * 0.05, hand[1]], [hand[0] + u * 0.04, hand[1] - u * 1.4], [hand[0], hand[1] - u * 1.55], [hand[0] - u * 0.04, hand[1] - u * 1.4]], '#CFD8DC', { part: 'sword', tension: 0 });
      pen.line([[hand[0] - u * 0.2, hand[1] - u * 0.05], [hand[0] + u * 0.2, hand[1] - u * 0.05]], '#D4A537', 2.4);
      break;
    case 'flower':
      pen.line([hand, [hand[0] + u * 0.05, hand[1] - u * 0.55]], '#4CB944', 1.2);
      for (let i = 0; i < 5; i++) pen.circle(polar([hand[0] + u * 0.05, hand[1] - u * 0.62], i * 72, u * 0.1), u * 0.09, '#F28482', { outline: 0.5 });
      pen.circle([hand[0] + u * 0.05, hand[1] - u * 0.62], u * 0.07, '#F6BD60', { outline: 0.5 });
      break;
    case 'ball':
      pen.circle([hand[0] + u * 0.1, hand[1] - u * 0.15], u * 0.26, '#E63946', { part: 'ball', shade: true });
      pen.line([[hand[0] - u * 0.14, hand[1] - u * 0.2], [hand[0] + u * 0.34, hand[1] - u * 0.1]], '#FFFFFF', 1, { raw: true });
      break;
    default:
      break;
  }
}

/** Utility for previews/editors: the face parameters of an expression (useful for sliders later). */
export const expressionParams = (e: Expression) => FACES[e];
export { mid };
