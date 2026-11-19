; ClipForge AI - Windows installer (Inno Setup 6). Built by:  npm run installer
; The build script passes: Stage (staged app folder), OutDir, AppVer, OutName, and WhisperModel when bundled.
; Installs per user (no admin), adds shortcuts, then runs requirements.ps1 to download Ollama + the AI model.

#ifndef Stage
  #error Run "npm run installer" - it stages the app and passes the paths to this script.
#endif

[Setup]
AppId={{6F1E2B7A-4C3D-4E8F-9A21-C1F0A9E5D7B3}
AppName=ClipForge AI
AppVersion={#AppVer}
AppVerName=ClipForge AI {#AppVer}
AppPublisher=ClipForge AI
DefaultDirName={localappdata}\Programs\ClipForge AI
DefaultGroupName=ClipForge AI
DisableProgramGroupPage=yes
DisableDirPage=auto
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0.17763
OutputDir={#OutDir}
OutputBaseFilename={#OutName}
SetupIconFile=clipforge.ico
UninstallDisplayIcon={app}\clipforge.ico
UninstallDisplayName=ClipForge AI
WizardStyle=modern
Compression=lzma2/normal
SolidCompression=yes
LZMANumBlockThreads=8
; close a running ClipForge (node.exe from this folder) before updating it
CloseApplications=force
RestartApplications=no

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"
Name: "ai"; Description: "Download the AI engine now (Ollama + model, about 3 GB - recommended)"

[InstallDelete]
; updates replace the program files completely (your projects live in %LOCALAPPDATA%\ClipForge\data and are kept)
Type: filesandordirs; Name: "{app}\app\node_modules"
Type: filesandordirs; Name: "{app}\app\dist"
Type: filesandordirs; Name: "{app}\app\server"
Type: filesandordirs; Name: "{app}\app\src"
Type: filesandordirs; Name: "{app}\app\scripts"
Type: filesandordirs; Name: "{app}\runtime"

[Files]
Source: "{#Stage}\app\*"; DestDir: "{app}\app"; Excludes: "\data"; Flags: recursesubdirs createallsubdirs ignoreversion
Source: "{#Stage}\runtime\*"; DestDir: "{app}\runtime"; Flags: recursesubdirs createallsubdirs ignoreversion
Source: "ClipForge.cmd"; DestDir: "{app}"; Flags: ignoreversion
Source: "requirements.ps1"; DestDir: "{app}"; Flags: ignoreversion
Source: "clipforge.ico"; DestDir: "{app}"; Flags: ignoreversion
#ifdef WhisperModel
; speech model goes with the user's data so it survives updates and uninstall
Source: "{#WhisperModel}"; DestDir: "{localappdata}\ClipForge\data\models"; Flags: onlyifdoesntexist uninsneveruninstall
#endif

[Icons]
Name: "{userprograms}\ClipForge AI"; Filename: "{app}\ClipForge.cmd"; WorkingDir: "{app}"; IconFilename: "{app}\clipforge.ico"; Comment: "Start ClipForge AI"
Name: "{userdesktop}\ClipForge AI"; Filename: "{app}\ClipForge.cmd"; WorkingDir: "{app}"; IconFilename: "{app}\clipforge.ico"; Comment: "Start ClipForge AI"; Tasks: desktopicon

[Run]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\requirements.ps1"" -Install"; StatusMsg: "Checking your PC and downloading the AI engine - a window shows the progress..."; Flags: waituntilterminated; Tasks: ai
Filename: "{app}\ClipForge.cmd"; Description: "Start ClipForge now"; Flags: postinstall nowait shellexec skipifsilent

[UninstallDelete]
; generated caches inside the program folder (your projects in %LOCALAPPDATA%\ClipForge\data are kept)
Type: filesandordirs; Name: "{app}\app"
Type: filesandordirs; Name: "{app}\runtime"
