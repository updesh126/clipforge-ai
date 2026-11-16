/**
 * Easing curves for the motion engine. Every curve maps t ∈ [0,1] → progress (may overshoot for back/elastic).
 */
export type EaseName = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'back' | 'bounce' | 'elastic' | 'spring' | 'step' | 'expo' | 'editorial';
export const EASE_NAMES: EaseName[] = ['easeOut', 'easeInOut', 'easeIn', 'linear', 'back', 'bounce', 'elastic', 'spring', 'expo', 'editorial', 'step'];

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);

/** Cubic Bézier easing (CSS-style control points), solved with Newton iterations. */
export function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sx = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sy = (t: number) => ((ay * t + by) * t + cy) * t;
  const dx = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    let t = x;
    for (let i = 0; i < 6; i++) {
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= (sx(t) - x) / d;
    }
    return sy(clamp01(t));
  };
}

const editorial = bezier(0.22, 1, 0.36, 1); // fast start, long gentle settle — the "explainer" feel

function bounceOut(t: number) {
  const n = 7.5625;
  const d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
}

export const EASINGS: Record<EaseName, (t: number) => number> = {
  linear: (t) => clamp01(t),
  easeIn: (t) => clamp01(t) ** 3,
  easeOut: (t) => 1 - (1 - clamp01(t)) ** 3,
  easeInOut: (t) => {
    const x = clamp01(t);
    return x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2;
  },
  back: (t) => {
    const x = clamp01(t);
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
  },
  bounce: (t) => bounceOut(clamp01(t)),
  elastic: (t) => {
    const x = clamp01(t);
    if (x === 0 || x === 1) return x;
    return 2 ** (-10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
  },
  // critically-damped-ish spring with a small overshoot
  spring: (t) => {
    const x = clamp01(t);
    return 1 - Math.exp(-6 * x) * Math.cos(9 * x) + (x === 1 ? 0 : 0);
  },
  step: (t) => Math.floor(clamp01(t) * 6) / 6,
  expo: (t) => {
    const x = clamp01(t);
    return x === 1 ? 1 : 1 - 2 ** (-10 * x);
  },
  editorial: (t) => editorial(clamp01(t)),
};

export const ease = (name: unknown): ((t: number) => number) => EASINGS[(name as EaseName) in EASINGS ? (name as EaseName) : 'editorial'];
