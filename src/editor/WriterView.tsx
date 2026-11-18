import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, Copy, Download, FileText, Loader2, PenLine, Save, Wand2, X, Youtube } from 'lucide-react';
import type { JobProgress } from '../types.ts';
import { VIDEO_TYPES, VIDEO_TYPE_IDS, type VideoType } from '../videotypes.ts';
import { newJobId, postJson } from '../utils/api.ts';

/** A script written from a YouTube video (server/scriptWriter.ts). */
interface WrittenScript {
  id: string;
  createdAt: string;
  model: string;
  videoType: VideoType;
  source: { url: string; title: string; channel: string; seconds: number; words: number; from: 'subtitles' | 'whisper' };
  title: string;
  hook: string;
  description: string;
  tags: string[];
  script: string;
  facts: string[];
  files: { md: string; txt: string };
}
interface ModelInfo {
  name: string;
  cloud: boolean;
  sizeGb: number;
}

const JOB_KEY = 'clipforge.writerJob';
const OPTS_KEY = 'clipforge.writerOptions';
const SCRIPT_DRAFT_KEY = 'clipforge.scriptDraft';
const TAG_RE = /\[[^[\]\n]{1,600}\]/g;

const load = <T,>(k: string): T | null => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
};
const save = (k: string, v: unknown) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(v));
  } catch {
    // storage blocked — the page still works
  }
};

const LANGS: Array<{ id: 'same' | 'en' | 'hi'; label: string }> = [
  { id: 'same', label: 'Same as video' },
  { id: 'en', label: 'English' },
  { id: 'hi', label: 'Hindi' },
];

/** YouTube link → a new, more hooked script with [tags], plus title, description and tags — saved as .md and .txt. */
export function WriterView({ onOpenScript }: { onOpenScript: () => void }) {
  const opts = load<{ videoType: VideoType; minutes: number; language: 'same' | 'en' | 'hi'; model: string }>(OPTS_KEY);
  const [url, setUrl] = useState('');
  const [videoType, setVideoType] = useState<VideoType>(opts?.videoType ?? 'documentary');
  const [minutes, setMinutes] = useState<number>(opts?.minutes ?? 0);
  const [language, setLanguage] = useState<'same' | 'en' | 'hi'>(opts?.language ?? 'same');
  const [model, setModel] = useState<string>(opts?.model ?? '');
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [defaultModel, setDefaultModel] = useState('');
  const [history, setHistory] = useState<WrittenScript[]>([]);
  const [current, setCurrent] = useState<WrittenScript | null>(null);
  const [edit, setEdit] = useState<{ title: string; description: string; tags: string; script: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const following = useRef<string | null>(null);
  const stop = useRef(false);

  useEffect(() => save(OPTS_KEY, { videoType, minutes, language, model }), [videoType, minutes, language, model]);

  const refresh = async (selectId?: string) => {
    const d = await fetch('/api/writer').then((r) => r.json() as Promise<{ scripts: WrittenScript[] }>).catch(() => ({ scripts: [] }));
    setHistory(d.scripts);
    const pick = selectId ? d.scripts.find((s) => s.id === selectId) : null;
    if (pick) open(pick);
    return d.scripts;
  };

  const open = (s: WrittenScript) => {
    setCurrent(s);
    setEdit({ title: s.title, description: s.description, tags: s.tags.join(', '), script: s.script });
  };

  useEffect(() => {
    void refresh();
    fetch('/api/writer/models')
      .then((r) => r.json() as Promise<{ models: ModelInfo[]; default: string }>)
      .then((d) => {
        setModels(d.models);
        setDefaultModel(d.default);
      })
      .catch(() => null);
    const pending = load<{ jobId: string; at: number }>(JOB_KEY);
    if (pending && Date.now() - pending.at < 1000 * 60 * 60) void follow(pending.jobId);
    else save(JOB_KEY, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Follow the job until it reports the saved script (survives a page reload). */
  const follow = async (jobId: string) => {
    if (following.current) return;
    following.current = jobId;
    stop.current = false;
    setBusy(true);
    setError(null);
    setNotice(null);
    let missing = 0;
    try {
      for (;;) {
        await new Promise((r) => setTimeout(r, 1000));
        if (stop.current) return;
        type Job = JobProgress & { result?: { scriptId?: string; error?: string } };
        const job: Job | null = await fetch(`/api/jobs/${jobId}`)
          .then((r) => r.json() as Promise<{ job: Job | null }>)
          .then((d) => d.job)
          .catch(() => null);
        if (job?.result?.scriptId) {
          save(JOB_KEY, null);
          await refresh(job.result.scriptId);
          return;
        }
        if (job?.result?.error === 'Cancelled') {
          save(JOB_KEY, null);
          setNotice('Cancelled.');
          return;
        }
        if (job?.result?.error) throw new Error(job.result.error);
        if (job) {
          missing = 0;
          setProgress(job);
        } else if (++missing > 20) {
          throw new Error('The server restarted and the run was interrupted — press Write script again.');
        }
      }
    } catch (err) {
      save(JOB_KEY, null);
      setError(err instanceof Error ? err.message : 'Could not write the script.');
    } finally {
      following.current = null;
      setBusy(false);
      setCancelling(false);
      setProgress(null);
    }
  };

  const write = () => {
    const link = url.trim();
    if (!/^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(link)) {
      setError('Paste a YouTube link (youtube.com or youtu.be).');
      return;
    }
    if (busy) return;
    const jobId = newJobId();
    save(JOB_KEY, { jobId, at: Date.now() });
    postJson('/api/writer', { url: link, videoType, minutes: minutes || undefined, language, model: model || undefined, jobId }).catch(() => {
      /* errors arrive through the job */
    });
    void follow(jobId);
  };

  const cancel = async () => {
    const jobId = following.current ?? load<{ jobId: string }>(JOB_KEY)?.jobId;
    setCancelling(true);
    save(JOB_KEY, null);
    if (jobId) await postJson(`/api/jobs/${jobId}/cancel`, {}).catch(() => null);
    stop.current = true;
    setNotice('Cancelled.');
  };

  const dirty = Boolean(current && edit && (edit.title !== current.title || edit.description !== current.description || edit.tags !== current.tags.join(', ') || edit.script !== current.script));

  const saveEdits = async () => {
    if (!current || !edit) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/writer/${encodeURIComponent(current.id)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: edit.title, description: edit.description, tags: edit.tags.split(','), script: edit.script }),
      });
      const d = (await r.json()) as { script?: WrittenScript; error?: string };
      if (!d.script) throw new Error(d.error || 'Could not save.');
      await refresh(d.script.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied((k) => (k === key ? null : k)), 1500);
    } catch {
      setError('Copy is blocked in this browser — select the text and copy it by hand.');
    }
  };

  /** Hand the script to Script → video (it reads its draft from storage when it opens). */
  const toVideo = () => {
    if (!edit || !current) return;
    const prev = load<Record<string, unknown>>(SCRIPT_DRAFT_KEY) ?? {};
    const vt = VIDEO_TYPES[current.videoType];
    save(SCRIPT_DRAFT_KEY, { ...prev, script: edit.script, title: edit.title, videoType: current.videoType, mode: 'story', style: vt.styles[0], captions: vt.captions });
    onOpenScript();
  };

  const spokenWords = edit ? edit.script.replace(TAG_RE, ' ').trim().split(/\s+/).filter(Boolean).length : 0;
  const tagCount = edit ? (edit.script.match(TAG_RE) ?? []).length : 0;
  const chosen = model || defaultModel;
  const chosenIsCloud = models.find((m) => m.name === chosen)?.cloud;

  const field = 'w-full rounded-lg border border-zinc-800 bg-surface px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-accent';
  const copyBtn = (key: string, text: string) => (
    <button
      type="button"
      onClick={() => void copy(key, text)}
      className="inline-flex items-center gap-1 rounded-md border border-zinc-800 px-2 py-1 text-[11px] text-zinc-300 hover:border-zinc-600 cursor-pointer"
    >
      {copied === key ? <Check className="h-3 w-3 text-accent" /> : <Copy className="h-3 w-3" />}
      {copied === key ? 'Copied' : 'Copy'}
    </button>
  );

  return (
    <div className="flex-1 overflow-y-auto bg-black">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 sm:px-6 py-8 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-white">Script Writer</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Paste a YouTube link. ClipForge reads the whole video, keeps every fact, and writes a new, more hooked script with effect [tags] — plus a YouTube title, description and tags. Everything is saved as .md and .txt.
          </p>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Youtube className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && write()}
                placeholder="https://www.youtube.com/watch?v=…"
                className={`${field} pl-9`}
                disabled={busy}
              />
            </div>
            <button
              type="button"
              onClick={write}
              disabled={busy || !url.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              Write script
            </button>
          </div>

          {busy && (
            <div className="mt-4 rounded-lg border border-zinc-800 bg-surface p-3">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="min-w-0 truncate text-white">{cancelling ? 'Cancelling…' : progress?.label || 'Starting…'}</span>
                <button
                  type="button"
                  onClick={() => void cancel()}
                  disabled={cancelling}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 hover:border-red-500 hover:text-red-400 cursor-pointer"
                >
                  {cancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                  {cancelling ? 'Cancelling' : 'Cancel'}
                </button>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-900">
                <div className="h-full bg-accent transition-all" style={{ width: `${Math.max(3, progress?.pct ?? 0)}%` }} />
              </div>
            </div>
          )}
          {error && (
            <p className="mt-3 flex items-start gap-2 text-xs text-red-400">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {error}
            </p>
          )}
          {notice && !busy && <p className="mt-3 text-xs text-zinc-400">{notice}</p>}

          {current && edit && (
            <div className="mt-8 space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={toVideo}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-black cursor-pointer"
                >
                  <Wand2 className="h-3.5 w-3.5" /> Make this video
                </button>
                <a href={`/api/writer/file/${encodeURIComponent(current.files.md)}`} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:border-zinc-600">
                  <Download className="h-3.5 w-3.5" /> .md
                </a>
                <a href={`/api/writer/file/${encodeURIComponent(current.files.txt)}`} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:border-zinc-600">
                  <Download className="h-3.5 w-3.5" /> .txt
                </a>
                {dirty && (
                  <button
                    type="button"
                    onClick={() => void saveEdits()}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-accent px-3 py-1.5 text-xs text-accent cursor-pointer"
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save edits
                  </button>
                )}
              </div>
              <p className="text-[11px] text-zinc-500">
                From{' '}
                <a href={current.source.url} target="_blank" rel="noreferrer" className="text-zinc-300 underline decoration-zinc-700 hover:text-white">
                  {current.source.title}
                </a>{' '}
                — {current.source.channel} · {current.source.words} words from {current.source.from} · {current.facts.length} facts kept · {VIDEO_TYPES[current.videoType].label} · {current.model}
              </p>

              <section>
                <div className="mb-1.5 flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">YouTube title</h2>
                  {copyBtn('title', edit.title)}
                </div>
                <input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} className={field} />
                <p className={`mt-1 text-[10.5px] ${edit.title.length > 70 ? 'text-amber-400' : 'text-zinc-600'}`}>{edit.title.length} / 70 characters</p>
              </section>

              <section>
                <div className="mb-1.5 flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Description</h2>
                  {copyBtn('description', edit.description)}
                </div>
                <textarea value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} rows={8} className={`${field} resize-y leading-relaxed`} />
              </section>

              <section>
                <div className="mb-1.5 flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Tags</h2>
                  {copyBtn('tags', edit.tags)}
                </div>
                <textarea value={edit.tags} onChange={(e) => setEdit({ ...edit, tags: e.target.value })} rows={3} className={`${field} resize-y`} />
                <p className={`mt-1 text-[10.5px] ${edit.tags.length > 500 ? 'text-amber-400' : 'text-zinc-600'}`}>{edit.tags.length} / 500 characters (YouTube's limit) · comma-separated</p>
              </section>

              <section>
                <div className="mb-1.5 flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Script</h2>
                  {copyBtn('script', edit.script)}
                </div>
                <textarea value={edit.script} onChange={(e) => setEdit({ ...edit, script: e.target.value })} rows={16} className={`${field} resize-y font-mono text-[13px] leading-relaxed`} />
                <p className="mt-1 text-[10.5px] text-zinc-600">
                  {spokenWords} spoken words (~{Math.round(spokenWords / 2.5)} s) · {tagCount} tag{tagCount === 1 ? '' : 's'} ·{' '}
                  <a href="#/docs/script-tags" className="text-zinc-400 underline decoration-zinc-700 hover:text-white">
                    all tags
                  </a>
                </p>
              </section>

              <details className="rounded-lg border border-zinc-900 p-3">
                <summary className="cursor-pointer text-xs text-zinc-400">Facts kept from the source ({current.facts.length})</summary>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-zinc-400">
                  {current.facts.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </details>
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Video type</h2>
            <div className="grid grid-cols-2 gap-2">
              {VIDEO_TYPE_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setVideoType(id)}
                  className={`rounded-lg border p-2.5 text-left cursor-pointer ${videoType === id ? 'border-accent bg-accent/5' : 'border-zinc-800 hover:border-zinc-600'}`}
                >
                  <span className="block text-xs font-semibold text-white">{VIDEO_TYPES[id].label}</span>
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Length</h2>
            <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className={field}>
              <option value={0}>Like the source (1–5 min)</option>
              <option value={0.5}>30 seconds (Short)</option>
              <option value={1}>1 minute</option>
              <option value={2}>2 minutes</option>
              <option value={3}>3 minutes</option>
              <option value={5}>5 minutes</option>
            </select>
          </section>

          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Language</h2>
            <div className="grid grid-cols-3 gap-2">
              {LANGS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setLanguage(l.id)}
                  className={`rounded-lg border px-2 py-1.5 text-xs cursor-pointer ${language === l.id ? 'border-accent bg-accent/5 text-white' : 'border-zinc-800 text-zinc-400 hover:border-zinc-600'}`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">AI model</h2>
            <select value={model} onChange={(e) => setModel(e.target.value)} className={field}>
              <option value="">Default ({defaultModel || 'from .env'})</option>
              {models.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name}
                  {m.cloud ? ' — online' : m.sizeGb ? ` — ${m.sizeGb} GB` : ''}
                </option>
              ))}
            </select>
            <p className={`mt-1.5 text-[10.5px] leading-snug ${chosenIsCloud ? 'text-amber-400' : 'text-zinc-500'}`}>
              {chosenIsCloud ? 'Online model: the transcript is sent to the internet.' : 'Runs on this computer with Ollama. Bigger models write better scripts.'}
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Saved scripts</h2>
            {history.length === 0 ? (
              <p className="text-xs text-zinc-600">Nothing yet. Scripts are saved in data/scripts.</p>
            ) : (
              <ul className="space-y-1">
                {history.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => open(s)}
                      className={`flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left cursor-pointer ${current?.id === s.id ? 'bg-zinc-900' : 'hover:bg-zinc-950'}`}
                    >
                      {current?.id === s.id ? <PenLine className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" /> : <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-600" />}
                      <span className="min-w-0">
                        <span className="block truncate text-xs text-white">{s.title}</span>
                        <span className="block truncate text-[10.5px] text-zinc-600">
                          {s.createdAt.slice(0, 10)} · {s.source.channel}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
