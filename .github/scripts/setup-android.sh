#!/usr/bin/env bash
set -euo pipefail
sdk_root="${ANDROID_HOME:-${ANDROID_SDK_ROOT:?Android SDK root is missing}}"
sdkmanager_path="$(find "$sdk_root/cmdline-tools" -type f -path '*/bin/sdkmanager' | sort -V | tail -n 1)"
test -n "$sdkmanager_path" || { echo 'Hosted Android cmdline-tools are missing'; exit 1; }
yes | "$sdkmanager_path" --licenses >/dev/null || test "${PIPESTATUS[1]}" -eq 0
"$sdkmanager_path" 'platform-tools' 'platforms;android-36' 'build-tools;36.0.0' 'ndk;29.0.14206865'
printf 'ANDROID_HOME=%s\nNDK_HOME=%s/ndk/29.0.14206865\n' "$sdk_root" "$sdk_root" >> "$GITHUB_ENV"
dirname "$sdkmanager_path" >> "$GITHUB_PATH"
