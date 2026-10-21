import { native } from "../api";

export function hasAudioShareChooser() {
  return native
    ? /Android/i.test(navigator.userAgent)
    : typeof navigator.canShare === "function" &&
        typeof navigator.share === "function";
}

export function audioShareLabel(
  labels: {
    shareAudio: string;
    saveAudioCopies: string;
    saveAudioCopy: string;
  },
  count?: number,
) {
  return hasAudioShareChooser()
    ? labels.shareAudio
    : count === 1
      ? labels.saveAudioCopy
      : labels.saveAudioCopies;
}
