# Testing and evidence

```powershell
npm.cmd run check
python.exe scripts/check-docs.py
node.exe scripts/check-version.mjs
. ./scripts/env.ps1
cargo test --locked --manifest-path crates/music-core/Cargo.toml
cargo test --locked --manifest-path src-tauri/Cargo.toml -- --test-threads=1
npx.cmd playwright install chromium
npm.cmd run test:browser
```

After Android setup, run Gradle `:tauri-plugin-native-music:testDebugUnitTest` in the generated Android project. The browser suite owns an isolated server on port 1421 and writes scoped failure evidence under ignored artifacts. Build the frontend before native tests that embed it. Native timing tests run serially to avoid compilation-load interference.

## CI

Verification runs on pull requests into main/dev and pushes to main/dev/dev.*. Jobs cover frontend/unit/browser/core, Windows native and Android/Kotlin. Runners and action revisions are pinned. Android SDK installation requests supported packages explicitly rather than retired SDK tools. Read exact hosted logs before diagnosing failures.

Browser visual checks must wait for fonts/finite transitions to settle when asserting final geometry or contrast. Tests specifically exercising motion still inspect intermediate motion. Keep assertions, privacy checks and coverage; do not hide failures with global retries, skipped accessibility rules or arbitrary timeout increases. Mocks must advance authoritative revisions just like native writes.

## Native acceptance

Builds establish compilation/package integrity. Browser mocks establish contract behavior. Neither proves audible output, Android background reliability, physical latency, sustained memory/thermal use or screen-reader quality. Record actual devices, OS/WebView, version/commit, package hashes and test steps in [verification](verification.md).

Before phone tests, coordinate availability and preserve a fresh playback/queue/settings/library baseline. Use test audio where playback is needed. A new Android certificate cannot update the old debug app in place: verify and review a private backup before the approved clean installation. Never place app profiles, source audio, credentials or private screenshots in Git or broad CI artifacts.

Release checks include installer/portable startup, import, playback/seek/queue, EQ, visualizer lifecycle, organization, generation, Recap Gallery save/share cancellation and background/resume. Keep unresolved device/performance/manual accessibility gates explicit. See [release process](release-process.md).
