# Android UX stability — second refinement pass

## Summary and delivery

Continue `dev.ui-ux-stress-audit` from clean commit `3949272`, retaining version **0.15.0** and the previous fixes. Archive and commit this plan before implementation. A–Z navigation remains deferred. Integration and release require a separate request.

## Samsung-style interaction consistency

Use Samsung Music and [One UI interaction guidance](https://developer.samsung.com/one-ui/accessibility/interaction-and-control.html) as references for predictable controls, clear navigation and recoverable actions.

- Preserve Local Music’s orange palette, Library tabs, opaque bottom mini-player and full-screen phone task dialogs.
- Standardize spacing, secondary text, vertical overflow buttons, selection controls and pressed feedback. Preserve system font scaling and aim for at least 48 CSS-pixel primary touch targets.
- Keep editors selectable and app labels nonselectable; preserve keyboard focus and accessible names.
- Keep motion restrained, interruptible and compatible with Reduce Motion. Preserve usable layout during updates without confirming stale content.

## Audit and implementation

Record reproduced defects, expected behavior and evidence before fixing them.

- Inspect Library swipes, scrolling, song holds, mini-player opening and seek dragging. Cancel pending gestures on interruption, backgrounding, lost capture, additional pointers and navigation. Cancelled gestures must not later select, play, seek or reopen a view.
- Exercise menus, search, selection, collections, Now Playing, Queue, EQ, playlist editors and organization reviews. Preserve established Back behavior, originating focus and scroll position, with one interactive overlay per window.
- Check keyboard, system-bar and mini-player bounds in portrait, landscape and enlarged text. Fix clipped actions, sticky highlights, overlapping labels and loading jumps.
- Exercise rapid navigation, delayed responses, retries and interrupted import, playlists, Settings and Recap operations. Prevent duplicate pending save/removal submissions while retaining intentional repeated transport commands.
- Fix reproduced problems through existing presentation/controllers and native bridges. No new public API, schema or dependency is planned. Preserve playback accounting, identity, recommendations and saved data.

## Verification and acceptance

- Establish an authorized Note10+ baseline: build, OS/WebView, device zone, catalog, settings and playback. Helpers must use the phone's own calendar and zone.
- Run repeatable touch sequences, rapid reversals, interrupted holds, multi-touch, keyboard dismissal, background/resume and track changes.
- Verify EN/ES, themes, Reduce Motion, 320/390 px, short landscape, current 130% phone font scale and browser text scaling through 200%, following [Samsung typography guidance](https://developer.samsung.com/one-ui/accessibility/layout-and-typo.html).
- Use isolated browser fixtures and original excluded audio for controlled playback checks. Preserve personal files/history and restore captured settings/playback.
- Require a clean complete browser-suite pass on frozen final assets, frontend checks, relevant Rust/Kotlin regressions and Windows/ARM64 builds. Verify versions, signatures, embedded assets and native-library hashes.
- Record fixes, screenshots, measured results and open gates in `docs/verification.md`. UI/resume evidence does not establish sustained background reliability, thermal/battery performance or manual accessibility acceptance.
- Commit the completed pass for review; private diagnostics and development artifacts stay outside Git.

## Reproduced findings — 13 November 2026

- Before changes, five regression journeys failed: song holds after blur, a secondary pointer or lost capture; a Library swipe completed after blur; and a horizontal mini-player drag followed by its compatibility click opening Now Playing.
- An initial installed-build inspection ended with one selected song after Home/return, but that result was not valid native-lifecycle evidence: Playwright's default focus emulation kept the inspected page visible. The corrected helper uses `noDefaults: true` and records actual visibility timestamps. On the gesture-fix build the phone became hidden about 169 ms after the press, before the 480 ms threshold, and returned with zero selection. No playback was started.
- Implement a shared, bounded gesture-lifecycle subscription for blur, hidden state, replacement pointers and overlay ownership. Cancel during scope changes before paint. Retain ordinary primary taps, keyboard activation and intentional long-press selection.
- Give mini-player drags their own pointer identity and directional intent. Open only for an upward-dominant gesture beyond the existing 35 px threshold; suppress drag/cancellation compatibility clicks. Preserve tap-to-open and the next deliberate interaction.
- No visual redesign was needed for these findings. Preserve the preceding density, safe-area, Recap and Settings improvements and verify them through the existing regression journeys.
- Font-only 200% inspection subsequently reproduced a count broken inside a word and Spanish appearance text extending beyond its selected button. Make the phone toolbar wrap at intrinsic content widths and allow appearance choices to wrap while retaining their touch targets. Browser OS text-scale emulation left measured glyph height unchanged, so use explicit measured font-size enlargement and distinguish it from actual Android system scaling.
- The first complete 177-journey run exposed a search-reset race: switching Library tabs during Clear's 90 ms animation cancelled the clear and carried the obsolete filter into Playlists. Scope the reset to the shared query and collection context, preserving navigation and newer typing. Add a clock-controlled regression and rerun the complete suite on the rebuilt frozen assets.
