import type { Playlist } from "../types";
import type { en } from "../i18n";
const keys = {
  "automatic:recently-added": "recentlyAdded",
  "automatic:recently-played": "recentlyPlayed",
  "automatic:most-played": "mostPlayed",
  "automatic:favorites": "favorites",
} as const;
export function automaticPlaylistLabel(playlist: Playlist, labels: typeof en) {
  const key = keys[playlist.id as keyof typeof keys];
  return playlist.kind === "automatic" && key ? labels[key] : playlist.title;
}
