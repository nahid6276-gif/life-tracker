@echo off
title Life & Work Tracker Server
cd /d "%~dp0"
echo ========================================================
echo   ⚡ Life & Work Tracker PWA Server
echo   ------------------------------------------------------
echo   PC Local:     http://localhost:8080
echo   Mobile Wi-Fi: http://192.168.0.107:8080
echo ========================================================
echo Starting server and opening browser...
start "" http://localhost:8080
python -m http.server 8080
pause
