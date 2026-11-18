import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, Cloud, Download, HardDrive, Loader2, Trash2, X } from 'lucide-react';
import type { JobProgress } from '../types.ts';
import { newJobId, postJson } from '../utils/api.ts';

interface Installed {
  name: string;
  sizeGb: number;
  cloud: boolean;
}
interface Suggested {
  name: string;
  label: string;
  sizeGb: number;
  note: string;
}

const JOB_KEY = 'clipforge.modelPull';

/** Download, list and remove the local AI models (Ollama) that plan videos and write scripts. */
export function ModelManager({ onClose }: { onClose: () => void }) {
  const [ollama, setOllama] = useState(true);
  const [installed, setInstalled] = useState<Installed[]>([]);
  const [suggested, setSuggested] = useState<Suggested[]>([]);
  const [custom, setCustom] = useState('');
  const [pulling, setPulling] = useState<string | null>(null);
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const job = useRef<string | null>(null);

  const refresh = async () => {
    type Data = { ollama: boolean; installed: Installed[]; suggested: Suggested[] };
    let d: Data | null = null;
    // the server may be restarting for a moment — try a few times before giving up
    for (let i = 0; i < 6 && !d; i++) {
      if (i) await new Promise((r) => setTimeout(r, 1500));
      d = await fetch('/api/models')
        .then((r) => (r.ok ? (r.json() as Promise<Data>) : null))
        .catch(() => null);
    }
    if (!d) {
      setError('Could not reach ClipForge — is npm run dev still running?');
      return;
    }
    setOllama(d.ollama);
    setInstalled(d.installed);
    setSuggested(d.suggested);
  };

  /** Follow a download by job id (survives closing and reopening this window). */
  const follow = async (jobId: string, name: string) => {
    job.current = jobId;
    setPulling(name);
    setError(null);
    try {
      for (;;) {
        await new Promise((r) => setTimeout(r, 800));
        if (job.current !== jobId) return;
        type Job = JobProgress & { result?: { model?: string; error?: string } };
        const j: Job | null = await fetch(`/api/jobs/${jobId}`)
          .then((r) => r.json() as Promise<{ job: Job | null }>)
          .then((d) => d.job)
          .catch(() => null);
        if (j?.result?.model) {
          setNotice(`${name} is ready — pick it in the Script Writer's AI model list.`);
          break;
        }
        if (j?.result?.error) {
          if (j.result.error !== 'Cancelled') setError(j.result.error);
          else setNotice('Download stopped. Start it again any time — it carries on where it stopped.');
          break;
        }
        if (j) setProgress(j);
      }
    } finally {
      try {
        localStorage.removeItem(JOB_KEY);
      } catch {
        /* storage blocked */
      }
      job.current = null;
      setPulling(null);
      setProgress(null);
      void refresh();
    }
  };

  useEffect(() => {
    void refresh();
    try {
      const saved = JSON.parse(localStorage.getItem(JOB_KEY) ?? 'null') as { jobId: string; name: string } | null;
      if (saved) void follow(saved.jobId, saved.name);
    } catch {
      /* nothing saved */
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pull = (name: string, sizeGb?: number) => {
    if (pulling) return;
    if (!window.confirm(`Download ${name}${sizeGb ? ` (${sizeGb} GB)` : ''} from ollama.com?`)) return;
    const jobId = newJobId();
    try {
      localStorage.setItem(JOB_KEY, JSON.stringify({ jobId, name }));
    } catch {
      /* storage blocked */
    }
    setNotice(null);
    postJson('/api/models/pull', { name, jobId }).catch(() => {
      /* errors arrive through the job */
    });
    void follow(jobId, name);
  };

  const cancel = async () => {
    if (job.current) await postJson(`/api/jobs/${job.current}/cancel`, {}).catch(() => null);
  };

  const remove = async (name: string) => {
    if (!window.confirm(`Remove ${name} from this computer? You can download it again later.`)) return;
    try {
      await postJson('/api/models/remove', { name });
      setNotice(`${name} removed.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove it.');
    }
    void refresh();
  };

  const has = (name: string) => installed.some((m) => m.name === name || m.name === `${name}:latest`);
  const row = 'flex items-center gap-3 rounded-lg border border-zinc-900 bg-black/40 px-3 py-2';
  const small = 'inline-flex items-center gap-1 rounded-md border border-zinc-800 px-2 py-1 text-[11px] text-zinc-300 hover:border-zinc-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="AI models" className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-zinc-800 bg-panel p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-white">AI models</h2>
            <p className="mt-0.5 text-xs text-zinc-400">Local language models (Ollama) that plan videos and write scripts. Downloads come from ollama.com and stay on this computer.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-zinc-500 hover:text-white cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!ollama && (
          <p className="mt-4 flex items-start gap-2 rounded-lg border border-amber-900/50 bg-amber-950/30 p-3 text-xs text-amber-300">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Ollama isn't running. Start it (or install it from ollama.com), then reopen this window.
          </p>
        )}

        {pulling && (
          <div className="mt-4 rounded-lg border border-zinc-800 bg-surface p-3">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="min-w-0 truncate text-white">{progress?.label || `Starting ${pulling}…`}</span>
              <button type="button" onClick={() => void cancel()} className={`${small} hover:border-red-500 hover:text-red-400`}>
                <X className="h-3 w-3" /> Stop
              </button>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-900">
              <div className="h-full bg-accent transition-all" style={{ width: `${Math.max(2, progress?.pct ?? 0)}%` }} />
            </div>
          </div>
        )}
        {error && (
          <p className="mt-3 flex items-start gap-2 text-xs text-red-400">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
          </p>
        )}
        {notice && !pulling && <p className="mt-3 text-xs text-zinc-300">{notice}</p>}

        <h3 className="mt-5 mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Suggested</h3>
        <ul className="space-y-2">
          {suggested.map((m) => (
            <li key={m.name} className={row}>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-white">
                  {m.label} <span className="font-normal text-zinc-500">· {m.sizeGb} GB</span>
                </p>
                <p className="text-[11px] leading-snug text-zinc-500">{m.note}</p>
                <code className="text-[10.5px] text-zinc-600">{m.name}</code>
              </div>
              {has(m.name) ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-accent">
                  <Check className="h-3.5 w-3.5" /> Installed
                </span>
              ) : (
                <button type="button" disabled={Boolean(pulling) || !ollama} onClick={() => pull(m.name, m.sizeGb)} className={small}>
                  <Download className="h-3 w-3" /> Download
                </button>
              )}
            </li>
          ))}
        </ul>

        <h3 className="mt-5 mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Any model from ollama.com</h3>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (custom.trim()) pull(custom.trim());
          }}
        >
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="e.g. qwen2.5:7b"
            className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-surface px-3 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:border-accent focus:outline-none"
          />
          <button type="submit" disabled={!custom.trim() || Boolean(pulling) || !ollama} className={small}>
            <Download className="h-3 w-3" /> Download
          </button>
        </form>

        <h3 className="mt-5 mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">On this computer ({installed.length})</h3>
        <ul className="space-y-1.5">
          {installed.map((m) => (
            <li key={m.name} className={row}>
              {m.cloud ? <Cloud className="h-3.5 w-3.5 shrink-0 text-amber-400" /> : <HardDrive className="h-3.5 w-3.5 shrink-0 text-zinc-500" />}
              <span className="min-w-0 flex-1 truncate text-xs text-zinc-200">
                {m.name} <span className="text-zinc-500">{m.cloud ? '· online — prompts leave this computer' : `· ${m.sizeGb} GB`}</span>
              </span>
              <button type="button" onClick={() => void remove(m.name)} title={`Remove ${m.name}`} className="p-1 text-zinc-600 hover:text-red-400 cursor-pointer">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
