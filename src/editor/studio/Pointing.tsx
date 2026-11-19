import { useRef, useState } from 'react';
import { REF_COLOR, type StudioRef } from './refs.ts';

/**
 * The marks row under the picture: the whole edit end to end. Click to point at that moment, drag to point at a
 * stretch. Existing references show as numbered pins and bands; the hovered one is lit.
 */
export function PointStrip({ duration, time, refs, hot, onSeek, onMoment, onRange }: { duration: number; time: number; refs: StudioRef[]; hot: number | null; onSeek: (t: number) => void; onMoment: (t: number) => void; onRange: (t0: number, t1: number) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const down = useRef<{ x: number; t: number } | null>(null);
  const [preview, setPreview] = useState<[number, number] | null>(null);
  const D = Math.max(0.1, duration);
  const at = (clientX: number) => {
    const r = el.current!.getBoundingClientRect();
    return Math.max(0, Math.min(D, ((clientX - r.left) / r.width) * D));
  };
  const pct = (t: number) => `${(t / D) * 100}%`;
  return (
    <div
      ref={el}
      role="slider"
      aria-label="Point at a moment (click) or a stretch (drag)"
      aria-valuemin={0}
      aria-valuemax={Math.round(D)}
      aria-valuenow={Math.round(time)}
      tabIndex={0}
      title="Click: point at this moment · Drag: point at a stretch"
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        down.current = { x: e.clientX, t: at(e.clientX) };
      }}
      onPointerMove={(e) => {
        const d = down.current;
        if (!d || Math.abs(e.clientX - d.x) < 6) return;
        const t = at(e.clientX);
        setPreview([Math.min(d.t, t), Math.max(d.t, t)]);
      }}
      onPointerUp={(e) => {
        const d = down.current;
        down.current = null;
        setPreview(null);
        if (!d) return;
        if (Math.abs(e.clientX - d.x) >= 6) {
          const t = at(e.clientX);
          onRange(Math.min(d.t, t), Math.max(d.t, t));
        } else {
          onSeek(d.t);
          onMoment(d.t);
        }
      }}
      className="relative h-7 shrink-0 cursor-crosshair select-none border-t border-studio-border bg-[repeating-linear-gradient(90deg,rgba(255,255,255,.05)_0_1px,transparent_1px_24px)] outline-none focus-visible:ring-1 focus-visible:ring-accent"
    >
      {refs.map((r) => {
        const c = REF_COLOR[r.kind];
        const lit = hot === r.n;
        if (r.kind === 'range' && r.t0 !== undefined && r.t1 !== undefined)
          return <span key={r.n} className="absolute top-1 bottom-1 rounded-sm" style={{ left: pct(r.t0), width: `${((r.t1 - r.t0) / D) * 100}%`, background: `color-mix(in srgb, ${c} ${lit ? 70 : 38}%, transparent)`, outline: lit ? `1px solid ${c}` : undefined }} />;
        if (r.t === undefined) return null;
        return null;
      })}
      {refs.map((r) => {
        const t = r.kind === 'range' ? r.t0 : r.t;
        if (t === undefined) return null;
        const lit = hot === r.n;
        return (
          <span key={`p${r.n}`} className="absolute top-1/2 grid h-4 min-w-4 -translate-x-1/2 -translate-y-1/2 place-items-center rounded px-0.5 text-[10px] font-bold text-black" style={{ left: pct(t), background: REF_COLOR[r.kind], boxShadow: lit ? '0 0 0 2px #fff' : undefined }}>
            {r.n}
          </span>
        );
      })}
      {preview && <span className="absolute top-1 bottom-1 rounded-sm bg-[color-mix(in_srgb,var(--color-ref-range)_45%,transparent)]" style={{ left: pct(preview[0]), width: `${((preview[1] - preview[0]) / D) * 100}%` }} />}
      <span className="pointer-events-none absolute top-0 bottom-0 w-px bg-white" style={{ left: pct(time) }} />
    </div>
  );
}

/**
 * Drawn over the paused picture while pointing is on: drag a box around what should change. Region references
 * (and the hovered one) are outlined on top of the picture.
 */
export function RegionOverlay({ active, refs, hot, time, onRegion }: { active: boolean; refs: StudioRef[]; hot: number | null; time: number; onRegion: (box: { x: number; y: number; w: number; h: number }) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const down = useRef<{ x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const pos = (e: React.PointerEvent) => {
    const r = el.current!.getBoundingClientRect();
    return { x: Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)), y: Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100)) };
  };
  const shown = refs.filter((r) => r.kind === 'region' && r.box && (hot === r.n || (active && Math.abs((r.t ?? 0) - time) < 0.25)));
  if (!active && !shown.length) return null;
  return (
    <div
      ref={el}
      className={`absolute inset-0 z-10 ${active ? 'cursor-crosshair' : 'pointer-events-none'}`}
      onPointerDown={(e) => {
        if (!active) return;
        e.stopPropagation();
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        down.current = pos(e);
        setDraft({ ...down.current, w: 0, h: 0 });
      }}
      onPointerMove={(e) => {
        const d = down.current;
        if (!d) return;
        const p = pos(e);
        setDraft({ x: Math.min(d.x, p.x), y: Math.min(d.y, p.y), w: Math.abs(p.x - d.x), h: Math.abs(p.y - d.y) });
      }}
      onPointerUp={() => {
        down.current = null;
        if (draft && draft.w > 2 && draft.h > 2) onRegion(draft);
        setDraft(null);
      }}
    >
      {active && !draft && <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/70 px-2 py-1 text-[11px] text-white">Drag a box around what should change</span>}
      {shown.map((r) => (
        <span key={r.n} className="pointer-events-none absolute rounded border-2 border-dashed" style={{ left: `${r.box!.x}%`, top: `${r.box!.y}%`, width: `${r.box!.w}%`, height: `${r.box!.h}%`, borderColor: REF_COLOR.region, boxShadow: hot === r.n ? '0 0 0 9999px rgba(0,0,0,.35)' : undefined }}>
          <span className="absolute -left-2.5 -top-2.5 grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold text-white" style={{ background: REF_COLOR.region }}>{r.n}</span>
        </span>
      ))}
      {draft && <span className="pointer-events-none absolute rounded border-2 border-dashed border-white/90 bg-white/10" style={{ left: `${draft.x}%`, top: `${draft.y}%`, width: `${draft.w}%`, height: `${draft.h}%` }} />}
    </div>
  );
}
