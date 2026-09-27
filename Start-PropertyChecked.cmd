@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install the supported Node.js version, then try again.
  pause
  exit /b 1
)
echo Starting PropertyChecked from its project folder.
echo Keep this window open. Use the browser address printed below.
echo Stop the server with Ctrl+C before opening another copy.
call npm run dev
if errorlevel 1 (
  echo.
  echo PropertyChecked stopped with an error. Read the message above.
  pause
)
endlocal
