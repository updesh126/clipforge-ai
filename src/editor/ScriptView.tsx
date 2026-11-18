import { useEffect, useRef, useState } from 'react';
import { Wand2, Loader2, AlertCircle, Mic, Sparkles, Check, Loader, X, Clapperboard } from 'lucide-react';
import { StoryboardView, type Storyboard } from './StoryboardView.tsx';
import type { EngineStatus, JobProgress } from '../types.ts';
import type { EditProject } from './types.ts';
import { StylePicker } from './StylePicker.tsx';
import { VIDEO_TYPES, VIDEO_TYPE_IDS, type VideoType } from '../videotypes.ts';
import { newJobId, postJson } from '../utils/api.ts';

interface Props {
  engines: EngineStatus | null;
  onCreated: (editId: string) => void;
}

const SAMPLE = `Every monsoon, India's rivers carry the story of a continent.

The Ganga alone supports over 400 million people, more than the population of the United States.

But rivers are changing. Glaciers that feed them are shrinking faster than ever recorded.

"A river is not a resource. It is a relationship," says one Himalayan farmer.

The good news? Restored wetlands can cut flood damage by up to 40 percent.

The future of our rivers depends on what we do in the next ten years.`;

/** The structure from docs/STORY_SCRIPT_GUIDE.md: one paragraph = one scene; place + 1-3 visible things each. */
const STORY_TEMPLATE = `Every summer night, a tiny village in Kerala glows with fireflies.

The village sits beside a quiet river, under tall coconut trees. At dusk, the fishermen pull their boats onto the sand.

Meera is a girl with a lantern who loves the fireflies more than anything.

Each night she walks to the river bank and counts them, one by one.

One evening, the river bank is dark. Not a single firefly rises from the grass.

Meera asks the old fisherman why. He points at the new bright lamps on the bridge.

"Fireflies need the dark to find each other," he says.

So Meera and the villagers switch off the bridge lamps after sunset.

The next night, more than 1,000 fireflies return to the river bank.

Sometimes, to see the light, we just have to turn ours off.`;

/** Hindi sample in the same one-paragraph-per-scene structure. */
const HINDI_TEMPLATE = `हर गर्मी की रात, केरल का एक छोटा-सा गाँव जुगनुओं से जगमगा उठता है।

मीरा एक लालटेन वाली लड़की है, जिसे जुगनू सबसे ज़्यादा पसंद हैं।

एक शाम नदी का किनारा अँधेरा था। घास से एक भी जुगनू नहीं उड़ा।

मीरा ने बूढ़े मछुआरे से पूछा क्यों। उसने पुल पर लगी नई तेज़ बत्तियों की ओर इशारा किया।

अगली रात, एक हज़ार से ज़्यादा जुगनू लौट आए, और मीरा ख़ुशी से नाच उठी।`;

// Draft + running job survive a page reload or server restart
const DRAFT_KEY = 'clipforge.scriptDraft';
const JOB_KEY = 'clipforge.scriptJob';
const store = {
  get<T>(k: string): T | null {
    try {
      const v = localStorage.getItem(k);
      return v ? (JSON.parse(v) as T) : null;
    } catch {
      return null;
    }
  },
  set(k: string, v: unknown) {
    try {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, JSON.stringify(v));
    } catch {
      // storage blocked — the page still works, it just won't remember
    }
  },
};

interface Draft {
  script: string;
  title: string;
  aspect: string;
  style: string;
  voice: string;
  language?: 'en' | 'hi';
  captions: string;
  mode: 'story' | 'graphics';
  illustration?: 'vector' | 'ai';
  animate?: boolean;
  motionEngine?: 'ltx' | 'wan';
  motionMode?: 'mix' | 'all';
  videoType?: VideoType;
}

export function ScriptView({ engines, onCreated }: Props) {
  const draft = store.get<Draft>(DRAFT_KEY);
  const [script, setScript] = useState(draft?.script ?? '');
  const [title, setTitle] = useState(draft?.title ?? '');
  const [aspect, setAspect] = useState(draft?.aspect ?? '9:16');
  const [style, setStyle] = useState(draft?.style ?? 'auto');
  const [voice, setVoice] = useState(draft?.voice ?? 'af_heart');
  const [language, setLanguage] = useState<'en' | 'hi'>(draft?.language ?? 'en');
  // voices for the chosen language (Kokoro "h…" ids and Windows "os:" voices with a hi-* locale are Hindi)
  const isHindiVoice = (v: { id: string; language: string }) => /^h[fm]_/.test(v.id) || /^hi/i.test(v.language);
  const langVoices = (engines?.voices ?? []).filter((v) => (language === 'hi' ? isHindiVoice(v) : !isHindiVoice(v)));
  // keep the selected voice valid when the language changes
  useEffect(() => {
    if (langVoices.length && !langVoices.some((v) => v.id === voice)) setVoice(langVoices[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, engines?.voices.length]);
  const [captions, setCaptions] = useState(draft?.captions ?? 'karaoke');
  const [mode, setMode] = useState<'story' | 'graphics'>(draft?.mode ?? 'story');
  const [illustration, setIllustration] = useState<'vector' | 'ai'>(draft?.illustration ?? 'vector');
  const [animate, setAnimate] = useState<boolean>(draft?.animate ?? false);
  const [motionEngine, setMotionEngine] = useState<'ltx' | 'wan'>(draft?.motionEngine ?? 'ltx');
  const [motionMode, setMotionMode] = useState<'mix' | 'all'>(draft?.motionMode ?? 'mix');
  const [videoType, setVideoType] = useState<VideoType | null>(draft?.videoType ?? null);
  /** picking a type sets its recommended style, captions and look — all still changeable */
  const pickVideoType = (t: VideoType) => {
    const d = VIDEO_TYPES[t];
    setVideoType(t);
    setStyle(d.styles[0]);
    setCaptions(d.captions);
    setMode('story');
    setMotionMode('mix');
  };
  const engines2 = engines?.sdVideoEngines ?? [];
  // use what's installed: the chosen engine if present, otherwise the one that is
  const engineToUse: 'ltx' | 'wan' | undefined = engines2.includes(motionEngine) ? motionEngine : engines2[0];
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const polling = useRef(false);
  const currentJob = useRef<string | null>(null);
  const stopFollowing = useRef(false);
  const [cancelling, setCancelling] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  // bring the progress card into view once, when a run starts
  useEffect(() => {
    if (busy) window.setTimeout(() => progressRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
  }, [busy]);

  // [tags] direct the editor and are never spoken — leave them out of the word count and timing
  const TAG_RE = /\[[^[\]\n]{1,600}\]/g;
  const spoken = script.replace(TAG_RE, ' ').trim();
  const words = spoken ? spoken.split(/\s+/).length : 0;
  const tagCount = (script.match(TAG_RE) ?? []).length;
  const estSeconds = Math.round(words / 2.5);

  // save the draft as you type
  useEffect(() => {
    store.set(DRAFT_KEY, { script, title, aspect, style, voice, language, captions, mode, illustration, animate, motionEngine, motionMode, videoType: videoType ?? undefined });
  }, [script, title, aspect, style, voice, language, captions, mode, illustration, animate, motionEngine, motionMode, videoType]);

  /** Follow a job by id until it reports its finished edit (works after a reload too). */
  const follow = async (jobId: string) => {
    if (polling.current) return;
    polling.current = true;
    currentJob.current = jobId;
    stopFollowing.current = false;
    setBusy(true);
    setError(null);
    setNotice(null);
    let missing = 0;
    try {
      for (;;) {
        await new Promise((r) => setTimeout(r, 1000));
        if (stopFollowing.current) return; // cancelled from the page — stop waiting right away
        type Job = JobProgress & { result?: { editId?: string; error?: string } };
        const job: Job | null = await fetch(`/api/jobs/${jobId}`)
          .then((r) => r.json() as Promise<{ job: Job | null }>)
          .then((d) => d.job)
          .catch(() => null); // server restarting — keep waiting
        if (job?.result?.editId) {
          store.set(JOB_KEY, null);
          onCreated(job.result.editId);
          return;
        }
        if (job?.result?.error === 'Cancelled') {
          store.set(JOB_KEY, null);
          setNotice('Cancelled. Your script is still here — change anything and press Create video again.');
          return;
        }
        if (job?.result?.error) throw new Error(job.result.error);
        if (job) {
          missing = 0;
          setProgress(job);
        } else if (++missing > 20) {
          throw new Error('The server restarted and the run was interrupted. Your script is saved — press Create video again.');
        }
      }
    } catch (err) {
      store.set(JOB_KEY, null);
      setError(err instanceof Error ? err.message : 'Could not build the video.');
    } finally {
      polling.current = false;
      currentJob.current = null;
      setBusy(false);
      setCancelling(false);
      setProgress(null);
    }
  };

  /** Stop the run: the server stops at its next step and frees the GPU; the page stops waiting at once. */
  const cancel = async () => {
    const jobId = currentJob.current ?? store.get<{ jobId: string }>(JOB_KEY)?.jobId;
    setCancelling(true);
    store.set(JOB_KEY, null);
    if (jobId) await postJson(`/api/jobs/${jobId}/cancel`, {}).catch(() => null);
    stopFollowing.current = true; // even if the server no longer knows the job, the card must not stay stuck
    setNotice('Cancelled. Your script is still here — change anything and press Create video again.');
  };

  // a run was in progress when the page reloaded → reconnect to it
  useEffect(() => {
    const pending = store.get<{ jobId: string; at: number }>(JOB_KEY);
    if (pending && Date.now() - pending.at < 1000 * 60 * 60) void follow(pending.jobId);
    else store.set(JOB_KEY, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // storyboard preview: what every line will show and do, before any voice or painting
  const [board, setBoard] = useState<Storyboard | null>(null);
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const planScenes = async () => {
    if (!script.trim() || planning || busy) return;
    setPlanning(true);
    setPlanError(null);
    try {
      const d = await postJson<{ board: Storyboard }>('/api/script-video/plan', { script, title, aspect, style, voice, language, captions, mode, illustration: mode === 'story' ? illustration : 'vector', animate: mode === 'story' && illustration === 'ai' && animate, motionEngine: engineToUse, motionMode, videoType: videoType ?? undefined });
      setBoard(d.board);
      window.setTimeout(() => boardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : 'Could not plan the scenes.');
    } finally {
      setPlanning(false);
    }
  };

  const create = async () => {
    if (!script.trim() || busy) return;
    const jobId = newJobId();
    store.set(JOB_KEY, { jobId, at: Date.now() });
    // start the job; the result is picked up by polling, so a reload mid-run doesn't lose it
    postJson('/api/script-video', { script, title, aspect, style, voice, language, captions, mode, illustration: mode === 'story' ? illustration : 'vector', animate: mode === 'story' && illustration === 'ai' && animate, motionEngine: engineToUse, motionMode, videoType: videoType ?? undefined, jobId }).catch(() => {
      /* errors are reported through the job */
    });
    await follow(jobId);
  };

  const steps = [
    ['plan', 'Plan scenes', 'Ollama'],
    ['voice', 'Voice-over', engines?.tts ? 'Kokoro' : 'System voice'],
    ['voice2', 'Word timing', 'Whisper'],
    ['assets', mode === 'story' && illustration === 'ai' ? (animate ? 'Paint & animate' : 'Paint scenes') : 'Draw scenes', mode === 'story' && illustration === 'ai' ? 'Stable Diffusion' : 'Asset library'],
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
              {tagCount > 0 ? ` · ${tagCount} tag${tagCount > 1 ? 's' : ''}` : ''}
            </div>
          </div>
          <p className="mt-1.5 text-[11px] text-zinc-500">
            Direct any scene with <code className="rounded bg-zinc-900 px-1 text-zinc-300">[tags]</code> — e.g.{' '}
            <code className="rounded bg-zinc-900 px-1 text-zinc-300">[bigStat]</code>{' '}
            <code className="rounded bg-zinc-900 px-1 text-zinc-300">[rainFx]</code>{' '}
            <code className="rounded bg-zinc-900 px-1 text-zinc-300">[pushIn]</code>{' '}
            <code className="rounded bg-zinc-900 px-1 text-zinc-300">[transition: irisWipe]</code>. They are never spoken.{' '}
            <a href="#/docs/script-tags" className="text-accent hover:underline">All tags</a>
          </p>
          {!script && (
            <button type="button" onClick={() => setScript(STORY_TEMPLATE)} className="mt-2 mr-4 text-xs text-accent hover:underline cursor-pointer" title="One paragraph per scene: a place + 1-3 things we can see. Full guide: docs/STORY_SCRIPT_GUIDE.md">
              Use the story template
            </button>
          )}
          {!script && (
            <button type="button" onClick={() => setScript(SAMPLE)} className="mt-2 text-xs text-accent hover:underline cursor-pointer">
              Use a sample script
            </button>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void planScenes()}
              disabled={!script.trim() || planning || busy}
              title="See what every line will show and do — picture, place, camera, graphics, Motion — before making the video"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:border-accent hover:text-white cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
            >
              {planning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clapperboard className="h-3.5 w-3.5" />}
              {planning ? 'Planning every scene…' : board ? 'Plan scenes again' : 'Plan scenes (preview)'}
            </button>
            <span className="text-[11px] text-zinc-500">Each line as a task: what we see, where, on screen, camera — in about 20 seconds, nothing painted.</span>
          </div>
          {planError && <p className="mt-2 text-xs text-red-400">{planError}</p>}

          {error && (
            <p className="mt-4 flex items-center gap-2 rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 text-xs text-red-200">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </p>
          )}

          {notice && !busy && (
            <p className="mt-4 flex items-center gap-2 rounded-lg border border-zinc-800 bg-surface px-3 py-2 text-xs text-zinc-300">
              <X className="h-4 w-4 shrink-0 text-zinc-500" /> {notice}
            </p>
          )}

          {busy && (
            <div ref={progressRef} className="mt-5 rounded-xl border border-zinc-800 bg-surface p-4" role="status" aria-live="polite">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-white">{cancelling ? 'Cancelling…' : progress?.label || 'Starting…'}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="font-mono text-xs text-zinc-400">{progress?.pct ?? 0}%</span>
                  <button
                    type="button"
                    onClick={() => void cancel()}
                    disabled={cancelling}
                    className="inline-flex items-center gap-1 rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:border-red-400 hover:text-red-300 disabled:opacity-60 cursor-pointer"
                    title="Stop making this video"
                  >
                    {cancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                    {cancelling ? 'Cancelling' : 'Cancel'}
                  </button>
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-900">
                <div className="h-full bg-brand-gradient animate-shimmer transition-[width] duration-700" style={{ width: `${Math.max(3, progress?.pct ?? 3)}%` }} />
              </div>
              {progress?.media?.sceneTotal ? <PaintProgress media={progress.media} stage={progress.stage} aspect={progress.media.aspect ?? aspect} painting={progress.media.scenes !== undefined || (mode === 'story' && illustration === 'ai')} /> : null}
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

          {board && (
            <section ref={boardRef} className="mt-8">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Scene plan</h2>
                <button type="button" onClick={() => setBoard(null)} className="text-[11px] text-zinc-500 hover:text-white cursor-pointer">
                  Hide
                </button>
              </div>
              <p className="mb-3 text-[11px] text-zinc-500">
                Change any picture, place or time, then <span className="text-zinc-300">Use this plan</span> — it is written into your script as [tags], so Create video follows it exactly.
              </p>
              <StoryboardView
                board={board}
                onLock={(locked) => {
                  setScript(locked);
                  setBoard(null);
                  setNotice('Plan written into the script as [tags]. Press Create video — every scene will follow it.');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            </section>
          )}
        </div>

        <aside className="space-y-5">
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Video type</h2>
            <div className="grid grid-cols-2 gap-2">
              {VIDEO_TYPE_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => pickVideoType(id)}
                  className={`rounded-lg border p-2.5 text-left cursor-pointer ${videoType === id ? 'border-accent bg-accent/5' : 'border-zinc-800 hover:border-zinc-600'}`}
                >
                  <span className="block text-xs font-semibold text-white">{VIDEO_TYPES[id].label}</span>
                  <span className="mt-0.5 block text-[10.5px] leading-snug text-zinc-500">{VIDEO_TYPES[id].blurb}</span>
                </button>
              ))}
            </div>
            {videoType && (
              <p className="mt-1.5 text-[10.5px] leading-snug text-zinc-500">
                Set for {VIDEO_TYPES[videoType].label}: <span className="text-zinc-300">{VIDEO_TYPES[videoType].styles[0]}</span> style, {VIDEO_TYPES[videoType].captions} captions
                {VIDEO_TYPES[videoType].sequences.length > 1 ? ', with explainer graphics where the script has facts' : ''}. Change anything below.
              </p>
            )}
          </section>
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
          {mode === 'story' && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Illustration</h2>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ['vector', 'Vector', 'Drawn by ClipForge — fast, animated characters'],
                  ['ai', 'AI painting', 'Painted by local Stable Diffusion — richer art'],
                ] as const).map(([id, label, hint]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setIllustration(id)}
                    className={`rounded-lg border p-2.5 text-left cursor-pointer ${illustration === id ? 'border-accent bg-accent/5' : 'border-zinc-800 hover:border-zinc-600'}`}
                  >
                    <span className="block text-xs font-semibold text-white">{label}</span>
                    <span className="mt-0.5 block text-[10.5px] leading-snug text-zinc-500">{hint}</span>
                  </button>
                ))}
              </div>
              {illustration === 'ai' && (
                <p className={`mt-1.5 text-[10.5px] ${engines?.sd || engines?.sdInstalled ? 'text-accent' : 'text-amber-400'}`}>
                  {engines?.sd
                    ? `Stable Diffusion ready · ${engines.sdModel}`
                    : engines?.sdRunning
                      ? 'ComfyUI is running but has no model — see Docs → Stable Diffusion.'
                      : engines?.sdInstalled
                        ? 'Stable Diffusion is installed — it starts automatically when you create the video.'
                        : 'Stable Diffusion is not installed — run npm run comfy:setup (see Docs → Stable Diffusion setup).'}
                </p>
              )}
              {illustration === 'ai' && (
                <label className={`mt-2 flex items-start gap-2 rounded-lg border p-2.5 cursor-pointer ${animate ? 'border-accent bg-accent/5' : 'border-zinc-800 hover:border-zinc-600'}`}>
                  <input type="checkbox" checked={animate} onChange={(e) => setAnimate(e.target.checked)} className="mt-0.5 accent-[var(--color-accent)]" />
                  <span>
                    <span className="block text-xs font-semibold text-white">Motion — bring paintings to life</span>
                    <span className="mt-0.5 block text-[10.5px] leading-snug text-zinc-500">
                      {engines2.length
                        ? 'Each painting becomes a short moving clip, keeping its style and characters.'
                        : 'Needs a Motion model — run npm run comfy:setup. Paintings stay still until then.'}
                    </span>
                  </span>
                </label>
              )}
              {illustration === 'ai' && animate && engines2.length > 0 && (
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {([
                    ['mix', 'Mix', 'Key scenes move, the rest stay paintings · about half the time'],
                    ['all', 'All scenes', 'Every scene moves · slowest'],
                  ] as const).map(([id, label, hint]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setMotionMode(id)}
                      className={`rounded-lg border p-2 text-left cursor-pointer ${motionMode === id ? 'border-accent bg-accent/5' : 'border-zinc-800 hover:border-zinc-600'}`}
                    >
                      <span className="block text-xs font-semibold text-white">{label}</span>
                      <span className="mt-0.5 block text-[10.5px] leading-snug text-zinc-500">{hint}</span>
                    </button>
                  ))}
                </div>
              )}
              {illustration === 'ai' && animate && engines2.length > 0 && (
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {([
                    ['ltx', 'Fast', 'LTX-Video · ~1 min per scene'],
                    ['wan', 'Best', 'Wan 2.2 · smoother, several min per scene'],
                  ] as const).map(([id, label, hint]) => {
                    const installed = engines2.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        disabled={!installed}
                        onClick={() => setMotionEngine(id)}
                        title={installed ? hint : 'Not installed — npm run comfy:setup and choose it'}
                        className={`rounded-lg border p-2 text-left ${!installed ? 'cursor-not-allowed border-zinc-900 opacity-50' : engineToUse === id ? 'cursor-pointer border-accent bg-accent/5' : 'cursor-pointer border-zinc-800 hover:border-zinc-600'}`}
                      >
                        <span className="block text-xs font-semibold text-white">{label}</span>
                        <span className="mt-0.5 block text-[10.5px] leading-snug text-zinc-500">{installed ? hint : 'Not installed'}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          )}
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Art style</h2>
            <StylePicker value={style} onChange={setStyle} />
            <p className="mt-1.5 text-[10.5px] text-zinc-600">
              Hover a style to see a preview and what it suits.
              {videoType ? ` Good for ${VIDEO_TYPES[videoType].label}: ${VIDEO_TYPES[videoType].styles.join(', ')}.` : ''}
            </p>
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
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-zinc-800 bg-surface p-1" role="radiogroup" aria-label="Voice-over language">
              {([['en', 'English'], ['hi', 'हिन्दी Hindi']] as const).map(([id, label]) => (
                <button key={id} type="button" role="radio" aria-checked={language === id} onClick={() => setLanguage(id)} className={`rounded-md py-1.5 text-xs cursor-pointer ${language === id ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}>
                  {label}
                </button>
              ))}
            </div>
            {language === 'hi' && !script.trim() && (
              <button type="button" onClick={() => setScript(HINDI_TEMPLATE)} className="text-xs text-accent hover:underline cursor-pointer">
                Use a Hindi sample script
              </button>
            )}
            {language === 'hi' && !langVoices.length ? (
              <p className="rounded-lg border border-zinc-800 bg-surface px-3 py-2 text-[11px] leading-relaxed text-zinc-400">
                No Hindi voice yet. Natural Hindi AI voices: <code className="font-mono text-zinc-300">pip install kokoro-onnx soundfile</code> — or add the free Windows voice: Settings → Time &amp; language → Speech → Add voices → Hindi (India). Then reload this page.
              </p>
            ) : langVoices.length ? (
              <select value={voice} onChange={(e) => setVoice(e.target.value)} className="w-full rounded-lg border border-zinc-800 bg-surface px-2 py-2 text-xs text-zinc-200 focus:outline-none focus:border-accent">
                {langVoices.map((v) => (
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

/** Visual progress while a video is made: counters, the painting as it sharpens, and a filmstrip of scenes. */
function PaintProgress({ media, stage, aspect, painting }: { media: NonNullable<JobProgress['media']>; stage: string; aspect: string; painting: boolean }) {
  const total = media.sceneTotal ?? 0;
  const done = media.scenes ?? [];
  const current = media.sceneIndex ?? 0;
  const [w, h] = aspect.split(':').map(Number);
  const ratio = `${w || 9} / ${h || 16}`;
  const portrait = (h || 16) > (w || 9);
  const paintingNow = painting && stage === 'assets';
  const stat = (label: string, value: string) => (
    <div className="rounded-lg border border-zinc-900 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="font-mono text-sm text-white">{value}</p>
    </div>
  );
  return (
    <div className="mt-4 space-y-3">
      <div className={`grid gap-2 ${painting ? (media.motionScenes?.some(Boolean) ? 'grid-cols-4' : 'grid-cols-3') : 'grid-cols-2'}`}>
        {stat('Scene', `${current} of ${total}`)}
        {painting ? stat('Painted', `${done.length} of ${total}`) : stat('Scenes left', String(Math.max(0, total - current)))}
        {painting && media.motionScenes?.some(Boolean) ? stat('Moving', `${media.motionScenes.filter(Boolean).length} of ${total}`) : null}
        {painting && stat('Brush steps', paintingNow && media.steps ? `${media.step ?? 0} / ${media.steps}` : '—')}
      </div>

      {painting && (
        <div className={`relative mx-auto overflow-hidden rounded-lg border border-zinc-800 bg-black ${portrait ? 'w-1/2 sm:w-2/5' : 'w-full'}`} style={{ aspectRatio: ratio }}>
          {media.preview ? (
            <img src={media.preview} alt={`Scene ${current} being painted`} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center bg-zinc-950 text-xs text-zinc-500 animate-pulse">{stage === 'assets' ? 'Preparing the canvas…' : 'Waiting for the first scene…'}</div>
          )}
          <span className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-0.5 text-[11px] text-white">
            {paintingNow ? `Painting scene ${current}` : media.preview ? `Scene ${Math.max(1, done.length)}` : 'Stable Diffusion'}
          </span>
          {paintingNow && media.steps ? (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-black/50">
              <div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${Math.round(((media.step ?? 0) / media.steps) * 100)}%` }} />
            </div>
          ) : null}
        </div>
      )}

      {painting && total > 0 && (
        <ol className="flex gap-1.5 overflow-x-auto pb-1" aria-label="Scenes">
          {Array.from({ length: total }, (_, i) => {
            const src = done[i];
            const active = !src && i + 1 === current;
            return (
              <li key={i} className={`relative shrink-0 overflow-hidden rounded-md border ${src ? 'border-zinc-700' : active ? 'border-accent' : 'border-dashed border-zinc-800'} ${portrait ? 'w-12' : 'w-20'}`} style={{ aspectRatio: ratio }} title={`Scene ${i + 1}${src ? ' · done' : active ? ' · painting' : ' · waiting'}`}>
                {src ? <img src={src} alt={`Scene ${i + 1}`} className="h-full w-full object-cover" /> : active && media.preview ? <img src={media.preview} alt="" className="h-full w-full object-cover opacity-70" /> : null}
                <span className={`absolute bottom-0.5 left-1 font-mono text-[10px] ${src || active ? 'text-white drop-shadow' : 'text-zinc-600'}`}>{i + 1}</span>
                {src && <Check className="absolute right-0.5 top-0.5 h-3 w-3 text-accent drop-shadow" />}
                {media.motionScenes?.[i] && <span className="absolute left-0.5 top-0.5 rounded bg-black/70 px-1 text-[8px] leading-tight text-accent" title="This scene moves">▶</span>}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
