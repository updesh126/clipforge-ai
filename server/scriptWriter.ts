/**
 * Script Writer: YouTube link → the video's words → every fact kept → a new, more hooked script in ClipForge's
 * scene format with [tags] → YouTube title, description and tags → saved as .md and .txt in data/scripts/.
 *
 * Words come from the video's subtitles (manual first, then automatic) via yt-dlp; with no subtitles the audio
 * is downloaded and transcribed with Whisper. Everything runs locally (Ollama), unless you pick a cloud model.
 */
import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { DATA_DIR, TEMP_DIR } from './store.ts';
import type { ProgressFn } from './progress.ts';
import { resolveYtDlpCommand } from './youtube.ts';
import { transcribeLocal } from './ai.ts';
import { SD_URL } from './imagegen.ts';
import { parseTag, scenesWithDirectives, tokeniseScript } from './directives.ts';
import { autoSequences } from './autoSequences.ts';
import { accentTag, autoAccents } from './autoAccents.ts';
import { storyboard as scenePlan, type Storyboard } from './storyboard.ts';
import { splitScenes } from './scriptVideo.ts';
import { VIDEO_TYPES, isVideoType, type VideoType } from '../src/videotypes.ts';

const execFileAsync = promisify(execFile);
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
export const WRITER_MODEL = process.env.WRITER_MODEL || process.env.OLLAMA_EDIT_MODEL || process.env.OLLAMA_MODEL || 'qwen2.5:3b';
export const SCRIPTS_DIR = path.join(DATA_DIR, 'scripts');

export interface WriterOptions {
  url: string;
  videoType?: VideoType;
  /** target length of the new video in minutes (default: like the source, 1–5) */
  minutes?: number;
  /** language of the new script: 'same' as the video, or 'en' / 'hi' */
  language?: 'same' | 'en' | 'hi';
  model?: string;
}

export interface WriterResult {
  id: string;
  createdAt: string;
  model: string;
  videoType: VideoType;
  source: { url: string; title: string; channel: string; seconds: number; words: number; from: 'subtitles' | 'whisper' };
  title: string;
  hook: string;
  description: string;
  tags: string[];
  script: string;
  facts: string[];
  files: { md: string; txt: string };
  /** scene-by-scene plan: what every line will show and do in the video (made right after writing) */
  board?: Storyboard;
}

// ---------------------------------------------------------------- 1. the video's words

interface YtInfo {
  title?: string;
  uploader?: string;
  channel?: string;
  duration?: number;
  language?: string;
  description?: string;
}

/** WebVTT → plain text, without the repeated lines auto-captions roll through. */
export function vttToText(vtt: string): string {
  const lines: string[] = [];
  for (const raw of vtt.split(/\r?\n/)) {
    const l = raw.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
    if (!l || /^WEBVTT|^Kind:|^Language:|^NOTE|-->|^\d+$/.test(l)) continue;
    if (lines[lines.length - 1] === l) continue;
    lines.push(l);
  }
  // auto-captions repeat the end of the previous line at the start of the next — drop the overlap
  const out: string[] = [];
  for (const l of lines) {
    const prev = out[out.length - 1] ?? '';
    if (prev && l.startsWith(prev)) out[out.length - 1] = l;
    else if (!prev.endsWith(l)) out.push(l);
  }
  return out.join(' ').replace(/\[(music|applause|laughter)\]/gi, ' ').replace(/\s{2,}/g, ' ').trim();
}

async function fetchWords(url: string, workDir: string, progress: ProgressFn): Promise<{ info: YtInfo; text: string; from: 'subtitles' | 'whisper' }> {
  const ytdlp = await resolveYtDlpCommand();
  progress('fetch', 'Reading the video details', 3);
  const { stdout } = await execFileAsync(ytdlp, ['--no-playlist', '--dump-single-json', '--skip-download', url], { maxBuffer: 64 * 1024 * 1024, timeout: 120_000 });
  const info = JSON.parse(stdout) as YtInfo;
  progress('fetch', `Getting the words of “${(info.title ?? 'the video').slice(0, 60)}”`, 8);
  const base = path.join(workDir, 'subs');
  try {
    await execFileAsync(ytdlp, ['--no-playlist', '--skip-download', '--write-subs', '--write-auto-subs', '--sub-langs', `${info.language ?? 'en'}.*,${info.language ?? 'en'},en.*,en,hi`, '--sub-format', 'vtt', '-o', `${base}.%(ext)s`, url], { timeout: 180_000 });
  } catch {
    /* no subtitles — fall back to Whisper */
  }
  const vtts = fs.readdirSync(workDir).filter((f) => f.startsWith('subs') && f.endsWith('.vtt'));
  // prefer the video's own language, manual over automatic (auto files carry no "-orig" marker reliably, so take the longest)
  const pick = vtts
    .map((f) => ({ f, text: vttToText(fs.readFileSync(path.join(workDir, f), 'utf8')) }))
    .sort((a, b) => Number(b.f.includes(`.${info.language ?? 'en'}`)) - Number(a.f.includes(`.${info.language ?? 'en'}`)) || b.text.length - a.text.length)[0];
  if (pick && pick.text.split(/\s+/).length > 40) return { info, text: pick.text, from: 'subtitles' };

  progress('fetch', 'No subtitles — downloading the audio for Whisper', 12);
  await execFileAsync(ytdlp, ['--no-playlist', '-f', 'bestaudio/best', '-x', '--audio-format', 'm4a', '-o', path.join(workDir, 'audio.%(ext)s'), url], { timeout: 30 * 60_000 });
  const audio = fs.readdirSync(workDir).find((f) => f.startsWith('audio.'));
  if (!audio) throw new Error('Could not download the audio of this video.');
  progress('fetch', 'Transcribing with Whisper (a few minutes for long videos)', 18);
  const segs = await transcribeLocal(path.join(workDir, audio), `writer_${path.basename(workDir)}`);
  return { info, text: segs.map((s) => s.text).join(' ').replace(/\s{2,}/g, ' ').trim(), from: 'whisper' };
}

// ---------------------------------------------------------------- 2. the AI

/** One context size for every call: Ollama reloads the model whenever num_ctx changes. */
const WRITER_CTX = 16384;

async function ask<T>(model: string, prompt: string, ctx = WRITER_CTX): Promise<T> {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, format: 'json', stream: false, ...(/qwen3|deepseek-r1|gpt-oss|magistral/i.test(model) ? { think: false } : {}), keep_alive: '15m', options: { temperature: 0.6, num_ctx: ctx } }),
    signal: AbortSignal.timeout(15 * 60_000),
  });
  if (!res.ok) throw new Error(`Ollama (${model}) answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { response: string };
  return JSON.parse(body.response) as T;
}

const chunk = (text: string, size: number): string[] => {
  const out: string[] = [];
  let rest = text;
  while (rest.length > size) {
    const cut = Math.max(rest.lastIndexOf('. ', size), rest.lastIndexOf(' ', size));
    out.push(rest.slice(0, cut > size * 0.5 ? cut + 1 : size));
    rest = rest.slice(cut > size * 0.5 ? cut + 1 : size);
  }
  if (rest.trim()) out.push(rest);
  return out;
};

/** Tags the writer model may use — the most useful ones, with their meaning. */
/** The source channel's own promotion — never carried into the new script. */
const PROMO = /\b(subscribe|follow (us|the channel|me)|like and share|hit the bell|log on to|visit (our|my)|www\.|https?:|\.com\b|link in the description|sponsor(ed)?|this video is (from|brought)|the video is from|our channel|patreon|merch)/i;

/** Stage directions written as narration ("Map of India highlights…", "Cut to…") — never spoken. */
const STAGE = /^(map of|cut to|close-up|close up|wide shot|scene \d|visual:|on screen|on-screen|b-roll|graphic:|text on screen|camera |footage of|shot of)/i;

/** Catalogue ids the model sometimes writes as plain words ("timelineHistory events='…'") — they must never be spoken. */
const BARE_TAG = /\s*\b(?:[a-z]+[A-Z][A-Za-z]*)\b(?:\s+[A-Za-z]+\s*=\s*(?:"[^"]*"|'[^']*'|\S+))+/g;

/**
 * Add [tags] to the written paragraphs with ClipForge's own rules (small models place them unreliably):
 * the hook gets a word reveal, years/steps/before-after/quotes get their explainer, big numbers a stat, the end a pull-out.
 */
function tagParagraphs(paragraphs: string[], vtype: VideoType, board: Array<{ place?: string; scene?: string }> = []): string[] {
  const allowed = VIDEO_TYPES[vtype].sequences;
  const factual = vtype !== 'story';
  const auto = autoSequences(paragraphs, allowed);
  // full-screen explainers: at most one in every two paragraphs (stories: only quotes), never two in a row
  const seqAt: boolean[] = [];
  let lastSeq = -9;
  let stats = 0;
  const seqTags = paragraphs.map((p, i) => {
    if (i === 0 || i - lastSeq < 2) return null; // the hook carries the title
    const a = auto[i];
    if (a && (factual || a.id === 'quoteStatement')) {
      lastSeq = i;
      seqAt[i] = true;
      return accentTag(a);
    }
    const m = p.match(/\b(\d[\d,]*(?:\.\d+)?)\s*(%|percent|million|billion|crore|lakh|thousand)/i);
    if (m && allowed.includes('bigStat') && stats < 3) {
      const suffix = m[2] === '%' || /percent/i.test(m[2]) ? '%' : ` ${m[2].toLowerCase()}`;
      lastSeq = i;
      seqAt[i] = true;
      stats++;
      return `[bigStat value=${m[1].replace(/,/g, '')} suffix="${suffix}"]`;
    }
    return null;
  });
  // small accents on the picture (then/now, name, stamp, stickers, marker, handwritten turn) between explainers
  const accents = autoAccents(paragraphs, vtype, VIDEO_TYPES[vtype].styles[0], seqAt);
  const cams = vtype === 'story' ? ['pushIn', 'panRight', 'pullOut', 'panLeft', 'tiltUp'] : ['pushIn', 'panRight', 'panLeft', 'tiltUp'];
  const cut = vtype === 'documentary' ? 'paperTearTransition' : vtype === 'tech' ? 'wipeTransition' : vtype === 'fun' ? 'whipPan' : 'irisWipe';
  let place = '';
  return paragraphs.map((p, i) => {
    const tags: string[] = [];
    const b = board[i] ?? {};
    // what we see: the setting when it changes (it carries on), and the exact picture for this line
    const where = (b.place ?? '').trim();
    if (where && where.toLowerCase() !== place.toLowerCase()) {
      tags.push(`[place: ${where}]`);
      place = where;
    }
    if (b.scene?.trim()) tags.push(`[scene: ${b.scene.trim()}]`);
    if (i === 0) {
      tags.push(factual ? '[wordReveal]' : '[pushIn]');
      if (vtype === 'documentary') tags.push('[filmGrain]');
    }
    if (seqTags[i]) tags.push(seqTags[i]!);
    else if (accents[i]) tags.push(accentTag(accents[i]!));
    // camera: vary the move; the last line pulls out
    if (i === paragraphs.length - 1 && i > 0) tags.push('[pullOut]');
    else if (i > 0 && !seqTags[i]) tags.push(`[${cams[i % cams.length]}]`);
    // a chapter break every fourth paragraph
    if (i > 0 && i % 4 === 0 && i < paragraphs.length - 1) tags.push(`[transition: ${cut}]`);
    return tags.length ? `${p} ${tags.join(' ')}` : p;
  });
}

/** Where and what we see for each paragraph — a short storyboard so every painting matches its line. */
async function storyboard(model: string, paragraphs: string[], vtype: VideoType): Promise<Array<{ place?: string; scene?: string }>> {
  type Shot = { i?: number; place?: string; scene?: string; picture?: string; visual?: string; setting?: string };
  const raw = await ask<unknown>(
    model,
    `You are a storyboard artist for a ${VIDEO_TYPES[vtype].label.toLowerCase()} video. For EACH numbered line, decide what the viewer SEES.
- "place": the real setting in 2-6 words (e.g. "busy market street in Mumbai", "bank server room", "farm field in Punjab"). Keep the same place for lines that happen there.
- "scene": ONE concrete picture for that exact line in 10-20 words: the real subject, objects and action it talks about (e.g. "a vegetable seller holding up a phone next to a printed QR code"). Never a generic landscape; no text, logos or brand names in the picture.
Write place and scene in English.
Reply as JSON: {"scenes":[{"i":0,"place":"…","scene":"…"}]} — one entry per line, in order.

LINES:
${paragraphs.map((p, i) => `${i}: ${p}`).join('\n')}`,
  ).catch((err) => {
    console.warn('[clipforge] writer storyboard failed:', err instanceof Error ? err.message : err);
    return null;
  });
  // small models vary the shape: {"scenes":[…]}, a bare array, {"storyboard":[…]} or {"0":{…},"1":{…}}
  const list: Shot[] = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object'
      ? ((Object.values(raw).find((v) => Array.isArray(v)) as Shot[] | undefined) ?? (Object.values(raw).filter((v) => v && typeof v === 'object') as Shot[]))
      : [];
  if (!list.length) console.warn('[clipforge] writer storyboard: no scenes in', JSON.stringify(raw)?.slice(0, 200));
  const clip = (s: unknown, n: number) => (typeof s === 'string' ? s.replace(/[[\]]/g, '').replace(/\s+/g, ' ').trim().slice(0, n) : '');
  return paragraphs.map((_, i) => {
    const e = list.find((x) => Number(x?.i) === i) ?? list[i];
    return { place: clip(e?.place ?? e?.setting, 60), scene: clip(e?.scene ?? e?.picture ?? e?.visual, 200) };
  });
}

const TAG_GUIDE = `[bigStat] for a big number · [timelineHistory events="YEAR|event; YEAR|event"] for dates · [processExplain steps="a; b; c"] for steps · [comparison title="…" labelA=… valueA=… labelB=… valueB=…] for before/after numbers · [quoteStatement text="…" source="…"] for a quotation · [questionReveal text="…?" answer="…"] for a question · [mythVsFact textA="myth" textB="fact"] for a myth · [mapInvestigation country="…" city="…" note="…"] for a place · [markerHighlight] to stress a key line · [wordReveal] for a punchy opening line · [pushIn] [zoomPunch] [shake] camera · [transition: irisWipe] [transition: paperTearTransition] between parts · [rainFx] [snowFx] [fireflyGlow] [embers] [confetti] [lightRays] atmosphere · [title: …] scene title`;

// ---------------------------------------------------------------- 3. write

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9ऀ-ॿ]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'script';

export async function writeScriptFromYoutube(opts: WriterOptions, progress: ProgressFn): Promise<WriterResult> {
  const model = opts.model || WRITER_MODEL;
  const vtype: VideoType = isVideoType(opts.videoType) ? opts.videoType : 'story';
  const id = `${new Date().toISOString().slice(0, 10)}-${crypto.randomBytes(3).toString('hex')}`;
  const workDir = path.join(TEMP_DIR, `writer_${id}`);
  fs.mkdirSync(workDir, { recursive: true });
  try {
    const tRead = Date.now();
    const { info, text, from } = await fetchWords(opts.url, workDir, progress);
    const readSeconds = Math.round((Date.now() - tRead) / 1000);
    const words = text.split(/\s+/).length;
    if (words < 30) throw new Error('This video has almost no spoken words to work from.');
    const minutes = Math.max(0.5, Math.min(10, opts.minutes || Math.min(5, Math.max(1, Math.round((info.duration ?? 120) / 60)))));
    const targetWords = Math.round(minutes * 150);
    const lang = opts.language === 'hi' ? 'Hindi (Devanagari script)' : opts.language === 'en' ? 'English' : 'the same language as the transcript';

    // the writing model shares the GPU with ComfyUI: free ComfyUI's memory when it is idle, warn when it is painting
    await makeRoomOnGpu(progress);
    const t0 = Date.now();
    const timing: string[] = [`reading ${readSeconds} s`];
    let tStep = t0;
    const lap = (name: string) => {
      timing.push(`${name} ${Math.round((Date.now() - tStep) / 1000)} s`);
      tStep = Date.now();
    };

    // facts first, in chunks, so nothing from a long video is lost
    const parts = chunk(text, 7000);
    const facts: string[] = [];
    for (const [i, p] of parts.entries()) {
      progress('facts', `Collecting every fact (${i + 1} of ${parts.length})`, 25 + (35 * i) / parts.length);
      const r = await ask<{ facts?: string[] }>(
        model,
        `List EVERY fact in this part of a video transcript: names, places, numbers, dates, quotes, steps, claims, examples and conclusions. One short sentence per fact, in the transcript's language. Keep numbers and names exactly as said. Do not add anything that is not said.
Reply as JSON: {"facts": ["…", "…"]}

TRANSCRIPT PART ${i + 1}/${parts.length}:
${p}`,
      );
      for (const f of r.facts ?? []) if (typeof f === 'string' && f.trim() && !facts.includes(f.trim()) && !PROMO.test(f)) facts.push(f.trim());
    }
    if (!facts.length) throw new Error('The AI could not pull facts from this transcript — try a bigger model.');

    lap('facts');
    progress('write', `Writing a new ${VIDEO_TYPES[vtype].label.toLowerCase()} script (~${targetWords} words) with ${model}`, 65);
    const vt = VIDEO_TYPES[vtype];
    const draft = await ask<{ hook?: string; paragraphs?: string[] }>(
      model,
      `You are a top YouTube scriptwriter. Rewrite the facts below into a NEW, original ${vt.label.toLowerCase()} script — different wording and structure from the source, more hooked and engaging, but keeping EVERY important fact, number and name exactly. ${vt.plannerHint}
Write in ${lang}.

Rules for the script:
- Start with a HOOK paragraph: a surprising fact, question or promise that makes people stay (no "Hello guys", no channel talk).
- Then one paragraph per scene, 1–2 sentences each (20–35 words), about ${targetWords} words in total. Each paragraph says where we are and what we see.
- Build tension: setup → surprising turn → payoff; end with a strong last line.
- Name people the same way every time.
- Plain narration only: no brackets, no stage directions, no effect names.
- Write every number in digits exactly as in the facts (249, 3.5 billion, 2016) — never spell numbers out or change them.
- Never mention the source channel, its sponsors, links or "follow us / subscribe".

Reply as JSON: {"hook":"…","paragraphs":["…","…"]}

SOURCE VIDEO: ${info.title ?? ''} — ${info.uploader ?? info.channel ?? ''}
FACTS:
${facts.map((f) => `- ${f}`).join('\n')}`,
    );
    // clean narration: no stray effect names, no source-channel promotion
    // small models sometimes send one string, or objects like {"text": "…"} — accept all
    const rawParas: unknown = draft.paragraphs ?? (draft as Record<string, unknown>).script ?? [];
    const paraList = (Array.isArray(rawParas) ? rawParas : String(rawParas).split(/\n\s*\n|\n/))
      .map((p) => (p && typeof p === 'object' ? Object.values(p as Record<string, unknown>).find((v) => typeof v === 'string') ?? '' : p));
    const paragraphs = paraList
      .map((p) => String(p).replace(/\[[^[\]\n]*\]/g, ' ').replace(BARE_TAG, '').replace(/\s{2,}/g, ' ').replace(/ +([.,!?])/g, '$1').trim())
      .filter((p) => p && !PROMO.test(p) && !STAGE.test(p));
    if (!paragraphs.length) throw new Error('The AI returned no script — try again or pick a bigger model.');
    const hook = String(draft.hook ?? '').trim();
    const story = hook && !paragraphs[0].startsWith(hook.slice(0, 30)) ? [hook.replace(BARE_TAG, '').trim(), ...paragraphs] : paragraphs;
    lap('script');
    progress('write', 'Storyboarding a place and a picture for every paragraph', 78);
    const board = await storyboard(model, story, vtype);
    const body = tagParagraphs(story, vtype, board).join('\n\n');
    lap('storyboard');

    // YouTube packaging as its own step (asked together with the script, small models drop these fields)
    progress('write', 'Writing the YouTube title, description and tags', 85);
    const pack = await ask<{ title?: string; description?: string; tags?: string[] }>(
      model,
      `Write YouTube packaging for this video script, in ${lang}.
- "title": under 70 characters, makes people click, honest to the content, no clickbait lies
- Use ONLY numbers, names and claims that appear in the SCRIPT below — never invent a figure (no "1 trillion" if the script does not say it)
- "description": 2 hooky opening lines, then 3–5 bullet points ("• …") of what viewers will learn, then one line asking them to subscribe — 120–200 words. Do not mention any other channel or website.
- "tags": 12–18 YouTube search tags (keywords and short phrases people search, no #)
Reply as JSON: {"title":"…","description":"…","tags":["…"]}

SCRIPT:
${story.join('\n\n')}`,
    ).catch(() => ({}) as { title?: string; description?: string; tags?: string[] });
    const draftTitle = pack.title;

    // keep only tags ClipForge understands; report the rest
    progress('check', 'Checking tags against the effect catalogue', 92);
    const dropped: string[] = [];
    const script = body.replace(/\[([^[\]\n]{1,600})\]/g, (whole, inner: string) => {
      if (parseTag(inner)) return whole;
      dropped.push(inner);
      return '';
    }).replace(/[ \t]{2,}/g, ' ').replace(/ +([.,!?])/g, '$1');
    const { script: tok, tags: tagBodies } = tokeniseScript(script);
    const sceneCount = scenesWithDirectives(splitScenes(tok), tagBodies).length;

    const result: WriterResult = {
      id,
      createdAt: new Date().toISOString(),
      model,
      videoType: vtype,
      source: { url: opts.url, title: info.title ?? '', channel: info.uploader ?? info.channel ?? '', seconds: Math.round(info.duration ?? 0), words, from },
      title: String(draftTitle || info.title || 'Untitled').trim().slice(0, 100),
      hook,
      // never empty: fall back to the hook + the main facts, and keywords from the title
      description: String(pack.description ?? '').trim() || `${story[0]}\n\nIn this video:\n${facts.slice(0, 5).map((f) => `• ${f}`).join('\n')}\n\nSubscribe for more.`,
      tags: (() => {
        const t = [...new Set((pack.tags ?? []).map((x) => String(x).replace(/^#/, '').trim()).filter(Boolean))].slice(0, 25);
        return t.length ? t : [...new Set(String(draftTitle || info.title || '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 3))].slice(0, 15);
      })(),
      script,
      facts,
      files: { md: '', txt: '' },
    };
    lap('title, description & tags');
    // every line as a task: what we see, where, on screen, camera, Motion — the same planner as Script → video
    progress('plan', 'Planning every scene: what we see, where, what is on screen', 90);
    result.board = await scenePlan({ script, videoType: vtype, mode: 'story', illustration: 'ai', style: VIDEO_TYPES[vtype].styles[0], animate: true, motionMode: 'mix', aspect: '16:9' }).catch((err) => {
      console.warn('[clipforge] writer scene plan failed:', err instanceof Error ? err.message : err);
      return undefined;
    });
    lap('scene plan');
    progress('save', `Saving (${sceneCount} scenes${dropped.length ? `, ${dropped.length} unknown tag(s) removed` : ''})`, 96);
    saveResult(result, text);
    progress('done', `Script ready in ${Math.round((Date.now() - tRead) / 1000)} s (${timing.join(', ')})`, 100);
    console.log(`[clipforge] writer: ${timing.join(', ')} · ${parts.length} part(s), ${words} words, ${model}`);
    return result;
  } finally {
    fs.rm(workDir, { recursive: true, force: true }, () => {});
  }
}

// ---------------------------------------------------------------- 4. save

function saveResult(r: WriterResult, transcript: string) {
  fs.mkdirSync(SCRIPTS_DIR, { recursive: true });
  const base = path.join(SCRIPTS_DIR, `${r.id}-${slug(r.title)}`);
  const minutes = `${Math.floor(r.source.seconds / 60)}:${String(r.source.seconds % 60).padStart(2, '0')}`;
  const md = `# ${r.title}

*Written ${r.createdAt.slice(0, 16).replace('T', ' ')} by ClipForge Script Writer (${r.model}) · ${VIDEO_TYPES[r.videoType].label}*
*Source: [${r.source.title}](${r.source.url}) — ${r.source.channel} · ${minutes} · ${r.source.words} words from ${r.source.from}*

## YouTube title

${r.title}

## YouTube description

${r.description}

## YouTube tags

${r.tags.join(', ')}

## Script

${r.script}

${r.board ? `## Scene plan (${r.board.scenes.length} scenes, about ${r.board.totalSeconds} s)

${boardMarkdown(r.board)}
` : ''}## Facts kept from the source (${r.facts.length})

${r.facts.map((f) => `- ${f}`).join('\n')}

## Original transcript

${transcript}
`;
  const txt = `TITLE
${r.title}

DESCRIPTION
${r.description}

TAGS
${r.tags.join(', ')}

SCRIPT
${r.script}

${r.board ? `SCENE PLAN (${r.board.scenes.length} scenes, about ${r.board.totalSeconds} s)
${boardText(r.board)}
` : ''}FACTS KEPT (${r.facts.length})
${r.facts.map((f) => `- ${f}`).join('\n')}

SOURCE
${r.source.title} — ${r.source.channel}
${r.source.url}

ORIGINAL TRANSCRIPT
${transcript}
`;
  fs.writeFileSync(`${base}.md`, md);
  fs.writeFileSync(`${base}.txt`, txt);
  fs.writeFileSync(`${base}.json`, JSON.stringify(r, null, 2));
  r.files = { md: `${path.basename(base)}.md`, txt: `${path.basename(base)}.txt` };
  fs.writeFileSync(`${base}.json`, JSON.stringify(r, null, 2));
}

/** Save edits made on the Writer page back into the .md / .txt / .json (the original transcript is kept). */
export function updateScript(id: string, patch: Partial<Pick<WriterResult, 'title' | 'description' | 'tags' | 'script'>>): WriterResult | null {
  const old = listScripts().find((s) => s.id === id);
  if (!old) return null;
  const oldMd = path.join(SCRIPTS_DIR, old.files.md);
  const transcript = fs.existsSync(oldMd) ? (fs.readFileSync(oldMd, 'utf8').split('## Original transcript\n\n')[1] ?? '').trim() : '';
  const next: WriterResult = {
    ...old,
    title: String(patch.title ?? old.title).trim().slice(0, 100) || old.title,
    description: String(patch.description ?? old.description).trim(),
    tags: Array.isArray(patch.tags) ? [...new Set(patch.tags.map((t) => String(t).replace(/^#/, '').trim()).filter(Boolean))].slice(0, 25) : old.tags,
    script: String(patch.script ?? old.script).trim(),
  };
  // the file name follows the title — remove the old set first
  for (const f of [old.files.md, old.files.txt, old.files.md.replace(/\.md$/, '.json')]) fs.rmSync(path.join(SCRIPTS_DIR, f), { force: true });
  saveResult(next, transcript);
  return next;
}

/**
 * ComfyUI keeps its painting model in GPU memory; with it loaded, the writing model spills onto the CPU and runs
 * 5-20x slower. Free it when ComfyUI is idle (it reloads on its next painting); if it is busy, just say so.
 */
async function makeRoomOnGpu(progress: ProgressFn) {
  try {
    const q = (await (await fetch(`${SD_URL}/queue`, { signal: AbortSignal.timeout(2000) })).json()) as { queue_running?: unknown[]; queue_pending?: unknown[] };
    if ((q.queue_running?.length ?? 0) + (q.queue_pending?.length ?? 0) > 0) {
      progress('facts', 'The GPU is busy painting a video — writing will be slower until it finishes', 22);
      return;
    }
    await fetch(`${SD_URL}/free`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ unload_models: true, free_memory: true }), signal: AbortSignal.timeout(5000) });
  } catch {
    // ComfyUI not running — the GPU is already free for Ollama
  }
}

/** The scene plan as Markdown: each line as a task. */
function boardMarkdown(b: Storyboard): string {
  return b.scenes
    .map((s) =>
      [
        `### Scene ${s.i + 1} · ~${s.seconds} s${s.moving === true ? ' · moving clip' : s.moving === false ? ' · still painting' : ''}`,
        '',
        `> ${s.text}`,
        '',
        `- **We see:** ${s.picture}`,
        `- **Where / when:** ${s.place || '—'}${s.time ? `, ${s.time}` : ''}`,
        `- **Camera:** ${s.camera.what || s.camera.label}`,
        s.explainer ? `- **Explainer:** ${s.explainer.label} — ${s.explainer.what}` : '',
        s.onScreen.length ? `- **On screen:** ${s.onScreen.map((o) => `${o.label} — ${o.what}`).join('; ')}` : '',
        s.transition ? `- **Opens with:** ${s.transition.label}` : '',
        s.atmosphere ? `- **Mood:** ${s.atmosphere.label}` : '',
        `- **What it does:** ${s.summary}`,
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n\n');
}

/** The scene plan as plain text. */
function boardText(b: Storyboard): string {
  return b.scenes
    .map((s) =>
      [
        `Scene ${s.i + 1} (~${s.seconds} s${s.moving === true ? ', moving clip' : s.moving === false ? ', still painting' : ''})`,
        `  Line: ${s.text}`,
        `  We see: ${s.picture}`,
        `  Where / when: ${s.place || '-'}${s.time ? `, ${s.time}` : ''}`,
        `  Camera: ${s.camera.what || s.camera.label}`,
        s.explainer ? `  Explainer: ${s.explainer.label} - ${s.explainer.what}` : '',
        s.onScreen.length ? `  On screen: ${s.onScreen.map((o) => o.label).join(', ')}` : '',
        s.transition ? `  Opens with: ${s.transition.label}` : '',
        s.atmosphere ? `  Mood: ${s.atmosphere.label}` : '',
        `  What it does: ${s.summary}`,
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n\n');
}

/** Delete saved scripts (their .md, .txt and .json). Returns how many were removed. */
export function deleteScripts(ids: string[]): number {
  const want = new Set(ids);
  let n = 0;
  for (const s of listScripts()) {
    if (!want.has(s.id)) continue;
    for (const f of [s.files.md, s.files.txt, s.files.md.replace(/\.md$/, '.json')]) fs.rmSync(path.join(SCRIPTS_DIR, path.basename(f)), { force: true });
    n++;
  }
  return n;
}

/** Saved scripts, newest first. */
export function listScripts(): WriterResult[] {
  if (!fs.existsSync(SCRIPTS_DIR)) return [];
  return fs
    .readdirSync(SCRIPTS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(SCRIPTS_DIR, f), 'utf8')) as WriterResult;
      } catch {
        return null;
      }
    })
    .filter((r): r is WriterResult => Boolean(r))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Local Ollama models for the Writer (cloud models flagged — they send the text online). */
export async function writerModels(): Promise<Array<{ name: string; cloud: boolean; sizeGb: number }>> {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(4000) });
    const d = (await r.json()) as { models?: Array<{ name: string; size?: number }> };
    return (d.models ?? []).map((m) => ({ name: m.name, cloud: /cloud/i.test(m.name) || !m.size, sizeGb: Math.round(((m.size ?? 0) / 1e9) * 10) / 10 }));
  } catch {
    return [];
  }
}
