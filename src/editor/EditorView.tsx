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
  ChevronDown,
  Crosshair,
  Diamond,
  Maximize2,
  Repeat,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  LayoutPanelLeft,
  ZoomIn,
  ZoomOut,
  Film,
  MonitorPlay,
  LayoutGrid,
  Palette,
  Info,
} from 'lucide-react';
import type { CompositionProps, EditItem, EditProject, EffectId, TemplateId } from './types.ts';
import { FRAME_SIZES, editDuration } from './types.ts';
import { EditorComposition } from '../remotion/EditorComposition.tsx';
import { Timeline } from './Timeline.tsx';
import { Inspector } from './Inspector.tsx';
import { LibraryPanel } from './LibraryPanel.tsx';
import { ChatColumn, type ChatMsg } from './studio/ChatColumn.tsx';
import { nextN, refTime, type StudioRef } from './studio/refs.ts';
import { PRESETS, DEFAULT_LAYOUT, useStudioLayout } from './studio/layout.ts';
import { Splitter } from './studio/Splitter.tsx';
import { PointStrip, RegionOverlay } from './studio/Pointing.tsx';
import { KIND_STYLE, itemLabel } from './ops.ts';
import { newEffectItem, newMotionItem, newTemplateItem, r2, splitItem, topTrack, uid } from './ops.ts';
import { createEdit, listEdits, loadEdit, saveEditRemote, type EditSummary } from './api.ts';
import type { ClipProject, JobProgress, TranscriptSegment } from '../types.ts';
import type { AssetEntry } from '../assetkit/types.ts';
import { postJson, withProgress } from '../utils/api.ts';
import { BulkBar, SelectBox, useSelection } from '../components/BulkSelect.tsx';
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
  const editSel = useSelection();
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
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Your edits</h2>
              <BulkBar
                sel={editSel}
                allIds={edits.map((e) => e.id)}
                noun="video"
                note="Their voice-overs are removed too. Rendered MP4s stay in data/exports."
                onDelete={async (ids) => {
                  await postJson('/api/edits/bulk-delete', { ids });
                  setEdits((all) => all.filter((x) => !ids.includes(x.id)));
                  onEditsChanged();
                }}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {edits.map((e) => (
                <div key={e.id} className={`group flex items-center gap-3 rounded-xl border bg-surface p-3 hover:border-zinc-700 ${editSel.has(e.id) ? 'border-accent' : 'border-zinc-900'}`}>
                  <SelectBox sel={editSel} id={e.id} label={e.name} />
                  <button type="button" onClick={() => (editSel.selecting ? editSel.toggle(e.id) : onOpenEdit(e.id))} className="flex min-w-0 flex-1 items-center gap-3 text-left cursor-pointer">
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
                  {!editSel.selecting && <button
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
                  </button>}
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
  const [inspTab, setInspTab] = useState<'properties' | 'info'>('properties');
  const { layout, set: setLayout, reset: resetLayout } = useStudioLayout();
  const [refs, setRefs] = useState<StudioRef[]>([]); // pointed at, waiting to go with the next message
  const [hot, setHot] = useState<number | null>(null); // reference under the mouse
  const [pointMode, setPointMode] = useState(false);
  const [pps, setPps] = useState(40);
  const [loop, setLoop] = useState(false);
  const [rate, setRate] = useState(1);
  const [menu, setMenu] = useState<null | 'layout' | 'editor'>(null);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const chatKey = `clipforge.chat.${initial.id}`;
  const [chat, setChat] = useState<ChatMsg[]>(() => {
    try {
      return (JSON.parse(localStorage.getItem(chatKey) || '[]') as ChatMsg[]).slice(-60);
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(chatKey, JSON.stringify(chat.slice(-60)));
    } catch {
      /* storage blocked: chat lasts until the page closes */
    }
  }, [chat, chatKey]);
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
    setInspTab('properties');
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

  const addRef = (r: Omit<StudioRef, 'n'>) => {
    setRefs((cur) => [...cur, { ...r, n: nextN([...cur, ...chat.flatMap((m) => m.refs ?? [])]) }]);
    setLayout({ chat: true, library: false });
  };
  const addMoment = (t = time) => addRef({ kind: 'moment', t: r2(t) });
  const addRange = (t0: number, t1: number) => addRef({ kind: 'range', t0: r2(t0), t1: r2(t1) });
  const addRegion = (box: { x: number; y: number; w: number; h: number }) => {
    addRef({ kind: 'region', t: r2(time), box: { x: r2(box.x), y: r2(box.y), w: r2(box.w), h: r2(box.h) } });
    setPointMode(false);
  };
  const addClipRef = () => {
    if (selected) addRef({ kind: 'clip', itemId: selected.id, label: itemLabel(selected), t: r2(selected.from) });
  };
  const jumpRef = (r: StudioRef) => {
    seek(refTime(r));
    if (r.kind === 'clip' && r.itemId) setSelectedId(r.itemId);
  };
  const allRefs = [...chat.flatMap((m) => m.refs ?? []), ...refs];

  const sendAi = async (instruction: string) => {
    const sent = refs;
    setRefs([]);
    setChat((c) => [...c, { role: 'user', text: instruction, refs: sent.length ? sent : undefined }]);
    setAiBusy(true);
    try {
      // make sure the server has the latest timeline first
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      await saveEditRemote(edit);
      const data = await postJson<{ edit: EditProject; reply: string; applied: number; steps?: string[] }>(`/api/edits/${edit.id}/ai`, { instruction, refs: sent });
      if (data.applied) {
        past.current.push(edit);
        future.current = [];
        setEditState(data.edit);
        setSaveState('saved');
        force((n) => n + 1);
      }
      setChat((c) => [...c, { role: 'ai', text: data.reply, steps: data.steps, applied: data.applied }]);
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
      if (mod && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setLayout({ chat: !layout.chat });
      } else if (mod && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        addClipRef();
      } else if (!mod && e.key.toLowerCase() === 'm') {
        addMoment();
      } else if (e.key === '`') {
        playerRef.current?.requestFullscreen();
      } else if (mod && e.key.toLowerCase() === 'z') {
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
        if (pointMode) setPointMode(false);
        else if (menu) setMenu(null);
        else setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const inputProps = useMemo<CompositionProps>(() => ({ edit, assetBase: '', preview: true }), [edit]);
  const aspect = `${edit.width} / ${edit.height}`;
  const tb = 'inline-flex h-[26px] min-w-[26px] items-center justify-center gap-1.5 rounded-md px-1.5 text-[12px] text-studio-muted hover:bg-studio-hover hover:text-studio-text disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer';
  const sel = 'h-[26px] rounded-md border border-studio-border bg-studio-field px-1.5 text-[12px] text-studio-text focus:outline-none focus:border-accent';
  const EDITORS: Array<{ id: string; label: string; icon: typeof Film; key: string; ready: boolean }> = [
    { id: 'screening', label: 'Screening', icon: MonitorPlay, key: 'Alt+1', ready: false },
    { id: 'edit', label: 'Edit', icon: Film, key: 'Alt+2', ready: true },
    { id: 'canvas', label: 'Canvas', icon: LayoutGrid, key: 'Alt+3', ready: false },
    { id: 'color', label: 'Color', icon: Palette, key: 'Alt+4', ready: false },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-studio-app text-studio-text [color-scheme:dark]" onClick={() => menu && setMenu(null)}>
      {/* Studio bar: project tab on the left, layout / editor / export on the right */}
      <div className="relative z-40 flex h-8 shrink-0 items-center border-b border-black bg-studio-bar">
        <button type="button" onClick={onClose} title="All edits" className="grid h-8 w-9 place-items-center text-studio-muted hover:bg-studio-hover hover:text-studio-text cursor-pointer">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex h-8 min-w-[140px] max-w-[280px] items-center gap-2 border-x border-studio-border-strong bg-studio-panel px-3">
          <span className={`h-[5px] w-[5px] shrink-0 rounded-full ${aiBusy ? 'bg-peach' : saveState === 'error' ? 'bg-red-400' : 'bg-accent'}`} title={aiBusy ? 'The AI is working' : saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Not saved' : 'Saved'} />
          <input
            aria-label="Edit name"
            value={edit.name}
            onChange={(e) => apply((x) => ({ ...x, name: e.target.value }), false)}
            className="min-w-0 flex-1 bg-transparent text-[12.5px] font-medium text-studio-text focus:outline-none"
          />
        </div>
        <span className="hidden px-3 font-mono text-[11px] text-studio-faint md:inline">
          {edit.width}×{edit.height} · {formatTimecode(duration)} · {saveState === 'saving' ? 'saving…' : saveState === 'error' ? <span className="text-red-400">not saved</span> : 'saved'}
        </span>
        <div className="ml-auto flex items-center gap-1 pr-2">
          {!layout.chat && (
            <button type="button" onClick={() => setLayout({ chat: true })} className={tb} title="Show chat (Ctrl+Shift+L)">
              <PanelLeftOpen className="h-4 w-4" /> Chat
            </button>
          )}
          <div className="relative">
            <button type="button" onClick={(e) => { e.stopPropagation(); setMenu(menu === 'layout' ? null : 'layout'); }} aria-expanded={menu === 'layout'} className={tb} title="Layout">
              <LayoutPanelLeft className="h-4 w-4" /> <span className="hidden lg:inline">Layout</span>
            </button>
            {menu === 'layout' && (
              <div onClick={(e) => e.stopPropagation()} className="absolute right-0 top-8 w-60 rounded-[10px] border border-studio-border-strong bg-studio-raised p-1 shadow-[0_16px_40px_rgba(0,0,0,.5)]">
                {PRESETS.map((pr) => (
                  <button key={pr.id} type="button" onClick={() => { setLayout(pr.apply(layout)); setMenu(null); }} className="block w-full rounded-md px-2.5 py-1.5 text-left hover:bg-studio-hover cursor-pointer">
                    <span className="block text-[12.5px] text-studio-text">{pr.label}</span>
                    <span className="block text-[11px] text-studio-faint">{pr.hint}</span>
                  </button>
                ))}
                <div className="my-1 h-px bg-studio-border" />
                <button type="button" onClick={() => { resetLayout(); setMenu(null); }} className="block w-full rounded-md px-2.5 py-1.5 text-left text-[12.5px] text-studio-muted hover:bg-studio-hover hover:text-studio-text cursor-pointer">
                  Reset sizes
                </button>
              </div>
            )}
          </div>
          <div className="relative">
            <button type="button" onClick={(e) => { e.stopPropagation(); setMenu(menu === 'editor' ? null : 'editor'); }} aria-expanded={menu === 'editor'} className="inline-flex h-[26px] items-center gap-1.5 rounded-md bg-studio-hover px-2.5 text-[12.5px] font-medium text-studio-text hover:bg-studio-field cursor-pointer">
              <Film className="h-3.5 w-3.5" /> Edit <ChevronDown className="h-3 w-3 text-studio-muted" />
            </button>
            {menu === 'editor' && (
              <div onClick={(e) => e.stopPropagation()} className="absolute right-0 top-8 w-[200px] rounded-[10px] border border-studio-border-strong bg-studio-raised p-1 shadow-[0_16px_40px_rgba(0,0,0,.5)]">
                {EDITORS.map((ed) => {
                  const I = ed.icon;
                  return (
                    <button key={ed.id} type="button" disabled={!ed.ready} onClick={() => setMenu(null)} className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12.5px] hover:bg-studio-hover disabled:hover:bg-transparent cursor-pointer disabled:cursor-default ${ed.id === 'edit' ? 'text-accent' : ed.ready ? 'text-studio-text' : 'text-studio-faint'}`}>
                      <I className="h-3.5 w-3.5" />
                      <span className="flex-1">{ed.label}</span>
                      <span className="font-mono text-[10.5px] text-studio-faint">{ed.ready ? ed.key : 'soon'}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <select
            value={Object.entries(FRAME_SIZES).find(([, s]) => s[0] === edit.width && s[1] === edit.height)?.[0] ?? '9:16'}
            onChange={(e) => {
              const [w, h] = FRAME_SIZES[e.target.value];
              apply((x) => ({ ...x, width: w, height: h }));
            }}
            className={sel}
            title="Frame size"
            aria-label="Frame size"
          >
            {Object.keys(FRAME_SIZES).map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
          {render.url && !render.busy && (
            <a href={`/api/download/${render.url.split('/').pop()}`} className="inline-flex h-[26px] items-center gap-1.5 rounded-md border border-accent/40 px-2.5 text-[12px] font-medium text-accent hover:bg-accent/10">
              <Check className="h-3.5 w-3.5" /> {render.url.split('.').pop()?.toUpperCase()}
            </a>
          )}
          <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value as typeof exportFormat)} className={`${sel} hidden sm:block`} title="Export format" aria-label="Export format">
            <option value="mp4">MP4 (H.264)</option>
            <option value="webm">WebM (VP9)</option>
            <option value="gif">GIF</option>
            <option value="still">Still (PNG at playhead)</option>
          </select>
          {exportFormat !== 'still' && exportFormat !== 'gif' && (
            <select value={exportQuality} onChange={(e) => setExportQuality(e.target.value as typeof exportQuality)} className={`${sel} hidden lg:block`} title="Quality (Draft renders at half size)" aria-label="Export quality">
              <option value="high">High</option>
              <option value="standard">Standard</option>
              <option value="draft">Draft (½ size)</option>
            </select>
          )}
          <button
            type="button"
            onClick={() => void startRender()}
            disabled={render.busy}
            className="inline-flex h-[26px] items-center gap-1.5 rounded-md bg-studio-ink px-3 text-[12px] font-semibold text-black hover:bg-white disabled:opacity-70 cursor-pointer"
          >
            {render.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {render.busy ? `${render.progress?.pct ?? 0}%` : exportFormat === 'still' ? 'Save still' : 'Export'}
          </button>
        </div>
      </div>

      {licenceWarn.length > 0 && !render.busy && (
        <div className="shrink-0 flex items-start gap-2 border-b border-black bg-peach/10 px-4 py-2 text-xs text-peach">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">
            Check before using this video commercially — {licenceWarn.length} of your PNG{licenceWarn.length === 1 ? '' : 's'} {licenceWarn.length === 1 ? 'is' : 'are'} not cleared:{' '}
            {licenceWarn.map((w) => `${w.name} (${w.status === 'restricted' ? `restricted: ${w.licence}` : 'licence not checked'})`).join(', ')}. Record licences in Library → Assets → click the ? badge.
          </span>
          <button type="button" onClick={() => setLicenceWarn([])} className="text-peach/70 hover:text-peach cursor-pointer">Dismiss</button>
        </div>
      )}
      {credits.length > 0 && !render.busy && (
        <div className="shrink-0 flex items-start gap-2 border-b border-black bg-lavender/10 px-4 py-2 text-xs text-lavender">
          <span className="flex-1"><b>Credits required</b> — add to your post description: {credits.join(' · ')}</span>
          <button type="button" onClick={() => void navigator.clipboard?.writeText(`Credits:\n${credits.join('\n')}`).catch(() => {})} className="rounded border border-lavender/40 px-2 py-0.5 hover:bg-lavender/10 cursor-pointer">Copy</button>
          <button type="button" onClick={() => setCredits([])} className="text-lavender/70 hover:text-lavender cursor-pointer">Dismiss</button>
        </div>
      )}
      {(render.busy || render.error) && (
        <div className={`shrink-0 px-4 py-1.5 text-xs border-b border-black ${render.error ? 'bg-red-950/30 text-red-200' : 'bg-studio-bar text-studio-muted'}`}>
          {render.error ? (
            <span className="flex items-center gap-2"><AlertCircle className="h-3.5 w-3.5" /> {render.error}</span>
          ) : (
            <div className="flex items-center gap-3">
              <span className="shrink-0">{render.progress?.label || 'Starting Remotion…'}</span>
              <div className="h-1 flex-1 rounded-full bg-studio-field overflow-hidden">
                <div className="h-full bg-brand-gradient animate-shimmer transition-[width] duration-500" style={{ width: `${Math.max(2, render.progress?.pct ?? 2)}%` }} />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 flex">
        {/* Chat column (the library opens inside it) */}
        {layout.chat && (
          <>
            <div className="hidden md:block shrink-0 min-h-0" style={{ width: layout.chatW }}>
              <ChatColumn
                messages={chat}
                busy={aiBusy}
                draft={refs}
                hasSelection={Boolean(selected)}
                pointMode={pointMode}
                library={layout.library}
                libraryPanel={<LibraryPanel projects={projects} onAddTemplate={addTemplate} onAddEffect={addEffect} onAddMotion={addMotion} aspect={{ width: edit.width, height: edit.height }} onAddFile={addFromDisk} onAddProjectVideo={addProjectVideo} onAddAsset={addAsset} />}
                onSend={(t) => void sendAi(t)}
                onRemoveRef={(n) => setRefs((cur) => cur.filter((r) => r.n !== n))}
                onHoverRef={setHot}
                onJumpRef={jumpRef}
                onAddMoment={() => addMoment()}
                onAddClip={addClipRef}
                onTogglePoint={() => setPointMode((v) => !v)}
                onToggleLibrary={(open) => setLayout({ library: open })}
                onHide={() => setLayout({ chat: false })}
                onUndo={undo}
                canUndo={past.current.length > 0}
              />
            </div>
            <div className="hidden md:flex">
              <Splitter dir="x" value={layout.chatW} onChange={(v) => setLayout({ chatW: v })} onReset={() => setLayout({ chatW: DEFAULT_LAYOUT.chatW })} label="Resize chat" />
            </div>
          </>
        )}

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex-1 min-h-0 flex">
            {/* Viewer */}
            <div className="flex-1 min-w-0 flex flex-col bg-studio-viewer">
              <div className="flex h-10 shrink-0 items-center gap-1 border-b border-studio-border px-2">
                <span className="px-1 text-[12px] font-medium text-studio-muted">Viewer</span>
                <button type="button" onClick={() => setPointMode((v) => !v)} aria-pressed={pointMode} title="Point at part of the picture" className={`${tb} ${pointMode ? '!bg-accent/15 !text-accent' : ''}`}>
                  <Crosshair className="h-4 w-4" /> <span className="hidden xl:inline">Point</span>
                </button>
                <button type="button" onClick={() => addMoment()} title="Point at this moment (M)" className={tb}>
                  <Diamond className="h-3.5 w-3.5" />
                </button>
                <span className="ml-auto" />
                <button type="button" onClick={() => setLayout({ inspector: !layout.inspector })} title={layout.inspector ? 'Hide inspector' : 'Show inspector'} className={`${tb} hidden lg:inline-flex`}>
                  {layout.inspector ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                </button>
              </div>
              <div className="flex-1 min-h-0 flex items-center justify-center p-4">
                <div className="relative h-full max-h-full max-w-full overflow-hidden rounded-[3px] shadow-[0_16px_40px_rgba(0,0,0,.5)]" style={{ aspectRatio: aspect }}>
                  <Player
                    ref={playerRef}
                    component={EditorComposition}
                    inputProps={inputProps}
                    durationInFrames={durationInFrames}
                    compositionWidth={edit.width}
                    compositionHeight={edit.height}
                    fps={fps}
                    loop={loop}
                    playbackRate={rate}
                    style={{ width: '100%', height: '100%' }}
                    clickToPlay={!pointMode}
                    acknowledgeRemotionLicense
                  />
                  <RegionOverlay active={pointMode} refs={allRefs} hot={hot} time={time} onRegion={addRegion} />
                </div>
              </div>
              <PointStrip duration={duration} time={time} refs={allRefs} hot={hot} onSeek={seek} onMoment={addMoment} onRange={addRange} />
              <div className="grid h-10 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-t border-studio-border px-3">
                <span className="font-mono text-[12px] tabular-nums text-studio-text">
                  {formatTimecode(time, true)} <span className="text-studio-faint">/ {formatTimecode(duration, true)}</span>
                </span>
                <button type="button" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'} className="grid h-7 w-7 place-items-center rounded-full bg-studio-ink text-black hover:bg-white cursor-pointer">
                  {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 translate-x-px" />}
                </button>
                <div className="flex items-center justify-end gap-1">
                  <button type="button" onClick={() => setLoop((v) => !v)} aria-pressed={loop} title="Loop" className={`${tb} ${loop ? '!text-accent' : ''}`}>
                    <Repeat className="h-3.5 w-3.5" />
                  </button>
                  <select value={rate} onChange={(e) => setRate(Number(e.target.value))} className={`${sel} w-[58px]`} aria-label="Playback speed" title="Playback speed">
                    {[0.5, 1, 1.5, 2].map((r) => <option key={r} value={r}>{r}×</option>)}
                  </select>
                  <button type="button" onClick={() => playerRef.current?.requestFullscreen()} title="Full screen (`)" className={tb}>
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Inspector */}
            {layout.inspector && (
              <>
                <div className="hidden lg:flex">
                  <Splitter dir="x" value={layout.inspW} sign={-1} onChange={(v) => setLayout({ inspW: v })} onReset={() => setLayout({ inspW: DEFAULT_LAYOUT.inspW })} label="Resize inspector" />
                </div>
                <aside className="hidden lg:flex shrink-0 flex-col bg-studio-panel" style={{ width: layout.inspW }}>
                  <div className="flex h-10 shrink-0 items-center gap-4 border-b border-studio-border px-3 text-[11.5px]">
                    {([
                      ['properties', 'Properties'],
                      ['info', 'Info'],
                    ] as const).map(([id, label]) => (
                      <button key={id} type="button" onClick={() => setInspTab(id)} aria-pressed={inspTab === id} className={`h-full cursor-pointer ${inspTab === id ? 'font-semibold text-accent' : 'text-studio-muted hover:text-studio-text'}`}>
                        {label}
                      </button>
                    ))}
                    {selected && (
                      <button type="button" onClick={addClipRef} title="Point at this clip in the chat (Ctrl+L)" className="ml-auto inline-flex items-center gap-1 text-studio-muted hover:text-studio-text cursor-pointer">
                        <Crosshair className="h-3.5 w-3.5" /> Ask AI
                      </button>
                    )}
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    {!selected ? (
                      <div className="space-y-2 p-4 text-[12px] text-studio-muted">
                        <p>Select a clip on the timeline to change it here.</p>
                        <p className="text-studio-faint">Space play · S split · Del delete · Ctrl+D duplicate · Ctrl+Z undo · ←/→ frame (Shift = 1 s) · M point at this moment · Ctrl+L point at the clip · Ctrl+Shift+L chat</p>
                      </div>
                    ) : inspTab === 'properties' ? (
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
                      <dl className="grid grid-cols-[90px_1fr] gap-x-3 gap-y-2 p-4 text-[12px]">
                        {([
                          ['Name', itemLabel(selected)],
                          ['Kind', KIND_STYLE[selected.kind].label],
                          ['Starts', formatTimecode(selected.from, true)],
                          ['Ends', formatTimecode(selected.from + selected.duration, true)],
                          ['Length', `${selected.duration.toFixed(2)} s`],
                          ['Track', String(selected.track + 1)],
                          ['Id', selected.id],
                        ] as const).map(([k, v]) => (
                          <div key={k} className="contents">
                            <dt className="text-studio-faint">{k}</dt>
                            <dd className="min-w-0 truncate font-mono text-studio-text">{v}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                </aside>
              </>
            )}
          </div>

          {/* Timeline */}
          <Splitter dir="y" value={layout.tlH} sign={-1} onChange={(v) => setLayout({ tlH: v })} onReset={() => setLayout({ tlH: DEFAULT_LAYOUT.tlH })} label="Resize timeline" />
          <div className="shrink-0 flex flex-col bg-studio-panel" style={{ height: layout.tlH }}>
            <div className="flex h-9 shrink-0 items-center gap-0.5 border-b border-studio-border px-2">
              <button type="button" onClick={undo} disabled={!past.current.length} title="Undo (Ctrl+Z)" className={tb}><Undo2 className="h-4 w-4" /></button>
              <button type="button" onClick={redo} disabled={!future.current.length} title="Redo (Ctrl+Shift+Z)" className={tb}><Redo2 className="h-4 w-4" /></button>
              <span className="mx-1 h-4 w-px bg-studio-border-strong" />
              <button type="button" onClick={() => addMoment()} title="Point at this moment (M)" className={tb}><Diamond className="h-3.5 w-3.5" /> <span className="hidden xl:inline">Marker</span></button>
              <button type="button" onClick={splitSelected} disabled={!selected} title="Split the selected clip at the playhead (S)" className={tb}><Scissors className="h-3.5 w-3.5" /> <span className="hidden xl:inline">Split</span></button>
              <button type="button" onClick={() => addTemplate('title')} title="Add a title at the playhead" className={tb}><Plus className="h-3.5 w-3.5" /> <span className="hidden xl:inline">Text</span></button>
              <span className="mx-auto truncate px-2 text-[11px] text-studio-faint">
                {selected ? `${itemLabel(selected)} · ${formatTimecode(selected.from, true)} → ${formatTimecode(selected.from + selected.duration, true)}` : `${edit.items.length} clips · ${formatTimecode(duration)}`}
              </span>
              <button type="button" onClick={() => setPps((v) => Math.max(6, v / 1.4))} title="Zoom out" className={tb}><ZoomOut className="h-3.5 w-3.5" /></button>
              <input type="range" min={6} max={240} value={pps} onChange={(e) => setPps(Number(e.target.value))} aria-label="Timeline zoom" className="h-[3px] w-24 cursor-pointer accent-[var(--color-accent)]" />
              <button type="button" onClick={() => setPps((v) => Math.min(240, v * 1.4))} title="Zoom in" className={tb}><ZoomIn className="h-3.5 w-3.5" /></button>
            </div>
            <div className="flex-1 min-h-0">
              <Timeline
                bare
                pps={pps}
                marks={allRefs}
                hot={hot}
                edit={edit}
                duration={duration}
                time={time}
                selectedId={selectedId}
                onSeek={seek}
                onSelect={(id) => {
                  setSelectedId(id);
                  if (id) setInspTab('properties');
                }}
                onDrag={(id, patch) => {
                  if (!dragBase.current) dragBase.current = edit;
                  patchItem(id, patch, false);
                }}
                onDragEnd={() => apply((e) => e, true)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

}
