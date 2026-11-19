/**
 * Editor projects: storage, "auto-edit from clip", and safe application of edit operations
 * (from the UI or from the local LLM).
 */
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, UPLOADS_DIR } from './store.ts';
import type { ClipCandidate, ClipProject } from './types.ts';
import { segmentWords } from './hyperframes.ts';
import type { CaptionLook, EditItem, EditProject, EffectId, ImageItem, TemplateId } from '../src/editor/types.ts';
import { BRAND, FRAME_SIZES, editDuration } from '../src/editor/types.ts';
import { EFFECTS, TEMPLATES } from '../src/editor/catalog.ts';
import { isMotionId } from '../src/motion/sequences.ts';

const EDITS_FILE = path.join(DATA_DIR, 'edits.json');

export function readEdits(): EditProject[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(EDITS_FILE, 'utf-8')) as { edits?: EditProject[] };
    return Array.isArray(parsed.edits) ? parsed.edits : [];
  } catch {
    return [];
  }
}

function writeEdits(edits: EditProject[]) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(EDITS_FILE, JSON.stringify({ edits }, null, 2), 'utf-8');
}

export function getEdit(id: string) {
  return readEdits().find((e) => e.id === id);
}

export function saveEdit(edit: EditProject): EditProject {
  const clean = { ...edit, items: sanitiseItems(edit.items, edit), updatedAt: new Date().toISOString() };
  const all = readEdits();
  const i = all.findIndex((e) => e.id === edit.id);
  if (i >= 0) all[i] = clean;
  else all.unshift(clean);
  writeEdits(all);
  return clean;
}

export function deleteEdit(id: string): boolean {
  const all = readEdits();
  if (!all.some((e) => e.id === id)) return false;
  writeEdits(all.filter((e) => e.id !== id));
  return true;
}

export const newId = (p: string) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function blankEdit(name = 'Untitled edit', aspect = '9:16'): EditProject {
  const [width, height] = FRAME_SIZES[aspect] ?? FRAME_SIZES['9:16'];
  const now = new Date().toISOString();
  return { id: newId('edit'), name, width, height, fps: 30, background: '#000000', items: [], createdAt: now, updatedAt: now };
}

/** Build a ready-to-post edit from an AI clip: footage, karaoke captions, hook banner, progress bar, zoom punch, end card. */
export function editFromClip(project: ClipProject, clip: ClipCandidate): EditProject {
  const edit = blankEdit(clip.title || project.name, clip.aspectRatio || '9:16');
  edit.sourceProjectId = project.id;
  edit.sourceClipId = clip.id;
  const len = Math.max(1, clip.end - clip.start);
  const src = `/media/uploads/${project.sourceFileName}`;

  const words = project.transcript
    .filter((s) => s.end > clip.start && s.start < clip.end)
    .flatMap(segmentWords)
    .filter((w) => w.end > clip.start && w.start < clip.end)
    .map((w) => ({ text: w.text, start: round(Math.max(0, w.start - clip.start)), end: round(Math.min(len, w.end - clip.start)) }));

  // the styled clip looks have no editor twin yet: creator → pop, chalk → clean, cleantech → bold
  const cs = clip.captionStyle;
  const look: CaptionLook = cs === 'pop' || cs === 'creator' ? 'pop' : cs === 'clean' || cs === 'chalk' ? 'clean' : cs === 'highlight' || cs === 'cleantech' ? 'bold' : 'karaoke';
  const items: EditItem[] = [
    {
      id: newId('v'),
      kind: 'video',
      name: 'Footage',
      track: 0,
      from: 0,
      duration: round(len),
      src,
      previewSrc: project.videoUrl && project.videoUrl !== src ? project.videoUrl : undefined,
      sourceStart: clip.start,
      volume: 1,
      fit: clip.framing === 'fit' ? 'contain' : 'cover',
      zoom: clip.zoom ?? 1,
      panX: clip.cropX ?? 50,
      panY: clip.cropY ?? 50,
    },
    { id: newId('fx'), kind: 'effect', name: 'Opening punch', track: 1, from: 0, duration: 1.2, effect: 'zoomPunch', intensity: 0.8 },
    { id: newId('t'), kind: 'text', name: 'Progress', track: 2, from: 0, duration: round(len), template: 'progressBar', props: { position: 'top' } },
    { id: newId('t'), kind: 'text', name: 'Hook', track: 3, from: 0, duration: Math.min(3.5, len), template: 'hook', props: { ...TEMPLATES.hook.defaults, text: clip.title } },
  ];
  if (words.length && clip.captionStyle !== 'off') {
    items.push({ id: newId('cap'), kind: 'captions', name: 'Captions', track: 4, from: 0, duration: round(len), words, look, position: 'bottom', accent: BRAND.mint });
  }
  // Second punch-in on the first sentence that starts after the hook
  const mid = words.find((w, i) => i > 0 && w.start > 4 && /[.!?]$/.test(words[i - 1].text));
  if (mid && mid.start < len - 3) {
    items.push({ id: newId('fx'), kind: 'effect', name: 'Punch', track: 1, from: mid.start, duration: 1.2, effect: 'zoomPunch', intensity: 0.6 });
  }
  if (len > 8) {
    items.push({ id: newId('t'), kind: 'text', name: 'End card', track: 5, from: round(len - 2.5), duration: 2.5, template: 'cta', props: { ...TEMPLATES.cta.defaults } });
  }
  edit.items = items;
  return edit;
}

const round = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: unknown, lo: number, hi: number, d: number) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d;
};

/** Only allow media URLs we serve ourselves (no remote fetches during render). */
function safeSrc(src: unknown): string | null {
  const s = String(src ?? '');
  if (/^\/media\/(uploads|exports|generated)\/[^/\\]+$/.test(s)) return s; // generated = Stable Diffusion paintings
  // asset library PNG / SVG / Lottie JSON (sub-folders allowed, no traversal)
  if (/^\/media\/assets\/[A-Za-z0-9%._\-/]+\.(png|svg|json)$/i.test(s) && !s.includes('..')) return s;
  return null;
}

/** Optional media playback fields: speed (0.25–4×) and audio fades in seconds. */
const mediaExtras = (raw: Record<string, unknown>) => ({
  ...(raw.speed !== undefined && Number(raw.speed) !== 1 ? { speed: clamp(raw.speed, 0.25, 4, 1) } : {}),
  ...(Number(raw.fadeIn) > 0 ? { fadeIn: round(clamp(raw.fadeIn, 0, 60, 0)) } : {}),
  ...(Number(raw.fadeOut) > 0 ? { fadeOut: round(clamp(raw.fadeOut, 0, 60, 0)) } : {}),
});

const MOTIONS = ['none', 'pop', 'walkIn', 'walkOut', 'walkAcross', 'bob', 'sway', 'float', 'fly', 'breathe', 'slideUp', 'kenBurns'];

/** Validate and normalise items (UI and LLM input both pass through here). */
export function sanitiseItems(items: unknown, edit: Pick<EditProject, 'items'>): EditItem[] {
  if (!Array.isArray(items)) return edit.items;
  const out: EditItem[] = [];
  for (const raw of items as Array<Record<string, unknown>>) {
    const item = sanitiseItem(raw);
    if (item) out.push(item);
  }
  return out;
}

export function sanitiseItem(raw: Record<string, unknown>): EditItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const base = {
    id: typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 40) : newId('i'),
    name: typeof raw.name === 'string' ? raw.name.slice(0, 60) : undefined,
    track: Math.round(clamp(raw.track, 0, 20, 1)),
    from: round(clamp(raw.from, 0, 36000, 0)),
    duration: round(clamp(raw.duration, 0.1, 36000, 3)),
  };
  switch (raw.kind) {
    case 'video': {
      const src = safeSrc(raw.src);
      if (!src) return null;
      return {
        ...base,
        kind: 'video',
        src,
        previewSrc: safeSrc(raw.previewSrc) ?? undefined,
        sourceStart: round(clamp(raw.sourceStart, 0, 360000, 0)),
        volume: clamp(raw.volume, 0, 2, 1),
        fit: raw.fit === 'contain' ? 'contain' : 'cover',
        zoom: clamp(raw.zoom, 1, 3, 1),
        panX: clamp(raw.panX, 0, 100, 50),
        panY: clamp(raw.panY, 0, 100, 50),
        ...mediaExtras(raw),
      };
    }
    case 'audio': {
      const src = safeSrc(raw.src);
      if (!src) return null;
      return { ...base, kind: 'audio', src, sourceStart: round(clamp(raw.sourceStart, 0, 360000, 0)), volume: clamp(raw.volume, 0, 2, 1), ...mediaExtras(raw) };
    }
    case 'image': {
      const src = safeSrc(raw.src);
      if (!src) return null;
      return {
        ...base,
        kind: 'image',
        src,
        fit: raw.fit === 'contain' ? 'contain' : 'cover',
        scale: clamp(raw.scale, 0.03, 2, 1),
        x: clamp(raw.x, -50, 150, 50),
        y: clamp(raw.y, -50, 150, 50),
        anchor: raw.anchor === 'bottom' ? 'bottom' : undefined,
        motion: MOTIONS.includes(String(raw.motion)) ? (raw.motion as ImageItem['motion']) : undefined,
        flip: raw.flip === true ? true : undefined,
        depth: raw.depth === undefined ? undefined : clamp(raw.depth, 0, 1.6, 1),
        assetId: typeof raw.assetId === 'string' ? raw.assetId.slice(0, 80) : undefined,
        look: typeof raw.look === 'string' && /^[a-zA-Z]{2,20}$/.test(raw.look) ? raw.look : undefined,
        vector:
          raw.vector && typeof raw.vector === 'object'
            ? (() => {
                const v = raw.vector as Record<string, unknown>;
                const ok = (x: unknown) => typeof x === 'string' && /^[a-zA-Z0-9-]{1,40}$/.test(x);
                return ok(v.cast) && ok(v.pose) && ok(v.expression) && ok(v.theme) ? { cast: v.cast as string, pose: v.pose as string, expression: v.expression as string, theme: v.theme as string } : undefined;
              })()
            : undefined,
      };
    }
    case 'text': {
      const template = String(raw.template) as TemplateId;
      if (!(template in TEMPLATES)) return null;
      const props: Record<string, string | number | boolean> = { ...TEMPLATES[template].defaults };
      const given = (raw.props && typeof raw.props === 'object' ? raw.props : {}) as Record<string, unknown>;
      if (template === 'motion') {
        if (!isMotionId(given.fx)) return null;
        for (const [k, v] of Object.entries(given).slice(0, 60)) {
          if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,30}$/.test(k)) continue;
          if (typeof v === 'number' && Number.isFinite(v)) props[k] = Math.max(-1e12, Math.min(1e12, v));
          else if (typeof v === 'boolean') props[k] = v;
          else if (typeof v === 'string') props[k] = v.slice(0, 600);
        }
        return { ...base, kind: 'text', template, props };
      }
      for (const f of TEMPLATES[template].fields) {
        const v = given[f.key];
        if (v === undefined) continue;
        props[f.key] = f.type === 'number' ? clamp(v, f.min ?? -1e6, f.max ?? 1e6, Number(props[f.key]) || 0) : String(v).slice(0, 200);
      }
      return { ...base, kind: 'text', template, props };
    }
    case 'captions': {
      const words = Array.isArray(raw.words)
        ? (raw.words as Array<Record<string, unknown>>)
            .map((w) => ({ text: String(w.text ?? '').slice(0, 40), start: round(clamp(w.start, 0, 36000, 0)), end: round(clamp(w.end, 0, 36000, 0)) }))
            .filter((w) => w.text && w.end > w.start)
            .slice(0, 20000)
        : [];
      const look = ['karaoke', 'pop', 'bold', 'clean'].includes(String(raw.look)) ? (raw.look as CaptionLook) : 'karaoke';
      const position = raw.position === 'top' || raw.position === 'middle' ? raw.position : 'bottom';
      const accent = /^#[0-9a-f]{3,8}$/i.test(String(raw.accent)) ? String(raw.accent) : BRAND.mint;
      return { ...base, kind: 'captions', words, look, position, accent };
    }
    case 'effect': {
      const effect = String(raw.effect) as EffectId;
      if (!(effect in EFFECTS)) return null;
      return { ...base, kind: 'effect', effect, intensity: clamp(raw.intensity, 0.2, 2, 1) };
    }
    default:
      return null;
  }
}

/** Operations the LLM may return. */
export type EditOp =
  | { op: 'add'; item: Record<string, unknown> }
  | { op: 'update'; id: string; patch: Record<string, unknown> }
  | { op: 'delete'; id: string }
  | { op: 'setName'; name: string };

export function applyOps(edit: EditProject, ops: EditOp[]): { edit: EditProject; applied: number } {
  let items = [...edit.items];
  let name = edit.name;
  let applied = 0;
  for (const op of ops.slice(0, 40)) {
    if (!op || typeof op !== 'object') continue;
    if (op.op === 'add' && op.item) {
      const it = sanitiseItem({ ...op.item, id: newId('ai') });
      if (it) {
        items.push(it);
        applied++;
      }
    } else if (op.op === 'update' && op.id) {
      const i = items.findIndex((x) => x.id === op.id);
      if (i < 0) continue;
      const cur = items[i] as unknown as Record<string, unknown>;
      const patch = { ...(op.patch || {}) };
      delete patch.id;
      delete patch.kind;
      if (patch.props && typeof patch.props === 'object') patch.props = { ...(cur.props as object), ...(patch.props as object) };
      const next = sanitiseItem({ ...cur, ...patch, id: cur.id as string, kind: cur.kind });
      if (next) {
        items[i] = next;
        applied++;
      }
    } else if (op.op === 'delete' && op.id) {
      const before = items.length;
      items = items.filter((x) => x.id !== op.id);
      if (items.length < before) applied++;
    } else if (op.op === 'setName' && op.name) {
      name = String(op.name).slice(0, 80);
      applied++;
    }
  }
  return { edit: { ...edit, name, items }, applied };
}

/** Register a file on disk as editor media (linked, not copied). */
export function linkMediaFile(srcPath: string): { url: string; fileName: string } {
  const ext = path.extname(srcPath) || '';
  const base = path.basename(srcPath, ext).replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40) || 'media';
  const fileName = `asset_${Date.now()}_${base}${ext}`;
  const dest = path.join(UPLOADS_DIR, fileName);
  try {
    fs.symlinkSync(srcPath, dest);
  } catch {
    try {
      fs.linkSync(srcPath, dest);
    } catch {
      fs.copyFileSync(srcPath, dest); // different drive and no symlink rights
    }
  }
  return { url: `/media/uploads/${fileName}`, fileName };
}

export { editDuration };
