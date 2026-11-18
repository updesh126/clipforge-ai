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
| Storyboard | A second AI pass gives every paragraph a real setting and one concrete picture, written as `[place: …]` (only when the place changes) and `[scene: …]`, so the AI paintings match the words. |
| Tag | ClipForge adds the other [tags] itself with fixed rules, so they are always valid. See the list below. |
| Scene plan | Runs the Script → video planner on the new script and explains **every line as a task**: what we see, where and when, the camera move, the explainer and on-screen graphics, how the scene opens, the mood, and whether it becomes a moving clip. Shown under the script and saved in the files. |
| Package | Writes a YouTube title (under 70 characters), a description with bullet points, and 12–18 search tags. |
| Save | Saves `data/scripts/<date>-<id>-<title>.md`, `.txt` and `.json`. |

## Write with another AI (ChatGPT, Claude, Gemini…)

Prefer another AI, or have no YouTube link? Open **Write with another AI** on the Writer page:

1. **Copy the prompt** (or download it as .md). It is built for the video type, length and language picked on the right. It teaches the other AI the format (one paragraph per scene, plain narration), the scene tags `[place:]`, `[scene:]`, `[time:]` and `[title:]`, the effect tags that suit that video type (only tags ClipForge really has), a structure and a short example. Replace its last line with your topic, notes or a transcript.
2. **Paste the script it writes** into the box and press **Check it**. You see the number of scenes, the length, how many scenes describe their picture, and any problems:
   - headings or "Scene 1:" labels, which would be read aloud
   - code blocks and bullet points
   - stage directions in (round brackets)
   - tags ClipForge doesn't know, which are skipped

   **Tidy up** removes code blocks, headings, bold and "Scene 1:" labels for you.
3. **Make this video** opens it on the Script page with the video type, art style and captions set (the title comes from its `[title: …]`). Press **Plan scenes** to preview every line, then **Create video**.

Online AIs send your topic and notes to their servers, so don't paste anything private or confidential.

## Tags the Writer adds

| When the line has… | Tag |
|---|---|
| The opening hook | `[wordReveal]` (stories: `[pushIn]`), documentaries also `[filmGrain]` |
| Years across the script | `[timelineHistory events="…"]` |
| A country or big city (one map per country) | `[mapInvestigation country=… city=…]` |
| "In 2016 … by 2024 …" numbers | `[comparison …]` |
| "first … then … finally" | `[processExplain steps="…"]` |
| A quotation | `[quoteStatement text="…" source="…"]` |
| A big number (%, million, crore…) | `[bigStat value=… suffix="…"]` |
| "Ten years ago … today …" | `[thenVsNow labelA=… textA=… labelB=Today textB=…]` |
| "Name, a role," | `[lowerThird text="Name" subtitle="Role"]` |
| "reported / announced" | `[newspaperZoom …]` |
| "banned / approved / fake…" | `[stampReveal text="BANNED"]` |
| "A, B and C" | `[cardList items="A; B; C"]` (sticker chips) |
| "the first / biggest / record…" | `[markerHighlight text="…"]` |
| "But… / However…" | `[handwrittenNote text="But…"]` |
| Every other line | a camera move: `[pushIn]` `[panRight]` `[panLeft]` `[tiltUp]`; the last line `[pullOut]` |
| Every 4th paragraph | a chapter cut: `[transition: paperTearTransition]` (tech: wipe, fun: whip pan) |

Full-screen explainers never come two in a row, and small accents fill the gaps between them.

## The saved files

Each `.md` and `.txt` file has, in this order:

- YouTube title
- Description
- Tags
- Script with [tags]
- Scene plan (each line: what we see, where, camera, on screen, opening, mood, Motion)
- **every fact kept** from the source
- the source link and channel
- the **full original transcript**

You can always check the new script against the original.

Download the files from the Writer page, or open them in the `data/scripts/` folder. **Saved scripts** on the right lists every script you've written. To remove several at once, click **Select**, tick them (or **Select all**) and click **Delete N scripts**.

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
