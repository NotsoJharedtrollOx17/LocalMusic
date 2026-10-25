# Architecture

The application has a React/TypeScript frontend and two runtime adapters. In Tauri, commands call the shared Rust core and the platform player. In a browser, a separate preview adapter stores user-selected audio blobs and a playback journal in IndexedDB and plays through an HTML audio element. The browser preview has no Android background guarantees.

The music-core crate owns SQLite catalog/search, playlists, settings, history import and recap aggregation. Playback snapshots are separate from catalog pages. Lists are fetched in pages of 60; queue and playlist items resolve by stable track ID. The React Library contains Songs, Albums, Artists and Playlists tabs; Your Year is the other primary navigation destination.

Windows playback runs on a dedicated Rust worker with Rodio. Android playback lives in a Media3 foreground service, controlled through the native-music Tauri plugin. The service persists its queue and writes checkpoints to its own SQLite outbox while the WebView is suspended. Rust imports absolute session totals and intervals idempotently, then acknowledges committed outbox IDs.

The browser preview generates original sample tones only after an explicit user action. Those sessions are excluded from recap. Imported audio is processed locally; app features make no remote requests.

Native audio identities use size and bounded content fingerprints, avoiding full-library hashing during import. A new URI/path for the same fingerprint updates source aliases without changing listening IDs. This is a bounded fingerprint rather than a guaranteed whole-file identity; remasters with different content remain separate.

The four supplied images guide typography, spacing, navigation and orange/charcoal motifs. Original seeded geometry fills missing artwork. The static recap orbit is decorative mathematics; it makes no acoustic or psychological claim.

Setup and validation status are recorded in [verification.md](verification.md). The [developer guide](developer-guide.md) maps the current code and change workflow; the [implementation plan](implementation-plan.md) preserves the original acceptance gates and approved revisions.

Recap sharing uses one canvas renderer for both the preview and PNG download. The frontend waits for self-hosted fonts, lays out the selected aspect ratio and fits long music names. Live exports flush current listening first; saved snapshots retain their frozen metrics. Privacy revision is checked before preview and again before saving. Native export commands return a saved/canceled boolean, and the Windows save chooser is attached to the main window with a PNG filter.

Startup reads persisted preferences before mounting React. A validated local theme hint sets the HTML background before module loading; actual settings replace the hint. On desktop the native window remains hidden until React commits the themed shell, then its WebView background is matched and the window revealed. Android retains its normal window lifecycle. Library group pages keep independent Album/Artist data, request versions and loading/error states; pending reads never borrow another tab’s cards or report empty results.

`App.tsx` now composes one-component view files under `src/app/`. A typed context connects those views to the coordinator and its state/read/action hooks. Shared controls live under `src/components/`; motion, gestures and overlay focus live under `src/ux/`. Rendering does not own the playback clock. Player and queue reuse one surface and transport footer; Escape and native Android Back consume the newest interaction layer. Search retains the compact player and its previous navigation state.

Catalog removal is visibility, with a separate SQLite table and a backwards-compatible browser flag. Source audio, source aliases, listening sessions, snapshots and playlist membership are retained. Browse/search/generation and new recap playback exclude hidden IDs; recap history retains its evidence. Reimport or Undo restores visibility.

Android sound processing and private preferences belong to the Media3 service. Sharing grants temporary access to selected content URIs through the OS chooser. Desktop sharing saves source copies and browser sharing uses capability checks; outcomes distinguish opening a chooser from saving or cancellation.

The native Rust shell is split into an entry point (`lib.rs`), shared startup state (`state.rs`), feature command modules (`commands/`) and a playback bridge (`playback/`). The bridge dispatches to the desktop worker or Android service, and its Android module imports the pending journal before acknowledging committed IDs. IPC names and serialized contracts remain independent of Rust module paths. `music-core` owns domain persistence and rules; the shell owns platform integration.

## Sound processing

React owns the nine-band Equalizer under `src/sound/`, with immediate slider drafts, serialized configuration updates and inline runtime/error status. Library and player menus open it directly. The app-scoped controller retains pending edits across dialog transitions; closing returns to the opener.

Windows wraps Rodio sources with `sound/source.rs`; `sound/engine.rs` prepares coefficient banks outside the callback. Core Audio notifications and stream errors signal output changes. The worker preserves the queue and accurate listening checkpoints; Retry recreates output without automatically starting music.

Android uses `SoundEngine`, `SoundAudioProcessor`, `SoundDsp` and Media3's renderer/sink pair. Software PCM16 output, internal double precision, disabled float/offload/passthrough paths and the durable playback journal remain. Battery and latency implications require separate measurements. Browser uses a media-element source and AudioWorklet graph, with truthful activation/output errors and unprocessed fallback after processor failure.

All adapters apply the ordinary EQ to both channel banks, retaining existing mono/multichannel handling, RBJ peaking filters (Q=1.4), a 20 ms configuration crossfade and linked peak limiter. Music has no automatic global attenuation; manual preamp remains zero. The limiter controls digital peaks, not hearing safety.

EQ-only configuration version 2 uses the existing `sound-v1` storage key in Windows SQLite, Android private preferences and browser IndexedDB. Ten compatibility slots remain: neutral hidden 31 Hz followed by nine editable bands. Version-one migration reads only ordinary settings and discards retired profile fields, even if malformed. Ordinary preset/Custom state is preserved; fresh installs use Normal. Atomic persistence precedes processing; write failures expose retryable errors and keep EQ processing inactive. Repeated migration is idempotent. There are no calibration commands, tone/sample players, profile workers or per-ear processing paths. Historical feature plans and release notes remain archival references.
