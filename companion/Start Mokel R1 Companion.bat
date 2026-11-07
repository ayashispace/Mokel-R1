@echo off
setlocal
set "MOKEL_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%MOKEL_NODE%" goto start
where node.exe >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22.13 or later from https://nodejs.org, then try again.
  pause
  exit /b 1
)
set "MOKEL_NODE=node.exe"
:start
"%MOKEL_NODE%" "%~dp0companion.mjs"
if errorlevel 1 pause

