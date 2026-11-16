import { useMemo, useState } from 'react';
import { Player } from '@remotion/player';
import { Plus, Search } from 'lucide-react';
import { MotionFx } from '../motion/MotionFx.tsx';
import { CATEGORIES, EFFECTS_LIB, type Category } from '../motion/catalog.ts';
import { SEQUENCES } from '../motion/sequences.ts';

interface Entry {
  id: string;
  label: string;
  description: string;
  category: Category;
  duration: number;
  bg?: string;
}

const ENTRIES: Entry[] = [
  ...Object.values(SEQUENCES).map((s) => ({ id: s.id, label: s.label, description: s.description, category: 'sequences' as const, duration: s.duration, bg: s.bg })),
  ...Object.values(EFFECTS_LIB).map((e) => ({ id: e.id, label: e.label, description: e.description, category: e.category, duration: e.duration })),
];

const Preview = ({ fx }: { fx: string }) => (
  <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 30%, #2b3443, #0d1117)' }}>
    <MotionFx props={{ fx }} />
  </div>
);

/** Motion graphics library: search + categories + live hover preview; click to add at the playhead. */
export function MotionLibrary({ onAdd, aspect }: { onAdd: (fx: string) => void; aspect: { width: number; height: number } }) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<Category | 'all'>('sequences');
  const [hover, setHover] = useState<string>('bigStat');
  const list = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return ENTRIES.filter((e) => (q ? true : cat === 'all' || e.category === cat)).filter((e) => words.every((w) => `${e.label} ${e.description} ${e.id} ${e.category}`.toLowerCase().includes(w)));
  }, [q, cat]);
  const counts = useMemo(() => Object.fromEntries(CATEGORIES.map((c) => [c.id, ENTRIES.filter((e) => e.category === c.id).length])), []);
  const cur = ENTRIES.find((e) => e.id === hover) ?? ENTRIES[0];
  const fps = 30;
  const portrait = aspect.height >= aspect.width;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-zinc-900 p-2 space-y-2">
        <div className={`relative mx-auto overflow-hidden rounded-md border border-zinc-800 bg-black ${portrait ? 'w-[46%]' : 'w-full'}`} style={{ aspectRatio: `${aspect.width} / ${aspect.height}` }}>
          <Player
            key={cur.id}
            component={Preview}
            inputProps={{ fx: cur.id }}
            durationInFrames={Math.max(30, Math.round(cur.duration * fps))}
            fps={fps}
            compositionWidth={aspect.width}
            compositionHeight={aspect.height}
            style={{ width: '100%', height: '100%' }}
            autoPlay
            loop
            acknowledgeRemotionLicense
          />
        </div>
        <p className="truncate text-center text-[10.5px] text-zinc-500">
          {cur.label} · {cur.duration}s
        </p>
        <label className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-black px-2 py-1.5">
          <Search className="h-3.5 w-3.5 text-zinc-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${ENTRIES.length} effects & sequences`} className="w-full bg-transparent text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none" aria-label="Search motion graphics" />
        </label>
        {!q && (
          <div className="flex flex-wrap gap-1">
            {CATEGORIES.map((c) => (
              <button key={c.id} type="button" title={c.blurb} onClick={() => setCat(c.id)} className={`rounded-full border px-2 py-0.5 text-[10.5px] cursor-pointer ${cat === c.id ? 'border-accent bg-accent/15 text-white' : 'border-zinc-800 text-zinc-400 hover:text-white'}`}>
                {c.label} <span className="text-zinc-500">{counts[c.id]}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5">
        {list.map((e) => (
          <button
            key={e.id}
            type="button"
            onMouseEnter={() => setHover(e.id)}
            onFocus={() => setHover(e.id)}
            onClick={() => onAdd(e.id)}
            className={`w-full text-left rounded-lg border bg-black px-3 py-2 cursor-pointer group ${hover === e.id ? 'border-zinc-600' : 'border-zinc-900 hover:border-zinc-700'}`}
          >
            <span className="flex items-center justify-between gap-2 text-xs font-medium text-white">
              <span className="truncate">{e.label}</span>
              <Plus className="h-3.5 w-3.5 shrink-0 text-zinc-600 group-hover:text-accent" />
            </span>
            <span className="block text-[11px] text-zinc-500">{e.description}</span>
          </button>
        ))}
        {!list.length && <p className="px-1 py-4 text-center text-xs text-zinc-500">Nothing matches “{q}”.</p>}
      </div>
    </div>
  );
}
