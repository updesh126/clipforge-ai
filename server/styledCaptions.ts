/**
 * Clip captions, hook title and intro / outro cards drawn in the three Nafay looks
 * (see .claude/skills/nafay-motion): HTML + GSAP for HyperFrames, layered over the framed footage.
 *
 *   creator   – Creator Motion Graphics: Anton caps slam in word by word, yellow highlighter swipe on the key word,
 *               punch zoom on the footage, near-black cards with a warm glow.
 *   chalk     – Chalk Talk: words chalked on a slate plate in a wooden frame, pink key word with a yellow underline.
 *   cleantech – Clean Tech: words rise into a white card, blue pill behind the key word, off-white dot-grid cards.
 *
 * Every tween sits on one paused GSAP timeline, so each frame depends on time alone.
 */
import type { CaptionStyle, WordTiming } from './types.ts';
import { wordPages } from './hyperframes.ts';

export type StyledLook = 'creator' | 'chalk' | 'cleantech';
export const isStyledLook = (s: CaptionStyle | undefined): s is StyledLook => s === 'creator' || s === 'chalk' || s === 'cleantech';

export interface StyledInput {
  width: number;
  height: number;
  clipDuration: number;
  introDuration: number; // 0 = no intro card
  outroDuration: number; // 0 = no outro card
  words: WordTiming[]; // clip-relative; empty = no captions
  look: StyledLook;
  title: string;
  outroText: string;
  hookTitle: boolean;
  hasIntroBg: boolean;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const FONTS =
  'https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@600;700&family=Kalam:wght@700&family=Cabin+Sketch:wght@700&family=Inter+Tight:wght@600;800&family=JetBrains+Mono:wght@700&display=block';

/** The one word per line that gets the accent: the longest word of four or more letters. */
export function keyWordIndex(words: { text: string }[]): number {
  let best = -1, len = 3;
  words.forEach((w, i) => {
    const n = w.text.replace(/[^\p{L}\p{N}]/gu, '').length;
    if (n > len) { len = n; best = i; }
  });
  return best;
}

const THEME = {
  creator: { ink: '#f4f1ea', hi: '#ffd60a', dark: '#0b0b0c', font: '"Anton","Bebas Neue",Impact,"Arial Narrow",sans-serif', card: '"Anton","Bebas Neue",Impact,sans-serif' },
  chalk: { ink: '#f2efe6', hi: '#f39bbb', line: '#f4d35e', font: '"Kalam","Segoe Print","Comic Sans MS",cursive', card: '"Cabin Sketch","Kalam","Segoe Print",cursive' },
  cleantech: { ink: '#0d0f14', hi: '#2f5bff', font: '"Inter Tight","Segoe UI",system-ui,sans-serif', card: '"Inter Tight","Segoe UI",system-ui,sans-serif' },
} as const;

/** Markup for one run of words: each word is a span with an accent layer (swipe / underline / pill) and its text. */
function wordSpans(prefix: string, words: { text: string }[], key: number): string {
  return words
    .map((w, i) => `<span class="w${i === key ? ' k' : ''}" id="${prefix}w${i}"><span class="acc"></span><span class="t">${esc(w.text)}</span></span>`)
    .join('');
}

/** Tweens that bring in one word at time ws (seconds) in the given look. */
function wordIn(look: StyledLook, sel: string, ws: number, dur: number, isKey: boolean, punch: boolean): string[] {
  const out: string[] = [];
  if (look === 'creator') {
    out.push(`tl.fromTo('${sel}',{opacity:0,scale:1.42,filter:'blur(9px)'},{opacity:1,scale:1,filter:'blur(0px)',duration:0.2,ease:'expo.out'},${r3(ws)});`);
    if (isKey) {
      out.push(`tl.fromTo('${sel} .acc',{scaleX:0},{scaleX:1,duration:0.22,ease:'power3.out'},${r3(ws + 0.12)});`);
      out.push(`tl.to('${sel} .t',{color:'${THEME.creator.dark}',textShadow:'0 0 0 rgba(0,0,0,0)',duration:0.06},${r3(ws + 0.2)});`);
      if (punch) out.push(`tl.fromTo('#footage',{scale:1.07},{scale:1,duration:0.7,ease:'expo.out'},${r3(ws)});`);
    }
  } else if (look === 'chalk') {
    const d = Math.min(0.4, Math.max(0.14, dur));
    out.push(`tl.fromTo('${sel}',{clipPath:'inset(-30% 100% -30% 0%)'},{clipPath:'inset(-30% 0% -30% 0%)',duration:${r3(d)},ease:'none'},${r3(ws)});`);
    if (isKey) out.push(`tl.fromTo('${sel} .acc',{scaleX:0},{scaleX:1,duration:0.25,ease:'power1.inOut'},${r3(ws + d)});`);
  } else {
    out.push(`tl.fromTo('${sel} .t',{yPercent:110},{yPercent:0,duration:0.5,ease:'expo.out'},${r3(ws)});`);
    if (isKey) {
      out.push(`tl.fromTo('${sel} .acc',{scaleX:0},{scaleX:1,duration:0.35,ease:'expo.out'},${r3(ws + 0.18)});`);
      out.push(`tl.to('${sel} .t',{color:'#ffffff',duration:0.08},${r3(ws + 0.3)});`);
    }
  }
  return out;
}

function cardCss(look: StyledLook, W: number, H: number, fs: number): string {
  const big = Math.round(fs * (look === 'creator' ? 1.55 : look === 'chalk' ? 1.3 : 1.2));
  const common = `.card{z-index:8;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${Math.round(fs * 0.35)}px;overflow:hidden}
  .cardtitle{position:relative;max-width:84%;text-align:center;font-size:${big}px;line-height:1.08}
  .cardtag{position:relative;font-size:${Math.max(26, Math.round(fs * 0.36))}px;letter-spacing:.18em;text-transform:uppercase}
  .cardbar{position:relative;width:${Math.round(W * 0.42)}px;height:${Math.max(8, Math.round(fs * 0.11))}px;border-radius:99px;transform-origin:0 50%}`;
  if (look === 'creator')
    return `${common}
  .card{background:radial-gradient(ellipse at 25% 20%,rgba(255,214,10,.10),transparent 55%),radial-gradient(ellipse at 80% 85%,rgba(90,120,255,.09),transparent 55%),
        repeating-linear-gradient(0deg,rgba(244,241,234,.03) 0 1px,transparent 1px 80px),repeating-linear-gradient(90deg,rgba(244,241,234,.03) 0 1px,transparent 1px 80px),#09090a}
  .card .cardtitle{font-family:${THEME.creator.card};color:${THEME.creator.ink};text-transform:uppercase;letter-spacing:.01em}
  .card .cardtag{font-family:"Inter",system-ui,sans-serif;font-weight:700;color:#8e8d94}
  .card .cardbar{background:${THEME.creator.hi}}
  .card::after{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 45%,rgba(0,0,0,.55))}`;
  if (look === 'chalk')
    return `${common}
  .card{background:radial-gradient(ellipse at 30% 25%,rgba(255,250,230,.07),transparent 60%),radial-gradient(circle at 70% 70%,rgba(0,0,0,.18),transparent 55%),
        radial-gradient(circle at 20% 80%,rgba(215,228,218,.05),transparent 40%),#24392f;
        border-top:${Math.round(H * 0.022)}px solid #9a6738;border-bottom:${Math.round(H * 0.03)}px solid #6e4524}
  .card .cardtitle{font-family:${THEME.chalk.card};font-weight:700;color:${THEME.chalk.ink};text-shadow:0 0 2px rgba(242,239,230,.7),0 0 10px rgba(242,239,230,.2)}
  .card .cardtag{font-family:${THEME.chalk.font};font-weight:700;color:#93cbef;letter-spacing:.04em;text-transform:none}
  .card .cardbar{background:${THEME.chalk.line};opacity:.9;filter:blur(.4px)}`;
  return `${common}
  .card{background:radial-gradient(circle at 85% 8%,rgba(47,91,255,.12),transparent 50%),radial-gradient(circle at 10% 95%,rgba(24,180,107,.06),transparent 45%),
        radial-gradient(rgba(13,15,20,.09) 1.6px,transparent 1.9px) 0 0/32px 32px,#f5f6f8}
  .card .cardtitle{font-family:${THEME.cleantech.card};font-weight:800;color:${THEME.cleantech.ink};letter-spacing:-.01em}
  .card .cardtag{font-family:"JetBrains Mono",ui-monospace,monospace;font-weight:700;color:${THEME.cleantech.hi}}
  .card .cardbar{background:${THEME.cleantech.hi};opacity:.85}`;
}

function wordCss(look: StyledLook, fs: number, sel: string): string {
  if (look === 'creator')
    return `${sel} .w{position:relative;display:inline-block;margin:0 .13em;transform-origin:50% 60%}
  ${sel} .w .acc{position:absolute;left:-.1em;right:-.1em;top:.06em;bottom:.02em;background:${THEME.creator.hi};transform:scaleX(0) skewX(-4deg);transform-origin:0 50%;border-radius:.05em}
  ${sel} .w .t{position:relative}`;
  if (look === 'chalk')
    return `${sel} .w{position:relative;display:inline-block;margin:0 .16em}
  ${sel} .w.k .t{color:${THEME.chalk.hi}}
  ${sel} .w .acc{position:absolute;left:0;right:0;bottom:-.02em;height:${Math.max(4, Math.round(fs * 0.08))}px;background:${THEME.chalk.line};border-radius:99px;transform:scaleX(0);transform-origin:0 50%;opacity:.9}
  ${sel} .w .t{position:relative}`;
  return `${sel} .w{position:relative;display:inline-block;overflow:hidden;vertical-align:bottom;padding:.02em .14em;margin:0 .01em}
  ${sel} .w .acc{position:absolute;inset:.06em 0 .02em 0;background:${THEME.cleantech.hi};border-radius:.26em;transform:scaleX(0);transform-origin:0 50%}
  ${sel} .w .t{position:relative;display:inline-block}`;
}

export function buildStyledCompositionHtml(o: StyledInput): string {
  const { width: W, height: H, clipDuration, introDuration: I, outroDuration: O, look } = o;
  const total = r3(I + clipDuration + O);
  const portrait = H > W;
  const fs = Math.round(W * (portrait ? 0.072 : W === H ? 0.06 : 0.042));
  const capFs = Math.round(fs * (look === 'creator' ? 1.25 : look === 'chalk' ? 1.0 : 0.95));
  const pages = o.words.length ? wordPages(o.words, portrait ? 3 : 5, portrait ? 20 : 36) : [];
  const html: string[] = [];
  const js: string[] = [];

  // ---- captions ----
  pages.forEach((page, pi) => {
    const start = I + page[0].start;
    const nextStart = pages[pi + 1] ? I + pages[pi + 1][0].start : Infinity;
    const end = Math.min(nextStart, I + page[page.length - 1].end + 0.6, I + clipDuration);
    const dur = Math.max(0.15, end - start);
    const key = page.length > 1 || page[0].text.length > 5 ? keyWordIndex(page) : -1;
    html.push(`<div class="clip cap" id="p${pi}" data-start="${r3(start)}" data-duration="${r3(dur)}" data-track-index="2"><div class="line">${wordSpans(`p${pi}`, page, key)}</div></div>`);
    if (look === 'chalk') js.push(`tl.fromTo('#p${pi} .line',{scale:0.9,opacity:0},{scale:1,opacity:1,duration:0.18,ease:'back.out(1.8)'},${r3(start)});`);
    if (look === 'cleantech') js.push(`tl.fromTo('#p${pi} .line',{y:${Math.round(fs * 0.4)},opacity:0},{y:0,opacity:1,duration:0.35,ease:'expo.out'},${r3(start)});`);
    page.forEach((w, wi) => js.push(...wordIn(look, `#p${pi}w${wi}`, I + w.start, Math.min(end, I + w.end) - (I + w.start), wi === key, true)));
  });

  // ---- hook title over the opening seconds of the footage ----
  const hookEnd = Math.min(3.5, clipDuration);
  if (o.hookTitle && o.title) {
    html.push(`<div class="clip hook" id="hook" data-start="${r3(I)}" data-duration="${r3(hookEnd)}" data-track-index="3"><div class="hookbox">${esc(o.title)}</div></div>`);
    js.push(`tl.fromTo('#hook .hookbox',{y:-40,opacity:0,scale:${look === 'creator' ? 1.3 : 0.92}},{y:0,opacity:1,scale:1,duration:0.35,ease:'${look === 'creator' ? 'expo.out' : 'back.out(1.8)'}'},${r3(I)});`);
    js.push(`tl.to('#hook .hookbox',{opacity:0,y:-20,duration:0.3},${r3(I + hookEnd - 0.3)});`);
  }

  // ---- intro and outro cards ----
  const card = (id: string, t0: number, d: number, text: string, tag: string, fadeOut: boolean) => {
    const words = text.trim().split(/\s+/).filter(Boolean).map((t) => ({ text: t }));
    const key = keyWordIndex(words);
    const bg = id === 'intro' && o.hasIntroBg && look !== 'cleantech' ? `<img class="introbg" src="intro_bg.jpg" alt="">` : '';
    html.push(
      `<div class="clip card" id="${id}" data-start="${r3(t0)}" data-duration="${r3(d)}" data-track-index="1">${bg}` +
        (tag ? `<div class="cardtag">${esc(tag)}</div>` : '') +
        `<div class="cardtitle">${wordSpans(id, words, key)}</div><div class="cardbar"></div></div>`
    );
    const step = Math.min(0.2, (d * 0.45) / Math.max(1, words.length));
    if (tag) js.push(`tl.fromTo('#${id} .cardtag',{opacity:0,y:12},{opacity:1,y:0,duration:0.3,ease:'power2.out'},${r3(t0 + 0.05)});`);
    words.forEach((_, i) => js.push(...wordIn(look, `#${id}w${i}`, t0 + 0.15 + i * step, step * 1.4, i === key, false)));
    js.push(`tl.fromTo('#${id} .cardbar',{scaleX:0},{scaleX:1,duration:${r3(Math.max(0.3, d * 0.35))},ease:'power2.out'},${r3(t0 + 0.2 + words.length * step)});`);
    if (bg) js.push(`tl.fromTo('#${id} .introbg',{scale:1.15},{scale:1,duration:${r3(d)},ease:'none'},${r3(t0)});`);
    if (fadeOut) js.push(`tl.to('#${id}',{opacity:0,duration:0.22},${r3(t0 + d - 0.22)});`);
    else js.push(`tl.fromTo('#${id}',{opacity:0},{opacity:1,duration:0.2},${r3(t0)});`);
  };
  if (I > 0) card('intro', 0, I, o.title || 'Watch this', '', true);
  if (O > 0) card('outro', I + clipDuration, O, o.outroText || 'Follow for more', look === 'cleantech' ? 'NEXT UP' : '', false);
  js.push(`tl.set({}, {}, ${total});`);

  const capBottom = portrait ? Math.round(H * 0.22) : Math.round(H * 0.08);
  const lineCss =
    look === 'creator'
      ? `font-family:${THEME.creator.font};color:${THEME.creator.ink};text-transform:uppercase;letter-spacing:.01em;line-height:1.04;
         text-shadow:0 ${Math.round(capFs * 0.05)}px ${Math.round(capFs * 0.22)}px rgba(0,0,0,.8),0 0 2px rgba(0,0,0,.9)`
      : look === 'chalk'
        ? `font-family:${THEME.chalk.font};font-weight:700;color:${THEME.chalk.ink};line-height:1.18;
           background:radial-gradient(ellipse at 30% 20%,rgba(255,250,230,.07),transparent 60%),#24392f;
           border:${Math.max(6, Math.round(capFs * 0.13))}px solid #8a5a31;border-radius:${Math.round(capFs * 0.18)}px;padding:.18em .5em .26em;
           box-shadow:0 12px 34px rgba(0,0,0,.5);text-shadow:0 0 2px rgba(242,239,230,.75),0 0 9px rgba(242,239,230,.18)`
        : `font-family:${THEME.cleantech.font};font-weight:800;color:${THEME.cleantech.ink};letter-spacing:-.01em;line-height:1.16;
           background:#fff;border:1.5px solid rgba(13,15,20,.08);border-radius:${Math.round(capFs * 0.34)}px;padding:.22em .45em .28em;
           box-shadow:0 16px 44px rgba(13,15,40,.22)`;
  const hookCss =
    look === 'creator'
      ? `background:${THEME.creator.hi};color:${THEME.creator.dark};font-family:${THEME.creator.font};text-transform:uppercase;letter-spacing:.01em;font-weight:400`
      : look === 'chalk'
        ? `background:#24392f;color:${THEME.chalk.ink};font-family:${THEME.chalk.card};font-weight:700;border:${Math.round(fs * 0.1)}px solid #8a5a31`
        : `background:#fff;color:${THEME.cleantech.ink};font-family:${THEME.cleantech.font};font-weight:800;border-left:${Math.round(fs * 0.16)}px solid ${THEME.cleantech.hi}`;

  return `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="stylesheet" href="${FONTS}">
<style>
  html,body{margin:0;padding:0;background:#000;overflow:hidden}
  #root{position:relative;width:${W}px;height:${H}px;overflow:hidden;background:#000}
  .clip{position:absolute;inset:0}
  #footage{width:100%;height:100%;object-fit:cover;transform-origin:50% 45%}
  .cap{display:flex;align-items:flex-end;justify-content:center;bottom:${capBottom}px;top:auto;left:${Math.round(W * 0.05)}px;right:${Math.round(W * 0.05)}px;z-index:5}
  .cap .line{text-align:center;font-size:${capFs}px;${lineCss}}
  ${wordCss(look, capFs, '.cap')}
  ${wordCss(look, Math.round(fs * 1.3), '.card')}
  .hook{display:flex;justify-content:center;align-items:flex-start;top:${portrait ? Math.round(H * 0.11) : Math.round(H * 0.06)}px;z-index:6}
  .hookbox{max-width:84%;border-radius:${Math.round(fs * 0.24)}px;padding:${Math.round(fs * 0.24)}px ${Math.round(fs * 0.42)}px;font-size:${Math.round(fs * 0.66)}px;
           line-height:1.15;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.45);${hookCss}}
  .introbg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:blur(28px) brightness(.35)}
  ${cardCss(look, W, H, fs)}
</style></head>
<body>
<div id="root" data-composition-id="root" data-start="0" data-duration="${total}" data-width="${W}" data-height="${H}" data-fps="30">
  <video id="footage" class="clip" src="base.mp4" data-start="${r3(I)}" data-duration="${r3(clipDuration)}" data-track-index="0" muted playsinline></video>
  ${html.join('\n  ')}
</div>
<script src="gsap.min.js"></script>
<script>
  const tl = gsap.timeline({ paused: true });
  ${js.join('\n  ')}
  window.__timelines = window.__timelines || {};
  window.__timelines["root"] = tl;
</script>
</body></html>`;
}
