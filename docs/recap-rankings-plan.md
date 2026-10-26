# Your Recap: top three and top ten

Extend the current `dev.your-recap-periods` revision without changing versions or releasing.

- Show the top three songs, artists and albums for the selected recap period. Rank one has the largest type and strongest orange emphasis; ranks two and three decrease progressively. Keep semantic ordered lists, wrapping names and readable mobile layouts.
- Compute artist/album rankings before track truncation in Rust and the browser adapter, preserving existing qualified-play and tie-break rules. Add optional top-three arrays to schema two; keep winner fields for compatibility. Old snapshots show only the rankings they actually recorded, without inventing runners-up.
- Show the ten highest-ranked songs, in ranking order, as a playable recap playlist. Do not apply the existing diverse recap queue's per-artist cap to this top ten. Keep unavailable/removed songs visible in rankings but exclude them from playback/saving. Fewer than ten available songs produce a shorter playlist.
- Provide explicit Play top 10 and Save playlist actions. Saving creates an ordinary editable playlist with a period-specific name; it does not happen automatically or modify snapshots. Guard duplicate clicks while saving and refresh the Playlists collection afterward.
- Reuse top-three presentation in the story. Include runner-up names in privacy-safe Story/Feed exports while preserving image dimensions and privacy checks.
- Verify rankings, ties, old snapshots, top-ten order, manual playlist persistence, EN/ES, responsive sizes, accessible lists and no overflow. Run frontend checks, affected browser journeys and Rust core tests; record actual evidence and platform limits in `docs/verification.md`.
