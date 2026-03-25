@echo off
title ScraperPro - Demarrage
echo.
echo  ============================================
echo    ScraperPro - Intelligence Commerciale
echo  ============================================
echo.
echo  Demarrage du serveur...
echo  L'application sera accessible sur :
echo  http://localhost:3000
echo.

cd /d "%~dp0scraper-entreprises"
"C:\Program Files\nodejs\npm.cmd" run dev

pause
