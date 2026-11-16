/**
 * Annotation & shape renderers: the editorial "red pen" layer (circles, arrows, brackets, stamps, redactions,
 * sticky notes, bubbles, numbered markers, documents, cursors) and geometric shape animations.
 * Positions are % of the frame (x, y, w, h) so they can be placed over footage.
 */
import type { ReactElement } from 'react';
import { arrowPaths, Draw, enter, exitStyle, FONTS, scribbleEllipse, scribbleLine, scribbleRect, sweep, Svg, clamp01, lerp, type Motion } from '../core.tsx';
import { rng, type Pt } from '../../vector/geom.ts';

const P = (m: Motion, xk = 'x', yk = 'y', dx = 50, dy = 50): Pt => [(m.num(xk, dx) / 100) * m.w, (m.num(yk, dy) / 100) * m.h];
const red = (m: Motion) => m.str('accent', '#E63946');

function Label({ m, x, y, k, anchor = 'start' }: { m: Motion; x: number; y: number; k: number; anchor?: 'start' | 'middle' | 'end' }) {
  const t = m.str('label');
  if (!t) return null;
  return (
    <text x={x} y={y} textAnchor={anchor} dominantBaseline="middle" fontFamily={FONTS[m.str('labelFont', 'marker')] ?? FONTS.marker} fontWeight={700} fontSize={m.num('labelSize', 4.5) * m.u} fill={red(m)} stroke="rgba(0,0,0,.35)" strokeWidth={m.u * 0.25} paintOrder="stroke" opacity={clamp01(k)}>
      {t}
    </text>
  );
}

/** Hand-drawn marks: circle, oval, rect, underline, cross, check, question, exclaim. */
export function scribble(m: Motion): ReactElement {
  const shape = m.str('shape', 'circle');
  const [cx, cy] = P(m);
  const w = (m.num('w', 30) / 100) * m.w;
  const h = (m.num('h', shape === 'circle' ? 30 * (m.w / m.h) : 14) / 100) * m.h;
  const k = m.at(m.num('drawAt', 0.1), m.num('drawDur', 0.7), 'easeInOut');
  const sw = m.num('stroke', 1) * m.u;
  const col = red(m);
  const seed = m.num('seed', 4);
  let d = '';
  let d2 = '';
  switch (shape) {
    case 'rect':
      d = scribbleRect(cx - w / 2, cy - h / 2, w, h, seed);
      break;
    case 'underline':
      d = scribbleLine([cx - w / 2, cy], [cx + w / 2, cy], seed, 0.03);
      if (m.bool('double', false)) d2 = scribbleLine([cx - w * 0.45, cy + sw * 2.2], [cx + w * 0.42, cy + sw * 2.4], seed + 1, 0.03);
      break;
    case 'cross':
      d = scribbleLine([cx - w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], seed, 0.05);
      d2 = scribbleLine([cx + w / 2, cy - h / 2], [cx - w / 2, cy + h / 2], seed + 2, 0.05);
      break;
    case 'check':
      d = `M${cx - w / 2} ${cy} L${cx - w / 8} ${cy + h / 2} L${cx + w / 2} ${cy - h / 2}`;
      break;
    case 'question':
    case 'exclaim': {
      const s = Math.min(w, h * 2);
      const txt = shape === 'question' ? '?' : '!';
      const kk = m.at(0.1, 0.5, 'back');
      return (
        <Svg m={m}>
          <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontFamily={FONTS.marker} fontWeight={900} fontSize={s} fill={col} transform={`rotate(${(1 - clamp01(kk)) * -25 + m.num('rotate', 8)} ${cx} ${cy}) scale(1)`} opacity={clamp01(kk)} style={{ transformOrigin: `${cx}px ${cy}px`, transform: `scale(${kk})` }}>
            {txt}
          </text>
        </Svg>
      );
    }
    default:
      d = scribbleEllipse(cx, cy, w / 2, h / 2, seed, m.num('turns', 1.15));
  }
  return (
    <Svg m={m}>
      <Draw d={d} k={k} stroke={col} width={sw} />
      {d2 && <Draw d={d2} k={m.at(m.num('drawAt', 0.1) + m.num('drawDur', 0.7) * 0.7, m.num('drawDur', 0.7) * 0.7, 'easeInOut')} stroke={col} width={sw} />}
      <Label m={m} x={cx + w / 2 + m.u * 2} y={cy - h / 2} k={m.at(0.6, 0.4)} />
    </Svg>
  );
}

/** Arrow from (x1,y1) to (x2,y2): straight, curved or dotted; head draws after the shaft; label at the tail. */
export function arrow(m: Motion): ReactElement {
  const a = P(m, 'x1', 'y1', 25, 70);
  const b = P(m, 'x2', 'y2', 60, 40);
  const style = m.str('style', 'curved');
  const { shaft, head } = arrowPaths(a, b, style === 'straight' ? 0 : m.num('curve', 0.25), m.u * m.num('head', 3.5));
  const k = m.at(0.1, m.num('drawDur', 0.7), 'easeInOut');
  const col = red(m);
  return (
    <Svg m={m}>
      <Draw d={shaft} k={k} stroke={col} width={m.num('stroke', 1) * m.u} dash={style === 'dotted' ? `1 ${m.u * 1.8}` : style === 'dashed' ? `${m.u * 2.4} ${m.u * 1.6}` : undefined} />
      <Draw d={head} k={m.at(0.1 + m.num('drawDur', 0.7), 0.25)} stroke={col} width={m.num('stroke', 1) * m.u} />
      <Label m={m} x={a[0]} y={a[1] + m.u * 4} k={m.at(0.05, 0.4)} anchor="middle" />
    </Svg>
  );
}

/** Leader line: dot on a point, elbow line out to a label box (also "text label attachment"). */
export function connector(m: Motion): ReactElement {
  const p = P(m, 'x', 'y', 40, 45);
  const l = P(m, 'lx', 'ly', 70, 25);
  const elbow: Pt = [lerp(p[0], l[0], 0.55), l[1]];
  const d = `M${p[0]} ${p[1]} L${elbow[0]} ${elbow[1]} L${l[0]} ${l[1]}`;
  const kDot = m.at(0, 0.3, 'back');
  const kLine = m.at(0.2, 0.6, 'easeInOut');
  const kBox = m.at(0.7, 0.45);
  const col = m.str('accent', '#F9D84A');
  const dash = m.str('style', 'solid') === 'dotted' ? `1 ${m.u * 1.4}` : m.str('style', 'solid') === 'dashed' ? `${m.u * 2} ${m.u * 1.2}` : undefined;
  return (
    <div style={{ position: 'absolute', inset: 0, ...exitStyle(m) }}>
      <svg width={m.w} height={m.h} style={{ position: 'absolute', inset: 0 }}>
        <circle cx={p[0]} cy={p[1]} r={m.u * 1.6 * kDot} fill={col} />
        <circle cx={p[0]} cy={p[1]} r={m.u * (1.6 + ((m.t * 1.3) % 1) * 3)} fill="none" stroke={col} strokeWidth={2} opacity={1 - ((m.t * 1.3) % 1)} />
        <Draw d={d} k={kLine} stroke={col} width={m.u * 0.45} dash={dash} />
      </svg>
      <div style={{ position: 'absolute', left: l[0], top: l[1], translate: '0 -50%', background: 'rgba(12,12,14,.88)', borderLeft: `${m.u * 0.8}px solid ${col}`, padding: `${m.u * 1.4}px ${m.u * 2.4}px`, maxWidth: m.w * 0.42, ...enter('left', kBox, 30) }}>
        <div style={{ fontFamily: m.font, fontWeight: 800, fontSize: m.u * 3.8, color: '#fff' }}>{m.str('text', 'Label')}</div>
        {m.str('subtitle') && <div style={{ fontFamily: m.font, fontSize: m.u * 2.8, color: '#ddd' }}>{m.str('subtitle')}</div>}
      </div>
    </div>
  );
}

/** Curly bracket grouping a region, with a label on its point. */
export function bracket(m: Motion): ReactElement {
  const [cx, cy] = P(m);
  const vertical = m.str('orientation', 'vertical') === 'vertical';
  const len = (m.num('len', 40) / 100) * (vertical ? m.h : m.w);
  const dep = m.u * 4;
  const col = red(m);
  const d = vertical
    ? `M${cx - dep} ${cy - len / 2} Q${cx} ${cy - len / 2} ${cx} ${cy - len / 4} T${cx + dep} ${cy} Q${cx} ${cy} ${cx} ${cy + len / 4} T${cx - dep} ${cy + len / 2}`
    : `M${cx - len / 2} ${cy + dep} Q${cx - len / 2} ${cy} ${cx - len / 4} ${cy} T${cx} ${cy - dep} Q${cx} ${cy} ${cx + len / 4} ${cy} T${cx + len / 2} ${cy + dep}`;
  return (
    <Svg m={m}>
      <Draw d={d} k={m.at(0.1, 0.7, 'easeInOut')} stroke={col} width={m.u * 0.8} />
      <Label m={m} x={vertical ? cx + dep + m.u * 2 : cx} y={vertical ? cy : cy - dep - m.u * 3} k={m.at(0.7, 0.4)} anchor={vertical ? 'start' : 'middle'} />
    </Svg>
  );
}

/** Magnifier: lens ring + handle slides to a point; inside shows an enlarged text/number. */
export function magnifier(m: Motion): ReactElement {
  const [tx, ty] = P(m, 'x', 'y', 55, 45);
  const k = m.at(0, 0.8, 'easeOut');
  const x = lerp(tx + m.w * 0.25, tx, k);
  const y = lerp(ty + m.h * 0.2, ty, k);
  const R = m.num('radius', 14) * m.u;
  return (
    <Svg m={m}>
      <line x1={x + R * 0.7} y1={y + R * 0.7} x2={x + R * 1.6} y2={y + R * 1.6} stroke="#3B2A1A" strokeWidth={R * 0.22} strokeLinecap="round" />
      <circle cx={x} cy={y} r={R} fill="rgba(255,255,255,.12)" stroke="#222" strokeWidth={R * 0.12} />
      <circle cx={x - R * 0.35} cy={y - R * 0.35} r={R * 0.25} fill="#fff" opacity={0.25} />
      {m.str('text') && (
        <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontFamily={m.font} fontWeight={900} fontSize={R * 0.55} fill={m.color} opacity={m.at(0.7, 0.4)}>
          {m.str('text')}
        </text>
      )}
      <Label m={m} x={x} y={y + R * 1.5} k={m.at(0.9, 0.4)} anchor="middle" />
    </Svg>
  );
}

/** Rubber stamp: slams down (scale 2→1 with a jolt), ink texture, slight rotation. */
export function stamp(m: Motion): ReactElement {
  const [cx, cy] = P(m);
  const k = m.at(m.num('stampAt', 0.15), 0.28, 'easeIn');
  const settle = m.at(m.num('stampAt', 0.15) + 0.28, 0.25);
  const col = m.str('accent', '#C1121F');
  const size = m.num('size', 9) * m.u;
  const shake = k >= 1 && settle < 1 ? Math.sin(settle * 30) * (1 - settle) * m.u * 0.8 : 0;
  return (
    <div style={{ position: 'absolute', inset: 0, ...exitStyle(m) }}>
      <svg width={0} height={0}>
        <filter id="ink">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" />
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.5" />
          <feComposite in="SourceGraphic" operator="in" />
        </filter>
      </svg>
      <div style={{ position: 'absolute', left: cx + shake, top: cy, transform: `translate(-50%,-50%) rotate(${m.num('rotate', -12)}deg) scale(${lerp(2.4, 1, clamp01(k))})`, opacity: k > 0 ? 1 : 0, border: `${size * 0.12}px solid ${col}`, borderRadius: size * 0.15, padding: `${size * 0.1}px ${size * 0.4}px`, color: col, fontFamily: FONTS.impact, fontSize: size, letterSpacing: '0.08em', textTransform: 'uppercase', filter: 'url(#ink)', whiteSpace: 'nowrap' }}>
        {m.str('text', 'CLASSIFIED')}
      </div>
    </div>
  );
}

/** Redaction: black bars wipe across lines of a document region. */
export function redact(m: Motion): ReactElement {
  const [x, y] = P(m, 'x', 'y', 15, 40);
  const lines = Math.max(1, Math.round(m.num('lines', 3)));
  const w = (m.num('w', 70) / 100) * m.w;
  const lh = m.num('lineHeight', 5) * m.u;
  const r = rng(m.num('seed', 2));
  return (
    <div style={{ position: 'absolute', inset: 0, ...exitStyle(m) }}>
      {Array.from({ length: lines }, (_, i) => {
        const k = m.at(0.1 + i * 0.22, 0.4, 'easeOut');
        const ww = w * (i === lines - 1 ? r.range(0.4, 0.8) : r.range(0.85, 1));
        return <div key={i} style={{ position: 'absolute', left: x, top: y + i * lh * 1.4, width: ww * clamp01(k), height: lh, background: m.str('barColor', '#0B0B0C') }} />;
      })}
      {m.str('text') && <div style={{ position: 'absolute', left: x, top: y + lines * lh * 1.4 + m.u * 2, fontFamily: FONTS.mono, fontSize: m.u * 3, color: m.str('accent', '#E63946'), opacity: m.at(0.3 + lines * 0.22, 0.4) }}>{m.str('text')}</div>}
    </div>
  );
}

/** Sticky note: drops in with a twist, tape strip, handwritten text. */
export function sticky(m: Motion): ReactElement {
  const [cx, cy] = P(m, 'x', 'y', 70, 30);
  const k = m.at(0, 0.55, 'back');
  const size = m.num('size', 30) * m.u;
  const rot = m.num('rotate', 4);
  return (
    <div style={{ position: 'absolute', inset: 0, ...exitStyle(m) }}>
      <div style={{ position: 'absolute', left: cx, top: cy, width: size, minHeight: size * 0.8, transform: `translate(-50%,-50%) translateY(${(1 - clamp01(k)) * -m.u * 20}px) rotate(${rot + (1 - clamp01(k)) * 20}deg)`, opacity: clamp01(k * 2), background: m.str('bg', '#FFE66D'), boxShadow: '0 14px 28px rgba(0,0,0,.35)', padding: size * 0.1, fontFamily: FONTS.marker, fontSize: size * 0.13, color: m.str('ink', '#2B2B2B'), lineHeight: 1.25 }}>
        <div style={{ position: 'absolute', left: '30%', top: -size * 0.06, width: '40%', height: size * 0.12, background: 'rgba(255,255,255,.55)', transform: 'rotate(-3deg)' }} />
        {m.str('text', 'Remember this!')}
      </div>
    </div>
  );
}

/** Speech or thought bubble with a tail toward (tx, ty). */
export function bubble(m: Motion): ReactElement {
  const [cx, cy] = P(m, 'x', 'y', 55, 30);
  const [tx, ty] = P(m, 'tx', 'ty', 40, 50);
  const thought = m.str('kind', 'speech') === 'thought';
  const k = m.at(0, 0.45, 'back');
  const fs = m.num('size', 4.2) * m.u;
  const bg = m.str('bg', '#FFFFFF');
  return (
    <div style={{ position: 'absolute', inset: 0, ...exitStyle(m) }}>
      <svg width={m.w} height={m.h} style={{ position: 'absolute', inset: 0 }}>
        {thought
          ? [0.25, 0.55].map((t, i) => <circle key={i} cx={lerp(tx, cx, t)} cy={lerp(ty, cy, t)} r={m.u * (1.2 + i * 1.2) * clamp01(k)} fill={bg} />)
          : <path d={`M${cx - m.u * 3} ${cy} L${tx} ${ty} L${cx + m.u * 3} ${cy} Z`} fill={bg} opacity={clamp01(k)} />}
      </svg>
      <div style={{ position: 'absolute', left: cx, top: cy, transform: `translate(-50%,-50%) scale(${k})`, background: bg, color: m.str('ink', '#1D1D1B'), borderRadius: thought ? fs * 2 : fs * 0.8, padding: `${fs * 0.6}px ${fs * 0.9}px`, fontFamily: m.font, fontWeight: 700, fontSize: fs, maxWidth: m.w * 0.6, boxShadow: '0 10px 24px rgba(0,0,0,.25)' }}>
        {m.str('text', 'Wait… what?')}
      </div>
    </div>
  );
}

/** Numbered markers at "x,y; x,y; …" (percent) that pop in one by one, each with an optional label. */
export function numbered(m: Motion): ReactElement {
  const pts = m.str('points', '30,40; 55,55; 70,35').split(/\s*;\s*/).map((s) => s.split(/\s*,\s*/).map(Number)).filter((p) => p.length >= 2 && p.every(Number.isFinite));
  const labels = m.str('labels', '').split(/\s*;\s*/);
  const col = m.str('accent', '#E63946');
  const R = m.u * 3.2;
  return (
    <Svg m={m}>
      {pts.map(([px, py], i) => {
        const x = (px / 100) * m.w;
        const y = (py / 100) * m.h;
        const k = m.at(0.1 + i * m.num('stagger', 0.45), 0.4, 'back');
        return (
          <g key={i} transform={`translate(${x} ${y}) scale(${Math.max(0, k)})`}>
            <circle r={R} fill={col} stroke="#fff" strokeWidth={m.u * 0.5} />
            <text textAnchor="middle" dominantBaseline="central" fontFamily={FONTS.sans} fontWeight={900} fontSize={R * 1.1} fill="#fff">{i + 1}</text>
            {labels[i] && <text x={R * 1.6} dominantBaseline="central" fontFamily={m.font} fontWeight={800} fontSize={m.u * 3.6} fill="#fff" stroke="rgba(0,0,0,.6)" strokeWidth={m.u * 0.5} paintOrder="stroke">{labels[i]}</text>}
          </g>
        );
      })}
    </Svg>
  );
}

/** Document excerpt / paper clipping: paper card, lines of text, one phrase highlighted, optional red circle. */
export function documentCard(m: Motion): ReactElement {
  const text = m.str('text', 'The committee found that the project was approved without the required environmental clearance, and that the costs had tripled since 2019.');
  const hl = m.str('highlight', 'without the required environmental clearance');
  const k = m.at(0, 0.6, 'easeOut');
  const zoom = m.bool('zoom', true) ? 1 + (m.portrait ? 0.12 : 0.25) * m.at(0.8, 1.6, 'easeInOut') : 1;
  const kH = m.at(1.2, 0.7, 'easeInOut');
  const i = hl ? text.toLowerCase().indexOf(hl.toLowerCase()) : -1;
  const fs = m.num('size', 3.6) * m.u;
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...exitStyle(m) }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: m.w * 0.78, transform: `translate(-50%,-50%) translateY(${(1 - k) * m.h * 0.6}px) rotate(${m.num('rotate', -2)}deg) scale(${zoom})`, background: m.str('bg', '#F7F3EA'), padding: fs * 1.4, boxShadow: '0 20px 50px rgba(0,0,0,.4)', fontFamily: FONTS[m.str('font', 'serif')] ?? FONTS.serif, fontSize: fs, color: '#222', lineHeight: 1.55 }}>
        {m.str('title') && <div style={{ fontFamily: FONTS.sans, fontWeight: 900, fontSize: fs * 1.1, letterSpacing: '0.04em', marginBottom: fs * 0.6, textTransform: 'uppercase' }}>{m.str('title')}</div>}
        {i < 0 ? (
          text
        ) : (
          <>
            {text.slice(0, i)}
            <span style={sweep(kH, m.str('accent', '#F9D84A'))}>{text.slice(i, i + hl.length)}</span>
            {text.slice(i + hl.length)}
          </>
        )}
        {m.str('source') && <div style={{ marginTop: fs * 0.8, fontFamily: FONTS.sans, fontSize: fs * 0.7, color: '#777' }}>{m.str('source')}</div>}
      </div>
    </div>
  );
}

/** Animated mouse cursor: glides from A to B, clicks (ripple), optional label. */
export function cursor(m: Motion): ReactElement {
  const a = P(m, 'x1', 'y1', 20, 80);
  const b = P(m, 'x2', 'y2', 60, 40);
  const k = m.at(0.1, m.num('moveDur', 1), 'easeInOut');
  const x = lerp(a[0], b[0], k);
  const y = lerp(a[1], b[1], k) - Math.sin(k * Math.PI) * m.u * 6;
  const click = m.at(0.15 + m.num('moveDur', 1), 0.5, 'easeOut');
  const s = m.u * 5;
  return (
    <Svg m={m}>
      {click > 0 && click < 1 && <circle cx={b[0]} cy={b[1]} r={s * 0.4 + click * s * 1.4} fill="none" stroke={m.str('accent', '#F9D84A')} strokeWidth={m.u * 0.5} opacity={1 - click} />}
      <path d={`M${x} ${y} l0 ${s} l${s * 0.28} ${-s * 0.26} l${s * 0.22} ${s * 0.45} l${s * 0.14} ${-s * 0.07} l${-s * 0.22} ${-s * 0.44} l${s * 0.38} 0 Z`} fill="#fff" stroke="#111" strokeWidth={m.u * 0.35} strokeLinejoin="round" transform={click > 0 && click < 0.3 ? `translate(${x} ${y}) scale(0.88) translate(${-x} ${-y})` : undefined} />
      <Label m={m} x={b[0] + s} y={b[1] + s * 1.2} k={m.at(0.4 + m.num('moveDur', 1), 0.4)} />
    </Svg>
  );
}

// ================================================================ shapes
/** Geometric shape with a reveal: draw, scale, pop, wipe, rotate, ripple, morph (circle ↔ square). */
export function shape(m: Motion): ReactElement {
  const kind = m.str('shape', 'circle');
  const anim = m.str('anim', 'draw');
  const [cx, cy] = P(m);
  const S = (m.num('size', 30) / 100) * Math.min(m.w, m.h);
  const k = m.at(0.05, m.num('animDur', 0.9), anim === 'pop' ? 'back' : 'easeInOut');
  const col = m.str('accent', '#F9D84A');
  const fill = m.bool('filled', anim !== 'draw') ? col : 'none';
  const sw = m.num('stroke', 1.2) * m.u;
  const poly = (n: number, inner = 1) =>
    Array.from({ length: n * (inner < 1 ? 2 : 1) }, (_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / (n * (inner < 1 ? 2 : 1));
      const r = inner < 1 && i % 2 ? S * 0.5 * inner : S * 0.5;
      return `${cx + Math.cos(a) * r} ${cy + Math.sin(a) * r}`;
    }).join(' L');
  let d = '';
  switch (kind) {
    case 'square':
      d = `M${cx - S / 2} ${cy - S / 2} L${cx + S / 2} ${cy - S / 2} L${cx + S / 2} ${cy + S / 2} L${cx - S / 2} ${cy + S / 2} Z`;
      break;
    case 'triangle':
      d = `M${poly(3)} Z`;
      break;
    case 'hexagon':
      d = `M${poly(6)} Z`;
      break;
    case 'star':
      d = `M${poly(5, 0.45)} Z`;
      break;
    case 'line':
      d = `M${cx - S / 2} ${cy} L${cx + S / 2} ${cy}`;
      break;
    default:
      d = `M${cx + S / 2} ${cy} A${S / 2} ${S / 2} 0 1 1 ${cx - S / 2} ${cy} A${S / 2} ${S / 2} 0 1 1 ${cx + S / 2} ${cy}`;
  }
  if (anim === 'ripple') {
    return (
      <Svg m={m}>
        {Array.from({ length: 4 }, (_, i) => {
          const t = ((m.t * m.num('rate', 0.8) + i / 4) % 1);
          return <circle key={i} cx={cx} cy={cy} r={S * 0.5 * t * 1.6} fill="none" stroke={col} strokeWidth={sw * (1 - t)} opacity={1 - t} />;
        })}
      </Svg>
    );
  }
  if (anim === 'morph') {
    const t = (Math.sin(m.t * Math.PI * m.num('rate', 0.5)) + 1) / 2;
    return (
      <Svg m={m}>
        <rect x={cx - S / 2} y={cy - S / 2} width={S} height={S} rx={(S / 2) * t} fill={col} transform={`rotate(${t * 45} ${cx} ${cy})`} />
      </Svg>
    );
  }
  const tf =
    anim === 'scale' || anim === 'pop' ? `translate(${cx} ${cy}) scale(${Math.max(0, k)}) translate(${-cx} ${-cy})` : anim === 'rotate' ? `rotate(${(1 - k) * -180} ${cx} ${cy}) translate(${cx} ${cy}) scale(${clamp01(k)}) translate(${-cx} ${-cy})` : undefined;
  return (
    <Svg m={m} style={anim === 'wipe' ? { clipPath: `inset(0 ${(1 - clamp01(k)) * 100}% 0 0)` } : undefined}>
      {anim === 'draw' ? (
        <>
          <Draw d={d} k={k} stroke={col} width={sw} />
          {m.bool('filled', false) && <path d={d} fill={col} opacity={m.at(0.9, 0.4) * 0.9} />}
        </>
      ) : (
        <path d={d} fill={fill} stroke={fill === 'none' ? col : 'none'} strokeWidth={sw} transform={tf} />
      )}
    </Svg>
  );
}

/** Burst / scatter / assemble: many small shapes explode outward (or gather inward) from a point. */
export function burst(m: Motion): ReactElement {
  const [cx, cy] = P(m);
  const n = Math.round(m.num('count', 36));
  const inward = m.str('direction', 'out') === 'in';
  const k = m.at(0.05, m.num('burstDur', 1.2), inward ? 'easeInOut' : 'expo');
  const r = rng(m.num('seed', 9));
  const pal = m.str('colors', '#F9D84A,#E63946,#2A6FDB,#2A9D8F,#FFFFFF').split(/\s*,\s*/);
  const kind = m.str('shape', 'mixed');
  return (
    <Svg m={m}>
      {Array.from({ length: n }, (_, i) => {
        const a = r() * Math.PI * 2;
        const dist = Math.min(m.w, m.h) * r.range(0.15, 0.55);
        const t = inward ? 1 - k : k;
        const x = cx + Math.cos(a) * dist * t;
        const y = cy + Math.sin(a) * dist * t + (inward ? 0 : t * t * m.u * 8);
        const s = m.u * r.range(0.8, 2.4) * (inward ? 1 : 1 - t * 0.6);
        const col = pal[i % pal.length];
        const op = inward ? clamp01(k * 3) : clamp01(1.4 - t);
        const sh = kind === 'mixed' ? i % 3 : kind === 'circle' ? 0 : kind === 'square' ? 1 : 2;
        return sh === 0 ? <circle key={i} cx={x} cy={y} r={s} fill={col} opacity={op} /> : sh === 1 ? <rect key={i} x={x - s} y={y - s} width={s * 2} height={s * 2} fill={col} opacity={op} transform={`rotate(${t * 360 * r()} ${x} ${y})`} /> : <path key={i} d={`M${x} ${y - s * 1.3} L${x + s * 1.1} ${y + s * 0.8} L${x - s * 1.1} ${y + s * 0.8} Z`} fill={col} opacity={op} />;
      })}
    </Svg>
  );
}

/** Grid / pattern reveal: lines draw or tiles fill in a diagonal wave (good as a background build). */
export function gridReveal(m: Motion): ReactElement {
  const cols = Math.round(m.num('cols', 8));
  const rows = Math.round(cols * (m.h / m.w));
  const cw = m.w / cols;
  const ch = m.h / rows;
  const tiles = m.str('mode', 'lines') === 'tiles';
  const col = m.str('accent', '#FFFFFF');
  return (
    <Svg m={m}>
      {tiles
        ? Array.from({ length: cols * rows }, (_, i) => {
            const x = i % cols;
            const y = Math.floor(i / cols);
            const k = m.at(0.05 + (x + y) * 0.04, 0.4, 'back');
            return <rect key={i} x={x * cw + cw * 0.06} y={y * ch + ch * 0.06} width={cw * 0.88} height={ch * 0.88} rx={m.u} fill={col} opacity={0.12 * clamp01(k)} transform={`translate(${x * cw + cw / 2} ${y * ch + ch / 2}) scale(${Math.max(0, k)}) translate(${-(x * cw + cw / 2)} ${-(y * ch + ch / 2)})`} />;
          })
        : [
            ...Array.from({ length: cols + 1 }, (_, i) => <Draw key={`v${i}`} d={`M${i * cw} 0 L${i * cw} ${m.h}`} k={m.at(i * 0.05, 0.8)} stroke={col} width={1} opacity={0.2} />),
            ...Array.from({ length: rows + 1 }, (_, i) => <Draw key={`h${i}`} d={`M0 ${i * ch} L${m.w} ${i * ch}`} k={m.at(0.2 + i * 0.05, 0.8)} stroke={col} width={1} opacity={0.2} />),
          ]}
    </Svg>
  );
}
