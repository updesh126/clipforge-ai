@echo off
rem ClipForge AI - one-click setup for Windows. Double-click this file.
rem Installs Node.js if needed, the npm packages, every engine (FFmpeg, Whisper, Ollama, voices)
rem and Stable Diffusion with all models (ComfyUI goes OUTSIDE this folder), then starts ClipForge.
setlocal
cd /d "%~dp0"
title ClipForge AI setup
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed - installing it with winget...
  winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
  echo.
  echo Node.js is installed. Close this window and double-click setup.cmd again.
  pause
  exit /b
)
echo Installing packages...
call npm install
if errorlevel 1 goto fail
call npm run setup -- --yes
if errorlevel 1 goto fail
echo.
echo Setup finished. Starting ClipForge - your browser opens in a few seconds.
start "" cmd /c "timeout /t 12 >nul & start http://localhost:3000"
call npm run dev
exit /b
:fail
echo.
echo Setup stopped. Read the messages above, fix the problem, then double-click setup.cmd again.
echo (Downloads resume where they stopped.)
pause
