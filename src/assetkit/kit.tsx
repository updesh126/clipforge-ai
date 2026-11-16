/**
 * Parametric asset generators → SVG. Sprites use a 512×512 box with the ground at y=492
 * (so every character stands on the same line); backgrounds use the video frame size.
 * Every shape goes through the style painter so one recipe renders in all art styles.
 */
import type { ReactElement, ReactNode, SVGProps } from 'react';
import type {
  AnimalSpec,
  AssetSpec,
  BackgroundSpec,
  BirdSpec,
  BuildingSpec,
  FishSpec,
  MountainSpec,
  ObjectSpec,
  PersonSpec,
  TreeSpec,
} from './types.ts';
import { painter, type Paint } from './paint.ts';

type P = SVGProps<SVGPathElement> & SVGProps<SVGEllipseElement> & SVGProps<SVGRectElement> & SVGProps<SVGCircleElement>;

/** Painted shape: one place decides fill/stroke for every style. */
function shape(pt: Paint, el: 'path' | 'ellipse' | 'rect' | 'circle', color: string, props: P, key?: string | number): ReactElement {
  const fill = pt.lineArt ? 'none' : pt.fill(color);
  const stroke = pt.silhouette ? 'none' : pt.stroke;
  const common = { key, fill, stroke, strokeWidth: pt.sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const, ...props };
  if (el === 'path') return <path {...(common as SVGProps<SVGPathElement>)} />;
  if (el === 'ellipse') return <ellipse {...(common as SVGProps<SVGEllipseElement>)} />;
  if (el === 'rect') return <rect {...(common as SVGProps<SVGRectElement>)} />;
  return <circle {...(common as SVGProps<SVGCircleElement>)} />;
}

const line = (pt: Paint, d: string, w = pt.sw * 1.6, key?: string | number) => (
  <path key={key} d={d} fill="none" stroke={pt.silhouette ? '#1B0E05' : pt.lineArt ? pt.stroke : pt.style === 'warli' ? '#FFFFFF' : pt.stroke === 'none' ? '#2B2B2B' : pt.stroke} strokeWidth={Math.max(2, w)} strokeLinecap="round" />
);

/** Madhubani hatching / shadow-puppet perforations over a region. */
function texture(pt: Paint, id: string, clip: ReactNode, box: [number, number, number, number]): ReactElement | null {
  const [x, y, w, h] = box;
  if (pt.hatch) {
    const lines = [];
    for (let i = 0; i < w + h; i += 14) lines.push(<line key={i} x1={x + i} y1={y} x2={x + i - h} y2={y + h} stroke="#111" strokeWidth={2} opacity={0.55} />);
    return (
      <g>
        <clipPath id={id}>{clip}</clipPath>
        <g clipPath={`url(#${id})`}>{lines}</g>
      </g>
    );
  }
  if (pt.perforate) {
    const dots = [];
    for (let i = 0; i < 18; i++) dots.push(<circle key={i} cx={x + w * (0.2 + 0.6 * ((i * 37) % 17) / 17)} cy={y + h * (0.2 + 0.6 * ((i * 53) % 19) / 19)} r={3.5} fill="#FFB347" />);
    return (
      <g>
        <clipPath id={id}>{clip}</clipPath>
        <g clipPath={`url(#${id})`}>{dots}</g>
      </g>
    );
  }
  return null;
}

// ================================================================= PERSON
function Person({ s, pt }: { s: PersonSpec; pt: Paint }) {
  const skin = s.skin ?? '#C68642';
  const top = s.top ?? '#2E86AB';
  const bottom = s.bottom ?? '#3D405B';
  const hairC = s.hairColor ?? (s.elderly ? '#DDDDDD' : '#2B1B12');
  const k = s.child ? 0.72 : 1;
  const pose = s.pose ?? 'stand';
  const dress = s.dress ?? 'trousers';
  // vertical layout (adult): head 70-150, torso 150-300, legs 300-492
  const cx = 256;
  const headY = 492 - 422 * k;
  const r = 38 * k;
  const neckY = headY + r;
  const shoulderY = neckY + 12 * k;
  const hipY = shoulderY + 150 * k;
  const footY = 492;
  const sh = 46 * k; // half shoulder width
  const hp = 40 * k;
  const armL = 130 * k;
  const ang = (deg: number) => (deg * Math.PI) / 180;
  const arm = (side: -1 | 1, deg: number, key: string) => {
    const x0 = cx + side * (sh - 6 * k);
    const y0 = shoulderY + 10 * k;
    const x1 = x0 + Math.sin(ang(deg)) * armL * side;
    const y1 = y0 + Math.cos(ang(deg)) * armL;
    return (
      <g key={key}>
        {line(pt, `M${x0} ${y0} L${x1} ${y1}`, 24 * k)}
        <path d={`M${x0} ${y0} L${x1} ${y1}`} stroke={pt.lineArt ? 'none' : pt.fill(top)} strokeWidth={16 * k} strokeLinecap="round" fill="none" />
        {shape(pt, 'circle', skin, { cx: x1, cy: y1, r: 11 * k })}
      </g>
    );
  };
  const armDeg: Record<string, [number, number]> = { stand: [12, 12], wave: [12, 160], walk: [-20, 25], point: [12, 95], cheer: [150, 150], think: [12, 150] };
  const [la, ra] = armDeg[pose] ?? armDeg.stand;
  const stride = pose === 'walk' ? 26 * k : 8 * k;
  const torso = `M${cx - sh} ${shoulderY} Q${cx} ${shoulderY - 10 * k} ${cx + sh} ${shoulderY} L${cx + hp} ${hipY} L${cx - hp} ${hipY}Z`;
  const legs =
    dress === 'skirt' || dress === 'saree' || dress === 'robe'
      ? shape(pt, 'path', bottom, { d: `M${cx - hp} ${hipY} L${cx + hp} ${hipY} L${cx + hp * 1.6} ${footY - 14} L${cx - hp * 1.6} ${footY - 14}Z` })
      : dress === 'dhoti'
        ? shape(pt, 'path', bottom, { d: `M${cx - hp} ${hipY} L${cx + hp} ${hipY} L${cx + hp * 1.15} ${hipY + 120 * k} L${cx + 6} ${hipY + 100 * k} L${cx - 6} ${hipY + 100 * k} L${cx - hp * 1.15} ${hipY + 120 * k}Z` })
        : (
          <g>
            {shape(pt, 'path', bottom, { d: `M${cx - hp} ${hipY} L${cx - 4} ${hipY} L${cx - 10 - stride} ${footY - 12} L${cx - 38 * k - stride} ${footY - 12}Z` })}
            {shape(pt, 'path', bottom, { d: `M${cx + 4} ${hipY} L${cx + hp} ${hipY} L${cx + 38 * k + stride} ${footY - 12} L${cx + 10 + stride} ${footY - 12}Z` })}
          </g>
        );
  const showLegsBelow = dress === 'dhoti';
  return (
    <g>
      {showLegsBelow && (
        <g>
          {line(pt, `M${cx - 22 * k} ${hipY + 100 * k} L${cx - 26 * k - stride} ${footY - 10}`, 16 * k)}
          {line(pt, `M${cx + 22 * k} ${hipY + 100 * k} L${cx + 26 * k + stride} ${footY - 10}`, 16 * k)}
        </g>
      )}
      {legs}
      {/* feet */}
      {shape(pt, 'ellipse', '#3B2A1A', { cx: cx - 26 * k - stride, cy: footY - 6, rx: 20 * k, ry: 8 })}
      {shape(pt, 'ellipse', '#3B2A1A', { cx: cx + 26 * k + stride, cy: footY - 6, rx: 20 * k, ry: 8 })}
      {arm(-1, la, 'la')}
      {shape(pt, 'path', top, { d: torso })}
      {texture(pt, `ph${top.replace('#', '')}${k}`, <path d={torso} />, [cx - sh, shoulderY, sh * 2, hipY - shoulderY])}
      {dress === 'saree' && shape(pt, 'path', bottom, { d: `M${cx + sh - 4} ${shoulderY} L${cx - hp + 6} ${hipY} L${cx - hp + 26} ${hipY} L${cx + sh + 8} ${shoulderY + 20}Z` })}
      {arm(1, ra, 'ra')}
      {shape(pt, 'rect', skin, { x: cx - 10 * k, y: neckY - 6, width: 20 * k, height: 20 * k })}
      {/* hair behind head */}
      {s.hair === 'long' && shape(pt, 'path', hairC, { d: `M${cx - r - 4} ${headY} Q${cx - r - 10} ${headY + r * 2.2} ${cx - r * 0.4} ${headY + r * 2.1} L${cx + r * 0.4} ${headY + r * 2.1} Q${cx + r + 10} ${headY + r * 2.2} ${cx + r + 4} ${headY}Z` })}
      {shape(pt, 'circle', skin, { cx, cy: headY, r })}
      {/* face */}
      {!pt.silhouette && !pt.lineArt && pt.style !== 'warli' && (
        <g>
          <circle cx={cx - r * 0.35} cy={headY - 2} r={r * 0.09} fill="#1B1B1B" />
          <circle cx={cx + r * 0.35} cy={headY - 2} r={r * 0.09} fill="#1B1B1B" />
          <path d={`M${cx - r * 0.3} ${headY + r * 0.4} Q${cx} ${headY + r * 0.6} ${cx + r * 0.3} ${headY + r * 0.4}`} stroke="#1B1B1B" strokeWidth={3} fill="none" strokeLinecap="round" />
        </g>
      )}
      {s.glasses && line(pt, `M${cx - r * 0.6} ${headY - 2} h${r * 0.5} M${cx + r * 0.1} ${headY - 2} h${r * 0.5}`, 4)}
      {s.beard && shape(pt, 'path', hairC, { d: `M${cx - r * 0.8} ${headY + r * 0.2} Q${cx} ${headY + r * 1.6} ${cx + r * 0.8} ${headY + r * 0.2} Q${cx} ${headY + r * 0.85} ${cx - r * 0.8} ${headY + r * 0.2}Z` })}
      {/* hair on top */}
      {(s.hair ?? 'short') !== 'none' && (s.headwear ?? 'none') === 'none' && shape(pt, 'path', hairC, { d: `M${cx - r} ${headY} Q${cx - r} ${headY - r * 1.2} ${cx} ${headY - r * 1.05} Q${cx + r} ${headY - r * 1.2} ${cx + r} ${headY} Q${cx} ${headY - r * 0.55} ${cx - r} ${headY}Z` })}
      {s.hair === 'bun' && shape(pt, 'circle', hairC, { cx, cy: headY - r * 1.05, r: r * 0.38 })}
      {/* headwear */}
      {s.headwear === 'turban' && shape(pt, 'path', s.headwearColor ?? '#E86A17', { d: `M${cx - r * 1.08} ${headY - r * 0.1} Q${cx - r * 1.1} ${headY - r * 1.5} ${cx} ${headY - r * 1.35} Q${cx + r * 1.1} ${headY - r * 1.5} ${cx + r * 1.08} ${headY - r * 0.1} Q${cx} ${headY - r * 0.45} ${cx - r * 1.08} ${headY - r * 0.1}Z` })}
      {s.headwear === 'cap' && shape(pt, 'path', s.headwearColor ?? '#C1272D', { d: `M${cx - r} ${headY - r * 0.2} Q${cx} ${headY - r * 1.5} ${cx + r} ${headY - r * 0.2}Z M${cx + r * 0.6} ${headY - r * 0.25} h${r * 0.9} v${r * 0.18} h${-r * 0.9}Z` })}
      {s.headwear === 'hat' && shape(pt, 'path', s.headwearColor ?? '#8D6E63', { d: `M${cx - r * 1.6} ${headY - r * 0.35} h${r * 3.2} v${r * 0.2} h${-r * 3.2}Z M${cx - r * 0.8} ${headY - r * 0.35} Q${cx} ${headY - r * 1.7} ${cx + r * 0.8} ${headY - r * 0.35}Z` })}
      {s.headwear === 'scarf' && shape(pt, 'path', s.headwearColor ?? '#7B3F99', { d: `M${cx - r * 1.15} ${headY + r * 0.6} Q${cx - r * 1.3} ${headY - r * 1.4} ${cx} ${headY - r * 1.25} Q${cx + r * 1.3} ${headY - r * 1.4} ${cx + r * 1.15} ${headY + r * 0.6} Q${cx + r * 0.9} ${headY - r * 0.6} ${cx} ${headY - r * 0.8} Q${cx - r * 0.9} ${headY - r * 0.6} ${cx - r * 1.15} ${headY + r * 0.6}Z` })}
      {s.headwear === 'crown' && shape(pt, 'path', s.headwearColor ?? '#D4A537', { d: `M${cx - r * 0.9} ${headY - r * 0.6} L${cx - r * 0.9} ${headY - r * 1.5} L${cx - r * 0.45} ${headY - r * 1.05} L${cx} ${headY - r * 1.65} L${cx + r * 0.45} ${headY - r * 1.05} L${cx + r * 0.9} ${headY - r * 1.5} L${cx + r * 0.9} ${headY - r * 0.6}Z` })}
      {s.headwear === 'helmet' && shape(pt, 'path', s.headwearColor ?? '#F4B400', { d: `M${cx - r * 1.1} ${headY - r * 0.05} Q${cx} ${headY - r * 1.8} ${cx + r * 1.1} ${headY - r * 0.05}Z` })}
      {/* props held in the right hand */}
      {(() => {
        const [, rdeg] = [la, ra];
        const x0 = cx + (sh - 6 * k);
        const y0 = shoulderY + 10 * k;
        const hx = x0 + Math.sin(ang(rdeg)) * armL;
        const hy = y0 + Math.cos(ang(rdeg)) * armL;
        switch (s.prop) {
          case 'staff':
            return line(pt, `M${hx} ${hy - 120 * k} L${hx} ${footY - 4}`, 8);
          case 'book':
            return shape(pt, 'rect', '#C1272D', { x: hx - 18, y: hy - 6, width: 36, height: 28 });
          case 'basket':
            return shape(pt, 'path', '#B5835A', { d: `M${hx - 30} ${hy} h60 l-8 34 h-44Z` });
          case 'phone':
            return shape(pt, 'rect', '#222', { x: hx - 9, y: hy - 30, width: 18, height: 32, rx: 4 });
          case 'flag':
            return (
              <g>
                {line(pt, `M${hx} ${hy + 20} L${hx} ${hy - 150 * k}`, 6)}
                {shape(pt, 'path', '#E86A17', { d: `M${hx} ${hy - 150 * k} h70 v44 h-70Z` })}
              </g>
            );
          case 'pot':
            return shape(pt, 'path', '#B5532A', { d: `M${hx - 26} ${hy - 4} Q${hx - 40} ${hy + 40} ${hx} ${hy + 44} Q${hx + 40} ${hy + 40} ${hx + 26} ${hy - 4}Z` });
          case 'sword':
            return line(pt, `M${hx} ${hy} L${hx + 20} ${hy - 140 * k}`, 7);
          case 'lamp':
            return shape(pt, 'path', '#F4B400', { d: `M${hx - 20} ${hy} Q${hx} ${hy + 22} ${hx + 20} ${hy}Z M${hx} ${hy - 4} q-8 -14 0 -28 q8 14 0 28Z` });
          default:
            return null;
        }
      })()}
    </g>
  );
}

// ================================================================= ANIMAL (quadruped)
function Animal({ s, pt }: { s: AnimalSpec; pt: Paint }) {
  const body = s.body ?? '#9E7B5A';
  const belly = s.belly ?? body;
  const size = Math.max(0.5, Math.min(1.6, s.size ?? 1));
  const bl = Math.max(0.6, Math.min(1.6, s.bodyLength ?? 1));
  const ll = Math.max(0.5, Math.min(2, s.legLength ?? 1));
  const neck = Math.max(0, Math.min(2.5, s.neck ?? 0.5));
  // fit everything in 512: scale group
  const legH = 110 * ll;
  const bodyRx = 120 * bl;
  const bodyRy = s.trunk ? 92 : 64;
  const bodyCy = 492 - legH - bodyRy * 0.55;
  const cx = 230;
  const headX = cx + bodyRx * 0.95 + 20;
  const headY = bodyCy - 30 - neck * 70;
  const headR = s.trunk ? 62 : 42;
  const legXs = [cx - bodyRx * 0.65, cx - bodyRx * 0.4, cx + bodyRx * 0.45, cx + bodyRx * 0.7];
  const bodyPath = `M${cx - bodyRx} ${bodyCy} a${bodyRx} ${bodyRy} 0 1 0 ${bodyRx * 2} 0 a${bodyRx} ${bodyRy} 0 1 0 ${-bodyRx * 2} 0`;
  const totalH = 492 - (headY - headR - (s.horns === 'antlers' ? 80 : 30));
  const scale = Math.min(size, 470 / Math.max(totalH, 1), 500 / (bodyRx * 2 + 160));
  const tailD =
    s.tail === 'bushy'
      ? `M${cx - bodyRx} ${bodyCy - 10} q-60 -10 -70 40 q30 -10 70 -20Z`
      : s.tail === 'tuft' || s.tail === 'long'
        ? `M${cx - bodyRx} ${bodyCy - 10} q-40 30 -36 ${s.tail === 'long' ? 110 : 80}`
        : `M${cx - bodyRx} ${bodyCy - 10} q-40 10 -50 50`;
  return (
    <g transform={`translate(${256 - 256 * scale} ${492 - 492 * scale}) scale(${scale})`}>
      {/* far legs */}
      {[legXs[1], legXs[3]].map((x, i) => shape(pt, 'rect', body, { x: x - 13, y: bodyCy, width: 26, height: 492 - bodyCy - 6, rx: 10, opacity: pt.lineArt ? 1 : 0.85 }, `fl${i}`))}
      {s.tail !== 'none' && (s.tail === 'bushy' ? shape(pt, 'path', body, { d: tailD }) : line(pt, tailD, 10))}
      {shape(pt, 'path', body, { d: bodyPath })}
      {!pt.silhouette && !pt.lineArt && belly !== body && shape(pt, 'path', belly, { d: `M${cx - bodyRx * 0.7} ${bodyCy + bodyRy * 0.45} Q${cx} ${bodyCy + bodyRy * 1.05} ${cx + bodyRx * 0.7} ${bodyCy + bodyRy * 0.45}Z`, stroke: 'none' })}
      {texture(pt, `ab${body.replace('#', '')}${bl}`, <path d={bodyPath} />, [cx - bodyRx, bodyCy - bodyRy, bodyRx * 2, bodyRy * 2])}
      {/* stripes / spots */}
      {s.stripes &&
        !pt.silhouette &&
        Array.from({ length: 7 }, (_, i) => {
          const x = cx - bodyRx * 0.7 + i * bodyRx * 0.23;
          return <path key={i} d={`M${x} ${bodyCy - bodyRy * 0.9} q12 ${bodyRy * 0.6} -4 ${bodyRy * 1.2}`} stroke={pt.lineArt ? pt.stroke : pt.fill(s.stripes as string)} strokeWidth={10} fill="none" strokeLinecap="round" />;
        })}
      {s.spots &&
        !pt.silhouette &&
        Array.from({ length: 9 }, (_, i) => (
          <ellipse key={i} cx={cx - bodyRx * 0.6 + ((i * 41) % 9) * bodyRx * 0.15} cy={bodyCy - bodyRy * 0.4 + ((i * 23) % 5) * bodyRy * 0.2} rx={12} ry={9} fill={pt.lineArt ? 'none' : pt.fill(s.spots as string)} stroke={pt.lineArt ? pt.stroke : 'none'} />
        ))}
      {/* humps */}
      {Array.from({ length: s.hump ?? 0 }, (_, i) => shape(pt, 'path', body, { d: `M${cx - 60 + i * 70} ${bodyCy - bodyRy + 10} q35 -90 70 0Z` }, `h${i}`))}
      {/* near legs */}
      {[legXs[0], legXs[2]].map((x, i) => shape(pt, 'rect', body, { x: x - 14, y: bodyCy, width: 28, height: 492 - bodyCy, rx: 10 }, `nl${i}`))}
      {/* neck */}
      {shape(pt, 'path', body, { d: `M${cx + bodyRx * 0.55} ${bodyCy - bodyRy * 0.6} L${headX - headR * 0.4} ${headY - 10} L${headX + headR * 0.1} ${headY + headR * 0.6} L${cx + bodyRx * 0.95} ${bodyCy + bodyRy * 0.1}Z` })}
      {s.mane && shape(pt, 'path', '#8D5524', { d: `M${headX - headR * 1.7} ${headY} a${headR * 1.7} ${headR * 1.7} 0 1 0 ${headR * 3.4} 0 a${headR * 1.7} ${headR * 1.7} 0 1 0 ${-headR * 3.4} 0` })}
      {/* ears behind head */}
      {s.ears === 'big' && shape(pt, 'path', body, { d: `M${headX - 10} ${headY - headR * 0.6} q-90 -20 -80 70 q40 50 90 0Z` })}
      {s.ears === 'long' && shape(pt, 'path', body, { d: `M${headX - 10} ${headY - headR * 0.7} q-10 -90 18 -100 q16 40 6 100Z` })}
      {/* head */}
      {shape(pt, 'circle', body, { cx: headX, cy: headY, r: headR })}
      {(s.snout ?? 'short') === 'long' && shape(pt, 'path', body, { d: `M${headX + headR * 0.3} ${headY - headR * 0.4} L${headX + headR * 1.6} ${headY + headR * 0.1} L${headX + headR * 1.5} ${headY + headR * 0.55} L${headX + headR * 0.4} ${headY + headR * 0.7}Z` })}
      {(s.ears ?? 'small') === 'pointy' && shape(pt, 'path', body, { d: `M${headX - headR * 0.6} ${headY - headR * 0.6} l10 -44 l26 36Z M${headX + headR * 0.1} ${headY - headR * 0.85} l18 -42 l18 40Z` })}
      {(s.ears ?? 'small') === 'small' && shape(pt, 'circle', body, { cx: headX - headR * 0.5, cy: headY - headR * 0.85, r: headR * 0.28 })}
      {s.ears === 'floppy' && shape(pt, 'path', body, { d: `M${headX - headR * 0.5} ${headY - headR * 0.8} q-30 10 -24 70 q26 -10 30 -66Z` })}
      {s.trunk && line(pt, `M${headX + headR * 0.7} ${headY + headR * 0.1} q50 60 18 ${110 + legH * 0.4} q-6 18 12 22`, 34)}
      {s.trunk && !pt.lineArt && <path d={`M${headX + headR * 0.7} ${headY + headR * 0.1} q50 60 18 ${110 + legH * 0.4} q-6 18 12 22`} stroke={pt.fill(body)} strokeWidth={26} fill="none" strokeLinecap="round" />}
      {s.tusks && shape(pt, 'path', '#FFFFF0', { d: `M${headX + headR * 0.6} ${headY + headR * 0.6} q30 30 70 14 q-40 -2 -56 -26Z` })}
      {s.horns === 'short' && line(pt, `M${headX - 12} ${headY - headR * 0.9} l-8 -28 M${headX + 14} ${headY - headR * 0.9} l8 -28`, 10)}
      {s.horns === 'curved' && line(pt, `M${headX - 14} ${headY - headR * 0.85} q-40 -30 -10 -60 M${headX + 14} ${headY - headR * 0.85} q40 -30 10 -60`, 11)}
      {s.horns === 'antlers' && line(pt, `M${headX - 10} ${headY - headR * 0.9} l-20 -70 m10 30 l-34 -10 m24 -40 l-30 -12 M${headX + 14} ${headY - headR * 0.9} l22 -70 m-10 30 l34 -10 m-24 -40 l30 -12`, 8)}
      {!pt.silhouette && !pt.lineArt && pt.style !== 'warli' && <circle cx={headX + headR * 0.35} cy={headY - headR * 0.15} r={6} fill="#111" />}
      {pt.silhouette && <circle cx={headX + headR * 0.35} cy={headY - headR * 0.15} r={6} fill="#FFB347" />}
    </g>
  );
}

// ================================================================= BIRD
function Bird({ s, pt }: { s: BirdSpec; pt: Paint }) {
  const body = s.body ?? '#1E5AA8';
  const wing = s.wing ?? body;
  const beak = s.beak ?? '#F4B400';
  const size = Math.max(0.4, Math.min(1.5, s.size ?? 1));
  const tail = s.tail ?? 'short';
  const flying = Boolean(s.flying);
  return (
    <g transform={`translate(${256 - 256 * size} ${492 - 492 * size}) scale(${size})`}>
      {tail === 'fan' &&
        Array.from({ length: 13 }, (_, i) => {
          const a = (-80 + i * 13.3) * (Math.PI / 180);
          const x = 200 + Math.sin(a) * 200;
          const y = 330 - Math.cos(a) * 200;
          return (
            <g key={i}>
              {line(pt, `M200 330 L${x} ${y}`, 6)}
              {shape(pt, 'ellipse', s.tailColor ?? '#2E8B57', { cx: x, cy: y, rx: 26, ry: 34, transform: `rotate(${(a * 180) / Math.PI} ${x} ${y})` })}
              {!pt.lineArt && !pt.silhouette && <circle cx={x} cy={y} r={10} fill={pt.fill('#1E5AA8')} />}
              {pt.silhouette && <circle cx={x} cy={y} r={8} fill="#FFB347" />}
            </g>
          );
        })}
      {tail === 'long' && shape(pt, 'path', s.tailColor ?? wing, { d: 'M170 350 q-110 40 -150 120 q70 -50 160 -95Z' })}
      {tail === 'short' && shape(pt, 'path', s.tailColor ?? wing, { d: 'M170 340 l-60 30 l60 10Z' })}
      {!flying && line(pt, 'M230 400 L222 488 M262 400 L270 488', 6)}
      {shape(pt, 'ellipse', body, { cx: 240, cy: 340, rx: 80, ry: 62 })}
      {texture(pt, `bd${body.replace('#', '')}`, <ellipse cx={240} cy={340} rx={80} ry={62} />, [160, 278, 160, 124])}
      {flying
        ? shape(pt, 'path', wing, { d: 'M220 320 Q150 160 60 170 Q150 230 200 350Z M260 320 Q330 150 430 150 Q340 230 280 350Z' })
        : shape(pt, 'path', wing, { d: 'M190 320 Q250 290 300 330 Q260 380 190 360Z' })}
      {shape(pt, 'path', body, { d: tail === 'fan' ? 'M290 300 Q300 200 320 170 L345 175 Q325 230 320 310Z' : 'M290 300 Q305 250 320 240 L340 250 Q330 280 318 320Z' })}
      {shape(pt, 'circle', body, { cx: 332, cy: tail === 'fan' ? 160 : 232, r: 30 })}
      {s.crest && line(pt, `M326 ${tail === 'fan' ? 130 : 202} l-6 -36 M334 ${tail === 'fan' ? 130 : 202} l4 -38 M342 ${tail === 'fan' ? 132 : 204} l12 -32`, 4)}
      {shape(pt, 'path', beak, { d: `M358 ${tail === 'fan' ? 156 : 228} l34 8 l-34 10Z` })}
      {!pt.silhouette && !pt.lineArt && pt.style !== 'warli' && <circle cx={340} cy={tail === 'fan' ? 152 : 224} r={5} fill="#111" />}
    </g>
  );
}

function Fish({ s, pt }: { s: FishSpec; pt: Paint }) {
  const body = s.body ?? '#F4B400';
  const fin = s.fin ?? '#E86A17';
  const k = Math.max(0.4, Math.min(1.6, s.size ?? 1));
  const d = 'M120 280 C180 180 340 180 390 280 C340 380 180 380 120 280Z';
  return (
    <g transform={`translate(${256 - 256 * k} ${280 - 280 * k}) scale(${k})`}>
      {shape(pt, 'path', fin, { d: 'M380 280 L470 210 L450 280 L470 350Z' })}
      {shape(pt, 'path', fin, { d: 'M240 200 q40 -60 90 -10Z' })}
      {shape(pt, 'path', body, { d })}
      {texture(pt, `fi${body.replace('#', '')}`, <path d={d} />, [120, 180, 270, 200])}
      {s.stripes && !pt.silhouette && [200, 250, 300].map((x) => <path key={x} d={`M${x} 205 q14 75 0 150`} stroke={pt.lineArt ? pt.stroke : pt.fill(s.stripes as string)} strokeWidth={12} fill="none" />)}
      {!pt.silhouette && !pt.lineArt && <circle cx={165} cy={265} r={10} fill="#111" />}
    </g>
  );
}

// ================================================================= NATURE
function Tree({ s, pt }: { s: TreeSpec; pt: Paint }) {
  const leaf = s.leaf ?? '#2E7D32';
  const trunk = s.trunk ?? '#6D4C41';
  const kind = s.kind ?? 'round';
  if (kind === 'pine')
    return (
      <g>
        {shape(pt, 'rect', trunk, { x: 236, y: 400, width: 40, height: 92 })}
        {[0, 1, 2].map((i) => shape(pt, 'path', leaf, { d: `M256 ${60 + i * 95} L${130 - i * 25} ${250 + i * 80} L${382 + i * 25} ${250 + i * 80}Z` }, i))}
      </g>
    );
  if (kind === 'palm')
    return (
      <g>
        {shape(pt, 'path', trunk, { d: 'M246 492 Q236 300 280 130 L296 134 Q262 300 270 492Z' })}
        {[-150, -110, -60, -20, 25, 70].map((a, i) => {
          const r = (a * Math.PI) / 180;
          const x = 288 + Math.cos(r) * 170;
          const y = 130 + Math.sin(r) * 110 + 60;
          return shape(pt, 'path', leaf, { d: `M288 130 Q${(288 + x) / 2} ${Math.min(130, y) - 50} ${x} ${y} Q${(288 + x) / 2} ${Math.min(130, y) - 10} 288 140Z` }, i);
        })}
      </g>
    );
  if (kind === 'bamboo')
    return (
      <g>
        {[190, 250, 310].map((x, i) => (
          <g key={i}>
            {shape(pt, 'rect', leaf, { x: x - 12, y: 60 + i * 30, width: 24, height: 432 - i * 30 })}
            {[0, 1, 2, 3].map((j) => line(pt, `M${x - 12} ${140 + j * 90 + i * 30} h24`, 4, j))}
            {shape(pt, 'path', leaf, { d: `M${x} ${150 + i * 40} q40 -30 80 -10 q-40 10 -80 10Z` })}
          </g>
        ))}
      </g>
    );
  if (kind === 'bare')
    return <g>{line(pt, 'M256 492 L256 260 M256 330 L180 230 M256 300 L340 200 M180 230 L150 170 M180 230 L210 160 M340 200 L380 150 M340 200 L320 130', 16)}</g>;
  const crown =
    kind === 'banyan'
      ? 'M70 260 Q60 120 200 110 Q260 40 340 110 Q470 120 450 260 Q470 330 340 320 L180 320 Q50 330 70 260Z'
      : 'M130 250 Q110 110 256 90 Q402 110 382 250 Q392 340 256 340 Q120 340 130 250Z';
  return (
    <g>
      {shape(pt, 'path', trunk, { d: 'M236 492 L242 300 L270 300 L276 492Z' })}
      {kind === 'banyan' && [120, 180, 340, 400].map((x) => line(pt, `M${x} 300 L${x + 4} 492`, 6, x))}
      {shape(pt, 'path', leaf, { d: crown })}
      {texture(pt, `tr${leaf.replace('#', '')}${kind}`, <path d={crown} />, [60, 40, 410, 300])}
      {(kind === 'blossom' || s.flower) &&
        !pt.silhouette &&
        Array.from({ length: 14 }, (_, i) => <circle key={i} cx={150 + ((i * 67) % 220)} cy={130 + ((i * 41) % 180)} r={10} fill={pt.lineArt ? 'none' : pt.fill(s.flower ?? '#F48FB1')} stroke={pt.lineArt ? pt.stroke : 'none'} />)}
    </g>
  );
}

function Mountain({ s, pt }: { s: MountainSpec; pt: Paint }) {
  const rock = s.rock ?? '#6D7B8D';
  const n = Math.max(1, Math.min(4, s.peaks ?? 2));
  const out: ReactElement[] = [];
  for (let i = 0; i < n; i++) {
    const cx = 512 * ((i + 0.5) / n);
    const h = 300 + ((i * 97) % 120);
    const w = 512 / n + 120;
    out.push(shape(pt, 'path', rock, { d: `M${cx - w / 2} 492 L${cx} ${492 - h} L${cx + w / 2} 492Z` }, `m${i}`));
    if (s.snow ?? true) out.push(shape(pt, 'path', '#FFFFFF', { d: `M${cx - h * 0.18} ${492 - h * 0.75} L${cx} ${492 - h} L${cx + h * 0.18} ${492 - h * 0.75} L${cx + h * 0.07} ${492 - h * 0.7} L${cx} ${492 - h * 0.78} L${cx - h * 0.08} ${492 - h * 0.7}Z` }, `s${i}`));
  }
  return <g>{out}</g>;
}

// ================================================================= BUILDINGS
function Building({ s, pt }: { s: BuildingSpec; pt: Paint }) {
  const wall = s.wall ?? '#E8D5B7';
  const roof = s.roof ?? '#B23A2B';
  const kind = s.kind ?? 'house';
  const win = (x: number, y: number, k: number | string) => shape(pt, 'rect', '#4A7A8C', { x, y, width: 36, height: 44 }, k);
  switch (kind) {
    case 'hut':
      return (
        <g>
          {shape(pt, 'rect', wall, { x: 140, y: 320, width: 232, height: 172 })}
          {shape(pt, 'path', roof, { d: 'M110 330 L256 170 L402 330Z' })}
          {texture(pt, 'hutroof', <path d="M110 330 L256 170 L402 330Z" />, [110, 170, 292, 160])}
          {shape(pt, 'path', '#5D4037', { d: 'M226 492 V400 Q256 370 286 400 V492Z' })}
        </g>
      );
    case 'temple':
      return (
        <g>
          {shape(pt, 'rect', wall, { x: 120, y: 330, width: 272, height: 162 })}
          {shape(pt, 'path', roof, { d: 'M180 330 Q190 200 256 70 Q322 200 332 330Z' })}
          {[0, 1, 2, 3].map((i) => line(pt, `M${200 + i * 4} ${300 - i * 50} h${112 - i * 8}`, 4, i))}
          {shape(pt, 'path', '#D4A537', { d: 'M248 70 h16 l-8 -40Z' })}
          {line(pt, 'M256 30 v-20 l30 8 l-30 8', 4)}
          {shape(pt, 'path', '#5D4037', { d: 'M226 492 V410 Q256 370 286 410 V492Z' })}
        </g>
      );
    case 'mosque':
      return (
        <g>
          {shape(pt, 'rect', wall, { x: 130, y: 300, width: 252, height: 192 })}
          {shape(pt, 'path', roof, { d: 'M170 300 Q170 180 256 160 Q342 180 342 300Z' })}
          {[100, 412].map((x) => (
            <g key={x}>
              {shape(pt, 'rect', wall, { x: x - 14, y: 160, width: 28, height: 332 })}
              {shape(pt, 'path', roof, { d: `M${x - 18} 160 Q${x} 110 ${x + 18} 160Z` })}
            </g>
          ))}
          {shape(pt, 'path', '#5D4037', { d: 'M226 492 V410 Q256 370 286 410 V492Z' })}
        </g>
      );
    case 'skyscraper':
    case 'tower':
      return (
        <g>
          {shape(pt, 'rect', wall, { x: 186, y: 40, width: 140, height: 452 })}
          {Array.from({ length: 9 }, (_, r) => [0, 1].map((c) => win(206 + c * 64, 70 + r * 46, `${r}${c}`)))}
        </g>
      );
    case 'factory':
      return (
        <g>
          {shape(pt, 'rect', '#8D8D8D', { x: 330, y: 150, width: 40, height: 200 })}
          {shape(pt, 'path', wall, { d: 'M80 492 V300 L170 250 V300 L260 250 V300 L350 250 V492Z' })}
          {[110, 200, 290].map((x) => win(x, 380, x))}
          {!pt.lineArt && <circle cx={360} cy={120} r={30} fill={pt.fill('#BDBDBD')} opacity={0.7} />}
        </g>
      );
    case 'castle':
      return (
        <g>
          {shape(pt, 'path', wall, { d: 'M100 492 V220 h40 v30 h30 v-30 h40 v30 h30 v-30 h40 v30 h30 v-30 h40 V492Z' })}
          {shape(pt, 'path', '#5D4037', { d: 'M226 492 V400 Q256 360 286 400 V492Z' })}
          {[150, 330].map((x) => win(x, 300, x))}
        </g>
      );
    case 'lighthouse':
      return (
        <g>
          {shape(pt, 'path', wall, { d: 'M210 492 L226 150 H286 L302 492Z' })}
          {[0, 1, 2].map((i) => shape(pt, 'path', roof, { d: `M${214 + i * 2} ${430 - i * 100} L${298 - i * 2} ${430 - i * 100} L${296 - i * 2} ${400 - i * 100} L${216 + i * 2} ${400 - i * 100}Z` }, i))}
          {shape(pt, 'rect', '#F4B400', { x: 230, y: 110, width: 52, height: 40 })}
          {shape(pt, 'path', roof, { d: 'M222 110 L256 70 L290 110Z' })}
        </g>
      );
    case 'school':
      return (
        <g>
          {shape(pt, 'rect', wall, { x: 70, y: 280, width: 372, height: 212 })}
          {shape(pt, 'path', roof, { d: 'M50 290 L256 170 L462 290Z' })}
          {[100, 170, 306, 376].map((x) => win(x, 330, x))}
          {shape(pt, 'rect', '#5D4037', { x: 226, y: 400, width: 60, height: 92 })}
          {line(pt, 'M256 170 v-60', 4)}
          {shape(pt, 'path', '#E86A17', { d: 'M256 110 h40 v24 h-40Z' })}
        </g>
      );
    default:
      return (
        <g>
          {shape(pt, 'rect', wall, { x: 120, y: 260, width: 272, height: 232 })}
          {shape(pt, 'path', roof, { d: 'M90 270 L256 130 L422 270Z' })}
          {Array.from({ length: Math.max(1, Math.min(3, s.floors ?? 1)) }, (_, f) => [150, 326].map((x) => win(x, 300 + f * 0, `${f}${x}`)))}
          {shape(pt, 'rect', '#5D4037', { x: 228, y: 390, width: 56, height: 102 })}
        </g>
      );
  }
}

// ================================================================= OBJECTS
function ObjectArt({ s, pt }: { s: ObjectSpec; pt: Paint }) {
  const c = s.color ?? '#E86A17';
  const a = s.accent ?? '#F4B400';
  switch (s.kind ?? 'rock') {
    case 'boat':
      return (
        <g>
          {shape(pt, 'path', c, { d: 'M60 360 L452 360 L390 440 L122 440Z' })}
          {line(pt, 'M256 360 L256 120', 8)}
          {shape(pt, 'path', a, { d: 'M262 130 L400 330 L262 330Z' })}
        </g>
      );
    case 'cloud':
      return shape(pt, 'path', s.color ?? '#FFFFFF', { d: 'M110 330 Q90 250 180 250 Q200 170 290 190 Q380 160 400 250 Q460 260 440 330Z' });
    case 'sun':
      return (
        <g>
          {Array.from({ length: 12 }, (_, i) => {
            const r = (i / 12) * Math.PI * 2;
            return line(pt, `M${256 + Math.cos(r) * 130} ${256 + Math.sin(r) * 130} L${256 + Math.cos(r) * 190} ${256 + Math.sin(r) * 190}`, 12, i);
          })}
          {shape(pt, 'circle', s.color ?? '#F4B400', { cx: 256, cy: 256, r: 110 })}
        </g>
      );
    case 'moon':
      return shape(pt, 'path', s.color ?? '#F7E3A1', { d: 'M300 90 A170 170 0 1 0 420 380 A140 140 0 1 1 300 90Z' });
    case 'star':
      return shape(pt, 'path', s.color ?? '#F4B400', { d: 'M256 70 L300 200 L440 200 L326 280 L370 420 L256 330 L142 420 L186 280 L72 200 L212 200Z' });
    case 'heart':
      return shape(pt, 'path', s.color ?? '#E63946', { d: 'M256 440 C80 320 90 160 190 150 C230 146 250 180 256 200 C262 180 282 146 322 150 C422 160 432 320 256 440Z' });
    case 'drop':
      return shape(pt, 'path', s.color ?? '#3A86FF', { d: 'M256 80 C320 200 380 260 380 330 A124 124 0 0 1 132 330 C132 260 192 200 256 80Z' });
    case 'leaf':
      return (
        <g>
          {shape(pt, 'path', s.color ?? '#2E7D32', { d: 'M110 420 Q120 120 420 100 Q400 400 110 420Z' })}
          {line(pt, 'M110 420 Q250 260 410 110', 5)}
        </g>
      );
    case 'flower':
      return (
        <g>
          {line(pt, 'M256 492 L256 260', 10)}
          {[0, 72, 144, 216, 288].map((r) => shape(pt, 'ellipse', c, { cx: 256, cy: 190, rx: 40, ry: 70, transform: `rotate(${r} 256 260)` }, r))}
          {shape(pt, 'circle', a, { cx: 256, cy: 260, r: 34 })}
        </g>
      );
    case 'pot':
      return shape(pt, 'path', s.color ?? '#B5532A', { d: 'M180 200 h152 l-20 30 Q420 300 330 440 H182 Q92 300 200 230Z' });
    case 'diya':
      return (
        <g>
          {shape(pt, 'path', s.color ?? '#B5532A', { d: 'M120 360 Q256 470 392 360 Q256 400 120 360Z' })}
          {shape(pt, 'path', a, { d: 'M256 350 Q220 280 256 200 Q292 280 256 350Z' })}
        </g>
      );
    case 'car':
      return (
        <g>
          {shape(pt, 'path', c, { d: 'M70 400 V340 L140 330 L190 260 H330 L380 330 L442 340 V400Z' })}
          {shape(pt, 'path', '#A3D5FF', { d: 'M205 275 H320 L355 330 H175Z' })}
          {[150, 362].map((x) => shape(pt, 'circle', '#222', { cx: x, cy: 410, r: 40 }, x))}
        </g>
      );
    case 'tractor':
      return (
        <g>
          {shape(pt, 'path', c, { d: 'M120 380 V280 H260 V200 H360 V380Z' })}
          {shape(pt, 'circle', '#222', { cx: 180, cy: 400, r: 70 })}
          {shape(pt, 'circle', '#222', { cx: 360, cy: 420, r: 46 })}
        </g>
      );
    case 'bicycle':
      return (
        <g>
          {[140, 372].map((x) => shape(pt, 'circle', 'none', { cx: x, cy: 380, r: 80 }, x))}
          {line(pt, 'M140 380 L230 260 L340 260 L372 380 M230 260 L260 380 L340 260 M220 230 H260 M340 260 L330 220 H370', 10)}
        </g>
      );
    case 'kite':
      return (
        <g>
          {shape(pt, 'path', c, { d: 'M256 60 L380 220 L256 380 L132 220Z' })}
          {line(pt, 'M256 380 Q220 440 280 470 Q240 490 256 512', 4)}
        </g>
      );
    case 'book':
      return shape(pt, 'path', c, { d: 'M90 160 Q170 130 252 170 V420 Q170 380 90 410Z M260 170 Q342 130 422 160 V410 Q342 380 260 420Z' });
    case 'globe':
      return (
        <g>
          {shape(pt, 'circle', '#3A86FF', { cx: 256, cy: 256, r: 180 })}
          {shape(pt, 'path', '#2E7D32', { d: 'M150 170 Q200 120 250 170 Q230 230 180 250 Q140 230 150 170Z M280 260 Q350 230 380 300 Q340 380 300 360 Q260 320 280 260Z' })}
        </g>
      );
    default:
      return shape(pt, 'path', s.color ?? '#8D8D8D', { d: 'M90 492 Q100 360 200 330 Q300 290 380 360 Q440 420 430 492Z' });
  }
}

// ================================================================= BACKGROUND
function Background({ s, pt, w, h }: { s: BackgroundSpec; pt: Paint; w: number; h: number }) {
  const time = s.time ?? 'day';
  const skyTop = s.skyTop ?? (time === 'night' ? '#0B1A3A' : time === 'sunset' ? '#F28C5E' : time === 'dawn' ? '#F7C6A3' : '#7EC8E3');
  const skyBottom = s.skyBottom ?? (time === 'night' ? '#1E3A6B' : time === 'sunset' ? '#FBD38D' : time === 'dawn' ? '#FFF1D6' : '#DFF3FA');
  const ground = s.ground ?? '#7CB342';
  const hz = h * Math.max(0.3, Math.min(0.8, s.horizon ?? 0.62));
  const layers = s.layers ?? ['hills'];
  const u = Math.min(w, h);
  const env = pt.envStroke;
  const fillBg = (c: string) => (env ? pt.bg(c) : pt.bg(c));
  const outline = env ? { stroke: env, strokeWidth: 3 } : { stroke: 'none' };
  // mini helper: background shapes use bg colours, line-art styles get outlines
  const bgShape = (d: string, c: string, key: string | number, extra: Record<string, unknown> = {}) => (
    <path key={key} d={d} fill={pt.lineArt ? 'none' : env ? 'none' : fillBg(c)} {...outline} {...extra} />
  );
  const els: ReactElement[] = [];
  const sprite = (node: ReactElement, x: number, y: number, size: number, key: string) => (
    // place a 512-unit sprite so its ground line (492) sits at y
    <g key={key} transform={`translate(${x - (size / 512) * 256} ${y - (size / 512) * 492}) scale(${size / 512})`}>{node}</g>
  );
  const ridge = (base: number, amp: number, seed: number, peaks = 5) => {
    let d = `M0 ${h} L0 ${base}`;
    for (let i = 0; i <= peaks * 2; i++) {
      const x = (w / (peaks * 2)) * i;
      const y = i % 2 ? base - amp * (0.6 + 0.4 * Math.abs(Math.sin(seed + i * 1.7))) : base - amp * 0.15 * Math.abs(Math.cos(seed + i));
      d += ` L${x} ${y}`;
    }
    return `${d} L${w} ${h}Z`;
  };
  const hills = (base: number, amp: number, seed: number) => {
    let d = `M0 ${h} L0 ${base}`;
    for (let i = 0; i <= 4; i++) d += ` Q${(w / 4) * (i - 0.5)} ${base - amp * (0.5 + 0.5 * Math.abs(Math.sin(seed + i)))} ${(w / 4) * i} ${base}`;
    return `${d} L${w} ${h}Z`;
  };

  for (const [li, layer] of layers.entries()) {
    switch (layer) {
      case 'mountains':
      case 'snowMountains':
      case 'glacier': {
        els.push(bgShape(ridge(hz, h * 0.28, 1 + li, 4), '#8FA8C8', `m1${li}`));
        els.push(bgShape(ridge(hz + h * 0.03, h * 0.2, 4 + li, 5), '#5C7FA6', `m2${li}`));
        if (layer !== 'mountains') {
          for (let i = 0; i < 4; i++) {
            const x = (w / 4) * (i + 0.5);
            const top = hz - h * 0.27 + (i % 2) * h * 0.06;
            els.push(<path key={`sn${li}${i}`} d={`M${x - w * 0.06} ${top + h * 0.08} L${x} ${top} L${x + w * 0.06} ${top + h * 0.08} L${x + w * 0.02} ${top + h * 0.07} L${x} ${top + h * 0.09} L${x - w * 0.02} ${top + h * 0.07}Z`} fill={pt.lineArt || env ? 'none' : '#FFFFFF'} {...(env ? outline : {})} />);
          }
        }
        if (layer === 'glacier') els.push(bgShape(`M${w * 0.2} ${hz + h * 0.05} Q${w * 0.5} ${hz - h * 0.02} ${w * 0.8} ${hz + h * 0.05} L${w * 0.65} ${hz + h * 0.2} L${w * 0.35} ${hz + h * 0.2}Z`, '#E3F2FD', `gl${li}`));
        break;
      }
      case 'hills':
        els.push(bgShape(hills(hz + h * 0.02, h * 0.1, 2 + li), '#9CCC65', `h1${li}`));
        els.push(bgShape(hills(hz + h * 0.08, h * 0.08, 5 + li), '#7CB342', `h2${li}`));
        break;
      case 'clouds':
        for (let i = 0; i < 3; i++) els.push(sprite(<ObjectArt s={{ type: 'object', kind: 'cloud' }} pt={pt} />, w * (0.2 + i * 0.3), h * (0.12 + (i % 2) * 0.08), u * 0.3, `cl${li}${i}`));
        break;
      default:
        break;
    }
  }
  // ground
  els.push(<rect key="ground" x={0} y={hz + h * 0.1} width={w} height={h} fill={pt.lineArt ? 'none' : fillBg(ground)} {...(env ? { stroke: env, strokeWidth: 3 } : {})} />);
  for (const [li, layer] of layers.entries()) {
    switch (layer) {
      case 'river':
        els.push(bgShape(`M${w * 0.42} ${hz + h * 0.1} Q${w * 0.3} ${hz + h * 0.22} ${w * 0.15} ${h} L${w * 0.75} ${h} Q${w * 0.55} ${hz + h * 0.25} ${w * 0.5} ${hz + h * 0.1}Z`, '#4FA3D9', `rv${li}`));
        break;
      case 'sea':
        els.push(bgShape(`M0 ${hz + h * 0.1} H${w} V${h} H0Z`, '#2F6FA8', `sea${li}`));
        for (let i = 0; i < 6; i++) els.push(<path key={`wv${i}`} d={`M${w * 0.05 + i * w * 0.16} ${hz + h * (0.16 + (i % 3) * 0.07)} q${w * 0.04} ${-h * 0.015} ${w * 0.08} 0`} stroke={env ?? '#FFFFFF'} strokeWidth={4} fill="none" opacity={0.8} />);
        break;
      case 'desert':
        els.push(bgShape(hills(hz + h * 0.1, h * 0.06, 3), '#E9C46A', `ds${li}`));
        break;
      case 'field':
        for (let i = 0; i < 8; i++) els.push(<path key={`fd${i}`} d={`M${-w * 0.2 + i * w * 0.2} ${h} L${w * 0.5} ${hz + h * 0.1}`} stroke={env ?? '#558B2F'} strokeWidth={4} opacity={0.6} />);
        break;
      case 'forest':
        for (let i = 0; i < 9; i++) {
          const x = (w / 8) * i + ((i * 53) % 40);
          els.push(sprite(<Tree s={{ type: 'tree', kind: i % 3 ? 'pine' : 'round', leaf: i % 2 ? '#2E7D32' : '#388E3C' }} pt={pt} />, x, hz + h * 0.12, u * (0.32 + (i % 3) * 0.06), `fr${li}${i}`));
        }
        break;
      case 'village':
        [0.15, 0.4, 0.7].forEach((t, i) => els.push(sprite(<Building s={{ type: 'building', kind: 'hut', wall: '#E8D5B7', roof: '#8D6E63' }} pt={pt} />, w * t, hz + h * 0.12, u * 0.28, `vh${i}`)));
        els.push(sprite(<Tree s={{ type: 'tree', kind: 'banyan' }} pt={pt} />, w * 0.88, hz + h * 0.12, u * 0.4, 'vt'));
        break;
      case 'city':
        for (let i = 0; i < 8; i++) els.push(sprite(<Building s={{ type: 'building', kind: i % 3 ? 'skyscraper' : 'house', wall: ['#90A4AE', '#B0BEC5', '#78909C'][i % 3] }} pt={pt} />, (w / 7) * i, hz + h * 0.12, u * (0.3 + (i % 3) * 0.12), `ct${i}`));
        break;
      case 'temple':
        els.push(sprite(<Building s={{ type: 'building', kind: 'temple', wall: '#F3E6CC', roof: '#E86A17' }} pt={pt} />, w * 0.5, hz + h * 0.12, u * 0.6, 'tp'));
        break;
      default:
        break;
    }
  }
  const sunMoon = time === 'night' ? 'moon' : 'sun';
  return (
    <g>
      <defs>
        <linearGradient id="kit-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={pt.bg(skyTop)} />
          <stop offset="1" stopColor={pt.bg(skyBottom)} />
        </linearGradient>
      </defs>
      <rect width={w} height={h} fill={pt.lineArt ? pt.bg(skyTop) : env || pt.silhouette ? pt.bg(skyTop) : 'url(#kit-sky)'} />
      {time === 'night' && !pt.lineArt && Array.from({ length: 40 }, (_, i) => <circle key={`st${i}`} cx={((i * 97) % 100) / 100 * w} cy={((i * 61) % 100) / 100 * hz * 0.8} r={2.2} fill="#FFFFFF" opacity={0.8} />)}
      {sprite(<ObjectArt s={{ type: 'object', kind: sunMoon }} pt={pt} />, w * 0.78, h * 0.2 + u * 0.12, u * 0.22, 'sm')}
      {els}
    </g>
  );
}

// ================================================================= entry
export function AssetSvg({ spec, style, width, height }: { spec: AssetSpec; style: string; width: number; height: number }) {
  const pt = painter(style);
  const isBg = spec.type === 'background';
  const node = (() => {
    switch (spec.type) {
      case 'person':
        return <Person s={spec} pt={pt} />;
      case 'animal':
        return <Animal s={spec} pt={pt} />;
      case 'bird':
        return <Bird s={spec} pt={pt} />;
      case 'fish':
        return <Fish s={spec} pt={pt} />;
      case 'tree':
        return <Tree s={spec} pt={pt} />;
      case 'mountain':
        return <Mountain s={spec} pt={pt} />;
      case 'building':
        return <Building s={spec} pt={pt} />;
      case 'object':
        return <ObjectArt s={spec} pt={pt} />;
      case 'background':
        return <Background s={spec} pt={pt} w={width} h={height} />;
      default:
        return null;
    }
  })();
  return (
    <svg width={width} height={height} viewBox={isBg ? `0 0 ${width} ${height}` : '0 0 512 512'} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="kit-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#000" floodOpacity="0.28" />
        </filter>
        <filter id="kit-ink">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves={2} seed={5} />
          <feDisplacementMap in="SourceGraphic" scale={6} />
          <feGaussianBlur stdDeviation={0.8} />
        </filter>
      </defs>
      <g filter={pt.shadow && !isBg ? 'url(#kit-shadow)' : pt.blur ? 'url(#kit-ink)' : undefined}>{node}</g>
    </svg>
  );
}
