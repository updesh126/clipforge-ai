/**
 * "Edit with AI": the local LLM (Ollama) reads the timeline + transcript and returns JSON edit operations.
 * Every operation is validated by applyOps/sanitiseItem before it touches the project.
 *
 * Small models (3B) are weak at timestamps, so they may anchor items to a spoken phrase with "at":
 * the server finds when those words are said.
 */
import type { EditProject, EditWord } from '../src/editor/types.ts';
import { EFFECTS, TEMPLATES } from '../src/editor/catalog.ts';
import { CATEGORIES, EFFECTS_LIB } from '../src/motion/catalog.ts';
import { isMotionId, SEQUENCES } from '../src/motion/sequences.ts';
import { applyOps, type EditOp } from './edits.ts';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const EDIT_MODEL = process.env.OLLAMA_EDIT_MODEL || process.env.OLLAMA_MODEL || 'qwen2.5:3b';

function timelineSummary(edit: EditProject): string {
  return edit.items
    .map((i) => {
      const base = `${i.id} | ${i.kind} | ${i.from.toFixed(1)}s-${(i.from + i.duration).toFixed(1)}s`;
      if (i.kind === 'text') return `${base} | template=${i.template} | ${JSON.stringify(i.props)}`;
      if (i.kind === 'effect') return `${base} | effect=${i.effect}`;
      if (i.kind === 'captions') return `${base} | look=${i.look} position=${i.position}`;
      if (i.kind === 'video') return `${base} | zoom=${i.zoom} volume=${i.volume}`;
      return base;
    })
    .join('\n');
}

/** All spoken words with absolute timeline times. */
function timelineWords(edit: EditProject): EditWord[] {
  return edit.items
    .filter((i) => i.kind === 'captions')
    .flatMap((c) => (c.kind === 'captions' ? c.words.map((w) => ({ text: w.text, start: c.from + w.start, end: c.from + w.end })) : []));
}

function transcriptSummary(words: EditWord[]): string {
  const lines: string[] = [];
  let cur: string[] = [];
  let start = 0;
  for (const w of words) {
    if (!cur.length) start = w.start;
    cur.push(w.text);
    if (/[.!?]$/.test(w.text) || cur.length >= 14) {
      lines.push(`[${start.toFixed(1)}s] ${cur.join(' ')}`);
      cur = [];
    }
  }
  if (cur.length) lines.push(`[${start.toFixed(1)}s] ${cur.join(' ')}`);
  return lines.join('\n').slice(0, 6000);
}

const norm = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

/** Time at which a phrase is spoken (first match), or null. */
export function findPhrase(words: EditWord[], phrase: string): number | null {
  const target = phrase.split(/\s+/).map(norm).filter(Boolean);
  if (!target.length) return null;
  for (let i = 0; i <= words.length - target.length; i++) {
    if (target.every((t, k) => norm(words[i + k].text) === t)) return words[i].start;
  }
  // loose match on the first word
  const first = words.find((w) => norm(w.text) === target[0]);
  return first ? first.start : null;
}

/** Repair common small-model mistakes, resolve "at" phrases, drop duplicates. */
export function normaliseOps(rawOps: unknown[], words: EditWord[], total: number): EditOp[] {
  const out: EditOp[] = [];
  const seen = new Set<string>();
  for (const raw of rawOps) {
    if (!raw || typeof raw !== 'object') continue;
    const op = { ...(raw as Record<string, unknown>) };
    if (op.op === 'add') {
      // item fields put directly on the op
      let item = (op.item && typeof op.item === 'object' ? { ...(op.item as Record<string, unknown>) } : { ...op }) as Record<string, unknown>;
      delete item.op;
      // motion graphics: {"kind":"motion","fx":"bigStat",…} or a bare catalogue id as kind/template/effect
      {
        const fxId = [item.fx, item.kind, item.template, item.effect].find((v) => isMotionId(v) && !(String(v) in TEMPLATES && v !== 'motion') && !(String(v) in EFFECTS));
        if (item.kind === 'motion' || item.template === 'motion' || fxId) {
          if (!isMotionId(fxId ?? item.fx)) continue; // invented id → drop the op
          const id = String(fxId ?? item.fx);
          const known = new Set(['op', 'kind', 'template', 'effect', 'fx', 'at', 'from', 'duration', 'track', 'name', 'props', 'when']);
          const loose = Object.fromEntries(Object.entries(item).filter(([k]) => !known.has(k)));
          item = { ...item, kind: 'text', template: 'motion', props: { ...(SEQUENCES[id]?.params ?? {}), ...loose, ...((item.props as object) ?? {}), fx: id } };
          delete item.fx;
          delete item.effect;
          // never shorter than ~80% of the designed length, or the sequence is cut before it lands
          const designed = SEQUENCES[id]?.duration ?? EFFECTS_LIB[id]?.duration ?? 4;
          item.duration = Math.max(Number(item.duration) || 0, designed * 0.8);
          if (!item.name) item.name = SEQUENCES[id]?.label ?? EFFECTS_LIB[id]?.label;
        }
      }
      // kind given as a template/effect id ({"kind":"stat"}) → proper kind; loose fields → props
      if (typeof item.kind === 'string' && item.kind in TEMPLATES) {
        const fieldKeys = TEMPLATES[item.kind as keyof typeof TEMPLATES].fields.map((f) => f.key);
        const loose = Object.fromEntries(fieldKeys.filter((k) => k in item).map((k) => [k, item[k]]));
        item = { ...item, template: item.kind, kind: 'text', props: { ...loose, ...((item.props as object) ?? {}) } };
      } else if (typeof item.kind === 'string' && item.kind in EFFECTS) {
        item = { ...item, effect: item.kind, kind: 'effect' };
      }
      // "template" without kind → text; "effect" without kind → effect
      if (!item.kind) item.kind = item.effect ? 'effect' : 'text';
      if (item.kind === 'effect' && !item.effect && typeof item.template === 'string' && item.template in EFFECTS) item.effect = item.template;
      if (typeof item.effect === 'string' && item.effect in TEMPLATES && !(item.effect in EFFECTS)) {
        item = { ...item, template: item.effect, kind: 'text' };
      }
      // "at": spoken phrase → time
      const props = (item.props && typeof item.props === 'object' ? item.props : {}) as Record<string, unknown>;
      const phraseOf = (v: unknown) => (typeof v === 'string' && v.trim() && !Number.isFinite(Number(v)) ? v : null);
      const at = phraseOf(item.at) ?? phraseOf(op.at) ?? phraseOf(item.when) ?? phraseOf(props.at) ?? phraseOf(item.from);
      delete item.when;
      delete props.at;
      if (at) {
        const t = findPhrase(words, at);
        if (t !== null) item.from = Math.max(0, t - 0.1);
      }
      delete item.at;
      // sensible length when the model gives none or a tiny one
      const def = item.kind === 'effect' ? EFFECTS[item.effect as keyof typeof EFFECTS]?.duration : item.template === 'motion' ? Number(item.duration) || 4 : TEMPLATES[item.template as keyof typeof TEMPLATES]?.duration;
      const dur = Number(item.duration);
      if (def && (!Number.isFinite(dur) || dur < Math.min(1, def))) item.duration = def;
      const from = Number(item.from);
      if (!Number.isFinite(from) || from < 0 || from >= total) item.from = 0;
      if (item.kind === 'text' && !Number(item.track)) item.track = 6;
      // positions given as 0-1 fractions or '50%' strings → 0-100
      if (item.props && typeof item.props === 'object') {
        const p = item.props as Record<string, unknown>;
        for (const k of ['x', 'y']) {
          if (k in p) {
            const v = parseFloat(String(p[k]));
            if (Number.isFinite(v)) p[k] = v > 0 && v <= 1 ? v * 100 : v;
          }
        }
      }
      const key = JSON.stringify([item.kind, item.template, item.effect, Math.round(Number(item.from) * 2), item.props]);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ op: 'add', item });
    } else if (op.op === 'update' || op.op === 'delete' || op.op === 'setName') {
      out.push(op as unknown as EditOp);
    }
  }
  return out;
}

export async function editWithAI(edit: EditProject, instruction: string): Promise<{ edit: EditProject; reply: string; applied: number }> {
  const words = timelineWords(edit);
  const total = Math.max(...edit.items.map((i) => i.from + i.duration), 1);
  const templates = Object.entries(TEMPLATES)
    .map(([id, t]) => `- ${id}: ${t.description}. props: ${t.fields.map((f) => (f.options ? `${f.key} (${f.options.join('|')})` : f.key)).join(', ')}`)
    .join('\n');
  const motion = motionCatalogueForPrompt();
  const effects = Object.entries(EFFECTS)
    .map(([id, e]) => `- ${id}: ${e.description}`)
    .join('\n');

  const prompt = `You are a professional short-form video editor. You edit a timeline by returning JSON operations.
Video: ${edit.width}x${edit.height}, ${total.toFixed(1)} seconds.

CURRENT TIMELINE (id | kind | time | details):
${timelineSummary(edit) || '(empty)'}

TRANSCRIPT (what is said, with start times):
${transcriptSummary(words) || '(no speech)'}

TEXT TEMPLATES — add with kind "text" and "template":
${templates}

EFFECTS — add with kind "effect" and "effect" (they move the footage):
${effects}

MOTION GRAPHICS LIBRARY — add with kind "motion" and "fx" set to EXACTLY one of these ids (never invent ids):
${motion}
Prefer a SEQUENCE when the request describes a storytelling beat (a big number, a chart with a point to make, a map, a quote, a timeline…).

CAPTIONS item: look = karaoke | pop | bold | clean, position = bottom | middle | top.
ART STYLES (for artCard / artFrame / artBanner "style" prop): madhubani, inkWash, shadowPuppet, paperCutout, stainedGlass, anime, warli, blueprint, ukiyoe, miniature. "Make it look like X" usually means adding an artFrame over the whole video plus artBanner captions in that style.

OPERATION SHAPES (replace <...> with real values; never copy placeholders):
add text:   {"op":"add","item":{"kind":"text","template":"<template id>","at":"<exact words from the transcript>","duration":<seconds>,"props":{<template props>}}}
add motion: {"op":"add","item":{"kind":"motion","fx":"<motion id>","at":"<exact words from the transcript>","props":{<params, e.g. "value":40,"label":"…","data":"A:10, B:20">}}}
add effect: {"op":"add","item":{"kind":"effect","effect":"<effect id>","at":"<exact words from the transcript>","duration":<seconds>,"intensity":<0.2-2>}}
change:     {"op":"update","id":"<id from the timeline>","patch":{<fields or "props":{...}>}}
remove:     {"op":"delete","id":"<id from the timeline>"}
rename:     {"op":"setName","name":"<name>"}
"at" = words copied exactly from the transcript; the item starts when they are spoken. Use "from":<seconds> instead only if no words fit.

USER REQUEST: ${instruction}

Do exactly what the user asked and nothing more: one operation per requested change, no extra items, values taken from the request and the transcript.
Reply with ONLY JSON: {"reply":"<one short sentence of what you changed>","ops":[...]}`;

  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Thinking models (qwen3.x, deepseek-r1, gpt-oss) are much faster with thinking off for this structured task
    body: JSON.stringify({
      model: EDIT_MODEL,
      prompt,
      format: 'json',
      stream: false,
      ...(/qwen3|deepseek-r1|gpt-oss|magistral/i.test(EDIT_MODEL) ? { think: false } : {}),
      options: { temperature: 0.1, num_ctx: 8192 },
    }),
    signal: AbortSignal.timeout(1000 * 60 * 5),
  }).catch((err: Error) => {
    throw new Error(`Ollama is not reachable (${err.message}). Start it with "ollama serve".`);
  });
  if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { response: string };
  if (process.env.CLIPFORGE_DEBUG_AI) console.log('[clipforge] AI edit raw reply:', data.response.slice(0, 2000));
  let parsed: { reply?: string; ops?: unknown[] };
  try {
    parsed = JSON.parse(data.response);
  } catch {
    throw new Error('The AI reply was not valid JSON — try rephrasing the request.');
  }
  const ops = normaliseOps(Array.isArray(parsed.ops) ? parsed.ops : [], words, total);
  const { edit: next, applied } = applyOps(edit, ops);
  const reply = applied
    ? String(parsed.reply || `Applied ${applied} change${applied === 1 ? '' : 's'}.`).slice(0, 300)
    : 'I could not turn that into a timeline change — try being more specific (what, where, when).';
  return { edit: next, reply, applied };
}

/** Compact, fixed catalogue for prompts: sequences with their parameters, effect ids grouped by category. */
export function motionCatalogueForPrompt(): string {
  const seqs = Object.values(SEQUENCES).map((q) => `- ${q.id}: ${q.description}. params: ${Object.keys(q.params).join(', ')}`);
  const groups = CATEGORIES.filter((c) => c.id !== 'sequences').map((c) => `${c.label}: ${Object.values(EFFECTS_LIB).filter((e) => e.category === c.id).map((e) => e.id).join(', ')}`);
  return ['SEQUENCES:', ...seqs, 'SINGLE EFFECTS (by category):', ...groups].join('\n');
}
