# Local Music v1.0.0 release preparation

Approved 16 November 2026. Start `dev.release-preparation` from clean `dev` at `5b6b443`. Commit this plan before implementation. Future work always derives `dev.feature-name` from `dev`; reviewed releases alone enter `main`.

## Delivery and Git history

Use distinct commits for CI repairs, documentation consolidation, README/citation, AGENTS instructions, build/signing, and final release metadata/evidence. Preserve the target commits of all 21 historical tags, publish and verify them as one batch, and publish v1.0.0 separately after acceptance. Record feature-branch tips and safely remove only merged branches. Retain main/dev and the active preparation branch until completion; never force-delete unmerged work or replace published tags.

## Documentation

Audit the 88 Markdown documents against code and measured evidence. Consolidate current guidance into an indexed set covering usage, architecture/development, domain rules/privacy, testing and releases. Delete superseded plans and redundant guides after preserving useful content. Retain release notes, licenses, third-party notices, original development/reference material and all four reference images; Git history preserves removed documents. Replace chronological verification clutter with a current evidence matrix and historical links, repairing links/encoding and obsolete feature claims.

Rewrite README as the public entry point. Add truthful AI-use acknowledgement and copyable BibTeX, with matching CITATION.cff: Abraham Jhared Flores Azcona, Local Music, repository URL, version 1.0.0 and actual release date. Do not invent a public conversation archive. Rewrite root AGENTS separately, including branch policy, current ownership/testing requirements and evidence boundaries.

## CI and release automation

Obtain authenticated failure logs, reproduce and repair browser and Android SDK setup failures without weakening tests. Pin maintained action revisions and runner images; use Node 24, JDK 21 and compatible Gradle/SDK/NDK. Add caches, timeouts, concurrency, least privilege and scoped failure artifacts. Verification covers frontend/browser, Rust core, Windows native and Android/Kotlin on PRs/branch pushes. Separate reviewed-tag release automation validates version consistency, builds/verifies all artifacts and publishes only after success. Restrict signing secrets to release jobs; reruns must not duplicate/overwrite releases. Require successful hosted Actions before final release; local checks alone are insufficient.

## Optimization and signing

Distribute GitHub downloads: unsigned Windows x64 installer and portable ZIP; permanently signed ARM64 Android release APK; checksums and notes. Use Rust opt-level 3, thin LTO and stripped release symbols while preserving panic unwinding required by existing catch_unwind recovery. Compare size/startup with the current release and retain private diagnostics. Enable Android release optimization/resource shrinking with tested Tauri/Media3 reflection keep rules, debugging disabled.

Generate a permanent Android key outside Git in a protected user-owned location. Never print passwords or commit signing material; configure release secrets and secure backup/recovery instructions. Verify key custody/recovery before publication. Preserve application ID and use a monotonically increasing Android version code. Synchronize npm, Cargo, Tauri, citation and release versions.

The user selected a clean Note10+ installation because the release signer cannot update the debug signer. First capture and verify a private backup of database, durable journal and relevant app data; review backup before uninstalling. Then install release fresh and test setup/reimport. Do not imply automatic history migration. Keep unsigned Windows status explicit.

## Acceptance and publication

Run frontend checks/full browser suite, Rust core/native and Kotlin regressions, documentation-link/citation/workflow/version checks, and clean-checkout build instructions. Inspect actual Windows installer/portable and Android release behavior: import, playback/seek/queue, EQ, visualizer, organization, recommendations, Recap save/share and background/resume. Record exact commits, sizes, hashes, certificate fingerprints, frozen frontend/native-library matches and unresolved manual/performance gates. Preserve privacy and listening accounting.

Integrate preparation into dev, reviewed release into main, then create/push v1.0.0 and verify hosted jobs/downloads. Synchronize dev and clean reviewed feature branches. Provide verified remote release links, local packages and remaining gates. No production signing, performance, device or publication claims without actual evidence.
