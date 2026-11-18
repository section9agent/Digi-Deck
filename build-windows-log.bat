@echo off
REM Same as build-windows.bat but also saves everything to build-log.txt so the full error can be read.
call "%~dp0build-windows.bat" > "%~dp0build-log.txt" 2>&1
echo Log saved to build-log.txt
