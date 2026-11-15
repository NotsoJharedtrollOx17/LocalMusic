# v0.18.0 — Android UI consistency and responsiveness

Approved 14 November 2026. Start `dev.android-ui-stability` from clean `dev` at `11c82b7`; archive and commit this specification before implementation. Android takes priority; shared changes receive Windows regression checks. Keep application version 0.17.0 during development. Integration and release require a subsequent request.

## Recording-driven changes

Reference: `Screen_Recording_20261114_222140_Local_Music[1].mp4` (204 seconds). Preserve the recording and original design references; local frames and narration analysis remain ignored artifacts.

- **12–30 s, Queue:** remove album/year metadata. Keep artwork, title and artist, with Move up, Move down and Remove inline beside each song (confirmed choice). Preserve ordering and current-track removal restrictions.
- **46–59 s, player menu:** eliminate the unsolicited Go to artist highlight. Touch opening starts visually neutral; pressing highlights only the touched item. Preserve orange keyboard focus, checked states, disabled actions and privacy/removal ordering.
- **60–72 s, Equalizer:** center preset-and-bands content vertically beneath the fixed header. Use normal scrolling when content exceeds available space. Preserve usable bands, live updates, loading and recovery.
- **89–102 s, Visualizer:** replace wrapping individual mode buttons with a cohesive, equal-width segmented row beneath Back. Keep all modes reachable with Spanish labels and enlarged text.
- **112–128 s, swiping:** remove content flicker and lingering pressed backgrounds between Artists, Playlists and Your Recap. Preserve the left-anchored carousel, finger-following whitespace and short snap transition.
- **136–149 s, About:** show “Created by Abraham Jhared Flores Azcona” / “Creado por Abraham Jhared Flores Azcona” in shared About content, including the Windows window (confirmed name).
- **150–184 s, density:** reduce titles only (confirmed). Preserve supporting labels, text scaling and large touch targets.

## Implementation rules

- Reuse React components and theme tokens; no new native commands, storage migration or playback/accounting changes.
- Use a compact Queue row with ellipsized title/artist, compact artwork and three non-overlapping 48-pixel action targets. Keep full accessible names and stable row identity.
- Restrict hover styling to hover-capable pointers. Separate touch press feedback from keyboard focus; clear it on movement, cancellation, scrolling, navigation and backgrounding for song, album, artist and playlist entries.
- Give content transitions one animation owner. Cancel superseded animations and settling callbacks without resetting to outgoing/empty content. A fresh tap immediately after a swipe must work.
- Preserve confirmed catalog content during same-scope refreshes, revision guards, bounded rendering and preloading. Add no artificial loading delays.
- Reduce phone song/card titles from 14 to 13 pixels, page headings from 24 to 22, and dialog headings from 20 to 18. Keep accepted Now Playing title sizing and secondary text.
- Keep short transitions within existing durations, respect Reduce Motion, and preserve single-overlay navigation, Android Back and originating focus.
- Keep generous touch areas despite denser text, following [Android accessibility guidance](https://developer.android.com/guide/topics/ui/accessibility/views/apps-views).

## Verification and acceptance

- Cover Queue editing, touch-menu opening, keyboard focus, drag cancellation, repeated swipes and the first subsequent tap with focused regressions.
- Verify EQ centering/overflow, all Visualizer modes, author credit in Android/Windows About, EN/ES, light/dark/system, Reduce Motion, 320/390/411-pixel layouts, landscape, enlarged text and desktop zoom.
- Compare identical v0.17.0 fixtures: target visual press feedback within 50 ms and cached view presentation within 100 ms, separately from animation completion. Record actual results and investigate regressions.
- Run frontend checks, the complete browser suite, Rust core/native and Kotlin regressions. Build Windows and ARM64 Android; verify versions, signatures, native-library hashes and matching frontend assets.
- Install and inspect the final APK on the Note10+. Capture a fresh paused-state baseline and verify playback, queue, settings and library preservation afterward.
- Record before/after screenshots, measurements and remaining manual/device gates in `docs/verification.md`. Commit the feature for review without integration or release.
