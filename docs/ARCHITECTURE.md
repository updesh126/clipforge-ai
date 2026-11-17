# ClipForge AI — Architecture & Plan

## Goals
Local-first · fully automatic clip selection · runs on modest hardware · free/MIT · no watermark · pure-black minimal UI (Microsoft Clips inspired).

## Stack
| Layer | Tech | Why |
|---|---|---|
| UI | React 19 + Vite + Tailwind v4 | Fast, single-page studio |
| Server | Express (Node 20+, `tsx`) | One process, serves UI + API on :3000 |
| Media | FFmpeg / FFprobe | Probe, audio extract, crop/reframe, burn ASS captions, H.264 export |
| Speech-to-text | whisper.cpp (`whisper-cli`), or Whisper via HyperFrames | Word-level timestamps (`-ml 1 -sow`), CPU/Metal, 99 languages |
| Motion graphics | HyperFrames (HTML + GSAP → MP4, headless Chrome) | Karaoke / pop captions, hook titles, intro cards — deterministic, local |
| Editor | Remotion (`@remotion/player` preview, `@remotion/renderer` local render) | React compositions, deterministic frame rendering; company licence needed for for-profit teams over 3 people |
| Text-to-speech | Kokoro-82M via `hyperframes tts` (system voice fallback) | Voice intros and sample narration, offline |
| Clip ranking | Ollama + small LLM (qwen2.5:3b default) | JSON-mode output, 2–4 GB RAM |
| Fallback ranking | Heuristic scorer (`server/ai.ts`) | Works with zero LLM |
| Storage | JSON manifest + files in `data/` | No database to install |
| YouTube | yt-dlp (auto-fetched binary) | Local download |

## Pipeline (`server/ai.ts`)
1. `transcribeLocal` — FFmpeg → 16 kHz WAV → `whisper-cli -oj -ml 1 -sow` (one entry per word) → `wordsToSegments` groups words into ≤48-char segments, keeping `words[]` for karaoke. Falls back to `hyperframes transcribe` when `whisper-cli` is missing (macOS/Linux, or Windows with `HYPERFRAMES_WHISPER_PATH`).
2. `selectWithOllama` — transcript split into ~9 k-char windows (fits 8 k context), each asked for N clips with hook/payoff rules + score.
3. `selectHeuristic` — sliding windows scored on words/sec, hook keywords, questions, numbers, clean ending; penalises "and/but/so" openers.
4. `snapAndFinalise` — snap to segment boundaries (±4 s), drop overlaps, keep top-N by score.
5. Export (`server/media.ts`):
   - **Plain** (off / clean / bold, no extras): one FFmpeg pass — crop/fit + ASS captions → MP4 + SRT.
   - **Motion** (karaoke / pop / hook title / voice intro): FFmpeg frames the clip → optional Kokoro TTS intro → `buildCompositionHtml` writes an HTML + GSAP composition → `hyperframes render` → FFmpeg copies the rendered video and mixes the original audio (+ delayed voice). Any HyperFrames failure falls back to the plain path with ASS k karaoke, and the UI shows a warning.
   - No watermark is ever added.
7. Editor (`src/editor`, `src/remotion`, `server/edits.ts`, `server/editAI.ts`, `server/remotion.ts`):
   - Model: `EditProject` with timed items (`video`, `audio`, `image`, `text` template, `captions`, `effect`) in seconds; stored in `data/edits.json`.
   - One Remotion composition (`EditorComposition`) turns every item into a `<Sequence>`; effects transform the footage layer, graphics sit on top. The same component powers the in-browser Player and the server render.
   - Auto-edit (`editFromClip`) converts an AI clip + its Whisper words into a ready edit.
   - *Edit with AI*: timeline + timed transcript + template catalogue → Ollama (`format: json`, thinking off) → ops (`add`/`update`/`delete`/`setName`). `normaliseOps` repairs small-model mistakes and resolves `"at": "<spoken words>"` to a time; `sanitiseItem` validates everything (only `/media/...` sources are allowed).
   - Render: `@remotion/bundler` bundles `src/remotion/index.ts` once, `renderMedia` writes H.264 to `data/exports` with progress via the job API.
8. Art styles (`src/remotion/artStyles.tsx`): ten procedural SVG styles; each exports a Scene (full-frame animated backdrop) and a Border (frame with a clear centre) plus typography for banners. Used by the `artCard`, `artFrame` and `artBanner` templates. Randomness uses Remotion's seeded `random()` so every frame is deterministic.
9. Script → video (`server/scriptVideo.ts`, `POST /api/script-video`): deterministic scene split → Ollama visual plan (validated; heuristic fallback) → `speak()` per scene into `data/uploads/vo_*.wav` → Whisper word timings per clip → EditProject (art backdrop + graphic + captions + audio per scene, progress bar). Deleting the edit removes its voice files.
10. Asset kit + library (`src/assetkit`, `server/assets.ts`, `server/storyScenes.ts`): parametric SVG generators (person, animal, bird, fish, tree, mountain, building, object, background) painted per art style by `paint.ts`; `ensureAsset()` looks up user PNGs → cached drawings → built-in recipes (`catalog.ts`) → an LLM-written recipe, renders missing ones to transparent PNG through the `ClipForgeAsset` Remotion composition, and records them in `assets/library/index.json`. Story mode turns each scene into a background (depth 0.35, Ken Burns), actors anchored on the ground line (depth 0.7–1.2, motion presets), a camera effect (parallax by depth) and a hand-off transition.
6. Progress — every long route accepts a `jobId`; `server/progress.ts` stores the current step and the UI polls `GET /api/jobs/:id`.

## Project structure
```
clipforge-ai/
├── server.ts              Express entry + API routes (+ /api/health)
├── server/
│   ├── ai.ts              Local AI pipeline (whisper.cpp + Ollama + heuristic)
│   ├── media.ts           FFprobe, ASS/SRT, FFmpeg export
│   ├── store.ts           data/ persistence
│   ├── hyperframes.ts     HyperFrames render / tts / transcribe + composition builder
│   ├── tts.ts             Kokoro TTS → system voice fallback
│   ├── progress.ts        In-memory job progress
│   ├── youtube.ts         yt-dlp download
│   └── types.ts
├── src/                   React UI (TopBar, UploadStage, StudioWorkspace, LibraryView, ArchitectureView)
├── scripts/setup-wizard.mjs Guided setup: checks and installs engines (npm run setup)
└── data/                  uploads/, exports/, temp/, models/, projects.json (git-ignored)
```

## Roadmap
- **MVP (done):** upload / YouTube / sample → local transcript → auto clips → studio trim, pan, caption edit → MP4 + SRT export.
- **Done since MVP:** live job progress, Export all, engine status in the top bar, word-level captions (karaoke / pop), HyperFrames motion layer, TTS voice intros.
- **Next:** fully detached background jobs (survive page reloads); publish kit (title, description, hashtags) per clip.
- **Then:** face-tracked auto-reframe (MediaPipe / OpenCV), silence & filler-word cutting, brand caption presets.
- **Later:** Tauri desktop app with bundled FFmpeg + whisper.cpp, GPU encode (VideoToolbox/NVENC).
