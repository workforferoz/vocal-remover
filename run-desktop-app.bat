@echo off
setlocal
cd /d "%~dp0local-engine"

:: Check if virtual environment exists
if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] Virtual environment not found in local-engine\.venv.
    pause
    exit /b 1
)

:: Run the desktop app using python.exe (or pythonw.exe for silent launch)
.venv\Scripts\python.exe desktop_app.py

