import { useEffect, useState } from 'react';
import { Camera, Clapperboard, Clock, Film, Lock, MapPin, Sparkles, Wand2 } from 'lucide-react';

/** One line of the script as a task: what we see, where, what's on screen, how it starts and moves. */
export interface BoardItem {
  id: string;
  label: string;
  what: string;
}
export interface BoardScene {
  i: number;
  text: string;
  seconds: number;
  tags: string[];
  place: string;
  placeFromTag: boolean;
  time: string;
  picture: string;
  pictureFromTag: boolean;
  people: string[];
  mood: string;
  camera: BoardItem;
  explainer: (BoardItem & { tag: string }) | null;
  onScreen: BoardItem[];
  transition: BoardItem | null;
  atmosphere: BoardItem | null;
  moving: boolean | null;
  paintPrompt: string;
  summary: string;
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

/** Tags the plan writes (they are replaced, not duplicated, when the plan is locked). */
const PLAN_TAG = /^\[(place|location|setting|where|environment|env|scene|show|shot|visual|picture|image|time|light)\s*:|^\[(pushIn|pullOut|panLeft|panRight|tiltUp)\]$/i;

/**
 * The script with the (edited) plan written into it as [tags] — so Create video follows this exact plan:
 * [place: …] when the place changes, [scene: …], [time: …], the camera, and the explainer for that beat.
 */
export function lockPlan(board: Storyboard): string {
  let place = '';
  let time = '';
  return board.scenes
    .map((s) => {
      const own = s.tags.filter((t) => !PLAN_TAG.test(t) && !(s.explainer && t.startsWith(`[${s.explainer.id}`)));
      const add: string[] = [];
      if (s.place && s.place !== place) add.push(`[place: ${s.place}]`);
      place = s.place || place;
      if (s.picture) add.push(`[scene: ${s.picture}]`);
      if (s.time && s.time !== time) add.push(`[time: ${s.time}]`);
      time = s.time || time;
      if (board.mode === 'story' && s.camera.id !== 'none') add.push(`[${s.camera.id}]`);
      if (s.explainer) add.push(s.explainer.tag);
      return [s.text, ...own, ...add].join(' ');
    })
    .join('\n\n');
}

const chip = 'inline-flex items-center gap-1 rounded-md border border-zinc-800 bg-black/40 px-1.5 py-0.5 text-[10.5px] text-zinc-300';

/**
 * Scene-by-scene plan: every line as a task with its picture, place, time, camera, explainer, on-screen
 * graphics, opening transition, mood and Motion. Picture, place and time can be edited when `onLock` is given.
 */
export function StoryboardView({ board, onLock, lockLabel = 'Use this plan' }: { board: Storyboard; onLock?: (script: string) => void; lockLabel?: string }) {
  const [draft, setDraft] = useState(board);
  useEffect(() => setDraft(board), [board]);
  const edit = (i: number, patch: Partial<BoardScene>) => setDraft((b) => ({ ...b, scenes: b.scenes.map((s) => (s.i === i ? { ...s, ...patch } : s)) }));
  const field = 'w-full rounded-md border border-zinc-800 bg-surface px-2 py-1 text-xs text-white focus:border-accent focus:outline-none';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-zinc-400">
          {draft.scenes.length} scenes · about {Math.floor(draft.totalSeconds / 60)}:{String(draft.totalSeconds % 60).padStart(2, '0')} · {draft.styleLabel}
          {draft.videoType ? ` · ${draft.videoType}` : ''} · {draft.illustration === 'ai' ? 'AI paintings' : 'vector drawings'}
        </p>
        {onLock && (
          <button
            type="button"
            onClick={() => onLock(lockPlan(draft))}
            title="Write this plan into the script as [tags], so the video follows it exactly"
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-black cursor-pointer"
          >
            <Lock className="h-3.5 w-3.5" /> {lockLabel}
          </button>
        )}
      </div>
      {draft.unknownTags.length > 0 && <p className="text-[11px] text-amber-400">Unknown tags (ignored): {draft.unknownTags.map((t) => `[${t}]`).join(' ')}</p>}

      <ol className="space-y-3">
        {draft.scenes.map((s) => (
          <li key={s.i} className="rounded-xl border border-zinc-900 bg-surface/60 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-zinc-900 px-1.5 py-0.5 font-mono text-[10.5px] text-zinc-300">Scene {s.i + 1}</span>
              <span className={chip}>
                <Clock className="h-3 w-3" /> ~{s.seconds}s
              </span>
              {s.moving !== null && <span className={chip}>{s.moving ? <Film className="h-3 w-3 text-accent" /> : <Clapperboard className="h-3 w-3" />} {s.moving ? 'Moving clip' : 'Still painting'}</span>}
              {s.transition && <span className={chip} title={s.transition.what}>Opens with {s.transition.label.toLowerCase()}</span>}
            </div>
            <p className="mt-2 text-sm leading-snug text-white">“{s.text}”</p>

            {draft.mode === 'story' && (
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_200px]">
                <label className="block">
                  <span className="mb-0.5 flex items-center gap-1 text-[10.5px] uppercase tracking-wider text-zinc-500">
                    <Sparkles className="h-3 w-3" /> What we see {s.pictureFromTag && <span className="normal-case tracking-normal text-accent">· your [scene]</span>}
                  </span>
                  {onLock ? (
                    <textarea value={s.picture} onChange={(e) => edit(s.i, { picture: e.target.value })} rows={2} className={`${field} resize-y`} />
                  ) : (
                    <span className="block text-xs text-zinc-200">{s.picture}</span>
                  )}
                </label>
                <div className="space-y-2">
                  <label className="block">
                    <span className="mb-0.5 flex items-center gap-1 text-[10.5px] uppercase tracking-wider text-zinc-500">
                      <MapPin className="h-3 w-3" /> Where {s.placeFromTag && <span className="normal-case tracking-normal text-accent">· [place]</span>}
                    </span>
                    {onLock ? <input value={s.place} onChange={(e) => edit(s.i, { place: e.target.value })} className={field} /> : <span className="block text-xs text-zinc-200">{s.place}</span>}
                  </label>
                  <label className="block">
                    <span className="mb-0.5 block text-[10.5px] uppercase tracking-wider text-zinc-500">When</span>
                    {onLock ? (
                      <select value={s.time} onChange={(e) => edit(s.i, { time: e.target.value })} className={field}>
                        <option value="">Planner's choice</option>
                        <option value="day">Day</option>
                        <option value="sunset">Sunset</option>
                        <option value="night">Night</option>
                        <option value="dawn">Dawn</option>
                      </select>
                    ) : (
                      <span className="block text-xs text-zinc-200">{s.time || 'day'}</span>
                    )}
                  </label>
                </div>
              </div>
            )}

            <dl className="mt-3 grid gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
              {draft.mode === 'story' && (
                <div>
                  <dt className="flex items-center gap-1 text-[10.5px] uppercase tracking-wider text-zinc-500">
                    <Camera className="h-3 w-3" /> Camera
                  </dt>
                  <dd className="text-zinc-300">{s.camera.what || s.camera.label}</dd>
                </div>
              )}
              {s.explainer && (
                <div>
                  <dt className="text-[10.5px] uppercase tracking-wider text-zinc-500">Explainer</dt>
                  <dd className="text-zinc-300">
                    <span className="text-white">{s.explainer.label}</span> — {s.explainer.what}
                  </dd>
                </div>
              )}
              {s.onScreen.length > 0 && (
                <div>
                  <dt className="text-[10.5px] uppercase tracking-wider text-zinc-500">On screen</dt>
                  <dd className="text-zinc-300">
                    {s.onScreen.map((o, k) => (
                      <span key={k} className="block">
                        <span className="text-white">{o.label}</span> — {o.what}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
              {s.atmosphere && (
                <div>
                  <dt className="text-[10.5px] uppercase tracking-wider text-zinc-500">Mood</dt>
                  <dd className="text-zinc-300">
                    <span className="text-white">{s.atmosphere.label}</span> — {s.atmosphere.what}
                  </dd>
                </div>
              )}
            </dl>

            <p className="mt-3 border-t border-zinc-900 pt-2 text-[11.5px] leading-relaxed text-zinc-400">
              <Wand2 className="mr-1 inline h-3 w-3 text-accent" />
              {s.summary}
            </p>
            {s.paintPrompt && (
              <details className="mt-1.5">
                <summary className="cursor-pointer text-[10.5px] text-zinc-600">Painting prompt</summary>
                <p className="mt-1 font-mono text-[10.5px] leading-snug text-zinc-500">{s.paintPrompt}</p>
              </details>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
