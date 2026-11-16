# Local Music

[![Verify](https://github.com/NotsoJharedtrollOx17/LocalMusic/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/NotsoJharedtrollOx17/LocalMusic/actions/workflows/ci.yml)

An offline music player for Android and Windows, with local playlists, an equalizer, audio-reactive visualizers and listening summaries. No account, streaming subscription or downloaded recommendation model is required. English and Spanish; light, dark and system themes.

## Get the app

Download published packages from [GitHub Releases](https://github.com/NotsoJharedtrollOx17/LocalMusic/releases): Windows x64 installer/portable ZIP and Android ARM64 APK. Compare package hashes with the release's SHA256SUMS. Windows packages are unsigned. Android production releases use the permanent release certificate; earlier debug-signed installations cannot be updated in place with that certificate. Back up and review app data before switching to a clean installation.

Windows requires WebView2; the installer may need connectivity to obtain it if it is absent. Android minimum API is 26 (Android 8). GitHub packages are direct downloads, not store listings. Exact build/device results and pending manual gates are in [verification](docs/verification.md).

## What it does

- **Library:** Import local audio, browse complete Songs/Albums/Artists collections, filter the current view, and organize lead-artist credits, reviewed duplicate songs and equivalent albums without rewriting tags or deleting files.
- **Playback:** Mini/full player, queue editing, seek, shuffle, repeat and favorites. Android Media3 owns background playback. Windows can consume audio silently when no output device exists; that playback counts toward history.
- **Playlists:** Four automatic collections, manual lists and explicit Familiar/Balanced/Explore generation. Suggestions combine eligible listening, metadata and available source-audio descriptors; reversible Suggest less feedback affects future generations. Source analysis runs only when generating, while visible and paused.
- **Sound and visuals:** Nine-band Equalizer with live Custom saving, plus Spectrum, Geometry and XMB waves driven by post-EQ audio. Windows supports detached player/queue, visualizer and equalizer windows and a native menu bar.
- **Your Recap:** Current calendar week/month/year, real history coverage, top songs/artists/albums, artwork and an explicitly saved top-ten playlist. Privacy-checked Story/Feed PNGs have stable previews, one-tap Android 10+ Gallery saving and system sharing. Opening a chooser does not publish to social media.
- **Phone interaction:** Complete prepared metadata with bounded rendered rows, adjacent-page content swipes, left-anchored tab carousel, selection actions and a persistent mini-player.

See [usage](docs/usage.md), [playlist methodology](docs/personalized-playlists.md) and [Recap/privacy rules](docs/recap-methodology.md). Adapt Sound is no longer part of the application. Recommendations describe broad spectral resemblance, not AI mood/genre recognition.

## Privacy and data

Music, metadata, feedback, acoustic descriptors and history stay local. The app does not upload listening data or source audio. Optional browser sample audio is original and excluded from Recap. PNG exports contain display names, artwork and calendar coverage, not source paths, exact listening timestamps, device IDs or private sessions. Sharing hands the image to a destination you choose.

History deletion removes listening-derived influence and snapshots while retaining favorites, explicit recommendation preferences, source descriptors and music. Local library organization is reversible. See [library/accounting rules](docs/library-and-playback.md).

## Develop and verify

Use Node 24, Rust stable and the appropriate native platform tools. Android CI uses JDK 21, SDK 36 and NDK 29.0.14206865. On PowerShell use `npm.cmd`.

```powershell
npm.cmd ci
npm.cmd run dev
npm.cmd run check
python.exe scripts/check-docs.py
node.exe scripts/check-version.mjs
. ./scripts/env.ps1
npm.cmd run test:core
npx.cmd playwright install chromium
npm.cmd run test:browser
```

Browser preview uses separate IndexedDB/Web Audio storage and does not establish Android background reliability. See [development/setup](docs/developer-guide.md), [testing](docs/testing.md) and [release/signing](docs/release-process.md). Builds, browser mocks and physical-device performance are separate evidence categories; sustained battery/thermal behavior and manual accessibility require measured acceptance.

New development starts from `dev` on a `dev.feature-name` branch. Reviewed changes return to `dev`; `main` contains reviewed release integrations and release tags. Read [AGENTS.md](AGENTS.md) before substantial changes. Keep build artifacts, personal profiles and signing material out of Git.

## Documentation

[Documentation index](docs/README.md) links current usage, architecture, domain rules, verification and release instructions. Superseded plans remain available through Git history. [Release history](docs/releases/history.md) preserves version/branch traceability; original reference images and development briefs remain under `agents/`.

## AI-use acknowledgement

ChatGPT/Codex assisted with implementation planning, code development, documentation and test interpretation. Abraham Jhared Flores Azcona reviewed the work and made the product decisions. Automated assistance and passing tests do not replace the native/device acceptance recorded in this repository. No public conversation archive is claimed.

## Cite this software

```bibtex
@software{floresazcona2026localmusic,
  author  = {Flores Azcona, Abraham Jhared},
  title   = {Local Music},
  year    = {2026},
  version = {1.0.0},
  url     = {https://github.com/NotsoJharedtrollOx17/LocalMusic},
  license = {MIT}
}
```

Machine-readable metadata is in [CITATION.cff](CITATION.cff). Cite the version you used; a GitHub repository is not a peer-reviewed publication.

## License and credits

Copyright Abraham Jhared Flores Azcona. [MIT license](LICENSE). Dependency/artwork/font/runtime attribution appears in [third-party notices](docs/third-party-notices.md) and the bundled license files. Reference screenshots guide design; they do not imply affiliation with Samsung, Sony or Apple.
