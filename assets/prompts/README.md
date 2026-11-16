# ClipForge asset prompts

> Generated from `src/assetkit/catalog.ts` by `npm run prompts` — re-run after adding recipes.

Image-generation prompts for every art style and every asset, so PNGs made in any image tool (local Stable Diffusion / ComfyUI, or a tool you are licensed to use) match ClipForge. Save results into `assets/library/<folder>/` — ClipForge finds them by file name and animates them in Story videos. Anything missing is drawn automatically.

## One file per style

- [Flat colour (default)](flat.md) — clean flat vector illustration
- [Madhubani (Mithila folk art, Bihar)](madhubani.md) — Madhubani Mithila folk painting
- [Ink wash (sumi-e)](inkWash.md) — traditional East Asian ink wash painting
- [Shadow puppet (Tholu Bommalata / wayang kulit)](shadowPuppet.md) — traditional leather shadow puppet silhouette
- [Paper cutout](paperCutout.md) — layered paper cut-out craft illustration
- [Stained glass](stainedGlass.md) — stained glass window art
- [Anime / cel animation](anime.md) — Japanese anime cel-shaded illustration
- [Warli (Maharashtra tribal art)](warli.md) — Warli tribal painting
- [Blueprint / technical drawing](blueprint.md) — engineering blueprint technical drawing
- [Ukiyo-e (Japanese woodblock print)](ukiyoe.md) — ukiyo-e Japanese woodblock print
- [Miniature painting (Mughal / Rajput)](miniature.md) — Indian miniature painting

### Single-file Atlas

- [Objects & Props Atlas (all 11 styles in one file)](OBJECTS_ATLAS.md) — 198 copy-paste prompts for all objects and props across every art style.

Each style file has a complete, ready-to-paste prompt for every person, animal, bird, plant, building, prop and background listed below.

## How a prompt is built

```
<SUBJECT>, <STYLE PROMPT>, colour palette: <STYLE PALETTE>, <SPRITE or BACKGROUND RULES>
Negative: <NEGATIVE PROMPT>, <STYLE AVOID>
```

## Output rules

| | Sprites (people, animals, birds, nature, buildings, props) | Backgrounds |
|---|---|---|
| Size | 1024 × 1024 (square) | 1080 × 1920 (9:16) and 1920 × 1080 (16:9) |
| Format | PNG **with transparency** | PNG or JPG, no transparency |
| Facing | Characters and animals face **right** (ClipForge mirrors them when needed) | — |
| Placement | Feet / base on the bottom edge, centred | Horizon ~60% down, open ground at the bottom |
| File name | `assets/library/characters/farmer_madhubani.png` — words become search tags; add the style id to keep styles apart | `assets/library/backgrounds/village_madhubani_9x16.png` |

**Sprite rules:** single subject only, isolated on a fully transparent background (PNG with alpha), centred, whole subject in frame with a small margin, feet / base touching the bottom edge, no ground, no cast shadow, no text, no watermark, no border

**Background rules:** full-bleed scene with no transparency, horizon around 60% down, open ground in the lower third for characters, no people, no animals, no text, no watermark

**Negative prompt (all):** text, letters, watermark, signature, logo, frame, border, multiple subjects, cropped, cut off, blurry, photo, photorealistic, 3d render, extra limbs, deformed hands

**Rights:** only add images you created or are licensed to use commercially. Do not prompt for existing copyrighted characters, brands or specific famous artworks.

## Subjects (style-neutral)

### People — `assets/library/characters/`

| Name | Also matches | Subject prompt |
|---|---|---|
| **farmer** | villager, peasant, grower, cultivator, man | a farmer, wearing a white kurta and white dhoti, an orange turban, a beard, holding a wooden staff, standing upright, warm skin, full body, three-quarter view facing right |
| **woman** | lady, mother, girl, female, wife | a woman, wearing an amber saree with a red blouse, dark hair in a bun, standing upright, warm skin, full body, three-quarter view facing right |
| **village woman** | woman carrying water, water carrier | a village woman, wearing an orange saree with a green blouse, dark hair in a bun, holding a clay water pot, standing upright, warm skin, full body, three-quarter view facing right |
| **child** | kid, boy, son, student, children | a young child, wearing an amber shirt and blue trousers, short dark hair, waving one hand, warm skin, full body, three-quarter view facing right |
| **girl** | daughter, little girl | a young girl, wearing a pink top and purple skirt, long dark hair, arms raised in celebration, warm skin, full body, three-quarter view facing right |
| **elder** | old man, grandfather, grandpa, sage, wise man | an elderly man, wearing a white kurta and white dhoti, a beard, round glasses, holding a wooden staff, standing upright, warm skin, full body, three-quarter view facing right |
| **grandmother** | old woman, grandma, granny | an elderly woman, wearing a grey saree with a white blouse, grey hair in a bun, standing upright, warm skin, full body, three-quarter view facing right |
| **scientist** | researcher, doctor, expert, professor | a scientist, wearing a white shirt and dark blue trousers, short dark hair, round glasses, holding a book, standing upright, warm skin, full body, three-quarter view facing right |
| **teacher** | educator, mentor | a teacher, wearing a dark blue saree with a blue blouse, dark hair in a bun, holding a book, standing upright, warm skin, full body, three-quarter view facing right |
| **worker** | labourer, builder, engineer, construction | a worker, wearing an amber shirt and dark blue trousers, a helmet, standing upright, warm skin, full body, three-quarter view facing right |
| **king** | raja, emperor, ruler, maharaja | a king, wearing a long red robe, a crown, a beard, holding a sword, standing upright, warm skin, full body, three-quarter view facing right |
| **queen** | rani, empress, princess | a queen, wearing an amber saree with a purple blouse, a crown, standing upright, warm skin, full body, three-quarter view facing right |
| **monk** | saint, yogi, priest, buddha | a monk, wearing a long orange robe, shaved head, standing upright, warm skin, full body, three-quarter view facing right |
| **soldier** | warrior, army, guard | a soldier, wearing a dark green shirt and dark green trousers, a dark green helmet, holding a flag, standing upright, warm skin, full body, three-quarter view facing right |
| **fisherman** | fisher, boatman, sailor | a fisherman, wearing a blue kurta and white dhoti, a hat, holding a basket, standing upright, brown skin, full body, three-quarter view facing right |
| **businessman** | entrepreneur, manager, office worker, professional, man in suit | a businessman, wearing a dark blue shirt and black trousers, short dark hair, holding a phone, standing upright, warm skin, full body, three-quarter view facing right |
| **speaker** | presenter, narrator, host, person, people | a speaker, wearing a teal shirt and dark blue trousers, short dark hair, pointing to the right, warm skin, full body, three-quarter view facing right |
| **dancer** | performer, celebration | a dancer, wearing a red top and amber skirt, dark hair in a bun, arms raised in celebration, warm skin, full body, three-quarter view facing right |
| **traveller** | traveler, pilgrim, explorer, hiker, wanderer | a traveller, wearing an orange shirt and dark blue trousers, a hat, holding a wooden staff, walking to the right, warm skin, full body, three-quarter view facing right |

### Animals — `assets/library/animals/`

| Name | Also matches | Subject prompt |
|---|---|---|
| **elephant** | tusker, haathi | an elephant, grey body, long trunk, ivory tusks, standing on all four legs, full body in side profile facing right |
| **tiger** | big cat, bengal tiger | a tiger, orange body, black stripes, standing on all four legs, full body in side profile facing right |
| **lion** | king of the jungle | a lion, amber body, full mane, standing on all four legs, full body in side profile facing right |
| **leopard** | cheetah, jaguar | a leopard, amber body, dark brown spots, standing on all four legs, full body in side profile facing right |
| **cow** | cattle, bull, ox, buffalo | a cow, white body, dark brown spots, short horns, standing on all four legs, full body in side profile facing right |
| **deer** | stag, antelope | a deer, orange body, white spots, antlers horns, standing on all four legs, full body in side profile facing right |
| **horse** | pony, stallion, mare | a horse, brown body, standing on all four legs, full body in side profile facing right |
| **camel** | dromedary | a camel, amber body, two humps, standing on all four legs, full body in side profile facing right |
| **giraffe** | — | a giraffe, amber body, brown spots, short horns, standing on all four legs, full body in side profile facing right |
| **dog** | puppy, hound | a dog, orange body, standing on all four legs, full body in side profile facing right |
| **cat** | kitten | a cat, grey body, standing on all four legs, full body in side profile facing right |
| **goat** | sheep, lamb | a goat, white body, curved horns, standing on all four legs, full body in side profile facing right |
| **bear** | panda | a bear, dark red body, standing on all four legs, full body in side profile facing right |
| **rabbit** | hare, bunny | a rabbit, white body, standing on all four legs, full body in side profile facing right |
| **monkey** | ape, langur | a monkey, brown body, standing on all four legs, full body in side profile facing right |
| **zebra** | — | a zebra, white body, black stripes, standing on all four legs, full body in side profile facing right |
| **fish** | fishes, carp, goldfish | a fish, amber body, orange fins, red stripes, side view facing left |

### Birds — `assets/library/birds/`

| Name | Also matches | Subject prompt |
|---|---|---|
| **peacock** | peafowl, mor | a peacock, blue body, teal wings, tail feathers spread in a full fan with eye spots, small crest, perched, side view facing right |
| **crow** | raven, blackbird | a crow, black body, black wings, perched, side view facing right |
| **parrot** | parakeet | a parrot, green body, green wings, long tail, perched, side view facing right |
| **eagle** | hawk, kite bird, falcon | an eagle, dark red body, dark red wings, wings spread in flight, side view facing right |
| **bird** | birds, sparrow, flying bird | a bird, orange body, amber wings, wings spread in flight, side view facing right |
| **swan** | duck, goose, crane | a swan, white body, white wings, perched, side view facing right |

### Nature — `assets/library/nature/`

| Name | Also matches | Subject prompt |
|---|---|---|
| **tree** | trees, oak, mango tree | a single leafy tree with a round crown, full tree from roots to top |
| **banyan tree** | banyan, peepal, big tree | a single wide banyan tree with hanging aerial roots, full tree from roots to top |
| **pine tree** | pine, fir, conifer, deodar | a single tall conifer pine tree, full tree from roots to top |
| **palm tree** | palm, coconut tree | a single coconut palm tree, full tree from roots to top |
| **bamboo** | — | a single cluster of bamboo stalks with leaves, full tree from roots to top |
| **blossom tree** | cherry blossom, flowering tree, spring tree | a single tree covered in pink blossoms, full tree from roots to top |
| **dead tree** | bare tree, drought tree | a single leafless bare tree, full tree from roots to top |
| **mountain** | mountains, peak, himalaya | a group of mountain peaks with snow caps, isolated |

### Buildings — `assets/library/buildings/`

| Name | Also matches | Subject prompt |
|---|---|---|
| **house** | home | a small house with a sloped roof,  walls, front view, whole building |
| **hut** | village hut, cottage | a village mud hut with a thatched roof,  walls, front view, whole building |
| **temple** | mandir, shrine | an Indian Hindu temple with a tall shikhara spire and flag, pale amber walls, orange roof, front view, whole building |
| **mosque** | masjid, dome | a mosque with a dome and two minarets, white walls, green roof, front view, whole building |
| **skyscraper** | building, office, tower block | a modern glass office skyscraper, blue walls, front view, whole building |
| **factory** | industry, plant, mill, pollution | a factory with a chimney,  walls, front view, whole building |
| **school** | college, classroom | a village school building with a flag, pale amber walls, red roof, front view, whole building |
| **castle** | fort, palace, qila | a stone fort with battlements, orange walls, front view, whole building |
| **lighthouse** | — | a striped lighthouse, white walls, red roof, front view, whole building |

### Objects & props — `assets/library/props/`

| Name | Also matches | Subject prompt |
|---|---|---|
| **rock** | stone, boulder | a large boulder, single object, centred |
| **flower** | flowers, lotus, rose | a pink lotus flower on a stem, single object, centred |
| **cloud** | clouds, rain cloud, monsoon cloud | a fluffy cloud, single object, centred |
| **sun** | sunrise, sunlight | a shining sun with rays, single object, centred |
| **moon** | night, crescent | a crescent moon, single object, centred |
| **star** | stars | a five-pointed star, single object, centred |
| **water drop** | water, drop, rain, raindrop | a water drop, single object, centred |
| **leaf** | leaves, plant | a single green leaf, single object, centred |
| **boat** | ship, sailboat | a brown wooden river boat with a single sail, single object, centred |
| **car** | vehicle, taxi, traffic | a red small family car, side view, single object, centred |
| **tractor** | farming machine | a red farm tractor, side view, single object, centred |
| **bicycle** | cycle, bike | a blue bicycle, side view, single object, centred |
| **kite** | patang | an orange diamond-shaped paper kite with a tail, single object, centred |
| **book** | books, knowledge, study | a red open book, single object, centred |
| **globe** | earth, world, planet | a globe of the Earth, single object, centred |
| **pot** | matka, vessel, pitcher | a clay water pot (matka), single object, centred |
| **diya** | lamp, oil lamp, diwali, light | a clay oil lamp (diya) with a lit flame, single object, centred |
| **heart** | love | a heart shape, single object, centred |

### Backgrounds — `assets/library/backgrounds/`

| Name | Also matches | Subject prompt |
|---|---|---|
| **village** | countryside, rural, gaon | wide establishing landscape of an Indian village: rolling hills, village huts and a banyan tree, farm fields, daylight, empty foreground with open ground for characters to stand on, no people, no animals |
| **forest** | jungle, woods | wide establishing landscape of a forest: rolling hills, dense forest, daylight, empty foreground with open ground for characters to stand on, no people, no animals |
| **himalaya** | himalayas, snow mountains, mountain range, peaks | wide establishing landscape of the Himalayas: snow-capped mountain range, daylight, empty foreground with open ground for characters to stand on, no people, no animals |
| **glacier** | ice, snow, melting ice | wide establishing landscape of a glacier: a glacier, snow-capped mountain range, daylight, empty foreground with open ground for characters to stand on, no people, no animals |
| **river valley** | river, riverbank, ganga, valley, stream | wide establishing landscape of a river valley: distant mountains, rolling hills, a winding river, daylight, empty foreground with open ground for characters to stand on, no people, no animals |
| **ocean** | sea, coast, beach, waves | wide establishing landscape of the ocean: open sea with waves, soft clouds, daylight, empty foreground with open ground for characters to stand on, no people, no animals |
| **city** | urban, town, metro | wide establishing landscape of a city: city skyline, daylight, empty foreground with open ground for characters to stand on, no people, no animals |
| **desert** | sand, thar, drought, dry land | wide establishing landscape of a desert: sand dunes, daylight, empty foreground with open ground for characters to stand on, no people, no animals |
| **farm** | field, crops, agriculture, paddy | wide establishing landscape of farmland: rolling hills, farm fields, daylight, empty foreground with open ground for characters to stand on, no people, no animals |
| **night sky** | night, stars, evening | wide establishing landscape of a village under the night sky: rolling hills, night light, empty foreground with open ground for characters to stand on, no people, no animals |
| **temple town** | temple, pilgrimage, varanasi, ghats | wide establishing landscape of a temple town: rolling hills, a temple on the horizon, sunset light, empty foreground with open ground for characters to stand on, no people, no animals |
| **sky** | open sky, heaven, air | wide establishing landscape of an open sky: soft clouds, daylight, empty foreground with open ground for characters to stand on, no people, no animals |
| **sunset hills** | sunset, dusk, evening hills | wide establishing landscape of hills at sunset: rolling hills, sunset light, empty foreground with open ground for characters to stand on, no people, no animals |
