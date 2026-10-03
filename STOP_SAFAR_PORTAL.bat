@echo off
title Safar Self Drive Portal - Stopping
echo ========================================================
echo   SAFAR SELF DRIVE - STOPPING ALL SERVERS
echo ========================================================
echo.
cd /d "%~dp0"
node stop-portal.js
echo.
echo All portal servers on port 8000 and 3000 have been stopped.
timeout /t 3 >nul
