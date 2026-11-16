# NERO — PowerShell 1-Click Production Launcher
$ErrorActionPreference = "Stop"

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "  NERO — Personal AI Desktop Companion for Windows" -ForegroundColor Cyan
Write-Host "  Version 1.0 (Phases 1-7 Fully Operational)" -ForegroundColor DarkCyan
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$PythonExe = Join-Path $ScriptDir ".venv\Scripts\python.exe"

if (-not (Test-Path $PythonExe)) {
    Write-Host "[ERROR] Python virtual environment not found at: $PythonExe" -ForegroundColor Red
    exit 1
}

Write-Host "[*] Starting NERO FastAPI Intelligence Backend on port 8765..." -ForegroundColor Green
$BackendProcess = Start-Process -FilePath $PythonExe -ArgumentList "apps\backend\run.py" -WorkingDirectory $ScriptDir -PassThru -WindowStyle Minimized

Start-Sleep -Seconds 2

Write-Host "[*] Launching NERO Desktop Electron Host..." -ForegroundColor Green
try {
    $env:ELECTRON_RUN_AS_NODE = ""
    npm run electron:start --workspace=apps/desktop
} finally {
    Write-Host "[*] Cleaning up background processes..." -ForegroundColor Yellow
    if ($BackendProcess -and -not $BackendProcess.HasExited) {
        Stop-Process -Id $BackendProcess.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host "[*] NERO shutdown complete." -ForegroundColor Cyan
}
