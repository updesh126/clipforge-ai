import { useState } from 'react';
import { Wand2, Loader2, AlertCircle, Mic, Sparkles, Check, Loader } from 'lucide-react';
import type { EngineStatus, JobProgress } from '../types.ts';
import type { EditProject } from './types.ts';
import { ART_STYLE_LABELS, ART_STYLE_OPTIONS } from './catalog.ts';
import { postJson, withProgress } from '../utils/api.ts';

interface Props {
  engines: EngineStatus | null;
  onCreated: (editId: string) => void;
}

const SWATCH: Record<string, string> = {
  madhubani: 'linear-gradient(135deg,#C1272D,#F4B400 50%,#2E7D32)',
  inkWash: 'linear-gradient(135deg,#EFEAE0,#5E5E5A 60%,#141414)',
  shadowPuppet: 'radial-gradient(circle at 50% 40%,#FFE2A8,#FFB347 45%,#5A230A)',
  paperCutout: 'linear-gradient(180deg,#CDEAFF 30%,#FFADAD 55%,#6D597A)',
  stainedGlass: 'conic-gradient(#1E5AA8,#C0392B,#E0B53A,#2E8B57,#6C3483,#1E5AA8)',
  anime: 'linear-gradient(180deg,#3A7BD5,#B06AB3,#FF8FAB)',
  warli: 'radial-gradient(circle,#fff 2px,transparent 3px) 0 0/12px 12px, #7A3B22',
  blueprint: 'linear-gradient(#5C8DD6 1px,transparent 1px) 0 0/10px 10px, linear-gradient(90deg,#5C8DD6 1px,#0B3D91 1px) 0 0/10px 10px',
  ukiyoe: 'radial-gradient(circle at 70% 30%,#C8452F 14%,transparent 15%), linear-gradient(180deg,#F3E6CC 55%,#5C7FA6 56%,#1F2A44)',
  miniature: 'radial-gradient(ellipse at 50% 60%,#E9A75A 25%,#2E6B3A 26%), #5B1A18',
};

const SAMPLE = `Every monsoon, India's rivers carry the story of a continent.

The Ganga alone supports over 400 million people, more than the population of the United States.

But rivers are changing. Glaciers that feed them are shrinking faster than ever recorded.

"A river is not a resource. It is a relationship," says one Himalayan farmer.

The good news? Restored wetlands can cut flood damage by up to 40 percent.

The future of our rivers depends on what we do in the next ten years.`;

export function ScriptView({ engines, onCreated }: Props) {
  const [script, setScript] = useState('');
  const [title, setTitle] = useState('');
  const [aspect, setAspect] = useState('9:16');
  const [style, setStyle] = useState('auto');
  const [voice, setVoice] = useState('af_heart');
  const [captions, setCaptions] = useState('karaoke');
  const [mode, setMode] = useState<'story' | 'graphics'>('story');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const words = script.trim() ? script.trim().split(/\s+/).length : 0;
  const estSeconds = Math.round(words / 2.5);

  const create = async () => {
    if (!script.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { edit } = await withProgress(
        (jobId) => postJson<{ edit: EditProject }>('/api/script-video', { script, title, aspect, style, voice, captions, mode, jobId }),
        (p) => setProgress((cur) => p ?? cur)
      );
      onCreated(edit.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build the video.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const steps = [
    ['plan', 'Plan scenes', 'Ollama'],
    ['voice', 'Voice-over', engines?.tts ? 'Kokoro' : 'System voice'],
    ['voice2', 'Word timing', 'Whisper'],
    ['assets', 'Draw scenes', 'Asset library'],
    ['save', 'Build edit', 'Remotion'],
  ];
  const stageIdx = !progress ? -1 : progress.stage === 'plan' ? 0 : progress.stage === 'voice' ? (progress.label.startsWith('Timing') ? 2 : 1) : progress.stage === 'assets' ? 3 : 4;

  return (
    <div className="flex-1 overflow-y-auto bg-black">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:px-6 py-8 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-white">Script → Video</h1>
          <p className="mt-1 text-sm text-zinc-400">Paste your script. ClipForge voices it, times every word, and builds scenes with motion graphics — then opens it in the editor.</p>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Video title (optional)"
            className="mt-6 w-full rounded-lg border border-zinc-800 bg-surface px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-accent"
          />
          <div className="relative mt-3">
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              rows={16}
              placeholder={'Write or paste your script here.\n\nLeave a blank line between paragraphs — each becomes one or more scenes.'}
              className="w-full resize-y rounded-xl border border-zinc-800 bg-surface px-4 py-3 text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-accent"
            />
            <div className="pointer-events-none absolute bottom-3 right-4 font-mono text-[11px] text-zinc-500">
              {words} words · ~{Math.floor(estSeconds / 60)}:{String(estSeconds % 60).padStart(2, '0')}
            </div>
          </div>
          {!script && (
            <button type="button" onClick={() => setScript(SAMPLE)} className="mt-2 text-xs text-accent hover:underline cursor-pointer">
              Use a sample script
            </button>
          )}

          {error && (
            <p className="mt-4 flex items-center gap-2 rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 text-xs text-red-200">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </p>
          )}

          {busy && (
            <div className="mt-5 rounded-xl border border-zinc-800 bg-surface p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white">{progress?.label || 'Starting…'}</span>
                <span className="font-mono text-xs text-zinc-400">{progress?.pct ?? 0}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-900">
                <div className="h-full bg-brand-gradient animate-shimmer transition-[width] duration-700" style={{ width: `${Math.max(3, progress?.pct ?? 3)}%` }} />
              </div>
              <ol className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
                {steps.map(([k, label, tool], i) => (
                  <li key={k} className={`rounded-lg border px-3 py-2 ${i === stageIdx ? 'border-accent/50 bg-accent/5' : 'border-zinc-900'}`}>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-white">
                      {i < stageIdx ? <Check className="h-3.5 w-3.5 text-accent" /> : i === stageIdx ? <Loader className="h-3.5 w-3.5 animate-spin text-accent" /> : <span className="h-3.5 w-3.5" />}
                      {label}
                    </div>
                    <p className="pl-5 font-mono text-[10.5px] text-zinc-500">{tool}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        <aside className="space-y-5">
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Look</h2>
            <div className="grid grid-cols-2 gap-2">
              {([
                ['story', 'Story', 'Places & characters change with the story, with camera moves'],
                ['graphics', 'Infographic', 'Art backdrops with stats, charts and quotes'],
              ] as const).map(([id, label, hint]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMode(id)}
                  className={`rounded-lg border p-2.5 text-left cursor-pointer ${mode === id ? 'border-accent bg-accent/5' : 'border-zinc-800 hover:border-zinc-600'}`}
                >
                  <span className="block text-xs font-semibold text-white">{label}</span>
                  <span className="mt-0.5 block text-[10.5px] leading-snug text-zinc-500">{hint}</span>
                </button>
              ))}
            </div>
          </section>
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Art style</h2>
            <div className="grid grid-cols-3 gap-2">
              {['auto', 'mix', ...ART_STYLE_OPTIONS].map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setStyle(id)}
                  className={`overflow-hidden rounded-lg border text-left cursor-pointer ${style === id ? 'border-accent ring-1 ring-accent' : 'border-zinc-800 hover:border-zinc-600'}`}
                >
                  <div
                    className="h-12"
                    style={{ background: id === 'auto' ? 'linear-gradient(135deg,#B5E2DD,#D8CCE8,#F4C7D6)' : id === 'mix' ? 'conic-gradient(#C1272D,#0B3D91,#FFB347,#2E6B3A,#FF8FAB,#C1272D)' : SWATCH[id] }}
                  />
                  <div className="truncate bg-surface px-2 py-1 text-[11px] text-zinc-200">{id === 'auto' ? 'AI picks' : id === 'mix' ? 'Mix all' : ART_STYLE_LABELS[id]}</div>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Format</h2>
            <div className="grid grid-cols-4 gap-1 rounded-lg border border-zinc-800 bg-surface p-1">
              {['9:16', '1:1', '4:5', '16:9'].map((a) => (
                <button key={a} type="button" onClick={() => setAspect(a)} className={`rounded-md py-1.5 text-xs font-mono cursor-pointer ${aspect === a ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}>
                  {a}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <Mic className="h-3.5 w-3.5" /> Voice-over
            </h2>
            {engines?.tts ? (
              <select value={voice} onChange={(e) => setVoice(e.target.value)} className="w-full rounded-lg border border-zinc-800 bg-surface px-2 py-2 text-xs text-zinc-200 focus:outline-none focus:border-accent">
                {engines.voices.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label} · {v.language} · {v.gender}
                  </option>
                ))}
              </select>
            ) : (
              <p className="rounded-lg border border-zinc-800 bg-surface px-3 py-2 text-[11px] text-zinc-400">
                Using your system voice. For natural AI voices: <code className="font-mono text-zinc-300">pip install kokoro-onnx soundfile</code>
              </p>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Captions</h2>
            <div className="grid grid-cols-5 gap-1 rounded-lg border border-zinc-800 bg-surface p-1">
              {['karaoke', 'pop', 'bold', 'clean', 'off'].map((c) => (
                <button key={c} type="button" onClick={() => setCaptions(c)} className={`rounded-md py-1.5 text-[11px] capitalize cursor-pointer ${captions === c ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}>
                  {c}
                </button>
              ))}
            </div>
          </section>

          <button
            type="button"
            disabled={!script.trim() || busy}
            onClick={() => void create()}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-black hover:bg-accent-strong disabled:opacity-50 cursor-pointer"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {busy ? 'Building your video…' : 'Create video'}
          </button>
          <p className="flex items-start gap-1.5 text-[11px] text-zinc-500">
            <Sparkles className="mt-0.5 h-3 w-3 shrink-0" /> Opens in the editor when ready — tweak anything, use Edit with AI, then Render MP4.
          </p>
        </aside>
      </div>
    </div>
  );
}
