import type { JobProgress } from '../types.ts';

export const newJobId = () => `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/**
 * Run a long request while polling /api/jobs/:id for live pipeline progress.
 * `run` receives the jobId to pass to the server.
 */
export async function withProgress<T>(
  run: (jobId: string) => Promise<T>,
  onProgress: (p: JobProgress | null) => void
): Promise<T> {
  const jobId = newJobId();
  let stopped = false;
  const poll = async () => {
    while (!stopped) {
      try {
        const r = await fetch(`/api/jobs/${jobId}`);
        const { job } = (await r.json()) as { job: JobProgress | null };
        if (!stopped && job) onProgress(job);
      } catch {
        // server busy — try again
      }
      await new Promise((res) => setTimeout(res, 900));
    }
  };
  void poll();
  try {
    return await run(jobId);
  } finally {
    stopped = true;
    onProgress(null);
  }
}

export async function postJson<T = unknown>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status}).`);
  return data as T;
}
