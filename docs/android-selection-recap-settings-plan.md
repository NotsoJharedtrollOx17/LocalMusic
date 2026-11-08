# Android selection, Recap and Settings refinement

## Delivery

Continue `dev.ui-ux-stress-audit` from `a989ac5`, retaining version 0.15.0. Archive and commit this scope before implementation. This pass does not merge or release.

## Requested behavior

- Put phone track duration in the secondary metadata line instead of reserving a separate column. Use vertical overflow dots on phones, preserving desktop menus and readable unavailable/removed labels.
- Touch-and-hold a song enters selection exactly once, suppressing desktop/browser text and track menus. Put the selected count and Select all prominently at the top, with reachable batch actions and Close. Preserve current collection scope, stable IDs, playback, cancellations, ordinary taps, and accessible keyboard selection.
- Prevent text selection/callouts on app labels, cards and artwork. Keep text entry, caret movement, selection and native editing in inputs/textareas/contenteditable controls usable. Preserve desktop keyboard/context editing.
- Give phone icon buttons an immediate rounded background only while pressed, cleared on release/cancel. Keep keyboard focus frames distinct from pressed feedback. Library tab indication must follow only the selected tab, including swipes into Playlists.
- Add breathing room below Your playlists. Preserve all creator drafts and saved playlists.
- Keep Recap period changes stable, with no poster reseeding flash or collapse/re-expansion of content. Do not display old totals as confirmed data for a new period; preserve same-period refreshes and stale-response/privacy checks. Place the origin/counting disclaimer after the Top 10, and give Export image a coherent compact position.
- Give Organize library, Listening history and About the same section-heading hierarchy as Language and Theme. Present phone navigation rows and history controls with clear actions and spacing. Rework Organize library into a guided phone flow: clear purpose per tab, compact lists, one focused artist editor, readable match review and reachable confirmation/cancel. Keep conservative identity rules and all persistence/Undo behavior.
- Hide the visible Now Playing header label on phones while retaining the dialog's accessible name and its controls.

## Implementation boundaries

React/CSS own this pass. Do not change playback, audio processing, native journals, recommendation or identity rules, history, stored links or source files. Reuse current overlays/focus restoration; Settings returns and nested editing must remain one interactive layer. Native Android form pickers remain available.

Input policy follows the distinction between text selection and pointer interaction in [MDN user-select](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/user-select) and [contextmenu events](https://developer.mozilla.org/en-US/docs/Web/API/Element/contextmenu_event). Check the actual WebView rather than inferring long-press behavior from mouse-driven tests.

## Verification

- Add focused real-touch browser regressions for early/late context-menu timing, selection/Select all, cancellation, label selection prevention, editable text, press/release/cancel feedback and exactly one highlighted Library tab.
- Test delayed/rapid Recap changes and stable geometry, disclaimer placement, exports, Settings hierarchy/returns and phone organization editing/review in EN/ES, themes, narrow/landscape and enlarged text.
- Run frontend checks, complete browser coverage and relevant Rust/Kotlin gates. Freeze frontend assets during browser/native runs; build Windows and ARM64 Android and verify versions, signature and packaged library hashes.
- Install in place on the authorized Note10+, exercise actual touch/Back/pickers and capture evidence without altering music/history/links. Preserve phone settings and paused queue. Record actual results and remaining background/performance/TalkBack/Windows gates in `docs/verification.md`.

## Paused checkpoint - 8 November 2026

Paused at the user's request because the phone is leaving. The specification was committed as `4912517`; implementation edits and new tests remain preserved in the working tree on `dev.ui-ux-stress-audit`. No new APK was installed for this pass. The phone still has the preceding `a989ac5` build; no merge, release or version change occurred.

- Implemented in the working tree: inline phone durations and vertical overflow; touch/pen hold selection with early/late context-menu handling; complete scoped Select all; prominent selection header; nonselectable app labels with editable inputs; explicit transient pointer feedback; immediate single-tab indication; playlist spacing; stable Recap loading/poster drawing and bottom disclaimer; compact phone player header; consistent Settings sections; and phone artist-edit / song-album review flows.
- Latest frontend production build and **111 unit tests passed**. The latest focused browser invocation collected 33 journeys but was stopped on request: five completed passes (selection/pagination, row/tab layout, pressed feedback, disclaimer/player header, desktop song menus) and one Settings-flow timeout are recorded before cancellation. The Settings timeout occurred while clicking the Settings menu item, with a long execution-time gap; its cause is not established. Do not treat the interrupted run as full acceptance.
- First resume step: inspect `artifacts/android-selection/browser-reviewed.log` and its Settings error context/trace, rerun that flow, and inspect the phone organization review/focus behavior. Finish the affected Recap, identity, editor and mobile regressions, then the complete browser suite. Preserve frozen frontend assets throughout native/browser checks.
- Native builds, Rust/Kotlin regressions, signature/hash verification and installation of these new edits are **pending**. Fresh physical checks must cover text holds on headings/rows, press/release/cancel feedback, selection/Select all, tab indication, timeframe transitions, Settings returns and organization review. Do not infer device acceptance from browser results.
- Baseline native evidence is under ignored `artifacts/android-selection/hold-before.*`: the sampled hold entered selection without a menu, so the reported menu symptom was not reproduced on that attempt. No playback, organization write or history deletion was performed. The phone disconnected before inspection-forward cleanup; remove only this pass's port 9228 forward and `/sdcard/local-music-selection.png` / `.xml` when it is available again. Development evidence/tools stay outside Git.
