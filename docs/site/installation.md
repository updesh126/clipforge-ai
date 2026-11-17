# Installation

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

`npm run setup` checks every tool and prints the exact install command for anything missing. The Whisper speech model (about 140 MB) downloads by itself the first time you process a video.

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
