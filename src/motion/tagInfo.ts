/**
 * Every [tag] the chat and scripts understand, with a short description, the values it takes (in order) and a
 * ready-to-edit example built from its own defaults. Metadata only, shared by the chat picker and the server.
 */
import { argsFor, CATEGORIES, EFFECTS_LIB } from './catalog.ts';
import { SEQUENCES } from './sequences.ts';
import { EFFECTS } from '../editor/catalog.ts';

export interface TagInfo {
  id: string;
  label: string;
  description: string;
  group: string; // category label, e.g. "Creator · Chalk · Clean Tech", "Camera"
  args: string[]; // values in order
  usage: string; // e.g. [chalkCounter 30 "of its data" "can lose up to" %]
}

const quote = (v: unknown) => {
  const s = String(v);
  return typeof v === 'number' || /^[^\s"\][]+$/.test(s) ? s : `"${s.replace(/"/g, "'")}"`;
};

/** Bare values in order, stopping at the first setting without an example value (values can't skip a place). */
function example(id: string, keys: string[], values: Record<string, unknown>): string {
  const out: string[] = [];
  for (const k of keys) {
    const v = values[k];
    if (v === undefined || v === '') break;
    out.push(quote(v));
  }
  return `[${id}${out.length ? ' ' + out.join(' ') : ''}]`;
}

const CAMERA_ARGS = ['intensity'];
let cache: TagInfo[] | null = null;

export function allTags(): TagInfo[] {
  if (cache) return cache;
  const groupOf = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));
  const seqs: TagInfo[] = Object.values(SEQUENCES).map((s) => {
    const args = s.fields.filter((f) => f.type === 'text' || f.type === 'number').map((f) => f.key);
    return { id: s.id, label: s.label, description: s.description, group: 'Sequences', args, usage: example(s.id, args, s.params) };
  });
  const fx: TagInfo[] = Object.values(EFFECTS_LIB).map((e) => {
    const args = argsFor(e.id);
    return { id: e.id, label: e.label, description: e.description, group: groupOf[e.category] ?? e.category, args, usage: example(e.id, args, e.defaults) };
  });
  const cams: TagInfo[] = Object.entries(EFFECTS).map(([id, e]) => ({ id, label: e.label, description: e.description, group: 'Camera & cuts', args: CAMERA_ARGS, usage: `[${id}]` }));
  // the Nafay looks first: they are what people ask for by name
  cache = [...fx.filter((t) => t.group.startsWith('Creator')), ...seqs, ...fx.filter((t) => !t.group.startsWith('Creator')), ...cams];
  return cache;
}

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9%]+/).filter((w) => w.length > 1);
const STOP = new Set(['add', 'the', 'a', 'an', 'to', 'at', 'in', 'on', 'of', 'for', 'and', 'with', 'make', 'please', 'show', 'put', 'me', 'it', 'this', 'that', 'some', 'use']);

/** Tags that best match some words ("chalk counter", "map of india", "number goes up"). Empty query = everything. */
export function searchTags(query: string, limit = 8): TagInfo[] {
  const q = words(query).filter((w) => !STOP.has(w));
  const list = allTags();
  if (!q.length) return list.slice(0, limit);
  const scored = list
    .map((t) => {
      const id = t.id.toLowerCase(), label = t.label.toLowerCase(), text = `${label} ${t.description.toLowerCase()} ${t.group.toLowerCase()}`;
      let s = 0;
      for (const w of q) {
        if (id === w) s += 12;
        else if (id.startsWith(w)) s += 7;
        else if (id.includes(w)) s += 5;
        if (label.split(/\s+/).includes(w)) s += 4;
        else if (text.includes(w)) s += 2;
      }
      return { t, s };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);
  return scored.slice(0, limit).map((x) => x.t);
}
