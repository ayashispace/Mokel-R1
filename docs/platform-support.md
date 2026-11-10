# Web platform support

Mokel detects the browser's platform to show setup instructions. Users do not choose Windows or macOS. After a Companion connects, its authenticated `/status` response determines the actual execution platform; browser detection never decides which command interpreter runs.

## Windows and macOS

API Mode, Generator Mode and GitHub workspaces use the same hosted web app. Agent Mode requires a compatible Bridge browser such as Chrome or Edge. The Chromium Bridge package can be loaded on either desktop OS; it is not an installable Safari extension.

The local Companion package includes both launchers. Windows uses `Start Mokel R1 Companion.bat`. On a Mac, install Node.js 22.13 or later, extract the package, open Terminal in its folder, and run:

```sh
zsh "Start Mokel R1 Companion.command"
```

File operations keep the existing workspace and revision checks. macOS uses its native folder picker and `/bin/zsh -f -c` for approved commands; Windows continues using PowerShell. Shell commands are not a filesystem sandbox. OS privacy prompts require the user. Python and other developer tools are not bundled.

macOS behavior has simulated command/picker tests and a Mac-browser setup test. A real Mac is still required to verify OS permissions and native execution end to end.

## Android Companion

See [Android Companion](android-companion.md). This is a file-access helper, not the full Mokel mobile app. Standard mobile API chat does not require the Browser Bridge. Connecting an AI website still requires a compatible website/Bridge setup; the Android helper does not make unsupported browsers support extensions.

## iPhone and iPad

Web API chat, Generator Mode and GitHub workspace access remain available. The Android APK cannot run on iOS. Local-file Companion support would require a separately built and Apple-signed iOS application with its own folder permissions and background-execution design. No iOS Companion is included in this release.
