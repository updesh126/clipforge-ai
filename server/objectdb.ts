/**
 * Object database: what each library picture ACTUALLY shows, as identified by a local vision model.
 *
 * File names can mislead ("glowing_firefly_beetle", "kisspng-…-5a3b"), so every PNG/SVG in assets/library is
 * looked at once by an Ollama vision model (default qwen3.5:4b) and recorded in assets/library/objects.json:
 *   name (the common name), kind, aliases (words a script might use — plurals, synonyms, Hindi terms),
 *   a one-line description, mood and where it belongs in a frame.
 * Story scenes look actors up here first, so "fireflies" finds the firefly — not a fir tree.
 *
 * Build/refresh:  npm run describe-assets            (only new/changed pictures)
 *                 npm run describe-assets -- --force  (everything again)
 * You can hand-edit objects.json; set "locked": true on an entry to stop it being overwritten.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { singular } from '../src/assetkit/catalog.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
export const LIBRARY_DIR = path.join(ROOT, 'assets', 'library');
export const OBJECTS_FILE = path.join(LIBRARY_DIR, 'objects.json');
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
/** Preferred: OLLAMA_VISION_MODEL, else Gemma 3 4B (Q4) if pulled, else Qwen 3.5 4B (also vision-capable). */
export let VISION_MODEL = process.env.OLLAMA_VISION_MODEL || 'qwen3.5:4b';
let resolved = Boolean(process.env.OLLAMA_VISION_MODEL);
export async function resolveVisionModel(): Promise<string> {
  if (resolved) return VISION_MODEL;
  resolved = true;
  try {
    const tags = (await (await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) })).json()) as { models: { name: string }[] };
    const names = tags.models.map((m) => m.name);
    const gemma = names.find((n) => /^gemma3:4b/.test(n));
    if (gemma) VISION_MODEL = gemma;
  } catch {
    /* Ollama not running — describePicture will report it */
  }
  return VISION_MODEL;
}

export const KINDS = ['person', 'animal', 'bird', 'fish', 'insect', 'tree', 'plant', 'mountain', 'building', 'vehicle', 'object', 'food', 'weather', 'sky', 'scene'] as const;
export type ObjectKind = (typeof KINDS)[number];

export interface ObjectInfo {
  file: string; // path inside assets/library, forward slashes
  name: string;
  kind: ObjectKind;
  aliases: string[];
  description: string;
  mood?: string;
  where?: 'ground' | 'sky' | 'water' | 'back';
  hash: string; // first 16 hex of the file's sha1 — re-describe when the picture changes
  model: string;
  at: string;
  locked?: boolean;
}

type DB = Record<string, ObjectInfo>;
let cache: { mtime: number; db: DB } | null = null;

export function readObjects(): DB {
  try {
    const mtime = fs.statSync(OBJECTS_FILE).mtimeMs;
    if (cache?.mtime === mtime) return cache.db;
    const db = JSON.parse(fs.readFileSync(OBJECTS_FILE, 'utf8')) as DB;
    cache = { mtime, db };
    return db;
  } catch {
    return {};
  }
}

export function writeObjects(db: DB) {
  const sorted = Object.fromEntries(Object.entries(db).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(OBJECTS_FILE, JSON.stringify(sorted, null, 2) + '\n');
  cache = null;
}

export const relOf = (abs: string) => path.relative(LIBRARY_DIR, abs).split(path.sep).join('/');
const hashOf = (abs: string) => crypto.createHash('sha1').update(fs.readFileSync(abs)).digest('hex').slice(0, 16);

/** Every picture the database should cover (Lottie JSON is skipped — no still to look at). */
export function libraryPictures(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== 'generated' && e.name !== 'inbox') walk(p);
      } else if (/\.(png|svg)$/i.test(e.name) && !/^sheet-/.test(e.name)) out.push(p);
    }
  };
  if (fs.existsSync(LIBRARY_DIR)) walk(LIBRARY_DIR);
  return out;
}

export function needsDescribing(abs: string, db = readObjects()): boolean {
  const cur = db[relOf(abs)];
  return !cur || (!cur.locked && cur.hash !== hashOf(abs));
}

const PROMPT = (hint: string) => `You are cataloguing a cut-out illustration for a story-video asset library.
Look ONLY at the picture. The file name hint may be wrong: "${hint}".
Reply with ONLY JSON:
{"name":"common name, singular, 1-3 words (e.g. firefly, banyan tree, village woman)",
 "kind":"${KINDS.join('|')}",
 "aliases":["6-12 SEPARATE array items, each 1-3 lowercase words a script might use for THIS exact thing: true synonyms, its general group (e.g. insect, big cat, bird), Hindi/Indian name if common. NEVER other species or different objects (a tiger is not a panther; a monkey is not a gorilla)"],
 "description":"one line: what it is, pose, notable details, main colours",
 "mood":"one word",
 "where":"ground|sky|water|back"}`;

/** Ask the vision model what a picture shows. */
export async function describePicture(abs: string): Promise<Omit<ObjectInfo, 'file' | 'hash' | 'at'>> {
  const img = (await sharp(abs, { density: 144 }).flatten({ background: '#ffffff' }).resize(448, 448, { fit: 'inside' }).jpeg({ quality: 82 }).toBuffer()).toString('base64');
  const hint = path.basename(abs, path.extname(abs)).replace(/[_-]+/g, ' ');
  await resolveVisionModel();
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: VISION_MODEL,
      prompt: PROMPT(hint),
      images: [img],
      format: 'json',
      stream: false,
      ...(/qwen3|deepseek-r1|gpt-oss|magistral/i.test(VISION_MODEL) ? { think: false } : {}),
      keep_alive: '2m', // unload soon after a batch so it never sits in VRAM next to the planning model
      options: { temperature: 0.1, num_ctx: 4096 },
    }),
    signal: AbortSignal.timeout(1000 * 120),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const raw = JSON.parse(((await res.json()) as { response: string }).response) as Record<string, unknown>;
  const clean = (s: unknown, n = 60) => String(s ?? '').toLowerCase().replace(/[^a-z0-9 '\-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
  const name = clean(raw.name, 40) || clean(hint, 40);
  const kind = (KINDS as readonly string[]).includes(String(raw.kind)) ? (raw.kind as ObjectKind) : 'object';
  // models sometimes pack every alias into one string — split on commas/semicolons, drop run-ons (> 3 words)
  const given = (Array.isArray(raw.aliases) ? raw.aliases : typeof raw.aliases === 'string' ? [raw.aliases] : [])
    .flatMap((a) => String(a).split(/[,;/|]+/))
    .map((a) => clean(a, 40))
    .filter((a) => a && a.split(' ').length <= 3);
  const plural = /(s|x|ch|sh)$/.test(name) ? `${name}es` : /[^aeiou]y$/.test(name) ? `${name.slice(0, -1)}ies` : `${name}s`;
  const fromFile = clean(hint, 60).split(' ').length <= 3 ? [clean(hint, 60)] : [];
  const aliases = [...new Set([...given, plural, ...fromFile].filter((a) => a && a !== name))].slice(0, 16);
  const where = ['ground', 'sky', 'water', 'back'].includes(String(raw.where)) ? (raw.where as ObjectInfo['where']) : undefined;
  return { name, kind, aliases, description: String(raw.description ?? '').trim().slice(0, 200), mood: clean(raw.mood, 20) || undefined, where, model: VISION_MODEL };
}

/** Describe one picture and save it into the database (skips locked entries). */
export async function describeAndSave(abs: string): Promise<ObjectInfo | null> {
  const db = readObjects();
  const rel = relOf(abs);
  if (db[rel]?.locked) return db[rel];
  const info: ObjectInfo = { file: rel, ...(await describePicture(abs)), hash: hashOf(abs), at: new Date().toISOString() };
  const fresh = readObjects(); // re-read: another describe may have written meanwhile
  fresh[rel] = info;
  writeObjects(fresh);
  return info;
}

// ---------------------------------------------------------------- lookup
const norm = (s: string) => singular(s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^(a|an|the|some|two|three|four|five|many|few|little|small|big|old|young)\s+/, ''));

/**
 * Best library picture for a phrase from a script ("fireflies", "an old banyan tree", "kingfisher").
 * Exact name/alias wins, then all words of the phrase inside the name/aliases, then head-noun match.
 * Returns the file path inside assets/library, or null.
 */
export function findObject(phrase: string, opts: { kinds?: ObjectKind[]; exclude?: ObjectKind[] } = {}): { info: ObjectInfo; score: number } | null {
  const q = norm(phrase);
  if (!q) return null;
  const qWords = q.split(' ');
  const head = qWords[qWords.length - 1];
  let best: { info: ObjectInfo; score: number } | null = null;
  for (const info of Object.values(readObjects())) {
    if (opts.kinds && !opts.kinds.includes(info.kind)) continue;
    if (opts.exclude?.includes(info.kind)) continue;
    const own = norm(info.name);
    const ownWords = own.split(' ');
    const aliases = info.aliases.map(norm);
    let s = 0;
    if (own === q) s = 100;
    // the object's own name beats aliases: "panther" → "black panther", not a tiger aliased "panther"
    else if (qWords.every((w) => ownWords.includes(w))) s = 85;
    else if (aliases.includes(q)) s = 70;
    else if (ownWords[ownWords.length - 1] === head && head.length > 2) s = 55; // "old banyan tree" → any "… tree"
    else if (aliases.some((a) => a.split(' ').at(-1) === head) && head.length > 2) s = 45;
    {
      // descriptive words ("glowing", "flying") add a little
      if (s) s += Math.min(9, qWords.filter((w) => w !== head && info.description.toLowerCase().includes(w)).length * 3);
    }
    if (s && (!best || s > best.score)) best = { info, score: s };
  }
  return best;
}

/** Compact list for LLM prompts: "firefly, banyan tree, village woman, …" (unique names, by kind). */
export function objectNames(exclude: ObjectKind[] = ['scene']): string[] {
  return [...new Set(Object.values(readObjects()).filter((o) => !exclude.includes(o.kind)).map((o) => o.name))].sort();
}
