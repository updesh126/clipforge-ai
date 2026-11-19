# ClipForge AI

Free, open-source, local-first AI video clipper **and timeline editor** — an offline alternative to Vizard, Wayin and Opus Clip.
Pick a long video, get ranked vertical clips with captions. Everything runs on your own computer: no cloud, no API keys, no watermark, no file size limit.

> 📖 **Full documentation is built in:** run the app and open **Docs** in the top bar (`http://localhost:3000/#/docs`).
> Pages live in [`docs/site/`](docs/site/) — getting started, script → video, art styles, Stable Diffusion setup, editor, shortcuts, export, settings, API reference and FAQ.

---

## Features

- **AI painting (optional)** — paint every story scene with local **Stable Diffusion** (SDXL via ComfyUI) in any of the 15 art styles, with the same characters and seed in every scene. One-command setup: `npm run comfy:setup`, then it starts automatically with `npm run dev`. See [docs/site/stable-diffusion.md](docs/site/stable-diffusion.md)
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

### Script Writer
Paste a YouTube link and get a **new, more hooked script** with effect [tags], plus a YouTube title, description and tags. Every fact from the video is kept, the source channel's promotion is left out, and everything is saved as `.md` and `.txt` in `data/scripts/` (with the facts and the original transcript). **Make this video** sends the script to Script → Video. Details: [docs/site/script-writer.md](docs/site/script-writer.md).

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

## Setup

Everything runs on your own computer. Setup is a one-time job of 15–60 minutes, most of it downloads.

### What you need

| | Minimum | Recommended |
|---|---|---|
| System | Windows 10/11, macOS 13+, or Ubuntu/Debian Linux | Windows 11 or macOS on Apple silicon |
| Memory | 8 GB RAM | 16 GB+ RAM |
| Disk | 10 GB free | 40 GB free, if you want AI painting and Motion |
| Graphics | Any (vector art and clipping need no GPU) | NVIDIA with 12 GB VRAM for AI painting and Motion (an RTX 3060 12 GB works) |
| Software | **Node.js 22+** and **git** | — |

### One-click setup

- **Windows:** double-click **`setup.cmd`** in the project folder. It installs Node.js if needed, then everything else, then starts ClipForge and opens your browser.
- **macOS / Linux:** run `sh setup.sh`.

Afterwards, start ClipForge any day with **`start.cmd`** (Windows) or `npm run dev`.

Stable Diffusion (ComfyUI) and its models are **always installed outside the project folder**: an existing `..\ComfyUI`, otherwise `%LOCALAPPDATA%\ClipForge\ComfyUI` on Windows (`~/ClipForge/ComfyUI` on macOS/Linux). So the project stays small and nothing big ends up in git.

### Quick start: the setup wizard (step by step)

```bash
git clone <this repo> clipforge-ai
```

```bash
cd clipforge-ai
```

```bash
npm install
```

```bash
npm run setup
```

`npm run setup` goes through every engine in order. For each one it says what it's for, checks whether it's there, and **asks before installing** it with your system's own tool (winget on Windows, Homebrew on macOS, apt on Linux). It also creates `.env`, downloads models, starts ComfyUI in the background when it's installed, and offers to start the app at the end.

| Command | What it does |
|---|---|
| `npm run setup` | Guided setup — asks before each install |
| `npm run setup -- --yes` | Installs everything missing with the recommended answers, without asking |
| `npm run check` | Only reports what's installed (changes nothing) |

If a tool was just installed but the wizard still can't find it, open a **new terminal** and run `npm run setup` again. Windows only picks up the new PATH in a new window.

### What gets installed

| Engine | Used for | Needed? | Download | How the wizard installs it |
|---|---|---|---|---|
| **Node.js 22+** | Runs ClipForge | Required | — | You install it first ([nodejs.org](https://nodejs.org)) |
| **npm packages** (Remotion, HyperFrames, React…) | Editor, rendering, motion captions | Required | ~1 GB | `npm install` |
| **FFmpeg** | Cutting, framing, encoding | Required | ~100 MB | winget `Gyan.FFmpeg` · brew `ffmpeg-full` · apt `ffmpeg` |
| **Whisper** (whisper.cpp) + speech model | Speech-to-text with word timings | Required | ~10 MB + 140 MB model on first use | Windows: downloads `whisper-bin-x64.zip` into `tools/whisper` and sets `WHISPER_BIN` · macOS: brew · Linux: build guide |
| **Ollama** + `qwen2.5:3b` | Picks highlights, plans scenes, *Edit with AI* | Strongly recommended | ~1.9 GB | winget / brew / install script, then `ollama pull` |
| **Kokoro voices** (Python) | Natural narration | Optional — system voice otherwise | ~350 MB | Python 3.12 if needed, then `pip install kokoro-onnx soundfile` |
| **ComfyUI + SDXL** | AI-painted scenes and style thumbnails | Optional — needs NVIDIA 8 GB+ | ~9 GB | 7-Zip if needed, then `npm run comfy:setup` |
| **Motion model** (in ComfyUI) — you pick | **Motion**: painted scenes that move | Optional — needs ComfyUI | **Fast**: LTX-Video 2B, 11.5 GB · **Best**: Wan 2.2 5B, 18.2 GB · Both: 29.7 GB | The wizard asks which; or `npm run comfy:setup -- -Motion ltx` / `wan` / `both` |
| **Satellite maps** | Maps on a real satellite photo of Earth | Optional | 22 MB (32.5 MB download) | The wizard asks; or `npm run maps:setup` |

### Optional extras by hand

**Natural voices (Kokoro).** Install Python 3, then:

```bash
pip install kokoro-onnx soundfile
```

**AI painting (Stable Diffusion via ComfyUI).** Windows, needs [7-Zip](https://www.7-zip.org/) (`winget install 7zip.7zip`):

```bash
npm run comfy:setup
```

This downloads ComfyUI portable (~2.1 GB), the SDXL base model (~6.9 GB) and the Fast Motion model (~11.5 GB). Downloads resume if your connection drops, so just run it again. It reuses an existing `..\ComfyUI` install, otherwise it installs into `%LOCALAPPDATA%\ClipForge\ComfyUI`. It refuses to install inside the project folder. On macOS or Linux, install ComfyUI by hand in `~/ClipForge/ComfyUI` (found automatically) or set `SD_COMFY_DIR` in `.env`. Full guide: [docs/site/stable-diffusion.md](docs/site/stable-diffusion.md).

**Motion (moving scenes).** Pick the model that suits you. Both run in the same ComfyUI:

| Choice | Model | Speed (12 GB GPU) | Download | Command |
|---|---|---|---|---|
| **Fast** (installed by default) | LTX-Video 2B distilled + T5 encoder | ~1 min per scene | 11.5 GB | `npm run comfy:setup -- -Motion ltx` |
| **Best** | Wan 2.2 TI2V 5B + UMT5 encoder + VAE | several min per scene, smoother motion | 18.2 GB | `npm run comfy:setup -- -Motion wan` |
| Both | all of the above | choose per video | 29.7 GB | `npm run comfy:setup -- -Motion both` |

Then tick **Motion — bring paintings to life** under *AI painting* on the Script page. With both installed, pick **Fast** or **Best** right there.

**A smarter planner.** Bigger Ollama models plan scenes and follow *Edit with AI* much better:

```bash
ollama pull qwen2.5:7b
```

Then set `OLLAMA_EDIT_MODEL=qwen2.5:7b` in `.env`.

### Manual install (instead of the wizard)

<details>
<summary><b>macOS</b></summary>

1. Install **Homebrew** if you don't have it, then run the two "Next steps" lines it prints:
   ```bash
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```
2. Install Node.js, FFmpeg (full build, with caption support), whisper.cpp and Ollama:
   ```bash
   brew install node ffmpeg-full whisper-cpp ollama
   ```
3. Start Ollama as a background service and download the model (~1.9 GB):
   ```bash
   brew services start ollama
   ```
   ```bash
   ollama pull qwen2.5:3b
   ```
</details>

<details>
<summary><b>Windows</b></summary>

1. Install Node.js, FFmpeg and Ollama:
   ```powershell
   winget install OpenJS.NodeJS Gyan.FFmpeg Ollama.Ollama
   ```
2. Open a **new** terminal so `ffmpeg` is on your PATH.
3. Download `whisper-bin-x64.zip` from the [whisper.cpp releases](https://github.com/ggml-org/whisper.cpp/releases). It's attached to the build releases (`bNNNN`), not the version tags. Unzip it into `tools\whisper`, then set `WHISPER_BIN` in `.env` to the full path of `whisper-cli.exe`.
4. Download the planning model:
   ```bash
   ollama pull qwen2.5:3b
   ```
</details>

<details>
<summary><b>Linux (Ubuntu/Debian)</b></summary>

```bash
sudo apt install nodejs npm ffmpeg zenity
```

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

```bash
ollama pull qwen2.5:3b
```

Build whisper.cpp from [github.com/ggml-org/whisper.cpp](https://github.com/ggml-org/whisper.cpp) (`cmake -B build && cmake --build build -j`) and put `build/bin/whisper-cli` on your PATH, or set `WHISPER_BIN` to its full path.
</details>

Then, in the project folder:

```bash
npm install
```

```bash
npm run check
```

### Run

```bash
npm run dev
```

Open **http://localhost:3000**. The top bar shows how many engines are ready; click it for details and fixes.

`npm run dev` also starts ComfyUI in the background when it's installed (log: `data/comfyui.log`). The server reloads by itself when code changes. Stop it with **Ctrl + C**. ComfyUI keeps running; it's reused next time.

| Service | Address |
|---|---|
| ClipForge | http://localhost:3000 |
| ComfyUI (Stable Diffusion) | http://127.0.0.1:8188 |
| Ollama | http://127.0.0.1:11434 |

> **Tip:** ClipForge sends its own workflows to ComfyUI. If you open ComfyUI's page in the browser and it says *Missing Models* for a sample template, ClipForge doesn't need those files.

### All commands

| Command | What it does |
|---|---|
| `npm run setup` / `npm run check` | Guided setup / status report |
| `npm run dev` | Start ClipForge (and ComfyUI) |
| `npm run comfy` | Start ComfyUI only |
| `npm run comfy:setup` | Install ComfyUI + SDXL + Fast Motion model (Windows). Options: `-- -Motion ltx\|wan\|both\|none`, `-- -SkipModel` (no SDXL), `-- -Dir D:\ComfyUI` |
| `npm run maps:setup` | Download NASA Blue Marble satellite imagery for maps (asks first; `-- --yes` to skip the question) |
| `npm run thumbs:ai` | Repaint the art-style picker thumbnails with Stable Diffusion (`-- warli anime` for some) |
| `npm run artstyles` | Rebuild `src/artstyles/*.json` from the style presets |
| `npm run prompts` | Write image-generation prompts for every style and asset to `assets/prompts/` |
| `npm run thumbs` | Make the older vector (procedural) style thumbnails |
| `npm run lint` | Type-check |
| `npm run build` / `npm start` | Production build / run it |

### Where your files live

| Folder | What's in it | In git? |
|---|---|---|
| `data/` | Projects, edits, written scripts (`scripts/`), uploads, exports, voice-overs, AI paintings and clips (`generated/`), Whisper model, logs | No |
| `tools/` | whisper.cpp (Windows) | No |
| `..\ComfyUI\` or `%LOCALAPPDATA%\ClipForge\ComfyUI\` | ComfyUI and its models (`models/checkpoints`, `diffusion_models`, `text_encoders`, `vae`) — always **outside** the project | No |
| `.env` | Your settings | No |
| `src/artstyles/`, `assets/library/`, `public/styles/` | Art-style specs, asset library, style thumbnails | Yes |

Set `CLIPFORGE_DATA_DIR` to keep `data/` on a bigger drive.

### Moving to another laptop

1. On the new laptop: `git clone`, then double-click `setup.cmd` (or `npm install` and `npm run setup`). It installs what's missing.
2. To skip big downloads, copy the ComfyUI folder across first: put it next to the project as `..\ComfyUI`, or in `%LOCALAPPDATA%\ClipForge\ComfyUI`, or set `SD_COMFY_DIR`. Setup finds it and only downloads missing models.
3. To bring your projects too, copy `data/` and `.env`.

### AI models (download in the app)

Open the **engines** button in the top bar → **Manage AI models**. It lists the Ollama models on this computer (online "cloud" models are flagged, because their prompts leave this computer), suggests good ones with their sizes (Qwen 3.5 4B, Spark-X2.5 4B in 4-bit or official 16-bit, Qwen 2.5 3B), downloads any model from ollama.com by name with live progress and a Stop button (a stopped download carries on where it stopped), and removes models you no longer need. New models show up in the Script Writer's AI model list straight away.

### Settings (`.env`)

The wizard creates `.env` from `.env.example`. Change what you need and restart `npm run dev`.

| Setting | Default | Notes |
|---|---|---|
| `PORT` | `3000` | Web app port |
| `CLIPFORGE_DATA_DIR` | `./data` | Keep projects, models and exports on another drive |
| **AI models** | | |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Ollama address |
| `OLLAMA_MODEL` | `qwen2.5:3b` | Lighter: `qwen2.5:1.5b`, `gemma2:2b` · Better: `llama3.1:8b` |
| `WRITER_MODEL` | `OLLAMA_EDIT_MODEL` | Model for the Script Writer (YouTube link → script) |
| `OLLAMA_EDIT_MODEL` | `OLLAMA_MODEL` | Model for *Edit with AI* and story planning; 4B+ works much better (`qwen2.5:7b`) |
| `WHISPER_BIN` | `whisper-cli` | Full path if it isn't on PATH (the wizard sets this on Windows) |
| `WHISPER_MODEL` | `base` | `tiny` (fastest) · `small` / `medium` (more accurate) |
| `WHISPER_LANG` | `auto` | e.g. `en`, `hi` |
| **Voice** | | |
| `TTS_VOICE` | `af_heart` | Default Kokoro voice (`bf_emma`, `am_adam`, `bm_george` …) |
| `HYPERFRAMES_PYTHON` | auto | Python that has `kokoro-onnx` installed |
| **Stable Diffusion (ComfyUI)** | | |
| `SD_URL` | `http://127.0.0.1:8188` | ComfyUI address |
| `SD_COMFY_DIR` | auto | ComfyUI folder if it isn't in `../ComfyUI` or `%LOCALAPPDATA%\ClipForge\ComfyUI` |
| `SD_AUTOSTART` | `true` | `false` = start ComfyUI only when a painting is needed |
| `SD_COMFY_ARGS` | — | Extra ComfyUI arguments, e.g. `--lowvram` |
| `SD_PREVIEW` | `taesd` | Live preview while painting: `taesd`, `latent2rgb`, `auto` or `none` |
| `SD_CHECKPOINT` | first SDXL model | Image checkpoint file name as ComfyUI lists it |
| `SD_STEPS` / `SD_CFG` | `28` / `6` | Use `6` / `2` for Lightning or Turbo models |
| `SD_SAMPLER` / `SD_SCHEDULER` | `dpmpp_2m` / `karras` | Any ComfyUI names |
| `SD_VIDEO_ENGINE` | `ltx` | Default Motion engine when both are installed: `ltx` (Fast) or `wan` (Best) |
| `SD_VIDEO_CHECKPOINT` | first LTX-Video model | Fast Motion checkpoint |
| `SD_VIDEO_TEXT_ENCODER` | first `t5xxl` file | Motion text encoder |
| `SD_VIDEO_STEPS` | `8` | Fast (LTX) sampling steps |
| `SD_WAN_STEPS` | `20` | Best (Wan 2.2) sampling steps |
| **Clip exports** | | |
| `EXPORT_CRF` | `17` | Lower = higher quality, bigger file (15–23); also the editor's *High* MP4 |
| `EXPORT_PRESET` | `medium` | `fast` = quicker export, `slow` = smaller file |
| `FFMPEG_DIR` | auto | Folder of a custom FFmpeg build |
| `HYPERFRAMES_QUALITY` | `high` | Motion caption render quality: `draft` · `standard` · `high` |
| `HYPERFRAMES_WHISPER_PATH` | — | Windows: path to `whisper-cli.exe` for HyperFrames |

**Low-spec PC?** Use `WHISPER_MODEL=tiny` and `OLLAMA_MODEL=qwen2.5:1.5b`, and choose **Vector** illustration.
**No Ollama?** ClipForge still works: a built-in scorer picks clips. Script → video needs Ollama for planning.

### Troubleshooting

| Problem | Fix |
|---|---|
| `address already in use :3000` | Another copy is running. Close it, or set `PORT=3001` in `.env` |
| Tool installed but setup still says ✘ | Open a new terminal (Windows PATH refresh) and run `npm run setup` again |
| "Ollama unavailable, using heuristic" | Start Ollama (the Ollama app, `ollama serve`, or `brew services start ollama`) |
| Captions not burned into the video | Install the full FFmpeg: `brew install ffmpeg-full` (macOS) |
| File picker doesn't appear | It may be behind the browser window. Check the taskbar or Dock |
| Voice sounds robotic | That's the system voice. Install Kokoro: `pip install kokoro-onnx soundfile` |
| *Edit with AI* ignores what I asked | Use a bigger model (`OLLAMA_EDIT_MODEL=qwen2.5:7b`) and name the exact words spoken |
| First editor render is slow | Remotion bundles the graphics and fetches headless Chrome once; later renders are faster |
| *AI painting* says Stable Diffusion is not running | `npm run comfy`, then read `data/comfyui.log`. A `c10.dll` error needs the [VC++ redistributable](https://aka.ms/vc14/vc_redist.x64.exe); otherwise update the NVIDIA driver |
| ComfyUI runs out of GPU memory | Close other GPU apps, or set `SD_COMFY_ARGS=--lowvram` |
| Model download stopped part-way | Run the same command again (`npm run comfy:setup`, or double-click `setup.cmd`). It resumes |
| Motion switch says the model is missing | `npm run comfy:setup -- -Motion ltx` (or `wan`), then reload the Script page |
| A `ComfyUI_windows_portable` folder appeared inside the project | It's ignored by git, but ComfyUI belongs outside. Move it to `..\ComfyUI` (or delete it if you already have one there) |
| A scene came out wrong (extra person, wrong time of day) | Name the character and the time in that scene's sentence, or repaint it. See [docs/STORY_SCRIPT_GUIDE.md](docs/STORY_SCRIPT_GUIDE.md) |
| HyperFrames render failed, used FFmpeg instead | The clip still exported. `npx hyperframes doctor` shows what's missing (usually Chrome) |

Full documentation is built into the app: open **Docs** in the top bar.

---

## Using ClipForge with Claude Code

The repo ships two Claude Code skills in `.claude/skills/`. Open Claude Code in this folder and just ask:

| Skill | Ask for example | What it does |
|---|---|---|
| `clipforge-director` | "Make a 1-minute Warli story video about a farmer and the first monsoon rain" | One round of questions → story treatment → script written for ClipForge → test painting → generates the video → checks a still of every scene and repaints weak ones → renders the MP4 |
| `clipforge-art-style` | "Madhubani paintings look too grey" · "add a Pattachitra style" | Tunes a style's painting prompts with a paint-test loop, or adds a new style everywhere it must be registered |

The director skill drives the running app through `node .claude/skills/clipforge-director/scripts/cf.mjs` (health, styles, paint, make, scenes, stills, repaint, ai, render).

---

## Share a portable copy (Windows)

Give ClipForge to someone with no tech set-up: no Node, npm or installs needed on their PC.

```powershell
npm run portable      # the app: release/ClipForge-Portable-<date>-<commit>.exe (~450 MB). Run again after every change.
npm run portable:ai   # AI pack: Ollama + OLLAMA_MODEL (default qwen2.5:3b), ~2.7 GB. Build once; rebuild only if you change the model.
```

They put both .exe files in one folder, double-click each and press **Extract** (same folder for both), then double-click `ClipForge-PortableStart ClipForge.cmd`. Bundled: Node, FFmpeg, all packages, Remotion's headless Chrome, and Whisper when `whisper-cli` is installed on your PC. Never bundled: your `data/`, your `.env`, or Stable Diffusion (they can add it with *Install AI engines (optional).cmd*). Needs 7-Zip on your PC.

## Use it

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

For script → video, you can direct any scene with **[tags]** such as `[bigStat]`, `[rainFx]`, `[pushIn]` or `[transition: irisWipe]` — they are never spoken. Press **Plan scenes (preview)** to see every line as a task — what we see, where, camera, graphics, Motion — edit it and lock it in before making the video (the Script Writer does this automatically). Pin down what the AI paints with `[place: old market street in Mumbai]` (carries on to later scenes), `[scene: a seller holding up a QR code]` and `[time: night]`; documentaries also get a real world map when a line names a country or a big city — on a real satellite photo of Earth once `npm run maps:setup` has downloaded the imagery. Full list: [docs/site/script-tags.md](docs/site/script-tags.md) (regenerate with `npm run tags-doc`).

To write a script from a YouTube video, open **Writer**, paste the link, pick the video type, length and language, and press **Write script**. Edit the result, then download it or press **Make this video**.

For script → video, open **Script**, paste your story, pick a look, illustration (Vector or AI painting, with optional Motion), art style, format and voice, then **Create video**. Writing tips: [docs/STORY_SCRIPT_GUIDE.md](docs/STORY_SCRIPT_GUIDE.md).

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
