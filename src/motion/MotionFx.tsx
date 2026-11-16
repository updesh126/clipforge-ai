/**
 * The one Remotion component behind every motion graphic: plays an effect preset (base renderer + params)
 * or a whole sequence (timed steps, each its own effect) — from the editor timeline or a library preview.
 */
import type { ReactElement } from 'react';
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import { useMotion, type Motion, type Props } from './core.tsx';
import { EFFECTS_LIB, type BaseId } from './catalog.ts';
import { resolveStep, SEQUENCES, type SeqDef } from './sequences.ts';
import * as typo from './renderers/typography.tsx';
import * as data from './renderers/data.tsx';
import * as maps from './renderers/maps.tsx';
import * as ann from './renderers/annotate.tsx';
import * as lay from './renderers/layouts.tsx';
import * as fx from './renderers/fx.tsx';

export const RENDERERS: Record<BaseId, (m: Motion) => ReactElement> = {
  textReveal: typo.textReveal,
  paperTitle: typo.paperTitle,
  marker: typo.marker,
  quoteCard: typo.quoteCard,
  lowerThird: typo.lowerThird,
  kinetic: typo.kinetic,
  scroller: typo.scroller,
  chapter: typo.chapter,
  textSwap: typo.textSwap,
  circularText: typo.circularText,
  counter: data.counter,
  bars: data.bars,
  lineChart: data.lineChart,
  pie: data.pie,
  gauge: data.gauge,
  pictogram: data.pictogram,
  compare: data.compare,
  ranking: data.ranking,
  funnel: data.funnel,
  bubbles: data.bubbles,
  heatmap: data.heatmap,
  waterfall: data.waterfall,
  worldMap: maps.worldMap,
  globe: maps.globe,
  scribble: ann.scribble,
  arrow: ann.arrow,
  connector: ann.connector,
  bracket: ann.bracket,
  magnifier: ann.magnifier,
  stamp: ann.stamp,
  redact: ann.redact,
  sticky: ann.sticky,
  bubble: ann.bubble,
  numbered: ann.numbered,
  documentCard: ann.documentCard,
  cursor: ann.cursor,
  shape: ann.shape,
  burst: ann.burst,
  gridReveal: ann.gridReveal,
  split: lay.split,
  cards: lay.cards,
  browser: lay.browser,
  search: lay.search,
  chat: lay.chat,
  socialPost: lay.socialPost,
  newspaper: lay.newspaper,
  evidenceBoard: lay.evidenceBoard,
  mythFact: lay.mythFact,
  timeline: lay.timeline,
  flow: lay.flow,
  network: lay.network,
  causeEffect: lay.causeEffect,
  tree: lay.tree,
  science: fx.science,
  coins: fx.coins,
  currency: fx.currency,
  moneyFlow: fx.moneyFlow,
  particles: fx.particles,
  look: fx.look,
  transition: fx.transition,
  audioViz: fx.audioViz,
};

function EffectView({ id, props }: { id: string; props: Props }) {
  const def = EFFECTS_LIB[id] ?? EFFECTS_LIB.wordReveal;
  const m = useMotion({ ...def.defaults, ...props });
  return <AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none' }}>{RENDERERS[def.base](m)}</AbsoluteFill>;
}

function SequenceView({ seq, props }: { seq: SeqDef; props: Props }) {
  const { fps } = useVideoConfig();
  const params = { ...seq.params, ...props };
  const backdrop = String(props.bg ?? seq.bg ?? '');
  const showBackdrop = backdrop && props.backdrop !== false && props.backdrop !== 'false';
  return (
    <AbsoluteFill>
      {showBackdrop && <AbsoluteFill style={{ background: backdrop }} />}
      {seq.steps.map((st, i) => (
        <Sequence key={i} from={Math.round(st.at * fps)} durationInFrames={Math.max(1, Math.round(st.dur * fps))} layout="none">
          <EffectView id={st.fx} props={{ ...resolveStep(st, params), __dur: st.dur }} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

/** Template entry point: props.fx = an effect preset id or a sequence id. */
export function MotionFx({ props }: { props: Props }): ReactElement {
  const id = String(props.fx ?? 'wordReveal');
  const seq = SEQUENCES[id];
  return seq ? <SequenceView seq={seq} props={props} /> : <EffectView id={id} props={props} />;
}
