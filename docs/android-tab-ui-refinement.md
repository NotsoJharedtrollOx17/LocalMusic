# Android tab and Library UI refinement

## Scope and delivery

Continue `dev.ui-ux-stress-audit` from `36eb549`, retaining version **0.15.0**. Archive this plan before implementation. The user's 13 November recording is the reference for this presentation-only pass; keep the recording and extracted diagnostics outside Git. No integration or release is requested.

## Requested behavior

- Keep the manually scrolled Library tab strip in place when selecting an already-visible tab. Reveal an off-screen selection by the smallest horizontal movement, with restrained motion and an immediate Reduce Motion equivalent. Scrolling the strip alone does not select a tab.
- Reserve the emphasized label's width so selection cannot stretch the strip or shift neighboring labels. Keyboard focus must reveal tabs horizontally without scrolling the page vertically. Retain the orange indicator, accessible tab semantics and focus frames.
- Phone Songs rows show artwork, title and artist without numeric duration or album/year clutter. Preserve unavailable/removed status, selection, favorites and menus. Full metadata remains in Track Details and existing collection/desktop presentations.
- Present phone Artists as full-width rows with small leading artwork, artist name and track count. Preserve artist navigation/search, stable group IDs, loading/error states and Albums' two-column layout. Desktop artist cards remain available.
- Remove the mini-player's tiny orange progress sliver; retain its controls, opaque dock and full player's seek/timing controls.
- Remove phone-only player/collection opacity and flying-cover transitions that can produce a brief blank or second image. Preserve static, square artwork space, source artwork, desktop transitions and system insets.

## Implementation boundaries

React, existing gesture/navigation hooks and CSS own these changes. Do not alter catalog identities, metadata, playlist ranking, playback, listening history, Recap, DSP, native commands or persistence schemas. Do not change the phone's font scale or saved preferences to make the layout fit.

## Verification

Add focused browser regressions for stationary visible-tab selection, stable label geometry, strip-only scrolling, vertical scroll preservation, off-screen/keyboard navigation, phone Songs density, artist rows versus album/desktop cards and immediate player/collection presentation. Cover EN/ES, light/dark, Reduce Motion, narrow/landscape and enlarged text through existing and focused journeys.

Run frontend checks and the full browser suite against frozen final assets after compilers finish. Build Windows and ARM64 Android, verify package identity/signature and embedded assets, and inspect the installed phone UI if the authorized device is available. Preserve the user's playback, queue, settings, saved playlists and music files. Record actual results and any unverified UI/manual gates in `docs/verification.md`; unchanged native audio/domain code does not require a new performance or background-playback claim.

Commit this UI pass for review on the existing branch. Keep development tools, private transcripts, screenshots and packages outside Git.
