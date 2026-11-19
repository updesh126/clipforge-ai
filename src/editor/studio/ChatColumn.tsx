import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowUp, BookOpen, Crosshair, Paperclip, Clapperboard, Diamond, Film, Library, Loader2, MessageSquare, PanelLeftClose, Plus, Sparkles, Undo2, X } from 'lucide-react';
import { REF_COLOR, refText, type StudioRef } from './refs.ts';
import { allTags, searchTags, type TagInfo } from '../../motion/tagInfo.ts';

export interface ChatMsg {
  role: 'user' | 'ai' | 'error';
  text: string;
  refs?: StudioRef[]; // what the user pointed at with this message
  steps?: string[]; // what the AI changed, one sentence each
  applied?: number;
  suggest?: TagInfo[]; // effects that match the request, when the AI could not make a change
  files?: string[]; // clips sent with this message
}

const SUGGESTIONS = [
  'Make the opening punchier',
  'Add a big stat where a number is said',
  'Highlight the key sentence with a marker',
  'Add a lower third for the speaker',
  'Switch captions to pop style',
];

/** Tags apply at once, at what you pointed at or the playhead (no model needed). Same tags as scripts. */
const TAG_EXAMPLES = ['[creatorSlam "YOU NEED *REPS*"]', '[chalkCounter 30 "of its data" "can lose up to" %]', '[cleanChecklist "Plan; Build; Launch"]', '[creatorCounter 200 "real leads"]'];

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
  /** clips attached to the message: cut, captioned and directed by the AI */
  onSendClips: (files: File[], text: string) => void;
  progress?: string | null;
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
  const [caret, setCaret] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [fileDrop, setFileDrop] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const addFiles = (list: FileList | File[] | null) => {
    const ok = [...(list ?? [])].filter((f) => /^(video|audio|image)\//.test(f.type) || /\.(mp4|mov|mkv|webm|m4v|mp3|wav|m4a|png|jpe?g|webp)$/i.test(f.name));
    if (ok.length) setFiles((cur) => [...cur, ...ok].slice(0, 20));
  };
  const [pick, setPick] = useState<{ start: number; end: number; q: string } | null>(null); // the effects picker
  const [pickIdx, setPickIdx] = useState(0);
  const results = useMemo(() => (pick ? searchTags(pick.q, 40) : []), [pick]);

  /** Open the picker while the word at the cursor is "[name" or "/name" (not "[1]" references, not once values follow). */
  const trigger = (value: string, at: number) => {
    const before = value.slice(0, at);
    const m = /\[([A-Za-z][\w-]*)?$/.exec(before) ?? /^\/([A-Za-z][\w-]*)?$/.exec(before);
    if (m) {
      setPick({ start: m.index, end: at, q: m[1] ?? '' });
      setPickIdx(0);
    } else setPick(null);
  };
  /** The tag being written at the cursor, for the "values: …" hint under it. */
  const writing: TagInfo | null = useMemo(() => {
    const m = /\[([A-Za-z][\w-]*)\s[^\]]*$/.exec(text.slice(0, caret));
    if (!m) return null;
    const id = m[1].toLowerCase().replace(/-/g, '');
    return allTags().find((t) => t.id.toLowerCase() === id) ?? null;
  }, [text, caret]);
  const insert = (t: TagInfo) => {
    const start = pick?.start ?? caret, end = pick?.end ?? caret;
    const next = `${text.slice(0, start)}${t.usage} ${text.slice(end)}`;
    setText(next);
    setPick(null);
    const at = start + t.usage.length + 1;
    requestAnimationFrame(() => {
      box.current?.focus();
      box.current?.setSelectionRange(at, at);
      setCaret(at);
    });
  };
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
    if (p.busy) return;
    if (files.length) {
      p.onSendClips(files, v);
      setFiles([]);
      setText('');
      return;
    }
    if (!v) return;
    p.onSend(v);
    setText('');
  };

  return (
    <div
      className={`relative flex h-full min-h-0 flex-col bg-studio-panel ${fileDrop ? 'ring-2 ring-inset ring-accent' : ''}`}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        setFileDrop(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setFileDrop(false);
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        setFileDrop(false);
        addFiles(e.dataTransfer.files);
        p.onToggleLibrary(false);
      }}
    >
      {fileDrop && <div className="pointer-events-none absolute inset-0 z-50 grid place-items-center bg-black/60 text-[13px] font-medium text-studio-text">Drop clips to edit them</div>}
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
                Drop your clips here (or press <Paperclip className="inline h-3 w-3" /> Clips) and say how to edit them, in any language: “edit these like a reel”, “bilkul mast edit kar de”. ClipForge cuts them in order, adds captions, then picks motion graphics and effects from what is said.
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
              <p className="pt-2 text-[12px] text-studio-muted">Or type a tag to add a graphic straight away (same tags as scripts):</p>
              <div className="flex flex-wrap gap-1.5">
                {TAG_EXAMPLES.map((t) => (
                  <button key={t} type="button" onClick={() => send(t)} className="rounded-md border border-studio-border-strong bg-studio-raised px-2 py-1 font-mono text-[11px] text-studio-text hover:border-accent cursor-pointer">
                    {t}
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
                {m.files && m.files.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {m.files.map((f, k) => (
                      <span key={k} className="inline-flex max-w-full items-center gap-1 rounded-md bg-studio-raised px-1.5 py-0.5 text-[11px] text-studio-muted"><Clapperboard className="h-3 w-3 shrink-0" /><span className="truncate">{f}</span></span>
                    ))}
                  </div>
                )}
                {m.text && <p className="whitespace-pre-wrap">{m.text}</p>}
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
                {m.suggest && m.suggest.length > 0 && (
                  <div className="space-y-1.5">
                    {m.suggest.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setPick(null);
                          setText((cur) => `${cur ? cur.trimEnd() + ' ' : ''}${t.usage} `);
                          box.current?.focus();
                        }}
                        className="block w-full rounded-lg border border-studio-border bg-studio-raised px-2.5 py-2 text-left hover:border-accent/60 cursor-pointer"
                      >
                        <span className="block text-[12.5px] font-medium text-studio-text">{t.label}</span>
                        <span className="block text-[11.5px] text-studio-muted">{t.description}</span>
                        <span className="mt-1 block truncate font-mono text-[11px] text-accent">{t.usage}</span>
                      </button>
                    ))}
                    <p className="text-[11px] text-studio-faint">Click one to put it in your message, change the values, then send.</p>
                  </div>
                )}
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
              <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" /> {p.progress || 'Reading the timeline and making the changes…'}
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
        <div className="relative rounded-xl border border-studio-border-strong bg-studio-raised p-2 focus-within:border-accent/60">
          {pick && (
            <div className="absolute bottom-full left-0 right-0 z-40 mb-1.5 overflow-hidden rounded-[10px] border border-studio-border-strong bg-studio-raised shadow-[0_16px_40px_rgba(0,0,0,.5)]">
              <div className="flex items-center justify-between gap-2 border-b border-studio-border px-2.5 py-1.5 text-[11px] text-studio-faint">
                <span className="truncate">{pick.q ? `Effects matching “${pick.q}”` : `All ${allTags().length} effects and motions`}</span>
                <span className="shrink-0">↑↓ · Enter · Esc</span>
              </div>
              <div role="listbox" aria-label="Effects" className="max-h-80 overflow-y-auto p-1">
                {results.map((t, i) => (
                  <button
                    key={t.id}
                    type="button"
                    role="option"
                    aria-selected={i === pickIdx}
                    onMouseEnter={() => setPickIdx(i)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insert(t);
                    }}
                    className={`block w-full rounded-md px-2.5 py-2 text-left cursor-pointer ${i === pickIdx ? 'bg-studio-hover' : ''}`}
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[12.5px] font-medium text-studio-text">{t.label}</span>
                      <span className="shrink-0 text-[10.5px] text-studio-faint">{t.group}</span>
                    </span>
                    <span className="block text-[11.5px] leading-snug text-studio-muted">{t.description}</span>
                    <span className="mt-1 block truncate font-mono text-[11px] text-accent">{t.usage}</span>
                    {t.args.length > 0 && <span className="block text-[10.5px] text-studio-faint">values in order: {t.args.join(', ')}</span>}
                  </button>
                ))}
                {!results.length && <p className="px-2.5 py-3 text-[12px] text-studio-muted">No effect called “{pick.q}”. Try a word from what it does: counter, map, chalk, highlight…</p>}
              </div>
            </div>
          )}
          {p.draft.length > 0 && (
            <div className="mb-1.5 flex flex-wrap gap-1">
              {p.draft.map((r) => <RefPill key={r.n} r={r} onHover={p.onHoverRef} onClick={() => p.onJumpRef(r)} onRemove={() => p.onRemoveRef(r.n)} />)}
            </div>
          )}
          {files.length > 0 && (
            <div className="mb-1.5 flex flex-wrap gap-1">
              {files.map((f, k) => (
                <span key={k} className="inline-flex max-w-full items-center gap-1 rounded-md border border-studio-border bg-studio-field pl-1.5 pr-1 text-[11px] text-studio-text">
                  <Clapperboard className="h-3 w-3 shrink-0 text-studio-muted" />
                  <span className="truncate">{f.name}</span>
                  <span className="shrink-0 text-studio-faint">{(f.size / 1e6).toFixed(f.size > 1e8 ? 0 : 1)} MB</span>
                  <button type="button" onClick={() => setFiles((cur) => cur.filter((_, j) => j !== k))} aria-label={`Remove ${f.name}`} className="text-studio-faint hover:text-studio-text cursor-pointer"><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
          )}
          <textarea
            ref={box}
            id="studio-chat-input"
            rows={2}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setCaret(e.target.selectionStart);
              trigger(e.target.value, e.target.selectionStart);
            }}
            onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
            onKeyDown={(e) => {
              if (pick && results.length) {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  setPickIdx((i) => (i + (e.key === 'ArrowDown' ? 1 : results.length - 1)) % results.length);
                  return;
                }
                if (e.key === 'Enter' || e.key === 'Tab') {
                  e.preventDefault();
                  insert(results[pickIdx]);
                  return;
                }
              }
              if (pick && e.key === 'Escape') {
                e.preventDefault();
                setPick(null);
                return;
              }
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(text);
              }
            }}
            placeholder={files.length ? 'How should I edit these? e.g. “punchy reel, Creator style”' : p.draft.length ? `Say what to change at ${p.draft.map((r) => `[${r.n}]`).join(' ')}…` : 'Say what to change, or type [ for an effect by name'}
            className="max-h-40 min-h-[44px] w-full resize-none bg-transparent text-[14px] leading-[22px] text-studio-text placeholder:text-studio-faint focus:outline-none"
          />
          {writing && !pick && (
            <p className="mb-1 truncate text-[11px] text-studio-faint">
              <span className="text-studio-muted">{writing.label}</span>{writing.args.length ? ` · values in order: ${writing.args.join(', ')}` : ' · no values needed'}
            </p>
          )}
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setMenu((v) => !v)} aria-expanded={menu} title="Point at something" className="grid h-[26px] w-[26px] place-items-center rounded-md text-studio-muted hover:bg-studio-hover hover:text-studio-text cursor-pointer">
                <Plus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pick) setPick(null);
                  else {
                    setPick({ start: caret, end: caret, q: '' });
                    setPickIdx(0);
                  }
                }}
                aria-expanded={Boolean(pick)}
                title="Effects and motions by name, with how to use them ([ or /)"
                className="inline-flex h-[26px] items-center gap-1 rounded-md px-1.5 text-[11.5px] text-studio-muted hover:bg-studio-hover hover:text-studio-text cursor-pointer"
              >
                <BookOpen className="h-3.5 w-3.5" /> Effects
              </button>
              <button type="button" onClick={() => fileInput.current?.click()} title="Add clips to edit (or drop them on the chat)" className="inline-flex h-[26px] items-center gap-1 rounded-md px-1.5 text-[11.5px] text-studio-muted hover:bg-studio-hover hover:text-studio-text cursor-pointer">
                <Paperclip className="h-3.5 w-3.5" /> Clips
              </button>
              <input
                ref={fileInput}
                id="studio-clip-files"
                type="file"
                multiple
                accept="video/*,audio/*,image/*"
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = '';
                }}
              />
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
            <button type="submit" disabled={p.busy || (!text.trim() && !files.length)} aria-label="Send" className="grid h-[26px] w-[26px] place-items-center rounded-md bg-studio-ink text-black disabled:opacity-30 cursor-pointer">
              {p.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
