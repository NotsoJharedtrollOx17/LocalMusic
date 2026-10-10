# Architecture

The application has a React/TypeScript frontend and two runtime adapters. In Tauri, commands call the shared Rust core and the platform player. In a browser, a separate preview adapter stores user-selected audio blobs and a playback journal in IndexedDB. The browser preview has no Android background guarantees.

The music-core crate owns SQLite catalog/search, playlists, settings, history import and recap aggregation. Playback snapshots are separate from catalog pages. Lists are fetched in pages of 60; queue and playlist items resolve by stable track ID.

Windows playback runs on a dedicated Rust worker with Rodio. Android playback lives in a Media3 foreground service, controlled through the native-music Tauri plugin. The service persists its queue and writes checkpoints to its own SQLite outbox while the WebView is suspended. Rust imports absolute session totals and intervals idempotently, then acknowledges committed outbox IDs.

The browser preview generates original sample tones only after an explicit user action. Those sessions are excluded from recap. Imported audio is processed locally; app features make no remote requests.

Native audio identities use size and bounded content fingerprints, avoiding full-library hashing during import. A new URI/path for the same fingerprint updates source aliases without changing listening IDs. This is a bounded fingerprint rather than a guaranteed whole-file identity; remasters with different content remain separate.

The four supplied images guide typography, spacing, navigation and orange/charcoal motifs. Original seeded geometry fills missing artwork. The static recap orbit is decorative mathematics; it makes no acoustic or psychological claim.

Setup and validation status are recorded in verification.md. See the approved implementation-plan.md for acceptance gates.

Recap sharing uses one canvas renderer for both the preview and PNG download. The frontend waits for self-hosted fonts, lays out the selected aspect ratio and fits long music names. Live exports flush current listening first; saved snapshots retain their frozen metrics. Privacy revision is checked before preview and again before saving. Native export commands return a saved/canceled boolean, and the Windows save chooser is attached to the main window with a PNG filter.
