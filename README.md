# ClipForge AI

Free, open-source, local-first AI video clipper — an offline alternative to Vizard, Wayin and Opus Clip.
Pick a long video, get ranked vertical clips with captions. Everything runs on your own computer: no cloud, no API keys, no watermark, no file size limit.

---

## Features

- **Fully automatic** — local AI transcribes the video and picks the best moments
- **Virality meter** — every clip gets a 0–100 score; clips are listed in timeline order
- **Manual clips** — add your own section at the playhead, trim In/Out, delete any clip
- **Any size, no upload** — "Select Local Video" opens your file in place (tested for 24 GB+)
- **Framing** — 9:16, 1:1, 16:9 · *Fill* (crop) or *Fit full video* (landscape inside portrait on a blurred background) · Zoom 1–3× · Pan ↔ ↕
- **Captions** — burned-in (Clean / Highlight) or Off, plus an `.srt` file with every export
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
   - Choose captions: Clean, Highlight or Off.
4. **Export** → watermark-free MP4 + SRT, saved in `data/exports/`.

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

---

## How it works

```
your video (used in place)
  └─ FFmpeg ─▶ 16 kHz audio ─▶ whisper.cpp ─▶ timed transcript
        └─ Ollama (qwen2.5:3b) scores highlight windows 0–100   (fallback: built-in heuristic)
              └─ snap to sentences, drop overlaps, sort by time ─▶ studio
                    └─ FFmpeg: crop/fit, zoom, pan, captions ─▶ 1080p MP4 + SRT
```

All data stays in `./data` (uploads, exports, models, `projects.json`). Full design notes: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## License

MIT — free to use, modify and share.
