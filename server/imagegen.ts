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
import { execFile } from 'node:child_process';
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
    const checkpoint = (wanted && checkpoints.find((c) => c === wanted || path.basename(c) === wanted)) || checkpoints.find((c) => /xl/i.test(c) && !/ltx|wan|hunyuan/i.test(c)) || checkpoints.find((c) => !/ltx|wan|hunyuan/i.test(c)) || null;
    value = { running: true, url: SD_URL, checkpoints, checkpoint, gpu: stats.devices?.[0]?.name };
  } catch {
    // not running — keep the default
  }
  statusCache = { at: Date.now(), value };
  return value;
}

/** Live progress from a ComfyUI job: a short label, 0..1, the latest preview frame URL and sampler step. */
export type ComfyProgress = (msg: string, fraction: number, live?: { preview?: string; step?: number; steps?: number }) => void;

export interface GenerateOptions {
  prompt: string;
  negative?: string;
  width: number;
  height: number;
  seed?: number;
  steps?: number;
  cfg?: number;
  onProgress?: ComfyProgress;
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

interface ComfyFile {
  filename: string;
  subfolder: string;
  type: string;
}

/**
 * Queue a workflow on ComfyUI, report live progress (steps over the WebSocket, preview frames when ComfyUI was started
 * with --preview-method), and download the first saved output into `out`.
 *   loadNode / decodeNode: node ids that mean "loading the model" and "finishing" in the progress label
 */
async function runComfy(wf: Record<string, unknown>, out: string, opts: { onProgress?: ComfyProgress; steps: number; loadNode: string; decodeNode: string; what: string; timeoutMin: number }) {
  const clientId = crypto.randomUUID();
  let phase = 'Waiting for the GPU';
  let fraction = 0;
  let step = 0;
  let steps = opts.steps;
  let preview: string | undefined;
  let lastWrite = 0;
  const liveFile = path.join(LIVE_DIR, `${clientId}.jpg`);
  let ws: WebSocket | null = null;
  try {
    ws = new WebSocket(`${SD_URL.replace(/^http/, 'ws')}/ws?clientId=${clientId}`);
    ws.binaryType = 'arraybuffer';
    ws.onmessage = (ev) => {
      if (typeof ev.data !== 'string') {
        // preview frame: [u32 event][u32 image type | u32 metadata length + metadata][image bytes]
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
        } else if (m.type === 'executing' && m.data?.node === opts.loadNode) phase = 'Loading model (first time only)';
        else if (m.type === 'executing' && m.data?.node === opts.decodeNode) {
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
  try {
    const queued = await getJson<{ prompt_id: string }>(
      `${SD_URL}/prompt`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: wf, client_id: clientId }) },
      15_000,
    );
    const started = Date.now();
    let polls = 0;
    let goneChecks = 0;
    type Hist = Record<string, { status?: { status_str?: string; messages?: unknown[] }; outputs?: Record<string, Record<string, unknown>> }>;
    for (;;) {
      if (Date.now() - started > opts.timeoutMin * 60_000) throw new Error(`ComfyUI took longer than ${opts.timeoutMin} minutes for one ${opts.what}.`);
      await new Promise((r) => setTimeout(r, 1000));
      const hist = await getJson<Hist>(`${SD_URL}/history/${queued.prompt_id}`, undefined, 10_000).catch(() => ({}) as Hist);
      const h = hist[queued.prompt_id];
      if (!h) {
        // every few seconds: is the job still queued or running? (it vanishes if cancelled or cleared in ComfyUI)
        if (++polls % 4 === 0 && !(await stillQueued(queued.prompt_id))) {
          if (++goneChecks >= 2) throw new Error('The ComfyUI job was cancelled or removed from its queue.');
        } else if (polls % 4 === 0) goneChecks = 0;
        const secs = Math.round((Date.now() - started) / 1000);
        opts.onProgress?.(ws ? `${phase} · ${secs}s` : `Working… ${secs}s`, ws ? fraction : Math.min(0.9, secs / 60), { preview, step, steps });
        continue;
      }
      if (h.status?.status_str === 'error') {
        const detail = JSON.stringify(h.status.messages ?? []);
        if (/execution_interrupted/.test(detail)) throw new Error('The ComfyUI job was cancelled (interrupted in ComfyUI).');
        throw new Error(`ComfyUI failed: ${detail.slice(0, 500)}`);
      }
      // images, gifs and videos all come back as lists of {filename, subfolder, type}
      const file = Object.values(h.outputs ?? {})
        .flatMap((o) => Object.values(o).filter(Array.isArray).flat() as unknown[])
        .find((x): x is ComfyFile => Boolean(x && typeof x === 'object' && 'filename' in (x as object)));
      if (!file) continue;
      const q = new URLSearchParams({ filename: file.filename, subfolder: file.subfolder, type: file.type });
      const res = await fetch(`${SD_URL}/view?${q}`, { signal: AbortSignal.timeout(120_000) });
      if (!res.ok) throw new Error(`Could not download the ${opts.what} from ComfyUI (${res.status}).`);
      fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
      return { steps };
    }
  } finally {
    ws?.close();
    fs.rm(liveFile, { force: true }, () => {}); // the final file replaces the live preview
  }
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
  const { steps } = await runComfy(workflow(st.checkpoint, o), file, { onProgress: opts.onProgress, steps: o.steps, loadNode: '1', decodeNode: '6', what: 'image', timeoutMin: 10 });
  opts.onProgress?.('Done', 1, { preview: url, step: steps, steps });
  return { url, file, cached: false };
}

/** True while ComfyUI still has the job running or waiting in its queue. Unknown (no answer) counts as yes. */
async function stillQueued(promptId: string): Promise<boolean> {
  try {
    const q = await getJson<{ queue_running: unknown[][]; queue_pending: unknown[][] }>(`${SD_URL}/queue`, undefined, 5000);
    return [...q.queue_running, ...q.queue_pending].some((item) => item[1] === promptId);
  } catch {
    return true;
  }
}

/** Stop what ComfyUI is doing for ClipForge: interrupt the running job and clear the waiting ones. */
export async function stopComfy(): Promise<void> {
  await Promise.allSettled([
    fetch(`${SD_URL}/interrupt`, { method: 'POST', signal: AbortSignal.timeout(5000) }),
    fetch(`${SD_URL}/queue`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clear: true }), signal: AbortSignal.timeout(5000) }),
  ]);
}

// ---------------------------------------------------------------- image → video (Motion)

/**
 * Two image-to-video engines, both through ComfyUI (install with: npm run comfy:setup):
 *   ltx — LTX-Video 2B distilled: fast (~30 s per 4 s clip on a 12 GB GPU), 11.5 GB
 *         models/checkpoints/ltxv-2b-*.safetensors + models/text_encoders/t5xxl_*.safetensors
 *   wan — Wan 2.2 TI2V 5B: best motion and style hold, several minutes per clip, 18.2 GB
 *         models/diffusion_models/wan2.2_ti2v_5B_*.safetensors + models/text_encoders/umt5_xxl_*.safetensors + models/vae/wan2.2_vae.safetensors
 * SD_VIDEO_ENGINE (ltx | wan) picks the default when both are installed.
 */
export const VIDEO_FPS = 30; // clips are delivered at the editor's frame rate, so they play 1:1 (no judder)
const LTX_FPS = 30; // LTX-Video generates at the delivery rate directly
const WAN_FPS = 24; // Wan 2.2 5B is a 24 fps model → blended up to 30 after generation
export type VideoEngine = 'ltx' | 'wan';
const LTX_STEPS = Number(process.env.SD_VIDEO_STEPS) || 8; // distilled model: 8 steps, cfg 1
const WAN_STEPS = Number(process.env.SD_WAN_STEPS) || 20;
const LTX_SIZES: Record<string, [number, number]> = { '9:16': [544, 960], '16:9': [960, 544], '1:1': [768, 768], '4:5': [640, 800] };
const WAN_SIZES: Record<string, [number, number]> = { '9:16': [480, 832], '16:9': [832, 480], '1:1': [640, 640], '4:5': [544, 672] };
export const videoSize = (aspect: string, engine: VideoEngine = 'ltx'): [number, number] => (engine === 'wan' ? WAN_SIZES : LTX_SIZES)[aspect] ?? (engine === 'wan' ? WAN_SIZES : LTX_SIZES)['9:16'];

export interface VideoModels {
  ltx?: { checkpoint: string; textEncoder: string };
  wan?: { model: string; textEncoder: string; vae: string };
  /** engine used when none is asked for */
  default: VideoEngine | null;
}

async function loaderList(node: string, input: string): Promise<string[]> {
  const d = await getJson<Record<string, { input: { required: Record<string, [string[]]> } }>>(`${SD_URL}/object_info/${node}`, undefined, 4000);
  return d[node]?.input.required[input]?.[0] ?? [];
}

/** Which image-to-video engines ComfyUI can run right now. */
export async function videoModels(): Promise<VideoModels> {
  try {
    const [cks, tes, unets, vaes] = await Promise.all([loaderList('CheckpointLoaderSimple', 'ckpt_name'), loaderList('CLIPLoader', 'clip_name'), loaderList('UNETLoader', 'unet_name'), loaderList('VAELoader', 'vae_name')]);
    const ltxCk = (process.env.SD_VIDEO_CHECKPOINT && cks.find((c) => c === process.env.SD_VIDEO_CHECKPOINT)) || cks.find((c) => /ltx-?v/i.test(c) && /distill/i.test(c)) || cks.find((c) => /ltx-?v/i.test(c));
    const t5 = (process.env.SD_VIDEO_TEXT_ENCODER && tes.find((c) => c === process.env.SD_VIDEO_TEXT_ENCODER)) || tes.find((c) => /t5xxl/i.test(c));
    const wanModel = unets.find((u) => /wan2\.?2.*ti2v.*5b/i.test(u));
    const umt5 = tes.find((c) => /umt5/i.test(c));
    const wanVae = vaes.find((v) => /wan2\.?2.*vae/i.test(v));
    const ltx = ltxCk && t5 ? { checkpoint: ltxCk, textEncoder: t5 } : undefined;
    const wan = wanModel && umt5 && wanVae ? { model: wanModel, textEncoder: umt5, vae: wanVae } : undefined;
    const pref = process.env.SD_VIDEO_ENGINE === 'wan' ? 'wan' : process.env.SD_VIDEO_ENGINE === 'ltx' ? 'ltx' : null;
    const def: VideoEngine | null = pref && (pref === 'wan' ? wan : ltx) ? pref : ltx ? 'ltx' : wan ? 'wan' : null;
    return { ltx, wan, default: def };
  } catch {
    return { default: null };
  }
}

/** Kept for callers that only need "is Motion available": the default engine's main file name. */
export async function videoModel(): Promise<{ engine: VideoEngine; checkpoint: string } | null> {
  const m = await videoModels();
  if (m.default === 'ltx' && m.ltx) return { engine: 'ltx', checkpoint: m.ltx.checkpoint };
  if (m.default === 'wan' && m.wan) return { engine: 'wan', checkpoint: m.wan.model };
  return null;
}

export interface AnimateOptions {
  image: string; // local PNG/JPG path (e.g. a scene painting)
  prompt: string; // what moves
  negative?: string;
  aspect: string;
  /** clip length in seconds (preferred); frames are worked out for the engine's frame rate */
  seconds?: number;
  frames?: number; // raw frame count, if you need exact control
  seed?: number;
  engine?: VideoEngine; // default: the installed one (SD_VIDEO_ENGINE when both are)
  onProgress?: ComfyProgress;
}

/** Upload a local image to ComfyUI's input folder and return the name to load it by. */
async function uploadImage(file: string): Promise<string> {
  const form = new FormData();
  const name = `clipforge_${crypto.createHash('sha1').update(file).digest('hex').slice(0, 12)}${path.extname(file) || '.png'}`;
  form.append('image', new Blob([fs.readFileSync(file)]), name);
  form.append('overwrite', 'true');
  const res = await fetch(`${SD_URL}/upload/image`, { method: 'POST', body: form, signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`Could not send the picture to ComfyUI (${res.status}).`);
  const d = (await res.json()) as { name: string; subfolder?: string };
  return d.subfolder ? `${d.subfolder}/${d.name}` : d.name;
}

/**
 * Animate a still picture into a short clip (WebM, VP9) and return its URL (/media/generated/<hash>.webm).
 * Cached like images: same picture + prompt + seed + engine → same clip.
 */
export async function animateImage(opts: AnimateOptions): Promise<{ url: string; file: string; cached: boolean; seconds: number; engine: VideoEngine }> {
  const st = await sdStatus(true);
  if (!st.running) throw new Error(`Stable Diffusion (ComfyUI) is not running at ${SD_URL}.`);
  const models = await videoModels();
  const engine: VideoEngine | null = opts.engine && models[opts.engine] ? opts.engine : models.default;
  if (!engine) throw new Error('Motion needs a video model. Install it with: npm run comfy:setup');
  const [width, height] = videoSize(opts.aspect, engine);
  // LTX wants 8n+1 frames, Wan 4n+1
  const step = engine === 'ltx' ? 8 : 4;
  const genFps = engine === 'ltx' ? LTX_FPS : WAN_FPS;
  const wanted = opts.seconds ? Math.round(opts.seconds * genFps) : (opts.frames ?? 97);
  const frames = Math.max(step + 1, Math.round((wanted - 1) / step) * step + 1);
  const seed = opts.seed ?? 1;
  const steps = engine === 'ltx' ? LTX_STEPS : WAN_STEPS;
  const src = fs.readFileSync(opts.image);
  const key = crypto.createHash('sha1').update(src).update(JSON.stringify({ v: 2, p: opts.prompt, n: opts.negative, width, height, frames, genFps, seed, steps, engine, m: models[engine] })).digest('hex').slice(0, 20);
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
  const file = path.join(GENERATED_DIR, `${key}.webm`);
  const url = `/media/generated/${key}.webm`;
  const seconds = frames / genFps;
  if (fs.existsSync(file)) return { url, file, cached: true, seconds, engine };
  const input = await uploadImage(opts.image);
  // shaky camera and flicker are what make clips look unstable — always steer away from them
  const negative = `${opts.negative || 'worst quality, inconsistent motion, blurry, distorted, morphing faces, extra limbs, text, watermark'}, camera shake, shaky handheld camera, jittery motion, flickering, strobing, warping background`;
  // saved near-lossless; the deflicker pass below makes the delivery file
  const save = (images: [string, number]) => ({ class_type: 'SaveWEBM', inputs: { images, filename_prefix: 'clipforge_video', codec: 'vp9', fps: genFps, crf: 12 } });

  let wf: Record<string, unknown>;
  let decodeNode: string;
  if (engine === 'ltx') {
    const m = models.ltx!;
    wf = {
      '1': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: m.checkpoint } },
      '2': { class_type: 'CLIPLoader', inputs: { clip_name: m.textEncoder, type: 'ltxv' } },
      '3': { class_type: 'CLIPTextEncode', inputs: { text: opts.prompt, clip: ['2', 0] } },
      '4': { class_type: 'CLIPTextEncode', inputs: { text: negative, clip: ['2', 0] } },
      '5': { class_type: 'LoadImage', inputs: { image: input } },
      '6': { class_type: 'LTXVPreprocess', inputs: { image: ['5', 0], img_compression: 30 } },
      '7': { class_type: 'LTXVImgToVideo', inputs: { positive: ['3', 0], negative: ['4', 0], vae: ['1', 2], image: ['6', 0], width, height, length: frames, batch_size: 1, strength: 1 } },
      '8': { class_type: 'LTXVConditioning', inputs: { positive: ['7', 0], negative: ['7', 1], frame_rate: genFps } },
      '9': { class_type: 'KSamplerSelect', inputs: { sampler_name: 'euler' } },
      '10': { class_type: 'LTXVScheduler', inputs: { steps, max_shift: 2.05, base_shift: 0.95, stretch: true, terminal: 0.1, latent: ['7', 2] } },
      '11': { class_type: 'SamplerCustom', inputs: { model: ['1', 0], add_noise: true, noise_seed: seed, cfg: 1, positive: ['8', 0], negative: ['8', 1], sampler: ['9', 0], sigmas: ['10', 0], latent_image: ['7', 2] } },
      '12': { class_type: 'VAEDecode', inputs: { samples: ['11', 0], vae: ['1', 2] } },
      '13': save(['12', 0]),
    };
    decodeNode = '12';
  } else {
    const m = models.wan!;
    wf = {
      '1': { class_type: 'UNETLoader', inputs: { unet_name: m.model, weight_dtype: 'default' } },
      '2': { class_type: 'CLIPLoader', inputs: { clip_name: m.textEncoder, type: 'wan' } },
      '3': { class_type: 'VAELoader', inputs: { vae_name: m.vae } },
      '4': { class_type: 'CLIPTextEncode', inputs: { text: opts.prompt, clip: ['2', 0] } },
      '5': { class_type: 'CLIPTextEncode', inputs: { text: negative, clip: ['2', 0] } },
      '6': { class_type: 'LoadImage', inputs: { image: input } },
      '7': { class_type: 'Wan22ImageToVideoLatent', inputs: { vae: ['3', 0], width, height, length: frames, batch_size: 1, start_image: ['6', 0] } },
      '8': { class_type: 'ModelSamplingSD3', inputs: { model: ['1', 0], shift: 8 } },
      '9': { class_type: 'KSampler', inputs: { model: ['8', 0], positive: ['4', 0], negative: ['5', 0], latent_image: ['7', 0], seed, steps, cfg: 5, sampler_name: 'uni_pc', scheduler: 'simple', denoise: 1 } },
      '10': { class_type: 'VAEDecode', inputs: { samples: ['9', 0], vae: ['3', 0] } },
      '11': save(['10', 0]),
    };
    decodeNode = '10';
  }
  const raw = `${file}.raw.webm`;
  const done = await runComfy(wf, raw, { onProgress: opts.onProgress, steps, loadNode: '1', decodeNode, what: 'video clip', timeoutMin: engine === 'wan' ? 40 : 20 });
  opts.onProgress?.('Smoothing', 0.99, { step: done.steps, steps: done.steps });
  await stabiliseClip(raw, file, genFps);
  fs.rm(raw, { force: true }, () => {});
  opts.onProgress?.('Done', 1, { step: done.steps, steps: done.steps });
  return { url, file, cached: false, seconds, engine };
}

/**
 * Make a generated clip steady: remove brightness flicker between frames (deflicker), gently denoise in time
 * (hqdn3d — calms crawling texture without blurring motion), and blend 24 fps up to the editor's 30 fps so
 * it plays 1:1 with no repeated frames. Falls back to the raw clip if FFmpeg can't do it.
 */
async function stabiliseClip(input: string, output: string, fps: number) {
  const filters = ['deflicker=mode=pm:size=5', 'hqdn3d=0:0:3:3', ...(fps !== VIDEO_FPS ? [`framerate=fps=${VIDEO_FPS}`] : [])].join(',');
  try {
    await new Promise<void>((resolve, reject) =>
      execFile('ffmpeg', ['-v', 'error', '-y', '-i', input, '-vf', filters, '-an', '-c:v', 'libvpx-vp9', '-crf', '20', '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4', output], { windowsHide: true, timeout: 5 * 60_000 }, (err) => (err ? reject(err) : resolve())),
    );
  } catch (err) {
    console.warn('[clipforge] clip smoothing failed, using the raw clip:', (err as Error).message);
    fs.copyFileSync(input, output);
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
