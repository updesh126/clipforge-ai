/** Template + effect catalogue: defaults and editable fields. Shared by the UI, the LLM prompt and the server. */
import type { EffectId, TemplateId } from './types.ts';

/** Art styles for the art templates (ids must match src/remotion/artStyles.tsx). */
export const ART_STYLE_OPTIONS = ['storybook', 'cartoon', 'flatVector', 'handDrawn', 'madhubani', 'inkWash', 'shadowPuppet', 'paperCutout', 'stainedGlass', 'anime', 'warli', 'blueprint', 'ukiyoe', 'miniature'];
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
  storybook: "Children's storybook",
  cartoon: 'Cartoon',
  flatVector: 'Flat vector',
  handDrawn: 'Hand-drawn',
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
  motion: {
    label: 'Motion graphic',
    description: 'Any effect or sequence from the motion graphics library',
    duration: 4,
    defaults: { fx: 'bigStat' },
    fields: [],
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

/** Shown when hovering a style in the picker. */
export interface StyleInfo {
  origin: string;
  look: string;
  bestFor: string;
  palette: string[];
}

export const STYLE_INFO: Record<string, StyleInfo> = {
  auto: { origin: 'ClipForge', look: 'Your local AI reads the script and picks the style that suits the topic.', bestFor: 'When you are not sure — rivers might get ink wash, a village story Warli', palette: ['#B5E2DD', '#D8CCE8', '#F4C7D6', '#FBDFCB'] },
  storybook: { origin: 'ClipForge vector engine', look: 'Procedurally drawn characters and places: soft colours, gentle outlines, paper grain. Same characters in every scene, with real poses and expressions.', bestFor: "Children's stories, fables, moral stories, bedtime tales", palette: ['#F3E3C3', '#E07A5F', '#81B29A', '#3D405B', '#F2CC8F'] },
  cartoon: { origin: 'ClipForge vector engine', look: 'Thick outlines, bright colour, cel shading and big expressive eyes — characters act out each scene.', bestFor: 'Kids content, comedy, energetic explainers', palette: ['#FFE14D', '#FF6B6B', '#4ECDC4', '#1D1B1F', '#A06CD5'] },
  flatVector: { origin: 'ClipForge vector engine', look: 'Clean geometric shapes, no outlines, flat colour — the modern explainer look.', bestFor: 'Business, tech, how-it-works, education', palette: ['#264653', '#2A9D8F', '#E9C46A', '#F4A261', '#E76F51'] },
  handDrawn: { origin: 'ClipForge vector engine', look: 'Wobbly ink lines with a second pencil pass over light watercolour fills.', bestFor: 'Personal stories, journals, gentle documentaries', palette: ['#2A2622', '#FBF7EF', '#A3C4BC', '#E8B4A0', '#BFD7EA'] },
  mix: { origin: 'ClipForge', look: 'Every scene in a different art style, cycling through all ten.', bestFor: 'Showreels, montages, "world of art" pieces', palette: ['#C1272D', '#0B3D91', '#FFB347', '#2E6B3A'] },
  madhubani: { origin: 'Mithila, Bihar (India)', look: 'Bold double outlines, every shape filled with fine hatching; fish, sun and peacock motifs.', bestFor: 'Indian culture, festivals, folk tales, rural life', palette: ['#C1272D', '#F4B400', '#2E7D32', '#1F4E9E', '#F6E7C1'] },
  inkWash: { origin: 'China / Japan (sumi-e)', look: 'Grey brush ink bleeding into rice paper, misty mountains, a small red seal.', bestFor: 'Nature, calm reflection, philosophy, poetry', palette: ['#141414', '#5E5E5A', '#9A9A96', '#EFEAE0', '#B3261E'] },
  shadowPuppet: { origin: 'Tholu Bommalata (India), wayang kulit (Indonesia)', look: 'Perforated black puppets on sticks against a warm, flickering lamp-lit screen.', bestFor: 'Myths, legends, history, dramatic storytelling', palette: ['#1B0E05', '#5A230A', '#FFB347', '#FFE2A8'] },
  paperCutout: { origin: 'Paper craft / diorama', look: 'Layered pastel paper hills and props with soft drop shadows.', bestFor: 'Kids, education, friendly explainers, product stories', palette: ['#FFADAD', '#FFD6A5', '#CAFFBF', '#A0C4FF', '#6D597A'] },
  stainedGlass: { origin: 'Gothic cathedral windows', look: 'Jewel-tone glass pieces in dark leading, glowing with light.', bestFor: 'Heritage, spiritual, grand or celebratory moments', palette: ['#1E5AA8', '#C0392B', '#E0B53A', '#2E8B57', '#6C3483'] },
  anime: { origin: 'Japanese animation', look: 'Speed lines, sparkles, sky gradients and slam-in titles.', bestFor: 'Youth, energy, hype, gaming, launches', palette: ['#3A7BD5', '#B06AB3', '#FF8FAB', '#FFD166'] },
  warli: { origin: 'Warli tribe, Maharashtra (India)', look: 'White stick figures on earth-red — dancing circles, sun, moon, village life.', bestFor: 'Community, farming, sustainability, rural India', palette: ['#7A3B22', '#FFFFFF', '#A0522D'] },
  blueprint: { origin: 'Engineering drawings', look: 'White line art drawn on a blue grid, with dimensions and a title block.', bestFor: 'Tech, product, engineering, how-it-works', palette: ['#0B3D91', '#5C8DD6', '#9CC3FF', '#FFFFFF'] },
  ukiyoe: { origin: 'Edo-period Japan (woodblock prints)', look: 'Rolling Prussian-blue waves, a red sun, flat colour and paper grain.', bestFor: 'Travel, oceans, seasons, Japanese themes', palette: ['#1F2A44', '#5C7FA6', '#C8452F', '#E0B07A', '#F3E6CC'] },
  miniature: { origin: 'Mughal / Rajput courts (India)', look: 'Gold floral border, arched window, cypress trees and jewel colours.', bestFor: 'History, royalty, weddings, luxury, heritage brands', palette: ['#8E1B1B', '#D4A537', '#2E6B3A', '#1B3A6B', '#E9A75A'] },
};
