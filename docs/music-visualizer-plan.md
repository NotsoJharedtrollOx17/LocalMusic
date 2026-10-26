# Music visualizers: spectrum, geometry and XMB waves

Approved 26 October 2026. Start `dev.music-visualizers` from clean `dev` at `5409f7d`; commit this plan before implementation. Keep application version 0.8.0. Commit completed work for review; merging/releasing requires a subsequent request.

## Experience

- Deliver Spectrum, Geometry and XMB wave across Windows, Android and browser preview. Open a dedicated view from Now Playing > Visualizer beside Equalizer in the player menu.
- Spectrum is the initial default: rising/falling frequency bars, decay and peak markers. Geometry uses original mirrored ribbons/orbits: bass expansion, mid curvature, restrained treble highlights. XMB adapts the local prototype's mathematical ribbons to orange/charcoal, with audio-controlled amplitude, deformation and travel instead of its unconditional timer.
- Remember mode; never open automatically at startup. Fill app content with Back, mode selection, track/artist, existing seek and Previous/Play-Pause/Next. Controls fade after three idle seconds during playback; pointer/touch/keyboard reveals them; focused controls stay visible.
- Escape/Android Back returns to Now Playing with focus restored and one interactive view. Support EN/ES, portrait/landscape, safe areas, keyboard and zoom. Reduce Motion starts static with an explicit session-only Animate action. Avoid strobing/abrupt full-screen brightness changes.

## Analysis and interfaces

- Tap owned PCM after EQ/limiting in Windows SoundSource, Android Media3 processor and browser AudioWorklet. No microphone/system-capture permission or second decoder. Android system Visualizer otherwise requires recording permission: https://developer.android.com/reference/android/media/audiofx/Visualizer
- Analyze outside callbacks on Rust/Kotlin/Web Workers. Use bounded preallocated buffers and a shared 2048-point FFT specification/fixtures for spectrum normalization, waveform reduction, RMS and onset. Combine channel power without cancelling inverted stereo. Never wait for analysis/IPC/rendering in audio callbacks; discard visual data if busy.
- Analysis <=30 updates/second, presentation interpolated at render rate. Add startVisualizer/readVisualizer/idempotent stopVisualizer and typed capabilities/display frames with generation, sequence, playback position and bounded arrays. One outstanding read; reject stale generations.
- Timestamp windows and select against playback position, not latest decoded data or 250 ms desktop snapshots. Visualizer reads bypass queue persistence, journal import and ordinary snapshot publication.
- Optional visualizerMode preference defaults to Spectrum. Samples/frames remain transient: no recording, recap contribution, exports or network transmission.

## Rendering, lifecycle and targets

- Canvas 2D with imperative drawing, reusable buffers and cached gradients/geometry. React owns UI/lifecycle. No frame-rate React updates, large blurs or heavy rendering frameworks. Reference: https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas
- Effective DPR <=1.5, drawing surface <=2 million pixels; <=64 bars, <=512 geometric segments or two 96-point ribbons with twelve highlights.
- Start at 60 fps. Rolling two seconds: drop to 30 if draw work exceeds budget or misses >5%; lower cap to one million pixels if still needed. Recover only after ten stable seconds.
- Galaxy Note10 physical baseline; record exact variant, Android/WebView versions. Targets: p95 draw submission <8 ms at 60 fps / <16 ms at 30 fps; incremental CPU <15% of one core; local/wired onset difference <=120 ms. Measure Bluetooth/device-output delay separately.
- Stop capture/analysis/rendering when closed/hidden/minimized/backgrounded. Pause/silence settles static. Blur must not close the view/stop music. Renewable three-second native lease cleans up after WebView failure.
- Keep screen awake only while visible and playing: Android window flag, Windows display power request, browser Screen Wake Lock. Release on pause/exit/background; refusal never affects playback. Reference: https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API
- Analysis/render failure leaves playback available with concise Retry; never substitute invented audio activity.

## Verification

- Shared silence/tone/impulse/noise/mono/stereo/inverted/multichannel/sample-rate/EQ fixtures; identical audio with analysis on/off.
- Seeks, track/buffering/output changes, stale frames, workers failing, repeated enter/exit, background/resume and wake cleanup; unchanged listening/exclusion/queue/recap accounting.
- All modes EN/ES, Reduce Motion, keyboard/screen reader, 320 px, short windows and native zoom; focus/reachable controls.
- Profile production builds vs ordinary playback: five minutes per mode, navigation, hidden cleanup and memory stability. Record CPU/frame timing/underruns/sync using browser traces and Android system tracing: https://developer.android.com/topic/performance/tracing
- Frontend checks, complete browser suite, Rust core/native and Kotlin tests; Windows/ARM64 builds and emulator/runtime where available. Record actual evidence in docs/verification.md. Physical Note10 speed/battery/thermal/sync remains pending until measured; browser/build evidence cannot establish it.
