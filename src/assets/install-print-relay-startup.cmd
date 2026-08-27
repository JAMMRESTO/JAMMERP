@echo off
setlocal EnableExtensions

set "RELAY_DIR=%~dp0"
set "HIDDEN_LAUNCHER=%RELAY_DIR%start-print-relay-hidden.vbs"
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT=%STARTUP_DIR%\The West African - Relais d'impression.lnk"

if not exist "%HIDDEN_LAUNCHER%" (
  echo Le lanceur invisible est introuvable.
  pause
  exit /b 1
)

if not exist "%STARTUP_DIR%" mkdir "%STARTUP_DIR%"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$shell = New-Object -ComObject WScript.Shell; $shortcut = $shell.CreateShortcut($env:SHORTCUT); $shortcut.TargetPath = 'wscript.exe'; $shortcut.Arguments = ('""' + $env:HIDDEN_LAUNCHER + '""'); $shortcut.WorkingDirectory = $env:RELAY_DIR; $shortcut.WindowStyle = 7; $shortcut.Description = 'Relais d''impression The West African'; $shortcut.Save()"

if errorlevel 1 (
  echo Impossible d'installer le demarrage automatique.
  pause
  exit /b 1
)

echo Le relais d'impression demarrera automatiquement avec Windows.
echo Il fonctionnera en arriere-plan sans fenetre visible.
echo
pause
exit /b 0
