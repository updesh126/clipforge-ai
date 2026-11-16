/**
 * Typography renderers. `textReveal` is the workhorse: unit (word / letter / line / whole) × animation
 * (any entry of the enter grammar + typewriter, scramble, bounce) × stagger, with *emphasis* words in the accent.
 */
import type { CSSProperties, ReactElement } from 'react';
import { ANIMS, Draw, enter, exitStyle, FONTS, scribbleEllipse, Stage, sweep, Svg, clamp01, type Motion } from '../core.tsx';
import { rng } from '../../vector/geom.ts';

const graphemes = (s: string) => {
  try {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return Array.from(seg.segment(s), (x) => x.segment);
  } catch {
    return Array.from(s);
  }
};

/** Words wrapped in *asterisks* are emphasised (accent colour + optional marker behind). */
function parseEmphasis(text: string): { word: string; em: boolean }[] {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => ({ word: w.replace(/^\*+|\*+$/g, ''), em: /^\*.*\*$/.test(w) || /^\*[^*]+\*[.,!?;:]?$/.test(w) }));
}

function boxStyle(m: Motion, size: number): CSSProperties {
  switch (m.str('box', 'none')) {
    case 'paper':
      return { background: m.bg, color: m.ink, padding: `${size * 0.25}px ${size * 0.5}px`, boxShadow: '0 12px 30px rgba(0,0,0,.25)' };
    case 'solid':
      return { background: m.accent, color: m.ink, padding: `${size * 0.2}px ${size * 0.45}px` };
    case 'dark':
      return { background: 'rgba(10,10,12,.82)', padding: `${size * 0.25}px ${size * 0.5}px`, borderRadius: size * 0.12 };
    case 'tag':
      return { background: m.ink, color: m.bg, padding: `${size * 0.12}px ${size * 0.35}px`, borderRadius: size * 0.08 };
    default:
      return {};
  }
}

/** The text reveal engine. */
export function textReveal(m: Motion): ReactElement {
  const text = m.str('text', 'Your *story* here');
  const unit = m.str('unit', 'word');
  const anim = m.str('anim', 'up');
  const size = m.num('size', 11) * m.u;
  const stagger = m.num('stagger', unit === 'letter' ? 0.035 : unit === 'line' ? 0.25 : 0.09);
  const dur = m.num('dur', unit === 'letter' ? 0.3 : 0.55);
  const upper = m.str('case', 'none') === 'upper';
  const align = m.str('align', 'center') as CSSProperties['textAlign'];
  const weight = m.num('weight', 800);
  const tilt = m.num('tilt', 0);
  const emMark = m.bool('emMarker', false);
  const base: CSSProperties = {
    fontFamily: m.font,
    fontSize: size,
    fontWeight: weight,
    lineHeight: 1.08,
    color: m.color,
    textTransform: upper ? 'uppercase' : 'none',
    textAlign: align,
    letterSpacing: m.str('font') === 'condensed' ? '-0.01em' : '-0.02em',
    textShadow: m.bool('shadow', true) && m.str('box', 'none') === 'none' ? '0 4px 18px rgba(0,0,0,.45)' : undefined,
    ...boxStyle(m, size),
    transform: tilt ? `perspective(${m.w}px) rotateX(${tilt}deg)` : undefined,
    maxWidth: '100%',
  };

  // typewriter: graphemes appear at a steady rate, with a caret
  if (anim === 'typewriter') {
    const all = graphemes(text.replace(/\*/g, ''));
    const cps = m.num('cps', 18);
    const n = Math.max(0, Math.min(all.length, Math.floor(m.t * cps)));
    const caret = Math.floor(m.t * 2) % 2 === 0 || n < all.length;
    return (
      <Stage m={m}>
        <div style={{ ...base, fontFamily: m.str('font') === 'sans' ? FONTS.mono : m.font, whiteSpace: 'pre-wrap' }}>
          {all.slice(0, n).join('')}
          <span style={{ opacity: caret ? 1 : 0, color: m.accent }}>▍</span>
        </div>
      </Stage>
    );
  }

  const lines = text.split(/\s*(?:\n|\s\/\s)\s*/);
  let idx = 0;
  const scramble = anim === 'scramble';
  const glyphs = '#%&*+=<>?/ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  const r = rng(Math.floor(m.f / 2) + 1);
  const animName = anim === 'bounce' ? 'pop' : scramble ? 'fade' : anim;
  const easing = anim === 'bounce' ? 'bounce' : anim === 'pop' ? 'back' : undefined;
  const items = lines.map((line, li) => {
    const words = parseEmphasis(line);
    if (unit === 'line' || unit === 'whole') {
      const k = m.at(unit === 'whole' ? 0 : li * stagger, dur, easing);
      return (
        <div key={li} style={{ ...enter(animName, k, size * 0.6), display: 'block' }}>
          {words.map((w, wi) => (
            <span key={wi} style={{ color: w.em ? m.accent : undefined, position: 'relative' }}>
              {w.word}
              {wi < words.length - 1 ? ' ' : ''}
            </span>
          ))}
        </div>
      );
    }
    return (
      <div key={li} style={{ display: 'block' }}>
        {words.map((w, wi) => {
          if (unit === 'word') {
            const k = m.at(idx++ * stagger, dur, easing);
            const mk = clamp01((m.t - (idx * stagger + dur)) / 0.35);
            return (
              <span key={wi} style={{ display: 'inline-block', marginRight: '0.26em', position: 'relative', color: w.em ? m.accent : undefined, ...enter(animName, k, size * 0.6) }}>
                {w.em && emMark && <span style={{ position: 'absolute', left: '-0.08em', right: '-0.08em', top: '18%', bottom: '8%', background: m.accent, opacity: 0.85, zIndex: -1, transformOrigin: 'left', transform: `scaleX(${mk})` }} />}
                <span style={{ color: w.em && emMark ? m.ink : undefined }}>{w.word}</span>
              </span>
            );
          }
          // letters (graphemes, so Devanagari conjuncts stay whole)
          const gs = graphemes(w.word);
          return (
            <span key={wi} style={{ display: 'inline-block', marginRight: '0.26em', color: w.em ? m.accent : undefined, whiteSpace: 'nowrap' }}>
              {gs.map((g, gi) => {
                const start = idx++ * stagger;
                const k = m.at(start, dur, easing);
                const ch = scramble && k < 1 && m.t > start - 0.4 ? glyphs[Math.floor(r() * glyphs.length)] : g;
                return (
                  <span key={gi} style={{ display: 'inline-block', ...enter(animName, scramble ? (m.t > start - 0.4 ? 1 : 0) : k, size * 0.5) }}>
                    {ch === ' ' ? ' ' : ch}
                  </span>
                );
              })}
            </span>
          );
        })}
      </div>
    );
  });
  return (
    <Stage m={m}>
      <div style={base}>{items}</div>
      {m.str('subtitle') && (
        <div style={{ marginTop: size * 0.35, fontFamily: m.font, fontSize: size * 0.38, fontWeight: 600, color: m.color, opacity: 0.85 * m.at(stagger * 6, 0.6), letterSpacing: '0.04em', textAlign: align }}>{m.str('subtitle')}</div>
      )}
    </Stage>
  );
}

/** Paper title card: paper slides up, kicker + title fade up, marker line draws beneath. */
export function paperTitle(m: Motion): ReactElement {
  const size = m.num('size', 9) * m.u;
  const kCard = m.at(0, 0.55, 'back');
  const kText = m.at(0.35, 0.6);
  const kLine = m.at(1.0, 0.7, 'easeInOut');
  const tilt = m.num('tilt', -2);
  const text = m.str('text', 'The hidden cost of cheap flights');
  return (
    <Stage m={m}>
      <div style={{ position: 'relative', background: m.bg, padding: `${size * 0.55}px ${size * 0.7}px ${size * 0.7}px`, maxWidth: '88%', transform: `translateY(${(1 - kCard) * 40 * m.u}px) rotate(${tilt}deg)`, boxShadow: '0 18px 50px rgba(0,0,0,.35)', clipPath: 'polygon(0 2%, 4% 0, 30% 1.5%, 58% 0, 86% 2%, 100% 0, 99% 97%, 75% 100%, 44% 98%, 15% 100%, 0 98%)' }}>
        {m.str('kicker') && <div style={{ fontFamily: FONTS.sans, fontSize: size * 0.3, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: m.str('kickerColor', '#E63946'), opacity: kText }}>{m.str('kicker')}</div>}
        <div style={{ fontFamily: FONTS[m.str('font', 'serif')] ?? FONTS.serif, fontSize: size, fontWeight: 700, lineHeight: 1.08, color: m.ink, ...enter('up', kText, size * 0.5) }}>{text}</div>
        <svg width="100%" height={size * 0.4} viewBox="0 0 100 10" preserveAspectRatio="none" style={{ display: 'block', marginTop: size * 0.12 }}>
          <Draw d="M1 6 C 25 3, 55 8, 99 4" k={kLine} stroke={m.accent} width={size * 0.1} fixed />
        </svg>
      </div>
    </Stage>
  );
}

/** Marker treatments on a phrase: highlight sweep, underline, strike-through, circle, box, double underline. */
export function marker(m: Motion): ReactElement {
  const size = m.num('size', 10) * m.u;
  const mode = m.str('mode', 'highlight');
  const text = m.str('text', 'twice as fast');
  const kT = m.at(0, 0.45);
  const kM = m.at(m.num('markAt', 0.45), 0.6, 'easeInOut');
  const col = m.accent;
  const svgStyle: CSSProperties = { position: 'absolute', left: '-6%', top: '-20%', width: '112%', height: '140%', overflow: 'visible', pointerEvents: 'none' };
  const before = mode === 'highlight';
  return (
    <Stage m={m}>
      <div style={{ ...enter(m.str('anim', 'up'), kT, size * 0.5), position: 'relative', display: 'inline-block', fontFamily: m.font, fontSize: size, fontWeight: 800, color: before && kM > 0.3 ? m.ink : m.color, padding: `0 ${size * 0.12}px`, lineHeight: 1.15, textShadow: before ? undefined : '0 3px 12px rgba(0,0,0,.4)' }}>
        {before && <span style={{ position: 'absolute', left: 0, right: 0, top: '12%', bottom: '6%', background: col, transformOrigin: 'left', transform: `scaleX(${kM}) skewX(-6deg)`, zIndex: 0, borderRadius: size * 0.05 }} />}
        <span style={{ position: 'relative' }}>{text}</span>
        {!before && (
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={svgStyle}>
            {mode === 'underline' && <Draw d="M4 88 C 30 84, 60 92, 96 86" k={kM} stroke={col} width={size * 0.09} fixed />}
            {mode === 'double' && (
              <>
                <Draw d="M4 84 C 30 80, 60 88, 96 82" k={kM} stroke={col} width={size * 0.07} fixed />
                <Draw d="M8 93 C 35 90, 62 96, 92 91" k={m.at(m.num('markAt', 0.45) + 0.3, 0.5)} stroke={col} width={size * 0.07} fixed />
              </>
            )}
            {mode === 'strike' && <Draw d="M2 55 C 30 50, 60 58, 98 50" k={kM} stroke={col} width={size * 0.1} fixed />}
            {mode === 'circle' && <Draw d={scribbleEllipse(50, 50, 50, 46, 3)} k={kM} stroke={col} width={size * 0.08} fixed />}
            {mode === 'box' && <Draw d="M3 12 L97 9 L98 92 L2 90 Z" k={kM} stroke={col} width={size * 0.07} fixed />}
          </svg>
        )}
      </div>
    </Stage>
  );
}

/** Quote card: dims the frame, big quote marks scale in, lines reveal, a phrase gets highlighted, source appears. */
export function quoteCard(m: Motion): ReactElement {
  const size = m.num('size', 7.5) * m.u;
  const text = m.str('text', 'The best way to predict the future is to create it.');
  const hl = m.str('highlight', '');
  const words = text.split(/\s+/);
  const per = Math.max(3, Math.ceil(words.length / Math.ceil(words.length / 6)));
  const lines: string[] = [];
  for (let i = 0; i < words.length; i += per) lines.push(words.slice(i, i + per).join(' '));
  const kBg = m.at(0, 0.4);
  const kMarks = m.at(0.15, 0.6, 'back');
  const kHl = m.at(0.4 + lines.length * 0.3 + 0.2, 0.6, 'easeInOut');
  const renderLine = (l: string) => {
    if (!hl || !l.toLowerCase().includes(hl.toLowerCase())) return l;
    const i = l.toLowerCase().indexOf(hl.toLowerCase());
    return (
      <>
        {l.slice(0, i)}
        <span style={{ ...sweep(kHl, m.accent), color: kHl > 0.4 ? m.ink : undefined }}>{l.slice(i, i + hl.length)}</span>
        {l.slice(i + hl.length)}
      </>
    );
  };
  return (
    <div style={{ position: 'absolute', inset: 0, ...exitStyle(m) }}>
      <div style={{ position: 'absolute', inset: 0, background: m.str('dim', 'rgba(8,8,10,.72)'), opacity: kBg }} />
      <Stage m={m}>
        <div style={{ fontFamily: FONTS.serif, fontSize: size * 3.2, lineHeight: 0.6, color: m.accent, transform: `scale(${kMarks})`, opacity: clamp01(kMarks) }}>“</div>
        <div style={{ fontFamily: FONTS[m.str('font', 'serif')] ?? FONTS.serif, fontSize: size, fontWeight: 600, color: m.color, textAlign: 'center', lineHeight: 1.25, isolation: 'isolate' }}>
          {lines.map((l, i) => (
            <div key={i} style={enter('mask', m.at(0.4 + i * 0.3, 0.55), size)}>
              {renderLine(l)}
            </div>
          ))}
        </div>
        {m.str('source') && <div style={{ marginTop: size * 0.6, fontFamily: FONTS.sans, fontSize: size * 0.45, fontWeight: 700, letterSpacing: '0.08em', color: m.accent, ...enter('up', m.at(0.6 + lines.length * 0.3, 0.5), 20) }}>— {m.str('source')}</div>}
      </Stage>
    </div>
  );
}

/** Lower third: accent bar wipes, name + role slide in. */
export function lowerThird(m: Motion): ReactElement {
  const size = m.num('size', 6) * m.u;
  const kBar = m.at(0, 0.45, 'easeOut');
  const kName = m.at(0.2, 0.5);
  const kRole = m.at(0.4, 0.5);
  return (
    <div style={{ position: 'absolute', left: `${m.num('x', 6)}%`, top: `${m.num('y', 78)}%`, ...exitStyle(m) }}>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: size * 0.3 }}>
        <div style={{ width: size * 0.18, background: m.accent, transformOrigin: 'top', transform: `scaleY(${kBar})` }} />
        <div style={{ clipPath: `inset(0 ${(1 - kBar) * 100}% 0 0)` }}>
          <div style={{ background: 'rgba(12,12,14,.85)', padding: `${size * 0.2}px ${size * 0.45}px` }}>
            <div style={{ fontFamily: m.font, fontWeight: 800, fontSize: size, color: m.color, ...enter('left', kName, size) }}>{m.str('text', 'Sachin Choudhary')}</div>
            <div style={{ fontFamily: m.font, fontWeight: 600, fontSize: size * 0.55, color: m.accent, letterSpacing: '0.04em', ...enter('left', kRole, size) }}>{m.str('subtitle', 'Founder, BuzyBug')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Kinetic / oversized headline: each word on its own line, alternating size & colour, slams in. */
export function kinetic(m: Motion): ReactElement {
  const words = m.str('text', 'THIS *CHANGES* EVERYTHING').split(/\s+/).filter(Boolean);
  const base = m.num('size', 13) * m.u;
  const stagger = m.num('stagger', 0.16);
  const r = rng(m.num('seed', 3));
  return (
    <Stage m={m}>
      <div style={{ fontFamily: FONTS[m.str('font', 'impact')] ?? FONTS.impact, textTransform: 'uppercase', lineHeight: 0.92, textAlign: 'center' }}>
        {words.map((w, i) => {
          const em = /^\*.*\*/.test(w);
          const k = m.at(i * stagger, 0.45, 'back');
          const s = em ? 1.35 : i % 2 ? 0.72 : 1;
          const rot = (r() - 0.5) * m.num('wobble', 6);
          return (
            <div key={i} style={{ fontSize: base * s, color: em ? m.accent : m.color, transform: `scale(${0.3 + 0.7 * k}) rotate(${(1 - clamp01(k)) * 20 + rot}deg)`, opacity: clamp01(k * 2), textShadow: '0 6px 0 rgba(0,0,0,.25)' }}>
              {w.replace(/\*/g, '')}
            </div>
          );
        })}
      </div>
    </Stage>
  );
}

/** Ticker / credits: text scrolls horizontally (news ticker) or vertically (credits). */
export function scroller(m: Motion): ReactElement {
  const size = m.num('size', 4.2) * m.u;
  const text = m.str('text', 'BREAKING • Markets rally after the announcement • Rupee strengthens • Monsoon arrives early');
  const vertical = m.str('direction', 'horizontal') === 'vertical';
  const speed = m.num('pace', 1);
  if (vertical) {
    const off = m.h - m.t * 80 * speed * m.u * 0.25;
    return (
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...exitStyle(m) }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: off, textAlign: 'center', fontFamily: m.font, fontSize: size, color: m.color, lineHeight: 1.7 }}>
          {text.split(/\s*(?:\n|•|\|)\s*/).map((l, i) => <div key={i}>{l}</div>)}
        </div>
      </div>
    );
  }
  const off = m.w - m.t * 60 * speed * m.u * 0.5;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: `${m.num('y', 88)}%`, height: size * 1.8, background: m.str('barColor', '#C1121F'), overflow: 'hidden', display: 'flex', alignItems: 'center', ...exitStyle(m), clipPath: `inset(0 ${(1 - m.at(0, 0.4)) * 100}% 0 0)` }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, zIndex: 2, background: m.ink, color: '#fff', fontFamily: m.font, fontWeight: 900, fontSize: size * 0.8, display: 'flex', alignItems: 'center', padding: `0 ${size * 0.5}px` }}>{m.str('label', 'LIVE')}</div>
      <div style={{ position: 'absolute', left: off, whiteSpace: 'nowrap', fontFamily: m.font, fontWeight: 700, fontSize: size, color: '#fff' }}>{text}</div>
    </div>
  );
}

/** Chapter card: colour panel wipes, big number, title, subtitle. */
export function chapter(m: Motion): ReactElement {
  const size = m.num('size', 8) * m.u;
  const kBg = m.at(0, 0.5, 'easeInOut');
  const kNum = m.at(0.3, 0.6, 'back');
  const kT = m.at(0.55, 0.6);
  const kS = m.at(0.8, 0.6);
  return (
    <div style={{ position: 'absolute', inset: 0, ...exitStyle(m) }}>
      <div style={{ position: 'absolute', inset: 0, background: m.bg, clipPath: `inset(0 ${(1 - kBg) * 100}% 0 0)` }} />
      <Stage m={m}>
        <div style={{ fontFamily: FONTS.impact, fontSize: size * 2.4, color: m.accent, lineHeight: 1, transform: `scale(${kNum})`, opacity: clamp01(kNum) }}>{m.str('number', '01')}</div>
        <div style={{ fontFamily: FONTS[m.str('font', 'serif')] ?? FONTS.serif, fontSize: size, fontWeight: 700, color: m.ink, textAlign: 'center', ...enter('up', kT, size) }}>{m.str('text', 'The beginning')}</div>
        {m.str('subtitle') && <div style={{ marginTop: size * 0.3, fontFamily: FONTS.sans, fontSize: size * 0.4, letterSpacing: '0.18em', textTransform: 'uppercase', color: m.ink, opacity: 0.7, ...enter('up', kS, size) }}>{m.str('subtitle')}</div>}
      </Stage>
    </div>
  );
}

/** Text swap / morph: text A, then it blurs and morphs into text B (also number → word). */
export function textSwap(m: Motion): ReactElement {
  const size = m.num('size', 11) * m.u;
  const sw = m.num('swapAt', Math.max(0.8, m.D * 0.45));
  const kA = m.at(0, 0.4);
  const kOut = m.at(sw, 0.35, 'easeIn');
  const kB = m.at(sw + 0.2, 0.5, 'back');
  const style: CSSProperties = { position: 'absolute', left: 0, right: 0, textAlign: 'center', fontFamily: m.font, fontWeight: 900, fontSize: size, color: m.color, textShadow: '0 4px 18px rgba(0,0,0,.4)' };
  return (
    <Stage m={m}>
      <div style={{ position: 'relative', width: '100%', height: size * 1.3 }}>
        <div style={{ ...style, opacity: kA * (1 - kOut), filter: `blur(${kOut * 16}px)`, transform: `scale(${1 + kOut * 0.3})` }}>{m.str('text', '1,000,000')}</div>
        <div style={{ ...style, color: m.accent, opacity: clamp01(kB), filter: `blur(${(1 - clamp01(kB)) * 14}px)`, transform: `scale(${0.7 + 0.3 * kB})` }}>{m.str('text2', 'one million')}</div>
      </div>
    </Stage>
  );
}

/** Circular text: words run around a ring that rotates in. */
export function circularText(m: Motion): ReactElement {
  const R = m.num('radius', 28) * m.u;
  const cx = (m.num('x', 50) / 100) * m.w;
  const cy = (m.num('y', 50) / 100) * m.h;
  const k = m.at(0, 0.9);
  const rot = m.t * m.num('spin', 20) + (1 - k) * -90;
  const text = m.str('text', 'ROUND AND ROUND • ROUND AND ROUND • ');
  return (
    <Svg m={m}>
      <defs>
        <path id="ctp" d={`M ${cx - R} ${cy} a ${R} ${R} 0 1 1 ${2 * R} 0 a ${R} ${R} 0 1 1 ${-2 * R} 0`} />
      </defs>
      <g transform={`rotate(${rot} ${cx} ${cy})`} opacity={clamp01(k)}>
        <text fontFamily={m.font} fontWeight={800} fontSize={m.num('size', 5) * m.u} fill={m.color} letterSpacing="0.12em">
          <textPath href="#ctp">{text}</textPath>
        </text>
      </g>
      {m.str('center') && (
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontFamily={m.font} fontWeight={900} fontSize={m.num('size', 5) * m.u * 2} fill={m.accent} opacity={m.at(0.4, 0.5)}>
          {m.str('center')}
        </text>
      )}
    </Svg>
  );
}

export const TEXT_ANIMS = [...ANIMS, 'typewriter', 'scramble', 'bounce'];
