/**
 * Image-generation prompt builder for the art styles in this folder.
 * Style injection: the scene prompt keeps its subject, actions and composition; only the rendering changes.
 * Regenerate the JSON with `npm run artstyles` (source: scripts/data/art-style-presets.json + the renderer code).
 */
import rules from './_rules.json' with { type: 'json' };
import anime from './anime.json' with { type: 'json' };
import auto from './auto.json' with { type: 'json' };
import blueprint from './blueprint.json' with { type: 'json' };
import collage from './collage.json' with { type: 'json' };
import cartoon from './cartoon.json' with { type: 'json' };
import flatVector from './flatVector.json' with { type: 'json' };
import handDrawn from './handDrawn.json' with { type: 'json' };
import inkWash from './inkWash.json' with { type: 'json' };
import madhubani from './madhubani.json' with { type: 'json' };
import miniature from './miniature.json' with { type: 'json' };
import mix from './mix.json' with { type: 'json' };
import paperCutout from './paperCutout.json' with { type: 'json' };
import shadowPuppet from './shadowPuppet.json' with { type: 'json' };
import stainedGlass from './stainedGlass.json' with { type: 'json' };
import storybook from './storybook.json' with { type: 'json' };
import ukiyoe from './ukiyoe.json' with { type: 'json' };
import warli from './warli.json' with { type: 'json' };

export interface StyleGeneration {
  sourceId: string;
  category: string;
  description: string;
  visualIdentity: string;
  linework: string;
  textures: string;
  characters: string;
  backgrounds: string;
  lighting: string;
  composition: string;
  bestFor: string[];
  instructions: string;
  promptModifier: string;
  negativePrompt: string;
  negativeModifier: string;
  sdHint?: string | null; // short colour / layout cue placed right after the subject
  sdNegative?: string | null;
}

export const ART_STYLE_SPECS = { anime, auto, blueprint, cartoon, collage, flatVector, handDrawn, inkWash, madhubani, miniature, mix, paperCutout, shadowPuppet, stainedGlass, storybook, ukiyoe, warli };
export type StyleSpecId = keyof typeof ART_STYLE_SPECS;
export const ART_STYLE_RULES = rules;

export const styleGeneration = (id: string): StyleGeneration | null =>
  id in ART_STYLE_SPECS ? ((ART_STYLE_SPECS[id as StyleSpecId].generation as StyleGeneration | null) ?? null) : null;

export interface PromptOptions {
  /** fixed character descriptions repeated in every scene (consistency) */
  characters?: string[];
  /** include the shared consistency + composition rules (on by default) */
  rules?: boolean;
  /** add the longer art-direction instructions as well as the modifier */
  detailed?: boolean;
}

/** Positive prompt for one scene in a style. Unknown style → the scene prompt unchanged. */
export function buildImagePrompt(scenePrompt: string, styleId: string, opts: PromptOptions = {}): string {
  const g = styleGeneration(styleId);
  if (!g) return scenePrompt;
  const parts = [scenePrompt.trim(), '', 'ART STYLE:', g.promptModifier];
  if (opts.detailed) parts.push(g.instructions, `Lighting: ${g.lighting}`, `Textures: ${g.textures}`);
  if (opts.characters?.length) parts.push('', 'CHARACTERS (identical in every scene):', ...opts.characters.map((c) => `- ${c}`));
  parts.push('', 'INSTRUCTIONS:', rules.styleSystem.application.instruction);
  if (opts.rules !== false) {
    parts.push(...rules.globalGenerationRules.composition_rules);
    if (opts.characters?.length) parts.push(...rules.globalGenerationRules.character_consistency.rules);
  }
  if (!rules.globalGenerationRules.output_quality.text_in_image) parts.push('Do not draw any text, letters or watermarks.');
  return parts.join('\n');
}

/**
 * Compact prompt for Stable Diffusion. CLIP reads short phrases and weights the start most, so:
 * "<Style> illustration of <subject>" first (keeps the subject from being swallowed by pattern-heavy styles
 * such as Madhubani or stained glass), then the characters, then the style details, lighting and texture.
 */
export function buildSdPrompt(scene: string, styleId: string, characters: string[] = [], opts: { lighting?: string } = {}): string {
  const g = styleGeneration(styleId);
  if (!g) return [scene, ...characters].join(', ');
  const spec = ART_STYLE_SPECS[styleId as StyleSpecId];
  const name = spec ? String(spec.label) : styleId;
  const modifier = g.promptModifier.replace(/^Render (as|in|using) /i, '').replace(/\.$/, '');
  return [`${name} illustration of ${scene}`, ...(g.sdHint ? [g.sdHint] : []), ...characters, modifier, (opts.lighting ?? g.lighting).replace(/\.$/, ''), g.textures.replace(/\.$/, ''), 'clear focal subject, masterpiece, highly detailed, no text'].filter(Boolean).join(', ');
}

/** Negative prompt for a style (both the long and short avoid lists, de-duplicated). */
export function buildNegativePrompt(styleId: string): string {
  const g = styleGeneration(styleId);
  if (!g) return '';
  const seen = new Set<string>();
  return `${g.sdNegative ? `${g.sdNegative}, ` : ''}${g.negativePrompt}, ${g.negativeModifier}`
    .split(',')
    .map((s) => s.trim().replace(/\.$/, ''))
    .filter((s) => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()))
    .join(', ');
}
