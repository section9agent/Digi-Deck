@echo off
rem Sorts sleeve pictures from BigBoppa pages you saved with your browser (Ctrl+S, "Web page, complete") into
rem "BigBoppa Sleeves" on your Desktop (45 / 78 / unsorted). Drag the folder of saved pages onto this file.
if "%~1"=="" (echo Drag the folder with the saved pages onto this file. & pause & exit /b)
node "%~dp0bigboppa-sleeves.js" "%USERPROFILE%\Desktop\BigBoppa Sleeves" --local "%~1"
pause
