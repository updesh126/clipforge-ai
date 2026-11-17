import { CATEGORIES, EFFECTS_LIB } from '../motion/catalog.ts';
import { SEQUENCES } from '../motion/sequences.ts';
import { EFFECTS } from './catalog.ts';
import { FxBrowser, type FxEntry, type FxGroup } from './FxBrowser.tsx';
import type { EffectId } from './types.ts';

/**
 * Motion  = graphics that sit ON the picture (titles, charts, maps, callouts, layouts …).
 * Effects = things that act on the picture: camera moves, transitions across a cut, and atmosphere (particles, light, film looks).
 */
const EFFECT_CATEGORIES = new Set(['atmosphere', 'transitions']);

const MOTION_GROUPS: FxGroup[] = CATEGORIES.filter((c) => !EFFECT_CATEGORIES.has(c.id)).map((c) => ({ id: c.id, label: c.label, blurb: c.blurb }));

const MOTION_ENTRIES: FxEntry[] = [
  ...Object.values(SEQUENCES).map((s) => ({ id: s.id, label: s.label, description: s.description, group: 'sequences', duration: s.duration, kind: 'motion' as const })),
  ...Object.values(EFFECTS_LIB)
    .filter((e) => !EFFECT_CATEGORIES.has(e.category))
    .map((e) => ({ id: e.id, label: e.label, description: e.description, group: e.category, duration: e.duration, kind: 'motion' as const })),
];

const CAMERA_MOVES: EffectId[] = ['pushIn', 'pullOut', 'panLeft', 'panRight', 'tiltUp', 'slowZoom', 'zoomPunch', 'shake'];
const CUT_EFFECTS: EffectId[] = ['fadeIn', 'fadeOut', 'flash', 'whipPan', 'irisWipe'];

const EFFECT_GROUPS: FxGroup[] = [
  { id: 'camera', label: 'Camera', blurb: 'Push, pull, pan, tilt, zoom and shake — moves the picture layers with 2.5D parallax' },
  { id: 'transitions', label: 'Transitions', blurb: 'Place across a cut: fades, flashes, whip pans, wipes, iris, paper tear' },
  { id: 'particles', label: 'Particles', blurb: 'Dust, rain, snow, confetti, sparks, embers, fireflies' },
  { id: 'light', label: 'Light & film', blurb: 'Light rays, sweeps, glow, grain, vignette, leaks, VHS, glitch, colour wash' },
];

const camera = (id: EffectId, group: string): FxEntry => ({ id, label: EFFECTS[id].label.replace(/^Camera (.)/, (_, c: string) => c.toUpperCase()), description: EFFECTS[id].description, group, duration: EFFECTS[id].duration, kind: 'camera' });

const EFFECT_ENTRIES: FxEntry[] = [
  ...CAMERA_MOVES.map((id) => camera(id, 'camera')),
  ...CUT_EFFECTS.map((id) => camera(id, 'transitions')),
  ...Object.values(EFFECTS_LIB)
    .filter((e) => EFFECT_CATEGORIES.has(e.category))
    .map((e) => ({
      id: e.id,
      label: e.label,
      description: e.description,
      group: e.category === 'transitions' ? 'transitions' : e.base === 'particles' ? 'particles' : 'light',
      duration: e.duration,
      kind: 'motion' as const,
    })),
];

type Aspect = { width: number; height: number };

/** Motion graphics library: click to preview, + to add at the playhead. */
export function MotionLibrary({ onAdd, aspect }: { onAdd: (fx: string) => void; aspect: Aspect }) {
  return <FxBrowser entries={MOTION_ENTRIES} groups={MOTION_GROUPS} initialGroup="sequences" initialId="bigStat" noun="motion graphics" aspect={aspect} onAdd={(e) => onAdd(e.id)} />;
}

/** Effects library: camera moves, transitions, particles, light & film looks. Click to preview, + to add. */
export function EffectsLibrary({ onAddEffect, onAddMotion, aspect }: { onAddEffect: (e: EffectId) => void; onAddMotion: (fx: string) => void; aspect: Aspect }) {
  return (
    <FxBrowser
      entries={EFFECT_ENTRIES}
      groups={EFFECT_GROUPS}
      initialGroup="camera"
      initialId="pushIn"
      noun="effects"
      aspect={aspect}
      onAdd={(e) => (e.kind === 'camera' ? onAddEffect(e.id as EffectId) : onAddMotion(e.id))}
    />
  );
}
