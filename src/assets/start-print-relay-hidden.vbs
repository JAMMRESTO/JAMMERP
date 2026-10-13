Option Explicit

Dim shell, fileSystem, relayPath, logPath, nodeExe, command

Set shell = CreateObject("WScript.Shell")
Set fileSystem = CreateObject("Scripting.FileSystemObject")

relayPath = fileSystem.BuildPath(fileSystem.GetParentFolderName(WScript.ScriptFullName), "print-relay.cjs")
logPath = fileSystem.BuildPath(fileSystem.GetParentFolderName(WScript.ScriptFullName), "print-relay.log")

' Try to locate node.exe in common locations before relying on PATH
nodeExe = ""

If fileSystem.FileExists(shell.ExpandEnvironmentStrings("%LOCALAPPDATA%\Programs\nodejs\node.exe")) Then
  nodeExe = shell.ExpandEnvironmentStrings("%LOCALAPPDATA%\Programs\nodejs\node.exe")
ElseIf fileSystem.FileExists("C:\Program Files\nodejs\node.exe") Then
  nodeExe = "C:\Program Files\nodejs\node.exe"
ElseIf fileSystem.FileExists("C:\Program Files (x86)\nodejs\node.exe") Then
  nodeExe = "C:\Program Files (x86)\nodejs\node.exe"
Else
  Dim nodePath
  On Error Resume Next
  nodePath = shell.Exec("cmd /c where node").StdOut.ReadAll
  On Error GoTo 0
  If InStr(nodePath, "node.exe") > 0 Then
    Dim parts
    parts = Split(Trim(nodePath), vbCrLf)
    nodeExe = Trim(parts(0))
  End If
End If

If nodeExe = "" Then
  Dim logFile
  Set logFile = fileSystem.CreateTextFile(logPath, True)
  logFile.WriteLine Now & " - ERREUR: Node.js introuvable."
  logFile.WriteLine "Installez Node.js depuis https://nodejs.org puis relancez le relais."
  logFile.Close
  WScript.Quit 1
End If

Do
  command = "cmd /c """ & nodeExe & """ """ & relayPath & """ >> """ & logPath & """ 2>&1"
  shell.Run command, 0, True
  WScript.Sleep 10000
Loop
