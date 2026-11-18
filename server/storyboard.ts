/**
 * Storyboard preview: runs the same planning as Script → video (planner, video-type rules, [tags], accents,
 * Motion mix) but stops before any voice or painting, and explains every line as a task:
 * what we see, where and when, what's on screen, what the camera does, how the scene starts and whether it moves.
 * Takes seconds, so the plan can be checked, edited and locked into the script as [tags] before making the video.
 */
import type { EditItem } from '../src/editor/types.ts';
import { SEQUENCES } from '../src/motion/sequences.ts';
import { EFFECTS_LIB } from '../src/motion/catalog.ts';
import { ART_STYLE_LABELS, EFFECTS, TEMPLATES } from '../src/editor/catalog.ts';
import { VIDEO_TYPES } from '../src/videotypes.ts';
import { chooseMotion } from './motionPlan.ts';
import { stylisedScene } from './imagegen.ts';
import { accentTag } from './autoAccents.ts';
import type { ProgressFn } from './progress.ts';
import { directedExtras, directedTransition, planScenes, sceneAtmosphere, storyGraphic, styleTransition, type ScriptVideoOptions } from './scriptVideo.ts';

export interface BoardItem {
  id: string; // catalogue id (fx, effect or template)
  label: string;
  what: string; // one line: what it does on screen
}

export interface BoardScene {
  i: number;
  text: string; // the narration (tags removed)
  seconds: number; // estimated (the real length comes from the voice-over)
  tags: string[]; // the writer's own [tags] in this scene, as written
  place: string;
  placeFromTag: boolean;
  time: string; // day | sunset | night | dawn | ''
  picture: string; // what the painting / drawing shows
  pictureFromTag: boolean;
  people: string[];
  mood: string;
  camera: BoardItem;
  explainer: (BoardItem & { tag: string }) | null; // full-screen explainer sequence for this beat
  onScreen: BoardItem[]; // title, stats, accents, notes on top of the picture
  transition: BoardItem | null; // how the scene starts
  atmosphere: BoardItem | null;
  moving: boolean | null; // Motion on: becomes a moving clip; null = Motion off
  paintPrompt: string; // the Stable Diffusion prompt (AI illustration)
  summary: string; // the whole scene in plain words
}

export interface Storyboard {
  style: string;
  styleLabel: string;
  videoType: string | null;
  mode: 'story' | 'graphics';
  illustration: 'ai' | 'vector';
  totalSeconds: number;
  unknownTags: string[];
  scenes: BoardScene[];
}

const CAMERA: Record<string, string> = {
  pushIn: 'Slow push in towards the subject — draws you closer',
  pullOut: 'Slow pull back to reveal the whole place — good for endings',
  panLeft: 'Slow pan to the left across the picture',
  panRight: 'Slow pan to the right across the picture',
  tiltUp: 'Slow tilt up — from the ground to the sky',
  none: 'Still frame with a gentle drift',
};
const TIME: Record<string, string> = { day: 'in daylight', sunset: 'at sunset', night: 'at night', dawn: 'at dawn' };

/** Label + one-line description for anything that can appear on the timeline. */
function describe(it: EditItem): BoardItem {
  const props = ('props' in it ? it.props : undefined) as Record<string, unknown> | undefined;
  const fx = String(props?.fx ?? '');
  if (fx && SEQUENCES[fx]) return { id: fx, label: SEQUENCES[fx].label, what: SEQUENCES[fx].description };
  if (fx && EFFECTS_LIB[fx]) return { id: fx, label: EFFECTS_LIB[fx].label, what: EFFECTS_LIB[fx].description };
  const eff = it.kind === 'effect' ? String((it as { effect?: string }).effect ?? '') : '';
  if (eff && eff in EFFECTS) return { id: eff, label: EFFECTS[eff as keyof typeof EFFECTS].label, what: EFFECTS[eff as keyof typeof EFFECTS].description };
  const tpl = 'template' in it ? String(it.template ?? '') : '';
  const T = TEMPLATES[tpl as keyof typeof TEMPLATES] as { label?: string; description?: string } | undefined;
  const text = typeof props?.text === 'string' ? ` “${String(props.text).slice(0, 60)}”` : '';
  return { id: tpl || it.kind, label: T?.label ?? it.name ?? it.kind, what: `${T?.description ?? it.name ?? it.kind}${text}` };
}

export async function storyboard(opts: ScriptVideoOptions, progress: ProgressFn = () => {}): Promise<Storyboard> {
  const p = await planScenes(opts, progress);
  const { scenes, dirs, userDirs, story, plans, baseStyle, vtype, mode } = p;
  const ai = mode === 'story' && opts.illustration === 'ai';
  // which scenes would move (Motion on): the same Mix rule as the real run, then [move] / [still]
  let moving: Array<boolean | null> = scenes.map(() => null);
  if (ai && opts.animate && mode === 'story') {
    const m = chooseMotion(story, scenes, opts.motionMode ?? 'all').animate;
    moving = m.map((v, i) => ((dirs[i] ?? []).some((x) => x.kind === 'move') ? true : (dirs[i] ?? []).some((x) => x.kind === 'still') ? false : v));
  }
  const factual = Boolean(vtype && vtype !== 'story');
  const out: BoardScene[] = scenes.map((text, i) => {
    const s = story[i];
    const style = plans[i]?.style ?? baseStyle;
    const d = dirs[i] ?? [];
    const words = text.split(/\s+/).filter(Boolean).length;
    const seconds = Math.round((words / 2.5 + (i === 0 ? 0.9 : 0.5)) * 10) / 10;
    const from = 0;
    const dur = seconds;
    // what goes on top of the picture: the beat's graphic or explainer, the writer's graphics and the accents
    const taggedTitle = d.find((x) => x.kind === 'title')?.id;
    const graphicItems = mode === 'story' && s ? storyGraphic(s, text, from, dur, style, i, taggedTitle ?? opts.title ?? '', vtype) : [];
    const extraItems = directedExtras(d, text, from, dur, style);
    const all = [...graphicItems, ...extraItems].map(describe);
    const explainerId = s?.motion?.id && SEQUENCES[s.motion.id] ? s.motion.id : null;
    const explainer = explainerId ? { id: explainerId, label: SEQUENCES[explainerId].label, what: SEQUENCES[explainerId].description, tag: accentTag(s!.motion!) } : null;
    const onScreen = all.filter((x) => x.id !== explainerId);
    // how it starts and the air of the scene
    const tr = d.find((x) => x.kind === 'transition');
    const trItem = i === 0 ? null : tr ? directedTransition(tr, from, style)[0] : mode === 'story' ? styleTransition(style, from, i) : null;
    const atm = d.find((x) => x.kind === 'atmosphere');
    const atmItem = atm ? null : ai && s ? sceneAtmosphere(s, text, style, from, dur, i, vtype)[0] : null;
    const atmosphere = atm ? { id: atm.id, label: EFFECTS_LIB[atm.id]?.label ?? atm.id, what: EFFECTS_LIB[atm.id]?.description ?? '' } : atmItem ? describe(atmItem) : null;
    const cam = s?.camera ?? 'none';
    const camera = { id: cam, label: cam === 'none' ? 'Still' : (EFFECTS[cam as keyof typeof EFFECTS]?.label ?? cam), what: CAMERA[cam] ?? '' };
    const people = (s?.actors ?? []).map((a) => a.name).filter(Boolean);
    // no planner picture: factual videos paint the line itself (never the storybook "traveller in a village")
    const picture = s?.visual || (s ? (factual ? text : `${people.length ? `${people.join(', ')} in ` : ''}${s.place}`) : '');
    const paintPrompt = ai && s ? stylisedScene({ place: s.place, time: s.time, actors: people, narration: text, mood: s.mood, visual: s.visual, factual }, style, []).prompt : '';
    const transition = trItem ? describe(trItem) : null;
    const parts = [
      i === 0 ? 'Opens the video.' : transition ? `Starts with a ${transition.label.toLowerCase()}.` : '',
      mode === 'story' && s ? `We see ${picture}${s.place && !picture.toLowerCase().includes(s.place.toLowerCase()) ? `, at ${s.place}` : ''}${TIME[s.time ?? ''] ? ` ${TIME[s.time ?? '']}` : ''}.` : '',
      explainer ? `A full-screen ${explainer.label.toLowerCase()} explains this beat: ${explainer.what.charAt(0).toLowerCase()}${explainer.what.slice(1)}.` : '',
      onScreen.length ? `On screen: ${onScreen.map((o) => o.label.toLowerCase()).join(', ')}.` : '',
      mode === 'story' ? `Camera: ${camera.what.charAt(0).toLowerCase()}${camera.what.slice(1)}.` : '',
      atmosphere ? `Mood: ${atmosphere.label.toLowerCase()}.` : '',
      moving[i] === true ? 'This scene becomes a short moving clip.' : moving[i] === false ? 'This scene stays a still painting with a slow camera drift.' : '',
    ];
    return {
      i,
      text,
      seconds,
      tags: (userDirs[i] ?? []).map((x) => `[${x.raw}]`),
      place: s?.place ?? '',
      placeFromTag: Boolean(s?.placeFixed),
      time: s?.time ?? '',
      picture,
      pictureFromTag: Boolean(s?.visualFixed),
      people,
      mood: s?.mood ?? '',
      camera,
      explainer,
      onScreen,
      transition,
      atmosphere,
      moving: moving[i],
      paintPrompt,
      summary: parts.filter(Boolean).join(' '),
    };
  });
  return {
    style: baseStyle,
    styleLabel: ART_STYLE_LABELS[baseStyle] ?? baseStyle,
    videoType: vtype ? VIDEO_TYPES[vtype].label : null,
    mode: mode === 'graphics' ? 'graphics' : 'story',
    illustration: ai ? 'ai' : 'vector',
    totalSeconds: Math.round(out.reduce((a, s) => a + s.seconds + 0.35, 0)),
    unknownTags: p.unknownTags,
    scenes: out,
  };
}
