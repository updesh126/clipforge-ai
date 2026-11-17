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
const LIVE_DIR = path.join(GENERATED_DIR, 'live'); // in-progress preview frames (deleted when each image is done)
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
  /** progress while ComfyUI works: a short label, 0..1 for this image, the latest preview frame URL and sampler step */
  onProgress?: (msg: string, fraction: number, live?: { preview?: string; step?: number; steps?: number }) => void;
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
  // live sampler steps over ComfyUI's WebSocket (the HTTP history only reports when the image is done)
  let phase = 'Waiting for the GPU';
  let fraction = 0;
  let step = 0;
  let steps = o.steps;
  let preview: string | undefined;
  let lastWrite = 0;
  const liveFile = path.join(LIVE_DIR, `${clientId}.jpg`);
  let ws: WebSocket | null = null;
  try {
    ws = new WebSocket(`${SD_URL.replace(/^http/, 'ws')}/ws?clientId=${clientId}`);
    ws.binaryType = 'arraybuffer';
    ws.onmessage = (ev) => {
      if (typeof ev.data !== 'string') {
        // preview frame: [u32 event][u32 image type | u32 metadata length + metadata][image bytes] (needs --preview-method)
        const buf = Buffer.from(ev.data as ArrayBuffer);
        if (buf.length < 12) return;
        const event = buf.readUInt32BE(0);
        let img: Buffer | null = null;
        if (event === 1) img = buf.subarray(8);
        else if (event === 4) img = buf.subarray(8 + buf.readUInt32BE(4));
        const now = Date.now();
        if (img && img.length && now - lastWrite > 350) {
          lastWrite = now;
          try {
            fs.mkdirSync(LIVE_DIR, { recursive: true });
            fs.writeFileSync(liveFile, img);
            preview = `/media/generated/live/${clientId}.jpg?v=${now}`;
          } catch {
            /* a preview is nice to have */
          }
        }
        return;
      }
      try {
        const m = JSON.parse(ev.data) as { type: string; data?: { value?: number; max?: number; node?: string | null } };
        if (m.type === 'progress' && m.data?.max) {
          fraction = Math.min(0.97, (m.data.value ?? 0) / m.data.max);
          step = m.data.value ?? 0;
          steps = m.data.max;
          phase = `step ${step}/${steps}`;
        } else if (m.type === 'executing' && m.data?.node === '1') phase = 'Loading model (first time only)';
        else if (m.type === 'executing' && m.data?.node === '6') {
          phase = 'Finishing';
          fraction = 0.98;
        }
      } catch {
        /* ignore */
      }
    };
  } catch {
    ws = null; // no WebSocket: fall back to elapsed time
  }
  const queued = await getJson<{ prompt_id: string }>(
    `${SD_URL}/prompt`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: workflow(st.checkpoint, o), client_id: clientId }) },
    15_000,
  );
  // poll history until the image is saved (first run loads the model: allow several minutes)
  const started = Date.now();
  type Hist = Record<string, { status?: { status_str?: string; messages?: unknown[] }; outputs?: Record<string, { images?: Array<{ filename: string; subfolder: string; type: string }> }> }>;
  try {
  for (;;) {
    if (Date.now() - started > 10 * 60_000) throw new Error('Stable Diffusion took longer than 10 minutes for one image.');
    await new Promise((r) => setTimeout(r, 1000));
    const hist = await getJson<Hist>(`${SD_URL}/history/${queued.prompt_id}`, undefined, 10_000).catch(() => ({}) as Hist);
    const h = hist[queued.prompt_id];
    if (!h) {
      const secs = Math.round((Date.now() - started) / 1000);
      opts.onProgress?.(ws ? `${phase} · ${secs}s` : `Painting… ${secs}s`, ws ? fraction : Math.min(0.9, secs / 30), { preview, step, steps });
      continue;
    }
    if (h.status?.status_str === 'error') throw new Error(`ComfyUI failed: ${JSON.stringify(h.status.messages ?? []).slice(0, 400)}`);
    const img = Object.values(h.outputs ?? {}).flatMap((x) => x.images ?? [])[0];
    if (!img) continue;
    const q = new URLSearchParams({ filename: img.filename, subfolder: img.subfolder, type: img.type });
    const res = await fetch(`${SD_URL}/view?${q}`, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`Could not download the image from ComfyUI (${res.status}).`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    opts.onProgress?.('Done', 1, { preview: url, step: steps, steps });
    return { url, file, cached: false };
  }
  } finally {
    ws?.close();
    fs.rm(liveFile, { force: true }, () => {}); // the final image replaces the live preview
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

/** One fixed description per character, repeated in every scene prompt so the model keeps them the same.
 *  `named: false` leaves the name out — Stable Diffusion doesn't know names, and "Asha: a girl…" reads as two people. */
export function describeCharacter(c: CharacterSpec, opts: { named?: boolean } = {}): string {
  const who = shortWho(c);
  const hair = c.hair.style === 'bald' ? 'bald' : `${hexName(c.hair.color)} ${String(c.hair.style).replace(/([A-Z])/g, ' $1').toLowerCase()} hair`;
  const beard = c.beard !== 'none' ? `, ${c.beard === 'moustache' ? 'a moustache' : `${c.beard} beard`}` : '';
  const top = `${hexName(c.outfit.topColor)} ${String(c.outfit.top).replace(/([A-Z])/g, ' $1').toLowerCase()}${c.outfit.pattern !== 'none' ? ` with ${c.outfit.pattern}` : ''}`;
  const dressed = /dress|saree|robe/.test(String(c.outfit.top)) ? `wearing a ${top}` : `wearing a ${top} and ${hexName(c.outfit.bottomColor)} ${String(c.outfit.bottom).replace(/([A-Z])/g, ' $1').toLowerCase()}`;
  const extras = c.accessories.length ? `, ${c.accessories.join(' and ')}` : '';
  const held = c.holding && c.holding !== 'none' ? `, holding a ${c.holding}` : '';
  return `${opts.named === false ? '' : `${c.name}: `}a ${c.build} ${who} with ${skinName(c.skin)} skin, ${hair}${beard}, ${dressed}${extras}${held}`;
}

const shortWho = (c: CharacterSpec) =>
  c.age === 'child' ? (c.gender === 'female' ? 'young girl' : c.gender === 'male' ? 'young boy' : 'child') : c.age === 'teen' ? `teenage ${c.gender === 'female' ? 'girl' : c.gender === 'male' ? 'boy' : 'kid'}` : c.age === 'elder' ? `elderly ${c.gender === 'female' ? 'woman' : c.gender === 'male' ? 'man' : 'person'}` : c.gender === 'female' ? 'woman' : c.gender === 'male' ? 'man' : 'person';

/** Whole-word, case-insensitive match for a name (regex characters in it are escaped). */
const wordRe = (word: string) => new RegExp(String.raw`\b` + word.replace(/[.*+?^$()|[\]{}\\]/g, (ch) => '\\' + ch) + String.raw`\b`, 'gi');

/** Strong time-of-day lighting — replaces the style's default (often daylight) lighting words. */
const TIME_LIGHT: Record<string, string> = {
  dawn: 'at dawn, soft pink and pale gold early-morning light, low sun',
  sunset: 'at dusk, glowing orange sunset sky, warm low light, long shadows',
  night: 'at night, dark blue night sky, moonlight and stars, warm glow from lamps, deep shadows',
};

export interface SceneBrief {
  place: string;
  time?: string;
  actors: string[];
  narration: string;
  mood?: string;
}

/** What to draw, in short phrases (the style is added by buildSdPrompt). People are described, not named. */
export function scenePrompt(s: SceneBrief, cast: CharacterSpec[]): string {
  const castOf = (a: string) => cast.find((c) => c.name.toLowerCase() === a.toLowerCase());
  const people = s.actors.map((a) => {
    const c = castOf(a);
    return c ? `a ${shortWho(c)}` : a;
  });
  const humans = s.actors.filter((a) => castOf(a)).length;
  const subject = people.length ? `${people.join(' and ')} in ${s.place}` : s.place;
  // names → "the girl" etc., so the narration's objects and actions still guide the picture
  let moment = s.narration.replace(/\s+/g, ' ').trim();
  for (const c of cast) moment = moment.replace(wordRe(c.name), `the ${shortWho(c).replace(/^(young|elderly|teenage) /, '')}`);
  return [subject, TIME_LIGHT[s.time ?? ''] ?? 'in daylight', humans === 1 ? 'only one person in the scene' : '', moment.slice(0, 200), s.mood && s.mood !== 'neutral' ? `${s.mood} mood` : ''].filter(Boolean).join(', ');
}

/** Positive + negative prompts for one scene in an art style. */
export function stylisedScene(s: SceneBrief, style: string, cast: CharacterSpec[]): { prompt: string; negative: string } {
  const inScene = cast.filter((c) => s.actors.some((a) => a.toLowerCase() === c.name.toLowerCase()));
  const timed = Boolean(TIME_LIGHT[s.time ?? '']);
  return {
    prompt: buildSdPrompt(scenePrompt(s, cast), style, inScene.map((c) => describeCharacter(c, { named: false })), { lighting: timed ? '' : undefined }),
    negative: [
      buildNegativePrompt(style),
      'text, letters, watermark, signature, logo, extra limbs, deformed hands, duplicate characters, blurry',
      inScene.length === 1 ? 'two people, extra person, second child, crowd, twins' : '',
      timed ? 'bright midday sun, flat daylight' : '',
    ]
      .filter(Boolean)
      .join(', '),
  };
}
