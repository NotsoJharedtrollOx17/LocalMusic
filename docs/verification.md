# Verification and release acceptance

This is the current acceptance record, not a promise that every target has passed. Historical chronological records are preserved at [the v0.20.0 integration](https://github.com/NotsoJharedtrollOx17/LocalMusic/blob/5b6b443/docs/verification.md).

## Established v0.20.0 baseline

| Evidence | Recorded outcome |
| --- | --- |
| Frontend | Production build and 115 unit tests passed |
| Feature browser run | 218/220 initially; stale-version assertion corrected and both failed cases passed on focused rerun; final export/layout cases passed separately |
| Rust/Kotlin | 34 core, 34 native and 17 Kotlin cases passed during feature verification |
| Windows | Actual v0.20.0 runtime loaded 160 tracks paused; portable package built |
| Android | Note10+ SM-N975F, Android 12/WebView 157: v0.19.0 feature builds installed; final badge appearance and 711-track paused baseline preserved |
| Release APK | v0.20.0/code 20000 debug-signed package verified; that version bump was not installed on the phone |

## v1.0.0 preparation

The initial hosted pipeline failed browser checks and Android SDK setup; Windows tests passed. Authenticated logs identify a retired `tools` SDK package request and browser fixture/settling failures. Corrections and fresh hosted results will be recorded here before v1.0.0 publication.

Pending gates: current full browser/hosted CI, optimized signed release packages, permanent-key custody, private phone backup review and clean release installation, release-profile native smoke/background checks, optimization measurements and remote publication. Manual screen-reader, broader-device, sustained battery/thermal and controlled latency acceptance remain separate from ordinary smoke checks.

Private profiles, screenshots, keys, mappings and raw device recordings are not public release assets. [Testing](testing.md) defines the acceptance boundaries; [release notes](releases/v0.20.0.md) retain previous versions' scope.
