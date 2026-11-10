@echo off
setlocal

echo =========================================================
echo   Vocal Studio AI - Stopping Local AI Engine (Port 8524)
echo =========================================================
echo.

set FOUND=0
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8524 ^| findstr LISTENING') do (
    echo Stopping engine process with PID: %%a...
    taskkill /F /PID %%a >nul 2>nul
    set FOUND=1
)

if %FOUND% equ 1 (
    echo [OK] Engine stopped successfully.
) else (
    echo [INFO] No active engine process found listening on port 8524.
)

pause

