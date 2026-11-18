/**
 * The whole edit as one Remotion composition: every timeline item becomes a <Sequence>.
 * Used by @remotion/player in the editor and by @remotion/renderer for the final MP4.
 */
import { useEffect, useState } from 'react';
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, cancelRender, continueRender, delayRender, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Lottie, type LottieAnimationData } from '@remotion/lottie';
import type { AudioItem, CaptionsItem, CompositionProps, EditItem, EffectItem, ImageItem, VideoItem } from '../editor/types.ts';
import { TEMPLATE_COMPONENTS } from './templates.tsx';
import { styleLook } from './artStyles.tsx';

const FONT = '"Arial Black", "Segoe UI", Arial, Helvetica, sans-serif';

function url(base: string, src: string) {
  return /^(https?:|data:|blob:)/.test(src) ? src : `${base}${src}`;
}

/** Combined transform/overlay from every effect item active at this frame. */
interface Camera {
  scale: number;
  dx: number;
  dy: number;
  black: number;
  white: number;
  blur: number; // px, whip pans
  iris: number; // 0 = open … 1 = closed
}

/** Camera transform for a layer at a given depth (0 = far/static, 1 = footage plane, >1 = foreground). */
export function cameraTransform(cam: Camera, depth: number) {
  return `translate(${cam.dx * depth}px, ${cam.dy * depth}px) scale(${1 + (cam.scale - 1) * depth})`;
}

function useEffects(effects: EffectItem[]): Camera {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  let scale = 1;
  let dx = 0;
  let dy = 0;
  let black = 0;
  let white = 0;
  let blur = 0;
  let iris = 0;
  for (const e of effects) {
    if (t < e.from || t >= e.from + e.duration) continue;
    const local = t - e.from;
    const k = Math.max(0.2, Math.min(2, e.intensity || 1));
    if (e.effect === 'zoomPunch') {
      const p = spring({ frame: Math.round(local * fps), fps, config: { damping: 11, stiffness: 220 } });
      scale *= 1 + 0.18 * k * p;
    } else if (e.effect === 'slowZoom') {
      scale *= 1 + 0.12 * k * (local / e.duration);
    } else if (e.effect === 'shake') {
      const amp = 18 * k * (1 - local / e.duration);
      dx += Math.sin(local * 90) * amp;
      dy += Math.cos(local * 70) * amp;
    } else if (e.effect === 'flash') {
      white = Math.max(white, interpolate(local, [0, e.duration * 0.3, e.duration], [0, 0.9, 0], { extrapolateRight: 'clamp' }));
    } else if (e.effect === 'fadeIn') {
      black = Math.max(black, 1 - local / e.duration);
    } else if (e.effect === 'fadeOut') {
      black = Math.max(black, local / e.duration);
    } else if (e.effect === 'whipPan') {
      const p = local / e.duration;
      const sweep = p < 0.5 ? p * 2 : (p - 1) * 2; // out to the left, in from the right
      dx -= width * 0.9 * k * sweep;
      blur = Math.max(blur, 40 * Math.sin(Math.PI * p));
    } else if (e.effect === 'irisWipe') {
      const p = local / e.duration;
      iris = Math.max(iris, Math.sin(Math.PI * p));
    } else {
      // smooth 2.5D camera moves (ease in-out over the effect's length)
      const p = local / e.duration;
      const ease = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
      // gentle amplitudes: big sweeps on a static painting read as wobble, and must stay inside the overscan
      if (e.effect === 'pushIn') scale *= 1 + 0.1 * k * ease;
      else if (e.effect === 'pullOut') scale *= 1 + 0.1 * k * (1 - ease);
      else if (e.effect === 'panLeft') dx -= width * 0.05 * k * (ease - 0.5) * 2;
      else if (e.effect === 'panRight') dx += width * 0.05 * k * (ease - 0.5) * 2;
      else if (e.effect === 'tiltUp') dy += height * 0.04 * k * (ease - 0.5) * 2;
    }
  }
  return { scale, dx, dy, black, white, blur, iris };
}

/** Volume as a function of the frame: base level with optional linear fade in / fade out (Remotion volume curve). */
function volumeCurve(base: number, fadeIn: number | undefined, fadeOut: number | undefined, durFrames: number, fps: number) {
  const v = Math.max(0, Math.min(2, base));
  const fi = Math.max(0, (fadeIn ?? 0) * fps);
  const fo = Math.max(0, (fadeOut ?? 0) * fps);
  if (!fi && !fo) return v;
  return (f: number) => {
    let k = 1;
    if (fi) k = Math.min(k, f / fi);
    if (fo) k = Math.min(k, (durFrames - f) / fo);
    return v * Math.max(0, Math.min(1, k));
  };
}

const rate = (speed: number | undefined) => Math.max(0.25, Math.min(4, speed || 1));

function VideoLayer({ item, base, preview }: { item: VideoItem; base: string; preview: boolean }) {
  const { fps, durationInFrames } = useVideoConfig();
  const src = url(base, preview && item.previewSrc ? item.previewSrc : item.src);
  const objectPosition = `${item.panX}% ${item.panY}%`;
  const common = {
    src,
    trimBefore: Math.round(item.sourceStart * fps),
    volume: volumeCurve(item.volume, item.fadeIn, item.fadeOut, durationInFrames, fps),
    playbackRate: rate(item.speed),
  };
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {item.fit === 'contain' && (
        <AbsoluteFill style={{ filter: 'blur(40px) brightness(0.55)', transform: 'scale(1.2)' }}>
          <OffthreadVideo {...common} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{ transform: `scale(${item.zoom})`, transformOrigin: objectPosition }}>
        <OffthreadVideo {...common} style={{ width: '100%', height: '100%', objectFit: item.fit, objectPosition }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/** Sprite motion presets (characters face right; flip mirrors them). */
function spriteMotion(item: ImageItem, frame: number, fps: number, durFrames: number, width: number) {
  const t = frame / fps;
  const dur = durFrames / fps;
  const dir = item.flip ? -1 : 1;
  let dx = 0;
  let dy = 0;
  let rot = 0;
  let sx = 1;
  let sy = 1;
  let opacity = 1;
  const enter = spring({ frame, fps, config: { damping: 14 } });
  const walkBob = (speed = 7) => {
    dy -= Math.abs(Math.sin(t * speed)) * width * 0.012;
    rot += Math.sin(t * speed) * 2.5;
  };
  switch (item.motion ?? 'pop') {
    case 'walkIn': {
      const p = Math.min(1, t / Math.min(1.8, dur * 0.5));
      const e = 1 - (1 - p) ** 2;
      dx = -dir * (1 - e) * width * 0.7;
      if (p < 1) walkBob();
      break;
    }
    case 'walkOut': {
      const start = Math.max(0, dur - 1.8);
      const p = Math.max(0, (t - start) / 1.8);
      dx = dir * p * p * width * 0.7;
      if (p > 0) walkBob();
      break;
    }
    case 'walkAcross':
      dx = dir * (t / Math.max(0.5, dur) - 0.5) * width * 0.9;
      walkBob();
      break;
    case 'bob':
      dy = Math.sin(t * 2.4) * width * 0.008;
      break;
    case 'sway':
      rot = Math.sin(t * 1.6) * 3;
      break;
    case 'float':
      dy = Math.sin(t * 1.3) * width * 0.02;
      rot = Math.sin(t * 0.9) * 2;
      dx = Math.sin(t * 0.6) * width * 0.02;
      break;
    case 'fly':
      dx = dir * (t / Math.max(0.5, dur) - 0.5) * width * 1.1;
      dy = Math.sin(t * 3) * width * 0.03;
      sy = 1 + Math.sin(t * 14) * 0.08; // wing beat
      break;
    case 'breathe':
      sy = 1 + Math.sin(t * 2) * 0.015;
      sx = 1 - Math.sin(t * 2) * 0.008;
      break;
    case 'slideUp':
      dy = (1 - enter) * width * 0.6;
      break;
    case 'kenBurns':
      // starts at 108% (overscan) so camera pans and tilts never reveal the frame edge; eased, not linear
      {
        const p = Math.min(1, t / Math.max(0.5, dur));
        sx = sy = 1.08 + 0.06 * (p * p * (3 - 2 * p));
      }
      break;
    case 'none':
      break;
    default: // pop
      sx = sy = 0.6 + 0.4 * enter;
      opacity = enter;
  }
  if (item.motion && item.motion !== 'pop' && item.motion !== 'none' && item.motion !== 'kenBurns') opacity = Math.min(1, frame / 6);
  // gentle fade out at the end of the item
  opacity *= Math.min(1, (durFrames - frame) / 6);
  return { dx, dy, rot, sx: sx * (item.flip ? -1 : 1), sy, opacity };
}

const isLottieSrc = (src: string) => /\.json$/i.test(src);

/** A Lottie animation (e.g. from IconScout), played frame-accurately and looped for the item's length. */
function LottieSprite({ src, style }: { src: string; style: React.CSSProperties }) {
  const [data, setData] = useState<LottieAnimationData | null>(null);
  const [handle] = useState(() => delayRender(`Loading Lottie ${src}`));
  useEffect(() => {
    fetch(src)
      .then((r) => r.json())
      .then((json: LottieAnimationData) => {
        setData(json);
        continueRender(handle);
      })
      .catch((err) => cancelRender(err));
  }, [src, handle]);
  if (!data) return null;
  return (
    <div style={style}>
      <Lottie animationData={data} loop style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

function ImageLayer({ item, base }: { item: ImageItem; base: string }) {
  const frame = useCurrentFrame();
  const { fps, width, durationInFrames } = useVideoConfig();
  const p = spring({ frame, fps, config: { damping: 14 } });
  const full = item.scale >= 0.999;
  if (item.anchor === 'bottom' || item.motion || isLottieSrc(item.src)) {
    const m = spriteMotion(item, frame, fps, durationInFrames, width);
    const size = item.scale * width;
    const style: React.CSSProperties = {
      position: 'absolute',
      width: full ? '100%' : size,
      height: full ? '100%' : isLottieSrc(item.src) ? size : 'auto',
      objectFit: full ? item.fit : undefined,
      left: full ? 0 : `calc(${item.x}% - ${size / 2}px)`,
      top: full ? 0 : item.anchor === 'bottom' ? `calc(${item.y}% - ${size}px)` : `calc(${item.y}% - ${size / 2}px)`,
      transformOrigin: item.anchor === 'bottom' ? '50% 100%' : '50% 50%',
      transform: `translate(${m.dx}px, ${m.dy}px) rotate(${m.rot}deg) scale(${m.sx}, ${m.sy})`,
      opacity: m.opacity,
      ...styleLook(item.look, !full),
    };
    return (
      <AbsoluteFill style={{ overflow: 'visible' }}>
        {isLottieSrc(item.src) ? <LottieSprite src={url(base, item.src)} style={style} /> : <Img src={url(base, item.src)} style={style} />}
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill>
      <Img
        src={url(base, item.src)}
        style={
          full
            ? { width: '100%', height: '100%', objectFit: item.fit, opacity: p, ...styleLook(item.look, false) }
            : {
                position: 'absolute',
                left: `${item.x}%`,
                top: `${item.y}%`,
                width: `${item.scale * 100}%`,
                transform: `translate(-50%,-50%) scale(${0.9 + 0.1 * p})`,
                opacity: p,
                borderRadius: 24,
                boxShadow: '0 20px 60px rgba(0,0,0,.5)',
              }
        }
      />
    </AbsoluteFill>
  );
}

function Captions({ item }: { item: CaptionsItem }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const portrait = height > width;
  const per = portrait ? 3 : 6;
  // group words into pages
  const pages: CaptionsItem['words'][] = [];
  let cur: CaptionsItem['words'] = [];
  for (const w of item.words) {
    if (cur.length && (cur.length >= per || w.start - cur[cur.length - 1].end > 0.7)) {
      pages.push(cur);
      cur = [];
    }
    cur.push(w);
    if (/[.!?]$/.test(w.text)) {
      pages.push(cur);
      cur = [];
    }
  }
  if (cur.length) pages.push(cur);
  const idx = pages.findIndex((p, i) => t >= p[0].start && t < (pages[i + 1]?.[0].start ?? p[p.length - 1].end + 0.6));
  if (idx < 0) return null;
  const page = pages[idx];
  const pageFrame = Math.round((t - page[0].start) * fps);
  const enter = spring({ frame: pageFrame, fps, config: { damping: 12, stiffness: 200 } });
  const fs = width * (portrait ? 0.075 : 0.045);
  const look = item.look;
  const pos =
    item.position === 'top'
      ? { top: height * 0.16 }
      : item.position === 'middle'
        ? { top: height * 0.45 }
        : { bottom: height * (portrait ? 0.22 : 0.08) };
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: width * 0.06, right: width * 0.06, ...pos, textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-block',
            fontFamily: look === 'clean' ? 'Segoe UI, Arial, sans-serif' : FONT,
            fontWeight: look === 'clean' ? 700 : 900,
            fontSize: look === 'clean' ? fs * 0.7 : fs,
            lineHeight: 1.15,
            textTransform: look === 'clean' ? 'none' : 'uppercase',
            color: look === 'bold' ? '#FFE44D' : '#fff',
            transform: `scale(${0.85 + 0.15 * enter})`,
            opacity: enter,
            textShadow: '0 4px 0 #000, 0 0 18px rgba(0,0,0,.85)',
            background: look === 'clean' ? 'rgba(0,0,0,.6)' : 'transparent',
            padding: look === 'clean' ? `${fs * 0.15}px ${fs * 0.35}px` : 0,
            borderRadius: fs * 0.2,
          }}
        >
          {page.map((w, i) => {
            const active = t >= w.start && t < w.end + 0.05;
            const spoken = t >= w.start;
            const hidden = look === 'pop' && !spoken;
            const popIn = look === 'pop' ? spring({ frame: Math.round((t - w.start) * fps), fps, config: { damping: 9, stiffness: 260 } }) : 1;
            return (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  margin: '0 0.24em',
                  color: (look === 'karaoke' || look === 'pop') && active ? item.accent : undefined,
                  transform: `scale(${(look === 'karaoke' || look === 'pop') && active ? 1.04 : 1}) translateY(${(1 - popIn) * 20 - ((look === 'karaoke' || look === 'pop') && active ? 6 : 0)}px)`,
                  opacity: hidden ? 0 : 1,
                }}
              >
                {w.text}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
}

function AudioLayer({ item, src }: { item: AudioItem; src: string }) {
  const { fps, durationInFrames } = useVideoConfig();
  return <Audio src={src} trimBefore={Math.round(item.sourceStart * fps)} volume={volumeCurve(item.volume, item.fadeIn, item.fadeOut, durationInFrames, fps)} playbackRate={rate(item.speed)} />;
}

function ItemLayer({ item, base, preview }: { item: EditItem; base: string; preview: boolean }) {
  switch (item.kind) {
    case 'video':
      return <VideoLayer item={item} base={base} preview={preview} />;
    case 'image':
      return <ImageLayer item={item} base={base} />;
    case 'audio':
      return <AudioLayer item={item} src={url(base, item.src)} />;
    case 'captions':
      return <Captions item={item} />;
    case 'text': {
      const T = TEMPLATE_COMPONENTS[item.template];
      return T ? <T props={item.props} /> : null;
    }
    default:
      return null;
  }
}

export function EditorComposition({ edit, assetBase, preview }: CompositionProps) {
  const { fps } = useVideoConfig();
  const effects = edit.items.filter((i): i is EffectItem => i.kind === 'effect');
  const fx = useEffects(effects);
  const layers = edit.items.filter((i) => i.kind !== 'effect').sort((a, b) => a.track - b.track);
  const media = layers.filter((i) => i.kind === 'video' || i.kind === 'image');
  const overlays = layers.filter((i) => i.kind !== 'video' && i.kind !== 'image');
  const seq = (i: EditItem) => (
    <Sequence key={i.id} from={Math.round(i.from * fps)} durationInFrames={Math.max(1, Math.round(i.duration * fps))} name={i.name || i.kind}>
      <ItemLayer item={i} base={assetBase} preview={preview} />
    </Sequence>
  );
  return (
    <AbsoluteFill style={{ background: edit.background || '#000', overflow: 'hidden' }}>
      {/* Effects / camera move the picture layers by their depth (2.5D parallax); graphics stay steady on top */}
      {media.map((i) => (
        <AbsoluteFill key={i.id} style={{ transform: cameraTransform(fx, i.kind === 'image' ? (i.depth ?? 1) : 1), filter: fx.blur > 0.5 ? `blur(${fx.blur}px)` : undefined }}>
          {seq(i)}
        </AbsoluteFill>
      ))}
      {overlays.map(seq)}
      {fx.black > 0 && <AbsoluteFill style={{ background: '#000', opacity: fx.black }} />}
      {fx.white > 0 && <AbsoluteFill style={{ background: '#fff', opacity: fx.white }} />}
      {fx.iris > 0.01 && (
        <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 50%, transparent ${(1 - fx.iris) * 75}%, #0b0b0b ${(1 - fx.iris) * 75 + 0.5}%)` }} />
      )}
    </AbsoluteFill>
  );
}
