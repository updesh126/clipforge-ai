/**
 * Procedural environment generator.
 * Builds full backgrounds from algorithmic components — midpoint-displacement mountain ridges, fBm hills,
 * recursive branching trees, tiered pines, curved palms, huts, houses, city blocks, a school, a room interior
 * and a fantasy world — placed with Poisson-disc sampling in depth bands. Depth drives scale, outline weight
 * and atmospheric haze (far things fade towards the sky colour); time of day relights the whole palette.
 */
import { type Pt, add, blobPts, bumpyPts, clamp, ellipsePts, fbm1, hashString, lerp, lerpPt, limbPts, mixHex, poissonDisc, polar, ridgePts, rng, type Rng, shade } from './geom.ts';
import { Pen, theme as themeOf, type ThemeId } from './theme.ts';

export type EnvKind = 'forest' | 'village' | 'city' | 'school' | 'house' | 'room' | 'fantasy' | 'riverbank' | 'mountains' | 'beach' | 'desert' | 'field';
export const ENV_KINDS: EnvKind[] = ['forest', 'village', 'city', 'school', 'house', 'room', 'fantasy', 'riverbank', 'mountains', 'beach', 'desert', 'field'];

export interface EnvSpec {
  id: string;
  kind: EnvKind;
  time: 'day' | 'sunset' | 'night' | 'dawn';
  season: 'summer' | 'monsoon' | 'autumn' | 'winter' | 'spring';
  weather: 'clear' | 'rain' | 'snow' | 'fog';
  density: number; // 0.3–1.5 how full the scene is
  seed: number;
  description?: string;
}

/** Which environment a free-text place means ("old forest at night", "Kerala village", "classroom"). */
export function envKindOf(place: string): EnvKind {
  const p = place.toLowerCase();
  const tests: [EnvKind, RegExp][] = [
    ['room', /\b(room|bedroom|kitchen|classroom|inside|interior|hall|library|office|home inside)\b/],
    ['school', /\b(school|college|campus|playground)\b/],
    ['fantasy', /\b(fantasy|magic|magical|fairy|enchanted|kingdom|castle|dragon|floating|dream|heaven|space|alien)\b/],
    ['city', /\b(city|town|street|market|road|traffic|metro|downtown|building|skyscraper|mumbai|delhi)\b/],
    ['beach', /\b(beach|sea|ocean|coast|shore|island|harbour|port)\b/],
    ['riverbank', /\b(river|riverbank|river bank|lake|pond|stream|ghat|boat)\b/],
    ['mountains', /\b(mountain|himalaya|peak|hill station|valley|glacier|snow)\b/],
    ['desert', /\b(desert|sand|dune|rajasthan|camel)\b/],
    ['field', /\b(field|farm|crop|paddy|meadow|garden|park)\b/],
    ['house', /\b(house|home|cottage|neighbourhood|neighborhood|colony|street of houses)\b/],
    ['village', /\b(village|hut|rural|countryside|gaon)\b/],
    ['forest', /\b(forest|jungle|woods|wood|tree|trees|grove)\b/],
  ];
  return tests.find(([, re]) => re.test(p))?.[0] ?? 'village';
}

export function normaliseEnv(input: Partial<EnvSpec> & { place?: string }): EnvSpec {
  const text = `${input.place ?? ''} ${input.description ?? ''}`.toLowerCase();
  const kind = ENV_KINDS.includes(input.kind as EnvKind) ? (input.kind as EnvKind) : envKindOf(text || 'village');
  const time = (['day', 'sunset', 'night', 'dawn'] as const).includes(input.time as never) ? (input.time as EnvSpec['time']) : /\bnight|midnight|dark|stars|moon\b/.test(text) ? 'night' : /\bsunset|evening|dusk\b/.test(text) ? 'sunset' : /\bdawn|sunrise|morning\b/.test(text) ? 'dawn' : 'day';
  const season = (['summer', 'monsoon', 'autumn', 'winter', 'spring'] as const).includes(input.season as never) ? (input.season as EnvSpec['season']) : /\bautumn|fall\b/.test(text) ? 'autumn' : /\bwinter|snow\b/.test(text) ? 'winter' : /\bmonsoon|rain\b/.test(text) ? 'monsoon' : /\bspring|blossom\b/.test(text) ? 'spring' : 'summer';
  const weather = (['clear', 'rain', 'snow', 'fog'] as const).includes(input.weather as never) ? (input.weather as EnvSpec['weather']) : /\brain|storm|monsoon\b/.test(text) ? 'rain' : /\bsnow(ing|fall)?\b/.test(text) ? 'snow' : /\bfog|mist\b/.test(text) ? 'fog' : 'clear';
  const id = input.id ?? `${kind}-${time}${season !== 'summer' ? `-${season}` : ''}${weather !== 'clear' ? `-${weather}` : ''}`;
  return { id, kind, time, season, weather, density: clamp(Number(input.density) || 1, 0.3, 1.5), seed: typeof input.seed === 'number' ? input.seed : hashString(id), description: input.description };
}

// ---------------------------------------------------------------- scene context
interface Env {
  pen: Pen;
  s: EnvSpec;
  w: number;
  h: number;
  hz: number; // horizon y
  r: Rng;
  skyTop: string;
  skyBottom: string;
  light: (c: string) => string; // time-of-day relight
  tint: (c: string, depth: number) => string; // relight + haze by depth (0 far … 1 near)
  leaf: string;
  grass: string;
}

const SKIES: Record<EnvSpec['time'], [string, string]> = {
  day: ['#5DB7E8', '#D6F0FA'],
  sunset: ['#E9765B', '#FCD38D'],
  night: ['#0A1330', '#2A4373'],
  dawn: ['#F2A994', '#FFF0D2'],
};

export function environmentSvg(spec: EnvSpec, themeId: ThemeId = 'storybook', w = 1080, h = 1920): string {
  const t = themeOf(themeId);
  const portrait = h > w;
  const fantasy = spec.kind === 'fantasy';
  let [skyTop, skyBottom] = SKIES[spec.time];
  if (fantasy) [skyTop, skyBottom] = spec.time === 'night' ? ['#1B0B3A', '#4B2A7B'] : ['#7F7FD5', '#F6C6EA'];
  if (spec.weather === 'rain' || spec.season === 'monsoon') [skyTop, skyBottom] = [mixHex(skyTop, '#6C7A89', 0.55), mixHex(skyBottom, '#AEB8C2', 0.5)];
  const season = spec.season;
  const leaf = season === 'autumn' ? '#D9822B' : season === 'winter' ? '#5F7F6E' : season === 'spring' ? '#7CC36E' : season === 'monsoon' ? '#2F8F4E' : '#3E9B4F';
  const grass = season === 'autumn' ? '#B8A04A' : season === 'winter' ? '#E8EEF2' : season === 'monsoon' ? '#3E9A55' : '#6DBE4B';
  const light = (c: string) =>
    spec.time === 'night' ? mixHex(shade(c, -0.2), '#1A2A52', 0.42) : spec.time === 'sunset' ? mixHex(c, '#F08A5D', 0.16) : spec.time === 'dawn' ? mixHex(c, '#F7C1A8', 0.12) : c;
  const haze = mixHex(skyBottom, skyTop, 0.25);
  const env: Env = {
    pen: new Pen(t, h / 380, spec.seed),
    s: spec,
    w,
    h,
    hz: h * (spec.kind === 'room' ? 0.62 : portrait ? 0.6 : 0.58),
    r: rng(spec.seed),
    skyTop,
    skyBottom,
    light,
    tint: (c, depth) => mixHex(light(c), haze, clamp((1 - depth) * 0.6, 0, 0.75)),
    leaf,
    grass,
  };
  if (spec.kind === 'room') room(env);
  else {
    sky(env);
    switch (spec.kind) {
      case 'forest':
        forest(env);
        break;
      case 'village':
        village(env);
        break;
      case 'city':
        city(env);
        break;
      case 'school':
        school(env);
        break;
      case 'house':
        houses(env);
        break;
      case 'fantasy':
        fantasyWorld(env);
        break;
      case 'riverbank':
        riverbank(env);
        break;
      case 'mountains':
        mountainsScene(env);
        break;
      case 'beach':
        beach(env);
        break;
      case 'desert':
        desert(env);
        break;
      case 'field':
        field(env);
        break;
    }
  }
  weather(env);
  return env.pen.svg(w, h, `0 0 ${w} ${h}`, { engine: 'clipforge-vector/1', env: spec, theme: t.id });
}

// ---------------------------------------------------------------- sky, light, weather
function sky(e: Env) {
  const { pen, w, h, s, hz } = e;
  pen.def('skyg', `<linearGradient id="skyg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${e.skyTop}"/><stop offset="1" stop-color="${e.skyBottom}"/></linearGradient>`);
  pen.raw(`<rect width="${w}" height="${h}" fill="url(#skyg)" data-part="sky"/>`);
  const r = e.r.fork('sky');
  if (s.time === 'night') {
    for (const p of poissonDisc(r, w, hz * 0.85, w / 22, 12, 140)) pen.raw(`<circle cx="${p[0].toFixed(0)}" cy="${p[1].toFixed(0)}" r="${(1 + r() * 2.2).toFixed(1)}" fill="#FFFFFF" opacity="${(0.4 + r() * 0.6).toFixed(2)}"/>`);
    if (s.kind === 'fantasy') {
      // aurora ribbons
      for (let i = 0; i < 3; i++) {
        const y = hz * (0.18 + i * 0.1);
        const pts: Pt[] = Array.from({ length: 8 }, (_, k) => [(w / 7) * k, y + Math.sin(k * 1.3 + i) * h * 0.03]);
        pen.line(pts, ['#7CF7C9', '#B388FF', '#64D2FF'][i], h / 50, { opacity: 0.35, raw: true });
      }
    }
  }
  // sun / moon with glow
  const night = s.time === 'night';
  const c: Pt = [w * 0.74, s.time === 'sunset' || s.time === 'dawn' ? hz * 0.62 : hz * 0.25];
  const rr = Math.min(w, h) * (night ? 0.06 : 0.075);
  pen.raw(`<circle cx="${c[0]}" cy="${c[1]}" r="${rr * 2.6}" fill="${night ? '#E8F0FF' : '#FFF4C2'}" opacity="0.22"/>`);
  pen.circle(c, rr, night ? '#F4F1E1' : s.time === 'sunset' ? '#FFB347' : '#FFE066', { part: night ? 'moon' : 'sun', outline: 0.4 });
  if (night) {
    pen.circle([c[0] + rr * 0.45, c[1] - rr * 0.2], rr * 0.85, e.skyTop, { raw: true, outline: 0 }); // crescent
    if (s.kind === 'fantasy') pen.circle([w * 0.2, hz * 0.22], rr * 0.55, '#FFC6E7', { outline: 0.4 });
  }
  // clouds: flat-bottomed scalloped blobs
  const clouds = s.weather === 'rain' ? 5 : night ? 2 : 3;
  for (let i = 0; i < clouds; i++) {
    const cx = w * (0.12 + ((i * 0.37 + r() * 0.2) % 1) * 0.8);
    const cy = hz * (0.12 + r() * 0.35);
    const cw = w * (0.12 + r() * 0.1);
    const col = s.weather === 'rain' ? '#9AA6B2' : night ? '#3A4F7A' : '#FFFFFF';
    cloud(e, [cx, cy], cw, col, r.fork(i));
  }
}

function cloud(e: Env, c: Pt, size: number, col: string, r: Rng) {
  const top = bumpyPts(c, size, size * 0.42, r.int(3, 5), 0.32, Math.PI, Math.PI * 2, 6);
  e.pen.shape([...top, [c[0] + size * 0.95, c[1] + size * 0.12], [c[0] - size * 0.95, c[1] + size * 0.12]], col, { part: 'cloud', outline: 0.5, shade: true });
}

function weather(e: Env) {
  const { pen, w, h, s } = e;
  const r = e.r.fork('weather');
  if (s.weather === 'rain') for (let i = 0; i < 160; i++) {
    const x = r() * w;
    const y = r() * h;
    pen.raw(`<line x1="${x.toFixed(0)}" y1="${y.toFixed(0)}" x2="${(x - h * 0.008).toFixed(0)}" y2="${(y + h * 0.035).toFixed(0)}" stroke="#DCE8F5" stroke-width="2" opacity="0.55"/>`);
  }
  if (s.weather === 'snow') for (let i = 0; i < 140; i++) pen.raw(`<circle cx="${(r() * w).toFixed(0)}" cy="${(r() * h).toFixed(0)}" r="${(2 + r() * 4).toFixed(1)}" fill="#FFFFFF" opacity="0.85"/>`);
  if (s.weather === 'fog') pen.raw(`<rect width="${w}" height="${h}" fill="#FFFFFF" opacity="0.28"/>`);
}

// ---------------------------------------------------------------- terrain
function ridge(e: Env, base: number, amp: number, col: string, depth: number, label: string, snow = false) {
  const r = e.r.fork(label);
  const pts = ridgePts(r, -e.w * 0.05, e.w * 1.05, base, amp, 0.52, 6);
  e.pen.shape([...pts, [e.w * 1.05, e.h], [-e.w * 0.05, e.h]], e.tint(col, depth), { part: label, tension: 0.15, outline: depth });
  if (snow) {
    // snow caps: the upper band of each peak
    const top = Math.min(...pts.map((p) => p[1]));
    const line = top + amp * 0.32;
    const cap = pts.map(([x, y]) => [x, Math.min(y, line)] as Pt).filter((p, i, a) => p[1] < line || (a[i - 1]?.[1] ?? line) < line || (a[i + 1]?.[1] ?? line) < line);
    if (cap.length > 3) e.pen.shape(cap, e.tint('#F7FAFF', depth), { tension: 0.15, outline: depth * 0.6 });
  }
}

function hills(e: Env, base: number, amp: number, col: string, depth: number, label: string) {
  const nz = fbm1(hashString(label) + e.s.seed, 3);
  const pts: Pt[] = [];
  for (let i = 0; i <= 24; i++) {
    const x = (e.w * i) / 24;
    pts.push([x, base - amp * nz(i * 0.22)]);
  }
  e.pen.shape([...pts, [e.w, e.h], [0, e.h]], e.tint(col, depth), { part: label, tension: 0.5, outline: depth * 0.8, shade: true });
}

function ground(e: Env, col: string, label = 'ground') {
  const { pen, w, h, hz } = e;
  pen.def(`gg${label}`, `<linearGradient id="gg${label}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${e.tint(col, 0.55)}"/><stop offset="1" stop-color="${e.light(shade(col, -0.08))}"/></linearGradient>`);
  pen.raw(`<rect x="0" y="${hz.toFixed(0)}" width="${w}" height="${(h - hz).toFixed(0)}" fill="url(#gg${label})" data-part="${label}"/>`);
}

/** Perspective path from the bottom of the frame to a vanishing point near the horizon. */
function path(e: Env, col: string, vx = 0.5, wide = 0.42) {
  const { w, h, hz } = e;
  const top = hz + h * 0.01;
  const pts: Pt[] = [
    [w * vx - w * 0.015, top],
    [w * vx + w * 0.015, top],
    [w * (vx + wide * 0.4), lerp(top, h, 0.5)],
    [w * (vx + wide), h],
    [w * (vx - wide), h],
    [w * (vx - wide * 0.38), lerp(top, h, 0.5)],
  ];
  e.pen.shape(pts, e.light(col), { part: 'path', tension: 0.35, outline: 0.6 });
}

function grassTufts(e: Env, n: number, y0: number, y1: number, col: string) {
  const r = e.r.fork('tufts');
  for (let i = 0; i < n; i++) {
    const y = lerp(y0, y1, r());
    const depth = clamp((y - e.hz) / (e.h - e.hz), 0, 1);
    const x = r() * e.w;
    const s = e.h * 0.012 * (0.4 + depth * 1.2);
    for (let k = -2; k <= 2; k++) e.pen.line([[x + k * s * 0.3, y], [x + k * s * 0.6, y - s * (1.4 - Math.abs(k) * 0.2)]], e.tint(shade(col, -0.12), 0.4 + depth * 0.6), 0.6 + depth * 0.8);
  }
}

function flowers(e: Env, n: number, y0: number, y1: number) {
  const r = e.r.fork('flowers');
  const cols = ['#FF6B6B', '#FFD93D', '#FFFFFF', '#C77DFF', '#FF9F1C'];
  for (let i = 0; i < n; i++) {
    const y = lerp(y0, y1, r());
    const depth = clamp((y - e.hz) / (e.h - e.hz), 0, 1);
    const c: Pt = [r() * e.w, y];
    const s = e.h * 0.006 * (0.5 + depth * 1.4);
    const col = r.pick(cols);
    for (let k = 0; k < 5; k++) e.pen.circle(polar(c, k * 72, s), s * 0.8, e.tint(col, 0.5 + depth / 2), { outline: 0.2 });
    e.pen.circle(c, s * 0.6, e.tint('#F6BD60', 0.5 + depth / 2), { outline: 0 });
  }
}

function rock(e: Env, c: Pt, size: number, depth: number, r: Rng) {
  e.pen.shape(blobPts(c, size, r, { n: 9, amp: 0.25, squash: 0.62, flatBottom: true }), e.tint('#8D8A86', depth), { part: 'rock', tension: 0.25, shade: true, outline: depth });
}

// ---------------------------------------------------------------- vegetation
/** Recursive branching tree: trunk splits into 2–3 branches per level, canopy blobs gather at the tips. */
function branchingTree(e: Env, base: Pt, height: number, depth: number, r: Rng, kind: 'round' | 'banyan' | 'blossom' = 'round') {
  const tips: Pt[] = [];
  const segs: { a: Pt; b: Pt; w: number }[] = [];
  const grow = (p: Pt, ang: number, length: number, width: number, level: number) => {
    const end = polar(p, 180 + ang, length);
    segs.push({ a: p, b: end, w: width });
    if (level === 0 || length < height * 0.06) {
      tips.push(end);
      return;
    }
    const kids = r.chance(0.35) ? 3 : 2;
    for (let k = 0; k < kids; k++) {
      const spread = kind === 'banyan' ? 42 : 28;
      const a = ang + (k - (kids - 1) / 2) * spread + r.range(-10, 10);
      grow(end, a, length * r.range(0.66, 0.78), width * 0.66, level - 1);
    }
  };
  grow(base, r.range(-4, 4), height * 0.36, height * 0.075, 4);
  const trunk = e.tint('#6B4A2F', depth);
  const leafBase = kind === 'blossom' ? '#F7A8C4' : e.leaf;
  // back canopy (darker) → branches → front canopy (lighter): reads as volume
  const canopy = (front: boolean) => {
    for (const [i, tp] of tips.entries()) {
      if (front !== (i % 2 === 0)) continue;
      const size = height * (kind === 'banyan' ? 0.17 : 0.14) * r.range(0.8, 1.25);
      e.pen.shape(blobPts(add(tp, [0, -size * 0.2]), size, r.fork(`c${i}${front}`), { n: 12, amp: 0.2 }), e.tint(shade(leafBase, front ? 0.04 : -0.08), depth), { part: 'canopy', shade: true, outline: depth * 0.8 });
    }
  };
  canopy(false);
  for (const sg of segs) e.pen.shape(limbPts([sg.a, sg.b], [sg.w, sg.w * 0.7]), trunk, { part: 'branch', outline: depth * 0.7 });
  if (kind === 'banyan') for (let i = 0; i < 6; i++) {
    const x = base[0] + (i - 2.5) * height * 0.09;
    e.pen.line([[x, base[1] - height * 0.55], [x + r.range(-4, 4), base[1]]], trunk, 0.6 * depth + 0.3, { opacity: 0.8 });
  }
  canopy(true);
}

/** Pine: trunk + stacked drooping tiers that shrink towards the top. */
function pineTree(e: Env, base: Pt, height: number, depth: number, r: Rng) {
  const col = e.tint(e.s.season === 'winter' ? '#2F5D50' : '#2D6A4F', depth);
  e.pen.shape(limbPts([base, [base[0], base[1] - height * 0.3]], [height * 0.06, height * 0.045]), e.tint('#5A3E2B', depth), { outline: depth * 0.7 });
  const tiers = r.int(4, 5);
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers;
    const y = base[1] - height * (0.18 + t * 0.72);
    const wd = height * (0.34 - t * 0.24);
    const th = height * 0.3;
    e.pen.shape([[base[0] - wd, y], [base[0] - wd * 0.4, y - th * 0.35], [base[0], y - th], [base[0] + wd * 0.4, y - th * 0.35], [base[0] + wd, y], [base[0], y - th * 0.12]], shade(col, i * 0.025), { part: 'pine', tension: 0.3, shade: true, outline: depth * 0.8 });
    if (e.s.season === 'winter') e.pen.shape([[base[0] - wd * 0.45, y - th * 0.55], [base[0], y - th], [base[0] + wd * 0.45, y - th * 0.55], [base[0], y - th * 0.7]], e.tint('#F5FAFF', depth), { tension: 0.3, outline: 0 });
  }
}

/** Palm: curved segmented trunk, arching fronds, coconuts. */
function palmTree(e: Env, base: Pt, height: number, depth: number, r: Rng) {
  const lean = r.range(-0.25, 0.25) * height;
  const trunkPts: Pt[] = Array.from({ length: 5 }, (_, i) => [base[0] + lean * (i / 4) ** 2, base[1] - height * (i / 4)]);
  e.pen.shape(limbPts(trunkPts, trunkPts.map((_, i) => height * (0.07 - i * 0.008))), e.tint('#9C7A54', depth), { part: 'palm-trunk', outline: depth * 0.7, shade: true });
  for (let i = 1; i < 5; i++) e.pen.line([add(trunkPts[i], [-height * 0.03, 0]), add(trunkPts[i], [height * 0.03, 0])], e.tint('#6F5236', depth), 0.6 * depth + 0.2);
  const crown = trunkPts[4];
  for (let i = 0; i < 8; i++) {
    const a = -150 + i * 40 + r.range(-8, 8);
    const l = height * r.range(0.38, 0.5);
    const mid1 = polar(crown, 180 + a * 0.5, l * 0.5);
    const tip = add(polar(crown, 180 + a, l), [0, l * 0.45]);
    e.pen.shape(limbPts([crown, mid1, tip], [height * 0.05, height * 0.06, height * 0.005]), e.tint(shade(e.leaf, (i % 2) * 0.05), depth), { part: 'frond', outline: depth * 0.6 });
  }
  for (let i = 0; i < 3; i++) e.pen.circle(add(crown, [(i - 1) * height * 0.04, height * 0.04]), height * 0.03, e.tint('#6B4A2F', depth), { outline: depth * 0.5 });
}

function bush(e: Env, c: Pt, size: number, depth: number, r: Rng) {
  for (let i = 0; i < 3; i++) e.pen.shape(blobPts(add(c, [(i - 1) * size * 0.6, -size * (i === 1 ? 0.35 : 0.1)]), size * (i === 1 ? 0.75 : 0.6), r.fork(i), { n: 11, amp: 0.18, flatBottom: true }), e.tint(shade(e.leaf, i === 1 ? 0.05 : -0.05), depth), { part: 'bush', shade: true, outline: depth * 0.8 });
}

/** Poisson-disc scatter in a depth band; callback gets position, depth (0 far → 1 near) and scale. Painter-sorted. */
function scatter(e: Env, label: string, y0: number, y1: number, minDist: number, max: number, draw: (p: Pt, depth: number, r: Rng) => void) {
  const r = e.r.fork(label);
  const pts = poissonDisc(r, e.w * 1.1, Math.max(1, y1 - y0), minDist, 20, Math.round(max * e.s.density))
    .map(([x, y]) => [x - e.w * 0.05, y0 + y] as Pt)
    .sort((a, b) => a[1] - b[1]);
  for (const [i, p] of pts.entries()) draw(p, clamp((p[1] - e.hz) / (e.h - e.hz), 0, 1), r.fork(i));
}

// ---------------------------------------------------------------- buildings
function hut(e: Env, base: Pt, size: number, depth: number, r: Rng) {
  const wall = e.tint(r.pick(['#D9B48F', '#C99A6E', '#E3C49F']), depth);
  const ww = size * 0.9;
  const wh = size * 0.55;
  const wallPts: Pt[] = [[base[0] - ww / 2, base[1]], [base[0] - ww / 2 + 2, base[1] - wh], [base[0] + ww / 2 - 2, base[1] - wh], [base[0] + ww / 2, base[1]]];
  e.pen.shape(wallPts, wall, { part: 'hut-wall', tension: 0.1, shade: true, outline: depth });
  e.pen.shape([[base[0] - ww * 0.12, base[1]], [base[0] - ww * 0.12, base[1] - wh * 0.6], [base[0], base[1] - wh * 0.72], [base[0] + ww * 0.12, base[1] - wh * 0.6], [base[0] + ww * 0.12, base[1]]], e.tint('#4A3222', depth), { part: 'door', tension: 0.4, outline: depth * 0.6 });
  e.pen.shape([[base[0] + ww * 0.24, base[1] - wh * 0.62], [base[0] + ww * 0.38, base[1] - wh * 0.62], [base[0] + ww * 0.38, base[1] - wh * 0.4], [base[0] + ww * 0.24, base[1] - wh * 0.4]], e.tint('#3A2A1E', depth), { tension: 0, outline: depth * 0.5 });
  // thatched roof: rounded cone + thatch strokes
  const roof = e.tint(r.pick(['#B08D57', '#A27B45', '#C2A066']), depth);
  const peak: Pt = [base[0], base[1] - wh - size * 0.55];
  const roofPts: Pt[] = [[base[0] - ww * 0.68, base[1] - wh + size * 0.04], [base[0] - ww * 0.25, peak[1] + size * 0.12], peak, [base[0] + ww * 0.25, peak[1] + size * 0.12], [base[0] + ww * 0.68, base[1] - wh + size * 0.04]];
  e.pen.shape(roofPts, roof, { part: 'thatch', tension: 0.35, shade: true, outline: depth });
  for (let i = 0; i < 9; i++) {
    const t = (i + 0.5) / 9;
    e.pen.line([lerpPt(peak, peak, 0), lerpPt([base[0] - ww * 0.68, base[1] - wh], [base[0] + ww * 0.68, base[1] - wh], t)], shade(roof, -0.15), 0.4 * depth + 0.2, { opacity: 0.6 });
  }
}

function house(e: Env, base: Pt, size: number, depth: number, r: Rng) {
  const floors = r.chance(0.35) ? 2 : 1;
  const ww = size * r.range(0.85, 1.05);
  const wh = size * 0.42 * floors;
  const wall = e.tint(r.pick(['#F2E2C4', '#E8C9A0', '#CFE0E8', '#F4D6CC', '#DDE5C5']), depth);
  const roofC = e.tint(r.pick(['#B5482E', '#7A3B2E', '#3E5C76', '#8C5A3C']), depth);
  const x0 = base[0] - ww / 2;
  e.pen.shape([[x0, base[1]], [x0, base[1] - wh], [x0 + ww, base[1] - wh], [x0 + ww, base[1]]], wall, { part: 'house-wall', tension: 0, shade: true, outline: depth });
  // chimney behind the roof line
  e.pen.shape([[x0 + ww * 0.7, base[1] - wh - size * 0.25], [x0 + ww * 0.82, base[1] - wh - size * 0.25], [x0 + ww * 0.82, base[1] - wh - size * 0.05], [x0 + ww * 0.7, base[1] - wh - size * 0.05]], e.tint('#8D5B4C', depth), { tension: 0, outline: depth });
  e.pen.shape([[x0 - ww * 0.08, base[1] - wh], [base[0], base[1] - wh - size * 0.4], [x0 + ww * 1.08, base[1] - wh]], roofC, { part: 'roof', tension: 0, shade: true, outline: depth });
  // door + windows on a grid
  const dw = ww * 0.16;
  e.pen.shape([[base[0] - dw / 2, base[1]], [base[0] - dw / 2, base[1] - size * 0.28], [base[0] + dw / 2, base[1] - size * 0.28], [base[0] + dw / 2, base[1]]], e.tint('#6B3F2A', depth), { part: 'door', tension: 0, outline: depth });
  e.pen.circle([base[0] + dw * 0.3, base[1] - size * 0.14], size * 0.012, e.tint('#E9B949', depth), { outline: 0 });
  const lit = e.s.time === 'night';
  for (let f = 0; f < floors; f++)
    for (const k of [-1, 1]) {
      if (f === 0 && Math.abs(k) < 0.1) continue;
      const cx = base[0] + k * ww * 0.3;
      const cy = base[1] - size * (0.22 + f * 0.42);
      const s2 = size * 0.1;
      e.pen.shape([[cx - s2, cy - s2], [cx + s2, cy - s2], [cx + s2, cy + s2], [cx - s2, cy + s2]], lit && r.chance(0.7) ? '#FFD86B' : e.tint('#9FD3E8', depth), { part: 'window', tension: 0, outline: depth });
      e.pen.line([[cx, cy - s2], [cx, cy + s2]], e.tint('#FFFFFF', depth), 0.5 * depth + 0.2, { raw: true });
      e.pen.line([[cx - s2, cy], [cx + s2, cy]], e.tint('#FFFFFF', depth), 0.5 * depth + 0.2, { raw: true });
    }
}

function tower(e: Env, x: number, base: number, ww: number, hh: number, depth: number, r: Rng) {
  const col = e.tint(r.pick(['#8DA3B5', '#A9B8C4', '#6F8597', '#C7B9A6', '#9AA9B8', '#B4A69A']), depth);
  e.pen.shape([[x, base], [x, base - hh], [x + ww, base - hh], [x + ww, base]], col, { part: 'building', tension: 0, shade: true, outline: depth });
  if (r.chance(0.4)) e.pen.shape([[x + ww * 0.6, base - hh], [x + ww * 0.6, base - hh - ww * 0.18], [x + ww * 0.85, base - hh - ww * 0.18], [x + ww * 0.85, base - hh]], shade(col, -0.1), { tension: 0, outline: depth * 0.6 });
  if (r.chance(0.3)) e.pen.line([[x + ww * 0.3, base - hh], [x + ww * 0.3, base - hh - ww * 0.4]], shade(col, -0.25), 0.8 * depth + 0.3);
  // window grid (lit at random after dark)
  const cols = Math.max(2, Math.round(ww / (e.w * 0.035)));
  const rows = Math.max(3, Math.round(hh / (e.w * 0.045)));
  const night = e.s.time === 'night' || e.s.time === 'sunset';
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows - 1; j++) {
      const wx = x + ww * ((i + 0.25) / cols);
      const wy = base - hh + hh * ((j + 0.35) / rows);
      const on = night && r.chance(0.45);
      e.pen.raw(`<rect x="${wx.toFixed(1)}" y="${wy.toFixed(1)}" width="${((ww / cols) * 0.5).toFixed(1)}" height="${((hh / rows) * 0.45).toFixed(1)}" fill="${on ? '#FFD86B' : shade(col, -0.18)}" opacity="${on ? 0.95 : 0.7}"/>`);
    }
}

// ---------------------------------------------------------------- scenes
function forest(e: Env) {
  const { w, h, hz } = e;
  ridge(e, hz - h * 0.02, h * 0.16, '#6E8FB3', 0.1, 'far-mountains');
  hills(e, hz + h * 0.005, h * 0.06, '#4F8A5B', 0.3, 'far-hills');
  ground(e, e.grass);
  path(e, '#C8A27A', 0.52, 0.3);
  scatter(e, 'far-trees', hz - h * 0.03, hz + h * 0.03, w * 0.05, 40, (p, d, r) => pineTree(e, p, h * 0.12, 0.25 + d, r));
  scatter(e, 'mid-trees', hz + h * 0.04, hz + h * 0.14, w * 0.13, 12, (p, d, r) => (Math.abs(p[0] - w * 0.52) < w * 0.12 ? null : r.chance(0.5) ? branchingTree(e, p, h * (0.2 + d * 0.15), 0.55 + d * 0.3, r) : pineTree(e, p, h * (0.22 + d * 0.12), 0.55 + d * 0.3, r)));
  grassTufts(e, 50, hz + h * 0.05, h, e.grass);
  flowers(e, 18, hz + h * 0.12, h);
  scatter(e, 'near-bushes', h * 0.82, h * 0.95, w * 0.3, 4, (p, d, r) => bush(e, p, h * 0.05, 1, r));
  // big framing trees at the edges (partly off-frame)
  branchingTree(e, [-w * 0.04, h * 0.98], h * 0.55, 1, e.r.fork('frameL'));
  pineTree(e, [w * 1.03, h], h * 0.6, 1, e.r.fork('frameR'));
  if (e.s.time === 'night' || e.s.time === 'sunset') fireflies(e, 40);
}

function fireflies(e: Env, n: number) {
  const r = e.r.fork('fireflies');
  for (let i = 0; i < n; i++) {
    const x = r() * e.w;
    const y = lerp(e.hz - e.h * 0.1, e.h * 0.9, r());
    e.pen.raw(`<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(e.h * 0.009).toFixed(1)}" fill="#FFF3A0" opacity="0.3"/><circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(e.h * 0.0028).toFixed(1)}" fill="#FFFBD0"/>`);
  }
}

/**
 * Transparent particle overlay (its own layer so it can float over characters): fireflies, sparkles, petals.
 * Poisson-disc spread; each firefly is a soft halo + bright core + tiny wings.
 */
export function particlesSvg(kind: 'fireflies' | 'sparkles' | 'petals', w: number, h: number, seed = 7, count = 36): string {
  const r = rng(seed);
  const pts = poissonDisc(r, w, h * 0.8, Math.sqrt((w * h * 0.8) / count) * 0.8, 20, count);
  const out: string[] = [];
  for (const [x, y0] of pts) {
    const y = y0 + h * 0.08;
    const s = Math.min(w, h) * r.range(0.006, 0.012);
    if (kind === 'fireflies') {
      out.push(`<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(s * 4).toFixed(1)}" fill="#FFF3A0" opacity="0.22"/>`);
      out.push(`<ellipse cx="${(x - s * 0.9).toFixed(0)}" cy="${(y - s * 0.7).toFixed(0)}" rx="${(s * 0.9).toFixed(1)}" ry="${(s * 0.45).toFixed(1)}" fill="#FFFFFF" opacity="0.45" transform="rotate(-25 ${x.toFixed(0)} ${y.toFixed(0)})"/>`);
      out.push(`<ellipse cx="${(x + s * 0.9).toFixed(0)}" cy="${(y - s * 0.7).toFixed(0)}" rx="${(s * 0.9).toFixed(1)}" ry="${(s * 0.45).toFixed(1)}" fill="#FFFFFF" opacity="0.45" transform="rotate(25 ${x.toFixed(0)} ${y.toFixed(0)})"/>`);
      out.push(`<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${(s * 1.1).toFixed(1)}" fill="#FFFBD0"/>`);
    } else if (kind === 'sparkles') {
      out.push(`<path d="M${x} ${y - s * 3}L${x + s * 0.7} ${y - s * 0.7}L${x + s * 3} ${y}L${x + s * 0.7} ${y + s * 0.7}L${x} ${y + s * 3}L${x - s * 0.7} ${y + s * 0.7}L${x - s * 3} ${y}L${x - s * 0.7} ${y - s * 0.7}Z" fill="#FFFFFF" opacity="0.85"/>`);
    } else {
      out.push(`<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${(s * 1.6).toFixed(1)}" ry="${(s * 0.8).toFixed(1)}" fill="#F7A8C4" transform="rotate(${r.int(0, 180)} ${x.toFixed(0)} ${y.toFixed(0)})"/>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${out.join('')}</svg>`;
}

function village(e: Env) {
  const { w, h, hz } = e;
  hills(e, hz - h * 0.01, h * 0.09, '#6FA36B', 0.15, 'far-hills');
  hills(e, hz + h * 0.02, h * 0.05, '#5E9E57', 0.35, 'mid-hills');
  ground(e, e.grass);
  path(e, '#D4B48C', 0.45, 0.35);
  const r = e.r.fork('village');
  palmTree(e, [w * 0.86, hz + h * 0.07], h * 0.28, 0.6, r.fork('p1'));
  palmTree(e, [w * 0.1, hz + h * 0.05], h * 0.24, 0.5, r.fork('p2'));
  const spots: [number, number, number][] = [[0.2, 0.06, 0.15], [0.68, 0.075, 0.17], [0.88, 0.12, 0.2], [0.05, 0.13, 0.19]];
  for (const [i, [x, y, s]] of spots.entries()) hut(e, [w * x, hz + h * y], w * s * (portraitK(e)), 0.55 + y * 2.5, r.fork(`hut${i}`));
  // well + haystack
  const wc: Pt = [w * 0.74, hz + h * 0.2];
  e.pen.shape([[wc[0] - w * 0.07, wc[1]], [wc[0] - w * 0.07, wc[1] - h * 0.035], [wc[0] + w * 0.07, wc[1] - h * 0.035], [wc[0] + w * 0.07, wc[1]]], e.tint('#A1887F', 0.9), { part: 'well', tension: 0.1, shade: true });
  e.pen.ellipse([wc[0], wc[1] - h * 0.035], w * 0.07, h * 0.008, e.tint('#5D4037', 0.9), { outline: 0.6 });
  e.pen.shape([[w * 0.3, hz + h * 0.22], [w * 0.33, hz + h * 0.16], [w * 0.38, hz + h * 0.15], [w * 0.43, hz + h * 0.16], [w * 0.46, hz + h * 0.22]], e.tint('#D9B44A', 0.9), { part: 'haystack', tension: 0.5, shade: true });
  fence(e, h * 0.86, 0.02, 0.32);
  grassTufts(e, 40, hz + h * 0.05, h, e.grass);
  flowers(e, 12, hz + h * 0.2, h);
}

const portraitK = (e: Env) => (e.h > e.w ? 1 : 0.6);

function fence(e: Env, y: number, x0: number, x1: number) {
  const col = e.tint('#8B6B4A', 1);
  const posts = 6;
  for (let i = 0; i <= posts; i++) {
    const x = e.w * lerp(x0, x1, i / posts);
    e.pen.shape([[x - e.w * 0.008, y], [x - e.w * 0.008, y - e.h * 0.05], [x, y - e.h * 0.056], [x + e.w * 0.008, y - e.h * 0.05], [x + e.w * 0.008, y]], col, { tension: 0, part: 'fence' });
  }
  for (const k of [0.018, 0.038]) e.pen.line([[e.w * x0, y - e.h * k], [e.w * x1, y - e.h * k]], col, 1.4);
}

function city(e: Env) {
  const { w, h, hz } = e;
  const r = e.r.fork('city');
  // far skyline silhouettes (heights from noise), mid towers with windows, road
  const nz = fbm1(e.s.seed + 9, 3);
  let x = -w * 0.05;
  while (x < w) {
    const bw = w * r.range(0.06, 0.11);
    const bh = h * (0.12 + nz(x / w * 6) * 0.2);
    e.pen.shape([[x, hz], [x, hz - bh], [x + bw, hz - bh], [x + bw, hz]], e.tint('#7C8CA3', 0.1), { tension: 0, outline: 0.1 });
    x += bw * 0.95;
  }
  ground(e, '#9E9E9E');
  x = -w * 0.03;
  while (x < w) {
    const bw = w * r.range(0.14, 0.24);
    tower(e, x, hz + h * 0.04, bw, h * r.range(0.14, 0.3), 0.55, r.fork(Math.round(x)));
    x += bw + w * 0.01;
  }
  // pavement + road with perspective lane marks
  e.pen.shape([[0, hz + h * 0.04], [w, hz + h * 0.04], [w, hz + h * 0.08], [0, hz + h * 0.08]], e.tint('#BDB6A8', 0.7), { tension: 0, part: 'pavement' });
  e.pen.shape([[0, hz + h * 0.08], [w, hz + h * 0.08], [w, h], [0, h]], e.tint('#4A4E57', 1), { tension: 0, part: 'road', outline: 0 });
  for (let i = 0; i < 5; i++) {
    const y = lerp(hz + h * 0.1, h, (i / 5) ** 1.4);
    const s = 0.4 + i * 0.25;
    e.pen.shape([[w * 0.5 - w * 0.01 * s, y], [w * 0.5 + w * 0.01 * s, y], [w * 0.5 + w * 0.012 * s, y + h * 0.03 * s], [w * 0.5 - w * 0.012 * s, y + h * 0.03 * s]], '#F2F2F2', { raw: true, tension: 0, outline: 0 });
  }
  for (const lx of [0.08, 0.92]) {
    const base: Pt = [w * lx, hz + h * 0.1];
    e.pen.line([base, [base[0], base[1] - h * 0.16], [base[0] + (lx < 0.5 ? 1 : -1) * w * 0.05, base[1] - h * 0.17]], e.tint('#37474F', 1), 1.6);
    const bulb: Pt = [base[0] + (lx < 0.5 ? 1 : -1) * w * 0.05, base[1] - h * 0.165];
    if (e.s.time === 'night') e.pen.raw(`<circle cx="${bulb[0]}" cy="${bulb[1]}" r="${h * 0.03}" fill="#FFE08A" opacity="0.35"/>`);
    e.pen.circle(bulb, h * 0.008, '#FFE08A', { outline: 0.5 });
  }
}

function school(e: Env) {
  const { w, h, hz } = e;
  const r = e.r.fork('school');
  hills(e, hz - h * 0.005, h * 0.05, '#7DB36E', 0.2, 'far-hills');
  ground(e, e.grass);
  // main block + two wings
  const base = hz + h * 0.07;
  const bw = w * 0.84;
  const bx = (w - bw) / 2;
  const wall = e.tint('#F1C27D', 0.7);
  e.pen.shape([[bx, base], [bx, base - h * 0.13], [bx + bw, base - h * 0.13], [bx + bw, base]], wall, { part: 'school-wings', tension: 0, shade: true, outline: 0.7 });
  e.pen.shape([[bx - w * 0.01, base - h * 0.13], [bx + bw + w * 0.01, base - h * 0.13], [bx + bw, base - h * 0.145], [bx, base - h * 0.145]], e.tint('#B5482E', 0.7), { tension: 0, outline: 0.7 });
  const cw = w * 0.3;
  const cx = w / 2 - cw / 2;
  e.pen.shape([[cx, base], [cx, base - h * 0.19], [cx + cw, base - h * 0.19], [cx + cw, base]], e.tint('#F6D49A', 0.7), { part: 'school-centre', tension: 0, shade: true, outline: 0.7 });
  e.pen.shape([[cx - w * 0.02, base - h * 0.19], [w / 2, base - h * 0.25], [cx + cw + w * 0.02, base - h * 0.19]], e.tint('#B5482E', 0.7), { tension: 0, part: 'pediment', outline: 0.7 });
  e.pen.circle([w / 2, base - h * 0.215], h * 0.013, '#FFFFFF', { part: 'clock', outline: 0.6 });
  e.pen.line([[w / 2, base - h * 0.215], [w / 2, base - h * 0.224], [w / 2 + h * 0.006, base - h * 0.215]], '#333333', 0.8, { raw: true });
  // signboard
  e.pen.shape([[w / 2 - w * 0.11, base - h * 0.17], [w / 2 + w * 0.11, base - h * 0.17], [w / 2 + w * 0.11, base - h * 0.145], [w / 2 - w * 0.11, base - h * 0.145]], e.tint('#2E5E4E', 0.8), { tension: 0, outline: 0.6, part: 'sign' });
  e.pen.raw(`<text x="${w / 2}" y="${(base - h * 0.151).toFixed(0)}" font-family="Arial, sans-serif" font-weight="700" font-size="${(h * 0.017).toFixed(0)}" fill="#FFFFFF" text-anchor="middle" letter-spacing="3">SCHOOL</text>`);
  // window grid across the wings
  for (let i = 0; i < 10; i++) {
    const x = bx + bw * ((i + 0.5) / 10);
    if (Math.abs(x - w / 2) < cw / 2 + w * 0.01) continue;
    for (const y of [base - h * 0.1, base - h * 0.05]) e.pen.shape([[x - w * 0.02, y - h * 0.015], [x + w * 0.02, y - h * 0.015], [x + w * 0.02, y + h * 0.015], [x - w * 0.02, y + h * 0.015]], e.tint('#9FD3E8', 0.7), { tension: 0, outline: 0.6 });
  }
  e.pen.shape([[w / 2 - w * 0.05, base], [w / 2 - w * 0.05, base - h * 0.06], [w / 2 + w * 0.05, base - h * 0.06], [w / 2 + w * 0.05, base]], e.tint('#6B3F2A', 0.7), { tension: 0, part: 'door', outline: 0.7 });
  // flag pole
  const fp: Pt = [w * 0.12, hz + h * 0.14];
  e.pen.line([fp, [fp[0], fp[1] - h * 0.24]], '#9E9E9E', 1.4);
  for (const [k, c] of ['#FF9933', '#FFFFFF', '#138808'].entries()) e.pen.shape([[fp[0], fp[1] - h * (0.24 - k * 0.018)], [fp[0] + w * 0.12, fp[1] - h * (0.235 - k * 0.018)], [fp[0] + w * 0.12, fp[1] - h * (0.218 - k * 0.018)], [fp[0], fp[1] - h * (0.222 - k * 0.018)]], c, { tension: 0.3, outline: 0.4 });
  // playground: swing + slide, boundary wall
  const sw: Pt = [w * 0.78, hz + h * 0.2];
  e.pen.line([[sw[0] - w * 0.1, sw[1]], [sw[0] - w * 0.07, sw[1] - h * 0.1], [sw[0] + w * 0.07, sw[1] - h * 0.1], [sw[0] + w * 0.1, sw[1]]], e.tint('#C0392B', 1), 1.6, { tension: 0 });
  for (const k of [-0.03, 0.03]) e.pen.line([[sw[0] + w * k, sw[1] - h * 0.1], [sw[0] + w * k, sw[1] - h * 0.035]], '#555555', 0.6, { raw: true });
  e.pen.shape([[sw[0] - w * 0.04, sw[1] - h * 0.035], [sw[0] + w * 0.04, sw[1] - h * 0.035], [sw[0] + w * 0.04, sw[1] - h * 0.03], [sw[0] - w * 0.04, sw[1] - h * 0.03]], e.tint('#F1C40F', 1), { tension: 0 });
  e.pen.shape([[w * 0.22, hz + h * 0.22], [w * 0.3, hz + h * 0.14], [w * 0.33, hz + h * 0.14], [w * 0.27, hz + h * 0.22]], e.tint('#3498DB', 1), { part: 'slide', tension: 0.2, shade: true });
  e.pen.line([[w * 0.33, hz + h * 0.14], [w * 0.36, hz + h * 0.22]], e.tint('#7F8C8D', 1), 1.2);
  branchingTree(e, [w * 0.03, hz + h * 0.16], h * 0.3, 0.85, r.fork('t1'));
  branchingTree(e, [w * 0.97, hz + h * 0.12], h * 0.26, 0.75, r.fork('t2'));
  grassTufts(e, 30, hz + h * 0.1, h, e.grass);
}

function houses(e: Env) {
  const { w, h, hz } = e;
  const r = e.r.fork('houses');
  hills(e, hz - h * 0.005, h * 0.06, '#77AD6B', 0.2, 'far-hills');
  ground(e, e.grass);
  const k = portraitK(e);
  [[0.18, 0.05, 0.3], [0.55, 0.03, 0.26], [0.88, 0.06, 0.3]].forEach(([x, y, s], i) => house(e, [w * x, hz + h * y], w * s * k, 0.6 + y * 4, r.fork(i)));
  path(e, '#D9D2C5', 0.55, 0.22);
  scatter(e, 'garden', hz + h * 0.1, hz + h * 0.16, w * 0.25, 4, (p, d, rr) => bush(e, p, h * 0.03, 0.8 + d * 0.2, rr));
  branchingTree(e, [w * 0.98, hz + h * 0.2], h * 0.36, 0.95, r.fork('tree'));
  fence(e, hz + h * 0.25, 0, 0.42);
  flowers(e, 16, hz + h * 0.12, h);
}

function room(e: Env) {
  const { pen, w, h, hz } = e;
  const r = e.r.fork('room');
  const wallC = e.light(r.pick(['#F3E3C3', '#DCEAF2', '#F4D6CC', '#E4EFD9', '#EADCF2']));
  const floorC = e.light('#B07A4F');
  pen.raw(`<rect width="${w}" height="${h}" fill="${wallC}" data-part="wall"/>`);
  // floor: trapezoid with planks converging to a vanishing point
  const vp: Pt = [w / 2, hz - h * 0.35];
  pen.shape([[0, hz], [w, hz], [w, h], [0, h]], floorC, { part: 'floor', tension: 0, outline: 0 });
  for (let i = -6; i <= 6; i++) {
    const xb = w / 2 + (i * w) / 6;
    const t = (hz - vp[1]) / (h - vp[1]);
    pen.line([[lerp(vp[0], xb, t), hz], [xb, h]], shade(floorC, -0.12), 0.7, { opacity: 0.7 });
  }
  pen.shape([[0, hz - h * 0.012], [w, hz - h * 0.012], [w, hz], [0, hz]], shade(wallC, -0.2), { tension: 0, outline: 0.5, part: 'skirting' });
  // window showing the time of day
  const wx = w * 0.12;
  const wy = hz - h * 0.36;
  const ww = w * 0.36;
  const wh = h * 0.2;
  pen.def('wsky', `<linearGradient id="wsky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${e.skyTop}"/><stop offset="1" stop-color="${e.skyBottom}"/></linearGradient>`);
  pen.shape([[wx, wy], [wx + ww, wy], [wx + ww, wy + wh], [wx, wy + wh]], '#8D6E63', { part: 'window-frame', tension: 0 });
  pen.raw(`<rect x="${wx + 10}" y="${wy + 10}" width="${ww - 20}" height="${wh - 20}" fill="url(#wsky)"/>`);
  pen.line([[wx + ww / 2, wy], [wx + ww / 2, wy + wh]], '#8D6E63', 2.4);
  for (const k of [-1, 1]) pen.shape([[wx + ww / 2 + k * ww * 0.62, wy - h * 0.02], [wx + ww / 2 + k * ww * 0.42, wy - h * 0.02], [wx + ww / 2 + k * ww * 0.47, wy + wh + h * 0.03], [wx + ww / 2 + k * ww * 0.66, wy + wh + h * 0.03]], e.light('#C44569'), { part: 'curtain', tension: 0.4, shade: true });
  // shelf with books, picture frame, lamp, rug, table
  const sy = hz - h * 0.24;
  pen.shape([[w * 0.6, sy], [w * 0.92, sy], [w * 0.92, sy + h * 0.01], [w * 0.6, sy + h * 0.01]], '#6D4C41', { tension: 0, part: 'shelf' });
  let bx = w * 0.62;
  for (let i = 0; i < 7; i++) {
    const bw = w * r.range(0.018, 0.03);
    const bh = h * r.range(0.035, 0.05);
    pen.shape([[bx, sy], [bx, sy - bh], [bx + bw, sy - bh], [bx + bw, sy]], e.light(r.pick(['#E4572E', '#277DA1', '#F3CA40', '#4CB944', '#6A4C93'])), { tension: 0, outline: 0.6 });
    bx += bw + 2;
  }
  pen.shape([[w * 0.66, hz - h * 0.4], [w * 0.86, hz - h * 0.4], [w * 0.86, hz - h * 0.3], [w * 0.66, hz - h * 0.3]], '#A1887F', { tension: 0, part: 'picture' });
  pen.shape([[w * 0.68, hz - h * 0.31], [w * 0.74, hz - h * 0.37], [w * 0.78, hz - h * 0.33], [w * 0.81, hz - h * 0.36], [w * 0.84, hz - h * 0.31]], '#5C7FA6', { tension: 0, outline: 0.4 });
  pen.circle([w * 0.82, hz - h * 0.385], h * 0.006, '#FFD166', { outline: 0 });
  pen.ellipse([w * 0.5, h * 0.86], w * 0.4, h * 0.05, e.light('#C0392B'), { part: 'rug', shade: true });
  pen.ellipse([w * 0.5, h * 0.86], w * 0.3, h * 0.035, e.light('#F1C40F'), { outline: 0.4, opacity: 0.85 });
  const tx = w * 0.78;
  pen.shape([[tx - w * 0.12, hz + h * 0.06], [tx + w * 0.12, hz + h * 0.06], [tx + w * 0.1, hz + h * 0.075], [tx - w * 0.1, hz + h * 0.075]], '#8D6E63', { tension: 0, part: 'table', shade: true });
  for (const k of [-1, 1]) pen.line([[tx + k * w * 0.09, hz + h * 0.075], [tx + k * w * 0.09, hz + h * 0.16]], '#6D4C41', 1.6);
  pen.shape([[tx - w * 0.03, hz + h * 0.06], [tx - w * 0.015, hz + h * 0.02], [tx + w * 0.015, hz + h * 0.02], [tx + w * 0.03, hz + h * 0.06]], e.light('#F6BD60'), { part: 'lamp', tension: 0.2 });
  if (e.s.time === 'night') pen.raw(`<circle cx="${tx}" cy="${hz + h * 0.03}" r="${h * 0.08}" fill="#FFE8A3" opacity="0.25"/>`);
}

function fantasyWorld(e: Env) {
  const { w, h, hz } = e;
  const r = e.r.fork('fantasy');
  ridge(e, hz, h * 0.14, '#8E7CC3', 0.15, 'far-peaks');
  // castle on the far ridge
  const cb: Pt = [w * 0.62, hz - h * 0.02];
  const castleC = e.tint('#D7CCE8', 0.35);
  for (const [dx, tw, th] of [[-0.1, 0.05, 0.16], [0, 0.07, 0.22], [0.1, 0.05, 0.15], [-0.05, 0.12, 0.08], [0.05, 0.12, 0.08]] as const) {
    const x = cb[0] + w * dx - (w * tw) / 2;
    e.pen.shape([[x, cb[1]], [x, cb[1] - h * th], [x + w * tw, cb[1] - h * th], [x + w * tw, cb[1]]], castleC, { tension: 0, outline: 0.35, part: 'castle' });
    if (th > 0.1) {
      e.pen.shape([[x - w * 0.008, cb[1] - h * th], [x + (w * tw) / 2, cb[1] - h * (th + 0.07)], [x + w * tw + w * 0.008, cb[1] - h * th]], e.tint('#6C3FB0', 0.35), { tension: 0, outline: 0.35 });
      e.pen.shape([[x + (w * tw) / 2, cb[1] - h * (th + 0.07)], [x + (w * tw) / 2 + w * 0.03, cb[1] - h * (th + 0.065)], [x + (w * tw) / 2, cb[1] - h * (th + 0.055)]], '#FF6FB5', { tension: 0, outline: 0 });
    }
  }
  hills(e, hz + h * 0.01, h * 0.05, '#7E57C2', 0.4, 'mid-hills');
  ground(e, '#6FCF97');
  // floating islands: grass ellipse top + jagged inverted rock cone, waterfall from one
  for (const [i, [x, y, s]] of ([[0.2, 0.3, 0.16], [0.82, 0.22, 0.1], [0.5, 0.12, 0.07]] as const).entries()) {
    const c: Pt = [w * x, hz * y + h * 0.05];
    const rw = w * s;
    const rr = r.fork(`isl${i}`);
    const bottom: Pt[] = Array.from({ length: 7 }, (_, k) => [c[0] + rw * (1 - (k / 6) * 2), c[1] + rw * (0.5 + 0.5 * Math.sin((k / 6) * Math.PI)) * rr.range(0.6, 1.1)] as Pt);
    e.pen.shape([[c[0] - rw, c[1]], [c[0] + rw, c[1]], ...bottom], e.tint('#8D6E63', 0.6), { tension: 0.2, shade: true, outline: 0.6, part: 'island' });
    e.pen.ellipse(c, rw * 1.04, rw * 0.16, e.tint('#81C784', 0.6), { outline: 0.6, shade: true });
    if (i === 0) {
      e.pen.shape([[c[0] + rw * 0.4, c[1]], [c[0] + rw * 0.55, c[1]], [c[0] + rw * 0.6, hz + h * 0.05], [c[0] + rw * 0.35, hz + h * 0.05]], '#BDE8FF', { tension: 0.2, opacity: 0.85, outline: 0.3, part: 'waterfall' });
      branchingTree(e, [c[0] - rw * 0.4, c[1]], h * 0.12, 0.6, rr.fork('t'), 'blossom');
    }
  }
  // giant glowing mushrooms + crystals in the foreground
  for (const [i, [x, s]] of ([[0.12, 0.22], [0.86, 0.18], [0.7, 0.1]] as const).entries()) {
    const base: Pt = [w * x, hz + h * (0.18 + s * 0.4)];
    const hh = h * s;
    const capC = ['#FF6FB5', '#64D2FF', '#FFD166'][i];
    e.pen.raw(`<circle cx="${base[0]}" cy="${base[1] - hh}" r="${hh * 0.6}" fill="${capC}" opacity="0.18"/>`);
    e.pen.shape(limbPts([base, [base[0] + hh * 0.05, base[1] - hh * 0.9]], [hh * 0.16, hh * 0.12]), '#F5EBDD', { shade: true, part: 'mushroom-stem' });
    const cap = ellipsePts([base[0] + hh * 0.05, base[1] - hh * 0.92], hh * 0.45, hh * 0.3, 22).filter((p) => p[1] <= base[1] - hh * 0.9);
    e.pen.shape([...cap, [base[0] + hh * 0.5, base[1] - hh * 0.88], [base[0] - hh * 0.4, base[1] - hh * 0.88]], capC, { shade: true, part: 'mushroom-cap' });
    for (let k = 0; k < 4; k++) e.pen.circle([base[0] + hh * (-0.25 + k * 0.17), base[1] - hh * (1.02 + (k % 2) * 0.08)], hh * 0.04, '#FFFFFF', { outline: 0, opacity: 0.85 });
  }
  for (let i = 0; i < 4; i++) {
    const base: Pt = [w * (0.3 + i * 0.12), hz + h * (0.3 + (i % 2) * 0.05)];
    const ch = h * r.range(0.04, 0.08);
    const col = ['#B388FF', '#7CF7C9', '#64D2FF', '#FF8FD8'][i];
    e.pen.raw(`<circle cx="${base[0]}" cy="${base[1] - ch / 2}" r="${ch}" fill="${col}" opacity="0.15"/>`);
    e.pen.shape([[base[0] - ch * 0.25, base[1]], [base[0] - ch * 0.3, base[1] - ch * 0.6], [base[0], base[1] - ch], [base[0] + ch * 0.3, base[1] - ch * 0.6], [base[0] + ch * 0.25, base[1]]], col, { tension: 0, part: 'crystal' });
    e.pen.line([[base[0], base[1] - ch], [base[0], base[1]]], '#FFFFFF', 0.6, { opacity: 0.6, raw: true });
  }
  // sparkles
  for (let i = 0; i < 30; i++) {
    const c: Pt = [r() * w, r() * h * 0.9];
    const s = h * r.range(0.003, 0.008);
    e.pen.raw(`<path d="M${c[0]} ${c[1] - s * 2}L${c[0] + s * 0.5} ${c[1] - s * 0.5}L${c[0] + s * 2} ${c[1]}L${c[0] + s * 0.5} ${c[1] + s * 0.5}L${c[0]} ${c[1] + s * 2}L${c[0] - s * 0.5} ${c[1] + s * 0.5}L${c[0] - s * 2} ${c[1]}L${c[0] - s * 0.5} ${c[1] - s * 0.5}Z" fill="#FFFFFF" opacity="0.8"/>`);
  }
}

function riverbank(e: Env) {
  const { w, h, hz } = e;
  hills(e, hz - h * 0.01, h * 0.08, '#5E9E6E', 0.2, 'far-hills');
  ground(e, e.grass);
  // river: widening band curving to the viewer with ripple lines
  const river: Pt[] = [[w * 0.44, hz + h * 0.005], [w * 0.56, hz + h * 0.005], [w * 0.62, hz + h * 0.1], [w * 0.9, hz + h * 0.22], [w * 1.05, h * 0.82], [w * 0.35, h * 0.82], [w * 0.4, hz + h * 0.18], [w * 0.42, hz + h * 0.08]];
  e.pen.shape(river, e.light('#4FA3D9'), { part: 'river', tension: 0.45, shade: true, outline: 0.6 });
  const r = e.r.fork('ripples');
  for (let i = 0; i < 12; i++) {
    const y = lerp(hz + h * 0.03, h * 0.8, r());
    const x = lerp(w * 0.48, w * 0.8, r());
    e.pen.line([[x, y], [x + w * 0.04, y - h * 0.003], [x + w * 0.08, y]], '#DDF1FF', 0.8, { opacity: 0.7, raw: true });
  }
  palmTree(e, [w * 0.18, hz + h * 0.14], h * 0.3, 0.8, e.r.fork('palm'));
  branchingTree(e, [w * 0.88, hz + h * 0.06], h * 0.22, 0.55, e.r.fork('bt'), 'banyan');
  // a small boat
  const bt: Pt = [w * 0.66, hz + h * 0.16];
  e.pen.shape([[bt[0] - w * 0.1, bt[1] - h * 0.01], [bt[0] + w * 0.1, bt[1] - h * 0.01], [bt[0] + w * 0.07, bt[1] + h * 0.012], [bt[0] - w * 0.07, bt[1] + h * 0.012]], e.tint('#8B5A2B', 0.8), { part: 'boat', tension: 0.3, shade: true });
  grassTufts(e, 30, h * 0.8, h, e.grass);
  if (e.s.time === 'night' || e.s.time === 'sunset') fireflies(e, 26);
}

function mountainsScene(e: Env) {
  const { h, hz } = e;
  ridge(e, hz - h * 0.02, h * 0.3, '#7E9CC0', 0.15, 'far-peaks', true);
  ridge(e, hz + h * 0.01, h * 0.17, '#5C7FA6', 0.4, 'mid-peaks', e.s.season === 'winter');
  ground(e, e.s.season === 'winter' ? '#EEF3F7' : '#7FB069');
  scatter(e, 'pines', hz + h * 0.02, hz + h * 0.12, e.w * 0.08, 18, (p, d, r) => pineTree(e, p, h * (0.08 + d * 0.15), 0.4 + d * 0.6, r));
  scatter(e, 'rocks', h * 0.75, h * 0.95, e.w * 0.3, 4, (p, d, r) => rock(e, p, e.h * 0.03, 1, r));
}

function beach(e: Env) {
  const { pen, w, h, hz } = e;
  pen.shape([[0, hz], [w, hz], [w, hz + h * 0.14], [0, hz + h * 0.18]], e.light('#2F8FCB'), { part: 'sea', tension: 0.2, outline: 0 });
  for (let i = 0; i < 8; i++) pen.line([[w * (0.05 + i * 0.12), hz + h * (0.03 + (i % 3) * 0.035)], [w * (0.1 + i * 0.12), hz + h * (0.025 + (i % 3) * 0.035)]], '#E3F6FF', 0.9, { opacity: 0.8 });
  pen.shape([[0, hz + h * 0.18], [w, hz + h * 0.14], [w, h], [0, h]], e.light('#F2D59B'), { part: 'sand', tension: 0.3, outline: 0, shade: true });
  pen.line([[0, hz + h * 0.18], [w * 0.5, hz + h * 0.165], [w, hz + h * 0.14]], '#FFFFFF', 2, { opacity: 0.8 });
  palmTree(e, [w * 0.12, hz + h * 0.3], h * 0.36, 1, e.r.fork('palm1'));
  palmTree(e, [w * 0.9, hz + h * 0.24], h * 0.3, 0.85, e.r.fork('palm2'));
  scatter(e, 'shells', h * 0.85, h * 0.97, w * 0.2, 5, (p, d, r) => rock(e, p, h * 0.008, 1, r));
}

function desert(e: Env) {
  const { h, hz } = e;
  hills(e, hz, h * 0.05, '#E2B86B', 0.3, 'far-dunes');
  hills(e, hz + h * 0.06, h * 0.07, '#EBC27C', 0.6, 'mid-dunes');
  hills(e, hz + h * 0.18, h * 0.09, '#F0CC8A', 1, 'near-dunes');
  scatter(e, 'cacti', hz + h * 0.1, h * 0.9, e.w * 0.35, 3, (p, d, r) => {
    const s = h * 0.06 * (0.6 + d);
    const col = e.tint('#5B8C51', 0.6 + d * 0.4);
    e.pen.shape(limbPts([p, [p[0], p[1] - s]], [s * 0.22, s * 0.2]), col, { shade: true, part: 'cactus' });
    e.pen.shape(limbPts([[p[0], p[1] - s * 0.5], [p[0] + s * 0.3, p[1] - s * 0.55], [p[0] + s * 0.32, p[1] - s * 0.8]], [s * 0.13, s * 0.13, s * 0.12]), col, { shade: true });
    void r;
  });
}

function field(e: Env) {
  const { pen, w, h, hz } = e;
  hills(e, hz - h * 0.005, h * 0.06, '#7CB56B', 0.2, 'far-hills');
  ground(e, e.grass);
  // crop rows converging to the horizon
  for (let i = -8; i <= 8; i++) pen.line([[w / 2 + (i * w) / 40, hz + h * 0.01], [w / 2 + (i * w) / 4, h]], e.light(shade(e.grass, -0.15)), 1.2, { opacity: 0.7 });
  hut(e, [w * 0.8, hz + h * 0.05], w * 0.14 * portraitK(e), 0.6, e.r.fork('hut'));
  branchingTree(e, [w * 0.15, hz + h * 0.08], h * 0.24, 0.7, e.r.fork('tree'));
  fence(e, hz + h * 0.3, 0.55, 1);
  flowers(e, 10, hz + h * 0.25, h);
}

