@echo off
title MealManager - Deploy Updates to Alwaysdata
echo ========================================================
echo        MealManager - Live Server Updater
echo ========================================================
echo.
echo Deploying your latest code to https://mealmanager.alwaysdata.net ...
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0update-server.ps1"

echo.
echo ========================================================
echo Updates pushed! Press any key to exit.
echo ========================================================
pause >nul
