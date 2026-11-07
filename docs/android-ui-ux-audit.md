# Android UI/UX audit and corrections

Requested 7 November 2026, continuing `dev.ui-ux-stress-audit` after `813829a`. Keep version 0.15.0; commit fixes for review without a release integration.

## Physical baseline

- Samsung Galaxy Note10+, SM-N975F, Android 12 / API 31.
- Android System WebView 155.0.8059.43; actual portrait WebView approximately 411 × 868 CSS pixels, DPR 2.625.
- ADB is authorized. Use app-scoped WebView inspection and native input/screenshot commands. Preserve existing music, source files and history; use generated test audio for controlled checks. Do not clear app data or uninstall to resolve failures.

## Confirmed issues and implementation direction

1. Settings is a bottom-aligned floating card: measured x=14, y≈203, width≈383 and height≈652 CSS px. This leaves a large gap above a task screen. Present task dialogs as full-screen phone views with a fixed header, safe-area spacing and an independently scrolling body. Check Settings, Equalizer, manual playlists, details, organization and Recap/export. Keep desktop dialog sizing usable. Compact confirmations and anchored action menus need appropriate bounded geometry rather than arbitrary oversized surfaces.
2. Library swiping translates the whole panel up to 35 px, resets it at release, then animates new content from the opposite side. Remove this recoil. Recognize horizontal intent without moving the entire Library; commit one tab change with a short non-directional transition. Preserve ordinary vertical scrolling, nested horizontal scrollers, controls, tap suppression, pinch behavior, keyboard navigation and Reduce Motion.
3. Inspect other phone-only failures during actual use: viewport/keyboard resize, real system Back, nested overlays, focus, action-menu bounds, portrait/landscape, player/Queue and visualizer interactions. Fix reproduced defects and distinguish them from untested hardware/performance gates.

## Verification

- Capture before/after screenshots and actual WebView geometry; trace swipe transforms on the device.
- Exercise real native taps/swipes/Back and the soft keyboard, not only synthetic DOM events. Use controlled app data; record any playback/history evidence separately.
- Add focused browser regressions for fullscreen/keyboard-safe layouts and gesture intent/cancellation. Run frontend checks and affected browser journeys, build the ARM64 APK, verify signature/native-library/frontend identity, install as an update and repeat on the phone.
- Record observed results and remaining acceptance gates here and in `docs/verification.md`. Android runtime observations do not establish physical headphone/audio quality, sustained performance, thermal/battery or TalkBack acceptance.

## Results

Pending implementation and device verification.
