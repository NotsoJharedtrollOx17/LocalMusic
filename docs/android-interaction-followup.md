# Android interaction follow-up

Continue `dev.ui-ux-stress-audit` from `2ef546e`, keeping version 0.15.0. Archive and commit this scope before implementation. No merge/release is included.

## Requested corrections

- Remove the mini-player X and its temporary hidden state. Keep a Samsung-style bottom player persistent across Library tabs and scrolling, with an opaque dock covering content beneath its rounded edges, progress line and system-navigation inset. Playback and queue ownership stay unchanged.
- Audit swipes across populated rows, empty collections, unused viewport space, margins and toolbar space. Preserve vertical scrolling, tab-strip scrolling, nested horizontal controls, editing, sliders, dialogs and multi-touch. Avoid elastic panel movement, accidental taps, unwanted track playback and stale gestures after cancellation.
- Remove unusable EQ bands from the mobile presentation, distributing available bands evenly and adapting the frequency guide. Preserve original band indexes, saved gains/presets and DSP behavior; desktop may retain its full disabled-band view. Correct preset-selector sizing, contrast, arrow and focus alignment while preserving the native option chooser.
- Prevent Favorites/count/search labels from colliding with actions in English/Spanish, narrow windows and the phone's existing 130% font scale. Keep real filtered counts, accessible announcements and a clear route back to All music.
- Remove the Albums/Artists loading-grid flash when empty, including revisits. Use one delayed compact loading indication, retain confirmed content during refresh, reject stale reads and preserve errors/retry and pagination.
- Match New playlist to the compact Import/action style rather than the oversized full-width phone button. Preserve manual creation, keyboard/IME reachability and persistence recovery.

## Verification

- Capture app-scoped before/after evidence on the connected Note10+, retaining preferences, files, queue and paused playback. Use only existing quiet fixtures for any necessary playback test and exclude test playback from recap.
- Add browser regressions for swipe coverage/cancellation and nested ownership; empty/delayed/repeated group reads; Favorites/search/action reflow; compact playlist creation; persistent opaque player; and adaptive EQ with preset round trips and sample-rate changes.
- Run frontend checks and the complete browser suite against frozen assets. Run relevant Rust/Kotlin gates, build Windows/ARM64 Android, verify signatures/embedded assets/native-library hashes, and install in place for native touch/Back/rotation inspection.
- Record actual results and remaining physical/background/performance/accessibility acceptance in `docs/verification.md`. Keep recordings, screenshots, raw logs and tools outside Git. A-Z remains deferred.

## Implemented behavior

- The mini-player has no dismissal state or X. A full-width opaque dock remains above scrolling Library content and fills the bottom system inset. The inner player keeps rounded corners and its three transport controls. Dock reservation matches its actual height, eliminating an unnecessary scroll strip on empty screens.
- Library gestures belong to the content shell, including unused viewport space, the brand header and explicit touch regions in both outer margins. The tab strip retains native horizontal scrolling. Phone tab changes do not fade the whole page; tab centering scrolls horizontally without moving the document. Android player-header dismissal records the gesture without stretching the surface. Editing, nested controls and dialogs keep ownership of their gestures. Entering or leaving selection/dialogs clears unfinished gestures so the first subsequent menu tap remains usable; multi-touch cancels navigation.
- Favorites uses a small label above its count on phones. Toolbar actions fit beside it, with a second row when an active search leaves insufficient width. New playlist uses the same compact styling as Import. English/Spanish and enlarged text have layout regressions.
- Albums/Artists use one loading indicator after 180 ms rather than an eight-card placeholder grid. Confirmed empty/populated content survives background refreshes. Existing request versions continue rejecting obsolete responses.
- Mobile EQ hides unsupported sliders and redistributes the remaining bands. Its frequency guide follows the available range. Original gain indexes, presets, stored Custom values and audio processing remain unchanged; desktop retains its disabled-band presentation. The preset field uses one aligned chevron and keeps the native options chooser.

See `docs/verification.md` for actual browser/build/native-device results and acceptance limits. Earlier X behavior and loading-grid screenshots remain historical evidence.
