@echo off
REM Deploy hosting, Firestore rules, and Cloud Functions.
set "PATH=C:\Program Files\nodejs;%APPDATA%\npm;%PATH%"
cd /d "%~dp0.."
echo.
echo Deploying to launchpage-alex-roadservice...
echo.
firebase deploy --only hosting:launchpage-alex-roadservice,firestore:rules,functions
if errorlevel 1 (
  echo.
  echo Retrying with npx...
  "C:\Program Files\nodejs\npx.cmd" firebase deploy --only hosting:launchpage-alex-roadservice,firestore:rules,functions
)
echo.
pause
