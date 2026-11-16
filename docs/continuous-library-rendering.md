# Continuous Library rendering

This implements the [approved plan](continuous-library-pager-plan.md). Application version remains 0.18.1 on the feature branch pending review.

## Catalog preparation

`MusicApi.catalogIndex()` prepares the complete visible catalog and its album/artist membership before Library readiness. Native `catalog_index` runs on a blocking worker and reads one mutex-held Rust Store revision. It does not open media files or resolve artwork. The wire format references group covers by track ID rather than duplicating their metadata; source URIs are blank and artwork contains cache identities only. The browser adapter prepares the corresponding IndexedDB snapshot, rejecting a revision superseded during preparation. No database migration is introduced.

`useCatalogReads` publishes the index, counts and groups together, coalesces overlapping reads, rejects obsolete requests and preserves confirmed content during refresh. Favorites and sorting use the prepared metadata. Collection details resolve their entire ordered membership from the index; search resolves complete matches before virtualization. Manual pickers retain their separate paging workflow. Playback actions continue to pass stable IDs to the authoritative adapter, which resolves actual media sources.

The existing legacy disc/track/year tag preparation remains a startup compatibility step. The native adapter requests that existing migration only when the index explicitly reports unfinished metadata, then reads its resulting revision; ready catalogs do not reopen media files. The browser retains its legacy preparation before publishing the index. Recap reuses cached history metadata including hidden tracks, so hiding a library row does not erase its historical ranking.

## Rows and artwork

`TrackList` virtualizes against the real scrolling element on phones and the window on desktop. It uses stable identity/occurrence keys and a bounded measurement cache. Overscan starts at two viewport heights and grows to at most five during fast scrolling. Loading more metadata is unnecessary to extend a ready Library list.

Artwork resolution is separate from metadata preparation: 128-pixel rows, 256-pixel catalog cards and 512-pixel player artwork. Shared requests allow at most four simultaneous resolutions/decodes, discard queued work when its last viewer leaves and reuse decoded URLs. The cache tracks estimated decoded RGBA bytes with a 32 MiB cap, preferentially retaining visible artwork. This is a cache budget, not a bound on total process, GPU or WebView memory.

The Library presentation provider keeps transport progress-only updates from invalidating every card. Playback commands and the mini/full players still use the live controller. Track changes, playing state, queue edits and other interaction-relevant updates remain visible.

## Phone content pager

One Library controller supplies at most three presentation panes: previous, current and next. Each has its own vertical scroll range. Inactive panes are inert and hidden from accessibility, without starting another controller, playlist analysis or hidden polling. The active XMB tab strip keeps its approved left alignment. The app header, navigation and mini-player do not move with the content track.

Horizontal intent claims a drag after 12 pixels and cancels row holds/presses. A release commits at 20% of the pane width, or after at least 24 pixels above 0.35 px/ms. A short deliberate drag snaps back; endpoints resist and stop. Settling takes at most 180 ms and uses one track animation. Tab activation updates selection immediately, avoiding a delayed state commit that a subsequent tap could cancel. Reduce Motion changes pages immediately.

Saved positions include a stable visible-row anchor and its screen offset, allowing measured row heights to change without moving the reader to another song. Back restores collection origins; new scrolling cancels restoration. Contextual menus and the phone selection toolbar render outside transformed panes so fixed positioning stays relative to the window. Touch-up navigation consumes only its generated compatibility click; the next physical press works immediately.

## Evidence boundary

See [verification](verification.md) for actual browser, native, package and connected-device results. Complete metadata and bounded DOM tests do not establish frame latency, battery use, TalkBack acceptance or large-library physical-device performance. The phone baseline contains 711 songs; the 10,000-track browser/Rust fixtures are synthetic.
