# Playbar scrub audio fix

Branch: `dev.playbar-scrub-audio`, from the reviewed v0.4.0 integration.

The user hears rapid, jarring audio jumps while dragging. `PlaybackProgress` currently seeks on every range input event; the browser resets DSP and the native player seeks its decoder for each event. Both compact and expanded players use this component.

Keep a local position preview during mouse, touch and keyboard gestures. Send one seek when the gesture finishes; preserve the current playing/paused state. Escape, blur, pointer cancellation and track changes discard the gesture. Keep ordinary accessible/programmatic range changes working. No audio backend or listening-accounting changes are required.

Verify actual seek calls during drag, one final seek on release, release outside the slider, cancellations, track changes, keyboard, touch and both player surfaces. Browser results do not establish physical audio acceptance. Preserve the archived v0.4.0 packages; the fix remains on its branch for review.

## Follow-up: seek feedback and shared appearance (17 October 2026)

Native seek completion previously cleared the optimistic preview before its position snapshot arrived. A poll started before seeking could also overwrite newer push state. `PlaybackUpdates` now rejects superseded polls, suspends intermediate pushes during a seek and publishes a fresh position before resolving it. Older seek acknowledgements cannot overwrite a later seek. Small adjustments need no arbitrary distance tolerance or fixed waiting timer.

Compact and expanded players share the same 3 px track, circular thumb and 16 px input area. Removed expanded/legacy slider overrides, disabled background tiling and centered compact timestamps against the shared input area.

The user approved both revisions on 17 October 2026. They are integrated into `dev` and included in the local v0.4.1 patch release; see `docs/releases/v0.4.1.md` and `docs/verification.md` for release evidence.
