# Step 3: Working equalizer and personal sound profiles

Approved 10 October 2026. Implement on `dev.sound-eq-adapt-sound`, created after fast-forwarding `dev` to Step 2. Preserve `main`, `v0.1.0`, reference images and the user's untracked guideline.

## Replace the unavailable screen

Implement application-owned processing on Windows, Android and browser preview. Separate support, saved configuration and runtime status: ready for playback, awaiting activation, active, output unavailable or processing failed. Configuration and preset management work with an empty library or paused playback. Save does not imply audible application. Preserve configuration/queue on output loss, stop tones and offer Retry audio output; resume playback explicitly. Refresh on playback, resume and output changes. System-panel availability must not hide app EQ. Unchanged runtime failures remain inline rather than repeated alerts.

## Equalizer interaction

Ten bands: 31, 62, 125, 250, 500 Hz; 1, 2, 4, 8, 16 kHz. Gains -12 to +12 dB in 0.5 dB steps; preamp -12 to 0 dB. Desktop vertical faders, narrow mobile horizontal labeled sliders. Use an app-styled preset list with orange selection, keyboard/focus support; no native dropdown. Include On/Off, Flat reset, Save/Rename/Delete preset and temporary Bypass all. Built-ins immutable; edits create Custom. Display values immediately, coalesce updates to 50 ms, flush on release, reject stale acknowledgements and roll back failures to the last acknowledged configuration.

Original curves in band order:

| Preset     | Gains in dB             |
| ---------- | ----------------------- |
| Flat       | 0,0,0,0,0,0,0,0,0,0     |
| Pop        | -1,0,1,2,2,1,0,0,1,2    |
| Rock       | 3,2,1,-1,-2,-1,1,2,3,2  |
| Jazz       | 2,1,0,-1,0,1,2,2,1,0    |
| Classical  | 2,1,0,0,-1,0,1,1,2,2    |
| Bass boost | 4,3,2,1,0,0,0,0,0,0     |
| Voice      | -2,-2,-1,0,2,3,2,1,0,-1 |

## DSP and platform ownership

RBJ peaking filters Q=1.4, shared fixtures for Rust/Kotlin/TypeScript. Combine EQ/personal gains per ear. Automatic attenuation uses combined response on 4096 logarithmic frequencies plus 1 dB margin. Stereo-linked limiter: -1 dBFS ceiling, instantaneous attack, 50 ms release; digital clipping control, not hearing protection. Crossfade updates for 20 ms at block boundaries; no blocking control/storage in callbacks. Reset on seek/stream change and preserve playback accounting. Promote mono to stereo; EQ supports multichannel but personal processing does not. Bypass bands at/above Nyquist and expose inactive bands. Both effects off gives true bypass.

Windows wraps Rodio Source, preserving duration/format/seek, and monitors Core Audio endpoint changes. Android service owns focused processing/configuration classes and private persistence independent of the WebView. Media3 1.11.1 custom PCM processor disables float output/offload/passthrough paths that skip processing; document output-path tradeoff. Browser uses one Web Audio context/media-element source and AudioWorklet, resumes on user interaction, and preserves unprocessed playback where possible after initialization failure.

## Personal sound

Original experimental tone-response listening profile inspired by Samsung; no audiogram, diagnosis or proprietary algorithm claim. Require headphones, quiet setting, comfortable device volume and explain that digital amplitude cannot establish sound pressure at the ear. Never change system volume. Pause music preserving queue/position; keep paused on exit with explicit Resume.

Flow: left ear, right ear, comparison, save. Progress, Replay, Stop/Cancel, keyboard/screen-reader paths, Escape and Android Back. Frequencies per ear: 250,500,1000,2000,4000,8000 Hz, beginning with 1000 Hz reference. User-triggered 800 ms pulses including 100 ms fades, one at a time with >=500 ms silence. Start -54 dBFS peak; Not heard advances -48,-42,-36; never exceed ceiling. First-heard level retained; unheard bands unknown/no boost, unheard reference requires retry/cancel. Repeat reference after each ear; >6 dB inconsistency requires ear retest. Relative-to-reference heuristic clamped 0..6 dB, log-frequency interpolation; unknown regions/outside tested range zero. Original-sample comparison at 50% strength with matched loudness; Original/Personal and 0..100% strength. Save does not enable; Use profile explicit. Named profiles support select, toggle, strength, rename/delete/retest. Manual selection; output changes bypass until reconfirmed, unknown outputs never auto-enable.

Backends enforce amplitude, single pulses and session IDs. Native setup uses a renewable two-second foreground lease. Close/hide/blur/interruption/output change/cancel/lease expiry stops tests and invalidates queued requests. Browser output-monitoring limits stated truthfully. Tones/comparison never enter listening history.

## Contracts, storage and compatibility

Typed MusicApi sound configuration/runtime reads/updates, preset/profile CRUD, temporary comparison and session start/pulse/respond/cancel/save. Versioned configuration with fixed gains/preamp/preset identity/personal curves/strength/selection. Windows SQLite; Android service private preferences; browser existing IndexedDB settings. Fresh installs effects off/Flat. One-time Android migration samples actual legacy EQ into custom curve when available; otherwise preserve legacy data/start bypassed/explain new selection. Persist derived curves/completeness, discard raw tone responses after save/cancel. No personalization in recap export. Retain resolvable system-effects panels without Samsung deep-link/private-profile guarantees. One component per TSX; focused Rust/Kotlin modules.

## Verification

Implement contracts/DSP, Windows, Android, browser, EQ UI, personalization. Run frontend/browser/Rust/Kotlin checks. Cover empty/stopped/paused/missing-device/suspended-context/failure/retry/active states; response/bypass/limiter/channel isolation/mono/multichannel/Nyquist/seek/live edit/parity; persistence/migration/stale requests/cancellation/unknown/reference inconsistency/route change/no tone history. Check desktop/mobile, en/es, dark, zoom, long names, keyboard/focus/screen readers/Back/Reduce Motion. Build Windows and signed ARM64 APK; record actual observations in `docs/verification.md`. Android runtime pending usable target; physical headphones required before tone flow release-ready and performance claims require measurements.

Defaults: global EQ, manually selected profiles; no per-track/age-based/clinical/proprietary effects or visual overhaul.

## Implementation decisions

- Implementation is on `dev.sound-eq-adapt-sound`, after fast-forwarding `dev` to Step 2 at `da37dc7`. `main` and `v0.1.0` remain unchanged.
- Profile activation is an explicit backend `profile-use` action with output-generation confirmation. Startup and output changes disable personalization; a configuration write cannot silently enable it.
- Retest replaces the selected profile only after Save; cancellation preserves it. Saving stores the chosen strength, leaves personalization off and discards raw responses.
- Temporary Bypass all clears when the sound surface closes, including late acknowledgements after unmount.
- Android uses software PCM16 output with double precision processing. Float output, offload and encoded passthrough are disabled. The device panel remains a separate capability. Power/latency impact is unmeasured.
- Automatic headroom adds 1 dB margin to positive combined-response peaks. Flat/unboosted banks use zero automatic attenuation. The peak limiter remains active when effects are on; both effects off is true bypass.
- Actual checks and unresolved native/physical-headphone gates are recorded in [verification](verification.md).

## References

- [Apple iTunes EQ](https://support.apple.com/en-au/guide/itunes/itns2991/windows)
- [Samsung Music](https://www.samsung.com/uk/support/mobile-devices/samsung-music-app/)
- [Samsung Adapt Sound](https://www.samsung.com/latin_en/support/mobile-devices/how-to-customize-the-adapt-sound/)
- [RBJ coefficient equations](https://www.w3.org/TR/audio-eq-cookbook/)
- [Media3 audio sink](https://developer.android.com/reference/androidx/media3/exoplayer/audio/DefaultAudioSink.Builder)
- [Rodio 0.22.2](https://docs.rs/rodio/0.22.2/rodio/source/trait.Source.html)
- [Core Audio events](https://learn.microsoft.com/en-us/windows/win32/coreaudio/device-events)
- [Web Audio](https://www.w3.org/TR/webaudio/)
- [WHO safe listening](https://www.who.int/news-room/questions-and-answers/item/deafness-and-hearing-loss-safe-listening)

## EQ refinement - 10 October 2026

The user's refinement supersedes the original preamp bounds: preamp is independently adjustable from -12 to +12 dB in 0.5 dB steps, with Reset preamp returning to 0.0 dB. Preset selection and Reset to Flat modify EQ bands only, preserving preamp. Preamp edits no longer change the selected EQ preset. Legacy preset preamp fields remain readable for compatibility but are ignored on selection. Treble boost uses the original curve 0,0,0,0,0,0,1,2,3,4. Automatic response-based headroom and the peak limiter remain separate from manual preamp; this change does not promise loudness-normalized presets.

## Personal setup interaction refinement - 10 October 2026

A Not heard response triggers the next bounded pulse after the mandatory silence gap. The response click is the user trigger; limits and scheduling remain backend-enforced. At the ceiling, a non-reference frequency is recorded as unknown and advances without a guessed boost. An unheard reference still requires retry because a relative curve needs a baseline. The UI displays level/progress, blocks duplicate manual replay while a response-triggered pulse is queued, explains interruption and offers Restart with renewed headphone confirmation. Cancel, blur and unmount clear queued pulses; obsolete action/heartbeat responses cannot overwrite a restarted setup. No incomplete profile is saved or applied.
