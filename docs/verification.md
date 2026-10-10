# Verification evidence

## Documentation integration — 9 October 2026

Fast-forwarded the completed playlist navigation branch into `dev` at `36e5f53`. Refreshed README, architecture, implementation status, branch instructions and a developer code map against the current source and prior verification entries. Checked referenced local paths, package scripts and Android SDK configuration, and ran `git diff --check`. This documentation-only change did not rerun application tests or native builds; the prior feature results and Android runtime limits remain as recorded below.

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

## Phase 2 music flow and modularization — 10 October 2026

Work is on `dev.ux-flow-step-two`, based on `dev` at `79e704c`. `main` and `v0.1.0` remain at `eb27174`. The approved behavioral plan is [phase-two-ux-flow.md](phase-two-ux-flow.md); the original reference images are preserved. The existing orange/charcoal visual language is retained.

`App.tsx` now composes the UI in 52 nonblank lines. The former `components.tsx` has been replaced by individual component files and a barrel. Feature views and dialogs live in `src/app/`, shared controls in `src/components/`, and player/search/menu surfaces and interaction hooks in `src/ux/`. State, guarded catalog reads and actions have separate hooks; the coordinator contains no JSX. The developer guide documents the ownership boundaries.

Implemented centered tap/swipe/keyboard Library tabs with scroll retention and a compact mobile heading; ready-only detail transitions and artist Tracks/Albums; a shared player/queue surface with anchored transport, nested dialog return and collapse gestures; grouped search with stale-read guards and Load more; anchored menus, long-press and explicit selection; persistent removal/Undo/reimport; capability-based sharing and Android sound effects. SQLite visibility is separate from listening records, so history and retained playlist membership survive removal. Browser sample restoration and playback/editing with hidden playlist members are covered by regressions.

### Automated and visual checks

- Production TypeScript/Vite build and all nine frontend unit tests passed. A separate TypeScript unused-local check passed after the module split.
- Thirteen Rust core tests and three native Tauri tests passed. The new native regression covers persistent visibility, history preservation, grouped search, restoration and playlist membership.
- A full sixteen-journey Chromium run passed fifteen journeys; the grouped-search fixture timed out while uploading its audio files, before feature interactions. That fixture used forty-second WAVs despite not playing them. It now uses one-second WAVs. The reported timeout interval spans a host clock/suspend discontinuity and is not an app performance measurement.
- All six Phase 2 journeys passed on the final targeted rerun after reducing that fixture and adding the sample-restoration regression. This closes the upload failure; it is a targeted rerun, not a subsequent full sixteen-test run.
- Browser coverage includes delayed catalog/import updates, album sequencing, recap/export, narrow and desktop layouts, touch tab/player gestures, keyboard/focus return, stale search results, dark mode, reduced motion, selection, share cancellation, removal/Undo/reimport and hidden playlist editing. Search/player accessibility scans use axe; the JavaScript Back bridge is exercised separately from Android's dispatcher.
- Inspected desktop artist-Album and search screenshots, and the narrow dark player screenshot. Cards, detail artwork, search and anchored transport displayed without the earlier loading swap or clipping in those captures. These are browser observations with synthetic audio/catalog data.

### Native builds

The final portable Windows debug executable built successfully. The final ARM64 Rust library and Android debug APK built through the existing Windows file-copy packaging fallback; Gradle completed successfully and apksigner verified the APK v2 signature. A redirected Windows build invocation initially stopped because PowerShell 5.1 treated Tauri's stderr informational output as a terminating error. Running the normal build script without redirection completed successfully. This was a command-shell issue, not a compiler failure.

The final Windows startup smoke check reached a responsive process, nonzero main-window handle and the `Local Music · Your Year` window title. The startup gate revealed the actual app window without a premature exit. Only the process launched by the check was then closed. This verifies startup availability, not pixel-level native motion, native file-picker behavior or a complete playback session.

### Android runtime attempt and acceptance boundary

ADB reported no connected device or emulator. The existing API 33 x86_64 AVD was available, but `emulator -accel-check` reported that the Android Emulator hypervisor driver is not installed. A separate software-mode launch (`-accel off`, SwiftShader, one core, 1536 MB, no window/audio/snapshot) initialized graphics and then exited with code 1 before an ADB connection. The exact software-launch failure cause was not established. No system driver or firmware settings were changed.

Android native Back, system sharing/read grants, effects attachment, background playback and suspension behavior remain device/emulator acceptance gates. Browser tests and Kotlin compilation do not establish them. Narrator/TalkBack, interactive Windows file choosers, native zoom/font scaling, interruption under real playback, and measured motion/performance also remain separate acceptance checks. The older x86_64 APK was not refreshed.

## Rust native module split — 10 October 2026

Continued on `dev.ux-flow-step-two` after the React split. The native `src-tauri/src/lib.rs` decreased from 976 lines to 68. It now declares modules, configures plugins/startup and registers command paths. Shared state and initialization live in `state.rs`; all 36 IPC handlers moved into nine feature modules under `commands/`. Playback dispatch lives in `playback/mod.rs`, the existing Windows worker moved intact to `playback/desktop.rs`, and Android journal ingestion moved to `playback/android.rs`. The already focused `music-core` domain modules remain their existing owners.

A comparison against the saved pre-refactor source confirmed the 36 handler signatures/bodies and IPC registration names/order match, allowing formatting, trailing parameter commas and crate visibility changes. The desktop worker was moved intact. Command names, arguments, responses, events, persistence and journal acknowledgement order were retained. The developer guide and architecture document describe the new module paths.

Verification: Rust formatting completed; all thirteen core regressions and three native Tauri tests passed. Native build/startup results are recorded below. This change is confined to the native Rust shell; browser tests cannot exercise these Rust modules. The Phase 2 frontend/browser results above remain separate evidence.

The portable Windows debug executable rebuilt, including the production frontend build. Startup reached a responsive process with a nonzero main-window handle and the `Local Music · Your Year` title; the launched process was then closed. This exercises native settings hydration and window reveal after the module move, not a complete interactive native journey.

The ARM64 Android Rust library and debug APK rebuilt successfully after removing an unused Android-only import introduced during the split. Packaging used the existing Windows file-copy fallback, and apksigner verified the final APK v2 signature. ADB again reported no connected target. Android runtime acceptance remains pending under the emulator limitation documented above; this refactor does not establish playback, journal recovery or motion performance on a device.

## App context menus and browser shortcut suppression — 10 October 2026

The user clarified that the requested contextual menu is the right-click menu. Track rows now open their existing styled actions through right click or Shift+F10, as well as the overflow button. Other areas use an app navigation menu; album/playlist cards offer Open. Text editors and selected display text offer relevant clipboard actions. Menus fit the viewport, keep keyboard navigation and focus return, and close on Escape, outside click, scroll, resize and window blur. Text edits preserve React-controlled values; a denied clipboard request keeps the original text and reports keyboard alternatives. Long press continues to select mobile tracks.

Windows disables default WebView context menus and devtools. A native accelerator callback handles F5/F12 and Ctrl+R, including Ctrl+Shift+R, without turning off editing or zoom accelerators. The frontend native-only capture guard blocks reload and inspector variants. Browser preview retains browser-owned developer shortcuts. The two Windows dependencies reference packages already present in the lockfile; their versions did not change. The native policy is isolated in `webview_policy.rs` and the React menu remains one component per file.

Production TypeScript/Vite build and eleven frontend tests passed. Four native Tauri tests passed, including the selective-key policy regression. All eight targeted Chromium journeys passed (two context-menu/editor journeys and six Phase 2 journeys), covering keyboard focus, edge placement, card opening, clipboard denial and the existing player/search/selection/removal flows. Browser clipboard tests use a controlled API substitute and do not establish native clipboard permissions. Native build and final visual results follow below; core catalog/history rules were unchanged.

The final context-menu rerun added SVG-icon coverage and caught a focus-induced scroll dismissing an album menu. Initial menu focus now uses `preventScroll`; both context-menu journeys passed on the final rerun. The narrow menu screenshot was inspected: its surface, focus indicator and type follow the existing visual system, and the popup fits within the viewport. TypeScript's unused-local check and Git whitespace checks passed.

The final portable Windows executable rebuilt and reached a responsive process, nonzero main-window handle and the app window title. Its startup logs reported no WebView policy setup error. Only the test process was closed. This verifies native startup and policy installation; physical shortcut presses, native clipboard permissions and pixel-level native menu acceptance remain interactive checks rather than browser-test claims.

The final ARM64 Rust library and Android debug APK rebuilt through the existing Windows file-copy packaging fallback; apksigner verified the v2 signature. ADB reported no connected target, so Android runtime acceptance remains pending. Build tools, screenshots and startup logs remain ignored artifacts. The feature stays on `dev.ux-flow-step-two`.

## Readable time zones and persistent popup dismissal — 10 October 2026

Continued on `dev.ux-flow-step-two`. Settings now displays readable location names, standard/daylight abbreviations (for example PST/PDT and EST/EDT), annual UTC offsets and current local date/time with the active abbreviation/offset. Underscores and the technical region prefix are removed from display labels; native/browser persistence and recap calculations retain the original IANA ID. Labels use runtime Intl data rather than assuming a fixed PST/EST offset throughout the year. The selected description and localized recap-boundary hint remain visible beneath the select at narrow widths. The location-label catalog is memoized by language/year.

The popup's close handler did clear its React state, but each native playback poll republished the same snapshot error and reopened it. The UI now reports error transitions, suppressing repeated identical errors after dismissal and allowing the same failure again after a recovery snapshot. Explicit action failures remain reportable. Modal keyboard scopes include the error close button, and dismissal returns focus to the active surface. Native playback error state and audio-device handling are unchanged.

Verification: production build and thirteen frontend tests passed, including Pacific/Eastern standard/daylight offsets, fractional offsets and readable multi-part location names. All ten targeted Chromium journeys passed: the existing six Phase 2 and two menu journeys, plus time-zone persistence/Spanish narrow layout and popup dismissal/recovery. The latter uses controlled native IPC responses through the actual NativeMusic subscription/polling adapter; it does not prove native hardware audio behavior. The test checks that the banner remains absent across more than two additional polls, and that a new failure after recovery can be closed with mouse and keyboard. The narrow Spanish Settings screenshot was inspected; helper text and controls fit the viewport. TypeScript unused-local and Git whitespace checks passed. Native artifact results follow below.

The final two Settings/feedback journeys passed again after extending coverage to Track details over the retained player. Inactive parent focus scopes now ignore Tab, allowing the active dialog to include the error close button and restore focus after dismissal.

The first Windows build attempt was blocked by the running app locking its executable. After the user closed it, the portable debug build succeeded. The freshly built executable reached a responsive process, nonzero main-window handle and the `Local Music · Your Year` title; only the launched test process was closed. This checks native startup, not interactive audio-device behavior. No Rust domain rules changed in this fix.

The ARM64 Android native library and debug APK rebuilt successfully through the existing Windows file-copy packaging fallback. Apksigner verified its v2 signature. ADB reported no connected target; Android runtime and physical audio-device acceptance remain pending. Build artifacts and screenshots remain ignored.

## Automatic device calendar and inline Settings choices — 10 October 2026

Continued on `dev.ux-flow-step-two`. Recap now follows the device IANA zone automatically. Native settings reads validate and persist the detected zone, replacing older manual overrides without modifying other preferences or listening-history coverage. Browser settings reads apply the same policy. React detects changes on focus, visibility return and once a minute while visible, then uses the existing settings persistence/recap write gate. Live days/years are regrouped using the device zone; frozen snapshots keep their recorded zone and coverage. Settings replaces the zone dropdown with a compact read-only summary and replaces Language/Appearance dropdowns with labeled inline pressed buttons.

Production build and thirteen frontend tests passed. Thirteen Rust core regressions and five native tests passed, including replacement of an initialized manual override, preference/history preservation and invalid-zone fallback. All eleven affected Chromium journeys passed: library/listening/import/order, recap PNG/snapshots, saved dark-mode loading, device-zone synchronization and error dismissal. The device-zone test simulates an OS change while suspended, checks the persisted New York zone, and verifies that startup replaces it with the current Los Angeles zone. The narrow Spanish dark-mode screenshot was inspected; choices and summary fit without overlap or horizontal overflow. Browser simulation does not establish Android OS resume behavior.

The portable Windows debug build succeeded and the updated app started with a responsive process, nonzero main-window handle and the `Local Music · Your Year` title. Only the launched smoke-test process was closed. The ARM64 Android library and debug APK rebuilt through the existing Windows file-copy fallback; apksigner verified the v2 signature. ADB reported no connected target. Android runtime checks of device-zone changes and resume remain pending. Git whitespace checks passed; generated artifacts and the user's untracked UX guide are excluded from this change.

## Step 3 equalizer and personal sound — 10 October 2026

Fast-forwarded `dev` from `79e704c` to the five Step 2 commits ending at `da37dc7`, then created `dev.sound-eq-adapt-sound`. `main` and `v0.1.0` remain at `eb27174`. Saved the approved [sound plan](phase-three-sound-eq-adapt.md) before implementation. Reference images and the user's untracked UX guideline are preserved.

Implemented application-owned ten-band EQ, preamp, original presets, custom preset management, temporary bypass, editable offline configuration, runtime status and output Retry. Windows uses a Rodio source wrapper and output notifications; Android uses service-owned custom Media3 software PCM processing; browser uses an actual AudioWorklet. Personal setup has bounded per-ear tones, reference consistency checks, derived curves, matched comparison, named profiles, retest and explicit activation. Setup stops on cancellation/interruption/lease expiry and does not use the listening journal. Output generations reject stale activation confirmations. Android software PCM16 output disables float output, encoded passthrough and offload; power and latency impact is unmeasured.

### Automated and visual evidence

- `npm.cmd run check`: production TypeScript/Vite build and **21 frontend tests passed**. TypeScript unused-local check and Git whitespace check passed.
- **13 Rust core tests and 12 native shell tests passed.** DSP tests cover shared RBJ coefficient fixtures, response/headroom, bypass, linked limiter, per-channel histories, Nyquist, mono promotion, duration/seek and tone protocol boundaries. A source-span test initially assumed Rodio's SamplesBuffer reports a decreasing span; its actual span contract reports the full span until exhausted. Corrected that fixture assumption and the final native suite passed.
- **3 Kotlin JVM processing tests passed**, including shared coefficient fixtures, bypass/limiter bounds and tone isolation/amplitude. Tests passed again after formatting the focused Kotlin modules. JVM tests do not exercise Android AudioTrack, Media3 rendering, device routing or the service lifecycle.
- The initial full **24-journey Chromium run passed 23**. The remaining copy/download journey checked a transient toast after comparing a large downloaded file. Changed its assertion order to check the toast first while retaining the exact byte comparison. That journey and the four initial sound journeys then all passed in a targeted five-journey rerun. This is not a subsequent full-suite pass.
- Sound journeys exercise empty-library configuration, preset Save/Rename/persistence, narrow Spanish dark-mode controls, native-output-unavailable/Retry through controlled IPC, complete fourteen-pulse setup, comparison, save-off/explicit activation, retest interruption and zero setup-created history records. An analyser attached to the **real browser AudioWorklet** measured over 8 dB change in the 1 kHz/250 Hz balance after a band edit; bypass restored the prior balance. These are browser processing observations, not native audible-output measurements.
- A subsequent **five-journey sound run passed**, adding six-channel import/processor-channel preservation and disabled personal setup for multichannel audio, plus Escape returning from setup to sound controls. A targeted real-Worklet journey passed again after adding a controlled `processorerror` event: the graph returned to ordinary playback, displayed the failure and recovered through Retry. The event is injected; it tests recovery handling rather than reproducing a naturally occurring processor crash. On Windows, the completed test server stalled during shutdown; only its verified preview process was stopped, after every journey had passed, and Playwright exited successfully. Its elapsed shutdown time is not an audio-performance measurement.
- Inspected the desktop and narrow Spanish dark-mode sound screenshots. Sliders, selected presets, long names and personal controls fit the tested viewports without horizontal page overflow. The earlier full run also covered existing keyboard/accessibility, dark startup, import/listening/order, player/search, selection/removal/Undo and recap PNG journeys.
- The preset persistence journey passed on its final targeted rerun with explicit keyboard-focus assertions after Save and Rename. Delete and editor cancellation also return focus to retained controls. Final TypeScript unused-local validation passed. Screenshots and tool/build outputs remain ignored artifacts.

### Native and release acceptance boundaries

The Windows portable debug executable compiled and reached a responsive process, nonzero window handle and the `Local Music · Your Year` title. Its startup error log was empty; only the launched test process was closed. This proves startup, not native audible EQ, headphone channel mapping or hot-plug behavior. An earlier smoke invocation stopped at the temporary untitled window handle; the completed check waited for the app title.

The ARM64 Android library and debug APK compiled through the existing Windows file-copy packaging fallback. Apksigner verified the APK v2 signature. ADB reported no connected target; the earlier emulator acceleration/software-launch limitations remain unresolved. The x86_64 APK is not refreshed. Android runtime acceptance is pending a usable emulator or device.

Physical stereo-headphone checks are required before personal setup is release-ready: left/right tone routing, comfortable volume, output-change/interruption stopping, comparison loudness and artifacts. Native missing-output recovery, suspended WebView ownership, background playback, migration on a device EQ, audio focus and actual Back dispatch also remain runtime gates. Browser automation does not prove them. Narrator/TalkBack, native zoom/font scaling and performance/battery/latency claims require separate observations or measurements. The profile is an experimental listening preference, not an audiogram, diagnosis or hearing protection. Personal data remains outside recap exports.

## Independent preamp and Treble boost - 10 October 2026

Refined `dev.sound-eq-adapt-sound`: added the original Treble boost curve (0,0,0,0,0,0,1,2,3,4), preserved manual preamp during all preset selections and Flat reset, added -12 to +12 dB preamp support in all adapters and a dedicated zero reset. Preamp edits preserve EQ preset identity. Automatic EQ headroom is labeled independently; its response-based attenuation and the peak limiter remain in place, so presets are not guaranteed loudness-normalized.

Production build and 21 frontend tests passed; TypeScript unused-local and Git whitespace checks passed. Thirteen native Rust tests and thirteen core tests passed, including positive preamp processing and rejection above +12 dB. Kotlin compilation and the three JVM processing tests passed. Three affected browser journeys passed: preset persistence/narrow Spanish UI, actual Worklet spectral processing/recovery, and positive preamp preservation across presets/Flat, reload and Reset preamp. The completed preview server required the previously documented Windows shutdown cleanup. Native package results follow below; Android and physical-output acceptance remain separate gates.

The extended positive-preamp journey passed again with saved custom presets: a preset saved at +12 dB does not restore that value when selected at 0 dB, and manual preamp edits retain preset identity. Screen-reader value text reports the formatted positive value. The first Windows package attempt was blocked by the running app locking its executable; the user closed it and the rebuild was retried.

The Windows portable debug executable rebuilt successfully after the app was closed. The ARM64 Android library and debug APK also rebuilt through the existing file-copy fallback, and apksigner verified the final v2 signature. ADB reported no connected target; Android runtime and physical headphone acceptance remain pending.
