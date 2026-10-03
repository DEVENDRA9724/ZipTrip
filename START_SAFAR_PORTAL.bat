@echo off
title Safar Self Drive Portal
echo ========================================================
echo   SAFAR SELF DRIVE PORTAL LAUNCHER
echo ========================================================
echo.
cd /d "%~dp0"
echo Starting Safar portal frontend and API at http://localhost:3000 ...
node start-portal.js
if %ERRORLEVEL% NEQ 0 (
  echo Portal exited with error code %ERRORLEVEL%.
  pause
)
