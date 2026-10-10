# Phase 2: Music flow and motion

Use the 67-second Samsung Music recording as a behavioral reference for centered tabs, player expansion, queue continuity, persistent playback during navigation and contextual actions. Retain the current typography, orange/charcoal palette and artwork. Motion budgets are proposals from `.AGENTS/Codex-UX-UI-Design-Reference.md`, not measured Samsung timings.

## Implementation structure

The user additionally requested modularization during implementation. `App.tsx` composes the UI; every component has its own `.tsx` file. `src/app/` contains views, dialogs and state/read/action hooks, `src/components/` contains shared controls, and `src/ux/` contains surfaces and interaction helpers. The former `components.tsx` is replaced by a barrel and individual component files. See the developer guide for the code map.

Grouped search starts at 30 results per category and offers Load more instead of silently dropping later matches. Artist album results are cached by artist membership and catalog revision, so returning to a ready artist does not briefly replace its cards with a loading message. Search leaves the mini player interactive; other overlay layers own focus and restore it on exit. Playback state changes do not wait for motion completion.

## Implementation contract

- Work on `dev.ux-flow-step-two`, based on `dev`; preserve `main` and `v0.1.0`.
- Center selected Library tabs; support touch swipes and desktop keyboard navigation; preserve per-tab scroll. Exclude nested horizontal controls and sliders from gestures. Compact the mobile heading on scroll.
- Animate ready album/artist details without weakening request guards. Artist details offer Tracks/Albums.
- Use one accessible player surface for artwork and queue, with anchored transport. Expand from the mini player and reverse on close. Support mobile swipe up/down, desktop click/drag, Enter/Space, Escape and Android Back. Playback remains independent of motion.
- Use 120–180 ms control feedback and 220–320 ms contextual motion. Cancel interruptions; Reduce Motion changes state immediately.
- Search groups Tracks, Albums, Artists and Playlists, retaining the compact player and restoring the previous view/focus. Guard stale reads.
- Provide anchored menus and selection through long press, visible Select and mouse/keyboard. Actions: Play, Favorite, Add to playlist, Share audio, Remove from Library.
- Remove from Library persists visibility separately from historical track records. Preserve original files, sessions and snapshots. Reimport restores visibility; confirmation and Undo explain the operation.
- Android shares audio through temporary read-only URI grants. Browser uses supported file sharing or download; Windows saves copies. Opening a chooser does not imply delivery.
- Sound controls reflect runtime capabilities. Android owns session-bound equalizer and system audio-effects integration; vendor controls remain in the system panel. Unsupported platforms show truthful availability.
- Extend MusicApi, Rust and browser adapters for search, visibility/restore, sharing and sound capabilities. Rust owns native catalog rules; Android service owns effects; React owns interaction/motion.

## Acceptance

Exercise mobile/desktop tabs, delayed details, player/queue/collapse, search return, menus, selection, share cancellation, removal/Undo/reimport, long labels, dark mode and live import. Check keyboard/focus, Back, reduced motion and zoom. Run frontend/browser/Rust checks and native builds; record observed results and runtime limits in `docs/verification.md`. Browser results do not prove Android playback or motion performance.

## Decisions made during implementation

Removal keeps playlist membership privately, so Undo/reimport can recover it. Current playback continues; other removed songs leave the active queue. Hidden songs are omitted from browse/search and future generated playlists. Audio sharing uses the platform chooser when supported, otherwise an explicitly labeled save-copy action. No original file is deleted.

Artist Albums uses the adapters' existing catalog groups and membership, rather than regrouping tags in React. Detail artwork upgrades through the shared decoded-cover cache. Opening a dialog from the player retains the parent player surface underneath, and Back restores that layer. Playback without an explicit selected index starts at the first visible track; explicit selections remap through visibility filtering. Playlist editing maps visible rows back to retained membership positions. Exploring sample audio restores samples previously removed from the browser Library.

Implementation results and remaining platform acceptance are recorded in [verification.md](verification.md).
