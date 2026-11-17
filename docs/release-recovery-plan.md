# v1.0.0 artifact publication recovery

16 November 2026. The signed Linux Android build succeeded, but release staging assumed the local Windows fallback's `arm64/release` directory. Tauri CLI emitted an ARM64-only APK in `universal/release`, so verification failed before publication. Preserve `v1.0.0` at `61a1aaf` and every historical tag.

Develop this correction on `dev.release-artifact-recovery` from dev, then integrate through dev into reviewed main. Application code, dependencies, version and signing identity remain unchanged.

- Discover exactly one release APK instead of assuming its flavor directory. Retain signature, ABI, version, alignment, native-library and embedded-frontend checks.
- Add a controlled manual retry from reviewed main. An unprivileged validation job resolves a strict version tag to an immutable commit, verifies main ancestry and matching package version, and passes that exact commit to every checkout, including reusable verification/Windows workflows.
- Only the Android job accesses the release environment after validation. Permit that environment on reviewed main as well as version tags; feature branches remain ineligible. Do not expose keys in artifacts/logs or replace the release tag.
- Require all verification/build jobs to pass again before publishing the requested tag's release. Recheck the tag's commit immediately before publication and refuse replacement of published release assets.
- Publish source/workflow commit provenance with checksums. Record the failed attempt and successful recovery in verification, confirm downloads and install the final public APK as a same-signer update when the phone is available.

GitHub reruns retain the original SHA/ref, so simply rerunning the old tag workflow cannot apply a YAML fix. Environment rules match the workflow ref; the reviewed-main retry therefore needs the narrowly scoped main deployment rule. See [rerun behavior](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs) and [environment restrictions](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments).
