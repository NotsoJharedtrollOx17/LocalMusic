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

Work is recorded on dev.feature-live-import, based on the dev integration branch at cdeff90. Master remains the first-draft baseline.

Desktop metadata and artwork reads now occur outside the catalog mutex. Progress events are emitted after every ten processed audio files and for the final partial batch. The native adapter registers the listener before invoking import and removes it afterwards. The UI refreshes songs, album/artist groups and an open manual picker as import progresses, shows an immediate spinner and counts, and refreshes partial results even if import fails.

Missing or unreadable artwork already has a deterministic geometric fallback in the app palette. The new batch regression blocks file eleven, checks that ten songs and their working SVG covers are visible while the spinner remains, then releases the last file and verifies eleven songs persist after reload.

Verification: production TypeScript/Vite build and seven frontend unit tests passed; the portable Windows debug executable rebuilt successfully with the feature. All six browser journeys passed, including the batch-before-completion regression. Native Windows folder import remains an interactive acceptance check; browser results do not establish native import behavior. Existing Android APK artifacts predate this feature and have not been refreshed in this change.

## Import dialog and group detail correction

The Windows folder picker is attached to the main Tauri window. The UI blocks interaction while the picker is open; import progress appears after a folder is selected. Canceling the picker leaves the library unchanged and does not announce an import. Android retains immediate progress feedback during its native scan.

Artist and album detail views now keep their own track rows. They reload their exact catalog membership on each import revision, and delayed responses from an older group or catalog page cannot replace the current view. Browser regression imports tagged WAV files while an artist detail is open, pauses after ten files, checks the artist rows, then checks that the album detail also updates in place. Core checks cover exact group membership.

Verification for this correction: TypeScript/Vite build, seven frontend tests, ten Rust core tests and seven browser journeys passed. The final portable Windows debug executable built and passed a startup smoke check: it exposed a nonzero main-window handle and Responding=True. The native folder-picker and live artist/album workflow still need interactive Windows acceptance.

## Album artwork resolution branch

The existing native catalog embedded 64 px cover data in track and group responses while Album and Artist cards display covers at about 200 CSS px. The local artwork cache also contained 512 px variants for many tracks. This explains the blocky cards shown in the Windows screenshots. Songs rows and the mini player use about 56 CSS px; the manual picker uses about 40 px. Track details and recap use about 160–200 px. The full player uses roughly 450 px.

`dev` now contains the completed live-import changes. `dev.upscale-album-covers` gives catalog rows 128 px artwork, derives that variant from existing cached 512 px files when needed, and requests 512 px artwork as Album/Artist cards, track details, recap art, and the full player enter view. A bounded frontend cache and lazy requests avoid sending 512 px data for every catalog row. Browser preview already uses 512 px artwork through its separate adapter. Embedded art with a lower source resolution cannot gain missing detail through resizing.

Verification for this branch: TypeScript/Vite build, seven frontend tests, and seven Chromium journeys passed. A Rust regression checks 64/128/512 px generated variants and regeneration of the 128 px cache from an existing 512 px image. Both Tauri Rust artwork tests passed. The portable Windows debug executable rebuilt and passed a startup smoke check (responsive process and nonzero main-window handle). Visual acceptance of a user library is still an interactive Windows check; no Android APK was rebuilt for this branch.

## Album song sequencing

The cover feature was fast-forwarded into `dev` at `52ad397`, and album sequencing work is on `dev.correct-album-song-order`. The previous importers dropped track/disc tags, group membership was returned in title order, and React sorted group rows alphabetically again. Desktop Lofty, Android MediaMetadataRetriever and browser music-metadata now retain numeric track/disc values. The native catalog and browser adapter order album IDs by disc and track, artist IDs by album then disc/track, and album/artist library sorts likewise. Group rows retain that catalog order, including across pagination and live import, and playback uses the same IDs. Explicit playlist and edited queue order is preserved.

Older records accept absent fields. A first-read metadata pass backfills available sources while preserving IDs and user state. Native file/content-URI reads occur outside the catalog mutex; a separate gate prevents concurrent migration passes. Unavailable sources retain their stable fallback and can be retried next launch. Missing disc tags mean disc one; unnumbered songs follow numbered songs on that disc, then title/ID breaks ties. Original order cannot be recovered from files without track/disc tags.

Regressions cover multidisc album/artist order, numeric track 2 before 10, catalog pagination, old serialized records, native tagged-WAV import and metadata backfill preserving favorites, and a browser journey checking views, playback queue and migration after stripping legacy metadata. Verification: TypeScript/Vite production build and seven frontend tests passed. Twelve Rust core tests and three native Tauri tests passed. The seven existing Chromium journeys passed, and the new album-order journey passed after correcting its queue-dialog selector and using a longer playback fixture. Android plugin Kotlin compilation passed against API 36. The portable Windows executable rebuilt and passed a responsive-window startup check.

The Windows startup check also exercised the real existing catalog: all 160 legacy entries gained ordering metadata and positive track numbers. Track IDs and favorites were preserved, and track/session/playlist counts were unchanged. A sample of extracted disc/track values matched an independent read of the embedded tags. No interactive native playback or Android runtime acceptance is claimed by those checks. The ARM64 Rust library and Android debug APK also rebuilt successfully through the existing Windows file-copy packaging fallback; apksigner verified the APK v2 signature. The x86_64 APK was not refreshed. Android import, migration, playback and background behavior still require device acceptance.

## Album and release-year labels — 9 October 2026

Song rows display album name and release year below the artist; album cards append the year to their subtitle. Years come from embedded year/date tags, with original-release tags as a fallback on desktop/browser. Missing years are omitted. Desktop, browser and Android imports retain year metadata, and the existing first-read migration backfills older entries without replacing their stored track ordering or favorites.

Verification: production TypeScript/Vite build, seven frontend tests, twelve Rust core tests, three native Tauri tests, and all eight Chromium journeys passed. The tagged-WAV regression checks release-year import and legacy backfill; the browser journey verifies card/row labels before and after migration. The captured artist-view screenshot was inspected for layout. Android plugin Kotlin compilation passed; APK artifacts have not been refreshed for this label addition. Windows build and catalog backfill results are recorded below.

The portable Windows executable rebuilt successfully and opened a responsive window. The startup migration processed 160 existing entries and recovered tagged years for 160; track/disc values and favorites were preserved, and track/session counts were unchanged.

## Stable yearly recap and social PNG exports — 9 October 2026

Merged the album sequencing and release-year label branch into `dev` at `fd6dfb4`, then created `dev.-stable-year-recap`. JSON export actions were removed from the app. Your Year and the final recap-story scene now open an image preview with Story (2160×3840) and Feed (2160×2700) formats. The preview and downloaded PNG share the same blob. The renderer waits for local fonts, fits long names, includes total listening, active days, qualified plays, monthly bars, artist/song/album highlights, and real calendar coverage. Incomplete history is labeled and unobserved months are separate.

Live recap refresh uses request guards, refreshes on playback transitions and focus, and periodically refreshes during playback. Image preparation flushes current listening; saved snapshots remain frozen and select their own year. Completed periods display December 31 instead of the exclusive January 1 boundary. Under-one-minute listening displays <1 consistently. Export shows preparation/save states, supports retry after save failure, and checks privacy both before preview and before writing the image. Native PNG save dialogs report cancellation separately from success; the Windows chooser is attached to the app window.

Verification: production frontend build and nine frontend unit tests passed; twelve Rust core and three native Tauri tests passed. All nine Chromium journeys passed in the final run, including both PNG dimensions, exact preview/download byte equality, empty-history behavior, long names, English/Spanish image output, frozen snapshot selection, and privacy changes after preview. The Library accessibility scan exceeded its original five-second polling budget; unchanged WCAG checks passed after increasing that budget to fifteen seconds. The populated mobile export dialog also passed its accessibility check. Story/Feed images and the mobile preview were visually inspected; the first Feed iteration overlapped detail lines, which was corrected and rechecked. The image artifacts contain synthetic test history, not user listening results. Android Kotlin compilation passed. Native package and startup results follow below.

The portable Windows debug executable rebuilt and passed a startup smoke check: responsive process, nonzero window handle and no premature exit. Native Windows file-picker/save/cancel behavior still needs interactive acceptance. Inspected populated PNG artifacts measured approximately 0.97 MB for Feed and 1.35–1.37 MB for Story at the documented pixel dimensions, below the native export size limit.

The year selector now uses the configured recap time zone, including near New Year. Clearing listening history resets the selected year and leaves snapshot mode, so the screen reflects the new empty history. Regressions cover both calendar boundaries and the deletion flow.

Final artifacts were rebuilt after the calendar and history-reset changes. The Windows startup check again showed a responsive process with a nonzero main-window handle. The ARM64 Android debug APK rebuilt successfully through the existing file-copy packaging fallback, and apksigner verified its v2 signature. The x86_64 APK was not refreshed; Android save chooser, playback, and background behavior still require device acceptance.

## Recap save confirmation correction — 9 October 2026

The previous success text sat below the large image preview and could be offscreen. Successful PNG saves now show a fixed confirmation popup with a check icon above the preview, independent of modal scroll. It remains visible until another export action or closing the preview; canceled and failed native saves still do not report success. The browser export journey checks the popup is in the viewport both after saving and after scrolling back to the dialog header. Verification results follow below.

Verification: production frontend build, all nine frontend unit tests, and all nine Chromium journeys passed, including the new popup visibility/scroll assertion. Rust rules and native save-result handling were unchanged. Android APKs were not refreshed for this UI correction. Windows rebuild results follow below.

The portable Windows debug executable rebuilt successfully with this correction. Native save-dialog acceptance was not rerun for this presentation-only change.

## Album loading flash correction — 9 October 2026

Merged the completed recap branch into dev at 8132366 and created dev.weird-flickering-albums. Opening an album/artist previously replaced the grid with an empty detail screen before its catalog reads completed. The grid now remains visible with a small loading indicator until songs and group membership are ready, then the detail view commits together. Choosing another library section cancels the pending navigation. Existing detail rows remain visible during live refresh. Native high-resolution covers are decoded before replacing the displayed image; decoded cached covers are reused when cards remount. Failed upgrades retain their current image and can retry.

A delayed IndexedDB read regression checks the album card remains visible while opening, then switches to Songs before releasing the read and checks the stale response cannot open the album. Browser verification does not establish native WebView rendering behavior; Windows visual acceptance and Android runtime acceptance remain interactive checks. Final build/test results follow below.

Production frontend build, all nine frontend unit tests and all nine Chromium journeys passed, including delayed album opening/cancellation, live artist/album imports, and album order. Rust rules were unchanged. Android APKs were not refreshed for this UI correction. Windows build results follow below.

The portable Windows debug executable rebuilt successfully with the group transition and cover decoding fixes. No native visual acceptance is claimed by the build alone.

## Recording follow-up: startup theme and library tab state — 9 October 2026

Inspected the supplied 56-second OBS recording using extracted frames. Around 5–8 seconds the native window is blank/light before the dark interface; around 9 seconds an empty-library message precedes catalog rows. Around 41 seconds Albums displays an empty-tag message before cards; around 45.5 and 48 seconds the newly selected tab still shows the other tab’s cards. These are separate startup and data-ownership issues from album-detail loading.

The HTML entry restores a validated theme hint synchronously; persisted settings are read and applied before mounting React. Windows stays hidden until the themed React shell has committed, then a desktop-only native command reveals it. Actual settings remain authoritative; storage failure falls back to normal settings loading. Album and artist results now have separate caches, request generations, loading/error states and pagination. First reads show static, non-shimmering card placeholders; only completed empty results show empty messaging. Cached cards retain their own metadata during refresh, and errors provide retry. Initial library loading also waits before displaying the empty-library onboarding.

A new browser regression holds catalog reads during dark-mode reopening and initial Albums/Artists loads, checks the first React shell uses the saved dark theme, verifies no premature empty messages, and rapidly switches cached tabs with one response held. Native window presentation still needs an actual startup check. Final results follow below.

Verification: production frontend build and nine frontend tests passed; all nine existing Chromium journeys passed. The new startup/tab regression passed after correcting its sample fixture expectation from eight groups to four, and passed again after matching the native background to the resolved theme. Twelve Rust core tests and three native Tauri tests passed. The dark Albums screenshot was inspected. Native package/startup results follow below.

The portable Windows executable rebuilt and its startup smoke check passed: the startup gate revealed a responsive process with a nonzero main-window handle and no premature exit. This checks that hiding the initial window does not leave it inaccessible; pixel-level native startup acceptance is still separate.

Android compilation initially caught a misplaced mobile entry-point annotation introduced with the window command; it was moved back to run, and desktop-only context mutation was scoped away from Android. The ARM64 debug APK then rebuilt through the existing Windows file-copy packaging fallback, and apksigner verified its v2 signature. Windows was rebuilt again after that correction. ADB reported no connected emulator or device, so no Android runtime acceptance is claimed; x86_64 was not refreshed.

## Playlists inside Library — 9 October 2026

Merged the accepted loading/startup branch into dev at da0a505 and created dev.move-plalist-into-music. Playlists now sits beside Songs, Albums and Artists in the Library tab row; the separate sidebar/bottom-navigation entry is removed. Main navigation is Library and Your Year. Playlist creation, explicit-filter generation, manual selection, editing and playback retain their existing state and commands. Album/Artist requests only run for their own tabs. The tab row fits normal mobile widths and can scroll within its own row at narrower widths instead of overflowing the page.

Browser journeys now enter Playlists through its Library tab on desktop/mobile. The mobile journey checks Library remains the main heading, Playlists is selected and bottom navigation has two entries; existing generation/editing and manual-picker checks still run. The mobile accessibility scan includes the new Playlists subtab. Final results follow below.

Production frontend build and nine frontend unit tests passed. Nine browser journeys passed in the full run, including mobile playlist generation/editing, desktop manual selection, mobile accessibility, album order and dark startup/tab loading. The recap accessibility scan then caught the existing primary-button hover color at 4.46:1 against its text. The hover shade was adjusted within the orange palette to 4.73:1; the complete recap journey passed on its targeted rerun. The mobile Playlists-tab screenshot was inspected. No Rust domain logic changed. Native builds follow below.

The portable Windows debug executable rebuilt successfully with the final navigation and contrast changes.

The ARM64 Android debug APK also rebuilt successfully through the existing Windows file-copy packaging fallback, and apksigner verified its v2 signature. ADB reported no connected emulator/device, so Android runtime acceptance remains pending; x86_64 was not refreshed.
