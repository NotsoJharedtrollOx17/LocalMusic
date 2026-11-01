import type { PlaybackSnapshot } from "../types";
import type { LibrarySection } from "../ux";

export const menuCommands = [
  "import",
  "new-playlist",
  "settings",
  "exit",
  "songs",
  "albums",
  "artists",
  "playlists",
  "year",
  "search",
  "toggle",
  "previous",
  "next",
  "shuffle",
  "repeat-off",
  "repeat-all",
  "repeat-one",
  "player",
  "queue",
  "detach-player",
  "visualizer",
  "equalizer",
  "help",
  "about",
] as const;
export type MenuCommand = (typeof menuCommands)[number];
export interface MenuContext {
  section: LibrarySection;
  blocked: boolean;
  pending: boolean;
  player: Pick<
    PlaybackSnapshot,
    "trackId" | "queue" | "playing" | "shuffle" | "repeat"
  >;
}
export function enabledMenuCommands({
  section,
  blocked,
  pending,
  player,
}: MenuContext): MenuCommand[] {
  const hasTrack = !!player.trackId && player.queue.length > 0;
  return menuCommands.filter((id) => {
    if (id === "exit") return true;
    if (pending) return false;
    if (
      [
        "toggle",
        "previous",
        "next",
        "shuffle",
        "repeat-off",
        "repeat-all",
        "repeat-one",
      ].includes(id)
    )
      return hasTrack;
    if (blocked) return false;
    if (["player", "queue", "detach-player", "visualizer"].includes(id))
      return hasTrack;
    if (id === "search") return section !== "year";
    return true;
  });
}
export interface NativeMenuState {
  revision: number;
  language: "en" | "es";
  section: LibrarySection;
  playing: boolean;
  shuffle: boolean;
  repeat: PlaybackSnapshot["repeat"];
  enabled: MenuCommand[];
}
export interface MenuStatus {
  supported: boolean;
  ready: boolean;
  version: string;
}
export interface MenuEvent {
  command: MenuCommand;
  revision: number;
}
