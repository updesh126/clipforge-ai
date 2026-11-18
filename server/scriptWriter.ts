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
import { parseTag, scenesWithDirectives, tokeniseScript } from './directives.ts';
import { autoSequences } from './autoSequences.ts';
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

async function ask<T>(model: string, prompt: string, ctx = 16384): Promise<T> {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, format: 'json', stream: false, ...(/qwen3|deepseek-r1|gpt-oss|magistral/i.test(model) ? { think: false } : {}), options: { temperature: 0.6, num_ctx: ctx } }),
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

/** Catalogue ids the model sometimes writes as plain words ("timelineHistory events='…'") — they must never be spoken. */
const BARE_TAG = /\s*\b(?:[a-z]+[A-Z][A-Za-z]*)\b(?:\s+[A-Za-z]+\s*=\s*(?:"[^"]*"|'[^']*'|\S+))+/g;

/**
 * Add [tags] to the written paragraphs with ClipForge's own rules (small models place them unreliably):
 * the hook gets a word reveal, years/steps/before-after/quotes get their explainer, big numbers a stat, the end a pull-out.
 */
function tagParagraphs(paragraphs: string[], vtype: VideoType): string[] {
  const allowed = VIDEO_TYPES[vtype].sequences;
  const auto = autoSequences(paragraphs, allowed);
  const quoteVal = (v: string | number) => (typeof v === 'number' ? String(v) : `"${String(v).replace(/"/g, "'")}"`);
  let stats = 0;
  let tagged = 0;
  return paragraphs.map((p, i) => {
    const tags: string[] = [];
    if (i === 0) tags.push(vtype === 'story' ? '[pushIn]' : '[wordReveal]');
    const a = auto[i];
    if (a && tagged < 4) {
      tags.push(`[${a.id}${Object.entries(a.params).map(([k, v]) => ` ${k}=${quoteVal(v)}`).join('')}]`);
      tagged++;
    } else if (allowed.includes('bigStat') && stats < 2 && tagged < 4 && /\b\d[\d,.]*\s*(%|percent|million|billion|crore|lakh|thousand)/i.test(p)) {
      const m = p.match(/\b(\d[\d,]*(?:\.\d+)?)\s*(%|percent|million|billion|crore|lakh|thousand)/i)!;
      const suffix = m[2] === '%' || /percent/i.test(m[2]) ? '%' : ` ${m[2].toLowerCase()}`;
      tags.push(`[bigStat value=${m[1].replace(/,/g, '')} suffix="${suffix}"]`);
      stats++;
      tagged++;
    }
    if (i === paragraphs.length - 1 && i > 0) tags.push('[pullOut]');
    return tags.length ? `${p} ${tags.join(' ')}` : p;
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
    const { info, text, from } = await fetchWords(opts.url, workDir, progress);
    const words = text.split(/\s+/).length;
    if (words < 30) throw new Error('This video has almost no spoken words to work from.');
    const minutes = Math.max(0.5, Math.min(10, opts.minutes || Math.min(5, Math.max(1, Math.round((info.duration ?? 120) / 60)))));
    const targetWords = Math.round(minutes * 150);
    const lang = opts.language === 'hi' ? 'Hindi (Devanagari script)' : opts.language === 'en' ? 'English' : 'the same language as the transcript';

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
- Never mention the source channel, its sponsors, links or "follow us / subscribe".

Reply as JSON: {"hook":"…","paragraphs":["…","…"]}

SOURCE VIDEO: ${info.title ?? ''} — ${info.uploader ?? info.channel ?? ''}
FACTS:
${facts.map((f) => `- ${f}`).join('\n')}`,
      24576,
    );
    // clean narration: no stray effect names, no source-channel promotion
    // small models sometimes send one string, or objects like {"text": "…"} — accept all
    const rawParas: unknown = draft.paragraphs ?? (draft as Record<string, unknown>).script ?? [];
    const paraList = (Array.isArray(rawParas) ? rawParas : String(rawParas).split(/\n\s*\n|\n/))
      .map((p) => (p && typeof p === 'object' ? Object.values(p as Record<string, unknown>).find((v) => typeof v === 'string') ?? '' : p));
    const paragraphs = paraList
      .map((p) => String(p).replace(/\[[^[\]\n]*\]/g, ' ').replace(BARE_TAG, '').replace(/\s{2,}/g, ' ').replace(/ +([.,!?])/g, '$1').trim())
      .filter((p) => p && !PROMO.test(p));
    if (!paragraphs.length) throw new Error('The AI returned no script — try again or pick a bigger model.');
    const hook = String(draft.hook ?? '').trim();
    const story = hook && !paragraphs[0].startsWith(hook.slice(0, 30)) ? [hook.replace(BARE_TAG, '').trim(), ...paragraphs] : paragraphs;
    const body = tagParagraphs(story, vtype).join('\n\n');

    // YouTube packaging as its own step (asked together with the script, small models drop these fields)
    progress('write', 'Writing the YouTube title, description and tags', 85);
    const pack = await ask<{ title?: string; description?: string; tags?: string[] }>(
      model,
      `Write YouTube packaging for this video script, in ${lang}.
- "title": under 70 characters, makes people click, honest to the content, no clickbait lies
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
    progress('save', `Saving (${sceneCount} scenes${dropped.length ? `, ${dropped.length} unknown tag(s) removed` : ''})`, 96);
    saveResult(result, text);
    progress('done', 'Script ready', 100);
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

## Facts kept from the source (${r.facts.length})

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

FACTS KEPT (${r.facts.length})
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
