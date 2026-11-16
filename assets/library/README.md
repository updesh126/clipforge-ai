# ClipForge asset library

Drop transparent PNGs into these folders and ClipForge will find them by file name:

- characters/  people (e.g. `farmer.png`, `old_woman_with_stick.png`)
- animals/     e.g. `elephant.png`, `tiger_walking.png`
- birds/       e.g. `peacock.png`
- nature/      trees, mountains, rocks, flowers
- buildings/   houses, temples, towers
- props/       objects (boat, car, lamp…)
- backgrounds/ full scenes (1080×1920 or 1920×1080 works best)

Words in the file name become search tags. Characters should face right and stand on the bottom edge.

## Quick import: inbox/
Drop downloaded PNGs (e.g. from CleanPNG) into `inbox/`. ClipForge strips site prefixes and ids from the
file name (`kisspng-elephant-clip-art-5a3b….png` → `animals/elephant.png`), sorts it into the right folder and
marks it **unverified**. Story videos then use it instead of the drawn version.

## Licences
Your licence notes are kept in `licences.json` (tracked in git). Set them in the editor's Assets tab.
Rendering a video that uses an unverified or personal-use-only PNG shows a warning.
CleanPNG says licences differ per image — open each image page and check before using it in client work.
`generated/` holds assets ClipForge drew itself — they are reused in future videos.

Only add images you have the right to use (your own, CC0 / public domain, or properly licensed).
