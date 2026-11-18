/**
 * Sequence presets: storytelling patterns built from catalogue effects. Metadata only (no React).
 * A step's props may reference the sequence's own parameters as "{{param}}".
 */
import type { FieldDef } from '../editor/catalog.ts';
import { EFFECTS_LIB } from './catalog.ts';

export interface SeqStep {
  fx: string; // effect preset id
  at: number; // seconds from the start of the sequence
  dur: number;
  props?: Record<string, string | number | boolean>;
}

export interface SeqDef {
  id: string;
  label: string;
  description: string;
  duration: number;
  bg?: string; // optional solid backdrop colour (param key "bg" overrides)
  params: Record<string, string | number>;
  fields: FieldDef[];
  steps: SeqStep[];
}

const t = (key: string, label: string): FieldDef => ({ key, label, type: 'text' });
const n = (key: string, label: string): FieldDef => ({ key, label, type: 'number', min: -1e12, max: 1e12, step: 0.01 });
const bg: FieldDef = { key: 'bg', label: 'Backdrop', type: 'color' };

export const SEQUENCES: Record<string, SeqDef> = {
  bigStat: {
    id: 'bigStat', label: 'Big statistic reveal', description: 'Backdrop, small label, number counts up and settles, support text, underline', duration: 4.5, bg: '#14213D',
    params: { label: 'India now has', value: 900, suffix: ' million', text: 'internet users', bg: '#14213D' },
    fields: [t('label', 'Label'), n('value', 'Value'), t('suffix', 'Suffix'), t('text', 'Support text'), bg],
    steps: [
      { fx: 'gradientMove', at: 0, dur: 4.5, props: { accent: '{{bg}}', accent2: '#0B132B', exit: 'none' } },
      { fx: 'countingNumber', at: 0.2, dur: 4.3, props: { label: '{{label}}', value: '{{value}}', suffix: '{{suffix}}', text: '{{text}}' } },
      { fx: 'dustParticles', at: 0, dur: 4.5, props: { count: 30 } },
    ],
  },
  chartExplain: {
    id: 'chartExplain', label: 'Chart explanation', description: 'Title, axes draw, bars grow, the key bar turns accent, an arrow points to it, conclusion', duration: 7, bg: '#101418',
    params: { title: 'Who uses the most data?', data: 'Delhi:21, Mumbai:24, Pune:18, Kochi:31', highlight: 'Kochi', note: 'Kochi leads — despite being the smallest city' },
    fields: [t('title', 'Title'), t('data', 'Data'), t('highlight', 'Highlight'), t('note', 'Conclusion')],
    steps: [
      { fx: 'barHighlight', at: 0, dur: 7, props: { title: '{{title}}', data: '{{data}}', highlight: '{{highlight}}', note: '{{note}}', orientation: 'vertical' } },
      { fx: 'curvedArrow', at: 3.6, dur: 3.4, props: { x1: 50, y1: 22, x2: 80, y2: 34, label: 'look!' } },
    ],
  },
  mapInvestigation: {
    id: 'mapInvestigation', label: 'Map investigation', description: 'World map, zoom into a country, highlight, pin, info card', duration: 8,
    params: { country: 'India', city: 'Kochi', note: 'Kerala: 1 in 3 villages saw fireflies return' },
    fields: [t('country', 'Country'), t('city', 'Pin city'), t('note', 'Info card')],
    steps: [
      { fx: 'mapZoomIn', at: 0, dur: 8, props: { country: '{{country}}', note: '{{note}}', labels: false, mapTheme: '{{mapTheme}}' } },
      { fx: 'leaderLine', at: 3.4, dur: 4.6, props: { x: 47, y: 62, lx: 60, ly: 30, text: '{{city}}' } },
    ],
  },
  evidence: {
    id: 'evidence', label: 'Evidence / document', description: 'Paper enters, camera pushes in, text highlighted, red circle, arrow, pull quote', duration: 8.5,
    params: { title: 'Report, 2024', text: 'Inspectors found that the bridge lights were installed without any study of their effect on local wildlife.', highlight: 'without any study', quote: 'Without any study.' },
    fields: [t('title', 'Document title'), t('text', 'Document text'), t('highlight', 'Key phrase'), t('quote', 'Pull quote')],
    steps: [
      { fx: 'documentExcerpt', at: 0, dur: 5.2, props: { title: '{{title}}', text: '{{text}}', highlight: '{{highlight}}' } },
      { fx: 'handOval', at: 2.2, dur: 3, props: { x: 52, y: 54, w: 70, h: 9 } },
      { fx: 'curvedArrow', at: 2.9, dur: 2.3, props: { x1: 80, y1: 80, x2: 70, y2: 60, label: '' } },
      { fx: 'pullQuote', at: 5.2, dur: 3.3, props: { text: '{{quote}}', highlight: '{{quote}}', source: '{{title}}' } },
    ],
  },
  comparison: {
    id: 'comparison', label: 'Comparison', description: 'Two values side by side, counting, with the difference highlighted', duration: 5.5, bg: '#111827',
    params: { title: 'Fireflies counted', labelA: '2004', valueA: 1200, labelB: '2024', valueB: 140 },
    fields: [t('title', 'Title'), t('labelA', 'Label A'), n('valueA', 'Value A'), t('labelB', 'Label B'), n('valueB', 'Value B')],
    steps: [{ fx: 'beforeAfter', at: 0, dur: 5.5, props: { title: '{{title}}', labelA: '{{labelA}}', valueA: '{{valueA}}', labelB: '{{labelB}}', valueB: '{{valueB}}' } }],
  },
  timelineHistory: {
    id: 'timelineHistory', label: 'Timeline history', description: 'Line draws, years appear one by one, last milestone pulses', duration: 9, bg: '#1B1B1E',
    params: { events: '1947|Independence; 1969|ISRO founded; 1991|Reforms; 2023|Moon landing' },
    fields: [t('events', 'Events (year|event; …)')],
    steps: [{ fx: 'timelineHorizontal', at: 0, dur: 9, props: { events: '{{events}}' } }],
  },
  processExplain: {
    id: 'processExplain', label: 'Process explanation', description: 'Nodes appear, connectors draw, each step lights up in turn', duration: 7, bg: '#0F172A',
    params: { steps: 'Seed; Sprout; Flower; Fruit' },
    fields: [t('steps', 'Steps (a; b; c)')],
    steps: [{ fx: 'processFlow', at: 0, dur: 7, props: { steps: '{{steps}}' } }],
  },
  quoteStatement: {
    id: 'quoteStatement', label: 'Quote & statement', description: 'Frame darkens, quote marks, lines reveal, key phrase highlighted, source', duration: 5.5,
    params: { text: 'Fireflies need the dark to find each other.', highlight: 'the dark', source: 'Old fisherman' },
    fields: [t('text', 'Quote'), t('highlight', 'Highlight'), t('source', 'Source')],
    steps: [{ fx: 'quoteCard', at: 0, dur: 5.5, props: { text: '{{text}}', highlight: '{{highlight}}', source: '{{source}}' } }],
  },
  spotlightInvestigation: {
    id: 'spotlightInvestigation', label: 'Photo / subject investigation', description: 'Spotlight on a subject, circle draws, magnifier, label — place over footage or a photo', duration: 6,
    params: { x: 55, y: 45, label: 'the suspect' },
    fields: [n('x', 'Subject X %'), n('y', 'Subject Y %'), t('label', 'Label')],
    steps: [
      { fx: 'spotlight', at: 0, dur: 6, props: { x: '{{x}}', y: '{{y}}', radius: 20 } },
      { fx: 'redCircle', at: 0.8, dur: 5.2, props: { x: '{{x}}', y: '{{y}}', w: 34, label: '{{label}}' } },
      { fx: 'numberedCallouts', at: 2.4, dur: 3.6, props: { points: '{{x}},{{y}}', labels: '' } },
    ],
  },
  chapterTransition: {
    id: 'chapterTransition', label: 'Full-screen chapter', description: 'Scene wipes out, chapter number and title, subtitle', duration: 3.5,
    params: { number: '02', text: 'The darkness', subtitle: 'Chapter two' },
    fields: [t('number', 'Number'), t('text', 'Title'), t('subtitle', 'Subtitle')],
    steps: [
      { fx: 'wipeTransition', at: 0, dur: 0.9 },
      { fx: 'chapterCard', at: 0.4, dur: 3.1, props: { number: '{{number}}', text: '{{text}}', subtitle: '{{subtitle}}' } },
    ],
  },
  breakingNews: {
    id: 'breakingNews', label: 'Breaking news', description: 'Red headline bar, ticker, facts lower third', duration: 6,
    params: { text: 'Fireflies return to the river', ticker: 'BREAKING • 1,000 fireflies counted • Bridge lights switched off • Villagers celebrate', facts: 'Kerala, 9 pm' },
    fields: [t('text', 'Headline'), t('ticker', 'Ticker'), t('facts', 'Facts')],
    steps: [
      { fx: 'textOnPaper', at: 0, dur: 6, props: { text: '{{text}}', box: 'solid', accent: '#C1121F', color: '#FFFFFF', y: 22, size: 6.5 } },
      { fx: 'newsTicker', at: 0.4, dur: 5.6, props: { text: '{{ticker}}' } },
      { fx: 'lowerThird', at: 1.2, dur: 4.8, props: { text: '{{facts}}', subtitle: 'LIVE', y: 66 } },
    ],
  },
  questionReveal: {
    id: 'questionReveal', label: 'Question reveal', description: 'Big question mark, headline, highlight, explanation', duration: 6, bg: '#1A1A2E',
    params: { text: 'Where did the fireflies go?', answer: 'They were blinded by the new lights.' },
    fields: [t('text', 'Question'), t('answer', 'Explanation')],
    steps: [
      { fx: 'questionMark', at: 0, dur: 2.2, props: { x: 50, y: 35, w: 40 } },
      { fx: 'staggeredType', at: 1.2, dur: 4.8, props: { text: '{{text}}', y: 45, size: 8 } },
      { fx: 'sentenceReveal', at: 3.2, dur: 2.8, props: { text: '{{answer}}', y: 70, size: 4.5, color: '#F9D84A' } },
    ],
  },
  mythVsFact: {
    id: 'mythVsFact', label: 'Myth vs fact', description: 'Myth card crossed out, fact card ticked', duration: 5, bg: '#22223B',
    params: { textA: 'Fireflies only live in jungles', textB: 'They thrive near rivers and fields' },
    fields: [t('textA', 'Myth'), t('textB', 'Fact')],
    steps: [{ fx: 'mythVsFact', at: 0, dur: 5, props: { textA: '{{textA}}', textB: '{{textB}}' } }],
  },
  rankingCountdown: {
    id: 'rankingCountdown', label: 'Ranking countdown', description: 'Ranks count down to #1, which glows', duration: 6, bg: '#0B132B',
    params: { title: 'Brightest firefly spots', data: 'Kochi:92, Goa:88, Coorg:85, Munnar:80, Wayanad:76' },
    fields: [t('title', 'Title'), t('data', 'Data')],
    steps: [{ fx: 'rankingChart', at: 0, dur: 6, props: { title: '{{title}}', data: '{{data}}', order: 'countdown' } }],
  },
  topFive: {
    id: 'topFive', label: 'Top 5 list', description: 'Title, five cards, sequential highlights, winner', duration: 6, bg: '#1B263B',
    params: { title: 'Top 5 reasons', items: 'Dark skies|No street lights; Clean water|No pesticides; Tall grass|Safe for larvae; Quiet nights|Less traffic; Care|Villagers protect them' },
    fields: [t('title', 'Title'), t('items', 'Items (Title|text; …)')],
    steps: [{ fx: 'cardList', at: 0, dur: 6, props: { title: '{{title}}', items: '{{items}}', highlight: 1, stagger: 0.4 } }],
  },
  moneyBreakdown: {
    id: 'moneyBreakdown', label: 'Money breakdown', description: 'Total counts up, then splits into a labelled donut', duration: 7.5, bg: '#0D1B2A',
    params: { value: 120000, label: 'Monthly budget', data: 'Rent:40, Food:25, Travel:15, Savings:20' },
    fields: [n('value', 'Total'), t('label', 'Label'), t('data', 'Split (Label:%, …)')],
    steps: [
      { fx: 'currencyCounter', at: 0, dur: 3, props: { value: '{{value}}', label: '{{label}}' } },
      { fx: 'donutReveal', at: 2.8, dur: 4.7, props: { data: '{{data}}', title: '{{label}}' } },
    ],
  },
  mapComparison: {
    id: 'mapComparison', label: 'Map comparison', description: 'Two regions highlighted in contrasting colours', duration: 5,
    params: { country: 'India, China', title: 'Two giants' },
    fields: [t('country', 'Countries (a, b)'), t('title', 'Title')],
    steps: [{ fx: 'regionCompare', at: 0, dur: 5, props: { country: '{{country}}', title: '{{title}}' } }],
  },
  productBreakdown: {
    id: 'productBreakdown', label: 'Object / product breakdown', description: 'Shape appears, numbered parts, labelled connectors', duration: 6, bg: '#111111',
    params: { labels: 'Lens; Battery; Sensor' },
    fields: [t('labels', 'Parts (a; b; c)')],
    steps: [
      { fx: 'circleExpand', at: 0, dur: 6, props: { size: 34, accent: '#2A6FDB' } },
      { fx: 'numberedCallouts', at: 1, dur: 5, props: { points: '42,40; 58,52; 46,62', labels: '{{labels}}' } },
    ],
  },
  socialAnalysis: {
    id: 'socialAnalysis', label: 'Social media analysis', description: 'Post, likes/comments count, a comment is highlighted', duration: 5.5, bg: '#1F2937',
    params: { text: 'The fireflies are back!! 😭✨', likes: 248000, comment: '“Switching off one bridge did this?”' },
    fields: [t('text', 'Post'), n('likes', 'Likes'), t('comment', 'Comment')],
    steps: [{ fx: 'socialPost', at: 0, dur: 5.5, props: { text: '{{text}}', likes: '{{likes}}', comment: '{{comment}}' } }],
  },
  websiteAnalysis: {
    id: 'websiteAnalysis', label: 'Website analysis', description: 'Browser loads, a line is boxed, cursor clicks, circle annotation', duration: 6, bg: '#2B2D42',
    params: { url: 'gov.in/wildlife-report', text: 'Wildlife Report 2025' },
    fields: [t('url', 'URL'), t('text', 'Page title')],
    steps: [
      { fx: 'browserReveal', at: 0, dur: 6, props: { url: '{{url}}', text: '{{text}}' } },
      { fx: 'cursorClick', at: 3, dur: 3, props: { x1: 30, y1: 80, x2: 55, y2: 58 } },
    ],
  },
  searchInvestigation: {
    id: 'searchInvestigation', label: 'Search investigation', description: 'Search bar, typing, results, selected result', duration: 5.5, bg: '#14213D',
    params: { query: 'why are fireflies disappearing', results: 'Light pollution confuses fireflies; Pesticides harm larvae; Habitat loss near rivers' },
    fields: [t('query', 'Query'), t('results', 'Results (a; b; c)')],
    steps: [{ fx: 'searchInvestigation', at: 0, dur: 5.5, props: { query: '{{query}}', results: '{{results}}' } }],
  },
  newsHeadline: {
    id: 'newsHeadline', label: 'News headline', description: 'Newspaper slides in, zoom to headline, highlight', duration: 5.5, bg: '#3A3A3A',
    params: { text: 'Fireflies return to the river after 20 years', highlight: 'after 20 years' },
    fields: [t('text', 'Headline'), t('highlight', 'Highlight')],
    steps: [{ fx: 'newspaperZoom', at: 0, dur: 5.5, props: { text: '{{text}}', highlight: '{{highlight}}' } }],
  },
  historicalProgression: {
    id: 'historicalProgression', label: 'Historical progression', description: 'Year counter rolls, then milestones down a vertical timeline', duration: 8, bg: '#1C1C1C',
    params: { from: 1950, value: 2025, events: '1950|Lamps; 1980|Street lights; 2005|LEDs; 2025|Dark-sky zones' },
    fields: [n('from', 'From year'), n('value', 'To year'), t('events', 'Events')],
    steps: [
      { fx: 'yearCounter', at: 0, dur: 2.6, props: { from: '{{from}}', value: '{{value}}' } },
      { fx: 'timelineVertical', at: 2.4, dur: 5.6, props: { events: '{{events}}' } },
    ],
  },
  characterIntro: {
    id: 'characterIntro', label: 'Character introduction', description: 'Name, role, then fact labels', duration: 6,
    params: { name: 'Meera', role: 'Firefly counter, age 9', facts: 'Counts every night|Since age 6; Favourite|The river bank' },
    fields: [t('name', 'Name'), t('role', 'Role'), t('facts', 'Facts (Title|text; …)')],
    steps: [
      { fx: 'lowerThird', at: 0, dur: 6, props: { text: '{{name}}', subtitle: '{{role}}', y: 80 } },
      { fx: 'cardList', at: 1.2, dur: 4.8, props: { items: '{{facts}}', layout: 'list', scale: 0.7, y: 30 } },
    ],
  },
  globalStats: {
    id: 'globalStats', label: 'Global statistics', description: 'Globe spins to a country, then the figure counts up', duration: 7,
    params: { country: 'India', value: 2000, suffix: '+', label: 'firefly species worldwide' },
    fields: [t('country', 'Country'), n('value', 'Value'), t('suffix', 'Suffix'), t('label', 'Label')],
    steps: [
      { fx: 'globeSpin', at: 0, dur: 4, props: { country: '{{country}}' } },
      { fx: 'countingNumber', at: 3.6, dur: 3.4, props: { value: '{{value}}', suffix: '{{suffix}}', text: '{{label}}', y: 50 } },
    ],
  },
  networkConnections: {
    id: 'networkConnections', label: 'Network connections', description: 'First node, connected nodes, network expansion with pulses', duration: 6, bg: '#0B0C10',
    params: { nodes: 'Meera; Fisherman; Villagers; Panchayat; Forest dept.; School; Media' },
    fields: [t('nodes', 'Nodes (hub first; …)')],
    steps: [{ fx: 'networkGraph', at: 0, dur: 6, props: { nodes: '{{nodes}}' } }],
  },
  causeEffect: {
    id: 'causeEffect', label: 'Cause and effect', description: 'Cause → arrow → effect → result', duration: 5, bg: '#1D3557',
    params: { steps: 'Bright bridge lamps; Fireflies cannot see each other; No fireflies' },
    fields: [t('steps', 'Chain (a; b; c)')],
    steps: [{ fx: 'causeAndEffect', at: 0, dur: 5, props: { steps: '{{steps}}' } }],
  },
  questionAnswer: {
    id: 'questionAnswer', label: 'Question and answer', description: 'Question, pause, answer reveal, tick', duration: 6, bg: '#2D3142',
    params: { text: 'Can one switch save them?', answer: 'Yes — 1,000 came back in a night.' },
    fields: [t('text', 'Question'), t('answer', 'Answer')],
    steps: [
      { fx: 'wordReveal', at: 0, dur: 6, props: { text: '{{text}}', y: 35, size: 7 } },
      { fx: 'textPop', at: 2.6, dur: 3.4, props: { text: '{{answer}}', y: 60, size: 6, color: '#F9D84A' } },
      { fx: 'checkMark', at: 3.4, dur: 2.6, props: { x: 50, y: 78, w: 16 } },
    ],
  },
  finalConclusion: {
    id: 'finalConclusion', label: 'Final conclusion', description: 'Main statement, key statistic, end card', duration: 7, bg: '#000000',
    params: { text: 'To see the light, turn ours *off*.', value: 1000, label: 'fireflies came back', end: 'Thanks for watching' },
    fields: [t('text', 'Statement'), n('value', 'Key number'), t('label', 'Number label'), t('end', 'End card')],
    steps: [
      { fx: 'staggeredType', at: 0, dur: 3, props: { text: '{{text}}', size: 8 } },
      { fx: 'countingNumber', at: 3, dur: 2.4, props: { value: '{{value}}', text: '{{label}}', size: 13 } },
      { fx: 'chapterCard', at: 5.2, dur: 1.8, props: { number: '✦', text: '{{end}}', bg: '#000000', ink: '#FFFFFF' } },
    ],
  },
  dataStory: {
    id: 'dataStory', label: 'Data trend story', description: 'Line draws over time, a label pins the turning point', duration: 7, bg: '#101820',
    params: { title: 'Fireflies counted per night', data: '2004:1200, 2010:900, 2016:400, 2020:140, 2024:1000', note: 'Lights off in 2023 → instant recovery' },
    fields: [t('title', 'Title'), t('data', 'Data'), t('note', 'Note')],
    steps: [
      { fx: 'lineDraw', at: 0, dur: 7, props: { title: '{{title}}', data: '{{data}}', note: '{{note}}' } },
      { fx: 'leaderLine', at: 4.2, dur: 2.8, props: { x: 74, y: 62, lx: 40, ly: 30, text: 'Lights switched off' } },
    ],
  },
};

/** Fill "{{param}}" placeholders in step props from the sequence's params (numbers stay numbers when whole). */
export function resolveStep(step: SeqStep, params: Record<string, unknown>): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(step.props ?? {})) {
    if (typeof v !== 'string') {
      out[k] = v;
      continue;
    }
    const whole = v.match(/^\{\{(\w+)\}\}$/);
    if (whole) {
      const pv = params[whole[1]];
      if (pv !== undefined && pv !== '') out[k] = pv as string | number | boolean;
      continue;
    }
    out[k] = v.replace(/\{\{(\w+)\}\}/g, (_, key) => String(params[key] ?? ''));
  }
  return out;
}

/** Sanity check at import: every step points at a real effect preset. */
for (const s of Object.values(SEQUENCES)) for (const st of s.steps) if (!EFFECTS_LIB[st.fx]) console.warn(`[motion] sequence ${s.id} uses unknown effect ${st.fx}`);

/** Everything the library can insert: sequences first, then effects. */
export const isMotionId = (id: unknown): id is string => typeof id === 'string' && (id in SEQUENCES || id in EFFECTS_LIB);
