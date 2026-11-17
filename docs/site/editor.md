# Editor basics

The editor is a multi-track timeline built on [Remotion](https://www.remotion.dev/docs/). What you see in the preview is exactly what renders.

## Layout

| Area | What it does |
|---|---|
| **Library** (left) | Motion, Effects, Titles, Art, Assets and Media tabs |
| **Preview** (centre) | Remotion Player, with play/pause and the timecode |
| **Timeline** (bottom) | Layers (tracks), clips, playhead, snapping |
| **Edit with AI / Inspector** (right) | Ask the local AI for changes, or edit the selected clip |

## Adding things

In the **Motion** and **Effects** tabs:

- **Click** a card to preview it. Nothing is added yet.
- Press **+** on the card, **Add at playhead** under the preview, or **double-click** the card to add it at the playhead.

| Tab | Contents |
|---|---|
| Motion | Sequences, typography, data, maps, annotations, shapes, layouts, timelines, diagrams, science, finance, audio |
| Effects | Camera (push, pull, pan, tilt, zoom, shake), Transitions, Particles, Light & film |
| Titles | Titles and overlays, plus Vox-style explainer graphics |
| Art | Art-style card, frame and banner for each of the 14 styles |
| Assets | Characters, animals, places and props from the asset library |
| Media | Your own video, music and images from disk |

## The timeline

- **Drag** a clip to move it; drag its **edges** to trim.
- Drag **up or down** to change its layer. Higher layers draw on top.
- Clips snap to the playhead and to other clips.
- **S** splits the selected clip at the playhead; **Ctrl+D** duplicates it.

## The Inspector

Select a clip to edit it. Every item has timing (start, length, layer). Then, by kind:

| Kind | Controls |
|---|---|
| Video | Framing (fill or fit), zoom, pan, volume, **speed**, **fade in / fade out**, source in point |
| Audio | Volume, **speed**, **fade in / fade out**, source in point |
| Image | Size, position, motion (pop, walk in, float…), depth for parallax, flip, art-style look |
| Character | Pose, expression and theme (redrawn on change) |
| Text / motion | Every parameter of the template, plus delay, speed, easing, exit, scale and colours |
| Captions | Look (karaoke, pop, bold, clean), position, accent colour |
| Effect | Intensity |

> **Speed** plays the media faster or slower (0.25×–4×) without changing the clip's length on the timeline. **Fades** are linear volume ramps at the start and end of the clip.

## Edit with AI

Type what you want, for example *"add a stat when they say 85 percent"*. The local Ollama model reads the transcript and edits the timeline. Every AI change can be undone with **Ctrl+Z**.

## Saving

Edits save automatically a moment after each change. Render with the button in the top-right — see [Export](#/docs/export).
