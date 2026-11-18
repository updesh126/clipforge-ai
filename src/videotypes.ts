/**
 * Video types for Script → video. Picking one sets sensible defaults (art style, captions, Motion mix) on the
 * Script page, and tells the planner which motion-graphics sequences fit and how often to use them.
 * Shared by the Script page and the server.
 */
export type VideoType = 'story' | 'documentary' | 'fun' | 'tech';

export interface VideoTypeDef {
  label: string;
  blurb: string;
  /** recommended art styles — the first is chosen automatically */
  styles: string[];
  captions: 'karaoke' | 'pop' | 'bold' | 'clean';
  /** explainer sequences (src/motion/sequences.ts) the planner may use for this type */
  sequences: string[];
  /** at most one sequence every N scenes (0 = none) */
  sequenceEvery: number;
  /** title card for the first scene */
  title: 'artBanner' | 'paperTitle';
  /** atmosphere overlays preferred when the narration doesn't call for one */
  atmosphere: string[];
  /** one line for the planner about the kind of video */
  plannerHint: string;
}

export const VIDEO_TYPES: Record<VideoType, VideoTypeDef> = {
  story: {
    label: 'Storytelling',
    blurb: 'Characters, places and feelings — fables, folk tales, kids stories',
    styles: ['storybook', 'paperCutout', 'warli', 'madhubani', 'handDrawn'],
    captions: 'karaoke',
    sequences: ['quoteStatement'],
    sequenceEvery: 0,
    title: 'artBanner',
    atmosphere: [],
    plannerHint: 'This is a narrative story. Focus every scene on its characters, the place and the feeling; do not add explainer graphics.',
  },
  documentary: {
    label: 'Documentary',
    blurb: 'Real places, history and facts — maps, timelines, dates and stats',
    styles: ['handDrawn', 'inkWash', 'miniature', 'ukiyoe', 'stainedGlass'],
    captions: 'clean',
    sequences: ['timelineHistory', 'mapInvestigation', 'bigStat', 'quoteStatement', 'globalStats', 'newsHeadline', 'comparison'],
    sequenceEvery: 3,
    title: 'paperTitle',
    atmosphere: ['filmGrain', 'vignette', 'dustParticles'],
    plannerHint: 'This is a documentary. Show real places and people; when the narration gives a date, a place, a number or a quote, use a map, timeline, statistic or quote graphic for that beat.',
  },
  fun: {
    label: 'Fun',
    blurb: 'Playful, energetic — surprises, myths, countdowns',
    styles: ['cartoon', 'anime', 'paperCutout'],
    captions: 'pop',
    sequences: ['questionReveal', 'mythVsFact', 'rankingCountdown', 'bigStat', 'comparison'],
    sequenceEvery: 3,
    title: 'artBanner',
    atmosphere: ['confetti', 'sparks', 'glowPulse'],
    plannerHint: 'This is a fun, energetic video. Keep scenes lively and expressive; use question reveals, myth-vs-fact or countdown graphics when the narration asks a question, busts a myth or ranks things.',
  },
  tech: {
    label: 'Tech explainer',
    blurb: 'How things work — processes, data, comparisons',
    styles: ['flatVector', 'blueprint'],
    captions: 'bold',
    sequences: ['processExplain', 'chartExplain', 'comparison', 'causeEffect', 'dataStory', 'bigStat', 'questionReveal'],
    sequenceEvery: 2,
    title: 'paperTitle',
    atmosphere: ['lightSweep'],
    plannerHint: 'This is a tech explainer. Show the product, device or system clearly; use process, chart, comparison, cause-and-effect or statistic graphics whenever the narration explains steps, numbers or differences.',
  },
};

export const VIDEO_TYPE_IDS = Object.keys(VIDEO_TYPES) as VideoType[];
export const isVideoType = (v: unknown): v is VideoType => typeof v === 'string' && v in VIDEO_TYPES;
