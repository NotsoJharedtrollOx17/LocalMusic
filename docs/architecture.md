# Architecture

React/TypeScript owns presentation and interactions. Native commands bridge to the Rust core and platform audio worker. Browser preview is a separate IndexedDB/Web Audio adapter implementing corresponding contracts; it does not establish native background reliability.

## Ownership

| Subsystem | Authority |
| --- | --- |
| Catalog, organization, search, playlists, Recap | Native Rust Store and music-core domain rules |
| Windows playback | Rust worker, Rodio decoder/mixer, physical or paced silent output |
| Android playback | Media3 foreground service and durable native journal |
| Browser preview | IndexedDB, audio element, worklet and workers |
| Windows window/menu lifecycle | Validated Rust commands and fixed local window labels |
| UI, gestures, focus, loading/error feedback | Shared React controllers and presentation components |

## Catalog and rendering

The catalog index prepares complete visible metadata and group membership at one revision before Library readiness. It omits private source paths and embedded cover payloads. React publishes counts/groups together, coalesces reads and rejects obsolete replies. Collection ordering and filtered actions use stable IDs and original playlist positions.

Rows are virtualized against the phone pane or desktop window; metadata pagination does not limit ready Library scrolling. Overscan is bounded. Separate artwork requests resolve row/card/player variants and share decoded URLs with bounded concurrency/cache accounting. The decoded-art cache budget does not bound process or GPU memory.

Phone navigation retains at most neighboring presentation panes under one controller. Inactive panes are inert and hidden from accessibility. Header, tab strip and mini-player stay outside the moving content track. Stable row anchors restore scrolling. Presentation subscriptions isolate transport progress from Library card rerenders.

## Playback, journals and multiple windows

One native player owns queue and playback time, regardless of open windows. Windows source consumption determines position and eligible history. Android writes checkpoints to its private durable outbox while the WebView is suspended; Rust imports and acknowledges them idempotently. Pauses, buffering and seeked-over intervals never add listening time.

Windows companions mount focused presentation controllers, not a second Library controller. Revisioned snapshots and invalidations synchronize playback, catalog, favorites, playlists, feedback, privacy and sound. Settings changes are field updates against current authoritative values. Child Close dismisses; explicit Return routes back to main. Exactly one visualizer analysis/render lease owns the current session; stale cleanup cannot stop a new owner.

## Audio processing and analysis

Ordinary EQ uses version-two configuration with the retained ten-slot compatibility representation: neutral slot zero, nine editable gains, preamp zero. Atomic migration removes retired personal profiles and preserves ordinary presets/Custom. EQ crossfades coefficient updates and retains channel/limiter behavior.

Visualizer taps post-EQ/limiter PCM without waiting in audio callbacks. Rust/Kotlin/browser workers reduce bounded samples into display frames; Canvas 2D renders imperatively with bounded resolution, adaptive 60/30 fps and stale-generation rejection. Its 2048-point Blackman FFT differs from the source-analysis descriptor below. Samples/frames are transient, and visualizer reads bypass history-bearing snapshots.

Playlist acoustic analysis independently decodes source audio before EQ, only during explicit generation while visible and paused. It stores normalized descriptors, never excerpts. History, metadata, privacy and feedback revisions define the generation snapshot. See [the methodology](personalized-playlists.md).

The [library rules](library-and-playback.md), [Recap contract](recap-methodology.md), [source map](developer-guide.md) and [verification](verification.md) contain operational details. No application account, metadata service or inference model is required.
