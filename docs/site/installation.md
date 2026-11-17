# Installation

Everything runs on your own computer. Setup is a one-time job of 15–60 minutes, most of it downloads.

## What you need

| | Minimum | Recommended |
|---|---|---|
| System | Windows 10/11, macOS 13+, or Ubuntu/Debian Linux | Windows 11 or macOS on Apple silicon |
| Memory | 8 GB RAM | 16 GB+ RAM |
| Disk | 10 GB free | 40 GB free, if you want AI painting and Motion |
| Graphics | Any (vector art and clipping need no GPU) | NVIDIA with 12 GB VRAM for AI painting and Motion (an RTX 3060 12 GB works) |
| Software | **Node.js 22+** and **git** | — |

## One-click setup

- **Windows:** double-click **`setup.cmd`** in the project folder. It installs Node.js if needed, then everything else, then starts ClipForge and opens your browser.
- **macOS / Linux:** run `sh setup.sh`.

Afterwards, start ClipForge any day with **`start.cmd`** (Windows) or `npm run dev`.

Stable Diffusion (ComfyUI) and its models are **always installed outside the project folder**: an existing `..\ComfyUI`, otherwise `%LOCALAPPDATA%\ClipForge\ComfyUI` on Windows (`~/ClipForge/ComfyUI` on macOS/Linux). So the project stays small and nothing big ends up in git.

## Quick start: the setup wizard (step by step)

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

## What gets installed

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

## Optional extras by hand

**Natural voices (Kokoro).** Install Python 3, then:

```bash
pip install kokoro-onnx soundfile
```

**AI painting (Stable Diffusion via ComfyUI).** Windows, needs [7-Zip](https://www.7-zip.org/) (`winget install 7zip.7zip`):

```bash
npm run comfy:setup
```

This downloads ComfyUI portable (~2.1 GB), the SDXL base model (~6.9 GB) and the Fast Motion model (~11.5 GB). Downloads resume if your connection drops, so just run it again. It reuses an existing `..\ComfyUI` install, otherwise it installs into `%LOCALAPPDATA%\ClipForge\ComfyUI`. It refuses to install inside the project folder. On macOS or Linux, install ComfyUI by hand in `~/ClipForge/ComfyUI` (found automatically) or set `SD_COMFY_DIR` in `.env`. Full guide: [Stable Diffusion setup](#/docs/stable-diffusion).

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

## Manual install (instead of the wizard)

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

## Run

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

## All commands

| Command | What it does |
|---|---|
| `npm run setup` / `npm run check` | Guided setup / status report |
| `npm run dev` | Start ClipForge (and ComfyUI) |
| `npm run comfy` | Start ComfyUI only |
| `npm run comfy:setup` | Install ComfyUI + SDXL + Fast Motion model (Windows). Options: `-- -Motion ltx\|wan\|both\|none`, `-- -SkipModel` (no SDXL), `-- -Dir D:\ComfyUI` |
| `npm run thumbs:ai` | Repaint the art-style picker thumbnails with Stable Diffusion (`-- warli anime` for some) |
| `npm run artstyles` | Rebuild `src/artstyles/*.json` from the style presets |
| `npm run prompts` | Write image-generation prompts for every style and asset to `assets/prompts/` |
| `npm run thumbs` | Make the older vector (procedural) style thumbnails |
| `npm run lint` | Type-check |
| `npm run build` / `npm start` | Production build / run it |

## Where your files live

| Folder | What's in it | In git? |
|---|---|---|
| `data/` | Projects, edits, uploads, exports, voice-overs, AI paintings and clips (`generated/`), Whisper model, logs | No |
| `tools/` | whisper.cpp (Windows) | No |
| `..\ComfyUI\` or `%LOCALAPPDATA%\ClipForge\ComfyUI\` | ComfyUI and its models (`models/checkpoints`, `diffusion_models`, `text_encoders`, `vae`) — always **outside** the project | No |
| `.env` | Your settings | No |
| `src/artstyles/`, `assets/library/`, `public/styles/` | Art-style specs, asset library, style thumbnails | Yes |

Set `CLIPFORGE_DATA_DIR` to keep `data/` on a bigger drive.

## Moving to another laptop

1. On the new laptop: `git clone`, then double-click `setup.cmd` (or `npm install` and `npm run setup`). It installs what's missing.
2. To skip big downloads, copy the ComfyUI folder across first: put it next to the project as `..\ComfyUI`, or in `%LOCALAPPDATA%\ClipForge\ComfyUI`, or set `SD_COMFY_DIR`. Setup finds it and only downloads missing models.
3. To bring your projects too, copy `data/` and `.env`.


## Next

- Change settings in `.env`: see [Settings](#/docs/settings).
- Something not working? See [Troubleshooting & FAQ](#/docs/faq).
- Make your first video: [Your first video](#/docs/first-video).
