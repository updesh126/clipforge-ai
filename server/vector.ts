/**
 * Procedural vector engine — server side.
 *  · renders characters / environments to SVG + transparent PNG at any resolution (sharp/librsvg, CPU only)
 *  · content-addressed cache: same spec + pose + expression + theme + size → same file, never re-rendered
 *  · the CAST: one stored CharacterSpec per character (assets/library/cast/<id>.json) reused in every scene,
 *    plus a reference sheet (expressions + poses, generated one after another) for review and editing
 *  · Ollama Qwen turns story text into structured character + environment specs
 * Memory: no GPU, no browser; one Ollama call per story (keep_alive short so VRAM is freed straight after).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { characterSvg, EXPRESSIONS, normaliseCharacter, slugify, type CharacterSpec, type Expression } from '../src/vector/character.ts';
import { POSES, type Pose } from '../src/vector/skeleton.ts';
import { ENV_KINDS, environmentSvg, normaliseEnv, particlesSvg, type EnvSpec } from '../src/vector/environment.ts';
import { isTheme, THEME_IDS, type ThemeId } from '../src/vector/theme.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
export const LIB = path.join(ROOT, 'assets', 'library');
export const VECTOR_DIR = path.join(LIB, 'vector');
export const CAST_DIR = path.join(LIB, 'cast');
const ENGINE = 'clipforge-vector/1';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const PLAN_MODEL = process.env.OLLAMA_EDIT_MODEL || 'qwen3.5:4b';

const urlOf = (abs: string) => `/media/assets/${path.relative(LIB, abs).split(path.sep).map(encodeURIComponent).join('/')}`;
const hashOf = (v: unknown) => crypto.createHash('sha1').update(JSON.stringify(v)).digest('hex').slice(0, 16);

export interface Rendered {
  url: string; // PNG
  svgUrl: string;
  file: string;
  cached: boolean;
}

async function toPng(svg: string, width: number, height: number, out: string) {
  // render at the target size directly (librsvg scales the vector, so edges stay crisp at any resolution)
  const vbW = Number(svg.match(/viewBox="0 0 (\d+(?:\.\d+)?)/)?.[1] ?? width);
  const density = Math.min(2400, Math.max(36, (72 * width) / vbW));
  await sharp(Buffer.from(svg), { density }).resize(width, height, { fit: 'fill' }).png({ compressionLevel: 8 }).toFile(out);
}

async function cached(kind: string, key: unknown, width: number, height: number, make: () => string): Promise<Rendered> {
  const h = hashOf({ ENGINE, key, width, height });
  const dir = path.join(VECTOR_DIR, 'cache', kind);
  const png = path.join(dir, `${h}.png`);
  const svg = path.join(dir, `${h}.svg`);
  if (fs.existsSync(png) && fs.existsSync(svg)) return { url: urlOf(png), svgUrl: urlOf(svg), file: png, cached: true };
  fs.mkdirSync(dir, { recursive: true });
  const s = make();
  fs.writeFileSync(svg, s);
  await toPng(s, width, height, png);
  return { url: urlOf(png), svgUrl: urlOf(svg), file: png, cached: false };
}

// ---------------------------------------------------------------- rendering
export interface CharacterRenderOpts {
  pose?: Pose;
  expression?: Expression;
  theme?: ThemeId;
  phase?: number;
  flip?: boolean;
  size?: number; // px, square
}

export function renderCharacter(spec: CharacterSpec, o: CharacterRenderOpts = {}): Promise<Rendered> {
  const size = Math.max(128, Math.min(4096, Math.round(o.size ?? 1024)));
  const opts = { pose: POSES.includes(o.pose as Pose) ? o.pose : 'stand', expression: EXPRESSIONS.includes(o.expression as Expression) ? o.expression : 'neutral', theme: isTheme(o.theme) ? o.theme : 'storybook', phase: o.phase ?? 0.25, flip: Boolean(o.flip) } as const;
  return cached(`characters/${spec.id}`, { spec, opts }, size, size, () => characterSvg(spec, opts));
}

export function renderEnvironment(spec: EnvSpec, theme: ThemeId = 'storybook', width = 1080, height = 1920): Promise<Rendered> {
  const w = Math.max(256, Math.min(4096, Math.round(width)));
  const h = Math.max(256, Math.min(4096, Math.round(height)));
  return cached(`environments/${spec.kind}`, { spec, theme }, w, h, () => environmentSvg(spec, theme, w, h));
}

export function renderParticles(kind: 'fireflies' | 'sparkles' | 'petals', width: number, height: number, seed = 7): Promise<Rendered> {
  return cached(`particles/${kind}`, { kind, seed }, width, height, () => particlesSvg(kind, width, height, seed));
}

/** Actor names the environment already draws, or that are better as particles than as a sprite. */
export function vectorActorKind(name: string): 'particles-fireflies' | 'particles-sparkles' | 'particles-petals' | 'scenery' | 'sprite' {
  const n = name.toLowerCase();
  if (/firefl|glow ?worm|lightning bug/.test(n)) return 'particles-fireflies';
  if (/sparkle|glitter|magic dust|stars? twinkl/.test(n)) return 'particles-sparkles';
  if (/petal|blossoms? falling/.test(n)) return 'particles-petals';
  if (/^(the )?(grass|lawn|flowers?|trees?|bush(es)?|plants?|sky|clouds?|stars?|moon|sun|ground|path|road|river|water|hills?|mountains?|forest|woods?)$/.test(n.trim())) return 'scenery';
  return 'sprite';
}

// ---------------------------------------------------------------- cast (identity store)
export interface CastEntry {
  spec: CharacterSpec;
  aliases: string[]; // other words the script uses for them ("the girl", "she", "Meera's mother")
  createdAt: string;
  updatedAt: string;
}

const castFile = (id: string) => path.join(CAST_DIR, `${slugify(id)}.json`);

export function listCast(): CastEntry[] {
  if (!fs.existsSync(CAST_DIR)) return [];
  return fs
    .readdirSync(CAST_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(CAST_DIR, f), 'utf8')) as CastEntry;
      } catch {
        return null;
      }
    })
    .filter((e): e is CastEntry => Boolean(e));
}

export function getCast(id: string): CastEntry | null {
  try {
    return JSON.parse(fs.readFileSync(castFile(id), 'utf8')) as CastEntry;
  } catch {
    return null;
  }
}

export function saveCast(spec: CharacterSpec, aliases: string[] = []): CastEntry {
  fs.mkdirSync(CAST_DIR, { recursive: true });
  const prev = getCast(spec.id);
  const now = new Date().toISOString();
  const entry: CastEntry = { spec, aliases: [...new Set([...(prev?.aliases ?? []), ...aliases].map((a) => a.toLowerCase().trim()).filter(Boolean))].slice(0, 20), createdAt: prev?.createdAt ?? now, updatedAt: now };
  fs.writeFileSync(castFile(spec.id), JSON.stringify(entry, null, 2) + '\n');
  return entry;
}

/** Edit a character: the patch is merged into the stored identity; every future render uses it. */
export function updateCast(id: string, patch: Partial<CharacterSpec> & { aliases?: string[] }): CastEntry | null {
  const cur = getCast(id);
  if (!cur) return null;
  const { aliases, ...p } = patch;
  const merged = normaliseCharacter({
    ...cur.spec,
    ...p,
    face: { ...cur.spec.face, ...(p.face ?? {}) },
    hair: { ...cur.spec.hair, ...(p.hair ?? {}) },
    outfit: { ...cur.spec.outfit, ...(p.outfit ?? {}) },
    id: cur.spec.id,
    seed: cur.spec.seed,
  });
  return saveCast(merged, aliases ?? []);
}

const PERSON = /\b(man|woman|men|women|boy|girl|child|children|kid|baby|person|people|farmer|fisherman|fisherwoman|teacher|student|doctor|nurse|king|queen|prince|princess|mother|father|mom|dad|grandma|grandpa|granny|grandmother|grandfather|sister|brother|son|daughter|uncle|aunt|villager|villagers|monk|sage|priest|soldier|police|worker|merchant|traveller|traveler|hero|heroine|friend|family|old|lady|gentleman|chef|scientist|artist|dancer|singer|player|wife|husband)\b/i;

/** Is this actor name a person (→ procedural character) rather than an animal/object? */
export function isPersonName(name: string): boolean {
  if (PERSON.test(name)) return true;
  const n = name.trim().toLowerCase();
  return listCast().some((c) => c.spec.name.toLowerCase() === n || c.aliases.includes(n));
}

/** The stored character for a name (by id, name or alias) — or create, store and return a new one. */
export function castFor(name: string, description?: string): CastEntry {
  const n = name.trim().toLowerCase().replace(/^(the|a|an)\s+/, '');
  const all = listCast();
  const hit = all.find((c) => c.spec.id === slugify(n) || c.spec.name.toLowerCase() === n || c.aliases.includes(n)) ?? all.find((c) => c.aliases.some((a) => a.length > 3 && n.includes(a)));
  if (hit) return hit;
  const pretty = name.trim().replace(/^(the|a|an)\s+/i, '');
  return saveCast(normaliseCharacter({ name: pretty.charAt(0).toUpperCase() + pretty.slice(1), description: description ?? name }), [n]);
}

/**
 * Character reference sheet: neutral turnaround + every expression + core poses, rendered one after another
 * into a single PNG (assets/library/cast/<id>-<theme>.png). Used to review/approve a character before a video.
 */
export async function referenceSheet(id: string, theme: ThemeId = 'storybook'): Promise<string | null> {
  const entry = getCast(id);
  if (!entry) return null;
  const cell = 320;
  const tiles: NonNullable<Parameters<ReturnType<typeof sharp>['composite']>[0]> = []; // sharp's overlay type (works with sharp 0.34 and 0.35)
  const poses: Pose[] = ['stand', 'walk', 'run', 'sit', 'jump', 'wave'];
  // sequential on purpose: predictable memory, and each step reuses the identical spec
  for (const [i, e] of EXPRESSIONS.entries()) {
    const r = await renderCharacter(entry.spec, { expression: e, theme, size: cell });
    tiles.push({ input: r.file, left: i * cell, top: 0 });
  }
  for (const [i, p] of poses.entries()) {
    const r = await renderCharacter(entry.spec, { pose: p, expression: p === 'jump' ? 'happy' : 'neutral', theme, size: cell });
    tiles.push({ input: r.file, left: i * cell, top: cell });
  }
  const out = path.join(CAST_DIR, `${entry.spec.id}-${theme}.png`);
  await sharp({ create: { width: cell * 6, height: cell * 2, channels: 4, background: '#F4EFE6' } }).composite(tiles).png().toFile(out);
  return urlOf(out);
}

// ---------------------------------------------------------------- Qwen: story text → structured specs
export interface StorySpecs {
  characters: CastEntry[];
  environments: EnvSpec[];
}

const CHAR_SCHEMA = `{"name":"Meera","aliases":["the girl","she"],"description":"8-year-old village girl","age":"child|teen|adult|elder","gender":"female|male|neutral","build":"slim|average|broad|round","skin":"#hex","hair":{"style":"short|long|bob|bun|ponytail|braid|curly|spiky|bald","color":"#hex"},"beard":"none|stubble|moustache|full","outfit":{"top":"tshirt|shirt|kurta|dress|saree|jacket|robe|uniform","topColor":"#hex","pattern":"none|stripes|dots|checks","bottom":"trousers|shorts|skirt|dhoti|leggings","bottomColor":"#hex","shoes":"shoes|sandals|boots|barefoot"},"accessories":["glasses|hat|cap|turban|scarf|crown|backpack|necklace|bindi|earrings"],"holding":"none|lantern|book|stick|basket|phone|flag|umbrella|pot|sword|flower|ball"}`;

/** One LLM call per story: who appears (fixed identities) and which places. Falls back to nothing (callers create on demand). */
export async function planStorySpecs(text: string): Promise<StorySpecs> {
  const prompt = `Read this story and list its recurring PEOPLE and its PLACES so an illustrator can draw them consistently in every scene.
Rules: one entry per distinct person (merge "Meera", "the girl", "she" into one with aliases). Only people — no animals or objects.
Pick clothing and colours that fit the setting and culture of the story. Use hex colours. Keep names exactly as written in the story.
Each character: ${CHAR_SCHEMA}
Each place: {"place":"short description","kind":"${ENV_KINDS.join('|')}","time":"day|sunset|night|dawn","season":"summer|monsoon|autumn|winter|spring","weather":"clear|rain|snow|fog"}

STORY:
${text.slice(0, 6000)}

Reply with ONLY JSON: {"characters":[...],"places":[...]}`;
  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: PLAN_MODEL,
        prompt,
        format: 'json',
        stream: false,
        keep_alive: '2m',
        ...(/qwen3|deepseek-r1|gpt-oss|magistral/i.test(PLAN_MODEL) ? { think: false } : {}),
        options: { temperature: 0.3, num_ctx: 8192 },
      }),
      signal: AbortSignal.timeout(1000 * 120),
    });
    if (!res.ok) throw new Error(`Ollama ${res.status}`);
    const raw = JSON.parse(((await res.json()) as { response: string }).response) as { characters?: Record<string, unknown>[]; places?: Record<string, unknown>[] };
    const characters = (raw.characters ?? []).slice(0, 12).map((c) => {
      const name = String(c.name ?? '').trim().slice(0, 60);
      if (!name) return null;
      const existing = getCast(slugify(name));
      // an existing cast member keeps their identity — the story only adds aliases
      if (existing) return saveCast(existing.spec, (Array.isArray(c.aliases) ? c.aliases : []).map(String));
      const spec = normaliseCharacter({ ...(c as Partial<CharacterSpec>), name, description: String(c.description ?? '') });
      return saveCast(spec, [name.toLowerCase(), ...(Array.isArray(c.aliases) ? c.aliases.map(String) : [])]);
    });
    const environments = (raw.places ?? []).slice(0, 12).map((p) => normaliseEnv({ ...(p as Partial<EnvSpec>), place: String(p.place ?? ''), description: String(p.place ?? '') }));
    return { characters: characters.filter((c): c is CastEntry => Boolean(c)), environments };
  } catch {
    return { characters: [], environments: [] };
  }
}

export { THEME_IDS, isTheme };
