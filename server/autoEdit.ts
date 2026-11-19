/**
 * "Edit these like that": clips dropped into the editor chat become a finished short.
 *   1. Each clip goes on the main track in the order given; its speech is transcribed (word timings).
 *   2. A base cut, like OpenFilm's footage edits: captions over everything, a hook from the first line, a whip pan
 *      at every cut, an opening punch-in, a progress bar and an end card.
 *   3. The local AI directs the rest from the transcript: motion graphics where the words call for them (a counter
 *      where a number is said, a map where a place is named, a highlight on the key line…), in the look asked for.
 * Every graphic comes from something actually said; nothing is invented. Tags in the request are applied as given.
 */
import path from 'node:path';
import type { CaptionLook, EditItem, EditProject } from '../src/editor/types.ts';
import { BRAND } from '../src/editor/types.ts';
import { EFFECTS, TEMPLATES } from '../src/editor/catalog.ts';
import { EFFECTS_LIB } from '../src/motion/catalog.ts';
import { probeVideo } from './media.ts';
import { transcribeLocal } from './ai.ts';
import { segmentWords } from './hyperframes.ts';
import { newId } from './edits.ts';
import { applyChatTags, editWithAI } from './editAI.ts';
import type { ProgressFn } from './progress.ts';

export interface UploadedClip {
  path: string; // on disk
  name: string; // original file name
  url: string; // /media/uploads/<file>
}

const IMAGE = /\.(png|jpe?g|webp|gif)$/i;
const AUDIO = /\.(mp3|wav|m4a|aac|ogg|flac)$/i;
const round = (n: number) => Math.round(n * 100) / 100;

/** The look the user asked for, by name, and its caption style and style effects. */
function lookOf(instruction: string): { name: string; captions: CaptionLook; fx: string[] } | null {
  const s = instruction.toLowerCase();
  const pick = (name: string, prefix: string, captions: CaptionLook) => ({ name, captions, fx: Object.keys(EFFECTS_LIB).filter((id) => id.startsWith(prefix)) });
  if (/creator|mr ?beast|hormozi|punchy|reel style|kinetic/.test(s)) return pick('Creator Motion Graphics', 'creator', 'pop');
  if (/chalk|blackboard|teacher|lesson/.test(s)) return pick('Chalk Talk', 'chalk', 'clean');
  if (/clean ?tech|product|saas|minimal|apple/.test(s)) return pick('Clean Tech', 'clean', 'bold');
  return null;
}

/** The end of the main track: new clips are added after what is already there. */
const mainEnd = (edit: EditProject) => Math.max(0, ...edit.items.filter((i) => i.track === 0).map((i) => i.from + i.duration));

export async function autoEditFromClips(
  start: EditProject,
  clips: UploadedClip[],
  instruction: string,
  progress: ProgressFn,
  jobId: string,
): Promise<{ edit: EditProject; reply: string; steps: string[]; applied: number }> {
  const wasEmpty = start.items.length === 0;
  const look = lookOf(instruction);
  const items: EditItem[] = [];
  const words: Array<{ text: string; start: number; end: number }> = [];
  const steps: string[] = [];
  const cuts: number[] = [];
  let cursor = round(mainEnd(start));
  let speech = 0;
  let noEngine = '';

  for (const [i, c] of clips.entries()) {
    const label = path.basename(c.name, path.extname(c.name));
    progress('clip', `Reading clip ${i + 1} of ${clips.length}: ${label}`, Math.round(5 + (i / clips.length) * 55));
    if (i > 0 || !wasEmpty) cuts.push(cursor);
    if (IMAGE.test(c.name)) {
      items.push({ id: newId('img'), kind: 'image', name: label, track: 0, from: cursor, duration: 3, src: c.url, fit: 'cover', scale: 1, x: 50, y: 50, motion: 'kenBurns' });
      cursor = round(cursor + 3);
      continue;
    }
    let duration = 10;
    let hasAudio = true;
    try {
      const meta = await probeVideo(c.path);
      duration = meta.duration || duration;
      hasAudio = meta.hasAudio || AUDIO.test(c.name);
    } catch {
      /* unreadable header: keep the defaults */
    }
    duration = round(duration);
    if (AUDIO.test(c.name)) items.push({ id: newId('a'), kind: 'audio', name: label, track: 0, from: cursor, duration, src: c.url, sourceStart: 0, volume: 1 });
    else items.push({ id: newId('v'), kind: 'video', name: label, track: 0, from: cursor, duration, src: c.url, sourceStart: 0, volume: 1, fit: 'cover', zoom: 1, panX: 50, panY: 50 });
    if (hasAudio && !noEngine) {
      progress('transcribe', `Listening to clip ${i + 1} of ${clips.length}`, Math.round(8 + ((i + 0.5) / clips.length) * 55));
      try {
        const segs = await transcribeLocal(c.path, `${jobId}_c${i}`);
        const w = segs.flatMap(segmentWords).filter((x) => x.start < duration);
        for (const x of w) words.push({ text: x.text, start: round(cursor + x.start), end: round(cursor + Math.min(duration, x.end)) });
        speech += w.length;
      } catch (err) {
        noEngine = err instanceof Error ? err.message : 'transcription failed';
      }
    }
    cursor = round(cursor + duration);
  }
  steps.push(`Placed ${clips.length} clip${clips.length === 1 ? '' : 's'} in order (${cursor.toFixed(1)}s)`);

  // ---- the base cut
  const total = cursor;
  const from0 = round(mainEnd(start)); // where the new clips begin
  if (words.length) {
    items.push({ id: newId('cap'), kind: 'captions', name: 'Captions', track: 4, from: from0, duration: round(total - from0), words: words.map((w) => ({ ...w, start: round(w.start - from0), end: round(w.end - from0) })), look: look?.captions ?? 'karaoke', position: 'bottom', accent: BRAND.mint });
    steps.push(`Captioned ${speech} spoken words (${look?.captions ?? 'karaoke'} style)`);
  } else if (noEngine) steps.push(`No captions: ${noEngine}`);
  for (const t of cuts) {
    const e = EFFECTS.whipPan;
    items.push({ id: newId('fx'), kind: 'effect', name: e.label, track: 1, from: round(Math.max(0, t - e.duration / 2)), duration: e.duration, effect: 'whipPan', intensity: 0.8 });
  }
  if (cuts.length) steps.push(`Whip pan at ${cuts.length} cut${cuts.length === 1 ? '' : 's'}`);
  if (wasEmpty) {
    items.push({ id: newId('fx'), kind: 'effect', name: 'Opening punch', track: 1, from: 0, duration: 1.2, effect: 'zoomPunch', intensity: 0.8 });
    // the hook is the first spoken sentence (up to 8 words), else the first clip's name
    const first: string[] = [];
    for (const w of words) {
      first.push(w.text);
      if (first.length >= 8 || /[.!?।]$/.test(w.text)) break;
    }
    const hook = first.join(' ').replace(/[.,!?।]+$/, '') || path.basename(clips[0].name, path.extname(clips[0].name)).replace(/[_-]+/g, ' ');
    items.push({ id: newId('t'), kind: 'text', name: 'Hook', track: 3, from: 0, duration: Math.min(3.5, total), template: 'hook', props: { ...TEMPLATES.hook.defaults, text: hook } });
    items.push({ id: newId('t'), kind: 'text', name: 'Progress', track: 2, from: 0, duration: total, template: 'progressBar', props: { position: 'top' } });
    if (total > 8) items.push({ id: newId('t'), kind: 'text', name: 'End card', track: 5, from: round(total - 2.5), duration: 2.5, template: 'cta', props: { ...TEMPLATES.cta.defaults } });
    steps.push(`Hook title "${hook}", opening punch-in, progress bar${total > 8 ? ', end card' : ''}`);
  }
  let edit: EditProject = { ...start, items: [...start.items, ...items] };
  let applied = items.length;

  // ---- tags written in the request go on as given (at the start of the new clips)
  const tagged = applyChatTags(edit, instruction, [], from0);
  if (tagged.applied) {
    edit = tagged.edit;
    applied += tagged.applied;
    steps.push(...tagged.steps);
  }

  // ---- the AI directs the rest from what is said
  if (!words.length) return { edit, reply: 'Cut together. There was no speech to direct graphics from, so I left the motion graphics to you.', steps, applied };
  progress('direct', 'Directing motion graphics from the transcript', 75);
  const ask = (tagged.applied ? tagged.rest : instruction).trim() || 'Edit these into a punchy short.';
  const brief = `${ask}

This timeline was just built from ${clips.length} uploaded clip${clips.length === 1 ? '' : 's'} with captions, a hook, cut transitions, a progress bar and an end card already on it. Now direct it like a professional short-form editor: add 3 to 6 motion graphics where the words call for them — a counter or big stat where a number is said, a map where a place or country is named, a marker highlight or statement on the strongest line, a lower third when someone introduces themselves, zoom punches on punchlines.${look ? ` Use the ${look.name} look for the graphics (${look.fx.join(', ')}).` : ''} Every graphic must come from words actually said: use "at" with the exact words. Do not remove or move the footage or captions.`;
  try {
    const before = new Set(edit.items.map((i) => i.id));
    const r = await editWithAI(edit, brief, []);
    if (r.applied) {
      const g = groundStyleGraphics(r.edit, before, words);
      edit = g.edit;
      applied += r.applied - g.dropped;
      steps.push(...r.steps, ...g.notes);
      const gfx = edit.items.filter((i) => !before.has(i.id) && i.kind === 'text' && i.template === 'motion').length;
      // our own summary: the model's reply can name things the grounding pass took out
      return { edit, reply: `Done: ${clips.length} clip${clips.length === 1 ? '' : 's'} cut together with captions${gfx ? `, and ${gfx} motion graphic${gfx === 1 ? '' : 's'} where the words call for them` : ''}. Ctrl+Z undoes it all.`, steps, applied };
    }
    return { edit, reply: 'Cut together with captions. The AI found nothing it could add as a graphic — ask for one by name, or type [ to pick an effect.', steps, applied };
  } catch (err) {
    return { edit, reply: `Cut together with captions. The AI step was skipped: ${err instanceof Error ? err.message : 'it failed'}.`, steps, applied };
  }
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}%]+/gu, ' ').trim();
const NUMS: Record<string, string> = { zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10', twenty: '20', thirty: '30', forty: '40', fifty: '50', hundred: '100', thousand: '1000', percent: '%' };
const MISTAKE = /\b(waste|wasting|wrong|mistake|don'?t|never|stop|instead|myth|fail|failed|avoid|nahi|mat|galat)\b/i;

/**
 * Keep the AI's new Creator / Chalk / Clean Tech graphics true to what was said: wording nobody said is removed,
 * a "wrong idea" needs the speaker to call something a mistake nearby, a one-bar chart becomes a counter, and a
 * phrase the model split across label and text is joined back when it was said that way.
 */
function groundStyleGraphics(edit: EditProject, before: Set<string>, words: Array<{ text: string; start: number; end: number }>) {
  const said = ` ${norm(words.map((w) => NUMS[norm(w.text)] ?? w.text).join(' '))} `;
  const saidRaw = ` ${norm(words.map((w) => w.text).join(' '))} `;
  const grounded = (v: unknown) => {
    const ws = norm(String(v ?? '')).split(' ').filter((w) => w.length > 2 && !/^\d+%?$/.test(w));
    if (!ws.length) return true; // numbers and tiny words: fine
    return ws.filter((w) => said.includes(` ${w} `) || saidRaw.includes(` ${w} `)).length / ws.length >= 0.6;
  };
  const near = (t: number) => words.filter((w) => w.start > t - 3 && w.start < t + 4).map((w) => w.text).join(' ');
  const notes: string[] = [];
  let dropped = 0;
  const items: EditItem[] = [];
  for (const it of edit.items) {
    const props = it.kind === 'text' && it.template === 'motion' ? (it.props as Record<string, string | number>) : null;
    const def = props ? EFFECTS_LIB[String(props.fx)] : undefined;
    if (before.has(it.id) || !props || def?.category !== 'styles') {
      items.push(it);
      continue;
    }
    const p = { ...props };
    if (def.base === 'nafayWrong' && !MISTAKE.test(`${p.text ?? ''} ${near(it.from)}`)) {
      dropped++;
      notes.push(`Left out "${p.text}" as a wrong idea: the speaker doesn't call it a mistake`);
      continue;
    }
    const bars = String(p.data ?? '').split(',').filter((x) => x.includes(':'));
    const realLabels = bars.every((b) => { const l = b.split(':')[0].trim(); return l.length > 2 && grounded(l); });
    if (def.base === 'nafayBars' && (bars.length < 2 || !realLabels)) {
      // a chart needs two or more values with labels somebody said; a guessed one would mislead
      dropped++;
      notes.push(`Left out a chart with ${bars.length < 2 ? 'only one value' : 'labels nobody says'}`);
      continue;
    }
    if (def.base === 'nafayCounter' && !p.suffix && /(percent|per cent|%|pratishat)/i.test(near(it.from))) p.suffix = '%';
    if (p.label && p.text && said.includes(` ${norm(`${p.label} ${p.text}`)} `)) {
      p.text = `${p.label} ${p.text}`;
      delete p.label;
    }
    for (const k of ['sub', 'label', 'title'] as const) {
      if (p[k] !== undefined && !grounded(p[k])) {
        notes.push(`Removed the unspoken line "${p[k]}"`);
        delete p[k];
      }
    }
    if (p.text !== undefined && !grounded(p.text)) {
      dropped++;
      notes.push(`Left out "${p.text}": nobody says that`);
      continue;
    }
    items.push({ ...it, props: p } as EditItem);
  }
  // full-frame style graphics must not cover each other: a later one moves to just after, or is left out
  const total = Math.max(0, ...items.filter((i) => i.track === 0).map((i) => i.from + i.duration));
  const isStyled = (i: EditItem) => i.kind === 'text' && i.template === 'motion' && EFFECTS_LIB[String((i.props as Record<string, unknown>).fx)]?.category === 'styles';
  const styled = items.filter(isStyled).sort((a, b) => a.from - b.from);
  let end = 0;
  const gone = new Set<string>();
  for (const it of styled) {
    if (it.from < end - 0.05) {
      if (end + it.duration <= total + 0.05) {
        notes.push(`Moved "${it.name}" to ${end.toFixed(1)}s so it doesn't cover another graphic`);
        it.from = round(end);
      } else {
        gone.add(it.id);
        dropped++;
        notes.push(`Left out "${it.name}": no room without covering another graphic`);
        continue;
      }
    }
    end = it.from + it.duration;
  }
  return { edit: { ...edit, items: items.filter((i) => !gone.has(i.id)) }, dropped, notes };
}
