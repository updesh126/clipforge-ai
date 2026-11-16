import { useState, type ReactNode } from 'react';
import { Trash2, Copy, Scissors } from 'lucide-react';
import type { CaptionLook, EditItem } from './types.ts';
import { ART_STYLE_LABELS, ART_STYLE_OPTIONS, EFFECTS, TEMPLATES, type FieldDef } from './catalog.ts';
import { KIND_STYLE, itemLabel } from './ops.ts';

interface Props {
  item: EditItem;
  onChange: (patch: Partial<EditItem>, commit?: boolean) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onSplit: () => void;
}

const inputCls = 'w-full rounded-md border border-zinc-800 bg-black px-2 py-1 text-xs text-zinc-100 focus:outline-none focus:border-accent';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid grid-cols-[84px_1fr] items-center gap-2 text-[11px] text-zinc-400">
      <span className="truncate">{label}</span>
      {children}
    </label>
  );
}

function Num({ value, onChange, min, max, step = 0.1 }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return <input type="number" className={inputCls} value={Number.isFinite(value) ? value : 0} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))} />;
}

function Slider({ value, onChange, onCommit, min, max, step }: { value: number; onChange: (v: number) => void; onCommit: () => void; min: number; max: number; step: number }) {
  return (
    <div className="flex items-center gap-2">
      <input type="range" className="flex-1 accent-[#B5E2DD] cursor-pointer" value={value} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))} onPointerUp={onCommit} />
      <span className="w-9 text-right font-mono text-[10.5px] text-zinc-500">{Number(value).toFixed(step < 1 ? 2 : 0)}</span>
    </div>
  );
}

function Field({ f, value, onChange }: { f: FieldDef; value: unknown; onChange: (v: string | number) => void }) {
  if (f.type === 'color')
    return (
      <div className="flex items-center gap-2">
        <input type="color" value={String(value || '#ffffff')} onChange={(e) => onChange(e.target.value)} className="h-6 w-8 rounded border border-zinc-800 bg-black cursor-pointer" />
        <input className={inputCls} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
      </div>
    );
  if (f.type === 'number') return <Num value={Number(value)} min={f.min} max={f.max} step={f.step} onChange={onChange} />;
  if (f.type === 'select')
    return (
      <select className={inputCls} value={String(value)} onChange={(e) => onChange(e.target.value)}>
        {f.options?.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    );
  return <input className={inputCls} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />;
}

type VectorRef = { cast: string; pose: string; expression: string; theme: string };
const POSE_OPTIONS = ['stand', 'walk', 'run', 'sit', 'jump', 'wave', 'point', 'cheer', 'think'];
const EXPRESSION_OPTIONS = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'scared'];
const THEME_OPTIONS: [string, string][] = [['storybook', "Children's storybook"], ['cartoon', 'Cartoon'], ['flatVector', 'Flat vector'], ['handDrawn', 'Hand-drawn']];

/** Procedural cast character: change pose / expression / theme → the server redraws the same identity. */
function CharacterControls({ vector, onRendered }: { vector: VectorRef; onRendered: (src: string, v: VectorRef) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const change = async (patch: Partial<VectorRef>) => {
    const next = { ...vector, ...patch };
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/vector/character', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: next.cast, pose: next.pose, expression: next.expression, theme: next.theme, size: 1024 }) });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Could not redraw the character.');
      onRendered(data.url, next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not redraw the character.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-1.5 rounded-lg border border-zinc-900 p-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Character · {vector.cast}{busy ? ' · drawing…' : ''}</p>
      <Row label="Pose">
        <select className={inputCls} disabled={busy} value={vector.pose} onChange={(e) => change({ pose: e.target.value })}>
          {POSE_OPTIONS.map((p) => <option key={p}>{p}</option>)}
        </select>
      </Row>
      <Row label="Expression">
        <select className={inputCls} disabled={busy} value={vector.expression} onChange={(e) => change({ expression: e.target.value })}>
          {EXPRESSION_OPTIONS.map((p) => <option key={p}>{p}</option>)}
        </select>
      </Row>
      <Row label="Theme">
        <select className={inputCls} disabled={busy} value={vector.theme} onChange={(e) => change({ theme: e.target.value })}>
          {THEME_OPTIONS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </Row>
      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </div>
  );
}

export function Inspector({ item, onChange, onDelete, onDuplicate, onSplit }: Props) {
  const set = (patch: Record<string, unknown>, commit = true) => onChange(patch as Partial<EditItem>, commit);
  const st = KIND_STYLE[item.kind];
  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className={`text-[10.5px] font-semibold uppercase tracking-wider ${st.text}`}>{st.label}</p>
          <input className="mt-0.5 w-full bg-transparent text-sm font-semibold text-white focus:outline-none" value={itemLabel(item)} onChange={(e) => set({ name: e.target.value })} />
        </div>
        <div className="flex shrink-0 gap-1">
          {[
            { icon: Scissors, title: 'Split at playhead (S)', fn: onSplit },
            { icon: Copy, title: 'Duplicate (Ctrl+D)', fn: onDuplicate },
            { icon: Trash2, title: 'Delete (Del)', fn: onDelete },
          ].map(({ icon: I, title, fn }) => (
            <button key={title} type="button" title={title} onClick={fn} className="rounded-md border border-zinc-800 p-1.5 text-zinc-400 hover:text-white hover:border-zinc-600 cursor-pointer">
              <I className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5 rounded-lg border border-zinc-900 p-2.5">
        <Row label="Start (s)"><Num value={item.from} min={0} onChange={(v) => set({ from: Math.max(0, v) })} /></Row>
        <Row label="Duration (s)"><Num value={item.duration} min={0.1} onChange={(v) => set({ duration: Math.max(0.1, v) })} /></Row>
        <Row label="Layer"><Num value={item.track + 1} min={1} max={21} step={1} onChange={(v) => set({ track: Math.max(0, Math.round(v) - 1) })} /></Row>
      </div>

      {item.kind === 'video' && (
        <div className="space-y-1.5 rounded-lg border border-zinc-900 p-2.5">
          <Row label="Framing">
            <select className={inputCls} value={item.fit} onChange={(e) => set({ fit: e.target.value })}>
              <option value="cover">Fill (crop)</option>
              <option value="contain">Fit + blurred bg</option>
            </select>
          </Row>
          <Row label="Zoom"><Slider value={item.zoom} min={1} max={3} step={0.05} onChange={(v) => set({ zoom: v }, false)} onCommit={() => set({})} /></Row>
          <Row label="Pan ↔"><Slider value={item.panX} min={0} max={100} step={1} onChange={(v) => set({ panX: v }, false)} onCommit={() => set({})} /></Row>
          <Row label="Pan ↕"><Slider value={item.panY} min={0} max={100} step={1} onChange={(v) => set({ panY: v }, false)} onCommit={() => set({})} /></Row>
          <Row label="Volume"><Slider value={item.volume} min={0} max={2} step={0.05} onChange={(v) => set({ volume: v }, false)} onCommit={() => set({})} /></Row>
          <Row label="Source in (s)"><Num value={item.sourceStart} min={0} onChange={(v) => set({ sourceStart: Math.max(0, v) })} /></Row>
        </div>
      )}

      {item.kind === 'audio' && (
        <div className="space-y-1.5 rounded-lg border border-zinc-900 p-2.5">
          <Row label="Volume"><Slider value={item.volume} min={0} max={2} step={0.05} onChange={(v) => set({ volume: v }, false)} onCommit={() => set({})} /></Row>
          <Row label="Source in (s)"><Num value={item.sourceStart} min={0} onChange={(v) => set({ sourceStart: Math.max(0, v) })} /></Row>
        </div>
      )}

      {item.kind === 'image' && item.vector && <CharacterControls vector={item.vector} onRendered={(src, vector) => set({ src, vector })} />}

      {item.kind === 'image' && (
        <div className="space-y-1.5 rounded-lg border border-zinc-900 p-2.5">
          <Row label="Motion">
            <select className={inputCls} value={item.motion ?? (item.anchor === 'bottom' ? 'pop' : 'none')} onChange={(e) => set({ motion: e.target.value })}>
              {['none', 'pop', 'walkIn', 'walkOut', 'walkAcross', 'bob', 'sway', 'float', 'fly', 'breathe', 'slideUp', 'kenBurns'].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Row>
          <Row label="Face left">
            <input type="checkbox" checked={Boolean(item.flip)} onChange={(e) => set({ flip: e.target.checked })} className="accent-[#B5E2DD] justify-self-start" />
          </Row>
          <Row label="Stand on ground">
            <input type="checkbox" checked={item.anchor === 'bottom'} onChange={(e) => set({ anchor: e.target.checked ? 'bottom' : undefined })} className="accent-[#B5E2DD] justify-self-start" />
          </Row>
          <Row label="Style look">
            <select className={inputCls} value={item.look ?? ''} onChange={(e) => set({ look: e.target.value || undefined })}>
              <option value="">Original colours</option>
              {ART_STYLE_OPTIONS.map((id) => (
                <option key={id} value={id}>{ART_STYLE_LABELS[id] ?? id}</option>
              ))}
            </select>
          </Row>
          <Row label="Depth"><Slider value={item.depth ?? 1} min={0} max={1.6} step={0.05} onChange={(v) => set({ depth: v }, false)} onCommit={() => set({})} /></Row>
          <Row label="Size"><Slider value={item.scale} min={0.1} max={1} step={0.01} onChange={(v) => set({ scale: v }, false)} onCommit={() => set({})} /></Row>
          <Row label="X %"><Slider value={item.x} min={0} max={100} step={1} onChange={(v) => set({ x: v }, false)} onCommit={() => set({})} /></Row>
          <Row label="Y %"><Slider value={item.y} min={0} max={100} step={1} onChange={(v) => set({ y: v }, false)} onCommit={() => set({})} /></Row>
        </div>
      )}

      {item.kind === 'text' && (
        <div className="space-y-1.5 rounded-lg border border-zinc-900 p-2.5">
          <Row label="Template">
            <select
              className={inputCls}
              value={item.template}
              onChange={(e) => {
                const t = e.target.value as keyof typeof TEMPLATES;
                set({ template: t, props: { ...TEMPLATES[t].defaults } });
              }}
            >
              {Object.entries(TEMPLATES).map(([id, t]) => (
                <option key={id} value={id}>
                  {t.label}
                </option>
              ))}
            </select>
          </Row>
          {TEMPLATES[item.template]?.fields.map((f) => (
            <Row key={f.key} label={f.label}>
              <Field f={f} value={item.props[f.key]} onChange={(v) => set({ props: { ...item.props, [f.key]: v } })} />
            </Row>
          ))}
        </div>
      )}

      {item.kind === 'captions' && (
        <div className="space-y-1.5 rounded-lg border border-zinc-900 p-2.5">
          <Row label="Look">
            <select className={inputCls} value={item.look} onChange={(e) => set({ look: e.target.value as CaptionLook })}>
              <option value="karaoke">Karaoke</option>
              <option value="pop">Pop</option>
              <option value="bold">Bold</option>
              <option value="clean">Clean</option>
            </select>
          </Row>
          <Row label="Position">
            <select className={inputCls} value={item.position} onChange={(e) => set({ position: e.target.value })}>
              <option value="bottom">Bottom</option>
              <option value="middle">Middle</option>
              <option value="top">Top</option>
            </select>
          </Row>
          <Row label="Highlight">
            <Field f={{ key: 'accent', label: '', type: 'color' }} value={item.accent} onChange={(v) => set({ accent: v })} />
          </Row>
          <p className="pt-1 text-[11px] text-zinc-500">{item.words.length} timed words from Whisper.</p>
        </div>
      )}

      {item.kind === 'effect' && (
        <div className="space-y-1.5 rounded-lg border border-zinc-900 p-2.5">
          <Row label="Effect">
            <select className={inputCls} value={item.effect} onChange={(e) => set({ effect: e.target.value })}>
              {Object.entries(EFFECTS).map(([id, fx]) => (
                <option key={id} value={id}>
                  {fx.label}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Intensity"><Slider value={item.intensity} min={0.2} max={2} step={0.05} onChange={(v) => set({ intensity: v }, false)} onCommit={() => set({})} /></Row>
        </div>
      )}
    </div>
  );
}
