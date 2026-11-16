/**
 * Theme engine. A theme never changes WHAT is drawn — only HOW: outline weight and colour, hand-drawn wobble,
 * sketchy double lines, curve roundness, shading (cel / soft gradient), paper texture, palette shift,
 * eye rendering and head proportion. Generators draw through a Pen, so every asset obeys the theme.
 */
import { type Pt, ellipsePts, hashString, hexToRgb, mixHex, rgbToHsl, hslToHex, shade, smoothPath, wobble } from './geom.ts';

export type ThemeId = 'storybook' | 'flatVector' | 'handDrawn' | 'cartoon';

export interface Theme {
  id: ThemeId;
  label: string;
  blurb: string;
  outline: number; // × unit; 0 = no outline
  outlineColor: 'auto' | string; // auto = a darker shade of each fill
  jitter: number; // × unit of hand-drawn wobble
  sketch: boolean; // a second, looser pencil line
  tension: number; // curve roundness (0 = polygonal)
  shading: 'none' | 'cel' | 'soft';
  texture: 'none' | 'paper';
  eyes: 'dot' | 'storybook' | 'cartoon';
  headScale: number; // stylised head size
  blush: boolean;
  color: (c: string) => string; // palette shift
}

const hsl = (c: string, dh: number, ds: number, dl: number) => {
  const [h, s, l] = rgbToHsl(hexToRgb(c));
  return hslToHex(h + dh, s * (1 + ds), l + dl);
};

export const THEMES: Record<ThemeId, Theme> = {
  storybook: {
    id: 'storybook',
    label: "Children's storybook",
    blurb: 'Warm, soft gouache colours, gentle brown outlines, paper grain and round friendly faces',
    outline: 0.55,
    outlineColor: 'auto',
    jitter: 0.12,
    sketch: false,
    tension: 0.55,
    shading: 'soft',
    texture: 'paper',
    eyes: 'storybook',
    headScale: 1.14,
    blush: true,
    color: (c) => mixHex(hsl(c, 0, -0.12, 0.03), '#F3E3C3', 0.12),
  },
  flatVector: {
    id: 'flatVector',
    label: 'Flat vector',
    blurb: 'Clean geometric shapes, no outlines, bold flat colour — modern explainer look',
    outline: 0,
    outlineColor: 'auto',
    jitter: 0,
    sketch: false,
    tension: 0.42,
    shading: 'none',
    texture: 'none',
    eyes: 'dot',
    headScale: 1.0,
    blush: false,
    color: (c) => hsl(c, 0, 0.08, 0),
  },
  handDrawn: {
    id: 'handDrawn',
    label: 'Hand-drawn',
    blurb: 'Wobbly ink lines with a pencil pass over light watercolour fills on paper',
    outline: 0.7,
    outlineColor: '#2A2622',
    jitter: 0.55,
    sketch: true,
    tension: 0.48,
    shading: 'none',
    texture: 'paper',
    eyes: 'dot',
    headScale: 1.05,
    blush: false,
    color: (c) => mixHex(hsl(c, 0, -0.2, 0.08), '#FFFFFF', 0.12),
  },
  cartoon: {
    id: 'cartoon',
    label: 'Cartoon',
    blurb: 'Thick black outlines, saturated colours, cel shading and big expressive eyes',
    outline: 1.15,
    outlineColor: '#1D1B1F',
    jitter: 0,
    sketch: false,
    tension: 0.55,
    shading: 'cel',
    texture: 'none',
    eyes: 'cartoon',
    headScale: 1.25,
    blush: true,
    color: (c) => hsl(c, 0, 0.14, 0.01),
  },
};

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];
export const isTheme = (id: unknown): id is ThemeId => typeof id === 'string' && id in THEMES;
export const theme = (id: unknown): Theme => (isTheme(id) ? THEMES[id] : THEMES.storybook);

// ---------------------------------------------------------------- Pen: turns geometry into themed SVG
export interface ShapeOpts {
  part?: string; // data-part label (editable parts)
  closed?: boolean;
  tension?: number;
  outline?: number; // multiplier, 0 = none
  shade?: boolean; // gets cel/soft shading
  opacity?: number;
  raw?: boolean; // keep exact geometry (no wobble, no palette shift) — eyes, highlights
  stroke?: string; // explicit outline colour
}

const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c] as string);

export class Pen {
  readonly t: Theme;
  readonly u: number; // base unit (px) for line weights
  private defs = new Map<string, string>();
  private out: string[] = [];
  private seed: number;
  private n = 0;

  constructor(t: Theme, unit: number, seed: number | string) {
    this.t = t;
    this.u = unit;
    this.seed = typeof seed === 'string' ? hashString(seed) : seed;
  }

  color(c: string) {
    return /^#[0-9a-f]{3,6}$/i.test(c) ? this.t.color(c) : c;
  }

  outlineOf(fill: string) {
    return this.t.outlineColor === 'auto' ? shade(fill, -0.32, -0.1) : this.t.outlineColor;
  }

  /** Filled shape from points. Applies wobble, palette, shading and outline according to the theme. */
  shape(pts: Pt[], fill: string, o: ShapeOpts = {}) {
    const closed = o.closed ?? true;
    const id = ++this.n;
    const jit = o.raw ? 0 : this.t.jitter * this.u;
    const p = wobble(pts, jit, this.seed + id * 7);
    const d = smoothPath(p, closed, o.tension ?? this.t.tension);
    const c = o.raw ? fill : this.color(fill);
    const ow = (o.outline ?? 1) * this.t.outline * this.u;
    const strokeC = o.stroke ?? this.outlineOf(c);
    const op = o.opacity !== undefined && o.opacity < 1 ? ` opacity="${o.opacity}"` : '';
    const part = o.part ? ` data-part="${esc(o.part)}"` : '';
    if (!closed) {
      this.out.push(`<path d="${d}" fill="none" stroke="${c}" stroke-width="${(this.u * (o.outline ?? 1)).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"${op}${part}/>`);
      return;
    }
    let fillAttr = c;
    if (this.t.shading === 'soft' && o.shade) fillAttr = `url(#${this.gradient(c)})`;
    const body: string[] = [`<path d="${d}" fill="${fillAttr}"/>`];
    if (this.t.shading === 'cel' && o.shade) {
      // cel shadow: darker copy clipped to the shape, minus the shape nudged up-left → crescent on the lower right
      const cid = `cl${this.seed.toString(36)}${id}`;
      const k = this.u * 1.6;
      this.defs.set(cid, `<clipPath id="${cid}"><path d="${d}"/></clipPath>`);
      body.push(`<g clip-path="url(#${cid})"><path d="${d}" fill="${shade(c, -0.12)}"/><path d="${d}" fill="${c}" transform="translate(${-k} ${-k})"/></g>`);
    }
    if (ow > 0) body.push(`<path d="${d}" fill="none" stroke="${strokeC}" stroke-width="${ow.toFixed(2)}" stroke-linejoin="round" stroke-linecap="round"/>`);
    if (this.t.sketch && ow > 0 && !o.raw) {
      const d2 = smoothPath(wobble(pts, jit * 1.8, this.seed + id * 13), true, o.tension ?? this.t.tension);
      body.push(`<path d="${d2}" fill="none" stroke="${strokeC}" stroke-width="${(ow * 0.45).toFixed(2)}" opacity="0.45"/>`);
    }
    this.out.push(body.length === 1 && !part && !op ? body[0] : `<g${part}${op}>${body.join('')}</g>`);
  }

  circle(c: Pt, r: number, fill: string, o: ShapeOpts = {}) {
    this.shape(ellipsePts(c, r, r, 18), fill, { tension: 0.55, ...o });
  }

  ellipse(c: Pt, rx: number, ry: number, fill: string, o: ShapeOpts & { rot?: number } = {}) {
    this.shape(ellipsePts(c, rx, ry, 20, o.rot ?? 0), fill, { tension: 0.55, ...o });
  }

  /** Open stroke (brows, mouth lines, grass, rope). width in units. */
  line(pts: Pt[], color: string, width: number, o: { part?: string; opacity?: number; raw?: boolean; tension?: number } = {}) {
    const id = ++this.n;
    const p = o.raw ? pts : wobble(pts, this.t.jitter * this.u * 0.5, this.seed + id * 11);
    const d = smoothPath(p, false, o.tension ?? this.t.tension);
    const col = o.raw ? color : this.color(color);
    this.out.push(
      `<path d="${d}" fill="none" stroke="${col}" stroke-width="${(width * this.u).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"${o.opacity !== undefined ? ` opacity="${o.opacity}"` : ''}${o.part ? ` data-part="${esc(o.part)}"` : ''}/>`
    );
  }

  /** Exact SVG (patterns, text, gradients someone else built). */
  raw(svg: string) {
    this.out.push(svg);
  }

  def(id: string, svg: string) {
    this.defs.set(id, svg);
  }

  /** Named, editable group: everything drawn inside fn lands in <g id=… data-part=…>. */
  group(part: string, fn: () => void, attrs = '') {
    this.out.push(`<g data-part="${esc(part)}"${attrs ? ` ${attrs}` : ''}>`);
    fn();
    this.out.push('</g>');
  }

  private gradient(c: string) {
    const id = `sg${c.replace('#', '')}`;
    if (!this.defs.has(id))
      this.defs.set(id, `<linearGradient id="${id}" x1="0.15" y1="0" x2="0.85" y2="1"><stop offset="0" stop-color="${shade(c, 0.07)}"/><stop offset="1" stop-color="${shade(c, -0.08)}"/></linearGradient>`);
    return id;
  }

  /** Stripes / dots / checks pattern filling a shape (clothes). */
  pattern(kind: 'stripes' | 'dots' | 'checks', color: string, size: number): string {
    const c = this.color(color);
    const id = `pt${kind}${c.replace('#', '')}${Math.round(size)}`;
    if (!this.defs.has(id)) {
      const s = size.toFixed(1);
      const inner =
        kind === 'stripes'
          ? `<rect width="${s}" height="${(size * 0.35).toFixed(1)}" fill="${c}"/>`
          : kind === 'dots'
            ? `<circle cx="${(size / 2).toFixed(1)}" cy="${(size / 2).toFixed(1)}" r="${(size * 0.18).toFixed(1)}" fill="${c}"/>`
            : `<rect width="${(size / 2).toFixed(1)}" height="${s}" fill="${c}" opacity="0.45"/><rect width="${s}" height="${(size / 2).toFixed(1)}" fill="${c}" opacity="0.45"/>`;
      this.defs.set(id, `<pattern id="${id}" width="${s}" height="${s}" patternUnits="userSpaceOnUse"${kind === 'stripes' ? ' patternTransform="rotate(-8)"' : ''}>${inner}</pattern>`);
    }
    return `url(#${id})`;
  }

  /** Final SVG document. metadata = the spec, so a file can be re-opened and edited. */
  svg(width: number, height: number, viewBox: string, metadata?: unknown): string {
    const tex = this.t.texture === 'paper';
    const fid = `paper${this.seed.toString(36)}`;
    const filter = tex
      ? `<filter id="${fid}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.38  0 0 0 0 0.3  0 0 0 0.16 0" result="g"/><feComposite in="g" in2="SourceAlpha" operator="in" result="gm"/><feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="gm"/></feMerge></filter>`
      : '';
    const meta = metadata ? `<metadata>${esc(JSON.stringify(metadata))}</metadata>` : '';
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}">${meta}` +
      `<defs>${filter}${[...this.defs.values()].join('')}</defs>` +
      `<g${tex ? ` filter="url(#${fid})"` : ''}>${this.out.join('')}</g></svg>`
    );
  }
}
