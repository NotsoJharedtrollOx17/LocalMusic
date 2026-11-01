# Playback without output and cleaner song, artist and album identity

## 1. Delivery and confirmed choices

- Create `dev.playback-library-identity` from clean `dev` at `96f33b8`.
- Archive this complete specification in `docs/playback-library-identity-plan.md` and commit it before implementation.
- Keep version **0.14.0**. Commit the completed feature for review; merging and releasing require another request.
- Branch creation, Markdown writing and implementation were pending in Plan Mode; execution was subsequently approved.

Confirmed behavior:

- Windows playback advances without output and counts normally toward history, Recap and recommendations.
- Collaborations group under the lead artist while preserving their displayed credits.
- Song duplicates require review. Linked copies remain visible and prevent future playlist repeats.
- Confirmed equivalent albums become one album card with a chosen name, artist and cover.
- Deluxe, Remastered, Anniversary and other editions remain separate by default; users may explicitly link them.
- Live Recap consolidates confirmed song/album identities and lead artists. Raw history and saved snapshots remain intact.

## 2. Windows playback without output

- Introduce physical and silent playback outputs. Silent output consumes decoded PCM through existing EQ, limiter and visualizer processing at real-time speed.
- Use a paced native worker with bounded buffers. Position follows consumed samples; delayed scheduling cannot produce unbounded catch-up or extra listening time.
- Fall back when no output can open or active output fails. Preserve track, position, queue, pause state and listening session.
- Retry physical output on device changes and at most once every five seconds while silently playing. Resume output at the current position; paused playback remains paused.
- Preserve seek, Previous/Next, shuffle, repeat, completion, exclusions and synchronization across detached windows.
- Add authoritative playback `outputMode` and a localized informational status: “No audio output — playback continues.”
- Retain normal file, decoder and persistence errors. Apply existing accounting rules: consumed playback counts, 30 seconds qualifies a play, and pauses, buffering, seeks and exclusions retain their semantics.
- Keep Android audio-focus/headphone behavior and browser playback behavior unchanged.

Use the installed Rodio version's [device-independent mixer](https://docs.rs/rodio/latest/rodio/mixer/fn.mixer.html) for actual PCM consumption.

## 3. Artist and album organization

### Metadata and lead artists

- Import optional structured artist names and album artist, preserving original display credits.
- Resolve lead artist by: local correction → first structured artist → text before a standalone `feat.`, `ft.` or `featuring` marker → complete original credit.
- Do not automatically split ambiguous punctuation or words such as commas, ampersands, slashes, `with` or `x`.
- Use resolved lead artists for Artists browsing, artist sorting, creator filters/suggestions, recommendation artist limits and live artist rankings. Search retains full-credit matching.
- Initially group albums by normalized title and album artist, falling back to lead artist. Preserve edition text and disc/track ordering.
- Backfill existing metadata in bounded, cancellable work. Unavailable files retain conservative fallback behavior and permit local correction.

This follows the separation between [artist credits](https://musicbrainz.org/doc/Artist_Credits) and [album-artist metadata](https://picard-docs.musicbrainz.org/en/latest/appendices/tag_mapping.html).

### Organization interface

- Add **Organize library** under Settings with Artists, Songs and Albums sections. Track Details links to its artist correction; album details links to album organization.
- Support correction/reset, link/unlink, preferred-copy selection and explicit playlist cleanup.
- Keep one interactive overlay per window, restore originating focus, and localize EN/ES.

### Equivalent albums

- Suggest candidates sharing a resolved album artist when either normalized names match or their track lists overlap strongly despite different names.
- Define strong overlap as at least two matching tracks covering at least 80% of the smaller album. Match tracks using confirmed duplicate links or normalized title/lead artist with known durations within two seconds.
- Preserve punctuation during general matching except normalization of case, Unicode and whitespace. Different edition markers prevent automatic candidate suggestions; manual linking remains available.
- Review shows both names, artists, years, covers, track lists and unmatched tracks. Confirmation selects the canonical name, artist and cover.
- Confirmed albums appear as one counted card in Albums and relevant artist subviews. Search matches both canonical labels and original aliases.
- The combined album contains the union of original tracks. Confirmed song-duplicate groups use one preferred available copy; unconfirmed alternatives remain separate rows. Linking albums never silently links their songs.
- Sort by disc/track number with stable fallbacks; retain bonus tracks and distinguish alternative versions by their original edition labels.
- Unlink restores the original album entries. Local organization never rewrites source tags or deletes files.

## 4. Duplicate songs, playlists, Recap and storage

### Song duplicates

- Suggest candidates with matching normalized titles and resolved lead artists, and known durations within two seconds. Retain live/remix/acoustic/remaster title distinctions.
- Require confirmation; the existing acoustic-similarity descriptor does not prove recording identity.
- Show artwork, original credit, album and duration, with existing-player audition controls.
- Provide Link copies, Keep separate, preferred copy and Unlink. Support manual search/linking when metadata prevents detection.
- Persist dismissed pairs until relevant metadata changes. Keep original files, track IDs, favorites and song-specific feedback independent.

### Playlists

- New generation selects at most one eligible available copy per confirmed duplicate group after hard filters. Prefer the selected copy when eligible.
- Manual creation and additions reject an already represented group with immediate acknowledgement.
- Offer explicit cleanup previews for saved playlists, retaining the earliest occurrence. Apply only after confirmation and provide Undo.
- Keep the active queue and current generated preview stable. Use grouped identity for recommendation history/cooldowns without multiplying listening evidence or spreading explicit negative feedback.

### Live Recap

- Aggregate song rankings by confirmed song group, artist rankings by resolved lead artist, and album rankings by confirmed canonical album.
- Attribute album plays using each session's original track membership; choosing a preferred song copy cannot transfer its history into another album.
- Preserve count-first ranking, most-recent qualifying play tie-breaks and existing final fallbacks.
- Preserve total listening, chart buckets, active days, exclusions and qualified-play attribution. Playback and Top 10 saving select available eligible copies.
- Saved snapshots retain frozen content; new live views and exports use current organization.

### Interfaces and compatibility

- Extend typed adapter contracts for metadata, organization queries/corrections, reviewed links and cleanup preview/application.
- Give catalog groups stable opaque IDs so changing canonical names cannot break navigation, membership, search or focus restoration.
- Rust owns native rules/storage; browser behavior matches it; Kotlin supplies imported metadata.
- Add idempotent SQLite/IndexedDB upgrades for reversible organization records and revisions. Preserve source aliases, track IDs and raw listening records.
- Corrections and links survive restart/reimport. Reimported metadata updates original values without overwriting local choices.
- Invalidate affected caches across windows and reject stale search, generation, Recap and export responses. Failed persistence leaves prior state usable.

## 5. Verification and acceptance

- Test Windows no-output startup, device loss/reconnection, pause, repeated failures, seek, queue completion, repeat and shutdown. Verify PCM consumption, visualizer activity and exact listening accounting across output transitions.
- Share Rust/TypeScript fixtures for feature markers, structured artists, ambiguous band names, compilations, album artists, missing tags, corrections and reimport.
- Test duplicate review/link/unlink, editions, unavailable preferred copies, filter eligibility, additions, cleanup preview/Undo and stable active playback.
- Test album spelling/tag variants, different names with overlapping tracks, partial albums, bonus tracks, different editions, homonymous albums by different artists, canonical search/counts and unlink restoration.
- Verify consolidated Recap rankings without double counting, correct album attribution, exclusions, frozen snapshots and export invalidation.
- Exercise EN/ES, themes, keyboard/focus, narrow/high-zoom layouts, persistence failures and concurrent detached windows.
- Run frontend checks, the complete browser suite, Rust core/native and Kotlin regressions. Build Windows and ARM64 Android; verify versions, signatures and embedded assets.
- Record actual evidence in `docs/verification.md`. Windows device-disconnection behavior, Android runtime, physical-device performance and manual accessibility require separate measured acceptance.
