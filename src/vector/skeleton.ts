/**
 * 2-D character skeleton with forward kinematics.
 * Proportions are measured in head-heights (H) and depend on age/build/height, so the same character keeps
 * identical proportions in every pose. A pose is a set of joint angles (+ an optional cycle phase for
 * walk/run), solved into joint positions on a 512×512 canvas with the ground at y = 492.
 */
import { type Pt, lerp, polar } from './geom.ts';

export type Pose = 'stand' | 'walk' | 'run' | 'sit' | 'jump' | 'wave' | 'point' | 'cheer' | 'think';
export const POSES: Pose[] = ['stand', 'walk', 'run', 'sit', 'jump', 'wave', 'point', 'cheer', 'think'];

export interface Body {
  H: number; // head height in px
  headR: number; // head radius (x)
  shoulderW: number; // half width
  waistW: number;
  hipW: number;
  torso: number; // neck base → hip
  upperArm: number;
  foreArm: number;
  thigh: number;
  shin: number;
  limbW: number; // arm thickness
  legW: number;
  belly: number; // 0..1 round tummy
}

export interface Proportions {
  age: 'child' | 'teen' | 'adult' | 'elder';
  build: 'slim' | 'average' | 'broad' | 'round';
  height: number; // 0.85–1.15
  headScale: number; // theme stylisation
}

/** Body measurements in px from age/build/height. Head heights: child 4.3, teen 5.6, adult 6.6, elder 6.3. */
export function bodyOf(p: Proportions): Body {
  const heads = { child: 4.3, teen: 5.6, adult: 6.6, elder: 6.3 }[p.age];
  const tall = { child: 300, teen: 385, adult: 430, elder: 410 }[p.age] * p.height;
  const H = (tall / heads) * p.headScale;
  const rest = tall - H; // everything below the head keeps the real body height
  const w = { slim: 0.85, average: 1, broad: 1.18, round: 1.22 }[p.build];
  const legShare = p.age === 'child' ? 0.44 : 0.5;
  const leg = rest * legShare;
  return {
    H,
    headR: H * 0.47,
    shoulderW: rest * 0.15 * w * (p.age === 'child' ? 1.05 : 1),
    waistW: rest * 0.105 * w * (p.build === 'round' ? 1.35 : 1),
    hipW: rest * 0.12 * w * (p.build === 'round' ? 1.25 : 1),
    torso: rest * (1 - legShare) * 0.92,
    upperArm: rest * 0.21,
    foreArm: rest * 0.2,
    thigh: leg * 0.5,
    shin: leg * 0.5,
    limbW: rest * 0.068 * (p.build === 'slim' ? 0.85 : p.build === 'average' ? 1 : 1.2),
    legW: rest * 0.085 * (p.build === 'slim' ? 0.85 : p.build === 'average' ? 1 : 1.2),
    belly: p.build === 'round' ? 1 : p.age === 'elder' ? 0.3 : 0,
  };
}

/**
 * Joint angles in degrees. Limb angles are measured from straight down; positive swings the limb OUTWARD
 * (away from the body's centre line) for that side. Elbow/knee add to the parent angle.
 */
export interface PoseAngles {
  lShoulder: number;
  lElbow: number;
  rShoulder: number;
  rElbow: number;
  lHip: number;
  lKnee: number;
  rHip: number;
  rKnee: number;
  lift: number; // whole body up (jump) in px
  bob: number; // small vertical bounce in px
  lean: number; // torso tilt (deg, + = right)
  headTilt: number;
  footLiftL: number; // px foot raised (walk/run step)
  footLiftR: number;
  sit: 'none' | 'crossLegged' | 'chair';
}

/** Pose library. phase ∈ [0,1) animates cyclic poses (walk, run, wave) so frame sequences loop. */
export function poseAngles(pose: Pose, phase = 0): PoseAngles {
  const s = Math.sin(phase * Math.PI * 2);
  const c = Math.cos(phase * Math.PI * 2);
  const base: PoseAngles = { lShoulder: 9, lElbow: -6, rShoulder: 9, rElbow: -6, lHip: 3, lKnee: 0, rHip: 3, rKnee: 0, lift: 0, bob: 0, lean: 0, headTilt: 0, footLiftL: 0, footLiftR: 0, sit: 'none' };
  switch (pose) {
    case 'walk':
      // contact/passing cycle: one leg plants while the other lifts its foot; arms counter-swing
      return {
        ...base,
        lShoulder: 10 + 14 * s,
        lElbow: -12 - 8 * Math.max(0, s),
        rShoulder: 10 - 14 * s,
        rElbow: -12 - 8 * Math.max(0, -s),
        lHip: 4 + 5 * Math.max(0, s),
        rHip: 4 + 5 * Math.max(0, -s),
        lKnee: -28 * Math.max(0, s),
        rKnee: -28 * Math.max(0, -s),
        footLiftL: 22 * Math.max(0, s),
        footLiftR: 22 * Math.max(0, -s),
        bob: -5 * Math.abs(c),
      };
    case 'run':
      return {
        ...base,
        lShoulder: 30 + 30 * s,
        lElbow: -95,
        rShoulder: 30 - 30 * s,
        rElbow: -95,
        lHip: 8 + 10 * Math.max(0, s),
        rHip: 8 + 10 * Math.max(0, -s),
        lKnee: -70 * Math.max(0.1, s),
        rKnee: -70 * Math.max(0.1, -s),
        footLiftL: 48 * Math.max(0, s),
        footLiftR: 48 * Math.max(0, -s),
        lift: 14 + 10 * Math.abs(c),
        lean: 4,
      };
    case 'sit':
      return { ...base, lShoulder: 20, lElbow: -40, rShoulder: 20, rElbow: -40, lHip: 84, rHip: 84, lKnee: -158, rKnee: -158, sit: 'crossLegged' };
    case 'jump':
      return { ...base, lShoulder: 150 + 8 * s, lElbow: 10, rShoulder: 150 - 8 * s, rElbow: 10, lHip: 16, rHip: 16, lKnee: -55, rKnee: -55, lift: 70 + 18 * Math.abs(s), footLiftL: 30, footLiftR: 30 };
    case 'wave':
      return { ...base, rShoulder: 125, rElbow: 40 + 22 * s, headTilt: -4 };
    case 'point':
      return { ...base, rShoulder: 88, rElbow: 2 };
    case 'cheer':
      return { ...base, lShoulder: 155, lElbow: 12, rShoulder: 155, rElbow: 12, bob: -6 * Math.abs(s) };
    case 'think':
      return { ...base, rShoulder: 18, rElbow: -150, headTilt: 7 };
    default:
      return { ...base, bob: -1.5 * s };
  }
}

export interface Joints {
  head: Pt; // head centre
  neck: Pt; // neck base (top of torso)
  hip: Pt; // pelvis centre
  shoulder: [Pt, Pt]; // [left, right] as seen by the viewer
  elbow: [Pt, Pt];
  hand: [Pt, Pt];
  hipJ: [Pt, Pt];
  knee: [Pt, Pt];
  foot: [Pt, Pt];
  ground: number;
  angles: PoseAngles;
  airborne: number; // px above ground (for the contact shadow)
}

/** Solve joint positions. Legs are planted so the lowest foot touches the ground (unless jumping). */
export function solve(b: Body, a: PoseAngles, cx = 256, ground = 492): Joints {
  const legLen = b.thigh + b.shin;
  // pelvis height: straight legs stand on the ground; cross-legged sitting puts the pelvis near the ground
  let hipY = ground - legLen * 0.98;
  if (a.sit === 'crossLegged') hipY = ground - b.legW * 1.4;
  const side = (k: -1 | 1, hip: number, knee: number, lift: number) => {
    const hipJ: Pt = [cx + k * b.hipW * 0.55, hipY];
    // outward angle → mirror for the left side
    const kneeP = polar(hipJ, k * hip, b.thigh);
    let footP = polar(kneeP, k * (hip + knee), b.shin);
    if (lift) footP = [footP[0], footP[1] - lift];
    return { hipJ, kneeP, footP };
  };
  const L = side(-1, a.lHip, a.lKnee, a.footLiftL);
  const R = side(1, a.rHip, a.rKnee, a.footLiftR);
  // shift so the lowest foot rests on the ground (bent knees would otherwise float)
  const lowest = Math.max(L.footP[1], R.footP[1]);
  const drop = a.sit === 'crossLegged' ? 0 : ground - lowest;
  const up = -a.lift + a.bob + drop;
  const mv = (p: Pt): Pt => [p[0], p[1] + up];
  const hip: Pt = mv([cx, hipY]);
  const neck: Pt = [hip[0] + Math.sin((a.lean * Math.PI) / 180) * b.torso, hip[1] - b.torso];
  const head: Pt = [neck[0], neck[1] - b.H * 0.06 - b.headR * 1.02];
  const arm = (k: -1 | 1, sh: number, el: number) => {
    const s: Pt = [neck[0] + k * b.shoulderW * 0.86, neck[1] + b.limbW * 0.55];
    const e = polar(s, k * sh, b.upperArm);
    const h = polar(e, k * (sh + el), b.foreArm);
    return { s, e, h };
  };
  const la = arm(-1, a.lShoulder, a.lElbow);
  const ra = arm(1, a.rShoulder, a.rElbow);
  return {
    head,
    neck,
    hip,
    shoulder: [la.s, ra.s],
    elbow: [la.e, ra.e],
    hand: [la.h, ra.h],
    hipJ: [mv(L.hipJ), mv(R.hipJ)],
    knee: [mv(L.kneeP), mv(R.kneeP)],
    foot: [mv(L.footP), mv(R.footP)],
    ground,
    angles: a,
    airborne: Math.max(0, ground - Math.max(mv(L.footP)[1], mv(R.footP)[1])),
  };
}

export const mid = (a: Pt, b: Pt, t = 0.5): Pt => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
