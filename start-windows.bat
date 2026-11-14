@echo off
title Vitanaut
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js is not installed.
  echo Install the LTS version from https://nodejs.org, then run this file again.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing Vitanaut for the first time. This can take a few minutes...
  call npm install
  if errorlevel 1 (
    echo Installation failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
)

echo.
echo Starting Vitanaut. Your browser will open at http://localhost:3000
echo Keep this window open while you use the app. Press Ctrl+C to stop.
echo.
start "" http://localhost:3000
call npm run dev
pause
