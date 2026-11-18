# Script Writer (YouTube link → new script)

Paste a YouTube link and ClipForge writes a **new, more hooked script** from it, with effect [tags] already in place. It also writes a **YouTube title, description and tags**. Everything is saved as `.md` and `.txt` files so nothing gets lost.

Open it from **Writer** in the top bar.

## How to use it

1. Paste the link (youtube.com, youtu.be or a Shorts link).
2. Choose:
   - **Video type**: Storytelling, Documentary, Fun or Tech explainer. This sets the tone and which explainer graphics get tagged.
   - **Length**: the same as the source (1–5 min), or 30 s, 1, 2, 3 or 5 minutes.
   - **Language**: the same as the video, English or Hindi.
   - **AI model**: any Ollama model on this computer. Bigger models write better scripts. Models marked *online* send the transcript to the internet.
3. Press **Write script**. A 2-minute video takes about 30 seconds. **Cancel** stops it at any time.
4. Check the result, edit anything, and press **Save edits**.
5. **Make this video** opens the script in [Script → video](#/docs/script-to-video), with the video type, art style and captions already set.

## What it does

| Step | What happens |
|---|---|
| Read | Gets the video's subtitles (manual or auto). If there are none, it downloads the audio and transcribes it with Whisper. |
| Facts | Pulls out **every** fact, number, name and date, in chunks, so long videos aren't cut short. It drops the source channel's own promotion ("subscribe", "follow us", website links, sponsors). |
| Write | Rewrites the facts as a new script with a hook, a build-up and a strong ending, using different wording and structure from the original. |
| Tag | ClipForge adds the [tags] itself with fixed rules, so they are always valid. The hook gets `[wordReveal]` (`[pushIn]` for stories). Years get `[timelineHistory]`, steps get `[processExplain]`, before/after numbers get `[comparison]` and quotes get `[quoteStatement]`. Big numbers get `[bigStat]` and the ending gets `[pullOut]`. Each script gets at most four graphics. |
| Package | Writes a YouTube title (under 70 characters), a description with bullet points, and 12–18 search tags. |
| Save | Saves `data/scripts/<date>-<id>-<title>.md`, `.txt` and `.json`. |

## The saved files

Each `.md` and `.txt` file has, in this order:

- YouTube title
- Description
- Tags
- Script with [tags]
- **every fact kept** from the source
- the source link and channel
- the **full original transcript**

You can always check the new script against the original.

Download the files from the Writer page, or open them in the `data/scripts/` folder. **Saved scripts** on the right lists every script you've written.

## Tips

- **Check the facts.** Small models sometimes add claims that aren't in the source, especially in the description. The *Facts kept* list shows what the video actually said.
- **Pick the right type.** Documentary and Tech add timelines, comparisons and stats. Storytelling keeps graphics to a minimum.
- **Use a bigger model for long videos.** `qwen2.5:7b` or larger writes tighter scripts than a 3–4B model.
- **Make it your own.** Rewriting someone else's video is fine for research and commentary. For publishing, add your own angle and credit the source where it's due.

## Settings

| `.env` key | Default | What it does |
|---|---|---|
| `WRITER_MODEL` | `OLLAMA_EDIT_MODEL` | Default model for the Writer |
| `CLIPFORGE_DATA_DIR` | `data/` | The scripts are saved in `<data>/scripts` |

## API

| Method | Path | What it does |
|---|---|---|
| `POST` | `/api/writer` | `{url, videoType?, minutes?, language?: "same"\|"en"\|"hi", model?, jobId?}` writes a script; follow progress at `/api/jobs/:jobId` |
| `GET` | `/api/writer` | Saved scripts, newest first |
| `PUT` | `/api/writer/:id` | `{title?, description?, tags?, script?}` saves edits (the files are rewritten) |
| `GET` | `/api/writer/models` | Ollama models, with *cloud* marked |
| `GET` | `/api/writer/file/:name` | Downloads a `.md` or `.txt` file |
