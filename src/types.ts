export type AspectRatio = '9:16' | '1:1' | '16:9';
export type Framing = 'fill' | 'fit';
export type CaptionStyle = 'off' | 'clean' | 'highlight' | 'karaoke' | 'pop';
export type ClipLengthPreset = 'auto' | 'short' | 'medium' | 'long';
export type AppTab = 'home' | 'studio' | 'script' | 'editor' | 'library' | 'architecture';

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
}

export interface JobProgress {
  stage: string;
  label: string;
  pct: number;
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
