import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowUp, Crosshair, Diamond, Film, Library, Loader2, MessageSquare, PanelLeftClose, Plus, Sparkles, Undo2, X } from 'lucide-react';
import { REF_COLOR, refText, type StudioRef } from './refs.ts';

export interface ChatMsg {
  role: 'user' | 'ai' | 'error';
  text: string;
  refs?: StudioRef[]; // what the user pointed at with this message
  steps?: string[]; // what the AI changed, one sentence each
  applied?: number;
}

const SUGGESTIONS = [
  'Make the opening punchier',
  'Add a big stat where a number is said',
  'Highlight the key sentence with a marker',
  'Add a lower third for the speaker',
  'Switch captions to pop style',
];

/** A numbered reference chip: hovering lights its mark in the viewer and timeline, clicking jumps there. */
export function RefPill({ r, onHover, onClick, onRemove }: { r: StudioRef; onHover?: (n: number | null) => void; onClick?: () => void; onRemove?: () => void }) {
  const c = REF_COLOR[r.kind];
  return (
    <span
      onMouseEnter={() => onHover?.(r.n)}
      onMouseLeave={() => onHover?.(null)}
      className="inline-flex h-[1.45rem] max-w-full items-center gap-1 rounded-md border pl-1 pr-1.5 text-[11px] text-studio-text"
      style={{ background: `color-mix(in srgb, ${c} 13%, var(--color-studio-raised))`, borderColor: `color-mix(in srgb, ${c} 40%, transparent)` }}
    >
      <button type="button" onClick={onClick} className="inline-flex min-w-0 items-center gap-1 cursor-pointer" title="Go there">
        <span className="grid h-4 min-w-4 place-items-center rounded px-0.5 text-[10px] font-bold text-black" style={{ background: c }}>{r.n}</span>
        <span className="truncate">{refText(r)}</span>
      </button>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Remove reference ${r.n}`} className="text-studio-faint hover:text-studio-text cursor-pointer">
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

interface Props {
  messages: ChatMsg[];
  busy: boolean;
  draft: StudioRef[];
  hasSelection: boolean;
  pointMode: boolean;
  library: boolean;
  libraryPanel: ReactNode;
  onSend: (text: string) => void;
  onRemoveRef: (n: number) => void;
  onHoverRef: (n: number | null) => void;
  onJumpRef: (r: StudioRef) => void;
  onAddMoment: () => void;
  onAddClip: () => void;
  onTogglePoint: () => void;
  onToggleLibrary: (open: boolean) => void;
  onHide: () => void;
  onUndo: () => void;
  canUndo: boolean;
}

export function ChatColumn(p: Props) {
  const [text, setText] = useState('');
  const [menu, setMenu] = useState(false);
  const thread = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    thread.current?.scrollTo({ top: thread.current.scrollHeight });
  }, [p.messages.length, p.busy]);
  // a new reference puts the cursor back in the composer, ready to say what to change
  useEffect(() => {
    if (p.draft.length) box.current?.focus();
  }, [p.draft.length]);

  const send = (t: string) => {
    const v = t.trim();
    if (!v || p.busy) return;
    p.onSend(v);
    setText('');
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-studio-panel">
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-studio-border px-1.5">
        {([
          [false, 'Chat', MessageSquare],
          [true, 'Library', Library],
        ] as const).map(([lib, label, I]) => (
          <button
            key={label}
            type="button"
            onClick={() => p.onToggleLibrary(lib)}
            aria-pressed={p.library === lib}
            className={`inline-flex h-[26px] items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium cursor-pointer ${p.library === lib ? 'bg-studio-field text-studio-text' : 'text-studio-muted hover:bg-studio-hover hover:text-studio-text'}`}
          >
            <I className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
        <button type="button" onClick={p.onHide} title="Hide chat (Ctrl+Shift+L)" className="ml-auto grid h-[26px] w-[26px] place-items-center rounded-md text-studio-muted hover:bg-studio-hover hover:text-studio-text cursor-pointer">
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      {p.library ? (
        <div className="flex-1 min-h-0 overflow-hidden">{p.libraryPanel}</div>
      ) : (
        <div ref={thread} className="flex-1 min-h-0 overflow-y-auto px-4 pt-5 pb-4 space-y-4">
          {p.messages.length === 0 && (
            <div className="space-y-3 pt-6">
              <p className="flex items-center gap-2 text-[15px] font-semibold text-studio-text">
                <Sparkles className="h-4 w-4 text-accent" /> What should change?
              </p>
              <p className="text-[12.5px] leading-relaxed text-studio-muted">
                Say it in words. To be exact, point first: press <kbd className="rounded bg-studio-field px-1 font-mono text-[11px]">M</kbd> for the moment under the playhead, drag along the strip under the picture for a stretch, turn on <Crosshair className="inline h-3 w-3" /> and drag a box on the picture, or press <kbd className="rounded bg-studio-field px-1 font-mono text-[11px]">Ctrl+L</kbd> for the selected clip.
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-studio-border-strong px-2.5 py-1 text-[11.5px] text-studio-muted hover:border-accent hover:text-studio-text cursor-pointer">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {p.messages.map((m, i) =>
            m.role === 'user' ? (
              <div key={i} className="ml-auto max-w-[88%] space-y-1.5 rounded-xl border border-studio-border bg-studio-field px-3 py-2 text-[13px] leading-relaxed text-studio-text">
                {m.refs && m.refs.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {m.refs.map((r) => <RefPill key={r.n} r={r} onHover={p.onHoverRef} onClick={() => p.onJumpRef(r)} />)}
                  </div>
                )}
                <p className="whitespace-pre-wrap">{m.text}</p>
              </div>
            ) : m.role === 'error' ? (
              <p key={i} className="rounded-xl border border-red-900/60 bg-red-950/30 px-3 py-2 text-[12.5px] text-red-200">{m.text}</p>
            ) : (
              <div key={i} className="space-y-1.5 text-[13px] leading-relaxed text-studio-text">
                {m.steps && m.steps.length > 0 && (
                  <ul className="space-y-1">
                    {m.steps.map((s, k) => (
                      <li key={k} className="flex items-start gap-2 text-[12.5px] text-studio-muted">
                        <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
                <p>{m.text}</p>
                {Boolean(m.applied) && i === p.messages.length - 1 && (
                  <div className="flex items-center justify-between rounded-lg border border-studio-border bg-studio-raised px-2.5 py-1.5 text-[11.5px] text-studio-muted">
                    <span>{m.applied} change{m.applied === 1 ? '' : 's'} on the timeline</span>
                    <button type="button" onClick={p.onUndo} disabled={!p.canUndo} className="inline-flex items-center gap-1 text-studio-text hover:text-accent disabled:opacity-40 cursor-pointer">
                      <Undo2 className="h-3 w-3" /> Undo
                    </button>
                  </div>
                )}
              </div>
            )
          )}
          {p.busy && (
            <p className="flex items-center gap-2 text-[12.5px] text-studio-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" /> Reading the timeline and making the changes…
            </p>
          )}
        </div>
      )}

      {/* composer */}
      <form
        className="shrink-0 p-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <div className="rounded-xl border border-studio-border-strong bg-studio-raised p-2 focus-within:border-accent/60">
          {p.draft.length > 0 && (
            <div className="mb-1.5 flex flex-wrap gap-1">
              {p.draft.map((r) => <RefPill key={r.n} r={r} onHover={p.onHoverRef} onClick={() => p.onJumpRef(r)} onRemove={() => p.onRemoveRef(r.n)} />)}
            </div>
          )}
          <textarea
            ref={box}
            id="studio-chat-input"
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(text);
              }
            }}
            placeholder={p.draft.length ? `Say what to change at ${p.draft.map((r) => `[${r.n}]`).join(' ')}…` : 'Say what to change. Point first to be exact.'}
            className="max-h-40 min-h-[44px] w-full resize-none bg-transparent text-[14px] leading-[22px] text-studio-text placeholder:text-studio-faint focus:outline-none"
          />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setMenu((v) => !v)} aria-expanded={menu} title="Point at something" className="grid h-[26px] w-[26px] place-items-center rounded-md text-studio-muted hover:bg-studio-hover hover:text-studio-text cursor-pointer">
                <Plus className="h-4 w-4" />
              </button>
              <span className="text-[11px] text-studio-faint">Local model · Ollama</span>
              {menu && (
                <div className="absolute bottom-8 left-0 z-40 w-60 rounded-[10px] border border-studio-border-strong bg-studio-raised p-1 shadow-[0_16px_40px_rgba(0,0,0,.5)]" onMouseLeave={() => setMenu(false)}>
                  {([
                    [Diamond, 'Moment at the playhead', 'M', p.onAddMoment, false],
                    [Film, 'The selected clip', 'Ctrl+L', p.onAddClip, !p.hasSelection],
                    [Crosshair, p.pointMode ? 'Stop pointing at the picture' : 'Point at part of the picture', '', p.onTogglePoint, false],
                  ] as const).map(([I, label, key, fn, off]) => (
                    <button
                      key={label}
                      type="button"
                      disabled={off}
                      onClick={() => {
                        fn();
                        setMenu(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] text-studio-text hover:bg-studio-hover disabled:opacity-40 cursor-pointer"
                    >
                      <I className="h-3.5 w-3.5 text-studio-muted" />
                      <span className="flex-1">{label}</span>
                      {key && <span className="font-mono text-[10.5px] text-studio-faint">{key}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button type="submit" disabled={p.busy || !text.trim()} aria-label="Send" className="grid h-[26px] w-[26px] place-items-center rounded-md bg-studio-ink text-black disabled:opacity-30 cursor-pointer">
              {p.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
