/**
 * Asset kit specs. An AssetSpec is a small JSON recipe that a generator turns into SVG,
 * which is then rendered to a transparent PNG and stored in assets/library.
 * The local LLM can write these for assets that don't exist yet.
 */
export type AssetType = 'person' | 'animal' | 'bird' | 'fish' | 'tree' | 'mountain' | 'building' | 'object' | 'background';

export interface PersonSpec {
  type: 'person';
  skin?: string;
  top?: string; // shirt / kurta / blouse colour
  bottom?: string; // trousers / skirt colour
  dress?: 'trousers' | 'skirt' | 'saree' | 'dhoti' | 'robe';
  hair?: 'short' | 'long' | 'bun' | 'none';
  hairColor?: string;
  headwear?: 'none' | 'turban' | 'cap' | 'scarf' | 'hat' | 'crown' | 'helmet';
  headwearColor?: string;
  beard?: boolean;
  glasses?: boolean;
  prop?: 'none' | 'staff' | 'book' | 'basket' | 'phone' | 'flag' | 'pot' | 'sword' | 'lamp';
  pose?: 'stand' | 'wave' | 'walk' | 'point' | 'cheer' | 'think';
  child?: boolean;
  elderly?: boolean;
}

export interface AnimalSpec {
  type: 'animal';
  body?: string; // main colour
  belly?: string;
  size?: number; // 0.5 - 1.6
  bodyLength?: number; // 0.6 - 1.6
  legLength?: number; // 0.5 - 2
  neck?: number; // 0 - 2.5 (giraffe ≈ 2.5)
  ears?: 'small' | 'pointy' | 'big' | 'floppy' | 'long';
  tail?: 'thin' | 'bushy' | 'tuft' | 'none' | 'long';
  trunk?: boolean;
  tusks?: boolean;
  horns?: 'none' | 'short' | 'curved' | 'antlers';
  mane?: boolean;
  hump?: number; // 0, 1, 2
  stripes?: string; // stripe colour, '' = none
  spots?: string;
  snout?: 'short' | 'long' | 'beak';
}

export interface BirdSpec {
  type: 'bird';
  body?: string;
  wing?: string;
  beak?: string;
  tail?: 'short' | 'long' | 'fan';
  tailColor?: string;
  crest?: boolean;
  size?: number;
  flying?: boolean;
}

export interface FishSpec {
  type: 'fish';
  body?: string;
  fin?: string;
  stripes?: string;
  size?: number;
}

export interface TreeSpec {
  type: 'tree';
  kind?: 'round' | 'pine' | 'palm' | 'banyan' | 'bamboo' | 'blossom' | 'bare';
  leaf?: string;
  trunk?: string;
  flower?: string;
}

export interface MountainSpec {
  type: 'mountain';
  peaks?: number;
  snow?: boolean;
  rock?: string;
}

export interface BuildingSpec {
  type: 'building';
  kind?: 'house' | 'hut' | 'temple' | 'tower' | 'skyscraper' | 'factory' | 'school' | 'castle' | 'mosque' | 'lighthouse';
  wall?: string;
  roof?: string;
  floors?: number;
}

export interface ObjectSpec {
  type: 'object';
  kind?: 'boat' | 'cloud' | 'sun' | 'moon' | 'flower' | 'rock' | 'pot' | 'diya' | 'car' | 'kite' | 'book' | 'globe' | 'tractor' | 'bicycle' | 'star' | 'heart' | 'drop' | 'leaf';
  color?: string;
  accent?: string;
}

export type EnvLayer =
  | 'mountains'
  | 'snowMountains'
  | 'hills'
  | 'river'
  | 'sea'
  | 'forest'
  | 'city'
  | 'village'
  | 'desert'
  | 'field'
  | 'temple'
  | 'glacier'
  | 'clouds';

export interface BackgroundSpec {
  type: 'background';
  skyTop?: string;
  skyBottom?: string;
  ground?: string;
  time?: 'day' | 'sunset' | 'night' | 'dawn';
  layers?: EnvLayer[];
  horizon?: number; // 0.3 - 0.8 (fraction of height)
}

export type AssetSpec = PersonSpec | AnimalSpec | BirdSpec | FishSpec | TreeSpec | MountainSpec | BuildingSpec | ObjectSpec | BackgroundSpec;

export interface AssetEntry {
  id: string; // slug, e.g. "elephant"
  name: string;
  type: AssetType;
  category: string; // folder: characters, animals, birds, nature, buildings, props, backgrounds
  style: string; // art style id, or "any" for user-supplied PNGs
  url: string; // /media/assets/...
  tags: string[];
  generated: boolean;
  width: number;
  height: number;
  aspect?: string; // backgrounds only
  spec?: AssetSpec;
  createdAt: string;
  /** user PNGs only: where it came from and what you may do with it */
  source?: string;
  licence?: string;
  licenceStatus?: 'ok' | 'check' | 'restricted';
  animated?: boolean; // Lottie JSON animation
  /** from the AI object database (assets/library/objects.json) */
  label?: string; // what the picture actually shows, e.g. "firefly"
  kind?: string; // person | animal | bird | insect | tree | …
  where?: 'ground' | 'sky' | 'water' | 'back';
  description?: string;
}

/** Licences that are clear for commercial client work. Anything else needs checking before a paid project. */
export function licenceStatus(licence?: string): 'ok' | 'check' | 'restricted' {
  const l = (licence ?? '').toLowerCase();
  if (!l || /unverified|unknown|not checked/.test(l)) return 'check';
  if (/personal|non-?commercial|\bnc\b|editorial|fan ?art/.test(l)) return 'restricted';
  if (/cc0|public domain|own work|my own|mine|commercial|purchased|paid|licensed|royalty[- ]free|cc[- ]by(?![- ]?nc)/.test(l)) return 'ok';
  return 'check';
}

export const CATEGORY_OF: Record<AssetType, string> = {
  person: 'characters',
  animal: 'animals',
  bird: 'birds',
  fish: 'animals',
  tree: 'nature',
  mountain: 'nature',
  building: 'buildings',
  object: 'props',
  background: 'backgrounds',
};
