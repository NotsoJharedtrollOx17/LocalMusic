# Visualizer refinement - 26 October 2026

Implemented on `dev.music-visualizers`, keeping version 0.8.0 and the existing post-EQ analysis/lifecycle contracts.

## Design

- Spectrum maps frequency horizontally: orange bass, warm transitional tones, then blue treble. Peak markers share each band's color. Dark mode uses softer, brighter colors; light mode uses deeper colors against the app's paper background.
- Geometry adapts Abraham Jhared Flores Azcona's **Origin of Symmetry** (2022) from the local `06_OriginOfSymmetryRepo/Origin_Of_Symmetry` project. Preserve its Lorenz parameters (10, 28, 8/3), initial state (0.11, 1, 1), Euler step (1/60), 8,000-point orbit, and distinctive rectangle mapping: x positions both axes, y/z determine dimensions. See [Lorenz's original paper](<https://doi.org/10.1175/1520-0469(1963)020%3C0130:DNF%3E2.0.CO;2>).
- Adapt the artwork to Canvas rather than adding p5/WebGL. Precompute its finite trajectory once on first Geometry use; draw a smoothly interpolated 60-rectangle window, with audio-driven traversal and rotation. Bass changes scale, mids change tilt, treble changes restrained line emphasis. The displayed Geometry scale is enlarged by 25% following visual review. A ping-pong traversal avoids a discontinuous orbit wrap.
- This is an adaptation, not a pixel-identical port: smooth deterministic spatial variation replaces seeded p5 noise, orthographic Y/Z rotation replaces WebGL projection, and translucent theme colors replace the original HSB fills. Preserve the actual mathematical trajectory instead of perturbing its parameters with audio.
- XMB has four independent layers with distinct rates and alternating travel directions. The draw budget is 384 vertices plus twelve highlights; this supersedes the original two-ribbon/192-vertex scene bound. Geometry uses 240 corners, below its original 512-segment cap. All movement remains audio-driven. Pause/completion uses a smooth settling envelope: Spectrum falls to baseline, Geometry collapses into its center and clears, and XMB flattens into a stationary center line. The canvas stays visible to avoid flashing. Settling takes 360 ms, or 500 ms with gentle motion. Playback starts/resumes automatically after a 180 ms warm-up and grows the scene over 180 ms. Reduce Motion now uses gentler automatic motion by explicit user choice, with no Animate button. Silence still settles.
- Canvas and controls follow the existing light/dark/system theme, including changes while open or paused. Use the same paper, surface, ink, muted, rule and accent tokens as the app. No playback restart or capture restart is needed for theme changes.

## Attribution

The source artwork is MIT licensed, copyright (c) 2022 Abraham Jhared Flores Azcona. Its full license is redistributed in `public/licenses/origin-of-symmetry.txt`. No p5 dependency or external artwork files are bundled.

## Acceptance

Check finite source-compatible integration, bass/treble colors, all three modes in light/dark, live theme updates without analysis restart, keyboard/focus, Reduce Motion and narrow layouts. Record actual checks in `docs/verification.md`. Physical Note10 CPU, battery, thermal and synchronization acceptance remain pending; visual improvements do not establish those targets.
