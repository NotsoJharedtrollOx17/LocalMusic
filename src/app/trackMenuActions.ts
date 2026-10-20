import type { Track } from "../types";

export type TrackMenuAction =
  "add" | "share" | "details" | "album" | "artist" | "remove";
export function trackMenuActions(
  track: Track,
  group?: {
    kind: "albums" | "artists";
    title: string;
    subtitle: string;
  } | null,
): TrackMenuAction[] {
  const actions: TrackMenuAction[] = track.hidden
    ? ["share", "details"]
    : ["add", "share", "details"];
  if (!track.hidden) {
    if (
      track.album.trim() &&
      !(
        group?.kind === "albums" &&
        group.title === track.album &&
        group.subtitle === track.artist
      )
    )
      actions.push("album");
    if (
      track.artist.trim() &&
      !(group?.kind === "artists" && group.title === track.artist)
    )
      actions.push("artist");
    actions.push("remove");
  }
  return actions;
}
