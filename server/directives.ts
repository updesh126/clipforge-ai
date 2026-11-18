/**
 * Script directives: [tags] in a script tell ClipForge which motion graphic, camera move, transition or atmosphere
 * to use for a scene. They are never spoken or shown in captions.
 *
 *   India now has 900 million internet users. [bigStat value=900 suffix=" million" label="India now has" text="internet users"]
 *   The storm hits the village. [rainFx] [shake] [transition: paperTearTransition]
 *
 * Forms:   [name]   [name key=value key="two words"]   [kind: name …]   [move]   [still]   [title: My headline]
 * kinds:   motion | effect | graphic | sequence | camera | transition | atmosphere   (optional — the name says what it is)
 * Names match ids or display names, ignoring case, spaces and dashes ("Big statistic reveal" = bigStat).
 * Full list: docs/site/script-tags.md (npm run tags-doc).
 */
import { EFFECTS_LIB } from '../src/motion/catalog.ts';
import { SEQUENCES } from '../src/motion/sequences.ts';
import { EFFECTS } from '../src/editor/catalog.ts';

export type DirectiveKind = 'sequence' | 'graphic' | 'camera' | 'transition' | 'atmosphere' | 'move' | 'still' | 'title';

export interface Directive {
  kind: DirectiveKind;
  id: string; // catalogue id (or the title text for kind "title")
  params: Record<string, string | number>;
  raw: string; // what was written, for messages
}

export interface SceneWithDirectives {
  text: string; // narration without tags
  directives: Directive[];
  unknown: string[]; // tags that matched nothing
}

/** Camera moves that become the scene's planned camera; others (zoomPunch, shake, slowZoom) are added on top. */
export const PLANNED_CAMERAS = ['pushIn', 'pullOut', 'panLeft', 'panRight', 'tiltUp'];
const CUT_EFFECTS = ['whipPan', 'irisWipe', 'flash', 'fadeIn', 'fadeOut'];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

type Entry = { kind: DirectiveKind; id: string };
let index: Map<string, Entry> | null = null;
function lookup(): Map<string, Entry> {
  if (index) return index;
  index = new Map();
  const add = (key: string, e: Entry) => {
    const k = norm(key);
    if (k && !index!.has(k)) index!.set(k, e);
  };
  for (const s of Object.values(SEQUENCES)) add(s.id, { kind: 'sequence', id: s.id });
  for (const id of Object.keys(EFFECTS)) add(id, { kind: CUT_EFFECTS.includes(id) ? 'transition' : 'camera', id });
  for (const fx of Object.values(EFFECTS_LIB)) add(fx.id, { kind: fx.category === 'transitions' ? 'transition' : fx.category === 'atmosphere' ? 'atmosphere' : 'graphic', id: fx.id });
  // display names second, so ids always win
  for (const s of Object.values(SEQUENCES)) add(s.label, { kind: 'sequence', id: s.id });
  for (const [id, e] of Object.entries(EFFECTS)) add(e.label, { kind: CUT_EFFECTS.includes(id) ? 'transition' : 'camera', id });
  for (const fx of Object.values(EFFECTS_LIB)) add(fx.label, { kind: fx.category === 'transitions' ? 'transition' : fx.category === 'atmosphere' ? 'atmosphere' : 'graphic', id: fx.id });
  return index;
}

/** key=value pairs; values may be "quoted", 'quoted' or a bare token; numbers become numbers. */
function parseParams(s: string): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const m of s.matchAll(/([A-Za-z][\w]*)\s*=\s*("([^"]*)"|'([^']*)'|“([^”]*)”|([^\s\]]+))/g)) {
    const v = m[3] ?? m[4] ?? m[5] ?? m[6] ?? '';
    out[m[1]] = /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v;
  }
  return out;
}

/** Parse one tag body (without the brackets). Returns null when nothing matches. */
export function parseTag(body: string): Directive | null {
  const raw = body.trim();
  if (/^(move|moving|animate)$/i.test(raw)) return { kind: 'move', id: 'move', params: {}, raw };
  if (/^(still|no motion|static)$/i.test(raw)) return { kind: 'still', id: 'still', params: {}, raw };
  const title = raw.match(/^title\s*:\s*(.+)$/i);
  if (title) return { kind: 'title', id: title[1].trim().replace(/^["“]|["”]$/g, ''), params: {}, raw };
  const kind = raw.match(/^(motion|effect|graphic|sequence|camera|transition|atmosphere)\s*:\s*/i);
  const rest = kind ? raw.slice(kind[0].length) : raw;
  const firstParam = rest.search(/\s[A-Za-z][\w]*\s*=/);
  const name = (firstParam >= 0 ? rest.slice(0, firstParam) : rest).trim();
  const params = firstParam >= 0 ? parseParams(rest.slice(firstParam)) : {};
  const hit = lookup().get(norm(name));
  if (!hit) return null;
  return { kind: hit.kind, id: hit.id, params, raw };
}

const OPEN = '';
const CLOSE = '';

/**
 * Replace [tags] with short tokens (so sentence splitting can't break them) and move each token in front of the
 * sentence end it follows ("users. [bigStat]" → "users⟦0⟧."), so a tag stays with its own sentence.
 */
export function tokeniseScript(script: string): { script: string; tags: string[] } {
  const tags: string[] = [];
  let s = script.replace(/\[([^[\]\n]{1,600})\]/g, (_m, body: string) => `${OPEN}${tags.push(body) - 1}${CLOSE}`);
  const tok = `${OPEN}\\d+${CLOSE}`;
  const re = new RegExp(`([.!?…।॥]["')\\]]*)((?:\\s*${tok})+)`, 'g');
  s = s.replace(re, (_m, end: string, toks: string) => `${toks.replace(/\s+/g, '')}${end}`);
  return { script: s, tags };
}

/** Pull the tokens out of each split scene; tag-only scenes give their tags to the scene before. */
export function scenesWithDirectives(scenes: string[], tags: string[]): SceneWithDirectives[] {
  const tokRe = new RegExp(`${OPEN}(\\d+)${CLOSE}`, 'g');
  const out: SceneWithDirectives[] = [];
  for (const s of scenes) {
    const directives: Directive[] = [];
    const unknown: string[] = [];
    for (const m of s.matchAll(tokRe)) {
      const body = tags[Number(m[1])] ?? '';
      const d = parseTag(body);
      if (d) directives.push(d);
      else unknown.push(body);
    }
    const text = s.replace(tokRe, ' ').replace(/\s+([.,!?;:…])/g, '$1').replace(/\s{2,}/g, ' ').trim();
    if (!text.replace(/[.,!?;:…\s]/g, '') && out.length) {
      out[out.length - 1].directives.push(...directives);
      out[out.length - 1].unknown.push(...unknown);
      continue;
    }
    out.push({ text, directives, unknown });
  }
  // a script that starts with a tag-only line: give those tags to the first real scene
  while (out.length > 1 && !out[0].text.replace(/[.,!?;:…\s]/g, '')) {
    out[1].directives.unshift(...out[0].directives);
    out[1].unknown.unshift(...out[0].unknown);
    out.shift();
  }
  return out;
}

/** Plain text of a script without any [tags] (for word counts, previews). */
export const stripTags = (script: string) => script.replace(/\[[^[\]\n]{1,600}\]/g, ' ').replace(/[ \t]{2,}/g, ' ');
