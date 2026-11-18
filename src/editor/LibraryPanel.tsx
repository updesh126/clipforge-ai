import { useState } from 'react';
import { Plus, FolderOpen, Loader2, Type, Zap, Film, Palette, Shapes, Sparkles } from 'lucide-react';
import { EffectsLibrary, MotionLibrary } from './MotionLibrary.tsx';
import { AssetsPanel } from './AssetsPanel.tsx';
import type { AssetEntry } from '../assetkit/types.ts';
import type { EffectId, TemplateId } from './types.ts';
import { ART_STYLE_LABELS, ART_STYLE_OPTIONS, TEMPLATES } from './catalog.ts';

const ART_SWATCH: Record<string, string[]> = {
  madhubani: ['#C1272D', '#F4B400', '#2E7D32', '#F6E7C1'],
  inkWash: ['#141414', '#5E5E5A', '#EFEAE0', '#B3261E'],
  shadowPuppet: ['#1B0E05', '#FFB347', '#FFE2A8', '#5A230A'],
  paperCutout: ['#FFADAD', '#6D597A', '#FFD166', '#CDEAFF'],
  stainedGlass: ['#1E5AA8', '#C0392B', '#E0B53A', '#2E8B57'],
  anime: ['#3A7BD5', '#B06AB3', '#FF8FAB', '#FFFDE7'],
  warli: ['#7A3B22', '#FFFFFF', '#A0522D', '#FFFFFF'],
  blueprint: ['#0B3D91', '#9CC3FF', '#FFFFFF', '#5C8DD6'],
  ukiyoe: ['#1F2A44', '#5C7FA6', '#C8452F', '#F3E6CC'],
  miniature: ['#5B1A18', '#D4A537', '#2E6B3A', '#1B3A6B'],
  collage: ['#111111', '#D9D9D6', '#FFD400', '#F7F6F2'],
};
import type { ClipProject } from '../types.ts';

interface Props {
  projects: ClipProject[];
  onAddTemplate: (t: TemplateId, props?: Record<string, string | number>) => void;
  onAddEffect: (e: EffectId) => void;
  onAddMotion: (fx: string) => void;
  aspect?: { width: number; height: number };
  onAddFile: () => Promise<void>;
  onAddProjectVideo: (p: ClipProject) => void;
  onAddAsset: (a: AssetEntry) => void;
}

type Tab = 'motion' | 'assets' | 'graphics' | 'art' | 'effects' | 'media';
const VOX: TemplateId[] = ['paperTitle', 'markerHighlight', 'stat', 'barChart', 'callout'];
const ART: TemplateId[] = ['artCard', 'artFrame', 'artBanner'];

export function LibraryPanel({ projects, onAddTemplate, onAddEffect, onAddMotion, aspect, onAddFile, onAddProjectVideo, onAddAsset }: Props) {
  const [tab, setTab] = useState<Tab>('motion');
  const [busy, setBusy] = useState(false);
  const tabs: Array<{ id: Tab; label: string; icon: typeof Type }> = [
    { id: 'motion', label: 'Motion', icon: Sparkles },
    { id: 'effects', label: 'Effects', icon: Zap },
    { id: 'graphics', label: 'Titles', icon: Type },
    { id: 'art', label: 'Art', icon: Palette },
    { id: 'assets', label: 'Assets', icon: Shapes },
    { id: 'media', label: 'Media', icon: Film },
  ];
  const card = 'w-full text-left rounded-lg border border-zinc-900 bg-black px-3 py-2 hover:border-zinc-700 cursor-pointer group';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="grid grid-cols-6 border-b border-zinc-900">
        {tabs.map((t) => {
          const I = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              title={t.label}
              className={`flex min-w-0 flex-col items-center gap-0.5 px-0.5 py-2 text-[10px] cursor-pointer ${tab === t.id ? 'text-white shadow-[inset_0_-2px_0_var(--color-accent)]' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <I className="h-3.5 w-3.5 shrink-0" />
              <span className="w-full truncate text-center">{t.label}</span>
            </button>
          );
        })}
      </div>
      {tab === 'assets' && <AssetsPanel onAdd={onAddAsset} />}
      {tab === 'motion' && <MotionLibrary onAdd={onAddMotion} aspect={aspect ?? { width: 1080, height: 1920 }} />}
      {tab === 'effects' && <EffectsLibrary onAddEffect={onAddEffect} onAddMotion={onAddMotion} aspect={aspect ?? { width: 1080, height: 1920 }} />}
      <div className={`flex-1 min-h-0 overflow-y-auto p-3 space-y-1.5 ${tab === 'assets' || tab === 'motion' || tab === 'effects' ? 'hidden' : ''}`}>
        {tab === 'graphics' &&
          ([
            ['Titles & overlays', (Object.keys(TEMPLATES) as TemplateId[]).filter((id) => !VOX.includes(id) && !ART.includes(id) && id !== 'motion')],
            ['Vox-style explainers', VOX],
          ] as const).map(([heading, ids]) => (
            <div key={heading} className="space-y-1.5">
              <p className="px-1 pt-1 text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500">{heading}</p>
              {ids.map((id) => (
                <button key={id} type="button" className={card} onClick={() => onAddTemplate(id)}>
                  <span className="flex items-center justify-between text-xs font-medium text-white">
                    {TEMPLATES[id].label.replace(' (Vox)', '')}
                    <Plus className="h-3.5 w-3.5 text-zinc-600 group-hover:text-accent" />
                  </span>
                  <span className="block text-[11px] text-zinc-500">{TEMPLATES[id].description}</span>
                </button>
              ))}
            </div>
          ))}
        {tab === 'art' &&
          ART_STYLE_OPTIONS.map((style) => (
            <div key={style} className="rounded-lg border border-zinc-900 bg-black px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-white">{ART_STYLE_LABELS[style]}</span>
                <span className="flex overflow-hidden rounded">
                  {ART_SWATCH[style].map((c, i) => (
                    <span key={i} className="h-3 w-3" style={{ background: c }} />
                  ))}
                </span>
              </div>
              <div className="mt-1.5 grid grid-cols-3 gap-1">
                {([
                  ['artCard', 'Card'],
                  ['artFrame', 'Frame'],
                  ['artBanner', 'Banner'],
                ] as const).map(([t, label]) => (
                  <button
                    key={t}
                    type="button"
                    title={TEMPLATES[t].description}
                    onClick={() => onAddTemplate(t, { style })}
                    className="rounded border border-zinc-800 py-1 text-[10.5px] text-zinc-300 hover:border-accent hover:text-white cursor-pointer"
                  >
                    + {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        {tab === 'media' && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onAddFile();
                } finally {
                  setBusy(false);
                }
              }}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-black hover:bg-accent-strong disabled:opacity-60 cursor-pointer"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderOpen className="h-3.5 w-3.5" />}
              Add video, music or image
            </button>
            <p className="px-1 pb-1 text-[11px] text-zinc-500">Files are used in place from your disk.</p>
            {projects.filter((p) => p.sourceType !== 'youtube-embed' && p.sourceFileName).length > 0 && (
              <p className="pt-2 px-1 text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500">From your clipping projects</p>
            )}
            {projects
              .filter((p) => p.sourceType !== 'youtube-embed' && p.sourceFileName)
              .map((p) => (
                <button key={p.id} type="button" className={card} onClick={() => onAddProjectVideo(p)}>
                  <span className="flex items-center justify-between gap-2 text-xs font-medium text-white">
                    <span className="truncate">{p.name}</span>
                    <Plus className="h-3.5 w-3.5 shrink-0 text-zinc-600 group-hover:text-accent" />
                  </span>
                  <span className="block text-[11px] text-zinc-500">Full video · {Math.round(p.metadata.duration)}s · with captions</span>
                </button>
              ))}
          </>
        )}
      </div>
    </div>
  );
}
