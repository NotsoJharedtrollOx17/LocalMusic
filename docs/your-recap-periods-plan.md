# Your Recap: weekly, monthly and yearly listening summaries

Approved 25 October 2026.

## 1. Branch and delivery

- Start `dev.your-recap-periods` from clean `dev` at `67cbcde`.
- Save this specification and commit it before implementation.
- Rename the feature to Your Recap / Tu resumen, including navigation, listening-history explanation, story screens and exports.
- Commit the completed feature for review. Keep application version 0.7.0; merging and releasing require a subsequent request.

## 2. Period selection and presentation

Confirmed choices: calendar periods; Monday–Sunday weeks; Yearly initially; remember the selected timeframe.

- Add an inline Weekly / Monthly / Yearly segmented selector.
- Beneath it, provide Previous, a labeled period selector, and Next. Offer periods overlapping recorded-history coverage through the current period, newest first; group weekly/monthly options by year. Disable navigation beyond those limits.
- Display weeks as date ranges, months as localized month/year, and years as four digits. Avoid ambiguous week numbers across December/January.
- Changing timeframe opens its current calendar period. Remember only the timeframe across restarts; reopening starts at its current period. Browsing history remains selected during the current app session.
- Add a Current period action when viewing an older period. Update boundaries on resume and while visible: current-period views follow rollover; historical views remain fixed.
- Preserve the orange/charcoal design and recap composition. Replace year-specific poster text with the selected period. Use period-neutral playback, coverage, empty-state and ranking labels.
- Show seven daily chart bars for weeks, 28–31 daily bars for months, and twelve monthly bars for years. Monthly axis labels show days 1, 5, 10, 15, 20, 25 and the last day; every bar exposes its full date and total accessibly.
- Distinguish recorded zero listening from dates outside recorded coverage. Show complete, partial or no coverage honestly.
- During period changes, show a stable loading state instead of old totals beneath a new label. Reject stale responses; preserve confirmed content during same-period refreshes.

## 3. Period model and aggregation

- Replace MusicApi.recap(year) with recap({ kind, anchorDate }); kind is week | month | year and anchorDate is a local YYYY-MM-DD date.
- Rust resolves native boundaries using the synchronized device IANA time zone. Browser rules match. Weeks start Monday; periods use inclusive starts and exclusive ends.
- Introduce Recap schema version 2: canonical period kind/start/end dates, completePeriod, ordered chart buckets with start/end dates, listening milliseconds and observed status. Retain totals, rankings, coverage timestamps, playback IDs and privacy revision.
- Replace year/months/completeYear in new results. Add backward-compatible recapPeriod settings preference, default year, with no extra Settings control.
- Flush playback journals/checkpoints before aggregation. Clip intervals to the period, history start and current time; split totals and active days at local boundaries.
- An unexcluded session reaching 30 seconds counts once in the period where it started. Preserve ranking tie-breaks and recap queue selection; split minutes do not create another qualified play.
- Use calendar arithmetic rather than fixed 24-hour days. Resolve ambiguous midnight to its earliest occurrence and nonexistent midnight to the first valid instant afterward, identically in Rust/browser.
- Clamp empty coverage to a valid non-inverted interval. Reject invalid dates/unsupported requests; do not offer future periods.
- Do not alter playback sessions, listening thresholds, pause/seek accounting, exclusions or Android's durable journal.

## 4. Snapshots, exports and compatibility

- Keep existing snapshots unchanged in storage. Normalize schema-one snapshots into yearly schema-two objects on read, preserving totals, zone, coverage and artwork seed.
- New snapshots freeze period metadata and buckets. Opening one selects its timeframe/period without changing remembered live preference. Period changes leave snapshot mode; Return to live recomputes that snapshot's period.
- Use collision-resistant snapshot keys. No SQLite table migration or history rewrite.
- Adapt Story and Feed PNG titles/charts/coverage/preview labels to periods, retaining dimensions and privacy-safe display data.
- Downloads: your-recap-{kind}-{startDate}-{story|feed}.png.
- Privacy checks refresh the matching period. Retain revision checks before rendering/saving, immutable snapshots and accurate cancellation behavior.
- Update current docs and strings; preserve historical plans/releases/source references.

## 5. Verification and acceptance

- Shared Rust/TypeScript fixtures: Monday/cross-year boundaries, leap February, month/year rollover, DST/midnight transitions, partial/no coverage, exact endpoints.
- Verify split minutes/active days, starting-period play attribution, ranking, exclusions, unavailable tracks and unchanged seek/pause accounting.
- Test preference defaults/persistence, legacy/new snapshots, history deletion, zone changes and frozen zones.
- Exercise rapid selection with delayed responses, loading failure/retry, rollover and snapshot/live navigation.
- Inspect EN/ES, light/dark, keyboard/focus, Reduce Motion, narrow/short windows and native high zoom. Check Story/Feed PNGs, privacy invalidation and cancellation.
- Run frontend checks, complete browser suite, Rust core/native and Kotlin regression tests. Build Windows/ARM64 Android; verify versions/signature/library hashes/frozen assets.
- Record actual results in docs/verification.md. Device/background/headphone/screen-reader/performance acceptance requires separate evidence.
