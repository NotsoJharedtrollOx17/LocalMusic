# Developer guide

This is the current code map for work based on `dev`. Read [AGENTS.md](../AGENTS.md), the [implementation plan](implementation-plan.md) and the original `.AGENTS` guide before substantial changes. The implementation plan records historical targets; its dated revisions and this guide describe the current product. Preserve the four reference images.

## Ownership and entry points

| Area | Source | Responsibility |
| --- | --- | --- |
| React shell and Library/Playlists/Your Year flows | `src/App.tsx`, `src/TrackList.tsx`, `src/components.tsx`, `src/styles.css` | Presentation, interactions, request state and accessible loading/empty states |
| Shared frontend contract | `src/types.ts`, `src/api/index.ts` | `MusicApi` types, Tauri command adapter and playback subscription |
| Browser preview | `src/api/browser.ts` | IndexedDB catalog/journal, HTML audio playback and local import |
| Recap image | `src/ShareRecap.tsx`, `src/export.ts` | Story/Feed preview, canvas rendering, privacy check and save feedback |
| Startup, theme and language | `src/main.tsx`, `src/theme.ts`, `src/i18n.ts` | Preference hydration, theme application and UI strings |
| Native command boundary | `src-tauri/src/lib.rs` | Tauri commands, import progress, desktop save dialog and platform dispatch |
| Native import/artwork/playback | `src-tauri/src/catalog.rs`, `src-tauri/src/artwork.rs`, `src-tauri/src/desktop.rs`, `src-tauri/src/album_order.rs` | Metadata, cached cover variants, Windows worker and legacy tag backfill |
| Shared native domain | `crates/music-core/src/` | SQLite store, catalog queries, group order, playlist rules and recap aggregation |
| Android integration | `src-tauri/plugins/native-music/` | MediaStore/document access, Media3 foreground service and durable pending journal |

The frontend detects Tauri in `src/api/index.ts` and chooses `NativeMusic` or `BrowserMusic`. New cross-platform operations should extend `MusicApi`, implement both adapters, then add or update the Tauri command and native domain behavior. Browser tests validate the preview adapter; Rust tests validate native rules. One adapter is not evidence for the other's runtime behavior.

## Data paths and invariants

- **Import:** Native imports resolve file or granted-URI metadata, reconcile stable identities and aliases, then publish `catalog://progress`. React refreshes catalog views as processed counts advance. The browser adapter has its own IndexedDB import. Start progress after the user selects a source; cancellation must leave the Library usable. Refresh Album and Artist caches independently and guard late responses by request version.
- **Ordering:** Persist `discNumber`, `trackNumber` and `releaseYear` when tags exist. Native `groups.rs`/`catalog_query.rs` and the browser adapter determine group IDs and ordering. React must retain that order in detail rows and playback IDs. Missing disc means disc one; unnumbered songs follow numbered ones with a stable fallback. Manual playlists and reordered queues retain their own explicit order. Legacy metadata backfill keeps track IDs, favorites and history stable.
- **Artwork:** Native catalog rows use a small cached variant, while cards/detail/player/recap can request larger variants. Preserve the currently displayed image until a larger one decodes. Low resolution embedded source art cannot be made intrinsically sharp. Missing art uses a stable design for a named album.
- **Playback and history:** The player owns the playback clock and queue. Android Media3 persists pending journal intervals while the WebView is suspended; Rust imports and acknowledges them idempotently. Paused, buffering and seeked-over time never count. Keep the browser preview's sample audio excluded from recap.
- **Recap and export:** Rust owns native aggregation and playlist selection; the browser adapter mirrors those rules for preview. Consult [recap methodology](recap-methodology.md) before changing time accounting. A snapshot is frozen; export rechecks its privacy revision. The user-facing PNG includes display data and coverage only, never source paths, exact timestamps, device IDs or private sessions. The preview and download must use the same rendered blob.
- **Startup and Library state:** Load saved settings before mounting the shell, apply the theme to the document early, and reveal the Windows window only after the themed shell commits. Each Library group tab owns its cache, request version, loading and error state. Show a loading placeholder during a first read, and show an empty message only after a completed empty result.

## Implementing a feature

1. Branch from `dev`. Inspect the relevant `MusicApi` method, React call site, Rust command/domain path, browser adapter and existing tests before editing.
2. Put UI behavior and loading/error feedback in React; put persistent catalog, playlist and recap rules in the Rust core. Keep Android background playback and its journal in the native plugin.
3. Extend types and both adapters when adding an operation. Preserve data migration and idempotency when changing stored fields or journal records. Update English and Spanish strings and keyboard/screen-reader states for new controls.
4. Test the affected rule at its owner and run the relevant end-to-end journey. On PowerShell: `npm.cmd run check`, `. ./scripts/env.ps1` then `npm.cmd run test:core`, and `npm.cmd run test:browser` when UI behavior changes. Use `npm.cmd run doctor` to inspect native prerequisites.
5. Record actual results and remaining native acceptance work in [verification.md](verification.md). Android runtime acceptance requires a booted emulator; background reliability and performance require separately measured device evidence. Keep artifacts and `.tools/` out of Git.

## Current boundaries

The browser preview, desktop startup checks and a built/signed ARM64 debug APK are recorded in the verification log. Android runtime acceptance has not completed on a connected emulator or phone; the x86_64 APK is older than the latest UI changes. Semantic playlist interpretation, online enrichment and model downloads remain deferred. Treat the original plan's JSON export and 1080 × 1920 card targets as superseded by its dated recap export revision.
