# ATM desktop & Android apps (Tauri v2)

> **Update 2026-10-05:** for **push notifications** (and reliable GPS), install ATM as a PWA from the browser instead. Android: Chrome → Install app. iPhone: Safari → Add to Home Screen. Desktop: Chrome/Edge → Install. See `docs/push-notifications.md`. The Tauri apps below can't receive push; they only show notifications while open.

The apps are a thin native shell that opens **https://team.akaal.id**. Nothing from Next.js is bundled, so there is **no static export**: the site keeps its API routes, server actions, auth cookies and database access. A deploy to team.akaal.id updates every installed app — rebuild only when the shell itself changes (name, icon, permissions, window size).

- **Name:** ATM
- **Identifier / Android package:** `team.akaal.id`
- **Config:** `src-tauri/tauri.conf.json`
- **macOS location permission:** `src-tauri/Info.plist`
- **Android manifest:** `src-tauri/gen/android/app/src/main/AndroidManifest.xml`
- **Security:** the website gets **no** Tauri IPC (no remote capability in `src-tauri/capabilities/default.json`), so team.akaal.id cannot call native APIs.
- **iOS:** postponed. It needs Xcode and a paid Apple Developer account.

## Build machine setup (this Mac, done 2026-10-05)

- **Toolchain:**
  - Rust via rustup, with targets for Mac (aarch64 + x86_64) and Android (aarch64, armv7, i686, x86_64)
  - `brew install openjdk@17`
  - `brew install --cask android-commandlinetools`
  - SDK packages: `platform-tools`, `platforms;android-35`, `build-tools;35.0.0`, and `ndk;27.0.12077973`
  - Gradle downloads the other SDK versions it needs automatically.
- **Environment:** a marked block in `~/.zshrc` ("ATM Tauri toolchain") sets `JAVA_HOME`, `ANDROID_HOME`, `NDK_HOME`, `PATH`, and `CARGO_TARGET_DIR`.
- **Build output lives outside iCloud.** The repo is in iCloud Drive, so build output is moved out of it:
  - Rust → `~/.cache/atm-tauri-target` (`CARGO_TARGET_DIR`)
  - Gradle → `~/.cache/atm-android/*`, through symlinks named `build` and `.gradle` in `src-tauri/gen/android`
- **Android signing key:** `~/.android-keys/atm-release.jks`, with its password in `~/.android-keys/atm-keystore.properties`.
  - **Back both files up somewhere safe** (e.g. a password manager).
  - If they are lost, a new APK can't be installed over the old one; everyone has to uninstall first.
  - Never commit them.

## Building

| Platform | Command | Output |
|---|---|---|
| macOS (Apple Silicon + Intel) | `npx tauri build --target universal-apple-darwin` | `~/.cache/atm-tauri-target/universal-apple-darwin/release/bundle/dmg/ATM_1.0.0_universal.dmg` |
| Android | `npx tauri android build --apk --target aarch64` | `src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk` |
| Windows | GitHub → Actions → **Desktop build** → *Run workflow* | Artifact **ATM-windows** (the `.exe` installer), plus **ATM-macos** |

- **Version:** bump `version` in `src-tauri/tauri.conf.json` before each release. Android derives `versionCode` from it, and a higher code is required to update over an installed app.
- **Android target:** `--target aarch64` covers every modern phone. Drop the flag to build all four ABIs; the APK gets much bigger.

## Installing (send this part to the team)

These builds are for internal use and are not signed by Apple or Microsoft, so each OS shows a one-time warning.

### macOS (.dmg)

1. Open the `.dmg` and drag **ATM** into **Applications**.
2. The first time, **right-click ATM → Open → Open**.
3. If macOS still says "ATM can't be opened", go to **System Settings → Privacy & Security**, scroll down to the ATM message, and click **Open Anyway**.

### Windows (.exe)

1. Run the `ATM_…_x64-setup.exe` installer.
2. If **"Windows protected your PC"** appears, click **More info → Run anyway**.
3. ATM installs for your user only, so it needs no admin rights. If WebView2 is missing, the installer downloads it automatically.

### Android (.apk)

1. Download the `.apk` on the phone (via WhatsApp, Drive, or email) and tap it.
2. When asked, allow **Install unknown apps** for the app you opened it from (Chrome, Files, WhatsApp…). Then go back and tap **Install**.
3. If Play Protect warns about an unknown developer, tap **More details → Install anyway**.
4. On first clock-in, allow **Location** ("While using the app").

## Known limitations of the app shell

- **Google sign-in doesn't work inside the app.** Google blocks OAuth in embedded webviews (`disallowed_useragent`). Use email + password.
- **Downloading PDF/DOCX exports** may not work in the Android app, because the WebView ignores `blob:` downloads. Use the browser for exports.
- **Web push notifications** don't reach the app shell.
- **macOS location** relies on WKWebView plus the `Info.plist` key. Check clock-in once after each macOS update.
