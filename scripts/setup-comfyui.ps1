# Installs ComfyUI (portable, NVIDIA) with every model ClipForge uses — never inside the project folder.
#   npm run comfy:setup                     (or: powershell -ExecutionPolicy Bypass -File scripts\setup-comfyui.ps1)
#   options: -Dir D:\ComfyUI   -SkipModel (no SDXL)   -Motion ltx|wan|both|none (default ltx)
#   Motion models: ltx = LTX-Video 2B, fast, ~11.5 GB   wan = Wan 2.2 5B, best quality, ~18.2 GB
# Default folder: an existing ..\ComfyUI, otherwise %LOCALAPPDATA%\ClipForge\ComfyUI.
# Downloads (official sources), all resumable:
#   ComfyUI_windows_portable_nvidia.7z        ~2.1 GB  github.com/comfyanonymous/ComfyUI releases
#   sd_xl_base_1.0.safetensors                ~6.9 GB  huggingface.co/stabilityai/stable-diffusion-xl-base-1.0   (AI painting)
#   ltxv-2b-0.9.8-distilled.safetensors       ~6.3 GB  huggingface.co/Lightricks/LTX-Video                        (Motion)
#   t5xxl_fp8_e4m3fn_scaled.safetensors       ~5.2 GB  huggingface.co/comfyanonymous/flux_text_encoders          (Motion)
param(
  [string]$Dir = '',
  [switch]$SkipModel,
  [ValidateSet('ltx', 'wan', 'both', 'none')][string]$Motion = 'ltx',
  [switch]$SkipVideo,   # same as -Motion none
  [switch]$Video        # kept for older instructions (Motion is installed by default)
)
$project = Split-Path -Parent $PSScriptRoot
if (-not $Dir) {
  $sibling = Join-Path (Split-Path -Parent $project) 'ComfyUI'
  $Dir = if (Test-Path (Join-Path $sibling 'ComfyUI_windows_portable')) { $sibling } else { Join-Path $env:LOCALAPPDATA 'ClipForge\ComfyUI' }
}
$Dir = [System.IO.Path]::GetFullPath($Dir)
if ($Dir.TrimEnd('').StartsWith($project.TrimEnd(''), [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "ComfyUI must not go inside the project folder ($project). Use the default, or -Dir with a folder outside it."
}
Write-Host "ComfyUI folder: $Dir"
$ErrorActionPreference = 'Stop'

# Big files over flaky connections: resume (-C -), retry on resets, verify the size, then rename into place.
function Get-Download([string]$Url, [string]$Out, [string]$Label) {
  $part = "$Out.part"
  $expected = 0
  $head = curl.exe -sIL $Url | Select-String -Pattern '^content-length:\s*(\d+)' | Select-Object -Last 1
  if ($head) { $expected = [int64]$head.Matches[0].Groups[1].Value }
  # an earlier run may have left a half-finished file under the final name
  if ((Test-Path $Out) -and $expected -gt 0 -and (Get-Item $Out).Length -ne $expected) { Move-Item -Force $Out $part }
  if (Test-Path $Out) { return }
  for ($try = 1; $try -le 20; $try++) {
    $have = if (Test-Path $part) { (Get-Item $part).Length } else { 0 }
    if ($expected -gt 0 -and $have -eq $expected) { break }
    Write-Host ("{0}: attempt {1}, resuming at {2:N1} GB of {3:N1} GB" -f $Label, $try, ($have / 1GB), ($expected / 1GB))
    curl.exe -L --fail --retry 5 --retry-all-errors --retry-delay 5 --speed-limit 1024 --speed-time 60 -C - -o $part $Url
    if ($LASTEXITCODE -eq 0 -and ($expected -eq 0 -or (Get-Item $part).Length -eq $expected)) { break }
    Start-Sleep -Seconds 5
  }
  if ($expected -gt 0 -and (Get-Item $part).Length -ne $expected) { throw "$Label download incomplete - run the script again to resume." }
  Move-Item -Force $part $Out
}

$sevenZip = @("$env:ProgramFiles\7-Zip\7z.exe", "${env:ProgramFiles(x86)}\7-Zip\7z.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $sevenZip) { throw '7-Zip is needed to unpack ComfyUI. Install it with: winget install 7zip.7zip' }

New-Item -ItemType Directory -Force -Path $Dir | Out-Null
$archive = Join-Path $Dir 'ComfyUI_windows_portable_nvidia.7z'
$portable = Join-Path $Dir 'ComfyUI_windows_portable'

if (-not (Test-Path $portable)) {
  Get-Download 'https://github.com/comfyanonymous/ComfyUI/releases/latest/download/ComfyUI_windows_portable_nvidia.7z' $archive 'ComfyUI portable (~2.1 GB)'
  Write-Host 'Unpacking...'
  & $sevenZip x -y "-o$Dir" $archive | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Unpacking failed.' }
}

$checkpoints = Join-Path $portable 'ComfyUI\models\checkpoints'
New-Item -ItemType Directory -Force -Path $checkpoints | Out-Null
$model = Join-Path $checkpoints 'sd_xl_base_1.0.safetensors'
if (-not $SkipModel) {
  Get-Download 'https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors' $model 'SDXL base 1.0 (~6.9 GB)'
}

if ($SkipVideo) { $Motion = 'none' }
$encoders = Join-Path $portable 'ComfyUI\models\text_encoders'
New-Item -ItemType Directory -Force -Path $encoders | Out-Null

# Motion (fast): LTX-Video 2B distilled + T5 text encoder, ~11.5 GB
if ($Motion -eq 'ltx' -or $Motion -eq 'both') {
  Get-Download 'https://huggingface.co/Lightricks/LTX-Video/resolve/main/ltxv-2b-0.9.8-distilled.safetensors' (Join-Path $checkpoints 'ltxv-2b-0.9.8-distilled.safetensors') 'LTX-Video 2B distilled (~6.3 GB)'
  Get-Download 'https://huggingface.co/comfyanonymous/flux_text_encoders/resolve/main/t5xxl_fp8_e4m3fn_scaled.safetensors' (Join-Path $encoders 't5xxl_fp8_e4m3fn_scaled.safetensors') 'T5-XXL text encoder (~5.2 GB)'
}

# Motion (best): Wan 2.2 TI2V 5B + UMT5 text encoder + Wan 2.2 VAE, ~18.2 GB
if ($Motion -eq 'wan' -or $Motion -eq 'both') {
  $wanBase = 'https://huggingface.co/Comfy-Org/Wan_2.2_ComfyUI_Repackaged/resolve/main/split_files'
  $diffusion = Join-Path $portable 'ComfyUI\models\diffusion_models'
  $vae = Join-Path $portable 'ComfyUI\models\vae'
  New-Item -ItemType Directory -Force -Path $diffusion, $vae | Out-Null
  Get-Download "$wanBase/diffusion_models/wan2.2_ti2v_5B_fp16.safetensors" (Join-Path $diffusion 'wan2.2_ti2v_5B_fp16.safetensors') 'Wan 2.2 TI2V 5B (~10 GB)'
  Get-Download "$wanBase/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors" (Join-Path $encoders 'umt5_xxl_fp8_e4m3fn_scaled.safetensors') 'UMT5-XXL text encoder (~6.7 GB)'
  Get-Download "$wanBase/vae/wan2.2_vae.safetensors" (Join-Path $vae 'wan2.2_vae.safetensors') 'Wan 2.2 VAE (~1.4 GB)'
}

Write-Host ''
Write-Host "Done. ComfyUI is in $portable"
Write-Host 'npm run dev starts it automatically (or: npm run comfy). On the Script page choose Illustration -> AI painting.'
if ($Motion -ne 'none') { Write-Host "Motion ($Motion) is installed: tick 'Motion - bring paintings to life' on the Script page." } else { Write-Host 'For moving scenes later: npm run comfy:setup -- -Motion ltx   (or wan / both)' }
