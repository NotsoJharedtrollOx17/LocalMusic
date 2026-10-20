# Contextual menu UX revision

19 October 2026. **Status: implemented on `dev.context-menu-ux`; review pending.** Platform verification and remaining gates are recorded in [verification](verification.md).

## 1. Goal and branch

Reduce repeated actions and make menus describe the object or page they belong to. Preserve the orange/charcoal palette, typography, compact Library navigation, working filters, sound controls and playback behavior.

- Baseline: `dev` at `c3c8265` (`v0.4.1`). The working tree was clean before this review.
- Planning branch: **`dev.context-menu-ux`**, created from `dev`.
- The original planning commit `af3a3d9` changed documentation only. The user subsequently authorized the implementation below. Application versions, native contracts and persisted schemas remain unchanged.
- Leave the implementation on this branch for review before integration into `dev`. Preserve `main`, existing tags, recordings and the four source reference images.

The menu decisions here supersede earlier menu inventories in [phase two](phase-two-ux-flow.md) and [Library navigation](library-sound-navigation.md) only where stated. Other product requirements remain applicable.

## 2. Evidence and interpretation

### Recording reviewed

Source: `C:\Users\abrah\Videos\OBS_Recordings\2026-10-19 20-40-56.mp4` (65.56 seconds, 1920 × 1080). Inspected a contact sheet at two-second intervals and full-resolution song-menu frames. Its audio stream measured approximately -91 dBFS throughout; this review uses the visible interactions and the written request, without attributing spoken instructions to it. Source files were not modified. Diagnostic images are ignored local artifacts under `artifacts/context-menu-review/`.

Times below are approximate; the review establishes visible behavior, not the physical mouse button used.

| Evidence                      | Observation                                                                                                                                         | Consequence                                                                                                                         |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| About 6–20 seconds            | The song menu has nine rows: Play, Favorite, Track details, Albums, Artists, Add to playlist, Save audio copies, Select songs, Remove from Library. | Three entries duplicate controls or selection entry points already available elsewhere; the remaining entries need a clearer order. |
| About 28–34 seconds           | A background menu offers Library, Your Year, Search your library, Settings and Close.                                                               | The menu repeats navigation and introduces a second page-action vocabulary. Close just dismisses the menu.                          |
| About 38–42 and 60–62 seconds | The song menu appears again at different positions; it remains tall relative to the app window.                                                     | Reduce content before altering dimensions; preserve safe positioning near viewport edges.                                           |
| About 46 seconds              | The generic background menu is also present over Your Year.                                                                                         | It is a document-wide fallback, not a dedicated collection menu.                                                                    |
| About 48–54 seconds           | Playlists and its cards receive the same generic menu.                                                                                              | Their context is lost; global navigation should not masquerade as playlist actions.                                                 |

The recording does not establish the full album/artist menu behavior. That inventory below comes from the current source. The Samsung action lists in the request are user-supplied references, not independently recorded capability requirements for this app.

### Source inventory

| Surface / owner                     | Current behavior                                                                                                                               | UI smell or constraint                                                                                                                                                                    |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/TrackActionMenu.tsx`       | The same nine actions for Library, search, collection tracks and player actions.                                                               | Play/Favorite duplicate primary controls. Select songs dismisses overlays, closes the group and forces the Songs section. Albums/Artists use plural tab labels for singular destinations. |
| `src/components/TrackRow.tsx`       | Row hit area plays; heart changes Favorite; overflow and right-click open track actions; touch hold enters selection.                          | Overflow is named Track details even though it opens an action menu. Visible controls already provide the first two menu actions.                                                         |
| `src/app/LibraryActions.tsx`        | Header menu: Edit, Sound options, Settings. Edit is disabled when its selection scope is unsupported.                                          | It is a useful shared page menu. Edit needs a precise selection scope and distinction from editing a playlist.                                                                            |
| `src/app/AppContextMenu.tsx`        | Document-level right-click menu; optionally Open on album/playlist cards, text actions, global navigation and Close.                           | A text editor, blank background and collection card inherit unrelated actions. Open repeats direct card activation.                                                                       |
| `src/app/LibraryPage.tsx`           | Album/artist cards open collection details. Details show title in the page heading and again in the hero. Artist detail switches Songs/Albums. | No dedicated card editing capability. The object should lead the detail screen without two copies of its title.                                                                           |
| `src/app/LibraryFilters.tsx`        | Songs-only Favorites and title/artist/album ordering.                                                                                          | Intentional filter controls, already separated from Edit. Preserve them.                                                                                                                  |
| `src/app/PlaylistDetailHeading.tsx` | Saved playlist Edit/Save changes its membership/order; automatic collections do not expose this editing action.                                | This differs from header Edit, which selects tracks. Avoid giving these two operations the same unqualified name.                                                                         |
| `src/app/PlayerDialog.tsx`          | Visible transport, heart, Track actions; queue rows have explicit reorder/remove controls.                                                     | Removing repeated track-menu actions must not remove these primary controls or change queue semantics.                                                                                    |
| `src/ux/ActionMenu.tsx`             | Shared fixed-position menu, arrow/Home/End keys, Escape/Back, outside-click dismissal, focus restoration; each caller owns open state.         | Keep the shared visual primitive. Coordinate ownership and focus handoff so opening a child dialog or another menu cannot create conflicting layers.                                      |

`MusicApi` supports playlist addition, library visibility, audio sharing, collection lookup and playback. It has no metadata editor, custom album-cover persistence or ringtone/notification assignment command. “Edit” in this revision means selection of songs, not modification of embedded tags.

## 3. Design direction

Apply the repo's [UX reference](../agents/Codex-UX-UI-Design-Reference.md), especially spatial stability, coherent controls, progressive disclosure, realistic localized labels and truthful outcomes. Retain the original [development guide](../agents/Music-Player-MVP-Recap-Codex-Guide.md)'s ownership and original-design boundaries.

Choose **object actions in the song menu, page actions in the header, and text actions in editors**. Consistency means common styling, action meanings, ordering and interaction behavior; different objects can have different useful actions.

Alternatives considered:

1. Keep every menu and only restyle it: leaves duplicate routes and the selection jump intact.
2. Copy every Samsung entry: requires unsupported file-editing and platform features, increasing scope and clutter.
3. Use the app's existing capabilities with a smaller, scoped menu system: **selected direction**.

No additional submenu, icon column, section heading or card overflow button is needed for this revision. Retain the current header opener icon and menu styling unless actual visual checks identify a concrete defect.

## 4. Proposed menu contract

### 4.1 Song actions: nine rows become six

Use the same ordered actions for overflow click, right-click and keyboard context invocation on the same track:

| Order | English                       | Spanish                                  | Meaning                                                                                                             |
| ----- | ----------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1     | Add to playlist               | Añadir a una lista                       | Open the existing playlist picker for this track. Keep this destination explicit rather than ambiguous “Add.”       |
| 2     | Share audio / Save audio copy | Compartir audio / Guardar copia de audio | Use the existing platform capability and outcome rules; singular wording for one track, plural for bulk operations. |
| 3     | Track details                 | Detalles de la canción                   | Open the existing metadata display.                                                                                 |
| 4     | Go to album                   | Ir al álbum                              | Open this track's resolved album, preserving its identity and native ordering.                                      |
| 5     | Go to artist                  | Ir al artista                            | Open this track's resolved artist.                                                                                  |
| 6     | Remove from Library           | Quitar de la biblioteca                  | Open the existing confirmation; preserve original files/history and Undo/reimport behavior.                         |

Keep removal last, separated by a small gap or one subtle rule, with the existing danger treatment. Do not add descriptive paragraphs inside the menu. Use stable internal action IDs rather than translated strings as identity.

Remove these menu rows and preserve these entry points:

| Remove from song menu | Remains available through                                                                                                                             |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Play                  | Song hit area/artwork and player transport. Audit every track-action caller so its primary playback remains reachable by pointer, touch and keyboard. |
| Favorite              | Row/player heart and existing details/bulk actions. The heart remains visible and accessible in narrow layouts.                                       |
| Select songs          | Header Edit and existing touch selection. Edit acts on the current track collection rather than redirecting to Songs.                                 |

Availability rules:

- Omit Go to album/artist when identifying metadata is absent. Omit a destination that is already the current collection; keep the relative order of remaining actions.
- Keep details usable for unavailable/hidden tracks. Disable source-dependent sharing when the source is unavailable, with a concise accessible reason. Disable duplicate sharing while a request is pending.
- For a track retained only by current playback after library removal, omit another Remove action; respect the existing hidden-track rules for addition and navigation. Do not invent a restore API or silently reimport it.
- Menu items derive from a fresh track snapshot and the current view context. Do not retarget an already-open menu when playback changes to another song. Revalidate availability before executing a delayed action.
- Keep the same membership/removal semantics inside a playlist: **Remove from Library** is not **Remove from playlist**. The latter remains in the existing playlist editor; queue removal remains a separate queue operation.

### 4.2 Page actions: one header pattern

Keep the existing header route to **Edit → Sound options → Settings** when a selectable track list is displayed. On views without track selection, omit Edit rather than showing a permanently unavailable action. Sound options retains its Equalizer/Adapt Sound hub; Settings retains language, appearance and listening-history controls.

| Page context                     | Header menu                   | Edit scope                                                                                    |
| -------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------- |
| Songs                            | Edit, Sound options, Settings | Current Songs view and its existing filter/query, without resetting sorting or scroll.        |
| Album details                    | Edit, Sound options, Settings | Songs belonging to this album; no change to track/disc ordering.                              |
| Artist details: Songs view       | Edit, Sound options, Settings | Songs belonging to this artist.                                                               |
| Artist details: Albums view      | Sound options, Settings       | No song list is displayed; do not switch tabs merely to enable Edit.                          |
| Albums/Artists overview          | Sound options, Settings       | Bulk album/artist selection is not implemented in this revision.                              |
| Saved/automatic playlist details | Edit, Sound options, Settings | Select songs in this collection; automatic collection membership stays derived and read-only. |
| Playlist overview / Your Year    | Sound options, Settings       | No selectable track list.                                                                     |

In an empty track list omit Edit; during a known temporary refresh, preserve the open menu's structure and disable execution until its scope is valid. Once selection is active, use a clear localized exit label such as **Done selecting / Terminar selección**, and retain the visible close control in the selection toolbar.

Name the separate saved-playlist operation **Edit playlist / Editar lista** and its completion **Save playlist / Guardar lista**. While that editor is active, omit header selection entry so two editing modes cannot compete. This is a wording/state clarification, not an expansion of playlist editing.

Selection remains based on the existing visible-song model. Do not silently expand “Select visible songs” to unloaded pages. Preserve selected track IDs through opening/dismissing an action dialog; clear them only through the existing explicit exit or completed operation rules.

### 4.3 Remove the generic background navigation menu

- Stop opening an app-navigation menu on blank space, tabs, decorative artwork and collection cards. Remove its Library, Your Year, Search, Settings, Open and Close entries. These destinations retain visible navigation, Search and header controls.
- Album/artist/playlist cards keep direct click, Enter and Space activation. A secondary click on these cards must not unexpectedly open them, enter selection or change the current view. Do not introduce a one-item menu just to repeat Open.
- Preserve the app's native-shell policy against exposing a browser/debug context menu; suppress that fallback on noneditable app surfaces without creating an empty application menu. Do not broaden shortcut blocking.
- Keep contextual text editing separate: Copy, Cut, Paste, Select all text, according to selection/read-only/clipboard availability. For selected noneditable text, offer Copy only. No global navigation or redundant Close entry in text menus.
- Retain clipboard failure handling, React-controlled field updates, keyboard shortcuts and IME behavior. Empty noneditable text/background has no menu.

This explicitly removes the existing document-wide fallback. Header page actions are the discoverable entry point on every Library tab; card menus are not required for visual consistency.

### 4.4 Album and artist presentation

Keep the cover and collection metadata at the forefront of the detail view, using one meaningful title. Consolidate the repeated page/hero title into an accessible collection heading; retain Back and the header Search/actions at predictable positions. Center the compact hero within the content area where space permits; stack it on narrow layouts without shrinking text excessively.

Album details show existing cover, title, artist and known year/count; artist details retain the Songs/Albums switch. Show only available metadata. Do not add decorative labels or a second title to imitate the reference.

The Samsung examples inform hierarchy and restraint. Defer **Change cover image**, tag editing and **Set as** to separately specified capabilities with persistence/platform behavior. Do not expose disabled placeholders for these unimplemented features or label selection as metadata editing.

## 5. Interaction, state and visual requirements

### Common menu behavior

- One menu open at a time, even across header, row, filter and text entry points. Opening one closes the previous menu without activating its underlying control accidentally.
- A menu is a temporary layer over its origin. It must not coexist with another interactive menu or an unrelated dialog. Close the menu before handing focus to a dialog/navigation destination; suspend the originating modal where applicable.
- Escape/Android Back dismisses the visible menu first; it must not also close the player/search or leave the collection. Outside click, window blur and moving/disappearing anchors dismiss safely. Reopening uses the current object and viewport.
- Enter/Space opens an overflow button, arrow keys navigate items, Home/End reach boundaries, Escape restores the opener. Support Shift+F10/the context key on track targets. Tab exits the menu without a focus loop or a forced return that cancels the user's traversal.
- Follow the [WAI-ARIA menu-button pattern](https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/) and [menu keyboard guidance](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/) (reviewed 19 October 2026); validate the integrated implementation with actual keyboard use. Use appropriate roles, expanded state and focus management.
- Rename row overflow accessibility text to **Track actions / Acciones de la canción**, including the track title where needed. Only the actual details command is named Track details. Keep opener accessible names and `aria-haspopup`/`aria-expanded` correct.
- Focus restoration must distinguish dismissal from navigation: return to the opener on Escape; allow the destination dialog/heading to retain focus after a command. If a virtualized row disappears, use a stable collection fallback. Parent surface scroll and search input/results survive a dismissed child dialog.

### State and failure handling

- Capture object IDs and scope, not only a mutable DOM node or translated label. Clear pending menu state when switching tabs, changing the collection, deleting its anchor or opening another surface.
- Check async navigation against a request generation/target ID so a delayed album lookup cannot override a newer user action. Keep all album/artist IDs and grouping rules owned by the current backend.
- Addition/removal use existing confirmation, error and Undo flows. Cancellation leaves data and playback unchanged. Sharing reports chooser opened, copy saved, download started or cancellation accurately; Windows save-copy behavior must not be presented as a completed OS share.
- Do not restart, seek, pause or replace the playback queue simply because a menu opens, a row is selected or a collection is browsed. A successful explicit removal keeps the existing queue cleanup behavior. No menu operation fabricates listening time or changes recap coverage.

### Visual checks

Reuse existing menu width, rounded corners, border, focus treatment and 44px control targets. Shorten content before changing spacing. Keep menus inside the viewport and allow local scrolling only when necessary. Verify long track/album names and Spanish labels without clipping, competing scrollbars, focus obstruction or collision with the mini-player. Keep reduced-motion behavior and light/dark contrast.

## 6. Implementation sequence and file map

1. **Define action scope and availability.** Add focused non-TSX helpers for song/page action definitions as needed. Replace the track-only open-state shape with a focused menu owner/context model, or centralize coordination of existing owners. Keep state small and do not expand `App.tsx` into a menu controller.
2. **Trim track actions and correct labels.** Update `TrackActionMenu.tsx`, `TrackRows.tsx`, `components/TrackRow.tsx`, `SearchOverlay.tsx` and `PlayerDialog.tsx`. Use context to omit redundant destinations; preserve primary playback/heart controls.
3. **Consolidate page and text menus.** Update `LibraryActions.tsx` and `AppContextMenu.tsx`; preserve `LibraryFilters.tsx`'s useful scope and controls. Reuse `ux/ActionMenu.tsx` and `navigation.ts` for positioning, active-layer handling and keyboard behavior. Audit focus cleanup during command execution.
4. **Clarify collection/playlist context.** Update `LibraryPage.tsx`, `PlaylistDetailHeading.tsx` and relevant selection state in `useAppState.ts`/`useMusicApp.ts`. Avoid metadata duplication and distinguish playlist editing from track selection. Keep existing catalog read/request guards and native album ordering.
5. **Localize and verify.** Add English/Spanish action keys in `i18n.ts`; use `ux/sharing.ts` for platform-aware copy. Update focused tests and record actual results in `docs/verification.md` when implementation occurs.

Keep one component per TSX file. Proposed helpers should have narrow responsibilities; there is no need for a generic command framework or additional dependency. No Rust/Kotlin/domain/schema/public `MusicApi` changes are expected for the selected scope. If implementation reveals a missing native capability, record it and separate that feature rather than adding a nonfunctional menu item.

## 7. Verification for implementation

### Behavioral regressions

- Song overflow/right-click/Shift+F10 produce equivalent supported actions for the same object. Assert removal of Play/Favorite/Select songs from this menu while primary controls still work.
- Album/artist navigation resolves the correct grouping, including same-named albums by different artists, absent tags and track/disc ordering. Returning preserves originating scroll and focus.
- Header Edit selects within Songs, album, artist and playlist contexts without a jump to Songs. Test filtered Songs, empty/loading lists, unloaded pages and automatic collections.
- Saved-playlist editing remains distinct from track selection. Queue removal, playlist membership removal and Library removal never substitute for one another.
- Removal confirmation/cancellation/Undo/reimport preserve files and history; sharing cancellation/failure prevents false success and duplicate operations.
- Background/card secondary clicks do not show global navigation, invoke the card or expose native debug menus in the Windows app. Text-menu copy/cut/paste and clipboard-denied feedback remain functional.
- Open header → row → filter/text menus rapidly: only one visible menu, correct object, no click-through. Cover delayed group reads, changed language, removed/virtualized rows and playback advancing to another song.
- Search/player → track actions → details/add/remove → cancel/return: one interactive modal and correct origin, focus, input and scroll. Escape/Back closes one layer per action.

### Existing test files to revise

- `tests/browser/context-menu.spec.ts`: replace the old nine-action/global-navigation expectations with the reduced song menu and absent-background-menu checks; preserve editor coverage and edge positioning.
- `tests/browser/navigation-polish.spec.ts`: context-sensitive header Edit, unchanged Sound options/Settings routes and focus return.
- `tests/browser/phase-two.spec.ts`, `settings-feedback.spec.ts`, `journey.spec.ts`: update overflow opener labels and singular navigation commands while retaining useful selection/grouping/sharing/removal journeys.
- `tests/browser/collection-controls.spec.ts`, `automatic-playlists.spec.ts`: verify filters, favorites and derived collection behavior remain usable.
- Add small unit coverage only for meaningful action-availability/context rules, not snapshots of JSX or implementation details.

### Visual and platform acceptance

Inspect EN/ES, light/dark, long/missing metadata, desktop/maximized/short Windows windows, narrow mobile, 200% zoom and Reduce Motion. Verify keyboard and screen-reader names, reachable actions, viewport edges and the absence of overlapping menus/labels. Review both available and unavailable source files, live playback and paused/stopped states.

Run `npm.cmd run check` and `npm.cmd run test:browser` after implementation; run Rust core tests using `npm.cmd run test:core` for the unchanged domain regressions. If native code must change, add the affected native tests. Build and inspect the actual Windows app for the recorded menu flows, save-copy dialog and native context-menu suppression. Build Android for the shared UI change; exercise touch/Back/share on an available emulator/device and state any unavailable runtime gate explicitly. Browser evidence establishes browser behavior only. Releasing, version changes and tags require a separate release task.

## 8. Original planning verification

Completed for this planning deliverable:

- Reviewed the supplied recording, source menu/selection/navigation/sharing rules, existing browser tests, implementation guide and UX guideline.
- Created the focused branch from the released `dev` baseline.
- Saved this specification; checked Markdown formatting, relative local links and the documentation-only diff.

At the planning commit, application changes and implementation acceptance checks were pending. The follow-up implementation and actual verification are recorded below and in [verification](verification.md).

## 9. Implementation record

- Reduced song actions to Add to playlist, platform-appropriate Share/Save audio copy, Track details, Go to album, Go to artist and Remove from Library. Unavailable/hidden tracks and the current collection determine which actions can run or are omitted. Play, Favorite and selection retain their primary controls.
- Removed the generic background/card navigation menu while preserving text editing and native browser-menu suppression. Shared menu ownership coordinates header, track, filter, text and profile menus; stable action IDs, explicit disabled states, focus handoff, outside-click consumption and scope-change dismissal prevent competing interactions.
- Header Edit selects within the current loaded track collection; Done selecting exits it. Unsupported/empty contexts omit Edit. Saved-playlist membership/order editing uses Edit playlist and Save playlist, separately from track selection.
- Consolidated each album/artist detail title into a centered, responsive hero. Collection navigation retains its originating tab, scroll position and recreated opener focus target; delayed reads cannot replace a newer navigation choice.
- Added English/Spanish labels and targeted unit/browser regressions. Retained file/history preservation, Undo, queue semantics, filters, playback, EQ processing and personal-profile priority. No new capability or dependency was added.
- Windows and ARM64 development builds retain version 0.4.1; they are unreleased feature-branch builds. Browser, native Windows and package evidence have separate scopes. Android device/emulator runtime and physical-device accessibility/performance acceptance remain pending; see the dated verification entry for exact results and limitations.
