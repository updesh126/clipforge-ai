# ClipForge AI

Free, open-source, local-first AI video clipper **and timeline editor** — an offline alternative to Vizard, Wayin and Opus Clip.
Pick a long video, get ranked vertical clips with captions. Everything runs on your own computer: no cloud, no API keys, no watermark, no file size limit.

> 📖 **Full documentation is built in:** run the app and open **Docs** in the top bar (`http://localhost:3000/#/docs`).
> Pages live in [`docs/site/`](docs/site/) — getting started, script → video, art styles, Stable Diffusion setup, editor, shortcuts, export, settings, API reference and FAQ.

---

## Features

- **AI painting (optional)** — paint every story scene with local **Stable Diffusion** (SDXL via ComfyUI) in any of the 14 art styles, with the same characters and seed in every scene. One-script setup: `scripts/setup-comfyui.ps1`. See [docs/site/stable-diffusion.md](docs/site/stable-diffusion.md)
- **Art-style specs** — one detailed JSON per style in [`src/artstyles/`](src/artstyles/) (palette, line, texture, characters, composition, motion, prompt modifiers and negative prompts), rebuilt with `npm run artstyles`

- **Motion graphics library** — 200 explainer effects and 30 sequences (typography, charts, maps, annotations, layouts, timelines, diagrams, transitions…), all editable in the Inspector and pickable by the local AI. See [docs/MOTION_LIBRARY.md](docs/MOTION_LIBRARY.md)
- **Procedural vector engine** — story characters and places are drawn at runtime as SVG, with no stock images and no GPU. The same characters appear in every scene with real poses and expressions, in four themes (storybook, cartoon, flat vector, hand-drawn). See [docs/VECTOR_ENGINE.md](docs/VECTOR_ENGINE.md)
- **Script guide** — how to write a story script for the best pictures: [docs/STORY_SCRIPT_GUIDE.md](docs/STORY_SCRIPT_GUIDE.md) (also a "Use the story template" button on the Script page)
- **Fully automatic** — local AI transcribes the video and picks the best moments
- **Virality meter** — every clip gets a 0–100 score; clips are listed in timeline order
- **Manual clips** — add your own section at the playhead, trim In/Out, delete any clip
- **Any size, no upload** — "Select Local Video" opens your file in place (tested for 24 GB+)
- **Framing** — 9:16, 1:1, 16:9 · *Fill* (crop) or *Fit full video* (landscape inside portrait on a blurred background) · Zoom 1–3× · Pan ↔ ↕
- **Captions** — Clean, Bold, **Karaoke** (word-by-word highlight) or **Pop** (words pop in), built from Whisper word timings, plus an `.srt` file with every export
- **Motion graphics (HyperFrames)** — animated captions, a hook-title banner over the first seconds, and an optional intro card, rendered locally with HTML + GSAP
- **Voice intros (TTS)** — Kokoro-82M reads the clip title on an intro card (falls back to the system voice)
- **Live progress** — see each step (FFmpeg → Whisper → Ollama → HyperFrames) while it works; engine status in the top bar
- **Export all** — render every clip in one go, each with its own settings

### Editor (Remotion)
- **Home page** — choose *Clip* (long video → shorts), *Script* (script → narrated video) or *Edit* (full timeline editor); the logo always takes you back home

### Script → Video
Paste a script and get a finished, editable video. Two looks:
- **Story** (default) — every scene gets its own place (village, Himalaya, river valley, city…) and characters (people, animals, birds, props) that walk in, fly, sway or float, with a 2.5D camera move (push in, pan, pull out) and whip-pan / iris-wipe hand-offs between scenes
- **Infographic** — art-style backdrops with counting stats, charts, highlighter quotes and banners

Steps:
1. The script is split into scenes (your exact words are always the narration)
2. Ollama picks a visual for each scene — art title card, counting stat, bar chart, highlighter quote, quote card or caption banner — and an art style that suits the topic (or pick one yourself, or *Mix all*)
3. Every scene gets a voice-over (Kokoro AI voices if installed, otherwise your system voice)
4. Whisper times every spoken word, so karaoke captions match the voice exactly
5. It opens in the editor — change anything, use *Edit with AI*, then **Render MP4**
- **Timeline** — multi-layer tracks: drag to move, drag edges to trim, drag up/down to change layer, split (S), duplicate (Ctrl+D), undo/redo (Ctrl+Z / Ctrl+Shift+Z), snapping to the playhead and other clips
- **Live preview** — Remotion Player shows exactly what will render
- **Motion graphics** — animated title, hook banner, lower third, emoji pop, progress bar, call-to-action card, quote card
- **Vox-style explainer graphics** — torn-paper title, highlighter sweep over a document, counting stat, growing bar chart, hand-drawn callout circle
- **Art styles** — ten animated looks, each as a full-screen title card, a decorative frame over footage, or a caption banner: **Madhubani, ink wash, shadow puppet, paper cutout, stained glass, anime, Warli, blueprint, ukiyo-e, miniature painting**. All drawn procedurally (no image assets), so preview and render match exactly
- **Effects** — zoom punch, slow zoom, shake, flash, fade in/out, 2.5D camera moves (push in, pull out, pan, tilt) and scene transitions (whip pan, iris wipe)
- **Asset library** — characters, animals, birds, trees, mountains, buildings, props and full backgrounds as transparent PNGs in `assets/library/`. Anything missing is drawn on the spot in the video's art style (a Warli farmer, a Madhubani elephant, a shadow-puppet tiger…) and saved for next time. New names ("camel", "fisherwoman") are designed by your local LLM from the kit's building blocks. Drop your own PNGs into the folders to use them too. Ready-made image-generation prompts for every style and asset are in [assets/prompts](assets/prompts/README.md) (one file per style; rebuild with `npm run prompts`)
- **Edit with AI** — tell your local Ollama model what to change ("add a stat when they say 85 percent"); it reads the transcript and edits the timeline. Every AI change can be undone
- **Auto-edit a clip** — "Open in editor" on any AI clip builds the edit for you: footage, karaoke captions, hook banner, zoom punches, progress bar and end card
- **Your own media** — add videos, music and images from disk (used in place)
- **Motion & Effects library** — click a card to preview it, press **+** (or double-click) to add it at the playhead. Effects are grouped into Camera, Transitions, Particles and Light & film
- **Speed and audio fades** — play video or audio at 0.25×–4× and fade the sound in and out (Inspector)
- **Local render** — Remotion renders into `data/exports/`: **MP4** (H.264), **WebM** (VP9), **GIF**, or a **PNG still** of the playhead frame, at High, Standard or Draft (half-size) quality

> **Licence note:** Remotion is free for individuals, non-profits and for-profit companies with up to 3 people. Larger for-profit teams need a [Remotion company licence](https://www.remotion.dev/docs/license). The clipping side (FFmpeg + HyperFrames) has no such limit.
- **High quality** — 1080p exports (1080×1920 for 9:16), H.264 CRF 17, 256 kbps audio
- **YouTube import** — downloads up to 1080p via yt-dlp
- **Smooth preview** — heavy 4K/HEVC files get a light preview copy automatically (exports always use the original)

---

## 1. Install the tools (one time)

### macOS

1. Install **Homebrew** if you don't have it (it will ask for your Mac password in the terminal):
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
   Then run the two "Next steps" lines it prints (adds `brew` to your PATH).

2. Install **Node.js**, **FFmpeg (full, with caption support)**, **whisper.cpp** and **Ollama**:
   ```bash
   brew install node ffmpeg-full whisper-cpp ollama
   ```

3. Start Ollama as a background service (keeps running after restarts) and download the AI model (~1.9 GB):
   ```bash
   brew services start ollama
   ```
   ```bash
   ollama pull qwen2.5:3b
   ```

### Windows

```powershell
winget install OpenJS.NodeJS Gyan.FFmpeg Ollama.Ollama
```
Open a **new** terminal afterwards so `ffmpeg` is on your PATH.
Download `whisper-bin-x64.zip` from https://github.com/ggml-org/whisper.cpp/releases, unzip it, and add that folder to your PATH. Then run `ollama pull qwen2.5:3b`.

### Linux (Ubuntu/Debian)

```bash
sudo apt install nodejs npm ffmpeg zenity
curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen2.5:3b
```
Build whisper.cpp from https://github.com/ggml-org/whisper.cpp and put `whisper-cli` on your PATH.

---

## 2. Set up the project (one time)

```bash
cd clipforge-ai
```
```bash
npm install
```
```bash
npm run setup
```
`npm run setup` checks every tool and prints the exact install command for anything missing.

`npm install` also installs **HyperFrames** (motion captions, hook titles, intro cards). It renders with your installed Chrome, or downloads a headless Chrome the first time. Needs Node.js 22 or newer.

**Optional — AI painting (Stable Diffusion).** Needs an NVIDIA GPU with 8 GB+ VRAM (12 GB recommended). On Windows, one script downloads ComfyUI and the SDXL base model (~9 GB) — it needs 7-Zip:
```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup-comfyui.ps1
```
Then start ComfyUI with `run_nvidia_gpu.bat` and choose **Illustration → AI painting** on the Script page. Full guide: [docs/site/stable-diffusion.md](docs/site/stable-diffusion.md).

**Optional — natural AI voices.** Voice intros use your system voice by default. For Kokoro voices, install Python 3 and run:
```bash
pip install kokoro-onnx soundfile
```

The Whisper speech model (~140 MB) downloads automatically the first time you process a video.

---

## 3. Run

```bash
npm run dev
```

Open **http://localhost:3000** in your browser. The server reloads by itself when code changes.

To stop: press **Ctrl + C** in the terminal.

---

## 4. Use it

1. **Select Local Video** → choose a file in your computer's file picker (it may open behind the browser — check the Dock/taskbar). The file is used in place, never copied.
   Other ways in: paste a file path, paste a YouTube link, or try the sample.
2. Wait while it transcribes and picks clips (roughly 5–15 min per hour of video).
3. In the studio:
   - Clips are listed in time order, each with a **Virality** meter (0–100).
   - **+ Add clip** adds your own section at the playhead; the bin icon removes a clip.
   - Trim with the In/Out handles, pick 9:16 / 1:1 / 16:9, Fill or Fit full video, Zoom and Pan.
   - Choose captions: Off, Clean, Bold, ✨ Karaoke or ✨ Pop — the preview shows the word highlight live.
   - **Motion & voice** (right panel): switch on *Hook title* and/or *Voice intro*, and pick a voice.
4. **Export MP4** (or **Export all**) → watermark-free MP4 + SRT, saved in `data/exports/`. Motion exports take a little longer because HyperFrames renders each frame.

---

## Settings (optional)

Copy `.env.example` to `.env` and change what you need:

| Setting | Default | Notes |
|---|---|---|
| `PORT` | `3000` | Web app port |
| `OLLAMA_MODEL` | `qwen2.5:3b` | Lighter: `qwen2.5:1.5b`, `gemma2:2b` · Better: `llama3.1:8b` |
| `WHISPER_MODEL` | `base` | `tiny` (fastest) · `small` / `medium` (more accurate) |
| `WHISPER_LANG` | `auto` | e.g. `en`, `hi` |
| `EXPORT_CRF` | `17` | Lower = higher quality, bigger file (15–23) |
| `EXPORT_PRESET` | `medium` | `fast` = quicker export, `slow` = smaller file |
| `FFMPEG_DIR` | auto | Folder of a custom FFmpeg build |
| `HYPERFRAMES_QUALITY` | `high` | Motion render quality: `draft` · `standard` · `high` |
| `TTS_VOICE` | `af_heart` | Default Kokoro voice (`bf_emma`, `am_adam`, `bm_george` …) |
| `HYPERFRAMES_PYTHON` | auto | Python that has `kokoro-onnx` installed |
| `HYPERFRAMES_WHISPER_PATH` | — | Windows: path to `whisper-cli.exe` if it isn't on PATH |
| `CLIPFORGE_DATA_DIR` | `./data` | Keep projects, models and exports on another drive |
| `OLLAMA_EDIT_MODEL` | `OLLAMA_MODEL` | Model for *Edit with AI*. 4B+ models work much better: `qwen3.5:4b`, `qwen2.5:7b` |
| `WHISPER_BIN` | `whisper-cli` | Full path to `whisper-cli` if it isn't on PATH |
| `SD_URL` | `http://127.0.0.1:8188` | ComfyUI address for AI painting |
| `SD_CHECKPOINT` | first SDXL model | Checkpoint file name as ComfyUI lists it |
| `SD_STEPS` / `SD_CFG` | `28` / `6` | Use `6` / `2` for Lightning or Turbo models |

**Low-spec PC?** Use `WHISPER_MODEL=tiny` and `OLLAMA_MODEL=qwen2.5:1.5b`.
**No Ollama?** ClipForge still works — a built-in scorer picks clips automatically.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `address already in use :3000` | Another copy is running. Close it, or run `PORT=3001 npm run dev` |
| Log says "Ollama unavailable, using heuristic" | Start Ollama: `brew services start ollama` |
| Captions not burned into the video | Install the full FFmpeg: `brew install ffmpeg-full` |
| `File too large` | You're on old server code — stop with Ctrl + C and run `npm run dev` again |
| File picker doesn't appear | It may be behind the browser window — check the Dock/taskbar |
| YouTube video looks blurry | Re-import it; older imports were saved at 360p |
| Export says "HyperFrames render failed, used FFmpeg instead" | The clip still exported with FFmpeg captions. Run `npx hyperframes doctor` to see what's missing (usually Chrome or FFmpeg) |
| Voice intro sounds robotic | That's the system voice — install Kokoro: `pip install kokoro-onnx soundfile` |
| *Edit with AI* ignores what I asked | Small models struggle — set `OLLAMA_EDIT_MODEL=qwen3.5:4b` (or bigger) in `.env`. Name the exact words spoken ("when they say …") |
| First editor render is slow | Remotion bundles the graphics and fetches headless Chrome once; later renders are faster |
| *AI painting* says Stable Diffusion is not running | Start ComfyUI (`run_nvidia_gpu.bat`) and keep its window open — see [Stable Diffusion setup](docs/site/stable-diffusion.md) |
| Tool installed but setup still says ✘ | Fixed automatically on Windows (the latest PATH is read at start). Otherwise open a new terminal |

---

## How it works

```
your video (used in place)
  └─ FFmpeg ─▶ 16 kHz audio ─▶ Whisper ─▶ word-level transcript
        └─ Ollama (qwen2.5:3b) scores highlight windows 0–100   (fallback: built-in heuristic)
              └─ snap to sentences, drop overlaps, sort by time ─▶ studio
                    └─ FFmpeg: crop/fit, zoom, pan ─▶ framed clip
                          ├─ plain styles: FFmpeg burns ASS captions ─▶ 1080p MP4 + SRT
                          └─ karaoke / pop / hook title / voice intro:
                               Kokoro TTS ─▶ intro voice
                               HyperFrames (HTML + GSAP in headless Chrome) ─▶ motion layer
                               FFmpeg mixes original audio + voice ─▶ 1080p MP4 + SRT
```

All data stays in `./data` (uploads, exports, models, AI paintings in `generated/`, `projects.json`). Full design notes: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Sources & credits

Every tool, model, library, asset site and reference — with icons, links and licences — is listed in [SOURCES.md](SOURCES.md). Check the ⚠️ rows before client work (Remotion company licence, Qwen 2.5 3B `qwen-research` licence, pngimg non-commercial).

## License

MIT — free to use, modify and share.
