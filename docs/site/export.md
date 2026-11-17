# Export

Renders run on your computer with Remotion. Files are saved in `data/exports/` and a download link appears in the editor.

## Formats

| Format | Codec | Use it for |
|---|---|---|
| **MP4** | H.264 + AAC | YouTube, Shorts, Reels, WhatsApp — the default |
| **WebM** | VP9 + Opus | Web pages, smaller files |
| **GIF** | GIF, every 2nd frame, half size | Previews and chats (no sound) |
| **Still** | PNG | A thumbnail of the frame under the playhead |

## Quality

| Quality | MP4 CRF | WebM CRF | Size |
|---|---|---|---|
| **High** | 17 (or `EXPORT_CRF`) | 20 | Full size, 256 kbps audio |
| **Standard** | 23 | 31 | Full size |
| **Draft** | 28 | 40 | Half size, 128 kbps audio — quick checks |

## Frame sizes

Pick the frame shape in the editor header: **9:16** (1080×1920), **1:1** (1080×1080), **4:5** (1080×1350) or **16:9** (1920×1080).

## Tips

- The first render bundles the graphics and downloads headless Chrome once; later renders start quickly.
- If an image in the edit is not cleared for commercial use, a licence warning appears after the render.

> **Licence:** Remotion is free for individuals, non-profits and companies of up to 3 people. Larger for-profit teams need a [Remotion company licence](https://www.remotion.dev/docs/license).
