# Installation

## The quick way: setup wizard

On a new computer you only need **Node.js 22+** and **git**:

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

The wizard checks each engine, explains what it's for, and **asks before installing** it:

| Step | Required? | How it installs |
|---|---|---|
| Node.js 22+ | yes | Checked only — install from nodejs.org |
| `.env` settings | — | Created from `.env.example` |
| FFmpeg | yes | winget `Gyan.FFmpeg` · brew `ffmpeg-full` · apt `ffmpeg` |
| Whisper (whisper.cpp) | yes | Windows: downloads `whisper-bin-x64.zip` into `tools/whisper` and sets `WHISPER_BIN` · macOS: brew · Linux: build guide |
| Ollama + model | recommended | winget / brew / install script, starts it, then `ollama pull` (~2 GB) |
| Kokoro voices | optional | Installs Python 3.12 if needed, then `pip install kokoro-onnx soundfile` |
| HyperFrames | yes | Comes with `npm install` |
| Stable Diffusion | optional | Only offered with an NVIDIA GPU of 8 GB+. Installs 7-Zip if needed, then ComfyUI + SDXL (~9 GB), then **starts ComfyUI** in the background |

Options: `npm run setup -- --yes` installs everything missing with the recommended answers; `npm run check` only reports. If a tool was just installed but isn't found, open a **new terminal** and run setup again (Windows PATH refresh).

## By hand

You need **Node.js 22+**, **FFmpeg**, **whisper.cpp** and **Ollama**. Kokoro voices and Stable Diffusion are optional.

## Windows

```powershell
winget install OpenJS.NodeJS Gyan.FFmpeg Ollama.Ollama
```

Open a **new** terminal so `ffmpeg` is on your PATH. Download `whisper-bin-x64.zip` from the [whisper.cpp releases](https://github.com/ggml-org/whisper.cpp/releases), unzip it and add that folder to your PATH. Then download the planning model:

```bash
ollama pull qwen2.5:3b
```

## macOS

```bash
brew install node ffmpeg-full whisper-cpp ollama
```

```bash
brew services start ollama
```

```bash
ollama pull qwen2.5:3b
```

## Linux (Ubuntu / Debian)

```bash
sudo apt install nodejs npm ffmpeg zenity
```

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

Build whisper.cpp from source and put `whisper-cli` on your PATH.

## Set up the project

```bash
npm install
```

```bash
npm run setup
```

`npm run setup` checks every tool and offers to install anything that's missing. `npm run check` only reports. The Whisper speech model (about 140 MB) downloads by itself the first time you process a video.

## Optional extras

| Extra | Why | How |
|---|---|---|
| Kokoro voices | Natural narration instead of the system voice | `pip install kokoro-onnx soundfile` |
| Stable Diffusion | Painted, high-detail story scenes | `npm run comfy:setup` — then it starts with `npm run dev`. See [Stable Diffusion setup](#/docs/stable-diffusion) |
| Bigger LLM | Better scene plans and *Edit with AI* | `ollama pull qwen2.5:7b`, then set `OLLAMA_EDIT_MODEL` |

## Run

```bash
npm run dev
```

This also starts ComfyUI in the background when it is installed. Open **http://localhost:3000**. The top bar shows how many engines are ready; click it for details. Stop the server with **Ctrl + C**.
