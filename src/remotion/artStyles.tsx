/**
 * Art-style motion graphics — ten hand-built, procedural SVG looks (no image assets, fully deterministic,
 * so the browser preview and the Remotion render match frame for frame).
 *
 *   madhubani · inkWash · shadowPuppet · paperCutout · stainedGlass · anime · warli · blueprint · ukiyoe · miniature
 *
 * Each style provides:
 *   Scene  — a full-frame animated backdrop (used by the "Art title card")
 *   Border — a decorative frame with a clear centre (used by the "Art frame" over footage)
 * plus palette + typography for the "Art caption banner".
 */
import { environmentSvg, normaliseEnv, type EnvSpec } from '../vector/environment.ts';
import type { ThemeId } from '../vector/theme.ts';
import type { CSSProperties, ReactElement } from 'react';
import { AbsoluteFill, interpolate, random, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export type ArtStyleId =
  | 'madhubani'
  | 'inkWash'
  | 'shadowPuppet'
  | 'paperCutout'
  | 'stainedGlass'
  | 'anime'
  | 'warli'
  | 'blueprint'
  | 'ukiyoe'
  | 'miniature'
  // procedural vector themes (src/vector)
  | 'storybook'
  | 'flatVector'
  | 'handDrawn'
  | 'cartoon';

interface StyleDef {
  label: string;
  blurb: string;
  font: string;
  titleColor: string;
  titleStroke?: string;
  titleShadow?: string;
  upper?: boolean;
  bannerBg: string;
  bannerText: string;
  bannerBorder: string;
  titlePos?: 'top' | 'center'; // where the title sits by default, so it never covers the scene's focal point
  titleScale?: number;
}

export const ART_STYLES: Record<ArtStyleId, StyleDef> = {
  madhubani: {
    label: 'Madhubani',
    blurb: 'Bihar folk art: bold double outlines, hatching, fish and sun motifs',
    font: '"Palatino Linotype", Palatino, Georgia, serif',
    titleColor: '#1A1A1A',
    upper: true,
    bannerBg: '#F6E7C1',
    bannerText: '#1A1A1A',
    bannerBorder: '#C1272D',
  },
  inkWash: {
    label: 'Ink wash',
    blurb: 'Sumi-e brush ink on rice paper with mist and a red seal',
    font: '"Ink Free", "Segoe Print", "Bradley Hand", Georgia, serif',
    titleColor: '#141414',
    titleShadow: '0 0 14px #EFEAE0, 0 0 28px #EFEAE0',
    titleScale: 1.15,
    bannerBg: '#EFEAE0',
    bannerText: '#141414',
    bannerBorder: '#B3261E',
  },
  shadowPuppet: {
    label: 'Shadow puppet',
    blurb: 'Backlit screen with perforated leather puppets on sticks',
    font: '"Palatino Linotype", Palatino, Georgia, serif',
    titleColor: '#1B0E05',
    titleShadow: '0 0 30px rgba(255,190,90,.6)',
    upper: true,
    titlePos: 'top',
    bannerBg: '#2A1408',
    bannerText: '#FFC46B',
    bannerBorder: '#FF9A3C',
  },
  paperCutout: {
    label: 'Paper cutout',
    blurb: 'Layered paper hills, sun and clouds with soft drop shadows',
    font: '"Bahnschrift SemiBold", "Avenir Next", "Segoe UI", Arial, sans-serif',
    titleColor: '#FFFFFF',
    titleShadow: '0 6px 0 rgba(0,0,0,.18)',
    bannerBg: '#FFF7EC',
    bannerText: '#2D3047',
    bannerBorder: '#FF6B6B',
  },
  stainedGlass: {
    label: 'Stained glass',
    blurb: 'Jewel-tone glass cells in dark leading, glowing with light',
    font: '"Constantia", "Palatino Linotype", Georgia, serif',
    titleColor: '#FFF6D6',
    titleStroke: '#111',
    upper: true,
    bannerBg: '#1C2541',
    bannerText: '#FFF6D6',
    bannerBorder: '#E0B53A',
  },
  anime: {
    label: 'Anime',
    blurb: 'Speed lines, sparkles, sky gradient and a slam-in title',
    font: 'Impact, "Arial Black", "Helvetica Neue", sans-serif',
    titleColor: '#FFFFFF',
    titleStroke: '#1B1B3A',
    upper: true,
    titleScale: 1.4,
    bannerBg: '#FF3D7F',
    bannerText: '#FFFFFF',
    bannerBorder: '#1B1B3A',
  },
  warli: {
    label: 'Warli',
    blurb: 'Maharashtra tribal art: white stick figures dancing on earth red',
    font: '"Nirmala UI", "Segoe UI", Arial, sans-serif',
    titleColor: '#FFFFFF',
    upper: true,
    titlePos: 'top',
    bannerBg: '#7A3B22',
    bannerText: '#FFFFFF',
    bannerBorder: '#FFFFFF',
  },
  blueprint: {
    label: 'Blueprint',
    blurb: 'Technical drawing on a blue grid, drawn on line by line',
    font: 'Consolas, "SF Mono", Menlo, monospace',
    titleColor: '#FFFFFF',
    upper: true,
    bannerBg: '#0B3D91',
    bannerText: '#FFFFFF',
    bannerBorder: '#9CC3FF',
  },
  ukiyoe: {
    label: 'Ukiyo-e',
    blurb: 'Woodblock print: rolling Prussian-blue waves, red sun, cartouche',
    font: '"Yu Mincho", "Hiragino Mincho ProN", "Palatino Linotype", Georgia, serif',
    titleColor: '#1F2A44',
    bannerBg: '#F3E6CC',
    bannerText: '#1F2A44',
    bannerBorder: '#B23A2B',
  },
  miniature: {
    label: 'Miniature painting',
    blurb: 'Mughal / Rajput miniature: gold floral border, arched window, cypress',
    font: 'Gabriola, "Palatino Linotype", Palatino, Georgia, serif',
    titleColor: '#F7E3A1',
    titleShadow: '0 3px 10px rgba(0,0,0,.5)',
    bannerBg: '#5B1A18',
    bannerText: '#F7E3A1',
    bannerBorder: '#D4A537',
  },
  storybook: {
    label: "Children's storybook",
    blurb: 'Soft gouache colours, gentle outlines, paper grain — procedurally drawn characters',
    font: '"Comic Sans MS", "Trebuchet MS", "Segoe Print", sans-serif',
    titleColor: '#4A2E1F',
    titleShadow: '0 0 12px #FFF4DC, 0 0 24px #FFF4DC',
    bannerBg: '#FFF4DC',
    bannerText: '#4A2E1F',
    bannerBorder: '#E07A5F',
    titlePos: 'top',
  },
  flatVector: {
    label: 'Flat vector',
    blurb: 'Clean geometric explainer look, no outlines, bold flat colour',
    font: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
    titleColor: '#FFFFFF',
    titleShadow: '0 4px 0 rgba(0,0,0,.18)',
    bannerBg: '#264653',
    bannerText: '#FFFFFF',
    bannerBorder: '#E9C46A',
    titlePos: 'top',
  },
  handDrawn: {
    label: 'Hand-drawn',
    blurb: 'Wobbly ink lines with a pencil pass over light watercolour',
    font: '"Segoe Print", "Ink Free", "Bradley Hand", cursive',
    titleColor: '#2A2622',
    titleShadow: '0 0 10px #FBF7EF, 0 0 20px #FBF7EF',
    bannerBg: '#FBF7EF',
    bannerText: '#2A2622',
    bannerBorder: '#2A2622',
    titlePos: 'top',
  },
  cartoon: {
    label: 'Cartoon',
    blurb: 'Thick black outlines, saturated colour, cel shading, big expressive eyes',
    font: '"Arial Black", "Segoe UI Black", Impact, sans-serif',
    titleColor: '#FFE14D',
    titleStroke: '#1D1B1F',
    upper: true,
    bannerBg: '#FFE14D',
    bannerText: '#1D1B1F',
    bannerBorder: '#1D1B1F',
    titlePos: 'top',
  },
};

export const ART_STYLE_IDS = Object.keys(ART_STYLES) as ArtStyleId[];

export function artStyle(id: unknown): ArtStyleId {
  return typeof id === 'string' && id in ART_STYLES ? (id as ArtStyleId) : 'madhubani';
}

/** n drop-shadows round the alpha edge = an outline that follows the cut-out shape */
const outline = (px: number, c: string) => `drop-shadow(${px}px 0 0 ${c}) drop-shadow(-${px}px 0 0 ${c}) drop-shadow(0 ${px}px 0 ${c}) drop-shadow(0 -${px}px 0 ${c})`;

/**
 * Re-colour a library picture (photo-ish / cartoon PNG) so it sits inside an art style next to the drawn assets.
 * sprite = cut-out character/object; otherwise a full background.
 */
export function styleLook(id: string | undefined, sprite: boolean): { filter?: string; mixBlendMode?: 'screen' | 'multiply' } {
  if (!id || !(id in ART_STYLES)) return {};
  const L: Record<ArtStyleId, [string, string, ('screen' | 'multiply')?]> = {
    // [sprite filter, background filter, sprite blend]
    shadowPuppet: [`brightness(0.18) sepia(0.7) saturate(2) ${'drop-shadow(0 0 6px rgba(255,150,40,.55))'}`, 'sepia(0.8) saturate(1.6) hue-rotate(-15deg) contrast(1.1) brightness(0.85)'],
    inkWash: ['grayscale(1) contrast(1.4) brightness(1.05)', 'grayscale(1) contrast(0.85) brightness(1.15) sepia(0.15)', 'multiply'],
    warli: ['brightness(0) invert(1)', 'sepia(1) saturate(1.8) hue-rotate(-20deg) brightness(0.55) contrast(0.9)'],
    blueprint: ['grayscale(1) contrast(1.6) invert(1)', 'grayscale(1) invert(1) sepia(1) hue-rotate(180deg) saturate(2.5) brightness(0.7)', 'screen'],
    madhubani: [`saturate(1.5) contrast(1.25) ${outline(3, '#1A1A1A')}`, 'sepia(0.35) saturate(1.3) contrast(1.1)'],
    paperCutout: [`saturate(1.15) ${outline(5, '#FFFFFF')} drop-shadow(6px 10px 6px rgba(0,0,0,.35))`, 'saturate(1.1) contrast(0.95)'],
    stainedGlass: [`saturate(1.9) contrast(1.3) ${outline(4, '#111111')}`, 'saturate(1.6) contrast(1.2)'],
    anime: ['saturate(1.25) contrast(1.08) brightness(1.04)', 'saturate(1.2) contrast(1.05) brightness(1.04)'],
    ukiyoe: [`sepia(0.35) saturate(0.85) contrast(1.1) ${outline(2, '#2B2B2B')}`, 'sepia(0.45) saturate(0.8) contrast(1.05)'],
    miniature: [`sepia(0.25) saturate(1.35) contrast(1.1) ${outline(2, '#C9A227')}`, 'sepia(0.3) saturate(1.3) contrast(1.05)'],
    storybook: [`saturate(0.9) sepia(0.12) ${outline(2, '#6B4A35')}`, 'saturate(0.9) sepia(0.15) brightness(1.03)'],
    flatVector: ['saturate(1.15) contrast(1.05)', 'saturate(1.1) contrast(1.03)'],
    handDrawn: [`saturate(0.75) brightness(1.06) ${outline(2, '#2A2622')}`, 'saturate(0.7) brightness(1.08) sepia(0.1)'],
    cartoon: [`saturate(1.35) contrast(1.15) ${outline(4, '#1D1B1F')}`, 'saturate(1.3) contrast(1.1)'],
  };
  const [sp, bg, blend] = L[id as ArtStyleId];
  return sprite ? { filter: sp, mixBlendMode: blend } : { filter: bg };
}

interface Ctx {
  w: number;
  h: number;
  f: number; // frame
  fps: number;
  p: number; // entrance 0..1
  draw: (delay: number, len?: number) => number; // 0..1 progress helper for line-drawing
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function useCtx(): Ctx {
  const f = useCurrentFrame();
  const { width: w, height: h, fps } = useVideoConfig();
  const p = spring({ frame: f, fps, config: { damping: 18, stiffness: 90 } });
  const draw = (delay: number, len = 20) => clamp01((f - delay) / len);
  return { w, h, f, fps, p, draw };
}

const Grain = ({ id, opacity = 0.2, freq = 0.8 }: { id: string; opacity?: number; freq?: number }) => (
  <>
    <filter id={id}>
      <feTurbulence type="fractalNoise" baseFrequency={freq} numOctaves={2} seed={3} />
      <feColorMatrix type="saturate" values="0" />
    </filter>
    <rect width="100%" height="100%" filter={`url(#${id})`} opacity={opacity} style={{ mixBlendMode: 'multiply' }} />
  </>
);

// ============================================================ MADHUBANI
function madhubaniBorder({ w, h, draw }: Ctx, inset = 0.035) {
  const m = Math.min(w, h) * inset;
  const band = Math.min(w, h) * 0.055;
  const per = 2 * (w + h);
  const tri: ReactElement[] = [];
  const step = band * 0.9;
  // zig-zag triangles along the band (top/bottom)
  for (let x = m; x < w - m - step; x += step) {
    tri.push(<path key={`t${x}`} d={`M${x} ${m + band} L${x + step / 2} ${m} L${x + step} ${m + band}Z`} fill={x / step % 2 < 1 ? '#C1272D' : '#F4B400'} />);
    tri.push(<path key={`b${x}`} d={`M${x} ${h - m - band} L${x + step / 2} ${h - m} L${x + step} ${h - m - band}Z`} fill={x / step % 2 < 1 ? '#2E7D32' : '#C1272D'} />);
  }
  for (let y = m + band; y < h - m - band - step; y += step) {
    tri.push(<path key={`l${y}`} d={`M${m + band} ${y} L${m} ${y + step / 2} L${m + band} ${y + step}Z`} fill={y / step % 2 < 1 ? '#F4B400' : '#1F4E9E'} />);
    tri.push(<path key={`r${y}`} d={`M${w - m - band} ${y} L${w - m} ${y + step / 2} L${w - m - band} ${y + step}Z`} fill={y / step % 2 < 1 ? '#1F4E9E' : '#F4B400'} />);
  }
  const d = draw(0, 30);
  return (
    <g>
      <g opacity={d}>{tri}</g>
      {[0, band].map((o) => (
        <rect key={o} x={m + o} y={m + o} width={w - 2 * (m + o)} height={h - 2 * (m + o)} fill="none" stroke="#111" strokeWidth={band * 0.12}
          strokeDasharray={per} strokeDashoffset={per * (1 - d)} />
      ))}
    </g>
  );
}

function Fish({ x, y, s, flip, t }: { x: number; y: number; s: number; flip?: boolean; t: number }) {
  const sway = Math.sin(t / 8) * 6;
  return (
    <g transform={`translate(${x},${y + sway}) scale(${flip ? -s : s},${s})`}>
      <path d="M-60 0 C-30 -38 40 -38 60 0 C40 38 -30 38 -60 0Z" fill="#F4B400" stroke="#111" strokeWidth={5} />
      {[-30, -12, 6, 24].map((cx) => (
        <path key={cx} d={`M${cx} -24 Q${cx + 10} 0 ${cx} 24`} fill="none" stroke="#C1272D" strokeWidth={6} />
      ))}
      <path d="M60 0 L100 -30 L92 0 L100 30Z" fill="#2E7D32" stroke="#111" strokeWidth={5} />
      <circle cx={-38} cy={-6} r={8} fill="#fff" stroke="#111" strokeWidth={4} />
      <circle cx={-38} cy={-6} r={3} fill="#111" />
    </g>
  );
}

function MadhubaniScene(c: Ctx) {
  const { w, h, f } = c;
  const cx = w / 2;
  const cy = h * 0.3;
  const R = Math.min(w, h) * 0.17;
  return (
    <svg width={w} height={h}>
      <rect width={w} height={h} fill="#F6E7C1" />
      <Grain id="mb-g" opacity={0.25} />
      <g transform={`translate(${cx},${cy}) rotate(${f * 0.4})`} opacity={c.p}>
        {Array.from({ length: 16 }, (_, i) => (
          <path key={i} transform={`rotate(${i * 22.5})`} d={`M0 ${-R * 1.05} L${R * 0.16} ${-R * 1.55} L${-R * 0.16} ${-R * 1.55}Z`} fill={i % 2 ? '#C1272D' : '#F4B400'} stroke="#111" strokeWidth={4} />
        ))}
        <circle r={R} fill="#C1272D" stroke="#111" strokeWidth={6} />
        <circle r={R * 0.72} fill="#F4B400" stroke="#111" strokeWidth={5} />
        {Array.from({ length: 12 }, (_, i) => (
          <line key={i} transform={`rotate(${i * 30})`} x1={0} y1={-R * 0.72} x2={0} y2={-R * 0.98} stroke="#111" strokeWidth={4} />
        ))}
        <circle r={R * 0.38} fill="#F6E7C1" stroke="#111" strokeWidth={5} />
        <circle cx={-R * 0.12} cy={-R * 0.06} r={R * 0.05} fill="#111" />
        <circle cx={R * 0.12} cy={-R * 0.06} r={R * 0.05} fill="#111" />
        <path d={`M${-R * 0.13} ${R * 0.12} Q0 ${R * 0.22} ${R * 0.13} ${R * 0.12}`} stroke="#111" strokeWidth={4} fill="none" />
      </g>
      <g opacity={c.draw(10, 20)}>
        <Fish x={w * 0.3} y={h * 0.8} s={Math.min(w, h) / 700} t={f} />
        <Fish x={w * 0.7} y={h * 0.8} s={Math.min(w, h) / 700} t={f + 20} flip />
      </g>
      {madhubaniBorder(c)}
    </svg>
  );
}

// ============================================================ INK WASH
function InkWashScene(c: Ctx) {
  const { w, h, f } = c;
  const reveal = c.draw(0, 40);
  const ridge = (base: number, amp: number, seed: string) => {
    let d = `M0 ${h}`;
    for (let i = 0; i <= 24; i++) {
      const x = (w / 24) * i;
      const y = base - amp * (0.4 + 0.6 * random(`${seed}${i}`)) * Math.sin((i / 24) * Math.PI * 2.2 + random(seed) * 3) ** 2;
      d += ` L${x} ${y}`;
    }
    return `${d} L${w} ${h}Z`;
  };
  return (
    <svg width={w} height={h}>
      <defs>
        <filter id="ink-brush">
          <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves={3} seed={9} />
          <feDisplacementMap in="SourceGraphic" scale={30} />
          <feGaussianBlur stdDeviation={2.5} />
        </filter>
        <clipPath id="ink-reveal">
          <rect width={w * reveal} height={h} />
        </clipPath>
        <linearGradient id="ink-mist" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#EFEAE0" stopOpacity="0" />
          <stop offset="1" stopColor="#EFEAE0" stopOpacity="1" />
        </linearGradient>
      </defs>
      <rect width={w} height={h} fill="#EFEAE0" />
      <Grain id="ink-g" opacity={0.22} freq={0.9} />
      <g clipPath="url(#ink-reveal)" filter="url(#ink-brush)">
        <path d={ridge(h * 0.55, h * 0.22, 'a')} fill="#9A9A96" opacity={0.55} />
        <path d={ridge(h * 0.68, h * 0.2, 'b')} fill="#5E5E5A" opacity={0.75} />
        <path d={ridge(h * 0.82, h * 0.16, 'c')} fill="#1E1E1C" opacity={0.9} />
      </g>
      <rect y={h * 0.45} width={w} height={h * 0.25} fill="url(#ink-mist)" transform={`translate(${Math.sin(f / 50) * 30},0)`} opacity={0.85} />
      {/* bamboo brush strokes */}
      <g filter="url(#ink-brush)" opacity={c.draw(15, 25)} stroke="#1E1E1C" strokeLinecap="round" fill="none">
        <path d={`M${w * 0.86} ${h} L${w * 0.84} ${h * 0.35}`} strokeWidth={w * 0.018} />
        <path d={`M${w * 0.845} ${h * 0.5} q${-w * 0.12} ${-h * 0.03} ${-w * 0.2} ${h * 0.02}`} strokeWidth={w * 0.008} />
        <path d={`M${w * 0.85} ${h * 0.42} q${w * 0.08} ${-h * 0.04} ${w * 0.12} ${-h * 0.02}`} strokeWidth={w * 0.007} />
      </g>
      {/* red seal */}
      <g transform={`translate(${w * 0.1},${h * 0.86})`} opacity={c.draw(30, 10)}>
        <rect width={w * 0.07} height={w * 0.07} fill="#B3261E" rx={4} />
        <path d={`M${w * 0.015} ${w * 0.02} h${w * 0.04} M${w * 0.035} ${w * 0.02} v${w * 0.035} M${w * 0.015} ${w * 0.05} h${w * 0.04}`} stroke="#EFEAE0" strokeWidth={w * 0.006} />
      </g>
    </svg>
  );
}

function InkWashBorder({ w, h, draw }: Ctx) {
  const d = draw(0, 25);
  return (
    <svg width={w} height={h}>
      <defs>
        <filter id="inkb">
          <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves={3} seed={4} />
          <feDisplacementMap in="SourceGraphic" scale={40} />
        </filter>
        <radialGradient id="ink-vig" cx="50%" cy="50%" r="70%">
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#111" stopOpacity="0.85" />
        </radialGradient>
      </defs>
      <rect width={w} height={h} fill="url(#ink-vig)" opacity={d} />
      <g filter="url(#inkb)" stroke="#111" strokeLinecap="round" fill="none" opacity={d}>
        <path d={`M${w * 0.04} ${h * 0.18} Q${w * 0.05} ${h * 0.05} ${w * 0.28} ${h * 0.04}`} strokeWidth={w * 0.02} />
        <path d={`M${w * 0.96} ${h * 0.82} Q${w * 0.95} ${h * 0.95} ${w * 0.72} ${h * 0.96}`} strokeWidth={w * 0.02} />
      </g>
      <rect x={w * 0.86} y={h * 0.05} width={w * 0.07} height={w * 0.07} fill="#B3261E" opacity={d} rx={4} />
    </svg>
  );
}

// ============================================================ SHADOW PUPPET
function Puppet({ x, y, s, t, flip }: { x: number; y: number; s: number; t: number; flip?: boolean }) {
  const sway = Math.sin(t / 14) * 5;
  const arm = Math.sin(t / 9) * 18;
  const holes = Array.from({ length: 14 }, (_, i) => ({ cx: -18 + (i % 4) * 12, cy: -40 + Math.floor(i / 4) * 22 }));
  return (
    <g transform={`translate(${x},${y}) scale(${flip ? -s : s},${s}) rotate(${sway})`}>
      <line x1={0} y1={60} x2={0} y2={260} stroke="#1B0E05" strokeWidth={5} />
      <g transform={`rotate(${-30 + arm} -30 -50)`}>
        <path d="M-30 -50 L-110 -10 L-104 -2 L-26 -40Z" fill="#1B0E05" />
        <line x1={-108} y1={-6} x2={-150} y2={220} stroke="#1B0E05" strokeWidth={4} />
      </g>
      <g transform={`rotate(${20 - arm} 30 -50)`}>
        <path d="M30 -50 L100 -100 L106 -92 L34 -40Z" fill="#1B0E05" />
      </g>
      <path d="M-40 -70 Q0 -90 40 -70 L55 60 Q0 80 -55 60Z" fill="#1B0E05" />
      {holes.map((hh, i) => (
        <circle key={i} cx={hh.cx} cy={hh.cy} r={3.5} fill="#FFB347" opacity={0.9} />
      ))}
      <ellipse cx={0} cy={-112} rx={28} ry={34} fill="#1B0E05" />
      <path d="M-30 -140 L0 -190 L30 -140Z" fill="#1B0E05" />
      <circle cx={10} cy={-116} r={4} fill="#FFB347" />
    </g>
  );
}

function ShadowPuppetScene(c: Ctx) {
  const { w, h, f } = c;
  const flicker = 0.92 + 0.08 * Math.sin(f / 3) * Math.sin(f / 7);
  const s = Math.min(w, h) / 620;
  return (
    <svg width={w} height={h}>
      <defs>
        <radialGradient id="sp-glow" cx="50%" cy="45%" r="70%">
          <stop offset="0" stopColor="#FFE2A8" />
          <stop offset="0.45" stopColor="#FFB347" />
          <stop offset="1" stopColor="#5A230A" />
        </radialGradient>
        <filter id="sp-soft">
          <feGaussianBlur stdDeviation={2} />
        </filter>
      </defs>
      <rect width={w} height={h} fill="url(#sp-glow)" opacity={flicker} />
      <Grain id="sp-g" opacity={0.2} />
      <g filter="url(#sp-soft)" opacity={c.p}>
        {/* tree */}
        <g transform={`translate(${w * 0.18},${h * 0.62}) scale(${s})`}>
          <rect x={-10} y={0} width={20} height={300} fill="#1B0E05" />
          {Array.from({ length: 7 }, (_, i) => (
            <ellipse key={i} cx={Math.cos(i) * 70} cy={-40 - i * 25} rx={70 - i * 6} ry={34} fill="#1B0E05" />
          ))}
        </g>
        <Puppet x={w * 0.42} y={h * 0.6} s={s * 1.4} t={f} />
        <Puppet x={w * 0.72} y={h * 0.62} s={s * 1.25} t={f + 30} flip />
      </g>
      {/* screen frame */}
      <rect x={0} y={0} width={w} height={h} fill="none" stroke="#2A1408" strokeWidth={Math.min(w, h) * 0.05} />
      {Array.from({ length: 18 }, (_, i) => (
        <circle key={i} cx={(w / 17) * i} cy={0} r={Math.min(w, h) * 0.035} fill="#2A1408" />
      ))}
    </svg>
  );
}

function ShadowPuppetBorder({ w, h, f, draw }: Ctx) {
  const d = draw(0, 20);
  return (
    <svg width={w} height={h}>
      <defs>
        <radialGradient id="spv" cx="50%" cy="50%" r="72%">
          <stop offset="0.55" stopColor="#FFB347" stopOpacity="0" />
          <stop offset="1" stopColor="#2A1408" stopOpacity="0.95" />
        </radialGradient>
      </defs>
      <rect width={w} height={h} fill="url(#spv)" opacity={d * (0.9 + 0.1 * Math.sin(f / 4))} />
      {Array.from({ length: 18 }, (_, i) => (
        <circle key={i} cx={(w / 17) * i} cy={-h * 0.01} r={Math.min(w, h) * 0.04 * d} fill="#2A1408" />
      ))}
    </svg>
  );
}

// ============================================================ PAPER CUTOUT
const PAPER_LAYERS = ['#FFD6A5', '#FFADAD', '#E5989B', '#B5838D', '#6D597A', '#355070'];

function PaperCutoutScene(c: Ctx) {
  const { w, h, f, fps } = c;
  const hill = (i: number) => {
    const base = h * (0.5 + i * 0.09);
    let d = `M0 ${h} L0 ${base}`;
    for (let k = 0; k <= 6; k++) {
      const x = (w / 6) * k;
      const y = base - h * 0.06 * Math.sin(k * 1.3 + i * 2.1) - h * 0.02 * random(`p${i}${k}`);
      d += ` Q${x - w / 12} ${y - h * 0.04} ${x} ${y}`;
    }
    return `${d} L${w} ${h}Z`;
  };
  return (
    <svg width={w} height={h}>
      <defs>
        <filter id="pc-shadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy={-h * 0.006} stdDeviation={h * 0.008} floodColor="#000" floodOpacity="0.28" />
        </filter>
      </defs>
      <rect width={w} height={h} fill="#CDEAFF" />
      <circle cx={w * 0.72} cy={h * 0.24} r={Math.min(w, h) * 0.12 * c.p} fill="#FFD166" filter="url(#pc-shadow)" />
      {[0, 1].map((k) => (
        <g key={k} transform={`translate(${((f * (0.6 + k * 0.3)) % (w * 1.4)) - w * 0.3 + k * w * 0.4},${h * (0.12 + k * 0.1)})`} filter="url(#pc-shadow)">
          <ellipse rx={w * 0.09} ry={h * 0.025} fill="#fff" />
          <ellipse cx={w * 0.05} cy={-h * 0.02} rx={w * 0.06} ry={h * 0.025} fill="#fff" />
        </g>
      ))}
      {PAPER_LAYERS.map((col, i) => {
        const up = spring({ frame: f - i * 4, fps, config: { damping: 16 } });
        return <path key={col} d={hill(i)} fill={col} filter="url(#pc-shadow)" transform={`translate(0,${(1 - up) * h * 0.5})`} />;
      })}
      <Grain id="pc-g" opacity={0.12} freq={1.1} />
    </svg>
  );
}

function PaperCutoutBorder({ w, h, draw }: Ctx) {
  const d = draw(0, 18);
  const m = Math.min(w, h) * 0.05 * d;
  let inner = '';
  const steps = 60;
  const jag = (i: number) => Math.min(w, h) * 0.012 * random(`pj${i}`);
  for (let i = 0; i <= steps; i++) inner += `${i ? 'L' : 'M'}${m + ((w - 2 * m) / steps) * i} ${m + jag(i)} `;
  for (let i = 0; i <= steps; i++) inner += `L${w - m - jag(i + 99)} ${m + ((h - 2 * m) / steps) * i} `;
  for (let i = steps; i >= 0; i--) inner += `L${m + ((w - 2 * m) / steps) * i} ${h - m - jag(i + 199)} `;
  for (let i = steps; i >= 0; i--) inner += `L${m + jag(i + 299)} ${m + ((h - 2 * m) / steps) * i} `;
  return (
    <svg width={w} height={h}>
      <defs>
        <filter id="pcb">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodOpacity="0.35" />
        </filter>
      </defs>
      <path d={`M0 0 H${w} V${h} H0Z ${inner}Z`} fillRule="evenodd" fill="#FFF7EC" filter="url(#pcb)" />
    </svg>
  );
}

// ============================================================ STAINED GLASS
const GLASS = ['#1E5AA8', '#C0392B', '#E0B53A', '#2E8B57', '#6C3483', '#16A085', '#D35400', '#2471A3'];

function glassCells(w: number, h: number, cols: number, seed: string) {
  const rows = Math.round((cols * h) / w);
  const pts: Array<[number, number]>[] = [];
  for (let r = 0; r <= rows; r++) {
    const row: Array<[number, number]> = [];
    for (let c = 0; c <= cols; c++) {
      const edge = r === 0 || c === 0 || r === rows || c === cols;
      const jx = edge ? 0 : (random(`${seed}x${r}_${c}`) - 0.5) * (w / cols) * 0.7;
      const jy = edge ? 0 : (random(`${seed}y${r}_${c}`) - 0.5) * (h / rows) * 0.7;
      row.push([(w / cols) * c + jx, (h / rows) * r + jy]);
    }
    pts.push(row);
  }
  const tris: Array<{ d: string; cx: number; cy: number; col: string; k: number }> = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const a = pts[r][c];
      const b = pts[r][c + 1];
      const d2 = pts[r + 1][c];
      const e = pts[r + 1][c + 1];
      const flip = random(`${seed}f${r}${c}`) > 0.5;
      const pairs = flip ? [[a, b, e], [a, e, d2]] : [[a, b, d2], [b, e, d2]];
      pairs.forEach((t, k) => {
        const cx = (t[0][0] + t[1][0] + t[2][0]) / 3;
        const cy = (t[0][1] + t[1][1] + t[2][1]) / 3;
        tris.push({
          d: `M${t[0][0]} ${t[0][1]} L${t[1][0]} ${t[1][1]} L${t[2][0]} ${t[2][1]}Z`,
          cx,
          cy,
          col: GLASS[Math.floor(random(`${seed}c${r}${c}${k}`) * GLASS.length)],
          k: random(`${seed}k${r}${c}${k}`),
        });
      });
    }
  return tris;
}

function StainedGlassScene(c: Ctx) {
  const { w, h, f } = c;
  const tris = glassCells(w, h, 7, 'sg');
  const lead = Math.min(w, h) * 0.008;
  return (
    <svg width={w} height={h}>
      <defs>
        <radialGradient id="sg-light" cx="50%" cy="38%" r="65%">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={w} height={h} fill="#111" />
      {tris.map((t, i) => {
        const on = clamp01((f - t.k * 25) / 10);
        const shimmer = 0.75 + 0.25 * Math.sin(f / 12 + t.k * 6);
        return <path key={i} d={t.d} fill={t.col} opacity={on * shimmer} stroke="#151515" strokeWidth={lead} strokeLinejoin="round" />;
      })}
      <rect width={w} height={h} fill="url(#sg-light)" style={{ mixBlendMode: 'screen' }} />
      <Grain id="sg-g" opacity={0.18} freq={1.4} />
    </svg>
  );
}

function StainedGlassBorder({ w, h, f }: Ctx) {
  const band = Math.min(w, h) * 0.09;
  const tris = glassCells(w, h, 12, 'sgb').filter((t) => t.cx < band || t.cx > w - band || t.cy < band || t.cy > h - band);
  return (
    <svg width={w} height={h}>
      {tris.map((t, i) => (
        <path key={i} d={t.d} fill={t.col} opacity={clamp01((f - t.k * 15) / 8) * (0.8 + 0.2 * Math.sin(f / 10 + i))} stroke="#151515" strokeWidth={Math.min(w, h) * 0.006} />
      ))}
      <rect x={band} y={band} width={w - 2 * band} height={h - 2 * band} fill="none" stroke="#151515" strokeWidth={Math.min(w, h) * 0.012} />
    </svg>
  );
}

// ============================================================ ANIME
function speedLines(w: number, h: number, f: number, n: number, innerR: number, seed: string, color: string) {
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.hypot(w, h);
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + random(`${seed}${i}`) * 0.05;
    const wob = random(`${seed}w${i}${Math.floor(f / 2)}`);
    const r0 = innerR * (0.85 + wob * 0.4);
    const wd = 0.004 + random(`${seed}t${i}`) * 0.01;
    const p1 = [cx + Math.cos(a - wd) * R, cy + Math.sin(a - wd) * R];
    const p2 = [cx + Math.cos(a + wd) * R, cy + Math.sin(a + wd) * R];
    const p0 = [cx + Math.cos(a) * r0, cy + Math.sin(a) * r0];
    return <path key={i} d={`M${p0[0]} ${p0[1]} L${p1[0]} ${p1[1]} L${p2[0]} ${p2[1]}Z`} fill={color} />;
  });
}

function AnimeScene(c: Ctx) {
  const { w, h, f } = c;
  const flash = interpolate(f, [0, 3, 10], [1, 0.8, 0], { extrapolateRight: 'clamp' });
  return (
    <svg width={w} height={h}>
      <defs>
        <linearGradient id="an-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3A7BD5" />
          <stop offset="0.6" stopColor="#B06AB3" />
          <stop offset="1" stopColor="#FF8FAB" />
        </linearGradient>
        <radialGradient id="an-sun" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#FFFDE7" />
          <stop offset="0.5" stopColor="#FFE082" stopOpacity="0.8" />
          <stop offset="1" stopColor="#FFE082" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={w} height={h} fill="url(#an-sky)" />
      <circle cx={w / 2} cy={h / 2} r={Math.min(w, h) * 0.45} fill="url(#an-sun)" />
      <g opacity={0.55} transform={`rotate(${f * 0.15} ${w / 2} ${h / 2})`}>{speedLines(w, h, f, 70, Math.min(w, h) * 0.32, 'an', '#FFFFFF')}</g>
      {Array.from({ length: 10 }, (_, i) => {
        const x = random(`spx${i}`) * w;
        const y = random(`spy${i}`) * h;
        const s = (Math.sin(f / 5 + i * 1.7) * 0.5 + 0.5) * Math.min(w, h) * 0.025;
        return <path key={i} d={`M${x} ${y - s} L${x + s * 0.25} ${y - s * 0.25} L${x + s} ${y} L${x + s * 0.25} ${y + s * 0.25} L${x} ${y + s} L${x - s * 0.25} ${y + s * 0.25} L${x - s} ${y} L${x - s * 0.25} ${y - s * 0.25}Z`} fill="#fff" />;
      })}
      <rect width={w} height={h} fill="#fff" opacity={flash} />
    </svg>
  );
}

function AnimeBorder({ w, h, f }: Ctx) {
  return (
    <svg width={w} height={h}>
      <g opacity={0.8}>{speedLines(w, h, f, 90, Math.max(w, h) * 0.42, 'anb', '#111')}</g>
    </svg>
  );
}

// ============================================================ WARLI
function WarliFigure({ x, y, s, t, phase }: { x: number; y: number; s: number; t: number; phase: number }) {
  const arm = Math.sin(t / 6 + phase) * 20;
  const leg = Math.sin(t / 6 + phase) * 12;
  return (
    <g transform={`translate(${x},${y}) scale(${s})`} stroke="#fff" strokeWidth={3} strokeLinecap="round" fill="#fff">
      <circle cx={0} cy={-46} r={8} />
      <path d="M-11 -36 L11 -36 L0 -18Z" />
      <path d="M0 -18 L-11 0 L11 0Z" />
      <line x1={-9} y1={-33} x2={-24} y2={-22 - arm} />
      <line x1={9} y1={-33} x2={24} y2={-22 + arm} />
      <line x1={-6} y1={0} x2={-12 - leg} y2={20} />
      <line x1={6} y1={0} x2={12 + leg} y2={20} />
    </g>
  );
}

function WarliScene(c: Ctx) {
  const { w, h, f } = c;
  const s = Math.min(w, h) / 520;
  const R = Math.min(w, h) * 0.28;
  const n = 14;
  const cx = w / 2;
  const cy = h * 0.6;
  const spin = f * 0.006;
  return (
    <svg width={w} height={h}>
      <rect width={w} height={h} fill="#7A3B22" />
      <Grain id="wl-g" opacity={0.35} freq={0.7} />
      {/* sun + moon */}
      <g opacity={c.p} stroke="#fff" fill="none" strokeWidth={3}>
        <circle cx={w * 0.2} cy={h * 0.18} r={Math.min(w, h) * 0.05} />
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          const r1 = Math.min(w, h) * 0.065;
          const r2 = Math.min(w, h) * 0.09;
          return <line key={i} x1={w * 0.2 + Math.cos(a) * r1} y1={h * 0.18 + Math.sin(a) * r1} x2={w * 0.2 + Math.cos(a) * r2} y2={h * 0.18 + Math.sin(a) * r2} />;
        })}
        <path d={`M${w * 0.82} ${h * 0.13} a${w * 0.05} ${w * 0.05} 0 1 0 ${w * 0.03} ${w * 0.08} a${w * 0.04} ${w * 0.04} 0 1 1 -${w * 0.03} -${w * 0.08}Z`} fill="#fff" />
      </g>
      {/* tarpa dance circle */}
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + spin;
        const depth = (Math.sin(a) + 1) / 2;
        return <WarliFigure key={i} x={cx + Math.cos(a) * R} y={cy + Math.sin(a) * R * 0.35} s={s * (0.75 + depth * 0.4)} t={f} phase={i} />;
      })}
      {/* tarpa player */}
      <g opacity={c.draw(8, 12)}>
        <WarliFigure x={cx} y={cy} s={s * 1.3} t={f * 0.5} phase={0} />
        <path d={`M${cx + 20 * s} ${cy - 40 * s} q${30 * s} ${-10 * s} ${45 * s} ${10 * s}`} stroke="#fff" strokeWidth={6 * s} fill="none" />
      </g>
      <WarliBorderGroup w={w} h={h} d={c.draw(0, 25)} />
    </svg>
  );
}

function WarliBorderGroup({ w, h, d }: { w: number; h: number; d: number }) {
  const m = Math.min(w, h) * 0.04;
  const dots: ReactElement[] = [];
  const gap = Math.min(w, h) * 0.022;
  let k = 0;
  for (let x = m; x <= w - m; x += gap) {
    dots.push(<circle key={k++} cx={x} cy={m} r={gap * 0.22} />, <circle key={k++} cx={x} cy={h - m} r={gap * 0.22} />);
  }
  for (let y = m; y <= h - m; y += gap) {
    dots.push(<circle key={k++} cx={m} cy={y} r={gap * 0.22} />, <circle key={k++} cx={w - m} cy={y} r={gap * 0.22} />);
  }
  return (
    <g fill="#fff" opacity={d}>
      {dots}
      <rect x={m + gap} y={m + gap} width={w - 2 * (m + gap)} height={h - 2 * (m + gap)} fill="none" stroke="#fff" strokeWidth={3} strokeDasharray={`${gap * 0.8} ${gap * 0.5}`} />
    </g>
  );
}

function WarliBorder({ w, h, draw }: Ctx) {
  return (
    <svg width={w} height={h}>
      <WarliBorderGroup w={w} h={h} d={draw(0, 20)} />
    </svg>
  );
}

// ============================================================ BLUEPRINT
function BlueprintGrid({ w, h }: { w: number; h: number }) {
  const g = Math.min(w, h) / 24;
  return (
    <>
      <defs>
        <pattern id="bp-minor" width={g} height={g} patternUnits="userSpaceOnUse">
          <path d={`M${g} 0 L0 0 0 ${g}`} fill="none" stroke="#5C8DD6" strokeWidth={1} opacity={0.35} />
        </pattern>
        <pattern id="bp-major" width={g * 5} height={g * 5} patternUnits="userSpaceOnUse">
          <path d={`M${g * 5} 0 L0 0 0 ${g * 5}`} fill="none" stroke="#9CC3FF" strokeWidth={1.6} opacity={0.45} />
        </pattern>
      </defs>
      <rect width={w} height={h} fill="#0B3D91" />
      <rect width={w} height={h} fill="url(#bp-minor)" />
      <rect width={w} height={h} fill="url(#bp-major)" />
    </>
  );
}

function BlueprintScene(c: Ctx) {
  const { w, h, f, draw } = c;
  const u = Math.min(w, h);
  const cx = w / 2;
  const cy = h * 0.42;
  const line = (d: string, delay: number, len = 18, sw = 3) => (
    <path d={d} fill="none" stroke="#fff" strokeWidth={sw} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw(delay, len)} />
  );
  const R = u * 0.2;
  return (
    <svg width={w} height={h}>
      <BlueprintGrid w={w} h={h} />
      {/* gear-like part */}
      <g transform={`rotate(${f * 0.3} ${cx} ${cy})`}>
        {line(`M${cx + R} ${cy} A${R} ${R} 0 1 1 ${cx - R} ${cy} A${R} ${R} 0 1 1 ${cx + R} ${cy}`, 0, 25)}
        {line(`M${cx + R * 0.45} ${cy} A${R * 0.45} ${R * 0.45} 0 1 1 ${cx - R * 0.45} ${cy} A${R * 0.45} ${R * 0.45} 0 1 1 ${cx + R * 0.45} ${cy}`, 8, 18)}
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          const a2 = a + 0.14;
          const p = (r: number, ang: number) => `${cx + Math.cos(ang) * r} ${cy + Math.sin(ang) * r}`;
          return <g key={i}>{line(`M${p(R, a)} L${p(R * 1.18, a)} L${p(R * 1.18, a2)} L${p(R, a2)}`, 14 + i, 8, 2.5)}</g>;
        })}
      </g>
      {/* centre lines */}
      <g stroke="#9CC3FF" strokeWidth={1.5} strokeDasharray="18 6 4 6" opacity={draw(5, 10)}>
        <line x1={cx - R * 1.5} y1={cy} x2={cx + R * 1.5} y2={cy} />
        <line x1={cx} y1={cy - R * 1.5} x2={cx} y2={cy + R * 1.5} />
      </g>
      {/* dimension line */}
      <g opacity={draw(30, 12)} stroke="#fff" fill="#fff">
        <line x1={cx - R} y1={cy + R * 1.45} x2={cx + R} y2={cy + R * 1.45} strokeWidth={2} />
        <path d={`M${cx - R} ${cy + R * 1.45} l14 -6 v12Z M${cx + R} ${cy + R * 1.45} l-14 -6 v12Z`} />
        <text x={cx} y={cy + R * 1.45 - 10} textAnchor="middle" fontFamily="Consolas, monospace" fontSize={u * 0.03} stroke="none">
          Ø {(R * 2 / 10).toFixed(1)} mm
        </text>
      </g>
      {/* title block */}
      <g opacity={draw(36, 12)} stroke="#fff" fill="none" strokeWidth={2}>
        <rect x={w * 0.55} y={h * 0.88} width={w * 0.4} height={h * 0.08} />
        <line x1={w * 0.55} y1={h * 0.92} x2={w * 0.95} y2={h * 0.92} />
        <text x={w * 0.565} y={h * 0.91} fill="#fff" stroke="none" fontFamily="Consolas, monospace" fontSize={u * 0.022}>
          DWG NO. CF-001
        </text>
        <text x={w * 0.565} y={h * 0.95} fill="#fff" stroke="none" fontFamily="Consolas, monospace" fontSize={u * 0.022}>
          SCALE 1:1 · REV A
        </text>
      </g>
    </svg>
  );
}

function BlueprintBorder({ w, h, draw }: Ctx) {
  const m = Math.min(w, h) * 0.035;
  const d = draw(0, 20);
  const per = 2 * (w + h);
  const tick = Math.min(w, h) * 0.04;
  return (
    <svg width={w} height={h}>
      <rect x={m} y={m} width={w - 2 * m} height={h - 2 * m} fill="none" stroke="#9CC3FF" strokeWidth={3} strokeDasharray={per} strokeDashoffset={per * (1 - d)} />
      <g stroke="#fff" strokeWidth={3} opacity={d}>
        {[
          [m, m],
          [w - m, m],
          [m, h - m],
          [w - m, h - m],
        ].map(([x, y], i) => (
          <g key={i}>
            <line x1={x - tick} y1={y} x2={x + tick} y2={y} />
            <line x1={x} y1={y - tick} x2={x} y2={y + tick} />
            <circle cx={x} cy={y} r={tick * 0.45} fill="none" />
          </g>
        ))}
      </g>
    </svg>
  );
}

// ============================================================ UKIYO-E
function wavePath(w: number, base: number, amp: number, len: number, shift: number) {
  let d = `M${-len + (shift % len)} ${base}`;
  for (let x = -len + (shift % len); x < w + len; x += len) {
    d += ` q${len * 0.25} ${-amp * 1.4} ${len * 0.5} ${-amp * 0.2} q${len * 0.12} ${amp * 0.5} ${len * 0.5} ${amp * 0.2}`;
  }
  return d;
}

function UkiyoeScene(c: Ctx) {
  const { w, h, f } = c;
  const u = Math.min(w, h);
  const layers = [
    { base: h * 0.62, amp: u * 0.06, len: w * 0.35, speed: 0.6, col: '#5C7FA6' },
    { base: h * 0.72, amp: u * 0.08, len: w * 0.42, speed: -0.9, col: '#2F4E7A' },
    { base: h * 0.84, amp: u * 0.1, len: w * 0.5, speed: 1.2, col: '#1F2A44' },
  ];
  return (
    <svg width={w} height={h}>
      <rect width={w} height={h} fill="#F3E6CC" />
      <Grain id="uk-g" opacity={0.3} freq={0.85} />
      <circle cx={w * 0.72} cy={h * 0.26} r={u * 0.11} fill="#C8452F" opacity={c.p} />
      {/* distant mountain */}
      <path d={`M${w * 0.18} ${h * 0.58} L${w * 0.34} ${h * 0.38} L${w * 0.5} ${h * 0.58}Z`} fill="#8FA8C8" opacity={c.draw(5, 20)} />
      <path d={`M${w * 0.29} ${h * 0.44} L${w * 0.34} ${h * 0.38} L${w * 0.39} ${h * 0.44} L${w * 0.355} ${h * 0.43} L${w * 0.34} ${h * 0.45} L${w * 0.32} ${h * 0.43}Z`} fill="#fff" opacity={c.draw(5, 20)} />
      {layers.map((l, i) => {
        const d = wavePath(w, l.base, l.amp, l.len, f * l.speed * 2);
        return (
          <g key={i}>
            <path d={`${d} L${w + l.len} ${h} L${-l.len} ${h}Z`} fill={l.col} />
            <path d={d} fill="none" stroke="#F3E6CC" strokeWidth={u * 0.006} strokeDasharray={`${u * 0.02} ${u * 0.015}`} />
          </g>
        );
      })}
      {/* foam dots */}
      {Array.from({ length: 30 }, (_, i) => (
        <circle key={i} cx={(random(`fx${i}`) * w + f * 2) % w} cy={h * 0.6 + random(`fy${i}`) * h * 0.3} r={u * 0.006} fill="#F3E6CC" opacity={0.85} />
      ))}
      {/* cartouche */}
      <g opacity={c.draw(10, 15)}>
        <rect x={w * 0.07} y={h * 0.08} width={u * 0.09} height={u * 0.32} fill="#F7EDD8" stroke="#1F2A44" strokeWidth={3} />
        <rect x={w * 0.07 + u * 0.012} y={h * 0.08 + u * 0.012} width={u * 0.066} height={u * 0.296} fill="none" stroke="#B23A2B" strokeWidth={2} />
      </g>
    </svg>
  );
}

function UkiyoeBorder({ w, h, f, draw }: Ctx) {
  const u = Math.min(w, h);
  const d = draw(0, 20);
  const m = u * 0.03;
  const wave = wavePath(w, h - m * 1.5, u * 0.03, w * 0.18, f * 1.5);
  return (
    <svg width={w} height={h}>
      <rect x={m} y={m} width={w - 2 * m} height={h - 2 * m} fill="none" stroke="#1F2A44" strokeWidth={u * 0.012} opacity={d} />
      <g opacity={d}>
        <path d={`${wave} L${w} ${h} L0 ${h}Z`} fill="#2F4E7A" />
        <path d={wave} fill="none" stroke="#F3E6CC" strokeWidth={u * 0.004} />
      </g>
      <rect x={w - m - u * 0.07} y={m + u * 0.02} width={u * 0.05} height={u * 0.05} fill="#B23A2B" opacity={d} />
    </svg>
  );
}

// ============================================================ MINIATURE PAINTING
function goldVine(x1: number, y1: number, x2: number, y2: number, n: number, key: string, size: number) {
  const out: ReactElement[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = x1 + (x2 - x1) * t;
    const y = y1 + (y2 - y1) * t;
    out.push(
      <g key={`${key}${i}`} transform={`translate(${x},${y})`}>
        <circle r={size * 0.35} fill="#D4A537" />
        <circle r={size * 0.16} fill="#8E1B1B" />
        {[0, 90, 180, 270].map((a) => (
          <ellipse key={a} transform={`rotate(${a + 45})`} cx={size * 0.55} rx={size * 0.28} ry={size * 0.12} fill="#2E6B3A" />
        ))}
      </g>
    );
  }
  return out;
}

function miniatureFrame(w: number, h: number, d: number, f: number) {
  const u = Math.min(w, h);
  const m = u * 0.03;
  const band = u * 0.07;
  const size = band * 0.6;
  const n = (len: number) => Math.max(4, Math.round(len / (band * 1.1)));
  const shimmerX = ((f * 8) % (w + h)) - h;
  return (
    <g opacity={d}>
      <defs>
        <linearGradient id="mi-sheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`M0 0H${w}V${h}H0Z M${m + band} ${m + band}V${h - m - band}H${w - m - band}V${m + band}Z`} fillRule="evenodd" fill="#5B1A18" />
      <rect x={m} y={m} width={w - 2 * m} height={h - 2 * m} fill="none" stroke="#D4A537" strokeWidth={u * 0.008} />
      <rect x={m + band} y={m + band} width={w - 2 * (m + band)} height={h - 2 * (m + band)} fill="none" stroke="#D4A537" strokeWidth={u * 0.008} />
      {goldVine(m + band / 2, m + band / 2, w - m - band / 2, m + band / 2, n(w), 't', size)}
      {goldVine(m + band / 2, h - m - band / 2, w - m - band / 2, h - m - band / 2, n(w), 'b', size)}
      {goldVine(m + band / 2, m + band * 1.6, m + band / 2, h - m - band * 1.6, n(h), 'l', size)}
      {goldVine(w - m - band / 2, m + band * 1.6, w - m - band / 2, h - m - band * 1.6, n(h), 'r', size)}
      <rect x={shimmerX} y={-h} width={u * 0.25} height={h * 3} fill="url(#mi-sheen)" transform={`rotate(25 ${w / 2} ${h / 2})`} opacity={0.35} style={{ mixBlendMode: 'screen' }} />
    </g>
  );
}

function MiniatureScene(c: Ctx) {
  const { w, h, f } = c;
  const u = Math.min(w, h);
  const ax = w * 0.22;
  const aw = w * 0.56;
  const ay = h * 0.18;
  const ah = h * 0.55;
  const arch = `M${ax} ${ay + ah} V${ay + aw * 0.45} Q${ax} ${ay} ${ax + aw / 2} ${ay - aw * 0.08} Q${ax + aw} ${ay} ${ax + aw} ${ay + aw * 0.45} V${ay + ah}Z`;
  return (
    <svg width={w} height={h}>
      <defs>
        <linearGradient id="mi-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1B3A6B" />
          <stop offset="0.7" stopColor="#E9A75A" />
          <stop offset="1" stopColor="#F7D9A0" />
        </linearGradient>
        <clipPath id="mi-arch">
          <path d={arch} />
        </clipPath>
      </defs>
      <rect width={w} height={h} fill="#2E6B3A" />
      <Grain id="mi-g" opacity={0.3} />
      <g clipPath="url(#mi-arch)" opacity={c.p}>
        <rect x={ax} y={ay - aw * 0.1} width={aw} height={ah + aw * 0.1} fill="url(#mi-sky)" />
        <circle cx={ax + aw * 0.7} cy={ay + ah * 0.35} r={u * 0.05} fill="#FBE7B0" />
        {[0.2, 0.5, 0.8].map((t, i) => (
          <path key={i} d={`M${ax + aw * t} ${ay + ah} q${-u * 0.03} ${-u * 0.12} 0 ${-u * 0.28} q${u * 0.03} ${u * 0.16} 0 ${u * 0.28}Z`} fill="#1E4D2B" />
        ))}
        {Array.from({ length: 4 }, (_, i) => (
          <path key={i} transform={`translate(${ax + ((f * 1.5 + i * aw * 0.3) % aw)},${ay + ah * (0.2 + i * 0.07)})`} d="M0 0 q8 -8 16 0 q8 -8 16 0" stroke="#3B2A1A" strokeWidth={3} fill="none" />
        ))}
      </g>
      <path d={arch} fill="none" stroke="#D4A537" strokeWidth={u * 0.012} />
      <path d={arch} fill="none" stroke="#8E1B1B" strokeWidth={u * 0.004} transform={`translate(0,0)`} />
      {/* floral ground */}
      {Array.from({ length: 18 }, (_, i) => {
        const x = (i / 17) * w;
        const y = h * 0.82 + Math.sin(i) * h * 0.02;
        return (
          <g key={i} transform={`translate(${x},${y})`} opacity={c.draw(10 + i, 8)}>
            {[0, 72, 144, 216, 288].map((a) => (
              <ellipse key={a} transform={`rotate(${a})`} cy={-u * 0.012} rx={u * 0.006} ry={u * 0.012} fill={i % 3 ? '#E8C1C5' : '#F6E27F'} />
            ))}
            <circle r={u * 0.005} fill="#8E1B1B" />
          </g>
        );
      })}
      {miniatureFrame(w, h, c.draw(0, 25), f)}
    </svg>
  );
}

function MiniatureBorder({ w, h, f, draw }: Ctx) {
  return <svg width={w} height={h}>{miniatureFrame(w, h, draw(0, 20), f)}</svg>;
}

// ============================================================ registry
/** Procedural vector backdrop for the four engine themes (memoised: one SVG string per theme/size). */
const vectorScenes = new Map<string, string>();
const VECTOR_BACKDROP: Record<string, Partial<EnvSpec>> = {
  storybook: { kind: 'forest', time: 'sunset' },
  flatVector: { kind: 'city', time: 'day' },
  handDrawn: { kind: 'village', time: 'day' },
  cartoon: { kind: 'fantasy', time: 'day' },
};
function vectorScene(theme: ThemeId) {
  return (c: Ctx) => {
    const key = `${theme}:${c.w}x${c.h}`;
    if (!vectorScenes.has(key)) vectorScenes.set(key, environmentSvg(normaliseEnv(VECTOR_BACKDROP[theme]), theme, c.w, c.h));
    // gentle drift so the card is not static
    const drift = Math.sin(c.f / 50) * c.w * 0.006;
    return <div style={{ position: 'absolute', inset: 0, transform: `scale(1.04) translateX(${drift}px)` }} dangerouslySetInnerHTML={{ __html: vectorScenes.get(key) as string }} />;
  };
}
const vectorBorder = (color: string, width: number, radius: number) => (c: Ctx) => (
  <svg width={c.w} height={c.h}>
    <rect x={width / 2 + c.w * 0.025} y={width / 2 + c.w * 0.025} width={c.w * 0.95 - width} height={c.h - c.w * 0.05 - width} rx={radius} fill="none" stroke={color} strokeWidth={width} />
  </svg>
);

const SCENES: Record<ArtStyleId, (c: Ctx) => ReactElement> = {
  storybook: vectorScene('storybook'),
  flatVector: vectorScene('flatVector'),
  handDrawn: vectorScene('handDrawn'),
  cartoon: vectorScene('cartoon'),
  madhubani: MadhubaniScene,
  inkWash: InkWashScene,
  shadowPuppet: ShadowPuppetScene,
  paperCutout: PaperCutoutScene,
  stainedGlass: StainedGlassScene,
  anime: AnimeScene,
  warli: WarliScene,
  blueprint: BlueprintScene,
  ukiyoe: UkiyoeScene,
  miniature: MiniatureScene,
};

const BORDERS: Record<ArtStyleId, (c: Ctx) => ReactElement> = {
  storybook: vectorBorder('#FFF4DC', 18, 28),
  flatVector: vectorBorder('#E9C46A', 10, 0),
  handDrawn: vectorBorder('#2A2622', 5, 6),
  cartoon: vectorBorder('#1D1B1F', 16, 22),
  madhubani: (c) => <svg width={c.w} height={c.h}>{madhubaniBorder(c)}</svg>,
  inkWash: InkWashBorder,
  shadowPuppet: ShadowPuppetBorder,
  paperCutout: PaperCutoutBorder,
  stainedGlass: StainedGlassBorder,
  anime: AnimeBorder,
  warli: WarliBorder,
  blueprint: BlueprintBorder,
  ukiyoe: UkiyoeBorder,
  miniature: MiniatureBorder,
};

type P = Record<string, string | number | boolean>;
const str = (v: unknown, d = '') => (v === undefined || v === null || v === '' ? d : String(v));

function useOut() {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
}

/** Title text styled for the art style, with a style-specific entrance. */
function StyledTitle({ style, text, sub, ctx, size = 1 }: { style: ArtStyleId; text: string; sub: string; ctx: Ctx; size?: number }) {
  const s = ART_STYLES[style];
  const { w, h, f, fps } = ctx;
  const portrait = h > w;
  const fs = w * (portrait ? 0.09 : 0.06) * size * (s.titleScale ?? 1);
  const t = spring({ frame: f - 6, fps, config: { damping: style === 'anime' ? 9 : 16, stiffness: style === 'anime' ? 220 : 100 } });
  let transform = `translateY(${(1 - t) * 40}px)`;
  let clip: string | undefined;
  let shown = text;
  if (style === 'anime') transform = `scale(${2.2 - 1.2 * t}) rotate(${-4 * t}deg)`;
  if (style === 'inkWash') clip = `inset(0 ${100 - t * 100}% 0 0)`;
  if (style === 'blueprint') shown = text.slice(0, Math.round(clamp01((f - 6) / (text.length * 1.2)) * text.length));
  if (style === 'paperCutout') transform = `translateY(${(1 - t) * 60}px) rotate(${(1 - t) * -6}deg)`;
  const box: CSSProperties = {};
  if (style === 'madhubani') Object.assign(box, { background: '#F6E7C1', border: `${fs * 0.08}px solid #111`, outline: `${fs * 0.06}px solid #C1272D`, outlineOffset: fs * 0.08, padding: `${fs * 0.25}px ${fs * 0.5}px` });
  if (style === 'ukiyoe') Object.assign(box, { background: '#F7EDD8', border: '3px solid #1F2A44', padding: `${fs * 0.25}px ${fs * 0.45}px`, boxShadow: 'inset 0 0 0 6px #F7EDD8, inset 0 0 0 8px #B23A2B' });
  if (style === 'paperCutout') Object.assign(box, { background: '#FF6B6B', padding: `${fs * 0.25}px ${fs * 0.5}px`, borderRadius: fs * 0.12, boxShadow: '0 12px 28px rgba(0,0,0,.25)' });
  if (style === 'blueprint') Object.assign(box, { border: '3px solid #fff', padding: `${fs * 0.2}px ${fs * 0.4}px`, background: 'rgba(11,61,145,.75)' });
  if (style === 'stainedGlass') Object.assign(box, { background: 'rgba(20,20,20,.72)', border: `${fs * 0.08}px solid #E0B53A`, borderRadius: `${fs * 1.2}px ${fs * 1.2}px ${fs * 0.15}px ${fs * 0.15}px`, padding: `${fs * 0.35}px ${fs * 0.55}px` });
  if (style === 'miniature') Object.assign(box, { background: 'rgba(91,26,24,.88)', border: `${fs * 0.05}px solid #D4A537`, padding: `${fs * 0.2}px ${fs * 0.55}px`, borderRadius: fs * 0.1 });
  if (style === 'warli') Object.assign(box, { border: '3px dashed #fff', padding: `${fs * 0.2}px ${fs * 0.45}px` });
  if (style === 'shadowPuppet') Object.assign(box, { padding: `${fs * 0.1}px ${fs * 0.3}px` });
  return (
    <div style={{ textAlign: 'center', maxWidth: '84%', opacity: clamp01(t * 1.5), transform, clipPath: clip, ...box }}>
      <div
        style={{
          fontFamily: s.font,
          fontSize: style === 'miniature' ? fs * 1.15 : fs,
          fontWeight: style === 'inkWash' || style === 'miniature' ? 400 : 800,
          lineHeight: 1.08,
          color: s.titleColor,
          textTransform: s.upper ? 'uppercase' : 'none',
          letterSpacing: style === 'blueprint' ? '0.06em' : style === 'anime' ? '0.01em' : undefined,
          WebkitTextStroke: s.titleStroke ? `${Math.max(2, fs * 0.05)}px ${s.titleStroke}` : undefined,
          paintOrder: 'stroke fill',
          textShadow: s.titleShadow,
        }}
      >
        {shown}
      </div>
      {sub && (
        <div style={{ marginTop: fs * 0.2, fontFamily: s.font, fontSize: fs * 0.36, color: s.titleColor, opacity: 0.85, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{sub}</div>
      )}
    </div>
  );
}

/** Template: full-screen art-style title card. */
export function ArtCard({ props }: { props: P }) {
  const ctx = useCtx();
  const style = artStyle(props.style);
  const out = useOut();
  const Scene = SCENES[style];
  const title = props.text === undefined ? ART_STYLES[style].label : String(props.text);
  const requested = str(props.position, 'auto');
  const pos = requested === 'auto' || (requested === 'center' && ART_STYLES[style].titlePos === 'top') ? ART_STYLES[style].titlePos ?? 'center' : requested;
  return (
    <AbsoluteFill style={{ opacity: out }}>
      {/* dim: fade the scene towards its base colour so graphics on top stay readable */}
      <AbsoluteFill style={{ background: ART_STYLES[style].bannerBg }}>
        <AbsoluteFill style={{ opacity: 1 - Math.max(0, Math.min(0.9, Number(props.dim) || 0)) }}>{Scene(ctx)}</AbsoluteFill>
      </AbsoluteFill>
      <AbsoluteFill style={{ justifyContent: pos === 'top' ? 'flex-start' : pos === 'bottom' ? 'flex-end' : 'center', alignItems: 'center', padding: ctx.h * 0.12 }}>
        {/* an empty title turns the card into a pure animated backdrop (used under stats, charts, quotes) */}
        {title.trim() && <StyledTitle style={style} text={title} sub={str(props.subtitle)} ctx={ctx} size={Number(props.size) || 1} />}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/** Template: decorative art-style border over the footage. */
export function ArtFrame({ props }: { props: P }) {
  const ctx = useCtx();
  const style = artStyle(props.style);
  const out = useOut();
  const Border = BORDERS[style];
  return <AbsoluteFill style={{ opacity: out * (Number(props.opacity) || 1) }}>{Border(ctx)}</AbsoluteFill>;
}

/** Template: art-style caption banner (lower area). */
export function ArtBanner({ props }: { props: P }) {
  const ctx = useCtx();
  const style = artStyle(props.style);
  const s = ART_STYLES[style];
  const out = useOut();
  const { w, h, f, fps } = ctx;
  const t = spring({ frame: f, fps, config: { damping: 15 } });
  // sized from the shorter side so 9:16 and 16:9 titles look the same; long text shrinks to stay on 1–2 lines
  const text = str(props.text, 'Your caption here');
  // long text wraps rather than shrinking past readable (at most 2 short lines' worth of shrink)
  const fit = Math.max(0.8, Math.min(1, 28 / Math.max(1, text.length)));
  const fs = Math.min(w, h) * 0.042 * (Number(props.size) || 1) * fit * (style === 'inkWash' ? 1.15 : 1);
  const pos = str(props.position, 'bottom');
  return (
    <AbsoluteFill style={{ justifyContent: pos === 'top' ? 'flex-start' : 'flex-end', alignItems: 'center', padding: `${h * (pos === 'top' ? 0.07 : 0.16)}px ${w * 0.06}px`, opacity: out }}>
      <div
        style={{
          maxWidth: '80%',
          background: s.bannerBg,
          color: s.bannerText,
          fontFamily: s.font,
          fontWeight: style === 'miniature' || style === 'inkWash' ? 400 : 700,
          fontSize: style === 'miniature' ? fs * 1.2 : fs,
          lineHeight: 1.2,
          textAlign: 'center',
          padding: `${fs * 0.4}px ${fs * 0.7}px`,
          border: `${Math.max(3, fs * 0.08)}px ${style === 'warli' ? 'dashed' : 'solid'} ${s.bannerBorder}`,
          borderRadius: style === 'paperCutout' ? fs * 0.3 : style === 'stainedGlass' ? `${fs}px ${fs}px ${fs * 0.15}px ${fs * 0.15}px` : 4,
          boxShadow: style === 'paperCutout' ? '0 10px 24px rgba(0,0,0,.3)' : style === 'shadowPuppet' ? '0 0 40px rgba(255,154,60,.45)' : '0 10px 30px rgba(0,0,0,.35)',
          textTransform: s.upper ? 'uppercase' : 'none',
          transform: `translateY(${(1 - t) * 60}px) ${style === 'anime' ? `skewX(-8deg)` : ''}`,
          opacity: t,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
}
