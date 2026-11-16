import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import type { AspectRatio, CaptionStyle, Framing, TranscriptSegment, VideoMetadata } from './types.ts';
import { buildCompositionHtml, frameSize, hyperframesInstalled, renderComposition, segmentWords, wordPages } from './hyperframes.ts';
import type { ProgressFn } from './progress.ts';
import { audioDuration, speak } from './tts.ts';
import { EXPORTS_DIR, TEMP_DIR } from './store.ts';

const execFileAsync = promisify(execFile);

let assSupport: boolean | null = null;
/** Homebrew's ffmpeg ships without libass; detect it so exports never fail. */
export async function ffmpegHasFilter(name: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync('ffmpeg', ['-hide_banner', '-filters'], { maxBuffer: 1024 * 1024 * 4 });
    return new RegExp(`\\s${name}\\s`).test(stdout);
  } catch {
    return false;
  }
}

export async function probeVideo(filePath: string): Promise<VideoMetadata> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v',
    'quiet',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    filePath,
  ]);

  const parsed = JSON.parse(stdout) as {
    format?: { duration?: string; size?: string };
    streams?: Array<{
      codec_type?: string;
      codec_name?: string;
      width?: number;
      height?: number;
      r_frame_rate?: string;
    }>;
  };

  const videoStream = parsed.streams?.find((s) => s.codec_type === 'video');
  const audioStream = parsed.streams?.find((s) => s.codec_type === 'audio');
  const stat = fs.statSync(filePath);

  let fps = 30;
  if (videoStream?.r_frame_rate && videoStream.r_frame_rate.includes('/')) {
    const [num, den] = videoStream.r_frame_rate.split('/').map(Number);
    if (den && num) fps = Math.round((num / den) * 100) / 100;
  }

  return {
    duration: Number(parsed.format?.duration ?? 0) || 0,
    width: videoStream?.width ?? 1280,
    height: videoStream?.height ?? 720,
    fps,
    hasAudio: Boolean(audioStream),
    sizeBytes: Number(parsed.format?.size ?? stat.size) || stat.size,
    codec: videoStream?.codec_name ?? 'h264',
  };
}

export async function extractAudioMp3(videoPath: string, outMp3Path: string): Promise<string> {
  await execFileAsync('ffmpeg', [
    '-y',
    '-i',
    videoPath,
    '-vn',
    '-ac',
    '1',
    '-ar',
    '16000',
    '-b:a',
    '48k',
    outMp3Path,
  ]);
  return outMp3Path;
}

export async function extractKeyframes(
  videoPath: string,
  outDir: string,
  duration: number,
  maxFrames = 10
): Promise<Array<{ timestamp: number; filePath: string }>> {
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  const count = Math.min(maxFrames, Math.max(3, Math.floor(duration / 3)));
  const results: Array<{ timestamp: number; filePath: string }> = [];

  for (let i = 0; i < count; i++) {
    const ts = Math.min(duration - 0.2, Math.max(0, (duration / count) * i + 0.5));
    const framePath = path.join(outDir, `frame_${i}.jpg`);
    await execFileAsync('ffmpeg', [
      '-y',
      '-ss',
      ts.toFixed(2),
      '-i',
      videoPath,
      '-frames:v',
      '1',
      '-q:v',
      '4',
      '-vf',
      'scale=640:-2',
      framePath,
    ]);
    if (fs.existsSync(framePath)) {
      results.push({ timestamp: Math.round(ts * 10) / 10, filePath: framePath });
    }
  }
  return results;
}

function formatSrtTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = Math.floor(safe % 60);
  const ms = Math.round((safe - Math.floor(safe)) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

function formatAssTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = Math.floor(safe % 60);
  const cs = Math.min(99, Math.round((safe - Math.floor(safe)) * 100));
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

export function buildSrtContent(
  transcript: TranscriptSegment[],
  clipStart: number,
  clipEnd: number
): string {
  const overlapping = transcript.filter((seg) => seg.end > clipStart && seg.start < clipEnd);
  return overlapping
    .map((seg, idx) => {
      const startRel = Math.max(0, seg.start - clipStart);
      const endRel = Math.min(clipEnd - clipStart, seg.end - clipStart);
      return `${idx + 1}\n${formatSrtTime(startRel)} --> ${formatSrtTime(Math.max(startRel + 0.4, endRel))}\n${seg.text.trim()}\n`;
    })
    .join('\n');
}

function escapeAssText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\{/g, '\\{').replace(/\}/g, '\\}').replace(/\n/g, '\\N');
}

/** ASS subtitles for FFmpeg. karaoke/pop use \k word timing so they still animate without HyperFrames. */
export function buildAssContent(
  transcript: TranscriptSegment[],
  clipStart: number,
  clipEnd: number,
  resX: number,
  resY: number,
  captionStyle: CaptionStyle
): string {
  const animated = captionStyle === 'karaoke' || captionStyle === 'pop';
  const bold = captionStyle !== 'clean';
  const portrait = resY > resX;
  const fontSize = portrait ? (animated ? 76 : 58) : resX === resY ? 56 : 46;
  const marginV = portrait ? 420 : 72;
  // ASS colours are &HAABBGGRR. Mint #B5E2DD → &H00DDE2B5, yellow #FFE44D → &H004DE4FF
  const accent = captionStyle === 'highlight' ? '&H004DE4FF' : '&H00DDE2B5';
  const primary = captionStyle === 'clean' ? '&H00FFFFFF' : captionStyle === 'highlight' ? accent : animated ? accent : '&H00FFFFFF';
  const secondary = '&H00FFFFFF';
  const outline = bold ? 5 : 3;

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${resX}
PlayResY: ${resY}
WrapStyle: 1

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial Black,${fontSize},${primary},${secondary},&H00000000,&H80000000,${bold ? -1 : 0},0,0,0,100,100,0,0,1,${outline},2,2,64,64,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const overlapping = transcript.filter((seg) => seg.end > clipStart && seg.start < clipEnd);
  const lines: string[] = [];
  if (animated) {
    const words = overlapping.flatMap(segmentWords).filter((w) => w.end > clipStart && w.start < clipEnd);
    const pages = wordPages(words, portrait ? 3 : 6, portrait ? 22 : 42);
    pages.forEach((page, i) => {
      const s = Math.max(0, page[0].start - clipStart);
      const next = pages[i + 1] ? pages[i + 1][0].start - clipStart : Infinity;
      const e = Math.min(next, page[page.length - 1].end - clipStart + 0.5, clipEnd - clipStart);
      let cursor = page[0].start;
      const text = page
        .map((w) => {
          const lead = Math.max(0, Math.round((w.start - cursor) * 100));
          const k = Math.max(1, Math.round((w.end - w.start) * 100));
          cursor = w.end;
          return `${lead ? `{\\k${lead}}` : ''}{\\k${k}}${escapeAssText(w.text.toUpperCase())}`;
        })
        .join(' ');
      lines.push(`Dialogue: 0,${formatAssTime(s)},${formatAssTime(Math.max(s + 0.3, e))},Default,,0,0,0,,{\\fad(60,0)}${text}`);
    });
  } else {
    for (const seg of overlapping) {
      const startRel = Math.max(0, seg.start - clipStart);
      const endRel = Math.min(clipEnd - clipStart, seg.end - clipStart);
      lines.push(
        `Dialogue: 0,${formatAssTime(startRel)},${formatAssTime(Math.max(startRel + 0.4, endRel))},Default,,0,0,0,,${escapeAssText(seg.text.trim())}`
      );
    }
  }
  return header + lines.join('\n') + '\n';
}

export async function renderDemoMp4FromAudio(audioWavPath: string, outMp4Path: string): Promise<void> {
  // Pure-black studio video with an animated mint waveform
  await execFileAsync('ffmpeg', [
    '-y',
    '-i',
    audioWavPath,
    '-f',
    'lavfi',
    '-i',
    'color=c=#050507:s=1280x720:r=30',
    '-filter_complex',
    '[0:a]showwaves=s=1040x220:mode=cline:colors=#B5E2DD:rate=30[waves];[1:v][waves]overlay=(W-w)/2:(H-h)/2[outv]',
    '-map',
    '[outv]',
    '-map',
    '0:a',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-b:a',
    '160k',
    '-shortest',
    outMp4Path,
  ]);
}

/** Crop / fit / zoom / pan filter chain shared by both export engines. */
function framingFilters(W: number, H: number, cropX: number, cropY: number, zoom: number, framing: Framing): string[] {
  const even = (n: number) => Math.max(2, Math.floor(n / 2) * 2);
  const z = Math.min(3, Math.max(1, Number(zoom) || 1));
  const fx = Math.min(1, Math.max(0, cropX / 100)).toFixed(3);
  const fy = Math.min(1, Math.max(0, cropY / 100)).toFixed(3);
  const ZW = even(W * z);
  const ZH = even(H * z);
  if (framing === 'fit') {
    // Whole video visible, centred on a blurred, dimmed fill of itself (no black bars)
    return [
      `split=2[bg][fg];` +
        `[bg]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=luma_radius=40:luma_power=2,eq=brightness=-0.12[bgb];` +
        `[fg]scale=${ZW}:${ZH}:force_original_aspect_ratio=decrease:flags=lanczos,` +
        `crop='min(iw,${W})':'min(ih,${H})':'(iw-ow)*${fx}':'(ih-oh)*${fy}'[fgc];` +
        `[bgb][fgc]overlay=(W-w)/2:(H-h)/2,setsar=1`,
    ];
  }
  // Fill the frame: scale to cover (times zoom), then pan the crop window
  return [
    `scale=${ZW}:${ZH}:force_original_aspect_ratio=increase:flags=lanczos`,
    `crop=${W}:${H}:'(iw-ow)*${fx}':'(ih-oh)*${fy}'`,
    'setsar=1',
  ];
}

const videoCodecArgs = () => [
  '-c:v',
  'libx264',
  '-preset',
  process.env.EXPORT_PRESET || 'medium',
  '-crf',
  process.env.EXPORT_CRF || '17',
  '-profile:v',
  'high',
  '-pix_fmt',
  'yuv420p',
];

export interface ExportParams {
  sourcePath: string;
  metadata: VideoMetadata;
  clipId: string;
  title?: string;
  start: number;
  end: number;
  aspectRatio: AspectRatio;
  cropX: number;
  cropY?: number;
  zoom?: number;
  framing?: Framing;
  captionStyle: CaptionStyle;
  burnCaptions: boolean;
  hookTitle?: boolean;
  voiceIntro?: boolean;
  voice?: string;
  transcript: TranscriptSegment[];
  onProgress?: ProgressFn;
}

export interface ExportResult {
  mp4FileName: string;
  srtFileName: string;
  burned: boolean;
  engine: 'ffmpeg' | 'hyperframes';
  warning?: string;
}

/**
 * Export a clip. Animated captions, hook titles and voice intros go through HyperFrames;
 * everything else (and any HyperFrames failure) uses the plain FFmpeg path with ASS captions.
 */
export async function exportClipWithFfmpeg(params: ExportParams): Promise<ExportResult> {
  const { clipId, start, end, aspectRatio, transcript, captionStyle, burnCaptions } = params;
  const progress = params.onProgress ?? (() => {});
  const stamp = Date.now();
  const safeAspect = aspectRatio.replace(':', 'x');
  const mp4FileName = `clipforge_${clipId}_${safeAspect}_${stamp}.mp4`;
  const srtFileName = `clipforge_${clipId}_${safeAspect}_${stamp}.srt`;
  const mp4OutPath = path.join(EXPORTS_DIR, mp4FileName);

  // Always write a standalone SRT file
  fs.writeFileSync(path.join(EXPORTS_DIR, srtFileName), buildSrtContent(transcript, start, end), 'utf-8');

  const animatedCaps = burnCaptions && (captionStyle === 'karaoke' || captionStyle === 'pop');
  const wantsHyperframes = animatedCaps || Boolean(params.hookTitle) || Boolean(params.voiceIntro);
  let warning: string | undefined;

  if (wantsHyperframes && hyperframesInstalled()) {
    try {
      const burned = await exportWithHyperframes(params, mp4OutPath, stamp, progress);
      return { mp4FileName, srtFileName, burned, engine: 'hyperframes' };
    } catch (err) {
      warning = `HyperFrames render failed, used FFmpeg instead: ${(err as Error).message}`;
      console.warn('[clipforge]', warning);
    }
  } else if (wantsHyperframes) {
    warning = 'HyperFrames not installed — exported with FFmpeg captions (no hook title / voice intro).';
  }

  progress('encode', 'Encoding with FFmpeg', 20);
  const burned = await exportPlainFfmpeg(params, mp4OutPath, stamp);
  progress('done', 'Export ready', 100);
  return { mp4FileName, srtFileName, burned, engine: 'ffmpeg', warning };
}

async function exportPlainFfmpeg(params: ExportParams, mp4OutPath: string, stamp: number): Promise<boolean> {
  const { sourcePath, metadata, clipId, start, end, aspectRatio, cropX, cropY = 50, zoom = 1, framing = 'fill' } = params;
  const { captionStyle, burnCaptions, transcript } = params;
  const [W, H] = frameSize(aspectRatio, metadata.width);
  const filters = framingFilters(W, H, cropX, cropY, zoom, framing);

  let tempAssPath: string | null = null;
  if (assSupport === null) assSupport = await ffmpegHasFilter('ass');
  if (burnCaptions && !assSupport) {
    console.warn('[clipforge] ffmpeg has no libass — exporting clip with SRT sidecar instead of burned captions.');
  }
  if (assSupport && burnCaptions && captionStyle !== 'off' && transcript.length > 0) {
    tempAssPath = path.join(TEMP_DIR, `subs_${clipId}_${stamp}.ass`);
    fs.writeFileSync(tempAssPath, buildAssContent(transcript, start, end, W, H, captionStyle), 'utf-8');
    // Relative path inside cwd so the ffmpeg filter parser never chokes on drive-letter colons
    filters.push(`ass=${path.relative(process.cwd(), tempAssPath).replace(/\\/g, '/')}`);
  }

  const args = ['-y', '-ss', start.toFixed(3), '-t', Math.max(1, end - start).toFixed(3), '-i', sourcePath, '-vf', filters.join(','), ...videoCodecArgs()];
  if (metadata.hasAudio) args.push('-c:a', 'aac', '-b:a', '256k', '-ar', '48000');
  else args.push('-an');
  args.push('-movflags', '+faststart', mp4OutPath);

  try {
    await execFileAsync('ffmpeg', args, { cwd: process.cwd(), maxBuffer: 1024 * 1024 * 10 });
  } finally {
    if (tempAssPath) fs.rmSync(tempAssPath, { force: true });
  }
  return Boolean(tempAssPath);
}

async function exportWithHyperframes(params: ExportParams, mp4OutPath: string, stamp: number, progress: ProgressFn): Promise<boolean> {
  const { sourcePath, metadata, clipId, start, end, aspectRatio, cropX, cropY = 50, zoom = 1, framing = 'fill' } = params;
  const { captionStyle, burnCaptions, transcript } = params;
  const [W, H] = frameSize(aspectRatio, metadata.width);
  const clipDuration = Math.max(1, end - start);
  const dir = path.join(TEMP_DIR, `hf_${clipId}_${stamp}`);
  fs.mkdirSync(dir, { recursive: true });

  try {
    // 1. FFmpeg: crop/fit/zoom the footage to the target frame (no captions) — HyperFrames layers on top
    progress('frame', 'Framing footage with FFmpeg', 10);
    const base = path.join(dir, 'base.mp4');
    const baseArgs = ['-y', '-ss', start.toFixed(3), '-t', clipDuration.toFixed(3), '-i', sourcePath, '-vf', framingFilters(W, H, cropX, cropY, zoom, framing).join(','),
      '-r', '30', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '14', '-pix_fmt', 'yuv420p', '-g', '15'];
    if (metadata.hasAudio) baseArgs.push('-c:a', 'aac', '-b:a', '256k', '-ar', '48000');
    else baseArgs.push('-an');
    await execFileAsync('ffmpeg', [...baseArgs, base], { maxBuffer: 1024 * 1024 * 10 });

    // 2. Optional spoken intro (Kokoro TTS → OS voice fallback)
    let introWav: string | null = null;
    let introDuration = 0;
    let hasIntroBg = false;
    if (params.voiceIntro && params.title) {
      progress('voice', 'Generating voice intro (TTS)', 25);
      introWav = path.join(dir, 'intro.wav');
      await speak(params.title, introWav, params.voice);
      introDuration = Math.min(8, (await audioDuration(introWav)) + 0.5);
      await execFileAsync('ffmpeg', ['-y', '-ss', '0.5', '-i', base, '-frames:v', '1', '-q:v', '3', path.join(dir, 'intro_bg.jpg')]).catch(() => {});
      hasIntroBg = fs.existsSync(path.join(dir, 'intro_bg.jpg'));
    }

    // 3. HyperFrames: render captions / hook title / intro card over the footage
    progress('render', 'Rendering motion captions with HyperFrames', 35);
    const words =
      burnCaptions && captionStyle !== 'off'
        ? transcript
            .filter((s) => s.end > start && s.start < end)
            .flatMap(segmentWords)
            .filter((w) => w.end > start && w.start < end)
            .map((w) => ({ text: w.text, start: Math.max(0, w.start - start), end: Math.min(clipDuration, w.end - start) }))
        : [];
    const html = buildCompositionHtml({
      width: W,
      height: H,
      clipDuration,
      introDuration,
      words,
      captionStyle: burnCaptions ? captionStyle : 'off',
      title: params.title || '',
      hookTitle: Boolean(params.hookTitle),
      hasIntroBg,
    });
    const rendered = path.join(dir, 'rendered.mp4');
    await renderComposition(dir, html, rendered);

    // 4. FFmpeg: put the original-quality audio back (+ intro voice), copy the rendered video
    progress('mux', 'Mixing audio with FFmpeg', 90);
    const total = introDuration + clipDuration;
    const args = ['-y', '-i', rendered, '-i', base];
    if (introWav) args.push('-i', introWav);
    const delayMs = Math.round(introDuration * 1000);
    if (metadata.hasAudio && introWav) {
      args.push('-filter_complex', `[1:a]adelay=${delayMs}:all=1[m];[2:a]aresample=48000[v];[v][m]amix=inputs=2:duration=longest:normalize=0[a]`, '-map', '0:v', '-map', '[a]');
    } else if (metadata.hasAudio) {
      args.push('-map', '0:v', '-map', '1:a');
    } else if (introWav) {
      args.push('-map', '0:v', '-map', '2:a');
    } else {
      args.push('-map', '0:v');
    }
    args.push('-c:v', 'copy');
    if (metadata.hasAudio || introWav) args.push('-c:a', 'aac', '-b:a', '256k', '-ar', '48000');
    args.push('-t', total.toFixed(3), '-movflags', '+faststart', mp4OutPath);
    await execFileAsync('ffmpeg', args, { maxBuffer: 1024 * 1024 * 10 });
    progress('done', 'Export ready', 100);
    return words.length > 0;
  } finally {
    if (!process.env.HYPERFRAMES_KEEP_TEMP) fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Browsers stutter on HEVC/AV1/VP9, 4K, high-bitrate or >30fps-variable files.
 * When needed, make a 1080p H.264 preview proxy for the studio player.
 * Exports always use the original file, so output quality is untouched.
 */
export async function ensurePreviewProxy(sourcePath: string, meta: VideoMetadata): Promise<string | null> {
  const bitrate = meta.duration ? (meta.sizeBytes * 8) / meta.duration : 0;
  const needs = meta.codec !== 'h264' || meta.height > 1080 || meta.fps > 60 || bitrate > 12_000_000;
  if (!needs) return null;
  const out = sourcePath.replace(/\.[^.]+$/, '') + '_preview.mp4';
  if (fs.existsSync(out)) return out;
  await execFileAsync(
    'ffmpeg',
    ['-y', '-i', sourcePath, '-vf', "scale=-2:'min(1080,ih)'", '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
     '-g', '30', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out],
    { maxBuffer: 1024 * 1024 * 10 }
  );
  return out;
}
