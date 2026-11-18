import { useEffect, useState } from 'react';
import { AlertCircle, Check, ChevronDown, Copy, Download, ExternalLink, Loader2, Sparkles, Wand2 } from 'lucide-react';
import { postJson } from '../utils/api.ts';

interface Check {
  scenes: number;
  words: number;
  seconds: number;
  tags: number;
  unknown: string[];
  problems: string[];
  withPicture: number;
}

/**
 * Write the script with another AI (ChatGPT, Claude, Gemini…): copy a ready-made prompt that teaches it
 * ClipForge's format and tags, paste its script back, check it, and send it to Script → video.
 */
export function ExternalAiPanel({ videoType, minutes, language, onMakeVideo }: { videoType: string; minutes: number; language: string; onMakeVideo: (script: string) => void }) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [copied, setCopied] = useState(false);
  const [pasted, setPasted] = useState('');
  const [check, setCheck] = useState<Check | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // the prompt follows the Writer's video type, length and language
  useEffect(() => {
    if (!open) return;
    const q = new URLSearchParams({ videoType, minutes: String(minutes || 1.5), language });
    fetch(`/api/writer/external-prompt?${q}`)
      .then((r) => r.json() as Promise<{ prompt: string }>)
      .then((d) => setPrompt(d.prompt))
      .catch(() => setError('Could not load the prompt — is npm run dev running?'));
  }, [open, videoType, minutes, language]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('Copy is blocked in this browser — select the prompt and copy it by hand.');
    }
  };
  const download = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([prompt], { type: 'text/markdown' }));
    a.download = `clipforge-script-prompt-${videoType}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const runCheck = async () => {
    if (!pasted.trim()) return;
    setChecking(true);
    setError(null);
    try {
      setCheck(await postJson<Check>('/api/script/check', { script: pasted }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check the script.');
    } finally {
      setChecking(false);
    }
  };
  // a pasted script often arrives in a code block or with "Scene 1:" labels — clean the common cases
  const tidy = () => {
    const t = pasted
      // [ \t] (not \s) so blank lines between paragraphs — the scene breaks — are never eaten
      .replace(/^[ \t]*```[a-z]*[ \t]*$/gim, '')
      .replace(/^[ \t]*#{1,6}[ \t].*$/gm, '')
      .replace(/^[ \t]*\**[ \t]*scene[ \t]*\d+[ \t]*[:.-][ \t]*\**[ \t]*/gim, '')
      .replace(/\*\*/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    setPasted(t);
    setCheck(null);
  };

  const btn = 'inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-200 hover:border-zinc-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className="mt-4 rounded-xl border border-zinc-900 bg-surface/50">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer">
        <span>
          <span className="flex items-center gap-1.5 text-sm font-medium text-white">
            <ExternalLink className="h-4 w-4 text-accent" /> Write with another AI
          </span>
          <span className="mt-0.5 block text-[11px] text-zinc-500">ChatGPT, Claude, Gemini… — copy a prompt that teaches it ClipForge's tags and scenes, then paste its script back here.</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="space-y-4 border-t border-zinc-900 px-4 py-4">
          <section>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">1 · Copy this prompt</h3>
            <p className="mb-2 text-[11px] text-zinc-500">Made for the video type, length and language picked on the right. Paste it into the other AI and replace the last line with your topic, notes or a transcript.</p>
            <textarea readOnly value={prompt || 'Loading…'} rows={9} className="w-full resize-y rounded-lg border border-zinc-800 bg-black/40 px-3 py-2 font-mono text-[11px] leading-relaxed text-zinc-300 focus:outline-none" />
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => void copy()} disabled={!prompt} className={btn}>
                {copied ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />} {copied ? 'Copied' : 'Copy prompt'}
              </button>
              <button type="button" onClick={download} disabled={!prompt} className={btn}>
                <Download className="h-3.5 w-3.5" /> Download .md
              </button>
              <a href="#/docs/script-guide" className={btn}>
                How to write a script
              </a>
              <a href="#/docs/script-tags" className={btn}>
                All tags
              </a>
            </div>
            <p className="mt-2 text-[10.5px] text-amber-400/80">Online AIs send your topic and notes to their servers — don't paste anything private or a client's confidential material.</p>
          </section>

          <section>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">2 · Paste its script</h3>
            <textarea
              value={pasted}
              onChange={(e) => {
                setPasted(e.target.value);
                setCheck(null);
              }}
              rows={8}
              placeholder="Paste the script the other AI wrote…"
              className="w-full resize-y rounded-lg border border-zinc-800 bg-surface px-3 py-2 text-sm leading-relaxed text-zinc-100 placeholder:text-zinc-600 focus:border-accent focus:outline-none"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => void runCheck()} disabled={!pasted.trim() || checking} className={btn}>
                {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Check it
              </button>
              <button type="button" onClick={tidy} disabled={!pasted.trim()} className={btn} title="Remove code blocks, headings, bold and “Scene 1:” labels">
                Tidy up
              </button>
              <button
                type="button"
                onClick={() => onMakeVideo(pasted.trim())}
                disabled={!pasted.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-black cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Wand2 className="h-3.5 w-3.5" /> Make this video
              </button>
            </div>
            {check && (
              <div className="mt-3 rounded-lg border border-zinc-800 bg-black/30 p-3 text-xs">
                <p className="text-zinc-200">
                  {check.scenes} scenes · {check.words} words (~{Math.floor(check.seconds / 60)}:{String(check.seconds % 60).padStart(2, '0')}) · {check.tags} tags · {check.withPicture} of {check.scenes} scenes describe their picture
                </p>
                {check.problems.map((p) => (
                  <p key={p} className="mt-1.5 flex items-start gap-1.5 text-amber-400">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {p}
                  </p>
                ))}
                {check.unknown.length > 0 && (
                  <p className="mt-1.5 flex items-start gap-1.5 text-amber-400">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> These tags will be skipped (not in ClipForge): {check.unknown.map((t) => `[${t.slice(0, 40)}]`).join(' ')}
                  </p>
                )}
                {!check.problems.length && !check.unknown.length && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-accent">
                    <Check className="h-3.5 w-3.5" /> Ready — press Make this video, then Plan scenes to preview every line.
                  </p>
                )}
              </div>
            )}
            {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
          </section>
        </div>
      )}
    </div>
  );
}
