@echo off
rem ClipForge AI (installed) - started from the desktop / Start-menu shortcut.
rem Checks the PC (downloads anything missing), starts the local server and opens the browser.
title ClipForge AI - keep this window open
cd /d "%~dp0app"

rem already running? just open the browser
curl.exe -s -m 2 -o nul http://localhost:3000/api/health && (
  start "" http://localhost:3000
  exit /b
)

set "PATH=%~dp0runtime;%~dp0runtime\ffmpeg;%~dp0runtime\whisper;%PATH%"
set "FFMPEG_DIR=%~dp0runtime\ffmpeg"
set "CLIPFORGE_DATA_DIR=%LOCALAPPDATA%\ClipForge\data"
set NODE_ENV=production

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0requirements.ps1"

echo.
echo   ClipForge is starting. Your browser opens by itself in a few seconds.
echo   If it does not, open  http://localhost:3000
echo   To stop ClipForge, close this window.
echo.
start "" cmd /c "timeout /t 6 >nul & start http://localhost:3000"
node server.ts
echo.
echo ClipForge stopped. If you see an error above, send a photo of this window to whoever shared ClipForge.
pause
