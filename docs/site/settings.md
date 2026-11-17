# Settings

Copy `.env.example` to `.env` and change what you need. Restart `npm run dev` after editing.

## General

| Setting | Default | Notes |
|---|---|---|
| `PORT` | `3000` | Web app port |
| `CLIPFORGE_DATA_DIR` | `./data` | Keep projects, models and exports on another drive |

## AI models

| Setting | Default | Notes |
|---|---|---|
| `OLLAMA_MODEL` | `qwen2.5:3b` | Lighter: `qwen2.5:1.5b` · Better: `llama3.1:8b` |
| `OLLAMA_EDIT_MODEL` | `OLLAMA_MODEL` | Model for *Edit with AI* and story planning; 4B+ works much better |
| `WHISPER_MODEL` | `base` | `tiny` (fastest) · `small` / `medium` (more accurate) |
| `WHISPER_LANG` | `auto` | e.g. `en`, `hi` |
| `WHISPER_BIN` | `whisper-cli` | Full path if it is not on PATH |

## Voice

| Setting | Default | Notes |
|---|---|---|
| `TTS_VOICE` | `af_heart` | Default Kokoro voice |
| `HYPERFRAMES_PYTHON` | auto | Python that has `kokoro-onnx` installed |

## Stable Diffusion

| Setting | Default | Notes |
|---|---|---|
| `SD_URL` | `http://127.0.0.1:8188` | ComfyUI address |
| `SD_CHECKPOINT` | first SDXL model | Exact checkpoint file name |
| `SD_STEPS` | `28` | 6–8 for Lightning/Turbo models |
| `SD_CFG` | `6` | 1.5–2 for Lightning/Turbo models |
| `SD_SAMPLER` / `SD_SCHEDULER` | `dpmpp_2m` / `karras` | Any ComfyUI names |
| `SD_COMFY_DIR` | auto | ComfyUI folder (default: `tools/ComfyUI`, then `..\ComfyUI`) |
| `SD_AUTOSTART` | `true` | Start ComfyUI with `npm run dev` |
| `SD_COMFY_ARGS` | — | Extra ComfyUI arguments, e.g. `--lowvram` |
| `SD_PREVIEW` | `taesd` | Live preview while painting (`none` to turn off) |

## Export (Clip workspace)

| Setting | Default | Notes |
|---|---|---|
| `EXPORT_CRF` | `17` | Lower = higher quality (15–23); also the editor's *High* MP4 quality |
| `EXPORT_PRESET` | `medium` | `fast` = quicker, `slow` = smaller |
| `FFMPEG_DIR` | auto | Folder of a custom FFmpeg build |
| `HYPERFRAMES_QUALITY` | `high` | `draft` · `standard` · `high` |
| `HYPERFRAMES_WHISPER_PATH` | — | Windows: path to `whisper-cli.exe` |

**Low-spec PC?** Use `WHISPER_MODEL=tiny` and `OLLAMA_MODEL=qwen2.5:1.5b`.
