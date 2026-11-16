/**
 * Story scenes: for each narrated scene pick a place (background), actors (characters, animals, props),
 * a camera move and a hand-off transition, then build layered, animated timeline items from the asset library.
 * Shot grammar borrowed from motion-design practice (cf. video-shotcraft): establish → move → hand off.
 */
import type { AssetType } from '../src/assetkit/types.ts';
import { RECIPES, findRecipe } from '../src/assetkit/catalog.ts';
import type { EditItem, EffectId, SpriteMotion } from '../src/editor/types.ts';
import { ensureAsset, listAssets } from './assets.ts';
import { newId } from './edits.ts';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const PLAN_MODEL = process.env.OLLAMA_EDIT_MODEL || process.env.OLLAMA_MODEL || 'qwen2.5:3b';

export type Where = 'left' | 'center' | 'right' | 'far-left' | 'far-right' | 'sky' | 'back';
export type Camera = 'pushIn' | 'pullOut' | 'panLeft' | 'panRight' | 'tiltUp' | 'none';
export type Graphic = 'none' | 'stat' | 'chart' | 'highlight' | 'quote' | 'title';

export interface Actor {
  name: string;
  type?: AssetType;
  where: Where;
  motion: SpriteMotion;
  size?: 'small' | 'medium' | 'large';
}

export interface StoryPlan {
  place: string;
  time?: 'day' | 'sunset' | 'night' | 'dawn';
  actors: Actor[];
  camera: Camera;
  graphic: Graphic;
  title?: string;
  value?: number;
  suffix?: string;
  label?: string;
  data?: string;
  highlight?: string;
}

const PLACES = RECIPES.filter((r) => r.spec.type === 'background').map((r) => r.name);
const WHERE: Where[] = ['left', 'center', 'right', 'far-left', 'far-right', 'sky', 'back'];
const MOTIONS: SpriteMotion[] = ['walkIn', 'walkOut', 'walkAcross', 'bob', 'sway', 'float', 'fly', 'breathe', 'pop', 'slideUp'];
const CAMERAS: Camera[] = ['pushIn', 'pullOut', 'panLeft', 'panRight', 'tiltUp', 'none'];
const GRAPHICS: Graphic[] = ['none', 'stat', 'chart', 'highlight', 'quote', 'title'];

const round = (n: number) => Math.round(n * 100) / 100;
const words = (t: string) => t.toLowerCase().match(/[a-z]+/g) ?? [];

/** Default motion for an asset type. */
function defaultMotion(type: AssetType | undefined, i: number): SpriteMotion {
  if (type === 'bird') return 'fly';
  if (type === 'object') return 'float';
  if (type === 'tree' || type === 'building' || type === 'mountain') return 'sway';
  if (type === 'animal' || type === 'fish') return i === 0 ? 'walkIn' : 'bob';
  return i === 0 ? 'walkIn' : 'breathe';
}

// ---------------------------------------------------------------- heuristic planner (no LLM)
export function heuristicStory(scenes: string[]): StoryPlan[] {
  let place = 'village';
  const cams: Camera[] = ['pushIn', 'panRight', 'pullOut', 'panLeft', 'tiltUp'];
  return scenes.map((text, i) => {
    // place: first background recipe mentioned, else keep the previous place
    const bg = findRecipe(text, 'background');
    if (bg) place = bg.name;
    // actors: non-background recipes whose tags appear in the text
    const ws = new Set(words(text));
    const found: Actor[] = [];
    for (const rc of RECIPES) {
      if (rc.spec.type === 'background' || found.length >= 3) continue;
      if (rc.tags.some((t) => t.split(' ').every((w) => ws.has(w) || ws.has(`${w}s`)))) {
        if (!found.some((a) => a.name === rc.name)) found.push({ name: rc.name, type: rc.spec.type, where: 'center', motion: defaultMotion(rc.spec.type, found.length) });
      }
    }
    if (!found.length) found.push({ name: i % 2 ? 'speaker' : 'traveller', type: 'person', where: 'center', motion: i === 0 ? 'walkIn' : 'breathe' });
    const spots: Where[] = found.length === 1 ? ['center'] : found.length === 2 ? ['left', 'right'] : ['left', 'center', 'right'];
    found.forEach((a, k) => (a.where = a.type === 'bird' || a.name === 'cloud' || a.name === 'sun' ? 'sky' : spots[k]));
    const num = text.match(/(\d+(?:\.\d+)?)\s*(%|percent|million|billion|years?)?/i);
    return {
      place,
      actors: found,
      camera: cams[i % cams.length],
      graphic: i === 0 ? 'title' : num ? 'stat' : /[“"].+[”"]/.test(text) ? 'quote' : 'none',
      title: text.split(/\s+/).slice(0, 6).join(' ').replace(/[,.!?;:]+$/, ''),
      value: num ? Number(num[1]) : undefined,
      suffix: num?.[2] ? (/percent|%/i.test(num[2]) ? '%' : ` ${num[2]}`) : undefined,
      // label = the words right after the number ("400 million | people, more than…")
      label: num
        ? text
            .slice((num.index ?? 0) + num[0].length)
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 5)
            .join(' ')
            .replace(/[,.!?;:]+$/, '')
        : undefined,
    };
  });
}

// ---------------------------------------------------------------- LLM planner
export async function llmStory(scenes: string[]): Promise<StoryPlan[] | null> {
  const known = [...new Set([...RECIPES.filter((r) => r.spec.type !== 'background').map((r) => r.name), ...listAssets().filter((a) => a.style === 'any').map((a) => a.name)])];
  const prompt = `You are a storyboard artist for an illustrated explainer video. Each numbered scene is narrated exactly as written.
For EVERY scene decide what we SEE (the picture must change with the story):
- "place": the setting. Prefer one of: ${PLACES.join(', ')}. You may invent a short new one (e.g. "tea garden") if none fits.
- "time": day | sunset | night | dawn
- "actors": 1-3 things on screen, taken from what the scene talks about. Each: {"name","where","motion"}.
   name: prefer one of: ${known.slice(0, 80).join(', ')}. You may invent a new simple name (e.g. "camel", "fisherwoman") — it will be drawn.
   where: ${WHERE.join(' | ')}   (birds, sun, clouds → sky; buildings/trees → back)
   motion: ${MOTIONS.join(' | ')}   (people/animals arriving → walkIn; birds → fly; trees → sway; objects → float)
- "camera": ${CAMERAS.join(' | ')}  (vary it scene to scene)
- "graphic": ${GRAPHICS.join(' | ')}. title only for scene 0. stat only with a number in the scene → add "value","suffix","label". chart → "data" like "A:10, B:20". highlight → "highlight" (exact words). quote → "title" (short line).

SCENES:
${scenes.map((s, i) => `${i}: ${s}`).join('\n')}

Reply with ONLY JSON: {"scenes":[{"i":0,"place":"...","time":"day","actors":[{"name":"...","where":"left","motion":"walkIn"}],"camera":"pushIn","graphic":"title","title":"..."}]} — one entry per scene, in order.`;
  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: PLAN_MODEL,
        prompt,
        format: 'json',
        stream: false,
        ...(/qwen3|deepseek-r1|gpt-oss|magistral/i.test(PLAN_MODEL) ? { think: false } : {}),
        options: { temperature: 0.4, num_ctx: 8192 },
      }),
      signal: AbortSignal.timeout(1000 * 60 * 4),
    });
    if (!res.ok) return null;
    const parsed = JSON.parse(((await res.json()) as { response: string }).response) as { scenes?: Array<Record<string, unknown>> };
    const fallback = heuristicStory(scenes);
    return scenes.map((text, i) => {
      const raw = parsed.scenes?.find((s) => Number(s.i) === i) ?? parsed.scenes?.[i];
      const fb = fallback[i];
      if (!raw) return fb;
      const actors: Actor[] = (Array.isArray(raw.actors) ? raw.actors : [])
        .slice(0, 3)
        .map((a: Record<string, unknown>, k: number) => {
          const name = String(a.name ?? '').trim().toLowerCase().slice(0, 40);
          const type = findRecipe(name)?.spec.type;
          return {
            name,
            type,
            where: WHERE.includes(a.where as Where) ? (a.where as Where) : (['left', 'center', 'right'] as Where[])[k % 3],
            motion: MOTIONS.includes(a.motion as SpriteMotion) ? (a.motion as SpriteMotion) : defaultMotion(type, k),
          };
        })
        .filter((a) => a.name);
      const graphic = GRAPHICS.includes(raw.graphic as Graphic) ? (raw.graphic as Graphic) : fb.graphic;
      const plan: StoryPlan = {
        place: String(raw.place ?? fb.place).toLowerCase().slice(0, 40) || fb.place,
        time: ['day', 'sunset', 'night', 'dawn'].includes(String(raw.time)) ? (raw.time as StoryPlan['time']) : undefined,
        actors: actors.length ? actors : fb.actors,
        camera: CAMERAS.includes(raw.camera as Camera) ? (raw.camera as Camera) : fb.camera,
        graphic: i === 0 ? 'title' : graphic === 'title' ? 'none' : graphic,
        title: String(raw.title ?? fb.title ?? '').slice(0, 80),
        value: Number.isFinite(Number(raw.value)) ? Number(raw.value) : fb.value,
        suffix: raw.suffix !== undefined ? String(raw.suffix).slice(0, 12) : fb.suffix,
        label: raw.label !== undefined ? String(raw.label).slice(0, 60) : fb.label,
        data: raw.data !== undefined ? String(raw.data).slice(0, 200) : undefined,
        highlight: raw.highlight !== undefined ? String(raw.highlight).slice(0, 90) : undefined,
      };
      // numbers must really be in the narration
      if (plan.graphic === 'stat' && !/\d/.test(text)) plan.graphic = 'none';
      if (plan.graphic === 'chart' && !(plan.data && /:\s*\d/.test(plan.data))) plan.graphic = 'none';
      return plan;
    });
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- build layered items
interface Slot {
  x: number;
  y: number; // feet line (% of height), anchor bottom
  depth: number;
}

function slot(where: Where, portrait: boolean): Slot {
  const ground = portrait ? 88 : 92;
  switch (where) {
    case 'far-left':
      return { x: 14, y: ground - 4, depth: 0.85 };
    case 'left':
      return { x: portrait ? 28 : 30, y: ground, depth: 1.1 };
    case 'right':
      return { x: portrait ? 72 : 70, y: ground, depth: 1.1 };
    case 'far-right':
      return { x: 86, y: ground - 4, depth: 0.85 };
    case 'sky':
      return { x: 70, y: portrait ? 30 : 34, depth: 0.5 };
    case 'back':
      return { x: 50, y: portrait ? 76 : 80, depth: 0.7 };
    default:
      return { x: 50, y: ground + 2, depth: 1.2 };
  }
}

/** Sprite height as a fraction of frame height, by asset type. */
function sizeFor(type: AssetType, name: string, size?: Actor['size']) {
  const base: Record<string, number> = { person: 0.38, animal: 0.34, bird: 0.18, fish: 0.16, tree: 0.42, mountain: 0.45, building: 0.42, object: 0.2, background: 1 };
  let s = base[type] ?? 0.3;
  if (/elephant|giraffe|camel|horse/.test(name)) s *= 1.25;
  if (/cat|rabbit|dog|goat/.test(name)) s *= 0.7;
  if (size === 'large') s *= 1.25;
  if (size === 'small') s *= 0.7;
  return s;
}

export async function buildStoryScene(
  plan: StoryPlan,
  from: number,
  dur: number,
  style: string,
  aspect: string,
  frame: { width: number; height: number },
  onAsset?: (name: string) => void
): Promise<EditItem[]> {
  const portrait = frame.height > frame.width;
  const items: EditItem[] = [];
  // background (place) — slow parallax at depth 0.35
  // a night / sunset / dawn version of a known place is its own cached asset ("village night")
  const rc = findRecipe(plan.place, 'background');
  const timed = plan.time && plan.time !== 'day' && rc && rc.spec.type === 'background' && !/night|sunset|dawn/.test(plan.place);
  const placeName = timed ? `${rc.name} ${plan.time}` : plan.place;
  onAsset?.(placeName);
  const bg = await ensureAsset(placeName, { style, type: 'background', aspect, spec: timed ? { ...rc.spec, type: 'background', time: plan.time } : undefined });
  items.push({ id: newId('bg'), kind: 'image', name: `Place · ${plan.place}`, track: 1, from: round(from), duration: round(dur), src: bg.url, fit: 'cover', scale: 1, x: 50, y: 50, depth: 0.35, motion: 'kenBurns', assetId: bg.id });

  // actors
  const used = new Set<string>();
  const LANDSCAPE = /\b(river|glacier|wetland|valley|lake|sea|ocean|field|forest|jungle|sky|land|landscape|desert|city|village|mountains|hills|delta|monsoon|flood|water body)\b/i;
  for (const [k, a] of plan.actors.entries()) {
    // landscapes are places, not actors (they belong in the background)
    const rcType = findRecipe(a.name)?.spec.type;
    if (rcType === 'background' || (!rcType && LANDSCAPE.test(a.name))) continue;
    const where = used.has(a.where) ? (['left', 'right', 'center', 'far-left', 'far-right'] as Where[]).find((w) => !used.has(w)) ?? a.where : a.where;
    used.add(where);
    onAsset?.(a.name);
    const asset = await ensureAsset(a.name, { style, type: a.type });
    const s = slot(where, portrait);
    const hFrac = sizeFor(asset.type, a.name, a.size);
    const scale = (hFrac * frame.height) / frame.width; // sprite PNGs are square
    const enterDelay = 0.25 + k * 0.35;
    items.push({
      id: newId('act'),
      kind: 'image',
      name: a.name,
      track: where === 'back' || where === 'sky' ? 2 : 3 + (where === 'center' ? 1 : 0),
      from: round(from + Math.min(enterDelay, dur * 0.3)),
      duration: round(Math.max(1, dur - Math.min(enterDelay, dur * 0.3))),
      src: asset.url,
      fit: 'contain',
      scale: round(scale),
      x: s.x,
      y: s.y,
      anchor: 'bottom',
      motion: a.motion,
      flip: (where === 'right' || where === 'far-right') && a.motion !== 'walkAcross' && a.motion !== 'fly' ? true : undefined,
      depth: s.depth,
      assetId: asset.id,
    });
  }

  // camera move across the whole scene
  if (plan.camera !== 'none') {
    items.push({ id: newId('cam'), kind: 'effect', name: `Camera · ${plan.camera}`, track: 1, from: round(from), duration: round(dur), effect: plan.camera as EffectId, intensity: 1 });
  }
  return items;
}

/** Alternate hand-off transitions between scenes. */
export function transitionAt(cut: number, i: number): EditItem {
  const effect: EffectId = i % 3 === 1 ? 'irisWipe' : 'whipPan';
  const d = effect === 'irisWipe' ? 0.8 : 0.5;
  return { id: newId('tr'), kind: 'effect', name: effect === 'irisWipe' ? 'Iris wipe' : 'Whip pan', track: 1, from: round(Math.max(0, cut - d / 2)), duration: d, effect, intensity: 1 };
}
