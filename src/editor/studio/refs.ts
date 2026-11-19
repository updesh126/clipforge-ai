/**
 * "Point at anything": what the user points at in the Studio, numbered in the order they are made.
 * A ref travels with the next chat message so the AI knows exactly which moment, stretch, area or clip is meant.
 */
import { formatTimecode } from '../../utils/format.ts';

export type RefKind = 'moment' | 'range' | 'region' | 'clip';

export interface StudioRef {
  n: number;
  kind: RefKind;
  t?: number; // moment, and the frame a region was drawn on
  t0?: number; // range
  t1?: number;
  box?: { x: number; y: number; w: number; h: number }; // region, 0-100 % of the frame
  itemId?: string; // clip
  label?: string; // clip name, for the pill
}

export const REF_COLOR: Record<RefKind, string> = {
  moment: 'var(--color-ref-moment)',
  range: 'var(--color-ref-range)',
  region: 'var(--color-ref-region)',
  clip: 'var(--color-ref-clip)',
};

export function refText(r: StudioRef): string {
  if (r.kind === 'moment') return formatTimecode(r.t ?? 0, true);
  if (r.kind === 'range') return `${formatTimecode(r.t0 ?? 0, true)}–${formatTimecode(r.t1 ?? 0, true)}`;
  if (r.kind === 'region') return `area · ${formatTimecode(r.t ?? 0)}`;
  return r.label || 'clip';
}

/** Where a ref sends the playhead when its pill is clicked. */
export const refTime = (r: StudioRef) => r.t ?? r.t0 ?? 0;

/** The next number: one more than the highest in use (numbers stay stable while the message is being written). */
export const nextN = (refs: StudioRef[]) => refs.reduce((m, r) => Math.max(m, r.n), 0) + 1;
