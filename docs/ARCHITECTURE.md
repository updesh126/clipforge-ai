# ClipForge AI — Architecture & Plan

## Goals
Local-first · fully automatic clip selection · runs on modest hardware · free/MIT · no watermark · pure-black minimal UI (Microsoft Clips inspired).

## Stack
| Layer | Tech | Why |
|---|---|---|
| UI | React 19 + Vite + Tailwind v4 | Fast, single-page studio |
| Server | Express (Node 20+, `tsx`) | One process, serves UI + API on :3000 |
| Media | FFmpeg / FFprobe | Probe, audio extract, crop/reframe, burn ASS captions, H.264 export |
| Speech-to-text | whisper.cpp (`whisper-cli`) | Native C++, CPU/Metal, tiny→medium models, 99 languages |
| Clip ranking | Ollama + small LLM (qwen2.5:3b default) | JSON-mode output, 2–4 GB RAM |
| Fallback ranking | Heuristic scorer (`server/ai.ts`) | Works with zero LLM |
| Storage | JSON manifest + files in `data/` | No database to install |
| YouTube | yt-dlp (auto-fetched binary) | Local download |

## Pipeline (`server/ai.ts`)
1. `transcribeLocal` — FFmpeg → 16 kHz WAV → `whisper-cli -oj -ml 48 -sow` → caption-sized segments.
2. `selectWithOllama` — transcript split into ~9 k-char windows (fits 8 k context), each asked for N clips with hook/payoff rules + score.
3. `selectHeuristic` — sliding windows scored on words/sec, hook keywords, questions, numbers, clean ending; penalises "and/but/so" openers.
4. `snapAndFinalise` — snap to segment boundaries (±4 s), drop overlaps, keep top-N by score.
5. Export (`server/media.ts`) — crop to 9:16/1:1/16:9 with pan, burn ASS captions, write MP4 + SRT. No watermark is ever added.

## Project structure
```
clipforge-ai/
├── server.ts              Express entry + API routes (+ /api/health)
├── server/
│   ├── ai.ts              Local AI pipeline (whisper.cpp + Ollama + heuristic)
│   ├── media.ts           FFprobe, ASS/SRT, FFmpeg export
│   ├── store.ts           data/ persistence
│   ├── youtube.ts         yt-dlp download
│   └── types.ts
├── src/                   React UI (TopBar, UploadStage, StudioWorkspace, LibraryView, ArchitectureView)
├── scripts/check-setup.mjs  Dependency doctor
└── data/                  uploads/, exports/, temp/, models/, projects.json (git-ignored)
```

## Roadmap
- **MVP (done):** upload / YouTube / sample → local transcript → auto clips → studio trim, pan, caption edit → MP4 + SRT export.
- **Next:** background job queue with progress (SSE) so long videos don't hold the HTTP request; batch export all clips; engine status chip in TopBar using `/api/health`.
- **Then:** face-tracked auto-reframe (MediaPipe / OpenCV), word-level karaoke captions, silence & filler-word cutting, caption style presets.
- **Later:** Tauri desktop app with bundled FFmpeg + whisper.cpp, GPU encode (VideoToolbox/NVENC).
