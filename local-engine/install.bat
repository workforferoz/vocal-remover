@echo off
setlocal enabledelayedexpansion

echo =========================================================
echo   Vocal Studio AI - Local AI Engine Installation
echo =========================================================
echo.

REM 1. Check Python
set PYTHON_EXE=
py -3.11 -c "import sys; print(sys.executable)" > temp_py.txt 2>nul
if %errorlevel% equ 0 (
    set /p PYTHON_EXE=<temp_py.txt
    del temp_py.txt
) else (
    where python > temp_py.txt 2>nul
    if %errorlevel% equ 0 (
        set /p PYTHON_EXE=<temp_py.txt
        del temp_py.txt
    )
)

if "%PYTHON_EXE%"=="" (
    echo [ERROR] Python 3.11 is required but was not found.
    echo Please install Python 3.11 from python.org or via:
    echo   winget install --id Python.Python.3.11
    pause
    exit /b 1
)

echo [OK] Using Python: %PYTHON_EXE%
echo.

REM 2. Create virtual environment
if not exist ".venv\Scripts\python.exe" (
    echo [INFO] Creating Python virtual environment in .venv...
    "%PYTHON_EXE%" -m venv .venv
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to create virtual environment.
        pause
        exit /b 1
    )
    echo [OK] Virtual environment created.
) else (
    echo [OK] Virtual environment already exists.
)

REM 3. Upgrade pip & install requirements
echo.
echo [INFO] Installing pinned dependencies from requirements.txt...
.venv\Scripts\python.exe -m pip install --upgrade pip
.venv\Scripts\python.exe -m pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] Dependency installation encountered an error.
    pause
    exit /b 1
)

REM 4. Check FFmpeg
echo.
where ffmpeg >nul 2>nul
if %errorlevel% equ 0 (
    echo [OK] FFmpeg is installed and available in PATH.
) else (
    echo [WARNING] FFmpeg was not detected in PATH.
    echo While Demucs can process WAV files natively, FFmpeg is recommended for MP3/M4A/FLAC decoding.
    echo To install via winget, run: winget install Gyan.FFmpeg
)

REM 5. Verify imports
echo.
echo [INFO] Verifying PyTorch and Demucs imports...
.venv\Scripts\python.exe -c "import torch, demucs; print(f'[OK] PyTorch {torch.__version__} (CUDA: {torch.cuda.is_available()}) and Demucs {demucs.__version__} verified.')"
if %errorlevel% neq 0 (
    echo [ERROR] Verification failed.
    pause
    exit /b 1
)

echo.
echo =========================================================
echo   Installation Successful!
echo   Run start.bat to launch the Local AI Separation Engine.
echo =========================================================
pause

