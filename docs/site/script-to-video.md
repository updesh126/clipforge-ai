# Script → video

Paste a script and get a finished, editable video. Your exact words are always the narration.

## Looks

| Look | What you get |
|---|---|
| **Story** | Each scene gets its own place and characters, a 2.5D camera move and a transition between scenes |
| **Infographic** | Art-style backdrops with counting stats, charts, highlighted quotes and banners |

## Illustration (Story look)

| Option | Engine | Best for |
|---|---|---|
| **Vector** | ClipForge's procedural engine | Fast, animated characters that walk, wave and change expression |
| **AI painting** | Local Stable Diffusion (ComfyUI) | Rich, painted scenes that match the art-style samples |

With **AI painting**, every scene becomes one painted frame with a slow Ken Burns drift, the planned camera move, and motion graphics matched to the art style:

- **Atmosphere** — a see-through overlay chosen from the narration first (rain, snow, fireflies, lamps → embers, festivals → confetti, mist → fog, magic → sparks, stars, sunrise → light rays), otherwise from the style's own list (for example fog for ink wash, embers for shadow puppet).
- **Transitions** — each style hands one scene to the next in its own way: paper tear for paper cutout, grid wipe for stained glass, a soft dip for ink wash, iris for storybook.
- **Titles and quotes** — a style-matched banner, sized from the shorter side of the frame so it stays small in both 9:16 and 16:9; long lines wrap instead of shrinking. The same character descriptions and the same seed are used in every scene, so people keep their look. Paintings are cached in `data/generated/`, so re-running a script costs nothing.

## Watching it being made

While the video is built, the progress card shows:

- **Scene** — which scene is being made, e.g. *2 of 5*
- **Painted** — how many AI paintings are finished
- **Brush steps** — the current painting's sampler step, e.g. *17 / 28*
- **The painting itself**, sharpening live from noise to the final picture
- **A filmstrip** with one slot per scene: finished paintings, the one in progress, and the ones still to come

Live previews need ComfyUI to be started by ClipForge (it adds `--preview-method taesd`). If you start ComfyUI yourself, add that flag to see the live picture; the counters work either way.

## What happens when you click Create

1. The script is split into scenes.
2. Ollama plans each scene: place, time of day, characters, camera move and an optional graphic.
3. Each scene is voiced (Kokoro, or your system voice).
4. Whisper times every spoken word, so captions match the voice exactly.
5. Scenes are drawn (Vector) or painted (AI painting).
6. The edit opens in the editor.

## Options

| Option | Values |
|---|---|
| Art style | Auto (AI picks), Mix all, or one of 14 styles — see [Art styles](#/docs/art-styles) |
| Format | 9:16, 1:1, 4:5, 16:9 |
| Voice | Kokoro voices, or Windows voices (Hindi supported) |
| Captions | Karaoke, Pop, Bold, Clean or Off |

For writing tips, read the [script guide](#/docs/script-guide).
