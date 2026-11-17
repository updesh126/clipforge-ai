# Installs ComfyUI (portable, NVIDIA) and the SDXL base model for ClipForge "AI painting".
#   powershell -ExecutionPolicy Bypass -File scripts\setup-comfyui.ps1 [-Dir D:\ComfyUI] [-SkipModel]
# Downloads (official sources):
#   ComfyUI_windows_portable_nvidia.7z   ~2.1 GB  github.com/comfyanonymous/ComfyUI releases
#   sd_xl_base_1.0.safetensors           ~6.9 GB  huggingface.co/stabilityai/stable-diffusion-xl-base-1.0
param(
  [string]$Dir = '',
  [switch]$SkipModel
)
# default: reuse an existing ..\ComfyUI install, otherwise install inside the project (tools\ComfyUI, git-ignored)
if (-not $Dir) {
  $sibling = Join-Path (Split-Path -Parent (Get-Location)) 'ComfyUI'
  $Dir = if (Test-Path (Join-Path $sibling 'ComfyUI_windows_portable')) { $sibling } else { Join-Path (Get-Location) 'tools\ComfyUI' }
}
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

Write-Host ''
Write-Host "Done. Start ComfyUI with:  $portable\run_nvidia_gpu.bat"
Write-Host 'Then open the Script page in ClipForge and choose Illustration -> AI painting.'
