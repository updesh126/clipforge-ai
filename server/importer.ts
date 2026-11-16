/**
 * Bulk import a folder of images (JPG / PNG / WebP) into the asset library:
 * clean the name, sort by subject, remove the background, normalise, record source + licence.
 * Used by `npm run import-images "<folder>"` and by the inbox for JPG/WebP drops.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { AssetType } from '../src/assetkit/types.ts';
import { CATEGORY_OF } from '../src/assetkit/types.ts';
import { ASSETS_DIR, setLicence } from './assets.ts';
import { cutout } from './bgremove.ts';

const KW: Array<[AssetType | 'scene', RegExp]> = [
  ['scene', /\b(aurora|galaxy|nebula|black hole|cosmos|landscape|scenery|cityscape|panorama|horizon|sunset sky|starry sky|night sky|underwater scene|snow wind|snowfall|blizzard|rainfall|rain shower|storm|lightning|fog|mist|smoke|sparks|confetti|particles|bokeh|wallpaper)(?:e?s)?\b/],
  ['bird', /\b(owl|eagle|parrot|peacock|crow|raven|sparrow|pigeon|dove|duck|swan|goose|hen|rooster|chicken|bird|hawk|falcon|vulture|crane|stork|flamingo|penguin|ostrich|kingfisher|hummingbird|jay|woodpecker|robin|toucan|macaw|gull|seagull|pelican|heron|bat|butterfly|bee|bumblebee|dragonfly|moth|firefly)(?:e?s)?\b/],
  ['person', /\b(schoolboy|schoolgirl|policeman|policewoman|fireman|sportsman|craftsman|fisherwoman|horseman|cowgirl|grandma|grandpa|man|men|woman|women|boy|girl|child|children|kid|people|person|farmer|king|queen|prince|princess|monk|chef|doctor|nurse|teacher|student|soldier|warrior|archer|knight|captain|pilot|astronaut|blacksmith|alchemist|charioteer|merchant|worker|engineer|scientist|professional|businessman|businesswoman|artisan|weaver|potter|fisherman|sailor|priest|saint|sage|dancer|musician|player|athlete|runner|wrestler|police|officer|firefighter|judge|lawyer|villager|elder|grandmother|grandfather|mother|father|baby|family|tourist|traveller|traveler|explorer|hunter|shepherd|cowboy|samurai|ninja|viking|pharaoh|emperor|guard|vendor|shopkeeper|tailor|carpenter|mason|mechanic|barber|painter|singer|drummer|guru|yogi|scholar|clerk|cook|waiter|beggar|hermit|wizard|witch|gladiator|centurion|rider|jockey|climber|diver|surgeon|pharmacist|librarian|reporter|photographer|architect|programmer|gardener|miner|porter|courier|postman|referee|coach|nomad|bedouin hermit)(?:e?s)?\b/],
  ['animal', /\b(tiger|lion|lioness|leopard|panther|cheetah|jaguar|elephant|horse|stallion|mare|pony|camel|cow|bull|ox|buffalo|bison|goat|sheep|lamb|ram|deer|stag|antelope|dog|puppy|cat|kitten|monkey|ape|bear|wolf|fox|rabbit|hare|zebra|giraffe|rhino|rhinoceros|hippo|hippopotamus|crocodile|alligator|snake|cobra|python|scorpion|spider|lizard|gecko|iguana|chameleon|turtle|tortoise|frog|toad|fish|shark|whale|dolphin|octopus|squid|crab|lobster|shrimp|ant|mouse|rat|squirrel|kangaroo|koala|panda|pig|boar|donkey|mule|yak|llama|alpaca|hyena|jackal|gorilla|chimpanzee|orangutan|sloth|beetle|snail|insect|ibex|seal|walrus|otter|beaver|hedgehog|porcupine|raccoon|skunk|moose|reindeer|dinosaur|dragon)(?:e?s)?\b/],
  ['building', /\b(building|house|hut|tent|temple|church|cathedral|mosque|castle|fort|fortress|palace|tower|school|hospital|factory|observatory|pyramid|courthouse|bridge|lighthouse|barn|shop|store|market|station|airport|stadium|monument|gate|arch|windmill|skyscraper|cottage|cabin|igloo|museum|library|bank|office|warehouse|shed|stable|mill|dome|pagoda|stupa|minaret|shrine|colosseum|amphitheatre|amphitheater|villa|mansion|bungalow|apartment|hotel|restaurant|cafe|kiosk|shelter|well|millhouse|greenhouse|farmhouse|treehouse|boathouse|warehouse|houseboat)(?:e?s)?\b/],
  ['tree', /\b(tree|banyan|baobab|bamboo|palm|pine|oak|maple|willow|cypress|plant|flower|lotus|rose|sunflower|tulip|bush|shrub|cactus|mushroom|leaf|leaves|grass|fern|vine|mountain|volcano|rock|boulder|cliff|waterfall|iceberg|log|stump|wheat|crop|corn|rice plant|hay)(?:e?s)?\b/],
];

/** Things with see-through gaps where enclosed background should also be cleared. */
const HOLES = /\b(tree|banyan|baobab|bamboo|palm|ladder|fence|bicycle|bike|chair|tower|scaffold|net|cage|wheel|gate|bridge|swing|stool|table|frame|tripod|easel|trellis|grill|rack|antenna|crane|windmill|basket|chariot|cart|ram|railing|lattice)\b/;

export function cleanName(file: string): string[] {
  return path
    .basename(file, path.extname(file))
    .replace(/…|\.\.\./g, ' ')
    .replace(/_[0-9a-f]{6,}$/i, '') // trailing hash id
    .replace(/^pngimg\.com\s*-\s*/i, '')
    .replace(/_png\d+$/i, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !/^(png|jpg|svg|isolated|transparent|background|vector|art|digital|illustration|clipart|clip|image|hd|free|stock|the|of|and|a|an)$/.test(w));
}

/** File name words without connectors ("with", "on", "in" are kept for classification only). */
const NAME_SKIP = /^(with|on|in|at|by|near|under)$/;

/** Words that start the "doing" part of a name: "emperor scorpion | standing", "farmer | riding horse". */
const ACTION = /^(holding|drawing|carrying|riding|walking|standing|sitting|running|flying|perched|swimming|playing|reading|wearing|pulling|pushing|facing|looking|leaning|resting|floating|hanging|eating|drinking|working|dancing|jumping|climbing|prowling|galloping|grazing|roaring|singing|praying|waving|pointing|kneeling|crouching|lying|sleeping|loaded|filled|with|on|in|under|near|by|at)$/;

const OBJECT_PHRASES = /\b(piggy bank|bullion|wheelchair|battering ram|space station|satellite|gramophone|fisherman float|glass float|float netting|bird feather|feather|trophy|medal|medallion|ribbon|crown|throne|helmet|armou?r|greaves|shield|sword|axe|battleaxe|spear|bow and arrow|key|lock|padlock|clock|lantern|lamp|telescope|compass|sextant|bell|scale|anchor|rope|barrel|chest|toolbox|briefcase|attach[eé]|suitcase|backpack|instrument|guitar|drum|trumpet|violin|flute|sitar|tabla|piano)\b/;

const FILLER = /^(upright|extended|isolated|vintage|antique|old|new|small|large|big|tiny|giant|front|side|back|top|view|profile|elevation|right|left|up|down|open|closed|full|empty|sealed|mounted|floating|resting|facing|horizontal|vertical|orientation|style|shaped|forward|ancient|modern|classic|traditional|wooden|metal|brass|golden|silver|red|blue|green|black|white|brown|yellow|orange|pink|purple|grey|gray|glowing|shiny|single|pair|set|two|three|cartoon|realistic|flat|detailed|simple|3d|leath|tr|transpare|back|marble|stone|brick|steel|iron|wood|clay|glass|concrete|granite|sandstone|plastic|copper|bronze|gold|leather|fabric|paper)$/;

export function classify(words: string[]): { type: AssetType | 'scene'; holes: boolean } {
  const text = words.join(' ');
  const holes = HOLES.test(text);
  if (KW[0][1].test(text)) return { type: 'scene', holes };
  // the subject is the LAST matching noun before the first action word ("black emperor SCORPION standing")
  const cut = words.findIndex((w, i) => i > 0 && ACTION.test(w));
  const head = cut > 0 ? words.slice(0, cut) : words;
  // objects whose names contain building/person words — judged on the subject part only, so
  // "warrior holding spear" stays a person while "gold bullion pyramid" is an object
  if (OBJECT_PHRASES.test(head.join(' '))) return { type: 'object', holes };
  let best: { type: AssetType; at: number } | null = null;
  for (const [type, re] of KW.slice(1)) {
    head.forEach((w, i) => {
      if (re.test(w) && (!best || i > best.at)) best = { type: type as AssetType, at: i };
    });
  }
  if (best) {
    // the thing itself is the head's final noun (skip trailing adjectives/adverbs: "claw hammer UPRIGHT");
    // if that noun is an unknown object word ("carpenter claw HAMMER", "knight SWORD"), it's a prop, not a person
    let end = head.length - 1;
    while (end > 0 && (FILLER.test(head[end]) || /ly$/.test(head[end]))) end--;
    const finalWord = head[end];
    const finalKnown = KW.slice(1).some(([, re]) => re.test(finalWord));
    // only people get overridden — tools and gear are named after their user ("carpenter hammer", "knight sword");
    // animals / plants / buildings keep their match ("eagle soaring flight", "cathedral stone facade")
    const b = best as { type: AssetType; at: number };
    if (b.type === 'person' && !finalKnown && end > b.at && !/(ing|ed)$/.test(finalWord)) return { type: 'object', holes };
    return { type: (best as { type: AssetType }).type, holes };
  }
  for (const [type, re] of KW.slice(1)) if (re.test(text)) return { type: type as AssetType, holes };
  return { type: 'object', holes };
}

export interface ImportResult {
  file: string;
  url?: string;
  category?: string;
  kind?: 'sprite' | 'scene';
  removed?: number;
  flag?: string; // needs a human look
  error?: string;
}

export async function importFolder(
  dir: string,
  opts: { source: string; licence?: string; move?: boolean },
  onEach?: (done: number, total: number, r: ImportResult) => void
): Promise<ImportResult[]> {
  const files = fs.readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
  const out: ImportResult[] = [];
  for (const [n, f] of files.entries()) {
    const r: ImportResult = { file: f };
    try {
      const words = cleanName(f);
      const { type, holes } = classify(words);
      const cut = await cutout(path.join(dir, f), { holes });
      const isScene = type === 'scene' || cut.kind === 'scene';
      const folder = isScene ? 'backgrounds' : CATEGORY_OF[type as AssetType];
      const base = words.filter((w) => !NAME_SKIP.test(w)).slice(0, 6).join('_') || 'imported';
      let dest = path.join(ASSETS_DIR, folder, `${base}.png`);
      for (let k = 2; fs.existsSync(dest); k++) dest = path.join(ASSETS_DIR, folder, `${base}_${k}.png`);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      // scenes keep the original picture; sprites get the cut-out
      if (isScene && cut.kind === 'sprite') {
        const sharp = (await import('sharp')).default;
        fs.writeFileSync(dest, await sharp(path.join(dir, f)).png().toBuffer());
      } else {
        fs.writeFileSync(dest, cut.png);
      }
      const url = `/media/assets/${path.relative(ASSETS_DIR, dest).split(path.sep).map(encodeURIComponent).join('/')}`;
      setLicence(url, { source: `${opts.source} (${f})`, licence: opts.licence || 'unverified' });
      if (opts.move) fs.rmSync(path.join(dir, f));
      Object.assign(r, { url, category: folder, kind: isScene ? 'scene' : 'sprite', removed: cut.removed });
      // low-confidence results worth a look
      if (!isScene && cut.removed < 0.15) r.flag = 'little background removed';
      else if (!isScene && /checker/.test(cut.note ?? '')) r.flag = cut.note;
    } catch (err) {
      r.error = err instanceof Error ? err.message : String(err);
    }
    out.push(r);
    onEach?.(n + 1, files.length, r);
  }
  return out;
}
