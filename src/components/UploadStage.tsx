import { useRef, useState } from 'react';
import { Film, Upload, Play, AlertCircle, Loader2, Link2 } from 'lucide-react';
import type { ClipLengthPreset } from '../types.ts';

interface UploadStageProps {
  isBusy: boolean;
  busyStage: string;
  error: string | null;
  onUploadFile: (file: File, preset: ClipLengthPreset) => Promise<void>;
  onImportYoutube: (url: string, preset: ClipLengthPreset) => Promise<void>;
  onOpenLocalPath: (filePath: string, preset: ClipLengthPreset) => Promise<void>;
  onGenerateDemo: (preset: ClipLengthPreset) => Promise<void>;
}

const PRESETS: Array<{ id: ClipLengthPreset; label: string; hint: string }> = [
  { id: 'auto', label: 'Auto', hint: '15–55s' },
  { id: 'short', label: 'Short', hint: '12–28s' },
  { id: 'medium', label: 'Medium', hint: '28–55s' },
  { id: 'long', label: 'Long', hint: '55–90s' },
];

export function UploadStage({
  isBusy,
  busyStage,
  error,
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
    const file = files[0];
    void onUploadFile(file, preset);
  };

  const handleYoutubeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!youtubeUrl.trim() || isBusy) return;
    void onImportYoutube(youtubeUrl.trim(), preset);
  };

  return (
    <div className="flex-1 bg-black flex items-center justify-center px-6 py-10 overflow-y-auto">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-white [text-wrap:balance]">
            Drop a video or paste a YouTube link.
          </h1>
          <p className="mt-3 text-sm sm:text-base text-zinc-400 max-w-xl mx-auto">
            Local-first processing on your machine with automatic highlight selection, synced captions, and watermark-free MP4 export.
          </p>
        </div>

        {/* Target clip length segmented selector */}
        <div className="mb-5 flex flex-wrap items-center justify-center gap-3">
          <span className="text-xs font-medium text-zinc-400">Target clip length</span>
          <div className="inline-flex items-center rounded-lg bg-[#0C0C0E] p-1 border border-zinc-900">
            {PRESETS.map((item) => {
              const active = preset === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={isBusy}
                  onClick={() => setPreset(item.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {item.label}
                  <span className="ml-1.5 font-mono text-[11px] text-zinc-500">
                    {item.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* YouTube URL import bar */}
        <form
          onSubmit={handleYoutubeSubmit}
          className="mb-4 flex items-center gap-2 rounded-xl border border-zinc-800 bg-[#09090B] p-2 focus-within:border-[#4F8BFF] transition-colors"
        >
          <Link2 className="h-4 w-4 text-zinc-500 ml-2 shrink-0" />
          <input
            type="url"
            disabled={isBusy}
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="Paste a YouTube video or Shorts URL (https://youtube.com/watch?v=...)"
            className="flex-1 min-w-0 bg-transparent px-1 py-1.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={isBusy || !youtubeUrl.trim()}
            className="rounded-lg bg-[#4F8BFF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#3b7af5] disabled:opacity-40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Import Link
          </button>
        </form>

        {/* Open from disk by path — no upload/copy, best for very large files */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (localPath.trim() && !isBusy) void onOpenLocalPath(localPath.trim(), preset);
          }}
          className="mb-4 flex items-center gap-2 rounded-xl border border-zinc-800 bg-[#09090B] p-2 focus-within:border-[#4F8BFF] transition-colors"
        >
          <span className="ml-2 shrink-0 text-xs text-zinc-500">Path</span>
          <input
            type="text"
            disabled={isBusy}
            value={localPath}
            onChange={(e) => setLocalPath(e.target.value)}
            placeholder="Large file? Paste its path, e.g. /Users/you/Movies/podcast.mp4 (no upload, no copy)"
            className="flex-1 min-w-0 bg-transparent px-1 py-1.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={isBusy || !localPath.trim()}
            className="rounded-lg bg-[#4F8BFF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#3b7af5] disabled:opacity-40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Open from disk
          </button>
        </form>

        {/* Main dropzone */}
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
          className={`relative rounded-xl border transition-colors bg-[#09090B] p-9 text-center ${
            dragOver
              ? 'border-[#4F8BFF] bg-[#0B111E]'
              : 'border-zinc-800 hover:border-zinc-700'
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
            <div className="py-8 flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 text-[#4F8BFF] animate-spin" />
              <div>
                <p className="text-sm font-medium text-white">{busyStage}</p>
                <p className="mt-1 text-xs text-zinc-400">
                  Running local FFmpeg extraction and AI highlight analysis
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="h-12 w-12 rounded-xl bg-[#141417] border border-zinc-800 flex items-center justify-center mb-4">
                <Film className="h-5 w-5 text-zinc-300" />
              </div>
              <p className="text-sm font-medium text-white">
                Select a video on this computer — it's used in place, never uploaded
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Any size · MP4, MOV, WebM, MKV · Dragging a file here copies it instead
              </p>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={async () => {
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
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-[#141417] px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Select Local Video
                </button>
                <button
                  type="button"
                  onClick={() => void onGenerateDemo(preset)}
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-[#121215] px-4 py-2 text-xs font-medium text-zinc-200 hover:border-zinc-700 hover:bg-zinc-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Play className="h-3.5 w-3.5 text-zinc-400" />
                  Try Sample Session
                </button>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-3 flex items-start gap-3 text-xs text-red-200">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-zinc-500">
          <span>YouTube URL & local MP4 support</span>
          <span aria-hidden="true">·</span>
          <span>9:16, 1:1, and 16:9 export</span>
          <span aria-hidden="true">·</span>
          <span>Burned captions + SRT sidecar</span>
          <span aria-hidden="true">·</span>
          <span>No watermark</span>
        </div>
      </div>
    </div>
  );
}
