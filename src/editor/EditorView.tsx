import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import {
  Play,
  Pause,
  Undo2,
  Redo2,
  Download,
  Loader2,
  Clapperboard,
  Plus,
  Trash2,
  ArrowLeft,
  Sparkles,
  SlidersHorizontal,
  AlertCircle,
  Check,
  Scissors,
} from 'lucide-react';
import type { CompositionProps, EditItem, EditProject, EffectId, TemplateId } from './types.ts';
import { FRAME_SIZES, editDuration } from './types.ts';
import { EditorComposition } from '../remotion/EditorComposition.tsx';
import { Timeline } from './Timeline.tsx';
import { Inspector } from './Inspector.tsx';
import { LibraryPanel } from './LibraryPanel.tsx';
import { AiPanel, type ChatMsg } from './AiPanel.tsx';
import { newEffectItem, newMotionItem, newTemplateItem, r2, splitItem, topTrack, uid } from './ops.ts';
import { createEdit, listEdits, loadEdit, saveEditRemote, type EditSummary } from './api.ts';
import type { ClipProject, JobProgress, TranscriptSegment } from '../types.ts';
import type { AssetEntry } from '../assetkit/types.ts';
import { postJson, withProgress } from '../utils/api.ts';
import { formatRelativeDate, formatTimecode } from '../utils/format.ts';

interface Props {
  editId: string | null;
  projects: ClipProject[];
  onOpenEdit: (id: string | null) => void;
  onEditsChanged: () => void;
}

/** Word timings for a transcript segment (even spacing when the text was edited). */
function segWords(seg: TranscriptSegment) {
  const tokens = seg.text.trim().split(/\s+/).filter(Boolean);
  if (seg.words?.length === tokens.length) return seg.words.map((w, i) => ({ ...w, text: tokens[i] }));
  const len = Math.max(0.2, seg.end - seg.start);
  return tokens.map((text, i) => ({ text, start: seg.start + (len * i) / tokens.length, end: seg.start + (len * (i + 1)) / tokens.length }));
}

// ---------------------------------------------------------------- start screen
function EditorStart({ projects, onOpenEdit, onEditsChanged }: Omit<Props, 'editId'>) {
  const [edits, setEdits] = useState<EditSummary[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listEdits().then(setEdits);
  }, []);

  const make = async (key: string, body: Parameters<typeof createEdit>[0]) => {
    setBusy(key);
    setError(null);
    try {
      const e = await createEdit(body);
      onEditsChanged();
      onOpenEdit(e.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create edit.');
    } finally {
      setBusy(null);
    }
  };

  const clipSources = projects.filter((p) => p.sourceType !== 'youtube-embed' && p.clips.length);

  return (
    <div className="flex-1 overflow-y-auto bg-black">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 space-y-8">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-white">Editor</h1>
          <p className="mt-1 text-sm text-zinc-400">Timeline editing with Remotion motion graphics and a local AI assistant.</p>
        </div>

        {error && (
          <p className="flex items-center gap-2 rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 text-xs text-red-200">
            <AlertCircle className="h-4 w-4" /> {error}
          </p>
        )}

        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">New blank edit</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.entries({ '9:16': 'Shorts · Reels · TikTok', '1:1': 'Square feed', '4:5': 'Instagram portrait', '16:9': 'YouTube' }).map(([a, hint]) => (
              <button
                key={a}
                type="button"
                disabled={Boolean(busy)}
                onClick={() => void make(a, { aspect: a, name: `New ${a} edit` })}
                className="rounded-xl border border-zinc-800 bg-surface p-4 text-left hover:border-zinc-600 disabled:opacity-60 cursor-pointer"
              >
                <div className="flex h-14 items-center">
                  <div
                    className="border-2 border-zinc-600 rounded"
                    style={{ height: 48, width: (48 * FRAME_SIZES[a][0]) / FRAME_SIZES[a][1] }}
                  />
                </div>
                <p className="mt-2 text-sm font-semibold text-white">{busy === a ? 'Creating…' : a}</p>
                <p className="text-[11px] text-zinc-500">{hint}</p>
              </button>
            ))}
          </div>
        </section>

        {clipSources.length > 0 && (
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Auto-edit an AI clip</h2>
            <p className="mb-3 text-xs text-zinc-500">Builds the edit for you: footage, karaoke captions, hook banner, zoom punches, progress bar and end card.</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {clipSources.flatMap((p) =>
                p.clips.map((c) => (
                  <button
                    key={`${p.id}_${c.id}`}
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => void make(`${p.id}_${c.id}`, { projectId: p.id, clipId: c.id })}
                    className="flex items-center gap-3 rounded-xl border border-zinc-900 bg-surface p-3 text-left hover:border-zinc-700 disabled:opacity-60 cursor-pointer"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
                      {busy === `${p.id}_${c.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-white">{c.title}</span>
                      <span className="block truncate text-[11px] text-zinc-500">
                        {p.name} · {Math.round(c.end - c.start)}s{typeof c.score === 'number' ? ` · virality ${c.score}` : ''}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </section>
        )}

        {edits.length > 0 && (
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Your edits</h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {edits.map((e) => (
                <div key={e.id} className="group flex items-center gap-3 rounded-xl border border-zinc-900 bg-surface p-3 hover:border-zinc-700">
                  <button type="button" onClick={() => onOpenEdit(e.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left cursor-pointer">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-lavender/10 text-lavender">
                      <Clapperboard className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-white">{e.name}</span>
                      <span className="block text-[11px] text-zinc-500">
                        {e.itemCount} layers · {e.width}×{e.height} · {formatRelativeDate(e.updatedAt)}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    title="Delete edit"
                    onClick={async () => {
                      if (!window.confirm(`Delete "${e.name}"? Rendered MP4s stay in data/exports.`)) return;
                      await fetch(`/api/edits/${e.id}`, { method: 'DELETE' });
                      setEdits((all) => all.filter((x) => x.id !== e.id));
                      onEditsChanged();
                    }}
                    className="p-1.5 text-zinc-600 opacity-0 group-hover:opacity-100 hover:text-red-400 cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- workspace
export function EditorView(props: Props) {
  const { editId, projects, onOpenEdit, onEditsChanged } = props;
  const [edit, setEdit] = useState<EditProject | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setEdit(null);
    setLoadError(null);
    if (editId) loadEdit(editId).then(setEdit).catch((e: Error) => setLoadError(e.message));
  }, [editId]);

  if (!editId) return <EditorStart projects={projects} onOpenEdit={onOpenEdit} onEditsChanged={onEditsChanged} />;
  if (loadError)
    return (
      <div className="flex-1 grid place-items-center text-sm text-zinc-400">
        <div className="text-center">
          <p>{loadError}</p>
          <button type="button" onClick={() => onOpenEdit(null)} className="mt-3 text-accent hover:underline cursor-pointer">
            Back to edits
          </button>
        </div>
      </div>
    );
  if (!edit) return <div className="flex-1 grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>;
  return <Workspace key={edit.id} initial={edit} projects={projects} onClose={() => { onEditsChanged(); onOpenEdit(null); }} />;
}

function Workspace({ initial, projects, onClose }: { initial: EditProject; projects: ClipProject[]; onClose: () => void }) {
  const [edit, setEditState] = useState<EditProject>(initial);
  const past = useRef<EditProject[]>([]);
  const future = useRef<EditProject[]>([]);
  const dragBase = useRef<EditProject | null>(null);
  const [, force] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rightTab, setRightTab] = useState<'inspect' | 'ai'>('ai');
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [render, setRender] = useState<{ busy: boolean; progress: JobProgress | null; url?: string; error?: string }>({ busy: false, progress: null });
  const [exportFormat, setExportFormat] = useState<'mp4' | 'webm' | 'gif' | 'still'>('mp4');
  const [exportQuality, setExportQuality] = useState<'high' | 'standard' | 'draft'>('high');
  const [licenceWarn, setLicenceWarn] = useState<Array<{ name: string; licence: string; status: string }>>([]);
  const [credits, setCredits] = useState<string[]>([]);
  const playerRef = useRef<PlayerRef | null>(null);
  const saveTimer = useRef<number | null>(null);

  const fps = edit.fps;
  const duration = editDuration(edit);
  const durationInFrames = Math.max(1, Math.ceil(duration * fps));
  const selected = edit.items.find((i) => i.id === selectedId) ?? null;

  // ---- persistence (debounced) ----
  const scheduleSave = useCallback((next: EditProject) => {
    setSaveState('saving');
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      saveEditRemote(next)
        .then(() => setSaveState('saved'))
        .catch(() => setSaveState('error'));
    }, 600);
  }, []);

  /** Apply a change. history=false is used while dragging (one entry is pushed on drag end). */
  const apply = useCallback(
    (fn: (e: EditProject) => EditProject, history = true) => {
      setEditState((cur) => {
        const next = fn(cur);
        if (history) {
          past.current.push(dragBase.current ?? cur);
          if (past.current.length > 100) past.current.shift();
          future.current = [];
          dragBase.current = null;
        }
        scheduleSave(next);
        return next;
      });
      force((n) => n + 1);
    },
    [scheduleSave]
  );

  const patchItem = (id: string, patch: Partial<EditItem>, history = true) =>
    apply((e) => ({ ...e, items: e.items.map((i) => (i.id === id ? ({ ...i, ...patch } as EditItem) : i)) }), history);

  const undo = () => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(edit);
    setEditState(prev);
    scheduleSave(prev);
    force((n) => n + 1);
  };
  const redo = () => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(edit);
    setEditState(next);
    scheduleSave(next);
    force((n) => n + 1);
  };

  // ---- player sync ----
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    const onFrame = (e: { detail: { frame: number } }) => setTime(e.detail.frame / fps);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    p.addEventListener('frameupdate', onFrame);
    p.addEventListener('play', onPlay);
    p.addEventListener('pause', onPause);
    return () => {
      p.removeEventListener('frameupdate', onFrame);
      p.removeEventListener('play', onPlay);
      p.removeEventListener('pause', onPause);
    };
  }, [fps]);

  const seek = (t: number) => {
    const f = Math.max(0, Math.min(durationInFrames - 1, Math.round(t * fps)));
    playerRef.current?.seekTo(f);
    setTime(f / fps);
  };
  const togglePlay = () => playerRef.current?.toggle();

  // ---- actions ----
  const addItem = (item: EditItem) => {
    apply((e) => ({ ...e, items: [...e.items, item] }));
    setSelectedId(item.id);
    setRightTab('inspect');
  };
  const addTemplate = (t: TemplateId, props?: Record<string, string | number>) => {
    const item = newTemplateItem(t, time, Math.max(6, topTrack(edit) + 1));
    if (props && item.kind === 'text') {
      item.props = { ...item.props, ...props };
      if (typeof props.style === 'string') item.name = `${item.name} · ${props.style}`;
    }
    addItem(item);
  };
  const addEffect = (fx: EffectId) => addItem(newEffectItem(fx, time));
  const addMotion = (fx: string) => addItem(newMotionItem(fx, time, Math.max(6, topTrack(edit) + 1)));
  const deleteSelected = () => {
    if (!selected) return;
    apply((e) => ({ ...e, items: e.items.filter((i) => i.id !== selected.id) }));
    setSelectedId(null);
  };
  const duplicateSelected = () => {
    if (!selected) return;
    const copy = { ...selected, id: uid('d'), from: r2(selected.from + selected.duration) } as EditItem;
    addItem(copy);
  };
  const splitSelected = () => {
    const target = selected && time > selected.from && time < selected.from + selected.duration ? selected : null;
    if (!target) return;
    const parts = splitItem(target, time);
    if (!parts) return;
    apply((e) => ({ ...e, items: e.items.flatMap((i) => (i.id === target.id ? parts : [i])) }));
    setSelectedId(parts[1].id);
  };

  const addFromDisk = async () => {
    const r = await fetch('/api/pick-file?kind=media');
    const { path } = (await r.json()) as { path: string | null };
    if (!path) return;
    const { asset } = await postJson<{ asset: { url: string; kind: 'video' | 'audio' | 'image'; name: string; duration: number } }>('/api/assets/local', { path });
    const from = r2(time);
    const name = asset.name.replace(/\.[^.]+$/, '');
    if (asset.kind === 'image') addItem({ id: uid('img'), kind: 'image', name, track: Math.max(1, topTrack(edit) + 1), from, duration: 4, src: asset.url, fit: 'contain', scale: 0.7, x: 50, y: 45 });
    else if (asset.kind === 'audio') addItem({ id: uid('a'), kind: 'audio', name, track: 0, from, duration: r2(asset.duration || 10), src: asset.url, sourceStart: 0, volume: 0.6 });
    else addItem({ id: uid('v'), kind: 'video', name, track: 0, from, duration: r2(asset.duration || 10), src: asset.url, sourceStart: 0, volume: 1, fit: 'cover', zoom: 1, panX: 50, panY: 50 });
  };

  /** Drop a library asset at the playhead: backgrounds fill the frame, sprites stand on the ground and walk in. */
  const addAsset = (a: AssetEntry) => {
    const from = r2(time);
    if (a.type === 'background') {
      addItem({ id: uid('bg'), kind: 'image', name: a.name, track: 1, from, duration: 6, src: a.url, fit: 'cover', scale: 1, x: 50, y: 50, depth: 0.35, motion: 'kenBurns', assetId: a.id });
      return;
    }
    const portrait = edit.height > edit.width;
    const hFrac = a.type === 'bird' || a.type === 'object' ? 0.2 : a.type === 'person' ? 0.38 : 0.34;
    const sky = a.type === 'bird';
    addItem({
      id: uid('act'),
      kind: 'image',
      name: a.name,
      track: Math.max(3, topTrack(edit) + 1),
      from,
      duration: 5,
      src: a.url,
      fit: 'contain',
      scale: r2((hFrac * edit.height) / edit.width),
      x: 50,
      y: sky ? 30 : portrait ? 88 : 92,
      anchor: 'bottom',
      motion: sky ? 'fly' : a.type === 'person' || a.type === 'animal' ? 'walkIn' : 'pop',
      depth: sky ? 0.5 : 1.1,
      assetId: a.id,
    });
  };

  const addProjectVideo = (p: ClipProject) => {
    const from = r2(time);
    const src = `/media/uploads/${p.sourceFileName}`;
    const len = r2(p.metadata.duration || 10);
    const words = p.transcript.flatMap(segWords).map((w) => ({ text: w.text, start: r2(w.start), end: r2(w.end) }));
    const items: EditItem[] = [
      { id: uid('v'), kind: 'video', name: p.name, track: 0, from, duration: len, src, previewSrc: p.videoUrl !== src ? p.videoUrl : undefined, sourceStart: 0, volume: 1, fit: 'cover', zoom: 1, panX: 50, panY: 50 },
    ];
    if (words.length) items.push({ id: uid('cap'), kind: 'captions', name: 'Captions', track: Math.max(4, topTrack(edit) + 1), from, duration: len, words, look: 'karaoke', position: 'bottom', accent: '#B5E2DD' });
    apply((e) => ({ ...e, items: [...e.items, ...items] }));
    setSelectedId(items[0].id);
  };

  const sendAi = async (instruction: string) => {
    setChat((c) => [...c, { role: 'user', text: instruction }]);
    setAiBusy(true);
    try {
      // make sure the server has the latest timeline first
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      await saveEditRemote(edit);
      const data = await postJson<{ edit: EditProject; reply: string; applied: number }>(`/api/edits/${edit.id}/ai`, { instruction });
      if (data.applied) {
        past.current.push(edit);
        future.current = [];
        setEditState(data.edit);
        setSaveState('saved');
        force((n) => n + 1);
      }
      setChat((c) => [...c, { role: 'ai', text: data.reply + (data.applied ? '  (Ctrl+Z to undo)' : '') }]);
    } catch (err) {
      setChat((c) => [...c, { role: 'error', text: err instanceof Error ? err.message : 'AI edit failed.' }]);
    } finally {
      setAiBusy(false);
    }
  };

  const startRender = async () => {
    setRender({ busy: true, progress: null });
    try {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      await saveEditRemote(edit);
      const data = await withProgress(
        (jobId) =>
          postJson<{ export: { url: string; fileName: string }; licenceIssues?: Array<{ name: string; licence: string; status: string }>; credits?: string[] }>(
            `/api/edits/${edit.id}/render`,
            { jobId, format: exportFormat, quality: exportQuality, scale: exportQuality === 'draft' ? 0.5 : 1, stillAt: time }
          ),
        (p) => setRender((r) => ({ ...r, progress: p ?? r.progress }))
      );
      setRender({ busy: false, progress: null, url: data.export.url });
      setLicenceWarn(data.licenceIssues ?? []);
      setCredits(data.credits ?? []);
    } catch (err) {
      setRender({ busy: false, progress: null, error: err instanceof Error ? err.message : 'Render failed.' });
    }
  };

  // ---- keyboard ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateSelected();
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelected();
      } else if (e.key.toLowerCase() === 's' && !mod) {
        splitSelected();
      } else if (e.key === 'ArrowLeft') {
        seek(time - (e.shiftKey ? 1 : 1 / fps));
      } else if (e.key === 'ArrowRight') {
        seek(time + (e.shiftKey ? 1 : 1 / fps));
      } else if (e.key === 'Home') {
        seek(0);
      } else if (e.key === 'Escape') {
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const inputProps = useMemo<CompositionProps>(() => ({ edit, assetBase: '', preview: true }), [edit]);
  const aspect = `${edit.width} / ${edit.height}`;

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-black">
      {/* Editor toolbar */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-900 bg-surface px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <button type="button" onClick={onClose} title="All edits" className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-white cursor-pointer">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <input
            value={edit.name}
            onChange={(e) => apply((x) => ({ ...x, name: e.target.value }), false)}
            className="min-w-0 w-44 sm:w-64 bg-transparent text-sm font-semibold text-white focus:outline-none focus:bg-black rounded px-1"
          />
          <span className="hidden sm:inline font-mono text-[11px] text-zinc-500">
            {edit.width}×{edit.height} · {formatTimecode(duration)}
          </span>
          <span className={`text-[11px] ${saveState === 'error' ? 'text-red-400' : 'text-zinc-600'}`}>
            {saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Not saved' : 'Saved'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={undo} disabled={!past.current.length} title="Undo (Ctrl+Z)" className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-white disabled:opacity-30 cursor-pointer">
            <Undo2 className="h-4 w-4" />
          </button>
          <button type="button" onClick={redo} disabled={!future.current.length} title="Redo (Ctrl+Shift+Z)" className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-white disabled:opacity-30 cursor-pointer">
            <Redo2 className="h-4 w-4" />
          </button>
          <select
            value={Object.entries(FRAME_SIZES).find(([, s]) => s[0] === edit.width && s[1] === edit.height)?.[0] ?? '9:16'}
            onChange={(e) => {
              const [w, h] = FRAME_SIZES[e.target.value];
              apply((x) => ({ ...x, width: w, height: h }));
            }}
            className="rounded-md border border-zinc-800 bg-black px-2 py-1 text-xs text-zinc-300 focus:outline-none"
            title="Frame size"
          >
            {Object.keys(FRAME_SIZES).map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
          {render.url && !render.busy && (
            <a href={`/api/download/${render.url.split('/').pop()}`} className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10">
              <Check className="h-3.5 w-3.5" /> Download {render.url.split('.').pop()?.toUpperCase()}
            </a>
          )}
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as typeof exportFormat)}
            className="rounded-md border border-zinc-800 bg-black px-2 py-1 text-xs text-zinc-300 focus:outline-none"
            title="Export format"
            aria-label="Export format"
          >
            <option value="mp4">MP4 (H.264)</option>
            <option value="webm">WebM (VP9)</option>
            <option value="gif">GIF</option>
            <option value="still">Still (PNG at playhead)</option>
          </select>
          {exportFormat !== 'still' && exportFormat !== 'gif' && (
            <select
              value={exportQuality}
              onChange={(e) => setExportQuality(e.target.value as typeof exportQuality)}
              className="rounded-md border border-zinc-800 bg-black px-2 py-1 text-xs text-zinc-300 focus:outline-none"
              title="Quality (Draft renders at half size)"
              aria-label="Export quality"
            >
              <option value="high">High</option>
              <option value="standard">Standard</option>
              <option value="draft">Draft (½ size)</option>
            </select>
          )}
          <button
            type="button"
            onClick={() => void startRender()}
            disabled={render.busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-xs font-semibold text-black hover:bg-accent-strong disabled:opacity-70 cursor-pointer"
          >
            {render.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {render.busy ? `${render.progress?.pct ?? 0}%` : exportFormat === 'still' ? 'Save still' : `Render ${exportFormat.toUpperCase()}`}
          </button>
        </div>
      </div>
      {licenceWarn.length > 0 && !render.busy && (
        <div className="shrink-0 flex items-start gap-2 border-b border-zinc-900 bg-peach/10 px-4 py-2 text-xs text-peach">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">
            Check before using this video commercially — {licenceWarn.length} of your PNG{licenceWarn.length === 1 ? '' : 's'} {licenceWarn.length === 1 ? 'is' : 'are'} not cleared:{' '}
            {licenceWarn.map((w) => `${w.name} (${w.status === 'restricted' ? `restricted: ${w.licence}` : 'licence not checked'})`).join(', ')}. Record licences in Assets → click the ? badge.
          </span>
          <button type="button" onClick={() => setLicenceWarn([])} className="text-peach/70 hover:text-peach cursor-pointer">
            Dismiss
          </button>
        </div>
      )}
      {credits.length > 0 && !render.busy && (
        <div className="shrink-0 flex items-start gap-2 border-b border-zinc-900 bg-lavender/10 px-4 py-2 text-xs text-lavender">
          <span className="flex-1">
            <b>Credits required</b> — add to your post description: {credits.join(' · ')}
          </span>
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(`Credits:\n${credits.join('\n')}`)}
            className="rounded border border-lavender/40 px-2 py-0.5 hover:bg-lavender/10 cursor-pointer"
          >
            Copy
          </button>
          <button type="button" onClick={() => setCredits([])} className="text-lavender/70 hover:text-lavender cursor-pointer">
            Dismiss
          </button>
        </div>
      )}
      {(render.busy || render.error) && (
        <div className={`shrink-0 px-4 py-1.5 text-xs border-b border-zinc-900 ${render.error ? 'bg-red-950/30 text-red-200' : 'bg-surface text-zinc-300'}`}>
          {render.error ? (
            <span className="flex items-center gap-2"><AlertCircle className="h-3.5 w-3.5" /> {render.error}</span>
          ) : (
            <div className="flex items-center gap-3">
              <span className="shrink-0">{render.progress?.label || 'Starting Remotion…'}</span>
              <div className="h-1 flex-1 rounded-full bg-zinc-900 overflow-hidden">
                <div className="h-full bg-brand-gradient animate-shimmer transition-[width] duration-500" style={{ width: `${Math.max(2, render.progress?.pct ?? 2)}%` }} />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 flex">
        {/* Left: library */}
        <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-zinc-900 bg-surface">
          <LibraryPanel projects={projects} onAddTemplate={addTemplate} onAddEffect={addEffect} onAddMotion={addMotion} aspect={{ width: edit.width, height: edit.height }} onAddFile={addFromDisk} onAddProjectVideo={addProjectVideo} onAddAsset={addAsset} />
        </aside>

        {/* Centre: preview + timeline */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex-1 min-h-0 flex items-center justify-center p-4 bg-[radial-gradient(circle_at_center,#0d0d10,#000)]">
            <div className="relative h-full max-h-full max-w-full overflow-hidden rounded-lg border border-zinc-800 shadow-2xl" style={{ aspectRatio: aspect }}>
              <Player
                ref={playerRef}
                component={EditorComposition}
                inputProps={inputProps}
                durationInFrames={durationInFrames}
                compositionWidth={edit.width}
                compositionHeight={edit.height}
                fps={fps}
                style={{ width: '100%', height: '100%' }}
                clickToPlay
                acknowledgeRemotionLicense
              />
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-3 border-t border-zinc-900 bg-surface px-3 py-1.5">
            <button type="button" onClick={togglePlay} className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-2.5 py-1 text-xs text-white hover:bg-zinc-800 cursor-pointer">
              {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {playing ? 'Pause' : 'Play'}
            </button>
            <span className="font-mono text-xs text-zinc-300">
              {formatTimecode(time, true)} <span className="text-zinc-600">/</span> {formatTimecode(duration, true)}
            </span>
            <button type="button" onClick={splitSelected} disabled={!selected} title="Split selected at playhead (S)" className="ml-auto inline-flex items-center gap-1 rounded-md border border-zinc-800 px-2 py-1 text-[11px] text-zinc-300 hover:text-white disabled:opacity-30 cursor-pointer">
              <Scissors className="h-3 w-3" /> Split
            </button>
            <button type="button" onClick={() => addTemplate('title')} title="Add a title at the playhead" className="inline-flex items-center gap-1 rounded-md border border-zinc-800 px-2 py-1 text-[11px] text-zinc-300 hover:text-white cursor-pointer">
              <Plus className="h-3 w-3" /> Text
            </button>
          </div>
          <div className="h-[34%] min-h-[170px] max-h-[320px]">
            <Timeline
              edit={edit}
              duration={duration}
              time={time}
              selectedId={selectedId}
              onSeek={seek}
              onSelect={(id) => {
                setSelectedId(id);
                if (id) setRightTab('inspect');
              }}
              onDrag={(id, patch) => {
                if (!dragBase.current) dragBase.current = edit;
                patchItem(id, patch, false);
              }}
              onDragEnd={() => apply((e) => e, true)}
            />
          </div>
        </div>

        {/* Right: inspector / AI */}
        <aside className="w-full max-w-[320px] shrink-0 hidden sm:flex flex-col border-l border-zinc-900 bg-surface">
          <div className="grid grid-cols-2 border-b border-zinc-900">
            {([
              ['ai', 'Edit with AI', Sparkles],
              ['inspect', 'Inspector', SlidersHorizontal],
            ] as const).map(([id, label, I]) => (
              <button
                key={id}
                type="button"
                onClick={() => setRightTab(id)}
                className={`flex items-center justify-center gap-1.5 py-2.5 text-xs cursor-pointer ${rightTab === id ? 'text-white shadow-[inset_0_-2px_0_var(--color-accent)]' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                <I className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {rightTab === 'ai' ? (
              <AiPanel messages={chat} busy={aiBusy} onSend={(t) => void sendAi(t)} />
            ) : selected ? (
              <Inspector
                item={selected}
                onChange={(patch, commit) => {
                  if (commit === false && !dragBase.current) dragBase.current = edit; // slider drag: undo returns to the start value
                  patchItem(selected.id, patch, commit !== false);
                }}
                onDelete={deleteSelected}
                onDuplicate={duplicateSelected}
                onSplit={splitSelected}
              />
            ) : (
              <div className="p-4 text-xs text-zinc-500 space-y-2">
                <p>Select a layer on the timeline to edit it.</p>
                <p className="text-zinc-600">Shortcuts: Space play · S split · Del delete · Ctrl+D duplicate · Ctrl+Z undo · ←/→ frame (Shift = 1 s)</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
