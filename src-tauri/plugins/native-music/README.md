# Native music bridge

Internal Tauri plugin for this application. Kotlin Media3 owns Android playback, queue persistence, audio focus and the foreground media session. PlaybackJournal writes ordered absolute session totals and actual-time intervals to a SQLite outbox without depending on the WebView. Rust imports and acknowledges those records.

Commands are called internally from Rust, rather than exposed as a separate frontend API. Library import uses MediaStore or persistent document grants and returns a temporary JSONL manifest. Embedded covers are cached at 64 and 512 pixels and can be regenerated after eviction. Exports use Android's document chooser.

See the root docs/architecture.md, docs/recap-methodology.md and docs/verification.md for evidence boundaries and outstanding device checks.
