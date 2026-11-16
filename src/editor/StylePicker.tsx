import { Sparkles, Shuffle } from 'lucide-react';
import { ART_STYLE_LABELS, ART_STYLE_OPTIONS, STYLE_INFO } from './catalog.ts';

interface Props {
  value: string;
  onChange: (id: string) => void;
}

const label = (id: string) => (id === 'auto' ? 'AI picks' : id === 'mix' ? 'Mix all' : ART_STYLE_LABELS[id] ?? id);
const MIX = ['madhubani', 'ukiyoe', 'warli', 'anime'];

/** Thumbnail: rendered art scene (public/styles, made by `npm run thumbs`). */
function Thumb({ id, tall = false }: { id: string; tall?: boolean }) {
  if (id === 'mix')
    return (
      <div className={`grid grid-cols-2 ${tall ? 'h-full' : 'h-full'}`}>
        {MIX.map((s) => (
          <img key={s} src={`/styles/${s}${tall ? '-preview' : ''}.jpg`} alt="" className="h-full w-full object-cover" />
        ))}
      </div>
    );
  if (id === 'auto')
    return (
      <div className="relative h-full w-full bg-[linear-gradient(135deg,#B5E2DD,#D8CCE8,#F4C7D6,#FBDFCB)]">
        <Sparkles className="absolute inset-0 m-auto h-5 w-5 text-black/50" />
      </div>
    );
  return <img src={`/styles/${id}${tall ? '-preview' : ''}.jpg`} alt="" loading="lazy" className="h-full w-full object-cover" />;
}

export function StylePicker({ value, onChange }: Props) {
  const ids = ['auto', 'mix', ...ART_STYLE_OPTIONS];
  return (
    <div className="grid grid-cols-3 gap-2">
      {ids.map((id, i) => {
        const info = STYLE_INFO[id];
        const active = value === id;
        // popover opens to the left (the picker sits in the right column); first column opens right on small screens
        return (
          <div key={id} className="group relative">
            <button
              type="button"
              onClick={() => onChange(id)}
              aria-pressed={active}
              aria-describedby={`style-info-${id}`}
              className={`block w-full overflow-hidden rounded-lg border text-left cursor-pointer transition-colors ${
                active ? 'border-accent ring-1 ring-accent' : 'border-zinc-800 hover:border-zinc-500'
              }`}
            >
              <div className="relative aspect-video overflow-hidden bg-zinc-900">
                <Thumb id={id} />
                {id === 'mix' && <Shuffle className="absolute bottom-1 right-1 h-3.5 w-3.5 text-white drop-shadow" />}
              </div>
              <div className={`truncate px-2 py-1 text-[11px] ${active ? 'bg-accent/10 text-white' : 'bg-surface text-zinc-200'}`}>{label(id)}</div>
            </button>

            {info && (
              <div
                id={`style-info-${id}`}
                role="tooltip"
                // always open just left of the whole grid (skip over the cards to this one's left), so no choice is covered
                style={{ right: `calc(${i % 3} * (100% + 0.5rem) + 100% + 0.5rem)` }}
                className="pointer-events-none invisible absolute top-0 z-40 w-[300px] translate-y-1 rounded-xl border border-zinc-700 bg-panel/95 p-3 opacity-0 shadow-2xl shadow-black backdrop-blur transition-all duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
              >
                <div className="flex gap-3">
                  <div className="h-[168px] w-[95px] shrink-0 overflow-hidden rounded-md border border-zinc-800 bg-black">
                    <Thumb id={id} tall />
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <p className="text-sm font-semibold text-white">{label(id)}</p>
                    <p className="text-[10.5px] uppercase tracking-wider text-zinc-500">{info.origin}</p>
                    <p className="text-[11.5px] leading-snug text-zinc-300">{info.look}</p>
                    <p className="text-[11px] leading-snug text-zinc-400">
                      <span className="text-zinc-500">Best for: </span>
                      {info.bestFor}
                    </p>
                    <div className="flex gap-1 pt-0.5">
                      {info.palette.map((c) => (
                        <span key={c} title={c} className="h-3.5 w-3.5 rounded-sm border border-white/10" style={{ background: c }} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
