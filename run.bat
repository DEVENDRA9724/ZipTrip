@echo off
echo Starting ZipTrip Platform Services...

REM Launch Backend in a new window
start cmd /k "cd backend && title Car Rental Backend && npm run dev"

REM Launch Frontend in a new window
start cmd /k "cd frontend && title Car Rental Frontend && npm run dev"

echo Services launched! You can close this loader window.
pause
