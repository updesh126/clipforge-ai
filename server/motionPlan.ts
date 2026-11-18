/**
 * Motion "Mix": decide which scenes become moving clips and which stay still paintings.
 * Moving every scene is slow (each clip costs GPU time); most stories only need movement where something
 * actually moves. Scenes are scored for motion value and the best ~40% are animated, without leaving a long
 * run of still scenes. Pure function — easy to test, no I/O.
 */
import type { StoryPlan } from './storyScenes.ts';

export type MotionMode = 'off' | 'mix' | 'all';

// something visibly happening (people / animals doing things)
const ACTION = /\b(walk|walks|walked|walking|run|runs|ran|running|fl(y|ies|ew)|flying|jump|jumps|jumped|danc(e|es|ed|ing)|swim|swims|row|rows|rowing|climb|climbs|climbed|chas(e|es|ed|ing)|play|plays|played|playing|throw|throws|threw|catch|catches|caught|pour|pours|poured|pouring|flow|flows|flowed|flowing|swam|rowed|spin|spins|wav(e|es|ed|ing)|rid(e|es|ing)|rode|march|marches|lift|lifts|carr(y|ies|ied)|push|pulls?|fight|fights|race|races|leap|leaps|sway|sways|fall|falls|fell)\b/i;
// nature that moves on its own
const NATURE = /\b(river|stream|waterfall|waves?|sea|ocean|rain|raining|storm|snow|snowing|wind|breeze|fire|flames?|smoke|candle|lamp|lantern|fireflies|firefly|birds?|butterfl(y|ies)|clouds|leaves|flowers? swaying|boat|flag|kite|festival|crowd|dance)\b/i;
// still moments — a painting suits them
const STILL = /\b(sleeps?|slept|asleep|sits? quietly|thinks?|remembers?|silent|silence|still|waits?|looks? at the stars|portrait|once upon a time)\b/i;

export interface MotionChoice {
  animate: boolean[];
  /** why each scene got its score (for logs / UI) */
  scores: number[];
}

export function motionScore(plan: StoryPlan, text: string, index: number, total: number): number {
  let s = 0;
  if (ACTION.test(text)) s += 3;
  if (NATURE.test(text)) s += 2;
  if (plan.actors?.some((a) => ['walkIn', 'walkAcross', 'walkOut', 'fly', 'bob', 'sway'].includes(String(a.motion)))) s += 1;
  if (plan.actors?.length) s += 1;
  if (index === 0) s += 2; // the hook should move
  if (index === total - 1) s += 1; // a living final image
  if (STILL.test(text)) s -= 2;
  if (plan.motion) s -= 4; // a full-screen explainer graphic covers this scene anyway
  return s;
}

/**
 * Which scenes to animate.
 *   off → none · all → every scene · mix → the best ~40% (at least 1), with no more than two still scenes in a row
 */
export function chooseMotion(plans: StoryPlan[], texts: string[], mode: MotionMode, share = 0.4): MotionChoice {
  const n = plans.length;
  const scores = plans.map((p, i) => motionScore(p, texts[i] ?? '', i, n));
  if (mode === 'off' || n === 0) return { animate: plans.map(() => false), scores };
  if (mode === 'all') return { animate: plans.map((p) => !p.motion), scores };
  const budget = Math.max(1, Math.round(n * share));
  const order = scores.map((s, i) => ({ s, i })).sort((a, b) => b.s - a.s || a.i - b.i);
  const animate = plans.map(() => false);
  for (const { i } of order.slice(0, budget)) if (!plans[i].motion) animate[i] = true;
  // keep it alive: break up runs of 3+ still scenes with the best scene in the run (up to half of all scenes)
  const cap = Math.max(budget, Math.ceil(n / 2));
  let run: number[] = [];
  const flush = () => {
    if (run.length >= 3 && animate.filter(Boolean).length < cap) {
      const best = run.filter((i) => !plans[i].motion).sort((a, b) => scores[b] - scores[a])[0];
      if (best !== undefined) animate[best] = true;
    }
    run = [];
  };
  for (let i = 0; i < n; i++) {
    if (animate[i]) flush();
    else run.push(i);
  }
  flush();
  return { animate, scores };
}
