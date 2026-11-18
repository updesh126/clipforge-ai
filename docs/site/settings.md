# Settings

The wizard creates `.env` from `.env.example`. Change what you need and restart `npm run dev`.

**Downloading AI models:** you don't need the command line. Open the **engines** button in the top bar → **Manage AI models** to download suggested or any ollama.com model (with progress and Stop), see what's installed, and remove models. To make one the default, set `WRITER_MODEL` or `OLLAMA_EDIT_MODEL` below to its name.

| Setting | Default | Notes |
|---|---|---|
| `PORT` | `3000` | Web app port |
| `CLIPFORGE_DATA_DIR` | `./data` | Keep projects, models and exports on another drive |
| **AI models** | | |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Ollama address |
| `OLLAMA_MODEL` | `qwen2.5:3b` | Lighter: `qwen2.5:1.5b`, `gemma2:2b` · Better: `llama3.1:8b` |
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
