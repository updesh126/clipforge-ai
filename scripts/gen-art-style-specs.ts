/**
 * Writes src/artstyles/<id>.json — one detailed spec per art style.
 *
 * Rendering values (fonts, title colours, banner colours, picture filters, vector-theme numbers) are read from the
 * code so the JSON never drifts from what is drawn; the descriptive art direction lives here.
 *
 *   npx tsx scripts/gen-art-style-specs.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { ART_STYLES, ART_STYLE_IDS, styleLook, type ArtStyleId } from '../src/remotion/artStyles.tsx';
import { THEMES, isTheme } from '../src/vector/theme.ts';
import { ART_STYLE_LABELS } from '../src/editor/catalog.ts';
import { EFFECTS_LIB } from '../src/motion/catalog.ts';
import presets from './data/art-style-presets.json' with { type: 'json' };

type Preset = (typeof presets.styles)[keyof typeof presets.styles];
const PRESETS = presets.styles as Record<string, Preset>;

/** Image-generation block for a spec: the supplied art direction plus the prompt modifiers. */
const generation = (p: Preset) => ({
  sourceId: p.sourceId,
  category: p.category,
  description: p.description,
  visualIdentity: p.visual_identity,
  colourPalette: p.color_palette,
  linework: p.linework,
  textures: p.textures,
  characters: p.characters,
  backgrounds: p.backgrounds,
  lighting: p.lighting,
  composition: p.composition,
  bestFor: p.best_for,
  instructions: p.generation_instructions,
  promptModifier: p.prompt_modifier,
  negativePrompt: p.negative_prompt,
  negativeModifier: p.negative_modifier,
  sdHint: (p as { sd_hint?: string }).sd_hint ?? null,
  sdNegative: (p as { sd_negative?: string }).sd_negative ?? null,
});

const CAMERA = ['zoomPunch', 'slowZoom', 'shake', 'flash', 'fadeIn', 'fadeOut', 'pushIn', 'pullOut', 'panLeft', 'panRight', 'tiltUp', 'whipPan', 'irisWipe'];

type Swatch = [hex: string, name: string, role: string];

interface Direction {
  family: 'vector' | 'indianFolk' | 'worldHeritage' | 'graphic';
  origin: string;
  history: string;
  look: string;
  bestFor: string[];
  avoidFor: string[];
  mood: string[];
  palette: Swatch[];
  line: { weight: string; colour: string; quality: string };
  fill: string;
  shading: string;
  texture: string;
  characters: { proportions: string; faces: string; poses: string; costume: string };
  environment: { motifs: string[]; settings: string[]; sky: string; ground: string };
  border: string;
  composition: { focalPoint: string; framing: string; negativeSpace: string; depth: string };
  motion: {
    feel: string;
    pace: 'slow' | 'medium' | 'fast';
    textReveals: string[];
    camera: string[];
    transitions: string[];
    atmosphere: string[];
    spriteMotion: string[];
  };
  prompt: { keywords: string[]; negative: string[] };
  dos: string[];
  donts: string[];
}

const D: Record<ArtStyleId, Direction> = {
  storybook: {
    family: 'vector',
    origin: 'ClipForge procedural vector engine',
    history: "Inspired by gouache-painted children's picture books: soft colour, rounded friendly shapes and visible paper.",
    look: 'Procedurally drawn characters and places with soft gouache colours, gentle brown outlines that follow each fill, round faces with rosy cheeks and a warm paper grain over everything.',
    bestFor: ["Children's stories", 'Fables and moral stories', 'Bedtime tales', 'Gentle explainers for young viewers'],
    avoidFor: ['Hard news', 'Finance and data-heavy pieces', 'Horror or very dark themes'],
    mood: ['warm', 'gentle', 'cosy', 'innocent', 'hopeful'],
    palette: [
      ['#F3E3C3', 'Cream paper', 'background / sky base'],
      ['#E07A5F', 'Terracotta', 'accent, banner border, warm props'],
      ['#81B29A', 'Sage green', 'grass, trees, calm fills'],
      ['#3D405B', 'Slate', 'deep shadows, night scenes'],
      ['#F2CC8F', 'Honey', 'sunlight, highlights, faces'],
    ],
    line: { weight: 'Thin (0.55 × unit)', colour: 'Auto — a darker shade of each fill, never pure black', quality: 'Slight hand wobble, smooth rounded curves' },
    fill: 'Flat gouache fills, slightly desaturated and pulled towards cream',
    shading: 'Soft gradient shading on the shadow side',
    texture: 'Paper grain over the whole frame',
    characters: { proportions: 'Large heads (≈1.14×), short bodies, rounded limbs', faces: 'Storybook eyes with a highlight, rosy blush, small smile', poses: 'Gentle, readable poses: wave, point, walk, sit, hug', costume: 'Simple clothes with one or two colours, no logos' },
    environment: { motifs: ['rounded trees', 'cottages', 'winding paths', 'clouds', 'flowers'], settings: ['village', 'forest', 'garden', 'bedroom', 'riverside'], sky: 'Pale cream-blue gradient with soft clouds', ground: 'Rolling sage hills' },
    border: 'Soft rounded frame in the banner border colour',
    composition: { focalPoint: 'Character in the lower-middle third, title at the top', framing: 'Medium-wide shots so faces and setting are both visible', negativeSpace: 'Generous sky space for the title', depth: 'Three parallax layers: sky, hills, foreground props' },
    motion: { feel: 'Soft and bouncy, nothing sudden', pace: 'slow', textReveals: ['textFade', 'wordReveal', 'textOnPaper'], camera: ['slowZoom', 'pushIn', 'panRight'], transitions: ['dipToColour', 'irisTransition', 'fadeIn'], atmosphere: ['fireflyGlow', 'twinklingStars', 'dustParticles'], spriteMotion: ['bob', 'breathe', 'walkIn', 'sway'] },
    prompt: { keywords: ["children's picture book", 'gouache', 'soft outlines', 'rosy cheeks', 'paper grain', 'warm pastel'], negative: ['photorealistic', 'harsh black outlines', 'neon', 'gore'] },
    dos: ['Keep the same cast in every scene', 'Use warm light and rounded shapes', 'Give titles a cream glow so they read over busy art'],
    donts: ['Pure black outlines', 'Fast whip pans or glitch effects', 'Saturated neon colours'],
  },
  cartoon: {
    family: 'vector',
    origin: 'ClipForge procedural vector engine',
    history: 'Modern TV-cartoon look: bold ink outlines, cel shading and exaggerated expressions.',
    look: 'Thick near-black outlines, saturated colour, two-tone cel shading and big expressive eyes — characters act out each scene.',
    bestFor: ['Kids content', 'Comedy and sketches', 'Energetic explainers', 'Social shorts that need punch'],
    avoidFor: ['Sombre or sensitive topics', 'Luxury and heritage brands'],
    mood: ['playful', 'loud', 'energetic', 'funny'],
    palette: [
      ['#FFE14D', 'Sunny yellow', 'title fill, banners, highlights'],
      ['#FF6B6B', 'Coral red', 'accents, props, emphasis'],
      ['#4ECDC4', 'Aqua', 'sky, cool fills'],
      ['#1D1B1F', 'Ink', 'outlines, title stroke'],
      ['#A06CD5', 'Grape', 'secondary accent, shadows'],
    ],
    line: { weight: 'Very thick (1.15 × unit)', colour: '#1D1B1F ink', quality: 'Clean, confident, no wobble' },
    fill: 'Saturated flat fills, pushed slightly brighter',
    shading: 'Cel shading — one hard-edged shadow tone',
    texture: 'None — clean digital',
    characters: { proportions: 'Very large heads (≈1.25×), squash-and-stretch bodies', faces: 'Big cartoon eyes with large pupils, open expressive mouths, blush', poses: 'Exaggerated: jump, shock, cheer, point, facepalm', costume: 'Bold single colours with ink outlines' },
    environment: { motifs: ['puffy clouds', 'bold sun', 'simple houses', 'speech bubbles', 'impact stars'], settings: ['city street', 'school', 'park', 'kitchen', 'stage'], sky: 'Bright aqua with puffy clouds', ground: 'Flat grass or pavement band' },
    border: 'Thick ink rounded rectangle',
    composition: { focalPoint: 'Character face, big and central', framing: 'Close-ups for reactions, wide for action', negativeSpace: 'Top band for an outlined title', depth: 'Two to three layers, strong foreground props' },
    motion: { feel: 'Snappy, springy, overshooting', pace: 'fast', textReveals: ['textPop', 'kineticTypography', 'oversizedHeadline'], camera: ['zoomPunch', 'shake', 'whipPan'], transitions: ['irisTransition', 'wipeTransition', 'splitTransition'], atmosphere: ['confetti', 'sparks', 'glowPulse'], spriteMotion: ['pop', 'bob', 'walkAcross', 'slideUp'] },
    prompt: { keywords: ['cartoon', 'thick black outlines', 'cel shading', 'saturated colours', 'big expressive eyes'], negative: ['photorealistic', 'muted palette', 'watercolour'] },
    dos: ['Punch in on reactions', 'Outline every title in ink', 'Use squash-and-stretch entrances'],
    donts: ['Thin or grey outlines', 'Slow, solemn pacing', 'Soft gradients'],
  },
  flatVector: {
    family: 'vector',
    origin: 'ClipForge procedural vector engine',
    history: 'The modern corporate explainer look popularised by product and edtech videos.',
    look: 'Clean geometric shapes, no outlines, bold flat colour and simple dot eyes — the modern explainer look.',
    bestFor: ['Business and startups', 'Tech and how-it-works', 'Education', 'Product onboarding'],
    avoidFor: ['Folk or heritage stories', 'Emotional drama'],
    mood: ['clear', 'modern', 'confident', 'neutral'],
    palette: [
      ['#264653', 'Deep teal', 'background, banner'],
      ['#2A9D8F', 'Teal', 'primary fills'],
      ['#E9C46A', 'Saffron', 'accent, banner border'],
      ['#F4A261', 'Sandy orange', 'secondary accent'],
      ['#E76F51', 'Burnt orange', 'call-outs, warnings'],
    ],
    line: { weight: 'None', colour: 'n/a', quality: 'Shapes are defined by colour alone' },
    fill: 'Flat, slightly boosted saturation',
    shading: 'None',
    texture: 'None',
    characters: { proportions: 'Natural head size (1.0×), geometric limbs', faces: 'Dot eyes, minimal features', poses: 'Presenting, pointing, typing, walking', costume: 'Solid blocks of colour' },
    environment: { motifs: ['geometric trees', 'office desks', 'screens', 'charts', 'icons'], settings: ['office', 'city skyline', 'lab', 'classroom'], sky: 'Solid or two-stop gradient', ground: 'Flat colour band' },
    border: 'Thin saffron line, sharp corners',
    composition: { focalPoint: 'Subject on a rule-of-thirds line with data or icons opposite', framing: 'Wide and tidy, lots of alignment', negativeSpace: 'Large clean areas for text and charts', depth: 'Mostly flat; light parallax only' },
    motion: { feel: 'Precise, eased, purposeful', pace: 'medium', textReveals: ['wordReveal', 'textMaskReveal', 'trackingExpand'], camera: ['pushIn', 'panLeft', 'panRight'], transitions: ['wipeTransition', 'gridWipe', 'lineWipe'], atmosphere: ['gradientMove', 'patternBackground'], spriteMotion: ['slideUp', 'pop', 'walkIn'] },
    prompt: { keywords: ['flat vector illustration', 'geometric', 'no outlines', 'corporate explainer', 'clean'], negative: ['texture', 'outlines', 'hand-drawn', 'photorealistic'] },
    dos: ['Pair with charts and counters', 'Keep alignment strict', 'Use the saffron accent for one key thing per scene'],
    donts: ['Paper grain or wobble', 'More than two accent colours at once'],
  },
  handDrawn: {
    family: 'vector',
    origin: 'ClipForge procedural vector engine',
    history: 'Sketchbook and journal illustration: ink pen over loose watercolour.',
    look: 'Wobbly ink lines with a second, looser pencil pass over light watercolour fills on off-white paper.',
    bestFor: ['Personal stories', 'Journals and travel diaries', 'Gentle documentaries', 'Reflective essays'],
    avoidFor: ['High-energy hype content', 'Hard data presentations'],
    mood: ['personal', 'thoughtful', 'honest', 'quiet'],
    palette: [
      ['#2A2622', 'Ink', 'outlines, title text'],
      ['#FBF7EF', 'Sketchbook paper', 'background'],
      ['#A3C4BC', 'Wash green', 'foliage, calm areas'],
      ['#E8B4A0', 'Wash pink', 'skin, warm accents'],
      ['#BFD7EA', 'Wash blue', 'sky, water'],
    ],
    line: { weight: 'Medium (0.7 × unit)', colour: '#2A2622 ink', quality: 'Strong wobble (0.55) plus a second sketchy pencil line' },
    fill: 'Light watercolour, desaturated and lifted towards white',
    shading: 'None — the wash itself is uneven',
    texture: 'Paper grain',
    characters: { proportions: 'Near-natural (≈1.05×)', faces: 'Dot eyes, simple line mouth', poses: 'Everyday: walking, writing, looking, sitting', costume: 'Loosely washed colour, often not filling the lines' },
    environment: { motifs: ['scribbled trees', 'notebook doodles', 'arrows', 'cups of tea', 'street corners'], settings: ['café', 'street', 'home', 'park', 'train'], sky: 'Bare paper with a faint blue wash', ground: 'A single sketched line' },
    border: 'Hand-inked rectangle that does not quite close',
    composition: { focalPoint: 'One sketched subject with notes around it', framing: 'Vignetted — art fades to paper at the edges', negativeSpace: 'Lots of bare paper', depth: 'Shallow; mostly flat page' },
    motion: { feel: 'Drawn-on, unhurried', pace: 'slow', textReveals: ['handwrittenNote', 'typewriter', 'textFade'], camera: ['slowZoom', 'panRight', 'pushIn'], transitions: ['paperTearTransition', 'dipToColour', 'fadeIn'], atmosphere: ['filmGrain', 'dustParticles'], spriteMotion: ['breathe', 'sway', 'walkIn'] },
    prompt: { keywords: ['ink and watercolour', 'sketchbook', 'wobbly lines', 'pencil', 'loose wash'], negative: ['vector', 'glossy', 'neon', 'heavy shading'] },
    dos: ['Let colour spill past the lines', 'Use handwriting for notes', 'Keep the paper visible'],
    donts: ['Perfect geometric shapes', 'Glitch or VHS effects'],
  },
  madhubani: {
    family: 'indianFolk',
    origin: 'Mithila region, Bihar (India) and Nepal',
    history: 'Painted for centuries by women of Mithila on walls and floors for weddings and festivals; later on paper and cloth. Recognised with a GI tag.',
    look: 'Bold double outlines, every shape packed with fine hatching, no empty space; fish, sun, peacock and lotus motifs in natural pigment colours.',
    bestFor: ['Indian culture and festivals', 'Folk tales', 'Rural life and weddings', 'Heritage and craft brands'],
    avoidFor: ['Tech and corporate explainers', 'Data-heavy content'],
    mood: ['festive', 'rich', 'auspicious', 'traditional'],
    palette: [
      ['#C1272D', 'Sindoor red', 'border, accents, main fills'],
      ['#F4B400', 'Turmeric', 'sun, highlights'],
      ['#2E7D32', 'Leaf green', 'foliage, fish'],
      ['#1F4E9E', 'Indigo', 'water, secondary fills'],
      ['#F6E7C1', 'Handmade paper', 'background, banner'],
      ['#1A1A1A', 'Lamp black', 'outlines, hatching, title'],
    ],
    line: { weight: 'Bold double lines', colour: 'Lamp black', quality: 'Steady, deliberate; inner line parallel to the outer' },
    fill: 'Fine parallel hatching, cross-hatching and dots inside every shape',
    shading: 'None — pattern replaces shading',
    texture: 'Handmade paper',
    characters: { proportions: 'Stylised, large almond eyes in profile, long noses', faces: 'Profile view with one large fish-shaped eye', poses: 'Formal, frontal or profile; ceremonial gestures', costume: 'Patterned saris and dhotis filled with hatching' },
    environment: { motifs: ['fish pairs', 'sun with a face', 'peacock', 'lotus', 'tree of life', 'bamboo'], settings: ['wedding courtyard', 'pond', 'village', 'temple'], sky: 'Not drawn — paper filled with motifs', ground: 'Not drawn — figures float in patterned space' },
    border: 'Double-line border filled with repeating geometric or floral pattern, drawn on progressively',
    composition: { focalPoint: 'Central motif or couple, symmetrical', framing: 'Full frame bordered on all four sides', negativeSpace: 'Almost none (horror vacui)', depth: 'Flat — no perspective' },
    motion: { feel: 'Lines drawing on, gentle swimming and swaying', pace: 'medium', textReveals: ['wordReveal', 'trackingExpand', 'chapterCard'], camera: ['slowZoom', 'pushIn'], transitions: ['wipeTransition', 'irisTransition', 'radialWipe'], atmosphere: ['dustParticles', 'glowPulse'], spriteMotion: ['sway', 'float', 'bob'] },
    prompt: { keywords: ['Madhubani painting', 'Mithila art', 'double outlines', 'fine hatching', 'fish motif', 'natural pigments'], negative: ['3D', 'gradients', 'photorealistic', 'empty background'] },
    dos: ['Fill negative space with motifs', 'Draw the border on first', 'Use uppercase serif titles'],
    donts: ['Gradients or soft shading', 'Perspective or vanishing points', 'Neon colours'],
  },
  inkWash: {
    family: 'worldHeritage',
    origin: 'China and Japan (shuǐmò / sumi-e)',
    history: 'Monochrome ink painting developed in Tang-dynasty China and carried to Japan by Zen monks; prizes restraint and the empty space.',
    look: 'Grey brush ink bleeding into rice paper, layered misty mountains, a few confident strokes and a small red seal.',
    bestFor: ['Nature and landscapes', 'Calm reflection', 'Philosophy and poetry', 'Meditation and wellness'],
    avoidFor: ['Loud promotions', 'Children’s comedy', 'Busy data'],
    mood: ['calm', 'contemplative', 'misty', 'timeless'],
    palette: [
      ['#141414', 'Sumi black', 'strongest strokes, title'],
      ['#5E5E5A', 'Mid ink', 'near mountains'],
      ['#9A9A96', 'Pale ink', 'far mountains, mist'],
      ['#EFEAE0', 'Rice paper', 'background'],
      ['#B3261E', 'Cinnabar seal', 'the single colour accent'],
    ],
    line: { weight: 'Varies with brush pressure', colour: 'Ink black to pale grey', quality: 'Calligraphic, tapered, one stroke each' },
    fill: 'Diluted ink washes with soft bleeding edges',
    shading: 'Tonal — lighter as things recede (atmospheric perspective)',
    texture: 'Rice-paper fibre',
    characters: { proportions: 'Tiny figures dwarfed by landscape', faces: 'Barely indicated', poses: 'Fishing, walking, sitting in contemplation', costume: 'Robes in a few strokes' },
    environment: { motifs: ['misty peaks', 'pine', 'bamboo', 'plum blossom', 'boat', 'crane'], settings: ['mountain valley', 'river', 'bamboo grove', 'temple'], sky: 'Empty paper', ground: 'Implied by mist bands' },
    border: 'Hairline grey frame, very quiet',
    composition: { focalPoint: 'Off-centre, often a small figure or boat', framing: 'Vertical scroll-like, asymmetric', negativeSpace: 'Large, deliberate empty paper (ma)', depth: 'Layered mist planes, far = paler' },
    motion: { feel: 'Breathing, slow drift of mist', pace: 'slow', textReveals: ['textBlurReveal', 'textFade', 'lineReveal'], camera: ['slowZoom', 'tiltUp', 'panLeft'], transitions: ['dipToColour', 'fadeIn', 'fadeOut'], atmosphere: ['fogDrift', 'vignette', 'dustParticles'], spriteMotion: ['float', 'breathe', 'sway'] },
    prompt: { keywords: ['sumi-e', 'Chinese ink wash', 'misty mountains', 'rice paper', 'red seal', 'minimal'], negative: ['colour', 'outlines', 'busy', 'digital gradient'] },
    dos: ['Leave at least a third of the frame empty', 'Use one red seal per frame', 'Fade far layers to near-paper'],
    donts: ['More than one accent colour', 'Hard cuts or glitch effects', 'Uppercase titles'],
  },
  shadowPuppet: {
    family: 'worldHeritage',
    origin: 'Tholu Bommalata (Andhra Pradesh, India) and Wayang kulit (Java, Indonesia)',
    history: 'Leather puppets perforated with patterns, held on sticks behind a cloth screen lit by an oil lamp, telling the epics through the night.',
    look: 'Perforated black puppets on sticks against a warm, flickering lamp-lit screen with a glowing orange edge.',
    bestFor: ['Myths and legends', 'Epics (Ramayana, Mahabharata)', 'History', 'Dramatic storytelling'],
    avoidFor: ['Bright cheerful kids content', 'Product demos'],
    mood: ['dramatic', 'mysterious', 'ancient', 'theatrical'],
    palette: [
      ['#1B0E05', 'Puppet black', 'silhouettes, title'],
      ['#5A230A', 'Burnt umber', 'screen edges, vignette'],
      ['#FFB347', 'Lamp orange', 'screen glow, banner border'],
      ['#FFE2A8', 'Lamp core', 'screen centre'],
    ],
    line: { weight: 'None — silhouettes', colour: 'n/a', quality: 'Crisp edges with lace-like perforations' },
    fill: 'Solid near-black with punched-out patterns',
    shading: 'Back-light only: hot centre, dark edges',
    texture: 'Cloth screen with a lamp flicker',
    characters: { proportions: 'Elongated, jointed limbs, profile heads with crowns', faces: 'Profile, perforated eye', poses: 'Theatrical: raised arm, bow, battle stance', costume: 'Ornate crowns and jewellery shown as cut-outs' },
    environment: { motifs: ['palace arches', 'trees of life', 'chariots', 'mountains', 'weapons'], settings: ['royal court', 'forest', 'battlefield'], sky: 'The glowing screen itself', ground: 'Dark lower edge of the screen' },
    border: 'Dark wooden screen frame, glowing orange inner edge',
    composition: { focalPoint: 'Puppets in profile facing each other', framing: 'Stage-like, title at the top', negativeSpace: 'Glowing screen around the silhouettes', depth: 'Flat, except puppets closer to the cloth are sharper' },
    motion: { feel: 'Jointed, slightly jerky puppetry with lamp flicker', pace: 'medium', textReveals: ['trackingExpand', 'textFade', 'chapterCard'], camera: ['slowZoom', 'shake', 'pushIn'], transitions: ['dipToColour', 'irisTransition', 'shutterTransition'], atmosphere: ['embers', 'glowPulse', 'vignette', 'lightLeak'], spriteMotion: ['sway', 'walkAcross', 'bob'] },
    prompt: { keywords: ['shadow puppet theatre', 'wayang kulit', 'Tholu Bommalata', 'silhouette', 'perforated leather', 'oil-lamp glow'], negative: ['colourful characters', 'faces in detail', 'daylight'] },
    dos: ['Keep characters as silhouettes', 'Add a subtle lamp flicker', 'Place titles at the top'],
    donts: ['Coloured characters', 'Cool or blue light', 'Bright white backgrounds'],
  },
  paperCutout: {
    family: 'graphic',
    origin: 'Paper craft and diorama illustration',
    history: 'Layered cut paper, from Victorian dioramas to modern stop-motion and papercraft explainers.',
    look: 'Layered pastel paper hills, sun and clouds with soft drop shadows between layers and white cut edges.',
    bestFor: ['Kids and education', 'Friendly explainers', 'Product stories', 'Seasonal greetings'],
    avoidFor: ['Gritty documentaries', 'Investigations'],
    mood: ['friendly', 'crafty', 'light', 'tactile'],
    palette: [
      ['#FFADAD', 'Blush paper', 'hills, accents'],
      ['#FFD6A5', 'Peach paper', 'sun, warm layers'],
      ['#CAFFBF', 'Mint paper', 'grass'],
      ['#A0C4FF', 'Sky paper', 'sky'],
      ['#6D597A', 'Plum card', 'deep layers, text'],
      ['#FF6B6B', 'Coral', 'banner border'],
    ],
    line: { weight: 'None, or a white cut edge', colour: 'White', quality: 'Cut-scissor edges' },
    fill: 'Flat pastel card',
    shading: 'Drop shadows between stacked layers',
    texture: 'Light card fibre',
    characters: { proportions: 'Chunky, simple cut shapes', faces: 'Dot eyes, simple smile', poses: 'Pivot at paper joints', costume: 'Separate paper pieces' },
    environment: { motifs: ['layered hills', 'paper sun', 'clouds on strings', 'trees', 'houses'], settings: ['countryside', 'town', 'under the sea', 'space'], sky: 'Flat pastel card', ground: 'Stacked rolling hills' },
    border: 'Torn paper edge in coral',
    composition: { focalPoint: 'Centre stage like a diorama', framing: 'Front-on, theatre-box', negativeSpace: 'Sky area for the title', depth: 'Many stacked layers — strong parallax' },
    motion: { feel: 'Pop-up and slide, like a pop-up book', pace: 'medium', textReveals: ['textPop', 'paperTitle', 'textOnPaper'], camera: ['pushIn', 'panRight', 'tiltUp'], transitions: ['paperTearTransition', 'wipeTransition', 'blindsTransition'], atmosphere: ['confetti', 'snowFx', 'lightSweep'], spriteMotion: ['pop', 'slideUp', 'bob', 'float'] },
    prompt: { keywords: ['paper cutout', 'layered paper', 'diorama', 'pastel card', 'drop shadows'], negative: ['outlines', 'photorealistic', 'dark'] },
    dos: ['Use depth so camera moves create parallax', 'Give sprites a white cut edge', 'Keep shadows soft and short'],
    donts: ['Black outlines', 'Dark, gritty colour'],
  },
  collage: {
    family: 'graphic',
    origin: 'Editorial mixed-media collage (modern documentary explainers)',
    history: 'Cut-and-paste photo collage from 20th-century magazines and protest posters, revived by online video explainers that layer archive photos, paper and handwritten notes.',
    look: 'Black-and-white photo cut-outs with torn white edges on grey textured paper, halftone dots, one bold yellow accent, heavy condensed headlines on torn paper, handwritten labels with arrows and sticker chips.',
    bestFor: ['Documentaries', 'News and social-issue explainers', 'Then/now and before/after stories', 'Economy and tech explainers'],
    avoidFor: ['Kids fairy tales', 'Calm nature poetry'],
    mood: ['smart', 'journalistic', 'urgent', 'hand-made'],
    palette: [
      ['#111111', 'Ink black', 'headlines, chips, photo shadows'],
      ['#6E6E6E', 'Concrete grey', 'photo mid-tones, skyline'],
      ['#D9D9D6', 'Grey paper', 'background'],
      ['#F7F6F2', 'Off-white paper', 'torn strips, title boxes'],
      ['#FFD400', 'Signal yellow', 'the one accent: circles, highlighter, chips'],
    ],
    line: { weight: 'None; torn white paper borders instead', colour: 'White', quality: 'Torn and scissor-cut edges' },
    fill: 'Monochrome photography, flat yellow shapes',
    shading: 'Soft paper drop shadows between layers',
    texture: 'Paper grain, halftone dots, print grit',
    characters: { proportions: 'Realistic (photo cut-outs)', faces: 'Real, unstylised', poses: 'Natural documentary poses', costume: 'Everyday real clothes' },
    environment: { motifs: ['torn paper strips', 'halftone dot fields', 'yellow sun circle', 'skyline cut-outs', 'handwritten arrows'], settings: ['city streets', 'offices', 'archives', 'markets', 'maps'], sky: 'Grey paper with a yellow circle', ground: 'Photo cut-out street or floor' },
    border: 'Torn off-white paper edge with yellow tape corners',
    composition: { focalPoint: 'One photo subject in the middle, yellow shape behind it', framing: 'Layered cut-outs, slightly tilted', negativeSpace: 'Grey paper left or top for the headline', depth: 'Two or three paper layers — gentle parallax' },
    motion: { feel: 'Slap-on and slide, like pieces pasted on a board', pace: 'medium', textReveals: ['paperTitle', 'textOnPaper', 'textPop'], camera: ['pushIn', 'panRight', 'pullOut'], transitions: ['paperTearTransition', 'wipeTransition'], atmosphere: ['filmGrain', 'dustParticles'], spriteMotion: ['slideUp', 'pop'] },
    prompt: { keywords: ['photo collage', 'black and white cut-outs', 'torn paper', 'halftone', 'yellow accent'], negative: ['full colour', 'cartoon', 'text'] },
    dos: ['Keep photos black and white and let yellow be the only colour', 'Give every cut-out a torn white edge', 'Use handwritten labels and arrows for then/now'],
    donts: ['More than one accent colour', 'Painted or cartoon textures', 'Any brand names or logos'],
  },
  stainedGlass: {
    family: 'worldHeritage',
    origin: 'Gothic cathedral windows (Europe, 12th century onwards)',
    history: 'Coloured glass held by lead came, telling stories to people in light; also used in Indian Art Deco and Parsi architecture.',
    look: 'Jewel-tone glass cells in dark leading, glowing as if lit from behind.',
    bestFor: ['Heritage and architecture', 'Spiritual and celebratory moments', 'Grand openings', 'Awards'],
    avoidFor: ['Casual comedy', 'Data dashboards'],
    mood: ['grand', 'reverent', 'luminous', 'celebratory'],
    palette: [
      ['#1E5AA8', 'Cobalt glass', 'sky, large cells'],
      ['#C0392B', 'Ruby glass', 'accents'],
      ['#E0B53A', 'Amber glass', 'light, banner border'],
      ['#2E8B57', 'Emerald glass', 'foliage'],
      ['#6C3483', 'Amethyst glass', 'secondary'],
      ['#111111', 'Lead came', 'outlines'],
    ],
    line: { weight: 'Thick', colour: 'Dark lead', quality: 'Even width, joins every cell' },
    fill: 'Saturated jewel tones with inner glow',
    shading: 'Radial glow inside each cell',
    texture: 'Slight glass mottling',
    characters: { proportions: 'Tall, iconic, frontal', faces: 'Simple features in a single cell', poses: 'Iconic, still, gesturing', costume: 'Robes split into glass panes' },
    environment: { motifs: ['rose window', 'arches', 'halos', 'vines', 'stars'], settings: ['cathedral', 'palace hall', 'garden'], sky: 'Cobalt cells', ground: 'Patterned base panel' },
    border: 'Leaded arch border with amber trim',
    composition: { focalPoint: 'Centre, symmetrical, often under an arch', framing: 'Window-shaped', negativeSpace: 'Filled with glass cells', depth: 'Flat' },
    motion: { feel: 'Light sweeping across, cells lighting up in turn', pace: 'slow', textReveals: ['trackingExpand', 'textFade', 'staggeredType'], camera: ['slowZoom', 'tiltUp'], transitions: ['gridWipe', 'radialWipe', 'dipToColour'], atmosphere: ['lightRays', 'lightSweep', 'glowPulse'], spriteMotion: ['breathe', 'float'] },
    prompt: { keywords: ['stained glass window', 'lead came', 'jewel tones', 'backlit', 'gothic'], negative: ['soft gradients without leading', 'photo'] },
    dos: ['Outline sprites in dark lead', 'Sweep light across the glass', 'Use uppercase serif titles with a dark stroke'],
    donts: ['Pastel colours', 'Fast cuts'],
  },
  anime: {
    family: 'graphic',
    origin: 'Japanese animation (anime)',
    history: 'TV and film animation from Japan, with signature speed lines, sky gradients and dramatic title slams.',
    look: 'Speed lines, sparkles, sky gradients and slam-in titles with heavy outlines.',
    bestFor: ['Youth and hype', 'Gaming', 'Launches and reveals', 'Sports highlights'],
    avoidFor: ['Sombre history', 'Traditional Indian folk stories'],
    mood: ['hype', 'dramatic', 'youthful', 'emotional'],
    palette: [
      ['#3A7BD5', 'Sky blue', 'sky gradient top'],
      ['#B06AB3', 'Dusk violet', 'sky gradient bottom'],
      ['#FF8FAB', 'Sakura pink', 'sparkles, accents'],
      ['#FFD166', 'Gold', 'highlights'],
      ['#FF3D7F', 'Hot pink', 'banner'],
      ['#1B1B3A', 'Night navy', 'title stroke'],
    ],
    line: { weight: 'Medium, tapered', colour: 'Dark navy', quality: 'Clean and sharp' },
    fill: 'Cel fills with bright highlights',
    shading: 'Hard cel shadows plus glow',
    texture: 'None',
    characters: { proportions: 'Slim bodies, large eyes', faces: 'Large glossy eyes, small nose and mouth', poses: 'Dynamic: dash, punch, look over shoulder', costume: 'Uniforms, jackets, flowing hair' },
    environment: { motifs: ['speed lines', 'sparkles', 'cherry blossom', 'clouds', 'city skyline'], settings: ['rooftop', 'school', 'city at dusk', 'stadium'], sky: 'Blue-to-violet gradient', ground: 'Often omitted for action frames' },
    border: 'Diagonal comic-panel frame',
    composition: { focalPoint: 'Centre burst of speed lines', framing: 'Tilted, dynamic angles', negativeSpace: 'Sky gradient', depth: 'Strong foreground/background split' },
    motion: { feel: 'Explosive impact frames then holds', pace: 'fast', textReveals: ['oversizedHeadline', 'kineticTypography', 'textPop'], camera: ['zoomPunch', 'shake', 'whipPan'], transitions: ['lineWipe', 'flash', 'shutterTransition'], atmosphere: ['sparks', 'lightRays', 'bokeh'], spriteMotion: ['pop', 'fly', 'slideUp'] },
    prompt: { keywords: ['anime', 'speed lines', 'sparkles', 'cel shading', 'sky gradient', 'dramatic'], negative: ['realistic', 'muted', 'western cartoon'] },
    dos: ['Slam titles in with a punch zoom', 'Use speed lines behind subjects', 'Flash on impacts'],
    donts: ['Slow fades everywhere', 'Paper textures'],
  },
  warli: {
    family: 'indianFolk',
    origin: 'Warli tribe, Palghar and Thane, Maharashtra (India)',
    history: 'Painted with rice paste on red-ochre mud walls for weddings and harvests; figures built from circles, triangles and lines. GI-tagged.',
    look: 'White stick figures made of two triangles on earth-red — dancing circles (tarpa dance), sun, moon, village and farming life.',
    bestFor: ['Community and togetherness', 'Farming and harvest', 'Sustainability', 'Rural India'],
    avoidFor: ['Tech products', 'Luxury'],
    mood: ['communal', 'rhythmic', 'earthy', 'simple'],
    palette: [
      ['#7A3B22', 'Red ochre', 'background, banner'],
      ['#A0522D', 'Mud brown', 'secondary ground'],
      ['#FFFFFF', 'Rice paste white', 'all figures, lines, title'],
    ],
    line: { weight: 'Thin to medium', colour: 'White', quality: 'Simple, slightly irregular brush' },
    fill: 'Solid white for figures; background left bare',
    shading: 'None',
    texture: 'Mud wall',
    characters: { proportions: 'Two triangles joined at the tip, circle head, line limbs', faces: 'None — the head is a dot or circle', poses: 'Dancing in a spiral, farming, carrying pots, hunting', costume: 'None' },
    environment: { motifs: ['tarpa dance circle', 'sun and moon', 'trees', 'huts', 'animals', 'birds'], settings: ['village', 'fields', 'forest'], sky: 'Bare ochre', ground: 'Bare ochre, sometimes a line' },
    border: 'White geometric triangles and zig-zags',
    composition: { focalPoint: 'A central spiral of dancers or the sun', framing: 'Scattered scenes across the wall', negativeSpace: 'Ochre between groups', depth: 'Flat' },
    motion: { feel: 'Rhythmic loops — dancing circles rotate, figures step', pace: 'medium', textReveals: ['wordReveal', 'trackingExpand', 'textFade'], camera: ['slowZoom', 'panRight'], transitions: ['radialWipe', 'irisTransition', 'wipeTransition'], atmosphere: ['dustParticles', 'vignette'], spriteMotion: ['bob', 'walkAcross', 'sway'] },
    prompt: { keywords: ['Warli painting', 'white stick figures', 'red ochre', 'tribal art', 'tarpa dance'], negative: ['colour', 'shading', 'realistic anatomy'] },
    dos: ['Keep everything white on ochre', 'Turn library sprites into white silhouettes', 'Use loops for dancing'],
    donts: ['Any third colour', 'Facial detail', 'Gradients'],
  },
  blueprint: {
    family: 'graphic',
    origin: 'Engineering and architectural drawings (cyanotype prints)',
    history: 'The cyanotype process of the 1840s made white-on-blue copies of technical drawings standard for a century.',
    look: 'White line art drawn on a blue grid, with dimension lines, callouts and a title block.',
    bestFor: ['Tech and engineering', 'Product breakdowns', 'How-it-works', 'Architecture'],
    avoidFor: ['Emotional storytelling', 'Folk tales'],
    mood: ['technical', 'precise', 'clever', 'analytical'],
    palette: [
      ['#0B3D91', 'Blueprint blue', 'background, banner'],
      ['#5C8DD6', 'Grid blue', 'minor grid'],
      ['#9CC3FF', 'Pale blue', 'major grid, banner border'],
      ['#FFFFFF', 'Chalk white', 'linework, title'],
    ],
    line: { weight: 'Thin, uniform', colour: 'White', quality: 'Ruler-straight, drawn on stroke by stroke' },
    fill: 'None — line only',
    shading: 'None, or hatching for sections',
    texture: 'Fine grid',
    characters: { proportions: 'Mannequin or technical figure', faces: 'None', poses: 'Scale reference, standing', costume: 'n/a' },
    environment: { motifs: ['grid', 'dimension lines', 'callout circles', 'gears', 'title block', 'compass'], settings: ['drawing sheet', 'exploded view', 'floor plan'], sky: 'Grid', ground: 'Grid' },
    border: 'Double rule with corner marks and a title block',
    composition: { focalPoint: 'Object centred with callouts around it', framing: 'Drawing sheet with title block bottom-right', negativeSpace: 'Grid around the object', depth: 'Orthographic — no perspective' },
    motion: { feel: 'Lines drawing on, labels snapping in', pace: 'medium', textReveals: ['typewriter', 'textScramble', 'textWipeReveal'], camera: ['pushIn', 'panLeft', 'pullOut'], transitions: ['gridWipe', 'lineWipe', 'pixelDissolve'], atmosphere: ['patternBackground', 'lightSweep'], spriteMotion: ['slideUp', 'pop'] },
    prompt: { keywords: ['blueprint', 'technical drawing', 'white line on blue', 'grid', 'dimension lines', 'cyanotype'], negative: ['colour fills', 'organic textures', 'photo'] },
    dos: ['Use mono fonts for labels', 'Draw lines on progressively', 'Pair with diagrams and callouts'],
    donts: ['Warm colours', 'Painterly textures'],
  },
  ukiyoe: {
    family: 'worldHeritage',
    origin: 'Edo-period Japan (17th–19th century woodblock prints)',
    history: 'Mass-produced woodblock prints of landscapes, kabuki and daily life; Prussian blue arrived in the 1820s and defined the great wave prints.',
    look: 'Rolling Prussian-blue waves with claw-like foam, a red sun, flat colour areas, bold key lines and visible paper grain, with a cartouche for the title.',
    bestFor: ['Travel', 'Oceans and seasons', 'Japanese themes', 'Calm but bold storytelling'],
    avoidFor: ['Indian folk tales', 'Tech explainers'],
    mood: ['bold', 'poetic', 'seasonal', 'classic'],
    palette: [
      ['#1F2A44', 'Prussian blue', 'deep water, title'],
      ['#5C7FA6', 'Wave blue', 'mid water'],
      ['#C8452F', 'Vermilion sun', 'sun, seal'],
      ['#E0B07A', 'Ochre sky', 'sky band'],
      ['#F3E6CC', 'Washi paper', 'background, banner'],
      ['#B23A2B', 'Cartouche red', 'banner border'],
    ],
    line: { weight: 'Medium key line', colour: 'Dark grey-blue', quality: 'Carved — even with sharp ends' },
    fill: 'Flat colour blocks with bokashi (graded) bands',
    shading: 'Bokashi gradient in sky and water only',
    texture: 'Washi paper and woodgrain',
    characters: { proportions: 'Elongated, small heads', faces: 'Fine lines, narrow eyes', poses: 'Travelling, rowing, under umbrellas', costume: 'Patterned kimono' },
    environment: { motifs: ['great wave', 'Mount Fuji', 'red sun', 'pine', 'boats', 'cherry blossom'], settings: ['sea', 'mountain road', 'bridge', 'village'], sky: 'Ochre-to-cream bokashi band', ground: 'Sea or road' },
    border: 'Thin frame with a red title cartouche',
    composition: { focalPoint: 'A dramatic diagonal (wave or slope) with a small subject', framing: 'Landscape, high horizon', negativeSpace: 'Sky band', depth: 'Layered flat planes' },
    motion: { feel: 'Rolling waves, slow parallax', pace: 'slow', textReveals: ['textFade', 'lineReveal', 'wordReveal'], camera: ['panLeft', 'slowZoom', 'pushIn'], transitions: ['wipeTransition', 'dipToColour', 'blindsTransition'], atmosphere: ['snowFx', 'rainFx', 'filmGrain'], spriteMotion: ['bob', 'sway', 'float'] },
    prompt: { keywords: ['ukiyo-e', 'Japanese woodblock print', 'Prussian blue waves', 'red sun', 'washi paper', 'bokashi'], negative: ['3D', 'neon', 'photorealistic'] },
    dos: ['Use strong diagonals', 'Keep colour flat with graded skies', 'Put the title in a cartouche'],
    donts: ['Soft airbrushed shading', 'Modern neon accents'],
  },
  miniature: {
    family: 'indianFolk',
    origin: 'Mughal and Rajput court ateliers (India, 16th–19th century)',
    history: 'Small, jewel-like paintings for royal albums and manuscripts, made with mineral pigments and real gold, with elaborate floral borders.',
    look: 'Gold floral border, arched jharokha window, cypress trees, flat jewel colours and fine detail.',
    bestFor: ['History and royalty', 'Weddings', 'Luxury and heritage brands', 'Poetry and romance'],
    avoidFor: ['Casual comedy', 'Tech explainers'],
    mood: ['regal', 'refined', 'romantic', 'opulent'],
    palette: [
      ['#8E1B1B', 'Crimson', 'robes, accents'],
      ['#D4A537', 'Gold leaf', 'borders, vines, banner border'],
      ['#2E6B3A', 'Malachite green', 'gardens, cypress'],
      ['#1B3A6B', 'Lapis blue', 'sky, water'],
      ['#E9A75A', 'Saffron', 'warm highlights'],
      ['#5B1A18', 'Deep maroon', 'banner, frame'],
    ],
    line: { weight: 'Very fine', colour: 'Dark brown or gold', quality: 'Precise single-hair brush lines' },
    fill: 'Flat opaque mineral colours',
    shading: 'Minimal — slight modelling on faces and fabric',
    texture: 'Burnished paper',
    characters: { proportions: 'Elegant, profile faces, slender', faces: 'Profile with fine features, almond eye', poses: 'Seated on a throne, holding a flower, on horseback', costume: 'Jama, turban, jewellery with gold detail' },
    environment: { motifs: ['jharokha arch', 'cypress', 'flowering plants', 'peacock', 'fountains', 'carpets'], settings: ['palace terrace', 'Mughal garden (charbagh)', 'court', 'hunt'], sky: 'Lapis band with gold-edged clouds', ground: 'Patterned carpet or garden beds' },
    border: 'Gold floral vine border drawn on, inside a maroon frame',
    composition: { focalPoint: 'Royal figure framed in an arch', framing: 'Portrait panel with ornate border', negativeSpace: 'Small — detail everywhere', depth: 'Stacked planes, tilted-up ground' },
    motion: { feel: 'Stately and slow, gold shimmer', pace: 'slow', textReveals: ['trackingExpand', 'textFade', 'staggeredType'], camera: ['slowZoom', 'pushIn', 'tiltUp'], transitions: ['dipToColour', 'irisTransition', 'radialWipe'], atmosphere: ['lightSweep', 'glowPulse', 'dustParticles'], spriteMotion: ['breathe', 'float', 'sway'] },
    prompt: { keywords: ['Mughal miniature painting', 'Rajput miniature', 'gold floral border', 'jharokha', 'cypress', 'jewel colours'], negative: ['3D', 'loose brushwork', 'neon'] },
    dos: ['Frame the subject in an arch', 'Draw the gold border on first', 'Use a light gold sweep for shimmer'],
    donts: ['Fast whip pans', 'Pastel or neon colours'],
  },
};

const outDir = path.resolve('src/artstyles');
fs.mkdirSync(outDir, { recursive: true });
const known = new Set([...Object.keys(EFFECTS_LIB), ...CAMERA]);
const problems: string[] = [];

for (const id of ART_STYLE_IDS) {
  const d = D[id];
  if (!d) {
    problems.push(`${id}: no art direction written`);
    continue;
  }
  const s = ART_STYLES[id];
  for (const ref of [...d.motion.textReveals, ...d.motion.camera, ...d.motion.transitions, ...d.motion.atmosphere]) {
    if (!known.has(ref)) problems.push(`${id}: unknown effect id "${ref}"`);
  }
  const sprite = styleLook(id, true);
  const bg = styleLook(id, false);
  const vt = isTheme(id) ? THEMES[id] : null;
  const spec = {
    id,
    label: ART_STYLE_LABELS[id] ?? s.label,
    family: d.family,
    engine: vt ? 'vector-theme' : 'remotion-scene',
    summary: s.blurb,
    origin: d.origin,
    history: d.history,
    look: d.look,
    mood: d.mood,
    bestFor: d.bestFor,
    avoidFor: d.avoidFor,
    palette: d.palette.map(([hex, name, role]) => ({ hex, name, role })),
    line: d.line,
    fill: d.fill,
    shading: d.shading,
    texture: d.texture,
    characters: d.characters,
    environment: d.environment,
    border: d.border,
    composition: { ...d.composition, titlePosition: s.titlePos ?? 'center' },
    typography: {
      fontStack: s.font,
      titleColour: s.titleColor,
      titleStroke: s.titleStroke ?? null,
      titleShadow: s.titleShadow ?? null,
      uppercase: Boolean(s.upper),
      titleScale: s.titleScale ?? 1,
    },
    banner: { background: s.bannerBg, text: s.bannerText, border: s.bannerBorder },
    motion: d.motion,
    libraryPictureLook: { spriteFilter: sprite.filter ?? null, spriteBlend: sprite.mixBlendMode ?? null, backgroundFilter: bg.filter ?? null },
    vectorTheme: vt
      ? { outline: vt.outline, outlineColour: vt.outlineColor, jitter: vt.jitter, sketch: vt.sketch, tension: vt.tension, shading: vt.shading, texture: vt.texture, eyes: vt.eyes, headScale: vt.headScale, blush: vt.blush }
      : null,
    prompt: d.prompt,
    dos: d.dos,
    donts: d.donts,
    generation: PRESETS[id] ? generation(PRESETS[id]) : null,
    previews: { thumbnail: `/styles/${id}.jpg`, preview: `/styles/${id}-preview.jpg` },
  };
  fs.writeFileSync(path.join(outDir, `${id}.json`), JSON.stringify(spec, null, 2) + '\n');
}

for (const id of ART_STYLE_IDS) if (!PRESETS[id]) problems.push(`${id}: no image-generation preset in scripts/data/art-style-presets.json`);

// picker-only modes (not drawn styles) and the rules every style shares
for (const id of ['auto', 'mix']) {
  const p = PRESETS[id];
  fs.writeFileSync(path.join(outDir, `${id}.json`), JSON.stringify({ id, label: p.name, family: 'meta', engine: 'picker', generation: generation(p) }, null, 2) + '\n');
}
fs.writeFileSync(
  path.join(outDir, '_rules.json'),
  JSON.stringify({ styleSystem: presets.style_system, globalGenerationRules: presets.global_generation_rules, outputRules: presets.output_rules }, null, 2) + '\n',
);

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`Wrote ${ART_STYLE_IDS.length} art style specs to ${path.relative(process.cwd(), outDir)}`);
