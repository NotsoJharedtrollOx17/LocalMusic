# UI/UX polish after v0.2.0

Approved 10 October 2026. Implement on `dev.ui-ux-polish`, branched from `dev` at `342289f`. Preserve `main`, release tags, reference images, typography, and the orange/charcoal palette.

## Recording inventory

Reference: `2026-10-10 15-49-44.mp4`, Windows recording, 2:10.90. Times are approximate visual observations, not audio measurements.

| Evidence  | Issue                                                                                                |
| --------- | ---------------------------------------------------------------------------------------------------- |
| 10s / 85s | Alternating Left/Right faders crowd values and overlap Spanish ear labels.                           |
| 15–23s    | Preamp is misaligned; scrolling removes the title and close control.                                 |
| 48–52s    | Queue covers Sound controls: two modal surfaces compete.                                             |
| 65–85s    | Different sound values appear after changing language; cause unconfirmed.                            |
| 104–128s  | Search repeats dismissal controls and starts blank; playlist creation has competing scrolling areas. |

Use `.AGENTS/Codex-UX-UI-Design-Reference.md`: spatial stability, distinct operation states, consistent controls, realistic localized content, keyboard/focus and Reduce Motion.

## Sound controls

- Stack ten Left frequencies above ten Right frequencies; channel headings appear once, with no ear selector buttons. Reuse the arrangement for saved and provisional curves.
- One independent vertical preamp sits beside both banks. Align labels, track lengths, zero positions and values. Below an 800px viewport use horizontal labeled rows grouped by channel.
- Derived personal gains are readable, accessible, read-only displays. Preserve full-strength profiles, per-channel processing, limiter and tone limits.
- Personal profiles retain priority: standard presets stay unavailable until explicitly disabling the profile. Collapse inactive controls behind a disclosure; prominently identify the active profile.
- Keep activation and creation visible; move Rename, Retest and Delete into the existing menu pattern. Standardize rounded-square buttons, spacing, focus and hit areas.
- Distinguish saved, effects off, ready, active and bypass states. Preset/profile changes preserve preamp.

## Navigation, state and localization

- Only the top modal surface is visible and interactive. Suspend parents, retain view/scroll and restore origin/focus on return. Headers and close controls remain reachable while bodies scroll.
- Escape, Back, backdrop dismissal and focus trapping belong to the visible layer. Hidden EQ cannot receive pointer/keyboard input.
- App-scoped sound ownership survives dialog transitions. Serialize writes/actions, flush final edits, and reject stale reads/acknowledgements.
- EN ↔ ES translates presentation only: gains, preamp, stable preset/profile IDs, enable flags and playback do not change. Investigate recorded differences with delayed-response regressions.
- Correct singular/plural counts, including `1 canción`.
- Search has one responsive dismissal control and useful initial/loading/error/no-result states. Align queue actions; name the player's menu opener Actions rather than Track details.
- Playlist creation uses a bounded list and reachable Save action.
- One component per TSX file. No persisted schema or public MusicApi changes expected.

## Verification

Baseline production build and 23 frontend tests passed before edits. Add regressions for language parity, delayed responses, close/reopen during writes, profile priority, unchanged preamp, modal return/focus and setup cancellation.

Inspect English/Spanish, light/dark, long names, mobile, windowed/maximized Windows, 200% zoom and Reduce Motion. Require no overlaps, readable values and reachable controls.

Run `npm.cmd run check`, browser journeys, Rust core tests and Windows native checks/build. Exercise actual Windows flows; record results and unresolved gates in `docs/verification.md`. Browser success is not Android runtime evidence. Leave changes on the feature branch for review.

## Implementation decisions

Implemented stacked channel banks with one independent preamp rail. Profile displays retain slider semantics and disabled/read-only behavior with explicit orange styling, avoiding the native disabled-grey appearance. Inactive preset selection is neutral, and management uses the existing anchored menu.

`SoundStateController` owns a serialized mutation queue and read revisions, with `useSoundController` at app scope. The player stays mounted but hidden/inert while a child surface owns focus and Back. Ordinary dialogs retain parent body scroll on return; header and body scrolling are separate. No DSP, MusicApi, catalog, history or storage schema changes.

Native inspection uses the actual Windows WebView2 renderer and Rust adapter through a temporary localhost debugging connection. It does not establish audible output, physical screen-reader behavior or Android acceptance. See the dated verification entry for actual results and remaining gates.

## Screenshot follow-up: Library and EQ ordering

- Move the orange Import music action below Library tabs, replacing the duplicate plus shortcut. Move selection and Favorites filtering into the anchored Library actions menu.
- Make Your Year the final Library tab, including swipe, keyboard navigation and per-tab scroll retention. Remove the separate recap destination and redundant mobile destination bar; keep the compact player at the bottom.
- Remove the preamp-only Reset. Retain EQ Reset (bands only, preserving independent preamp) and Bypass all immediately below the faders without a separating rule. Keep the rule separating presets from faders.
- Preserve recap history/export, personal-profile priority, DSP and persistence semantics. Verify desktop/mobile and bilingual navigation, menu access, independent preamp and existing browser journeys.

- Follow-up regression: anchored menus ignore queued opener-reveal scroll events with unchanged bounds; actual anchor movement still dismisses them.

## Header and player resize follow-up

Remove the sidebar and duplicate mobile header. Place the existing logo above Library, with the localized shield motto alongside it, and replace the heading overflow menu with the same Settings icon used previously in the sidebar. Keep selection/Favorites in a collection toolbar menu and playlist detail actions. Fit the square player artwork to measured remaining body height after the fixed header/transport/footer and title, observing resize and text changes. Preserve scroll access for extremely short windows and long titles.


## EQ controls simplification

Remove Bypass all from the sound UI. Replace the small regular EQ checkbox with a labeled orange switch, at least 44px high, with visible focus and native keyboard/screen-reader semantics. Persist the existing enabled flag immediately; switching off retains gains, preamp and selected preset. Personal-profile priority and activation continue through their existing controls. Retain backend bypass handling for internal lifecycle/processing compatibility.
