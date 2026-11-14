# Left-anchored phone tab carousel — 14 November 2026

Refine the existing UI audit branch, retaining version 0.15.0. The user's clarification supersedes the preceding bounded content slide and centered tab-strip settling.

- Limit XMB-style horizontal motion to the phone Library tab strip. Keep the content below stationary during drags and tab changes; preserve desktop transitions and vertical scroll restoration.
- Align each selected phone tab to the strip's left edge, matching Songs at startup. Include trailing scroll space so even Your Recap can reach that anchor. Retain label order, stable widths, accessible names and the orange indicator.
- Taps, content swipes, keyboard activation and deliberate strip scrolling resolve to the same left anchor. Strip scrolling chooses the tab nearest that anchor, not the viewport center. Preserve interruption cancellation and avoid recursive selection during programmatic settling.
- Reduce Motion aligns immediately. Keep keyboard focus visible without vertical page scrolling and remeasure for resize, language and text-size changes.
- Verify focused carousel, selection, swipe cancellation, keyboard, EN/ES, narrow/large-text and Reduce Motion cases; run frontend checks and record actual evidence. Rebuild/install the phone package only when supported by the available device; do not equate browser checks with physical acceptance. No release or merge.
