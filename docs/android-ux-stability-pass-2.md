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
