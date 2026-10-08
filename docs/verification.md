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

Android project generated successfully. Native Rust build and APK build are in progress. The emulator hypervisor driver is unavailable; a software emulator attempt has not yet reached a booted device. No native runtime or background-playback acceptance is claimed by the browser checks.

## Required acceptance gates

- Native Windows executable and actual folder import/playback/reopen.
- Android APK installation, MediaStore and folder grants, notification/lock-screen controls, pause/seek/repeat/shuffle, foreground-to-background transition, 30-minute playback, and reopening with journal replay.
- Audio focus, headset disconnect, missing/revoked sources, buffering and interruption behavior.
- Physical Android device reliability, battery, screen-reader and text-scaling checks, and import/search/scroll latency measurements.
- Signed release packaging and final transitive-license review.

Use implementation-plan.md and AGENTS.md as the handoff contract. Update this log with commands, artifact paths and observed results as gates pass.

Android Kotlin verification: an isolated Gradle project compiled both the installed Tauri framework and this repository native-music plugin with API 36 and Java 17. The first run exposed the missing Activity dependency, permission enum import and a generic-type parser error; the corrected compileDebugKotlin passed. This establishes source compilation, not APK or device acceptance.

Native Rust verification: Windows cargo check passed after fixing the MutexGuard coercion and channel type. Android x86_64 Rust library compilation passed. Full Android CLI packaging then failed at symbolic-link creation because Windows Developer Mode is unavailable; scripts now provide a file-copy Gradle fallback. The compiled Tauri dependency fingerprint confirms custom-protocol was enabled in the first native library; the scripts also request it explicitly.
