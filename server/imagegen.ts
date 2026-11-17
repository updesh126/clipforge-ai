/**
 * Local Stable Diffusion through ComfyUI (https://github.com/comfyanonymous/ComfyUI).
 * ClipForge never runs the model itself: it sends a small text-to-image workflow to a ComfyUI server
 * on this machine (default http://127.0.0.1:8188) and caches the PNG under data/generated/.
 *
 *   SD_URL         ComfyUI address (default http://127.0.0.1:8188)
 *   SD_CHECKPOINT  checkpoint file name as ComfyUI lists it (default: the first SDXL-looking checkpoint)
 *   SD_STEPS       sampling steps (default 28; use 6–8 for Lightning / Turbo checkpoints)
 *   SD_CFG         guidance scale (default 6; use 1.5–2 for Lightning / Turbo)
 *   SD_SAMPLER     KSampler sampler (default dpmpp_2m), SD_SCHEDULER (default karras)
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './store.ts';
import { buildNegativePrompt, buildSdPrompt } from '../src/artstyles/prompt.ts';
import type { CharacterSpec } from '../src/vector/character.ts';

export const SD_URL = (process.env.SD_URL || 'http://127.0.0.1:8188').replace(/\/+$/, '');
export const GENERATED_DIR = path.join(DATA_DIR, 'generated');
const STEPS = Number(process.env.SD_STEPS) || 28;
const CFG = Number(process.env.SD_CFG) || 6;
const SAMPLER = process.env.SD_SAMPLER || 'dpmpp_2m';
const SCHEDULER = process.env.SD_SCHEDULER || 'karras';

/** SDXL-friendly sizes (≈1 megapixel, multiples of 64) per frame shape. */
const SIZES: Record<string, [number, number]> = { '9:16': [768, 1344], '16:9': [1344, 768], '1:1': [1024, 1024], '4:5': [896, 1152] };
export const sdSize = (aspect: string): [number, number] => SIZES[aspect] ?? SIZES['9:16'];

async function getJson<T>(url: string, init?: RequestInit, timeoutMs = 4000): Promise<T> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} from ${url}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T;
}

export interface SdStatus {
  running: boolean;
  url: string;
  checkpoints: string[];
  checkpoint: string | null;
  gpu?: string;
}

let statusCache: { at: number; value: SdStatus } | null = null;

/** Is ComfyUI up, and which checkpoint will we use? (cached for 10 s — /api/health polls this) */
export async function sdStatus(fresh = false): Promise<SdStatus> {
  if (!fresh && statusCache && Date.now() - statusCache.at < 10_000) return statusCache.value;
  let value: SdStatus = { running: false, url: SD_URL, checkpoints: [], checkpoint: null };
  try {
    const stats = await getJson<{ devices?: Array<{ name?: string }> }>(`${SD_URL}/system_stats`, undefined, 2500);
    const info = await getJson<Record<string, { input: { required: { ckpt_name: [string[]] } } }>>(`${SD_URL}/object_info/CheckpointLoaderSimple`, undefined, 4000);
    const checkpoints = info.CheckpointLoaderSimple?.input.required.ckpt_name[0] ?? [];
    const wanted = process.env.SD_CHECKPOINT;
    const checkpoint = (wanted && checkpoints.find((c) => c === wanted || path.basename(c) === wanted)) || checkpoints.find((c) => /xl/i.test(c)) || checkpoints[0] || null;
    value = { running: true, url: SD_URL, checkpoints, checkpoint, gpu: stats.devices?.[0]?.name };
  } catch {
    // not running — keep the default
  }
  statusCache = { at: Date.now(), value };
  return value;
}

export interface GenerateOptions {
  prompt: string;
  negative?: string;
  width: number;
  height: number;
  seed?: number;
  steps?: number;
  cfg?: number;
  /** progress text while ComfyUI works */
  onProgress?: (msg: string) => void;
}

/** Basic SDXL text-to-image workflow in ComfyUI's API format. */
function workflow(ckpt: string, o: Required<Omit<GenerateOptions, 'onProgress'>>) {
  return {
    '1': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: ckpt } },
    '2': { class_type: 'CLIPTextEncode', inputs: { text: o.prompt, clip: ['1', 1] } },
    '3': { class_type: 'CLIPTextEncode', inputs: { text: o.negative, clip: ['1', 1] } },
    '4': { class_type: 'EmptyLatentImage', inputs: { width: o.width, height: o.height, batch_size: 1 } },
    '5': { class_type: 'KSampler', inputs: { model: ['1', 0], positive: ['2', 0], negative: ['3', 0], latent_image: ['4', 0], seed: o.seed, steps: o.steps, cfg: o.cfg, sampler_name: SAMPLER, scheduler: SCHEDULER, denoise: 1 } },
    '6': { class_type: 'VAEDecode', inputs: { samples: ['5', 0], vae: ['1', 2] } },
    '7': { class_type: 'SaveImage', inputs: { images: ['6', 0], filename_prefix: 'clipforge' } },
  };
}

/**
 * Generate one image and return its URL (/media/generated/<hash>.png).
 * Same prompt + size + seed + checkpoint → same file, so re-running a script costs nothing.
 */
export async function generateImage(opts: GenerateOptions): Promise<{ url: string; file: string; cached: boolean }> {
  const st = await sdStatus(true);
  if (!st.running) throw new Error(`Stable Diffusion (ComfyUI) is not running at ${SD_URL}. Start ComfyUI, then try again.`);
  if (!st.checkpoint) throw new Error('ComfyUI has no checkpoint. Put an SDXL .safetensors file in ComfyUI/models/checkpoints and restart it.');
  const o = { prompt: opts.prompt, negative: opts.negative ?? '', width: opts.width, height: opts.height, seed: opts.seed ?? 1, steps: opts.steps ?? STEPS, cfg: opts.cfg ?? CFG };
  const key = crypto.createHash('sha1').update(JSON.stringify({ ...o, ckpt: st.checkpoint, SAMPLER, SCHEDULER })).digest('hex').slice(0, 20);
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
  const file = path.join(GENERATED_DIR, `${key}.png`);
  const url = `/media/generated/${key}.png`;
  if (fs.existsSync(file)) return { url, file, cached: true };

  const clientId = crypto.randomUUID();
  const queued = await getJson<{ prompt_id: string }>(
    `${SD_URL}/prompt`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: workflow(st.checkpoint, o), client_id: clientId }) },
    15_000,
  );
  // poll history until the image is saved (first run loads the model: allow several minutes)
  const started = Date.now();
  type Hist = Record<string, { status?: { status_str?: string; messages?: unknown[] }; outputs?: Record<string, { images?: Array<{ filename: string; subfolder: string; type: string }> }> }>;
  for (;;) {
    if (Date.now() - started > 10 * 60_000) throw new Error('Stable Diffusion took longer than 10 minutes for one image.');
    await new Promise((r) => setTimeout(r, 1000));
    const hist = await getJson<Hist>(`${SD_URL}/history/${queued.prompt_id}`, undefined, 10_000).catch(() => ({}) as Hist);
    const h = hist[queued.prompt_id];
    if (!h) {
      opts.onProgress?.(`Painting… ${Math.round((Date.now() - started) / 1000)}s`);
      continue;
    }
    if (h.status?.status_str === 'error') throw new Error(`ComfyUI failed: ${JSON.stringify(h.status.messages ?? []).slice(0, 400)}`);
    const img = Object.values(h.outputs ?? {}).flatMap((x) => x.images ?? [])[0];
    if (!img) continue;
    const q = new URLSearchParams({ filename: img.filename, subfolder: img.subfolder, type: img.type });
    const res = await fetch(`${SD_URL}/view?${q}`, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`Could not download the image from ComfyUI (${res.status}).`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    return { url, file, cached: false };
  }
}

// ---------------------------------------------------------------- story → scene prompts

const hexName = (hex: string): string => {
  const m = hex.replace('#', '').match(/^([0-9a-f]{6})$/i);
  if (!m) return hex;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 510;
  if (max - min < 24) return l > 0.9 ? 'white' : l > 0.65 ? 'light grey' : l > 0.3 ? 'grey' : 'black';
  let h = max === r ? ((g - b) / (max - min)) * 60 : max === g ? (2 + (b - r) / (max - min)) * 60 : (4 + (r - g) / (max - min)) * 60;
  if (h < 0) h += 360;
  const tone = l < 0.32 ? 'dark ' : l > 0.78 ? 'pale ' : '';
  const name = h < 15 ? 'red' : h < 35 ? 'orange' : h < 50 ? (l < 0.45 ? 'brown' : 'amber') : h < 70 ? 'yellow' : h < 160 ? 'green' : h < 200 ? 'teal' : h < 250 ? 'blue' : h < 290 ? 'purple' : h < 340 ? 'pink' : 'red';
  return tone + name;
};

const skinName = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const l = (r + g + b) / 3;
  return l > 200 ? 'fair' : l > 170 ? 'light brown' : l > 135 ? 'warm brown' : l > 100 ? 'brown' : 'deep brown';
};

/** One fixed sentence per character, repeated in every scene prompt so the model keeps them the same. */
export function describeCharacter(c: CharacterSpec): string {
  const who = c.age === 'child' ? (c.gender === 'female' ? 'young girl' : c.gender === 'male' ? 'young boy' : 'child') : c.age === 'teen' ? `teenage ${c.gender === 'female' ? 'girl' : c.gender === 'male' ? 'boy' : 'kid'}` : c.age === 'elder' ? `elderly ${c.gender === 'female' ? 'woman' : c.gender === 'male' ? 'man' : 'person'}` : c.gender === 'female' ? 'woman' : c.gender === 'male' ? 'man' : 'person';
  const hair = c.hair.style === 'bald' ? 'bald' : `${hexName(c.hair.color)} ${String(c.hair.style).replace(/([A-Z])/g, ' $1').toLowerCase()} hair`;
  const beard = c.beard !== 'none' ? `, ${c.beard === 'moustache' ? 'a moustache' : `${c.beard} beard`}` : '';
  const top = `${hexName(c.outfit.topColor)} ${String(c.outfit.top).replace(/([A-Z])/g, ' $1').toLowerCase()}${c.outfit.pattern !== 'none' ? ` with ${c.outfit.pattern}` : ''}`;
  const bottom = `${hexName(c.outfit.bottomColor)} ${String(c.outfit.bottom).replace(/([A-Z])/g, ' $1').toLowerCase()}`;
  const extras = c.accessories.length ? `, ${c.accessories.join(' and ')}` : '';
  return `${c.name}: a ${c.build} ${who} with ${skinName(c.skin)} skin, ${hair}${beard}, wearing a ${top} and ${bottom}${extras}`;
}

export interface SceneBrief {
  place: string;
  time?: string;
  actors: string[];
  narration: string;
  mood?: string;
}

/** What to draw, in short phrases (the style is added by buildSdPrompt). */
export function scenePrompt(s: SceneBrief, cast: CharacterSpec[]): string {
  const people = s.actors.map((a) => cast.find((c) => c.name.toLowerCase() === a.toLowerCase())?.name ?? a);
  const time = s.time && s.time !== 'day' ? `at ${s.time}` : 'in daylight';
  const subject = people.length ? `${people.join(' and ')} in ${s.place} ${time}` : `${s.place} ${time}`;
  const moment = s.narration.replace(/\s+/g, ' ').trim().slice(0, 180);
  return [subject, moment, s.mood && s.mood !== 'neutral' ? `${s.mood} mood` : ''].filter(Boolean).join(', ');
}

/** Positive + negative prompts for one scene in an art style. */
export function stylisedScene(s: SceneBrief, style: string, cast: CharacterSpec[]): { prompt: string; negative: string } {
  const inScene = cast.filter((c) => s.actors.some((a) => a.toLowerCase() === c.name.toLowerCase()));
  return {
    prompt: buildSdPrompt(scenePrompt(s, cast), style, inScene.map(describeCharacter)),
    negative: `${buildNegativePrompt(style)}, text, letters, watermark, signature, logo, extra limbs, deformed hands, duplicate characters, blurry`,
  };
}
