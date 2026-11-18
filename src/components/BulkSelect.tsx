import { useState } from 'react';
import { CheckSquare, Loader2, Square, Trash2, X } from 'lucide-react';

/** Selection state for a list: which ids are ticked, and whether select mode is on. */
export function useSelection() {
  const [selecting, setSelecting] = useState(false);
  const [ids, setIds] = useState<Set<string>>(new Set());
  return {
    selecting,
    ids,
    has: (id: string) => ids.has(id),
    toggle: (id: string) =>
      setIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    setAll: (all: string[]) => setIds(new Set(all)),
    start: () => setSelecting(true),
    stop: () => {
      setSelecting(false);
      setIds(new Set());
    },
  };
}
export type Selection = ReturnType<typeof useSelection>;

/** A tick box for one row (only shown in select mode). */
export function SelectBox({ sel, id, label }: { sel: Selection; id: string; label: string }) {
  if (!sel.selecting) return null;
  const on = sel.has(id);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        sel.toggle(id);
      }}
      aria-label={`${on ? 'Unselect' : 'Select'} ${label}`}
      aria-pressed={on}
      className={`shrink-0 cursor-pointer ${on ? 'text-accent' : 'text-zinc-500 hover:text-zinc-300'}`}
    >
      {on ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
    </button>
  );
}

/**
 * "Select" button, then: Select all · Clear · Delete N (one confirm, one request) · Done.
 * `noun` names what is deleted ("video", "script"); `note` says what stays on disk.
 */
export function BulkBar({ sel, allIds, noun, note, onDelete }: { sel: Selection; allIds: string[]; noun: string; note?: string; onDelete: (ids: string[]) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  if (!allIds.length) return null;
  const btn = 'inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 px-2.5 py-1 text-[11px] text-zinc-300 hover:border-zinc-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40';
  if (!sel.selecting)
    return (
      <button type="button" onClick={sel.start} className={btn}>
        <CheckSquare className="h-3.5 w-3.5" /> Select
      </button>
    );
  const n = [...sel.ids].filter((id) => allIds.includes(id)).length;
  const all = n === allIds.length;
  const plural = (k: number) => `${k} ${noun}${k === 1 ? '' : 's'}`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => (all ? sel.setAll([]) : sel.setAll(allIds))} className={btn}>
        {all ? <Square className="h-3.5 w-3.5" /> : <CheckSquare className="h-3.5 w-3.5" />}
        {all ? 'Clear' : `Select all (${allIds.length})`}
      </button>
      <button
        type="button"
        disabled={!n || busy}
        onClick={async () => {
          if (!window.confirm(`Delete ${plural(n)}? This can't be undone.${note ? `\n\n${note}` : ''}`)) return;
          setBusy(true);
          try {
            await onDelete([...sel.ids].filter((id) => allIds.includes(id)));
            sel.stop();
          } finally {
            setBusy(false);
          }
        }}
        className={`${btn} border-red-900/60 text-red-300 hover:border-red-500 hover:text-red-200`}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        Delete {n ? plural(n) : ''}
      </button>
      <button type="button" onClick={sel.stop} className={btn}>
        <X className="h-3.5 w-3.5" /> Done
      </button>
    </div>
  );
}
