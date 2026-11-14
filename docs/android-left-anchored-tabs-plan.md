# Left-anchored phone tab carousel — 14 November 2026

Refine the existing UI audit branch, retaining version 0.15.0. The user's clarification supersedes the preceding bounded content slide and centered tab-strip settling.

- Limit XMB-style horizontal motion to the phone Library tab strip. Keep the content below stationary during drags and tab changes; preserve desktop transitions and vertical scroll restoration.
- Align each selected phone tab to the strip's left edge, matching Songs at startup. Include trailing scroll space so even Your Recap can reach that anchor. Retain label order, stable widths, accessible names and the orange indicator.
- Taps, content swipes, keyboard activation and deliberate strip scrolling resolve to the same left anchor. Strip scrolling chooses the tab nearest that anchor, not the viewport center. Preserve interruption cancellation and avoid recursive selection during programmatic settling.
- Reduce Motion aligns immediately. Keep keyboard focus visible without vertical page scrolling and remeasure for resize, language and text-size changes.
- Verify focused carousel, selection, swipe cancellation, keyboard, EN/ES, narrow/large-text and Reduce Motion cases; run frontend checks and record actual evidence. Rebuild/install the phone package only when supported by the available device; do not equate browser checks with physical acceptance. No release or merge.

## Follow-up: snappy content entry

The user approved the left-anchored carousel and requested the small slide between views again. Keep the carousel and stationary finger-drag behavior; add only an opaque, directional 18 px entry over 160 ms after a phone tab changes. Cancel an older entry on replacement, keep headers/player fixed, and skip the entry with Reduce Motion. Preserve desktop's existing transition. Verify animation timing/direction, absence of opacity fades, left anchors and interruption behavior; archive actual browser/build/device evidence separately.

## Follow-up: finger-following whitespace and snap-back

The user's next clarification refers to the Samsung Music recording's partial swipe: a short left/right drag must move the content with the finger and reveal a little page-colored blank space, then settle. Add bounded phone-only horizontal drag feedback after intent detection, with resistance at the first/last tab. A sub-threshold or cancelled drag snaps home without changing tabs; a committed swipe retains the left-anchored tab carousel and existing brief entry. Keep branding, tabs, mini-player and selection chrome fixed. Cancel offsets on lifecycle interruption; Reduce Motion skips movement. No duplicate Library controller, synthetic adjacent content or data changes. Verify short gestures in both directions, completion, cancellation, layout clipping, selection and native touch behavior.
