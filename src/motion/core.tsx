/**
 * Motion engine core: the context every effect renderer receives, timing helpers (start/duration/stagger
 * in seconds, scaled by the effect's speed), the shared enter/exit grammar, hand-drawn paths, and path drawing.
 */
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { evolvePath } from '@remotion/paths';
import { ease } from './easing.ts';
import { rng, smoothPath, type Pt } from '../vector/geom.ts';

export type Props = Record<string, string | number | boolean>;

export interface Motion {
  f: number; // frame
  fps: number;
  w: number;
  h: number;
  u: number; // 1% of the short side — all sizes are in u so effects scale with the frame
  portrait: boolean;
  D: number; // duration in seconds
  t: number; // current time in seconds (speed-scaled)
  p: Props;
  /** progress of a window [start, start+dur] in seconds; easing from the effect unless given */
  at: (start: number, dur: number, easing?: string) => number;
  /** 1 → 0 over the last `len` seconds (exit) */
  out: number;
  str: (k: string, d?: string) => string;
  num: (k: string, d?: number) => number;
  bool: (k: string, d?: boolean) => boolean;
  color: string;
  accent: string;
  bg: string;
  ink: string;
  font: string;
}

export const FONTS: Record<string, string> = {
  sans: '"Plus Jakarta Sans", "DM Sans", "Segoe UI", Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  condensed: '"Arial Narrow", "Roboto Condensed", "Segoe UI", sans-serif',
  marker: '"Segoe Print", "Comic Sans MS", "Bradley Hand", cursive',
  mono: '"JetBrains Mono", Consolas, "Courier New", monospace',
  impact: 'Impact, "Arial Black", "Segoe UI Black", sans-serif',
};

export function useMotion(p: Props): Motion {
  const f = useCurrentFrame();
  const { fps, width: w, height: h, durationInFrames } = useVideoConfig();
  const speed = Math.max(0.25, Math.min(4, Number(p.speed) || 1));
  const delay = Number(p.delay) || 0;
  const t = (f / fps) * speed - delay;
  // inside a sequence each step passes its own length; on the timeline the item's Sequence gives it
  const D = (Number(p.__dur) > 0 ? Number(p.__dur) : durationInFrames / fps) * speed;
  const easeName = String(p.easing ?? 'editorial');
  const exitLen = Math.min(0.45, D * 0.2);
  const exitKind = String(p.exit ?? 'fade');
  const out = exitKind === 'none' ? 1 : Math.max(0, Math.min(1, (D - delay - t) / exitLen));
  const str = (k: string, d = '') => (p[k] === undefined || p[k] === null || p[k] === '' ? d : String(p[k]));
  const num = (k: string, d = 0) => (Number.isFinite(Number(p[k])) && p[k] !== '' ? Number(p[k]) : d);
  const bool = (k: string, d = false) => (p[k] === undefined ? d : p[k] === true || p[k] === 'true' || p[k] === 1 || p[k] === 'yes');
  return {
    f,
    fps,
    w,
    h,
    u: Math.min(w, h) / 100,
    portrait: h > w,
    D,
    t,
    p,
    at: (start, dur, easing) => ease(easing ?? easeName)((t - start) / Math.max(0.001, dur)),
    out,
    str,
    num,
    bool,
    color: str('color', '#FFFFFF'),
    accent: str('accent', '#F9D84A'),
    bg: str('bg', '#F4EFE6'),
    ink: str('ink', '#1D1D1B'),
    font: FONTS[str('font', 'sans')] ?? FONTS.sans,
  };
}

// ---------------------------------------------------------------- enter / exit grammar
export type Anim = 'fade' | 'up' | 'down' | 'left' | 'right' | 'scale' | 'pop' | 'blur' | 'wipe' | 'mask' | 'rotate' | 'flip' | 'drop' | 'tracking' | 'none';
export const ANIMS: Anim[] = ['up', 'fade', 'down', 'left', 'right', 'scale', 'pop', 'blur', 'wipe', 'mask', 'rotate', 'flip', 'drop', 'tracking', 'none'];

/** Style for an element entering with progress k (0 hidden → 1 settled). Overshooting k (back/elastic) is fine. */
export function enter(anim: string, k: number, dist = 40): CSSProperties {
  const c = Math.max(0, Math.min(1, k));
  switch (anim as Anim) {
    case 'none':
      return {};
    case 'fade':
      return { opacity: c };
    case 'up':
      return { opacity: c, transform: `translateY(${(1 - k) * dist}px)` };
    case 'down':
      return { opacity: c, transform: `translateY(${-(1 - k) * dist}px)` };
    case 'left':
      return { opacity: c, transform: `translateX(${(1 - k) * dist * 1.5}px)` };
    case 'right':
      return { opacity: c, transform: `translateX(${-(1 - k) * dist * 1.5}px)` };
    case 'scale':
      return { opacity: c, transform: `scale(${0.6 + 0.4 * k})` };
    case 'pop':
      return { opacity: c, transform: `scale(${k})` };
    case 'blur':
      return { opacity: c, filter: `blur(${(1 - c) * 14}px)` };
    case 'wipe':
      return { clipPath: `inset(0 ${(1 - c) * 100}% 0 0)` };
    case 'mask':
      return { clipPath: `inset(${(1 - c) * 100}% 0 0 0)`, transform: `translateY(${(1 - k) * dist * 0.6}px)` };
    case 'rotate':
      return { opacity: c, transform: `rotate(${(1 - k) * -18}deg) translateY(${(1 - k) * dist * 0.5}px)`, transformOrigin: 'left bottom' };
    case 'flip':
      return { opacity: c, transform: `perspective(600px) rotateX(${(1 - k) * 90}deg)`, transformOrigin: 'center bottom' };
    case 'drop':
      return { opacity: c, transform: `translateY(${-(1 - k) * dist * 3}px)` };
    case 'tracking':
      return { opacity: c, letterSpacing: `${(1 - c) * 0.6}em` };
    default:
      return { opacity: c };
  }
}

/** Exit style from m.out (1 visible → 0 gone). */
export function exitStyle(m: Motion): CSSProperties {
  const k = m.out;
  if (k >= 1) return {};
  switch (m.str('exit', 'fade')) {
    case 'none':
      return {};
    case 'slide':
      return { opacity: k, transform: `translateY(${-(1 - k) * 6 * m.u}px)` };
    case 'scale':
      return { opacity: k, transform: `scale(${0.85 + 0.15 * k})` };
    case 'wipe':
      return { clipPath: `inset(0 0 0 ${(1 - k) * 100}%)` };
    case 'blur':
      return { opacity: k, filter: `blur(${(1 - k) * 12}px)` };
    default:
      return { opacity: k };
  }
}

// ---------------------------------------------------------------- drawing helpers
/** Stroke a path progressively (0 → 1). Works for any SVG path d. */
export function Draw({ d, k, stroke, width, dash, cap = 'round', opacity = 1, fill = 'none', fixed = false }: { d: string; k: number; stroke: string; width: number; dash?: string; cap?: 'round' | 'butt' | 'square'; opacity?: number; fill?: string; fixed?: boolean }): ReactElement | null {
  const c = Math.max(0, Math.min(1, k));
  if (c <= 0) return null;
  if (dash) {
    // dashed/dotted lines can't use dash-offset drawing; reveal them with a growing mask instead
    const ev = evolvePath(c, d);
    const id = `m${Math.abs(hashStr(d)) % 1e8}`;
    return (
      <g>
        <defs>
          <mask id={id}>
            <path d={d} fill="none" stroke="#fff" strokeWidth={width * 2.5} strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} strokeLinecap="round" />
          </mask>
        </defs>
        <path d={d} fill={fill} stroke={stroke} strokeWidth={width} strokeDasharray={dash} strokeLinecap={cap} opacity={opacity} mask={`url(#${id})`} />
      </g>
    );
  }
  if (fixed) return <path d={d} fill={fill} stroke={stroke} strokeWidth={width} strokeLinecap={cap} strokeLinejoin="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - c} opacity={opacity} vectorEffect="non-scaling-stroke" />;
  const ev = evolvePath(c, d);
  return <path d={d} fill={fill} stroke={stroke} strokeWidth={width} strokeLinecap={cap} strokeLinejoin="round" strokeDasharray={ev.strokeDasharray} strokeDashoffset={ev.strokeDashoffset} opacity={opacity} />;
}

const hashStr = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
};

/** Hand-drawn ellipse: 1.15 turns with wobble, like a marker circle around something. */
export function scribbleEllipse(cx: number, cy: number, rx: number, ry: number, seed = 1, turns = 1.15, jitter = 0.06): string {
  const r = rng(seed);
  const n = 48;
  const pts: Pt[] = [];
  const start = r.range(-0.6, -0.2);
  for (let i = 0; i <= n * turns; i++) {
    const a = start + (i / n) * Math.PI * 2;
    const k = 1 + (r() - 0.5) * jitter + (i / (n * turns)) * 0.05;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return smoothPath(pts, false, 0.6);
}

/** Hand-drawn rectangle (slightly overshooting corners). */
export function scribbleRect(x: number, y: number, w: number, h: number, seed = 1): string {
  const r = rng(seed);
  const j = () => (r() - 0.5) * Math.min(w, h) * 0.04;
  const pts: Pt[] = [
    [x - w * 0.02 + j(), y + j()],
    [x + w + j(), y + j()],
    [x + w + j(), y + h + j()],
    [x + j(), y + h + j()],
    [x + j(), y - h * 0.04 + j()],
    [x + w * 0.2, y + j()],
  ];
  return `M${pts.map((p) => p.map((v) => v.toFixed(1)).join(' ')).join(' L')}`;
}

/** Hand-drawn line between two points (slight bow). */
export function scribbleLine(a: Pt, b: Pt, seed = 1, bow = 0.04): string {
  const r = rng(seed);
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const nx = -(b[1] - a[1]) / (len || 1);
  const ny = (b[0] - a[0]) / (len || 1);
  const off = (r() - 0.3) * len * bow;
  return `M${a[0].toFixed(1)} ${a[1].toFixed(1)} Q${(mx + nx * off).toFixed(1)} ${(my + ny * off).toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`;
}

/** Arrow from a to b (optionally curved) + its head, as path strings. */
export function arrowPaths(a: Pt, b: Pt, curve = 0.25, head = 30): { shaft: string; head: string } {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const c: Pt = [mx - dy * curve, my + dx * curve];
  const ang = Math.atan2(b[1] - c[1], b[0] - c[0]);
  const h1: Pt = [b[0] - Math.cos(ang - 0.45) * head, b[1] - Math.sin(ang - 0.45) * head];
  const h2: Pt = [b[0] - Math.cos(ang + 0.45) * head, b[1] - Math.sin(ang + 0.45) * head];
  return {
    shaft: `M${a[0]} ${a[1]} Q${c[0]} ${c[1]} ${b[0]} ${b[1]}`,
    head: `M${h1[0]} ${h1[1]} L${b[0]} ${b[1]} L${h2[0]} ${h2[1]}`,
  };
}

/** Parse "A:10, B:20" / "2001:3.2; 2010:5" into label/value pairs (values may be "a|b" for stacked series). */
export function parseData(s: string, fallback = 'A:30, B:55, C:80'): { label: string; values: number[] }[] {
  const src = (s || fallback).split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean);
  const out = src
    .map((part) => {
      const i = part.lastIndexOf(':');
      if (i < 0) return null;
      const values = part
        .slice(i + 1)
        .split('|')
        .map((v) => Number(v.replace(/[^\d.\-]/g, '')))
        .filter((v) => Number.isFinite(v));
      return values.length ? { label: part.slice(0, i).trim(), values } : null;
    })
    .filter((x): x is { label: string; values: number[] } => Boolean(x));
  return out.length ? out : parseData(fallback, 'A:30, B:55, C:80');
}

/** Number formatting for counters: thousands separators (Indian lakh/crore grouping optional), decimals, currency. */
export function formatNumber(v: number, opts: { decimals?: number; grouping?: 'intl' | 'indian' | 'none'; prefix?: string; suffix?: string } = {}): string {
  const d = Math.max(0, Math.min(4, opts.decimals ?? 0));
  const neg = v < 0;
  const fixed = Math.abs(v).toFixed(d);
  let [int, frac] = fixed.split('.');
  if (opts.grouping !== 'none') {
    if (opts.grouping === 'indian' && int.length > 3) int = `${int.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${int.slice(-3)}`;
    else int = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  return `${neg ? '−' : ''}${opts.prefix ?? ''}${int}${frac ? `.${frac}` : ''}${opts.suffix ?? ''}`;
}

/** Full-frame absolutely-positioned stage, centred on (x%, y%) with the effect's scale and exit applied. */
export function Stage({ m, children, center = true, style }: { m: Motion; children: ReactNode; center?: boolean; style?: CSSProperties }) {
  const x = m.num('x', 50);
  const y = m.num('y', 50);
  const s = m.num('scale', 1);
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...exitStyle(m) }}>
      <div
        style={{
          position: 'absolute',
          left: `${x}%`,
          top: `${y}%`,
          transform: `translate(-50%, -50%) scale(${s})`,
          width: center ? m.w * 0.9 : m.w,
          display: 'flex',
          flexDirection: 'column',
          alignItems: center ? 'center' : 'stretch',
          ...style,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Full-frame SVG layer in frame pixels. */
export function Svg({ m, children, style }: { m: Motion; children: ReactNode; style?: CSSProperties }) {
  return (
    <svg width={m.w} height={m.h} viewBox={`0 0 ${m.w} ${m.h}`} style={{ position: 'absolute', inset: 0, overflow: 'visible', ...exitStyle(m), ...style }}>
      {children}
    </svg>
  );
}

/** Highlighter sweep on an inline phrase that may wrap: background grows left→right through every line fragment. */
export function sweep(k: number, color: string): CSSProperties {
  return {
    backgroundImage: `linear-gradient(${color}, ${color})`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: `${Math.max(0, Math.min(1, k)) * 100}% 78%`,
    backgroundPosition: '0 70%',
    boxDecorationBreak: 'slice',
    WebkitBoxDecorationBreak: 'slice',
    padding: '0 0.08em',
  };
}

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
