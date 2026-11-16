# Branding and Recap image delivery

`src/brand/mark.svg` is the centered note-and-ring master. The header embeds its vector with theme colors; Recap PNGs use its orange/charcoal treatment beside the `local.` wordmark. Native icons use a warm paper background. Run `node scripts/generate-icons.mjs` after editing the master to regenerate the Windows ICO/PNG and Android legacy, round, adaptive and monochrome resources with the installed Tauri CLI. Generated intermediate assets remain under ignored `artifacts/brand-icons`.

Recap export reserves the preview area before rendering, decodes the PNG before showing it, and retains the action positions when changing format. Loading has a rotating indicator, slowed under Reduce Motion; the preview only fades in. The inline save confirmation expires after three seconds without moving focus.

The Windows/Android launcher variant interrupts the ring at its lower-right edge with a large orange period. It is derived by the generator; header and Recap marks retain their complete rings. See the [launcher refinement](launcher-dot-refinement.md).

Android 10 and later save to **Pictures/Local Music** using MediaStore, without a destination picker or new storage permission. A pending image is published only after a successful write; failure removes the new row. Android 8–9 retain the document picker. Windows retains Save As and reports cancellation accurately; browser preview starts a download rather than claiming the file reached a device folder.

**Share image** opens Android's system share sheet with a temporary PNG URI, or the browser's file-sharing API where supported. Available social destinations depend on installed apps; choosing a destination and publishing remain user actions. Sharing does not save a Gallery copy or display a saved confirmation. Windows uses Save As. Share-cache access is restricted to the export directory; each new share prunes files older than 24 hours, and new cache writes are capped at 64 MiB.

Both Story (2160 × 3840) and Feed (2160 × 2700) retain artwork, rankings, calendar coverage and the listening disclaimer. Existing privacy/organization revision checks run before rendering and delivery. Exports contain display data, never source paths, exact listening timestamps or private session records. Rendering, saving and sharing do not alter playback or listening history.

See the [archived plan](branding-recap-export-plan.md) and [measured verification](verification.md). Application version remains 0.19.0 pending release review.
