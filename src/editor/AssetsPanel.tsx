import { LottieThumb } from './LottieThumb.tsx';
import { useEffect, useState } from 'react';
import { Search, Loader2, Wand2, Upload, AlertCircle } from 'lucide-react';
import type { AssetEntry, AssetType } from '../assetkit/types.ts';
import { ART_STYLE_LABELS, ART_STYLE_OPTIONS } from './catalog.ts';
import { postJson } from '../utils/api.ts';

interface Props {
  onAdd: (asset: AssetEntry) => void;
}

const CATS = ['all', 'characters', 'animals', 'birds', 'nature', 'buildings', 'props', 'backgrounds'];
const TYPES: AssetType[] = ['person', 'animal', 'bird', 'tree', 'building', 'object', 'background'];

const dash = (t: string) => t.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cartoon';

/** Where to find PNG / SVG / Lottie assets, with each site's licence in short. */
const SOURCES: Array<{ name: string; domain: string; url: (t: string) => string; badge: '✓' | '?' | 'NC'; licence: string }> = [
  { name: 'CleanPNG', domain: 'cleanpng.com', url: (t) => `https://www.cleanpng.com/free/${dash(t)}.html`, badge: '?', licence: 'Licence differs per image — check each image page' },
  { name: 'SVG Repo', domain: 'svgrepo.com', url: (t) => `https://www.svgrepo.com/vectors/${dash(t)}/`, badge: '?', licence: 'Mostly SVG Repo License (commercial OK, no credit); some CC BY-NC or logos — check the icon page' },
  { name: 'IconScout Lottie', domain: 'iconscout.com', url: (t) => `https://iconscout.com/free-lottie-animations/${dash(t)}`, badge: '✓', licence: 'Free Lottie: commercial use OK with attribution to IconScout' },
  { name: 'pngimg', domain: 'pngimg.com', url: (t) => `https://pngimg.com/search_image/?search_image=${encodeURIComponent(t)}`, badge: 'NC', licence: 'CC BY-NC 4.0 — non-commercial only, attribution required' },
];

export function AssetsPanel({ onAdd }: Props) {
  const [style, setStyle] = useState('flat');
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [assets, setAssets] = useState<AssetEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<AssetType | 'auto'>('auto');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inbox, setInbox] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ style, q, ...(cat !== 'all' ? { category: cat } : {}) });
      const r = await fetch(`/api/assets?${params}`);
      const d = (await r.json()) as { assets: AssetEntry[]; inbox?: string };
      setAssets(d.assets ?? []);
      if (d.inbox) setInbox(d.inbox);
    } finally {
      setLoading(false);
    }
  };

  const term = (q || newName || 'cartoon').trim();

  const editLicence = async (a: AssetEntry) => {
    const licence = window.prompt(
      `Licence for "${a.name}"${a.source ? `\nSource: ${a.source}` : ''}\n\nType what the image page says, e.g. "CC0", "commercial use allowed", "personal use only", "own work":`,
      a.licence && a.licence !== 'unverified' ? a.licence : ''
    );
    if (licence === null) return;
    const source = window.prompt('Image page URL (so you can find it again):', a.source?.startsWith('http') ? a.source : '') ?? undefined;
    try {
      await postJson('/api/assets/licence', { url: a.url, licence: licence.trim() || 'unverified', source: source?.trim() || a.source });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the licence.');
    }
  };

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style, q, cat]);

  const generate = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { asset } = await postJson<{ asset: AssetEntry }>('/api/assets/generate', { name: newName.trim(), style, type: newType === 'auto' ? undefined : newType });
      setNewName('');
      setAssets((a) => [asset, ...a.filter((x) => x.id !== asset.id)]);
      onAdd(asset);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the asset.');
    } finally {
      setBusy(false);
    }
  };

  const importPng = async () => {
    setError(null);
    const r = await fetch('/api/pick-file?kind=media');
    const { path } = (await r.json()) as { path: string | null };
    if (!path) return;
    if (!/\.png$/i.test(path)) {
      setError('Pick a transparent .png file.');
      return;
    }
    const category = window.prompt('Folder: characters, animals, birds, nature, buildings, props or backgrounds', 'characters') || 'props';
    const name = window.prompt('Name (words become search tags)', path.split(/[\\/]/).pop()?.replace(/\.png$/i, '').replace(/[_-]+/g, ' ') ?? '') || '';
    const source = window.prompt('Where is it from? (URL or "my own")', '') || '';
    const licence = window.prompt('Licence (e.g. CC0, own work, purchased)', '') || '';
    try {
      const { asset } = await postJson<{ asset: AssetEntry }>('/api/assets/import', { path, category, name, source, licence });
      setAssets((a) => [asset, ...a]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 border-b border-zinc-900 p-3">
        <div className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-black px-2">
          <Search className="h-3.5 w-3.5 text-zinc-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search elephant, farmer, village…" className="w-full bg-transparent py-1.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none" />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <select value={style} onChange={(e) => setStyle(e.target.value)} className="rounded-md border border-zinc-800 bg-black px-1.5 py-1 text-[11px] text-zinc-300 focus:outline-none" title="Art style to draw in">
            <option value="flat">Flat colour</option>
            {ART_STYLE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {ART_STYLE_LABELS[s]}
              </option>
            ))}
          </select>
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="rounded-md border border-zinc-800 bg-black px-1.5 py-1 text-[11px] capitalize text-zinc-300 focus:outline-none">
            {CATS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {loading && <Loader2 className="mx-auto my-4 h-4 w-4 animate-spin text-zinc-500" />}
        {!loading && assets.length === 0 && <p className="text-[11px] text-zinc-500">Nothing yet in this style — create one below. Built-in names: farmer, woman, child, elephant, tiger, peacock, banyan tree, temple, village, himalaya, river valley…</p>}
        <div className="grid grid-cols-3 gap-1.5">
          {assets.map((a) => (
            <div key={a.id} className="group relative overflow-hidden rounded-md border border-zinc-900 bg-[repeating-conic-gradient(#18181b_0%_25%,#0f0f12_0%_50%)] bg-[length:12px_12px] hover:border-accent">
              <button
                type="button"
                title={`${a.name} · ${a.style === 'any' ? 'your PNG' : a.style}${a.aspect ? ` · ${a.aspect}` : ''}${a.source ? `\nSource: ${a.source}` : ''}${a.licence ? `\nLicence: ${a.licence}` : ''}`}
                onClick={() => onAdd(a)}
                className="block w-full cursor-pointer"
              >
                {a.animated ? (
                  <LottieThumb url={a.url} name={a.name} />
                ) : (
                  <img src={a.url} alt={a.name} loading="lazy" className="aspect-square w-full object-contain" />
                )}
                <span className="block truncate bg-black/80 px-1 py-0.5 text-[10px] text-zinc-300 group-hover:text-white">{a.name}</span>
              </button>
              {a.style === 'any' && (
                <button
                  type="button"
                  onClick={() => void editLicence(a)}
                  title={a.licenceStatus === 'ok' ? `Licence: ${a.licence}` : a.licenceStatus === 'restricted' ? `Not for commercial use: ${a.licence}` : 'Licence not checked — click to record it'}
                  className={`absolute right-1 top-1 rounded px-1 text-[9px] font-semibold cursor-pointer ${
                    a.licenceStatus === 'ok' ? 'bg-accent text-black' : a.licenceStatus === 'restricted' ? 'bg-red-500 text-white' : 'bg-peach text-black'
                  }`}
                >
                  {a.licenceStatus === 'ok' ? '✓' : a.licenceStatus === 'restricted' ? 'NC' : '?'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1.5 border-t border-zinc-900 p-3">
        <p className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500">Find “{term}” on…</p>
        <div className="grid grid-cols-2 gap-1">
          {SOURCES.map((s) => (
            <a
              key={s.name}
              href={s.url(term)}
              target="_blank"
              rel="noopener noreferrer"
              title={s.licence}
              className="flex items-center gap-1.5 rounded-md border border-zinc-800 px-2 py-1 text-[11px] text-zinc-200 hover:border-accent hover:text-white"
            >
              <img src={`https://${s.domain}/favicon.ico`} alt="" className="h-3.5 w-3.5 rounded-sm" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
              <span className="min-w-0 flex-1 truncate">{s.name}</span>
              <span className={`shrink-0 rounded px-1 text-[8.5px] font-bold ${s.badge === 'NC' ? 'bg-red-500 text-white' : s.badge === '✓' ? 'bg-accent text-black' : 'bg-peach text-black'}`}>{s.badge}</span>
            </a>
          ))}
        </div>
        <p className="text-[10px] leading-snug text-zinc-500">
          ✓ commercial use OK (credit needed) · ? check each image · NC non-commercial only. Download PNG, SVG or Lottie JSON, then drop it into the inbox — it's sorted, licence-tagged and used in Story videos automatically:
          <code className="mt-0.5 block break-all font-mono text-[10px] text-zinc-400">{inbox || 'assets/library/inbox'}</code>
        </p>
        <button
          type="button"
          onClick={async () => {
            const r = await postJson<{ imported: AssetEntry[] }>('/api/assets/inbox', {});
            setError(r.imported.length ? null : 'Inbox is empty.');
            await load();
          }}
          className="w-full rounded-md border border-zinc-800 px-2 py-1 text-[11px] text-zinc-300 hover:text-white cursor-pointer"
        >
          Check inbox now
        </button>
      </div>

      <div className="space-y-1.5 border-t border-zinc-900 p-3">
        <p className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500">Create a new asset</p>
        <div className="flex gap-1.5">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void generate()}
            placeholder="e.g. camel, fisherwoman, lighthouse"
            className="min-w-0 flex-1 rounded-md border border-zinc-800 bg-black px-2 py-1 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-accent"
          />
          <select value={newType} onChange={(e) => setNewType(e.target.value as AssetType | 'auto')} className="rounded-md border border-zinc-800 bg-black px-1 text-[11px] text-zinc-300 focus:outline-none">
            <option value="auto">auto</option>
            {TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button type="button" disabled={busy || !newName.trim()} onClick={() => void generate()} className="inline-flex items-center justify-center gap-1 rounded-md bg-accent px-2 py-1.5 text-[11px] font-semibold text-black disabled:opacity-50 cursor-pointer">
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />} Draw it
          </button>
          <button type="button" onClick={() => void importPng()} className="inline-flex items-center justify-center gap-1 rounded-md border border-zinc-800 px-2 py-1.5 text-[11px] text-zinc-300 hover:text-white cursor-pointer">
            <Upload className="h-3 w-3" /> Import PNG
          </button>
        </div>
        {error && (
          <p className="flex items-center gap-1 text-[11px] text-red-300">
            <AlertCircle className="h-3 w-3" /> {error}
          </p>
        )}
        <p className="text-[10px] text-zinc-600">Saved in assets/library — reused in future videos. Only import images you have the right to use.</p>
      </div>
    </div>
  );
}
