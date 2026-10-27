# Personalized playlists: fresh but familiar

> Archived 26 October 2026 on `dev.personalized-playlists`, created from clean `dev` at `fdb85f5`. The user subsequently authorized implementation. The delivery/Plan Mode wording below preserves the approved specification's original context. See [implementation method](personalized-playlists.md) and [verification](verification.md) for current behavior and actual evidence.

## 1. Delivery and research direction

When execution is enabled, create **`dev.personalized-playlists`** from clean `dev` at `fdb85f5`. Save this specification to **`docs/personalized-playlists-plan.md`** and commit it. **That delivery is documentation-only; implementation follows a subsequent request.** Branch creation and file writing remain pending in Plan Mode.

The future feature will combine listening frequency, metadata and acoustic similarity within the imported library. It will use an original, explainable ranking heuristic—not claim equivalence to another service’s algorithm.

Relevant precedents:

- Spotify distinguishes recommendation influence from hiding songs and supports explicit feedback. Adopt reversible preference controls. [Spotify documentation](https://support.spotify.com/cg-en/article/exclude-playlists-or-tracks-from-your-taste-profile/)
- ListenBrainz separates familiar listening from exploration. Adopt that balance within the local catalog. [ListenBrainz announcement](https://community.metabrainz.org/t/our-weekly-recommendations-are-now-live/646950)
- Plex analyzes local files acoustically, but documents substantial processing costs. Our analysis will instead use bounded excerpts and gradual idle work. [Plex documentation](https://support.plex.tv/articles/sonic-analysis-music/)

Keep version **0.9.0** during implementation. Integration and release require another request.

## 2. Creator and feedback experience

- Upgrade the existing creator. Keep its name, count/duration controls and optional filters; add **Familiar / Balanced / Explore**, defaulting to Balanced and remembering the choice.
- Preserve hard constraints: available local tracks, explicit artist/genre exclusions, no duplicates, maximum two tracks per known artist, and the requested count or duration budget. Unknown artist tags must not group unrelated songs under one shared cap.
- Populate filter suggestions from the complete catalog rather than only currently loaded rows.
- Generate a stable preview. New listening, analysis results and feedback affect the **next generation**, without reordering the current preview, saved playlists or playback queue.
- Add **Suggest less / Restore normal suggestions** to existing single-song menus. Preserve the player menu’s final privacy and library-removal actions. Provide immediate acknowledgement, Undo and persistence-error recovery.
- “Suggest less” reduces that track’s future selection weight; it does not hide it, remove its favorite status, or penalize its entire artist/genre.
- With insufficient history, use favorites and selected filters first. With neither, generate a diverse **Library discovery** mix without pretending to know the user’s taste.
- Show one compact analysis-coverage summary in the creator. Optional “Why this song?” explanations belong in the song menu, without permanent row labels or technical scores.

## 3. Selection policy

Use underlying listening records, not the truncated Recap rankings. Flush pending playback checkpoints/journals before taking the generation snapshot.

**Initial relative weights:**

| Choice | Listening affinity | Metadata affinity | Acoustic similarity | Freshness |
|---|---:|---:|---:|---:|
| Familiar | 40% | 30% | 20% | 10% |
| Balanced | 25% | 30% | 25% | 20% |
| Explore | 10% | 25% | 25% | 40% |

These are initial engineering defaults, subject to later listening evaluation.

- **Listening:** use qualified, non-excluded plays from the last 90 days, with a 30-day recency half-life and logarithmic repeat-count normalization. Fall back to older eligible history if that window is empty, then favorites.
- **Metadata:** combine genre affinity, artist affinity and release-era proximity at 60/30/10 proportions. Normalize tags consistently; renormalize missing components rather than inventing values.
- **Sound:** compare against up to 32 positive anchors selected across the taste profile. Average the three closest valid acoustic matches, preserving multiple tastes instead of collapsing everything into one average sound.
- **Freshness:** reward fewer recorded qualified plays and longer time since the last eligible listen. Describe this as less played **in this app**, not necessarily unfamiliar to the listener.
- Renormalize unavailable top-level signals. Missing acoustic analysis must never become an artificial zero-similarity result.
- Apply existing “Prefer favorites” as a modest additional boost. Apply **Suggest less** as an idempotent **0.1× multiplier**, retaining a nonzero chance.
- Use shared seeded weighted sampling without replacement, followed by constraint-aware ordering that avoids adjacent same-artist tracks when possible. Regenerate uses a new seed; fixed inputs and seed reproduce the same result.
- Never silently relax hard filters to fill a playlist. Explain shortages briefly.
- Excluded sessions must not affect taste, freshness or listening-derived cooldowns. Ordinary skips are not automatically interpreted as dislike.

## 4. Acoustic analysis, interfaces and storage

### Gradual analysis

- Analyze source audio **before EQ and limiting**, independently of the playback player and visualizer. Scanning must be silent and must not create listening sessions.
- Sample up to three non-overlapping eight-second excerpts near 15%, 50% and 85% of each track. Short tracks use their available content.
- Store a versioned, normalized 32-band spectral-power descriptor with coverage information. Average channel power without phase cancellation; silence or insufficient valid audio remains “not analyzed.” This measures broad sound resemblance, not mood or genre recognition.
- Windows uses the existing decoder stack; Android uses a separate extractor/decoder worker. Run one low-priority job while the app is visible and playback is paused. Prioritize taste anchors, then diversify remaining work across artists.
- Stop starting jobs immediately on playback, minimize/background or exit; cancel native decoding cooperatively. No wake lock or background scanning service.
- Browser preview uses guarded whole-file decoding and worker-based feature extraction: at most 16 MiB encoded input and 64 MiB estimated decoded PCM. Oversized, unsupported or unknown-size files retain metadata-only matching. Pending browser decoding may finish after cancellation, but stale results must be discarded. Whole-file decoding is an API constraint. [MDN documentation](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData)

### Contracts and compatibility

- Extend `PlaylistRequest` with optional blend and generation seed. Requests without a blend retain legacy filter-only behavior.
- Return transient recommendation explanations and coverage alongside the generated playlist. Save only ordinary playlist fields and ordered track IDs.
- Add adapter operations for reversible track feedback, analysis lifecycle visibility and analysis status. Rust owns native ranking; browser TypeScript implements matching rules; Kotlin supplies Android descriptors.
- Add idempotent SQLite/IndexedDB storage for feedback and versioned feature caches. Validate source fingerprints before saving; changed files invalidate descriptors. Missing permissions and decode failures remain retryable metadata-only states.
- Generation uses consistent catalog, history, privacy and feedback revisions; discard stale asynchronous results.
- History deletion clears learned listening influence while preserving favorites, explicit recommendation preferences and content-derived acoustic caches. Update its explanation accordingly.
- Persist descriptors, not excerpts or raw PCM. Personalization data stays out of recap exports and network traffic.

## 5. Verification and acceptance

- Shared Rust/TypeScript fixtures: all three weight profiles, deterministic regeneration, cold starts, missing metadata/audio, soft feedback and restoration, diversity, shortages and duration limits.
- Verify excluded sessions cannot influence recommendations; pause, seeks, scanning and duplicate journal imports cannot create listening evidence.
- Shared PCM fixtures across Rust/Kotlin/TypeScript: tones, silence, noise, sample-rate variation, mono, inverted stereo and multichannel input. EQ changes must not change source descriptors.
- Test interrupted scans, file changes, permission loss, corrupt caches, cancellation, restart recovery and stale generation responses.
- Exercise EN/ES, themes, keyboard/focus, narrow/high-zoom layouts, feedback failure/Undo, explicit saving and unchanged queue behavior.
- Run frontend checks, the complete browser suite, Rust core/native and Kotlin tests; build Windows and ARM64 Android and verify package metadata/signatures.
- Record actual results in **`docs/verification.md`**. Measure idle-analysis CPU/memory, cancellation latency and playback continuity separately on the Galaxy Note10. Recommendation quality requires listening review; passing fixtures does not establish musical relevance.
