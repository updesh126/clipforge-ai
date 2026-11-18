import 'dotenv/config';
// first: tracks helper processes and AI requests so Cancel can stop them (must load before child_process users)
import { stopAllActivity } from './server/activity.ts';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import {
  EXPORTS_DIR,
  UPLOADS_DIR,
  deleteProjectById,
  ensureDataDirs,
  getProjectById,
  readProjects,
  upsertProject,
} from './server/store.ts';
import { buildSrtContent, ensurePreviewProxy, exportClipWithFfmpeg, probeVideo } from './server/media.ts';
import {
  analyzeVideoAndSelectClips,
  analyzeYoutubeUrlDirect,
  createDemoVideoAsset,
  getEngineStatus,
} from './server/ai.ts';
import {
  downloadYoutubeMp4,
  fetchYoutubeOembed,
  parseYoutubeUrl,
} from './server/youtube.ts';
import type { AspectRatio, CaptionStyle, Framing, ClipLengthPreset, ClipProject } from './server/types.ts';
import { cancelJob, finishJob, getJob, isCancelled, progressFor } from './server/progress.ts';
import { blankEdit, deleteEdit, editFromClip, getEdit, linkMediaFile, readEdits, saveEdit } from './server/edits.ts';
import { editWithAI } from './server/editAI.ts';
import { renderEdit } from './server/remotion.ts';
import { scriptToVideo, voiceFilesOf } from './server/scriptVideo.ts';
import { importFolder } from './server/importer.ts';
import { ASSETS_DIR, INBOX_DIR, cleanSpec, creditsFor, ensureAsset, ensureAssetDirs, importUserPng, licenceIssues, processInbox, searchAssets, setLicence } from './server/assets.ts';
import type { AssetType } from './src/assetkit/types.ts';
import { castFor, getCast, listCast, planStorySpecs, referenceSheet, renderCharacter, renderEnvironment, saveCast, updateCast } from './server/vector.ts';
import { EXPRESSIONS, normaliseCharacter, type CharacterSpec, type Expression } from './src/vector/character.ts';
import { POSES, type Pose } from './src/vector/skeleton.ts';
import { ENV_KINDS, normaliseEnv, type EnvSpec } from './src/vector/environment.ts';
import { isTheme, THEME_IDS, type ThemeId } from './src/vector/theme.ts';
import type { EditProject } from './src/editor/types.ts';
import { refreshWindowsPath } from './scripts/win-path.mjs';
import { GENERATED_DIR, generateImage, sdSize, sdStatus, stopComfy, videoModel, videoModels } from './server/imagegen.ts';
import { autostartComfy, ensureComfy, findComfy } from './server/comfy.ts';
import { buildNegativePrompt, buildSdPrompt } from './src/artstyles/prompt.ts';

refreshWindowsPath(); // pick up tools installed after this terminal was opened (winget etc.)

// Prefer a caption-capable FFmpeg (Homebrew `ffmpeg-full` has libass) and make Homebrew tools visible
// even when launched from an app without a login shell. Override with FFMPEG_DIR.
{
  const extra = [
    process.env.FFMPEG_DIR,
    '/opt/homebrew/opt/ffmpeg-full/bin',
    '/usr/local/opt/ffmpeg-full/bin',
    '/opt/homebrew/bin',
    '/usr/local/bin',
  ].filter((d): d is string => Boolean(d) && fs.existsSync(d as string));
  process.env.PATH = [...extra, process.env.PATH].join(path.delimiter);
}

ensureDataDirs();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

/**
 * Studio playback URL. Returns the original right away; if the source is heavy (4K/HEVC/huge bitrate)
 * a 1080p H.264 proxy is built in the background and swapped into the project when ready.
 */
async function previewUrlFor(
  filePath: string,
  metadata: Awaited<ReturnType<typeof probeVideo>>,
  projectId?: string
) {
  const original = `/media/uploads/${path.basename(filePath)}`;
  void ensurePreviewProxy(filePath, metadata)
    .then((proxy) => {
      if (!proxy || !projectId) return;
      const p = getProjectById(projectId);
      if (p) upsertProject({ ...p, videoUrl: `/media/uploads/${path.basename(proxy)}` });
    })
    .catch((err) => console.warn('[clipforge] preview proxy failed:', (err as Error).message));
  return original;
}

// Serve local uploaded videos and watermark-free exported clips with range support (via express.static)
app.use('/media/uploads', express.static(UPLOADS_DIR));
app.use('/media/exports', express.static(EXPORTS_DIR));
app.use('/media/generated', express.static(GENERATED_DIR)); // Stable Diffusion paintings (cache)
ensureAssetDirs();
app.use('/media/assets', express.static(ASSETS_DIR));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureDataDirs();
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp4';
    const base = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .slice(0, 48);
    cb(null, `${Date.now()}_${base || 'video'}${ext}`);
  },
});

const upload = multer({
  storage,
  // No size cap — it's your own machine. For very large files prefer /api/projects/local (no copy).
});

// Local engine health (ffmpeg / whisper.cpp / Ollama)
app.get('/api/health', async (_req, res) => {
  const [engines, sd] = await Promise.all([getEngineStatus(), sdStatus()]);
  const video = sd.running ? await videoModel() : null;
  const engines2 = sd.running ? await videoModels() : null;
  res.json({ ...engines, sd: sd.running && Boolean(sd.checkpoint), sdRunning: sd.running, sdModel: sd.checkpoint, sdUrl: sd.url, sdInstalled: Boolean(findComfy()), sdVideo: video?.checkpoint ?? null, sdVideoEngines: engines2 ? (['ltx', 'wan'] as const).filter((e) => engines2[e]) : [] });
});

// Stable Diffusion: status, and a one-off test painting in an art style (used by the docs / setup check)
app.get('/api/sd/status', async (_req, res) => {
  res.json({ ...(await sdStatus(true)), installedAt: findComfy()?.dir ?? null });
});
// start ComfyUI now (used by the Script page when AI painting is picked and it isn't running)
app.post('/api/sd/start', async (_req, res) => {
  if (!findComfy()) {
    res.status(404).json({ error: 'ComfyUI is not installed. Run: powershell -ExecutionPolicy Bypass -File scripts\\setup-comfyui.ps1' });
    return;
  }
  await ensureComfy();
  res.json(await sdStatus(true));
});
app.post('/api/sd/test', async (req, res) => {
  const b = (req.body ?? {}) as Record<string, string>;
  const style = String(b.style || 'storybook');
  const scene = String(b.prompt || 'a child and a dog walking along a village path under a big tree').slice(0, 400);
  try {
    await ensureComfy();
    const [width, height] = sdSize(String(b.aspect || '16:9'));
    const img = await generateImage({ prompt: buildSdPrompt(scene, style), negative: `${buildNegativePrompt(style)}, text, watermark, blurry`, width, height, seed: Number(b.seed) || 7 });
    res.json(img);
  } catch (err) {
    res.status(503).json({ error: err instanceof Error ? err.message : 'Stable Diffusion failed.' });
  }
});

// Live progress for a long-running analyse / export request (the browser polls this)
app.get('/api/jobs/:id', (req, res) => {
  res.json({ job: getJob(req.params.id) });
});

// List all local projects
app.get('/api/projects', (_req, res) => {
  res.json({ projects: readProjects() });
});

// Get single project
app.get('/api/projects/:id', (req, res) => {
  const project = getProjectById(req.params.id);
  if (!project) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }
  res.json({ project });
});

// Upload a local video and run automatic AI transcription + highlight clip selection
app.post('/api/projects/upload', upload.single('video'), async (req, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'No video file uploaded.' });
    return;
  }

  const clipLengthPreset = (req.body?.clipLengthPreset as ClipLengthPreset) || 'auto';
  const projectId = `proj_${Date.now()}`;
  const projectName =
    (req.body?.name as string)?.trim() ||
    path.basename(file.originalname, path.extname(file.originalname));

  try {
    const progress = progressFor(req.body?.jobId);
    progress('probe', 'Reading video with FFprobe', 5);
    const metadata = await probeVideo(file.path);
    const analysis = await analyzeVideoAndSelectClips({
      projectId,
      videoPath: file.path,
      metadata,
      clipLengthPreset,
      onProgress: progress,
    });

    const now = new Date().toISOString();
    const project: ClipProject = {
      id: projectId,
      name: projectName,
      sourceFileName: file.filename,
      videoUrl: await previewUrlFor(file.path, metadata, projectId),
      status: 'ready',
      summary: analysis.summary,
      clipLengthPreset,
      metadata,
      transcript: analysis.transcript,
      clips: analysis.clips,
      createdAt: now,
      updatedAt: now,
    };

    upsertProject(project);
    res.status(201).json({ project });
  } catch (err) {
    // Clean up failed upload file
    if (fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
      } catch {
        // ignore
      }
    }
    const message = err instanceof Error ? err.message : 'Failed to analyze uploaded video.';
    res.status(500).json({ error: message });
  }
});

// Generate a sample local MP4 using offline OS text-to-speech + FFmpeg and run full auto-clipping
app.post('/api/projects/demo', async (req, res) => {
  const clipLengthPreset = (req.body?.clipLengthPreset as ClipLengthPreset) || 'short';
  const projectId = `proj_${Date.now()}`;
  const fileName = `${projectId}_creator_session.mp4`;
  const videoPath = path.join(UPLOADS_DIR, fileName);

  try {
    const progress = progressFor(req.body?.jobId);
    progress('tts', 'Narrating sample video (text-to-speech)', 3);
    await createDemoVideoAsset(videoPath);
    const metadata = await probeVideo(videoPath);
    const analysis = await analyzeVideoAndSelectClips({
      projectId,
      videoPath,
      metadata,
      clipLengthPreset,
      onProgress: progress,
    });

    const now = new Date().toISOString();
    const project: ClipProject = {
      id: projectId,
      name: 'Creator Workflow Session (Sample)',
      sourceFileName: fileName,
      videoUrl: `/media/uploads/${fileName}`,
      status: 'ready',
      summary: analysis.summary,
      clipLengthPreset,
      metadata,
      transcript: analysis.transcript,
      clips: analysis.clips,
      createdAt: now,
      updatedAt: now,
    };

    upsertProject(project);
    res.status(201).json({ project });
  } catch (err) {
    if (fs.existsSync(videoPath)) {
      try {
        fs.unlinkSync(videoPath);
      } catch {
        // ignore
      }
    }
    const message = err instanceof Error ? err.message : 'Failed to generate demo session.';
    res.status(500).json({ error: message });
  }
});

// Native OS file picker shown on this PC. Returns the real path so the video is used in place (never uploaded).
app.get('/api/pick-file', async (req, res) => {
  const anyMedia = req.query.kind === 'media';
  const { execFile } = await import('node:child_process');
  const run = (cmd: string, args: string[]) =>
    new Promise<string>((resolve, reject) =>
      execFile(cmd, args, { timeout: 10 * 60_000 }, (err, stdout) => (err ? reject(err) : resolve(stdout.trim())))
    );
  try {
    let picked = '';
    if (process.platform === 'darwin') {
      picked = await run('osascript', [
        '-e',
        'tell application "System Events" to activate',
        '-e',
        'POSIX path of (choose file with prompt "Choose a video for ClipForge" of type {"public.movie", "public.mpeg-4", "com.apple.quicktime-movie", "org.matroska.mkv", "org.webmproject.webm"})',
      ]);
    } else if (process.platform === 'win32') {
      picked = await run('powershell', [
        '-NoProfile',
        '-STA',
        '-Command',
        "Add-Type -AssemblyName System.Windows.Forms; $f=New-Object System.Windows.Forms.OpenFileDialog; $f.Filter='" + (anyMedia ? 'Media|*.mp4;*.mov;*.mkv;*.webm;*.m4v;*.mp3;*.wav;*.m4a;*.aac;*.png;*.jpg;*.jpeg;*.webp;*.gif|' : '') + "Videos|*.mp4;*.mov;*.mkv;*.webm;*.avi;*.m4v|All files|*.*'; $f.Title='Choose a video for ClipForge'; if($f.ShowDialog() -eq 'OK'){ $f.FileName }",
      ]);
    } else {
      picked = await run('zenity', ['--file-selection', '--title=Choose a video for ClipForge']).catch(() =>
        run('kdialog', ['--getopenfilename', process.env.HOME || '/', 'video/*'])
      );
    }
    res.json({ path: picked || null });
  } catch {
    res.json({ path: null }); // cancelled
  }
});

// Open a video straight from disk by path — no upload, no copy (ideal for huge files, e.g. 24 GB).
// A link is placed in data/uploads; deleting the project removes only the link, never your original.
app.post('/api/projects/local', async (req, res) => {
  const raw = String(req.body?.path ?? '').trim().replace(/^["']|["']$/g, '');
  const clipLengthPreset = (req.body?.clipLengthPreset as ClipLengthPreset) || 'auto';
  const srcPath = path.resolve(raw.replace(/^~(?=$|[\\/])/, process.env.HOME || process.env.USERPROFILE || '~'));
  if (!raw || !fs.existsSync(srcPath) || !fs.statSync(srcPath).isFile()) {
    res.status(400).json({ error: `File not found: ${raw || '(empty path)'}` });
    return;
  }

  const projectId = `proj_${Date.now()}`;
  const ext = path.extname(srcPath) || '.mp4';
  const base = path.basename(srcPath, ext).replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 48) || 'video';
  const fileName = `${projectId}_${base}${ext}`;
  const linkPath = path.join(UPLOADS_DIR, fileName);

  try {
    try {
      fs.symlinkSync(srcPath, linkPath);
    } catch {
      fs.linkSync(srcPath, linkPath); // Windows without symlink rights: hard link (same drive)
    }
    const progress = progressFor(req.body?.jobId);
    progress('probe', 'Reading video with FFprobe', 5);
    const metadata = await probeVideo(linkPath);
    const analysis = await analyzeVideoAndSelectClips({ projectId, videoPath: linkPath, metadata, clipLengthPreset, onProgress: progress });
    const now = new Date().toISOString();
    const project: ClipProject = {
      id: projectId,
      name: path.basename(srcPath, ext),
      sourceType: 'local',
      sourceFileName: fileName,
      videoUrl: await previewUrlFor(linkPath, metadata, projectId),
      status: 'ready',
      summary: analysis.summary,
      clipLengthPreset,
      metadata,
      transcript: analysis.transcript,
      clips: analysis.clips,
      createdAt: now,
      updatedAt: now,
    };
    upsertProject(project);
    res.status(201).json({ project });
  } catch (err) {
    fs.rmSync(linkPath, { force: true });
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to open local video.' });
  }
});

// Import a YouTube URL: attempts local MP4 download via yt-dlp, (fully local)
app.post('/api/projects/youtube', async (req, res) => {
  const rawUrl = String(req.body?.url ?? '').trim();
  const clipLengthPreset = (req.body?.clipLengthPreset as ClipLengthPreset) || 'auto';

  let parsed: { videoId: string; normalizedUrl: string };
  try {
    parsed = parseYoutubeUrl(rawUrl);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid YouTube URL.' });
    return;
  }

  const projectId = `proj_${Date.now()}`;
  const fileName = `${projectId}_yt_${parsed.videoId}.mp4`;
  const videoPath = path.join(UPLOADS_DIR, fileName);

  try {
    const oembed = await fetchYoutubeOembed(parsed.normalizedUrl);
    const projectName = oembed.title || `YouTube Video (${parsed.videoId})`;

    const progress = progressFor(req.body?.jobId);
    progress('download', 'Downloading from YouTube (yt-dlp)', 2);
    const dlResult = await downloadYoutubeMp4(parsed.normalizedUrl, videoPath);
    const now = new Date().toISOString();

    if (dlResult.downloaded) {
      const metadata = await probeVideo(videoPath);
      const analysis = await analyzeVideoAndSelectClips({
        projectId,
        videoPath,
        metadata,
        clipLengthPreset,
        onProgress: progress,
      });

      const project: ClipProject = {
        id: projectId,
        name: projectName,
        sourceType: 'youtube-local',
        youtubeUrl: parsed.normalizedUrl,
        youtubeVideoId: parsed.videoId,
        sourceFileName: fileName,
        videoUrl: await previewUrlFor(videoPath, metadata, projectId),
        status: 'ready',
        summary: analysis.summary,
        clipLengthPreset,
        metadata,
        transcript: analysis.transcript,
        clips: analysis.clips,
        createdAt: now,
        updatedAt: now,
      };

      upsertProject(project);
      res.status(201).json({ project });
      return;
    }

    // No cloud fallback in local build — this throws a helpful error
    const analysis = await analyzeYoutubeUrlDirect({
      youtubeUrl: parsed.normalizedUrl,
      clipLengthPreset,
    });

    const project: ClipProject = {
      id: projectId,
      name: projectName,
      sourceType: 'youtube-embed',
      youtubeUrl: parsed.normalizedUrl,
      youtubeVideoId: parsed.videoId,
      sourceFileName: '',
      videoUrl: parsed.normalizedUrl,
      status: 'ready',
      summary: analysis.summary,
      clipLengthPreset,
      metadata: {
        duration: analysis.durationSeconds,
        width: 1280,
        height: 720,
        fps: 30,
        hasAudio: true,
        sizeBytes: 0,
        codec: 'youtube',
      },
      transcript: analysis.transcript,
      clips: analysis.clips,
      createdAt: now,
      updatedAt: now,
    };

    upsertProject(project);
    res.status(201).json({ project });
  } catch (err) {
    if (fs.existsSync(videoPath)) {
      try {
        fs.unlinkSync(videoPath);
      } catch {
        // ignore
      }
    }
    const message = err instanceof Error ? err.message : 'Failed to import YouTube video.';
    res.status(500).json({ error: message });
  }
});

// Re-run AI clip selection with a new length preset
app.post('/api/projects/:id/reanalyze', async (req, res) => {
  const project = getProjectById(req.params.id);
  if (!project) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }

  const clipLengthPreset = (req.body?.clipLengthPreset as ClipLengthPreset) || project.clipLengthPreset;

  try {
    let analysis: {
      summary: string;
      transcript: ClipProject['transcript'];
      clips: ClipProject['clips'];
      durationSeconds?: number;
    };

    if (project.sourceType === 'youtube-embed' && project.youtubeUrl) {
      analysis = await analyzeYoutubeUrlDirect({
        youtubeUrl: project.youtubeUrl,
        clipLengthPreset,
      });
    } else {
      const videoPath = path.join(UPLOADS_DIR, project.sourceFileName);
      if (!fs.existsSync(videoPath)) {
        res.status(404).json({ error: 'Source video file is missing from local storage.' });
        return;
      }
      analysis = await analyzeVideoAndSelectClips({
        projectId: project.id,
        videoPath,
        metadata: project.metadata,
        clipLengthPreset,
        onProgress: progressFor(req.body?.jobId),
      });
    }

    const updated: ClipProject = {
      ...project,
      clipLengthPreset,
      summary: analysis.summary,
      transcript: analysis.transcript,
      clips: analysis.clips,
      updatedAt: new Date().toISOString(),
    };
    upsertProject(updated);
    res.json({ project: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to re-analyze video.';
    res.status(500).json({ error: message });
  }
});

// Download standalone SRT captions for any clip (works for both local MP4 and YouTube embed projects)
app.get('/api/projects/:id/clips/:clipId/srt', (req, res) => {
  const project = getProjectById(req.params.id);
  if (!project) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }
  const clip = project.clips.find((c) => c.id === req.params.clipId);
  if (!clip) {
    res.status(404).json({ error: 'Clip not found.' });
    return;
  }

  const srt = buildSrtContent(project.transcript, clip.start, clip.end);
  res.setHeader('Content-Type', 'application/x-subrip; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="clipforge_${clip.id}.srt"`);
  res.send(srt);
});

// Update clip boundaries, framing, caption style, or edited transcript text
app.patch('/api/projects/:id', (req, res) => {
  const project = getProjectById(req.params.id);
  if (!project) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }

  const { clips, transcript, name } = req.body as Partial<ClipProject>;
  const updated: ClipProject = {
    ...project,
    name: typeof name === 'string' && name.trim() ? name.trim() : project.name,
    clips: Array.isArray(clips) ? clips : project.clips,
    transcript: Array.isArray(transcript) ? transcript : project.transcript,
    updatedAt: new Date().toISOString(),
  };

  upsertProject(updated);
  res.json({ project: updated });
});

// Export a watermark-free MP4 clip (+ .srt sidecar) using local FFmpeg
app.post('/api/projects/:id/clips/:clipId/export', async (req, res) => {
  const project = getProjectById(req.params.id);
  if (!project) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }

  const clipIndex = project.clips.findIndex((c) => c.id === req.params.clipId);
  if (clipIndex < 0) {
    res.status(404).json({ error: 'Clip not found.' });
    return;
  }

  const clip = project.clips[clipIndex];
  const sourcePath = path.join(UPLOADS_DIR, project.sourceFileName);
  if (!fs.existsSync(sourcePath)) {
    res.status(404).json({ error: 'Source video file missing from local disk.' });
    return;
  }

  const aspectRatio = (req.body?.aspectRatio as AspectRatio) || clip.aspectRatio || '9:16';
  const cropX = typeof req.body?.cropX === 'number' ? req.body.cropX : clip.cropX ?? 50;
  const cropY = typeof req.body?.cropY === 'number' ? req.body.cropY : clip.cropY ?? 50;
  const zoom = typeof req.body?.zoom === 'number' ? req.body.zoom : clip.zoom ?? 1;
  const framing: Framing = req.body?.framing === 'fit' || req.body?.framing === 'fill' ? req.body.framing : clip.framing ?? 'fill';
  const captionStyle = (req.body?.captionStyle as CaptionStyle) || clip.captionStyle || 'highlight';
  const burnCaptions = Boolean(req.body?.burnCaptions ?? captionStyle !== 'off');
  const start = typeof req.body?.start === 'number' ? req.body.start : clip.start;
  const end = typeof req.body?.end === 'number' ? req.body.end : clip.end;
  const hookTitle = typeof req.body?.hookTitle === 'boolean' ? req.body.hookTitle : Boolean(clip.hookTitle);
  const voiceIntro = typeof req.body?.voiceIntro === 'boolean' ? req.body.voiceIntro : Boolean(clip.voiceIntro);
  const voice = typeof req.body?.voice === 'string' && /^[a-z]{2}_[a-z]+$/.test(req.body.voice) ? req.body.voice : clip.voice;

  try {
    const { mp4FileName, srtFileName, burned, engine, warning } = await exportClipWithFfmpeg({
      sourcePath,
      metadata: project.metadata,
      clipId: clip.id,
      title: clip.title,
      hookTitle,
      voiceIntro,
      voice,
      onProgress: progressFor(req.body?.jobId),
      start,
      end,
      aspectRatio,
      cropX,
      cropY,
      zoom,
      framing,
      captionStyle,
      burnCaptions,
      transcript: project.transcript,
    });

    const exportRecord = {
      aspectRatio,
      fileName: mp4FileName,
      url: `/media/exports/${mp4FileName}`,
      srtUrl: `/media/exports/${srtFileName}`,
      createdAt: new Date().toISOString(),
      burnedCaptions: burned,
      engine,
    };

    const updatedClip = {
      ...clip,
      start,
      end,
      aspectRatio,
      cropX,
      cropY,
      zoom,
      framing,
      captionStyle,
      hookTitle,
      voiceIntro,
      voice,
      exportedFiles: [exportRecord, ...(clip.exportedFiles ?? [])].slice(0, 6),
    };

    const updatedClips = [...project.clips];
    updatedClips[clipIndex] = updatedClip;

    const updatedProject: ClipProject = {
      ...project,
      clips: updatedClips,
      updatedAt: new Date().toISOString(),
    };
    upsertProject(updatedProject);

    res.json({ exportRecord, project: updatedProject, warning });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'FFmpeg export failed.';
    res.status(500).json({ error: message });
  }
});

// Force download an exported file cleanly
app.get('/api/download/:fileName', (req, res) => {
  const safeName = path.basename(req.params.fileName);
  const fullPath = path.join(EXPORTS_DIR, safeName);
  if (!fs.existsSync(fullPath)) {
    res.status(404).json({ error: 'Exported file not found.' });
    return;
  }
  res.download(fullPath, safeName);
});

// Delete a local project and clean up disk files
app.delete('/api/projects/:id', (req, res) => {
  const deleted = deleteProjectById(req.params.id);
  if (!deleted) {
    res.status(404).json({ error: 'Project not found.' });
    return;
  }
  res.json({ ok: true });
});

// ---------------- Editor (Remotion) ----------------
app.get('/api/edits', (_req, res) => {
  res.json({ edits: readEdits().map(({ items, ...rest }) => ({ ...rest, itemCount: items.length })) });
});

app.get('/api/edits/:id', (req, res) => {
  const edit = getEdit(req.params.id);
  if (!edit) {
    res.status(404).json({ error: 'Edit not found.' });
    return;
  }
  res.json({ edit });
});

// New edit: blank, or auto-built from an AI clip ({ projectId, clipId })
app.post('/api/edits', (req, res) => {
  const { projectId, clipId, name, aspect } = (req.body ?? {}) as Record<string, string>;
  if (projectId && clipId) {
    const project = getProjectById(projectId);
    const clip = project?.clips.find((c) => c.id === clipId);
    if (!project || !clip) {
      res.status(404).json({ error: 'Clip not found.' });
      return;
    }
    if (project.sourceType === 'youtube-embed') {
      res.status(400).json({ error: 'This YouTube video was not downloaded, so it cannot be edited locally.' });
      return;
    }
    res.status(201).json({ edit: saveEdit(editFromClip(project, clip)) });
    return;
  }
  res.status(201).json({ edit: saveEdit(blankEdit(name || 'Untitled edit', aspect || '9:16')) });
});

app.put('/api/edits/:id', (req, res) => {
  const current = getEdit(req.params.id);
  if (!current) {
    res.status(404).json({ error: 'Edit not found.' });
    return;
  }
  const body = (req.body ?? {}) as Partial<EditProject>;
  const next: EditProject = {
    ...current,
    name: typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 80) : current.name,
    width: [1080, 1920].includes(Number(body.width)) || Number(body.width) === 1350 ? Number(body.width) : current.width,
    height: [1080, 1350, 1920].includes(Number(body.height)) ? Number(body.height) : current.height,
    background: typeof body.background === 'string' && /^#[0-9a-f]{3,8}$/i.test(body.background) ? body.background : current.background,
    items: Array.isArray(body.items) ? (body.items as EditProject['items']) : current.items,
  };
  res.json({ edit: saveEdit(next) });
});

app.delete('/api/edits/:id', (req, res) => {
  const edit = getEdit(req.params.id);
  const ok = deleteEdit(req.params.id);
  // voice-over clips made by Script → Video belong to this edit only
  for (const f of edit ? voiceFilesOf(edit) : []) fs.rmSync(f, { force: true });
  res.status(ok ? 200 : 404).json({ ok });
});

// ---------------- Asset library ----------------
app.get('/api/assets', (req, res) => {
  const q = String(req.query.q ?? '').slice(0, 80);
  const style = String(req.query.style ?? '') || undefined;
  const category = String(req.query.category ?? '') || undefined;
  res.json({ assets: searchAssets(q, { style, category }).slice(0, 200), folder: ASSETS_DIR, inbox: INBOX_DIR });
});

// Draw (or reuse) an asset in a style: built-in recipe, or a new one designed by the local LLM
// ---------------------------------------------------------------- procedural vector engine
// characters (cast), poses, expressions, environments → SVG + transparent PNG, all cached
app.get('/api/vector/cast', (_req, res) => {
  res.json({ cast: listCast(), themes: THEME_IDS, poses: POSES, expressions: EXPRESSIONS, environments: ENV_KINDS });
});

app.post('/api/vector/cast', async (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  const name = String(b.name ?? '').trim().slice(0, 60);
  if (!name) {
    res.status(400).json({ error: 'Give the character a name.' });
    return;
  }
  const spec = normaliseCharacter({ ...((b.spec as Partial<CharacterSpec>) ?? {}), name, description: typeof b.description === 'string' ? b.description.slice(0, 400) : undefined });
  const entry = saveCast(spec, Array.isArray(b.aliases) ? b.aliases.map(String) : [name.toLowerCase()]);
  const reference = await referenceSheet(entry.spec.id, isTheme(b.theme) ? b.theme : 'storybook');
  res.status(201).json({ character: entry, reference });
});

app.put('/api/vector/cast/:id', async (req, res) => {
  const entry = updateCast(req.params.id, (req.body ?? {}) as Partial<CharacterSpec> & { aliases?: string[] });
  if (!entry) {
    res.status(404).json({ error: 'No such character.' });
    return;
  }
  const reference = await referenceSheet(entry.spec.id, isTheme(req.body?.theme) ? req.body.theme : 'storybook');
  res.json({ character: entry, reference });
});

app.post('/api/vector/character', async (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  const entry = typeof b.id === 'string' ? getCast(b.id) : typeof b.name === 'string' ? castFor(b.name, typeof b.description === 'string' ? b.description : undefined) : null;
  if (!entry) {
    res.status(404).json({ error: 'Give an existing character id or a name.' });
    return;
  }
  try {
    const out = await renderCharacter(entry.spec, { pose: b.pose as Pose, expression: b.expression as Expression, theme: b.theme as ThemeId, size: Number(b.size) || 1024, flip: Boolean(b.flip), phase: typeof b.phase === 'number' ? b.phase : undefined });
    res.json({ character: entry, ...out });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Could not draw the character.' });
  }
});

app.post('/api/vector/environment', async (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  const spec = normaliseEnv({ ...((b.spec as Partial<EnvSpec>) ?? {}), place: typeof b.place === 'string' ? b.place.slice(0, 120) : undefined });
  try {
    res.json({ environment: spec, ...(await renderEnvironment(spec, isTheme(b.theme) ? b.theme : 'storybook', Number(b.width) || 1080, Number(b.height) || 1920)) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Could not draw the place.' });
  }
});

app.post('/api/vector/plan', async (req, res) => {
  const text = String(req.body?.text ?? '').slice(0, 8000);
  if (!text.trim()) {
    res.status(400).json({ error: 'Paste the story text.' });
    return;
  }
  res.json(await planStorySpecs(text));
});

app.post('/api/assets/generate', async (req, res) => {
  const b = (req.body ?? {}) as Record<string, unknown>;
  const name = String(b.name ?? '').trim().slice(0, 60);
  if (!name) {
    res.status(400).json({ error: 'Give the asset a name.' });
    return;
  }
  const types: AssetType[] = ['person', 'animal', 'bird', 'fish', 'tree', 'mountain', 'building', 'object', 'background'];
  const type = types.includes(b.type as AssetType) ? (b.type as AssetType) : undefined;
  try {
    const asset = await ensureAsset(name, {
      style: String(b.style ?? 'flat').slice(0, 30),
      type,
      aspect: typeof b.aspect === 'string' ? b.aspect : undefined,
      spec: b.spec && typeof b.spec === 'object' && type ? cleanSpec(b.spec as Record<string, unknown>, type) : undefined,
      preferGenerated: true,
    });
    res.status(201).json({ asset });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Could not draw the asset.' });
  }
});

// Copy one of your own PNGs into the library, recording its source and licence
// Sort files dropped into assets/library/inbox now. PNG/SVG/Lottie are sorted on every lookup;
// JPG/WebP pictures also get their background removed here.
app.post('/api/assets/inbox', async (_req, res) => {
  const imported = processInbox();
  const pictures = await importFolder(INBOX_DIR, { source: 'inbox', move: true });
  res.json({ imported, pictures, inbox: INBOX_DIR });
});

// Record where one of your PNGs came from and its licence (stored in assets/library/licences.json)
app.post('/api/assets/licence', (req, res) => {
  const b = (req.body ?? {}) as Record<string, string>;
  try {
    res.json({ note: setLicence(String(b.url ?? ''), { licence: String(b.licence ?? '').slice(0, 100), source: b.source ? String(b.source).slice(0, 300) : undefined }) });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Could not save the licence.' });
  }
});

// Which of your PNGs in this edit still need a licence check
app.get('/api/edits/:id/licences', (req, res) => {
  const edit = getEdit(req.params.id);
  if (!edit) {
    res.status(404).json({ error: 'Edit not found.' });
    return;
  }
  res.json({ issues: licenceIssues(edit.items.filter((i) => i.kind === 'image').map((i) => (i as { src: string }).src)) });
});

app.post('/api/assets/import', (req, res) => {
  const b = (req.body ?? {}) as Record<string, string>;
  const src = path.resolve(String(b.path ?? '').replace(/^["']|["']$/g, ''));
  if (!/\.(png|svg|json)$/i.test(src) || !fs.existsSync(src)) {
    res.status(400).json({ error: 'Pick an existing .png, .svg or Lottie .json file.' });
    return;
  }
  try {
    res.status(201).json({ asset: importUserPng(src, String(b.category ?? 'props'), String(b.name ?? ''), { source: b.source, licence: b.licence }) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Import failed.' });
  }
});

// Script → video: voice-over + motion graphics + captions, built as an editable edit
app.post('/api/script-video', async (req, res) => {
  const b = (req.body ?? {}) as Record<string, string>;
  const script = String(b.script ?? '').slice(0, 20000);
  if (!script.trim()) {
    res.status(400).json({ error: 'Paste a script first.' });
    return;
  }
  try {
    const edit = await scriptToVideo(
      { script, title: b.title, aspect: b.aspect, style: b.style, voice: b.voice, language: b.language === 'hi' ? 'hi' : b.language === 'en' ? 'en' : undefined, captions: b.captions as never, mode: b.mode === 'graphics' ? 'graphics' : 'story', illustration: b.illustration === 'ai' ? 'ai' : 'vector', animate: String(b.animate) === 'true', motionEngine: b.motionEngine === 'wan' ? 'wan' : b.motionEngine === 'ltx' ? 'ltx' : undefined },
      progressFor(b.jobId)
    );
    finishJob(b.jobId, { editId: edit.id }); // lets a reloaded page open the result
    res.status(201).json({ edit });
  } catch (err) {
    // a cancel can surface as our CancelledError, or as ComfyUI failing because we interrupted it
    if (isCancelled(b.jobId) || (err instanceof Error && err.name === 'CancelledError')) {
      console.log('[clipforge] script-video cancelled');
      finishJob(b.jobId, { error: 'Cancelled' });
      res.status(499).json({ error: 'Cancelled' });
      return;
    }
    console.error('[clipforge] script-video failed:', err);
    const message = err instanceof Error ? err.message : 'Could not build the video.';
    finishJob(b.jobId, { error: message });
    res.status(500).json({ error: message });
  }
});

// Cancel a running job (Script → video). Stops at the next step and frees the GPU right away.
app.post('/api/jobs/:id/cancel', async (req, res) => {
  const ok = cancelJob(req.params.id);
  // stop all activity, keep the apps: end helper processes (TTS, Whisper, FFmpeg…), abort Ollama / ComfyUI requests…
  const stopped = stopAllActivity();
  // …then interrupt ComfyUI's running job and clear its queue (ComfyUI itself keeps running)
  await stopComfy();
  console.log(`[clipforge] cancel ${req.params.id}: stopped ${stopped.processes} process(es), ${stopped.requests} AI request(s), ComfyUI interrupted`);
  res.json({ cancelled: ok, ...stopped });
});

// Edit by prompt with the local LLM
app.post('/api/edits/:id/ai', async (req, res) => {
  const edit = getEdit(req.params.id);
  const instruction = String(req.body?.instruction ?? '').trim().slice(0, 1000);
  if (!edit || !instruction) {
    res.status(400).json({ error: edit ? 'Type what you want changed.' : 'Edit not found.' });
    return;
  }
  try {
    const result = await editWithAI(edit, instruction);
    const saved = result.applied ? saveEdit(result.edit) : edit;
    res.json({ edit: saved, reply: result.reply, applied: result.applied });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'AI edit failed.' });
  }
});

// Local Remotion render → MP4 in data/exports
app.post('/api/edits/:id/render', async (req, res) => {
  const edit = getEdit(req.params.id);
  if (!edit) {
    res.status(404).json({ error: 'Edit not found.' });
    return;
  }
  try {
    const b = (req.body ?? {}) as Record<string, unknown>;
    const out = await renderEdit(edit, PORT, progressFor(b.jobId as string | undefined), { format: b.format as never, quality: b.quality as never, scale: Number(b.scale) || 1, stillAt: Number(b.stillAt) || 0 });
    const record = { ...out, createdAt: new Date().toISOString() };
    const saved = saveEdit({ ...edit, exports: [record, ...(edit.exports ?? [])].slice(0, 10) });
    // the render still happens, but tell the user which of their PNGs aren't cleared for commercial use
    const srcs = edit.items.filter((i) => i.kind === 'image').map((i) => (i as { src: string }).src);
    res.json({ edit: saved, export: record, licenceIssues: licenceIssues(srcs), credits: creditsFor(srcs) });
  } catch (err) {
    console.error('[clipforge] Remotion render failed:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Render failed.' });
  }
});

// Add a file from disk to the editor's media (linked in place, not copied when possible)
app.post('/api/assets/local', async (req, res) => {
  const raw = String(req.body?.path ?? '').trim().replace(/^["']|["']$/g, '');
  const src = path.resolve(raw);
  if (!raw || !fs.existsSync(src) || !fs.statSync(src).isFile()) {
    res.status(400).json({ error: `File not found: ${raw || '(empty path)'}` });
    return;
  }
  const ext = path.extname(src).toLowerCase();
  const kind = ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext) ? 'image' : ['.mp3', '.wav', '.m4a', '.aac', '.ogg'].includes(ext) ? 'audio' : 'video';
  try {
    const { url, fileName } = linkMediaFile(src);
    let duration = kind === 'image' ? 4 : 10;
    if (kind !== 'image') {
      try {
        duration = (await probeVideo(path.join(UPLOADS_DIR, fileName))).duration || duration;
      } catch {
        // keep default
      }
    }
    res.status(201).json({ asset: { url, kind, name: path.basename(src), duration } });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Could not add media.' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`ClipForge AI local studio listening on http://localhost:${PORT}`);
    autostartComfy(); // local Stable Diffusion for "AI painting", when installed
  });
  // Long uploads and hour-long transcriptions must not be cut off by Node's default 5-minute limits
  server.requestTimeout = 0;
  server.headersTimeout = 0;
  server.timeout = 0;
}

startServer().catch((err) => {
  console.error('Failed to start ClipForge AI server:', err);
  process.exit(1);
});
