# Local Music + Your Year

An offline local music player with a yearly recap based on actual listening. Android is the primary target; Windows is the development desktop. The browser build is a separate preview backed by IndexedDB and an HTML audio element. The interface supports English and Spanish.

## Current features

- **Library:** Songs, Albums, Artists and Playlists appear as Library tabs. Browse/search songs, open album and artist collections, mark favorites, and sort songs. Album playback follows disc and numeric track tags; artist collections group songs by album. Song rows include album and release year when tagged.
- **Import and artwork:** Import audio through the browser file picker, a Windows folder chooser, or Android MediaStore/selected folders. Catalog changes appear during import in batches of ten processed audio files, with progress and completion feedback. Missing covers receive stable geometric artwork. Native grids request larger cached cover variants as they enter view.
- **Playback and playlists:** Now Playing and the mini player support a persistent queue, play/pause, seek, skip, shuffle, repeat, queue editing and session exclusion. Create/edit playlists manually or generate them from visible metadata filters. Android playback is owned by a Media3 foreground service; Windows uses a Rust playback worker.
- **Your Year:** Recaps aggregate listening intervals, qualified plays, active days, monthly listening, top music and a playable recap playlist. They follow the device time zone automatically, show actual history coverage and distinguish unobserved months. Frozen snapshots retain their original time zone. Save snapshots, preview an image and export a matching PNG in Story **2160 × 3840** or Feed **2160 × 2700** format. A successful save shows a confirmation popup. JSON export is not part of the current UI.
- **Interface:** Light, dark and system themes, English/Spanish strings, responsive layouts and reduced-motion support. Desktop startup waits for the resolved theme; Library tabs keep separate loading and cached results, so switching tabs does not show another tab's cards or a premature empty state.
- **Music flow:** Mobile tab swipes, centered selection and remembered tab scroll; desktop keyboard tabs; artist Songs/Albums switch; a growing player surface with the queue and transport in one place. Search groups songs, albums, artists and playlists while keeping the mini player available.
- **Sound:** Application-owned ten-band equalizer on Windows, Android and browser preview, with preamp, original built-in presets, saved custom presets and temporary bypass. Controls remain editable before playback or without an audio output. Runtime status distinguishes saved configuration from active processing and offers Retry when needed. Personal sound provides an experimental per-ear tone-response flow, named profiles, strength and loudness-matched comparison. Saving leaves the profile off; using it requires explicit headphone confirmation. Output changes disable personalization. This is a listening preference feature, not a hearing test or hearing protection; physical headphone acceptance remains pending.
- **Context actions:** Track menus and selection through long press, visible Select, mouse or keyboard. Play, favorite, add to playlists, share audio/save copies, and remove from Library with Undo. Removal preserves audio files and listening history; reimport restores visibility. Resolvable Android system-effects panels remain separate from the app's equalizer.
  Right-click menus use the app's design, including text actions and keyboard navigation. The native shell blocks F5/F12 and reload/inspector shortcut variants; Windows retains editing and zoom controls. Browser preview keeps its developer shortcuts.

The app works locally without an account, metadata service or downloaded model. Generated playlists use explicit filters; semantic AI is a future feature. Library demo tracks are available only in browser preview. Demos and personal setup tones/comparison samples are excluded from recap.

## Browser preview

Install Node.js 24 LTS, then run from the repository root:

```powershell
npm.cmd ci
npm.cmd run dev
```

Open http://127.0.0.1:1420. Import your own audio or explicitly add the original sample tones. Browser imports and playback history stay in that browser's IndexedDB. Browser behavior does not establish Android background playback reliability.

## Native setup on Windows

The standard route uses Rust stable, Visual Studio Build Tools with Desktop development with C++, Windows SDK, WebView2, Java 17 and Android SDK/NDK. See the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

This checkout also has an ignored portable toolchain under `.tools/`. Its setup script downloads pinned LLVM MinGW, Java and Android command-line tools and verifies archive hashes. It needs Rustup and Node already installed, internet access and several GB of disk space.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-portable.ps1
. ./scripts/env.ps1
npm.cmd ci
npm.cmd run doctor
```

### Windows app

Stop a separately running Vite server before starting Tauri; Tauri starts its own.

```powershell
. ./scripts/env.ps1
npm.cmd run tauri -- dev
./scripts/build-desktop.ps1 -Debug
```

The portable LLVM route builds a standalone debug executable at `src-tauri/target/debug/local-music.exe`. When moving it, keep the copied runtime DLLs and `llvm-runtime.txt` beside it. The destination also needs WebView2 Runtime. A standard MSVC environment can produce the configured NSIS installer.

### Android app

The generated project is checked in at `src-tauri/gen/android`. Normal development does not require rerunning Android initialization. The configured minimum is API 26; compile/target setup uses API 36.

```powershell
. ./scripts/env.ps1
./scripts/build-android.ps1 -Debug -Target x86_64 # emulator
./scripts/build-android.ps1 -Debug -Target aarch64 # ARM64 phone
npm.cmd run tauri -- android dev
```

Debug APKs are written under `src-tauri/gen/android/app/build/outputs/apk`: `x86_64/debug/app-x86_64-debug.apk` and `arm64/debug/app-arm64-debug.apk`. With a booted matching device, use `adb install -r <apk-path>`. Use `build-android.ps1` for a complete build; `package-android.ps1` only packages an already compiled native library. Release distribution requires your signing key.

The latest recorded ARM64 debug APK was built and signature checked. The x86_64 APK was not refreshed for the latest UI changes, and no connected Android device/emulator completed runtime acceptance. See [verification evidence](docs/verification.md) before making native reliability claims.

## Checks

```powershell
npm.cmd run check
. ./scripts/env.ps1
npm.cmd run test:core
npx.cmd playwright install chromium
npm.cmd run test:browser
```

The browser suite uses an isolated server on port 1421 and writes screenshots/traces to ignored `artifacts/`. The verification log distinguishes builds, browser checks, Windows startup checks and remaining Android runtime work. A native build alone does not establish screen-off playback, audio focus, battery behavior or latency.

## For contributors

- [Developer guide](docs/developer-guide.md): current module map, data contracts, change workflow and test boundaries.
- [Architecture](docs/architecture.md): runtime ownership and data flow.
- [Recap rules and privacy](docs/recap-methodology.md): time accounting, coverage, snapshots and export.
- [Implementation plan](docs/implementation-plan.md): original plan and approved revisions.
- [Step 3 sound plan](docs/phase-three-sound-eq-adapt.md): equalizer, personal profiles, processing and acceptance requirements.
- [Verification evidence](docs/verification.md): what has actually been built and tested.
- [Third-party notices](docs/third-party-notices.md) and [MIT license](LICENSE).

Read [AGENTS.md](AGENTS.md) and the original `.AGENTS` development guide before substantial changes. Preserve the four reference images there as design source material. Keep build outputs, development tools and test artifacts out of Git.

`dev` is the integration branch and includes Phase 2 music flow and modularization. `main` and `v0.1.0` preserve the preliminary baseline. Step 3 develops on `dev.sound-eq-adapt-sound`; merge reviewed work back into `dev`.
