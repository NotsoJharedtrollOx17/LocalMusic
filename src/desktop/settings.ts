import type { Settings } from "../types";
export const editableSettings = [
  "language",
  "theme",
  "timeZone",
  "visualizerMode",
  "playlistBlend",
  "recapPeriod",
] as const;
export function settingsDelta(previous: Settings, next: Settings) {
  return Object.fromEntries(
    editableSettings
      .filter((k) => previous[k] !== next[k])
      .map((k) => [k, next[k]]),
  );
}
