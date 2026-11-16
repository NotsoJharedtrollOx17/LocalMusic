# Development

Read the root [AGENTS.md](../AGENTS.md), [architecture](architecture.md) and relevant domain guide before substantial changes. Original reference material under `agents/` is historical; preserve its four images.

## Prerequisites and commands

Use Node 24, npm with the committed lockfile, Rust stable and the required native platform tools. On PowerShell use `npm.cmd`. Windows hosted builds use the MSVC toolchain and NSIS packaging. Local portable builds can use the checked setup script's LLVM-MinGW toolchain. Android uses SDK/API 36, build-tools 36.0.0, NDK 29.0.14206865 and compatible JDK/Gradle; CI uses JDK 21.

```powershell
npm.cmd ci
npm.cmd run dev
npm.cmd run check
. ./scripts/env.ps1
npm.cmd run test:core
npm.cmd run test:browser
./scripts/build-desktop.ps1 -Portable
./scripts/build-android.ps1 -Debug -Target aarch64
```

`scripts/doctor.ps1` checks the local toolchain. `scripts/setup-portable.ps1` bootstraps the pinned optional local toolchain. `scripts/env.ps1` discovers existing local tools. Do not rerun Android initialization during ordinary development. The copy-packaging fallback handles Windows symlink restrictions only after native compilation succeeded.

## Source map

| Area | Entry points |
| --- | --- |
| Composition/controllers | `src/App.tsx`, `src/app/`, `src/components/` |
| Contracts/adapters | `src/types.ts`, `src/api/`, `src/domain.ts` |
| Native commands/player/windows | `src-tauri/src/` |
| Persistent domain/store | `crates/music-core/src/` |
| Android service/processors/journal | `src-tauri/plugins/native-music/android/src/` |
| EQ/visualizer/browser DSP | `src/sound/`, `src/visualizer/` |
| Recap display/export | `src/recap/`, `src/export.ts`, `src/ShareRecap.tsx` |
| Regression suites | `tests/browser/`, `tests/native/`, crate tests and Kotlin tests |

## Change workflow

Start from updated `dev`, create `dev.feature-name`, and archive a substantial approved plan before implementation. Commit focused changes and evidence. Merge reviewed work into `dev`; integrate a verified release into `main` and tag that reviewed main commit. Never develop a feature directly on `main`, rewrite historical release tags or delete unmerged work.

Trace a feature through its UI call site, adapter contract, native domain rule and browser counterpart. Native catalog/history/playlist policy belongs in Rust; Android background playback and durable journaling belong in Media3. Treat browser, mocked desktop and actual-device evidence separately. Preserve existing source tags, track IDs, history and saved snapshots through organization changes.

Keep imports cancellable, search/generation replies revision-scoped, overlay focus isolated and error recovery usable. Do not start listening sessions from analysis or demos. New documentation must describe current behavior and link to [measured evidence](verification.md). Relevant [tests](testing.md) and [release checks](release-process.md) are required; reversible cosmetic work does not need redundant implementation-mirroring tests.

## Branding

`src/brand/mark.svg` is the centered note/ring master used by the header and Recap stamp. `node scripts/generate-icons.mjs` derives the broken-ring/orange-period launcher variant and platform resources; Android foregrounds include explicit mask-safe padding. Intermediate output belongs under ignored artifacts. Preserve runtime theme contrast and inspect real native icon masks when changing these assets.
