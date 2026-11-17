/**
 * Script → video. Turns a written script into a finished edit:
 *   1. split the script into scenes (deterministic — narration is always the user's exact words)
 *   2. local LLM (Ollama) picks a visual + on-screen text per scene and an art style (heuristic fallback)
 *   3. TTS voice-over per scene (Kokoro via HyperFrames, else the system voice)
 *   4. Whisper word timings on each voice clip → karaoke captions that match the voice
 *   5. build an EditProject (art backdrops, Vox graphics, captions, audio) for the Remotion editor
 */
import fs from 'node:fs';
import path from 'node:path';
import type { CaptionLook, EditItem, EditProject, EditWord } from '../src/editor/types.ts';
import { FRAME_SIZES } from '../src/editor/types.ts';
import { ART_STYLE_OPTIONS, TEMPLATES } from '../src/editor/catalog.ts';
import { audioDuration, speak } from './tts.ts';
import { transcribeLocal } from './ai.ts';
import { UPLOADS_DIR } from './store.ts';
import { blankEdit, newId, saveEdit } from './edits.ts';
import type { ProgressFn } from './progress.ts';
import { planStorySpecs } from './vector.ts';
import { animateImage, describeCharacter, generateImage, sdSize, sdStatus, stylisedScene, VIDEO_FPS, videoModel } from './imagegen.ts';
import { ensureComfy } from './comfy.ts';
import type { CharacterSpec } from '../src/vector/character.ts';
import type { EffectId } from '../src/editor/types.ts';
import { SEQUENCES } from '../src/motion/sequences.ts';
import { EFFECTS_LIB } from '../src/motion/catalog.ts';
import { ART_STYLE_SPECS, buildNegativePrompt, type StyleSpecId } from '../src/artstyles/prompt.ts';
import { EFFECTS } from '../src/editor/catalog.ts';
import { isTheme } from '../src/vector/theme.ts';
import { languageOf } from './tts.ts';
import { buildStoryScene, heuristicStory, llmStory, transitionAt, type StoryPlan } from './storyScenes.ts';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const PLAN_MODEL = process.env.OLLAMA_EDIT_MODEL || process.env.OLLAMA_MODEL || 'qwen2.5:3b';

export type Visual = 'card' | 'stat' | 'chart' | 'highlight' | 'quote' | 'banner';
const VISUALS: Visual[] = ['card', 'stat', 'chart', 'highlight', 'quote', 'banner'];

const STYLE_ACCENT: Record<string, string> = {
  storybook: '#E07A5F',
  cartoon: '#FFE14D',
  flatVector: '#E9C46A',
  handDrawn: '#2A2622',
  madhubani: '#F4B400',
  inkWash: '#B3261E',
  shadowPuppet: '#FFB347',
  paperCutout: '#FF6B6B',
  stainedGlass: '#E0B53A',
  anime: '#FF8FAB',
  warli: '#F2C14E',
  blueprint: '#9CC3FF',
  ukiyoe: '#E07A5F',
  miniature: '#D4A537',
};

export interface ScriptVideoOptions {
  script: string;
  title?: string;
  aspect?: string; // 9:16 | 1:1 | 4:5 | 16:9
  style?: string; // art style id, 'auto' or 'mix'
  voice?: string; // Kokoro voice id, or "os:<Windows voice name>"
  language?: 'en' | 'hi'; // voice-over language (auto-detected from Devanagari when omitted)
  captions?: CaptionLook | 'off';
  mode?: 'story' | 'graphics'; // story = changing places + animated characters; graphics = art backdrops + infographics
  /** story mode: 'ai' paints each scene with local Stable Diffusion (ComfyUI); 'vector' draws it procedurally (default) */
  illustration?: 'vector' | 'ai';
  /** AI illustration only: turn each painting into a moving clip with LTX-Video (image-to-video) */
  animate?: boolean;
  /** which image-to-video engine: ltx (fast) or wan (best); default = the installed one */
  motionEngine?: 'ltx' | 'wan';
}

interface ScenePlan {
  text: string;
  visual: Visual;
  title: string;
  value?: number;
  suffix?: string;
  label?: string;
  data?: string;
  highlight?: string;
  style?: string;
}

// ---------------------------------------------------------------- 1. split
export function splitScenes(script: string): string[] {
  const clean = script.replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
  const paragraphs = clean.split(/\n\s*\n+/).map((p) => p.replace(/\n/g, ' ').trim()).filter(Boolean);
  const scenes: string[] = [];
  for (const p of paragraphs) {
    const sentences = p.match(/[^.!?…।॥]+[.!?…।॥]+["')\]]*|[^.!?…।॥]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [p];
    let cur = '';
    for (const s of sentences) {
      // ~1-2 sentences per scene, max ~220 chars (≈ 12-15 s of speech)
      if (cur && (cur.length + s.length > 220 || cur.split(/[.!?…।॥]/).filter((x) => x.trim()).length >= 2)) {
        scenes.push(cur);
        cur = '';
      }
      cur = cur ? `${cur} ${s}` : s;
    }
    if (cur) scenes.push(cur);
  }
  return scenes.slice(0, 60);
}

// ---------------------------------------------------------------- 2. plan
const firstNumber = (t: string) => {
  const m = t.match(/(\d+(?:\.\d+)?)\s*(%|percent|per cent|x|times|million|crore|lakh|billion|k)?/i);
  if (!m) return null;
  const unit = (m[2] || '').toLowerCase();
  const suffix = unit === 'percent' || unit === 'per cent' || unit === '%' ? '%' : unit ? ` ${unit}` : '';
  return { value: Number(m[1]), suffix };
};

const shortTitle = (t: string, words = 6) =>
  t.replace(/[“”"]/g, '').split(/\s+/).slice(0, words).join(' ').replace(/[,;:.!?…]+$/, '');

export function heuristicPlan(scenes: string[], style: string): ScenePlan[] {
  return scenes.map((text, i) => {
    const num = firstNumber(text);
    if (i === 0) return { text, visual: 'card', title: shortTitle(text, 6), style };
    if (num && num.value > 0) return { text, visual: 'stat', title: shortTitle(text), value: num.value, suffix: num.suffix, label: shortTitle(text.replace(/\d[\d.,]*\s*%?/, ''), 6), style };
    if (/[“"].+[”"]/.test(text)) return { text, visual: 'quote', title: (text.match(/[“"](.+?)[”"]/)?.[1] ?? shortTitle(text)).slice(0, 120), style };
    const cycle: Visual[] = ['banner', 'highlight', 'card'];
    const v = cycle[i % cycle.length];
    const sentence = text.split(/(?<=[.!?…])\s+/)[0];
    return { text, visual: v, title: shortTitle(text, 6), highlight: shortTitle(sentence, 5), style };
  });
}

async function llmPlan(scenes: string[], styleChoice: string): Promise<{ plans: ScenePlan[]; style: string } | null> {
  const list = scenes.map((s, i) => `${i}: ${s}`).join('\n');
  const prompt = `You are a motion-graphics director turning a narrated script into an explainer video.
Each numbered scene is narrated exactly as written. For every scene choose ONE on-screen visual:
- card: full-screen illustrated title card. needs "title" (max 6 words)
- stat: big counting number. needs "value" (number), "suffix" (e.g. "%", " years"), "label" (max 6 words). Use only when the scene states a number.
- chart: bar chart. needs "title" and "data" like "India:62, China:48, USA:30". Use only when the scene compares several numbers.
- highlight: document excerpt with a highlighter. needs "highlight" = the key phrase copied exactly from the scene (3-8 words)
- quote: quote card. needs "title" = a short memorable line from the scene
- banner: caption banner over an illustrated backdrop. needs "title" (max 8 words)
Vary the visuals; start with a card; use stat/chart only for real numbers from the scene.
${styleChoice === 'auto' ? `Also pick ONE art style that suits the topic from: ${ART_STYLE_OPTIONS.join(', ')}.` : ''}

Write every title, label, highlight and quote in the SAME language and script as the narration (Hindi narration → Devanagari Hindi). Keep actor names, place, motion and other field values in plain English.

SCENES:
${list}

Reply with ONLY JSON: {${styleChoice === 'auto' ? '"style":"<art style>",' : ''}"scenes":[{"i":0,"visual":"card","title":"..."}, ...]} with one entry per scene, in order.`;

  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: PLAN_MODEL,
        prompt,
        format: 'json',
        stream: false,
        ...(/qwen3|deepseek-r1|gpt-oss|magistral/i.test(PLAN_MODEL) ? { think: false } : {}),
        options: { temperature: 0.4, num_ctx: 8192 },
      }),
      signal: AbortSignal.timeout(1000 * 60 * 4),
    });
    if (!res.ok) return null;
    const parsed = JSON.parse(((await res.json()) as { response: string }).response) as { style?: string; scenes?: Array<Record<string, unknown>> };
    const style = styleChoice === 'auto' ? (ART_STYLE_OPTIONS.includes(String(parsed.style)) ? String(parsed.style) : 'paperCutout') : styleChoice;
    const fallback = heuristicPlan(scenes, style);
    const plans = scenes.map((text, i) => {
      const raw = parsed.scenes?.find((s) => Number(s.i) === i) ?? parsed.scenes?.[i];
      if (!raw) return fallback[i];
      const visual = VISUALS.includes(raw.visual as Visual) ? (raw.visual as Visual) : fallback[i].visual;
      const plan: ScenePlan = {
        text,
        visual,
        title: String(raw.title ?? fallback[i].title).slice(0, 90),
        value: Number.isFinite(Number(raw.value)) ? Number(raw.value) : undefined,
        suffix: raw.suffix !== undefined ? String(raw.suffix).slice(0, 12) : undefined,
        label: raw.label !== undefined ? String(raw.label).slice(0, 60) : undefined,
        data: raw.data !== undefined ? String(raw.data).slice(0, 200) : undefined,
        highlight: raw.highlight !== undefined ? String(raw.highlight).slice(0, 80) : undefined,
        style,
      };
      // guard: stat/chart need real numbers from the narration
      if (plan.visual === 'stat' && (plan.value === undefined || !/\d/.test(text))) {
        const num = firstNumber(text);
        if (num) Object.assign(plan, { value: num.value, suffix: plan.suffix ?? num.suffix });
        else plan.visual = 'banner';
      }
      if (plan.visual === 'chart' && !(plan.data && /:\s*\d/.test(plan.data))) plan.visual = 'banner';
      if (plan.visual === 'highlight' && !plan.highlight) plan.highlight = shortTitle(text, 5);
      return plan;
    });
    return { plans, style };
  } catch {
    return null;
  }
}

/** The sentence of the scene that shares the most words with the model's phrase. */
function closestSentence(text: string, phrase: string): string {
  const want = new Set(phrase.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
  const sentences = text.split(/(?<=[.!?…।॥])\s+/).map((s) => s.replace(/[.!?…।॥]+$/, '').trim()).filter(Boolean);
  let best = sentences[0] ?? text;
  let score = -1;
  for (const s of sentences) {
    const n = (s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((w) => want.has(w)).length;
    if (n > score) [best, score] = [s, n];
  }
  return best;
}

const normSuffix = (s?: string) => {
  const t = (s ?? '').trim().toLowerCase();
  if (t === 'percent' || t === 'per cent' || t === '%') return '%';
  if (t === 'million') return 'M';
  if (t === 'billion') return 'B';
  if (t === 'thousand' || t === 'k') return 'K';
  if (t === 'crore') return ' cr';
  if (t === 'lakh') return ' lakh';
  // only short units survive (years, km, x, °C…); anything wordier belongs in the label
  if (!t || t.length > 7 || /\s/.test(t)) return '';
  return ` ${t}`;
};

// ---------------------------------------------------------------- 3+4. voice and timings
/** Put the script's words on Whisper's timeline (same count → 1:1; otherwise spread by length across the heard span). */
function alignScript(text: string, heard: EditWord[], voDur: number): EditWord[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (!heard.length) return evenWords(text, voDur);
  if (heard.length === tokens.length) return heard.map((w, i) => ({ text: tokens[i], start: round(w.start), end: round(w.end) }));
  const start = heard[0].start;
  const end = heard[heard.length - 1].end;
  const total = tokens.reduce((n, t) => n + t.length + 1, 0) || 1;
  let t = start;
  return tokens.map((w) => {
    const d = ((end - start) * (w.length + 1)) / total;
    const out = { text: w, start: round(t), end: round(t + d * 0.92) };
    t += d;
    return out;
  });
}

function evenWords(text: string, dur: number): EditWord[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  const total = tokens.reduce((n, t) => n + t.length + 1, 0) || 1;
  let t = 0.05;
  const span = Math.max(0.5, dur - 0.1);
  return tokens.map((w) => {
    const d = (span * (w.length + 1)) / total;
    const out = { text: w, start: round(t), end: round(t + d * 0.92) };
    t += d;
    return out;
  });
}

const round = (n: number) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------- 5. build
function sceneItems(plan: ScenePlan, from: number, dur: number, style: string): EditItem[] {
  const base = { from: round(from), duration: round(dur) };
  // a backdrop under another graphic is dimmed so the graphic stays readable
  const bg = (text = '') => ({ id: newId('bg'), kind: 'text' as const, name: `Scene · ${style}`, track: 1, ...base, template: 'artCard' as const, props: { style, text, subtitle: '', position: 'auto', size: 1, dim: text ? 0 : 0.6 } });
  const top = (template: keyof typeof TEMPLATES, props: Record<string, string | number>, name: string) => ({
    id: newId('g'),
    kind: 'text' as const,
    name,
    track: 2,
    from: round(from + 0.3),
    duration: round(Math.max(1, dur - 0.3)),
    template,
    props: { ...TEMPLATES[template].defaults, ...props },
  });
  const accent = STYLE_ACCENT[style] ?? '#B5E2DD';
  switch (plan.visual) {
    case 'card':
      return [bg(plan.title)];
    case 'stat':
      return [bg(), top('stat', { value: plan.value ?? 0, suffix: normSuffix(plan.suffix), prefix: '', label: plan.label ?? plan.title, accent }, 'Stat')];
    case 'chart':
      return [bg(), top('barChart', { title: plan.title, data: plan.data ?? '', unit: '', accent }, 'Chart')];
    case 'highlight': {
      let hl = plan.highlight ?? plan.title;
      if (plan.text.toLowerCase().indexOf(hl.toLowerCase()) < 0) hl = closestSentence(plan.text, hl); // model paraphrased → use the real words
      const idx = plan.text.toLowerCase().indexOf(hl.toLowerCase());
      const before = idx > 0 ? plan.text.slice(0, idx).trim() : '';
      const after = idx >= 0 ? plan.text.slice(idx + hl.length).trim() : '';
      return [bg(), top('markerHighlight', { source: '', before: before.slice(-90), highlight: idx >= 0 ? plan.text.slice(idx, idx + hl.length) : hl, after: after.slice(0, 90), color: '#FFE44D' }, 'Highlight')];
    }
    case 'quote':
      return [bg(), top('quote', { text: plan.title, author: '', accent }, 'Quote')];
    default:
      return [bg(), top('artBanner', { style, text: plan.title, position: 'top', size: 1.5 }, 'Banner')];
  }
}

/** Infographic overlay for a story scene (stat, chart, highlight, quote, title) — no backdrop. */
/** The planner sometimes answers in another script (a Hindi title for an English story) — keep it only if it matches. */
function sameScript(title: string | undefined, text: string): string {
  if (!title) return '';
  const deva = (s: string) => /[ऀ-ॿ]/.test(s); // Devanagari
  return deva(title) === deva(text) ? title : '';
}

function storyGraphic(plan: StoryPlan, text: string, from: number, dur: number, style: string, index: number, videoTitle = ''): EditItem[] {
  const accent = STYLE_ACCENT[style] ?? '#B5E2DD';
  const start = round(from + 0.5);
  const len = round(Math.max(1.2, Math.min(dur - 0.6, 4.5)));
  const item = (template: keyof typeof TEMPLATES, props: Record<string, string | number>, name: string): EditItem => ({
    id: newId('g'),
    kind: 'text',
    name,
    track: 5,
    from: start,
    duration: len,
    template,
    props: { ...TEMPLATES[template].defaults, ...props },
  });
  // a planned explainer sequence replaces the simple graphic for this beat
  if (plan.motion && SEQUENCES[plan.motion.id]) {
    const seq = SEQUENCES[plan.motion.id];
    const mlen = round(Math.max(2, Math.min(seq.duration, dur - 0.4)));
    return [{ id: newId('mg'), kind: 'text', name: seq.label, track: 5, from: round(from + 0.3), duration: mlen, template: 'motion', props: { ...seq.params, ...plan.motion.params, fx: plan.motion.id } }];
  }
  switch (plan.graphic) {
    case 'title': {
      // a real title, never a cut-off fragment of the narration ("In a quiet hill village at")
      const t = sameScript(plan.title, text) || (index === 0 ? sameScript(videoTitle.replace(/\s*\([^)]*\)\s*$/, ''), text) : '');
      return t && t.split(/\s+/).length <= 8 ? [item('artBanner', { style, text: t, position: 'top', size: 1 }, 'Title')] : [];
    }
    case 'stat':
      return plan.value === undefined ? [] : [item('stat', { value: plan.value, suffix: normSuffix(plan.suffix), prefix: '', label: plan.label ?? '', accent }, 'Stat')];
    case 'chart':
      return [item('barChart', { title: plan.title ?? '', data: plan.data ?? '', unit: '', accent }, 'Chart')];
    case 'quote': {
      const q = sameScript(plan.title, text);
      return q && q.split(/\s+/).length <= 12 ? [item('artBanner', { style, text: q, position: 'top', size: 0.85 }, 'Quote')] : [];
    }
    case 'highlight': {
      let hl = plan.highlight ?? plan.title ?? '';
      if (text.toLowerCase().indexOf(hl.toLowerCase()) < 0) hl = closestSentence(text, hl);
      // the captions already show the whole sentence — only a short key phrase earns a banner
      return hl && hl.split(/\s+/).length <= 8 ? [item('artBanner', { style, text: hl, position: 'top', size: 0.85 }, 'Highlight')] : [];
    }
    default:
      return index === 0 ? [] : [];
  }
}

// ---------------------------------------------------------------- motion graphics matched to the art style
const styleMotion = (style: string) => (ART_STYLE_SPECS[style as StyleSpecId] as { motion?: { atmosphere: string[]; transitions: string[] } } | undefined)?.motion;

/** Overlays that let the painting show through (full-frame backgrounds such as gradientMove would cover it). */
const SEE_THROUGH = new Set(['dustParticles', 'rainFx', 'snowFx', 'confetti', 'sparks', 'embers', 'bokeh', 'twinklingStars', 'fireflyGlow', 'lightSweep', 'lightRays', 'filmGrain', 'vignette', 'lightLeak', 'fogDrift', 'glowPulse']);

/** What the words call for, before the style's own taste. */
const ATMOSPHERE_CUES: Array<[RegExp, string]> = [
  [/\b(rain|raining|storm|monsoon|drizzle|thunder)/i, 'rainFx'],
  [/\b(snow|snowing|winter|blizzard|frost)/i, 'snowFx'],
  [/\b(firefl)/i, 'fireflyGlow'],
  [/\b(fire|flame|lamp|diya|candle|ember|bonfire|torch)/i, 'embers'],
  [/\b(festival|celebrat|party|wedding|cheer|confetti|diwali|holi)/i, 'confetti'],
  [/\b(mist|misty|fog|foggy|haze)/i, 'fogDrift'],
  [/\b(magic|sparkl|wish|glitter|spell)/i, 'sparks'],
  [/\b(star|stars|starry)/i, 'twinklingStars'],
  [/\b(sunrise|dawn|sunset|sunbeam|sunlight)/i, 'lightRays'],
];

/** One see-through atmosphere overlay per painted scene: from the narration if it asks for one, else the style's. */
function sceneAtmosphere(plan: StoryPlan, text: string, style: string, from: number, dur: number, index: number): EditItem[] {
  const cue = ATMOSPHERE_CUES.find(([re]) => re.test(text))?.[1] ?? (plan.time === 'night' ? 'twinklingStars' : plan.time === 'dawn' || plan.time === 'sunset' ? 'lightRays' : undefined);
  const own = (styleMotion(style)?.atmosphere ?? []).filter((id) => SEE_THROUGH.has(id));
  const fx = cue ?? (own.length ? own[index % own.length] : 'dustParticles');
  if (!EFFECTS_LIB[fx]) return [];
  return [{ id: newId('atm'), kind: 'text', name: `Atmosphere · ${EFFECTS_LIB[fx].label}`, track: 4, from: round(from), duration: round(dur), template: 'motion', props: { fx, accent: STYLE_ACCENT[style] ?? '#B5E2DD' } }];
}

/** Scene-to-scene hand-off in the style's own manner (paper tear for paper cutout, grid wipe for stained glass…). */
function styleTransition(style: string, cut: number, index: number): EditItem {
  const list = styleMotion(style)?.transitions ?? [];
  // fade in / out alone would be a cut to black — use a dip through black instead
  const pick = (list.length ? list[(index - 1) % list.length] : 'whipPan').replace(/^fade(In|Out)$/, 'dipToColour');
  if (pick in EFFECTS) {
    const d = EFFECTS[pick as EffectId].duration;
    return { id: newId('tr'), kind: 'effect', name: EFFECTS[pick as EffectId].label, track: 1, from: round(Math.max(0, cut - d / 2)), duration: d, effect: pick as EffectId, intensity: 1 };
  }
  const def = EFFECTS_LIB[pick];
  if (!def) return transitionAt(cut, index);
  const d = def.duration;
  const accent = pick === 'dipToColour' ? (style === 'inkWash' || style === 'handDrawn' ? '#EFEAE0' : '#000000') : STYLE_ACCENT[style] ?? '#B5E2DD';
  return { id: newId('tr'), kind: 'text', name: `Transition · ${def.label}`, track: 7, from: round(Math.max(0, cut - d / 2)), duration: d, template: 'motion', props: { fx: pick, accent } };
}

const BORDER_STYLES = new Set(['madhubani', 'warli', 'miniature', 'ukiyoe', 'blueprint', 'stainedGlass']);

/**
 * What should move, for image-to-video. LTX-Video likes one plain paragraph: the main action first,
 * then small secondary motion and the camera — and it must not change the picture's style.
 */
function motionPrompt(plan: StoryPlan, text: string, cast: CharacterSpec[], style: string): string {
  let action = text.replace(/\s+/g, ' ').trim();
  for (const c of cast) action = action.split(c.name).join(describeCharacter(c, { named: false }).split(' with ')[0].replace(/^a /, 'the '));
  const camera: Record<string, string> = { pushIn: 'The camera slowly pushes in.', pullOut: 'The camera slowly pulls back.', panLeft: 'The camera pans slowly to the left.', panRight: 'The camera pans slowly to the right.', tiltUp: 'The camera tilts slowly upward.' };
  const ambient = /night/i.test(plan.time ?? '') ? 'Lights flicker softly and stars twinkle.' : 'Leaves and grass sway gently in the breeze.';
  const label = (ART_STYLE_SPECS[style as StyleSpecId] as { label?: string } | undefined)?.label ?? 'illustrated';
  return `${action} Natural, gentle movement: hair and clothes move slightly, people blink and breathe. ${ambient} ${camera[plan.camera] ?? 'The camera holds steady.'} A hand-painted 2D ${label} illustration brought to life, flat painted look kept in every frame, same art style, colours and characters throughout, smooth and consistent motion.`;
}

/** One Stable Diffusion painting for a scene, with a slow Ken Burns drift and the planned camera move. */
async function paintedScene(plan: StoryPlan, text: string, from: number, dur: number, style: string, aspect: string, cast: CharacterSpec[], seed: number, onProgress: (m: string, fraction: number, live?: { preview?: string; step?: number; steps?: number; done?: string }) => void, animate = false, engine?: 'ltx' | 'wan'): Promise<EditItem[]> {
  const [width, height] = sdSize(aspect);
  // people named in the narration (or the only character a "she / he" can mean) always appear, and come first
  const actors = plan.actors.map((a) => a.name);
  const has = (n: string) => actors.some((a) => a.toLowerCase() === n.toLowerCase());
  for (const c of [...cast].reverse()) {
    const named = new RegExp(`\\b${c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text);
    const pronoun = cast.length === 1 && /\b(she|he|her|his|him)\b/i.test(text);
    if ((named || pronoun) && !has(c.name)) actors.unshift(c.name);
    else if (named && has(c.name)) actors.sort((a, b) => Number(b.toLowerCase() === c.name.toLowerCase()) - Number(a.toLowerCase() === c.name.toLowerCase()));
  }
  const { prompt, negative } = stylisedScene({ place: plan.place, time: plan.time, actors, narration: text, mood: plan.mood }, style, cast);
  // painting takes the first part of this scene's progress; animating (if on) the rest
  const paintShare = animate ? 0.45 : 1;
  onProgress(plan.place, 0);
  const img = await generateImage({ prompt, negative, width, height, seed, onProgress: (m, f, live) => onProgress(`${plan.place} · ${m}`, f * paintShare, live) });
  onProgress(`${plan.place} · painted`, paintShare, { preview: img.url, done: img.url });
  const items: EditItem[] = [
    { id: newId('ai'), kind: 'image', name: `Painting · ${plan.place}`, track: 1, from: round(from), duration: round(dur), src: img.url, fit: 'cover', scale: 1, x: 50, y: 50, depth: 1, motion: 'kenBurns' },
  ];
  if (animate) {
    // a 3–5 s clip, played in gentle slow motion so it fills the scene; the painting underneath covers any gap
    const clipSecs = Math.min(5, Math.max(2, dur * 0.6));
    const frames = Math.round((clipSecs * VIDEO_FPS) / 8) * 8 + 1;
    try {
      const clip = await animateImage({
        image: img.file,
        prompt: motionPrompt(plan, text, cast, style),
        // keep it a 2D illustration: LTX drifts towards photo-real faces without this
        negative: `${buildNegativePrompt(style)}, photorealistic, realistic skin, 3D render, CGI, morphing face, distorted hands, jittery, flicker, blurry, text, watermark`,
        aspect,
        frames,
        seed,
        engine,
        onProgress: (m, f) => onProgress(`${plan.place} · moving · ${m}`, paintShare + f * (1 - paintShare), { preview: img.url }),
      });
      const speed = Math.max(0.4, Math.min(1, clip.seconds / dur));
      items.push({ id: newId('mv'), kind: 'video', name: `Motion · ${plan.place}`, track: 2, from: round(from), duration: round(Math.min(dur, clip.seconds / speed)), src: clip.url, sourceStart: 0, volume: 0, speed: round(speed), fit: 'cover', zoom: 1, panX: 50, panY: 50 });
    } catch (err) {
      console.warn('[clipforge] image-to-video failed, keeping the still painting:', (err as Error).message);
    }
  }
  if (plan.camera !== 'none') items.push({ id: newId('cam'), kind: 'effect', name: `Camera · ${plan.camera}`, track: 1, from: round(from), duration: round(dur), effect: plan.camera as EffectId, intensity: 0.6 });
  return items;
}

export async function scriptToVideo(opts: ScriptVideoOptions, progress: ProgressFn): Promise<EditProject> {
  const scenes = splitScenes(opts.script || '');
  if (!scenes.length) throw new Error('The script is empty.');
  const aspect = FRAME_SIZES[opts.aspect ?? ''] ? (opts.aspect as string) : '9:16';
  const choice = opts.style === 'auto' || opts.style === 'mix' || ART_STYLE_OPTIONS.includes(String(opts.style)) ? String(opts.style) : 'auto';

  const mode = opts.mode === 'graphics' ? 'graphics' : 'story';
  const lang = languageOf(opts.script, opts.language ?? (opts.voice && /^h[fm]_/.test(opts.voice) ? 'hi' : undefined));
  progress('plan', `Planning ${scenes.length} scenes with ${PLAN_MODEL}`, 3);
  const planned = await llmPlan(scenes, choice === 'mix' ? 'paperCutout' : choice);
  const baseStyle = planned?.style ?? (choice === 'auto' || choice === 'mix' ? 'paperCutout' : choice);
  let plans = planned?.plans ?? heuristicPlan(scenes, baseStyle);
  if (choice === 'mix') plans = plans.map((p, i) => ({ ...p, style: ART_STYLE_OPTIONS[i % ART_STYLE_OPTIONS.length] }));
  let story: StoryPlan[] = [];
  if (mode === 'story') {
    progress('plan', 'Storyboarding places, characters and camera moves', 5);
    story = (await llmStory(scenes)) ?? heuristicStory(scenes);
    // procedural themes and AI paintings: fix every person's identity once (face, hair, clothes) before drawing any scene
    if (isTheme(opts.style) || opts.illustration === 'ai') {
      progress('plan', 'Casting characters (same look in every scene)', 7);
      await planStorySpecs(opts.script);
    }
  }
  const frame = { width: FRAME_SIZES[aspect][0], height: FRAME_SIZES[aspect][1] };

  // AI illustration: one painted frame per scene from local Stable Diffusion, same cast + seed for consistency
  let aiCast: CharacterSpec[] | null = null;
  const aiSeed = Math.floor(Math.random() * 2 ** 31);
  if (mode === 'story' && opts.illustration === 'ai') {
    await ensureComfy((m) => progress('plan', m, 6));
    const st = await sdStatus(true);
    if (!st.running) throw new Error('AI illustration needs Stable Diffusion: start ComfyUI (see docs → Stable Diffusion setup), or switch Illustration to "Vector".');
    if (!st.checkpoint) throw new Error('ComfyUI is running but has no checkpoint. Put an SDXL model in ComfyUI/models/checkpoints and restart ComfyUI.');
    aiCast = (await planStorySpecs(opts.script)).characters.map((c) => c.spec);
  }
  // moving scenes need the LTX-Video model; without it the paintings stay still (and we say so)
  let animate = false;
  if (aiCast && opts.animate) {
    animate = Boolean(await videoModel());
    if (!animate) progress('plan', 'Motion is off: the LTX-Video model is not installed (npm run comfy:setup -- -Video)', 7);
  }

  const stamp = Date.now();
  const items: EditItem[] = [];
  const lead = 0.4; // breath before the first line
  const gap = 0.35; // pause between scenes
  let t = 0;
  const look = opts.captions === 'off' ? null : (['karaoke', 'pop', 'bold', 'clean'].includes(String(opts.captions)) ? opts.captions : 'karaoke') as CaptionLook;

  const painted: string[] = []; // finished AI paintings, shown as a filmstrip while the video is made
  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i];
    const style = plan.style ?? baseStyle;
    progress('voice', `Voicing scene ${i + 1} of ${plans.length}`, 8 + (80 * i) / plans.length, aiCast ? { sceneIndex: i + 1, sceneTotal: plans.length, aspect, scenes: [...painted] } : { sceneIndex: i + 1, sceneTotal: plans.length, aspect });
    const fileName = `vo_${stamp}_${String(i + 1).padStart(2, '0')}.wav`;
    const wavPath = path.join(UPLOADS_DIR, fileName);
    await speak(plan.text.replace(/'@/g, "'"), wavPath, opts.voice, lang);
    const voDur = Math.max(0.6, await audioDuration(wavPath));
    const sceneStart = i === 0 ? 0 : t;
    const voStart = sceneStart + (i === 0 ? lead : 0.15);
    const sceneDur = voStart - sceneStart + voDur + gap;

    // word timings from Whisper on the voice clip (falls back to even spacing)
    let words: EditWord[] = [];
    if (look) {
      progress('voice', `Timing words for scene ${i + 1} of ${plans.length}`, 8 + (80 * (i + 0.5)) / plans.length);
      try {
        const segs = await transcribeLocal(wavPath, `vo_${stamp}_${i}`, lang === 'hi' ? 'hi' : undefined);
        const heard = segs.flatMap((s) => s.words ?? []);
        // captions always show the script's exact words; Whisper only provides the timing
        words = alignScript(plan.text, heard, voDur);
      } catch (err) {
        console.warn('[clipforge] script-video: Whisper timing failed, using even timing:', (err as Error).message);
      }
      if (!words.length) words = evenWords(plan.text, voDur);
    }

    if (mode === 'story') {
      progress('assets', `Drawing scene ${i + 1}: ${story[i].place}`, 8 + (80 * (i + 0.7)) / plans.length);
      if (aiCast) {
        const n = plans.length;
        items.push(
          ...(await paintedScene(story[i], plan.text, sceneStart, sceneDur, style, aspect, aiCast, aiSeed, (m, f, live) => {
            if (live?.done) painted.push(live.done);
            progress('assets', `${animate ? 'Making' : 'Painting'} scene ${i + 1} of ${n} (${painted.length} done): ${m}`, 8 + (80 * (i + 0.7 + 0.28 * f)) / n, {
              sceneIndex: i + 1,
              sceneTotal: n,
              aspect,
              scenes: [...painted],
              // a new scene starts with an empty canvas (not the previous scene's picture)
              ...(live ? (live.preview ? { preview: live.preview } : {}) : { preview: undefined, step: 0 }),
              ...(live?.steps ? { step: live.step, steps: live.steps } : {}),
            });
          }, animate, opts.motionEngine)),
        );
      }
      else items.push(...(await buildStoryScene(story[i], sceneStart, sceneDur, style, aspect, frame, (n) => progress('assets', `Scene ${i + 1}: ${n}`, 8 + (80 * (i + 0.75)) / plans.length))));
      items.push(...storyGraphic(story[i], plan.text, sceneStart, sceneDur, style, i, opts.title ?? ''));
      if (i > 0) items.push(styleTransition(style, sceneStart, i));
      if (aiCast) items.push(...sceneAtmosphere(story[i], plan.text, style, sceneStart, sceneDur, i));
    } else {
      items.push(...sceneItems(plan, sceneStart, sceneDur, style));
    }
    items.push({ id: newId('vo'), kind: 'audio', name: `Voice ${i + 1}`, track: 0, from: round(voStart), duration: round(voDur), src: `/media/uploads/${fileName}`, sourceStart: 0, volume: 1.4 });
    if (look && words.length) {
      const position = plan.visual === 'banner' || plan.visual === 'card' ? 'bottom' : 'bottom';
      items.push({ id: newId('cap'), kind: 'captions', name: `Captions ${i + 1}`, track: mode === 'story' ? 6 : 3, from: round(voStart), duration: round(voDur + 0.2), words, look, position, accent: STYLE_ACCENT[style] ?? '#B5E2DD' });
    }
    t = sceneStart + sceneDur;
  }

  const total = t;
  items.push({ id: newId('t'), kind: 'text', name: 'Progress', track: mode === 'story' ? 8 : 4, from: 0, duration: round(total), template: 'progressBar', props: { position: 'top' } });
  // a decorative frame over the whole story for styles with a signature border
  if (mode === 'story' && BORDER_STYLES.has(baseStyle) && choice !== 'mix') {
    items.push({ id: newId('frm'), kind: 'text', name: `Frame · ${baseStyle}`, track: 7, from: 0, duration: round(total), template: 'artFrame', props: { style: baseStyle, opacity: 1 } });
  }

  const edit = blankEdit(opts.title?.trim() || shortTitle(scenes[0], 6) || 'Script video', aspect);
  edit.items = items;
  progress('save', 'Saving the edit', 97);
  const saved = saveEdit(edit);
  progress('done', 'Video ready to edit', 100);
  return saved;
}

/** Remove voice-over files of an edit that is deleted (best effort). */
export function voiceFilesOf(edit: EditProject): string[] {
  return edit.items
    .filter((i) => i.kind === 'audio' && /\/media\/uploads\/vo_\d+_\d+\.wav$/.test(i.src))
    .map((i) => path.join(UPLOADS_DIR, path.basename((i as { src: string }).src)))
    .filter((p) => fs.existsSync(p));
}
