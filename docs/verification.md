# Verification and release acceptance

This is the current acceptance record, not a promise that every target has passed. Historical chronological records are preserved at [the v0.20.0 integration](https://github.com/NotsoJharedtrollOx17/LocalMusic/blob/5b6b443/docs/verification.md).

## Established v0.20.0 baseline

| Evidence | Recorded outcome |
| --- | --- |
| Frontend | Production build and 115 unit tests passed |
| Feature browser run | 218/220 initially; stale-version assertion corrected and both failed cases passed on focused rerun; final export/layout cases passed separately |
| Rust/Kotlin | 34 core, 34 native and 17 Kotlin cases passed during feature verification |
| Windows | Actual v0.20.0 runtime loaded 160 tracks paused; portable package built |
| Android | Note10+ SM-N975F, Android 12/WebView 157: v0.19.0 feature builds installed; final badge appearance and 711-track paused baseline preserved |
| Release APK | v0.20.0/code 20000 debug-signed package verified; that version bump was not installed on the phone |

## v1.0.0 acceptance — 16 November 2026

The approved preparation was developed on `dev.release-preparation` from `dev` at `5b6b443`. The plan, CI repairs, documentation consolidation, README/citation, AGENTS guidance, build/signing and version changes have focused commits. All 21 historical tag objects were published and compared with their original local IDs. The 27 obsolete feature branches were removed only after proving their tips were ancestors of reviewed main; [history](releases/history.md) preserves those tips. Future features derive `dev.feature-name` from dev.

| Gate | Actual evidence |
| --- | --- |
| Hosted verification | [Complete run on `5a66096`](https://github.com/NotsoJharedtrollOx17/LocalMusic/actions/runs/43977161316) passed frontend checks/115 unit tests, all 221 browser tests, 34 Rust core cases, 34 serial Windows native cases, the ARM64 Android debug build and Kotlin regression task. [Preceding full run](https://github.com/NotsoJharedtrollOx17/LocalMusic/actions/runs/43975216733) also passed. |
| Windows package | [MSVC/NSIS run](https://github.com/NotsoJharedtrollOx17/LocalMusic/actions/runs/43977161302) built the v1.0.0 installer/portable ZIP, verified 27 embedded JS/CSS payloads, installed silently, checked the installed PE version and confirmed startup. The artifact API digest and downloaded package hashes matched. |
| Actual Windows runtime | Final hosted portable opened the existing 160-track paused profile. Library tabs/search, Settings, player/Queue and native player, Visualizer and Equalizer open/close flows passed with no JavaScript errors. Queue, paused position, settings, EQ and saved playlists remained unchanged. No physical audio output was available in this inspection environment. |
| Android release integrity | Local optimized/minified v1.0.0/code 1,000,000 ARM64 APK passed signature verification, expected permanent certificate, non-debuggable manifest, ZIP/16 KiB alignment, main ELF load alignment and exact compiled/packaged native-library SHA-256 checks. All 27 frozen JS/CSS payloads matched inside the library. A deliberately stale binary was rejected after the phone CSS change. |
| Signing and recovery | Permanent key is outside Git with restricted filesystem access. The owner confirmed the protected offline recovery copy. A private recovery APK/app-data archive was reviewed before the approved clean installation; four SQLite databases passed integrity checks and the archive hash was rechecked. The old debug installation was replaced, rather than claiming an in-place signer migration. |
| Actual Note10+ runtime | SM-N975F, Android 12/WebView 157.0.8103.38. Permanently signed APK installed cleanly, then accepted an update signed by the same key while preserving its new catalog. Media permission and reimport completed with 715 audio files including the original test WAV. Search, player/Queue, EQ preset selection/restoration, all three live visualizer modes and pause settling passed. |
| Android listening/background smoke | Only original quiet test audio was played. MediaSession remained playing for 35 seconds in the background, then paused/resumed correctly. Live Recap showed one qualified play and less than one minute, with partial coverage. The test session was explicitly excluded afterward. This short smoke is not sustained background, underrun or audible/headphone acceptance. |
| Android feature smoke | Explicit generation produced an unsaved 30-track preview and analysis coverage of 3/715. EN/ES, light/dark and Artists/Songs/Albums organization screens were inspected without applying identity changes. English/light were restored. |
| Android image delivery | Weekly Story 2160 × 3840 and Feed 2160 × 2700 PNGs were saved to Gallery and their bytes/dimensions checked. Preview/actions remained reachable. The system image chooser opened and was cancelled without selecting a recipient; the save confirmation dismissed automatically. Destination-specific story composition/posting was not attempted. |
| Documentation/source hygiene | Current guidance was consolidated, 63 superseded documents removed, release notes/licenses preserved and original guides/four reference images left unchanged. UTF-8/local-link validation passed for 36 Markdown files including the recovery record; package/citation versions agree at 1.0.0. No private profiles, signing credentials, APKs or other build artifacts are tracked. |

Initial hosted failures were traced to retired Android SDK installation, Windows mocks using Linux platform detection, premature geometry/contrast sampling, broad one-shot IndexedDB test gates and reloads before preference transactions completed. The checks retain their assertions and accessibility rules; no global retries were added. One actual phone tab-width defect was fixed by reserving both regular and bold text widths. Tauri asset-cache discovery also had to accommodate generated directories beyond the application crate. Release jobs retain exact payload verification.

## Candidate sizes and observations

The accepted Windows candidate executable is 22,035,456 bytes; its installer is 5,408,405 bytes and portable ZIP 7,601,559 bytes. The local signed Android candidate is 16,495,457 bytes, compared with the preceding 217,087,607-byte debug APK. These are different build configurations/toolchains; debug-symbol removal and packaging contribute to that difference. They do not isolate a speedup from LTO or R8.

Three instrumented Windows launches per version on the same 160-track profile produced 6.42/26.42/8.42 seconds for v0.20.0 GNU and 15.37/4.69/4.11 seconds for the v1.0.0 MSVC candidate. Compilation was running concurrently. This noisy, toolchain-dependent startup observation is not an input-latency benchmark or a performance guarantee.

Candidate hashes are not substituted for final distribution hashes: the reviewed-tag [release workflow](https://github.com/NotsoJharedtrollOx17/LocalMusic/actions/workflows/release.yml) rebuilds the packages and publishes SHA256SUMS plus Android and embedded-frontend verification reports. Use those assets from the [v1.0.0 release](https://github.com/NotsoJharedtrollOx17/LocalMusic/releases/tag/v1.0.0) to verify downloaded bytes. Windows packages remain unsigned. The permanent Android certificate SHA-256 is `1d2a4e6f980e5bc15feb3a510ed4b7a4dfb0bc578c4fb5911d902994a41e689d`.

The [first tag workflow](https://github.com/NotsoJharedtrollOx17/LocalMusic/actions/runs/43982001058) successfully built the signed Linux APK but stopped during staging: Tauri CLI used `universal/release`, while staging assumed the local fallback's `arm64/release`. No release was published by that attempt. The [recovery approach](release-recovery-plan.md) preserves the tag and adds a reviewed-main retry with every checkout pinned to the original tag commit. APK discovery requires exactly one release file, and ARM64-only verification remains mandatory.

The [source-pinned recovery run](https://github.com/NotsoJharedtrollOx17/LocalMusic/actions/runs/43985654124) completed successfully and published the stable/latest [v1.0.0 release](https://github.com/NotsoJharedtrollOx17/LocalMusic/releases/tag/v1.0.0). It repeated all 115 frontend, 221 browser, 34 Rust core and 34 serial native cases, Android/Kotlin regressions and both release builds. Application source remains `61a1aaf78d75364f843bd5d86fbf1397715f143e`, while corrected automation came from `c1b2eb7`. The owner approved one-time main signing access; it was revoked and the tags-only policy verified as soon as the signing job acquired its credentials. The source guard accepted the reviewed v1.0.0 tag and rejected malformed, branch-name and debug-era inputs.

All eight public assets were downloaded without credentials. Their GitHub API digests and all seven entries in SHA256SUMS matched. Provenance identifies the original source/tag and recovery workflow separately. Both platform reports matched their actual binary hashes and all 27 frontend payloads matched the tested candidates. The public Android APK also passed independent local certificate, version, non-debuggable, ABI and alignment checks; the hosted job establishes compiled-to-packaged native identity.

| Final public package | Bytes | SHA-256 |
| --- | ---: | --- |
| Android ARM64 APK | 16,492,456 | `471395c8b490f847d9c34ce3c8d3ae4cc4d61e79ec415ca1a194651ef1397686` |
| Windows x64 portable ZIP | 7,601,567 | See the release's SHA256SUMS |
| Windows x64 installer | 5,411,356 | See the release's SHA256SUMS |

The exact public APK was installed as a same-signer update on the Note10+; pulling its installed base APK confirmed the public SHA-256. Version 1.0.0/code 1,000,000, the 714-song catalog after removal of the original test fixture, paused playback and English/light appearance were retained. The exact public Windows executable (SHA-256 `3517f08b91de42fa4f77c7191e53d0814c77e05fa6ae8b70df6f2c7e2a91e17f`) repeated the actual Library/search, Settings, Queue and three detached-window checks, with no JavaScript errors or changes to paused position, queue, settings, EQ or saved playlists. All 22 local/remote tag objects were compared again and remained identical. The temporary candidate-build trigger and merged preparation/recovery branches were retired; subsequent development starts from dev.

## README and copyright follow-up — 16 November 2026

Developed on `dev.readme-showcase` from dev at `7494cec`. The README now explains the project's personal motivation and includes four selected native screenshots under `docs/images`: Windows Library and detached player, plus the Note10+ Library and Equalizer. They are unchanged PNG captures from the v1.0.0 checks above, about 0.5 MB in total, with alt text and expandable full-size image links. They are presentation examples, not additional runtime/performance evidence. Only those reviewed images are public; the remaining diagnostics stay private.

The root MIT copyright holder is now Abraham Jhared Flores Azcona, matching the README and citation metadata. A comparison confirmed that the license terms are unchanged. This repository correction does not replace the existing v1.0.0 tag or published package bytes; future packages copy the corrected root LICENSE.

UTF-8/local-link, version and whitespace checks passed, along with all four image paths, PNG integrity and exact source-image comparisons. GitHub's GFM renderer preserved the gallery and disclosure. A local Chromium preview using observed GitHub styles loaded all images, opened the disclosure and showed no page-wide horizontal overflow at 1280 px and 390 px; its screenshots were inspected. No connected browser was available for a live-site visual check. No app code changed, so the application suites and native installations were not repeated for this documentation-only follow-up.

## Landing page and featured Recap/visualizers — 16 November 2026

Developed on `dev.landing-page` from dev at `d93ba3d`, with the [plan](landing-page-plan.md) committed before implementation. The README now leads with Recap and Spectrum; Geometry/XMB and the existing native galleries remain available in disclosures. The new captures are from the actual v1.0.0 browser preview in a new isolated context, with original synthesized multitone audio and an illustrative 60-session/40-minute history across three days. Captions identify both the preview and demo data. The Story image is the application's unmodified export. No personal profile or phone was accessed, and these examples are not additional native listening evidence.

The static website uses the app's brand/palette and self-hosted Space Grotesk/Inter fonts. Build output is independent of the application: 22 allowlisted files, approximately 2.28 MiB, including reviewed images and licenses. Reference/anchor, font, alt-text, package-version, UTF-8/local-link, syntax and whitespace checks passed. GitHub GFM preserved all eight README screenshot references and disclosures. Hosted download selection was checked against the current published v1.0.0 metadata and all three expected package names.

The committed website browser check passed at 1440, 768, 390 and 320 px: no page-wide horizontal overflow, all images decoded, mode selection/keyboard activation, light/dark persistence, skip-link focus, reduced motion, installation-note disclosure and usable downloads with JavaScript disabled. Axe reported zero WCAG A/AA violations in both themes, including the link-hover state. Screenshots were inspected; a mobile heading-space defect was corrected. The page switches captured visualizer views and does not pretend to play/analyze visitor audio. No page errors or failing asset responses were observed. These checks do not replace manual screen-reader or physical-device website acceptance.

The [Website run](https://github.com/NotsoJharedtrollOx17/LocalMusic/actions/runs/43997888747) passed its build, focused browser checks and deployment on `24f18b3`, publishing [the landing page](https://notsojharedtrollox17.github.io/LocalMusic/) with HTTPS enforced. All 21 served content files matched the tested build; binary images/fonts matched byte-for-byte, with text line endings normalized where necessary. The twenty-second build file is the `.nojekyll` marker. All three package URLs responded successfully and their reported sizes matched the published release. The repository's About homepage now points to the site.

A live headless Chromium smoke at 1440 and 390 px passed page loading, layout, visualizer image switching and theme toggling with no page errors. The updated README was also previewed at 1280 and 390 px, with eight loaded image references, working disclosures and no page-wide overflow; remote README/image blobs matched the committed files. The website build resolves published stable downloads; only its deployment job receives Pages/OIDC permissions. The Android signing environment was rechecked and remains version-tags-only. Application source, version 1.0.0, tag and existing release package bytes remain unchanged.

## Android interaction and cache candidate, 20 November 2026

The [approved hotfix](android-interaction-cache-hotfix-plan.md) is implemented on `dev.android-interaction-hotfix`, `dev.android-artwork-cache`, and `dev.android-recap-preview`. The local integration branch `dev.android-hotfix-integration` carries the [v1.0.1 candidate](releases/v1.0.1.md).

- The frontend build and all 115 frontend unit tests passed. The 34 Rust core tests and 18 Android plugin unit tests passed, including the interrupted artwork migration case. The 38 focused browser tests passed on the updated frontend and covered gesture cancellation, Equalizer layout, tab motion, and Recap export reflow.
- The full browser run reported 217 passes and five timeouts across 222 tests. All five passed in one-worker rechecks using the same frontend and assertions. The 10,000-track catalog and grouped-search tests passed in an isolated recheck after the full run, in 27.4 s and 7.3 s respectively.
- The ARM64 debug APK used version name `1.0.1`, code `1000001`, and the separate `app.localmusic.year.qa` application ID. The compiled and packaged Rust library hashes matched, and all 27 frozen JS/CSS payloads were verified. The APK SHA-256 was `66be4fce26b113ed79781968792f8c783860fe7ec7483035559480fd49f69b67`. The production package reported the same version and update time before and after the side-by-side install.
- On a Galaxy Note10+ running Android 12, the QA startup fixture contained 711 synthetic tracks and 12 legacy thumbnail masters. The first successful Android activity launch reported 738 ms. The WebView rendered 24 song rows at its initial virtualized position. In one DOM-driven Albums → Artists → Songs walkthrough, selection and primary artwork readiness took 681, 103, and 143 ms. A second pass measured 106, 62, and 106 ms. The viewport scale was 1.0 and one Library pane was active at the end.
- On the same phone the final QA package passed the native two-finger WebView test and matched WebView text scaling to the Android font setting. All 12 expected master thumbnails were present under the cache, and the empty legacy artwork directory had been removed. Android reported 188 KiB allocated to the artwork cache and 576 KiB to the synthetic catalog database.
- The Windows host reported a missing Android Emulator hypervisor driver. The software launch stayed offline. Same-fixture v1.0.0 comparison, frame pacing and sustained memory measurements remain open.

### XMB and scroll feedback follow-up

On the Note10+ the old QA build reproduced both reports in three native tap-and-swipe sequences. Your Recap settled 263.49 CSS pixels from the left edge of the tab strip, and each vertical swipe set and cleared the song press highlight. With the corrected QA APK, all three Recap selections landed 0.63 CSS pixels from the left edge. Each swipe scrolled the Songs pane by 43–61 CSS pixels, registered Android pointer cancellation, and produced zero row press highlights. The paused playback controls matched before and after each swipe. The production package version and update timestamp matched across the QA update.

The ARM64 QA APK SHA-256 was `2b21f229ed1e895ecce0eac6855f512013ea1e342d83875a08aeae2fc658715b`. The 115 frontend unit tests and 27 focused browser cases passed. This follow-up used the physical phone for Android acceptance at the owner's direction.

### Recap export and player polish follow-up

The [approved follow-up](android-recap-player-polish-plan.md) is on `dev.android-recap-player-polish`. The frontend build and all 115 unit tests passed. The ARM64 debug package used the separate `app.localmusic.year.qa` application ID and the compiled and packaged Rust library SHA-256 hashes matched. The APK SHA-256 was `49b7f1930441be44f4f585cdd8a9213057c5db1b59e519c486847cf53adea4f2`. Production package version and update time matched before and after installation.

On the Galaxy Note10+, three portrait rounds and one landscape round verified tap and swipe opening and closing, short-drag cancellation in both directions, Queue and Equalizer return paths, focus restoration, paused transport, and the Library scroll position. Equalizer controls aligned with the start of the modal body. WebView Reduce Motion emulation bypassed the cover flight. The original device rotation settings were restored. Three more native Library swipe rounds kept Your Recap 0.63 CSS pixels from the tab strip’s left edge and recorded zero orange press highlights.

After a QA WebView reload on the 711-track fixture, first visits to Albums, Artists, and Songs issued 4, 3, and 0 artwork requests and reached primary artwork readiness in 224, 104, and 113 ms. Songs had already loaded at startup. The second pass issued zero artwork requests across the three tabs and measured 121, 68, and 109 ms. The primary cover stayed neutral when observed loading and showed no generated artwork before its embedded bitmap. These are single instrumented walkthroughs. Frame pacing and sustained memory usage remain separate measurements.

The 44 focused browser cases passed across the initial run and rechecks. Coverage included accessibility, player geometry, Android gesture cancellation, Equalizer placement, English and Spanish Recaps, live and frozen periods, privacy during export, and the Spanish Share cancellation path. Both Story and Feed passed PNG dimension and lower-right logo checks. Native Gallery save and the system share chooser were outside this follow-up’s device checks.

### Now Playing flash follow-up

The Android transition keeps the collapsed panel geometry until the player unmounts. The moving cover uses a loaded image, with the full cover preferred when minimizing. The frontend build, 115 unit tests, and five focused browser cases passed. On the Note10+ the updated QA build passed three native tap cycles. The sampled panel height grew on opening and shrank on minimizing without reversing direction. The same phone run passed swipe cancellation, nested Back, reduced motion, and paused playback checks. Production package metadata matched across the QA update.

The portrait Now Playing layout now centers the artwork and track details above the transport. The Equalizer uses the individual slider frequencies as its labels. The frontend build, 115 unit tests, and the focused player geometry and phone Equalizer browser cases passed. Three Note10+ QA rounds verified centered content, the six frequency sliders supported by the low-sample-rate fixture, and the absence of category labels. The production package version and update time matched across the QA installation.

### Cross-platform native UI flow audit

- Android v1.0.1 on the Note10+ passed three native XMB and scroll checks with no transient row highlights, plus three Player, Queue and Equalizer rounds with nested Back, swipe cancellation, focus return and unchanged paused playback. WebView activation verified all five Library tabs. Android keyboard Back preserved the search filter, Clear restored results, and Settings opened and closed without horizontal overflow. Playback, settings, EQ configuration and playlists matched before and after the navigation walkthrough.
- The isolated Windows v1.0.1 debug build passed native Library menu routing, all five tabs, search clearing, Settings Escape with focus return, and opening and closing detached Player, Visualizer and Equalizer. No JavaScript errors were recorded. The paused playback snapshot, settings, EQ configuration and playlists matched before and after.
- In the detached Windows Equalizer, the normal window leaves a large gap below the header. At a 568 × 438 CSS-pixel viewport the last slider required scrolling. Keyboard focus brought the slider into view, with its frequency label still below the fold. The host reported audio output unavailable, so the walkthrough covered control reachability and status feedback.

### Inline Search layout follow-up

The stacked Search row fits its header and caps its width. The close button keeps its own column, and focusing Search preserves the scroll position. All 115 unit tests passed. The 22 focused browser cases passed across the initial run and recheck, including the updated narrow-row geometry and the 320–1360 px resize check. The isolated Windows QA app verified the field at 677, 823, and 1259 CSS-pixel viewport widths. Search clearing and the paused profile also passed.

On the Note10+ QA build, the 371 CSS-pixel search field and its 48 CSS-pixel close control fit within the visible viewport with the Android keyboard open at viewport scale 1. Back retained the filter and Clear restored results. The paused profile matched, the three native XMB and scroll checks passed, and production package metadata matched across the QA update.

On Android, the Library sort control is hidden while Search is open or a filter remains active. The count can wrap within its own space. The frontend build and 115 unit tests passed, along with focused browser checks for restoring the control after Clear and retaining filter and sort behavior on other platforms.

### Hotfix release verification

The [v1.0.1 tag run](https://github.com/NotsoJharedtrollOx17/LocalMusic/actions/runs/44789629569) built the Android and Windows packages and stopped at the browser verification gate. Publication was skipped. The original tag was preserved. The v1.0.2 candidate corrects the browser touch fixture and waits for pane motion to settle before running the existing swipe and layout assertions. All six affected local cases passed.

The [v1.0.2 release run](https://github.com/NotsoJharedtrollOx17/LocalMusic/actions/runs/44793666528) passed all gates and published the [stable hotfix](https://github.com/NotsoJharedtrollOx17/LocalMusic/releases/tag/v1.0.2) from `4bcb63a`. All eight public assets matched their GitHub digests. The seven files listed in SHA256SUMS matched byte-for-byte, and the packaged executables matched the embedded frontend reports. The production APK passed signer verification and installed in place on the Note10+ as version 1.0.2, code 1000002.

The [parallel main verification run](https://github.com/NotsoJharedtrollOx17/LocalMusic/actions/runs/44793655041) passed Windows and Android and reported 224 of 225 browser tests passing. The Equalizer height assertion observed `179.99996948242188` from the rendered bounding rectangle for a 180 px slider. The check now reads the computed CSS height and keeps the visual scale, spacing, and overflow assertions.

The exact published Windows portable executable passed native menu routing, Search at three window sizes, Settings focus return, and detached Player, Visualizer, and Equalizer flows. The paused profile matched and there were no JavaScript errors. At 568 × 438 CSS pixels, keyboard focus brought the last Equalizer slider into view while its frequency label stayed below the fold.

On the installed production APK, the 713-song count and visible paused mini-player matched their pre-update baseline. The no-results Search screen fit with the Android keyboard open and the sort control hidden. Back retained the query and Clear restored the results. Now Playing and Queue returned through Android Back. The visible Queue button worked by touch while Android's UI hierarchy omitted it by name in Now Playing. This remains a screen-reader follow-up. Playback stayed paused during the walkthrough.

## Separate acceptance still requiring measurement

Manual screen-reader flows, broader Android devices/versions/codecs/providers, physical output disconnection/reconnection, audible/wired/Bluetooth synchronization and sustained background/battery/thermal/resource behavior remain separate gates. The phone was charging during smoke tests. No Note10 CPU, p95 frame time, battery or musical-relevance claim follows from builds, screenshots, fixtures or this short runtime check. Multi-monitor/high-contrast and broader native accessibility inspection are also not established here.

Private profiles, screenshots, keys, mappings and raw device recordings are not public release assets. [Testing](testing.md) defines the acceptance boundaries; [release notes](releases/v0.20.0.md) retain previous versions' scope.
