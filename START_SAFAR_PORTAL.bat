@echo off
title Safar Self Drive Portal - Starting
echo ========================================================
echo   SAFAR SELF DRIVE AND GUJARAT TAXI PORTAL LAUNCHER
echo ========================================================
echo.
cd /d "%~dp0"
node start-portal.js
if %ERRORLEVEL% NEQ 0 (
  echo Launching web server directly...
  start "Safar Web Server" python -m http.server 8000 --directory apps/web
  start http://localhost:8000/index.html
)
echo.
echo Portal is running on http://localhost:8000
echo You can minimize this window or double-click STOP_SAFAR_PORTAL.bat to stop.
