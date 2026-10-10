# Project instructions

Work as an involved senior software engineer and research advisor. Be concise and precise; ask about material product choices.

Read docs/implementation-plan.md and the original .AGENTS development guide before substantial changes. Preserve the four reference images as source material.

- React owns presentation and interactions. Rust owns native catalog, playlist and recap rules. Android Media3 owns background audio and its durable pending journal.
- Browser preview is a separate IndexedDB/Web Audio adapter. It does not prove Android background reliability. Sample audio is original and excluded from recap.
- Journal import is idempotent. Pause, buffering and seeks cannot add listening time. Recaps show their actual history coverage.
- Export uses display data only: no paths, exact timestamps, device IDs or private session data.
- MVP playlist generation uses explicit filters. Semantic AI and models are deferred.
- Use npm.cmd on PowerShell. Run npm.cmd run check, npm.cmd run test:browser and Rust core tests when relevant.
- Native acceptance requires actual builds and Android emulator checks. Physical-device and performance claims require separate measured evidence.
- Keep build artifacts and development tools out of Git. Record actual results in docs/verification.md; never turn untested targets into completed claims.

Branch workflow: dev is the integration branch and includes the Library/recap work, Phase 2 music flow and modularization, and Step 3 EQ/personal sound. Start focused feature branches from dev and merge reviewed changes back into dev. main holds reviewed release integrations; v0.1.0 retains the first baseline and v0.2.0 records the second. Create release tags from reviewed main commits.
