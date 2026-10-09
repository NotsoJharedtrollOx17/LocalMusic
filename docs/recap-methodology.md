# Recap methodology, version 1

A play qualifies after 30 seconds of actual playing time within one session. Shorter sessions contribute time but do not count as qualified plays. Paused, buffering and seeked-over time contribute zero. Pause/resume preserves a session; a replay or track transition starts another.

Native players measure elapsed playing time with monotonic clocks. Approximately every ten seconds and at transitions, they persist an interval anchored to UTC and its monotonic duration. Calendar allocation uses the interval's UTC anchor plus this duration; a wall-clock correction cannot increase listened time. A crash may lose the current uncheckpointed interval.

Intervals are split at local month/year boundaries in the selected IANA zone. A qualified play belongs to the local year of the session start. Top tracks sort by qualified plays, then played milliseconds, then stable ID. Artists aggregate normalized artist labels; albums use artist plus album labels. This first version does not infer canonical artists, merge remasters or interpret acoustic meaning.

Excluded sessions contribute neither time nor rankings. A toggle during a session excludes or includes the entire current session. Original sample audio is always excluded. History deletion also deletes saved snapshots and resets the coverage start, while retaining music and playlists.

Recaps show the real collection start. Months outside coverage are marked unobserved. Saved snapshots freeze metrics, names, track IDs and a visual seed. The recap playlist contains up to 25 available, actually qualified tracks, capped at two per artist; the cap is relaxed when fewer than ten tracks are available.

Internal snapshots preserve playback references privately. Exported JSON includes only display metadata, calendar dates, rounded minutes and counts. PNG exports use a 1080×1920 static card. Neither format includes source paths, exact timestamps, private playlist names or excluded-session data.

Snapshots retain immutable metrics. If session exclusions change after a snapshot was saved, sharing that snapshot is blocked by its internal privacy revision. Generate a new recap to share the corrected history. The revision is not exported.

Desktop checkpoints cap the monotonic interval by rendered source-position progress. Seek rebases that position. This prevents system suspension or an audio stall from adding the whole elapsed timer gap to listening time. Native interruption behavior still requires device verification.
The browser adapter similarly bounds checkpoints by the audio element position. It checkpoints before programmatic seeks and rebases when playback resumes.
