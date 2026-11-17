import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Player } from '@remotion/player';
import { Check, Plus, Search } from 'lucide-react';
import { AbsoluteFill } from 'remotion';
import { MotionFx } from '../motion/MotionFx.tsx';
import { EditorComposition } from '../remotion/EditorComposition.tsx';
import type { EditItem, EditProject, EffectId } from './types.ts';

/**
 * Library browser shared by the Motion and Effects tabs.
 * Click a card = preview it (nothing changes on the timeline). The + button (or "Add at playhead") = add it.
 */
export interface FxEntry {
  id: string;
  label: string;
  description: string;
  group: string;
  duration: number;
  /** motion = overlay graphic (src/motion); camera = effect item that moves the picture layers */
  kind: 'motion' | 'camera';
}

export interface FxGroup {
  id: string;
  label: string;
  blurb?: string;
}

const MotionPreview = ({ fx }: { fx: string }) => (
  <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 30%, #2b3443, #0d1117)' }}>
    <MotionFx props={{ fx }} />
  </AbsoluteFill>
);

// ---- sample scene for camera effects: three layers at different depths so parallax is visible
const svg = (body: string) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice">${body}</svg>`)}`;
const SKY = svg(
  '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b3a67"/><stop offset="1" stop-color="#f4c7a8"/></linearGradient></defs><rect width="1000" height="1000" fill="url(#g)"/><circle cx="700" cy="330" r="90" fill="#fbdfcb"/>',
);
const HILLS = svg('<path d="M0 640 Q250 470 520 600 T1000 560 V1000 H0Z" fill="#6d597a"/><path d="M0 760 Q300 640 600 740 T1000 700 V1000 H0Z" fill="#b5838d"/>');
const NEAR = svg(
  '<path d="M0 880 Q500 820 1000 880 V1000 H0Z" fill="#355070"/><rect x="180" y="640" width="26" height="220" fill="#3b2a24"/><circle cx="193" cy="610" r="90" fill="#2e6b3a"/><circle cx="500" cy="760" r="34" fill="#f4c7d6"/><rect x="470" y="792" width="60" height="90" rx="22" fill="#b5e2dd"/>',
);
const LEAD = 0.5;
const TAIL = 0.7;

function cameraEdit(effect: string, duration: number, width: number, height: number): EditProject {
  const layer = (id: string, src: string, depth: number, track: number): EditItem => ({ id, kind: 'image', track, from: 0, duration: LEAD + duration + TAIL, src, fit: 'cover', scale: 1, x: 50, y: 50, depth });
  return {
    id: 'preview',
    name: 'preview',
    width,
    height,
    fps: 30,
    background: '#000',
    items: [
      layer('sky', SKY, 0.3, 0),
      layer('hills', HILLS, 0.7, 1),
      layer('near', NEAR, 1.2, 2),
      { id: 'fx', kind: 'effect', track: 3, from: LEAD, duration, effect: effect as EffectId, intensity: 1 },
    ],
    createdAt: '',
    updatedAt: '',
  };
}

interface Props {
  entries: FxEntry[];
  groups: FxGroup[];
  initialGroup: string;
  initialId: string;
  noun: string; // "motion graphics", "effects"
  aspect: { width: number; height: number };
  onAdd: (e: FxEntry) => void;
  footer?: ReactNode;
}

export function FxBrowser({ entries, groups, initialGroup, initialId, noun, aspect, onAdd, footer }: Props) {
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<string>(initialGroup);
  const [selectedId, setSelectedId] = useState(initialId);
  const [added, setAdded] = useState<string | null>(null);
  const addedTimer = useRef<number | null>(null);
  useEffect(() => () => void (addedTimer.current && window.clearTimeout(addedTimer.current)), []);

  const list = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const groupLabel = Object.fromEntries(groups.map((g) => [g.id, g.label]));
    return entries
      .filter((e) => q || group === 'all' || e.group === group)
      .filter((e) => words.every((w) => `${e.label} ${e.description} ${e.id} ${groupLabel[e.group] ?? e.group}`.toLowerCase().includes(w)));
  }, [q, group, entries, groups]);
  const counts = useMemo(() => Object.fromEntries(groups.map((g) => [g.id, entries.filter((e) => e.group === g.id).length])), [entries, groups]);
  const cur = entries.find((e) => e.id === selectedId) ?? entries[0];

  const add = (e: FxEntry) => {
    onAdd(e);
    setSelectedId(e.id);
    setAdded(e.id);
    if (addedTimer.current) window.clearTimeout(addedTimer.current);
    addedTimer.current = window.setTimeout(() => setAdded(null), 1200);
  };

  const fps = 30;
  const portrait = aspect.height >= aspect.width;
  const camera = cur.kind === 'camera';
  // preview at reduced resolution — it is a thumbnail, and camera previews render three full-frame layers
  const pw = Math.round(aspect.width / 2);
  const ph = Math.round(aspect.height / 2);
  const total = camera ? LEAD + cur.duration + TAIL : cur.duration;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-zinc-900 p-2 space-y-2">
        <div className={`relative mx-auto overflow-hidden rounded-md border border-zinc-800 bg-black ${portrait ? 'w-[46%]' : 'w-full'}`} style={{ aspectRatio: `${aspect.width} / ${aspect.height}` }}>
          {camera ? (
            <Player
              key={cur.id}
              component={EditorComposition}
              inputProps={{ edit: cameraEdit(cur.id, cur.duration, pw, ph), assetBase: '', preview: true }}
              durationInFrames={Math.max(30, Math.round(total * fps))}
              fps={fps}
              compositionWidth={pw}
              compositionHeight={ph}
              style={{ width: '100%', height: '100%' }}
              autoPlay
              loop
              acknowledgeRemotionLicense
            />
          ) : (
            <Player
              key={cur.id}
              component={MotionPreview}
              inputProps={{ fx: cur.id }}
              durationInFrames={Math.max(30, Math.round(total * fps))}
              fps={fps}
              compositionWidth={aspect.width}
              compositionHeight={aspect.height}
              style={{ width: '100%', height: '100%' }}
              autoPlay
              loop
              acknowledgeRemotionLicense
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-medium text-white">{cur.label}</p>
            <p className="truncate text-[10.5px] text-zinc-500">
              {groups.find((g) => g.id === cur.group)?.label} · {cur.duration}s
            </p>
          </div>
          <button
            type="button"
            onClick={() => add(cur)}
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-accent px-2.5 py-1.5 text-[11px] font-semibold text-black hover:bg-accent-strong cursor-pointer"
          >
            {added === cur.id ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {added === cur.id ? 'Added' : 'Add at playhead'}
          </button>
        </div>
        <label className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-black px-2 py-1.5">
          <Search className="h-3.5 w-3.5 text-zinc-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${entries.length} ${noun}`} className="w-full bg-transparent text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none" aria-label={`Search ${noun}`} />
        </label>
        {!q && (
          <div className="flex flex-wrap gap-1">
            {[{ id: 'all', label: 'All', blurb: `Every ${noun.replace(/s$/, '')}` }, ...groups].map((g) => (
              <button key={g.id} type="button" title={g.blurb} onClick={() => setGroup(g.id)} className={`rounded-full border px-2 py-0.5 text-[10.5px] cursor-pointer ${group === g.id ? 'border-accent bg-accent/15 text-white' : 'border-zinc-800 text-zinc-400 hover:text-white'}`}>
                {g.label} <span className="text-zinc-500">{g.id === 'all' ? entries.length : counts[g.id]}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5" role="listbox" aria-label={noun}>
        {list.map((e) => {
          const sel = cur.id === e.id;
          return (
            <div
              key={e.id}
              role="option"
              aria-selected={sel}
              tabIndex={0}
              onClick={() => setSelectedId(e.id)}
              onDoubleClick={() => add(e)}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter' || ev.key === ' ') {
                  ev.preventDefault();
                  setSelectedId(e.id);
                }
              }}
              className={`flex items-start gap-2 rounded-lg border bg-black px-3 py-2 cursor-pointer focus:outline-none focus-visible:border-accent ${sel ? 'border-accent bg-accent/5' : 'border-zinc-900 hover:border-zinc-700'}`}
            >
              <div className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium text-white">{e.label}</span>
                <span className="block text-[11px] text-zinc-500">{e.description}</span>
                {q && <span className="mt-0.5 block text-[10px] uppercase tracking-wider text-zinc-600">{groups.find((g) => g.id === e.group)?.label}</span>}
              </div>
              <button
                type="button"
                title="Add to timeline at the playhead"
                aria-label={`Add ${e.label} to timeline`}
                onClick={(ev) => {
                  ev.stopPropagation();
                  add(e);
                }}
                className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border cursor-pointer ${added === e.id ? 'border-accent bg-accent text-black' : 'border-zinc-800 text-zinc-400 hover:border-accent hover:text-accent'}`}
              >
                {added === e.id ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              </button>
            </div>
          );
        })}
        {!list.length && <p className="px-1 py-4 text-center text-xs text-zinc-500">Nothing matches “{q}”.</p>}
        {footer}
      </div>
    </div>
  );
}
