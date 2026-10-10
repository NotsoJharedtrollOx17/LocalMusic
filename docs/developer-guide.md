# Developer guide

This is the current code map for work based on `dev`. Read [AGENTS.md](../AGENTS.md), the [implementation plan](implementation-plan.md) and the original `.AGENTS` guide before substantial changes. The implementation plan records historical targets; its dated revisions and this guide describe the current product. Preserve the four reference images.

## Ownership and entry points

| Area | Source | Responsibility |
| --- | --- | --- |
| React composition | `src/App.tsx`, `src/app/MusicAppContext.ts` | Assemble independently named views using the typed app model |
| State, reads and commands | `src/app/useAppState.ts`, `src/app/useMusicApp.ts`, `src/app/useCatalogReads.ts`, `src/app/useMusicActions.ts` | Coordinate state, guard asynchronous catalog reads, handle import and playlist actions |
| Feature views | `src/app/*.tsx` | One component per file: Library, playlists, recap, navigation, player, selection and individual dialogs |
| Shared controls | `src/components/*.tsx`, `src/TrackList.tsx` | Cover, TrackRow, Modal, IconButton, OrbitPoster and virtualized rows; `index.ts` is a barrel, `format.ts` holds time formatting |
| Motion and overlays | `src/ux/`, `src/navigation.ts`, `src/ux.css` | Player/search/menu surfaces, gestures, focus restoration, Reduced Motion and the Android Back layer stack |
| Shared frontend contract | `src/types.ts`, `src/api/index.ts` | `MusicApi` types, Tauri command adapter and playback subscription |
| Browser preview | `src/api/browser.ts` | IndexedDB catalog/journal, HTML audio playback and local import |
| Recap image | `src/ShareRecap.tsx`, `src/export.ts` | Story/Feed preview, canvas rendering, privacy check and save feedback |
| Startup, theme and language | `src/main.tsx`, `src/theme.ts`, `src/i18n.ts` | Preference hydration, theme application and UI strings |
| Native entry and state | `src-tauri/src/lib.rs`, `src-tauri/src/state.rs` | Register platform plugins and command paths; initialize the catalog, shared state and player |
| Native WebView policy | `src-tauri/src/webview_policy.rs`, `src/ux/nativeShortcuts.ts` | Suppress default Windows menus/devtools and selectively intercept reload/inspector shortcuts, preserving editing and zoom |
| Native command boundary | `src-tauri/src/commands/` | Catalog, imports, playback, playlists, recap, settings, sharing, sound and window handlers |
| Native playback bridge | `src-tauri/src/playback/mod.rs`, `src-tauri/src/playback/desktop.rs`, `src-tauri/src/playback/android.rs` | Dispatch operations to the Windows worker or Media3; import and acknowledge the Android journal |
| Native import/artwork | `src-tauri/src/catalog.rs`, `src-tauri/src/artwork.rs`, `src-tauri/src/album_order.rs` | Metadata, cached cover variants and legacy tag backfill |
| Shared native domain | `crates/music-core/src/` | SQLite store, catalog queries, group order, playlist rules and recap aggregation |
| Android integration | `src-tauri/plugins/native-music/` | MediaStore/document access, Media3 foreground service and durable pending journal |

The frontend detects Tauri in `src/api/index.ts` and chooses `NativeMusic` or `BrowserMusic`. New cross-platform operations should extend `MusicApi`, implement both adapters, then add or update the Tauri command and native domain behavior. Browser tests validate the preview adapter; Rust tests validate native rules. One adapter is not evidence for the other's runtime behavior.

## Rust module layout

`src-tauri/src/lib.rs` is the application entry point. Keep startup state in `state.rs`, IPC handlers in the appropriate `commands/*.rs` feature module, and player dispatch/journal handling under `playback/`. Register each handler by its module path in `generate_handler!`; the frontend invokes its original function name. Handlers and shared state are crate-visible, rather than a public library API. Preserve the mobile entry-point attribute on `run`.

The command modules expose platform operations and delegate catalog, playlist and recap rules to `music-core`. `commands/catalog.rs` uses the playback command only to prune removed tracks from the current queue. Recap/history commands use the playback bridge to flush or clear listening. These explicit dependencies keep UI commands from becoming an alternative playback clock or journal owner. Existing domain files in `crates/music-core/src/` remain the owners of persistence and policies.

For native-only refactors, run Rust core/native tests and builds for Windows and Android: desktop compilation does not check Android's conditional modules. A browser journey cannot exercise the Rust IPC handlers. Keep command names, arguments, serialized return values, event names and journal acknowledgement ordering stable during moves.

Right-click actions use the shared `ActionMenu`: track rows open the same actions as the visible overflow button; `AppContextMenu` supplies navigation, card opening and text-editing actions. It captures text selections before focus moves and updates controlled editors through their native value setter/input event. Clipboard failures leave text intact and report keyboard alternatives. Menus constrain their position to the viewport, restore focus, and close on Escape, outside click, scroll, resize or window blur.

Windows config disables devtools and the native policy disables default WebView menus. Its accelerator callback consumes F5/F12 and Ctrl+R (including Shift), leaving other keys to WebView and React. The frontend native-only capture guard also blocks equivalent reload/inspector combinations. Browser preview retains its normal developer shortcuts; a web page cannot guarantee control over browser chrome. Do not disable all browser accelerators: that also removes useful editing/zoom behavior.

## Data paths and invariants

- **Import:** Native imports resolve file or granted-URI metadata, reconcile stable identities and aliases, then publish `catalog://progress`. React refreshes catalog views as processed counts advance. The browser adapter has its own IndexedDB import. Start progress after the user selects a source; cancellation must leave the Library usable. Refresh Album and Artist caches independently and guard late responses by request version.
- **Ordering:** Persist `discNumber`, `trackNumber` and `releaseYear` when tags exist. Native `groups.rs`/`catalog_query.rs` and the browser adapter determine group IDs and ordering. React must retain that order in detail rows and playback IDs. Missing disc means disc one; unnumbered songs follow numbered ones with a stable fallback. Manual playlists and reordered queues retain their own explicit order. Legacy metadata backfill keeps track IDs, favorites and history stable.
- **Artwork:** Native catalog rows use a small cached variant, while cards/detail/player/recap can request larger variants. Preserve the currently displayed image until a larger one decodes. Low resolution embedded source art cannot be made intrinsically sharp. Missing art uses a stable design for a named album.
- **Visibility:** SQLite `hidden_tracks` is a separate visibility table (schema version 2); history still references the original track. Browser records use an optional `hidden` flag. Catalog pages, groups, grouped search, generation and recap playback exclude hidden tracks. Historical recap rankings retain them. Reimport explicitly restores native visibility; browser reimport replaces the hidden flag. Preserve playlist membership so Undo/reimport can recover it. Never delete source audio for this action.
- **Grouped search:** `searchCatalog(query, limit)` returns tracks, albums, artists, playlists and `hasMore`. The surface debounces input, rejects obsolete results and increases the result limit on Load more. Favorite changes update the result row after persistence. Search keeps the compact player interactive and restores the underlying view on exit.
- **Sharing and effects:** `shareAudio` reports `opened`, `saved`, `download` or `canceled`. A chooser opening is not proof of delivery. Windows saves copies; browser file sharing falls back to downloads; Android passes content URIs with temporary read grants. Sound controls use runtime capabilities. Android Equalizer presets attach to the Media3 audio session and preferences remain service-owned; proprietary effects stay in the device panel.
- **Playback and history:** The player owns the playback clock and queue. Android Media3 persists pending journal intervals while the WebView is suspended; Rust imports and acknowledges them idempotently. Paused, buffering and seeked-over time never count. Keep the browser preview's sample audio excluded from recap.
  An omitted playback index starts at the first visible track; an explicit index identifies a track in the original ID list and must be remapped after filtering. Reject an explicitly removed selection. Playlist editing must map visible indices to stored membership positions, preserving hidden entries for Undo.
- **Recap and export:** Rust owns native aggregation and playlist selection; the browser adapter mirrors those rules for preview. Consult [recap methodology](recap-methodology.md) before changing time accounting. A snapshot is frozen; export rechecks its privacy revision. The user-facing PNG includes display data and coverage only, never source paths, exact timestamps, device IDs or private sessions. The preview and download must use the same rendered blob.
- **Startup and Library state:** Load saved settings before mounting the shell, apply the theme to the document early, and reveal the Windows window only after the themed shell commits. Each Library group tab owns its cache, request version, loading and error state. Show a loading placeholder during a first read, and show an empty message only after a completed empty result.

## Implementing a feature

1. Branch from `dev`. Inspect the relevant `MusicApi` method, React call site, Rust command/domain path, browser adapter and existing tests before editing.
2. Put UI behavior and loading/error feedback in React; put persistent catalog, playlist and recap rules in the Rust core. Keep Android background playback and its journal in the native plugin.
3. Extend types and both adapters when adding an operation. Preserve data migration and idempotency when changing stored fields or journal records. Update English and Spanish strings and keyboard/screen-reader states for new controls.
   Keep one component per `.tsx` file. Put reusable interaction hooks and non-rendering helpers in `.ts` files; keep `App.tsx` as composition. Avoid moving JSX back into the coordinator or adding a second exported component to a shared-control file. Context types derive from the coordinator with a type-only import, preventing a runtime dependency cycle.
4. Test the affected rule at its owner and run the relevant end-to-end journey. On PowerShell: `npm.cmd run check`, `. ./scripts/env.ps1` then `npm.cmd run test:core`, and `npm.cmd run test:browser` when UI behavior changes. Use `npm.cmd run doctor` to inspect native prerequisites.
5. Record actual results and remaining native acceptance work in [verification.md](verification.md). Android runtime acceptance requires a booted emulator; background reliability and performance require separately measured device evidence. Keep artifacts and `.tools/` out of Git.

## Current boundaries

The browser preview, desktop startup checks and a built/signed ARM64 debug APK are recorded in the verification log. Android runtime acceptance has not completed on a connected emulator or phone; the x86_64 APK is older than the latest UI changes. Semantic playlist interpretation, online enrichment and model downloads remain deferred. Treat the original plan's JSON export and 1080 × 1920 card targets as superseded by its dated recap export revision.

See [Phase 2](phase-two-ux-flow.md) for the motion/interaction contract and [verification](verification.md) for current results. Browser accessibility automation is separate from Narrator/TalkBack and native gesture acceptance.
