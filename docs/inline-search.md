# Inline Library search

The v0.12.0 feature branch replaces the grouped popup with scoped filtering in the current view. The application version remains 0.11.0 until release approval. See [the approved plan](inline-search-plan.md).

## Interaction

The search icon or `/` reveals an inline field beneath navigation. A query follows the main Songs, Albums, Artists and Playlists tabs. Your Recap suspends search. Opening a collection starts clear; Back restores the parent query, scroll and originating control. Within artist details, Songs and Albums search their corresponding metadata. Playlist overview matching uses displayed saved/automatic names, including localized automatic names.

Clear empties the current query; Close also collapses the field. Escape and Android Back first clear a query, then close the empty field before leaving a collection. Enter applies pending input immediately and never starts playback. Results remain ordinary rows/cards with existing actions. Filtering does not save or reorder a queue or playlist; editing maps displayed IDs to original membership positions. Query changes clear song selection to prevent invisible bulk actions.

## Matching and data ownership

Matching uses all whitespace-separated terms as literal, case-insensitive NFKC-normalized substrings. Punctuation has no query syntax and accents are not stripped. Hidden library entries are excluded; unavailable entries retain their existing disabled-play behavior. Searches inspect complete catalog/collection membership before pagination.

Rust owns native matching and keeps one normalized catalog index per Store, invalidated by track/favorite/visibility writes. Native group matching caches the two normalized label indexes and at most 128 group memberships by catalog revision. Browser preview uses a separate Web Worker index and a metadata snapshot. It checks the optional `catalog-revision` settings key before reuse; imports, favorites and visibility transactions increment that key atomically with their writes. Older storage defaults to revision zero and needs no IndexedDB schema upgrade. Metadata caches do not contain decoded audio.

`groups(kind, offset, query)` filters group labels before paging/resolving memberships. `filterTrackIds(ids, query)` preserves the supplied ID order. Paged `listTracks` uses the same matching semantics. The retired grouped-search API, command, popup and exclusive overlay behavior were removed.

React updates input immediately and debounces uncached query work by 160 ms. Scope changes, Clear, Enter and cached pages avoid another debounce. The view cache holds at most 24 result pages; the worker keeps at most 32 query results and one active index. Scope/query/options/catalog revision/membership keys and request sequences reject stale replies. Retained stale content is marked busy/inert until confirmed; delayed progress and inline errors/Retry stay beside the field. A polite status announces completed matching/total counts.

## Measurement and evidence

`scripts/benchmark-search.mjs popup|inline URL` seeds an isolated 10,000-track browser database, warms one query, then measures six new queries and six repeats. It records the input event to the next painted input update and to painted confirmed results, including debounce. Artifacts are written below `artifacts/search-benchmark-*.json`.

On this desktop with Chromium 156.0.8078.4 at 1280x900, inline p95 input feedback was 32.2 ms; p95 confirmed results were 244.8 ms and repeated-query p95 was 30.4 ms. The preserved v0.11.0 popup on the same fixture measured 27.9 ms input and 14,608.5 ms results; its grouped search repeatedly traversed catalog categories. These are small desktop engineering measurements, not physical-phone performance claims or population latency statistics. The inline measurements meet the planned 50/300 ms targets.

See [verification](verification.md) for final browser/native gates, package evidence and outstanding runtime/manual acceptance.
