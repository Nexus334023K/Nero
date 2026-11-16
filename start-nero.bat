@echo off
setlocal enabledelayedexpansion

title NERO — Personal AI Desktop Companion
echo ======================================================================
echo    _  _ ___ ___  ___
echo   ^| \^| ^| __^| _ \/ _ \   NERO - Personal AI Desktop Companion
echo   ^| .` ^| _^|^|   / (_) ^|  Windows Desktop Assistant
echo   ^|_^|\_^|___^|_^|_\\___/   Version 1.0 (Phases 1-7 Complete)
echo ======================================================================
echo.

cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] Python virtual environment not found at .venv\Scripts\python.exe
    echo Please ensure the Python 3.12 venv is installed before launching NERO.
    pause
    exit /b 1
)

echo [*] Starting NERO FastAPI Intelligence Backend on http://localhost:8765 ...
start "NERO Backend Server" /min .venv\Scripts\python.exe apps\backend\run.py

echo [*] Initializing backend services (waiting 2 seconds) ...
timeout /t 2 /nobreak >nul

echo [*] Launching NERO Desktop Application ...
call npm run electron:start --workspace=apps/desktop

echo [*] NERO Desktop session terminated.
