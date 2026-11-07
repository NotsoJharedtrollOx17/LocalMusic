# UI/UX stress audit before Android acceptance

Requested 6 November 2026. Branch: `dev.ui-ux-stress-audit`, from `dev` at `efc244b` (v0.15.0). Keep the application version unchanged; review fixes on this branch before a subsequent integration or release request.

## Approach

Audit the shared React interface on PC, then exercise the same interactions at mobile and landscape sizes. Treat Windows/browser evidence as shared-interface coverage; Android native runtime, system Back, file permissions, background playback and device accessibility require their own evidence.

Use isolated test catalogs. Preserve the user's music, ordinary profile, source metadata, playback accounting and the four reference images. Document reproducible findings, severity, fixes, screenshots and actual verification results.

## Coverage

| Area | Stress cases |
|---|---|
| Startup/import | Empty catalog, incremental import, cancellation, unavailable files, loading/error recovery |
| Library/search | Rapid tab and collection changes, delayed reads, clear/close, pagination, artist subviews, original focus/scroll restoration |
| Playlists | Delayed opening, manual create/edit/save/cancel, filtered positions, rename/delete, generator changes and feedback |
| Player/Queue | Rapid actions, seeking, track changes, layered dialogs, Back/Escape, focus, privacy/removal order |
| Organization | Review/link/unlink, stale revisions, dismissal during writes, retry, cleanup/Undo, selection labels |
| Recap/export | Period changes, story/navigation, snapshot/live views, artwork preparation, privacy changes and cancellation |
| Sound/visualizer | Control reachability, pause/resume, mode changes, reduced motion, failure/retry, hidden cleanup |
| Desktop windows/menus | Fixed routing, duplicate activation, child dismissal, settings synchronization and main-window shutdown |
| Shared ergonomics | EN/ES, light/dark, keyboard, focus containment/restoration, touch targets, 320/390 px, short landscape windows and zoom-sized layouts |

## Execution

1. Review current controllers and existing coverage, then reproduce uncovered races and layout/accessibility failures with focused tests.
2. Fix confirmed issues in the existing architecture. Add tests that exercise the problematic user sequence rather than mirror implementation details.
3. Inspect screenshots and actual isolated Windows interactions for changed flows.
4. Run frontend checks, the complete browser suite and relevant native/domain gates. Build Windows and ARM64 Android if shared UI changes; verify package metadata, signature, native-library identity and frozen frontend assets.
5. Record results here and in `docs/verification.md`, separating automated/build evidence from Android/device acceptance. Commit completed fixes for review.

## Findings and results

### Confirmed findings

| Severity | Reproduction | Correction |
|---|---|---|
| High | Open one saved playlist, delay its catalog read, then open another. The older response replaces the newer choice. | Collection request ownership rejects obsolete reads and obsolete errors. Cards acknowledge pending opens. |
| High | Start opening a playlist, switch to Songs, then return to Playlists after the read completes. The old selection unexpectedly appears. | Leaving the view invalidates the open request; canceled reads also clear their loading indicator. |
| High | Fail manual-playlist persistence. The dialog closes and conceals the recoverable draft. | Saving reports success explicitly; the dialog closes only after a successful write. Title and selection remain available for Retry. |
| Medium | Hold a manual Save response and submit again. Save remains enabled, allowing additional writes with new IDs. | A synchronous submission guard, disabled draft controls and a stable draft ID prevent duplicate submissions. |
| High | Reorder a saved playlist, then fail Save. Editing ends as though persistence succeeded. | Keep editing and the unsaved order on failure; prevent row changes during the pending save. |
| Medium | Complete an Add-to-playlist write after dismissing it and opening Settings. The old completion can close the new dialog. | Completion belongs to the originating dialog lifetime. Apply the same protection to manual creation, Track Details additions and organization mutations. |
| Low | Keyboard-focus an EQ band in dark mode. The control uses a sharp white outline, inconsistent with the approved orange rounded focus frames. | Inputs, selects and textareas use the theme focus color and rounded corners; retain system colors in forced-color mode. |

The first five defects were reproduced by tests against the pre-fix behavior. The delayed Add-to-playlist completion is covered after the fix and follows the same unguarded-close path found in review; it was not independently established by the initial baseline run because that test had a dialog-name error. The focus discrepancy was observed in a rendered screenshot. Explicit Artwork/preferred-copy selector labels were added as clarity improvements; the original Artwork selector already passed the concise-name assertion.

### Evidence and limits

- All ten new failure/navigation checks passed in the complete regression run. That invocation recorded **132 passes and five failures**: one timeout across a long wall-clock gap and four errors in a test-only focus measurement. All **five targeted reruns passed** after correcting that measurement, covering all **137 journeys** across the two runs. This is not a clean single full-suite result. Full details and retained failures are recorded in `docs/verification.md`.
- Cross-view journeys exercised 1280 × 800 EN/light, 390 × 844 ES/dark, 320 × 640 EN/Reduce Motion and 640 × 360 ES/dark. They cover repeated tab navigation, Settings, manual creation, Now Playing, Queue, EQ and all visualizer modes, with keyboard containment, horizontal-overflow and automated WCAG checks.
- Inspected screenshots under ignored `artifacts/ui-audit-*.png`. These show real production-browser rendering, not Android WebView or a device keyboard. The short-window EQ screenshot exposed the focus inconsistency above.
- The complete existing browser suite supplies additional import, search/paging, touch selection, generator/feedback, organization/cleanup/Undo, Recap/export/privacy and detached-window/menu regression coverage. A passing suite establishes the tested sequences, not every possible interaction.
- Actual isolated Windows save/edit, navigation, Queue/Back, Spanish/dark and resizing checks passed. Frontend **111**, Rust core **32**, native Rust **29** and actual Kotlin plugin **9** tests passed. Windows x64 and ARM64 Android development builds passed at unchanged **0.15.0**, with verified versions, APK signature, packaged/compiled native-library identity and **46** frozen frontend hashes. See `docs/verification.md` for exact scope and hashes.

### Android verdict

Shared-interface defects warranted fixes before further Android playtesting. Native Android sign-off remains **pending**: no Android target is connected, and the installed `LocalMusic33` AVD has no installed emulator hypervisor driver. This audit does not establish Android file permissions/import cancellation, soft-keyboard/IME reflow, real system Back, rotation/recreation, process death, audio focus, headphone events, foreground/background playback or durable-journal recovery. Test those on a supported emulator or the Galaxy Note10 before describing this as Android-ready. Physical performance/battery/thermal and manual accessibility remain separate measured gates.

### Next Android acceptance pass

1. Import a folder, cancel a second picker, revoke/regrant access, then restart. Existing music remains usable; unavailable files offer recovery without a blocked interface.
2. Type/search/create/rename with the real soft keyboard visible in portrait and landscape. Keep the active field, Clear, Save and Back reachable; repeat with larger system text/display scale.
3. Open player → Queue → track menu → playlist picker and EQ. Use system Back one layer at a time; restore the originating focus and preserve the current queue. Repeat rapid navigation while reads/writes are slow.
4. Play, pause, seek and change tracks from app and notification controls, then background/lock/resume. Exercise a call/audio-focus interruption and wired/Bluetooth disconnect. Pause/seek gaps must not count as listening; ordinary Android headphone/focus policy remains unchanged.
5. Recreate the activity and terminate/restart after a qualified play. Confirm idempotent journal import, stable queue and Recap totals, exclusion behavior and no double-counted sessions. Preserve the user's data when testing; use a disposable profile/device for destructive reset cases.
6. Exercise visualizer modes for sustained playback, exit/background/minimize, then return. Measure Note10 frame timing, CPU, memory, battery/thermal behavior and cleanup independently; run TalkBack and contrast checks on real controls. Build success cannot establish those results.
