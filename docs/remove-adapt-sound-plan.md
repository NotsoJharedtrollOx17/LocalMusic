# Remove Adapt Sound for v0.7.0

Approved 25 October 2026. Branch: `dev.remove-adapt-sound`, created from clean `dev` at `75a8874`. Saved before implementation.

## Equalizer-only interface

- Replace Sound options with Equalizer / Ecualizador in Library and Now Playing; open EQ directly and remove the sound-selection screen.
- Remove Adapt Sound onboarding, profiles, comparison charts, confirmations, translations, styles and exclusive assets.
- Always show the nine editable EQ bands, Normal/Pop/Rock/Jazz/Classical/Custom, automatic Custom saving and live updates.
- Preserve output recovery, loading/error accessibility, zoom reflow and focus restoration with one overlay. Preserve Queue/Heart/Add and the final Exclude from recap / Remove from Library menu order.
- Update current documentation; preserve historical plans/releases, source recordings and reference images.

## Complete processing and interface removal

- Remove calibration protocols, tones, comparisons, setup sessions/leases/timers/workers and profile DSP from browser, Rust and Android.
- Remove MusicApi personalAction, native command/bridge registrations, profile-use actions and personalization-only types/capabilities.
- Keep ordinary output recovery, channels, limiter and live coefficients. Preserve playback/listening sessions and Android's durable journal; remove only calibration-specific session/route handling.

## Migration

- Confirmed choice: delete existing profiles, restore the last ordinary EQ settings, retain no profile backup and never convert stereo profiles into Custom.
- Introduce EQ-only config version 2 at existing storage keys. Read version-one records before validation, preserve gains/preset/Custom and remove all personalization fields.
- Keep ten compatibility slots with index zero neutral, nine visible gains within ±10 dB, enabled EQ and zero preamp. Fresh installs use Normal.
- Ignore malformed retired profile fields when ordinary EQ is valid. Persist atomically/idempotently before processing, reporting persistence errors through existing handling.
- Match migration semantics in TypeScript/Rust/Kotlin. Stale actions or legacy fields must never reactivate personalization.

## Verification and delivery

- Shared fixtures: active/inactive/legacy/malformed profiles, preserved presets and Custom, fresh defaults, repeated migration and no residual boosts/personalization fields.
- Replace calibration-only tests; retain real processing, multichannel, limiter, persistence, seek, history and privacy coverage.
- Update direct EQ navigation/focus tests, EN/ES, player menu ordering, loading/error recovery and mobile/high-zoom checks.
- Audit source, commands and built assets for feature remnants; historical documentation and migration fixtures are intentional exceptions.
- Run frontend checks, complete remaining browser suite, Rust core/native and Kotlin tests. Build Windows and ARM64 Android; verify metadata, signature and packaged native-library hashes.
- Record actual evidence and outstanding device/runtime gates in `docs/verification.md`. Commit on the feature branch for review.

## Release boundary

Target v0.7.0; integration, application version bump, tag and release packaging require a subsequent release request.
