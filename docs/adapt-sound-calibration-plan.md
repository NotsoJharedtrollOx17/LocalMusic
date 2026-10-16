# v0.3.0 baseline and Adapt Sound calibration rewrite plan

## 1. Deliverables and boundaries

1. Release the current stable application locally as **v0.3.0**.
2. Create **`dev.adapt-sound-calibration`** from the updated `dev`.
3. Save this specification to **`docs/adapt-sound-calibration-plan.md`** and commit it on that branch.
4. Leave the new branch **documentation-only**. Implementing the rewrite is a subsequent task.

This document specifies the subsequent rewrite. The v0.3.0 baseline retains the existing calibration implementation.

**Implementation authorized 15 October 2026:** the user requested the adaptive protocol and live band animation directly on `dev.adapt-sound-calibration`. The documentation-only boundary above records the completed release task; it is superseded for this feature branch. `dev`, `main` and the v0.3.0 tag retain the released baseline until a later integration.

## 2. Release the stable application

Planning snapshot: clean working tree; `dev.ui-ux-polish` at `71edbbe`, sixteen commits ahead of both `dev` and `main`, with no divergence. No Git remote configured.

- Fast-forward `dev` to the feature branch.
- Prepare a release commit on `dev`: update application versions to `0.3.0` in npm manifests, Tauri configuration, Rust application metadata and the corresponding lockfile entry. Preserve independently versioned libraries.
- Add v0.3.0 release notes and update README links to the renamed `agents` folder. Describe the shipped navigation, playlists, simplified EQ and stabilized Adapt Sound onboarding accurately.
- State the existing calibration limitation: it records the first heard level and can produce flat results without resolving quieter responses. The adaptive rewrite is planned separately.
- Run frontend checks, the complete browser suite, Rust core/native tests and Kotlin tests. Rebuild the Windows portable development package and ARM64 development APK; verify embedded versions and APK signature.
- Record actual results in `docs/verification.md`. Android runtime, physical-headphone and performance acceptance remain separate gates.
- After checks/builds pass, fast-forward `main` to the release commit and create an annotated **`v0.3.0`** tag there. Follow the existing local-release convention; development packages remain ignored artifacts.
- Create the new branch from updated `dev`, save this plan and commit only its documentation. Preserve earlier tags, source recordings, reference images and the user's folder changes.

## 3. Findings and interpretation

**Confirmed from our implementation:** every frequency starts at −54 dBFS; Yes finishes that frequency, while No raises its level. Saved gains are differences relative to the ear's 1 kHz reference. All initial Yes responses therefore produce zero differences. The current provisional chart overlay does not change saved processing.

**Observed in Samsung's recording:** alternating channel activity, evolving diagrams, repeating tones, Yes/No responses and final comparison. Its progress values are consistent with approximately 36 responses; that count remains an inference.

Samsung's [public documentation](https://www.samsung.com/ca/support/mobile-devices/galaxy-phone-advanced-audio-settings/) describes personalization and preview without specifying its estimator or gain formula. Response-dependent stimulus selection is established in [adaptive psychoacoustic methods](https://bdml.stanford.edu/twiki/pub/Haptics/DetectionThreshold/psychoacoustics.pdf). Our rewrite will use an original bounded search; it will not claim Samsung algorithm equivalence or clinical measurement validity.

## 4. Future calibration specification

### Protocol and scheduling

- Keep six frequencies per ear: **1,000, 250, 500, 2,000, 4,000 and 8,000 Hz**, in that order.
- At each frequency, alternate **Left → Right** for each adaptive round before moving to the next frequency.
- Use three answered trials per ear/frequency: **36 responses**, within the selected 24–36-response budget. Repeated unanswered bursts do not count.
- Search seven levels: **−72, −66, −60, −54, −48, −42 and −36 dBFS**. Start at −54.
- Maintain lower-unheard and upper-heard index bounds, initially virtual indices −1 and 7. Yes moves the upper bound to the presented index; No moves the lower bound. Present the floored midpoint of the remaining bounds.
- After three answers, classify each result as **bracketed**, **below the tested floor**, or **unheard at the ceiling**. Internal brackets have 6 dB width; use their midpoint for the subsequent music-balancing heuristic.
- Preserve three-beep bursts, automatic repetition, foreground leases, cancellation and current silence intervals. Keep the question and answer controls stable; provide no replay button.

### Charts and resulting EQ

- During setup, show **response estimates**, explicitly labeled separately from EQ. Quieter estimated detection levels produce taller bars; untested and range-limited results have distinct appearances.
- Backends supply estimates and bounds. Remove the frontend's invented pending-gain overlay; acknowledge clicks immediately and update estimates after backend acknowledgement.
- At completion, show the **actual proposed personal EQ** and matched-loudness Original/Personal comparison.
- For bracketed measurements, retain the original heuristic: frequency midpoint minus that ear's bracketed 1 kHz reference, clamped to **0–6 dB**, interpolated in log-frequency between valid adjacent measurements.
- Unresolved frequencies receive zero boost. An unresolved reference leaves that ear unadjusted and marks coverage limited. Frequencies outside 250–8,000 Hz remain unadjusted.
- Describe a flat result as “no differences resolved within the tested range,” distinguishing it from limited coverage. Offer restarting setup without replacing an existing profile.
- Preserve full-strength profile priority, independent channels, zero manual preamp, existing limiter behavior and explicit saving.

### Interfaces and compatibility

- Extend `PersonalSession` with a unique current `trialId`, answered-trial progress, total trials and per-frequency estimate/range status.
- Require the current trial identifier for pulse and response actions. Repeats retain it; accepted responses invalidate it. Reject stale or duplicate actions in every backend.
- Implement identical protocol rules in TypeScript, Rust and Kotlin using shared fixtures. React owns presentation and scheduling.
- Add optional profile calibration metadata identifying the new method and twelve coverage statuses. Preserve existing curves, IDs and selection; profiles without metadata remain legacy profiles.
- Persist derived gains and coverage only. Discard raw responses on save/cancel and exclude personalization data from recap exports.

## 5. Verification for the subsequent rewrite

- Shared fixtures: all Yes, all No, bracketed responses, quieter follow-ups after Yes, louder follow-ups after No, alternating ears, floor/ceiling limits and exactly 36 accepted responses.
- Verify stale/duplicate trial rejection, answers during delayed commands, cancellation, lease expiry, output changes and no overlapping tones.
- Verify chart estimates versus final gains, valid flat outcomes, limited coverage, independent channels, legacy-profile preservation and retest cancellation.
- Check actual processed response, matched comparison, persistence and zero setup-induced listening history.
- Inspect EN/ES, mobile/desktop, short windows, keyboard/focus, Back, screen-reader labels and Reduce Motion.
- Require Windows and Android builds. Record actual device/headphone observations separately; browser results establish browser behavior only.

## 6. Implementation map

- `src/sound/calibration.ts`, `src-tauri/src/sound/calibration.rs` and Android `SoundCalibration.kt`: the same bounded estimator, bounds, range status and 36-trial schedule, verified against `tests/fixtures/sound-calibration.json`.
- Browser `PersonalProtocol.ts`, Rust `personal_protocol.rs` and Android `PersonalSoundSession.kt`: trial identity, lease, repeat spacing, derived curves and optional `bounded-3-v1` coverage metadata. Existing profiles without metadata stay readable.
- `usePersonalSetup.ts`: foreground scheduling and immediate answer acknowledgement, with no speculative gain overlay. It sends the trial identifier on every pulse and response.
- `PersonalResponseChart.tsx` / `PersonalResponseChannel.tsx`: six response bars per ear, ordered by frequency; 240 ms height transitions, active channel/frequency indication, gray unanswered bars and striped range limits. Reduce Motion makes updates immediate.
- `PersonalSetupResult.tsx`: actual nine-band proposed EQ, matched comparison, separate flat/limited coverage copy and restart before explicit saving. Existing personal priority, zero manual preamp, limiter and history exclusions remain.
- `comparison.worker.ts`: browser comparison rendering runs away from the UI thread so foreground heartbeats and motion remain responsive. Pending rendering is terminated on Stop, blur, output change or cancellation; a stale result cannot start audio.
