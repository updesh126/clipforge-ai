/**
 * Geometry core for the procedural vector engine: seeded randomness, vectors, Bézier path construction,
 * tapered limbs, noise blobs, fractal ridges and Poisson-disc sampling. No DOM, no dependencies.
 */
export type Pt = [number, number];

// ---------------------------------------------------------------- randomness (deterministic → reproducible art)
export function hashString(s: string): number {
  let h = 2166136261; // FNV-1a
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface Rng {
  (): number; // [0,1)
  range(a: number, b: number): number;
  int(a: number, b: number): number; // inclusive
  pick<T>(xs: readonly T[]): T;
  chance(p: number): boolean;
  fork(label: string | number): Rng; // independent stream: adding a feature never reshuffles the others
}

export function rng(seed: number | string): Rng {
  let a = (typeof seed === 'string' ? hashString(seed) : seed) >>> 0;
  const base = a;
  const next = (() => {
    // mulberry32
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }) as Rng;
  next.range = (x, y) => x + (y - x) * next();
  next.int = (x, y) => Math.floor(x + (y - x + 1) * next());
  next.pick = (xs) => xs[Math.floor(next() * xs.length) % xs.length];
  next.chance = (p) => next() < p;
  next.fork = (label) => rng((base ^ hashString(String(label))) >>> 0);
  return next;
}

/** 1-D value noise (smooth, seeded) for ridges, skylines, hair bumps. */
export function noise1(seed: number) {
  const r = rng(seed);
  const table = Array.from({ length: 256 }, () => r());
  return (x: number) => {
    const i = Math.floor(x);
    const f = x - i;
    const t = f * f * (3 - 2 * f);
    return table[i & 255] * (1 - t) + table[(i + 1) & 255] * t;
  };
}

/** Fractal (octave) noise in [0,1]. */
export function fbm1(seed: number, octaves = 4) {
  const ns = Array.from({ length: octaves }, (_, o) => noise1(seed + o * 101));
  return (x: number) => {
    let v = 0;
    let amp = 0.5;
    let tot = 0;
    for (let o = 0; o < octaves; o++) {
      v += ns[o](x * 2 ** o) * amp;
      tot += amp;
      amp *= 0.5;
    }
    return v / tot;
  };
}

// ---------------------------------------------------------------- vectors
export const add = (a: Pt, b: Pt): Pt => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: Pt, b: Pt): Pt => [a[0] - b[0], a[1] - b[1]];
export const mul = (a: Pt, k: number): Pt => [a[0] * k, a[1] * k];
export const len = (a: Pt) => Math.hypot(a[0], a[1]);
export const norm = (a: Pt): Pt => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l];
};
export const perp = (a: Pt): Pt => [-a[1], a[0]];
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerpPt = (a: Pt, b: Pt, t: number): Pt => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const rad = (deg: number) => (deg * Math.PI) / 180;
/** Point at `length` from `from`, `deg` measured from straight down, positive = towards +x. */
export const polar = (from: Pt, deg: number, length: number): Pt => [from[0] + Math.sin(rad(deg)) * length, from[1] + Math.cos(rad(deg)) * length];
export const rotate = (p: Pt, c: Pt, deg: number): Pt => {
  const a = rad(deg);
  const [x, y] = sub(p, c);
  return [c[0] + x * Math.cos(a) - y * Math.sin(a), c[1] + x * Math.sin(a) + y * Math.cos(a)];
};

// ---------------------------------------------------------------- paths
const f = (n: number) => (Math.round(n * 10) / 10).toString();
export const fmt = (p: Pt) => `${f(p[0])} ${f(p[1])}`;

/** Catmull-Rom spline through points → cubic Bézier path. tension 0 = sharp polygon, 1 = very round. */
export function smoothPath(pts: Pt[], closed = true, tension = 0.5): string {
  const n = pts.length;
  if (n < 2) return '';
  if (tension <= 0) return `M${pts.map(fmt).join(' L')}${closed ? 'Z' : ''}`;
  const at = (i: number) => (closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)]);
  let d = `M${fmt(pts[0])}`;
  const segs = closed ? n : n - 1;
  const k = tension / 3;
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k];
    d += ` C${fmt(c1)} ${fmt(c2)} ${fmt(p2)}`;
  }
  return closed ? `${d}Z` : d;
}

/** Points on an ellipse (used so circles can wobble in hand-drawn themes). */
export function ellipsePts(c: Pt, rx: number, ry: number, n = 20, rot = 0): Pt[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const p: Pt = [c[0] + Math.cos(a) * rx, c[1] + Math.sin(a) * ry];
    return rot ? rotate(p, c, rot) : p;
  });
}

/**
 * Superellipse-based head/face outline: exponent controls squareness, jaw narrows the lower half,
 * cheek widens the middle. Returns points clockwise from the right.
 */
export function faceOutline(c: Pt, rx: number, ry: number, opts: { square?: number; jaw?: number; chin?: number }, n = 36): Pt[] {
  const e = 2 / (2 + (opts.square ?? 0) * 2.5); // 1 = ellipse, smaller = squarer
  const jaw = opts.jaw ?? 0; // 0..0.4 narrower lower face
  const chin = opts.chin ?? 0; // pointiness
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    let x = Math.sign(ca) * Math.abs(ca) ** e * rx;
    let y = Math.sign(sa) * Math.abs(sa) ** e * ry;
    if (sa > 0) {
      x *= 1 - jaw * sa ** 1.5;
      y *= 1 + chin * (1 - Math.abs(ca)) ** 3; // pull the centre of the jaw down into a chin
    }
    return [c[0] + x, c[1] + y] as Pt;
  });
}

/**
 * Tapered limb through a chain of joints (shoulder→elbow→wrist), widths per joint, round caps.
 * Offsets are computed with joint-averaged normals, so bends stay smooth like a real arm.
 */
export function limbPts(chain: Pt[], widths: number[]): Pt[] {
  const n = chain.length;
  const normals: Pt[] = chain.map((_, i) => {
    const a = chain[Math.max(0, i - 1)];
    const b = chain[Math.min(n - 1, i + 1)];
    return norm(perp(sub(b, a)));
  });
  const left = chain.map((p, i) => add(p, mul(normals[i], widths[i] / 2)));
  const right = chain.map((p, i) => sub(p, mul(normals[i], widths[i] / 2)));
  // round caps: half circles around the end joints
  const cap = (p: Pt, dir: Pt, w: number, steps = 5): Pt[] => {
    const base = Math.atan2(dir[1], dir[0]);
    return Array.from({ length: steps }, (_, i) => {
      const a = base + Math.PI / 2 - (Math.PI * (i + 1)) / (steps + 1);
      return [p[0] + Math.cos(a) * (w / 2), p[1] + Math.sin(a) * (w / 2)] as Pt;
    });
  };
  const endDir = norm(sub(chain[n - 1], chain[n - 2]));
  const startDir = norm(sub(chain[0], chain[1]));
  return [...left, ...cap(chain[n - 1], endDir, widths[n - 1]), ...right.reverse(), ...cap(chain[0], startDir, widths[0])];
}

/** Organic closed blob: circle whose radius is modulated by seeded noise (clouds, bushes, rocks, canopies). */
export function blobPts(c: Pt, r: number, r2: Rng, opts: { n?: number; amp?: number; squash?: number; flatBottom?: boolean } = {}): Pt[] {
  const n = opts.n ?? 14;
  const amp = opts.amp ?? 0.18;
  const phase = r2() * 10;
  const nz = noise1(Math.floor(r2() * 1e6));
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    let rr = r * (1 + (nz(phase + i * 0.9) - 0.5) * 2 * amp);
    let y = Math.sin(a) * rr * (opts.squash ?? 1);
    if (opts.flatBottom && y > 0) y *= 0.25;
    return [c[0] + Math.cos(a) * rr, c[1] + y] as Pt;
  });
}

/** Scalloped outline: n bumps along a circle (curly hair, cloud tops, bushes). */
export function bumpyPts(c: Pt, rx: number, ry: number, bumps: number, depth: number, from = 0, to = Math.PI * 2, res = 8): Pt[] {
  const out: Pt[] = [];
  const total = bumps * res;
  for (let i = 0; i <= total; i++) {
    const t = i / total;
    const a = from + (to - from) * t;
    const bump = Math.abs(Math.sin(t * bumps * Math.PI));
    const k = 1 + depth * bump;
    out.push([c[0] + Math.cos(a) * rx * k, c[1] + Math.sin(a) * ry * k]);
  }
  return out;
}

/** Midpoint-displacement fractal ridge between x0 and x1 (mountains). Returns points left→right. */
export function ridgePts(r2: Rng, x0: number, x1: number, baseY: number, amp: number, roughness = 0.55, depth = 7): Pt[] {
  let pts: Pt[] = [
    [x0, baseY - r2() * amp * 0.5],
    [x1, baseY - r2() * amp * 0.5],
  ];
  let disp = amp;
  for (let d = 0; d < depth; d++) {
    const next: Pt[] = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const m = lerpPt(pts[i], pts[i + 1], 0.5);
      m[1] += (r2() - 0.5) * 2 * disp - (d === 0 ? amp * 0.6 : 0);
      next.push(m, pts[i + 1]);
    }
    pts = next;
    disp *= roughness;
  }
  return pts.map(([x, y]) => [x, Math.min(baseY, y)] as Pt);
}

/** Bridson Poisson-disc sampling: natural, non-overlapping scatter (trees, stars, flowers). */
export function poissonDisc(r2: Rng, w: number, h: number, minDist: number, k = 20, max = 400): Pt[] {
  const cell = minDist / Math.SQRT2;
  const gw = Math.ceil(w / cell);
  const gh = Math.ceil(h / cell);
  const grid: (Pt | null)[] = new Array(gw * gh).fill(null);
  const pts: Pt[] = [];
  const active: Pt[] = [];
  const put = (p: Pt) => {
    pts.push(p);
    active.push(p);
    grid[Math.floor(p[1] / cell) * gw + Math.floor(p[0] / cell)] = p;
  };
  put([r2() * w, r2() * h]);
  while (active.length && pts.length < max) {
    const i = Math.floor(r2() * active.length);
    const p = active[i];
    let found = false;
    for (let t = 0; t < k; t++) {
      const a = r2() * Math.PI * 2;
      const d = minDist * (1 + r2());
      const q: Pt = [p[0] + Math.cos(a) * d, p[1] + Math.sin(a) * d];
      if (q[0] < 0 || q[1] < 0 || q[0] >= w || q[1] >= h) continue;
      const gx = Math.floor(q[0] / cell);
      const gy = Math.floor(q[1] / cell);
      let ok = true;
      for (let y = Math.max(0, gy - 2); y <= Math.min(gh - 1, gy + 2) && ok; y++)
        for (let x = Math.max(0, gx - 2); x <= Math.min(gw - 1, gx + 2); x++) {
          const o = grid[y * gw + x];
          if (o && len(sub(o, q)) < minDist) {
            ok = false;
            break;
          }
        }
      if (ok) {
        put(q);
        found = true;
        break;
      }
    }
    if (!found) active.splice(i, 1);
  }
  return pts;
}

/** Hand-drawn wobble: nudge points along their normals with smooth noise. */
export function wobble(pts: Pt[], amount: number, seed: number): Pt[] {
  if (amount <= 0) return pts;
  const nz = noise1(seed);
  return pts.map((p, i) => {
    const a = pts[(i - 1 + pts.length) % pts.length];
    const b = pts[(i + 1) % pts.length];
    const nrm = norm(perp(sub(b, a)));
    const k = (nz(i * 0.7) - 0.5) * 2 * amount;
    return add(p, mul(nrm, k));
  });
}

// ---------------------------------------------------------------- colour
export function hexToRgb(c: string): [number, number, number] {
  const m = c.replace('#', '').match(/^([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return [128, 128, 128];
  const s = m[1].length === 3 ? m[1].split('').map((x) => x + x).join('') : m[1];
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16)) as [number, number, number];
}
const toHex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('')}`;

export function rgbToHsl([r, g, b]: [number, number, number]): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

export function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = clamp(s, 0, 1);
  l = clamp(l, 0, 1);
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return toHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

export function mixHex(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return toHex(lerp(x[0], y[0], t), lerp(x[1], y[1], t), lerp(x[2], y[2], t));
}

/** Shift lightness (+ lighter / − darker) keeping hue — used for shading and outlines. */
export function shade(c: string, dl: number, ds = 0): string {
  const [h, s, l] = rgbToHsl(hexToRgb(c));
  return hslToHex(h, s + ds, l + dl);
}
