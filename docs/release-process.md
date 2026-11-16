# Release process

## Branches and versions

Develop on `dev.feature-name` derived from `dev`. Integrate reviewed work into dev and then reviewed release changes into main. Tag the verified main commit; synchronize dev afterward. Preserve old tags and delete only feature branches proven merged. Record cleanup tips in [history](releases/history.md).

Synchronize npm manifests/lockfile, native Cargo package/lockfile, Tauri configuration, citation metadata and release notes. `node scripts/check-version.mjs` enforces package agreement. Android uses Tauri's monotonically increasing version code. Changing release metadata requires rebuilt binaries; a new tag is not evidence of a new build.

## Signing and optimization

Windows x64 installer/portable packages are unsigned unless an Authenticode service is explicitly configured. Include required runtimes/notices and checksums. Hosted Windows builds use MSVC; local LLVM-MinGW builds provide a portable fallback rather than pretending to have produced an installer.

Android release builds use a permanent key outside Git, supplied through protected release secrets. Protect and back up the key and passwords before publication; losing it prevents signing future compatible updates. Never log credentials, commit keystores or upload signing material with artifacts. The current development certificate cannot be replaced in place by the new signer. The approved phone transition is private backup review followed by a clean release install, not automatic history migration.

Release Rust uses opt-level 3/thin LTO and stripped shipped symbols while retaining unwind recovery. Android release optimization must preserve Tauri reflection/argument models and Media3. Disable debugging/inspection in distributed release builds. Keep diagnostic symbols/mappings private. Compare size/startup against the preceding build; do not claim speedups from flags alone.

## Verification and publication

Require green hosted verification and release build jobs. The release workflow is restricted to reviewed version tags and uses signing credentials only in release jobs. Validate package versions, APK signature/alignment, packaged native-library identity and embedded frontend assets. Publish Windows installer and portable ZIP, signed ARM64 APK, SHA256SUMS and notes through GitHub Releases. Reruns cannot silently replace an existing release's bytes; failed jobs leave a release unpublished.

Historical tag publication preserves object/commit IDs. GitHub does not produce tag push events when more than three tags are pushed together; verify all historical refs explicitly and publish the final version tag separately. Do not treat historical tag publication as regenerated historical binaries.

Use minimal GitHub permissions and scoped diagnostic uploads. Never expose private profiles or keys. Record hosted run URLs, hashes, certificate fingerprint and actual native acceptance in [verification](verification.md); public release evidence and private diagnostics have different retention/access requirements.
