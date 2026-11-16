/**
 * Science & technical, finance, atmosphere/particles, graphic transitions and narration-synced renderers.
 */
import type { ReactElement } from 'react';
import { Draw, enter, exitStyle, FONTS, formatNumber, Stage, Svg, clamp01, lerp, type Motion } from '../core.tsx';
import { rng } from '../../vector/geom.ts';

const C = (m: Motion): [number, number] => [(m.num('x', 50) / 100) * m.w, (m.num('y', 50) / 100) * m.h];

// ================================================================ science
export function science(m: Motion): ReactElement {
  const kind = m.str('kind', 'atom');
  const [cx, cy] = C(m);
  const S = Math.min(m.w, m.h) * (m.num('size', 34) / 100);
  const kIn = m.at(0, 0.6, 'back');
  const t = m.t;
  const col = m.accent;
  const label = m.str('label') && (
    <text x={cx} y={cy + S * 0.75} textAnchor="middle" fontFamily={m.font} fontWeight={800} fontSize={m.u * 4.5} fill={m.color} opacity={m.at(0.6, 0.4)}>
      {m.str('label')}
    </text>
  );
  const g = (children: React.ReactNode) => (
    <Svg m={m}>
      <g transform={`translate(${cx} ${cy}) scale(${Math.max(0, kIn)}) translate(${-cx} ${-cy})`}>{children}</g>
      {label}
    </Svg>
  );
  switch (kind) {
    case 'wave': {
      const pts = Array.from({ length: 120 }, (_, i) => {
        const x = lerp(m.w * 0.08, m.w * 0.92, i / 119);
        const y = cy + Math.sin(i / 8 - t * m.num('rate', 4)) * S * 0.25 * clamp01(m.at(0.2, 0.8));
        return `${x} ${y}`;
      });
      return g(<path d={`M${pts.join(' L')}`} fill="none" stroke={col} strokeWidth={m.u * 0.8} strokeLinecap="round" />);
    }
    case 'heartbeat': {
      const W = m.w * 0.84;
      const pts: string[] = [];
      for (let i = 0; i <= 200; i++) {
        const x = i / 200;
        const ph = (x * 3) % 1;
        const y = ph > 0.42 && ph < 0.46 ? -1 : ph > 0.46 && ph < 0.5 ? 0.8 : ph > 0.5 && ph < 0.53 ? -0.35 : 0;
        pts.push(`${m.w * 0.08 + x * W} ${cy + y * S * 0.4}`);
      }
      return g(<Draw d={`M${pts.join(' L')}`} k={(t * 0.5) % 1.2} stroke="#2ECC71" width={m.u * 0.7} />);
    }
    case 'gears': {
      const gear = (x: number, y: number, r: number, teeth: number, rot: number, c: string) => {
        const d = Array.from({ length: teeth * 2 }, (_, i) => {
          const a = (i / (teeth * 2)) * Math.PI * 2;
          const rr = i % 2 ? r : r * 1.18;
          return `${x + Math.cos(a) * rr} ${y + Math.sin(a) * rr}`;
        }).join(' L');
        return (
          <g transform={`rotate(${rot} ${x} ${y})`}>
            <path d={`M${d} Z`} fill={c} />
            <circle cx={x} cy={y} r={r * 0.35} fill={m.str('bgHole', '#111')} />
          </g>
        );
      };
      const r1 = S * 0.32;
      const r2 = S * 0.2;
      return g(
        <>
          {gear(cx - r1 * 0.6, cy, r1, 14, t * 40, col)}
          {gear(cx - r1 * 0.6 + r1 + r2 * 1.05, cy - r2 * 0.6, r2, 9, -t * 40 * (14 / 9) + 10, m.color)}
        </>,
      );
    }
    case 'dna': {
      const parts: ReactElement[] = [];
      const H = S * 1.6;
      for (let i = 0; i < 22; i++) {
        const y = cy - H / 2 + (i / 21) * H;
        const ph = i * 0.55 + t * 2.4;
        const x1 = cx + Math.sin(ph) * S * 0.3;
        const x2 = cx - Math.sin(ph) * S * 0.3;
        const front = Math.cos(ph) > 0;
        parts.push(
          <g key={i} opacity={clamp01(m.at(i * 0.04, 0.3))}>
            <line x1={x1} y1={y} x2={x2} y2={y} stroke={m.color} strokeOpacity={0.4} strokeWidth={m.u * 0.35} />
            <circle cx={x1} cy={y} r={m.u * (front ? 1.3 : 0.9)} fill={col} />
            <circle cx={x2} cy={y} r={m.u * (front ? 0.9 : 1.3)} fill="#2A6FDB" />
          </g>,
        );
      }
      return g(parts);
    }
    case 'solar': {
      const planets = [0.18, 0.28, 0.38, 0.5, 0.64];
      const cols = ['#B0A99F', '#E9C46A', '#2A6FDB', '#E76F51', '#F4A261'];
      return g(
        <>
          <circle cx={cx} cy={cy} r={S * 0.1} fill="#FFD166" />
          <circle cx={cx} cy={cy} r={S * 0.16} fill="#FFD166" opacity={0.25} />
          {planets.map((r, i) => {
            const a = t * (0.9 / (i + 1)) * Math.PI + i;
            return (
              <g key={i}>
                <circle cx={cx} cy={cy} r={S * r} fill="none" stroke={m.color} strokeOpacity={0.18} />
                <circle cx={cx + Math.cos(a) * S * r} cy={cy + Math.sin(a) * S * r} r={m.u * (1 + i * 0.35)} fill={cols[i]} />
              </g>
            );
          })}
        </>,
      );
    }
    case 'circuit': {
      const r = rng(4);
      const paths = Array.from({ length: 6 }, (_, i) => {
        let x = m.w * 0.1;
        let y = m.h * (0.3 + i * 0.08);
        let d = `M${x} ${y}`;
        for (let s = 0; s < 5; s++) {
          x += m.w * r.range(0.08, 0.18);
          d += ` L${x} ${y}`;
          y += m.u * r.range(-8, 8);
          d += ` L${x} ${y}`;
        }
        return d;
      });
      return (
        <Svg m={m}>
          {paths.map((d, i) => (
            <g key={i}>
              <path d={d} fill="none" stroke={m.color} strokeOpacity={0.2} strokeWidth={m.u * 0.5} />
              <Draw d={d} k={(t * 0.45 + i * 0.17) % 1.3} stroke={col} width={m.u * 0.6} />
            </g>
          ))}
          {label}
        </Svg>
      );
    }
    case 'molecule': {
      const atoms: [number, number, string][] = [[0, 0, '#E63946'], [-0.35, 0.22, '#FFFFFF'], [0.35, 0.22, '#FFFFFF']];
      const rot = t * 25;
      return g(
        <g transform={`rotate(${rot} ${cx} ${cy})`}>
          {atoms.slice(1).map(([x, y], i) => <line key={i} x1={cx} y1={cy} x2={cx + x * S} y2={cy + y * S} stroke={m.color} strokeWidth={m.u * 1.2} />)}
          {atoms.map(([x, y, c], i) => <circle key={i} cx={cx + x * S} cy={cy + y * S} r={S * (i ? 0.11 : 0.16)} fill={c} stroke="#111" strokeWidth={2} />)}
        </g>,
      );
    }
    default: {
      // atom: nucleus + 3 elliptical orbits with electrons
      return g(
        <>
          {[0, 60, 120].map((rot, i) => {
            const a = t * (2.2 + i * 0.4) + i;
            const ex = Math.cos(a) * S * 0.48;
            const ey = Math.sin(a) * S * 0.17;
            const rr = (rot * Math.PI) / 180;
            return (
              <g key={i}>
                <ellipse cx={cx} cy={cy} rx={S * 0.48} ry={S * 0.17} fill="none" stroke={m.color} strokeOpacity={0.45} strokeWidth={m.u * 0.35} transform={`rotate(${rot} ${cx} ${cy})`} />
                <circle cx={cx + ex * Math.cos(rr) - ey * Math.sin(rr)} cy={cy + ex * Math.sin(rr) + ey * Math.cos(rr)} r={m.u * 1.4} fill={col} />
              </g>
            );
          })}
          <circle cx={cx} cy={cy} r={S * 0.09} fill="#E63946" />
        </>,
      );
    }
  }
}

// ================================================================ finance
/** Coin stacks growing to values ("2019:3, 2022:7, 2025:12"), or a single growing stack. */
export function coins(m: Motion): ReactElement {
  const rows = (m.str('data', 'Year 1:3, Year 2:6, Year 3:11').split(/\s*,\s*/).map((s) => s.split(':')).map(([l, v]) => ({ l, v: Number(v) || 1 })));
  const max = Math.max(...rows.map((r) => r.v));
  const n = rows.length;
  const cw = m.u * 14;
  const ch = m.u * 3;
  const base = m.h * 0.75;
  return (
    <Svg m={m}>
      {rows.map((r, i) => {
        const x = m.w * ((i + 1) / (n + 1));
        const count = Math.max(1, Math.round((r.v / max) * 14));
        const shown = Math.floor(count * clamp01(m.at(0.3 + i * 0.4, 1.0, 'easeOut')));
        return (
          <g key={i}>
            {Array.from({ length: shown }, (_, c) => (
              <g key={c}>
                <ellipse cx={x} cy={base - c * ch * 0.8} rx={cw / 2} ry={ch / 2} fill="#C9A227" stroke="#8A6D1A" strokeWidth={2} />
                <ellipse cx={x} cy={base - c * ch * 0.8 - ch * 0.15} rx={cw / 2} ry={ch / 2.2} fill="#F2C94C" />
              </g>
            ))}
            <text x={x} y={base + m.u * 6} textAnchor="middle" fontFamily={m.font} fontWeight={700} fontSize={m.u * 3.4} fill={m.color}>{r.l}</text>
          </g>
        );
      })}
    </Svg>
  );
}

/** Currency conversion card: amount in one currency counts, arrow, converted amount counts. */
export function currency(m: Motion): ReactElement {
  const amt = m.num('value', 100);
  const rate = m.num('rate', 84.5);
  const from = m.str('from', '$');
  const to = m.str('to', '₹');
  const k1 = m.at(0.2, 0.9, 'expo');
  const k2 = m.at(1.2, 1.1, 'expo');
  const big = m.u * 10;
  return (
    <Stage m={m}>
      <div style={{ fontFamily: FONTS.impact, fontSize: big, color: m.color, ...enter('up', m.at(0, 0.4), 30) }}>{formatNumber(amt * clamp01(k1), { prefix: from, decimals: 0 })}</div>
      <div style={{ fontFamily: FONTS.sans, fontSize: m.u * 7, color: m.accent, opacity: m.at(0.9, 0.3), transform: `translateY(${(1 - m.at(0.9, 0.3)) * -20}px)` }}>↓</div>
      <div style={{ fontFamily: FONTS.impact, fontSize: big * 1.15, color: m.accent, ...enter('up', m.at(1.1, 0.4), 30) }}>{formatNumber(amt * rate * clamp01(k2), { prefix: to, grouping: to === '₹' ? 'indian' : 'intl' })}</div>
      <div style={{ fontFamily: m.font, fontSize: m.u * 3, color: m.color, opacity: 0.7 * m.at(1.8, 0.5) }}>{m.str('note', `at ${from}1 = ${to}${rate}`)}</div>
    </Stage>
  );
}

/** Money flow: coins / notes travel along a curve from A to B, labels at both ends, total counts. */
export function moneyFlow(m: Motion): ReactElement {
  const a: [number, number] = [m.w * 0.15, m.h * 0.6];
  const b: [number, number] = [m.w * 0.85, m.h * 0.4];
  const c: [number, number] = [m.w * 0.5, m.h * 0.2];
  const q = (t: number): [number, number] => [(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]];
  const n = 12;
  return (
    <div style={{ position: 'absolute', inset: 0, ...exitStyle(m) }}>
      <svg width={m.w} height={m.h} style={{ position: 'absolute', inset: 0 }}>
        <Draw d={`M${a[0]} ${a[1]} Q${c[0]} ${c[1]} ${b[0]} ${b[1]}`} k={m.at(0.2, 0.7)} stroke={m.color} width={m.u * 0.3} dash={`${m.u} ${m.u}`} opacity={0.5} />
        {Array.from({ length: n }, (_, i) => {
          const t = (m.t * 0.5 - i / n) % 1;
          if (t < 0 || m.t < 0.8) return null;
          const p = q(t);
          return <text key={i} x={p[0]} y={p[1]} textAnchor="middle" dominantBaseline="central" fontSize={m.u * 5}>{m.str('icon', '💰')}</text>;
        })}
      </svg>
      {[['from', a, 'Government'], ['to', b, 'States']].map(([k, p, d]) => (
        <div key={k as string} style={{ position: 'absolute', left: (p as number[])[0], top: (p as number[])[1] + m.u * 5, transform: 'translateX(-50%)', background: '#fff', color: '#111', borderRadius: m.u * 1.4, padding: `${m.u}px ${m.u * 2.4}px`, fontFamily: m.font, fontWeight: 800, fontSize: m.u * 3.6, ...enter('up', m.at(0.1, 0.4), 20) }}>{m.str(k as string, d as string)}</div>
      ))}
      {m.num('value', 0) > 0 && <div style={{ position: 'absolute', left: 0, right: 0, top: m.h * 0.72, textAlign: 'center', fontFamily: FONTS.impact, fontSize: m.u * 10, color: m.accent }}>{formatNumber(m.num('value', 0) * clamp01(m.at(0.8, 2, 'expo')), { prefix: m.str('prefix', '₹'), suffix: m.str('suffix', ' cr'), grouping: 'indian' })}</div>}
    </div>
  );
}

// ================================================================ atmosphere
export function particles(m: Motion): ReactElement {
  const kind = m.str('kind', 'dust');
  const n = Math.round(m.num('count', kind === 'rain' ? 140 : kind === 'confetti' ? 90 : 60));
  const r = rng(m.num('seed', 11));
  const pal = m.str('colors', '#F9D84A,#E63946,#2A6FDB,#2A9D8F,#FFFFFF').split(/\s*,\s*/);
  const kIn = m.at(0, 0.6);
  return (
    <Svg m={m} style={{ opacity: kIn }}>
      {Array.from({ length: n }, (_, i) => {
        const x0 = r() * m.w;
        const y0 = r() * m.h;
        const sp = r.range(0.4, 1.4);
        const ph = r() * 10;
        const s = r.range(0.3, 1);
        switch (kind) {
          case 'rain': {
            const y = (y0 + m.t * m.h * 1.6 * sp) % (m.h * 1.1) - m.h * 0.05;
            return <line key={i} x1={x0} y1={y} x2={x0 - m.u * 0.6} y2={y + m.u * 4 * sp} stroke="#CFE3F7" strokeWidth={1.5} opacity={0.5} />;
          }
          case 'snow': {
            const y = (y0 + m.t * m.h * 0.12 * sp) % m.h;
            return <circle key={i} cx={x0 + Math.sin(m.t + ph) * m.u * 2} cy={y} r={m.u * 0.5 * s + 1} fill="#fff" opacity={0.85} />;
          }
          case 'confetti': {
            const y = (y0 - m.h + m.t * m.h * 0.45 * sp) % (m.h * 1.2);
            const rot = m.t * 200 * sp + ph * 40;
            return <rect key={i} x={x0 + Math.sin(m.t * 2 + ph) * m.u * 3} y={y} width={m.u * 1.2} height={m.u * 0.6} fill={pal[i % pal.length]} transform={`rotate(${rot} ${x0} ${y})`} />;
          }
          case 'sparks':
          case 'embers': {
            const life = (m.t * sp * 0.6 + ph) % 1;
            const y = m.h * (0.95 - life * 0.8);
            return <circle key={i} cx={x0 + Math.sin(life * 6 + ph) * m.u * 3} cy={y} r={m.u * 0.35 * (1 - life) + 0.8} fill={kind === 'sparks' ? '#FFE8A3' : '#FF8C42'} opacity={1 - life} />;
          }
          case 'bokeh': {
            const y = y0 + Math.sin(m.t * 0.3 * sp + ph) * m.u * 4;
            return <circle key={i} cx={x0} cy={y} r={m.u * 3 * s + m.u} fill={pal[i % pal.length]} opacity={0.12 + 0.12 * Math.sin(m.t + ph)} />;
          }
          case 'stars': {
            const tw = 0.4 + 0.6 * Math.abs(Math.sin(m.t * 2 * sp + ph));
            return <circle key={i} cx={x0} cy={y0 * 0.7} r={m.u * 0.25 * s + 0.6} fill="#fff" opacity={tw} />;
          }
          case 'fireflies': {
            const x = x0 + Math.sin(m.t * 0.6 * sp + ph) * m.u * 6;
            const y = y0 + Math.cos(m.t * 0.5 * sp + ph) * m.u * 4;
            const glow = 0.4 + 0.6 * Math.abs(Math.sin(m.t * 1.6 + ph));
            return (
              <g key={i} opacity={glow}>
                <circle cx={x} cy={y} r={m.u * 1.6} fill="#FFF3A0" opacity={0.25} />
                <circle cx={x} cy={y} r={m.u * 0.45} fill="#FFFBD0" />
              </g>
            );
          }
          default: {
            // dust motes drifting in light
            const x = (x0 + m.t * m.u * 2 * sp) % m.w;
            const y = y0 + Math.sin(m.t * 0.7 + ph) * m.u * 2;
            return <circle key={i} cx={x} cy={y} r={m.u * 0.25 * s + 0.6} fill="#FFFFFF" opacity={0.25 + 0.25 * Math.sin(m.t * 1.3 + ph)} />;
          }
        }
      })}
    </Svg>
  );
}

/** Light & film looks: light sweep, rays, grain, vignette, light leak, film burn, vhs, glitch, spotlight, fog, gradient, pattern. */
export function look(m: Motion): ReactElement {
  const kind = m.str('kind', 'lightSweep');
  const k = m.at(0, 0.5);
  const t = m.t;
  const ex = exitStyle(m);
  const base = { position: 'absolute' as const, inset: 0, pointerEvents: 'none' as const, ...ex };
  switch (kind) {
    case 'lightSweep': {
      const p = ((t * m.num('rate', 0.6)) % 1.4) - 0.2;
      return <div style={{ ...base, background: `linear-gradient(105deg, transparent ${p * 100 - 12}%, rgba(255,255,255,.35) ${p * 100}%, transparent ${p * 100 + 12}%)`, mixBlendMode: 'screen' }} />;
    }
    case 'rays':
      return (
        <svg width={m.w} height={m.h} style={{ ...base, opacity: 0.35 * k, mixBlendMode: 'screen' }}>
          {Array.from({ length: 16 }, (_, i) => {
            const a = (i / 16) * Math.PI * 2 + t * 0.15;
            const cx = (m.num('x', 50) / 100) * m.w;
            const cy = (m.num('y', 20) / 100) * m.h;
            const L = Math.max(m.w, m.h) * 1.2;
            return <path key={i} d={`M${cx} ${cy} L${cx + Math.cos(a - 0.06) * L} ${cy + Math.sin(a - 0.06) * L} L${cx + Math.cos(a + 0.06) * L} ${cy + Math.sin(a + 0.06) * L} Z`} fill={m.str('accent', '#FFF3C4')} />;
          })}
        </svg>
      );
    case 'grain':
      return (
        <svg width={m.w} height={m.h} style={{ ...base, opacity: m.num('amount', 0.18), mixBlendMode: 'overlay' }}>
          <filter id={`gr${m.f % 4}`}>
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={m.f % 50} />
          </filter>
          <rect width={m.w} height={m.h} filter={`url(#gr${m.f % 4})`} />
        </svg>
      );
    case 'vignette':
      return <div style={{ ...base, background: `radial-gradient(ellipse at center, transparent ${55 - m.num('amount', 0.5) * 30}%, rgba(0,0,0,${0.4 + m.num('amount', 0.5) * 0.5}) 100%)`, opacity: k }} />;
    case 'lightLeak':
      return <div style={{ ...base, mixBlendMode: 'screen', opacity: 0.55 * (0.6 + 0.4 * Math.sin(t * 1.3)) * k, background: `radial-gradient(circle at ${20 + Math.sin(t * 0.7) * 15}% ${30 + Math.cos(t * 0.5) * 20}%, rgba(255,120,60,.9), transparent 45%), radial-gradient(circle at ${80 + Math.cos(t * 0.6) * 10}% 70%, rgba(255,220,120,.7), transparent 40%)` }} />;
    case 'filmBurn': {
      const p = m.at(0, m.num('burnDur', 1.2), 'easeInOut');
      const s = Math.sin(p * Math.PI);
      return <div style={{ ...base, mixBlendMode: 'screen', background: `radial-gradient(circle at 70% 40%, rgba(255,250,230,${s}), rgba(255,140,40,${s * 0.9}) 30%, rgba(180,40,0,${s * 0.6}) 55%, transparent 75%)` }} />;
    }
    case 'vhs': {
      const r = rng(Math.floor(m.f / 2));
      return (
        <div style={{ ...base }}>
          <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg, rgba(0,0,0,.18) 0 2px, transparent 2px 4px)' }} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: `${(t * 23) % 100}%`, height: m.u * 2, background: 'rgba(255,255,255,.12)', filter: 'blur(2px)' }} />
          <div style={{ position: 'absolute', left: m.u * 4, top: m.u * 4, fontFamily: FONTS.mono, fontSize: m.u * 4, color: '#fff', textShadow: '2px 0 #f00, -2px 0 #0ff' }}>{m.str('text', 'PLAY ▶')}</div>
          {r() > 0.85 && <div style={{ position: 'absolute', left: 0, right: 0, top: `${r() * 100}%`, height: m.u * 1.5, background: 'rgba(255,255,255,.35)' }} />}
        </div>
      );
    }
    case 'glitch': {
      const r = rng(Math.floor(m.f / 2));
      const on = r() > 1 - m.num('amount', 0.5);
      return (
        <div style={{ ...base }}>
          {on &&
            Array.from({ length: 5 }, (_, i) => (
              <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: `${r() * 100}%`, height: `${r() * 6 + 1}%`, background: i % 2 ? 'rgba(255,0,80,.35)' : 'rgba(0,255,255,.3)', transform: `translateX(${(r() - 0.5) * m.u * 10}px)`, mixBlendMode: 'screen' }} />
            ))}
        </div>
      );
    }
    case 'spotlight': {
      const x = m.num('x', 50) + Math.sin(t * 0.8) * m.num('wander', 0);
      const y = m.num('y', 45);
      const R = m.num('radius', 22);
      return <div style={{ ...base, background: `radial-gradient(circle at ${x}% ${y}%, transparent ${R * k}%, rgba(0,0,0,${0.75 * k}) ${R * k + 8}%)` }} />;
    }
    case 'fog':
      return (
        <svg width={m.w} height={m.h} style={{ ...base, opacity: 0.55 * k }}>
          <filter id="fogb">
            <feGaussianBlur stdDeviation={m.u * 5} />
          </filter>
          {Array.from({ length: 6 }, (_, i) => (
            <ellipse key={i} cx={((i * 0.21 + t * 0.03 * (i % 2 ? 1 : -1)) % 1.2) * m.w} cy={m.h * (0.55 + (i % 3) * 0.12)} rx={m.w * 0.35} ry={m.h * 0.08} fill="#E8EEF2" filter="url(#fogb)" />
          ))}
        </svg>
      );
    case 'gradient': {
      const a = m.str('accent', '#2A6FDB');
      const b2 = m.str('accent2', '#8E7DBE');
      return <div style={{ ...base, background: `linear-gradient(${t * 20}deg, ${a}, ${b2})`, opacity: k * m.num('opacity', 1) }} />;
    }
    case 'pattern': {
      const s = m.u * m.num('cell', 6);
      const off = (t * s * 0.5) % s;
      const p = m.str('pattern', 'dots');
      const c = m.str('accent', 'rgba(255,255,255,.12)');
      const bg = p === 'grid' ? `linear-gradient(${c} 1px, transparent 1px), linear-gradient(90deg, ${c} 1px, transparent 1px)` : p === 'stripes' ? `repeating-linear-gradient(45deg, ${c} 0 ${s * 0.2}px, transparent ${s * 0.2}px ${s * 0.5}px)` : `radial-gradient(${c} 18%, transparent 20%)`;
      return <div style={{ ...base, backgroundImage: bg, backgroundSize: p === 'stripes' ? undefined : `${s}px ${s}px`, backgroundPosition: `${off}px ${off}px`, opacity: k }} />;
    }
    case 'colorWash':
      return <div style={{ ...base, background: m.str('accent', '#2A6FDB'), mixBlendMode: 'color', opacity: m.num('amount', 0.5) * k }} />;
    case 'glow': {
      const pulse = 0.6 + 0.4 * Math.sin(t * m.num('rate', 3));
      return <div style={{ ...base, background: `radial-gradient(circle at ${m.num('x', 50)}% ${m.num('y', 50)}%, ${m.str('accent', '#FFE8A3')} 0%, transparent ${m.num('radius', 30)}%)`, opacity: pulse * k, mixBlendMode: 'screen' }} />;
    }
    default:
      return <div style={base} />;
  }
}

// ================================================================ transitions (overlay that covers, then reveals)
export function transition(m: Motion): ReactElement {
  const kind = m.str('kind', 'wipe');
  const col = m.str('accent', '#F9D84A');
  const col2 = m.str('accent2', '#1D1D1B');
  const half = m.D / 2;
  const kIn = m.at(0, half, 'easeInOut');
  const kOut = m.at(half, half, 'easeInOut');
  const cover = kOut > 0 ? 1 - kOut : kIn; // 0 → 1 (fully covered at the cut) → 0
  const dir = m.str('direction', 'left');
  const base = { position: 'absolute' as const, inset: 0 };
  switch (kind) {
    case 'dip':
      return <div style={{ ...base, background: col, opacity: cover }} />;
    case 'iris': {
      const R = Math.hypot(m.w, m.h) * 0.6;
      return (
        <svg width={m.w} height={m.h} style={base}>
          <defs>
            <mask id="irism">
              <rect width={m.w} height={m.h} fill="#fff" />
              <circle cx={m.w / 2} cy={m.h / 2} r={R * (1 - cover)} fill="#000" />
            </mask>
          </defs>
          <rect width={m.w} height={m.h} fill={col} mask="url(#irism)" />
        </svg>
      );
    }
    case 'radial': {
      const a = cover * 360;
      const r = Math.hypot(m.w, m.h);
      const cx = m.w / 2;
      const cy = m.h / 2;
      const end = ((a - 90) * Math.PI) / 180;
      const d = a >= 359.9 ? `M0 0 H${m.w} V${m.h} H0 Z` : `M${cx} ${cy} L${cx} ${cy - r} A${r} ${r} 0 ${a > 180 ? 1 : 0} 1 ${cx + Math.cos(end) * r} ${cy + Math.sin(end) * r} Z`;
      return (
        <svg width={m.w} height={m.h} style={base}>
          <path d={d} fill={col} />
        </svg>
      );
    }
    case 'shutter':
    case 'blinds': {
      const n = kind === 'shutter' ? 2 : 8;
      return (
        <div style={base}>
          {Array.from({ length: n }, (_, i) => (
            <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: `${(i * 100) / n}%`, height: `${100 / n}%`, background: i % 2 ? col : col2, transformOrigin: kind === 'shutter' ? (i ? 'bottom' : 'top') : 'top', transform: `scaleY(${cover})` }} />
          ))}
        </div>
      );
    }
    case 'split':
      return (
        <div style={base}>
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '50%', background: col, transform: `translateX(${-(1 - cover) * 100}%)` }} />
          <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: '50%', background: col, transform: `translateX(${(1 - cover) * 100}%)` }} />
        </div>
      );
    case 'grid':
    case 'pixel': {
      const cols = kind === 'pixel' ? 16 : 6;
      const rows = Math.round(cols * (m.h / m.w));
      const r = rng(5);
      const order = Array.from({ length: cols * rows }, () => r());
      return (
        <div style={base}>
          {order.map((o, i) => {
            const x = i % cols;
            const y = Math.floor(i / cols);
            const thr = kind === 'pixel' ? o : (x + y) / (cols + rows);
            const on = cover > thr * 0.98;
            return <div key={i} style={{ position: 'absolute', left: `${(x * 100) / cols}%`, top: `${(y * 100) / rows}%`, width: `${100 / cols + 0.2}%`, height: `${100 / rows + 0.2}%`, background: (x + y) % 2 ? col : col2, opacity: on ? 1 : 0, transform: kind === 'grid' ? `scale(${on ? 1 : 0})` : undefined }} />;
          })}
        </div>
      );
    }
    case 'paperTear': {
      const r = rng(8);
      const edge = Array.from({ length: 24 }, (_, i) => `${(i / 23) * 100}% ${r.range(-3, 3)}%`);
      const pos = (1 - cover) * 110;
      return <div style={{ ...base, background: m.str('paper', '#F4EFE6'), clipPath: `polygon(${edge.map((e) => e.replace(/([-\d.]+)%$/, (_, v) => `${Number(v) + pos}%`)).join(', ')}, 100% 120%, 0 120%)`, boxShadow: 'inset 0 0 40px rgba(0,0,0,.2)' }} />;
    }
    case 'lineWipe':
      return (
        <div style={base}>
          {Array.from({ length: 5 }, (_, i) => {
            const c = clamp01(cover * 1.6 - i * 0.12);
            return <div key={i} style={{ position: 'absolute', top: '-20%', bottom: '-20%', left: `${-40 + i * 25}%`, width: '35%', background: i % 2 ? col : col2, transform: `skewX(-20deg) scaleX(${c})`, transformOrigin: 'left' }} />;
          })}
        </div>
      );
    default: {
      // wipe / push
      const p = (1 - cover) * 100;
      const clip = dir === 'right' ? `inset(0 ${p}% 0 0)` : dir === 'up' ? `inset(${p}% 0 0 0)` : dir === 'down' ? `inset(0 0 ${p}% 0)` : `inset(0 0 0 ${p}%)`;
      return (
        <div style={{ ...base, background: col, clipPath: kOut > 0 ? (dir === 'right' ? `inset(0 0 0 ${100 - (1 - kOut) * 100}%)` : dir === 'up' ? `inset(0 0 ${100 - (1 - kOut) * 100}% 0)` : dir === 'down' ? `inset(${100 - (1 - kOut) * 100}% 0 0 0)` : `inset(0 ${100 - (1 - kOut) * 100}% 0 0)`) : clip }}>
          {m.str('text') && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONTS.impact, fontSize: m.u * 12, color: col2 }}>{m.str('text')}</div>}
        </div>
      );
    }
  }
}

// ================================================================ narration-synced / audio-reactive
/** Waveform (bars / line / circle) driven by a smooth pseudo-voice envelope; beat pulse; progress line; speaker tag. */
export function audioViz(m: Motion): ReactElement {
  const kind = m.str('kind', 'bars');
  const t = m.t;
  const env = (x: number) => 0.35 + 0.65 * Math.abs(Math.sin(t * 5.3 + x * 1.7) * Math.sin(t * 2.1 + x * 0.6) + 0.3 * Math.sin(t * 11 + x * 3));
  const col = m.accent;
  const [cx, cy] = C(m);
  if (kind === 'progress') {
    const p = clamp01(m.t / Math.max(0.1, m.D));
    return (
      <div style={{ position: 'absolute', left: 0, right: 0, top: `${m.num('y', 2)}%`, height: m.u * 0.8, background: 'rgba(255,255,255,.15)', ...exitStyle(m) }}>
        <div style={{ width: `${p * 100}%`, height: '100%', background: col, boxShadow: `0 0 ${m.u * 2}px ${col}` }} />
      </div>
    );
  }
  if (kind === 'beat') {
    const bpm = m.num('bpm', 100);
    const ph = (t * bpm) / 60;
    const pulse = Math.exp(-(ph % 1) * 6);
    return (
      <Svg m={m}>
        <circle cx={cx} cy={cy} r={m.u * (10 + pulse * 6)} fill={col} opacity={0.25 + pulse * 0.5} />
        <circle cx={cx} cy={cy} r={m.u * 10} fill={col} />
      </Svg>
    );
  }
  if (kind === 'speaker') {
    const talk = env(0) > 0.6;
    return (
      <div style={{ position: 'absolute', left: `${m.num('x', 6)}%`, top: `${m.num('y', 80)}%`, display: 'flex', alignItems: 'center', gap: m.u * 2, ...exitStyle(m), ...enter('left', m.at(0, 0.4), 30) }}>
        <div style={{ width: m.u * 10, height: m.u * 10, borderRadius: '50%', background: col, boxShadow: talk ? `0 0 0 ${m.u * 1.2}px ${col}55` : 'none' }} />
        <div style={{ background: 'rgba(0,0,0,.7)', color: '#fff', padding: `${m.u}px ${m.u * 2.4}px`, borderRadius: m.u, fontFamily: m.font, fontWeight: 800, fontSize: m.u * 3.6 }}>{m.str('text', 'Narrator')}</div>
      </div>
    );
  }
  const n = 32;
  if (kind === 'circle') {
    return (
      <Svg m={m}>
        {Array.from({ length: n }, (_, i) => {
          const a = (i / n) * Math.PI * 2;
          const r0 = m.u * 12;
          const r1 = r0 + m.u * 10 * env(i);
          return <line key={i} x1={cx + Math.cos(a) * r0} y1={cy + Math.sin(a) * r0} x2={cx + Math.cos(a) * r1} y2={cy + Math.sin(a) * r1} stroke={col} strokeWidth={m.u * 1.2} strokeLinecap="round" />;
        })}
      </Svg>
    );
  }
  if (kind === 'line') {
    const pts = Array.from({ length: 100 }, (_, i) => `${lerp(m.w * 0.1, m.w * 0.9, i / 99)} ${cy + Math.sin(i * 0.35 + t * 8) * m.u * 8 * env(i / 10) * Math.sin((i / 99) * Math.PI)}`);
    return (
      <Svg m={m}>
        <path d={`M${pts.join(' L')}`} fill="none" stroke={col} strokeWidth={m.u * 0.7} />
      </Svg>
    );
  }
  const W = m.w * 0.8;
  const bw = W / n;
  return (
    <Svg m={m}>
      {Array.from({ length: n }, (_, i) => {
        const h = m.u * 16 * env(i) * Math.sin(((i + 0.5) / n) * Math.PI);
        return <rect key={i} x={cx - W / 2 + i * bw + bw * 0.15} y={cy - h / 2} width={bw * 0.7} height={h} rx={bw * 0.35} fill={col} />;
      })}
    </Svg>
  );
}
