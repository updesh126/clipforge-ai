import { useRef, useState } from 'react';
import { Film, Upload, Play, AlertCircle, Link2, FolderOpen, Check, Loader2, AudioLines, Sparkles, Scissors, Clapperboard } from 'lucide-react';
import type { ClipLengthPreset, EngineStatus, JobProgress } from '../types.ts';

interface UploadStageProps {
  isBusy: boolean;
  busyStage: string;
  progress: JobProgress | null;
  error: string | null;
  engines: EngineStatus | null;
  onUploadFile: (file: File, preset: ClipLengthPreset) => Promise<void>;
  onImportYoutube: (url: string, preset: ClipLengthPreset) => Promise<void>;
  onOpenLocalPath: (filePath: string, preset: ClipLengthPreset) => Promise<void>;
  onGenerateDemo: (preset: ClipLengthPreset) => Promise<void>;
}

const PRESETS: Array<{ id: ClipLengthPreset; label: string; hint: string }> = [
  { id: 'auto', label: 'Auto', hint: '15–60s' },
  { id: 'short', label: 'Short', hint: '12–30s' },
  { id: 'medium', label: 'Medium', hint: '30–60s' },
  { id: 'long', label: 'Long', hint: '60–90s' },
];

/** Pipeline steps shown while a video is being analysed. `keys` are server progress stages. */
const STEPS = [
  { keys: ['download', 'tts', 'probe'], label: 'Read video', tool: 'FFmpeg', icon: Film },
  { keys: ['transcribe'], label: 'Transcribe speech', tool: 'Whisper', icon: AudioLines },
  { keys: ['select'], label: 'Find best moments', tool: 'Ollama / scorer', icon: Sparkles },
  { keys: ['finalise'], label: 'Snap to sentences', tool: 'ClipForge', icon: Scissors },
];

function PipelineProgress({ busyStage, progress }: { busyStage: string; progress: JobProgress | null }) {
  const idx = progress ? Math.max(0, STEPS.findIndex((s) => s.keys.includes(progress.stage))) : 0;
  const pct = progress?.pct ?? 2;
  return (
    <div className="py-2 text-left">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-white">{progress?.label || busyStage}</p>
        <span className="font-mono text-xs text-zinc-400">{pct}%</span>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-900">
        <div className="h-full rounded-full bg-brand-gradient animate-shimmer transition-[width] duration-700" style={{ width: `${Math.max(3, pct)}%` }} />
      </div>
      <ol className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {STEPS.map((s, i) => {
          const done = i < idx;
          const active = i === idx;
          const Icon = s.icon;
          return (
            <li
              key={s.label}
              className={`rounded-lg border px-3 py-2.5 transition-colors ${
                active ? 'border-accent/50 bg-accent/5' : done ? 'border-zinc-800 bg-zinc-950' : 'border-zinc-900 bg-black'
              }`}
            >
              <div className="flex items-center gap-1.5">
                {done ? (
                  <Check className="h-3.5 w-3.5 text-accent" />
                ) : active ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
                ) : (
                  <Icon className="h-3.5 w-3.5 text-zinc-600" />
                )}
                <span className={`text-xs font-medium ${active || done ? 'text-white' : 'text-zinc-500'}`}>{s.label}</span>
              </div>
              <p className="mt-0.5 pl-5 text-[10.5px] font-mono text-zinc-500">{s.tool}</p>
            </li>
          );
        })}
      </ol>
      <p className="mt-4 text-xs text-zinc-500">Runs on this computer. Long videos take roughly 5–15 minutes per hour of footage.</p>
    </div>
  );
}

export function UploadStage({
  isBusy,
  busyStage,
  progress,
  error,
  engines,
  onUploadFile,
  onImportYoutube,
  onOpenLocalPath,
  onGenerateDemo,
}: UploadStageProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [preset, setPreset] = useState<ClipLengthPreset>('auto');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [localPath, setLocalPath] = useState('');

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0 || isBusy) return;
    void onUploadFile(files[0], preset);
  };

  const pickLocal = async () => {
    // Native picker on this PC → video is used in place, nothing is uploaded or copied
    try {
      const r = await fetch('/api/pick-file');
      const { path: picked } = (await r.json()) as { path: string | null };
      if (picked) {
        setLocalPath(picked);
        void onOpenLocalPath(picked, preset);
      }
    } catch {
      inputRef.current?.click(); // fallback: browser upload
    }
  };

  const missing = engines && (!engines.ffmpeg || !engines.whisper);

  return (
    <div className="flex-1 bg-black overflow-y-auto">
      <div className="relative mx-auto w-full max-w-3xl px-4 sm:px-6 py-10 sm:py-14">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,rgba(181,226,221,0.10),transparent_60%)]" />

        <div className="relative mb-8 text-center">
          <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-[11px] text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Local AI · no upload · no watermark
          </p>
          <h1 className="font-display text-3xl sm:text-5xl font-semibold tracking-tight text-white [text-wrap:balance]">
            Long video in. <span className="text-accent">Viral clips</span> out.
          </h1>
          <p className="mt-3 text-sm sm:text-base text-zinc-400 max-w-xl mx-auto [text-wrap:pretty]">
            Whisper transcribes, a local AI picks the best moments, and HyperFrames adds animated captions, hook titles and voice intros.
          </p>
        </div>

        {missing && (
          <div className="relative mb-5 rounded-lg border border-peach/30 bg-peach/5 px-4 py-3 text-xs text-peach">
            {!engines.ffmpeg && <p>FFmpeg is not installed — install it first: <code className="font-mono">winget install Gyan.FFmpeg</code> (Windows) or <code className="font-mono">brew install ffmpeg-full</code> (Mac).</p>}
            {!engines.whisper && <p>No speech-to-text engine found — install whisper.cpp (<code className="font-mono">whisper-cli</code>) and add it to PATH.</p>}
          </div>
        )}

        {/* Main dropzone / progress */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!isBusy) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={`relative rounded-2xl border transition-colors bg-surface p-6 sm:p-8 ${
            dragOver ? 'border-accent bg-accent/5' : 'border-zinc-800 hover:border-zinc-700'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm,video/x-matroska,.mp4,.mov,.webm,.mkv"
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = '';
            }}
          />

          {isBusy ? (
            <PipelineProgress busyStage={busyStage} progress={progress} />
          ) : (
            <div className="flex flex-col items-center text-center">
              <div className="h-12 w-12 rounded-xl bg-zinc-900 border border-zinc-800 grid place-items-center mb-4">
                <Clapperboard className="h-5 w-5 text-accent" />
              </div>
              <p className="text-sm font-medium text-white">Pick a video on this computer</p>
              <p className="mt-1 text-xs text-zinc-500">Any size · MP4, MOV, WebM, MKV · used in place, never copied (dragging a file here copies it)</p>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => void pickLocal()}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-black hover:bg-accent-strong transition-colors cursor-pointer"
                >
                  <Upload className="h-4 w-4" />
                  Select video
                </button>
                <button
                  type="button"
                  onClick={() => void onGenerateDemo(preset)}
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:border-zinc-700 transition-colors cursor-pointer"
                >
                  <Play className="h-4 w-4 text-zinc-400" />
                  Try a sample
                </button>
              </div>

              {/* Target clip length */}
              <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
                <span className="text-xs text-zinc-500">Clip length</span>
                <div className="inline-flex items-center rounded-lg bg-black p-1 border border-zinc-900">
                  {PRESETS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setPreset(item.id)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                        preset === item.id ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {item.label}
                      <span className="ml-1.5 font-mono text-[10.5px] text-zinc-500">{item.hint}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {!isBusy && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (youtubeUrl.trim()) void onImportYoutube(youtubeUrl.trim(), preset);
              }}
              className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-surface p-1.5 focus-within:border-accent transition-colors"
            >
              <Link2 className="h-4 w-4 text-zinc-500 ml-2 shrink-0" />
              <input
                type="url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="YouTube link"
                className="flex-1 min-w-0 bg-transparent px-1 py-1.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!youtubeUrl.trim()}
                className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700 disabled:opacity-40 transition-colors cursor-pointer"
              >
                Import
              </button>
            </form>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (localPath.trim()) void onOpenLocalPath(localPath.trim(), preset);
              }}
              className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-surface p-1.5 focus-within:border-accent transition-colors"
            >
              <FolderOpen className="h-4 w-4 text-zinc-500 ml-2 shrink-0" />
              <input
                type="text"
                value={localPath}
                onChange={(e) => setLocalPath(e.target.value)}
                placeholder="Or paste a file path"
                className="flex-1 min-w-0 bg-transparent px-1 py-1.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!localPath.trim()}
                className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700 disabled:opacity-40 transition-colors cursor-pointer"
              >
                Open
              </button>
            </form>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-3 flex items-start gap-3 text-xs text-red-200">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          {[
            ['Whisper', 'Word-level transcript'],
            ['Ollama', 'Virality-ranked clips'],
            ['HyperFrames', 'Animated captions'],
            ['FFmpeg', '1080p, no watermark'],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-zinc-900 bg-surface px-3 py-2.5">
              <p className="text-xs font-semibold text-white">{k}</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">{v}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
