# Personalized playlists

The current creator uses 1-100 tracks (initially 30), up to three included/excluded whole artist names, genre and Familiar/Balanced/Explore. Included artists are alternatives; exclusions take precedence, genre becomes a preference, and weighted selection cycles across included artists. Preview order changes only on explicit generation. Saved playlists support Rename/Delete and retain ordinary ordered IDs.

Analysis coverage resets on opening the creator and fills after explicit generation. Generation attempts at most three source analyses while visible and paused; it never scans continuously while browsing. The progress stages report actual sound/matching work. There is no duration selector in the UI. See [usage](usage.md) and [verification](verification.md).

## Experience and ownership

The existing creator offers Familiar, Balanced and Explore, remembers that choice, and keeps an editable track count (initially 30), genre, artist and favorites controls. Suggestions stay within imported music. With no eligible history, favorites provide anchors; with neither, the preview explicitly says Library discovery. Browser sample tracks remain usable as demonstration candidates, without becoming taste anchors or listening evidence.

Single-song menus offer Suggest less and Restore normal suggestions. The setting affects only that song's next-generation weight. Undo and failed-write rollback preserve its favorite, visibility, saved playlist and queue states. Player menus still end with Exclude from recap and Remove from Library. A generated preview changes only after another successful generation; saving persists ordinary playlist fields and ordered IDs, without scores or analysis metadata.

React owns presentation and an app-scoped explicit-generation coordinator. Rust owns native ranking, feedback and descriptor persistence; TypeScript implements matching browser rules. Browser ranking and descriptor extraction each run in a Web Worker. Native analysis independently decodes source files with Rodio on Windows and MediaExtractor/MediaCodec on Android. None of these scanners creates a player, listening session, wake lock, audio output or network request.

## Ranking method, version one

Hard constraints run before weighted selection: visible available tracks, explicit artist matching/exclusions and genre constraints when no artist is included, no duplicates, a two-track cap per known artist in general mixes, and count bounds in the UI (legacy duration contracts remain backend-compatible). An explicit Include artist request lifts that artist cap, so a single-artist mix can fill the requested count. Unknown artist values do not share a cap. Hard constraints are never relaxed to fill a mix. Duration mode excludes unknown durations. Requests without a blend retain the previous filter-only policy.

- Qualified evidence means an unexcluded session with at least 30,000 played milliseconds. Ignore future or invalid timestamps. Use the last 90 days, otherwise older eligible history, otherwise favorites. Native journals/browser checkpoints flush before generation.
- Listening affinity sums `2^(-ageDays/30)` and normalizes with `log1p(weight)/log1p(maxWeight)`.
- Metadata combines normalized genre affinity, artist affinity and weighted release-year proximity with proportions 0.6/0.3/0.1. Year proximity is `exp(-absoluteYearDifference/10)`. Missing components are omitted and the remaining weights renormalized.
- Sound matching averages the best three Bhattacharyya coefficients (`sum(sqrt(a[i]*b[i]))`) among up to 32 valid positive anchors, excluding self-matches. Anchor selection prioritizes one per artist before filling remaining slots. This describes spectral resemblance, not semantic understanding, genre detection or mood classification.
- Freshness is `0.5/(1+qualifiedPlayCount) + 0.5*min(daysSinceLastEligibleListen/30,1)`, with an unplayed song receiving one. Counts and last-listen dates use only eligible evidence recorded in this app.
- Familiar uses listening/metadata/sound/freshness weights 0.4/0.3/0.2/0.1; Balanced uses 0.25/0.3/0.25/0.2; Explore uses 0.1/0.25/0.25/0.4. Missing signals are omitted and weights renormalized per candidate.
- Add a 0.05 sampling floor to the blended score. Prefer favorites multiplies that by 1.25 for favorites. Suggest less multiplies the result by 0.1 once. It does not remove that song's recorded evidence from artist/genre/sound affinities or change other candidates' scores. A soft preference is never a ban.
- Sort candidate IDs consistently, then use 32-bit LCG sampling (`seed = seed*1664525+1013904223`, wrapping; `u=(seed+0.5)/2^32`). Sort exponential-race keys `-ln(u)/weight` for sampling without replacement, enforce budgets/caps, then avoid neighboring same-artist tracks where possible. UI regeneration supplies a new random seed. Fixed inputs, time and seed reproduce the ordered result across adapters.

Generation reads a consistent store snapshot. Feedback, privacy, catalog or creator changes invalidate pending UI acknowledgements; later listening or new descriptors do not reorder confirmed previews. Transient result metadata contains a history/favorites/discovery source, analyzed coverage, shortage status and per-song explanation codes. It is not part of saved playlists or Recap exports.

## Acoustic method and lifecycle

Descriptors use source audio before EQ/limiting. Analyze three non-overlapping eight-second excerpts centered near 15%, 50% and 85%; tracks up to 24 seconds use their available content. A reusable 2,048-point Hann-window FFT accumulates channel powers independently, using 32 fixed logarithmic bands from 40 Hz to 20 kHz. Normalize the accumulated bands to sum to one. Fewer than 0.1 analyzed seconds or insufficient signal energy produces no descriptor. Phase-inverted channels therefore do not cancel. Rates outside 8–192 kHz and more than eight channels retain metadata-only matching.

One analysis job runs at a time, only within an explicit Generate playlist request while the app is visible, playback is paused and import is idle. Each request attempts at most three tracks. Taste anchors are prioritized; remaining tracks are scanned across artists. Windows lowers the worker thread priority; Android uses background thread priority. Playback/visibility changes revoke the current generation. Renewed four-second leases provide cleanup when UI scheduling fails. Ordinary blur does not stop music or discard confirmed playlists. Failed, unsupported or silent sources wait five minutes before another attempt.

The browser decodes full files at 48,000 Hz using an offline audio context, preserving the descriptor's treble range, then transfers bounded excerpts to a worker. Files larger than 16 MiB, unknown channel/duration metadata or estimated decoded PCM above 64 MiB are skipped (approximately 175 seconds for stereo at this rate). The estimate is a guard, not a process memory guarantee for malformed files. Browser decoding cannot be aborted mid-call; canceled results are discarded and another decode cannot overlap it. The descriptor worker has a 30-second job deadline. Native decoding checks cancellation between PCM blocks/output buffers; provider/decoder calls may still take time to return.

Windows fingerprints include source identity, duration, file size and modification time. Android checks provider size/modification metadata before/after decoding and refreshes source revisions before generation; providers without usable version metadata remain metadata-only. Browser fingerprints include stored source identity, duration, Blob size and File modification time. Source changes invalidate cached descriptors. Corrupt or unknown-version descriptors are ignored and retried. No raw PCM/excerpts are persisted.

SQLite stores feedback and descriptors in the idempotent `suggestion_less` and `acoustic_features` tables; later library-organization upgrades preserve them. IndexedDB upgrades version one to two while retaining existing stores/records. Feedback and content descriptors survive history deletion, like favorites. Deleting history removes learned listening influence. Existing saved playlists are not regenerated.

## Acceptance boundaries

Shared ranking fixtures establish deterministic adapter agreement and constraints. Shared PCM fixtures use independently computed NumPy reference bands for silence, tones, impulses, noise, inverted stereo, multichannel and sample-rate variation. Existing playback, seek, DSP, listening-journal, privacy and Recap regressions remain required.

Actual recommendation quality requires listening review. Galaxy Note10 CPU/memory, cancellation latency, codec/provider compatibility and playback continuity require physical-device measurements. Browser tests, JVM tests, built APKs and desktop source-decoder tests do not establish Android runtime or performance acceptance.

