/**
 * Data visualisation renderers. Every chart reads `data` ("Label:value, …"; "a|b" for stacked/grouped) and
 * builds in editorial order: title → axes/grid draw → marks grow (staggered) → labels → highlight → note.
 */
import type { ReactElement } from 'react';
import { Draw, enter, exitStyle, FONTS, formatNumber, parseData, Stage, Svg, clamp01, lerp, type Motion } from '../core.tsx';

const PALETTE = ['#2A6FDB', '#F9D84A', '#E63946', '#2A9D8F', '#F4A261', '#8E7DBE', '#3D405B', '#90BE6D'];
const colours = (m: Motion) => {
  const c = m.str('colors', '');
  return c ? c.split(/[\s,]+/).filter((x) => /^#[0-9a-f]{3,8}$/i.test(x)) : PALETTE;
};

function numberParts(m: Motion) {
  const fmt = m.str('format', 'number');
  const cur = m.str('currency', '₹');
  return {
    prefix: m.str('prefix', fmt === 'currency' ? cur : ''),
    suffix: m.str('suffix', fmt === 'percent' ? '%' : ''),
    decimals: m.num('decimals', fmt === 'decimal' ? 1 : 0),
    grouping: (m.str('grouping', cur === '₹' && fmt === 'currency' ? 'indian' : 'intl') as 'intl' | 'indian' | 'none'),
  };
}

/** Big counter: label → number counts (or rolls like an odometer) → settles → support text → underline. */
export function counter(m: Motion): ReactElement {
  const size = m.num('size', 16) * m.u;
  const from = m.num('from', 0);
  const to = m.num('value', 400);
  const countDur = m.num('countDur', 1.6);
  const k = m.at(0.3, countDur, m.str('countEase', 'expo'));
  const v = lerp(from, to, clamp01(k));
  const parts = numberParts(m);
  const settle = m.at(0.3 + countDur, 0.35, 'back');
  const odo = m.str('style', 'count') === 'odometer';
  const text = formatNumber(odo ? to : v, parts);
  return (
    <Stage m={m}>
      {m.str('label') && <div style={{ fontFamily: FONTS.sans, fontSize: size * 0.2, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: m.accent, ...enter('up', m.at(0, 0.4), 20) }}>{m.str('label')}</div>}
      <div style={{ fontFamily: FONTS[m.str('font', 'impact')] ?? m.font, fontSize: size, fontWeight: 900, color: m.color, lineHeight: 1.05, transform: `scale(${1 + (settle > 0 && settle < 1 ? Math.sin(settle * Math.PI) * 0.05 : 0)})`, textShadow: '0 6px 24px rgba(0,0,0,.35)', display: 'flex' }}>
        {odo
          ? Array.from(text).map((ch, i) => {
              if (!/\d/.test(ch)) return <span key={i}>{ch}</span>;
              const target = Number(ch);
              const kk = m.at(0.3 + i * Math.min(0.08, 0.5 / text.length), countDur, 'easeOut');
              const spins = 2 + i;
              const pos = (target + spins * 10) * clamp01(kk);
              return (
                <span key={i} style={{ display: 'inline-block', height: '1.05em', overflow: 'hidden', position: 'relative', width: '0.62em' }}>
                  <span style={{ position: 'absolute', left: 0, top: `${-(pos % 10) * 1.05}em` }}>
                    {Array.from({ length: 11 }, (_, n) => (
                      <span key={n} style={{ display: 'block', height: '1.05em', textAlign: 'center' }}>{n % 10}</span>
                    ))}
                  </span>
                </span>
              );
            })
          : text}
      </div>
      {m.str('text') && <div style={{ fontFamily: m.font, fontSize: size * 0.26, fontWeight: 600, color: m.color, opacity: 0.9, textAlign: 'center', maxWidth: '90%', ...enter('up', m.at(0.4 + countDur, 0.5), 30) }}>{m.str('text')}</div>}
      {m.bool('underline', true) && (
        <svg width={size * 3.2} height={size * 0.25} viewBox="0 0 100 10" preserveAspectRatio="none">
          <Draw d="M2 6 C 30 3, 65 9, 98 4" k={m.at(0.6 + countDur, 0.6, 'easeInOut')} stroke={m.accent} width={size * 0.05} fixed />
        </svg>
      )}
    </Stage>
  );
}

/** Shared chart frame: title + optional note + plot box (frame px). */
function chartBox(m: Motion) {
  const pad = m.u * 8;
  const top = m.h * (m.portrait ? 0.3 : 0.2);
  const bottom = m.h * (m.portrait ? 0.72 : 0.84);
  return { x0: pad * 1.4, x1: m.w - pad, y0: top, y1: bottom };
}

function ChartTitle({ m }: { m: Motion }) {
  const size = m.num('titleSize', 5) * m.u;
  return (
    <>
      {m.str('title') && <div style={{ position: 'absolute', left: m.u * 8, right: m.u * 8, top: m.h * (m.portrait ? 0.17 : 0.06), fontFamily: m.font, fontWeight: 800, fontSize: size, color: m.color, ...enter('up', m.at(0, 0.5), 30) }}>{m.str('title')}</div>}
      {m.str('note') && <div style={{ position: 'absolute', left: m.u * 8, right: m.u * 8, top: m.h * (m.portrait ? 0.76 : 0.88), fontFamily: m.font, fontWeight: 600, fontSize: size * 0.6, color: m.color, opacity: 0.85, ...enter('up', m.at(m.D * 0.6, 0.5), 30) }}>{m.str('note')}</div>}
      {m.str('source') && <div style={{ position: 'absolute', right: m.u * 4, bottom: m.u * 3, fontFamily: FONTS.sans, fontSize: m.u * 2.2, color: m.color, opacity: 0.6 * m.at(0.5, 0.5) }}>Source: {m.str('source')}</div>}
    </>
  );
}

/** Bars: vertical/horizontal, stacked or grouped (a|b), optional sort, highlight one bar, value labels, axis & grid draw. */
export function bars(m: Motion): ReactElement {
  const rows = parseData(m.str('data'));
  const sort = m.str('sort', 'none');
  if (sort === 'desc') rows.sort((a, b) => b.values.reduce((x, y) => x + y, 0) - a.values.reduce((x, y) => x + y, 0));
  if (sort === 'asc') rows.sort((a, b) => a.values.reduce((x, y) => x + y, 0) - b.values.reduce((x, y) => x + y, 0));
  const horizontal = m.str('orientation', m.portrait ? 'horizontal' : 'vertical') === 'horizontal';
  const mode = m.str('mode', 'stacked');
  const max = Math.max(...rows.map((r) => (mode === 'grouped' ? Math.max(...r.values) : r.values.reduce((a, b) => a + b, 0)))) || 1;
  const hi = m.str('highlight', '').toLowerCase();
  const pal = colours(m);
  const b = chartBox(m);
  const kAxis = m.at(0.3, 0.5, 'easeInOut');
  const n = rows.length;
  const fsLab = m.u * 3.4;
  if (horizontal) b.x0 = Math.max(b.x0, Math.min(m.w * 0.35, Math.max(...rows.map((r) => r.label.length)) * fsLab * 0.58 + m.u * 3));
  const slot = (horizontal ? b.y1 - b.y0 : b.x1 - b.x0) / n;
  const thick = slot * 0.62;
  const fs = m.u * 3.4;
  const parts = numberParts(m);
  return (
    <div style={{ position: 'absolute', inset: 0, ...exitStyle(m) }}>
      <ChartTitle m={m} />
      <svg width={m.w} height={m.h} style={{ position: 'absolute', inset: 0 }}>
        {m.bool('grid', true) &&
          [0.25, 0.5, 0.75, 1].map((g, i) => {
            const d = horizontal ? `M${lerp(b.x0, b.x1, g)} ${b.y0} L${lerp(b.x0, b.x1, g)} ${b.y1}` : `M${b.x0} ${lerp(b.y1, b.y0, g)} L${b.x1} ${lerp(b.y1, b.y0, g)}`;
            return <Draw key={i} d={d} k={m.at(0.35 + i * 0.05, 0.5)} stroke={m.color} width={1} opacity={0.15} />;
          })}
        <Draw d={horizontal ? `M${b.x0} ${b.y0} L${b.x0} ${b.y1}` : `M${b.x0} ${b.y1} L${b.x1} ${b.y1}`} k={kAxis} stroke={m.color} width={3} />
        {rows.map((r, i) => {
          const k = m.at(0.6 + i * m.num('stagger', 0.18), m.num('growDur', 0.8), m.str('growEase', 'editorial'));
          const isHi = hi && r.label.toLowerCase().includes(hi);
          const kHi = isHi ? m.at(0.6 + n * 0.18 + 0.5, 0.4) : 0;
          let acc = 0;
          const segs = r.values.map((v, j) => {
            const len = (v / max) * (horizontal ? b.x1 - b.x0 : b.y1 - b.y0) * clamp01(k) * (k > 1 ? k : 1);
            const groupW = mode === 'grouped' ? thick / r.values.length : thick;
            const off = mode === 'grouped' ? j * groupW : 0;
            const base = mode === 'grouped' ? 0 : acc;
            acc += mode === 'grouped' ? 0 : len;
            const col = hi ? (isHi ? m.accent : `${pal[j % pal.length]}`) : pal[(r.values.length > 1 ? j : i) % pal.length];
            const dim = hi && !isHi ? 0.35 + 0.65 * (1 - m.at(0.6 + n * 0.18 + 0.5, 0.4)) : 1;
            return horizontal ? (
              <rect key={j} x={b.x0 + base} y={b.y0 + i * slot + (slot - thick) / 2 + off} width={Math.max(0, len)} height={groupW * 0.94} fill={col} opacity={dim} rx={m.u * 0.6} />
            ) : (
              <rect key={j} x={b.x0 + i * slot + (slot - thick) / 2 + off} y={b.y1 - base - len} width={groupW * 0.94} height={Math.max(0, len)} fill={col} opacity={dim} rx={m.u * 0.6} />
            );
          });
          const total = r.values.reduce((a, c) => a + c, 0);
          const shown = (mode === 'grouped' ? Math.max(...r.values) : total) * clamp01(k);
          const end = (shown / max) * (horizontal ? b.x1 - b.x0 : b.y1 - b.y0);
          return (
            <g key={i}>
              {segs}
              {isHi && kHi > 0 && (horizontal
                ? <rect x={b.x0 - m.u} y={b.y0 + i * slot + (slot - thick) / 2 - m.u} width={end + 2 * m.u} height={thick + 2 * m.u} fill="none" stroke={m.accent} strokeWidth={3} opacity={kHi} rx={m.u} />
                : <rect x={b.x0 + i * slot + (slot - thick) / 2 - m.u} y={b.y1 - end - m.u} width={thick + 2 * m.u} height={end + 2 * m.u} fill="none" stroke={m.accent} strokeWidth={3} opacity={kHi} rx={m.u} />)}
              {horizontal ? (
                <>
                  <text x={b.x0 - m.u * 1.5} y={b.y0 + i * slot + slot / 2} textAnchor="end" dominantBaseline="middle" fontFamily={m.font} fontSize={fs} fontWeight={700} fill={m.color} opacity={m.at(0.4 + i * 0.1, 0.4)}>{r.label}</text>
                  <text x={b.x0 + end + m.u * 1.5} y={b.y0 + i * slot + slot / 2} dominantBaseline="middle" fontFamily={m.font} fontSize={fs} fontWeight={800} fill={isHi ? m.accent : m.color} opacity={clamp01(k)}>{formatNumber(shown, parts)}</text>
                </>
              ) : (
                <>
                  <text x={b.x0 + i * slot + slot / 2} y={b.y1 + fs * 1.4} textAnchor="middle" fontFamily={m.font} fontSize={fs} fontWeight={700} fill={m.color} opacity={m.at(0.4 + i * 0.1, 0.4)}>{r.label}</text>
                  <text x={b.x0 + i * slot + slot / 2} y={b.y1 - end - fs * 0.6} textAnchor="middle" fontFamily={m.font} fontSize={fs} fontWeight={800} fill={isHi ? m.accent : m.color} opacity={clamp01(k)}>{formatNumber(shown, parts)}</text>
                </>
              )}
            </g>
          );
        })}
      </svg>
      {m.str('legend') && <Legend m={m} names={m.str('legend').split(/\s*,\s*/)} />}
    </div>
  );
}

function Legend({ m, names }: { m: Motion; names: string[] }) {
  const pal = colours(m);
  return (
    <div style={{ position: 'absolute', left: m.u * 8, top: m.h * (m.portrait ? 0.24 : 0.13), display: 'flex', gap: m.u * 3, fontFamily: m.font, fontSize: m.u * 3, color: m.color }}>
      {names.map((n, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: m.u, ...enter('up', m.at(0.5 + i * 0.12, 0.4), 16) }}>
          <span style={{ width: m.u * 2.4, height: m.u * 2.4, background: pal[i % pal.length], borderRadius: m.u * 0.4 }} />
          {n}
        </span>
      ))}
    </div>
  );
}

/** Line / multi-line / area chart: grid, line traces left→right, end point pulses with its value. */
export function lineChart(m: Motion): ReactElement {
  const series = m.str('data', '1950:36, 1970:55, 1990:87, 2010:123, 2025:146').split(/\s*;\s*\n?|\n/).filter(Boolean);
  const parsed = series.map((s) => parseData(s.replace(/;/g, ',')));
  const all = parsed.flat().map((d) => d.values[0]);
  const max = Math.max(...all) * 1.08 || 1;
  const min = m.bool('zeroBase', true) ? 0 : Math.min(...all) * 0.92;
  const b = chartBox(m);
  const pal = colours(m);
  const area = m.str('mode', 'line') === 'area';
  const k = m.at(0.6, m.num('drawDur', 1.8), m.str('drawEase', 'easeInOut'));
  const parts = numberParts(m);
  return (
    <div style={{ position: 'absolute', inset: 0, ...exitStyle(m) }}>
      <ChartTitle m={m} />
      <svg width={m.w} height={m.h} style={{ position: 'absolute', inset: 0 }}>
        {[0.25, 0.5, 0.75, 1].map((g, i) => (
          <Draw key={i} d={`M${b.x0} ${lerp(b.y1, b.y0, g)} L${b.x1} ${lerp(b.y1, b.y0, g)}`} k={m.at(0.2 + i * 0.05, 0.5)} stroke={m.color} width={1} opacity={0.15} />
        ))}
        <Draw d={`M${b.x0} ${b.y1} L${b.x1} ${b.y1}`} k={m.at(0.2, 0.5)} stroke={m.color} width={3} />
        {parsed.map((pts, si) => {
          const xy = pts.map((p, i) => [lerp(b.x0, b.x1, pts.length > 1 ? i / (pts.length - 1) : 0.5), lerp(b.y1, b.y0, (p.values[0] - min) / (max - min))] as [number, number]);
          const d = `M${xy.map((p) => p.join(' ')).join(' L')}`;
          const col = pal[si % pal.length];
          const kk = clamp01(k - si * 0.08);
          const reach = kk * (xy.length - 1);
          const last = Math.min(xy.length - 1, Math.floor(reach));
          const fr = reach - last;
          const head = last < xy.length - 1 ? [lerp(xy[last][0], xy[last + 1][0], fr), lerp(xy[last][1], xy[last + 1][1], fr)] : xy[last];
          const val = last < pts.length - 1 ? lerp(pts[last].values[0], pts[last + 1].values[0], fr) : pts[last].values[0];
          const pulse = 1 + Math.sin(m.t * 6) * 0.25;
          return (
            <g key={si}>
              {area && kk > 0 && <path d={`${d} L${b.x1} ${b.y1} L${b.x0} ${b.y1} Z`} fill={col} opacity={0.22} style={{ clipPath: `inset(0 ${(1 - kk) * 100}% 0 0)` }} />}
              <Draw d={d} k={kk} stroke={col} width={m.u * 0.9} />
              {pts.map((p, i) => (
                <g key={i} opacity={reach >= i ? 1 : 0}>
                  <circle cx={xy[i][0]} cy={xy[i][1]} r={m.u * 0.9} fill={col} />
                  {si === 0 && <text x={xy[i][0]} y={b.y1 + m.u * 4.5} textAnchor="middle" fontFamily={m.font} fontSize={m.u * 3} fill={m.color} opacity={0.8}>{p.label}</text>}
                </g>
              ))}
              {kk > 0 && (
                <g>
                  <circle cx={head[0]} cy={head[1]} r={m.u * 1.6 * pulse} fill={col} opacity={0.35} />
                  <circle cx={head[0]} cy={head[1]} r={m.u * 1.1} fill={col} />
                  <text x={head[0]} y={head[1] - m.u * 3} textAnchor="middle" fontFamily={m.font} fontWeight={800} fontSize={m.u * 4} fill={m.color}>{formatNumber(val, parts)}</text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
      {m.str('legend') && <Legend m={m} names={m.str('legend').split(/\s*,\s*/)} />}
    </div>
  );
}

/** Pie / donut: segments sweep round in order, labels pop, centre total. */
export function pie(m: Motion): ReactElement {
  const rows = parseData(m.str('data', 'Rent:40, Food:25, Travel:15, Savings:20'));
  const total = rows.reduce((a, r) => a + r.values[0], 0) || 1;
  const donut = m.str('mode', 'donut') === 'donut';
  const cx = m.w / 2;
  const cy = m.h * (m.portrait ? 0.47 : 0.52);
  const R = Math.min(m.w, m.h) * (m.portrait ? 0.27 : 0.3);
  const r0 = donut ? R * 0.58 : 0;
  const pal = colours(m);
  const k = m.at(0.4, m.num('sweepDur', 1.4), 'easeInOut');
  const hi = m.str('highlight', '').toLowerCase();
  let a0 = -Math.PI / 2;
  const arc = (a: number, b: number, rr0: number, rr1: number) => {
    const large = b - a > Math.PI ? 1 : 0;
    const p = (r: number, ang: number) => `${cx + Math.cos(ang) * r} ${cy + Math.sin(ang) * r}`;
    return rr0 > 0 ? `M${p(rr1, a)} A${rr1} ${rr1} 0 ${large} 1 ${p(rr1, b)} L${p(rr0, b)} A${rr0} ${rr0} 0 ${large} 0 ${p(rr0, a)} Z` : `M${cx} ${cy} L${p(rr1, a)} A${rr1} ${rr1} 0 ${large} 1 ${p(rr1, b)} Z`;
  };
  const sweep = k * Math.PI * 2;
  return (
    <div style={{ position: 'absolute', inset: 0, ...exitStyle(m) }}>
      <ChartTitle m={m} />
      <svg width={m.w} height={m.h} style={{ position: 'absolute', inset: 0 }}>
        {rows.map((r, i) => {
          const frac = r.values[0] / total;
          const s = a0;
          const e = a0 + frac * Math.PI * 2;
          a0 = e;
          const visEnd = Math.min(e, -Math.PI / 2 + sweep);
          if (visEnd <= s) return null;
          const isHi = hi && r.label.toLowerCase().includes(hi);
          const pop = isHi ? m.at(0.4 + 1.6, 0.4, 'back') * R * 0.08 : 0;
          const mid = (s + e) / 2;
          const dx = Math.cos(mid) * pop;
          const dy = Math.sin(mid) * pop;
          const lab = m.at(0.4 + 1.4 * ((s + Math.PI / 2) / (Math.PI * 2)) + 0.2, 0.4);
          return (
            <g key={i} transform={`translate(${dx} ${dy})`}>
              <path d={arc(s, visEnd, r0, R)} fill={isHi ? m.accent : pal[i % pal.length]} stroke={m.str('gap', 'rgba(0,0,0,.25)')} strokeWidth={2} opacity={hi && !isHi ? 0.55 : 1} />
              <text x={Math.max(m.u * 3, Math.min(m.w - m.u * 3, cx + Math.cos(mid) * R * 1.15))} y={cy + Math.sin(mid) * R * 1.25} textAnchor={Math.cos(mid) > 0.2 ? 'start' : Math.cos(mid) < -0.2 ? 'end' : 'middle'} dominantBaseline="middle" fontFamily={m.font} fontSize={m.u * 3.4} fontWeight={700} fill={m.color} opacity={lab}>
                {r.label} {Math.round(frac * 100)}%
              </text>
            </g>
          );
        })}
        {donut && (
          <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontFamily={FONTS.impact} fontSize={m.u * 9} fill={m.color} opacity={m.at(1.6, 0.5)}>
            {m.str('center', formatNumber(total, numberParts(m)))}
          </text>
        )}
      </svg>
    </div>
  );
}

/** Gauge (half dial with needle) or radial progress ring with a counting percentage. */
export function gauge(m: Motion): ReactElement {
  const v = Math.max(0, Math.min(100, m.num('value', 72)));
  const ring = m.str('mode', 'ring') === 'ring';
  const cx = m.w / 2;
  const cy = m.h * 0.5;
  const R = Math.min(m.w, m.h) * 0.28;
  const k = m.at(0.3, m.num('fillDur', 1.6), 'easeInOut');
  const cur = v * clamp01(k);
  const stroke = R * 0.18;
  if (ring) {
    const d = `M ${cx} ${cy - R} a ${R} ${R} 0 1 1 -0.01 0`;
    return (
      <Svg m={m}>
        <path d={d} fill="none" stroke={m.color} strokeOpacity={0.15} strokeWidth={stroke} />
        <Draw d={d} k={(cur / 100) * 0.9999} stroke={m.accent} width={stroke} />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontFamily={FONTS.impact} fontSize={R * 0.55} fill={m.color}>{Math.round(cur)}%</text>
        {m.str('label') && <text x={cx} y={cy + R * 1.45} textAnchor="middle" fontFamily={m.font} fontWeight={700} fontSize={m.u * 4.5} fill={m.color} opacity={m.at(0.5, 0.5)}>{m.str('label')}</text>}
      </Svg>
    );
  }
  const a = Math.PI + (cur / 100) * Math.PI;
  const arc = `M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`;
  return (
    <Svg m={m}>
      <path d={arc} fill="none" stroke={m.color} strokeOpacity={0.15} strokeWidth={stroke} />
      <Draw d={arc} k={cur / 100} stroke={cur > 66 ? '#E63946' : cur > 33 ? m.accent : '#2A9D8F'} width={stroke} cap="butt" />
      <line x1={cx} y1={cy} x2={cx + Math.cos(a) * R * 0.85} y2={cy + Math.sin(a) * R * 0.85} stroke={m.color} strokeWidth={m.u * 1.1} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={m.u * 2} fill={m.color} />
      <text x={cx} y={cy + R * 0.42} textAnchor="middle" fontFamily={FONTS.impact} fontSize={R * 0.35} fill={m.color}>{Math.round(cur)}{m.str('suffix', '%')}</text>
      {m.str('label') && <text x={cx} y={cy + R * 0.75} textAnchor="middle" fontFamily={m.font} fontWeight={700} fontSize={m.u * 4} fill={m.color} opacity={m.at(0.5, 0.5)}>{m.str('label')}</text>}
    </Svg>
  );
}

/** Pictogram: a grid of people/icons, N of them fill in one by one ("3 in 10 people…"). */
export function pictogram(m: Motion): ReactElement {
  const total = Math.max(1, Math.min(100, Math.round(m.num('total', 10))));
  const filled = Math.max(0, Math.min(total, Math.round(m.num('value', 3))));
  const cols = Math.min(total, Math.round(m.num('cols', total <= 10 ? total : 10)));
  const rowsN = Math.ceil(total / cols);
  const cell = Math.min((m.w * 0.84) / cols, (m.h * 0.42) / rowsN);
  const x0 = (m.w - cols * cell) / 2;
  const y0 = m.h * 0.5 - (rowsN * cell) / 2;
  const icon = m.str('icon', 'person');
  return (
    <div style={{ position: 'absolute', inset: 0, ...exitStyle(m) }}>
      <ChartTitle m={m} />
      <svg width={m.w} height={m.h} style={{ position: 'absolute', inset: 0 }}>
        {Array.from({ length: total }, (_, i) => {
          const cx = x0 + (i % cols) * cell + cell / 2;
          const cy = y0 + Math.floor(i / cols) * cell + cell / 2;
          const kIn = m.at(0.2 + i * 0.02, 0.3, 'back');
          const on = i < filled ? m.at(0.8 + i * m.num('stagger', 0.12), 0.3) : 0;
          const col = on > 0.5 ? m.accent : m.color;
          const op = on > 0.5 ? 1 : 0.28;
          const s = cell * 0.38 * clamp01(kIn) * (1 + (on > 0 && on < 1 ? Math.sin(on * Math.PI) * 0.25 : 0));
          return icon === 'person' ? (
            <g key={i} opacity={op} fill={col}>
              <circle cx={cx} cy={cy - s * 0.75} r={s * 0.38} />
              <path d={`M${cx - s * 0.62} ${cy + s * 0.95} Q${cx - s * 0.62} ${cy - s * 0.25} ${cx} ${cy - s * 0.25} Q${cx + s * 0.62} ${cy - s * 0.25} ${cx + s * 0.62} ${cy + s * 0.95} Z`} />
            </g>
          ) : (
            <circle key={i} cx={cx} cy={cy} r={s * 0.75} fill={col} opacity={op} />
          );
        })}
      </svg>
      <div style={{ position: 'absolute', left: 0, right: 0, top: y0 + rowsN * cell + m.u * 3, textAlign: 'center', fontFamily: m.font, fontWeight: 800, fontSize: m.u * 6, color: m.color, ...enter('up', m.at(0.8 + filled * 0.12, 0.5), 20) }}>
        <span style={{ color: m.accent }}>{filled}</span> {m.str('text', `in ${total}`)}
      </div>
    </div>
  );
}

/** Before/after (or A vs B) comparison: two columns, values count, bars grow, difference highlighted. */
export function compare(m: Motion): ReactElement {
  const a = m.num('valueA', 12);
  const bv = m.num('valueB', 48);
  const max = Math.max(a, bv) || 1;
  const parts = numberParts(m);
  const k1 = m.at(0.4, 1.0);
  const k2 = m.at(1.0, 1.0);
  const kd = m.at(2.1, 0.5, 'back');
  const col = (v: number, k: number, label: string, c: string, delay: number) => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: m.u * 2, ...enter('up', m.at(delay, 0.5), 40) }}>
      <div style={{ fontFamily: FONTS.impact, fontSize: Math.min(m.u * 11, ((m.w - m.u * 18) / 2) / (formatNumber(v, parts).length * 0.52)), color: c, whiteSpace: 'nowrap' }}>{formatNumber(v * clamp01(k), parts)}</div>
      <div style={{ width: m.u * 16, height: m.h * 0.28, display: 'flex', alignItems: 'flex-end', background: 'rgba(255,255,255,.08)', borderRadius: m.u }}>
        <div style={{ width: '100%', height: `${(v / max) * 100 * clamp01(k)}%`, background: c, borderRadius: m.u }} />
      </div>
      <div style={{ fontFamily: m.font, fontWeight: 800, fontSize: m.u * 4.2, color: m.color, textAlign: 'center' }}>{label}</div>
    </div>
  );
  const diff = bv - a;
  const pct = a ? Math.round((diff / a) * 100) : 0;
  return (
    <div style={{ position: 'absolute', inset: 0, ...exitStyle(m) }}>
      <ChartTitle m={m} />
      <div style={{ position: 'absolute', left: m.u * 6, right: m.u * 6, top: m.h * 0.3, display: 'flex', gap: m.u * 6 }}>
        {col(a, k1, m.str('labelA', 'Before'), m.str('colorA', '#8D99AE'), 0.2)}
        {col(bv, k2, m.str('labelB', 'After'), m.accent, 0.7)}
      </div>
      {m.bool('showDiff', true) && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: m.h * 0.2, textAlign: 'center' }}>
          <span style={{ display: 'inline-block', background: diff >= 0 ? '#2A9D8F' : '#E63946', color: '#fff', fontFamily: m.font, fontWeight: 900, fontSize: m.u * 4.5, padding: `${m.u}px ${m.u * 3}px`, borderRadius: m.u * 5, transform: `scale(${kd})`, opacity: clamp01(kd) }}>
            {diff >= 0 ? '▲' : '▼'} {m.str('diffText', `${Math.abs(pct)}%`)}
          </span>
        </div>
      )}
    </div>
  );
}

/** Ranking / top-N list: rows enter, scores count, the winner gets the accent and a glow. */
export function ranking(m: Motion): ReactElement {
  const rows = parseData(m.str('data', 'Mumbai:92, Delhi:88, Bengaluru:85, Pune:79, Chennai:76')).slice(0, 10);
  const countdown = m.str('order', 'top') === 'countdown';
  const list = countdown ? [...rows].reverse() : rows;
  const rowH = Math.min(m.u * 12, (m.h * 0.55) / list.length);
  const parts = numberParts(m);
  return (
    <div style={{ position: 'absolute', inset: 0, ...exitStyle(m) }}>
      <ChartTitle m={m} />
      <div style={{ position: 'absolute', left: m.u * 7, right: m.u * 7, top: m.h * (m.portrait ? 0.28 : 0.2) }}>
        {list.map((r, i) => {
          const rank = countdown ? list.length - i : i + 1;
          const k = m.at(0.3 + i * m.num('stagger', 0.35), 0.5);
          const win = rank === 1;
          return (
            <div key={i} style={{ height: rowH, display: 'flex', alignItems: 'center', gap: m.u * 3, marginBottom: m.u, padding: `0 ${m.u * 3}px`, borderRadius: m.u * 1.4, background: win ? m.accent : 'rgba(255,255,255,.08)', color: win ? m.ink : m.color, boxShadow: win ? `0 0 ${m.u * 6}px ${m.accent}66` : undefined, ...enter('left', k, 60) }}>
              <span style={{ fontFamily: FONTS.impact, fontSize: rowH * 0.6, width: rowH * 0.9 }}>{rank}</span>
              <span style={{ flex: 1, fontFamily: m.font, fontWeight: 800, fontSize: rowH * 0.38 }}>{r.label}</span>
              <span style={{ fontFamily: m.font, fontWeight: 900, fontSize: rowH * 0.42 }}>{formatNumber(r.values[0] * clamp01(k), parts)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Funnel (or pyramid): stages narrow down; each stage label + value. */
export function funnel(m: Motion): ReactElement {
  const rows = parseData(m.str('data', 'Visitors:10000, Sign-ups:3200, Trials:900, Customers:240'));
  const pyramid = m.str('mode', 'funnel') === 'pyramid';
  const n = rows.length;
  const top = m.h * 0.26;
  const H = m.h * 0.5;
  const sh = H / n;
  const W = m.w * 0.8;
  const pal = colours(m);
  const parts = numberParts(m);
  return (
    <div style={{ position: 'absolute', inset: 0, ...exitStyle(m) }}>
      <ChartTitle m={m} />
      <svg width={m.w} height={m.h} style={{ position: 'absolute', inset: 0 }}>
        {rows.map((r, i) => {
          const w0 = pyramid ? W * (i / n) : W * (1 - i / n) + W * 0.1;
          const w1 = pyramid ? W * ((i + 1) / n) : W * (1 - (i + 1) / n) + W * 0.1;
          const y = top + i * sh;
          const k = m.at(0.3 + i * 0.3, 0.5, 'back');
          const cx = m.w / 2;
          return (
            <g key={i} opacity={clamp01(k)} transform={`translate(0 ${(1 - clamp01(k)) * 30})`}>
              <path d={`M${cx - w0 / 2} ${y} L${cx + w0 / 2} ${y} L${cx + w1 / 2} ${y + sh * 0.92} L${cx - w1 / 2} ${y + sh * 0.92} Z`} fill={pal[i % pal.length]} />
              <text x={cx} y={y + sh * 0.42} textAnchor="middle" fontFamily={m.font} fontWeight={800} fontSize={m.u * 3.6} fill="#fff">{r.label}</text>
              <text x={cx} y={y + sh * 0.72} textAnchor="middle" fontFamily={m.font} fontWeight={700} fontSize={m.u * 3} fill="#fff" opacity={0.9}>{formatNumber(r.values[0], parts)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Bubble chart / scatter: circles sized by value pop in at random-but-stable positions with labels. */
export function bubbles(m: Motion): ReactElement {
  const rows = parseData(m.str('data', 'India:142, China:141, USA:34, Indonesia:28, Pakistan:24, Nigeria:23'));
  const max = Math.max(...rows.map((r) => r.values[0])) || 1;
  const pal = colours(m);
  // simple circle packing: place largest first along a spiral, avoiding overlaps
  const placed: { x: number; y: number; r: number }[] = [];
  const order = rows.map((r, i) => ({ r, i })).sort((a, b) => b.r.values[0] - a.r.values[0]);
  const Rmax = Math.min(m.w, m.h) * 0.18;
  for (const { r } of order) {
    const rad = Math.sqrt(r.values[0] / max) * Rmax;
    let a = 0;
    let d = 0;
    let x = m.w / 2;
    let y = m.h * 0.52;
    while (placed.some((p) => Math.hypot(p.x - x, p.y - y) < p.r + rad + m.u)) {
      a += 0.5;
      d += m.u * 0.6;
      x = m.w / 2 + Math.cos(a) * d;
      y = m.h * 0.52 + Math.sin(a) * d * 0.9;
    }
    placed.push({ x, y, r: rad });
  }
  {
    const minX = Math.min(...placed.map((p) => p.x - p.r));
    const maxX = Math.max(...placed.map((p) => p.x + p.r));
    const minY = Math.min(...placed.map((p) => p.y - p.r));
    const maxY = Math.max(...placed.map((p) => p.y + p.r));
    const k = Math.min(1, (m.w * 0.9) / (maxX - minX), (m.h * 0.62) / (maxY - minY));
    const cx0 = (minX + maxX) / 2;
    const cy0 = (minY + maxY) / 2;
    for (const p of placed) {
      p.x = m.w / 2 + (p.x - cx0) * k;
      p.y = m.h * 0.54 + (p.y - cy0) * k;
      p.r *= k;
    }
  }
  return (
    <div style={{ position: 'absolute', inset: 0, ...exitStyle(m) }}>
      <ChartTitle m={m} />
      <svg width={m.w} height={m.h} style={{ position: 'absolute', inset: 0 }}>
        {order.map(({ r, i }, j) => {
          const p = placed[j];
          const k = m.at(0.3 + j * 0.15, 0.6, 'back');
          return (
            <g key={i} transform={`translate(${p.x} ${p.y}) scale(${Math.max(0, k)})`}>
              <circle r={p.r} fill={pal[i % pal.length]} opacity={0.9} />
              <text textAnchor="middle" dominantBaseline="middle" fontFamily={m.font} fontWeight={800} fontSize={Math.max(m.u * 2.2, p.r * 0.32)} fill="#fff">{r.label}</text>
              <text y={p.r * 0.38} textAnchor="middle" dominantBaseline="middle" fontFamily={m.font} fontWeight={600} fontSize={Math.max(m.u * 1.8, p.r * 0.22)} fill="#fff" opacity={0.9}>{formatNumber(r.values[0], numberParts(m))}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Heatmap grid: cells fill in a diagonal wave, colour scaled by value. "Row:1|2|3, …". */
export function heatmap(m: Motion): ReactElement {
  const rows = parseData(m.str('data', 'Mon:2|5|9|4, Tue:3|7|8|6, Wed:1|4|9|9, Thu:5|6|7|3'));
  const cols = Math.max(...rows.map((r) => r.values.length));
  const max = Math.max(...rows.flatMap((r) => r.values)) || 1;
  const b = chartBox(m);
  const cw = (b.x1 - b.x0) / cols;
  const ch = Math.min((b.y1 - b.y0) / rows.length, cw);
  const hot = m.accent;
  return (
    <div style={{ position: 'absolute', inset: 0, ...exitStyle(m) }}>
      <ChartTitle m={m} />
      <svg width={m.w} height={m.h} style={{ position: 'absolute', inset: 0 }}>
        {rows.map((r, i) => (
          <g key={i}>
            <text x={b.x0 - m.u} y={b.y0 + i * ch + ch / 2} textAnchor="end" dominantBaseline="middle" fontFamily={m.font} fontSize={m.u * 3} fill={m.color}>{r.label}</text>
            {r.values.map((v, j) => {
              const k = m.at(0.3 + (i + j) * 0.08, 0.4);
              return <rect key={j} x={b.x0 + j * cw + 2} y={b.y0 + i * ch + 2} width={cw - 4} height={ch - 4} rx={m.u * 0.6} fill={hot} opacity={clamp01(k) * (0.12 + 0.88 * (v / max))} />;
            })}
          </g>
        ))}
      </svg>
    </div>
  );
}

/** Waterfall: running total with rises (green) and falls (red), connectors between steps. */
export function waterfall(m: Motion): ReactElement {
  const rows = parseData(m.str('data', 'Revenue:100, Costs:-45, Tax:-12, Other:8, Profit:51'));
  let run = 0;
  const steps = rows.map((r, i) => {
    const last = i === rows.length - 1 && /profit|total|net/i.test(r.label);
    const v = r.values[0];
    const s = last ? 0 : run;
    const e = last ? v : run + v;
    if (!last) run += v;
    return { label: r.label, s, e, v, last };
  });
  const max = Math.max(...steps.map((s) => Math.max(s.s, s.e))) || 1;
  const b = chartBox(m);
  const slot = (b.x1 - b.x0) / steps.length;
  const y = (v: number) => lerp(b.y1, b.y0, v / max);
  return (
    <div style={{ position: 'absolute', inset: 0, ...exitStyle(m) }}>
      <ChartTitle m={m} />
      <svg width={m.w} height={m.h} style={{ position: 'absolute', inset: 0 }}>
        <Draw d={`M${b.x0} ${b.y1} L${b.x1} ${b.y1}`} k={m.at(0.2, 0.5)} stroke={m.color} width={3} />
        {steps.map((s, i) => {
          const k = clamp01(m.at(0.5 + i * 0.35, 0.5));
          const top = Math.min(y(s.s), y(lerp(s.s, s.e, k)));
          const hgt = Math.abs(y(s.s) - y(lerp(s.s, s.e, k)));
          const col = s.last ? m.accent : s.v >= 0 ? '#2A9D8F' : '#E63946';
          const x = b.x0 + i * slot + slot * 0.18;
          return (
            <g key={i}>
              <rect x={x} y={top} width={slot * 0.64} height={hgt} fill={col} rx={m.u * 0.4} />
              {i < steps.length - 1 && k >= 1 && <line x1={x + slot * 0.64} y1={y(s.e)} x2={x + slot} y2={y(s.e)} stroke={m.color} strokeDasharray="6 6" opacity={0.5} />}
              <text x={x + slot * 0.32} y={b.y1 + m.u * 4} textAnchor="middle" fontFamily={m.font} fontSize={m.u * 2.8} fill={m.color}>{s.label}</text>
              <text x={x + slot * 0.32} y={top - m.u * 1.5} textAnchor="middle" fontFamily={m.font} fontWeight={800} fontSize={m.u * 3.2} fill={m.color} opacity={k}>{s.v > 0 && !s.last ? '+' : ''}{s.v}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

void Stage;
