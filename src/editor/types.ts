/**
 * ClipForge editor model — shared by the editor UI, the Remotion composition and the server.
 * All times are in SECONDS (converted to frames inside the composition).
 */
export interface EditWord {
  text: string;
  start: number; // seconds, relative to the captions item start
  end: number;
}

interface BaseItem {
  id: string;
  track: number; // 0 = bottom layer; higher tracks draw on top
  from: number; // start on the timeline (s)
  duration: number; // length on the timeline (s)
  name?: string;
}

export interface VideoItem extends BaseItem {
  kind: 'video';
  src: string; // original file URL (used for the final render)
  previewSrc?: string; // lighter proxy for the in-browser player
  sourceStart: number; // trim: seconds into the source file
  volume: number; // 0-2
  fit: 'cover' | 'contain';
  zoom: number; // 1-3
  panX: number; // 0-100
  panY: number; // 0-100
}

export interface AudioItem extends BaseItem {
  kind: 'audio';
  src: string;
  sourceStart: number;
  volume: number;
}

export interface ImageItem extends BaseItem {
  kind: 'image';
  src: string;
  fit: 'cover' | 'contain';
  scale: number; // 0.1-2 (1 = full frame width)
  x: number; // 0-100 horizontal position (centre)
  y: number; // 0-100 vertical position (centre, or feet when anchor = bottom)
  anchor?: 'center' | 'bottom';
  motion?: SpriteMotion;
  flip?: boolean; // mirror horizontally (characters face right by default)
  depth?: number; // 0 (far, moves little with the camera) … 1.4 (near, moves most)
  assetId?: string;
}

export type SpriteMotion = 'none' | 'pop' | 'walkIn' | 'walkOut' | 'walkAcross' | 'bob' | 'sway' | 'float' | 'fly' | 'breathe' | 'slideUp' | 'kenBurns';

export type TemplateId =
  | 'title'
  | 'hook'
  | 'lowerThird'
  | 'emojiPop'
  | 'progressBar'
  | 'cta'
  | 'quote'
  // Vox-style explainer graphics
  | 'paperTitle'
  | 'markerHighlight'
  | 'stat'
  | 'barChart'
  | 'callout'
  // Art-style motion graphics (Madhubani, ink wash, Warli, ukiyo-e …)
  | 'artCard'
  | 'artFrame'
  | 'artBanner';

export interface TextItem extends BaseItem {
  kind: 'text';
  template: TemplateId;
  props: Record<string, string | number | boolean>;
}

export type CaptionLook = 'karaoke' | 'pop' | 'bold' | 'clean';

export interface CaptionsItem extends BaseItem {
  kind: 'captions';
  words: EditWord[];
  look: CaptionLook;
  position: 'bottom' | 'middle' | 'top';
  accent: string;
}

export type EffectId =
  | 'zoomPunch'
  | 'shake'
  | 'flash'
  | 'fadeIn'
  | 'fadeOut'
  | 'slowZoom'
  // 2.5D camera moves: layers move by their depth, giving parallax
  | 'pushIn'
  | 'pullOut'
  | 'panLeft'
  | 'panRight'
  | 'tiltUp'
  // scene hand-off transitions
  | 'whipPan'
  | 'irisWipe';

export interface EffectItem extends BaseItem {
  kind: 'effect';
  effect: EffectId;
  intensity: number; // 0.2-2
}

export type EditItem = VideoItem | AudioItem | ImageItem | TextItem | CaptionsItem | EffectItem;
export type ItemKind = EditItem['kind'];

export interface EditExport {
  fileName: string;
  url: string;
  createdAt: string;
}

export interface EditProject {
  id: string;
  name: string;
  width: number;
  height: number;
  fps: number;
  background: string;
  items: EditItem[];
  sourceProjectId?: string;
  sourceClipId?: string;
  exports?: EditExport[];
  createdAt: string;
  updatedAt: string;
}

/** Props passed to the Remotion composition. assetBase is '' in the browser, http://localhost:PORT when rendering. */
export interface CompositionProps {
  edit: EditProject;
  assetBase: string;
  preview: boolean;
  [key: string]: unknown;
}

export const BRAND = {
  mint: '#B5E2DD',
  pink: '#F4C7D6',
  lavender: '#D8CCE8',
  peach: '#FBDFCB',
  yellow: '#FFE44D',
  black: '#000000',
};

export function editDuration(edit: EditProject): number {
  return Math.max(1, ...edit.items.map((i) => i.from + i.duration));
}

export const FRAME_SIZES: Record<string, [number, number]> = {
  '9:16': [1080, 1920],
  '1:1': [1080, 1080],
  '16:9': [1920, 1080],
  '4:5': [1080, 1350],
};
