# Android UX refinement after the November 7 recording

Continue `dev.ui-ux-stress-audit` from `f925a42`, retaining the previous physical-phone fixes and version 0.15.0. Commit this plan before implementation. Merge/release remain separate work.

## Review evidence

Reviewed the supplied 6:26 recording using timestamped frames and an offline transcription. Its first four and a half minutes demonstrate Local Music; the final portion demonstrates Samsung Music as the interaction reference. Speech-recognition text is a review aid; visible behavior and the user's written request determine the changes. Private notifications, source audio and full transcripts stay outside Git.

| Recording | Observation and intended change |
| --- | --- |
| 0:11-0:39 | Text/header density is excessive; remove the decorative footer and provide Previous/Play-Pause/Next in the small player. |
| 0:39-1:36 | Touch leaves mouse-like highlights. Player/artwork animations shrink at different rates and stutter. Use touch-appropriate feedback and one coordinated Android surface transition. Preserve hardware keyboard focus. Keep elapsed/total time available with Queue controls. |
| 1:36-2:28 | Center empty collection explanations. Header/tab scrolling clips against the status bar. Make headings smaller and reserve safe areas throughout scrolling. |
| 2:28-3:06 | EQ preset buttons crowd the phone; inactive-band explanations break into narrow columns. Provide a vertical native preset chooser, retain nine frequency labels and one readable sample-rate explanation. Add a restrained bass/mid/treble guide. |
| 3:06-3:58 | Keep Settings usable, add About with the actual runtime version, place Search/Library actions beside the brand on phones, and improve Track Details spacing. |
| 3:58-4:23 | Give visualizer controls adequate spacing. The visualizer modes themselves are accepted; retain their rendering and audio behavior. |
| 4:23-6:26 | Adopt the reference's compact rounded mini-player, clear transport and two-column portrait album grid. Keep Local Music's palette, features and existing navigation contracts. The launcher-logo redesign is a later consideration, as stated in the recording. |

Confirmed after the recording review: **X hides the mini-player while music continues**, retaining queue and position. Provide a discoverable Now Playing entry to restore it. **A-Z navigation belongs to the next pass**; a future rail must use complete-catalog positions rather than substring filtering.

## Implementation boundaries

- React/CSS own this presentation pass. Preserve one interactive overlay, search behavior, queue membership, stable track IDs, playback accounting, privacy, EQ processing and visualizer capture/lifecycle.
- Use an Android density layer instead of reducing WebView zoom or overriding the user's system font scale. Keep readable secondary text and at least 48 CSS-pixel touch controls where layout permits; test narrow/large-text reflow explicitly.
- Reuse a single set of Library actions, moving it into the phone header without duplicate buttons/listeners. Preserve desktop access and keyboard behavior. Sticky elements must account for actual measured header height and Android safe areas.
- Gate mouse hover decoration on hover-capable pointers. Touch should not leave hover/focus frames; keyboard Tab must still reveal the orange focus frame.
- Keep full-screen Android task dialogs. Round cards and the small player without reintroducing floating, cropped task screens. Do not reduce touch targets merely to make the UI look smaller.
- Remove the decorative `LOCAL MUSIC / year` / privacy footer; privacy functionality and explanations remain available in Settings and recap.
- Preserve desktop preset controls; Android's native vertical preset chooser invokes the same existing preset action. Disabled high-frequency bands remain disabled at unsupported sample rates, with accessible explanations.
- Reuse About display content and native runtime version; Android uses a regular full-screen task view and returns to Settings. Windows keeps its existing independent About window.

## Verification and delivery

- Add meaningful browser regressions for phone header placement, compact density, transport/dismissal, touch versus keyboard focus, overlay transitions, safe-area scrolling, centered empty states, two-column albums, EQ preset selection/inactive labels, About return, Track Details and visualizer controls.
- Check 320/390/411 CSS-pixel portrait and short landscape layouts, EN/ES, light/dark, Reduce Motion, keyboard navigation and large text.
- Run frontend checks, the complete browser suite against stable frozen assets, and relevant native/Kotlin gates. Build Windows and ARM64 Android, verifying versions, signature, frozen frontend embedding and packaged/compiled native-library hashes.
- Install the APK in place on the connected Note10+, preserving app data. Verify actual touch, keyboard, native Back, scrolling and representative screen geometry. Keep generated test playback excluded and restore state.
- Record actual results and remaining physical/performance/accessibility gates in `docs/verification.md`; commit the completed pass for review.

## References

- [Samsung Music's tab organization](https://www.samsung.com/au/support/apps-services/manage-tabs-samsung-music/) supports familiar top-level music browsing; the supplied recording is the visual reference for this installed Samsung version.
- [Android accessibility guidance](https://developer.android.com/guide/topics/ui/accessibility/apps) recommends 48 dp touch targets; smaller typography must not make controls harder to tap.

## Implemented scope

- Added a phone presentation layer with smaller typography, two-column album cards, centered empty states and a rounded mini-player. System font scaling remains enabled. Search and Library actions share one instance in the brand header; measured header/tab heights and all four safe areas govern placement and scrolling.
- Added Previous/Play-Pause/Next and session-only Hide. Hide does not call the playback adapter; Library actions → Now Playing restores the player. The queue and listening rules are unchanged.
- Removed the decorative footer. Separated touch feedback from hardware-keyboard focus. Android player transitions use a single opacity transition without independent flying artwork; desktop artwork transitions remain.
- Added the phone preset selector, bass/mid/treble guide and a full-width unsupported-frequency note, retaining the same EQ actions and nine sliders. Added mobile About with the runtime version and return focus, plus Track Details/visualizer spacing. Windows retains its independent About window.
- Fixed issues discovered during verification: landscape controls beneath system navigation, inherited desktop mini-player grid/width limits, crowded song focus frames, oversized playlist subdivision headings, short-window tab overlap and extreme-zoom transport overflow.

Actual test, build and physical-device evidence is recorded in `docs/verification.md`. A–Z navigation and launcher-logo work remain outside this pass. No merge or release is included.
