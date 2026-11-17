@echo off
title NERO Desktop Companion
cd /d "%~dp0"
powershell.exe -ExecutionPolicy Bypass -File .\start-nero.ps1
pause
