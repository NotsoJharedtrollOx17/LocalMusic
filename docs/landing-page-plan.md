# Local Music showcase and landing page

16 November 2026. Requested: give Your Recap and the visualizers greater prominence in the README, and create a concise landing website with the app's visual language, downloads, repository and authorship.

Develop on `dev.landing-page` from clean dev. Commit this plan before implementation. Keep application version 1.0.0 and existing release tags/package bytes intact.

- Lead the README gallery with Your Recap and active visualizers. Use reviewed captures from the real app; identify original test audio or illustrative listening data rather than implying fabricated personal statistics.
- Build a small, responsive static page under `website/`: an introduction, Recap, the three visualizer modes, Windows/Android downloads and a short author section naming Abraham Jhared Flores Azcona. Retain the local. mark, orange/charcoal/warm-white palette, Space Grotesk/Inter typography and rounded orange focus frames.
- Keep the website independent of the shipped application. Use existing assets and self-hosted fonts, no analytics, accounts, external font services or application data. Provide keyboard navigation, useful alt text, reduced-motion support and layouts down to 320 px.
- Sites hosting tools are unavailable in this session. Use a separate GitHub Pages workflow for this public repository, with minimal Pages/OIDC permissions and no access to Android signing. Prepare and inspect the concrete site before enabling publication. Verify deployed URLs and download destinations before reporting it live.
- Record asset provenance, local checks, responsive/browser evidence and actual deployment in docs/verification.md. Commit focused changes, integrate through dev into main, and preserve the dev-first workflow.
