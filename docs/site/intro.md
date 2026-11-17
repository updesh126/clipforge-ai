# Introduction

ClipForge AI is a free, local-first video studio. Everything runs on your own computer: no cloud, no API keys, no watermark and no file-size limit.

It does three jobs:

| Workspace | What it does |
|---|---|
| **Clip** | Turns a long video into ranked vertical shorts with captions |
| **Script** | Turns a written script into a narrated, illustrated video |
| **Edit** | A multi-track timeline editor built on [Remotion](https://www.remotion.dev/docs/) |

## How the pieces fit

- **FFmpeg** cuts, frames and encodes video.
- **Whisper** (whisper.cpp) transcribes speech with word timings.
- **Ollama** runs a small local language model that picks highlights, plans scenes and edits the timeline for you.
- **Kokoro** (optional) gives natural AI voices; otherwise your system voice is used.
- **Remotion** previews and renders the editor timeline as an MP4.
- **Stable Diffusion via ComfyUI** (optional) paints story scenes in any art style.
- **LTX-Video via ComfyUI** (optional, *Motion*) turns those paintings into short moving clips.

> **Tip:** start with [Installation](#/docs/installation), then follow [Your first video](#/docs/first-video).

## Where your files live

All data stays in `./data`: uploads, exports, models, generated paintings and `projects.json`. Change the location with `CLIPFORGE_DATA_DIR` (see [Settings](#/docs/settings)).
