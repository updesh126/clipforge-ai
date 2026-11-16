/**
 * ClipForge AI — 100% local AI pipeline.
 *
 *   video ──ffmpeg──▶ 16 kHz mono WAV ──whisper.cpp──▶ timed transcript
 *        ──Ollama (small LLM, e.g. qwen2.5:3b)──▶ ranked highlight clips
 *        (no Ollama? → built-in heuristic scorer, still fully automatic)
 *
 * No cloud calls, no API keys, no watermarks.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import type { ClipCandidate, ClipLengthPreset, TranscriptSegment, VideoMetadata, WordTiming } from './types.ts';
import { renderDemoMp4FromAudio } from './media.ts';
import { DATA_DIR, TEMP_DIR } from './store.ts';
import { hyperframesInstalled, listVoices, transcribeWords, ttsAvailable } from './hyperframes.ts';
import type { ProgressFn } from './progress.ts';
import { speak } from './tts.ts';

const execFileAsync = promisify(execFile);

// ---------- Config (override via .env) ----------
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5:3b';
const WHISPER_BIN = process.env.WHISPER_BIN || 'whisper-cli';
const WHISPER_MODEL_NAME = process.env.WHISPER_MODEL || 'base'; // tiny | base | small | medium
const WHISPER_LANG = process.env.WHISPER_LANG || 'auto';
const MODELS_DIR = path.join(DATA_DIR, 'models');

// ---------- Health / capability check ----------
export interface EngineStatus {
  ffmpeg: boolean;
  libass: boolean;
  whisper: boolean;
  whisperModel: boolean;
  whisperName: string;
  ollama: boolean;
  ollamaModel: string;
  ollamaModelInstalled: boolean;
  hyperframes: boolean;
  tts: boolean;
  voices: Array<{ id: string; label: string; language: string; gender: string }>;
}

async function hasBinary(bin: string, args: string[] = ['--help']): Promise<boolean> {
  try {
    await execFileAsync(bin, args, { timeout: 8000 });
    return true;
  } catch (err) {
    // Many CLIs exit non-zero on --help but still exist
    return (err as NodeJS.ErrnoException).code !== 'ENOENT';
  }
}

async function ollamaTags(): Promise<string[] | null> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return null;
    const data = (await res.json()) as { models?: Array<{ name: string }> };
    return (data.models ?? []).map((m) => m.name);
  } catch {
    return null;
  }
}

/** HyperFrames can build/fetch whisper.cpp itself on macOS/Linux; on Windows it needs HYPERFRAMES_WHISPER_PATH. */
function hyperframesWhisperUsable(): boolean {
  return hyperframesInstalled() && (process.platform !== 'win32' || Boolean(process.env.HYPERFRAMES_WHISPER_PATH));
}

export async function getEngineStatus(): Promise<EngineStatus> {
  const [ffmpeg, whisper, tags, tts, voices] = await Promise.all([
    hasBinary('ffmpeg', ['-version']),
    hasBinary(WHISPER_BIN, ['--help']),
    ollamaTags(),
    ttsAvailable(),
    listVoices(),
  ]);
  const base = OLLAMA_MODEL.includes(':') ? OLLAMA_MODEL : `${OLLAMA_MODEL}:latest`;
  const { ffmpegHasFilter } = await import('./media.ts');
  return {
    ffmpeg,
    libass: ffmpeg ? await ffmpegHasFilter('ass') : false,
    // HyperFrames can install its own whisper runtime, so transcription still works without whisper-cli
    whisper: whisper || hyperframesWhisperUsable(),
    whisperModel: fs.existsSync(whisperModelPath()),
    whisperName: whisper ? `whisper.cpp ${WHISPER_MODEL_NAME}` : hyperframesWhisperUsable() ? 'Whisper via HyperFrames' : 'missing',
    ollama: tags !== null,
    ollamaModel: OLLAMA_MODEL,
    ollamaModelInstalled: Boolean(tags?.some((t) => t === base || t === OLLAMA_MODEL)),
    hyperframes: hyperframesInstalled(),
    tts,
    voices,
  };
}

// ---------- Step 1: Transcription (whisper.cpp) ----------
function whisperModelPath(): string {
  if (WHISPER_MODEL_NAME.endsWith('.bin')) return path.resolve(WHISPER_MODEL_NAME);
  return path.join(MODELS_DIR, `ggml-${WHISPER_MODEL_NAME}.bin`);
}

async function ensureWhisperModel(): Promise<string> {
  const modelPath = whisperModelPath();
  if (fs.existsSync(modelPath)) return modelPath;
  fs.mkdirSync(MODELS_DIR, { recursive: true });
  const url = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${path.basename(modelPath)}`;
  console.log(`[clipforge] Downloading Whisper model (one-time): ${url}`);
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Could not download Whisper model (HTTP ${res.status}).`);
  const tmp = `${modelPath}.part`;
  fs.writeFileSync(tmp, Buffer.from(await res.arrayBuffer()));
  fs.renameSync(tmp, modelPath);
  return modelPath;
}

async function extractWav16k(videoPath: string, outWav: string) {
  await execFileAsync('ffmpeg', ['-y', '-i', videoPath, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', outWav], {
    maxBuffer: 1024 * 1024 * 10,
  });
}

/** Group word timings into caption-sized segments (≤ 48 chars, split on sentence ends and pauses). */
export function wordsToSegments(words: WordTiming[]): TranscriptSegment[] {
  const segs: TranscriptSegment[] = [];
  let cur: WordTiming[] = [];
  const flush = () => {
    if (!cur.length) return;
    segs.push({
      id: `seg_${segs.length + 1}`,
      start: round2(cur[0].start),
      end: round2(cur[cur.length - 1].end),
      text: cur.map((w) => w.text).join(' '),
      speaker: 'Speaker',
      words: cur.map((w) => ({ text: w.text, start: round2(w.start), end: round2(w.end) })),
    });
    cur = [];
  };
  for (const w of words) {
    const len = cur.reduce((n, x) => n + x.text.length + 1, 0) + w.text.length;
    const gap = cur.length ? w.start - cur[cur.length - 1].end : 0;
    if (cur.length && (len > 48 || gap > 1)) flush();
    cur.push(w);
    if (/[.!?]$/.test(w.text)) flush();
  }
  flush();
  return segs.filter((s) => s.end > s.start);
}

const cleanWord = (t: string) => t.replace(/\[.*?\]|\(.*?\)/g, '').trim();

async function whisperCliWords(wav: string, outBase: string): Promise<WordTiming[]> {
  const modelPath = await ensureWhisperModel();
  const threads = String(Math.max(2, Math.min(8, os.cpus().length - 1)));
  // -ml 1 -sow → one entry per word, giving word-level timestamps for karaoke captions
  await execFileAsync(
    WHISPER_BIN,
    ['-m', modelPath, '-f', wav, '-l', WHISPER_LANG, '-t', threads, '-ml', '1', '-sow', '-oj', '-of', outBase],
    { maxBuffer: 1024 * 1024 * 64, timeout: 1000 * 60 * 60 * 3, windowsHide: true }
  );
  const json = JSON.parse(fs.readFileSync(`${outBase}.json`, 'utf-8')) as {
    transcription?: Array<{ offsets: { from: number; to: number }; text: string }>;
  };
  const words: WordTiming[] = [];
  for (const t of json.transcription ?? []) {
    const text = cleanWord(t.text);
    if (!text) continue;
    const w = { text, start: t.offsets.from / 1000, end: t.offsets.to / 1000 };
    // whisper sometimes splits punctuation into its own token — glue it to the previous word
    if (/^[^\p{L}\p{N}]+$/u.test(text) && words.length) {
      words[words.length - 1].text += text;
      words[words.length - 1].end = Math.max(words[words.length - 1].end, w.end);
    } else if (w.end > w.start) {
      words.push(w);
    }
  }
  return words;
}

/** HyperFrames ships Whisper models as tiny.en/base.en/small.en/medium.en or small/medium/large-v3. */
function hyperframesModel(): string {
  const m = WHISPER_MODEL_NAME.replace(/\.bin$/, '').replace(/^ggml-/, '');
  if (['tiny.en', 'base.en', 'small.en', 'medium.en', 'small', 'medium', 'large-v3'].includes(m)) return m;
  const english = WHISPER_LANG === 'en';
  if (m === 'tiny' || m === 'base') return english ? `${m}.en` : 'small';
  return m.startsWith('large') ? 'large-v3' : english ? `${m}.en` : m;
}

export async function transcribeLocal(videoPath: string, jobId: string): Promise<TranscriptSegment[]> {
  const wav = path.join(TEMP_DIR, `${jobId}.wav`);
  const outBase = path.join(TEMP_DIR, `${jobId}_whisper`);
  const hfDir = path.join(TEMP_DIR, `${jobId}_hf_transcribe`);
  try {
    await extractWav16k(videoPath, wav);
    let words: WordTiming[];
    if (await hasBinary(WHISPER_BIN, ['--help'])) {
      words = await whisperCliWords(wav, outBase);
    } else if (hyperframesWhisperUsable()) {
      console.log('[clipforge] whisper-cli not found — transcribing through HyperFrames (Whisper)');
      fs.mkdirSync(hfDir, { recursive: true });
      words = (await transcribeWords(wav, hfDir, hyperframesModel(), WHISPER_LANG)).map((w) => ({ ...w, text: cleanWord(w.text) }));
    } else {
      throw new Error('No speech-to-text engine: install whisper.cpp (whisper-cli) or run npm install for HyperFrames.');
    }
    return wordsToSegments(words.filter((w) => w.text));
  } finally {
    for (const f of [wav, `${outBase}.json`]) fs.rmSync(f, { force: true });
    fs.rmSync(hfDir, { recursive: true, force: true });
  }
}

// ---------- Step 2: Clip selection ----------
function lengthRange(preset: ClipLengthPreset, duration: number): [number, number] {
  if (duration <= 30) return [4, Math.max(6, duration * 0.6)];
  switch (preset) {
    case 'short':
      return [12, 30];
    case 'medium':
      return [30, 60];
    case 'long':
      return [60, 90];
    default:
      return [15, 60];
  }
}

function targetCount(duration: number) {
  if (duration < 60) return 3;
  if (duration < 600) return 5;
  return Math.min(10, Math.round(duration / 120));
}

interface RawClip {
  title: string;
  hookLine?: string;
  reason?: string;
  category?: string;
  start: number;
  end: number;
  score?: number;
}

/** Ask a small local LLM via Ollama. Transcript is windowed so 3B models with 8k context cope with long videos. */
async function selectWithOllama(
  transcript: TranscriptSegment[],
  duration: number,
  preset: ClipLengthPreset,
  onWindow?: (done: number, total: number) => void
): Promise<{ summary: string; clips: RawClip[] }> {
  const [minLen, maxLen] = lengthRange(preset, duration);
  const lines = transcript.map((s) => `[${s.start.toFixed(1)}-${s.end.toFixed(1)}] ${s.text}`);
  const windows: string[][] = [];
  let cur: string[] = [];
  let chars = 0;
  for (const l of lines) {
    if (chars + l.length > 9000 && cur.length) {
      windows.push(cur);
      cur = [];
      chars = 0;
    }
    cur.push(l);
    chars += l.length + 1;
  }
  if (cur.length) windows.push(cur);

  const perWindow = Math.max(2, Math.ceil(targetCount(duration) / windows.length) + 1);
  const all: RawClip[] = [];
  let summary = '';

  for (const [wi, win] of windows.entries()) {
    onWindow?.(wi, windows.length);
    const prompt = `You are a viral short-form video editor (like Vizard / Opus Clip).
Below is a timestamped transcript (seconds). Pick up to ${perWindow} standalone highlight clips that would perform well as TikTok/Reels/Shorts.
Rules:
- Each clip ${Math.round(minLen)}-${Math.round(maxLen)} seconds long.
- Start on a strong hook (bold claim, question, surprising number, emotion). Never start mid-sentence.
- End after the payoff, on a complete thought.
- Clips must not overlap. Use only timestamps that appear in the transcript.
- score = 0-100 predicted virality.
Return ONLY JSON: {"summary":"one sentence about the video","clips":[{"title":"max 8 words","hookLine":"first line spoken","reason":"why it works","category":"1-2 words","start":0.0,"end":0.0,"score":0}]}

TRANSCRIPT:
${win.join('\n')}`;

    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        format: 'json',
        stream: false,
        options: { temperature: 0.3, num_ctx: 8192 },
      }),
    });
    if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { response: string };
    try {
      const parsed = JSON.parse(data.response) as { summary?: string; clips?: RawClip[] };
      if (!summary && parsed.summary) summary = parsed.summary;
      all.push(...(parsed.clips ?? []).filter((c) => Number.isFinite(+c.start) && Number.isFinite(+c.end)));
    } catch {
      // model produced junk for this window — skip it
    }
  }
  return { summary, clips: all };
}

/** Zero-dependency fallback: scores sliding windows for hook/energy signals. */
const HOOK_WORDS =
  /\b(secret|mistake|never|always|truth|why|how|best|worst|biggest|crazy|actually|stop|nobody|everyone|money|million|first|finally|here's|problem|insane|important|wrong|lesson)\b/gi;

function selectHeuristic(transcript: TranscriptSegment[], duration: number, preset: ClipLengthPreset): RawClip[] {
  const [minLen, maxLen] = lengthRange(preset, duration);
  const target = (minLen + maxLen) / 2;
  const cands: RawClip[] = [];
  for (let i = 0; i < transcript.length; i++) {
    let j = i;
    while (j + 1 < transcript.length && transcript[j + 1].end - transcript[i].start <= target) j++;
    const start = transcript[i].start;
    const end = transcript[j].end;
    if (end - start < minLen * 0.8) continue;
    const segs = transcript.slice(i, j + 1);
    const text = segs.map((s) => s.text).join(' ');
    const words = text.split(/\s+/).length;
    const opener = transcript[i].text;
    let score = (words / (end - start)) * 10; // speaking energy
    score += (text.match(HOOK_WORDS)?.length ?? 0) * 4;
    score += (opener.match(HOOK_WORDS)?.length ?? 0) * 8 + (/\?$/.test(opener) ? 10 : 0);
    score += (text.match(/\d/g)?.length ?? 0) * 1.5 + (text.match(/[!?]/g)?.length ?? 0) * 2;
    if (/[.!?]$/.test(transcript[j].text)) score += 6;
    if (/^(and|but|so|or|because)\b/i.test(opener)) score -= 12;
    cands.push({
      title: opener.split(/\s+/).slice(0, 7).join(' '),
      hookLine: opener,
      reason: 'High speaking energy with hook keywords and a clean sentence ending.',
      category: /\?/.test(text) ? 'Q&A' : 'Highlight',
      start,
      end,
      score,
    });
  }
  // Map raw heuristic scores onto a 0-100 virality scale (best candidate ≈ 92)
  const vals = cands.map((c) => c.score ?? 0);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  for (const c of cands) c.score = hi > lo ? 35 + (57 * ((c.score ?? 0) - lo)) / (hi - lo) : 60;
  return cands;
}

function snapAndFinalise(
  raw: RawClip[],
  transcript: TranscriptSegment[],
  duration: number,
  max: number,
  minLen = 0
): ClipCandidate[] {
  const snap = (t: number, edge: 'start' | 'end') => {
    if (!transcript.length) return t;
    let best = transcript[0][edge];
    for (const s of transcript) if (Math.abs(s[edge] - t) < Math.abs(best - t)) best = s[edge];
    return Math.abs(best - t) <= 4 ? best : t;
  };
  const picked: ClipCandidate[] = [];
  const sorted = [...raw].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  for (const c of sorted) {
    let start = clamp(snap(+c.start, 'start'), 0, duration - 2);
    let end = clamp(snap(+c.end, 'end'), start + 2, duration);
    // Small LLMs often return a single sentence — grow to the minimum length on sentence boundaries
    for (const seg of transcript) {
      if (end - start >= minLen) break;
      if (seg.end > end) end = seg.end;
    }
    if (end - start < minLen) start = clamp(snap(end - minLen, 'start'), 0, start);
    if (end - start > 120) end = start + 120;
    if (picked.some((p) => start < p.end - 1 && end > p.start + 1)) continue;
    picked.push({
      id: `clip_${picked.length + 1}`,
      title: String(c.title || `Highlight ${picked.length + 1}`).trim().slice(0, 80),
      hookLine: String(c.hookLine || '').trim(),
      reason: String(c.reason || 'Strong standalone moment.').trim(),
      score: Math.round(clamp(Number(c.score) || 50, 0, 100)),
      category: String(c.category || 'Highlight').trim(),
      start: round2(start),
      end: round2(end),
      aspectRatio: '9:16',
      cropX: 50,
      captionStyle: 'highlight',
      exportedFiles: [],
    });
    if (picked.length >= max) break;
  }
  // Best clips were chosen by score; show them in timeline order
  return picked.sort((a, b) => a.start - b.start).map((c, i) => ({ ...c, id: `clip_${i + 1}` }));
}

export async function analyzeVideoAndSelectClips(params: {
  projectId: string;
  videoPath: string;
  metadata: VideoMetadata;
  clipLengthPreset: ClipLengthPreset;
  onProgress?: ProgressFn;
}): Promise<{ summary: string; transcript: TranscriptSegment[]; clips: ClipCandidate[] }> {
  const { projectId, videoPath, metadata, clipLengthPreset } = params;
  const progress = params.onProgress ?? (() => {});
  const duration = Math.max(1, metadata.duration);

  progress('transcribe', 'Transcribing speech with Whisper', 15);
  const transcript = metadata.hasAudio ? await transcribeLocal(videoPath, projectId) : [];
  progress('select', 'Finding the best moments', 60);
  const max = targetCount(duration);

  let summary = '';
  let raw: RawClip[] = [];
  let engine = 'heuristic';
  if (transcript.length) {
    try {
      const r = await selectWithOllama(transcript, duration, clipLengthPreset, (d, t) =>
        progress('select', `Ranking highlights with ${OLLAMA_MODEL} (${d + 1}/${t})`, 60 + (30 * d) / t)
      );
      summary = r.summary;
      raw = r.clips;
      engine = `Ollama ${OLLAMA_MODEL}`;
    } catch (err) {
      console.warn('[clipforge] Ollama unavailable, using heuristic selector:', (err as Error).message);
    }
    if (raw.length === 0) raw = selectHeuristic(transcript, duration, clipLengthPreset);
  }

  let clips = snapAndFinalise(raw, transcript, duration, max, lengthRange(clipLengthPreset, duration)[0]);
  if (!clips.length) {
    // silent video or nothing found: evenly spaced segments
    const len = Math.min(30, duration);
    clips = snapAndFinalise(
      Array.from({ length: Math.max(1, Math.min(3, Math.floor(duration / len))) }, (_, i) => ({
        title: `Segment ${i + 1}`,
        start: i * len,
        end: i * len + len,
        reason: 'No speech detected — evenly spaced segment.',
      })),
      [],
      duration,
      3
    );
  }

  progress('finalise', 'Snapping clips to sentences', 95);
  return {
    summary: (summary || transcript.slice(0, 2).map((s) => s.text).join(' ') || 'Video segmented into clips.') + ` (selected by ${engine})`,
    transcript,
    clips,
  };
}

/** Cloud-only feature removed in the local build. YouTube now always downloads via yt-dlp. */
export async function analyzeYoutubeUrlDirect(_: {
  youtubeUrl: string;
  clipLengthPreset: ClipLengthPreset;
}): Promise<{ durationSeconds: number; summary: string; transcript: TranscriptSegment[]; clips: ClipCandidate[] }> {
  throw new Error('Could not download this YouTube video locally (yt-dlp failed). Download it manually and upload the file.');
}

/** Sample video narrated by local TTS (HyperFrames Kokoro, else the OS voice). */
export async function createDemoVideoAsset(outMp4Path: string): Promise<void> {
  const script =
    "Most creators spend four hours editing a single podcast episode, only to publish one horizontal video that nobody finishes. Here is the shift. Short-form clips are not trailers, they are standalone ideas. Why does that matter? Because the first two seconds decide everything. Never start with hey guys welcome back. Start with the sharpest claim or the most surprising number you said. Here's the biggest mistake I see. People think captions are optional. They are not. Eighty five percent of viewers watch on mute. Finally, keep everything local. No cloud lock-in, no subscriptions, and zero watermarks on your brand.";
  const wav = path.join(TEMP_DIR, `demo_tts_${Date.now()}.wav`);
  try {
    await speak(script, wav);
    await renderDemoMp4FromAudio(wav, outMp4Path);
  } finally {
    fs.rmSync(wav, { force: true });
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
