/**
 * Running-activity tracker, so Cancel can stop everything ClipForge is doing without stopping any app:
 *   - helper processes ClipForge starts (Kokoro TTS, Whisper, FFmpeg, HyperFrames, yt-dlp…) are ended,
 *     with their sub-processes;
 *   - in-flight requests to Ollama and ComfyUI are aborted (Ollama stops generating when its request goes away;
 *     the Ollama app and its loaded model stay up).
 * Detached processes — the ComfyUI server ClipForge launches — are never tracked, so they keep running.
 *
 * Must be imported before anything that uses child_process, because modules capture execFile at load time.
 */
import cp, { type ChildProcess } from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { promisify } from 'node:util';

const children = new Set<ChildProcess>();
let epoch = new AbortController();
let inflight = 0;

const AI_ORIGINS = () =>
  [process.env.OLLAMA_URL || 'http://127.0.0.1:11434', 'http://localhost:11434', process.env.SD_URL || 'http://127.0.0.1:8188', 'http://localhost:8188'].map((u) => {
    try {
      return new URL(u).origin;
    } catch {
      return '';
    }
  });

const isDetached = (args: unknown[]) => args.some((a) => Boolean(a && typeof a === 'object' && !Array.isArray(a) && (a as { detached?: boolean }).detached));

function track(child: ChildProcess | undefined, args: unknown[]) {
  if (!child || isDetached(args)) return child;
  children.add(child);
  child.once('exit', () => children.delete(child));
  child.once('error', () => children.delete(child));
  return child;
}

let installed = false;
export function installActivityTracking() {
  if (installed) return;
  installed = true;
  const mod = cp as unknown as Record<string, unknown>;
  for (const name of ['spawn', 'execFile', 'exec', 'fork'] as const) {
    const orig = mod[name] as (...a: unknown[]) => ChildProcess;
    const custom = (orig as unknown as Record<symbol, unknown>)[promisify.custom] as ((...a: unknown[]) => Promise<unknown> & { child?: ChildProcess }) | undefined;
    const wrapped = function (this: unknown, ...a: unknown[]) {
      return track(orig.apply(this, a), a);
    } as unknown as Record<symbol, unknown>;
    // promisify(execFile) must keep resolving to { stdout, stderr }, so wrap Node's own promisified version too
    if (custom) {
      wrapped[promisify.custom] = (...a: unknown[]) => {
        const p = custom(...a);
        track(p.child, a);
        return p;
      };
    }
    mod[name] = wrapped;
  }
  syncBuiltinESMExports();

  const origFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    let origin = '';
    try {
      origin = new URL(url).origin;
    } catch {
      /* relative or odd URL */
    }
    if (!origin || !AI_ORIGINS().includes(origin)) return origFetch(input, init);
    const signal = init?.signal ? AbortSignal.any([init.signal, epoch.signal]) : epoch.signal;
    inflight++;
    try {
      return await origFetch(input, { ...init, signal });
    } finally {
      inflight--;
    }
  }) as typeof fetch;
}

function killTree(child: ChildProcess) {
  if (child.exitCode !== null || !child.pid) return;
  try {
    if (process.platform === 'win32') cp.execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    else child.kill('SIGKILL');
  } catch {
    try {
      child.kill('SIGKILL');
    } catch {
      /* already gone */
    }
  }
}

/** Stop every running activity (keeps the apps running). Returns what was stopped. */
export function stopAllActivity(): { processes: number; requests: number } {
  const processes = children.size;
  const requests = inflight;
  epoch.abort(new Error('Cancelled'));
  epoch = new AbortController();
  for (const c of [...children]) killTree(c);
  children.clear();
  return { processes, requests };
}

installActivityTracking();
