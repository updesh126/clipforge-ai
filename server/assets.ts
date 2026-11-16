/**
 * Asset library: transparent PNG characters, animals, nature, buildings, props and backgrounds.
 *
 *   assets/library/
 *     characters/ animals/ birds/ nature/ buildings/ props/ backgrounds/   ← drop your own PNGs here
 *     generated/<style>/<category>/<name>.png                              ← made by ClipForge, reused later
 *     index.json                                                           ← metadata (tags, recipe, source, licence)
 *
 * Lookup order for "elephant" in a Warli video:
 *   1. your own PNG whose name/tags match (style "any"), unless preferGenerated
 *   2. a generated Warli elephant from an earlier video
 *   3. a built-in recipe (src/assetkit/catalog.ts) rendered now in Warli and saved
 *   4. a brand-new recipe written by the local LLM from the kit's building blocks, rendered and saved
 */
import fs from 'node:fs';
import path from 'node:path';
import type { AssetEntry, AssetSpec, AssetType } from '../src/assetkit/types.ts';
import { CATEGORY_OF } from '../src/assetkit/types.ts';
import { RECIPES, findRecipe, slug } from '../src/assetkit/catalog.ts';
import { getBundle } from './remotion.ts';

export const ASSETS_DIR = path.resolve(process.env.CLIPFORGE_ASSETS_DIR || path.join(process.cwd(), 'assets', 'library'));
const INDEX = path.join(ASSETS_DIR, 'index.json');
const FOLDERS = ['characters', 'animals', 'birds', 'nature', 'buildings', 'props', 'backgrounds'];
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const DESIGN_MODEL = process.env.OLLAMA_EDIT_MODEL || process.env.OLLAMA_MODEL || 'qwen2.5:3b';

export function ensureAssetDirs() {
  for (const f of FOLDERS) fs.mkdirSync(path.join(ASSETS_DIR, f), { recursive: true });
  const readme = path.join(ASSETS_DIR, 'README.md');
  if (!fs.existsSync(readme)) {
    fs.writeFileSync(
      readme,
      `# ClipForge asset library

Drop transparent PNGs into these folders and ClipForge will find them by file name:

- characters/  people (e.g. \`farmer.png\`, \`old_woman_with_stick.png\`)
- animals/     e.g. \`elephant.png\`, \`tiger_walking.png\`
- birds/       e.g. \`peacock.png\`
- nature/      trees, mountains, rocks, flowers
- buildings/   houses, temples, towers
- props/       objects (boat, car, lamp…)
- backgrounds/ full scenes (1080×1920 or 1920×1080 works best)

Words in the file name become search tags. Characters should face right and stand on the bottom edge.
\`generated/\` holds assets ClipForge drew itself — they are reused in future videos.

Only add images you have the right to use (your own, CC0 / public domain, or properly licensed).
`,
      'utf-8'
    );
  }
}

const urlFor = (abs: string) => `/media/assets/${path.relative(ASSETS_DIR, abs).split(path.sep).map(encodeURIComponent).join('/')}`;

function readIndex(): Record<string, AssetEntry & { source?: string; licence?: string }> {
  try {
    return JSON.parse(fs.readFileSync(INDEX, 'utf-8')) as Record<string, AssetEntry>;
  } catch {
    return {};
  }
}

function writeIndex(idx: Record<string, AssetEntry>) {
  fs.writeFileSync(INDEX, JSON.stringify(idx, null, 2), 'utf-8');
}

const tagsFromName = (file: string) =>
  path
    .basename(file, path.extname(file))
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !/^\d+$/.test(t));

const TYPE_OF_FOLDER: Record<string, AssetType> = {
  characters: 'person',
  animals: 'animal',
  birds: 'bird',
  nature: 'tree',
  buildings: 'building',
  props: 'object',
  backgrounds: 'background',
};

/** Every asset: indexed generated ones + any PNG found on disk (user drops). */
export function listAssets(): AssetEntry[] {
  ensureAssetDirs();
  const idx = readIndex();
  const known = new Set(Object.values(idx).map((e) => e.url));
  const out: AssetEntry[] = Object.values(idx).filter((e) => fs.existsSync(path.join(ASSETS_DIR, decodeURIComponent(e.url.replace('/media/assets/', '')))));
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== 'generated') walk(p);
      } else if (/\.png$/i.test(e.name)) {
        const url = urlFor(p);
        if (known.has(url)) continue;
        const folder = path.relative(ASSETS_DIR, p).split(path.sep)[0];
        const tags = [...new Set([...tagsFromName(e.name), folder.replace(/s$/, '')])];
        out.push({
          id: `user-${slug(path.relative(ASSETS_DIR, p))}`,
          name: path.basename(e.name, path.extname(e.name)).replace(/[_-]+/g, ' '),
          type: TYPE_OF_FOLDER[folder] ?? 'object',
          category: folder,
          style: 'any',
          url,
          tags,
          generated: false,
          width: 0,
          height: 0,
          createdAt: fs.statSync(p).mtime.toISOString(),
        });
      }
    }
  };
  walk(ASSETS_DIR);
  return out;
}

function score(entry: AssetEntry, q: string): number {
  const words = q.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1);
  const name = entry.name.toLowerCase();
  if (name === q.toLowerCase()) return 100;
  let s = 0;
  for (const w of words) if (entry.tags.some((t) => t === w || t === `${w}s` || `${t}s` === w)) s += 20;
  if (name.includes(q.toLowerCase())) s += 30;
  return s;
}

export function searchAssets(q: string, opts: { style?: string; type?: AssetType; category?: string } = {}): AssetEntry[] {
  return listAssets()
    .filter((e) => (!opts.style || e.style === opts.style || e.style === 'any') && (!opts.type || e.type === opts.type) && (!opts.category || e.category === opts.category))
    .map((e) => ({ e, s: q ? score(e, q) : 1 }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || b.e.createdAt.localeCompare(a.e.createdAt))
    .map((x) => x.e);
}

// ---------------------------------------------------------------- rendering
let renderQueue: Promise<unknown> = Promise.resolve();

async function renderPng(spec: AssetSpec, style: string, width: number, height: number, out: string) {
  const job = renderQueue.then(async () => {
    const { renderStill, selectComposition } = await import('@remotion/renderer');
    const serveUrl = await getBundle();
    const inputProps = { spec, style, width, height };
    const composition = await selectComposition({ serveUrl, id: 'ClipForgeAsset', inputProps });
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await renderStill({ composition, serveUrl, inputProps, output: out, imageFormat: 'png', frame: 0 });
  });
  renderQueue = job.catch(() => {});
  return job;
}

export const FRAME_FOR_ASPECT: Record<string, [number, number]> = { '9:16': [1080, 1920], '1:1': [1080, 1080], '4:5': [1080, 1350], '16:9': [1920, 1080] };

// ---------------------------------------------------------------- LLM design for brand-new assets
const SCHEMAS: Record<string, string> = {
  person: '{"type":"person","skin":"#hex","top":"#hex","bottom":"#hex","dress":"trousers|skirt|saree|dhoti|robe","hair":"short|long|bun|none","hairColor":"#hex","headwear":"none|turban|cap|scarf|hat|crown|helmet","headwearColor":"#hex","beard":bool,"glasses":bool,"prop":"none|staff|book|basket|phone|flag|pot|sword|lamp","pose":"stand|wave|walk|point|cheer|think","child":bool,"elderly":bool}',
  animal: '{"type":"animal","body":"#hex","belly":"#hex","size":0.5-1.6,"bodyLength":0.6-1.6,"legLength":0.5-2,"neck":0-2.5,"ears":"small|pointy|big|floppy|long","tail":"thin|bushy|tuft|none|long","trunk":bool,"tusks":bool,"horns":"none|short|curved|antlers","mane":bool,"hump":0-2,"stripes":"#hex or empty","spots":"#hex or empty","snout":"short|long"}',
  bird: '{"type":"bird","body":"#hex","wing":"#hex","beak":"#hex","tail":"short|long|fan","tailColor":"#hex","crest":bool,"size":0.4-1.5,"flying":bool}',
  tree: '{"type":"tree","kind":"round|pine|palm|banyan|bamboo|blossom|bare","leaf":"#hex","trunk":"#hex","flower":"#hex"}',
  building: '{"type":"building","kind":"house|hut|temple|tower|skyscraper|factory|school|castle|mosque|lighthouse","wall":"#hex","roof":"#hex"}',
  object: '{"type":"object","kind":"boat|cloud|sun|moon|flower|rock|pot|diya|car|kite|book|globe|tractor|bicycle|star|heart|drop|leaf","color":"#hex","accent":"#hex"}',
  background: '{"type":"background","skyTop":"#hex","skyBottom":"#hex","ground":"#hex","time":"day|sunset|night|dawn","layers":["mountains|snowMountains|hills|river|sea|forest|city|village|desert|field|temple|glacier|clouds"],"horizon":0.3-0.8}',
};

const ENUMS: Record<string, string[]> = {
  dress: ['trousers', 'skirt', 'saree', 'dhoti', 'robe'],
  hair: ['short', 'long', 'bun', 'none'],
  headwear: ['none', 'turban', 'cap', 'scarf', 'hat', 'crown', 'helmet'],
  prop: ['none', 'staff', 'book', 'basket', 'phone', 'flag', 'pot', 'sword', 'lamp'],
  pose: ['stand', 'wave', 'walk', 'point', 'cheer', 'think'],
  ears: ['small', 'pointy', 'big', 'floppy', 'long'],
  tail: ['thin', 'bushy', 'tuft', 'none', 'long', 'short', 'fan'],
  horns: ['none', 'short', 'curved', 'antlers'],
  snout: ['short', 'long', 'beak'],
  time: ['day', 'sunset', 'night', 'dawn'],
};

/** Keep only fields the generators understand, with valid values. */
export function cleanSpec(raw: Record<string, unknown>, type: AssetType): AssetSpec {
  const out: Record<string, unknown> = { type };
  for (const [k, v] of Object.entries(raw ?? {})) {
    if (k === 'type') continue;
    if (typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v)) out[k] = v;
    else if (typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'number' && Number.isFinite(v)) out[k] = Math.max(0, Math.min(3, v));
    else if (typeof v === 'string' && ENUMS[k]?.includes(v)) out[k] = v;
    else if (k === 'kind' && typeof v === 'string') out[k] = v;
    else if (k === 'layers' && Array.isArray(v)) out[k] = v.filter((x) => typeof x === 'string').slice(0, 5);
  }
  return out as unknown as AssetSpec;
}

async function designWithLLM(name: string, type: AssetType): Promise<AssetSpec | null> {
  const schemaType = type === 'fish' ? 'animal' : type === 'mountain' ? 'background' : type;
  const schema = SCHEMAS[schemaType];
  if (!schema) return null;
  const prompt = `Design a simple illustration of "${name}" for a parametric drawing kit.
Fill in this JSON (choose values that make it recognisable; realistic colours as #hex):
${schema}
Reply with ONLY the JSON object.`;
  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: DESIGN_MODEL,
        prompt,
        format: 'json',
        stream: false,
        ...(/qwen3|deepseek-r1|gpt-oss|magistral/i.test(DESIGN_MODEL) ? { think: false } : {}),
        options: { temperature: 0.2 },
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!res.ok) return null;
    const raw = JSON.parse(((await res.json()) as { response: string }).response);
    return cleanSpec(raw, schemaType as AssetType);
  } catch {
    return null;
  }
}

/** Guess the asset type of a free-text name when nobody told us. */
export function guessType(name: string): AssetType {
  const rc = findRecipe(name);
  if (rc) return rc.spec.type;
  if (/\b(man|woman|boy|girl|people|person|farmer|king|queen|child|kid|teacher|doctor|worker|player|mother|father)\b/i.test(name)) return 'person';
  if (/\b(bird|crow|owl|eagle|parrot|hen|duck|pigeon|sparrow)\b/i.test(name)) return 'bird';
  if (/\b(tree|plant|forest|bush)\b/i.test(name)) return 'tree';
  if (/\b(house|temple|building|tower|school|palace|fort|church|mosque|hospital|shop)\b/i.test(name)) return 'building';
  if (/\b(scene|landscape|background|valley|city|village|beach|desert|sky)\b/i.test(name)) return 'background';
  return 'animal';
}

export interface EnsureOptions {
  style: string;
  type?: AssetType;
  aspect?: string; // backgrounds
  spec?: AssetSpec; // explicit recipe (e.g. from the editor's "Create asset")
  preferGenerated?: boolean; // skip user PNGs
}

/** Find an asset, or create + save it. Never throws for unknown names — falls back to a generic recipe. */
export async function ensureAsset(name: string, opts: EnsureOptions): Promise<AssetEntry> {
  ensureAssetDirs();
  const recipe = findRecipe(name, opts.type);
  const type: AssetType = opts.spec?.type ?? opts.type ?? recipe?.spec.type ?? guessType(name);
  const isBg = type === 'background';
  const aspect = isBg ? (FRAME_FOR_ASPECT[opts.aspect ?? ''] ? (opts.aspect as string) : '9:16') : undefined;
  const key = opts.spec ? name : recipe ? recipe.name : name; // explicit recipes (e.g. "village night") cache under their own name

  {
    // 1. user PNGs (only when no explicit recipe was asked for)  2. generated earlier in this style
    const hits = searchAssets(key, { type: type === 'fish' ? 'animal' : type }).filter((e) => (isBg ? !e.aspect || e.aspect === aspect : true));
    const user = hits.find((e) => e.style === 'any' && score(e, key) >= 20);
    if (user && !opts.preferGenerated && !opts.spec) return user;
    const mine = hits.find((e) => e.generated && e.style === opts.style && slug(e.name) === slug(key));
    if (mine) return mine;
  }

  // 3/4. recipe or LLM design → render → save
  const spec = opts.spec ?? recipe?.spec ?? (await designWithLLM(name, type)) ?? (RECIPES.find((r) => r.spec.type === type)?.spec as AssetSpec);
  const [w, h] = isBg ? FRAME_FOR_ASPECT[aspect as string] : [768, 768];
  const category = CATEGORY_OF[type];
  const file = path.join(ASSETS_DIR, 'generated', opts.style, category, `${slug(key)}${isBg ? `_${(aspect as string).replace(':', 'x')}` : ''}.png`);
  await renderPng(spec, opts.style, w, h, file);
  const entry: AssetEntry = {
    id: `gen-${opts.style}-${slug(key)}${isBg ? `-${aspect}` : ''}`,
    name: key,
    type,
    category,
    style: opts.style,
    url: urlFor(file),
    tags: [...new Set([...(recipe?.tags ?? []), ...tagsFromName(key)].map((t) => t.toLowerCase()))],
    generated: true,
    width: w,
    height: h,
    aspect,
    spec,
    createdAt: new Date().toISOString(),
  };
  const idx = readIndex();
  idx[entry.id] = entry;
  writeIndex(idx);
  return entry;
}

/** Record where a user PNG came from (source URL, licence) — shown in the editor. */
export function importUserPng(srcPath: string, category: string, name: string, meta: { source?: string; licence?: string }): AssetEntry {
  ensureAssetDirs();
  const folder = FOLDERS.includes(category) ? category : 'props';
  const file = path.join(ASSETS_DIR, folder, `${slug(name || path.basename(srcPath, path.extname(srcPath))).replace(/-/g, '_')}.png`);
  fs.copyFileSync(srcPath, file);
  const entry: AssetEntry & { source?: string; licence?: string } = {
    id: `user-${slug(path.relative(ASSETS_DIR, file))}`,
    name: name || path.basename(file, '.png').replace(/_/g, ' '),
    type: TYPE_OF_FOLDER[folder] ?? 'object',
    category: folder,
    style: 'any',
    url: urlFor(file),
    tags: [...new Set([...tagsFromName(file), folder.replace(/s$/, '')])],
    generated: false,
    width: 0,
    height: 0,
    createdAt: new Date().toISOString(),
    source: meta.source?.slice(0, 300),
    licence: meta.licence?.slice(0, 100),
  };
  const idx = readIndex();
  idx[entry.id] = entry;
  writeIndex(idx);
  return entry;
}
