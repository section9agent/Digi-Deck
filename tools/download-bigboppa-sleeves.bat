@echo off
rem Downloads the company-sleeve pictures from sleeves.bigboppa.co.uk into "BigBoppa Sleeves" on your Desktop (45 / 78 / unsorted folders).
rem Add --dry to only list what it would save. Stop any time with Ctrl+C and run again to carry on.
node "%~dp0bigboppa-sleeves.js" "%USERPROFILE%\Desktop\BigBoppa Sleeves" %*
pause
