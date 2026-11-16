import { motion } from 'motion/react';
import { Scissors, Clapperboard, ArrowRight, Film, Sparkles, Wand2, Layers, ScrollText } from 'lucide-react';
import type { ClipProject } from '../types.ts';
import type { EditSummary } from '../editor/api.ts';
import { formatRelativeDate } from '../utils/format.ts';

interface HomeViewProps {
  projects: ClipProject[];
  edits: EditSummary[];
  onStartClipping: () => void;
  onStartEditing: () => void;
  onStartScript: () => void;
  onOpenProject: (p: ClipProject) => void;
  onOpenEdit: (id: string) => void;
}

export function HomeView({ projects, edits, onStartClipping, onStartEditing, onStartScript, onOpenProject, onOpenEdit }: HomeViewProps) {
  const recent: Array<{ key: string; kind: 'clip' | 'edit'; name: string; meta: string; at: string; open: () => void }> = [
    ...projects.map((p) => ({
      key: p.id,
      kind: 'clip' as const,
      name: p.name,
      meta: `${p.clips.length} clips`,
      at: p.updatedAt,
      open: () => onOpenProject(p),
    })),
    ...edits.map((e) => ({
      key: e.id,
      kind: 'edit' as const,
      name: e.name,
      meta: `${e.itemCount} layers · ${e.width}×${e.height}`,
      at: e.updatedAt,
      open: () => onOpenEdit(e.id),
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 6);

  const cards = [
    {
      id: 'clip',
      title: 'Clip',
      lead: 'Long video in, viral shorts out',
      body: 'Whisper transcribes, a local AI picks the best moments, and you export captioned 9:16 clips.',
      points: ['Auto highlight detection', 'Karaoke & pop captions', 'Batch export'],
      icon: Scissors,
      cta: 'Start clipping',
      onClick: onStartClipping,
      tint: 'from-accent/20',
    },
    {
      id: 'script',
      title: 'Script',
      lead: 'Words in, finished video out',
      body: 'Paste a script — it gets a voice-over, word-timed captions and motion graphics in the art style you pick.',
      points: ['AI voice-over', 'Madhubani, Warli, ukiyo-e…', 'Scenes planned by AI'],
      icon: ScrollText,
      cta: 'Write a script',
      onClick: onStartScript,
      tint: 'from-peach/20',
    },
    {
      id: 'edit',
      title: 'Edit',
      lead: 'Full timeline editor with motion graphics',
      body: 'Remotion-powered editor: layers, Vox-style graphics, effects — or just tell the local AI what to change.',
      points: ['Multi-track timeline', 'Edit with AI (Ollama)', 'Vox-style templates'],
      icon: Clapperboard,
      cta: 'Open editor',
      onClick: onStartEditing,
      tint: 'from-lavender/20',
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-black">
      <div className="relative mx-auto w-full max-w-5xl px-4 sm:px-6 py-10 sm:py-14">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,rgba(216,204,232,0.10),transparent_60%)]" />
        <div className="relative text-center mb-10">
          <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1 text-[11px] text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Everything runs on this computer
          </p>
          <h1 className="font-display text-3xl sm:text-5xl font-semibold tracking-tight text-white [text-wrap:balance]">What are we making today?</h1>
          <p className="mt-3 text-sm sm:text-base text-zinc-400">Cut a long video into shorts, or build a full edit with motion graphics.</p>
        </div>

        <div className="relative grid gap-4 md:grid-cols-3">
          {cards.map((c, i) => {
            const Icon = c.icon;
            return (
              <motion.button
                key={c.id}
                type="button"
                onClick={c.onClick}
                // staggered entrance + springy hover (Motion)
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 * i, type: 'spring', stiffness: 260, damping: 24 }}
                whileHover={{ y: -4 }}
                whileTap={{ scale: 0.985 }}
                className={`group text-left rounded-2xl border border-zinc-800 bg-gradient-to-br ${c.tint} to-transparent bg-surface p-6 sm:p-7 transition-colors hover:border-zinc-600 cursor-pointer`}
              >
                <div className="flex items-center justify-between">
                  <span className="h-11 w-11 rounded-xl border border-zinc-800 bg-black grid place-items-center">
                    <Icon className="h-5 w-5 text-accent" />
                  </span>
                  <ArrowRight className="h-5 w-5 text-zinc-600 transition-transform group-hover:translate-x-1 group-hover:text-white" />
                </div>
                <h2 className="mt-5 font-display text-2xl font-semibold text-white">{c.title}</h2>
                <p className="mt-1 text-sm font-medium text-zinc-200">{c.lead}</p>
                <p className="mt-2 text-sm text-zinc-400 [text-wrap:pretty]">{c.body}</p>
                <ul className="mt-4 flex flex-wrap gap-1.5">
                  {c.points.map((p) => (
                    <li key={p} className="rounded-md border border-zinc-800 bg-black/60 px-2 py-1 text-[11px] text-zinc-300">
                      {p}
                    </li>
                  ))}
                </ul>
                <span className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black">
                  {c.cta}
                </span>
              </motion.button>
            );
          })}
        </div>

        {recent.length > 0 && (
          <div className="relative mt-10">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Continue where you left off</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {recent.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={r.open}
                  className="flex items-center gap-3 rounded-xl border border-zinc-900 bg-surface px-3 py-3 text-left hover:border-zinc-700 cursor-pointer"
                >
                  <span className={`h-9 w-9 shrink-0 rounded-lg grid place-items-center ${r.kind === 'clip' ? 'bg-accent/10 text-accent' : 'bg-lavender/10 text-lavender'}`}>
                    {r.kind === 'clip' ? <Film className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-white">{r.name}</span>
                    <span className="block text-[11px] text-zinc-500">
                      {r.kind === 'clip' ? 'Clipping' : 'Edit'} · {r.meta} · {formatRelativeDate(r.at)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="relative mt-10 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          {[
            [Wand2, 'Whisper', 'Word-level transcript'],
            [Sparkles, 'Ollama', 'Clip ranking & AI edits'],
            [Clapperboard, 'Remotion', 'Editor & motion graphics'],
            [Film, 'FFmpeg + HyperFrames', 'Clip export'],
          ].map(([I, k, v]) => {
            const Icon = I as typeof Film;
            return (
              <div key={k as string} className="rounded-lg border border-zinc-900 bg-surface px-3 py-3">
                <Icon className="mx-auto h-4 w-4 text-zinc-500" />
                <p className="mt-1.5 text-xs font-semibold text-white">{k as string}</p>
                <p className="mt-0.5 text-[11px] text-zinc-500">{v as string}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
