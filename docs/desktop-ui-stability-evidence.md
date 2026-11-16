# Windows UI audit — 15 November 2026

Review branch: `dev.desktop-ui-stability`, based on `dev` at `77beb88`. Application version remains 0.18.0. No merge, tag or release publication is included.

## Findings and changes

| Finding | Correction | Evidence |
| --- | --- | --- |
| Detached Queue buttons grew beyond their fixed 44 px grid cells. Native baseline hit areas overlapped by approximately 8 px. | Grid columns now use the same size as the buttons. | Native corrected bounds are separate; browser tests cover 360 × 480 through 1200 × 1000. |
| Detached Equalizer controls sat near the top of a tall window. | Center the group when space permits; retain normal scrolling in short windows. | Native center offset changed from 72 px to 0 px; short-window controls remain reachable. |
| Every desktop tab change dimmed confirmed content through a fade. | Present the desktop view immediately; preserve the existing phone slide behavior. | Regression records animation creation and verifies opacity stays unchanged and the first card click works. |

Detached windows do not always set the Library's layout attribute. The Queue selector accounts for that without enabling phone styles in those windows.

## Screenshots and review build

- [Local screenshot gallery](../artifacts/desktop-v018/PC-UI-audit.html): native before/after Queue and EQ, Library, search, Settings in light/dark/Spanish, native keyboard zoom, playlist overview/creator/generated preview, manual drafts, album/artist details, Organize, small player/Visualizer windows and About.
- [Corrected Queue](../artifacts/desktop-v018/after/queue.png), [centered EQ](../artifacts/desktop-v018/after/equalizer.png), [Spanish Settings](../artifacts/desktop-v018/after/settings-es-dark.png).
- Local portable review folder: `artifacts/desktop-v018/windows-review/`. Run `local-music.exe` with its DLLs beside it and Microsoft WebView2 Runtime installed. This normal executable opens the normal Library; it is an unsigned, unmerged review build.

The screenshots show actual Win32/WebView2 windows using a separate 12-track synthetic profile. Covers are the application's real fallback artwork. The personal Library was not used for mutating tests. Evidence files and binaries are ignored by Git and available in this workspace.

## Verification

- Production frontend build and 111 unit tests passed. All 214 browser cases passed in one full run; the additional focused run also covers minimum-size Queue targets. Core regression suites passed.
- Windows debug inspection and normal release-profile builds succeeded. The normal executable and frozen browser build contain matching frontend assets: 46 files. Executable SHA-256: `ce8de54d9a7768d4e1bade22cb64bad6bd793a10a8a9567088ec809567363379`.
- Actual native checks passed for F10 menu navigation, scoped search, Settings, zoom, playlist drafts, generation, album/artist and Organize navigation, existing-window Queue routing, detached sizing and About. Paused playback, position and queue were preserved. Audio output was unavailable and the native app used silent output; audible playback/EQ quality was not established.
- Native cached-content readiness measured p95 **47.2 ms** over 24 warmed transitions on the small fixture. This measures click dispatch to matching DOM content, not hardware input-to-display latency.
- The broader two-animation-frame proxy did **not** improve: baseline p95 **99.8 ms**, candidate **157.6 ms** under build/test load and **141.2 ms** after that load ended. A single menu sample was 93.3 ms before / 33.5 ms after. These limited samples do not establish an overall rendering speedup. The verified behavior change is immediate opaque desktop content, without the added fade.

## Remaining acceptance

Large-catalog native performance, sustained CPU/memory/battery measurements, manual screen-reader/high-contrast checks, other monitor/DPI configurations, audible output/headphones and hardware presentation latency remain separate gates. A first Visualizer window exceeded the original five-second audit timeout under concurrent compilation; it opened and passed with the native audit's twenty-second timeout. An idle follow-up measured detached readiness at 1,703 ms for Visualizer, 982 ms for Player and 1,007 ms for EQ, one sample each. Playback and queue remained unchanged. Cold-window latency is not claimed resolved by these presentation fixes.

Android layout and behavior regressions passed in the browser suite. These changes affect desktop presentation; the installed v0.18.0 Android APK was not rebuilt in this pass.
