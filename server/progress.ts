/**
 * Tiny in-memory job progress store. The browser sends a jobId with long requests
 * (analyse / export) and polls GET /api/jobs/:id to show live pipeline steps.
 */
export interface JobProgress {
  stage: string; // machine key, e.g. 'transcribe'
  label: string; // human text shown in the UI
  pct: number; // 0-100 overall
  updatedAt: number;
}

const jobs = new Map<string, JobProgress>();

export type ProgressFn = (stage: string, label: string, pct: number) => void;

export function progressFor(jobId: unknown): ProgressFn {
  const id = typeof jobId === 'string' && /^[\w-]{4,64}$/.test(jobId) ? jobId : null;
  return (stage, label, pct) => {
    if (!id) return;
    jobs.set(id, { stage, label, pct: Math.max(0, Math.min(100, Math.round(pct))), updatedAt: Date.now() });
  };
}

export function getJob(id: string): JobProgress | null {
  return jobs.get(id) ?? null;
}

// Forget finished jobs after 10 minutes
setInterval(() => {
  const cutoff = Date.now() - 10 * 60_000;
  for (const [id, j] of jobs) if (j.updatedAt < cutoff) jobs.delete(id);
}, 60_000).unref();
