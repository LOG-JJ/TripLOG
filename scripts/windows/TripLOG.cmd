@echo off
setlocal
title TripLOG Terminal
cd /d "%~dp0..\.."
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 24 or newer is required. Install Node.js and try again.
  pause
  exit /b 1
)
node "bin\triplog.js" ui
set "TripLogTerminalExit=%ERRORLEVEL%"
if not "%TripLogTerminalExit%"=="0" pause
exit /b %TripLogTerminalExit%
