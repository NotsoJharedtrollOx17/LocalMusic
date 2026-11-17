# Project instructions

Work as an involved senior software engineer and research advisor. Be concise and precise; ask about material product choices.

Read docs/README.md, docs/architecture.md, docs/developer-guide.md and the relevant domain guide before substantial changes. The original guide and four images under agents/ are historical source material; preserve them rather than applying obsolete MVP targets as current behavior.

- React owns presentation and interactions. Rust owns native catalog, playlist and recap rules. Android Media3 owns background audio and its durable pending journal.
- Browser preview is a separate IndexedDB/Web Audio adapter. It does not prove Android background reliability. Sample audio is original and excluded from recap.
- Journal import is idempotent. Pause, buffering and seeks cannot add listening time. Recaps show their actual history coverage.
- Export uses display data only: no paths, exact timestamps, device IDs or private session data.
- Personalized playlists use an explainable local heuristic; source analysis runs only during explicit generation. Semantic models and mood/genre-recognition claims are outside the current product.
- Use npm.cmd on PowerShell. Run npm.cmd run check, npm.cmd run test:browser and Rust core tests when relevant.
- Native acceptance requires actual builds and Android emulator checks. Physical-device and performance claims require separate measured evidence.
- Keep build artifacts and development tools out of Git. Record actual results in docs/verification.md; never turn untested targets into completed claims.
- Run python scripts/check-docs.py, node scripts/check-version.mjs and git diff --check. Never weaken assertions or skip accessibility checks to obtain a green pipeline.
- Preserve original tags/files, raw history and frozen snapshots through organization changes. Confirm duplicate links; acoustic similarity is not recording identity.
- Coordinate device availability and preserve a fresh paused playback/queue/settings/library baseline. Verify and review a private backup before an authorized clean installation with a new signer.
- Keep profiles, raw recordings, signing keys/passwords and diagnostic symbols out of Git and broad CI uploads. Signing secrets belong only to trusted release jobs.
- Production signing normally permits version tags only. A source-pinned recovery from reviewed main needs explicit owner approval for temporary access and prompt restoration of the tags-only rule; do not infer this security-policy approval from general release authorization.

Branch workflow: main contains reviewed release integrations; never begin feature development there. Start from updated dev and derive dev.feature-name branches. Merge reviewed work into dev, then integrate verified releases into main, tag that reviewed commit and synchronize dev afterward. Archive substantial approved plans before implementation. Keep focused CI, docs, README/citation, instructions and release commits when requested. Preserve published tags, delete only proven-merged feature branches and verify remote publication before claiming it occurred.
