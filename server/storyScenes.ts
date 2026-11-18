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
import { objectNames } from './objectdb.ts';
import { castFor, isPersonName, renderCharacter, renderEnvironment, renderParticles, vectorActorKind } from './vector.ts';
import { EXPRESSIONS, type Expression } from '../src/vector/character.ts';
import { POSES, type Pose } from '../src/vector/skeleton.ts';
import { normaliseEnv } from '../src/vector/environment.ts';
import { isTheme } from '../src/vector/theme.ts';
import { SEQUENCES } from '../src/motion/sequences.ts';
import { VIDEO_TYPES, type VideoType } from '../src/videotypes.ts';

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
  pose?: Pose; // people (procedural themes)
  expression?: Expression;
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
  mood?: Expression; // the scene's emotional tone → default face for its people
  motion?: { id: string; params: Record<string, string | number> }; // a catalogue sequence for this beat
}

/** Sequences the storyboard may use for a narrated beat (each is a short full-screen explainer cutaway). */
export const STORY_SEQUENCES = ['bigStat', 'chartExplain', 'comparison', 'timelineHistory', 'processExplain', 'quoteStatement', 'mapInvestigation', 'mythVsFact', 'rankingCountdown', 'moneyBreakdown', 'causeEffect', 'questionReveal', 'dataStory', 'globalStats', 'newsHeadline'];

/**
 * Keep a planned sequence only if it is real, has every parameter it needs (so no sample text leaks in),
 * and every number in it is actually said in the scene.
 */
export function cleanMotion(raw: unknown, text: string, allowed: string[] = STORY_SEQUENCES): StoryPlan['motion'] {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as { id?: unknown; params?: unknown };
  const id = String(r.id ?? '');
  const seq = SEQUENCES[id];
  if (!seq || !allowed.includes(id)) return undefined;
  const given = (r.params && typeof r.params === 'object' ? r.params : {}) as Record<string, unknown>;
  const params: Record<string, string | number> = {};
  const said = (text.match(/\d[\d,.]*/g) ?? []).map((n) => n.replace(/,/g, ''));
  for (const key of Object.keys(seq.params)) {
    if (key === 'bg') continue;
    const v = given[key];
    if (v === undefined || v === null || String(v).trim() === '') return undefined;
    params[key] = typeof v === 'number' ? v : String(v).slice(0, 300);
    const nums = String(v).match(/\d[\d,.]*/g) ?? [];
    if (nums.some((n) => !said.some((s) => s === n.replace(/,/g, '') || s.startsWith(n.replace(/,/g, ''))))) return undefined;
  }
  return { id, params };
}


/** Scene mood from the narration (fallback when the LLM gives none). */
export function moodOf(text: string): Expression {
  const t = text.toLowerCase();
  const score: [Expression, RegExp][] = [
    ['scared', /\b(afraid|scared|fear|frighten|danger|terrif|tremb|monster|panic|hid|hide)\w*/g],
    ['sad', /\b(sad|cry|cried|tears?|lost|lonely|alone|died|death|miss(ed)?|sorrow|grief|dark(ness)?|not a single)\b/g],
    ['angry', /\b(angry|anger|furious|shout|shouted|fight|rage|cruel)\w*/g],
    ['surprised', /\b(suddenly|surpris|amaz|astonish|wow|discover|shock|could not believe|unexpected)\w*/g],
    ['happy', /\b(happy|joy|smil|laugh|celebrat|love[sd]?|glow|beautiful|wonderful|delight|friends?|together|return(ed|s)?|dance)\w*/g],
  ];
  // Hindi (Devanagari has no \b word boundaries, so plain substrings)
  score.push(
    ['scared', /डर|ख़तरा|खतरा|काँप|कांप|भयभीत|छिप/g],
    ['sad', /दुख|दुःख|रो[ईएया]|आँसू|आंसू|अकेल|अँधेर|अंधेर|उदास|एक भी नहीं/g],
    ['angry', /गुस्सा|ग़ुस्सा|क्रोध|चिल्ला|लड़ाई/g],
    ['surprised', /अचानक|हैरान|चौंक|आश्चर्य/g],
    ['happy', /ख़ुशी|खुशी|हँस|हंस|मुस्कान|मुस्कुरा|नाच|प्यार|सुंदर|जगमग|लौट आ|साथ/g]
  );
  let best: Expression = 'neutral';
  let n = 0;
  for (const [e, re] of score) {
    const c = (t.match(re) ?? []).length;
    if (c > n) [best, n] = [e, c];
  }
  return best;
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
      mood: moodOf(text),
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
export async function llmStory(scenes: string[], videoType?: VideoType): Promise<StoryPlan[] | null> {
  const vt = videoType ? VIDEO_TYPES[videoType] : null;
  // which explainer sequences fit this kind of video, and how often
  const seqs = vt ? vt.sequences : STORY_SEQUENCES;
  const every = vt ? vt.sequenceEvery : 3;
  const everyText = every === 0 ? 'only for a direct quotation, otherwise leave it out' : every === 2 ? 'at most every second scene' : 'at most every third scene';
  const catalogued = objectNames();
  const known = [...new Set([...catalogued, ...RECIPES.filter((r) => r.spec.type !== 'background').map((r) => r.name), ...(catalogued.length ? [] : listAssets().filter((a) => a.style === 'any').map((a) => a.name))])];
  const prompt = `You are a storyboard artist for an illustrated video. Each numbered scene is narrated exactly as written.${vt ? `\n${vt.plannerHint}` : ''}
For EVERY scene decide what we SEE (the picture must change with the story):
- "place": the setting. Prefer one of: ${PLACES.join(', ')}. You may invent a short new one (e.g. "tea garden") if none fits.
- "time": day | sunset | night | dawn
- "actors": 1-3 things on screen, taken from what the scene talks about. Each: {"name","where","motion"}.
   name: use the plain name of the thing the narration mentions (e.g. "firefly" for "fireflies", never a tree for lights). Prefer an exact name from this library: ${known.slice(0, 600).join(', ')}. If nothing there fits, invent a simple name (e.g. "camel", "fisherwoman") — it will be drawn. Never use abstract things (wind, light, sound, love) as actors.
   where: ${WHERE.join(' | ')}   (birds, sun, clouds → sky; buildings/trees → back)
   motion: ${MOTIONS.join(' | ')}   (people/animals arriving → walkIn; birds → fly; trees → sway; objects → float)
   For PEOPLE also add "pose": ${POSES.join(' | ')} and "expression": ${EXPRESSIONS.join(' | ')} matching what they do and feel. Always call the same person by the same name (e.g. "Meera", not "the girl" later).
- "mood": ${EXPRESSIONS.join(' | ')} — the feeling of the scene
- "motion" (optional, ${everyText}): an explainer graphic for a beat that is about numbers, a comparison, dates, a process, a quote, a place or a myth. {"id": one of ${seqs.join(' | ')}, "params": {…}}. Params per id: ${seqs.map((id) => `${id}(${Object.keys(SEQUENCES[id].params).filter((k) => k !== 'bg').join(',')})`).join('; ')}. Use ONLY facts and numbers said in that scene; data is "Label:value, …"; events are "year|event; …". Leave "motion" out when unsure.
- "camera": ${CAMERAS.join(' | ')}  (vary it scene to scene)
- "graphic": ${GRAPHICS.join(' | ')}. title only for scene 0. stat only with a number in the scene → add "value","suffix","label". chart → "data" like "A:10, B:20". highlight → "highlight" (exact words). quote → "title" (short line).

Write every title, label, highlight and quote in the SAME language and script as the narration (Hindi narration → Devanagari Hindi). Keep actor names, place, motion and other field values in plain English.

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
        options: { temperature: 0.4, num_ctx: 16384 },
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
            pose: POSES.includes(a.pose as Pose) ? (a.pose as Pose) : undefined,
            expression: EXPRESSIONS.includes(a.expression as Expression) ? (a.expression as Expression) : undefined,
          };
        })
        .filter((a) => a.name);
      const graphic = GRAPHICS.includes(raw.graphic as Graphic) ? (raw.graphic as Graphic) : fb.graphic;
      const plan: StoryPlan = {
        place: String(raw.place ?? fb.place).toLowerCase().slice(0, 40) || fb.place,
        mood: EXPRESSIONS.includes(raw.mood as Expression) ? (raw.mood as Expression) : fb.mood,
        motion: cleanMotion(raw.motion, text, seqs),
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
function sizeFor(type: AssetType, name: string, size?: Actor['size'], kind?: string) {
  const base: Record<string, number> = { person: 0.38, animal: 0.34, bird: 0.18, fish: 0.16, tree: 0.42, mountain: 0.45, building: 0.42, object: 0.2, background: 1, insect: 0.09, plant: 0.2, vehicle: 0.3, food: 0.14, weather: 0.25 };
  let s = base[kind ?? ''] ?? base[type] ?? 0.3;
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
  const vector = isTheme(style);
  if (vector) {
    const env = normaliseEnv({ place: plan.place, time: plan.time });
    const r = await renderEnvironment(env, style, frame.width, frame.height);
    items.push({ id: newId('bg'), kind: 'image', name: `Place · ${plan.place}`, track: 1, from: round(from), duration: round(dur), src: r.url, fit: 'cover', scale: 1, x: 50, y: 50, depth: 0.35, motion: 'kenBurns', assetId: `env-${env.id}` });
  }
  const bg = vector ? null : await ensureAsset(placeName, { style, type: 'background', aspect, spec: timed ? { ...rc.spec, type: 'background', time: plan.time } : undefined });
  if (bg) items.push({ id: newId('bg'), kind: 'image', name: `Place · ${plan.place}`, track: 1, from: round(from), duration: round(dur), src: bg.url, fit: 'cover', scale: 1, x: 50, y: 50, depth: 0.35, motion: 'kenBurns', assetId: bg.id, look: bg.style === 'any' ? style : undefined });

  // actors
  const used = new Set<string>();
  const LANDSCAPE = /\b(river|glacier|wetland|valley|lake|sea|ocean|field|forest|jungle|sky|land|landscape|desert|city|village|mountains|hills|delta|monsoon|flood|water body)\b/i;
  const ABSTRACT = /^(the )?(wind|breeze|air|lights?|glow|sound|music|silence|darkness|time|love|hope|magic|energy|peace|joy|fear|memory|memories|dream|dreams)$/i;
  for (const [k, a] of plan.actors.entries()) {
    // landscapes are places, not actors (they belong in the background)
    const rcType = findRecipe(a.name)?.spec.type;
    if (rcType === 'background' || (!rcType && LANDSCAPE.test(a.name))) continue;
    // things you can't draw as a sprite (otherwise "wind" gets drawn as a generic animal)
    if (!rcType && ABSTRACT.test(a.name)) continue;
    const where = used.has(a.where) ? (['left', 'right', 'center', 'far-left', 'far-right'] as Where[]).find((w) => !used.has(w)) ?? a.where : a.where;
    used.add(where);
    onAsset?.(a.name);
    if (vector) {
      const vk = vectorActorKind(a.name);
      if (vk === 'scenery') continue; // the procedural environment already draws grass, trees, sky…
      if (vk.startsWith('particles-')) {
        if (used.has(vk)) continue; // one overlay per kind per scene
        used.add(vk);
        // fireflies / sparkles / petals: a floating transparent overlay, not a creature sprite
        const r = await renderParticles(vk.replace('particles-', '') as 'fireflies', frame.width, frame.height, k + 3);
        items.push({ id: newId('fx'), kind: 'image', name: a.name, track: 5, from: round(from), duration: round(dur), src: r.url, fit: 'cover', scale: 1, x: 50, y: 50, motion: 'float', depth: 0.6 });
        continue;
      }
    }
    // procedural themes: people come from the cast — same face, clothes and proportions in every scene
    if (vector && isPersonName(a.name)) {
      const who = castFor(a.name);
      const pose: Pose = a.pose ?? (a.motion === 'walkIn' || a.motion === 'walkAcross' || a.motion === 'walkOut' ? 'walk' : 'stand');
      const expression: Expression = a.expression ?? plan.mood ?? 'neutral';
      const r = await renderCharacter(who.spec, { pose, expression, theme: style, size: 1024 });
      const s = slot(where, portrait);
      const scale = (sizeFor('person', a.name, a.size) * 1.12 * frame.height) / frame.width;
      const enterDelay = 0.25 + k * 0.35;
      items.push({
        id: newId('act'),
        kind: 'image',
        name: who.spec.name,
        track: 3 + (where === 'center' ? 1 : 0),
        from: round(from + Math.min(enterDelay, dur * 0.3)),
        duration: round(Math.max(1, dur - Math.min(enterDelay, dur * 0.3))),
        src: r.url,
        fit: 'contain',
        scale: round(scale),
        x: s.x,
        y: s.y,
        anchor: 'bottom',
        motion: pose === 'walk' ? 'walkIn' : a.motion === 'walkIn' ? 'pop' : a.motion,
        flip: where === 'right' || where === 'far-right' ? true : undefined,
        depth: s.depth,
        assetId: 'cast-' + who.spec.id,
        vector: { cast: who.spec.id, pose, expression, theme: style },
      });
      continue;
    }
    const asset = await ensureAsset(a.name, { style, type: a.type });
    // flying things (insects, birds from the library) hover in the sky instead of walking in on the ground
    const flies = asset.where === 'sky' || asset.kind === 'insect' || asset.kind === 'bird';
    const motion: SpriteMotion = flies && (a.motion === 'walkIn' || a.motion === 'breathe') ? (asset.kind === 'insect' ? 'float' : 'fly') : a.motion;
    const s = slot(flies && where !== 'sky' ? 'sky' : where, portrait);
    const hFrac = sizeFor(asset.type, a.name, a.size, asset.kind);
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
      motion,
      flip: (where === 'right' || where === 'far-right') && motion !== 'walkAcross' && motion !== 'fly' ? true : undefined,
      depth: s.depth,
      assetId: asset.id,
      look: asset.style === 'any' ? style : undefined,
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
