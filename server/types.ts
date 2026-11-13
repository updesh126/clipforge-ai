export type AspectRatio = '9:16' | '1:1' | '16:9';
export type Framing = 'fill' | 'fit';
export type CaptionStyle = 'off' | 'clean' | 'highlight';
export type ClipLengthPreset = 'auto' | 'short' | 'medium' | 'long';

export interface TranscriptSegment {
  id: string;
  start: number;
  end: number;
  text: string;
  speaker?: string;
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
  cropX: number; // 0 to 100 percentage horizontal pan for portrait/square crop
  cropY?: number; // 0-100 vertical pan
  zoom?: number; // 1-3x
  framing?: Framing; // fill = crop to frame, fit = whole video on blurred background
  captionStyle: CaptionStyle;
  exportedFiles?: {
    aspectRatio: AspectRatio;
    fileName: string;
    url: string;
    srtUrl: string;
    createdAt: string;
    burnedCaptions: boolean;
  }[];
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
