# Verification evidence

Recorded 8 October 2026 on Windows, AMD A8-7410, approximately 7 GB usable RAM. This file distinguishes passing checks from pending native acceptance.

## Passing checks

- TypeScript and production Vite build.
- Seven frontend domain tests: actual time, year split, DST, exclusions, deterministic filters/artwork, export privacy.
- Ten Rust core tests: journal replay, year/DST boundaries, hard playlist constraints, catalog pagination/search/favorites, identity on reimport, history deletion, privacy revisions, and source-alias reassignment.
- Five Chromium journeys against an isolated production preview: import a real WAV; play/pause/seek without counting seeked time; privacy-safe JSON and 1080x1920 PNG; mobile filter playlists and Spanish reload; real 30-second qualification followed by exclusion and reload; 125-track search/favorite/manual-picker and virtualization check; automated WCAG A/AA checks on Library, Playlists, Year and Settings.
- Mobile and desktop screenshots inspected locally under ignored artifacts/.

The added snapshot-sharing regression also passes: a saved snapshot is blocked from export after a session exclusion changes its evidence.

## Native setup evidence

Installed Rust, pinned portable LLVM MinGW, Java 17, Android API 36, build tools 36, NDK 29, platform-tools, an emulator and an API 33 x86_64 image. The standard Visual Studio installation lacks a complete Windows SDK, and its repair required an administrator prompt that was canceled. The portable LLVM route avoids that installation requirement.

Android project generated successfully. Both x86_64 and ARM64 debug APKs built through the file-copy Gradle fallback; apksigner verified their v2 signatures. The portable Windows debug executable also built successfully. The emulator hypervisor driver is unavailable; software emulator attempts did not reach a booted device. No Android runtime or background-playback acceptance is claimed by these build or browser checks.

## Required acceptance gates

- Native Windows actual folder import/playback/reopen.
- Android APK installation, MediaStore and folder grants, notification/lock-screen controls, pause/seek/repeat/shuffle, foreground-to-background transition, 30-minute playback, and reopening with journal replay.
- Audio focus, headset disconnect, missing/revoked sources, buffering and interruption behavior.
- Physical Android device reliability, battery, screen-reader and text-scaling checks, and import/search/scroll latency measurements.
- Signed release packaging and final transitive-license review.

Use implementation-plan.md and AGENTS.md as the handoff contract. Update this log with commands, artifact paths and observed results as gates pass.

Android Kotlin verification: an isolated Gradle project compiled both the installed Tauri framework and this repository native-music plugin with API 36 and Java 17. The first run exposed the missing Activity dependency, permission enum import and a generic-type parser error; the corrected compileDebugKotlin passed. This establishes source compilation, not APK or device acceptance.

Native Rust verification: Windows cargo check passed after fixing the MutexGuard coercion and channel type. Android x86_64 Rust library compilation passed. Full Android CLI packaging then failed at symbolic-link creation because Windows Developer Mode is unavailable; scripts now provide a file-copy Gradle fallback. The compiled Tauri dependency fingerprint confirms custom-protocol was enabled in the first native library; the scripts also request it explicitly.

Build commands and artifacts:

```powershell
./scripts/build-desktop.ps1 -Debug -Portable
./scripts/build-android.ps1 -Debug -Target x86_64
./scripts/build-android.ps1 -Debug -Target aarch64
```

- Windows: `src-tauri/target/debug/local-music.exe`, with WebView2Loader.dll, libunwind.dll and its notice copied beside it.
- Emulator APK: `src-tauri/gen/android/app/build/outputs/apk/x86_64/debug/app-x86_64-debug.apk`.
- ARM64 APK: `src-tauri/gen/android/app/build/outputs/apk/arm64/debug/app-arm64-debug.apk`.

These are debug builds, not signed public releases. The Windows GNU linker originally exceeded the PE export limit by auto-exporting dependency symbols from the unused desktop cdylib. build.rs now disables that auto-export on Windows GNU only; Android JNI exports are unaffected. Both Android builds exercised the Windows symbolic-link fallback successfully.

Windows startup smoke check: the refreshed executable stayed running, exposed a nonzero main-window handle, and reported Responding=True. Redirected stdout/stderr were empty. This checks process/window startup only; no native folder import, audio interaction or recap acceptance was performed.

Emulator recovery attempts used headless software acceleration with SwiftShader, GPU-off fallback, and Vulkan disabled. ADB remained offline and no guest kernel boot was observed; the QEMU process threads were suspended. The stalled helper was stopped. This is an environment blocker, not a passed emulator test; the exact cause has not been established.

## Import feedback feature

Work is recorded on dev.feature-todevelop, based on the dev integration branch at cdeff90. Master remains the first-draft baseline.

Desktop metadata and artwork reads now occur outside the catalog mutex. Progress events are emitted after every ten processed audio files and for the final partial batch. The native adapter registers the listener before invoking import and removes it afterwards. The UI refreshes songs, album/artist groups and an open manual picker as import progresses, shows an immediate spinner and counts, and refreshes partial results even if import fails.

Missing or unreadable artwork already has a deterministic geometric fallback in the app palette. The new batch regression blocks file eleven, checks that ten songs and their working SVG covers are visible while the spinner remains, then releases the last file and verifies eleven songs persist after reload.

Verification: production TypeScript/Vite build and seven frontend unit tests passed; the portable Windows debug executable rebuilt successfully with the feature. All six browser journeys passed, including the batch-before-completion regression. Native Windows folder import remains an interactive acceptance check; browser results do not establish native import behavior. Existing Android APK artifacts predate this feature and have not been refreshed in this change.
