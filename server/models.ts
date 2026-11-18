/**
 * AI model manager: list the Ollama models on this computer, download new ones with live progress, remove them.
 * Downloads go through Ollama's own /api/pull (from ollama.com), so the files land where Ollama keeps them.
 */
import type { ProgressFn } from './progress.ts';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';

export interface InstalledModel {
  name: string;
  sizeGb: number;
  cloud: boolean; // runs online: prompts leave this computer
}

/** Suggested models, with the sizes ollama.com shows. Anything else can be typed by name. */
export const SUGGESTED_MODELS: Array<{ name: string; label: string; sizeGb: number; note: string }> = [
  { name: 'qwen3.5:4b', label: 'Qwen 3.5 4B', sizeGb: 3.3, note: 'Default for planning and the Script Writer — good balance on a 12 GB GPU.' },
  { name: 'maternion/spark-x2.5:4b-q4_K_M', label: 'Spark-X2.5 4B (4-bit)', sizeGb: 2.6, note: 'Community 4-bit upload of Spark-X2.5-4B. Fast, leaves room for ComfyUI.' },
  { name: 'SparkLLM/Spark-X2.5-4B', label: 'Spark-X2.5 4B (official, 16-bit)', sizeGb: 8.2, note: 'Official full-precision build. Best quality, but fills most of a 12 GB GPU.' },
  { name: 'qwen2.5:3b', label: 'Qwen 2.5 3B', sizeGb: 1.9, note: 'Smallest; for low-memory laptops. Weaker scripts.' },
];

/** Ollama model names: letters, digits, dots, dashes, underscores, one optional namespace and tag. */
export const validModelName = (s: string) => /^[a-z0-9][\w.-]{0,80}(\/[\w.-]{1,80})?(:[\w.-]{1,60})?$/i.test(s);

export async function installedModels(): Promise<InstalledModel[] | null> {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(4000) });
    const d = (await r.json()) as { models?: Array<{ name: string; size?: number }> };
    return (d.models ?? []).map((m) => ({ name: m.name, sizeGb: Math.round(((m.size ?? 0) / 1e9) * 10) / 10, cloud: /cloud/i.test(m.name) || !m.size }));
  } catch {
    return null; // Ollama not running
  }
}

/** Download a model; progress is reported as "Downloading … 1.2 of 2.6 GB". */
export async function pullModel(name: string, progress: ProgressFn): Promise<void> {
  progress('download', `Starting download of ${name}`, 1);
  const res = await fetch(`${OLLAMA_URL}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: name, stream: true }),
  });
  if (!res.ok || !res.body) throw new Error(`Ollama could not start the download (${res.status}): ${(await res.text().catch(() => '')).slice(0, 200)}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let lastPct = -1;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      const ev = JSON.parse(line) as { status?: string; total?: number; completed?: number; error?: string };
      if (ev.error) throw new Error(ev.error.includes('not found') || ev.error.includes('manifest') ? `“${name}” is not on ollama.com — check the name.` : ev.error);
      if (ev.total && ev.completed !== undefined) {
        const pct = Math.floor((ev.completed / ev.total) * 100);
        if (pct !== lastPct) {
          lastPct = pct;
          progress('download', `Downloading ${name} · ${(ev.completed / 1e9).toFixed(1)} of ${(ev.total / 1e9).toFixed(1)} GB`, Math.max(2, Math.min(97, pct)));
        }
      } else if (ev.status) {
        progress('download', `${name}: ${ev.status}`, Math.max(2, lastPct));
      }
    }
  }
  progress('done', `${name} is ready`, 100);
}

export async function removeModel(name: string): Promise<void> {
  const r = await fetch(`${OLLAMA_URL}/api/delete`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: name }) });
  if (!r.ok) throw new Error(`Ollama could not remove ${name} (${r.status}).`);
}
