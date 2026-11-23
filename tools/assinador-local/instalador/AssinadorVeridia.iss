; Instalador do Assinador Veridia (Inno Setup 6).
;
; Gerado por scripts/build-assinador.sh, que passa a versão do programa
; (/DVersao=...). Não compile este arquivo à mão.
;
; Instala só para o usuário atual, sem pedir administrador, na mesma pasta
; das versões que se instalavam sozinhas (%LOCALAPPDATA%\VeridiaAssinador).
; Assim a versão nova substitui a antiga. Cria o atalho no menu Iniciar,
; liga ao iniciar o Windows (se a pessoa deixar marcado) e aparece em
; "Aplicativos instalados", de onde se desinstala.

#ifndef Versao
  #error Passe /DVersao=x.y.z (o scripts/build-assinador.sh já passa).
#endif

[Setup]
AppId={{6F2C8B1E-3A4D-4E57-9B0C-5D7E2F1A8C34}
AppName=Assinador Veridia
AppVersion={#Versao}
AppVerName=Assinador Veridia {#Versao}
AppPublisher=Átrios
VersionInfoVersion={#Versao}
VersionInfoProductName=Assinador Veridia
VersionInfoProductVersion={#Versao}
VersionInfoDescription=Instalador do Assinador Veridia
VersionInfoCompany=Átrios
DefaultDirName={localappdata}\VeridiaAssinador
DisableDirPage=yes
DefaultGroupName=Assinador Veridia
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\..\..\public\downloads
OutputBaseFilename=InstalarAssinadorVeridia
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
UninstallDisplayName=Assinador Veridia
UninstallDisplayIcon={app}\AssinadorVeridia.exe
; O próprio instalador fecha o Assinador aberto (FecharAssinador, abaixo).
; O Restart Manager não fecha um programa sem janela e só mostraria um aviso.
CloseApplications=no
RestartApplications=no
; Data fixa nos arquivos: o mesmo código dá o mesmo instalador.
TimeStampsInUTC=yes
TouchDate=2026-01-01
TouchTime=00:00:00

[Languages]
Name: "ptbr"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Tasks]
Name: "iniciar"; Description: "Abrir o Assinador Veridia junto com o Windows (recomendado: o painel só assina com token ou cartão quando ele está aberto)"

[Files]
Source: "..\dist\AssinadorVeridia.exe"; DestDir: "{app}"; Flags: ignoreversion touch

[Icons]
Name: "{autoprograms}\Assinador Veridia"; Filename: "{app}\AssinadorVeridia.exe"; Comment: "Deixa o painel do Veridia assinar com certificado A3 (token ou cartão)"

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "AssinadorVeridia"; ValueData: """{app}\AssinadorVeridia.exe"""; Flags: uninsdeletevalue; Tasks: iniciar
; Desmarcou ao reinstalar: tira a entrada que a versão anterior deixou.
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueName: "AssinadorVeridia"; Flags: deletevalue; Tasks: not iniciar

[Run]
Filename: "{app}\AssinadorVeridia.exe"; Description: "Abrir o Assinador Veridia agora"; Flags: nowait postinstall

[UninstallDelete]
; Sobra de uma atualização interrompida das versões que se instalavam sozinhas.
Type: files; Name: "{app}\AssinadorVeridia.exe.novo"
Type: dirifempty; Name: "{app}"

[Code]
// Fecha o Assinador aberto deste usuário, para poder trocar ou apagar o
// arquivo. Sem administrador, o taskkill só alcança os programas do próprio
// usuário. Se ele não estiver aberto, não faz nada.
procedure FecharAssinador;
var
  Codigo: Integer;
begin
  Exec(ExpandConstant('{sys}\taskkill.exe'), '/F /IM AssinadorVeridia.exe', '',
    SW_HIDE, ewWaitUntilTerminated, Codigo);
  Sleep(500);
end;

function PrepareToInstall(var NeedsRestart: Boolean): String;
begin
  FecharAssinador;
  Result := '';
end;

// As configurações ficam em %APPDATA%\VeridiaAssinador: os sites que a
// pessoa autorizou, o log e, numa estação de assinatura, a chave que liga
// este computador à plataforma. Só apaga se a pessoa confirmar.
procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  Pasta: String;
begin
  if CurUninstallStep = usUninstall then
    FecharAssinador
  else if CurUninstallStep = usPostUninstall then
  begin
    Pasta := ExpandConstant('{userappdata}\VeridiaAssinador');
    if DirExists(Pasta) and
      (SuppressibleMsgBox(
        'Apagar também as configurações do Assinador Veridia neste computador?' + #13#10#13#10 +
        'São os sites que você autorizou, o registro de uso (log) e, se este computador é uma estação de assinatura, a ligação dele com a plataforma.' + #13#10#13#10 +
        'Se for instalar de novo, responda Não para manter. Se este computador era uma estação de assinatura, desligue-a também no painel, em Configurações > Certificados.',
        mbConfirmation, MB_YESNO or MB_DEFBUTTON2, IDNO) = IDYES) then
      DelTree(Pasta, True, True, True);
  end;
end;
