/**
 * Editorial layouts (split screen, cards, browser, search, chat, social post, newspaper, evidence board,
 * myth-vs-fact) and explanatory diagrams (timeline, process flow / cycle, network, cause→effect, tree).
 */
import type { CSSProperties, ReactElement } from 'react';
import { arrowPaths, Draw, enter, exitStyle, FONTS, formatNumber, sweep, Svg, clamp01, lerp, type Motion } from '../core.tsx';
import { rng } from '../../vector/geom.ts';

const items = (s: string, fb: string) => (s || fb).split(/\s*;\s*|\n/).map((x) => x.trim()).filter(Boolean);
const pair = (s: string): [string, string] => {
  const i = s.indexOf('|') >= 0 ? s.indexOf('|') : s.indexOf(':');
  return i < 0 ? [s, ''] : [s.slice(0, i).trim(), s.slice(i + 1).trim()];
};
const Wrap = ({ m, children, style }: { m: Motion; children: React.ReactNode; style?: CSSProperties }) => <div style={{ position: 'absolute', inset: 0, ...exitStyle(m), ...style }}>{children}</div>;

/** Split screen comparison: two panels slide in from their sides, labels + text, VS badge, divider. */
export function split(m: Motion): ReactElement {
  const vertical = m.portrait;
  const kA = m.at(0, 0.6);
  const kB = m.at(0.5, 0.6);
  const kVs = m.at(1.1, 0.4, 'back');
  const panel = (side: 0 | 1, k: number): CSSProperties => ({
    position: 'absolute',
    ...(vertical ? { left: 0, right: 0, height: '50%', top: side ? '50%' : 0 } : { top: 0, bottom: 0, width: '50%', left: side ? '50%' : 0 }),
    background: side ? m.str('colorB', '#2A6FDB') : m.str('colorA', '#E63946'),
    transform: vertical ? `translateY(${(1 - k) * (side ? 100 : -100)}%)` : `translateX(${(1 - k) * (side ? 100 : -100)}%)`,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: m.u * 6,
    color: '#fff',
    textAlign: 'center',
  });
  const block = (title: string, text: string, k: number) => (
    <>
      <div style={{ fontFamily: FONTS.impact, fontSize: m.u * 9, ...enter('up', k, 30) }}>{title}</div>
      {text && <div style={{ fontFamily: m.font, fontWeight: 600, fontSize: m.u * 4, marginTop: m.u * 2, opacity: 0.95, ...enter('up', k, 30) }}>{text}</div>}
    </>
  );
  return (
    <Wrap m={m}>
      <div style={panel(0, kA)}>{block(m.str('labelA', 'Then'), m.str('textA', '1 phone per 100 people'), m.at(0.3, 0.5))}</div>
      <div style={panel(1, kB)}>{block(m.str('labelB', 'Now'), m.str('textB', '85 phones per 100 people'), m.at(0.8, 0.5))}</div>
      {m.bool('vs', true) && (
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%,-50%) scale(${kVs})`, width: m.u * 14, height: m.u * 14, borderRadius: '50%', background: '#fff', color: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONTS.impact, fontSize: m.u * 6, boxShadow: '0 10px 30px rgba(0,0,0,.4)' }}>{m.str('vsText', 'VS')}</div>
      )}
    </Wrap>
  );
}

/** Floating cards ("Title|text; …"): stack, fan, grid or list; staggered entry; one highlighted. */
export function cards(m: Motion): ReactElement {
  const list = items(m.str('items'), 'Fast|Ships in a day; Cheap|Half the price; Local|Made in India').map(pair);
  const layout = m.str('layout', m.portrait ? 'list' : 'row');
  const n = list.length;
  const hi = m.num('highlight', 0);
  const cw = layout === 'row' ? (m.w * 0.84) / n : m.w * 0.8;
  const ch = layout === 'row' ? m.h * 0.4 : Math.min(m.h * 0.14, (m.h * 0.62) / n);
  return (
    <Wrap m={m}>
      {m.str('title') && <div style={{ position: 'absolute', left: m.u * 8, right: m.u * 8, top: m.h * 0.1, fontFamily: m.font, fontWeight: 900, fontSize: m.u * 6, color: m.color, ...enter('up', m.at(0, 0.5), 30) }}>{m.str('title')}</div>}
      {list.map(([t, d], i) => {
        const k = m.at(0.3 + i * m.num('stagger', 0.3), 0.55, 'back');
        const isHi = hi === i + 1;
        const kHi = isHi ? m.at(0.6 + n * 0.3, 0.4) : 0;
        let style: CSSProperties;
        if (layout === 'row') style = { left: m.w * 0.08 + i * cw + cw * 0.05, top: m.h * 0.3, width: cw * 0.9, height: ch };
        else if (layout === 'stack') style = { left: m.w * 0.1 + i * m.u * 2, top: m.h * 0.25 + i * m.u * 4, width: cw, height: m.h * 0.3, transform: `rotate(${(i - (n - 1) / 2) * 3}deg)` };
        else if (layout === 'fan') style = { left: m.w * 0.5 - cw * 0.3, top: m.h * 0.3, width: cw * 0.6, height: m.h * 0.35, transformOrigin: '50% 140%', transform: `rotate(${(i - (n - 1) / 2) * 12 * clamp01(k)}deg)` };
        else style = { left: m.w * 0.1, top: m.h * 0.22 + i * (ch + m.u * 2), width: cw, height: ch };
        return (
          <div key={i} style={{ position: 'absolute', ...style, background: isHi && kHi > 0.5 ? m.accent : m.str('cardBg', '#FFFFFF'), color: isHi && kHi > 0.5 ? m.ink : '#1D1D1B', borderRadius: m.u * 2, padding: m.u * 3, boxShadow: '0 16px 40px rgba(0,0,0,.35)', display: 'flex', flexDirection: 'column', justifyContent: 'center', opacity: clamp01(k * 2), translate: `0 ${(1 - clamp01(k)) * m.u * 12}px`, scale: `${1 + kHi * 0.06}` }}>
            <div style={{ fontFamily: m.font, fontWeight: 900, fontSize: m.u * (layout === 'row' ? 5 : 4.6) }}>{t}</div>
            {d && <div style={{ fontFamily: m.font, fontWeight: 500, fontSize: m.u * 3.2, opacity: 0.85, marginTop: m.u }}>{d}</div>}
          </div>
        );
      })}
    </Wrap>
  );
}

/** Browser window: URL types in, page skeleton loads, a region gets a highlight box, cursor clicks. */
export function browser(m: Motion): ReactElement {
  const url = m.str('url', 'www.example.com/report');
  const W = m.w * 0.86;
  const H = m.h * (m.portrait ? 0.5 : 0.7);
  const k = m.at(0, 0.5, 'back');
  const typed = url.slice(0, Math.floor(clamp01(m.at(0.4, 1.0, 'linear')) * url.length));
  const kLoad = m.at(1.5, 0.8);
  const kHi = m.at(2.4, 0.6, 'easeInOut');
  const r = rng(5);
  return (
    <Wrap m={m}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: W, height: H, transform: `translate(-50%,-50%) scale(${0.85 + 0.15 * k})`, opacity: clamp01(k * 2), background: '#fff', borderRadius: m.u * 1.6, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,.45)' }}>
        <div style={{ height: m.u * 7, background: '#E9ECEF', display: 'flex', alignItems: 'center', gap: m.u, padding: `0 ${m.u * 2}px` }}>
          {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => <span key={c} style={{ width: m.u * 1.8, height: m.u * 1.8, borderRadius: '50%', background: c }} />)}
          <div style={{ flex: 1, marginLeft: m.u * 2, background: '#fff', borderRadius: m.u * 3, height: m.u * 4.4, display: 'flex', alignItems: 'center', padding: `0 ${m.u * 2}px`, fontFamily: FONTS.sans, fontSize: m.u * 2.6, color: '#333' }}>
            🔒 {typed}
            <span style={{ opacity: Math.floor(m.t * 2) % 2 ? 1 : 0 }}>|</span>
          </div>
        </div>
        <div style={{ padding: m.u * 4, opacity: kLoad }}>
          <div style={{ fontFamily: FONTS.serif, fontWeight: 800, fontSize: m.u * 5, color: '#111', marginBottom: m.u * 2 }}>{m.str('text', 'Annual Report 2025')}</div>
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} style={{ position: 'relative', height: m.u * 2, width: `${r.range(60, 98)}%`, background: '#DDE1E6', borderRadius: m.u, marginBottom: m.u * 1.6 }}>
              {i === m.num('highlightLine', 3) && <div style={{ position: 'absolute', inset: -m.u, border: `${m.u * 0.5}px solid ${m.str('accent', '#E63946')}`, borderRadius: m.u, clipPath: `inset(0 ${(1 - kHi) * 100}% 0 0)` }} />}
            </div>
          ))}
        </div>
      </div>
    </Wrap>
  );
}

/** Search investigation: search bar, query types, results drop in, one gets selected. */
export function search(m: Motion): ReactElement {
  const q = m.str('query', 'why are fireflies disappearing');
  const results = items(m.str('results'), 'Light pollution is confusing fireflies; Pesticides harm larvae; Habitat loss near rivers');
  const typed = q.slice(0, Math.floor(clamp01(m.at(0.3, 1.2, 'linear')) * q.length));
  const sel = m.num('select', 1);
  const W = m.w * 0.84;
  return (
    <Wrap m={m}>
      <div style={{ position: 'absolute', left: '50%', top: m.h * 0.25, width: W, transform: 'translateX(-50%)' }}>
        <div style={{ background: '#fff', borderRadius: m.u * 6, padding: `${m.u * 2.4}px ${m.u * 4}px`, fontFamily: FONTS.sans, fontSize: m.u * 3.6, color: '#222', boxShadow: '0 12px 30px rgba(0,0,0,.35)', ...enter('down', m.at(0, 0.5), 40) }}>
          🔍 {typed}
          <span style={{ opacity: Math.floor(m.t * 2) % 2 ? 1 : 0 }}>|</span>
        </div>
        <div style={{ marginTop: m.u * 3 }}>
          {results.map((r, i) => {
            const k = m.at(1.7 + i * 0.25, 0.4);
            const isSel = i + 1 === sel && m.at(1.7 + results.length * 0.25 + 0.3, 0.3) > 0.5;
            return (
              <div key={i} style={{ background: isSel ? m.str('accent', '#F9D84A') : 'rgba(255,255,255,.95)', borderRadius: m.u * 1.4, padding: m.u * 2.4, marginBottom: m.u * 1.6, fontFamily: FONTS.sans, ...enter('up', k, 30), transform: `${isSel ? 'scale(1.03)' : ''}` }}>
                <div style={{ fontSize: m.u * 2.2, color: '#1A7F37' }}>www.source{i + 1}.org</div>
                <div style={{ fontSize: m.u * 3.4, color: '#1A0DAB', fontWeight: 700 }}>{r}</div>
              </div>
            );
          })}
        </div>
      </div>
    </Wrap>
  );
}

/** Phone chat: messages ("A: text; B: text") pop in as bubbles, typing dots before each. */
export function chat(m: Motion): ReactElement {
  const msgs = items(m.str('messages'), 'A: Did you see the news?; B: About the fireflies?; A: They came back!; B: 😮').map((s) => {
    const [who, text] = pair(s);
    return { me: /^b$/i.test(who) || who.toLowerCase() === 'me', text };
  });
  const W = Math.min(m.w * 0.62, m.h * 0.36);
  const H = W * 2;
  const k = m.at(0, 0.5, 'back');
  const step = m.num('stagger', 0.8);
  return (
    <Wrap m={m}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: W, height: H, transform: `translate(-50%,-50%) scale(${0.8 + 0.2 * k})`, opacity: clamp01(k * 2), background: '#111', borderRadius: W * 0.12, padding: W * 0.04, boxShadow: '0 30px 70px rgba(0,0,0,.5)' }}>
        <div style={{ width: '100%', height: '100%', background: '#ECE5DD', borderRadius: W * 0.09, padding: W * 0.05, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: W * 0.03, overflow: 'hidden' }}>
          {msgs.map((g, i) => {
            const t0 = 0.5 + i * step;
            const typing = m.t > t0 - 0.45 && m.t < t0;
            const kk = m.at(t0, 0.35, 'back');
            if (m.t < t0 - 0.45) return null;
            return (
              <div key={i} style={{ alignSelf: g.me ? 'flex-end' : 'flex-start', maxWidth: '78%', background: g.me ? '#DCF8C6' : '#fff', borderRadius: W * 0.04, padding: `${W * 0.025}px ${W * 0.04}px`, fontFamily: FONTS.sans, fontSize: W * 0.055, color: '#111', boxShadow: '0 1px 1px rgba(0,0,0,.15)', transform: `scale(${typing ? 1 : kk})`, transformOrigin: g.me ? 'right bottom' : 'left bottom' }}>
                {typing ? '• • •' : g.text}
              </div>
            );
          })}
        </div>
      </div>
    </Wrap>
  );
}

/** Social post: card with avatar, handle, text; likes and comments count up; a comment highlights. */
export function socialPost(m: Motion): ReactElement {
  const W = Math.min(m.w * 0.84, m.h * 0.5);
  const k = m.at(0, 0.5, 'back');
  const likes = m.num('likes', 128000) * clamp01(m.at(0.8, 1.6, 'expo'));
  const comments = m.num('comments', 4200) * clamp01(m.at(1.0, 1.6, 'expo'));
  return (
    <Wrap m={m}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: W, transform: `translate(-50%,-50%) scale(${0.85 + 0.15 * k})`, opacity: clamp01(k * 2), background: '#fff', borderRadius: W * 0.04, padding: W * 0.05, fontFamily: FONTS.sans, color: '#111', boxShadow: '0 24px 60px rgba(0,0,0,.45)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: W * 0.03 }}>
          <div style={{ width: W * 0.12, height: W * 0.12, borderRadius: '50%', background: m.str('accent', '#2A6FDB') }} />
          <div>
            <div style={{ fontWeight: 800, fontSize: W * 0.045 }}>{m.str('name', 'Daily Explainer')}</div>
            <div style={{ fontSize: W * 0.035, color: '#666' }}>{m.str('handle', '@dailyexplainer')}</div>
          </div>
        </div>
        <div style={{ fontSize: W * 0.05, margin: `${W * 0.04}px 0`, lineHeight: 1.35 }}>{m.str('text', 'This one chart explains the whole economy 👇')}</div>
        <div style={{ height: W * 0.45, borderRadius: W * 0.03, background: 'linear-gradient(135deg,#dfe7f1,#b8c9de)' }} />
        <div style={{ display: 'flex', gap: W * 0.08, marginTop: W * 0.04, fontSize: W * 0.045, fontWeight: 700 }}>
          <span>❤️ {formatNumber(likes, { grouping: 'intl' })}</span>
          <span>💬 {formatNumber(comments, { grouping: 'intl' })}</span>
        </div>
        {m.str('comment') && (
          <div style={{ marginTop: W * 0.04, background: '#FFF4C2', borderLeft: `${W * 0.012}px solid #F9D84A`, padding: W * 0.03, fontSize: W * 0.042, ...enter('up', m.at(2.4, 0.5), 20) }}>{m.str('comment')}</div>
        )}
      </div>
    </Wrap>
  );
}

/** Newspaper: page slides in, camera zooms to the headline, a phrase is highlighted. */
export function newspaper(m: Motion): ReactElement {
  const k = m.at(0, 0.6);
  const z = 1 + m.num('zoomTo', m.portrait ? 0.12 : 0.7) * m.at(0.8, 1.6, 'easeInOut');
  const kH = m.at(2.2, 0.7, 'easeInOut');
  const head = m.str('text', 'Fireflies return to the river after 20 years');
  const hl = m.str('highlight', 'after 20 years');
  const i = head.toLowerCase().indexOf(hl.toLowerCase());
  const W = m.w * (m.portrait ? 0.86 : 0.9);
  const r = rng(7);
  return (
    <Wrap m={m} style={{ overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: '50%', top: '50%', width: W, transform: `translate(-50%,-50%) translateY(${(1 - k) * m.h}px) rotate(${-1.5 * (1 - (z - 1))}deg) scale(${z})`, transformOrigin: '50% 30%', background: '#F4F0E6', padding: W * 0.04, boxShadow: '0 20px 50px rgba(0,0,0,.45)', color: '#111' }}>
        <div style={{ textAlign: 'center', fontFamily: FONTS.serif, fontWeight: 900, fontSize: W * 0.07, borderBottom: '3px double #111', paddingBottom: W * 0.01 }}>{m.str('masthead', 'The Daily Chronicle')}</div>
        <div style={{ fontFamily: FONTS.serif, fontWeight: 900, fontSize: W * 0.065, lineHeight: 1.1, margin: `${W * 0.03}px 0` }}>
          {i < 0 ? head : (
            <>
              {head.slice(0, i)}
              <span style={sweep(kH, m.str('accent', '#F9D84A'))}>{head.slice(i, i + hl.length)}</span>
              {head.slice(i + hl.length)}
            </>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: W * 0.02 }}>
          {Array.from({ length: 3 }, (_, c) => (
            <div key={c}>{Array.from({ length: 9 }, (_, l) => <div key={l} style={{ height: W * 0.008, width: `${r.range(75, 100)}%`, background: '#9B958A', marginBottom: W * 0.012 }} />)}</div>
          ))}
        </div>
      </div>
    </Wrap>
  );
}

/** Evidence board: pinned cards appear, red strings draw between them. */
export function evidenceBoard(m: Motion): ReactElement {
  const list = items(m.str('items'), 'Suspect|Seen at 9 pm; Witness|Heard a crash; Receipt|Paid ₹4,200; CCTV|Gap of 12 min');
  const n = list.length;
  const r = rng(m.num('seed', 3));
  const pos = list.map((_, i) => [m.w * (0.22 + (i % 2) * 0.5 + r.range(-0.05, 0.05)), m.h * (0.28 + Math.floor(i / 2) * (0.34 / Math.max(1, Math.ceil(n / 2) - 1 || 1)) + r.range(-0.03, 0.03))] as [number, number]);
  const cw = m.w * 0.34;
  return (
    <Wrap m={m} style={{ background: m.str('bg', '#6B4F35') }}>
      <svg width={m.w} height={m.h} style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
        {pos.slice(1).map((p, i) => (
          <Draw key={i} d={`M${pos[i][0]} ${pos[i][1] - m.u * 6} Q${(pos[i][0] + p[0]) / 2} ${(pos[i][1] + p[1]) / 2 + m.u * 6} ${p[0]} ${p[1] - m.u * 6}`} k={m.at(0.6 + n * 0.3 + i * 0.35, 0.5)} stroke="#D62828" width={m.u * 0.5} />
        ))}
      </svg>
      {list.map((s, i) => {
        const [t, d] = pair(s);
        const k = m.at(0.2 + i * 0.3, 0.45, 'back');
        return (
          <div key={i} style={{ position: 'absolute', left: pos[i][0], top: pos[i][1], width: cw, transform: `translate(-50%,-50%) rotate(${r.range(-5, 5)}deg) scale(${Math.max(0, k)})`, background: '#FBF7EE', padding: m.u * 2.4, boxShadow: '0 10px 20px rgba(0,0,0,.4)', fontFamily: FONTS.marker, color: '#222' }}>
            <div style={{ position: 'absolute', left: '50%', top: -m.u * 1.4, width: m.u * 3, height: m.u * 3, borderRadius: '50%', background: '#D62828', transform: 'translateX(-50%)', boxShadow: '0 2px 3px rgba(0,0,0,.4)' }} />
            <div style={{ fontWeight: 900, fontSize: m.u * 4 }}>{t}</div>
            <div style={{ fontSize: m.u * 3 }}>{d}</div>
          </div>
        );
      })}
    </Wrap>
  );
}

/** Myth vs fact: myth card gets crossed out (red ✕), fact card slides in with a green ✓. */
export function mythFact(m: Motion): ReactElement {
  const kM = m.at(0, 0.5, 'back');
  const kX = m.at(1.0, 0.5, 'easeInOut');
  const kF = m.at(1.7, 0.5, 'back');
  const kC = m.at(2.3, 0.4, 'easeInOut');
  const card = (label: string, text: string, col: string, k: number, top: number): ReactElement => (
    <div style={{ position: 'absolute', left: m.w * 0.08, right: m.w * 0.08, top, background: '#fff', borderRadius: m.u * 2, padding: m.u * 4, borderTop: `${m.u * 1.2}px solid ${col}`, transform: `scale(${Math.max(0, k)})`, boxShadow: '0 14px 34px rgba(0,0,0,.35)' }}>
      <div style={{ fontFamily: FONTS.sans, fontWeight: 900, letterSpacing: '0.14em', fontSize: m.u * 3.4, color: col }}>{label}</div>
      <div style={{ fontFamily: m.font, fontWeight: 700, fontSize: m.u * 5, color: '#1D1D1B', marginTop: m.u }}>{text}</div>
    </div>
  );
  const myTop = m.h * (m.portrait ? 0.22 : 0.12);
  const fTop = m.h * (m.portrait ? 0.52 : 0.52);
  return (
    <Wrap m={m}>
      {card(m.str('labelA', 'MYTH'), m.str('textA', 'Fireflies only live in jungles'), '#E63946', kM, myTop)}
      <svg width={m.w} height={m.h} style={{ position: 'absolute', inset: 0 }}>
        <Draw d={`M${m.w * 0.8} ${myTop + m.u * 2} L${m.w * 0.92} ${myTop + m.u * 14}`} k={kX} stroke="#E63946" width={m.u * 1.4} />
        <Draw d={`M${m.w * 0.92} ${myTop + m.u * 2} L${m.w * 0.8} ${myTop + m.u * 14}`} k={m.at(1.25, 0.4)} stroke="#E63946" width={m.u * 1.4} />
      </svg>
      {card(m.str('labelB', 'FACT'), m.str('textB', 'They thrive near rivers, fields and even villages'), '#2A9D8F', kF, fTop)}
      <svg width={m.w} height={m.h} style={{ position: 'absolute', inset: 0 }}>
        <Draw d={`M${m.w * 0.8} ${fTop + m.u * 8} L${m.w * 0.84} ${fTop + m.u * 12} L${m.w * 0.92} ${fTop + m.u * 3}`} k={kC} stroke="#2A9D8F" width={m.u * 1.4} />
      </svg>
    </Wrap>
  );
}

// ================================================================ diagrams
/** Timeline ("1947:Independence; 1991:Reforms; …"): line draws, nodes pop, labels, big year counter, last highlighted. */
export function timeline(m: Motion): ReactElement {
  const ev = items(m.str('events'), '1947|Independence; 1969|Moon landing; 1991|Economic reforms; 2023|Chandrayaan-3').map(pair);
  const vertical = m.str('orientation', m.portrait ? 'vertical' : 'horizontal') === 'vertical';
  const n = ev.length;
  const a = vertical ? m.h * 0.2 : m.w * 0.1;
  const b = vertical ? m.h * 0.85 : m.w * 0.9;
  const line = vertical ? m.w * 0.22 : m.h * 0.55;
  const step = m.num('stagger', Math.max(0.5, (m.D - 1.5) / n));
  const kLine = m.at(0.1, 0.6 + n * step * 0.6, 'linear');
  const pos = (i: number) => lerp(a, b, n > 1 ? i / (n - 1) : 0.5);
  const active = Math.min(n - 1, Math.max(0, Math.floor((m.t - 0.4) / step)));
  const years = ev.map((e) => Number(e[0].replace(/[^\d.-]/g, '')));
  const yearShown = Number.isFinite(years[active]) ? Math.round(lerp(years[Math.max(0, active - 1)] ?? years[active], years[active], clamp01((m.t - 0.4 - active * step) / 0.5))) : null;
  return (
    <Wrap m={m}>
      <svg width={m.w} height={m.h} style={{ position: 'absolute', inset: 0 }}>
        <Draw d={vertical ? `M${line} ${a} L${line} ${b}` : `M${a} ${line} L${b} ${line}`} k={kLine} stroke={m.color} width={m.u * 0.6} />
        {ev.map((_, i) => {
          const k = m.at(0.4 + i * step, 0.4, 'back');
          const last = i === n - 1;
          const x = vertical ? line : pos(i);
          const y = vertical ? pos(i) : line;
          return (
            <g key={i}>
              {last && k > 0 && <circle cx={x} cy={y} r={m.u * (3 + Math.sin(m.t * 5) * 0.8)} fill={m.accent} opacity={0.3} />}
              <circle cx={x} cy={y} r={m.u * 1.8 * Math.max(0, k)} fill={i <= active ? m.accent : m.color} stroke="#000" strokeWidth={1} />
            </g>
          );
        })}
      </svg>
      {ev.map(([year, label], i) => {
        const k = m.at(0.5 + i * step, 0.45);
        const edge = i === 0 ? 'first' : i === n - 1 ? 'last' : 'mid';
        const style: CSSProperties = vertical
          ? { left: line + m.u * 5, top: pos(i), transform: 'translateY(-50%)' }
          : { left: pos(i), top: line + (i % 2 ? m.u * 4 : -m.u * 16), transform: edge === 'first' ? 'translateX(-12%)' : edge === 'last' ? 'translateX(-88%)' : 'translateX(-50%)', textAlign: edge === 'first' ? 'left' : edge === 'last' ? 'right' : 'center', width: Math.min(m.w / n + m.u * 6, m.w * 0.36) };
        return (
          <div key={i} style={{ position: 'absolute', ...style }}>
            <div style={enter(vertical ? 'left' : 'up', k, 20)}>
            <div style={{ fontFamily: FONTS.impact, fontSize: m.u * 5, color: i === active ? m.accent : m.color }}>{year}</div>
            <div style={{ fontFamily: m.font, fontWeight: 700, fontSize: m.u * (m.portrait && !vertical ? 2.6 : 3.2), color: m.color, opacity: 0.9, overflowWrap: 'anywhere' }}>{label}</div>
            </div>
          </div>
        );
      })}
      {m.bool('bigYear', !vertical) && yearShown !== null && m.t > 0.4 && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: m.h * 0.1, textAlign: 'center', fontFamily: FONTS.impact, fontSize: m.u * 16, color: m.color, opacity: 0.18 }}>{yearShown}</div>
      )}
    </Wrap>
  );
}

/** Process flow ("Idea; Build; Launch"): linear (row/column) or circular cycle; arrows draw; the active step glows. */
export function flow(m: Motion): ReactElement {
  const steps = items(m.str('steps'), 'Collect; Clean; Analyse; Share');
  const n = steps.length;
  const cyc = m.str('layout', 'linear') === 'cycle';
  const vertical = !cyc && m.portrait;
  const step = m.num('stagger', Math.max(0.45, (m.D - 1) / (n + 1)));
  const nodeW = cyc ? m.u * 22 : vertical ? m.w * 0.6 : (m.w * 0.8) / n - m.u * 4;
  const nodeH = m.u * 11;
  const centres = steps.map((_, i) => {
    if (cyc) {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
      const R = Math.min(m.w, m.h) * 0.3;
      return [m.w / 2 + Math.cos(a) * R, m.h / 2 + Math.sin(a) * R] as [number, number];
    }
    return vertical ? ([m.w / 2, lerp(m.h * 0.2, m.h * 0.82, n > 1 ? i / (n - 1) : 0.5)] as [number, number]) : ([lerp(m.w * 0.12 + nodeW / 2, m.w * 0.88 - nodeW / 2, n > 1 ? i / (n - 1) : 0.5), m.h / 2] as [number, number]);
  });
  const active = Math.floor((m.t - 0.3) / step) % (cyc ? n : n + 99);
  return (
    <Wrap m={m}>
      <svg width={m.w} height={m.h} style={{ position: 'absolute', inset: 0 }}>
        {centres.map((c, i) => {
          if (!cyc && i === n - 1) return null;
          const nx = centres[(i + 1) % n];
          const off = cyc ? 0.32 : 0;
          const a: [number, number] = cyc ? [lerp(c[0], nx[0], off), lerp(c[1], nx[1], off)] : vertical ? [c[0], c[1] + nodeH / 2 + m.u] : [c[0] + nodeW / 2 + m.u, c[1]];
          const b: [number, number] = cyc ? [lerp(c[0], nx[0], 1 - off), lerp(c[1], nx[1], 1 - off)] : vertical ? [nx[0], nx[1] - nodeH / 2 - m.u] : [nx[0] - nodeW / 2 - m.u, nx[1]];
          const { shaft, head } = arrowPaths(a, b, cyc ? 0.2 : 0, m.u * 2.4);
          const k = m.at(0.3 + i * step + step * 0.5, step * 0.5, 'easeInOut');
          return (
            <g key={i}>
              <Draw d={shaft} k={k} stroke={m.color} width={m.u * 0.6} />
              <Draw d={head} k={m.at(0.3 + i * step + step, 0.2)} stroke={m.color} width={m.u * 0.6} />
            </g>
          );
        })}
      </svg>
      {steps.map((s, i) => {
        const k = m.at(0.3 + i * step, 0.4, 'back');
        const on = i === active;
        return (
          <div key={i} style={{ position: 'absolute', left: centres[i][0], top: centres[i][1], width: nodeW, height: nodeH, transform: `translate(-50%,-50%) scale(${Math.max(0, k) * (on ? 1.06 : 1)})`, background: on ? m.accent : '#fff', color: on ? m.ink : '#1D1D1B', borderRadius: m.u * 2, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontFamily: m.font, fontWeight: 800, fontSize: m.u * 3.6, boxShadow: on ? `0 0 ${m.u * 5}px ${m.accent}` : '0 8px 20px rgba(0,0,0,.3)', padding: m.u }}>
            <span style={{ fontFamily: FONTS.impact, marginRight: m.u * 1.5, opacity: 0.6 }}>{i + 1}</span>
            {s}
          </div>
        );
      })}
    </Wrap>
  );
}

/** Network: hub-and-spoke or ring of nodes; edges draw; pulses travel along edges; nodes breathe. */
export function network(m: Motion): ReactElement {
  const nodes = items(m.str('nodes'), 'You; Friend; Family; Work; School; Club; Online');
  const n = nodes.length;
  const cx = m.w / 2;
  const cy = m.h / 2;
  const R = Math.min(m.w, m.h) * 0.32;
  const pos = nodes.map((_, i) => (i === 0 ? [cx, cy] : [cx + Math.cos((i / (n - 1)) * Math.PI * 2) * R, cy + Math.sin((i / (n - 1)) * Math.PI * 2) * R]) as [number, number]);
  const mesh = m.bool('mesh', true);
  const edges: [number, number][] = pos.slice(1).map((_, i) => [0, i + 1]);
  if (mesh) for (let i = 1; i < n; i++) edges.push([i, i === n - 1 ? 1 : i + 1]);
  return (
    <Svg m={m}>
      {edges.map(([a, b], i) => {
        const k = m.at(0.4 + i * 0.12, 0.5, 'easeInOut');
        const t = (m.t * 0.8 + i * 0.37) % 1;
        return (
          <g key={i}>
            <Draw d={`M${pos[a][0]} ${pos[a][1]} L${pos[b][0]} ${pos[b][1]}`} k={k} stroke={m.color} width={m.u * 0.35} opacity={0.5} />
            {k >= 1 && <circle cx={lerp(pos[a][0], pos[b][0], t)} cy={lerp(pos[a][1], pos[b][1], t)} r={m.u * 0.9} fill={m.accent} />}
          </g>
        );
      })}
      {nodes.map((name, i) => {
        const k = m.at(0.1 + i * 0.12, 0.4, 'back');
        const r = m.u * (i === 0 ? 8 : 5) * (1 + Math.sin(m.t * 3 + i) * 0.04);
        return (
          <g key={i} transform={`translate(${pos[i][0]} ${pos[i][1]}) scale(${Math.max(0, k)})`}>
            <circle r={r} fill={i === 0 ? m.accent : '#fff'} stroke="#111" strokeWidth={2} />
            {i === 0 ? (
              <text textAnchor="middle" dominantBaseline="central" fontFamily={m.font} fontWeight={800} fontSize={Math.min(m.u * 3.4, (r * 1.7) / Math.max(1, name.length * 0.55))} fill="#111">{name}</text>
            ) : (
              <text y={r + m.u * 3} textAnchor="middle" fontFamily={m.font} fontWeight={800} fontSize={m.u * 2.8} fill={m.color} stroke="rgba(0,0,0,.6)" strokeWidth={m.u * 0.4} paintOrder="stroke">{name}</text>
            )}
          </g>
        );
      })}
    </Svg>
  );
}

/** Cause → effect → result chain with arrows and growing emphasis. */
export function causeEffect(m: Motion): ReactElement {
  const chain = items(m.str('steps'), 'More street lights; Fireflies get confused; Fewer fireflies');
  const labels = items(m.str('labels'), 'CAUSE; EFFECT; RESULT');
  return flowLike(m, chain, labels);
}

function flowLike(m: Motion, chain: string[], labels: string[]) {
  const n = chain.length;
  const step = Math.max(0.6, (m.D - 1) / n);
  const vertical = m.portrait;
  return (
    <Wrap m={m}>
      {chain.map((c, i) => {
        const k = m.at(0.2 + i * step, 0.5, 'back');
        const pos: CSSProperties = vertical ? { left: '10%', right: '10%', top: `${18 + i * (64 / n)}%` } : { top: '35%', left: `${6 + i * (88 / n)}%`, width: `${88 / n - 6}%` };
        return (
          <div key={i}>
            <div style={{ position: 'absolute', ...pos, background: i === n - 1 ? m.accent : '#fff', color: '#1D1D1B', borderRadius: m.u * 2, padding: m.u * 3, boxShadow: '0 12px 28px rgba(0,0,0,.35)', transform: `scale(${Math.max(0, k)})` }}>
              <div style={{ fontFamily: FONTS.sans, fontWeight: 900, letterSpacing: '0.14em', fontSize: m.u * 2.6, color: i === n - 1 ? '#1D1D1B' : '#E63946' }}>{labels[i] ?? ''}</div>
              <div style={{ fontFamily: m.font, fontWeight: 800, fontSize: m.u * 4.2 }}>{c}</div>
            </div>
            {i < n - 1 && (
              <div style={{ position: 'absolute', ...(vertical ? { left: '48%', top: `${18 + i * (64 / n) + 64 / n - 6}%` } : { top: '42%', left: `${6 + (i + 1) * (88 / n) - 5.5}%` }), fontFamily: FONTS.impact, fontSize: m.u * 8, color: m.color, opacity: m.at(0.2 + i * step + step * 0.6, 0.3), transform: vertical ? 'rotate(90deg)' : undefined }}>→</div>
            )}
          </div>
        );
      })}
    </Wrap>
  );
}

/** Tree / org chart: "Root>A,B; A>A1,A2; B>B1" — levels reveal top-down, connectors draw. */
export function tree(m: Motion): ReactElement {
  const spec = items(m.str('tree'), 'CEO>CTO,CFO,COO; CTO>Dev,Data; COO>Ops');
  const kids = new Map<string, string[]>();
  let root = '';
  for (const s of spec) {
    const [p, c] = s.split('>').map((x) => x.trim());
    if (!root) root = p;
    kids.set(p, (c ?? '').split(/\s*,\s*/).filter(Boolean));
  }
  const levels: string[][] = [[root]];
  while (levels.length < 5) {
    const next = levels[levels.length - 1].flatMap((x) => kids.get(x) ?? []);
    if (!next.length) break;
    levels.push(next);
  }
  const pos = new Map<string, [number, number]>();
  levels.forEach((lv, li) => lv.forEach((name, i) => pos.set(`${li}:${name}`, [m.w * ((i + 1) / (lv.length + 1)), m.h * (0.2 + li * (0.6 / Math.max(1, levels.length - 1)))])));
  const step = 0.6;
  return (
    <Wrap m={m}>
      <svg width={m.w} height={m.h} style={{ position: 'absolute', inset: 0 }}>
        {levels.slice(1).map((lv, li) =>
          lv.map((name, i) => {
            const parent = levels[li].find((p) => (kids.get(p) ?? []).includes(name)) ?? root;
            const a = pos.get(`${li}:${parent}`) as [number, number];
            const b = pos.get(`${li + 1}:${name}`) as [number, number];
            const midY = (a[1] + b[1]) / 2;
            return <Draw key={`${li}${i}`} d={`M${a[0]} ${a[1]} L${a[0]} ${midY} L${b[0]} ${midY} L${b[0]} ${b[1]}`} k={m.at(0.3 + (li + 0.5) * step, step * 0.8, 'easeInOut')} stroke={m.color} width={m.u * 0.4} />;
          }),
        )}
      </svg>
      {levels.map((lv, li) =>
        lv.map((name) => {
          const p = pos.get(`${li}:${name}`) as [number, number];
          const k = m.at(0.2 + li * step, 0.4, 'back');
          return (
            <div key={`${li}:${name}`} style={{ position: 'absolute', left: p[0], top: p[1], transform: `translate(-50%,-50%) scale(${Math.max(0, k)})`, background: li === 0 ? m.accent : '#fff', color: '#1D1D1B', borderRadius: m.u * 1.4, padding: `${m.u * 1.4}px ${m.u * 2.6}px`, fontFamily: m.font, fontWeight: 800, fontSize: m.u * (li === 0 ? 4 : 3.2), boxShadow: '0 8px 18px rgba(0,0,0,.3)', whiteSpace: 'nowrap' }}>{name}</div>
          );
        }),
      )}
    </Wrap>
  );
}

void Svg;
