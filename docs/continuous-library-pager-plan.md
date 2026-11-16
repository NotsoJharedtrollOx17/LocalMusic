# Continuous Library scrolling and adjacent-page swiping

Approved 15 November 2026. Android is the primary target. Preserve the approved XMB tab strip while making content scrolling continuous and revealing real neighboring pages during swipes.

## Delivery

- Create `dev.continuous-library-pager` from clean `dev` at `b66b6ce` and commit this specification before implementation.
- Keep application version `0.18.1`. Commit the completed feature for review; integration and release require a subsequent request.
- Share catalog/cache improvements with desktop. Windows retains tab-click navigation; touch paging is for the phone layout.

## Complete catalog preparation

- Add a typed, read-only `catalogIndex()` adapter operation returning a consistent catalog revision, complete ordered track/group identities, membership and lightweight display metadata. Do not include audio, large artwork payloads or file rescanning.
- Rust owns native ordering, identity and catalog rules; browser matching remains in its worker. Existing full-track/paged operations remain authoritative for actions and other workflows.
- Prepare the persisted catalog once per launch before Library readiness and reuse it on resume. A brief initial preparation is acceptable. No new persistent cache or listening-history migration is needed.
- Publish full item counts and scroll extent together. Remove the 60-row scrolling boundary from Songs, Albums, Artists, search/Favorites and collection/playlist details.
- Coalesce revision invalidations, publish atomically and reject stale revisions. Keep confirmed contents usable during refresh; initial failures offer Retry and refresh failures retain prior contents.
- Do not redesign Queue, manual pickers or organization workflows.

## Rendering and reuse

- Retain virtualization with stable IDs rather than index identities; use occurrence keys when playlist entries repeat.
- Use each pane's actual scroll container. Cache measurements and anchors by scope/revision/layout and restore before showing a page.
- Preserve per-tab/collection scrolling. Sort/search resets to the top; Back restores the parent position and originating item.
- Overscan approximately two viewport heights, adapting to scroll velocity with a maximum of five.
- Request list-appropriate artwork sizes separately from player artwork. Coalesce requests in a shared cache bounded to 32 MiB estimated decoded memory, pin visible images and evict unused entries.
- Keep artwork sources stable on playback ticks and prevent progress polling from updating the entire list.
- Reuse metadata, images and measurements without mounting the complete catalog as hidden DOM or repeatedly replacing confirmed rows with placeholders.

## Content pager

- Render at most three panes: previous, current and next, with independent vertical scrolling and cached view state under one shared Library controller.
- Reveal genuine adjacent contents during finger movement. Inactive panes are inert and hidden from accessibility. Keep the app header, XMB strip and mini-player stationary.
- Preserve horizontal intent detection. Commit at 20% of viewport width, or velocity above 0.35 px/ms with at least 24 px travel; otherwise snap back. Settle in at most 180 ms without an additional content entry animation or fade.
- Stop at Songs and Your Recap with restrained edge resistance; no wrapping or invented pages. Vertical lists stop at their real final item.
- Tab taps use the same pager; distant jumps go directly to the target. Commit XMB selection once, preserving the selected tab's left anchor and keyboard navigation.
- Cancel row presses and hold timers when paging owns a gesture. Suppress only the swipe's compatibility click; a fresh tap must work immediately.
- Disable paging in collection details, selection/editing and overlays. Preserve normal Back and vertical scrolling.
- Cache real previews without running playlist analysis in hidden panes. Validate Recap privacy revisions, avoid hidden polling and refresh on activation.
- Reduce Motion uses immediate changes without interpolated dragging.

## Verification and acceptance

- Exercise 711-track and 10,000-track fixtures: fast flings, reversal, deep return, endpoints, responsive grids and artwork reuse. After readiness, scrolling must not wait for another metadata page, reset the full list or sustain a blank range.
- Instrument metadata requests, mounted rows, image decodes and memory/cache limits. Keep DOM and caches bounded.
- Test interrupted drags, actual neighboring contents, repeated swipes, endpoints, first taps, long-press cancellation, search/Favorites, import invalidation, failures/Retry, stable action IDs and unchanged listening accounting.
- Verify EN/ES, themes, text scaling, Reduce Motion, keyboard, portrait/landscape, desktop zoom and one-overlay invariants.
- Run frontend checks, the complete browser suite, Rust core/native and Kotlin tests. Build Windows and ARM64 Android and verify metadata, signatures and embedded assets.
- Install the final APK on the available Note10+ after taking a fresh paused baseline; capture fast-scroll and swipe evidence. Measure preparation, navigation, frame gaps and memory separately. Build/browser evidence does not establish physical-device smoothness.
- Record actual results and remaining manual/device gates in `docs/verification.md` and commit the completed feature for review.
