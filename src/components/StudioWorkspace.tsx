import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Pause,
  Repeat,
  Download,
  RefreshCw,
  Scissors,
  Loader2,
  Check,
  Plus,
  Trash2,
  AlertCircle,
  FileText,
  SlidersHorizontal,
  Sparkles,
  Mic,
  Type,
  Layers,
  Clapperboard,
} from 'lucide-react';
import type {
  AspectRatio,
  CaptionStyle,
  ClipCandidate,
  ClipLengthPreset,
  ClipProject,
  EngineStatus,
  JobProgress,
  TranscriptSegment,
  WordTiming,
} from '../types.ts';
import { formatTimecode } from '../utils/format.ts';
import { postJson, withProgress } from '../utils/api.ts';

interface StudioWorkspaceProps {
  project: ClipProject;
  onUpdateProject: (updated: ClipProject) => void;
  onPersistProject: (project: ClipProject) => Promise<void>;
  onReanalyze: (preset: ClipLengthPreset) => Promise<void>;
  isReanalyzing: boolean;
  reanalyzeProgress: JobProgress | null;
  engines: EngineStatus | null;
  onOpenInEditor: (projectId: string, clipId: string) => void;
}

/** Platform presets — each maps to an export frame. */
const ASPECT_OPTIONS: Array<{ id: AspectRatio; label: string; hint: string }> = [
  { id: '9:16', label: '9:16', hint: 'TikTok · Reels · Shorts' },
  { id: '1:1', label: '1:1', hint: 'Instagram / LinkedIn feed' },
  { id: '16:9', label: '16:9', hint: 'YouTube · X' },
];

const CAPTION_OPTIONS: Array<{ id: CaptionStyle; label: string; motion?: boolean; hint: string }> = [
  { id: 'off', label: 'Off', hint: 'No burned captions (SRT still exported)' },
  { id: 'clean', label: 'Clean', hint: 'Plain white subtitles' },
  { id: 'highlight', label: 'Bold', hint: 'Bold yellow subtitles' },
  { id: 'karaoke', label: 'Karaoke', motion: true, hint: 'Word-by-word highlight (HyperFrames)' },
  { id: 'pop', label: 'Pop', motion: true, hint: 'Words pop in as they are spoken (HyperFrames)' },
];

/** Word timings for a segment; re-times evenly when the text was edited (mirrors the server). */
function segmentWords(seg: TranscriptSegment): WordTiming[] {
  const tokens = seg.text.trim().split(/\s+/).filter(Boolean);
  if (seg.words?.length && seg.words.length === tokens.length) return seg.words.map((w, i) => ({ ...w, text: tokens[i] }));
  const len = Math.max(0.2, seg.end - seg.start);
  const total = tokens.reduce((n, t) => n + t.length + 1, 0) || 1;
  let t = seg.start;
  return tokens.map((text) => {
    const d = (len * (text.length + 1)) / total;
    const w = { text, start: t, end: t + d };
    t += d;
    return w;
  });
}

export function StudioWorkspace({
  project,
  onUpdateProject,
  onPersistProject,
  onReanalyze,
  isReanalyzing,
  reanalyzeProgress,
  engines,
  onOpenInEditor,
}: StudioWorkspaceProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const ytIframeRef = useRef<HTMLIFrameElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);

  const isYoutubeEmbed = project.sourceType === 'youtube-embed' && Boolean(project.youtubeVideoId);

  const [selectedClipId, setSelectedClipId] = useState<string>(
    project.clips[0]?.id ?? ''
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [loopClip, setLoopClip] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const lastTimeRef = useRef(0);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const scrubbingRef = useRef(false);
  const [burnCaptions, setBurnCaptions] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportWarning, setExportWarning] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState<JobProgress | null>(null);
  const [batch, setBatch] = useState<{ done: number; total: number } | null>(null);
  const [reanalyzePreset, setReanalyzePreset] = useState<ClipLengthPreset>(
    project.clipLengthPreset || 'auto'
  );

  const sendYoutubeCmd = (func: string, args: unknown[] = []) => {
    const win = ytIframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
  };

  const seekToTime = (targetSec: number) => {
    lastTimeRef.current = targetSec;
    setCurrentTime(targetSec);
    if (isYoutubeEmbed) {
      sendYoutubeCmd('seekTo', [targetSec, true]);
    } else if (videoRef.current) {
      videoRef.current.currentTime = targetSec;
    }
  };

  // Sync selected clip when project updates
  useEffect(() => {
    if (!project.clips.some((c) => c.id === selectedClipId)) {
      const first = project.clips[0];
      if (first) {
        setSelectedClipId(first.id);
        setCurrentTime(first.start);
        if (videoRef.current) {
          videoRef.current.currentTime = first.start;
        }
      }
    }
  }, [project.id, project.clips, selectedClipId]);

  const selectedClip = useMemo<ClipCandidate | undefined>(
    () => project.clips.find((c) => c.id === selectedClipId) ?? project.clips[0],
    [project.clips, selectedClipId]
  );

  const fitMode = selectedClip?.framing === 'fit';

  // Fit mode backdrop: paint a tiny downscaled frame ~8x/sec instead of decoding the video twice
  useEffect(() => {
    const main = videoRef.current;
    const canvas = bgCanvasRef.current;
    if (!fitMode || !main || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const paint = () => {
      if (main.readyState >= 2) ctx.drawImage(main, 0, 0, canvas.width, canvas.height);
    };
    paint();
    const id = window.setInterval(() => !main.paused && paint(), 125);
    main.addEventListener('seeked', paint);
    main.addEventListener('loadeddata', paint);
    return () => {
      window.clearInterval(id);
      main.removeEventListener('seeked', paint);
      main.removeEventListener('loadeddata', paint);
    };
  }, [fitMode, selectedClip?.id]);

  const duration = Math.max(1, project.metadata.duration || 1);

  const activeCaption = useMemo(() => {
    if (!selectedClip || selectedClip.captionStyle === 'off') return null;
    return (
      project.transcript.find(
        (seg) => currentTime >= seg.start && currentTime <= seg.end
      ) ?? null
    );
  }, [project.transcript, currentTime, selectedClip]);

  // Word-level caption page for the live preview (karaoke / pop)
  const activeWords = useMemo(() => {
    if (!activeCaption || !selectedClip) return null;
    if (selectedClip.captionStyle !== 'karaoke' && selectedClip.captionStyle !== 'pop') return null;
    const words = segmentWords(activeCaption);
    const portrait = selectedClip.aspectRatio === '9:16';
    const per = portrait ? 3 : 6;
    const idx = Math.max(0, words.findIndex((w) => currentTime < w.end));
    const pageStart = Math.floor(idx / per) * per;
    return { words: words.slice(pageStart, pageStart + per), current: idx - pageStart };
  }, [activeCaption, selectedClip, currentTime]);

  const showHookPreview =
    Boolean(selectedClip?.hookTitle) &&
    Boolean(selectedClip) &&
    currentTime >= (selectedClip?.start ?? 0) &&
    currentTime < (selectedClip?.start ?? 0) + 3.5;

  const clipTranscript = useMemo(() => {
    if (!selectedClip) return project.transcript;
    return project.transcript.filter(
      (seg) => seg.end > selectedClip.start - 1 && seg.start < selectedClip.end + 1
    );
  }, [project.transcript, selectedClip]);

  // Advance timer for YouTube embed caption/scrubber sync when playing
  useEffect(() => {
    if (!isYoutubeEmbed || !isPlaying || !selectedClip) return;
    const interval = window.setInterval(() => {
      setCurrentTime((prev) => {
        const next = prev + 0.25;
        // Only loop/stop when playback crosses the clip end from inside the clip
        if (prev >= selectedClip.start && prev < selectedClip.end && next >= selectedClip.end) {
          if (loopClip) {
            sendYoutubeCmd('seekTo', [selectedClip.start, true]);
            return selectedClip.start;
          }
          sendYoutubeCmd('pauseVideo');
          setIsPlaying(false);
          return selectedClip.end;
        }
        return next;
      });
    }, 250);
    return () => window.clearInterval(interval);
  }, [isYoutubeEmbed, isPlaying, selectedClip, loopClip]);

  // Select clip and jump playhead
  // Manually add a section starting at the playhead (30 s by default); list stays in timeline order
  const handleAddManualClip = () => {
    const total = project.metadata.duration || 0;
    const start = Math.max(0, Math.min(currentTime, Math.max(0, total - 5)));
    const end = Math.min(total || start + 30, start + 30);
    const id = `manual_${Date.now()}`;
    const clip: ClipCandidate = {
      id,
      title: `Manual clip at ${formatTimecode(start)}`,
      hookLine: '',
      reason: 'Added manually — drag the In/Out handles to adjust.',
      category: 'Manual',
      start: Math.round(start * 100) / 100,
      end: Math.round(end * 100) / 100,
      aspectRatio: selectedClip?.aspectRatio ?? '9:16',
      cropX: 50,
      captionStyle: selectedClip?.captionStyle ?? 'highlight',
      exportedFiles: [],
    };
    const clips = [...project.clips, clip].sort((a, b) => a.start - b.start);
    const next = { ...project, clips };
    onUpdateProject(next);
    void onPersistProject(next);
    setSelectedClipId(id);
  };

  const handleDeleteClip = (clipId: string) => {
    const clips = project.clips.filter((c) => c.id !== clipId);
    const next = { ...project, clips };
    onUpdateProject(next);
    void onPersistProject(next);
    if (clipId === selectedClip?.id && clips[0]) setSelectedClipId(clips[0].id);
  };

  const handleSelectClip = (clip: ClipCandidate) => {
    setSelectedClipId(clip.id);
    setExportError(null);
    seekToTime(clip.start);
  };

  const togglePlay = () => {
    if (isYoutubeEmbed) {
      if (isPlaying) {
        sendYoutubeCmd('pauseVideo');
        setIsPlaying(false);
      } else {
        sendYoutubeCmd('playVideo');
        setIsPlaying(true);
      }
      return;
    }

    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) {
      void vid.play(); // play from wherever the playhead is — inside or outside clips
    } else {
      vid.pause();
    }
  };

  // Keyboard shortcuts (ignored while typing in a text field)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return;
      if (tag === 'INPUT' && !['checkbox', 'range', 'button'].includes((el as HTMLInputElement).type)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const total = duration || 0;
      const fps = project.metadata.fps || 30;
      const seekBy = (d: number) => seekToTime(Math.min(total, Math.max(0, currentTime + d)));
      const idx = selectedClip ? project.clips.findIndex((c) => c.id === selectedClip.id) : -1;
      const t = Math.round(currentTime * 100) / 100;

      let handled = true;
      switch (e.key) {
        case ' ':
        case 'k':
        case 'K':
          togglePlay();
          break;
        case 'ArrowLeft':
          seekBy(e.shiftKey ? -5 : -1);
          break;
        case 'ArrowRight':
          seekBy(e.shiftKey ? 5 : 1);
          break;
        case ',':
          seekBy(-1 / fps); // one frame back
          break;
        case '.':
          seekBy(1 / fps); // one frame forward
          break;
        case 'j':
        case 'J':
          seekBy(-10);
          break;
        case 'l':
        case 'L':
          seekBy(10);
          break;
        case 'Home':
          seekToTime(0);
          break;
        case 'End':
          seekToTime(Math.max(0, total - 0.1));
          break;
        case 'i':
        case 'I':
          if (selectedClip && t < selectedClip.end - 1) updateSelectedClip({ start: t });
          break;
        case 'o':
        case 'O':
          if (selectedClip && t > selectedClip.start + 1) updateSelectedClip({ end: t });
          break;
        case 'a':
        case 'A':
        case 'n':
        case 'N':
          handleAddManualClip();
          break;
        case 'ArrowUp':
          if (idx > 0) handleSelectClip(project.clips[idx - 1]);
          break;
        case 'ArrowDown':
          if (idx >= 0 && idx < project.clips.length - 1) handleSelectClip(project.clips[idx + 1]);
          break;
        case '[':
          if (selectedClip) seekToTime(selectedClip.start);
          break;
        case ']':
          if (selectedClip) seekToTime(Math.max(selectedClip.start, selectedClip.end - 0.1));
          break;
        case 'Delete':
        case 'Backspace':
          if (selectedClip) handleDeleteClip(selectedClip.id);
          break;
        case 'e':
        case 'E':
          void handleExport();
          break;
        case '?':
          setShowShortcuts((v) => !v);
          break;
        case 'Escape':
          setShowShortcuts(false);
          break;
        default:
          handled = false;
      }
      if (handled) e.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const updateSelectedClip = (patch: Partial<ClipCandidate>, persist = true) => {
    if (!selectedClip) return;
    const updatedClips = project.clips.map((c) =>
      c.id === selectedClip.id ? { ...c, ...patch } : c
    );
    const nextProject = { ...project, clips: updatedClips };
    onUpdateProject(nextProject);
    if (persist) {
      void onPersistProject(nextProject);
    }
  };

  const adjustTrimBound = (bound: 'start' | 'end', delta: number) => {
    if (!selectedClip) return;
    const minLen = 2;
    let nextStart = selectedClip.start;
    let nextEnd = selectedClip.end;

    if (bound === 'start') {
      nextStart = Math.max(0, Math.min(nextEnd - minLen, selectedClip.start + delta));
    } else {
      nextEnd = Math.min(duration, Math.max(nextStart + minLen, selectedClip.end + delta));
    }

    nextStart = Math.round(nextStart * 10) / 10;
    nextEnd = Math.round(nextEnd * 10) / 10;
    updateSelectedClip({ start: nextStart, end: nextEnd });

    seekToTime(bound === 'start' ? nextStart : Math.max(nextStart, nextEnd - 1.5));
  };

  const handleUpdateTranscriptText = (segId: string, text: string) => {
    const updatedTranscript: TranscriptSegment[] = project.transcript.map((seg) =>
      seg.id === segId ? { ...seg, text } : seg
    );
    const nextProject = { ...project, transcript: updatedTranscript };
    onUpdateProject(nextProject);
  };

  const handleBlurTranscript = () => {
    void onPersistProject(project);
  };

  const handleSeekTrack = (e: { clientX: number }) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const target = ratio * duration;
    seekToTime(target);
  };

  const exportOne = async (clip: ClipCandidate) => {
    const data = await withProgress(
      (jobId) =>
        postJson<{ project?: ClipProject; warning?: string }>(`/api/projects/${project.id}/clips/${clip.id}/export`, {
          jobId,
          start: clip.start,
          end: clip.end,
          aspectRatio: clip.aspectRatio,
          cropX: clip.cropX,
          cropY: clip.cropY ?? 50,
          zoom: clip.zoom ?? 1,
          framing: clip.framing ?? 'fill',
          captionStyle: clip.captionStyle,
          burnCaptions: burnCaptions && clip.captionStyle !== 'off',
          hookTitle: Boolean(clip.hookTitle),
          voiceIntro: Boolean(clip.voiceIntro),
          voice: clip.voice,
        }),
      setExportProgress
    );
    if (data.project) onUpdateProject(data.project);
    setExportWarning(data.warning ?? null);
    return data.project;
  };

  const handleExport = async () => {
    if (!selectedClip || isExporting) return;
    setIsExporting(true);
    setExportError(null);
    setExportWarning(null);
    try {
      await exportOne(selectedClip);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setIsExporting(false);
    }
  };

  /** Export every clip one after another with its own settings. */
  const handleExportAll = async () => {
    if (isExporting || project.clips.length === 0) return;
    setIsExporting(true);
    setExportError(null);
    setExportWarning(null);
    const clips = [...project.clips];
    try {
      for (let i = 0; i < clips.length; i++) {
        setBatch({ done: i, total: clips.length });
        setSelectedClipId(clips[i].id);
        await exportOne(clips[i]);
      }
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setBatch(null);
      setIsExporting(false);
    }
  };

  const aspectContainerClass =
    selectedClip?.aspectRatio === '9:16'
      ? 'aspect-[9/16] h-full max-h-[500px] w-auto'
      : selectedClip?.aspectRatio === '1:1'
        ? 'aspect-square h-full max-h-[480px] w-auto'
        : 'aspect-video w-full max-w-[780px] max-h-[460px]';

  const latestExport = selectedClip?.exportedFiles?.[0];

  return (
    <div className="flex-1 min-h-0 flex flex-col lg:flex-row bg-black overflow-hidden">
      {/* LEFT RAIL: AI Clip Queue */}
      <aside className="w-full lg:w-[310px] shrink-0 border-b lg:border-b-0 lg:border-r border-zinc-900 bg-surface flex flex-col min-h-0 max-h-[260px] lg:max-h-none">
        <div className="px-4 pt-3.5 pb-3 border-b border-zinc-900 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-white truncate" title={project.name}>
                {project.name}
              </h2>
              <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                {project.clips.length} clips · {formatTimecode(duration)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowShortcuts(true)}
              title="Keyboard shortcuts (?)"
              className="shrink-0 rounded-md border border-zinc-800 bg-black px-2 py-1 text-[11px] font-mono text-zinc-400 hover:text-white cursor-pointer"
            >
              ?
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleAddManualClip}
              title="Add your own clip starting at the playhead (A)"
              className="inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-black px-2 py-1 text-[11px] text-zinc-200 hover:border-zinc-700 hover:text-white transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
            <div className="inline-flex items-center rounded-md border border-zinc-800 bg-black">
              <select
                aria-label="Clip length preset"
                value={reanalyzePreset}
                onChange={(e) => setReanalyzePreset(e.target.value as ClipLengthPreset)}
                className="bg-transparent pl-2 pr-1 py-1 text-[11px] text-zinc-300 focus:outline-none"
              >
                <option value="auto">Auto length</option>
                <option value="short">Short</option>
                <option value="medium">Medium</option>
                <option value="long">Long</option>
              </select>
              <button
                type="button"
                disabled={isReanalyzing}
                onClick={() => void onReanalyze(reanalyzePreset)}
                title="Re-run AI clip selection"
                className="border-l border-zinc-800 p-1.5 text-zinc-300 hover:text-white disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isReanalyzing ? 'animate-spin' : ''}`} />
              </button>
            </div>
            {!isYoutubeEmbed && project.clips.length > 1 && (
              <button
                type="button"
                disabled={isExporting}
                onClick={() => void handleExportAll()}
                title="Export every clip with its own settings"
                className="ml-auto inline-flex items-center gap-1 rounded-md border border-accent/40 bg-accent/5 px-2 py-1 text-[11px] font-medium text-accent hover:bg-accent/10 disabled:opacity-50 cursor-pointer"
              >
                <Layers className="h-3.5 w-3.5" />
                {batch ? `${batch.done + 1}/${batch.total}` : 'Export all'}
              </button>
            )}
          </div>
        </div>

        {isReanalyzing && (
          <div className="px-4 py-2.5 border-b border-zinc-900">
            <p className="text-[11px] text-zinc-300 truncate">{reanalyzeProgress?.label || 'Re-analysing…'}</p>
            <div className="mt-1.5 h-1 rounded-full bg-zinc-900 overflow-hidden">
              <div className="h-full bg-brand-gradient animate-shimmer transition-[width] duration-700" style={{ width: `${Math.max(4, reanalyzeProgress?.pct ?? 4)}%` }} />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto divide-y divide-zinc-900/80">
          {project.clips.map((clip, idx) => {
            const active = clip.id === selectedClip?.id;
            const clipLen = Math.max(1, Math.round(clip.end - clip.start));
            const hasExport = (clip.exportedFiles?.length ?? 0) > 0;
            return (
              <button
                key={clip.id}
                type="button"
                onClick={() => handleSelectClip(clip)}
                className={`w-full text-left px-4 py-3.5 transition-colors cursor-pointer ${
                  active
                    ? 'bg-white/[0.04] shadow-[inset_2px_0_0_var(--color-accent)]'
                    : 'hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[11px] font-mono text-zinc-500">
                    {String(idx + 1).padStart(2, '0')} · {clip.category}
                  </span>
                  <span className="text-[11px] font-mono text-zinc-400 shrink-0">
                    {formatTimecode(clip.start)}–{formatTimecode(clip.end)} · {clipLen}s
                    <span
                      role="button"
                      tabIndex={0}
                      title="Remove clip"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClip(clip.id);
                      }}
                      className="ml-2 inline-flex align-middle text-zinc-600 hover:text-red-400"
                    >
                      <Trash2 className="h-3 w-3" />
                    </span>
                  </span>
                </div>
                <p
                  className={`mt-1 text-sm font-medium leading-snug ${
                    active ? 'text-white' : 'text-zinc-200'
                  }`}
                >
                  {clip.title}
                </p>
                {typeof clip.score === 'number' && (
                  <div className="mt-2 flex items-center gap-2" title="Predicted virality (0–100)">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-500 shrink-0">Virality</span>
                    <div className="relative h-1.5 flex-1 rounded-full bg-zinc-900 overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{
                          width: `${clip.score}%`,
                          background: clip.score >= 80 ? '#B5E2DD' : clip.score >= 60 ? '#FBDFCB' : '#F4C7D6',
                        }}
                      />
                    </div>
                    <span className="w-7 text-right text-xs font-mono font-semibold text-white">{clip.score}</span>
                  </div>
                )}
                <p className="mt-1.5 text-xs text-zinc-500 line-clamp-2">
                  {clip.reason}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {hasExport && (
                    <span className="inline-flex items-center gap-1 rounded bg-accent/10 px-1.5 py-0.5 text-[10.5px] text-accent">
                      <Check className="h-3 w-3" />
                      Exported
                    </span>
                  )}
                  {(clip.captionStyle === 'karaoke' || clip.captionStyle === 'pop' || clip.hookTitle || clip.voiceIntro) && (
                    <span className="inline-flex items-center gap-1 rounded bg-lavender/10 px-1.5 py-0.5 text-[10.5px] text-lavender">
                      <Sparkles className="h-3 w-3" />
                      Motion
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* CENTER STAGE: Video Preview & Precision Trimmer */}
      <main className="flex-1 min-w-0 min-h-0 flex flex-col bg-black">
        {/* Studio Toolbar */}
        {selectedClip && (
          <div className="shrink-0 border-b border-zinc-900 bg-surface px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* Aspect Ratio Switcher */}
              <div className="inline-flex items-center rounded-lg bg-black p-0.5 border border-zinc-900">
                {ASPECT_OPTIONS.map((opt) => {
                  const active = selectedClip.aspectRatio === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      title={opt.hint}
                      onClick={() => updateSelectedClip({ aspectRatio: opt.id })}
                      className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? 'bg-zinc-800 text-white'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {/* Caption Style Switcher */}
              <div className="inline-flex items-center rounded-lg bg-black p-0.5 border border-zinc-900">
                {CAPTION_OPTIONS.map((opt) => {
                  const active = selectedClip.captionStyle === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      title={opt.hint}
                      onClick={() => updateSelectedClip({ captionStyle: opt.id })}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? 'bg-zinc-800 text-white'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {opt.motion && <Sparkles className={`h-3 w-3 ${active ? 'text-accent' : 'text-zinc-600'}`} />}
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {/* Framing: Fill (crop) or Fit (whole landscape video on blurred background) */}
              <div className="inline-flex items-center rounded-lg bg-black p-0.5 border border-zinc-900">
                {([
                  { id: 'fill', label: 'Fill' },
                  { id: 'fit', label: 'Fit full video' },
                ] as const).map((opt) => {
                  const active = (selectedClip.framing ?? 'fill') === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      title={opt.id === 'fit' ? 'Show the whole landscape video in portrait, on a blurred background' : 'Crop to fill the frame'}
                      onClick={() => updateSelectedClip({ framing: opt.id })}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        active ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {/* Zoom + pan sliders */}
              {([
                { key: 'zoom', label: 'Zoom', min: 1, max: 3, step: 0.05, def: 1 },
                { key: 'cropX', label: 'Pan ↔', min: 0, max: 100, step: 1, def: 50 },
                { key: 'cropY', label: 'Pan ↕', min: 0, max: 100, step: 1, def: 50 },
              ] as const).map((sl) => (
                <label key={sl.key} className="inline-flex items-center gap-2 text-xs text-zinc-400">
                  {sl.key === 'zoom' && <SlidersHorizontal className="h-3.5 w-3.5 text-zinc-500" />}
                  <span className="whitespace-nowrap">{sl.label}</span>
                  <input
                    type="range"
                    min={sl.min}
                    max={sl.max}
                    step={sl.step}
                    value={selectedClip[sl.key] ?? sl.def}
                    onChange={(e) => updateSelectedClip({ [sl.key]: Number(e.target.value) }, false)}
                    onMouseUp={() => void onPersistProject(project)}
                    onTouchEnd={() => void onPersistProject(project)}
                    onDoubleClick={() => updateSelectedClip({ [sl.key]: sl.def })}
                    className="w-20 accent-[#B5E2DD] cursor-pointer"
                  />
                  {sl.key === 'zoom' && (
                    <span className="font-mono text-zinc-500 w-8">{(selectedClip.zoom ?? 1).toFixed(2)}×</span>
                  )}
                </label>
              ))}
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {!isYoutubeEmbed && selectedClip.captionStyle !== 'off' && (
                <label className="inline-flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={burnCaptions}
                    onChange={(e) => setBurnCaptions(e.target.checked)}
                    className="accent-accent rounded"
                  />
                  Burn captions
                </label>
              )}

              {isYoutubeEmbed ? (
                <a
                  href={`/api/projects/${project.id}/clips/${selectedClip.id}/srt`}
                  download
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-xs font-semibold text-black hover:bg-accent-strong transition-colors whitespace-nowrap shrink-0"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Download SRT
                </a>
              ) : (
                <>
                <button
                  type="button"
                  onClick={() => onOpenInEditor(project.id, selectedClip.id)}
                  title="Open this clip in the timeline editor with motion graphics"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-lavender/40 bg-lavender/5 px-3 py-1.5 text-xs font-semibold text-lavender hover:bg-lavender/10 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Clapperboard className="h-3.5 w-3.5" />
                  Open in editor
                </button>
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={() => void handleExport()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-xs font-semibold text-black hover:bg-accent-strong disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {exportProgress ? `${exportProgress.pct}%` : 'Rendering…'}
                    </>
                  ) : (
                    <>
                      <Download className="h-3.5 w-3.5" />
                      Export MP4
                    </>
                  )}
                </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Pure-Black Video Preview Canvas */}
        <div className="flex-1 min-h-0 flex items-center justify-center p-5 bg-black overflow-hidden">
          {selectedClip && (
            <div
              className={`relative ${aspectContainerClass} bg-[#050507] border border-zinc-900 rounded-lg overflow-hidden flex items-center justify-center`}
            >
              {isYoutubeEmbed ? (
                <iframe
                  ref={ytIframeRef}
                  src={`https://www.youtube.com/embed/${project.youtubeVideoId}?enablejsapi=1&rel=0&modestbranding=1&start=${Math.floor(selectedClip.start)}`}
                  title={selectedClip.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full border-0"
                />
              ) : (
                <>
                {(selectedClip.framing ?? 'fill') === 'fit' && (
                  <canvas
                    ref={bgCanvasRef}
                    width={48}
                    height={27}
                    aria-hidden
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover scale-125 blur-xl brightness-75"
                  />
                )}
                <video
                  ref={videoRef}
                  src={project.videoUrl}
                  playsInline
                  onClick={togglePlay}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onTimeUpdate={() => {
                    const vid = videoRef.current;
                    if (!vid) return;
                    const t = vid.currentTime;
                    const prev = lastTimeRef.current;
                    lastTimeRef.current = t;
                    setCurrentTime(t);
                    // Loop/stop only when playing *through* the clip end; free playback elsewhere
                    if (
                      selectedClip &&
                      prev >= selectedClip.start &&
                      prev < selectedClip.end &&
                      t >= selectedClip.end &&
                      t - prev < 1.5
                    ) {
                      if (loopClip) {
                        vid.currentTime = selectedClip.start;
                      } else {
                        vid.pause();
                      }
                    }
                  }}
                  style={{
                    objectPosition: `${selectedClip.cropX}% ${selectedClip.cropY ?? 50}%`,
                    transform: `scale(${selectedClip.zoom ?? 1})`,
                    transformOrigin: `${selectedClip.cropX}% ${selectedClip.cropY ?? 50}%`,
                  }}
                  className={`relative h-full w-full cursor-pointer ${
                    (selectedClip.framing ?? 'fill') === 'fit' ? 'object-contain' : 'object-cover'
                  }`}
                />
                </>
              )}

              {/* Hook title preview (first 3.5 s of the clip) */}
              {showHookPreview && (
                <div className={`pointer-events-none absolute inset-x-0 flex justify-center ${selectedClip.aspectRatio === '9:16' ? 'top-[10%]' : 'top-[6%]'}`}>
                  <p className="max-w-[84%] rounded-lg border-b-4 border-accent bg-white px-3 py-1.5 text-center text-sm font-black leading-tight text-black shadow-xl">
                    {selectedClip.title}
                  </p>
                </div>
              )}

              {/* Animated caption preview (karaoke / pop) */}
              {activeWords && (
                <div className={`pointer-events-none absolute inset-x-3 flex justify-center ${selectedClip.aspectRatio === '9:16' ? 'bottom-[22%]' : 'bottom-6'}`}>
                  <p
                    style={{ fontFamily: '"Arial Black", "Segoe UI", Arial, sans-serif' }}
                    className="text-center text-xl sm:text-2xl font-black uppercase leading-tight tracking-tight [text-shadow:0_2px_0_#000,0_0_10px_rgba(0,0,0,.9)]"
                  >
                    {activeWords.words.map((w, i) => {
                      const isCur = i === activeWords.current;
                      const hidden = selectedClip.captionStyle === 'pop' && i > activeWords.current;
                      return (
                        <span
                          key={i}
                          className={`mx-[0.24em] inline-block transition-all duration-100 ${isCur ? 'text-accent scale-[1.04] -translate-y-0.5' : 'text-white'} ${hidden ? 'opacity-0' : 'opacity-100'}`}
                        >
                          {w.text}
                        </span>
                      );
                    })}
                  </p>
                </div>
              )}

              {/* Live Caption Preview Overlay */}
              {activeCaption && !activeWords && selectedClip.captionStyle !== 'off' && (
                <div
                  className={`pointer-events-none absolute inset-x-4 flex justify-center ${
                    selectedClip.aspectRatio === '9:16' ? 'bottom-14' : 'bottom-6'
                  }`}
                >
                  <p
                    className={`max-w-[92%] text-center leading-snug px-3 py-1.5 rounded-md ${
                      selectedClip.captionStyle === 'highlight'
                        ? 'text-base sm:text-lg font-bold text-[#FFE44D] bg-black/70 tracking-tight'
                        : 'text-sm sm:text-base font-semibold text-white bg-black/75'
                    }`}
                  >
                    {activeCaption.text}
                  </p>
                </div>
              )}

              {/* Subtle center play button when paused on local video */}
              {!isYoutubeEmbed && !isPlaying && (
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label="Play clip preview"
                  className="absolute h-12 w-12 rounded-full bg-black/70 border border-white/20 flex items-center justify-center text-white hover:bg-black/90 transition-colors cursor-pointer"
                >
                  <Play className="h-5 w-5 fill-white ml-0.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {isYoutubeEmbed && (
          <div className="shrink-0 border-t border-zinc-900 bg-surface px-4 py-2 text-xs text-zinc-400">
            Streaming via YouTube player (direct stream download was restricted on this network). Run ClipForge AI locally on your PC to download MP4 streams via yt-dlp for burned-in FFmpeg export.
          </div>
        )}

        {/* Export feedback / Download strip */}
        {isExporting && exportProgress && (
          <div className="shrink-0 border-t border-zinc-900 bg-surface px-4 py-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-300">
                {batch ? `Clip ${batch.done + 1} of ${batch.total} · ` : ''}
                {exportProgress.label}
              </span>
              <span className="font-mono text-zinc-500">{exportProgress.pct}%</span>
            </div>
            <div className="mt-1.5 h-1 rounded-full bg-zinc-900 overflow-hidden">
              <div className="h-full bg-brand-gradient animate-shimmer transition-[width] duration-700" style={{ width: `${Math.max(3, exportProgress.pct)}%` }} />
            </div>
          </div>
        )}

        {exportWarning && !isExporting && (
          <div className="shrink-0 border-t border-zinc-900 bg-peach/5 px-4 py-2 flex items-start gap-2 text-xs text-peach">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>{exportWarning}</span>
          </div>
        )}

        {!isExporting && (exportError || latestExport) && (
          <div className="shrink-0 border-t border-zinc-900 bg-surface px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            {latestExport && !exportError && (
              <video
                key={latestExport.url}
                src={latestExport.url}
                muted
                playsInline
                onMouseEnter={(e) => void e.currentTarget.play()}
                onMouseLeave={(e) => e.currentTarget.pause()}
                className="h-12 rounded border border-zinc-800 bg-black"
                title="Hover to preview the exported clip"
              />
            )}
            {exportError ? (
              <div className="flex items-center gap-2 text-red-300">
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                <span>{exportError}</span>
              </div>
            ) : latestExport ? (
              <>
                <div className="flex items-center gap-2 text-zinc-300">
                  <Check className="h-4 w-4 text-accent shrink-0" />
                  <span>
                    Ready ({latestExport.aspectRatio} · watermark-free
                    {latestExport.burnedCaptions ? ' · burned captions' : ''}
                    {latestExport.engine === 'hyperframes' ? ' · HyperFrames motion' : ''})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`/api/download/${latestExport.fileName}`}
                    className="inline-flex items-center gap-1.5 rounded-md bg-zinc-800 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-700 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download MP4
                  </a>
                  <a
                    href={latestExport.srtUrl}
                    download
                    className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-black px-2.5 py-1 text-xs font-medium text-zinc-300 hover:border-zinc-700 hover:text-white transition-colors"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    SRT
                  </a>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* Bottom Transport & Precision Trim Scrubber */}
        {selectedClip && (
          <div className="shrink-0 border-t border-zinc-900 bg-surface px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 border border-zinc-800 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  {isPlaying ? 'Pause' : 'Play'}
                </button>
                <button
                  type="button"
                  onClick={() => setLoopClip((v) => !v)}
                  className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                    loopClip
                      ? 'border-accent/60 bg-accent/10 text-accent'
                      : 'border-zinc-800 bg-black text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Repeat className="h-3.5 w-3.5" />
                  Loop
                </button>
                <span className="ml-2 font-mono text-xs text-zinc-300">
                  {formatTimecode(currentTime, true)}{' '}
                  <span className="text-zinc-600">/</span>{' '}
                  {formatTimecode(duration, true)}
                </span>
              </div>

              {/* Fine Trim In / Out Controls */}
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="inline-flex items-center gap-1 font-mono text-zinc-300">
                  <Scissors className="h-3.5 w-3.5 text-zinc-500 mr-0.5" />
                  <span className="text-zinc-500 font-sans">In</span>
                  <button
                    type="button"
                    onClick={() => adjustTrimBound('start', -0.5)}
                    className="px-1.5 py-0.5 rounded border border-zinc-800 bg-black hover:bg-zinc-900 cursor-pointer"
                  >
                    -0.5s
                  </button>
                  <span className="px-1 text-white">{formatTimecode(selectedClip.start, true)}</span>
                  <button
                    type="button"
                    onClick={() => adjustTrimBound('start', 0.5)}
                    className="px-1.5 py-0.5 rounded border border-zinc-800 bg-black hover:bg-zinc-900 cursor-pointer"
                  >
                    +0.5s
                  </button>
                </div>

                <div className="inline-flex items-center gap-1 font-mono text-zinc-300">
                  <span className="text-zinc-500 font-sans">Out</span>
                  <button
                    type="button"
                    onClick={() => adjustTrimBound('end', -0.5)}
                    className="px-1.5 py-0.5 rounded border border-zinc-800 bg-black hover:bg-zinc-900 cursor-pointer"
                  >
                    -0.5s
                  </button>
                  <span className="px-1 text-white">{formatTimecode(selectedClip.end, true)}</span>
                  <button
                    type="button"
                    onClick={() => adjustTrimBound('end', 0.5)}
                    className="px-1.5 py-0.5 rounded border border-zinc-800 bg-black hover:bg-zinc-900 cursor-pointer"
                  >
                    +0.5s
                  </button>
                </div>

                <div className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    title="Set clip start to the playhead"
                    onClick={() => {
                      const t = Math.round(currentTime * 100) / 100;
                      if (t < selectedClip.end - 1) updateSelectedClip({ start: t });
                    }}
                    className="px-2 py-0.5 rounded border border-zinc-800 bg-black text-zinc-300 hover:bg-zinc-900 cursor-pointer"
                  >
                    Set In here
                  </button>
                  <button
                    type="button"
                    title="Set clip end to the playhead"
                    onClick={() => {
                      const t = Math.round(currentTime * 100) / 100;
                      if (t > selectedClip.start + 1) updateSelectedClip({ end: t });
                    }}
                    className="px-2 py-0.5 rounded border border-zinc-800 bg-black text-zinc-300 hover:bg-zinc-900 cursor-pointer"
                  >
                    Set Out here
                  </button>
                </div>
              </div>
            </div>

            {/* Full Timeline Bar with Active Clip Selection Window */}
            <div
              ref={trackRef}
              onPointerDown={(e) => {
                scrubbingRef.current = true;
                e.currentTarget.setPointerCapture(e.pointerId);
                handleSeekTrack(e);
              }}
              onPointerMove={(e) => scrubbingRef.current && handleSeekTrack(e)}
              onPointerUp={() => (scrubbingRef.current = false)}
              onPointerCancel={() => (scrubbingRef.current = false)}
              title="Click or drag anywhere to move the playhead"
              className="touch-none relative h-8 rounded-md bg-black border border-zinc-900 overflow-hidden cursor-pointer select-none"
            >
              {/* All AI Clip Markers */}
              {project.clips.map((c) => {
                const leftPct = (c.start / duration) * 100;
                const widthPct = Math.max(1, ((c.end - c.start) / duration) * 100);
                const isSelected = c.id === selectedClip.id;
                return (
                  <div
                    key={c.id}
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    className={`absolute inset-y-1 rounded-sm transition-colors ${
                      isSelected
                        ? 'bg-accent/25 border border-accent'
                        : 'bg-zinc-800/40 border border-zinc-700/40'
                    }`}
                  />
                );
              })}

              {/* Playhead Needle */}
              <div
                style={{
                  left: `${Math.min(100, Math.max(0, (currentTime / duration) * 100))}%`,
                }}
                className="absolute inset-y-0 w-[2px] bg-white pointer-events-none"
              />
            </div>
          </div>
        )}
      </main>

      {showShortcuts && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-zinc-800 bg-[#09090B] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Keyboard shortcuts</h3>
              <button type="button" onClick={() => setShowShortcuts(false)} className="text-xs text-zinc-500 hover:text-white cursor-pointer">
                Esc
              </button>
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
              {[
                ['Space / K', 'Play / pause'],
                ['← / →', 'Back / forward 1 s'],
                ['Shift + ← / →', 'Back / forward 5 s'],
                ['J / L', 'Back / forward 10 s'],
                [', / .', 'Previous / next frame'],
                ['Home / End', 'Start / end of video'],
                ['I / O', 'Set clip In / Out at playhead'],
                ['A or N', 'Add new clip at playhead'],
                ['↑ / ↓', 'Previous / next clip'],
                ['[ / ]', 'Jump to clip start / end'],
                ['Delete', 'Remove selected clip'],
                ['E', 'Export selected clip'],
                ['?', 'Show / hide this list'],
              ].map(([k, v]) => (
                <div key={k} className="contents">
                  <kbd className="rounded border border-zinc-800 bg-black px-1.5 py-0.5 font-mono text-[11px] text-[#B5E2DD] whitespace-nowrap">{k}</kbd>
                  <span className="py-0.5 text-zinc-300">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* RIGHT RAIL: Clip Inspector & Synced Transcript */}
      <aside className="w-full lg:w-[340px] shrink-0 border-t lg:border-t-0 lg:border-l border-zinc-900 bg-surface flex flex-col min-h-0 max-h-[300px] lg:max-h-none">
        {selectedClip && (
          <div className="p-4 border-b border-zinc-900 space-y-2.5">
            <label className="block">
              <span className="text-[11px] font-medium text-zinc-500">Clip Title</span>
              <input
                type="text"
                value={selectedClip.title}
                onChange={(e) => updateSelectedClip({ title: e.target.value }, false)}
                onBlur={() => void onPersistProject(project)}
                className="mt-1 w-full rounded-md border border-zinc-800 bg-black px-2.5 py-1.5 text-sm font-medium text-white focus:outline-none focus:border-accent"
              />
            </label>
            {selectedClip.hookLine && (
              <div>
                <span className="text-[11px] font-medium text-zinc-500">Opening Hook</span>
                <p className="mt-0.5 text-xs text-zinc-300 leading-relaxed">
                  “{selectedClip.hookLine}”
                </p>
              </div>
            )}
            <div>
              <span className="text-[11px] font-medium text-zinc-500">Selection Rationale</span>
              <p className="mt-0.5 text-xs text-zinc-400 leading-relaxed">
                {selectedClip.reason}
              </p>
            </div>
          </div>
        )}

        {selectedClip && !isYoutubeEmbed && (
          <div className="p-4 border-b border-zinc-900 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-white">Motion & voice</h3>
              <span className={`text-[10.5px] font-mono ${engines?.hyperframes ? 'text-accent' : 'text-zinc-500'}`}>
                {engines?.hyperframes ? 'HyperFrames ready' : 'HyperFrames off'}
              </span>
            </div>
            {([
              {
                key: 'hookTitle',
                icon: Type,
                label: 'Hook title',
                hint: 'Animated title banner over the first 3.5 s',
              },
              {
                key: 'voiceIntro',
                icon: Mic,
                label: 'Voice intro',
                hint: engines?.tts ? 'AI voice (Kokoro) reads the title on a card' : 'System voice reads the title on a card',
              },
            ] as const).map((opt) => {
              const on = Boolean(selectedClip[opt.key]);
              const Icon = opt.icon;
              return (
                <button
                  key={opt.key}
                  type="button"
                  role="switch"
                  aria-checked={on}
                  onClick={() => updateSelectedClip({ [opt.key]: !on })}
                  className={`w-full flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors cursor-pointer ${
                    on ? 'border-accent/40 bg-accent/5' : 'border-zinc-900 bg-black hover:border-zinc-800'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${on ? 'text-accent' : 'text-zinc-500'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium text-white">{opt.label}</span>
                    <span className="block text-[11px] text-zinc-500">{opt.hint}</span>
                  </span>
                  <span className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${on ? 'bg-accent' : 'bg-zinc-800'}`}>
                    <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-black transition-all ${on ? 'left-3.5' : 'left-0.5 bg-zinc-400'}`} />
                  </span>
                </button>
              );
            })}
            {selectedClip.voiceIntro && (engines?.voices?.length ?? 0) > 0 && (
              <label className="flex items-center justify-between gap-2 text-xs text-zinc-400">
                Voice
                <select
                  value={selectedClip.voice ?? 'af_heart'}
                  disabled={!engines?.tts}
                  onChange={(e) => updateSelectedClip({ voice: e.target.value })}
                  className="rounded-md border border-zinc-800 bg-black px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-accent disabled:opacity-50"
                >
                  {engines!.voices.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label} · {v.language} · {v.gender}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {selectedClip.voiceIntro && engines && !engines.tts && (
              <p className="text-[11px] text-zinc-500">
                For natural AI voices run <code className="font-mono text-zinc-400">pip install kokoro-onnx soundfile</code>.
              </p>
            )}
          </div>
        )}

        <div className="px-4 py-2.5 border-b border-zinc-900 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-white">Synced Captions & Transcript</h3>
          <span className="text-[11px] font-mono text-zinc-500">
            {clipTranscript.length} lines
          </span>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-zinc-900/70">
          {project.transcript.length === 0 ? (
            <div className="p-5 text-xs text-zinc-500">
              No speech segments detected in this media track.
            </div>
          ) : (
            project.transcript.map((seg) => {
              const inClip =
                selectedClip &&
                seg.end > selectedClip.start &&
                seg.start < selectedClip.end;
              const isCurrent = currentTime >= seg.start && currentTime <= seg.end;

              return (
                <div
                  key={seg.id}
                  className={`px-4 py-2.5 transition-colors ${
                    isCurrent
                      ? 'bg-accent/10'
                      : inClip
                        ? 'bg-[#0B0B0F]'
                        : 'opacity-50 hover:opacity-85'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <button
                      type="button"
                      onClick={() => seekToTime(seg.start)}
                      className="font-mono text-[11px] text-accent hover:underline cursor-pointer"
                    >
                      {formatTimecode(seg.start, true)}
                    </button>
                    {seg.speaker && (
                      <span className="text-[11px] text-zinc-500">{seg.speaker}</span>
                    )}
                  </div>
                  <textarea
                    rows={2}
                    value={seg.text}
                    onChange={(e) => handleUpdateTranscriptText(seg.id, e.target.value)}
                    onBlur={handleBlurTranscript}
                    className="w-full resize-none bg-transparent text-xs text-zinc-200 leading-relaxed focus:outline-none focus:bg-black/60 rounded px-1 -mx-1 py-0.5"
                  />
                </div>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}
