# Stable Diffusion setup

**AI painting** uses Stable Diffusion running on your own GPU through [ComfyUI](https://github.com/comfyanonymous/ComfyUI). ClipForge does not run the model itself: it sends a text-to-image job to ComfyUI on `http://127.0.0.1:8188` and saves the result.

## Requirements

| Part | Minimum | Recommended |
|---|---|---|
| GPU | NVIDIA with 8 GB VRAM | 12 GB or more (an RTX 3060 12 GB works well) |
| Disk | 10 GB free | 20 GB for a second model |
| Speed | — | About 15–25 s per scene with SDXL at 28 steps |

## Quick install (Windows)

One command downloads ComfyUI and the SDXL model (about 9 GB in total). It needs [7-Zip](https://www.7-zip.org/) (`winget install 7zip.7zip`).

```bash
npm run comfy:setup
```

It reuses an existing `..\ComfyUI` install, otherwise installs into `%LOCALAPPDATA%\ClipForge\ComfyUI` — never inside the project folder. It installs SDXL and the Fast Motion model; add `-Motion wan` or `-Motion both` for the Best one (see below). Big downloads resume where they stopped — if your connection drops, just run it again. Add `-Dir D:\ComfyUI` to choose another folder, or `-SkipModel` if you already have a model.

**That's all.** `npm run dev` now starts ComfyUI for you in the background, and a run with *AI painting* starts it too if it was stopped. Check everything with `npm run setup`.

## 1. Install ComfyUI by hand (Windows)

1. Download **ComfyUI_windows_portable_nvidia.7z** from the [ComfyUI releases](https://github.com/comfyanonymous/ComfyUI/releases) (about 2 GB).
2. Extract it with [7-Zip](https://www.7-zip.org/), for example to `D:\ComfyUI_windows_portable`.
3. Leave it closed for now.

On macOS or Linux, follow the manual install in the ComfyUI README.

## 2. Add a model

Download an **SDXL** checkpoint and put the `.safetensors` file in:

```text
ComfyUI_windows_portable\ComfyUI\models\checkpoints\
```

| Model | Size | Notes |
|---|---|---|
| [SDXL base 1.0](https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0) (`sd_xl_base_1.0.safetensors`) | 6.9 GB | Official, open licence, good default |
| An SDXL **Lightning** or **Turbo** fine-tune | ~6.9 GB | 4–8 steps, much faster — set `SD_STEPS=6` and `SD_CFG=2` |

Check each model's licence before client work.

## 3. Start ComfyUI

You don't need to. ClipForge finds ComfyUI in `SD_COMFY_DIR`, `..\ComfyUI` or `%LOCALAPPDATA%\ClipForge\ComfyUI` (`~/ClipForge/ComfyUI` on macOS/Linux) and starts it:

- when `npm run dev` starts (turn this off with `SD_AUTOSTART=false`)
- when you create a video with *AI painting* and it isn't running
- with `npm run comfy`, if you want it without ClipForge

It runs in the background and keeps running across `npm run dev` reloads. Its output goes to `data/comfyui.log`. You can still start it by hand with `run_nvidia_gpu.bat`; ClipForge reuses a ComfyUI that is already running.

## 4. Check it in ClipForge

Open the **Script** page and choose **Illustration → AI painting**. It should say *Stable Diffusion ready · sd_xl_base_1.0.safetensors*. You can also test from a terminal:

```bash
curl http://localhost:3000/api/sd/status
```

```bash
curl -X POST http://localhost:3000/api/sd/test -H "Content-Type: application/json" -d "{\"style\":\"warli\"}"
```

The test returns a URL such as `/media/generated/<hash>.png`.

## Motion (image-to-video)

Moving scenes use one of two models in the same ComfyUI. The setup wizard asks which; you can add the other later.

| | **Fast** — LTX-Video 2B distilled | **Best** — Wan 2.2 TI2V 5B |
|---|---|---|
| Speed on a 12 GB GPU | ~30–60 s per clip | several minutes per clip |
| Motion | good, can drift on long clips | smoother, holds the painting's style better |
| Files | `checkpoints/ltxv-2b-0.9.8-distilled.safetensors` (6.3 GB), `text_encoders/t5xxl_fp8_e4m3fn_scaled.safetensors` (5.2 GB) | `diffusion_models/wan2.2_ti2v_5B_fp16.safetensors` (10 GB), `text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors` (6.7 GB), `vae/wan2.2_vae.safetensors` (1.4 GB) |
| Install | `npm run comfy:setup -- -Motion ltx` | `npm run comfy:setup -- -Motion wan` |

`-Motion both` installs both (29.7 GB); then the Script page shows **Fast** and **Best** under Motion. `SD_VIDEO_ENGINE` sets the default; `SD_VIDEO_STEPS` (8) and `SD_WAN_STEPS` (20) set the sampling steps.

## Settings

Put these in `.env` (see [Settings](#/docs/settings)):

| Setting | Default | Notes |
|---|---|---|
| `SD_URL` | `http://127.0.0.1:8188` | Where ComfyUI listens |
| `SD_CHECKPOINT` | first SDXL model | Exact file name as ComfyUI lists it |
| `SD_STEPS` | `28` | Fewer = faster; 6–8 for Lightning/Turbo |
| `SD_CFG` | `6` | 1.5–2 for Lightning/Turbo |
| `SD_SAMPLER` | `dpmpp_2m` | Any ComfyUI KSampler name |
| `SD_SCHEDULER` | `karras` | Any ComfyUI scheduler name |
| `SD_COMFY_DIR` | auto | Folder of your ComfyUI install, if it isn't in `..\ComfyUI` or `%LOCALAPPDATA%\ClipForge\ComfyUI` |
| `SD_AUTOSTART` | `true` | `false` = start ComfyUI only when a painting is needed |
| `SD_COMFY_ARGS` | — | Extra ComfyUI arguments, e.g. `--lowvram` |
| `SD_PREVIEW` | `taesd` | Live preview while painting: `taesd`, `latent2rgb`, `auto` or `none` |

## How prompts are built

1. The story plan gives each scene a place, time of day, characters and mood.
2. Every person is cast once (age, skin, hair, clothes) and described the same way in every scene.
3. `buildSdPrompt()` puts the style first (from `src/artstyles/<id>.json`), then the scene, the characters, lighting and texture.
4. The negative prompt joins the style's avoid lists with general fixes (text, extra limbs, blur).
5. One seed is used for the whole story, which helps keep the look consistent.

## Troubleshooting

| Problem | Fix |
|---|---|
| *Stable Diffusion is not running* | Run `npm run comfy` and read `data/comfyui.log` for the error. If you see a `c10.dll` error, install the [VC++ redistributable](https://aka.ms/vc14/vc_redist.x64.exe); otherwise update your NVIDIA driver |
| *ComfyUI has no checkpoint* | Put a `.safetensors` file in `models/checkpoints` and restart ComfyUI |
| Out of memory | Close other GPU apps (games, browsers with video), or set `SD_COMFY_ARGS=--lowvram` |
| Progress seems stuck on *Loading model* | Normal the first time after ComfyUI starts (10–30 s); then you'll see *step 1/28 … 28/28* per scene |
| First scene is very slow | The model loads into VRAM on the first job; later scenes are faster |
| Faces change between scenes | Name characters consistently in the script; keep scenes short and specific |
