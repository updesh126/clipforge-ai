export type AspectRatio = '9:16' | '1:1' | '16:9';
export type Framing = 'fill' | 'fit';
export type CaptionStyle = 'off' | 'clean' | 'highlight' | 'karaoke' | 'pop' | 'creator' | 'chalk' | 'cleantech';
/** Caption styles drawn in the Nafay looks (Creator Motion Graphics, Chalk Talk, Clean Tech). */
export const STYLED_CAPTIONS: readonly CaptionStyle[] = ['creator', 'chalk', 'cleantech'];
export type ClipLengthPreset = 'auto' | 'short' | 'medium' | 'long';
export type AppTab = 'home' | 'studio' | 'script' | 'writer' | 'editor' | 'library' | 'architecture' | 'docs';

export interface WordTiming {
  text: string;
  start: number;
  end: number;
}

export interface TranscriptSegment {
  id: string;
  start: number;
  end: number;
  text: string;
  speaker?: string;
  words?: WordTiming[];
}

export interface EngineStatus {
  ffmpeg: boolean;
  libass: boolean;
  whisper: boolean;
  whisperModel: boolean;
  whisperName: string;
  ollama: boolean;
  ollamaModel: string;
  ollamaModelInstalled: boolean;
  hyperframes: boolean;
  tts: boolean;
  voices: Array<{ id: string; label: string; language: string; gender: string }>;
  /** local Stable Diffusion (ComfyUI) running with a checkpoint */
  sd?: boolean;
  sdRunning?: boolean;
  sdModel?: string | null;
  sdUrl?: string;
  /** ComfyUI found on disk (ClipForge starts it automatically) */
  sdInstalled?: boolean;
  /** LTX-Video checkpoint for image-to-video (moving scenes), when installed */
  sdVideo?: string | null;
  /** installed Motion engines: ltx (fast), wan (best) */
  sdVideoEngines?: Array<'ltx' | 'wan'>;
}

export interface JobProgress {
  stage: string;
  label: string;
  pct: number;
  /** visual progress for AI-painted videos (live preview, finished scenes, counts) */
  media?: {
    preview?: string;
    scenes?: string[];
    sceneIndex?: number;
    sceneTotal?: number;
    aspect?: string;
    step?: number;
    steps?: number;
    motionScenes?: boolean[];
  };
}

export interface ExportedClipFile {
  aspectRatio: AspectRatio;
  fileName: string;
  url: string;
  srtUrl: string;
  createdAt: string;
  burnedCaptions: boolean;
  engine?: 'ffmpeg' | 'hyperframes';
}

export interface ClipCandidate {
  id: string;
  title: string;
  hookLine: string;
  reason: string;
  category: string;
  score?: number; // 0-100 predicted virality
  start: number;
  end: number;
  aspectRatio: AspectRatio;
  cropX: number;
  cropY?: number; // 0-100 vertical pan
  zoom?: number; // 1-3x
  framing?: Framing; // fill = crop to frame, fit = whole video on blurred background
  captionStyle: CaptionStyle;
  hookTitle?: boolean; // animated title banner over the opening seconds (HyperFrames)
  voiceIntro?: boolean; // spoken title card before the clip (TTS)
  styleCards?: boolean; // intro + outro cards drawn in the caption's style (creator / chalk / cleantech)
  outroText?: string; // end-card line, default "Follow for more"
  voice?: string;
  exportedFiles?: ExportedClipFile[];
}

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
  sizeBytes: number;
  codec: string;
}

export interface ClipProject {
  id: string;
  name: string;
  sourceType?: 'local' | 'youtube-local' | 'youtube-embed';
  youtubeUrl?: string;
  youtubeVideoId?: string;
  sourceFileName: string;
  videoUrl: string;
  status: 'processing' | 'ready' | 'error';
  errorMessage?: string;
  summary: string;
  clipLengthPreset: ClipLengthPreset;
  metadata: VideoMetadata;
  transcript: TranscriptSegment[];
  clips: ClipCandidate[];
  createdAt: string;
  updatedAt: string;
}
