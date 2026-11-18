/**
 * Map & globe renderers on real Natural Earth country shapes (world-atlas 110m, public domain) with d3-geo.
 * Modes: highlight · zoom · pins · route · compare · choropleth; plus an orthographic globe that spins to a place.
 */
import type { ReactElement } from 'react';
import { geoArea, geoCentroid, geoEquirectangular, geoGraticule10, geoInterpolate, geoNaturalEarth1, geoOrthographic, geoPath, type GeoPermissibleObjects, type GeoProjection } from 'd3-geo';
import { Img } from 'remotion';
import { assetUrl } from '../assetBase.ts';
import { feature } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';
import world from 'world-atlas/countries-110m.json';
import world50 from 'world-atlas/countries-50m.json';
import { ALIASES, CITIES } from '../places.ts';
import { enter, exitStyle, FONTS, parseData, clamp01, lerp, type Motion } from '../core.tsx';

type Country = Feature<Geometry, { name: string }>;
const topo = world as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
const COUNTRIES = (feature(topo, topo.objects.countries) as FeatureCollection<Geometry, { name: string }>).features as Country[];
// 5× more detailed borders for satellite maps, so they follow the coastlines in the photo (built on first use)
let detailed: Country[] | null = null;
const COUNTRIES_50 = (): Country[] => {
  if (!detailed) {
    const t = world50 as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
    detailed = (feature(t, t.objects.countries) as FeatureCollection<Geometry, { name: string }>).features as Country[];
  }
  return detailed;
};

export { CITIES };

export function findCountry(name: string, set: Country[] = COUNTRIES): Country | undefined {
  const n = name.trim().toLowerCase();
  if (!n) return undefined;
  const want = ALIASES[n]?.toLowerCase() ?? n;
  return set.find((c) => c.properties.name.toLowerCase() === want) ?? set.find((c) => c.properties.name.toLowerCase().startsWith(want));
}

/**
 * The main landmass of a country, for zooming and centring: Natural Earth counts overseas parts as one shape
 * (France includes French Guiana, the USA Alaska and Hawaii), which would zoom the camera out over an ocean.
 */
export function mainland(c: Country): Country {
  if (c.geometry.type !== 'MultiPolygon') return c;
  const polys = c.geometry.coordinates;
  let best = polys[0];
  let bestArea = -1;
  for (const p of polys) {
    const a = geoArea({ type: 'Polygon', coordinates: p } as GeoPermissibleObjects);
    if (a > bestArea) [best, bestArea] = [p, a];
  }
  return { ...c, geometry: { type: 'Polygon', coordinates: best } };
}

export const cityAt = (name: string): [number, number] | undefined => {
  const n = name.trim().toLowerCase();
  if (CITIES[n]) return CITIES[n];
  const m = n.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/); // "lat, lon"
  if (m) return [Number(m[2]), Number(m[1])];
  const c = findCountry(n);
  return c ? (geoCentroid(c) as [number, number]) : undefined;
};

function themeColours(m: Motion) {
  const t = m.str('mapTheme', 'dark');
  // satellite: the photo is the land and sea; land/water here are only the fallback and the globe
  if (t === 'satellite') return { water: '#0B2340', land: '#4A6B3A', border: 'rgba(255,255,255,.55)', label: '#FFFFFF', grat: 'rgba(255,255,255,.07)' };
  if (t === 'collage') return { water: '#E9E8E4', land: '#B4B4B0', border: '#F7F6F2', label: '#111111', grat: 'rgba(0,0,0,.05)' };
  return t === 'paper'
    ? { water: '#BFD7E3', land: '#EFE6D5', border: '#B9A98E', label: '#1D1D1B', grat: 'rgba(0,0,0,.08)' }
    : t === 'light'
      ? { water: '#EAF2F8', land: '#C9D6DF', border: '#FFFFFF', label: '#1D1D1B', grat: 'rgba(0,0,0,.06)' }
      : { water: '#0D1B2A', land: '#2B3F55', border: '#0D1B2A', label: '#FFFFFF', grat: 'rgba(255,255,255,.06)' };
}

// ---------------------------------------------------------------- satellite imagery (npm run maps:setup)
// NASA Blue Marble NG, equirectangular: world.jpg (5400×2700, 15 px/°) and 16×8 tiles of 22.5° (60 px/°)
const SAT = '/media/maps/bluemarble';
const TILE_COLS = 16;
const TILE_ROWS = 8;
const TILE_DEG = 22.5;

/** The photo under the map: placed by projecting image corners (equirectangular → a plain rectangle). */
function SatelliteLayer({ m, proj }: { m: Motion; proj: GeoProjection }) {
  const at = (lon: number, lat: number) => proj([lon, lat]) as [number, number];
  const [x0, y0] = at(-180, 90);
  const [x1, y1] = at(180, -90);
  const worldW = x1 - x0;
  const pxPerDeg = worldW / 360;
  const imgs: Array<{ key: string; src: string; x: number; y: number; w: number; h: number }> = [];
  // the whole Earth, repeated left and right so a view near the date line has no gap
  for (const k of [-1, 0, 1]) {
    const x = x0 + k * worldW;
    if (x + worldW < 0 || x > m.w) continue;
    imgs.push({ key: `w${k}`, src: `${SAT}/world.jpg`, x, y: y0, w: worldW, h: y1 - y0 });
  }
  // sharper tiles once the world image would be stretched (zoomed into a region)
  if (pxPerDeg > 15 * 1.25) {
    for (let r = 0; r < TILE_ROWS; r++) {
      for (let c = 0; c < TILE_COLS; c++) {
        const [tx, ty] = at(-180 + c * TILE_DEG, 90 - r * TILE_DEG);
        const tw = TILE_DEG * pxPerDeg;
        if (tx + tw < 0 || tx > m.w || ty + tw < 0 || ty > m.h) continue;
        imgs.push({ key: `t${r}-${c}`, src: `${SAT}/tiles/r${r}c${c}.jpg`, x: tx, y: ty, w: tw, h: tw });
      }
    }
  }
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {imgs.map((i) => (
        // +1px overlap hides hairline seams between tiles
        <Img key={i.key} src={assetUrl(i.src)} style={{ position: 'absolute', left: i.x, top: i.y, width: i.w + 1, height: i.h + 1, maxWidth: 'none' }} />
      ))}
    </div>
  );
}

/** Flat world map with editorial modes. */
export function worldMap(m: Motion): ReactElement {
  const col = themeColours(m);
  const satellite = m.str('mapTheme', 'dark') === 'satellite';
  const mode = m.str('mode', 'highlight');
  const targetNames = m.str('country', 'India').split(/\s*,\s*/).filter(Boolean);
  const shapes = satellite ? COUNTRIES_50() : COUNTRIES;
  const targets = targetNames.map((n) => findCountry(n, shapes)).filter((c): c is Country => Boolean(c));
  const focus = targets[0];
  const focusLand = focus ? mainland(focus) : undefined; // zoom and centre on the main landmass
  // satellite needs a plain lon/lat grid so the photo lines up with the borders
  const geoProj = (): GeoProjection => (satellite ? geoEquirectangular() : geoNaturalEarth1());
  const proj = geoProj();
  const pad = m.u * 4;
  if (satellite) {
    // fill the frame with Earth (no empty bands): cover rather than fit
    const s = Math.max(m.w / (2 * Math.PI), m.h / Math.PI) * 1.02;
    proj.scale(s).translate([m.w / 2, m.h / 2]);
  } else proj.fitExtent([[pad, m.h * 0.15], [m.w - pad, m.h * 0.85]], { type: 'Sphere' } as GeoPermissibleObjects);
  const s0 = proj.scale();
  const t0 = proj.translate();
  // zoom target: fit the focus country (or the route's two ends) into the frame
  let s1 = s0;
  let c1: [number, number] = [0, 0];
  const routeFrom = cityAt(m.str('from', 'Delhi'));
  const routeTo = cityAt(m.str('to', 'London'));
  if (mode === 'compare' && targets.length > 1 && m.bool('zoom', true)) {
    const fc = { type: 'FeatureCollection', features: targets.map(mainland) } as GeoPermissibleObjects;
    const fp = geoProj().fitExtent([[m.w * 0.1, m.h * 0.22], [m.w * 0.9, m.h * 0.78]], fc);
    s1 = fp.scale();
    c1 = geoCentroid(fc) as [number, number];
  } else if ((mode === 'highlight' || mode === 'pins') && m.bool('frame', m.portrait)) {
    // frame the subject with context: fit the country (or the pins) then pull back
    const pinPts = mode === 'pins' ? m.str('cities', 'Delhi, Mumbai, Bengaluru, Kolkata').split(/\s*,\s*/).map(cityAt).filter((p): p is [number, number] => Boolean(p)) : [];
    const subject = (mode === 'pins' ? { type: 'MultiPoint', coordinates: pinPts } : focusLand) as GeoPermissibleObjects | undefined;
    if (subject && (mode !== 'pins' || pinPts.length)) {
      const fp = geoProj().fitExtent([[m.w * 0.2, m.h * 0.3], [m.w * 0.8, m.h * 0.7]], subject);
      s1 = Math.max(s0, Math.min(fp.scale() * (mode === 'pins' ? 0.75 : 0.45), s0 * 10));
      c1 = geoCentroid(subject) as [number, number];
    }
  } else if ((mode === 'zoom' || m.bool('zoom', false)) && focus) {
    const fp = geoProj().fitExtent([[m.w * 0.15, m.h * 0.2], [m.w * 0.85, m.h * 0.8]], focusLand!);
    s1 = fp.scale();
    c1 = geoCentroid(focusLand!) as [number, number];
  }
  if (mode === 'route' && m.bool('zoom', true) && routeFrom && routeTo) {
    const line = { type: 'LineString', coordinates: [routeFrom, routeTo] } as GeoPermissibleObjects;
    const fp = geoProj().fitExtent([[m.w * 0.15, m.h * 0.25], [m.w * 0.85, m.h * 0.75]], line);
    s1 = Math.min(fp.scale(), s0 * 6);
    c1 = geoCentroid(line) as [number, number];
  }
  const kz = m.at(m.num('zoomAt', 0.4), m.num('zoomDur', 1.6), 'easeInOut');
  const zoomed = s1 !== s0;
  if (zoomed) {
    const s = s0 * (s1 / s0) ** kz; // geometric zoom feels linear to the eye
    // the camera travels to the place first, then dives in (no long detour over other countries)
    const kc = 1 - (1 - kz) ** 3;
    proj.scale(s).center([lerp(0, c1[0], kc), lerp(0, c1[1], kc)]).translate([m.w / 2, m.h / 2]);
  } else {
    proj.scale(s0).translate(t0);
  }
  const path = geoPath(proj);
  const kMap = m.at(0, 0.6);
  const kHi = m.at(zoomed ? 0.4 + m.num('zoomDur', 1.6) * 0.8 : 0.6, 0.5);
  const pulse = 0.85 + Math.sin(m.t * 5) * 0.15;
  const choro = mode === 'choropleth' ? parseData(m.str('data', 'India:142, China:141, United States of America:34, Indonesia:28')) : [];
  const maxV = Math.max(1, ...choro.map((d) => d.values[0]));
  const compareCols = [m.accent, m.str('accent2', '#E63946')];
  const pins = mode === 'pins' ? m.str('cities', 'Delhi, Mumbai, Bengaluru, Kolkata').split(/\s*,\s*/).filter(Boolean) : [];
  // route: great-circle points, revealed progressively; a dot travels the path
  let routeD = '';
  let head: [number, number] | null = null;
  if (mode === 'route' && routeFrom && routeTo) {
    const ip = geoInterpolate(routeFrom, routeTo);
    const kr = m.at(zoomed ? 0.4 + m.num('zoomDur', 1.6) : 0.6, m.num('routeDur', 1.8), 'easeInOut');
    const reach = clamp01(kr);
    const count = Math.max(2, Math.ceil(64 * reach) + 1);
    const pts = Array.from({ length: count }, (_, i) => proj(ip((i / (count - 1)) * reach)) as [number, number] | null).filter((p): p is [number, number] => Boolean(p));
    routeD = reach > 0 && pts.length > 1 ? `M${pts.map((p) => p.join(' ')).join(' L')}` : '';
    head = kr > 0 && kr < 1 ? (proj(ip(clamp01(kr))) as [number, number]) : null;
  }
  const ex = exitStyle(m);
  return (
    <div style={{ position: 'absolute', inset: 0, background: col.water, ...ex, opacity: kMap * (typeof ex.opacity === 'number' ? ex.opacity : 1) }}>
      {satellite && <SatelliteLayer m={m} proj={proj} />}
      <svg width={m.w} height={m.h} style={{ position: 'absolute', inset: 0 }}>
        {satellite && (
          <defs>
            <filter id="sat-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation={m.u * 0.6} result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
        )}
        {!satellite && <path d={path(geoGraticule10()) ?? ''} fill="none" stroke={col.grat} strokeWidth={1} />}
        {shapes.map((c, i) => {
          const isT = targets.includes(c);
          let fill = col.land;
          if (choro.length) {
            const d = choro.find((x) => findCountry(x.label, shapes) === c);
            if (d) fill = mixTo(col.land, m.accent, (d.values[0] / maxV) * m.at(0.6, 1.2));
          } else if (isT && mode !== 'pins' && mode !== 'route') {
            const ci = targets.indexOf(c);
            fill = mixTo(col.land, mode === 'compare' ? compareCols[ci % 2] : m.accent, kHi);
          }
          if (satellite) {
            // the photo shows the land; countries are see-through with thin white borders, the subject tinted
            const ci = targets.indexOf(c);
            const d = choro.length ? choro.find((x) => findCountry(x.label, shapes) === c) : undefined;
            const tint = d ? m.accent : isT && mode !== 'pins' && mode !== 'route' ? (mode === 'compare' ? compareCols[ci % 2] : m.accent) : null;
            const a = d ? (d.values[0] / maxV) * 0.6 * m.at(0.6, 1.2) : tint ? 0.42 * kHi : 0;
            return <path key={i} d={path(c) ?? ''} fill={tint ?? 'none'} fillOpacity={a} stroke={col.border} strokeWidth={isT ? 1.2 : 0.5} />;
          }
          return <path key={i} d={path(c) ?? ''} fill={fill} stroke={col.border} strokeWidth={isT ? 1.6 : 0.6} />;
        })}
        {focus && mode !== 'pins' && mode !== 'route' && kHi > 0 && (
          <path d={path(focus) ?? ''} fill="none" stroke={m.accent} strokeWidth={m.u * (satellite ? 0.45 : 0.5) * pulse} opacity={(satellite ? 0.95 : 0.6) * kHi} filter={satellite ? 'url(#sat-glow)' : undefined} />
        )}
        {routeD && <path d={routeD} fill="none" stroke={m.accent} strokeWidth={m.u * 0.7} strokeLinecap="round" strokeDasharray={m.str('line', 'solid') === 'dotted' ? `1 ${m.u * 1.8}` : m.str('line', 'solid') === 'dashed' ? `${m.u * 2} ${m.u * 1.4}` : undefined} />}
        {head && <circle cx={head[0]} cy={head[1]} r={m.u * 1.4} fill="#fff" stroke={m.accent} strokeWidth={m.u * 0.5} />}
        {mode === 'route' &&
          [routeFrom, routeTo].map((ll, i) => {
            if (!ll) return null;
            const p = proj(ll) as [number, number];
            const k = m.at(i === 0 ? 0.5 : 0.6 + m.num('routeDur', 1.8) + (zoomed ? m.num('zoomDur', 1.6) : 0), 0.4, 'back');
            return <Pin key={i} m={m} x={p[0]} y={p[1]} k={k} label={(i === 0 ? m.str('from', 'Delhi') : m.str('to', 'London'))} colour={col.label} />;
          })}
        {pins.map((name, i) => {
          const ll = cityAt(name);
          if (!ll) return null;
          const p = proj(ll) as [number, number];
          return <Pin key={i} m={m} x={p[0]} y={p[1]} k={m.at(0.6 + i * m.num('stagger', 0.3), 0.45, 'bounce')} label={name} colour={col.label} />;
        })}
        {m.bool('labels', true) &&
          (mode === 'highlight' || mode === 'zoom' || mode === 'compare') &&
          targets.map((c, i) => {
            const p = proj(geoCentroid(c) as [number, number]) as [number, number];
            return (
              <text key={i} x={p[0]} y={p[1]} textAnchor="middle" dominantBaseline="middle" fontFamily={m.font} fontWeight={900} fontSize={m.u * 4} fill={col.label} stroke={col.water} strokeWidth={m.u * 0.6} paintOrder="stroke" opacity={m.at(1 + (zoomed ? 1.4 : 0) + i * 0.2, 0.5)}>
                {m.str('label', c.properties.name).split(/\s*,\s*/)[i] ?? c.properties.name}
              </text>
            );
          })}
      </svg>
      {m.str('title') && <div style={{ position: 'absolute', left: m.u * 6, right: m.u * 6, top: m.h * 0.06, fontFamily: m.font, fontWeight: 900, fontSize: m.u * 5.5, color: col.label, ...enter('up', m.at(0.2, 0.5), 30) }}>{m.str('title')}</div>}
      <AiNote m={m} />
      {m.str('note') && <div style={{ position: 'absolute', left: m.w * 0.055, maxWidth: m.portrait ? '70%' : '48%', top: m.h * 0.075 + (m.str('title') ? m.u * 9 : 0), fontFamily: m.font, fontWeight: 700, fontSize: m.u * 3.4, lineHeight: 1.25, color: '#FFFFFF', background: 'rgba(0,0,0,.6)', padding: `${m.u * 1.4}px ${m.u * 2}px`, borderRadius: m.u, ...enter('down', m.at(m.D * 0.55, 0.5), 30) }}>{m.str('note')}</div>}
    </div>
  );
}

/**
 * Small disclaimer on every map and globe: "Visuals are generated by AI" (top-right, clear of captions and notes).
 * Change the words with aiNote="…", or hide it with aiNote=off.
 */
export function AiNote({ m, dark = true }: { m: Motion; dark?: boolean }) {
  const text = m.str('aiNote', 'Visuals are generated by AI');
  if (!text || /^(off|none|false|no)$/i.test(text)) return null;
  return (
    <div
      style={{
        position: 'absolute',
        top: m.h * 0.075,
        right: m.w * 0.055,
        padding: `${m.u * 0.7}px ${m.u * 1.6}px`,
        borderRadius: m.u * 0.8,
        background: dark ? 'rgba(0,0,0,.55)' : 'rgba(255,255,255,.8)',
        color: dark ? '#FFFFFF' : '#111111',
        fontFamily: FONTS.sans,
        fontWeight: 600,
        fontSize: m.u * 2.5,
        letterSpacing: '0.02em',
        opacity: m.at(0.3, 0.5),
      }}
    >
      {text}
    </div>
  );
}

/** The note on its own, for any scene (AI-painted flags, or a [aiNote] tag). */
export function aiNoteFx(m: Motion): ReactElement {
  return (
    <div style={{ position: 'absolute', inset: 0, ...exitStyle(m) }}>
      <AiNote m={m} dark={m.str('tone', 'dark') !== 'light'} />
    </div>
  );
}

function Pin({ m, x, y, k, label, colour }: { m: Motion; x: number; y: number; k: number; label: string; colour: string }) {
  if (k <= 0) return null;
  const s = m.u * 2.6;
  const ripple = (m.t * 1.2) % 1;
  return (
    <g transform={`translate(${x} ${y - (1 - clamp01(k)) * m.u * 10})`} opacity={clamp01(k * 2)}>
      <circle r={s * (1 + ripple * 2)} fill="none" stroke={m.accent} strokeWidth={2} opacity={1 - ripple} />
      <path d={`M0 0 C ${-s} ${-s * 1.2}, ${-s} ${-s * 2.6}, 0 ${-s * 2.6} C ${s} ${-s * 2.6}, ${s} ${-s * 1.2}, 0 0 Z`} fill={m.accent} stroke="#1D1D1B" strokeWidth={1.5} />
      <circle cy={-s * 1.75} r={s * 0.35} fill="#fff" />
      <text y={-s * 3.2} textAnchor="middle" fontFamily={FONTS.sans} fontWeight={800} fontSize={m.u * 3} fill={colour} stroke="rgba(0,0,0,.45)" strokeWidth={m.u * 0.5} paintOrder="stroke">{label}</text>
    </g>
  );
}

/** Orthographic globe: spins from a starting longitude to the country, which lights up; optional pin. */
export function globe(m: Motion): ReactElement {
  const col = themeColours(m);
  const target = findCountry(m.str('country', 'India'));
  const c: [number, number] = target ? (geoCentroid(mainland(target)) as [number, number]) : [78, 22];
  const k = m.at(0.2, m.num('spinDur', 2), 'easeInOut');
  const startLon = m.num('startLon', c[0] - 150);
  const R = Math.min(m.w, m.h) * 0.38;
  const idle = m.t > 0.2 + m.num('spinDur', 2) ? (m.t - 0.2 - m.num('spinDur', 2)) * 3 : 0;
  const proj = geoOrthographic()
    .scale(R)
    .translate([m.w / 2, m.h / 2])
    .rotate([-lerp(startLon, c[0], k) - idle, -lerp(10, c[1] * 0.8, k)])
    .clipAngle(90);
  const path = geoPath(proj);
  const kHi = m.at(0.2 + m.num('spinDur', 2) * 0.85, 0.5);
  return (
    <div style={{ position: 'absolute', inset: 0, ...exitStyle(m) }}>
      <svg width={m.w} height={m.h}>
        <defs>
          <radialGradient id="glow" cx="40%" cy="35%" r="70%">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.18" />
            <stop offset="1" stopColor="#000000" stopOpacity="0.35" />
          </radialGradient>
        </defs>
        <circle cx={m.w / 2} cy={m.h / 2} r={R * 1.08} fill={m.accent} opacity={0.08} />
        <circle cx={m.w / 2} cy={m.h / 2} r={R} fill={col.water} transform={`scale(1)`} opacity={m.at(0, 0.5)} />
        <path d={path(geoGraticule10()) ?? ''} fill="none" stroke={col.grat} strokeWidth={1} />
        {COUNTRIES.map((cc, i) => (
          <path key={i} d={path(cc) ?? ''} fill={cc === target ? mixTo(col.land, m.accent, kHi) : col.land} stroke={col.border} strokeWidth={0.6} />
        ))}
        <circle cx={m.w / 2} cy={m.h / 2} r={R} fill="url(#glow)" />
        {target && kHi > 0 && m.bool('pin', true) && (() => {
          const p = proj(c) as [number, number] | null;
          return p ? <Pin m={m} x={p[0]} y={p[1]} k={kHi} label={m.str('label', target.properties.name)} colour="#fff" /> : null;
        })()}
      </svg>
      <AiNote m={m} />
      {m.str('title') && <div style={{ position: 'absolute', left: 0, right: 0, top: m.h * 0.06, textAlign: 'center', fontFamily: m.font, fontWeight: 900, fontSize: m.u * 6, color: m.color, ...enter('up', m.at(0.3, 0.5), 30) }}>{m.str('title')}</div>}
    </div>
  );
}

function mixTo(a: string, b: string, t: number) {
  const pa = hex(a);
  const pb = hex(b);
  const k = clamp01(t);
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * k)).join(',')})`;
}
function hex(c: string): number[] {
  const m = c.replace('#', '').match(/^([0-9a-f]{6})$/i);
  if (!m) return [128, 128, 128];
  return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
}
