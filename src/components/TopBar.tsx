import { useEffect, useRef, useState } from 'react';
import { Plus, Cpu, RefreshCw } from 'lucide-react';
import type { AppTab, EngineStatus } from '../types.ts';

interface TopBarProps {
  activeTab: AppTab;
  engines: EngineStatus | null;
  onRefreshEngines: () => Promise<void>;
  onSelectTab: (tab: AppTab) => void;
  onNewVideo: () => void;
  onHome: () => void;
}

type Level = 'ok' | 'warn' | 'off';

function engineRows(e: EngineStatus | null): Array<{ name: string; detail: string; level: Level; fix?: string }> {
  if (!e) return [{ name: 'Server', detail: 'Not reachable', level: 'off', fix: 'npm run dev' }];
  return [
    {
      name: 'FFmpeg',
      detail: e.ffmpeg ? (e.libass ? 'Crop, encode, captions' : 'No libass — captions via HyperFrames/SRT') : 'Missing — required',
      level: e.ffmpeg ? (e.libass ? 'ok' : 'warn') : 'off',
      fix: e.ffmpeg ? undefined : 'winget install Gyan.FFmpeg · brew install ffmpeg-full',
    },
    {
      name: 'Whisper',
      detail: e.whisper ? e.whisperName : 'Missing — required',
      level: e.whisper ? 'ok' : 'off',
      fix: e.whisper ? undefined : 'Install whisper.cpp (whisper-cli)',
    },
    {
      name: 'HyperFrames',
      detail: e.hyperframes ? 'Motion captions, hook titles, intros' : 'Not installed',
      level: e.hyperframes ? 'ok' : 'warn',
      fix: e.hyperframes ? undefined : 'npm install',
    },
    {
      name: 'Voice (TTS)',
      detail: e.tts ? 'Kokoro-82M via HyperFrames' : 'Using system voice',
      level: e.tts ? 'ok' : 'warn',
      fix: e.tts ? undefined : 'pip install kokoro-onnx soundfile',
    },
    {
      name: 'Ollama',
      detail: e.ollama ? (e.ollamaModelInstalled ? e.ollamaModel : `${e.ollamaModel} not pulled`) : 'Off — built-in scorer',
      level: e.ollama && e.ollamaModelInstalled ? 'ok' : 'warn',
      fix: e.ollama ? (e.ollamaModelInstalled ? undefined : `ollama pull ${e.ollamaModel}`) : 'ollama serve',
    },
  ];
}

const DOT: Record<Level, string> = { ok: 'bg-accent', warn: 'bg-peach', off: 'bg-red-400' };

export function TopBar({ activeTab, engines, onRefreshEngines, onSelectTab, onNewVideo, onHome }: TopBarProps) {
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const rows = engineRows(engines);
  const worst: Level = rows.some((r) => r.level === 'off') ? 'off' : rows.some((r) => r.level === 'warn') ? 'warn' : 'ok';
  const readyCount = rows.filter((r) => r.level === 'ok').length;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  const navItems: Array<{ id: AppTab; label: string }> = [
    { id: 'home', label: 'Home' },
    { id: 'studio', label: 'Clip' },
    { id: 'script', label: 'Script' },
    { id: 'editor', label: 'Edit' },
    { id: 'library', label: 'Library' },
    { id: 'architecture', label: 'How it works' },
  ];

  return (
    <header className="h-14 shrink-0 border-b border-zinc-900 bg-black px-4 sm:px-6 flex items-center justify-between gap-4 sm:gap-8">
      <button
        type="button"
        onClick={onHome}
        title="Home"
        className="flex items-center gap-2 font-display text-base font-semibold tracking-tight text-white whitespace-nowrap shrink-0 cursor-pointer"
      >
        <span className="h-6 w-6 rounded-md bg-brand-gradient grid place-items-center text-[11px] font-bold text-black">C</span>
        <span className="hidden sm:inline">ClipForge AI</span>
      </button>

      <nav className="flex items-center gap-4 sm:gap-6 text-sm min-w-0 overflow-x-auto">
        {navItems.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`relative py-4 font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                active ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {item.label}
              {active && <span className="absolute inset-x-0 bottom-0 h-[2px] bg-accent" />}
            </button>
          );
        })}
      </nav>

      <div className="flex items-center gap-2 shrink-0">
        <div ref={boxRef} className="relative">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            title="Local engines"
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-300 hover:border-zinc-700 cursor-pointer"
          >
            <span className={`h-2 w-2 rounded-full ${DOT[worst]}`} />
            <Cpu className="h-3.5 w-3.5 text-zinc-500" />
            <span className="hidden md:inline font-mono">{readyCount}/{rows.length} engines</span>
          </button>
          {open && (
            <div className="absolute right-0 top-full mt-2 w-80 z-50 rounded-xl border border-zinc-800 bg-panel p-3 shadow-2xl shadow-black">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-white">Local engines</p>
                <button
                  type="button"
                  onClick={async () => {
                    setRefreshing(true);
                    await onRefreshEngines();
                    setRefreshing(false);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white cursor-pointer"
                >
                  <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} /> Re-check
                </button>
              </div>
              <ul className="space-y-2">
                {rows.map((r) => (
                  <li key={r.name} className="flex gap-2.5">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[r.level]}`} />
                    <div className="min-w-0">
                      <p className="text-xs text-zinc-200">
                        <span className="font-medium text-white">{r.name}</span> · {r.detail}
                      </p>
                      {r.fix && <code className="mt-0.5 block truncate font-mono text-[10.5px] text-zinc-500">{r.fix}</code>}
                    </div>
                  </li>
                ))}
              </ul>
              <p className="mt-3 border-t border-zinc-900 pt-2 text-[11px] text-zinc-500">Everything runs on this computer. Nothing is uploaded.</p>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onNewVideo}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-1.5 text-xs font-semibold text-black hover:bg-accent-strong transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">New video</span>
        </button>
      </div>
    </header>
  );
}
