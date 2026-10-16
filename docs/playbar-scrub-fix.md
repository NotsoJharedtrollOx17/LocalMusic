# Playbar scrub audio fix

Branch: `dev.playbar-scrub-audio`, from the reviewed v0.4.0 integration.

The user hears rapid, jarring audio jumps while dragging. `PlaybackProgress` currently seeks on every range input event; the browser resets DSP and the native player seeks its decoder for each event. Both compact and expanded players use this component.

Keep a local position preview during mouse, touch and keyboard gestures. Send one seek when the gesture finishes; preserve the current playing/paused state. Escape, blur, pointer cancellation and track changes discard the gesture. Keep ordinary accessible/programmatic range changes working. No audio backend or listening-accounting changes are required.

Verify actual seek calls during drag, one final seek on release, release outside the slider, cancellations, track changes, keyboard, touch and both player surfaces. Browser results do not establish physical audio acceptance. Preserve the archived v0.4.0 packages; the fix remains on its branch for review.
