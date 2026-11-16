/**
 * Motion-graphics templates. Each is a Remotion component that animates over its own Sequence
 * (frame 0 = item start). Props are plain strings/numbers so the editor inspector and the LLM can set them.
 */
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { TemplateId } from '../editor/types.ts';
import { BRAND } from '../editor/types.ts';
import { BarChart, Callout, MarkerHighlight, PaperTitle, Stat } from './voxTemplates.tsx';
import { ArtBanner, ArtCard, ArtFrame } from './artStyles.tsx';

type P = Record<string, string | number | boolean>;
const FONT = '"Arial Black", "Segoe UI", Arial, Helvetica, sans-serif';
const s = (v: unknown, d = '') => (v === undefined || v === null ? d : String(v));
const n = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);

/** Fade/slide out over the last 8 frames of the item. */
function useOut() {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
}

function Title({ props }: { props: P }) {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 14, stiffness: 120 } });
  const out = useOut();
  const words = s(props.text, 'Your title').split(' ');
  const size = n(props.size, 1) * width * 0.085;
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: out }}>
      <div style={{ maxWidth: '86%', textAlign: 'center', fontFamily: FONT, fontSize: size, lineHeight: 1.05, color: s(props.color, '#fff') }}>
        {words.map((w, i) => {
          const p = spring({ frame: frame - i * 3, fps, config: { damping: 12 } });
          return (
            <span key={i} style={{ display: 'inline-block', margin: '0 0.12em', transform: `translateY(${(1 - p) * 60}px) scale(${0.8 + 0.2 * p})`, opacity: p, textShadow: '0 8px 30px rgba(0,0,0,.6)' }}>
              {w}
            </span>
          );
        })}
      </div>
      {s(props.subtitle) && (
        <div style={{ marginTop: size * 0.35, fontFamily: FONT, fontSize: size * 0.32, color: s(props.accent, BRAND.mint), opacity: enter, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {s(props.subtitle)}
        </div>
      )}
    </AbsoluteFill>
  );
}

function Hook({ props }: { props: P }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const p = spring({ frame, fps, config: { damping: 13, stiffness: 140 } });
  const out = useOut();
  const fs = width * 0.05;
  return (
    <AbsoluteFill style={{ alignItems: 'center', paddingTop: height * (height > width ? 0.11 : 0.06), opacity: out }}>
      <div
        style={{
          maxWidth: '84%',
          background: s(props.bg, '#fff'),
          color: s(props.color, '#000'),
          fontFamily: FONT,
          fontSize: fs,
          lineHeight: 1.2,
          textAlign: 'center',
          padding: `${fs * 0.4}px ${fs * 0.6}px`,
          borderRadius: fs * 0.35,
          borderBottom: `${fs * 0.16}px solid ${s(props.accent, BRAND.mint)}`,
          boxShadow: '0 14px 50px rgba(0,0,0,.45)',
          transform: `translateY(${(1 - p) * -80}px) scale(${0.85 + 0.15 * p})`,
          opacity: p,
        }}
      >
        {s(props.text, 'Wait for it…')}
      </div>
    </AbsoluteFill>
  );
}

function LowerThird({ props }: { props: P }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const p = spring({ frame, fps, config: { damping: 16 } });
  const p2 = spring({ frame: frame - 5, fps, config: { damping: 16 } });
  const out = useOut();
  const fs = width * (height > width ? 0.048 : 0.03);
  const accent = s(props.accent, BRAND.mint);
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', padding: `0 ${width * 0.06}px ${height * (height > width ? 0.3 : 0.12)}px`, opacity: out }}>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: fs * 0.35 }}>
        <div style={{ width: fs * 0.18, background: accent, borderRadius: 99, transform: `scaleY(${p})` }} />
        <div style={{ overflow: 'hidden' }}>
          <div style={{ fontFamily: FONT, fontSize: fs, color: '#fff', transform: `translateX(${(1 - p) * -110}%)`, textShadow: '0 4px 18px rgba(0,0,0,.7)' }}>
            {s(props.name, 'Sachin Choudhary')}
          </div>
          <div style={{ fontFamily: 'Segoe UI, Arial, sans-serif', fontWeight: 600, fontSize: fs * 0.55, color: accent, transform: `translateX(${(1 - p2) * -110}%)`, marginTop: fs * 0.1 }}>
            {s(props.role, 'Founder, BuzyBug')}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

function EmojiPop({ props }: { props: P }) {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const p = spring({ frame, fps, config: { damping: 7, stiffness: 180 } });
  const wobble = Math.sin(frame / 4) * 6 * Math.max(0, 1 - frame / (fps * 1.5));
  const out = useOut();
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: `${n(props.x, 75)}%`,
          top: `${n(props.y, 30)}%`,
          transform: `translate(-50%,-50%) scale(${p * n(props.size, 1)}) rotate(${wobble}deg)`,
          fontSize: width * 0.16,
          opacity: out,
          filter: 'drop-shadow(0 10px 20px rgba(0,0,0,.4))',
        }}
      >
        {s(props.emoji, '🔥')}
      </div>
    </AbsoluteFill>
  );
}

function ProgressBar({ props }: { props: P }) {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const pct = interpolate(frame, [0, durationInFrames - 1], [0, 100], { extrapolateRight: 'clamp' });
  const h = Math.max(8, height * 0.007);
  const top = s(props.position, 'top') === 'top';
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: 0, right: 0, [top ? 'top' : 'bottom']: 0, height: h, background: 'rgba(255,255,255,.18)' }}>
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${BRAND.mint}, ${BRAND.lavender}, ${BRAND.pink}, ${BRAND.peach})`,
            boxShadow: `0 0 ${width * 0.01}px ${BRAND.mint}`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
}

function Cta({ props }: { props: P }) {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const p = spring({ frame, fps, config: { damping: 12 } });
  const pulse = 1 + Math.sin(frame / 5) * 0.03;
  const fs = width * 0.07;
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', background: `rgba(0,0,0,${0.55 * p})` }}>
      <div style={{ fontFamily: FONT, color: '#fff', fontSize: fs, textAlign: 'center', maxWidth: '84%', transform: `scale(${0.7 + 0.3 * p})`, opacity: p }}>
        {s(props.text, 'Follow for more')}
      </div>
      <div
        style={{
          marginTop: fs * 0.5,
          background: s(props.accent, BRAND.mint),
          color: '#000',
          fontFamily: FONT,
          fontSize: fs * 0.42,
          padding: `${fs * 0.22}px ${fs * 0.6}px`,
          borderRadius: 999,
          transform: `scale(${p * pulse})`,
        }}
      >
        {s(props.button, '@yourhandle')}
      </div>
    </AbsoluteFill>
  );
}

function Quote({ props }: { props: P }) {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const p = spring({ frame, fps, config: { damping: 18 } });
  const out = useOut();
  const fs = width * 0.06;
  const text = s(props.text, 'Captions are not optional.');
  const chars = Math.round(interpolate(frame, [4, 4 + text.length * 1.2], [0, text.length], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.quad) }));
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', opacity: out }}>
      <div style={{ maxWidth: '82%', background: 'rgba(0,0,0,.62)', borderRadius: fs * 0.4, padding: fs * 0.7, transform: `translateY(${(1 - p) * 40}px)`, opacity: p, borderLeft: `${fs * 0.15}px solid ${s(props.accent, BRAND.lavender)}` }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: fs * 1.6, color: s(props.accent, BRAND.lavender), lineHeight: 0.6 }}>“</div>
        <div style={{ fontFamily: FONT, fontSize: fs, color: '#fff', lineHeight: 1.2 }}>{text.slice(0, chars)}</div>
        {s(props.author) && <div style={{ marginTop: fs * 0.4, fontFamily: 'Segoe UI, Arial', fontSize: fs * 0.45, color: '#ddd' }}>— {s(props.author)}</div>}
      </div>
    </AbsoluteFill>
  );
}

export const TEMPLATE_COMPONENTS: Record<TemplateId, (p: { props: P }) => React.ReactElement> = {
  title: Title,
  hook: Hook,
  lowerThird: LowerThird,
  emojiPop: EmojiPop,
  progressBar: ProgressBar,
  cta: Cta,
  quote: Quote,
  paperTitle: PaperTitle,
  markerHighlight: MarkerHighlight,
  stat: Stat,
  barChart: BarChart,
  callout: Callout,
  artCard: ArtCard,
  artFrame: ArtFrame,
  artBanner: ArtBanner,
};
