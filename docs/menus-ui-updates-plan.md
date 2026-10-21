# Player and playlist layout stabilization

## 1. Summary and branch workflow

Create **`dev.menus-ui-updates`** from the clean `dev` baseline at `59e1840` and save this plan before implementation. Preserve `main`, release tags, reference images, and the approved contextual-menu contents.

This revision changes presentation and accessibility only. No public `MusicApi`, persistence, DSP, or listening-accounting changes are expected.

## 2. Now Playing and Queue

**Confirmed causes:** the secondary controls use content-dependent `space-between` spacing; mobile header columns have unequal widths; player-body scrollbars lack the styling applied to other dialogs.

- Implement the selected **three balanced controls**: Sound options → Track actions → Exclude from recap. Use equal-width columns, matching rounded-square outlines, icons above centered labels, and consistent padding.
- Keep all three controls visible at narrow widths. Allow localized labels to wrap without truncation; stretch cells to equal heights and maintain at least 44 px interaction targets.
- Preserve privacy as an accessible checkbox, styled to match its neighboring controls. Show its checked state through an orange treatment and check indicator; retain pending, disabled, and failure behavior.
- Preserve transport order: Shuffle → Previous → Play/Pause → Next → Repeat. Use symmetric button spacing and responsive gaps so the play button, progress track, header title, and footer share the same centerline.
- Give the header equal side regions on desktop and mobile. Keep the title centered independently of the Close and Queue/Now Playing labels.
- Apply consistent thin scrollbars to the player body, suppress redundant scrollbar arrows where supported, and reserve symmetric scrollbar space to prevent horizontal shifts.
- Retain anchored controls, square artwork fitting, body scrolling, and existing queue action columns. Preserve disabled first/last-row actions and current-track removal restrictions.
- Extract the footer into a focused component. Consolidate touched player styles and remove superseded overrides rather than adding another correction layer.

## 3. Playlists and related layout cleanup

- Move **“Made for your library”** into the overview toolbar beside the existing primary creation button. Remove the empty toolbar placeholder and the separate repeated section heading.
- At widths above 600 px, vertically center the heading and creation button on one row. At 600 px and below, keep them in the same header container, stacking the heading above a full-width button with a consistent gap.
- Preserve existing English/Spanish button labels, automatic collection order, saved playlists, and playlist-generation behavior.
- Keep one playlist title in detail views. Make the Back, count/duration, and Edit/Save row wrap predictably: navigation/actions first, metadata underneath on narrow screens.
- Standardize spacing between the toolbar, automatic cards, saved cards, and generator. Keep loading/error states within their corresponding collection.
- Consolidate only the affected layout rules. Preserve the orange/charcoal palette, typography, and one component per TSX file.

## 4. Verification and completion

- Add geometry regressions for centered player headings and transport, equal secondary-control widths/heights, aligned icons, and playlist heading/button placement. Allow no more than 1 CSS px rounding difference in alignment checks.
- Exercise Now Playing ↔ Queue, queue reordering, privacy pending/failure states, Track actions, Sound options, Escape/Back, and focus restoration. Confirm one interactive overlay at a time.
- Inspect EN/ES, light/dark, long titles, desktop, 320/390 px widths, short windows, actual Windows 200% zoom, and Reduce Motion. Require readable labels, reachable controls, and no horizontal overflow.
- Run frontend checks, the complete browser suite, and Rust core tests. Build and inspect Windows; build the ARM64 development APK and verify its metadata/signature. Keep generated assets fixed during native compilation and serialize Gradle gates.
- Record actual results and remaining platform gates in `docs/verification.md`. Android runtime, manual screen-reader, and physical-device acceptance require their own evidence.
- Commit the completed revision on the feature branch for review. Merging or releasing requires a subsequent request.

## Execution record

21 October 2026: created the branch from `59e1840` and saved this specification before implementation. Implementation and acceptance results follow in `verification.md`.
