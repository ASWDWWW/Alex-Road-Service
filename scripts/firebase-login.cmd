@echo off
REM Run Firebase login when node/npm are not on PATH yet.
set "PATH=C:\Program Files\nodejs;%APPDATA%\npm;%PATH%"
cd /d "%~dp0.."
echo.
echo Firebase login — a browser window will open.
echo.
firebase login
if errorlevel 1 (
  echo.
  echo Trying local project firebase-tools...
  "C:\Program Files\nodejs\npx.cmd" firebase login
)
echo.
pause
