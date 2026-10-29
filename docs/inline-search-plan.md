# v0.12.0 — Search within the current view

## 1. Delivery and approach

- Create `dev.inline-search` from clean `dev` at `7d62599`. Save and commit this plan before implementation.
- Replace the search popup with an inline field filtering the active Library view, preserving existing rows, cards and contextual menus.
- Target v0.12.0; retain the current application version until a subsequent release request.

## 2. Interaction and search scope

- The search icon reveals and focuses a full-width row below navigation, within normal layout. Localize scope-specific labels for songs, albums, artists, playlists and collections.
- Carry query/open state across main Library tabs. Your Recap suspends search and restores it on returning to Library.
- Opened collections start a separate clear search. Back restores parent query, results, scroll and originating focus.
- Match every whitespace-separated term using case-insensitive NFKC-normalized substrings; punctuation is literal, without fuzzy matching/query syntax.

| View | Searchable content |
|---|---|
| Songs | Title, artist and album, combined with Favorites and current sort |
| Albums | Album title and album artist |
| Artists | Artist name |
| Playlists | Displayed names of automatic and saved playlists |
| Collection details | Title, artist and album within that collection |
| Artist Albums subview | Album title and artist within that artist |

- Keep playlist subdivision headings with matches. Hide creator/generated preview during nonempty overview searches while preserving state.
- Clear restores current collection without closing; Close clears and collapses. Escape/Android Back clears a nonempty query, then collapses the empty field, before normal navigation.
- Retain input focus through updates. `/` opens search outside editable controls. Enter applies pending input immediately without playing.

## 3. Data flow and responsiveness

- Search complete catalog/collection before pagination, never only loaded rows or a hidden DOM catalog.
- Extend `groups` with optional query and add `filterTrackIds(ids, query)` preserving original ID order. Align paged `listTracks` matching with confirmed substring semantics.
- Native matching belongs in Rust; browser matching runs in a Web Worker, with shared fixtures and no storage migration.
- Maintain bounded revision-keyed metadata caches invalidated on import, metadata changes, removal and reimport.
- Keep 160 ms debounce and immediate input updates; lower-priority result rendering. Clear, scope changes and cached results avoid extra debounce.
- Key requests/cache pages by scope, query, sort/filter, collection and catalog revision. Reject stale replies and prevent duplicate/skipped Load more pages.
- Preserve collection order, membership and playback. Actions map through stable IDs/original playlist positions.
- Remove retired popup, exclusive focus trap/styles/API after migration.

## 4. Loading, accessibility and visual behavior

- Retain stable result geometry while replacement query loads, mark busy, show compact delayed progress; never describe stale rows as confirmed current matches.
- Display matching/total counts and politely announce completed results, without per-keystroke announcements.
- Separate no matches/Clear from empty library, empty Favorites and loading/error. Inline Retry retains query and navigation.
- Retain rounded orange focus, full keyboard access and playback reachability without a focus trap.
- Reflow at narrow/high-zoom sizes without width animation, horizontal overflow or page-wide loading overlays.

Research: [Scottish Government filters](https://designsystem.gov.scot/patterns/search-results/search-filters), [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html), [React deferred rendering](https://react.dev/reference/react/useDeferredValue).

## 5. Verification and completion

- Shared Rust/TypeScript matching fixtures: substrings, normalization, terms, punctuation, empty input and scoped membership.
- Cover matches beyond page one, duplicate albums, localized automatic names, Favorites/sort, artist subviews, rapid typing/tab changes, stale replies, Clear/Close, Retry, imports and parent/detail restoration.
- Check filtered playback, actions, selection and playlist editing target correct IDs/positions.
- Compare old popup and inline timings on identical fixtures including 10,000 tracks. Measure input-to-paint and results separately; targets are 50 ms input feedback and 300 ms cached first-page results including debounce. Record actual evidence and investigate regressions.
- Check EN/ES, themes, keyboard/focus, Reduce Motion, 320/390 px, short windows and native zoom.
- Run frontend checks, complete browser suite, Rust core/native and Kotlin regressions. Build Windows/ARM64 Android and verify metadata, signature, native hashes and frozen assets.
- Record results/platform gates in `docs/verification.md`; commit for review. Integration/release require a subsequent request.
