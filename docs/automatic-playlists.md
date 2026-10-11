# Automatic library playlists

## Scope

Add Recently added, Recently played, Most played and Favorites to Library > Playlists on `dev.ui-ux-polish`. These derived collections coexist with editable saved playlists. They cannot be renamed, saved over or deleted.

## Rules

- Recently added: latest 100 first catalog insertions. Reimport preserves original order. SQLite row IDs supply native insertion order. Browser imports use an internal sequence; older preview imports without ordering metadata get a stable older fallback because historical import dates cannot be recovered.
- Recently played: latest eligible listening activity per distinct track, capped at 100. Interval end times account for resumed sessions.
- Most played: top 100 by sessions reaching 30 seconds; ties use total recorded listening, latest activity, then normalized title and ID.
- Favorites: all visible, available favorites, ordered by normalized title and ID.
- Hidden/unavailable tracks never enter these queues. Excluded sessions and sample audio never populate listening-based collections. Listening history itself remains unchanged.

## Ownership and live updates

Rust owns native rules and reads the flushed desktop/Android journal. Browser preview mirrors the rules using IndexedDB. React localizes labels using fixed collection IDs and refreshes on navigation, imports, favorites, playback changes, focus and a five-second visible-page interval. Request generations reject stale reads. Empty collections remain visible with an explanatory detail state.

## Verification

Use shared Rust/TypeScript fixtures for ordering and privacy rules, Store tests for reimport/visibility/reserved IDs, and browser journeys for live favorites, playback queues, localized mobile layouts and saved-playlist coexistence. Record actual native build/runtime evidence and Android gates in `docs/verification.md`.
