@echo off
setlocal
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File ".\update_dashboard.ps1" -OpenDashboard
if errorlevel 1 (
  echo.
  echo Error al actualizar el dashboard.
  pause
  exit /b 1
)
echo.
echo Dashboard actualizado correctamente.
pause
