/**
 * Nafay looks as motion-graphic renderers (see .claude/skills/nafay-motion):
 *   creator   – Creator Motion Graphics: near-black edit room, Anton caps that slam in, yellow swipe on the key word,
 *               green counters that lock with a flash, red strike and stamp for the wrong idea.
 *   chalk     – Chalk Talk: green slate in a wooden frame, everything chalked on in order, pink key numbers, yellow ticks.
 *   cleantech – Clean Tech: off-white dot grid, words rise into place, one blue accent, green checks for done.
 * Every renderer takes `look` and `backdrop` (full = draws the look's own background, none = overlay on the scene).
 * All motion is a pure function of the frame.
 */
import { useEffect, useState, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { continueRender, delayRender } from 'remotion';
import { clamp01, Draw, exitStyle, formatNumber, parseData, scribbleEllipse, type Motion } from '../core.tsx';
import { rng } from '../../vector/geom.ts';

type Look = 'creator' | 'chalk' | 'cleantech';
const lookOf = (m: Motion): Look => {
  const l = m.str('look', 'creator');
  return l === 'chalk' || l === 'cleantech' ? l : 'creator';
};

const NF = {
  anton: '"Anton", "Bebas Neue", Impact, sans-serif',
  serif: '"Instrument Serif", Georgia, serif',
  inter: '"Inter", "Segoe UI", system-ui, sans-serif',
  kalam: '"Kalam", "Segoe Print", "Comic Sans MS", cursive',
  sketch: '"Cabin Sketch", "Kalam", "Segoe Print", cursive',
  tight: '"Inter Tight", "Segoe UI", system-ui, sans-serif',
  mono: '"JetBrains Mono", Consolas, monospace',
};
const CR = { bg: '#09090a', ink: '#f4f1ea', dim: '#8e8d94', hi: '#ffd60a', money: '#3dff8f', red: '#ff3b30', dark: '#0b0b0c' };
const CH = { slate: '#24392f', ink: '#f2efe6', yellow: '#f4d35e', pink: '#f39bbb', blue: '#93cbef' };
const CT = { bg: '#f5f6f8', ink: '#0d0f14', mute: '#6b7280', faint: '#9aa1ad', line: '#e3e6ec', blue: '#2f5bff', blueSoft: '#e8edff', green: '#18b46b' };

// ---------------------------------------------------------------- fonts: load once, hold the render until they are in
const FONT_URL =
  'https://fonts.googleapis.com/css2?family=Anton&family=Instrument+Serif:ital@1&family=Inter:wght@600;700&family=Kalam:wght@400;700&family=Cabin+Sketch:wght@700&family=Inter+Tight:wght@600;800&family=JetBrains+Mono:wght@700&display=block';
let fontsReady: Promise<void> | null = null;
function loadFonts(): Promise<void> {
  if (fontsReady) return fontsReady;
  fontsReady = new Promise<void>((resolve) => {
    if (typeof document === 'undefined') return resolve();
    const faces = ['60px "Anton"', 'italic 60px "Instrument Serif"', '700 30px "Inter"', '700 40px "Kalam"', '700 60px "Cabin Sketch"', '800 40px "Inter Tight"', '700 20px "JetBrains Mono"'];
    const go = () => Promise.all(faces.map((f) => document.fonts.load(f))).then(() => resolve(), () => resolve());
    let link = document.querySelector<HTMLLinkElement>('link[data-nafay-fonts]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = FONT_URL;
      link.dataset.nafayFonts = '1';
      link.onload = go;
      link.onerror = () => resolve();
      document.head.appendChild(link);
    } else go();
    setTimeout(resolve, 6000); // offline: render with the fallbacks rather than hang
  });
  return fontsReady;
}
function FontGate({ children }: { children: ReactNode }) {
  const [handle] = useState(() => delayRender('Nafay fonts'));
  useEffect(() => {
    loadFonts().then(() => continueRender(handle));
  }, [handle]);
  return <>{children}</>;
}

// ---------------------------------------------------------------- shared bits
const out3 = (u: number) => 1 - Math.pow(1 - clamp01(u), 3);
const outExpo = (u: number) => (u >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp01(u)));
const back = (u: number, s = 1.9) => { const x = clamp01(u); return x >= 1 ? 1 : 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
const win = (t: number, a: number, d: number) => clamp01((t - a) / Math.max(0.001, d));

/** The one accent word: *starred* in the text, else the longest word of four or more letters. */
function splitKey(text: string): { words: string[]; key: number } {
  const toks = text.split(/\s+/).filter(Boolean);
  let key = toks.findIndex((w) => /\*/.test(w));
  const words = toks.map((w) => w.replace(/\*/g, ''));
  if (key < 0) {
    let len = 3;
    words.forEach((w, i) => { const n = w.replace(/[^\p{L}\p{N}]/gu, '').length; if (n > len) { len = n; key = i; } });
  }
  return { words, key };
}

function Backdrop({ m, look }: { m: Motion; look: Look }): ReactElement | null {
  if (m.str('backdrop', 'full') === 'none') return null;
  const u = m.u;
  if (look === 'creator') {
    const drift = (m.t * 8) % 80;
    return (
      <div style={{ position: 'absolute', inset: 0, background: CR.bg }}>
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at ${20 + Math.sin(m.t * 0.35) * 7}% 25%, rgba(255,214,10,.07), transparent 55%), radial-gradient(ellipse at 82% 78%, rgba(90,120,255,.07), transparent 55%)` }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(244,241,234,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(244,241,234,.035) 1px, transparent 1px)', backgroundSize: '80px 80px', backgroundPosition: `${-drift}px ${-drift / 2}px` }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,.55))' }} />
      </div>
    );
  }
  if (look === 'chalk') {
    return (
      <div style={{ position: 'absolute', inset: 0, background: CH.slate }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 28% 22%, rgba(255,250,230,.08), transparent 55%), radial-gradient(circle at 75% 70%, rgba(0,0,0,.2), transparent 50%), radial-gradient(circle at 15% 85%, rgba(215,228,218,.05), transparent 35%)' }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 2.4 * u, background: 'linear-gradient(#b07a45, #8a5a31)', boxShadow: '0 3px 6px rgba(0,0,0,.35)' }} />
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3.6 * u, background: 'linear-gradient(#9a6738, #5f3b1e)', boxShadow: '0 -3px 8px rgba(0,0,0,.3)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 45% 20%, transparent 40%, rgba(0,0,0,.3))' }} />
      </div>
    );
  }
  return (
    <div style={{ position: 'absolute', inset: 0, background: CT.bg }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 85% 8%, rgba(47,91,255,.11), transparent 50%), radial-gradient(circle at 12% 92%, rgba(24,180,107,.06), transparent 45%)' }} />
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(13,15,20,.085) 1.5px, transparent 1.8px)', backgroundSize: '32px 32px', backgroundPosition: `${-(m.t * 6) % 32}px 0` }} />
    </div>
  );
}

/** Full frame: backdrop + centred content with the effect's exit. With backdrop none, chalk and clean tech sit on a plate / card. */
function Frame({ m, look, children, plate = true }: { m: Motion; look: Look; children: ReactNode; plate?: boolean }) {
  const none = m.str('backdrop', 'full') === 'none';
  const u = m.u;
  const plateStyle: CSSProperties =
    none && plate && look === 'chalk'
      ? { background: CH.slate, border: `${1.1 * u}px solid #8a5a31`, borderRadius: 1.4 * u, padding: `${2 * u}px ${4 * u}px`, boxShadow: '0 12px 36px rgba(0,0,0,.5)' }
      : none && plate && look === 'cleantech'
        ? { background: '#fff', border: '1.5px solid rgba(13,15,20,.08)', borderRadius: 2.6 * u, padding: `${2.4 * u}px ${4 * u}px`, boxShadow: '0 16px 44px rgba(13,15,40,.2)' }
        : {};
  return (
    <FontGate>
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', ...exitStyle(m) }}>
        <Backdrop m={m} look={look} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: `${6 * u}px ${7 * u}px`, transform: `scale(${m.num('scale', 1)})` }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 * u, maxWidth: '100%', ...plateStyle }}>{children}</div>
        </div>
      </div>
    </FontGate>
  );
}

/** A word that comes in on its own time in the look's way; isKey gets the accent. */
type Strike = { k: number; color: string; glow: boolean };
const StrikeBand = ({ s }: { s?: Strike }) =>
  s && s.k > 0 ? <span style={{ position: 'absolute', left: '-0.08em', right: '-0.08em', top: '50%', height: '0.1em', marginTop: '-0.05em', background: s.color, borderRadius: 99, transform: `scaleX(${s.k}) rotate(-2deg)`, transformOrigin: '0 50%', boxShadow: s.glow ? `0 0 12px ${s.color}` : undefined }} /> : null;

function Word({ look, text, t0, t, isKey, dur, size, strike }: { look: Look; text: string; t0: number; t: number; isKey: boolean; dur: number; size: number; strike?: Strike }) {
  if (look === 'creator') {
    const u = win(t, t0, 0.2), e = outExpo(u), sw = out3(win(t, t0 + 0.12, 0.22));
    const s = 1.42 + (1 - 1.42) * e, blur = (1 - e) * 9;
    return (
      <span style={{ position: 'relative', display: 'inline-block', margin: '0 0.13em', opacity: Math.min(1, u * 3.5), transform: `scale(${s})`, filter: blur > 0.5 ? `blur(${blur.toFixed(1)}px)` : undefined }}>
        {isKey && <span style={{ position: 'absolute', left: '-0.1em', right: '-0.1em', top: '0.05em', bottom: '0.02em', background: CR.hi, transform: `scaleX(${sw}) skewX(-4deg)`, transformOrigin: '0 50%' }} />}
        <span style={{ position: 'relative', color: isKey && sw > 0.5 ? CR.dark : CR.ink }}>{text}</span>
        <StrikeBand s={strike} />
      </span>
    );
  }
  if (look === 'chalk') {
    const k = win(t, t0, dur), ul = out3(win(t, t0 + dur, 0.25));
    return (
      <span style={{ position: 'relative', display: 'inline-block', margin: '0 0.16em', clipPath: `inset(-30% ${(1 - k) * 100}% -30% 0)`, color: isKey ? CH.pink : CH.ink }}>
        {text}
        {isKey && <span style={{ position: 'absolute', left: 0, right: 0, bottom: '-0.02em', height: Math.max(4, size * 0.07), borderRadius: 99, background: CH.yellow, opacity: 0.9, transform: `scaleX(${ul})`, transformOrigin: '0 50%' }} />}
        <StrikeBand s={strike} />
      </span>
    );
  }
  const r = outExpo(win(t, t0, 0.5)), pill = outExpo(win(t, t0 + 0.18, 0.35));
  return (
    <span style={{ position: 'relative', display: 'inline-block', overflow: 'hidden', verticalAlign: 'bottom', padding: '0.02em 0.14em', margin: '0 0.01em' }}>
      {isKey && <span style={{ position: 'absolute', inset: '0.06em 0 0.02em 0', background: CT.blue, borderRadius: '0.26em', transform: `scaleX(${pill})`, transformOrigin: '0 50%' }} />}
      <span style={{ position: 'relative', display: 'inline-block', transform: `translateY(${(1 - r) * 110}%)`, color: isKey && pill > 0.6 ? '#fff' : CT.ink }}>{text}</span>
      <StrikeBand s={strike} />
    </span>
  );
}

/** Lays out a run of words with per-look timing; returns the element and when the last word has landed. */
function words(look: Look, text: string, start: number, t: number, size: number, stagger: number, strike?: (i: number) => Strike | undefined, noKey = false) {
  const split = splitKey(text), ws = split.words, key = noKey ? -1 : split.key;
  const cps = 16; // chalk writing speed, characters per second
  let cursor = start;
  const times = ws.map((w, i) => {
    if (look === 'chalk') { const t0 = cursor; cursor += (w.length + 1) / cps; return { t0, dur: w.length / cps }; }
    return { t0: start + i * stagger, dur: 0.3 };
  });
  const end = look === 'chalk' ? cursor : start + Math.max(0, ws.length - 1) * stagger + 0.3;
  const keyAt = key >= 0 ? times[key].t0 : -1;
  const el = (
    <span style={{ display: 'inline' }}>
      {ws.map((w, i) => <Word key={i} look={look} text={w} t0={times[i].t0} t={t} isKey={i === key} dur={times[i].dur} size={size} strike={strike?.(i)} />)}
    </span>
  );
  return { el, end, keyAt };
}

const textStyle = (look: Look, size: number, heading = true): CSSProperties =>
  look === 'creator'
    ? { fontFamily: NF.anton, fontSize: size, lineHeight: 1.04, textTransform: 'uppercase', letterSpacing: '0.01em', color: CR.ink, textAlign: 'center', textShadow: '0 6px 24px rgba(0,0,0,.6)' }
    : look === 'chalk'
      ? { fontFamily: heading ? NF.sketch : NF.kalam, fontWeight: 700, fontSize: size, lineHeight: 1.15, color: CH.ink, textAlign: 'center', textShadow: '0 0 2px rgba(242,239,230,.75), 0 0 10px rgba(242,239,230,.2)' }
      : { fontFamily: NF.tight, fontWeight: 800, fontSize: size, lineHeight: 1.12, letterSpacing: '-0.01em', color: CT.ink, textAlign: 'center' };

/** Small supporting line: Inter (creator), blue chalk note (chalk) or muted text (clean tech). */
function Sub({ look, text, k, size }: { look: Look; text: string; k: number; size: number }) {
  if (!text) return null;
  const st: CSSProperties =
    look === 'creator' ? { fontFamily: NF.inter, fontWeight: 600, color: CR.dim } : look === 'chalk' ? { fontFamily: NF.kalam, fontWeight: 400, color: CH.blue } : { fontFamily: NF.tight, fontWeight: 600, color: CT.mute };
  return <div style={{ ...st, fontSize: size, opacity: k, transform: `translateY(${(1 - k) * 0.4 * size}px)`, textAlign: 'center' }}>{text}</div>;
}
/** Small label above: Inter caps (creator), white chalk (chalk), mono caps in blue (clean tech). */
function Label({ look, text, k, size }: { look: Look; text: string; k: number; size: number }) {
  if (!text) return null;
  const st: CSSProperties =
    look === 'creator'
      ? { fontFamily: NF.inter, fontWeight: 700, color: CR.dim, letterSpacing: '0.18em', textTransform: 'uppercase' }
      : look === 'chalk'
        ? { fontFamily: NF.kalam, fontWeight: 700, color: CH.ink }
        : { fontFamily: NF.mono, fontWeight: 700, color: CT.blue, letterSpacing: '0.2em', textTransform: 'uppercase' };
  return <div style={{ ...st, fontSize: size, opacity: k }}>{text}</div>;
}

// ---------------------------------------------------------------- statement
export function nafayText(m: Motion): ReactElement {
  const look = lookOf(m), u = m.u, t = m.t;
  const size = m.num('size', look === 'creator' ? 13 : look === 'chalk' ? 10.5 : 9.5) * u;
  const stagger = m.num('stagger', look === 'creator' ? 0.2 : 0.12);
  const run = words(look, m.str('text', 'YOU NEED *REPS*'), 0.15, t, size, stagger);
  const punch = look === 'creator' && run.keyAt >= 0 && t > run.keyAt ? 0.05 * Math.exp(-(t - run.keyAt) * 2.6) : 0;
  return (
    <Frame m={m} look={look}>
      <Label look={look} text={m.str('label')} k={out3(win(t, 0, 0.3))} size={Math.max(3, size * 0.26)} />
      <div style={{ ...textStyle(look, size), transform: `scale(${1 + punch})` }}>{run.el}</div>
      <Sub look={look} text={m.str('sub')} k={out3(win(t, run.end + 0.15, 0.4))} size={Math.max(3.2 * u, size * 0.3)} />
    </Frame>
  );
}

// ---------------------------------------------------------------- counter
export function nafayCounter(m: Motion): ReactElement {
  const look = lookOf(m), u = m.u, t = m.t;
  const value = m.num('value', 200), dur = m.num('countDur', 1.2), t0 = 0.25, lock = t0 + dur;
  // chalk re-chalks the number ten times a second; the others roll smoothly
  const tc = look === 'chalk' ? Math.floor(Math.max(0, t - t0) * 10) / 10 + t0 : t;
  const shown = t >= lock ? value : value * out3(win(tc, t0, dur));
  const decimals = m.num('decimals', Number.isInteger(value) ? 0 : 1);
  const txt = formatNumber(shown, { decimals, grouping: m.str('grouping', 'intl') as 'intl', prefix: m.str('prefix'), suffix: m.str('suffix') });
  const size = m.num('size', look === 'creator' ? 26 : look === 'chalk' ? 20 : 22) * u;
  const age = t - lock, pop = age > 0 && age < 0.4 ? 1 + 0.14 * Math.sin((Math.PI * age) / 0.4) : 1;
  const numStyle: CSSProperties =
    look === 'creator'
      ? { fontFamily: NF.anton, color: CR.money, letterSpacing: '0.02em', textShadow: `0 0 ${(0.35 + 0.4 * (age > 0 ? Math.exp(-age * 2) : 0)) * 60}px rgba(61,255,143,.7)` }
      : look === 'chalk'
        ? { fontFamily: NF.sketch, fontWeight: 700, color: CH.pink, textShadow: '0 0 2px rgba(243,155,187,.7)', transform: `rotate(${(rng(Math.floor(tc * 10)).range(-1, 1) * 2).toFixed(2)}deg)` }
        : { fontFamily: NF.tight, fontWeight: 800, color: CT.blue, letterSpacing: '-0.02em' };
  const sparks = look === 'creator' && age > 0 && age < 0.9;
  const r = rng(11);
  return (
    <Frame m={m} look={look} plate={look !== 'creator'}>
      <Label look={look} text={m.str('label')} k={out3(win(t, 0, 0.3))} size={Math.max(3, look === 'chalk' ? 5 * u : 3.4 * u)} />
      <div style={{ position: 'relative', lineHeight: 1, fontSize: size, transform: `scale(${pop})`, opacity: win(t, t0 - 0.15, 0.15) }}>
        <span style={{ display: 'inline-block', ...numStyle }}>{txt}</span>
        {look === 'chalk' && age > 0.1 && (
          <svg style={{ position: 'absolute', left: '-12%', top: '-18%', width: '124%', height: '136%', overflow: 'visible' }} viewBox="0 0 100 100" preserveAspectRatio="none">
            <Draw d={scribbleEllipse(50, 50, 48, 46, 5)} k={out3(win(t, lock + 0.1, 0.4))} stroke={CH.pink} width={1.2} />
          </svg>
        )}
      </div>
      <Sub look={look} text={m.str('text')} k={out3(win(t, lock + 0.1, 0.4))} size={look === 'creator' ? 7 * u : 4.4 * u} />
      {sparks && (
        <svg style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }} width={m.w} height={m.h} viewBox={`0 0 ${m.w} ${m.h}`}>
          {Array.from({ length: 26 }, (_, i) => {
            const an = r() * Math.PI * 2, sp = (26 + r() * 26) * u, d0 = sp * out3(Math.min(1, age / 0.6)), len = 4.5 * u * (1 - age / 0.9);
            const cx = m.w / 2, cy = m.h / 2, a = 1 - age / 0.9;
            return <line key={i} x1={cx + Math.cos(an) * d0} y1={cy + Math.sin(an) * d0 * 0.7} x2={cx + Math.cos(an) * (d0 + len)} y2={cy + Math.sin(an) * (d0 + len) * 0.7} stroke={i % 3 ? `rgba(61,255,143,${a})` : `rgba(255,255,255,${a})`} strokeWidth={0.4 * u} strokeLinecap="round" />;
          })}
        </svg>
      )}
      {look === 'creator' && age > 0 && age < 0.4 && <div style={{ position: 'absolute', inset: -2000, background: `rgba(255,255,255,${0.5 * Math.exp(-age * 11)})`, pointerEvents: 'none' }} />}
    </Frame>
  );
}

// ---------------------------------------------------------------- the wrong idea
export function nafayWrong(m: Motion): ReactElement {
  const look = lookOf(m), u = m.u, t = m.t;
  const size = m.num('size', look === 'creator' ? 11 : 9) * u;
  const text = m.str('text', 'WAITING UNTIL YOU ARE READY?').replace(/\*/g, '');
  const stagger = look === 'creator' ? 0.14 : 0.1;
  const plan = words(look, text, 0.1, t, size, stagger, undefined, true);
  const strikeAt = plan.end + 0.25, n = text.split(/\s+/).filter(Boolean).length;
  const col = look === 'creator' ? CR.red : look === 'chalk' ? CH.pink : CT.mute;
  const run = words(look, text, 0.1, t, size, stagger, (i) => ({ k: out3(win(t, strikeAt + (i / Math.max(1, n)) * 0.3, 0.12)), color: col, glow: look === 'creator' }), true);
  const struck = win(t, strikeAt, 0.3);
  const stampAt = strikeAt + 0.45, su = win(t, stampAt, 0.13);
  const stamp = look === 'creator' ? m.str('stamp', 'NO.') : '';
  return (
    <Frame m={m} look={look}>
      {look === 'creator' && <div style={{ position: 'absolute', inset: -2000, background: `radial-gradient(circle at center, rgba(255,40,30,${0.16 * win(t, 0, 0.3)}), transparent 45%)`, pointerEvents: 'none' }} />}
      <div style={{ ...textStyle(look, size), opacity: 1 - 0.4 * struck }}>{run.el}</div>
      <Sub look={look} text={m.str('sub')} k={out3(win(t, stampAt + 0.3, 0.4))} size={look === 'creator' ? 6 * u : 4.4 * u} />
      {stamp && su > 0 && (
        <div style={{ position: 'absolute', right: '12%', bottom: '14%', transform: `rotate(-9deg) scale(${2.4 + (1 - 2.4) * Math.pow(su, 3)})`, opacity: Math.min(1, su * 3) * 0.95, border: `${0.9 * u}px solid ${CR.red}`, borderRadius: 1.4 * u, padding: `${0.4 * u}px ${2.4 * u}px`, fontFamily: NF.anton, fontSize: 11 * u, color: CR.red, letterSpacing: '0.06em' }}>
          {stamp}
        </div>
      )}
      {stamp && t > stampAt && t < stampAt + 0.4 && <div style={{ position: 'absolute', inset: -2000, background: `rgba(255,59,48,${0.3 * Math.exp(-(t - stampAt) * 11)})`, pointerEvents: 'none' }} />}
    </Frame>
  );
}

// ---------------------------------------------------------------- bar chart, drawn to scale
export function nafayBars(m: Motion): ReactElement {
  const look = lookOf(m), u = m.u, t = m.t;
  const rows = parseData(m.str('data', 'A:30, B:55, C:80')).map((d) => ({ label: d.label, v: d.values[0] ?? 0 }));
  const max = Math.max(1e-9, ...rows.map((r) => r.v));
  const hiLabel = m.str('highlight');
  const hi = hiLabel ? rows.findIndex((r) => r.label.toLowerCase() === hiLabel.toLowerCase()) : rows.findIndex((r) => r.v === max);
  const W = m.w * (m.portrait ? 0.8 : 0.62), H = m.h * (m.portrait ? 0.34 : 0.48);
  const gap = W / rows.length, bw = gap * 0.56, suffix = m.str('suffix');
  const title = m.str('title');
  const axis = look === 'chalk' ? CH.ink : look === 'creator' ? 'rgba(244,241,234,.25)' : CT.line;
  const labelSt: CSSProperties = look === 'creator' ? { fontFamily: NF.inter, fontWeight: 700, color: CR.dim } : look === 'chalk' ? { fontFamily: NF.kalam, fontWeight: 700, color: CH.ink } : { fontFamily: NF.mono, fontWeight: 700, color: CT.mute, letterSpacing: '0.08em' };
  const valSt: CSSProperties = look === 'creator' ? { fontFamily: NF.anton, color: CR.ink } : look === 'chalk' ? { fontFamily: NF.kalam, fontWeight: 700, color: CH.ink } : { fontFamily: NF.tight, fontWeight: 800, color: CT.ink };
  const axisK = out3(win(t, 0.1, 0.35));
  return (
    <Frame m={m} look={look} plate={look === 'chalk'}>
      {title && <div style={{ ...textStyle(look, 5.5 * u), opacity: out3(win(t, 0, 0.35)) }}>{title}</div>}
      <div style={{ position: 'relative', width: W, height: H + 6 * u, ...(look === 'cleantech' ? { background: '#fff', borderRadius: 2.4 * u, padding: `${3 * u}px ${3 * u}px ${1 * u}px`, boxShadow: '0 16px 44px rgba(13,15,40,.13)', border: '1.5px solid rgba(13,15,20,.08)', boxSizing: 'content-box' } : {}) }}>
        <div style={{ position: 'absolute', left: 0, bottom: 6 * u, height: Math.max(2, 0.3 * u), width: `${axisK * 100}%`, background: axis }} />
        {look === 'chalk' && <div style={{ position: 'absolute', left: 0, bottom: 6 * u, width: Math.max(2, 0.35 * u), height: H * axisK, background: axis }} />}
        {rows.map((row, i) => {
          const t0 = 0.35 + i * 0.15, g = out3(win(t, t0, 0.6)), bh = (row.v / max) * H * 0.92 * g;
          const isHi = i === hi, x = i * gap + (gap - bw) / 2;
          const fill =
            look === 'creator' ? (isHi ? CR.money : 'rgba(61,255,143,.45)') : look === 'cleantech' ? (isHi ? CT.blue : 'rgba(47,91,255,.32)') : 'transparent';
          const border = look === 'chalk' ? `${0.45 * u}px solid ${isHi ? CH.yellow : CH.ink}` : undefined;
          const vk = out3(win(t, t0 + 0.5, 0.3));
          return (
            <div key={i}>
              <div style={{ position: 'absolute', left: x, bottom: 6 * u, width: bw, height: bh, background: fill, border, borderBottom: look === 'chalk' ? 'none' : undefined, borderRadius: look === 'cleantech' ? `${1 * u}px ${1 * u}px 0 0` : look === 'creator' ? 0.4 * u : 0, boxShadow: look === 'creator' && isHi ? '0 0 30px rgba(61,255,143,.55)' : undefined, transform: look === 'chalk' ? `rotate(${(rng(i + 3).range(-0.6, 0.6)).toFixed(2)}deg)` : undefined, boxSizing: 'border-box' }} />
              <div style={{ position: 'absolute', left: x - gap * 0.2, width: bw + gap * 0.4, bottom: 6 * u + bh + 0.8 * u, textAlign: 'center', fontSize: 4.4 * u, opacity: vk, ...valSt, color: look === 'chalk' && isHi ? CH.yellow : valSt.color }}>
                {formatNumber(row.v, { decimals: Number.isInteger(row.v) ? 0 : 1, suffix })}
              </div>
              <div style={{ position: 'absolute', left: x - gap * 0.2, width: bw + gap * 0.4, bottom: 0, textAlign: 'center', fontSize: 3.6 * u, opacity: out3(win(t, t0, 0.3)), ...labelSt }}>{row.label}</div>
            </div>
          );
        })}
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------- checklist
export function nafayList(m: Motion): ReactElement {
  const look = lookOf(m), u = m.u, t = m.t;
  const items = m.str('items', 'Plan; Build; Launch').split(/\s*[;|\n]\s*/).filter(Boolean).slice(0, 7);
  const stagger = m.num('stagger', 0.55);
  const title = m.str('title', look === 'cleantech' ? 'TASKS' : '');
  const fs = (look === 'creator' ? 7.5 : look === 'chalk' ? 6.2 : 5) * u;
  const card: CSSProperties =
    look === 'cleantech' ? { background: '#fff', borderRadius: 2.6 * u, padding: `${3 * u}px ${4.5 * u}px`, boxShadow: '0 16px 44px rgba(13,15,40,.15)', border: '1.5px solid rgba(13,15,20,.08)', minWidth: m.w * 0.42 } : {};
  return (
    <Frame m={m} look={look} plate={false}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1.6 * u, ...card }}>
        {title && (
          <div style={{ opacity: out3(win(t, 0, 0.3)), ...(look === 'cleantech' ? { fontFamily: NF.mono, fontWeight: 700, color: CT.mute, letterSpacing: '0.2em', fontSize: 2.6 * u } : textStyle(look, 6.5 * u)) }}>{title}</div>
        )}
        {items.map((it, i) => {
          const t0 = 0.25 + i * stagger, a = out3(win(t, t0, 0.3)), done = t0 + stagger * 0.7;
          const ck = back(win(t, done, 0.3), 2.2);
          if (look === 'creator') {
            const e = outExpo(win(t, t0, 0.2));
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 2.4 * u, opacity: Math.min(1, win(t, t0, 0.2) * 3.5), transform: `scale(${1.3 - 0.3 * e})`, transformOrigin: '0 50%' }}>
                <span style={{ fontFamily: NF.inter, fontWeight: 800, fontSize: 3.4 * u, background: CR.hi, color: CR.dark, borderRadius: 0.8 * u, padding: `${0.3 * u}px ${1.2 * u}px` }}>{String(i + 1).padStart(2, '0')}</span>
                <span style={{ fontFamily: NF.anton, fontSize: fs, color: CR.ink, textTransform: 'uppercase', lineHeight: 1.05 }}>{it}</span>
              </div>
            );
          }
          if (look === 'chalk') {
            const w = win(t, t0, Math.max(0.2, it.length / 16));
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 * u }}>
                <svg width={5 * u} height={5 * u} viewBox="0 0 10 10" style={{ overflow: 'visible' }}>
                  <Draw d="M1.5 5.5 L4 8 L9 1.5" k={out3(win(t, t0 + it.length / 16 + 0.1, 0.25))} stroke={CH.yellow} width={1.3} />
                </svg>
                <span style={{ ...textStyle('chalk', fs, false), textAlign: 'left', clipPath: `inset(-30% ${(1 - w) * 100}% -30% 0)` }}>{it}</span>
              </div>
            );
          }
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 * u, opacity: a, transform: `translateY(${(1 - a) * 2 * u}px)` }}>
              <span style={{ position: 'relative', width: 3.4 * u, height: 3.4 * u, borderRadius: '50%', border: `2.5px solid ${CT.line}`, flex: 'none' }}>
                <span style={{ position: 'absolute', inset: -2.5, borderRadius: '50%', background: CT.green, transform: `scale(${ck})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="62%" height="62%" viewBox="0 0 10 10"><path d="M2 5.2 L4.2 7.4 L8.2 2.8" stroke="#fff" strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
              </span>
              <span style={{ fontFamily: NF.tight, fontWeight: 600, fontSize: fs, color: t > done ? CT.mute : CT.ink }}>{it}</span>
            </div>
          );
        })}
      </div>
    </Frame>
  );
}
