# Music visualizers: implementation and acceptance

The archived [approved plan](music-visualizer-plan.md) defines the scope. This branch keeps version 0.8.0 and requires review before integration or release.

## Ownership and data flow

| Platform | Read-only tap | Analysis | Display transport |
| --- | --- | --- | --- |
| Windows | `SoundSource`, after EQ and linked limiter | Rust worker; atomic sample ring | Dedicated Tauri start/read/stop commands |
| Android | `SoundAudioProcessor`, after final PCM16 conversion | Kotlin worker; atomic sample ring | Dedicated native plugin commands through Tauri |
| Browser preview | Existing audio processor, after EQ and limiter | Web Worker | Three recycled stereo buffers through a direct MessageChannel |

React owns the dedicated view, controls and lifecycle. Canvas 2D draws imperatively; analysis frames never enter React state. No microphone, system loopback, downloaded model, network endpoint, recording, export or new listening session is involved. Analysis failure affects the view only. The browser worklet guards visual transport errors separately from ordinary DSP.

`startVisualizer` returns an opaque session ID and typed capabilities. `readVisualizer` renews the three-second lease and returns a bounded display frame or null. `stopVisualizer` is idempotent; stopping an old session cannot stop a newer session. The view keeps one read outstanding and discards responses from retired sessions, older transport generations and repeated sequences.

Windows obtains `Player.get_pos()` through a read-only playback-worker request. This request bypasses queue persistence and ordinary snapshot publication; the existing maintenance/checkpoint cadence continues separately. Android reads Media3 position on its application thread without calling the journal-bearing snapshot path. Browser selection uses the existing media element clock. None of these reads flushes or imports listening journals.

## Shared analysis contract

- 2,048 samples per channel, Blackman window, radix-two FFT, 64 logarithmic bands from 40 Hz through min(20 kHz, Nyquist).
- Bin power is averaged across the two analysis channels before amplitude conversion. Phase-inverted stereo therefore retains its energy. Mono is duplicated. For multichannel content, each frame retains the strongest even/odd channel on its respective analysis side; this bounded visual fold is not a surround downmix and never changes playback.
- Amplitude normalization uses `2 * sqrt(power) / (2048 * 0.42)`; -72 through 0 dB maps to 0 through 1. Band values use the maximum bin within their inclusive frequency range.
- RMS uses both unwindowed channels. Onset is `clamp(8 * (rms - precedingRms), 0, 1)`. Waveform reduction retains 128 min/max pairs from the higher-energy channel.
- Native workers run at most once every 34 ms. Browser output is limited to 30 updates/second; PCM block cadence may produce fewer updates. Rendering smooths these values independently.
- Native rings hold 131,072 stereo analysis frames, positions and generation/publication stamps. Readers reject overwritten or mixed-generation windows. Audio writers never acquire the frame mutex or wait on the worker.
- Window positions represent their center. Native workers select samples against the actual playback clock, rather than displaying the decoder's latest lookahead. Seeks, track/format changes and processor flushes invalidate old generations. Frames outside the bounded clock tolerance are rejected.

`tests/fixtures/visualizer-analysis.json` contains independent NumPy reference values for silence, bass/treble tones, one-sided and inverted stereo, impulses, deterministic noise and 44.1/48/96 kHz input. TypeScript, Rust and Kotlin consume the same fixtures. Separate processing tests cover EQ response, multichannel capture, buffer exhaustion and unchanged audio output.

## Scenes and lifecycle

Spectrum is the first default. Geometry uses original mirrored paths; XMB uses the local prototype's traveling-wave mathematics in the app palette. Neither mode uses an independent decorative timer. Motion stops with silence; paused scenes settle. Surface bounds are DPR 1.5 and two million pixels, with a one-million-pixel fallback. Scenes are bounded to 64 bars, 512 geometry segments, or two 96-point ribbons plus twelve highlights. Gradients and analysis workspaces are reused.

Over a two-second window, expensive drawing or more than 5% missed frame opportunities lowers 60 fps to 30 fps, then reduces surface resolution. Recovery requires ten stable seconds. These are controls on workload, not a guarantee of physical-device performance.

The view returns to its parent player and restores focus on Back/Escape. Pointer, touch and keyboard reveal controls; focused controls remain visible. Reduce Motion starts with static art and offers a session-only Animate action. Closing, hiding, minimizing or backgrounding stops capture, workers and animation; ordinary blur does not stop music or close the view. Native leases also clean up if the WebView stops renewing. Screen-awake requests are limited to visible playback and released on pause/exit/background. Wake refusal does not affect music.

## Evidence and remaining device work

Actual results belong in [verification.md](verification.md). Desktop browser timing and APK/native-library verification are separate from Android runtime acceptance.

For the Galaxy Note10 acceptance run, record the exact model/SoC variant, Android version, WebView version, display resolution/refresh rate, power mode, output route and ambient conditions. Compare ordinary playback with five minutes per mode using Android system tracing; report p95 draw submission, incremental CPU in units of one core, memory trend, audio underruns, temperature and battery behavior. Measure local/wired onset difference, device-output delay and Bluetooth delay separately. Targets remain p95 below 8 ms at 60 fps or 16 ms at 30 fps, incremental CPU below 15% of one core, and local/wired onset difference within 120 ms.

Reference APIs: [Canvas optimization](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas), [Media3 AudioProcessor](https://developer.android.com/reference/androidx/media3/common/audio/AudioProcessor), [Screen Wake Lock](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API), and [Android system tracing](https://developer.android.com/topic/performance/tracing).
