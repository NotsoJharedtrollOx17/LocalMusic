# Native Windows menu bar

Approved 1 November 2026. Branch: `dev.desktop-menu-bar`, from clean `dev` at `5b68494`. Keep version 0.13.0; commit for review. Integration and release require a subsequent request.

## Delivery and approach

Add an always-visible native Windows menu bar to the main Library window only. Detached windows retain their compact controls; Android and browser preview retain their current interface. Archive and commit this plan before implementation.

The organization follows [Microsoft menu guidance](https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/menus-and-context-menus), using [Tauri window-specific menus](https://v2.tauri.app/learn/window-menu/) and Windows colors, fonts and keyboard conventions.

## Menu contents

| Menu | Entries, in order |
| --- | --- |
| File | Import music… · New playlist… · separator · Settings… · separator · Exit |
| Library | Songs · Albums · Artists · Playlists · Your Recap · separator · Search current view |
| Playback | Play/Pause · Previous · Next · separator · Shuffle · Repeat → Off / All / One |
| Window | Now Playing · Queue · Open Now Playing in separate window · separator · Visualizer · Equalizer |
| Help | Help and keyboard shortcuts… · About Local Music… |

- Translate all entries into Spanish, including Archivo, Biblioteca, Reproducción, Ventana and Ayuda.
- Check the active tab, Shuffle and Repeat. Play/Pause reflects authoritative playback state.
- Reuse manual playlist creation and scoped search; search is disabled in Your Recap.
- Now Playing and Queue open embedded unless already detached; an existing detached player switches to the requested view and receives focus. Visualizer and Equalizer preserve separate-window behavior.
- Preserve approved track menus and privacy/removal ordering.
- Bundle local Help with actual shortcuts; About shows the runtime version and concise description.

## Integration and interaction

- Rust owns the main-window menu, validates fixed IDs and handles Exit through normal shutdown. React dispatches presentation commands through existing controllers.
- Add a Windows-only readiness/command/revisioned-state contract. Subscribe before enabling commands. Detached windows cannot publish main-menu state.
- Update existing items on meaningful state changes, without rebuilding on playback polls.
- Disable unavailable playback/visualizer commands. Equalizer works without a track. Prevent conflicting dialogs/import/navigation and revalidate eligibility at dispatch.
- Add Ctrl+O (Import), Ctrl+N (New playlist), Ctrl+F (Search), Ctrl+, (Settings). Preserve scoped Space and /, editing, zoom and native Alt/F10 behavior.
- After native-menu readiness, the Windows Library actions icon retains only useful Edit/selection actions; hide it when empty. Retain full existing contents if initialization fails.
- Dismiss contextual menus safely; reuse focus restoration and one-overlay behavior.
- Fix already-detached Queue/Now Playing routing without duplicate windows.
- No MusicApi, persistence schema or listening-accounting changes.

## Verification

- Cover dispatch, initialization failure/retry, availability/checkmarks, localization and subscription cleanup.
- Exercise every entry: import cancellation, playlist creation, search, Settings, playback failure, detached Queue switching, Help/About and Exit.
- Inspect actual Windows Alt/F10, shortcuts while typing, focus, light/dark/high contrast, narrow windows and high zoom.
- Confirm companion windows lack the bar and Android/browser retain existing controls.
- Run frontend checks, full browser suite, Rust core/native and Kotlin tests. Build Windows and ARM64 Android; verify metadata, signatures and embedded assets.
- Record actual evidence in docs/verification.md, separating native interaction, Android runtime and manual accessibility from automated/build results.

## Approved refinements - 1 November 2026

- About Local Music opens one independent, non-modal Windows information window. Repeated activation focuses it; Close/Escape dismisses it, and main shutdown closes it. It follows language/theme without mounting the Library or playback controller. Other main-window actions remain available.
- The Library Settings icon retains all its original contextual Edit, Equalizer and Settings entries on Windows too. The native bar is an additional route to those actions.
- Native-menu Library navigation keeps the existing sliding transition without programmatically focusing a tab or leaving a keyboard outline. Ordinary keyboard Tab/arrow focus remains visible.
