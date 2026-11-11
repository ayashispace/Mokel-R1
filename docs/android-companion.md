# Android Companion — initial test build

The Android Companion connects one user-selected phone folder to the Mokel web app. It does not bundle the Mokel chat interface, Termux, Node.js, Python or a terminal. Android 8 or later is required.

1. Open Mokel on the Android phone and choose a local workspace.
2. Download and install the Android Companion APK using the link in that dialog.
3. Tap **Open Android Companion** in the same dialog. Pairing links expire after five minutes and can be used once.
4. Choose a project folder in Android's system picker and tap **Connect selected folder**.
5. Return to the existing Mokel browser tab. Keep it open so the chat state is preserved.

The helper uses an outbound HTTPS connection to the official Mokel service. It does not expose a local HTTP port or require a browser extension for API workspace operations. The selected Mokel approval mode still applies. A foreground notification provides a Disconnect action. Android battery management, force-stop and foreground-service time limits can stop the connection; reopen the helper and pair again if that happens.

Supported actions: list/read/create/edit/delete files, create folders, and initialize the selected workspace. Existing-file changes require a matching approved revision. Pre-change copies are retained in the app's private storage for recovery. Interrupted executions are not blindly repeated. Initialization content stays in memory and is never saved as a snapshot file.

Android's folder picker cannot grant other apps' private directories or unrestricted access to the entire device. The helper has no terminal, PowerShell, system-lock, shutdown or schedule execution. File-provider writes are verified, with recovery attempted on failure; Android document providers do not provide universal atomic replacement guarantees.

The APK compiles and its signing certificate verifies. Pairing, session isolation, request relay and revocation have server integration tests. Actual Android folder access and background behavior still require a physical-device test. No Android device was attached during the initial build.

The helper's native source and release signing key are kept outside the public web repository. The source project has a reusable local build script; private signing material must be backed up separately and must never be uploaded.

## Connection reliability update

Android action validation runs in the originating browser session, including Initialize. The relay hands the phone one request at a time so a failed result upload cannot strand other claimed requests. Transient network failures retry delivery without repeating a completed file operation. An expired result receipt does not stop the entire connection.

The Companion screen shows connecting, connected, retrying, disconnected and error states. Disconnect stops local file access immediately and attempts server revocation with bounded network timeouts. If that acknowledgement cannot arrive, the screen explicitly says the phone is disconnected and the server lease will expire. Reconnect after Android stops the service or the server session expires.

The mobile website hides local Ollama and closes the pairing dialog after a successful workspace check. The updated APK retains its existing display name and version. Server integration tests cover Initialize and revocation; physical-phone file-provider and background tests are still pending.
