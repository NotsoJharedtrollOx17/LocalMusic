# Android Recap, player, and artwork polish

Approved for implementation. Baseline `fb30699` on `dev.android-hotfix-integration`.

The November 19 recordings show default thumbnails before embedded covers load (Local Music 1:33–1:43), a request for a larger lower-right `local.` stamp in the exported Recap (2:22–2:41), and an opening and closing transition that cuts across the player (2:47–2:58). Samsung Music's mini-player expansion around 0:46–0:50 is the reference for continuity.

## Changes

- Move the existing Recap export symbol and wordmark to the lower-right and enlarge both by about 50%. Reserve the left footer for coverage dates and the recorded-listening note. Use the same layout for preview and full-resolution Story and Feed PNGs. Give Save and Share separate pending labels.
- Grow an opaque Android player surface from the mini-player bounds, move one cover between its two positions, and keep transport anchored. Allow vertical drags on the mini-player and player header to track the finger after intent is clear. Settle or reverse from the current position for taps, gestures, Back, and interrupted motion. Settle immediately with Reduce Motion.
- Render cached covers immediately and keep uncached artwork in a neutral, fixed-size slot until decoded. Retain the current track's small cached cover while its larger version loads. Prioritize current and visible artwork within existing limits.
- Align Equalizer loading, error, and ready content. Close and Back return to the originating Player or Queue without replaying expansion. Queue Back returns to Player. Keep transport, sliders, and scrub gestures independent.

## Acceptance

- On the Note10+, repeat open, close, swipe, cancel, reversal, and nested Back flows on the same synthetic fixture. Check portrait, landscape, reduced motion, focus, paused playback, queue, and Library scroll.
- Compare cold and warm artwork readiness and request counts. Check row recycling and the left-anchored XMB Recap endpoint.
- Verify the stamp and coverage text for both formats in EN/ES with long titles and live and frozen Recaps. Confirm dimensions, privacy checks, and Save/Share cancellation. Run focused browser and accessibility regressions.
- Build a separate QA package and coordinate phone availability before installation. Record measured results. The change uses existing playback, catalog, and Recap interfaces and requires no data migration.
