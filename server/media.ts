import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import type { AspectRatio, CaptionStyle, Framing, TranscriptSegment, VideoMetadata } from './types.ts';
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

export function buildAssContent(
  transcript: TranscriptSegment[],
  clipStart: number,
  clipEnd: number,
  resX: number,
  resY: number,
  captionStyle: CaptionStyle
): string {
  const isHighlight = captionStyle === 'highlight';
  const fontSize = resX < 1000 ? 46 : resX === resY ? 48 : 42;
  const marginV = resY > resX ? 280 : 72;
  const primaryColour = isHighlight ? '&H0000E5FF' : '&H00FFFFFF';
  const outline = isHighlight ? 3.5 : 2.5;

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${resX}
PlayResY: ${resY}
WrapStyle: 1

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,DejaVu Sans,${fontSize},${primaryColour},&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,${outline},1,2,48,48,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const overlapping = transcript.filter((seg) => seg.end > clipStart && seg.start < clipEnd);
  const events = overlapping
    .map((seg) => {
      const startRel = Math.max(0, seg.start - clipStart);
      const endRel = Math.min(clipEnd - clipStart, seg.end - clipStart);
      const cleanText = escapeAssText(seg.text.trim());
      return `Dialogue: 0,${formatAssTime(startRel)},${formatAssTime(Math.max(startRel + 0.4, endRel))},Default,,0,0,0,,${cleanText}`;
    })
    .join('\n');

  return header + events + '\n';
}

export async function renderDemoMp4FromAudio(audioWavPath: string, outMp4Path: string): Promise<void> {
  // Build a clean pure-black studio video with animated waveform + minimal title overlay
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

export async function exportClipWithFfmpeg(params: {
  sourcePath: string;
  metadata: VideoMetadata;
  clipId: string;
  start: number;
  end: number;
  aspectRatio: AspectRatio;
  cropX: number;
  cropY?: number;
  zoom?: number;
  framing?: Framing;
  captionStyle: CaptionStyle;
  burnCaptions: boolean;
  transcript: TranscriptSegment[];
}): Promise<{ mp4FileName: string; srtFileName: string; burned: boolean }> {
  const {
    sourcePath,
    metadata,
    clipId,
    start,
    end,
    aspectRatio,
    cropX,
    cropY = 50,
    zoom = 1,
    framing = 'fill',
    captionStyle,
    burnCaptions,
    transcript,
  } = params;

  const duration = Math.max(1, end - start);
  const stamp = Date.now();
  const safeAspect = aspectRatio.replace(':', 'x');
  const mp4FileName = `clipforge_${clipId}_${safeAspect}_${stamp}.mp4`;
  const srtFileName = `clipforge_${clipId}_${safeAspect}_${stamp}.srt`;
  const mp4OutPath = path.join(EXPORTS_DIR, mp4FileName);
  const srtOutPath = path.join(EXPORTS_DIR, srtFileName);

  // Always write standalone watermark-free SRT file
  const srtContent = buildSrtContent(transcript, start, end);
  fs.writeFileSync(srtOutPath, srtContent, 'utf-8');

  // Target frame size: 1080p for social formats, source size (even) for 16:9
  const even = (n: number) => Math.max(2, Math.floor(n / 2) * 2);
  let targetW: number;
  let targetH: number;
  if (aspectRatio === '9:16') [targetW, targetH] = [1080, 1920];
  else if (aspectRatio === '1:1') [targetW, targetH] = [1080, 1080];
  else [targetW, targetH] = [even(Math.max(metadata.width, 1920)), even((Math.max(metadata.width, 1920) * 9) / 16)];

  const W = targetW;
  const H = targetH;
  const z = Math.min(3, Math.max(1, Number(zoom) || 1));
  const fx = Math.min(1, Math.max(0, cropX / 100)).toFixed(3);
  const fy = Math.min(1, Math.max(0, cropY / 100)).toFixed(3);
  const ZW = even(W * z);
  const ZH = even(H * z);
  const filters: string[] = [];

  if (framing === 'fit') {
    // Whole video visible, centred on a blurred, dimmed fill of itself (no black bars)
    filters.push(
      `split=2[bg][fg];` +
        `[bg]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=luma_radius=40:luma_power=2,eq=brightness=-0.12[bgb];` +
        `[fg]scale=${ZW}:${ZH}:force_original_aspect_ratio=decrease:flags=lanczos,` +
        `crop='min(iw,${W})':'min(ih,${H})':'(iw-ow)*${fx}':'(ih-oh)*${fy}'[fgc];` +
        `[bgb][fgc]overlay=(W-w)/2:(H-h)/2,setsar=1`
    );
  } else {
    // Fill the frame: scale to cover (times zoom), then pan the crop window
    filters.push(
      `scale=${ZW}:${ZH}:force_original_aspect_ratio=increase:flags=lanczos`,
      `crop=${W}:${H}:'(iw-ow)*${fx}':'(ih-oh)*${fy}'`,
      'setsar=1'
    );
  }

  let tempAssPath: string | null = null;
  if (assSupport === null) assSupport = await ffmpegHasFilter('ass');
  if (burnCaptions && !assSupport) {
    console.warn('[clipforge] ffmpeg has no libass — exporting clip with SRT sidecar instead of burned captions.');
  }
  if (assSupport && burnCaptions && captionStyle !== 'off' && transcript.length > 0) {
    const assName = `subs_${clipId}_${stamp}.ass`;
    tempAssPath = path.join(TEMP_DIR, assName);
    const assContent = buildAssContent(transcript, start, end, targetW, targetH, captionStyle);
    fs.writeFileSync(tempAssPath, assContent, 'utf-8');
    // Use relative path inside cwd so ffmpeg filter parser never chokes on colons
    const relAss = path.relative(process.cwd(), tempAssPath).replace(/\\/g, '/');
    filters.push(`ass=${relAss}`);
  }

  const args = [
    '-y',
    '-ss',
    start.toFixed(3),
    '-t',
    duration.toFixed(3),
    '-i',
    sourcePath,
    '-vf',
    filters.join(','),
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

  if (metadata.hasAudio) {
    args.push('-c:a', 'aac', '-b:a', '256k', '-ar', '48000');
  } else {
    args.push('-an');
  }

  args.push('-movflags', '+faststart', mp4OutPath);

  try {
    await execFileAsync('ffmpeg', args, { cwd: process.cwd(), maxBuffer: 1024 * 1024 * 10 });
  } finally {
    if (tempAssPath && fs.existsSync(tempAssPath)) {
      try {
        fs.unlinkSync(tempAssPath);
      } catch {
        // ignore cleanup error
      }
    }
  }

  return { mp4FileName, srtFileName, burned: Boolean(tempAssPath) };
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
