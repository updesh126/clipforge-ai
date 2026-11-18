# Script → video

Paste a script and get a finished, editable video. Your exact words are always the narration.

## Direct scenes with [tags]

Add **[tags]** anywhere in a scene to choose its motion graphic, camera move, transition or atmosphere yourself — they're never spoken or shown in captions:

```text
The storm hits the village at night. [rainFx] [shake] [transition: paperTearTransition]
This year the village collected 120 thousand litres of rain water. [bigStat]
```

Every name, its settings and tips for the best output: [Script tags](#/docs/script-tags).

## Video type

Pick what kind of video you're making first. It sets the art style, captions and Motion for you (change any of them afterwards) and tells the planner which motion graphics fit:

| Type | Style it picks | Captions | Motion graphics it uses |
|---|---|---|---|
| **Storytelling** | Children's storybook (also paper cutout, Warli, Madhubani, hand-drawn) | Karaoke | Characters and places; a title banner; a quote card only for a real quotation |
| **Documentary** | Explainer collage (also hand-drawn, ink wash, miniature, ukiyo-e, stained glass) | Clean | Paper title; timelines from the years you mention, a real world map when a line names a country or big city, quote cards, big stats, news headlines |
| **Fun** | Cartoon (also anime, paper cutout) | Pop | Question reveals, myth vs fact, countdowns; confetti and sparks |
| **Tech explainer** | Flat vector (also explainer collage, blueprint) | Bold | Paper title; process steps ("first… then… finally"), comparisons ("in 2016… by 2024…"), charts, cause and effect |

The graphics are built only from facts in your narration — every number and year on screen is one you wrote. Write them out plainly: "In 2016 it handled 0.1 million; by 2024 over 13,000 million" becomes a comparison, "First… then… finally…" becomes a process diagram, two or more years become a timeline.


## Explainer accents (documentary, tech, fun)

Between the full-screen explainers, ClipForge adds small hand-made accents on top of the picture, built only from words that are actually said:

| The line says… | Accent |
|---|---|
| "Ten years ago … today …" | Then-vs-now panel (grey past, yellow present in the collage style) |
| "Name Surname, a role," | Lower-third with name and role |
| "reported / announced / headline" | Newspaper zoom with the phrase highlighted (generic masthead) |
| "banned / approved / fake / official…" | Rubber stamp |
| "A, B and C" | Sticker list, one chip per item |
| "the first / biggest / record / more than…" | Marker highlight on that phrase |
| "But… / However… / Surprisingly…" | Handwritten note |

Never on the title scene, never two in a row, and never on a scene that already has an explainer or a graphic you tagged yourself. Documentaries now allow a full-screen explainer every second scene, including evidence, historical progression, map comparison, photo investigation and a final conclusion.

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

## Motion: moving scenes

With **AI painting** on, tick **Motion — bring paintings to life**. After each scene is painted, LTX-Video (image-to-video, also through ComfyUI) turns the painting into a short clip — people move and breathe, leaves sway, lights flicker, and the camera drifts the way the scene plans. Because the clip starts from ClipForge's own painting, the art style and characters stay the same.

- Each clip is made as long as its scene (up to 8 seconds) at 30 fps and plays at normal speed, so motion is smooth with no repeated frames. The still painting stays underneath, so a longer scene never shows a blank frame.
- **Which scenes move:** **Mix** (default) animates only the scenes where something actually moves — action (walks, runs, dances, rows, pours…), moving nature (water, rain, fire, wind, birds, fireflies), the opening hook and the ending — about 40% of scenes, never leaving more than two still scenes in a row. Quiet moments (sleeping, thinking, remembering) and scenes covered by a full-screen graphic stay as paintings. It takes about half the time of **All scenes**. The progress card marks moving scenes with ▶.
- For steady pictures the model keeps a **locked-off camera** (ClipForge adds its own gentle camera move), and every clip gets a deflicker pass with FFmpeg before it's used.
- Choose **Fast** (LTX-Video, about a minute per scene) or **Best** (Wan 2.2, smoother, several minutes per scene) when both are installed. Install them with `npm run comfy:setup -- -Motion ltx` / `wan` / `both`.
- If the model isn't installed, or one clip fails, that scene simply stays a still painting.
- Clips are cached in `data/generated/` like paintings.

## Watching it being made

While the video is built, the progress card shows:

- **Scene** — which scene is being made, e.g. *2 of 5*
- **Painted** — how many AI paintings are finished
- **Brush steps** — the current painting's sampler step, e.g. *17 / 28*
- **The painting itself**, sharpening live from noise to the final picture
- **A filmstrip** with one slot per scene: finished paintings, the one in progress, and the ones still to come

Live previews need ComfyUI to be started by ClipForge (it adds `--preview-method taesd`). If you start ComfyUI yourself, add that flag to see the live picture; the counters work either way.

## Cancelling

Press **Cancel** on the progress card. Within a few seconds ClipForge stops everything it is doing for the video, but leaves every app running and connected:

| What | What Cancel does | Keeps running |
|---|---|---|
| Ollama (planning, storyboard) | aborts the request, so Ollama stops generating | the Ollama app and its loaded model |
| ComfyUI (paintings, Motion clips) | interrupts the current job and clears its queue | the ComfyUI server |
| Voice-over, Whisper, FFmpeg | ends those helper processes | — |
| ClipForge | stops the run; your script stays on the page | the app |

If you cancel a job inside ComfyUI itself, ClipForge notices within seconds and says so.

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
| Art style | Auto (AI picks), Mix all, or one of 15 styles — see [Art styles](#/docs/art-styles) |
| Format | 9:16, 1:1, 4:5, 16:9 |
| Voice | Kokoro voices, or Windows voices (Hindi supported) |
| Captions | Karaoke, Pop, Bold, Clean or Off |

For writing tips, read the [script guide](#/docs/script-guide).
