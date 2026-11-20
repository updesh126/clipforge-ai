# Troubleshooting & FAQ

## Common problems

| Problem | Fix |
|---|---|
| `address already in use :3000` | Another copy is running. Close it, or set `PORT=3001` in `.env` |
| Tool installed but setup still says ✘ | Open a new terminal (Windows PATH refresh) and run `npm run setup` again |
| "Ollama unavailable, using heuristic" | Start Ollama (the Ollama app, `ollama serve`, or `brew services start ollama`) |
| Captions not burned into the video | Install the full FFmpeg: `brew install ffmpeg-full` (macOS) |
| File picker doesn't appear | It may be behind the browser window. Check the taskbar or Dock |
| Voice sounds robotic | That's the system voice. Install Python 3.12 and Kokoro; see [installation](#/docs/installation) |
| *Edit with AI* ignores what I asked | Use a bigger model (`OLLAMA_EDIT_MODEL=qwen2.5:7b`) and name the exact words spoken |
| First editor render is slow | Remotion bundles the graphics and fetches headless Chrome once; later renders are faster |
| *AI painting* says Stable Diffusion is not running | `npm run comfy`, then read `data/comfyui.log`. A `c10.dll` error needs the [VC++ redistributable](https://aka.ms/vc14/vc_redist.x64.exe); otherwise update the NVIDIA driver |
| ComfyUI runs out of GPU memory | Close other GPU apps, or set `SD_COMFY_ARGS=--lowvram` |
| Model download stopped part-way | Run the same command again (`npm run comfy:setup`, or double-click `setup.cmd`). It resumes |
| Motion switch says the model is missing | `npm run comfy:setup -- -Motion ltx` (or `wan`), then reload the Script page |
| A `ComfyUI_windows_portable` folder appeared inside the project | It's ignored by git, but ComfyUI belongs outside. Move it to `..\ComfyUI` (or delete it if you already have one there) |
| A scene came out wrong (extra person, wrong time of day) | Name the character and the time in that scene's sentence, or repaint it. See [the script guide](#/docs/script-guide) |
| HyperFrames render failed, used FFmpeg instead | The clip still exported. `npx hyperframes doctor` shows what's missing (usually Chrome) |

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
