# Sources & credits

Everything ClipForge AI uses, links to, or took ideas from — with what it is used for and its licence.
Icons are each site's favicon (shown via Google's favicon service when viewed on GitHub).

> **Licences matter for client work.** Rows marked ⚠️ have conditions that affect commercial use — read the note.

<sub>Legend: 🔧 runs inside ClipForge · 🧠 AI model · 📦 library · 🖼️ asset source · 💡 idea / reference only (no code copied)</sub>

## Engines & tools

| | Name | Used for | Licence |
|---|---|---|---|
| <img src="https://www.google.com/s2/favicons?domain=ffmpeg.org&sz=32" width="16"> | 🔧 [FFmpeg](https://ffmpeg.org) | Probing, audio extraction, crop/fit/zoom, ASS captions, encoding, muxing | LGPL-2.1+ / GPL (depends on build) |
| <img src="https://www.google.com/s2/favicons?domain=github.com&sz=32" width="16"> | 🔧 [whisper.cpp](https://github.com/ggml-org/whisper.cpp) | Local speech-to-text with word timings | MIT |
| <img src="https://www.google.com/s2/favicons?domain=huggingface.co&sz=32" width="16"> | 🧠 [Whisper ggml models](https://huggingface.co/ggerganov/whisper.cpp) | Model weights downloaded on first use | MIT (OpenAI Whisper) |
| <img src="https://www.google.com/s2/favicons?domain=ollama.com&sz=32" width="16"> | 🔧 [Ollama](https://ollama.com) | Runs the local LLMs (clip ranking, Edit with AI, scene planning, asset design) | MIT |
| <img src="https://www.google.com/s2/favicons?domain=qwenlm.github.io&sz=32" width="16"> | 🧠 [Qwen 2.5 3B](https://huggingface.co/Qwen/Qwen2.5-3B-Instruct) | Default clip-ranking model | ⚠️ listed as `qwen-research` licence on Hugging Face — read its terms before client use; or switch `OLLAMA_MODEL` to an Apache-2.0 model such as `qwen2.5:7b` |
| <img src="https://www.google.com/s2/favicons?domain=qwenlm.github.io&sz=32" width="16"> | 🧠 [Qwen 3.5 4B](https://ollama.com/library) | Edit with AI / storyboard model (`OLLAMA_EDIT_MODEL`) | Check the model card in Ollama before commercial use |
| <img src="https://www.google.com/s2/favicons?domain=heygen.com&sz=32" width="16"> | 🔧 [HyperFrames](https://hyperframes.heygen.com) ([GitHub](https://github.com/heygen-com/hyperframes)) | Motion captions, hook titles, intro cards (clip export); TTS and transcription CLI | Apache-2.0 |
| <img src="https://www.google.com/s2/favicons?domain=huggingface.co&sz=32" width="16"> | 🧠 [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) | Natural local voice-over (via HyperFrames, optional) | Apache-2.0 |
| <img src="https://www.google.com/s2/favicons?domain=remotion.dev&sz=32" width="16"> | 🔧 [Remotion](https://www.remotion.dev) | Editor preview (Player), all editor/story renders, asset PNG renders | ⚠️ Remotion licence — free for individuals and companies ≤ 3 people; larger for-profit teams need a [company licence](https://www.remotion.dev/docs/license) |
| <img src="https://www.google.com/s2/favicons?domain=airbnb.io&sz=32" width="16"> | 📦 [lottie-web](https://github.com/airbnb/lottie-web) + [@remotion/lottie](https://www.remotion.dev/docs/lottie) | Plays Lottie animations in videos | MIT / Remotion licence |
| <img src="https://www.google.com/s2/favicons?domain=gsap.com&sz=32" width="16"> | 📦 [GSAP](https://gsap.com) | Timelines inside HyperFrames compositions | GSAP standard licence (free, incl. commercial) |
| <img src="https://www.google.com/s2/favicons?domain=github.com&sz=32" width="16"> | 🔧 [yt-dlp](https://github.com/yt-dlp/yt-dlp) | Local YouTube download | Unlicense |
| <img src="https://www.google.com/s2/favicons?domain=d3js.org&sz=32" width="16"> | 📦 [d3-geo](https://github.com/d3/d3-geo) + [topojson-client](https://github.com/topojson/topojson-client) | Map projections, globe, great-circle routes in motion graphics | ISC |
| <img src="https://www.google.com/s2/favicons?domain=naturalearthdata.com&sz=32" width="16"> | 🖼️ [world-atlas](https://github.com/topojson/world-atlas) / [Natural Earth](https://www.naturalearthdata.com) | Country shapes for map animations | ISC / public domain |
| <img src="https://www.google.com/s2/favicons?domain=sharp.pixelplumbing.com&sz=32" width="16"> | 📦 [sharp](https://sharp.pixelplumbing.com) / [libvips](https://www.libvips.org) | Background removal, trimming, PNG output for imported images | Apache-2.0 / LGPL-2.1 |

## App libraries

| | Name | Used for | Licence |
|---|---|---|---|
| <img src="https://www.google.com/s2/favicons?domain=react.dev&sz=32" width="16"> | 📦 [React](https://react.dev) | UI | MIT |
| <img src="https://www.google.com/s2/favicons?domain=vite.dev&sz=32" width="16"> | 📦 [Vite](https://vite.dev) | Dev server and build | MIT |
| <img src="https://www.google.com/s2/favicons?domain=tailwindcss.com&sz=32" width="16"> | 📦 [Tailwind CSS](https://tailwindcss.com) | Styling | MIT |
| <img src="https://www.google.com/s2/favicons?domain=motion.dev&sz=32" width="16"> | 📦 [Motion](https://motion.dev) | Page transitions, card entrances, hover springs | MIT |
| <img src="https://www.google.com/s2/favicons?domain=expressjs.com&sz=32" width="16"> | 📦 [Express](https://expressjs.com) | Local API server | MIT |
| <img src="https://www.google.com/s2/favicons?domain=lucide.dev&sz=32" width="16"> | 📦 [Lucide](https://lucide.dev) | UI icons | ISC |
| <img src="https://www.google.com/s2/favicons?domain=fonts.google.com&sz=32" width="16"> | 📦 [Google Fonts](https://fonts.google.com): DM Sans, Plus Jakarta Sans, JetBrains Mono | App typography | SIL Open Font License |
| <img src="https://www.google.com/s2/favicons?domain=nasa.gov&sz=32" width="16"> | 🌍 [NASA Blue Marble Next Generation](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/) | Satellite photo under maps (`npm run maps:setup`, saved in `data/maps/`) | Public domain (NASA Earth Observatory) |

## Asset sources (you download; ClipForge imports)

| | Site | Licence in short | ClipForge marks it as |
|---|---|---|---|
| <img src="https://www.google.com/s2/favicons?domain=cleanpng.com&sz=32" width="16"> | 🖼️ [CleanPNG](https://www.cleanpng.com) | Differs per image; user uploads; has a DMCA process | `?` check each image page |
| <img src="https://www.google.com/s2/favicons?domain=pngimg.com&sz=32" width="16"> | 🖼️ [pngimg](https://pngimg.com) ([licence](https://pngimg.com/license)) | ⚠️ CC BY-NC 4.0 — non-commercial only, attribution required | `NC` |
| <img src="https://www.google.com/s2/favicons?domain=svgrepo.com&sz=32" width="16"> | 🖼️ [SVG Repo](https://www.svgrepo.com) ([licensing](https://www.svgrepo.com/page/licensing/)) | Mostly SVG Repo License (commercial OK, no credit); some CC BY-NC or logo licences | `?` check the icon page |
| <img src="https://www.google.com/s2/favicons?domain=iconscout.com&sz=32" width="16"> | 🖼️ [IconScout free Lottie](https://iconscout.com/free-lottie-animations) | Free assets: commercial use with attribution to IconScout | `✓` + credit line added on render |
| <img src="https://www.google.com/s2/favicons?domain=gemini.google.com&sz=32" width="16"> | 🧠 [Google Gemini](https://gemini.google.com) | AI-generated illustrations imported from `Downloads/16-11-2026` (carry Google's invisible SynthID watermark) | `?` until you confirm; label AI-generated where required |
| <img src="https://www.google.com/s2/favicons?domain=kenney.nl&sz=32" width="16"> | 🖼️ [Kenney](https://kenney.nl/assets) | CC0 — safe for anything | suggested |
| <img src="https://www.google.com/s2/favicons?domain=openclipart.org&sz=32" width="16"> | 🖼️ [Openclipart](https://openclipart.org) | Public domain | suggested |
| <img src="https://www.google.com/s2/favicons?domain=opengameart.org&sz=32" width="16"> | 🖼️ [OpenGameArt](https://opengameart.org) | Mixed — filter by CC0 | suggested |

ClipForge's own drawn assets (`assets/library/generated/`) and art styles are made in code in this repo — no third-party artwork.

## Ideas & references (no code copied)

| | Project | What we took from it | Licence |
|---|---|---|---|
| <img src="https://www.google.com/s2/favicons?domain=github.com&sz=32" width="16"> | 💡 [AutoClip](https://github.com/zhouxiaoka/autoclip) | Platform presets, pipeline progress, publish-ready clips | MIT |
| <img src="https://www.google.com/s2/favicons?domain=github.com&sz=32" width="16"> | 💡 [video-shotcraft](https://github.com/Vincentwei1021/video-shotcraft) ([site](https://vincentwei1021.github.io/video-shotcraft/)) | Shot recipes: 2.5D camera, hand-off transitions (whip pan, iris) | Apache-2.0 |
| <img src="https://www.google.com/s2/favicons?domain=github.com&sz=32" width="16"> | 💡 [lemo-opuscar](https://github.com/lemomo-ai/lemo-opuscar) | General direction practice (establish → move → hand off) | MIT code; ⚠️ docs/prompts CC BY-NC — not used |
| <img src="https://www.google.com/s2/favicons?domain=github.com&sz=32" width="16"> | 💡 [OpenMotion](https://github.com/nexu-io/openmotion) | Asset library + timeline studio pattern | Apache-2.0 |
| <img src="https://www.google.com/s2/favicons?domain=github.com&sz=32" width="16"> | 💡 [OpenFilm](https://github.com/openfilm/openfilm) | Frames as a pure function of time; storyboard idea | MIT |
| <img src="https://www.google.com/s2/favicons?domain=synfig.org&sz=32" width="16"> | 💡 [Synfig](https://www.synfig.org) | Candidate for rigged 2D character animation (not integrated yet) | GPL-3.0 |
| <img src="https://www.google.com/s2/favicons?domain=youtube.com&sz=32" width="16"> | 💡 [“Vox-Style Motion Graphics” (RandomAI, YouTube)](https://youtu.be/uIHJvUVaB34) | Style reference for the Vox templates (title only — video not analysed) | — |

## Art-style references (traditional art forms)

The ten art styles are original procedural drawings inspired by these traditions:

| | Style | Reference |
|---|---|---|
| <img src="https://www.google.com/s2/favicons?domain=wikipedia.org&sz=32" width="16"> | Madhubani | [Madhubani art](https://en.wikipedia.org/wiki/Madhubani_art) |
| <img src="https://www.google.com/s2/favicons?domain=wikipedia.org&sz=32" width="16"> | Ink wash | [Ink wash painting](https://en.wikipedia.org/wiki/Ink_wash_painting) |
| <img src="https://www.google.com/s2/favicons?domain=wikipedia.org&sz=32" width="16"> | Shadow puppet | [Tholu bommalata](https://en.wikipedia.org/wiki/Tholu_bommalata) · [Wayang kulit](https://en.wikipedia.org/wiki/Wayang_kulit) |
| <img src="https://www.google.com/s2/favicons?domain=wikipedia.org&sz=32" width="16"> | Paper cutout | [Cutout animation](https://en.wikipedia.org/wiki/Cutout_animation) |
| <img src="https://www.google.com/s2/favicons?domain=wikipedia.org&sz=32" width="16"> | Stained glass | [Stained glass](https://en.wikipedia.org/wiki/Stained_glass) |
| <img src="https://www.google.com/s2/favicons?domain=wikipedia.org&sz=32" width="16"> | Anime | [Anime](https://en.wikipedia.org/wiki/Anime) |
| <img src="https://www.google.com/s2/favicons?domain=wikipedia.org&sz=32" width="16"> | Warli | [Warli painting](https://en.wikipedia.org/wiki/Warli_painting) |
| <img src="https://www.google.com/s2/favicons?domain=wikipedia.org&sz=32" width="16"> | Blueprint | [Blueprint](https://en.wikipedia.org/wiki/Blueprint) |
| <img src="https://www.google.com/s2/favicons?domain=wikipedia.org&sz=32" width="16"> | Ukiyo-e | [Ukiyo-e](https://en.wikipedia.org/wiki/Ukiyo-e) |
| <img src="https://www.google.com/s2/favicons?domain=wikipedia.org&sz=32" width="16"> | Miniature painting | [Indian miniature paintings](https://en.wikipedia.org/wiki/Indian_miniature_paintings) |
