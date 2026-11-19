# ClipForge AI - checks this PC and downloads what is missing. Runs at the end of setup and at every start.
# Safe to run again and again: when everything is in place it finishes in about a second.
# Never stops ClipForge from starting - a missing piece only turns that feature off.
param([switch]$Install)  # -Install: called by setup (shows a summary and waits for a key at the end)

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'   # Invoke-WebRequest is 10x slower with the progress bar on
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$appDir = Join-Path $PSScriptRoot 'app'
$dataDir = Join-Path $env:LOCALAPPDATA 'ClipForge\data'
$ollamaUrl = 'http://127.0.0.1:11434'
$model = 'qwen2.5:3b'
$envFile = Join-Path $appDir '.env'
if (Test-Path $envFile) {
  $m = Select-String -Path $envFile -Pattern '^\s*OLLAMA_MODEL\s*=\s*(\S+)' | Select-Object -First 1
  if ($m) { $model = $m.Matches[0].Groups[1].Value }
}

$problems = @()
function Say($text, $color = 'Gray') { Write-Host "  $text" -ForegroundColor $color }
function Ok($text) { Say "[ok] $text" 'Green' }
function Warn($text) { Say "[!]  $text" 'Yellow'; $script:problems += $text }

function Get-Ollama {
  try { return Invoke-RestMethod "$ollamaUrl/api/tags" -TimeoutSec 3 } catch { return $null }
}
function Find-OllamaExe {
  $cmd = Get-Command ollama.exe -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  foreach ($p in @("$env:LOCALAPPDATA\Programs\Ollama\ollama.exe", "$env:ProgramFiles\Ollama\ollama.exe")) {
    if (Test-Path $p) { return $p }
  }
  return $null
}
function Test-Internet {
  try { $null = Invoke-WebRequest 'https://ollama.com' -Method Head -UseBasicParsing -TimeoutSec 8; return $true } catch { return $false }
}
function Wait-Ollama($seconds) {
  for ($i = 0; $i -lt $seconds; $i++) { if (Get-Ollama) { return $true }; Start-Sleep -Seconds 1 }
  return $false
}

Write-Host ''
Write-Host '  Checking your PC for ClipForge...' -ForegroundColor Cyan

# ---------------------------------------------------------------- 1. the basics
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null
if (-not [Environment]::Is64BitOperatingSystem) { Warn 'ClipForge needs 64-bit Windows.' }
$drive = Get-PSDrive -Name ($env:LOCALAPPDATA.Substring(0, 1)) -ErrorAction SilentlyContinue
$freeGb = if ($drive) { [math]::Round($drive.Free / 1GB, 1) } else { 99 }
if ($freeGb -lt 5) { Warn "Only $freeGb GB free on drive $($env:LOCALAPPDATA.Substring(0, 2)) - free up space (5 GB or more) for the AI engine and your videos." }
foreach ($bin in @('runtime\node.exe', 'runtime\ffmpeg\ffmpeg.exe')) {
  if (-not (Test-Path (Join-Path $PSScriptRoot $bin))) { Warn "Missing $bin - run ClipForge-Setup again to repair." }
}
$whisper = Join-Path $PSScriptRoot 'runtime\whisper\whisper-cli.exe'
if (Test-Path $whisper) {
  if (-not (Test-Path (Join-Path $dataDir 'models\ggml-base.bin'))) { Say 'Speech model downloads the first time you transcribe (about 140 MB).' }
  Ok 'Video tools and speech-to-text'
} else {
  Ok 'Video tools'
}

# ---------------------------------------------------------------- 2. Ollama (the local AI that writes scripts)
$tags = Get-Ollama
if (-not $tags) {
  $exe = Find-OllamaExe
  if (-not $exe) {
    if (-not (Test-Internet)) {
      Warn 'No internet - the AI engine (Ollama) could not be downloaded. ClipForge works without it; it tries again next time.'
    } else {
      Say 'Downloading the AI engine (Ollama, about 1 GB)...' 'Cyan'
      $setup = Join-Path $env:TEMP 'OllamaSetup.exe'
      try {
        Invoke-WebRequest 'https://ollama.com/download/OllamaSetup.exe' -OutFile $setup -UseBasicParsing
        Say 'Installing Ollama...'
        Start-Process -FilePath $setup -ArgumentList '/VERYSILENT', '/NORESTART', '/SUPPRESSMSGBOXES' -Wait
        Remove-Item $setup -Force -ErrorAction SilentlyContinue
      } catch {
        Warn "Could not download Ollama ($($_.Exception.Message)). It tries again next time."
      }
      $exe = Find-OllamaExe
    }
  }
  if ($exe -and -not (Get-Ollama)) {
    # the Ollama installer usually starts it; if not, run it quietly in the background
    Start-Process -FilePath $exe -ArgumentList 'serve' -WindowStyle Hidden
  }
  if ($exe) { $null = Wait-Ollama 30 }
  $tags = Get-Ollama
}

if ($tags) {
  $have = @($tags.models | ForEach-Object { $_.name })
  $wanted = if ($model -match ':') { $model } else { "$model`:latest" }
  if ($have -contains $wanted) {
    Ok "AI engine and model ($model)"
  } elseif (-not (Test-Internet)) {
    Warn "No internet - the AI model ($model) could not be downloaded. It tries again next time."
  } else {
    Say "Downloading the AI model $model (about 2 GB, only once)..." 'Cyan'
    $exe = Find-OllamaExe
    if ($exe) { & $exe pull $model } else { Warn 'Ollama is running but ollama.exe was not found to download the model.' }
    $tags = Get-Ollama
    if ($tags -and (@($tags.models | ForEach-Object { $_.name }) -contains $wanted)) { Ok "AI model $model" }
    else { Warn "The AI model ($model) did not finish downloading. It continues next time." }
  }
} elseif (-not ($problems | Where-Object { $_ -like '*Ollama*' })) {
  Warn 'The AI engine (Ollama) did not start. Script writing and Edit with AI are off for now.'
}

# ---------------------------------------------------------------- summary
Write-Host ''
if ($problems.Count -eq 0) {
  Write-Host '  Everything is ready.' -ForegroundColor Green
} else {
  Write-Host '  ClipForge still works - the items marked [!] above are switched off until they are fixed.' -ForegroundColor Yellow
}
if ($Install) {
  Write-Host ''
  Write-Host '  Press any key to finish setup...'
  $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
}
exit 0
