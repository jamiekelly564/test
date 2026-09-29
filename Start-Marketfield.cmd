@echo off
setlocal
cd /d "%~dp0"
if not exist package.json (
  echo Open this launcher from your PropertyChecked project folder.
  pause
  exit /b 1
)
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not available. Install Node.js 22.16 or newer, then reopen this window.
  pause
  exit /b 1
)
echo Starting your local Marketfield workspace. Keep this window open.
echo Open the address shown below in your browser.
call npm.cmd run dev
pause
