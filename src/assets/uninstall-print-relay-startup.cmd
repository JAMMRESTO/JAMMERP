@echo off
setlocal EnableExtensions

set "SHORTCUT=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\The West African - Relais d'impression.lnk"

if exist "%SHORTCUT%" del /q "%SHORTCUT%"

echo Le demarrage automatique du relais a ete desactive.
pause
exit /b 0
