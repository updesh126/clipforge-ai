# Troubleshooting & FAQ

## Common problems

| Problem | Fix |
|---|---|
| `address already in use :3000` | Another copy is running. Close it, or set `PORT=3001` |
| "Ollama unavailable, using heuristic" | Start Ollama (`ollama serve`, or the Ollama app) |
| Captions not burned into a clip | Install the full FFmpeg build (`brew install ffmpeg-full` on macOS) |
| File picker doesn't appear | It may be behind the browser window — check the taskbar |
| Voice sounds robotic | That's the system voice — install Kokoro: `pip install kokoro-onnx soundfile` |
| *Edit with AI* ignores the request | Use a bigger model: `OLLAMA_EDIT_MODEL=qwen2.5:7b`. Quote the exact words spoken |
| First editor render is slow | Remotion bundles once and fetches headless Chrome; later renders are faster |
| *AI painting* says Stable Diffusion is not running | Start ComfyUI (`run_nvidia_gpu.bat`) — see [Stable Diffusion setup](#/docs/stable-diffusion) |
| Tool installed but setup still shows ✘ | Open a new terminal so PATH is refreshed |

## FAQ

**Does anything leave my computer?**
No. Transcription, planning, voices, painting and rendering all run locally. Only a YouTube import or a first-time model download uses the internet.

**Can I use the videos commercially?**
Your own footage and ClipForge's procedural art, yes. Check the licences of Remotion (company licence over 3 people), the Ollama model you use, any Stable Diffusion checkpoint and any PNGs you add. See `SOURCES.md`.

**Vector or AI painting — which should I use?**
Vector is fast and its characters move (walk, wave, change expression). AI painting looks richer and matches the art-style samples, but each scene is a still painting with camera movement, and it needs a GPU.

**Why do characters look slightly different between AI paintings?**
Stable Diffusion has no memory between images. ClipForge repeats the same character descriptions and seed in every scene, which helps a lot, but small changes can still happen.

**Where are my files?**
In `./data` (or `CLIPFORGE_DATA_DIR`): `uploads`, `exports`, `generated`, `models`, `projects.json` and `edits.json`.
