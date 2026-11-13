export function ArchitectureView() {
  const stackLayers = [
    {
      layer: '01. Local Media Engine',
      tech: 'FFmpeg + FFprobe (Native Binary)',
      role: 'Extracts mono 16kHz audio or keyframes, probes resolution/FPS, applies 9:16 and 1:1 pan-crops, burns ASS subtitles, and exports watermark-free H.264 MP4s.',
    },
    {
      layer: '02. AI Clip Selection',
      tech: 'whisper.cpp + Ollama (qwen2.5:3b) — fully offline',
      role: 'whisper.cpp transcribes speech locally; a small Ollama LLM ranks viral highlight windows. Falls back to a built-in heuristic scorer when Ollama is not running.',
    },
    {
      layer: '03. Local Workspace Store',
      tech: 'Express 4 + Local Filesystem (data/)',
      role: 'Persists uploaded source files, project manifests, edited captions, and rendered exports locally on disk with zero cloud lock-in.',
    },
    {
      layer: '04. Pure-Black Studio UI',
      tech: 'React 19 + TypeScript + Tailwind CSS v4',
      role: 'Microsoft Clips-inspired 3-pane workspace with real-time aspect-ratio preview, synced caption editor, and precision In/Out trim scrubber.',
    },
  ];

  const roadmapPhases = [
    {
      phase: 'Phase 1 — MVP (Implemented Today)',
      items: [
        'Local drag-and-drop video upload + 1-click offline-TTS sample session generator',
        'FFprobe media inspection & compressed audio/keyframe extraction',
        'Automatic AI transcription & non-overlapping viral clip selection',
        'Pure-black 3-pane studio with 9:16 / 1:1 / 16:9 crop preview & pan control',
        'Live editable synced captions & watermark-free FFmpeg MP4 + SRT export',
      ],
    },
    {
      phase: 'Phase 2 — Smart Reframe & Local Models',
      items: [
        'Active-speaker face tracking with automatic per-shot Crop X keyframes',
        'Word-level timestamps from whisper.cpp for karaoke captions',
        'Word-level karaoke highlight timestamps in ASS subtitle renderer',
        'Batch export queue to render all selected clips in one click',
      ],
    },
    {
      phase: 'Phase 3 — Desktop Packaging & B-Roll',
      items: [
        'Electron / Tauri desktop wrapper with bundled static FFmpeg binary',
        'Silence & filler-word auto-cut (jump-cut compaction)',
        'Custom font presets, brand safe-zone guides, and 4K 60fps hardware encoding',
      ],
    },
  ];

  const treeText = `clipforge-ai/
├── server.ts                  # Express + Vite middleware entrypoint (port 3000)
├── server/
│   ├── ai.ts                  # Local whisper.cpp + Ollama pipeline (heuristic fallback)
│   ├── media.ts               # FFprobe inspection, ASS/SRT builder, FFmpeg MP4 export
│   ├── store.ts               # Local JSON persistence & file cleanup (data/)
│   └── types.ts               # Shared domain models
├── src/
│   ├── App.tsx                # Root workspace navigation & project state
│   ├── index.css              # Pure-black theme & typography setup
│   └── components/
│       ├── TopBar.tsx         # Minimal 3-zone header
│       ├── UploadStage.tsx    # Dropzone, length presets & sample generator
│       ├── StudioWorkspace.tsx# 3-pane Clip Queue / Video Stage / Transcript Editor
│       ├── LibraryView.tsx    # Local project & export manager
│       └── ArchitectureView.tsx
└── data/                      # Gitignored local storage (uploads/, exports/, projects.json)`;

  return (
    <div className="flex-1 bg-black overflow-y-auto px-6 py-8">
      <div className="max-w-5xl mx-auto space-y-12">
        <section className="border-b border-zinc-900 pb-8">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-white">
            Technical Architecture & Development Plan
          </h1>
          <p className="mt-2.5 text-sm text-zinc-400 max-w-2xl leading-relaxed">
            ClipForge AI is engineered as an open-source, local-first video clipping studio. Source footage stays on your machine, FFmpeg handles deterministic frame-accurate exports without watermarks, and structured multimodal reasoning selects standalone clips automatically.
          </p>
        </section>

        {/* System Layers */}
        <section>
          <h2 className="font-display text-lg font-semibold text-white mb-4">
            System Architecture
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stackLayers.map((item) => (
              <div
                key={item.layer}
                className="rounded-xl border border-zinc-900 bg-[#09090B] p-5"
              >
                <p className="font-mono text-xs text-[#4F8BFF]">{item.layer}</p>
                <h3 className="mt-1.5 text-sm font-semibold text-white">
                  {item.tech}
                </h3>
                <p className="mt-2 text-xs text-zinc-400 leading-relaxed">
                  {item.role}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Development Plan */}
        <section>
          <h2 className="font-display text-lg font-semibold text-white mb-4">
            Step-by-Step Development Plan
          </h2>
          <div className="divide-y divide-zinc-900 border border-zinc-900 rounded-xl bg-[#09090B]">
            {roadmapPhases.map((group) => (
              <div key={group.phase} className="p-5">
                <h3 className="text-sm font-semibold text-white">{group.phase}</h3>
                <ul className="mt-3 space-y-1.5">
                  {group.items.map((line) => (
                    <li
                      key={line}
                      className="text-xs text-zinc-400 flex items-start gap-2.5"
                    >
                      <span className="text-zinc-600 select-none">—</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Project Structure */}
        <section className="pb-6">
          <h2 className="font-display text-lg font-semibold text-white mb-4">
            Project Structure
          </h2>
          <pre className="rounded-xl border border-zinc-900 bg-[#09090B] p-5 font-mono text-xs text-zinc-300 overflow-x-auto leading-relaxed">
            {treeText}
          </pre>
        </section>
      </div>
    </div>
  );
}
