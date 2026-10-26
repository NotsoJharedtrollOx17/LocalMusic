# Local Music + Your Recap

An offline local music player with weekly, monthly and yearly recaps based on actual listening. Android is the primary target; Windows is the development desktop. The browser build is a separate preview backed by IndexedDB and an HTML audio element. The interface supports English and Spanish.

## Current features

- **Library:** Songs, Albums, Artists, Playlists and Your Recap appear as Library tabs. Import music sits below the tabs; Edit is in the top-right menu, and Favorites is an automatic playlist. The compact header contains the app logo, privacy motto, tabs, Search and menu, with no sidebar or redundant Library title. Browse/search songs, open album and artist collections and mark favorites. Album playback follows disc and numeric track tags; artist collections group songs by album. Song rows include album and release year when tagged.
- **Import and artwork:** Import audio through the browser file picker, a Windows folder chooser, or Android MediaStore/selected folders. Catalog changes appear during import in batches of ten processed audio files, with progress and completion feedback. Missing covers receive stable geometric artwork. Native grids request larger cached cover variants as they enter view.
- **Playback and playlists:** Now Playing and the mini player support a persistent queue, play/pause, seek, skip, shuffle, repeat, queue editing and session exclusion. Playlists includes automatic Recently added, Recently played, Most played and Favorites collections, refreshed from your library and eligible listening history. Create/edit playlists manually or generate them from visible metadata filters. Android playback is owned by a Media3 foreground service; Windows uses a Rust playback worker.
- **Your Recap:** Choose calendar weeks (Monday–Sunday), months or years for the current period. Yearly is the initial view; the chosen timeframe is remembered. Recaps show interval-based listening, starting-period qualified plays, active days, daily/monthly charts, top music and a playable queue. Device time zone and honest coverage apply; frozen snapshots retain their original zone. Existing yearly snapshots remain readable. Story **2160 × 3840** and Feed **2160 × 2700** PNG previews/downloads reflect the selected period, with privacy checks and accurate save/cancel feedback. JSON export is not part of the current UI.
- **Interface:** Light, dark and system themes, English/Spanish strings, responsive layouts and reduced-motion support. Desktop startup waits for the resolved theme; Library tabs keep separate loading and cached results, so switching tabs does not show another tab's cards or a premature empty state.
- **Music flow:** Mobile tab swipes, centered selection and remembered tab scroll; desktop keyboard tabs; artist Songs/Albums switch; a growing player surface with the queue and transport in one place. Search groups songs, albums, artists and playlists while keeping the mini player available.
- **Sound:** Always-active nine-band equalizer on Windows, Android and browser preview: 63 Hz to 16 kHz, -10 to +10 dB. Normal keeps every band at zero; Pop, Rock, Jazz and Classical remain, and edits automatically save into one Custom option. No EQ switch, preamp or manual preset naming is needed. Older active named/boost presets migrate to Custom, archived records remain stored, and hidden manual preamp gain is reset to zero. The peak limiter remains. Controls work before playback or without an output, with truthful runtime status and Retry. EQ-only configuration version 2 retains ordinary presets/Custom while removing retired personalization data during upgrade. Migration is persisted before processing; failed writes remain retryable.
- **Context actions:** Track menus and selection through long press, the menu's Edit action, mouse or keyboard. Play, favorite, add to playlists, share audio/save copies, and remove from Library with Undo. Removal preserves audio files and listening history; reimport restores visibility. Resolvable Android system-effects panels remain separate from the app's equalizer.
  Right-click menus use the app's design, including text actions and keyboard navigation. The native shell blocks F5/F12 and reload/inspector shortcut variants; Windows retains editing and zoom controls. Browser preview keeps its developer shortcuts.

The app works locally without an account, metadata service or downloaded model. Generated playlists use explicit filters; semantic AI is a future feature. Library demo tracks are available only in browser preview. Browser demo audio is excluded from recap.

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
- [EQ-only revision](docs/remove-adapt-sound-plan.md): current sound contracts, migration and verification requirements.
- [Verification evidence](docs/verification.md): what has actually been built and tested.
- [Third-party notices](docs/third-party-notices.md) and [MIT license](LICENSE).

Read [project instructions](agents/AGENTS.md), the [development guide](agents/Music-Player-MVP-Recap-Codex-Guide.md) and the [UX/UI reference](agents/Codex-UX-UI-Design-Reference.md) before substantial changes. Preserve the four images in `agents/reference-ui-pics` as design source material. Keep build outputs, development tools and test artifacts out of Git.

`dev` is the integration branch. `main` and `v0.7.0` include the reviewed EQ-only revision on the stable player/playlist and zoom-reflow baseline. Earlier release tags remain unchanged. Start focused feature branches from `dev` and merge reviewed work back into it. See [v0.7.0 release notes](docs/releases/v0.7.0.md) for scope and validation boundaries.

### Compact navigation and sound views

Library tabs share the top row with Search and the menu. Its Edit action selects songs; Equalizer opens the nine-band EQ directly. The Songs toolbar restores Favorites filtering and title/artist/album sorting without another selection action. Playlists uses the same orange creation toolbar without a repeated overview title. Settings explains that Listening history powers Your Recap, Recently played and Most played. EQ edits apply live; sound views have no Resume button. Desktop transport and progress are centered, with action icons on the same row. The device calendar still updates recap boundaries automatically without a timezone setting. See [navigation revision](docs/library-sound-navigation.md).

v0.7.0 removes Adapt Sound across all adapters and exposes Equalizer directly. Configuration upgrades overwrite the existing sound settings key with version 2, delete retired profiles and retain the last ordinary EQ; no personal curve is converted into Custom. Native processing, output recovery and live edits remain, with no calibration or profile actions. The local release includes Windows portable and signed ARM64 development packages. See [the removal plan](docs/remove-adapt-sound-plan.md) and [verification](docs/verification.md).


The `dev.your-recap-periods` review branch adds calendar recaps; application versions remain 0.7.0 until a separate release request. See [the archived specification](docs/your-recap-periods-plan.md) and [verification](docs/verification.md).

Your Recap shows the top three songs, artists and albums with descending rank emphasis. Its ranked top-ten song list can be played or explicitly saved as an editable playlist for that period; unavailable or removed tracks are not queued or saved.
