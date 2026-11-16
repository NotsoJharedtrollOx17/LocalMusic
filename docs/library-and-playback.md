# Library and playback rules

## Identity and local organization

Import preserves original display credits and optional structured artists/album artist. Resolve lead artist from a local correction, then first structured artist, then text before standalone feat./ft./featuring, otherwise the complete credit. Do not split ambiguous commas, ampersands, slashes, with or x automatically. Search retains the full credit; browsing, sorting and recommendation artist limits use the resolved lead artist.

Album groups initially use normalized title and album artist, falling back to lead artist. Stable opaque group IDs preserve navigation through canonical renaming. Disc/track tags control album ordering. Different editions remain separate by default.

Duplicate candidates require matching normalized title/lead artist and known durations within two seconds. Recording identity requires review; spectral similarity is not proof. Confirmed copies remain independently visible and retain independent favorites/feedback. Preferred available copies drive grouped selections; unlink restores independent identities.

Album candidates share an artist and matching normalized names or strong track overlap: at least two matching tracks covering 80% of the smaller album. Edition markers prevent automatic suggestions across editions. Explicit linking chooses canonical name/artist/cover and unites tracks; it never silently confirms song duplicates. Bonus/unmatched tracks remain. Source tags/files and raw history are never rewritten.

New playlist selection/additions use at most one eligible member of a confirmed song group. Explicit cleanup previews retain the earliest occurrence and provide Undo. Existing queues and confirmed generated previews remain stable. Live Recap consolidates confirmed identities but attributes album plays to each session's original track membership.

## Automatic collections

Recently added contains the latest 100 first insertions; reimport preserves insertion ordering. Recently played contains up to 100 distinct tracks ordered by latest eligible listening activity. Most played contains up to 100 qualified-session leaders with listening/latest-activity/title/ID fallbacks. Favorites contains visible, available favorites ordered by title/ID. Sample/excluded listening never contributes. These collections cannot be renamed or deleted.

## Playback and accounting

One player owns queue, shuffle, repeat, position and completion. Actions pass stable IDs; filtered playlist editing maps back to original membership positions. Hiding a track retains history and playlist membership for recovery and does not delete audio. Unavailable/hidden tracks are excluded from new playback selections.

Windows physical and paced silent outputs consume decoded PCM at real-time speed through existing DSP. Device absence/failure switches output while preserving pause, position, queue and listening session. Recovery resumes sound at the current position; paused tracks remain paused. Silent consumption counts normally by explicit product choice. File/decoder/persistence errors still surface.

Android Media3 handles background playback, focus/headphone interruptions and the durable outbox. Browser preview plays through its separate audio element/worklet. Accounting is bounded by consumed source progress; seeks rebase the clock and pauses/buffering add no time. A qualified play requires 30 seconds. Durable imports are idempotent.

## Equalizer

Nine editable bands (63/125/250/500 Hz, 1/2/4/8/16 kHz) range from -10 to +10 dB. Normal/Pop/Rock/Jazz/Classical and automatically saved Custom apply live. Compatibility storage has a neutral hidden first slot and zero preamp. Version-two migration deletes Adapt Sound fields and retains ordinary EQ; no personal curves are converted to Custom. Failed persistence leaves prior state usable and processing inactive/retryable where required. DSP preserves channel handling, coefficient crossfades and linked limiting. A limiter is not a hearing-safety guarantee.

See [Recap/privacy](recap-methodology.md), [recommendations](personalized-playlists.md) and [testing](testing.md).
