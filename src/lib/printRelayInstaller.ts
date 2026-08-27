import relayScriptSource from '../assets/print-relay.cjs?raw';
import relayHiddenLauncherSource from '../assets/start-print-relay-hidden.vbs?raw';

function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function chunkString(str: string, size: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < str.length; i += size) {
    chunks.push(str.slice(i, i + size));
  }
  return chunks;
}

function generateBase64EchoLines(b64: string, varName: string): string {
  const chunks = chunkString(b64, 4000);
  const echoLines = chunks.map(c => `echo ${c}`).join('\r\n');
  return `(\r\n${echoLines}\r\n)>"%${varName}%"`;
}

export function generateInstallerCmd(): string {
  const relayB64 = utf8ToBase64(relayScriptSource);
  const vbsB64 = utf8ToBase64(relayHiddenLauncherSource);

  const relayEcho = generateBase64EchoLines(relayB64, 'RELAY_B64');
  const vbsEcho = generateBase64EchoLines(vbsB64, 'VBS_B64');

  const lines: string[] = [
    '@echo off',
    'setlocal EnableExtensions EnableDelayedExpansion',
    "title THE WEST AFRICAN - Installateur du relais d'impression",
    '',
    'set "INSTALL_DIR=%PROGRAMDATA%\\TheWestAfrican\\PrintRelay"',
    "set \"SHORTCUT=%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\The West African - Relais d'impression.lnk\"",
    'set "RELAY_B64=%TEMP%\\twa_relay.b64"',
    'set "VBS_B64=%TEMP%\\twa_vbs.b64"',
    '',
    'echo.',
    'echo ============================================',
    'echo    THE WEST AFRICAN',
    "echo    Installateur du relais d'impression",
    'echo ============================================',
    'echo.',
    '',
    'echo Arret du relais existant...',
    "powershell -NoProfile -Command \"$p = Get-WmiObject Win32_Process; foreach($x in $p){ if($x.CommandLine -like '*print-relay*'){ $x.Terminate() } }\"",
    'echo.',
    '',
    'echo [1/5] Verification de Node.js...',
    'where node >nul 2>nul',
    'if !errorlevel! neq 0 (',
    '  echo        Node.js absent. Installation automatique (utilisateur)...',
    "  powershell -NoProfile -ExecutionPolicy Bypass -Command \"$ProgressPreference='SilentlyContinue'; $i=Invoke-RestMethod 'https://nodejs.org/dist/index.json'; $v=''; foreach($x in $i){ if($x.lts){ $v=$x.version; break } }; Write-Host ('       Telechargement Node.js '+$v); Invoke-WebRequest -Uri ('https://nodejs.org/dist/'+$v+'/node-'+$v+'-x64.msi') -OutFile ($env:TEMP+'\\node-install.msi'); Start-Process msiexec.exe -ArgumentList ('/i',''+$env:TEMP+'\\node-install.msi','/qb','/norestart') -Wait; Remove-Item (''+$env:TEMP+'\\node-install.msi') -Force\"",
    '  set "PATH=%PATH%;C:\\Program Files\\nodejs;%LOCALAPPDATA%\\Programs\\nodejs"',
    '  where node >nul 2>nul',
    '  if !errorlevel! neq 0 (',
    '    echo.',
    "    echo ERREUR: Node.js n'a pas pu etre installe.",
    '    echo Installez Node.js manuellement depuis https://nodejs.org',
    '    echo puis relancez ce fichier.',
    '    pause',
    '    exit /b 1',
    '  )',
    ')',
    'for /f "tokens=*" %%v in (\'node --version 2^>nul\') do set "NODE_VERSION=%%v"',
    'echo        OK - Node.js !NODE_VERSION! detecte',
    'echo.',
    '',
    "echo [2/5] Creation du dossier d'installation...",
    'if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"',
    'echo        OK',
    'echo.',
    '',
    'echo [3/5] Ecriture du script relais...',
    relayEcho,
    "powershell -NoProfile -Command \"[IO.File]::WriteAllBytes($env:INSTALL_DIR+'\\print-relay.cjs', [Convert]::FromBase64String([IO.File]::ReadAllText($env:RELAY_B64).Replace([char]10,'').Replace([char]13,'')))\"",
    'del "%RELAY_B64%" >nul 2>nul',
    'echo        OK - print-relay.cjs',
    'echo.',
    '',
    'echo [4/5] Ecriture du lanceur invisible...',
    vbsEcho,
    "powershell -NoProfile -Command \"[IO.File]::WriteAllBytes($env:INSTALL_DIR+'\\start-print-relay-hidden.vbs', [Convert]::FromBase64String([IO.File]::ReadAllText($env:VBS_B64).Replace([char]10,'').Replace([char]13,'')))\"",
    'del "%VBS_B64%" >nul 2>nul',
    'echo        OK - start-print-relay-hidden.vbs',
    'echo.',
    '',
    'echo [5/5] Configuration du demarrage automatique...',
    "powershell -NoProfile -ExecutionPolicy Bypass -Command \"$shell = New-Object -ComObject WScript.Shell; $sc = $shell.CreateShortcut($env:SHORTCUT); $sc.TargetPath = 'wscript.exe'; $sc.Arguments = ([char]34 + $env:INSTALL_DIR + '\\start-print-relay-hidden.vbs' + [char]34); $sc.WorkingDirectory = $env:INSTALL_DIR; $sc.WindowStyle = 7; $sc.Description = 'Relais impression'; $sc.Save()\"",
    'echo        OK',
    'echo.',
    '',
    'echo Demarrage du relais...',
    'wscript.exe "%INSTALL_DIR%\\start-print-relay-hidden.vbs"',
    'echo.',
    'echo Verification du relais (attente 8 secondes)...',
    'timeout /t 8 /nobreak >nul',
    "powershell -NoProfile -Command \"$found = $false; $p = Get-WmiObject Win32_Process; foreach($x in $p){ if($x.CommandLine -like '*print-relay*'){ $found = $true; break } }; if($found){ Write-Host '       OK - Le relais tourne en arriere-plan.' } else { Write-Host '       ATTENTION: Le relais ne semble pas tourner.'; Write-Host '       Verifiez le fichier: %INSTALL_DIR%\\print-relay.log' }\"",
    'echo.',
    '',
    'echo ============================================',
    'echo  INSTALLATION TERMINEE !',
    'echo ============================================',
    'echo.',
    "echo Le relais d'impression est maintenant actif.",
    'echo Il demarrera automatiquement avec Windows.',
    'echo.',
    'echo Verifiez le statut dans la page Imprimantes',
    'echo de votre application.',
    'echo.',
    'pause',
    'exit /b 0',
  ];

  return lines.join('\r\n');
}

export function generateUninstallerCmd(): string {
  const lines: string[] = [
    '@echo off',
    'setlocal EnableExtensions EnableDelayedExpansion',
    "title THE WEST AFRICAN - Desinstallation du relais d'impression",
    '',
    'set "INSTALL_DIR=%PROGRAMDATA%\\TheWestAfrican\\PrintRelay"',
    "set \"SHORTCUT=%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\The West African - Relais d'impression.lnk\"",
    '',
    'echo.',
    'echo ============================================',
    'echo    Desinstallation du relais',
    'echo ============================================',
    'echo.',
    '',
    'echo Arret du relais...',
    "powershell -NoProfile -Command \"$p = Get-WmiObject Win32_Process; foreach($x in $p){ if($x.CommandLine -like '*print-relay*'){ $x.Terminate() } }\"",
    'echo OK',
    'echo.',
    '',
    'echo Suppression du demarrage automatique...',
    'if exist "%SHORTCUT%" del /q "%SHORTCUT%"',
    'echo OK',
    'echo.',
    '',
    'echo Suppression des fichiers...',
    'if exist "%INSTALL_DIR%" rd /s /q "%INSTALL_DIR%"',
    'echo OK',
    'echo.',
    '',
    'echo ============================================',
    'echo  DESINSTALLATION TERMINEE',
    'echo ============================================',
    'echo.',
    "echo Le relais d'impression a ete retire.",
    'echo.',
    'pause',
    'exit /b 0',
  ];

  return lines.join('\r\n');
}
