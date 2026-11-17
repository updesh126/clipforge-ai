/**
 * Local Remotion rendering: bundle src/remotion once, then renderMedia() with the edit as input props.
 * Remotion ships its own FFmpeg + headless Chrome (downloaded on first render).
 * Licence: Remotion is free for individuals and companies of up to 3 people; larger for-profit teams need a company licence.
 */
import path from 'node:path';
import fs from 'node:fs';
import type { EditProject } from '../src/editor/types.ts';
import { EXPORTS_DIR } from './store.ts';
import type { ProgressFn } from './progress.ts';

const COMPOSITION_ID = 'ClipForgeEdit';
let bundlePromise: Promise<string> | null = null;
let bundledAt = 0;

/** Newest change to anything the Remotion bundle includes (so graphics edits show up without a restart). */
function sourceStamp(): number {
  let newest = 0;
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(tsx?|css)$/.test(e.name)) newest = Math.max(newest, fs.statSync(p).mtimeMs);
    }
  };
  for (const d of ['remotion', 'editor', 'assetkit']) {
    const dir = path.join(process.cwd(), 'src', d);
    if (fs.existsSync(dir)) walk(dir);
  }
  return newest;
}

export async function getBundle(progress: ProgressFn = () => {}): Promise<string> {
  const stamp = sourceStamp();
  if (stamp > bundledAt) bundlePromise = null;
  if (!bundlePromise) {
    bundledAt = stamp;
    bundlePromise = (async () => {
      const { bundle } = await import('@remotion/bundler');
      progress('bundle', 'Bundling motion graphics (first render only)', 3);
      return bundle({
        entryPoint: path.join(process.cwd(), 'src', 'remotion', 'index.ts'),
        onProgress: (p) => progress('bundle', 'Bundling motion graphics (first render only)', 3 + p * 0.07),
      });
    })().catch((err) => {
      bundlePromise = null;
      throw err;
    });
  }
  return bundlePromise;
}

export type RenderFormat = 'mp4' | 'webm' | 'gif' | 'still';
export interface RenderOptions {
  format?: RenderFormat; // mp4 (H.264), webm (VP9), gif, still (PNG of one frame)
  quality?: 'high' | 'standard' | 'draft';
  scale?: number; // 1 = full size, 0.5 = half (draft previews)
  stillAt?: number; // seconds, for format = still
}

const CRF: Record<'mp4' | 'webm', Record<NonNullable<RenderOptions['quality']>, number>> = {
  mp4: { high: Number(process.env.EXPORT_CRF || 17), standard: 23, draft: 28 },
  webm: { high: 20, standard: 31, draft: 40 },
};

export async function renderEdit(edit: EditProject, port: number, progress: ProgressFn, opts: RenderOptions = {}): Promise<{ fileName: string; url: string; format: RenderFormat }> {
  const { renderMedia, renderStill, selectComposition, ensureBrowser } = await import('@remotion/renderer');
  const format: RenderFormat = ['mp4', 'webm', 'gif', 'still'].includes(String(opts.format)) ? (opts.format as RenderFormat) : 'mp4';
  const quality = opts.quality && ['high', 'standard', 'draft'].includes(opts.quality) ? opts.quality : 'high';
  // GIFs are big: cap them at half size
  const scale = Math.max(0.25, Math.min(1, Number(opts.scale) || 1, format === 'gif' ? 0.5 : 1));
  progress('browser', 'Preparing headless Chrome', 1);
  await ensureBrowser();
  const serveUrl = await getBundle(progress);
  const inputProps = { edit, assetBase: `http://localhost:${port}`, preview: false };
  progress('compose', 'Loading composition', 11);
  const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps });

  fs.mkdirSync(EXPORTS_DIR, { recursive: true });
  const safe = edit.name.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40) || 'edit';
  const ext = format === 'still' ? 'png' : format;
  const fileName = `edit_${safe}_${Date.now()}.${ext}`;
  const outputLocation = path.join(EXPORTS_DIR, fileName);

  if (format === 'still') {
    const frame = Math.max(0, Math.min(composition.durationInFrames - 1, Math.round((opts.stillAt ?? 0) * composition.fps)));
    progress('render', 'Rendering still frame', 50);
    await renderStill({ composition, serveUrl, output: outputLocation, inputProps, frame, imageFormat: 'png', scale });
  } else {
    await renderMedia({
      composition,
      serveUrl,
      codec: format === 'webm' ? 'vp9' : format === 'gif' ? 'gif' : 'h264',
      ...(format === 'gif' ? { everyNthFrame: 2 } : { crf: CRF[format][quality], audioBitrate: quality === 'draft' ? '128k' : '256k' }),
      scale,
      outputLocation,
      inputProps,
      concurrency: null,
      onProgress: ({ progress: p, stitchStage }) =>
        progress('render', stitchStage === 'muxing' ? 'Mixing audio' : `Rendering ${format.toUpperCase()} with Remotion`, 12 + p * 87),
    });
  }
  progress('done', 'Render ready', 100);
  return { fileName, url: `/media/exports/${fileName}`, format };
}
