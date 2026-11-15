# Windows UI responsiveness and consistency — 15 November 2026

User-authorized audit and corrections on `dev.desktop-ui-stability`, based on `dev` at `77beb88`. Keep version 0.18.0 and leave the work for review, without merging or releasing.

- Inspect the actual Windows Library, search, grouped collections, playlists, Settings, menus, embedded player and detached Player/Queue, Equalizer and Visualizer. Check mouse, keyboard/focus, resize, zoom, EN/ES, light/dark and Reduce Motion.
- Reproduce sluggishness, layout defects and inconsistent interaction before correcting them. Preserve the approved orange focus frames, playback/accounting, privacy, settings ownership and the accepted Android flow. Prefer narrowly scoped Windows presentation changes.
- Use a separate, explicitly identified synthetic native profile for mutating UI tests. Never replace or seed the user's real library. Capture actual native-window screenshots as well as browser evidence, with synthetic tracks clearly identified in the report.
- Measure cached navigation, press feedback and local menu response against the same baseline fixture; distinguish browser timings from actual Windows evidence. Verify first-click behavior after navigation, menu dismissal/focus return, Queue actions, detached window lifecycle and readable controls at constrained/large sizes.
- Archive before/after screenshots and a concise audit report under ignored artifacts, and link the final evidence for later user inspection. Record concrete defects, fixes, measured results and remaining manual/runtime gates in `docs/verification.md`.
- Run frontend checks, relevant regressions and the complete browser suite. Build Windows and inspect the final native UI; use native/core tests for relevant rule or bridge changes. Shared changes must retain Android layouts; rebuild Android only if its shipped UI changes. Commit the reviewed implementation and evidence report on the feature branch.
