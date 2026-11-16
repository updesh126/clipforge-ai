import { useEffect, useRef, useState } from 'react';
import { Wand2, Loader2, AlertCircle, Mic, Sparkles, Check, Loader } from 'lucide-react';
import type { EngineStatus, JobProgress } from '../types.ts';
import type { EditProject } from './types.ts';
import { StylePicker } from './StylePicker.tsx';
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
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<JobProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const polling = useRef(false);

  const words = script.trim() ? script.trim().split(/\s+/).length : 0;
  const estSeconds = Math.round(words / 2.5);

  // save the draft as you type
  useEffect(() => {
    store.set(DRAFT_KEY, { script, title, aspect, style, voice, language, captions, mode });
  }, [script, title, aspect, style, voice, language, captions, mode]);

  /** Follow a job by id until it reports its finished edit (works after a reload too). */
  const follow = async (jobId: string) => {
    if (polling.current) return;
    polling.current = true;
    setBusy(true);
    setError(null);
    let missing = 0;
    try {
      for (;;) {
        await new Promise((r) => setTimeout(r, 1000));
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
      setBusy(false);
      setProgress(null);
    }
  };

  // a run was in progress when the page reloaded → reconnect to it
  useEffect(() => {
    const pending = store.get<{ jobId: string; at: number }>(JOB_KEY);
    if (pending && Date.now() - pending.at < 1000 * 60 * 60) void follow(pending.jobId);
    else store.set(JOB_KEY, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = async () => {
    if (!script.trim() || busy) return;
    const jobId = newJobId();
    store.set(JOB_KEY, { jobId, at: Date.now() });
    // start the job; the result is picked up by polling, so a reload mid-run doesn't lose it
    postJson('/api/script-video', { script, title, aspect, style, voice, language, captions, mode, jobId }).catch(() => {
      /* errors are reported through the job */
    });
    await follow(jobId);
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
            <button type="button" onClick={() => setScript(STORY_TEMPLATE)} className="mt-2 mr-4 text-xs text-accent hover:underline cursor-pointer" title="One paragraph per scene: a place + 1-3 things we can see. Full guide: docs/STORY_SCRIPT_GUIDE.md">
              Use the story template
            </button>
          )}
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
            <StylePicker value={style} onChange={setStyle} />
            <p className="mt-1.5 text-[10.5px] text-zinc-600">Hover a style to see a preview and what it suits.</p>
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
