# Local Music + Your Year

An offline music player with a recap built from actual listening. Android is the primary target; Windows is the development desktop. The first draft includes Library, Now Playing, explicit playlist filters, and Your Year in English and Spanish.

## Start with the browser preview

Install Node.js 24 LTS, then run from this repository:

```powershell
npm.cmd ci
npm.cmd run dev
```

Open http://127.0.0.1:1420. Import your own audio or explicitly choose the original sample tones. Samples never contribute to recap. Browser imports stay in this browser's IndexedDB; native imports reference files on the device. Browser playback does not establish Android background reliability.

## Native setup on Windows

Preferred: Rust stable, Visual Studio Build Tools with Desktop development with C++, Windows SDK, WebView2, Java 17, and Android SDK/NDK. See [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

This checkout also supports a portable toolchain under ignored `.tools/` when the Visual Studio SDK cannot be installed. The setup script downloads pinned LLVM MinGW, Java and Android command-line tools, verifies archive hashes, and asks the Android SDK manager for license acceptance. It needs Rustup and Node already installed, internet access, and several GB free space.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-portable.ps1
. ./scripts/env.ps1
npm.cmd ci
npm.cmd run doctor
```

### Windows

Stop a separately running Vite server before starting Tauri, which starts its own server.

```powershell
. ./scripts/env.ps1
npm.cmd run tauri -- dev
./scripts/build-desktop.ps1 -Debug
```

The portable LLVM route builds a standalone executable without an installer. A standard MSVC environment can produce the configured NSIS installer. Music import uses a folder chooser.

For a debug build, run `./src-tauri/target/debug/local-music.exe`. Keep the copied runtime DLLs and `llvm-runtime.txt` beside the executable when moving it. WebView2 Runtime must be installed on the destination Windows machine.

### Android

The generated project is checked in under `src-tauri/gen/android`; do not rerun init during normal development. If recovering a deleted scaffold, run `npm.cmd run tauri -- android init` and reapply API 36, minimum API 26, and repository Gradle settings.

```powershell
. ./scripts/env.ps1
./scripts/build-android.ps1 -Debug -Target x86_64 # emulator
./scripts/build-android.ps1 -Debug -Target aarch64 # phone
npm.cmd run tauri -- android dev
```

APK files are produced under `src-tauri/gen/android/app/build/outputs/apk`. Release distribution requires your signing key. MediaStore import requests audio permission; selected folders use persistent Android document grants. Media3 owns background playback and its durable journal independently of the WebView.

Debug artifacts are `x86_64/debug/app-x86_64-debug.apk` for the configured emulator and `arm64/debug/app-arm64-debug.apk` for an ARM64 phone. With a booted device connected, install the appropriate file using `adb install -r <apk-path>`. The current host has not completed an emulator boot; see the verification log before treating native runtime behavior as accepted.

## Checks

```powershell
npm.cmd run check
. ./scripts/env.ps1
npm.cmd run test:core
npx.cmd playwright install chromium
npm.cmd run test:browser
```

Browser tests launch an isolated server on port 1421 and save screenshots and failed traces under ignored `artifacts/`. Native background, audio-focus, battery and latency claims require separate device evidence.

## Project notes

- [Approved implementation plan](docs/implementation-plan.md)
- [Architecture](docs/architecture.md)
- [Recap rules and privacy](docs/recap-methodology.md)
- [Verification evidence and remaining gates](docs/verification.md)
- [Third-party notices](docs/third-party-notices.md)

The original guide and four visual references remain in `.AGENTS/`. The application ships original geometry and self-hosted fonts. No account, enrichment service, model download or fabricated listening history is used. MIT license; dependency licenses are listed separately.

On Windows without symbolic-link privileges, build-android.ps1 falls back to copying the compiled native library and running Gradle packaging. package-android.ps1 is the packaging-only helper; it does not compile Rust. Use build-android.ps1 for a complete build.

## Development branches

`dev` is the integration branch; `dev.feature-live-import` contains the current import improvements. Work on the feature branch, then merge reviewed changes into `dev`. The initial first draft remains on `master`.

Import shows a persistent spinner and counts immediately. Catalog updates appear every ten processed audio files, with a final update for the remaining files. Missing or unreadable artwork uses stable geometric covers drawn from the application palette; tracks in the same named album share a design.
