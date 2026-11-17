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

With **AI painting**, every scene becomes one painted frame with a slow Ken Burns drift and the planned camera move. The same character descriptions and the same seed are used in every scene, so people keep their look. Paintings are cached in `data/generated/`, so re-running a script costs nothing.

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
