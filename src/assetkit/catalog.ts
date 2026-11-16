/**
 * Built-in asset recipes. Each name renders in any art style on first use and is cached as a PNG
 * in assets/library/generated/<style>/. Synonyms let story words ("kid", "grandmother") find a recipe.
 */
import type { AssetSpec, AssetType } from './types.ts';

export interface Recipe {
  name: string;
  spec: AssetSpec;
  tags: string[];
}

const r = (name: string, spec: AssetSpec, tags: string[] = []): Recipe => ({ name, spec, tags: [name, ...tags] });

export const RECIPES: Recipe[] = [
  // ---- people
  r('farmer', { type: 'person', top: '#F6EFE0', bottom: '#F6EFE0', dress: 'dhoti', headwear: 'turban', headwearColor: '#E86A17', prop: 'staff', beard: true, skin: '#A0673D' }, ['villager', 'peasant', 'grower', 'cultivator', 'man']),
  r('woman', { type: 'person', top: '#C1272D', bottom: '#F4B400', dress: 'saree', hair: 'bun', skin: '#B97A4E' }, ['lady', 'mother', 'girl', 'female', 'wife']),
  r('village woman', { type: 'person', top: '#2E7D32', bottom: '#E86A17', dress: 'saree', hair: 'bun', prop: 'pot', skin: '#A0673D' }, ['woman carrying water', 'water carrier']),
  r('child', { type: 'person', top: '#F4B400', bottom: '#1F4E9E', child: true, hair: 'short', pose: 'wave', skin: '#C68642' }, ['kid', 'boy', 'son', 'student', 'children']),
  r('girl', { type: 'person', top: '#F48FB1', bottom: '#7B3F99', dress: 'skirt', child: true, hair: 'long', pose: 'cheer', skin: '#C68642' }, ['daughter', 'little girl']),
  r('elder', { type: 'person', top: '#FFFFFF', bottom: '#FFFFFF', dress: 'dhoti', elderly: true, beard: true, glasses: true, prop: 'staff', skin: '#A0673D' }, ['old man', 'grandfather', 'grandpa', 'sage', 'wise man']),
  r('grandmother', { type: 'person', top: '#FFFFFF', bottom: '#9E9E9E', dress: 'saree', elderly: true, hair: 'bun', skin: '#A0673D' }, ['old woman', 'grandma', 'granny']),
  r('scientist', { type: 'person', top: '#FFFFFF', bottom: '#3D405B', glasses: true, prop: 'book', hair: 'short', skin: '#C68642' }, ['researcher', 'doctor', 'expert', 'professor']),
  r('teacher', { type: 'person', top: '#1F4E9E', bottom: '#3D405B', dress: 'saree', hair: 'bun', prop: 'book', skin: '#B97A4E' }, ['educator', 'mentor']),
  r('worker', { type: 'person', top: '#F4B400', bottom: '#3D405B', headwear: 'helmet', skin: '#A0673D' }, ['labourer', 'builder', 'engineer', 'construction']),
  r('king', { type: 'person', top: '#8E1B1B', bottom: '#D4A537', dress: 'robe', headwear: 'crown', beard: true, prop: 'sword', skin: '#C68642' }, ['raja', 'emperor', 'ruler', 'maharaja']),
  r('queen', { type: 'person', top: '#7B3F99', bottom: '#D4A537', dress: 'saree', headwear: 'crown', hair: 'long', skin: '#C68642' }, ['rani', 'empress', 'princess']),
  r('monk', { type: 'person', top: '#E86A17', bottom: '#E86A17', dress: 'robe', hair: 'none', skin: '#C68642' }, ['saint', 'yogi', 'priest', 'buddha']),
  r('soldier', { type: 'person', top: '#556B2F', bottom: '#556B2F', headwear: 'helmet', headwearColor: '#556B2F', prop: 'flag', skin: '#C68642' }, ['warrior', 'army', 'guard']),
  r('fisherman', { type: 'person', top: '#1F4E9E', bottom: '#F6EFE0', dress: 'dhoti', headwear: 'hat', prop: 'basket', skin: '#8D5524' }, ['fisher', 'boatman', 'sailor']),
  r('businessman', { type: 'person', top: '#3D405B', bottom: '#2B2D42', prop: 'phone', hair: 'short', skin: '#C68642' }, ['entrepreneur', 'manager', 'office worker', 'professional', 'man in suit']),
  r('speaker', { type: 'person', top: '#2E86AB', bottom: '#3D405B', pose: 'point', hair: 'short', skin: '#C68642' }, ['presenter', 'narrator', 'host', 'person', 'people', 'citizen']),
  r('dancer', { type: 'person', top: '#C1272D', bottom: '#F4B400', dress: 'skirt', hair: 'bun', pose: 'cheer', skin: '#B97A4E' }, ['performer', 'celebration']),
  r('traveller', { type: 'person', top: '#8D6E63', bottom: '#3D405B', headwear: 'hat', pose: 'walk', prop: 'staff', skin: '#C68642' }, ['traveler', 'pilgrim', 'explorer', 'hiker', 'wanderer']),
  // ---- animals
  r('elephant', { type: 'animal', body: '#8D8D8D', trunk: true, tusks: true, ears: 'big', legLength: 1.1, bodyLength: 1.2, tail: 'thin', size: 1.2 }, ['tusker', 'haathi']),
  r('tiger', { type: 'animal', body: '#E86A17', belly: '#FFF3E0', stripes: '#111111', ears: 'small', tail: 'long', snout: 'short' }, ['big cat', 'bengal tiger']),
  r('lion', { type: 'animal', body: '#D9A441', mane: true, ears: 'small', tail: 'tuft' }, ['king of the jungle']),
  r('leopard', { type: 'animal', body: '#E9B44C', spots: '#3B2A1A', ears: 'small', tail: 'long' }, ['cheetah', 'jaguar']),
  r('cow', { type: 'animal', body: '#F6EFE0', spots: '#3B2A1A', horns: 'short', ears: 'floppy', tail: 'tuft', snout: 'long' }, ['cattle', 'bull', 'ox', 'buffalo']),
  r('deer', { type: 'animal', body: '#B5835A', spots: '#F6EFE0', horns: 'antlers', legLength: 1.4, neck: 0.8, ears: 'pointy', tail: 'thin', snout: 'long' }, ['stag', 'antelope']),
  r('horse', { type: 'animal', body: '#6D4C41', mane: false, legLength: 1.5, neck: 1, ears: 'pointy', tail: 'bushy', snout: 'long' }, ['pony', 'stallion', 'mare']),
  r('camel', { type: 'animal', body: '#C8A165', hump: 2, legLength: 1.6, neck: 1.2, ears: 'small', tail: 'thin', snout: 'long' }, ['dromedary']),
  r('giraffe', { type: 'animal', body: '#E9B44C', spots: '#8D5524', legLength: 1.8, neck: 2.5, horns: 'short', ears: 'small', tail: 'tuft', snout: 'long' }, []),
  r('dog', { type: 'animal', body: '#B5835A', ears: 'floppy', tail: 'bushy', size: 0.7, snout: 'long' }, ['puppy', 'hound']),
  r('cat', { type: 'animal', body: '#9E9E9E', ears: 'pointy', tail: 'long', size: 0.55 }, ['kitten']),
  r('goat', { type: 'animal', body: '#F6EFE0', horns: 'curved', ears: 'floppy', tail: 'thin', size: 0.7, snout: 'long' }, ['sheep', 'lamb']),
  r('bear', { type: 'animal', body: '#5D4037', ears: 'small', tail: 'none', legLength: 0.8, bodyLength: 1.1, size: 1.1 }, ['panda']),
  r('rabbit', { type: 'animal', body: '#F6EFE0', ears: 'long', tail: 'bushy', legLength: 0.6, size: 0.45 }, ['hare', 'bunny']),
  r('monkey', { type: 'animal', body: '#8D5524', ears: 'small', tail: 'long', legLength: 0.9, size: 0.6 }, ['ape', 'langur']),
  r('zebra', { type: 'animal', body: '#FFFFFF', stripes: '#111111', mane: false, legLength: 1.4, neck: 0.9, ears: 'pointy', tail: 'tuft', snout: 'long' }, []),
  // ---- birds & fish
  r('peacock', { type: 'bird', body: '#1E5AA8', wing: '#16A085', tail: 'fan', tailColor: '#2E8B57', crest: true }, ['peafowl', 'mor']),
  r('crow', { type: 'bird', body: '#222222', wing: '#111111', beak: '#333333', tail: 'short', size: 0.6 }, ['raven', 'blackbird']),
  r('parrot', { type: 'bird', body: '#2E8B57', wing: '#43A047', beak: '#C1272D', tail: 'long', size: 0.6 }, ['parakeet']),
  r('eagle', { type: 'bird', body: '#5D4037', wing: '#4E342E', beak: '#F4B400', tail: 'short', flying: true }, ['hawk', 'kite bird', 'falcon']),
  r('bird', { type: 'bird', body: '#E86A17', wing: '#F4B400', tail: 'short', flying: true, size: 0.6 }, ['birds', 'sparrow', 'flying bird']),
  r('swan', { type: 'bird', body: '#FFFFFF', wing: '#F5F5F5', beak: '#E86A17', tail: 'short' }, ['duck', 'goose', 'crane']),
  r('fish', { type: 'fish', body: '#F4B400', fin: '#E86A17', stripes: '#C1272D' }, ['fishes', 'carp', 'goldfish']),
  // ---- nature
  r('tree', { type: 'tree', kind: 'round' }, ['trees', 'oak', 'mango tree']),
  r('banyan tree', { type: 'tree', kind: 'banyan' }, ['banyan', 'peepal', 'big tree']),
  r('pine tree', { type: 'tree', kind: 'pine' }, ['pine', 'fir', 'conifer', 'deodar']),
  r('palm tree', { type: 'tree', kind: 'palm' }, ['palm', 'coconut tree']),
  r('bamboo', { type: 'tree', kind: 'bamboo', leaf: '#7CB342' }, []),
  r('blossom tree', { type: 'tree', kind: 'blossom', leaf: '#81C784', flower: '#F48FB1' }, ['cherry blossom', 'flowering tree', 'spring tree']),
  r('dead tree', { type: 'tree', kind: 'bare', trunk: '#5D4037' }, ['bare tree', 'drought tree']),
  r('mountain', { type: 'mountain', peaks: 2, snow: true }, ['mountains', 'peak', 'himalaya']),
  r('rock', { type: 'object', kind: 'rock' }, ['stone', 'boulder']),
  r('flower', { type: 'object', kind: 'flower', color: '#F48FB1', accent: '#F4B400' }, ['flowers', 'lotus', 'rose']),
  r('cloud', { type: 'object', kind: 'cloud' }, ['clouds', 'rain cloud', 'monsoon cloud']),
  r('sun', { type: 'object', kind: 'sun' }, ['sunrise', 'sunlight']),
  r('moon', { type: 'object', kind: 'moon' }, ['night', 'crescent']),
  r('star', { type: 'object', kind: 'star' }, ['stars']),
  r('water drop', { type: 'object', kind: 'drop' }, ['water', 'drop', 'rain', 'raindrop']),
  r('leaf', { type: 'object', kind: 'leaf' }, ['leaves', 'plant']),
  // ---- buildings
  r('house', { type: 'building', kind: 'house' }, ['home']),
  r('hut', { type: 'building', kind: 'hut' }, ['village hut', 'cottage']),
  r('temple', { type: 'building', kind: 'temple', wall: '#F3E6CC', roof: '#E86A17' }, ['mandir', 'shrine']),
  r('mosque', { type: 'building', kind: 'mosque', wall: '#F6EFE0', roof: '#2E7D32' }, ['masjid', 'dome']),
  r('skyscraper', { type: 'building', kind: 'skyscraper', wall: '#90A4AE' }, ['building', 'office', 'tower block']),
  r('factory', { type: 'building', kind: 'factory' }, ['industry', 'plant', 'mill', 'pollution']),
  r('school', { type: 'building', kind: 'school', wall: '#FFE0B2', roof: '#C1272D' }, ['college', 'classroom']),
  r('castle', { type: 'building', kind: 'castle', wall: '#BCAAA4' }, ['fort', 'palace', 'qila']),
  r('lighthouse', { type: 'building', kind: 'lighthouse', wall: '#FFFFFF', roof: '#C1272D' }, []),
  // ---- props
  r('boat', { type: 'object', kind: 'boat', color: '#8D5524', accent: '#F6EFE0' }, ['ship', 'sailboat']),
  r('car', { type: 'object', kind: 'car', color: '#C1272D' }, ['vehicle', 'taxi', 'traffic']),
  r('tractor', { type: 'object', kind: 'tractor', color: '#C1272D' }, ['farming machine']),
  r('bicycle', { type: 'object', kind: 'bicycle', color: '#1F4E9E' }, ['cycle', 'bike']),
  r('kite', { type: 'object', kind: 'kite', color: '#E86A17' }, ['patang']),
  r('book', { type: 'object', kind: 'book', color: '#C1272D' }, ['books', 'knowledge', 'study']),
  r('globe', { type: 'object', kind: 'globe' }, ['earth', 'world', 'planet']),
  r('pot', { type: 'object', kind: 'pot' }, ['matka', 'vessel', 'pitcher']),
  r('diya', { type: 'object', kind: 'diya' }, ['lamp', 'oil lamp', 'diwali', 'light']),
  r('heart', { type: 'object', kind: 'heart' }, ['love']),
  // ---- backgrounds (rendered at the video frame size)
  r('village', { type: 'background', layers: ['hills', 'village', 'field'], ground: '#9CCC65' }, ['countryside', 'rural', 'gaon']),
  r('forest', { type: 'background', layers: ['hills', 'forest'], ground: '#558B2F' }, ['jungle', 'woods']),
  r('himalaya', { type: 'background', layers: ['snowMountains'], ground: '#8D9EAF', skyTop: '#6FA8DC' }, ['himalayas', 'snow mountains', 'mountain range', 'peaks']),
  r('glacier', { type: 'background', layers: ['glacier', 'snowMountains'], ground: '#E3F2FD', skyTop: '#90CAF9' }, ['ice', 'snow', 'melting ice']),
  r('river valley', { type: 'background', layers: ['mountains', 'hills', 'river'], ground: '#7CB342' }, ['river', 'riverbank', 'ganga', 'valley', 'stream']),
  r('ocean', { type: 'background', layers: ['sea', 'clouds'], ground: '#2F6FA8' }, ['sea', 'coast', 'beach', 'waves']),
  r('city', { type: 'background', layers: ['city'], ground: '#9E9E9E', skyTop: '#90A4AE', skyBottom: '#ECEFF1' }, ['urban', 'town', 'metro']),
  r('desert', { type: 'background', layers: ['desert'], ground: '#E9C46A', skyTop: '#F4A261', skyBottom: '#FFE8C2' }, ['sand', 'thar', 'drought', 'dry land']),
  r('farm', { type: 'background', layers: ['hills', 'field'], ground: '#AED581' }, ['field', 'crops', 'agriculture', 'paddy']),
  r('night sky', { type: 'background', time: 'night', layers: ['hills'], ground: '#1B2A3A' }, ['night', 'stars', 'evening']),
  r('temple town', { type: 'background', layers: ['hills', 'temple'], ground: '#D7CCC8', time: 'sunset' }, ['temple', 'pilgrimage', 'varanasi', 'ghats']),
  r('sky', { type: 'background', layers: ['clouds'], ground: '#9CCC65', horizon: 0.8 }, ['open sky', 'heaven', 'air']),
  r('sunset hills', { type: 'background', time: 'sunset', layers: ['hills'], ground: '#8D6E63' }, ['sunset', 'dusk', 'evening hills']),
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Rough English singular: fireflies → firefly, foxes → fox, trees → tree (leaves "grass", "bus" alone). */
export function singular(w: string): string {
  return w
    .split(' ')
    .map((x) => {
      if (x.length <= 3 || /(ss|us|is)$/.test(x)) return x;
      if (/ies$/.test(x)) return x.slice(0, -3) + 'y';
      if (/(ch|sh|x|z)es$/.test(x)) return x.slice(0, -2);
      if (/ves$/.test(x)) return x.slice(0, -3) + 'f';
      if (/s$/.test(x)) return x.slice(0, -1);
      return x;
    })
    .join(' ');
}

/** Best recipe for a phrase like "a little girl" or "the Himalayas". */
export function findRecipe(phrase: string, type?: AssetType): Recipe | null {
  const q = norm(phrase).replace(/^(a|an|the|some|two|three|many)\s+/, '');
  if (!q) return null;
  const pool = type ? RECIPES.filter((rc) => rc.spec.type === type || (type === 'animal' && rc.spec.type === 'fish')) : RECIPES;
  const words = q.split(' ');
  let best: Recipe | null = null;
  let score = 0;
  for (const rc of pool) {
    for (const t of rc.tags) {
      const tn = norm(t);
      let s = 0;
      if (tn === q || singular(tn) === singular(q)) s = 100;
      // whole words only — "fir" must not match "firefly"
      else if (tn.length > 2 && ` ${words.map(singular).join(' ')} `.includes(` ${singular(tn)} `)) s = 50 + tn.length;
      else if (words.some((w) => w.length > 2 && singular(w) === singular(tn))) s = 40;
      if (s > score) [best, score] = [rc, s];
    }
  }
  return best;
}

export const slug = (s: string) => norm(s).replace(/ /g, '-').slice(0, 48) || 'asset';
