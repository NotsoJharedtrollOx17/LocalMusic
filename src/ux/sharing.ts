import { native } from "../api";

export function audioShareLabel(labels: {
  shareAudio: string;
  saveAudioCopies: string;
}) {
  const chooser = native
    ? /Android/i.test(navigator.userAgent)
    : typeof navigator.canShare === "function" &&
      typeof navigator.share === "function";
  return chooser ? labels.shareAudio : labels.saveAudioCopies;
}
