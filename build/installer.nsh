; Digi-Deck installer extras: optional pre-made microcassette database.
; Everything is expanded from inside the customWelcomePage macro, i.e. after the MUI headers are loaded, and only in the installer pass.
!include nsDialogs.nsh
!include LogicLib.nsh

!ifndef BUILD_UNINSTALLER
Var PrebuiltCheck
Var PrebuiltState
!endif

!macro customWelcomePage
  !insertmacro MUI_PAGE_WELCOME
  !ifndef BUILD_UNINSTALLER
    Page custom prebuiltPageCreate prebuiltPageLeave
    Function prebuiltPageCreate
      !insertmacro MUI_HEADER_TEXT "Microcassette library" "Optional pre-made database"
      nsDialogs::Create 1018
      Pop $0
      ${NSD_CreateLabel} 0 0 100% 40u "Digi-Deck can come with a pre-made microcassette library: albums with their J-card and side label artwork already filled in. You can leave it out and build your own library instead."
      Pop $0
      ${NSD_CreateCheckbox} 0 52u 100% 12u "Install the pre-made microcassette database"
      Pop $PrebuiltCheck
      ${NSD_Check} $PrebuiltCheck
      StrCpy $PrebuiltState ${BST_CHECKED}
      nsDialogs::Show
    FunctionEnd
    Function prebuiltPageLeave
      ${NSD_GetState} $PrebuiltCheck $PrebuiltState
    FunctionEnd
  !endif
!macroend

!macro customInstall
  !ifndef BUILD_UNINSTALLER
  ${If} $PrebuiltState == ${BST_UNCHECKED}
    RMDir /r "$INSTDIR\resources\prebuilt-micro"
    FileOpen $0 "$INSTDIR\no-prebuilt.flag" w
    FileWrite $0 "The pre-made microcassette database was not installed (chosen in the installer)."
    FileClose $0
  ${EndIf}
  !endif
!macroend

!macro customUnInstall
  Delete "$INSTDIR\no-prebuilt.flag"
!macroend
