@echo off
rem Downloads openly licensed company-sleeve images into "Company Sleeves" on your Desktop (45 / 78 / unsorted folders).
rem Optional: set FLICKR_KEY=your-free-flickr-api-key   before running, to include Flickr.
node "%~dp0sleeves-download.js" "%USERPROFILE%\Desktop\Company Sleeves" %*
pause
