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

Two optional product details were asked asynchronously: whether the mini-player X pauses and hides or only hides; and whether the A-Z jump rail belongs in this pass. Record the response before implementing dependent work. A genuine A-Z rail must use complete-catalog positions, not pretend substring filtering is alphabetical navigation.

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
