@echo off
REM Builds Digi-Deck for Windows (installer + portable exe) into the dist folder.
REM Requires Node.js 20+ from https://nodejs.org
setlocal
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Get it from https://nodejs.org & pause & exit /b 1)
echo === Installing dependencies ===
call npm install || goto :fail
echo === Running tests ===
call npm test
if errorlevel 1 echo WARNING: some tests failed - continuing with the build anyway.
echo === Building Windows exe ===
call npm run dist:win || goto :fail
echo.
echo Done. Look in the dist folder:
dir /b dist\*.exe
pause
exit /b 0
:fail
echo.
echo Build failed - see the messages above.
pause
exit /b 1
