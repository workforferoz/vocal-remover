@echo off
setlocal
title Vocal Remover - Local Server Launcher

echo ========================================================
echo        Starting Vocal Remover (AI + Web UI)
echo ========================================================
echo.

:: 1. Start Python Local AI Engine in a new minimized window
echo [1/2] Launching Local Demucs AI Engine (port 8524)...
cd /d "%~dp0local-engine"
start /min "Vocal Remover AI Engine" .venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8524 --log-level info

:: 2. Return to root and launch Frontend Dev Server
cd /d "%~dp0"
echo [2/2] Launching Frontend Web Server (port 5173)...
echo.
echo Application will be available at: http://localhost:5173
echo.

:: Wait 2 seconds and open browser
start "" http://localhost:5173

:: Run frontend
npm.cmd run dev -- --host

