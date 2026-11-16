/** Template + effect catalogue: defaults and editable fields. Shared by the UI, the LLM prompt and the server. */
import type { EffectId, TemplateId } from './types.ts';

/** Art styles for the art templates (ids must match src/remotion/artStyles.tsx). */
export const ART_STYLE_OPTIONS = ['madhubani', 'inkWash', 'shadowPuppet', 'paperCutout', 'stainedGlass', 'anime', 'warli', 'blueprint', 'ukiyoe', 'miniature'];
export const ART_STYLE_LABELS: Record<string, string> = {
  madhubani: 'Madhubani',
  inkWash: 'Ink wash',
  shadowPuppet: 'Shadow puppet',
  paperCutout: 'Paper cutout',
  stainedGlass: 'Stained glass',
  anime: 'Anime',
  warli: 'Warli',
  blueprint: 'Blueprint',
  ukiyoe: 'Ukiyo-e',
  miniature: 'Miniature painting',
};

export interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'color' | 'select';
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
}

export const TEMPLATES: Record<TemplateId, { label: string; description: string; duration: number; defaults: Record<string, string | number>; fields: FieldDef[] }> = {
  title: {
    label: 'Animated title',
    description: 'Big centred title, words spring in one by one',
    duration: 3,
    defaults: { text: 'Your big idea', subtitle: '', color: '#ffffff', accent: '#B5E2DD', size: 1 },
    fields: [
      { key: 'text', label: 'Text', type: 'text' },
      { key: 'subtitle', label: 'Subtitle', type: 'text' },
      { key: 'color', label: 'Colour', type: 'color' },
      { key: 'accent', label: 'Accent', type: 'color' },
      { key: 'size', label: 'Size', type: 'number', min: 0.4, max: 2, step: 0.05 },
    ],
  },
  hook: {
    label: 'Hook banner',
    description: 'White banner at the top for the first seconds',
    duration: 3.5,
    defaults: { text: 'Nobody tells you this…', bg: '#ffffff', color: '#000000', accent: '#B5E2DD' },
    fields: [
      { key: 'text', label: 'Text', type: 'text' },
      { key: 'bg', label: 'Background', type: 'color' },
      { key: 'color', label: 'Text colour', type: 'color' },
      { key: 'accent', label: 'Accent', type: 'color' },
    ],
  },
  lowerThird: {
    label: 'Lower third',
    description: 'Name and role slide in at the bottom left',
    duration: 4,
    defaults: { name: 'Speaker name', role: 'Role, Company', accent: '#B5E2DD' },
    fields: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'role', label: 'Role', type: 'text' },
      { key: 'accent', label: 'Accent', type: 'color' },
    ],
  },
  emojiPop: {
    label: 'Emoji pop',
    description: 'Bouncy emoji sticker',
    duration: 1.5,
    defaults: { emoji: '🔥', x: 75, y: 30, size: 1 },
    fields: [
      { key: 'emoji', label: 'Emoji', type: 'text' },
      { key: 'x', label: 'X %', type: 'number', min: 0, max: 100, step: 1 },
      { key: 'y', label: 'Y %', type: 'number', min: 0, max: 100, step: 1 },
      { key: 'size', label: 'Size', type: 'number', min: 0.3, max: 3, step: 0.05 },
    ],
  },
  progressBar: {
    label: 'Progress bar',
    description: 'Brand gradient bar that fills over the item',
    duration: 10,
    defaults: { position: 'top' },
    fields: [{ key: 'position', label: 'Position', type: 'select', options: ['top', 'bottom'] }],
  },
  cta: {
    label: 'Call to action',
    description: 'End card with a pulsing handle button',
    duration: 2.5,
    defaults: { text: 'Follow for more', button: '@yourhandle', accent: '#B5E2DD' },
    fields: [
      { key: 'text', label: 'Text', type: 'text' },
      { key: 'button', label: 'Button', type: 'text' },
      { key: 'accent', label: 'Accent', type: 'color' },
    ],
  },
  quote: {
    label: 'Quote card',
    description: 'Typewriter quote on a dark card',
    duration: 4,
    defaults: { text: 'Captions are not optional.', author: '', accent: '#D8CCE8' },
    fields: [
      { key: 'text', label: 'Quote', type: 'text' },
      { key: 'author', label: 'Author', type: 'text' },
      { key: 'accent', label: 'Accent', type: 'color' },
    ],
  },
  paperTitle: {
    label: 'Paper title (Vox)',
    description: 'Torn-paper headline card with a marker underline',
    duration: 3.5,
    defaults: { text: 'Why this matters', kicker: 'Explained', accent: '#F2C14E', tilt: -2 },
    fields: [
      { key: 'text', label: 'Headline', type: 'text' },
      { key: 'kicker', label: 'Kicker', type: 'text' },
      { key: 'accent', label: 'Underline', type: 'color' },
      { key: 'tilt', label: 'Tilt°', type: 'number', min: -8, max: 8, step: 0.5 },
    ],
  },
  markerHighlight: {
    label: 'Marker highlight (Vox)',
    description: 'Document excerpt with a highlighter sweep over the key phrase',
    duration: 4.5,
    defaults: { source: 'Industry report, 2026', before: 'According to the report,', highlight: '85% of viewers watch on mute', after: 'so captions decide reach.', color: '#FFE44D' },
    fields: [
      { key: 'source', label: 'Source', type: 'text' },
      { key: 'before', label: 'Text before', type: 'text' },
      { key: 'highlight', label: 'Highlighted', type: 'text' },
      { key: 'after', label: 'Text after', type: 'text' },
      { key: 'color', label: 'Marker', type: 'color' },
    ],
  },
  stat: {
    label: 'Counting stat (Vox)',
    description: 'Big number counts up with a label',
    duration: 3,
    defaults: { value: 85, prefix: '', suffix: '%', label: 'of viewers watch on mute', accent: '#B5E2DD' },
    fields: [
      { key: 'value', label: 'Value', type: 'number', min: -1e9, max: 1e9, step: 1 },
      { key: 'prefix', label: 'Prefix', type: 'text' },
      { key: 'suffix', label: 'Suffix', type: 'text' },
      { key: 'label', label: 'Label', type: 'text' },
      { key: 'accent', label: 'Colour', type: 'color' },
    ],
  },
  barChart: {
    label: 'Bar chart (Vox)',
    description: 'Bars grow one by one from Label:value pairs',
    duration: 4.5,
    defaults: { title: 'Average watch time', data: 'TikTok:92, Reels:78, Shorts:64', unit: '%', accent: '#B5E2DD' },
    fields: [
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'data', label: 'Data (A:1, B:2)', type: 'text' },
      { key: 'unit', label: 'Unit', type: 'text' },
      { key: 'accent', label: 'Lead colour', type: 'color' },
    ],
  },
  callout: {
    label: 'Callout circle (Vox)',
    description: 'Hand-drawn circle and arrow pointing at something on screen',
    duration: 2.5,
    defaults: { text: 'Look here', x: 50, y: 40, size: 1, color: '#FF5A36' },
    fields: [
      { key: 'text', label: 'Label', type: 'text' },
      { key: 'x', label: 'X %', type: 'number', min: 0, max: 100, step: 1 },
      { key: 'y', label: 'Y %', type: 'number', min: 0, max: 100, step: 1 },
      { key: 'size', label: 'Size', type: 'number', min: 0.3, max: 3, step: 0.05 },
      { key: 'color', label: 'Colour', type: 'color' },
    ],
  },
  artCard: {
    label: 'Art title card',
    description: 'Full-screen animated art scene with a title (choose the style)',
    duration: 4,
    defaults: { style: 'madhubani', text: 'Your title', subtitle: '', position: 'auto', size: 1, dim: 0 },
    fields: [
      { key: 'style', label: 'Art style', type: 'select', options: ART_STYLE_OPTIONS },
      { key: 'text', label: 'Title', type: 'text' },
      { key: 'subtitle', label: 'Subtitle', type: 'text' },
      { key: 'position', label: 'Title position', type: 'select', options: ['auto', 'center', 'top', 'bottom'] },
      { key: 'size', label: 'Title size', type: 'number', min: 0.4, max: 2, step: 0.05 },
      { key: 'dim', label: 'Dim backdrop', type: 'number', min: 0, max: 0.9, step: 0.05 },
    ],
  },
  artFrame: {
    label: 'Art frame',
    description: 'Animated decorative border in an art style, over your footage',
    duration: 6,
    defaults: { style: 'madhubani', opacity: 1 },
    fields: [
      { key: 'style', label: 'Art style', type: 'select', options: ART_STYLE_OPTIONS },
      { key: 'opacity', label: 'Opacity', type: 'number', min: 0.1, max: 1, step: 0.05 },
    ],
  },
  artBanner: {
    label: 'Art caption banner',
    description: 'Text banner styled in an art style',
    duration: 4,
    defaults: { style: 'madhubani', text: 'Your caption here', position: 'bottom', size: 1 },
    fields: [
      { key: 'style', label: 'Art style', type: 'select', options: ART_STYLE_OPTIONS },
      { key: 'text', label: 'Text', type: 'text' },
      { key: 'position', label: 'Position', type: 'select', options: ['bottom', 'top'] },
      { key: 'size', label: 'Size', type: 'number', min: 0.5, max: 2.5, step: 0.05 },
    ],
  },
};

export const EFFECTS: Record<EffectId, { label: string; description: string; duration: number }> = {
  zoomPunch: { label: 'Zoom punch', description: 'Quick punch-in on the video, then hold', duration: 1.2 },
  slowZoom: { label: 'Slow zoom', description: 'Gentle Ken Burns push-in', duration: 5 },
  shake: { label: 'Shake', description: 'Camera shake for impact', duration: 0.5 },
  flash: { label: 'Flash', description: 'White flash transition', duration: 0.4 },
  fadeIn: { label: 'Fade in', description: 'Fade from black', duration: 0.8 },
  fadeOut: { label: 'Fade out', description: 'Fade to black', duration: 0.8 },
  pushIn: { label: 'Camera push in', description: '2.5D dolly towards the scene (parallax by layer depth)', duration: 5 },
  pullOut: { label: 'Camera pull out', description: '2.5D dolly away from the scene', duration: 5 },
  panLeft: { label: 'Camera pan left', description: 'Camera slides left; near layers move more', duration: 5 },
  panRight: { label: 'Camera pan right', description: 'Camera slides right; near layers move more', duration: 5 },
  tiltUp: { label: 'Camera tilt up', description: 'Camera rises to reveal the sky', duration: 5 },
  whipPan: { label: 'Whip pan', description: 'Fast blurred swipe — place it across a scene cut', duration: 0.5 },
  irisWipe: { label: 'Iris wipe', description: 'Ink circle closes and opens — place it across a scene cut', duration: 0.8 },
};
