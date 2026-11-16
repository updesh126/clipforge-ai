/** Pure timeline helpers used by the editor UI. */
import type { EditItem, EditProject, ItemKind } from './types.ts';
import { EFFECTS, TEMPLATES } from './catalog.ts';
import type { EffectId, TemplateId } from './types.ts';

export const uid = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const r2 = (n: number) => Math.round(n * 100) / 100;

export const KIND_STYLE: Record<ItemKind, { label: string; bar: string; text: string }> = {
  video: { label: 'Video', bar: 'bg-sky-500/25 border-sky-400/60', text: 'text-sky-200' },
  audio: { label: 'Audio', bar: 'bg-emerald-500/25 border-emerald-400/60', text: 'text-emerald-200' },
  image: { label: 'Image', bar: 'bg-amber-500/25 border-amber-400/60', text: 'text-amber-200' },
  text: { label: 'Graphic', bar: 'bg-lavender/25 border-lavender/70', text: 'text-lavender' },
  captions: { label: 'Captions', bar: 'bg-accent/20 border-accent/70', text: 'text-accent' },
  effect: { label: 'Effect', bar: 'bg-pink/20 border-pink/70', text: 'text-pink' },
};

export function itemLabel(i: EditItem): string {
  if (i.name) return i.name;
  if (i.kind === 'text') return TEMPLATES[i.template]?.label ?? i.template;
  if (i.kind === 'effect') return EFFECTS[i.effect]?.label ?? i.effect;
  return KIND_STYLE[i.kind].label;
}

export function topTrack(edit: EditProject) {
  return edit.items.reduce((m, i) => Math.max(m, i.track), 0);
}

export function newTemplateItem(template: TemplateId, from: number, track: number): EditItem {
  const t = TEMPLATES[template];
  return { id: uid('t'), kind: 'text', name: t.label, track, from: r2(from), duration: t.duration, template, props: { ...t.defaults } };
}

export function newEffectItem(effect: EffectId, from: number): EditItem {
  return { id: uid('fx'), kind: 'effect', name: EFFECTS[effect].label, track: 1, from: r2(from), duration: EFFECTS[effect].duration, effect, intensity: 1 };
}

/** Split an item at absolute time t. Returns null when t is outside the item. */
export function splitItem(item: EditItem, t: number): [EditItem, EditItem] | null {
  const local = t - item.from;
  if (local <= 0.05 || local >= item.duration - 0.05) return null;
  const a = { ...item, duration: r2(local) } as EditItem;
  const b = { ...item, id: uid('s'), from: r2(t), duration: r2(item.duration - local) } as EditItem;
  if (b.kind === 'video' || b.kind === 'audio') b.sourceStart = r2(b.sourceStart + local);
  if (a.kind === 'captions' && b.kind === 'captions') {
    a.words = a.words.filter((w) => w.start < local);
    b.words = item.kind === 'captions' ? item.words.filter((w) => w.start >= local).map((w) => ({ ...w, start: r2(w.start - local), end: r2(w.end - local) })) : [];
  }
  return [a, b];
}
