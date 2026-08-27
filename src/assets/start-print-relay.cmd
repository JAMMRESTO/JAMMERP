@echo off
setlocal EnableExtensions

cd /d "%~dp0"
title THE WEST AFRICAN - Relais d'impression

if not exist "%~dp0print-relay.cjs" (
  echo.
  echo ==================================================
  echo  ERREUR : print-relay.cjs est introuvable
  echo ==================================================
  echo.
  echo Les fichiers print-relay.cjs et start-print-relay.cmd
  echo doivent rester dans le meme dossier.
  echo.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo ==================================================
  echo  ERREUR : Node.js n'est pas installe
  echo ==================================================
  echo.
  echo Installez Node.js 18 ou plus recent,
  echo puis relancez ce fichier.
  echo.
  pause
  exit /b 1
)

for /f "tokens=*" %%v in ('node --version 2^>nul') do set NODE_VERSION=%%v
echo Node.js detecte : %NODE_VERSION%
echo Lancement du relais...
echo.
node "%~dp0print-relay.cjs"

set RELAY_EXIT=%ERRORLEVEL%
echo.
echo Le relais s'est arrete avec le code %RELAY_EXIT%.
echo Corrigez le probleme indique ci-dessus, puis relancez ce fichier.
pause
exit /b %RELAY_EXIT%
