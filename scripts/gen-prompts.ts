/**
 * Builds assets/prompts/ (README.md + one file per art style) — image-generation prompts for every art style and every asset recipe,
 * so you can make matching PNGs with any image tool and drop them into assets/library/.
 * Run:  npm run prompts
 */
import fs from 'node:fs';
import path from 'node:path';
import { RECIPES } from '../src/assetkit/catalog.ts';
import type { AnimalSpec, AssetSpec, BackgroundSpec, BirdSpec, BuildingSpec, FishSpec, ObjectSpec, PersonSpec, TreeSpec } from '../src/assetkit/types.ts';
import { CATEGORY_OF } from '../src/assetkit/types.ts';
import { buildNegativePrompt, styleGeneration } from '../src/artstyles/prompt.ts';

// ---------------------------------------------------------------- style prompts
const BASE_STYLES: Array<{ id: string; label: string; prompt: string; palette: string; avoid: string }> = [
  {
    id: 'flat',
    label: 'Flat colour (default)',
    prompt: 'clean flat vector illustration, simple geometric shapes, solid fills, thin dark outline, soft friendly proportions, modern explainer-video style',
    palette: 'natural colours, medium saturation',
    avoid: 'gradients, photorealism, 3D shading, texture noise',
  },
  {
    id: 'madhubani',
    label: 'Madhubani (Mithila folk art, Bihar)',
    prompt: 'Madhubani Mithila folk painting, bold double black outlines, every shape filled with fine line hatching, cross-hatching and small patterns, flat bright colours, large almond eyes in profile, decorative fish, peacock and floral motifs, hand-painted on handmade paper',
    palette: 'vermilion red #C1272D, turmeric yellow #F4B400, leaf green #2E7D32, indigo blue #1F4E9E, black outlines, cream paper #F6E7C1',
    avoid: 'gradients, shading, realistic anatomy, empty unpatterned areas',
  },
  {
    id: 'inkWash',
    label: 'Ink wash (sumi-e)',
    prompt: 'traditional East Asian ink wash painting, sumi-e brushwork, expressive single brush strokes, wet ink bleeding into rice paper, varying grey tones, lots of negative space, small red seal stamp',
    palette: 'black and grey ink only, warm rice paper #EFEAE0, one small vermilion seal #B3261E',
    avoid: 'bright colours, hard vector edges, outlines, heavy detail',
  },
  {
    id: 'shadowPuppet',
    label: 'Shadow puppet (Tholu Bommalata / wayang kulit)',
    prompt: 'traditional leather shadow puppet silhouette, solid dark silhouette with decorative perforated holes letting light through, jointed limbs, thin control rods, side profile, backlit by warm lamp',
    palette: 'near-black #1B0E05 silhouette, warm amber light #FFB347 showing through the holes',
    avoid: 'interior detail, facial features in colour, front-facing poses',
  },
  {
    id: 'paperCutout',
    label: 'Paper cutout',
    prompt: 'layered paper cut-out craft illustration, flat pastel paper layers with slightly rough cut edges, soft drop shadows between layers, subtle paper fibre texture, handmade diorama look',
    palette: 'pastels — coral #FFADAD, peach #FFD6A5, mint #CAFFBF, sky #9BF6FF, periwinkle #A0C4FF, plum #6D597A',
    avoid: 'outlines, glossy shading, photorealism',
  },
  {
    id: 'collage',
    label: 'Explainer collage',
    prompt: 'editorial mixed-media collage, black-and-white halftone photo cut-outs with torn white paper edges on grey textured paper, one bold flat yellow accent shape, soft paper shadows, documentary explainer look',
    palette: 'monochrome — ink black #111111, concrete grey #6E6E6E, grey paper #D9D9D6, off-white #F7F6F2, one signal yellow #FFD400',
    avoid: 'full colour, cartoon outlines, painted textures, text and logos',
  },
  {
    id: 'stainedGlass',
    label: 'Stained glass',
    prompt: 'stained glass window art, shapes broken into translucent jewel-tone glass pieces, thick dark lead lines between every piece, light glowing through the glass',
    palette: 'cobalt #1E5AA8, ruby #C0392B, amber #E0B53A, emerald #2E8B57, amethyst #6C3483, dark leading #151515',
    avoid: 'soft gradients without leading, thin outlines, realistic textures',
  },
  {
    id: 'anime',
    label: 'Anime / cel animation',
    prompt: 'Japanese anime cel-shaded illustration, crisp dark line art, flat cel shading with one shadow tone, bright saturated colours, expressive large eyes, dynamic clean shapes',
    palette: 'bright pinks, sky blues, sunny yellows, teal, with dark purple-brown line art',
    avoid: 'painterly blending, photorealism, muddy colours, copying any existing anime character',
  },
  {
    id: 'warli',
    label: 'Warli (Maharashtra tribal art)',
    prompt: 'Warli tribal painting, white rice-paste figures on earth-red mud wall, stick figures made of two triangles joined at the tips with a circle head, thin line limbs, simple geometric circles and triangles, rhythmic minimal composition',
    palette: 'white #FFFFFF figures only on terracotta / mud red #7A3B22',
    avoid: 'any colour other than white on red, shading, detailed faces, realistic proportions',
  },
  {
    id: 'blueprint',
    label: 'Blueprint / technical drawing',
    prompt: 'engineering blueprint technical drawing, thin white and pale blue line art only, construction lines, dimension arrows, centre lines, drafting precision, no fills',
    palette: 'white #FFFFFF and pale blue #9CC3FF lines on blueprint blue #0B3D91',
    avoid: 'filled shapes, colour, shading, hand-drawn wobble',
  },
  {
    id: 'ukiyoe',
    label: 'Ukiyo-e (Japanese woodblock print)',
    prompt: 'ukiyo-e Japanese woodblock print, flat areas of colour, strong confident outlines, stylised curling waves and clouds, visible paper grain and slight print misregistration, Edo-period composition',
    palette: 'Prussian blue #1F2A44 and #2F4E7A, soft blue #5C7FA6, vermilion #C8452F, ochre #E0B07A, aged paper #F3E6CC',
    avoid: 'gradients beyond simple bokashi fades, modern objects drawn realistically, copying specific famous prints',
  },
  {
    id: 'miniature',
    label: 'Miniature painting (Mughal / Rajput)',
    prompt: 'Indian miniature painting, Mughal and Rajput court style, fine detailed brushwork, flat perspective, figures in profile, rich jewel colours, gold leaf ornaments and borders, stylised cypress trees and flowering plants',
    palette: 'deep red #8E1B1B, gold #D4A537, emerald green #2E6B3A, lapis blue #1B3A6B, saffron #E9A75A',
    avoid: 'western perspective, harsh shadows, photorealism',
  },
];

/** Enrich each style with the art direction in src/artstyles (prompt modifier + negative list). */
const STYLES = BASE_STYLES.map((st) => {
  const specId = st.id === 'flat' ? 'flatVector' : st.id;
  const g = styleGeneration(specId);
  if (!g) return st;
  const modifier = g.promptModifier.replace(/^Render (as|in|using) /i, '').replace(/\.$/, '');
  return { ...st, prompt: `${st.prompt}, ${modifier}`, avoid: `${st.avoid}, ${buildNegativePrompt(specId)}` };
});

// ---------------------------------------------------------------- spec → English
const colour = (hex?: string): string => {
  if (!hex) return '';
  const m = hex.replace('#', '').match(/^([0-9a-f]{6})$/i);
  if (!m) return hex;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 510;
  if (max - min < 24) return l > 0.9 ? 'white' : l > 0.65 ? 'light grey' : l > 0.3 ? 'grey' : 'black';
  let h = 0;
  if (max === r) h = ((g - b) / (max - min)) * 60;
  else if (max === g) h = (2 + (b - r) / (max - min)) * 60;
  else h = (4 + (r - g) / (max - min)) * 60;
  if (h < 0) h += 360;
  const dark = l < 0.32 ? 'dark ' : l > 0.78 ? 'pale ' : '';
  const name =
    h < 15 ? 'red' : h < 35 ? 'orange' : h < 50 ? (l < 0.45 ? 'brown' : 'amber') : h < 70 ? 'yellow' : h < 160 ? 'green' : h < 200 ? 'teal' : h < 250 ? 'blue' : h < 290 ? 'purple' : h < 340 ? 'pink' : 'red';
  if (name === 'orange' && l < 0.4) return `${dark}brown`.trim();
  return `${dark}${name}`;
};

const OBJECTS: Record<string, string> = {
  boat: 'wooden river boat with a single sail',
  cloud: 'fluffy cloud',
  sun: 'shining sun with rays',
  moon: 'crescent moon',
  flower: 'lotus flower on a stem',
  rock: 'large boulder',
  pot: 'clay water pot (matka)',
  diya: 'clay oil lamp (diya) with a lit flame',
  car: 'small family car, side view',
  kite: 'diamond-shaped paper kite with a tail',
  book: 'open book',
  globe: 'globe of the Earth',
  tractor: 'farm tractor, side view',
  bicycle: 'bicycle, side view',
  star: 'five-pointed star',
  heart: 'heart shape',
  drop: 'water drop',
  leaf: 'single green leaf',
};

const PLACES: Record<string, string> = { himalaya: 'the Himalayas', 'river valley': 'a river valley', ocean: 'the ocean', city: 'a city', desert: 'a desert', farm: 'farmland', 'night sky': 'a village under the night sky', 'temple town': 'a temple town', sky: 'an open sky', 'sunset hills': 'hills at sunset', village: 'an Indian village', forest: 'a forest', glacier: 'a glacier' };

/** "a" / "an" before a phrase. */
const an = (phrase: string) => `${/^[aeiou]/i.test(phrase.trim()) ? 'an' : 'a'} ${phrase.trim()}`;

function describe(name: string, spec: AssetSpec): string {
  switch (spec.type) {
    case 'person': {
      const s = spec as PersonSpec;
      const who = s.child ? (s.dress === 'skirt' || s.dress === 'saree' ? 'young girl' : 'young child') : s.elderly ? `elderly ${s.dress === 'saree' ? 'woman' : 'man'}` : name;
      const parts = [an(who)];
      const outfit =
        s.dress === 'saree'
          ? `wearing ${an(colour(s.bottom))} saree with ${an(colour(s.top))} blouse`
          : s.dress === 'dhoti'
            ? `wearing ${an(colour(s.top))} kurta and ${colour(s.bottom)} dhoti`
            : s.dress === 'robe'
              ? `wearing a long ${colour(s.top)} robe`
              : s.dress === 'skirt'
                ? `wearing ${an(colour(s.top))} top and ${colour(s.bottom)} skirt`
                : `wearing ${an(colour(s.top))} shirt and ${colour(s.bottom)} trousers`;
      parts.push(outfit);
      if (s.headwear && s.headwear !== 'none') parts.push(an(`${colour(s.headwearColor) ? `${colour(s.headwearColor)} ` : ''}${s.headwear}`));
      if (s.hair && s.hair !== 'none' && (!s.headwear || s.headwear === 'none')) {
        const hc = colour(s.hairColor) || (s.elderly ? 'grey' : 'dark');
        parts.push(s.hair === 'bun' ? `${hc} hair in a bun` : `${s.hair} ${hc} hair`);
      }
      if (s.hair === 'none') parts.push('shaved head');
      if (s.beard) parts.push('a beard');
      if (s.glasses) parts.push('round glasses');
      if (s.prop && s.prop !== 'none') parts.push(`holding ${an(s.prop === 'pot' ? 'clay water pot' : s.prop === 'staff' ? 'wooden staff' : s.prop)}`);
      const pose = { stand: 'standing upright', wave: 'waving one hand', walk: 'walking to the right', point: 'pointing to the right', cheer: 'arms raised in celebration', think: 'hand on chin, thinking' }[s.pose ?? 'stand'];
      parts.push(pose);
      parts.push(`${colour(s.skin) === 'brown' || !s.skin ? 'brown' : 'warm'} skin, full body, three-quarter view facing right`);
      return parts.join(', ');
    }
    case 'animal': {
      const s = spec as AnimalSpec;
      const f = [an(name), `${colour(s.body)} body`];
      if (s.stripes) f.push(`${colour(s.stripes)} stripes`);
      if (s.spots) f.push(`${colour(s.spots)} spots`);
      if (s.trunk) f.push('long trunk');
      if (s.tusks) f.push('ivory tusks');
      if (s.mane) f.push('full mane');
      if (s.hump) f.push(`${s.hump === 2 ? 'two humps' : 'one hump'}`);
      if (s.horns && s.horns !== 'none') f.push(`${s.horns} horns`);
      f.push('standing on all four legs, full body in side profile facing right');
      return f.join(', ');
    }
    case 'bird': {
      const s = spec as BirdSpec;
      return [an(name), `${colour(s.body)} body`, s.wing && s.wing !== s.body ? `${colour(s.wing)} wings` : '', s.tail === 'fan' ? 'tail feathers spread in a full fan with eye spots' : s.tail === 'long' ? 'long tail' : '', s.crest ? 'small crest' : '', s.flying ? 'wings spread in flight, side view facing right' : 'perched, side view facing right'].filter(Boolean).join(', ');
    }
    case 'fish': {
      const s = spec as FishSpec;
      return [an(name), `${colour(s.body)} body`, s.fin ? `${colour(s.fin)} fins` : '', s.stripes ? `${colour(s.stripes)} stripes` : '', 'side view facing left'].filter(Boolean).join(', ');
    }
    case 'tree': {
      const s = spec as TreeSpec;
      const k = { round: 'leafy tree with a round crown', pine: 'tall conifer pine tree', palm: 'coconut palm tree', banyan: 'wide banyan tree with hanging aerial roots', bamboo: 'cluster of bamboo stalks with leaves', blossom: 'tree covered in pink blossoms', bare: 'leafless bare tree' }[s.kind ?? 'round'];
      return `a single ${k}, full tree from roots to top`;
    }
    case 'mountain':
      return 'a group of mountain peaks with snow caps, isolated';
    case 'building': {
      const s = spec as BuildingSpec;
      const k = {
        house: 'small house with a sloped roof',
        hut: 'village mud hut with a thatched roof',
        temple: 'Indian Hindu temple with a tall shikhara spire and flag',
        tower: 'tall tower',
        skyscraper: 'modern glass office skyscraper',
        factory: 'factory with a chimney',
        school: 'village school building with a flag',
        castle: 'stone fort with battlements',
        mosque: 'mosque with a dome and two minarets',
        lighthouse: 'striped lighthouse',
      }[s.kind ?? 'house'];
      return `${an(k)}, ${colour(s.wall)} walls${s.roof ? `, ${colour(s.roof)} roof` : ''}, front view, whole building`;
    }
    case 'object': {
      const s = spec as ObjectSpec;
      const what = OBJECTS[s.kind ?? ''] ?? name;
      return `${an(`${s.color && !/sun|moon|cloud|leaf|drop/.test(s.kind ?? '') ? `${colour(s.color)} ` : ''}${what}`)}, single object, centred`;
    }
    case 'background': {
      const s = spec as BackgroundSpec;
      const time = s.time ?? 'day';
      const layers = (s.layers ?? []).map((l) => ({ snowMountains: 'snow-capped mountain range', mountains: 'distant mountains', hills: 'rolling hills', river: 'a winding river', sea: 'open sea with waves', forest: 'dense forest', city: 'city skyline', village: 'village huts and a banyan tree', desert: 'sand dunes', field: 'farm fields', temple: 'a temple on the horizon', glacier: 'a glacier', clouds: 'soft clouds' })[l] ?? l);
      return `wide establishing landscape of ${PLACES[name] ?? an(name)}: ${layers.join(', ')}, ${time === 'day' ? 'daylight' : `${time} light`}, empty foreground with open ground for characters to stand on, no people, no animals`;
    }
    default:
      return name;
  }
}

// ---------------------------------------------------------------- write markdown
const SPRITE_RULES =
  'single subject only, isolated on a fully transparent background (PNG with alpha), centred, whole subject in frame with a small margin, feet / base touching the bottom edge, no ground, no cast shadow, no text, no watermark, no border';
const BG_RULES = 'full-bleed scene with no transparency, horizon around 60% down, open ground in the lower third for characters, no people, no animals, no text, no watermark';
const NEGATIVE = 'text, letters, watermark, signature, logo, frame, border, multiple subjects, cropped, cut off, blurry, photo, photorealistic, 3d render, extra limbs, deformed hands';

const groups: Array<{ title: string; folder: string; filter: (t: AssetSpec['type']) => boolean }> = [
  { title: 'People', folder: 'characters', filter: (t) => t === 'person' },
  { title: 'Animals', folder: 'animals', filter: (t) => t === 'animal' || t === 'fish' },
  { title: 'Birds', folder: 'birds', filter: (t) => t === 'bird' },
  { title: 'Nature', folder: 'nature', filter: (t) => t === 'tree' || t === 'mountain' },
  { title: 'Buildings', folder: 'buildings', filter: (t) => t === 'building' },
  { title: 'Objects & props', folder: 'props', filter: (t) => t === 'object' },
  { title: 'Backgrounds', folder: 'backgrounds', filter: (t) => t === 'background' },
];

const TICK = '`';
const code = (s: string) => `${TICK}${s}${TICK}`;
const FENCE = TICK.repeat(3);
const file = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const outDir = path.join(process.cwd(), 'assets', 'prompts');
fs.mkdirSync(outDir, { recursive: true });

// ---- index: rules, styles, style-neutral subject list
const idx: string[] = [
  '# ClipForge asset prompts',
  '',
  `> Generated from ${code('src/assetkit/catalog.ts')} by ${code('npm run prompts')} — re-run after adding recipes.`,
  '',
  `Image-generation prompts for every art style and every asset, so PNGs made in any image tool (local Stable Diffusion / ComfyUI, or a tool you are licensed to use) match ClipForge. Save results into ${code('assets/library/<folder>/')} — ClipForge finds them by file name and animates them in Story videos. Anything missing is drawn automatically.`,
  '',
  '## One file per style',
  '',
  ...STYLES.map((st) => `- [${st.label}](${st.id}.md) — ${st.prompt.split(',')[0]}`),
  '',
  '### Single-file Atlas',
  '',
  '- [Objects & Props Atlas (all 11 styles in one file)](OBJECTS_ATLAS.md) — 198 copy-paste prompts for all objects and props across every art style.',
  '',
  'Each style file has a complete, ready-to-paste prompt for every person, animal, bird, plant, building, prop and background listed below.',
  '',
  '## How a prompt is built',
  '',
  FENCE,
  '<SUBJECT>, <STYLE PROMPT>, colour palette: <STYLE PALETTE>, <SPRITE or BACKGROUND RULES>',
  'Negative: <NEGATIVE PROMPT>, <STYLE AVOID>',
  FENCE,
  '',
  '## Output rules',
  '',
  '| | Sprites (people, animals, birds, nature, buildings, props) | Backgrounds |',
  '|---|---|---|',
  '| Size | 1024 × 1024 (square) | 1080 × 1920 (9:16) and 1920 × 1080 (16:9) |',
  '| Format | PNG **with transparency** | PNG or JPG, no transparency |',
  '| Facing | Characters and animals face **right** (ClipForge mirrors them when needed) | — |',
  '| Placement | Feet / base on the bottom edge, centred | Horizon ~60% down, open ground at the bottom |',
  `| File name | ${code('assets/library/characters/farmer_madhubani.png')} — words become search tags; add the style id to keep styles apart | ${code('assets/library/backgrounds/village_madhubani_9x16.png')} |`,
  '',
  `**Sprite rules:** ${SPRITE_RULES}`,
  '',
  `**Background rules:** ${BG_RULES}`,
  '',
  `**Negative prompt (all):** ${NEGATIVE}`,
  '',
  '**Rights:** only add images you created or are licensed to use commercially. Do not prompt for existing copyrighted characters, brands or specific famous artworks.',
  '',
  '## Subjects (style-neutral)',
  '',
];
for (const g of groups) {
  const recipes = RECIPES.filter((r) => g.filter(r.spec.type));
  if (!recipes.length) continue;
  idx.push(`### ${g.title} — ${code(`assets/library/${g.folder}/`)}`, '', '| Name | Also matches | Subject prompt |', '|---|---|---|');
  for (const r of recipes) idx.push(`| **${r.name}** | ${r.tags.filter((t) => t !== r.name).slice(0, 5).join(', ') || '—'} | ${describe(r.name, r.spec)} |`);
  idx.push('');
}
fs.writeFileSync(path.join(outDir, 'README.md'), idx.join('\n'), 'utf-8');

// ---- one file per style, every subject written out in full
for (const st of STYLES) {
  const md: string[] = [
    `# ${st.label} — asset prompts`,
    '',
    '[← all styles and rules](README.md)',
    '',
    `- **Style prompt:** ${st.prompt}`,
    `- **Palette:** ${st.palette}`,
    `- **Avoid:** ${st.avoid}`,
    `- **Negative prompt (use with every prompt below):** ${NEGATIVE}, ${st.avoid}`,
    '',
  ];
  for (const g of groups) {
    const recipes = RECIPES.filter((r) => g.filter(r.spec.type));
    if (!recipes.length) continue;
    md.push(`## ${g.title}`, '');
    for (const r of recipes) {
      const isBg = r.spec.type === 'background';
      const save = `assets/library/${CATEGORY_OF[r.spec.type]}/${file(r.name)}_${st.id}${isBg ? '_9x16' : ''}.png`;
      md.push(`### ${r.name}`, '', FENCE, `${describe(r.name, r.spec)}, ${st.prompt}, colour palette: ${st.palette}, ${isBg ? BG_RULES : SPRITE_RULES}`, FENCE);
      md.push(`Save as ${code(save)}${isBg ? ` (make a 1920×1080 version too, saved as ${code(save.replace('_9x16', '_16x9'))})` : ''}`, '');
    }
  }
  fs.writeFileSync(path.join(outDir, `${st.id}.md`), md.join('\n'), 'utf-8');
}

// ---- unified Objects & Props Atlas across all styles
const objGroup = groups.find((g) => g.folder === 'props');
const objRecipes = objGroup ? RECIPES.filter((r) => objGroup.filter(r.spec.type)) : [];
const atlasLines: string[] = [
  '# ClipForge AI — Asset Objects & Props Generation Prompt Atlas',
  '',
  `> Complete single-file atlas of all ${objRecipes.length} objects and props across all ${STYLES.length} art styles (${objRecipes.length * STYLES.length} prompts total).`,
  '> All sprites are isolated on transparent PNG (PNG with alpha), centred, touching base.',
  '',
  '## Table of Contents',
  '',
];
for (const st of STYLES) {
  atlasLines.push(`- [${st.label}](#${st.id})`);
}
atlasLines.push('', '---', '');

for (const st of STYLES) {
  atlasLines.push(
    `<a id="${st.id}"></a>`,
    '',
    `## ${st.label} (\`${st.id}\`)`,
    '',
    `- **Style prompt:** ${st.prompt}`,
    `- **Palette:** ${st.palette}`,
    `- **Avoid:** ${st.avoid}`,
    `- **Negative prompt:** ${NEGATIVE}, ${st.avoid}`,
    '',
  );
  for (const r of objRecipes) {
    const save = `assets/library/props/${file(r.name)}_${st.id}.png`;
    atlasLines.push(
      `### ${r.name}`,
      '',
      FENCE,
      `${describe(r.name, r.spec)}, ${st.prompt}, colour palette: ${st.palette}, ${SPRITE_RULES}`,
      FENCE,
      `Save as ${code(save)}`,
      '',
    );
  }
  atlasLines.push('---', '');
}
fs.writeFileSync(path.join(outDir, 'OBJECTS_ATLAS.md'), atlasLines.join('\n'), 'utf-8');

console.log(`Wrote ${STYLES.length} style files, OBJECTS_ATLAS.md + README to ${outDir} — ${RECIPES.length} subjects each`);
