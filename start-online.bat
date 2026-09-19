@echo off
title MealManager Online Server
echo ========================================================
echo        MealManager - Online Server Launcher
echo ========================================================
echo.
echo [1/3] Checking XAMPP Apache & MySQL...
tasklist /FI "IMAGENAME eq httpd.exe" 2>NUL | find /I /N "httpd.exe">NUL
if "%ERRORLEVEL%"=="1" (
    echo Starting Apache...
    start /B "" "C:\xampp\apache\bin\httpd.exe"
)

tasklist /FI "IMAGENAME eq mysqld.exe" 2>NUL | find /I /N "mysqld.exe">NUL
if "%ERRORLEVEL%"=="1" (
    echo Starting MySQL...
    start /B "" "C:\xampp\mysql\bin\mysqld.exe" --defaults-file="C:\xampp\mysql\bin\my.ini" --standalone
)

echo [2/3] Services are ready!
echo [3/3] Launching Public HTTPS Tunnel...
echo.
echo ========================================================
echo Share the HTTPS link below with any phone or computer:
echo ========================================================
echo.
"C:\xampp\cloudflared.exe" tunnel --url http://localhost:80
pause
