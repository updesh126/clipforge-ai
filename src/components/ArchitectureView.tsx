export function ArchitectureView() {
  const stackLayers = [
    {
      layer: '01. Speech to text',
      tech: 'Whisper (whisper.cpp, or Whisper via HyperFrames)',
      role: 'Transcribes speech locally with word-level timestamps — the basis for clip selection and karaoke captions. 99 languages.',
    },
    {
      layer: '02. Clip selection',
      tech: 'Ollama (qwen2.5:3b) + built-in scorer',
      role: 'A small local LLM ranks highlight windows 0–100 for virality. Without Ollama, a heuristic scorer still picks clips automatically.',
    },
    {
      layer: '03. Framing & encoding',
      tech: 'FFmpeg + FFprobe',
      role: 'Probes media, crops/fits to 9:16 · 1:1 · 16:9 with zoom and pan, burns ASS captions (incl. \\k karaoke), mixes audio and writes 1080p H.264 + SRT.',
    },
    {
      layer: '04. Motion graphics',
      tech: 'HyperFrames (HTML + GSAP → MP4)',
      role: 'Renders animated karaoke / pop captions, hook-title banners and intro cards in headless Chrome over the FFmpeg-framed footage.',
    },
    {
      layer: '05. Voice',
      tech: 'Kokoro-82M TTS via HyperFrames (system voice fallback)',
      role: 'Speaks the clip title for voice intros and narrates the sample video — offline, no API key.',
    },
    {
      layer: '06. Studio',
      tech: 'React 19 + Tailwind v4 · Express · JSON store',
      role: 'Three-pane studio with live caption preview, trim, platform presets, export queue and live pipeline progress. Everything stays in data/.',
    },
  ];

  const roadmapPhases = [
    {
      phase: 'Done',
      items: [
        'Local upload / path / YouTube / TTS sample → automatic clips',
        'Word-level Whisper timings + karaoke, pop, bold and clean captions',
        'HyperFrames motion captions, hook titles and voice intro cards',
        'Live pipeline progress, engine status and Export all',
      ],
    },
    {
      phase: 'Next',
      items: [
        'Active-speaker face tracking with automatic reframe keyframes',
        'Silence & filler-word auto-cut (jump-cut compaction)',
        'Publish kit per clip: title, description and hashtags',
      ],
    },
    {
      phase: 'Later',
      items: [
        'Tauri desktop app with bundled FFmpeg + whisper.cpp',
        'Brand caption presets and safe-zone guides',
        'GPU encode (NVENC / VideoToolbox)',
      ],
    },
  ];

  const treeText = `clipforge-ai/
├── server.ts                  # Express + Vite middleware (port 3000) + job progress API
├── server/
│   ├── ai.ts                  # Whisper (word-level) + Ollama pipeline, heuristic fallback
│   ├── media.ts               # FFprobe, ASS/SRT, FFmpeg export, HyperFrames export path
│   ├── hyperframes.ts         # HyperFrames render / TTS / transcribe wrapper + compositions
│   ├── tts.ts                 # Kokoro TTS with system-voice fallback
│   ├── progress.ts            # In-memory job progress for the UI
│   ├── store.ts               # Local JSON persistence (data/)
│   └── types.ts
├── src/
│   ├── App.tsx                # Project state, progress polling, engine status
│   ├── utils/api.ts           # withProgress() helper
│   └── components/            # TopBar, UploadStage, StudioWorkspace, LibraryView, ArchitectureView
└── data/                      # Gitignored: uploads/, exports/, models/, temp/, projects.json`;

  return (
    <div className="flex-1 bg-black overflow-y-auto px-6 py-8">
      <div className="max-w-5xl mx-auto space-y-12">
        <section className="border-b border-zinc-900 pb-8">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-white">
            Technical Architecture & Development Plan
          </h1>
          <p className="mt-2.5 text-sm text-zinc-400 max-w-2xl leading-relaxed">
            Open-source and local-first. Your footage never leaves this computer: Whisper transcribes, a local LLM picks the moments, FFmpeg frames and encodes, and HyperFrames adds motion captions and voice intros.
          </p>
        </section>

        {/* System Layers */}
        <section>
          <h2 className="font-display text-lg font-semibold text-white mb-4">
            System Architecture
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stackLayers.map((item) => (
              <div
                key={item.layer}
                className="rounded-xl border border-zinc-900 bg-[#09090B] p-5"
              >
                <p className="font-mono text-xs text-accent">{item.layer}</p>
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
