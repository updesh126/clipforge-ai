import { useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import type { EditItem, EditProject } from './types.ts';
import { KIND_STYLE, itemLabel, r2 } from './ops.ts';
import { formatTimecode } from '../utils/format.ts';
import { REF_COLOR, type StudioRef } from './studio/refs.ts';

const ROW = 34;
const HEAD = 96;

/** A track is named after what is on it (Video, Captions, Graphics…). */
const TRACK_NAME: Record<string, string> = { video: 'Video', audio: 'Audio', image: 'Pictures', text: 'Graphics', captions: 'Captions', effect: 'Effects' };

interface Props {
  edit: EditProject;
  duration: number;
  time: number;
  selectedId: string | null;
  onSeek: (t: number) => void;
  onSelect: (id: string | null) => void;
  /** live change while dragging (no history) */
  onDrag: (id: string, patch: Partial<EditItem>) => void;
  /** drag finished → push one history entry */
  onDragEnd: () => void;
  /** zoom in pixels per second, when the toolbar outside owns it */
  pps?: number;
  /** hide the built-in header (the Studio has its own timeline toolbar) */
  bare?: boolean;
  /** references to mark on the ruler; `hot` is lit */
  marks?: StudioRef[];
  hot?: number | null;
}

type Mode = 'move' | 'trimL' | 'trimR';

export function Timeline({ edit, duration, time, selectedId, onSeek, onSelect, onDrag, onDragEnd, pps: ppsProp, bare, marks = [], hot = null }: Props) {
  const [ppsState, setPps] = useState(40); // pixels per second
  const pps = ppsProp ?? ppsState;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ id: string; mode: Mode; x: number; y: number; orig: EditItem; moved: boolean } | null>(null);

  const top = Math.max(5, ...edit.items.map((i) => i.track));
  const tracks = Array.from({ length: top + 1 }, (_, i) => top - i); // highest layer drawn first
  const width = Math.max(duration + 10, 30) * pps;

  // keep the playhead visible while playing
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const x = time * pps;
    if (x < el.scrollLeft || x > el.scrollLeft + el.clientWidth - HEAD - 40) el.scrollLeft = Math.max(0, x - 80);
  }, [time, pps]);

  const timeAt = (clientX: number) => {
    const el = scrollRef.current!;
    const rect = el.getBoundingClientRect();
    return Math.max(0, (clientX - rect.left - HEAD + el.scrollLeft) / pps);
  };

  const snap = (t: number, id: string) => {
    const edges = [0, time, ...edit.items.filter((i) => i.id !== id).flatMap((i) => [i.from, i.from + i.duration])];
    for (const e of edges) if (Math.abs(e - t) * pps < 7) return e;
    return t;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dt = (e.clientX - d.x) / pps;
    if (Math.abs(e.clientX - d.x) > 2 || Math.abs(e.clientY - d.y) > 2) d.moved = true;
    const o = d.orig;
    if (d.mode === 'move') {
      const from = r2(Math.max(0, snap(o.from + dt, o.id)));
      const track = Math.max(0, Math.min(20, o.track - Math.round((e.clientY - d.y) / ROW)));
      onDrag(o.id, { from, track });
    } else if (d.mode === 'trimL') {
      const from = r2(Math.max(0, Math.min(o.from + o.duration - 0.2, snap(o.from + dt, o.id))));
      const shift = from - o.from;
      const patch: Record<string, unknown> = { from, duration: r2(o.duration - shift) };
      if (o.kind === 'video' || o.kind === 'audio') patch.sourceStart = r2(Math.max(0, o.sourceStart + shift));
      if (o.kind === 'captions') patch.words = o.words.map((w) => ({ ...w, start: r2(w.start - shift), end: r2(w.end - shift) })).filter((w) => w.end > 0);
      onDrag(o.id, patch as Partial<EditItem>);
    } else {
      const end = Math.max(o.from + 0.2, snap(o.from + o.duration + dt, o.id));
      onDrag(o.id, { duration: r2(end - o.from) });
    }
  };

  const endDrag = () => {
    if (drag.current?.moved) onDragEnd();
    drag.current = null;
  };

  const ticks: number[] = [];
  const step = pps >= 80 ? 1 : pps >= 30 ? 2 : pps >= 12 ? 5 : 10;
  for (let t = 0; t <= duration + 10; t += step) ticks.push(t);

  return (
    <div className={`flex h-full min-h-0 flex-col ${bare ? 'bg-studio-panel' : 'border-t border-zinc-900 bg-surface'}`}>
      <div className={`${bare ? 'hidden' : 'flex'} items-center justify-between px-3 py-1.5 border-b border-zinc-900 text-[11px] text-zinc-500`}>
        <span>Timeline · drag to move, edges to trim, up/down to change layer</span>
        <div className="flex items-center gap-1.5">
          <button type="button" title="Zoom out" onClick={() => setPps((p) => Math.max(6, p / 1.4))} className="p-1 rounded hover:bg-zinc-900 hover:text-white cursor-pointer">
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button type="button" title="Zoom in" onClick={() => setPps((p) => Math.min(240, p * 1.4))} className="p-1 rounded hover:bg-zinc-900 hover:text-white cursor-pointer">
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="relative flex-1 min-h-0 overflow-auto select-none"
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div style={{ width: width + HEAD }} className="relative">
          {/* Ruler */}
          <div
            className={`sticky top-0 z-20 flex h-6 border-b cursor-pointer ${bare ? 'border-studio-border bg-studio-panel' : 'border-zinc-900 bg-surface'}`}
            onPointerDown={(e) => {
              onSeek(timeAt(e.clientX));
              const move = (ev: PointerEvent) => onSeek(timeAt(ev.clientX));
              const up = () => {
                window.removeEventListener('pointermove', move);
                window.removeEventListener('pointerup', up);
              };
              window.addEventListener('pointermove', move);
              window.addEventListener('pointerup', up);
            }}
          >
            <div className={`sticky left-0 z-10 shrink-0 border-r ${bare ? 'bg-studio-panel border-studio-border' : 'bg-surface border-zinc-900'}`} style={{ width: HEAD }} />
            <div className="relative flex-1">
              {ticks.map((t) => (
                <span key={t} className="absolute top-0 h-full border-l border-zinc-800 pl-1 font-mono text-[10px] text-zinc-500" style={{ left: t * pps }}>
                  {formatTimecode(t)}
                </span>
              ))}
              {marks.map((r) => {
                const t0 = r.kind === 'range' ? r.t0 : r.t;
                if (t0 === undefined) return null;
                const w = r.kind === 'range' && r.t1 !== undefined ? (r.t1 - t0) * pps : 0;
                const c = REF_COLOR[r.kind];
                return (
                  <span key={r.n} className="pointer-events-none absolute top-0.5 bottom-0.5 rounded-sm" style={{ left: t0 * pps, width: Math.max(14, w), background: w ? `color-mix(in srgb, ${c} ${hot === r.n ? 65 : 35}%, transparent)` : 'transparent' }}>
                    <span className="absolute left-0 top-0 grid h-4 min-w-4 place-items-center rounded px-0.5 text-[9px] font-bold text-black" style={{ background: c, boxShadow: hot === r.n ? '0 0 0 2px #fff' : undefined }}>{r.n}</span>
                  </span>
                );
              })}
            </div>
          </div>

          {/* Tracks */}
          {tracks.map((track) => (
            <div key={track} className={`flex border-b ${bare ? 'border-black' : 'border-zinc-900/70'}`} style={{ height: ROW }}>
              <div className={`sticky left-0 z-10 shrink-0 flex items-center gap-1.5 px-2.5 border-r text-[11px] ${bare ? 'bg-studio-panel border-studio-border text-studio-muted' : 'bg-surface border-zinc-900 font-mono text-[10px] text-zinc-600'}`} style={{ width: HEAD }}>
                {trackName(edit, track, bare)}
              </div>
              <div className={`relative flex-1 ${bare ? 'bg-[rgba(240,240,255,.035)]' : ''}`} onPointerDown={() => onSelect(null)}>
                {edit.items
                  .filter((i) => i.track === track)
                  .map((i) => {
                    const st = KIND_STYLE[i.kind];
                    const sel = i.id === selectedId;
                    return (
                      <div
                        key={i.id}
                        title={`${itemLabel(i)} · ${i.from.toFixed(2)}s → ${(i.from + i.duration).toFixed(2)}s`}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          onSelect(i.id);
                          scrollRef.current?.setPointerCapture(e.pointerId);
                          drag.current = { id: i.id, mode: 'move', x: e.clientX, y: e.clientY, orig: i, moved: false };
                        }}
                        className={`absolute top-1 bottom-1 border px-2 flex items-center overflow-hidden cursor-grab active:cursor-grabbing ${bare ? `rounded ${st.solid} border-white/10` : `rounded-md ${st.bar}`} ${
                          sel ? (bare ? 'outline-[1.5px] outline-solid outline-white z-10' : 'ring-2 ring-white/80 z-10') : ''
                        }`}
                        style={{ left: i.from * pps, width: Math.max(6, i.duration * pps) }}
                      >
                        <span className={`truncate text-[11px] font-medium ${bare ? 'text-white' : st.text}`}>{itemLabel(i)}</span>
                        {(['trimL', 'trimR'] as const).map((m) => (
                          <span
                            key={m}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              onSelect(i.id);
                              scrollRef.current?.setPointerCapture(e.pointerId);
                              drag.current = { id: i.id, mode: m, x: e.clientX, y: e.clientY, orig: i, moved: false };
                            }}
                            className={`absolute top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30 ${m === 'trimL' ? 'left-0' : 'right-0'}`}
                          />
                        ))}
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}

          {/* Playhead */}
          <div className="pointer-events-none absolute top-0 bottom-0 z-30 w-px bg-white" style={{ left: HEAD + time * pps }}>
            <div className="absolute -top-0 -left-1.5 h-3 w-3 rotate-45 bg-white" />
          </div>
        </div>
      </div>
    </div>
  );
}

function trackName(edit: EditProject, track: number, studio?: boolean): string {
  if (!studio) return `Layer ${track + 1}`;
  const kinds = edit.items.filter((i) => i.track === track).map((i) => i.kind);
  if (!kinds.length) return `Track ${track + 1}`;
  const top = Object.entries(kinds.reduce<Record<string, number>>((m, k) => ({ ...m, [k]: (m[k] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1])[0][0];
  return TRACK_NAME[top] ?? `Track ${track + 1}`;
}
