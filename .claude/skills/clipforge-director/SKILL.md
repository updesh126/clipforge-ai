---
name: clipforge-director
description: Direct and produce a finished short video with ClipForge AI (this repo) — story, explainer, kids tale, folk story, promo or reel — from an idea, a topic or a rough script. Plans the story, writes a scene-by-scene script that ClipForge reads well, picks the art style, proves the look with a test painting, generates the video through the local server, checks rendered stills against a failure checklist, repaints weak scenes, and renders the final MP4. Use when the user asks to make, create or generate a video/short/reel/story video with ClipForge, wants better results or prompts for a ClipForge video, or asks which art style suits a topic. Not for editing ClipForge's source code or for clipping an existing long video (that is the Clip workspace).
---

# ClipForge director

You are the director. ClipForge is the studio: it voices, times, paints and assembles. Your job is the part it can't do alone — a good story, a script it reads well, the right style, and quality control.

Helper: `node .claude/skills/clipforge-director/scripts/cf.mjs <command>` (run from the repo root; `node …/cf.mjs` with no command lists everything). Work files go in `data/director/<slug>/` (git-ignored).

## 0. Preflight

`cf.mjs health`. If the server isn't reachable, start it (the app's dev server, `npm run dev`) and wait for it. If Stable Diffusion is missing, AI painting isn't available — offer **vector** illustration instead, or `npm run setup` to install it.

## 1. Take the brief — one round of questions

Ask everything you need **in one message**, with a recommended default for each, so the user can just say "ok":

| Ask | Default |
|---|---|
| Topic / story and who it's for (kids, general, business…) | — |
| Length | 45–75 s (5–8 scenes) |
| Format | 9:16 for Shorts/Reels, 16:9 for YouTube |
| Narration language | English (`en`) or Hindi (`hi`) |
| Art style | your recommendation from step 2, with one alternative |
| Illustration | `ai` (Stable Diffusion paintings) if available, else `vector` |
| Storyboard first? | No — but offer it for anything client-facing |

If the user already gave a full script, skip the story questions and only confirm format, style and illustration.

## 2. Choose the style

`cf.mjs styles` lists every style with best-for / avoid-for. Read the chosen `src/artstyles/<id>.json` for its look, palette, characters, environment motifs and motion. Match **topic and audience**, not taste: Warli or Madhubani for Indian village and folk stories, ink wash for calm nature, blueprint for how-it-works, storybook or paper cutout for children, anime for hype, miniature for royalty and history. Never use a style its `avoidFor` rules out.

## 3. Shape the story (write `data/director/<slug>/TREATMENT.md`)

1. **Three candidate structures** in two lines each (journey, before/after, problem → fix, countdown, mystery → reveal…). Pick one and say why. The first idea is usually a cliché — check it against the other two.
2. **Logline** — one sentence. **Arc** — setup → turn → ending.
3. **Cast** — every person once, with a fixed visual description (age, clothes and colours, one distinctive detail). Reuse the exact name every time they appear.
4. **Scene list** — for each scene: place + time of day, who is on screen and doing what, the camera move and **why** (push in for emotion, pan to reveal, pull out for endings), and the one line the narration says.

Show the user the logline and scene list (short) before producing, unless they said to just go.

## 4. Write the script ClipForge reads well

Full rules: `docs/STORY_SCRIPT_GUIDE.md`. The ones that matter most:

- **One paragraph = one scene.** 1–2 sentences, about 20–35 words (8–12 s of voice). Blank line between scenes.
- **Name the place and the time** in each scene ("at the river at sunrise"). Without a place, the last one stays.
- **Name the character** in every scene they're in ("Meera", not only "she") — named characters are always painted; pronouns only work when there's one character.
- **Concrete, visible nouns and action verbs**: lantern, elephant calf, clay pot; walks, lifts, follows. Not feelings or abstractions ("hope", "the wind") — they can't be painted.
- **Atmosphere words pay off**: rain, snow, fog/mist, fireflies, lamps/fire, festival, stars, sunrise/sunset each add a matching motion overlay.
- A number ("40%", "3 crore") gives a stat card; a "quote in quotation marks" gives a quote card. Use at most one per video unless it's an explainer.
- Hook in scene 1 (a surprising image), a turn near the end, a quiet final image (same place, new time of day works well).
- Hindi narration: write in Devanagari and set `"language": "hi"` with a Hindi voice.

## 5. Prove the look — one test painting (AI illustration only)

Paint the **key scene** before making the whole video:

`cf.mjs paint --style <id> --aspect <9:16|16:9> --prompt "<who> in <place> at <time>, <doing what>, <cast description>"`

Open the PNG (Read tool) and check it against section 7. If the style or subject is off, adjust the wording (subject first, concrete nouns, the cast description) and repaint once or twice. Show it to the user if they asked for a storyboard. Note what worked — use the same wording in the script.

## 6. Produce

Write `data/director/<slug>/brief.json`:

```json
{ "title": "…", "script": "scene 1…\n\nscene 2…", "aspect": "9:16", "style": "storybook", "mode": "story", "illustration": "ai", "language": "en", "voice": "af_heart", "captions": "karaoke" }
```

`cf.mjs make data/director/<slug>/brief.json` — prints live progress (scene x of n, painted count) and the edit id at the end. About 25–40 s per scene with AI painting.

## 7. Check every scene

`cf.mjs scenes <editId>` lists scenes with their picture files; `cf.mjs stills <editId>` renders the middle of every scene. **Look at every still** and the painting files, and check:

| Check | Fix |
|---|---|
| The named character is visible and looks the same in each scene (face, hair, clothes colours) | `cf.mjs repaint <id> <n> --prompt "…full cast description…"` with a new `--seed` |
| The scene shows what the narration says (place, action, time of day) | repaint with the place and action first in the prompt |
| Style is right (Madhubani colourful, Warli white-on-terracotta, ukiyo-e waves…) | repaint; if it drifts again, the style's `sd_hint` in `scripts/data/art-style-presets.json` may need a cue (see clipforge-art-style skill) |
| No painted text, letters, extra limbs, duplicated people | repaint with a new seed |
| Title / quote banner small and readable, not covering a face | `cf.mjs ai <id> "move the title to the bottom"` or edit in the app |
| Captions readable over the picture | change caption look in the app (bold / clean) |
| Atmosphere fits (no stars at noon, no confetti at a funeral) | `cf.mjs ai <id> "remove the confetti in scene 3"` |

Repaint at most twice per scene; if it still fails, rewrite that scene's sentence (more concrete) and regenerate the video.

## 8. Deliver

`cf.mjs render <editId>` (MP4, high quality) → prints the file in `data/exports/`. Tell the user: the MP4 path, the edit link (`http://localhost:3000/#/edit/<id>` — they can change anything there), the style and why, and anything you couldn't fix. Mention licences only if they used their own assets.

## Failures seen most

- Script paragraphs too long → scenes split oddly and pictures don't match the words. Keep 1–2 sentences.
- Pronoun-only scenes with two or more characters → the main character disappears from the picture.
- Abstract scenes ("Time passed and hope grew") → generic, empty paintings. Always show something.
- Picking a style for looks against its `avoidFor` (anime for a solemn history, Warli for a tech product).
- Skipping the stills check — most bad videos have one or two weak scenes that a repaint fixes in 30 seconds.
