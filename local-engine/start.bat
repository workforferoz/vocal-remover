@echo off
setlocal

echo =========================================================
echo   Vocal Studio AI - Starting Local AI Separation Engine
echo =========================================================
echo.

if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] Virtual environment not found. Please run install.bat first.
    pause
    exit /b 1
)

echo Binding API exclusively to loopback: http://127.0.0.1:8524
echo Hardware target: Auto-detect (CUDA GPU if available, CPU baseline)
echo Press Ctrl+C or run stop.bat to shut down.
echo.

.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8524 --log-level info

