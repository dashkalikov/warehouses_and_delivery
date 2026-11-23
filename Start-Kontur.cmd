@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required to run Kontur. Install it from https://nodejs.org/
  pause
  exit /b 1
)
if not defined PORT set "PORT=4173"
node server.mjs --open
if errorlevel 1 pause
