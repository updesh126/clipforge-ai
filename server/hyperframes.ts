/**
 * HyperFrames integration (https://hyperframes.heygen.com, Apache-2.0) — all local:
 *   • render   HTML + GSAP compositions → MP4 (animated karaoke / pop captions, hook title, intro card)
 *   • tts      Kokoro-82M text-to-speech (voice intros, sample video narration)
 *   • transcribe  word-level Whisper timings (fallback when whisper-cli is not on PATH)
 *
 * Telemetry is switched off for every call (HYPERFRAMES_NO_TELEMETRY / DO_NOT_TRACK).
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import type { AspectRatio, CaptionStyle, TranscriptSegment, WordTiming } from './types.ts';
import { TEMP_DIR } from './store.ts';

const execFileAsync = promisify(execFile);

const CLI = process.env.HYPERFRAMES_BIN || path.join(process.cwd(), 'node_modules', 'hyperframes', 'bin', 'hyperframes.mjs');
const GSAP_JS = path.join(process.cwd(), 'node_modules', 'gsap', 'dist', 'gsap.min.js');
export const DEFAULT_VOICE = process.env.TTS_VOICE || 'af_heart';

const env = () => ({ ...process.env, HYPERFRAMES_NO_TELEMETRY: '1', DO_NOT_TRACK: '1' });

export function hyperframesInstalled(): boolean {
  return fs.existsSync(CLI);
}

async function hf(args: string[], opts: { cwd?: string; timeout?: number } = {}) {
  if (!hyperframesInstalled()) throw new Error('HyperFrames is not installed (run npm install).');
  try {
    return await execFileAsync(process.execPath, [CLI, ...args], {
      cwd: opts.cwd ?? process.cwd(),
      env: env(),
      timeout: opts.timeout ?? 1000 * 60 * 30,
      maxBuffer: 1024 * 1024 * 64,
      windowsHide: true,
    });
  } catch (err) {
    const e = err as { stderr?: string; stdout?: string; message: string };
    const detail = (e.stdout || '').match(/"message"\s*:\s*"([^"]+)"/)?.[1] || e.stderr?.trim().split('\n').slice(-3).join(' ') || e.message;
    throw new Error(`HyperFrames ${args[0]} failed: ${detail}`);
  }
}

// ---------- TTS (Kokoro) ----------
export interface Voice {
  id: string;
  label: string;
  language: string;
  gender: string;
}

let voiceCache: Voice[] | null = null;
export async function listVoices(): Promise<Voice[]> {
  if (voiceCache) return voiceCache;
  try {
    const { stdout } = await hf(['tts', '--list', '--json'], { timeout: 30_000 });
    voiceCache = JSON.parse(stdout.slice(stdout.indexOf('['))) as Voice[];
  } catch {
    voiceCache = [];
  }
  return voiceCache;
}

let ttsReady: boolean | null = null;
/** True when Kokoro can actually speak (needs Python 3.12 with `kokoro-onnx` and `soundfile`). Probed once. */
export async function ttsAvailable(): Promise<boolean> {
  if (ttsReady !== null) return ttsReady;
  if (!hyperframesInstalled()) return (ttsReady = false);
  const probe = path.join(TEMP_DIR, `tts_probe_${Date.now()}.wav`);
  try {
    fs.mkdirSync(path.dirname(probe), { recursive: true });
    await hf(['tts', 'ok', '-o', probe, '--json'], { timeout: 180_000 });
    ttsReady = fs.existsSync(probe);
  } catch {
    ttsReady = false;
  } finally {
    fs.rmSync(probe, { force: true });
  }
  return ttsReady;
}

export async function synthesizeSpeech(text: string, outWav: string, voice = DEFAULT_VOICE, speed = 1): Promise<string> {
  const txt = outWav.replace(/\.wav$/i, '') + '.txt';
  fs.writeFileSync(txt, text, 'utf-8');
  try {
    await hf(['tts', txt, '-o', outWav, '-v', voice, '-s', String(speed), '--json'], { timeout: 1000 * 60 * 10 });
  } finally {
    fs.rmSync(txt, { force: true });
  }
  if (!fs.existsSync(outWav)) throw new Error('HyperFrames TTS produced no audio.');
  return outWav;
}

// ---------- Transcription fallback ----------
/** Word-level transcription through HyperFrames (installs the whisper runtime on first use). */
export async function transcribeWords(wavPath: string, workDir: string, model: string, language: string): Promise<WordTiming[]> {
  const args = ['transcribe', wavPath, '--model', model, '--json', '-d', workDir];
  if (language && language !== 'auto') args.push('--language', language);
  const { stdout } = await hf(args, { cwd: workDir, timeout: 1000 * 60 * 120 });
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout.slice(stdout.search(/[[{]/)));
  } catch {
    const file = path.join(workDir, 'transcript.json');
    parsed = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf-8')) : [];
  }
  const obj = parsed as { words?: unknown[]; transcript?: unknown[] } | unknown[];
  const arr = (Array.isArray(obj) ? obj : obj.words ?? obj.transcript ?? []) as Array<{ text?: string; word?: string; start: number; end: number }>;
  return arr
    .map((w) => ({ text: String(w.text ?? w.word ?? '').trim(), start: Number(w.start), end: Number(w.end) }))
    .filter((w) => w.text && Number.isFinite(w.start) && Number.isFinite(w.end));
}

// ---------- Word helpers (shared with the FFmpeg ASS path) ----------
/** Words of a segment; if the text was edited, re-time the new words evenly across the segment. */
export function segmentWords(seg: TranscriptSegment): WordTiming[] {
  const tokens = seg.text.trim().split(/\s+/).filter(Boolean);
  if (seg.words?.length && seg.words.length === tokens.length) {
    return seg.words.map((w, i) => ({ ...w, text: tokens[i] }));
  }
  const len = Math.max(0.2, seg.end - seg.start);
  const totalChars = tokens.reduce((n, t) => n + t.length + 1, 0) || 1;
  let t = seg.start;
  return tokens.map((text) => {
    const d = (len * (text.length + 1)) / totalChars;
    const w = { text, start: t, end: t + d };
    t += d;
    return w;
  });
}

/** Group words into short caption "pages" (2-4 words) for punchy vertical captions. */
export function wordPages(words: WordTiming[], maxWords: number, maxChars: number): WordTiming[][] {
  const pages: WordTiming[][] = [];
  let cur: WordTiming[] = [];
  for (const w of words) {
    const chars = cur.reduce((n, x) => n + x.text.length + 1, 0) + w.text.length;
    const gap = cur.length ? w.start - cur[cur.length - 1].end : 0;
    if (cur.length && (cur.length >= maxWords || chars > maxChars || gap > 0.7)) {
      pages.push(cur);
      cur = [];
    }
    cur.push(w);
    if (/[.!?…।॥]$/.test(w.text)) {
      pages.push(cur);
      cur = [];
    }
  }
  if (cur.length) pages.push(cur);
  return pages;
}

// ---------- Composition + render ----------
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r3 = (n: number) => Math.round(n * 1000) / 1000;

export const BRAND = { mint: '#B5E2DD', pink: '#F4C7D6', lavender: '#D8CCE8', peach: '#FBDFCB', yellow: '#FFE44D' };

export interface CompositionInput {
  width: number;
  height: number;
  clipDuration: number; // seconds of footage
  introDuration: number; // 0 = no intro card
  words: WordTiming[]; // relative to clip start (0 = first frame of footage)
  captionStyle: CaptionStyle;
  title: string;
  hookTitle: boolean;
  hasIntroBg: boolean;
}

export function buildCompositionHtml(o: CompositionInput): string {
  const { width: W, height: H, clipDuration, introDuration: I, captionStyle } = o;
  const total = r3(I + clipDuration);
  const portrait = H > W;
  const fs = Math.round(W * (portrait ? 0.072 : W === H ? 0.06 : 0.042));
  const accent = captionStyle === 'highlight' ? BRAND.yellow : BRAND.mint;
  const showCaps = captionStyle !== 'off' && o.words.length > 0;
  const pages = showCaps ? wordPages(o.words, portrait ? 3 : 6, portrait ? 22 : 42) : [];

  const capHtml: string[] = [];
  const js: string[] = [];
  pages.forEach((page, pi) => {
    const start = I + page[0].start;
    const nextStart = pages[pi + 1] ? I + pages[pi + 1][0].start : Infinity;
    const end = Math.min(nextStart, I + page[page.length - 1].end + 0.6, total);
    const dur = Math.max(0.15, end - start);
    capHtml.push(
      `<div class="clip cap" id="p${pi}" data-start="${r3(start)}" data-duration="${r3(dur)}" data-track-index="2"><div class="line">` +
        page
          .map((w, wi) => `<span class="w" id="p${pi}w${wi}"><span class="a">${esc(w.text)}</span>${esc(w.text)}</span>`)
          .join('') +
        `</div></div>`
    );
    js.push(`tl.fromTo('#p${pi} .line',{scale:0.86,opacity:0},{scale:1,opacity:1,duration:0.14,ease:'back.out(2.2)'},${r3(start)});`);
    page.forEach((w, wi) => {
      const ws = r3(I + w.start);
      const we = r3(Math.min(end, I + w.end));
      const sel = `#p${pi}w${wi}`;
      if (captionStyle === 'karaoke') {
        js.push(`tl.fromTo('${sel} .a',{opacity:0},{opacity:1,duration:0.05},${ws});`);
        js.push(`tl.fromTo('${sel}',{scale:1},{scale:1.04,y:-6,duration:0.08,ease:'power2.out'},${ws});`);
        js.push(`tl.to('${sel}',{scale:1,y:0,duration:0.08},${we});`);
        js.push(`tl.to('${sel} .a',{opacity:0,duration:0.05},${we});`);
      } else if (captionStyle === 'pop') {
        js.push(`tl.fromTo('${sel}',{opacity:0,y:${Math.round(fs * 0.35)},scale:0.7},{opacity:1,y:0,scale:1,duration:0.12,ease:'back.out(3)'},${ws});`);
        js.push(`tl.fromTo('${sel} .a',{opacity:1},{opacity:0,duration:0.2},${r3(Math.min(end, I + w.end + 0.15))});`);
      }
    });
  });

  const hookEnd = Math.min(3.5, clipDuration);
  const hook =
    o.hookTitle && o.title
      ? `<div class="clip hook" id="hook" data-start="${r3(I)}" data-duration="${r3(hookEnd)}" data-track-index="3"><div class="hookbox">${esc(o.title)}</div></div>`
      : '';
  if (hook) {
    js.push(`tl.fromTo('#hook .hookbox',{y:-40,opacity:0,scale:0.9},{y:0,opacity:1,scale:1,duration:0.35,ease:'back.out(1.8)'},${r3(I)});`);
    js.push(`tl.to('#hook .hookbox',{opacity:0,y:-20,duration:0.3},${r3(I + hookEnd - 0.3)});`);
  }

  const intro =
    I > 0
      ? `<div class="clip intro" id="intro" data-start="0" data-duration="${r3(I)}" data-track-index="1">` +
        (o.hasIntroBg ? `<img class="introbg" src="intro_bg.jpg" alt="">` : '') +
        `<div class="introshade"></div><div class="introtitle">${esc(o.title)}</div><div class="introbar"></div></div>`
      : '';
  if (intro) {
    js.push(`tl.fromTo('#intro .introtitle',{y:60,opacity:0},{y:0,opacity:1,duration:0.5,ease:'power3.out'},0.1);`);
    js.push(`tl.fromTo('#intro .introbar',{scaleX:0},{scaleX:1,duration:${r3(Math.max(0.5, I - 0.3))},ease:'none'},0.2);`);
    if (o.hasIntroBg) js.push(`tl.fromTo('#intro .introbg',{scale:1.15},{scale:1.0,duration:${r3(I)},ease:'none'},0);`);
    js.push(`tl.to('#intro',{opacity:0,duration:0.25},${r3(Math.max(0, I - 0.25))});`);
  }
  js.push(`tl.set({}, {}, ${total});`);

  const capBottom = portrait ? Math.round(H * 0.24) : Math.round(H * 0.09);
  return `<!doctype html>
<html><head><meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;background:#000;overflow:hidden}
  #root{position:relative;width:${W}px;height:${H}px;overflow:hidden;background:#000;font-family:"Arial Black","Segoe UI",Arial,Helvetica,sans-serif}
  .clip{position:absolute;inset:0}
  #footage{width:100%;height:100%;object-fit:cover}
  .cap{display:flex;align-items:flex-end;justify-content:center;bottom:${capBottom}px;top:auto;left:${Math.round(W * 0.06)}px;right:${Math.round(W * 0.06)}px;z-index:5}
  .line{text-align:center;font-size:${fs}px;font-weight:900;line-height:1.15;color:#fff;text-transform:${captionStyle === 'clean' ? 'none' : 'uppercase'};
        letter-spacing:-0.01em;-webkit-text-stroke:${Math.max(2, Math.round(fs * 0.07))}px #000;paint-order:stroke fill;
        text-shadow:0 ${Math.round(fs * 0.06)}px ${Math.round(fs * 0.18)}px rgba(0,0,0,.65)}
  .w{position:relative;display:inline-block;margin:0 0.24em;transform-origin:50% 70%}
  .w .a{position:absolute;left:0;top:0;color:${accent};opacity:${captionStyle === 'highlight' ? 1 : 0}}
  .hook{display:flex;justify-content:center;align-items:flex-start;top:${portrait ? Math.round(H * 0.11) : Math.round(H * 0.06)}px;z-index:6}
  .hookbox{max-width:84%;background:#fff;color:#000;border-radius:${Math.round(fs * 0.3)}px;padding:${Math.round(fs * 0.28)}px ${Math.round(fs * 0.45)}px;
           font-size:${Math.round(fs * 0.62)}px;font-weight:900;line-height:1.2;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.45);border-bottom:${Math.round(fs * 0.12)}px solid ${BRAND.mint}}
  .intro{background:#000;z-index:8;display:flex;align-items:center;justify-content:center}
  .introbg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:blur(28px) brightness(.45)}
  .introshade{position:absolute;inset:0;background:linear-gradient(160deg,${BRAND.lavender}33,transparent 45%,${BRAND.pink}33)}
  .introtitle{position:relative;max-width:82%;color:#fff;font-size:${Math.round(fs * 1.05)}px;font-weight:900;line-height:1.1;text-align:center}
  .introbar{position:absolute;left:12%;right:12%;bottom:${Math.round(H * 0.18)}px;height:${Math.max(6, Math.round(H * 0.006))}px;border-radius:99px;
            background:linear-gradient(90deg,${BRAND.mint},${BRAND.lavender},${BRAND.pink},${BRAND.peach});transform-origin:0 50%}
</style></head>
<body>
<div id="root" data-composition-id="root" data-start="0" data-duration="${total}" data-width="${W}" data-height="${H}" data-fps="30">
  <video id="footage" class="clip" src="base.mp4" data-start="${r3(I)}" data-duration="${r3(clipDuration)}" data-track-index="0" muted playsinline></video>
  ${intro}
  ${hook}
  ${capHtml.join('\n  ')}
</div>
<script src="gsap.min.js"></script>
<script>
  const tl = gsap.timeline({ paused: true });
  ${js.join('\n  ')}
  window.__timelines = window.__timelines || {};
  window.__timelines["root"] = tl;
</script>
</body></html>`;
}

/** Render a prepared composition directory (index.html + base.mp4 [+ intro_bg.jpg]) to MP4 (video only). */
export async function renderComposition(dir: string, html: string, outMp4: string): Promise<void> {
  fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf-8');
  if (!fs.existsSync(GSAP_JS)) throw new Error('GSAP is missing (run npm install).');
  fs.copyFileSync(GSAP_JS, path.join(dir, 'gsap.min.js'));
  const quality = process.env.HYPERFRAMES_QUALITY || 'high';
  await hf(['render', dir, '-o', outMp4, '--fps', '30', '--quality', quality, '--quiet'], { cwd: dir, timeout: 1000 * 60 * 60 });
  if (!fs.existsSync(outMp4)) throw new Error('HyperFrames render produced no file.');
}

export function frameSize(aspectRatio: AspectRatio, srcWidth: number): [number, number] {
  const even = (n: number) => Math.max(2, Math.floor(n / 2) * 2);
  if (aspectRatio === '9:16') return [1080, 1920];
  if (aspectRatio === '1:1') return [1080, 1080];
  const w = even(Math.max(srcWidth, 1920));
  return [w, even((w * 9) / 16)];
}
