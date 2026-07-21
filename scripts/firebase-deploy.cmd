@echo off
REM Validate and deploy the complete production Firebase surface.
set "PATH=C:\Program Files\nodejs;%APPDATA%\npm;%PATH%"
cd /d "%~dp0.."
echo.
echo Deploying to launchpage-alex-roadservice...
echo.
call npm run check
if errorlevel 1 exit /b 1
firebase deploy --only hosting:launchpage-alex-roadservice,firestore:rules,firestore:indexes,storage,functions
if errorlevel 1 (
  echo.
  echo Retrying with npx...
  "C:\Program Files\nodejs\npx.cmd" firebase deploy --only hosting:launchpage-alex-roadservice,firestore:rules,firestore:indexes,storage,functions
)
echo.
pause
