/**
 * Tiny in-memory job progress store. The browser sends a jobId with long requests
 * (analyse / export) and polls GET /api/jobs/:id to show live pipeline steps.
 */
export interface JobProgress {
  stage: string; // machine key, e.g. 'transcribe'
  label: string; // human text shown in the UI
  pct: number; // 0-100 overall
  updatedAt: number;
  /** visual progress for painted videos: live preview of the image being painted, finished scenes, counts */
  media?: JobMedia;
  result?: { editId?: string; error?: string }; // set when the job finishes, so a reloaded page can pick it up
}

export interface JobMedia {
  preview?: string; // URL of the latest preview frame (changes as it sharpens)
  scenes?: string[]; // URLs of finished scene paintings, in order
  sceneIndex?: number; // scene being made (1-based)
  sceneTotal?: number;
  aspect?: string; // frame shape of the video, e.g. 9:16
  step?: number; // sampler step of the current painting
  steps?: number;
}

const jobs = new Map<string, JobProgress>();

/** stage, label, overall %, and optional visual progress (merged into what the job already has) */
export type ProgressFn = (stage: string, label: string, pct: number, media?: Partial<JobMedia>) => void;

export function progressFor(jobId: unknown): ProgressFn {
  const id = typeof jobId === 'string' && /^[\w-]{4,64}$/.test(jobId) ? jobId : null;
  return (stage, label, pct, media) => {
    if (!id) return;
    const prev = jobs.get(id)?.media;
    const merged = media || prev ? { ...prev, ...media } : undefined;
    jobs.set(id, { stage, label, pct: Math.max(0, Math.min(100, Math.round(pct))), updatedAt: Date.now(), media: merged });
  };
}

export function finishJob(jobId: unknown, result: { editId?: string; error?: string }) {
  if (typeof jobId !== 'string' || !/^[\w-]{4,64}$/.test(jobId)) return;
  jobs.set(jobId, { stage: result.error ? 'error' : 'done', label: result.error ?? 'Done', pct: 100, result, updatedAt: Date.now(), media: jobs.get(jobId)?.media });
}

export function getJob(id: string): JobProgress | null {
  return jobs.get(id) ?? null;
}

// Forget finished jobs after 10 minutes
setInterval(() => {
  const cutoff = Date.now() - 10 * 60_000;
  for (const [id, j] of jobs) if (j.updatedAt < cutoff) jobs.delete(id);
}, 60_000).unref();
