import { describe, expect, it } from "vitest";
import { enabledMenuCommands, type MenuContext } from "./menu";
const context: MenuContext = {
  section: "songs",
  blocked: false,
  pending: false,
  player: {
    trackId: null,
    queue: [],
    playing: false,
    shuffle: false,
    repeat: "off",
  },
};
describe("native main menu eligibility", () => {
  it("keeps EQ, Help and manual creation available without a current track", () => {
    const enabled = enabledMenuCommands(context);
    expect(enabled).toEqual(
      expect.arrayContaining([
        "equalizer",
        "settings",
        "help",
        "about",
        "new-playlist",
        "import",
        "search",
      ]),
    );
    for (const id of [
      "toggle",
      "next",
      "previous",
      "shuffle",
      "repeat-all",
      "player",
      "queue",
      "visualizer",
    ])
      expect(enabled).not.toContain(id);
  });
  it("suspends navigation under overlays, preserves playback, and deduplicates pending commands", () => {
    const player = { ...context.player, trackId: "one", queue: ["one"] };
    const enabled = enabledMenuCommands({ ...context, player, blocked: true });
    expect(enabled).toEqual(
      expect.arrayContaining([
        "toggle",
        "next",
        "previous",
        "shuffle",
        "repeat-off",
        "exit",
      ]),
    );
    for (const id of [
      "songs",
      "search",
      "import",
      "settings",
      "new-playlist",
      "visualizer",
    ])
      expect(enabled).not.toContain(id);
    expect(enabledMenuCommands({ ...context, player, pending: true })).toEqual([
      "exit",
    ]);
  });
  it("does not change search scope by enabling search inside Your Recap", () => {
    expect(enabledMenuCommands({ ...context, section: "year" })).not.toContain(
      "search",
    );
  });
});
