/**
 * Map & globe renderers on real Natural Earth country shapes (world-atlas 110m, public domain) with d3-geo.
 * Modes: highlight · zoom · pins · route · compare · choropleth; plus an orthographic globe that spins to a place.
 */
import type { ReactElement } from 'react';
import { geoCentroid, geoGraticule10, geoInterpolate, geoNaturalEarth1, geoOrthographic, geoPath, type GeoPermissibleObjects } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';
import world from 'world-atlas/countries-110m.json';
import { enter, exitStyle, FONTS, parseData, clamp01, lerp, type Motion } from '../core.tsx';

type Country = Feature<Geometry, { name: string }>;
const topo = world as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
const COUNTRIES = (feature(topo, topo.objects.countries) as FeatureCollection<Geometry, { name: string }>).features as Country[];

const ALIASES: Record<string, string> = {
  usa: 'United States of America', us: 'United States of America', america: 'United States of America', 'united states': 'United States of America',
  uk: 'United Kingdom', britain: 'United Kingdom', england: 'United Kingdom', russia: 'Russia', 'south korea': 'South Korea', korea: 'South Korea',
  uae: 'United Arab Emirates', drc: 'Dem. Rep. Congo', congo: 'Congo', 'czech republic': 'Czechia', burma: 'Myanmar', 'ivory coast': "Côte d'Ivoire",
  bharat: 'India', hindustan: 'India',
};

export function findCountry(name: string): Country | undefined {
  const n = name.trim().toLowerCase();
  if (!n) return undefined;
  const want = ALIASES[n]?.toLowerCase() ?? n;
  return COUNTRIES.find((c) => c.properties.name.toLowerCase() === want) ?? COUNTRIES.find((c) => c.properties.name.toLowerCase().startsWith(want));
}

/** Major cities (lon, lat) for pins and routes. */
export const CITIES: Record<string, [number, number]> = {
  delhi: [77.21, 28.61], 'new delhi': [77.21, 28.61], mumbai: [72.88, 19.08], bengaluru: [77.59, 12.97], bangalore: [77.59, 12.97], chennai: [80.27, 13.08], kolkata: [88.36, 22.57], hyderabad: [78.49, 17.39], pune: [73.86, 18.52], ahmedabad: [72.57, 23.02], jaipur: [75.79, 26.91], lucknow: [80.95, 26.85], kochi: [76.27, 9.93], goa: [73.83, 15.49], varanasi: [82.97, 25.32], amritsar: [74.87, 31.63], guwahati: [91.74, 26.14], srinagar: [74.8, 34.08], patna: [85.14, 25.59], bhopal: [77.41, 23.26], chandigarh: [76.78, 30.73],
  london: [-0.13, 51.51], paris: [2.35, 48.86], berlin: [13.4, 52.52], madrid: [-3.7, 40.42], rome: [12.5, 41.9], moscow: [37.62, 55.76], istanbul: [28.98, 41.01], dubai: [55.27, 25.2], riyadh: [46.68, 24.71], cairo: [31.24, 30.04], lagos: [3.38, 6.52], nairobi: [36.82, -1.29], johannesburg: [28.05, -26.2],
  'new york': [-74.0, 40.71], washington: [-77.04, 38.9], 'los angeles': [-118.24, 34.05], 'san francisco': [-122.42, 37.77], chicago: [-87.63, 41.88], toronto: [-79.38, 43.65], 'mexico city': [-99.13, 19.43], 'sao paulo': [-46.63, -23.55], 'buenos aires': [-58.38, -34.6], lima: [-77.04, -12.05],
  beijing: [116.41, 39.9], shanghai: [121.47, 31.23], tokyo: [139.69, 35.69], seoul: [126.98, 37.57], singapore: [103.82, 1.35], bangkok: [100.5, 13.76], jakarta: [106.85, -6.21], manila: [120.98, 14.6], 'hong kong': [114.17, 22.32], dhaka: [90.41, 23.81], karachi: [67.0, 24.86], kathmandu: [85.32, 27.72], colombo: [79.86, 6.93], sydney: [151.21, -33.87], melbourne: [144.96, -37.81], auckland: [174.76, -36.85],
};
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
  return t === 'paper'
    ? { water: '#BFD7E3', land: '#EFE6D5', border: '#B9A98E', label: '#1D1D1B', grat: 'rgba(0,0,0,.08)' }
    : t === 'light'
      ? { water: '#EAF2F8', land: '#C9D6DF', border: '#FFFFFF', label: '#1D1D1B', grat: 'rgba(0,0,0,.06)' }
      : { water: '#0D1B2A', land: '#2B3F55', border: '#0D1B2A', label: '#FFFFFF', grat: 'rgba(255,255,255,.06)' };
}

/** Flat world map with editorial modes. */
export function worldMap(m: Motion): ReactElement {
  const col = themeColours(m);
  const mode = m.str('mode', 'highlight');
  const targetNames = m.str('country', 'India').split(/\s*,\s*/).filter(Boolean);
  const targets = targetNames.map(findCountry).filter((c): c is Country => Boolean(c));
  const focus = targets[0];
  const proj = geoNaturalEarth1();
  const pad = m.u * 4;
  proj.fitExtent([[pad, m.h * 0.15], [m.w - pad, m.h * 0.85]], { type: 'Sphere' } as GeoPermissibleObjects);
  const s0 = proj.scale();
  const t0 = proj.translate();
  // zoom target: fit the focus country (or the route's two ends) into the frame
  let s1 = s0;
  let c1: [number, number] = [0, 0];
  const routeFrom = cityAt(m.str('from', 'Delhi'));
  const routeTo = cityAt(m.str('to', 'London'));
  if (mode === 'compare' && targets.length > 1 && m.bool('zoom', true)) {
    const fc = { type: 'FeatureCollection', features: targets } as GeoPermissibleObjects;
    const fp = geoNaturalEarth1().fitExtent([[m.w * 0.1, m.h * 0.22], [m.w * 0.9, m.h * 0.78]], fc);
    s1 = fp.scale();
    c1 = geoCentroid(fc) as [number, number];
  } else if ((mode === 'highlight' || mode === 'pins') && m.bool('frame', m.portrait)) {
    // frame the subject with context: fit the country (or the pins) then pull back
    const pinPts = mode === 'pins' ? m.str('cities', 'Delhi, Mumbai, Bengaluru, Kolkata').split(/\s*,\s*/).map(cityAt).filter((p): p is [number, number] => Boolean(p)) : [];
    const subject = (mode === 'pins' ? { type: 'MultiPoint', coordinates: pinPts } : focus) as GeoPermissibleObjects | undefined;
    if (subject && (mode !== 'pins' || pinPts.length)) {
      const fp = geoNaturalEarth1().fitExtent([[m.w * 0.2, m.h * 0.3], [m.w * 0.8, m.h * 0.7]], subject);
      s1 = Math.max(s0, Math.min(fp.scale() * (mode === 'pins' ? 0.75 : 0.45), s0 * 10));
      c1 = geoCentroid(subject) as [number, number];
    }
  } else if ((mode === 'zoom' || m.bool('zoom', false)) && focus) {
    const fp = geoNaturalEarth1().fitExtent([[m.w * 0.15, m.h * 0.2], [m.w * 0.85, m.h * 0.8]], focus);
    s1 = fp.scale();
    c1 = geoCentroid(focus) as [number, number];
  }
  if (mode === 'route' && m.bool('zoom', true) && routeFrom && routeTo) {
    const line = { type: 'LineString', coordinates: [routeFrom, routeTo] } as GeoPermissibleObjects;
    const fp = geoNaturalEarth1().fitExtent([[m.w * 0.15, m.h * 0.25], [m.w * 0.85, m.h * 0.75]], line);
    s1 = Math.min(fp.scale(), s0 * 6);
    c1 = geoCentroid(line) as [number, number];
  }
  const kz = m.at(m.num('zoomAt', 0.4), m.num('zoomDur', 1.6), 'easeInOut');
  const zoomed = s1 !== s0;
  if (zoomed) {
    const s = s0 * (s1 / s0) ** kz; // geometric zoom feels linear to the eye
    proj.scale(s).center([lerp(0, c1[0], kz), lerp(0, c1[1], kz)]).translate([m.w / 2, m.h / 2]);
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
      <svg width={m.w} height={m.h}>
        <path d={path(geoGraticule10()) ?? ''} fill="none" stroke={col.grat} strokeWidth={1} />
        {COUNTRIES.map((c, i) => {
          const isT = targets.includes(c);
          let fill = col.land;
          if (choro.length) {
            const d = choro.find((x) => findCountry(x.label) === c);
            if (d) fill = mixTo(col.land, m.accent, (d.values[0] / maxV) * m.at(0.6, 1.2));
          } else if (isT && mode !== 'pins' && mode !== 'route') {
            const ci = targets.indexOf(c);
            fill = mixTo(col.land, mode === 'compare' ? compareCols[ci % 2] : m.accent, kHi);
          }
          return <path key={i} d={path(c) ?? ''} fill={fill} stroke={col.border} strokeWidth={isT ? 1.6 : 0.6} />;
        })}
        {focus && mode !== 'pins' && mode !== 'route' && kHi > 0 && (
          <path d={path(focus) ?? ''} fill="none" stroke={m.accent} strokeWidth={m.u * 0.5 * pulse} opacity={0.6 * kHi} />
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
      {m.str('note') && <div style={{ position: 'absolute', left: m.u * 6, right: m.u * 6, bottom: m.h * 0.08, fontFamily: m.font, fontWeight: 700, fontSize: m.u * 4, color: col.label, background: 'rgba(0,0,0,.35)', padding: m.u * 2, borderRadius: m.u, ...enter('up', m.at(m.D * 0.55, 0.5), 30) }}>{m.str('note')}</div>}
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
  const c: [number, number] = target ? (geoCentroid(target) as [number, number]) : [78, 22];
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
