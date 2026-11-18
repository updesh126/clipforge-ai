# API reference

The app talks to a local Express server. You can call the same endpoints from scripts. All paths are relative to `http://localhost:3000`.

## Status

| Method | Path | Returns |
|---|---|---|
| GET | `/api/health` | Engine status: FFmpeg, Whisper, Ollama, Kokoro voices, Stable Diffusion (`sd`, `sdModel`) |
| GET | `/api/jobs/:id` | Live progress of a long job (`stage`, `label`, `pct`) |
| GET | `/api/sd/status` | ComfyUI status, checkpoints and the one in use |
| POST | `/api/sd/start` | Start ComfyUI now (when installed) and return its status |
| POST | `/api/sd/test` | Paints one test image. Body: `{ style, prompt?, aspect?, seed? }` |

## Clip projects

| Method | Path | Notes |
|---|---|---|
| GET | `/api/projects` | List projects |
| GET | `/api/projects/:id` | One project |
| POST | `/api/projects/local` | Analyse a file on disk. Body: `{ path }` |
| POST | `/api/projects/upload` | Upload a video (multipart `video`) |
| POST | `/api/projects/youtube` | Import a YouTube link |
| POST | `/api/projects/:id/reanalyze` | Score the clips again |
| PATCH | `/api/projects/:id` | Update clips and settings |
| POST | `/api/projects/:id/clips/:clipId/export` | Render one clip to MP4 + SRT |
| GET | `/api/projects/:id/clips/:clipId/srt` | Captions as SRT |
| DELETE | `/api/projects/:id` | Delete a project |

## Edits (timeline)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/edits` | List edits |
| GET / PUT / DELETE | `/api/edits/:id` | Read, save or delete an edit |
| POST | `/api/edits` | Create an edit (blank or from a clip) |
| POST | `/api/edits/:id/ai` | *Edit with AI*. Body: `{ prompt }` |
| POST | `/api/edits/:id/render` | Render. Body: `{ format: mp4 \| webm \| gif \| still, quality: high \| standard \| draft, scale, stillAt, jobId }` |
| POST | `/api/script-video` | Script → video. Body below |

### Script → video body

```json
{
  "script": "Once upon a time…",
  "title": "The little elephant",
  "aspect": "9:16",
  "style": "warli",
  "mode": "story",
  "illustration": "ai",
  "voice": "af_heart",
  "language": "en",
  "captions": "karaoke",
  "jobId": "job_123"
}
```

## Script Writer

| Method | Path | Notes |
|---|---|---|
| POST | `/api/writer` | `{url, videoType?, minutes?, language?, model?, jobId?}` → new script, title, description and tags from a YouTube link |
| GET | `/api/writer` | Saved scripts, newest first |
| PUT | `/api/writer/:id` | Save edits (title, description, tags, script) |
| GET | `/api/writer/models` | Ollama models (cloud ones marked) |
| GET | `/api/writer/file/:name` | Download the `.md` / `.txt` |

## Assets and characters

| Method | Path | Notes |
|---|---|---|
| GET | `/api/assets` | Search the asset library |
| POST | `/api/assets/generate` | Draw a missing asset in a style |
| POST | `/api/assets/import`, `/api/assets/inbox`, `/api/assets/local` | Bring in your own pictures and media |
| POST | `/api/assets/licence` | Set an asset's licence |
| GET | `/api/edits/:id/licences` | Licence check for an edit |
| GET / POST / PUT | `/api/vector/cast`, `/api/vector/cast/:id` | The story cast |
| POST | `/api/vector/character`, `/api/vector/environment`, `/api/vector/plan` | Procedural drawings and story planning |

## Files

| Path | What |
|---|---|
| `/media/uploads/…` | Uploaded files and voice-overs |
| `/media/exports/…` | Rendered files |
| `/media/generated/…` | Stable Diffusion paintings (cache) |
| `/api/download/:fileName` | Download an export |
