/**
 * Vox-style explainer graphics: paper textures, highlighter sweeps, counting stats,
 * growing bar charts and hand-drawn callouts. Pure Remotion + SVG, no external assets.
 */
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

type P = Record<string, string | number | boolean>;
const s = (v: unknown, d = '') => (v === undefined || v === null || v === '' ? d : String(v));
const n = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);
const SERIF = 'Georgia, "Times New Roman", serif';
const SANS = '"Segoe UI", Arial, Helvetica, sans-serif';
const PAPER = '#F3EEE3';
const INK = '#1B1B1B';

/** Subtle paper grain via SVG turbulence (renders identically in browser and headless Chrome). */
function Grain({ opacity = 0.18 }: { opacity?: number }) {
  return (
    <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity, mixBlendMode: 'multiply' }}>
      <filter id="cf-grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#cf-grain)" />
    </svg>
  );
}

function useOut() {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
}

/** Torn-paper collage title: paper card slides in, headline types, marker underline draws. */
export function PaperTitle({ props }: { props: P }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const p = spring({ frame, fps, config: { damping: 15 } });
  const out = useOut();
  const fs = width * (height > width ? 0.085 : 0.055);
  const under = interpolate(frame, [10, 28], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const accent = s(props.accent, '#F2C14E');
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: out }}>
      <div
        style={{
          position: 'relative',
          maxWidth: '84%',
          padding: `${fs * 0.55}px ${fs * 0.7}px`,
          background: PAPER,
          transform: `rotate(${n(props.tilt, -2)}deg) translateY(${(1 - p) * height * 0.3}px)`,
          boxShadow: '0 25px 60px rgba(0,0,0,.45)',
          clipPath: 'polygon(0 3%, 6% 0, 18% 2%, 33% 0, 51% 3%, 70% 0, 86% 2%, 100% 0, 99% 30%, 100% 62%, 98% 100%, 80% 97%, 61% 100%, 42% 97%, 22% 100%, 4% 97%, 1% 70%, 2% 35%)',
        }}
      >
        <Grain />
        {s(props.kicker) && (
          <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: fs * 0.3, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#9A3B26', marginBottom: fs * 0.2 }}>
            {s(props.kicker)}
          </div>
        )}
        <div style={{ position: 'relative', fontFamily: SERIF, fontWeight: 700, fontSize: fs, lineHeight: 1.05, color: INK }}>
          <span style={{ position: 'relative', zIndex: 1 }}>{s(props.text, 'Why this matters')}</span>
          <div style={{ position: 'absolute', left: -fs * 0.05, bottom: fs * 0.02, height: fs * 0.32, width: `${under * 100}%`, background: accent, opacity: 0.85, zIndex: 0, borderRadius: 4 }} />
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** Document excerpt on paper with a highlighter sweeping over the key phrase. */
export function MarkerHighlight({ props }: { props: P }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const p = spring({ frame, fps, config: { damping: 16 } });
  const out = useOut();
  const fs = width * (height > width ? 0.062 : 0.034);
  // explicit empty strings stay empty (only missing props fall back to the sample text)
  const before = props.before === undefined ? 'According to the report,' : String(props.before);
  const hl = s(props.highlight, '85% of viewers watch on mute');
  const after = props.after === undefined ? 'which changes how video must be made.' : String(props.after);
  const sweep = interpolate(frame, [12, 34], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad) });
  const color = s(props.color, '#FFE44D');
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: out }}>
      <div style={{ position: 'relative', width: '82%', background: PAPER, padding: fs * 1.1, transform: `rotate(1deg) scale(${0.9 + 0.1 * p})`, opacity: p, boxShadow: '0 30px 80px rgba(0,0,0,.5)' }}>
        <Grain />
        {s(props.source) && <div style={{ fontFamily: SANS, fontSize: fs * 0.5, color: '#666', marginBottom: fs * 0.5, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{s(props.source)}</div>}
        <div style={{ fontFamily: SERIF, fontSize: fs, lineHeight: 1.45, color: INK }}>
          {before}{' '}
          <span
            style={{
              backgroundImage: `linear-gradient(${color}, ${color})`,
              backgroundRepeat: 'no-repeat',
              backgroundSize: `${sweep}% 70%`,
              backgroundPosition: '0 85%',
              padding: '0 0.1em',
              boxDecorationBreak: 'clone',
              WebkitBoxDecorationBreak: 'clone',
              fontWeight: 700,
            }}
          >
            {hl}
          </span>{' '}
          {after}
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** Big number that counts up, with a label underneath. */
export function Stat({ props }: { props: P }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const out = useOut();
  const target = n(props.value, 85);
  const dec = String(props.value ?? '').includes('.') ? 1 : 0;
  const prog = interpolate(frame, [0, fps * 1.2], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const p = spring({ frame, fps, config: { damping: 14 } });
  const shown = `${s(props.prefix)}${target.toFixed(dec)}${s(props.suffix, '%')}`;
  // shrink long numbers/suffixes so they always fit on one line
  // fit the number to 85% of the frame width (bold serif digits ≈ 0.62 em wide)
  const fs = Math.min(width * (height > width ? 0.26 : 0.16), (width * 0.85) / Math.max(1, shown.length * 0.62));
  const accent = s(props.accent, '#B5E2DD');
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: out }}>
      <div style={{ textAlign: 'center', transform: `scale(${0.85 + 0.15 * p})` }}>
        <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: fs, lineHeight: 1, color: accent, textShadow: '0 10px 40px rgba(0,0,0,.6)', whiteSpace: 'nowrap' }}>
          {s(props.prefix)}
          {(target * prog).toFixed(dec)}
          {s(props.suffix, '%')}
        </div>
        <div style={{ margin: `${width * 0.03}px auto 0`, fontFamily: SANS, fontWeight: 700, fontSize: width * (height > width ? 0.045 : 0.03), color: '#fff', maxWidth: width * 0.8, opacity: p, textShadow: '0 4px 16px rgba(0,0,0,.8)' }}>
          {s(props.label, 'of viewers watch on mute')}
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** Bars from "Label:value, Label:value" that grow one after another. */
export function BarChart({ props }: { props: P }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const out = useOut();
  const rows = s(props.data, 'TikTok:92, Reels:78, Shorts:64')
    .split(',')
    .map((r) => r.split(':'))
    .map(([label, v]) => ({ label: (label || '').trim(), value: n(v, 0) }))
    .filter((r) => r.label)
    .slice(0, 6);
  const max = Math.max(1, ...rows.map((r) => r.value));
  const fs = width * (height > width ? 0.042 : 0.026);
  const accent = s(props.accent, '#B5E2DD');
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: out }}>
      <div style={{ position: 'relative', width: '84%', background: PAPER, padding: fs * 1.2, boxShadow: '0 30px 80px rgba(0,0,0,.5)' }}>
        <Grain />
        {s(props.title) && <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: fs * 1.3, color: INK, marginBottom: fs * 0.8 }}>{s(props.title)}</div>}
        {rows.map((r, i) => {
          const g = spring({ frame: frame - 6 - i * 6, fps, config: { damping: 18 } });
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: fs * 0.5, marginBottom: fs * 0.5 }}>
              <div style={{ width: '28%', fontFamily: SANS, fontWeight: 700, fontSize: fs, color: INK, textAlign: 'right' }}>{r.label}</div>
              <div style={{ flex: 1, height: fs * 1.2, background: 'rgba(0,0,0,.06)' }}>
                <div style={{ height: '100%', width: `${(r.value / max) * 100 * g}%`, background: i === 0 ? accent : INK, opacity: i === 0 ? 1 : 0.8 }} />
              </div>
              <div style={{ width: fs * 2.6, fontFamily: SANS, fontWeight: 800, fontSize: fs, color: INK, opacity: g }}>
                {Math.round(r.value * g)}
                {s(props.unit)}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

/** Hand-drawn circle around a point, with an arrow and a label. */
export function Callout({ props }: { props: P }) {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const out = useOut();
  const x = (n(props.x, 50) / 100) * width;
  const y = (n(props.y, 40) / 100) * height;
  const r = width * 0.12 * n(props.size, 1);
  const draw = interpolate(frame, [0, 14], [1, 0], { extrapolateRight: 'clamp', easing: Easing.out(Easing.quad) });
  const arrow = interpolate(frame, [10, 22], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const label = spring({ frame: frame - 18, fps, config: { damping: 14 } });
  const color = s(props.color, '#FF5A36');
  const lx = x + r * 1.3;
  const ly = y + r * (y < height / 2 ? 1.6 : -1.6);
  const circ = 2 * Math.PI * r;
  const fs = width * 0.045;
  return (
    <AbsoluteFill style={{ opacity: out }}>
      <svg width={width} height={height} style={{ position: 'absolute', inset: 0 }}>
        <ellipse cx={x} cy={y} rx={r * 1.08} ry={r * 0.92} fill="none" stroke={color} strokeWidth={width * 0.008} strokeLinecap="round"
          strokeDasharray={circ * 1.1} strokeDashoffset={circ * 1.1 * draw} transform={`rotate(-8 ${x} ${y})`} />
        <path d={`M ${lx} ${ly} Q ${(lx + x) / 2 + r * 0.4} ${(ly + y) / 2} ${x + r * 0.75} ${y + (ly > y ? r * 0.75 : -r * 0.75)}`}
          fill="none" stroke={color} strokeWidth={width * 0.006} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={arrow} />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: Math.min(lx, width * 0.62),
          top: ly + (ly > y ? fs * 0.3 : -fs * 1.6),
          maxWidth: width * 0.36,
          background: color,
          color: '#fff',
          fontFamily: SANS,
          fontWeight: 800,
          fontSize: fs,
          padding: `${fs * 0.2}px ${fs * 0.4}px`,
          transform: `scale(${label}) rotate(-2deg)`,
          transformOrigin: 'left center',
        }}
      >
        {s(props.text, 'Look here')}
      </div>
    </AbsoluteFill>
  );
}
