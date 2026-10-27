# Rounded keyboard highlights and artwork-rich Recap exports

## 1. Branch and delivery

- Start `dev.focus-recap-polish` from clean `dev` at `98e06a6`.
- Save this plan and commit it before implementation. Keep version 0.10.0. Commit the completed revision for review; merging and releasing require another request.

## 2. Consistent keyboard focus

- Use a smooth rounded rectangular outline: 2 px stroke, 8 px corners, theme-aware contrasting color, and no additional focus fill.
- Give buttons, icon controls, tabs, segmented choices and menu items the same focus treatment. Keep selected, checked, destructive and disabled states distinguishable.
- Draw the highlight independently of circular button backgrounds. Consolidate competing focus rules and avoid conflicts with existing control decorations.
- Keep highlights visible inside scrolling menus and dialogs without shifting layout or overlapping neighboring controls.
- Preserve Tab/Shift+Tab, menu arrow navigation, Escape/Back and focus restoration. Retain suitable focus indicators for inputs, checkboxes and sliders.
- Use immediate, static highlights under both normal and reduced motion; preserve Windows high-contrast visibility.

## 3. Recap exports matching the view

- Retain complete summary images and existing Story 2160x3840 (9:16) and Feed 2160x2700 (4:5) formats.
- Share ranking presentation data between View Recap and exports: Songs, Artists, Albums, matching names, artist details, play counts and recorded order.
- Render separate ranking sections with up to three entries each. First place receives the largest typography and artwork, followed by progressively smaller second and third places.
- Include square cover art for songs and albums. Preserve text treatment for artists and avoid inventing missing ranks.
- Resolve artwork through existing local cover adapters, including albums whose representative track is outside the top songs. Use the same deterministic fallback as the app when artwork is missing, unavailable or fails to decode.
- Prepare artwork asynchronously with bounded loading and discard stale results when the export closes or changes format. Rendering failures remain retryable.
- Recompose each format to fit its hero, listening totals, chart, ranking sections and coverage footer without overlap. Wrap or shorten long text within measured bounds.
- Keep preview identical to saved PNG. Preserve language, period, snapshot compatibility, privacy checks and save-cancellation behavior.
- Keep artwork transient and local. Export only rendered display content; do not add paths, track IDs or private listening records to image metadata. No public MusicApi or storage migration is required.

## 4. Verification

- Check keyboard focus across Library, menus, Now Playing, playlist creation, Recap and dialogs in light/dark themes, EN/ES, narrow windows, high zoom, Reduce Motion and Windows high contrast.
- Verify highlight geometry, visibility within scrolling containers, unchanged selected states, keyboard navigation and focus restoration.
- Test both PNG formats with distinct embedded covers, missing/broken artwork, long titles, fewer than three ranks, legacy snapshots and weekly/monthly/yearly periods.
- Inspect exported PNGs directly and verify dimensions, section order, artwork and rank hierarchy. Confirm preview and download contain the same image.
- Exercise delayed artwork, rapid format changes, dismissal, privacy invalidation and canceled saving.
- Run frontend checks, the complete browser suite and Rust core tests. Build Windows and ARM64 Android; verify embedded assets, APK metadata/signature and native-library hashes.
- Record actual results in docs/verification.md, keeping device runtime and manual accessibility acceptance distinct from browser/build evidence.
