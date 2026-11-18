/**
 * Style painter: maps an asset's semantic colours onto an art style
 * (Warli → white on earth red, shadow puppet → black silhouettes, blueprint → white line art, …).
 */
export interface Paint {
  style: string;
  fill: (c: string) => string; // colour of a filled shape
  stroke: string;
  sw: number; // stroke width in 512-unit space
  bg: (c: string) => string; // colour of large background areas
  envStroke?: string; // outline for background elements (line-art styles)
  lineArt: boolean; // shapes drawn as outlines only
  silhouette: boolean; // shadow puppet
  perforate: boolean; // shadow puppet holes
  hatch: boolean; // madhubani hatching
  shadow: boolean; // paper cutout drop shadow
  blur: boolean; // ink wash softness
  gold?: string; // miniature accents
}

const hex = (c: string) => {
  const m = c.replace('#', '').match(/^([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return [128, 128, 128];
  const s = m[1].length === 3 ? m[1].split('').map((x) => x + x).join('') : m[1];
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
};

function nearest(c: string, palette: string[]): string {
  const [r, g, b] = hex(c);
  let best = palette[0];
  let bd = Infinity;
  for (const p of palette) {
    const [pr, pg, pb] = hex(p);
    // weighted RGB distance keeps hue families together reasonably well
    const d = 2 * (r - pr) ** 2 + 4 * (g - pg) ** 2 + 3 * (b - pb) ** 2;
    if (d < bd) [best, bd] = [p, d];
  }
  return best;
}

function mix(c: string, to: string, t: number) {
  const a = hex(c);
  const b = hex(to);
  return `#${a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

const grey = (c: string) => {
  const [r, g, b] = hex(c);
  const l = Math.round(0.3 * r + 0.59 * g + 0.11 * b);
  const v = Math.round(30 + (l / 255) * 170);
  return `#${[v, v, v].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
};

const PALETTES: Record<string, string[]> = {
  madhubani: ['#C1272D', '#F4B400', '#2E7D32', '#1F4E9E', '#E86A17', '#F6E7C1', '#111111', '#7B3F99', '#F48FB1'],
  collage: ['#111111', '#3A3A3A', '#6E6E6E', '#9A9A98', '#D9D9D6', '#F7F6F2', '#FFD400'],
  paperCutout: ['#FFADAD', '#FFD6A5', '#FDFFB6', '#CAFFBF', '#9BF6FF', '#A0C4FF', '#BDB2FF', '#FFC6FF', '#6D597A', '#355070', '#FFFFFC', '#2D3047', '#E5989B', '#B5838D'],
  stainedGlass: ['#1E5AA8', '#C0392B', '#E0B53A', '#2E8B57', '#6C3483', '#16A085', '#D35400', '#2471A3', '#F5F0E1', '#5D4037'],
  ukiyoe: ['#1F2A44', '#2F4E7A', '#5C7FA6', '#8FA8C8', '#C8452F', '#B23A2B', '#E0B07A', '#F3E6CC', '#6B7A3A', '#3B2A1A', '#D9C3A0'],
  miniature: ['#8E1B1B', '#D4A537', '#2E6B3A', '#1B3A6B', '#E9A75A', '#F7E3A1', '#5B1A18', '#E8C1C5', '#3B2A1A', '#F6EFE0', '#4A7A8C'],
  anime: ['#FF6B9A', '#FFD166', '#06D6A0', '#118AB2', '#073B4C', '#FFFFFF', '#F4A261', '#8E7DBE', '#EF476F', '#FFE0C4', '#3A2E39', '#A3D5FF'],
};

export function painter(style: string): Paint {
  const base: Paint = {
    style,
    fill: (c) => c,
    stroke: '#2B2B2B',
    sw: 4,
    bg: (c) => c,
    lineArt: false,
    silhouette: false,
    perforate: false,
    hatch: false,
    shadow: false,
    blur: false,
  };
  switch (style) {
    case 'warli':
      return { ...base, fill: () => '#FFFFFF', stroke: '#FFFFFF', sw: 2, bg: (c) => mix('#7A3B22', c, 0.12), envStroke: '#FFFFFF' };
    case 'shadowPuppet':
      return { ...base, fill: () => '#1B0E05', stroke: '#1B0E05', sw: 2, bg: (c) => mix('#FFB347', c, 0.15), silhouette: true, perforate: true };
    case 'blueprint':
      return { ...base, fill: () => 'none', stroke: '#FFFFFF', sw: 3, bg: () => '#0B3D91', lineArt: true, envStroke: '#9CC3FF' };
    case 'inkWash':
      return { ...base, fill: grey, stroke: '#1A1A1A', sw: 3, bg: (c) => mix('#EFEAE0', grey(c), 0.25), blur: true };
    case 'madhubani':
      return { ...base, fill: (c) => nearest(c, PALETTES.madhubani), stroke: '#111111', sw: 6, bg: (c) => mix(nearest(c, PALETTES.madhubani), '#F6E7C1', 0.55), hatch: true };
    case 'collage':
      return { ...base, fill: grey, stroke: '#F7F6F2', sw: 4, bg: (c) => mix('#D9D9D6', grey(c), 0.3), shadow: true };
    case 'paperCutout':
      return { ...base, fill: (c) => nearest(c, PALETTES.paperCutout), stroke: 'none', sw: 0, bg: (c) => nearest(c, PALETTES.paperCutout), shadow: true };
    case 'stainedGlass':
      return { ...base, fill: (c) => nearest(c, PALETTES.stainedGlass), stroke: '#151515', sw: 7, bg: (c) => nearest(c, PALETTES.stainedGlass) };
    case 'ukiyoe':
      return { ...base, fill: (c) => nearest(c, PALETTES.ukiyoe), stroke: '#1F2A44', sw: 3.5, bg: (c) => mix(nearest(c, PALETTES.ukiyoe), '#F3E6CC', 0.35) };
    case 'miniature':
      return { ...base, fill: (c) => nearest(c, PALETTES.miniature), stroke: '#3B2A1A', sw: 2.5, bg: (c) => nearest(c, PALETTES.miniature), gold: '#D4A537' };
    case 'anime':
      return { ...base, fill: (c) => nearest(c, PALETTES.anime), stroke: '#2A1E2E', sw: 5, bg: (c) => mix(nearest(c, PALETTES.anime), '#FFFFFF', 0.15) };
    case 'cartoon':
      return { ...base, fill: (c) => mix(c, '#FFFFFF', 0.04), stroke: '#1D1B1F', sw: 7 };
    case 'storybook':
      return { ...base, fill: (c) => mix(c, '#F3E3C3', 0.15), stroke: '#6B4A35', sw: 3 };
    case 'handDrawn':
      return { ...base, fill: (c) => mix(c, '#FFFFFF', 0.25), stroke: '#2A2622', sw: 3.5, blur: true };
    case 'flatVector':
      return { ...base, stroke: 'none', sw: 0 };
    default:
      // "flat": clean modern vector look
      return { ...base, stroke: '#2B2B2B', sw: 3 };
  }
}

export { mix };
