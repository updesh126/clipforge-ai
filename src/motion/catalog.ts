/**
 * Motion graphics catalogue — METADATA ONLY (no React), so the server and the LLM can validate ids.
 *
 *   base renderer  → one parameterised animation engine (src/motion/renderers/*)
 *   effect preset  → a named entry in the library = base + default parameters (what users and the AI pick)
 *   sequence       → a timed combination of effects with shared parameters (src/motion/sequences.ts)
 *
 * Every effect also accepts the COMMON controls: delay, speed, easing, exit, x, y, scale, colours.
 */
import type { FieldDef } from '../editor/catalog.ts';

export type Category = 'sequences' | 'typography' | 'data' | 'maps' | 'annotations' | 'shapes' | 'layouts' | 'timelines' | 'diagrams' | 'science' | 'finance' | 'atmosphere' | 'transitions' | 'audio';

export const CATEGORIES: { id: Category; label: string; blurb: string }[] = [
  { id: 'sequences', label: 'Sequences', blurb: 'Ready-made storytelling combinations' },
  { id: 'typography', label: 'Typography', blurb: 'Kinetic text, marker highlight, title cards, word reveal' },
  { id: 'data', label: 'Data visualisation', blurb: 'Bar charts, line graphs, counters, donut charts' },
  { id: 'maps', label: 'Maps', blurb: 'Map zoom, route drawing, location pins, region highlights' },
  { id: 'annotations', label: 'Annotations', blurb: 'Arrows, circles, labels, stamps, evidence markers' },
  { id: 'shapes', label: 'Shapes', blurb: 'Path drawing, shape morphing, geometric reveals' },
  { id: 'layouts', label: 'Layouts', blurb: 'Split screen, cards, browser, chat, newspaper, evidence board' },
  { id: 'timelines', label: 'Timelines', blurb: 'Historical progression, dates, milestone reveals' },
  { id: 'diagrams', label: 'Diagrams', blurb: 'Flowcharts, networks, processes, cause and effect' },
  { id: 'science', label: 'Scientific', blurb: 'Atoms, waves, gears, DNA, orbits, circuits' },
  { id: 'finance', label: 'Finance', blurb: 'Currency, coins, money flow, budgets' },
  { id: 'atmosphere', label: 'Atmosphere', blurb: 'Particles, grain, glow, light rays, film looks' },
  { id: 'transitions', label: 'Transitions', blurb: 'Wipes, iris, shutters, paper tear, grids' },
  { id: 'audio', label: 'Audio reactive', blurb: 'Waveforms, beat pulses, narration progress' },
];

// ---------------------------------------------------------------- field helpers
const t = (key: string, label: string): FieldDef => ({ key, label, type: 'text' });
const n = (key: string, label: string, min: number, max: number, step = 1): FieldDef => ({ key, label, type: 'number', min, max, step });
const s = (key: string, label: string, options: string[]): FieldDef => ({ key, label, type: 'select', options });
const c = (key: string, label: string): FieldDef => ({ key, label, type: 'color' });
const FONT = s('font', 'Font', ['sans', 'serif', 'condensed', 'impact', 'marker', 'mono']);
const ANIM = s('anim', 'Animation', ['up', 'fade', 'down', 'left', 'right', 'scale', 'pop', 'blur', 'wipe', 'mask', 'rotate', 'flip', 'drop', 'tracking', 'typewriter', 'scramble', 'bounce', 'none']);
const XY = [n('x', 'X %', 0, 100), n('y', 'Y %', 0, 100)];
const DATA = t('data', 'Data (Label:value, …)');
const TITLE = t('title', 'Title');
const NUMFMT = [s('format', 'Format', ['number', 'percent', 'currency', 'decimal']), t('prefix', 'Prefix'), t('suffix', 'Suffix'), s('grouping', 'Grouping', ['intl', 'indian', 'none'])];
const YES = (key: string, label: string) => s(key, label, ['true', 'false']);

/** Controls every effect has (shown under "Timing & look"). */
export const COMMON_FIELDS: FieldDef[] = [
  n('delay', 'Delay (s)', 0, 20, 0.1),
  n('speed', 'Speed', 0.25, 4, 0.05),
  s('easing', 'Easing', ['editorial', 'easeOut', 'easeInOut', 'easeIn', 'linear', 'back', 'bounce', 'elastic', 'spring', 'expo', 'step']),
  s('exit', 'Exit', ['fade', 'slide', 'scale', 'wipe', 'blur', 'none']),
  n('scale', 'Scale', 0.3, 2.5, 0.05),
  c('color', 'Colour'),
  c('accent', 'Accent'),
];

export type BaseId =
  | 'textReveal' | 'paperTitle' | 'marker' | 'quoteCard' | 'lowerThird' | 'kinetic' | 'scroller' | 'chapter' | 'textSwap' | 'circularText'
  | 'counter' | 'bars' | 'lineChart' | 'pie' | 'gauge' | 'pictogram' | 'compare' | 'ranking' | 'funnel' | 'bubbles' | 'heatmap' | 'waterfall'
  | 'worldMap' | 'globe'
  | 'scribble' | 'arrow' | 'connector' | 'bracket' | 'magnifier' | 'stamp' | 'redact' | 'sticky' | 'bubble' | 'numbered' | 'documentCard' | 'cursor'
  | 'shape' | 'burst' | 'gridReveal'
  | 'split' | 'cards' | 'browser' | 'search' | 'chat' | 'socialPost' | 'newspaper' | 'evidenceBoard' | 'mythFact'
  | 'timeline' | 'flow' | 'network' | 'causeEffect' | 'tree'
  | 'science' | 'coins' | 'currency' | 'moneyFlow'
  | 'particles' | 'look' | 'transition' | 'audioViz';

/** Parameter schema per base renderer (what the Inspector shows). */
export const BASE_FIELDS: Record<BaseId, FieldDef[]> = {
  textReveal: [t('text', 'Text (*word* = emphasis, / = new line)'), t('subtitle', 'Subtitle'), s('unit', 'Reveal by', ['word', 'letter', 'line', 'whole']), ANIM, n('stagger', 'Stagger (s)', 0, 1, 0.01), n('size', 'Size', 2, 25, 0.5), FONT, n('weight', 'Weight', 300, 900, 100), s('case', 'Case', ['none', 'upper']), s('box', 'Box', ['none', 'paper', 'solid', 'dark', 'tag']), YES('emMarker', 'Marker behind *emphasis*'), n('tilt', 'Perspective tilt', -40, 40), s('align', 'Align', ['center', 'left', 'right']), ...XY],
  paperTitle: [t('text', 'Title'), t('kicker', 'Kicker'), n('size', 'Size', 3, 14, 0.5), FONT, c('bg', 'Paper'), c('ink', 'Ink'), n('tilt', 'Tilt', -8, 8, 0.5), ...XY],
  marker: [t('text', 'Phrase'), s('mode', 'Treatment', ['highlight', 'underline', 'double', 'strike', 'circle', 'box']), ANIM, n('size', 'Size', 3, 16, 0.5), FONT, c('ink', 'Text on highlight'), n('markAt', 'Marker at (s)', 0, 5, 0.1), ...XY],
  quoteCard: [t('text', 'Quote'), t('highlight', 'Highlight phrase'), t('source', 'Source'), n('size', 'Size', 3, 10, 0.5), FONT],
  lowerThird: [t('text', 'Name'), t('subtitle', 'Role'), n('size', 'Size', 3, 8, 0.5), ...XY],
  kinetic: [t('text', 'Words (*word* = big accent)'), n('size', 'Size', 6, 22, 0.5), n('stagger', 'Stagger (s)', 0.05, 0.5, 0.01), n('wobble', 'Wobble', 0, 15), FONT],
  scroller: [t('text', 'Text (• separates items)'), t('label', 'Label'), s('direction', 'Direction', ['horizontal', 'vertical']), n('size', 'Size', 2, 8, 0.2), n('pace', 'Pace', 0.3, 3, 0.1), c('barColor', 'Bar colour'), n('y', 'Y %', 0, 100)],
  chapter: [t('number', 'Number'), t('text', 'Title'), t('subtitle', 'Subtitle'), n('size', 'Size', 4, 14, 0.5), c('bg', 'Panel'), c('ink', 'Text'), FONT],
  textSwap: [t('text', 'First'), t('text2', 'Becomes'), n('size', 'Size', 4, 18, 0.5), n('swapAt', 'Swap at (s)', 0.3, 10, 0.1), ...XY],
  circularText: [t('text', 'Ring text'), t('center', 'Centre text'), n('radius', 'Radius', 10, 45), n('size', 'Size', 2, 9, 0.5), n('spin', 'Spin (°/s)', -90, 90), ...XY],
  counter: [n('value', 'Value', -1e12, 1e12, 0.01), n('from', 'From', -1e12, 1e12, 0.01), t('label', 'Label above'), t('text', 'Text below'), ...NUMFMT, t('currency', 'Currency symbol'), n('decimals', 'Decimals', 0, 4), s('style', 'Style', ['count', 'odometer']), n('size', 'Size', 6, 30, 0.5), n('countDur', 'Count time (s)', 0.3, 6, 0.1), YES('underline', 'Underline'), FONT, ...XY],
  bars: [TITLE, DATA, s('orientation', 'Orientation', ['vertical', 'horizontal']), s('mode', 'Series', ['stacked', 'grouped']), s('sort', 'Sort', ['none', 'desc', 'asc']), t('highlight', 'Highlight label'), t('legend', 'Legend (a, b)'), t('note', 'Conclusion'), t('source', 'Source'), ...NUMFMT, t('colors', 'Colours (#hex, …)'), n('stagger', 'Stagger (s)', 0, 1, 0.02)],
  lineChart: [TITLE, t('data', 'Data (x:y, …; next series)'), s('mode', 'Style', ['line', 'area']), t('legend', 'Legend'), t('note', 'Conclusion'), t('source', 'Source'), ...NUMFMT, n('drawDur', 'Draw time (s)', 0.3, 6, 0.1), YES('zeroBase', 'Start at zero')],
  pie: [TITLE, DATA, s('mode', 'Style', ['donut', 'pie']), t('highlight', 'Highlight label'), t('center', 'Centre text')],
  gauge: [n('value', 'Value (0-100)', 0, 100), t('label', 'Label'), s('mode', 'Style', ['ring', 'dial']), t('suffix', 'Suffix')],
  pictogram: [TITLE, n('value', 'Highlighted', 0, 100), n('total', 'Total', 1, 100), t('text', 'Caption'), s('icon', 'Icon', ['person', 'dot']), n('cols', 'Columns', 1, 20)],
  compare: [TITLE, t('labelA', 'Label A'), n('valueA', 'Value A', -1e12, 1e12, 0.01), t('labelB', 'Label B'), n('valueB', 'Value B', -1e12, 1e12, 0.01), t('diffText', 'Difference text'), ...NUMFMT, YES('showDiff', 'Show difference')],
  ranking: [TITLE, DATA, s('order', 'Order', ['top', 'countdown']), ...NUMFMT],
  funnel: [TITLE, DATA, s('mode', 'Shape', ['funnel', 'pyramid'])],
  bubbles: [TITLE, DATA],
  heatmap: [TITLE, t('data', 'Rows (Row:1|2|3, …)')],
  waterfall: [TITLE, t('data', 'Steps (Revenue:100, Costs:-40, …)')],
  worldMap: [s('mode', 'Mode', ['highlight', 'zoom', 'pins', 'route', 'compare', 'choropleth']), t('country', 'Country (or two, comma)'), t('cities', 'Pins (cities)'), t('from', 'Route from'), t('to', 'Route to'), s('line', 'Route line', ['solid', 'dotted', 'dashed']), t('data', 'Choropleth data'), TITLE, t('note', 'Info card'), t('label', 'Label'), s('mapTheme', 'Map look', ['dark', 'paper', 'light'])],
  globe: [t('country', 'Country'), t('label', 'Label'), TITLE, n('spinDur', 'Spin time (s)', 0.5, 6, 0.1), s('mapTheme', 'Map look', ['dark', 'paper', 'light'])],
  scribble: [s('shape', 'Shape', ['circle', 'oval', 'rect', 'underline', 'cross', 'check', 'question', 'exclaim']), ...XY, n('w', 'Width %', 2, 100), n('h', 'Height %', 2, 100), t('label', 'Label'), n('stroke', 'Stroke', 0.3, 3, 0.1), YES('double', 'Double'), n('drawDur', 'Draw time (s)', 0.2, 3, 0.1)],
  arrow: [n('x1', 'From X %', 0, 100), n('y1', 'From Y %', 0, 100), n('x2', 'To X %', 0, 100), n('y2', 'To Y %', 0, 100), s('style', 'Style', ['curved', 'straight', 'dotted', 'dashed']), n('curve', 'Curve', -0.6, 0.6, 0.05), t('label', 'Label'), n('stroke', 'Stroke', 0.3, 3, 0.1)],
  connector: [...XY, n('lx', 'Label X %', 0, 100), n('ly', 'Label Y %', 0, 100), t('text', 'Label'), t('subtitle', 'Detail'), s('style', 'Line', ['solid', 'dotted', 'dashed'])],
  bracket: [...XY, n('len', 'Length %', 5, 100), s('orientation', 'Orientation', ['vertical', 'horizontal']), t('label', 'Label')],
  magnifier: [...XY, n('radius', 'Radius', 5, 30), t('text', 'Inside text'), t('label', 'Label')],
  stamp: [t('text', 'Stamp text'), ...XY, n('size', 'Size', 4, 16, 0.5), n('rotate', 'Rotate', -30, 30)],
  redact: [...XY, n('w', 'Width %', 10, 95), n('lines', 'Lines', 1, 8), n('lineHeight', 'Line height', 2, 10, 0.5), t('text', 'Caption')],
  sticky: [t('text', 'Note'), ...XY, n('size', 'Size', 15, 50), n('rotate', 'Rotate', -15, 15), c('bg', 'Paper')],
  bubble: [t('text', 'Text'), s('kind', 'Kind', ['speech', 'thought']), ...XY, n('tx', 'Tail X %', 0, 100), n('ty', 'Tail Y %', 0, 100), n('size', 'Size', 2, 8, 0.2)],
  numbered: [t('points', 'Points (x,y; x,y)'), t('labels', 'Labels (a; b)'), n('stagger', 'Stagger (s)', 0.1, 1.5, 0.05)],
  documentCard: [TITLE, t('text', 'Document text'), t('highlight', 'Highlight phrase'), t('source', 'Source line'), n('size', 'Text size', 2, 6, 0.1), n('rotate', 'Rotate', -6, 6, 0.5), YES('zoom', 'Camera push-in')],
  cursor: [n('x1', 'From X %', 0, 100), n('y1', 'From Y %', 0, 100), n('x2', 'To X %', 0, 100), n('y2', 'To Y %', 0, 100), t('label', 'Label')],
  shape: [s('shape', 'Shape', ['circle', 'square', 'triangle', 'hexagon', 'star', 'line']), s('anim', 'Animation', ['draw', 'scale', 'pop', 'wipe', 'rotate', 'ripple', 'morph']), n('size', 'Size %', 3, 90), YES('filled', 'Filled'), n('stroke', 'Stroke', 0.3, 4, 0.1), ...XY],
  burst: [n('count', 'Pieces', 6, 150), s('direction', 'Direction', ['out', 'in']), s('shape', 'Pieces', ['mixed', 'circle', 'square', 'triangle']), t('colors', 'Colours'), ...XY],
  gridReveal: [n('cols', 'Columns', 3, 24), s('mode', 'Mode', ['lines', 'tiles'])],
  split: [t('labelA', 'Left/top title'), t('textA', 'Left/top text'), t('labelB', 'Right/bottom title'), t('textB', 'Right/bottom text'), c('colorA', 'Colour A'), c('colorB', 'Colour B'), YES('vs', 'VS badge'), t('vsText', 'Badge text')],
  cards: [TITLE, t('items', 'Cards (Title|text; …)'), s('layout', 'Layout', ['row', 'list', 'stack', 'fan']), n('highlight', 'Highlight card #', 0, 10), n('stagger', 'Stagger (s)', 0.05, 1, 0.05)],
  browser: [t('url', 'URL'), t('text', 'Page title'), n('highlightLine', 'Highlight line', 0, 6)],
  search: [t('query', 'Search query'), t('results', 'Results (a; b; c)'), n('select', 'Selected result', 0, 6)],
  chat: [t('messages', 'Messages (A: hi; B: hello)'), n('stagger', 'Gap (s)', 0.3, 2, 0.1)],
  socialPost: [t('name', 'Name'), t('handle', 'Handle'), t('text', 'Post'), n('likes', 'Likes', 0, 1e9), n('comments', 'Comments', 0, 1e9), t('comment', 'Highlighted comment')],
  newspaper: [t('masthead', 'Masthead'), t('text', 'Headline'), t('highlight', 'Highlight phrase'), n('zoomTo', 'Zoom', 0, 1.5, 0.05)],
  evidenceBoard: [t('items', 'Cards (Title|text; …)')],
  mythFact: [t('labelA', 'Label A'), t('textA', 'Myth'), t('labelB', 'Label B'), t('textB', 'Fact')],
  timeline: [t('events', 'Events (1947|Independence; …)'), s('orientation', 'Orientation', ['horizontal', 'vertical']), YES('bigYear', 'Big year counter'), n('stagger', 'Per event (s)', 0.3, 3, 0.1)],
  flow: [t('steps', 'Steps (a; b; c)'), s('layout', 'Layout', ['linear', 'cycle']), n('stagger', 'Per step (s)', 0.3, 3, 0.1)],
  network: [t('nodes', 'Nodes (hub first; a; b)'), YES('mesh', 'Connect neighbours')],
  causeEffect: [t('steps', 'Chain (cause; effect; result)'), t('labels', 'Labels')],
  tree: [t('tree', 'Tree (Root>A,B; A>A1)')],
  science: [s('kind', 'Kind', ['atom', 'wave', 'gears', 'dna', 'solar', 'circuit', 'molecule', 'heartbeat']), t('label', 'Label'), n('size', 'Size %', 10, 80), ...XY],
  coins: [t('data', 'Stacks (Label:value, …)')],
  currency: [n('value', 'Amount', 0, 1e12, 0.01), n('rate', 'Rate', 0, 1e6, 0.0001), t('from', 'From symbol'), t('to', 'To symbol'), t('note', 'Note')],
  moneyFlow: [t('from', 'From'), t('to', 'To'), n('value', 'Total', 0, 1e12), t('prefix', 'Prefix'), t('suffix', 'Suffix'), t('icon', 'Icon (emoji)')],
  particles: [s('kind', 'Kind', ['dust', 'rain', 'snow', 'confetti', 'sparks', 'embers', 'bokeh', 'stars', 'fireflies']), n('count', 'Count', 5, 400), t('colors', 'Colours')],
  look: [s('kind', 'Look', ['lightSweep', 'rays', 'grain', 'vignette', 'lightLeak', 'filmBurn', 'vhs', 'glitch', 'spotlight', 'fog', 'gradient', 'pattern', 'colorWash', 'glow']), n('amount', 'Amount', 0, 1, 0.05), ...XY, n('radius', 'Radius', 5, 80), c('accent2', 'Second colour'), s('pattern', 'Pattern', ['dots', 'grid', 'stripes'])],
  transition: [s('kind', 'Kind', ['wipe', 'dip', 'iris', 'radial', 'shutter', 'blinds', 'split', 'grid', 'pixel', 'paperTear', 'lineWipe']), s('direction', 'Direction', ['left', 'right', 'up', 'down']), c('accent2', 'Second colour'), t('text', 'Text on wipe')],
  audioViz: [s('kind', 'Kind', ['bars', 'line', 'circle', 'beat', 'progress', 'speaker']), n('bpm', 'BPM', 40, 200), t('text', 'Speaker name'), ...XY],
};

export interface FxDef {
  id: string;
  base: BaseId;
  category: Exclude<Category, 'sequences'>;
  label: string;
  description: string;
  duration: number;
  defaults: Record<string, string | number | boolean>;
}

type Row = [id: string, base: BaseId, category: FxDef['category'], label: string, description: string, duration: number, defaults?: FxDef['defaults']];
const W = (text: string) => ({ text });

// ---------------------------------------------------------------- the library (presets)
const ROWS: Row[] = [
  // ---- typography
  ['wordReveal', 'textReveal', 'typography', 'Word-by-word reveal', 'Words rise in one after another with the narration', 3, { unit: 'word', anim: 'up' }],
  ['letterReveal', 'textReveal', 'typography', 'Letter-by-letter reveal', 'Each letter fades up in sequence', 3, { unit: 'letter', anim: 'up', size: 9 }],
  ['typewriter', 'textReveal', 'typography', 'Typewriter', 'Characters type on with a blinking caret', 3.5, { anim: 'typewriter', font: 'mono', size: 6, ...W('Breaking: the river is dark') }],
  ['lineReveal', 'textReveal', 'typography', 'Line-by-line reveal', 'Lines slide up through a mask, one by one', 3.5, { unit: 'line', anim: 'mask', ...W('Some things / you only see / in the dark') }],
  ['sentenceReveal', 'textReveal', 'typography', 'Sentence reveal', 'The whole sentence fades up at once', 3, { unit: 'whole', anim: 'up', size: 6.5 }],
  ['textSlideIn', 'textReveal', 'typography', 'Text slide-in', 'Words slide in from the side', 3, { unit: 'word', anim: 'left' }],
  ['textScaleIn', 'textReveal', 'typography', 'Text scale-in', 'Words grow from small to full size', 3, { unit: 'word', anim: 'scale' }],
  ['textFade', 'textReveal', 'typography', 'Text fade-in', 'A calm fade, word by word', 3, { unit: 'word', anim: 'fade', stagger: 0.12 }],
  ['textBlurReveal', 'textReveal', 'typography', 'Text blur reveal', 'Words come into focus from a blur', 3, { unit: 'word', anim: 'blur' }],
  ['textMaskReveal', 'textReveal', 'typography', 'Text mask reveal', 'Words emerge from behind an invisible line', 3, { unit: 'word', anim: 'mask', size: 10 }],
  ['textWipeReveal', 'textReveal', 'typography', 'Text wipe reveal', 'The line is wiped on from left to right', 3, { unit: 'line', anim: 'wipe', size: 9 }],
  ['textPop', 'textReveal', 'typography', 'Text pop / bounce', 'Words pop in with a bounce', 3, { unit: 'word', anim: 'bounce' }],
  ['textRotateReveal', 'textReveal', 'typography', 'Text rotation reveal', 'Words swing up into place', 3, { unit: 'word', anim: 'rotate' }],
  ['textFlip', 'textReveal', 'typography', 'Text flip', 'Words flip up like a departure board', 3, { unit: 'word', anim: 'flip' }],
  ['textDrop', 'textReveal', 'typography', 'Text drop', 'Words drop in from above', 3, { unit: 'word', anim: 'drop' }],
  ['trackingExpand', 'textReveal', 'typography', 'Text tracking expansion', 'Letters spread from wide tracking into place', 3, { unit: 'whole', anim: 'tracking', case: 'upper', size: 9 }],
  ['textScramble', 'textReveal', 'typography', 'Text scramble', 'Letters decode from random characters', 3, { unit: 'letter', anim: 'scramble', font: 'mono', size: 7, stagger: 0.04 }],
  ['staggeredType', 'textReveal', 'typography', 'Staggered typography', 'Long stagger, big type, cinematic', 4, { unit: 'word', anim: 'up', stagger: 0.25, size: 11 }],
  ['perspectiveText', 'textReveal', 'typography', 'Perspective text', 'Text tilted in 3-D space', 3, { unit: 'word', anim: 'up', tilt: 25, size: 10 }],
  ['subtitleEmphasis', 'textReveal', 'typography', 'Subtitle emphasis', '*Starred* words pop in the accent with a marker behind', 3, { unit: 'word', anim: 'up', emMarker: true, size: 6, y: 78, ...W('This is the *key* word') }],
  ['textOnPaper', 'textReveal', 'typography', 'Text on paper strip', 'Words on a paper-coloured strip', 3, { unit: 'word', anim: 'up', box: 'paper', size: 6.5 }],
  ['textTag', 'textReveal', 'typography', 'Text tag', 'Small label tag that snaps in', 2.5, { unit: 'whole', anim: 'pop', box: 'tag', size: 4, case: 'upper' }],
  ['oversizedHeadline', 'kinetic', 'typography', 'Oversized headline', 'Huge stacked words slam in one by one', 3, {}],
  ['kineticTypography', 'kinetic', 'typography', 'Kinetic typography', 'Alternating sizes and colours, energetic', 3.5, { text: 'BIG *IDEAS* START SMALL', wobble: 10 }],
  ['paperTitle', 'paperTitle', 'typography', 'Paper title card', 'Torn paper slides up, title fades in, marker line draws', 3.5, {}],
  ['markerHighlight', 'marker', 'typography', 'Marker highlight sweep', 'Highlighter sweeps behind a phrase', 3, { mode: 'highlight' }],
  ['markerUnderline', 'marker', 'typography', 'Marker underline', 'Hand-drawn underline sweeps beneath', 3, { mode: 'underline', accent: '#E63946' }],
  ['doubleUnderline', 'marker', 'typography', 'Double underline', 'Two quick marker strokes', 3, { mode: 'double', accent: '#E63946' }],
  ['strikeThrough', 'marker', 'typography', 'Text strike-through', 'A marker line crosses the phrase out', 3, { mode: 'strike', accent: '#E63946', text: 'impossible' }],
  ['circledWord', 'marker', 'typography', 'Circled word', 'A red pen circle around a phrase', 3, { mode: 'circle', accent: '#E63946' }],
  ['boxedWord', 'marker', 'typography', 'Boxed word', 'A hand-drawn box around a phrase', 3, { mode: 'box', accent: '#F9D84A' }],
  ['quoteCard', 'quoteCard', 'typography', 'Quote card reveal', 'Frame dims, big quote marks, lines reveal, phrase highlighted', 5, { highlight: 'create it', source: 'Peter Drucker' }],
  ['pullQuote', 'quoteCard', 'typography', 'Pull-quote', 'Short, punchy quote with source', 4, { text: 'We had no idea it would spread this fast.', source: 'Local official', highlight: 'this fast', size: 7 }],
  ['lowerThird', 'lowerThird', 'typography', 'Lower-third title', 'Name and role slide in beside an accent bar', 4, {}],
  ['newsTicker', 'scroller', 'typography', 'News ticker', 'Scrolling breaking-news bar', 6, {}],
  ['scrollingCredits', 'scroller', 'typography', 'Scrolling text', 'Vertical scroll like end credits', 8, { direction: 'vertical', text: 'Written by • Narrated by • Music by • Thanks for watching' }],
  ['chapterCard', 'chapter', 'typography', 'Chapter title', 'Colour panel wipes, chapter number and title', 3, {}],
  ['textMorph', 'textSwap', 'typography', 'Text morphing', 'One phrase blurs and morphs into another', 3, { text: 'Myth', text2: 'Reality' }],
  ['numberToText', 'textSwap', 'typography', 'Number-to-text', 'A number transforms into its meaning', 3, { text: '1,000,000', text2: 'one million people' }],
  ['circularText', 'circularText', 'typography', 'Circular text', 'Text runs around a rotating ring', 4, {}],
  ['handwrittenNote', 'textReveal', 'typography', 'Handwritten annotation', 'Marker-style handwriting that writes on', 3, { anim: 'typewriter', font: 'marker', size: 6, color: '#E63946', cps: 14, text: 'look here!' }],
  // ---- data
  ['countingNumber', 'counter', 'data', 'Counting number', 'A big number counts up and settles', 3.5, {}],
  ['percentCounter', 'counter', 'data', 'Percentage counter', 'Counts up to a percentage', 3.5, { value: 73, format: 'percent', label: 'of people', text: 'use mobile data daily' }],
  ['currencyCounter', 'counter', 'data', 'Currency counter', 'Rupee (or any currency) amount with Indian grouping', 3.5, { value: 2500000, format: 'currency', currency: '₹', label: 'Total cost' }],
  ['decimalCounter', 'counter', 'data', 'Decimal counter', 'Counts with decimals (e.g. 7.2%)', 3.5, { value: 7.2, format: 'decimal', suffix: '%', label: 'GDP growth' }],
  ['odometer', 'counter', 'data', 'Number odometer', 'Digits roll like a meter', 3.5, { value: 2026, style: 'odometer', grouping: 'none', label: 'Year' }],
  ['numberRoll', 'counter', 'data', 'Number roll', 'Fast slot-machine roll to the value', 3, { value: 1400000000, style: 'odometer', label: 'Population' }],
  ['countDown', 'counter', 'data', 'Count down', 'Counts down from a value (e.g. decline)', 3.5, { from: 4000, value: 120, label: 'Tigers left', countEase: 'easeInOut' }],
  ['barGrowth', 'bars', 'data', 'Bar chart growth', 'Bars grow from the baseline with labels', 5, { orientation: 'vertical' }],
  ['horizontalBars', 'bars', 'data', 'Horizontal bar growth', 'Bars grow sideways — best for long labels', 5, { orientation: 'horizontal' }],
  ['stackedBars', 'bars', 'data', 'Stacked bar chart', 'Each bar is made of segments', 5, { data: '2020:30|20|10, 2022:40|25|15, 2024:50|30|25', legend: 'Rural, Urban, Metro' }],
  ['groupedBars', 'bars', 'data', 'Grouped bar chart', 'Side-by-side series per category', 5, { mode: 'grouped', data: 'North:30|45, South:50|40, East:20|35', legend: '2020, 2025', orientation: 'vertical' }],
  ['barHighlight', 'bars', 'data', 'Chart bar highlight', 'One bar turns accent, others dim', 5, { highlight: 'C' }],
  ['chartSorting', 'bars', 'data', 'Chart sorting / ranking bars', 'Bars arranged from biggest to smallest', 5, { sort: 'desc', orientation: 'horizontal', data: 'Pune:79, Mumbai:92, Chennai:76, Delhi:88' }],
  ['lineDraw', 'lineChart', 'data', 'Line graph drawing', 'A line traces across the years; the head carries its value', 5, {}],
  ['multiLine', 'lineChart', 'data', 'Multiple line graph', 'Two or more series draw together', 5, { data: '2000:10, 2010:30, 2020:55; 2000:20, 2010:25, 2020:30', legend: 'India, World' }],
  ['areaReveal', 'lineChart', 'data', 'Area chart reveal', 'Filled area grows under the line', 5, { mode: 'area' }],
  ['pieReveal', 'pie', 'data', 'Pie chart reveal', 'Slices sweep around in order', 4.5, { mode: 'pie' }],
  ['donutReveal', 'pie', 'data', 'Donut chart reveal', 'Segments sweep around a ring with a centre total', 4.5, { mode: 'donut' }],
  ['radialProgress', 'gauge', 'data', 'Radial progress', 'A ring fills to a percentage', 3.5, { mode: 'ring', label: 'Literacy rate' }],
  ['gaugeDial', 'gauge', 'data', 'Gauge animation', 'Needle swings across a dial', 3.5, { mode: 'dial', value: 82, label: 'Risk level' }],
  ['pictogram', 'pictogram', 'data', 'Pictogram chart', '“3 in 10 people…” icons fill in', 4, {}],
  ['beforeAfter', 'compare', 'data', 'Before / after comparison', 'Two values count and grow side by side, difference badge', 4.5, {}],
  ['rankingChart', 'ranking', 'data', 'Ranking chart', 'Ranked rows slide in; #1 glows', 5, {}],
  ['funnelChart', 'funnel', 'data', 'Funnel chart', 'Stages narrow down', 4.5, {}],
  ['pyramidChart', 'funnel', 'data', 'Pyramid chart', 'Layers build into a pyramid', 4.5, { mode: 'pyramid', data: 'Leaders:5, Managers:20, Staff:75' }],
  ['bubbleChart', 'bubbles', 'data', 'Bubble chart', 'Circles sized by value pop in, packed together', 4.5, {}],
  ['heatmapReveal', 'heatmap', 'data', 'Heatmap reveal', 'Cells fill in a diagonal wave', 4.5, {}],
  ['waterfallChart', 'waterfall', 'data', 'Waterfall chart', 'Running total with rises and falls', 5, {}],
  ['histogram', 'bars', 'data', 'Histogram', 'Distribution bars, no gaps feel', 5, { data: '0-10:4, 10-20:9, 20-30:15, 30-40:11, 40-50:6, 50+:2', stagger: 0.08 }],
  ['dataLabelReveal', 'counter', 'data', 'Statistical annotation', 'Small number + label to pin on footage', 3, { size: 9, value: 38, suffix: '%', label: 'Unemployment', underline: false, x: 75, y: 25 }],
  // ---- maps
  ['countryHighlight', 'worldMap', 'maps', 'Country highlight', 'World map; one country lights up with a pulse', 4, { mode: 'highlight', country: 'India' }],
  ['mapZoomIn', 'worldMap', 'maps', 'Map zoom-in', 'World map zooms into a country, which highlights', 5, { mode: 'zoom', country: 'India' }],
  ['pinDrop', 'worldMap', 'maps', 'Location pin drop', 'Pins drop on cities one by one', 4.5, { mode: 'pins', cities: 'Delhi, Mumbai, Bengaluru, Kolkata' }],
  ['routeDraw', 'worldMap', 'maps', 'Route drawing', 'A great-circle route draws between two places', 6, { mode: 'route', from: 'Delhi', to: 'London' }],
  ['flightPath', 'worldMap', 'maps', 'Flight path', 'Dotted flight route with a travelling dot', 6, { mode: 'route', from: 'Mumbai', to: 'New York', line: 'dotted' }],
  ['shippingRoute', 'worldMap', 'maps', 'Shipping route', 'Dashed sea route on a paper map', 6, { mode: 'route', from: 'Shanghai', to: 'Mumbai', line: 'dashed', mapTheme: 'paper' }],
  ['regionCompare', 'worldMap', 'maps', 'Region comparison', 'Two countries in contrasting colours', 4.5, { mode: 'compare', country: 'India, China' }],
  ['choropleth', 'worldMap', 'maps', 'Map data (choropleth)', 'Countries shaded by value', 5, { mode: 'choropleth', title: 'Population (crore)' }],
  ['globeSpin', 'globe', 'maps', 'Globe rotation', 'A globe spins to a country and pins it', 5, {}],
  ['paperMap', 'worldMap', 'maps', 'Paper map highlight', 'Vintage paper-style map with a highlight', 4, { mode: 'highlight', mapTheme: 'paper', country: 'Egypt' }],
  // ---- annotations
  ['redCircle', 'scribble', 'annotations', 'Red circle', 'Hand-drawn circle around a subject', 2.5, { shape: 'circle' }],
  ['handOval', 'scribble', 'annotations', 'Hand-drawn oval', 'Wide oval around a phrase or object', 2.5, { shape: 'oval', w: 50, h: 12 }],
  ['handRect', 'scribble', 'annotations', 'Hand-drawn rectangle', 'Marker box around a region', 2.5, { shape: 'rect', w: 50, h: 20 }],
  ['handUnderline', 'scribble', 'annotations', 'Underline mark', 'Marker underline to place under anything', 2.5, { shape: 'underline', w: 50 }],
  ['crossOut', 'scribble', 'annotations', 'Cross out', 'Big red X over something wrong', 2.5, { shape: 'cross', w: 30, h: 18 }],
  ['checkMark', 'scribble', 'annotations', 'Check mark', 'Green tick draws on', 2.5, { shape: 'check', w: 20, h: 10, accent: '#2A9D8F' }],
  ['questionMark', 'scribble', 'annotations', 'Hand-drawn question mark', 'Big marker “?” pops in', 2.5, { shape: 'question', w: 30 }],
  ['exclamationMark', 'scribble', 'annotations', 'Hand-drawn exclamation', 'Big marker “!” pops in', 2.5, { shape: 'exclaim', w: 30 }],
  ['arrowDraw', 'arrow', 'annotations', 'Arrow draw', 'Straight arrow draws to a point', 2.5, { style: 'straight' }],
  ['curvedArrow', 'arrow', 'annotations', 'Curved arrow draw', 'Curved marker arrow with a label', 2.5, { style: 'curved', label: 'this one' }],
  ['dottedArrow', 'arrow', 'annotations', 'Dotted connector arrow', 'Dotted path arrow', 2.5, { style: 'dotted' }],
  ['leaderLine', 'connector', 'annotations', 'Leader line label', 'Dot on a point, line out to a label', 3, {}],
  ['dashedConnector', 'connector', 'annotations', 'Dashed connector', 'Dashed pointer to a label', 3, { style: 'dashed' }],
  ['bracketAnnotation', 'bracket', 'annotations', 'Bracket annotation', 'Curly bracket groups a region', 2.5, { label: 'same group' }],
  ['magnifier', 'magnifier', 'annotations', 'Magnifying glass', 'A lens glides in to inspect a detail', 3, { text: '₹4,200', label: 'the receipt' }],
  ['stampReveal', 'stamp', 'annotations', 'Rubber stamp reveal', 'A stamp slams down with ink texture', 2.5, {}],
  ['approvedStamp', 'stamp', 'annotations', 'Approved stamp', 'Green APPROVED stamp', 2.5, { text: 'APPROVED', accent: '#2A9D8F', rotate: -8 }],
  ['fakeStamp', 'stamp', 'annotations', 'Fake / false stamp', 'Red FAKE stamp for debunks', 2.5, { text: 'FAKE' }],
  ['redaction', 'redact', 'annotations', 'Redaction bars', 'Black bars wipe over text lines', 3, {}],
  ['stickyNote', 'sticky', 'annotations', 'Sticky note', 'Yellow note drops in with tape', 3, {}],
  ['speechBubble', 'bubble', 'annotations', 'Speech bubble', 'A speech bubble pops from a point', 3, {}],
  ['thoughtBubble', 'bubble', 'annotations', 'Thought bubble', 'Cloud bubble with trailing dots', 3, { kind: 'thought', text: 'What if…' }],
  ['numberedCallouts', 'numbered', 'annotations', 'Numbered callouts', 'Numbered markers pop in one by one', 3.5, { labels: 'Engine; Wheels; Fuel' }],
  ['documentExcerpt', 'documentCard', 'annotations', 'Document excerpt', 'Paper slides in, camera pushes, phrase is highlighted', 5, {}],
  ['cursorClick', 'cursor', 'annotations', 'Animated cursor click', 'Mouse glides to a spot and clicks', 2.5, {}],
  // ---- shapes
  ['circleDraw', 'shape', 'shapes', 'Circle reveal (draw)', 'A circle outline draws on', 2, { shape: 'circle', anim: 'draw' }],
  ['circleExpand', 'shape', 'shapes', 'Circle expansion', 'A filled circle grows from the centre', 2, { shape: 'circle', anim: 'scale', filled: true }],
  ['squareReveal', 'shape', 'shapes', 'Rectangle reveal', 'A square draws on', 2, { shape: 'square', anim: 'draw' }],
  ['triangleBuild', 'shape', 'shapes', 'Triangle construction', 'Triangle path draws then fills', 2, { shape: 'triangle', anim: 'draw', filled: true }],
  ['polygonReveal', 'shape', 'shapes', 'Polygon reveal', 'Hexagon pops in', 2, { shape: 'hexagon', anim: 'pop', filled: true }],
  ['starPop', 'shape', 'shapes', 'Star pop', 'Star pops with a spin', 2, { shape: 'star', anim: 'rotate', filled: true }],
  ['lineDrawShape', 'shape', 'shapes', 'Line draw', 'A single line draws across', 2, { shape: 'line', anim: 'draw', size: 70 }],
  ['shapeWipe', 'shape', 'shapes', 'Shape wipe', 'Shape wiped on from the left', 2, { shape: 'square', anim: 'wipe', filled: true }],
  ['shapeMorph', 'shape', 'shapes', 'Shape morph', 'Circle morphs to square and back', 4, { anim: 'morph' }],
  ['ripple', 'shape', 'shapes', 'Shape ripple', 'Concentric rings ripple outward', 4, { anim: 'ripple' }],
  ['geometricExplosion', 'burst', 'shapes', 'Geometric explosion', 'Pieces burst outward', 2, {}],
  ['shapeAssembly', 'burst', 'shapes', 'Shape assembly', 'Scattered pieces gather into a point', 2, { direction: 'in' }],
  ['gridReveal', 'gridReveal', 'shapes', 'Grid reveal', 'Grid lines draw across the frame', 2.5, {}],
  ['tileReveal', 'gridReveal', 'shapes', 'Pattern / tile reveal', 'Tiles pop in a diagonal wave', 2.5, { mode: 'tiles' }],
  // ---- layouts
  ['splitScreen', 'split', 'layouts', 'Split-screen comparison', 'Two panels slide in with a VS badge', 4, {}],
  ['cardRow', 'cards', 'layouts', 'Floating cards', 'Cards rise in side by side', 4, {}],
  ['cardList', 'cards', 'layouts', 'Card list', 'Stacked rows of key points', 4, { layout: 'list', highlight: 2 }],
  ['cardStack', 'cards', 'layouts', 'Stacked photo cards', 'Cards pile up at angles', 4, { layout: 'stack' }],
  ['cardFan', 'cards', 'layouts', 'Rotating card fan', 'Cards fan out like a hand', 4, { layout: 'fan' }],
  ['browserReveal', 'browser', 'layouts', 'Browser window reveal', 'URL types, page loads, a line is boxed', 4.5, {}],
  ['searchInvestigation', 'search', 'layouts', 'Search bar & results', 'Query types, results drop, one is selected', 5, {}],
  ['chatConversation', 'chat', 'layouts', 'Chat conversation', 'Phone with messages popping in', 5, {}],
  ['socialPost', 'socialPost', 'layouts', 'Social media post', 'Post card with counting likes and a highlighted comment', 4.5, { comment: '“This finally makes sense.”' }],
  ['newspaperZoom', 'newspaper', 'layouts', 'Newspaper headline zoom', 'Paper slides in, zooms to the headline, highlight', 5, {}],
  ['evidenceBoard', 'evidenceBoard', 'layouts', 'Evidence board', 'Pinned cards joined by red string', 5, {}],
  ['mythVsFact', 'mythFact', 'layouts', 'Myth vs fact', 'Myth crossed out, fact ticked', 4.5, {}],
  // ---- timelines
  ['timelineHorizontal', 'timeline', 'timelines', 'Horizontal timeline', 'Line draws, events appear, big year counter', 6, { orientation: 'horizontal' }],
  ['timelineVertical', 'timeline', 'timelines', 'Vertical timeline', 'Top-to-bottom milestones', 6, { orientation: 'vertical' }],
  ['decadeProgression', 'timeline', 'timelines', 'Decade progression', 'Decades step by with a year counter', 6, { events: '1980|Analogue; 1990|PCs; 2000|Internet; 2010|Smartphones; 2020|AI', bigYear: true }],
  ['thenVsNow', 'split', 'timelines', 'Then versus now', 'Two eras side by side', 4, { labelA: '1990', textA: 'Letters took a week', labelB: 'Today', textB: 'Messages take a second', colorA: '#8D6E63', colorB: '#2A6FDB' }],
  ['yearCounter', 'counter', 'timelines', 'Historical year counter', 'Years roll forward to a date', 3, { from: 1900, value: 2026, grouping: 'none', label: 'Year', countDur: 2 }],
  // ---- diagrams
  ['processFlow', 'flow', 'diagrams', 'Process flow', 'Steps appear with arrows; the active one glows', 5, {}],
  ['circularProcess', 'flow', 'diagrams', 'Circular process / feedback loop', 'Steps around a cycle', 5, { layout: 'cycle', steps: 'Plant; Grow; Harvest; Sell' }],
  ['networkGraph', 'network', 'diagrams', 'Network graph', 'Hub and connected nodes with travelling pulses', 5, {}],
  ['causeAndEffect', 'causeEffect', 'diagrams', 'Cause and effect', 'Cause → effect → result chain', 4.5, {}],
  ['orgChart', 'tree', 'diagrams', 'Organisation chart / hierarchy', 'Levels reveal top-down with connectors', 5, {}],
  ['decisionTree', 'tree', 'diagrams', 'Decision tree', 'Branching choices', 5, { tree: 'Rain?>Yes,No; Yes>Umbrella; No>Sunglasses' }],
  // ---- science
  ['atomOrbit', 'science', 'science', 'Atomic orbit', 'Electrons orbit a nucleus', 4, { kind: 'atom' }],
  ['wavePropagation', 'science', 'science', 'Wave propagation', 'A travelling sine wave', 4, { kind: 'wave' }],
  ['gearAnimation', 'science', 'science', 'Gear animation', 'Two meshing gears turn', 4, { kind: 'gears' }],
  ['dnaHelix', 'science', 'science', 'DNA helix rotation', 'A rotating double helix', 4, { kind: 'dna' }],
  ['solarSystem', 'science', 'science', 'Solar system', 'Planets orbit the sun', 5, { kind: 'solar' }],
  ['circuitTrace', 'science', 'science', 'Circuit tracing', 'Electric pulses race along circuit lines', 4, { kind: 'circuit' }],
  ['molecule', 'science', 'science', 'Molecular structure', 'A rotating water molecule', 4, { kind: 'molecule', label: 'H₂O' }],
  ['heartbeat', 'science', 'science', 'Heartbeat / signal', 'ECG line pulses across', 4, { kind: 'heartbeat' }],
  // ---- finance
  ['coinStack', 'coins', 'finance', 'Coin stacking', 'Stacks of coins grow to their values', 4, {}],
  ['currencyConversion', 'currency', 'finance', 'Dollar-to-rupee conversion', 'Amount counts, converts and counts again', 4, {}],
  ['moneyFlow', 'moneyFlow', 'finance', 'Money flow', 'Money travels from one side to the other', 5, { value: 50000 }],
  ['budgetDonut', 'pie', 'finance', 'Budget allocation', 'Where the money goes, as a donut', 4.5, { title: 'Where ₹100 goes', data: 'Defence:13, Interest:24, States:20, Subsidies:9, Other:34' }],
  ['revenueGraph', 'lineChart', 'finance', 'Revenue graph', 'Revenue line with crore values', 5, { title: 'Revenue (₹ cr)', data: 'FY21:120, FY22:180, FY23:260, FY24:410', prefix: '₹', mode: 'area' }],
  ['stockMove', 'lineChart', 'finance', 'Stock price movement', 'Jagged price line with the latest value', 5, { title: 'Share price', data: 'Mon:412, Tue:398, Wed:430, Thu:421, Fri:455', prefix: '₹', zeroBase: false }],
  ['salaryCompare', 'compare', 'finance', 'Salary comparison', 'Two salaries with the difference', 4.5, { labelA: 'Fresher', valueA: 450000, labelB: '5 years', valueB: 1800000, format: 'currency', prefix: '₹', grouping: 'indian' }],
  ['financialWaterfall', 'waterfall', 'finance', 'Financial waterfall', 'Revenue to profit, step by step', 5, {}],
  // ---- atmosphere
  ['dustParticles', 'particles', 'atmosphere', 'Dust particles', 'Soft motes drifting', 6, { kind: 'dust' }],
  ['rainFx', 'particles', 'atmosphere', 'Rain', 'Falling rain streaks', 6, { kind: 'rain' }],
  ['snowFx', 'particles', 'atmosphere', 'Snowfall', 'Drifting snowflakes', 6, { kind: 'snow' }],
  ['confetti', 'particles', 'atmosphere', 'Confetti', 'Celebration confetti', 4, { kind: 'confetti' }],
  ['sparks', 'particles', 'atmosphere', 'Spark effect', 'Rising sparks', 5, { kind: 'sparks' }],
  ['embers', 'particles', 'atmosphere', 'Fire embers', 'Orange embers floating up', 5, { kind: 'embers' }],
  ['bokeh', 'particles', 'atmosphere', 'Bokeh lights', 'Soft out-of-focus circles', 6, { kind: 'bokeh' }],
  ['twinklingStars', 'particles', 'atmosphere', 'Twinkling stars', 'Night sky sparkle', 6, { kind: 'stars' }],
  ['fireflyGlow', 'particles', 'atmosphere', 'Firefly glow', 'Glowing fireflies wandering', 6, { kind: 'fireflies' }],
  ['lightSweep', 'look', 'atmosphere', 'Light sweep', 'A sheen sweeps across', 3, { kind: 'lightSweep' }],
  ['lightRays', 'look', 'atmosphere', 'Light rays', 'Rotating god rays', 5, { kind: 'rays' }],
  ['filmGrain', 'look', 'atmosphere', 'Film grain', 'Animated grain overlay', 6, { kind: 'grain' }],
  ['vignette', 'look', 'atmosphere', 'Vignette', 'Darkened edges', 6, { kind: 'vignette' }],
  ['lightLeak', 'look', 'atmosphere', 'Light leak', 'Warm film light leaks', 5, { kind: 'lightLeak' }],
  ['filmBurn', 'look', 'atmosphere', 'Film burn', 'A burn flash (use at a cut)', 1.5, { kind: 'filmBurn' }],
  ['vhsLook', 'look', 'atmosphere', 'VHS effect', 'Scanlines, tracking noise, PLAY tag', 5, { kind: 'vhs' }],
  ['glitchBars', 'look', 'atmosphere', 'Glitch / RGB split', 'Glitch bars in red and cyan', 2, { kind: 'glitch' }],
  ['spotlight', 'look', 'atmosphere', 'Spotlight', 'Darken everything but one spot', 4, { kind: 'spotlight' }],
  ['fogDrift', 'look', 'atmosphere', 'Fog movement', 'Soft fog drifting', 6, { kind: 'fog' }],
  ['gradientMove', 'look', 'atmosphere', 'Gradient movement', 'Slowly rotating colour gradient background', 6, { kind: 'gradient' }],
  ['patternBackground', 'look', 'atmosphere', 'Animated background pattern', 'Moving dots / grid / stripes', 6, { kind: 'pattern' }],
  ['colourWash', 'look', 'atmosphere', 'Colour wash', 'Tint the footage a colour', 4, { kind: 'colorWash' }],
  ['glowPulse', 'look', 'atmosphere', 'Glow pulse', 'A pulsing radial glow', 4, { kind: 'glow' }],
  // ---- transitions
  ['wipeTransition', 'transition', 'transitions', 'Wipe transition', 'Colour panel wipes across the cut', 0.9, {}],
  ['dipToColour', 'transition', 'transitions', 'Dip to colour', 'Fade through a colour', 0.9, { kind: 'dip', accent: '#000000' }],
  ['irisTransition', 'transition', 'transitions', 'Iris transition', 'Circle closes and opens', 1, { kind: 'iris' }],
  ['radialWipe', 'transition', 'transitions', 'Radial (clock) wipe', 'Sweeps round like a clock hand', 1, { kind: 'radial' }],
  ['shutterTransition', 'transition', 'transitions', 'Shutter transition', 'Top and bottom halves close and open', 0.9, { kind: 'shutter' }],
  ['blindsTransition', 'transition', 'transitions', 'Venetian blinds', 'Strips close and open', 1, { kind: 'blinds' }],
  ['splitTransition', 'transition', 'transitions', 'Split / doors', 'Two halves slide shut and apart', 1, { kind: 'split' }],
  ['gridWipe', 'transition', 'transitions', 'Grid wipe', 'Squares fill diagonally', 1.1, { kind: 'grid' }],
  ['pixelDissolve', 'transition', 'transitions', 'Pixel dissolve', 'Random blocks cover and clear', 1.1, { kind: 'pixel' }],
  ['paperTearTransition', 'transition', 'transitions', 'Paper tear', 'A torn paper sheet slides through', 1.2, { kind: 'paperTear' }],
  ['lineWipe', 'transition', 'transitions', 'Line wipe', 'Diagonal colour bars sweep', 1, { kind: 'lineWipe' }],
  ['textWipe', 'transition', 'transitions', 'Text wipe', 'Wipe that carries a word', 1.2, { text: 'MEANWHILE' }],
  // ---- audio
  ['waveformBars', 'audioViz', 'audio', 'Audio waveform', 'Voice-like bars pulsing', 5, { kind: 'bars' }],
  ['soundwaveLine', 'audioViz', 'audio', 'Soundwave visualisation', 'A flowing wave line', 5, { kind: 'line' }],
  ['circularSpectrum', 'audioViz', 'audio', 'Voice-reactive circle', 'Radial frequency bars', 5, { kind: 'circle' }],
  ['beatPulse', 'audioViz', 'audio', 'Beat pulse', 'A disc pulsing to a BPM', 5, { kind: 'beat' }],
  ['narrationProgress', 'audioViz', 'audio', 'Narration progress line', 'A glowing line fills as the story plays', 10, { kind: 'progress' }],
  ['speakerIndicator', 'audioViz', 'audio', 'Speaker indicator', 'Name tag with a talking glow', 5, { kind: 'speaker' }],
];

export const EFFECTS_LIB: Record<string, FxDef> = Object.fromEntries(
  ROWS.map(([id, base, category, label, description, duration, defaults]) => [id, { id, base, category, label, description, duration, defaults: defaults ?? {} }]),
);

/** Fields shown in the Inspector for an effect id. */
export function fieldsFor(id: string): FieldDef[] {
  const fx = EFFECTS_LIB[id];
  return fx ? [...BASE_FIELDS[fx.base], ...COMMON_FIELDS] : COMMON_FIELDS;
}
