import { describe, expect, it } from "vitest";
import { trackMenuActions } from "./trackMenuActions";
import type { Track } from "../types";
const track: Track = {
  id: "one",
  title: "One",
  artist: "Artist",
  album: "Album",
  genre: "",
  durationMs: 1000,
  sourceUri: "fixture",
  favorite: false,
  available: true,
};
describe("scoped song actions", () => {
  it("keeps the core actions and omits only the current resolved destination", () => {
    expect(trackMenuActions(track)).toEqual([
      "add",
      "share",
      "details",
      "album",
      "artist",
      "remove",
    ]);
    expect(
      trackMenuActions(track, {
        kind: "albums",
        title: "Album",
        subtitle: "Artist",
      }),
    ).not.toContain("album");
    expect(
      trackMenuActions(track, {
        kind: "albums",
        title: "Album",
        subtitle: "Other artist",
      }),
    ).toContain("album");
    expect(
      trackMenuActions(track, {
        kind: "artists",
        title: "Artist",
        subtitle: "",
      }),
    ).not.toContain("artist");
  });
  it("keeps metadata accessible without audio and excludes unknown/hidden destinations", () => {
    expect(
      trackMenuActions({ ...track, available: false, album: "", artist: "  " }),
    ).toEqual(["add", "share", "details", "remove"]);
    expect(trackMenuActions({ ...track, hidden: true })).toEqual([
      "share",
      "details",
    ]);
  });
});
