# First draft: Local Music + Your Year

Approved 7 October 2026. License: MIT. Android is the primary target; Windows is the development desktop. Full offline MVP. Explicit playlist filters. Acceptance for this draft uses desktop and emulator evidence; physical-device playback and performance remain release gates.

## Build sequence

1. Preserve the original guide and reference images. Scaffold React/TypeScript/Vite, Tauri 2, Rust and Android in the repository root. Pin dependencies and add reproducible setup, run, test and build instructions.
2. Prove native playback and crash-tolerant history before visual polish. Media3 owns Android playback, queue and checkpoints independently of the WebView. Kotlin stores a durable pending journal; Rust imports it idempotently into SQLite. Desktop uses the same Rust catalog, history, playlist and recap rules.
3. Complete import, metadata, artwork, library/search, manual playlists, persistent queue, favorites, history controls and English/Spanish UI. Android uses MediaStore and selected-folder grants; desktop imports folders.
4. Implement the four reference journeys in an original responsive interface: Library, Now Playing, Playlists and Your Year. Missing covers use deterministic cached geometric artwork. Playlist generation exposes filters and works offline.
5. Compute recap using actual playing intervals, 30-second qualified plays, local year boundaries and exclusions. Display true coverage. Save frozen snapshots and playable recap playlists. Export privacy-safe JSON and 1080×1920 PNG offline.
6. Verify desktop and emulator workflows, produce APK artifacts and record actual evidence. Physical-device reliability, battery and latency remain pending.

## Contracts and ownership

React consumes typed commands and native playback snapshots. Rust owns catalog, identity, playlist policies and recap aggregation. Native players own elapsed playback time and queues. Journal messages use stable session IDs and sequence numbers; duplicate imports cannot add time twice. SQLite stores source aliases, favorites, settings, queue, playlists, intervals and frozen snapshots.

## Acceptance

- Working builds; no fabricated annual history or fake playback.
- Meaningful fixtures for pause, seek, buffering, journal replay, moved files, DST/year boundaries, exclusions, playlist constraints and export privacy.
- Complete Windows and Android emulator journey, including 30 minutes background playback and reopening.
- English/Spanish, text scaling, screen-reader labels, reduced motion and usable empty/error states.
- Offline JSON and portrait PNG; no source paths or exact timestamps in exports.
- README setup commands, architecture, methodology, third-party notices and evidence log.
- Emulator results are exploratory; no physical-device or performance claim without measurements.

## Reference boundary

The original .AGENTS guide and its four images remain design inputs. Natural-language playlist interpretation, enrichment, model downloads and animated symmetry are later features. Follow official Tauri mobile-plugin, Android Media3 and scoped-storage documentation.

## Device calendar revision — 10 October 2026

Live recap boundaries follow the device's time zone automatically, replacing older manual choices on startup and resynchronizing after resume or a visible periodic check. Persist the detected IANA identifier for both adapters' existing calendar rules. Frozen recap snapshots retain their original zone and coverage. Settings shows a compact read-only device calendar summary; Language and Appearance use inline choices without dropdown overlays.

## Recap export revision — 9 October 2026

The user requested an image-focused functional recap and removal of JSON export buttons. The current export target supersedes the original JSON/1080×1920 UI requirement: provide a matching preview and PNG download at 2160×3840 for Story or 2160×2700 for Feed, using the supplied editorial/orbit design language. Retain honest coverage, privacy revision checks, immutable snapshots and playable recap queues. Native save cancellation must not report a successful export.

## Playlist navigation revision — 9 October 2026

Move Playlists into the Library tab row alongside Songs, Albums and Artists, as requested for a Samsung Music-style flow. Library and Your Year remain the main navigation entries. Keep playlist creation, explicit-filter generation, editing, manual selection and playback in the Library’s Playlists subtab.

## Current state after integration — 9 October 2026

The recap export, loading/startup and playlist navigation revisions above are integrated into `dev`. The original build sequence and acceptance list remain a record of the initial draft; the JSON and 1080 × 1920 export targets are superseded by the recap export revision. See [README](../README.md) for the current feature set, [developer guide](developer-guide.md) for code ownership, and [verification](verification.md) for actual checks and remaining Android acceptance gates.
