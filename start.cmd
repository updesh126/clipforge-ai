@echo off
rem ClipForge AI - double-click to start (ComfyUI starts with it). Run setup.cmd first on a new computer.
cd /d "%~dp0"
title ClipForge AI
if not exist node_modules (
  echo ClipForge is not set up yet - running setup.cmd...
  call setup.cmd
  exit /b
)
start "" cmd /c "timeout /t 10 >nul & start http://localhost:3000"
call npm run dev
