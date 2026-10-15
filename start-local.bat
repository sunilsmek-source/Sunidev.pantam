@echo off
setlocal
cd /d "%~dp0"

echo Starting Pantomic AI at http://127.0.0.1:3000
echo Keep this window open while using the website.

where node >nul 2>nul
if not errorlevel 1 (
  node server.js
  goto finish
)

set "CODEX_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%CODEX_NODE%" (
  "%CODEX_NODE%" server.js
  goto finish
)

echo Node.js was not found. Install Node.js 20 or later, then run this file again.

:finish
pause
