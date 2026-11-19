---
name: nafay-motion
description: Make a short animated video drawn entirely in code, in one of three Nafay 3D Style Library looks — Creator Motion Graphics (dark, punchy kinetic captions for reels and hooks), Chalk Talk (a teacher chalking a lesson on a green board) or Clean Tech (bright product explainer with UI cards and one blue accent). Storyboard first, then an HTML player with synthesised sound, then an MP4. Use when someone asks for a motion graphic, kinetic-type reel, chalkboard explainer, product explainer or animated short "in the Creator / Chalk Talk / Clean Tech style", or for a 15–40 s animated explainer of a topic without footage.
---

# Nafay motion styles

## The result
A 15–40 second animated film about the person's topic that looks, moves and sounds exactly like its style's reference, good enough to post as is. It plays as one self-contained HTML page (play, scrub, sound, loop, load a voiceover) and renders to a 1280×720 MP4 with its own synthesised sound.

## What defines it
The style's medium stays and the story changes. The reference file in `styles/<style>.js` is the ground truth for how the style looks, moves and sounds; a new film keeps its helpers, background, finishing pass and sound kit, and replaces only the story (each style's card lists exactly what to replace). A film that restyles the medium, swaps fonts or adds effects the reference does not have is not this kind of film.

## What has to be true
- Every frame is a pure function of t; all randomness comes from CM.rng / CM.noise1. window.seek, DURATION, scoreSound and SFX stay exposed.
- The sound score reads the same TL times as the picture; every visible event that the card gives a sound has it.
- Legibility at 1280×720 meets the style card's minimum sizes, and each frame draws in well under 50 ms (the renderer reports avgMs and worstMs).
- Facts and numbers are the person's or are checked; anything assumed is listed under the storyboard, and illustrative figures say "example" on screen. Names, brands, receipts and messages are invented and could not pass as real.
- The person approves a storyboard (6–10 stills drawn with the film's own code) before the full film is built.

## What you have
- `styles/<style>.md` — the style card: look, pace, legibility, sound map, what to replace. `styles/<style>.js` — the working reference story (TL, scenes, scoreSound, BOARD and ASSUME for the storyboard).
- `scripts/core.js` — CM helpers and the SFX sound kit, shared by all three; never edited.
- `node .claude/skills/nafay-motion/scripts/build.cjs <style-id> <story.js> <out-dir> [--title "Name"]` writes `<slug>-storyboard.html` (stills from BOARD, with the assumptions) and `<slug>.html` (the player). Style ids: creator-motion-graphics, chalk-talk, clean-tech.
- `node .claude/skills/nafay-motion/scripts/render.cjs <player.html> <out.mp4>` (run from the repo root; needs puppeteer-core, Chrome or Edge, ffmpeg) seeks every frame, renders the sound offline with SFX.render and muxes an MP4. With a voiceover, render the effects with `{ voiceover: true }` and mix them under it.
- In ClipForge's Clip workspace the same looks are caption styles (`creator`, `chalk`, `cleantech`) with optional intro and end cards (`styleCards`, `outroText`), built in `server/styledCaptions.ts`; use those for footage, this skill for code-drawn films.
- In ClipForge script videos the looks are motion graphics called by tag with values only, e.g. `[creatorCounter 200 "real leads"]`, `[chalkChart "L:7, M:15" "Title" %]`, `[cleanChecklist "a; b; c"]` (12 effects in the "Creator · Chalk · Clean Tech" category, `src/motion/renderers/nafay.tsx`; list in docs/site/script-tags.md).
- Work files go in `data/director/<slug>/`, finished videos in `exports/` (both git-ignored). Storyboards and players can be published as Artifacts.

## With the person
Ask for the topic or script, the style (recommend one: Creator for social hooks, Chalk Talk for one concept or a bit of maths, Clean Tech for products and software), length and whether a voiceover is coming. Show the storyboard and wait for their OK. When done, give the player link, the MP4 path, the frame timings, the loudness, and every assumed fact, and say what of theirs (real figures, a script, a voiceover, brand colours for client work) would make it better.
